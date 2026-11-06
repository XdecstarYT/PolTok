// International news service for /api/world/news?country=GB.
// Separate from the US /api/news service: its own feed list, cache and country tagging. Reuses the
// parse/cluster/strip helpers exported from server/news.js (read-only).
//
// Feeds verified with curl on 2026-11-06. Telegraph, Politico Europe, CTV and NHK World block or no
// longer publish direct RSS (402/403/404), so they come via Google News `site:` queries.
// Lean labels: only where AllSides publishes a rating for the outlet (BBC News — Center,
// The Guardian — Lean Left, The Telegraph — Lean Right, Reuters — Center, AP — Lean Left);
// everything else is 'Unrated'. Never fabricates headlines: failed feeds report ok:false.
import crypto from 'node:crypto';
import { parseFeed, cluster, stripHtml } from './news.js';

const UA = 'Mozilla/5.0 (compatible; PolTok/1.0; RSS news aggregator)';
const TTL = 5 * 60 * 1000;
const MAX_AGE = 5 * 24 * 3600 * 1000;
const GN = (q, ed = 'en-GB:GB') => {
  const [hl, gl] = ed.split(':');
  return `https://news.google.com/rss/search?q=${encodeURIComponent(q + ' when:3d')}&hl=${hl}&gl=${gl}&ceid=${gl}:en`;
};

/** @type {{ name: string; url: string; lean: string; region: string; home?: string; gnews?: boolean }[]} */
export const WORLD_FEEDS = [
  // UK
  { name: 'BBC News', url: 'https://feeds.bbci.co.uk/news/politics/rss.xml', lean: 'Center', region: 'UK', home: 'GB' },
  { name: 'The Guardian', url: 'https://www.theguardian.com/politics/rss', lean: 'Lean Left', region: 'UK', home: 'GB' },
  { name: 'The Telegraph', url: GN('site:telegraph.co.uk politics'), lean: 'Lean Right', region: 'UK', home: 'GB', gnews: true },
  { name: 'Sky News', url: 'https://feeds.skynews.com/feeds/rss/politics.xml', lean: 'Unrated', region: 'UK', home: 'GB' },
  // Canada
  { name: 'CBC News', url: 'https://www.cbc.ca/webfeed/rss/rss-politics', lean: 'Unrated', region: 'Canada', home: 'CA' },
  { name: 'The Globe and Mail', url: 'https://www.theglobeandmail.com/arc/outboundfeeds/rss/category/politics/', lean: 'Unrated', region: 'Canada', home: 'CA' },
  { name: 'CTV News', url: GN('site:ctvnews.ca politics', 'en-CA:CA'), lean: 'Unrated', region: 'Canada', home: 'CA', gnews: true },
  // Europe
  { name: 'Politico Europe', url: GN('site:politico.eu'), lean: 'Unrated', region: 'Europe', gnews: true },
  { name: 'Euronews', url: 'https://www.euronews.com/rss?level=theme&name=news', lean: 'Unrated', region: 'Europe' },
  { name: 'DW', url: 'https://rss.dw.com/rdf/rss-en-world', lean: 'Unrated', region: 'Europe' },
  { name: 'DW', url: 'https://rss.dw.com/rdf/rss-en-all', lean: 'Unrated', region: 'Europe' },
  { name: 'France 24', url: 'https://www.france24.com/en/rss', lean: 'Unrated', region: 'Europe' },
  // Asia-Pacific
  { name: 'South China Morning Post', url: 'https://www.scmp.com/rss/91/feed', lean: 'Unrated', region: 'Asia-Pacific' },
  { name: 'NHK World', url: GN('site:www3.nhk.or.jp nhkworld'), lean: 'Unrated', region: 'Asia-Pacific', home: 'JP', gnews: true },
  { name: 'ABC News (Australia)', url: 'https://www.abc.net.au/news/feed/2942460/rss.xml', lean: 'Unrated', region: 'Asia-Pacific' },
  { name: 'The Hindu', url: 'https://www.thehindu.com/news/national/feeder/default.rss', lean: 'Unrated', region: 'Asia-Pacific', home: 'IN' },
  { name: 'The Straits Times', url: 'https://www.straitstimes.com/news/asia/rss.xml', lean: 'Unrated', region: 'Asia-Pacific' },
  // Wires via Google News
  { name: 'Reuters', url: GN('site:reuters.com world', 'en-US:US'), lean: 'Center', region: 'Wires', gnews: true },
  { name: 'AP News', url: GN('site:apnews.com world', 'en-US:US'), lean: 'Lean Left', region: 'Wires', gnews: true },
];

