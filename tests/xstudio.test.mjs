// node --test tests/ — X Studio: X weighted length (URLs = 23), threads, schedule, update → post, queue API.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { handleXQueue, memoryQueueStore, sanitizeDraft, mergeDrafts, markPosted, LIMITS } from '../server/xqueue.js';
import { signToken } from '../server/owner.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'xstudio-'));
const entry = join(dir, 'entry.ts');
writeFileSync(entry, ['xtext', 'schedule', 'compose'].map((m) => `export * from ${JSON.stringify(join(root, 'src/features/owner/xstudio', m + '.ts'))};`).join('\n'));
const outfile = join(dir, 'x.mjs');
buildSync({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'neutral', outfile, logLevel: 'error', loader: { '.json': 'json' } });
const X = await import(pathToFileURL(outfile).href);

/* ------------------------------ text length ------------------------------ */
test('xLength: plain ASCII counts 1 per char', () => {
  assert.equal(X.xLength('hello'), 5);
  assert.equal(X.xLength(''), 0);
  assert.equal(X.xLength('a'.repeat(280)), 280);
  assert.equal(X.fitsX('a'.repeat(280)), true);
  assert.equal(X.fitsX('a'.repeat(281)), false);
});

test('xLength: every URL counts as 23 regardless of length', () => {
  assert.equal(X.xLength('https://poltok.netlify.app/updates?utm_source=x&utm_medium=social&utm_campaign=update-v1-0#v1-0'), 23);
  assert.equal(X.xLength('https://x.co'), 23);
  assert.equal(X.xLength('see https://a.com/x and https://b.com/y'), 4 + 23 + 5 + 23);
  // bare domains are auto-linked by X too
  assert.equal(X.xLength('poltok.netlify.app/live'), 23);
  // trailing punctuation is not part of the link
  assert.equal(X.xLength('Go: https://poltok.netlify.app/live.'), 4 + 23 + 1);
  assert.deepEqual(X.findUrls('a https://poltok.netlify.app/live, b'), ['https://poltok.netlify.app/live']);
});

test('xLength: emoji count 2 (incl. ZWJ sequences and flags), CJK counts 2', () => {
  assert.equal(X.xLength('🚨'), 2);
  assert.equal(X.xLength('🇳🇿'), 2);
  assert.equal(X.xLength('👩‍👩‍👧‍👦'), 2);
  assert.equal(X.xLength('选举'), 4);
  assert.equal(X.xLength('é'), 1);
  assert.equal(X.xLength('—'), 1); // general punctuation is light
  assert.equal(X.xLength('🚨 CALL'), 2 + 5);
});

test('assemblePost: body trimmed so body + hashtags + link always fit 280', () => {
  const url = 'https://poltok.netlify.app/updates?utm_source=x#x';
  const p = X.assemblePost('word '.repeat(120), { tags: ['PolTok', '#auspol', 'PolTok'], url });
  assert.ok(X.xLength(p) <= 280, String(X.xLength(p)));
  assert.ok(p.endsWith(`#PolTok #auspol\n${url}`));
  assert.ok(p.includes('…'));
  const short = X.assemblePost('Hi', { tags: ['A'], url });
  assert.equal(short, `Hi\n#A\n${url}`);
});

test('splitThread: numbered posts that each fit', () => {
  const text = Array.from({ length: 30 }, (_, i) => `Sentence number ${i} explains one more thing about the release.`).join(' ');
  const posts = X.splitThread(text);
  assert.ok(posts.length > 1);
  posts.forEach((p, i) => {
    assert.ok(X.xLength(p) <= 280, `post ${i} is ${X.xLength(p)}`);
    assert.ok(p.endsWith(`${i + 1}/${posts.length}`));
  });
  assert.deepEqual(X.splitThread('short'), ['short']);
});

test('utmUrl adds utm_source=x only to PolTok links; intent url', () => {
  const u = X.utmUrl('https://poltok.netlify.app/live', 'live-calls');
  assert.match(u, /utm_source=x/);
  assert.match(u, /utm_campaign=live-calls/);
  assert.equal(X.utmUrl('https://example.com/a'), 'https://example.com/a');
  const i = X.xIntentUrl('Hello & bye', 'https://poltok.netlify.app/');
  assert.ok(i.startsWith('https://x.com/intent/post?'));
  assert.equal(new URL(i).searchParams.get('text'), 'Hello & bye');
  assert.deepEqual(X.intentParts('Text\nhttps://p.app/x', 'https://p.app/x'), { text: 'Text', url: 'https://p.app/x' });
});

