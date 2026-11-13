/**
 * 便签墙 — 浏览器入口。
 *
 * 注册三处：
 *   main                 全局面板（便签墙本体）
 *   sidebar.panellist    左侧栏入口图标（工作区列表上方那一排）
 *   shell.overlay        右下角提醒弹框（跨面板常驻，所以闹钟在别的页面也能弹）
 *
 * 数据只走 lib/index.js 注册的 `/sticky-wall` 路由：这里有一个模块级
 * store 负责轮询 `rev` 增量，两个 slot 共用它，不会各自发起请求。
 *
 * @module dsh-notewall/client
 */

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { describeNote, normalizeSessionList, noteToText } from './session-bridge.js';
import { t } from './strings.js';
import { QuickDraftButton } from './quick-draft.js';
import { api, readFileAsDataUrl } from './api';
import { injectStyles } from './theme';
import { StickyWall } from './wall';
import { formatAlarm } from './card';

/** 面板 id：sidebar.panellist 与 main 共用同一个 key。 */
export const PANEL_ID = 'sticky-wall';
/** 面板在左侧栏的排序（比「自动化任务」的 10 稍后）。 */
const PANEL_ORDER = 12;
/** 增量轮询间隔（毫秒）。 */
const POLL_MS = 2500;

/* ------------------------------------------------------------------ store */

/** 共享只读快照 + 变更广播。 */
const state = {
  doc: { notes: [], wall: null },
  palette: [],
  rev: -1,
  status: '',
  ready: false,
  /** 待打开的便签 id（提醒弹框点「查看」时写入）。 */
  focusNoteId: null,
  /** 已展示、未确认的提醒，避免轮询重复弹。 */
  toasts: [],
};

const listeners = new Set();

function emit() {
  for (const listener of listeners) listener();
}

/** 订阅 store 变化；返回退订函数。 */
function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 组件侧的 useStore：任何字段变化都会重渲染。 */
function useStore() {
  const [, force] = useReducer((n) => n + 1, 0);
  useEffect(() => subscribe(force), []);
  return state;
}

let pollTimer = null;
let inFlight = false;

/** 把一份完整文档并入 store，并检查到点的提醒。 */
function applyDoc(doc) {
  state.doc = doc;
  state.rev = doc.rev;
  state.ready = true;
  checkAlarms(doc.notes);
}

/** 检查哪些便签的提醒到点了。 */
function checkAlarms(notes) {
  const now = Date.now();
  const shown = new Set(state.toasts.map((toast) => toast.id));
  for (const note of notes ?? []) {
    if (!note.alarmAt || note.alarmFiredAt) continue;
    if (note.alarmAt > now) continue;
    if (shown.has(note.id)) continue;
    state.toasts.push({
      id: note.id,
      title: note.title || t('card.emptyNote'),
      text: plainText(note.html).slice(0, 200),
      at: note.alarmAt,
    });
  }
}

