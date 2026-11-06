function __dshStickyReport(where, error) {
  try { console.error("[dsh-notewall] " + where + " failed:", error); } catch (_) {}
  try {
    if (typeof fetch !== "function") return;
    var text = String((error && (error.stack || error.message)) || error || "unknown").slice(0, 4000);
    void fetch("/sticky-wall/__diag?where=" + encodeURIComponent(where) + "&msg=" + encodeURIComponent(text), { cache: "no-store" }).catch(function () {});
  } catch (_) {}
}
window.__ModuleLoader__.load({ id: "dsh-notewall", factory: (require) => {
try {
var module = { exports: {} }; var exports = module.exports;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// client/ink.js
var ink_exports = {};
__export(ink_exports, {
  InkPad: () => InkPad,
  default: () => ink_default
});
function clamp(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
function toPx(point, width, height) {
  return { x: point.x * width, y: point.y * height };
}
function applyStrokeStyle(ctx, stroke, width, height) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(0.75, stroke.sizeRel * Math.min(width, height));
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.globalCompositeOperation = stroke.erase ? "destination-out" : "source-over";
}
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
function pushLivePoint(ctx, live, px, py) {
  const points = live.stroke.points;
  const prev = points[points.length - 1];
  const nx = px / live.width;
  const ny = py / live.height;
  if (Math.abs(nx - prev.x) * live.width < 0.35 && Math.abs(ny - prev.y) * live.height < 0.35) {
    return false;
  }
  points.push({ x: nx, y: ny });
  const index = points.length - 2;
  if (ctx && index >= 1) {
    drawLiveSegment(ctx, live.stroke, points, index, live.width, live.height, live.pos);
  }
  return true;
}
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
function ToolButton({ active = false, disabled = false, onClick, title, children, style }) {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
    "button",
    {
      type: "button",
      title,
      "aria-pressed": active || void 0,
      disabled,
      onClick,
      style: {
        appearance: "none",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        minWidth: 32,
        height: 30,
        padding: "0 9px",
        borderRadius: 9,
        border: `1px solid ${active ? T.primary : T.border}`,
        background: active ? "rgba(59, 130, 246, 0.16)" : T.soft,
        color: T.text,
        font: "inherit",
        fontSize: 12,
        lineHeight: 1,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.42 : 1,
        transition: "background 120ms ease, border-color 120ms ease",
        ...style
      },
      children
    }
  );
}
function Swatch({ value, label, selected, onSelect }) {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
    "button",
    {
      type: "button",
      title: label,
      "aria-label": label,
      "aria-pressed": selected,
      onClick: onSelect,
      style: {
        appearance: "none",
        width: 22,
        height: 22,
        padding: 0,
        borderRadius: 999,
        border: `2px solid ${selected ? T.primary : "transparent"}`,
        background: value,
        boxShadow: "inset 0 0 0 1px rgba(127,127,127,0.45)",
        cursor: "pointer",
        outline: "none"
      }
    }
  );
}
function InkPad({ width, height, color, onDone, onCancel }) {
  const suggestedWidth = Number.isFinite(width) && width > 0 ? width : DEFAULT_WIDTH;
  const suggestedHeight = Number.isFinite(height) && height > 0 ? height : DEFAULT_HEIGHT;
  const wrapRef = (0, import_react3.useRef)(null);
  const canvasRef = (0, import_react3.useRef)(null);
  const ctxRef = (0, import_react3.useRef)(null);
  const strokesRef = (0, import_react3.useRef)([]);
  const liveRef = (0, import_react3.useRef)(null);
  const sizeRef = (0, import_react3.useRef)({ width: suggestedWidth, height: suggestedHeight, dpr: 1 });
  const [strokeCount, setStrokeCount] = (0, import_react3.useState)(0);
  const [drawing, setDrawing] = (0, import_react3.useState)(false);
  const initialColor = typeof color === "string" && color.trim() || QUICK_COLORS[0].value;
  const [penColor, setPenColor] = (0, import_react3.useState)(initialColor);
  const [penSize, setPenSize] = (0, import_react3.useState)(PEN_SIZES[1].px);
  const [eraser, setEraser] = (0, import_react3.useState)(false);
  (0, import_react3.useEffect)(() => {
    if (typeof color === "string" && color.trim()) setPenColor(color);
  }, [color]);
  const swatches = (0, import_react3.useMemo)(() => {
    const list = QUICK_COLORS.slice();
    if (!list.some((item) => item.value.toLowerCase() === initialColor.toLowerCase())) {
      list.unshift({ id: "note", value: initialColor, label: "\u539F\u8272" });
    }
    return list;
  }, [initialColor]);
  const panelWidth = clamp(suggestedWidth, 280, 960);
  const panelHeight = clamp(suggestedHeight, 220, 720);
  const redrawAll = (0, import_react3.useCallback)(() => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    const { width: w, height: h } = sizeRef.current;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    for (const stroke of strokesRef.current) drawStroke(ctx, stroke, w, h);
    if (liveRef.current) drawStroke(ctx, liveRef.current.stroke, w, h);
  }, []);
  const syncCanvasSize = (0, import_react3.useCallback)(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    const cssW = Math.max(1, Math.round(rect.width || 0));
    const cssH = Math.max(1, Math.round(rect.height || 0));
    const rawDpr = typeof window !== "undefined" && window.devicePixelRatio ? window.devicePixelRatio : 1;
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
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctxRef.current = ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    redrawAll();
  }, [redrawAll]);
  (0, import_react3.useEffect)(() => {
    syncCanvasSize();
    const wrap = wrapRef.current;
    let observer = null;
    if (wrap && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => syncCanvasSize());
      observer.observe(wrap);
    }
    const onWindowResize = () => syncCanvasSize();
    window.addEventListener("resize", onWindowResize);
    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener("resize", onWindowResize);
    };
  }, [syncCanvasSize]);
  const commitLive = (0, import_react3.useCallback)(() => {
    const live = liveRef.current;
    const ctx = ctxRef.current;
    if (!live) return;
    if (ctx) finishLivePath(ctx, live);
    strokesRef.current.push(live.stroke);
    liveRef.current = null;
    setDrawing(false);
    setStrokeCount(strokesRef.current.length);
  }, []);
  const undo = (0, import_react3.useCallback)(() => {
    if (liveRef.current) commitLive();
    if (strokesRef.current.length === 0) return;
    strokesRef.current.pop();
    redrawAll();
    setStrokeCount(strokesRef.current.length);
  }, [commitLive, redrawAll]);
  const clearAll = (0, import_react3.useCallback)(() => {
    liveRef.current = null;
    strokesRef.current = [];
    redrawAll();
    setDrawing(false);
    setStrokeCount(0);
  }, [redrawAll]);
  const finish = (0, import_react3.useCallback)(() => {
    if (liveRef.current) commitLive();
    const canvas = canvasRef.current;
    if (!canvas || typeof onDone !== "function") return;
    let dataUrl = "";
    try {
      dataUrl = canvas.toDataURL("image/png");
    } catch {
      dataUrl = "";
    }
    onDone(dataUrl);
  }, [commitLive, onDone]);
  const cancel = (0, import_react3.useCallback)(() => {
    if (typeof onCancel === "function") onCancel();
  }, [onCancel]);
  const handlePointerDown = (0, import_react3.useCallback)(
    (event) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (liveRef.current) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      if (event.cancelable) event.preventDefault();
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
      }
      let ctx = ctxRef.current;
      if (!ctx) {
        ctx = canvas.getContext("2d");
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
        points: [{ x: px / w, y: py / h }]
      };
      liveRef.current = {
        stroke,
        width: w,
        height: h,
        pos: { x: px, y: py },
        pointerId: event.pointerId
      };
      setDrawing(true);
      ctx.save();
      applyStrokeStyle(ctx, stroke, w, h);
      ctx.beginPath();
      ctx.arc(px, py, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
    [eraser, penColor, penSize]
  );
  const handlePointerMove = (0, import_react3.useCallback)((event) => {
    const live = liveRef.current;
    if (!live || live.pointerId !== event.pointerId) return;
    if (event.pointerType === "mouse" && event.buttons === 0) {
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
  const handlePointerEnd = (0, import_react3.useCallback)(
    (event) => {
      const live = liveRef.current;
      if (!live) return;
      if (event && typeof event.pointerId === "number" && live.pointerId !== event.pointerId) return;
      const canvas = canvasRef.current;
      if (canvas && event && typeof event.pointerId === "number") {
        try {
          canvas.releasePointerCapture(event.pointerId);
        } catch {
        }
      }
      commitLive();
    },
    [commitLive]
  );
  (0, import_react3.useEffect)(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        if (event.cancelable) event.preventDefault();
        cancel();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && (event.key === "z" || event.key === "Z")) {
        event.stopPropagation();
        if (event.cancelable) event.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [cancel, undo]);
  const hasInk = strokeCount > 0;
  const hintVisible = !hasInk && !drawing;
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
    "div",
    {
      role: "presentation",
      onPointerDown: (event) => {
        if (event.target === event.currentTarget) event.preventDefault();
      },
      style: {
        position: "fixed",
        inset: 0,
        zIndex: 80,
        display: "grid",
        placeItems: "center",
        padding: 16,
        background: "rgba(15, 17, 21, 0.44)",
        backdropFilter: "blur(2px)"
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
        "div",
        {
          role: "dialog",
          "aria-label": "\u624B\u5199\u753B\u677F",
          "aria-modal": "true",
          style: {
            display: "flex",
            flexDirection: "column",
            gap: 10,
            width: `min(${panelWidth}px, 94vw)`,
            height: `min(${panelHeight + 210}px, 92vh)`,
            maxHeight: "92vh",
            padding: 14,
            borderRadius: 16,
            border: `1px solid ${T.border}`,
            background: T.panelBg,
            color: T.text,
            boxShadow: "0 18px 56px rgba(0, 0, 0, 0.28)",
            fontFamily: "inherit",
            userSelect: "none",
            WebkitUserSelect: "none",
            boxSizing: "border-box"
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { fontSize: 15, fontWeight: 600, letterSpacing: 0.2 }, children: "\u624B\u5199" }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { fontSize: 12, color: T.muted }, children: "\u7528\u9F20\u6807 / \u624B\u6307 / \u624B\u5199\u7B14\u90FD\u53EF\u4EE5" }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { marginLeft: "auto", fontSize: 12, color: T.muted }, children: hasInk ? `${strokeCount} \u7B14` : "\u7A7A\u767D" })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { display: "flex", alignItems: "center", gap: 4 }, children: PEN_SIZES.map((size) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
                ToolButton,
                {
                  title: `\u7B14\u753B\uFF1A${size.label}`,
                  active: !eraser && penSize === size.px,
                  onClick: () => {
                    setEraser(false);
                    setPenSize(size.px);
                  },
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                      "span",
                      {
                        "aria-hidden": "true",
                        style: {
                          display: "inline-block",
                          width: 16,
                          height: size.px,
                          borderRadius: 999,
                          background: T.text,
                          opacity: 0.85
                        }
                      }
                    ),
                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { fontSize: 11 }, children: size.label })
                  ]
                },
                size.id
              )) }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { width: 1, height: 22, background: T.border, margin: "0 2px" } }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(ToolButton, { title: "\u6A61\u76AE\uFF1A\u64E6\u6389\u7B14\u8FF9", active: eraser, onClick: () => setEraser((v) => !v), children: "\u6A61\u76AE" }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { display: "flex", alignItems: "center", gap: 6, marginLeft: 2 }, children: swatches.map((item) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                Swatch,
                {
                  value: item.value,
                  label: `\u989C\u8272\uFF1A${item.label}`,
                  selected: !eraser && penColor.toLowerCase() === item.value.toLowerCase(),
                  onSelect: () => {
                    setEraser(false);
                    setPenColor(item.value);
                  }
                },
                item.id
              )) }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(ToolButton, { title: "\u64A4\u9500\u4E0A\u4E00\u7B14\uFF08Ctrl/Cmd + Z\uFF09", disabled: !hasInk && !drawing, onClick: undo, children: "\u64A4\u9500" }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                  ToolButton,
                  {
                    title: "\u6E05\u7A7A\u6574\u5757\u753B\u677F",
                    disabled: !hasInk && !drawing,
                    onClick: clearAll,
                    style: { color: hasInk || drawing ? T.danger : T.muted },
                    children: "\u6E05\u7A7A"
                  }
                )
              ] })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
              "div",
              {
                ref: wrapRef,
                style: {
                  position: "relative",
                  flex: "1 1 auto",
                  minHeight: 160,
                  width: "100%",
                  borderRadius: 12,
                  border: `1px dashed ${T.border}`,
                  background: "repeating-conic-gradient(rgba(127, 127, 127, 0.10) 0% 25%, transparent 0% 50%) 50% / 16px 16px",
                  overflow: "hidden",
                  touchAction: "none",
                  overscrollBehavior: "contain"
                },
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                    "canvas",
                    {
                      ref: canvasRef,
                      onPointerDown: handlePointerDown,
                      onPointerMove: handlePointerMove,
                      onPointerUp: handlePointerEnd,
                      onPointerCancel: handlePointerEnd,
                      onLostPointerCapture: handlePointerEnd,
                      style: {
                        display: "block",
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        touchAction: "none",
                        cursor: eraser ? "cell" : "crosshair",
                        background: "transparent"
                      }
                    }
                  ),
                  hintVisible ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                    "div",
                    {
                      "aria-hidden": "true",
                      style: {
                        position: "absolute",
                        inset: 0,
                        display: "grid",
                        placeItems: "center",
                        pointerEvents: "none",
                        fontSize: 13,
                        color: T.muted
                      },
                      children: "\u5728\u8FD9\u91CC\u5199\u5199\u753B\u753B\uFF08\u80CC\u666F\u900F\u660E\uFF0C\u5BFC\u51FA PNG \u4E0D\u5E26\u767D\u5E95\uFF09"
                    }
                  ) : null
                ]
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { fontSize: 11, color: T.muted }, children: "Esc \u53D6\u6D88 \xB7 Ctrl/Cmd + Z \u64A4\u9500" }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { marginLeft: "auto", display: "flex", gap: 8 }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(ToolButton, { title: "\u653E\u5F03\u8FD9\u6B21\u624B\u5199", onClick: cancel, style: { height: 32, padding: "0 14px" }, children: "\u53D6\u6D88" }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                  ToolButton,
                  {
                    title: "\u628A\u7B14\u8FF9\u8F6C\u6210 PNG \u63D2\u5165\u4FBF\u7B7E",
                    onClick: finish,
                    style: {
                      height: 32,
                      padding: "0 16px",
                      border: `1px solid ${T.primary}`,
                      background: T.primary,
                      color: "#ffffff",
                      fontWeight: 600
                    },
                    children: "\u5B8C\u6210"
                  }
                )
              ] })
            ] })
          ]
        }
      )
    }
  );
}
var import_react3, import_jsx_runtime3, DEFAULT_WIDTH, DEFAULT_HEIGHT, MAX_DPR, MIN_DPR, PEN_SIZES, QUICK_COLORS, T, ink_default;
var init_ink = __esm({
  "client/ink.js"() {
    import_react3 = require("react");
    import_jsx_runtime3 = require("react/jsx-runtime");
    DEFAULT_WIDTH = 640;
    DEFAULT_HEIGHT = 360;
    MAX_DPR = 4;
    MIN_DPR = 1;
    PEN_SIZES = [
      { id: "thin", label: "\u7EC6", px: 2 },
      { id: "mid", label: "\u4E2D", px: 4 },
      { id: "bold", label: "\u7C97", px: 8 }
    ];
    QUICK_COLORS = [
      { id: "ink", value: "#1f2430", label: "\u9ED1" },
      { id: "red", value: "#e5484d", label: "\u7EA2" },
      { id: "blue", value: "#2f6feb", label: "\u84DD" },
      { id: "green", value: "#2e9e5b", label: "\u7EFF" }
    ];
    T = {
      panelBg: "var(--dsh-surface, rgba(20, 22, 26, 0.06))",
      text: "var(--dsh-text-primary, inherit)",
      muted: "var(--dsh-text-secondary, rgba(127, 127, 127, 0.95))",
      border: "var(--dsh-border, rgba(127, 127, 127, 0.28))",
      soft: "var(--dsh-surface, rgba(127, 127, 127, 0.10))",
      softHover: "var(--dsh-surface, rgba(127, 127, 127, 0.18))",
      primary: "#3b82f6",
      primaryHover: "#2f74e6",
      danger: "#e5484d"
    };
    ink_default = InkPad;
  }
});

// client/index.js
var index_exports = {};
__export(index_exports, {
  AlarmDock: () => AlarmDock,
  PANEL_ID: () => PANEL_ID,
  StickyWallIcon: () => StickyWallIcon,
  StickyWallPage: () => StickyWallPage,
  apply: () => apply,
  default: () => index_default,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);
var import_react7 = require("react");

// client/rich.js
var IMG_STYLE = "max-width:100%; border-radius:6px; display:block; margin:6px 0;";
var DEFAULT_PALETTE = [
  "#fff3a3",
  "#ffe0b2",
  "#ffd6e0",
  "#e3f2d9",
  "#d8f0f5",
  "#e6e0f8",
  "#f3f4f6",
  "#ffffff"
];
var DEFAULT_TEXT_SWATCHES = [
  "#1f2430",
  "#5b6472",
  "#8a4b08",
  "#1d4ed8",
  "#b42318",
  "#0f766e",
  "#ffffff"
];
var HTML_ESCAPES = Object.freeze({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
});
function stripTags(html) {
  return String(html == null ? "" : html).replace(/<br\s*\/?>/gi, " ").replace(/<\/(p|div|li|h[1-6]|blockquote|tr|td|th)>/gi, " ").replace(/<[^>]*>/g, "").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;/g, "'");
}
function hasImage(html) {
  return /<img\b/i.test(String(html == null ? "" : html));
}
function isBlankHtml(html) {
  if (hasImage(html)) return false;
  const text = stripTags(html).replace(/[\s\u200b\ufeff\u00a0]+/g, "");
  return text.length === 0;
}
function createHistory(limit = 100) {
  const size = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 100;
  return { entries: [], index: -1, limit: size };
}
function currentSnapshot(history) {
  if (!history || !history.entries || history.index < 0) return "";
  const value = history.entries[history.index];
  return typeof value === "string" ? value : "";
}
function historyPush(history, snapshot) {
  const base = history && Array.isArray(history.entries) ? history : createHistory();
  if (typeof snapshot !== "string") return base;
  if (base.index >= 0 && base.entries[base.index] === snapshot) return base;
  const entries = base.entries.slice(0, base.index + 1);
  entries.push(snapshot);
  while (entries.length > base.limit) entries.shift();
  return { entries, index: entries.length - 1, limit: base.limit };
}
function canUndo(history) {
  return !!history && Array.isArray(history.entries) && history.index > 0;
}
function canRedo(history) {
  return !!history && Array.isArray(history.entries) && history.index >= 0 && history.index < history.entries.length - 1;
}
function historyUndo(history) {
  if (!canUndo(history)) return null;
  return { entries: history.entries, index: history.index - 1, limit: history.limit };
}
function historyRedo(history) {
  if (!canRedo(history)) return null;
  return { entries: history.entries, index: history.index + 1, limit: history.limit };
}
function pad2(value) {
  return value < 10 ? "0" + value : String(value);
}
function msToLocalInput(ms) {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms <= 0) return "";
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return "";
  return String(date.getFullYear()) + "-" + pad2(date.getMonth() + 1) + "-" + pad2(date.getDate()) + "T" + pad2(date.getHours()) + ":" + pad2(date.getMinutes());
}
function localInputToMs(value) {
  if (typeof value !== "string" || value.trim() === "") return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}
