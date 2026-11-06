#!/usr/bin/env node
/**
 * 图片选中 / 四角拖拽缩放的纯函数测试。
 *
 * 覆盖 2026-11-03 新增的「双击图片 → 拖角缩放」功能里最容易算错的几块：
 * 四个角各自的方向、宽高比锁定、最小/最大尺寸钳制、反向拖拽把图拖到小于
 * 最小值时不能出现负数/0，以及 overlay 的定位换算（含滚动偏移）。
 *
 * 为什么要绕一圈加载 client/editor.js：
 *  - editor.js 里有 JSX，纯 node 不能直接 import，所以用构建脚本同一个 esbuild
 *    在内存里打成 ESM（不写盘），再以 data: URL 导入。
 *  - 只测纯函数、不渲染组件，所以 react / react-dom 用 module hooks 换成空壳。
 *    这里没有新增任何依赖，esbuild 本来就是这个包的构建期依赖。
 *
 * Run: node test/image-resize.mjs
 */
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerHooks } from 'node:module';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

let failures = 0;
function check(label, condition, extra) {
  const ok = Boolean(condition);
  console.log(
    `${ok ? 'ok  ' : 'FAIL'} ${label}${ok || extra === undefined ? '' : ` → ${JSON.stringify(extra)}`}`,
  );
  if (!ok) failures += 1;
}

/** 两个尺寸的宽高比是否一致（允许 1px 取整误差）。 */
function ratioClose(width, height, expected) {
  if (!(height > 0)) return false;
  return Math.abs(width / height - expected) < 0.01;
}

/* ------------------------------------------------------- 载入被测模块 */

// react 只在组件里用，纯函数测试只需要「导入不炸」。
const REACT_STUB =
  'export const useState = (initial) => [initial, () => {}];' +
  'export const useEffect = () => {};' +
  'export const useCallback = (fn) => fn;' +
  'export const useMemo = (fn) => fn();' +
  'export const useRef = (value) => ({ current: value });';

const JSX_STUB =
  'export const jsx = () => null;' +
  'export const jsxs = () => null;' +
  'export const Fragment = Symbol("Fragment");';

const REACT_DOM_STUB = 'export const createPortal = (node) => node;';

