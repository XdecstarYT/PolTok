import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { geoAlbersUsa, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { fmtTime } from '../../components';
import { fmtInt } from '../../lib/format';
import { fmtSigned, type CountyRow } from './nyt';

/* ───────── Time series with a cursor ───────── */

export interface Series { key: string; label: string; color: string; pts: { t: number; v: number }[]; dash?: string }

/** Small multi-line chart over time with a vertical cursor at `cursor` and an optional reference line. */
export function TimeChart({
  series, t0, t1, cursor, yMin, yMax, refY, refLabel, fmtY = (v) => String(Math.round(v)), height = 180, label, onSeek,
}: {
  series: Series[]; t0: number; t1: number; cursor?: number; yMin: number; yMax: number; refY?: number; refLabel?: string;
  fmtY?: (v: number) => string; height?: number; label: string; onSeek?: (t: number) => void;
}) {
  const W = 600, H = height, L = 36, R = 10, T = 10, B = 22;
  const x = (t: number) => L + ((t - t0) / Math.max(1, t1 - t0)) * (W - L - R);
  const y = (v: number) => T + (1 - (v - yMin) / Math.max(1e-9, yMax - yMin)) * (H - T - B);
  const [hover, setHover] = useState<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const tAt = (clientX: number) => {
    const r = svg.current!.getBoundingClientRect();
    const px = ((clientX - r.left) / r.width) * W;
    return t0 + Math.max(0, Math.min(1, (px - L) / (W - L - R))) * (t1 - t0);
  };
  const ticks = useMemo(() => {
    const out: number[] = [];
    const step = 3600e3 * Math.max(1, Math.ceil((t1 - t0) / 3600e3 / 6));
    for (let t = Math.ceil(t0 / 3600e3) * 3600e3; t <= t1; t += step) out.push(t);
    return out;
  }, [t0, t1]);
  const yt = [yMin, (yMin + yMax) / 2, yMax];
  const ht = hover ?? null;
  const valAt = (s: Series, t: number) => {
    let v: number | undefined;
    for (const p of s.pts) if (p.t <= t) v = p.v; else break;
    return v;
  };
  return (
    <div className="an-tc">
      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={label}
        onPointerMove={(e) => setHover(tAt(e.clientX))}
        onPointerLeave={() => setHover(null)}
        onClick={(e) => onSeek?.(tAt(e.clientX))}
        style={{ cursor: onSeek ? 'pointer' : undefined }}
      >
        {yt.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--line)" />
            <text x={L - 6} y={y(v) + 3} textAnchor="end" className="an-ax">{fmtY(v)}</text>
          </g>
        ))}
        {ticks.map((t) => (
          <text key={t} x={x(t)} y={H - 6} textAnchor="middle" className="an-ax">{fmtTime(t).replace(':00', '')}</text>
        ))}
        {refY != null && (
          <g>
            <line x1={L} x2={W - R} y1={y(refY)} y2={y(refY)} stroke="var(--text-3)" strokeDasharray="3 3" />
            {refLabel && <text x={W - R} y={y(refY) - 4} textAnchor="end" className="an-ax">{refLabel}</text>}
          </g>
        )}
        {series.map((s) => (
          <path
            key={s.key}
            d={s.pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join('')}
            fill="none" stroke={s.color} strokeWidth={2} strokeDasharray={s.dash} strokeLinejoin="round"
          />
        ))}
        {cursor != null && cursor >= t0 && <line x1={x(cursor)} x2={x(cursor)} y1={T} y2={H - B} stroke="var(--accent)" strokeWidth={1.5} />}
        {ht != null && <line x1={x(ht)} x2={x(ht)} y1={T} y2={H - B} stroke="var(--text-3)" strokeWidth={1} />}
      </svg>
      <div className="an-tc__legend">
        {series.map((s) => {
          const v = valAt(s, ht ?? cursor ?? t1);
          return (
            <span key={s.key}>
              <i style={{ background: s.color }} /> {s.label} <b className="num">{v == null ? '—' : fmtY(v)}</b>
            </span>
          );
        })}
        {ht != null && <span className="faint num">{fmtTime(ht)}</span>}
      </div>
    </div>
  );
}

/* ───────── Scatter: 2024 pres margin vs 2026 margin ───────── */

