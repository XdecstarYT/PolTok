// Calderra's 3D terrain, generated in code from a seeded heightmap shaped to the 8 regions in ../ui/geo.ts.
// Pure data (typed arrays): no three.js, no DOM, so it is unit-testable and cheap to cache.
import { CAPITAL, FRONTIER_LINE, inPoly, LAND_RING, MAP_BOX, REG_RING, REGION_LABEL, RIVER, RIVER2, type Pt } from '../ui/geo';
import { seeded } from '../ui/seeded';

/** Region order used by the 3D world (index = region slot in shaders). */
export const REGION_ORDER = ['corvane', 'ardent', 'glasswick', 'tamsfield', 'quillon', 'lowmere', 'brassport', 'sallow'] as const;
export type RegionKey = (typeof REGION_ORDER)[number];

/** Map units to world units. The world is centred on the map; +x east, +z south, +y up; water level is y = 0. */
export const K = 0.1;
export const CX = 165, CY = 142;
export const toWorld = (x: number, y: number): [number, number] => [(x - CX) * K, (y - CY) * K];
export const toMap = (wx: number, wz: number): [number, number] => [wx / K + CX, wz / K + CY];

export type Quality = 'low' | 'medium' | 'high';
const STEP: Record<Quality, number> = { low: 4.6, medium: 3.4, high: 2.6 };

export const NEIGHBOR = 9; // region slot for the Hollin Reach (not part of Calderra)
export const SEA = -1;

export interface Terrain {
  quality: Quality;
  cols: number; rows: number; step: number;
  x0: number; y0: number; // map coords of node (0,0)
  /** Height per node, world units. */
  h: Float32Array;
  /** Region slot per node: 0..7, NEIGHBOR, or SEA. */
  region: Int8Array;
  /** Distance to the coast in map units (on land: to the sea; at sea: to land). */
  dist: Float32Array;
}

// ---------------------------------------------------------------- noise

function hash2(ix: number, iy: number, seed: number) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x: number, y: number, seed: number) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, seed), b = hash2(ix + 1, iy, seed), c = hash2(ix, iy + 1, seed), d = hash2(ix + 1, iy + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x: number, y: number, seed = 7, oct = 4) {
  let s = 0, amp = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += amp * vnoise(x * f, y * f, seed + i * 31); n += amp; amp *= 0.5; f *= 2.03; }
  return s / n;
}
function ridged(x: number, y: number, seed = 11) {
  let s = 0, amp = 0.55, f = 1, n = 0;
  for (let i = 0; i < 4; i++) { const r = 1 - Math.abs(vnoise(x * f, y * f, seed + i * 17) * 2 - 1); s += amp * r * r; n += amp; amp *= 0.5; f *= 2.1; }
  return s / n;
}
const smoothstep = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function distToPolyline(x: number, y: number, pl: readonly Pt[]) {
  let best = Infinity;
  for (let i = 0; i < pl.length - 1; i++) {
    const [ax, ay] = pl[i], [bx, by] = pl[i + 1];
    const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L));
    best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return best;
}

const NEIGHBOR_POLY: Pt[] = [...FRONTIER_LINE, [-60, -20], [-60, 310], [8, 310]];
export const PONDS: Pt[] = [[44, 196], [126, 222], [58, 234], [140, 186], [96, 236], [70, 188], [30, 214]];
const PEAKS: Pt[] = [[176, 44], [196, 30], [214, 50], [238, 36], [258, 52], [226, 64], [250, 20], [160, 26], [282, 36], [204, 16]];

type BBox = [number, number, number, number];
const bbox = (p: readonly Pt[]): BBox => { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; for (const [x, y] of p) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); } return [a, b, c, d]; };
const inBox = (x: number, y: number, b: BBox) => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3];
const LAND_BOX = bbox(LAND_RING);
const REG_BOX = REGION_ORDER.map((id) => bbox(REG_RING[id]));

/** Classify a map point: region slot, NEIGHBOR or SEA. */
export function classify(x: number, y: number): number {
  if (inBox(x, y, LAND_BOX) && inPoly(x, y, LAND_RING)) {
    for (let i = 0; i < REGION_ORDER.length; i++) if (inBox(x, y, REG_BOX[i]) && inPoly(x, y, REG_RING[REGION_ORDER[i]])) return i;
    // a sliver between jittered rings: nearest label
    let bi = 0, bd = Infinity;
    REGION_ORDER.forEach((id, i) => { const [lx, ly] = REGION_LABEL[id]; const d = Math.hypot(lx - x, ly - y); if (d < bd) { bd = d; bi = i; } });
    return bi;
  }
  return inPoly(x, y, NEIGHBOR_POLY) ? NEIGHBOR : SEA;
}

