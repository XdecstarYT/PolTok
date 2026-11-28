// Election-night results reader for the 2026 Victorian state election, from the VEC's own public district results
// pages (same layout as the 2022 pages that scripts/gen-au-vic.py parses). VEC publishes no public JSON feed; these
// pages are what the public sees. Nothing is ever invented: a district with no published figures is simply absent.
// Output shape matches server/au.js parseResultsPayload: { status, seats: { [id]: { counted, tcp?, leader?, called?, fp? } } }.

const BASE = process.env.VEC_RESULTS_BASE || 'https://www.vec.vic.gov.au/results/state-election-results/2026-state-election-results/results-by-district/';
const UA = { 'user-agent': 'Mozilla/5.0 (PolTok results reader; +https://poltok.netlify.app)' };
const PARTY = [[/labor\b/i, 'ALP'], [/liberal(?! democrat)/i, 'LIB'], [/national/i, 'NAT'], [/greens/i, 'GRN'], [/one nation/i, 'ONP']];
const pcode = (p) => (!p ? 'IND' : PARTY.find(([re]) => re.test(p))?.[1] ?? 'OTH');
const ROW = /([A-Z][A-Z'’\- ]+), ([A-Z][^0-9]*?) ([\d,]+) ([\d.]+)%/g;
const PARTY_TAIL = / (Liberal|Australian|National|Victorian|Animal|Family|Freedom|Democratic|Legalise|Shooters|Libertarian|Reason|Sustainable|Health|Angry|New Democrats|Companions|Transport|United|Pauline|Labour|The Greens|Climate|Safety|Fusion).*$/;

const text = (html) => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").replace(/\s+/g, ' ');
const num = (s) => Number(String(s).replace(/,/g, ''));

function rows(seg) {
  const out = [];
  for (const g of seg.matchAll(ROW)) {
    const rest = g[2].trim();
    const pm = PARTY_TAIL.exec(' ' + rest);
    const party = pm ? pm[0].trim() : '';
    out.push({ name: `${(pm ? rest.slice(0, pm.index - 1) : rest).trim()} ${g[1].charAt(0)}${g[1].slice(1).toLowerCase()}`.trim(), party: pcode(party), v: num(g[3]), pct: Number(g[4]) });
  }
  return out;
}

const cellText = (x) => text(x).trim();
const nice = (raw) => { const [sur, giv] = raw.split(/,\s*/); const tc = (w) => w.toLowerCase().replace(/(^|[\s'’-])([a-z])/g, (m, a, b) => a + b.toUpperCase()); return giv ? `${giv.trim()} ${tc(sur.trim())}` : tc(raw.trim()); };
/** 2026 VEC layout: real <table>s with headed columns (Candidate / Party / votes / %), in either column order. */
function parseTables(html) {
  const out = { fp: [], tcp: [] };
  for (const tm of html.matchAll(/<table[\s\S]*?<\/table>/g)) {
    const t = tm[0];
    const heads = [...t.matchAll(/<th[\s\S]*?<\/th>/g)].map((h) => cellText(h[0]).toLowerCase());
    const col = (re) => heads.findIndex((h) => re.test(h));
    const ci = col(/^candidate/), pi = col(/^party/), vi = col(/votes$/), pc = col(/^%/);
    if (ci < 0 || vi < 0 || pc < 0) continue;
    const kind = heads.some((h) => /1st pref/.test(h)) ? 'fp' : heads.some((h) => /preferred votes/.test(h)) ? 'tcp' : null;
    if (!kind || out[kind].length) continue;
    for (const rm of t.matchAll(/<tr[\s\S]*?<\/tr>/g)) {
      const cells = [...rm[0].matchAll(/<td[\s\S]*?<\/td>/g)].map((c) => cellText(c[0]));
      if (cells.length < heads.length) continue;
      const v = num(cells[vi]), pct = Number(cells[pc].replace('%', ''));
      if (!Number.isFinite(v)) continue;
      out[kind].push({ name: nice(cells[ci]), party: pcode(pi >= 0 ? cells[pi] : ''), partyName: pi >= 0 ? cells[pi] : '', v, pct });
    }
  }
  const sc = /Successful candidate<\/h3>\s*<p>([\s\S]*?)<\/p>/i.exec(html);
  const winner = sc ? cellText(sc[1]) : '';
  out.elected = winner && !/will display here/i.test(winner) ? winner : null;
  return out;
}

/** Parse one district results page. Returns null when the page has no counted votes yet. */
export function parseDistrictPage(html) {
  const t = text(html);
  const enrol = num((/Total enrol(?:ment|led voters)[^:]*: ([\d,]+)/.exec(t) || [])[1] ?? NaN);
  const formal = num((/Formal votes: ([\d,]+)/.exec(t) || [])[1] ?? NaN);
  const informal = num((/Informal votes: ([\d,]+)/.exec(t) || [])[1] ?? NaN);
  const i = t.indexOf('First preference votes');
  const fp = i >= 0 ? rows(t.slice(i, (t.indexOf('Recheck', i) + 1 || t.indexOf('Two candidate', i) + 1 || t.length + 1) - 1)) : [];
  // finished seats: the preference distribution replaces the 2CP count; during counting: the 2CP table
  const pd = t.indexOf('Preference distribution results');
  const pdDone = pd >= 0 && /finished the preference distribution/i.test(t.slice(pd, pd + 200));
  const c = pdDone ? pd : t.indexOf('Two candidate preferred results Candidate');
  const end = t.indexOf('Distributions', c) > 0 ? t.indexOf('Distributions', c) : t.indexOf('Two candidate preferred results by', c);
  const tcpRows = c >= 0 ? rows(t.slice(c, end > c ? end : c + 600)) : [];
  const tb = /table-freeze-header-row|<th[^>]*>[\s\S]{0,120}1st pref/i.test(html) ? parseTables(html) : null;
  let elected = null;
  if (tb && (tb.fp.length || tb.tcp.length)) {
    fp.splice(0, fp.length, ...tb.fp);
    tcpRows.splice(0, tcpRows.length, ...(tb.tcp.some((r) => r.v > 0) ? tb.tcp : []));
    if (tb.elected) { const k = tb.elected.toLowerCase(); elected = tb.fp.find((r) => k.includes(r.name.split(' ').pop().toLowerCase()) && k.includes(r.name.split(' ')[0].toLowerCase())) ?? null; }
  }
  const fpVotes = fp.reduce((a, r) => a + r.v, 0);
  if (!fpVotes && !tcpRows.length) return null;
  const counted = Number.isFinite(enrol) && enrol > 0 ? +(((Number.isFinite(formal) ? formal : fpVotes) + (Number.isFinite(informal) ? informal : 0)) / enrol * 100).toFixed(1) : fpVotes;
  const seat = { counted, fp: fp.sort((a, b) => b.v - a.v).slice(0, 8).map((r) => ({ party: r.party, name: r.name, pct: r.pct })) };
  if (tcpRows.length >= 2) {
    const tcp = tcpRows.slice(0, 2).map((r) => ({ party: r.party, name: r.name, pct: r.pct })).sort((a, b) => b.pct - a.pct);
    seat.tcp = tcp; seat.leader = tcp[0].party;
    // conservative call: a big two-candidate lead with most of the roll counted, or the page says a candidate is elected
    if (pdDone || (typeof counted === 'number' && counted >= 55 && counted <= 100 && tcp[0].pct - tcp[1].pct >= 8)) seat.called = tcp[0].party;
    if (pdDone) seat.final = true;
  } else if (fp.length) {
    seat.leader = fp[0].party; // first-preference leader only; not a call
  }
  if (elected) { seat.called = elected.party; seat.leader = elected.party; seat.elected = elected.name; }
  return seat;
}

const ORIGIN = 'https://www.vec.vic.gov.au';
const BROWSER = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36 PolTok-results-reader' };
const get = (u, ms = 8000) => fetch(u, { headers: BROWSER, redirect: 'follow', signal: AbortSignal.timeout(ms) });
const hrefs = (html) => [...html.matchAll(/href="([^"#]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&')).filter((h) => !/readspeaker|^mailto:|^javascript:/i.test(h)).map((h) => (h.startsWith('//') ? 'https:' + h : h.startsWith('/') ? ORIGIN + h : h));
const YEAR = process.env.VEC_RESULTS_YEAR || '2026';
const DISTRICT = new RegExp(`${YEAR}[^"]*?\\/([a-z0-9-]+)-district(?:-results)?\\/?$`, 'i');

/** Find the published 2026 district result pages wherever the VEC put them: env override, the expected address, or by
 *  following 2026 result links from the VEC results hub. Returns { slug: url } (empty until the VEC publishes). */
export async function discoverDistrictLinks() {
  const found = {};
  const take = (list) => { for (const h of list) { const m = DISTRICT.exec(h); if (m && /result/i.test(h)) found[m[1].toLowerCase()] ??= h; } };
  const seen = new Set();
  const visit = async (u) => { if (seen.has(u) || seen.size > 12) return ''; seen.add(u); try { const r = await get(u); return r.ok ? await r.text() : ''; } catch { return ''; } };
  const firstPass = [BASE, ORIGIN + '/results/state-election-results', ORIGIN + '/results', ORIGIN + `/voting/${YEAR}-state-election`];
  const next = [];
  for (const u of firstPass) {
    const html = await visit(u);
    if (!html) continue;
    const hs = hrefs(html); take(hs);
    for (const h of hs) if (h.includes(YEAR) && /result/i.test(h) && h.startsWith(ORIGIN) && !DISTRICT.test(h)) next.push(h);
    if (Object.keys(found).length >= 80) return found;
  }
  for (const u of [...new Set(next)].slice(0, 8)) { take(hrefs(await visit(u))); if (Object.keys(found).length >= 80) break; }
  return found;
}

/** Fetch every district page (bounded concurrency). ids: ['vic-albert-park', …]. */
export async function fetchVecDistricts(ids, { concurrency = 10, timeoutMs = 8000, links = null } = {}) {
  const seats = {}; let ok = 0, missing = 0, failed = 0;
  const queue = [...ids];
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (queue.length) {
      const id = queue.shift();
      const slug = id.replace(/^vic-/, '');
      const url = links?.[slug] ?? links?.[slug.toLowerCase()] ?? BASE + slug + '-district-results';
      try {
        const r = await get(url, timeoutMs);
        if (r.status === 404) { missing++; continue; }
        if (!r.ok) { failed++; continue; }
        const s = parseDistrictPage(await r.text());
        if (s) { seats[id] = s; ok++; } else missing++;
      } catch { failed++; }
    }
  }));
  const called = Object.values(seats).filter((s) => s.called).length;
  return { status: called === ids.length ? 'final' : 'counting', updatedAt: Date.now(), source: 'Victorian Electoral Commission district results pages', seats, stats: { ok, missing, failed, discovered: links ? Object.keys(links).length : 0 } };
}

/** Diff two snapshots into feed events: a new leader, a seat called, or first results in. Pure (testable). */
export function diffResults(prev, next, at = Date.now()) {
  const ev = [];
  for (const [id, s] of Object.entries(next?.seats ?? {})) {
    const p = prev?.seats?.[id];
    if (s.called && s.called !== p?.called) ev.push({ at, id, kind: 'called', party: s.called, prev: p?.called ?? p?.leader ?? null });
    else if (!p && s.leader) ev.push({ at, id, kind: 'first', party: s.leader });
    else if (p && s.leader && p.leader && s.leader !== p.leader && !s.called) ev.push({ at, id, kind: 'lead', party: s.leader, prev: p.leader });
  }
  return ev;
}
