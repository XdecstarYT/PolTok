/**
 * In-browser Monte Carlo model for the "What-if Lab". This is an exploration toy, not a forecast of record.
 *
 * Each race's Dem-minus-Rep margin is drawn as
 *     margin = prior + shift + σ·(√ρ · Z_national + √(1-ρ) · Z_race)
 * where `prior` comes from the race rating (blended with the polling average when one exists),
 * `shift` is the user's national-environment slider and ρ the polling-error correlation slider.
 * Z_national is shared by every race in a simulation → correlated misses.
 */
import type { PollSeries, Race, Rating } from '../../types';
import { preparePolls, rollingAverage } from './pollMath';

export const RATING_MEAN: Record<Rating, number> = {
  'Solid D': 18,
  'Likely D': 9,
  'Lean D': 4,
  'Toss-up': 0,
  'Lean R': -4,
  'Likely R': -9,
  'Solid R': -18,
};
export const RATING_SIGMA: Record<Rating, number> = {
  'Solid D': 7,
  'Likely D': 6.5,
  'Lean D': 6,
  'Toss-up': 6,
  'Lean R': 6,
  'Likely R': 6.5,
  'Solid R': 7,
};

export interface SimSeat {
  id: string;
  state: string;
  title: string;
  rating: Rating;
  prior: number; // expected D-minus-R margin (pts)
  sigma: number;
  /** party label of the anti-Republican side ('D' or caucusing 'I') */
  dSide: 'D' | 'I';
  dName?: string;
  rName?: string;
  pollMargin?: number;
  pollN?: number;
  /** count of identical seats this entry represents (House aggregate buckets) */
  weight: number;
}

export interface SimModel {
  chamber: 'senate' | 'house';
  seats: SimSeat[];
  /** seats not on the ballot (D includes caucusing independents) */
  baseD: number;
  baseR: number;
  total: number;
  /** D needs >= this for control */
  dNeeds: number;
  /** R needs >= this for control */
  rNeeds: number;
}

export interface SimParams {
  shift: number; // + = D
  corr: number; // 0..0.95
  overrides?: Record<string, 'D' | 'R'>;
}

export interface SimSnapshot {
  n: number;
  target: number;
  /** histogram indexed by D seat count */
  hist: number[];
  dControl: number; // count
  dWins: Record<string, number>; // per seat id: D-side win count (summed seat weight for buckets)
  tipping: Record<string, number>;
  samples: number[]; // first 60 outcomes (D seats)
  marginSum: Record<string, number>;
  done: boolean;
}

/* ---------------- RNG ---------------- */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gaussian(rand: () => number) {
  let spare: number | null = null;
  return () => {
    if (spare != null) {
      const s = spare;
      spare = null;
      return s;
    }
    let u = 0;
    let v = 0;
    while (u === 0) u = rand();
    v = rand();
    const r = Math.sqrt(-2 * Math.log(u));
    spare = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  };
}

/* ---------------- model builders ---------------- */
function pollMarginFor(raceId: string, series: PollSeries[]) {
  const s = series.find((x) => x.id === raceId);
  if (!s?.polls?.length) return null;
  const dk = s.keys.find((k) => k.key === 'D' || /^dem/i.test(k.label))?.key ?? s.keys[0]?.key;
  const rk = s.keys.find((k) => k.key === 'R' || /^rep/i.test(k.label))?.key ?? s.keys[1]?.key;
  if (!dk || !rk) return null;
  const polls = preparePolls(s);
  if (!polls.length) return null;
  const last = polls[polls.length - 1].t;
  const avg = rollingAverage(polls, [dk, rk], last - 3 * 86_400_000, last).at(-1);
  if (!avg || avg.v[dk] == null || avg.v[rk] == null) return null;
  // count polls in the last 30 days
  const n = polls.filter((p) => p.t > last - 30 * 86_400_000).length;
  return { margin: avg.v[dk] - avg.v[rk], n };
}

export function seatFromRace(r: Race, series: PollSeries[]): SimSeat {
  const d = r.candidates.find((c) => c.party === 'D');
  const ind = !d ? r.candidates.find((c) => c.party === 'I') : undefined;
  const rep = r.candidates.find((c) => c.party === 'R');
  let prior = RATING_MEAN[r.rating] ?? 0;
  const pm = r.chamber !== 'house' ? pollMarginFor(r.id, series) : null;
  if (pm) {
    // Blend: more polls → trust them more, capped at 60%.
    const w = Math.min(0.6, 0.15 + pm.n * 0.06);
    prior = prior * (1 - w) + pm.margin * w;
  }
  return {
    id: r.id,
    state: r.state,
    title: r.title,
    rating: r.rating,
    prior,
    sigma: RATING_SIGMA[r.rating] ?? 6.5,
    dSide: ind ? 'I' : 'D',
    dName: (d ?? ind)?.name,
    rName: rep?.name,
    pollMargin: pm?.margin,
    pollN: pm?.n,
    weight: 1,
  };
}

