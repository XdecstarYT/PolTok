/** News 2.0 helpers (agent F): API hooks, related-entity detection, AI summary. Real data only. */
import { useEffect, useState } from 'react';
import type { Lean, NewsItem } from '../../types';
import { RACES, stateByAbbr } from '../../data';
import { FEDERAL, VICTORIA } from '../../data/au';
import { askAi } from '../../lib/ai';
import { cleanText, type Coverage, type Side } from './newsUtils';

export interface StoryRes { ok: true; id: string; region: 'us' | 'au'; items: NewsItem[]; coverage: Coverage; blindspot: Side | null; tags: string[]; fetchedAt: number }
export interface TopCluster { id: string; lead: NewsItem; sources: number; latest: number; coverage: Coverage }
export interface TopicRef { slug: string; label: string; region: 'us' | 'au' | 'both' }
export interface TopicRes { ok: true; slug: string; label: string; region: TopicRef['region']; items: NewsItem[]; total: number; coverage: Coverage; top: TopCluster[]; volume48h: number[]; topics: TopicRef[]; fetchedAt: number }
export interface SourceRes { ok: true; name: string; lean: Lean; region: 'us' | 'au'; items: NewsItem[]; total: number; share48h: number; recent48h: number; volume48h: number[]; topics: { slug: string; label: string; n: number }[]; fetchedAt: number }

export const TOPIC_LIST: TopicRef[] = [
  { slug: 'senate', label: 'Senate', region: 'us' },
  { slug: 'house', label: 'House', region: 'us' },
  { slug: 'governors', label: 'Governors', region: 'us' },
  { slug: 'abortion', label: 'Abortion', region: 'both' },
  { slug: 'economy', label: 'Economy', region: 'both' },
  { slug: 'immigration', label: 'Immigration', region: 'both' },
  { slug: 'climate', label: 'Climate', region: 'both' },
  { slug: 'trump', label: 'Trump', region: 'us' },
  { slug: 'victoria-election', label: 'Victorian election', region: 'au' },
  { slug: 'one-nation', label: 'One Nation', region: 'au' },
  { slug: 'albanese', label: 'Albanese', region: 'au' },
];

/** App pages related to each topic hub. */
export const TOPIC_PAGES: Record<string, { to: string; label: string }[]> = {
  senate: [{ to: '/races', label: 'All races' }, { to: '/live', label: 'Live results' }],
  house: [{ to: '/house', label: 'House dashboard' }, { to: '/flips', label: 'Flips' }],
  governors: [{ to: '/governors', label: 'Governors' }],
  abortion: [{ to: '/measures', label: 'Ballot measures' }],
  economy: [{ to: '/polls', label: 'Polls' }, { to: '/money', label: 'Campaign money' }],
  immigration: [{ to: '/parliament', label: 'Parliament bills' }],
  climate: [{ to: '/parliament', label: 'Parliament bills' }],
  trump: [{ to: '/polls', label: 'Approval & polls' }, { to: '/2028', label: '2028' }],
  'victoria-election': [{ to: '/au/victoria', label: 'Victoria 2026' }, { to: '/au', label: 'Australia hub' }],
  'one-nation': [{ to: '/au', label: 'Australia hub' }, { to: '/au/swingometer', label: 'Swing calculator' }],
  albanese: [{ to: '/au', label: 'Australia hub' }, { to: '/parliament?tab=au', label: 'AU bills' }],
};

export const storyHref = (n: Pick<NewsItem, 'id' | 'clusterId'>) => `/story/${encodeURIComponent(n.clusterId || 'c_' + n.id)}`;
export const sourceHref = (name: string) => `/source/${encodeURIComponent(name)}`;

