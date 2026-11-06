/**
 * 「发送到会话」弹窗（两级选择：工作区 → 会话）。
 *
 * 为什么两级：宿主里有几百个会话，平铺分不清谁是谁；先按工作区聚合，
 * 点进去再挑具体会话，误点的概率低很多。
 *
 * 硬规则：不使用 window.confirm / alert / prompt —— 远程嵌入式客户端里
 * 原生模态会打断焦点链，导致整页输入失效。
 */
import { useMemo, useState } from 'react';
import { formatTimestamp } from './session-bridge.js';

const s = {
  mask: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 20, 30, 0.42)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
    padding: 16,
  },
  card: {
    width: 'min(520px, 100%)',
    maxHeight: '82vh',
    display: 'flex',
    flexDirection: 'column',
    borderRadius: 14,
    background: 'var(--sw-surface, #fffdf8)',
    boxShadow: '0 18px 48px rgba(15, 20, 30, 0.28)',
    overflow: 'hidden',
    font: 'inherit',
  },
  head: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px 10px',
    fontSize: 14,
    fontWeight: 600,
  },
  body: { padding: '0 16px 8px', overflowY: 'auto', minHeight: 0 },
  label: { fontSize: 12, opacity: 0.65, margin: '10px 0 6px' },
  list: {
    border: '1px solid rgba(15,20,30,0.12)',
    borderRadius: 10,
    maxHeight: 230,
    overflowY: 'auto',
  },
  item: (active) => ({
    padding: '8px 10px',
    fontSize: 13,
    cursor: 'pointer',
    background: active ? 'rgba(64,140,255,0.12)' : 'transparent',
    borderBottom: '1px solid rgba(15,20,30,0.06)',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  }),
  name: {
    flex: '1 1 auto',
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  count: { flex: '0 0 auto', fontSize: 11, opacity: 0.6 },
  modes: { display: 'flex', gap: 8, marginTop: 4 },
  mode: (active) => ({
    flex: 1,
    padding: '9px 10px',
    borderRadius: 9,
    border: '1px solid ' + (active ? 'rgba(64,140,255,0.55)' : 'rgba(15,20,30,0.14)'),
    background: active ? 'rgba(64,140,255,0.10)' : 'transparent',
    cursor: 'pointer',
    fontSize: 12,
    lineHeight: 1.45,
    textAlign: 'left',
    font: 'inherit',
  }),
  input: {
    width: '100%',
    padding: '8px 10px',
    borderRadius: 9,
    border: '1px solid rgba(15,20,30,0.16)',
    font: 'inherit',
    fontSize: 13,
    boxSizing: 'border-box',
  },
  foot: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    padding: '12px 16px 14px',
    borderTop: '1px solid rgba(15,20,30,0.08)',
  },
  btn: (primary) => ({
    padding: '8px 16px',
    borderRadius: 9,
    border: primary ? 'none' : '1px solid rgba(15,20,30,0.16)',
    background: primary ? '#408cff' : 'transparent',
    color: primary ? '#fff' : 'inherit',
    cursor: 'pointer',
    fontSize: 13,
    font: 'inherit',
  }),
  linkBtn: {
    border: 'none',
    background: 'transparent',
    color: '#408cff',
    cursor: 'pointer',
    fontSize: 12,
    padding: 0,
    font: 'inherit',
  },
  hint: { fontSize: 11, opacity: 0.6, marginTop: 6, lineHeight: 1.5 },
  error: { fontSize: 12, color: '#c0392b', marginTop: 8, lineHeight: 1.5, wordBreak: 'break-word' },
  block: { fontSize: 12, color: '#8a6d1f', background: '#fff8e1', border: '1px solid #ffe0a3', borderRadius: 6, padding: '6px 8px', marginTop: 8, lineHeight: 1.5 },
  quickRow: { display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6, marginBottom: 2 },
  quickBtn: { fontSize: 12, padding: '4px 9px', borderRadius: 6, border: '1px solid #d8d2c4', background: '#fffdf6', color: '#5b5346', cursor: 'pointer', lineHeight: 1.2 },
  picked: {
    marginTop: 8,
    fontSize: 12,
    padding: '6px 8px',
    borderRadius: 8,
    background: 'rgba(64,140,255,0.10)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
};

function toLocalInput(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    date.getFullYear() +
    '-' + pad(date.getMonth() + 1) +
    '-' + pad(date.getDate()) +
    'T' + pad(date.getHours()) +
    ':' + pad(date.getMinutes())
  );
}

function defaultAt() {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setSeconds(0, 0);
  return toLocalInput(d);
}

