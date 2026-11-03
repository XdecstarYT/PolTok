/**
 * Live election-night derived data. Pure functions over RACES / STATES / live results.
 * Everything here is defensive: results, balance, states may be empty while data loads.
 */
import type { BalanceOfPower, Candidate, Chamber, Party, Race, RaceResult, StateInfo } from '../../types';
import { HOUSE_TOTAL, RACES, SENATE_NOT_UP, STATES, stateByAbbr } from '../../data';

export type Status = RaceResult['status'];

export interface CandView {
  c: Candidate;
  votes: number;
  pct: number;
  prob: number;
}

export interface RaceView {
  race: Race;
  result?: RaceResult;
  state?: StateInfo;
  cands: CandView[]; // sorted: votes desc (or ballot order before counting)
  total: number;
  expectedPct: number;
  status: Status;
  leader?: CandView;
  /** leader minus runner-up, percentage points (>= 0) */
  lead: number;
  /** signed margin: + = D (or caucusing I) side, − = R side, in points */
  dMargin: number;
  /** probability the D-caucusing side wins (0..1) */
  dProb: number;
  winner?: Candidate;
  flip: boolean;
  closeMin: number; // poll close, minutes after midnight ET, normalized (>= 12:00)
  updatedAt: number;
}

export const isDSide = (p: Party) => p === 'D' || p === 'I';

/** Normalize an "HH:MM" ET string into minutes, pushing after-midnight closes to the next day. */
export function closeMinutes(hhmm: string | undefined): number {
  if (!hhmm) return 20 * 60;
  const [h, m] = hhmm.split(':').map((x) => parseInt(x, 10));
  const v = (isFinite(h) ? h : 20) * 60 + (isFinite(m) ? m : 0);
  return v < 12 * 60 ? v + 24 * 60 : v;
}

