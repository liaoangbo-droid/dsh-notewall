import { useCallback, useEffect, useRef, useState } from 'react';
import { autoNoteColor } from './palette';
import { getLocalePref, setLocalePref, t } from './strings.js';

/** 切换语言：存下偏好后整页重载——文案散落在各面板里，重载是最稳的更新方式。 */
function changeLocale(next) {
  setLocalePref(next);
  setTimeout(() => {
    try {
      location.reload();
    } catch {
      // 极端环境下 reload 不可用，偏好已存，下次打开生效
    }
  }, 80);
}


/**
 * 墙设置面板（dsh-notewall / client/settings.js）
 *
 * 契约：
 *   export function WallSettings({ wall, palette, onChange, onClose, uploadImage })
 *
 * - wall:      当前墙配置 { bg:{kind,color,mediaId,dim}, columns, cardWidth, cardHeight, hoverScale, gap, fontSize }
 * - palette:   便签底色候选（本面板不使用，保留接口）
 * - onChange:  (patch) => void，只回传要改的字段；bg 回传完整 bg 对象
 * - onClose:   () => void
 * - uploadImage: async (dataUrl) => ({ url, id })
 *
 * 实时生效：拖动立即更新本地草稿，onChange 走 120ms 节流 + requestAnimationFrame，
 * 避免每像素一次 POST。卸载/重置时会把挂起的最后一次改动立刻补发。
 */

export const WALL_DEFAULTS = {
  bg: { kind: 'color', color: '#f4f1ea', mediaId: null, dim: 0.55 },
  columns: 3,
  cardWidth: 260,
  cardHeight: 220,
  hoverScale: 1.5,
  gap: 22,
  fontSize: 14,
};

const THROTTLE_MS = 120;
const PANEL_WIDTH = 312;

// 主题色：一律 var(--dsh-*, fallback)，深浅色主题都不崩。
// 变量名与 theme.js 对齐（--dsh-bg / --dsh-text / --dsh-surface / --dsh-accent），
// 同时保留 DSH 侧的等价别名做次级回退，避免某个主题只实现了一组名字时退化成写死色。
const C = {
  panel: 'var(--dsh-bg-elevated, var(--dsh-bg, #ffffff))',
  surface: 'var(--dsh-surface, rgba(127, 127, 127, 0.10))',
  surfaceStrong: 'var(--dsh-surface-hover, rgba(127, 127, 127, 0.18))',
  text: 'var(--dsh-text, var(--dsh-text-primary, #1f2430))',
  sub: 'var(--dsh-text-secondary, #667085)',
  border: 'var(--dsh-border, rgba(127, 127, 127, 0.30))',
  accent: 'var(--dsh-accent, #4d6bfe)',
  danger: 'var(--dsh-danger, #d64545)',
  shadow: 'var(--dsh-shadow-elevated, 0 14px 36px rgba(0, 0, 0, 0.20))',
};

const BG_COLORS = ['#f4f1ea', '#ffffff', '#eef2f7', '#e9f3ef', '#f7ece1', '#1b1f27'];

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

function num(v, fallback, min, max) {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? clamp(n, min, max) : fallback;
}

/** 把外部 wall 收敛成合法、字段齐全的形状（缺失字段取默认值）。 */
function normalizeWall(wall) {
  const src = wall && typeof wall === 'object' ? wall : {};
  const bg = src.bg && typeof src.bg === 'object' ? src.bg : {};
  const kind = bg.kind === 'image' || bg.kind === 'none' ? bg.kind : 'color';
  return {
    bg: {
      kind,
      color: typeof bg.color === 'string' && bg.color ? bg.color : WALL_DEFAULTS.bg.color,
      mediaId: bg.mediaId == null || bg.mediaId === '' ? null : bg.mediaId,
      dim: num(bg.dim, WALL_DEFAULTS.bg.dim, 0, 1),
    },
    columns: num(src.columns, WALL_DEFAULTS.columns, 1, 8),
    cardWidth: num(src.cardWidth, WALL_DEFAULTS.cardWidth, 160, 520),
    cardHeight: num(src.cardHeight, WALL_DEFAULTS.cardHeight, 120, 560),
    hoverScale: num(src.hoverScale, WALL_DEFAULTS.hoverScale, 1, 3),
    gap: num(src.gap, WALL_DEFAULTS.gap, 0, 80),
    fontSize: num(src.fontSize, WALL_DEFAULTS.fontSize, 10, 28),
  };
}

