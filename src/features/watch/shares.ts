// Lightweight vote-share helpers (no data imports) so the always-mounted WatchAlerts stays out of heavy chunks.
import type { Candidate, Race, RaceResult } from '../../types';

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

