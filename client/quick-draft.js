/**
 * 会话内快速草稿。
 *
 * 入口挂在 `conversation.session.header.utilities` —— 就是会话标题栏右上那排工具按钮，
 * 这个插槽由内核 @deepseek-ai/dsh-client-ui-conversation 提供，不需要 any 外部插件。
 *
 * 面板是自己画的右侧抽屉，不占用 `sidebar.right.pane.tab`：
 * 那个插槽 better-sidebar 也在用，两边抢同一个右栏会互相顶掉；
 * 自绘抽屉可以和它同时开着，互不干扰。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { NoteEditor } from './editor.js';
import { t } from './strings.js';

// 和编辑器面板同宽：NoteEditor 内部写死 520，抽屉比它窄会横向溢出。
/** 草稿 tab 的类型名：注册 tab 类型、开 tab、注册面板都用它。 */
export const DRAFT_KIND = 'sticky-wall-draft';

const PANEL_W = 560;

const chipStyle = {
  border: 'none',
  background: 'rgba(127,127,127,.12)',
  color: 'inherit',
  borderRadius: 7,
  padding: '4px 9px',
  fontSize: 12,
  cursor: 'pointer',
};

export function QuickDraftButton(props) {
  // 右栏版走内核 sidebarRight 时，由 slot 的 inject 把 openDraft 传进来；
  // 拿不到就退回自绘抽屉（当前可用形态），保证功能不会因为改造而消失。
  const openDraft = props?.inject?.openDraft;
  const external = typeof openDraft === 'function';

  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(null);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const aliveRef = useRef(true);

  useEffect(() => () => { aliveRef.current = false; }, []);

  const createDraft = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      // 空白便签：留空 title，交给编辑器里的时间戳标题逻辑。
      const result = await api.note({ op: 'create', text: '' });
      const created = result?.note ?? null;
      if (!aliveRef.current) return;
      if (created) setNote(created);
      else setError(t('draft.createFailed'));
    } catch (err) {
      if (aliveRef.current) setError(err?.message ?? String(err));
    } finally {
      if (aliveRef.current) setBusy(false);
    }
  }, [busy]);

  const saveDraft = useCallback(
    async (patch) => {
      const id = note?.id;
      if (!id) return;
      try {
        await api.note({ op: 'update', id, ...patch });
      } catch {
        // 编辑器自己带防抖与重试，这里失败不打断输入。
      }
    },
    [note],
  );

  // 打开抽屉时把墙上的便签读出来，让用户直接挑一张接着写，而不是面对空白。
  const loadNotes = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.state();
      if (!aliveRef.current) return;
      const list = Array.isArray(result?.doc?.notes) ? result.doc.notes : [];
      setNotes(list);
    } catch (err) {
      if (aliveRef.current) setError(err?.message ?? String(err));
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void loadNotes();
  }, [open, loadNotes]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        title={t('draft.button')}
        aria-label={t('draft.button')}
        aria-pressed={open}
        onClick={() => {
          if (!external) {
            setOpen((value) => !value);
            return;
          }
          try {
            openDraft();
          } catch {
            // openTab 不可用（内核版本差异/未注册 kind）时静默失败，不打断会话
          }
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          height: 28,
          borderRadius: 8,
          border: 'none',
          background: open ? 'rgba(77,107,254,.14)' : 'transparent',
          color: 'inherit',
          cursor: 'pointer',
          fontSize: 15,
          lineHeight: 1,
        }}
      >
        <span aria-hidden="true">📝</span>
      </button>

      {!external && open ? (
        <aside
          role="dialog"
          aria-label={t('draft.title')}
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            width: PANEL_W,
            maxWidth: '94vw',
            zIndex: 1250,
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--dsh-bg-elevated, #ffffff)',
            color: 'var(--dsh-text-primary, #1f2430)',
            borderLeft: '1px solid var(--dsh-border, rgba(128,140,160,.24))',
            boxShadow: '-18px 0 48px rgba(15,23,42,.18)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              borderBottom: '1px solid var(--dsh-border, rgba(128,140,160,.18))',
              flexShrink: 0,
            }}
          >
            <strong style={{ fontSize: 13, flex: 1 }}>{t('draft.title')}</strong>
            <button type="button" onClick={createDraft} disabled={busy} style={chipStyle}>
              {busy ? '…' : t('draft.new')}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t('draft.close')}
              style={{ ...chipStyle, fontSize: 15, lineHeight: 1, padding: '2px 8px' }}
            >
              ×
            </button>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 10 }}>
            {error ? (
              <div style={{ fontSize: 12, color: '#c0392b', marginBottom: 8 }}>{error}</div>
            ) : null}

            {note ? (
              <NoteEditor
                note={note}
                onClose={() => { setNote(null); void loadNotes(); }}
                onChange={saveDraft}
              />
            ) : loading ? (
              <div style={hintStyle}>{t('draft.loading')}</div>
            ) : notes.length === 0 ? (
              <div style={hintStyle}>{t('draft.empty')}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ ...hintStyle, marginBottom: 2 }}>{t('draft.pick')}</div>
                {notes.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setNote(item)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      textAlign: 'left',
                      padding: '9px 10px',
                      borderRadius: 9,
                      border: '1px solid var(--dsh-border, rgba(128,140,160,.2))',
                      background: item.color || 'transparent',
                      color: 'inherit',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontFamily: 'inherit',
                    }}
                  >
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {plainText(item) || t('draft.untitled')}
                    </span>
                    <span style={{ opacity: 0.55, fontSize: 11, flexShrink: 0 }}>
                      {t('draft.edit')}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>
      ) : null}
    </>
  );
}

