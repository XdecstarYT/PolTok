// Live Victorian state election 2026 data for the website (GET /api/vic/live).
// Sources, all fetched live and cached per warm instance:
//  • Polls — Wikipedia "Opinion polling for the 2026 Victorian state election" (full table: primaries + ALP-v-L/NP 2PP)
//  • 2022 margins — Wikipedia "2022 Victorian state election", official post-election pendulum (88 districts).
//    (src/data/au-vic.ts `final` is NOT usable for margins: for 29 districts it holds a mid-count figure.)
//  • Early/postal votes — VEC "early and postal vote statistics" page (daily totals).
// Projection = classic uniform swing on the 2PP from 2022 (Labor 55.0 / Coalition 45.0). Only Labor-v-Coalition contests can
// flip; Greens/independent/One Nation seats are not modelled. It is an illustration, never presented as a forecast.

import { runModel } from './vic-model.js';
const UA = { 'user-agent': 'PolTok/1.0 (+https://poltok.netlify.app)' };
const POLLS_PAGE = 'Opinion_polling_for_the_2026_Victorian_state_election';
const PENDULUM_PAGE = '2022_Victorian_state_election';
const VEC_STATS = 'https://www.vec.vic.gov.au/voting/2026-state-election/voting-statistics';
export const ALP_2PP_2022 = 55.0;
const MON = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

async function wikiRaw(title, timeoutMs = 9000) {
  const r = await fetch(`https://en.wikipedia.org/w/index.php?title=${title}&action=raw`, { headers: UA, signal: AbortSignal.timeout(timeoutMs) });
  if (!r.ok) throw new Error(`Wikipedia ${title} HTTP ${r.status}`);
  return r.text();
}

const stripLinks = (s) => s.replace(/\[\[([^|\]]*\|)?([^\]]*)\]\]/g, '$2');

