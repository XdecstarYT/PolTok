/** Pure helpers that turn data + live results into map fills / stats per mode. */
import type { Chamber, Party, Race, RaceResult, Rating } from '../../types';
import { HOUSE_TOTAL, RACES, SENATE_NOT_UP } from '../../data';
import { marginColor, mixHex, PARTY_HEX, RATING_HEX, RATINGS } from '../../lib/format';
import { ALL_ABBRS, pres2024, stateEV } from './stateTable';

export type MapMode = 'pres2024' | 'senate' | 'governor' | 'house' | 'live' | 'build';
export const MODES: { id: MapMode; label: string; short: string }[] = [
  { id: 'pres2024', label: '2024 President', short: '2024' },
  { id: 'senate', label: 'Senate 2026', short: 'Senate' },
  { id: 'governor', label: 'Governor 2026', short: 'Gov' },
  { id: 'house', label: 'House 2026', short: 'House' },
  { id: 'live', label: 'Live Results', short: 'Live' },
  { id: 'build', label: 'Build Your Map', short: 'Build' },
];
export const isMode = (m: string | undefined): m is MapMode => !!m && MODES.some((x) => x.id === m);

export const NO_RACE = '#151826';
export const AWAITING = '#2a2f3d';

/** D-positive rating score: Solid D = 3 … Solid R = -3 */
export const RATING_SCORE: Record<Rating, number> = {
  'Solid D': 3,
  'Likely D': 2,
  'Lean D': 1,
  'Toss-up': 0,
  'Lean R': -1,
  'Likely R': -2,
  'Solid R': -3,
};
export const isRating = (r: unknown): r is Rating => typeof r === 'string' && r in RATING_SCORE;

const races = (): Race[] => (Array.isArray(RACES) ? RACES : []);
export const racesOf = (chamber: Chamber) => races().filter((r) => r.chamber === chamber && isRating(r.rating));

/** Races grouped by state, most competitive first. */
export function byState(chamber: Chamber): Map<string, Race[]> {
  const m = new Map<string, Race[]>();
  for (const r of racesOf(chamber)) {
    const arr = m.get(r.state) ?? [];
    arr.push(r);
    m.set(r.state, arr);
  }
  for (const arr of m.values()) arr.sort((a, b) => Math.abs(RATING_SCORE[a.rating]) - Math.abs(RATING_SCORE[b.rating]));
  return m;
}

export function ratingFills(chamber: 'senate' | 'governor'): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [abbr, rs] of byState(chamber)) out[abbr] = RATING_HEX[rs[0].rating];
  return out;
}

export function ratingCounts(list: Race[]): Record<Rating, number> {
  const c = Object.fromEntries(RATINGS.map((r) => [r, 0])) as Record<Rating, number>;
  for (const r of list) c[r.rating]++;
  return c;
}

/** House: state color by mean rating score of its districts. */
export function houseFills(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [abbr, rs] of byState('house')) {
    const mean = rs.reduce((s, r) => s + RATING_SCORE[r.rating], 0) / rs.length;
    out[abbr] = Math.abs(mean) < 0.35 ? RATING_HEX['Toss-up'] : marginColor(mean * 6.5);
  }
  return out;
}

export function houseSplit(abbr: string) {
  const rs = byState('house').get(abbr) ?? [];
  let d = 0,
    r = 0,
    t = 0;
  for (const x of rs) {
    const s = RATING_SCORE[x.rating];
    if (s > 0) d++;
    else if (s < 0) r++;
    else t++;
  }
  return { d, r, t, n: rs.length };
}

export function presFills(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const a of ALL_ABBRS) out[a] = marginColor(pres2024(a).margin);
  return out;
}

export function presEV() {
  let D = 0,
    R = 0;
  for (const a of ALL_ABBRS) {
    if (pres2024(a).winner === 'D') D += stateEV(a);
    else R += stateEV(a);
  }
  return { D, R };
}

