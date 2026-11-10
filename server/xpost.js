// "Publish to X" — owner-only, real posting through the X API. Shared by the Node server (/api/xpost) and
// netlify/functions/xpost.mjs.
//   GET  /api/xpost → { configured }                                  (owner token required)
//   POST /api/xpost   multipart/form-data:
//          payload = JSON { posts: string[1..4], alt?, updateId?, draft?, force? }
//          image   = PNG file (≤ 5 MB, optional but normally the 1200×675 card)
//        → { ok, configured:true, ids, urls, recorded, warnings }
//        | { configured:false }                                        (X env vars missing)
//        | { error, code, … }                                          (4xx/5xx with a readable message)
// Flow: POST api.x.com/2/media/upload (base64 JSON) → POST /2/media/metadata (alt text) → POST /2/tweets
// (media_ids on the first post; replies chained with reply.in_reply_to_tweet_id).
// Auth to X: OAuth 1.0a user context, HMAC-SHA1 via node:crypto. Env (server only, never sent to the
// client, never logged): X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET.
import crypto from 'node:crypto';
import { verifyToken } from './owner.js';
import { markPosted, normState, sanitizeDraft } from './xqueue.js';

export const X_API = 'https://api.x.com';
export const XPOST_LIMITS = { posts: 4, chars: 280, imageBytes: 5 * 1024 * 1024, alt: 1000, body: 5.5 * 1024 * 1024 };
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/* ─────────────────────────── OAuth 1.0a (RFC 5849) ─────────────────────────── */

/** RFC 3986 percent-encoding as X requires (encodeURIComponent leaves !'()* alone). */
export const pct = (s) => encodeURIComponent(String(s)).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

/** Signature base string: METHOD&pct(baseUrl)&pct(sorted, encoded params). */
export function signatureBaseString(method, url, params) {
  const u = new URL(url);
  const all = [...Object.entries(params)];
  for (const [k, v] of u.searchParams) all.push([k, v]);
  const enc = all.map(([k, v]) => [pct(k), pct(v)]).sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : 1) : a[0] < b[0] ? -1 : 1));
  const base = `${u.protocol}//${u.host.toLowerCase()}${u.pathname}`;
  return [method.toUpperCase(), pct(base), pct(enc.map(([k, v]) => `${k}=${v}`).join('&'))].join('&');
}

/** HMAC-SHA1 signature (base64). */
export function oauthSignature(method, url, params, consumerSecret, tokenSecret = '') {
  const key = `${pct(consumerSecret)}&${pct(tokenSecret)}`;
  return crypto.createHmac('sha1', key).update(signatureBaseString(method, url, params)).digest('base64');
}

/**
 * Authorization header for one request. `bodyParams` only for application/x-www-form-urlencoded bodies;
 * JSON and multipart bodies are not part of the signature (query-string params always are).
 */
export function oauthHeader({ method, url, creds, bodyParams = {}, nonce = crypto.randomBytes(16).toString('hex'), timestamp = Math.floor(Date.now() / 1000) }) {
  const oauth = {
    oauth_consumer_key: creds.apiKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(timestamp),
    oauth_token: creds.accessToken,
    oauth_version: '1.0',
  };
  const sig = oauthSignature(method, url, { ...bodyParams, ...oauth }, creds.apiSecret, creds.accessSecret);
  const all = { ...oauth, oauth_signature: sig };
  return 'OAuth ' + Object.keys(all).sort().map((k) => `${pct(k)}="${pct(all[k])}"`).join(', ');
}

/** The four X credentials from env, or null when any is missing. */
export function xCreds(env = process.env) {
  const c = { apiKey: env.X_API_KEY, apiSecret: env.X_API_SECRET, accessToken: env.X_ACCESS_TOKEN, accessSecret: env.X_ACCESS_SECRET };
  return Object.values(c).every((v) => typeof v === 'string' && v.trim()) ? Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v.trim()])) : null;
}

/* ─────────────────── X weighted length (JS port of src/features/owner/xstudio/xtext.ts) ─────────────────── */
const LIGHT = [[0, 4351], [8192, 8205], [8208, 8223], [8242, 8247]];
const TLD = '(?:com|net|org|app|io|co|gov|edu|au|nz|uk|us|ai|dev|news|tv|me|info|ly|gg|xyz)';
const URL_RE = new RegExp(`(?:https?:\\/\\/[^\\s<>"]+|\\b(?:[a-z0-9-]+\\.)+${TLD}\\b(?:\\/[^\\s<>"]*)?)`, 'gi');
const EMOJI_RE = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;
const cpWeight = (cp) => (LIGHT.some(([a, b]) => cp >= a && cp <= b) ? 1 : 2);
const graphemes = (s) => (Intl.Segmenter ? [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(s)].map((x) => x.segment) : [...s]);
const plainWeight = (s) => graphemes(s).reduce((n, g) => n + (EMOJI_RE.test(g) ? 2 : [...g].reduce((m, ch) => m + cpWeight(ch.codePointAt(0)), 0)), 0);
export function xLength(text) {
  const s = String(text ?? '').normalize('NFC');
  let n = 0;
  let last = 0;
  for (const m of s.matchAll(URL_RE)) {
    const url = m[0].replace(/[.,!?;:)\]'"…]+$/, '');
    n += plainWeight(s.slice(last, m.index)) + 23;
    last = m.index + url.length;
  }
  return n + plainWeight(s.slice(last));
}

