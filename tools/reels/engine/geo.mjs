// Node-side geo preprocessing for the reel engine.
// Turns public/geo GeoJSON (or us-atlas TopoJSON) into small, projected, simplified 2D rings
// that the page extrudes with three.js. Output units: the shape fits a WIDTH x ? box centred on 0,0
// with +y up (north up).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// ---------- helpers ----------
function sqSegDist(p, a, b) {
  let x = a[0], y = a[1], dx = b[0] - x, dy = b[1] - y;
  if (dx || dy) {
    const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) { x = b[0]; y = b[1]; } else if (t > 0) { x += dx * t; y += dy * t; }
  }
  dx = p[0] - x; dy = p[1] - y;
  return dx * dx + dy * dy;
}
function dp(pts, tol) {
  if (pts.length < 4) return pts;
  const sq = tol * tol, keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [f, l] = stack.pop();
    let max = 0, idx = -1;
    for (let i = f + 1; i < l; i++) { const d = sqSegDist(pts[i], pts[f], pts[l]); if (d > max) { max = d; idx = i; } }
    if (max > sq) { keep[idx] = 1; stack.push([f, idx], [idx, l]); }
  }
  return pts.filter((_, i) => keep[i]);
}
function area(r) { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]); return a / 2; }
function simplifyRing(r, tol) {
  const closed = r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1];
  const open = closed ? r.slice(0, -1) : r.slice();
  if (open.length < 4) return open;
  // split ring in two halves so DP has two anchors
  const h = Math.floor(open.length / 2);
  const a = dp(open.slice(0, h + 1), tol), b = dp(open.slice(h).concat([open[0]]), tol);
  return a.slice(0, -1).concat(b.slice(0, -1));
}

function polysOf(geom) {
  if (!geom) return [];
  if (geom.type === 'Polygon') return [geom.coordinates];
  if (geom.type === 'MultiPolygon') return geom.coordinates;
  return [];
}

// boundary edges (edges used by exactly one polygon) chained into loops = merged silhouette
function silhouette(polys) {
  const key = (p) => `${p[0].toFixed(4)},${p[1].toFixed(4)}`;
  const count = new Map();
  const pt = new Map();
  for (const poly of polys) for (const ring of poly) {
    for (let i = 0; i < ring.length - 1; i++) {
      const a = key(ring[i]), b = key(ring[i + 1]);
      if (a === b) continue;
      pt.set(a, ring[i]); pt.set(b, ring[i + 1]);
      const k = a < b ? a + '|' + b : b + '|' + a;
      const e = count.get(k);
      if (e) e.n++; else count.set(k, { n: 1, a, b });
    }
  }
  const adj = new Map();
  for (const e of count.values()) {
    if (e.n !== 1) continue;
    (adj.get(e.a) || adj.set(e.a, []).get(e.a)).push(e.b);
    (adj.get(e.b) || adj.set(e.b, []).get(e.b)).push(e.a);
  }
  const used = new Set();
  const ek = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
  const rings = [];
  for (const start of adj.keys()) {
    for (const nb of adj.get(start)) {
      if (used.has(ek(start, nb))) continue;
      const ring = [pt.get(start)];
      let prev = start, cur = nb;
      used.add(ek(start, nb));
      let guard = 0;
      while (cur !== start && guard++ < 1e6) {
        ring.push(pt.get(cur));
        const nexts = adj.get(cur).filter((n) => !used.has(ek(cur, n)));
        if (!nexts.length) break;
        const n = nexts.find((x) => x !== prev) || nexts[0];
        used.add(ek(cur, n));
        prev = cur; cur = n;
      }
      if (cur === start && ring.length > 3) { ring.push(ring[0]); rings.push(ring); }
    }
  }
  return rings;
}

function makeProjector(allPts, { width = 10, lon0, lat0 } = {}) {
  let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
  for (const p of allPts) { if (p[0] < minx) minx = p[0]; if (p[0] > maxx) maxx = p[0]; if (p[1] < miny) miny = p[1]; if (p[1] > maxy) maxy = p[1]; }
  const la0 = lat0 ?? (miny + maxy) / 2;
  const k = Math.cos((la0 * Math.PI) / 180);
  const w = (maxx - minx) * k, h = maxy - miny;
  const s = width / w;
  const cx = (minx + maxx) / 2, cy = (miny + maxy) / 2;
  return { proj: (p) => [(p[0] - cx) * k * s, (p[1] - cy) * s], size: [width, h * s] };
}

