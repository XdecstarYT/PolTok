// Hand-authored geometry of the Republic of Calderra, shared by the 2D SVG map (map.tsx) and the 3D world.
// Coordinates are SVG map units: x -46..376 (west to east), y -10..294 (north to south). Pure: no React, no DOM.
import type { RegionId } from '../engine/types';
import { seeded } from './seeded';

export type Pt = [number, number];

/** The map's viewBox: [minX, minY, width, height]. */
export const MAP_BOX = [-46, -10, 422, 304] as const;

export function jitterSeg(a: Pt, b: Pt, amp: number, step = 9): Pt[] {
  const flip = a[0] > b[0] || (a[0] === b[0] && a[1] > b[1]);
  const [p, q] = flip ? [b, a] : [a, b];
  const r = seeded(`${p}|${q}|${amp}`);
  const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
  const n = Math.max(1, Math.round(len / step));
  const nx = -(q[1] - p[1]) / (len || 1), ny = (q[0] - p[0]) / (len || 1);
  const pts: Pt[] = [p];
  for (let i = 1; i < n; i++) {
    const t = i / n; const o = (r.next() - 0.5) * 2 * amp * Math.sin(Math.PI * t);
    pts.push([p[0] + (q[0] - p[0]) * t + nx * o, p[1] + (q[1] - p[1]) * t + ny * o]);
  }
  pts.push(q);
  return flip ? pts.reverse() : pts;
}
export function ring(vs: Pt[], amp: number, step?: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < vs.length; i++) { const seg = jitterSeg(vs[i], vs[(i + 1) % vs.length], amp, step); out.push(...seg.slice(0, -1)); }
  return out;
}

export const FRONTIER: Pt[] = [[8, 202], [14, 150], [5, 100], [18, 50], [26, 6]];
export const COAST: Pt[] = [
  [26, 6], [70, 3], [120, 10], [165, 5], [215, 12], [262, 7], [300, 20], [328, 36], [348, 62], [341, 92], [356, 118], [352, 150], [338, 170],
  [316, 180], [305, 193], [321, 204], [346, 212], [344, 237], [322, 256], [286, 262], [258, 256], [246, 273], [214, 285], [180, 283], [158, 267],
  [146, 250], [124, 243], [100, 252], [72, 257], [46, 246], [24, 226], [8, 202],
];
/** The jittered coast (sea edge only), as an open polyline. */
export const COAST_LINE: Pt[] = (() => {
  const pts: Pt[] = [];
  for (let i = 0; i < COAST.length - 1; i++) pts.push(...jitterSeg(COAST[i], COAST[i + 1], 3.2, 6).slice(0, -1));
  pts.push(COAST[COAST.length - 1]);
  return pts;
})();
/** The jittered western frontier with the Hollin Reach, as an open polyline (south to north). */
export const FRONTIER_LINE: Pt[] = (() => {
  const pts: Pt[] = [];
  for (let i = 0; i < FRONTIER.length - 1; i++) pts.push(...jitterSeg(FRONTIER[i], FRONTIER[i + 1], 1.6, 10).slice(0, -1));
  pts.push(FRONTIER[FRONTIER.length - 1]);
  return pts;
})();
/** Closed outline of Calderra's land (coast, then frontier). */
export const LAND_RING: Pt[] = (() => {
  const out: Pt[] = [];
  for (let i = 0; i < COAST.length - 1; i++) out.push(...jitterSeg(COAST[i], COAST[i + 1], 3.2, 6).slice(0, -1));
  for (let i = 0; i < FRONTIER.length - 1; i++) out.push(...jitterSeg(FRONTIER[i], FRONTIER[i + 1], 1.6, 10).slice(0, -1));
  return out;
})();

export const J = { ca: [158, 98] as Pt, ct: [140, 108] as Pt, ag: [262, 104] as Pt, gb: [268, 160] as Pt, tl: [138, 160] as Pt, ls: [160, 205] as Pt, sb: [240, 200] as Pt };
/** Region cells (they overshoot the coast; clip them to LAND_RING). */
export const REG_POLY: Record<RegionId, Pt[]> = {
  corvane: [[-30, -20], [165, -20], J.ca, J.ct, [-30, 95]],
  ardent: [[165, -20], [312, -20], [286, 40], [250, 70], J.ag, J.ca],
  glasswick: [[312, -20], [420, -20], [420, 168], J.gb, J.ag, [250, 70], [286, 40]],
  tamsfield: [[-30, 95], J.ct, J.tl, [-30, 172]],
  quillon: [J.ca, J.ag, J.gb, J.sb, J.ls, J.tl, J.ct],
  lowmere: [[-30, 172], J.tl, J.ls, [166, 320], [-30, 320]],
  brassport: [J.gb, [420, 168], [420, 320], [252, 320], J.sb],
  sallow: [J.ls, J.sb, [252, 320], [166, 320]],
};
/** Jittered region rings (the same borders the SVG map draws). */
export const REG_RING: Record<RegionId, Pt[]> = Object.fromEntries(Object.entries(REG_POLY).map(([k, v]) => [k, ring(v, 2.6, 8)]));
/** Interior borders only (segments between two regions), jittered polylines. Extend past the coast; clip to land. */
export const BORDER_SEGS: Pt[][] = ([[[165, -20], J.ca], [J.ca, J.ct], [J.ct, [-30, 95]], [J.ca, J.ag], [[312, -20], [286, 40]], [[286, 40], [250, 70]], [[250, 70], J.ag], [J.ag, J.gb], [J.gb, [420, 168]],
  [J.ct, J.tl], [J.tl, [-30, 172]], [J.tl, J.ls], [J.ls, J.sb], [J.sb, J.gb], [J.ls, [166, 320]], [J.sb, [252, 320]]] as [Pt, Pt][]).map(([a, b]) => jitterSeg(a, b, 2.6, 8));

export const RIVER: Pt[] = [[232, 30], [226, 62], [214, 96], [204, 124], [198, 160], [192, 196], [188, 236], [182, 300]];
export const RIVER2: Pt[] = [[60, 120], [84, 160], [96, 196], [108, 232], [112, 262]];

export const REGION_LABEL: Record<RegionId, Pt> = {
  corvane: [80, 64], ardent: [210, 82], glasswick: [306, 112], tamsfield: [66, 140], quillon: [214, 168], lowmere: [80, 214], brassport: [290, 228], sallow: [212, 254],
};
/** Seat of the Assembly in Quillon. */
export const CAPITAL: Pt = [212, 128];

/** Even-odd point-in-polygon. */
export function inPoly(x: number, y: number, poly: readonly Pt[]): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