/** Senate composition before the election (not-up + incumbents of seats up). */
export function senateNow() {
  const n = SENATE_NOT_UP ?? { D: 0, R: 0, I: 0 };
  let D = (n.D ?? 0) + (n.I ?? 0);
  let R = n.R ?? 0;
  for (const r of racesOf('senate')) {
    if (r.incumbentParty === 'R') R++;
    else if (r.incumbentParty === 'D' || r.incumbentParty === 'I') D++;
  }
  return { D, R, notUpD: (n.D ?? 0) + (n.I ?? 0), notUpR: n.R ?? 0, known: D + R > 0 };
}

export const HOUSE_SEATS = typeof HOUSE_TOTAL === 'number' && HOUSE_TOTAL > 0 ? HOUSE_TOTAL : 435;

// ---------------- live ----------------
export interface Leader {
  candId: string;
  name: string;
  party: Party;
  pct: number;
  runnerPct: number;
  margin: number;
  prob: number;
  called: boolean;
  expectedPct: number;
  status: RaceResult['status'];
}

export function leaderOf(race: Race, res: RaceResult | undefined): Leader | null {
  if (!res || !res.votes) return null;
  const cands = Array.isArray(race.candidates) ? race.candidates : [];
  const total = Object.values(res.votes).reduce((a, b) => a + (b || 0), 0);
  if (res.calledFor) {
    const c = cands.find((x) => x.id === res.calledFor);
    const sorted = Object.entries(res.votes).sort((a, b) => b[1] - a[1]);
    const pct = total ? ((res.votes[res.calledFor] ?? 0) / total) * 100 : 0;
    const run = sorted.find(([id]) => id !== res.calledFor);
    const runnerPct = total && run ? (run[1] / total) * 100 : 0;
    return {
      candId: res.calledFor,
      name: c?.name ?? 'Winner',
      party: c?.party ?? partyFromId(res.calledFor),
      pct,
      runnerPct,
      margin: pct - runnerPct,
      prob: 1,
      called: true,
      expectedPct: res.expectedPct ?? 0,
      status: res.status,
    };
  }
  if (!total) return null;
  const sorted = Object.entries(res.votes).sort((a, b) => b[1] - a[1]);
  const [topId, topV] = sorted[0];
  const runV = sorted[1]?.[1] ?? 0;
  const c = cands.find((x) => x.id === topId);
  const pct = (topV / total) * 100;
  const runnerPct = (runV / total) * 100;
  return {
    candId: topId,
    name: c?.name ?? topId,
    party: c?.party ?? partyFromId(topId),
    pct,
    runnerPct,
    margin: pct - runnerPct,
    prob: res.winProb?.[topId] ?? 0.5,
    called: false,
    expectedPct: res.expectedPct ?? 0,
    status: res.status,
  };
}

function partyFromId(id: string): Party {
  const p = id.split('-').pop()?.charAt(0).toUpperCase();
  return (['D', 'R', 'I', 'L', 'G'].includes(p ?? '') ? p : 'O') as Party;
}

/** Color for a leader: saturation scales with margin & win probability. */
export function leaderColor(l: Leader | null): string {
  if (!l) return AWAITING;
  const hex = PARTY_HEX[l.party] ?? PARTY_HEX.O;
  if (l.called) return hex;
  const byMargin = Math.min(1, l.margin / 15);
  const byProb = Math.max(0, (l.prob - 0.5) * 2);
  const s = 0.18 + 0.5 * Math.max(byMargin, byProb);
  return mixHex(AWAITING, hex, s);
}

export function liveFills(chamber: Chamber, results: Record<string, RaceResult>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [abbr, rs] of byState(chamber)) {
    if (chamber === 'house') {
      let d = 0,
        r = 0,
        any = 0;
      for (const race of rs) {
        const l = leaderOf(race, results[race.id]);
        if (!l) continue;
        any++;
        if (l.party === 'D') d++;
        else if (l.party === 'R') r++;
      }
      if (!any) out[abbr] = AWAITING;
      else out[abbr] = marginColor(((d - r) / Math.max(1, rs.length)) * 20);
    } else {
      // Use the top race (most competitive) for the state color.
      out[abbr] = leaderColor(leaderOf(rs[0], results[rs[0].id]));
    }
  }
  return out;
}
