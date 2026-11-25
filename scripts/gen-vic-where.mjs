#!/usr/bin/env node
// Generate public/data/vic-where.json: Victorian postcodes and suburbs → 2026 state electoral districts (with area shares),
// for "Find my seat". Boundaries: ABS ASGS 2021 Postal Areas (POA) and Suburbs and Localities (SAL), CC BY 4.0, via
// geo.abs.gov.au; districts: public/geo/vic-districts.json. Method: sample a grid of points inside each postcode/suburb
// polygon and test which district each point falls in. Postcodes and suburbs that straddle a boundary list every district.
import fs from 'node:fs';

const ROOT = new URL('..', import.meta.url);
const geo = JSON.parse(fs.readFileSync(new URL('public/geo/vic-districts.json', ROOT), 'utf8'));
const districts = geo.features.map((f) => ({ id: f.properties.id, polys: f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates }))
  .map((d) => ({ ...d, bbox: d.polys.flat(2).reduce((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [180, 90, -180, -90]) }));

const inRing = (x, y, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
const inPoly = (x, y, poly) => inRing(x, y, poly[0]) && !poly.slice(1).some((h) => inRing(x, y, h));
const districtAt = (x, y) => { for (const d of districts) { const b = d.bbox; if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue; if (d.polys.some((p) => inPoly(x, y, p))) return d.id; } return null; };

async function query(service, where, field) {
  const out = [];
  for (let offset = 0; ; offset += 500) {
    const u = `https://geo.abs.gov.au/arcgis/rest/services/ASGS2021/${service}/MapServer/0/query?where=${encodeURIComponent(where)}&outFields=${field}&returnGeometry=true&outSR=4326&maxAllowableOffset=0.0015&resultOffset=${offset}&resultRecordCount=500&f=json`;
    const r = await fetch(u, { signal: AbortSignal.timeout(60000) });
    if (!r.ok) throw new Error(`${service} HTTP ${r.status}`);
    const j = await r.json();
    if (j.error) throw new Error(JSON.stringify(j.error));
    out.push(...j.features);
    process.stdout.write(`${service} ${out.length}\r`);
    if (!j.exceededTransferLimit && j.features.length < 500) break;
  }
  return out;
}

function assign(rings) {
  if (!rings?.length) return [];
  const pts = rings.flat();
  const [x0, y0, x1, y1] = pts.reduce((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [180, 90, -180, -90]);
  const N = 16, hits = {};
  let n = 0;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x = x0 + ((i + 0.5) / N) * (x1 - x0), y = y0 + ((j + 0.5) / N) * (y1 - y0);
    if (!rings.some((r) => inRing(x, y, r))) continue;
    const d = districtAt(x, y); if (!d) continue;
    hits[d] = (hits[d] ?? 0) + 1; n++;
  }
  if (!n) { const [cx, cy] = pts.reduce((a, [x, y]) => [a[0] + x / pts.length, a[1] + y / pts.length], [0, 0]); const d = districtAt(cx, cy); return d ? [[d, 1]] : []; }
  return Object.entries(hits).map(([d, k]) => [d, +(k / n).toFixed(3)]).filter(([, s]) => s >= 0.03).sort((a, b) => b[1] - a[1]);
}

const poa = await query('POA', "poa_code_2021 like '3%'", 'poa_code_2021');
const postcodes = {};
for (const f of poa) { const a = assign(f.geometry?.rings); if (a.length) postcodes[f.attributes.poa_code_2021] = a; }
const sal = await query('SAL', "state_code_2021='2'", 'sal_name_2021');
const suburbs = {};
for (const f of sal) {
  const name = String(f.attributes.sal_name_2021).replace(/\s*\(Vic\.\)\s*$/i, '').trim();
  const a = assign(f.geometry?.rings); if (a.length) suburbs[name] = a;
}
fs.writeFileSync(new URL('public/data/vic-where.json', ROOT), JSON.stringify({ source: 'ABS ASGS 2021 POA + SAL (CC BY 4.0) × VEC 2026 districts', postcodes, suburbs }));
console.log(`\npostcodes ${Object.keys(postcodes).length}, suburbs ${Object.keys(suburbs).length}`);
