/**
 * 便签墙 — 单张便签卡。
 *
 * 折叠态只显示开头一段，底部渐隐提示「后面还有」（这就是需求里的
 * 「从开头到哪里会被直接显示在便签贴上，之后的内容点开才看得到」）；
 * 指针停留时按 `wall.hoverScale` 放大、预览区同时变高，露出更多内容。
 *
 * 卡片本身只负责展示与交互回调，数据变更由上层（wall.js / index.js）提交。
 *
 * @module dsh-notewall/client/card
 */

import { useEffect, useRef, useState } from 'react';
import { pickTransformOrigin } from './origin';
import { t } from './strings.js';

/** 折叠态预览高度（占卡片内容区的比例）。 */
const PREVIEW_RATIO = 0.62;
/** 悬停态预览高度比例。 */
const PREVIEW_RATIO_HOVER = 0.94;
/** 指针停留多久才放大（毫秒）——避免扫过就抖。 */
const HOVER_DELAY = 120;

/** 时间显示：今天只显示时分，其余显示月-日。 */
export function formatTime(ms) {
  if (!ms) return '';
  const date = new Date(ms);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const pad = (n) => String(n).padStart(2, '0');
  if (sameDay) return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return t('card.monthDay', { day: date.getDate(), month: date.getMonth() + 1 });
}

/** 提醒时间的人性化文案。 */
/** 把 delivery 记录压成「已发送」提示文案：已于 11-05 15:19 定时发送到 某会话 */
/**
 * 把 delivery.at 统一成毫秒时间戳。
 * 注意：host 的 normalizeDelivery 存的是**数字**（Math.round(at)），
 * 不是 ISO 字符串 —— Date.parse(数字) 会返回 NaN，这是个踩过的坑。
 */