/** 富文本转纯文本，供提醒弹框展示。 */
function plainText(html) {
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
 * 拉一次状态。`since` 有值时是增量请求。
 * @param {{force?: boolean}} [options]
 */
async function pull(options = {}) {
  if (inFlight) return;
  if (typeof document !== 'undefined' && document.hidden && !options.force) return;
  inFlight = true;
  try {
    const useSince = !options.force && !options.summary;
    const payload = await api.state(useSince ? state.rev : undefined, { summary: options.summary });
    if (payload?.palette) state.palette = payload.palette;
    if (payload?.changed === false) {
      // 没有变化，只清错误提示
      if (state.status) {
        state.status = '';
        emit();
      }
      return;
    }
    if (payload?.doc) applyDoc(payload.doc);
    else if (payload?.changed && payload?.notes) applyDoc(payload);
    if (state.status) state.status = '';
    if (!bootDataReported && payload?.doc) {
      bootDataReported = true;
      bootReport('first-data', { notes: (payload.doc.notes || []).length, summary: !!payload.summary });
    }
    emit();
  } catch (error) {
    state.status = t('error.connectFailed', { message: error?.message ?? error });
    emit();
  } finally {
    inFlight = false;
  }
}

/** 启动轮询（幂等）。 */
function startPolling() {
  if (pollTimer != null) return;
  // 首屏两段式：先只拉卡片摘要（不含 html，体积小一个数量级）把便签立刻铺出来，
  // 紧接着再拉一次全量把正文补上。用户看到的是「马上有卡片」而不是等所有正文
  // 下载完才出现内容 —— 便签里塞了图片时差别尤其明显。
  void (async () => {
    await pull({ force: true, summary: true });
    await pull({ force: true });
  })();
  pollTimer = setInterval(() => void pull(), POLL_MS);
}

/** 停止轮询。 */
function stopPolling() {
  if (pollTimer == null) return;
  clearInterval(pollTimer);
  pollTimer = null;
}

/** 写操作后立刻刷新一次，避免等下一轮轮询。 */
/**
 * 插件 ctx（applyImpl 里拿到的那个）。
 *
 * 会话列表要靠它——宿主没有提供 /api/sessions 这类 REST 路由，
 * 会话是通过连接层的服务对象暴露给插件的。
 */
let pluginCtx = null;

async function refreshNow() {
  await pull({ force: true });
  emit();
}

/* ------------------------------------------------------------ 操作封装 */

const actions = {
  async create(patch) {
    // 没指定颜色时自动挑一个：与现有便签不撞色，且按莫兰迪优先的协调顺序。
    // 用户从色板显式选色（patch.color 存在）时完全尊重用户选择。
    const notes = state.doc?.notes ?? [];
    const auto = patch?.color ? null : resolveNewNoteColor(notes, state.doc?.wall);
    const payload = auto ? { ...patch, color: auto.color } : patch;
    const result = await api.note({ op: 'create', ...payload });
    await refreshNow();
    return result?.note ?? null;
  },

  async update(id, patch) {
    // 本地先乐观改一版，编辑器里的颜色/文字不回跳
    const note = state.doc?.notes?.find((candidate) => candidate.id === id);
    if (note) {
      if (patch.html != null) note.html = patch.html;
      if (patch.color != null) note.color = patch.color;
      if (patch.textColor != null) note.textColor = patch.textColor;
      if (patch.alarmAt !== undefined) note.alarmAt = patch.alarmAt;
      if (patch.pinned != null) note.pinned = patch.pinned;
      emit();
    }
    await api.note({ op: 'update', id, ...patch });
    await refreshNow();
  },

  async remove(note) {
    await api.note({ op: 'delete', id: note.id });
    state.toasts = state.toasts.filter((toast) => toast.id !== note.id);
    await refreshNow();
  },

  async reorder(ids) {
    const list = Array.isArray(ids) ? ids.filter((id) => typeof id === 'string') : [];
    if (list.length === 0) return;
    // 乐观更新：松手瞬间先按新顺序重排本地数据并渲染，不等网络往返。
    // 排序规则必须和 host 的 sortedNotes 一致（置顶优先 → 手动 order），
    // 否则请求回来后会出现「先变过去、又跳一下」。
    const prev = state.doc?.notes;
    if (state.doc && Array.isArray(prev)) {
      const rank = new Map(list.map((id, index) => [id, index]));
      state.doc.notes = prev.slice().sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        const ra = rank.has(a.id) ? rank.get(a.id) : Number.MAX_SAFE_INTEGER;
        const rb = rank.has(b.id) ? rank.get(b.id) : Number.MAX_SAFE_INTEGER;
        return ra - rb;
      });
      emit();
    }
    try {
      await api.note({ op: 'reorder', ids });
    } catch (err) {
      // 请求失败就回滚到操作前的顺序，避免界面与落盘数据不一致
      if (state.doc && Array.isArray(prev)) {
        state.doc.notes = prev;
        emit();
      }
      throw err;
    }
    await refreshNow();
  },

  async updateWall(patch) {
    if (state.doc?.wall) state.doc.wall = { ...state.doc.wall, ...patch };
    emit();
    await api.wall(patch);
    await refreshNow();
  },

  /**
   * 拉宿主会话列表，按工作区分组。
   *
   * 数据源：ctx.sessions.manager.summaries（会话摘要数组）。
   * 摘要对象没有公开的字段定义，所以用启发式深挖：递归找名字像
   * title/name/summary 的字符串当标题，像 workspace/cwd/path 的当工作区。
   * 都挖不到时退回会话 id，至少不会一片「未命名」。
   */
  async listSessions() {
    const svc = pluginCtx?.get?.('sessions') ?? pluginCtx?.sessions ?? null;
    if (!svc) throw new Error(t('error.noSessionsService'));

    const summaries = svc.manager?.summaries;
    if (!Array.isArray(summaries) || summaries.length === 0) {
      const phase = svc.manager?.listPhase;
      const listError = svc.manager?.listError;
      return { groups: [], debug: 'phase=' + String(phase) + ' error=' + String(listError ? '有' : '无') };
    }

    // 递归按字段名模式找第一个非空字符串（最多下探 3 层）
    const deepFind = (value, pattern, depth) => {
      if (!value || typeof value !== 'object' || depth < 0) return '';
      for (const key of Object.keys(value)) {
        const child = value[key];
        if (pattern.test(key) && typeof child === 'string' && child.trim()) return child.trim();
      }
      for (const key of Object.keys(value)) {
        const child = value[key];
        if (child && typeof child === 'object') {
          const got = deepFind(child, pattern, depth - 1);
          if (got) return got;
        }
      }
      return '';
    };

    const titleStrict = /^(title|displayName|label|summary|preview|topic|heading|name)$/i;
    const titleLoose = /title|displayName|summary|preview/i;
    const wsStrict = /^(workspace|workspaceName|projectName|projectPath|cwd|root|dir)$/i;
    const wsLoose = /workspace|project|cwd|directory/i;

    const buckets = new Map();
    let sampleKeys = '';
    for (const raw of summaries) {
      if (!raw || typeof raw !== 'object') continue;
      if (!sampleKeys) sampleKeys = Object.keys(raw).slice(0, 12).join(',');

      const id = String(raw.sessionId ?? raw.id ?? raw.session_id ?? '');
      if (!id) continue;

      // 子代理会话是临时的，不该出现在「发送到会话」的候选里
      const parentRef =
        deepFind(raw, /^(parentSessionId|parentId|parent)$/i, 2) ||
        deepFind(raw, /subagent|spawnedBy|parentSession/i, 2);
      if (parentRef) continue;

      let title = deepFind(raw, titleStrict, 3) || deepFind(raw, titleLoose, 3);
      const workspace = deepFind(raw, wsStrict, 3) || deepFind(raw, wsLoose, 3) || t('workspace.ungrouped');
      let updatedAt =
        Number(raw.updatedAt ?? raw.lastActiveAt ?? raw.updated_at ?? raw.createdAt ?? 0) || 0;
      if (!updatedAt) {
        const rawTime = deepFind(raw, /updatedAt|lastActiveAt|lastMessageAt|modifiedAt/i, 3);
        const parsed = rawTime ? Number(rawTime) : NaN;
        if (Number.isFinite(parsed)) updatedAt = parsed;
      }

      // 挖不到标题 = 没有实质内容的会话（空壳），GUI 也不显示它
      if (!title) continue;
      if (title.length > 56) title = title.slice(0, 56) + '…';

      const key = workspace.slice(0, 80);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push({ id, title, updatedAt });
    }

    const flat = [];
    for (const entry of buckets) {
      for (const item of entry[1]) flat.push(Object.assign({}, item, { workspace: entry[0] }));
    }
    flat.sort(function (a, b) { return b.updatedAt - a.updatedAt; });
    return flat;
  },

  /**
   * 直接发送：把便签内容立刻投递到该会话。
   *
   * 需要宿主的跨会话 draft 通道，正在接；先给明确提示而不是静默失败。
   */
  /**
   * 清掉便签上的定时发送标记（打开编辑页时调用，等于重置回未设置状态）。
   * 定时任务若还没触发，顺带在宿主侧取消；已触发过的取消失败也无所谓。
   */
  async clearDelivery(noteId) {
    if (!noteId) return;
    try {
      await api.cancelDeliver({ noteId });
    } catch {
      // 定时已经执行完 / 记录不存在，忽略即可。
    }
    await refreshNow();
  },

  async insertToSession(payload) {
    const note = payload?.note ?? null;
    const session = payload?.session ?? null;
    if (!session?.id) throw new Error(t('deliver.needSession'));
    const text = noteToText(note?.html ?? '');
    if (!String(text).trim()) throw new Error(t('error.emptyNote'));
    // noteId 让宿主在投递成功后把 delivery 写回便签，卡片才能变灰并显示实际发送时间。
    const result = await api.insert({ sessionId: session.id, text, noteId: note?.id ?? null });
    if (!result?.ok) throw new Error(result?.error ?? t('error.sendFailed'));
    await refreshNow();
    return result;
  },

  /** 定时发送：交给内核 dsh-schedule，宿主重启也不丢。 */
  async scheduleToSession({ note, session, at }) {
    await api.deliver({
      noteId: note.id,
      sessionId: session.id,
      sessionTitle: session.title || '',
      at,
      prompt: describeNote(note, { mode: 'schedule', at }),
      title: t('note.toastTitle', { title: note.title || t('prompt.noTitle') }),
    });
    await refreshNow();
  },

  async upload(dataUrl) {
    const saved = await api.media(dataUrl);
    return { url: saved.url, id: saved.id };
  },

  /** 弹框「关闭」：标记已提醒并移除。 */
  async dismissAlarm(id) {
    state.toasts = state.toasts.filter((toast) => toast.id !== id);
    emit();
    try {
      await api.ackAlarm(id);
      await refreshNow();
    } catch {
      // 提醒确认失败不影响本地隐藏
    }
  },

  /** 弹框「查看便签」：切到面板并打开该便签。 */
  openNote(id, ctx) {
    state.toasts = state.toasts.filter((toast) => toast.id !== id);
    state.focusNoteId = id;
    emit();
    try {
      ctx?.layout?.selectPanel?.(PANEL_ID);
    } catch {
      // 布局服务不可用时至少把焦点留在 pendingFocus
    }
    void api.ackAlarm(id).catch(() => {});
  },
};

