// Real RSS/Atom news aggregation for /api/news and the SSE 'news' event.
// - Fetches FEEDS (server/feeds.js) in parallel, 8s timeout each, conditional GET (ETag/Last-Modified)
// - Normalizes to NewsItem (src/types.ts), tags states/keywords, flags breaking, clusters stories
// - Never fabricates headlines: if every feed fails the list is simply empty and sources show ok:false
import crypto from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import { FEEDS, OUTLET_LEAN } from './feeds.js';

const FEED_TIMEOUT_MS = 8000;
export const REFRESH_MS = 2 * 60 * 1000;
const MAX_ITEMS = 1200;
const MAX_AGE_MS = 7 * 24 * 3600 * 1000;
const USER_AGENT = 'Mozilla/5.0 (compatible; PolTok/1.0; RSS news aggregator)';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseTagValue: false,
  trimValues: true,
  processEntities: true,
  htmlEntities: true,
  isArray: (name) => ['item', 'entry', 'media:content', 'media:thumbnail', 'enclosure', 'link', 'category'].includes(name),
});

/* --------------------------------------- text utils --------------------------------------- */

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };

function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => safeChar(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => safeChar(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}
function safeChar(n) {
  try {
    return String.fromCodePoint(n);
  } catch {
    return '';
  }
}

function txt(v) {
  if (v == null) return '';
  if (Array.isArray(v)) return txt(v[0]);
  if (typeof v === 'object') return txt(v['#text'] ?? v['@_href'] ?? '');
  return String(v);
}

export function stripHtml(s) {
  return decodeEntities(
    String(s || '')
      .replace(/<!\[CDATA\[|\]\]>/g, '')
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/<[^>]+>/g, ' ') // entity-encoded html (e.g. &lt;p&gt;)
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(s, n) {
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), n - 20)).trimEnd() + '…';
}

const hashId = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 14);

/* ------------------------------------------ tagging ---------------------------------------- */

const STATE_NAMES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut',
  DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan',
  MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire',
  NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma',
  OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee',
  TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  DC: 'District of Columbia',
};
// Uppercase abbreviations that are too ambiguous as bare words.
const AMBIGUOUS_ABBR = new Set(['IN', 'ME', 'OR', 'OK', 'HI', 'DE', 'ID', 'LA', 'MS', 'AL', 'CO', 'MA', 'PA', 'DC', 'US', 'AS', 'SC', 'MD', 'NE', 'OH', 'VA']);
const NAME_ENTRIES = Object.entries(STATE_NAMES)
  .map(([abbr, name]) => ({ abbr, name }))
  .sort((a, b) => b.name.length - a.name.length);
const NAME_RE = new Map(
  NAME_ENTRIES.map(({ abbr, name }) => [
    abbr,
    abbr === 'WA'
      ? /\bWashington (state|State)\b|\bWashington's (governor|Senate|House|\d)/
      : abbr === 'NY'
        ? /\bNew York\b(?! (Times|Post|City Council|Magazine|Daily News))/
        : new RegExp(`\\b${name}\\b`),
  ]),
);
const ABBR_RE = /\b([A-Z]{2})\b/g;
// "R-Texas", "D-Pa.", "(R-PA)" style
const PARTY_STATE_RE = /\b[RDI]-([A-Z][a-z]{1,3}\.?|[A-Z]{2})\b/g;
const SHORT_FORMS = { 'Ala': 'AL', 'Ariz': 'AZ', 'Ark': 'AR', 'Calif': 'CA', 'Colo': 'CO', 'Conn': 'CT', 'Del': 'DE', 'Fla': 'FL', 'Ga': 'GA', 'Ill': 'IL', 'Ind': 'IN', 'Kan': 'KS', 'Ky': 'KY', 'La': 'LA', 'Md': 'MD', 'Mass': 'MA', 'Mich': 'MI', 'Minn': 'MN', 'Miss': 'MS', 'Mo': 'MO', 'Mont': 'MT', 'Neb': 'NE', 'Nev': 'NV', 'Okla': 'OK', 'Ore': 'OR', 'Pa': 'PA', 'Tenn': 'TN', 'Tex': 'TX', 'Va': 'VA', 'Vt': 'VT', 'Wash': 'WA', 'Wis': 'WI', 'Wyo': 'WY' };

