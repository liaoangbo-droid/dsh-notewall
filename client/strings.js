/**
 * 插件里所有面向用户的文案。
 *
 * 设计约束：
 * - zh 是唯一完整字典，en 可以只填一部分；缺 key 时回落到 zh，再缺就返回 key 本身
 *   （这样漏翻的地方在界面上会显示成一串点号 key，一眼能看出来，不会静默变成空白）。
 * - 占位符用 {name}，由 t() 做字符串替换，不做格式化，避免 %s 位置错乱。
 * - 只在需要语言切换时才调 setLocale；默认按浏览器语言判断。
 */

const DICT = {
  zh: {
    // ── 通用 ──────────────────────────────────────────────
    'common.cancel': '取消',
    'common.close': '关闭',
    'common.confirm': '确定',
    'common.delete': '删除',
    'common.save': '保存',
    'common.retry': '重试',
    'common.empty': '（空）',
    'common.loading': '加载中…',

    // ── 便签卡片 ──────────────────────────────────────────
    'card.pin': '置顶',
    'card.unpin': '取消置顶',
    'card.delete': '删除便签',
    'card.cancelDelivery': '取消定时',
    'card.cancelDeliveryTitle': '取消这次定时发送',
    'card.cancelDeliveryAria': '取消定时发送',
    'card.deliveryIcon': '⏰',
    'card.sendToSession': '发送到会话',
    'card.scheduledAt': '已定时 {time}',
    'card.sentAt': '已于 {time} 发送',
    'card.monthDay': '{month}月{day}日',
    'card.today': '今天 {time}',
    'card.sessionFallback': '会话',
    'card.deliveryDone': '已于 {stamp} 定时发送到 {target}',
    'card.deliveryPlanned': '预约 {stamp} 定时发送到 {target}',
    'card.emptyNote': '（空便签）',
    'card.draft': '草稿',
    'card.noContent': '（还没有内容）',
    'card.byAgent': '· 小助手记的',
    'card.deliveryTipSet': '{text}（点击可重新设置）',
    'card.deliveryTipEmpty': '把这张便签发送到某个会话',

    // ── 便签墙 ────────────────────────────────────────────
    'wall.title': '便签墙',
    'wall.count': '{count} 张',
    'wall.newNote': '＋ 新便签',
    'wall.settings': '墙设置',
    'wall.dropTitle': '松手发送到',
    'wall.dropEmpty': '没有可用会话',
    'wall.unnamedSession': '（未命名会话）',
    'wall.emptyTitle': '这面墙还是空的',
    'wall.emptyHint': '点右上角「＋ 新便签」写下第一个想法；也可以在会话里让小助手记一条。',
    'wall.emptyAutoSave': '便签会自动保存，关掉再打开也还在。',
    'wall.deleteTitle': '删除便签',
    'wall.deleteConfirm': '删除「{title}」？此操作不可撤销。',
    'wall.deleteThisOne': '这张便签',

    // ── 发送到会话 ────────────────────────────────────────
    'deliver.title': '发送到会话',
    'deliver.ariaSend': '发送便签到会话',
    'deliver.ariaClose': '关闭',
    'deliver.sessionDelay': 'DSH 内核的会话列表大约每分钟才刷新一次，刚新建的会话可能还没出现在下面。稍等一会儿关掉重开本弹窗即可。',
    'deliver.noWorkspace': '（未分工作区）',
    'deliver.back': '← 返回工作区',
    'deliver.pickWorkspace': '选择工作区（{workspaces} 个工作区 / {sessions} 个会话）',
    'deliver.noSessions': '没读到会话列表。可能是当前页面还没加载会话，或摘要里没有可用字段。',
    'deliver.current': '已选：{workspace} / {title}',
    'deliver.mode': '发送方式',
    'deliver.modeInsert': '直接发送',
    'deliver.modeInsertHint': '立刻发到该会话（约 2 秒）',
    'deliver.modeSchedule': '定时发送',
    'deliver.modeScheduleHint': '到点自动发到该会话',
    'deliver.timeLabel': '发送时间',
    'deliver.timeWillSend': '将在 {time} 自动发送；卡片会显示 ⏰，可随时取消。',
    'deliver.timeInvalid': '请选择一个有效时间。',
    'deliver.timeNoValue': '上面的时间框没取到值——直接用快捷按钮。',
    'deliver.insertHint': '点发送后约 2 秒，内容会作为一条消息发到该会话。',
    'deliver.busy': '正在发送，请稍候…',
    'deliver.needSession': '请先选择一个目标会话',
    'deliver.timeMalformed': '发送时间无效——点下面的快捷按钮，或重新选一个时间',
    'deliver.timePast': '定时发送时间不能早于当前时间——请重新选择',
    'deliver.quick5': '+5 分钟',
    'deliver.quick30': '+30 分钟',
    'deliver.quick60': '+1 小时',
    'deliver.quickNoon': '今天 12:00',
    'deliver.quickEvening': '今天 18:00',
    'deliver.quickTomorrow': '明天 9:00',
    'deliver.quickPast': ' · 已过',
    'deliver.quickPastTitle': '这个时间今天已经过去了',
    'deliver.ruleNote':
      '空闲时段 = 工作日 9:00-12:00、14:00-18:00 之外的全部时间（含午间、夜间、周末；法定节假日另算）。',
    'deliver.offPeak': '空闲时段 · 单价约为高峰的一半',
    'deliver.onPeak': '高峰时段 · 单价较高（工作日 9:00-12:00、14:00-18:00）',
    'deliver.submitBusy': '处理中…',
    'deliver.submitInsert': '立即发送',
    'deliver.submitSchedule': '定时发送',

    // ── 编辑器 ────────────────────────────────────────────
    'editor.placeholderEmpty': '写点什么…',
    'editor.placeholderTitle': '标题',
    'editor.bold': '加粗',
    'editor.italic': '斜体',
    'editor.underline': '下划线',
    'editor.strike': '删除线',
    'editor.bulletList': '无序列表',
    'editor.orderedList': '有序列表',
    'editor.quote': '引用',
    'editor.code': '行内代码',
    'editor.link': '链接',
    'editor.image': '插入图片',
    'editor.undo': '撤销',
    'editor.redo': '重做',
    'editor.ink': '手写',
    'editor.color': '颜色',
    'editor.pinned': '已置顶',
    'editor.wordCount': '{count} 字',

    // ── 设置面板 ──────────────────────────────────────────
    'settings.title': '墙设置',
    'settings.appearance': '外观',
    'settings.fontSize': '墙整体字号',
    'settings.cardColor': '卡片配色',
    'settings.colorAuto': '每次新建随机（不重复）',
    'settings.colorFixed': '固定颜色',
    'settings.colorPick': '选择颜色',
    'settings.newNoteColor': '新建便签颜色',
    'settings.wallColor': '墙面颜色',
    'settings.reset': '恢复默认',
    'settings.saved': '已保存',

    // ── 错误与提示 ────────────────────────────────────────
    'error.loadFailed': '加载失败',
    'error.saveFailed': '保存失败',
    'error.network': '网络异常，请重试',
    'error.noSession': '请先选择目标会话',
    'error.emptyNote': '这张便签是空的',
    'error.missingNoteId': '缺少便签 id',
    'error.missingTarget': '需要 noteId 与 sessionId',
    'error.pastTime': 'at 必须是未来的时间戳',
    'error.missingPrompt': '缺少投递内容 prompt',
    'error.schedulerUnavailable': '当前 profile 没有加载 dsh-schedule，无法定时投递（立即发送仍然可用）',

    'error.requestFailed': '请求失败（HTTP {status}）',
    'error.connectFailed': '连接便签服务失败：{message}',
    'error.readSessions': '读取会话列表失败（HTTP {status}）',
    'error.readFile': '读取文件失败',
    'error.readImage': '读取图片失败',
    'error.uploadImage': '上传失败',
    'error.uploadUnsupported': '当前环境不支持上传图片',
    'error.chooseImageFile': '请选择图片文件',
    'error.noImageId': '上传未返回图片 id',
    'error.noSessionsService': 'ctx 上拿不到 sessions 服务',
    'error.sendFailed': '发送失败',
    'error.bootTraceLocalOnly': 'boot-trace 只能从本机上报',
    'error.invalidMediaId': '非法的媒体 id',
    'error.localOnly': '便签只能从本机浏览器修改',
    'error.mediaNotFound': '媒体不存在',
    'error.missingSessionText': '缺少 sessionId 或 text',

    // ── 便签投递的提示词模板（发给会话的那段文字）──────────
    'prompt.header': '【便签】{title}',
    'prompt.origin': '（这是主人于 {date} 创建的一张便签，原本用于随手记录临时想法；现在通过便签墙定时到了 {time} 自动发给你。）',
    'prompt.originDragged': '（这是主人于 {date} 创建的一张便签，用于随手记录随时随地的临时想法，现在从便签墙拖进了这个会话。）',
    'prompt.fallbackTitle': '未命名便签',
    'prompt.noTitle': '（无标题）',

    // ── 时间与杂项 ────────────────────────────────────────
    'time.unknown': '未知时间',
    'time.dateFormat': '{year}年{month}月{day}日 {time}',
    'note.toastTitle': '便签提醒 · {title}',
    'note.viewNote': '查看便签',
    'workspace.ungrouped': '（未归入工作区）',

    // ── 便签编辑器 ────────────────────────────────────────
    'editor.placeholder': '写点什么…',

    // ── 便签编辑器 ────────────────────────────────────────
    'editor.uploadUnavailable': '图片上传不可用',
    'editor.uploading': '图片上传中…',
    'editor.uploadNoUrl': '上传接口未返回 url',
    'editor.uploadFailedWith': '图片上传失败：{message}',
    'editor.readClipboardFailed': '读取剪贴板图片失败',
    'editor.readDropFailed': '读取拖入图片失败',
    'editor.inkNotExported': 'InkPad 未导出',
    'editor.inkLoadFailed': '手写组件加载失败',
    'editor.inkEmpty': '画板是空的',
    'editor.formatUnsupported': '当前浏览器不支持该格式操作',
    'editor.nothingToUndo': '没有可撤销的操作',
    'editor.nothingToRedo': '没有可重做的操作',
    'editor.title': '编辑便签',
    'editor.autoSave': '内容自动保存',
    'editor.saveHint': '内容会自动保存；点这里保存并关闭',
    'editor.saveAndClose': '保存并关闭',
    'editor.expand': '全屏编辑',
    'editor.collapse': '退出全屏',
    'draft.button': '便签草稿',
    'draft.title': '便签草稿',
    'draft.new': '新建便签',
    'draft.close': '关闭草稿',
    'draft.empty': '点右上「新建便签」开一张，随手记完会自动保存到便签墙。',
    'draft.createFailed': '新建便签失败，请重试',
    'draft.loading': '正在读取便签…',
    'draft.pick': '挑一张接着写，或者新建一张：',
    'draft.untitled': '（空白便签）',
    'draft.edit': '编辑',
    'draft.drag': '按住以拖动',
    'editor.heading': '标题',
    'editor.clearFormat': '清除格式',
    'editor.imageTip': '插入图片到光标处',
    'editor.inkPad': '手写画板',
    'editor.inkBusy': '手写…',
    'editor.undoTip': '撤销 (Ctrl/Cmd+Z)',
    'editor.redoTip': '重做 (Ctrl/Cmd+Shift+Z 或 Ctrl+Y)',
    'editor.contentAria': '便签内容',
    'editor.bgColor': '底色',
    'editor.textColor': '文字',
    'editor.reminder': '提醒',
    'editor.clearReminder': '清除提醒',
    'editor.custom': '自定义',
    'editor.customBg': '自定义底色',
    'editor.customText': '自定义文字颜色',
    'editor.bgColorAria': '便签底色 {color}',
    'editor.textColorAria': '文字颜色 {color}',
    'editor.alarmTimeAria': '提醒时间',
    'editor.zoomImage': '缩放图片 {corner}',
    'editor.deleteImage': '删除这张图片',

    // ── 墙设置面板 ────────────────────────────────────────
    'settings.live': '实时生效',
    'settings.closeAria': '关闭墙设置',
    'settings.modeFixed': '固定',
    'settings.modeRandom': '随机',
    'settings.modeAuto': '随机配色',
    'settings.modeFixedColor': '固定一种颜色',
    'settings.goldenHint': '按黄金角自动分配色相，墙上的便签不会撞色。',
    'settings.background': '背景',
    'settings.bgTransparent': '透明',
    'settings.bgTypeAria': '背景类型',
    'settings.bgSolid': '纯色',
    'settings.bgImage': '图片',
    'settings.bgNone': '无',
    'settings.bgColorAria': '背景颜色',
    'settings.bgColorOptionAria': '背景色 {color}',
    'settings.uploading': '上传中…',
    'settings.replaceImage': '更换图片',
    'settings.chooseImage': '选择图片',
    'settings.deleteBg': '删除背景图',
    'settings.noImage': '还没有选择背景图。',
    'settings.bgPreviewAlt': '背景图预览',
    'settings.dim': '遮罩强度',
    'settings.previewTransparent': '透明（露出应用主题）',
    'settings.previewSolid': '纯色背景',
    'settings.previewImage': '图片背景 · 遮罩 {percent}%',
    'settings.layout': '布局',
    'settings.columns': '同屏列数',
    'settings.columnsUnit': '{n} 列',
    'settings.cardWidth': '卡片宽度',
    'settings.cardHeight': '卡片高度',
    'settings.cardGap': '卡片间隙',
    'settings.preview': '预览',
    'settings.hoverScale': 'hover 放大倍数',
    'settings.language': '语言',
    'settings.langSystem': '跟随系统',
    'settings.langZh': '中文',
    'settings.langEn': 'English',
    'settings.langHint': '切换后页面会刷新一次',
    'settings.done': '完成',

    // ── 手写画板 ──────────────────────────────────────────
    'ink.thin': '细',
    'ink.mid': '中',
    'ink.bold': '粗',
    'ink.black': '黑',
    'ink.red': '红',
    'ink.blue': '蓝',
    'ink.green': '绿',
    'ink.note': '原色',
    'ink.title': '手写',
    'ink.hint': '用鼠标 / 手指 / 手写笔都可以',
    'ink.strokeCount': '{n} 笔',
    'ink.empty': '空白',
    'ink.sizeTitle': '笔画：{size}',
    'ink.eraserTitle': '橡皮：擦掉笔迹',
    'ink.eraser': '橡皮',
    'ink.colorTitle': '颜色：{color}',
    'ink.undoTitle': '撤销上一笔（Ctrl/Cmd + Z）',
    'ink.undo': '撤销',
    'ink.clearTitle': '清空整块画板',
    'ink.clear': '清空',
    'ink.placeholder': '在这里写写画画（背景透明，导出 PNG 不带白底）',
    'ink.escHint': 'Esc 取消 · Ctrl/Cmd + Z 撤销',
    'ink.cancelTitle': '放弃这次手写',
    'ink.cancel': '取消',
    'ink.doneTitle': '把笔迹转成 PNG 插入便签',
    'ink.done': '完成',
  },
  en: {
    'common.cancel': "Cancel",
    'common.close': "Close",
    'common.confirm': "Confirm",
    'common.delete': "Delete",
    'common.save': "Save",
    'common.retry': "Retry",
    'common.empty': "(empty)",
    'common.loading': "Loading…",
    'card.pin': "Pin",
    'card.unpin': "Unpin",
    'card.delete': "Delete note",
    'card.cancelDelivery': "Cancel timer",
    'card.cancelDeliveryTitle': "Cancel this scheduled send",
    'card.cancelDeliveryAria': "Cancel scheduled send",
    'card.deliveryIcon': "⏰",
    'card.sendToSession': "Send to session",
    'card.scheduledAt': "Scheduled for {time}",
    'card.sentAt': "Sent at {time}",
    'card.monthDay': "{month}/{day}",
    'card.today': "Today {time}",
    'card.sessionFallback': "session",
    'card.deliveryDone': "Sent to {target} on {stamp}",
    'card.deliveryPlanned': "Scheduled for {target} at {stamp}",
    'card.emptyNote': "(empty note)",
    'card.draft': "Draft",
    'card.noContent': "(no content yet)",
    'card.byAgent': "· saved by assistant",
    'card.deliveryTipSet': "{text} (click to change)",
    'card.deliveryTipEmpty': "Send this note to a session",
    'wall.title': "Sticky Wall",
    'wall.count': "{count}",
    'wall.newNote': "＋ New note",
    'wall.settings': "Wall settings",
    'wall.dropTitle': "Drop to send",
    'wall.dropEmpty': "No sessions available",
    'wall.unnamedSession': "(untitled session)",
    'wall.emptyTitle': "This wall is still empty",
    'wall.emptyHint': "Click “＋ New note” in the top right to write your first idea; you can also ask the assistant to save one from a session.",
    'wall.emptyAutoSave': "Notes save automatically — close and reopen and they’re still here.",
    'wall.deleteTitle': "Delete note",
    'wall.deleteConfirm': "Delete “{title}”? This cannot be undone.",
    'wall.deleteThisOne': "this note",
    'deliver.title': "Send to session",
    'deliver.ariaSend': "Send note to session",
    'deliver.ariaClose': "Close",
    'deliver.sessionDelay': "The DSH kernel refreshes its session list about once a minute, so a session you just created may not show up below yet. Wait a moment, then reopen this dialog.",
    'deliver.noWorkspace': "(no workspace)",
    'deliver.back': "← Back to workspaces",
    'deliver.pickWorkspace': "Choose a workspace ({workspaces} workspaces / {sessions} sessions)",
    'deliver.noSessions': "Couldn’t read the session list. The page may not have loaded sessions yet, or the summary has no usable fields.",
    'deliver.current': "Selected: {workspace} / {title}",
    'deliver.mode': "Send mode",
    'deliver.modeInsert': "Send now",
    'deliver.modeInsertHint': "Delivers to that session right away (~2s)",
    'deliver.modeSchedule': "Schedule",
    'deliver.modeScheduleHint': "Delivers to that session at the chosen time",
    'deliver.timeLabel': "Send time",
    'deliver.timeWillSend': "Sends at {time}; the card shows ⏰ and you can cancel anytime.",
    'deliver.timeInvalid': "Please pick a valid time.",
    'deliver.timeNoValue': "The time field returned no value — use the quick buttons below.",
    'deliver.insertHint': "About 2 seconds after you send, the content arrives in that session as a message.",
    'deliver.busy': "Sending, please wait…",
    'deliver.needSession': "Please choose a target session first",
    'deliver.timeMalformed': "Invalid send time — use a quick button below or pick another time",
    'deliver.timePast': "Scheduled time cannot be earlier than now — please choose again",
    'deliver.quick5': "+5 min",
    'deliver.quick30': "+30 min",
    'deliver.quick60': "+1 hour",
    'deliver.quickNoon': "Today 12:00",
    'deliver.quickEvening': "Today 18:00",
    'deliver.quickTomorrow': "Tomorrow 9:00",
    'deliver.quickPast': " · passed",
    'deliver.quickPastTitle': "That time has already passed today",
    'deliver.ruleNote': "Off-peak = everything outside 9:00-12:00 and 14:00-18:00 on weekdays (includes midday, nights and weekends; public holidays excluded).",
    'deliver.offPeak': "Off-peak · about half the peak price",
    'deliver.onPeak': "Peak · higher price (weekdays 9:00-12:00, 14:00-18:00)",
    'deliver.submitBusy': "Working…",
    'deliver.submitInsert': "Send now",
    'deliver.submitSchedule': "Schedule",
    'editor.placeholderEmpty': "Write something…",
    'editor.placeholderTitle': "Title",
    'editor.bold': "Bold",
    'editor.italic': "Italic",
    'editor.underline': "Underline",
    'editor.strike': "Strikethrough",
    'editor.bulletList': "Bulleted list",
    'editor.orderedList': "Numbered list",
    'editor.quote': "Quote",
    'editor.code': "Inline code",
    'editor.link': "Link",
    'editor.image': "Insert image",
    'editor.undo': "Undo",
    'editor.redo': "Redo",
    'editor.ink': "Handwrite",
    'editor.color': "Color",
    'editor.pinned': "Pinned",
    'editor.wordCount': "{count} words",
    'settings.title': "Wall settings",
    'settings.appearance': "Appearance",
    'settings.fontSize': "Wall font size",
    'settings.cardColor': "Card colors",
    'settings.colorAuto': "Random for each new note (no repeats)",
    'settings.colorFixed': "Fixed color",
    'settings.colorPick': "Pick a color",
    'settings.newNoteColor': "New note color",
    'settings.wallColor': "Wall color",
    'settings.reset': "Reset to defaults",
    'settings.saved': "Saved",
    'error.loadFailed': "Failed to load",
    'error.saveFailed': "Failed to save",
    'error.network': "Network error, please retry",
    'error.noSession': "Please choose a target session first",
    'error.emptyNote': "This note is empty",
    'error.missingNoteId': "Missing note id",
    'error.missingTarget': "noteId and sessionId are required",
    'error.pastTime': "at must be a future timestamp",
    'error.missingPrompt': "Missing delivery prompt",
    'error.schedulerUnavailable': "This profile does not load dsh-schedule, so scheduled delivery is unavailable (send-now still works)",
    'error.requestFailed': "Request failed (HTTP {status})",
    'error.connectFailed': "Failed to connect to the note service: {message}",
    'error.readSessions': "Failed to read the session list (HTTP {status})",
    'error.readFile': "Failed to read file",
    'error.readImage': "Failed to read image",
    'error.uploadImage': "Upload failed",
    'error.uploadUnsupported': "Image upload is not supported in this environment",
    'error.chooseImageFile': "Please choose an image file",
    'error.noImageId': "Upload returned no image id",
    'error.noSessionsService': "sessions service unavailable on ctx",
    'error.sendFailed': "Send failed",
    'error.bootTraceLocalOnly': "boot-trace can only be reported from this machine",
    'error.invalidMediaId': "Invalid media id",
    'error.localOnly': "Notes can only be modified from a browser on this machine",
    'error.mediaNotFound': "Media not found",
    'error.missingSessionText': "Missing sessionId or text",
    'prompt.header': "[Note] {title}",
    'prompt.origin': "(This is a note the user created on {date}, originally for quick temporary thoughts; it was scheduled from the sticky wall and is now delivered to you at {time}.)",
    'prompt.originDragged': "(This is a note the user created on {date} for quick temporary thoughts, dragged from the sticky wall into this session.)",
    'prompt.fallbackTitle': "Untitled note",
    'prompt.noTitle': "(untitled)",
    'time.unknown': "Unknown time",
    'time.dateFormat': "{year}-{month}-{day} {time}",
    'note.toastTitle': "Note reminder · {title}",
    'note.viewNote': "View note",
    'workspace.ungrouped': "(no workspace)",
    'editor.placeholder': "Write something…",
    'editor.uploadUnavailable': "Image upload unavailable",
    'editor.uploading': "Uploading image…",
    'editor.uploadNoUrl': "Upload API returned no url",
    'editor.uploadFailedWith': "Image upload failed: {message}",
    'editor.readClipboardFailed': "Failed to read clipboard image",
    'editor.readDropFailed': "Failed to read dropped image",
    'editor.inkNotExported': "InkPad not exported",
    'editor.inkLoadFailed': "Failed to load the handwriting pad",
    'editor.inkEmpty': "The pad is empty",
    'editor.formatUnsupported': "This browser does not support that format operation",
    'editor.nothingToUndo': "Nothing to undo",
    'editor.nothingToRedo': "Nothing to redo",
    'editor.title': "Edit note",
    'editor.autoSave': "Auto-saved",
    'editor.saveHint': "Content saves automatically; click here to save and close",
    'editor.saveAndClose': "Save & close",
    'editor.expand': "Expand editor",
    'editor.collapse': "Exit full screen",
    'draft.button': "Sticky draft",
    'draft.title': "Sticky draft",
    'draft.new': "New note",
    'draft.close': "Close draft",
    'draft.empty': "Click “New note” above to start one — whatever you type is saved to the wall automatically.",
    'draft.createFailed': "Could not create the note, please retry",
    'draft.loading': "Loading notes…",
    'draft.pick': "Pick one to keep writing, or create a new one:",
    'draft.untitled': "(blank note)",
    'draft.edit': "Edit",
    'draft.drag': 'Press and drag',
    'editor.heading': "Heading",
    'editor.clearFormat': "Clear formatting",
    'editor.imageTip': "Insert image at cursor",
    'editor.inkPad': "Handwriting pad",
    'editor.inkBusy': "Handwriting…",
    'editor.undoTip': "Undo (Ctrl/Cmd+Z)",
    'editor.redoTip': "Redo (Ctrl/Cmd+Shift+Z or Ctrl+Y)",
    'editor.contentAria': "Note content",
    'editor.bgColor': "Background",
    'editor.textColor': "Text",
    'editor.reminder': "Reminder",
    'editor.clearReminder': "Clear reminder",
    'editor.custom': "Custom",
    'editor.customBg': "Custom background",
    'editor.customText': "Custom text color",
    'editor.bgColorAria': "Note background {color}",
    'editor.textColorAria': "Text color {color}",
    'editor.alarmTimeAria': "Reminder time",
    'editor.zoomImage': "Resize image {corner}",
    'editor.deleteImage': "Delete this image",
    'settings.live': "Applies live",
    'settings.closeAria': "Close wall settings",
    'settings.modeFixed': "Fixed",
    'settings.modeRandom': "Random",
    'settings.modeAuto': "Random colors",
    'settings.modeFixedColor': "One fixed color",
    'settings.goldenHint': "Hues are spread by the golden angle, so notes never clash.",
    'settings.background': "Background",
    'settings.bgTransparent': "Transparent",
    'settings.bgTypeAria': "Background type",
    'settings.bgSolid': "Solid color",
    'settings.bgImage': "Image",
    'settings.bgNone': "None",
    'settings.bgColorAria': "Background color",
    'settings.bgColorOptionAria': "Background color {color}",
    'settings.uploading': "Uploading…",
    'settings.replaceImage': "Replace image",
    'settings.chooseImage': "Choose image",
    'settings.deleteBg': "Delete background image",
    'settings.noImage': "No background image selected yet.",
    'settings.bgPreviewAlt': "Background image preview",
    'settings.dim': "Overlay strength",
    'settings.previewTransparent': "Transparent (shows app theme)",
    'settings.previewSolid': "Solid background",
    'settings.previewImage': "Image background · overlay {percent}%",
    'settings.layout': "Layout",
    'settings.columns': "Columns on screen",
    'settings.columnsUnit': "{n} col",
    'settings.cardWidth': "Card width",
    'settings.cardHeight': "Card height",
    'settings.cardGap': "Card gap",
    'settings.preview': "Preview",
    'settings.hoverScale': "Hover zoom factor",
    'settings.language': "Language",
    'settings.langSystem': "System",
    'settings.langZh': "中文",
    'settings.langEn': "English",
    'settings.langHint': "The page will reload once after switching",
    'settings.done': "Done",
    'ink.thin': "Thin",
    'ink.mid': "Medium",
    'ink.bold': "Thick",
    'ink.black': "Black",
    'ink.red': "Red",
    'ink.blue': "Blue",
    'ink.green': "Green",
    'ink.note': "Original",
    'ink.title': "Handwrite",
    'ink.hint': "Mouse / finger / stylus all work",
    'ink.strokeCount': "{n} strokes",
    'ink.empty': "Blank",
    'ink.sizeTitle': "Stroke: {size}",
    'ink.eraserTitle': "Eraser: wipe strokes",
    'ink.eraser': "Eraser",
    'ink.colorTitle': "Color: {color}",
    'ink.undoTitle': "Undo last stroke (Ctrl/Cmd + Z)",
    'ink.undo': "Undo",
    'ink.clearTitle': "Clear the whole pad",
    'ink.clear': "Clear",
    'ink.placeholder': "Draw or write here (transparent background; exported PNG has no white fill)",
    'ink.escHint': "Esc to cancel · Ctrl/Cmd + Z to undo",
    'ink.cancelTitle': "Discard this drawing",
    'ink.cancel': "Cancel",
    'ink.doneTitle': "Convert strokes to PNG and insert into the note",
    'ink.done': "Done",
  },
};