/* ---------------- runner ---------------- */
export function createRun(model: SimModel, params: SimParams, target: number, seed = 20261103) {
  const rand = mulberry32(seed);
  const z = gaussian(rand);
  const seats = model.seats;
  const sqrtC = Math.sqrt(Math.max(0, Math.min(0.98, params.corr)));
  const sqrtI = Math.sqrt(1 - sqrtC * sqrtC);
  const ov = params.overrides ?? {};
  const snap: SimSnapshot = {
    n: 0,
    target,
    hist: new Array(model.total + 1).fill(0),
    dControl: 0,
    dWins: Object.fromEntries(seats.map((s) => [s.id, 0])),
    tipping: {},
    samples: [],
    marginSum: Object.fromEntries(seats.map((s) => [s.id, 0])),
    done: false,
  };
  const margins = new Float64Array(seats.length);
  const order = seats.map((_, i) => i);
  const computeTipping = model.chamber === 'senate';

  function one() {
    const nat = z();
    let d = model.baseD;
    for (let i = 0; i < seats.length; i++) {
      const s = seats[i];
      let m: number;
      const o = ov[s.id];
      if (o) m = o === 'D' ? 50 : -50;
      else if (s.weight > 1) {
        // aggregated bucket: draw each seat's idiosyncratic error but count in one pass
        let wins = 0;
        let sum = 0;
        for (let k = 0; k < s.weight; k++) {
          const mm = s.prior + params.shift + s.sigma * (sqrtC * nat + sqrtI * z());
          sum += mm;
          if (mm > 0) wins++;
        }
        d += wins;
        snap.dWins[s.id] += wins;
        snap.marginSum[s.id] += sum / s.weight;
        margins[i] = sum / s.weight;
        continue;
      } else m = s.prior + params.shift + s.sigma * (sqrtC * nat + sqrtI * z());
      margins[i] = m;
      snap.marginSum[s.id] += m;
      if (m > 0) {
        d++;
        snap.dWins[s.id]++;
      }
    }
    const dCtl = d >= model.dNeeds;
    if (dCtl) snap.dControl++;
    snap.hist[Math.max(0, Math.min(model.total, d))]++;
    if (snap.samples.length < 60) snap.samples.push(d);

    if (computeTipping) {
      // Order races by margin in the winner's favor; the race that delivers the winning seat is the tipping point.
      if (dCtl) order.sort((a, b) => margins[b] - margins[a]);
      else order.sort((a, b) => margins[a] - margins[b]);
      let acc = dCtl ? model.baseD : model.baseR;
      const need = dCtl ? model.dNeeds : model.rNeeds;
      if (acc < need) {
        for (const i of order) {
          acc++;
          if (acc >= need) {
            const id = seats[i].id;
            if (!ov[id]) snap.tipping[id] = (snap.tipping[id] ?? 0) + 1;
            break;
          }
        }
      }
    }
    snap.n++;
  }

  return {
    snap,
    /** advance up to `k` simulations; returns true when finished */
    step(k: number) {
      const stop = Math.min(target, snap.n + k);
      while (snap.n < stop) one();
      snap.done = snap.n >= target;
      return snap.done;
    },
  };
}

export const cloneSnap = (s: SimSnapshot): SimSnapshot => ({
  ...s,
  hist: s.hist.slice(),
  dWins: { ...s.dWins },
  tipping: { ...s.tipping },
  samples: s.samples.slice(),
  marginSum: { ...s.marginSum },
});

/* ---------------- summaries ---------------- */
export function summarize(model: SimModel, s: SimSnapshot) {
  const n = Math.max(1, s.n);
  let mode = 0;
  let modeC = -1;
  let cum = 0;
  let p10 = 0;
  let p50 = 0;
  let p90 = 0;
  let mean = 0;
  for (let i = 0; i < s.hist.length; i++) {
    const c = s.hist[i];
    mean += i * c;
    if (c > modeC) {
      modeC = c;
      mode = i;
    }
    const prev = cum;
    cum += c;
    if (prev < n * 0.1 && cum >= n * 0.1) p10 = i;
    if (prev < n * 0.5 && cum >= n * 0.5) p50 = i;
    if (prev < n * 0.9 && cum >= n * 0.9) p90 = i;
  }
  const tipTotal = Object.values(s.tipping).reduce((a, b) => a + b, 0) || 1;
  const tipping = Object.entries(s.tipping)
    .map(([id, c]) => ({ id, p: c / tipTotal }))
    .sort((a, b) => b.p - a.p);
  return {
    pD: s.dControl / n,
    pR: 1 - s.dControl / n,
    mode,
    modeP: modeC / n,
    mean: mean / n,
    p10,
    p50,
    p90,
    tipping,
    winProb: (id: string) => {
      const seat = model.seats.find((x) => x.id === id);
      return (s.dWins[id] ?? 0) / n / (seat?.weight ?? 1);
    },
    avgMargin: (id: string) => (s.marginSum[id] ?? 0) / n,
  };
}