function biomeHeight(r: number, x: number, y: number): number {
  const n = fbm(x / 38, y / 38);
  switch (REGION_ORDER[r] ?? '') {
    case 'ardent': {
      let peak = 0; for (const [px, py] of PEAKS) peak = Math.max(peak, 1 - Math.hypot(px - x, py - y) / 34);
      return 0.6 + n * 0.45 + ridged(x / 26, y / 26) * 1.35 * (0.35 + peak) + Math.max(0, peak) ** 1.6 * 1.8;
    }
    case 'corvane': return 0.45 + n * 0.95;
    case 'glasswick': return 0.45 + n * 0.85 + ridged(x / 40, y / 40) * 0.3;
    case 'tamsfield': return 0.28 + n * 0.22;
    case 'quillon': return 0.4 + n * 0.3;
    case 'lowmere': return 0.1 + n * 0.14;
    case 'brassport': return 0.28 + n * 0.3;
    case 'sallow': return 0.18 + n * 0.1 + Math.max(0, Math.sin(x / 7 + Math.sin(y / 11) * 2)) * 0.12;
    default: return 0.6 + n * 1.1; // the Hollin Reach
  }
}

const cache = new Map<Quality, Terrain>();

/** Generate (or fetch from cache) the terrain grid for a quality level. Deterministic. */
export function buildTerrain(quality: Quality = 'medium'): Terrain {
  const hit = cache.get(quality); if (hit) return hit;
  const step = STEP[quality];
  const [bx, by, bw, bh] = MAP_BOX;
  const x0 = bx - 10, y0 = by - 10;
  const cols = Math.ceil((bw + 20) / step) + 1, rows = Math.ceil((bh + 20) / step) + 1;
  const N = cols * rows;
  const region = new Int8Array(N), h = new Float32Array(N), dist = new Float32Array(N);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) region[j * cols + i] = classify(x0 + i * step, y0 + j * step);

  // chamfer distance transform to the land/sea edge (two passes, 3-4 metric)
  const INF = 1e9;
  const dl = new Float32Array(N), ds = new Float32Array(N);
  for (let k = 0; k < N; k++) { const land = region[k] !== SEA; dl[k] = land ? INF : 0; ds[k] = land ? 0 : INF; }
  const pass = (d: Float32Array) => {
    const a = 1, b = Math.SQRT2;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const k = j * cols + i; let v = d[k];
      if (i > 0) v = Math.min(v, d[k - 1] + a);
      if (j > 0) { v = Math.min(v, d[k - cols] + a); if (i > 0) v = Math.min(v, d[k - cols - 1] + b); if (i < cols - 1) v = Math.min(v, d[k - cols + 1] + b); }
      d[k] = v;
    }
    for (let j = rows - 1; j >= 0; j--) for (let i = cols - 1; i >= 0; i--) {
      const k = j * cols + i; let v = d[k];
      if (i < cols - 1) v = Math.min(v, d[k + 1] + a);
      if (j < rows - 1) { v = Math.min(v, d[k + cols] + a); if (i < cols - 1) v = Math.min(v, d[k + cols + 1] + b); if (i > 0) v = Math.min(v, d[k + cols - 1] + b); }
      d[k] = v;
    }
  };
  pass(dl); pass(ds);
  for (let k = 0; k < N; k++) dist[k] = (region[k] === SEA ? ds[k] : dl[k]) * step;

  // raw heights
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const k = j * cols + i, x = x0 + i * step, y = y0 + j * step, r = region[k];
    if (r === SEA) { h[k] = -0.35 - Math.min(dist[k], 40) * 0.035 - fbm(x / 20, y / 20, 3) * 0.2; continue; }
    h[k] = biomeHeight(r, x, y);
  }
  // soften region seams (land only), two box-blur passes
  const tmp = new Float32Array(N);
  for (let p = 0; p < 2; p++) {
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const k = j * cols + i; if (region[k] === SEA) { tmp[k] = h[k]; continue; }
      let s = 0, n = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= cols || jj >= rows) continue;
        const kk = jj * cols + ii; if (region[kk] === SEA) continue; s += h[kk]; n++;
      }
      tmp[k] = s / n;
    }
    h.set(tmp);
  }
  // coastal ramp, rivers, ponds
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const k = j * cols + i, x = x0 + i * step, y = y0 + j * step;
    if (region[k] === SEA) continue;
    const ramp = smoothstep(0, 16, dist[k]);
    let v = 0.06 + ramp * h[k] + (dist[k] < 2.5 ? -0.04 : 0);
    const dr = Math.min(distToPolyline(x, y, RIVER), distToPolyline(x, y, RIVER2) + 0.6);
    if (dr < 7) v = -0.1 + (v + 0.1) * smoothstep(1.6, 7, dr);
    if (REGION_ORDER[region[k]] === 'lowmere' || REGION_ORDER[region[k]] === 'tamsfield') {
      for (const [px, py] of PONDS) { const d = Math.hypot(px - x, (py - y) * 1.6); if (d < 9) v = Math.min(v, -0.12 + (d / 9) * 0.3); }
    }
    if (Math.hypot(x - CAPITAL[0], y - CAPITAL[1]) < 16) v = 0.5 + (v - 0.5) * 0.25; // the capital's plateau
    h[k] = v;
  }
  const t: Terrain = { quality, cols, rows, step, x0, y0, h, region, dist };
  cache.set(quality, t);
  return t;
}

