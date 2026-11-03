/**
 * News helpers shared by the News hub and the PolTok feed (both owned by agent 8).
 * Everything here is derived from real NewsItem data — nothing is invented.
 */
import { useEffect, useState } from 'react';
import type { Lean, NewsItem } from '../../types';
import { LEAN_HEX } from '../../lib/format';
import { stateByAbbr } from '../../data';

export type Side = 'L' | 'C' | 'R' | 'U';

export const SIDE_OF: Record<Lean, Side> = {
  Left: 'L',
  'Lean Left': 'L',
  Center: 'C',
  'Lean Right': 'R',
  Right: 'R',
  Unrated: 'U',
};

export const SIDE_LABEL: Record<Side, string> = { L: 'Left', C: 'Center', R: 'Right', U: 'Unrated' };
export const SIDE_HEX: Record<Side, string> = {
  L: LEAN_HEX.Left,
  C: LEAN_HEX.Center,
  R: LEAN_HEX.Right,
  U: LEAN_HEX.Unrated,
};

export const leanHex = (l: Lean) => LEAN_HEX[l] ?? LEAN_HEX.Unrated;

export interface Coverage {
  L: number;
  C: number;
  R: number;
  U: number;
  total: number;
}

export interface Cluster {
  id: string;
  items: NewsItem[]; // newest first, one per source preferred
  lead: NewsItem;
  sources: string[];
  coverage: Coverage;
  latest: number;
  earliest: number;
  breaking: boolean;
  tags: string[];
  image?: string;
  blindspot: Side | null; // side that is MISSING coverage
}

export function coverageOf(items: NewsItem[]): Coverage {
  const c: Coverage = { L: 0, C: 0, R: 0, U: 0, total: 0 };
  const seen = new Set<string>();
  for (const it of items) {
    // count each outlet once per story
    if (seen.has(it.source)) continue;
    seen.add(it.source);
    c[SIDE_OF[it.sourceLean] ?? 'U']++;
    c.total++;
  }
  return c;
}

/** Ground-News-style blindspot: ≥3 rated outlets and >75% from one side → the other side is blind. */
export function blindspotOf(c: Coverage): Side | null {
  const rated = c.L + c.C + c.R;
  if (rated < 3) return null;
  if (c.L / rated > 0.75) return 'R';
  if (c.R / rated > 0.75) return 'L';
  return null;
}

export function clusterNews(news: NewsItem[]): Cluster[] {
  const map = new Map<string, NewsItem[]>();
  for (const n of news) {
    const k = n.clusterId || n.id;
    const arr = map.get(k);
    if (arr) arr.push(n);
    else map.set(k, [n]);
  }
  const out: Cluster[] = [];
  for (const [id, raw] of map) {
    const items = [...raw].sort((a, b) => b.publishedAt - a.publishedAt);
    const coverage = coverageOf(items);
    const sources = [...new Set(items.map((i) => i.source))];
    const withImg = items.find((i) => i.image);
    // Lead = earliest breaking or the most recent item that has an image, else most recent.
    const lead = items.find((i) => i.breaking) ?? withImg ?? items[0];
    const tags = [...new Set(items.flatMap((i) => i.tags ?? []))];
    out.push({
      id,
      items,
      lead,
      sources,
      coverage,
      latest: items[0].publishedAt,
      earliest: items[items.length - 1].publishedAt,
      breaking: items.some((i) => i.breaking),
      tags,
      image: withImg?.image,
      blindspot: blindspotOf(coverage),
    });
  }
  return out;
}

/** Score for "Developing": more outlets + fresher + breaking. */
export function developingScore(c: Cluster, now = Date.now()) {
  const ageH = Math.max(0, (now - c.latest) / 3.6e6);
  return c.sources.length * 3 + (c.breaking ? 6 : 0) - ageH * 0.8;
}

