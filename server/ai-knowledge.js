// Ask PolTok server-side retrieval. For each question we gather candidate facts from real sources
// (AP via NYT results JSON, Polymarket, US + AU news RSS, published polls, AU reference data,
// parliament bills, NYT ballot measures), rank them by relevance to the question and pack the best
// into a compact text block within a char budget. Every source is cached 60 s per warm instance and
// fails soft (a dead source just contributes nothing — we never invent facts).
//
// Each fact line starts with an entity ref (e.g. "race:GA-SEN") that the model may echo as a card
// token [[race:GA-SEN]]; the client validates refs against its own data.

import { NYT_SOURCES } from '../shared/nyt.js';
import { RACES, STATES, POLL_SERIES, GENERIC_BALLOT, APPROVAL } from '../shared/data/index.js';
import { AU_MARKET_SLUGS, eventToMarket } from '../shared/au/markets.js';
import AU from '../shared/data/au-kb.js';

export const LIVE_BUDGET = 3800;
const TTL = 60_000;
const GAMMA = 'https://gamma-api.polymarket.com/events?slug=';
const NYT_BASE = NYT_SOURCES.senate.replace(/results-senate\.json$/, '');
const PARTY = { DEM: 'D', GOP: 'R', IND: 'I', LIB: 'L', GRN: 'G' };
const raceIds = new Set(RACES.map((r) => r.id));
const stateName = new Map(STATES.map((s) => [s.abbr, s.name]));

/* ------------------------------------------ cache ------------------------------------------ */
const cache = new Map();
export function clearKnowledgeCache() {
  cache.clear();
}
function cached(key, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.p;
  const p = Promise.resolve()
    .then(fn)
    .catch(() => (hit && hit.p !== p ? hit.p : null));
  cache.set(key, { at: Date.now(), p });
  if (cache.size > 200) cache.delete(cache.keys().next().value);
  return p;
}
const withTimeout = (p, ms) => {
  let t;
  return Promise.race([p, new Promise((r) => (t = setTimeout(() => r(null), ms)))]).finally(() => clearTimeout(t));
};

/* ----------------------------------------- entities ----------------------------------------- */
const AMBIG = new Set(['IN', 'ME', 'OR', 'OK', 'HI', 'DE', 'ID', 'LA', 'MS', 'AL', 'CO', 'MA', 'PA', 'OH', 'VA', 'SC', 'MD', 'NE', 'AS', 'US', 'DC', 'MO', 'WA', 'MT']);
const AU_SEATS = [...AU.federal.seats.map((s) => ({ s, ch: 'federal' })), ...AU.victoria.seats.map((s) => ({ s, ch: 'vic' }))];
const AU_RE = /austral|victoria|victorian|\bvic\b|\bnsw\b|new south wales|melbourne|sydney|labor|liberal|coalition|nationals|greens|one nation|teal|albanese|premier|aec\b|vec\b|2pp|tpp|two.party|preferen|kooyong|electorate|federal|carroll|jess wilson|angus taylor|hanson|spring street/i;
const US_RE = /senate|house|governor|midterm|congress|democrat|republican|gop|\bdem\b|flip|called|race|ballot measure|proposition|prop\.? ?\d|amendment|\b[A-Z]{2}-(?:SEN|GOV|\d{1,2}|AL)\b/i;