/** Bilinear height at a map point. */
export function heightAtMap(t: Terrain, x: number, y: number): number {
  const fi = Math.max(0, Math.min(t.cols - 1.001, (x - t.x0) / t.step)), fj = Math.max(0, Math.min(t.rows - 1.001, (y - t.y0) / t.step));
  const i = Math.floor(fi), j = Math.floor(fj), u = fi - i, v = fj - j, c = t.cols;
  const a = t.h[j * c + i], b = t.h[j * c + i + 1], d = t.h[(j + 1) * c + i], e = t.h[(j + 1) * c + i + 1];
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + d * (1 - u) * v + e * u * v;
}
export const heightAtWorld = (t: Terrain, wx: number, wz: number) => { const [x, y] = toMap(wx, wz); return heightAtMap(t, x, y); };
/** Region slot at a map point (nearest node). */
export function regionAtMap(t: Terrain, x: number, y: number): number {
  const i = Math.round((x - t.x0) / t.step), j = Math.round((y - t.y0) / t.step);
  if (i < 0 || j < 0 || i >= t.cols || j >= t.rows) return SEA;
  return t.region[j * t.cols + i];
}
/** Slope (rise per map unit) at a map point. */
export function slopeAtMap(t: Terrain, x: number, y: number) {
  const e = t.step;
  return Math.hypot(heightAtMap(t, x + e, y) - heightAtMap(t, x - e, y), heightAtMap(t, x, y + e) - heightAtMap(t, x, y - e)) / (2 * e * K);
}

// ---------------------------------------------------------------- ground colours (diorama palette)

