#!/usr/bin/env node
/**
 * hover 放大锚点判定测试。
 *
 * 覆盖 2026-11-03 用户实测反馈的「放大后被顶部工具栏遮住」场景：卡片紧贴
 * 滚动容器顶部时，放大必须锚在 top，不能向上溢出。
 *
 * Run: node test/hover-origin.mjs
 */
import { pickTransformOrigin, SHADOW_MARGIN } from '../client/origin.js';

let failures = 0;
function check(label, actual, expected) {
  const ok = actual === expected;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : ` → got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`}`);
  if (!ok) failures += 1;
}

const H = 220;
const scale = 1.5;
// (1.5 - 1) * 220 / 2 = 55，+4 余量 = 59
const need = ((scale - 1) * H) / 2 + SHADOW_MARGIN;
check('need 常量正确', need, 59);

// 1) 卡片紧贴容器顶部（截图里的情况：上方 28px 内边距 < 59）→ 必须锚 top
check('紧贴顶部 → top center', pickTransformOrigin({
  cardTop: 128, cardBottom: 128 + H, cardHeight: H,
  viewTop: 100, viewBottom: 900, hoverScale: scale,
}), 'top center');

// 2) 完全在中间，两侧都够 → 中心放大
check('居中且两侧充足 → center center', pickTransformOrigin({
  cardTop: 400, cardBottom: 400 + H, cardHeight: H,
  viewTop: 100, viewBottom: 900, hoverScale: scale,
}), 'center center');

// 3) 紧贴容器底部 → 锚 bottom，向上长
check('紧贴底部 → bottom center', pickTransformOrigin({
  cardTop: 700, cardBottom: 700 + H, cardHeight: H,
  viewTop: 100, viewBottom: 930, hoverScale: scale,
}), 'bottom center');

// 4) 上方刚好等于 need（边界）→ 视为足够，保持 center
check('上方恰好等于阈值 → center center', pickTransformOrigin({
  cardTop: 100 + need, cardBottom: 100 + need + H, cardHeight: H,
  viewTop: 100, viewBottom: 900, hoverScale: scale,
}), 'center center');

// 5) 上方差 1px → 锚 top
check('上方差 1px → top center', pickTransformOrigin({
  cardTop: 100 + need - 1, cardBottom: 100 + need - 1 + H, cardHeight: H,
  viewTop: 100, viewBottom: 900, hoverScale: scale,
}), 'top center');

// 6) 两侧都不够（容器比卡片矮）→ 选空间更大的一侧
check('两侧都不够、上方更大 → top center', pickTransformOrigin({
  cardTop: 140, cardBottom: 140 + 400, cardHeight: 400,
  viewTop: 100, viewBottom: 200, hoverScale: 2,
}), 'top center');
// above = 20 - 100 = -80，below = 500 - 380 = 120 → below 更大 → 向上长
check('两侧都不够、下方更大 → bottom center', pickTransformOrigin({
  cardTop: 20, cardBottom: 20 + 360, cardHeight: 360,
  viewTop: 100, viewBottom: 500, hoverScale: 2,
}), 'bottom center');

// 7) scale = 1 时不需要放大，恒为 center
check('scale=1 → center center', pickTransformOrigin({
  cardTop: 100, cardBottom: 100 + H, cardHeight: H,
  viewTop: 100, viewBottom: 900, hoverScale: 1,
}), 'center center');

// 8) 脏数据不崩（hoverScale 缺失/非法按 1 处理）
check('hoverScale 缺失 → center center', pickTransformOrigin({
  cardTop: 100, cardBottom: 100 + H, cardHeight: H,
  viewTop: 100, viewBottom: 900,
}), 'center center');
check('hoverScale 非法字符串不崩', pickTransformOrigin({
  cardTop: 100, cardBottom: 100 + H, cardHeight: H,
  viewTop: 100, viewBottom: 900, hoverScale: 'nope',
}), 'center center');

// 9) 大倍率时阈值随之变大，仍按空间选
const bigScale = 2.5;
const bigNeed = ((bigScale - 1) * H) / 2 + SHADOW_MARGIN;
check('大倍率、上方 60px 不够 → top center', pickTransformOrigin({
  cardTop: 100 + 60, cardBottom: 100 + 60 + H, cardHeight: H,
  viewTop: 100, viewBottom: 1200, hoverScale: bigScale,
}), bigNeed > 60 ? 'top center' : 'center center');

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
