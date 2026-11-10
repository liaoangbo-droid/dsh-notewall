# NoteWall · 便签墙

> DSH 左侧栏里的「随手记」面板：点一下打开一面便签墙，想法、截图、手写草图都能贴在墙上，随时回来改。
> 还能把任意一张便签**直接发送**或**定时发送**到任意会话。

![便签墙界面](docs/screenshot.png)

> 包名、仓库名统一为 `dsh-notewall`。内部标识（路由 `/sticky-wall`、数据目录 `~/.dsh/sticky-wall/`、工具名 `sticky_note_*`、loader entry id `sticky-wall`）沿用历史命名——改它们会破坏已存的便签数据与已写入的会话历史，因此有意保留。

## 功能

**贴东西**
- **左侧栏入口**：和工作区列表上方那一排（插件 / 自动化任务 / 上下文洞察）并列，图标打开整面墙。
- **富文本编辑**：粗体/斜体/列表/标题，实时保存（防抖 400ms），关掉再打开内容还在。
- **撤销 / 重做**：`Ctrl/Cmd+Z`、`Ctrl/Cmd+Shift+Z`，工具栏也有按钮；自己维护历史栈，切走再回来不丢。
- **图片任意位置**：工具栏选图、直接粘贴、拖文件进来，都会插入到**光标处**而不是末尾。
- **手写**：画板支持鼠标 / 触屏 / 手写笔，画完以透明背景 PNG 贴进便签。
- **自动配色**：新便签的底色按**黄金角 137.5°** 递进色相、固定饱和度与亮度生成，相邻两张色相拉得开且整墙明度一致；生成时跳过已被占用的颜色，所以墙上不会出现两张同色。

**看**
- **便签墙**：网格排布，滚轮上下滚动；卡片按创建时间从近到远，置顶的排最前。
- **折叠预览**：便签卡只显示开头一段，底部渐隐；点开才看到全部内容。
- **指针停留放大**：鼠标停在卡片上，卡片按设定倍率放大、字号跟着变大、预览区同时变高，露出更多内容。

**中英文界面**
- 界面文案全部走 `t()`，内置中英两套完整字典；跟随浏览器语言，也能在「墙设置 → 语言」手动锁定（跟随系统 / 中文 / English）。

**整理**
- **拖动排序**：拖起来后两张卡之间出现一条蓝色插入线，其余卡片实时平滑让位；松手即生效。
- **置顶**：📌 一键置顶，置顶的永远排最前。
- **墙设置**：背景纯色 / 背景图片（带遮罩强度）/ 透明；同屏列数、卡片宽高、间距、字号、hover 放大倍率；**新建便签颜色**可选「随机配色」或「固定一种颜色」。

**发出去**
- **发送到会话**：便签卡片右下角的「发送到会话」，选一个会话后可以「立即发送」或「定时发送」。立即发送约 2 秒后内容作为一条消息到达该会话。
- **拖动直达**：直接把便签拖到左侧栏的会话上也能触发发送流程。
- **发送状态可见**：卡片上会显示预约时间，发送完成后变灰并显示实际发送时间。

**提醒**
- **闹钟提醒**：便签可设提醒时间，到点右下角弹框（关闭 / 查看便签），跨面板常驻，不在便签墙页面也会提醒。
- **让小助手记**：会话里模型可以先问你「要不要记到便签墙上」，同意后用 `sticky_note_create` 建一张，墙上 2~3 秒内自动出现。

## 多语言

界面文案全部收在 `client/strings.js`，内置中文与英文两套**完整**字典（各 240 条），通过 `t(key, params)` 取用。

- **自动跟随浏览器语言**：`navigator.languages` 里以 `zh` 开头走中文，其余走英文。
- **缺 key 有兜底**：依次回落「当前语言 → 中文 → key 名本身」。最后一级意味着漏翻会直接在界面上显示成 `deliver.title` 这种样子，一眼就能发现，不会静默变空白。
- **加文案**：只往 `DICT.zh` 加就行，`DICT.en` 没跟上会自动显示中文，不会出错；补翻时按 key 逐一加。
- **占位符**用 `{name}` 具名替换，不用 `%s`，参数顺序不会错位。
- **host 侧的错误消息**带一个 `code` 字段（如 `{ ok:false, error:'缺少便签 id', code:'missingNoteId' }`），前端优先按 `error.<code>` 翻译；没有对应 key 时显示原始中文。这样加语言不用改 host，也不影响老前端。
- 模型的工具描述与参数说明**故意不翻译**——那是给模型读的，中英文都能读，跟着界面语言变反而会让缓存的工具签名漂移。

