// Australia live API (AU-DATA). Mounted by server/index.js:
//   GET /api/au/news                       { items: NewsItem[], fetchedAt, sources }   refreshed every 2 min
//   GET /api/au/markets                    { markets: Market[], updatedAt }            refreshed every 60 s
//   GET /api/au/results?contest=vic2026    { status, updatedAt, seats, source, note? }
// Never fabricates: failed feeds yield empty lists; results stay 'pre-election' with empty seats
// until a real results fetcher returns data.
import crypto from 'node:crypto';
import { parseFeed, stripHtml, cluster } from './news.js';
import { createAuMarketsFeed } from '../shared/au/markets.js';

/* ------------------------------------------------ news ------------------------------------------------ */

// Only feeds docs/research/australia.json marks ok:true. Lean mapped onto the Lean type in src/types.ts.
// `general` feeds are filtered to politics stories.
export const AU_FEEDS = [
  { name: 'ABC News', url: 'https://www.abc.net.au/news/feed/45910/rss.xml', lean: 'Lean Left', general: true },
  { name: 'ABC News', url: 'https://www.abc.net.au/news/feed/51120/rss.xml', lean: 'Lean Left', general: true },
  { name: 'The Guardian Australia', url: 'https://www.theguardian.com/australia-news/rss', lean: 'Left', general: true },
  { name: 'Sydney Morning Herald', url: 'https://www.smh.com.au/rss/politics/federal.xml', lean: 'Lean Left' },
  { name: 'The Age', url: 'https://www.theage.com.au/rss/national/victoria.xml', lean: 'Lean Left', general: true },
  { name: 'The Age', url: 'https://www.theage.com.au/rss/feed.xml', lean: 'Lean Left', general: true },
  { name: 'SBS News', url: 'https://www.sbs.com.au/news/feed', lean: 'Center', general: true },
  { name: 'The Conversation', url: 'https://theconversation.com/au/politics/articles.atom', lean: 'Lean Left' },
  { name: 'Crikey', url: 'https://www.crikey.com.au/feed/', lean: 'Left' },
  { name: 'The Poll Bludger', url: 'https://www.pollbludger.net/feed/', lean: 'Center' },
];

const AU_POLITICS_RE =
  /\b(election|elections|elector|by-election|poll|polls|polling|newspoll|vote|voters?|ballot|parliament|senat(e|or)|minister|premier|prime minister|pm|treasurer|opposition|cabinet|budget|labor|liberals?|coalition|nationals|greens|one nation|teal|independents?|crossbench|albanese|taylor|hanson|carroll|wilson|allan|minns|chalmers|dutton|ley|policy|government|politic\w*|vec|aec|legislation|bill|referendum|spring street|canberra)\b/i;

const AU_KEYWORDS = [
  ['victoria', /\b(victoria|victorian|melbourne|spring street|vec)\b/i],
  ['federal', /\b(federal|canberra|albanese|prime minister|house of representatives|aec)\b/i],
  ['nsw', /\b(nsw|new south wales|sydney|minns)\b/i],
  ['polls', /\b(poll|polls|polling|newspoll|resolve|redbridge|yougov|essential|roy morgan|freshwater|demosau)\b/i],
  ['election', /\b(election|by-election|ballot|voters?|voting|early voting|preferences)\b/i],
  ['labor', /\b(labor|alp)\b/i],
  ['coalition', /\b(liberals?|coalition|nationals|lnp)\b/i],
  ['greens', /\bgreens\b/i],
  ['one-nation', /\b(one nation|hanson)\b/i],
  ['independents', /\b(teals?|independents?|crossbench)\b/i],
  ['economy', /\b(economy|inflation|interest rates?|rba|cost of living|budget|housing)\b/i],
];

const FEED_TIMEOUT_MS = 8000;
const NEWS_REFRESH_MS = 2 * 60 * 1000;
const MAX_AGE_MS = 7 * 24 * 3600 * 1000;
const hashId = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 14);
const txt = (v) => (v == null ? '' : Array.isArray(v) ? txt(v[0]) : typeof v === 'object' ? txt(v['#text'] ?? v['@_href'] ?? '') : String(v));

