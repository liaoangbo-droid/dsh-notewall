/**
 * dsh-notewall — note editor (富文本 + 图片任意位置 + 手写 + 撤销重做 + 实时保存).
 *
 * Contract (see CONTRACT.md):
 *
 *   NoteEditor({ note, palette, onClose, onChange, uploadImage })
 *     onChange({ html, color, textColor, alarmAt })  // debounced 400ms
 *
 * Design notes that matter if you touch this file:
 *
 *  - `contenteditable` is UNCONTROLLED. We never render `innerHTML` from React;
 *    it is written exactly once per note identity (see `note.id` effect) and
 *    then only by the browser, by toolbar commands, by undo/redo and by image
 *    insertion. Anything else would eat the caret.
 *  - Selection is saved eagerly (`selectionchange`) because toolbar buttons,
 *    the file picker, the async upload and the ink overlay all steal focus
 *    before we can insert at the caret.
 *  - `onChange` carries the RAW `innerHTML`. For a brand-new note we stay silent
 *    while the content is blank so the parent does not create an empty note;
 *    the first emission is whatever the user actually typed/inserted.
 *  - Undo/redo is our own snapshot stack (execCommand's undo is unreliable):
 *    300ms debounce, capped at 100 entries, paused during IME composition.
 *  - Image selection/resize is an OVERLAY, never DOM inside the <img>: anything
 *    we add to the contenteditable would be serialised by `innerHTML` into
 *    note.html. The overlay is a sibling of the editable div, positioned in the
 *    scroll container's *content* coordinates, so scrolling needs no re-measure.
 *    The resize size itself is written as inline width/height on the <img>,
 *    which is what survives into note.html.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { t } from './strings.js';

import {
  DEFAULT_PALETTE,
  DEFAULT_TEXT_SWATCHES,
  IMG_STYLE,
  canRedo,
  canUndo,
  collectImageFiles,
  createHistory,
  currentSnapshot,
  historyPush,
  historyRedo,
  historyUndo,
  isBlankHtml,
  localInputToMs,
  msToLocalInput,
  normalizeHexColor,
} from './rich.js';

/** Save debounce for content edits (colour/alarm on a *saved* note go out at once). */
const SAVE_DELAY = 400;

/** Snapshot debounce for the undo stack. */
const HISTORY_DELAY = 200;

/** Undo stack depth. */
const HISTORY_LIMIT = 100;

/** Content panel geometry (the parent owns positioning + the mask). */
const PANEL_WIDTH = 520;
const PANEL_HEIGHT = 560;

const DEFAULT_BG = '#fff3a3';
const DEFAULT_TEXT = '#1f2430';

const FONT =
  'system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';

// ---------------------------------------------------------------------------
// Small DOM helpers (module scope: no React state involved)
// ---------------------------------------------------------------------------

function preventDefault(event) {
  if (event && typeof event.preventDefault === 'function') event.preventDefault();
}

/** Put the caret after the last node of `el`. */
function placeCaretAtEnd(el) {
  if (!el) return;
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

/** Caret range under a viewport point (drop handling). */
function caretRangeFromPoint(x, y) {
  try {
    if (typeof document.caretRangeFromPoint === 'function') {
      return document.caretRangeFromPoint(x, y);
    }
    if (typeof document.caretPositionFromPoint === 'function') {
      const position = document.caretPositionFromPoint(x, y);
      if (!position || !position.offsetNode) return null;
      const range = document.createRange();
      range.setStart(position.offsetNode, position.offset);
      range.collapse(true);
      return range;
    }
  } catch (err) {
    /* ignore — caller falls back to the last saved selection */
  }
  return null;
}

/** True when a drag carries files (so we can accept the drop). */
function dragHasFiles(types) {
  if (!types) return false;
  try {
    for (let i = 0; i < types.length; i += 1) {
      if (types[i] === 'Files') return true;
    }
  } catch (err) {
    return false;
  }
  return false;
}

/**
 * InkPad happily exports a fully transparent PNG when nothing was drawn.
 * Sample the alpha channel (downscaled) so an empty pad does not upload a
 * blank media file and insert an invisible image.
 */
function dataUrlHasVisibleInk(dataUrl) {
  return new Promise((resolve) => {
    let img = null;
    try {
      img = new Image();
    } catch (err) {
      resolve(true);
      return;
    }
    img.onload = () => {
      try {
        const naturalWidth = img.naturalWidth || img.width || 1;
        const naturalHeight = img.naturalHeight || img.height || 1;
        const width = Math.max(1, Math.min(naturalWidth, 240));
        const height = Math.max(1, Math.min(naturalHeight, 240));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(true);
          return;
        }
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const data = ctx.getImageData(0, 0, width, height).data;
        let visible = false;
        for (let i = 3; i < data.length; i += 4) {
          if (data[i] > 8) {
            visible = true;
            break;
          }
        }
        resolve(visible);
      } catch (err) {
        // Tainted canvas / exotic engine: assume the user drew something.
        resolve(true);
      }
    };
    img.onerror = () => resolve(true);
    img.src = dataUrl;
  });
}

/** File -> data URL (the shape `uploadImage` expects). */
function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error(t('error.readFile')));
    reader.readAsDataURL(file);
  });
}

/** Write the display size into the <img> inline style — this is what survives. */
function applyImageSize(img, width, height) {
  if (!img || !img.style) return;
  img.style.width = Math.max(1, Math.round(width)) + 'px';
  img.style.height = Math.max(1, Math.round(height)) + 'px';
}

/**
 * Content width of the contenteditable (minus its horizontal padding).
 * This is the ceiling for a resized image: above it `max-width:100%` from
 * IMG_STYLE would clamp the *rendered* box anyway and the overlay (measured
 * from getBoundingClientRect) would disagree with the stored width.
 */
function editorContentWidth(el) {
  if (!el) return 0;
  let width = el.clientWidth || 0;
  try {
    const computed = window.getComputedStyle(el);
    width -= (parseFloat(computed.paddingLeft) || 0) + (parseFloat(computed.paddingRight) || 0);
  } catch (err) {
    /* no computed style (test doubles): fall back to clientWidth */
  }
  return width > 0 ? Math.floor(width) : 0;
}

// ---------------------------------------------------------------------------
// Image selection / resize maths
//
// Pure functions only (numbers in, numbers out): the corner→direction mapping
// and the drag→size calculation are the parts that are easy to get wrong, so
// they are exported and covered by test/image-resize.mjs.
// ---------------------------------------------------------------------------

/**
 * 选中框相对图片向外扩的像素。
 * 画在 overlay 上而不是图片上：overlay 是 contenteditable 的兄弟节点，
 * 永远进不了 note.html —— 装饰不能污染落盘的 HTML。
 */
export const IMAGE_SELECT_OUTSET = 8;

/** 图片显示尺寸下限：再小就没法用鼠标/手指再抓回来。 */
export const IMAGE_RESIZE_MIN = 40;

/**
 * 角点 -> 拖拽方向。
 * x=+1 表示该角在图片右侧（指针右移 → 变宽），y=+1 表示在下方。
 * 未知角点按右下角处理，宁可退化也不要抛错。
 */
