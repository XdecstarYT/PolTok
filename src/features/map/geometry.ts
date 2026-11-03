/**
 * Precomputed map geometry (computed once, lazily, then cached for every USMap).
 * geo: geoAlbersUsa fitted into the 975x610 viewBox (leaving a right-hand gutter
 *      for the small Northeastern states' callout labels).
 * hex: pointy-top hex tile cartogram from stateTable/shared hex positions.
 */
import { geoAlbersUsa, geoPath } from 'd3-geo';
import { feature, mesh } from 'topojson-client';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';
import statesTopo from 'us-atlas/states-10m.json';
import { abbrFromFips, ALL_ABBRS, hexPos, stateName } from './stateTable';

export const VB_W = 975;
export const VB_H = 610;

/** Small states whose geo labels sit to the right with leader lines. */
export const CALLOUT = ['VT', 'NH', 'MA', 'RI', 'CT', 'NJ', 'DE', 'MD', 'DC'];
const CALLOUT_X = 946;

/** Manual label nudges (viewBox units) where centroids look off. */
const NUDGE: Record<string, [number, number]> = {
  FL: [10, 2],
  MI: [8, 16],
  LA: [-12, -4],
  KY: [4, 3],
  ID: [0, 18],
  CA: [-8, 4],
  HI: [8, 4],
  AK: [6, -4],
  MN: [-6, 4],
  NY: [4, 0],
  WV: [-4, 4],
  VA: [4, 2],
  OK: [10, 0],
  TN: [4, 1],
  NC: [6, 0],
  SC: [4, -2],
  ME: [-2, 4],
};

export interface GeoState {
  abbr: string;
  fips: string;
  name: string;
  d: string;
  centroid: [number, number];
  label: [number, number];
  callout: boolean;
  area: number;
}

export interface HexState {
  abbr: string;
  x: number;
  y: number;
  col: number;
}

export interface MapGeometry {
  geo: GeoState[];
  geoByAbbr: Map<string, GeoState>;
  borders: string;
  nation: string;
  hex: HexState[];
  hexByAbbr: Map<string, HexState>;
  hexR: number;
  hexPath: string;
}

let cache: MapGeometry | null = null;

export function getGeometry(): MapGeometry {
  if (cache) return cache;
  const topo = statesTopo as unknown as Topology<{ states: GeometryCollection }>;
  const fc = feature(topo, topo.objects.states) as FeatureCollection<Geometry, { name?: string }>;
  const known = fc.features.filter((f) => abbrFromFips(String(f.id)));
  const inUS: FeatureCollection = { type: 'FeatureCollection', features: known as Feature[] };
  const projection = geoAlbersUsa().fitExtent(
    [
      [6, 10],
      [906, 602],
    ],
    inUS,
  );
  const path = geoPath(projection);

  const geo: GeoState[] = [];
  for (const f of known) {
    const fips = String(f.id);
    const abbr = abbrFromFips(fips)!;
    const d = path(f);
    if (!d) continue;
    const c = path.centroid(f) as [number, number];
    const n = NUDGE[abbr] ?? [0, 0];
    geo.push({
      abbr,
      fips,
      name: stateName(abbr),
      d,
      centroid: c,
      label: [c[0] + n[0], c[1] + n[1]],
      callout: CALLOUT.includes(abbr),
      area: path.area(f),
    });
  }

  // Resolve callout label positions: sorted by centroid y, min spacing.
  const callouts = geo.filter((g) => g.callout).sort((a, b) => a.centroid[1] - b.centroid[1]);
  let lastY = -Infinity;
  for (const g of callouts) {
    const y = Math.max(g.centroid[1], lastY + 19);
    g.label = [CALLOUT_X, y];
    lastY = y;
  }

  const borders =
    path(mesh(topo, topo.objects.states, (a, b) => a !== b)) ?? '';
  const nation = path(mesh(topo, topo.objects.states, (a, b) => a === b)) ?? '';

  // ---- hex layout ----
  const cells = ALL_ABBRS.map((abbr) => ({ abbr, pos: hexPos(abbr) })).filter((c) => c.pos) as {
    abbr: string;
    pos: { col: number; row: number };
  }[];
  const ux = (c: { col: number; row: number }) => c.col + (c.row % 2 ? 0.5 : 0);
  const minX = Math.min(...cells.map((c) => ux(c.pos)));
  const maxX = Math.max(...cells.map((c) => ux(c.pos)));
  const minR = Math.min(...cells.map((c) => c.pos.row));
  const maxR = Math.max(...cells.map((c) => c.pos.row));
  const S3 = Math.sqrt(3);
  const pad = 18;
  // width = (maxX-minX+1) * S3*r ; height = (maxR-minR)*1.5r + 2r
  const rW = (VB_W - pad * 2) / ((maxX - minX + 1) * S3);
  const rH = (VB_H - pad * 2) / ((maxR - minR) * 1.5 + 2);
  const hexR = Math.min(rW, rH);
  const gridW = (maxX - minX + 1) * S3 * hexR;
  const gridH = ((maxR - minR) * 1.5 + 2) * hexR;
  const ox = (VB_W - gridW) / 2 + (S3 * hexR) / 2;
  const oy = (VB_H - gridH) / 2 + hexR;
  const hex: HexState[] = cells.map(({ abbr, pos }) => ({
    abbr,
    col: pos.col,
    x: ox + (ux(pos) - minX) * S3 * hexR,
    y: oy + (pos.row - minR) * 1.5 * hexR,
  }));
  const ri = hexR * 0.94; // small gap between tiles
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 90);
    pts.push(`${(ri * Math.cos(a)).toFixed(2)},${(ri * Math.sin(a)).toFixed(2)}`);
  }
  const hexPath = `M${pts.join('L')}Z`;

  cache = {
    geo,
    geoByAbbr: new Map(geo.map((g) => [g.abbr, g])),
    borders,
    nation,
    hex,
    hexByAbbr: new Map(hex.map((h) => [h.abbr, h])),
    hexR,
    hexPath,
  };
  return cache;
}

/** Relative luminance of a #rrggbb color (0..1). Non-hex → assume dark. */
export function luminance(color: string | undefined): number {
  if (!color || !/^#[0-9a-f]{6}$/i.test(color)) return 0.1;
  const n = parseInt(color.slice(1), 16);
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255);
}
