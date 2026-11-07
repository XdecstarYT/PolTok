// Build-time: unified people-photo index for non-AU, non-US-Congress people (AU lives in gen-au-photos.mts,
// US members use the public-domain unitedstates/images bioguide portraits at runtime; 2026 US candidates use
// the AP headshots delivered in the NYT results feed).
// Run: node --experimental-strip-types scripts/gen-photos.mts
// Groups:
//   nz    — every 2026 NZ electorate candidate + party leaders. Strict: Wikidata human with exact en label/alias AND
//           (NZ citizen, NZ party member, or a P39 position mentioning New Zealand). >1 qualifying item => rejected.
//   us    — 2028 presidential contenders (curated list). Strict: exact label AND US citizen AND (P39 US office or US party).
//   world — current heads of state/government of sovereign states, keyed by the person's Wikidata QID (identity by QID).
// Every P18 file is licence-checked on Commons (CC BY / BY-SA / CC0 / PD only). Writes src/data/photos/generated.ts.
import { writeFileSync, mkdirSync } from 'node:fs';
import { NZ_ELECTORATES } from '../src/features/nz/generated.ts';
import { readFileSync } from 'node:fs';
import { personKey } from '../src/data/photos/key.ts';

const UA = 'PolTokBot/1.0 (https://poltok.netlify.app; build-time photo licence check)';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function get(url: string, init: RequestInit = {}, tries = 6): Promise<any> {
  for (let i = 0; ; i++) {
    const r = await fetch(url, { ...init, headers: { 'User-Agent': UA, Accept: 'application/json', ...(init.headers || {}) } });
    if (r.ok) return r.json();
    if ((r.status === 429 || r.status >= 500) && i < tries) { await sleep(Number(r.headers.get('retry-after')) * 1000 || 2000 * 2 ** i); continue; }
    throw new Error(`HTTP ${r.status} ${url.slice(0, 120)}`);
  }
}
const sparql = (q: string) => get('https://query.wikidata.org/sparql', {
  method: 'POST', body: new URLSearchParams({ query: q, format: 'json' }),
  headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/sparql-results+json' },
});
const fileOf = (u: string) => decodeURIComponent(u.split('Special:FilePath/')[1]).replace(/_/g, ' ');

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
export const US_2028 = ['Gavin Newsom', 'JD Vance', 'Alexandria Ocasio-Cortez', 'Pete Buttigieg', 'Josh Shapiro', 'Marco Rubio',
  'Gretchen Whitmer', 'Wes Moore', 'Andy Beshear', 'JB Pritzker', 'Kamala Harris', 'Ron DeSantis', 'Donald Trump Jr.',
  'Tucker Carlson', 'Cory Booker', 'Ro Khanna', 'Rahm Emanuel', 'Mark Cuban', 'Jon Ossoff', 'Ruben Gallego', 'Raphael Warnock',
  'Chris Murphy', 'Tim Walz', 'Glenn Youngkin', 'Vivek Ramaswamy', 'Ted Cruz', 'Rand Paul', 'Marjorie Taylor Greene',
  'Donald Trump', 'Nikki Haley', 'Mark Kelly', 'Amy Klobuchar', 'Jasmine Crockett', 'Stephen A. Smith', 'Phil Murphy',
  'Roy Cooper', 'Gina Raimondo', 'Elissa Slotkin', 'Byron Donalds', 'Sarah Huckabee Sanders', 'Brian Kemp', 'Greg Abbott',
  'Kristi Noem', 'James Talarico', 'Thomas Massie', 'John McEntee', 'Josh Hawley', 'Tom Cotton', 'Mike Pence', 'Michelle Obama', 'Hillary Clinton', 'Jared Polis', 'Andy Kim'];
for (const n of US_2028) add(n, 'us');

interface Hit { qid: string; key: string; img?: string; posLabels: string[]; cit: boolean; party: boolean }
const hits: Hit[] = [];
const entries = [...people.entries()];
for (let i = 0; i < entries.length; i += 60) {
  const batch = entries.slice(i, i + 60);
  for (const g of ['nz', 'us'] as Group[]) {
    const names = batch.filter(([, p]) => p.group === g);
    if (!names.length) continue;
    const c = COUNTRY[g].q;
    const q = `SELECT ?item ?name (SAMPLE(?img) AS ?im) (GROUP_CONCAT(DISTINCT ?posLabel;separator="|") AS ?pl) (SAMPLE(?ci) AS ?cit) (SAMPLE(?pa) AS ?par) WHERE {
 VALUES ?name { ${names.map(([, p]) => JSON.stringify(p.name) + '@en').join(' ')} }
 { ?item rdfs:label ?name } UNION { ?item skos:altLabel ?name }
 ?item wdt:P31 wd:Q5 .
 OPTIONAL { ?item wdt:P18 ?img }
 OPTIONAL { ?item wdt:P39 ?pos . ?pos rdfs:label ?posLabel FILTER(lang(?posLabel)="en") }
 BIND(EXISTS { ?item wdt:P27 wd:${c} } AS ?ci)
 BIND(EXISTS { ?item wdt:P102 ?pty . ?pty wdt:P17 wd:${c} } AS ?pa)
} GROUP BY ?item ?name`;
    const j = await sparql(q);
    for (const b of j.results.bindings) hits.push({
      qid: b.item.value.split('/').pop(), key: `${g}:${personKey(b.name.value)}`, img: b.im ? fileOf(b.im.value) : undefined,
      posLabels: b.pl?.value ? b.pl.value.split('|') : [], cit: b.cit?.value === 'true', party: b.par?.value === 'true',
    });
    await sleep(800);
  }
  console.log(`sparql ${Math.min(i + 60, entries.length)}/${entries.length}`);
}
const qualifies = (h: Hit, g: Group) => g === 'nz'
  ? (h.party || h.posLabels.some((l) => COUNTRY.nz.pos.test(l)))
  : (h.cit && (h.party || h.posLabels.some((l) => COUNTRY.us.pos.test(l)) || ['Tucker Carlson', 'Mark Cuban', 'Stephen A. Smith', 'Michelle Obama', 'Donald Trump Jr.'].some((n) => h.key === `us:${personKey(n)}`)));

