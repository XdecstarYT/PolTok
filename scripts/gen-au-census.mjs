// Generates src/data/au-census.ts: ABS Census 2021 key stats per federal division (CED) and
// Victorian district (SED), from the ABS Data API (https://data.api.abs.gov.au, SDMX CSV).
// Source: Australian Bureau of Statistics, Census of Population and Housing 2021, General Community
// Profile tables G01, G02, G08, G37, G54 — licensed CC BY 4.0 (https://www.abs.gov.au/website-privacy-copyright-and-disclaimer).
// NOTE: the ABS publishes these tables on ASGS 2021 boundaries (CED 2021 = 151 divisions used at the 2022
// election; SED 2021 = Victorian districts before the 2021 redistribution). Divisions/districts are matched
// by name to the current ids in src/data/au.ts; boundaries may differ — the UI says so.
// Run: node scripts/gen-au-census.mjs [cacheDir]
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const CACHE = process.argv[2] || join(tmpdir(), 'poltok-abs');
mkdirSync(CACHE, { recursive: true });
const API = 'https://data.api.abs.gov.au/rest/data/ABS,';

async function get(flow) {
  const f = join(CACHE, flow + '.csv');
  if (!existsSync(f)) {
    const r = await fetch(API + flow + '/all', { headers: { Accept: 'application/vnd.sdmx.data+csv;labels=both' } });
    if (!r.ok) throw new Error(flow + ' HTTP ' + r.status);
    writeFileSync(f, await r.text());
  }
  return parseCsv(readFileSync(f, 'utf8'));
}