export function cornerSigns(corner) {
  const key = typeof corner === 'string' ? corner.toLowerCase() : 'se';
  return {
    x: key === 'nw' || key === 'sw' ? -1 : 1,
    y: key === 'nw' || key === 'ne' ? -1 : 1,
  };
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

/**
 * 由「拖拽起点尺寸 + 指针位移 + 拖的是哪个角」算出新的显示尺寸。
 *
 * @param {{
 *   startWidth: number, startHeight: number,
 *   dx?: number, dy?: number,
 *   corner?: 'nw'|'ne'|'sw'|'se',
 *   minSize?: number, maxSize?: number,
 * }} options
 * @returns {{width: number, height: number}} 像素整数
 *
 * 两点决定：
 *  - 宽高比取自拖拽开始时的尺寸。若每帧都用新尺寸重算比例，取整误差会累积，
 *    图片会被慢慢拉扁。
 *  - 横向位移和「折算成宽度的纵向位移」谁变化更大谁驱动，否则纯垂直拖动
 *    会让四角手柄看起来失灵。宽度钳制在 [minSize, maxSize]，高度由比例推出。
 */
export function resizeFromDrag(options) {
  const opts = options || {};
  // 图片还没解码完时 getBoundingClientRect 可能给出 0：两个维度任一无效就退回
  // 1:1，别让 aspect 变成 Infinity 把图拉成一条线。
  const rawWidth = Number.isFinite(opts.startWidth) && opts.startWidth > 0 ? opts.startWidth : 0;
  const rawHeight = Number.isFinite(opts.startHeight) && opts.startHeight > 0 ? opts.startHeight : 0;
  const startWidth = rawWidth || rawHeight || IMAGE_RESIZE_MIN;
  const startHeight = rawHeight || rawWidth || IMAGE_RESIZE_MIN;
  const dx = Number.isFinite(opts.dx) ? opts.dx : 0;
  const dy = Number.isFinite(opts.dy) ? opts.dy : 0;
  const signs = cornerSigns(opts.corner);

  const aspect = startWidth / startHeight;
  const byWidth = startWidth + signs.x * dx;
  const byHeight = (startHeight + signs.y * dy) * aspect;
  const driven =
    Math.abs(byWidth - startWidth) >= Math.abs(byHeight - startWidth) ? byWidth : byHeight;

  // 下限先于上限判断：容器窄到装不下下限时以下限为准，否则区间倒挂会把图压成 0。
  const floor = Number.isFinite(opts.minSize) && opts.minSize > 0 ? opts.minSize : IMAGE_RESIZE_MIN;
  const ceiling =
    Number.isFinite(opts.maxSize) && opts.maxSize > 0 ? Math.max(opts.maxSize, floor) : Infinity;
  const width = Math.round(clampNumber(driven, floor, ceiling));
  const height = Math.max(1, Math.round(width / aspect));
  return { width, height };
}

/**
 * 图片矩形 -> overlay 矩形（相对滚动容器的内容坐标系）。
 *
 * 用内容坐标而不是视口坐标：overlay 是滚动容器的绝对定位子节点，本身会跟着
 * 内容一起滚，所以滚动时不需要重新测量，只需要在内容宽度变化时重算。
 */
export function overlayGeometry(options) {
  const opts = options || {};
  const imgRect = opts.imgRect || {};
  const wrapRect = opts.wrapRect || {};
  const outset =
    Number.isFinite(opts.outset) && opts.outset >= 0 ? opts.outset : IMAGE_SELECT_OUTSET;
  const scrollTop = Number.isFinite(opts.scrollTop) ? opts.scrollTop : 0;
  const scrollLeft = Number.isFinite(opts.scrollLeft) ? opts.scrollLeft : 0;
  const num = (value) => (Number.isFinite(value) ? value : 0);

  const width = Math.max(0, num(imgRect.width));
  const height = Math.max(0, num(imgRect.height));
  return {
    left: Math.round(num(imgRect.left) - num(wrapRect.left) + scrollLeft - outset),
    top: Math.round(num(imgRect.top) - num(wrapRect.top) + scrollTop - outset),
    width: Math.round(width + outset * 2),
    height: Math.round(height + outset * 2),
  };
}

// ---------------------------------------------------------------------------
// Style objects (inline + CSS-variable fallbacks, readable on both themes)
// ---------------------------------------------------------------------------

const baseButton = {
  appearance: 'none',
  WebkitAppearance: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: 28,
  minWidth: 28,
  padding: '0 8px',
  borderRadius: 8,
  border: '1px solid var(--dsh-border, rgba(128, 140, 160, 0.32))',
  background: 'transparent',
  color: 'inherit',
  fontFamily: 'inherit',
  fontSize: 13,
  lineHeight: 1,
  cursor: 'pointer',
  userSelect: 'none',
  whiteSpace: 'nowrap',
};

const toolRow = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 6,
};

const dividerStyle = {
  width: 1,
  height: 18,
  margin: '0 2px',
  background: 'var(--dsh-border, rgba(128, 140, 160, 0.3))',
};

const fieldStyle = {
  height: 28,
  padding: '0 8px',
  borderRadius: 8,
  border: '1px solid var(--dsh-border, rgba(128, 140, 160, 0.32))',
  background: 'var(--dsh-bg-elevated, #ffffff)',
  color: 'inherit',
  fontFamily: 'inherit',
  fontSize: 12,
};

