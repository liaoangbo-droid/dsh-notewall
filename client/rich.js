/**
 * dsh-notewall — rich-text helpers used by client/editor.js.
 *
 * Everything here is a pure function over primitives / plain objects: no DOM,
 * no React, no module state. That keeps the editor's tricky parts (empty-note
 * detection, the undo/redo ring, `datetime-local` <-> epoch conversion, image
 * extraction from a paste/drop payload) testable in plain Node.
 *
 * HTML notes live on the wire as whatever `contenteditable` produced; these
 * helpers only *inspect* it, they never rewrite the stored markup.
 */

/** Inline style every inserted media element carries (see CONTRACT.md). */
export const IMG_STYLE = 'max-width:100%; border-radius:6px; display:block; margin:6px 0;';

/** Fallback note colours when the server sends no palette. */
export const DEFAULT_PALETTE = [
  '#fff3a3',
  '#ffe0b2',
  '#ffd6e0',
  '#e3f2d9',
  '#d8f0f5',
  '#e6e0f8',
  '#f3f4f6',
  '#ffffff',
];

/** Text colours offered next to the background swatches. */
export const DEFAULT_TEXT_SWATCHES = [
  '#1f2430',
  '#5b6472',
  '#8a4b08',
  '#1d4ed8',
  '#b42318',
  '#0f766e',
  '#ffffff',
];

const HTML_ESCAPES = Object.freeze({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
});

/** Escape a string for use in HTML text or a double-quoted attribute. */
export function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

/** Alias kept explicit for attribute use sites. */
export const escapeAttr = escapeHtml;

/** `<img>` markup for a media URL — identical shape to what the editor inserts. */
export function imgTagHtml(url) {
  return (
    '<img src="' + escapeAttr(url) + '" alt="" data-note-media="1" style="' + IMG_STYLE + '">'
  );
}

/** Strip tags/entities down to visible text (used for blank detection). */
export function stripTags(html) {
  return String(html == null ? '' : html)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|blockquote|tr|td|th)>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'");
}

/** True when the html contains an element that counts as note content. */
export function hasImage(html) {
  return /<img\b/i.test(String(html == null ? '' : html));
}

/**
 * A note is "blank" when it has no visible text and no image. This is what
 * keeps a freshly opened editor from firing `onChange` (and therefore a
 * duplicate create) before the user actually writes something.
 */
export function isBlankHtml(html) {
  if (hasImage(html)) return false;
  const text = stripTags(html).replace(/[\s\u200b\ufeff\u00a0]+/g, '');
  return text.length === 0;
}

// ---------------------------------------------------------------------------
// Undo / redo ring
// ---------------------------------------------------------------------------

/**
 * @param {number} [limit] max snapshots kept (oldest dropped first)
 * @returns {{entries: string[], index: number, limit: number}}
 */
export function createHistory(limit = 100) {
  const size = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 100;
  return { entries: [], index: -1, limit: size };
}

/** Snapshot currently selected by the cursor, or '' when empty. */
export function currentSnapshot(history) {
  if (!history || !history.entries || history.index < 0) return '';
  const value = history.entries[history.index];
  return typeof value === 'string' ? value : '';
}

/**
 * Push a snapshot, dropping any redo tail. Pushing the snapshot that is already
 * on top is a no-op (same object back) so repeated debounced commits are cheap.
 */
export function historyPush(history, snapshot) {
  const base = history && Array.isArray(history.entries) ? history : createHistory();
  if (typeof snapshot !== 'string') return base;
  if (base.index >= 0 && base.entries[base.index] === snapshot) return base;
  const entries = base.entries.slice(0, base.index + 1);
  entries.push(snapshot);
  while (entries.length > base.limit) entries.shift();
  return { entries, index: entries.length - 1, limit: base.limit };
}

export function canUndo(history) {
  return !!history && Array.isArray(history.entries) && history.index > 0;
}

export function canRedo(history) {
  return (
    !!history &&
    Array.isArray(history.entries) &&
    history.index >= 0 &&
    history.index < history.entries.length - 1
  );
}

/** Move one step back; `null` when there is nothing to undo. */
export function historyUndo(history) {
  if (!canUndo(history)) return null;
  return { entries: history.entries, index: history.index - 1, limit: history.limit };
}

/** Move one step forward; `null` when there is nothing to redo. */
export function historyRedo(history) {
  if (!canRedo(history)) return null;
  return { entries: history.entries, index: history.index + 1, limit: history.limit };
}

// ---------------------------------------------------------------------------
// Alarm time <-> `<input type="datetime-local">`
// ---------------------------------------------------------------------------

function pad2(value) {
  return value < 10 ? '0' + value : String(value);
}

/**
 * Epoch ms -> local `YYYY-MM-DDTHH:mm` (what `datetime-local` wants).
 * Returns '' for null/0/invalid so the input stays empty.
 */
export function msToLocalInput(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return '';
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return '';
  return (
    String(date.getFullYear()) +
    '-' +
    pad2(date.getMonth() + 1) +
    '-' +
    pad2(date.getDate()) +
    'T' +
    pad2(date.getHours()) +
    ':' +
    pad2(date.getMinutes())
  );
}

/**
 * `datetime-local` value -> epoch ms, or `null` when cleared. A value without
 * a timezone suffix is parsed as *local* time, which is exactly what the input
 * means.
 */
export function localInputToMs(value) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

// ---------------------------------------------------------------------------
// Colours
// ---------------------------------------------------------------------------

/** Normalise `#abc` / `#aabbcc` / `#AABBCC` to lowercase `#aabbcc`. */
export function normalizeHexColor(value, fallback = '#ffffff') {
  const safeFallback = /^#[0-9a-fA-F]{6}$/.test(String(fallback))
    ? String(fallback).toLowerCase()
    : '#ffffff';
  const raw = String(value == null ? '' : value).trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    return (
      '#' +
      raw
        .slice(1)
        .split('')
        .map((ch) => ch + ch)
        .join('')
    ).toLowerCase();
  }
  return safeFallback;
}

export function isHexColor(value) {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(String(value == null ? '' : value).trim());
}

// ---------------------------------------------------------------------------
// Images from paste / drop / file picker payloads
// ---------------------------------------------------------------------------

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|avif|svg)$/i;

/** True for File/Blob-ish objects that look like images. */
export function isImageFile(file) {
  if (!file) return false;
  const type = String(file.type || '');
  if (/^image\//i.test(type)) return true;
  return IMAGE_EXT.test(String(file.name || ''));
}

/**
 * Pull image files out of a `DataTransfer` / `clipboardData` payload.
 * Handles both `items` (clipboard + drag) and plain `files`, and tolerates
 * missing/odd shapes so a paste never throws.
 *
 * @param {{items?: any, files?: any}|null|undefined} source
 * @returns {any[]} File-like objects, in payload order
 */
export function collectImageFiles(source) {
  const out = [];
  if (!source) return out;

  const items = source.items;
  if (items && typeof items.length === 'number') {
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (!item) continue;
      if (item.kind && item.kind !== 'file') continue;
      let file = null;
      try {
        file = typeof item.getAsFile === 'function' ? item.getAsFile() : null;
      } catch (err) {
        file = null;
      }
      if (file && isImageFile(file)) out.push(file);
    }
  }

  if (out.length === 0 && source.files && typeof source.files.length === 'number') {
    for (let i = 0; i < source.files.length; i += 1) {
      const file = source.files[i];
      if (file && isImageFile(file)) out.push(file);
    }
  }

  return out;
}
