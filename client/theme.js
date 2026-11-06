/**
 * 便签墙 — 样式表（注入一次）。
 *
 * 只用一个 `<style>` 标签，类名前缀 `sw-`，颜色全部走 DSH 的 CSS 变量并
 * 带 fallback，所以浅色/深色主题都不需要额外分支。卡片放大、预览裁剪这些
 * 需要伪类/过渡的效果放在这里，组件内只留布局相关的内联样式。
 *
 * @module dsh-notewall/client/theme
 */

const STYLE_ID = 'dsh-sticky-wall-styles';

const CSS = `
.sw-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--dsh-bg, #f7f7f8);
  color: var(--dsh-text, #1f2430);
  font-family: var(--dsh-font-family, system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif);
}
.sw-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border-bottom: 1px solid var(--dsh-border, rgba(127,127,127,.22));
  background: color-mix(in srgb, var(--dsh-bg, #f7f7f8) 88%, transparent);
  backdrop-filter: blur(10px);
  flex: 0 0 auto;
  z-index: 3;
}
.sw-toolbar .sw-spacer { flex: 1 1 auto; }
.sw-title {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: .02em;
}
.sw-count {
  font-size: 12px;
  color: var(--dsh-text-secondary, #667085);
}
.sw-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid var(--dsh-border, rgba(127,127,127,.3));
  background: var(--dsh-surface, rgba(127,127,127,.08));
  color: inherit;
  font-size: 12.5px;
  cursor: pointer;
  transition: background .14s ease, border-color .14s ease, transform .14s ease;
  user-select: none;
  white-space: nowrap;
}
.sw-btn:hover { background: var(--dsh-surface-hover, rgba(127,127,127,.16)); }
.sw-btn:active { transform: translateY(1px); }
.sw-btn.primary {
  background: var(--dsh-accent, #4d6bfe);
  border-color: transparent;
  color: #fff;
}
.sw-btn.primary:hover { filter: brightness(1.08); }
.sw-btn.ghost { background: transparent; border-color: transparent; }
.sw-btn.ghost:hover { background: var(--dsh-surface, rgba(127,127,127,.12)); }
.sw-btn:disabled { opacity: .45; cursor: not-allowed; }

.sw-wall {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  padding: 28px 24px 120px;
  scroll-behavior: smooth;
  scrollbar-gutter: stable;
  position: relative;
}
.sw-wall::-webkit-scrollbar { width: 10px; }
.sw-wall::-webkit-scrollbar-thumb {
  background: var(--dsh-border, rgba(127,127,127,.35));
  border-radius: 8px;
  border: 3px solid transparent;
  background-clip: content-box;
}

.sw-grid {
  display: grid;
  justify-content: center;
  margin: 0 auto;
  perspective: 1400px;
}

.sw-card {
  position: relative;
  border-radius: 10px;
  padding: 14px 14px 12px;
  box-shadow:
    0 1px 2px rgba(16, 24, 40, .10),
    0 6px 16px -8px rgba(16, 24, 40, .28);
  cursor: pointer;
  overflow: hidden;
  transition:
    transform .18s cubic-bezier(.2, .8, .3, 1),
    box-shadow .18s ease,
    opacity .18s ease;
  transform-origin: center center;
  will-change: transform;
  user-select: none;
  border: 1px solid rgba(16, 24, 40, .06);
}
.sw-card:hover,
.sw-card.is-hover {
  box-shadow:
    0 2px 4px rgba(16, 24, 40, .14),
    0 18px 42px -12px rgba(16, 24, 40, .42);
  z-index: 20;
}
.sw-card.is-dragging { opacity: .38; }
.sw-card.is-drop-target { outline: 2px dashed var(--dsh-accent, #4d6bfe); outline-offset: 3px; }
.sw-card.is-pinned::before {
  content: "";
  position: absolute;
  top: 0; left: 0;
  width: 34px; height: 4px;
  border-radius: 0 0 4px 0;
  background: var(--dsh-accent, #4d6bfe);
  opacity: .75;
}

.sw-card-title {
  font-size: .86em;
  font-weight: 650;
  line-height: 1.35;
  margin: 0 0 6px;
  opacity: .92;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sw-preview {
  position: relative;
  overflow: hidden;
  transition: max-height .22s ease;
}
.sw-preview img { max-width: 100%; border-radius: 6px; display: block; }
.sw-preview p { margin: 0 0 .5em; }
.sw-preview h2 { font-size: 1.05em; margin: 0 0 .4em; }
.sw-preview ul, .sw-preview ol { margin: .2em 0 .5em; padding-left: 1.2em; }
.sw-preview-fade {
  position: absolute;
  left: 0; right: 0; bottom: 0;
  height: 34px;
  pointer-events: none;
  background: linear-gradient(to bottom, transparent, var(--sw-fade, rgba(255,255,255,.92)));
}
.sw-card-meta {
  position: absolute;
  left: 12px; bottom: 8px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10.5px;
  opacity: .58;
  pointer-events: none;
}
.sw-badges {
  position: absolute;
  top: 8px; right: 8px;
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity .15s ease;
}
.sw-card:hover .sw-badges { opacity: 1; }
.sw-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px; height: 22px;
  border-radius: 6px;
  border: none;
  background: rgba(16, 24, 40, .10);
  color: inherit;
  font-size: 12px;
  cursor: pointer;
  pointer-events: auto;
}
.sw-badge:hover { background: rgba(16, 24, 40, .22); }
.sw-alarm-dot {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 10.5px;
  padding: 1px 5px;
  border-radius: 6px;
  background: rgba(16, 24, 40, .10);
}

.sw-overlay {
  position: fixed;
  inset: 0;
  background: rgba(12, 16, 24, .42);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1200;
  animation: sw-fade-in .15s ease;
  padding: 24px;
}
@keyframes sw-fade-in { from { opacity: 0 } to { opacity: 1 } }
.sw-modal {
  background: var(--dsh-bg, #fff);
  color: var(--dsh-text, #1f2430);
  border-radius: 14px;
  box-shadow: 0 24px 64px -16px rgba(9, 14, 24, .55);
  border: 1px solid var(--dsh-border, rgba(127,127,127,.2));
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: 86vh;
  animation: sw-pop .16s cubic-bezier(.2, .9, .3, 1.1);
}
@keyframes sw-pop { from { transform: scale(.96); opacity: .4 } to { transform: scale(1); opacity: 1 } }
.sw-modal-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--dsh-border, rgba(127,127,127,.2));
  flex: 0 0 auto;
}
.sw-modal-head .sw-title { flex: 1 1 auto; }
.sw-modal-body { overflow: auto; padding: 14px 16px; }
.sw-modal-foot {
  display: flex; gap: 8px; justify-content: flex-end;
  padding: 10px 16px;
  border-top: 1px solid var(--dsh-border, rgba(127,127,127,.2));
}

.sw-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  height: 100%;
  min-height: 260px;
  color: var(--dsh-text-secondary, #667085);
  text-align: center;
  font-size: 13px;
  line-height: 1.7;
}
.sw-empty strong { font-size: 15px; color: var(--dsh-text, #1f2430); }

.sw-toasts {
  position: fixed;
  right: 18px;
  bottom: 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  z-index: 1400;
  pointer-events: none;
}
.sw-toast {
  pointer-events: auto;
  width: 300px;
  border-radius: 12px;
  padding: 12px 14px;
  background: var(--dsh-bg, #fff);
  color: var(--dsh-text, #1f2430);
  border: 1px solid var(--dsh-border, rgba(127,127,127,.25));
  box-shadow: 0 14px 38px -12px rgba(9, 14, 24, .5);
  animation: sw-slide-in .2s cubic-bezier(.2, .9, .3, 1.05);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
@keyframes sw-slide-in { from { transform: translateX(24px); opacity: 0 } to { transform: none; opacity: 1 } }
.sw-toast-title { font-size: 12px; font-weight: 650; display: flex; align-items: center; gap: 6px; }
.sw-toast-text {
  font-size: 12px;
  line-height: 1.55;
  opacity: .85;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
  white-space: pre-wrap;
}
.sw-toast-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 2px; }

.sw-field {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  font-size: 12.5px;
}
.sw-field > label { flex: 0 0 96px; color: var(--dsh-text-secondary, #667085); }
.sw-field > *:last-child { flex: 1 1 auto; }
.sw-input {
  height: 30px;
  padding: 0 9px;
  border-radius: 8px;
  border: 1px solid var(--dsh-border, rgba(127,127,127,.3));
  background: var(--dsh-surface, rgba(127,127,127,.06));
  color: inherit;
  font-size: 12.5px;
  min-width: 0;
}
.sw-swatch {
  width: 26px; height: 26px;
  border-radius: 7px;
  border: 2px solid transparent;
  cursor: pointer;
  padding: 0;
  box-shadow: inset 0 0 0 1px rgba(16,24,40,.12);
}
.sw-swatch.active { border-color: var(--dsh-accent, #4d6bfe); }
.sw-row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.sw-muted { color: var(--dsh-text-secondary, #667085); font-size: 11.5px; }
.sw-kbd {
  display: inline-block;
  padding: 1px 5px;
  border-radius: 5px;
  border: 1px solid var(--dsh-border, rgba(127,127,127,.32));
  font-size: 10.5px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
/* 便签墙主体：左列（拖拽时展开的会话区） + 右列（卡片墙） */
.sw-body {
  display: flex;
  flex: 1;
  min-height: 0;
  min-width: 0;
}
.sw-body > .sw-wall {
  flex: 1;
  min-width: 0;
}
/* 拖便签到会话：拖到墙的左缘时，从左侧竖着展开的会话列表 */
.sw-dropbar {
  flex: none;
  width: 196px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin: 0 2px 0 10px;
  padding: 10px 8px;
  max-height: 100%;
  overflow-y: auto;
  border-radius: 10px;
  background: var(--dsw-alias-bg-layer-2, #f2f2f2);
  border: 1px dashed var(--dsw-alias-border-l3, #c8c8c8);
}
.sw-dropbar-title {
  flex: none;
  font-size: 11px;
  color: var(--dsw-alias-label-tertiary, #8b8b8b);
  padding: 0 4px 6px;
  letter-spacing: .04em;
}
.sw-dropbar-empty {
  font-size: 12px;
  color: var(--dsw-alias-label-tertiary, #8b8b8b);
  padding: 4px;
}
.sw-dropitem {
  flex: none;
  padding: 6px 9px;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.45;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--dsw-alias-label-primary, #222);
  background: var(--dsw-alias-bg-layer-1, #fff);
  border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, .12));
  cursor: pointer;
  transition: background .1s, color .1s, border-color .1s;
}
.sw-dropitem.is-hover {
  background: var(--dsw-alias-state-business-primary, #2563eb);
  border-color: var(--dsw-alias-state-business-primary, #2563eb);
  color: #fff;
}

/* 拖拽排序：两卡之间的插入指示线 */
.sw-insert-line {
  position: absolute;
  width: 3px;
  border-radius: 2px;
  background: var(--dsh-accent, #4d6bfe);
  box-shadow: 0 0 8px rgba(77, 107, 254, .55);
  pointer-events: none;
  z-index: 40;
}
/* 让位过渡：只在有位移时挂上，避免干扰 hover 放大动效 */
.sw-card.is-shifting {
  transition: transform .18s cubic-bezier(.2, .8, .2, 1);
}

`;

/** 把样式表注入文档一次（幂等）。 */
export function injectStyles(doc = globalThis.document) {
  if (!doc || typeof doc.createElement !== 'function') return;
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  doc.head.appendChild(style);
}

export { CSS };