const s = {
  root: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    width: PANEL_WIDTH,
    maxWidth: 'calc(100vw - 24px)',
    height: PANEL_HEIGHT,
    maxHeight: '80vh',
    borderRadius: 16,
    overflow: 'hidden',
    background: 'var(--dsh-bg-elevated, #ffffff)',
    color: 'var(--dsh-text-primary, #1f2430)',
    border: '1px solid var(--dsh-border, rgba(128, 140, 160, 0.24))',
    boxShadow: '0 18px 48px rgba(15, 23, 42, 0.3)',
    fontFamily: FONT,
    textAlign: 'left',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: '10px 12px 10px 16px',
    borderBottom: '1px solid var(--dsh-border, rgba(128, 140, 160, 0.22))',
    background: 'var(--dsh-bg-secondary, rgba(246, 247, 250, 0.9))',
    flex: '0 0 auto',
  },
  title: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--dsh-text-primary, #1f2430)',
    letterSpacing: 0.2,
  },
  closeButton: {
    ...baseButton,
    minWidth: 28,
    height: 28,
    padding: 0,
    border: 'none',
    background: 'transparent',
    fontSize: 20,
    lineHeight: 1,
    color: 'var(--dsh-text-secondary, #667085)',
    borderRadius: 8,
  },
  toolbar: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: '8px 12px',
    borderBottom: '1px solid var(--dsh-border, rgba(128, 140, 160, 0.22))',
    background: 'var(--dsh-bg-secondary, rgba(246, 247, 250, 0.9))',
    flex: '0 0 auto',
  },
  canvasWrap: {
    position: 'relative',
    flex: '1 1 auto',
    minHeight: 120,
    overflowY: 'auto',
    overflowX: 'hidden',
  },
  placeholder: {
    position: 'absolute',
    top: 16,
    left: 18,
    right: 18,
    fontSize: 15,
    lineHeight: 1.7,
    opacity: 0.42,
    pointerEvents: 'none',
    userSelect: 'none',
  },
  canvas: {
    minHeight: '100%',
    padding: '14px 16px',
    outline: 'none',
    fontSize: 15,
    lineHeight: 1.7,
    wordBreak: 'break-word',
    overflowWrap: 'anywhere',
    whiteSpace: 'pre-wrap',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  footer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: '10px 12px',
    borderTop: '1px solid var(--dsh-border, rgba(128, 140, 160, 0.22))',
    background: 'var(--dsh-bg-secondary, rgba(246, 247, 250, 0.9))',
    flex: '0 0 auto',
  },
  footerRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    flex: '0 0 auto',
    width: 30,
    fontSize: 12,
    color: 'var(--dsh-text-secondary, #667085)',
  },
  colorPicker: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    height: 24,
    padding: '0 7px',
    borderRadius: 7,
    border: '1px solid var(--dsh-border, rgba(128, 140, 160, 0.32))',
    background: 'var(--dsh-bg-elevated, #ffffff)',
    fontSize: 11,
    color: 'var(--dsh-text-secondary, #667085)',
    cursor: 'pointer',
  },
  colorInput: {
    width: 16,
    height: 16,
    padding: 0,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
  },
  inlineError: {
    fontSize: 12,
    lineHeight: 1.5,
    color: 'var(--dsh-danger, #b42318)',
  },
  toast: {
    position: 'absolute',
    left: '50%',
    bottom: 14,
    transform: 'translateX(-50%)',
    maxWidth: '80%',
    padding: '5px 12px',
    borderRadius: 8,
    background: 'rgba(23, 30, 45, 0.9)',
    color: '#ffffff',
    fontSize: 12,
    lineHeight: 1.4,
    textAlign: 'center',
    pointerEvents: 'none',
    zIndex: 30,
  },
};

function swatchStyle(active) {
  return {
    width: 22,
    height: 22,
    padding: 0,
    borderRadius: 7,
    cursor: 'pointer',
    border: active
      ? '2px solid var(--dsh-accent, #4c7cff)'
      : '1px solid var(--dsh-border, rgba(128, 140, 160, 0.4))',
    boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.4)',
  };
}

// ---------------------------------------------------------------------------
// Toolbar button
// ---------------------------------------------------------------------------

