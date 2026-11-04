// Real prediction-market odds from Polymarket's public API (no key; CORS-enabled, so it also works
// straight from the browser). Produces `Market[]` (src/types.ts) for:
//   - House control, Senate control (with 1-week hourly price history)
//   - every 2026 Senate race market (`raceId` = our race id, e.g. "GA-SEN")
// Browser-safe, dependency-free.

const GAMMA = 'https://gamma-api.polymarket.com/events?slug=';
const CLOB_HISTORY = 'https://clob.polymarket.com/prices-history';

const STATE_SLUG = {
  AL: 'alabama', AK: 'alaska', AR: 'arkansas', CO: 'colorado', DE: 'delaware', FL: 'florida', GA: 'georgia', ID: 'idaho',
  IL: 'illinois', IA: 'iowa', KS: 'kansas', KY: 'kentucky', LA: 'louisiana', ME: 'maine', MA: 'massachusetts', MI: 'michigan',
  MN: 'minnesota', MS: 'mississippi', MT: 'montana', NE: 'nebraska', NH: 'new-hampshire', NJ: 'new-jersey', NM: 'new-mexico',
  NC: 'north-carolina', OH: 'ohio', OK: 'oklahoma', OR: 'oregon', RI: 'rhode-island', SC: 'south-carolina', SD: 'south-dakota',
  TN: 'tennessee', TX: 'texas', VA: 'virginia', WV: 'west-virginia', WY: 'wyoming',
};

const PARTY_COLOR = { D: '#3d7bff', R: '#ff3d55', I: '#a96bff' };

function partyOf(label) {
  const m = /\((D|R|I)\)\s*$/.exec(label || '') || /^(Democratic|Republican)/.exec(label || '');
  if (!m) return undefined;
  return m[1] === 'Democratic' ? 'D' : m[1] === 'Republican' ? 'R' : m[1];
}

function yesPrice(m) {
  try {
    const p = JSON.parse(m.outcomePrices || '[]');
    const v = Number(p[0]);
    return Number.isFinite(v) ? v : undefined;
  } catch {
    return undefined;
  }
}

function tokenOf(m) {
  try {
    return JSON.parse(m.clobTokenIds || '[]')[0];
  } catch {
    return undefined;
  }
}

/**
 * @param {{ races?: import('../src/types').Race[]; fetchImpl?: typeof fetch; pollMs?: number;
 *   onMarkets?: (m: import('../src/types').Market[]) => void; log?: (s: string) => void }} opts
 */
export function createMarketsFeed(opts = {}) {
  const fetchImpl = opts.fetchImpl || ((...a) => fetch(...a));
  const pollMs = opts.pollMs || 60000;
  const log = opts.log || (() => {});
  const senateRaces = (opts.races || []).filter((r) => r.chamber === 'senate');
  /** @type {Map<string, any>} */
  const markets = new Map();
  const history = new Map(); // token -> [{t,p}]
  let timer = null;
  let historyAt = 0;

  async function getEvent(slug) {
    const res = await fetchImpl(GAMMA + encodeURIComponent(slug), { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json();
    return Array.isArray(d) ? d[0] : undefined;
  }

  async function getHistory(token) {
    const res = await fetchImpl(`${CLOB_HISTORY}?market=${token}&interval=1w&fidelity=60`, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json();
    return (d.history || []).map((h) => ({ t: h.t * 1000, p: h.p }));
  }

  async function controlMarket(id, slug, question) {
    const ev = await getEvent(slug);
    if (!ev) return;
    const live = (ev.markets || []).filter((m) => m.active && yesPrice(m) != null);
    const dem = live.find((m) => /democrat/i.test(m.groupItemTitle || ''));
    const rep = live.find((m) => /republican/i.test(m.groupItemTitle || ''));
    if (!dem && !rep) return;
    const pD = dem ? yesPrice(dem) : 1 - yesPrice(rep);
    const pR = rep ? yesPrice(rep) : 1 - pD;
    const sum = pD + pR || 1;
    const token = dem ? tokenOf(dem) : undefined;
    markets.set(id, {
      id,
      question,
      source: 'Polymarket',
      url: `https://polymarket.com/event/${slug}`,
      volume: Number(ev.volume) || undefined,
      outcomes: [
        { label: 'Democrats', prob: pD / sum, color: PARTY_COLOR.D },
        { label: 'Republicans', prob: pR / sum, color: PARTY_COLOR.R },
      ],
      token,
      history: history.get(token),
    });
  }

  async function raceMarket(race) {
    const st = STATE_SLUG[race.state];
    if (!st) return;
    const slug = race.special ? `${st}-senate-special-election-winner` : `${st}-senate-election-winner`;
    let ev;
    try {
      ev = await getEvent(slug);
    } catch {
      return;
    }
    if (!ev) return;
    const live = (ev.markets || []).filter((m) => m.active && !m.closed && yesPrice(m) != null && m.groupItemTitle);
    if (!live.length) return;
    const outcomes = live
      .map((m) => {
        const party = partyOf(m.groupItemTitle);
        return { label: m.groupItemTitle.trim(), prob: yesPrice(m), color: PARTY_COLOR[party] || '#8b93a7' };
      })
      .sort((a, b) => b.prob - a.prob)
      .slice(0, 3);
    const sum = outcomes.reduce((a, o) => a + o.prob, 0) || 1;
    outcomes.forEach((o) => (o.prob = o.prob / sum));
    markets.set(`race:${race.id}`, {
      id: `race:${race.id}`,
      raceId: race.id,
      question: `Who will win the ${race.title}?`,
      source: 'Polymarket',
      url: `https://polymarket.com/event/${slug}`,
      volume: Number(ev.volume) || undefined,
      outcomes,
    });
  }

  async function poll() {
    const jobs = [
      controlMarket('house-control', 'which-party-will-win-the-house-in-2026', 'Which party will win the House?'),
      controlMarket('senate-control', 'which-party-will-win-the-senate-in-2026', 'Which party will win the Senate?'),
      ...senateRaces.map(raceMarket),
    ];
    const settled = await Promise.allSettled(jobs);
    const failed = settled.filter((s) => s.status === 'rejected').length;
    if (failed) log(`[markets] ${failed} Polymarket requests failed`);
    // Price history for the two control markets, refreshed every 10 minutes.
    if (Date.now() - historyAt > 10 * 60000) {
      historyAt = Date.now();
      for (const id of ['house-control', 'senate-control']) {
        const m = markets.get(id);
        if (!m?.token) continue;
        try {
          const h = await getHistory(m.token);
          history.set(m.token, h);
          m.history = h;
        } catch {
          /* keep previous */
        }
      }
    }
    const list = snapshot();
    if (list.length) opts.onMarkets?.(list);
  }

  function snapshot() {
    const order = ['house-control', 'senate-control'];
    return [...markets.values()]
      .sort((a, b) => (order.indexOf(a.id) + 1 || 99) - (order.indexOf(b.id) + 1 || 99) || (b.volume || 0) - (a.volume || 0))
      .map(({ token, ...m }) => m);
  }

  return {
    start() {
      if (timer) return;
      poll();
      timer = setInterval(poll, pollMs);
    },
    stop() {
      clearInterval(timer);
      timer = null;
    },
    snapshot,
  };
}
