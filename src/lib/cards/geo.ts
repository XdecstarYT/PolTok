/**
 * Geography art for cards: US state / AU electorate silhouettes with glow + inner shadow,
 * a mini US choropleth (real 2024 presidential margins), and US / AU hex maps.
 * AU electorate outlines are fetched once (/geo/*.json) — call preloadGeo() before drawing.
 */
import { geoMercator, geoPath } from 'd3-geo';
import type { Feature } from 'geojson';
import type { Ctx } from './kit';
import { mix, rgba, drawAuHex } from './kit';
import { stateShape, getGeometry, VB_W, VB_H } from '../../features/map/geometry';
import { pres2024 } from '../../features/map/stateTable';

const AU_SRC = { federal: '/geo/au-federal.json', vic: '/geo/vic-districts.json' };
const auFeats = new Map<string, Feature>();
const auLoads = new Map<string, Promise<void>>();

/** Loads AU electorate outlines needed for this mapState (no-op for US / unknown). */
export function preloadGeo(mapState?: string, timeout = 3000): Promise<void> {
  if (!mapState?.startsWith('AU:') || typeof fetch === 'undefined') return Promise.resolve();
  const layer = mapState.slice(3).startsWith('vic-') ? 'vic' : 'federal';
  let p = auLoads.get(layer);
  if (!p) {
    p = fetch(AU_SRC[layer]).then((r) => (r.ok ? r.json() : { features: [] })).then((j: { features: Feature[] }) => {
      for (const f of j.features ?? []) { const id = (f.properties as { id?: string } | null)?.id; if (id) auFeats.set(id, f); }
    }).catch(() => { auLoads.delete(layer); });
    auLoads.set(layer, p);
  }
  return Promise.race([p, new Promise<void>((r) => setTimeout(r, timeout))]);
}

/** Path for a region fitted into w×h (local coords), or null. */
export function regionPath(mapState: string | undefined, w: number, h: number, pad = 0): Path2D | null {
  if (!mapState) return null;
  if (mapState.startsWith('AU:')) {
    const f = auFeats.get(mapState.slice(3));
    if (!f) return null;
    const proj = geoMercator().fitExtent([[pad, pad], [w - pad, h - pad]], f);
    const d = geoPath(proj)(f);
    return d ? new Path2D(d) : null;
  }
  const s = stateShape(mapState, w, h, pad);
  return s ? new Path2D(s.d) : null;
}

export interface SilhouetteOpts { fill: string | CanvasGradient; glow?: string; glowSize?: number; inner?: string; stroke?: string; lineWidth?: number; extrude?: { depth: number; color: string } }

/** Region silhouette with outer glow, inner shadow and optional 3D extrusion. Returns false when there's no shape. */
export function silhouette(ctx: Ctx, mapState: string | undefined, x: number, y: number, w: number, h: number, o: SilhouetteOpts): boolean {
  const p = regionPath(mapState, w, h, Math.min(w, h) * 0.04);
  if (!p) return false;
  const S = Math.min(w, h);
  ctx.save();
  ctx.translate(x, y);
  if (o.extrude) {
    const n = Math.max(2, Math.round(o.extrude.depth / 2));
    for (let i = n; i > 0; i--) { ctx.save(); ctx.translate(i * 1.4, i * 2); ctx.fillStyle = mix(o.extrude.color, '#000000', 0.2 + (i / n) * 0.3); ctx.fill(p); ctx.restore(); }
  }
  if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = o.glowSize ?? S * 0.09; }
  ctx.fillStyle = o.fill;
  ctx.fill(p);
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
  if (o.inner) {
    // inner shadow: clip to the shape and stroke a thick blurred edge
    ctx.save();
    ctx.clip(p);
    ctx.shadowColor = o.inner; ctx.shadowBlur = S * 0.06;
    ctx.lineWidth = S * 0.05; ctx.strokeStyle = o.inner;
    ctx.stroke(p);
    ctx.restore();
  }
  if (o.stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = o.lineWidth ?? Math.max(1.5, S / 260); ctx.strokeStyle = o.stroke; ctx.stroke(p); }
  ctx.restore();
  return true;
}

/** Diverging colour for a D–R margin (percentage points). */
export function marginColor(m: number, dem = '#3d7bff', rep = '#ff3d55', neutral = '#e9e6df'): string {
  const t = Math.min(1, Math.abs(m) / 30);
  return mix(neutral, m >= 0 ? dem : rep, 0.25 + t * 0.75);
}

