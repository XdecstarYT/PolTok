// "What's new" update posts — shared by the Node server and netlify/functions/updates.mjs.
//   GET    /api/updates            → { posts }   (seed merged with owner posts, newest first)
//   GET    /api/updates.rss        → RSS 2.0
//   POST   /api/updates            (owner) body: post → { post }
//   PUT    /api/updates/:id        (owner) body: post → { post }   (editing a seed id stores an override)
//   DELETE /api/updates/:id        (owner) → { ok }                 (deleting a seed id stores a tombstone)
// Storage is pluggable: { get(): Promise<Post[]>, set(Post[]): Promise<void> }.
// Netlify: Netlify Blobs store 'poltok' key 'updates'. Node: JSON file (UPDATES_FILE or server/.data/updates.json).
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyToken } from './owner.js';
import SEED from '../src/features/updates/seed.json' with { type: 'json' };

export const CATEGORIES = ['New', 'Improved', 'Fixed', 'Data'];
export const SITE_URL = 'https://poltok.netlify.app';

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'post';

/** Validate/normalise an owner-submitted post. Returns null when unusable. */
export function sanitizePost(b, id) {
  if (!b || typeof b !== 'object') return null;
  const title = str(b.title, 140);
  const body = str(b.body, 8000);
  if (!title || !body) return null;
  const d = Date.parse(b.date);
  const links = (Array.isArray(b.links) ? b.links : [])
    .slice(0, 6)
    .map((l) => ({ label: str(l?.label, 40), to: str(l?.to, 300) }))
    .filter((l) => l.label && (/^\/(?!\/)/.test(l.to) || /^https:\/\//.test(l.to)));
  const image = str(b.image, 600);
  return {
    id: id || str(b.id, 64).replace(/[^a-z0-9-]/gi, '') || `${slug(title)}-${Date.now().toString(36)}`,
    title,
    body,
    version: str(b.version, 20),
    date: new Date(Number.isFinite(d) ? d : Date.now()).toISOString(),
    categories: (Array.isArray(b.categories) ? b.categories : []).filter((c) => CATEGORIES.includes(c)).slice(0, 4),
    links,
    ...(image && /^(https:\/\/|\/)/.test(image) ? { image, imageAlt: str(b.imageAlt, 200) } : {}),
    ...(b.major ? { major: true } : {}),
    ...(b.draft ? { draft: true } : {}),
  };
}

/** Seed + owner posts: owner entries override seed ids; tombstones hide them. Newest first. */
export function mergePosts(stored = [], { includeDrafts = false } = {}) {
  const map = new Map(SEED.map((p) => [p.id, { ...p, source: 'seed' }]));
  for (const p of stored) {
    if (!p?.id) continue;
    if (p.deleted) map.delete(p.id);
    else map.set(p.id, { ...p, source: map.has(p.id) ? 'edited' : 'owner' });
  }
  return [...map.values()].filter((p) => includeDrafts || !p.draft).sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}

const esc = (s) => String(s).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]);
const plain = (md) => md.replace(/\*\*|`/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

export function toRss(posts, site = SITE_URL) {
  const items = posts
    .slice(0, 50)
    .map(
      (p) => `<item><title>${esc((p.version ? p.version + ' — ' : '') + p.title)}</title><link>${site}/updates#${esc(p.id)}</link><guid isPermaLink="false">${esc(p.id)}</guid><pubDate>${new Date(p.date).toUTCString()}</pubDate>${(p.categories || []).map((c) => `<category>${esc(c)}</category>`).join('')}<description>${esc(plain(p.body))}</description></item>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>PolTok updates</title><link>${site}/updates</link><description>What's new on PolTok</description><language>en</language>\n${items}\n</channel></rss>`;
}

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

const isOwner = (req, env) => {
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.get('authorization') || '');
  return !!(m && verifyToken(m[1], env));
};

/** Web-standard handler: (Request, { store, env }) → Response. */
export async function handleUpdates(req, { store, env = process.env } = {}) {
  const p = new URL(req.url, 'http://x').pathname.replace(/\/+$/, '');
  const m = req.method;
  if (p === '/api/updates.rss') {
    if (m !== 'GET' && m !== 'HEAD') return json(405, { error: 'method not allowed' });
    const posts = mergePosts(await store.get().catch(() => []));
    return new Response(toRss(posts), { status: 200, headers: { 'content-type': 'application/rss+xml; charset=utf-8', 'cache-control': 'public, max-age=300' } });
  }
  const id = p.startsWith('/api/updates/') ? decodeURIComponent(p.slice('/api/updates/'.length)) : '';
  if (p !== '/api/updates' && !id) return json(404, { error: 'not found' });
  if (m === 'GET' || m === 'HEAD') {
    const owner = isOwner(req, env);
    const posts = mergePosts(await store.get().catch(() => []), { includeDrafts: owner });
    if (id) {
      const post = posts.find((x) => x.id === id);
      return post ? json(200, { post }) : json(404, { error: 'not found' });
    }
    return json(200, { posts });
  }
  if (!['POST', 'PUT', 'DELETE'].includes(m)) return json(405, { error: 'method not allowed' });
  if (!isOwner(req, env)) return json(401, { error: 'Owner sign-in required' });
  if ((m === 'POST' && id) || (m !== 'POST' && !id)) return json(400, { error: 'bad path' });
  const stored = (await store.get().catch(() => [])) || [];
  if (m === 'DELETE') {
    const next = stored.filter((x) => x.id !== id);
    if (SEED.some((s) => s.id === id)) next.push({ id, deleted: true });
    await store.set(next);
    return json(200, { ok: true });
  }
  let body;
  try {
    const raw = await req.text();
    if (raw.length > 20000) return json(413, { error: 'too large' });
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }
  const post = sanitizePost(body, m === 'PUT' ? id : undefined);
  if (!post) return json(400, { error: 'Title and body are required' });
  if (m === 'POST' && mergePosts(stored, { includeDrafts: true }).some((x) => x.id === post.id)) post.id += '-' + Date.now().toString(36);
  const next = stored.filter((x) => x.id !== post.id);
  next.push(post);
  if (next.length > 500) return json(413, { error: 'too many posts' });
  await store.set(next);
  return json(m === 'POST' ? 201 : 200, { post });
}

/** In-memory store (tests). */
export const memoryStore = (init = []) => {
  let data = init;
  return { get: async () => data, set: async (v) => void (data = v) };
};

/** File-backed store for the local Node server. */
export function fileStore(file = process.env.UPDATES_FILE || path.join(path.dirname(fileURLToPath(import.meta.url)), '.data', 'updates.json')) {
  return {
    async get() {
      try {
        const d = JSON.parse(await fs.readFile(file, 'utf8'));
        return Array.isArray(d) ? d : [];
      } catch {
        return [];
      }
    },
    async set(v) {
      await fs.mkdir(path.dirname(file), { recursive: true });
      const tmp = file + '.tmp';
      await fs.writeFile(tmp, JSON.stringify(v, null, 1));
      await fs.rename(tmp, file);
    },
  };
}

let nodeStore;
export async function nodeUpdatesHandler(req, res) {
  nodeStore ??= fileStore();
  const chunks = [];
  if (req.method === 'POST' || req.method === 'PUT') for await (const c of req) chunks.push(c);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
  const r = await handleUpdates(new Request('http://localhost' + req.url, { method: req.method, headers, body: chunks.length ? Buffer.concat(chunks) : undefined }), { store: nodeStore });
  res.writeHead(r.status, Object.fromEntries(r.headers));
  res.end(req.method === 'HEAD' ? undefined : await r.text());
}
