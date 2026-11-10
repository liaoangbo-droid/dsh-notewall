/**
 * 便签墙 — 墙本体。
 *
 * 负责背景、网格、工具栏、拖拽排序，以及挂载「便签编辑器」与「墙设置」
 * 两个浮层。数据变更全部回调给上层（index.js 的共享 store），这里不直接
 * 发请求。
 *
 * 排序规则（与 host 一致）：置顶的在前，然后按 `order` 升序，最后按创建
 * 时间从近到远。手动拖动会重写 `order`。
 *
 * @module dsh-notewall/client/wall
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NoteCard, deliveryTimeMs } from './card';
import { DeliverDialog } from './deliver';
import { NoteEditor } from './editor';
import { WallSettings } from './settings';
import { mediaUrl } from './api';
import { pickAutoColor, resolveNewNoteColor } from './palette';
import { t } from './strings.js';

/** 默认墙配置（host 无数据时的兜底）。 */
/* 拖拽诊断埋点：POST /sticky-wall/boot-trace，写入 boot-trace.jsonl 供排查 */
function swTrace(payload) {
  try {
    fetch("/sticky-wall/boot-trace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phase: "drag", ...payload }),
    }).catch(() => {});
  } catch (err) { void err; }
}

const FALLBACK_WALL = {
  bg: { kind: 'color', color: '#f4f1ea', mediaId: null, dim: 0.55 },
  columns: 3,
  cardWidth: 260,
  cardHeight: 220,
  hoverScale: 1.5,
  gap: 22,
  fontSize: 14,
  newNoteColor: { mode: 'auto', color: '#faf7e0' },
};

/** 把 wall.bg 翻译成外层容器的 style。 */
function wallBackgroundStyle(wall) {
  const bg = wall?.bg ?? FALLBACK_WALL.bg;
  if (bg.kind === 'image' && bg.mediaId) {
    const dim = Math.min(1, Math.max(0, bg.dim ?? 0.55));
    return {
      backgroundColor: bg.color ?? '#f4f1ea',
      backgroundImage: `linear-gradient(rgba(255,255,255,${dim}), rgba(255,255,255,${dim})), url("${mediaUrl(bg.mediaId)}")`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: 'local',
    };
  }
  if (bg.kind === 'none') return { backgroundColor: 'transparent' };
  return { backgroundColor: bg.color ?? '#f4f1ea' };
}

/**
 * @param {{
 *   doc: {notes: object[], wall: object},
 *   palette: string[],
 *   uploadImage: (dataUrl: string) => Promise<{url: string, id: string}>,
 *   onCreate: (patch: object) => Promise<object|null>,
 *   onUpdate: (id: string, patch: object) => Promise<void>,
 *   onDelete: (note: object) => Promise<void>,
 *   onReorder: (ids: string[]) => Promise<void>,
 *   onUpdateWall: (patch: object) => Promise<void>,
 *   status: string,
 * }} props
 */
