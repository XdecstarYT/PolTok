// Helpers for the Races & States feature (owned by agent 10).
import type { Candidate, NewsItem, Party, Race, RaceResult, Rating, StateInfo } from '../../types';
import { HOUSE_BASELINE, RACES, SENATE_NOT_UP, STATES } from '../../data';
import { RATINGS } from '../../lib/format';

export type ChamberTab = 'senate' | 'governor' | 'house';

export const CHAMBER_LABEL: Record<ChamberTab, string> = {
  senate: 'Senate',
  governor: 'Governor',
  house: 'House',
};

export interface Share {
  cand: Candidate;
  votes: number;
  pct: number; // 0..100 of total counted
  prob: number | undefined; // 0..1
}

/** Candidates with votes/pct/prob, sorted by votes (desc), then D, R, others when no votes yet. */
export function sharesOf(race: Race, result?: RaceResult): Share[] {
  const cands = race.candidates ?? [];
  const total = cands.reduce((s, c) => s + (result?.votes?.[c.id] ?? 0), 0);
  const order: Record<string, number> = { D: 0, R: 1, I: 2, L: 3, G: 4, O: 5 };
  return cands
    .map((cand) => {
      const votes = result?.votes?.[cand.id] ?? 0;
      return { cand, votes, pct: total > 0 ? (votes / total) * 100 : 0, prob: result?.winProb?.[cand.id] };
    })
    .sort((a, b) => b.votes - a.votes || (order[a.cand.party] ?? 9) - (order[b.cand.party] ?? 9));
}

export function totalVotes(result?: RaceResult): number {
  if (!result?.votes) return 0;
  return Object.values(result.votes).reduce((s, v) => s + (v || 0), 0);
}

/** The two headline candidates: first D and first R if present, else the first two listed. */
export function headlinePair(race: Race): [Candidate | undefined, Candidate | undefined] {
  const c = race.candidates ?? [];
  const d = c.find((x) => x.party === 'D');
  const r = c.find((x) => x.party === 'R');
  if (d && r) return [d, r];
  const rest = c.filter((x) => x !== d && x !== r);
  const list = [d, r, ...rest].filter(Boolean) as Candidate[];
  return [list[0], list[1]];
}

export interface Leader {
  cand: Candidate;
  marginPct: number; // lead over 2nd in pct points
  called: boolean;
}

export function leaderOf(race: Race, result?: RaceResult): Leader | undefined {
  if (!result) return undefined;
  const cands = race.candidates ?? [];
  if (result.calledFor) {
    const w = cands.find((c) => c.id === result.calledFor);
    if (w) {
      const s = sharesOf(race, result);
      const wi = s.findIndex((x) => x.cand.id === w.id);
      const other = s.find((_, i) => i !== wi);
      return { cand: w, marginPct: (s[wi]?.pct ?? 0) - (other?.pct ?? 0), called: true };
    }
  }
  if (totalVotes(result) <= 0) return undefined;
  const s = sharesOf(race, result);
  if (!s[0]) return undefined;
  return { cand: s[0].cand, marginPct: s[0].pct - (s[1]?.pct ?? 0), called: false };
}

/** Is the called winner a party flip vs the incumbent party? */
export function isFlip(race: Race, result?: RaceResult): boolean {
  if (!result?.calledFor) return false;
  const w = race.candidates?.find((c) => c.id === result.calledFor);
  if (!w) return false;
  const norm = (p: Party) => (p === 'I' ? 'D' : p); // caucusing independents count with D
  return norm(w.party) !== norm(race.incumbentParty);
}

/** D minus R share of counted vote (pct points); undefined if nothing counted. */
export function demMargin(race: Race, result?: RaceResult): number | undefined {
  if (totalVotes(result) <= 0) return undefined;
  const s = sharesOf(race, result);
  const d = s.find((x) => x.cand.party === 'D') ?? s.find((x) => x.cand.party === 'I');
  const r = s.find((x) => x.cand.party === 'R');
  if (!d && !r) return undefined;
  return (d?.pct ?? 0) - (r?.pct ?? 0);
}

export const presMargin = (st: StateInfo) => st.pres2024.dem - st.pres2024.rep;

