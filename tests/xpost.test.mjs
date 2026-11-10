// node --test tests/ — Publish to X (/api/xpost): OAuth 1.0a signature, validation, owner auth, not-configured
// response, mocked X API flow (never calls the real X API), duplicate guard, error mapping, rate limit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import {
  handleXPost, oauthSignature, oauthHeader, signatureBaseString, pct, validatePublish, xCreds, xLength, xError,
  publishAllowed, resetRateLimit, XPOST_LIMITS,
} from '../server/xpost.js';
import { memoryQueueStore } from '../server/xqueue.js';
import { signToken } from '../server/owner.js';

const ENV = { OWNER_SECRET: 'test-secret', X_API_KEY: 'ck-123', X_API_SECRET: 'cs-SECRET-456', X_ACCESS_TOKEN: '99-at-789', X_ACCESS_SECRET: 'as-SECRET-000' };
const NOX = { OWNER_SECRET: 'test-secret' };
const tok = signToken('dicky', ENV).token;
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82]);

/* ---------------------- OAuth 1.0a: X's "Creating a signature" example ---------------------- */
const DOC = {
  params: {
    status: 'Hello Ladies + Gentlemen, a signed OAuth request!',
    include_entities: 'true',
    oauth_consumer_key: 'xvz1evFS4wEEPTGEFPHBog',
    oauth_nonce: 'kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg',
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: '1318622958',
    oauth_token: '370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb',
    oauth_version: '1.0',
  },
  consumerSecret: 'kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw',
  tokenSecret: 'LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE',
};

test('OAuth: signature base string matches the documented example', () => {
  const base = signatureBaseString('POST', 'https://api.twitter.com/1.1/statuses/update.json', DOC.params);
  assert.equal(
    base,
    'POST&https%3A%2F%2Fapi.twitter.com%2F1.1%2Fstatuses%2Fupdate.json&include_entities%3Dtrue%26oauth_consumer_key%3Dxvz1evFS4wEEPTGEFPHBog%26oauth_nonce%3DkYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg%26oauth_signature_method%3DHMAC-SHA1%26oauth_timestamp%3D1318622958%26oauth_token%3D370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb%26oauth_version%3D1.0%26status%3DHello%2520Ladies%2520%252B%2520Gentlemen%252C%2520a%2520signed%2520OAuth%2520request%2521',
  );
});

test('OAuth: HMAC-SHA1 signature matches X docs (api.x.com) and the classic api.twitter.com example', () => {
  // docs.x.com → Authentication → OAuth 1.0a → Creating a signature (current page uses api.x.com)
  assert.equal(oauthSignature('POST', 'https://api.x.com/1.1/statuses/update.json', DOC.params, DOC.consumerSecret, DOC.tokenSecret), 'Ls93hJiZbQ3akF3HF3x1Bz8/zU4=');
  // the same example as published on developer.twitter.com
  assert.equal(oauthSignature('POST', 'https://api.twitter.com/1.1/statuses/update.json', DOC.params, DOC.consumerSecret, DOC.tokenSecret), 'hCtSmYh+iHYCEqBWrE7C7hYmtUk=');
});

test('OAuth: query-string params are signed; percent-encoding is RFC 3986', () => {
  assert.equal(pct("a b!*'()"), 'a%20b%21%2A%27%28%29');
  const { status, include_entities, ...oauth } = DOC.params;
  const viaQuery = oauthSignature('POST', `https://api.twitter.com/1.1/statuses/update.json?include_entities=true&status=${encodeURIComponent(status)}`, oauth, DOC.consumerSecret, DOC.tokenSecret);
  assert.equal(viaQuery, 'hCtSmYh+iHYCEqBWrE7C7hYmtUk=');
  assert.equal(include_entities, 'true');
});