function normalizeHexColor(value, fallback = "#ffffff") {
  const safeFallback = /^#[0-9a-fA-F]{6}$/.test(String(fallback)) ? String(fallback).toLowerCase() : "#ffffff";
  const raw = String(value == null ? "" : value).trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    return ("#" + raw.slice(1).split("").map((ch) => ch + ch).join("")).toLowerCase();
  }
  return safeFallback;
}
var IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|avif|svg)$/i;
function isImageFile(file) {
  if (!file) return false;
  const type = String(file.type || "");
  if (/^image\//i.test(type)) return true;
  return IMAGE_EXT.test(String(file.name || ""));
}
function collectImageFiles(source) {
  const out = [];
  if (!source) return out;
  const items = source.items;
  if (items && typeof items.length === "number") {
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (!item) continue;
      if (item.kind && item.kind !== "file") continue;
      let file = null;
      try {
        file = typeof item.getAsFile === "function" ? item.getAsFile() : null;
      } catch (err) {
        file = null;
      }
      if (file && isImageFile(file)) out.push(file);
    }
  }
  if (out.length === 0 && source.files && typeof source.files.length === "number") {
    for (let i = 0; i < source.files.length; i += 1) {
      const file = source.files[i];
      if (file && isImageFile(file)) out.push(file);
    }
  }
  return out;
}

// client/session-bridge.js
function describeNote(note, options = {}) {
  const title = (note?.title || "").trim() || "\uFF08\u65E0\u6807\u9898\uFF09";
  const created = formatTimestamp(note?.createdAt);
  const body = noteToText(note?.html);
  const lines = [];
  lines.push(`\u3010\u4FBF\u7B7E\u3011${title}`);
  if (options.mode === "schedule" && Number.isFinite(options.at)) {
    lines.push(
      `\uFF08\u8FD9\u662F\u4E3B\u4EBA\u4E8E ${created} \u521B\u5EFA\u7684\u4E00\u5F20\u4FBF\u7B7E\uFF0C\u539F\u672C\u7528\u4E8E\u968F\u624B\u8BB0\u5F55\u4E34\u65F6\u60F3\u6CD5\uFF1B\u73B0\u5728\u901A\u8FC7\u4FBF\u7B7E\u5899\u5B9A\u65F6\u5230\u4E86 ${formatTimestamp(options.at)} \u81EA\u52A8\u53D1\u7ED9\u4F60\u3002\uFF09`
    );
  } else {
    lines.push(
      `\uFF08\u8FD9\u662F\u4E3B\u4EBA\u4E8E ${created} \u521B\u5EFA\u7684\u4E00\u5F20\u4FBF\u7B7E\uFF0C\u7528\u4E8E\u968F\u624B\u8BB0\u5F55\u968F\u65F6\u968F\u5730\u7684\u4E34\u65F6\u60F3\u6CD5\uFF0C\u73B0\u5728\u4ECE\u4FBF\u7B7E\u5899\u62D6\u8FDB\u4E86\u8FD9\u4E2A\u4F1A\u8BDD\u3002\uFF09`
    );
  }
  if (body) {
    lines.push("---");
    lines.push(body);
  }
  return lines.join("\n");
}
function noteToText(html) {
  if (typeof html !== "string" || html === "") return "";
  let text = stripTags(html);
  text = text.replace(/&nbsp;/gi, " ").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/&amp;/gi, "&");
  text = text.split("\n").map((line) => line.replace(/[ \t\u00a0]+/g, " ").trim()).join("\n");
  return text.replace(/\n{3,}/g, "\n\n").trim();
}
function formatTimestamp(ms) {
  const value = Number(ms);
  if (!Number.isFinite(value) || value <= 0) return "\u672A\u77E5\u65F6\u95F4";
  const date = new Date(value);
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}\u5E74${date.getMonth() + 1}\u6708${date.getDate()}\u65E5 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// client/api.js
var BASE = "/sticky-wall";
async function request(path, options = {}) {
  const method = options.method ?? "GET";
  const init = { method, headers: {} };
  if (options.body !== void 0) {
    init.headers["content-type"] = "application/json";
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
    const message = payload?.error ?? `\u8BF7\u6C42\u5931\u8D25\uFF08HTTP ${response.status}\uFF09`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return payload ?? {};
}
var api = {
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
    if (options.summary) query.push("fields=summary");
    return request(query.length ? `/state?${query.join("&")}` : "/state");
  },
  /**
   * 宿主会话列表。
   *
   * 走宿主自己的 /api/sessions（浏览器带登录态，插件可直接取）；
   * 不依赖 ctx.sessions 的内部 API，避免跨版本漂移。
   */
  async sessions() {
    const response = await fetch("/api/sessions", { credentials: "same-origin" });
    if (!response.ok) throw new Error("\u8BFB\u53D6\u4F1A\u8BDD\u5217\u8868\u5931\u8D25\uFF08HTTP " + response.status + "\uFF09");
    const payload = await response.json();
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.sessions)) return payload.sessions;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
  },
  /** 定时把便签发到某个会话（交给内核 schedule，重启不丢）。 */
  deliver(body) {
    return request("/deliver", { method: "POST", body });
  },
  /** 取消某张便签的定时发送。 */
  cancelDeliver(body) {
    return request("/deliver/cancel", { method: "POST", body });
  },
  /** @param {{op: string, [key: string]: unknown}} body */
  /** 启动打点上报（诊断用；失败必须静默，不能影响主流程） */
  traceBoot(payload) {
    return request("/boot-trace", { method: "POST", body: payload });
  },
  note(body) {
    return request("/note", { method: "POST", body });
  },
  /** @param {object} patch Wall 字段子集 */
  wall(patch) {
    return request("/wall", { method: "POST", body: { patch } });
  },
  /**
   * 上传一张图（data URL）。返回 `{url, id, bytes}`。
   * @param {string} dataUrl
   */
  media(dataUrl) {
    return request("/media", { method: "POST", body: { dataUrl } });
  },
  /** 标记提醒已展示过。 @param {string} id */
  ackAlarm(id) {
    return request("/alarm/ack", { method: "POST", body: { id } });
  },
  /** 直接发送：把文本立刻投递到目标会话。 */
  async insert(body) {
    return request("/insert", { method: "POST", body });
  }
};
function mediaUrl(id) {
  return id ? `${BASE}/media/${encodeURIComponent(id)}` : null;
}

// client/theme.js
var STYLE_ID = "dsh-sticky-wall-styles";
var CSS = `
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
/* \u4FBF\u7B7E\u5899\u4E3B\u4F53\uFF1A\u5DE6\u5217\uFF08\u62D6\u62FD\u65F6\u5C55\u5F00\u7684\u4F1A\u8BDD\u533A\uFF09 + \u53F3\u5217\uFF08\u5361\u7247\u5899\uFF09 */
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
/* \u62D6\u4FBF\u7B7E\u5230\u4F1A\u8BDD\uFF1A\u62D6\u5230\u5899\u7684\u5DE6\u7F18\u65F6\uFF0C\u4ECE\u5DE6\u4FA7\u7AD6\u7740\u5C55\u5F00\u7684\u4F1A\u8BDD\u5217\u8868 */
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

/* \u62D6\u62FD\u6392\u5E8F\uFF1A\u4E24\u5361\u4E4B\u95F4\u7684\u63D2\u5165\u6307\u793A\u7EBF */
.sw-insert-line {
  position: absolute;
  width: 3px;
  border-radius: 2px;
  background: var(--dsh-accent, #4d6bfe);
  box-shadow: 0 0 8px rgba(77, 107, 254, .55);
  pointer-events: none;
  z-index: 40;
}
/* \u8BA9\u4F4D\u8FC7\u6E21\uFF1A\u53EA\u5728\u6709\u4F4D\u79FB\u65F6\u6302\u4E0A\uFF0C\u907F\u514D\u5E72\u6270 hover \u653E\u5927\u52A8\u6548 */
.sw-card.is-shifting {
  transition: transform .18s cubic-bezier(.2, .8, .2, 1);
}

`;
function injectStyles(doc = globalThis.document) {
  if (!doc || typeof doc.createElement !== "function") return;
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  doc.head.appendChild(style);
}

// client/wall.js
var import_react6 = require("react");

// client/card.js
var import_react = require("react");

// client/origin.js
var SHADOW_MARGIN = 4;
function pickTransformOrigin({
  cardTop,
  cardBottom,
  cardHeight,
  viewTop,
  viewBottom,
  hoverScale
}) {
  const scale = Math.max(1, Number(hoverScale) || 1);
  if (scale === 1) return "center center";
  const need = (scale - 1) * cardHeight / 2 + SHADOW_MARGIN;
  const above = cardTop - viewTop;
  const below = viewBottom - cardBottom;
  if (above >= need && below >= need) return "center center";
  if (above < need && below >= need) return "top center";
  if (below < need && above >= need) return "bottom center";
  return above >= below ? "top center" : "bottom center";
}

// client/card.js
var import_jsx_runtime = require("react/jsx-runtime");
var PREVIEW_RATIO = 0.62;
var PREVIEW_RATIO_HOVER = 0.94;
var HOVER_DELAY = 120;
function formatTime(ms) {
  if (!ms) return "";
  const date = new Date(ms);
  const now = /* @__PURE__ */ new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const pad = (n) => String(n).padStart(2, "0");
  if (sameDay) return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return `${date.getMonth() + 1}\u6708${date.getDate()}\u65E5`;
}
function deliveryTimeMs(delivery) {
  const raw = delivery?.at;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw) {
    const parsed = Date.parse(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
function formatDelivery(delivery) {
  const ms = deliveryTimeMs(delivery);
  if (ms === null) return null;
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, "0");
  const stamp = pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
  const target = delivery.sessionTitle || "\u4F1A\u8BDD";
  const verb = ms <= Date.now() ? "\u5DF2\u4E8E " : "\u9884\u7EA6 ";
  return verb + stamp + " \u5B9A\u65F6\u53D1\u9001\u5230 " + target;
}
function formatAlarm(ms) {
  if (!ms) return "";
  const date = new Date(ms);
  const pad = (n) => String(n).padStart(2, "0");
  const now = /* @__PURE__ */ new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  if (sameDay) return `\u4ECA\u5929 ${time}`;
  return `${date.getMonth() + 1}/${date.getDate()} ${time}`;
}
function NoteCard({
  note,
  wall,
  index,
  onOpen,
  onTogglePin,
  onDelete,
  onDeliver,
  onCancelDelivery,
  draggable = true,
  dragging = false,
  dropTarget = false,
  shiftX = 0,
  shiftY = 0,
  onDragStart,
  onDragEnter,
  onDragEnd,
  onDrop
}) {
  const deliveryText = formatDelivery(note.delivery);
  const deliveryAtMs = note.delivery ? deliveryTimeMs(note.delivery) : null;
  const deliveryPending = deliveryAtMs !== null && deliveryAtMs > Date.now();
  const [hovered, setHovered] = (0, import_react.useState)(false);
  const timer = (0, import_react.useRef)(null);
  const fadeRef = (0, import_react.useRef)(null);
  const cardRef = (0, import_react.useRef)(null);
  const [origin, setOrigin] = (0, import_react.useState)("center center");
  (0, import_react.useEffect)(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const measureOrigin = () => {
    const el = cardRef.current;
    const scroller = el?.closest ? el.closest(".sw-wall") : null;
    if (!el || !scroller) return "center center";
    const cardRect = el.getBoundingClientRect();
    const viewRect = scroller.getBoundingClientRect();
    return pickTransformOrigin({
      cardTop: cardRect.top,
      cardBottom: cardRect.bottom,
      cardHeight: cardRect.height,
      viewTop: viewRect.top,
      viewBottom: viewRect.bottom,
      hoverScale: wall.hoverScale
    });
  };
  const enter = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setOrigin(measureOrigin());
      setHovered(true);
    }, HOVER_DELAY);
  };
  const leave = () => {
    if (timer.current) clearTimeout(timer.current);
    setHovered(false);
  };
  const cardWidth = wall.cardWidth;
  const cardHeight = wall.cardHeight;
  const scale = hovered ? wall.hoverScale : 1;
  const previewHeight = Math.max(48, (cardHeight - 74) * (hovered ? PREVIEW_RATIO_HOVER : PREVIEW_RATIO));
  const overdue = note.alarmAt && !note.alarmFiredAt && note.alarmAt <= Date.now();
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "div",
    {
      className: [
        "sw-card",
        hovered ? "is-hover" : "",
        note.pinned ? "is-pinned" : "",
        shiftX || shiftY ? "is-shifting" : "",
        dragging ? "is-dragging" : "",
        dropTarget ? "is-drop-target" : ""
      ].filter(Boolean).join(" "),
      ref: cardRef,
      style: {
        width: cardWidth,
        height: cardHeight,
        background: note.color,
        color: note.textColor,
        fontSize: wall.fontSize,
        transform: (shiftX || shiftY ? `translate(${shiftX}px, ${shiftY}px) ` : "") + `scale(${scale})`,
        // 锚点按可视空间动态选，避免放大后顶部/底部被滚动容器裁掉
        transformOrigin: origin,
        zIndex: hovered ? 30 : note.pinned ? 2 : 1,
        transitionDelay: hovered ? "0ms" : "60ms",
        ["--sw-fade"]: `${note.color}`
      },
      draggable,
      onDragStart: (event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", note.id);
        onDragStart?.(event);
      },
      onDragEnter: (event) => {
        event.preventDefault();
        onDragEnter?.(event);
      },
      onDragOver: (event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      },
      onDragEnd: (event) => onDragEnd?.(event),
      onDrop: (event) => {
        event.preventDefault();
        onDrop?.(event);
      },
      onMouseEnter: enter,
      onMouseLeave: leave,
      onClick: () => onOpen?.(note),
      role: "button",
      tabIndex: 0,
      onKeyDown: (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen?.(note);
        }
      },
      title: note.title || "\uFF08\u7A7A\u4FBF\u7B7E\uFF09",
      "data-note-id": note.id,
      "data-index": index,
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "sw-card-title", children: [
          note.draft ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "span",
            {
              className: "sw-draft-badge",
              style: {
                fontSize: 10,
                fontWeight: 600,
                padding: "1px 5px",
                marginRight: 5,
                borderRadius: 4,
                border: "1px dashed currentColor",
                opacity: 0.7,
                verticalAlign: "middle"
              },
              children: "\u8349\u7A3F"
            }
          ) : null,
          note.title || "\uFF08\u7A7A\u4FBF\u7B7E\uFF09"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "div",
          {
            className: "sw-preview",
            style: { maxHeight: previewHeight },
            ref: fadeRef,
            dangerouslySetInnerHTML: { __html: note.html || '<p class="sw-muted">\uFF08\u8FD8\u6CA1\u6709\u5185\u5BB9\uFF09</p>' },
            onClick: (event) => {
              if (event.target?.tagName === "IMG") {
                event.preventDefault();
                onOpen?.(note);
              }
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "sw-preview-fade" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "sw-card-meta", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: formatTime(note.updatedAt || note.createdAt) }),
          note.createdBy === "agent" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\xB7 \u5C0F\u52A9\u624B\u8BB0\u7684" }) : null,
          note.alarmAt ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "sw-alarm-dot", style: overdue ? { background: "rgba(220,38,38,.18)" } : void 0, children: [
            "\u23F0 ",
            formatAlarm(note.alarmAt)
          ] }) : null,
          onDeliver ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "button",
            {
              type: "button",
              className: "sw-badge",
              title: deliveryText ? deliveryText + "\uFF08\u70B9\u51FB\u53EF\u91CD\u65B0\u8BBE\u7F6E\uFF09" : "\u628A\u8FD9\u5F20\u4FBF\u7B7E\u53D1\u9001\u5230\u67D0\u4E2A\u4F1A\u8BDD",
              "aria-label": deliveryText || "\u53D1\u9001\u5230\u4F1A\u8BDD",
              onClick: (event) => {
                event.stopPropagation();
                onDeliver(note);
              },
              style: {
                // 父级 .sw-card-meta 是 pointer-events: none（纯装饰行），
                // 继承下来就点不到，必须自己抢回事件。
                pointerEvents: "auto",
                marginLeft: "auto",
                // 外观对齐右上角 .sw-badge（同底色同圆角），只是宽度自适应文字。
                width: "auto",
                // .sw-badge 基础样式写死了 width/height:22px，两行文案必须显式解除
                height: "auto",
                minHeight: 22,
                padding: "0 6px",
                fontSize: 10.5,
                maxWidth: "260px",
                // 会话标题经常很长：允许最多两行，再多才截断
                display: "flex",
                alignItems: "flex-start",
                gap: 3,
                textAlign: "left",
                lineHeight: 1.35
              },
              children: deliveryText ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { flexShrink: 0 }, children: "\u23F0" }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  "span",
                  {
                    style: {
                      display: "-webkit-box",
                      WebkitBoxOrient: "vertical",
                      WebkitLineClamp: 2,
                      overflow: "hidden",
                      wordBreak: "break-word"
                    },
                    children: deliveryText
                  }
                )
              ] }) : "\u53D1\u9001\u5230\u4F1A\u8BDD"
            }
          ) : null,
          deliveryPending ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "button",
            {
              type: "button",
              title: "\u53D6\u6D88\u8FD9\u6B21\u5B9A\u65F6\u53D1\u9001",
              "aria-label": "\u53D6\u6D88\u5B9A\u65F6\u53D1\u9001",
              style: {
                flexShrink: 0,
                marginLeft: 4,
                padding: "2px 6px",
                fontSize: 11,
                lineHeight: 1.2,
                borderRadius: 6,
                border: "1px solid #e0b4b4",
                background: "#fff5f5",
                color: "#b05050",
                cursor: "pointer",
                pointerEvents: "auto"
              },
              onClick: (event) => {
                event.stopPropagation();
                onCancelDelivery?.(note.id);
              },
              children: "\u53D6\u6D88\u5B9A\u65F6"
            }
          ) : null
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "sw-badges", onClick: (event) => event.stopPropagation(), children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "button",
            {
              type: "button",
              className: "sw-badge",
              title: note.pinned ? "\u53D6\u6D88\u7F6E\u9876" : "\u7F6E\u9876",
              "aria-label": note.pinned ? "\u53D6\u6D88\u7F6E\u9876" : "\u7F6E\u9876",
              onClick: () => onTogglePin?.(note),
              children: note.pinned ? "\u{1F4CC}" : "\u{1F4CD}"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "button",
            {
              type: "button",
              className: "sw-badge",
              title: "\u5220\u9664\u4FBF\u7B7E",
              "aria-label": "\u5220\u9664\u4FBF\u7B7E",
              onClick: () => onDelete?.(note),
              children: "\u{1F5D1}"
            }
          )
        ] })
      ]
    }
  );
}