/** mediaId → 图片地址（host 的媒体路由是 /sticky-wall/media/<id>）。 */
function mediaSrc(mediaId) {
  if (!mediaId) return '';
  const s = String(mediaId);
  if (/^(?:data:|blob:|https?:|\/)/i.test(s)) return s;
  return '/sticky-wall/media/' + encodeURIComponent(s);
}

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error || new Error(t('error.readImage')));
    reader.readAsDataURL(file);
  });
}

const fmt = (v, digits) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  const p = Math.pow(10, digits || 0);
  return String(Math.round(n * p) / p);
};

function Section({ title, hint, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 8,
          margin: '0 0 7px',
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.3, color: C.sub }}>
          {title}
        </span>
        {hint ? <span style={{ fontSize: 10.5, color: C.sub, opacity: 0.85 }}>{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

function SliderRow({ label, value, min, max, step, display, onInput }) {
  return (
    <div style={{ marginBottom: 9 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 3,
        }}
      >
        <span style={{ fontSize: 12, color: C.text }}>{label}</span>
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 600,
            color: C.sub,
            fontVariantNumeric: 'tabular-nums',
            minWidth: 34,
            textAlign: 'right',
          }}
        >
          {display}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onInput(Number(e.target.value))}
        style={{ width: '100%', margin: 0, accentColor: C.accent, cursor: 'pointer' }}
      />
    </div>
  );
}

function segStyle(active) {
  return {
    flex: 1,
    padding: '6px 0',
    fontSize: 12,
    fontWeight: active ? 700 : 500,
    lineHeight: 1.4,
    textAlign: 'center',
    borderRadius: 7,
    cursor: active ? 'default' : 'pointer',
    border: '1px solid ' + (active ? 'transparent' : C.border),
    background: active ? C.accent : 'transparent',
    color: active ? '#fff' : C.sub,
    transition: 'background 120ms ease, color 120ms ease',
    userSelect: 'none',
  };
}

