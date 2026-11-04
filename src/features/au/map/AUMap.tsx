/**
 * AUMap — SVG map of Australian federal divisions (150) or Victorian districts (88).
 * PUBLIC API (see docs/AU_CONTRACT.md):
 *
 *   <AUMap layer="federal"|"vic" fills={{kooyong:'#2bb3a8'}} variant="geo"|"hex"
 *          onSeatClick={id=>…} renderTooltip={id=><div/>} highlight={['kooyong']} selected="kooyong"
 *          zoom="all"|"melbourne"|"sydney"|"brisbane"|"perth"|"adelaide" />
 *
 * Geometry is fetched lazily from /geo/au-federal.json | /geo/vic-districts.json (cached per session).
 * Seat ids: federal = slug of division name ("kooyong"); vic = "vic-" + slug ("vic-brunswick").
 * Zooming animates a transform on the geo layer (strokes stay crisp via non-scaling-stroke).
 * Newly highlighted seats get a one-shot white flash + ring burst, then a looping pulse.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { geoMercator, geoPath, type GeoPermissibleObjects } from 'd3-geo';
import { FEDERAL_HEX, VIC_HEX, type HexCell } from './hex';
import './aumap.css';

export type AULayer = 'federal' | 'vic';
export type AUZoom = 'all' | 'melbourne' | 'sydney' | 'brisbane' | 'perth' | 'adelaide';

export interface AUMapProps {
  layer: AULayer;
  /** fill colour per seat id; missing = emptyFill */
  fills?: Record<string, string>;
  variant?: 'geo' | 'hex';
  onSeatClick?: (id: string) => void;
  onSeatHover?: (id: string | null) => void;
  renderTooltip?: (id: string) => ReactNode;
  /** seats to flash + pulse (e.g. just called) */
  highlight?: string[];
  selected?: string | null;
  /** geo variant only: metro zoom (ignored in hex) */
  zoom?: AUZoom;
  /** dim seats not in this list */
  focus?: string[];
  /** show short seat labels in hex view (default true) */
  labels?: boolean;
  emptyFill?: string;
  /** accessible text after "Name: " */
  describe?: (id: string) => string;
  title?: string;
  className?: string;
  style?: CSSProperties;
}

interface Feature {
  type: 'Feature';
  properties: { id: string; name: string; state: string };
  geometry: GeoPermissibleObjects;
}
interface Seat {
  id: string;
  name: string;
  state: string;
  d: string;
  c: [number, number];
}
interface HexPos {
  id: string;
  x: number;
  y: number;
  group: string;
  col: number;
}
interface Built {
  seats: Seat[];
  byId: Map<string, Seat>;
  hex: HexPos[];
  hexById: Map<string, HexPos>;
  hexPath: string;
  hexR: number;
  groups: { name: string; x: number; y: number }[];
  /** projected bbox of each zoom region */
  zooms: Partial<Record<AUZoom, [[number, number], [number, number]]>>;
}

const VB_W = 1000;
const VB_H: Record<AULayer, number> = { federal: 800, vic: 640 };
const NEUTRAL = '#1c2031';
const SRC: Record<AULayer, string> = { federal: '/geo/au-federal.json', vic: '/geo/vic-districts.json' };
/** lon/lat boxes: [west, south, east, north] */
const ZOOM_BOX: Record<Exclude<AUZoom, 'all'>, [number, number, number, number]> = {
  melbourne: [144.55, -38.35, 145.55, -37.5],
  sydney: [150.55, -34.15, 151.35, -33.45],
  brisbane: [152.65, -27.85, 153.35, -27.05],
  perth: [115.65, -32.6, 116.2, -31.6],
  adelaide: [138.4, -35.3, 138.85, -34.6],
};
/** mainland + Tasmania (keeps far external territories from shrinking the fit) */
const FED_FIT: [number, number, number, number] = [112.9, -43.7, 153.7, -10.6];

const boxFeature = ([w, s, e, n]: [number, number, number, number]) => ({
  type: 'Feature' as const,
  properties: {},
  geometry: { type: 'Polygon' as const, coordinates: [[[w, s], [w, n], [e, n], [e, s], [w, s]]] },
});

const geoCache = new Map<AULayer, Promise<Feature[]>>();
function loadGeo(layer: AULayer): Promise<Feature[]> {
  let p = geoCache.get(layer);
  if (!p) {
    p = fetch(SRC[layer])
      .then((r) => {
        if (!r.ok) throw new Error(`geo ${r.status}`);
        return r.json() as Promise<{ features: Feature[] }>;
      })
      .then((j) => j.features);
    p.catch(() => geoCache.delete(layer));
    geoCache.set(layer, p);
  }
  return p;
}

