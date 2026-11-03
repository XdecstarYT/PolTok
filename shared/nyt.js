// Live results provider: real 2026 results (AP race calls & vote counts, NYT needle model) from
// The New York Times' public results JSON. Browser-safe and dependency-free, so it runs both on the
// server (server/results-provider.js) and directly in the browser when no API server is reachable
// (the files are served with `Access-Control-Allow-Origin: *`).
//
// Same interface as shared/sim.js createSimulation():
//   { mode: 'live', start, stop, snapshot, subscribe, clock }
//
// Data © The New York Times / The Associated Press. Displayed with attribution in the UI.

import { correlatedAtLeast } from './sim.js';
import * as DATA from './data/index.js';

const BASE = 'https://static01.nyt.com/elections-assets/pages/data/2026-11-03';
export const NYT_SOURCES = {
  senate: `${BASE}/results-senate.json`,
  governor: `${BASE}/results-governor.json`,
  house: `${BASE}/results-house.json`,
};
export const LIVE_ATTRIBUTION = 'Results: AP via The New York Times';

const PARTY = { DEM: 'D', GOP: 'R', IND: 'I', LIB: 'L', GRN: 'G' };
const RATING_PRIOR = {
  'solid-dem': 0.98, 'likely-dem': 0.88, 'lean-dem': 0.7, 'tossup': 0.5,
  'lean-rep': 0.3, 'likely-rep': 0.12, 'solid-rep': 0.02,
};

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

/** Minutes after 18:00 ET for a timestamp (can be negative before 6 PM). */
export function etMinutesSince6pm(now = Date.now()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(now));
  const g = (t) => Number(parts.find((p) => p.type === t)?.value);
  const day = g('day');
  let mins = g('hour') * 60 + g('minute') + g('second') / 60;
  // Election night spills past midnight into Nov 4.
  if (g('month') === 11 && day === 4) mins += 1440;
  else if (g('month') === 11 && day < 3) mins -= 1440 * (3 - day);
  return mins - 18 * 60;
}

function etLabel(now = Date.now()) {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }).format(new Date(now)) + ' ET';
}

/**
 * @param {{ races: import('../src/types').Race[]; states?: import('../src/types').StateInfo[];
 *   fetchImpl?: typeof fetch; pollMs?: number; housePollMs?: number; log?: (m: string) => void }} opts
 */
