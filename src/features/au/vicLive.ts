/** Live Victorian election dashboard feed: GET /api/vic/live (polls, uniform-swing projection, VEC early votes). */
import { useEffect, useState } from 'react';
import { pColor } from './model';

export type VicKey = 'ALP' | 'LNP' | 'GRN' | 'ONP';
export interface VicPoll { date: string; firm: string; t: number; ALP: number; LNP: number; GRN: number; ONP: number; tpp: { ALP: number; LNP: number } | null }
export interface VicSeatProj { name: string; win2022: string; vs: string; margin: number; projected: string }
export interface VicLive {
  updatedAt: string;
  method: string;
  sources: Record<string, string>;
  errors?: string[];
  polls?: {
    count: number;
    list: VicPoll[];
    newest: VicPoll & { alpLow: boolean };
    average: Record<VicKey, number>;
    averageOf: string[];
    tpp: { ALP: number; LNP: number; of: string[] } | null;
    trend: ({ t: number } & Record<VicKey, number>)[];
  };
  projection?: {
    swing: number;
    seats: Record<string, VicSeatProj>;
    before: Record<string, number>;
    after: Record<string, number>;
    edge: { id: string; name: string; margin: number; falls: boolean }[];
    majority: number;
    total: number;
  };
  model?: VicModel;
  earlyVotes?: { days: { day: string; date: number; early: number; postal: number }[]; total: number; updated: string | null };
}

export type Rating = 'safe' | 'likely' | 'leans' | 'tossup';
export interface VicModelSeat { prob: Record<string, number>; fav: string; primaries: Record<string, number>; finalTwo: [string, number][]; ind: { n: string; pct: number } | null; rating: Rating }
export interface VicModel {
  sims: number;
  now: Record<string, number>;
  seats: Record<string, VicModelSeat>;
  range: Record<string, { median: number; p10: number; p90: number; mean: number }>;
  hist: Record<string, Record<string, number>>;
  majority: { LNP: number; ALP: number; hung: number };
  flows: Record<string, Record<string, number>>;
  method: string;
}

export const VIC_KEYS: VicKey[] = ['LNP', 'ONP', 'ALP', 'GRN'];
export const VIC_NAME: Record<string, string> = { ALP: 'Labor', LNP: 'Coalition', GRN: 'Greens', ONP: 'One Nation', IND: 'Independent', OTH: 'Other' };
/** Site party colours (Coalition uses the Liberal colour). */
export const vicColor = (k: string) => (k === 'OTH' ? '#8a8f99' : pColor(k === 'LNP' ? 'LIB' : k));

let shared: { at: number; p: Promise<VicLive> } | null = null;
function load(force = false): Promise<VicLive> {
  if (!force && shared && Date.now() - shared.at < 5 * 60 * 1000) return shared.p;
  const p = fetch('/api/vic/live').then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<VicLive>; });
  shared = { at: Date.now(), p };
  p.catch(() => { shared = null; });
  return p;
}

/** One shared request across components; refreshes every 5 minutes while the page is open. */
export function useVicLive() {
  const [st, setSt] = useState<{ data: VicLive | null; error: boolean; loading: boolean }>({ data: null, error: false, loading: true });
  useEffect(() => {
    let dead = false;
    let timer: ReturnType<typeof setTimeout>;
    const run = (force: boolean) => {
      load(force).then((d) => { if (!dead) setSt({ data: d, error: false, loading: false }); })
        .catch(() => { if (!dead) setSt((s) => ({ ...s, error: true, loading: false })); })
        .finally(() => { if (!dead) timer = setTimeout(() => run(true), 5 * 60 * 1000); });
    };
    run(false);
    return () => { dead = true; clearTimeout(timer); };
  }, []);
  return st;
}

export const fmtK = (n: number) => (n >= 1e6 ? (n / 1e6).toFixed(2) + 'm' : n >= 1e3 ? Math.round(n / 1e3) + 'k' : String(n));
