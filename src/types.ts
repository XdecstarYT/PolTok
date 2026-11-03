/**
 * PolTok shared domain contract.
 * ALL agents code against these types. Extend by adding optional fields only —
 * never rename/remove existing fields without coordinating.
 */

export type Party = 'D' | 'R' | 'I' | 'L' | 'G' | 'O';

export type Rating =
  | 'Solid D'
  | 'Likely D'
  | 'Lean D'
  | 'Toss-up'
  | 'Lean R'
  | 'Likely R'
  | 'Solid R';

export type Chamber = 'senate' | 'house' | 'governor';

export type Lean = 'Left' | 'Lean Left' | 'Center' | 'Lean Right' | 'Right' | 'Unrated';

export interface StateInfo {
  abbr: string; // "PA"
  name: string; // "Pennsylvania"
  fips: string; // "42"  (matches us-atlas topojson feature id)
  ev: number; // 2024-apportioned electoral votes
  houseSeats: number;
  pollClose: string; // "20:00" Eastern, final poll close
  /** 2024 presidential result */
  pres2024: { dem: number; rep: number; winner: 'D' | 'R' };
  /** hex cartogram grid position */
  hex: { col: number; row: number };
}

export interface Candidate {
  id: string; // slug e.g. "pa-sen-d"
  name: string;
  party: Party;
  incumbent?: boolean;
  photo?: string; // optional URL; UI must render an initials avatar fallback
  bio?: string;
}

export interface Race {
  id: string; // "PA-SEN", "PA-GOV", "PA-07"
  chamber: Chamber;
  state: string; // abbr
  district?: number; // house only, 0 = at-large
  title: string; // "Pennsylvania Senate"
  rating: Rating;
  incumbentParty: Party;
  open: boolean;
  special?: boolean;
  candidates: Candidate[];
  notes?: string;
  key?: boolean; // marquee race shown on home/live pages
}

/** Live result snapshot for a race (comes from the API / simulation engine). */
export interface RaceResult {
  raceId: string;
  /** votes by candidate id */
  votes: Record<string, number>;
  /** estimated % of expected vote counted, 0..100 */
  expectedPct: number;
  /** candidate id of called winner, if called */
  calledFor?: string;
  calledAt?: number; // epoch ms
  /** model win probability for each candidate id 0..1 ("needle") */
  winProb: Record<string, number>;
  /** counties/precincts reporting text */
  reportingNote?: string;
  updatedAt: number;
  status: 'not-started' | 'polls-closed' | 'counting' | 'called' | 'too-close';
}

export interface BalanceOfPower {
  chamber: 'senate' | 'house';
  total: number;
  majority: number; // seats needed for control
  dem: number; // seats won/held (incl. not-up)
  rep: number;
  ind: number; // caucusing independents (count with D unless noted)
  undecided: number;
  /** projected seats from the live model */
  projected?: { dem: number; rep: number };
  controlProb?: { D: number; R: number };
}

export interface NewsItem {
  id: string;
  title: string;
  url: string;
  source: string; // "NPR"
  sourceLean: Lean;
  publishedAt: number; // epoch ms
  summary?: string;
  image?: string;
  tags?: string[]; // e.g. ["senate","PA"]
  breaking?: boolean;
  /** story cluster id: items about the same story share it */
  clusterId?: string;
}

export interface PollPoint {
  pollster: string;
  date: string; // ISO yyyy-mm-dd (end date)
  sample?: number;
  population?: 'LV' | 'RV' | 'A';
  values: Record<string, number>; // e.g. { D: 47, R: 45 } or { approve: 42, disapprove: 54 }
  grade?: string;
}

export interface PollSeries {
  id: string; // "generic-ballot", "trump-approval", "PA-SEN"
  title: string;
  keys: { key: string; label: string; color: string }[];
  polls: PollPoint[];
}

export interface Market {
  id: string;
  question: string; // "Which party wins the House?"
  outcomes: { label: string; prob: number; color?: string }[];
  source: string; // "Polymarket (simulated)" etc.
  history?: { t: number; p: number }[]; // prob of outcomes[0] over time
}

export interface RaceCallEvent {
  type: 'call';
  raceId: string;
  candidateId: string;
  party: Party;
  flip: boolean;
  at: number;
}

/** Server-sent event envelope streamed from /api/stream */
export type LiveEvent =
  | { type: 'hello'; serverTime: number; mode: 'simulation' | 'live' }
  | { type: 'results'; results: RaceResult[] }
  | { type: 'balance'; balance: BalanceOfPower[] }
  | RaceCallEvent
  | { type: 'news'; items: NewsItem[] }
  | { type: 'markets'; markets: Market[] }
  | { type: 'ticker'; text: string; level: 'info' | 'alert' | 'breaking' };