const STUBS = {
  react: 'data:text/javascript,' + encodeURIComponent(REACT_STUB),
  'react/jsx-runtime': 'data:text/javascript,' + encodeURIComponent(JSX_STUB),
  'react-dom': 'data:text/javascript,' + encodeURIComponent(REACT_DOM_STUB),
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (Object.prototype.hasOwnProperty.call(STUBS, specifier)) {
      return { url: STUBS[specifier], shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

/** esbuild 的解析顺序与 scripts/build-client.mjs 一致。 */
function resolveEsbuild() {
  const candidates = [
    join(ROOT, 'node_modules/esbuild/package.json'),
    join(homedir(), '.dsh/OurWhaleGirl/node_modules/esbuild/package.json'),
  ];
  const checkout = process.env.DSH_SOURCE ?? join(homedir(), '.dsh/source/current');
  const store = join(checkout, 'node_modules/.pnpm');
  if (existsSync(store)) {
    for (const entry of readdirSync(store)
      .filter((name) => name.startsWith('esbuild@'))
      .sort()
      .reverse()) {
      candidates.push(join(store, entry, 'node_modules/esbuild/package.json'));
    }
  }
  candidates.push(join(checkout, 'node_modules/esbuild/package.json'));
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate.replace(/\/package\.json$/, '');
  }
  throw new Error('esbuild not found: 这是构建期依赖，先跑 node scripts/build-client.mjs 验证环境');
}

const require = createRequire(import.meta.url);
const esbuild = require(resolveEsbuild());

const built = await esbuild.build({
  entryPoints: [join(ROOT, 'client/editor.js')],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  external: ['react', 'react-dom', 'react/jsx-runtime'],
  loader: { '.js': 'jsx' },
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  legalComments: 'none',
});

const code = built.outputFiles[0].text;
const mod = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const { cornerSigns, resizeFromDrag, overlayGeometry, IMAGE_RESIZE_MIN, IMAGE_SELECT_OUTSET } = mod;

check('导出了 cornerSigns', typeof cornerSigns === 'function');
check('导出了 resizeFromDrag', typeof resizeFromDrag === 'function');
check('导出了 overlayGeometry', typeof overlayGeometry === 'function');
check('最小尺寸是 40', IMAGE_RESIZE_MIN === 40, IMAGE_RESIZE_MIN);
check('选中框外扩是 8', IMAGE_SELECT_OUTSET === 8, IMAGE_SELECT_OUTSET);

if (failures > 0) {
  console.log('\n模块导出缺失，后面的断言没有意义');
  console.log(`${failures} FAILURE(S)`);
  process.exit(1);
}

/* ---------------------------------------------------------- 角点方向 */

check('se = 右+下', cornerSigns('se').x === 1 && cornerSigns('se').y === 1, cornerSigns('se'));
check('ne = 右+上', cornerSigns('ne').x === 1 && cornerSigns('ne').y === -1, cornerSigns('ne'));
check('sw = 左+下', cornerSigns('sw').x === -1 && cornerSigns('sw').y === 1, cornerSigns('sw'));
check('nw = 左+上', cornerSigns('nw').x === -1 && cornerSigns('nw').y === -1, cornerSigns('nw'));
// 大小写/脏数据不能抛错，退化按右下角
check('大写 SE 也能识别', cornerSigns('SE').x === 1 && cornerSigns('SE').y === 1);
check('未知角点退化为 se', cornerSigns('zzz').x === 1 && cornerSigns('zzz').y === 1);
check('缺角点退化为 se', cornerSigns(undefined).x === 1 && cornerSigns(undefined).y === 1);

const W = 400;
const H = 300;
const ASPECT = W / H; // 4/3

/* ---------------------------------------- 四个角向外拖都必须变大（保比例） */

const growCases = [
  { corner: 'se', dx: 100, dy: 100 },
  { corner: 'sw', dx: -100, dy: 100 },
  { corner: 'ne', dx: 100, dy: -100 },
  { corner: 'nw', dx: -100, dy: -100 },
];
for (const item of growCases) {
  const size = resizeFromDrag({ startWidth: W, startHeight: H, dx: item.dx, dy: item.dy, corner: item.corner });
  check(
    `${item.corner} 向外拖 100px → 变大`,
    size.width > W && size.height > H,
    size,
  );
  check(
    `${item.corner} 向外拖 → 保持 4:3`,
    ratioClose(size.width, size.height, ASPECT),
    size,
  );
}

/* --------------------------------------------- 四个角向内拖都必须变小 */

for (const item of growCases) {
  const size = resizeFromDrag({
    startWidth: W,
    startHeight: H,
    dx: -item.dx,
    dy: -item.dy,
    corner: item.corner,
  });
  check(`${item.corner} 向内拖 → 变小`, size.width < W && size.height < H, size);
  check(`${item.corner} 向内拖 → 保持 4:3`, ratioClose(size.width, size.height, ASPECT), size);
}

/* --------------------------------------------------- 纵向/横向单轴拖动 */

// 只往正下方拖（横向 0px）：靠高度轴驱动，否则四角手柄会「拖了没反应」。
const vertical = resizeFromDrag({ startWidth: W, startHeight: H, dx: 0, dy: 120, corner: 'se' });
check('se 只向下拖 120px → 按高度轴放大', vertical.width > W && vertical.height > H, vertical);
check('se 只向下拖 → 保持 4:3', ratioClose(vertical.width, vertical.height, ASPECT), vertical);

// 横向位移远大于纵向时，由横向驱动
const horizontal = resizeFromDrag({ startWidth: W, startHeight: H, dx: 300, dy: 10, corner: 'se' });
check('se 横向 300px / 纵向 10px → 横向驱动', horizontal.width === 700, horizontal);

/* ------------------------------------------------------- 最小尺寸钳制 */

const tiny = resizeFromDrag({ startWidth: W, startHeight: H, dx: -1000, dy: -1000, corner: 'se' });
check('反向猛拖 → 宽度卡在下限 40', tiny.width === 40, tiny);
check('反向猛拖 → 高度按比例（30）', tiny.height === 30, tiny);
check('反向猛拖 → 尺寸仍是正整数', Number.isInteger(tiny.width) && tiny.height > 0, tiny);

// 左上角反向拖（往右下猛推）同样卡下限
const tinySw = resizeFromDrag({ startWidth: W, startHeight: H, dx: 1000, dy: -1000, corner: 'sw' });
check('sw 反向猛拖 → 宽度卡在下限 40', tinySw.width === 40, tinySw);

// 起始尺寸本来就小于下限：钳到 40 而不是原样返回 10
const tinyStart = resizeFromDrag({ startWidth: 10, startHeight: 10, dx: 0, dy: 0, corner: 'se' });
check('起始尺寸小于下限 → 抬到 40', tinyStart.width === 40, tinyStart);

/* ------------------------------------------------------- 最大尺寸钳制 */

const big = resizeFromDrag({ startWidth: W, startHeight: H, dx: 1000, dy: 1000, corner: 'se', maxSize: 480 });
check('正向猛拖 → 宽度卡在上限 480', big.width === 480, big);
check('上限钳制后仍保持 4:3', ratioClose(big.width, big.height, ASPECT), big);

// 上限小于下限时必须仍取到下限，不能出现倒挂区间把图压成 0
const inverted = resizeFromDrag({ startWidth: W, startHeight: H, dx: 1000, dy: 0, corner: 'se', maxSize: 10 });
check('maxSize < minSize → 取下限 40', inverted.width === 40, inverted);
check('maxSize < minSize → 高度 > 0', inverted.height > 0, inverted);

/* ------------------------------------------------------------- 脏数据 */

const zeroHeight = resizeFromDrag({ startWidth: 400, startHeight: 0, dx: 0, dy: 0, corner: 'se' });
check('startHeight=0 不产生 NaN/Infinity', Number.isFinite(zeroHeight.width) && Number.isFinite(zeroHeight.height), zeroHeight);
check('startHeight=0 时按 1:1 处理', zeroHeight.width === 400 && zeroHeight.height === 400, zeroHeight);

const nanDrag = resizeFromDrag({ startWidth: W, startHeight: H, dx: NaN, dy: undefined, corner: 'se' });
check('dx=NaN 当作 0', nanDrag.width === W && nanDrag.height === H, nanDrag);

const noOptions = resizeFromDrag();
check('无参数不抛错且尺寸 > 0', noOptions.width > 0 && noOptions.height > 0, noOptions);

// 极窄容器：maxSize 直接是 NaN 时不能把图锁成 0
const nanMax = resizeFromDrag({ startWidth: W, startHeight: H, dx: 1000, dy: 0, corner: 'se', maxSize: NaN });
check('maxSize=NaN 视为无上限', nanMax.width > W, nanMax);

/* --------------------------------------------------- overlay 定位换算 */

const box = overlayGeometry({
  imgRect: { left: 50, top: 100, width: 200, height: 150 },
  wrapRect: { left: 10, top: 20 },
});
check('overlay 左 = 图片左 - 容器左 - 8', box.left === 32, box);
check('overlay 上 = 图片上 - 容器上 - 8', box.top === 72, box);
check('overlay 宽 = 图片宽 + 16', box.width === 216, box);
check('overlay 高 = 图片高 + 16', box.height === 166, box);

const scrolled = overlayGeometry({
  imgRect: { left: 50, top: 100, width: 200, height: 150 },
  wrapRect: { left: 10, top: 20 },
  scrollTop: 40,
  scrollLeft: 5,
});
// 滚动容器内的内容坐标：视口位置 - 容器位置 + 滚动偏移
check('滚动后左偏移 +scrollLeft', scrolled.left === 37, scrolled);
check('滚动后上偏移 +scrollTop', scrolled.top === 112, scrolled);

const noOutset = overlayGeometry({
  imgRect: { left: 50, top: 100, width: 200, height: 150 },
  wrapRect: { left: 10, top: 20 },
  outset: 0,
});
check('outset=0 时框贴合图片', noOutset.left === 40 && noOutset.top === 80 && noOutset.width === 200, noOutset);

const empty = overlayGeometry({});
check('空 rect 不产生 NaN', [empty.left, empty.top, empty.width, empty.height].every(Number.isFinite), empty);
check('空 rect 宽度仍含外扩', empty.width === IMAGE_SELECT_OUTSET * 2, empty);

const halfPixel = overlayGeometry({
  imgRect: { left: 10.4, top: 20.6, width: 100.5, height: 50.5 },
  wrapRect: { left: 0, top: 0 },
});
check(
  '亚像素结果取整成整数',
  [halfPixel.left, halfPixel.top, halfPixel.width, halfPixel.height].every(Number.isInteger),
  halfPixel,
);
// 取整只影响 overlay，不写回图片：132.5 不会变成 133 以外的东西
check('宽度四舍五入', halfPixel.width === 117, halfPixel);

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
