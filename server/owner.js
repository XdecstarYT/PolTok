// Owner panel auth — shared by the Node server (/api/owner/*) and netlify/functions/owner.mjs.
//   POST /api/owner/login {user, pass} → { ok, token, exp }   (per-IP rate limited)
//   GET  /api/owner/me   (Authorization: Bearer <token>) → { ok, user, exp } | 401
// Env: OWNER_USER + OWNER_PASS (override built-in credentials), OWNER_SECRET (HMAC key for tokens).
// The built-in credential is stored ONLY as SHA-256("user:pass"); no plaintext password anywhere.
// Without OWNER_SECRET the signing key is derived from the deployment's GROQ secret (+ the hash).
import crypto from 'node:crypto';

const CRED_HASH = '7a93cf433a1bf618a771bb30605a0c7721ac80a20ce5f472b8bf08ade865f69f';
const TTL_MS = 12 * 3600 * 1000;
const sha = (s) => crypto.createHash('sha256').update(s).digest();
// Signing key: OWNER_SECRET if set; otherwise derived from a deployment secret that never ships in
// the repo (the GROQ API key on Netlify), so tokens can't be forged from public source code.
const secret = (env) =>
  env.OWNER_SECRET ||
  crypto.createHash('sha256').update('poltok-owner-token|' + (env.GROQ || env.GROQ_API_KEY || '') + '|' + CRED_HASH).digest('hex');
const eq = (a, b) => a.length === b.length && crypto.timingSafeEqual(a, b);
const b64u = (s) => Buffer.from(s).toString('base64url');

export function checkCreds(user, pass, env = process.env) {
  if (typeof user !== 'string' || typeof pass !== 'string' || user.length > 200 || pass.length > 200) return false;
  if (env.OWNER_USER && env.OWNER_PASS) return eq(sha(user), sha(env.OWNER_USER)) && eq(sha(pass), sha(env.OWNER_PASS));
  return eq(sha(user + ':' + pass), Buffer.from(CRED_HASH, 'hex'));
}

export function signToken(user, env = process.env, now = Date.now()) {
  const payload = b64u(JSON.stringify({ u: user, exp: now + TTL_MS }));
  const sig = crypto.createHmac('sha256', secret(env)).update(payload).digest('base64url');
  return { token: payload + '.' + sig, exp: now + TTL_MS };
}

export function verifyToken(token, env = process.env, now = Date.now()) {
  if (typeof token !== 'string' || token.length > 2000) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const want = crypto.createHmac('sha256', secret(env)).update(payload).digest('base64url');
  if (!eq(Buffer.from(sig), Buffer.from(want))) return null;
  try {
    const d = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return d && typeof d.exp === 'number' && d.exp > now ? d : null;
  } catch {
    return null;
  }
}

/* per-IP login limiter: 5 attempts per 10 min window (per warm instance) */
const attempts = new Map();
export function loginAllowed(ip, now = Date.now()) {
  const w = attempts.get(ip);
  if (!w || now - w.at > 10 * 60000) {
    if (attempts.size > 5000) attempts.clear();
    attempts.set(ip, { at: now, n: 1 });
    return { ok: true };
  }
  w.n += 1;
  return w.n > 5 ? { ok: false, retryAfter: Math.ceil((w.at + 10 * 60000 - now) / 1000) } : { ok: true };
}

const jsonRes = (status, body, extra = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra } });

/** Web-standard handler: (Request, {ip, env}) → Response. */
export async function handleOwner(req, { ip = 'anon', env = process.env } = {}) {
  const p = new URL(req.url, 'http://x').pathname.replace(/\/+$/, '');
  if (p === '/api/owner/login') {
    if (req.method !== 'POST') return jsonRes(405, { error: 'method not allowed' });
    const rl = loginAllowed(ip);
    if (!rl.ok) return jsonRes(429, { error: 'Too many attempts — try again in ' + rl.retryAfter + 's.' }, { 'retry-after': String(rl.retryAfter) });
    let body;
    try {
      const raw = await req.text();
      if (raw.length > 2000) return jsonRes(413, { error: 'too large' });
      body = JSON.parse(raw);
    } catch {
      return jsonRes(400, { error: 'Invalid JSON' });
    }
    const user = String(body?.user ?? '').trim();
    if (!checkCreds(user, body?.pass, env)) {
      await new Promise((r) => setTimeout(r, 400));
      return jsonRes(401, { error: 'Invalid credentials' });
    }
    attempts.delete(ip);
    return jsonRes(200, { ok: true, user, ...signToken(user, env) });
  }
  if (p === '/api/owner/me') {
    const tok = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const d = verifyToken(tok, env);
    return d ? jsonRes(200, { ok: true, user: d.u, exp: d.exp }) : jsonRes(401, { error: 'unauthorized' });
  }
  return jsonRes(404, { error: 'not found' });
}

/** Node adapter for server/index.js. */
export async function nodeOwnerHandler(req, res) {
  const chunks = [];
  if (req.method === 'POST') for await (const c of req) chunks.push(c);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
  const r = await handleOwner(new Request('http://localhost' + req.url, { method: req.method, headers, body: req.method === 'POST' ? Buffer.concat(chunks) : undefined }), {
    ip: req.socket?.remoteAddress || 'anon',
  });
  res.writeHead(r.status, Object.fromEntries(r.headers));
  res.end(await r.text());
}
