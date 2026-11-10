// node --test tests/ — QUORUM 3D world: the seeded terrain behind the 3D map (pure TS, no three.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'quorum3d-'));
const out = (n) => join(dir, n);
buildSync({ entryPoints: [join(root, 'src/features/play/world/terrain.ts')], bundle: true, format: 'esm', platform: 'neutral', outfile: out('terrain.mjs'), logLevel: 'error' });
buildSync({ entryPoints: [join(root, 'src/features/play/world/atmosphere.ts')], bundle: true, format: 'esm', platform: 'neutral', outfile: out('atm.mjs'), logLevel: 'error' });
const T = await import(pathToFileURL(out('terrain.mjs')).href);
const A = await import(pathToFileURL(out('atm.mjs')).href);

test('terrain: every region has land, sea surrounds, heights are sane', () => {
  for (const q of ['low', 'medium', 'high']) {
    const t = T.buildTerrain(q);
    assert.equal(t.h.length, t.cols * t.rows);
    const count = new Map();
    for (const r of t.region) count.set(r, (count.get(r) ?? 0) + 1);
    for (let i = 0; i < 8; i++) assert.ok((count.get(i) ?? 0) > 20, `${q}: region ${T.REGION_ORDER[i]} has land`);
    assert.ok((count.get(T.SEA) ?? 0) > t.h.length * 0.2, 'there is sea');
    let max = -Infinity; for (const v of t.h) max = Math.max(max, v);
    assert.ok(max > 2 && max < 5, `mountains in range (${max})`);
    // the Ardent Heights are the highest region on average
    const avg = (slot) => { let s = 0, n = 0; t.region.forEach((r, k) => { if (r === slot) { s += t.h[k]; n++; } }); return s / n; };
    const ardent = avg(T.REGION_ORDER.indexOf('ardent'));
    for (const id of ['lowmere', 'sallow', 'tamsfield']) assert.ok(ardent > avg(T.REGION_ORDER.indexOf(id)), `ardent higher than ${id}`);
  }
});

test('terrain: deterministic and cached', () => {
  const a = T.buildTerrain('low'), b = T.buildTerrain('low');
  assert.equal(a, b);
  assert.deepEqual(T.scatterTrees(a, 500, []), T.scatterTrees(a, 500, []));
});

test('towns: lots sit on dry land inside their own region', () => {
  const t = T.buildTerrain('medium');
  for (const id of T.REGION_ORDER) {
    const lots = T.townLots(t, id, 40);
    assert.ok(lots.length >= 30, `${id} has room to grow (${lots.length})`);
    for (const l of lots) { assert.equal(T.regionAtMap(t, l.x, l.y), T.REGION_ORDER.indexOf(id)); assert.ok(l.h > 0.05); }
  }
});

test('atmosphere: dusk on the election turn, night on election night', () => {
  assert.equal(A.dayPhaseOf(0), 3);
  assert.equal(A.dayPhaseOf(3), 0);
  assert.equal(A.dayPhaseOf(null), 1);
  const day = A.atmosphere(1, 1, 0), night = A.atmosphere(1, 1, 1), dusk = A.atmosphere(1, 3, 0);
  assert.ok(night.sunIntensity < day.sunIntensity && night.night === 1 && night.stars === 1);
  assert.ok(dusk.sunElev < day.sunElev);
  assert.notEqual(A.atmosphere(2, 1).fog, A.atmosphere(3, 1).fog, 'eras have their own mood');
});
