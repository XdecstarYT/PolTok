// 2028 presidential race — live Polymarket markets (public gamma + clob APIs, no key).
//   GET /api/pres2028  { markets: Pres2028Market[], fetchedAt, source }
// Cached 2 min (history 10 min). Never fabricates: failed markets are omitted, error surfaced.
const GAMMA = 'https://gamma-api.polymarket.com/events?slug=';
const CLOB = 'https://clob.polymarket.com/prices-history';

export const PRES2028_EVENTS = [
  { id: 'party', slug: 'which-party-wins-2028-us-presidential-election', title: 'Which party wins the White House?' },
  { id: 'winner', slug: 'presidential-election-winner-2028', title: 'Presidential election winner' },
  { id: 'dem', slug: 'democratic-presidential-nominee-2028', title: 'Democratic nominee' },
  { id: 'gop', slug: 'republican-presidential-nominee-2028', title: 'Republican nominee' },
];

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : undefined);
const parse = (s, i) => { try { return JSON.parse(s || '[]')[i]; } catch { return undefined; } };

async function getJson(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(10000), headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function history(token) {
  if (!token) return undefined;
  try {
    const d = await getJson(`${CLOB}?market=${token}&interval=1w&fidelity=60`);
    return (d.history || []).map((h) => ({ t: h.t * 1000, p: h.p }));
  } catch { return undefined; }
}

async function loadEvent(def, topN, withHistory) {
  const arr = await getJson(GAMMA + encodeURIComponent(def.slug));
  const ev = Array.isArray(arr) ? arr[0] : undefined;
  if (!ev) throw new Error('event not found');
  const outs = (ev.markets || [])
    .filter((m) => m.active && !m.closed && m.groupItemTitle && num(parse(m.outcomePrices, 0)) != null)
    .map((m) => ({
      label: String(m.groupItemTitle).trim(),
      prob: num(parse(m.outcomePrices, 0)),
      change1w: num(m.oneWeekPriceChange),
      volume: num(m.volume),
      token: parse(m.clobTokenIds, 0),
    }))
    .sort((a, b) => b.prob - a.prob)
    .slice(0, topN);
  if (withHistory) await Promise.all(outs.slice(0, withHistory).map(async (o) => (o.history = await history(o.token))));
  outs.forEach((o) => delete o.token);
  return { id: def.id, title: def.title, url: `https://polymarket.com/event/${def.slug}`, volume: num(ev.volume), outcomes: outs };
}

async function produce() {
  const settled = await Promise.allSettled(PRES2028_EVENTS.map((d) => loadEvent(d, d.id === 'party' ? 3 : 10, d.id === 'party' ? 2 : 5)));
  const markets = settled.filter((s) => s.status === 'fulfilled').map((s) => s.value);
  const errors = settled.map((s, i) => (s.status === 'rejected' ? `${PRES2028_EVENTS[i].id}: ${s.reason?.message}` : null)).filter(Boolean);
  if (!markets.length) throw new Error('all Polymarket requests failed');
  return { markets, errors, fetchedAt: Date.now(), source: 'Polymarket (gamma-api + clob prices-history)' };
}

let value, at = 0, inflight = null;
export async function getPres2028() {
  if (value && Date.now() - at < 120000) return value;
  if (!inflight)
    inflight = produce()
      .then((v) => ((value = v), (at = Date.now()), v))
      .catch((e) => { if (value) return { ...value, stale: true }; throw e; })
      .finally(() => (inflight = null));
  return inflight;
}

export async function nodePres2028Handler(json, res) {
  try { return json(res, 200, await getPres2028()); }
  catch (e) { return json(res, 502, { error: String(e.message || e), markets: [] }); }
}