/** Every poll in the main table, newest first (by fieldwork end date). */
export function parsePolls(t) {
  const table = t.split(/\n\{\| class="wikitable/)[1]?.split('\n|}')[0];
  if (!table) throw new Error('poll table not found');
  const rows = [];
  let year = 2026, lastMonth = 12;
  for (const row of table.split('\n|-').slice(1)) {
    const cells = row.split('\n')
      .filter((l) => /^[|!](?![-}])/.test(l) && !/^!\s*(rowspan|colspan|width|data-sort)/.test(l))
      .map((l) => l.slice(1).replace(/^[^|]*\|(?!\|)/, (m) => (/=/.test(m) ? '' : m)).trim());
    const si = cells.findIndex((c) => /^[\d,]{3,6}$/.test(c.replace(/'/g, '')));
    if (si < 2) continue;
    const num = (c) => +((String(c || '').match(/(\d+(?:\.\d+)?)%?/) || [])[1]);
    const pct = cells.slice(si + 1, si + 5).map(num);
    if (pct.some((x) => !Number.isFinite(x))) continue;
    const date = cells[0].replace(/'''?/g, '').replace(/<[^>]+>/g, '').trim();
    const months = [...date.toLowerCase().matchAll(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/g)].map((m) => MON[m[1]]);
    const yr = date.match(/20\d\d/);
    const m = months.length ? months[months.length - 1] : lastMonth;
    if (yr) year = +yr[0]; else if (m - lastMonth >= 2) year -= 1; // ranges like 'Oct–Nov' may step forward one month
    lastMonth = m;
    const day = +((date.match(/(\d{1,2})\D*$/) || date.match(/(\d{1,2})/) || [, 15])[1]);
    const firm = stripLinks(cells[1].split('<ref')[0]).replace(/'''?/g, '').trim();
    const rest = cells.slice(si + 7).map(num);
    const tpp = Number.isFinite(rest[0]) && Number.isFinite(rest[1]) && Math.abs(rest[0] + rest[1] - 100) < 1.5 ? { ALP: rest[0], LNP: rest[1] } : null;
    rows.push({ date, firm, t: Date.UTC(year, m, Math.min(day, 28)), ALP: pct[0], LNP: pct[1], GRN: pct[2], ONP: pct[3], tpp });
  }
  if (rows.length < 5) throw new Error('poll table parse: too few rows');
  return rows.map((r, i) => ({ r, i })).sort((a, b) => b.r.t - a.r.t || a.i - b.i).map((x) => x.r);
}

/** 2022 official pendulum: 88 × { seat, win, vs, margin }. LIB/NAT folded into LNP. */
export function parsePendulum(t) {
  const i = t.indexOf('===Post-election pendulum===');
  if (i < 0) throw new Error('post-election pendulum section not found');
  const out = [];
  for (const row of t.slice(i).split('\n|-')) {
    const cells = row.split('\n').filter((l) => /^\|(?![-}])/.test(l)).map((l) => {
      const c = l.slice(1); const k = c.indexOf('|');
      return (k >= 0 && c.slice(0, k).includes('=') ? c.slice(k + 1) : c).trim();
    });
    if (cells.length < 4) continue;
    const mm = cells[3].match(/^([\d.]+)%(?:\s*v\s*(\w+))?/);
    if (!mm) continue;
    const co = (p) => (p === 'LIB' || p === 'NAT' ? 'LNP' : p);
    const party = co(cells[2].replace(/'''/g, '').trim());
    const seat = stripLinks(cells[0]).replace(/\{\{.*$/, '').trim();
    out.push({ seat, win: party, vs: mm[2] ? co(mm[2]) : party === 'ALP' ? 'LNP' : 'ALP', margin: +mm[1] });
    if (out.length === 88) break;
  }
  if (out.length !== 88) throw new Error(`pendulum parse: expected 88 seats, got ${out.length}`);
  if (out.filter((s) => s.win === 'ALP').length !== 56) throw new Error('pendulum sanity check failed (Labor 56)');
  return out;
}

/** VEC daily early votes (and postal returns). */
export function parseVec(html) {
  const txt = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
  const days = [...txt.matchAll(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday) (\d{1,2}) November ([\d,]+) ([\d,]+)/g)]
    .map((m) => ({ day: m[1].slice(0, 3), date: +m[2], early: +m[3].replace(/,/g, ''), postal: +m[4].replace(/,/g, '') }));
  if (!days.length) throw new Error('VEC early vote parse failed');
  return { days, total: days.reduce((a, d) => a + d.early, 0), updated: (txt.match(/Last updated: (\d{1,2} \w+ 20\d\d)/) || [])[1] || null };
}

export const seatId = (name) => 'vic-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const avgOf = (list, k) => +(list.reduce((a, p) => a + p[k], 0) / list.length).toFixed(1);
const K = ['ALP', 'LNP', 'GRN', 'ONP'];

/** Combine the three sources into the API payload. Any source may be null (failed) — the rest still returns. */
export function buildPayload({ polls, pendulum, vec, now = Date.now() }) {
  const out = { updatedAt: new Date(now).toISOString(), sources: {}, method: 'Uniform two-party swing from the 2022 result (Labor 55.0–45.0). Labor-v-Coalition seats only. Illustrative, not a forecast.' };
  if (polls) {
    const latest = polls.slice(0, 4);
    const tpps = polls.filter((p) => p.tpp).slice(0, 4);
    const alpMin = Math.min(...polls.map((p) => p.ALP));
    out.polls = {
      count: polls.length,
      list: polls.map(({ date, firm, t, ALP, LNP, GRN, ONP, tpp }) => ({ date, firm, t, ALP, LNP, GRN, ONP, tpp })),
      newest: { ...polls[0], alpLow: polls[0].ALP <= alpMin },
      average: Object.fromEntries(K.map((k) => [k, avgOf(latest, k)])),
      averageOf: latest.map((p) => p.firm),
      tpp: tpps.length ? { ALP: avgOf(tpps.map((p) => p.tpp), 'ALP'), LNP: avgOf(tpps.map((p) => p.tpp), 'LNP'), of: tpps.map((p) => p.firm) } : null,
    };
    // rolling 4-poll average, oldest → newest
    const chron = [...polls].reverse();
    out.polls.trend = chron.map((p, i) => { const w = chron.slice(Math.max(0, i - 3), i + 1); return { t: p.t, ...Object.fromEntries(K.map((k) => [k, avgOf(w, k)])) }; });
    out.sources.polls = 'Wikipedia: Opinion polling for the 2026 Victorian state election';
  }
  if (pendulum && out.polls?.tpp) {
    const swing = +(ALP_2PP_2022 - out.polls.tpp.ALP).toFixed(1);
    const seats = {};
    for (const s of pendulum) {
      const flips = swing > 0 ? s.win === 'ALP' && s.vs === 'LNP' && s.margin < swing : s.win === 'LNP' && s.vs === 'ALP' && s.margin < -swing;
      seats[seatId(s.seat)] = { name: s.seat, win2022: s.win, vs: s.vs, margin: s.margin, projected: flips ? s.vs : s.win };
    }
    const tally = (key) => { const o = {}; for (const v of Object.values(seats)) o[v[key]] = (o[v[key]] ?? 0) + 1; return o; };
    const contested = Object.values(seats).filter((v) => v.win2022 === (swing > 0 ? 'ALP' : 'LNP') && v.vs === (swing > 0 ? 'LNP' : 'ALP'));
    const edge = [...contested].sort((a, b) => Math.abs(a.margin - Math.abs(swing)) - Math.abs(b.margin - Math.abs(swing))).slice(0, 8)
      .sort((a, b) => a.margin - b.margin).map((v) => ({ id: seatId(v.name), name: v.name, margin: v.margin, falls: v.projected !== v.win2022 }));
    out.projection = { swing, seats, before: tally('win2022'), after: tally('projected'), edge, majority: 45, total: 88 };
    out.sources.pendulum = 'Wikipedia: 2022 Victorian state election, post-election pendulum';
  }
  if (out.polls) { try { out.model = runModel(out.polls.average); out.sources.model = 'PolTok model (see method)'; } catch (e) { out.modelError = String(e?.message ?? e); } }
  if (vec) { out.earlyVotes = vec; out.sources.earlyVotes = 'Victorian Electoral Commission: early and postal vote statistics'; }
  return out;
}

/** Fetch all sources in parallel; failures are recorded, not thrown (unless everything fails). */
export async function fetchVicLive() {
  const [p, d, v] = await Promise.allSettled([
    wikiRaw(POLLS_PAGE).then(parsePolls),
    wikiRaw(PENDULUM_PAGE).then(parsePendulum),
    fetch(VEC_STATS, { headers: { ...UA, 'user-agent': 'Mozilla/5.0 ' + UA['user-agent'] }, signal: AbortSignal.timeout(9000) })
      .then((r) => { if (!r.ok) throw new Error('VEC HTTP ' + r.status); return r.text(); }).then(parseVec),
  ]);
  if (p.status === 'rejected' && d.status === 'rejected' && v.status === 'rejected') throw new Error('all Victorian live sources failed');
  const payload = buildPayload({ polls: p.value ?? null, pendulum: d.value ?? null, vec: v.value ?? null });
  payload.errors = [p, d, v].map((x, i) => (x.status === 'rejected' ? `${['polls', 'pendulum', 'earlyVotes'][i]}: ${x.reason?.message ?? x.reason}` : null)).filter(Boolean);
  return payload;
}