/** ISO code → names/demonyms/leaders used for tagging (word-boundary, case-sensitive for short terms). */
export const COUNTRY_TERMS = {
  US: ['United States', 'U.S.', 'Washington', 'American', 'Trump', 'White House'],
  GB: ['United Kingdom', 'UK', 'U.K.', 'Britain', 'British', 'Westminster', 'Downing Street', 'England', 'Scotland', 'Wales', 'Scottish', 'Welsh', 'Tories', 'Tory', 'Reform UK'],
  CA: ['Canada', 'Canadian', 'Ottawa', 'Carney', 'Poilievre'],
  AU: ['Australia', 'Australian', 'Canberra', 'Albanese'],
  NZ: ['New Zealand', 'Wellington', 'Luxon'],
  IE: ['Ireland', 'Irish', 'Dublin', 'Dáil', 'Taoiseach'],
  FR: ['France', 'French', 'Paris', 'Macron', 'Élysée', 'Elysee'],
  DE: ['Germany', 'German', 'Berlin', 'Merz', 'Bundestag'],
  IT: ['Italy', 'Italian', 'Rome', 'Meloni'],
  ES: ['Spain', 'Spanish', 'Madrid', 'Sánchez', 'Sanchez'],
  PT: ['Portugal', 'Portuguese', 'Lisbon'],
  NL: ['Netherlands', 'Dutch', 'The Hague', 'Amsterdam'],
  BE: ['Belgium', 'Belgian'],
  AT: ['Austria', 'Austrian', 'Vienna'],
  CH: ['Switzerland', 'Swiss'],
  SE: ['Sweden', 'Swedish', 'Stockholm'],
  NO: ['Norway', 'Norwegian', 'Oslo'],
  DK: ['Denmark', 'Danish', 'Copenhagen', 'Greenland'],
  FI: ['Finland', 'Finnish', 'Helsinki'],
  PL: ['Poland', 'Polish', 'Warsaw', 'Tusk'],
  CZ: ['Czech', 'Czechia', 'Prague', 'Babiš', 'Babis'],
  SK: ['Slovakia', 'Slovak', 'Bratislava', 'Fico'],
  GR: ['Greece', 'Greek', 'Athens'],
  HU: ['Hungary', 'Hungarian', 'Budapest', 'Orbán', 'Orban'],
  RO: ['Romania', 'Romanian', 'Bucharest'],
  EE: ['Estonia', 'Estonian', 'Tallinn'],
  UA: ['Ukraine', 'Ukrainian', 'Kyiv', 'Zelensky', 'Zelenskyy'],
  IL: ['Israel', 'Israeli', 'Netanyahu', 'Knesset', 'Jerusalem', 'Tel Aviv'],
  TR: ['Turkey', 'Türkiye', 'Turkish', 'Ankara', 'Erdogan', 'Erdoğan'],
  JP: ['Japan', 'Japanese', 'Tokyo', 'Takaichi'],
  KR: ['South Korea', 'South Korean', 'Seoul'],
  TW: ['Taiwan', 'Taiwanese', 'Taipei'],
  IN: ['India', 'Indian', 'New Delhi', 'Modi', 'Lok Sabha'],
  ID: ['Indonesia', 'Indonesian', 'Jakarta', 'Prabowo'],
  PH: ['Philippines', 'Philippine', 'Filipino', 'Manila', 'Marcos'],
  ZA: ['South Africa', 'South African', 'Pretoria', 'Cape Town', 'Ramaphosa'],
  BR: ['Brazil', 'Brazilian', 'Brasília', 'Brasilia', 'Lula'],
  AR: ['Argentina', 'Argentine', 'Argentinian', 'Buenos Aires', 'Milei'],
  MX: ['Mexico', 'Mexican', 'Sheinbaum'],
  CL: ['Chile', 'Chilean', 'Santiago'],
  CO: ['Colombia', 'Colombian', 'Bogotá', 'Bogota'],
};
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const TERM_RE = Object.fromEntries(
  Object.entries(COUNTRY_TERMS).map(([code, terms]) => [code, new RegExp(`(?:^|[^\\p{L}])(?:${terms.map(esc).join('|')})(?![\\p{L}])`, 'u')]),
);

