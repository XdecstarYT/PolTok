// GET /api/snapshot?source=live — stateless: runs the NYT/AP + Polymarket provider once
// (shared/nyt.js), waits for its fetches to settle, caches ~45s per warm instance.
// Only `live` is served here; the simulation runs in the browser.
import { createNytProvider } from '../../shared/nyt.js';
import { RACES, STATES } from '../../shared/data/index.js';
import { cached, json, quiet, sleep } from '../lib/util.mjs';

const snapshot = cached(45000, async () => {
  let pending = 0;
  const fetchImpl = (...a) => {
    pending++;
    // Count the request as pending until its whole body has downloaded (the House file is >1 MB),
    // then hand the provider a buffered Response so parsing happens before we take the snapshot.
    return fetch(...a)
      .then(async (r) => new Response(await r.arrayBuffer(), { status: r.status, statusText: r.statusText, headers: r.headers }))
      .finally(() => setTimeout(() => pending--, 0));
  };
  const pr = createNytProvider({ races: structuredClone(RACES), states: STATES, log: quiet, fetchImpl });
  pr.start();
  const t0 = Date.now();
  await sleep(50);
  while (Date.now() - t0 < 9000) {
    if (pending === 0) {
      await sleep(250); // let res.json() + ingest finish for the last buffered body
      if (pending === 0) break;
    }
    await sleep(100);
  }
  pr.stop();
  const s = pr.snapshot();
  return { mode: 'live', results: s.results, balance: s.balance, markets: s.markets, clock: s.clock, fetchedAt: Date.now() };
});

export default async (req) => {
  const source = new URL(req.url).searchParams.get('source') || 'live';
  if (source !== 'live') return json({ error: 'only source=live is available on this deployment' }, 400);
  try {
    return json(await snapshot(), 200, 30);
  } catch (e) {
    return json({ error: 'upstream unavailable' }, 502);
  }
};

export const config = { path: '/api/snapshot' };