function ToolButton(props) {
  const { label, title, onPress, disabled, bold, italic, underline, strike } = props;
  const textStyle = {
    fontWeight: bold ? 700 : 500,
    fontStyle: italic ? 'italic' : 'normal',
    textDecoration: underline ? 'underline' : strike ? 'line-through' : 'none',
    fontSize: label && label.length > 2 ? 12 : 13,
  };
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={!!disabled}
      // Keep the caret/selection inside the contenteditable: never let the
      // button take focus on mousedown.
      onMouseDown={preventDefault}
      onClick={onPress}
      style={{
        ...baseButton,
        ...textStyle,
        opacity: disabled ? 0.42 : 1,
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Image selection overlay (drag the four corners to resize)
// ---------------------------------------------------------------------------

/** 手柄直径（px）。太小手指点不中，太大会盖住图片内容。 */
const HANDLE_SIZE = 12;

const CORNERS = [
  { corner: 'nw', left: 0, top: 0, cursor: 'nwse-resize' },
  { corner: 'ne', left: '100%', top: 0, cursor: 'nesw-resize' },
  { corner: 'sw', left: 0, top: '100%', cursor: 'nesw-resize' },
  { corner: 'se', left: '100%', top: '100%', cursor: 'nwse-resize' },
];

/**
 * 选中框 + 四个角手柄。
 *
 * 几何完全由 `img.getBoundingClientRect()` 反推，所以图片因为换行、字号、
 * 滚动条或窗口缩放挪位置时，框会跟着走。overlay 是 contenteditable 的兄弟
 * 节点（绝对定位在滚动容器内），`innerHTML` 永远序列化不到它。
 *
 * 拖拽用 Pointer Events + setPointerCapture（与 ink.js 一致），这样手指/笔
 * 移出面板也不会丢事件；拖拽期间只改 <img> 的内联尺寸，松手才通知编辑器
 * 落盘一次。
 */
function ImageResizeOverlay(props) {
  const { img, revision, wrapRef, maxWidth, onCommit, onDelete, onDeselect } = props;
  const [geo, setGeo] = useState(null);
  const dragRef = useRef(null);

  const measure = useCallback(() => {
    const node = img;
    const wrap = wrapRef && wrapRef.current;
    if (!node || !wrap) return false;
    // 用户退格删除图片后节点会脱离文档：立刻让框消失，别留一个悬空的选择框。
    if (node.isConnected === false) {
      setGeo(null);
      return false;
    }
    const imgRect = node.getBoundingClientRect();
    if (!(imgRect.width > 0.5) && !(imgRect.height > 0.5)) {
      setGeo(null);
      return false;
    }
    const wrapRect = wrap.getBoundingClientRect();
    const box = overlayGeometry({
      imgRect,
      wrapRect,
      scrollTop: wrap.scrollTop || 0,
      scrollLeft: wrap.scrollLeft || 0,
    });
    setGeo({ ...box, imgWidth: imgRect.width, imgHeight: imgRect.height });
    return true;
  }, [img, wrapRef]);

  // 内容变化（打字/撤销/删除）会让图片位移，revision 每次自增时重测。
  useEffect(() => {
    const visible = measure();
    if (!visible && img && img.isConnected === false && typeof onDeselect === 'function') {
      onDeselect();
    }
  }, [measure, revision, img, onDeselect]);

  // 面板宽度变化会改变换行，图片可能被挤到下一行。
  useEffect(() => {
    const wrap = wrapRef && wrapRef.current;
    if (!wrap || typeof ResizeObserver !== 'function') return undefined;
    const observer = new ResizeObserver(() => {
      measure();
    });
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [measure, wrapRef]);

  // 图片可能还没解码完（选中时 rect 还是 0 或占位比例），解码后要重测。
  useEffect(() => {
    if (!img || typeof img.addEventListener !== 'function') return undefined;
    const onLoad = () => {
      measure();
    };
    img.addEventListener('load', onLoad);
    return () => img.removeEventListener('load', onLoad);
  }, [img, measure]);

  const handlePointerDown = (corner) => (event) => {
    if (!img || !geo) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (event.cancelable) event.preventDefault();
    event.stopPropagation();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch (err) {
      /* 环境不支持捕获：退化为普通 pointermove */
    }
    const limit = typeof maxWidth === 'function' ? maxWidth() : 0;
    dragRef.current = {
      pointerId: event.pointerId,
      corner,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: geo.imgWidth,
      startHeight: geo.imgHeight,
      // 容器量不到宽度时不要传 0，否则 resizeFromDrag 会把图锁死在下限。
      maxSize: limit >= IMAGE_RESIZE_MIN ? limit : Infinity,
      moved: false,
    };
  };

  const handlePointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    // 抖动阈值：手指按下时的 1px 误差不该触发一次「编辑」。
    if (!drag.moved && Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
    drag.moved = true;
    const next = resizeFromDrag({
      startWidth: drag.startWidth,
      startHeight: drag.startHeight,
      dx,
      dy,
      corner: drag.corner,
      maxSize: drag.maxSize,
    });
    applyImageSize(img, next.width, next.height);
    measure();
  };

  const handlePointerEnd = (event) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (event && event.pointerId !== undefined && event.pointerId !== drag.pointerId) return;
    dragRef.current = null;
    try {
      if (event && event.currentTarget && event.currentTarget.releasePointerCapture) {
        event.currentTarget.releasePointerCapture(drag.pointerId);
      }
    } catch (err) {
      /* 已释放/不支持捕获：忽略 */
    }
    if (drag.moved && typeof onCommit === 'function') onCommit();
    measure();
  };

  if (!geo) return null;

  return (
    <div
      data-sw-image-overlay="1"
      style={{
        position: 'absolute',
        left: geo.left,
        top: geo.top,
        width: geo.width,
        height: geo.height,
        boxSizing: 'border-box',
        border: '2px solid rgba(76, 124, 255, 0.95)',
        borderRadius: 8,
        boxShadow: '0 0 0 3px rgba(76, 124, 255, 0.18)',
        // 框本身不抢事件：图片旁边的文字仍然可以点（点了就取消选中）。
        pointerEvents: 'none',
        zIndex: 8,
      }}
    >
      {CORNERS.map((item) => (
        <span
          key={item.corner}
          role="presentation"
          aria-label={t('editor.zoomImage', { corner: item.corner })}
          onPointerDown={handlePointerDown(item.corner)}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onLostPointerCapture={handlePointerEnd}
          style={{
            position: 'absolute',
            left: item.left,
            top: item.top,
            width: HANDLE_SIZE,
            height: HANDLE_SIZE,
            marginLeft: -HANDLE_SIZE / 2,
            marginTop: -HANDLE_SIZE / 2,
            boxSizing: 'border-box',
            borderRadius: '50%',
            background: '#ffffff',
            border: '2px solid rgba(76, 124, 255, 0.95)',
            boxShadow: '0 1px 4px rgba(15, 23, 42, 0.28)',
            cursor: item.cursor,
            pointerEvents: 'auto',
            touchAction: 'none',
          }}
        />
      ))}
      <button
        type="button"
        title={t('editor.deleteImage')}
        aria-label={t('editor.deleteImage')}
        onPointerDown={(event) => {
          if (event.cancelable) event.preventDefault();
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (typeof onDelete === 'function') onDelete(img);
        }}
        style={{
          position: 'absolute',
          right: -HANDLE_SIZE - 4,
          top: -HANDLE_SIZE - 4,
          width: 20,
          height: 20,
          padding: 0,
          boxSizing: 'border-box',
          borderRadius: '50%',
          border: '2px solid #ffffff',
          background: 'rgba(180, 35, 24, 0.95)',
          color: '#ffffff',
          fontSize: 12,
          lineHeight: 1,
          cursor: 'pointer',
          pointerEvents: 'auto',
          touchAction: 'none',
          boxShadow: '0 1px 4px rgba(15, 23, 42, 0.28)',
        }}
      >
        ×
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

/**
 * @param {{
 *   note: any|null,
 *   palette: string[],
 *   onClose: () => void,
 *   onChange: (patch: {html: string, color: string, textColor: string, alarmAt: number|null}) => void,
 *   uploadImage: (dataUrl: string) => Promise<{url: string, id?: string}>,
 * }} props
 */
export function NoteEditor(props) {
  const { note = null, palette, onClose, onChange, uploadImage, onDeliver } = props || {};

  const paletteList = useMemo(() => {
    const source = Array.isArray(palette) && palette.length > 0 ? palette : DEFAULT_PALETTE;
    const cleaned = source.filter((entry) => typeof entry === 'string' && entry.trim() !== '');
    return cleaned.length > 0 ? cleaned : DEFAULT_PALETTE;
  }, [palette]);

  const noteId = note && typeof note.id === 'string' ? note.id : null;

  // --- refs ---------------------------------------------------------------
  const editorRef = useRef(null);
  const canvasWrapRef = useRef(null);
  const selectedImageRef = useRef(null);
  const fileInputRef = useRef(null);
  const lastRangeRef = useRef(null);
  const saveTimerRef = useRef(null);
  const historyTimerRef = useRef(null);
  const historyRef = useRef(createHistory(HISTORY_LIMIT));
  const composingRef = useRef(false);
  const htmlRef = useRef('');
  const colorRef = useRef(DEFAULT_BG);
  const textColorRef = useRef(DEFAULT_TEXT);
  const alarmRef = useRef(null);
  const noteIdRef = useRef(null);
  const pendingKindRef = useRef('content');
  const lastEmittedRef = useRef(null);
  const inkComponentRef = useRef(null);
  const inkOpenRef = useRef(false);
  const onCloseRef = useRef(onClose);
  const onChangeRef = useRef(onChange);
  const uploadRef = useRef(uploadImage);
  const mountedRef = useRef(true);

  // --- state (drives rendering only; refs stay authoritative for callbacks) -
  const [color, setColor] = useState(DEFAULT_BG);
  const [textColor, setTextColor] = useState(DEFAULT_TEXT);
  const [alarmAt, setAlarmAt] = useState(null);
  const [empty, setEmpty] = useState(true);
  const [hint, setHint] = useState(null);
  const [inkOpen, setInkOpen] = useState(false);
  const [inkLoading, setInkLoading] = useState(false);
  const [inkError, setInkError] = useState(null);
  const [historyFlags, setHistoryFlags] = useState({ undo: false, redo: false });
  // 双击选中的那张 <img>（DOM 节点本身，不是 id：图片没有稳定 id）。
  const [selectedImage, setSelectedImage] = useState(null);
  // 内容版本号：overlay 据此在图片位移后重新测量，省得去监听每次 DOM 变化。
  const [contentRev, setContentRev] = useState(0);

  // Prop refs: callbacks fire long after a render, so read them through refs.
  useEffect(() => {
    onCloseRef.current = onClose;
    onChangeRef.current = onChange;
    uploadRef.current = uploadImage;
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
        // Last chance to flush: the element may already be detached, emitNow
        // falls back to the htmlRef mirror.
        if (editorRef.current) htmlRef.current = editorRef.current.innerHTML;
        emitRef.current();
      }
      if (historyTimerRef.current) {
        clearTimeout(historyTimerRef.current);
        historyTimerRef.current = null;
      }
    };
  }, []);

  // --- saving -------------------------------------------------------------

  const emitNow = useCallback((kind) => {
    const el = editorRef.current;
    if (el) htmlRef.current = el.innerHTML;
    const payload = {
      html: htmlRef.current,
      color: colorRef.current,
      textColor: textColorRef.current,
      alarmAt: alarmRef.current,
    };

    // New note + blank content: stay silent so the parent does not create an
    // empty card. Anything already created (has id) always persists.
    const created = !!noteIdRef.current;
    const isMeta = kind === 'meta';
    if (!created && !isMeta && isBlankHtml(payload.html)) return;

    const last = lastEmittedRef.current;
    if (
      last &&
      last.html === payload.html &&
      last.color === payload.color &&
      last.textColor === payload.textColor &&
      last.alarmAt === payload.alarmAt
    ) {
      return;
    }

    lastEmittedRef.current = payload;
    try {
      if (typeof onChangeRef.current === 'function') onChangeRef.current(payload);
    } catch (err) {
      console.error('[sticky-wall] onChange failed', err);
    }
  }, []);

  // Stable handle for the unmount cleanup (which runs with a stale closure).
  const emitRef = useRef(emitNow);
  emitRef.current = emitNow;

  const scheduleSave = useCallback(
    (kind) => {
      pendingKindRef.current = kind || 'content';
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null;
        const pending = pendingKindRef.current;
        pendingKindRef.current = 'content';
        emitNow(pending);
      }, SAVE_DELAY);
    },
    [emitNow],
  );

  const flushSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const kind = pendingKindRef.current;
    pendingKindRef.current = 'content';
    emitNow(kind);
  }, [emitNow]);

  // --- selection ----------------------------------------------------------

  const saveSelection = useCallback(() => {
    const el = editorRef.current;
    const selection = typeof window !== 'undefined' ? window.getSelection() : null;
    if (!el || !selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (el.contains(range.commonAncestorContainer)) {
      lastRangeRef.current = range.cloneRange();
    }
  }, []);

  const restoreSelection = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
  // IME 组合态下绝不能动 selection。
    //
    // removeAllRanges() 会直接打断输入法组词；更糟的是在 Chrome 里可能把整个
    // 标签页的 IME 上下文弄坏 —— 之后**页面上所有输入框**（包括会话对话框）
    // 都打不进字，中英文都一样，只有刷新页面才能恢复。这正是用户实测到的
    // 「删便签后无法输入、能选中能删、刷新恢复」那一组症状。
    // 组合期间浏览器自己要管 selection，这里让路即可。
    if (composingRef.current) return;
    try {
      el.focus({ preventScroll: true });
    } catch (err) {
      el.focus();
    }
    const selection = window.getSelection();
    if (!selection) return;
    const saved = lastRangeRef.current;
    if (saved && el.contains(saved.commonAncestorContainer)) {
      selection.removeAllRanges();
      selection.addRange(saved.cloneRange());
      return;
    }
    placeCaretAtEnd(el);
  }, []);

  // 编辑器卸载时主动 blur。
  //
  // 如果 contenteditable 在输入法还处于「组合中」时被移除（关闭/删除便签就会这样），
  // 浏览器的 IME 上下文会卡在未结束状态：整页输入框此后都打不进字。用户实测的恢复
  // 方式是「切到别的标签页再切回来」——那正好是一次强制 blur+focus。所以卸载前自己
  // 先失焦，让浏览器有机会正常收尾。
  //
  // 注意：Hook 只能写在组件体顶层。这段曾被误塞进 restoreSelection 的 useCallback
  // 内部，触发 React #321（Invalid hook call），使 restoreSelection 整个不可用——
  // 工具栏格式化、插图、手写全部连带失效。
  useEffect(() => {
    return () => {
      const node = editorRef.current;
      if (node && typeof node.blur === 'function') {
        try {
          node.blur();
        } catch (err) {
          /* 元素已分离：忽略 */
        }
      }
    };
  }, []);

  useEffect(() => {
    const onSelectionChange = () => {
      const el = editorRef.current;
      const selection = window.getSelection();
      if (!el || !selection || selection.rangeCount === 0) return;
      const range = selection.getRangeAt(0);
      if (el.contains(range.commonAncestorContainer)) {
        lastRangeRef.current = range.cloneRange();
      }
    };
    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, []);

  // --- undo / redo stack --------------------------------------------------

  const syncHistoryFlags = useCallback(() => {
    const history = historyRef.current;
    setHistoryFlags({ undo: canUndo(history), redo: canRedo(history) });
  }, []);

  /**
   * Push a snapshot immediately (no 300ms debounce). Used for discrete steps —
   * image insert, image resize, image delete — so one gesture is one undo.
   * An optional `snapshot` lets a caller record "the html before this step".
   */
  const pushHistoryNow = useCallback(
    (snapshot) => {
      if (historyTimerRef.current) {
        clearTimeout(historyTimerRef.current);
        historyTimerRef.current = null;
      }
      const el = editorRef.current;
      const html = typeof snapshot === 'string' ? snapshot : el ? el.innerHTML : null;
      // 空字符串是合法快照（清空内容也得能撤销/重做），只有拿不到 DOM 时才放弃。
      if (typeof html !== 'string') return;
      const next = historyPush(historyRef.current, html);
      if (next !== historyRef.current) {
        historyRef.current = next;
        syncHistoryFlags();
      }
    },
    [syncHistoryFlags],
  );

  const commitHistory = useCallback(() => {
    pushHistoryNow();
  }, [pushHistoryNow]);

  const scheduleHistory = useCallback(() => {
    if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
    // 防抖窗口里已经有「未提交的编辑」：撤销按钮必须立刻可用，否则用户
    // 打完第一个字就看到按钮是灰的（applyHistoryStep 会先 commitHistory
    // 再回退，所以此刻点撤销本来就是安全的）。
    setHistoryFlags((flags) => (flags.undo ? flags : { ...flags, undo: true }));
    historyTimerRef.current = setTimeout(() => {
      historyTimerRef.current = null;
      commitHistory();
    }, HISTORY_DELAY);
  }, [commitHistory]);

  // --- content changes ----------------------------------------------------

  const handleInput = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    htmlRef.current = el.innerHTML;
    setEmpty(isBlankHtml(htmlRef.current));
    // 内容变了 → 图片可能被挤到别处，让 overlay 重测一次。
    setContentRev((value) => value + 1);
    // 退格删掉选中的那张图：DOM 已断开就顺手清掉选择框，别留幽灵框。
    const selected = selectedImageRef.current;
    if (selected && selected.isConnected === false) {
      selectedImageRef.current = null;
      setSelectedImage(null);
    }
    scheduleSave('content');
    // IME composition: the intermediate pinyin must never enter the stack.
    if (!composingRef.current) scheduleHistory();
  }, [scheduleSave, scheduleHistory]);

  // --- image selection (double-click a picture, then drag a corner) -------

  const clearImageSelection = useCallback(() => {
    if (!selectedImageRef.current) return;
    selectedImageRef.current = null;
    setSelectedImage(null);
  }, []);

  const selectImage = useCallback((node) => {
    if (!node || node.isConnected === false) return;
    selectedImageRef.current = node;
    setSelectedImage(node);
    setContentRev((value) => value + 1);
  }, []);

  // 双击 <img> 进选中态。contenteditable 里的图片就是普通 <img>（工具栏/粘贴/
  // 拖入/手写画板插入的都是这个形状），没有额外包装节点可用。
  const handleDoubleClick = useCallback(
    (event) => {
      const el = editorRef.current;
      const target = event && event.target;
      if (!el || !target) return;
      if (String(target.tagName || '').toUpperCase() !== 'IMG') return;
      if (!el.contains(target)) return;
      if (event.cancelable) preventDefault(event);
      selectImage(target);
    },
    [selectImage],
  );

  // 点图片以外的地方 → 退出选中。用 capture 阶段监听，先于 contenteditable
  // 自己的 pointerdown 处理（否则浏览器会先把光标放进去）。
  useEffect(() => {
    if (!selectedImage) return undefined;
    const onPointerDown = (event) => {
      const node = selectedImageRef.current;
      const target = event && event.target;
      if (!node || !target) return;
      if (target === node || (typeof node.contains === 'function' && node.contains(target))) return;
      // overlay 里的手柄 / 删除按钮不算「点外面」。
      if (typeof target.closest === 'function' && target.closest('[data-sw-image-overlay]')) return;
      clearImageSelection();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [selectedImage, clearImageSelection]);

  const getMaxImageWidth = useCallback(() => editorContentWidth(editorRef.current), []);

  /**
   * 拖拽结束：只有这时才把尺寸交给保存链路。
   * 拖拽过程中每帧都写进 note.html 会让 400ms 防抖保存被高频重置，而且撤销栈
   * 会被拆成几十小步；一次手势记一步才对。
   */
  const handleImageResizeCommit = useCallback(() => {
    handleInput();
    pushHistoryNow();
  }, [handleInput, pushHistoryNow]);

  const handleImageDelete = useCallback(
    (node) => {
      const el = editorRef.current;
      if (!el || !node || node.isConnected === false) {
        clearImageSelection();
        return;
      }
      const before = el.innerHTML;
      node.remove();
      clearImageSelection();
      handleInput();
      // 先补上「删除前」再压「删除后」：否则撤销会跳过这张图，直接回到更早。
      pushHistoryNow(before);
      pushHistoryNow();
    },
    [clearImageSelection, handleInput, pushHistoryNow],
  );

  // --- images -------------------------------------------------------------

  const insertImageUrl = useCallback(
    (url) => {
      const el = editorRef.current;
      if (!el || !url) return;
      restoreSelection();

      const selection = window.getSelection();
      const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

      const img = document.createElement('img');
      img.setAttribute('src', url);
      img.setAttribute('alt', '');
      img.setAttribute('data-note-media', '1');
      img.setAttribute('style', IMG_STYLE);

      if (range && el.contains(range.commonAncestorContainer)) {
        // Insert at the caret — NOT appended to the end of the note.
        range.deleteContents();
        range.insertNode(img);
        if (selection) {
          const after = document.createRange();
          after.setStartAfter(img);
          after.collapse(true);
          selection.removeAllRanges();
          selection.addRange(after);
          lastRangeRef.current = after.cloneRange();
        }
      } else {
        el.appendChild(img);
        placeCaretAtEnd(el);
      }

      handleInput();
      // Media insertion is a discrete step: snapshot it immediately so the
      // image is undoable without waiting for the 300ms debounce.
      pushHistoryNow();
    },
    [restoreSelection, handleInput, pushHistoryNow],
  );

  const uploadAndInsert = useCallback(
    async (dataUrl) => {
      if (!dataUrl) return;
      const upload = uploadRef.current;
      if (typeof upload !== 'function') {
        setHint(t('editor.uploadUnavailable'));
        return;
      }
      setHint(t('editor.uploading'));
      try {
        const result = await upload(dataUrl);
        const url = result && result.url;
        if (!url) throw new Error(t('editor.uploadNoUrl'));
        insertImageUrl(url);
        setHint(null);
      } catch (err) {
        if (!mountedRef.current) return;
        setHint(t('editor.uploadFailedWith', { message: err && err.message ? err.message : String(err) }));
      }
    },
    [insertImageUrl],
  );

  const pickImage = useCallback(() => {
    saveSelection();
    const input = fileInputRef.current;
    if (input) input.click();
  }, [saveSelection]);

  const handleFileChange = useCallback(
    (event) => {
      const input = event.target;
      const file = input && input.files && input.files[0];
      if (input) input.value = ''; // allow re-picking the same file
      if (!file) return;
      saveSelection();
      readFileAsDataUrl(file)
        .then(uploadAndInsert)
        .catch(() => setHint(t('error.readImage')));
    },
    [saveSelection, uploadAndInsert],
  );

  const handlePaste = useCallback(
    (event) => {
      const files = collectImageFiles(event.clipboardData);
      if (files.length === 0) return; // plain text/html paste: let the browser do it
      event.preventDefault();
      saveSelection();
      readFileAsDataUrl(files[0])
        .then(uploadAndInsert)
        .catch(() => setHint(t('editor.readClipboardFailed')));
    },
    [saveSelection, uploadAndInsert],
  );

  const handleDragOver = useCallback((event) => {
    if (dragHasFiles(event.dataTransfer && event.dataTransfer.types)) preventDefault(event);
  }, []);

  const handleDrop = useCallback(
    (event) => {
      const files = collectImageFiles(event.dataTransfer);
      if (files.length === 0) return;
      event.preventDefault();

      // Drop where the pointer is, not wherever the caret last sat.
      const range = caretRangeFromPoint(event.clientX, event.clientY);
      const el = editorRef.current;
      if (range && el && el.contains(range.commonAncestorContainer)) {
        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(range);
          lastRangeRef.current = range.cloneRange();
        }
      } else {
        saveSelection();
      }

      readFileAsDataUrl(files[0])
        .then(uploadAndInsert)
        .catch(() => setHint(t('editor.readDropFailed')));
    },
    [saveSelection, uploadAndInsert],
  );

  // --- handwriting --------------------------------------------------------

  const openInk = useCallback(async () => {
    saveSelection();
    setInkError(null);
    setInkLoading(true);
    try {
      // ink.js may not exist yet while the plugin is being built; a failed
      // import must never take the editor down.
      const mod = await import('./ink.js');
      const component = mod && (mod.InkPad || mod.default);
      if (typeof component !== 'function') throw new Error(t('editor.inkNotExported'));
      inkComponentRef.current = component;
      inkOpenRef.current = true;
      setInkOpen(true);
    } catch (err) {
      console.error('[sticky-wall] ink pad load failed', err);
      setInkError(t('editor.inkLoadFailed'));
    } finally {
      if (mountedRef.current) setInkLoading(false);
    }
  }, [saveSelection]);

  const closeInk = useCallback(() => {
    inkOpenRef.current = false;
    setInkOpen(false);
  }, []);

  const handleInkDone = useCallback(
    async (dataUrl) => {
      closeInk();
      if (!dataUrl) return;
      // InkPad exports a transparent PNG when nothing was drawn — don't upload
      // (and insert) an invisible image.
      const hasInk = await dataUrlHasVisibleInk(dataUrl);
      if (!hasInk) {
        if (mountedRef.current) setHint(t('editor.inkEmpty'));
        return;
      }
      uploadAndInsert(dataUrl);
    },
    [closeInk, uploadAndInsert],
  );

  // --- toolbar commands ---------------------------------------------------

  const applyCommand = useCallback(
    (command, value) => {
      const el = editorRef.current;
      if (!el) return;
      restoreSelection();
      try {
        document.execCommand('styleWithCSS', false, 'false');
      } catch (err) {
        /* older engines: harmless */
      }
      let ok = false;
      try {
        ok = document.execCommand(command, false, value == null ? null : value);
      } catch (err) {
        ok = false;
      }
      el.focus();
      saveSelection();
      if (!ok) setHint(t('editor.formatUnsupported'));
      handleInput();
    },
    [restoreSelection, saveSelection, handleInput],
  );

  const toggleHeading = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    restoreSelection();
    let block = '';
    try {
      block = String(document.queryCommandValue('formatBlock') || '').toLowerCase();
    } catch (err) {
      block = '';
    }
    if (block === 'h2') applyCommand('formatBlock', 'P');
    else applyCommand('formatBlock', 'H2');
  }, [restoreSelection, applyCommand]);

  const clearFormatting = useCallback(() => {
    applyCommand('removeFormat');
  }, [applyCommand]);

  // --- undo / redo --------------------------------------------------------

  const applyHistoryStep = useCallback(
    (direction) => {
      // Fold any not-yet-committed typing into the stack first, otherwise the
      // step would jump over the user's latest edits.
      commitHistory();
      const base = historyRef.current;
      const next = direction === 'undo' ? historyUndo(base) : historyRedo(base);
      if (!next) {
        setHint(t(direction === 'undo' ? 'editor.nothingToUndo' : 'editor.nothingToRedo'));
        return;
      }
      historyRef.current = next;
      const html = currentSnapshot(next);
      const el = editorRef.current;
      if (el) {
        el.innerHTML = html;
        placeCaretAtEnd(el);
      }
      // 整块 innerHTML 被替换：旧图片节点已失效，选择框必须一起清掉。
      clearImageSelection();
      setContentRev((value) => value + 1);
      htmlRef.current = html;
      lastRangeRef.current = null;
      setEmpty(isBlankHtml(html));
      syncHistoryFlags();
      scheduleSave('content');
    },
    [commitHistory, clearImageSelection, scheduleSave, syncHistoryFlags],
  );

  const doUndo = useCallback(() => applyHistoryStep('undo'), [applyHistoryStep]);
  const doRedo = useCallback(() => applyHistoryStep('redo'), [applyHistoryStep]);

  // --- colours & alarm ----------------------------------------------------

  const persistMeta = useCallback(() => {
    // Existing note: colour/alarm changes go out immediately. A note that has
    // not been created yet waits for the normal debounce so a burst of clicks
    // cannot fire several creates.
    if (noteIdRef.current) emitNow('meta');
    else scheduleSave('meta');
  }, [emitNow, scheduleSave]);

  const applyBackground = useCallback(
    (value) => {
      const next = normalizeHexColor(value, colorRef.current);
      if (next === colorRef.current) return;
      colorRef.current = next;
      setColor(next);
      persistMeta();
    },
    [persistMeta],
  );

  const applyTextColor = useCallback(
    (value) => {
      const next = normalizeHexColor(value, textColorRef.current);
      if (next === textColorRef.current) return;
      textColorRef.current = next;
      setTextColor(next);
      persistMeta();
    },
    [persistMeta],
  );

  const handleAlarmInput = useCallback(
    (event) => {
      const next = localInputToMs(event.target.value);
      alarmRef.current = next;
      setAlarmAt(next);
      persistMeta();
    },
    [persistMeta],
  );

  const clearAlarm = useCallback(() => {
    if (alarmRef.current == null) return;
    alarmRef.current = null;
    setAlarmAt(null);
    persistMeta();
  }, [persistMeta]);

  // --- close & keys -------------------------------------------------------

  const handleClose = useCallback(() => {
    flushSave();
    const close = onCloseRef.current;
    if (typeof close === 'function') close();
  }, [flushSave]);

  const handleKeyDown = useCallback(
    (event) => {
      const target = event.target;
      const tag = target && target.tagName ? String(target.tagName).toUpperCase() : '';
      const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if (event.key === 'Escape') {
        preventDefault(event);
        // 层级：先关画板，再退图片选中，最后才是关编辑器 —— Esc 不该一步跳出全部。
        if (inkOpenRef.current) closeInk();
        else if (selectedImageRef.current) clearImageSelection();
        else handleClose();
        return;
      }
      if (inField) return;

      const mod = event.metaKey || event.ctrlKey;
      if (mod && String(event.key).toLowerCase() === 'z') {
        preventDefault(event);
        if (event.shiftKey) doRedo();
        else doUndo();
        return;
      }
      if (mod && String(event.key).toLowerCase() === 'y') {
        preventDefault(event);
        doRedo();
        return;
      }
      if (mod && String(event.key).toLowerCase() === 's') {
        preventDefault(event);
        flushSave();
      }
    },
    [closeInk, clearImageSelection, doRedo, doUndo, flushSave, handleClose],
  );

  // --- init: once per note identity ---------------------------------------

  useEffect(() => {
    const incomingHtml = note && typeof note.html === 'string' ? note.html : '';
    const nextColor = normalizeHexColor(note && note.color, DEFAULT_BG);
    const nextText = normalizeHexColor(note && note.textColor, DEFAULT_TEXT);
    const nextAlarm = typeof (note && note.alarmAt) === 'number' ? note.alarmAt : null;

    noteIdRef.current = noteId;
    colorRef.current = nextColor;
    textColorRef.current = nextText;
    alarmRef.current = nextAlarm;
    setColor(nextColor);
    setTextColor(nextText);
    setAlarmAt(nextAlarm);
    setInkError(null);
    setHint(null);
    inkOpenRef.current = false;
    setInkOpen(false);
    // 换便签：上一张便签的图片选择框必须立刻消失（DOM 节点属于旧内容）。
    clearImageSelection();

    const el = editorRef.current;
    const current = htmlRef.current || '';
    if (el && incomingHtml !== current) {
      // Only rewrite the DOM when the incoming note really differs (a freshly
      // created note echoes back what we just sent — rewriting would eat the
      // caret mid-typing).
      el.innerHTML = incomingHtml;
      htmlRef.current = incomingHtml;
    } else {
      htmlRef.current = incomingHtml;
    }

    historyRef.current = historyPush(createHistory(HISTORY_LIMIT), incomingHtml);
    syncHistoryFlags();
    lastEmittedRef.current = {
      html: incomingHtml,
      color: nextColor,
      textColor: nextText,
      alarmAt: nextAlarm,
    };
    setEmpty(isBlankHtml(incomingHtml));

    // Enter should produce <p> paragraphs in every engine we care about.
    try {
      document.execCommand('defaultParagraphSeparator', false, 'p');
    } catch (err) {
      /* not supported: browser default is fine */
    }
  }, [noteId, clearImageSelection, syncHistoryFlags]);

  // --- hint auto-dismiss --------------------------------------------------
  useEffect(() => {
    if (!hint) return undefined;
    const timer = setTimeout(() => {
      if (mountedRef.current) setHint(null);
    }, 2600);
    return () => clearTimeout(timer);
  }, [hint]);

  // --- render -------------------------------------------------------------

  const InkPad = inkOpen ? inkComponentRef.current : null;

  return (
    <div style={s.root} role="dialog" aria-label={t('editor.title')} onKeyDown={handleKeyDown}>
      <div style={s.header}>
        <div style={s.title}>
          {t('editor.title')}
          <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.6, marginLeft: 8, whiteSpace: 'nowrap' }}>{t('editor.autoSave')}</span>
        </div>

        <button
          type="button"
          style={{ ...s.closeButton, display: "inline-flex", alignItems: "center", gap: 6, paddingRight: 10 }}
          title={t('editor.saveHint')}
          aria-label={t('editor.saveAndClose')}
          onMouseDown={preventDefault}
          onClick={handleClose}
        >
          <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1 }}>×</span>
          <span style={{ fontSize: 12, opacity: 0.75, whiteSpace: "nowrap" }}>{t('editor.saveAndClose')}</span>
        </button>
      </div>

      <div style={s.toolbar}>
        <div style={toolRow}>
          <ToolButton label="B" title={t('editor.bold')} bold onPress={() => applyCommand('bold')} />
          <ToolButton label="I" title={t('editor.italic')} italic onPress={() => applyCommand('italic')} />
          <ToolButton
            label="U"
            title={t('editor.underline')}
            underline
            onPress={() => applyCommand('underline')}
          />
          <ToolButton label="S" title={t('editor.strike')} strike onPress={() => applyCommand('strikeThrough')} />
          <span style={dividerStyle} aria-hidden="true" />
          <ToolButton label="H2" title={t('editor.heading')} onPress={toggleHeading} />
          <ToolButton label={t('editor.clearFormat')} title={t('editor.clearFormat')} onPress={clearFormatting} />
        </div>
        <div style={toolRow}>
          <ToolButton label={t('editor.image')} title={t('editor.imageTip')} onPress={pickImage} />
          <ToolButton
            label={inkLoading ? t('editor.inkBusy') : t('editor.ink')}
            title={t('editor.inkPad')}
            onPress={openInk}
          />
          <span style={dividerStyle} aria-hidden="true" />
          <ToolButton
            label={t('editor.undo')}
            title={t('editor.undoTip')}
            onPress={doUndo}
            disabled={!historyFlags.undo}
          />
          <ToolButton
            label={t('editor.redo')}
            title={t('editor.redoTip')}
            onPress={doRedo}
            disabled={!historyFlags.redo}
          />
        </div>
        {inkError ? <div style={s.inlineError}>{inkError}</div> : null}
      </div>

      <div
        ref={canvasWrapRef}
        style={{ ...s.canvasWrap, background: color, color: textColor }}
        // 一滚就取消选中：选择框跟着内容滚出去以后，用户很难再注意到它。
        onScroll={clearImageSelection}
      >
        {empty ? (
          <div style={{ ...s.placeholder, color: textColor }} aria-hidden="true">
            {t('editor.placeholder')}
          </div>
        ) : null}
        <div
          ref={editorRef}
          className="dsh-sticky-wall-editor"
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label={t('editor.contentAria')}
          style={s.canvas}
          onInput={handleInput}
          onMouseUp={saveSelection}
          onKeyUp={saveSelection}
          onBlur={saveSelection}
          onDoubleClick={handleDoubleClick}
          onPaste={handlePaste}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onCompositionStart={() => {
            composingRef.current = true;
          }}
          onCompositionEnd={() => {
            composingRef.current = false;
            handleInput();
          }}
        />
        {selectedImage ? (
          <ImageResizeOverlay
            img={selectedImage}
            revision={contentRev}
            wrapRef={canvasWrapRef}
            maxWidth={getMaxImageWidth}
            onCommit={handleImageResizeCommit}
            onDelete={handleImageDelete}
            onDeselect={clearImageSelection}
          />
        ) : null}
      </div>

      <div style={s.footer}>
        <div style={s.footerRow}>
          <span style={s.label}>{t('editor.bgColor')}</span>
          {paletteList.map((option, index) => {
            const swatch = normalizeHexColor(option, '#ffffff');
            return (
              <button
                key={'bg-' + index + '-' + option}
                type="button"
                title={option}
                aria-label={t('editor.bgColorAria', { color: option })}
                onMouseDown={preventDefault}
                onClick={() => applyBackground(swatch)}
                style={{ ...swatchStyle(swatch === color), background: swatch }}
              />
            );
          })}
          <label style={s.colorPicker} title={t('editor.customBg')}>
            <input
              type="color"
              value={color}
              style={s.colorInput}
              onChange={(event) => applyBackground(event.target.value)}
            />
            {t('editor.custom')}
          </label>
        </div>

        <div style={s.footerRow}>
          <span style={s.label}>{t('editor.textColor')}</span>
          {DEFAULT_TEXT_SWATCHES.map((option) => {
            const swatch = normalizeHexColor(option, DEFAULT_TEXT);
            return (
              <button
                key={'fg-' + option}
                type="button"
                title={option}
                aria-label={t('editor.textColorAria', { color: option })}
                onMouseDown={preventDefault}
                onClick={() => applyTextColor(swatch)}
                style={{ ...swatchStyle(swatch === textColor), background: swatch }}
              />
            );
          })}
          <label style={s.colorPicker} title={t('editor.customText')}>
            <input
              type="color"
              value={textColor}
              style={s.colorInput}
              onChange={(event) => applyTextColor(event.target.value)}
            />
            {t('editor.custom')}
          </label>
        </div>

        <div style={s.footerRow}>
          <span style={s.label}>{t('editor.reminder')}</span>
          <input
            type="datetime-local"
            value={msToLocalInput(alarmAt)}
            style={fieldStyle}
            aria-label={t('editor.alarmTimeAria')}
            onChange={handleAlarmInput}
          />
          <button
            type="button"
            onMouseDown={preventDefault}
            onClick={clearAlarm}
            disabled={alarmAt == null}
            style={{ ...baseButton, fontSize: 12, opacity: alarmAt == null ? 0.42 : 1 }}
          >
            {t('editor.clearReminder')}
          </button>
        </div>

        {typeof onDeliver === "function" ? (
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
            <button
              type="button"
              style={{
                ...baseButton,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
              title={t('card.deliveryTipEmpty')}
              aria-label={t('deliver.title')}
              onClick={() => onDeliver(note)}
            >
              <span aria-hidden="true">📤</span>
              <span style={{ whiteSpace: "nowrap" }}>{t('deliver.title')}</span>
            </button>
          </div>
        ) : null}
      </div>

      {hint ? <div style={s.toast}>{hint}</div> : null}

      {/*
        InkPad is its own full-screen modal (`position: fixed; z-index: 80`),
        which would sit *below* the editor overlay (z-index 1200). Portal it to
        <body> inside a 1300 stacking context so it is always visible; it also
        captures Esc / Ctrl+Z itself, so the editor's key handler never sees
        them while the pad is open.
      */}
      {inkOpen && InkPad && typeof document !== 'undefined'
        ? createPortal(
            <div style={{ position: 'fixed', inset: 0, zIndex: 1300 }}>
              <InkPad
                width={440}
                height={280}
                color={textColor}
                onDone={handleInkDone}
                onCancel={closeInk}
              />
            </div>,
            document.body,
          )
        : null}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  );
}

export default NoteEditor;