const matched = new Map<string, { qid: string; file?: string }>();
const stats: Record<string, { total: number; matched: number; ambiguous: number; img: number; free: number }> = {};
const st = (g: string) => (stats[g] ??= { total: 0, matched: 0, ambiguous: 0, img: 0, free: 0 });
for (const [k, p] of people) {
  st(p.group).total++;
  const qs = [...new Map(hits.filter((h) => h.key === k && qualifies(h, p.group)).map((h) => [h.qid, h])).values()];
  if (qs.length > 1) { st(p.group).ambiguous++; console.warn(`ambiguous: ${p.name} -> ${qs.map((q) => q.qid)}`); continue; }
  if (qs.length === 1) { st(p.group).matched++; matched.set(k, { qid: qs[0].qid, file: qs[0].img }); }
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
  matched.set(`qid:${qid}`, { qid, file: b.im ? fileOf(b.im.value) : undefined });
}

const FREE = /^(CC BY(-SA)?( \d(\.\d)?)?( [a-z]{2,3})?|CC0( 1\.0)?|Public domain|PD[- ].*|PDM[- ].*|Attribution|OGL 3|KOGL Type 1|GODL-India)$/i; // OGL/KOGL/GODL = open government licences (reuse with attribution)
const NONFREE = /\bNC\b|\bND\b|non-?commercial|no ?deriv|fair use|non-free|copyrighted/i;
const strip = (s = '') => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/\s+/g, ' ').trim();
const files = [...new Set([...matched.values()].map((m) => m.file).filter(Boolean))] as string[];
const info = new Map<string, any>();
for (let i = 0; i < files.length; i += 50) {
  const u = 'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({
    action: 'query', format: 'json', formatversion: '2', prop: 'imageinfo', iiprop: 'extmetadata',
    iiextmetadatafilter: 'LicenseShortName|LicenseUrl|Artist|Credit|NonFree', titles: files.slice(i, i + 50).map((f) => 'File:' + f).join('|'), maxlag: '5',
  });
  const j = await get(u);
  const norm = new Map<string, string>((j.query.normalized ?? []).map((n: any) => [n.to, n.from]));
  for (const pg of j.query.pages) {
    const ii = pg.imageinfo?.[0];
    if (!ii) continue;
    info.set(pg.title.replace(/^File:/, ''), ii);
    if (norm.has(pg.title)) info.set(norm.get(pg.title)!.replace(/^File:/, ''), ii);
  }
  await sleep(400);
}
const out: Record<string, { f: string; a: string; l: string; u: string; q: string }> = {};
for (const [k, m] of matched) {
  if (!m.file) continue;
  const g = k.split(':')[0] === 'qid' ? 'world' : k.split(':')[0];
  st(g).img++;
  const md = info.get(m.file)?.extmetadata ?? {};
  const lic = strip(md.LicenseShortName?.value);
  if (!lic || !FREE.test(lic) || NONFREE.test(lic) || md.NonFree?.value === 'true') { console.warn(`licence rejected: ${k} ${m.file} [${lic}]`); continue; }
  st(g).free++;
  out[k] = { f: m.file, a: (strip(md.Artist?.value) || strip(md.Credit?.value) || 'Unknown author').slice(0, 90), l: lic, u: md.LicenseUrl?.value ?? '', q: m.qid };
}
console.log(JSON.stringify(stats));
const generated = new Date().toISOString().slice(0, 10);
mkdirSync(new URL('../src/data/photos/', import.meta.url), { recursive: true });
writeFileSync(new URL('../src/data/photos/generated.ts', import.meta.url), `// GENERATED by scripts/gen-photos.mts on ${generated} — do not hand-edit.
// Wikidata P18 portraits, kept only when the Commons licence is CC BY / BY-SA / CC0 / public domain.
// Keys: nz:<name key> (NZ 2026 candidates/leaders), us:<name key> (2028 contenders), qid:<Wikidata QID> (current world leaders).
// f = Commons file, a = author, l = licence, u = licence URL, q = Wikidata item.
export const PHOTOS_GENERATED = ${JSON.stringify(generated)};
export const PHOTO_STATS: Record<string, { total: number; matched: number; ambiguous: number; img: number; free: number }> = ${JSON.stringify(stats)};
export const PHOTOS: Record<string, { f: string; a: string; l: string; u: string; q: string }> = ${JSON.stringify(out)};
`);
