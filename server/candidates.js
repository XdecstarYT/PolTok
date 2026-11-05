// /api/candidates/* — enriched candidate profiles (agent E, Update 3). Shared by the Node server and
// netlify/functions/candidates.mjs (same JSON either way).
//
//   GET /api/candidates/profile?name=&state=&office=&party=&country=us|au
//
// Sources (all open, keyless):
//  - unitedstates/congress-legislators + Voteview via ./members.js (incumbent members of Congress)
//  - Wikipedia REST page summary (text CC BY-SA 4.0 — attributed + linked)
//  - Wikidata (CC0): birth date/place, education, occupation, positions held, website, social handles
//  - Wikimedia Commons imageinfo: portrait ONLY when LicenseShortName is a free licence (credited)
//  - Ballotpedia: search link only (never scraped)
// FEC money and 2026 results are joined client-side from /api/money and the live feed (no new calls).
//
// Matching is deliberately strict: an incumbent is resolved via the bioguide's own Wikipedia id; anyone
// else needs a single living human Wikidata item whose label matches the name, who is a politician of
// the right country, and whose Wikipedia summary names the state. Zero or several matches -> no
// verified profile (we never guess).
//
// Politeness: descriptive User-Agent with contact URL, one Wikimedia request at a time with a gap,
// batched wbgetentities, maxlag, 429/Retry-After cool-down, 7-day memory + temp-file cache.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { STATES } from '../shared/data/index.js';
import { membersApi } from './members.js';

const UA = 'PolTok/1.0 (https://poltok.netlify.app; candidate profiles) node-fetch';
const WD = 'https://www.wikidata.org/w/api.php';
const WP = 'https://en.wikipedia.org/api/rest_v1/page/summary/';
const COMMONS = 'https://commons.wikimedia.org/w/api.php';
const TTL_OK = 7 * 24 * 3600e3;
const TTL_NONE = 24 * 3600e3;
const CACHE_FILE = path.join(os.tmpdir(), 'poltok-candidates-v1.json');
const VERSION = 1;