/**
 * spec: { src: 'nz-electorates' | 'us-states' | 'us-nation', filter?: {prop: value}, mode: 'tiles'|'outline'|'both',
 *         width?: number, tol?: number (in output units), minArea?: number, bbox?: [lon0,lat0,lon1,lat1] }
 */
export function buildGeo(root, spec) {
  const width = spec.width ?? 10;
  let feats;
  let projected = false;
  if (spec.src.startsWith('us-')) {
    const topo = require('topojson-client');
    const us = JSON.parse(fs.readFileSync(path.join(root, 'node_modules/us-atlas/states-albers-10m.json'), 'utf8'));
    const fc = topojson(topo, us, spec.src === 'us-nation' ? 'nation' : 'states');
    feats = fc.features.map((f) => ({ id: f.id, name: f.properties?.name || '', geometry: f.geometry }));
    projected = true;
  } else {
    const gj = JSON.parse(fs.readFileSync(path.join(root, 'public/geo', spec.src + '.json'), 'utf8'));
    feats = gj.features
      .filter((f) => !spec.filter || Object.entries(spec.filter).every(([k, v]) => f.properties?.[k] === v))
      .map((f) => ({ id: f.properties?.id, name: f.properties?.name || '', props: f.properties, geometry: f.geometry }));
  }
  if (spec.bbox) {
    const [a, b, c, d] = spec.bbox;
    for (const f of feats) f.geometry = { type: 'MultiPolygon', coordinates: polysOf(f.geometry).filter((poly) => poly[0].some((p) => p[0] >= a && p[0] <= c && p[1] >= b && p[1] <= d)) };
  }
  const all = [];
  for (const f of feats) for (const poly of polysOf(f.geometry)) for (const p of poly[0]) all.push(projected ? [p[0], -p[1]] : p);
  const P = projected
    ? (() => {
        let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
        for (const p of all) { minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); miny = Math.min(miny, p[1]); maxy = Math.max(maxy, p[1]); }
        const s = width / (maxx - minx), cx = (minx + maxx) / 2, cy = (miny + maxy) / 2;
        return { proj: (p) => [(p[0] - cx) * s, (-p[1] - cy) * s], size: [width, (maxy - miny) * s] };
      })()
    : makeProjector(all, { width });
  const tol = spec.tol ?? width / 900;
  const minArea = spec.minArea ?? (width * width) / 40000;
  const out = { size: P.size, tiles: [], outline: [] };

  const prepRing = (ring) => {
    const r = simplifyRing(ring.map(P.proj), tol);
    if (r.length < 3) return null;
    const a = area(r);
    if (Math.abs(a) < minArea) return null;
    return r.map((p) => [+p[0].toFixed(4), +p[1].toFixed(4)]);
  };

  const prepRing2 = (r0) => {
    const r = simplifyRing(r0, tol);
    if (r.length < 3 || Math.abs(area(r)) < minArea) return null;
    return r.map((p) => [+p[0].toFixed(4), +p[1].toFixed(4)]);
  };
  if (spec.mode !== 'outline') {
    for (const f of feats) {
      const polys = [];
      for (const poly of polysOf(f.geometry)) {
        const outer = prepRing(poly[0]);
        if (!outer) continue;
        const holes = poly.slice(1).map(prepRing).filter(Boolean);
        polys.push([outer, ...holes]);
      }
      if (!polys.length) continue;
      let cx = 0, cy = 0, n = 0;
      for (const p of polys[0][0]) { cx += p[0]; cy += p[1]; n++; }
      out.tiles.push({ id: f.id, name: f.name, c: [cx / n, cy / n], polys });
    }
  }
  if (spec.mode !== 'tiles') {
    const polys = feats.flatMap((f) => polysOf(f.geometry));
    let rings;
    if (spec.raster) rings = rasterSilhouette(polys.map((poly) => poly.map((r) => r.map(P.proj))), P.size, spec.raster);
    else rings = (spec.src === 'us-nation' ? polys.map((p) => p[0]) : silhouette(polys)).map((r) => r.map(P.proj));
    for (const r of rings) {
      const rr = prepRing2(r);
      if (rr) out.outline.push(rr);
    }
    // largest first
    out.outline.sort((a, b) => Math.abs(area(b)) - Math.abs(area(a)));
  }
  return out;
}

