/**
 * dsh-notewall — host half.
 *
 * Three things live here and nothing else:
 *
 *   1. the durable note store (lib/store.js), rooted at
 *      `$DSH_HOME/sticky-wall/` — survives restarts and container rebuilds
 *      because $DSH_HOME (~/.dsh) is the persistent volume;
 *   2. the HTTP surface the browser half talks to under `/sticky-wall`:
 *      state polling, note/wall mutations, media upload and media reads;
 *   3. the model-callable tools that create/update notes after the user has
 *      agreed to it in the conversation.
 *
 * The browser half is served from `dsh.client` (lib/client.js) and renders the
 * left-rail panel + wall; it never touches the filesystem itself.
 *
 * @module dsh-notewall
 */

import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { extname, join, normalize } from 'node:path';
import { createStore, DEFAULT_WALL, NOTE_PALETTE } from './store.js';

/** Loader row name — must match package.json `name` and the patch row. */
export const name = 'sticky-wall';

/** Services required before `apply` runs. */
export const inject = ['tools'];

/** Route prefix shared with client/api.js. */
export const API_PREFIX = '/sticky-wall';

/** Upper bound for a JSON request body (media arrives as data URLs, base64-inflated). */
const MAX_BODY_BYTES = 12 * 1024 * 1024;

/** Media content types by extension. */
const MEDIA_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

/** @param {import('node:http').ServerResponse} res */
/* ------------------------------------------------------------------------
 * 启动耗时探针（诊断用，出错静默）
 *
 * 记录到 /root/.dsh/sticky-wall/boot-trace.jsonl（持久卷，容器重启不丢）：
 *   module-load   host 模块被加载（= 插件代码开始执行）
 *   plugin-apply  插件 apply 跑完（cordis 已把插件挂上）
 *   state         /state 每次请求的耗时
 *   client        前端上报（bundle 就绪 / 首帧 / 首次数据到手）
 * 全部 try/catch 包裹：诊断代码绝不允许影响插件本身。
 * --------------------------------------------------------------------- */
// Resolved through the same data root as the store, so the trace file follows
// $STICKY_WALL_HOME / $DSH_HOME instead of a hardcoded /root/.dsh path. The
// fallback keeps tracing alive if resolution ever throws.
const BOOT_TRACE_FILE = (() => {
  try {
    return join(resolveDataRoot(), 'boot-trace.jsonl');
  } catch {
    return '/root/.dsh/sticky-wall/boot-trace.jsonl';
  }
})();
let bootSeq = 0;
function traceBoot(entry) {
  try {
    bootSeq += 1;
    const row = {
      seq: bootSeq,
      at: Date.now(),
      uptimeMs: Math.round(process.uptime() * 1000),
      pid: process.pid,
      type: entry && entry.type,
      ...entry,
    };
    appendFileSync(BOOT_TRACE_FILE, JSON.stringify(row) + '\n');
  } catch (err) {
    /* 诊断失败：静默，绝不能影响插件 */
  }
}
traceBoot({ type: 'module-load' });

