#!/usr/bin/env node
/**
 * Trust-fence check: the plugin asks the kernel's `connection` service for a
 * rejection before it touches any route.
 *
 * This exists because the whole plugin is one `prefix` handler over
 * `/sticky-wall` — notes, media bytes, and a route that delivers a prompt into
 * an arbitrary session all share it. If the fence is missing or sits after a
 * route branch, an unauthenticated caller reads everything and can post into
 * any conversation.
 *
 * Run: node test/trust-fence.mjs
 */
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../lib/store.js';
import { createHandler } from '../lib/index.js';

let failures = 0;
function check(label, condition, extra) {
  const ok = Boolean(condition);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok || extra === undefined ? '' : ` → ${JSON.stringify(extra)}`}`);
  if (!ok) failures += 1;
}

/**
 * Boot one handler over a throwaway root. `connection` starts at
 * `initialConnection` and can be swapped later — the handler reads it per
 * request, exactly like `apply()` does against the live service.
 */
async function boot(initialConnection) {
  const root = await mkdtemp(join(tmpdir(), 'sticky-wall-fence-'));
  const store = createStore({ root });
  let connection = initialConnection;
  const handler = createHandler(store, {
    allowLocalOnly: false,
    getConnection: () => connection,
  });
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    store,
    setConnection(next) {
      connection = next;
    },
    async get(path) {
      const response = await fetch(base + path);
      return { status: response.status, text: await response.text() };
    },
    async post(path, body) {
      const response = await fetch(base + path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      });
      return { status: response.status, text: await response.text() };
    },
    async close() {
      await new Promise((resolve) => server.close(resolve));
      await rm(root, { recursive: true, force: true });
    },
  };
}

// ---- 1. No connection service: legacy behaviour, routes still work --------
{
  const app = await boot(null);
  const state = await app.get('/sticky-wall/state');
  check('no connection → GET /state still 200', state.status === 200);
  check('no connection → state is real JSON', state.text.includes('"doc"'));
  await app.close();
}

// ---- 2. Rejected 401 on a store that really holds a note ----------------
{
  const app = await boot(null);
  const created = await app.post('/sticky-wall/note', {
    op: 'create',
    text: 'top-secret-note',
    color: '#fff3a3',
  });
  check('seed note created before the fence goes up', created.status === 200, created.status);

  // Same server, same store — only the service verdict changes.
  app.setConnection({ requestRejection: () => 401 });

  const state = await app.get('/sticky-wall/state');
  check('401 → GET /state is 401', state.status === 401, state.status);
  check('401 → body says unauthorized', state.text.trim() === 'unauthorized', state.text);
  check('401 → seeded note not leaked', !state.text.includes('top-secret-note') && !state.text.includes('"doc"'));

  const ping = await app.get('/sticky-wall/ping');
  check('401 → GET /ping is 401 too', ping.status === 401, ping.status);

  const media = await app.get('/sticky-wall/media/whatever.png');
  check('401 → GET /media/* is 401 (fence precedes the byte route)', media.status === 401, media.status);

  const note = await app.post('/sticky-wall/note', { op: 'create', text: 'x' });
  check('401 → POST /note is 401', note.status === 401, note.status);

  const deliver = await app.post('/sticky-wall/deliver', {
    noteId: 'n_x',
    sessionId: 'session-x',
    at: Date.now() + 600000,
    prompt: 'injected',
  });
  check('401 → POST /deliver is 401 (prompt injection blocked)', deliver.status === 401, deliver.status);
  await app.close();
}

// ---- 3. Rejected 403: distinguishable from 401 ---------------------------
{
  const app = await boot({ requestRejection: () => 403 });
  const state = await app.get('/sticky-wall/state');
  check('403 → GET /state is 403', state.status === 403, state.status);
  check('403 → body says forbidden', state.text.trim() === 'forbidden', state.text);
  await app.close();
}

// ---- 4. Allowed: rejection `undefined` lets the request through ---------
{
  const app = await boot({ requestRejection: () => undefined });
  const state = await app.get('/sticky-wall/state');
  check('undefined rejection → GET /state 200', state.status === 200, state.status);

  const created = await app.post('/sticky-wall/note', {
    op: 'create',
    text: 'fenced',
    color: '#fff3a3',
  });
  check('undefined rejection → POST /note 200', created.status === 200, created.status);
  const body = JSON.parse(created.text);
  check('undefined rejection → note actually stored', Boolean(body.note?.id), body);
  await app.close();
}

// ---- 5. The fence is consulted on every request, not cached -------------
{
  let verdict;
  const calls = [];
  const app = await boot({
    requestRejection: () => {
      calls.push(verdict);
      return verdict;
    },
  });
  verdict = undefined;
  const first = await app.get('/sticky-wall/ping');
  verdict = 401;
  const second = await app.get('/sticky-wall/ping');
  verdict = undefined;
  const third = await app.get('/sticky-wall/ping');
  check(
    'fence is re-consulted per request (allow → deny → allow)',
    first.status === 200 && second.status === 401 && third.status === 200,
    { first: first.status, second: second.status, third: third.status },
  );
  check('fence consulted exactly once per request', calls.length === 3, calls);
  await app.close();
}

console.log();
if (failures === 0) {
  console.log('ALL PASS trust-fence');
} else {
  console.log(`${failures} FAILED trust-fence`);
  process.exitCode = 1;
}
