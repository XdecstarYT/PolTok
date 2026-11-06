// node --test tests/ — /api/updates: public reads, owner-only writes (token mocked via signToken), RSS.
import test from 'node:test';
import assert from 'node:assert/strict';
import { handleUpdates, memoryStore, mergePosts, sanitizePost } from '../server/updates.js';
import { signToken } from '../server/owner.js';

const env = { OWNER_SECRET: 'test-secret' };
const good = signToken('owner', env).token;
const forged = signToken('owner', { OWNER_SECRET: 'other' }).token;
const expired = signToken('owner', env, Date.now() - 13 * 3600e3).token;
const req = (method, path, { token, body } = {}) =>
  new Request('http://x' + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
const post = { title: 'Hello', body: 'World **bold**', version: 'v1', categories: ['New', 'Bogus'], links: [{ label: 'x', to: '/map' }, { label: 'bad', to: 'javascript:alert(1)' }] };

test('GET is public and returns seed posts newest first', async () => {
  const r = await handleUpdates(req('GET', '/api/updates'), { store: memoryStore(), env });
  assert.equal(r.status, 200);
  const { posts } = await r.json();
  assert.ok(posts.length >= 15);
  assert.ok(Date.parse(posts[0].date) >= Date.parse(posts.at(-1).date));
});

test('writes require a valid owner token', async () => {
  const store = memoryStore();
  for (const t of [undefined, 'junk', forged, expired]) {
    assert.equal((await handleUpdates(req('POST', '/api/updates', { token: t, body: post }), { store, env })).status, 401);
    assert.equal((await handleUpdates(req('PUT', '/api/updates/v0-1-launch', { token: t, body: post }), { store, env })).status, 401);
    assert.equal((await handleUpdates(req('DELETE', '/api/updates/v0-1-launch', { token: t }), { store, env })).status, 401);
  }
  assert.deepEqual(await store.get(), []);
});

test('owner can create, edit and delete; seed delete leaves tombstone', async () => {
  const store = memoryStore();
  const c = await handleUpdates(req('POST', '/api/updates', { token: good, body: post }), { store, env });
  assert.equal(c.status, 201);
  const { post: p } = await c.json();
  assert.deepEqual(p.categories, ['New']);
  assert.equal(p.links.length, 1);
  const u = await handleUpdates(req('PUT', '/api/updates/' + p.id, { token: good, body: { ...post, title: 'Edited' } }), { store, env });
  assert.equal((await u.json()).post.title, 'Edited');
  let list = (await (await handleUpdates(req('GET', '/api/updates'), { store, env })).json()).posts;
  assert.equal(list.find((x) => x.id === p.id).title, 'Edited');
  assert.equal((await handleUpdates(req('DELETE', '/api/updates/' + p.id, { token: good }), { store, env })).status, 200);
  assert.equal((await handleUpdates(req('DELETE', '/api/updates/v0-1-launch', { token: good }), { store, env })).status, 200);
  list = (await (await handleUpdates(req('GET', '/api/updates'), { store, env })).json()).posts;
  assert.ok(!list.some((x) => x.id === p.id || x.id === 'v0-1-launch'));
});

test('drafts hidden from public, visible to owner; bad bodies rejected', async () => {
  const store = memoryStore();
  await handleUpdates(req('POST', '/api/updates', { token: good, body: { ...post, id: 'd1', draft: true } }), { store, env });
  const pub = (await (await handleUpdates(req('GET', '/api/updates'), { store, env })).json()).posts;
  const own = (await (await handleUpdates(req('GET', '/api/updates', { token: good }), { store, env })).json()).posts;
  assert.ok(!pub.some((x) => x.id === 'd1') && own.some((x) => x.id === 'd1'));
  assert.equal((await handleUpdates(req('POST', '/api/updates', { token: good, body: { title: '' } }), { store, env })).status, 400);
  assert.equal(sanitizePost({ title: 'a', body: 'b', image: 'javascript:x' }).image, undefined);
  assert.equal(mergePosts([{ id: 'v0-1-launch', deleted: true }]).some((x) => x.id === 'v0-1-launch'), false);
});

test('RSS feed', async () => {
  const r = await handleUpdates(req('GET', '/api/updates.rss'), { store: memoryStore(), env });
  assert.match(r.headers.get('content-type'), /rss/);
  const x = await r.text();
  assert.match(x, /^<\?xml/);
  assert.ok((x.match(/<item>/g) || []).length >= 15);
});