// client/deliver.js
var import_react2 = require("react");
var import_jsx_runtime2 = require("react/jsx-runtime");
var s = {
  mask: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 20, 30, 0.42)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2e3,
    padding: 16
  },
  card: {
    width: "min(520px, 100%)",
    maxHeight: "82vh",
    display: "flex",
    flexDirection: "column",
    borderRadius: 14,
    background: "var(--sw-surface, #fffdf8)",
    boxShadow: "0 18px 48px rgba(15, 20, 30, 0.28)",
    overflow: "hidden",
    font: "inherit"
  },
  head: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 16px 10px",
    fontSize: 14,
    fontWeight: 600
  },
  body: { padding: "0 16px 8px", overflowY: "auto", minHeight: 0 },
  label: { fontSize: 12, opacity: 0.65, margin: "10px 0 6px" },
  list: {
    border: "1px solid rgba(15,20,30,0.12)",
    borderRadius: 10,
    maxHeight: 230,
    overflowY: "auto"
  },
  item: (active) => ({
    padding: "8px 10px",
    fontSize: 13,
    cursor: "pointer",
    background: active ? "rgba(64,140,255,0.12)" : "transparent",
    borderBottom: "1px solid rgba(15,20,30,0.06)",
    display: "flex",
    alignItems: "center",
    gap: 8
  }),
  name: {
    flex: "1 1 auto",
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
  },
  count: { flex: "0 0 auto", fontSize: 11, opacity: 0.6 },
  modes: { display: "flex", gap: 8, marginTop: 4 },
  mode: (active) => ({
    flex: 1,
    padding: "9px 10px",
    borderRadius: 9,
    border: "1px solid " + (active ? "rgba(64,140,255,0.55)" : "rgba(15,20,30,0.14)"),
    background: active ? "rgba(64,140,255,0.10)" : "transparent",
    cursor: "pointer",
    fontSize: 12,
    lineHeight: 1.45,
    textAlign: "left",
    font: "inherit"
  }),
  input: {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 9,
    border: "1px solid rgba(15,20,30,0.16)",
    font: "inherit",
    fontSize: 13,
    boxSizing: "border-box"
  },
  foot: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
    padding: "12px 16px 14px",
    borderTop: "1px solid rgba(15,20,30,0.08)"
  },
  btn: (primary) => ({
    padding: "8px 16px",
    borderRadius: 9,
    border: primary ? "none" : "1px solid rgba(15,20,30,0.16)",
    background: primary ? "#408cff" : "transparent",
    color: primary ? "#fff" : "inherit",
    cursor: "pointer",
    fontSize: 13,
    font: "inherit"
  }),
  linkBtn: {
    border: "none",
    background: "transparent",
    color: "#408cff",
    cursor: "pointer",
    fontSize: 12,
    padding: 0,
    font: "inherit"
  },
  hint: { fontSize: 11, opacity: 0.6, marginTop: 6, lineHeight: 1.5 },
  error: { fontSize: 12, color: "#c0392b", marginTop: 8, lineHeight: 1.5, wordBreak: "break-word" },
  block: { fontSize: 12, color: "#8a6d1f", background: "#fff8e1", border: "1px solid #ffe0a3", borderRadius: 6, padding: "6px 8px", marginTop: 8, lineHeight: 1.5 },
  quickRow: { display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6, marginBottom: 2 },
  quickBtn: { fontSize: 12, padding: "4px 9px", borderRadius: 6, border: "1px solid #d8d2c4", background: "#fffdf6", color: "#5b5346", cursor: "pointer", lineHeight: 1.2 },
  picked: {
    marginTop: 8,
    fontSize: 12,
    padding: "6px 8px",
    borderRadius: 8,
    background: "rgba(64,140,255,0.10)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
  }
};
function toLocalInput(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()) + "T" + pad(date.getHours()) + ":" + pad(date.getMinutes());
}
function defaultAt() {
  const d = new Date(Date.now() + 60 * 60 * 1e3);
  d.setSeconds(0, 0);
  return toLocalInput(d);
}
function DeliverDialog(props) {
  const { note, sessions, busy, error, onClose, onInsert, onSchedule } = props;
  const [sessionId, setSessionId] = (0, import_react2.useState)(props.initialSessionId ?? "");
  const [activeWs, setActiveWs] = (0, import_react2.useState)(null);
  const [mode, setMode] = (0, import_react2.useState)("insert");
  const [at, setAt] = (0, import_react2.useState)(defaultAt);
  const all = Array.isArray(sessions) ? sessions : [];
  const groups = (0, import_react2.useMemo)(() => {
    const map = /* @__PURE__ */ new Map();
    for (const item of all) {
      const ws = item.workspace || "\uFF08\u672A\u5206\u5DE5\u4F5C\u533A\uFF09";
      if (!map.has(ws)) map.set(ws, []);
      map.get(ws).push(item);
    }
    const lastActiveOf = (list) => list.reduce((acc, x) => Math.max(acc, x.updatedAt || 0), 0);
    return Array.from(map, ([workspace, list]) => ({
      workspace,
      // 组内会话也按活跃时间降序
      list: list.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)),
      lastActive: lastActiveOf(list)
    })).sort((a, b) => b.lastActive - a.lastActive);
  }, [sessions]);
  const current = (0, import_react2.useMemo)(() => all.find((x) => x.id === sessionId) || null, [sessions, sessionId]);
  const atMs = (0, import_react2.useMemo)(() => {
    const ms = new Date(at).getTime();
    return Number.isFinite(ms) ? ms : NaN;
  }, [at]);
  const insertReady = true;
  const canSubmit = !busy && sessionId !== "" && (mode === "schedule" ? Number.isFinite(atMs) && atMs > Date.now() : insertReady);
  const blockReason = busy ? "\u6B63\u5728\u53D1\u9001\uFF0C\u8BF7\u7A0D\u5019\u2026" : sessionId === "" ? "\u8BF7\u5148\u9009\u62E9\u4E00\u4E2A\u76EE\u6807\u4F1A\u8BDD" : mode === "schedule" && !Number.isFinite(atMs) ? "\u53D1\u9001\u65F6\u95F4\u65E0\u6548\u2014\u2014\u70B9\u4E0B\u9762\u7684\u5FEB\u6377\u6309\u94AE\uFF0C\u6216\u91CD\u65B0\u9009\u4E00\u4E2A\u65F6\u95F4" : mode === "schedule" && atMs <= Date.now() ? "\u53D1\u9001\u65F6\u95F4\u5DF2\u7ECF\u8FC7\u53BB\u4E86\uFF0C\u8BF7\u91CD\u65B0\u9009\u62E9" : "";
  function quickSet(minutes) {
    const d = new Date(Date.now() + minutes * 60 * 1e3);
    d.setSeconds(0, 0);
    setAt(toLocalInput(d));
  }
  function quickTomorrow() {
    const d = /* @__PURE__ */ new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    setAt(toLocalInput(d));
  }
  function submit() {
    if (!canSubmit) return;
    if (mode === "insert") onInsert({ note, session: current });
    else onSchedule({ note, session: current, at: atMs });
  }
  const activeGroup = groups.find((g) => g.workspace === activeWs) || null;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: s.mask, role: "dialog", "aria-label": "\u53D1\u9001\u4FBF\u7B7E\u5230\u4F1A\u8BDD", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: s.card, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: s.head, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: "\u53D1\u9001\u5230\u4F1A\u8BDD" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "button",
        {
          type: "button",
          style: { border: "none", background: "transparent", fontSize: 18, cursor: "pointer", lineHeight: 1 },
          "aria-label": "\u5173\u95ED",
          onClick: onClose,
          children: "\xD7"
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: s.body, children: [
      activeGroup ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: s.label, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", style: s.linkBtn, onClick: () => setActiveWs(null), children: "\u2190 \u8FD4\u56DE\u5DE5\u4F5C\u533A" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { marginLeft: 8, opacity: 0.7 }, children: activeGroup.workspace })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: s.list, children: activeGroup.list.map((item) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "div",
          {
            style: s.item(item.id === sessionId),
            role: "button",
            tabIndex: 0,
            onClick: () => setSessionId(item.id),
            onKeyDown: (e) => {
              if (e.key === "Enter" || e.key === " ") setSessionId(item.id);
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: s.name, children: item.title })
          },
          item.id
        )) })
      ] }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: s.label, children: [
          "\u9009\u62E9\u5DE5\u4F5C\u533A\uFF08",
          groups.length,
          " \u4E2A\u5DE5\u4F5C\u533A / ",
          all.length,
          " \u4E2A\u4F1A\u8BDD\uFF09"
        ] }),
        groups.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: s.list, children: groups.map((group) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
          "div",
          {
            style: s.item(false),
            role: "button",
            tabIndex: 0,
            onClick: () => setActiveWs(group.workspace),
            onKeyDown: (e) => {
              if (e.key === "Enter" || e.key === " ") setActiveWs(group.workspace);
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: s.name, children: group.workspace }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: s.count, children: group.list.length })
            ]
          },
          group.workspace
        )) }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { ...s.hint, padding: "10px 0" }, children: "\u6CA1\u8BFB\u5230\u4F1A\u8BDD\u5217\u8868\u3002\u53EF\u80FD\u662F\u5F53\u524D\u9875\u9762\u8FD8\u6CA1\u52A0\u8F7D\u4F1A\u8BDD\uFF0C\u6216\u6458\u8981\u91CC\u6CA1\u6709\u53EF\u7528\u5B57\u6BB5\u3002" })
      ] }),
      current ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: s.picked, children: [
        "\u5DF2\u9009\uFF1A",
        current.workspace,
        " / ",
        current.title
      ] }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: s.label, children: "\u53D1\u9001\u65B9\u5F0F" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: s.modes, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("button", { type: "button", style: s.mode(mode === "insert"), onClick: () => setMode("insert"), children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { children: "\u76F4\u63A5\u53D1\u9001" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("br", {}),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { opacity: 0.7 }, children: "\u7ACB\u523B\u53D1\u5230\u8BE5\u4F1A\u8BDD\uFF08\u7EA6 2 \u79D2\uFF09" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("button", { type: "button", style: s.mode(mode === "schedule"), onClick: () => setMode("schedule"), children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { children: "\u5B9A\u65F6\u53D1\u9001" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("br", {}),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { opacity: 0.7 }, children: "\u5230\u70B9\u81EA\u52A8\u53D1\u5230\u8BE5\u4F1A\u8BDD" })
        ] })
      ] }),
      mode === "schedule" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: s.label, children: "\u53D1\u9001\u65F6\u95F4" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "input",
          {
            type: "datetime-local",
            style: s.input,
            value: at,
            onChange: (event) => setAt(event.target.value)
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: s.quickRow, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", style: s.quickBtn, onClick: () => quickSet(5), children: "+5 \u5206\u949F" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", style: s.quickBtn, onClick: () => quickSet(30), children: "+30 \u5206\u949F" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", style: s.quickBtn, onClick: () => quickSet(60), children: "+1 \u5C0F\u65F6" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", style: s.quickBtn, onClick: quickTomorrow, children: "\u660E\u5929 9:00" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: s.hint, children: Number.isFinite(atMs) ? "\u5C06\u5728 " + formatTimestamp(atMs) + " \u81EA\u52A8\u53D1\u9001\uFF1B\u5361\u7247\u4F1A\u663E\u793A \u23F0\uFF0C\u53EF\u968F\u65F6\u53D6\u6D88\u3002" : "\u4E0A\u9762\u7684\u65F6\u95F4\u6846\u6CA1\u53D6\u5230\u503C\u2014\u2014\u76F4\u63A5\u7528\u5FEB\u6377\u6309\u94AE\u3002" })
      ] }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: s.hint, children: "\u70B9\u53D1\u9001\u540E\u7EA6 2 \u79D2\uFF0C\u5185\u5BB9\u4F1A\u4F5C\u4E3A\u4E00\u6761\u6D88\u606F\u53D1\u5230\u8BE5\u4F1A\u8BDD\u3002" }),
      error ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: s.error, children: error }) : null,
      blockReason ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: s.block, children: blockReason }) : null
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: s.foot, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", style: s.btn(false), onClick: onClose, children: "\u53D6\u6D88" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "button",
        {
          type: "button",
          style: { ...s.btn(true), opacity: canSubmit ? 1 : 0.5, cursor: canSubmit ? "pointer" : "not-allowed" },
          onClick: submit,
          children: busy ? "\u5904\u7406\u4E2D\u2026" : mode === "insert" ? "\u7ACB\u5373\u53D1\u9001" : "\u5B9A\u65F6\u53D1\u9001"
        }
      )
    ] })
  ] }) });
}

