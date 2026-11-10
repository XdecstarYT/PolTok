// First-party, cookieless analytics — shared by the Node server and netlify/functions/analytics.mjs.
//   POST /api/pv          beacon (text/plain JSON {p,r,u,d,t,a}) → 204. Never stores IPs, user agents or raw events.
//   GET  /api/analytics   (owner token) ?days=1..400 → aggregates for the dashboard.
// Unique visitors use a Plausible-style hash: sha256(daily random salt | IP | UA | host), truncated. The salt is
// random per UTC day and deleted when the day rotates, so hashes cannot be linked across days or reversed.
// The per-day hash set only lives inside that day's rollup and is replaced by a count once the day is over.
// Requests with DNT: 1 or Sec-GPC: 1, and bot user agents, are ignored.
// Storage: { get(key), set(key, v), del(key), list(prefix) } — Netlify Blobs store 'poltok-analytics' or a JSON dir locally.
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyToken } from './owner.js';

export const LIVE_MS = 5 * 60000;
export const KEEP_DAYS = 400; // daily aggregates (no raw events are ever kept)
const MAX_KEYS = 400; // per breakdown map per day; overflow → "(other)"
const MAX_HASHES = 100000;
export const BOT_RE = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|embedly|whatsapp|telegram|curl|wget|python|httpclient|axios|node-fetch|go-http|java\/|okhttp|phantom|puppeteer|playwright|scrapy|monitor|uptime/i;
export const DEVICES = ['mobile', 'tablet', 'desktop'];

export const dayOf = (ts) => new Date(ts).toISOString().slice(0, 10);

/** Plausible-style visitor id: never stored with the inputs; salt rotates daily. */
export function visitorHash(salt, ip, ua, host = '') {
  return crypto.createHash('sha256').update(`${salt}|${ip}|${ua}|${host}`).digest('hex').slice(0, 16);
}

const clean = (v, re, max) => {
  const s = typeof v === 'string' ? v.trim().slice(0, max) : '';
  return re.test(s) ? s : '';
};

