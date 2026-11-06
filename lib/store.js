/**
 * 便签墙 host-side store.
 *
 * One JSON document, one in-process write queue, atomic replace on commit.
 * Every mutation bumps `rev` so the browser half can poll cheaply
 * (`GET /sticky-wall/state?since=<rev>` → `{ changed: false }`) and still see
 * notes created by the model from a chat session.
 *
 * Layout under the data root (default `$DSH_HOME/sticky-wall`):
 *
 *   data.json            the document below
 *   media/<sha256>.<ext> binary payloads referenced by `<img src>` in note HTML
 *
 * The store is deliberately free of Cordis imports so it can be unit-tested
 * with plain Node.
 *
 * @module dsh-notewall/store
 */

import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/** Bump when the on-disk shape changes in a backwards-incompatible way. */
export const DATA_VERSION = 1;

/** Defaults for a brand-new wall. */
export const DEFAULT_WALL = {
  /** css background shorthand; `{kind:'image'}` reads `mediaId` through /sticky-wall/media. */
  bg: { kind: 'color', color: '#f4f1ea', mediaId: null, dim: 0.55 },
  /** Cards per row at the reference width; the wall reflows below that. */
  columns: 3,
  /** Card edge in px (preview size, not the hover-scaled size). */
  cardWidth: 260,
  cardHeight: 220,
  /** Scale applied while the pointer rests on a card (hover magnifier). */
  hoverScale: 1.5,
  /** 新建便签的颜色策略：mode='auto' 走黄金角自动配色，'fixed' 用 color。 */
  newNoteColor: { mode: 'auto', color: '#faf7e0' },
  /** Gap between cards in px. */
  gap: 22,
  /** Root font size of the wall in px. */
  fontSize: 14,
};

/** Neutral sticky-note palette offered in the editor. */
export const NOTE_PALETTE = [
  '#fff3a3', '#ffe0b2', '#ffcdd2', '#d1c4e9',
  '#c8e6c9', '#b3e5fc', '#f8bbd0', '#e0e0e0',
];

const MAX_HTML = 200_000;
const MAX_MEDIA_BYTES = 8 * 1024 * 1024;

/** @typedef {'user'|'agent'} NoteAuthor */

/**
 * @typedef {object} Note
 * @property {string} id
 * @property {number} createdAt epoch ms
 * @property {number} updatedAt epoch ms
 * @property {string} html sanitized-ish rich text; images point at /sticky-wall/media/<file>
 * @property {string} color card background
 * @property {string} textColor
 * @property {boolean} pinned
 * @property {number} order ascending manual order; pinned notes sort before unpinned
 * @property {number|null} alarmAt epoch ms, or null
 * @property {number|null} alarmFiredAt epoch ms when the browser surfaced it
 * @property {NoteAuthor} createdBy
 * @property {string|null} title first-line cache for list/search
 */

/** A tiny FIFO mutex: every mutation runs after the previous one settles. */
function createQueue() {
  let tail = Promise.resolve();
  return (task) => {
    const run = tail.then(task, task);
    // Keep the chain alive regardless of the task's outcome.
    tail = run.then(() => undefined, () => undefined);
    return run;
  };
}

/**
 * Sanitize model/authored HTML by **whitelist rebuild**, not by blacklist regex.
 *
 * The previous implementation stripped a few obvious patterns, which three input
 * shapes walked straight through (all verified exploitable in the GUI origin):
 *   <a href=javascript:...>        unquoted attribute — regex required quotes
 *   <a href="&#106;avascript:...">  HTML entity — regex never decoded it
 *   <svg><a xlink:href="...">      foreign attribute name
 * So instead of removing bad things, we now keep only known-good tags and
 * attributes, validating href/src against a protocol allowlist *after* entity
 * decoding. Anything unknown is dropped (text content is preserved).
 */
