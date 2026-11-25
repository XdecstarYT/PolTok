// PolTok Victorian seat model (2026) — pure core, no I/O: createModel(PRIM, CANDS). Runs in Node and the browser. Transparent, simple, and labelled as a model, not a prediction.
//  1. Seat primaries: each district's 2022 primary vote (VEC), moved by the change in the statewide poll average —
//     a 50/50 blend of proportional and uniform (additive) swing for Labor, Coalition, Greens and others.
//     One Nation barely ran in 2022, so its seat vote = statewide poll × a seat factor from the 2022 vote for minor
//     right-wing parties there (Freedom, Family First, DLP, Liberal Democrats, Shooters…), clamped to 0.4×–1.8×.
//     A notable independent (≥10% in 2022 and on the 2026 ballot) keeps their 2022 vote, trimmed by the drop in the
//     statewide 'others' vote.
//  2. Count: full preferential. The lowest candidate group is excluded and its votes flow by fixed assumed rates
//     (FLOWS below) until two remain.
//  3. Uncertainty: 2,000 simulations with a statewide polling error (σ 2.2 pts per party) and seat-level noise
//     (σ 3 pts per party). Output: win probability per seat, seat-total ranges and majority chances.
export const FLOWS = {
  ALP: { GRN: 0.62, IND: 0.14, OTH: 0.08, LNP: 0.1, ONP: 0.06 },
  LNP: { ONP: 0.42, IND: 0.18, OTH: 0.14, ALP: 0.18, GRN: 0.08 },
  GRN: { ALP: 0.7, IND: 0.14, OTH: 0.06, LNP: 0.07, ONP: 0.03 },
  ONP: { LNP: 0.62, OTH: 0.12, IND: 0.08, ALP: 0.14, GRN: 0.04 },
  IND: { ALP: 0.3, LNP: 0.3, GRN: 0.18, ONP: 0.12, OTH: 0.1 },
  OTH: { LNP: 0.32, ALP: 0.24, ONP: 0.24, GRN: 0.12, IND: 0.08 },
};