type RGB = [number, number, number];
const hex = (n: number): RGB => [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const C = {
  sand: hex(0xe3cf98), wetSand: hex(0xc7b07a), seabed: hex(0x6fa8a0), deep: hex(0x2c5d73),
  forest: hex(0x3f6b3a), forest2: hex(0x557d3f), meadow: hex(0x86a85a), alpine: hex(0x7c9257), rock: hex(0x8a8172), rock2: hex(0x6f675c), snow: hex(0xf3f1ea),
  wheat: hex(0xd9be6a), barley: hex(0xc9a85a), green: hex(0x8db35e), green2: hex(0x6f9a4c), furrow: hex(0x9a7a50),
  marsh: hex(0x6e8a55), marsh2: hex(0x8a9a5c), peat: hex(0x5c5a3e), soot: hex(0x6d7262), heath: hex(0x8b9468), dune: hex(0xe8d49c),
  hollin: hex(0xa9a48f), hollin2: hex(0x8e8a78), town: hex(0xb9a888),
};

/** Ground colour for a terrain face. */
export function groundColor(r: number, h: number, slope: number, d: number, x: number, y: number): RGB {
  const n = fbm(x / 9, y / 9, 21);
  if (r === SEA) return mix(C.seabed, C.deep, smoothstep(0, 26, d) * 0.9 + n * 0.1);
  if (h < 0.02) return mix(C.wetSand, C.peat, REGION_ORDER[r] === 'lowmere' ? 0.6 : 0.1); // river and pond beds
  if (r === NEIGHBOR) return mix(C.hollin, C.hollin2, n);
  if (d < 3.2 && h < 0.35) return mix(C.sand, C.wetSand, n * 0.5);
  let c: RGB;
  switch (REGION_ORDER[r]) {
    case 'corvane': c = mix(C.forest, C.forest2, n); break;
    case 'ardent':
      c = mix(C.alpine, C.meadow, n * 0.6);
      if (h > 1.25 || slope > 1.1) c = mix(c, mix(C.rock, C.rock2, n), smoothstep(1.25, 1.7, h + slope * 0.4));
      if (h > 2.45 + n * 0.5) c = C.snow;
      break;
    case 'glasswick': c = mix(C.heath, C.soot, n * 0.7); break;
    case 'tamsfield': case 'quillon': {
      const a = 0.35, u = x * Math.cos(a) - y * Math.sin(a), v = x * Math.sin(a) + y * Math.cos(a);
      const cell = hash2(Math.floor(u / 13), Math.floor(v / 9), 5);
      const pal = [C.wheat, C.green, C.barley, C.green2, C.furrow, C.meadow];
      c = pal[Math.floor(cell * pal.length)];
      if (REGION_ORDER[r] === 'quillon') c = mix(c, C.meadow, 0.45);
      c = mix(c, C.green2, n * 0.18);
      break;
    }
    case 'lowmere': c = mix(C.marsh, C.marsh2, n); if (h < 0.12) c = mix(c, C.peat, 0.5); break;
    case 'brassport': c = mix(C.meadow, C.heath, n); break;
    case 'sallow': c = mix(C.dune, C.sand, n); if (h > 0.2) c = mix(c, C.meadow, 0.25); break;
    default: c = C.meadow;
  }
  return c;
}

// ---------------------------------------------------------------- prop placement

export interface Tree { x: number; y: number; h: number; s: number; kind: 0 | 1 }
const TREE_P: Record<string, number> = { corvane: 0.9, ardent: 0.3, glasswick: 0.22, quillon: 0.08, tamsfield: 0.06, lowmere: 0.06, brassport: 0.08, sallow: 0.03 };

/** Seeded tree scatter. `n` candidates; accepted by region density, height and slope. */
export function scatterTrees(t: Terrain, n: number, avoid: Pt[]): Tree[] {
  const r = seeded('calderra-trees');
  const out: Tree[] = [];
  const [bx, by, bw, bh] = MAP_BOX;
  for (let k = 0; k < n; k++) {
    const x = bx + r.next() * bw, y = by + r.next() * bh, roll = r.next(), s = 0.7 + r.next() * 0.6, kind = r.next() < 0.5 ? 0 : 1;
    const reg = regionAtMap(t, x, y); if (reg === SEA) continue;
    const p = reg === NEIGHBOR ? 0.25 : TREE_P[REGION_ORDER[reg]] ?? 0;
    const h = heightAtMap(t, x, y);
    if (roll > p || h < 0.12 || h > 2.1 || slopeAtMap(t, x, y) > 1.4) continue;
    if (avoid.some(([ax, ay]) => Math.hypot(ax - x, ay - y) < 13)) continue;
    out.push({ x, y, h, s, kind: (REGION_ORDER[reg] === 'corvane' || REGION_ORDER[reg] === 'ardent' || reg === NEIGHBOR) ? 0 : kind as 0 | 1 });
  }
  return out;
}

/** Reed clumps in the fens. */
export function scatterReeds(t: Terrain, n: number): { x: number; y: number; h: number }[] {
  const r = seeded('calderra-reeds');
  const out: { x: number; y: number; h: number }[] = [];
  for (let k = 0; k < n; k++) {
    const x = r.range(10, 170), y = r.range(165, 260);
    const reg = regionAtMap(t, x, y); if (REGION_ORDER[reg] !== 'lowmere') continue;
    const h = heightAtMap(t, x, y); if (h < -0.05 || h > 0.3) continue;
    out.push({ x, y, h });
  }
  return out;
}

/** Town centres (map coords): one per region, the capital in Quillon. */
export const TOWNS: Record<RegionKey, Pt> = {
  corvane: [84, 52], ardent: [205, 92], glasswick: [302, 96], tamsfield: [70, 128], quillon: [CAPITAL[0], CAPITAL[1] + 4], lowmere: [92, 206], brassport: [282, 206], sallow: [218, 250],
};

export interface Lot { x: number; y: number; h: number; rot: number; rnd: number }
/** Building lots around a town centre, nearest first (only on dry, gentle ground). */
export function townLots(t: Terrain, key: RegionKey, max: number, spacing = 3.4): Lot[] {
  const [cx, cy] = TOWNS[key];
  const r = seeded(`lots-${key}`);
  const out: Lot[] = [];
  const slot = REGION_ORDER.indexOf(key);
  for (let k = 0; out.length < max && k < max * 8; k++) {
    // golden-angle spiral with jitter
    const rad = spacing * Math.sqrt(k + 2) * 1.05, a = k * 2.39996;
    const x = cx + Math.cos(a) * rad + r.range(-1, 1), y = cy + Math.sin(a) * rad * 0.85 + r.range(-1, 1);
    const reg = regionAtMap(t, x, y), h = heightAtMap(t, x, y);
    if (reg !== slot || h < 0.1 || slopeAtMap(t, x, y) > 0.9) continue;
    if (key === 'quillon' && Math.hypot(x - CAPITAL[0], y - CAPITAL[1]) < 9) continue; // leave the Assembly square clear
    out.push({ x, y, h, rot: Math.round(a / (Math.PI / 2)) * (Math.PI / 2) + r.range(-0.15, 0.15), rnd: r.next() });
  }
  return out;
}
