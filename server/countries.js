// Country profiles for /api/world/country?code=GB and /api/world/countries.
//   - Head of government / head of state + their offices: Wikidata SPARQL (P6, P35, P1313, P1906),
//     countries and chambers resolved from their English Wikipedia sitelinks (no hard-coded QIDs).
//   - Lower-house seat total: Wikidata P1342.
//   - Seats by party: the chamber's English Wikipedia infobox "Political groups" (rendered via the
//     parse API section 0). Wikidata's P1410 party-seat statements were checked and are mostly
//     undated/stale, so they are not used for composition. If the parsed parties do not sum to the
//     Wikidata total the composition is flagged `uncertain`.
//   - Polymarket: gamma public-search by country name; only active events whose title names the country.
// Everything is cited in `sources`; cached 6 h (markets 10 min); stale copy served on failure.
import { COUNTRY_TERMS } from './world-news.js';

const UA = 'PolTok/1.0 (https://poltok.netlify.app; country profiles) node-fetch';
const TTL = 6 * 3600e3;

/** code, display name, enwiki country title, enwiki lower/unicameral chamber title, calendar names. */
export const COUNTRIES = [
  ['US', 'United States', 'United States', 'United States House of Representatives'],
  ['GB', 'United Kingdom', 'United Kingdom', 'House of Commons of the United Kingdom'],
  ['CA', 'Canada', 'Canada', 'House of Commons of Canada'],
  ['AU', 'Australia', 'Australia', 'Australian House of Representatives'],
  ['NZ', 'New Zealand', 'New Zealand', 'New Zealand House of Representatives'],
  ['IE', 'Ireland', 'Republic of Ireland', 'Dáil Éireann'],
  ['FR', 'France', 'France', 'National Assembly (France)'],
  ['DE', 'Germany', 'Germany', 'Bundestag'],
  ['IT', 'Italy', 'Italy', 'Chamber of Deputies (Italy)'],
  ['ES', 'Spain', 'Spain', 'Congress of Deputies'],
  ['PT', 'Portugal', 'Portugal', 'Assembly of the Republic (Portugal)'],
  ['NL', 'Netherlands', 'Netherlands', 'House of Representatives (Netherlands)'],
  ['BE', 'Belgium', 'Belgium', 'Chamber of Representatives (Belgium)'],
  ['AT', 'Austria', 'Austria', 'National Council (Austria)'],
  ['CH', 'Switzerland', 'Switzerland', 'National Council (Switzerland)'],
  ['SE', 'Sweden', 'Sweden', 'Riksdag'],
  ['NO', 'Norway', 'Norway', 'Storting'],
  ['DK', 'Denmark', 'Denmark', 'Folketing'],
  ['FI', 'Finland', 'Finland', 'Parliament of Finland'],
  ['PL', 'Poland', 'Poland', 'Sejm'],
  ['CZ', 'Czech Republic', 'Czech Republic', 'Chamber of Deputies (Czech Republic)'],
  ['SK', 'Slovakia', 'Slovakia', 'National Council (Slovakia)'],
  ['GR', 'Greece', 'Greece', 'Hellenic Parliament'],
  ['HU', 'Hungary', 'Hungary', 'National Assembly (Hungary)'],
  ['RO', 'Romania', 'Romania', 'Chamber of Deputies (Romania)'],
  ['EE', 'Estonia', 'Estonia', 'Riigikogu'],
  ['UA', 'Ukraine', 'Ukraine', 'Verkhovna Rada'],
  ['IL', 'Israel', 'Israel', 'Knesset'],
  ['JP', 'Japan', 'Japan', 'House of Representatives (Japan)'],
  ['KR', 'South Korea', 'South Korea', 'National Assembly (South Korea)'],
  ['TW', 'Taiwan', 'Taiwan', 'Legislative Yuan'],
  ['IN', 'India', 'India', 'Lok Sabha'],
  ['ID', 'Indonesia', 'Indonesia', 'House of Representatives (Indonesia)'],
  ['PH', 'Philippines', 'Philippines', 'House of Representatives of the Philippines'],
  ['ZA', 'South Africa', 'South Africa', 'National Assembly of South Africa'],
  ['BR', 'Brazil', 'Brazil', 'Chamber of Deputies (Brazil)'],
  ['AR', 'Argentina', 'Argentina', 'Argentine Chamber of Deputies'],
  ['MX', 'Mexico', 'Mexico', 'Chamber of Deputies (Mexico)'],
  ['CL', 'Chile', 'Chile', 'Chamber of Deputies of Chile'],
  ['CO', 'Colombia', 'Colombia', 'Chamber of Representatives of Colombia'],
].map(([code, name, wiki, chamber]) => ({ code, name, wiki, chamber }));
const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

