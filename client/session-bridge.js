/**
 * 便签墙 — 会话桥接（纯逻辑部分）。
 *
 * 这个模块把「一张便签 → 一段可发给模型的文字」以及「便签投递到会话」的
 * 数据形状固定下来。DOM / DSH ctx 相关的副作用留在调用方（wall.js / index.js），
 * 这里只做纯函数，便于单测。
 *
 * @module dsh-notewall/client/session-bridge
 */
import { stripTags } from './rich';
import { t } from './strings.js';

/**
 * 把便签渲染成发给模型的文本。
 *
 * 用户明确要求：除了便签内容，还要带上便签本身的说明——这是什么时候创建的、
 * 用来做什么的。没有这段上下文，模型只会看到一段孤立文字，无法理解"这是主人
 * 随手记下来的想法"。
 *
 * @param {object} note 便签对象（需要 title / html / createdAt）
 * @param {object} [options]
 * @param {'insert'|'schedule'} [options.mode] 投递方式，影响措辞
 * @param {number} [options.at] 定时发送时间（mode=schedule 时给）
 * @returns {string} 可直接写进输入框/定时提醒的纯文本
 */
export function describeNote(note, options = {}) {
  const title = (note?.title || '').trim() || t('prompt.noTitle');
  const created = formatTimestamp(note?.createdAt);
  const body = noteToText(note?.html);

  const lines = [];
  lines.push(t('prompt.header', { title }));

  if (options.mode === 'schedule' && Number.isFinite(options.at)) {
    lines.push(
      t('prompt.origin', { date: created, time: formatTimestamp(options.at) }),
    );
  } else {
    lines.push(
      t('prompt.originDragged', { date: created }),
    );
  }

  if (body) {
    lines.push('---');
    lines.push(body);
  }
  return lines.join('\n');
}

/**
 * 便签 HTML → 纯文本。
 *
 * 只做「丢标签 + 还原常见实体 + 折叠空行」，不追求完美还原排版：
 * 目的是让模型读到内容，而不是把富文本结构一起塞过去。
 *
 * @param {string} html
 * @returns {string}
 */
export function noteToText(html) {
  if (typeof html !== 'string' || html === '') return '';
  let text = stripTags(html);
  text = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, '&');
  // 行内多余空白收敛，但保留换行
  text = text
    .split('\n')
    .map((line) => line.replace(/[ \t\u00a0]+/g, ' ').trim())
    .join('\n');
  // 连续空行压成一个
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * 时间戳 → 「2026年11月3日 16:30」。
 * @param {unknown} ms
 * @returns {string}
 */
export function formatTimestamp(ms) {
  const value = Number(ms);
  if (!Number.isFinite(value) || value <= 0) return t('time.unknown');
  const date = new Date(value);
  const pad = (n) => String(n).padStart(2, '0');
  return t('time.dateFormat', {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  });
}

/**
 * 从 DSH 的会话列表里挑出可以投递的目标。
 *
 * `ctx.sessions.list()` 的返回结构在不同版本里字段名不完全一致，这里做兼容读取：
 * 优先 id/sessionId，标题优先 title/name/label，时间优先 updatedAt/lastActiveAt。
 *
 * @param {unknown} sessions `ctx.sessions.list()` 的返回值
 * @returns {Array<{id: string, title: string, updatedAt: number}>}
 */
export function normalizeSessionList(sessions) {
  const list = Array.isArray(sessions) ? sessions : [];
  const out = [];
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const id = raw.id ?? raw.sessionId ?? raw.session_id;
    if (typeof id !== 'string' || id === '') continue;
    const title =
      firstString(raw.title, raw.name, raw.label, raw.summary) || t('wall.unnamedSession');
    const updatedAt = firstNumber(raw.updatedAt, raw.lastActiveAt, raw.updated_at, raw.createdAt) ?? 0;
    out.push({ id, title: title.slice(0, 120), updatedAt });
  }
  // 最近活跃的排前面，方便用户直接点第一个
  out.sort((a, b) => b.updatedAt - a.updatedAt);
  return out;
}

/** 便签是否处于「已定时发送」状态。 */
export function isScheduled(note) {
  const delivery = note?.delivery;
  return Boolean(delivery && typeof delivery.sessionId === 'string' && delivery.sessionId !== '');
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
  }
  return '';
}

function firstNumber(...values) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
}
