/**
 * 会话头部的草稿按钮拿不到墙面板那套 actions（slot 的 inject 没有传到组件 props），
 * 而 index.js 与 quick-draft.js 在同一个 client bundle 里，
 * 所以用模块级对象做最小桥接：apply 启动时写入，组件渲染时读取。
 */
export const deliverBridge = {
  listSessions: null,
  insertToSession: null,
  scheduleToSession: null,
};

export function bindDeliver(actions) {
  if (actions === null || typeof actions !== 'object') return;
  deliverBridge.listSessions = actions.listSessions ?? null;
  deliverBridge.insertToSession = actions.insertToSession ?? null;
  deliverBridge.scheduleToSession = actions.scheduleToSession ?? null;
}