/* ─────────────────────────────── validation ─────────────────────────────── */

/** Validate the publish payload (+ image bytes). Returns { ok, value } or { ok:false, error }. */
export function validatePublish(payload, image) {
  if (!payload || typeof payload !== 'object') return { ok: false, error: 'Missing payload' };
  const posts = payload.posts;
  if (!Array.isArray(posts) || !posts.length) return { ok: false, error: 'At least one post is required' };
  if (posts.length > XPOST_LIMITS.posts) return { ok: false, error: `A thread can have at most ${XPOST_LIMITS.posts} posts` };
  for (const [i, p] of posts.entries()) {
    if (typeof p !== 'string' || !p.trim()) return { ok: false, error: `Post ${i + 1} is empty` };
    const n = xLength(p);
    if (n > XPOST_LIMITS.chars) return { ok: false, error: `Post ${i + 1} is ${n}/${XPOST_LIMITS.chars} characters — shorten it` };
  }
  if (payload.alt != null && (typeof payload.alt !== 'string' || payload.alt.length > XPOST_LIMITS.alt)) return { ok: false, error: `Alt text must be ≤ ${XPOST_LIMITS.alt} characters` };
  if (payload.updateId != null && !(typeof payload.updateId === 'string' && /^[A-Za-z0-9_.-]{1,120}$/.test(payload.updateId))) return { ok: false, error: 'Bad updateId' };
  if (image) {
    if (image.bytes.length > XPOST_LIMITS.imageBytes) return { ok: false, error: 'Image is larger than 5 MB' };
    if (image.type && image.type !== 'image/png') return { ok: false, error: 'Image must be a PNG' };
    if (image.bytes.length < 8 || PNG_MAGIC.some((b, i) => image.bytes[i] !== b)) return { ok: false, error: 'Image must be a PNG' };
  }
  return {
    ok: true,
    value: { posts: posts.map((p) => p.trim()), alt: (payload.alt || '').trim(), updateId: payload.updateId || null, draft: payload.draft && typeof payload.draft === 'object' ? payload.draft : null, force: payload.force === true },
  };
}

/* ─────────────────────────────── rate limiting ─────────────────────────────── */
// Per warm instance: 5 publish attempts / 10 min per IP and 20 / hour overall (on top of X's own limits).
const hits = new Map();
let globalHits = [];
export function publishAllowed(ip, now = Date.now()) {
  globalHits = globalHits.filter((t) => now - t < 3600e3);
  const mine = (hits.get(ip) || []).filter((t) => now - t < 600e3);
  if (mine.length >= 5) return { ok: false, retryAfter: Math.ceil((mine[0] + 600e3 - now) / 1000) };
  if (globalHits.length >= 20) return { ok: false, retryAfter: Math.ceil((globalHits[0] + 3600e3 - now) / 1000) };
  if (hits.size > 2000) hits.clear();
  hits.set(ip, [...mine, now]);
  globalHits.push(now);
  return { ok: true };
}
export const resetRateLimit = () => {
  hits.clear();
  globalHits = [];
};

/* ─────────────────────────────── X API calls ─────────────────────────────── */

