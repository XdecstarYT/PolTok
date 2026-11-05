// Campaign finance API (agent 7, MONEY). Shared by the Node server (server/index.js) and the
// Netlify function (netlify/functions/money.mjs) — same JSON either way.
//
//   GET /api/money              compact 2026-cycle summary (all app races + party committees)
//   GET /api/money/race/:id     one race's slice of the same summary
//
// Source: official OpenFEC API, https://api.open.fec.gov/v1 (FEC_API_KEY env, else DEMO_KEY —
// DEMO_KEY is shared and limited to ~40 calls/hour, so the whole summary is built in ONE batch of
// ~14 calls and cached for 12h in memory + a JSON file in the OS temp dir). On HTTP 429 the batch
// stops, keeps whatever it already had (or the previous good copy) and reports `rateLimited`.
// Never fabricates: a candidate with no FEC match is returned with null money fields.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { RACES } from '../shared/data/index.js';

const BASE = 'https://api.open.fec.gov/v1';
const TTL = 12 * 3600e3;
const RETRY_AFTER_ERROR = 30 * 60e3; // don't hammer the API after a failed/limited batch
const CACHE_FILE = path.join(os.tmpdir(), 'poltok-money-v1.json');
const CYCLE = 2026;

export const PARTY_COMMITTEES = [
  { id: 'C00010603', short: 'DNC', name: 'Democratic National Committee', party: 'D' },
  { id: 'C00003418', short: 'RNC', name: 'Republican National Committee', party: 'R' },
  { id: 'C00042366', short: 'DSCC', name: 'Democratic Senatorial Campaign Committee', party: 'D' },
  { id: 'C00027466', short: 'NRSC', name: 'National Republican Senatorial Committee', party: 'R' },
  { id: 'C00000935', short: 'DCCC', name: 'Democratic Congressional Campaign Committee', party: 'D' },
  { id: 'C00075820', short: 'NRCC', name: 'National Republican Congressional Committee', party: 'R' },
];

class RateLimited extends Error {}

