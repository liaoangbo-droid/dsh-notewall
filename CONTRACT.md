# dsh-notewall — 实现契约（Lead 定稿，改动前先对齐）

便签墙插件。左侧栏入口（`sidebar.panellist`，工作区列表上方）→ 打开一面便签墙。

## 目录与职责

```
dsh-notewall/
├─ lib/index.js      host：路由 + 4 个工具（已完成）
├─ lib/store.js      host：数据层，纯 Node，可单测（已完成）
├─ client/index.js   浏览器入口：apply()、slot 注册、全局 store、轮询、闹钟（Lead）
├─ client/api.js     fetch 封装（Lead）
├─ client/theme.js   样式常量 + <style> 注入（Lead）
├─ client/wall.js    墙：网格布局、滚轮、hover 放大、拖拽排序、置顶（Lead）
├─ client/card.js    单张便签卡：预览裁剪、置顶/闹钟角标（Lead）
├─ client/editor.js  便签编辑器：富文本 + 图片任意位置 + 颜色 + 撤销重做 + 实时保存（teammate）
├─ client/ink.js     手写画板：Pointer Events，支持触屏，导出 PNG dataURL（teammate）
├─ client/settings.js 墙设置面板：背景色/背景图、同屏列数、卡片尺寸（teammate）
└─ scripts/build-client.mjs  esbuild 打包 → lib/client.js（已完成）
```

## 数据模型（host 已实现，勿改字段名）

```js
Note = {
  id: 'n_<uuid>', createdAt: ms, updatedAt: ms,
  html: '<p>…</p>',        // 富文本；图片是 <img src="/sticky-wall/media/<id>.png">
  color: '#fff3a3',        // 便签底色
  textColor: '#1f2430',
  pinned: false,
  order: number,           // 越小越靠前
  alarmAt: ms|null,
  alarmFiredAt: ms|null,
  createdBy: 'user'|'agent',
  title: string,           // 首行纯文本摘要（host 生成）
}

Wall = {
  bg: { kind: 'color'|'image'|'none', color: '#f4f1ea', mediaId: string|null, dim: 0..1 },
  columns: 1..8, cardWidth: 160..520, cardHeight: 120..560,
  hoverScale: 1..3, gap: 0..80, fontSize: 10..28,
}
```

## HTTP API（前缀 `/sticky-wall`）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/state` | 全量 `{changed:true, rev, doc:{notes,wall,rev}, palette, defaults, serverTime}` |
| GET | `/state?since=<rev>` | 增量：`{changed:false, rev}` 或 `{changed:true, rev, doc}` |
| POST | `/note` | `{op:'create'|'update'|'delete'|'reorder', ...}` → `{ok, rev, note?}` |
| POST | `/wall` | `{patch: {...Wall字段}}` → `{ok, rev}` |
| POST | `/media` | `{dataUrl:'data:image/png;base64,...'}` → `{ok, url, id, bytes}` |
| POST | `/alarm/ack` | `{id}` → 标记 `alarmFiredAt=now`，`{ok, rev}` |
| GET | `/media/<id>` | 二进制图片 |

写操作仅接受本机回环请求。所有写操作串行、原子落盘，`rev` 单调递增。

## 浏览器端上下文（client/index.js 传给各组件）

```js
{
  doc,                  // 当前 { notes, wall, rev }
  rev,
  palette,              // 便签底色候选
  createNote(patch),    // 返回 Promise<note>
  updateNote(id, patch),
  deleteNote(id),
  reorder(ids),
  updateWall(patch),
  uploadImage(dataUrl), // 返回 Promise<{url, id}>
  kebab: {…},           // 预留
}
```

## 组件契约（teammate 只需实现这些导出）

```js
// client/ink.js
export function InkPad({ width, height, color, onDone, onCancel })
//  canvas 手写；Pointer Events 同时支持鼠标/触屏/手写笔；
//  松手即完成一次 stroke；「完成」→ onDone(pngDataUrl)；「取消」→ onCancel()

// client/editor.js
export function NoteEditor({ note, palette, onClose, onChange, uploadImage })
//  note 可为 null（新建）
//  onChange({html, color, textColor, alarmAt})  实时保存（防抖 400ms）
//  内部维护撤销/重做栈（Ctrl/Cmd+Z / Shift+Ctrl+Z）
//  图片：粘贴板 / 拖拽 / 选文件 → 转 dataURL → uploadImage → 插入 <img> 到光标处
//  手写：打开 InkPad，完成后插入 <img> 到光标处
//  颜色：便签底色 + 文字颜色

// client/settings.js
export function WallSettings({ wall, palette, onChange, onClose, uploadImage })
//  背景：颜色 / 图片（上传后设 bg.kind='image' + mediaId）/ 无
//  列数、卡片宽高、hover 放大倍数、字号、间隙
```

## 技术约束

- 纯浏览器 ESM + JSX（esbuild 已开 `.js` → `jsx` 与 `jsx: automatic`）；**不要** import 本地 css 文件。
- 只用 `react` 与 `@deepseek-ai/dsh-client-ui-slots`；不引入任何第三方依赖。
- 样式：优先内联 style 对象；全局样式由 `theme.js` 的 `injectStyles()` 注入一次。
- 颜色变量沿用 DSH 的 CSS 变量（`var(--dsh-text-secondary, #667085)` 等），保证深浅色主题都不崩。
- 组件必须能在 `width` 未知的 flex 容器里自适应；hover 放大用 `transform: scale()` + `z-index`，不要改变布局流。
- 触屏：手写板与拖拽都要能用 Pointer Events，禁止只用 mouse 事件。

## 构建与验证

```bash
cd /root/.dsh/Plugin-Designer/dsh-notewall
node scripts/build-client.mjs     # → lib/client.js
node --check lib/client.js
```

host 侧单测不需要 DSH：

```bash
STICKY_WALL_HOME=$(mktemp -d) node -e "import('./lib/store.js').then(...)"
```