export interface ScatterPt { id: string; label: string; x: number; y: number; color: string; shape: 'circle' | 'square' }

export function Scatter({ pts, xLabel, yLabel, onPick, tip }: { pts: ScatterPt[]; xLabel: string; yLabel: string; onPick?: (id: string) => void; tip?: (p: ScatterPt) => ReactNode }) {
  const W = 520, H = 400, L = 44, R = 12, T = 12, B = 38;
  const ext = Math.max(20, ...pts.map((p) => Math.max(Math.abs(p.x), Math.abs(p.y)))) * 1.05;
  const lim = Math.ceil(ext / 10) * 10;
  const x = (v: number) => L + ((v + lim) / (2 * lim)) * (W - L - R);
  const y = (v: number) => T + (1 - (v + lim) / (2 * lim)) * (H - T - B);
  const [hov, setHov] = useState<ScatterPt | null>(null);
  const ticks = [-lim, -lim / 2, 0, lim / 2, lim];
  return (
    <div className="an-scatter">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${yLabel} versus ${xLabel}, ${pts.length} races`} onPointerLeave={() => setHov(null)}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={x(v)} x2={x(v)} y1={T} y2={H - B} stroke={v === 0 ? 'var(--line-3)' : 'var(--line)'} />
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={v === 0 ? 'var(--line-3)' : 'var(--line)'} />
            <text x={x(v)} y={H - B + 14} textAnchor="middle" className="an-ax">{v === 0 ? '0' : fmtSigned(v, 0)}</text>
            <text x={L - 6} y={y(v) + 3} textAnchor="end" className="an-ax">{v === 0 ? '0' : fmtSigned(v, 0)}</text>
          </g>
        ))}
        <line x1={x(-lim)} y1={y(-lim)} x2={x(lim)} y2={y(lim)} stroke="var(--text-3)" strokeDasharray="4 4" />
        <text x={x(lim) - 4} y={y(lim) + 14} textAnchor="end" className="an-ax">no swing</text>
        <text x={(L + W - R) / 2} y={H - 4} textAnchor="middle" className="an-ax an-ax--t">{xLabel}</text>
        <text transform={`translate(11 ${(T + H - B) / 2}) rotate(-90)`} textAnchor="middle" className="an-ax an-ax--t">{yLabel}</text>
        {pts.map((p) => {
          const props = {
            key: p.id, fill: p.color, stroke: 'var(--bg-1)', strokeWidth: 2, tabIndex: 0, role: 'button' as const,
            'aria-label': `${p.label}: 2024 ${fmtSigned(p.x)}, 2026 ${fmtSigned(p.y)}`,
            onPointerEnter: () => setHov(p), onFocus: () => setHov(p), onClick: () => onPick?.(p.id),
            style: { cursor: onPick ? 'pointer' : undefined },
          };
          return p.shape === 'square' ? <rect {...props} x={x(p.x) - 5} y={y(p.y) - 5} width={10} height={10} rx={2} /> : <circle {...props} cx={x(p.x)} cy={y(p.y)} r={6} />;
        })}
      </svg>
      {hov && (
        <div className="an-tip" style={{ left: `${(x(hov.x) / W) * 100}%`, top: `${(y(hov.y) / H) * 100}%` }}>
          {tip ? tip(hov) : <b>{hov.label}</b>}
        </div>
      )}
    </div>
  );
}

/* ───────── County shift arrows ───────── */

let topoP: Promise<Topology<{ counties: GeometryCollection }>> | null = null;
const loadTopo = () => (topoP ??= import('us-atlas/counties-10m.json').then((m) => (m.default ?? m) as unknown as Topology<{ counties: GeometryCollection }>));

/**
 * County map with an arrow per county: direction & length = shift in margin vs the 2024
 * presidential result (left/blue = toward Democrats, right/red = toward Republicans).
 * Without a 2024 baseline, counties are shaded by their 2026 margin only.
 */
export function ShiftMap({ stateFips, counties, stateName }: { stateFips: string; counties: CountyRow[]; stateName: string }) {
  const W = 640, H = 420;
  const [shapes, setShapes] = useState<{ fips: string; d: string; c: [number, number] }[] | null>(null);
  const [hov, setHov] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    loadTopo().then((topo) => {
      const fc = feature(topo, topo.objects.counties) as FeatureCollection<Geometry>;
      const mine = fc.features.filter((f) => String(f.id).slice(0, 2) === stateFips);
      const coll: FeatureCollection = { type: 'FeatureCollection', features: mine as Feature[] };
      const path = geoPath(geoAlbersUsa().fitExtent([[8, 8], [W - 8, H - 8]], coll));
      if (alive) setShapes(mine.map((f) => ({ fips: String(f.id), d: path(f as Feature) ?? '', c: path.centroid(f as Feature) as [number, number] })));
    });
    return () => {
      alive = false;
    };
  }, [stateFips]);
  const by = useMemo(() => new Map(counties.map((c) => [c.fips, c])), [counties]);
  const hasBase = counties.some((c) => c.pres24 != null);
  const shade = (m?: number) => {
    if (m == null) return 'var(--bg-3)';
    const a = Math.min(1, 0.2 + Math.abs(m) / 60);
    return m >= 0 ? `color-mix(in srgb, var(--dem) ${a * 100}%, var(--bg-2))` : `color-mix(in srgb, var(--rep) ${a * 100}%, var(--bg-2))`;
  };
  const maxVotes = Math.max(1, ...counties.map((c) => c.votes));
  const hc = hov ? by.get(hov) : undefined;
  if (!shapes) return <div className="skeleton" style={{ aspectRatio: `${W}/${H}`, borderRadius: 12 }} />;
  return (
    <div className="an-shift">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${stateName}: county ${hasBase ? 'shift versus 2024 presidential margin' : '2026 margin'}`} onPointerLeave={() => setHov(null)}>
        <defs>
          {(['d', 'r'] as const).map((k) => (
            <marker key={k} id={`an-ah-${k}`} viewBox="0 0 6 6" refX="5" refY="3" markerWidth="4" markerHeight="4" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill={k === 'd' ? 'var(--dem-glow)' : 'var(--rep-glow)'} />
            </marker>
          ))}
        </defs>
        {shapes.map((s) => {
          const c = by.get(s.fips);
          return (
            <path key={s.fips} d={s.d} fill={hasBase ? 'var(--bg-2)' : shade(c?.margin)} stroke={hov === s.fips ? 'var(--text)' : 'var(--line-2)'} strokeWidth={hov === s.fips ? 1.5 : 0.5}
              onPointerEnter={() => setHov(s.fips)} />
          );
        })}
        {hasBase &&
          shapes.map((s) => {
            const c = by.get(s.fips);
            if (!c || c.margin == null || c.pres24 == null || c.eevp < 50) return null;
            const sh = c.margin - c.pres24;
            const len = Math.min(60, Math.abs(sh) * 1.6) * (0.6 + 0.4 * Math.sqrt(c.votes / maxVotes));
            if (len < 1) return null;
            const dx = (sh > 0 ? -1 : 1) * len * 0.87, dy = -len * 0.5;
            return (
              <line key={`a${s.fips}`} x1={s.c[0]} y1={s.c[1]} x2={s.c[0] + dx} y2={s.c[1] + dy} stroke={sh > 0 ? 'var(--dem-glow)' : 'var(--rep-glow)'} strokeWidth={1.6}
                markerEnd={`url(#an-ah-${sh > 0 ? 'd' : 'r'})`} pointerEvents="none" />
            );
          })}
      </svg>
      <div className="an-shift__foot">
        {hc ? (
          <span>
            <b>{hc.name}</b> · 2026 {hc.margin != null ? fmtSigned(hc.margin) : '—'}
            {hc.pres24 != null && <> · 2024 pres {fmtSigned(hc.pres24)} · shift <b>{hc.margin != null ? fmtSigned(hc.margin - hc.pres24) : '—'}</b></>} · {fmtInt(hc.votes)} votes ({Math.round(hc.eevp)}% in)
          </span>
        ) : (
          <span className="faint">
            {hasBase ? 'Arrows: shift in D−R margin vs the 2024 presidential race (← toward Dem, → toward Rep; longer = bigger shift, scaled by county size). Counties under 50% reported are omitted.' : 'No 2024 baseline in this file — shaded by 2026 margin only.'} Hover a county.
          </span>
        )}
      </div>
    </div>
  );
}
