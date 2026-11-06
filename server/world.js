// World elections hub API (agent 1 / WORLD). Shared by the Node server (server/index.js) and the
// Netlify function (netlify/functions/world.mjs) — same JSON either way.
//
//   GET /api/world/elections          { elections: WorldElection[], source, fetchedAt, asOf, live, notes[] }
//   GET /api/world/news?country=GB     server/world-news.js (international RSS, country-tagged)
//   GET /api/world/country?code=GB    server/countries.js (Wikidata + Wikipedia infobox + Polymarket)
//   GET /api/world/summary?title=...  { title, extract, url, thumbnail?, updated }   (Wikipedia REST summary)
//
// Live source (keyless, verified 2026-11-05): English Wikipedia "{year} national electoral calendar"
// pages, read as raw wikitext via index.php?action=raw (the MediaWiki action API rate-limits shared
// IPs hard, the raw endpoint is served from the page cache). Cached 6 h in memory; on failure we
// serve the last good copy, then the bundled snapshot src/features/world/fallback.json (as-of dated).
// Never fabricates: everything comes from the calendar wikitext or the article's own summary.
import fallback from '../src/features/world/fallback.json' with { type: 'json' };

const UA = 'PolTok/1.0 (https://poltok.netlify.app; elections hub) node-fetch';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const TTL = 6 * 3600e3;

/* ------------------------------ regions ------------------------------ */
const R = {
  Africa: 'Algeria Angola Benin Botswana Burkina_Faso Burundi Cameroon Cape_Verde Central_African_Republic Chad Comoros Republic_of_the_Congo Democratic_Republic_of_the_Congo Djibouti Egypt Equatorial_Guinea Eritrea Eswatini Ethiopia Gabon Gambia Ghana Guinea Guinea-Bissau Ivory_Coast Kenya Lesotho Liberia Libya Madagascar Malawi Mali Mauritania Mauritius Morocco Mozambique Namibia Niger Nigeria Rwanda São_Tomé_and_Príncipe Senegal Seychelles Sierra_Leone Somalia Somaliland South_Africa South_Sudan Sudan Tanzania Togo Tunisia Uganda Zambia Zimbabwe Western_Sahara Saint_Helena',
  Americas: 'Antigua_and_Barbuda Argentina Bahamas Barbados Belize Bolivia Brazil Canada Chile Colombia Costa_Rica Cuba Dominica Dominican_Republic Ecuador El_Salvador Grenada Guatemala Guyana Haiti Honduras Jamaica Mexico Nicaragua Panama Paraguay Peru Saint_Kitts_and_Nevis Saint_Lucia Saint_Vincent_and_the_Grenadines Suriname Trinidad_and_Tobago United_States Uruguay Venezuela Bermuda Cayman_Islands Puerto_Rico Greenland Falkland_Islands Aruba Curaçao Sint_Maarten Anguilla Montserrat British_Virgin_Islands Turks_and_Caicos_Islands',
  Asia: 'Afghanistan Bangladesh Bhutan Brunei Cambodia China Hong_Kong India Indonesia Japan Kazakhstan Kyrgyzstan Laos Malaysia Maldives Mongolia Myanmar Nepal North_Korea Pakistan Philippines Singapore South_Korea Sri_Lanka Taiwan Tajikistan Thailand Timor-Leste East_Timor Turkmenistan Uzbekistan Vietnam Macau',
  'Middle East': 'Bahrain Iran Iraq Israel Jordan Kuwait Lebanon Oman Palestine Qatar Saudi_Arabia Syria Turkey United_Arab_Emirates Yemen',
  Europe: 'Albania Andorra Armenia Austria Azerbaijan Belarus Belgium Bosnia_and_Herzegovina Bulgaria Croatia Cyprus Northern_Cyprus Czech_Republic Denmark Estonia Finland France Georgia Germany Greece Hungary Iceland Ireland Italy Kosovo Latvia Liechtenstein Lithuania Luxembourg Malta Moldova Monaco Montenegro Netherlands North_Macedonia Norway Poland Portugal Romania Russia San_Marino Serbia Slovakia Slovenia Spain Sweden Switzerland Ukraine United_Kingdom Isle_of_Man Jersey Guernsey Gibraltar Faroe_Islands Åland South_Ossetia Abkhazia Transnistria Artsakh',
  Oceania: 'Australia Fiji Kiribati Marshall_Islands Micronesia Nauru New_Zealand Palau Papua_New_Guinea Samoa Solomon_Islands Tonga Tuvalu Vanuatu Cook_Islands Niue Bougainville New_Caledonia French_Polynesia Tokelau American_Samoa Guam Northern_Mariana_Islands Norfolk_Island Wallis_and_Futuna',
};
const REGION = new Map();
for (const [reg, list] of Object.entries(R)) for (const c of list.split(' ')) REGION.set(c.replace(/_/g, ' ').toLowerCase(), reg);
const ALIAS = { 'the gambia': 'gambia', "côte d'ivoire": 'ivory coast', 'cabo verde': 'cape verde', 'czechia': 'czech republic', 'federated states of micronesia': 'micronesia', 'congo': 'republic of the congo', 'dr congo': 'democratic republic of the congo', 'the bahamas': 'bahamas' };
export const regionOf = (country) => {
  let k = country.toLowerCase().trim();
  k = ALIAS[k] || k;
  return REGION.get(k) || REGION.get(k.replace(/^the /, '')) || 'Other';
};