test('OAuth: Authorization header has the 7 oauth_ params and a valid signature, never the secrets', () => {
  const creds = xCreds(ENV);
  const h = oauthHeader({ method: 'POST', url: 'https://api.x.com/2/tweets', creds, nonce: 'abc', timestamp: 1700000000 });
  assert.match(h, /^OAuth /);
  const kv = Object.fromEntries([...h.slice(6).matchAll(/(\w+)="([^"]*)"/g)].map((m) => [m[1], decodeURIComponent(m[2])]));
  assert.deepEqual(Object.keys(kv).sort(), ['oauth_consumer_key', 'oauth_nonce', 'oauth_signature', 'oauth_signature_method', 'oauth_timestamp', 'oauth_token', 'oauth_version']);
  assert.equal(kv.oauth_consumer_key, 'ck-123');
  assert.equal(kv.oauth_token, '99-at-789');
  const { oauth_signature, ...rest } = kv;
  assert.equal(oauth_signature, oauthSignature('POST', 'https://api.x.com/2/tweets', rest, ENV.X_API_SECRET, ENV.X_ACCESS_SECRET));
  assert.ok(!h.includes('SECRET'));
});

test('xCreds: all four env vars required', () => {
  assert.ok(xCreds(ENV));
  assert.equal(xCreds({ ...ENV, X_ACCESS_SECRET: '' }), null);
  assert.equal(xCreds({}), null);
});

/* ------------------------------ validation ------------------------------ */
test('validatePublish: text ≤280 (X weighted), ≤4 posts, non-empty, PNG ≤5MB', () => {
  assert.equal(validatePublish({ posts: ['hi'] }).ok, true);
  assert.equal(validatePublish({ posts: ['a'.repeat(280)] }).ok, true);
  assert.match(validatePublish({ posts: ['a'.repeat(281)] }).error, /281\/280/);
  // a long URL counts as 23
  assert.equal(validatePublish({ posts: ['a'.repeat(250) + ' https://poltok.netlify.app/updates?utm_source=x&utm_medium=social&utm_campaign=update-x'] }).ok, true);
  assert.equal(validatePublish({ posts: ['🚨'.repeat(141)] }).ok, false);
  assert.equal(validatePublish({ posts: ['1', '2', '3', '4'] }).ok, true);
  assert.match(validatePublish({ posts: ['1', '2', '3', '4', '5'] }).error, /at most 4/);
  assert.match(validatePublish({ posts: [] }).error, /At least one/);
  assert.match(validatePublish({ posts: ['ok', '  '] }).error, /Post 2 is empty/);
  assert.equal(validatePublish({ posts: [42] }).ok, false);
  assert.equal(validatePublish(null).ok, false);
  assert.equal(validatePublish({ posts: ['x'], alt: 'a'.repeat(1001) }).ok, false);
  assert.equal(validatePublish({ posts: ['x'], updateId: '../etc' }).ok, false);
  assert.equal(validatePublish({ posts: ['x'] }, { type: 'image/png', bytes: PNG }).ok, true);
  assert.match(validatePublish({ posts: ['x'] }, { type: 'image/jpeg', bytes: PNG }).error, /PNG/);
  assert.match(validatePublish({ posts: ['x'] }, { type: 'image/png', bytes: new Uint8Array([0xff, 0xd8, 0xff, 0, 0, 0, 0, 0]) }).error, /PNG/);
  const big = new Uint8Array(XPOST_LIMITS.imageBytes + 1);
  big.set(PNG);
  assert.match(validatePublish({ posts: ['x'] }, { type: 'image/png', bytes: big }).error, /5 MB/);
});

test('xLength (server JS port) agrees with the client xtext.ts', async () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const dir = mkdtempSync(join(tmpdir(), 'xpost-'));
  const out = join(dir, 'xtext.mjs');
  buildSync({ entryPoints: [join(root, 'src/features/owner/xstudio/xtext.ts')], bundle: true, format: 'esm', platform: 'neutral', outfile: out, logLevel: 'error' });
  const T = await import(pathToFileURL(out).href);
  for (const s of ['hello', '🚨 CALL https://poltok.netlify.app/live.', '选举 👩‍👩‍👧‍👦 🇳🇿 — é', 'see poltok.netlify.app/x and https://a.com/y', '✨ New on PolTok v1.2: thing\n\n• a\n#PolTok\nhttps://poltok.netlify.app/updates?utm_source=x#v1']) {
    assert.equal(xLength(s), T.xLength(s), s);
  }
});

/* ------------------------------ handler ------------------------------ */
const req = (method, { token = tok, body, headers = {} } = {}) => new Request('http://localhost/api/xpost', { method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers }, body });
const form = (payload, image = PNG) => {
  const fd = new FormData();
  fd.set('payload', JSON.stringify(payload));
  if (image) fd.set('image', new Blob([image], { type: 'image/png' }), 'card.png');
  return fd;
};
const jsonRes = (status, body, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
/** Mock X: records calls; `script` maps a URL suffix to a responder. */
function mockX(script = {}) {
  const calls = [];
  let n = 0;
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ url, auth: init.headers.authorization, body });
    for (const [k, f] of Object.entries(script)) if (url.endsWith(k)) { const r = f(body, calls); if (r) return r; }
    if (url.endsWith('/2/media/upload')) return jsonRes(200, { data: { id: '1880000000000000001', media_key: '3_1880000000000000001' } });
    if (url.endsWith('/2/media/metadata')) return jsonRes(200, { data: { id: body.id } });
    if (url.endsWith('/2/tweets')) return jsonRes(201, { data: { id: String(1990000000000000000n + BigInt(++n)), text: body.text } });
    return jsonRes(404, { title: 'Not Found' });
  };
  return { calls, fetchImpl };
}
const neverFetch = async () => assert.fail('must not call X');