// client/editor.js
var import_react4 = require("react");
var import_react_dom = require("react-dom");
var import_jsx_runtime4 = require("react/jsx-runtime");
var SAVE_DELAY = 400;
var HISTORY_DELAY = 200;
var HISTORY_LIMIT = 100;
var PANEL_WIDTH = 520;
var PANEL_HEIGHT = 560;
var DEFAULT_BG = "#fff3a3";
var DEFAULT_TEXT = "#1f2430";
var FONT = 'system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';
function preventDefault(event) {
  if (event && typeof event.preventDefault === "function") event.preventDefault();
}
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
function caretRangeFromPoint(x, y) {
  try {
    if (typeof document.caretRangeFromPoint === "function") {
      return document.caretRangeFromPoint(x, y);
    }
    if (typeof document.caretPositionFromPoint === "function") {
      const position = document.caretPositionFromPoint(x, y);
      if (!position || !position.offsetNode) return null;
      const range = document.createRange();
      range.setStart(position.offsetNode, position.offset);
      range.collapse(true);
      return range;
    }
  } catch (err) {
  }
  return null;
}
function dragHasFiles(types) {
  if (!types) return false;
  try {
    for (let i = 0; i < types.length; i += 1) {
      if (types[i] === "Files") return true;
    }
  } catch (err) {
    return false;
  }
  return false;
}
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
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
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
        resolve(true);
      }
    };
    img.onerror = () => resolve(true);
    img.src = dataUrl;
  });
}
function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("\u8BFB\u53D6\u6587\u4EF6\u5931\u8D25"));
    reader.readAsDataURL(file);
  });
}
function applyImageSize(img, width, height) {
  if (!img || !img.style) return;
  img.style.width = Math.max(1, Math.round(width)) + "px";
  img.style.height = Math.max(1, Math.round(height)) + "px";
}
function editorContentWidth(el) {
  if (!el) return 0;
  let width = el.clientWidth || 0;
  try {
    const computed = window.getComputedStyle(el);
    width -= (parseFloat(computed.paddingLeft) || 0) + (parseFloat(computed.paddingRight) || 0);
  } catch (err) {
  }
  return width > 0 ? Math.floor(width) : 0;
}
var IMAGE_SELECT_OUTSET = 8;
var IMAGE_RESIZE_MIN = 40;
function cornerSigns(corner) {
  const key = typeof corner === "string" ? corner.toLowerCase() : "se";
  return {
    x: key === "nw" || key === "sw" ? -1 : 1,
    y: key === "nw" || key === "ne" ? -1 : 1
  };
}
function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}
function resizeFromDrag(options) {
  const opts = options || {};
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
  const driven = Math.abs(byWidth - startWidth) >= Math.abs(byHeight - startWidth) ? byWidth : byHeight;
  const floor = Number.isFinite(opts.minSize) && opts.minSize > 0 ? opts.minSize : IMAGE_RESIZE_MIN;
  const ceiling = Number.isFinite(opts.maxSize) && opts.maxSize > 0 ? Math.max(opts.maxSize, floor) : Infinity;
  const width = Math.round(clampNumber(driven, floor, ceiling));
  const height = Math.max(1, Math.round(width / aspect));
  return { width, height };
}
function overlayGeometry(options) {
  const opts = options || {};
  const imgRect = opts.imgRect || {};
  const wrapRect = opts.wrapRect || {};
  const outset = Number.isFinite(opts.outset) && opts.outset >= 0 ? opts.outset : IMAGE_SELECT_OUTSET;
  const scrollTop = Number.isFinite(opts.scrollTop) ? opts.scrollTop : 0;
  const scrollLeft = Number.isFinite(opts.scrollLeft) ? opts.scrollLeft : 0;
  const num2 = (value) => Number.isFinite(value) ? value : 0;
  const width = Math.max(0, num2(imgRect.width));
  const height = Math.max(0, num2(imgRect.height));
  return {
    left: Math.round(num2(imgRect.left) - num2(wrapRect.left) + scrollLeft - outset),
    top: Math.round(num2(imgRect.top) - num2(wrapRect.top) + scrollTop - outset),
    width: Math.round(width + outset * 2),
    height: Math.round(height + outset * 2)
  };
}
var baseButton = {
  appearance: "none",
  WebkitAppearance: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: 28,
  minWidth: 28,
  padding: "0 8px",
  borderRadius: 8,
  border: "1px solid var(--dsh-border, rgba(128, 140, 160, 0.32))",
  background: "transparent",
  color: "inherit",
  fontFamily: "inherit",
  fontSize: 13,
  lineHeight: 1,
  cursor: "pointer",
  userSelect: "none",
  whiteSpace: "nowrap"
};
var toolRow = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 6
};
var dividerStyle = {
  width: 1,
  height: 18,
  margin: "0 2px",
  background: "var(--dsh-border, rgba(128, 140, 160, 0.3))"
};
var fieldStyle = {
  height: 28,
  padding: "0 8px",
  borderRadius: 8,
  border: "1px solid var(--dsh-border, rgba(128, 140, 160, 0.32))",
  background: "var(--dsh-bg-elevated, #ffffff)",
  color: "inherit",
  fontFamily: "inherit",
  fontSize: 12
};
var s2 = {
  root: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    width: PANEL_WIDTH,
    maxWidth: "calc(100vw - 24px)",
    height: PANEL_HEIGHT,
    maxHeight: "80vh",
    borderRadius: 16,
    overflow: "hidden",
    background: "var(--dsh-bg-elevated, #ffffff)",
    color: "var(--dsh-text-primary, #1f2430)",
    border: "1px solid var(--dsh-border, rgba(128, 140, 160, 0.24))",
    boxShadow: "0 18px 48px rgba(15, 23, 42, 0.3)",
    fontFamily: FONT,
    textAlign: "left"
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: "10px 12px 10px 16px",
    borderBottom: "1px solid var(--dsh-border, rgba(128, 140, 160, 0.22))",
    background: "var(--dsh-bg-secondary, rgba(246, 247, 250, 0.9))",
    flex: "0 0 auto"
  },
  title: {
    fontSize: 14,
    fontWeight: 600,
    color: "var(--dsh-text-primary, #1f2430)",
    letterSpacing: 0.2
  },
  closeButton: {
    ...baseButton,
    minWidth: 28,
    height: 28,
    padding: 0,
    border: "none",
    background: "transparent",
    fontSize: 20,
    lineHeight: 1,
    color: "var(--dsh-text-secondary, #667085)",
    borderRadius: 8
  },
  toolbar: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    padding: "8px 12px",
    borderBottom: "1px solid var(--dsh-border, rgba(128, 140, 160, 0.22))",
    background: "var(--dsh-bg-secondary, rgba(246, 247, 250, 0.9))",
    flex: "0 0 auto"
  },
  canvasWrap: {
    position: "relative",
    flex: "1 1 auto",
    minHeight: 120,
    overflowY: "auto",
    overflowX: "hidden"
  },
  placeholder: {
    position: "absolute",
    top: 16,
    left: 18,
    right: 18,
    fontSize: 15,
    lineHeight: 1.7,
    opacity: 0.42,
    pointerEvents: "none",
    userSelect: "none"
  },
  canvas: {
    minHeight: "100%",
    padding: "14px 16px",
    outline: "none",
    fontSize: 15,
    lineHeight: 1.7,
    wordBreak: "break-word",
    overflowWrap: "anywhere",
    whiteSpace: "pre-wrap",
    boxSizing: "border-box",
    fontFamily: "inherit"
  },
  footer: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    padding: "10px 12px",
    borderTop: "1px solid var(--dsh-border, rgba(128, 140, 160, 0.22))",
    background: "var(--dsh-bg-secondary, rgba(246, 247, 250, 0.9))",
    flex: "0 0 auto"
  },
  footerRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6
  },
  label: {
    flex: "0 0 auto",
    width: 30,
    fontSize: 12,
    color: "var(--dsh-text-secondary, #667085)"
  },
  colorPicker: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    height: 24,
    padding: "0 7px",
    borderRadius: 7,
    border: "1px solid var(--dsh-border, rgba(128, 140, 160, 0.32))",
    background: "var(--dsh-bg-elevated, #ffffff)",
    fontSize: 11,
    color: "var(--dsh-text-secondary, #667085)",
    cursor: "pointer"
  },
  colorInput: {
    width: 16,
    height: 16,
    padding: 0,
    border: "none",
    background: "transparent",
    cursor: "pointer"
  },
  inlineError: {
    fontSize: 12,
    lineHeight: 1.5,
    color: "var(--dsh-danger, #b42318)"
  },
  toast: {
    position: "absolute",
    left: "50%",
    bottom: 14,
    transform: "translateX(-50%)",
    maxWidth: "80%",
    padding: "5px 12px",
    borderRadius: 8,
    background: "rgba(23, 30, 45, 0.9)",
    color: "#ffffff",
    fontSize: 12,
    lineHeight: 1.4,
    textAlign: "center",
    pointerEvents: "none",
    zIndex: 30
  }
};
function swatchStyle(active) {
  return {
    width: 22,
    height: 22,
    padding: 0,
    borderRadius: 7,
    cursor: "pointer",
    border: active ? "2px solid var(--dsh-accent, #4c7cff)" : "1px solid var(--dsh-border, rgba(128, 140, 160, 0.4))",
    boxShadow: "inset 0 0 0 1px rgba(255, 255, 255, 0.4)"
  };
}
function ToolButton2(props) {
  const { label, title, onPress, disabled, bold, italic, underline, strike } = props;
  const textStyle = {
    fontWeight: bold ? 700 : 500,
    fontStyle: italic ? "italic" : "normal",
    textDecoration: underline ? "underline" : strike ? "line-through" : "none",
    fontSize: label && label.length > 2 ? 12 : 13
  };
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
    "button",
    {
      type: "button",
      title,
      "aria-label": title,
      disabled: !!disabled,
      onMouseDown: preventDefault,
      onClick: onPress,
      style: {
        ...baseButton,
        ...textStyle,
        opacity: disabled ? 0.42 : 1,
        cursor: disabled ? "default" : "pointer"
      },
      children: label
    }
  );
}
var HANDLE_SIZE = 12;
var CORNERS = [
  { corner: "nw", left: 0, top: 0, cursor: "nwse-resize" },
  { corner: "ne", left: "100%", top: 0, cursor: "nesw-resize" },
  { corner: "sw", left: 0, top: "100%", cursor: "nesw-resize" },
  { corner: "se", left: "100%", top: "100%", cursor: "nwse-resize" }
];
function ImageResizeOverlay(props) {
  const { img, revision, wrapRef, maxWidth, onCommit, onDelete, onDeselect } = props;
  const [geo, setGeo] = (0, import_react4.useState)(null);
  const dragRef = (0, import_react4.useRef)(null);
  const measure = (0, import_react4.useCallback)(() => {
    const node = img;
    const wrap = wrapRef && wrapRef.current;
    if (!node || !wrap) return false;
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
      scrollLeft: wrap.scrollLeft || 0
    });
    setGeo({ ...box, imgWidth: imgRect.width, imgHeight: imgRect.height });
    return true;
  }, [img, wrapRef]);
  (0, import_react4.useEffect)(() => {
    const visible = measure();
    if (!visible && img && img.isConnected === false && typeof onDeselect === "function") {
      onDeselect();
    }
  }, [measure, revision, img, onDeselect]);
  (0, import_react4.useEffect)(() => {
    const wrap = wrapRef && wrapRef.current;
    if (!wrap || typeof ResizeObserver !== "function") return void 0;
    const observer = new ResizeObserver(() => {
      measure();
    });
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [measure, wrapRef]);
  (0, import_react4.useEffect)(() => {
    if (!img || typeof img.addEventListener !== "function") return void 0;
    const onLoad = () => {
      measure();
    };
    img.addEventListener("load", onLoad);
    return () => img.removeEventListener("load", onLoad);
  }, [img, measure]);
  const handlePointerDown = (corner) => (event) => {
    if (!img || !geo) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (event.cancelable) event.preventDefault();
    event.stopPropagation();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch (err) {
    }
    const limit = typeof maxWidth === "function" ? maxWidth() : 0;
    dragRef.current = {
      pointerId: event.pointerId,
      corner,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: geo.imgWidth,
      startHeight: geo.imgHeight,
      // 容器量不到宽度时不要传 0，否则 resizeFromDrag 会把图锁死在下限。
      maxSize: limit >= IMAGE_RESIZE_MIN ? limit : Infinity,
      moved: false
    };
  };
  const handlePointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
    drag.moved = true;
    const next = resizeFromDrag({
      startWidth: drag.startWidth,
      startHeight: drag.startHeight,
      dx,
      dy,
      corner: drag.corner,
      maxSize: drag.maxSize
    });
    applyImageSize(img, next.width, next.height);
    measure();
  };
  const handlePointerEnd = (event) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (event && event.pointerId !== void 0 && event.pointerId !== drag.pointerId) return;
    dragRef.current = null;
    try {
      if (event && event.currentTarget && event.currentTarget.releasePointerCapture) {
        event.currentTarget.releasePointerCapture(drag.pointerId);
      }
    } catch (err) {
    }
    if (drag.moved && typeof onCommit === "function") onCommit();
    measure();
  };
  if (!geo) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
    "div",
    {
      "data-sw-image-overlay": "1",
      style: {
        position: "absolute",
        left: geo.left,
        top: geo.top,
        width: geo.width,
        height: geo.height,
        boxSizing: "border-box",
        border: "2px solid rgba(76, 124, 255, 0.95)",
        borderRadius: 8,
        boxShadow: "0 0 0 3px rgba(76, 124, 255, 0.18)",
        // 框本身不抢事件：图片旁边的文字仍然可以点（点了就取消选中）。
        pointerEvents: "none",
        zIndex: 8
      },
      children: [
        CORNERS.map((item) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "span",
          {
            role: "presentation",
            "aria-label": "\u7F29\u653E\u56FE\u7247 " + item.corner,
            onPointerDown: handlePointerDown(item.corner),
            onPointerMove: handlePointerMove,
            onPointerUp: handlePointerEnd,
            onPointerCancel: handlePointerEnd,
            onLostPointerCapture: handlePointerEnd,
            style: {
              position: "absolute",
              left: item.left,
              top: item.top,
              width: HANDLE_SIZE,
              height: HANDLE_SIZE,
              marginLeft: -HANDLE_SIZE / 2,
              marginTop: -HANDLE_SIZE / 2,
              boxSizing: "border-box",
              borderRadius: "50%",
              background: "#ffffff",
              border: "2px solid rgba(76, 124, 255, 0.95)",
              boxShadow: "0 1px 4px rgba(15, 23, 42, 0.28)",
              cursor: item.cursor,
              pointerEvents: "auto",
              touchAction: "none"
            }
          },
          item.corner
        )),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "button",
          {
            type: "button",
            title: "\u5220\u9664\u8FD9\u5F20\u56FE\u7247",
            "aria-label": "\u5220\u9664\u8FD9\u5F20\u56FE\u7247",
            onPointerDown: (event) => {
              if (event.cancelable) event.preventDefault();
              event.stopPropagation();
            },
            onClick: (event) => {
              event.preventDefault();
              event.stopPropagation();
              if (typeof onDelete === "function") onDelete(img);
            },
            style: {
              position: "absolute",
              right: -HANDLE_SIZE - 4,
              top: -HANDLE_SIZE - 4,
              width: 20,
              height: 20,
              padding: 0,
              boxSizing: "border-box",
              borderRadius: "50%",
              border: "2px solid #ffffff",
              background: "rgba(180, 35, 24, 0.95)",
              color: "#ffffff",
              fontSize: 12,
              lineHeight: 1,
              cursor: "pointer",
              pointerEvents: "auto",
              touchAction: "none",
              boxShadow: "0 1px 4px rgba(15, 23, 42, 0.28)"
            },
            children: "\xD7"
          }
        )
      ]
    }
  );
}
function NoteEditor(props) {
  const { note = null, palette, onClose, onChange, uploadImage, onDeliver } = props || {};
  const paletteList = (0, import_react4.useMemo)(() => {
    const source = Array.isArray(palette) && palette.length > 0 ? palette : DEFAULT_PALETTE;
    const cleaned = source.filter((entry) => typeof entry === "string" && entry.trim() !== "");
    return cleaned.length > 0 ? cleaned : DEFAULT_PALETTE;
  }, [palette]);
  const noteId = note && typeof note.id === "string" ? note.id : null;
  const editorRef = (0, import_react4.useRef)(null);
  const canvasWrapRef = (0, import_react4.useRef)(null);
  const selectedImageRef = (0, import_react4.useRef)(null);
  const fileInputRef = (0, import_react4.useRef)(null);
  const lastRangeRef = (0, import_react4.useRef)(null);
  const saveTimerRef = (0, import_react4.useRef)(null);
  const historyTimerRef = (0, import_react4.useRef)(null);
  const historyRef = (0, import_react4.useRef)(createHistory(HISTORY_LIMIT));
  const composingRef = (0, import_react4.useRef)(false);
  const htmlRef = (0, import_react4.useRef)("");
  const colorRef = (0, import_react4.useRef)(DEFAULT_BG);
  const textColorRef = (0, import_react4.useRef)(DEFAULT_TEXT);
  const alarmRef = (0, import_react4.useRef)(null);
  const noteIdRef = (0, import_react4.useRef)(null);
  const pendingKindRef = (0, import_react4.useRef)("content");
  const lastEmittedRef = (0, import_react4.useRef)(null);
  const inkComponentRef = (0, import_react4.useRef)(null);
  const inkOpenRef = (0, import_react4.useRef)(false);
  const onCloseRef = (0, import_react4.useRef)(onClose);
  const onChangeRef = (0, import_react4.useRef)(onChange);
  const uploadRef = (0, import_react4.useRef)(uploadImage);
  const mountedRef = (0, import_react4.useRef)(true);
  const [color, setColor] = (0, import_react4.useState)(DEFAULT_BG);
  const [textColor, setTextColor] = (0, import_react4.useState)(DEFAULT_TEXT);
  const [alarmAt, setAlarmAt] = (0, import_react4.useState)(null);
  const [empty, setEmpty] = (0, import_react4.useState)(true);
  const [hint, setHint] = (0, import_react4.useState)(null);
  const [inkOpen, setInkOpen] = (0, import_react4.useState)(false);
  const [inkLoading, setInkLoading] = (0, import_react4.useState)(false);
  const [inkError, setInkError] = (0, import_react4.useState)(null);
  const [historyFlags, setHistoryFlags] = (0, import_react4.useState)({ undo: false, redo: false });
  const [selectedImage, setSelectedImage] = (0, import_react4.useState)(null);
  const [contentRev, setContentRev] = (0, import_react4.useState)(0);
  (0, import_react4.useEffect)(() => {
    onCloseRef.current = onClose;
    onChangeRef.current = onChange;
    uploadRef.current = uploadImage;
  });
  (0, import_react4.useEffect)(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
        if (editorRef.current) htmlRef.current = editorRef.current.innerHTML;
        emitRef.current();
      }
      if (historyTimerRef.current) {
        clearTimeout(historyTimerRef.current);
        historyTimerRef.current = null;
      }
    };
  }, []);
  const emitNow = (0, import_react4.useCallback)((kind) => {
    const el = editorRef.current;
    if (el) htmlRef.current = el.innerHTML;
    const payload = {
      html: htmlRef.current,
      color: colorRef.current,
      textColor: textColorRef.current,
      alarmAt: alarmRef.current
    };
    const created = !!noteIdRef.current;
    const isMeta = kind === "meta";
    if (!created && !isMeta && isBlankHtml(payload.html)) return;
    const last = lastEmittedRef.current;
    if (last && last.html === payload.html && last.color === payload.color && last.textColor === payload.textColor && last.alarmAt === payload.alarmAt) {
      return;
    }
    lastEmittedRef.current = payload;
    try {
      if (typeof onChangeRef.current === "function") onChangeRef.current(payload);
    } catch (err) {
      console.error("[sticky-wall] onChange failed", err);
    }
  }, []);
  const emitRef = (0, import_react4.useRef)(emitNow);
  emitRef.current = emitNow;
  const scheduleSave = (0, import_react4.useCallback)(
    (kind) => {
      pendingKindRef.current = kind || "content";
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null;
        const pending = pendingKindRef.current;
        pendingKindRef.current = "content";
        emitNow(pending);
      }, SAVE_DELAY);
    },
    [emitNow]
  );
  const flushSave = (0, import_react4.useCallback)(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const kind = pendingKindRef.current;
    pendingKindRef.current = "content";
    emitNow(kind);
  }, [emitNow]);
  const saveSelection = (0, import_react4.useCallback)(() => {
    const el = editorRef.current;
    const selection = typeof window !== "undefined" ? window.getSelection() : null;
    if (!el || !selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (el.contains(range.commonAncestorContainer)) {
      lastRangeRef.current = range.cloneRange();
    }
  }, []);
  const restoreSelection = (0, import_react4.useCallback)(() => {
    const el = editorRef.current;
    if (!el) return;
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
  (0, import_react4.useEffect)(() => {
    return () => {
      const node = editorRef.current;
      if (node && typeof node.blur === "function") {
        try {
          node.blur();
        } catch (err) {
        }
      }
    };
  }, []);
  (0, import_react4.useEffect)(() => {
    const onSelectionChange = () => {
      const el = editorRef.current;
      const selection = window.getSelection();
      if (!el || !selection || selection.rangeCount === 0) return;
      const range = selection.getRangeAt(0);
      if (el.contains(range.commonAncestorContainer)) {
        lastRangeRef.current = range.cloneRange();
      }
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, []);
  const syncHistoryFlags = (0, import_react4.useCallback)(() => {
    const history = historyRef.current;
    setHistoryFlags({ undo: canUndo(history), redo: canRedo(history) });
  }, []);
  const pushHistoryNow = (0, import_react4.useCallback)(
    (snapshot) => {
      if (historyTimerRef.current) {
        clearTimeout(historyTimerRef.current);
        historyTimerRef.current = null;
      }
      const el = editorRef.current;
      const html = typeof snapshot === "string" ? snapshot : el ? el.innerHTML : null;
      if (typeof html !== "string") return;
      const next = historyPush(historyRef.current, html);
      if (next !== historyRef.current) {
        historyRef.current = next;
        syncHistoryFlags();
      }
    },
    [syncHistoryFlags]
  );
  const commitHistory = (0, import_react4.useCallback)(() => {
    pushHistoryNow();
  }, [pushHistoryNow]);
  const scheduleHistory = (0, import_react4.useCallback)(() => {
    if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
    setHistoryFlags((flags) => flags.undo ? flags : { ...flags, undo: true });
    historyTimerRef.current = setTimeout(() => {
      historyTimerRef.current = null;
      commitHistory();
    }, HISTORY_DELAY);
  }, [commitHistory]);
  const handleInput = (0, import_react4.useCallback)(() => {
    const el = editorRef.current;
    if (!el) return;
    htmlRef.current = el.innerHTML;
    setEmpty(isBlankHtml(htmlRef.current));
    setContentRev((value) => value + 1);
    const selected = selectedImageRef.current;
    if (selected && selected.isConnected === false) {
      selectedImageRef.current = null;
      setSelectedImage(null);
    }
    scheduleSave("content");
    if (!composingRef.current) scheduleHistory();
  }, [scheduleSave, scheduleHistory]);
  const clearImageSelection = (0, import_react4.useCallback)(() => {
    if (!selectedImageRef.current) return;
    selectedImageRef.current = null;
    setSelectedImage(null);
  }, []);
  const selectImage = (0, import_react4.useCallback)((node) => {
    if (!node || node.isConnected === false) return;
    selectedImageRef.current = node;
    setSelectedImage(node);
    setContentRev((value) => value + 1);
  }, []);
  const handleDoubleClick = (0, import_react4.useCallback)(
    (event) => {
      const el = editorRef.current;
      const target = event && event.target;
      if (!el || !target) return;
      if (String(target.tagName || "").toUpperCase() !== "IMG") return;
      if (!el.contains(target)) return;
      if (event.cancelable) preventDefault(event);
      selectImage(target);
    },
    [selectImage]
  );
  (0, import_react4.useEffect)(() => {
    if (!selectedImage) return void 0;
    const onPointerDown = (event) => {
      const node = selectedImageRef.current;
      const target = event && event.target;
      if (!node || !target) return;
      if (target === node || typeof node.contains === "function" && node.contains(target)) return;
      if (typeof target.closest === "function" && target.closest("[data-sw-image-overlay]")) return;
      clearImageSelection();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [selectedImage, clearImageSelection]);
  const getMaxImageWidth = (0, import_react4.useCallback)(() => editorContentWidth(editorRef.current), []);
  const handleImageResizeCommit = (0, import_react4.useCallback)(() => {
    handleInput();
    pushHistoryNow();
  }, [handleInput, pushHistoryNow]);
  const handleImageDelete = (0, import_react4.useCallback)(
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
      pushHistoryNow(before);
      pushHistoryNow();
    },
    [clearImageSelection, handleInput, pushHistoryNow]
  );
  const insertImageUrl = (0, import_react4.useCallback)(
    (url) => {
      const el = editorRef.current;
      if (!el || !url) return;
      restoreSelection();
      const selection = window.getSelection();
      const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
      const img = document.createElement("img");
      img.setAttribute("src", url);
      img.setAttribute("alt", "");
      img.setAttribute("data-note-media", "1");
      img.setAttribute("style", IMG_STYLE);
      if (range && el.contains(range.commonAncestorContainer)) {
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
      pushHistoryNow();
    },
    [restoreSelection, handleInput, pushHistoryNow]
  );
  const uploadAndInsert = (0, import_react4.useCallback)(
    async (dataUrl) => {
      if (!dataUrl) return;
      const upload = uploadRef.current;
      if (typeof upload !== "function") {
        setHint("\u56FE\u7247\u4E0A\u4F20\u4E0D\u53EF\u7528");
        return;
      }
      setHint("\u56FE\u7247\u4E0A\u4F20\u4E2D\u2026");
      try {
        const result = await upload(dataUrl);
        const url = result && result.url;
        if (!url) throw new Error("\u4E0A\u4F20\u63A5\u53E3\u672A\u8FD4\u56DE url");
        insertImageUrl(url);
        setHint(null);
      } catch (err) {
        if (!mountedRef.current) return;
        setHint("\u56FE\u7247\u4E0A\u4F20\u5931\u8D25\uFF1A" + (err && err.message ? err.message : String(err)));
      }
    },
    [insertImageUrl]
  );
  const pickImage = (0, import_react4.useCallback)(() => {
    saveSelection();
    const input = fileInputRef.current;
    if (input) input.click();
  }, [saveSelection]);
  const handleFileChange = (0, import_react4.useCallback)(
    (event) => {
      const input = event.target;
      const file = input && input.files && input.files[0];
      if (input) input.value = "";
      if (!file) return;
      saveSelection();
      readFileAsDataUrl(file).then(uploadAndInsert).catch(() => setHint("\u8BFB\u53D6\u56FE\u7247\u5931\u8D25"));
    },
    [saveSelection, uploadAndInsert]
  );
  const handlePaste = (0, import_react4.useCallback)(
    (event) => {
      const files = collectImageFiles(event.clipboardData);
      if (files.length === 0) return;
      event.preventDefault();
      saveSelection();
      readFileAsDataUrl(files[0]).then(uploadAndInsert).catch(() => setHint("\u8BFB\u53D6\u526A\u8D34\u677F\u56FE\u7247\u5931\u8D25"));
    },
    [saveSelection, uploadAndInsert]
  );
  const handleDragOver = (0, import_react4.useCallback)((event) => {
    if (dragHasFiles(event.dataTransfer && event.dataTransfer.types)) preventDefault(event);
  }, []);
  const handleDrop = (0, import_react4.useCallback)(
    (event) => {
      const files = collectImageFiles(event.dataTransfer);
      if (files.length === 0) return;
      event.preventDefault();
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
      readFileAsDataUrl(files[0]).then(uploadAndInsert).catch(() => setHint("\u8BFB\u53D6\u62D6\u5165\u56FE\u7247\u5931\u8D25"));
    },
    [saveSelection, uploadAndInsert]
  );
  const openInk = (0, import_react4.useCallback)(async () => {
    saveSelection();
    setInkError(null);
    setInkLoading(true);
    try {
      const mod = await Promise.resolve().then(() => (init_ink(), ink_exports));
      const component = mod && (mod.InkPad || mod.default);
      if (typeof component !== "function") throw new Error("InkPad \u672A\u5BFC\u51FA");
      inkComponentRef.current = component;
      inkOpenRef.current = true;
      setInkOpen(true);
    } catch (err) {
      console.error("[sticky-wall] ink pad load failed", err);
      setInkError("\u624B\u5199\u7EC4\u4EF6\u52A0\u8F7D\u5931\u8D25");
    } finally {
      if (mountedRef.current) setInkLoading(false);
    }
  }, [saveSelection]);
  const closeInk = (0, import_react4.useCallback)(() => {
    inkOpenRef.current = false;
    setInkOpen(false);
  }, []);
  const handleInkDone = (0, import_react4.useCallback)(
    async (dataUrl) => {
      closeInk();
      if (!dataUrl) return;
      const hasInk = await dataUrlHasVisibleInk(dataUrl);
      if (!hasInk) {
        if (mountedRef.current) setHint("\u753B\u677F\u662F\u7A7A\u7684");
        return;
      }
      uploadAndInsert(dataUrl);
    },
    [closeInk, uploadAndInsert]
  );
  const applyCommand = (0, import_react4.useCallback)(
    (command, value) => {
      const el = editorRef.current;
      if (!el) return;
      restoreSelection();
      try {
        document.execCommand("styleWithCSS", false, "false");
      } catch (err) {
      }
      let ok = false;
      try {
        ok = document.execCommand(command, false, value == null ? null : value);
      } catch (err) {
        ok = false;
      }
      el.focus();
      saveSelection();
      if (!ok) setHint("\u5F53\u524D\u6D4F\u89C8\u5668\u4E0D\u652F\u6301\u8BE5\u683C\u5F0F\u64CD\u4F5C");
      handleInput();
    },
    [restoreSelection, saveSelection, handleInput]
  );
  const toggleHeading = (0, import_react4.useCallback)(() => {
    const el = editorRef.current;
    if (!el) return;
    restoreSelection();
    let block = "";
    try {
      block = String(document.queryCommandValue("formatBlock") || "").toLowerCase();
    } catch (err) {
      block = "";
    }
    if (block === "h2") applyCommand("formatBlock", "P");
    else applyCommand("formatBlock", "H2");
  }, [restoreSelection, applyCommand]);
  const clearFormatting = (0, import_react4.useCallback)(() => {
    applyCommand("removeFormat");
  }, [applyCommand]);
  const applyHistoryStep = (0, import_react4.useCallback)(
    (direction) => {
      commitHistory();
      const base = historyRef.current;
      const next = direction === "undo" ? historyUndo(base) : historyRedo(base);
      if (!next) {
        setHint(direction === "undo" ? "\u6CA1\u6709\u53EF\u64A4\u9500\u7684\u64CD\u4F5C" : "\u6CA1\u6709\u53EF\u91CD\u505A\u7684\u64CD\u4F5C");
        return;
      }
      historyRef.current = next;
      const html = currentSnapshot(next);
      const el = editorRef.current;
      if (el) {
        el.innerHTML = html;
        placeCaretAtEnd(el);
      }
      clearImageSelection();
      setContentRev((value) => value + 1);
      htmlRef.current = html;
      lastRangeRef.current = null;
      setEmpty(isBlankHtml(html));
      syncHistoryFlags();
      scheduleSave("content");
    },
    [commitHistory, clearImageSelection, scheduleSave, syncHistoryFlags]
  );
  const doUndo = (0, import_react4.useCallback)(() => applyHistoryStep("undo"), [applyHistoryStep]);
  const doRedo = (0, import_react4.useCallback)(() => applyHistoryStep("redo"), [applyHistoryStep]);
  const persistMeta = (0, import_react4.useCallback)(() => {
    if (noteIdRef.current) emitNow("meta");
    else scheduleSave("meta");
  }, [emitNow, scheduleSave]);
  const applyBackground = (0, import_react4.useCallback)(
    (value) => {
      const next = normalizeHexColor(value, colorRef.current);
      if (next === colorRef.current) return;
      colorRef.current = next;
      setColor(next);
      persistMeta();
    },
    [persistMeta]
  );
  const applyTextColor = (0, import_react4.useCallback)(
    (value) => {
      const next = normalizeHexColor(value, textColorRef.current);
      if (next === textColorRef.current) return;
      textColorRef.current = next;
      setTextColor(next);
      persistMeta();
    },
    [persistMeta]
  );
  const handleAlarmInput = (0, import_react4.useCallback)(
    (event) => {
      const next = localInputToMs(event.target.value);
      alarmRef.current = next;
      setAlarmAt(next);
      persistMeta();
    },
    [persistMeta]
  );
  const clearAlarm = (0, import_react4.useCallback)(() => {
    if (alarmRef.current == null) return;
    alarmRef.current = null;
    setAlarmAt(null);
    persistMeta();
  }, [persistMeta]);
  const handleClose = (0, import_react4.useCallback)(() => {
    flushSave();
    const close = onCloseRef.current;
    if (typeof close === "function") close();
  }, [flushSave]);
  const handleKeyDown = (0, import_react4.useCallback)(
    (event) => {
      const target = event.target;
      const tag = target && target.tagName ? String(target.tagName).toUpperCase() : "";
      const inField = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (event.key === "Escape") {
        preventDefault(event);
        if (inkOpenRef.current) closeInk();
        else if (selectedImageRef.current) clearImageSelection();
        else handleClose();
        return;
      }
      if (inField) return;
      const mod = event.metaKey || event.ctrlKey;
      if (mod && String(event.key).toLowerCase() === "z") {
        preventDefault(event);
        if (event.shiftKey) doRedo();
        else doUndo();
        return;
      }
      if (mod && String(event.key).toLowerCase() === "y") {
        preventDefault(event);
        doRedo();
        return;
      }
      if (mod && String(event.key).toLowerCase() === "s") {
        preventDefault(event);
        flushSave();
      }
    },
    [closeInk, clearImageSelection, doRedo, doUndo, flushSave, handleClose]
  );
  (0, import_react4.useEffect)(() => {
    const incomingHtml = note && typeof note.html === "string" ? note.html : "";
    const nextColor = normalizeHexColor(note && note.color, DEFAULT_BG);
    const nextText = normalizeHexColor(note && note.textColor, DEFAULT_TEXT);
    const nextAlarm = typeof (note && note.alarmAt) === "number" ? note.alarmAt : null;
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
    clearImageSelection();
    const el = editorRef.current;
    const current = htmlRef.current || "";
    if (el && incomingHtml !== current) {
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
      alarmAt: nextAlarm
    };
    setEmpty(isBlankHtml(incomingHtml));
    try {
      document.execCommand("defaultParagraphSeparator", false, "p");
    } catch (err) {
    }
  }, [noteId, clearImageSelection, syncHistoryFlags]);
  (0, import_react4.useEffect)(() => {
    if (!hint) return void 0;
    const timer = setTimeout(() => {
      if (mountedRef.current) setHint(null);
    }, 2600);
    return () => clearTimeout(timer);
  }, [hint]);
  const InkPad2 = inkOpen ? inkComponentRef.current : null;
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: s2.root, role: "dialog", "aria-label": "\u7F16\u8F91\u4FBF\u7B7E", onKeyDown: handleKeyDown, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: s2.header, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: s2.title, children: [
        "\u7F16\u8F91\u4FBF\u7B7E",
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { fontSize: 11, fontWeight: 400, opacity: 0.6, marginLeft: 8, whiteSpace: "nowrap" }, children: "\u5185\u5BB9\u81EA\u52A8\u4FDD\u5B58" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
        "button",
        {
          type: "button",
          style: { ...s2.closeButton, display: "inline-flex", alignItems: "center", gap: 6, paddingRight: 10 },
          title: "\u5185\u5BB9\u4F1A\u81EA\u52A8\u4FDD\u5B58\uFF1B\u70B9\u8FD9\u91CC\u4FDD\u5B58\u5E76\u5173\u95ED",
          "aria-label": "\u4FDD\u5B58\u5E76\u5173\u95ED",
          onMouseDown: preventDefault,
          onClick: handleClose,
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { "aria-hidden": "true", style: { fontSize: 18, lineHeight: 1 }, children: "\xD7" }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { fontSize: 12, opacity: 0.75, whiteSpace: "nowrap" }, children: "\u4FDD\u5B58\u5E76\u5173\u95ED" })
          ]
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: s2.toolbar, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: toolRow, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(ToolButton2, { label: "B", title: "\u52A0\u7C97", bold: true, onPress: () => applyCommand("bold") }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(ToolButton2, { label: "I", title: "\u659C\u4F53", italic: true, onPress: () => applyCommand("italic") }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          ToolButton2,
          {
            label: "U",
            title: "\u4E0B\u5212\u7EBF",
            underline: true,
            onPress: () => applyCommand("underline")
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(ToolButton2, { label: "S", title: "\u5220\u9664\u7EBF", strike: true, onPress: () => applyCommand("strikeThrough") }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: dividerStyle, "aria-hidden": "true" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(ToolButton2, { label: "H2", title: "\u6807\u9898", onPress: toggleHeading }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(ToolButton2, { label: "\u6E05\u9664\u683C\u5F0F", title: "\u6E05\u9664\u683C\u5F0F", onPress: clearFormatting })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: toolRow, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(ToolButton2, { label: "\u63D2\u5165\u56FE\u7247", title: "\u63D2\u5165\u56FE\u7247\u5230\u5149\u6807\u5904", onPress: pickImage }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          ToolButton2,
          {
            label: inkLoading ? "\u624B\u5199\u2026" : "\u624B\u5199",
            title: "\u624B\u5199\u753B\u677F",
            onPress: openInk
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: dividerStyle, "aria-hidden": "true" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          ToolButton2,
          {
            label: "\u64A4\u9500",
            title: "\u64A4\u9500 (Ctrl/Cmd+Z)",
            onPress: doUndo,
            disabled: !historyFlags.undo
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          ToolButton2,
          {
            label: "\u91CD\u505A",
            title: "\u91CD\u505A (Ctrl/Cmd+Shift+Z \u6216 Ctrl+Y)",
            onPress: doRedo,
            disabled: !historyFlags.redo
          }
        )
      ] }),
      inkError ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: s2.inlineError, children: inkError }) : null
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
      "div",
      {
        ref: canvasWrapRef,
        style: { ...s2.canvasWrap, background: color, color: textColor },
        onScroll: clearImageSelection,
        children: [
          empty ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { ...s2.placeholder, color: textColor }, "aria-hidden": "true", children: "\u5199\u70B9\u4EC0\u4E48\u2026" }) : null,
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            "div",
            {
              ref: editorRef,
              className: "dsh-sticky-wall-editor",
              contentEditable: true,
              suppressContentEditableWarning: true,
              role: "textbox",
              "aria-multiline": "true",
              "aria-label": "\u4FBF\u7B7E\u5185\u5BB9",
              style: s2.canvas,
              onInput: handleInput,
              onMouseUp: saveSelection,
              onKeyUp: saveSelection,
              onBlur: saveSelection,
              onDoubleClick: handleDoubleClick,
              onPaste: handlePaste,
              onDrop: handleDrop,
              onDragOver: handleDragOver,
              onCompositionStart: () => {
                composingRef.current = true;
              },
              onCompositionEnd: () => {
                composingRef.current = false;
                handleInput();
              }
            }
          ),
          selectedImage ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            ImageResizeOverlay,
            {
              img: selectedImage,
              revision: contentRev,
              wrapRef: canvasWrapRef,
              maxWidth: getMaxImageWidth,
              onCommit: handleImageResizeCommit,
              onDelete: handleImageDelete,
              onDeselect: clearImageSelection
            }
          ) : null
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: s2.footer, children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: s2.footerRow, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: s2.label, children: "\u5E95\u8272" }),
        paletteList.map((option, index) => {
          const swatch = normalizeHexColor(option, "#ffffff");
          return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            "button",
            {
              type: "button",
              title: option,
              "aria-label": "\u4FBF\u7B7E\u5E95\u8272 " + option,
              onMouseDown: preventDefault,
              onClick: () => applyBackground(swatch),
              style: { ...swatchStyle(swatch === color), background: swatch }
            },
            "bg-" + index + "-" + option
          );
        }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("label", { style: s2.colorPicker, title: "\u81EA\u5B9A\u4E49\u5E95\u8272", children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            "input",
            {
              type: "color",
              value: color,
              style: s2.colorInput,
              onChange: (event) => applyBackground(event.target.value)
            }
          ),
          "\u81EA\u5B9A\u4E49"
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: s2.footerRow, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: s2.label, children: "\u6587\u5B57" }),
        DEFAULT_TEXT_SWATCHES.map((option) => {
          const swatch = normalizeHexColor(option, DEFAULT_TEXT);
          return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            "button",
            {
              type: "button",
              title: option,
              "aria-label": "\u6587\u5B57\u989C\u8272 " + option,
              onMouseDown: preventDefault,
              onClick: () => applyTextColor(swatch),
              style: { ...swatchStyle(swatch === textColor), background: swatch }
            },
            "fg-" + option
          );
        }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("label", { style: s2.colorPicker, title: "\u81EA\u5B9A\u4E49\u6587\u5B57\u989C\u8272", children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
            "input",
            {
              type: "color",
              value: textColor,
              style: s2.colorInput,
              onChange: (event) => applyTextColor(event.target.value)
            }
          ),
          "\u81EA\u5B9A\u4E49"
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { style: s2.footerRow, children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: s2.label, children: "\u63D0\u9192" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "input",
          {
            type: "datetime-local",
            value: msToLocalInput(alarmAt),
            style: fieldStyle,
            "aria-label": "\u63D0\u9192\u65F6\u95F4",
            onChange: handleAlarmInput
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "button",
          {
            type: "button",
            onMouseDown: preventDefault,
            onClick: clearAlarm,
            disabled: alarmAt == null,
            style: { ...baseButton, fontSize: 12, opacity: alarmAt == null ? 0.42 : 1 },
            children: "\u6E05\u9664\u63D0\u9192"
          }
        )
      ] }),
      typeof onDeliver === "function" ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { display: "flex", justifyContent: "flex-end", marginTop: 10 }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
        "button",
        {
          type: "button",
          style: {
            ...baseButton,
            display: "inline-flex",
            alignItems: "center",
            gap: 6
          },
          title: "\u628A\u8FD9\u5F20\u4FBF\u7B7E\u53D1\u9001\u5230\u67D0\u4E2A\u4F1A\u8BDD",
          "aria-label": "\u53D1\u9001\u5230\u4F1A\u8BDD",
          onClick: () => onDeliver(note),
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { "aria-hidden": "true", children: "\u{1F4E4}" }),
            /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { style: { whiteSpace: "nowrap" }, children: "\u53D1\u9001\u5230\u4F1A\u8BDD" })
          ]
        }
      ) }) : null
    ] }),
    hint ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: s2.toast, children: hint }) : null,
    inkOpen && InkPad2 && typeof document !== "undefined" ? (0, import_react_dom.createPortal)(
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { position: "fixed", inset: 0, zIndex: 1300 }, children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        InkPad2,
        {
          width: 440,
          height: 280,
          color: textColor,
          onDone: handleInkDone,
          onCancel: closeInk
        }
      ) }),
      document.body
    ) : null,
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "input",
      {
        ref: fileInputRef,
        type: "file",
        accept: "image/*",
        style: { display: "none" },
        onChange: handleFileChange
      }
    )
  ] });
}