const LOCALE_STORAGE_KEY = 'dsh-notewall.locale';

let cachedLang = null;
let forcedLocale = null;

/**
 * 用户的语言偏好：'system' | 'zh' | 'en'，存在 localStorage 里。
 */
export function getLocalePref() {
  try {
    const v = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (v === 'zh' || v === 'en') return v;
  } catch {
    // localStorage 不可用（隐私模式等）就当跟随系统
  }
  return 'system';
}

/** 写入语言偏好；传 'system' 回到跟随浏览器。 */
export function setLocalePref(pref) {
  const v = pref === 'zh' || pref === 'en' ? pref : 'system';
  try {
    if (v === 'system') localStorage.removeItem(LOCALE_STORAGE_KEY);
    else localStorage.setItem(LOCALE_STORAGE_KEY, v);
  } catch {
    // 存不了也只是下次回到跟随系统，不影响本次
  }
  cachedLang = null;
  forcedLocale = null;
}

/** 按浏览器语言推断，只区分中文 / 非中文两种。 */
export function resolveLocale() {
  if (forcedLocale) return forcedLocale;
  if (cachedLang) return cachedLang;
  const pref = getLocalePref();
  if (pref === 'zh' || pref === 'en') {
    cachedLang = pref;
    return cachedLang;
  }
  let first = '';
  try {
    const list =
      typeof navigator !== 'undefined' && navigator.languages && navigator.languages.length
        ? navigator.languages
        : [typeof navigator !== 'undefined' ? navigator.language || '' : ''];
    first = String(list[0] || '').toLowerCase();
  } catch {
    first = '';
  }
  cachedLang = first.startsWith('zh') ? 'zh' : 'en';
  return cachedLang;
}

