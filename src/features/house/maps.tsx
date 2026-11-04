import { memo, useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { geoAlbersUsa, geoPath } from 'd3-geo';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { PARTY_HEX, mixHex } from '../../lib/format';
import { stateByFips } from '../../data';
import { HOUSE_HEX } from './hexLayout';
import { pad, type HRace, type P } from './data';

const BASE = '#262c3d';
const PHEX: Record<P, string> = { D: PARTY_HEX.D, R: PARTY_HEX.R, I: PARTY_HEX.I, O: PARTY_HEX.O };

/** Party color, saturation scaled by margin (0 → muted, ≥30 pts → full). */
export function raceFill(r?: HRace): string {
  if (!r || !r.party) return BASE;
  const t = Math.min(1, Math.max(0, r.margin) / 30);
  return mixHex(BASE, PHEX[r.party], (r.called ? 0.45 : 0.3) + t * (r.called ? 0.55 : 0.45));
}

export function describeRace(r?: HRace): string {
  if (!r) return 'no data';
  const lead = r.winner ?? r.leader;
  const status = r.called ? `called for ${lead?.name} (${lead?.party})` : r.runoff ? 'headed to runoff' : lead ? `${lead.name} (${lead.party}) leads` : 'no votes reported';
  return `${status}${lead && !r.uncontested ? `, margin ${r.margin.toFixed(1)} points` : ''}, ${Math.round(r.eevp)}% in${r.flipped ? ', flip' : ''}`;
}

interface MapProps {
  byKey: Map<string, HRace>;
  selected?: string | null;
  onSelect: (key: string) => void;
  dim?: (r: HRace | undefined, key: string) => boolean;
}

const keyFor = (st: string, d: number) => `${st}-${d === 0 ? 'AL' : pad(d)}`;

function Hatch({ id }: { id: string }) {
  return (
    <pattern id={id} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="5" height="5" fill="transparent" />
      <line x1="0" y1="0" x2="0" y2="5" stroke="rgba(5,7,13,.55)" strokeWidth="2" />
    </pattern>
  );
}

/* ═════════════ Hex cartogram ═════════════ */
const S = 20; // pitch
const R = S / Math.sqrt(3); // circumradius
const H = S * (Math.sqrt(3) / 2);
const center = (c: number, r: number): [number, number] => [c * S + (r & 1 ? S / 2 : 0) + S, r * H + R + 2];
const corner = (cx: number, cy: number, i: number): [number, number] => {
  const a = ((60 * i - 30) * Math.PI) / 180;
  return [cx + R * Math.cos(a), cy + R * Math.sin(a)];
};
const NB = (c: number, r: number, i: number): [number, number] => {
  const o = r & 1;
  return ([[c + 1, r], [c + o, r + 1], [c - 1 + o, r + 1], [c - 1, r], [c - 1 + o, r - 1], [c + o, r - 1]] as [number, number][])[i];
};

const HEX_GEOM = (() => {
  const at = new Map<string, string>();
  for (const [st, , c, r] of HOUSE_HEX) at.set(`${c},${r}`, st);
  const cells = HOUSE_HEX.map(([st, d, c, r]) => {
    const [cx, cy] = center(c, r);
    const pts = Array.from({ length: 6 }, (_, i) => corner(cx, cy, i).map((v) => v.toFixed(2)).join(',')).join(' ');
    return { key: keyFor(st, d), st, d, cx, cy, pts };
  });
  // state borders: hex edges whose neighbor is a different state (or empty)
  let border = '';
  for (const [st, , c, r] of HOUSE_HEX) {
    const [cx, cy] = center(c, r);
    for (let i = 0; i < 6; i++) {
      const [nc, nr] = NB(c, r, i);
      if (at.get(`${nc},${nr}`) === st) continue;
      const a = corner(cx, cy, i), b = corner(cx, cy, (i + 1) % 6);
      border += `M${a[0].toFixed(2)},${a[1].toFixed(2)}L${b[0].toFixed(2)},${b[1].toFixed(2)}`;
    }
  }
  // state label positions: blob centroid
  const sum = new Map<string, { x: number; y: number; n: number }>();
  for (const c of cells) {
    const s = sum.get(c.st) ?? { x: 0, y: 0, n: 0 };
    s.x += c.cx; s.y += c.cy; s.n++;
    sum.set(c.st, s);
  }
  const labels = [...sum].map(([st, s]) => ({ st, x: s.x / s.n, y: s.y / s.n, n: s.n }));
  const w = Math.max(...cells.map((c) => c.cx)) + S;
  const h = Math.max(...cells.map((c) => c.cy)) + R + 2;
  return { cells, border, labels, w, h };
})();

export const HouseHexMap = memo(function HouseHexMap({ byKey, selected, onSelect, dim }: MapProps) {
  const g = HEX_GEOM;
  const [hover, setHover] = useState<string | null>(null);
  const hr = hover ? byKey.get(hover) : undefined;
  return (
    <div className="hs-map">
      <svg viewBox={`0 0 ${g.w.toFixed(0)} ${g.h.toFixed(0)}`} role="group" aria-label="Hex cartogram of all 435 House districts, one hexagon per district, grouped by state">
        <defs><Hatch id="hs-hatch" /></defs>
        {g.cells.map((c) => {
          const r = byKey.get(c.key);
          const faded = dim?.(r, c.key);
          return (
            <g
              key={c.key}
              className={`hs-cell${selected === c.key ? ' is-sel' : ''}${faded ? ' is-dim' : ''}${r?.flipped ? ' is-flip' : ''}`}
              tabIndex={0}
              role="button"
              aria-label={`${r?.label ?? c.key}: ${describeRace(r)}`}
              onClick={() => onSelect(c.key)}
              onKeyDown={(e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(c.key); } }}
              onPointerEnter={() => setHover(c.key)}
              onPointerLeave={() => setHover((h) => (h === c.key ? null : h))}
            >
              <polygon points={c.pts} fill={raceFill(r)} />
              {r && !r.called && <polygon points={c.pts} fill="url(#hs-hatch)" className="hs-hatch" />}
              {r?.flipped && <circle cx={c.cx} cy={c.cy} r={2.4} className="hs-flipdot" />}
            </g>
          );
        })}
        <path d={g.border} className="hs-border" />
        {g.labels.map((l) => (
          <text key={l.st} x={l.x} y={l.y + 3} className={`hs-lbl${l.n < 3 ? ' is-sm' : ''}`} aria-hidden="true">{l.st}</text>
        ))}
      </svg>
      <MapTip r={hr} />
    </div>
  );
});