/* ------------------------------ fetch & cache ------------------------------ */
const cache = new Map();
async function cached(key, ttl, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.value;
  try {
    const value = await fn();
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch (e) {
    if (hit) return { ...hit.value, stale: true };
    throw e;
  }
}
async function getJson(url, timeout = 15000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { 'user-agent': UA, 'api-user-agent': UA, accept: 'application/sparql-results+json, application/json' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}
const wikiUrl = (t) => `https://en.wikipedia.org/wiki/${encodeURIComponent(t.replace(/ /g, '_'))}`;
const qid = (u) => (u ? String(u).replace('http://www.wikidata.org/entity/', '') : undefined);
const lit = (s) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"@en`;
const sparql = (q) => getJson(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(q)}`, 25000).then((j) => j.results.bindings);

/** One SPARQL for all countries: heads of government/state, their offices, chamber QID + seat total. */
async function wikidataAll() {
  return cached('wd:all', TTL, async () => {
    const q = `SELECT ?t ?c ?hog ?hogLabel ?hos ?hosLabel ?hogPosLabel ?hosPosLabel ?ct ?ch ?total WHERE {
  { VALUES ?t { ${COUNTRIES.map((c) => lit(c.wiki)).join(' ')} }
    ?a schema:about ?c ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?t .
    OPTIONAL { ?c wdt:P6 ?hog } OPTIONAL { ?c wdt:P35 ?hos }
    OPTIONAL { ?c wdt:P1313 ?hogPos } OPTIONAL { ?c wdt:P1906 ?hosPos } }
  UNION
  { VALUES ?ct { ${COUNTRIES.map((c) => lit(c.chamber)).join(' ')} }
    ?b schema:about ?ch ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?ct .
    OPTIONAL { ?ch wdt:P1342 ?total } }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul". }
}`;
    const rows = await sparql(q);
    const byWiki = new Map();
    const chambers = new Map();
    const add = (arr, v) => v && !arr.some((x) => x.qid === v.qid) && arr.push(v);
    for (const r of rows) {
      if (r.t) {
        const k = r.t.value;
        const o = byWiki.get(k) || { qid: qid(r.c?.value), hog: [], hos: [], hogOffice: r.hogPosLabel?.value, hosOffice: r.hosPosLabel?.value };
        if (r.hog) add(o.hog, { qid: qid(r.hog.value), name: r.hogLabel?.value });
        if (r.hos) add(o.hos, { qid: qid(r.hos.value), name: r.hosLabel?.value });
        o.hogOffice ||= r.hogPosLabel?.value;
        o.hosOffice ||= r.hosPosLabel?.value;
        byWiki.set(k, o);
      } else if (r.ct) {
        const k = r.ct.value;
        const o = chambers.get(k) || { qid: qid(r.ch?.value), totals: [] };
        if (r.total) o.totals.push(Number(r.total.value));
        chambers.set(k, o);
      }
    }
    // Fill labels the SPARQL label service left as bare QIDs (happens when one item binds twice).
    const missing = [...new Set([...byWiki.values()].flatMap((o) => [...o.hog, ...o.hos]).filter((p) => !p.name || /^Q\d+$/.test(p.name)).map((p) => p.qid))];
    if (missing.length) {
      try {
        const j = await getJson(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${missing.slice(0, 50).join('|')}&props=labels&languages=en|mul&format=json`);
        for (const o of byWiki.values()) for (const p of [...o.hog, ...o.hos]) { const lb = j.entities?.[p.qid]?.labels; const v = lb?.en || lb?.mul; if (v) p.name = v.value; }
      } catch {}
    }
    return { byWiki: Object.fromEntries(byWiki), chambers: Object.fromEntries(chambers), fetchedAt: Date.now() };
  });
}

