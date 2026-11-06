// Build-time: find freely licensed portraits for Australian people in PolTok's AU data.
// Run: node --experimental-strip-types scripts/gen-au-photos.mts
// 1. Collect every AU person (federal MPs, senators, Vic MPs + 2026 nominees, state/party leaders).
// 2. Wikidata SPARQL (batched): human with exact en label/alias, strict role check (P39 position held, or
//    Australian citizen + Australian party for non-MP candidates); >1 qualifying item => ambiguous, rejected.
// 3. P18 image -> Commons imageinfo extmetadata; keep only CC BY / CC BY-SA / CC0 / public domain.
// 4. Write src/data/au-photos.ts keyed by normalised name (see auPhotoKey).
import { writeFileSync } from 'node:fs';
import { FEDERAL, VICTORIA, SENATORS, VIC_CANDIDATES, AU_PARTY_PROFILES } from '../src/data/au.ts';
import { VIC_NOMINATIONS } from '../src/data/au-vic.ts';
import { AU_STATES } from '../src/data/au-states.ts';
import { auPhotoKey } from '../src/data/au-photo-key.ts';

const UA = 'PolTokBot/1.0 (https://poltok.netlify.app; build-time photo licence check)';
const HOR = 'Q18912794', SEN = 'Q6814428', VLA = 'Q18534408';
const AU_POS = /Australian House of Representatives|Australian Senate|Legislative Assembly|Legislative Council|House of Assembly|Premier of|Chief Minister of|Prime Minister of Australia|Opposition/i;

type Role = 'hor' | 'sen' | 'vla' | 'leader' | 'cand';
const people = new Map<string, { name: string; roles: Set<Role> }>();
const titleCase = (s: string) => s.replace(/\b([A-Z])([A-Z']+)\b/g, (_m, a: string, b: string) => a + b.toLowerCase().replace(/'([a-z])/, (_x, c: string) => "'" + c.toUpperCase()));
function add(raw: string | undefined | null, role: Role) {
  if (!raw) return;
  for (const part of raw.split(/\s*\/\s*/)) {
    const name = titleCase(part.trim());
    if (!name || /vacant/i.test(name)) continue;
    const k = auPhotoKey(name);
    const p = people.get(k) ?? { name, roles: new Set<Role>() };
    p.roles.add(role);
    people.set(k, p);
  }
}
for (const s of FEDERAL.seats) add(s.member, 'hor');
add(FEDERAL.pm.name, 'leader'); add(FEDERAL.opposition.name, 'leader');
for (const s of SENATORS) add(s.name, 'sen');
for (const s of VICTORIA.seats) add(s.member, 'vla');
for (const list of [...Object.values(VIC_CANDIDATES.byDistrict), ...Object.values(VIC_NOMINATIONS.districts), ...Object.values(VIC_NOMINATIONS.regions)])
  for (const [n] of list) add(n, 'cand');
for (const st of AU_STATES) { add(st.head.name, 'leader'); add(st.opposition.name, 'leader'); }
for (const p of Object.values(AU_PARTY_PROFILES)) for (const l of [p.federalLeader, p.vicLeader, p.nswLeader]) add(l?.name, 'leader');

async function get(url: string, init: RequestInit = {}, tries = 6): Promise<any> {
  for (let i = 0; ; i++) {
    const r = await fetch(url, { ...init, headers: { 'User-Agent': UA, Accept: 'application/json', ...(init.headers || {}) } });
    if (r.ok) return r.json();
    if ((r.status === 429 || r.status >= 500) && i < tries) {
      const wait = Number(r.headers.get('retry-after')) * 1000 || 2000 * 2 ** i;
      console.warn(`HTTP ${r.status}, waiting ${wait}ms`);
      await new Promise((res) => setTimeout(res, wait));
      continue;
    }
    throw new Error(`HTTP ${r.status} ${url.slice(0, 120)}`);
  }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Hit { qid: string; key: string; imgs: string[]; pos: string[]; posLabels: string[]; au: boolean; auParty: boolean }
const hits: Hit[] = [];
const entries = [...people.entries()];
for (let i = 0; i < entries.length; i += 60) {
  const batch = entries.slice(i, i + 60);
  const values = batch.map(([, p]) => JSON.stringify(p.name) + '@en').join(' ');
  const q = `SELECT ?item ?name (GROUP_CONCAT(DISTINCT ?img;separator="|") AS ?imgs) (GROUP_CONCAT(DISTINCT ?pos;separator="|") AS ?poss)
 (GROUP_CONCAT(DISTINCT ?posLabel;separator="|") AS ?posLabels) (SAMPLE(?au) AS ?isAu) (SAMPLE(?ap) AS ?auParty) WHERE {
 VALUES ?name { ${values} }
 { ?item rdfs:label ?name } UNION { ?item skos:altLabel ?name }
 ?item wdt:P31 wd:Q5 .
 OPTIONAL { ?item wdt:P18 ?img }
 OPTIONAL { ?item wdt:P39 ?pos . ?pos rdfs:label ?posLabel FILTER(lang(?posLabel)="en") }
 BIND(EXISTS { ?item wdt:P27 wd:Q408 } AS ?au)
 BIND(EXISTS { ?item wdt:P102 ?pty . ?pty wdt:P17 wd:Q408 } AS ?ap)
} GROUP BY ?item ?name`;
  const j = await get('https://query.wikidata.org/sparql', {
    method: 'POST', body: new URLSearchParams({ query: q, format: 'json' }),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/sparql-results+json' },
  });
  for (const b of j.results.bindings) {
    const sp = (v?: { value: string }) => (v?.value ? v.value.split('|') : []);
    hits.push({
      qid: b.item.value.split('/').pop(), key: auPhotoKey(b.name.value),
      imgs: sp(b.imgs).map((u) => decodeURIComponent(u.split('Special:FilePath/')[1]).replace(/_/g, ' ')),
      pos: sp(b.poss).map((u) => u.split('/').pop()!), posLabels: sp(b.posLabels),
      au: b.isAu?.value === 'true', auParty: b.auParty?.value === 'true',
    });
  }
  console.log(`sparql ${Math.min(i + 60, entries.length)}/${entries.length}`);
  await sleep(1000);
}

function qualifies(h: Hit, roles: Set<Role>): boolean {
  if (roles.has('hor') && h.pos.includes(HOR)) return true;
  if (roles.has('sen') && h.pos.includes(SEN)) return true;
  if (roles.has('vla') && h.pos.includes(VLA)) return true;
  if ((roles.has('leader') || roles.has('cand')) && h.posLabels.some((l) => AU_POS.test(l)) && (h.au || h.auParty || h.pos.some((p) => [HOR, SEN, VLA].includes(p)))) return true;
  if (roles.has('cand') && h.au && h.auParty) return true;
  return false;
}

const matched = new Map<string, { qid: string; file?: string }>();
let ambiguous = 0;
for (const [k, p] of people) {
  const qs = [...new Map(hits.filter((h) => h.key === k && qualifies(h, p.roles)).map((h) => [h.qid, h])).values()];
  if (qs.length > 1) { ambiguous++; console.warn(`ambiguous: ${p.name} -> ${qs.map((q) => q.qid).join(',')}`); continue; }
  if (qs.length === 1) matched.set(k, { qid: qs[0].qid, file: qs[0].imgs[0] });
}

// Commons licence check
const FREE = /^(CC BY(-SA)?( \d(\.\d)?)?( [a-z]{2,3})?|CC0( 1\.0)?|Public domain|PD[- ].*|Attribution)$/i;
const NONFREE = /\bNC\b|\bND\b|non-?commercial|no ?deriv|fair use|non-free|copyrighted/i;
const strip = (s = '') => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/\s+/g, ' ').trim();
const files = [...new Set([...matched.values()].map((m) => m.file).filter(Boolean))] as string[];
const info = new Map<string, any>();
for (let i = 0; i < files.length; i += 50) {
  const titles = files.slice(i, i + 50).map((f) => 'File:' + f).join('|');
  const u = 'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({
    action: 'query', format: 'json', formatversion: '2', prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '256',
    iiextmetadatafilter: 'LicenseShortName|LicenseUrl|Artist|Credit|UsageTerms|NonFree|Restrictions', titles, maxlag: '5',
  });
  const j = await get(u);
  const norm = new Map<string, string>((j.query.normalized ?? []).map((n: any) => [n.to, n.from]));
  for (const pg of j.query.pages) {
    const ii = pg.imageinfo?.[0];
    if (ii) info.set((norm.get(pg.title) ?? pg.title).replace(/^File:/, ''), ii);
    if (ii) info.set(pg.title.replace(/^File:/, ''), ii);
  }
  await sleep(500);
}