function MapTip({ r }: { r?: HRace }) {
  if (!r) return null;
  const lead = r.winner ?? r.leader;
  return (
    <div className="hs-tip" aria-hidden="true">
      <b>{r.label}</b>
      <span>{lead ? `${lead.name} (${lead.party}) ${r.called ? '✓ won' : 'leads'}${r.uncontested ? ' · unopposed' : ` +${r.margin.toFixed(1)}`}` : 'No votes yet'}</span>
      <span>{Math.round(r.eevp)}% in{r.flipped ? ` · FLIP ${r.before}→${r.winner?.party}` : ''}</span>
    </div>
  );
}

/* ═════════════ Real district boundaries ═════════════ */
type DistFeature = Feature<Geometry, { st: string; cd: string }>;
let geoCache: Promise<FeatureCollection<Geometry, { st: string; cd: string }>> | null = null;
const loadGeo = () => (geoCache ??= fetch('/geo/house-cd119.json').then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }));

const GW = 975, GH = 610;

export const HouseGeoMap = memo(function HouseGeoMap({ byKey, selected, onSelect, dim, focusState }: MapProps & { focusState?: string }) {
  const [fc, setFc] = useState<FeatureCollection<Geometry, { st: string; cd: string }> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  useEffect(() => { loadGeo().then(setFc, (e) => setErr(String(e?.message ?? e))); }, []);

  const shapes = useMemo(() => {
    if (!fc) return null;
    const feats: (DistFeature & { key: string; st: string })[] = [];
    for (const f of fc.features) {
      const st = stateByFips.get(f.properties.st)?.abbr;
      if (!st) continue;
      feats.push({ ...f, key: keyFor(st, Number(f.properties.cd) || 0), st });
    }
    const proj = geoAlbersUsa();
    const focus = focusState ? feats.filter((f) => f.st === focusState) : [];
    if (focus.length) proj.fitExtent([[16, 16], [GW - 16, GH - 16]], { type: 'FeatureCollection', features: focus } as FeatureCollection);
    else proj.fitExtent([[8, 8], [GW - 8, GH - 8]], { type: 'FeatureCollection', features: feats } as FeatureCollection);
    const path = geoPath(proj);
    return feats
      .filter((f) => !focus.length || f.st === focusState)
      .map((f) => ({ key: f.key, st: f.st, d: path(f) ?? '' }))
      .filter((s) => s.d);
  }, [fc, focusState]);

  if (err) return <p className="hs-empty">District boundaries could not be loaded ({err}). Use the hex view.</p>;
  if (!shapes) return <div className="hs-map hs-map--load" aria-busy="true">Loading district boundaries…</div>;
  const hr = hover ? byKey.get(hover) : undefined;
  return (
    <div className="hs-map">
      <svg viewBox={`0 0 ${GW} ${GH}`} role="group" aria-label={`Congressional district map${focusState ? ` of ${focusState}` : ''}`}>
        <defs><Hatch id="hs-hatch-g" /></defs>
        {shapes.map((s) => {
          const r = byKey.get(s.key);
          return (
            <g
              key={s.key}
              className={`hs-cell hs-cell--geo${selected === s.key ? ' is-sel' : ''}${dim?.(r, s.key) ? ' is-dim' : ''}`}
              tabIndex={focusState ? 0 : -1}
              role="button"
              aria-label={`${r?.label ?? s.key}: ${describeRace(r)}`}
              onClick={() => onSelect(s.key)}
              onKeyDown={(e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(s.key); } }}
              onPointerEnter={() => setHover(s.key)}
              onPointerLeave={() => setHover((h) => (h === s.key ? null : h))}
            >
              <path d={s.d} fill={raceFill(r)} />
              {r && !r.called && <path d={s.d} fill="url(#hs-hatch-g)" className="hs-hatch" />}
            </g>
          );
        })}
      </svg>
      <MapTip r={hr} />
    </div>
  );
});