/* ------------------------------ parsing ------------------------------ */
const stripRefs = (s) =>
  s
    .replace(/<ref[^>]*\/>/g, '')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '')
    .replace(/\{\{[^{}]*\}\}/g, '')
    .replace(/<!--[\s\S]*?-->/g, '');
const links = (s) => [...s.matchAll(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g)].map((m) => ({ title: m[1].trim(), text: (m[2] || m[1]).trim() }));
const plain = (s) => s.replace(/\[\[(?:[^\]|]+\|)?([^\]]+)\]\]/g, '$1').replace(/''+/g, '').replace(/\s+/g, ' ').trim();
const wikiUrl = (t) => `https://en.wikipedia.org/wiki/${encodeURIComponent(t.replace(/ /g, '_'))}`;

export function classify(office) {
  const o = office.toLowerCase();
  if (/referend|plebiscite/.test(o)) return 'referendum';
  const exec = /president|supreme leader|federal council|governor|vice president|presidency/.test(o);
  const leg = /parliament|assembly|congress|senate|house|chamber|duma|knesset|kurultai|council of states|council|keys|diet|majlis|sejm|riigikogu|bundestag|cortes|legislat|deputies|national council|lok sabha|rajya/.test(o.replace(/federal council|council of states/g, (m) => (m === 'council of states' ? 'legislat' : m)));
  if (exec && leg && !/presidency of/.test(o)) return 'general';
  if (exec) return 'presidential';
  return 'legislative';
}