export function fmtClock(min: number): string {
  const m = ((Math.floor(min) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${mm ? ':' + String(mm).padStart(2, '0') : ''} ${h < 12 ? 'AM' : 'PM'}`;
}

const etFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const etFull = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', second: '2-digit' });
const etShort = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' });

/** Current ET minutes on the election-night axis (after-midnight hours roll to 24+). */
export function etNowMinutes(now = Date.now()): number {
  const parts = etFmt.formatToParts(now);
  const h = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  const m = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
  const v = h * 60 + m;
  return h < 6 ? v + 24 * 60 : v;
}
export const fmtEtTime = (ts: number) => etShort.format(ts);
export const fmtEtTimeSec = (ts: number) => etFull.format(ts);

export function buildRaceView(race: Race, result: RaceResult | undefined): RaceView {
  const state = stateByAbbr.get(race.state);
  const votes = result?.votes ?? {};
  const total = Object.values(votes).reduce((a, b) => a + (b || 0), 0);
  const cands: CandView[] = (race.candidates ?? []).map((c) => {
    const v = votes[c.id] ?? 0;
    return { c, votes: v, pct: total > 0 ? (v / total) * 100 : 0, prob: result?.winProb?.[c.id] ?? 0 };
  });
  if (total > 0) cands.sort((a, b) => b.votes - a.votes);
  else cands.sort((a, b) => b.prob - a.prob);
  const leader = total > 0 ? cands[0] : undefined;
  const lead = total > 0 && cands.length > 1 ? cands[0].pct - cands[1].pct : total > 0 ? 100 : 0;

  const dC = cands.filter((x) => isDSide(x.c.party)).sort((a, b) => b.votes - a.votes)[0];
  const rC = cands.filter((x) => x.c.party === 'R').sort((a, b) => b.votes - a.votes)[0];
  let dMargin = 0;
  if (total > 0) {
    if (dC || rC) dMargin = (dC?.pct ?? 0) - (rC?.pct ?? 0);
    else if (leader) dMargin = 0;
  }
  let dProb = 0.5;
  if (result?.winProb && Object.keys(result.winProb).length) {
    dProb = cands.filter((x) => isDSide(x.c.party)).reduce((a, x) => a + x.prob, 0);
  } else if (race.rating) {
    dProb = RATING_PROB[race.rating] ?? 0.5;
  }

  const winner = result?.calledFor ? race.candidates.find((c) => c.id === result.calledFor) : undefined;
  if (winner) dProb = isDSide(winner.party) ? 1 : 0;
  const flip = !!winner && sideOf(winner.party) !== sideOf(race.incumbentParty);
  return {
    race,
    result,
    state,
    cands,
    total,
    expectedPct: result?.expectedPct ?? 0,
    status: result?.status ?? 'not-started',
    leader,
    lead,
    dMargin,
    dProb,
    winner,
    flip,
    closeMin: closeMinutes(state?.pollClose),
    updatedAt: result?.updatedAt ?? 0,
  };
}

const sideOf = (p: Party) => (isDSide(p) ? 'D' : p === 'R' ? 'R' : p);

export const RATING_PROB: Record<string, number> = {
  'Solid D': 0.98,
  'Likely D': 0.88,
  'Lean D': 0.7,
  'Toss-up': 0.5,
  'Lean R': 0.3,
  'Likely R': 0.12,
  'Solid R': 0.02,
};
const RATING_RANK: Record<string, number> = { 'Toss-up': 0, 'Lean D': 1, 'Lean R': 1, 'Likely D': 2, 'Likely R': 2, 'Solid D': 3, 'Solid R': 3 };

export function buildViews(results: Record<string, RaceResult>, chamber?: Chamber): RaceView[] {
  return RACES.filter((r) => !chamber || r.chamber === chamber).map((r) => buildRaceView(r, results[r.id]));
}

export type SortKey = 'key' | 'closest' | 'recent' | 'close-time';
export type FilterKey = 'all' | 'called' | 'uncalled' | 'flips';

export function sortViews(vs: RaceView[], key: SortKey): RaceView[] {
  const a = [...vs];
  const closeness = (v: RaceView) => (v.total > 0 ? v.lead : 100 + Math.abs(v.dProb - 0.5) * 100);
  switch (key) {
    case 'key':
      return a.sort(
        (x, y) =>
          Number(!!y.race.key) - Number(!!x.race.key) ||
          (RATING_RANK[x.race.rating] ?? 4) - (RATING_RANK[y.race.rating] ?? 4) ||
          x.race.state.localeCompare(y.race.state),
      );
    case 'closest':
      return a.sort((x, y) => Number(!!x.winner) - Number(!!y.winner) || closeness(x) - closeness(y));
    case 'recent':
      return a.sort((x, y) => y.updatedAt - x.updatedAt || x.race.state.localeCompare(y.race.state));
    case 'close-time':
      return a.sort((x, y) => x.closeMin - y.closeMin || x.race.state.localeCompare(y.race.state));
  }
}

export function filterViews(vs: RaceView[], f: FilterKey, q: string): RaceView[] {
  const qq = q.trim().toLowerCase();
  return vs.filter((v) => {
    if (f === 'called' && !v.winner) return false;
    if (f === 'uncalled' && v.winner) return false;
    if (f === 'flips' && !v.flip) return false;
    if (!qq) return true;
    return (
      v.race.state.toLowerCase() === qq ||
      v.race.id.toLowerCase().includes(qq) ||
      v.race.title.toLowerCase().includes(qq) ||
      (v.state?.name.toLowerCase().includes(qq) ?? false) ||
      v.race.candidates.some((c) => c.name.toLowerCase().includes(qq))
    );
  });
}

// ---------------------------------------------------------------------------
// Balance of power fallback (if the stream hasn't sent one) + paths to majority

export interface ChamberSummary {
  chamber: 'senate' | 'house';
  balance?: BalanceOfPower;
  dSeats: number; // won (incl. caucusing ind + not up)
  rSeats: number;
  undecided: number;
  projD: number;
  projR: number;
  total: number;
  majority: number;
  probD: number; // chance D controls
  uncalledFrac: number; // share of contested seats still uncalled (0..1)
  dNeed: number;
  rNeed: number;
  dLeads: RaceView[]; // uncalled races leaning D, closest first
  rLeads: RaceView[];
  ready: boolean;
}

export function summarizeChamber(chamber: 'senate' | 'house', bal: BalanceOfPower | undefined, views: RaceView[]): ChamberSummary {
  const total = bal?.total ?? (chamber === 'senate' ? 100 : HOUSE_TOTAL || 435);
  const majority = bal?.majority ?? (chamber === 'senate' ? 51 : 218);
  const uncalled = views.filter((v) => !v.winner);
  const lean = (v: RaceView) => (v.total > 0 ? v.dMargin > 0 || (v.dMargin === 0 && v.dProb >= 0.5) : v.dProb >= 0.5);
  const dLeads = uncalled.filter(lean).sort((a, b) => Math.abs(a.dProb - 0.5) - Math.abs(b.dProb - 0.5));
  const rLeads = uncalled.filter((v) => !lean(v)).sort((a, b) => Math.abs(a.dProb - 0.5) - Math.abs(b.dProb - 0.5));

  let dSeats: number, rSeats: number, undecided: number, projD: number, projR: number, probD: number;
  if (bal) {
    dSeats = (bal.dem ?? 0) + (bal.ind ?? 0);
    rSeats = bal.rep ?? 0;
    undecided = bal.undecided ?? Math.max(0, total - dSeats - rSeats);
    projD = bal.projected?.dem ?? dSeats + dLeads.length;
    projR = bal.projected?.rep ?? rSeats + rLeads.length;
    probD = bal.controlProb ? bal.controlProb.D / Math.max(1e-9, bal.controlProb.D + bal.controlProb.R) : monteCarlo(dSeats, uncalled, majority);
  } else {
    // derive from races (complete only for the Senate, or if all House seats are in data)
    const notUp = chamber === 'senate' ? (SENATE_NOT_UP?.D ?? 0) + (SENATE_NOT_UP?.I ?? 0) : 0;
    const notUpR = chamber === 'senate' ? SENATE_NOT_UP?.R ?? 0 : 0;
    // Each race = one seat
    const calledD = views.filter((v) => v.winner && isDSide(v.winner.party)).length;
    const calledR = views.filter((v) => v.winner && !isDSide(v.winner.party)).length;
    dSeats = notUp + calledD;
    rSeats = notUpR + calledR;
    undecided = Math.max(0, total - dSeats - rSeats);
    projD = dSeats + dLeads.length;
    projR = rSeats + rLeads.length;
    probD = monteCarlo(dSeats, uncalled, majority);
  }
  const contested = Math.max(1, views.length || undecided);
  // Senate tie → VP (R) breaks it, so R needs total - majority + 1 = 50.
  const rMaj = chamber === 'senate' ? total - majority + 1 : majority;
  const ready = !!bal || views.some((v) => !!v.result);
  return {
    chamber,
    balance: bal,
    dSeats,
    rSeats,
    undecided,
    projD,
    projR,
    total,
    majority,
    probD,
    uncalledFrac: Math.min(1, uncalled.length / contested),
    dNeed: Math.max(0, majority - dSeats),
    rNeed: Math.max(0, rMaj - rSeats),
    dLeads,
    rLeads,
    ready,
  };
}

/** Independent-race Monte Carlo for chance of D control. Deterministic seed for stable output. */
function monteCarlo(dSeats: number, uncalled: RaceView[], majority: number): number {
  if (!uncalled.length) return dSeats >= majority ? 1 : 0;
  let seed = 1337;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const N = 800;
  let wins = 0;
  for (let i = 0; i < N; i++) {
    // add a correlated national shift
    const shift = (rnd() - 0.5) * 0.25;
    let d = dSeats;
    for (const v of uncalled) if (rnd() < Math.min(1, Math.max(0, v.dProb + shift))) d++;
    if (d >= majority) wins++;
  }
  return wins / N;
}

/** Needle zone label for a probability that D controls. */
export function zoneLabel(pD: number): { text: string; party: Party | null } {
  const pR = 1 - pD;
  if (pD >= 0.95) return { text: 'Very likely D', party: 'D' };
  if (pD >= 0.75) return { text: 'Likely D', party: 'D' };
  if (pD >= 0.6) return { text: 'Lean D', party: 'D' };
  if (pR >= 0.95) return { text: 'Very likely R', party: 'R' };
  if (pR >= 0.75) return { text: 'Likely R', party: 'R' };
  if (pR >= 0.6) return { text: 'Lean R', party: 'R' };
  return { text: 'Toss-up', party: null };
}

/** Pick the "main" race for a state in a chamber (non-special first). */
export function mainRaceByState(views: RaceView[]): Map<string, RaceView> {
  const m = new Map<string, RaceView>();
  for (const v of views) {
    const prev = m.get(v.race.state);
    if (!prev || (prev.race.special && !v.race.special)) m.set(v.race.state, v);
  }
  return m;
}

export const ALL_STATES = () => STATES;
