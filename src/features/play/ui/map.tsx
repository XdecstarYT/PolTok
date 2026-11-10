// Original illustrated SVG map of the Republic of Calderra. The hand-authored geometry lives in geo.ts (shared with the 3D world).
import { memo, useId, type ReactNode } from 'react';
import type { GameState, RegionId } from '../engine/types';
import { CONTENT, partyColor, partyName } from './adapter';
import { seeded, tip } from './fx';
import { BORDER_SEGS, COAST_LINE, FRONTIER_LINE, LAND_RING, REG_RING, REGION_LABEL, RIVER, RIVER2, type Pt } from './geo';

const f1 = (n: number) => n.toFixed(1);
function poly(pts: Pt[]) { return `M${pts.map((p) => `${f1(p[0])},${f1(p[1])}`).join('L')}Z`; }
/** Closed Catmull-Rom spline through points. */
function smooth(pts: Pt[], closed = true) {
  const n = pts.length; const P = (i: number) => pts[closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
  let d = `M${f1(pts[0][0])},${f1(pts[0][1])}`;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    d += `C${f1(p1[0] + (p2[0] - p0[0]) / 6)},${f1(p1[1] + (p2[1] - p0[1]) / 6)} ${f1(p2[0] - (p3[0] - p1[0]) / 6)},${f1(p2[1] - (p3[1] - p1[1]) / 6)} ${f1(p2[0])},${f1(p2[1])}`;
  }
  return closed ? d + 'Z' : d;
}

// ---------------------------------------------------------------- Calderra

const LAND_D = smooth(LAND_RING);
const COAST_ONLY_D = smooth(COAST_LINE, false);
const FRONTIER_D = smooth(FRONTIER_LINE, false);

const REG_D: Record<string, string> = Object.fromEntries(Object.entries(REG_RING).map(([k, v]) => [k, poly(v)]));
// interior borders only (segments between two regions)
const BORDER_D = BORDER_SEGS.map((pts) => `M${pts.map((p) => `${f1(p[0])},${f1(p[1])}`).join('L')}`).join('');
const RIVER_D = smooth(RIVER, false);
const RIVER2_D = smooth(RIVER2, false);

export { REGION_LABEL };

// terrain glyph layers (decorative, clipped to land)
const r0 = seeded('calderra-terrain');
const MOUNTAINS: Pt[] = [[176, 44], [196, 30], [214, 50], [238, 36], [258, 52], [184, 64], [226, 64], [250, 20], [270, 74], [160, 26], [282, 36]];
const TREES: Pt[] = Array.from({ length: 26 }, () => [r0.range(36, 150), r0.range(16, 92)] as Pt).filter(([x, y]) => Math.hypot(x - 80, y - 64) > 22);
const FIELDS: { x: number; y: number; a: number }[] = [[24, 112], [54, 118], [96, 116], [112, 146], [30, 150], [88, 154], [120, 128]].map(([x, y]) => ({ x, y, a: r0.range(-30, 30) }));
const MARSH: Pt[] = Array.from({ length: 16 }, () => [r0.range(24, 150), r0.range(176, 244)] as Pt).filter(([x, y]) => Math.hypot(x - 80, y - 214) > 18);
const PONDS: Pt[] = [[44, 196], [126, 222], [58, 234], [140, 186]];
const DUNES: Pt[] = [[176, 230], [198, 270], [232, 228], [230, 250], [170, 252], [212, 216]];