export function WallSettings({ wall, palette, onChange, onClose, uploadImage }) {
  const MINI_PALETTE = Array.from({ length: 8 }, (_, i) => autoNoteColor(i));

  const [draft, setDraft] = useState(() => normalizeWall(wall));
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [preview, setPreview] = useState(null); // { id, src } 刚上传的本地预览
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [shown, setShown] = useState(false);
  const fileRef = useRef(null);

  const pendingRef = useRef(null);
  const timerRef = useRef(null);
  const rafRef = useRef(0);
  const lastEmitRef = useRef(0);

  // ---- 外部 wall 变化时同步草稿（自己 onChange 回流的同值不触发覆盖）----
  const wallJson = JSON.stringify(normalizeWall(wall));
  const adoptedRef = useRef(null);
  useEffect(() => {
    if (adoptedRef.current === wallJson) return;
    adoptedRef.current = wallJson;
    if (JSON.stringify(draftRef.current) !== wallJson) {
      const next = JSON.parse(wallJson);
      draftRef.current = next;
      setDraft(next);
    }
  }, [wallJson]);

  // ---- 入场位移 ----
  useEffect(() => {
    const raf =
      typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame(() => setShown(true))
        : (setShown(true), 0);
    return () => {
      if (raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf);
    };
  }, []);

  // ---- 节流发送 ----
  const drain = useCallback(() => {
    const patch = pendingRef.current;
    pendingRef.current = null;
    if (!patch) return;
    lastEmitRef.current = Date.now();
    const fn = onChangeRef.current;
    if (typeof fn !== 'function') return;
    try {
      fn(patch);
    } catch (err) {
      // 父组件 POST 失败不该把面板打崩
      console.error('[sticky-wall] WallSettings onChange 失败', err);
    }
  }, []);

  const queue = useCallback(
    (patch) => {
      pendingRef.current = Object.assign({}, pendingRef.current || {}, patch);
      if (timerRef.current) return;
      const wait = Math.max(0, THROTTLE_MS - (Date.now() - lastEmitRef.current));
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (typeof requestAnimationFrame === 'function') {
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

  const flushNow = useCallback((patch) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (rafRef.current && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    pendingRef.current = null;
    if (!patch) return;
    lastEmitRef.current = Date.now();
    const fn = onChangeRef.current;
    if (typeof fn !== 'function') return;
    try {
      fn(patch);
    } catch (err) {
      console.error('[sticky-wall] WallSettings onChange 失败', err);
    }
  }, []);

  // 卸载时补发最后一次改动
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      if (rafRef.current && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      const patch = pendingRef.current;
      pendingRef.current = null;
      if (!patch) return;
      const fn = onChangeRef.current;
      if (typeof fn !== 'function') return;
      try {
        fn(patch);
      } catch (err) {
        /* ignore */
      }
    },
    []
  );

  // ---- 改字段 ----
  const apply = useCallback(
    (patch) => {
      const next = { ...draftRef.current, ...patch };
      draftRef.current = next;
      setDraft(next);
      queue(patch);
    },
    [queue]
  );

  const setField = useCallback((field, value) => apply({ [field]: value }), [apply]);

  const setBg = useCallback(
    (part) => {
      const bg = { ...draftRef.current.bg, ...part };
      apply({ bg });
    },
    [apply]
  );

  const resetAll = useCallback(() => {
    const next = normalizeWall(WALL_DEFAULTS);
    draftRef.current = next;
    setDraft(next);
    setPreview(null);
    setError('');
    flushNow({
      bg: { ...next.bg },
      columns: next.columns,
      cardWidth: next.cardWidth,
      cardHeight: next.cardHeight,
      hoverScale: next.hoverScale,
      gap: next.gap,
      fontSize: next.fontSize,
    });
  }, [flushNow]);

  // ---- 图片上传 ----
  const pickFile = useCallback(() => {
    if (typeof uploadImage !== 'function') {
      setError(t('error.uploadUnsupported'));
      return;
    }
    if (fileRef.current) fileRef.current.click();
  }, [uploadImage]);

  const handleFile = useCallback(
    async (file) => {
      if (!file) return;
      if (!/^image\//.test(file.type || '')) {
        setError(t('error.chooseImageFile'));
        return;
      }
      setError('');
      setBusy(true);
      try {
        const dataUrl = await readAsDataURL(file);
        if (!dataUrl) throw new Error(t('error.readImage'));
        const res = await uploadImage(dataUrl);
        const id = res && res.id != null ? String(res.id) : '';
        if (!id) throw new Error(t('error.noImageId'));
        setPreview({ id, src: (res && res.url) || dataUrl });
        setBg({ kind: 'image', mediaId: id });
      } catch (err) {
        setError((err && err.message) || t('error.uploadImage'));
      } finally {
        setBusy(false);
      }
    },
    [uploadImage, setBg]
  );

  const bg = draft.bg;
  const mediaId = bg.mediaId;
  const previewSrc = preview && preview.id === String(mediaId) ? preview.src : mediaSrc(mediaId);
  const hasImage = bg.kind === 'image' && !!mediaId;
  const stop = (e) => e.stopPropagation();

  const panelStyle = {
    position: 'absolute',
    top: 10,
    right: 10,
    width: PANEL_WIDTH,
    maxWidth: 'calc(100% - 20px)',
    maxHeight: 'calc(100% - 20px)',
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
    background: C.panel,
    color: C.text,
    border: '1px solid ' + C.border,
    borderRadius: 14,
    boxShadow: C.shadow,
    zIndex: 60,
    overflow: 'hidden',
    fontFamily: 'inherit',
    fontSize: 13,
    lineHeight: 1.5,
    opacity: shown ? 1 : 0,
    transform: shown ? 'translateX(0)' : 'translateX(14px)',
    transition: 'transform 160ms ease, opacity 160ms ease',
  };

  const headerStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: '10px 12px',
    borderBottom: '1px solid ' + C.border,
    background: C.surface,
    flex: '0 0 auto',
  };

  const bodyStyle = {
    padding: '12px 12px 6px',
    overflowY: 'auto',
    overscrollBehavior: 'contain',
    flex: '1 1 auto',
  };

  const footerStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '9px 12px 11px',
    borderTop: '1px solid ' + C.border,
    background: C.surface,
    flex: '0 0 auto',
  };

  const ghostBtn = {
    appearance: 'none',
    border: '1px solid ' + C.border,
    background: 'transparent',
    color: C.text,
    borderRadius: 8,
    padding: '6px 10px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    lineHeight: 1.4,
  };

  return (
    <div
      role="dialog"
      aria-label={t('settings.title')}
      style={panelStyle}
      onWheel={stop}
      onPointerDown={stop}
      onDoubleClick={stop}
      onClick={stop}
    >
      {/* 标题栏 */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: 0.2 }}>{t('settings.title')}</span>
          <span
            style={{
              fontSize: 10.5,
              color: C.sub,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {t('settings.live')}
          </span>
        </div>
        <button
          type="button"
          aria-label={t('settings.closeAria')}
          title={t('common.close')}
          onClick={onClose}
          style={{
            width: 26,
            height: 26,
            flex: '0 0 auto',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            border: '1px solid transparent',
            borderRadius: 8,
            background: 'transparent',
            color: C.sub,
            fontSize: 17,
            lineHeight: 1,
            cursor: 'pointer',
          }}
        >
          ×
        </button>
      </div>

      {/* 内容 */}
      <div style={bodyStyle} className="dsh-sticky-wall-settings-body">
        {/* 语言 */}
        <Section title={t('settings.language')} hint={t('settings.langHint')}>
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { key: 'system', label: t('settings.langSystem') },
              { key: 'zh', label: t('settings.langZh') },
              { key: 'en', label: t('settings.langEn') },
            ].map((opt) => {
              const active = getLocalePref() === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => changeLocale(opt.key)}
                  style={{
                    flex: 1,
                    padding: '7px 10px',
                    borderRadius: 8,
                    fontSize: 12,
                    cursor: 'pointer',
                    border: active ? '1px solid #2563eb' : '1px solid rgba(0,0,0,.14)',
                    background: active ? '#2563eb' : 'transparent',
                    color: active ? '#fff' : 'inherit',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </Section>

        {/* 新建便签颜色 */}
        <Section
          title={t('settings.newNoteColor')}
          hint={(draft.newNoteColor?.mode ?? 'auto') === 'fixed' ? t('settings.modeFixed') : t('settings.modeRandom')}
        >
          <div style={{ display: 'flex', gap: 6, marginBottom: 9 }}>
            {[
              { key: 'auto', label: t('settings.modeAuto') },
              { key: 'fixed', label: t('settings.modeFixedColor') },
            ].map((opt) => {
              const active = (draft.newNoteColor?.mode ?? 'auto') === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() =>
                    setField('newNoteColor', {
                      mode: opt.key,
                      color: draft.newNoteColor?.color ?? '#faf7e0',
                    })
                  }
                  style={{
                    flex: 1,
                    padding: '7px 10px',
                    borderRadius: 8,
                    fontSize: 12,
                    cursor: 'pointer',
                    border: active ? '1px solid #2563eb' : '1px solid rgba(0,0,0,.14)',
                    background: active ? '2563eb' : 'transparent',
                    color: active ? '#fff' : 'inherit',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          {(draft.newNoteColor?.mode ?? 'auto') === 'fixed' ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {MINI_PALETTE.map((hex) => {
                const active = (draft.newNoteColor?.color ?? '').toLowerCase() === hex.toLowerCase();
                return (
                  <button
                    key={hex}
                    type="button"
                    aria-label={hex}
                    title={hex}
                    onClick={() => setField('newNoteColor', { mode: 'fixed', color: hex })}
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 7,
                      cursor: 'pointer',
                      background: hex,
                      border: active ? '2px solid #2563eb' : '1px solid rgba(0,0,0,.14)',
                    }}
                  />
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize: 11.5, opacity: 0.7, lineHeight: 1.5 }}>
              {t('settings.goldenHint')}
            </div>
          )}
        </Section>

        {/* 背景 */}
        <Section title={t('settings.background')} hint={bg.kind === 'none' ? t('settings.bgTransparent') : null}>
          <div
            role="group"
            aria-label={t('settings.bgTypeAria')}
            style={{ display: 'flex', gap: 6, marginBottom: 9 }}
          >
            {[
              ['color', t('settings.bgSolid')],
              ['image', t('settings.bgImage')],
              ['none', t('settings.bgNone')],
            ].map(([kind, label]) => (
              <button
                key={kind}
                type="button"
                aria-pressed={bg.kind === kind}
                onClick={() => {
                  if (bg.kind === kind) return;
                  setBg({ kind });
                }}
                style={segStyle(bg.kind === kind)}
              >
                {label}
              </button>
            ))}
          </div>

          {/* 纯色 */}
          {bg.kind === 'color' ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <input
                  type="color"
                  aria-label={t('settings.bgColorAria')}
                  value={bg.color}
                  onChange={(e) => setBg({ color: e.target.value })}
                  style={{
                    width: 40,
                    height: 28,
                    padding: 0,
                    border: '1px solid ' + C.border,
                    borderRadius: 7,
                    background: 'transparent',
                    cursor: 'pointer',
                  }}
                />
                <span
                  style={{
                    fontSize: 12,
                    color: C.sub,
                    fontVariantNumeric: 'tabular-nums',
                    textTransform: 'uppercase',
                  }}
                >
                  {bg.color}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {BG_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    title={color}
                    aria-label={t('settings.bgColorOptionAria', { color })}
                    onClick={() => setBg({ color })}
                    style={{
                      width: 24,
                      height: 24,
                      padding: 0,
                      borderRadius: 7,
                      cursor: 'pointer',
                      background: color,
                      border:
                        '2px solid ' +
                        (bg.color.toLowerCase() === color.toLowerCase() ? C.accent : C.border),
                    }}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {/* 图片 */}
          {bg.kind === 'image' ? (
            <div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <button
                  type="button"
                  onClick={pickFile}
                  disabled={busy}
                  style={{ ...ghostBtn, flex: '1 1 auto', opacity: busy ? 0.6 : 1 }}
                >
                  {busy ? t('settings.uploading') : hasImage ? t('settings.replaceImage') : t('settings.chooseImage')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPreview(null);
                    setBg({ kind: 'color', mediaId: null });
                  }}
                  disabled={!mediaId}
                  title={t('settings.deleteBg')}
                  style={{
                    ...ghostBtn,
                    color: mediaId ? C.danger : C.sub,
                    opacity: mediaId ? 1 : 0.5,
                  }}
                >
                  {t('common.delete')}
                </button>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files && e.target.files[0];
                  handleFile(file);
                  e.target.value = '';
                }}
              />
              {!hasImage ? (
                <div style={{ fontSize: 11.5, color: C.sub, marginBottom: 8 }}>
                  {t('settings.noImage')}
                </div>
              ) : (
                <div
                  style={{
                    position: 'relative',
                    borderRadius: 9,
                    overflow: 'hidden',
                    border: '1px solid ' + C.border,
                    background: C.surface,
                    marginBottom: 8,
                    height: 92,
                  }}
                >
                  <img
                    src={previewSrc}
                    alt={t('settings.bgPreviewAlt')}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                    onError={(e) => {
                      // 图片地址失效时不让面板闪成破图
                      e.currentTarget.style.opacity = '0';
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: `rgba(0, 0, 0, ${bg.dim})`,
                      pointerEvents: 'none',
                    }}
                  />
                </div>
              )}
            </div>
          ) : null}

          {/* 遮罩强度 */}
          {bg.kind === 'image' ? (
            <SliderRow
              label={t('settings.dim')}
              value={bg.dim}
              min={0}
              max={1}
              step={0.01}
              display={Math.round(bg.dim * 100) + '%'}
              onInput={(v) => setBg({ dim: v })}
            />
          ) : null}

          {/* 小预览块 */}
          <div
            style={{
              position: 'relative',
              height: 62,
              marginTop: 4,
              borderRadius: 9,
              overflow: 'hidden',
              border: '1px solid ' + C.border,
              background:
                bg.kind === 'none'
                  ? 'repeating-linear-gradient(45deg, rgba(127,127,127,0.16) 0 6px, rgba(127,127,127,0.05) 6px 12px)'
                  : bg.kind === 'color'
                    ? bg.color
                    : 'rgba(127, 127, 127, 0.22)',
            }}
          >
            {hasImage ? (
              <img
                src={previewSrc}
                alt=""
                aria-hidden="true"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => {
                  e.currentTarget.style.opacity = '0';
                }}
              />
            ) : null}
            {bg.kind === 'image' ? (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: `rgba(0, 0, 0, ${bg.dim})`,
                  pointerEvents: 'none',
                }}
              />
            ) : null}
            <div
              style={{
                position: 'absolute',
                left: 8,
                bottom: 6,
                fontSize: 10,
                color: bg.kind === 'color' && isLight(bg.color) ? 'rgba(31,36,48,0.6)' : 'rgba(255,255,255,0.85)',
                pointerEvents: 'none',
              }}
            >
              {bg.kind === 'none'
                ? t('settings.previewTransparent')
                : bg.kind === 'color'
                  ? t('settings.previewSolid')
                  : t('settings.previewImage', { percent: Math.round(bg.dim * 100) })}
            </div>
          </div>
        </Section>

        {/* 布局 */}
        <Section title={t('settings.layout')}>
          <SliderRow
            label={t('settings.columns')}
            value={draft.columns}
            min={1}
            max={8}
            step={1}
            display={t('settings.columnsUnit', { n: draft.columns })}
            onInput={(v) => setField('columns', v)}
          />
          <SliderRow
            label={t('settings.cardWidth')}
            value={draft.cardWidth}
            min={160}
            max={520}
            step={4}
            display={draft.cardWidth + ' px'}
            onInput={(v) => setField('cardWidth', v)}
          />
          <SliderRow
            label={t('settings.cardHeight')}
            value={draft.cardHeight}
            min={120}
            max={560}
            step={4}
            display={draft.cardHeight + ' px'}
            onInput={(v) => setField('cardHeight', v)}
          />
          <SliderRow
            label={t('settings.cardGap')}
            value={draft.gap}
            min={0}
            max={80}
            step={1}
            display={draft.gap + ' px'}
            onInput={(v) => setField('gap', v)}
          />
        </Section>

        {/* 预览 / 字号 */}
        <Section title={t('settings.preview')}>
          <SliderRow
            label={t('settings.hoverScale')}
            value={draft.hoverScale}
            min={1}
            max={3}
            step={0.05}
            display={fmt(draft.hoverScale, 2) + '×'}
            onInput={(v) => setField('hoverScale', v)}
          />
          <SliderRow
            label={t('settings.fontSize')}
            value={draft.fontSize}
            min={10}
            max={28}
            step={1}
            display={draft.fontSize + ' px'}
            onInput={(v) => setField('fontSize', v)}
          />
        </Section>

        {error ? (
          <div
            style={{
              fontSize: 11.5,
              color: C.danger,
              background: 'rgba(214, 69, 69, 0.10)',
              border: '1px solid rgba(214, 69, 69, 0.35)',
              borderRadius: 8,
              padding: '6px 8px',
              marginBottom: 10,
              wordBreak: 'break-word',
            }}
          >
            {error}
          </div>
        ) : null}
      </div>

      {/* 底栏 */}
      <div style={footerStyle}>
        <button type="button" onClick={resetAll} style={{ ...ghostBtn, flex: '1 1 auto' }}>
          {t('settings.reset')}
        </button>
        <button
          type="button"
          onClick={onClose}
          style={{
            ...ghostBtn,
            flex: '0 0 auto',
            background: C.accent,
            borderColor: 'transparent',
            color: '#fff',
          }}
        >
          {t('settings.done')}
        </button>
      </div>
    </div>
  );
}

/** 极简亮度判断：只用于预览文字配色，不追求精确。 */
function isLight(hex) {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return true;
  let s = m[1];
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  const r = parseInt(s.slice(0, 2), 16);
  const g = parseInt(s.slice(2, 4), 16);
  const b = parseInt(s.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62;
}

export default WallSettings;
