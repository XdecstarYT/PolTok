// X Studio queue — owner-only drafts, schedule and posted history. Shared by the Node server and
// netlify/functions/xqueue.mjs. Nothing here talks to X: the owner always posts manually.
//   GET    /api/xqueue                         → { drafts, history, meta }
//   PUT    /api/xqueue/drafts/:id   body draft → { draft }           (upsert)
//   DELETE /api/xqueue/drafts/:id              → { ok }
//   POST   /api/xqueue/drafts/:id/posted {postedUrl?, postedAt?} → { draft, history }
//   POST   /api/xqueue/import {drafts:[]}      → { drafts }           (merge; newer `updated` wins — localStorage sync)
//   PUT    /api/xqueue/meta {lastPostedUpdateAt?, knownUpdateIds?} → { meta }
// Every call needs the owner token (Authorization: Bearer …). Storage: { get(): state|null, set(state) }.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyToken } from './owner.js';

export const LIMITS = { drafts: 300, history: 500, posts: 25, postChars: 1200, cardBytes: 16000, body: 120000 };
const STATUSES = ['draft', 'scheduled', 'posted'];
const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const num = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.round(Number(v)) : undefined);
const idOk = (id) => typeof id === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(id);

export const emptyState = () => ({ drafts: [], history: [], meta: {} });
export function normState(s) {
  const o = s && typeof s === 'object' ? s : {};
  return {
    drafts: Array.isArray(o.drafts) ? o.drafts : [],
    history: Array.isArray(o.history) ? o.history : [],
    meta: o.meta && typeof o.meta === 'object' ? o.meta : {},
  };
}