/** Validate a beacon payload. Returns null if unusable. */
export function sanitizeHit(b, { country = '', siteHost = '' } = {}) {
  if (!b || typeof b !== 'object') return null;
  let p = typeof b.p === 'string' ? b.p.split(/[?#]/)[0].slice(0, 120) : '';
  if (!/^\/[\w\-./~%@:+]*$/.test(p)) return null;
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  let r = clean(String(b.r || '').toLowerCase().replace(/^www\./, ''), /^[a-z0-9.-]+\.[a-z]{2,}$/, 80);
  if (r && siteHost && (r === siteHost || r.endsWith('.' + siteHost))) r = '';
  return {
    p,
    r,
    u: clean(String(b.u || '').toLowerCase(), /^[a-z0-9._-]{1,40}$/, 40),
    d: DEVICES.includes(b.d) ? b.d : 'desktop',
    t: clean(String(b.t || ''), /^[a-z0-9-]{1,20}$/, 20) || 'unknown',
    a: !!b.a,
    c: clean(String(country || '').toUpperCase(), /^[A-Z]{2}$/, 2) || '??',
  };
}

export const emptyDay = (day) => ({ day, pv: 0, v: {}, pages: {}, refs: {}, src: {}, countries: {}, devices: {}, themes: {}, app: {}, play: 0, ask: 0, xpv: 0, xv: {} });
const bump = (m, k, n = 1) => {
  if (!(k in m) && Object.keys(m).length >= MAX_KEYS) k = '(other)';
  m[k] = (m[k] || 0) + n;
};

/** Add one pageview to a day rollup. Pure (returns a new object). */
export function applyHit(doc0, hit, hash) {
  const doc = structuredClone(doc0);
  doc.pv += 1;
  if (doc.v && Object.keys(doc.v).length < MAX_HASHES) doc.v[hash] = 1;
  bump(doc.pages, hit.p);
  if (hit.r) bump(doc.refs, hit.r);
  bump(doc.src, hit.u || (hit.r ? 'referral' : 'direct'));
  bump(doc.countries, hit.c);
  bump(doc.devices, hit.d);
  bump(doc.themes, hit.t);
  bump(doc.app, hit.a ? 'installed' : 'browser');
  if (/^\/play(\/|$)/.test(hit.p)) doc.play += 1;
  if (/^\/ask(\/|$)/.test(hit.p)) doc.ask += 1;
  if (hit.u === 'x' || hit.u === 'twitter' || hit.r === 't.co' || hit.r === 'x.com' || hit.r === 'twitter.com') {
    doc.xpv += 1;
    if (doc.xv) doc.xv[hash] = 1;
  }
  return doc;
}

/** Visitors for a day doc (live hash set or compacted count). */
export const uniques = (d) => (d.v ? Object.keys(d.v).length : d.uniques || 0);
export const xUniques = (d) => (d.xv ? Object.keys(d.xv).length : d.xuniques || 0);

/** Replace the hash sets of a finished day with counts (hashes are then gone for good). */
export function compactDay(d) {
  if (!d.v && !d.xv) return d;
  const { v: _v, xv: _xv, ...rest } = d;
  return { ...rest, uniques: uniques(d), xuniques: xUniques(d) };
}

const addMap = (a, b) => {
  for (const [k, n] of Object.entries(b || {})) a[k] = (a[k] || 0) + n;
  return a;
};
const top = (m, n = 20) => Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, n).map(([key, count]) => ({ key, count }));

/**
 * Dashboard aggregates from day docs. `days` = range length ending today (UTC).
 * Visitors over several days = sum of daily uniques (the salt rotates daily, so cross-day dedupe is impossible by design).
 */
export function summarize(docs, { now = Date.now(), days = 30, live = 0 } = {}) {
  const byDay = new Map(docs.map((d) => [d.day, d]));
  const span = (n) => Array.from({ length: n }, (_, i) => dayOf(now - (n - 1 - i) * 864e5));
  const tot = (n) => span(n).reduce((a, day) => { const d = byDay.get(day); if (d) { a.pv += d.pv; a.visitors += uniques(d); } return a; }, { pv: 0, visitors: 0 });
  const range = span(Math.max(1, Math.min(KEEP_DAYS, days)));
  const series = range.map((day) => { const d = byDay.get(day); return { day, pv: d?.pv ?? 0, visitors: d ? uniques(d) : 0, x: d?.xpv ?? 0 }; });
  const maps = { pages: {}, refs: {}, src: {}, countries: {}, devices: {}, themes: {}, app: {} };
  let play = 0, ask = 0, xpv = 0, xv = 0;
  for (const day of range) {
    const d = byDay.get(day);
    if (!d) continue;
    for (const k of Object.keys(maps)) addMap(maps[k], d[k]);
    play += d.play || 0;
    ask += d.ask || 0;
    xpv += d.xpv || 0;
    xv += xUniques(d);
  }
  return {
    ok: true,
    generatedAt: now,
    range: { days: range.length, from: range[0], to: range[range.length - 1] },
    totals: { today: tot(1), d7: tot(7), d30: tot(30), range: series.reduce((a, s) => ({ pv: a.pv + s.pv, visitors: a.visitors + s.visitors }), { pv: 0, visitors: 0 }) },
    live,
    series,
    top: Object.fromEntries(Object.entries(maps).map(([k, m]) => [k, top(m, k === 'pages' ? 25 : 15)])),
    events: { play, ask },
    x: { pv: xpv, visitors: xv },
  };
}

/* ------------------------------ store helpers ------------------------------ */
async function getSalt(store, day) {
  const k = `salt/${day}`;
  let s = await store.get(k).catch(() => null);
  if (s?.salt) return { salt: s.salt, fresh: false };
  s = { salt: crypto.randomBytes(16).toString('hex') };
  await store.set(k, s);
  return { salt: s.salt, fresh: true };
}

/** Day rotated: delete old salts and compact finished days (drops their hash sets). */
export async function rotate(store, today) {
  for (const k of await store.list('salt/').catch(() => [])) if (k !== `salt/${today}`) await store.del(k).catch(() => {});
  const cutoff = dayOf(Date.parse(today) - KEEP_DAYS * 864e5);
  for (const k of await store.list('day/').catch(() => [])) {
    const day = k.slice(4);
    if (day === today) continue;
    if (day < cutoff) { await store.del(k).catch(() => {}); continue; }
    const d = await store.get(k).catch(() => null);
    if (d && (d.v || d.xv)) await store.set(k, compactDay(d));
  }
}

const skip = () => new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

/** Record one pageview. ctx = { store, ip, country, now }. Always 204 (never leaks errors to the page). */
export async function collect(req, { store, ip = '', country = '', now = Date.now() } = {}) {
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' });
  const h = req.headers;
  const ua = h.get('user-agent') || '';
  if (h.get('dnt') === '1' || h.get('sec-gpc') === '1' || !ua || BOT_RE.test(ua)) return skip();
  let body;
  try {
    const raw = await req.text();
    if (raw.length > 2000) return skip();
    body = JSON.parse(raw);
  } catch {
    return skip();
  }
  const siteHost = (h.get('host') || '').toLowerCase().replace(/:\d+$/, '').replace(/^www\./, '');
  const hit = sanitizeHit(body, { country: country || h.get('x-country') || '', siteHost });
  if (!hit) return skip();
  const day = dayOf(now);
  try {
    const { salt, fresh } = await getSalt(store, day);
    if (fresh) await rotate(store, day);
    const hash = visitorHash(salt, ip, ua, siteHost);
    const doc = (await store.get(`day/${day}`).catch(() => null)) || emptyDay(day);
    await store.set(`day/${day}`, applyHit(doc, hit, hash));
    const live = (await store.get('live').catch(() => null)) || {};
    const next = { [hash]: now };
    for (const [k, t] of Object.entries(live)) if (now - t < LIVE_MS && k !== hash) next[k] = t;
    await store.set('live', next);
  } catch {
    /* storage hiccup: drop the hit */
  }
  return skip();
}

const isOwner = (req, env) => {
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.get('authorization') || '');
  return !!(m && verifyToken(m[1], env));
};

