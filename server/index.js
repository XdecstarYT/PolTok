// PolTok API server — plain node:http (Node 22 ESM). See docs/ARCHITECTURE.md "API contract".
//   GET /api/health      { ok, mode, uptime, ... }
//   GET /api/stream      SSE of LiveEvent (hello, results, balance, markets, news, then live updates)
//   GET /api/news        { items, fetchedAt, sources }   (?limit=&tag=&lean=&source=&q=)
//   GET /api/snapshot    { mode, results, balance, markets, clock }
//   GET /api/polls       PollSeries[]
// Serves dist/ (SPA fallback) when NODE_ENV=production or dist/index.html exists.
//
// Env: PORT (8787), RESULTS_MODE (simulation|live), SIM_SPEED, SIM_SEED, SIM_LOOP, SIM_START_AT,
//      RESULTS_FEED_URL, NEWS_DISABLED=1 (skip RSS fetching, e.g. offline tests).
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Node's fetch ignores HTTPS_PROXY unless NODE_USE_ENV_PROXY=1 is set at startup. In proxied
// environments (CI / sandboxes) re-launch ourselves with it so RSS fetching works.
if ((process.env.HTTPS_PROXY || process.env.https_proxy) && !process.env.NODE_USE_ENV_PROXY && !process.env.POLTOK_NO_REEXEC) {
  const child = spawn(process.execPath, [...process.execArgv, ...process.argv.slice(1)], {
    stdio: 'inherit',
    env: { ...process.env, NODE_USE_ENV_PROXY: '1', NODE_NO_WARNINGS: '1' },
  });
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => child.kill(sig));
  child.on('exit', (code, sig) => process.exit(sig ? 1 : (code ?? 0)));
} else {
  await main();
}