/* ------------------------------ infobox composition ------------------------------ */
const decode = (s) =>
  s
    .replace(/&#160;|&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));

/** Parse the rendered infobox "Political groups" cell into leaf parties [{name, seats, color}]. */
export function parseGroups(html) {
  const m = html.match(/>\s*Political groups\s*(?:<\/div>)?\s*<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/i);
  if (!m) return [];
  const cell = m[1].replace(/<sup[\s\S]*?<\/sup>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
  const raw = [];
  // Track list nesting depth so coalitions / parliamentary groups listed above their member
  // parties can be dropped in favour of the leaf entries.
  let depth = 0;
  for (const l of cell.split(/(?=<dd|<li|<br|<p>|<b>)|\n/)) {
    const lineDepth = depth;
    depth += (l.match(/<(?:dl|ul|ol)\b/g) || []).length - (l.match(/<\/(?:dl|ul|ol)>/g) || []).length;
    const color = (l.match(/background(?:-color)?:\s*(#[0-9a-fA-F]{3,8}|[a-z]+)/) || [])[1];
    const tx = decode(l.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
    const mm = tx.match(/^(.*?)\s*[([]\s*(\d{1,4})\s*(?:seats?|members?|MPs)?\s*[)\]]\s*$/i) || tx.match(/^(.*?):\s*(\d{1,4})\s*(?:seats?)?$/i);
    if (mm && mm[1] && !/^\d+$/.test(mm[1]))
      raw.push({ name: mm[1].replace(/[:–-]\s*$/, '').trim(), seats: Number(mm[2]), color: color && color !== 'transparent' ? color : undefined, bold: /<b>/.test(l), depth: Math.max(lineDepth, depth) });
  }
  const out = [];
  for (let i = 0; i < raw.length; i++) {
    const r = raw[i];
    if (r.bold && !r.color) continue; // Government / Opposition block headers
    const next = raw[i + 1];
    if (next && next.depth > r.depth) {
      // aggregate when its deeper children add up to it
      let s = 0;
      for (let j = i + 1; j < raw.length && raw[j].depth > r.depth; j++) if (raw[j].depth === next.depth) s += raw[j].seats;
      if (s === r.seats) continue;
    }
    out.push({ name: r.name, seats: r.seats, color: r.color });
  }
  return out.filter((p) => p.seats > 0);
}

async function composition(chamber) {
  return cached(`comp:${chamber}`, TTL, async () => {
    try {
      const j = await getJson(`https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(chamber)}&prop=text|revid&section=0&format=json&formatversion=2&redirects=1`);
      if (!j.parse?.text) throw new Error('no parse');
      return { parties: parseGroups(j.parse.text), revid: j.parse.revid, title: j.parse.title, fetchedAt: Date.now() };
    } catch {
      // Action API rate-limits shared IPs; the REST page HTML is served from cache.
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 15000);
      try {
        const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(chamber.replace(/ /g, '_'))}`, { signal: ctl.signal, headers: { 'user-agent': UA, 'api-user-agent': UA } });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return { parties: parseGroups(await r.text()), revid: Number(r.headers.get('etag')?.match(/\d+/)?.[0]) || undefined, title: chamber, fetchedAt: Date.now() };
      } finally {
        clearTimeout(t);
      }
    }
  });
}

/* ------------------------------ Polymarket ------------------------------ */
async function markets(c) {
  return cached(`pm:${c.code}`, 10 * 60e3, async () => {
    const terms = [c.name, ...(COUNTRY_TERMS[c.code] || []).slice(0, 2)];
    const re = new RegExp(`\\b(?:${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'i');
    const j = await getJson(`https://gamma-api.polymarket.com/public-search?q=${encodeURIComponent(c.name)}&limit_per_type=20&events_status=active&keep_closed_markets=0`, 10000);
    const events = (j.events || []).filter((e) => !e.closed && re.test(e.title || ''));
    return events.slice(0, 8).map((e) => {
      const ms = (e.markets || [])
        .filter((m) => !m.closed && m.outcomePrices)
        .map((m) => {
          let p = null;
          try {
            p = Number(JSON.parse(m.outcomePrices)[0]);
          } catch {}
          return { label: m.groupItemTitle || m.question, yes: Number.isFinite(p) ? p : null };
        })
        .filter((m) => m.yes != null)
        .sort((a, b) => b.yes - a.yes)
        .slice(0, 4);
      return { title: e.title, url: `https://polymarket.com/event/${e.slug}`, volume: Math.round(Number(e.volume) || 0), endDate: e.endDate || null, markets: ms };
    });
  });
}

/* ------------------------------ API ------------------------------ */
export async function countryProfile(code) {
  const c = BY_CODE.get(code);
  if (!c) return null;
  const notes = [];
  const [wd, comp, pm] = await Promise.allSettled([wikidataAll(), composition(c.chamber), markets(c)]);
  const w = wd.status === 'fulfilled' ? wd.value : null;
  if (!w) notes.push(`Wikidata query failed (${String(wd.reason?.message || wd.reason).slice(0, 80)}).`);
  const info = w?.byWiki[c.wiki];
  const ch = w?.chambers[c.chamber];
  const total = ch?.totals.length ? Math.max(...ch.totals) : null;
  let parties = comp.status === 'fulfilled' ? comp.value.parties : [];
  if (comp.status !== 'fulfilled') notes.push(`Wikipedia infobox could not be fetched (${String(comp.reason?.message || comp.reason).slice(0, 80)}); party composition unavailable.`);
  const sum = parties.reduce((a, p) => a + p.seats, 0);
  let uncertain = !parties.length;
  if (parties.length && total && sum !== total) {
    uncertain = true;
    notes.push(`Parsed party seats sum to ${sum}, Wikidata lists ${total} seats — composition may be incomplete or include vacancies; verify on Wikipedia.`);
  }
  if (parties.length && !total) uncertain = true;
  if (info && (info.hog.length > 1 || info.hos.length > 1)) notes.push('Wikidata lists more than one current office-holder; showing all.');
  return {
    code: c.code,
    name: c.name,
    qid: info?.qid,
    headOfGovernment: info ? { office: info.hogOffice || 'Head of government', people: info.hog } : null,
    headOfState: info ? { office: info.hosOffice || 'Head of state', people: info.hos } : null,
    legislature: {
      chamber: c.chamber,
      qid: ch?.qid,
      totalSeats: total,
      parties,
      uncertain,
      url: wikiUrl(c.chamber),
      revid: comp.status === 'fulfilled' ? comp.value.revid : undefined,
    },
    markets: pm.status === 'fulfilled' ? pm.value : [],
    marketsOk: pm.status === 'fulfilled',
    sources: [
      { name: 'Wikidata (CC0) — office holders & seat totals', url: info?.qid ? `https://www.wikidata.org/wiki/${info.qid}` : 'https://query.wikidata.org/' },
      { name: `Wikipedia (CC BY-SA) — ${c.chamber} infobox`, url: wikiUrl(c.chamber) },
      { name: 'Polymarket gamma API', url: `https://polymarket.com/search?q=${encodeURIComponent(c.name)}` },
    ],
    notes,
    fetchedAt: Date.now(),
  };
}

export const countryList = () => COUNTRIES.map(({ code, name }) => ({ code, name }));