export function StickyWall({
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
  status,
}) {
  const wall = { ...FALLBACK_WALL, ...(doc?.wall ?? {}) };
  const notes = doc?.notes ?? [];

  const [editing, setEditing] = useState(null); // { id: string|null, note: object|null }
  const [showSettings, setShowSettings] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null); // 待确认删除的便签

  // 「发送到会话」弹窗状态：{ note, sessions, busy, error }
  const [deliverTarget, setDeliverTarget] = useState(null);

  // 拖便签到左侧时浮出的会话投放条：null=未展开
  const [dropSessions, setDropSessions] = useState(null);
  const [hoverSessionId, setHoverSessionId] = useState(null);

  const openDeliver = useCallback(
    async (note, preset) => {
      setDeliverTarget({ note, sessions: [], busy: false, error: '', initialSessionId: preset?.id ?? '' });
      try {
        const list = (await listSessions?.()) ?? [];
        setDeliverTarget((prev) =>
          prev && prev.note.id === note.id ? { ...prev, sessions: list } : prev,
        );
      } catch (error) {
        setDeliverTarget((prev) =>
          prev && prev.note.id === note.id
            ? { ...prev, error: String(error?.message ?? error) }
            : prev,
        );
      }
    },
    [listSessions],
  );

  const runDeliver = useCallback(async (payload, action) => {
    setDeliverTarget((prev) => (prev ? { ...prev, busy: true, error: '' } : prev));
    try {
      await action(payload);
      setDeliverTarget(null);
    } catch (error) {
      setDeliverTarget((prev) =>
        prev ? { ...prev, busy: false, error: String(error?.message ?? error) } : prev,
      );
    }
  }, []);
  useEffect(() => { editingRef.current = editing; }, [editing]);
  const [dragId, setDragId] = useState(null);
  // 拖拽时的「插入位」：0..n，表示插到第几号之前；insertPos 是插入线在网格里的坐标
  const [dropIndex, setDropIndex] = useState(null);
  const [insertPos, setInsertPos] = useState(null);
  // drop 事件与 dragEnter 是两次不同的回调，用 ref 保证松手时读到的是最新插入位
  const dropRef = useRef(null);
  const [columns, setColumns] = useState(wall.columns);
  const gridRef = useRef(null);
  const scrollRef = useRef(null);

  // 容器宽度不够时自动减少列数，保证卡片不被压扁。
  useEffect(() => {
    const node = scrollRef.current;
    if (!node || typeof ResizeObserver === 'undefined') {
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

  // 新建便签时的并发保护。onCreate 是异步的：编辑器的防抖保存可能在它返回
  // 之前再次触发，两次都会落到「还没有 id」这个分支，于是创建出两张一模一样
  // 的便签（用户实测反馈的现象）。用一个同步 ref 卡住第二次进入。
  const creatingRef = useRef(false);

  // 编辑会话令牌：每次打开/关闭编辑器都 +1。异步创建回调返回后靠它判断这次编辑
  // 是否还「活着」——用户可能已经点了关闭。没有这道闸，关闭后迟到的保存会把
  // 编辑器重新打开（用户实测：点 X 后自动新建，紧接着又弹出这张便签的编辑页）。
  const editSessionRef = useRef(0);

  // 关闭编辑器时要知道「用户写没写过东西」，以及当前编辑的是哪张便签。
  // closeEditor 是空依赖的 useCallback，拿不到最新 state，所以用 ref 镜像。
  const editorDirtyRef = useRef(false);
  const editingRef = useRef(null);

  // 打开编辑器：传 note（编辑）或 null（新建）
  const openEditor = useCallback(
    (note) => {
      editSessionRef.current += 1;
      editorDirtyRef.current = false;
      if (note) {
        // 打开编辑页 = 重置「已发送」状态：但**只在定时已经到点之后**才清。
        // 未到点就清会顺手取消掉内核里的 reminder —— 用户只是想看眼内容，
        // 不该因此丢掉自己设的定时。
        if (note.delivery && note.id) {
          // delivery.at 是数字时间戳（host 侧 Math.round），不是 ISO 串
          const fireAt = deliveryTimeMs(note.delivery);
          if (fireAt !== null && fireAt <= Date.now()) {
            void onClearDelivery?.(note.id);
          }
        }
        setEditing({ note, id: note.id ?? null });
        return;
      }
      // 新建时**先把自动配色算好**当作草稿的初始色。
      //
      // 这样有两个好处：① 用户一打开就看到分配好的新颜色（不会与墙上已有颜色
      // 撞车）；② 创建请求里带的是「已经算过的颜色」，而不是编辑器回传的默认色，
      // 避免自动配色逻辑永远走不到（之前 patch.color 一直有值，导致自动配色失效）。
      const auto = resolveNewNoteColor(notes, wall);
      setEditing({
        id: null,
        note: {
          id: null,
          html: '',
          color: auto.color,
          textColor: '#1f2430',
          pinned: false,
          createdAt: Date.now(),
        },
      });
    },
    [notes, onClearDelivery],
  );

  // 提醒弹框点了「查看便签」→ 由外面指定 id，这里负责真正打开编辑器。
  // 之前只设了 focusNoteId 标记却没人消费，所以表现为「只确认、不跳转」。
  const focusHandledRef = useRef(null);
  useEffect(() => {
    if (!focusNoteId) return;
    if (focusHandledRef.current === focusNoteId) return;
    const target = notes.find((note) => note.id === focusNoteId);
    if (!target) return; // 列表还没加载到这张便签，等下一轮
    focusHandledRef.current = focusNoteId;
    openEditor(target);
  }, [focusNoteId, notes, openEditor]);

  const closeEditor = useCallback(() => {
    editSessionRef.current += 1;
    // 新建后什么都没写就关闭 → 仍然留一张「草稿」便签。
    // 用户的需求：先占个位、回头再记，不希望辛苦点开的面板白开一趟。
    const current = editingRef.current;
    if (current && !current.id && !editorDirtyRef.current) {
      void onCreate({
        html: '',
        color: current.note?.color,
        textColor: current.note?.textColor,
        draft: true,
      });
    }
    // 关闭前主动把焦点摘下来。
    //
    // 否则焦点可能留在一个「已经从 DOM 移除、但浏览器仍认为持有焦点」的元素上
    // （detached）。这时点任何输入框都不出光标、Tab 键也遍历不到它 —— 只有整棵
    // 组件树重新渲染（刷新页面 / 切走再切回来触发 pull+rerender）才会把状态洗掉。
    // 用户实测环境是极空间远程访问客户端：没有地址栏、Tab 无效，只有切标签页能恢复。
    // 所以在卸载编辑器之前自己先失焦，别把幽灵焦点留给浏览器。
    const doc = typeof document === "undefined" ? null : document;
    const active = doc ? doc.activeElement : null;
    if (active && active !== doc.body && typeof active.blur === "function") {
      try {
        active.blur();
      } catch (err) {
        /* 元素已分离：忽略 */
      }
    }
    setEditing(null);
  }, [onCreate]);

  /** 编辑器实时保存：新建时首次 onChange 负责 create。 */
  const handleEditorChange = useCallback(
    async (patch) => {
      if (!patch) return;
      editorDirtyRef.current = true;
      const html = String(patch.html ?? '');
      const isEmpty = html.replace(/<[^>]+>/g, '').trim() === '' && !/<img\b/i.test(html);
      if (!editing?.id) {
        if (isEmpty) return; // 还没写任何东西，不建空便签
        if (creatingRef.current) return; // 上一次创建还在路上，别再造第二张
        const session = editSessionRef.current;
        creatingRef.current = true;
        try {
          const created = await onCreate(patch);
          // 期间关闭/切换过编辑器就丢弃这次结果，否则会把已关闭的编辑器重新打开。
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
      // 往草稿里写入内容后，它就不再是草稿了。
      const nextPatch = editing?.note?.draft ? { ...patch, draft: false } : patch;
      await onUpdate(editing.id, nextPatch);
    },
    [editing?.id, onCreate, onUpdate],
  );

  /** 当前正在编辑的便签（用最新数据，编辑器里改了颜色能实时反映）。 */
  const editingNote = useMemo(() => {
    if (!editing?.id) return editing?.note ?? null;
    return notes.find((note) => note.id === editing.id) ?? editing.note ?? null;
  }, [editing, notes]);

  const handleDrop = useCallback(
    async (targetIndex) => {
      const from = notes.findIndex((note) => note.id === dragId);
      swTrace({ kind: "handleDrop", targetIndex, from, total: notes.length });
      dropRef.current = null;
      setDragId(null);
      setDropIndex(null);
      setInsertPos(null);
      if (from < 0 || targetIndex == null) return;
      // targetIndex =「插到第几号之前」；移除自己后，后面的索引要左移一位
      const insertAt = targetIndex > from ? targetIndex - 1 : targetIndex;
      if (insertAt === from) return;
      const next = notes.slice();
      const [moved] = next.splice(from, 1);
      next.splice(insertAt, 0, moved);
      await onReorder?.(next.map((note) => note.id));
    },
    [dragId, notes, onReorder],
  );

  const handleTogglePin = useCallback(
    (note) => {
      void onUpdate(note.id, { pinned: !note.pinned });
    },
    [onUpdate],
  );

  const handleDelete = useCallback((note) => {
    // 不用 window.confirm。原生模态对话框会打断焦点链：用户实测在极空间远程访问
    // 客户端里，删除便签（唯一走 confirm 的路径）之后整页输入框都打不进字、
    // Tab 也跳不进去，只有切标签页才恢复。改成自绘浮层，确认逻辑仍保留。
    setPendingDelete(note);
  }, []);

  // 松手在某个会话上：打开投递弹窗并预选它
  const handleSessionDrop = useCallback(
    (session) => {
      const note = notes.find((item) => item.id === dragId) ?? null;
      setDragId(null);
      setDropIndex(null)
      setInsertPos(null);
      setDropSessions(null);
      setHoverSessionId(null);
      if (!note) return;
      openDeliver(note, session);
    },
    [dragId, notes, openDeliver],
  );

  // 拖拽时光标靠近墙的左缘 → 展开会话投放条
  const handleWallDragOver = useCallback(
    (event) => {
      if (!dragId) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const nearLeft = event.clientX - rect.left < 160;
      if (nearLeft) {
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "link";
        if (!dropSessions) {
          void Promise.resolve(listSessions?.())
            .then((list) => setDropSessions(Array.isArray(list) ? list : []))
            .catch(() => setDropSessions([]));
        }
      } else if (dropSessions) {
        setDropSessions(null);
        setHoverSessionId(null);
      }
    },
    [dragId, dropSessions, listSessions],
  );

  return (
    <div className="sw-root">
      <div className="sw-toolbar">
        <span className="sw-title">{t('wall.title')}</span>
        <span className="sw-count">{t('wall.count', { count: notes.length })}</span>
        {status ? <span className="sw-count" style={{ color: 'var(--dsh-warning, #b45309)' }}>{status}</span> : null}
        <span className="sw-spacer" />
        <button type="button" className="sw-btn primary" onClick={() => openEditor(null)}>
          {t('wall.newNote')}
        </button>
        <button type="button" className="sw-btn" onClick={() => setShowSettings(true)} title={t('wall.settings')}>
          ⚙ {t('wall.settings')}
        </button>
      </div>

      {/*
        内边距要容纳 hover 放大的溢出量：卡片放大只在视觉上溢出，而这里是
        滚动容器（overflow 裁切），最外侧/最顶部的卡片会因此被切边。四面都
        按 (hoverScale - 1) / 2 的最大溢出量留余量。
      */}
      <div className="sw-body">
      {dropSessions ? (
        <div className="sw-dropbar" onDragOver={(event) => event.preventDefault()}>
          <div className="sw-dropbar-title">{t('wall.dropTitle')}</div>
          {dropSessions.length === 0 ? (
            <div className="sw-dropbar-empty">{t('wall.dropEmpty')}</div>
          ) : (
            dropSessions.map((item) => (
              <div
                key={item.id}
                className={"sw-dropitem" + (hoverSessionId === item.id ? " is-hover" : "")}
                title={item.title || item.id}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (hoverSessionId !== item.id) setHoverSessionId(item.id);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  handleSessionDrop(item);
                }}
              >
                {item.title || t('wall.unnamedSession')}
              </div>
            ))
          )}
        </div>
      ) : null}

      <div
        className="sw-wall"
        ref={scrollRef}
        onDragOver={handleWallDragOver}
        style={{
          ...wallBackgroundStyle(wall),
          paddingTop: Math.max(28, Math.round(((wall.hoverScale - 1) * wall.cardHeight) / 2) + 24),
          paddingBottom: Math.max(120, Math.round(((wall.hoverScale - 1) * wall.cardHeight) / 2) + 96),
          paddingLeft: Math.max(24, Math.round(((wall.hoverScale - 1) * wall.cardWidth) / 2) + 16),
          paddingRight: Math.max(24, Math.round(((wall.hoverScale - 1) * wall.cardWidth) / 2) + 16),
        }}
      >
        {notes.length === 0 ? (
          <div className="sw-empty">
            <strong>{t('wall.emptyTitle')}</strong>
            <span>{t('wall.emptyHint')}</span>
            <span className="sw-muted">{t('wall.emptyAutoSave')}</span>
          </div>
        ) : (
          <div
            className="sw-grid"
            ref={gridRef}
            onDragOver={(event) => {
              // 不 preventDefault 就永远不会有 drop 事件落在容器上
              if (dragId) {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              const target = dropRef.current;
              swTrace({ kind: "container-drop", target, hasDrag: Boolean(dragId) });
              dropRef.current = null;
              void handleDrop(target);
            }}
            style={{
              position: 'relative',
              gridTemplateColumns: `repeat(${columns}, ${wall.cardWidth}px)`,
              gap: wall.gap,
              alignItems: 'start',
            }}
          >
            {(() => {
              const C = Math.max(1, columns);
              const cellW = wall.cardWidth + wall.gap;
              const cellH = wall.cardHeight + wall.gap;
              const from = notes.findIndex((n) => n.id === dragId);
              const to = from >= 0 && dropIndex != null
                ? (dropIndex > from ? dropIndex - 1 : dropIndex)
                : -1;
              // 把第 from 张移到 to 之后，第 j 张的新索引
              const movedIndex = (j) => {
                if (from < 0 || to < 0 || j === from) return j;
                if (from < to) return j > from && j <= to ? j - 1 : j;
                if (from > to) return j >= to && j < from ? j + 1 : j;
                return j;
              };
              const shiftOf = (j) => {
                const nj = movedIndex(j);
                if (nj === j) return { x: 0, y: 0 };
                const dc = (nj % C) - (j % C);
                const dr = Math.floor(nj / C) - Math.floor(j / C);
                return { x: dc * cellW, y: dr * cellH };
              };
              return notes.map((note, index) => {
                const shift = dragId && dragId !== note.id ? shiftOf(index) : { x: 0, y: 0 };
                return (
              <NoteCard
                key={note.id}
                onCancelDelivery={onClearDelivery}
                onDeliver={(sentNote) => {
              // 先关编辑页再开选择器：否则选择器会被编辑器 overlay 盖住
              closeEditor();
              window.setTimeout(() => {
                if (sentNote) openDeliver(sentNote);
              }, 60);
            }}
                note={note}
                wall={{ ...wall, fontSize: wall.fontSize }}
                index={index}
                shiftX={shift.x}
                shiftY={shift.y}
                onOpen={() => openEditor(note)}
                onTogglePin={handleTogglePin}
                onDelete={handleDelete}
                dragging={dragId === note.id}
                onDragStart={() => {
                  setDragId(note.id);
                  dropRef.current = null;
                  setDropIndex(null);
                  setInsertPos(null);
                }}
                onDragEnter={(event) => {
                  if (!dragId || dragId === note.id) return;
                  const rect = event.currentTarget.getBoundingClientRect();
                  const gridEl = gridRef.current;
                  if (!gridEl) return;
                  const gRect = gridEl.getBoundingClientRect();
                  const after = event.clientX > rect.left + rect.width / 2;
                  // 拖自己右半时不要越过自己
                  const idx = index + (after ? 1 : 0);
                  dropRef.current = idx;
                  setDropIndex(idx);
                  setInsertPos({
                    x: (after ? rect.right : rect.left) - gRect.left,
                    y: rect.top - gRect.top,
                    h: rect.height,
                  });
                }}
                onDragEnd={() => {
                  // drop 事件在某些环境（串流 WebView / 远程桌面）不保证投递，
                  // 但 dragend 按规范一定在拖拽源上触发 —— 用它做兜底提交。
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
                }}
              />
                );
              });
            })()}
            {insertPos ? (
              <div
                className="sw-insert-line"
                style={{ left: insertPos.x - 1.5, top: insertPos.y, height: insertPos.h }}
              />
            ) : null}

          </div>
        )}
      </div>
      </div>

      {editing ? (
        <div
          className="sw-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeEditor();
          }}
        >
          <NoteEditor
            note={editingNote}
            onDeliver={openDeliver}
            palette={palette}
            onClose={closeEditor}
            onChange={handleEditorChange}
            uploadImage={uploadImage}
          />
        </div>
      ) : null}

      {showSettings ? (
        <div
          className="sw-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowSettings(false);
          }}
        >
          <WallSettings
            wall={wall}
            palette={palette}
            onChange={(patch) => void onUpdateWall(patch)}
            onClose={() => setShowSettings(false)}
            uploadImage={uploadImage}
          />
        </div>
      ) : null}

      {pendingDelete ? (
        <div
          className="sw-overlay"
          style={{ zIndex: 60 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPendingDelete(null);
          }}
        >
          <div
            style={{
              background: 'var(--dsh-bg, #fff)',
              color: 'var(--dsh-text, #1f2430)',
              border: '1px solid var(--dsh-border, rgba(127,127,127,.25))',
              borderRadius: 14,
              padding: '20px 22px',
              width: 360,
              maxWidth: 'calc(100vw - 40px)',
              boxShadow: '0 24px 60px -18px rgba(9,14,24,.55)',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <strong style={{ fontSize: 15 }}>{t('wall.deleteTitle')}</strong>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, opacity: 0.85 }}>
              {t('wall.deleteConfirm', { title: pendingDelete.title || t('wall.deleteThisOne') })}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" className="sw-btn" onClick={() => setPendingDelete(null)}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="sw-btn primary"
                onClick={() => {
                  const target = pendingDelete;
                  setPendingDelete(null);
                  void onDelete(target);
                }}
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deliverTarget ? (
        <DeliverDialog
          note={deliverTarget.note}
          sessions={deliverTarget.sessions}
          busy={deliverTarget.busy}
          error={deliverTarget.error}
          initialSessionId={deliverTarget.initialSessionId}
          onClose={() => setDeliverTarget(null)}
          onInsert={({ note, session }) =>
            runDeliver({ note, session }, onInsertToSession)
          }
          onSchedule={({ note, session, at }) =>
            runDeliver({ note, session, at }, onScheduleToSession)
          }
        />
      ) : null}
    </div>
  );
}