const num = (x) => (x == null || x === '' || Number.isNaN(Number(x)) ? null : Number(x));
const lastName = (s) => {
  const toks = String(s || '')
    .toLowerCase()
    .replace(/[.,"()]/g, ' ')
    .split(/\s+/)
    .filter((t) => t && !/^(jr|sr|ii|iii|iv|dr|mr|mrs|ms)$/.test(t));
  return toks[toks.length - 1] || '';
};
const fecLast = (s) => {
  const [last] = String(s || '').toLowerCase().split(',');
  return last.replace(/[^a-z\s'-]/g, ' ').trim().split(/\s+/).filter((t) => !/^(jr|sr|ii|iii|iv)$/.test(t));
};
const fecParty = (p) => (p === 'DEM' || p === 'DFL' ? 'D' : p === 'REP' ? 'R' : p === 'IND' || p === 'NPA' ? 'I' : 'O');

async function fec(pathname, params, key, log) {
  const u = new URL(BASE + pathname);
  for (const [k, v] of Object.entries(params)) for (const x of [].concat(v)) u.searchParams.append(k, String(x));
  u.searchParams.set('api_key', key);
  const r = await fetch(u, { headers: { accept: 'application/json', 'user-agent': 'PolTok/1.0 (+campaign finance)' }, signal: AbortSignal.timeout(15000) });
  if (r.status === 429) throw new RateLimited('FEC rate limit reached');
  if (!r.ok) throw new Error(`FEC ${pathname} HTTP ${r.status}`);
  log?.('fec', pathname, r.headers.get('x-ratelimit-remaining') ?? '');
  return r.json();
}

async function pages(pathname, params, maxPages, key, log) {
  const out = [];
  for (let page = 1; page <= maxPages; page++) {
    const j = await fec(pathname, { ...params, page, per_page: 100 }, key, log);
    out.push(...(j.results || []));
    if (!j.pagination || page >= (j.pagination.pages || 1)) break;
  }
  return out;
}

/* ------------------------------------ batch build ------------------------------------ */
// Each section is cached separately (raw FEC rows + fetchedAt) so a rate-limited batch only
// re-requests what is missing or older than TTL on the next attempt.
function sectionsSpec() {
  const senStates = [...new Set(RACES.filter((r) => r.chamber === 'senate').map((r) => r.state))];
  const houseStates = [...new Set(RACES.filter((r) => r.chamber === 'house').map((r) => r.state))];
  const common = { election_year: CYCLE, election_full: true, sort: '-receipts', sort_hide_null: true };
  const spec = [
    { id: 'sen', run: (k, l) => pages('/candidates/totals/', { ...common, office: 'S', state: senStates }, 2, k, l) },
    { id: 'house', run: (k, l) => pages('/candidates/totals/', { ...common, office: 'H', state: houseStates }, 3, k, l) },
    { id: 'ieS', run: (k, l) => pages('/schedules/schedule_e/totals/by_candidate/', { cycle: CYCLE, election_full: true, office: 'S', sort: '-total' }, 2, k, l) },
    { id: 'ieH', run: (k, l) => pages('/schedules/schedule_e/totals/by_candidate/', { cycle: CYCLE, election_full: true, office: 'H', sort: '-total' }, 2, k, l) },
  ];
  for (const c of PARTY_COMMITTEES)
    spec.push({ id: `party:${c.id}`, run: async (k, l) => (await fec(`/committee/${c.id}/totals/`, { cycle: CYCLE, per_page: 1 }, k, l)).results || [] });
  return spec;
}

async function build(key, prevSections = {}, log) {
  const errors = [];
  let rateLimited = false;
  const sections = { ...prevSections };
  for (const s of sectionsSpec()) {
    const old = sections[s.id];
    if (old && Date.now() - old.at < TTL) continue;
    if (rateLimited) continue;
    try {
      sections[s.id] = { at: Date.now(), rows: await s.run(key, log) };
    } catch (e) {
      if (e instanceof RateLimited) rateLimited = true;
      else errors.push(`${s.id}: ${e.message}`);
    }
  }
  return { sections, errors, rateLimited };
}

function digest(sections) {
  const rows = [...(sections.sen?.rows || []), ...(sections.house?.rows || [])];
  const fecCands = rows.map((c) => ({
    fecId: c.candidate_id,
    fecName: c.name,
    party: fecParty(c.party),
    office: c.office,
    state: c.state,
    district: c.office === 'H' ? Number(c.district_number ?? c.district) : undefined,
    receipts: num(c.receipts),
    disbursements: num(c.disbursements),
    cash: num(c.cash_on_hand_end_period),
    indiv: c.individual_itemized_contributions != null || c.individual_unitemized_contributions != null
      ? (num(c.individual_itemized_contributions) || 0) + (num(c.individual_unitemized_contributions) || 0)
      : num(c.individual_contributions),
    pac: num(c.other_political_committee_contributions),
    coverageEnd: c.coverage_end_date?.slice(0, 10) ?? null,
  }));
  const haveIe = !!(sections.ieS && sections.ieH);
  const ieMap = {};
  for (const r of [...(sections.ieS?.rows || []), ...(sections.ieH?.rows || [])]) {
    const x = (ieMap[r.candidate_id] ||= { support: 0, oppose: 0 });
    if (r.support_oppose_indicator === 'S') x.support += num(r.total) || 0;
    else if (r.support_oppose_indicator === 'O') x.oppose += num(r.total) || 0;
  }
  const parties = PARTY_COMMITTEES.map((c) => {
    const sec = sections[`party:${c.id}`];
    const row = sec?.rows?.[0];
    return {
      ...c,
      receipts: num(row?.receipts),
      disbursements: num(row?.disbursements),
      cash: num(row?.last_cash_on_hand_end_period ?? row?.cash_on_hand_end_period),
      coverageEnd: row?.coverage_end_date?.slice(0, 10) ?? null,
      available: !!sec,
    };
  });
  const missing = sectionsSpec().map((s) => s.id).filter((id) => !sections[id]);
  return { fecCands, ieMap, haveIe, parties, missing, partial: missing.length > 0 };
}

/** Join FEC rows onto the app's race list (by state / office / district + last name). */
function compose(meta) {
  const raw = digest(meta.sections);
  const byKey = new Map();
  for (const c of raw.fecCands) {
    const k = c.office === 'S' ? `${c.state}-S` : `${c.state}-H${c.district}`;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(c);
  }
  const races = [];
  const stateTotals = {};
  let coverage = null;
  for (const race of RACES) {
    if (race.chamber === 'governor') continue;
    const pool = byKey.get(race.chamber === 'senate' ? `${race.state}-S` : `${race.state}-H${race.district ?? 0}`) || [];
    const used = new Set();
    const candidates = race.candidates.map((rc) => {
      const ln = lastName(rc.name);
      const m = pool.find((f) => !used.has(f.fecId) && fecLast(f.fecName).includes(ln))
        // compound last names ("Mucarsel-Powell", "De La Cruz"): try substring on the FEC surname
        || pool.find((f) => !used.has(f.fecId) && ln.length > 3 && String(f.fecName).toLowerCase().split(',')[0].includes(ln));
      if (!m) return { id: rc.id, name: rc.name, party: rc.party, fecId: null, receipts: null, disbursements: null, cash: null, indiv: null, pac: null, ieSupport: null, ieOppose: null, coverageEnd: null };
      used.add(m.fecId);
      if (m.coverageEnd && (!coverage || m.coverageEnd > coverage)) coverage = m.coverageEnd;
      const x = raw.ieMap[m.fecId];
      return {
        id: rc.id, name: rc.name, party: rc.party, fecId: m.fecId, fecName: m.fecName,
        receipts: m.receipts, disbursements: m.disbursements, cash: m.cash, indiv: m.indiv, pac: m.pac,
        ieSupport: raw.haveIe ? x?.support ?? 0 : null, ieOppose: raw.haveIe ? x?.oppose ?? 0 : null,
        coverageEnd: m.coverageEnd,
      };
    });
    const sum = (f) => candidates.reduce((a, c) => a + (c[f] || 0), 0);
    const total = { receipts: sum('receipts'), disbursements: sum('disbursements'), ie: sum('ieSupport') + sum('ieOppose') };
    stateTotals[race.state] = (stateTotals[race.state] || 0) + total.disbursements + total.ie;
    races.push({ raceId: race.id, chamber: race.chamber, state: race.state, district: race.district, title: race.title, rating: race.rating, candidates, total, matched: candidates.filter((c) => c.fecId).length });
  }
  const leaderboard = [...raw.fecCands]
    .filter((c) => c.receipts)
    .sort((a, b) => b.receipts - a.receipts)
    .slice(0, 30)
    .map((c) => ({ ...c, ieSupport: raw.ieMap[c.fecId]?.support ?? null, ieOppose: raw.ieMap[c.fecId]?.oppose ?? null }));
  return {
    cycle: CYCLE,
    source: 'Federal Election Commission — OpenFEC API (api.open.fec.gov)',
    sourceUrl: 'https://www.fec.gov/data/',
    generatedAt: meta.generatedAt,
    coverageThrough: coverage,
    keyType: meta.keyType,
    rateLimited: meta.rateLimited,
    partial: raw.partial,
    errors: meta.errors || [],
    missing: raw.missing,
    nextRefreshAt: meta.nextAt,
    races,
    parties: raw.parties,
    stateTotals,
    leaderboard,
  };
}

/* ----------------------------------- cache plumbing ----------------------------------- */
let mem = null; // { sections, errors, generatedAt, rateLimited, keyType, nextAt }
let inflight = null;

async function loadFile() {
  try {
    const j = JSON.parse(await fs.readFile(CACHE_FILE, 'utf8'));
    return j && j.sections ? j : null;
  } catch {
    return null;
  }
}

async function getSummary(env = {}, log) {
  const key = env.FEC_API_KEY || 'DEMO_KEY';
  const keyType = env.FEC_API_KEY ? 'personal' : 'demo';
  if (!mem) mem = await loadFile();
  if (mem && Date.now() < mem.nextAt) return compose(mem);
  if (!inflight)
    inflight = (async () => {
      const r = await build(key, mem?.sections, log);
      const complete = !r.rateLimited && r.errors.length === 0 && !digest(r.sections).partial;
      const ats = Object.values(r.sections).map((x) => x.at);
      mem = {
        sections: r.sections,
        errors: r.errors,
        rateLimited: r.rateLimited,
        keyType,
        generatedAt: ats.length ? Math.max(...ats) : Date.now(),
        nextAt: Date.now() + (complete ? TTL : RETRY_AFTER_ERROR),
      };
      fs.writeFile(CACHE_FILE, JSON.stringify(mem)).catch(() => {});
      return mem;
    })().finally(() => (inflight = null));
  return compose(await inflight);
}

export async function moneyApi(sub, env, log) {
  const s = await getSummary(env, log);
  const maxAge = s.rateLimited || s.partial ? 600 : 6 * 3600;
  const m = /^\/race\/([^/]+)$/.exec(sub || '');
  if (m) {
    const race = s.races.find((r) => r.raceId.toUpperCase() === decodeURIComponent(m[1]).toUpperCase());
    if (!race) return { status: 404, body: { error: 'unknown race' }, maxAge: 0 };
    const { races, leaderboard, stateTotals, ...rest } = s;
    return { status: 200, body: { ...rest, race }, maxAge };
  }
  return { status: 200, body: s, maxAge };
}

export async function nodeMoneyHandler(p, url, json, res) {
  try {
    const r = await moneyApi(p.replace(/^\/api\/money/, ''), process.env, (...a) => console.log(new Date().toISOString().slice(11, 19), ...a));
    return json(res, r.status, r.body, r.maxAge && r.status === 200 ? { 'cache-control': `public, max-age=${Math.min(r.maxAge, 1800)}` } : {});
  } catch (e) {
    return json(res, 502, { error: String(e?.message || e) });
  }
}