export function extractEntities(question) {
  const q = String(question || '');
  const ql = q.toLowerCase();
  const states = new Set();
  for (const [abbr, name] of stateName) {
    if (new RegExp(`\\b${name.toLowerCase()}\\b`).test(ql)) {
      // "Virginia" inside "West Virginia" — skip when only the longer name matches
      if (abbr === 'VA' && /west virginia/.test(ql) && !/(^|[^t] )virginia/.test(ql.replace(/west virginia/g, ''))) continue;
      states.add(abbr);
    }
  }
  for (const m of q.matchAll(/\b([A-Z]{2})(?=\b|-)/g)) if (stateName.has(m[1]) && (!AMBIG.has(m[1]) || /-(SEN|GOV|\d|AL)/.test(q.slice(m.index, m.index + 7)))) states.add(m[1]);
  const ids = new Set([...q.toUpperCase().matchAll(/\b([A-Z]{2}-(?:SEN(?:-S)?|GOV|\d{1,2}|AL))\b/g)].map((m) => m[1].replace(/-(\d)$/, '-0$1')).filter((id) => raceIds.has(id)));
  const auSeats = AU_SEATS.filter(({ s }) => s[1].length > 3 && new RegExp(`\\b${s[1].toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(ql)).map(({ s, ch }) => ({ s, ch }));
  const chambers = new Set();
  if (/senat/i.test(q) && !/victorian? senate|au senate|australian senate/i.test(q)) chambers.add('senate');
  if (/\bhouse\b|congress|district/i.test(q)) chambers.add('house');
  if (/governor|gubernatorial/i.test(q)) chambers.add('governor');
  const topics = new Set();
  if (/bill|law|legislat|passed|signed|veto|parliament|congress.*(vote|pass)|roll.?call|division|act\b/i.test(q)) topics.add('bills');
  if (/poll|polling|generic ballot|approval|survey|newspoll/i.test(q)) topics.add('polls');
  if (/market|polymarket|odds|bet|chance|probab|favou?rite/i.test(q)) topics.add('markets');
  if (/news|headline|latest|happening|report|said|says|story|why/i.test(q)) topics.add('news');
  if (/measure|proposition|prop\.? ?\d|amendment|initiative|referend|abortion|marijuana|cannabis|minimum wage/i.test(q)) topics.add('measures');
  if (/flip|upset|gain|surpris/i.test(q)) topics.add('flips');
  if (/uncalled|not (yet )?called|too close|still counting|outstanding|close/i.test(q)) topics.add('close');
  const au = AU_RE.test(q) || auSeats.length > 0;
  const us = US_RE.test(q) || states.size > 0 || ids.size > 0 || !au;
  const words = new Set(ql.match(/[a-z][a-z'’-]{3,}/g) || []);
  return { states, ids, auSeats, chambers, topics, au, us, words };
}

/* ----------------------------------------- loaders ----------------------------------------- */
let newsSvc = null;
let auNewsSvc = null;
async function serviceItems(kind) {
  if (kind === 'us') {
    if (!newsSvc) newsSvc = (await import('./news.js')).createNewsService({ log: () => {} });
    await withTimeout(newsSvc.refresh(), 4000);
    return newsSvc.query({ limit: 150 }).items;
  }
  if (!auNewsSvc) auNewsSvc = (await import('./au.js')).createAuNewsService({ log: () => {} });
  await withTimeout(auNewsSvc.refresh(), 4000);
  return auNewsSvc.query({ limit: 80 }).items;
}

export function defaultLoaders(fetchImpl = fetch) {
  const json = async (url, ms = 7000) => {
    const r = await fetchImpl(url, { signal: AbortSignal.timeout(ms) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  };
  const event = async (slug) => {
    const d = await json(GAMMA + encodeURIComponent(slug), 5000);
    return Array.isArray(d) ? d[0] : undefined;
  };
  return {
    nyt: (kind) => cached(`nyt:${kind}`, () => json(NYT_SOURCES[kind], 8000)),
    stateFile: (abbr) => cached(`nyt-state:${abbr}`, () => json(`${NYT_BASE}results-${stateName.get(abbr).toLowerCase().replace(/\s+/g, '-')}.json`, 6000)),
    usMarket: (id, slug, question) =>
      cached(`pm:${slug}`, async () => {
        const ev = await event(slug);
        if (!ev) return null;
        return eventToMarket(ev, { id, slug, question });
      }),
    auMarkets: () =>
      cached('pm:au', async () => (await Promise.all(AU_MARKET_SLUGS.map((d) => event(d.slug).then((ev) => (ev ? eventToMarket(ev, d) : null)).catch(() => null)))).filter(Boolean)),
    news: () => cached('news:us', () => serviceItems('us')),
    auNews: () => cached('news:au', () => serviceItems('au')),
    bills: (country) =>
      cached(`bills:${country}`, async () => {
        const { parliamentApi } = await import('./parliament.js');
        const r = await parliamentApi(`${country}/bills`, new URLSearchParams('limit=25'), process.env);
        return r.status === 200 ? r.body.bills || [] : [];
      }),
  };
}

/* ------------------------------------------ facts ------------------------------------------ */
const pct = (x) => `${(Math.round(x * 10) / 10).toFixed(1)}%`;
const name = (m) => [m?.first_name, m?.last_name].filter(Boolean).join(' ') || m?.nyt_id || '?';

function ourRaceId(nr, office) {
  const st = nr.top_reporting_unit?.state_postal || String(nr.nyt_id).slice(0, 2);
  let id;
  if (office === 'S') id = `${st}-SEN${/special/i.test(nr.type || '') || nr.race_type_id === 'W' || /S_W/.test(nr.nyt_id) ? '-S' : ''}`;
  else if (office === 'G') id = `${st}-GOV`;
  else id = `${st}-${Number(nr.seat_number) ? String(Number(nr.seat_number)).padStart(2, '0') : 'AL'}`;
  return raceIds.has(id) ? id : null;
}

/** One NYT race → fact. */
function raceFact(nr, office, ent) {
  const ru = nr.top_reporting_unit || {};
  const st = ru.state_postal || String(nr.nyt_id).slice(0, 2);
  const meta = nr.candidate_metadata || {};
  const total = (ru.candidates || []).reduce((a, c) => a + (c.votes?.total || 0), 0);
  const cands = [...(ru.candidates || [])].sort((a, b) => (b.votes?.total || 0) - (a.votes?.total || 0)).slice(0, 3);
  const id = ourRaceId(nr, office);
  const label = office === 'S' ? `${stateName.get(st)} Senate${id?.endsWith('-S') ? ' (special)' : ''}` : office === 'G' ? `${stateName.get(st)} Governor` : `${st}-${nr.seat_number ? String(Number(nr.seat_number)).padStart(2, '0') : 'AL'} House`;
  const won = nr.outcome?.won?.[0];
  const winM = won && meta[won];
  const parts = cands.map((c) => {
    const m = meta[c.nyt_id] || {};
    return `${name(m)} (${PARTY[m.party?.nyt_id] || 'O'}${m.incumbent ? ', inc.' : ''}) ${total ? pct((100 * (c.votes?.total || 0)) / total) : '–'}`;
  });
  const eevp = Math.round(Number(ru.eevp) || 0);
  const status = won ? `CALLED for ${name(winM)} (${PARTY[winM?.party?.nyt_id] || 'O'})${nr.outcome?.gained ? ' — FLIP' : ''}` : nr.race_call_status === 'too_close' || /close/.test(nr.race_call_status || '') ? 'too close to call' : 'not yet called';
  const m2 = total && cands.length > 1 ? (100 * ((cands[0].votes?.total || 0) - (cands[1].votes?.total || 0))) / total : 100;
  // relevance
  let score = office === 'H' ? 0.5 : 2;
  if (nr.outcome?.gained) score += 2;
  if (!won && eevp > 0 && m2 < 5) score += 1.5;
  if (ent.states.has(st)) score += office === 'H' ? 4 : 7;
  if (id && ent.ids.has(id)) score += 12;
  if (ent.chambers.has(office === 'S' ? 'senate' : office === 'G' ? 'governor' : 'house')) score += 2;
  if (ent.topics.has('flips') && nr.outcome?.gained) score += 4;
  if (ent.topics.has('close') && !won) score += 3 + (m2 < 3 ? 2 : 0);
  for (const c of Object.values(meta)) if (c.last_name && c.last_name.length > 3 && ent.words.has(c.last_name.toLowerCase())) score += 9;
  const ref = id ? `race:${id}` : `${label}`;
  return { score, text: `${ref} | ${label}: ${parts.join(', ')}; ${eevp}% in; ${status} [AP via NYT]`, ref: id ? `race:${id}` : null };
}

function balanceFacts(docs) {
  const lines = [];
  for (const [kind, office, chamber] of [['senate', 'S', 'senate'], ['house', 'H', 'house'], ['governor', 'G', 'governor']]) {
    const doc = docs[kind];
    const pc = doc?.partyControlData?.results?.find((r) => r.state_postal === 'US')?.offices?.[office];
    const races = (doc?.races || []).filter((r) => !String(r.nyt_id).startsWith('US-'));
    const called = races.filter((r) => r.outcome?.won?.length).length;
    if (pc) {
      const pb = pc.party_balance || {};
      const d = pb.DEM?.seats ?? 0;
      const r = pb.GOP?.seats ?? 0;
      const o = pb.OTH?.seats ?? 0;
      const winner = pb.DEM?.winner ? ' — Democrats have WON control' : pb.GOP?.winner ? ' — Republicans have WON control' : ' — control not yet decided';
      const flips = `flips D+${pb.DEM?.flip_count ?? 0} R+${pb.GOP?.flip_count ?? 0}`;
      const need = chamber === 'senate' ? '51 (VP is R)' : chamber === 'house' ? '218' : '';
      lines.push(`balance:${chamber === 'governor' ? 'governors' : chamber} | ${chamber[0].toUpperCase() + chamber.slice(1)}: D ${d}, R ${r}${o ? `, Ind/other ${o}` : ''} of ${pc.total || '?'}${need ? `, need ${need}` : ''}; ${called}/${races.length} races called; ${flips}${chamber === 'governor' ? '' : winner} [AP via NYT]`);
    } else if (races.length) lines.push(`${chamber}: ${called}/${races.length} races called [AP via NYT]`);
  }
  return lines;
}

function measureFacts(doc, abbr, ent) {
  return (doc?.races || [])
    .filter((r) => r.office_id === 'I' && r.coverage === 'state')
    .map((r) => {
      const ru = r.top_reporting_unit || {};
      const tot = (ru.candidates || []).reduce((a, c) => a + (c.votes?.total || 0), 0);
      const yes = (ru.candidates || []).find((c) => /^yes/i.test(c.nyt_id) || /for/i.test(c.nyt_id));
      const won = r.outcome?.won?.[0];
      const title = r.title?.default || r.ballot_measure_text || r.seat || r.nyt_id;
      const kwHit = String(title).toLowerCase().split(/\W+/).filter((w) => w.length > 4 && ent.words.has(w)).length;
      return {
        score: 3 + (ent.topics.has('measures') ? 3 : 0) + kwHit * 3,
        text: `${abbr} ballot measure | ${title}: Yes ${tot && yes ? pct((100 * (yes.votes?.total || 0)) / tot) : '–'}; ${Math.round(ru.eevp || 0)}% in; ${won ? `CALLED: ${won.toUpperCase()}` : 'not yet called'} [AP via NYT]`,
      };
    });
}

function marketFact(m, base, ent) {
  if (!m?.outcomes?.length) return null;
  const odds = m.outcomes.slice(0, 3).map((o) => `${o.label} ${Math.round(o.prob * 100)}%`).join(', ');
  return { score: base + (ent.topics.has('markets') ? 4 : 0), text: `market:${m.id} | ${m.question} ${odds} [Polymarket]` };
}

function newsFacts(items, ent, au) {
  const now = Date.now();
  return (items || []).slice(0, 150).map((n) => {
    const t = `${n.title} ${n.summary || ''}`.toLowerCase();
    let score = (au ? 0.5 : 1) + (ent.topics.has('news') ? 2 : 0);
    const age = (now - (n.publishedAt || 0)) / 3600000;
    if (age < 6) score += 1.5;
    else if (age > 48) score -= 1;
    for (const st of ent.states) if (t.includes(stateName.get(st).toLowerCase()) || n.tags?.includes(st)) score += 4;
    for (const { s } of ent.auSeats) if (t.includes(s[1].toLowerCase())) score += 5;
    let hits = 0;
    for (const w of ent.words) if (w.length > 4 && t.includes(w)) hits++;
    score += Math.min(4, hits * 1.2);
    return { score, text: `news | ${String(n.title).slice(0, 140)} [${n.source}]` };
  });
}

function billFacts(bills, country, ent) {
  const STAGE = ['introduced', 'in committee', 'passed one chamber', 'passed both chambers', 'signed into law'];
  return (bills || []).slice(0, 25).map((b) => {
    const t = `${b.title || ''}`.toLowerCase();
    let hits = 0;
    for (const w of ent.words) if (w.length > 4 && t.includes(w)) hits++;
    const recent = b.latestAction?.date && Date.now() - Date.parse(b.latestAction.date) < 8 * 86400000;
    return {
      score: 2 + (ent.topics.has('bills') ? 4 : 0) + hits * 2 + (recent ? 1.5 : 0) + (b.stage >= 2 ? 1 : 0),
      text: `bill:${b.id} | ${country.toUpperCase()} ${b.number || ''} ${String(b.title || '').slice(0, 110)} — ${STAGE[b.stage] ?? 'status unknown'}${b.latestAction ? `; latest ${b.latestAction.date}: ${String(b.latestAction.text).slice(0, 90)}` : ''} [${country === 'us' ? 'Congress.gov/GovInfo' : 'APH'}]`,
    };
  });
}

function pollFacts(ent) {
  const out = [];
  const series = [...POLL_SERIES];
  for (const s of series) {
    const p = s.polls?.[s.polls.length - 1];
    if (!p) continue;
    const st = s.id.slice(0, 2);
    let score = s.id === 'generic-ballot' ? 2 : 0.5;
    if (ent.topics.has('polls')) score += 3;
    if (ent.states.has(st)) score += 5;
    if (ent.ids.has(s.id)) score += 8;
    const vals = Object.entries(p.values || {}).map(([k, v]) => `${s.keys?.find((x) => x.key === k)?.label || k} ${v}`).join(', ');
    out.push({ score, text: `poll:${s.id} | ${s.title}: latest ${p.pollster} (${p.date}, ${p.population || ''}) ${vals}; ${s.polls.length} polls since Sep [PollCheck]` });
  }
  const gb = GENERIC_BALLOT?.pollcheck;
  if (gb) out.push({ score: ent.topics.has('polls') ? 5 : 1.5, text: `poll:generic-ballot avg | Generic ballot average: D ${gb.D}, R ${gb.R} (${gb.polls} polls, as of ${gb.asOf}) [PollCheck]` });
  const ap = APPROVAL?.pollcheck;
  if (ap) out.push({ score: /approv|president|trump/.test([...ent.words].join(' ')) ? 8 : 0.5, text: `approval | Presidential approval average: approve ${ap.approve}, disapprove ${ap.disapprove} (as of ${ap.asOf}) [PollCheck]` });
  return out;
}

function auFacts(ent, auNews, auMarkets) {
  const out = [];
  const F = AU.federal;
  const V = AU.victoria;
  const comp = (o) => Object.entries(o).map(([k, v]) => `${k} ${v}`).join(', ');
  out.push({ score: 6, text: `au:federal | Federal: PM ${F.pm.name} (${F.pm.party}); Opposition leader ${F.opposition.name}; House (150, need 76): ${comp(F.house)} (as of ${F.houseAsOf}); Senate (76): ${comp(F.senate)} [AEC/PolTok data]` });
  out.push({ score: /victoria|vic|vec|spring street|carroll|melbourne/.test([...ent.words].join(' ')) ? 9 : 5, text: `au:victoria | Victorian election ${V.date} (VEC): Assembly ${V.totalSeats} seats, majority ${V.majority}; Premier ${V.premier.name} (${V.premier.party}), Opposition ${V.opposition.name} (${V.opposition.party}); current: ${comp(V.composition)} (${V.compositionNote}). No live results until counting starts on election night. [VEC/PolTok data]` });
  const poll = (p) => `${p.pollster} ${p.date}: ${p.tpp ? `2PP ALP ${p.tpp.ALP}–${p.tpp.LNP} L/NP` : '2PP n/a'}; primary ${comp(p.primary)}`;
  if (AU.polls.victoria[0]) out.push({ score: 4 + (ent.topics.has('polls') ? 3 : 0), text: `au:vic-polls | Victorian polls: ${AU.polls.victoria.slice(0, 3).map(poll).join(' | ')} [pollsters]` });
  if (AU.polls.federal[0]) out.push({ score: 3 + (ent.topics.has('polls') ? 3 : 0), text: `au:federal-polls | Federal polls: ${AU.polls.federal.slice(0, 3).map(poll).join(' | ')} [pollsters]` });
  for (const { s, ch } of ent.auSeats) {
    const [id, nm, st, party, member, margin, contest, note] = s;
    out.push({ score: 14, text: `seat:${id} | ${nm} (${ch === 'vic' ? 'Victorian district' : `federal, ${st}`}): held by ${member} (${party}), margin ${margin ?? '?'}%${contest ? ` (${ch === 'vic' ? 'vs ' : ''}${contest})` : ''}${note ? `; ${note}` : ''}. Pre-election data, not a live result. [AEC/VEC]` });
  }
  for (const e of AU.otherElections.slice(0, 4)) out.push({ score: 1.5, text: `au election | ${e.name} ${e.date} (${e.status})${e.result ? `: ${e.result}` : ''}` });
  for (const m of auMarkets || []) {
    const f = marketFact(m, 3, ent);
    if (f) out.push(f);
  }
  out.push(...newsFacts(auNews, ent, false));
  return out;
}

/* ------------------------------------------ main ------------------------------------------ */

/**
 * Gather + rank + pack live facts for a question.
 * @returns {Promise<{ text: string, refs: string[], entities: object }>}
 */
export async function gatherKnowledge(question, { loaders = defaultLoaders(), budget = LIVE_BUDGET, deadlineMs = 6000 } = {}) {
  const ent = extractEntities(question);
  const safe = (p) => withTimeout(Promise.resolve().then(() => p).catch(() => null), deadlineMs);
  const usSenate = [...ent.states].filter((s) => RACES.some((r) => r.state === s && r.chamber === 'senate'));
  const jobs = {
    senate: safe(loaders.nyt?.('senate')),
    governor: safe(loaders.nyt?.('governor')),
    house: safe(loaders.nyt?.('house')),
    news: ent.us ? safe(loaders.news?.()) : null,
    ctrl: ent.us ? safe(Promise.all([loaders.usMarket?.('senate-control', 'which-party-will-win-the-senate-in-2026', 'Which party will win the Senate?'), loaders.usMarket?.('house-control', 'which-party-will-win-the-house-in-2026', 'Which party will win the House?')])) : null,
    raceMkts: ent.us && usSenate.length
      ? safe(Promise.all(usSenate.slice(0, 3).map((s) => loaders.usMarket?.(`race:${s}-SEN`, `${stateName.get(s).toLowerCase().replace(/\s+/g, '-')}-senate-election-winner`, `Who will win the ${stateName.get(s)} Senate race?`))))
      : null,
    stateFiles: ent.us && (ent.topics.has('measures') || ent.states.size) ? safe(Promise.all([...ent.states].slice(0, 2).map((s) => loaders.stateFile?.(s)))) : null,
    bills: ent.topics.has('bills') ? safe(Promise.all([ent.us || !ent.au ? loaders.bills?.('us') : null, ent.au ? loaders.bills?.('au') : null])) : null,
    auNews: ent.au ? safe(loaders.auNews?.()) : null,
    auMarkets: ent.au ? safe(loaders.auMarkets?.()) : null,
  };
  const r = Object.fromEntries(await Promise.all(Object.entries(jobs).map(async ([k, p]) => [k, await p])));

  const facts = [];
  if (ent.us) {
    for (const [kind, office] of [['senate', 'S'], ['governor', 'G'], ['house', 'H']])
      for (const nr of r[kind]?.races || []) if (!String(nr.nyt_id).startsWith('US-')) facts.push(raceFact(nr, office, ent));
    for (const m of r.ctrl || []) {
      const f = marketFact(m, 3, ent);
      if (f) facts.push(f);
    }
    for (const m of r.raceMkts || []) {
      const f = marketFact(m, 7, ent);
      if (f) facts.push(f);
    }
    ;[...ent.states].slice(0, 2).forEach((s, i) => facts.push(...measureFacts(r.stateFiles?.[i], s, ent)));
    facts.push(...newsFacts(r.news, ent, ent.au));
    facts.push(...pollFacts(ent));
  }
  if (r.bills) {
    if (r.bills[0]) facts.push(...billFacts(r.bills[0], 'us', ent));
    if (r.bills[1]) facts.push(...billFacts(r.bills[1], 'au', ent));
  }
  if (ent.au) facts.push(...auFacts(ent, r.auNews, r.auMarkets));
  for (const s of ent.states) facts.push({ score: 5, text: `state:${s} | ${stateName.get(s)} (state page /state/${s})` });

  // Pack: national summary first (always), then best facts until the budget is used.
  const lines = ent.us || !ent.au ? balanceFacts(r) : [];
  let used = lines.reduce((a, l) => a + l.length + 1, 0);
  const seen = new Set();
  for (const f of facts.sort((a, b) => b.score - a.score)) {
    if (seen.has(f.text)) continue;
    if (used + f.text.length + 1 > budget) continue;
    seen.add(f.text);
    lines.push(f.text);
    used += f.text.length + 1;
    if (used > budget - 60) break;
  }
  const refs = [...new Set(lines.map((l) => /^([a-z]+:[A-Za-z0-9-]+) \|/.exec(l)?.[1]).filter(Boolean))];
  const text = lines.join('\n').slice(0, budget);
  return { text, refs, entities: { states: [...ent.states], ids: [...ent.ids], auSeats: ent.auSeats.map(({ s }) => s[0]), au: ent.au, us: ent.us, topics: [...ent.topics] } };
}