// client/settings.js
var import_react5 = require("react");

// client/palette.js
var MORANDI_EXTRA = [
  "#dcd6cc",
  "#c9d2ce",
  "#c7d3dc",
  "#dcd2db",
  "#e3dcd2",
  "#cfcbc3",
  "#bcd0ce",
  "#d8cfc7"
];
var AUTO_ORDER = [
  "#c8e6c9",
  "#b3e5fc",
  "#d1c4e9",
  "#ffcdd2",
  "#fff3a3",
  "#ffe0b2",
  "#f8bbd0",
  "#e0e0e0",
  ...MORANDI_EXTRA
];
function normalizeHex(value) {
  if (typeof value !== "string") return null;
  const raw = value.trim().toLowerCase();
  const long = /^#[0-9a-f]{6}$/;
  const short = /^#[0-9a-f]{3}$/;
  if (long.test(raw)) return raw;
  if (short.test(raw)) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`;
  }
  return null;
}
function autoNoteColor(index) {
  const hue = Number(index || 0) * 137.508 % 360;
  return hslToHex(hue, 72, 93);
}
function hslToHex(h, s3, l) {
  const sat = Math.min(100, Math.max(0, s3)) / 100;
  const lig = Math.min(100, Math.max(0, l)) / 100;
  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const hp = (h % 360 + 360) % 360 / 60;
  const x = c * (1 - Math.abs(hp % 2 - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp < 1) {
    r = c;
    g = x;
  } else if (hp < 2) {
    r = x;
    g = c;
  } else if (hp < 3) {
    g = c;
    b = x;
  } else if (hp < 4) {
    g = x;
    b = c;
  } else if (hp < 5) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  const m = lig - c / 2;
  const to = (v) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return "#" + to(r) + to(g) + to(b);
}
function pickAutoColor(notes) {
  const list = Array.isArray(notes) ? notes : [];
  const used = /* @__PURE__ */ new Set();
  for (const note of list) {
    const hex = normalizeHex(note?.color);
    if (hex) used.add(hex);
  }
  for (let i = 0; i < 90; i += 1) {
    const hex = autoNoteColor(list.length + i);
    if (!used.has(hex)) return { color: hex, distinct: true };
  }
  return { color: autoNoteColor(list.length), distinct: false };
}
function resolveNewNoteColor2(notes, wall) {
  const config = wall && wall.newNoteColor;
  if (config && config.mode === "fixed") {
    const fixed = normalizeHex(config.color);
    if (fixed) return { color: config.color, distinct: true };
  }
  return pickAutoColor(notes);
}

// client/settings.js
var import_jsx_runtime5 = require("react/jsx-runtime");
var WALL_DEFAULTS = {
  bg: { kind: "color", color: "#f4f1ea", mediaId: null, dim: 0.55 },
  columns: 3,
  cardWidth: 260,
  cardHeight: 220,
  hoverScale: 1.5,
  gap: 22,
  fontSize: 14
};
var THROTTLE_MS = 120;
var PANEL_WIDTH2 = 312;
var C = {
  panel: "var(--dsh-bg-elevated, var(--dsh-bg, #ffffff))",
  surface: "var(--dsh-surface, rgba(127, 127, 127, 0.10))",
  surfaceStrong: "var(--dsh-surface-hover, rgba(127, 127, 127, 0.18))",
  text: "var(--dsh-text, var(--dsh-text-primary, #1f2430))",
  sub: "var(--dsh-text-secondary, #667085)",
  border: "var(--dsh-border, rgba(127, 127, 127, 0.30))",
  accent: "var(--dsh-accent, #4d6bfe)",
  danger: "var(--dsh-danger, #d64545)",
  shadow: "var(--dsh-shadow-elevated, 0 14px 36px rgba(0, 0, 0, 0.20))"
};
var BG_COLORS = ["#f4f1ea", "#ffffff", "#eef2f7", "#e9f3ef", "#f7ece1", "#1b1f27"];
var clamp2 = (v, min, max) => Math.min(max, Math.max(min, v));
function num(v, fallback, min, max) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? clamp2(n, min, max) : fallback;
}
function normalizeWall(wall) {
  const src = wall && typeof wall === "object" ? wall : {};
  const bg = src.bg && typeof src.bg === "object" ? src.bg : {};
  const kind = bg.kind === "image" || bg.kind === "none" ? bg.kind : "color";
  return {
    bg: {
      kind,
      color: typeof bg.color === "string" && bg.color ? bg.color : WALL_DEFAULTS.bg.color,
      mediaId: bg.mediaId == null || bg.mediaId === "" ? null : bg.mediaId,
      dim: num(bg.dim, WALL_DEFAULTS.bg.dim, 0, 1)
    },
    columns: num(src.columns, WALL_DEFAULTS.columns, 1, 8),
    cardWidth: num(src.cardWidth, WALL_DEFAULTS.cardWidth, 160, 520),
    cardHeight: num(src.cardHeight, WALL_DEFAULTS.cardHeight, 120, 560),
    hoverScale: num(src.hoverScale, WALL_DEFAULTS.hoverScale, 1, 3),
    gap: num(src.gap, WALL_DEFAULTS.gap, 0, 80),
    fontSize: num(src.fontSize, WALL_DEFAULTS.fontSize, 10, 28)
  };
}
function mediaSrc(mediaId) {
  if (!mediaId) return "";
  const s3 = String(mediaId);
  if (/^(?:data:|blob:|https?:|\/)/i.test(s3)) return s3;
  return "/sticky-wall/media/" + encodeURIComponent(s3);
}
function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error || new Error("\u8BFB\u53D6\u56FE\u7247\u5931\u8D25"));
    reader.readAsDataURL(file);
  });
}
var fmt = (v, digits) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "\u2014";
  const p = Math.pow(10, digits || 0);
  return String(Math.round(n * p) / p);
};
function Section({ title, hint, children }) {
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { marginBottom: 14 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 8,
          margin: "0 0 7px"
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { fontSize: 11, fontWeight: 700, letterSpacing: 0.3, color: C.sub }, children: title }),
          hint ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { fontSize: 10.5, color: C.sub, opacity: 0.85 }, children: hint }) : null
        ]
      }
    ),
    children
  ] });
}
function SliderRow({ label, value, min, max, step, display, onInput }) {
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { marginBottom: 9 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 3
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { fontSize: 12, color: C.text }, children: label }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            "span",
            {
              style: {
                fontSize: 11.5,
                fontWeight: 600,
                color: C.sub,
                fontVariantNumeric: "tabular-nums",
                minWidth: 34,
                textAlign: "right"
              },
              children: display
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      "input",
      {
        type: "range",
        min,
        max,
        step,
        value,
        "aria-label": label,
        onChange: (e) => onInput(Number(e.target.value)),
        style: { width: "100%", margin: 0, accentColor: C.accent, cursor: "pointer" }
      }
    )
  ] });
}
function segStyle(active) {
  return {
    flex: 1,
    padding: "6px 0",
    fontSize: 12,
    fontWeight: active ? 700 : 500,
    lineHeight: 1.4,
    textAlign: "center",
    borderRadius: 7,
    cursor: active ? "default" : "pointer",
    border: "1px solid " + (active ? "transparent" : C.border),
    background: active ? C.accent : "transparent",
    color: active ? "#fff" : C.sub,
    transition: "background 120ms ease, color 120ms ease",
    userSelect: "none"
  };
}
function WallSettings({ wall, palette, onChange, onClose, uploadImage }) {
  const MINI_PALETTE = Array.from({ length: 8 }, (_, i) => autoNoteColor(i));
  const [draft, setDraft] = (0, import_react5.useState)(() => normalizeWall(wall));
  const draftRef = (0, import_react5.useRef)(draft);
  draftRef.current = draft;
  const onChangeRef = (0, import_react5.useRef)(onChange);
  onChangeRef.current = onChange;
  const [preview, setPreview] = (0, import_react5.useState)(null);
  const [busy, setBusy] = (0, import_react5.useState)(false);
  const [error, setError] = (0, import_react5.useState)("");
  const [shown, setShown] = (0, import_react5.useState)(false);
  const fileRef = (0, import_react5.useRef)(null);
  const pendingRef = (0, import_react5.useRef)(null);
  const timerRef = (0, import_react5.useRef)(null);
  const rafRef = (0, import_react5.useRef)(0);
  const lastEmitRef = (0, import_react5.useRef)(0);
  const wallJson = JSON.stringify(normalizeWall(wall));
  const adoptedRef = (0, import_react5.useRef)(null);
  (0, import_react5.useEffect)(() => {
    if (adoptedRef.current === wallJson) return;
    adoptedRef.current = wallJson;
    if (JSON.stringify(draftRef.current) !== wallJson) {
      const next = JSON.parse(wallJson);
      draftRef.current = next;
      setDraft(next);
    }
  }, [wallJson]);
  (0, import_react5.useEffect)(() => {
    const raf = typeof requestAnimationFrame === "function" ? requestAnimationFrame(() => setShown(true)) : (setShown(true), 0);
    return () => {
      if (raf && typeof cancelAnimationFrame === "function") cancelAnimationFrame(raf);
    };
  }, []);
  const drain = (0, import_react5.useCallback)(() => {
    const patch = pendingRef.current;
    pendingRef.current = null;
    if (!patch) return;
    lastEmitRef.current = Date.now();
    const fn = onChangeRef.current;
    if (typeof fn !== "function") return;
    try {
      fn(patch);
    } catch (err) {
      console.error("[sticky-wall] WallSettings onChange \u5931\u8D25", err);
    }
  }, []);
  const queue = (0, import_react5.useCallback)(
    (patch) => {
      pendingRef.current = Object.assign({}, pendingRef.current || {}, patch);
      if (timerRef.current) return;
      const wait = Math.max(0, THROTTLE_MS - (Date.now() - lastEmitRef.current));
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (typeof requestAnimationFrame === "function") {
          rafRef.current = requestAnimationFrame(() => {
            rafRef.current = 0;
            drain();
          });
        } else {
          drain();
        }
      }, wait);
    },
    [drain]
  );
  const flushNow = (0, import_react5.useCallback)((patch) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (rafRef.current && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    pendingRef.current = null;
    if (!patch) return;
    lastEmitRef.current = Date.now();
    const fn = onChangeRef.current;
    if (typeof fn !== "function") return;
    try {
      fn(patch);
    } catch (err) {
      console.error("[sticky-wall] WallSettings onChange \u5931\u8D25", err);
    }
  }, []);
  (0, import_react5.useEffect)(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      if (rafRef.current && typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      const patch = pendingRef.current;
      pendingRef.current = null;
      if (!patch) return;
      const fn = onChangeRef.current;
      if (typeof fn !== "function") return;
      try {
        fn(patch);
      } catch (err) {
      }
    },
    []
  );
  const apply2 = (0, import_react5.useCallback)(
    (patch) => {
      const next = { ...draftRef.current, ...patch };
      draftRef.current = next;
      setDraft(next);
      queue(patch);
    },
    [queue]
  );
  const setField = (0, import_react5.useCallback)((field, value) => apply2({ [field]: value }), [apply2]);
  const setBg = (0, import_react5.useCallback)(
    (part) => {
      const bg2 = { ...draftRef.current.bg, ...part };
      apply2({ bg: bg2 });
    },
    [apply2]
  );
  const resetAll = (0, import_react5.useCallback)(() => {
    const next = normalizeWall(WALL_DEFAULTS);
    draftRef.current = next;
    setDraft(next);
    setPreview(null);
    setError("");
    flushNow({
      bg: { ...next.bg },
      columns: next.columns,
      cardWidth: next.cardWidth,
      cardHeight: next.cardHeight,
      hoverScale: next.hoverScale,
      gap: next.gap,
      fontSize: next.fontSize
    });
  }, [flushNow]);
  const pickFile = (0, import_react5.useCallback)(() => {
    if (typeof uploadImage !== "function") {
      setError("\u5F53\u524D\u73AF\u5883\u4E0D\u652F\u6301\u4E0A\u4F20\u56FE\u7247");
      return;
    }
    if (fileRef.current) fileRef.current.click();
  }, [uploadImage]);
  const handleFile = (0, import_react5.useCallback)(
    async (file) => {
      if (!file) return;
      if (!/^image\//.test(file.type || "")) {
        setError("\u8BF7\u9009\u62E9\u56FE\u7247\u6587\u4EF6");
        return;
      }
      setError("");
      setBusy(true);
      try {
        const dataUrl = await readAsDataURL(file);
        if (!dataUrl) throw new Error("\u8BFB\u53D6\u56FE\u7247\u5931\u8D25");
        const res = await uploadImage(dataUrl);
        const id = res && res.id != null ? String(res.id) : "";
        if (!id) throw new Error("\u4E0A\u4F20\u672A\u8FD4\u56DE\u56FE\u7247 id");
        setPreview({ id, src: res && res.url || dataUrl });
        setBg({ kind: "image", mediaId: id });
      } catch (err) {
        setError(err && err.message || "\u4E0A\u4F20\u5931\u8D25");
      } finally {
        setBusy(false);
      }
    },
    [uploadImage, setBg]
  );
  const bg = draft.bg;
  const mediaId = bg.mediaId;
  const previewSrc = preview && preview.id === String(mediaId) ? preview.src : mediaSrc(mediaId);
  const hasImage2 = bg.kind === "image" && !!mediaId;
  const stop = (e) => e.stopPropagation();
  const panelStyle = {
    position: "absolute",
    top: 10,
    right: 10,
    width: PANEL_WIDTH2,
    maxWidth: "calc(100% - 20px)",
    maxHeight: "calc(100% - 20px)",
    display: "flex",
    flexDirection: "column",
    boxSizing: "border-box",
    background: C.panel,
    color: C.text,
    border: "1px solid " + C.border,
    borderRadius: 14,
    boxShadow: C.shadow,
    zIndex: 60,
    overflow: "hidden",
    fontFamily: "inherit",
    fontSize: 13,
    lineHeight: 1.5,
    opacity: shown ? 1 : 0,
    transform: shown ? "translateX(0)" : "translateX(14px)",
    transition: "transform 160ms ease, opacity 160ms ease"
  };
  const headerStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    padding: "10px 12px",
    borderBottom: "1px solid " + C.border,
    background: C.surface,
    flex: "0 0 auto"
  };
  const bodyStyle = {
    padding: "12px 12px 6px",
    overflowY: "auto",
    overscrollBehavior: "contain",
    flex: "1 1 auto"
  };
  const footerStyle = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "9px 12px 11px",
    borderTop: "1px solid " + C.border,
    background: C.surface,
    flex: "0 0 auto"
  };
  const ghostBtn = {
    appearance: "none",
    border: "1px solid " + C.border,
    background: "transparent",
    color: C.text,
    borderRadius: 8,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    lineHeight: 1.4
  };
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
    "div",
    {
      role: "dialog",
      "aria-label": "\u5899\u8BBE\u7F6E",
      style: panelStyle,
      onWheel: stop,
      onPointerDown: stop,
      onDoubleClick: stop,
      onClick: stop,
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: headerStyle, children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { fontSize: 14, fontWeight: 700, letterSpacing: 0.2 }, children: "\u5899\u8BBE\u7F6E" }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
              "span",
              {
                style: {
                  fontSize: 10.5,
                  color: C.sub,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis"
                },
                children: "\u5B9E\u65F6\u751F\u6548"
              }
            )
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            "button",
            {
              type: "button",
              "aria-label": "\u5173\u95ED\u5899\u8BBE\u7F6E",
              title: "\u5173\u95ED",
              onClick: onClose,
              style: {
                width: 26,
                height: 26,
                flex: "0 0 auto",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
                border: "1px solid transparent",
                borderRadius: 8,
                background: "transparent",
                color: C.sub,
                fontSize: 17,
                lineHeight: 1,
                cursor: "pointer"
              },
              children: "\xD7"
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: bodyStyle, className: "dsh-sticky-wall-settings-body", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
            Section,
            {
              title: "\u65B0\u5EFA\u4FBF\u7B7E\u989C\u8272",
              hint: (draft.newNoteColor?.mode ?? "auto") === "fixed" ? "\u56FA\u5B9A" : "\u968F\u673A",
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { display: "flex", gap: 6, marginBottom: 9 }, children: [
                  { key: "auto", label: "\u968F\u673A\u914D\u8272" },
                  { key: "fixed", label: "\u56FA\u5B9A\u4E00\u79CD\u989C\u8272" }
                ].map((opt) => {
                  const active = (draft.newNoteColor?.mode ?? "auto") === opt.key;
                  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                    "button",
                    {
                      type: "button",
                      onClick: () => setField("newNoteColor", {
                        mode: opt.key,
                        color: draft.newNoteColor?.color ?? "#faf7e0"
                      }),
                      style: {
                        flex: 1,
                        padding: "7px 10px",
                        borderRadius: 8,
                        fontSize: 12,
                        cursor: "pointer",
                        border: active ? "1px solid #2563eb" : "1px solid rgba(0,0,0,.14)",
                        background: active ? "2563eb" : "transparent",
                        color: active ? "#fff" : "inherit"
                      },
                      children: opt.label
                    },
                    opt.key
                  );
                }) }),
                (draft.newNoteColor?.mode ?? "auto") === "fixed" ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" }, children: MINI_PALETTE.map((hex) => {
                  const active = (draft.newNoteColor?.color ?? "").toLowerCase() === hex.toLowerCase();
                  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                    "button",
                    {
                      type: "button",
                      "aria-label": hex,
                      title: hex,
                      onClick: () => setField("newNoteColor", { mode: "fixed", color: hex }),
                      style: {
                        width: 26,
                        height: 26,
                        borderRadius: 7,
                        cursor: "pointer",
                        background: hex,
                        border: active ? "2px solid #2563eb" : "1px solid rgba(0,0,0,.14)"
                      }
                    },
                    hex
                  );
                }) }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { fontSize: 11.5, opacity: 0.7, lineHeight: 1.5 }, children: "\u6309\u9EC4\u91D1\u89D2\u81EA\u52A8\u5206\u914D\u8272\u76F8\uFF0C\u5899\u4E0A\u7684\u4FBF\u7B7E\u4E0D\u4F1A\u649E\u8272\u3002" })
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(Section, { title: "\u80CC\u666F", hint: bg.kind === "none" ? "\u900F\u660E" : null, children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
              "div",
              {
                role: "group",
                "aria-label": "\u80CC\u666F\u7C7B\u578B",
                style: { display: "flex", gap: 6, marginBottom: 9 },
                children: [
                  ["color", "\u7EAF\u8272"],
                  ["image", "\u56FE\u7247"],
                  ["none", "\u65E0"]
                ].map(([kind, label]) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                  "button",
                  {
                    type: "button",
                    "aria-pressed": bg.kind === kind,
                    onClick: () => {
                      if (bg.kind === kind) return;
                      setBg({ kind });
                    },
                    style: segStyle(bg.kind === kind),
                    children: label
                  },
                  kind
                ))
              }
            ),
            bg.kind === "color" ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                  "input",
                  {
                    type: "color",
                    "aria-label": "\u80CC\u666F\u989C\u8272",
                    value: bg.color,
                    onChange: (e) => setBg({ color: e.target.value }),
                    style: {
                      width: 40,
                      height: 28,
                      padding: 0,
                      border: "1px solid " + C.border,
                      borderRadius: 7,
                      background: "transparent",
                      cursor: "pointer"
                    }
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                  "span",
                  {
                    style: {
                      fontSize: 12,
                      color: C.sub,
                      fontVariantNumeric: "tabular-nums",
                      textTransform: "uppercase"
                    },
                    children: bg.color
                  }
                )
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { display: "flex", gap: 6, flexWrap: "wrap" }, children: BG_COLORS.map((color) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                "button",
                {
                  type: "button",
                  title: color,
                  "aria-label": "\u80CC\u666F\u8272 " + color,
                  onClick: () => setBg({ color }),
                  style: {
                    width: 24,
                    height: 24,
                    padding: 0,
                    borderRadius: 7,
                    cursor: "pointer",
                    background: color,
                    border: "2px solid " + (bg.color.toLowerCase() === color.toLowerCase() ? C.accent : C.border)
                  }
                },
                color
              )) })
            ] }) : null,
            bg.kind === "image" ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: { display: "flex", gap: 6, marginBottom: 8 }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                  "button",
                  {
                    type: "button",
                    onClick: pickFile,
                    disabled: busy,
                    style: { ...ghostBtn, flex: "1 1 auto", opacity: busy ? 0.6 : 1 },
                    children: busy ? "\u4E0A\u4F20\u4E2D\u2026" : hasImage2 ? "\u66F4\u6362\u56FE\u7247" : "\u9009\u62E9\u56FE\u7247"
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                  "button",
                  {
                    type: "button",
                    onClick: () => {
                      setPreview(null);
                      setBg({ kind: "color", mediaId: null });
                    },
                    disabled: !mediaId,
                    title: "\u5220\u9664\u80CC\u666F\u56FE",
                    style: {
                      ...ghostBtn,
                      color: mediaId ? C.danger : C.sub,
                      opacity: mediaId ? 1 : 0.5
                    },
                    children: "\u5220\u9664"
                  }
                )
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                "input",
                {
                  ref: fileRef,
                  type: "file",
                  accept: "image/*",
                  style: { display: "none" },
                  onChange: (e) => {
                    const file = e.target.files && e.target.files[0];
                    handleFile(file);
                    e.target.value = "";
                  }
                }
              ),
              !hasImage2 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { style: { fontSize: 11.5, color: C.sub, marginBottom: 8 }, children: "\u8FD8\u6CA1\u6709\u9009\u62E9\u80CC\u666F\u56FE\u3002" }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
                "div",
                {
                  style: {
                    position: "relative",
                    borderRadius: 9,
                    overflow: "hidden",
                    border: "1px solid " + C.border,
                    background: C.surface,
                    marginBottom: 8,
                    height: 92
                  },
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                      "img",
                      {
                        src: previewSrc,
                        alt: "\u80CC\u666F\u56FE\u9884\u89C8",
                        style: {
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          display: "block"
                        },
                        onError: (e) => {
                          e.currentTarget.style.opacity = "0";
                        }
                      }
                    ),
                    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                      "div",
                      {
                        style: {
                          position: "absolute",
                          inset: 0,
                          background: `rgba(0, 0, 0, ${bg.dim})`,
                          pointerEvents: "none"
                        }
                      }
                    )
                  ]
                }
              )
            ] }) : null,
            bg.kind === "image" ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
              SliderRow,
              {
                label: "\u906E\u7F69\u5F3A\u5EA6",
                value: bg.dim,
                min: 0,
                max: 1,
                step: 0.01,
                display: Math.round(bg.dim * 100) + "%",
                onInput: (v) => setBg({ dim: v })
              }
            ) : null,
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
              "div",
              {
                style: {
                  position: "relative",
                  height: 62,
                  marginTop: 4,
                  borderRadius: 9,
                  overflow: "hidden",
                  border: "1px solid " + C.border,
                  background: bg.kind === "none" ? "repeating-linear-gradient(45deg, rgba(127,127,127,0.16) 0 6px, rgba(127,127,127,0.05) 6px 12px)" : bg.kind === "color" ? bg.color : "rgba(127, 127, 127, 0.22)"
                },
                children: [
                  hasImage2 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                    "img",
                    {
                      src: previewSrc,
                      alt: "",
                      "aria-hidden": "true",
                      style: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" },
                      onError: (e) => {
                        e.currentTarget.style.opacity = "0";
                      }
                    }
                  ) : null,
                  bg.kind === "image" ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                    "div",
                    {
                      style: {
                        position: "absolute",
                        inset: 0,
                        background: `rgba(0, 0, 0, ${bg.dim})`,
                        pointerEvents: "none"
                      }
                    }
                  ) : null,
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                    "div",
                    {
                      style: {
                        position: "absolute",
                        left: 8,
                        bottom: 6,
                        fontSize: 10,
                        color: bg.kind === "color" && isLight(bg.color) ? "rgba(31,36,48,0.6)" : "rgba(255,255,255,0.85)",
                        pointerEvents: "none"
                      },
                      children: bg.kind === "none" ? "\u900F\u660E\uFF08\u9732\u51FA\u5E94\u7528\u4E3B\u9898\uFF09" : bg.kind === "color" ? "\u7EAF\u8272\u80CC\u666F" : "\u56FE\u7247\u80CC\u666F \xB7 \u906E\u7F69 " + Math.round(bg.dim * 100) + "%"
                    }
                  )
                ]
              }
            )
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(Section, { title: "\u5E03\u5C40", children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
              SliderRow,
              {
                label: "\u540C\u5C4F\u5217\u6570",
                value: draft.columns,
                min: 1,
                max: 8,
                step: 1,
                display: draft.columns + " \u5217",
                onInput: (v) => setField("columns", v)
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
              SliderRow,
              {
                label: "\u5361\u7247\u5BBD\u5EA6",
                value: draft.cardWidth,
                min: 160,
                max: 520,
                step: 4,
                display: draft.cardWidth + " px",
                onInput: (v) => setField("cardWidth", v)
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
              SliderRow,
              {
                label: "\u5361\u7247\u9AD8\u5EA6",
                value: draft.cardHeight,
                min: 120,
                max: 560,
                step: 4,
                display: draft.cardHeight + " px",
                onInput: (v) => setField("cardHeight", v)
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
              SliderRow,
              {
                label: "\u5361\u7247\u95F4\u9699",
                value: draft.gap,
                min: 0,
                max: 80,
                step: 1,
                display: draft.gap + " px",
                onInput: (v) => setField("gap", v)
              }
            )
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(Section, { title: "\u9884\u89C8", children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
              SliderRow,
              {
                label: "hover \u653E\u5927\u500D\u6570",
                value: draft.hoverScale,
                min: 1,
                max: 3,
                step: 0.05,
                display: fmt(draft.hoverScale, 2) + "\xD7",
                onInput: (v) => setField("hoverScale", v)
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
              SliderRow,
              {
                label: "\u5899\u6574\u4F53\u5B57\u53F7",
                value: draft.fontSize,
                min: 10,
                max: 28,
                step: 1,
                display: draft.fontSize + " px",
                onInput: (v) => setField("fontSize", v)
              }
            )
          ] }),
          error ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            "div",
            {
              style: {
                fontSize: 11.5,
                color: C.danger,
                background: "rgba(214, 69, 69, 0.10)",
                border: "1px solid rgba(214, 69, 69, 0.35)",
                borderRadius: 8,
                padding: "6px 8px",
                marginBottom: 10,
                wordBreak: "break-word"
              },
              children: error
            }
          ) : null
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { style: footerStyle, children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", onClick: resetAll, style: { ...ghostBtn, flex: "1 1 auto" }, children: "\u6062\u590D\u9ED8\u8BA4" }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            "button",
            {
              type: "button",
              onClick: onClose,
              style: {
                ...ghostBtn,
                flex: "0 0 auto",
                background: C.accent,
                borderColor: "transparent",
                color: "#fff"
              },
              children: "\u5B8C\u6210"
            }
          )
        ] })
      ]
    }
  );
}
function isLight(hex) {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex || "").trim());
  if (!m) return true;
  let s3 = m[1];
  if (s3.length === 3) s3 = s3[0] + s3[0] + s3[1] + s3[1] + s3[2] + s3[2];
  const r = parseInt(s3.slice(0, 2), 16);
  const g = parseInt(s3.slice(2, 4), 16);
  const b = parseInt(s3.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62;
}

// client/wall.js
var import_jsx_runtime6 = require("react/jsx-runtime");
function swTrace(payload) {
  try {
    fetch("/sticky-wall/boot-trace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phase: "drag", ...payload })
    }).catch(() => {
    });
  } catch (err) {
    void err;
  }
}
var FALLBACK_WALL = {
  bg: { kind: "color", color: "#f4f1ea", mediaId: null, dim: 0.55 },
  columns: 3,
  cardWidth: 260,
  cardHeight: 220,
  hoverScale: 1.5,
  gap: 22,
  fontSize: 14,
  newNoteColor: { mode: "auto", color: "#faf7e0" }
};
function wallBackgroundStyle(wall) {
  const bg = wall?.bg ?? FALLBACK_WALL.bg;
  if (bg.kind === "image" && bg.mediaId) {
    const dim = Math.min(1, Math.max(0, bg.dim ?? 0.55));
    return {
      backgroundColor: bg.color ?? "#f4f1ea",
      backgroundImage: `linear-gradient(rgba(255,255,255,${dim}), rgba(255,255,255,${dim})), url("${mediaUrl(bg.mediaId)}")`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundAttachment: "local"
    };
  }
  if (bg.kind === "none") return { backgroundColor: "transparent" };
  return { backgroundColor: bg.color ?? "#f4f1ea" };
}
function StickyWall({
  doc,
  palette,
  uploadImage,
  onCreate,
  onUpdate,
  onDelete,
  onReorder,
  onUpdateWall,
  listSessions,
  onInsertToSession,
  onScheduleToSession,
  onClearDelivery,
  focusNoteId,
  status
}) {
  const wall = { ...FALLBACK_WALL, ...doc?.wall ?? {} };
  const notes = doc?.notes ?? [];
  const [editing, setEditing] = (0, import_react6.useState)(null);
  const [showSettings, setShowSettings] = (0, import_react6.useState)(false);
  const [pendingDelete, setPendingDelete] = (0, import_react6.useState)(null);
  const [deliverTarget, setDeliverTarget] = (0, import_react6.useState)(null);
  const [dropSessions, setDropSessions] = (0, import_react6.useState)(null);
  const [hoverSessionId, setHoverSessionId] = (0, import_react6.useState)(null);
  const openDeliver = (0, import_react6.useCallback)(
    async (note, preset) => {
      setDeliverTarget({ note, sessions: [], busy: false, error: "", initialSessionId: preset?.id ?? "" });
      try {
        const list = await listSessions?.() ?? [];
        setDeliverTarget(
          (prev) => prev && prev.note.id === note.id ? { ...prev, sessions: list } : prev
        );
      } catch (error) {
        setDeliverTarget(
          (prev) => prev && prev.note.id === note.id ? { ...prev, error: String(error?.message ?? error) } : prev
        );
      }
    },
    [listSessions]
  );
  const runDeliver = (0, import_react6.useCallback)(async (payload, action) => {
    setDeliverTarget((prev) => prev ? { ...prev, busy: true, error: "" } : prev);
    try {
      await action(payload);
      setDeliverTarget(null);
    } catch (error) {
      setDeliverTarget(
        (prev) => prev ? { ...prev, busy: false, error: String(error?.message ?? error) } : prev
      );
    }
  }, []);
  (0, import_react6.useEffect)(() => {
    editingRef.current = editing;
  }, [editing]);
  const [dragId, setDragId] = (0, import_react6.useState)(null);
  const [dropIndex, setDropIndex] = (0, import_react6.useState)(null);
  const [insertPos, setInsertPos] = (0, import_react6.useState)(null);
  const dropRef = (0, import_react6.useRef)(null);
  const [columns, setColumns] = (0, import_react6.useState)(wall.columns);
  const gridRef = (0, import_react6.useRef)(null);
  const scrollRef = (0, import_react6.useRef)(null);
  (0, import_react6.useEffect)(() => {
    const node = scrollRef.current;
    if (!node || typeof ResizeObserver === "undefined") {
      setColumns(wall.columns);
      return;
    }
    const compute = () => {
      const usable = node.clientWidth - 56;
      const perCard = wall.cardWidth + wall.gap;
      const fit = Math.max(1, Math.floor(usable / perCard));
      setColumns(Math.max(1, Math.min(wall.columns, fit)));
    };
    compute();
    const observer = new ResizeObserver(compute);
    observer.observe(node);
    return () => observer.disconnect();
  }, [wall.columns, wall.cardWidth, wall.gap]);
  const creatingRef = (0, import_react6.useRef)(false);
  const editSessionRef = (0, import_react6.useRef)(0);
  const editorDirtyRef = (0, import_react6.useRef)(false);
  const editingRef = (0, import_react6.useRef)(null);
  const openEditor = (0, import_react6.useCallback)(
    (note) => {
      editSessionRef.current += 1;
      editorDirtyRef.current = false;
      if (note) {
        if (note.delivery && note.id) {
          const fireAt = deliveryTimeMs(note.delivery);
          if (fireAt !== null && fireAt <= Date.now()) {
            void onClearDelivery?.(note.id);
          }
        }
        setEditing({ note, id: note.id ?? null });
        return;
      }
      const auto = resolveNewNoteColor2(notes, wall);
      setEditing({
        id: null,
        note: {
          id: null,
          html: "",
          color: auto.color,
          textColor: "#1f2430",
          pinned: false,
          createdAt: Date.now()
        }
      });
    },
    [notes, onClearDelivery]
  );
  const focusHandledRef = (0, import_react6.useRef)(null);
  (0, import_react6.useEffect)(() => {
    if (!focusNoteId) return;
    if (focusHandledRef.current === focusNoteId) return;
    const target = notes.find((note) => note.id === focusNoteId);
    if (!target) return;
    focusHandledRef.current = focusNoteId;
    openEditor(target);
  }, [focusNoteId, notes, openEditor]);
  const closeEditor = (0, import_react6.useCallback)(() => {
    editSessionRef.current += 1;
    const current = editingRef.current;
    if (current && !current.id && !editorDirtyRef.current) {
      void onCreate({
        html: "",
        color: current.note?.color,
        textColor: current.note?.textColor,
        draft: true
      });
    }
    const doc2 = typeof document === "undefined" ? null : document;
    const active = doc2 ? doc2.activeElement : null;
    if (active && active !== doc2.body && typeof active.blur === "function") {
      try {
        active.blur();
      } catch (err) {
      }
    }
    setEditing(null);
  }, [onCreate]);
  const handleEditorChange = (0, import_react6.useCallback)(
    async (patch) => {
      if (!patch) return;
      editorDirtyRef.current = true;
      const html = String(patch.html ?? "");
      const isEmpty = html.replace(/<[^>]+>/g, "").trim() === "" && !/<img\b/i.test(html);
      if (!editing?.id) {
        if (isEmpty) return;
        if (creatingRef.current) return;
        const session = editSessionRef.current;
        creatingRef.current = true;
        try {
          const created = await onCreate(patch);
          if (editSessionRef.current !== session) return;
          if (created?.id) {
            setEditing({ id: created.id, note: created });
          }
        } finally {
          creatingRef.current = false;
        }
        return;
      }
      if (isEmpty) return;
      const nextPatch = editing?.note?.draft ? { ...patch, draft: false } : patch;
      await onUpdate(editing.id, nextPatch);
    },
    [editing?.id, onCreate, onUpdate]
  );
  const editingNote = (0, import_react6.useMemo)(() => {
    if (!editing?.id) return editing?.note ?? null;
    return notes.find((note) => note.id === editing.id) ?? editing.note ?? null;
  }, [editing, notes]);
  const handleDrop = (0, import_react6.useCallback)(
    async (targetIndex) => {
      const from = notes.findIndex((note) => note.id === dragId);
      swTrace({ kind: "handleDrop", targetIndex, from, total: notes.length });
      dropRef.current = null;
      setDragId(null);
      setDropIndex(null);
      setInsertPos(null);
      if (from < 0 || targetIndex == null) return;
      const insertAt = targetIndex > from ? targetIndex - 1 : targetIndex;
      if (insertAt === from) return;
      const next = notes.slice();
      const [moved] = next.splice(from, 1);
      next.splice(insertAt, 0, moved);
      await onReorder?.(next.map((note) => note.id));
    },
    [dragId, notes, onReorder]
  );
  const handleTogglePin = (0, import_react6.useCallback)(
    (note) => {
      void onUpdate(note.id, { pinned: !note.pinned });
    },
    [onUpdate]
  );
  const handleDelete = (0, import_react6.useCallback)((note) => {
    setPendingDelete(note);
  }, []);
  const handleSessionDrop = (0, import_react6.useCallback)(
    (session) => {
      const note = notes.find((item) => item.id === dragId) ?? null;
      setDragId(null);
      setDropIndex(null);
      setInsertPos(null);
      setDropSessions(null);
      setHoverSessionId(null);
      if (!note) return;
      openDeliver(note, session);
    },
    [dragId, notes, openDeliver]
  );
  const handleWallDragOver = (0, import_react6.useCallback)(
    (event) => {
      if (!dragId) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const nearLeft = event.clientX - rect.left < 160;
      if (nearLeft) {
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "link";
        if (!dropSessions) {
          void Promise.resolve(listSessions?.()).then((list) => setDropSessions(Array.isArray(list) ? list : [])).catch(() => setDropSessions([]));
        }
      } else if (dropSessions) {
        setDropSessions(null);
        setHoverSessionId(null);
      }
    },
    [dragId, dropSessions, listSessions]
  );
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "sw-root", children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "sw-toolbar", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "sw-title", children: "\u4FBF\u7B7E\u5899" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: "sw-count", children: [
        notes.length,
        " \u5F20"
      ] }),
      status ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "sw-count", style: { color: "var(--dsh-warning, #b45309)" }, children: status }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "sw-spacer" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { type: "button", className: "sw-btn primary", onClick: () => openEditor(null), children: "\uFF0B \u65B0\u4FBF\u7B7E" }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { type: "button", className: "sw-btn", onClick: () => setShowSettings(true), title: "\u5899\u8BBE\u7F6E", children: "\u2699 \u5899\u8BBE\u7F6E" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "sw-body", children: [
      dropSessions ? /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "sw-dropbar", onDragOver: (event) => event.preventDefault(), children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "sw-dropbar-title", children: "\u677E\u624B\u53D1\u9001\u5230" }),
        dropSessions.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "sw-dropbar-empty", children: "\u6CA1\u6709\u53EF\u7528\u4F1A\u8BDD" }) : dropSessions.map((item) => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "div",
          {
            className: "sw-dropitem" + (hoverSessionId === item.id ? " is-hover" : ""),
            title: item.title || item.id,
            onDragOver: (event) => {
              event.preventDefault();
              event.stopPropagation();
              if (hoverSessionId !== item.id) setHoverSessionId(item.id);
            },
            onDrop: (event) => {
              event.preventDefault();
              event.stopPropagation();
              handleSessionDrop(item);
            },
            children: item.title || "\uFF08\u672A\u547D\u540D\u4F1A\u8BDD\uFF09"
          },
          item.id
        ))
      ] }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        "div",
        {
          className: "sw-wall",
          ref: scrollRef,
          onDragOver: handleWallDragOver,
          style: {
            ...wallBackgroundStyle(wall),
            paddingTop: Math.max(28, Math.round((wall.hoverScale - 1) * wall.cardHeight / 2) + 24),
            paddingBottom: Math.max(120, Math.round((wall.hoverScale - 1) * wall.cardHeight / 2) + 96),
            paddingLeft: Math.max(24, Math.round((wall.hoverScale - 1) * wall.cardWidth / 2) + 16),
            paddingRight: Math.max(24, Math.round((wall.hoverScale - 1) * wall.cardWidth / 2) + 16)
          },
          children: notes.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "sw-empty", children: [
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("strong", { children: "\u8FD9\u9762\u5899\u8FD8\u662F\u7A7A\u7684" }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { children: "\u70B9\u53F3\u4E0A\u89D2\u300C\uFF0B \u65B0\u4FBF\u7B7E\u300D\u5199\u4E0B\u7B2C\u4E00\u4E2A\u60F3\u6CD5\uFF1B\u4E5F\u53EF\u4EE5\u5728\u4F1A\u8BDD\u91CC\u8BA9\u5C0F\u52A9\u624B\u8BB0\u4E00\u6761\u3002" }),
            /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "sw-muted", children: "\u4FBF\u7B7E\u4F1A\u81EA\u52A8\u4FDD\u5B58\uFF0C\u5173\u6389\u518D\u6253\u5F00\u4E5F\u8FD8\u5728\u3002" })
          ] }) : /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
            "div",
            {
              className: "sw-grid",
              ref: gridRef,
              onDragOver: (event) => {
                if (dragId) {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }
              },
              onDrop: (event) => {
                event.preventDefault();
                const target = dropRef.current;
                swTrace({ kind: "container-drop", target, hasDrag: Boolean(dragId) });
                dropRef.current = null;
                void handleDrop(target);
              },
              style: {
                position: "relative",
                gridTemplateColumns: `repeat(${columns}, ${wall.cardWidth}px)`,
                gap: wall.gap,
                alignItems: "start"
              },
              children: [
                (() => {
                  const C2 = Math.max(1, columns);
                  const cellW = wall.cardWidth + wall.gap;
                  const cellH = wall.cardHeight + wall.gap;
                  const from = notes.findIndex((n) => n.id === dragId);
                  const to = from >= 0 && dropIndex != null ? dropIndex > from ? dropIndex - 1 : dropIndex : -1;
                  const movedIndex = (j) => {
                    if (from < 0 || to < 0 || j === from) return j;
                    if (from < to) return j > from && j <= to ? j - 1 : j;
                    if (from > to) return j >= to && j < from ? j + 1 : j;
                    return j;
                  };
                  const shiftOf = (j) => {
                    const nj = movedIndex(j);
                    if (nj === j) return { x: 0, y: 0 };
                    const dc = nj % C2 - j % C2;
                    const dr = Math.floor(nj / C2) - Math.floor(j / C2);
                    return { x: dc * cellW, y: dr * cellH };
                  };
                  return notes.map((note, index) => {
                    const shift = dragId && dragId !== note.id ? shiftOf(index) : { x: 0, y: 0 };
                    return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
                      NoteCard,
                      {
                        onCancelDelivery: onClearDelivery,
                        onDeliver: (sentNote) => {
                          closeEditor();
                          window.setTimeout(() => {
                            if (sentNote) openDeliver(sentNote);
                          }, 60);
                        },
                        note,
                        wall: { ...wall, fontSize: wall.fontSize },
                        index,
                        shiftX: shift.x,
                        shiftY: shift.y,
                        onOpen: () => openEditor(note),
                        onTogglePin: handleTogglePin,
                        onDelete: handleDelete,
                        dragging: dragId === note.id,
                        onDragStart: () => {
                          setDragId(note.id);
                          dropRef.current = null;
                          setDropIndex(null);
                          setInsertPos(null);
                        },
                        onDragEnter: (event) => {
                          if (!dragId || dragId === note.id) return;
                          const rect = event.currentTarget.getBoundingClientRect();
                          const gridEl = gridRef.current;
                          if (!gridEl) return;
                          const gRect = gridEl.getBoundingClientRect();
                          const after = event.clientX > rect.left + rect.width / 2;
                          const idx = index + (after ? 1 : 0);
                          dropRef.current = idx;
                          setDropIndex(idx);
                          setInsertPos({
                            x: (after ? rect.right : rect.left) - gRect.left,
                            y: rect.top - gRect.top,
                            h: rect.height
                          });
                        },
                        onDragEnd: () => {
                          const pending = dropRef.current;
                          dropRef.current = null;
                          swTrace({ kind: "drag-end", pending });
                          if (pending != null) {
                            void handleDrop(pending);
                            return;
                          }
                          setDragId(null);
                          setDropIndex(null);
                          setInsertPos(null);
                        }
                      },
                      note.id
                    );
                  });
                })(),
                insertPos ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
                  "div",
                  {
                    className: "sw-insert-line",
                    style: { left: insertPos.x - 1.5, top: insertPos.y, height: insertPos.h }
                  }
                ) : null
              ]
            }
          )
        }
      )
    ] }),
    editing ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      "div",
      {
        className: "sw-overlay",
        onMouseDown: (event) => {
          if (event.target === event.currentTarget) closeEditor();
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          NoteEditor,
          {
            note: editingNote,
            onDeliver: openDeliver,
            palette,
            onClose: closeEditor,
            onChange: handleEditorChange,
            uploadImage
          }
        )
      }
    ) : null,
    showSettings ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      "div",
      {
        className: "sw-overlay",
        onMouseDown: (event) => {
          if (event.target === event.currentTarget) setShowSettings(false);
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          WallSettings,
          {
            wall,
            palette,
            onChange: (patch) => void onUpdateWall(patch),
            onClose: () => setShowSettings(false),
            uploadImage
          }
        )
      }
    ) : null,
    pendingDelete ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      "div",
      {
        className: "sw-overlay",
        style: { zIndex: 60 },
        onMouseDown: (event) => {
          if (event.target === event.currentTarget) setPendingDelete(null);
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(
          "div",
          {
            style: {
              background: "var(--dsh-bg, #fff)",
              color: "var(--dsh-text, #1f2430)",
              border: "1px solid var(--dsh-border, rgba(127,127,127,.25))",
              borderRadius: 14,
              padding: "20px 22px",
              width: 360,
              maxWidth: "calc(100vw - 40px)",
              boxShadow: "0 24px 60px -18px rgba(9,14,24,.55)",
              display: "flex",
              flexDirection: "column",
              gap: 14
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("strong", { style: { fontSize: 15 }, children: "\u5220\u9664\u4FBF\u7B7E" }),
              /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("p", { style: { margin: 0, fontSize: 13, lineHeight: 1.6, opacity: 0.85 }, children: [
                "\u5220\u9664\u300C",
                pendingDelete.title || "\u8FD9\u5F20\u4FBF\u7B7E",
                "\u300D\uFF1F\u6B64\u64CD\u4F5C\u4E0D\u53EF\u64A4\u9500\u3002"
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { style: { display: "flex", justifyContent: "flex-end", gap: 8 }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { type: "button", className: "sw-btn", onClick: () => setPendingDelete(null), children: "\u53D6\u6D88" }),
                /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
                  "button",
                  {
                    type: "button",
                    className: "sw-btn primary",
                    onClick: () => {
                      const target = pendingDelete;
                      setPendingDelete(null);
                      void onDelete(target);
                    },
                    children: "\u5220\u9664"
                  }
                )
              ] })
            ]
          }
        )
      }
    ) : null,
    deliverTarget ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      DeliverDialog,
      {
        note: deliverTarget.note,
        sessions: deliverTarget.sessions,
        busy: deliverTarget.busy,
        error: deliverTarget.error,
        initialSessionId: deliverTarget.initialSessionId,
        onClose: () => setDeliverTarget(null),
        onInsert: ({ note, session }) => runDeliver({ note, session }, onInsertToSession),
        onSchedule: ({ note, session, at }) => runDeliver({ note, session, at }, onScheduleToSession)
      }
    ) : null
  ] });
}

// client/index.js
var import_jsx_runtime7 = require("react/jsx-runtime");
var PANEL_ID = "sticky-wall";
var PANEL_ORDER = 12;
var POLL_MS = 2500;
var state = {
  doc: { notes: [], wall: null },
  palette: [],
  rev: -1,
  status: "",
  ready: false,
  /** 待打开的便签 id（提醒弹框点「查看」时写入）。 */
  focusNoteId: null,
  /** 已展示、未确认的提醒，避免轮询重复弹。 */
  toasts: []
};
var listeners = /* @__PURE__ */ new Set();
function emit() {
  for (const listener of listeners) listener();
}
function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function useStore() {
  const [, force] = (0, import_react7.useReducer)((n) => n + 1, 0);
  (0, import_react7.useEffect)(() => subscribe(force), []);
  return state;
}
var pollTimer = null;
var inFlight = false;
function applyDoc(doc) {
  state.doc = doc;
  state.rev = doc.rev;
  state.ready = true;
  checkAlarms(doc.notes);
}
function checkAlarms(notes) {
  const now = Date.now();
  const shown = new Set(state.toasts.map((toast) => toast.id));
  for (const note of notes ?? []) {
    if (!note.alarmAt || note.alarmFiredAt) continue;
    if (note.alarmAt > now) continue;
    if (shown.has(note.id)) continue;
    state.toasts.push({
      id: note.id,
      title: note.title || "\uFF08\u7A7A\u4FBF\u7B7E\uFF09",
      text: plainText(note.html).slice(0, 200),
      at: note.alarmAt
    });
  }
}
function plainText(html) {
  return String(html ?? "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|h[1-6])>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
}
async function pull(options = {}) {
  if (inFlight) return;
  if (typeof document !== "undefined" && document.hidden && !options.force) return;
  inFlight = true;
  try {
    const useSince = !options.force && !options.summary;
    const payload = await api.state(useSince ? state.rev : void 0, { summary: options.summary });
    if (payload?.palette) state.palette = payload.palette;
    if (payload?.changed === false) {
      if (state.status) {
        state.status = "";
        emit();
      }
      return;
    }
    if (payload?.doc) applyDoc(payload.doc);
    else if (payload?.changed && payload?.notes) applyDoc(payload);
    if (state.status) state.status = "";
    if (!bootDataReported && payload?.doc) {
      bootDataReported = true;
      bootReport("first-data", { notes: (payload.doc.notes || []).length, summary: !!payload.summary });
    }
    emit();
  } catch (error) {
    state.status = `\u8FDE\u63A5\u4FBF\u7B7E\u670D\u52A1\u5931\u8D25\uFF1A${error?.message ?? error}`;
    emit();
  } finally {
    inFlight = false;
  }
}
function startPolling() {
  if (pollTimer != null) return;
  void (async () => {
    await pull({ force: true, summary: true });
    await pull({ force: true });
  })();
  pollTimer = setInterval(() => void pull(), POLL_MS);
}
function stopPolling() {
  if (pollTimer == null) return;
  clearInterval(pollTimer);
  pollTimer = null;
}
var pluginCtx = null;
async function refreshNow() {
  await pull({ force: true });
  emit();
}
var actions = {
  async create(patch) {
    const notes = state.doc?.notes ?? [];
    const auto = patch?.color ? null : resolveNewNoteColor(notes, state.doc?.wall);
    const payload = auto ? { ...patch, color: auto.color } : patch;
    const result = await api.note({ op: "create", ...payload });
    await refreshNow();
    return result?.note ?? null;
  },
  async update(id, patch) {
    const note = state.doc?.notes?.find((candidate) => candidate.id === id);
    if (note) {
      if (patch.html != null) note.html = patch.html;
      if (patch.color != null) note.color = patch.color;
      if (patch.textColor != null) note.textColor = patch.textColor;
      if (patch.alarmAt !== void 0) note.alarmAt = patch.alarmAt;
      if (patch.pinned != null) note.pinned = patch.pinned;
      emit();
    }
    await api.note({ op: "update", id, ...patch });
    await refreshNow();
  },
  async remove(note) {
    await api.note({ op: "delete", id: note.id });
    state.toasts = state.toasts.filter((toast) => toast.id !== note.id);
    await refreshNow();
  },
  async reorder(ids) {
    const list = Array.isArray(ids) ? ids.filter((id) => typeof id === "string") : [];
    if (list.length === 0) return;
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
      await api.note({ op: "reorder", ids });
    } catch (err) {
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
    const svc = pluginCtx?.get?.("sessions") ?? pluginCtx?.sessions ?? null;
    if (!svc) throw new Error("ctx \u4E0A\u62FF\u4E0D\u5230 sessions \u670D\u52A1");
    const summaries = svc.manager?.summaries;
    if (!Array.isArray(summaries) || summaries.length === 0) {
      const phase = svc.manager?.listPhase;
      const listError = svc.manager?.listError;
      return { groups: [], debug: "phase=" + String(phase) + " error=" + String(listError ? "\u6709" : "\u65E0") };
    }
    const deepFind = (value, pattern, depth) => {
      if (!value || typeof value !== "object" || depth < 0) return "";
      for (const key of Object.keys(value)) {
        const child = value[key];
        if (pattern.test(key) && typeof child === "string" && child.trim()) return child.trim();
      }
      for (const key of Object.keys(value)) {
        const child = value[key];
        if (child && typeof child === "object") {
          const got = deepFind(child, pattern, depth - 1);
          if (got) return got;
        }
      }
      return "";
    };
    const titleStrict = /^(title|displayName|label|summary|preview|topic|heading|name)$/i;
    const titleLoose = /title|displayName|summary|preview/i;
    const wsStrict = /^(workspace|workspaceName|projectName|projectPath|cwd|root|dir)$/i;
    const wsLoose = /workspace|project|cwd|directory/i;
    const buckets = /* @__PURE__ */ new Map();
    let sampleKeys = "";
    for (const raw of summaries) {
      if (!raw || typeof raw !== "object") continue;
      if (!sampleKeys) sampleKeys = Object.keys(raw).slice(0, 12).join(",");
      const id = String(raw.sessionId ?? raw.id ?? raw.session_id ?? "");
      if (!id) continue;
      const parentRef = deepFind(raw, /^(parentSessionId|parentId|parent)$/i, 2) || deepFind(raw, /subagent|spawnedBy|parentSession/i, 2);
      if (parentRef) continue;
      let title = deepFind(raw, titleStrict, 3) || deepFind(raw, titleLoose, 3);
      const workspace = deepFind(raw, wsStrict, 3) || deepFind(raw, wsLoose, 3) || "\uFF08\u672A\u5F52\u5165\u5DE5\u4F5C\u533A\uFF09";
      let updatedAt = Number(raw.updatedAt ?? raw.lastActiveAt ?? raw.updated_at ?? raw.createdAt ?? 0) || 0;
      if (!updatedAt) {
        const rawTime = deepFind(raw, /updatedAt|lastActiveAt|lastMessageAt|modifiedAt/i, 3);
        const parsed = rawTime ? Number(rawTime) : NaN;
        if (Number.isFinite(parsed)) updatedAt = parsed;
      }
      if (!title) continue;
      if (title.length > 56) title = title.slice(0, 56) + "\u2026";
      const key = workspace.slice(0, 80);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push({ id, title, updatedAt });
    }
    const flat = [];
    for (const entry of buckets) {
      for (const item of entry[1]) flat.push(Object.assign({}, item, { workspace: entry[0] }));
    }
    flat.sort(function(a, b) {
      return b.updatedAt - a.updatedAt;
    });
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
    }
    await refreshNow();
  },
  async insertToSession(payload) {
    const note = payload?.note ?? null;
    const session = payload?.session ?? null;
    if (!session?.id) throw new Error("\u8BF7\u5148\u9009\u62E9\u76EE\u6807\u4F1A\u8BDD");
    const text = noteToText(note?.html ?? "");
    if (!String(text).trim()) throw new Error("\u8FD9\u5F20\u4FBF\u7B7E\u662F\u7A7A\u7684");
    const result = await api.insert({ sessionId: session.id, text, noteId: note?.id ?? null });
    if (!result?.ok) throw new Error(result?.error ?? "\u53D1\u9001\u5931\u8D25");
    await refreshNow();
    return result;
  },
  /** 定时发送：交给内核 dsh-schedule，宿主重启也不丢。 */
  async scheduleToSession({ note, session, at }) {
    await api.deliver({
      noteId: note.id,
      sessionId: session.id,
      sessionTitle: session.title || "",
      at,
      prompt: describeNote(note, { mode: "schedule", at }),
      title: "\u4FBF\u7B7E\u63D0\u9192 \xB7 " + (note.title || "\uFF08\u65E0\u6807\u9898\uFF09")
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
    }
    void api.ackAlarm(id).catch(() => {
    });
  }
};
function StickyWallPage() {
  const store = useStore();
  const [focusHandled, setFocusHandled] = (0, import_react7.useState)(null);
  (0, import_react7.useEffect)(() => {
    startPolling();
    return () => {
    };
  }, []);
  (0, import_react7.useEffect)(() => {
    if (!store.focusNoteId) return;
    if (focusHandled === store.focusNoteId) return;
    setFocusHandled(store.focusNoteId);
  }, [store.focusNoteId, focusHandled]);
  const uploadImage = (0, import_react7.useCallback)(async (dataUrl) => actions.upload(dataUrl), []);
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
    StickyWall,
    {
      doc: store.doc,
      palette: store.palette,
      status: store.status,
      uploadImage,
      onCreate: actions.create,
      onUpdate: actions.update,
      onDelete: actions.remove,
      onReorder: actions.reorder,
      onUpdateWall: actions.updateWall,
      listSessions: actions.listSessions,
      onInsertToSession: actions.insertToSession,
      onScheduleToSession: actions.scheduleToSession,
      onClearDelivery: actions.clearDelivery,
      focusNoteId: store.focusNoteId
    }
  );
}
function AlarmDock(props) {
  const store = useStore();
  const ctx = props?.__ctx ?? null;
  const toasts = store.toasts;
  (0, import_react7.useEffect)(() => {
    startPolling();
  }, []);
  if (!toasts.length) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: "sw-toasts", children: toasts.map((toast) => /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "sw-toast", role: "alert", children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "sw-toast-title", children: [
      "\u23F0 \u4FBF\u7B7E\u63D0\u9192 \xB7 ",
      formatAlarm(toast.at)
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "sw-toast-text", children: [
      toast.title,
      toast.text ? `
${toast.text}` : ""
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: "sw-toast-actions", children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("button", { type: "button", className: "sw-btn ghost", onClick: () => void actions.dismissAlarm(toast.id), children: "\u5173\u95ED" }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("button", { type: "button", className: "sw-btn primary", onClick: () => actions.openNote(toast.id, ctx), children: "\u67E5\u770B\u4FBF\u7B7E" })
    ] })
  ] }, toast.id)) });
}
function StickyWallIcon({ size = 18, active = false }) {
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      "aria-hidden": "true",
      style: { opacity: active ? 1 : 0.86 },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          "path",
          {
            d: "M5 4.5h10.5L20 9v10.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1Z",
            stroke: "currentColor",
            strokeWidth: "1.6",
            strokeLinejoin: "round"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("path", { d: "M15.5 4.5V9H20", stroke: "currentColor", strokeWidth: "1.6", strokeLinejoin: "round" }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("path", { d: "M7.5 12.5h9M7.5 16h5.5", stroke: "currentColor", strokeWidth: "1.6", strokeLinecap: "round" })
      ]
    }
  );
}
var inject = ["slots"];
function reportClientError(where, error) {
  try {
    const text = String(error?.stack ?? error?.message ?? error ?? "unknown").slice(0, 4e3);
    if (typeof console !== "undefined" && console.error) {
      console.error(`[dsh-notewall] ${where} failed:`, error);
    }
    if (typeof fetch === "function") {
      const url = `/sticky-wall/__diag?where=${encodeURIComponent(where)}&msg=${encodeURIComponent(text)}`;
      void fetch(url, { method: "GET", cache: "no-store" }).catch(() => {
      });
    }
  } catch {
  }
}
function safeSlot(label, register) {
  try {
    return register();
  } catch (error) {
    reportClientError(`slot:${label}`, error);
    return () => {
    };
  }
}
function bootNow() {
  try {
    return Math.round((globalThis.performance?.now?.() ?? 0) * 10) / 10;
  } catch (err) {
    return 0;
  }
}
var bootDataReported = false;
function bootReport(phase, extra) {
  try {
    void api.traceBoot({ phase, t: bootNow(), ...extra || {} }).catch(() => {
    });
  } catch (err) {
  }
}
function applyImpl(ctx) {
  pluginCtx = ctx;
  bootReport("client-apply");
  injectStyles();
  safeSlot(
    "main",
    () => ctx.slots.inject(
      "main",
      () => ctx.slots.register({ name: "main", key: PANEL_ID }, StickyWallPage)
    )
  );
  safeSlot(
    "sidebar.panellist",
    () => ctx.slots.inject(
      "sidebar.panellist",
      () => ctx.slots.register(
        { name: "sidebar.panellist", id: PANEL_ID, order: PANEL_ORDER, label: () => "\u4FBF\u7B7E\u5899" },
        StickyWallIcon
      )
    )
  );
  safeSlot(
    "shell.overlay",
    () => ctx.slots.inject(
      "shell.overlay",
      () => ctx.slots.register(
        { name: "shell.overlay", id: "sticky-wall-alarm", order: 40, inject: () => ({ __ctx: ctx }) },
        AlarmDock
      )
    )
  );
  ctx.effect(() => {
    const onVisible = () => {
      if (!document.hidden) void pull({ force: true });
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, "sticky-wall.visibility");
  ctx.effect(() => () => stopPolling(), "sticky-wall.polling");
}
function apply(ctx) {
  try {
    applyImpl(ctx);
  } catch (error) {
    reportClientError("apply", error);
  }
}
var index_default = { inject, apply };
return module.exports;
} catch (__dshStickyFactoryError) {
  __dshStickyReport("factory", __dshStickyFactoryError);
  return { apply: function () {}, inject: [] };
} } });
