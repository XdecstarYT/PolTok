// Real Australian prediction-market odds from Polymarket's public Gamma API (no key, CORS *),
// so this works server-side (server/au.js) and straight from the browser as a fallback.
// Produces Market[] (src/types.ts). Browser-safe, dependency-free. Never fabricates: a market
// whose event can't be fetched is simply omitted.

const GAMMA = 'https://gamma-api.polymarket.com/events?slug=';

const COLORS = {
  labor: '#e53940', 'liberal–national': '#1c4f9c', 'liberal-national': '#1c4f9c', coalition: '#1c4f9c', liberal: '#1c4f9c',
  greens: '#10a35a', 'one nation': '#f36c21', nationals: '#2c7d3f', independent: '#2bb3a8',
  'anthony albanese': '#e53940', 'ben carroll': '#e53940', 'chris minns': '#e53940',
  'angus taylor': '#1c4f9c', 'jess wilson': '#1c4f9c', 'kellie sloane': '#1c4f9c',
  'pauline hanson': '#f36c21', "danny o'brien": '#2c7d3f', 'ellen sandell': '#10a35a', 'larissa waters': '#10a35a',
};

/** Curated AU markets: id, Polymarket event slug, question, kind. */
export const AU_MARKET_SLUGS = [
  { id: 'au:vic-winner', slug: 'victoria-parliamentary-election-winner', question: 'Who will win the 2026 Victorian election?' },
  { id: 'au:vic-premier', slug: 'next-premier-of-victoria', question: 'Next Premier of Victoria?' },
  { id: 'au:vic-lc', slug: 'victoria-legislative-council-election-winner-20261008161713819', question: 'Victorian Legislative Council winner?' },
  { id: 'au:nsw-winner', slug: 'new-south-wales-parliamentary-election-winner', question: 'Who will win the 2027 NSW election?' },
  { id: 'au:nsw-premier', slug: 'next-premier-of-new-south-wales', question: 'Next Premier of New South Wales?' },
  { id: 'au:pm-next', slug: 'who-will-be-the-next-prime-minister-of-australia-after-the-next-election-20260610170604224', question: 'Prime Minister after the next federal election?' },
  { id: 'au:albanese-out', slug: 'anthony-albanese-out-as-prime-minister-of-australia-by', question: 'Anthony Albanese out as PM by…?', dated: true },
];

function yesPrice(m) {
  try {
    const v = Number(JSON.parse(m.outcomePrices || '[]')[0]);
    return Number.isFinite(v) ? v : undefined;
  } catch {
    return undefined;
  }
}

/** Convert a Gamma event into a Market (multi-outcome; top 4 by prob, normalised). */
export function eventToMarket(ev, def) {
  const live = (ev.markets || []).filter((m) => m.active && !m.closed && yesPrice(m) != null);
  if (!live.length) return null;
  let outcomes;
  if (def.dated || live.length === 1) {
    // Date-bucket / binary markets: report the earliest open bucket as Yes/No (not normalised across buckets).
    const m = live[0];
    const p = yesPrice(m);
    const label = m.groupItemTitle ? `Yes (by ${m.groupItemTitle})` : 'Yes';
    outcomes = [{ label, prob: p, color: '#f36c21' }, { label: 'No', prob: 1 - p, color: '#8b93a7' }];
  } else {
    outcomes = live
      .filter((m) => m.groupItemTitle)
      .map((m) => ({ label: m.groupItemTitle.trim(), prob: yesPrice(m), color: COLORS[m.groupItemTitle.trim().toLowerCase()] || '#8b93a7' }))
      .sort((a, b) => b.prob - a.prob)
      .slice(0, 4);
    const sum = outcomes.reduce((a, o) => a + o.prob, 0) || 1;
    outcomes.forEach((o) => (o.prob = o.prob / sum));
  }
  return {
    id: def.id,
    question: def.question,
    source: 'Polymarket',
    url: `https://polymarket.com/event/${def.slug}`,
    volume: Number(ev.volume) || undefined,
    outcomes,
  };
}

/** One-shot fetch of all curated AU markets. @returns {Promise<import('../../src/types').Market[]>} */
export async function fetchAuMarkets(fetchImpl = (...a) => fetch(...a)) {
  const settled = await Promise.allSettled(
    AU_MARKET_SLUGS.map(async (def) => {
      const res = await fetchImpl(GAMMA + encodeURIComponent(def.slug), { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      const ev = Array.isArray(d) ? d[0] : undefined;
      return ev ? eventToMarket(ev, def) : null;
    }),
  );
  return settled.filter((s) => s.status === 'fulfilled' && s.value).map((s) => s.value);
}

/** Polling feed. @param {{ fetchImpl?: typeof fetch; pollMs?: number; onMarkets?: (m:any[])=>void; log?: (s:string)=>void }} opts */
export function createAuMarketsFeed(opts = {}) {
  const pollMs = opts.pollMs || 60000;
  let markets = [];
  let timer = null;
  let updatedAt = 0;
  async function poll() {
    try {
      const m = await fetchAuMarkets(opts.fetchImpl);
      if (m.length) {
        markets = m;
        updatedAt = Date.now();
        opts.onMarkets?.(markets);
      } else opts.log?.('[au-markets] no markets fetched');
    } catch (e) {
      opts.log?.(`[au-markets] ${e.message}`);
    }
  }
  return {
    start() {
      if (timer) return;
      const p = poll();
      timer = setInterval(poll, pollMs);
      return p;
    },
    stop() {
      clearInterval(timer);
      timer = null;
    },
    refresh: poll,
    snapshot: () => markets,
    updatedAt: () => updatedAt,
  };
}