function parseCsv(txt) {
  const rows = [];
  let row = [], cur = '', q = false;
  for (let i = 0; i < txt.length; i++) {
    const ch = txt[i];
    if (q) {
      if (ch === '"') { if (txt[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n') { row.push(cur.replace(/\r$/, '')); rows.push(row); row = []; cur = ''; }
    else cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  const head = rows.shift().map((h) => h.split(':')[0]);
  return rows.filter((r) => r.length === head.length).map((r) => {
    const o = {};
    head.forEach((h, i) => {
      const v = r[i];
      const m = /^([^:]+): (.*)$/s.exec(v);
      o[h] = m ? m[1] : v;
      if (m) o[h + '_L'] = m[2];
    });
    o.OBS_VALUE = Number(o.OBS_VALUE);
    return o;
  });
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function build(geo) {
  const [g01, g02, g08, g37, g54] = await Promise.all(['G01', 'G02', 'G08', 'G37', 'G54'].map((t) => get(`C21_${t}_${geo}`)));
  const out = {};
  const R = (r) => (out[r.REGION] ??= { name: r.REGION_L.replace(/\s*\(.*\)$/, '') });
  for (const r of g01) {
    if (r.SEXP !== '3') continue;
    const o = R(r);
    if (r.PCHAR === 'P_1') o.pop = r.OBS_VALUE;
    if (r.PCHAR === 'B_O') o.bornOs = r.OBS_VALUE;
    if (r.PCHAR === 'B_11') o.bornAu = r.OBS_VALUE;
    if (r.PCHAR === 'L_O') o.langO = r.OBS_VALUE;
    if (r.PCHAR === 'L_1201') o.langE = r.OBS_VALUE;
    if (r.PCHAR === 'A_T') o.indig = r.OBS_VALUE;
  }
  for (const r of g02) {
    const o = R(r);
    if (r.MEDAVG === '1') o.medAge = r.OBS_VALUE;
    if (r.MEDAVG === '4') o.medHhInc = r.OBS_VALUE;
    if (r.MEDAVG === '6') o.medRent = r.OBS_VALUE;
    if (r.MEDAVG === '5') o.medMortgage = r.OBS_VALUE;
  }
  const anc = {}, ind = {};
  for (const r of g08) {
    if (r.BPPP !== '_T' || r.ANCP.startsWith('_')) continue;
    (anc[r.REGION] ??= []).push([r.ANCP_L, r.OBS_VALUE]);
  }
  for (const r of g37) {
    if (r.STRD !== '_T') continue;
    const o = R(r);
    if (r.TENLLD === '_T') o.dw = r.OBS_VALUE;
    if (r.TENLLD === 'R_T') o.rent = r.OBS_VALUE;
    if (r.TENLLD === '1') o.own = r.OBS_VALUE;
    if (r.TENLLD === '2') o.mort = r.OBS_VALUE;
  }
  for (const r of g54) {
    if (r.SEXP !== '3' || r.AGEP !== '_T' || r.INDP.startsWith('_')) continue;
    (ind[r.REGION] ??= []).push([r.INDP_L, r.OBS_VALUE]);
  }
  const pct = (a, b) => (a != null && b ? Math.round((1000 * a) / b) / 10 : null);
  const res = {};
  for (const [code, o] of Object.entries(out)) {
    if (!o.pop || /no usual address|migratory/i.test(o.name)) continue;
    const a = (anc[code] ?? []).sort((x, y) => y[1] - x[1]).slice(0, 3);
    const indT = (ind[code] ?? []).reduce((s, x) => s + x[1], 0);
    const i = (ind[code] ?? []).sort((x, y) => y[1] - x[1]).slice(0, 3);
    res[slug(o.name)] = {
      n: o.name,
      pop: o.pop,
      age: o.medAge ?? null,
      inc: o.medHhInc ?? null,
      rentW: o.medRent ?? null,
      mortM: o.medMortgage ?? null,
      os: pct(o.bornOs, o.pop),
      lang: pct(o.langO, o.langO + o.langE),
      indig: pct(o.indig, o.pop),
      renting: pct(o.rent, o.dw),
      owned: pct(o.own, o.dw),
      mortgaged: pct(o.mort, o.dw),
      anc: a.map(([l, v]) => [l, pct(v, o.pop)]),
      ind: i.map(([l, v]) => [l.replace(/^"|"$/g, ''), pct(v, indT)]),
    };
  }
  return res;
}

// Map to current ids in src/data/au.ts
const auSrc = readFileSync(new URL('../src/data/au.ts', import.meta.url), 'utf8');
const fedIds = [...auSrc.matchAll(/"id": "([a-z0-9-]+)"[^}]*"chamber": "federal"/g)].map((m) => m[1]);
const vicIds = [...auSrc.matchAll(/"id": "(vic-[a-z0-9-]+)"/g)].map((m) => m[1]);

const ced = await build('CED');
const sed = await build('SED');
const fed = {}, vic = {};
for (const id of fedIds) if (ced[id]) fed[id] = ced[id];
for (const id of vicIds) { const k = id.slice(4); if (sed[k]) vic[id] = sed[k]; }
const missF = fedIds.filter((i) => !fed[i]);
const missV = vicIds.filter((i) => !vic[i]);
// national/state benchmark rows
const aus = { pop: 25422788, age: 38, inc: 1746, os: 27.6 }; // ABS 2021 QuickStats Australia — https://abs.gov.au/census/find-census-data/quickstats/2021/AUS
console.log(`federal ${fedIds.length} ids, matched ${Object.keys(fed).length}; missing: ${missF.join(', ')}`);
console.log(`vic ${vicIds.length} ids, matched ${Object.keys(vic).length}; missing: ${missV.join(', ')}`);

const header = `// GENERATED by scripts/gen-au-census.mjs — do not hand-edit.
// Source: ABS Census of Population and Housing 2021, General Community Profile (G01, G02, G08, G37, G54) via the
// ABS Data API (data.api.abs.gov.au). © Commonwealth of Australia (ABS), CC BY 4.0.
// Boundaries: ASGS 2021 CED (federal) / SED (Victoria), matched to current seats BY NAME. Seats created or
// redrawn since 2021 may differ or be missing (federal missing: ${missF.join(', ') || 'none'}; vic missing: ${missV.length}).
// Fields: pop persons; age median age; inc median weekly household income $; rentW median weekly rent $; mortM median
// monthly mortgage $; os % born overseas; lang % speaking a non-English language at home; indig % Aboriginal and/or
// Torres Strait Islander; renting/owned/mortgaged % of occupied private dwellings; anc top-3 ancestries (% of persons,
// multi-response); ind top-3 industries of employment (% of employed persons with stated industry).
export interface AuCensus { n: string; pop: number; age: number | null; inc: number | null; rentW: number | null; mortM: number | null; os: number | null; lang: number | null; indig: number | null; renting: number | null; owned: number | null; mortgaged: number | null; anc: [string, number | null][]; ind: [string, number | null][] }
export const CENSUS_SOURCE = { label: 'ABS Census 2021 (GCP via ABS Data API), CC BY 4.0', url: 'https://data.api.abs.gov.au/rest/dataflow/ABS', boundaries: 'ASGS 2021 (CED 2021 / SED 2021), matched by name' };
export const CENSUS_AUS = ${JSON.stringify(aus)};
`;
writeFileSync(new URL('../src/data/au-census.ts', import.meta.url), header +
  `export const CENSUS_FED: Record<string, AuCensus> = ${JSON.stringify(fed)};\n` +
  `export const CENSUS_VIC: Record<string, AuCensus> = ${JSON.stringify(vic)};\n`);
console.log('wrote src/data/au-census.ts');
