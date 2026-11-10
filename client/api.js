/**
 * 便签墙 — host API 封装。
 *
 * 浏览器半边从不直接碰文件系统：所有读写都走 host 在 `/sticky-wall`
 * 前缀下注册的路由（见 lib/index.js）。
 *
 * 每个调用都返回 `{ok, ...}` 或抛出带 `message` 的错误，调用方决定怎么
 * 提示用户；这里只做网络与 JSON 两件事。
 *
 * @module dsh-notewall/client/api
 */
import { hasKey, t } from './strings.js';

/** 路由前缀，必须与 lib/index.js 的 API_PREFIX 一致。 */
export const BASE = '/sticky-wall';

/**
 * 发一次 JSON 请求。
 * @param {string} path 相对 BASE 的路径
 * @param {{method?: string, body?: unknown}} [options]
 * @returns {Promise<any>}
 */
async function request(path, options = {}) {
  const method = options.method ?? 'GET';
  const init = { method, headers: {} };
  if (options.body !== undefined) {
    init.headers['content-type'] = 'application/json';
    init.body = JSON.stringify(options.body);
  }
  const response = await fetch(`${BASE}${path}`, init);
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const key = payload && payload.code ? `error.${payload.code}` : null;
    const message = key && hasKey(key)
      ? t(key)
      : payload?.error ?? t('error.requestFailed', { status: response.status });
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return payload ?? {};
}

export const api = {
  /**
   * 拉状态。传 `since` 时是增量：内容没变返回 `{changed:false}`。
   * @param {number} [since] 已知的 rev
   */
  /**
   * @param {number} [since] 已知的 rev
   * @param {{summary?: boolean}} [options] summary=true 只取卡片摘要（不含 html）
   */
  state(since, options = {}) {
    const query = [];
    if (since != null) query.push(`since=${encodeURIComponent(since)}`);
    if (options.summary) query.push('fields=summary');
    return request(query.length ? `/state?${query.join('&')}` : '/state');
  },

  /**
   * 宿主会话列表。
   *
   * 走宿主自己的 /api/sessions（浏览器带登录态，插件可直接取）；
   * 不依赖 ctx.sessions 的内部 API，避免跨版本漂移。
   */
  async sessions() {
    const response = await fetch('/api/sessions', { credentials: 'same-origin' });
    if (!response.ok) throw new Error(t('error.readSessions', { status: response.status }));
    const payload = await response.json();
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.sessions)) return payload.sessions;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
  },

  /** 定时把便签发到某个会话（交给内核 schedule，重启不丢）。 */
  deliver(body) {
    return request('/deliver', { method: 'POST', body });
  },

  /** 取消某张便签的定时发送。 */
  cancelDeliver(body) {
    return request('/deliver/cancel', { method: 'POST', body });
  },

  /** @param {{op: string, [key: string]: unknown}} body */
  /** 启动打点上报（诊断用；失败必须静默，不能影响主流程） */
  traceBoot(payload) {
    return request('/boot-trace', { method: 'POST', body: payload });
  },

  note(body) {
    return request('/note', { method: 'POST', body });
  },

  /** @param {object} patch Wall 字段子集 */
  wall(patch) {
    return request('/wall', { method: 'POST', body: { patch } });
  },

  /**
   * 上传一张图（data URL）。返回 `{url, id, bytes}`。
   * @param {string} dataUrl
   */
  media(dataUrl) {
    return request('/media', { method: 'POST', body: { dataUrl } });
  },

  /** 标记提醒已展示过。 @param {string} id */
  ackAlarm(id) {
    return request('/alarm/ack', { method: 'POST', body: { id } });
  },
  /** 直接发送：把文本立刻投递到目标会话。 */
  async insert(body) {
    return request('/insert', { method: 'POST', body });
  },
};

/** 把媒体 id 还原成可访问 URL（图片就存 `/sticky-wall/media/<id>`）。 */
export function mediaUrl(id) {
  return id ? `${BASE}/media/${encodeURIComponent(id)}` : null;
}

/** 把 File 读成 data URL。 */
export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error(t('error.readFile')));
    reader.readAsDataURL(file);
  });
}