export function createNytProvider(opts) {
  const races = Array.isArray(opts?.races) ? opts.races : [];
  const fetchImpl = opts?.fetchImpl || ((...a) => fetch(...a));
  const pollMs = opts?.pollMs || 30000;
  const housePollMs = opts?.housePollMs || 90000;
  const log = opts?.log || (() => {});

  const byKey = new Map(); // "S|PA|" / "S|OH|special" / "G|PA|" / "H|PA|7" -> our Race
  for (const r of races) {
    if (r.chamber === 'senate') byKey.set(`S|${r.state}|${r.special ? 'special' : ''}`, r);
    else if (r.chamber === 'governor') byKey.set(`G|${r.state}|`, r);
    else byKey.set(`H|${r.state}|${r.district || 1}`, r); // at-large (0) == NYT seat 1
  }

  const subs = new Set();
  const results = new Map(); // raceId -> RaceResult
  const lastKey = new Map();
  const called = new Set();
  /** @type {Record<string, any>} */
  const raw = { senate: null, governor: null, house: null };
  let balance = [];
  let timers = [];
  let started = false;
  let lastOk = 0;
  let lastError = '';

  const emit = (ev) => subs.forEach((fn) => { try { fn(ev); } catch { /* ignore */ } });

  function keyFor(nr, office) {
    const st = nr.top_reporting_unit?.state_postal || String(nr.nyt_id).slice(0, 2);
    if (office === 'S') return `S|${st}|${/special/i.test(nr.type || '') || nr.race_type_id === 'W' ? 'special' : ''}`;
    if (office === 'G') return `G|${st}|`;
    return `H|${st}|${Number(nr.seat_number) || 1}`;
  }

  /** Reconcile our candidate list with NYT's (NYT/AP is authoritative for names & photos). */
  function mapCandidates(race, nr) {
    const meta = nr.candidate_metadata || {};
    const top = nr.top_reporting_unit?.candidates || [];
    const ordered = [...top].sort(
      (a, b) => (a.nyt_model_estimates?.ranking ?? 99) - (b.nyt_model_estimates?.ranking ?? 99) || (b.votes?.total ?? 0) - (a.votes?.total ?? 0),
    );
    const map = new Map(); // nyt cand id -> our cand id
    const used = new Set();
    for (const c of ordered) {
      const m = meta[c.nyt_id] || {};
      const party = PARTY[m.party?.nyt_id] || 'O';
      const last = norm(m.last_name);
      let ours = race.candidates.find((x) => !used.has(x.id) && last && norm(x.name).endsWith(last));
      if (!ours) ours = race.candidates.find((x) => !used.has(x.id) && x.party === party && /^tbd/i.test(x.name));
      if (!ours && (party === 'D' || party === 'R')) ours = race.candidates.find((x) => !used.has(x.id) && x.party === party);
      const fullName = [m.first_name, m.last_name, m.suffix].filter(Boolean).join(' ');
      if (/write-?ins?/i.test(fullName + ' ' + c.nyt_id)) continue;
      if (!ours) {
        if (race.candidates.length >= 5) continue; // ignore long-tail minor candidates
        let id = `${race.id}-${party}`.toLowerCase();
        let n = 2;
        while (race.candidates.some((x) => x.id === id)) id = `${race.id}-${party}${n++}`.toLowerCase();
        ours = { id, name: fullName || c.nyt_id, party };
        race.candidates.push(ours);
      }
      if (fullName) ours.name = fullName;
      if (m.img_url && !ours.photo) ours.photo = m.img_url;
      if (typeof m.incumbent === 'boolean') ours.incumbent = m.incumbent;
      used.add(ours.id);
      map.set(c.nyt_id, ours.id);
    }
    return map;
  }

  function convert(nr, office, pollClose) {
    const race = byKey.get(keyFor(nr, office));
    if (!race) return null;
    const cmap = mapCandidates(race, nr);
    const ru = nr.top_reporting_unit || {};
    const votes = {};
    const winProb = {};
    let anyModel = false;
    for (const c of ru.candidates || []) {
      const id = cmap.get(c.nyt_id);
      if (!id) continue;
      votes[id] = (votes[id] || 0) + (c.votes?.total || 0);
      const wp = c.nyt_model_estimates?.win_probability;
      if (typeof wp === 'number') { winProb[id] = wp; anyModel = true; }
    }
    const wonNyt = nr.outcome?.won?.[0];
    const calledFor = wonNyt ? cmap.get(wonNyt) : undefined;
    if (calledFor) {
      for (const id of Object.keys(votes)) winProb[id] = id === calledFor ? 1 : 0;
    } else if (!anyModel) {
      // No model output yet: fall back to the race rating, sharpened by the counted margin.
      const pD = RATING_PRIOR[nr.rating] ?? 0.5;
      const d = race.candidates.find((c) => c.party === 'D' || c.party === 'I');
      const r = race.candidates.find((c) => c.party === 'R');
      const total = Object.values(votes).reduce((a, b) => a + b, 0);
      let p = pD;
      if (total > 0 && d && r) {
        const margin = ((votes[d.id] || 0) - (votes[r.id] || 0)) / total;
        const w = clamp((ru.eevp || 0) / 100, 0, 0.95);
        p = (1 - w) * pD + w * (margin > 0 ? 0.5 + Math.min(0.5, Math.abs(margin) * 5) : 0.5 - Math.min(0.5, Math.abs(margin) * 5));
      }
      if (d) winProb[d.id] = p;
      if (r) winProb[r.id] = 1 - p;
    }
    const eevp = Number(ru.eevp) || 0;
    const cs = String(nr.race_call_status || '');
    const closed = pollClose ? Date.now() >= pollClose : false;
    const status = calledFor ? 'called' : /close/i.test(cs) ? 'too-close' : eevp > 0 ? 'counting' : closed ? 'polls-closed' : 'not-started';
    const acceptedAt = Date.parse(nr.outcome?.winner_accepted_at?.[0] || '') || undefined;
    const prev = results.get(race.id);
    return {
      raceId: race.id,
      votes,
      expectedPct: eevp,
      calledFor,
      calledAt: calledFor ? prev?.calledAt ?? acceptedAt ?? Date.now() : undefined,
      winProb,
      reportingNote: ru.precincts_total ? `${ru.precincts_reporting ?? 0}/${ru.precincts_total} precincts` : undefined,
      updatedAt: Date.parse(nr.updated_at || '') || Date.now(),
      status,
      candidates: race.candidates.map((c) => ({ ...c })),
      race,
      nr,
    };
  }

  function pollCloseMap(doc) {
    const m = new Map();
    for (const p of doc?.pollClosingTimes || []) {
      const st = p.reporting_unit?.state_postal;
      const t = Date.parse(p.poll_closing_time || '');
      if (st && t) m.set(st, Math.max(m.get(st) || 0, t));
    }
    return m;
  }

  function ingest(kind, doc) {
    raw[kind] = doc;
    const office = kind === 'senate' ? 'S' : kind === 'governor' ? 'G' : 'H';
    const closes = pollCloseMap(doc);
    const changed = [];
    for (const nr of doc?.races || []) {
      if (!nr?.top_reporting_unit || String(nr.nyt_id).startsWith('US-')) continue;
      const st = nr.top_reporting_unit.state_postal;
      const res = convert(nr, office, closes.get(st));
      if (!res) {
        // Not one of our tracked races (safe House seats): announce AP calls on the ticker.
        const won = nr.outcome?.won?.[0];
        if (won && !called.has(nr.nyt_id)) {
          called.add(nr.nyt_id);
          if (started && lastOk) {
            const m = nr.candidate_metadata?.[won];
            const party = PARTY[m?.party?.nyt_id] || 'O';
            emit({ type: 'ticker', level: 'info', text: `AP: ${[m?.first_name, m?.last_name].join(' ')} (${party}) wins ${st}-${String(nr.seat_number || '').padStart(2, '0')}` });
          }
        }
        continue;
      }
      const { race, nr: _nr, ...result } = res;
      const k = JSON.stringify([result.votes, result.expectedPct, result.status, result.calledFor, result.winProb, result.candidates.map((c) => c.name)]);
      if (lastKey.get(result.raceId) !== k) {
        lastKey.set(result.raceId, k);
        results.set(result.raceId, result);
        changed.push(result);
      }
      if (result.calledFor && !called.has(result.raceId)) {
        called.add(result.raceId);
        const cand = race.candidates.find((c) => c.id === result.calledFor);
        const side = (p) => (p === 'I' ? 'D' : p);
        const flip = !!cand && side(cand.party) !== side(race.incumbentParty);
        emit({ type: 'call', raceId: race.id, candidateId: result.calledFor, party: cand?.party || 'O', flip, at: result.calledAt || Date.now() });
        if (lastOk) emit({
          type: 'ticker',
          level: flip ? 'breaking' : 'alert',
          text: `AP PROJECTION: ${cand?.name ?? 'Winner'} (${cand?.party ?? '?'}) wins ${race.title}${flip ? ' — FLIP' : ''}`,
        });
      }
    }
    if (changed.length) emit({ type: 'results', results: changed });
    const b = computeBalance();
    if (b.length) {
      balance = b;
      emit({ type: 'balance', balance });
    }
  }

  function chamberBalance(doc, office, chamber) {
    const pc = doc?.partyControlData?.results?.find((r) => r.state_postal === 'US')?.offices?.[office];
    if (!pc) return null;
    const pb = pc.party_balance || {};
    const dem = pb.DEM?.seats ?? 0;
    const rep = pb.GOP?.seats ?? 0;
    const ind = pb.OTH?.seats ?? 0;
    const total = pc.total || (chamber === 'senate' ? 100 : 435);
    const majority = chamber === 'senate' ? 51 : 218; // VP (R) breaks Senate ties: D side needs 51
    // Win probability of each uncalled race (D side) from NYT model / ratings.
    const probs = [];
    let projD = dem + ind;
    for (const nr of doc.races || []) {
      if (String(nr.nyt_id).startsWith('US-') || nr.outcome?.won?.length) continue;
      let pD = null;
      for (const c of nr.top_reporting_unit?.candidates || []) {
        const party = PARTY[nr.candidate_metadata?.[c.nyt_id]?.party?.nyt_id];
        const wp = c.nyt_model_estimates?.win_probability;
        if (typeof wp === 'number' && (party === 'D' || party === 'I')) pD = (pD || 0) + wp;
      }
      if (pD == null) pD = RATING_PRIOR[nr.rating] ?? 0.5;
      pD = clamp(pD, 0, 1);
      probs.push(pD);
      projD += pD;
    }
    const need = majority - (dem + ind);
    const pD = need <= 0 ? 1 : correlatedAtLeast(probs, need, 0.5);
    return {
      chamber,
      total,
      majority,
      dem,
      rep,
      ind,
      undecided: Math.max(0, total - dem - rep - ind),
      projected: { dem: Math.round(projD), rep: Math.round(total - projD) },
      controlProb: { D: Math.round(pD * 10000) / 10000, R: Math.round((1 - pD) * 10000) / 10000 },
    };
  }

  function computeBalance() {
    const out = [];
    const s = chamberBalance(raw.senate, 'S', 'senate');
    const h = chamberBalance(raw.house, 'H', 'house');
    if (s) out.push(s);
    if (h) out.push(h);
    return out;
  }

  function markets() {
    const mb = /** @type {any} */ (DATA).MARKETS_BASELINE;
    if (!mb?.kalshi) return [];
    const src = `Kalshi · closing odds ${mb.asOf ? new Date(mb.asOf).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}`.trim();
    const mk = (id, question, d) => ({
      id,
      question,
      source: src,
      outcomes: [
        { label: 'Democrats', prob: d / 100, color: '#3d7bff' },
        { label: 'Republicans', prob: 1 - d / 100, color: '#ff3d55' },
      ],
    });
    return [mk('house-control', 'Which party will win the House?', mb.kalshi.houseDem), mk('senate-control', 'Which party will win the Senate?', mb.kalshi.senateDem)];
  }

  async function load(kind) {
    try {
      const res = await fetchImpl(NYT_SOURCES[kind], { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const doc = await res.json();
      const firstLoad = !lastOk;
      ingest(kind, doc);
      lastOk = Date.now();
      lastError = '';
      if (firstLoad) emit({ type: 'ticker', level: 'info', text: `Connected to live results — ${LIVE_ATTRIBUTION}` });
    } catch (e) {
      lastError = String(e?.message || e);
      log(`[nyt] ${kind} fetch failed: ${lastError}`);
    }
  }

  return {
    mode: 'live',
    start() {
      if (started) return;
      started = true;
      emit({ type: 'markets', markets: markets() });
      load('senate');
      load('governor');
      load('house');
      timers.push(setInterval(() => { load('senate'); load('governor'); }, pollMs));
      timers.push(setInterval(() => load('house'), housePollMs));
    },
    stop() {
      started = false;
      timers.forEach(clearInterval);
      timers = [];
    },
    snapshot() {
      return { results: [...results.values()], balance, markets: markets(), clock: this.clock() };
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    clock() {
      const m = etMinutesSince6pm();
      return { simMinute: m, et: etLabel(), progress: clamp(m / 480, 0, 1), final: false, live: true, lastOk, lastError };
    },
    status() {
      return { lastOk, lastError, races: results.size };
    },
  };
}