const out: Record<string, { f: string; a: string; l: string; u: string; q: string }> = {};
let noImg = 0, rejected = 0;
for (const [k, m] of matched) {
  if (!m.file) { noImg++; continue; }
  const ii = info.get(m.file);
  const md = ii?.extmetadata ?? {};
  const lic = strip(md.LicenseShortName?.value);
  if (!ii || !lic || !FREE.test(lic) || NONFREE.test(lic) || md.NonFree?.value === 'true') { rejected++; console.warn(`licence rejected: ${people.get(k)!.name} ${m.file} [${lic}]`); continue; }
  const author = strip(md.Artist?.value) || strip(md.Credit?.value) || 'Unknown author';
  out[k] = { f: m.file, a: author.slice(0, 90), l: lic, u: md.LicenseUrl?.value ?? '', q: m.qid };
}

const total = people.size;
const generated = new Date().toISOString().slice(0, 10);
const summary = `${total} people, ${matched.size} matched on Wikidata (${ambiguous} ambiguous rejected), ${matched.size - noImg} with P18 image, ${Object.keys(out).length} freely licensed (${rejected} rejected on licence)`;
console.log(summary);
const body = `// GENERATED by scripts/gen-au-photos.mts on ${generated} — do not hand-edit.
// Wikidata (P18) portraits of AU people, kept only when the Commons file licence is CC BY / CC BY-SA / CC0 / public domain.
// ${summary}
// f = Commons file (thumb = Special:FilePath ?width=256, source = File: page; see src/data/au-photo-key.ts), a = author, l = licence, u = licence URL, q = Wikidata item.
export interface AuPhotoRec { f: string; a: string; l: string; u: string; q: string }
export const AU_PHOTOS_GENERATED = ${JSON.stringify(generated)};
export const AU_PHOTOS: Record<string, AuPhotoRec> = ${JSON.stringify(out)};
`;
writeFileSync(new URL('../src/data/au-photos.ts', import.meta.url), body);