const AU_STATES = { NSW: 'New South Wales', VIC: 'Victoria', QLD: 'Queensland', WA: 'Western Australia', SA: 'South Australia', TAS: 'Tasmania', ACT: 'Australian Capital Territory', NT: 'Northern Territory' };
const stateName = (country, st) => (country === 'au' ? AU_STATES[st] : STATES.find((s) => s.abbr === st)?.name) || st;

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
const tokens = (s) => norm(s).split(' ').filter((t) => t && !/^(jr|sr|ii|iii|iv|dr|mr|mrs|ms)$/.test(t) && t.length > 1);
const lastTok = (s) => tokens(s).slice(-1)[0] || '';
const firstTok = (s) => tokens(s)[0] || '';
/** "Sonya SEMMENS" -> "Sonya Semmens" (VEC ballot names are upper-case surnames). */
const tidyName = (s) => String(s).replace(/\b([A-Z][A-Z'’-]{1,})\b/g, (w) => (/^(II|III|IV)$/.test(w) ? w : w[0] + w.slice(1).toLowerCase()));

/* ------------------------------------ polite fetching ------------------------------------ */
let coolUntil = 0;
let chain = Promise.resolve();
class RateLimited extends Error {}
function wm(url, { json = true } = {}) {
  const run = async () => {
    if (Date.now() < coolUntil) throw new RateLimited('Wikimedia rate limit cool-down');
    const r = await fetch(url, { headers: { 'user-agent': UA, 'api-user-agent': UA, accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
    if (r.status === 429 || r.status === 503) {
      const ra = Number(r.headers.get('retry-after')) || 120;
      coolUntil = Date.now() + Math.min(ra, 1800) * 1000;
      throw new RateLimited(`Wikimedia HTTP ${r.status}`);
    }
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`HTTP ${r.status} from ${new URL(url).host}`);
    const body = json ? await r.json() : await r.text();
    if (json && body?.error) throw new Error(`Wikimedia API error: ${body.error.code || 'unknown'}`);
    return body;
  };
  const p = chain.then(run, run);
  chain = p.catch(() => {}).then(() => new Promise((res) => setTimeout(res, 120)));
  return p;
}
const qs = (base, params) => `${base}?${new URLSearchParams({ format: 'json', formatversion: '2', origin: '*', ...params })}`;

/* ------------------------------------------ cache ------------------------------------------ */
const mem = new Map(); // key -> { at, ttl, value }
const pending = new Map();
let fileLoaded = false;
async function loadFile() {
  if (fileLoaded) return;
  fileLoaded = true;
  try {
    const j = JSON.parse(await fs.readFile(CACHE_FILE, 'utf8'));
    if (j.v === VERSION) for (const [k, v] of Object.entries(j.entries || {})) if (!mem.has(k)) mem.set(k, v);
  } catch { /* none yet */ }
}
let saveT = null;
function saveSoon() {
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    const entries = Object.fromEntries([...mem].filter(([, v]) => Date.now() - v.at < v.ttl));
    fs.writeFile(CACHE_FILE, JSON.stringify({ v: VERSION, entries })).catch(() => {});
  }, 1500);
  saveT.unref?.();
}

/* ------------------------------------- congress (bioguide) ------------------------------------- */
async function findBioguide(name, state, office) {
  const r = await membersApi('/us');
  if (r.status !== 200) return null;
  const last = lastTok(name), first = firstTok(name);
  const hits = r.body.members.filter((m) => m.state === state && lastTok(m.name) === last && tokens(m.name).includes(first));
  const pref = hits.filter((m) => office !== 'senate' || m.chamber === 'senate');
  const list = pref.length ? pref : hits;
  return list.length === 1 ? list[0].id : null;
}

/* ------------------------------------------ Wikidata ------------------------------------------ */
const claimIds = (e, p) => (e?.claims?.[p] || []).filter((c) => c.rank !== 'deprecated').map((c) => c.mainsnak?.datavalue?.value?.id).filter(Boolean);
const claimStr = (e, p) => (e?.claims?.[p] || []).filter((c) => c.rank !== 'deprecated').map((c) => c.mainsnak?.datavalue?.value).filter((v) => typeof v === 'string');
const wdTime = (v) => {
  const t = v?.time; if (!t) return null;
  const m = /^\+?(-?\d{4})-(\d\d)-(\d\d)/.exec(t); if (!m) return null;
  const prec = v.precision ?? 11;
  return prec >= 11 ? `${m[1]}-${m[2]}-${m[3]}` : prec === 10 ? `${m[1]}-${m[2]}` : m[1];
};
const qualTime = (c, p) => wdTime(c.qualifiers?.[p]?.[0]?.datavalue?.value);
const qualId = (c, p) => c.qualifiers?.[p]?.[0]?.datavalue?.value?.id || null;

async function getEntities(ids, props = 'claims|labels|descriptions|sitelinks') {
  const out = {};
  for (let i = 0; i < ids.length; i += 50) {
    const j = await wm(qs(WD, { action: 'wbgetentities', ids: ids.slice(i, i + 50).join('|'), props, languages: 'en', sitefilter: 'enwiki' }));
    Object.assign(out, j?.entities || {});
  }
  return out;
}
const label = (e) => e?.labels?.en?.value || null;

async function wikiSummary(title) {
  const j = await wm(WP + encodeURIComponent(title.replace(/ /g, '_')));
  if (!j || j.type === 'disambiguation') return null;
  return j;
}

/** Strict match. Returns { qid, summary } or { reason }. */
async function matchWikidata({ name, state, country }) {
  const s = await wm(qs(WD, { action: 'wbsearchentities', search: name, language: 'en', type: 'item', limit: '8' }));
  const ids = (s?.search || []).map((x) => x.id);
  if (!ids.length) return { reason: 'No Wikidata item found for this name.' };
  const ents = await getEntities(ids);
  const want = tokens(name), last = lastTok(name), first = firstTok(name);
  const nat = country === 'au' ? { q: 'Q408', adj: /australian/i } : { q: 'Q30', adj: /american|united states/i };
  const passing = Object.values(ents).filter((e) => {
    if (!claimIds(e, 'P31').includes('Q5')) return false; // human
    if (e.claims?.P570) return false; // living candidates only
    const lt = tokens(label(e));
    if (lt.slice(-1)[0] !== last && !lt.includes(last)) return false;
    if (!(lt[0] === first || lt[0]?.[0] === first[0] || want.every((t) => lt.includes(t)))) return false;
    const desc = e.descriptions?.en?.value || '';
    const pol = claimIds(e, 'P106').includes('Q82955') || !!e.claims?.P39 || /politician|senator|governor|representative|member of/i.test(desc);
    const natOk = claimIds(e, 'P27').includes(nat.q) || nat.adj.test(desc);
    return pol && natOk && e.sitelinks?.enwiki?.title;
  });
  if (!passing.length) return { reason: 'No Wikidata politician matched this name and country.' };
  const sn = stateName(country, state);
  const verified = [];
  for (const e of passing.slice(0, 3)) {
    const sum = await wikiSummary(e.sitelinks.enwiki.title);
    if (!sum) continue;
    const text = `${sum.description || ''} ${sum.extract || ''} ${e.descriptions?.en?.value || ''}`;
    if (new RegExp(`\\b${sn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text) || (country === 'au' && sn === 'Victoria' && /Victorian/.test(text))) verified.push({ qid: e.id, entity: e, summary: sum });
  }
  if (verified.length === 1) return verified[0];
  if (verified.length > 1) return { reason: `Ambiguous: ${verified.length} Wikidata people match this name and state.` };
  return { reason: `No Wikipedia article ties this name to ${sn}.` };
}

const FREE = /^(cc0|cc[- ]by(-sa)?([- ]\d(\.\d)?)?( [a-z-]+)?|public domain|pd([- ].*)?|attribution|gfdl.*)$/i;
const strip = (h) => String(h || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
async function commonsPortrait(file) {
  const j = await wm(qs(COMMONS, { action: 'query', titles: `File:${file}`, prop: 'imageinfo', iiprop: 'url|extmetadata|size', iiurlwidth: '400' }));
  const ii = j?.query?.pages?.[0]?.imageinfo?.[0];
  const md = ii?.extmetadata || {};
  const lic = strip(md.LicenseShortName?.value);
  if (!ii || !lic || md.NonFree?.value === 'true' || /\b(nc|nd)\b/i.test(lic) || !FREE.test(lic)) return { rejected: lic || 'unknown licence', file };
  return {
    src: ii.thumburl || ii.url,
    width: ii.thumbwidth || ii.width,
    height: ii.thumbheight || ii.height,
    file,
    page: ii.descriptionurl,
    licence: lic,
    licenceUrl: md.LicenseUrl?.value || null,
    author: strip(md.Artist?.value).slice(0, 160) || null,
    credit: `${strip(md.Artist?.value).slice(0, 160) || 'Unknown author'} · ${lic} · via Wikimedia Commons`,
  };
}

async function wikidataFacts(entity) {
  const c = entity.claims || {};
  const positions = (c.P39 || []).filter((x) => x.rank !== 'deprecated' && x.mainsnak?.datavalue).map((x) => ({
    id: x.mainsnak.datavalue.value.id, start: qualTime(x, 'P580'), end: qualTime(x, 'P582'), district: qualId(x, 'P768'), of: qualId(x, 'P642'),
  }));
  const ref = new Set([...claimIds(entity, 'P19'), ...claimIds(entity, 'P69'), ...claimIds(entity, 'P106'), ...claimIds(entity, 'P102'), ...positions.flatMap((p) => [p.id, p.district, p.of].filter(Boolean))]);
  const labels = ref.size ? await getEntities([...ref], 'labels') : {};
  const L = (id) => label(labels[id]) || null;
  const born = wdTime(c.P569?.[0]?.mainsnak?.datavalue?.value);
  const social = {};
  const tw = claimStr(entity, 'P2002')[0]; if (tw) social.x = `https://x.com/${tw}`;
  const ig = claimStr(entity, 'P2003')[0]; if (ig) social.instagram = `https://www.instagram.com/${ig}`;
  const fb = claimStr(entity, 'P2013')[0]; if (fb) social.facebook = `https://www.facebook.com/${fb}`;
  const yt = claimStr(entity, 'P2397')[0]; if (yt) social.youtube = `https://www.youtube.com/channel/${yt}`;
  const bs = claimStr(entity, 'P12361')[0]; if (bs) social.bluesky = `https://bsky.app/profile/${bs}`;
  return {
    born,
    birthPlace: claimIds(entity, 'P19').map(L).filter(Boolean)[0] || null,
    education: claimIds(entity, 'P69').map(L).filter(Boolean),
    occupation: claimIds(entity, 'P106').map(L).filter(Boolean).slice(0, 6),
    parties: claimIds(entity, 'P102').map(L).filter(Boolean),
    website: claimStr(entity, 'P856')[0] || null,
    social,
    offices: positions
      .map((p) => ({ title: [L(p.id), p.district && L(p.district) ? `— ${L(p.district)}` : ''].filter(Boolean).join(' '), start: p.start, end: p.end }))
      .filter((p) => p.title)
      .sort((a, b) => String(a.start || '9999').localeCompare(String(b.start || '9999'))),
    image: claimStr(entity, 'P18')[0] || null,
  };
}

/* -------------------------------------------- build -------------------------------------------- */
async function build({ name, state, office, party, country }) {
  const today = new Date().toISOString().slice(0, 10);
  const sources = [];
  const notes = [];
  let congress = null;
  let bioguide = null;
  if (country === 'us') {
    try {
      bioguide = await findBioguide(name, state, office);
      if (bioguide) {
        const r = await membersApi(`/us/${bioguide}`);
        if (r.status === 200) {
          const m = r.body.member;
          congress = { bioguide, chamber: m.chamber, since: m.since, termEnd: m.termEnd, stats: m.stats, terms: m.terms, committees: m.committees, votes: m.votes.slice(0, 10), contact: m.contact, social: m.social, ids: m.ids, photo: m.photo, birthday: m.birthday };
          sources.push({ name: 'unitedstates/congress-legislators (public domain)', url: `https://bioguide.congress.gov/search/bio/${bioguide}`, retrieved: today });
          if (m.stats) sources.push({ name: 'Voteview (UCLA) — DW-NOMINATE & roll-call votes', url: 'https://voteview.com', retrieved: today });
        }
      }
    } catch (e) { notes.push(`Congress data unavailable: ${e.message}`); }
  }

  let wiki = null, facts = null, portrait = null, qid = null, noProfile = null;
  try {
    let entity = null, summary = null;
    if (congress?.ids?.wikipedia) {
      summary = await wikiSummary(congress.ids.wikipedia);
      if (summary?.wikibase_item) { qid = summary.wikibase_item; entity = (await getEntities([qid]))[qid]; }
    }
    if (!entity) {
      const m = await matchWikidata({ name, state, country });
      if (m.qid) ({ qid, entity, summary } = m);
      else noProfile = m.reason;
    }
    if (entity && summary) {
      wiki = {
        title: summary.title, url: summary.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(summary.title)}`,
        description: summary.description || null, extract: summary.extract || null, revised: summary.timestamp || null,
        licence: 'CC BY-SA 4.0', licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      };
      facts = await wikidataFacts(entity);
      sources.push({ name: `Wikipedia — “${summary.title}” (CC BY-SA 4.0)`, url: wiki.url, retrieved: today });
      sources.push({ name: `Wikidata ${qid} (CC0)`, url: `https://www.wikidata.org/wiki/${qid}`, retrieved: today });
      if (facts.image) {
        const p = await commonsPortrait(facts.image).catch(() => null);
        if (p?.src) { portrait = p; sources.push({ name: `Wikimedia Commons — ${p.file} (${p.licence})`, url: p.page, retrieved: today }); }
        else if (p?.rejected) notes.push(`Commons portrait not used: licence “${p.rejected}” is not free.`);
      }
      delete facts.image;
    }
  } catch (e) {
    if (e instanceof RateLimited) throw e;
    notes.push(`Wikipedia/Wikidata unavailable: ${e.message}`);
  }

  const bpName = congress?.ids?.ballotpedia;
  const ballotpedia = country === 'us'
    ? bpName ? `https://ballotpedia.org/${encodeURIComponent(bpName.replace(/ /g, '_'))}` : `https://ballotpedia.org/wiki/index.php?search=${encodeURIComponent(name)}`
    : null;
  return {
    ok: true, verified: !!wiki, noProfile: wiki ? null : noProfile || 'No verified profile.',
    query: { name, state, office, party, country }, qid, bioguide, wiki, facts, portrait, congress, ballotpedia, sources, notes, generatedAt: Date.now(),
  };
}

export async function getProfile(q) {
  await loadFile();
  const key = [q.country, q.state, q.office, norm(q.name)].join('|');
  const hit = mem.get(key);
  if (hit && Date.now() - hit.at < hit.ttl) return { ...hit.value, cached: true };
  if (pending.has(key)) return pending.get(key);
  const p = build(q)
    .then((value) => {
      mem.set(key, { at: Date.now(), ttl: value.verified || value.bioguide ? TTL_OK : TTL_NONE, value });
      saveSoon();
      return value;
    })
    .catch((e) => {
      if (hit) return { ...hit.value, cached: true, stale: true };
      if (e instanceof RateLimited) return { ok: false, rateLimited: true, retryAt: coolUntil, query: q, error: 'Wikimedia is rate-limiting us; try again shortly.' };
      throw e;
    })
    .finally(() => pending.delete(key));
  pending.set(key, p);
  return p;
}

export async function candidatesApi(sub, params) {
  try {
    const route = sub.replace(/^\/+|\/+$/g, '');
    if (route === 'profile') {
      const name = tidyName(String(params.get('name') || '').trim()).slice(0, 80);
      const country = params.get('country') === 'au' ? 'au' : 'us';
      const state = String(params.get('state') || '').toUpperCase().slice(0, 3);
      const office = String(params.get('office') || '').slice(0, 20);
      const party = String(params.get('party') || '').slice(0, 10);
      if (!name || /^tbd/i.test(name) || !state) return { status: 400, body: { error: 'name and state required' } };
      const body = await getProfile({ name, state, office, party, country });
      return { status: 200, maxAge: body.rateLimited ? 0 : body.verified ? 86400 : 3600, body };
    }
    return { status: 404, body: { error: 'unknown candidates endpoint' } };
  } catch (e) {
    return { status: 502, body: { error: String(e?.message || e) } };
  }
}

/** Node adapter: (await import('./candidates.js')).nodeCandidatesHandler(p, url, json, res) */
export async function nodeCandidatesHandler(p, url, json, res) {
  const r = await candidatesApi(p.replace(/^\/api\/candidates/, ''), url.searchParams);
  return json(res, r.status, r.body, r.maxAge ? { 'cache-control': `public, max-age=${Math.min(r.maxAge, 3600)}` } : { 'cache-control': 'no-store' });
}
