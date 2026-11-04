import type { Candidate, Market, NewsItem, Party, Race, RaceResult } from '../../types';
import { POLL_SERIES, raceById, stateByAbbr } from '../../data';
import { seatById } from '../au/model';
import type { AuSeat } from '../../data/au';
import { relatedNews } from '../races/util';
import { isAuWatchId } from '../../lib/watchlist';

export type WatchItem =
  | { kind: 'us'; id: string; race: Race }
  | { kind: 'au'; id: string; seat: AuSeat };

export function resolveWatch(id: string): WatchItem | null {
  if (isAuWatchId(id)) {
    const seat = seatById.get(id.slice(3));
    return seat ? { kind: 'au', id, seat } : null;
  }
  const race = raceById.get(id);
  return race ? { kind: 'us', id, race } : null;
}

export interface ShareRow { cand: Candidate; votes: number; pct: number; prob?: number }

export function candidatesOf(race: Race, r?: RaceResult): Candidate[] {
  return r?.candidates?.length ? r.candidates : race.candidates ?? [];
}

export function shares(race: Race, r?: RaceResult): ShareRow[] {
  const cands = candidatesOf(race, r);
  const total = cands.reduce((s, c) => s + (r?.votes?.[c.id] ?? 0), 0);
  return cands
    .map((cand) => {
      const votes = r?.votes?.[cand.id] ?? 0;
      return { cand, votes, pct: total > 0 ? (votes / total) * 100 : 0, prob: r?.winProb?.[cand.id] };
    })
    .sort((a, b) => b.votes - a.votes);
}

export const totalOf = (r?: RaceResult) => (r?.votes ? Object.values(r.votes).reduce((s, v) => s + (v || 0), 0) : 0);

/** Leading candidate id (by votes), undefined before any votes. */
export function leaderOf(race: Race, r?: RaceResult): string | undefined {
  if (totalOf(r) <= 0) return undefined;
  return shares(race, r)[0]?.cand.id;
}

/** D (or D-aligned independent) minus R, in points. */
export function demMarginOf(race: Race, r?: RaceResult): number | undefined {
  if (totalOf(r) <= 0) return undefined;
  const s = shares(race, r);
  const d = s.find((x) => x.cand.party === 'D') ?? s.find((x) => x.cand.party === 'I');
  const rep = s.find((x) => x.cand.party === 'R');
  if (!d && !rep) return undefined;
  return (d?.pct ?? 0) - (rep?.pct ?? 0);
}

/** Probability the D (or I if no D) side wins, for the needle. */
export function demProbOf(race: Race, r?: RaceResult): number | undefined {
  if (!r?.winProb) return undefined;
  const cands = candidatesOf(race, r);
  const side = cands.some((c) => c.party === 'D') ? 'D' : 'I';
  let p = 0;
  let any = false;
  for (const c of cands)
    if (c.party === side && r.winProb[c.id] != null) {
      p += r.winProb[c.id];
      any = true;
    }
  return any ? p : undefined;
}

export const presMarginOf = (race: Race) => {
  const st = stateByAbbr.get(race.state);
  return st ? st.pres2024.dem - st.pres2024.rep : undefined;
};

export const fmtMargin = (m: number | undefined, d = 1) => (m == null || !Number.isFinite(m) ? '—' : m === 0 ? 'Even' : `${m > 0 ? 'D' : 'R'}+${Math.abs(m).toFixed(d)}`);
export const marginParty = (m: number): Party => (m >= 0 ? 'D' : 'R');

/** Final-stretch poll average: polls within 21 days of the latest poll (max 8). */
export function pollAverage(race: Race): { margin: number; n: number; last: string; byKey: Record<string, number> } | null {
  const series = POLL_SERIES.find((p) => p.id === race.id);
  if (!series || !series.polls.length) return null;
  const sorted = [...series.polls].sort((a, b) => b.date.localeCompare(a.date));
  const lastT = Date.parse(sorted[0].date);
  const recent = sorted.filter((p) => lastT - Date.parse(p.date) <= 21 * 864e5).slice(0, 8);
  const byKey: Record<string, number> = {};
  for (const k of series.keys) {
    const vals = recent.map((p) => p.values[k.key]).filter((v): v is number => typeof v === 'number');
    if (vals.length) byKey[k.key] = vals.reduce((a, b) => a + b, 0) / vals.length;
  }
  const cands = race.candidates ?? [];
  const partyOf = (key: string) => cands.find((c) => c.id === key)?.party ?? (key.endsWith('-d') ? 'D' : key.endsWith('-r') ? 'R' : key.endsWith('-i') ? 'I' : 'O');
  const keys = Object.keys(byKey);
  const dk = keys.find((k) => partyOf(k) === 'D') ?? keys.find((k) => partyOf(k) === 'I');
  const rk = keys.find((k) => partyOf(k) === 'R');
  if (!dk || !rk) return null;
  // normalise to two-way so it's comparable with the two-way-ish result margin
  const dv = byKey[dk];
  const rv = byKey[rk];
  return { margin: dv - rv, n: recent.length, last: sorted[0].date, byKey };
}

export function marketFor(markets: Market[], race: Race): Market | undefined {
  return markets.find((m) => m.raceId === race.id);
}

export function headlinesFor(news: NewsItem[], race: Race, limit = 3): NewsItem[] {
  return relatedNews(news, stateByAbbr.get(race.state), [race], limit);
}

export function shortTitle(race: Race) {
  return race.title || race.id;
}

export function statusLabel(r?: RaceResult): string {
  switch (r?.status) {
    case 'called': return 'Called';
    case 'too-close': return 'Too close';
    case 'counting': return 'Counting';
    case 'polls-closed': return 'Polls closed';
    default: return 'Polls open';
  }
}
