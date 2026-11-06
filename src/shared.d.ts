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
  export type ComposeKind = 'race' | 'balance' | 'au-seat' | 'promo' | 'stat' | 'flip' | 'quote' | 'message' | 'announcement' | 'thanks' | 'milestone' | 'question' | 'statement';
  export interface ComposeResult {
    subject: { kind: ComposeKind; id: string };
    designId: string;
    tweet: string;
    cardOverrides: { title?: string; subtitle?: string; footer?: string };
    altText: string;
    fixes: string[];
    post: 'data' | 'message';
    style: AiStyle;
    texts: AiTexts;
    flagged: string[];
  }
  export interface AiStyle {
    palette?: { bg?: string; fg?: string; accent?: string; dem?: string; rep?: string };
    fontDisplay?: string; fontBody?: string; cornerRadius?: number;
    texture?: 'none' | 'grain' | 'halftone' | 'grid' | 'scanlines' | 'paper'; textureOpacity?: number;
    logo?: 'design' | 'off' | 'tl' | 'tr' | 'bl' | 'br'; watermark?: string; border?: { width: number; color: string };
    stickers?: { preset: 'live' | 'flip' | 'breaking' | 'called' | 'custom'; text?: string; pos: 'tl' | 'tr' | 'bl' | 'br' | 'c' }[];
    align?: 'design' | 'left' | 'center' | 'right'; size?: { w: number; h: number };
  }
  export interface AiTexts { title?: string; subtitle?: string; footer?: string; cta?: string; quoteBy?: string; stats?: { label: string; value: string }[]; options?: string[]; quoted?: { text: string; label: string } }
  export const MESSAGE_KINDS: string[];
  export const STYLE_FONTS: string[];
  export const STYLE_SIZES: Record<string, [number, number]>;
  export const STYLE_PROMPT: string;
  export function fixInk(bg: string, fg: string): string;
  export function contrastRatio(a: string, b: string): number;
  export function validateStyle(raw: unknown): { style: AiStyle; fixes: string[] };
  export function validateTexts(raw: unknown, ctx?: { kind?: string; liveStats?: { label: string; value: string }[]; facts?: string }): { texts: AiTexts; fixes: string[]; flagged: string[] };
  export function validateCard(raw: unknown, ctx?: { kind?: string; liveStats?: { label: string; value: string }[]; facts?: string }): { style: AiStyle; texts: AiTexts; fixes: string[]; flagged: string[] };
  export type SocialPlatform = 'x' | 'instagram' | 'tiktok' | 'youtube' | 'facebook' | 'linkedin' | 'threads' | 'bluesky' | 'discord';
  export const SOCIAL_PLATFORMS: SocialPlatform[];
  export const SOCIAL_LIMITS: Record<SocialPlatform, { bio: number; name: number; handle: number }>;
  export interface SocialResult { bios: Partial<Record<SocialPlatform, string>>; names: string[]; handles: string[]; pinned: string; links: { label: string; path: string }[]; tagline: string; style: AiStyle; fixes: string[] }
  export function validateSocial(raw: unknown, platforms?: string[]): SocialResult;
  export const COMPOSE_KINDS: ComposeKind[];
  export const TWEET_MAX: number;
  export function parseComposeJson(text: string): Record<string, unknown> | null;
  export function cleanTweet(t: unknown): string;
  export function validateCompose(raw: unknown, designs?: { id: string; kinds?: string[] }[], opts?: { validId?: (kind: string, id: string) => boolean; post?: 'data' | 'message'; liveStats?: (kind: string, id: string) => { label: string; value: string }[] | undefined; facts?: string }): ComposeResult;
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
declare module '*/shared/social.js' {
  export interface Rect { x: number; y: number; w: number; h: number; label: string }
  export interface PackAsset { id: string; type: 'avatar' | 'banner' | 'highlight' | 'story' | 'post'; label: string; w: number; h: number; design: string; circle?: boolean; safe?: Rect[]; covers?: Rect[]; platform: string; file: string }
  export const SOCIAL_PACK: Record<string, { name: string; assets: Omit<PackAsset, 'platform' | 'file'>[] }>;
  export function packAssets(platforms: string[]): PackAsset[];
  export function packReadme(platforms: string[], copy?: { bios?: Record<string, string>; names?: string[]; handles?: string[]; pinned?: string; links?: { label: string; path: string }[] }, limits?: Record<string, { bio: number }>): string;
}
