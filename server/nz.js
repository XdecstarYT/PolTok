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

/* ------------------------------------------------ helpers ------------------------------------------------ */
export const nzSlug = (s) =>
  String(s || '')
    .replace(/\bMount\b/, 'Mt')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const ent = (s) =>
  String(s || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&rsquo;|&#8217;/g, '’')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/\s+/g, ' ')
    .trim();
const num = (s) => {
  const t = ent(s).replace(/,/g, '');
  if (!t || t === '-') return 0;
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : 0;
};

// Party name or EC abbreviation → PolTok party code.
const CODES = [
  [/^(NAT|National)/i, 'NAT'],
  [/^(LAB|Labour)/i, 'LAB'],
  [/^(GP|GRN|Green)/i, 'GRN'],
  [/^(ACT)\b/i, 'ACT'],
  [/^(NZF|New Zealand First)/i, 'NZF'],
  [/^(TPMAO|TPM|MAOR|Te P[aā]ti M[aā]ori|M[aā]ori Party)/i, 'TPM'],
  [/^(TOP|OPP|The Opportunit|Opportunit)/i, 'OPP'],
  [/^(IND|Independent)/i, 'IND'],
];
export function partyCode(name) {
  const n = String(name || '').trim();
  if (!n) return 'IND';
  for (const [re, c] of CODES) if (re.test(n)) return c;
  return n;
}

function statusOf(html) {
  const h = ent((html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i) || [])[1] || '');
  if (/official result/i.test(h)) return { status: 'final', heading: h };
  return { status: 'counting', heading: h };
}
function countedPct(html) {
  const t = ent(html);
  const m =
    t.match(/([\d.]+)\s*%\s*(?:of\s+)?(?:voting places|votes)?\s*(?:counted|reported|reporting)/i) ||
    t.match(/(?:counted|reported|reporting)[^%\d]{0,40}?(?:[\d,]+\s+)?([\d.]+)\s*%/i);
  return m ? Math.min(100, parseFloat(m[1])) : null;
}

/* ------------------------------------------------ parsers ------------------------------------------------ */
/** index.html → nationwide party table. */
export function parsePartyPage(html) {
  const table = (html.match(/<table[^>]*id="overall-results-table"[\s\S]*?<\/table>/i) || [])[0];
  if (!table) return null;
  const party = [];
  for (const row of table.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || []) {
    if (/text-indent/.test(row) || /<th/i.test(row)) continue; // component parties of a combined list
    const cells = (row.match(/<td[^>]*>[\s\S]*?<\/td>/gi) || []).map((c) => c);
    if (cells.length < 6) continue;
    const name = ent(cells[0]);
    if (!name || /^total/i.test(name)) continue;
    const votes = num(cells[1]);
    const e = num(cells[3]), l = num(cells[4]);
    party.push({ party: partyCode(name), name, votes, pct: num(cells[2]), electorateSeats: e, listSeats: l, totalSeats: num(cells[5]) || e + l });
  }
  return { ...statusOf(html), votesCountedPct: countedPct(html), party };
}