const KEYWORDS = [
  ['senate', /\bsenat(e|or|ors)\b/i],
  ['house', /\b(the house|house (race|seat|majority|control|republicans|democrats|speaker)|congressional district|speaker)\b/i],
  ['governor', /\b(governor|gubernatorial|gov\.)\b/i],
  ['polls', /\b(poll|polls|polling|survey|pollster)\b/i],
  ['results', /\b(results|projected|projection|race call|wins|won|concedes|declared|too close to call)\b/i],
  ['midterms', /\bmidterms?\b/i],
  ['election', /\b(election|electoral|ballot|ballots|voters?|voting|turnout|polling place)\b/i],
  ['trump', /\btrump\b/i],
  ['congress', /\bcongress(ional)?\b/i],
  ['democrats', /\bdemocrat(s|ic)?\b/i],
  ['republicans', /\b(republican(s)?|gop)\b/i],
  ['supreme-court', /\bsupreme court\b/i],
  ['economy', /\b(economy|inflation|tariffs?|jobs report|prices)\b/i],
  ['immigration', /\b(immigration|border|ice|deportation)\b/i],
  ['abortion', /\babortion\b/i],
  ['redistricting', /\b(redistricting|gerrymander)/i],
  ['markets', /\b(polymarket|kalshi|prediction market|betting odds)\b/i],
];

const POLITICS_RE =
  /\b(election|elections|midterms?|senat(e|or)|congress|governor|gubernatorial|house race|ballot|voters?|voting|polls?|campaign|trump|vance|biden|democrat|republican|gop|white house|supreme court|candidate|primary|caucus|legislat|politic)/i;

