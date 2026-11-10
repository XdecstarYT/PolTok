// node --test tests/ — first-party analytics: visitor hashing, hit sanitising, daily rollup, compaction, endpoints.
import test from 'node:test';
import assert from 'node:assert/strict';
import { visitorHash, sanitizeHit, applyHit, emptyDay, compactDay, uniques, summarize, dayOf, handleAnalytics, memoryAnalyticsStore, BOT_RE } from '../server/analytics.js';
import { signToken } from '../server/owner.js';

test('visitorHash: deterministic per salt, changes with salt / ip / ua, never contains inputs', () => {
  const a = visitorHash('salt1', '1.2.3.4', 'UA', 'poltok.netlify.app');
  assert.equal(a, visitorHash('salt1', '1.2.3.4', 'UA', 'poltok.netlify.app'));
  assert.match(a, /^[0-9a-f]{16}$/);
  assert.notEqual(a, visitorHash('salt2', '1.2.3.4', 'UA', 'poltok.netlify.app'));
  assert.notEqual(a, visitorHash('salt1', '1.2.3.5', 'UA', 'poltok.netlify.app'));
  assert.notEqual(a, visitorHash('salt1', '1.2.3.4', 'UA2', 'poltok.netlify.app'));
  assert.ok(!a.includes('1.2.3.4'));
});

test('sanitizeHit: strips query/hash, drops junk, own-site referrers, normalises fields', () => {
  const h = sanitizeHit({ p: '/race/GA-SEN/?utm_source=x#top', r: 'www.Google.com', u: 'X', d: 'mobile', t: 'paper', a: 1 }, { country: 'au', siteHost: 'poltok.netlify.app' });
  assert.deepEqual(h, { p: '/race/GA-SEN', r: 'google.com', u: 'x', d: 'mobile', t: 'paper', a: true, c: 'AU' });
  assert.equal(sanitizeHit({ p: 'javascript:alert(1)' }), null);
  assert.equal(sanitizeHit({ p: '/<script>' }), null);
  assert.equal(sanitizeHit(null), null);
  const self = sanitizeHit({ p: '/', r: 'poltok.netlify.app', d: 'phone' }, { siteHost: 'poltok.netlify.app' });
  assert.equal(self.r, '');
  assert.equal(self.d, 'desktop');
  assert.equal(self.c, '??');
  assert.equal(self.t, 'unknown');
});

test('applyHit / compactDay / summarize: daily rollup', () => {
  const day = '2026-11-10';
  let d = emptyDay(day);
  d = applyHit(d, sanitizeHit({ p: '/', u: 'x', d: 'mobile', t: 'command' }, { country: 'US' }), 'h1');
  d = applyHit(d, sanitizeHit({ p: '/play', d: 'mobile', t: 'command' }, { country: 'US' }), 'h1');
  d = applyHit(d, sanitizeHit({ p: '/ask', r: 't.co', d: 'desktop', t: 'paper', a: 1 }, { country: 'AU' }), 'h2');
  assert.equal(d.pv, 3);
  assert.equal(uniques(d), 2);
  assert.deepEqual(d.pages, { '/': 1, '/play': 1, '/ask': 1 });
  assert.deepEqual(d.countries, { US: 2, AU: 1 });
  assert.deepEqual(d.src, { x: 1, direct: 1, referral: 1 });
  assert.equal(d.play, 1);
  assert.equal(d.ask, 1);
  assert.equal(d.xpv, 2); // utm_source=x and t.co
  assert.deepEqual(d.app, { browser: 2, installed: 1 });
  const c = compactDay(d);
  assert.equal(c.v, undefined);
  assert.equal(c.xv, undefined);
  assert.equal(c.uniques, 2);
  assert.equal(c.xuniques, 2);
  assert.equal(uniques(c), 2);
  const now = Date.parse('2026-11-10T15:00:00Z');
  const older = { ...emptyDay('2026-11-04'), pv: 10, v: undefined, xv: undefined, uniques: 4, pages: { '/': 10 } };
  const ancient = { ...emptyDay('2026-09-01'), pv: 99, v: undefined, uniques: 50 };
  const s = summarize([d, older, ancient], { now, days: 7, live: 3 });
  assert.deepEqual(s.totals.today, { pv: 3, visitors: 2 });
  assert.deepEqual(s.totals.d7, { pv: 13, visitors: 6 });
  assert.deepEqual(s.totals.d30, { pv: 13, visitors: 6 });
  assert.equal(s.series.length, 7);
  assert.equal(s.series[6].day, day);
  assert.equal(s.top.pages[0].key, '/');
  assert.equal(s.top.pages[0].count, 11);
  assert.equal(s.live, 3);
  assert.deepEqual(s.events, { play: 1, ask: 1 });
  assert.deepEqual(s.x, { pv: 2, visitors: 2 });
});