test('auth: rejects missing, forged and expired tokens (and never touches X)', async () => {
  resetRateLimit();
  for (const t of [null, 'nope', signToken('dicky', { OWNER_SECRET: 'other' }).token, signToken('dicky', ENV, Date.now() - 13 * 3600e3).token]) {
    const r = await handleXPost(req('POST', { token: t, body: form({ posts: ['hi'] }) }), { env: ENV, fetchImpl: neverFetch });
    assert.equal(r.status, 401);
    assert.deepEqual(Object.keys(await r.json()).sort(), ['code', 'error']);
  }
  const g = await handleXPost(req('GET', { token: null }), { env: ENV });
  assert.equal(g.status, 401);
});

test('not configured: GET and POST answer { configured:false } without calling X', async () => {
  resetRateLimit();
  const g = await handleXPost(req('GET'), { env: NOX, fetchImpl: neverFetch });
  assert.deepEqual(await g.json(), { configured: false });
  const p = await handleXPost(req('POST', { body: form({ posts: ['hi'] }) }), { env: NOX, fetchImpl: neverFetch });
  assert.equal(p.status, 200);
  assert.deepEqual(await p.json(), { configured: false });
  const ok = await handleXPost(req('GET'), { env: ENV });
  assert.deepEqual(await ok.json(), { configured: true });
});

test('validation errors come back as 400 before any X call', async () => {
  resetRateLimit();
  const cases = [
    form({ posts: ['a'.repeat(281)] }),
    form({ posts: ['1', '2', '3', '4', '5'] }),
    form({ posts: ['x'] }, new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9])),
  ];
  for (const body of cases) {
    const r = await handleXPost(req('POST', { body }), { env: ENV, fetchImpl: neverFetch, ip: 'v' + Math.random() });
    assert.equal(r.status, 400);
    assert.equal((await r.json()).code, 'invalid');
  }
  const bad = await handleXPost(req('POST', { body: 'not json', headers: { 'content-type': 'application/json' } }), { env: ENV, fetchImpl: neverFetch, ip: 'bad' });
  assert.equal(bad.status, 400);
});

test('publish: uploads image, sets alt text, posts a chained thread, returns URLs, records history', async () => {
  resetRateLimit();
  const store = memoryQueueStore(null);
  const { calls, fetchImpl } = mockX();
  const draft = { id: 'upd-abc', title: 'Live map', posts: ['x'], url: 'https://poltok.netlify.app/updates?utm_source=x#u1', alt: 'Card', designId: 'announce', card: { kind: 'announcement', title: 'Live map' }, source: { type: 'update', ids: ['u1'] } };
  const r = await handleXPost(req('POST', { body: form({ posts: ['First 1/2', 'Second 2/2'], alt: 'PolTok card: Live map', updateId: 'u1', draft }) }), { env: ENV, fetchImpl, store });
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.equal(d.ok, true);
  assert.deepEqual(d.urls, ['https://x.com/i/status/1990000000000000001', 'https://x.com/i/status/1990000000000000002']);
  assert.ok(!JSON.stringify(d).includes('SECRET') && !JSON.stringify(d).includes('ck-123'));

  assert.deepEqual(calls.map((c) => c.url), ['https://api.x.com/2/media/upload', 'https://api.x.com/2/media/metadata', 'https://api.x.com/2/tweets', 'https://api.x.com/2/tweets']);
  assert.ok(calls.every((c) => c.auth.startsWith('OAuth ') && c.auth.includes('oauth_signature_method="HMAC-SHA1"')));
  assert.equal(calls[0].body.media_category, 'tweet_image');
  assert.deepEqual([...Buffer.from(calls[0].body.media, 'base64')], [...PNG]);
  assert.deepEqual(calls[1].body, { id: '1880000000000000001', metadata: { alt_text: { text: 'PolTok card: Live map' } } });
  assert.deepEqual(calls[2].body, { text: 'First 1/2', media: { media_ids: ['1880000000000000001'] } });
  assert.deepEqual(calls[3].body, { text: 'Second 2/2', reply: { in_reply_to_tweet_id: '1990000000000000001' } });

  assert.equal(d.recorded, true);
  const st = await store.get();
  assert.equal(st.drafts[0].status, 'posted');
  assert.equal(st.drafts[0].postedUrl, d.urls[0]);
  assert.deepEqual(st.drafts[0].posts, ['First 1/2', 'Second 2/2']);
  assert.equal(st.history[0].postedUrl, d.urls[0]);
  assert.equal(st.history[0].posts, 2);
});