/** Parse one "{year} national electoral calendar" wikitext page. */
export function parseCalendar(wikitext, year) {
  const out = [];
  let section = '';
  let pendingDate = null;
  for (const raw of stripRefs(wikitext).split('\n')) {
    const line = raw.trim();
    const h = line.match(/^==\s*([^=]+?)\s*==$/);
    if (h) {
      section = h[1];
      pendingDate = null;
      continue;
    }
    const isMonth = MONTHS.includes(section);
    const indirect = /indirect/i.test(section);
    const unknown = /unknown/i.test(section);
    if (!isMonth && !indirect && !unknown) continue;
    let m = line.match(/^\*(?!\*)\s*(.*)$/);
    let dateLabel;
    let body;
    if (m) {
      const parts = m[1].match(/^([^[\]:]{2,60}):\s*(.*)$/);
      if (parts && !unknown) {
        dateLabel = parts[1].trim();
        body = parts[2];
        if (!body.trim()) {
          pendingDate = dateLabel;
          continue;
        }
        pendingDate = null;
      } else body = m[1];
    } else if ((m = line.match(/^\*\*\s*(.*)$/)) && pendingDate) {
      dateLabel = pendingDate;
      body = m[1];
    } else continue;
    const ls = links(body);
    if (!ls.length) continue;
    const dependent = /^''/.test(body.trim());
    const country = ls[0].text.replace(/[,\s]+$/, '').trim();
    const offLinks = ls.slice(1);
    const afterCountry = body.slice(body.indexOf(']]') + 2);
    const office = plain(afterCountry).replace(/^[,\s]+/, '').replace(/[,\s]+$/, '') || offLinks.map((l) => l.text).join(', ');
    // date: first "D Month" or "D–D Month" or bare "Month"
    let date = null;
    let approx = false;
    const sectionMonth = isMonth ? MONTHS.indexOf(section) : -1;
    if (dateLabel) {
      const d = dateLabel.match(/(\d{1,2})(?:\s*[–-]\s*\d{1,2})?\s+([A-Z][a-z]+)/) || dateLabel.match(/(\d{1,2})(?:\s*[–-]\s*\d{1,2})?(?:,|\s+and)/);
      const mo = d && d[2] && MONTHS.includes(d[2]) ? MONTHS.indexOf(d[2]) : sectionMonth >= 0 ? sectionMonth : MONTHS.findIndex((x) => dateLabel.includes(x));
      if (d && mo >= 0) date = `${year}-${String(mo + 1).padStart(2, '0')}-${String(+d[1]).padStart(2, '0')}`;
      else if (mo >= 0) {
        date = `${year}-${String(mo + 1).padStart(2, '0')}-15`;
        approx = true;
      }
    }
    if (!date && sectionMonth >= 0) {
      date = `${year}-${String(sectionMonth + 1).padStart(2, '0')}-15`;
      approx = true;
    }
    const round = (office.match(/\((\d)(?:st|nd|rd|th) round\)/) || [])[1];
    const article = offLinks[0]?.title;
    out.push({
      id: `${year}-${country}-${office}-${dateLabel || 'tbd'}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 90),
      country,
      region: regionOf(country),
      office,
      type: classify(office),
      date, // ISO yyyy-mm-dd or null (date unknown)
      dateLabel: dateLabel || (unknown ? `${year}, date TBA` : section),
      approx: approx || !date,
      round: round ? +round : undefined,
      indirect: indirect || undefined,
      dependent: dependent || undefined,
      article,
      articleUrl: article ? wikiUrl(article) : undefined,
      year,
    });
  }
  return out;
}

/* ------------------------------ fetch & cache ------------------------------ */
const cache = new Map();
async function cached(key, ttl, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.value;
  try {
    const value = await fn();
    cache.set(key, { at: Date.now(), value });
    if (cache.size > 300) cache.delete(cache.keys().next().value);
    return value;
  } catch (e) {
    if (hit) return { ...hit.value, stale: true };
    throw e;
  }
}
async function get(url, timeout = 9000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { 'user-agent': UA, 'api-user-agent': UA, accept: '*/*' } });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
    return r;
  } finally {
    clearTimeout(t);
  }
}
const rawUrl = (title) => `https://en.wikipedia.org/w/index.php?title=${encodeURIComponent(title.replace(/ /g, '_'))}&action=raw`;

export async function loadElections(now = new Date()) {
  const y = now.getUTCFullYear();
  const years = [y, y + 1];
  return cached(`cal:${years}`, TTL, async () => {
    const notes = [];
    const lists = await Promise.all(
      years.map(async (yr) => {
        const title = `${yr}_national_electoral_calendar`;
        const text = await (await get(rawUrl(title))).text();
        if (!/==\s*January\s*==/.test(text)) throw new Error(`unexpected wikitext for ${title}`);
        return parseCalendar(text, yr);
      }),
    );
    const elections = lists.flat();
    if (elections.length < 20) throw new Error('too few elections parsed');
    return {
      elections,
      live: true,
      source: { name: 'Wikipedia — national electoral calendars', urls: years.map((yr) => wikiUrl(`${yr} national electoral calendar`)), license: 'CC BY-SA 4.0' },
      fetchedAt: Date.now(),
      asOf: new Date().toISOString().slice(0, 10),
      notes,
    };
  });
}

export function leadFromWikitext(t) {
  let s = t.replace(/<ref[^>]*\/>/g, '').replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '').replace(/<!--[\s\S]*?-->/g, '');
  for (let i = 0; i < 12 && /\{\{/.test(s); i++) s = s.replace(/\{\{[^{}]*\}\}/g, '');
  s = s.replace(/\{\|[\s\S]*?\|\}/g, '').split(/\n==/)[0];
  s = s.replace(/\[\[(?:File|Image):[^\]]*(?:\[\[[^\]]*\]\][^\]]*)*\]\]/gi, '');
  const paras = s.split(/\n\s*\n/).map((x) => plain(x.replace(/<[^>]+>/g, '').replace(/'''?/g, ''))).filter((x) => x.length > 40 && !/^[|!{}]/.test(x));
  return paras.join('\n\n').slice(0, 1800);
}

async function summary(title) {
  return cached(`sum:${title}`, TTL, async () => {
    let j;
    try {
      j = await (await get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`)).json();
    } catch {
      // REST endpoint rate-limited: derive the lead section from the raw wikitext instead.
      j = { title: title.replace(/_/g, ' '), extract: leadFromWikitext(await (await get(rawUrl(title))).text()) };
    }
    return {
      title: j.title,
      extract: j.extract || '',
      description: j.description || '',
      url: j.content_urls?.desktop?.page || wikiUrl(title),
      thumbnail: j.thumbnail?.source,
      updated: j.timestamp,
      fetchedAt: Date.now(),
    };
  });
}

/** Router core: returns { status, body, maxAge }. */
export async function worldApi(sub, params) {
  try {
    if (sub === '' || sub === '/' || sub === '/elections') {
      try {
        return { status: 200, body: await loadElections(), maxAge: 3600 };
      } catch (e) {
        return {
          status: 200,
          maxAge: 600,
          body: { ...fallback, live: false, notes: [`Live Wikipedia fetch failed (${String(e.message || e).slice(0, 120)}); showing bundled snapshot as of ${fallback.asOf}.`] },
        };
      }
    }
    if (sub === '/news') return (await import('./world-news.js')).worldNewsApi(params);
    if (sub === '/countries') return { status: 200, body: { countries: (await import('./countries.js')).countryList() }, maxAge: 86400 };
    if (sub === '/country') {
      const code = (params.get('code') || '').toUpperCase().slice(0, 2);
      const prof = await (await import('./countries.js')).countryProfile(code);
      return prof ? { status: 200, body: prof, maxAge: 1800 } : { status: 404, body: { error: 'unknown country code' } };
    }
    if (sub === '/summary') {
      const title = (params.get('title') || '').slice(0, 200);
      if (!title) return { status: 400, body: { error: 'title required' } };
      return { status: 200, body: await summary(title), maxAge: 3600 };
    }
    return { status: 404, body: { error: 'not found' } };
  } catch (e) {
    return { status: 502, body: { error: String(e.message || e) } };
  }
}

export async function nodeWorldHandler(p, url, json, res) {
  const r = await worldApi(p.replace(/^\/api\/world/, ''), url.searchParams);
  return json(res, r.status, r.body);
}
