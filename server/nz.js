// New Zealand 2026 general election — live results + NZ news. Mounted by server/index.js
// (one line) and netlify/functions/nz.mjs (config.path). Keyless.
//
//   GET /api/nz/results               { status:'pre'|'counting'|'final', updatedAt, votesCountedPct, party[], electorates[], source, error? }
//   GET /api/nz/electorate?id=<slug>  { status, updatedAt, electorate|null, source, error? }   (full candidate + party vote table)
//   GET /api/nz/news?limit=           { items: NewsItem[], fetchedAt, sources }
//
// Live source: the Electoral Commission's election-night results site, which publishes static HTML
// pages (same templates since 2017): index.html (nationwide party vote + seats), electorate-status.html
// (every electorate: leader, 2nd, margin) and electorate-details-NN.html (full candidate + party votes).
// Parsers are tested against the 2023 official pages (tests/fixtures/nz2023, tests/nz.test.mjs).
// NEVER fabricates: until the 2026 pages exist (or if they cannot be fetched) we return status 'pre'
// with empty arrays and the reason in `error`.
import { parseFeed, stripHtml } from './news.js';

export const NZ_RESULTS_BASE = process.env.NZ_RESULTS_BASE || 'https://www.electionresults.govt.nz/electionresults_2026/';
export const NZ_POLLS_CLOSE = '2026-11-07T06:00:00Z'; // 7:00pm NZDT, Sat 7 Nov 2026
const UA = 'PolTok/1.0 (+https://poltok.netlify.app)';
const TTL = 60_000;

import { nzSlug, partyCode, parsePartyPage, parseStatusPage, parseDetailsPage, parseWikipediaResults, combineNzResults, MAORI, ent, num } from '../shared/nz-parse.js';
export { nzSlug, partyCode, parsePartyPage, parseStatusPage, parseDetailsPage, parseWikipediaResults };

// Backup source, used ONLY when the Electoral Commission site cannot be fetched (it sits behind a
// Cloudflare bot challenge that returns 403 to server-side fetches). Checked 6 Nov 2026: elections.nz
// (Incapsula) and catalogue.data.govt.nz (bot interstitial) are also blocked; no EC JSON/CSV feed exists
// on another reachable host; RNZ/Stuff/Herald/1News 2023 results pages are gone (404/410) and exposed no
// public JSON feed. Wikipedia's raw wikitext endpoint is reachable and is labelled community-edited/unofficial.
// Priority: official EC pages > Wikipedia (unofficial) > 'pre' with no numbers.
export const NZ_WIKI_TITLE = '2026_New_Zealand_general_election';
const WIKI_RAW = `https://en.wikipedia.org/w/index.php?title=${NZ_WIKI_TITLE}&action=raw`;
const WIKI_PAGE = `https://en.wikipedia.org/wiki/${NZ_WIKI_TITLE}`;
async function getWikiRaw(fetchImpl = fetch) {
  for (let i = 0; ; i++) {
    const r = await fetchImpl(WIKI_RAW, { headers: { 'user-agent': UA, 'api-user-agent': UA }, signal: AbortSignal.timeout(8000) });
    if (r.ok) return r.text();
    if (r.status === 429 && i < 2) {
      const ra = Number(r.headers.get('retry-after'));
      await new Promise((res) => setTimeout(res, Math.min(10, ra > 0 ? ra : 2 ** (i + 1)) * 1000));
      continue;
    }
    throw new Error(`HTTP ${r.status} from en.wikipedia.org`);
  }
}
/** Wikipedia fallback -> results object labelled unofficial, or null. Never before polls close. */
export async function fetchWikipediaResults({ fetchImpl = fetch, now = Date.now() } = {}) {
  if (now < Date.parse(NZ_POLLS_CLOSE)) return null;
  const w = parseWikipediaResults(await getWikiRaw(fetchImpl));
  if (!w) return null;
  return {
    status: 'counting', // a community edit cannot confirm preliminary vs official
    heading: 'Unofficial — community-edited (Wikipedia)',
    updatedAt: Date.now(),
    votesCountedPct: null,
    totalVotes: w.party.reduce((a, x) => a + x.votes, 0),
    party: w.party,
    electorates: [],
    source: WIKI_PAGE,
    sourceKind: 'wikipedia',
    sourceLabel: 'Wikipedia — community-edited, unofficial',
    pollsClose: NZ_POLLS_CLOSE,
  };
}