/** electorate-status.html → one row per electorate. */
export function parseStatusPage(html) {
  const table = (html.match(/<table[^>]*id="electorate-status-table"[\s\S]*?<\/table>/i) || [])[0];
  if (!table) return null;
  const out = [];
  for (const row of table.match(/<tr[^>]*id="electorate-row-\d+"[\s\S]*?<\/tr>/gi) || []) {
    const link = row.match(/href="\.?\/?(electorate-details-\d+\.html)"[^>]*>([\s\S]*?)<\/a>/i);
    const cells = (row.match(/<td[^>]*>[\s\S]*?<\/td>/gi) || []).map((c) => ent(c.replace(/<span class="mobile-show[^"]*"[^>]*>[\s\S]*?<\/span>/gi, '')));
    if (!link || cells.length < 4) continue;
    const name = ent(link[2]);
    const cand = (s) => {
      const m = s.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
      return m ? { name: m[1].trim(), party: partyCode(m[2]) } : { name: s, party: 'IND' };
    };
    const lead = cand(cells[1]), second = cand(cells[2]);
    const pctCell = cells.slice(3).find((c) => /%/.test(c));
    out.push({
      id: nzSlug(name),
      name,
      href: link[1],
      leader: lead.name || null,
      leadingParty: lead.name ? lead.party : null,
      second: second.name || null,
      secondParty: second.name ? second.party : null,
      margin: num(cells[3]),
      countedPct: pctCell ? parseFloat(pctCell) : null,
    });
  }
  return { ...statusOf(html), electorates: out };
}

/** electorate-details-NN.html → full candidate + party-vote tables. */
export function parseDetailsPage(html) {
  const st = statusOf(html);
  const name = st.heading.replace(/\s*-\s*(Official|Preliminary|Progress)[\s\S]*$/i, '').trim();
  const summary = (html.match(/<table[^>]*id="electorate_details_table"[\s\S]*?<\/table>/i) || [])[0] || '';
  const sRows = (summary.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || []).map((r) => (r.match(/<td[^>]*>[\s\S]*?<\/td>/gi) || []).map(ent));
  const counted = sRows.find((r) => /VOTES COUNTED/i.test(r[0] || ''));
  const body = (html.match(/<table[^>]*id="partyCandidatesResultsTable"[\s\S]*?<\/table>/i) || [])[0];
  if (!body) return null;
  const candidates = [], partyVotes = [];
  let candInformal = 0, partyInformal = 0;
  for (const row of body.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || []) {
    const tds = row.match(/<td[^>]*>[\s\S]*?<\/td>/gi) || [];
    if (tds.length < 2) continue;
    const pair = (td) => {
      const spans = td.match(/<span[^>]*>[\s\S]*?<\/span>/gi) || [];
      const label = ent((td.match(/<label[^>]*>([\s\S]*?)<\/label>/i) || [])[1] || '');
      return { label, name: ent(spans[0] || ''), votes: num(spans[1] || '') };
    };
    const c = pair(tds[0]), p = pair(tds[1]);
    if (/informal/i.test(c.label)) { candInformal = num(tds[0].match(/<span[^>]*>([\s\S]*?)<\/span>/i)?.[1]); partyInformal = num(tds[1].match(/<span[^>]*>([\s\S]*?)<\/span>/i)?.[1]); continue; }
    if (c.label || p.label) continue; // totals
    // Each candidate row is paired with their own party in the same row (blank = independent).
    if (c.name) candidates.push({ name: c.name, party: p.name ? partyCode(p.name) : 'IND', partyName: p.name || 'Independent', votes: c.votes });
    if (p.name) partyVotes.push({ party: partyCode(p.name), name: p.name, votes: p.votes });
  }
  candidates.sort((a, b) => b.votes - a.votes);
  partyVotes.sort((a, b) => b.votes - a.votes);
  const lead = candidates[0], second = candidates[1];
  return {
    ...st,
    id: nzSlug(name),
    name,
    votesCounted: counted ? num(counted[1]) : null,
    countedPct: counted ? num(counted[2]) : null,
    leader: lead?.name ?? null,
    leadingParty: lead?.party ?? null,
    margin: lead && second ? lead.votes - second.votes : null,
    candidates,
    partyVotes,
    informal: { candidate: candInformal, party: partyInformal },
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
  pollsClose: NZ_POLLS_CLOSE,
  error,
});

/** Fetch + combine index.html and electorate-status.html. */
export async function fetchNzResults({ base = NZ_RESULTS_BASE, fetchImpl = fetch } = {}) {
  let idx, sts;
  try {
    [idx, sts] = await Promise.all([getText(base + 'index.html', fetchImpl), getText(base + 'electorate-status.html', fetchImpl).catch(() => '')]);
  } catch (e) {
    return pre(`No results published yet (${e.message}). Results stream from 7:00pm NZDT.`);
  }
  const p = parsePartyPage(idx);
  const s = sts ? parseStatusPage(sts) : null;
  if (!p || !p.party.length || p.party.every((x) => !x.votes)) return pre('Results page reachable but no votes reported yet.');
  const totalVotes = p.party.reduce((a, x) => a + x.votes, 0);
  return {
    status: p.status,
    heading: p.heading,
    updatedAt: Date.now(),
    votesCountedPct: p.votesCountedPct ?? (p.status === 'final' ? 100 : null),
    totalVotes,
    party: p.party.map(({ name, ...x }) => ({ ...x, name })),
    electorates: (s?.electorates || []).map(({ href, ...x }) => ({ ...x, type: MAORI.has(x.id) ? 'maori' : 'general', candidates: [] })),
    source: base,
    pollsClose: NZ_POLLS_CLOSE,
  };
}
const MAORI = new Set(['hauraki-waikato', 'ikaroa-rawhiti', 'tamaki-makaurau', 'te-tai-hauauru', 'te-tai-tokerau', 'te-tai-tonga', 'waiariki']);

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
    lines.push(`NZ 2026 election — Electoral Commission ${r.status === 'final' ? 'official' : 'preliminary'} results${r.votesCountedPct != null ? `, ${r.votesCountedPct}% counted` : ''} (source ${r.source}):`);
    for (const p of r.party.filter((x) => x.pct >= 0.5).slice(0, 9)) lines.push(`- ${p.name}: ${p.pct}% party vote, ${p.totalSeats} seats (${p.electorateSeats} electorate + ${p.listSeats} list)`);
    const close = r.electorates.filter((e) => e.margin > 0).sort((a, b) => a.margin - b.margin).slice(0, 6);
    if (close.length) lines.push(`Closest electorates: ${close.map((e) => `${e.name} (${e.leader}, ${e.leadingParty}, by ${e.margin})`).join('; ')}`);
  }
  for (const i of n?.items?.slice(0, 5) || []) lines.push(`News (${i.source}): ${i.title}`);
  return lines.join('\n');
}