/** Owner aggregates. */
export async function stats(req, { store, env = process.env, now = Date.now() } = {}) {
  if (req.method !== 'GET') return json(405, { error: 'method not allowed' });
  if (!isOwner(req, env)) return json(401, { error: 'Owner sign-in required' });
  const days = Math.max(1, Math.min(KEEP_DAYS, Number(new URL(req.url, 'http://x').searchParams.get('days')) || 30));
  const want = Math.max(days, 30);
  const keys = Array.from({ length: want }, (_, i) => `day/${dayOf(now - i * 864e5)}`);
  const docs = (await Promise.all(keys.map((k) => store.get(k).catch(() => null)))).filter(Boolean);
  const liveDoc = (await store.get('live').catch(() => null)) || {};
  const live = Object.values(liveDoc).filter((t) => now - t < LIVE_MS).length;
  return json(200, summarize(docs, { now, days, live }));
}

/** Route both endpoints. */
export async function handleAnalytics(req, ctx = {}) {
  const p = new URL(req.url, 'http://x').pathname.replace(/\/+$/, '');
  if (p === '/api/pv') return collect(req, ctx);
  if (p === '/api/analytics') return stats(req, ctx);
  return json(404, { error: 'not found' });
}

/* ------------------------------ stores ------------------------------ */
export function memoryAnalyticsStore() {
  const m = new Map();
  return {
    get: async (k) => (m.has(k) ? structuredClone(m.get(k)) : null),
    set: async (k, v) => void m.set(k, structuredClone(v)),
    del: async (k) => void m.delete(k),
    list: async (prefix) => [...m.keys()].filter((k) => k.startsWith(prefix)),
    _map: m,
  };
}

export function dirAnalyticsStore(dir = process.env.ANALYTICS_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), '.data', 'analytics')) {
  const f = (k) => path.join(dir, k.replace(/\//g, '__') + '.json');
  return {
    async get(k) { try { return JSON.parse(await fs.readFile(f(k), 'utf8')); } catch { return null; } },
    async set(k, v) { await fs.mkdir(dir, { recursive: true }); const t = f(k) + '.tmp'; await fs.writeFile(t, JSON.stringify(v)); await fs.rename(t, f(k)); },
    async del(k) { await fs.rm(f(k), { force: true }); },
    async list(prefix) { try { return (await fs.readdir(dir)).filter((n) => n.endsWith('.json')).map((n) => n.slice(0, -5).replace(/__/g, '/')).filter((k) => k.startsWith(prefix)); } catch { return []; } },
  };
}

let nodeStore;
export async function nodeAnalyticsHandler(req, res) {
  nodeStore ??= dirAnalyticsStore();
  const chunks = [];
  if (req.method === 'POST') for await (const c of req) chunks.push(c);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || '';
  const r = await handleAnalytics(new Request('http://localhost' + req.url, { method: req.method, headers, body: chunks.length ? Buffer.concat(chunks) : undefined }), {
    store: nodeStore, ip, country: req.headers['x-country'] || '',
  });
  res.writeHead(r.status, Object.fromEntries(r.headers));
  res.end(r.status === 204 ? undefined : await r.text());
}
