// Build-time: unified people-photo index for non-AU, non-US-Congress people (AU lives in gen-au-photos.mts,
// US members use the public-domain unitedstates/images bioguide portraits at runtime; 2026 US candidates use
// the AP headshots delivered in the NYT results feed).
// Run: node --experimental-strip-types scripts/gen-photos.mts
// Groups:
//   nz    — every 2026 NZ electorate candidate + party leaders. Strict: Wikidata human with exact en label/alias AND
//           (NZ citizen, NZ party member, or a P39 position mentioning New Zealand). >1 qualifying item => rejected.
//   us    — 2028 presidential contenders (curated list). Strict: exact label AND US citizen AND (P39 US office or US party).
//   us26  — every named 2026 Senate / Governor / House candidate in the AP results feed (via NYT). Strict: exact label
//           (name variants incl. middle name / suffix) AND US citizen AND the candidate's own state named in a P39 office or
//           its P768 district. >1 qualifying item, or two candidates sharing a name key, => rejected.
//   world — current heads of state/government of sovereign states, keyed by the person's Wikidata QID (identity by QID).
// Second pass for NZ: names that matched nothing are retried against every NZ-party member / NZ MP by name key, which
// catches Wikidata labels with middle names (still strict: one qualifying item per key, else rejected).
// Matched people with no usable P18 fall back to a Commons file that depicts exactly them (P180) or sits in their own
// category (P373) and names their surname; US members with neither fall back to their public-domain bioguide portrait.
// Every P18 file is licence-checked on Commons (CC BY / BY-SA / CC0 / PD only). Writes src/data/photos/generated.ts.
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { NZ_ELECTORATES } from '../src/features/nz/generated.ts';
import { personKey } from '../src/data/photos/key.ts';
import { US_2028 } from './us-2028.mts';
import { get, sparql, fileOf, sleep, commonsInfo, licensed, resolveFallbacks, type PhotoRec } from './photo-lib.mts';

type Group = 'nz' | 'us';
const COUNTRY: Record<Group, { q: string; pos: RegExp }> = {
  nz: { q: 'Q664', pos: /New Zealand/i },
  us: { q: 'Q30', pos: /United States|Governor of|Vice President|Secretary of|Mayor of|President of the United States/i },
};
const people = new Map<string, { name: string; group: Group }>();
const add = (name: string, group: Group) => {
  for (const part of name.replace(/\(.*?\)/g, '').split(/\s*(?:&|\/| and )\s*/)) {
    const n = part.trim();
    if (!n || n === '—') continue;
    people.set(`${group}:${personKey(n)}`, { name: n, group });
  }
};
for (const e of NZ_ELECTORATES) for (const c of e.candidates) add(c.name, 'nz');
for (const m of readFileSync(new URL('../src/features/nz/data.ts', import.meta.url), 'utf8').matchAll(/leader: '([^']+)'/g)) add(m[1], 'nz');
for (const n of US_2028) add(n, 'us');
export { US_2028 };