const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1';
const hit = (body, headers = {}) => new Request('http://localhost/api/pv', { method: 'POST', headers: { 'content-type': 'text/plain', 'user-agent': ua, host: 'poltok.netlify.app', ...headers }, body: JSON.stringify(body) });

test('collect: records hits, ignores DNT / GPC / bots, never stores IP or UA', async () => {
  const store = memoryAnalyticsStore();
  const now = Date.parse('2026-11-10T10:00:00Z');
  const ctx = { store, ip: '203.0.113.9', country: 'NZ', now };
  assert.equal((await handleAnalytics(hit({ p: '/' }), ctx)).status, 204);
  await handleAnalytics(hit({ p: '/nz' }), { ...ctx, now: now + 1000 });
  await handleAnalytics(hit({ p: '/' }, { dnt: '1' }), ctx);
  await handleAnalytics(hit({ p: '/' }, { 'sec-gpc': '1' }), ctx);
  await handleAnalytics(hit({ p: '/' }, { 'user-agent': 'Googlebot/2.1' }), ctx);
  await handleAnalytics(hit({ p: 'nope' }), ctx);
  const d = await store.get(`day/${dayOf(now)}`);
  assert.equal(d.pv, 2);
  assert.equal(uniques(d), 1);
  assert.deepEqual(d.countries, { NZ: 2 });
  const dump = JSON.stringify([...store._map.entries()]);
  assert.ok(!dump.includes('203.0.113.9'));
  assert.ok(!dump.includes('iPhone'));
  assert.ok(BOT_RE.test('HeadlessChrome'));
  // next day: salt rotates, yesterday is compacted (hash set dropped) and old salt deleted
  const next = now + 864e5;
  await handleAnalytics(hit({ p: '/' }), { ...ctx, now: next });
  const y = await store.get(`day/${dayOf(now)}`);
  assert.equal(y.v, undefined);
  assert.equal(y.uniques, 1);
  assert.deepEqual(await store.list('salt/'), [`salt/${dayOf(next)}`]);
  const t = await store.get(`day/${dayOf(next)}`);
  assert.equal(uniques(t), 1);
  assert.notEqual(Object.keys(t.v)[0], Object.keys(d.v)[0]); // same visitor, unlinkable across days
});

test('stats: owner only; returns live + totals', async () => {
  const env = { OWNER_SECRET: 's' };
  const store = memoryAnalyticsStore();
  const now = Date.parse('2026-11-10T10:00:00Z');
  await handleAnalytics(hit({ p: '/play', u: 'x' }), { store, ip: '1.1.1.1', now });
  const get = (auth) => new Request('http://localhost/api/analytics?days=7', { headers: auth ? { authorization: `Bearer ${signToken('dicky', env).token}` } : {} });
  assert.equal((await handleAnalytics(get(false), { store, env, now })).status, 401);
  const r = await handleAnalytics(get(true), { store, env, now: now + 60000 });
  assert.equal(r.status, 200);
  const s = await r.json();
  assert.equal(s.live, 1);
  assert.equal(s.totals.today.pv, 1);
  assert.equal(s.x.pv, 1);
  assert.equal(s.events.play, 1);
  assert.equal(s.series.length, 7);
  const later = await (await handleAnalytics(get(true), { store, env, now: now + 10 * 60000 })).json();
  assert.equal(later.live, 0);
});
