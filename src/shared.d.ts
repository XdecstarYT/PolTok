declare module '*/shared/data/index.js' {
  export const STATES: unknown[];
  export const RACES: unknown[];
  export const POLL_SERIES: unknown[];
  export const SENATE_NOT_UP: unknown;
  export const HOUSE_TOTAL: unknown;
  export const FALLBACK_NEWS: unknown[];
  // Added by Data agent (agent 5): typed in src/data/index.ts
  export const HOUSE_BASELINE: unknown;
  export const HOUSE_COMPOSITION: unknown;
  export const SENATE_COMPOSITION: unknown;
  export const GOVERNOR_COMPOSITION: unknown;
  export const RATER_TOTALS: unknown;
  export const ELECTION_META: unknown;
  export const POLL_CLOSE_FIRST: unknown;
  export const PRES_2024_NATIONAL: unknown;
  export const GENERIC_BALLOT: unknown;
  export const APPROVAL: unknown;
  export const MARKETS_BASELINE: unknown;
}
declare module '*/shared/sim.js' {
  import type { BalanceOfPower, LiveEvent, Market, Race, RaceResult, StateInfo } from './types';
  export function createSimulation(opts: {
    races: Race[];
    states: StateInfo[];
    speed?: number;
    seed?: number;
    startAt?: number;
  }): {
    start(): void;
    stop(): void;
    snapshot(): { results: RaceResult[]; balance: BalanceOfPower[]; markets: Market[] };
    subscribe(fn: (ev: LiveEvent) => void): () => void;
  };
}
