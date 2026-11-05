/** Weighted polling average for AU polls (federal + Victoria).
 *
 * Method (documented on /au/polls):
 *   weight = recency × sample × house × sponsor
 *   recency = 0.5 ^ (ageDays / HALF_LIFE)        — half-life 14 days, window 90 days
 *   sample  = sqrt(min(n, 3000) / 1000)          — unknown sample → 0.8
 *   house   = 0.5 ^ (k)                          — k = how many newer polls the same pollster has in the window,
 *                                                  so no single high-frequency pollster dominates
 *   sponsor = 0.5 for polls commissioned by a party ("for Greens" etc.)
 * Averages are the weighted mean over polls that report the series. Primaries are not renormalised.
 */
import type { AuPoll } from '../../data/au';

export const HALF_LIFE = 14;
export const WINDOW = 90;
const DAY = 864e5;

export type Series = 'ALP' | 'LNP' | 'GRN' | 'ONP' | 'OTH' | 'TPP';
export const SERIES: Series[] = ['ALP', 'LNP', 'ONP', 'GRN', 'OTH'];

const ts = (d: string) => Date.parse(d.length === 10 ? d + 'T00:00:00Z' : d);
const val = (p: AuPoll, k: Series): number | null => (k === 'TPP' ? p.tpp?.ALP ?? null : p.primary?.[k] ?? null);
const sponsored = (p: AuPoll) => /\(for |commissioned|internal/i.test(`${p.pollster} ${p.note ?? ''}`);

export function weights(polls: AuPoll[], at: number) {
  const inWin = polls.filter((p) => ts(p.date) <= at && at - ts(p.date) <= WINDOW * DAY).sort((a, b) => ts(b.date) - ts(a.date));
  const seen: Record<string, number> = {};
  return inWin.map((p) => {
    const house = p.pollster.replace(/\s*\(.*\)$/, '');
    const k = seen[house] ?? 0;
    seen[house] = k + 1;
    const age = (at - ts(p.date)) / DAY;
    const w = Math.pow(0.5, age / HALF_LIFE) * (p.sample ? Math.sqrt(Math.min(p.sample, 3000) / 1000) : 0.8) * Math.pow(0.5, k) * (sponsored(p) ? 0.5 : 1);
    return { p, w, age };
  });
}

export function average(polls: AuPoll[], k: Series, at: number): { v: number; n: number; wsum: number } | null {
  const ws = weights(polls, at).filter(({ p }) => val(p, k) != null);
  const wsum = ws.reduce((a, x) => a + x.w, 0);
  if (!ws.length || wsum <= 0) return null;
  return { v: ws.reduce((a, x) => a + x.w * (val(x.p, k) as number), 0) / wsum, n: ws.length, wsum };
}

/** Trend: the average evaluated at every poll date. */
export function trend(polls: AuPoll[], k: Series) {
  const dates = [...new Set(polls.map((p) => ts(p.date)))].sort((a, b) => a - b);
  return dates.map((t) => ({ t, a: average(polls, k, t)?.v ?? null, raw: polls.filter((p) => ts(p.date) === t).map((p) => val(p, k)).filter((v): v is number => v != null) }));
}

export { ts as pollTs, val as pollVal, sponsored };