/* ------------------------------ updates → posts ------------------------------ */
const upd = (id, extra = {}) => ({ id, title: `Feature ${id}`, date: '2026-11-08T09:00:00Z', categories: ['New'], body: 'Intro line.\n- **Alpha** shipped\n- Beta fixed', ...extra });
test('postsForUpdates: single update → one post ≤ 280 with link and hashtags', () => {
  const { posts, url } = X.postsForUpdates([upd('a', { version: 'v1.1' })]);
  assert.equal(posts.length, 1);
  assert.ok(X.xLength(posts[0]) <= 280);
  assert.ok(posts[0].includes(url));
  assert.match(url, /utm_source=x/);
  assert.match(posts[0], /#PolTok/);
  assert.match(posts[0], /Alpha shipped/); // markdown stripped
});
test('postsForUpdates: long update → thread; several → numbered roundup', () => {
  const long = upd('b', { body: 'Intro.\n' + Array.from({ length: 12 }, (_, i) => `- Item ${i} with quite a long description of what changed for users`).join('\n') });
  const t = X.postsForUpdates([long]).posts;
  assert.ok(t.length > 1);
  t.forEach((p) => assert.ok(X.xLength(p) <= 280, String(X.xLength(p))));
  const many = X.postsForUpdates([upd('c'), upd('d'), upd('e')]).posts;
  assert.equal(many.length, 4);
  assert.match(many[0], /3 updates/);
  many.forEach((p, i) => { assert.ok(X.xLength(p) <= 280); assert.ok(p.endsWith(`${i + 1}/4`)); });
});
test('draftForUpdates + updatesSince', () => {
  const d = X.draftForUpdates([upd('a')], 'announce', 1000);
  assert.equal(d.status, 'draft');
  assert.equal(d.card.kind, 'announcement');
  assert.deepEqual(d.source, { type: 'update', ids: ['a'] });
  assert.ok(d.alt.length > 10);
  const list = [upd('old', { date: '2026-01-01T00:00:00Z' }), upd('new'), upd('hidden', { draft: true })];
  assert.deepEqual(X.updatesSince(list, Date.parse('2026-06-01')).map((p) => p.id), ['new']);
});

/* ------------------------------ schedule ------------------------------ */
test('zonedTs / suggestSlots in ET and AEDT', () => {
  const ts = X.zonedTs(2026, 11, 10, 8, 30, 'America/New_York');
  assert.equal(new Date(ts).toISOString(), '2026-11-10T13:30:00.000Z'); // EST = UTC-5
  const syd = X.zonedTs(2026, 11, 11, 7, 30, 'Australia/Sydney');
  assert.equal(new Date(syd).toISOString(), '2026-11-10T20:30:00.000Z'); // AEDT = UTC+11
  const now = Date.parse('2026-11-10T12:00:00Z');
  const slots = X.suggestSlots(now, 6);
  assert.equal(slots.length, 6);
  for (let i = 1; i < slots.length; i++) assert.ok(slots[i].ts > slots[i - 1].ts);
  assert.ok(slots.every((s) => s.ts > now));
  assert.match(X.fmtBoth(ts), /EST.*AEDT/);
  const skip = X.suggestSlots(now, 6, [slots[0].ts]);
  assert.notEqual(skip[0].ts, slots[0].ts);
});

/* ------------------------------ queue API ------------------------------ */
const env = { OWNER_SECRET: 'test-secret' };
const tok = signToken('dicky', env).token;
const req = (method, path, body, auth = true) =>
  new Request('http://localhost' + path, { method, headers: { 'content-type': 'application/json', ...(auth ? { authorization: `Bearer ${tok}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
const draft = (id, extra = {}) => ({ id, title: 'T ' + id, posts: ['Hello https://poltok.netlify.app/'], url: 'https://poltok.netlify.app/?utm_source=x', hashtags: ['#PolTok'], alt: 'alt', designId: 'broadcast', cardKind: 'promo', card: { kind: 'promo', title: 'Hi' }, source: { type: 'update', ids: ['v1'] }, status: 'draft', ...extra });

test('queue: owner token required', async () => {
  const store = memoryQueueStore();
  assert.equal((await handleXQueue(req('GET', '/api/xqueue', null, false), { store, env })).status, 401);
  const bad = new Request('http://localhost/api/xqueue', { headers: { authorization: 'Bearer nope.nope' } });
  assert.equal((await handleXQueue(bad, { store, env })).status, 401);
});

test('queue: upsert, list, schedule, mark posted → history, delete', async () => {
  const store = memoryQueueStore();
  const ctx = { store, env, now: 5000 };
  let r = await handleXQueue(req('GET', '/api/xqueue'), ctx);
  assert.deepEqual(await r.json(), { drafts: [], history: [], meta: {} });
  r = await handleXQueue(req('PUT', '/api/xqueue/drafts/d1', draft('d1')), ctx);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).draft.id, 'd1');
  r = await handleXQueue(req('PUT', '/api/xqueue/drafts/d1', draft('d1', { status: 'scheduled', scheduledAt: 99999 })), { ...ctx, now: 6000 });
  const s1 = (await r.json()).draft;
  assert.equal(s1.status, 'scheduled');
  assert.equal(s1.scheduledAt, 99999);
  assert.equal(s1.updated, 6000);
  r = await handleXQueue(req('POST', '/api/xqueue/drafts/d1/posted', { postedUrl: 'https://x.com/poltok/status/1' }), { ...ctx, now: 7000 });
  const p = await r.json();
  assert.equal(p.draft.status, 'posted');
  assert.equal(p.draft.postedAt, 7000);
  assert.equal(p.history.length, 1);
  assert.equal(p.history[0].postedUrl, 'https://x.com/poltok/status/1');
  const st = await (await handleXQueue(req('GET', '/api/xqueue'), ctx)).json();
  assert.equal(st.meta.lastPostedUpdateAt, 7000);
  assert.equal((await handleXQueue(req('POST', '/api/xqueue/drafts/missing/posted', {}), ctx)).status, 404);
  r = await handleXQueue(req('DELETE', '/api/xqueue/drafts/d1'), ctx);
  assert.equal(r.status, 200);
  const after = await (await handleXQueue(req('GET', '/api/xqueue'), ctx)).json();
  assert.equal(after.drafts.length, 0);
  assert.equal(after.history.length, 1); // history survives deletion
});

test('queue: validation, import merge (newest wins), meta', async () => {
  const store = memoryQueueStore();
  const ctx = { store, env, now: 10 };
  assert.equal((await handleXQueue(req('PUT', '/api/xqueue/drafts/bad id!', draft('x')), ctx)).status, 400);
  assert.equal((await handleXQueue(req('PUT', '/api/xqueue/drafts/e', { ...draft('e'), posts: ['  '] }), ctx)).status, 400);
  assert.equal(sanitizeDraft({ ...draft('z'), status: 'hacked', url: 'javascript:alert(1)' }).status, 'draft');
  assert.equal(sanitizeDraft({ ...draft('z'), url: 'javascript:alert(1)' }).url, '');
  assert.equal(sanitizeDraft({ ...draft('z'), posts: Array(99).fill('p') }).posts.length, LIMITS.posts);
  await handleXQueue(req('PUT', '/api/xqueue/drafts/a', draft('a', { title: 'server' })), { ...ctx, now: 100 });
  const r = await handleXQueue(req('POST', '/api/xqueue/import', { drafts: [draft('a', { title: 'older', updated: 50 }), draft('b', { updated: 60 })] }), ctx);
  const { drafts } = await r.json();
  assert.equal(drafts.find((d) => d.id === 'a').title, 'server');
  assert.ok(drafts.find((d) => d.id === 'b'));
  const m = await (await handleXQueue(req('PUT', '/api/xqueue/meta', { knownUpdateIds: ['v1', 'bad id!'], lastPostedUpdateAt: 42 }), ctx)).json();
  assert.deepEqual(m.meta, { lastPostedUpdateAt: 42, knownUpdateIds: ['v1'] });
  assert.equal((await handleXQueue(req('PUT', '/api/xqueue', {}), ctx)).status, 405);
});

test('queue: pure helpers', () => {
  const merged = mergeDrafts([{ id: 'a', updated: 2 }], [{ id: 'a', updated: 1 }, { id: 'b', updated: 3 }]);
  assert.deepEqual(merged.map((d) => d.id), ['b', 'a']);
  assert.equal(merged.find((d) => d.id === 'a').updated, 2);
  assert.equal(markPosted({ drafts: [], history: [], meta: {} }, 'x'), null);
});
