/** Live AU feeds: /api/au/news, /api/au/markets, /api/au/results (AU-DATA server). */
import { useEffect, useState } from 'react';
import type { Market, NewsItem } from '../../types';

export interface SeatResult {
  counted: number;
  tcp?: { party: string; pct: number }[];
  leader?: string;
  called?: string;
}
export interface AuResults {
  status: 'pre-election' | 'counting' | 'final';
  updatedAt?: string | number;
  seats: Record<string, SeatResult>;
  source?: string;
}

type Feed<T> = { data: T | null; error: boolean; updated: number | null };

function usePoll<T>(url: string | null, everyMs: number, pick: (j: unknown) => T | null): Feed<T> {
  const [st, setSt] = useState<Feed<T>>({ data: null, error: false, updated: null });
  useEffect(() => {
    if (!url) return;
    let dead = false;
    let t: ReturnType<typeof setTimeout>;
    const run = async () => {
      try {
        const r = await fetch(url);
        if (!r.ok) throw new Error(String(r.status));
        const v = pick(await r.json());
        if (!dead) setSt({ data: v, error: v == null, updated: Date.now() });
      } catch {
        if (!dead) setSt((s) => ({ ...s, error: true }));
      }
      if (!dead) t = setTimeout(run, document.hidden ? everyMs * 3 : everyMs);
    };
    run();
    return () => {
      dead = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, everyMs]);
  return st;
}

export function useAuNews() {
  return usePoll<NewsItem[]>('/api/au/news', 120_000, (j) => {
    const items = (j as { items?: NewsItem[] })?.items;
    return Array.isArray(items) ? items : null;
  });
}

export function useAuMarkets() {
  return usePoll<Market[]>('/api/au/markets', 60_000, (j) => {
    const m = (j as { markets?: Market[] })?.markets;
    return Array.isArray(m) ? m : null;
  });
}

export function useAuResults(contest: string | null) {
  return usePoll<AuResults>(contest ? `/api/au/results?contest=${encodeURIComponent(contest)}` : null, 30_000, (j) => {
    const o = j as AuResults;
    return o && typeof o === 'object' && typeof o.status === 'string' ? { ...o, seats: o.seats ?? {} } : null;
  });
}

/** Simple keyword filter for related news */
export function relatedNews(items: NewsItem[] | null, words: string[]): NewsItem[] {
  if (!items) return [];
  const ws = words.filter((w) => w && w.length > 2).map((w) => w.toLowerCase());
  if (!ws.length) return [];
  return items.filter((n) => {
    const hay = (n.title + ' ' + (n.summary ?? '')).toLowerCase();
    return ws.some((w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(hay));
  });
}