export function fmtSignedMargin(m: number | undefined): string {
  if (m === undefined || Number.isNaN(m)) return '—';
  if (Math.abs(m) < 0.05) return 'Even';
  return `${m > 0 ? 'D' : 'R'}+${Math.abs(m).toFixed(1)}`;
}

/** "20:00" → "8:00 PM ET" */
export function fmtCloseET(hhmm?: string): string {
  if (!hhmm) return 'TBD';
  const [h, m] = hhmm.split(':').map((x) => parseInt(x, 10));
  if (Number.isNaN(h)) return hhmm;
  const hh = h % 24;
  const h12 = ((hh + 11) % 12) + 1;
  return `${h12}:${String(m || 0).padStart(2, '0')} ${hh >= 12 ? 'PM' : 'AM'} ET${h >= 24 ? ' (Nov 4)' : ''}`;
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** Short label: "PA Senate", "PA Gov", "PA-07". */
export function shortLabel(race: Race): string {
  if (race.chamber === 'house') return race.id;
  if (race.chamber === 'governor') return `${race.state} Gov`;
  return `${race.state} Sen${race.special ? '*' : ''}`;
}

export function longTitle(race: Race): string {
  if (race.title) return race.title;
  const st = STATES.find((s) => s.abbr === race.state);
  const name = st?.name ?? race.state;
  if (race.chamber === 'house') return race.district ? `${name} ${ordinal(race.district)} District` : `${name} At-Large`;
  return `${name} ${race.chamber === 'senate' ? 'Senate' : 'Governor'}${race.special ? ' (Special)' : ''}`;
}

export const incumbentOf = (race: Race) => race.candidates?.find((c) => c.incumbent);

export function statusText(result: RaceResult | undefined, st?: StateInfo): string {
  if (!result || result.status === 'not-started') return st ? `Polls close ${fmtCloseET(st.pollClose)}` : 'Awaiting polls closing';
  switch (result.status) {
    case 'polls-closed':
      return 'Polls closed · awaiting results';
    case 'counting':
      return 'Counting votes';
    case 'too-close':
      return 'Too close to call';
    case 'called':
      return 'Race called';
    default:
      return '';
  }
}

export const ratingIndex = (r: Rating) => Math.max(0, RATINGS.indexOf(r));

/** Real headlines only: news tagged with the state abbr, or naming the state / a candidate surname. */
export function relatedNews(news: NewsItem[], st: StateInfo | undefined, races: Race[], limit = 8): NewsItem[] {
  if (!st) return [];
  const abbr = st.abbr.toUpperCase();
  const nameRe = new RegExp(`\\b${escapeRe(st.name)}\\b`, 'i');
  const surnames = new Set<string>();
  for (const r of races)
    for (const c of r.candidates ?? []) {
      if (!c.name || /^tbd$/i.test(c.name)) continue;
      const parts = c.name.replace(/,?\s+(Jr\.?|Sr\.?|III|II|IV)$/i, '').split(/\s+/);
      const last = parts[parts.length - 1];
      if (last && last.length >= 4) surnames.add(last);
    }
  const surRe = surnames.size ? new RegExp(`\\b(${[...surnames].map(escapeRe).join('|')})\\b`) : null;
  const out: NewsItem[] = [];
  for (const n of news) {
    const tagHit = n.tags?.some((t) => t.toUpperCase() === abbr || t.toLowerCase() === st.name.toLowerCase());
    if (tagHit || nameRe.test(n.title) || (surRe && surRe.test(n.title))) out.push(n);
    if (out.length >= limit) break;
  }
  return out;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* ---------------- Seat math ---------------- */

export interface SeatMath {
  chamber: ChamberTab;
  counts: Record<Rating, number>;
  /** seats held/safe-or-leaning before toss-ups */
  dBase: number;
  rBase: number;
  tossups: number;
  majority: number;
  /** current seats held by each side (not-up + up held) */
  dHeld: number;
  rHeld: number;
  /** net gain the Democrats need for control */
  dNeed: number;
  rNeed: number;
  total: number;
  tracked: number;
}

export function seatMath(chamber: ChamberTab, races: Race[] = RACES): SeatMath {
  const list = races.filter((r) => r.chamber === chamber);
  const counts = Object.fromEntries(RATINGS.map((r) => [r, 0])) as Record<Rating, number>;
  for (const r of list) if (counts[r.rating] !== undefined) counts[r.rating]++;
  const dLean = counts['Solid D'] + counts['Likely D'] + counts['Lean D'];
  const rLean = counts['Solid R'] + counts['Likely R'] + counts['Lean R'];
  const isD = (p: Party) => p === 'D' || p === 'I';
  const heldD = list.filter((r) => isD(r.incumbentParty)).length;
  const heldR = list.filter((r) => r.incumbentParty === 'R').length;

  if (chamber === 'senate') {
    const nu = SENATE_NOT_UP ?? { D: 0, R: 0, I: 0 };
    const dNot = (nu.D || 0) + (nu.I || 0);
    const rNot = nu.R || 0;
    const total = dNot + rNot + list.length || 100;
    // VP (JD Vance) breaks ties for Republicans → D need 51, R need 50.
    const dHeld = dNot + heldD;
    const rHeld = rNot + heldR;
    return {
      chamber,
      counts,
      dBase: dNot + dLean,
      rBase: rNot + rLean,
      tossups: counts['Toss-up'],
      majority: 51,
      dHeld,
      rHeld,
      dNeed: Math.max(0, 51 - dHeld),
      rNeed: Math.max(0, 50 - rHeld),
      total,
      tracked: list.length,
    };
  }
  const total = chamber === 'house' ? 435 : 50;
  const majority = chamber === 'house' ? 218 : 26;
  const hb = chamber === 'house' ? HOUSE_BASELINE : undefined;
  return {
    chamber,
    counts,
    dBase: dLean + (hb?.D ?? 0),
    rBase: rLean + (hb?.R ?? 0),
    tossups: counts['Toss-up'],
    majority,
    dHeld: heldD,
    rHeld: heldR,
    dNeed: 0,
    rNeed: 0,
    total,
    tracked: list.length,
  };
}

/* ---------------- Search / suggestions ---------------- */

export function suggest(q: string, limit = 6): { label: string; to: string; sub: string }[] {
  const s = q.trim().toLowerCase().replace(/[-_\s]+/g, ' ');
  if (!s) return [];
  const words = s.split(' ').filter(Boolean);
  const scored: { label: string; to: string; sub: string; score: number }[] = [];
  for (const st of STATES) {
    const hay = `${st.abbr} ${st.name}`.toLowerCase();
    const score = words.reduce((a, w) => a + (hay.includes(w) ? (st.abbr.toLowerCase() === w ? 3 : 1) : 0), 0);
    if (score) scored.push({ label: st.name, to: `/state/${st.abbr}`, sub: 'State hub', score });
  }
  for (const r of RACES) {
    const hay = `${r.id} ${r.title} ${r.state} ${r.chamber} ${(r.candidates ?? []).map((c) => c.name).join(' ')}`
      .toLowerCase()
      .replace(/[-_]+/g, ' ');
    const score = words.reduce((a, w) => a + (hay.includes(w) ? 1 : 0), 0) + (r.key ? 0.5 : 0);
    if (score >= 1) scored.push({ label: longTitle(r), to: `/race/${r.id}`, sub: r.rating, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Nearby states via the hex grid (adjacent tiles). */
export function nearbyStates(st: StateInfo): StateInfo[] {
  if (!st.hex) return [];
  return STATES.filter(
    (o) => o.abbr !== st.abbr && o.hex && Math.abs(o.hex.row - st.hex.row) <= 1 && Math.abs(o.hex.col - st.hex.col) <= 1,
  ).sort((a, b) => a.name.localeCompare(b.name));
}

export function sortedStates(): StateInfo[] {
  return [...STATES].sort((a, b) => a.name.localeCompare(b.name));
}

export const chamberOrder: Record<string, number> = { senate: 0, governor: 1, house: 2 };

export function sortRacesForState(list: Race[]): Race[] {
  return [...list].sort(
    (a, b) =>
      (chamberOrder[a.chamber] ?? 9) - (chamberOrder[b.chamber] ?? 9) ||
      (a.special ? 1 : 0) - (b.special ? 1 : 0) ||
      (a.district ?? 0) - (b.district ?? 0),
  );
}
