#!/usr/bin/env node
/**
 * Host-half end-to-end check: boots the real HTTP handler over a temp data
 * root and drives every route the browser half uses.
 *
 * Run: node test/host-e2e.mjs
 */
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStore } from '../lib/store.js';
import { createHandler } from '../lib/index.js';

const root = await mkdtemp(join(tmpdir(), 'sticky-wall-e2e-'));
const store = createStore({ root });
const handler = createHandler(store, { allowLocalOnly: false });

const server = createServer(handler);
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

let failures = 0;
function check(label, condition, extra) {
  const ok = Boolean(condition);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok || extra === undefined ? '' : ` → ${JSON.stringify(extra)}`}`);
  if (!ok) failures += 1;
}

async function get(path) {
  const response = await fetch(base + path);
  return { status: response.status, body: await response.json() };
}

async function post(path, body) {
  const response = await fetch(base + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

try {
  // 1. Empty state
  const empty = await get('/sticky-wall/state');
  check('GET /state 200', empty.status === 200);
  check('empty wall has no notes', empty.body.doc?.notes?.length === 0, empty.body);
  check('state carries palette + defaults', Array.isArray(empty.body.palette) && empty.body.defaults?.columns === 3);
  const rev0 = empty.body.rev;

  // 2. Incremental poll: nothing changed
  const same = await get(`/sticky-wall/state?since=${rev0}`);
  check('since=current → changed:false', same.body.changed === false, same.body);

  // 3. Create
  const created = await post('/sticky-wall/note', {
    op: 'create',
    text: '第一条想法\n第二行',
    color: '#fff3a3',
    alarmAt: Date.now() + 60_000,
  });
  check('POST create ok', created.body.ok === true, created.body);
  const id = created.body.note?.id;
  check('create assigned id', typeof id === 'string' && id.startsWith('n_'), id);
  check('create derived title', created.body.note?.title === '第一条想法', created.body.note?.title);
  const rev1 = created.body.rev;
  check('rev advanced', rev1 > rev0, { rev0, rev1 });

  // 4. Incremental poll returns the document
  const changed = await get(`/sticky-wall/state?since=${rev0}`);
  check('since=old → changed:true + doc', changed.body.changed === true && changed.body.doc?.notes?.length === 1);

  // 5. Update: pin + colour + html sanitising
  const updated = await post('/sticky-wall/note', {
    op: 'update',
    id,
    html: '<p>改了 <b>加粗</b></p><script>alert(1)</script><img src=x onerror=alert(2)>',
    pinned: true,
    color: '#ffcdd2',
  });
  check('update ok', updated.body.ok === true);
  const doc = (await get('/sticky-wall/state')).body.doc;
  const note = doc.notes[0];
  check('update applied html', note.html.includes('<b>加粗</b>'), note.html);
  check('script stripped', !/script/i.test(note.html), note.html);
  check('onerror stripped', !/onerror/i.test(note.html), note.html);
  check('update applied pinned/colour', note.pinned === true && note.color === '#ffcdd2');

  // 6. Wall settings
  const wall = await post('/sticky-wall/wall', {
    patch: { columns: 99, cardWidth: 10, bg: { kind: 'color', color: '#112233' } },
  });
  check('wall update ok', wall.body.ok === true);
  const wall2 = (await get('/sticky-wall/state')).body.doc.wall;
  check('columns clamped to 8', wall2.columns === 8, wall2.columns);
  check('cardWidth clamped to 160', wall2.cardWidth === 160, wall2.cardWidth);
  check('bg colour kept', wall2.bg.color === '#112233' && wall2.bg.kind === 'color');

  // 7. Media upload + read
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const media = await post('/sticky-wall/media', { dataUrl: png });
  check('media upload ok', media.body.ok === true && media.body.url.includes('/sticky-wall/media/'), media.body);
  const mediaResponse = await fetch(base + media.body.url);
  check('media GET 200', mediaResponse.status === 200);
  check('media content-type png', mediaResponse.headers.get('content-type') === 'image/png');
  const bytes = Buffer.from(await mediaResponse.arrayBuffer());
  check('media bytes round-trip', bytes.length === media.body.bytes, { got: bytes.length, want: media.body.bytes });

  const badMedia = await post('/sticky-wall/media', { dataUrl: 'data:text/html;base64,PGgxPg==' });
  check('non-image media rejected', badMedia.status === 500, badMedia);

  // 8. Reorder
  const second = await post('/sticky-wall/note', { op: 'create', text: '第二条' });
  const id2 = second.body.note?.id;
  const reordered = await post('/sticky-wall/note', { op: 'reorder', ids: [id2, id] });
  check('reorder ok', reordered.body.ok === true);
  const ordered = (await get('/sticky-wall/state')).body.doc.notes;
  // 置顶优先，所以 id 仍然排第一
  check('pinned note still first', ordered[0].id === id, ordered.map((n) => n.id));

  // 9. Alarm ack
  const ack = await post('/sticky-wall/alarm/ack', { id });
  check('alarm ack ok', ack.body.ok === true);
  const acked = (await get('/sticky-wall/state')).body.doc.notes.find((n) => n.id === id);
  check('alarmFiredAt set', Number.isFinite(acked.alarmFiredAt), acked.alarmFiredAt);

  // 10. Delete
  const deleted = await post('/sticky-wall/note', { op: 'delete', id: id2 });
  check('delete ok', deleted.body.ok === true);
  check('one note left', (await get('/sticky-wall/state')).body.doc.notes.length === 1);

  // 11. Bad input
  const missing = await post('/sticky-wall/note', { op: 'update' });
  check('update without id → 400', missing.status === 400, missing);
  const unknown = await post('/sticky-wall/note', { op: 'nope' });
  check('unknown op → 400', unknown.status === 400);
  const notFound = await get('/sticky-wall/nothing');
  check('unknown route → 404', notFound.status === 404);

  // 12. Persistence across a fresh store instance (same root)
  const reopened = createStore({ root });
  const persisted = await reopened.snapshot();
  check('data survives new store instance', persisted.notes.length === 1 && persisted.wall.columns === 8);

  // 13. Loopback guard
  const guarded = createHandler(store, { allowLocalOnly: true });
  check('loopback guard accepts 127.0.0.1', typeof guarded === 'function');

  console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
} finally {
  await new Promise((resolve) => server.close(resolve));
  await rm(root, { recursive: true, force: true });
}

process.exit(failures === 0 ? 0 : 1);