/**
 * 右栏里的草稿面板：列出墙上的便签，也能就地新建一张。
 *
 * 它是 slot `sidebar.right.pane.tab` 的 body —— 内核右栏是布局里真实的一栏，
 * 内容占进来之后会话正文会被推挤让位，这正是自绘浮层做不到的地方。
 */
export function DraftPane() {
  const [note, setNote] = useState(null);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const aliveRef = useRef(true);

  useEffect(() => () => { aliveRef.current = false; }, []);

  const loadNotes = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.state();
      if (!aliveRef.current) return;
      setNotes(Array.isArray(result?.doc?.notes) ? result.doc.notes : []);
    } catch (err) {
      if (aliveRef.current) setError(err?.message ?? String(err));
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => { void loadNotes(); }, [loadNotes]);

  const createDraft = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await api.note({ op: 'create', text: '' });
      if (!aliveRef.current) return;
      const created = result?.note ?? null;
      if (created) setNote(created);
      else setError(t('draft.createFailed'));
    } catch (err) {
      if (aliveRef.current) setError(err?.message ?? String(err));
    } finally {
      if (aliveRef.current) setBusy(false);
    }
  }, [busy]);

  const saveDraft = useCallback(
    async (patch) => {
      const id = note?.id;
      if (!id) return;
      try {
        await api.note({ op: 'update', id, ...patch });
      } catch {
        // 编辑器自带防抖与重试，这里失败不打断输入。
      }
    },
    [note],
  );

  const chip = {
    border: 'none',
    background: 'rgba(127,127,127,.12)',
    color: 'inherit',
    borderRadius: 7,
    padding: '4px 9px',
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: 'inherit',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 10px',
          borderBottom: '1px solid var(--dsh-border, rgba(128,140,160,.18))',
          flexShrink: 0,
        }}
      >
        <strong style={{ fontSize: 12, flex: 1 }}>{t('draft.title')}</strong>
        <button type="button" onClick={createDraft} disabled={busy} style={chip}>
          {busy ? '…' : t('draft.new')}
        </button>
        {note ? (
          <button type="button" onClick={() => { setNote(null); void loadNotes(); }} style={chip}>
            {t('draft.back')}
          </button>
        ) : null}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 10 }}>
        {error ? (
          <div style={{ fontSize: 12, color: '#c0392b', marginBottom: 8 }}>{error}</div>
        ) : null}

        {note ? (
          <NoteEditor note={note} onClose={() => { setNote(null); void loadNotes(); }} onChange={saveDraft} />
        ) : loading ? (
          <div style={hintStyle}>{t('draft.loading')}</div>
        ) : notes.length === 0 ? (
          <div style={hintStyle}>{t('draft.empty')}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ ...hintStyle, marginBottom: 2 }}>{t('draft.pick')}</div>
            {notes.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setNote(item)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  textAlign: 'left',
                  padding: '9px 10px',
                  borderRadius: 9,
                  border: '1px solid var(--dsh-border, rgba(128,140,160,.2))',
                  background: item.color || 'transparent',
                  color: 'inherit',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontFamily: 'inherit',
                }}
              >
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {plainText(item) || t('draft.untitled')}
                </span>
                <span style={{ opacity: 0.55, fontSize: 11, flexShrink: 0 }}>
                  {t('draft.edit')}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const hintStyle = { fontSize: 12, opacity: 0.66, lineHeight: 1.8 };


/** 列表里只需要一眼能认出来的纯文本标题，不渲染富文本。 */
function plainText(item) {
  const html = typeof item?.html === 'string' ? item.html : '';
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.slice(0, 60);
}

export default QuickDraftButton;
