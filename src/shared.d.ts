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
    clock?(): { simMinute: number; et: string; progress: number; final: boolean };
  };
}

declare module '*/shared/nyt.js' {
  import type { RaceResult, BalanceOfPower, Market, LiveEvent, Race, StateInfo } from './types';
  export const LIVE_ATTRIBUTION: string;
  export const NYT_SOURCES: Record<'senate' | 'governor' | 'house', string>;
  export function createNytProvider(opts: { races: Race[]; states?: StateInfo[]; pollMs?: number; housePollMs?: number; log?: (m: string) => void }): {
    mode: 'live';
    start(): void;
    stop(): void;
    snapshot(): { results: RaceResult[]; balance: BalanceOfPower[]; markets: Market[] };
    subscribe(fn: (ev: LiveEvent) => void): () => void;
    clock(): { simMinute: number; et: string; progress: number; final: boolean; live?: boolean };
  };
}
declare module '*/server/feeds.js' {
  export const OUTLET_LEAN: Record<string, string>;
}
declare module '*/shared/compose.js' {
  export type ComposeKind = 'race' | 'balance' | 'au-seat' | 'promo' | 'stat' | 'flip' | 'quote';
  export interface ComposeResult {
    subject: { kind: ComposeKind; id: string };
    designId: string;
    tweet: string;
    cardOverrides: { title?: string; subtitle?: string; footer?: string };
    altText: string;
    fixes: string[];
  }
  export const COMPOSE_KINDS: ComposeKind[];
  export const TWEET_MAX: number;
  export function parseComposeJson(text: string): Record<string, unknown> | null;
  export function cleanTweet(t: unknown): string;
  export function validateCompose(raw: unknown, designs?: { id: string; kinds?: string[] }[], opts?: { validId?: (kind: string, id: string) => boolean }): ComposeResult;
  export function designsForPrompt(designs: unknown[], max?: number): string;
  export type StudioMode = 'thread' | 'calendar' | 'reply' | 'hashtags' | 'variants' | 'hooks' | 'explain' | 'factcheck' | 'image-alt';
  export interface StudioSettings { voice: string; custom: string; audience: 'us' | 'au' | 'global'; emoji: 0 | 1 | 2; hashtags: 'none' | 'few' | 'many'; length: 'short' | 'medium' | 'long'; cta: 'none' | 'soft' | 'follow' | 'visit'; banned: string[]; link: boolean; lang: string; model: string; temperature: number }
  export const STUDIO_MODES: StudioMode[];
  export const VOICES: Record<string, string>;
  export const LANGS: Record<string, string>;
  export const DEFAULT_SETTINGS: StudioSettings;
  export const STUDIO_N: Record<string, [number, number, number]>;
  export function sanitizeSettings(raw: unknown): StudioSettings;
  export function clampN(mode: string, n: unknown): number;
  export function numbersIn(t: string): string[];
  export function unsupportedNumbers(text: string, facts: string): string[];
  export function validateStudio(mode: StudioMode, raw: unknown, ctx?: { n?: number; live?: string; draft?: string; context?: string }): Record<string, unknown> | null;
}