export function tagText(title, summary = '') {
  const text = `${title} ${summary}`;
  const tags = new Set();
  for (const [tag, re] of KEYWORDS) if (re.test(text)) tags.add(tag);
  // States: names first (longest first so "West Virginia" doesn't also match "Virginia").
  let scrub = text;
  for (const { abbr } of NAME_ENTRIES) {
    const re = NAME_RE.get(abbr);
    if (re.test(scrub)) {
      tags.add(abbr);
      scrub = scrub.replace(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'), ' ');
    }
  }
  for (const m of text.matchAll(PARTY_STATE_RE)) {
    const k = m[1].replace('.', '');
    const abbr = STATE_NAMES[k] ? k : SHORT_FORMS[k];
    if (abbr) tags.add(abbr);
  }
  for (const m of title.matchAll(ABBR_RE)) {
    if (STATE_NAMES[m[1]] && !AMBIGUOUS_ABBR.has(m[1])) tags.add(m[1]);
  }
  return [...tags];
}

/* ------------------------------------------ parsing ---------------------------------------- */

function pickImage(it) {
  const tryList = (arr, attr = '@_url') => {
    for (const x of arr || []) {
      const url = x?.[attr];
      const type = x?.['@_type'] || '';
      const medium = x?.['@_medium'] || '';
      if (url && (!type || type.startsWith('image') || medium === 'image') && medium !== 'video') return url;
    }
    return undefined;
  };
  const group = it['media:group'];
  return (
    tryList(it['media:content']) ||
    tryList(group?.['media:content']) ||
    tryList(it['media:thumbnail']) ||
    tryList(group?.['media:thumbnail']) ||
    tryList(it.enclosure) ||
    firstImg(txt(it['content:encoded'])) ||
    firstImg(txt(it.description)) ||
    firstImg(txt(it.content)) ||
    firstImg(txt(it.summary))
  );
}

function firstImg(html) {
  const m = /<img[^>]+src=["']([^"']+)["']/i.exec(html || '');
  return m && /^https?:/.test(m[1]) ? decodeEntities(m[1]) : undefined;
}

function pickLink(it) {
  const l = it.link;
  if (Array.isArray(l)) {
    const alt = l.find((x) => typeof x === 'object' && (x['@_rel'] === 'alternate' || !x['@_rel']) && x['@_href']);
    if (alt) return alt['@_href'];
    const first = l[0];
    return typeof first === 'object' ? first['@_href'] || txt(first) : String(first);
  }
  if (l && typeof l === 'object') return l['@_href'] || txt(l);
  return txt(l) || txt(it.guid);
}

function parseDate(s) {
  if (!s) return NaN;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : NaN;
}

/** Parse a feed body into raw entries. */
export function parseFeed(xml) {
  const doc = parser.parse(xml);
  const rss = doc?.rss?.channel;
  if (rss) return [].concat(rss.item || []);
  if (doc?.feed) return [].concat(doc.feed.entry || []);
  const rdf = doc?.['rdf:RDF'];
  if (rdf) return [].concat(rdf.item || []);
  return [];
}

const firstSeen = new Map(); // id -> epoch ms, for items without dates

function normalizeEntry(it, feed, now) {
  let title = stripHtml(txt(it.title));
  let url = String(pickLink(it) || '').trim();
  if (!title || !/^https?:\/\//.test(url)) return null;
  let source = feed.name;
  let lean = feed.lean;
  if (feed.gnews) {
    const src = it.source;
    const outlet = stripHtml(txt(src));
    if (outlet) {
      source = outlet;
      lean = OUTLET_LEAN[outlet.toLowerCase()] ?? (feed.lean !== 'Unrated' ? feed.lean : 'Unrated');
      const suffix = ` - ${outlet}`;
      if (title.endsWith(suffix)) title = title.slice(0, -suffix.length).trim();
    }
  }
  const id = hashId(url);
  let publishedAt = parseDate(txt(it.pubDate) || txt(it.published) || txt(it.updated) || txt(it['dc:date']));
  if (!Number.isFinite(publishedAt)) {
    if (!firstSeen.has(id)) firstSeen.set(id, now);
    publishedAt = firstSeen.get(id);
  }
  publishedAt = Math.min(publishedAt, now);
  if (now - publishedAt > MAX_AGE_MS) return null;

  const rawSummary = feed.gnews ? '' : txt(it.description) || txt(it.summary) || txt(it.content) || txt(it['content:encoded']);
  let summary = truncate(stripHtml(rawSummary), 320);
  if (summary && summary.toLowerCase() === title.toLowerCase()) summary = '';
  if (feed.general && !POLITICS_RE.test(`${title} ${summary}`)) return null;

  const image = feed.gnews ? undefined : pickImage(it);
  const tags = tagText(title, summary);
  const ageMin = (now - publishedAt) / 60000;
  const breaking = ageMin < 30 && /\b(breaking|projected|wins|won)\b/i.test(title);

  /** @type {import('../src/types').NewsItem} */
  const item = { id, title, url, source, sourceLean: lean, publishedAt };
  if (summary) item.summary = summary;
  if (image) item.image = String(image).replace(/&amp;/g, '&');
  if (tags.length) item.tags = tags;
  if (breaking) item.breaking = true;
  return item;
}

/* ----------------------------------------- clustering -------------------------------------- */

const STOP = new Set(
  'a an the and or but of to in on for with at by from as is are was were be been it its this that these those after before over into about says say said will would could new his her their they he she we you not no than more most what why how who as up out amid vs via just'.split(
    ' ',
  ),
);
function tokens(title) {
  return new Set(
    title
      .toLowerCase()
      .replace(/[’']s\b/g, '')
      .replace(/[^a-z0-9 ]+/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w)),
  );
}

export function cluster(items, threshold = 0.35, windowMs = 12 * 3600 * 1000) {
  // Leader clustering (no transitive chaining): oldest items seed clusters; each item joins the
  // most similar seed within the time window if token Jaccard >= threshold.
  const order = items.map((_, i) => i).sort((a, b) => items[a].publishedAt - items[b].publishedAt);
  /** @type {{ toks: Set<string>; t: number; id: string }[]} */
  const seeds = [];
  for (const i of order) {
    const it = items[i];
    const tk = tokens(it.title);
    let best = null;
    let bestJ = threshold;
    if (tk.size >= 3) {
      for (const s of seeds) {
        if (it.publishedAt - s.t > windowMs) continue;
        let inter = 0;
        for (const w of tk) if (s.toks.has(w)) inter++;
        if (!inter) continue;
        const jac = inter / (tk.size + s.toks.size - inter);
        if (jac >= bestJ) {
          bestJ = jac;
          best = s;
        }
      }
    }
    if (best) it.clusterId = best.id;
    else {
      it.clusterId = 'c_' + it.id;
      if (tk.size >= 3) seeds.push({ toks: tk, t: it.publishedAt, id: it.clusterId });
    }
  }
  return items;
}

/* ------------------------------------------ service ---------------------------------------- */

export function createNewsService({ log = console.log, onNew } = {}) {
  /** @type {Map<string, {ok:boolean; etag?:string; lastModified?:string; items:any[]; error?:string; count:number; at:number}>} */
  const feedState = new Map();
  let items = [];
  let fetchedAt = 0;
  let timer = null;
  let inflight = null;
  const known = new Set();

  async function fetchFeed(feed) {
    const prev = feedState.get(feed.url);
    const headers = { 'user-agent': USER_AGENT, accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' };
    if (prev?.etag) headers['if-none-match'] = prev.etag;
    if (prev?.lastModified) headers['if-modified-since'] = prev.lastModified;
    try {
      const res = await fetch(feed.url, { headers, redirect: 'follow', signal: AbortSignal.timeout(FEED_TIMEOUT_MS) });
      if (res.status === 304 && prev) {
        feedState.set(feed.url, { ...prev, ok: true, at: Date.now() });
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.text();
      const raw = parseFeed(body);
      if (!raw.length && !/<(rss|feed|rdf:RDF)\b/i.test(body)) throw new Error('not a feed');
      feedState.set(feed.url, {
        ok: true,
        etag: res.headers.get('etag') || undefined,
        lastModified: res.headers.get('last-modified') || undefined,
        items: raw,
        count: raw.length,
        at: Date.now(),
      });
    } catch (e) {
      const msg = e?.name === 'TimeoutError' ? 'timeout' : e?.message || String(e);
      // keep previous items (stale-while-error) but report the failure
      feedState.set(feed.url, { ...(prev || { items: [], count: 0 }), ok: false, error: msg, at: Date.now() });
    }
  }

  async function refresh() {
    if (inflight) return inflight;
    inflight = (async () => {
      const t0 = Date.now();
      await Promise.all(FEEDS.map(fetchFeed));
      const now = Date.now();
      const byId = new Map();
      const titleKey = new Set();
      for (const feed of FEEDS) {
        const st = feedState.get(feed.url);
        for (const raw of st?.items || []) {
          let it;
          try {
            it = normalizeEntry(raw, feed, now);
          } catch {
            it = null;
          }
          if (!it || byId.has(it.id)) continue;
          const tk = `${it.source}|${it.title.toLowerCase()}`;
          if (titleKey.has(tk)) continue;
          titleKey.add(tk);
          byId.set(it.id, it);
        }
      }
      const list = [...byId.values()].sort((a, b) => b.publishedAt - a.publishedAt).slice(0, MAX_ITEMS);
      cluster(list);
      const fresh = list.filter((i) => !known.has(i.id));
      for (const i of list) known.add(i.id);
      const firstLoad = fetchedAt === 0;
      items = list;
      fetchedAt = now;
      const okCount = FEEDS.filter((f) => feedState.get(f.url)?.ok).length;
      log(`[news] ${okCount}/${FEEDS.length} feeds ok, ${list.length} items (${fresh.length} new) in ${now - t0}ms`);
      if (!firstLoad && fresh.length && onNew) onNew(fresh);
      return items;
    })().finally(() => {
      inflight = null;
    });
    return inflight;
  }

  function sources() {
    const byName = new Map();
    for (const f of FEEDS) {
      const st = feedState.get(f.url);
      const cur = byName.get(f.name) || { name: f.name, lean: f.lean, ok: false, items: 0, errors: [] };
      cur.ok = cur.ok || !!st?.ok;
      cur.items += st?.ok ? st.count : 0;
      if (st && !st.ok) cur.errors.push(st.error);
      byName.set(f.name, cur);
    }
    return [...byName.values()].map(({ errors, ...s }) => (errors.length && !s.ok ? { ...s, error: errors[0] } : s));
  }

  return {
    start() {
      refresh().catch((e) => log('[news] refresh failed', e));
      timer = setInterval(() => refresh().catch((e) => log('[news] refresh failed', e)), REFRESH_MS);
      timer.unref?.();
    },
    stop() {
      clearInterval(timer);
    },
    refresh,
    ready: () => fetchedAt > 0,
    /** @param {{limit?:number; tag?:string; lean?:string; source?:string; q?:string}} q */
    query({ limit = 100, tag, lean, source, q } = {}) {
      let list = items;
      if (tag) {
        const tl = tag.toLowerCase();
        list = list.filter((i) => i.tags?.some((t) => t.toLowerCase() === tl));
      }
      if (lean) {
        const ls = lean.split(',').map((s) => s.trim().toLowerCase());
        list = list.filter((i) => ls.includes(i.sourceLean.toLowerCase()));
      }
      if (source) list = list.filter((i) => i.source.toLowerCase() === source.toLowerCase());
      if (q) {
        const ql = q.toLowerCase();
        list = list.filter((i) => i.title.toLowerCase().includes(ql) || i.summary?.toLowerCase().includes(ql));
      }
      return { items: list.slice(0, Math.max(1, Math.min(1000, limit | 0 || 100))), fetchedAt, sources: sources() };
    },
    recent(n = 60) {
      return items.slice(0, n);
    },
  };
}
