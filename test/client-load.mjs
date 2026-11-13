#!/usr/bin/env node
/**
 * Client-bundle load check without a browser.
 *
 * Mocks the shell's `window.__ModuleLoader__`, `document`, `react` and the
 * slots package, evaluates lib/client.js, then calls `apply(fakeCtx)` and
 * asserts the three slot registrations (main / sidebar.panellist /
 * shell.overlay) and the injected stylesheet.
 *
 * Run: node test/client-load.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

let failures = 0;
function check(label, condition, extra) {
  const ok = Boolean(condition);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok || extra === undefined ? '' : ` → ${JSON.stringify(extra)}`}`);
  if (!ok) failures += 1;
}

/* ------------------------------------------------------------ DOM mock */

const styleTags = [];
const headChildren = [];

const documentMock = {
  hidden: false,
  head: {
    appendChild(node) {
      headChildren.push(node);
      return node;
    },
  },
  body: { appendChild() {} },
  getElementById(id) {
    return styleTags.find((tag) => tag.id === id) ?? null;
  },
  createElement(tag) {
    const element = { tagName: String(tag).toUpperCase(), id: '', textContent: '', style: {} };
    if (tag === 'style') styleTags.push(element);
    return element;
  },
  addEventListener() {},
  removeEventListener() {},
};

/* -------------------------------------------------------- React mock */

const ReactMock = {
  createElement(type, props, ...children) {
    return { type, props: { ...(props ?? {}), children } };
  },
  Fragment: Symbol('Fragment'),
  useState(initial) {
    return [typeof initial === 'function' ? initial() : initial, () => {}];
  },
  useEffect() {},
  useMemo(factory) {
    return factory();
  },
  useCallback(fn) {
    return fn;
  },
  useReducer(_reducer, initial) {
    return [initial, () => {}];
  },
  useRef(value) {
    return { current: value };
  },
  useContext() {
    return {};
  },
  memo(component) {
    return component;
  },
};

const moduleTable = {
  react: ReactMock,
  'react/jsx-runtime': {
    jsx: (type, props) => ({ type, props }),
    jsxs: (type, props) => ({ type, props }),
    Fragment: Symbol('Fragment'),
  },
  'react-dom': { createPortal: (node) => node },
  'react-dom/client': { createRoot: () => ({ render() {}, unmount() {} }) },
  '@deepseek-ai/dsh-client-ui-slots': {},
};

/* --------------------------------------------------------- shell mock */

const registrations = [];
let loadId = null;

globalThis.window = {
  __ModuleLoader__: {
    load({ id, factory }) {
      loadId = id;
      const requireShim = (name) => {
        if (!(name in moduleTable)) throw new Error(`unexpected require: ${name}`);
        return moduleTable[name];
      };
      globalThis.__loaded = factory(requireShim);
    },
  },
  addEventListener() {},
  removeEventListener() {},
  confirm: () => true,
  fetch: async () => ({ ok: true, status: 200, json: async () => ({}) }),
};
globalThis.document = documentMock;
globalThis.headChildren = headChildren;

const source = readFileSync(join(ROOT, 'lib/client.js'), 'utf8');
/* eslint-disable-next-line no-new-func */
new Function('window', 'document', 'globalThis', source)(globalThis.window, documentMock, globalThis);

const loaded = globalThis.__loaded;
check('bundle registers under its package name', loadId === 'dsh-notewall', loadId);
check('module exports apply', typeof loaded?.apply === 'function', Object.keys(loaded ?? {}));
check('default export carries apply', typeof loaded?.default?.apply === 'function');
// 2026-11-03 事故的直接原因：启动器只读 module.exports.default，必须带 inject。
check(
  'default export carries inject (启动器只读这一层)',
  Array.isArray(loaded?.default?.inject) && loaded.default.inject.includes('slots'),
  loaded?.default?.inject,
);
check(
  'artifact keeps the factory failure guard',
  source.includes('__dshStickyFactoryError') && source.includes('return { apply: function () {}, inject: [] };'),
);
check('exports page component', typeof loaded?.StickyWallPage === 'function');
check('exports alarm dock', typeof loaded?.AlarmDock === 'function');
check('exports sidebar icon', typeof loaded?.StickyWallIcon === 'function');

/* ------------------------------------------------------- apply(fakeCtx) */

let effects = 0;
const fakeCtx = {
  effect(factory) {
    effects += 1;
    const disposer = factory();
    return typeof disposer === 'function' ? disposer : () => {};
  },
  slots: {
    inject(target, factory) {
      factory();
    },
    register(options, Component) {
      registrations.push({ options, Component });
      return () => {};
    },
  },
  layout: { selectPanel() {} },
};

loaded.apply(fakeCtx);

const bySlot = (name) => registrations.filter((entry) => entry.options?.name === name);
check('registered main panel', bySlot('main').length === 1 && bySlot('main')[0].options.key === 'sticky-wall');
check('registered sidebar entry', bySlot('sidebar.panellist').length === 1);
check('sidebar entry has id + label', (() => {
  const entry = bySlot('sidebar.panellist')[0]?.options;
  // 文案走 i18n：node 环境没有 navigator，会落到英文；两种都接受。
  const label = typeof entry?.label === 'function' ? entry.label() : null;
  return entry?.id === 'sticky-wall' && ['便签墙', 'Sticky Wall'].includes(label);
})());
check('registered overlay dock', bySlot('shell.overlay').length === 1);
check('all registrations carry a component', registrations.every((entry) => typeof entry.Component === 'function'));
check('stylesheet injected once', styleTags.length === 1 && headChildren.length === 1);
check('stylesheet has a body', styleTags[0]?.textContent.includes('.sw-card'));
check('effects registered', effects >= 2, effects);

// Idempotent style injection: calling apply again must not append a second <style>.
loaded.apply(fakeCtx);
check('styles not duplicated on re-apply', styleTags.length === 1, styleTags.length);
// 5 个 slot（main / sidebar.panellist / shell.overlay / header.quick-draft /
// sidebar.right.pane.tab / .title）× apply 两次 = 12。
// 数量变了先确认是不是新增了插槽，再改这里，别直接放宽断言。
check('re-apply registers another set (expected: ctx owns disposal)', registrations.length === 12, registrations.length);

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