const entityCache = new Map<string, string>();
/** Strip HTML + decode entities safely (DOMParser never executes scripts). */
export function cleanText(s?: string): string {
  if (!s) return '';
  const hit = entityCache.get(s);
  if (hit !== undefined) return hit;
  let out = s;
  try {
    if (typeof DOMParser !== 'undefined') {
      out = new DOMParser().parseFromString(s, 'text/html').body.textContent ?? '';
    } else {
      out = s.replace(/<[^>]*>/g, ' ');
    }
  } catch {
    out = s.replace(/<[^>]*>/g, ' ');
  }
  out = out.replace(/\s+/g, ' ').trim();
  if (entityCache.size > 2000) entityCache.clear();
  entityCache.set(s, out);
  return out;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();

/**
 * First sentence of the publisher's own summary — used as the "Why it matters" line.
 * Returns null if there's no usable summary (we never write our own).
 */
export function firstSentence(item: NewsItem, max = 220): string | null {
  const text = cleanText(item.summary);
  if (text.length < 25) return null;
  const title = norm(cleanText(item.title));
  const m = text.match(/^(.{20,}?[.!?])(\s|$)/);
  let s = (m ? m[1] : text).trim();
  if (s.length > max) s = s.slice(0, max).replace(/\s+\S*$/, '') + '…';
  if (norm(s) === title || title.startsWith(norm(s))) return null;
  return s;
}

export const readTime = (item: NewsItem) => {
  const words = (cleanText(item.title) + ' ' + cleanText(item.summary)).split(' ').length;
  return Math.max(10, Math.round((words / 230) * 60 / 5) * 5);
};

export type TopicKey = 'senate' | 'house' | 'governor' | 'polls';
export const TOPICS: { key: TopicKey; label: string }[] = [
  { key: 'senate', label: 'Senate' },
  { key: 'house', label: 'House' },
  { key: 'governor', label: 'Governor' },
  { key: 'polls', label: 'Polls' },
];

const TOPIC_RX: Record<TopicKey, RegExp> = {
  senate: /\bsenat(e|or|ors)\b/i,
  house: /\b(house|congressional district|congressman|congresswoman)\b/i,
  governor: /\b(governor|gubernatorial|gov\.)\b/i,
  polls: /\b(poll|polls|polling|survey|exit poll)\b/i,
};

export function hasTopic(item: NewsItem, t: TopicKey) {
  if (item.tags?.some((x) => x.toLowerCase() === t)) return true;
  // fall back to the real headline text when the server didn't tag it
  return TOPIC_RX[t].test(item.title);
}

/** State abbreviations found in tags. */
export function statesOf(item: NewsItem): string[] {
  const out: string[] = [];
  for (const t of item.tags ?? []) {
    const u = t.toUpperCase();
    if (u.length === 2 && stateByAbbr.has(u)) out.push(u);
  }
  return out;
}

/** Topic label used as a kicker chip. */
export function kickerOf(tags: string[]): string | null {
  const low = tags.map((t) => t.toLowerCase());
  const topic = TOPICS.find((t) => low.includes(t.key))?.label;
  const st = tags.map((t) => t.toUpperCase()).find((t) => t.length === 2 && stateByAbbr.has(t));
  if (topic && st) return `${topic} · ${st}`;
  return topic ?? st ?? null;
}

/** Round-robin interleave Left / Center / Right (Unrated joins Center). */
export function balanceInterleave(items: NewsItem[]): NewsItem[] {
  const b: Record<'L' | 'C' | 'R', NewsItem[]> = { L: [], C: [], R: [] };
  for (const i of items) {
    const s = SIDE_OF[i.sourceLean] ?? 'U';
    b[s === 'U' ? 'C' : s].push(i);
  }
  const out: NewsItem[] = [];
  const order: ('L' | 'C' | 'R')[] = ['L', 'C', 'R'];
  let idx = 0;
  while (out.length < items.length) {
    let added = false;
    for (const k of order) {
      if (b[k][idx]) {
        out.push(b[k][idx]);
        added = true;
      }
    }
    if (!added) break;
    idx++;
  }
  return out;
}

/** Re-render every `ms` so relative timestamps stay fresh. */
export function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/** Deterministic hash for generated art. */
export function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const safeHost = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

/** Only allow http(s) links out. */
export const safeUrl = (url: string) => (/^https?:\/\//i.test(url) ? url : undefined);