function Mountain({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return <g transform={`translate(${x} ${y}) scale(${s})`}><path d="M-11,6 L-2,-9 L3,-2 L6,-6 L13,6 Z" className="q-t-mtn" /><path d="M-2,-9 L-5.5,-3 L-2.6,-4.2 L0,-2 L1.2,-5.4 Z" className="q-t-snow" /></g>;
}
function Terrain({ era }: { era: number }) {
  return (
    <g className="q-map__terrain" aria-hidden="true">
      {FIELDS.map((f, i) => <g key={i} transform={`translate(${f.x} ${f.y}) rotate(${f.a})`}><rect x="-10" y="-6" width="20" height="12" className="q-t-field" />{[-3, 0, 3].map((d) => <line key={d} x1="-9" x2="9" y1={d} y2={d} className="q-t-furrow" />)}</g>)}
      {TREES.map(([x, y], i) => <g key={i} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}><path d="M0,-6 L4,2 L-4,2 Z" className="q-t-tree" /><line x1="0" y1="2" x2="0" y2="4" className="q-t-trunk" /></g>)}
      {MOUNTAINS.map(([x, y], i) => <Mountain key={i} x={x} y={y} s={i % 3 === 0 ? 1.2 : 0.9} />)}
      {PONDS.map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx="7" ry="3" className="q-t-pond" />)}
      {MARSH.map(([x, y], i) => <path key={i} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`} d="M-3,0 L-2,-4 M0,0 L0,-5 M3,0 L2,-4 M-4,0 L4,0" className="q-t-marsh" />)}
      {DUNES.map(([x, y], i) => <path key={i} transform={`translate(${x} ${y})`} d="M-9,2 Q-4,-4 0,2 Q4,-3 9,2" className="q-t-dune" />)}
      {/* Glasswick furnaces */}
      {[[296, 78], [320, 128], [286, 140], [312, 58]].map(([x, y], i) => <g key={i} transform={`translate(${x} ${y})`}><rect x="-4" y="-2" width="8" height="7" className="q-t-bldg" /><rect x="1" y="-10" width="2.4" height="9" className="q-t-bldg" /><circle cx="2.4" cy="-13" r="2.6" className="q-t-smoke" /><circle cx="5" cy="-17" r="2" className="q-t-smoke" /></g>)}
      {/* Brassport docks */}
      <g transform="translate(300 196)"><path d="M0,0 L14,-3 M2,6 L16,4 M0,-7 L12,-11" className="q-t-pier" /></g>
      {[[268, 204], [278, 196], [284, 210], [262, 214], [272, 186]].map(([x, y], i) => <rect key={i} x={x} y={y} width="6" height="5" className="q-t-bldg" />)}
      {/* Quillon, the capital */}
      {[[196, 140], [206, 134], [216, 142], [224, 134], [202, 150]].map(([x, y], i) => <rect key={i} x={x} y={y} width="6" height="6" className="q-t-bldg" />)}
      <path transform="translate(212 125)" d="M0,-6 L1.8,-1.8 L6,-1.8 L2.6,0.9 L3.8,5 L0,2.6 L-3.8,5 L-2.6,0.9 L-6,-1.8 L-1.8,-1.8 Z" className="q-t-capital" />
      {/* Sallow lighthouse */}
      <g transform="translate(248 266)"><path d="M-2,4 L-1.2,-6 L1.2,-6 L2,4 Z" className="q-t-light" /><circle cx="0" cy="-7" r="1.6" className="q-t-lamp" /></g>
      {/* era overlays: Smokestack railways, Signal telegraph */}
      {era >= 2 && <path d="M214,140 C240,150 260,170 286,196 M214,140 C250,120 280,110 300,96 M214,140 C170,150 120,150 70,140" className="q-t-rail" />}
      {era >= 3 && <g className="q-t-wire"><path d="M214,140 L306,112 M214,140 L80,64 M214,140 L80,214 M214,140 L290,228" />{[[260, 126], [147, 102], [147, 177], [252, 184]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.4" />)}</g>}
    </g>
  );
}

// ---------------------------------------------------------------- component

export function regionLeader(s: GameState, id: RegionId): { party: string | null; seats: Record<string, number> | null } {
  const last = s.elections[s.elections.length - 1];
  const r = last?.regions.find((x) => x.regionId === id);
  if (!r) return { party: null, seats: null };
  const party = Object.entries(r.seats).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return { party, seats: r.seats };
}

export interface MapProps {
  s: GameState;
  selected?: RegionId | null;
  onSelect?: (id: RegionId) => void;
  /** Colour regions by these (election night), instead of the last result. */
  flash?: Record<RegionId, string>;
  /** Region currently declaring (pulse). */
  pulse?: RegionId | null;
  /** Extra tooltip text per region. */
  info?: (id: RegionId) => ReactNode;
  compact?: boolean;
  className?: string;
}

export const CalderraMap = memo(function CalderraMap({ s, selected, onSelect, flash, pulse, info, compact, className }: MapProps) {
  const uid = useId().replace(/:/g, '');
  const era = s.era ?? 1;
  return (
    <svg className={`q-map ${compact ? 'is-compact' : ''} ${className ?? ''}`} viewBox="-46 -10 422 304" role="group" aria-label="Map of the Republic of Calderra, 8 regions">
      <defs>
        <clipPath id={`land${uid}`}><path d={LAND_D} /></clipPath>
        <pattern id={`wav${uid}`} width="22" height="12" patternUnits="userSpaceOnUse"><path d="M0,8 Q5.5,4 11,8 T22,8" className="q-map__wave" /></pattern>
        <pattern id={`hatch${uid}`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" className="q-map__hatch" /></pattern>
        <radialGradient id={`sea${uid}`} cx="70%" cy="60%" r="80%"><stop offset="0%" className="q-map__sea0" /><stop offset="100%" className="q-map__sea1" /></radialGradient>
      </defs>
      <rect x="-46" y="-10" width="422" height="304" fill={`url(#sea${uid})`} />
      <rect x="-46" y="-10" width="422" height="304" fill={`url(#wav${uid})`} />
      {/* neighbouring land beyond the western frontier */}
      <path d={`${FRONTIER_D.replace(/^M/, 'M')}L-46,-10L-46,294L8,294Z`} className="q-map__neighbor" />
      <path d={`${FRONTIER_D}L-46,-10L-46,294L8,294Z`} fill={`url(#hatch${uid})`} />
      <text x="-26" y="140" className="q-map__nlbl" transform="rotate(-90 -26 140)">THE HOLLIN REACH</text>
      {/* shallows */}
      <path d={COAST_ONLY_D} className="q-map__shoal q-map__shoal--2" />
      <path d={COAST_ONLY_D} className="q-map__shoal" />
      <path d={LAND_D} className="q-map__land" />
      <g clipPath={`url(#land${uid})`}>
        {CONTENT.regions.map((reg) => {
          const lead = regionLeader(s, reg.id).party;
          const fill = flash ? flash[reg.id] : lead ? partyColor(s, lead) : undefined;
          return <path key={reg.id} d={REG_D[reg.id]} className={`q-map__tint${flash?.[reg.id] ? ' is-flash' : ''}`} style={fill ? { fill } : { fillOpacity: 0 }} />;
        })}
        <Terrain era={era} />
        <path d={RIVER_D} className="q-map__river" />
        <path d={RIVER2_D} className="q-map__river is-thin" />
        <path d={BORDER_D} className="q-map__border" />
      </g>
      <path d={COAST_ONLY_D} className="q-map__coast" />
      <path d={FRONTIER_D} className="q-map__frontier" />
      {/* interactive regions on top */}
      {CONTENT.regions.map((reg) => {
        const { party: lead, seats } = regionLeader(s, reg.id);
        const camp = s.campaign?.[reg.id] ?? 0;
        const sel = selected === reg.id;
        const [lx, ly] = REGION_LABEL[reg.id];
        const label = `${reg.name}, ${reg.seats} seats${lead ? `, led by ${partyName(s, lead)}` : ''}${camp ? `, you campaigned ${camp} time${camp > 1 ? 's' : ''}` : ''}`;
        const tipBody = (
          <span className="q-tip__body"><b>{reg.name}</b> · {reg.seats} seats<br />
            {seats ? Object.entries(seats).filter(([, n]) => n).sort((a, b) => b[1] - a[1]).map(([p, n]) => <span key={p} className="q-tip__row"><i className="q-dot" style={{ background: partyColor(s, p) }} /> {partyName(s, p)} <b className="q-num">{n}</b></span>) : <span className="q-muted">No result yet</span>}
            {info?.(reg.id)}
            {camp > 0 && <span className="q-tip__row">Your campaigns this term: <b className="q-num">{camp}</b></span>}
          </span>
        );
        return (
          <g key={reg.id} className={`q-map__reg${sel ? ' is-sel' : ''}${pulse === reg.id ? ' is-pulse' : ''}${onSelect ? ' is-click' : ''}`}
            role={onSelect ? 'button' : 'img'} tabIndex={onSelect ? 0 : undefined} aria-label={label} aria-pressed={onSelect ? sel : undefined}
            onClick={() => onSelect?.(reg.id)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect?.(reg.id); } }}
            {...tip(tipBody)}>
            <path d={REG_D[reg.id]} className="q-map__hit" clipPath={`url(#land${uid})`} />
            <g className="q-map__lblg">
              <text x={lx} y={ly} className="q-map__lbl">{reg.name.split(' ')[0].toUpperCase()}</text>
              {!compact && <text x={lx} y={ly + 9} className="q-map__seats">{reg.seats} seats</text>}
              {camp > 0 && Array.from({ length: Math.min(camp, 4) }, (_, i) => (
                <g key={i} transform={`translate(${lx + 18 + i * 6} ${ly - 12})`} className="q-map__flag"><line x1="0" y1="0" x2="0" y2="10" /><path d="M0,0 L7,2.5 L0,5 Z" style={{ fill: s.player.color }} /></g>
              ))}
            </g>
          </g>
        );
      })}
      {selected && <path d={REG_D[selected]} clipPath={`url(#land${uid})`} className="q-map__selring" />}
      {/* compass + sea names */}
      <g transform="translate(350 268)" className="q-map__compass" aria-hidden="true">
        <circle r="13" /><path d="M0,-16 L3,0 L0,16 L-3,0 Z" className="q-map__compass-n" /><path d="M-16,0 L0,3 L16,0 L0,-3 Z" />
        <text y="-19" textAnchor="middle">N</text>
      </g>
      <text x="92" y="282" className="q-map__sea-lbl">Gulf of Sallow</text>
      <text x="364" y="160" className="q-map__sea-lbl" transform="rotate(90 364 160)">The Brass Sound</text>
      <text x="300" y="2" className="q-map__sea-lbl">Lantern Sea</text>
    </svg>
  );
});