/* ---- us26: every named 2026 candidate in the AP results feed (via NYT) ---- */
const STATE_NAME: Record<string, string> = { AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming' };
interface UsCand { key: string; labels: string[]; state: string; surname: string }
const us26 = new Map<string, UsCand>();
const us26Clash = new Set<string>();
const NYT = 'https://static01.nyt.com/elections-assets/pages/data/2026-11-03';
for (const kind of ['senate', 'governor', 'house']) {
  // NYT_DIR: optional folder holding results-{senate,governor,house}.json already downloaded (e.g. with curl).
  const doc: any = process.env.NYT_DIR ? JSON.parse(readFileSync(`${process.env.NYT_DIR}/results-${kind}.json`, 'utf8')) : await (await fetch(`${NYT}/results-${kind}.json`)).json();
  for (const r of doc.races ?? []) {
    if (String(r.nyt_id).startsWith('US-')) continue;
    const st = r.top_reporting_unit?.state_postal || String(r.nyt_id).slice(0, 2);
    if (!STATE_NAME[st]) continue;
    for (const m of Object.values<any>(r.candidate_metadata ?? {})) {
      if (!m.first_name || !m.last_name) continue;
      const base = `${m.first_name} ${m.last_name}`;
      if (/write-?in|uncommitted/i.test(base)) continue;
      const key = `us26:${personKey(base)}`;
      const prev = us26.get(key);
      if (prev && prev.state !== st) { us26Clash.add(key); continue; }
      const sfx = m.suffix ? ` ${m.suffix}` : '';
      const labels = new Set([base, `${base}${sfx}`, `${base},${sfx}`]);
      if (m.middle_name) { labels.add(`${m.first_name} ${m.middle_name} ${m.last_name}`); labels.add(`${m.first_name} ${m.middle_name} ${m.last_name}${sfx}`); labels.add(`${m.first_name} ${String(m.middle_name)[0]}. ${m.last_name}`); }
      us26.set(key, { key, labels: [...labels].map((l) => l.trim()).filter((l) => !/,$/.test(l)), state: st, surname: m.last_name });
    }
  }
}
for (const k of us26Clash) us26.delete(k);
console.log(`us26: ${us26.size} candidates (${us26Clash.size} name keys shared across states, skipped)`);

interface Hit { qid: string; key: string; img?: string; cat?: string; bg?: string; posLabels: string[]; ctx: string; cit: boolean; party: boolean }
const hits: Hit[] = [];
const sp = (v?: { value: string }) => (v?.value ? v.value.split('|') : []);
async function lookup(names: { label: string; key: string }[], c: string) {
  for (let i = 0; i < names.length; i += 80) {
    const batch = names.slice(i, i + 80);
    const keyOf = new Map(batch.map((b) => [b.label, b.key]));
    const q = `SELECT ?item ?name (SAMPLE(?img) AS ?im) (SAMPLE(?cat) AS ?ct) (SAMPLE(?bg) AS ?bgid) (GROUP_CONCAT(DISTINCT ?posLabel;separator="|") AS ?pl)
 (GROUP_CONCAT(DISTINCT ?dl;separator="|") AS ?dls) (SAMPLE(?ci) AS ?cit) (SAMPLE(?pa) AS ?par) WHERE {
 VALUES ?name { ${batch.map((p) => JSON.stringify(p.label) + '@en').join(' ')} }
 { ?item rdfs:label ?name } UNION { ?item skos:altLabel ?name }
 ?item wdt:P31 wd:Q5 .
 OPTIONAL { ?item wdt:P18 ?img }
 OPTIONAL { ?item wdt:P373 ?cat }
 OPTIONAL { ?item wdt:P1157 ?bg }
 OPTIONAL { ?item wdt:P39 ?pos . ?pos rdfs:label ?posLabel FILTER(lang(?posLabel)="en") }
 OPTIONAL { ?item p:P39 ?ps . ?ps pq:P768 ?d . ?d rdfs:label ?dl FILTER(lang(?dl)="en") }
 BIND(EXISTS { ?item wdt:P27 wd:${c} } AS ?ci)
 BIND(EXISTS { ?item wdt:P102 ?pty . ?pty wdt:P17 wd:${c} } AS ?pa)
} GROUP BY ?item ?name`;
    const j = await sparql(q);
    for (const b of j.results.bindings) {
      const key = keyOf.get(b.name.value);
      if (!key) continue;
      const pl = sp(b.pl);
      hits.push({
        qid: b.item.value.split('/').pop(), key, img: b.im ? fileOf(b.im.value) : undefined, cat: b.ct?.value, bg: b.bgid?.value,
        posLabels: pl, ctx: [...pl, ...sp(b.dls)].join(' | '), cit: b.cit?.value === 'true', party: b.par?.value === 'true',
      });
    }
    console.log(`sparql ${c} ${Math.min(i + 80, names.length)}/${names.length}`);
    await sleep(700);
  }
}
await lookup([...people.entries()].filter(([, p]) => p.group === 'nz').map(([k, p]) => ({ label: p.name, key: k })), 'Q664');
await lookup([...people.entries()].filter(([, p]) => p.group === 'us').map(([k, p]) => ({ label: p.name, key: k })), 'Q30');
await lookup([...us26.values()].flatMap((c) => c.labels.map((label) => ({ label, key: c.key }))), 'Q30');

const US_NONPOL = ['Tucker Carlson', 'Mark Cuban', 'Stephen A. Smith', 'Michelle Obama', 'Donald Trump Jr.'].map((n) => `us:${personKey(n)}`);
function qualifies(h: Hit, key: string): boolean {
  const g = key.split(':')[0];
  if (g === 'nz') return h.party || h.posLabels.some((l) => COUNTRY.nz.pos.test(l));
  if (g === 'us') return h.cit && (h.party || h.posLabels.some((l) => COUNTRY.us.pos.test(l)) || US_NONPOL.includes(key));
  const c = us26.get(key)!;
  const ctx = h.ctx.replace(/Washington,? D\.?C\.?|District of Columbia/g, '');
  return h.cit && new RegExp(`${c.state === 'VA' ? '(?<!West )' : ''}\\b${STATE_NAME[c.state]}\\b`).test(ctx);
}

interface Match { qid: string; file?: string; cat?: string; bg?: string; name: string }
const matched = new Map<string, Match>();
const stats: Record<string, { total: number; matched: number; ambiguous: number; img: number; free: number; fallback?: number; bioguide?: number }> = {};
const st = (g: string) => (stats[g] ??= { total: 0, matched: 0, ambiguous: 0, img: 0, free: 0 });
const nameOf = (k: string) => people.get(k)?.name ?? us26.get(k)?.labels[0] ?? k;
const allKeys = [...people.keys(), ...us26.keys()];
const ambiguousKeys = new Set<string>();
for (const k of allKeys) {
  const g = k.split(':')[0];
  st(g).total++;
  const qs = [...new Map(hits.filter((h) => h.key === k && qualifies(h, k)).map((h) => [h.qid, h])).values()];
  if (qs.length > 1) { st(g).ambiguous++; ambiguousKeys.add(k); console.warn(`ambiguous: ${nameOf(k)} -> ${qs.map((q) => q.qid)}`); continue; }
  if (qs.length === 1) { st(g).matched++; matched.set(k, { qid: qs[0].qid, file: qs[0].img, cat: qs[0].cat, bg: qs[0].bg, name: nameOf(k) }); }
}

// NZ second pass: unmatched names vs. every NZ party member / NZ MP, matched on the same first+last name key.
const nzMissing = [...people.entries()].filter(([k, p]) => p.group === 'nz' && !matched.has(k) && !ambiguousKeys.has(k));
if (nzMissing.length) {
  const pool = await sparql(`SELECT ?item ?lab (SAMPLE(?img) AS ?im) (SAMPLE(?cat) AS ?ct) WHERE {
 { ?item wdt:P102 ?pty . ?pty wdt:P17 wd:Q664 } UNION { ?item wdt:P39 wd:Q18145518 }
 ?item wdt:P31 wd:Q5 .
 { ?item rdfs:label ?lab FILTER(lang(?lab)="en") } UNION { ?item skos:altLabel ?lab FILTER(lang(?lab)="en") }
 OPTIONAL { ?item wdt:P18 ?img } OPTIONAL { ?item wdt:P373 ?cat }
} GROUP BY ?item ?lab`);
  const byKey = new Map<string, Map<string, { img?: string; cat?: string }>>();
  for (const b of pool.results.bindings) {
    const k = `nz:${personKey(b.lab.value)}`;
    const m = byKey.get(k) ?? new Map();
    m.set(b.item.value.split('/').pop(), { img: b.im ? fileOf(b.im.value) : undefined, cat: b.ct?.value });
    byKey.set(k, m);
  }
  let rescued = 0;
  for (const [k, p] of nzMissing) {
    const m = byKey.get(k);
    if (!m) continue;
    if (m.size > 1) { st('nz').ambiguous++; console.warn(`ambiguous (pool): ${p.name} -> ${[...m.keys()]}`); continue; }
    const [[qid, v]] = [...m.entries()];
    if ([...matched.values()].some((x) => x.qid === qid)) continue; // already someone else's item
    matched.set(k, { qid, file: v.img, cat: v.cat, name: p.name }); st('nz').matched++; rescued++;
  }
  console.log(`nz pool pass rescued ${rescued}/${nzMissing.length}`);
}

// World leaders: current (no end time) P6 head of government / P35 head of state of sovereign states.
const wj = await sparql(`SELECT ?person (SAMPLE(?img) AS ?im) WHERE {
 ?country wdt:P31 wd:Q3624078 . FILTER NOT EXISTS { ?country wdt:P576 [] }
 { ?country p:P6 ?s . ?s ps:P6 ?person } UNION { ?country p:P35 ?s . ?s ps:P35 ?person }
 FILTER NOT EXISTS { ?s pq:P582 [] } ?person wdt:P31 wd:Q5 . OPTIONAL { ?person wdt:P18 ?img }
} GROUP BY ?person`);
for (const b of wj.results.bindings) {
  const qid = b.person.value.split('/').pop();
  st('world').total++; st('world').matched++;
  matched.set(`qid:${qid}`, { qid, file: b.im ? fileOf(b.im.value) : undefined, name: qid });
}

const info = await commonsInfo([...matched.values()].map((m) => m.file).filter(Boolean) as string[]);
type OutRec = PhotoRec | { b: string; q: string };
const out: Record<string, OutRec> = {};
const needFallback: { key: string; qid: string; surname: string; category?: string }[] = [];
for (const [k, m] of matched) {
  const g = k.split(':')[0] === 'qid' ? 'world' : k.split(':')[0];
  if (m.file) {
    st(g).img++;
    const { rec, lic } = licensed(m.file, info.get(m.file), m.qid);
    if (rec) { st(g).free++; out[k] = rec; continue; }
    console.warn(`licence rejected: ${k} ${m.file} [${lic}]`);
  }
  if (g !== 'world') needFallback.push({ key: k, qid: m.qid, surname: us26.get(k)?.surname ?? m.name.trim().split(/\s+/).pop()!, category: m.cat });
}
console.log(`fallback search for ${needFallback.length} matched people without a usable P18`);
for (const [k, rec] of await resolveFallbacks(needFallback)) {
  const g = k.split(':')[0];
  out[k] = rec; st(g).free++; st(g).fallback = (st(g).fallback ?? 0) + 1;
}
// US members of Congress still without a Commons portrait: official public-domain bioguide portrait, if published.
for (const [k, m] of matched) {
  if (out[k] || !m.bg || !k.startsWith('us')) continue;
  const r = await fetch(`https://unitedstates.github.io/images/congress/225x275/${m.bg}.jpg`, { method: 'HEAD' }).catch(() => null);
  if (r?.ok) { out[k] = { b: m.bg, q: m.qid }; const g = k.split(':')[0]; st(g).free++; st(g).bioguide = (st(g).bioguide ?? 0) + 1; }
  await sleep(50);
}
console.log(JSON.stringify(stats));
const generated = new Date().toISOString().slice(0, 10);
mkdirSync(new URL('../src/data/photos/', import.meta.url), { recursive: true });
const pick = (us26: boolean) => Object.fromEntries(Object.entries(out).filter(([k]) => k.startsWith('us26:') === us26));
const HEAD = `// GENERATED by scripts/gen-photos.mts on ${generated} — do not hand-edit. Loaded lazily (see ./store.ts).
// Wikidata-matched portraits, kept only when the Commons licence is CC BY / BY-SA / CC0 / public domain / open-government.
// f = Commons file, a = author, l = licence, u = licence URL, q = Wikidata item; b = bioguide id (public-domain congressional portrait).`;
const REC = '{ f: string; a: string; l: string; u: string; q: string } | { b: string; q: string }';
writeFileSync(new URL('../src/data/photos/generated.ts', import.meta.url), `${HEAD}
// Keys: nz:<name key> (NZ 2026 candidates/leaders), us:<name key> (2028 contenders), qid:<Wikidata QID> (current world leaders).
export const PHOTOS_GENERATED = ${JSON.stringify(generated)};
export const PHOTO_STATS: Record<string, { total: number; matched: number; ambiguous: number; img: number; free: number; fallback?: number; bioguide?: number }> = ${JSON.stringify(stats)};
export const PHOTOS: Record<string, ${REC}> = ${JSON.stringify(pick(false))};
`);
writeFileSync(new URL('../src/data/photos/generated-us26.ts', import.meta.url), `${HEAD}
// Keys: us26:<name key> — 2026 US Senate / Governor / House candidates (fallback when the AP feed has no headshot).
export const PHOTOS: Record<string, ${REC}> = ${JSON.stringify(pick(true))};
`);