/** Validate/normalise a draft. Returns null when unusable. */
export function sanitizeDraft(b, id, now = Date.now()) {
  if (!b || typeof b !== 'object') return null;
  const did = id || b.id;
  if (!idOk(did)) return null;
  const posts = (Array.isArray(b.posts) ? b.posts : []).slice(0, LIMITS.posts).map((p) => str(p, LIMITS.postChars));
  if (!posts.length || !posts.some((p) => p.trim())) return null;
  let card = b.card && typeof b.card === 'object' ? b.card : { kind: 'announcement', title: str(b.title, 140) || 'PolTok' };
  if (JSON.stringify(card).length > LIMITS.cardBytes) card = { kind: str(card.kind, 30) || 'announcement', title: str(card.title, 140) || 'PolTok' };
  const src = b.source && typeof b.source === 'object' ? b.source : { type: 'manual' };
  const source =
    src.type === 'update' ? { type: 'update', ids: (Array.isArray(src.ids) ? src.ids : []).filter(idOk).slice(0, 50) }
    : src.type === 'live' ? { type: 'live', template: str(src.template, 40) }
    : { type: 'manual' };
  const badge = b.badge && typeof b.badge === 'object'
    ? { on: !!b.badge.on, corner: ['tl', 'tr', 'bl', 'br'].includes(b.badge.corner) ? b.badge.corner : 'br', label: ['Follow live', 'Live results', 'Watch live'].includes(b.badge.label) ? b.badge.label : 'Follow live' }
    : undefined;
  return {
    id: did,
    title: str(b.title, 160) || posts[0].slice(0, 80),
    posts,
    url: /^https:\/\//.test(b.url) ? str(b.url, 500) : '',
    hashtags: (Array.isArray(b.hashtags) ? b.hashtags : []).map((h) => str(h, 40)).filter(Boolean).slice(0, 10),
    alt: str(b.alt, 1000),
    designId: str(b.designId, 40),
    cardKind: str(b.cardKind, 30) || str(card.kind, 30) || 'announcement',
    card,
    ...(b.brand !== undefined ? { brand: !!b.brand } : {}),
    ...(badge ? { badge } : {}),
    source,
    status: STATUSES.includes(b.status) ? b.status : 'draft',
    ...(num(b.scheduledAt) ? { scheduledAt: num(b.scheduledAt) } : {}),
    ...(num(b.postedAt) ? { postedAt: num(b.postedAt) } : {}),
    ...(/^https:\/\//.test(b.postedUrl || '') ? { postedUrl: str(b.postedUrl, 300) } : {}),
    ...(b.auto ? { auto: true } : {}),
    created: num(b.created) ?? now,
    updated: num(b.updated) ?? now,
  };
}

/** Merge drafts: by id, the one with the newer `updated` wins. */
export function mergeDrafts(base, incoming) {
  const map = new Map(base.map((d) => [d.id, d]));
  for (const d of incoming) {
    const cur = map.get(d.id);
    if (!cur || (d.updated ?? 0) >= (cur.updated ?? 0)) map.set(d.id, d);
  }
  return [...map.values()].sort((a, b) => (b.updated ?? 0) - (a.updated ?? 0));
}

/** Mark a draft posted and add it to history. Pure. */
export function markPosted(state, id, { postedAt = Date.now(), postedUrl } = {}) {
  const d = state.drafts.find((x) => x.id === id);
  if (!d) return null;
  const draft = { ...d, status: 'posted', postedAt, updated: postedAt, ...(postedUrl && /^https:\/\//.test(postedUrl) ? { postedUrl: str(postedUrl, 300) } : {}) };
  const entry = { id: d.id, title: d.title, postedAt, url: d.url || undefined, postedUrl: draft.postedUrl, posts: d.posts.length };
  const history = [entry, ...state.history.filter((h) => h.id !== id)].slice(0, LIMITS.history);
  const meta = { ...state.meta };
  if (d.source?.type === 'update') meta.lastPostedUpdateAt = Math.max(meta.lastPostedUpdateAt || 0, postedAt);
  return { ...state, drafts: state.drafts.map((x) => (x.id === id ? draft : x)), history, meta, draft, entry };
}

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const isOwner = (req, env) => {
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.get('authorization') || '');
  return !!(m && verifyToken(m[1], env));
};

/** Web-standard handler: (Request, { store, env, now }) → Response. */
export async function handleXQueue(req, { store, env = process.env, now = Date.now() } = {}) {
  const p = new URL(req.url, 'http://x').pathname.replace(/\/+$/, '');
  const m = req.method;
  if (!p.startsWith('/api/xqueue')) return json(404, { error: 'not found' });
  if (!isOwner(req, env)) return json(401, { error: 'Owner sign-in required' });
  const state = normState(await store.get().catch(() => null));
  let body = null;
  if (m === 'POST' || m === 'PUT') {
    try {
      const raw = await req.text();
      if (raw.length > LIMITS.body) return json(413, { error: 'too large' });
      body = raw ? JSON.parse(raw) : {};
    } catch {
      return json(400, { error: 'Invalid JSON' });
    }
  }
  if (p === '/api/xqueue') {
    if (m !== 'GET' && m !== 'HEAD') return json(405, { error: 'method not allowed' });
    return json(200, state);
  }
  if (p === '/api/xqueue/meta') {
    if (m !== 'PUT') return json(405, { error: 'method not allowed' });
    const meta = { ...state.meta };
    if (num(body?.lastPostedUpdateAt)) meta.lastPostedUpdateAt = num(body.lastPostedUpdateAt);
    if (Array.isArray(body?.knownUpdateIds)) meta.knownUpdateIds = body.knownUpdateIds.filter(idOk).slice(-500);
    await store.set({ ...state, meta });
    return json(200, { meta });
  }
  if (p === '/api/xqueue/import') {
    if (m !== 'POST') return json(405, { error: 'method not allowed' });
    const incoming = (Array.isArray(body?.drafts) ? body.drafts : []).slice(0, LIMITS.drafts).map((d) => sanitizeDraft(d, undefined, now)).filter(Boolean);
    const drafts = mergeDrafts(state.drafts, incoming).slice(0, LIMITS.drafts);
    await store.set({ ...state, drafts });
    return json(200, { drafts });
  }
  const mm = /^\/api\/xqueue\/drafts\/([^/]+)(\/posted)?$/.exec(p);
  if (!mm) return json(404, { error: 'not found' });
  const id = decodeURIComponent(mm[1]);
  if (!idOk(id)) return json(400, { error: 'bad id' });
  if (mm[2]) {
    if (m !== 'POST') return json(405, { error: 'method not allowed' });
    const r = markPosted(state, id, { postedAt: num(body?.postedAt) ?? now, postedUrl: body?.postedUrl });
    if (!r) return json(404, { error: 'not found' });
    const { draft, entry, ...next } = r;
    await store.set(next);
    return json(200, { draft, history: next.history, entry });
  }
  if (m === 'DELETE') {
    await store.set({ ...state, drafts: state.drafts.filter((d) => d.id !== id) });
    return json(200, { ok: true });
  }
  if (m !== 'PUT') return json(405, { error: 'method not allowed' });
  const draft = sanitizeDraft({ ...body, updated: now }, id, now);
  if (!draft) return json(400, { error: 'A draft needs at least one post' });
  const exists = state.drafts.some((d) => d.id === id);
  if (!exists && state.drafts.length >= LIMITS.drafts) return json(413, { error: 'Queue full — delete old drafts' });
  const drafts = exists ? state.drafts.map((d) => (d.id === id ? draft : d)) : [draft, ...state.drafts];
  await store.set({ ...state, drafts });
  return json(200, { draft });
}

/** In-memory store (tests). */
export const memoryQueueStore = (init = null) => {
  let data = init;
  return { get: async () => data, set: async (v) => void (data = v) };
};

/** File-backed store for the local Node server (XQUEUE_FILE or server/.data/xqueue.json). */
export function fileQueueStore(file = process.env.XQUEUE_FILE || path.join(path.dirname(fileURLToPath(import.meta.url)), '.data', 'xqueue.json')) {
  return {
    async get() {
      try {
        return JSON.parse(await fs.readFile(file, 'utf8'));
      } catch {
        return null;
      }
    },
    async set(v) {
      await fs.mkdir(path.dirname(file), { recursive: true });
      const tmp = file + '.tmp';
      await fs.writeFile(tmp, JSON.stringify(v));
      await fs.rename(tmp, file);
    },
  };
}

let nodeStore;
export async function nodeXQueueHandler(req, res) {
  nodeStore ??= fileQueueStore();
  const chunks = [];
  if (req.method === 'POST' || req.method === 'PUT') for await (const c of req) chunks.push(c);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
  const r = await handleXQueue(new Request('http://localhost' + req.url, { method: req.method, headers, body: chunks.length ? Buffer.concat(chunks) : undefined }), { store: nodeStore });
  res.writeHead(r.status, Object.fromEntries(r.headers));
  res.end(req.method === 'HEAD' ? undefined : await r.text());
}