/* ------------------------------------------------------------- 组件：页面 */

function StickyWallPage() {
  const store = useStore();
  const [focusHandled, setFocusHandled] = useState(null);

  useEffect(() => {
    startPolling();
    return () => {
      // 面板卸载不停止轮询：提醒弹框还要用（真正的清理在面板卸载时也没问题，
      // 这里保持常驻，代价是每 2.5s 一个很小的 GET）。
    };
  }, []);

  // 提醒弹框点了「查看便签」→ 页面收到 focusNoteId 后清除标记。
  // 真正的打开动作由 wall 内部处理；这里通过 key 触发一次重渲染即可。
  useEffect(() => {
    if (!store.focusNoteId) return;
    if (focusHandled === store.focusNoteId) return;
    setFocusHandled(store.focusNoteId);
  }, [store.focusNoteId, focusHandled]);

  const uploadImage = useCallback(async (dataUrl) => actions.upload(dataUrl), []);

  return (
    <StickyWall
      doc={store.doc}
      palette={store.palette}
      status={store.status}
      uploadImage={uploadImage}
      onCreate={actions.create}
      onUpdate={actions.update}
      onDelete={actions.remove}
      onReorder={actions.reorder}
      onUpdateWall={actions.updateWall}
      listSessions={actions.listSessions}
      onInsertToSession={actions.insertToSession}
      onScheduleToSession={actions.scheduleToSession}
      onClearDelivery={actions.clearDelivery}
      focusNoteId={store.focusNoteId}
    />
  );
}

