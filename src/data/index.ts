// Typed façade over shared/data (plain JS shared with the server).
import type { PollSeries, Race, StateInfo } from '../types';
import { STATES as S, RACES as R, POLL_SERIES as P, SENATE_NOT_UP as N, HOUSE_TOTAL as H } from '../../shared/data/index.js';

export const STATES = S as StateInfo[];
export const RACES = R as Race[];
export const POLL_SERIES = P as PollSeries[];
export const SENATE_NOT_UP = N as { D: number; R: number; I: number };
export const HOUSE_TOTAL = H as number;

export const stateByAbbr = new Map(STATES.map((s) => [s.abbr, s]));
export const stateByFips = new Map(STATES.map((s) => [s.fips, s]));
export const raceById = new Map(RACES.map((r) => [r.id, r]));
export const racesByState = (abbr: string) => RACES.filter((r) => r.state === abbr);
