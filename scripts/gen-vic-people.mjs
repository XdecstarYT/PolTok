#!/usr/bin/env node
// Generate src/data/vic-people.json: public biographical facts for 2026 Victorian candidates who have a Wikidata/Wikipedia
// entry. Wikidata (CC0): positions held (with dates), party, education, occupation, birth year. Wikipedia (CC BY-SA, credited
// on the page): the article's lead summary. A match is only kept when it is unambiguous: a human, Australian, a politician
// (or holds a political position), AND — for candidates of the big parties — a member of that same party. Everyone else
// simply has no biography (the page says so); nothing is guessed.
import fs from 'node:fs';

const ROOT = new URL('..', import.meta.url);
const CANDS = JSON.parse(fs.readFileSync(new URL('shared/au/vic-candidates-2026.json', ROOT), 'utf8'));
const UA = { 'user-agent': 'PolTok/1.0 (election data; https://poltok.netlify.app)' };
const PARTY_RE = { ALP: /labor/i, LIB: /liberal/i, NAT: /national/i, GRN: /green/i, ONP: /one nation/i };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url) {
  for (let i = 0; i < 4; i++) {
    try { const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(20000) }); if (r.ok) return r.json(); if (r.status === 404) return null; } catch {}
    await sleep(800 * (i + 1));
  }
  return null;
}
const labelCache = new Map();
async function labels(ids) {
  const need = [...new Set(ids)].filter((q) => !labelCache.has(q));
  for (let i = 0; i < need.length; i += 45) {
    const j = await get(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${need.slice(i, i + 45).join('|')}&props=labels&languages=en&format=json`);
    for (const [q, e] of Object.entries(j?.entities ?? {})) labelCache.set(q, e.labels?.en?.value ?? q);
  }
  return (q) => labelCache.get(q) ?? q;
}
const vals = (e, p) => (e.claims?.[p] ?? []).map((c) => c.mainsnak?.datavalue?.value).filter(Boolean);
const qid = (v) => (typeof v === 'object' && v.id) || null;
const year = (t) => (t?.time ? +t.time.slice(1, 5) : null);

async function lookup(name, party) {
  const s = await get(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(name)}&language=en&type=item&limit=6&format=json`);
  const ids = (s?.search ?? []).map((x) => x.id);
  if (!ids.length) return null;
  const j = await get(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids.join('|')}&props=claims|sitelinks|descriptions|labels&languages=en&sitefilter=enwiki&format=json`);
  const hits = [];
  for (const id of ids) {
    const e = j?.entities?.[id]; if (!e) continue;
    if (!vals(e, 'P31').some((v) => qid(v) === 'Q5')) continue; // human
    const aus = vals(e, 'P27').some((v) => qid(v) === 'Q408') || /australian/i.test(e.descriptions?.en?.value ?? '');
    const pol = vals(e, 'P106').some((v) => qid(v) === 'Q82955') || vals(e, 'P39').length > 0 || /politician/i.test(e.descriptions?.en?.value ?? '');
    if (!aus || !pol) continue;
    hits.push(e);
  }
  if (!hits.length) return null;
  // party check for the big parties
  const L = await labels(hits.flatMap((e) => vals(e, 'P102').map(qid).filter(Boolean)));
  const ok = hits.filter((e) => {
    const re = PARTY_RE[party]; if (!re) return true;
    const ps = vals(e, 'P102').map(qid).filter(Boolean).map(L);
    return ps.some((p) => re.test(p)) || re.test(e.descriptions?.en?.value ?? '');
  });
  if (ok.length !== 1) return null; // ambiguous or no party match: skip rather than guess
  const e = ok[0];
  const born = year(vals(e, 'P569')[0]), died = vals(e, 'P570').length;
  if (died || (born && born < 1935)) return null; // a historical namesake, not this candidate
  const pos = (e.claims?.P39 ?? []).map((c) => ({ q: qid(c.mainsnak?.datavalue?.value), from: year(c.qualifiers?.P580?.[0]?.datavalue?.value), to: year(c.qualifiers?.P582?.[0]?.datavalue?.value) })).filter((x) => x.q);
  const edu = vals(e, 'P69').map(qid).filter(Boolean), occ = vals(e, 'P106').map(qid).filter(Boolean), parties = vals(e, 'P102').map(qid).filter(Boolean);
  const L2 = await labels([...pos.map((x) => x.q), ...edu, ...occ, ...parties]);
  const title = e.sitelinks?.enwiki?.title;
  let summary = null, wiki = null;
  if (title) {
    const w = await get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`);
    if (w?.extract) { summary = w.extract.split(/(?<=\.)\s+/).slice(0, 4).join(' '); wiki = w.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`; }
  }
  return {
    qid: e.id, desc: e.descriptions?.en?.value ?? null, wiki, summary,
    born: year(vals(e, 'P569')[0]),
    positions: pos.map((x) => ({ label: L2(x.q), from: x.from, to: x.to })).sort((a, b) => (b.from ?? 0) - (a.from ?? 0)).slice(0, 12),
    education: edu.map(L2).slice(0, 4), occupations: occ.map(L2).filter((o) => !/^Q\d+$/.test(o)).slice(0, 5), parties: parties.map(L2).slice(0, 4),
  };
}

const jobs = Object.entries(CANDS.districts).flatMap(([id, list]) => list.map(([n, p]) => ({ id, n, p })));
const people = {}; let done = 0, found = 0;
const queue = [...jobs];
await Promise.all(Array.from({ length: 4 }, async () => {
  while (queue.length) {
    const j = queue.shift();
    try { const r = await lookup(j.n, j.p); if (r) { people[`${j.id}|${j.n}`] = r; found++; } } catch {}
    if (++done % 25 === 0) process.stdout.write(`${done}/${jobs.length} found ${found}\r`);
    await sleep(120);
  }
}));
fs.writeFileSync(new URL('src/data/vic-people.json', ROOT), JSON.stringify({ asAt: new Date().toISOString().slice(0, 10), sources: { wikidata: 'Wikidata (CC0)', wikipedia: 'Wikipedia (CC BY-SA 4.0)' }, people }));
console.log(`\n${found} of ${jobs.length} candidates matched`);
