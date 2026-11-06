/**
 * 便签墙 — hover 放大锚点选择（纯函数，可单测）。
 *
 * 背景：卡片用 `transform: scale()` 放大，放大的视觉溢出量是单侧
 * `(scale - 1) * height / 2`。`.sw-wall` 是滚动容器（`overflow-y: auto`），
 * 溢出部分会被裁切——默认 `transform-origin: center` 时，顶部那排便签向上
 * 溢出的那一半正好被工具栏/容器边缘吃掉，表现为「标题被截断」。
 *
 * 所以放大前测一次卡片与滚动容器的相对位置，按空间选锚点。这个判定与 DOM
 * 无关，单独放在这里以便测试覆盖。
 *
 * @module dsh-notewall/client/origin
 */

/** 阴影余量（像素），避免放大后的投影仍被裁。 */
const SHADOW_MARGIN = 4;

/**
 * @param {{
 *   cardTop: number,   卡片顶边的视口坐标
 *   cardBottom: number,卡片底边的视口坐标
 *   cardHeight: number,卡片原始高度
 *   viewTop: number,   滚动容器顶边的视口坐标
 *   viewBottom: number,滚动容器底边的视口坐标
 *   hoverScale: number,放大倍数（>= 1）
 * }} input
 * @returns {'center center'|'top center'|'bottom center'} 传给 CSS transform-origin
 */
export function pickTransformOrigin({
  cardTop,
  cardBottom,
  cardHeight,
  viewTop,
  viewBottom,
  hoverScale,
}) {
  const scale = Math.max(1, Number(hoverScale) || 1);
  if (scale === 1) return 'center center';

  const need = ((scale - 1) * cardHeight) / 2 + SHADOW_MARGIN;
  const above = cardTop - viewTop;
  const below = viewBottom - cardBottom;

  // 两侧都够：中心放大，视觉最自然
  if (above >= need && below >= need) return 'center center';
  // 上方不够、下方够：锚 top，只向下长
  if (above < need && below >= need) return 'top center';
  // 下方不够、上方够：锚 bottom，只向上长
  if (below < need && above >= need) return 'bottom center';
  // 两侧都不够（卡片比视口还高）：往空间更大的一侧长
  return above >= below ? 'top center' : 'bottom center';
}

export { SHADOW_MARGIN };
