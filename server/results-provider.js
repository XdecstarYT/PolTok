// Pluggable results provider. The server talks only to this interface, so a real results feed
// (AP Elections API, Decision Desk HQ, a state SOS scraper, ...) can replace the simulation
// without touching server/index.js or the client.
//
// Interface (same as shared/sim.js createSimulation's return value):
//   {
//     mode: 'simulation' | 'live',
//     start(): void,
//     stop(): void,
//     snapshot(): { results: RaceResult[]; balance: BalanceOfPower[]; markets: Market[]; clock?: object },
//     subscribe(fn: (ev: LiveEvent) => void): () => void,   // emits results/balance/call/markets/ticker
//   }
//
// Select with env RESULTS_MODE:
//   RESULTS_MODE=simulation (default)  -> shared/sim.js. Env: SIM_SPEED (1), SIM_SEED (20261103),
//                                         SIM_LOOP (0/1), SIM_START_AT (epoch ms or ISO; default: boot)
//   RESULTS_MODE=live                   -> polls RESULTS_FEED_URL (JSON) every RESULTS_POLL_MS (15000).
//                                         The endpoint must return { results: RaceResult[],
//                                         balance?: BalanceOfPower[], markets?: Market[] } in the
//                                         src/types.ts shapes. Write a small adapter service (or replace
//                                         `fetchLive` below) that maps AP/DDHQ payloads to that shape:
//                                           AP  : GET /v2/elections/{date}?level=state&officeID=S,G,H
//                                                 -> race.raceID/statePostal/officeID => our race id,
//                                                    candidate.voteCount => votes[candidateId],
//                                                    reportingunit.eevp => expectedPct,
//                                                    candidate.winner === 'X' => calledFor/calledAt
//                                           DDHQ: similar; map "vcu" (vote counted %) => expectedPct.
//                                         Calls are derived from calledFor transitions; flip uses
//                                         race.incumbentParty. Without RESULTS_FEED_URL we log a warning
//                                         and fall back to simulation (never pretend to be live).
import { createSimulation } from '../shared/sim.js';

export function createResultsProvider({ races, states, env = process.env, log = console.log }) {
  const mode = (env.RESULTS_MODE || 'simulation').toLowerCase();
  if (mode === 'live') {
    if (env.RESULTS_FEED_URL) return createLiveProvider({ races, url: env.RESULTS_FEED_URL, pollMs: +env.RESULTS_POLL_MS || 15000, log });
    log('[results] RESULTS_MODE=live but RESULTS_FEED_URL is not set — falling back to simulation');
  }
  const startAt = parseStart(env.SIM_START_AT);
  const sim = createSimulation({
    races,
    states,
    speed: Number(env.SIM_SPEED) || 1,
    seed: env.SIM_SEED ? Number(env.SIM_SEED) : undefined,
    startAt,
    loop: env.SIM_LOOP === '1' || env.SIM_LOOP === 'true',
  });
  return Object.assign(sim, { mode: 'simulation' });
}

function parseStart(v) {
  if (!v) return undefined;
  const n = Number(v);
  if (Number.isFinite(n)) return n;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : undefined;
}

function createLiveProvider({ races, url, pollMs, log }) {
  const subs = new Set();
  const raceById = new Map(races.map((r) => [r.id, r]));
  let state = { results: [], balance: [], markets: [] };
  const lastKey = new Map();
  const called = new Set();
  let timer = null;
  const emit = (ev) => subs.forEach((fn) => { try { fn(ev); } catch {} });

  async function poll() {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const results = Array.isArray(data.results) ? data.results : [];
      const changed = results.filter((r) => {
        const k = JSON.stringify([r.votes, r.expectedPct, r.status, r.calledFor]);
        if (lastKey.get(r.raceId) === k) return false;
        lastKey.set(r.raceId, k);
        return true;
      });
      state = { results, balance: data.balance || state.balance, markets: data.markets || state.markets };
      if (changed.length) emit({ type: 'results', results: changed });
      for (const r of changed) {
        if (!r.calledFor || called.has(r.raceId)) continue;
        called.add(r.raceId);
        const race = raceById.get(r.raceId);
        const cand = race?.candidates.find((c) => c.id === r.calledFor);
        const party = cand?.party ?? 'O';
        emit({ type: 'call', raceId: r.raceId, candidateId: r.calledFor, party, flip: !!race && party !== race.incumbentParty, at: r.calledAt ?? Date.now() });
      }
      if (data.balance) emit({ type: 'balance', balance: data.balance });
      if (data.markets) emit({ type: 'markets', markets: data.markets });
    } catch (e) {
      log('[results] live poll failed:', e.message || e);
    }
  }

  return {
    mode: 'live',
    start() { if (!timer) { poll(); timer = setInterval(poll, pollMs); } },
    stop() { clearInterval(timer); timer = null; },
    snapshot: () => state,
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  };
}