/* --------------------------------------------------------- 组件：提醒弹框 */

function AlarmDock(props) {
  const store = useStore();
  const ctx = props?.__ctx ?? null;
  const toasts = store.toasts;

  useEffect(() => {
    startPolling();
  }, []);

  if (!toasts.length) return null;

  return (
    <div className="sw-toasts">
      {toasts.map((toast) => (
        <div className="sw-toast" key={toast.id} role="alert">
          <div className="sw-toast-title">⏰ {t('note.toastTitle', { title: formatAlarm(toast.at) })}</div>
          <div className="sw-toast-text">{toast.title}{toast.text ? `\n${toast.text}` : ''}</div>
          <div className="sw-toast-actions">
            <button type="button" className="sw-btn ghost" onClick={() => void actions.dismissAlarm(toast.id)}>
              {t('common.close')}
            </button>
            <button type="button" className="sw-btn primary" onClick={() => actions.openNote(toast.id, ctx)}>
              {t('note.viewNote')}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ 组件：图标 */

function StickyWallIcon({ size = 18, active = false }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ opacity: active ? 1 : 0.86 }}
    >
      <path
        d="M5 4.5h10.5L20 9v10.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M15.5 4.5V9H20" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M7.5 12.5h9M7.5 16h5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ apply */

/**
 * 浏览器半边入口。DSH 的 client loader 会把模块导出当插件体调用一次。
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx 客户端上下文
 */
/**
 * 浏览器半声明依赖的客户端服务。
 *
 * 必须声明：cordis 只有在 inject 里列出 slots，才会等该服务就绪再调用 apply。
 * 缺这一行时 apply 会在 slots 尚未 provide 的时机执行，ctx.slots 取不到 →
 * 抛错 → fiber 进入 FAILED → DSH web boot 判定「entry did not activate」整页挂死。
 * 与官方模板 templates/decoration/client.js 的 `inject: ['slots']` 一致。
 */
export const inject = ['slots'];

/**
 * 宿主侧的自检通道：客户端异常写进 `<dataRoot>/client-diag.log`。
 *
 * 为什么要上报：client 端异常只存在于浏览器控制台，host 的 kernel.log 永远
 * 看不到；而内嵌浏览器（极空间 App 一类）根本没有 DevTools。兜底路径若不上
 * 报，事后就完全无从取证。
 *
 * 这个函数自己绝不能抛错——它已经在故障路径上。
 *
 * @param {string} where 出错位置（apply / slot:xxx / …）
 * @param {unknown} error 捕获到的异常
 */
function reportClientError(where, error) {
  try {
    const text = String(error?.stack ?? error?.message ?? error ?? 'unknown').slice(0, 4000);
    if (typeof console !== 'undefined' && console.error) {
      console.error(`[dsh-notewall] ${where} failed:`, error);
    }
    if (typeof fetch === 'function') {
      const url = `/sticky-wall/__diag?where=${encodeURIComponent(where)}&msg=${encodeURIComponent(text)}`;
      void fetch(url, { method: 'GET', cache: 'no-store' }).catch(() => {});
    }
  } catch {
    // 兜底路径不得再抛
  }
}

/**
 * 单个 slot 注册的兜底包装。
 *
 * 三处 slot 互相独立：某一个面板注册失败时，其余面板仍应可用，不能因为
 * 一个坏面板让整面墙不出现。
 *
 * @param {string} label 诊断用的位置名
 * @param {() => unknown} register 注册动作
 */
function safeSlot(label, register) {
  try {
    return register();
  } catch (error) {
    reportClientError(`slot:${label}`, error);
    return () => {};
  }
}

/**
 * 真正的注册逻辑。
 */
// boot-probe: 「打开页面 → 看到卡片」的分段耗时。
// 用 performance.now()（相对 navigationStart），失败静默。
function bootNow() {
  try { return Math.round((globalThis.performance?.now?.() ?? 0) * 10) / 10; } catch (err) { return 0; }
}
let bootDataReported = false;
function bootReport(phase, extra) {
  try {
    void api.traceBoot({ phase, t: bootNow(), ...(extra || {}) }).catch(() => {});
  } catch (err) {
    /* 诊断失败：静默 */
  }
}

function applyImpl(ctx) {
  pluginCtx = ctx;
  bootReport('client-apply');
  injectStyles();

  // 主面板：点击左侧栏图标后占据中间区域。
  safeSlot('main', () =>
    ctx.slots.inject('main', () =>
      ctx.slots.register({ name: 'main', key: PANEL_ID }, StickyWallPage),
    ),
  );

  // 左侧栏入口：与「插件 / 自动化任务 / 上下文洞察」同一排。
  safeSlot('sidebar.panellist', () =>
    ctx.slots.inject('sidebar.panellist', () =>
      ctx.slots.register(
        { name: 'sidebar.panellist', id: PANEL_ID, order: PANEL_ORDER, label: () => t('wall.title') },
        StickyWallIcon,
      ),
    ),
  );

  // 会话头部草稿按钮：挂在会话标题栏右侧工具区，点开就是内核右栏里的草稿 tab。
  // 走 ctx.sidebarRight.openTab 而不是自绘浮层 —— 只有真占进右栏，正文才会被推挤让位。
  // openTab/服务不可用时抛错，按钮组件自己 catch 掉并退回自绘抽屉。
  safeSlot('header.quick-draft', () =>
    ctx.slots.inject('conversation.session.header.utilities', () =>
      ctx.slots.register(
        {
          name: 'conversation.session.header.utilities',
          id: 'sticky-wall-draft',
          order: -5,
        },
        QuickDraftButton,
      ),
    ),
  );

  // 右下角提醒弹框：挂在 frame 级浮层，跨面板常驻。
  safeSlot('shell.overlay', () =>
    ctx.slots.inject('shell.overlay', () =>
      ctx.slots.register(
        { name: 'shell.overlay', id: 'sticky-wall-alarm', order: 40, inject: () => ({ __ctx: ctx }) },
        AlarmDock,
      ),
    ),
  );

  // 页面可见性变化时立刻补一次同步，避免后台期间错过提醒。
  ctx.effect(() => {
    const onVisible = () => {
      if (!document.hidden) void pull({ force: true });
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, 'sticky-wall.visibility');

  ctx.effect(() => () => stopPolling(), 'sticky-wall.polling');
}

/**
 * 导出的插件体。
 *
 * DSH 的 client 启动器注册的是 `module.exports.default`（esbuild 产物里叫
 * `index_default`），而 `default` 必须同时带 `inject` 和 `apply` —— 只写顶层
 * `export const inject` 是**无效**的，启动器根本不看那里。这是本插件 2026-11-03
 * 那次「整台 GUI 只剩 Failed to load plugins」事故的直接原因。
 *
 * 这里再加一道故障保险：apply 里的任何异常都不外抛。cordis 的 fiber 只有在
 * apply 正常返回时才保持 ACTIVE；一旦抛出就进 FAILED，而 DSH 的 boot 审计是
 * 「任一 entry 未激活 → 整页失败」，代价与「一个便签面板坏了」完全不成比例。
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx 客户端上下文
 */
export function apply(ctx) {
  try {
    applyImpl(ctx);
  } catch (error) {
    reportClientError('apply', error);
  }
}

export default { inject, apply };
export { StickyWallPage, AlarmDock, StickyWallIcon };