function linkOf(it) {
  const l = it.link;
  if (Array.isArray(l)) {
    const alt = l.find((x) => typeof x === 'object' && (x['@_rel'] === 'alternate' || !x['@_rel']) && x['@_href']);
    if (alt) return alt['@_href'];
    return typeof l[0] === 'object' ? l[0]['@_href'] || txt(l[0]) : String(l[0]);
  }
  return txt(l) || txt(it.guid);
}

function imageOf(it) {
  for (const k of ['media:content', 'media:thumbnail', 'enclosure']) {
    for (const x of [].concat(it[k] || it['media:group']?.[k] || [])) {
      const t = x?.['@_type'] || '';
      if (x?.['@_url'] && (!t || t.startsWith('image')) && x['@_medium'] !== 'video') return x['@_url'];
    }
  }
  const m = /<img[^>]+src=["'](https?:[^"']+)["']/i.exec(txt(it['content:encoded']) || txt(it.description) || '');
  return m ? m[1] : undefined;
}

function normalize(it, feed, now) {
  const title = stripHtml(txt(it.title));
  const url = String(linkOf(it) || '').trim();
  if (!title || !/^https?:\/\//.test(url)) return null;
  let publishedAt = Date.parse(txt(it.pubDate) || txt(it.published) || txt(it.updated) || txt(it['dc:date']));
  if (!Number.isFinite(publishedAt)) publishedAt = now;
  publishedAt = Math.min(publishedAt, now);
  if (now - publishedAt > MAX_AGE_MS) return null;
  let summary = stripHtml(txt(it.description) || txt(it.summary) || txt(it.content));
  if (summary.length > 320) summary = summary.slice(0, 300).replace(/\s+\S*$/, '') + '…';
  const text = `${title} ${summary}`;
  if (feed.general && !AU_POLITICS_RE.test(text)) return null;
  const item = { id: hashId(url), title, url, source: feed.name, sourceLean: feed.lean, publishedAt };
  if (summary && summary.toLowerCase() !== title.toLowerCase()) item.summary = summary;
  const image = imageOf(it);
  if (image) item.image = String(image).replace(/&amp;/g, '&');
  const tags = AU_KEYWORDS.filter(([, re]) => re.test(text)).map(([t]) => t);
  if (tags.length) item.tags = tags;
  if ((now - publishedAt) / 60000 < 30 && /\bbreaking\b/i.test(title)) item.breaking = true;
  return item;
}

export function createAuNewsService({ log = console.log } = {}) {
  const state = new Map(); // url -> {ok, items, error, at, etag, lastModified}
  let items = [];
  let fetchedAt = 0;
  let timer = null;
  let inflight = null;

  async function fetchFeed(feed) {
    const prev = state.get(feed.url);
    const headers = { 'user-agent': 'Mozilla/5.0 (compatible; PolTok/1.0; RSS news aggregator)', accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' };
    if (prev?.etag) headers['if-none-match'] = prev.etag;
    if (prev?.lastModified) headers['if-modified-since'] = prev.lastModified;
    try {
      const res = await fetch(feed.url, { headers, redirect: 'follow', signal: AbortSignal.timeout(FEED_TIMEOUT_MS) });
      if (res.status === 304 && prev) return state.set(feed.url, { ...prev, ok: true, at: Date.now() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const now = Date.now();
      const parsed = parseFeed(await res.text()).map((it) => normalize(it, feed, now)).filter(Boolean);
      state.set(feed.url, { ok: true, items: parsed, at: now, etag: res.headers.get('etag') || undefined, lastModified: res.headers.get('last-modified') || undefined });
    } catch (e) {
      state.set(feed.url, { ...(prev || { items: [] }), ok: false, error: String(e.message || e), at: Date.now() });
    }
  }

  async function refresh() {
    if (inflight) return inflight;
    inflight = (async () => {
      await Promise.all(AU_FEEDS.map(fetchFeed));
      const byId = new Map();
      for (const s of state.values()) for (const it of s.items || []) if (!byId.has(it.id)) byId.set(it.id, { ...it });
      items = cluster([...byId.values()]).sort((a, b) => b.publishedAt - a.publishedAt).slice(0, 400);
      fetchedAt = Date.now();
      const bad = AU_FEEDS.filter((f) => !state.get(f.url)?.ok).length;
      log(`[au-news] ${items.length} items from ${AU_FEEDS.length - bad}/${AU_FEEDS.length} feeds`);
    })().finally(() => (inflight = null));
    return inflight;
  }

  return {
    start() {
      if (!timer) {
        refresh();
        timer = setInterval(refresh, NEWS_REFRESH_MS);
      }
    },
    stop: () => (clearInterval(timer), (timer = null)),
    refresh,
    ready: () => fetchedAt > 0,
    query({ limit = 100, tag, q } = {}) {
      let out = items;
      if (tag) out = out.filter((i) => i.tags?.includes(tag));
      if (q) out = out.filter((i) => `${i.title} ${i.summary || ''}`.toLowerCase().includes(q.toLowerCase()));
      return {
        items: out.slice(0, limit),
        fetchedAt,
        sources: AU_FEEDS.map((f) => ({ name: f.name, url: f.url, lean: f.lean, ok: !!state.get(f.url)?.ok, count: state.get(f.url)?.items?.length || 0, error: state.get(f.url)?.error })),
      };
    },
  };
}

/* ----------------------------------------------- results ---------------------------------------------- */
//
// Pluggable results fetchers, one per contest. A fetcher is
//   { source: string, activeFrom: epoch ms, fetch(): Promise<{status:'counting'|'final', seats} | null> }
// Before `activeFrom` (polls close) we never call it and answer status 'pre-election' with empty seats.
// After, a null/failed fetch keeps the last real snapshot (or empty seats) — nothing is ever invented.
//
// VEC (Victoria, 28 Nov 2026, polls close 07:00 UTC): VEC publishes no public JSON/XML results feed (its
// media feed is for accredited media only; see docs/research/australia.json liveSources). Set
// VEC_RESULTS_URL to a feed on election night. The parser accepts either:
//   (a) JSON: { status?, seats: { [seatId|districtName]: { counted, tcp?:[{party,pct}], leader?, called? } } }
//       (our own normalized shape, e.g. produced by a scraper or relay), or
//   (b) VEC/AEC-style EML-ish XML: <Contest>/<District Name="Brunswick"> with <Counted>/<FormalVotes>,
//       <TwoCandidatePreferred><Candidate Party="GRN" Percentage="56.1"/>…, optional <Elected Party=…/>.
// District names are slugged to our seat ids ("vic-" + slug). AEC (federal) would plug in the same way
// from ftp://mediafeed.aec.gov.au/ (zipped EML 510 "results" messages) once a federal election is called.

const slug = (n) => String(n).toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function parseResultsPayload(body, prefix = 'vic-') {
  const seats = {};
  const trimmed = body.trim();
  if (trimmed.startsWith('{')) {
    const d = JSON.parse(trimmed);
    for (const [k, v] of Object.entries(d.seats || {})) {
      const id = k.startsWith(prefix) ? k : prefix + slug(k);
      seats[id] = { counted: Number(v.counted) || 0, ...(v.tcp ? { tcp: v.tcp } : {}), ...(v.leader ? { leader: v.leader } : {}), ...(v.called ? { called: v.called } : {}) };
    }
    return { status: d.status === 'final' ? 'final' : 'counting', seats };
  }
  const attr = (s, a) => new RegExp(`${a}="([^"]*)"`, 'i').exec(s)?.[1];
  for (const m of trimmed.matchAll(/<District\b([^>]*)>([\s\S]*?)<\/District>/gi)) {
    const name = attr(m[1], 'Name');
    if (!name) continue;
    const inner = m[2];
    const counted = Number(/<(?:Counted|FormalVotes)>(\d+)</i.exec(inner)?.[1]) || 0;
    const tcpBlock = /<TwoCandidatePreferred>([\s\S]*?)<\/TwoCandidatePreferred>/i.exec(inner)?.[1] || '';
    const tcp = [...tcpBlock.matchAll(/<Candidate\b([^>]*)\/?>/gi)]
      .map((c) => ({ party: attr(c[1], 'Party') || 'OTH', pct: Number(attr(c[1], 'Percentage')) }))
      .filter((c) => Number.isFinite(c.pct));
    const seat = { counted };
    if (tcp.length) {
      seat.tcp = tcp;
      seat.leader = [...tcp].sort((a, b) => b.pct - a.pct)[0].party;
    }
    const elected = /<Elected\b([^>]*)\/?>/i.exec(inner);
    if (elected) seat.called = attr(elected[1], 'Party');
    seats[prefix + slug(name)] = seat;
  }
  return { status: /<Final\s*\/?>|status="final"/i.test(trimmed) ? 'final' : 'counting', seats };
}

export function createUrlResultsFetcher({ url, source, activeFrom, prefix }) {
  return {
    source,
    activeFrom,
    async fetch() {
      if (!url) return null;
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const out = parseResultsPayload(await res.text(), prefix);
      return Object.keys(out.seats).length ? out : null;
    },
  };
}

export function createAuResults({ log = console.log, fetchers } = {}) {
  const registry = fetchers || {
    vic2026: createUrlResultsFetcher({
      url: process.env.VEC_RESULTS_URL,
      source: process.env.VEC_RESULTS_URL ? `VEC (${process.env.VEC_RESULTS_URL})` : 'Victorian Electoral Commission',
      activeFrom: Date.parse('2026-11-28T07:00:00Z'),
      prefix: 'vic-',
    }),
  };
  const cache = new Map(); // contest -> { at, value }
  const TTL = 30000;

  async function get(contest) {
    const f = registry[contest];
    if (!f) return null;
    const now = Date.now();
    const base = { status: 'pre-election', updatedAt: now, seats: {}, source: f.source };
    if (now < f.activeFrom) return { ...base, note: `Polls close ${new Date(f.activeFrom).toISOString()}; no results before then.` };
    const c = cache.get(contest);
    if (c && now - c.at < TTL) return c.value;
    let value = c?.value || { ...base, note: 'Awaiting first results from the electoral commission feed.' };
    try {
      const r = await f.fetch();
      if (r) value = { status: r.status, updatedAt: now, seats: r.seats, source: f.source };
    } catch (e) {
      log(`[au-results] ${contest}: ${e.message}`);
    }
    cache.set(contest, { at: now, value });
    return value;
  }
  return { get, contests: () => Object.keys(registry) };
}

/* ------------------------------------------------ mount ----------------------------------------------- */

/** Creates services; returns { handle(p, url, json) -> Promise<boolean>, stop() }. */
export function createAuApi({ log = console.log } = {}) {
  const news = createAuNewsService({ log });
  const markets = createAuMarketsFeed({ log, pollMs: 60000 });
  const results = createAuResults({ log });
  let marketsFirst = null;
  if (process.env.NEWS_DISABLED !== '1') news.start();
  marketsFirst = markets.start();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function handle(p, url, json, res) {
    switch (p) {
      case '/api/au/news': {
        if (!news.ready() && process.env.NEWS_DISABLED !== '1') await Promise.race([news.refresh(), sleep(9000)]);
        const q = url.searchParams;
        json(res, 200, news.query({ limit: Number(q.get('limit')) || 100, tag: q.get('tag') || undefined, q: q.get('q') || undefined }));
        return true;
      }
      case '/api/au/markets': {
        if (!markets.updatedAt()) await Promise.race([marketsFirst, sleep(9000)]);
        json(res, 200, { markets: markets.snapshot(), updatedAt: markets.updatedAt() });
        return true;
      }
      case '/api/au/results': {
        const contest = url.searchParams.get('contest') || 'vic2026';
        const r = await results.get(contest);
        if (!r) json(res, 404, { error: `unknown contest; available: ${results.contests().join(', ')}` });
        else json(res, 200, r);
        return true;
      }
      default:
        return false;
    }
  }
  return { handle, stop: () => (news.stop(), markets.stop()) };
}
