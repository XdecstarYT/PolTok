/**
 * Polling-average math (owned by the Polls feature).
 *
 * Method: a one-sided, time-weighted, sample-size-weighted kernel average.
 *  - For each day t, every poll whose field end date falls in (t - WINDOW, t] contributes.
 *  - Recency weight: Gaussian-ish decay  exp(-(age / HALF)^2 * ln2)  → half weight at HALF days.
 *  - Sample weight: sqrt(n / 600), clamped to [0.35, 2.2] (diminishing returns for huge samples).
 *  - Population weight: LV 1.0, RV 0.9, Adults 0.75.
 *  - House-effect damping: a pollster with k polls in the window gets each weighted by 1/sqrt(k),
 *    so one prolific tracker can't dominate.
 *  - The band is the weighted spread of polls around the average (±1.64σ, floored), i.e. the range
 *    where ~90% of individual polls land — not a confidence interval on the true vote.
 */
import type { PollPoint, PollSeries } from '../../types';

export const DAY = 86_400_000;
export const WINDOW_DAYS = 14;
export const HALF_LIFE_DAYS = 6;

export const parseDay = (iso: string) => {
  const t = Date.parse(iso.length <= 10 ? `${iso}T12:00:00Z` : iso);
  return Number.isFinite(t) ? Math.floor(t / DAY) * DAY + DAY / 2 : NaN;
};

export interface AvgPoint {
  t: number;
  /** value per key */
  v: Record<string, number>;
  /** half-width of the spread band per key */
  band: Record<string, number>;
  n: number; // polls in window
}

const POP_W: Record<string, number> = { LV: 1, RV: 0.9, A: 0.75 };

export function pollWeight(p: PollPoint) {
  const s = p.sample && p.sample > 0 ? Math.min(2.2, Math.max(0.35, Math.sqrt(p.sample / 600))) : 0.7;
  return s * (p.population ? POP_W[p.population] ?? 0.8 : 0.85);
}

export interface PreparedPoll extends PollPoint {
  t: number;
  w: number;
  idx: number;
}

export function preparePolls(series: PollSeries | undefined): PreparedPoll[] {
  if (!series?.polls?.length) return [];
  return series.polls
    .map((p, idx) => ({ ...p, t: parseDay(p.date), w: pollWeight(p), idx }))
    .filter((p) => Number.isFinite(p.t))
    .sort((a, b) => a.t - b.t);
}

/** Compute the rolling average for each day between start and end (inclusive). */
export function rollingAverage(polls: PreparedPoll[], keys: string[], start: number, end: number): AvgPoint[] {
  const out: AvgPoint[] = [];
  if (!polls.length || !keys.length) return out;
  let lo = 0;
  let hi = 0;
  for (let t = start; t <= end; t += DAY) {
    while (hi < polls.length && polls[hi].t <= t) hi++;
    while (lo < hi && polls[lo].t <= t - WINDOW_DAYS * DAY) lo++;
    if (hi - lo === 0) continue;
    const counts = new Map<string, number>();
    for (let i = lo; i < hi; i++) counts.set(polls[i].pollster, (counts.get(polls[i].pollster) ?? 0) + 1);
    const v: Record<string, number> = {};
    const band: Record<string, number> = {};
    for (const k of keys) {
      let sw = 0;
      let sv = 0;
      const ws: number[] = [];
      const xs: number[] = [];
      for (let i = lo; i < hi; i++) {
        const p = polls[i];
        const x = p.values[k];
        if (x == null || !Number.isFinite(x)) continue;
        const age = (t - p.t) / DAY;
        const w = p.w * Math.exp(-Math.LN2 * (age / HALF_LIFE_DAYS) ** 2) / Math.sqrt(counts.get(p.pollster) ?? 1);
        sw += w;
        sv += w * x;
        ws.push(w);
        xs.push(x);
      }
      if (sw <= 0) continue;
      const mean = sv / sw;
      let sq = 0;
      for (let j = 0; j < xs.length; j++) sq += ws[j] * (xs[j] - mean) ** 2;
      const sd = Math.sqrt(sq / sw);
      v[k] = mean;
      // Few polls → widen. Floor at 1.25 pts so the band never collapses to a line.
      band[k] = Math.max(1.25, 1.64 * sd * (1 + 1 / Math.max(1, xs.length)));
    }
    if (Object.keys(v).length) out.push({ t, v, band, n: hi - lo });
  }
  return out;
}

/** Latest average value + change vs `days` ago. */
export function headline(avg: { t: number; v: Record<string, number>; n?: number }[], key: string, days = 7) {
  type P = (typeof avg)[number];
  const last = [...avg].reverse().find((a) => a.v[key] != null);
  if (!last) return null;
  const target = last.t - days * DAY;
  let prev: P | undefined;
  for (const a of avg) if (a.t <= target && a.v[key] != null) prev = a;
  return { value: last.v[key], delta: prev ? last.v[key] - prev.v[key] : null, t: last.t, n: last.n };
}

/** Margin key pair for a series: first two keys (e.g. D vs R, approve vs disapprove). */
export function marginOf(values: Record<string, number>, keys: { key: string }[]) {
  if (keys.length < 2) return null;
  const a = values[keys[0].key];
  const b = values[keys[1].key];
  if (a == null || b == null) return null;
  return a - b;
}

export const fmtDay = (t: number, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }) =>
  new Date(t).toLocaleDateString('en-US', { timeZone: 'UTC', ...opts });

export const signed = (n: number, d = 1) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n).toFixed(d)}`;