## 数据在哪

```
$DSH_HOME/sticky-wall/data.json              便签与墙配置（原子写入，rev 单调递增）
$DSH_HOME/sticky-wall/media/<sha256>.<ext>   图片与手写图（内容寻址，重复粘贴不涨体积）
```

`$DSH_HOME` 默认 `~/.dsh`（本机是持久卷，容器重建不丢）。可用环境变量 `STICKY_WALL_HOME` 覆盖整个数据目录。

**数据全部留在本地**，插件不向任何外部服务发送内容。

## 安装

```bash
# 1. 取代码，放到任意目录
git clone https://github.com/liaoangbo-droid/dsh-notewall.git
cd dsh-notewall

# 2. 构建浏览器半边，生成 lib/client.js
node scripts/build-client.mjs

# 3. 挂进 web profile（link 方式，改代码后重建即可，不必重装）
dsh plugin --profile web add "$PWD"
# 等价于在 <dsh-home>/profiles/web/package.json 里加
#   "dsh-notewall": "link:/path/to/dsh-notewall"
# 并把 dsh-notewall 追加到 dsh.profile.bundles

# 4. 重启 DSH 内核（host 插件无热加载）
```

插件自带的 `cordis.patch.yml` 负责注册 loader entry `sticky-wall`；**不要**在 profile 的 patch 里再 insert 同一个 id（会 duplicate loader entry id，整个插件树起不来）。

只改客户端代码（`client/`）时，`node scripts/build-client.mjs` 后刷新页面即可；改 `lib/` 必须重启内核。

## 模型工具

| 工具 | 用途 |
|---|---|
| `sticky_note_create` | 新建便签（**必须先征得用户同意**） |
| `sticky_note_list` | 列出便签（只读） |
| `sticky_note_update` | 改正文 / 颜色 / 置顶 / 提醒时间 |
| `sticky_note_delete` | 删除便签（**必须先征得用户同意**） |

创建便签是用户可见的副作用，工具描述里写明了「先问用户」；实现上也没有绕过这一点的静默路径。

## 开发者注意（踩过的坑，写下来省下一个人的时间）

**① `export default` 必须带 `inject`。**
DSH 的 client 启动器注册的是 `module.exports.default`（esbuild 产物里是 `index_default`）。只写顶层 `export const inject` 是**无效的**——启动器不看那里。缺 `inject` 时 `apply` 会在 `slots` 就绪前执行，`ctx.slots` 取不到 → 抛错 → fiber FAILED → boot 判定「entry did not activate」→ **整个 GUI 只剩 `Failed to load plugins`**。

```js
export const inject = ['slots'];
export function apply(ctx) { … }
export default { inject, apply };   // ← 这一层的 inject 才是生效的
```

**② 重新构建，不要手改产物。**
`lib/client.js` 里的 `index_default` 和 factory 级 try-catch 都由 `scripts/build-client.mjs` 生成。手改产物在下次构建时会被覆盖，回到故障状态。构建后再跑一遍验证。

**③ 客户端异常不进 `kernel.log`。**
只在浏览器控制台。所以 `apply` 和 factory 都包了 try-catch，异常会通过 `GET /sticky-wall/__diag` 写进 `~/.dsh/sticky-wall/client-diag.log`。排查「GUI 起不来但宿主日志干净」时先看这个文件。

**④ 拖放别只信 `drop` 事件。**
在串流式 WebView（远程桌面 / NAS 的网页客户端）里，HTML5 的 `drop` 可能压根不投递，而 `dragend` 按规范一定在拖拽源上触发。本插件的做法是：`dragenter` 算插入位并存进 `ref`，`drop` 与 `dragend` **两处都尝试提交**，谁先到用谁。排序本身走乐观更新（本地先重排渲染，再发请求，失败回滚），避免在慢存储/远程环境里松手后要等一个来回。

