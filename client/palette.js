/**
 * 便签墙 — 新便签的自动配色。
 *
 * 目标：新建便签时自动给一个「与现有便签都不同」的颜色，并且配色看起来是
 * 协调的，而不是随机撒色。同时**手动色板（NOTE_PALETTE）的颜色与顺序保持
 * 不变**，这样用户想手动改回某个色时，色板上的位置是稳定的。
 *
 * 策略（按优先级）：
 *   1. 先按 AUTO_ORDER 依次取「当前墙上没出现过」的颜色 —— 保证前 N 张互不撞色；
 *   2. AUTO_ORDER 用尽后，追加莫兰迪色系补位（更灰、更耐看，满墙时不刺眼）；
 *   3. 理论上色板有限，便签可以无限多，全部用完时退化为「用得最少的颜色」，
 *      并在并列者里挑与最近一张便签色相距离最远的，避免连续两张同色。
 *
 * 这是纯函数模块，不含 DOM / React，方便单测。
 *
 * @module dsh-notewall/client/palette
 */

/**
 * 手动色板：颜色与顺序必须与 host 的 `lib/store.js` NOTE_PALETTE 保持一致。
 * 顺序即色板上显示的从左到右。
 */
export const NOTE_PALETTE = [
  '#fff3a3',
  '#ffe0b2',
  '#ffcdd2',
  '#d1c4e9',
  '#c8e6c9',
  '#b3e5fc',
  '#f8bbd0',
  '#e0e0e0',
];

/**
 * 莫兰迪色系补位色：低饱和、带灰调，用作第 9 张及以后的便签。
 * 不进入手动色板，只在自动分配里使用。
 */
export const MORANDI_EXTRA = [
  '#dcd6cc',
  '#c9d2ce',
  '#c7d3dc',
  '#dcd2db',
  '#e3dcd2',
  '#cfcbc3',
  '#bcd0ce',
  '#d8cfc7',
];

/**
 * 自动分配时的尝试顺序。
 *
 * 不是色板原序：先走「冷调 + 中性」再走暖黄，避免新建几张就一片黄；
 * 同时也让相邻创建的便签颜色跳跃更大（视觉上更好辨认）。
 */
export const AUTO_ORDER = [
  '#c8e6c9',
  '#b3e5fc',
  '#d1c4e9',
  '#ffcdd2',
  '#fff3a3',
  '#ffe0b2',
  '#f8bbd0',
  '#e0e0e0',
  ...MORANDI_EXTRA,
];

/** 把 `#rrggbb` 或 `#rgb` 归一化成小写 `#rrggbb`；无法识别返回 null。 */
export function normalizeHex(value) {
  if (typeof value !== 'string') return null;
  const raw = value.trim().toLowerCase();
  const long = /^#[0-9a-f]{6}$/;
  const short = /^#[0-9a-f]{3}$/;
  if (long.test(raw)) return raw;
  if (short.test(raw)) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`;
  }
  return null;
}

/**
 * hex → HSL。
 *
 * @param {string} hex 颜色
 * @returns {{h: number, s: number, l: number}} h 为 0-360，s/l 为 0-1
 */
export function hexToHsl(hex) {
  const normalized = normalizeHex(hex);
  if (!normalized) return { h: 0, s: 0, l: 0 };
  const r = parseInt(normalized.slice(1, 3), 16) / 255;
  const g = parseInt(normalized.slice(3, 5), 16) / 255;
  const b = parseInt(normalized.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / d + 2) * 60;
  else h = ((r - g) / d + 4) * 60;
  return { h, s, l };
}

/**
 * 两个颜色的「色相环距离」，取 0-180（180 = 正相反）。
 *
 * 饱和度极低的颜色（灰）没有可靠色相，此时直接按明度差给一个替代距离，
 * 否则会把一堆灰当成同一个色相。
 */
export function hueDistance(a, b) {
  const ca = hexToHsl(a);
  const cb = hexToHsl(b);
  const grayA = ca.s < 0.08;
  const grayB = cb.s < 0.08;
  if (grayA || grayB) return Math.abs(ca.l - cb.l) * 180;
  const raw = Math.abs(ca.h - cb.h);
  return raw > 180 ? 360 - raw : raw;
}

/**
 * 为一张新便签挑颜色。
 *
 * @param {Array<{ color?: string }>} notes 现有便签（顺序不限）
 * @param {object} [options]
 * @param {string[]} [options.palette] 候选色顺序，缺省 AUTO_ORDER
 * @param {string} [options.latest] 最近创建的那张便签的颜色，用于破并列
 * @returns {{ color: string, distinct: boolean }}
 *   `distinct` 为 false 表示色板里的颜色已被用遍，返回值只能退化为「用得最少」
 */
/**
 * 自动配色：黄金角步进的色相 + 固定的饱和度/亮度。
 *
 * 为什么这么做：
 * - 固定 S/L，所有便签落在同一个「明度带」里，不会一块深一块浅，天然协调；
 *   L=93% 让彩度只有约 0.10（与系统备忘录的同级），" + '色相差得再远也不刺眼'；
 * - 色相按黄金角 137.508° 递进，任意相邻两张的色相差都接近这个角，
 *   是均匀分布里最不容易撞色的步长（斐波那契叶序同源），因此不会出现
 *   「第二排又和第一排同色」的观感。
 *
 * @param {number} index 序号（用当前便签数量即可）
 * @returns {string} 十六进制颜色
 */
export function autoNoteColor(index) {
  const hue = (Number(index || 0) * 137.508) % 360;
  return hslToHex(hue, 72, 93);
}

/** HSL → #rrggbb。h:0-360, s/l:0-100 */
function hslToHex(h, s, l) {
  const sat = Math.min(100, Math.max(0, s)) / 100;
  const lig = Math.min(100, Math.max(0, l)) / 100;
  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const hp = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp < 1) { r = c; g = x; }
  else if (hp < 2) { r = x; g = c; }
  else if (hp < 3) { g = c; b = x; }
  else if (hp < 4) { g = x; b = c; }
  else if (hp < 5) { r = x; b = c; }
  else { r = c; b = x; }
  const m = lig - c / 2;
  const to = (v) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return "#" + to(r) + to(g) + to(b);
}

/**
 * 为一张新便签挑颜色：在黄金角序列里跳过已被占用的颜色。
 *
 * @param {Array<{ color?: string }>} notes 现有便签
 * @returns {{ color: string, distinct: boolean }}
 */
export function pickAutoColor(notes) {
  const list = Array.isArray(notes) ? notes : [];
  const used = new Set();
  for (const note of list) {
    const hex = normalizeHex(note?.color);
    if (hex) used.add(hex);
  }
  // 从「现有张数」起步，跳过撞色；最多试探 90 次（色相环角度离散，足够）
  for (let i = 0; i < 90; i += 1) {
    const hex = autoNoteColor(list.length + i);
    if (!used.has(hex)) return { color: hex, distinct: true };
  }
  return { color: autoNoteColor(list.length), distinct: false };
}

/**
 * 按墙设置决定一张新便签的颜色。
 * @param {Array} notes 现有便签
 * @param {object} wall 墙设置（可能缺字段）
 */
export function resolveNewNoteColor(notes, wall) {
  const config = wall && wall.newNoteColor;
  if (config && config.mode === 'fixed') {
    const fixed = normalizeHex(config.color);
    if (fixed) return { color: config.color, distinct: true };
  }
  return pickAutoColor(notes);
}