/** Mini US choropleth (2024 presidential margin by state; real data), optional highlight. */
export function usChoropleth(ctx: Ctx, x: number, y: number, w: number, h: number, o: { highlight?: string; dem?: string; rep?: string; neutral?: string; border?: string; dim?: number; fillFor?: (abbr: string) => string | undefined } = {}) {
  const g = getGeometry();
  const s = Math.min(w / VB_W, h / VB_H);
  ctx.save();
  ctx.translate(x + (w - VB_W * s) / 2, y + (h - VB_H * s) / 2);
  ctx.scale(s, s);
  for (const st of g.geo) {
    const p = new Path2D(st.d);
    const c = o.fillFor?.(st.abbr) ?? marginColor(pres2024(st.abbr).margin, o.dem, o.rep, o.neutral);
    ctx.fillStyle = o.highlight && st.abbr !== o.highlight ? mix(c, o.neutral ?? '#e9e6df', o.dim ?? 0.55) : c;
    ctx.fill(p);
  }
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = o.border ?? 'rgba(255,255,255,0.7)';
  ctx.stroke(new Path2D(g.borders));
  if (o.highlight) {
    const st = g.geoByAbbr.get(o.highlight);
    if (st) { const p = new Path2D(st.d); ctx.lineWidth = 3; ctx.strokeStyle = '#111'; ctx.stroke(p); ctx.lineWidth = 1.2; ctx.strokeStyle = '#fff'; ctx.stroke(p); }
  }
  ctx.restore();
}

/** US hex tile map; returns the highlighted tile centre in canvas coords. */
export function usHex(ctx: Ctx, x: number, y: number, w: number, h: number, o: { highlight?: string; fillFor?: (abbr: string) => string; base?: string; hi?: string; labels?: string; extrude?: number }): [number, number] | null {
  const g = getGeometry();
  const s = Math.min(w / VB_W, h / VB_H);
  const ox = x + (w - VB_W * s) / 2, oy = y + (h - VB_H * s) / 2;
  const hp = new Path2D(g.hexPath);
  let at: [number, number] | null = null;
  ctx.save();
  for (const t of g.hex) {
    const cx = ox + t.x * s, cy = oy + t.y * s;
    const fill = t.abbr === o.highlight ? (o.hi ?? '#ffd400') : o.fillFor?.(t.abbr) ?? o.base ?? 'rgba(255,255,255,0.12)';
    ctx.save();
    ctx.translate(cx, cy); ctx.scale(s, s);
    if (o.extrude) { for (let i = Math.round(o.extrude); i > 0; i--) { ctx.save(); ctx.translate(0, i * 1.6); ctx.fillStyle = mix(fill.startsWith('#') ? fill : '#333333', '#000000', 0.45); ctx.fill(hp); ctx.restore(); } }
    ctx.fillStyle = fill;
    ctx.fill(hp);
    ctx.restore();
    if (t.abbr === o.highlight) at = [cx, cy];
    if (o.labels) {
      ctx.fillStyle = o.labels; ctx.font = `700 ${Math.max(7, g.hexR * s * 0.55)}px Inter, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(t.abbr, cx, cy + 1);
    }
  }
  ctx.restore();
  if (at && o.highlight) {
    ctx.save();
    ctx.translate(at[0], at[1]); ctx.scale(s * 1.25, s * 1.25);
    ctx.shadowColor = rgba(o.hi && o.hi.startsWith('#') ? o.hi : '#ffd400', 0.9); ctx.shadowBlur = 18;
    ctx.fillStyle = o.hi ?? '#ffd400'; ctx.fill(hp);
    ctx.restore();
  }
  return at;
}

/** Hex map for any mapState: US tile map, or the AU federal/Vic cartogram. */
export function hexMap(ctx: Ctx, mapState: string | undefined, x: number, y: number, w: number, h: number, o: { base: string; hi: string; labels?: string; extrude?: number; fillFor?: (abbr: string) => string }): boolean {
  if (mapState?.startsWith('AU:')) return drawAuHex(ctx, mapState.slice(3), x, y, w, h, { fill: o.hi, base: o.base, glow: o.hi });
  usHex(ctx, x, y, w, h, { highlight: mapState, base: o.base, hi: o.hi, labels: o.labels, extrude: o.extrude, fillFor: o.fillFor });
  return true;
}
