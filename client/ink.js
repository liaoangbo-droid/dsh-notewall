/**
 * 手写画板 — dsh-notewall
 *
 * 导出：InkPad({ width, height, color, onDone, onCancel })
 *
 * 设计要点：
 * - 全部 Pointer Events（鼠标 / 触屏 / 手写笔），`setPointerCapture` 保证移出画布不丢笔；
 * - 笔迹用二次贝塞尔「中点法」，stroke 栈保存归一化坐标，撤销 = 按栈重绘（不是像素快照）；
 * - 橡皮用 `destination-out`，背景始终透明，导出 PNG 贴到彩色便签上不会出现白块；
 * - 高分屏：canvas 像素尺寸 = CSS 尺寸 × devicePixelRatio，context 按 dpr 缩放；
 * - ResizeObserver 重采样：点存的是归一化坐标，尺寸变化后按比例重绘，内容不丢。
 *
 * 状态全部留在组件内部（useState / useRef），不依赖外部 store，不引入第三方依赖。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const DEFAULT_WIDTH = 640;
const DEFAULT_HEIGHT = 360;
const MAX_DPR = 4;
const MIN_DPR = 1;

/** 笔粗细（CSS 像素），三档。 */
const PEN_SIZES = [
  { id: 'thin', label: '细', px: 2 },
  { id: 'mid', label: '中', px: 4 },
  { id: 'bold', label: '粗', px: 8 },
];

/** 快捷色：黑 / 红 / 蓝 / 绿。 */
const QUICK_COLORS = [
  { id: 'ink', value: '#1f2430', label: '黑' },
  { id: 'red', value: '#e5484d', label: '红' },
  { id: 'blue', value: '#2f6feb', label: '蓝' },
  { id: 'green', value: '#2e9e5b', label: '绿' },
];

/* ---------------------------------- 主题色 --------------------------------- */

const T = {
  panelBg: 'var(--dsh-surface, rgba(20, 22, 26, 0.06))',
  text: 'var(--dsh-text-primary, inherit)',
  muted: 'var(--dsh-text-secondary, rgba(127, 127, 127, 0.95))',
  border: 'var(--dsh-border, rgba(127, 127, 127, 0.28))',
  soft: 'var(--dsh-surface, rgba(127, 127, 127, 0.10))',
  softHover: 'var(--dsh-surface, rgba(127, 127, 127, 0.18))',
  primary: '#3b82f6',
  primaryHover: '#2f74e6',
  danger: '#e5484d',
};

/* -------------------------------- 几何辅助 -------------------------------- */

function clamp(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function toPx(point, width, height) {
  return { x: point.x * width, y: point.y * height };
}

/**
 * 给 context 套上一笔的线型。stroke.sizeRel 是相对画布短边的比例，
 * 这样尺寸变化后线宽也按比例缩放。
 */
function applyStrokeStyle(ctx, stroke, width, height) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(0.75, stroke.sizeRel * Math.min(width, height));
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.globalCompositeOperation = stroke.erase ? 'destination-out' : 'source-over';
}

/**
 * 整笔重绘：二次贝塞尔中点法。
 * 1 个点画圆点；2 个点直连；3 个点以上逐段 quadraticCurveTo(控制点=原始点, 终点=相邻中点)。
 */