function sendJson(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

/** Read and parse a JSON request body, rejecting oversized payloads. */
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('请求体超过 12 MiB 上限'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        resolve(parsed && typeof parsed === 'object' ? parsed : {});
      } catch {
        reject(new Error('请求体不是合法 JSON'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Resolve the data root: `$STICKY_WALL_HOME`, else `$DSH_HOME/sticky-wall`,
 * else `~/.dsh/sticky-wall`. Kept env-overridable so tests never touch the
 * live wall.
 */
export function resolveDataRoot({ env = process.env, home = homedir() } = {}) {
  if (env.STICKY_WALL_HOME) return env.STICKY_WALL_HOME;
  const dshHome = env.DSH_HOME || join(home, '.dsh');
  return join(dshHome, 'sticky-wall');
}

/** True when the request comes from the loopback interface. */
function isLoopback(req) {
  const address = req.socket?.remoteAddress ?? '';
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

/**
 * Build the HTTP handler. Exported so tests can drive it with a plain
 * http.createServer without a Cordis context.
 *
 * @param {ReturnType<typeof createStore>} store
 * @param {{ allowLocalOnly?: boolean }} [options]
 */
export function createHandler(store, options = {}) {
  const allowLocalOnly = options.allowLocalOnly !== false;
  // host 侧 Cordis 上下文（apply 里传入）；唯一用途是 /insert 写会话输入框
  const hostCtx = options.ctx ?? null;

  return async function stickyWallHandler(req, res) {
    let path = '/';
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      path = url.pathname;
      const method = req.method ?? 'GET';

      // 信任栅栏（内核 @deepseek-ai/dsh-client-connection）：先问 connection 服务要不要拒。
      // 它做两件事 —— Host/Origin fence 挡 DNS rebinding 与跨站调用（403），
      // browserAuth 挡没有登录 token 的调用者（401）。
      //
      // 必须排在所有路由分支之前：本插件把一个 prefix handler 挂到 /sticky-wall 上，
      // 便签正文、媒体字节、以及能给任意会话投递 prompt 的 /deliver 全在里面。
      // 少了这一层，本机任何进程（或在反向代理后任何能连上端口的人）都能读光便签、
      // 改数据、甚至借 /deliver 往别的会话里塞一句话。
      //
      // 每次请求都重新取一次服务，不在建 handler 时缓存：cordis 可能在注册本插件
      // 之后才 provide connection，构造期快照会让栅栏永久为 null —— 那样看着有代码，
      // 实际一点拦不住。取不到就退回「无栅栏」的旧行为，而不是不注册路由，
      // 免得插件在裁剪过的宿主组合里整个消失。
      const connection = typeof options.getConnection === 'function' ? options.getConnection() : null;
      if (connection && typeof connection.requestRejection === 'function') {
        const rejection = connection.requestRejection(req);
        if (rejection !== undefined) {
          res.statusCode = rejection;
          res.setHeader('content-type', 'text/plain; charset=utf-8');
          res.setHeader('cache-control', 'no-store');
          res.end(rejection === 401 ? 'unauthorized' : 'forbidden');
          return;
        }
      }

      // Media reads are the only GET that returns bytes.
      if (method === 'GET' && path.startsWith(`${API_PREFIX}/media/`)) {
        const id = decodeURIComponent(path.slice(`${API_PREFIX}/media/`.length));
        if (!/^[\w.-]+$/.test(id)) {
          sendJson(res, 400, { ok: false, error: '非法的媒体 id', code: 'invalidMediaId' });
          return;
        }
        const file = join(store.mediaDir, normalize(id));
        if (!existsSync(file)) {
          sendJson(res, 404, { ok: false, error: '媒体不存在', code: 'mediaNotFound' });
          return;
        }
        const bytes = await readFile(file);
        res.writeHead(200, {
          'content-type': MEDIA_TYPES[extname(id).toLowerCase()] ?? 'application/octet-stream',
          'content-length': bytes.length,
          'cache-control': 'public, max-age=31536000, immutable',
          // Media must never be able to execute as a document in the GUI origin.
          // nosniff stops MIME guessing; the sandbox CSP neuters any active
          // content that slips past the type whitelist.
          'x-content-type-options': 'nosniff',
          'content-security-policy': "default-src 'none'; sandbox",
        });
        res.end(bytes);
        return;
      }

      // Mutations are local-only unless a deployment explicitly opts out:
      // notes are personal scratch space, not a shared board.
      const mutating = method === 'POST' || method === 'DELETE';
      if (mutating && allowLocalOnly && !isLoopback(req)) {
        sendJson(res, 403, { ok: false, error: '便签只能从本机浏览器修改', code: 'localOnly' });
        return;
      }

      if (method === 'GET' && path === `${API_PREFIX}/state`) {
        const since = url.searchParams.get('since');
        if (since != null && since !== '') {
          sendJson(res, 200, await store.since(Number(since)));
          return;
        }
        const traceT0 = Date.now();
        const doc = await store.snapshot();
        traceBoot({ type: 'state', dur: Date.now() - traceT0, summary: false, notes: (doc.notes || []).length, bytes: 0 });
        // fields=summary：只回卡片渲染需要的字段，剥掉体积大头 html（内含内联
        // base64 图片时单条可达数百 KB）。便签墙首次打开先用摘要秒出卡片，
        // 再异步拉一次全量把内容补上 —— 首屏不再等全部正文。
        if (url.searchParams.get("fields") === "summary") {
          sendJson(res, 200, {
            changed: true,
            rev: doc.rev,
            summary: true,
            doc: {
              ...doc,
              notes: (Array.isArray(doc.notes) ? doc.notes : []).map((note) => {
                const { html, ...rest } = note || {};
                return rest;
              }),
            },
            palette: NOTE_PALETTE,
            defaults: DEFAULT_WALL,
            serverTime: Date.now(),
          });
          traceBoot({ type: 'state-summary-served' });
          return;
        }
        sendJson(res, 200, {
          changed: true,
          rev: doc.rev,
          doc,
          palette: NOTE_PALETTE,
          defaults: DEFAULT_WALL,
          serverTime: Date.now(),
        });
        return;
      }

      if (method === 'POST' && path === `${API_PREFIX}/boot-trace`) {
        // 前端启动打点（只记录，不做任何校验拦截）
        if (mutating && allowLocalOnly && !isLoopback(req)) {
          sendJson(res, 403, { ok: false, error: 'boot-trace 只能从本机上报', code: 'bootTraceLocalOnly' });
          return;
        }
        try {
          const body = await readJsonBody(req);
          traceBoot({ type: 'client', ...(body && typeof body === 'object' ? body : {}) });
        } catch (err) {
          /* 上报失败忽略 */
        }
        sendJson(res, 200, { ok: true });
        return;
      }

      if (method === 'GET' && path === `${API_PREFIX}/boot-trace`) {
        try {
          const text = readFileSync(BOOT_TRACE_FILE, 'utf8');
          const lines = text.split('\n').filter(Boolean).slice(-200);
          sendJson(res, 200, { ok: true, rows: lines.map((line) => {
            try { return JSON.parse(line); } catch (err) { return { raw: line }; }
          }) });
        } catch (err) {
          sendJson(res, 200, { ok: true, rows: [], error: String((err && err.message) || err) });
        }
        return;
      }

      if (method === 'GET' && path === `${API_PREFIX}/ping`) {
        sendJson(res, 200, { ok: true, rev: await store.rev() });
        return;
      }

      // 【2026-11-03 诊断】客户端半自报错误：GET 方式（不受 localOnly 限制），
      // 把 message/stack 追加到 <dataRoot>/client-diag.log，供宿主侧排障。
      if (method === 'GET' && path === `${API_PREFIX}/__diag`) {
        try {
          const line = [
            new Date().toISOString(),
            url.searchParams.get('kind') || '?',
            url.searchParams.get('msg') || '',
            (url.searchParams.get('stack') || '').replace(/\r?\n/g, ' | '),
            url.searchParams.get('ua') || '',
          ].join(' :: ') + '\n';
          appendFileSync(join(store.mediaDir, '..', 'client-diag.log'), line);
        } catch {
          // 诊断写入失败绝不影响主流程
        }
        sendJson(res, 200, { ok: true });
        return;
      }

      if (method === 'POST' && path === `${API_PREFIX}/note`) {
        const body = await readJsonBody(req);
        const op = String(body.op ?? 'update');
        if (op === 'create') {
          const note = await store.createNote({
            html: body.html,
            text: body.text,
            color: body.color,
            textColor: body.textColor,
            alarmAt: body.alarmAt ?? null,
            pinned: body.pinned,
            createdBy: 'user',
          });
          sendJson(res, 200, { ok: true, note, rev: await store.rev() });
          return;
        }
        if (op === 'update') {
          const id = String(body.id ?? '');
          if (!id) {
            sendJson(res, 400, { ok: false, error: '缺少便签 id', code: 'missingNoteId' });
            return;
          }
          await store.updateNote(id, {
            html: body.html,
            color: body.color,
            textColor: body.textColor,
            pinned: body.pinned,
            order: body.order,
            alarmAt: body.alarmAt,
            alarmFiredAt: body.alarmFiredAt,
          });
          sendJson(res, 200, { ok: true, rev: await store.rev() });
          return;
        }
        if (op === 'delete') {
          await store.deleteNote(String(body.id ?? ''));
          sendJson(res, 200, { ok: true, rev: await store.rev() });
          return;
        }
        if (op === 'reorder') {
          await store.reorder(body.ids);
          sendJson(res, 200, { ok: true, rev: await store.rev() });
          return;
        }
        sendJson(res, 400, { ok: false, error: `未知操作: ${op}` });
        return;
      }

      if (method === 'POST' && path === `${API_PREFIX}/wall`) {
        const body = await readJsonBody(req);
        await store.updateWall(body.patch ?? body);
        sendJson(res, 200, { ok: true, rev: await store.rev() });
        return;
      }

      if (method === 'POST' && path === `${API_PREFIX}/media`) {
        const body = await readJsonBody(req);
        const saved = await store.putMedia(String(body.dataUrl ?? ''));
        sendJson(res, 200, { ok: true, ...saved });
        return;
      }

      if (method === 'POST' && path === `${API_PREFIX}/alarm/ack`) {
        const body = await readJsonBody(req);
        const id = String(body.id ?? '');
        if (!id) {
          sendJson(res, 400, { ok: false, error: '缺少便签 id', code: 'missingNoteId' });
          return;
        }
        await store.updateNote(id, { alarmFiredAt: Date.now() });
        sendJson(res, 200, { ok: true, rev: await store.rev() });
        return;
      }

      // 定时投递：把便签预约发给某个会话。
      //
      // 不自己写定时器，而是借用内核的 schedule 服务（@deepseek-ai/dsh-schedule）：
      // 它把 reminder 持久化到 storageDomain，Host 重启后仍在，到点会作为
      // follow-up 投递到目标会话（必要时唤醒冷会话）。这是「定时发消息」能力的
      // 正确落点，自己造一套既不可靠、也不会被 DSH 的任务页看见。
      if (method === 'POST' && path === `${API_PREFIX}/deliver`) {
        const body = await readJsonBody(req);
        const noteId = String(body.noteId ?? '');
        const sessionId = String(body.sessionId ?? '');
        const at = Number(body.at);
        const prompt = String(body.prompt ?? '');
        if (!noteId || !sessionId) {
          sendJson(res, 400, { ok: false, error: '需要 noteId 与 sessionId', code: 'missingTarget' });
          return;
        }
        if (!Number.isFinite(at) || at <= Date.now()) {
          sendJson(res, 400, { ok: false, error: 'at 必须是未来的时间戳', code: 'pastTime' });
          return;
        }
        if (prompt.trim() === '') {
          sendJson(res, 400, { ok: false, error: '缺少投递内容 prompt', code: 'missingPrompt' });
          return;
        }
        const scheduler = typeof options.getScheduler === 'function' ? options.getScheduler() : null;
        if (!scheduler || typeof scheduler.create !== 'function') {
          sendJson(res, 503, {
            ok: false,
            error: '当前 profile 没有加载 dsh-schedule，无法定时投递（立即发送仍然可用）',
            code: 'schedulerUnavailable',
          });
          return;
        }
        const title = String(body.title ?? '便签提醒').slice(0, 120) || '便签提醒';
        // 内核 0.2.2 起 create 的签名是 create(request, actorSessionId, signal)：
        //   request = { title, prompt, timing, target }
        //   timing 必须**恰好**是 { kind, <该 kind 对应的 selector> } —— 多一个键都会抛
        //   「timing must contain exactly kind and its matching selector.」
        // 老写法 create(sessionId, {title, prompt, at}) 在 0.2.2 上必然报错：
        // 第一个参数被当成 request，request.timing 为 undefined。
        const record = await scheduler.create({
          title,
          prompt,
          timing: { kind: 'at', at: new Date(Math.round(at)).toISOString() },
          target: { kind: 'session', sessionId },
        });
        await store.updateNote(noteId, {
          delivery: {
            sessionId,
            sessionTitle: String(body.sessionTitle ?? ''),
            at: Math.round(at),
            scheduleId: String(record?.id ?? ''),
          },
        });
        sendJson(res, 200, {
          ok: true,
          scheduleId: record?.id ?? null,
          rev: await store.rev(),
        });
        return;
      }

      // 直接发送：把便签内容立刻投递到目标会话。
      if (method === 'POST' && path === `${API_PREFIX}/insert`) {
        const body = await readJsonBody(req);
        const sessionId = String(body.sessionId ?? '');
        const text = String(body.text ?? '');
        const insertNoteId = typeof body.noteId === 'string' ? body.noteId : '';
        if (!sessionId || !text) {
          sendJson(res, 400, { ok: false, error: '缺少 sessionId 或 text', code: 'missingSessionText' });
          return;
        }

        const attempts = [];
        const safeKeys = (value) => {
          try {
            return Object.keys(value).slice(0, 14).join(',');
          } catch (error) {
            return '读不到';
          }
        };
        const svc = (name) => {
          try {
            if (!hostCtx) {
              attempts.push('宿主上下文不可用');
              return null;
            }
            return typeof hostCtx.get === 'function' ? hostCtx.get(name) : hostCtx[name];
          } catch (error) {
            attempts.push(name + ' 取不到:' + (error?.message ?? String(error)));
            return null;
          }
        };

        const sessionsSvc = svc('sessions');
        const conversationSvc = svc('conversation');

        // 候选 1：sessions.scope(id) → conversation.input.for(actx).setDraft
        try {
          const actx = sessionsSvc?.scope?.(sessionId);
          if (!actx) {
            attempts.push('sessions.scope() 无返回');
          } else {
            const input = conversationSvc?.input?.for?.(actx);
            if (input && typeof input.setDraft === 'function') {
              await input.setDraft(text);
              sendJson(res, 200, { ok: true, via: 'sessions.scope + conversation.input.setDraft' });
              return;
            }
            attempts.push('conversation.input.for(actx).setDraft 不可用');
            attempts.push(conversationSvc
              ? 'conversation keys=' + safeKeys(conversationSvc)
              : 'ctx.get(conversation) 为空');
          }
        } catch (error) {
          attempts.push('候选1 抛错:' + (error?.message ?? String(error)));
        }

        // 候选 2：actx 自己带 conversation
        try {
          const actx = sessionsSvc?.scope?.(sessionId);
          const inner = actx?.get?.('conversation');
          const input2 = inner?.input?.for?.(actx);
          if (input2 && typeof input2.setDraft === 'function') {
            await input2.setDraft(text);
            sendJson(res, 200, { ok: true, via: 'actx.conversation.input.setDraft' });
            return;
          }
          attempts.push('actx 路径不可用');
        } catch (error) {
          attempts.push('候选2 抛错:' + (error?.message ?? String(error)));
        }

        // 候选 3：不指定会话，直接写当前会话 draft（最后兜底）
        try {
          const input3 = conversationSvc?.input;
          if (input3 && typeof input3.setDraft === 'function') {
            await input3.setDraft(text);
            sendJson(res, 200, { ok: true, via: 'conversation.input.setDraft（当前会话）', warning: '未能定位目标会话，已写入当前会话' });
            return;
          }
          attempts.push('conversation.input.setDraft 不存在');
        } catch (error) {
          attempts.push('候选3 抛错:' + (error?.message ?? String(error)));
        }

        // host 侧没有 draft 写入能力（conversation 是前端 UI 状态，宿主无此服务），
        // 退而求其次：用内核调度通道做一次「5 秒后投递」，把内容真正送到目标会话。
        const scheduler = typeof options.getScheduler === 'function' ? options.getScheduler() : null;
        if (scheduler && typeof scheduler.create === 'function') {
          try {
            // 尽量短：给调度器留 1.5s 余量，避免创建瞬间就过期
            const at = new Date(Date.now() + 1500);
            await scheduler.create({
              title: '便签投递',
              prompt: text,
              timing: { kind: 'at', at: at.toISOString() },
              target: { kind: 'session', sessionId },
            });
            // 投递已排进内核：把状态写回便签，卡片变灰并显示实际发送时间。
            // 立即发送的 at 就是「此时此刻 + 1.5s」，所以这里直接记预期送达时间。
            if (insertNoteId) {
              try {
                await store.updateNote(insertNoteId, {
                  delivery: {
                    sessionId,
                    sessionTitle: String(body.sessionTitle ?? ''),
                    at: Math.round(at.getTime()),
                    scheduleId: '',
                  },
                });
              } catch (writeError) {
                // 回写失败不能让「已经发出去」变成 500，只记一笔。
                try {
                  process.stderr.write(
                    `[dsh-notewall] delivery write-back failed: ${String(writeError?.message ?? writeError)}\n`,
                  );
                } catch {
                  /* stderr closed */
                }
              }
            }
            sendJson(res, 200, {
              ok: true,
              via: 'scheduled',
              fallback: true,
              deliveredAt: Math.round(at.getTime()),
              hint: '宿主不提供输入框直写，已改为约 2 秒后投递到该会话',
            });
            return;
          } catch (error) {
            attempts.push('调度兜底失败:' + (error?.message ?? String(error)));
          }
        } else {
          attempts.push('调度器不可用');
        }

        if (sessionsSvc) attempts.push('sessions keys=' + safeKeys(sessionsSvc));
        sendJson(res, 501, { ok: false, error: '直接发送暂不可用：' + attempts.join(' ｜ ') });
        return;
      }

      // 取消已预约的投递：清掉便签上的标记。reminder 本身由内核 schedule 持有，
      // 这里尽力删除；删不掉也不阻塞，用户仍可在 DSH 的任务页取消。
      if (method === 'POST' && path === `${API_PREFIX}/deliver/cancel`) {
        const body = await readJsonBody(req);
        const noteId = String(body.noteId ?? '');
        if (!noteId) {
          sendJson(res, 400, { ok: false, error: '缺少便签 id', code: 'missingNoteId' });
          return;
        }
        const note = (await store.snapshot()).notes.find((item) => item.id === noteId) ?? null;
        const scheduleId = note?.delivery?.scheduleId ?? '';
        const cancelSessionId = note?.delivery?.sessionId ?? '';
        const scheduler = typeof options.getScheduler === 'function' ? options.getScheduler() : null;
        let removed = false;
        if (scheduleId && scheduler) {
          for (const verb of ['delete', 'remove', 'cancel']) {
            if (typeof scheduler[verb] === 'function') {
              try {
                // 内核签名是 delete(request, signal)，request 必须是 { id, sessionId }。
                // 传字符串时 request.id 为 undefined，内核**不抛错**而是返回
                // { deleted: false, code: 'schedule_not_found' } —— 所以必须看返回值，
                // 不能只看有没有抛异常（上一版就是这么假报成功的）。
                const result = await scheduler[verb]({ id: scheduleId, sessionId: cancelSessionId });
                removed = Boolean(
                  result && (result.deleted === true || result.removed === true || result.ok === true),
                );
                if (!removed && result?.code) {
                  process.stderr.write(
                    `[dsh-notewall] cancel returned ${result.code} for ${scheduleId}\n`,
                  );
                }
              } catch (error) {
                process.stderr.write(
                  `[dsh-notewall] cancel threw: ${String(error?.message ?? error)}\n`,
                );
              }
              break;
            }
          }
        }
        await store.updateNote(noteId, { delivery: null });
        sendJson(res, 200, { ok: true, removed, rev: await store.rev() });
        return;
      }

      sendJson(res, 404, { ok: false, error: 'not found' });
    } catch (error) {
      sendJson(res, 500, { ok: false, error: String(error?.message ?? error) });
      try {
        process.stderr.write(`[dsh-notewall] ${String(error?.stack ?? error)}\n`);
      } catch {
        // stderr may already be closed during shutdown.
      }
    }
  };
}

/** Render a canonical tool value as JSON text. */
const renderJson = (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }];

const OBJECT_SCHEMA = { type: 'object', additionalProperties: true };

/** ISO-like local string for tool output, null-safe. */
function formatTime(ms) {
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

/**
 * Model-facing tools. Creating a note is a user-visible side effect on their
 * personal wall, so the descriptions demand an explicit agreement first.
 *
 * @param {ReturnType<typeof createStore>} store
 */
export function createTools(store) {
  return [
    {
      name: 'sticky_note_create',
      description:
        '在便签墙上新建一张便签。**必须先征得用户明确同意**（例如用户说“好，记一下”“帮我记到便签上”），不要在没问过用户的情况下自行创建。'
        + '内容支持纯文本（text）或受限 HTML（html）；可指定便签底色、文字颜色，以及一个提醒时间 alarm_at（ISO 8601 字符串或毫秒时间戳）。'
        + '返回创建成功的便签 id 与创建时间。',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: '便签正文；纯文本，换行会被保留。与 html 二选一。' },
          html: { type: 'string', description: '便签正文的富文本 HTML；与 text 二选一，优先级更高。' },
          color: { type: 'string', description: '便签底色，如 #fff3a3。' },
          text_color: { type: 'string', description: '文字颜色，如 #1f2430。' },
          alarm_at: {
            oneOf: [{ type: 'string' }, { type: 'number' }],
            description: '提醒时间：ISO 8601 字符串（如 2026-11-03T20:00:00+08:00）或毫秒时间戳。',
          },
          pinned: { type: 'boolean', description: '是否置顶。' },
        },
        additionalProperties: false,
      },
      output: { schema: OBJECT_SCHEMA, render: renderJson },
      async execute(args = {}) {
        const alarmAt = normalizeAlarm(args.alarm_at);
        const note = await store.createNote({
          html: args.html,
          text: args.text ?? '（空便签）',
          color: args.color,
          textColor: args.text_color,
          alarmAt,
          pinned: args.pinned === true,
          createdBy: 'agent',
        });
        return {
          ok: true,
          id: note?.id ?? null,
          createdAt: formatTime(note?.createdAt),
          alarmAt: formatTime(note?.alarmAt),
          noteCount: (await store.snapshot()).notes.length,
        };
      },
    },
    {
      name: 'sticky_note_list',
      description:
        '列出便签墙上的全部便签（按显示顺序：置顶优先，然后按手动顺序/创建时间）。只读；用于在会话里回答“我的便签上都有什么”或确认某条便签是否存在。',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: '最多返回多少条，默认 50。' },
          include_html: { type: 'boolean', description: '是否返回富文本 HTML（默认 false，只返回纯文本摘要）。' },
        },
        additionalProperties: false,
      },
      output: { schema: OBJECT_SCHEMA, render: renderJson },
      async execute(args = {}) {
        const doc = await store.snapshot();
        const limit = Math.min(200, Math.max(1, Math.round(Number(args.limit) || 50)));
        return {
          ok: true,
          rev: doc.rev,
          total: doc.notes.length,
          notes: doc.notes.slice(0, limit).map((note) => ({
            id: note.id,
            title: note.title,
            createdBy: note.createdBy,
            pinned: note.pinned,
            createdAt: formatTime(note.createdAt),
            updatedAt: formatTime(note.updatedAt),
            alarmAt: formatTime(note.alarmAt),
            plain: stripTags(note.html).slice(0, 400),
            ...(args.include_html === true ? { html: note.html } : {}),
          })),
        };
      },
    },
    {
      name: 'sticky_note_update',
      description:
        '修改一张已有便签：正文、颜色、置顶、提醒时间。只传要改的字段；`clear_alarm: true` 可清除提醒。'
        + '修改用户的便签同样是可见副作用，用户没同意时不要改。返回是否命中。',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: '便签 id（形如 n_xxxx，可用 sticky_note_list 查）。' },
          text: { type: 'string', description: '新的纯文本正文。' },
          html: { type: 'string', description: '新的富文本正文（优先级高于 text）。' },
          color: { type: 'string', description: '新的便签底色。' },
          text_color: { type: 'string', description: '新的文字颜色。' },
          pinned: { type: 'boolean', description: '是否置顶。' },
          alarm_at: {
            oneOf: [{ type: 'string' }, { type: 'number' }],
            description: '新的提醒时间（ISO 8601 或毫秒时间戳）。',
          },
          clear_alarm: { type: 'boolean', description: 'true 时清除提醒时间。' },
        },
        required: ['id'],
        additionalProperties: false,
      },
      output: { schema: OBJECT_SCHEMA, render: renderJson },
      async execute(args = {}) {
        const id = String(args.id ?? '');
        const before = (await store.snapshot()).notes.find((note) => note.id === id);
        if (!before) return { ok: false, error: '便签不存在', id };
        const patch = {};
        if (args.html != null) patch.html = args.html;
        else if (args.text != null) patch.html = (await import('./store.js')).escapeToHtml(args.text);
        if (args.color != null) patch.color = args.color;
        if (args.text_color != null) patch.textColor = args.text_color;
        if (args.pinned != null) patch.pinned = args.pinned === true;
        if (args.clear_alarm === true) patch.alarmAt = null;
        else if (args.alarm_at != null) patch.alarmAt = normalizeAlarm(args.alarm_at);
        await store.updateNote(id, patch);
        return { ok: true, id, rev: await store.rev() };
      },
    },
    {
      name: 'sticky_note_delete',
      description: '删除一张便签。**必须先征得用户明确同意**——这是不可撤销的删除操作。返回是否命中。',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string', description: '要删除的便签 id。' } },
        required: ['id'],
        additionalProperties: false,
      },
      output: { schema: OBJECT_SCHEMA, render: renderJson },
      async execute(args = {}) {
        const id = String(args.id ?? '');
        const exists = (await store.snapshot()).notes.some((note) => note.id === id);
        if (!exists) return { ok: false, error: '便签不存在', id };
        await store.deleteNote(id);
        return { ok: true, id, rev: await store.rev() };
      },
    },
  ];
}