/** Tag a headline with ISO codes by country name/demonym/leader mentions. */
export function countryTags(text) {
  const out = [];
  for (const [code, re] of Object.entries(TERM_RE)) if (re.test(text)) out.push(code);
  return out;
}

const txt = (v) => {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (Array.isArray(v)) return txt(v[0]);
  return String(v['#text'] ?? '');
};
const link = (it) => {
  const l = it.link;
  if (Array.isArray(l)) {
    for (const x of l) {
      if (typeof x === 'string' && x.trim()) return x.trim();
      if (x?.['@_href'] && (!x['@_rel'] || x['@_rel'] === 'alternate')) return x['@_href'];
    }
  }
  if (typeof l === 'string') return l;
  return txt(it.guid) || '';
};

function normalize(it, feed, now) {
  let title = stripHtml(txt(it.title));
  const url = String(link(it)).trim();
  if (!title || !/^https?:\/\//.test(url)) return null;
  if (feed.gnews) {
    const outlet = stripHtml(txt(it.source));
    if (outlet && title.endsWith(` - ${outlet}`)) title = title.slice(0, -(outlet.length + 3)).trim();
  }
  let t = Date.parse(txt(it.pubDate) || txt(it.published) || txt(it.updated) || txt(it['dc:date']));
  if (!Number.isFinite(t)) t = now;
  t = Math.min(t, now);
  if (now - t > MAX_AGE) return null;
  const summary = feed.gnews ? '' : stripHtml(txt(it.description) || txt(it.summary)).slice(0, 300);
  const countries = countryTags(`${title} ${summary}`);
  if (feed.home && !countries.includes(feed.home) && feed.region !== 'Wires') countries.push(feed.home);
  const item = {
    id: crypto.createHash('sha1').update(url).digest('hex').slice(0, 16),
    title,
    url,
    source: feed.name,
    sourceLean: feed.lean,
    region: feed.region,
    publishedAt: t,
    countries,
  };
  if (summary && summary.toLowerCase() !== title.toLowerCase()) item.summary = summary;
  return item;
}

let state = { at: 0, items: [], sources: [] };
let inflight = null;

async function fetchFeed(feed, now) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(feed.url, { signal: ctl.signal, headers: { 'user-agent': UA, accept: 'application/rss+xml, application/xml, text/xml, */*' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const items = parseFeed(await r.text()).map((it) => normalize(it, feed, now)).filter(Boolean);
    return { feed, ok: true, items };
  } catch (e) {
    return { feed, ok: false, items: [], error: String(e.message || e).slice(0, 80) };
  } finally {
    clearTimeout(timer);
  }
}

export async function loadWorldNews() {
  if (Date.now() - state.at < TTL && state.items.length) return state;
  if (inflight) return inflight;
  inflight = (async () => {
    const now = Date.now();
    const res = await Promise.all(WORLD_FEEDS.map((f) => fetchFeed(f, now)));
    const seen = new Set();
    const items = [];
    for (const r of res)
      for (const it of r.items) {
        const k = it.title.toLowerCase();
        if (seen.has(it.id) || seen.has(k)) continue;
        seen.add(it.id);
        seen.add(k);
        items.push(it);
      }
    cluster(items);
    items.sort((a, b) => b.publishedAt - a.publishedAt);
    const sources = res.map((r) => ({ name: r.feed.name, lean: r.feed.lean, region: r.feed.region, ok: r.ok, count: r.items.length, ...(r.error ? { error: r.error } : {}) }));
    if (items.length || !state.items.length) state = { at: now, items, sources };
    return state;
  })().finally(() => (inflight = null));
  return inflight;
}

/** Router core: { status, body, maxAge }. Params: country (ISO2), region, limit. */
export async function worldNewsApi(params) {
  try {
    const s = await loadWorldNews();
    const country = (params.get('country') || '').toUpperCase().slice(0, 2);
    const region = params.get('region') || '';
    const limit = Math.min(200, Math.max(1, Number(params.get('limit')) || 60));
    let items = s.items;
    if (country) items = items.filter((i) => i.countries.includes(country));
    if (region) items = items.filter((i) => i.region === region);
    return {
      status: 200,
      maxAge: 300,
      body: { items: items.slice(0, limit), total: items.length, country: country || null, fetchedAt: s.at, sources: s.sources, note: 'Real RSS headlines; countries tagged by name/demonym/leader mentions. Lean ratings only where AllSides publishes one, else Unrated.' },
    };
  } catch (e) {
    return { status: 502, body: { error: String(e.message || e) } };
  }
}