const STATE_ABBR: Record<string, string> = {
  'New South Wales': 'NSW', Victoria: 'VIC', Queensland: 'QLD', 'Western Australia': 'WA', 'South Australia': 'SA',
  Tasmania: 'TAS', 'Australian Capital Territory': 'ACT', 'Northern Territory': 'NT',
};

function build(layer: AULayer, feats: Feature[]): Built {
  const H = VB_H[layer];
  const proj = geoMercator();
  const pad = 18;
  if (layer === 'federal') proj.fitExtent([[pad, pad], [VB_W - pad, H - pad]], boxFeature(FED_FIT));
  else proj.fitExtent([[pad, pad], [VB_W - pad, H - pad]], { type: 'FeatureCollection', features: feats } as GeoPermissibleObjects);
  const path = geoPath(proj);
  const seats: Seat[] = feats.map((f) => {
    // label/centroid point = centroid of the largest polygon part
    let c: [number, number] = path.centroid(f.geometry);
    const g = f.geometry as { type: string; coordinates: number[][][][] };
    if (g.type === 'MultiPolygon' && g.coordinates.length > 1) {
      let best = -1;
      for (const poly of g.coordinates) {
        const part = { type: 'Polygon', coordinates: poly } as GeoPermissibleObjects;
        const a = path.area(part);
        if (a > best) {
          best = a;
          c = path.centroid(part);
        }
      }
    }
    return { id: f.properties.id, name: f.properties.name, state: f.properties.state, d: path(f.geometry) ?? '', c };
  });
  const zooms: Built['zooms'] = {};
  for (const [k, box] of Object.entries(ZOOM_BOX)) zooms[k as AUZoom] = path.bounds(boxFeature(box));

  // hex layout: pointy-top, odd-r offset
  const cells: HexCell[] = layer === 'federal' ? FEDERAL_HEX : VIC_HEX;
  const maxC = Math.max(...cells.map((c) => c[1])) + 1.5;
  const maxR = Math.max(...cells.map((c) => c[2]));
  const R = Math.min((VB_W - 2 * pad) / (maxC * Math.sqrt(3)), (H - 2 * pad) / (maxR * 1.5 + 2));
  const w = Math.sqrt(3) * R;
  const ox = (VB_W - maxC * w) / 2 + w / 2;
  const oy = (H - (maxR * 1.5 + 2) * R) / 2 + R;
  const hex: HexPos[] = cells.map(([id, col, row, group]) => ({ id, group, col, x: ox + (col + (row & 1 ? 0.5 : 0)) * w, y: oy + row * 1.5 * R }));
  const r = R * 0.94;
  const hexPath =
    Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      return `${i ? 'L' : 'M'}${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`;
    }).join('') + 'Z';
  const gm = new Map<string, HexPos[]>();
  for (const h of hex) gm.set(h.group, [...(gm.get(h.group) ?? []), h]);
  const groups = [...gm].map(([name, hs]) => {
    // place the group label just outside the group's left-most cell row band
    const minX = Math.min(...hs.map((h) => h.x));
    const top = Math.min(...hs.map((h) => h.y));
    const leftTop = hs.filter((h) => h.y === top).sort((a, b) => a.x - b.x)[0];
    return { name: STATE_ABBR[name] ?? name.replace('Metropolitan', 'Metro'), x: Math.min(leftTop.x, minX + R), y: top - R * 1.25 };
  });
  return { seats, byId: new Map(seats.map((s) => [s.id, s])), hex, hexById: new Map(hex.map((h) => [h.id, h])), hexPath, hexR: R, groups, zooms };
}

const shortName = (name: string) => {
  const parts = name.replace(/[^A-Za-z ]/g, '').split(/\s+/).filter(Boolean);
  if (parts.length > 1) return parts.map((p) => p[0]).join('').slice(0, 3).toUpperCase();
  return name.slice(0, 3).toUpperCase();
};
function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