export function DeliverDialog(props) {
  const { note, sessions, busy, error, onClose, onInsert, onSchedule } = props;

  const [sessionId, setSessionId] = useState(props.initialSessionId ?? '');
  const [activeWs, setActiveWs] = useState(null);
  const [mode, setMode] = useState('insert');
  const [at, setAt] = useState(defaultAt);

  const all = Array.isArray(sessions) ? sessions : [];

  const groups = useMemo(() => {
    const map = new Map();
    for (const item of all) {
      const ws = item.workspace || '（未分工作区）';
      if (!map.has(ws)) map.set(ws, []);
      map.get(ws).push(item);
    }
    // 工作区按「最近活跃」排序：取组内最大 updatedAt
    const lastActiveOf = (list) => list.reduce((acc, x) => Math.max(acc, x.updatedAt || 0), 0);
    return Array.from(map, ([workspace, list]) => ({
      workspace,
      // 组内会话也按活跃时间降序
      list: list.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)),
      lastActive: lastActiveOf(list),
    })).sort((a, b) => b.lastActive - a.lastActive);
  }, [sessions]);

  const current = useMemo(() => all.find((x) => x.id === sessionId) || null, [sessions, sessionId]);

  const atMs = useMemo(() => {
    const ms = new Date(at).getTime();
    return Number.isFinite(ms) ? ms : NaN;
  }, [at]);

  // 「直接发送」走宿主 /insert，约 2 秒后把内容投递到目标会话
  const insertReady = true;
  const canSubmit =
    !busy &&
    sessionId !== '' &&
    (mode === 'schedule' ? Number.isFinite(atMs) && atMs > Date.now() : insertReady);

  // 为什么现在点不动：以前这里静默 return，用户只看到「点了没反应」。
  const blockReason = busy
    ? '正在发送，请稍候…'
    : sessionId === ''
      ? '请先选择一个目标会话'
      : mode === 'schedule' && !Number.isFinite(atMs)
        ? '发送时间无效——点下面的快捷按钮，或重新选一个时间'
        : mode === 'schedule' && atMs <= Date.now()
          ? '发送时间已经过去了，请重新选择'
          : '';

  // 快捷时间：串流 WebView 里原生 datetime 选择器常常弹不出来，
  // 拿不到值就会让上面那个 blockReason 一直挂着。给几个按钮兜底。
  function quickSet(minutes) {
    const d = new Date(Date.now() + minutes * 60 * 1000);
    d.setSeconds(0, 0);
    setAt(toLocalInput(d));
  }
  function quickTomorrow() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    setAt(toLocalInput(d));
  }

  function submit() {
    if (!canSubmit) return;
    if (mode === 'insert') onInsert({ note, session: current });
    else onSchedule({ note, session: current, at: atMs });
  }

  const activeGroup = groups.find((g) => g.workspace === activeWs) || null;

  return (
    <div style={s.mask} role="dialog" aria-label="发送便签到会话">
      <div style={s.card}>
        <div style={s.head}>
          <span>发送到会话</span>
          <button
            type="button"
            style={{ border: 'none', background: 'transparent', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}
            aria-label="关闭"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div style={s.body}>
          {activeGroup ? (
            <>
              <div style={s.label}>
                <button type="button" style={s.linkBtn} onClick={() => setActiveWs(null)}>
                  ← 返回工作区
                </button>
                <span style={{ marginLeft: 8, opacity: 0.7 }}>{activeGroup.workspace}</span>
              </div>
              <div style={s.list}>
                {activeGroup.list.map((item) => (
                  <div
                    key={item.id}
                    style={s.item(item.id === sessionId)}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSessionId(item.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') setSessionId(item.id);
                    }}
                  >
                    <span style={s.name}>{item.title}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div style={s.label}>
                选择工作区（{groups.length} 个工作区 / {all.length} 个会话）
              </div>
              {groups.length > 0 ? (
                <div style={s.list}>
                  {groups.map((group) => (
                    <div
                      key={group.workspace}
                      style={s.item(false)}
                      role="button"
                      tabIndex={0}
                      onClick={() => setActiveWs(group.workspace)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') setActiveWs(group.workspace);
                      }}
                    >
                      <span style={s.name}>{group.workspace}</span>
                      <span style={s.count}>{group.list.length}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ ...s.hint, padding: '10px 0' }}>
                  没读到会话列表。可能是当前页面还没加载会话，或摘要里没有可用字段。
                </div>
              )}
            </>
          )}

          {current ? (
            <div style={s.picked}>
              已选：{current.workspace} / {current.title}
            </div>
          ) : null}

          <div style={s.label}>发送方式</div>
          <div style={s.modes}>
            <button type="button" style={s.mode(mode === 'insert')} onClick={() => setMode('insert')}>
              <strong>直接发送</strong>
              <br />
              <span style={{ opacity: 0.7 }}>立刻发到该会话（约 2 秒）</span>
            </button>
            <button type="button" style={s.mode(mode === 'schedule')} onClick={() => setMode('schedule')}>
              <strong>定时发送</strong>
              <br />
              <span style={{ opacity: 0.7 }}>到点自动发到该会话</span>
            </button>
          </div>

          {mode === 'schedule' ? (
            <>
              <div style={s.label}>发送时间</div>
              <input
                type="datetime-local"
                style={s.input}
                value={at}
                onChange={(event) => setAt(event.target.value)}
              />
              <div style={s.quickRow}>
                <button type="button" style={s.quickBtn} onClick={() => quickSet(5)}>+5 分钟</button>
                <button type="button" style={s.quickBtn} onClick={() => quickSet(30)}>+30 分钟</button>
                <button type="button" style={s.quickBtn} onClick={() => quickSet(60)}>+1 小时</button>
                <button type="button" style={s.quickBtn} onClick={quickTomorrow}>明天 9:00</button>
              </div>
              <div style={s.hint}>
                {Number.isFinite(atMs)
                  ? '将在 ' + formatTimestamp(atMs) + ' 自动发送；卡片会显示 ⏰，可随时取消。'
                  : '上面的时间框没取到值——直接用快捷按钮。'}
              </div>
            </>
          ) : (
            <div style={s.hint}>点发送后约 2 秒，内容会作为一条消息发到该会话。</div>
          )}

          {error ? <div style={s.error}>{error}</div> : null}
          {blockReason ? <div style={s.block}>{blockReason}</div> : null}
        </div>

        <div style={s.foot}>
          <button type="button" style={s.btn(false)} onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            style={{ ...s.btn(true), opacity: canSubmit ? 1 : 0.5, cursor: canSubmit ? 'pointer' : 'not-allowed' }}
            onClick={submit}
          >
            {busy ? '处理中…' : mode === 'insert' ? '立即发送' : '定时发送'}
          </button>
        </div>
      </div>
    </div>
  );
}
