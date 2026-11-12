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
import { t } from './strings.js';

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
  peakOff: { fontSize: 12, color: '#2f6b45', background: '#eef8f1', border: '1px solid #b9dfc9', borderRadius: 6, padding: '5px 8px', marginTop: 8, lineHeight: 1.4 },
  peakOn: { fontSize: 12, color: '#8a5a1f', background: '#fff8e6', border: '1px solid #ffdfa0', borderRadius: 6, padding: '5px 8px', marginTop: 8, lineHeight: 1.4 },
  block: { fontSize: 12, color: '#8a6d1f', background: '#fff8e1', border: '1px solid #ffe0a3', borderRadius: 6, padding: '6px 8px', marginTop: 8, lineHeight: 1.5 },
  quickRow: { display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6, marginBottom: 2 },
  quickBtn: { fontSize: 12, padding: '4px 9px', borderRadius: 6, border: '1px solid #d8d2c4', background: '#fffdf6', color: '#5b5346', cursor: 'pointer', lineHeight: 1.2 },
  quickBtnOff: { fontSize: 12, padding: '4px 9px', borderRadius: 6, border: '1px solid #e8e4da', background: '#f5f3ee', color: '#b0aa9e', cursor: 'not-allowed', lineHeight: 1.2 },
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

/**
 * DeepSeek 官方定价的时段判定（2026-11 版）：
 *   北京时间周一至周五（不含中国法定节假日）9:00-12:00、14:00-18:00 = 高峰
 *   其余全部（午间 12-14、夜间、周末、法定节假日）= 空闲（价格减半）
 * 法定节假日没有本地日历可查，这里只按周末 + 工作日时段判断。
 */
function isOffPeak(date) {
  const day = date.getDay(); // 0=周日, 6=周六
  if (day === 0 || day === 6) return true;
  const hours = date.getHours() + date.getMinutes() / 60;
  const isPeak = (hours >= 9 && hours < 12) || (hours >= 14 && hours < 18);
  return !isPeak;
}

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
      const ws = item.workspace || t('deliver.noWorkspace');
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
    ? t('deliver.busy')
    : sessionId === ''
      ? t('deliver.needSession')
      : mode === 'schedule' && !Number.isFinite(atMs)
        ? t('deliver.timeMalformed')
        : mode === 'schedule' && atMs <= Date.now()
          ? t('deliver.timePast')
          : '';

  // 快捷时间：串流 WebView 里原生 datetime 选择器常常弹不出来，
  // 拿不到值就会让上面那个 blockReason 一直挂着。给几个按钮兜底。
  function quickSet(minutes) {
    const d = new Date(Date.now() + minutes * 60 * 1000);
    d.setSeconds(0, 0);
    setAt(toLocalInput(d));
  }
  /** 今天的某个整点（本地时区）。 */
  function todayAt(hour) {
    const d = new Date();
    d.setHours(hour, 0, 0, 0);
    return d;
  }
  function quickToday(hour) {
    setAt(toLocalInput(todayAt(hour)));
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
    <div style={s.mask} role="dialog" aria-label={t('deliver.ariaSend')}>
      <div style={s.card}>
        <div style={s.head}>
          <span>{t('deliver.title')}</span>
          <button
            type="button"
            style={{ border: 'none', background: 'transparent', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}
            aria-label={t('deliver.ariaClose')}
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div style={s.body}>
          <div style={s.label}>{t('deliver.sessionDelay')}</div>
          {activeGroup ? (
            <>
              <div style={s.label}>
                <button type="button" style={s.linkBtn} onClick={() => setActiveWs(null)}>
                  {t('deliver.back')}
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
                {t('deliver.pickWorkspace', { workspaces: groups.length, sessions: all.length })}
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
                  {t('deliver.noSessions')}
                </div>
              )}
            </>
          )}

          {current ? (
            <div style={s.picked}>
              {t('deliver.current', { workspace: current.workspace, title: current.title })}
            </div>
          ) : null}

          <div style={s.label}>{t('deliver.mode')}</div>
          <div style={s.modes}>
            <button type="button" style={s.mode(mode === 'insert')} onClick={() => setMode('insert')}>
              <strong>{t('deliver.modeInsert')}</strong>
              <br />
              <span style={{ opacity: 0.7 }}>{t('deliver.modeInsertHint')}</span>
            </button>
            <button type="button" style={s.mode(mode === 'schedule')} onClick={() => setMode('schedule')}>
              <strong>{t('deliver.modeSchedule')}</strong>
              <br />
              <span style={{ opacity: 0.7 }}>{t('deliver.modeScheduleHint')}</span>
            </button>
          </div>

          {mode === 'schedule' ? (
            <>
              <div style={s.label}>{t('deliver.timeLabel')}</div>
              <input
                type="datetime-local"
                style={s.input}
                value={at}
                onChange={(event) => setAt(event.target.value)}
              />
              <div style={s.quickRow}>
                {(() => {
                  const now = Date.now();
                  const items = [
                    { label: t('deliver.quick5'), run: () => quickSet(5) },
                    { label: t('deliver.quick30'), run: () => quickSet(30) },
                    { label: t('deliver.quick60'), run: () => quickSet(60) },
                    // 12:00 / 18:00 是 DeepSeek 定价里的时段分界点。
                    { label: t('deliver.quickNoon'), run: () => quickToday(12), at: todayAt(12).getTime() },
                    { label: t('deliver.quickEvening'), run: () => quickToday(18), at: todayAt(18).getTime() },
                    { label: t('deliver.quickTomorrow'), run: quickTomorrow },
                  ];
                  return items.map((item) => {
                    // 今天已经过去的整点：直接禁用，别让用户选到一个必然被拒的时间。
                    const past = typeof item.at === 'number' && now >= item.at;
                    return (
                      <button
                        key={item.label}
                        type="button"
                        style={past ? s.quickBtnOff : s.quickBtn}
                        disabled={past}
                        title={past ? t('deliver.quickPastTitle') : undefined}
                        onClick={item.run}
                      >
                        {item.label}
                        {past ? t('deliver.quickPast') : ''}
                      </button>
                    );
                  });
                })()}
              </div>
              <div style={s.hint}>
                {t('deliver.ruleNote')}
              </div>
              <div style={s.hint}>
                {Number.isFinite(atMs)
                  ? t('deliver.timeWillSend', { time: formatTimestamp(atMs) })
                  : t('deliver.timeNoValue')}
              </div>
              {Number.isFinite(atMs) && mode === 'schedule' ? (
                <div style={isOffPeak(new Date(atMs)) ? s.peakOff : s.peakOn}>
                  {isOffPeak(new Date(atMs))
                    ? t('deliver.offPeak')
                    : t('deliver.onPeak')}
                </div>
              ) : null}
            </>
          ) : (
            <div style={s.hint}>{t('deliver.insertHint')}</div>
          )}

          {error ? <div style={s.error}>{error}</div> : null}
          {blockReason ? <div style={s.block}>{blockReason}</div> : null}
        </div>

        <div style={s.foot}>
          <button type="button" style={s.btn(false)} onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            style={{ ...s.btn(true), opacity: canSubmit ? 1 : 0.5, cursor: canSubmit ? 'pointer' : 'not-allowed' }}
            onClick={submit}
          >
            {busy ? t('deliver.submitBusy') : mode === 'insert' ? t('deliver.submitInsert') : t('deliver.submitSchedule')}
          </button>
        </div>
      </div>
    </div>
  );
}