type Fetched<T> = { data: T | null; error: string | null; loading: boolean };
export function useNewsApi<T>(path: string, refreshMs = 120_000): Fetched<T> {
  const [st, setSt] = useState<Fetched<T>>({ data: null, error: null, loading: true });
  useEffect(() => {
    let alive = true;
    setSt({ data: null, error: null, loading: true });
    const load = async () => {
      try {
        const r = await fetch(path);
        const d = await r.json().catch(() => ({}));
        if (!alive) return;
        if (!r.ok) setSt((s) => ({ data: s.data, error: d?.error || `HTTP ${r.status}`, loading: false }));
        else setSt({ data: d as T, error: null, loading: false });
      } catch {
        if (alive) setSt((s) => ({ data: s.data, error: 'Network error', loading: false }));
      }
    };
    load();
    const t = setInterval(load, refreshMs);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [path, refreshMs]);
  return st;
}

export interface Related { races: { to: string; label: string }[]; seats: { to: string; label: string }[]; candidates: { to: string; label: string }[]; states: { to: string; label: string }[] }

const lastName = (n: string) => n.replace(/,?\s+(Jr\.?|Sr\.?|III|II|IV)$/i, '').trim().split(/\s+/).pop() || n;
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Detect related races / seats / candidates from tags and real headline text. */
export function detectRelated(items: NewsItem[], tags: string[], region: 'us' | 'au'): Related {
  const text = items.map((i) => `${cleanText(i.title)} ${cleanText(i.summary)}`).join(' \n ');
  const low = tags.map((t) => t.toLowerCase());
  const out: Related = { races: [], seats: [], candidates: [], states: [] };
  if (region === 'us') {
    const states = tags.map((t) => t.toUpperCase()).filter((t) => t.length === 2 && stateByAbbr.has(t));
    for (const s of states) out.states.push({ to: `/state/${s}`, label: stateByAbbr.get(s)!.name });
    const seenRace = new Set<string>();
    for (const r of RACES) {
      if (r.chamber === 'house') continue;
      const inState = states.includes(r.state);
      const chamberHit = (r.chamber === 'senate' && low.includes('senate')) || (r.chamber === 'governor' && low.includes('governor'));
      const candHits = r.candidates.filter((c) => {
        const ln = lastName(c.name);
        return ln.length > 3 && new RegExp(`\\b${esc(c.name)}\\b|\\b${esc(ln)}\\b`).test(text) && (inState || new RegExp(`\\b${esc(c.name)}\\b`).test(text));
      });
      for (const c of candHits) if (out.candidates.length < 8) out.candidates.push({ to: `/candidate/${c.id}`, label: `${c.name} (${c.party})` });
      if ((inState && chamberHit) || candHits.length) {
        if (!seenRace.has(r.id)) {
          seenRace.add(r.id);
          out.races.push({ to: `/race/${r.id}`, label: r.title });
        }
      }
    }
  } else {
    const seats = [...(VICTORIA.seats ?? []), ...(FEDERAL.seats ?? [])];
    const seen = new Set<string>();
    for (const s of seats) {
      if (s.name.length < 4 || seen.has(s.id)) continue;
      // require the seat name with an electorate word nearby, or the sitting member's full name
      const nameRe = new RegExp(`\\b${esc(s.name)}\\b`);
      const memberHit = s.member && s.member.split(' ').length > 1 && new RegExp(`\\b${esc(s.member)}\\b`).test(text);
      const seatHit = nameRe.test(text) && new RegExp(`\\b(seat|electorate|division|district|by-election|MP|member for)\\b`, 'i').test(text);
      if (memberHit || seatHit) {
        seen.add(s.id);
        out.seats.push({ to: `/au/seat/${s.id}`, label: `${s.name} (${s.chamber === 'vic' ? 'Vic' : 'Fed'})${memberHit ? ` · ${s.member}` : ''}` });
      }
      if (out.seats.length >= 10) break;
    }
  }
  out.races = out.races.slice(0, 8);
  return out;
}

/** Neutral AI summary grounded ONLY in the supplied headlines/summaries (existing /api/ai, mode 'chat'). */
export async function neutralSummary(items: NewsItem[], onDelta: (s: string) => void, signal?: AbortSignal) {
  let budget = 6000;
  const headlines: { outlet: string; lean: string; headline: string; summary?: string }[] = [];
  for (const i of items) {
    const h = { outlet: i.source, lean: i.sourceLean, headline: cleanText(i.title), summary: cleanText(i.summary).slice(0, 240) || undefined };
    const len = JSON.stringify(h).length;
    if (len > budget) break;
    budget -= len;
    headlines.push(h);
  }
  return askAi(
    {
      question:
        'Write a neutral 3-4 sentence summary of this news story using ONLY the headlines and summaries in SCREEN CONTEXT. Do not add facts, numbers or quotes that are not in them. Note briefly if Left- and Right-leaning outlets frame it differently. Cite outlets in [brackets]. No cards.',
      context: { task: 'story-summary', headlines },
      mode: 'chat',
      signal,
    },
    onDelta,
  );
}

/** Tiny inline sparkline path. */
export function sparkPath(vals: number[], w: number, h: number) {
  const max = Math.max(1, ...vals);
  const step = vals.length > 1 ? w / (vals.length - 1) : w;
  return vals.map((v, i) => `${i ? 'L' : 'M'}${(i * step).toFixed(1)},${(h - (v / max) * (h - 2) - 1).toFixed(1)}`).join(' ');
}