export class XApiError extends Error {
  constructor(message, { status = 502, code = 'x_error', retryAfter } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

/** Readable error for an X API failure (never includes request headers / secrets). */
export function xError(status, body, headers, step = 'X') {
  const text = [body?.detail, body?.title, body?.errors?.map?.((e) => e.message || e.detail).join('; '), body?.error, typeof body === 'string' ? body : ''].filter(Boolean).join(' — ').slice(0, 300);
  if (status === 429) {
    const reset = Number(headers?.get?.('x-rate-limit-reset'));
    const retryAfter = Number.isFinite(reset) && reset > 0 ? Math.max(1, Math.ceil(reset - Date.now() / 1000)) : 900;
    const mins = Math.ceil(retryAfter / 60);
    return new XApiError(`X rate limit reached (${step}). Try again in about ${mins} minute${mins === 1 ? '' : 's'}.`, { status: 429, code: 'rate_limited', retryAfter });
  }
  if (/duplicate/i.test(text)) return new XApiError('X rejected this as a duplicate of one of your recent posts. Change the text a little and try again.', { status: 409, code: 'duplicate' });
  if (status === 401) return new XApiError('X rejected the credentials (401). Check the four X_ environment variables, then regenerate the access token and secret if needed.', { status: 502, code: 'x_auth' });
  if (status === 403 && /oauth1-permissions|not permitted|read-only|permission/i.test(text + JSON.stringify(body?.type ?? ''))) {
    return new XApiError('Your X app does not have Read and Write permission. Switch it to Read and Write at developer.x.com, regenerate the access token and secret, update the env vars and redeploy.', { status: 502, code: 'x_permissions' });
  }
  if (status === 402 || /credit|client-not-enrolled|tier|access level/i.test(text)) return new XApiError(`Your X developer account cannot use this endpoint yet (${status}). ${text}`.trim(), { status: 502, code: 'x_access' });
  return new XApiError(`${step} failed: X API ${status}${text ? ' — ' + text : ''}`, { status: 502, code: 'x_error' });
}

async function xFetch(fetchImpl, creds, url, json, step) {
  let r;
  try {
    r = await fetchImpl(url, {
      method: 'POST',
      headers: { authorization: oauthHeader({ method: 'POST', url, creds }), 'content-type': 'application/json' },
      body: JSON.stringify(json),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new XApiError(`${step} failed: could not reach X (network or timeout).`, { status: 504, code: 'x_unreachable' });
  }
  const raw = await r.text().catch(() => '');
  let body;
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    body = raw.slice(0, 200);
  }
  if (!r.ok) throw xError(r.status, body, r.headers, step);
  return body;
}

export const tweetUrl = (id) => `https://x.com/i/status/${id}`;

/** Upload image (+ alt) and post the thread. Returns { ids, urls, warnings }; throws XApiError (with .partial). */
export async function publishThread({ posts, image, alt }, { creds, fetchImpl = fetch }) {
  const warnings = [];
  let mediaId = null;
  if (image) {
    const up = await xFetch(fetchImpl, creds, `${X_API}/2/media/upload`, { media: Buffer.from(image.bytes).toString('base64'), media_category: 'tweet_image' }, 'Image upload');
    mediaId = up?.data?.id ?? up?.media_id_string;
    if (!mediaId) throw new XApiError('Image upload failed: X returned no media id.', { code: 'x_error' });
    if (alt) {
      try {
        await xFetch(fetchImpl, creds, `${X_API}/2/media/metadata`, { id: String(mediaId), metadata: { alt_text: { text: alt.slice(0, 1000) } } }, 'Alt text');
      } catch (e) {
        warnings.push('Alt text could not be set: ' + e.message);
      }
    }
  }
  const ids = [];
  for (const [i, text] of posts.entries()) {
    const body = { text };
    if (i === 0 && mediaId) body.media = { media_ids: [String(mediaId)] };
    if (i > 0) body.reply = { in_reply_to_tweet_id: ids[i - 1] };
    try {
      const d = await xFetch(fetchImpl, creds, `${X_API}/2/tweets`, body, posts.length > 1 ? `Post ${i + 1}/${posts.length}` : 'Post');
      if (!d?.data?.id) throw new XApiError('X returned no post id.', { code: 'x_error' });
      ids.push(String(d.data.id));
    } catch (e) {
      e.partial = { ids: [...ids], urls: ids.map(tweetUrl) };
      throw e;
    }
  }
  return { ids, urls: ids.map(tweetUrl), warnings };
}

/* ─────────────────────────────── queue history ─────────────────────────────── */

/** Posted draft for an update, if any (any posted draft whose source covers this update id). */
export function postedForUpdate(state, updateId) {
  if (!updateId) return null;
  return normState(state).drafts.find((d) => d.status === 'posted' && d.source?.type === 'update' && Array.isArray(d.source.ids) && d.source.ids.includes(updateId)) || null;
}

async function record(store, draft, posts, urls, updateId, now) {
  if (!store || !draft) return false;
  const state = normState(await store.get().catch(() => null));
  const src = updateId ? { type: 'update', ids: [updateId] } : draft.source;
  const clean = sanitizeDraft({ ...draft, posts, source: src, status: 'draft', updated: now }, undefined, now);
  if (!clean) return false;
  const drafts = [clean, ...state.drafts.filter((d) => d.id !== clean.id)];
  const r = markPosted({ ...state, drafts }, clean.id, { postedAt: now, postedUrl: urls[0] });
  if (!r) return false;
  const { draft: _d, entry: _e, ...next } = r;
  await store.set(next);
  return true;
}

/* ─────────────────────────────── handler ─────────────────────────────── */

const json = (status, body, extra = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra } });
const isOwner = (req, env) => {
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.get('authorization') || '');
  return !!(m && verifyToken(m[1], env));
};