**⑤ 排序规则必须前后端一致。**
host 的 `sortedNotes` 是「置顶优先 → 手动 order 升序 → 创建时间降序」。客户端做乐观更新时必须一比一复刻，否则请求回来会「跳一下」，比不做乐观更新更糟。

## 测试

```bash
node scripts/build-client.mjs   # 构建 → lib/client.js
node --check lib/client.js

node test/host-e2e.mjs          # host：真起 http server 打全部路由（31 项）
node test/client-load.mjs       # 产物：mock ModuleLoader/DOM/react，验证 apply + 三处 slot + default.inject
node test/hover-origin.mjs      # 纯函数：hover 放大锚点选择（12 项）
node test/image-resize.mjs      # 纯函数：图片缩放与角柄命中
```

或一次跑完：`npm test`

## 安全设计

便签正文是受限 HTML，**任何写入路径都会先经过白名单净化**（`lib/store.js` 的 `sanitizeHtml`）：只保留已知安全的标签（`p/br/strong/em/u/s/h*/ul/ol/li/img/a/code/pre/blockquote` 等）与属性，`href` 只允许 `http(s)/mailto/tel/相对路径`，`src` 只允许 `/sticky-wall/media/` 与 `data:image/(png|jpeg|webp|gif)`。

判断协议**之前先解 HTML 实体**，所以 `&#106;avascript:` 这类编码绕过无效；`svg`/`math`/`template` 会连同内容一起删除（它们可以承载 `xlink:href`）。

其他措施：

- 媒体上传白名单**不含 SVG**（SVG 可以内嵌脚本），媒体响应带 `X-Content-Type-Options: nosniff` 与 `Content-Security-Policy: default-src 'none'; sandbox`。
- 写操作默认只允许 loopback 来源；若部署在反向代理后面，这层保护需要代理侧补齐鉴权（见「已知限制」）。
- 便签与图片**明文存放**在本地数据目录，不做加密——这是「本地便签」的定位取舍。数据目录的访问权限由操作系统负责。

---

## 已知限制

- 闹钟依赖浏览器打开：页面完全关掉时不会响，重新打开后会补弹。
- 提醒弹框走 `shell.overlay` 浮层，样式跟随 DSH 主题变量；极端自定义主题下可能对比度不足。
- 手写画板用 Canvas 2D，超大画布（>4000px）在低配机器上可能掉帧。
- 便签内容是受限 HTML（host 侧已剥离 `script`/`style`/`iframe`/`on*`），但**不支持**表格、代码块等高级块级元素。
- hover 放大只在**鼠标悬停**触发；触屏设备没有 hover，点击直接进编辑。
- 「发送到会话」的立即发送走内核定时器，at = now + 1500ms，因此有约 2 秒延迟；这是刻意留的余量，再短会出现「创建瞬间已过期」。
- **只读接口无鉴权**：`GET /state`、`/media/*`、`/boot-trace` 不带会话也能读。服务默认只监听 127.0.0.1，所以局域网进不来；但如果通过反向代理暴露，需要代理侧自己加鉴权，且「只能本机写」那层 `isLoopback` 判断在代理后会失效。
- **SVG 只能看不能传**：上传白名单已移除 SVG；从旧数据里遗留的 SVG 文件仍可读取，但不会作为文档渲染（nosniff + CSP sandbox）。
- 宿主侧没有「写入会话输入框草稿」的能力（草稿是浏览器端状态），所以本插件做的是**发送**，不是「填进输入框」。

## License

MIT

## 更新日志

### 0.2.0
- **中英文双语界面**：245 个文案键、两套完整字典；缺 key 依次回落「当前语言 → 中文 → key 名」，漏翻会在界面上直接显形而不是变空白。
- **手动语言开关**：「墙设置 → 语言」三选一（跟随系统 / 中文 / English），偏好存 localStorage，刷新后保持。
- **错误消息可翻译**：host 的 HTTP 错误响应补 `code` 字段，前端按 `error.<code>` 取译文；原文案保留，老前端不受影响。
- **定时发送快捷时间**：新增「今天 12:00」「今天 18:00」两个按钮，对应 DeepSeek 空闲时段的起点；目标时间早于当前会拦下来并提示。
- 四套测试（client-load / host-e2e / image-resize / hover-origin）全部通过。