/** 强制指定语言；传 'auto' 回到浏览器判断。 */
export function setLocale(locale) {
  forcedLocale = locale === 'zh' || locale === 'en' ? locale : null;
  cachedLang = null;
}

/**
 * 取文案。
 * @param {string} key 形如 'deliver.title'
 * @param {Record<string, string|number>} [params] 占位符，键名对应文案里的 {name}
 */
export function t(key, params) {
  const lang = resolveLocale();
  const table = DICT[lang] || DICT.zh;
  let text = table[key];
  if (text === undefined) text = DICT.zh[key];
  if (text === undefined) return key;
  if (params) {
    for (const name of Object.keys(params)) {
      text = text.split('{' + name + '}').join(String(params[name]));
    }
  }
  return text;
}

/** 当前语言下是否已经翻好（用于判断界面是否完整本地化）。 */
export function hasKey(key) {
  const lang = resolveLocale();
  if (lang === 'zh') return key in DICT.zh;
  return key in (DICT[lang] || {});
}

/** 导出全部 key，写测试和核对覆盖率时用。 */
export function allKeys() {
  return Object.keys(DICT.zh);
}

/** 导出某语言已完成的 key，算翻译进度用。 */
export function translatedKeys() {
  const lang = resolveLocale();
  if (lang === 'zh') return Object.keys(DICT.zh);
  return Object.keys(DICT[lang] || {});
}