/* ------------------------------------------------ fetcher ------------------------------------------------ */
async function getText(url, fetchImpl = fetch) {
  const r = await fetchImpl(url, { headers: { 'user-agent': UA, accept: 'text/html,*/*' }, redirect: 'follow', signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`HTTP ${r.status} from ${new URL(url).host}`);
  return r.text();
}

const pre = (error) => ({
  status: 'pre',
  updatedAt: Date.now(),
  votesCountedPct: 0,
  party: [],
  electorates: [],
  source: NZ_RESULTS_BASE,
  sourceKind: 'none',
  pollsClose: NZ_POLLS_CLOSE,
  error,
});

/** Fetch + combine index.html and electorate-status.html. */
export async function fetchNzResults({ base = NZ_RESULTS_BASE, fetchImpl = fetch, now = Date.now() } = {}) {
  let idx, sts;
  try {
    [idx, sts] = await Promise.all([getText(base + 'index.html', fetchImpl), getText(base + 'electorate-status.html', fetchImpl).catch(() => '')]);
  } catch (e) {
    const ecErr = e.message;
    try {
      const w = await fetchWikipediaResults({ fetchImpl, now });
      if (w) return { ...w, error: `Electoral Commission unreachable (${ecErr}); showing unofficial Wikipedia figures.` };
    } catch {}
    return pre(`No results published yet (${ecErr}). Results stream from 7:00pm NZDT.`);
  }
  const r = combineNzResults(idx, sts, base, NZ_POLLS_CLOSE);
  return r ? { ...r, sourceKind: 'ec', sourceLabel: 'Electoral Commission (official)' } : pre('Results page reachable but no votes reported yet.');
}

let resCache = null, resAt = 0, resInflight = null;
export async function nzResults() {
  if (resCache && Date.now() - resAt < TTL) return resCache;
  resInflight ||= fetchNzResults()
    .then((r) => ((resCache = r), (resAt = Date.now()), r))
    .finally(() => (resInflight = null));
  return resInflight;
}

const detCache = new Map();
export async function nzElectorate(id) {
  const hit = detCache.get(id);
  if (hit && Date.now() - hit.at < TTL) return hit.v;
  let v;
  try {
    const sts = await getText(NZ_RESULTS_BASE + 'electorate-status.html');
    const row = parseStatusPage(sts)?.electorates.find((e) => e.id === id);
    if (!row) v = { status: 'pre', updatedAt: Date.now(), electorate: null, source: NZ_RESULTS_BASE, error: 'Electorate not yet listed on the results site.' };
    else {
      const d = parseDetailsPage(await getText(NZ_RESULTS_BASE + row.href));
      v = { status: d?.status || 'counting', updatedAt: Date.now(), electorate: d, source: NZ_RESULTS_BASE + row.href };
    }
  } catch (e) {
    v = { status: 'pre', updatedAt: Date.now(), electorate: null, source: NZ_RESULTS_BASE, error: `No results published yet (${e.message}).` };
  }
  detCache.set(id, { at: Date.now(), v });
  return v;
}

/* ------------------------------------------------ news ------------------------------------------------ */
// Verified 6 Nov 2026 (HTTP 200 with items). The Spinoff exposes no public RSS (404) and The Post's
// /rss returns an empty shell, so they are not listed.
export const NZ_FEEDS = [
  { name: 'RNZ', url: 'https://www.rnz.co.nz/rss/political.xml', lean: 'Center' },
  { name: 'RNZ', url: 'https://www.rnz.co.nz/rss/national.xml', lean: 'Center', general: true },
  { name: 'Stuff', url: 'https://www.stuff.co.nz/rss/politics', lean: 'Lean Left' },
  { name: 'NZ Herald', url: 'https://www.nzherald.co.nz/arc/outboundfeeds/rss/section/nz/politics/?outputType=xml', lean: 'Lean Right' },
  { name: '1News', url: 'https://www.1news.co.nz/arc/outboundfeeds/rss/?outputType=xml', lean: 'Center', general: true },
  { name: 'Newsroom', url: 'https://www.newsroom.co.nz/feed', lean: 'Lean Left', general: true },
];
const POL_RE = /\b(election|vote[sd]?|voters?|voting|poll|polls|parliament|mp|mps|minister|prime minister|luxon|hipkins|seymour|peters|swarbrick|davidson|waititi|ngarewa-packer|national|labour|greens?|act|nz first|te p[aā]ti m[aā]ori|opportunity|coalition|electorate|beehive|government|policy|budget|campaign|candidate|electoral commission|mmp|list)\b/i;
const txt = (v) => (v == null ? '' : Array.isArray(v) ? txt(v[0]) : typeof v === 'object' ? txt(v['#text'] ?? v['@_href'] ?? '') : String(v));
const linkOf = (it) => {
  const l = it.link;
  if (Array.isArray(l)) return (l.find((x) => x?.['@_href']) || {})['@_href'] || txt(l[0]);
  if (l && typeof l === 'object') return l['@_href'] || txt(l);
  return txt(l) || txt(it.guid) || txt(it.id);
};
let newsState = { items: [], fetchedAt: 0, sources: [] }, newsInflight = null;
export async function nzNews(limit = 60) {
  if (Date.now() - newsState.fetchedAt > 120_000) {
    newsInflight ||= (async () => {
      const sources = [];
      const all = [];
      await Promise.all(
        NZ_FEEDS.map(async (f) => {
          try {
            const xml = await getText(f.url);
            const items = parseFeed(xml)
              .map((it) => {
                const title = stripHtml(txt(it.title));
                const url = linkOf(it);
                const summary = stripHtml(txt(it.description ?? it.summary ?? it.content)).slice(0, 280);
                const publishedAt = Date.parse(txt(it.pubDate ?? it.published ?? it.updated ?? it['dc:date'])) || Date.now();
                if (!title || !url) return null;
                if (f.general && !POL_RE.test(`${title} ${summary}`)) return null;
                return { id: `nz-${Buffer.from(url).toString('base64url').slice(-16)}`, title, url, source: f.name, sourceLean: f.lean, publishedAt, summary, tags: ['nz', ...(/election|poll|vote/i.test(title) ? ['election'] : [])] };
              })
              .filter(Boolean);
            all.push(...items);
            sources.push({ name: f.name, url: f.url, lean: f.lean, ok: true, count: items.length });
          } catch (e) {
            sources.push({ name: f.name, url: f.url, lean: f.lean, ok: false, count: 0, error: String(e.message || e) });
          }
        }),
      );
      const seen = new Set();
      const items = all.filter((i) => (seen.has(i.url) ? false : seen.add(i.url))).sort((a, b) => b.publishedAt - a.publishedAt).slice(0, 200);
      newsState = { items, fetchedAt: Date.now(), sources };
    })().finally(() => (newsInflight = null));
    await Promise.race([newsInflight, new Promise((r) => setTimeout(r, 9000))]);
  }
  return { items: newsState.items.slice(0, limit), fetchedAt: newsState.fetchedAt, sources: newsState.sources };
}

/* ------------------------------------------------ API ------------------------------------------------ */
export async function nzApi(sub, params) {
  if (sub === '/results' || sub === '' || sub === '/') return { status: 200, body: await nzResults(), maxAge: 60 };
  if (sub === '/electorate') {
    const id = nzSlug(params.get('id') || '');
    if (!id) return { status: 400, body: { error: 'id required' } };
    return { status: 200, body: await nzElectorate(id), maxAge: 60 };
  }
  if (sub === '/news') return { status: 200, body: await nzNews(Math.min(200, Number(params.get('limit')) || 60)), maxAge: 120 };
  return { status: 404, body: { error: 'not found' } };
}

export async function nodeNzHandler(p, url, json, res) {
  const r = await nzApi(p.replace(/^\/api\/nz/, ''), url.searchParams);
  return json(res, r.status, r.body);
}

/* ------------------------------------------------ Ask PolTok loader ------------------------------------------------ */
/** Compact plain-text facts about the NZ election for the AI agent (live results if any, else status + news). */
export async function nzLoader() {
  const [r, n] = await Promise.all([nzResults().catch(() => null), nzNews(8).catch(() => null)]);
  const lines = [];
  if (!r || r.status === 'pre') lines.push(`NZ 2026 general election (Sat 7 Nov 2026; polls close 7:00pm NZDT = 06:00 UTC). No results published yet by the Electoral Commission (${NZ_RESULTS_BASE}).`);
  else {
    if (r.sourceKind === 'wikipedia') lines.push('WARNING: Electoral Commission site unreachable; figures below are UNOFFICIAL community-edited Wikipedia numbers.');
    lines.push(`NZ 2026 election — ${r.sourceKind === 'wikipedia' ? 'Wikipedia (unofficial, community-edited)' : 'Electoral Commission'} ${r.status === 'final' ? 'official' : 'preliminary'} results${r.votesCountedPct != null ? `, ${r.votesCountedPct}% counted` : ''} (source ${r.source}):`);
    for (const p of r.party.filter((x) => x.pct >= 0.5).slice(0, 9)) lines.push(`- ${p.name}: ${p.pct}% party vote, ${p.totalSeats} seats (${p.electorateSeats} electorate + ${p.listSeats} list)`);
    const close = r.electorates.filter((e) => e.margin > 0).sort((a, b) => a.margin - b.margin).slice(0, 6);
    if (close.length) lines.push(`Closest electorates: ${close.map((e) => `${e.name} (${e.leader}, ${e.leadingParty}, by ${e.margin})`).join('; ')}`);
  }
  for (const i of n?.items?.slice(0, 5) || []) lines.push(`News (${i.source}): ${i.title}`);
  return lines.join('\n');
}
