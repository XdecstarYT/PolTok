// Types for shared/director.js (AI Creative Director).
declare module '*/shared/director.js' {
  import type { AiStyle, AiTexts, ComposeResult } from 'poltok/shared/compose.js';
  export type DirectorTask = 'concepts' | 'critique' | 'campaign' | 'adapt' | 'hooks2';
  export type AdaptPlatform = 'x' | 'threads' | 'bluesky' | 'linkedin' | 'instagram' | 'tiktok';
  export type PostType = 'data' | 'message' | 'thread' | 'poll' | 'countdown';
  export interface BrandKit { name: string; voice: string; palette: string[]; fonts: string[]; logo: 'design' | 'off' | 'tl' | 'tr' | 'bl' | 'br'; dos: string[]; donts: string[]; hashtags: string[]; cta: string }
  export interface Pref { note: string; at: number }
  export interface Concept extends ComposeResult { angle: string; hook: string; family: string; paletteMood: string; typography: string; layout: string; refined?: string[] }
  export interface Metrics { contrast: { fgBg: number; accentBg: number }; len: { title: number; subtitle: number; tweet: number; alt: number }; font: string; unsupported: string[] }
  export interface Fix { target: string; value: string; why: string }
  export interface Critique { i: number; scores: Record<'hierarchy' | 'readability' | 'clarity' | 'brand' | 'factual', number>; total: number; notes: string; fixes: Fix[]; metrics: Metrics }
  export interface CampaignPost { date: string; time: string; type: PostType; tweet: string; options: string[]; concept: ComposeResult; altText: string; notes: string; fixes: string[]; at?: number }
  export interface Campaign { name: string; summary: string; posts: CampaignPost[] }
  export interface Hook { text: string; technique: string; score: number; why: string }
  export const DIRECTOR_TASKS: DirectorTask[];
  export const ADAPT_PLATFORMS: AdaptPlatform[];
  export const PLATFORM_LIMITS: Record<AdaptPlatform, number>;
  export const POST_TYPES: PostType[];
  export const LOGO_PLACEMENTS: BrandKit['logo'][];
  export const DEFAULT_BRAND: BrandKit;
  export function sanitizeBrand(raw: unknown): BrandKit;
  export function brandPrompt(b: unknown, prefs?: unknown[]): string;
  export function brandStyle(b: unknown): AiStyle;
  export function editDelta(before: string, after: string): string[];
  export function mergePrefs(prefs: Pref[], notes: string[], now?: number): Pref[];
  export function newsTerms(facts: string, max?: number): { term: string; tag: string; count: number }[];
  export function groundedTags(tags: unknown, facts: string, brandTags?: string[]): string[];
  export function conceptMetrics(c: unknown, facts?: string): Metrics;
  export function applyFixes<T extends { texts: AiTexts; style: AiStyle; tweet: string; altText: string }>(c: T, fixes: Fix[], facts?: string): T & { refined: string[] };
  export function campaignCsv(posts: CampaignPost[], tz?: string): string;
  export function campaignIcs(posts: CampaignPost[], name?: string, stamp?: number): string;
  export function campaignFile(p: CampaignPost, i: number): string;
}