export function deliveryTimeMs(delivery) {
  const raw = delivery?.at;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw) {
    const parsed = Date.parse(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function formatDelivery(delivery) {
  const ms = deliveryTimeMs(delivery);
  if (ms === null) return null;
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, '' + '0');
  const stamp = pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  const target = delivery.sessionTitle || t('card.sessionFallback');
  // 到点前叫「预约」，到点后才叫「已于」
  const past = ms <= Date.now();
  return past
    ? t('card.deliveryDone', { stamp, target })
    : t('card.deliveryPlanned', { stamp, target });
}

export function formatAlarm(ms) {
  if (!ms) return '';
  const date = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  if (sameDay) return t('card.today', { time });
  return `${date.getMonth() + 1}/${date.getDate()} ${time}`;
}

/**
 * @param {{
 *   note: object,
 *   wall: object,
 *   index: number,
 *   onOpen: (note: object) => void,
 *   onTogglePin: (note: object) => void,
 *   onDelete: (note: object) => void,
 *   draggable: boolean,
 *   dragging: boolean,
 *   dropTarget: boolean,
 *   shiftX: number,
 *   shiftY: number,
 *   onDragStart: (event: DragEvent) => void,
 *   onDragEnter: (event: DragEvent) => void,
 *   onDragEnd: (event: DragEvent) => void,
 *   onDrop: (event: DragEvent) => void,
 * }} props
 */
export function NoteCard({
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
  onDrop,
}) {
  // 定时发送记录 → 卡片提示文案（已于 X 定时发送到 Y）
  const deliveryText = formatDelivery(note.delivery);
  // 还没到点的投递才能取消；已经发出去的只剩「记录」，取消没有意义。
  const deliveryAtMs = note.delivery ? deliveryTimeMs(note.delivery) : null;
  const deliveryPending = deliveryAtMs !== null && deliveryAtMs > Date.now();
  const [hovered, setHovered] = useState(false);
  const timer = useRef(null);
  const fadeRef = useRef(null);
  const cardRef = useRef(null);
  /** 放大锚点：随卡片在可视区内的位置变化，避免放大后被滚动容器裁掉。 */
  const [origin, setOrigin] = useState('center center');

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  /**
   * 决定这次放大往哪个方向长。
   *
   * 卡片用 `transform: scale()` 放大，默认锚点是几何中心，于是放大的那一半会
   * 越过卡片的原始边界；`.sw-wall` 是滚动容器（overflow 裁剪），顶部那排便签
   * 往上溢出的部分正好被工具栏盖住/裁掉——表现就是「标题被吃掉」。
   *
   * 这里在放大前测一次卡片与滚动容器的相对位置：
   *   上方空间不够 → 锚点 top（只向下长）
   *   下方空间不够 → 锚点 bottom（只向上长）
   *   都够         → 保持中心放大（视觉最自然）
   *   都不够       → 选空间更大的一侧，至少让内容完整可见
   *
   * @returns {string} CSS transform-origin
   */
  const measureOrigin = () => {
    const el = cardRef.current;
    const scroller = el?.closest ? el.closest('.sw-wall') : null;
    if (!el || !scroller) return 'center center';
    const cardRect = el.getBoundingClientRect();
    const viewRect = scroller.getBoundingClientRect();
    return pickTransformOrigin({
      cardTop: cardRect.top,
      cardBottom: cardRect.bottom,
      cardHeight: cardRect.height,
      viewTop: viewRect.top,
      viewBottom: viewRect.bottom,
      hoverScale: wall.hoverScale,
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

  return (
    <div
      className={[
        'sw-card',
        hovered ? 'is-hover' : '',
        note.pinned ? 'is-pinned' : '',
        shiftX || shiftY ? 'is-shifting' : '',
        dragging ? 'is-dragging' : '',
        dropTarget ? 'is-drop-target' : '',
      ].filter(Boolean).join(' ')}
      ref={cardRef}
      style={{
        width: cardWidth,
        height: cardHeight,
        background: note.color,
        color: note.textColor,
        fontSize: wall.fontSize,
        transform: (shiftX || shiftY ? `translate(${shiftX}px, ${shiftY}px) ` : '') + `scale(${scale})`,
        // 锚点按可视空间动态选，避免放大后顶部/底部被滚动容器裁掉
        transformOrigin: origin,
        zIndex: hovered ? 30 : (note.pinned ? 2 : 1),
        transitionDelay: hovered ? '0ms' : '60ms',
        ['--sw-fade']: `${note.color}`,
      }}
      draggable={draggable}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', note.id);
        // 拖动缩略图更贴合卡片外观
        onDragStart?.(event);
      }}
      onDragEnter={(event) => {
        event.preventDefault();
        onDragEnter?.(event);
      }}
      onDragOver={(event) => {
        // 必须阻止默认行为才能触发 drop
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
      }}
      onDragEnd={(event) => onDragEnd?.(event)}
      onDrop={(event) => {
        event.preventDefault();
        onDrop?.(event);
      }}
      onMouseEnter={enter}
      onMouseLeave={leave}
      onClick={() => onOpen?.(note)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen?.(note);
        }
      }}
      title={note.title || t('card.emptyNote')}
      data-note-id={note.id}
      data-index={index}
    >
      <div className="sw-card-title">
        {note.draft ? (
          <span
            className="sw-draft-badge"
            style={{
              fontSize: 10,
              fontWeight: 600,
              padding: '1px 5px',
              marginRight: 5,
              borderRadius: 4,
              border: '1px dashed currentColor',
              opacity: 0.7,
              verticalAlign: "middle",
            }}
          >
            {t('card.draft')}
          </span>
        ) : null}
        {note.title || t('card.emptyNote')}
      </div>

      <div
        className="sw-preview"
        style={{ maxHeight: previewHeight }}
        ref={fadeRef}
        // 内容由 host 侧清洗过（去 script / on* 属性），图片走 /sticky-wall/media
        dangerouslySetInnerHTML={{ __html: note.html || '<p class="sw-muted">' + t('card.noContent') + '</p>' }}
        onClick={(event) => {
          // 图片点击也进编辑，避免浏览器开新标签
          if (event.target?.tagName === 'IMG') {
            event.preventDefault();
            onOpen?.(note);
          }
        }}
      />
      <div className="sw-preview-fade" />

      <div className="sw-card-meta">
        <span>{formatTime(note.updatedAt || note.createdAt)}</span>
        {note.createdBy === 'agent' ? <span>{t('card.byAgent')}</span> : null}
        {note.alarmAt ? (
          <span className="sw-alarm-dot" style={overdue ? { background: 'rgba(220,38,38,.18)' } : undefined}>
            ⏰ {formatAlarm(note.alarmAt)}
          </span>
        ) : null}
        {onDeliver ? (
          <button
            type="button"
            className="sw-badge"
            title={deliveryText ? t('card.deliveryTipSet', { text: deliveryText }) : t('card.deliveryTipEmpty')}
            aria-label={deliveryText || t('deliver.title')}
            onClick={(event) => {
              event.stopPropagation();
              onDeliver(note);
            }}
            style={{
              // 父级 .sw-card-meta 是 pointer-events: none（纯装饰行），
              // 继承下来就点不到，必须自己抢回事件。
              pointerEvents: 'auto',
              marginLeft: 'auto',
              // 外观对齐右上角 .sw-badge（同底色同圆角），只是宽度自适应文字。
              width: 'auto',
              // .sw-badge 基础样式写死了 width/height:22px，两行文案必须显式解除
              height: 'auto',
              minHeight: 22,
              padding: '0 6px',
              fontSize: 10.5,
              maxWidth: '260px',
              // 会话标题经常很长：允许最多两行，再多才截断
              display: 'flex',
              alignItems: 'flex-start',
              gap: 3,
              textAlign: 'left',
              lineHeight: 1.35,
            }}
          >
            {deliveryText ? (
              <>
                <span style={{ flexShrink: 0 }}>⏰</span>
                <span
                  style={{
                    display: '-webkit-box',
                    WebkitBoxOrient: 'vertical',
                    WebkitLineClamp: 2,
                    overflow: 'hidden',
                    wordBreak: 'break-word',
                  }}
                >
                  {deliveryText}
                </span>
              </>
            ) : (
              t('deliver.title')
            )}
          </button>
        ) : null}
        {deliveryPending ? (
          <button
            type="button"
            title={t('card.cancelDeliveryTitle')}
            aria-label={t('card.cancelDeliveryAria')}
            style={{
              flexShrink: 0,
              marginLeft: 4,
              padding: '2px 6px',
              fontSize: 11,
              lineHeight: 1.2,
              borderRadius: 6,
              border: '1px solid #e0b4b4',
              background: '#fff5f5',
              color: '#b05050',
              cursor: 'pointer',
              pointerEvents: 'auto',
            }}
            onClick={(event) => {
              event.stopPropagation();
              onCancelDelivery?.(note.id);
            }}
          >
            {t('card.cancelDelivery')}
          </button>
        ) : null}
      </div>

      <div className="sw-badges" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          className="sw-badge"
          title={note.pinned ? t('card.unpin') : t('card.pin')}
          aria-label={note.pinned ? t('card.unpin') : t('card.pin')}
          onClick={() => onTogglePin?.(note)}
        >
          {note.pinned ? '📌' : '📍'}
        </button>
        <button
          type="button"
          className="sw-badge"
          title={t('card.delete')}
          aria-label={t('card.delete')}
          onClick={() => onDelete?.(note)}
        >
          🗑
        </button>
      </div>
    </div>
  );
}