function AUMapImpl({
  layer,
  fills,
  variant = 'geo',
  onSeatClick,
  onSeatHover,
  renderTooltip,
  highlight,
  selected,
  zoom = 'all',
  focus,
  labels = true,
  emptyFill = NEUTRAL,
  describe,
  title,
  className,
  style,
}: AUMapProps) {
  const [feats, setFeats] = useState<{ layer: AULayer; f: Feature[] } | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let live = true;
    setErr(false);
    loadGeo(layer).then(
      (f) => live && setFeats({ layer, f }),
      () => live && setErr(true),
    );
    return () => {
      live = false;
    };
  }, [layer]);
  const G = useMemo(() => (feats && feats.layer === layer ? build(layer, feats.f) : null), [feats, layer]);

  const H = VB_H[layer];
  const wrapRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<string | null>(null);
  const isHex = variant === 'hex';
  const fillOf = (id: string) => fills?.[id] ?? emptyFill;
  const focusSet = useMemo(() => (focus && focus.length ? new Set(focus) : null), [focus]);
  const dimmed = (id: string) => !!focusSet && !focusSet.has(id);

  // zoom transform for the geo layer
  const zb = !isHex && zoom !== 'all' ? G?.zooms[zoom] : undefined;
  let k = 1;
  let tx = 0;
  let ty = 0;
  if (zb) {
    const [[x0, y0], [x1, y1]] = zb;
    k = Math.min(VB_W / (x1 - x0), H / (y1 - y0));
    tx = VB_W / 2 - k * ((x0 + x1) / 2);
    ty = H / 2 - k * ((y0 + y1) / 2);
  }
  const zoomT = `translate(${tx}px, ${ty}px) scale(${k})`;

  const placeTip = useCallback((clientX: number, clientY: number) => {
    const wrap = wrapRef.current;
    const tip = tipRef.current;
    if (!wrap || !tip) return;
    const r = wrap.getBoundingClientRect();
    const x = clientX - r.left;
    const y = clientY - r.top;
    const tw = tip.offsetWidth || 200;
    const th = tip.offsetHeight || 80;
    let left = x + 16;
    if (left + tw > r.width - 4) left = x - tw - 16;
    left = Math.max(4, left);
    let top = y - th - 14;
    if (top < 4) top = y + 18;
    tip.style.transform = `translate3d(${left}px, ${top}px, 0)`;
  }, []);

  const enter = (id: string) => {
    setHover(id);
    onSeatHover?.(id);
  };
  const leave = () => {
    setHover(null);
    onSeatHover?.(null);
  };
  const onFocusSeat = (id: string) => {
    enter(id);
    requestAnimationFrame(() => {
      const svg = wrapRef.current?.querySelector('svg');
      if (!svg || !G) return;
      let p: [number, number] | undefined;
      if (isHex) {
        const h = G.hexById.get(id);
        if (h) p = [h.x, h.y];
      } else {
        const s = G.byId.get(id);
        if (s) p = [s.c[0] * k + tx, s.c[1] * k + ty];
      }
      if (!p) return;
      const r = svg.getBoundingClientRect();
      placeTip(r.left + (p[0] / VB_W) * r.width, r.top + (p[1] / H) * r.height);
    });
  };
  const interactive = (id: string, name: string, active: boolean) =>
    active
      ? {
          tabIndex: 0,
          role: onSeatClick ? 'button' : 'img',
          'aria-label': `${name}: ${describe ? describe(id) : onSeatClick ? 'select for details' : 'seat'}`,
          onPointerEnter: (e: PointerEvent) => {
            enter(id);
            placeTip(e.clientX, e.clientY);
          },
          onPointerLeave: leave,
          onFocus: () => onFocusSeat(id),
          onBlur: leave,
          onClick: () => onSeatClick?.(id),
          onKeyDown: (e: KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSeatClick?.(id);
            }
          },
        }
      : { tabIndex: -1, 'aria-hidden': true as const };

  const label = title ?? (layer === 'federal' ? 'Map of Australian federal electoral divisions' : 'Map of Victorian electoral districts');
  const cls = `aumap ${isHex ? 'is-hex' : 'is-geo'} ${zb ? 'is-zoomed' : ''} ${focusSet ? 'has-focus' : ''} ${onSeatClick ? 'is-clickable' : ''} ${className ?? ''}`;
  const wrapStyle: CSSProperties = { aspectRatio: `${VB_W} / ${H}`, ...style };

  if (!G) {
    return (
      <div className={`${cls} is-loading`} style={wrapStyle} role="img" aria-label={label} aria-busy={!err}>
        <div className="aumap-status">{err ? 'Map unavailable' : 'Loading map…'}</div>
      </div>
    );
  }

  const hl = (highlight ?? []).filter((id) => G.byId.has(id));
  const tip = hover && renderTooltip ? renderTooltip(hover) : null;
  const hoverSeat = hover && !isHex ? G.byId.get(hover) : undefined;
  const hoverHex = hover && isHex ? G.hexById.get(hover) : undefined;
  const selSeat = selected && !isHex ? G.byId.get(selected) : undefined;
  const selHex = selected && isHex ? G.hexById.get(selected) : undefined;
  const maxCol = Math.max(...G.hex.map((h) => h.col));

  return (
    <div ref={wrapRef} className={cls} style={wrapStyle} onPointerMove={(e) => hover && placeTip(e.clientX, e.clientY)}>
      <svg viewBox={`0 0 ${VB_W} ${H}`} role="group" aria-label={label} className="aumap-svg">
        {/* ---------- GEO ---------- */}
        <g className="aumap-geo" aria-hidden={isHex}>
          <g className="aumap-zoom" style={{ transform: zoomT }}>
            {G.seats.map((s) => (
              <path
                key={s.id}
                d={s.d}
                className={`aumap-seat ${dimmed(s.id) ? 'is-dim' : ''}`}
                style={{ fill: fillOf(s.id) }}
                {...interactive(s.id, s.name, !isHex)}
              />
            ))}
            {selSeat && <path className="aumap-selected" d={selSeat.d} />}
            {hoverSeat && <path className="aumap-hover" d={hoverSeat.d} style={{ fill: fillOf(hoverSeat.id) }} />}
            {!isHex &&
              hl.map((id) => {
                const s = G.byId.get(id)!;
                return (
                  <g key={id}>
                    <path className="aumap-flash" d={s.d} />
                    <circle className="aumap-ring" cx={s.c[0]} cy={s.c[1]} r={5 / k} />
                    <circle className="aumap-ring aumap-ring--2" cx={s.c[0]} cy={s.c[1]} r={5 / k} />
                    <path className="aumap-pulse" d={s.d} />
                  </g>
                );
              })}
          </g>
          {zb && labels && (
            <g className="aumap-geo-labels" aria-hidden>
              {G.seats.map((s) => {
                const x = s.c[0] * k + tx;
                const y = s.c[1] * k + ty;
                if (x < 20 || x > VB_W - 20 || y < 10 || y > H - 10) return null;
                return (
                  <text key={s.id} x={x} y={y} className={`aumap-geo-label ${luminance(fillOf(s.id)) > 0.55 ? 'on-light' : ''}`} textAnchor="middle" dominantBaseline="central">
                    {s.name}
                  </text>
                );
              })}
            </g>
          )}
        </g>

        {/* ---------- HEX ---------- */}
        <g className="aumap-hexes" aria-hidden={!isHex}>
          {G.hex.map((h) => {
            const s = G.byId.get(h.id);
            const from = s ? s.c : [h.x, h.y];
            const t = isHex ? `translate(${h.x}px, ${h.y}px) scale(1)` : `translate(${from[0]}px, ${from[1]}px) scale(0.15)`;
            const L = luminance(fillOf(h.id));
            return (
              <g key={h.id} className="aumap-hex-cell" style={{ transform: t, transitionDelay: `${(isHex ? h.col : maxCol - h.col) * 14}ms` }}>
                <path d={G.hexPath} className={`aumap-hex ${dimmed(h.id) ? 'is-dim' : ''}`} style={{ fill: fillOf(h.id) }} {...interactive(h.id, s?.name ?? h.id, isHex)} />
                {labels && s && (
                  <text className={`aumap-hex-label ${L > 0.55 ? 'on-light' : ''} ${dimmed(h.id) ? 'is-dim' : ''}`} style={{ fontSize: G.hexR * 0.62 }} textAnchor="middle" dominantBaseline="central">
                    {shortName(s.name)}
                  </text>
                )}
              </g>
            );
          })}
          {isHex && layer === 'federal' &&
            G.groups.map((g) => (
              <text key={g.name} x={g.x} y={g.y} className="aumap-group" aria-hidden>
                {g.name}
              </text>
            ))}
          {selHex && <path className="aumap-selected" d={G.hexPath} transform={`translate(${selHex.x} ${selHex.y})`} />}
          {hoverHex && <path className="aumap-hover aumap-hover-hex" d={G.hexPath} transform={`translate(${hoverHex.x} ${hoverHex.y - 2})`} style={{ fill: fillOf(hoverHex.id) }} />}
          {isHex &&
            hl.map((id) => {
              const h = G.hexById.get(id);
              return h ? (
                <g key={id} transform={`translate(${h.x} ${h.y})`}>
                  <path className="aumap-flash" d={G.hexPath} />
                  <circle className="aumap-ring" r={5} />
                  <circle className="aumap-ring aumap-ring--2" r={5} />
                  <path className="aumap-pulse" d={G.hexPath} />
                </g>
              ) : null;
            })}
        </g>
      </svg>
      <div ref={tipRef} className={`aumap-tip ${tip ? 'is-on' : ''}`} role="tooltip" aria-hidden={!tip}>
        {tip}
      </div>
    </div>
  );
}

export const AUMap = memo(AUMapImpl);
export default AUMap;