async function main() {
  const { STATES, RACES, POLL_SERIES } = await import('../shared/data/index.js');
  const { createResultsProvider } = await import('./results-provider.js');
  const { createNytProvider } = await import('../shared/nyt.js');
  const { createNewsService } = await import('./news.js');
  const { createStatic } = await import('./static.js');
  const { createAuApi } = await import('./au.js');

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const PORT = Number(process.env.PORT) || 8787;
  const started = Date.now();
  const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

  /* ------------------------------ SSE hub ------------------------------ */
  const clients = new Set(); // every SSE response
  const channels = { simulation: new Set(), live: new Set() };
  function broadcast(ev, source) {
    const chunk = `data: ${JSON.stringify(ev)}\n\n`;
    const targets = source ? channels[source] : clients;
    for (const c of targets) {
      try {
        c.write(chunk);
      } catch {
        clients.delete(c);
      }
    }
  }

  /* ------------------------------ services ----------------------------- */
  // Two result sources run side by side; each SSE client picks one with ?source=live|simulation.
  // Each provider gets its own copy of the race list (the live provider syncs candidate names).
  const providers = {
    simulation: createResultsProvider({ races: structuredClone(RACES), states: STATES, log, env: { ...process.env, RESULTS_MODE: 'simulation' } }),
    live:
      (process.env.RESULTS_MODE || '').toLowerCase() === 'live' && process.env.RESULTS_FEED_URL
        ? createResultsProvider({ races: structuredClone(RACES), states: STATES, log })
        : Object.assign(createNytProvider({ races: structuredClone(RACES), states: STATES, log }), { mode: 'live' }),
  };
  const DEFAULT_SOURCE = (process.env.DEFAULT_SOURCE || 'live').toLowerCase() === 'simulation' ? 'simulation' : 'live';
  const pick = (q) => (q === 'simulation' || q === 'sim' ? 'simulation' : q === 'live' ? 'live' : DEFAULT_SOURCE);
  let liveStarted = false;
  for (const [name, pr] of Object.entries(providers)) pr.subscribe((ev) => broadcast(ev, name));
  providers.simulation.start();
  // Start polling the live feed lazily, on first use.
  const ensure = (source) => {
    if (source === 'live' && !liveStarted) {
      liveStarted = true;
      providers.live.start();
    }
    return providers[source];
  };
  if (DEFAULT_SOURCE === 'live') ensure('live');
  log(`[results] sources: simulation + live (default ${DEFAULT_SOURCE}) races=${RACES.length} states=${STATES.length}`);

  const news = createNewsService({
    log,
    onNew: (items) => broadcast({ type: 'news', items }),
  });
  if (process.env.NEWS_DISABLED !== '1') news.start();

  const au = createAuApi({ log });

  const statics = createStatic(path.join(__dirname, '..', 'dist'));

  /* ------------------------------ helpers ------------------------------ */
  const CORS = {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, HEAD, POST, OPTIONS',
    'access-control-allow-headers': 'content-type, cache-control, last-event-id',
  };
  function json(res, status, body, extra = {}) {
    const s = JSON.stringify(body);
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...CORS, ...extra });
    res.end(s);
  }

  function handleStream(req, res, source) {
    const pr = ensure(source);
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
      ...CORS,
    });
    res.socket?.setNoDelay?.(true);
    const send = (ev) => res.write(`data: ${JSON.stringify(ev)}\n\n`);
    res.write('retry: 3000\n\n');
    const snap = pr.snapshot();
    send({ type: 'hello', serverTime: Date.now(), mode: source === 'live' ? 'live' : 'simulation' });
    send({ type: 'results', results: snap.results });
    send({ type: 'balance', balance: snap.balance });
    send({ type: 'markets', markets: snap.markets });
    const recent = news.recent(60);
    if (recent.length) send({ type: 'news', items: recent });
    clients.add(res);
    channels[source].add(res);
    const hb = setInterval(() => {
      try {
        res.write(`: heartbeat ${Date.now()}\n\n`);
      } catch {
        /* closed */
      }
    }, 15000);
    const done = () => {
      clearInterval(hb);
      clients.delete(res);
      channels[source].delete(res);
    };
    req.on('close', done);
    res.on('error', done);
  }

  /* ------------------------------ router ------------------------------- */
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://localhost');
    const p = url.pathname;
    try {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, CORS);
        return res.end();
      }
      if (p.startsWith('/api/')) {
        if (p === '/api/ai') return (await import('./ai.js')).nodeAiHandler(req, res);
        if (p.startsWith('/api/owner')) return (await import('./owner.js')).nodeOwnerHandler(req, res);
        if (p === '/api/updates' || p === '/api/updates.rss' || p.startsWith('/api/updates/')) return (await import('./updates.js')).nodeUpdatesHandler(req, res);
        if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'method not allowed' });
        if (p.startsWith('/api/au/') && (await au.handle(p, url, json, res))) return;
        if (p.startsWith('/api/parliament')) return (await import('./parliament.js')).nodeParliamentHandler(p, url, json, res);
        if (p.startsWith('/api/members')) return (await import('./members.js')).nodeMembersHandler(p, url, json, res);
        if (p === '/api/calendar' || p === '/api/calendar.ics') return (await import('./calendar.js')).nodeCalendarHandler(p, url, res);
        if (p.startsWith('/api/nz')) return (await import('./nz.js')).nodeNzHandler(p, url, json, res);
        if (p.startsWith('/api/world')) return (await import('./world.js')).nodeWorldHandler(p, url, json, res);
        if (p.startsWith('/api/candidates')) return (await import('./candidates.js')).nodeCandidatesHandler(p, url, json, res);
        if (p.startsWith('/api/money')) return (await import('./money.js')).nodeMoneyHandler(p, url, json, res);
        if (p.startsWith('/api/myarea')) return (await import('./myarea.js')).nodeMyareaHandler(p, url, json, res);
        if (p === '/api/pres2028') return (await import('./pres2028.js')).nodePres2028Handler(json, res);
        if (p.startsWith('/api/news/')) { const nx = await import('./news.js'); if (!news.ready() && process.env.NEWS_DISABLED !== '1') await Promise.race([news.refresh(), sleep(9000)]); const [st, body] = await nx.newsExtra(p, async () => ({ us: news.recent(1200), au: await nx.auNewsItems() })); return json(res, st, body); }
        switch (p) {
          case '/api/health': {
            const source = pick(url.searchParams.get('source'));
            const pr = ensure(source);
            return json(res, 200, {
              ok: true,
              stream: true,
              mode: source,
              defaultSource: DEFAULT_SOURCE,
              uptime: Math.round((Date.now() - started) / 1000),
              clients: clients.size,
              newsReady: news.ready(),
              clock: pr.clock ? pr.clock() : pr.snapshot().clock,
              liveStatus: providers.live.status ? providers.live.status() : undefined,
            });
          }
          case '/api/stream':
            return handleStream(req, res, pick(url.searchParams.get('source')));
          case '/api/news': {
            if (!news.ready() && process.env.NEWS_DISABLED !== '1') await Promise.race([news.refresh(), sleep(9000)]);
            const q = url.searchParams;
            return json(res, 200, news.query({
              limit: Number(q.get('limit')) || 100,
              tag: q.get('tag') || undefined,
              lean: q.get('lean') || undefined,
              source: q.get('source') || undefined,
              q: q.get('q') || undefined,
            }));
          }
          case '/api/snapshot': {
            const source = pick(url.searchParams.get('source'));
            const s = ensure(source).snapshot();
            return json(res, 200, { mode: source, results: s.results, balance: s.balance, markets: s.markets, clock: s.clock });
          }
          case '/api/polls':
            return json(res, 200, POLL_SERIES);
          default:
            return json(res, 404, { error: 'not found' });
        }
      }
      if ((req.method === 'GET' || req.method === 'HEAD') && statics.handle(req, res, p)) return;
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end(statics.enabled() ? 'Not found' : 'PolTok API server. Run `npm run dev` for the app (vite on :5173) or `npm run build` to serve dist/.');
    } catch (e) {
      log('[http] error', p, e);
      if (!res.headersSent) json(res, 500, { error: 'internal error' });
      else res.end();
    }
  });

  server.listen(PORT, () => {
    log(`[server] PolTok API listening on http://localhost:${PORT} (${process.env.NODE_ENV || 'development'}; dist ${statics.enabled() ? 'served' : 'not built'})`);
  });
  server.on('error', (e) => {
    log('[server] failed:', e.message);
    process.exit(1);
  });

  const shutdown = (sig) => {
    log(`[server] ${sig} — shutting down`);
    Object.values(providers).forEach((pr) => pr.stop());
    news.stop();
    au.stop();
    for (const c of clients) c.end();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