function drawStroke(ctx, stroke, width, height) {
  const points = stroke.points;
  if (!points || points.length === 0 || width <= 0 || height <= 0) return;

  const px = points.map((p) => toPx(p, width, height));
  ctx.save();
  applyStrokeStyle(ctx, stroke, width, height);

  if (px.length === 1) {
    ctx.beginPath();
    ctx.arc(px[0].x, px[0].y, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(px[0].x, px[0].y);
  for (let i = 1; i < px.length - 1; i += 1) {
    const mx = (px[i].x + px[i + 1].x) / 2;
    const my = (px[i].y + px[i + 1].y) / 2;
    ctx.quadraticCurveTo(px[i].x, px[i].y, mx, my);
  }
  const last = px[px.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
  ctx.restore();
}

/**
 * 实时落笔的单段绘制，与 drawStroke 的几何完全一致（只是增量画，避免每帧重绘整笔）：
 * 已经画到 pos，接着用控制点 points[i] 收到 points[i] 与 points[i+1] 的中点。
 */
function drawLiveSegment(ctx, stroke, points, index, width, height, pos) {
  const control = toPx(points[index], width, height);
  const next = toPx(points[index + 1], width, height);
  const midX = (control.x + next.x) / 2;
  const midY = (control.y + next.y) / 2;

  ctx.save();
  applyStrokeStyle(ctx, stroke, width, height);
  ctx.beginPath();
  ctx.moveTo(pos.x, pos.y);
  ctx.quadraticCurveTo(control.x, control.y, midX, midY);
  ctx.stroke();
  ctx.restore();

  pos.x = midX;
  pos.y = midY;
}

/** 单点轻触的落点由 round lineCap 的首端圆头承担，这里不再单独画。 */

/**
 * 把一个新采样点并入当前笔画，并画「上一段已确定」的增量曲线。
 * 与 drawStroke 的几何严格一致（同一控制点、同一终点），否则撤销重绘会跳笔。
 * @returns {boolean} 是否真的加入了新点（重复点会被丢弃）
 */
function pushLivePoint(ctx, live, px, py) {
  const points = live.stroke.points;
  const prev = points[points.length - 1];
  const nx = px / live.width;
  const ny = py / live.height;
  if (
    Math.abs(nx - prev.x) * live.width < 0.35 &&
    Math.abs(ny - prev.y) * live.height < 0.35
  ) {
    return false;
  }
  points.push({ x: nx, y: ny });

  const index = points.length - 2; // 能确定的最后一段控制点下标
  if (ctx && index >= 1) {
    drawLiveSegment(ctx, live.stroke, points, index, live.width, live.height, live.pos);
  }
  return true;
}

/** 收笔：把当前位置直线补到最后一个采样点，并更新 live.pos。 */
function finishLivePath(ctx, live) {
  const points = live.stroke.points;
  const last = toPx(points[points.length - 1], live.width, live.height);
  if (ctx) {
    ctx.save();
    applyStrokeStyle(ctx, live.stroke, live.width, live.height);
    ctx.beginPath();
    ctx.moveTo(live.pos.x, live.pos.y);
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
    ctx.restore();
  }
  live.pos = { x: last.x, y: last.y };
  return live.pos;
}

/* --------------------------------- 小组件 --------------------------------- */

function ToolButton({ active = false, disabled = false, onClick, title, children, style }) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={active || undefined}
      disabled={disabled}
      onClick={onClick}
      style={{
        appearance: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        minWidth: 32,
        height: 30,
        padding: '0 9px',
        borderRadius: 9,
        border: `1px solid ${active ? T.primary : T.border}`,
        background: active ? 'rgba(59, 130, 246, 0.16)' : T.soft,
        color: T.text,
        font: 'inherit',
        fontSize: 12,
        lineHeight: 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.42 : 1,
        transition: 'background 120ms ease, border-color 120ms ease',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function Swatch({ value, label, selected, onSelect }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={selected}
      onClick={onSelect}
      style={{
        appearance: 'none',
        width: 22,
        height: 22,
        padding: 0,
        borderRadius: 999,
        border: `2px solid ${selected ? T.primary : 'transparent'}`,
        background: value,
        boxShadow: 'inset 0 0 0 1px rgba(127,127,127,0.45)',
        cursor: 'pointer',
        outline: 'none',
      }}
    />
  );
}

/* ------------------------------- 主组件 ---------------------------------- */

export function InkPad({ width, height, color, onDone, onCancel }) {
  const suggestedWidth = Number.isFinite(width) && width > 0 ? width : DEFAULT_WIDTH;
  const suggestedHeight = Number.isFinite(height) && height > 0 ? height : DEFAULT_HEIGHT;

  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);

  /** 已完成的笔画栈：{ color, erase, sizeRel, points:[{x,y}] (归一化), minDim } */
  const strokesRef = useRef([]);
  /** 正在画的那一笔（含光标位置、已绘制到第几段）。 */
  const liveRef = useRef(null);
  /** 当前 CSS 尺寸与 dpr。 */
  const sizeRef = useRef({ width: suggestedWidth, height: suggestedHeight, dpr: 1 });

  const [strokeCount, setStrokeCount] = useState(0);
  const [drawing, setDrawing] = useState(false);

  const initialColor = (typeof color === 'string' && color.trim()) || QUICK_COLORS[0].value;
  const [penColor, setPenColor] = useState(initialColor);
  const [penSize, setPenSize] = useState(PEN_SIZES[1].px);
  const [eraser, setEraser] = useState(false);

  useEffect(() => {
    if (typeof color === 'string' && color.trim()) setPenColor(color);
  }, [color]);

  const swatches = useMemo(() => {
    const list = QUICK_COLORS.slice();
    if (!list.some((item) => item.value.toLowerCase() === initialColor.toLowerCase())) {
      list.unshift({ id: 'note', value: initialColor, label: '原色' });
    }
    return list;
  }, [initialColor]);

  const panelWidth = clamp(suggestedWidth, 280, 960);
  const panelHeight = clamp(suggestedHeight, 220, 720);

  /* ------------------------------ 画布重绘 ------------------------------ */

  const redrawAll = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    const { width: w, height: h } = sizeRef.current;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    for (const stroke of strokesRef.current) drawStroke(ctx, stroke, w, h);
    // 正在画的笔也补上，避免尺寸变化时「画到一半」的内容被清掉
    if (liveRef.current) drawStroke(ctx, liveRef.current.stroke, w, h);
  }, []);

  /** 依据容器 CSS 尺寸重新设置像素缓冲（× dpr）与 transform，然后按比例重绘。 */
  const syncCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const rect = wrap.getBoundingClientRect();
    const cssW = Math.max(1, Math.round(rect.width || 0));
    const cssH = Math.max(1, Math.round(rect.height || 0));
    const rawDpr = typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1;
    const dpr = clamp(rawDpr, MIN_DPR, MAX_DPR);

    const prev = sizeRef.current;
    const bufW = Math.max(1, Math.round(cssW * dpr));
    const bufH = Math.max(1, Math.round(cssH * dpr));
    const bufferChanged = canvas.width !== bufW || canvas.height !== bufH;
    const geometryChanged = prev.width !== cssW || prev.height !== cssH || prev.dpr !== dpr;

    if (!bufferChanged && !geometryChanged) return;

    sizeRef.current = { width: cssW, height: cssH, dpr };
    if (bufferChanged) {
      canvas.width = bufW;
      canvas.height = bufH;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctxRef.current = ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    redrawAll();
  }, [redrawAll]);

  useEffect(() => {
    syncCanvasSize();

    const wrap = wrapRef.current;
    let observer = null;
    if (wrap && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => syncCanvasSize());
      observer.observe(wrap);
    }

    // ResizeObserver 不覆盖「窗口在显示器之间移动导致 dpr 变化」的情况
    const onWindowResize = () => syncCanvasSize();
    window.addEventListener('resize', onWindowResize);
    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener('resize', onWindowResize);
    };
  }, [syncCanvasSize]);

  /* -------------------------------- 笔迹操作 ------------------------------ */

  const commitLive = useCallback(() => {
    const live = liveRef.current;
    const ctx = ctxRef.current;
    if (!live) return;

    if (ctx) finishLivePath(ctx, live);

    strokesRef.current.push(live.stroke);
    liveRef.current = null;
    setDrawing(false);
    setStrokeCount(strokesRef.current.length);
  }, []);

  const undo = useCallback(() => {
    if (liveRef.current) commitLive();
    if (strokesRef.current.length === 0) return;
    strokesRef.current.pop();
    redrawAll();
    setStrokeCount(strokesRef.current.length);
  }, [commitLive, redrawAll]);

  const clearAll = useCallback(() => {
    liveRef.current = null;
    strokesRef.current = [];
    redrawAll();
    setDrawing(false);
    setStrokeCount(0);
  }, [redrawAll]);

  const finish = useCallback(() => {
    if (liveRef.current) commitLive();
    const canvas = canvasRef.current;
    if (!canvas || typeof onDone !== 'function') return;
    let dataUrl = '';
    try {
      dataUrl = canvas.toDataURL('image/png');
    } catch {
      dataUrl = '';
    }
    onDone(dataUrl);
  }, [commitLive, onDone]);

  const cancel = useCallback(() => {
    if (typeof onCancel === 'function') onCancel();
  }, [onCancel]);

  /* ------------------------------- 指针事件 ------------------------------ */

  const handlePointerDown = useCallback(
    (event) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      if (liveRef.current) return; // 只跟第一根指针走，多指忽略

      const rect = canvas.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;

      if (event.cancelable) event.preventDefault();
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        /* 某些环境不支持捕获，退化为普通 pointermove */
      }

      let ctx = ctxRef.current;
      if (!ctx) {
        ctx = canvas.getContext('2d');
        ctxRef.current = ctx;
      }
      if (!ctx) return;

      sizeRef.current = { ...sizeRef.current, width: rect.width, height: rect.height };

      const w = rect.width;
      const h = rect.height;
      const px = clamp(event.clientX - rect.left, 0, w);
      const py = clamp(event.clientY - rect.top, 0, h);
      const minDim = Math.max(1, Math.min(w, h));

      const stroke = {
        color: penColor,
        erase: eraser,
        sizeRel: penSize / minDim,
        points: [{ x: px / w, y: py / h }],
      };

      liveRef.current = {
        stroke,
        width: w,
        height: h,
        pos: { x: px, y: py },
        pointerId: event.pointerId,
      };
      setDrawing(true);

      // 单点也要有笔迹：先落一个圆点，后续曲线从它继续
      ctx.save();
      applyStrokeStyle(ctx, stroke, w, h);
      ctx.beginPath();
      ctx.arc(px, py, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
    [eraser, penColor, penSize],
  );

  const handlePointerMove = useCallback((event) => {
    const live = liveRef.current;
    if (!live || live.pointerId !== event.pointerId) return;

    // 鼠标左右键状态异常（例如在画布外松手）时收笔，避免「粘笔」
    if (event.pointerType === 'mouse' && event.buttons === 0) {
      commitLive();
      return;
    }
    if (event.cancelable) event.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;

    const w = live.width;
    const h = live.height;
    const px = clamp(event.clientX - rect.left, 0, w);
    const py = clamp(event.clientY - rect.top, 0, h);

    pushLivePoint(ctxRef.current, live, px, py);
  }, [commitLive]);

  const handlePointerEnd = useCallback(
    (event) => {
      const live = liveRef.current;
      if (!live) return;
      if (event && typeof event.pointerId === 'number' && live.pointerId !== event.pointerId) return;

      const canvas = canvasRef.current;
      if (canvas && event && typeof event.pointerId === 'number') {
        try {
          canvas.releasePointerCapture(event.pointerId);
        } catch {
          /* 已自动释放 */
        }
      }
      commitLive();
    },
    [commitLive],
  );

  /* ------------------------------- 键盘快捷键 ---------------------------- */

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        if (event.cancelable) event.preventDefault();
        cancel();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && (event.key === 'z' || event.key === 'Z')) {
        event.stopPropagation();
        if (event.cancelable) event.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [cancel, undo]);

  /* -------------------------------- 渲染 -------------------------------- */

  const hasInk = strokeCount > 0;
  const hintVisible = !hasInk && !drawing;

  return (
    <div
      role="presentation"
      onPointerDown={(event) => {
        // 点遮罩空白处不关闭，避免误触丢掉画好的内容
        if (event.target === event.currentTarget) event.preventDefault();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        display: 'grid',
        placeItems: 'center',
        padding: 16,
        background: 'rgba(15, 17, 21, 0.44)',
        backdropFilter: 'blur(2px)',
      }}
    >
      <div
        role="dialog"
        aria-label="手写画板"
        aria-modal="true"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          width: `min(${panelWidth}px, 94vw)`,
          height: `min(${panelHeight + 210}px, 92vh)`,
          maxHeight: '92vh',
          padding: 14,
          borderRadius: 16,
          border: `1px solid ${T.border}`,
          background: T.panelBg,
          color: T.text,
          boxShadow: '0 18px 56px rgba(0, 0, 0, 0.28)',
          fontFamily: 'inherit',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          boxSizing: 'border-box',
        }}
      >
        {/* 头部 */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: 0.2 }}>手写</div>
          <div style={{ fontSize: 12, color: T.muted }}>用鼠标 / 手指 / 手写笔都可以</div>
          <div style={{ marginLeft: 'auto', fontSize: 12, color: T.muted }}>
            {hasInk ? `${strokeCount} 笔` : '空白'}
          </div>
        </div>

        {/* 工具条 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {PEN_SIZES.map((size) => (
              <ToolButton
                key={size.id}
                title={`笔画：${size.label}`}
                active={!eraser && penSize === size.px}
                onClick={() => {
                  setEraser(false);
                  setPenSize(size.px);
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: 'inline-block',
                    width: 16,
                    height: size.px,
                    borderRadius: 999,
                    background: T.text,
                    opacity: 0.85,
                  }}
                />
                <span style={{ fontSize: 11 }}>{size.label}</span>
              </ToolButton>
            ))}
          </div>

          <div style={{ width: 1, height: 22, background: T.border, margin: '0 2px' }} />

          <ToolButton title="橡皮：擦掉笔迹" active={eraser} onClick={() => setEraser((v) => !v)}>
            橡皮
          </ToolButton>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 2 }}>
            {swatches.map((item) => (
              <Swatch
                key={item.id}
                value={item.value}
                label={`颜色：${item.label}`}
                selected={!eraser && penColor.toLowerCase() === item.value.toLowerCase()}
                onSelect={() => {
                  setEraser(false);
                  setPenColor(item.value);
                }}
              />
            ))}
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            <ToolButton title="撤销上一笔（Ctrl/Cmd + Z）" disabled={!hasInk && !drawing} onClick={undo}>
              撤销
            </ToolButton>
            <ToolButton
              title="清空整块画板"
              disabled={!hasInk && !drawing}
              onClick={clearAll}
              style={{ color: hasInk || drawing ? T.danger : T.muted }}
            >
              清空
            </ToolButton>
          </div>
        </div>

        {/* 画布 */}
        <div
          ref={wrapRef}
          style={{
            position: 'relative',
            flex: '1 1 auto',
            minHeight: 160,
            width: '100%',
            borderRadius: 12,
            border: `1px dashed ${T.border}`,
            background:
              'repeating-conic-gradient(rgba(127, 127, 127, 0.10) 0% 25%, transparent 0% 50%) 50% / 16px 16px',
            overflow: 'hidden',
            touchAction: 'none',
            overscrollBehavior: 'contain',
          }}
        >
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            onLostPointerCapture={handlePointerEnd}
            style={{
              display: 'block',
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              touchAction: 'none',
              cursor: eraser ? 'cell' : 'crosshair',
              background: 'transparent',
            }}
          />
          {hintVisible ? (
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: 0,
                display: 'grid',
                placeItems: 'center',
                pointerEvents: 'none',
                fontSize: 13,
                color: T.muted,
              }}
            >
              在这里写写画画（背景透明，导出 PNG 不带白底）
            </div>
          ) : null}
        </div>

        {/* 底部操作 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 11, color: T.muted }}>Esc 取消 · Ctrl/Cmd + Z 撤销</div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <ToolButton title="放弃这次手写" onClick={cancel} style={{ height: 32, padding: '0 14px' }}>
              取消
            </ToolButton>
            <ToolButton
              title="把笔迹转成 PNG 插入便签"
              onClick={finish}
              style={{
                height: 32,
                padding: '0 16px',
                border: `1px solid ${T.primary}`,
                background: T.primary,
                color: '#ffffff',
                fontWeight: 600,
              }}
            >
              完成
            </ToolButton>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InkPad;
