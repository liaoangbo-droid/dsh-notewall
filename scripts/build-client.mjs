#!/usr/bin/env node
/**
 * Build the dsh-notewall client bundle.
 *
 * Produces lib/client.js in the exact wire format the DSH Web shell expects:
 * a CJS factory handed to `window.__ModuleLoader__.load({ id, factory })`,
 * with `id` equal to the loader entry `name` (== package.json `name`).
 * Platform modules (`react`, the slots package, …) resolve through the
 * injected `require`; everything else is inlined.
 *
 * JSX is allowed in every `client/**.js` file: the loader map below turns
 * `.js` into `jsx` so this package needs no separate extension convention.
 *
 * esbuild is resolved from this package's node_modules first, then from the
 * sibling dsh-whale-girl install on this machine. No runtime deps.
 *
 * Usage: node scripts/build-client.mjs
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

/** Registration id — must equal the cordis.patch.yml row `name`. */
const PLUGIN_ID = MANIFEST.name;

/**
 * Platform module table. These resolve through the shell's module registry;
 * anything else is bundled in.
 */
const EXTERNALS = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  'cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-runtime',
];

/** Resolve esbuild from this package, the whale-girl install, or a DSH checkout. */
function resolveEsbuild() {
  const candidates = [
    join(ROOT, 'node_modules/esbuild/package.json'),
    join(homedir(), '.dsh/OurWhaleGirl/node_modules/esbuild/package.json'),
  ];
  const checkout = process.env.DSH_SOURCE ?? join(homedir(), '.dsh/source/current');
  const store = join(checkout, 'node_modules/.pnpm');
  if (existsSync(store)) {
    for (const entry of readdirSync(store).filter((n) => n.startsWith('esbuild@')).sort().reverse()) {
      candidates.push(join(store, entry, 'node_modules/esbuild/package.json'));
    }
  }
  candidates.push(join(checkout, 'node_modules/esbuild/package.json'));
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error('esbuild not found: install it here or point DSH_SOURCE at a DSH checkout');
}

const require = createRequire(import.meta.url);
const esbuild = require(resolveEsbuild().replace(/[\\/]package\.json$/, ''));

/**
 * Factory-body wrappers.
 *
 * The `try` is deliberate and must stay in the ARTIFACT: if the module body
 * itself throws (a bad import, a top-level typo, an incompatible host module),
 * an unguarded factory turns the whole DSH Web GUI into "Failed to load
 * plugins" — boot treats any non-activated client entry as fatal. Returning an
 * inert `{ apply, inject: [] }` keeps the entry ACTIVATE-able and the rest of
 * the app usable.
 *
 * The catch reports through the host diag route; client-side errors are
 * invisible in kernel.log, so without this channel there is no evidence trail.
 */
const DIAG_REPORT = [
  'function __dshStickyReport(where, error) {',
  '  try { console.error("[dsh-notewall] " + where + " failed:", error); } catch (_) {}',
  '  try {',
  '    if (typeof fetch !== "function") return;',
  '    var text = String((error && (error.stack || error.message)) || error || "unknown").slice(0, 4000);',
  '    void fetch("/sticky-wall/__diag?where=" + encodeURIComponent(where) + "&msg=" + encodeURIComponent(text), { cache: "no-store" }).catch(function () {});',
  '  } catch (_) {}',
  '}',
].join('\n');

const banner = [
  DIAG_REPORT,
  `window.__ModuleLoader__.load({ id: ${JSON.stringify(PLUGIN_ID)}, factory: (require) => {`,
  'try {',
  'var module = { exports: {} }; var exports = module.exports;',
].join('\n');

const footer = [
  'return module.exports;',
  '} catch (__dshStickyFactoryError) {',
  '  __dshStickyReport("factory", __dshStickyFactoryError);',
  '  return { apply: function () {}, inject: [] };',
  '} } });',
].join('\n');

await esbuild.build({
  entryPoints: [join(ROOT, 'client/index.js')],
  outfile: join(ROOT, 'lib/client.js'),
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  external: EXTERNALS,
  loader: { '.js': 'jsx' },
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  banner: { js: banner },
  footer: { js: footer },
  legalComments: 'none',
});

const bytes = readFileSync(join(ROOT, 'lib/client.js')).length;
console.log(`lib/client.js built (id=${PLUGIN_ID}, ${bytes} bytes)`);
