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

export function QuickDraftButton() {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(null);
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
        onClick={() => setOpen((value) => !value)}
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

      {open ? (
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
                onClose={() => setNote(null)}
                onChange={saveDraft}
              />
            ) : (
              <div style={{ fontSize: 12, opacity: 0.66, lineHeight: 1.8 }}>
                {t('draft.empty')}
              </div>
            )}
          </div>
        </aside>
      ) : null}
    </>
  );
}

export default QuickDraftButton;
