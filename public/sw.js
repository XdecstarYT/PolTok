/* PolTok service worker. Hand-written, no build step.
 * - App shell: precaches "/" plus the hashed JS/CSS referenced by the built index.html.
 * - /api/stream (SSE) and any text/event-stream request are NEVER intercepted.
 * - /api/* and NYT JSON: network-first, short-lived cache fallback (offline only).
 * - Static assets, icons, geo, Google Fonts: stale-while-revalidate.
 * - Navigations: network-first -> cached shell -> inline offline page. */
const VERSION = 'poltok-v1';
const SHELL = `${VERSION}-shell`;
const STATIC = `${VERSION}-static`;
const DATA = `${VERSION}-data`;
const DATA_MAX_AGE = 10 * 60 * 1000; // stale data older than 10 min is not served
const DATA_MAX_ENTRIES = 80;

const OFFLINE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PolTok — offline</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#05070d;color:#f2f5ff;font:16px/1.5 Inter,system-ui,sans-serif;text-align:center;padding:16px}
p{color:#a3adc8}button{margin-top:12px;background:#3d7bff;color:#fff;border:0;border-radius:8px;padding:10px 18px;font:inherit;cursor:pointer}</style></head>
<body><main><img src="/favicon.svg" width="64" height="64" alt=""><h1>You're offline</h1><p>PolTok needs a connection for live results.<br>Reconnect and try again.</p>
<button onclick="location.reload()">Retry</button></main></body></html>`;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    const core = ['/', '/manifest.webmanifest', '/favicon.svg', '/icons/icon-192.png', '/icons/icon-512.png'];
    await Promise.all(core.map((u) => cache.add(new Request(u, { cache: 'reload' })).catch(() => {})));
    // Precache the hashed entry assets the built shell references.
    try {
      const res = await cache.match('/');
      const html = res ? await res.text() : '';
      const entry = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
      await Promise.all(entry.map((u) => cache.add(u).catch(() => {})));
      // Lazy route chunks: Vite's entry JS lists them (dynamic imports / preload map).
      const found = new Set();
      for (const u of entry.filter((x) => x.endsWith('.js'))) {
        const js = await (await cache.match(u))?.text();
        for (const m of (js || '').matchAll(/assets\/[\w.-]+\.(?:js|css)/g)) found.add('/' + m[0]);
      }
      const statics = await caches.open(STATIC);
      await Promise.all([...found].filter((u) => !entry.includes(u)).map((u) => statics.add(u).catch(() => {})));
    } catch { /* best effort */ }
  })());
  // Do not skipWaiting automatically: the page shows "Update available" and asks us.
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)));
    if (self.registration.navigationPreload) await self.registration.navigationPreload.enable().catch(() => {});
    await self.clients.claim();
  })());
});

const isNYT = (url) => url.hostname === 'static01.nyt.com' && url.pathname.includes('/elections-assets/');
const isFont = (url) => url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Never touch streams.
  if (url.pathname.startsWith('/api/stream') || (req.headers.get('accept') || '').includes('text/event-stream')) return;
  if (req.cache === 'only-if-cached' && req.mode !== 'same-origin') return;

  if (req.mode === 'navigate') return event.respondWith(navigate(event));
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) return event.respondWith(networkFirstData(req));
  if (isNYT(url) && url.pathname.endsWith('.json')) return event.respondWith(networkFirstData(req));
  if (isFont(url)) return event.respondWith(staleWhileRevalidate(req, STATIC));
  if (url.origin === self.location.origin) return event.respondWith(staleWhileRevalidate(req, STATIC));
  // Other cross-origin requests pass through untouched.
});

async function navigate(event) {
  const cache = await caches.open(SHELL);
  try {
    const preload = await event.preloadResponse;
    const res = preload || (await fetch(event.request));
    if (res.ok) cache.put('/', res.clone()); // SPA: every route serves the same index.html
    return res;
  } catch {
    const shell = await cache.match('/');
    return shell || new Response(OFFLINE_HTML, { status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } });
  }
}

async function networkFirstData(req) {
  const cache = await caches.open(DATA);
  try {
    const res = await fetch(req);
    if (res.ok) {
      const headers = new Headers(res.headers);
      headers.set('x-sw-cached-at', String(Date.now()));
      const body = await res.clone().blob();
      await cache.put(req, new Response(body, { status: res.status, statusText: res.statusText, headers }));
      trim(cache, DATA_MAX_ENTRIES);
    }
    return res;
  } catch (err) {
    const hit = await cache.match(req);
    if (hit && Date.now() - Number(hit.headers.get('x-sw-cached-at') || 0) < DATA_MAX_AGE) return hit;
    return new Response(JSON.stringify({ error: 'offline' }), { status: 503, headers: { 'content-type': 'application/json' } });
  }
}

async function staleWhileRevalidate(req, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(req);
  const net = fetch(req).then((res) => {
    if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
    return res;
  }).catch(() => undefined);
  if (hit) return hit;
  const res = await net;
  if (res) return res;
  const shell = await caches.match(req);
  return shell || new Response('', { status: 504 });
}

async function trim(cache, max) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}
