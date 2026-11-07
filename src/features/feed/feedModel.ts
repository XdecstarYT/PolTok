/** PolTok feed model: derives card stream from live data. Nothing here invents facts. */
import type { Market, PollSeries, RaceCallEvent, RaceResult } from '../../types';
import { STATES, raceById } from '../../data';
import { POLL_SERIES } from '../../data/polls';
import { clusterNews, developingScore, type Cluster } from '../news/newsUtils';
import type { LiveState } from '../../lib/live';

export type CardKind = 'story' | 'call' | 'close' | 'market' | 'poll' | 'fact';
export type Segment = 'foryou' | 'live' | 'news';

export const SEGMENT_KINDS: Record<Segment, CardKind[] | null> = {
  foryou: null,
  live: ['call', 'close', 'market', 'poll'],
  news: ['story'],
};

export const kindOf = (key: string): CardKind =>
  (({ s: 'story', c: 'call', x: 'close', m: 'market', p: 'poll', f: 'fact' }) as Record<string, CardKind>)[key[0]] ?? 'story';
export const idOf = (key: string) => key.slice(2);

export interface Pools {
  story: string[];
  call: string[];
  close: string[];
  market: string[];
  poll: string[];
  fact: string[];
  clusters: Map<string, Cluster>;
}

/** Vote share leader margin in pct points (0..100) for a result. */
export function leadMargin(r: RaceResult) {
  const v = Object.values(r.votes).sort((a, b) => b - a);
  const tot = v.reduce((a, b) => a + b, 0);
  if (!tot || v.length < 2) return 100;
  return ((v[0] - v[1]) / tot) * 100;
}

export function buildPools(live: LiveState): Pools {
  const clusters = clusterNews(live.news);
  const now = Date.now();
  const storyClusters = [...clusters].sort((a, b) => developingScore(b, now) - developingScore(a, now));
  const close = Object.values(live.results)
    .filter((r) => raceById.has(r.raceId) && !r.calledFor && (r.status === 'too-close' || (r.status === 'counting' && r.expectedPct >= 35 && leadMargin(r) < 4)))
    .sort((a, b) => leadMargin(a) - leadMargin(b))
    .slice(0, 10);
  const facts = [...STATES]
    .filter((s) => s.pres2024)
    .sort((a, b) => Math.abs(a.pres2024.dem - a.pres2024.rep) - Math.abs(b.pres2024.dem - b.pres2024.rep))
    .slice(0, 10);
  return {
    story: storyClusters.map((c) => `s:${c.id}`),
    call: live.calls.filter((c) => raceById.has(c.raceId)).map((c) => `c:${c.raceId}`),
    close: close.map((r) => `x:${r.raceId}`),
    market: live.markets.map((m) => `m:${m.id}`),
    poll: POLL_SERIES.filter((p) => p.polls.length > 0).map((p) => `p:${p.id}`),
    fact: facts.map((s) => `f:${s.abbr}`),
    clusters: new Map(clusters.map((c) => [c.id, c])),
  };
}

const PATTERN: (keyof Omit<Pools, 'clusters'>)[] = ['story', 'call', 'story', 'close', 'story', 'market', 'story', 'poll', 'call', 'story', 'fact', 'story', 'close'];

/** Initial interleave for "For You". */
export function mix(p: Pools, exclude: Set<string> = new Set()): string[] {
  const q = {
    story: p.story.filter((k) => !exclude.has(k)),
    call: p.call.filter((k) => !exclude.has(k)),
    close: p.close.filter((k) => !exclude.has(k)),
    market: p.market.filter((k) => !exclude.has(k)),
    poll: p.poll.filter((k) => !exclude.has(k)),
    fact: p.fact.filter((k) => !exclude.has(k)),
  };
  const out: string[] = [];
  let guard = 0;
  while (Object.values(q).some((a) => a.length) && guard++ < 5000) {
    for (const t of PATTERN) {
      const k = q[t].shift();
      if (k) out.push(k);
    }
  }
  return out;
}

export function lookupMarket(markets: Market[], id: string) {
  return markets.find((m) => m.id === id);
}
export function lookupPoll(id: string): PollSeries | undefined {
  return POLL_SERIES.find((p) => p.id === id);
}
export function lookupCall(calls: RaceCallEvent[], raceId: string) {
  return calls.find((c) => c.raceId === raceId);
}

/* ---------------- local persistence (reactions / saves) ---------------- */
const STORE = 'poltok.feed.v1';
export interface FeedStore {
  reactions: Record<string, string>;
  saved: string[];
  auto?: boolean;
}
export function loadStore(): FeedStore {
  try {
    const s = JSON.parse(localStorage.getItem(STORE) || '{}');
    return { reactions: s.reactions ?? {}, saved: Array.isArray(s.saved) ? s.saved : [], auto: !!s.auto };
  } catch {
    return { reactions: {}, saved: [] };
  }
}
export function saveStore(s: FeedStore) {
  try {
    localStorage.setItem(STORE, JSON.stringify(s));
  } catch {
    /* storage blocked */
  }
}