/** Accept ISO strings, numeric strings and epoch millis; reject the past. */
export function normalizeAlarm(value) {
  if (value == null || value === '') return null;
  let ms = NaN;
  if (typeof value === 'number') ms = value;
  else if (/^\d+$/.test(String(value).trim())) ms = Number(value);
  else ms = Date.parse(String(value));
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return ms;
}

/** Strip tags for tool-facing plain text. */
function stripTags(html) {
  return String(html ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {unknown} config
 */
export function apply(ctx, config) {
  traceBoot({ type: 'plugin-apply' });
  const cfg = config && typeof config === 'object' ? config : {};
  const root = typeof cfg.dataDir === 'string' && cfg.dataDir
    ? cfg.dataDir
    : resolveDataRoot();
  const store = createStore({ root });

  // Surface the data directory once so operators can back it up.
  try {
    process.stderr.write(`[dsh-notewall] data root: ${root}\n`);
  } catch {
    // ignore
  }

  // 【2026-11-03 诊断】__selflog：确认宿主从哪个目录加载、同目录 client.js 是否存在。
  // 浏览器半由 client-modules 扫描包元数据后提供，若解析基准与这里不同，
  // 就会出现「宿主半正常、客户端半拿不到 bundle」的错配。
  try {
    const __selfUrl = import.meta.url;
    // URL.pathname yields "/C:/..." on Windows, which existsSync cannot open.
    // fileURLToPath does the platform conversion.
    const __dir = (() => {
      try {
        return fileURLToPath(new URL('.', import.meta.url));
      } catch {
        return new URL('.', import.meta.url).pathname;
      }
    })();
    const __clientPath = join(__dir, 'client.js');
    process.stderr.write(
      `[dsh-notewall] __selflog self=${__selfUrl} dir=${__dir} clientExists=${existsSync(__clientPath)}\n`,
    );
  } catch {
    // ignore
  }

  for (const tool of createTools(store)) {
    ctx.effect(() => ctx.tools.register(tool), `sticky-wall.tool.${tool.name}`);
  }

  // 定时投递所需的内核服务。它属于「可选增强」：minimal 一类的 profile 不挂
  // dsh-schedule，此时只降级「定时发送」这一条路径，便签墙其余功能照常。
  let scheduler = null;
  ctx.inject(['schedule'], (scheduleCtx) => {
    scheduler = scheduleCtx.schedule ?? null;
    scheduleCtx.effect(() => () => {
      scheduler = null;
    }, 'sticky-wall.schedule-detach');
  });

  // Non-Web surfaces (tui/headless) keep loading: routes are additive.
  ctx.inject(['webServer'], (webCtx) => {
    const handler = createHandler(store, {
      allowLocalOnly: cfg.localOnly !== false,
      getScheduler: () => scheduler,
      ctx,
      // 信任栅栏服务。用 get 惰性取而不是写进 ctx.inject 依赖：connection 是宿主
      // 核心服务，正常情况下一定在；万一某个裁剪过的组合没有它，我们退化成
      // 「不设栅栏」的旧行为，而不是因为依赖缺失连路由都不注册（那样插件会整个消失）。
      getConnection: () => {
        try {
          return webCtx.get('connection') ?? null;
        } catch {
          return null;
        }
      },
    });
    webCtx.effect(
      () => webCtx.webServer.register({ kind: 'prefix', path: API_PREFIX, handler }),
      'sticky-wall.routes',
    );
  });

  // Make sure the media directory exists before the first request.
  ctx.effect(() => {
    void mkdir(store.mediaDir, { recursive: true }).catch(() => {});
  }, 'sticky-wall.ensure-dirs');
}

export default { name, inject, apply };