test('double-post guard: 409 already_posted unless force:true', async () => {
  resetRateLimit();
  const store = memoryQueueStore(null);
  const draft = { id: 'upd-1', title: 'T', posts: ['x'], source: { type: 'update', ids: ['u9'] } };
  const m1 = mockX();
  assert.equal((await handleXPost(req('POST', { body: form({ posts: ['Hello'], updateId: 'u9', draft }) }), { env: ENV, fetchImpl: m1.fetchImpl, store, ip: 'a' })).status, 200);
  const again = await handleXPost(req('POST', { body: form({ posts: ['Hello'], updateId: 'u9', draft: { ...draft, id: 'upd-2' } }) }), { env: ENV, fetchImpl: neverFetch, store, ip: 'b' });
  assert.equal(again.status, 409);
  const j = await again.json();
  assert.equal(j.code, 'already_posted');
  assert.match(j.postedUrl, /^https:\/\/x\.com\/i\/status\//);
  const m2 = mockX();
  const forced = await handleXPost(req('POST', { body: form({ posts: ['Hello again'], updateId: 'u9', draft: { ...draft, id: 'upd-2' }, force: true }) }), { env: ENV, fetchImpl: m2.fetchImpl, store, ip: 'c' });
  assert.equal(forced.status, 200);
});

test('errors: rate limit, duplicate content, bad credentials and missing write permission are readable', async () => {
  resetRateLimit();
  const reset = Math.floor(Date.now() / 1000) + 600;
  const rl = mockX({ '/2/tweets': () => jsonRes(429, { title: 'Too Many Requests', detail: 'Too Many Requests', status: 429 }, { 'x-rate-limit-reset': String(reset) }) });
  let r = await handleXPost(req('POST', { body: form({ posts: ['x'] }) }), { env: ENV, fetchImpl: rl.fetchImpl, ip: 'e1' });
  assert.equal(r.status, 429);
  let d = await r.json();
  assert.equal(d.code, 'rate_limited');
  assert.match(d.error, /rate limit.*10 minutes/i);
  assert.ok(d.retryAfter > 500 && d.retryAfter <= 600);

  const dup = mockX({ '/2/tweets': () => jsonRes(403, { detail: 'You are not allowed to create a Tweet with duplicate content.', type: 'about:blank', title: 'Forbidden', status: 403 }) });
  r = await handleXPost(req('POST', { body: form({ posts: ['x'] }) }), { env: ENV, fetchImpl: dup.fetchImpl, ip: 'e2' });
  d = await r.json();
  assert.equal(r.status, 409);
  assert.equal(d.code, 'duplicate');
  assert.match(d.error, /duplicate/);

  const bad = mockX({ '/2/media/upload': () => jsonRes(401, { title: 'Unauthorized', status: 401, detail: 'Unauthorized' }) });
  r = await handleXPost(req('POST', { body: form({ posts: ['x'] }) }), { env: ENV, fetchImpl: bad.fetchImpl, ip: 'e3' });
  d = await r.json();
  assert.equal(d.code, 'x_auth');
  assert.equal(bad.calls.length, 1); // stopped after the failed upload

  assert.equal(xError(403, { title: 'Unsupported Authentication', type: 'https://api.twitter.com/2/problems/oauth1-permissions', detail: 'Your client app is not configured with the appropriate oauth1 app permissions for this endpoint.' }).code, 'x_permissions');
  assert.ok(!JSON.stringify(d).includes('SECRET'));
});

test('partial thread failure returns the posts that went out', async () => {
  resetRateLimit();
  let n = 0;
  const m = mockX({ '/2/tweets': () => (++n === 2 ? jsonRes(503, { title: 'Service Unavailable' }) : null) });
  const r = await handleXPost(req('POST', { body: form({ posts: ['a', 'b', 'c'] }) }), { env: ENV, fetchImpl: m.fetchImpl, ip: 'p' });
  const d = await r.json();
  assert.equal(r.status, 502);
  assert.equal(d.partial.urls.length, 1);
});

test('rate limit: 5 publish attempts per 10 min per IP', async () => {
  resetRateLimit();
  const t0 = 1_700_000_000_000;
  for (let i = 0; i < 5; i++) assert.equal(publishAllowed('1.2.3.4', t0 + i).ok, true);
  const no = publishAllowed('1.2.3.4', t0 + 10);
  assert.equal(no.ok, false);
  assert.ok(no.retryAfter > 590);
  assert.equal(publishAllowed('5.6.7.8', t0 + 10).ok, true);
  assert.equal(publishAllowed('1.2.3.4', t0 + 600e3 + 1).ok, true);
  resetRateLimit();
  const m = mockX();
  let last;
  for (let i = 0; i < 6; i++) last = await handleXPost(req('POST', { body: form({ posts: ['x' + i] }) }), { env: ENV, fetchImpl: m.fetchImpl, ip: 'same' });
  assert.equal(last.status, 429);
  resetRateLimit();
});
