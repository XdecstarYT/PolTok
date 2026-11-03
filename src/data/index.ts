// Typed façade over shared/data (plain JS shared with the server).
import type { NewsItem, PollSeries, Race, StateInfo } from '../types';
import {
  STATES as S,
  RACES as R,
  POLL_SERIES as P,
  SENATE_NOT_UP as N,
  HOUSE_TOTAL as H,
  HOUSE_BASELINE as HB,
  HOUSE_COMPOSITION as HC,
  SENATE_COMPOSITION as SC,
  GOVERNOR_COMPOSITION as GC,
  RATER_TOTALS as RT,
  ELECTION_META as EM,
  POLL_CLOSE_FIRST as PCF,
  PRES_2024_NATIONAL as PN,
  GENERIC_BALLOT as GB,
  APPROVAL as AP,
  MARKETS_BASELINE as MB,
  FALLBACK_NEWS as FN,
} from '../../shared/data/index.js';
export interface HouseBaseline { D: number; R: number; total: number; source: string }
export interface HouseComposition {
  R: number; D: number; I: number; vacancies: number; total: number; majority: number;
  republicanConference: number; independent: string;
  vacant: { seat: string; lastParty: 'D' | 'R'; note: string }[]; notes: string;
}
export interface SenateComposition {
  R: number; D: number; I: number; independentsCaucusWith: 'D'; seatsUp: number;
  seatsUpByParty: { D: number; R: number; I: number }; majority: number; tiebreaker: string;
  demNetGainNeeded: number; notes: string;
}
export interface GovernorComposition { R: number; D: number; seatsUp: number; seatsUpByParty: { R: number; D: number } }
export interface RaterTotals {
  house: Record<string, { date: string; D: number; R: number; tossup: number }>;
  senateCook: { date: string; SolidD: number; LikelyD: number; LeanD: number; Tossup: number; LeanR: number; LikelyR: number; SolidR: number };
}
export interface ElectionMeta {
  date: string; senateMajority: 51; vpParty: 'R'; houseMajority: 218; governorsUp: number;
  senateSeatsUp: number; asOf: string; ratingSource: string;
}
export interface Pres2024National { repEV: number; demEV: number; repPct: number; demPct: number; repVotes: number; demVotes: number }
export interface GenericBallotAverages {
  pollcheck: { D: number; R: number; polls: number; asOf: string; source: string };
  rcp: { margin: number; label: string; asOf: string; source: string };
}
export interface ApprovalAverages {
  pollcheck: { approve: number; disapprove: number; asOf: string; source: string };
  rcp: { approve: number; disapprove: number; asOf: string };
  silverBulletin: { approve: number; disapprove: number; asOf: string };
  source: string;
}
/** Real market prices (percent) as of Nov 2 2026 noon ET; kalshiRaces keyed by state abbr. */
export interface MarketsBaseline {
  asOf: string;
  kalshi: { houseDem: number; senateDem: number; balanceOfPower: { demSweep: number; demHouseRepSenate: number; repSweep: number; repHouseDemSenate: number } };
  polymarket: { houseDem: number; senateDem: number };
  kalshiRaces: { senate: Record<string, { dem?: number; rep?: number }>; governor: Record<string, { dem?: number; rep?: number }> };
  sources: string[];
}

export const STATES = S as StateInfo[];
export const RACES = R as Race[];
export const POLL_SERIES = P as PollSeries[];
export const SENATE_NOT_UP = N as { D: number; R: number; I: number };
export const HOUSE_TOTAL = H as number;
/** Non-listed House seats by the party they are rated to go (Cook). D + R + listed house races = 435. */
export const HOUSE_BASELINE = HB as HouseBaseline;
export const HOUSE_COMPOSITION = HC as HouseComposition;
export const SENATE_COMPOSITION = SC as SenateComposition;
export const GOVERNOR_COMPOSITION = GC as GovernorComposition;
export const RATER_TOTALS = RT as RaterTotals;
export const ELECTION_META = EM as ElectionMeta;
/** Earliest partial poll close (ET "HH:MM", hours >= 24 = next day) for two-wave states. */
export const POLL_CLOSE_FIRST = PCF as Record<string, string>;
export const PRES_2024_NATIONAL = PN as Pres2024National;
export const GENERIC_BALLOT = GB as GenericBallotAverages;
export const APPROVAL = AP as ApprovalAverages;
export const MARKETS_BASELINE = MB as MarketsBaseline;
export const FALLBACK_NEWS = FN as NewsItem[];

export const stateByAbbr = new Map(STATES.map((s) => [s.abbr, s]));
export const stateByFips = new Map(STATES.map((s) => [s.fips, s]));
export const raceById = new Map(RACES.map((r) => [r.id, r]));
export const racesByState = (abbr: string) => RACES.filter((r) => r.state === abbr);
export const pollSeriesById = new Map(POLL_SERIES.map((p) => [p.id, p]));

/** Parse a StateInfo.pollClose ("HH:MM" ET, hours >= 24 = Nov 4) to minutes after midnight Nov 3 ET. */
export const pollCloseMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