const ALLOWED_TAGS = new Set([
  "p", "div", "span", "br", "hr",
  "strong", "b", "em", "i", "u", "s", "del", "mark",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li",
  "blockquote", "code", "pre",
  "img", "a",
]);
const VOID_TAGS = new Set(["br", "hr", "img"]);
const ATTR_ALLOW = {
  img: new Set(["src", "alt", "width", "height"]),
  a: new Set(["href", "title"]),
};
/** Decode the entity forms a browser would decode, so we judge the real value. */
function decodeEntities(value) {
  if (typeof value !== "string") return "";
  const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return value
    .replace(/&#x([0-9a-f]+);?/gi, (m, hex) => {
      const n = parseInt(hex, 16);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "";
    })
    .replace(/&#(\d+);?/g, (m, dec) => {
      const n = parseInt(dec, 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "";
    })
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/gi, (m, name) => named[name.toLowerCase()] ?? m);
}
function escapeAttr(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
/** Only these URL shapes may survive. Judged after entity decoding. */
const SAFE_HREF = /^(?:https?:\/\/|mailto:|tel:|\/|#|\.{1,2}\/)/i;
const SAFE_SRC = /^(?:\/sticky-wall\/media\/|data:image\/(?:png|jpe?g|webp|gif);base64,)/i;

function parseAttrs(raw) {
  const out = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  let m;
  while ((m = re.exec(raw))) {
    out[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? "";
  }
  return out;
}
function buildAttrs(tag, raw) {
  const allowed = ATTR_ALLOW[tag];
  if (!allowed) return "";
  const attrs = parseAttrs(raw);
  let out = "";
  for (const [name, rawValue] of Object.entries(attrs)) {
    if (!allowed.has(name)) continue;
    const decoded = decodeEntities(rawValue);
    if (name === "href" && !SAFE_HREF.test(decoded.trim())) continue;
    if (name === "src" && !SAFE_SRC.test(decoded.trim())) continue;
    if (name === "width" || name === "height") {
      if (!/^\d{1,4}$/.test(decoded.trim())) continue;
    }
    out += ` ${name}="${escapeAttr(decoded)}"`;
  }
  return out;
}

/** Strip unsafe markup from authored HTML. Whitelist rebuild; safe on any input. */
export function sanitizeHtml(input) {
  if (typeof input !== "string") return "";
  let html = input.slice(0, MAX_HTML);
  // Step 1: drop dangerous containers *with* their contents. svg/math matter
  // because they can host <a xlink:href> that browser URL handling still follows.
  html = html.replace(
    /<\s*(script|style|iframe|object|embed|link|meta|svg|math|template|noscript)\b[\s\S]*?<\s*\/\s*\1\s*>/gi,
    "",
  );
  html = html.replace(/<\s*(script|style|iframe|object|embed|link|meta|base|svg|math)\b[^>]*\/?>/gi, "");
  // Step 2: comments can hide markup from naive parsers; drop them outright.
  html = html.replace(/<!--[\s\S]*?-->/g, "");
  // Step 3: rebuild every remaining tag from the whitelist.
  html = html.replace(
    /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g,
    (match, close, rawName, rawAttrs) => {
      const name = String(rawName).toLowerCase();
      if (!ALLOWED_TAGS.has(name)) return "";
      if (close) return VOID_TAGS.has(name) ? "" : `</${name}>`;
      const attrs = buildAttrs(name, rawAttrs || "");
      return VOID_TAGS.has(name) ? `<${name}${attrs} />` : `<${name}${attrs}>`;
    },
  );
  // Step 4: a stray "<" that is not part of a tag must not start one later.
  return html.replace(/<(?![a-zA-Z/])/g, "&lt;");
}

/** Derive a plain-text title from rich text HTML. */
export function deriveTitle(html) {
  const text = String(html ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
  const first = text.split('\n').map((line) => line.trim()).find(Boolean);
  return (first ?? '').slice(0, 120);
}

/** Coerce an untrusted colour into something a style property can hold. */
export function normalizeColor(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const v = value.trim();
  if (/^#[0-9a-f]{3,8}$/i.test(v)) return v;
  if (/^rgba?\(\s*[\d.\s,%]+\)$/i.test(v)) return v;
  if (/^hsla?\(\s*[\d.\s,%]+\)$/i.test(v)) return v;
  return fallback;
}

/** Map a data URL (or raw base64) to `{ bytes, ext }`. */
export function decodeDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string') throw new Error('media payload must be a string');
  const match = /^data:([\w/+.-]+);base64,([\s\S]+)$/i.exec(dataUrl.trim());
  if (!match) throw new Error('media payload must be a base64 data: URL');
  const mime = match[1].toLowerCase();
  const extByMime = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };
  const ext = extByMime[mime];
  if (!ext) throw new Error(`unsupported media type: ${mime}`);
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length === 0) throw new Error('empty media payload');
  if (bytes.length > MAX_MEDIA_BYTES) throw new Error('media exceeds 8 MiB');
  return { bytes, ext, mime };
}

/**
 * @param {{ root: string }} options
 */
export function createStore({ root }) {
  const dataDir = root;
  const dataFile = join(dataDir, 'data.json');
  const mediaDir = join(dataDir, 'media');
  const serialize = createQueue();

  /** @type {object|null} in-memory document */
  let doc = null;

  function emptyDoc() {
    return {
      version: DATA_VERSION,
      rev: 0,
      notes: [],
      wall: structuredClone(DEFAULT_WALL),
      updatedAt: Date.now(),
    };
  }

  /** Normalize a persisted/mutated document; never throws on bad fields. */
  function normalize(raw) {
    const base = emptyDoc();
    if (!raw || typeof raw !== 'object') return base;
    const notes = Array.isArray(raw.notes) ? raw.notes : [];
    base.rev = Number.isFinite(raw.rev) ? Number(raw.rev) : 0;
    base.updatedAt = Number.isFinite(raw.updatedAt) ? Number(raw.updatedAt) : Date.now();
    base.wall = { ...base.wall, ...(raw.wall && typeof raw.wall === 'object' ? raw.wall : {}) };
    base.wall.bg = { ...DEFAULT_WALL.bg, ...(base.wall.bg ?? {}) };
    { const raw_cfg = base.wall.newNoteColor;
      const c = raw_cfg && typeof raw_cfg === 'object' ? raw_cfg : {};
      base.wall.newNoteColor = {
        mode: c.mode === 'fixed' ? 'fixed' : 'auto',
        color: typeof c.color === 'string' && /^#[0-9a-f]{6}$/i.test(c.color) ? c.color : DEFAULT_WALL.newNoteColor.color,
      };
    }
    base.notes = notes
      .filter((note) => note && typeof note === 'object' && typeof note.id === 'string')
      .map((note) => normalizeNote(note));
    return base;
  }

  /**
   * 归一化「定时投递」标记。null / 无效输入一律视为未定时。
   *
   * 结构：{ sessionId, sessionTitle, at, scheduleId, mode }
   *   - sessionId 目标会话；sessionTitle 仅供显示
   *   - at 计划发送时间（毫秒）
   *   - scheduleId 内核对 reminder 的 id，用来取消
   *   - mode 目前固定 'schedule'
   *
   * @param {unknown} value
   * @returns {{sessionId: string, sessionTitle: string, at: number, scheduleId: string|null, mode: string}|null}
   */
  function normalizeDelivery(value) {
    if (!value || typeof value !== 'object') return null;
    const sessionId = typeof value.sessionId === 'string' ? value.sessionId.trim() : '';
    const at = Number(value.at);
    if (!sessionId || !Number.isFinite(at) || at <= 0) return null;
    return {
      sessionId: sessionId.slice(0, 200),
      sessionTitle: typeof value.sessionTitle === 'string' ? value.sessionTitle.slice(0, 200) : '',
      at: Math.round(at),
      scheduleId: typeof value.scheduleId === 'string' ? value.scheduleId.slice(0, 200) : null,
      mode: 'schedule',
    };
  }

  function normalizeNote(note) {
    const html = sanitizeHtml(String(note.html ?? ''));
    return {
      id: String(note.id),
      createdAt: Number.isFinite(note.createdAt) ? Number(note.createdAt) : Date.now(),
      updatedAt: Number.isFinite(note.updatedAt) ? Number(note.updatedAt) : Date.now(),
      html,
      color: normalizeColor(note.color, NOTE_PALETTE[0]),
      textColor: normalizeColor(note.textColor, '#1f2430'),
      pinned: note.pinned === true,
      order: Number.isFinite(note.order) ? Number(note.order) : 0,
      alarmAt: Number.isFinite(note.alarmAt) && note.alarmAt > 0 ? Number(note.alarmAt) : null,
      alarmFiredAt: Number.isFinite(note.alarmFiredAt) ? Number(note.alarmFiredAt) : null,
      delivery: normalizeDelivery(note.delivery),
      // 草稿标记：新建后未写内容直接关闭时留下的空便签。
      // normalizeNote 是白名单，不在这里声明就会被静默丢弃。
      draft: note.draft === true,
      createdBy: note.createdBy === 'agent' ? 'agent' : 'user',
      title: typeof note.title === 'string' && note.title ? note.title.slice(0, 120) : deriveTitle(html),
    };
  }

  async function readDoc() {
    if (doc) return doc;
    await mkdir(mediaDir, { recursive: true });
    if (!existsSync(dataFile)) {
      doc = emptyDoc();
      return doc;
    }
    try {
      doc = normalize(JSON.parse(await readFile(dataFile, 'utf8')));
    } catch {
      // A corrupt document must not take the plugin down; keep a sidecar copy.
      try {
        await rename(dataFile, `${dataFile}.corrupt-${Date.now()}`);
      } catch {
        // ignore — the write below recreates a valid document
      }
      doc = emptyDoc();
    }
    return doc;
  }

  /** Atomic commit: write a sibling temp file, then rename over the target. */
  async function commit(current) {
    current.rev += 1;
    current.updatedAt = Date.now();
    await mkdir(dirname(dataFile), { recursive: true });
    const tmp = join(dataDir, `.data.${process.pid}.${randomUUID()}.tmp`);
    await writeFile(tmp, JSON.stringify(current, null, 2), 'utf8');
    await rename(tmp, dataFile);
    doc = current;
    return current;
  }

  /** Serialized read-modify-write. The mutator returns whether it changed anything. */
  function mutate(mutator) {
    return serialize(async () => {
      const current = await readDoc();
      const outcome = await mutator(current);
      if (outcome === false) return current;
      return commit(current);
    });
  }

  /** Notes in display order: pinned first, then manual order, then newest first. */
  function sortedNotes(current) {
    return [...current.notes].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (a.order !== b.order) return a.order - b.order;
      return b.createdAt - a.createdAt;
    });
  }

  return {
    root: dataDir,
    mediaDir,

    /** @returns {Promise<object>} normalized document snapshot */
    async snapshot() {
      const current = await readDoc();
      return { ...current, notes: sortedNotes(current) };
    },

    /** @returns {Promise<number>} current revision without cloning notes */
    async rev() {
      return (await readDoc()).rev;
    },

    /** @returns {Promise<{changed: boolean, rev: number, doc?: object}>} */
    async since(rev) {
      const current = await readDoc();
      const known = Number.isFinite(rev) ? Number(rev) : -1;
      if (known === current.rev) return { changed: false, rev: current.rev };
      return { changed: true, rev: current.rev, doc: { ...current, notes: sortedNotes(current) } };
    },

    /**
     * @param {object} input
     * @param {string} [input.html]
     * @param {string} [input.text] plain text (converted to escaped HTML)
     * @param {string} [input.color]
     * @param {string} [input.textColor]
     * @param {number|null} [input.alarmAt]
     * @param {NoteAuthor} [input.createdBy]
     * @param {boolean} [input.pinned]
     */
    async createNote(input = {}) {
      const id = `n_${randomUUID()}`;
      const current = await mutate((draft) => {
        const now = Date.now();
        const html = input.html != null ? sanitizeHtml(String(input.html)) : escapeToHtml(input.text);
        draft.notes.push(normalizeNote({
          id,
          createdAt: now,
          updatedAt: now,
          html,
          color: input.color ?? NOTE_PALETTE[draft.notes.length % NOTE_PALETTE.length],
          textColor: input.textColor ?? '#1f2430',
          pinned: input.pinned === true,
          // Newest first: a fresh note lands in front of the manual order.
          order: draft.notes.length === 0 ? 0 : Math.min(...draft.notes.map((n) => n.order)) - 1,
          alarmAt: input.alarmAt ?? null,
          createdBy: input.createdBy ?? 'user',
        }));
        return true;
      });
      return current.notes.find((note) => note.id === id) ?? null;
    },

    /**
     * Patch one note. Unknown ids are a no-op that still reports `false`.
     * @param {string} id
     * @param {Partial<Note>} patch
     */
    updateNote(id, patch = {}) {
      return mutate((current) => {
        const note = current.notes.find((candidate) => candidate.id === id);
        if (!note) return false;
        const next = { ...note };
        if (patch.html != null) next.html = sanitizeHtml(String(patch.html));
        if (patch.color != null) next.color = normalizeColor(patch.color, note.color);
        if (patch.textColor != null) next.textColor = normalizeColor(patch.textColor, note.textColor);
        if (patch.pinned != null) next.pinned = patch.pinned === true;
        if (patch.order != null && Number.isFinite(Number(patch.order))) next.order = Number(patch.order);
        if (patch.alarmAt !== undefined) {
          next.alarmAt = Number.isFinite(Number(patch.alarmAt)) && Number(patch.alarmAt) > 0
            ? Number(patch.alarmAt)
            : null;
          next.alarmFiredAt = null;
        }
        if (patch.alarmFiredAt !== undefined) {
          next.alarmFiredAt = Number.isFinite(Number(patch.alarmFiredAt))
            ? Number(patch.alarmFiredAt)
            : null;
        }
        // 定时投递标记：便签「预约发给某个会话」的状态。null 表示未定时。
        // 结构：{ sessionId, sessionTitle, at, scheduleId, mode }
        if (patch.delivery !== undefined) {
          next.delivery = normalizeDelivery(patch.delivery);
        }
        next.updatedAt = Date.now();
        next.title = deriveTitle(next.html);
        Object.assign(note, normalizeNote(next));
        return true;
      });
    },

    /** @param {string} id */
    deleteNote(id) {
      return mutate((current) => {
        const index = current.notes.findIndex((note) => note.id === id);
        if (index < 0) return false;
        current.notes.splice(index, 1);
        return true;
      });
    },

    /**
     * Reorder by explicit id list; ids not listed keep their relative order after.
     * @param {string[]} ids
     */
    reorder(ids) {
      return mutate((current) => {
        const list = Array.isArray(ids) ? ids.filter((id) => typeof id === 'string') : [];
        if (list.length === 0) return false;
        const rank = new Map(list.map((id, index) => [id, index]));
        for (const note of current.notes) {
          if (rank.has(note.id)) note.order = rank.get(note.id);
        }
        return true;
      });
    },

    /** @param {Partial<typeof DEFAULT_WALL>} patch */
    updateWall(patch = {}) {
      return mutate((current) => {
        const wall = { ...current.wall };
        if (Number.isFinite(Number(patch.columns))) {
          wall.columns = Math.min(8, Math.max(1, Math.round(Number(patch.columns))));
        }
        if (Number.isFinite(Number(patch.cardWidth))) {
          wall.cardWidth = Math.min(520, Math.max(160, Math.round(Number(patch.cardWidth))));
        }
        if (Number.isFinite(Number(patch.cardHeight))) {
          wall.cardHeight = Math.min(560, Math.max(120, Math.round(Number(patch.cardHeight))));
        }
        if (Number.isFinite(Number(patch.hoverScale))) {
          wall.hoverScale = Math.min(3, Math.max(1, Number(patch.hoverScale)));
        }
        if (Number.isFinite(Number(patch.gap))) {
          wall.gap = Math.min(80, Math.max(0, Math.round(Number(patch.gap))));
        }
        if (Number.isFinite(Number(patch.fontSize))) {
          wall.fontSize = Math.min(28, Math.max(10, Math.round(Number(patch.fontSize))));
        }
        if (patch.bg && typeof patch.bg === 'object') {
          const bg = { ...wall.bg };
          if (patch.bg.kind === 'color' || patch.bg.kind === 'image' || patch.bg.kind === 'none') {
            bg.kind = patch.bg.kind;
          }
          if (patch.bg.color != null) bg.color = normalizeColor(patch.bg.color, bg.color);
          if (patch.bg.mediaId !== undefined) {
            bg.mediaId = typeof patch.bg.mediaId === 'string' ? patch.bg.mediaId : null;
          }
          if (Number.isFinite(Number(patch.bg.dim))) {
            bg.dim = Math.min(1, Math.max(0, Number(patch.bg.dim)));
          }
          wall.bg = bg;
        }
        if (patch.newNoteColor && typeof patch.newNoteColor === "object") {
          const prev = wall.newNoteColor && typeof wall.newNoteColor === "object" ? wall.newNoteColor : {};
          const nextMode = patch.newNoteColor.mode;
          const nextColor = patch.newNoteColor.color;
          const isHex = (v) => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
          wall.newNoteColor = {
            mode:
              nextMode === "fixed"
                ? "fixed"
                : nextMode === "auto"
                  ? "auto"
                  : prev.mode === "fixed"
                    ? "fixed"
                    : "auto",
            color: isHex(nextColor) ? nextColor : isHex(prev.color) ? prev.color : DEFAULT_WALL.newNoteColor.color,
          };
        }
        current.wall = wall;
        return true;
      });
    },

    /**
     * Persist a base64 data URL under media/ and return its public URL.
     * Content-addressed, so re-pasting the same image does not grow the folder.
     * @param {string} dataUrl
     * @returns {Promise<{url: string, id: string, bytes: number}>}
     */
    async putMedia(dataUrl) {
      const { bytes, ext } = decodeDataUrl(dataUrl);
      const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 32);
      const id = `${hash}.${ext}`;
      await mkdir(mediaDir, { recursive: true });
      const target = join(mediaDir, id);
      if (!existsSync(target)) await writeFile(target, bytes);
      return { url: `/sticky-wall/media/${id}`, id, bytes: bytes.length };
    },

    /** Remove a media file (best effort). @param {string} id */
    async dropMedia(id) {
      if (typeof id !== 'string' || !/^[\w.-]+$/.test(id)) return false;
      try {
        await unlink(join(mediaDir, id));
        return true;
      } catch {
        return false;
      }
    },
  };
}

/** Convert plain text to escaped, paragraph-split HTML. */
export function escapeToHtml(text) {
  const safe = String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  return safe.split(/\n{2,}/).map((block) => `<p>${block.replace(/\n/g, '<br>')}</p>`).join('');
}