export function createModel(PRIM, CANDS) {

const P = ['ALP', 'LNP', 'GRN', 'ONP', 'IND', 'OTH'];
/** Share of an excluded group's votes that flows to each other group (renormalised over those still in the count). */

const RMIN22 = Object.values(PRIM).reduce((a, v) => a + v.rmin, 0) / Object.keys(PRIM).length;
const STATE22 = (() => { const s = Object.fromEntries(P.map((k) => [k, 0])); const n = Object.keys(PRIM).length; for (const v of Object.values(PRIM)) for (const k of P) s[k] += v.pct[k] / n; return s; })();

function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function gauss(r) { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
const norm = (o) => { const t = Object.values(o).reduce((a, b) => a + b, 0); for (const k in o) o[k] = (o[k] / t) * 100; return o; };

/** recontesting notable independents, keyed by district */
const NOTABLE_IND = Object.fromEntries(Object.entries(PRIM).filter(([id, v]) => v.ind && (CANDS.districts[id] ?? []).some(([n]) => n.toLowerCase() === v.ind.n.toLowerCase())).map(([id, v]) => [id, v.ind]));

/** estimated primaries for one seat given statewide averages (now) and noise */
function seatPrimaries(id, now, eps = null, r = null) {
  const s = PRIM[id].pct;
  const ind = NOTABLE_IND[id];
  const othNow = Math.max(1, 100 - now.ALP - now.LNP - now.GRN - now.ONP);
  const othRatio = othNow / (STATE22.OTH + STATE22.IND);
  const out = {};
  for (const k of ['ALP', 'LNP', 'GRN']) {
    const sw = (now[k] + (eps?.[k] ?? 0)) - STATE22[k];
    const prop = s[k] * ((now[k] + (eps?.[k] ?? 0)) / STATE22[k]);
    out[k] = Math.max(0.5, 0.5 * prop + 0.5 * (s[k] + sw));
  }
  // One Nation potential: the seat's 2022 vote for minor right-wing parties (Freedom, Family First, DLP, Lib Dems, Shooters…)
  const onpF = Math.min(1.8, Math.max(0.4, Math.pow((PRIM[id].rmin + 0.5) / (RMIN22 + 0.5), 0.75)));
  out.ONP = Math.max(0.5, (now.ONP + (eps?.ONP ?? 0)) * onpF);
  out.IND = ind ? ind.pct * Math.max(0.55, Math.min(1, othRatio * 1.35)) : 0;
  out.OTH = Math.max(0.5, (s.OTH + (ind ? s.IND - ind.pct : s.IND)) * othRatio);
  if (r) for (const k of P) if (out[k] > 0) out[k] = Math.max(0.3, out[k] + gauss(r) * (k === 'IND' ? 4 : 3));
  return norm(out);
}

/** full preferential count over the groups; returns { winner, finalTwo: [[a, pctA], [b, pctB]] } */
function count(prim) {
  const v = { ...prim };
  for (const k of Object.keys(v)) if (!(v[k] > 0)) delete v[k];
  while (Object.keys(v).length > 2) {
    const lo = Object.keys(v).reduce((a, b) => (v[a] <= v[b] ? a : b));
    const votes = v[lo]; delete v[lo];
    const rem = Object.keys(v), f = FLOWS[lo];
    const tot = rem.reduce((a, k) => a + (f[k] ?? 0.02), 0);
    for (const k of rem) v[k] += votes * ((f[k] ?? 0.02) / tot);
  }
  const [a, b] = Object.entries(v).sort((x, y) => y[1] - x[1]);
  return { winner: a[0], finalTwo: [[a[0], +a[1].toFixed(1)], [b[0], +b[1].toFixed(1)]] };
}

function runModel(now, { sims = 2000, seed = 20261128 } = {}) {
  const ids = Object.keys(PRIM);
  const r = rng(seed);
  const wins = Object.fromEntries(ids.map((id) => [id, {}]));
  const totals = [];
  for (let s = 0; s < sims; s++) {
    const eps = { ALP: gauss(r) * 2.2, LNP: gauss(r) * 2.2, GRN: gauss(r) * 1.6, ONP: gauss(r) * 2.4 };
    const t = {};
    for (const id of ids) { const w = count(seatPrimaries(id, now, eps, r)).winner; wins[id][w] = (wins[id][w] ?? 0) + 1; t[w] = (t[w] ?? 0) + 1; }
    totals.push(t);
  }
  const parties = [...new Set(totals.flatMap((t) => Object.keys(t)))];
  const q = (arr, p) => arr[Math.min(arr.length - 1, Math.floor(p * arr.length))];
  const range = Object.fromEntries(parties.map((k) => { const a = totals.map((t) => t[k] ?? 0).sort((x, y) => x - y); return [k, { median: q(a, 0.5), p10: q(a, 0.1), p90: q(a, 0.9), mean: +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) }]; }));
  const hist = Object.fromEntries(['LNP', 'ALP'].map((k) => { const h = {}; for (const t of totals) { const n = t[k] ?? 0; h[n] = (h[n] ?? 0) + 1; } return [k, h]; }));
  const majority = { LNP: totals.filter((t) => (t.LNP ?? 0) >= 45).length / sims, ALP: totals.filter((t) => (t.ALP ?? 0) >= 45).length / sims };
  majority.hung = +(1 - majority.LNP - majority.ALP).toFixed(3);
  const seats = Object.fromEntries(ids.map((id) => {
    const central = seatPrimaries(id, now);
    const c = count(central);
    const prob = Object.fromEntries(Object.entries(wins[id]).map(([k, n]) => [k, +(n / sims).toFixed(3)]).sort((a, b) => b[1] - a[1]));
    const fav = Object.keys(prob)[0];
    return [id, { prob, fav, primaries: Object.fromEntries(Object.entries(central).filter(([, v]) => v > 0.05).map(([k, v]) => [k, +v.toFixed(1)])), finalTwo: c.finalTwo, ind: NOTABLE_IND[id] ?? null,
      rating: prob[fav] >= 0.9 ? 'safe' : prob[fav] >= 0.75 ? 'likely' : prob[fav] >= 0.6 ? 'leans' : 'tossup' }];
  }));
  return {
    sims, now, state2022: Object.fromEntries(Object.entries(STATE22).map(([k, v]) => [k, +v.toFixed(2)])), seats, range, hist, majority, flows: FLOWS,
    method: 'PolTok model: 2022 district primaries moved by the change in the statewide poll average (blend of proportional and uniform swing; One Nation scaled by each seat\'s 2022 minor right-wing vote; recontesting independents keep a trimmed 2022 vote), then a full preferential count with assumed preference flows. 2,000 simulations with statewide polling error and seat-level noise. A model, not a prediction.',
  };
}

  return { runModel, NOTABLE_IND };
}