/** Web-standard handler: (Request, { env, ip, store, fetchImpl, now }) → Response. */
export async function handleXPost(req, { env = process.env, ip = 'anon', store = null, fetchImpl = fetch, now = Date.now() } = {}) {
  const p = new URL(req.url, 'http://x').pathname.replace(/\/+$/, '');
  if (p !== '/api/xpost') return json(404, { error: 'not found' });
  if (!isOwner(req, env)) return json(401, { error: 'Owner sign-in required', code: 'unauthorized' });
  const creds = xCreds(env);
  if (req.method === 'GET' || req.method === 'HEAD') return json(200, { configured: !!creds });
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' });
  if (!creds) return json(200, { configured: false });
  if (Number(req.headers.get('content-length') || 0) > XPOST_LIMITS.body) return json(413, { error: 'Request too large (image must be ≤ 5 MB)', code: 'too_large' });
  const rl = publishAllowed(ip, now);
  if (!rl.ok) return json(429, { error: `Too many publish attempts — try again in ${rl.retryAfter}s.`, code: 'rate_limited', retryAfter: rl.retryAfter }, { 'retry-after': String(rl.retryAfter) });

  let payload;
  let image = null;
  try {
    const ct = req.headers.get('content-type') || '';
    if (ct.includes('multipart/form-data')) {
      const fd = await req.formData();
      payload = JSON.parse(String(fd.get('payload') ?? ''));
      const f = fd.get('image');
      if (f && typeof f === 'object' && 'arrayBuffer' in f) image = { type: f.type || '', bytes: new Uint8Array(await f.arrayBuffer()) };
    } else {
      const raw = await req.text();
      if (raw.length > 200000) return json(413, { error: 'Request too large', code: 'too_large' });
      payload = JSON.parse(raw || '{}');
    }
  } catch {
    return json(400, { error: 'Invalid request body', code: 'bad_request' });
  }
  const v = validatePublish(payload, image);
  if (!v.ok) return json(400, { error: v.error, code: 'invalid' });
  const { posts, alt, updateId, draft, force } = v.value;

  if (store && updateId && !force) {
    const prev = postedForUpdate(await store.get().catch(() => null), updateId);
    if (prev) return json(409, { error: 'This update was already posted to X.', code: 'already_posted', postedUrl: prev.postedUrl, postedAt: prev.postedAt });
  }

  try {
    const res = await publishThread({ posts, image, alt }, { creds, fetchImpl });
    let recorded = false;
    try {
      recorded = await record(store, draft, posts, res.urls, updateId, now);
    } catch {
      res.warnings.push('Posted, but the X queue history could not be updated.');
    }
    return json(200, { ok: true, configured: true, ...res, recorded });
  } catch (e) {
    const err = e instanceof XApiError ? e : new XApiError('Publishing failed unexpectedly.', { code: 'x_error' });
    const partial = e?.partial?.ids?.length ? e.partial : undefined;
    if (partial) {
      try {
        await record(store, draft, posts.slice(0, partial.ids.length), partial.urls, updateId, now);
      } catch {
        /* ignore */
      }
    }
    // status/code only — never the request, headers or env
    console.warn('[xpost] publish failed:', err.code, err.status);
    return json(err.status, { error: err.message, code: err.code, ...(err.retryAfter ? { retryAfter: err.retryAfter } : {}), ...(partial ? { partial } : {}) }, err.retryAfter ? { 'retry-after': String(err.retryAfter) } : {});
  }
}

/** Node adapter for server/index.js (shares the X queue file store). */
export async function nodeXPostHandler(req, res) {
  const { fileQueueStore } = await import('./xqueue.js');
  const chunks = [];
  let size = 0;
  if (req.method === 'POST') {
    for await (const c of req) {
      size += c.length;
      if (size > XPOST_LIMITS.body + 1024) {
        res.writeHead(413, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Request too large (image must be ≤ 5 MB)', code: 'too_large' }));
      }
      chunks.push(c);
    }
  }
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
  const r = await handleXPost(new Request('http://localhost' + req.url, { method: req.method, headers, body: chunks.length ? Buffer.concat(chunks) : undefined }), {
    ip: req.socket?.remoteAddress || 'anon',
    store: fileQueueStore(),
  });
  res.writeHead(r.status, Object.fromEntries(r.headers));
  res.end(req.method === 'HEAD' ? undefined : await r.text());
}