function topojson(topo, us, obj) {
  const f = topo.feature(us, us.objects[obj]);
  return f.type === 'FeatureCollection' ? f : { type: 'FeatureCollection', features: [f] };
}

// Rasterise projected polygons into a mask and trace its contour (marching squares).
// Robust union for sources whose neighbouring polygons don't share exact vertices.
function rasterSilhouette(polys, size, res) {
  const W = res, H = Math.ceil((res * size[1]) / size[0]) + 4, pad = 2;
  const sx = (W - 2 * pad) / size[0];
  const toG = (p) => [(p[0] + size[0] / 2) * sx + pad, (p[1] + size[1] / 2) * sx + pad];
  const m = new Uint8Array((W + 1) * (H + 1));
  for (const poly of polys) {
    const rings = poly.map((r) => r.map(toG));
    let y0 = Infinity, y1 = -Infinity;
    for (const p of rings[0]) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(H, Math.ceil(y1)); y++) {
      const xs = [];
      for (const r of rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
        const a = r[i], b = r[j];
        if ((a[1] > y) !== (b[1] > y)) xs.push(a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.max(0, Math.ceil(xs[k])); x <= Math.min(W, Math.floor(xs[k + 1])); x++) m[y * (W + 1) + x] = 1;
    }
  }
  // dilate+erode once to close hairline gaps between neighbours
  const at = (x, y) => (x < 0 || y < 0 || x > W || y > H ? 0 : m[y * (W + 1) + x]);
  const d = new Uint8Array(m.length);
  for (let y = 0; y <= H; y++) for (let x = 0; x <= W; x++) d[y * (W + 1) + x] = at(x, y) || at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1) ? 1 : 0;
  const e = new Uint8Array(m.length);
  const dt = (x, y) => (x < 0 || y < 0 || x > W || y > H ? 0 : d[y * (W + 1) + x]);
  for (let y = 0; y <= H; y++) for (let x = 0; x <= W; x++) e[y * (W + 1) + x] = dt(x, y) && dt(x - 1, y) && dt(x + 1, y) && dt(x, y - 1) && dt(x, y + 1) ? 1 : 0;
  const v = (x, y) => (x < 0 || y < 0 || x > W || y > H ? 0 : e[y * (W + 1) + x]);
  // marching squares -> directed segments (inside on the left)
  const segs = new Map();
  const add = (a, b) => segs.set(a.join(','), b);
  for (let y = -1; y <= H; y++) for (let x = -1; x <= W; x++) {
    const c = (v(x, y) << 3) | (v(x + 1, y) << 2) | (v(x + 1, y + 1) << 1) | v(x, y + 1);
    const T = [x + 0.5, y], R = [x + 1, y + 0.5], B = [x + 0.5, y + 1], L = [x, y + 0.5];
    switch (c) {
      case 1: add(L, B); break; case 2: add(B, R); break; case 3: add(L, R); break;
      case 4: add(R, T); break; case 5: add(L, T); add(R, B); break; case 6: add(B, T); break;
      case 7: add(L, T); break; case 8: add(T, L); break; case 9: add(T, B); break;
      case 10: add(T, R); add(B, L); break; case 11: add(T, R); break; case 12: add(R, L); break;
      case 13: add(R, B); break; case 14: add(B, L); break; default: break;
    }
  }
  const rings = [];
  const seen = new Set();
  for (const k of segs.keys()) {
    if (seen.has(k)) continue;
    const ring = [];
    let cur = k;
    while (cur && !seen.has(cur)) {
      seen.add(cur);
      const [x, y] = cur.split(',').map(Number);
      ring.push([(x - pad) / sx - size[0] / 2, (y - pad) / sx - size[1] / 2]);
      const nx = segs.get(cur);
      cur = nx && nx.join(',');
    }
    if (ring.length > 8) { ring.push(ring[0]); rings.push(ring); }
  }
  return rings;
}
