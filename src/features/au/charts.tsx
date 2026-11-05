/** Small SVG/CSS charts for the AU section (no chart library). */
import type { ReactNode } from 'react';
import { party, pColor } from './model';

/** Horizontal vote-share bars. */
export function VoteBars({ rows, max, unit = '%' }: { rows: { label: ReactNode; p: string; pct: number; sub?: ReactNode; el?: boolean }[]; max?: number; unit?: string }) {
  const m = max ?? Math.max(10, ...rows.map((r) => r.pct));
  return (
    <ul className="au-vbars">
      {rows.map((r, i) => (
        <li key={i}>
          <div className="au-vbars-l">
            <span className="au-vbars-n">{r.label}{r.el && <em className="mono"> ELECTED</em>}</span>
            <span className="mono muted">{party(r.p).short}{r.sub ? <> · {r.sub}</> : null}</span>
            <b className="num">{r.pct.toFixed(1)}{unit}</b>
          </div>
          <div className="au-vbars-t" role="img" aria-label={`${party(r.p).name} ${r.pct.toFixed(1)}${unit}`}>
            <span style={{ width: `${Math.min(100, (r.pct / m) * 100)}%`, background: pColor(r.p) }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Two-sided split bar (two-candidate-preferred). */
export function SplitBar({ a, b }: { a: { label: string; p: string; pct: number }; b: { label: string; p: string; pct: number } }) {
  return (
    <div className="au-split">
      <div className="au-split-h mono">
        <span style={{ color: pColor(a.p) }}>{a.label} {a.pct.toFixed(1)}%</span>
        <span style={{ color: pColor(b.p) }}>{b.pct.toFixed(1)}% {b.label}</span>
      </div>
      <div className="au-split-bar" role="img" aria-label={`${a.label} ${a.pct.toFixed(1)}%, ${b.label} ${b.pct.toFixed(1)}%`}>
        <span style={{ width: `${a.pct}%`, background: pColor(a.p) }} />
        <span style={{ width: `${b.pct}%`, background: pColor(b.p) }} />
        <i aria-hidden />
      </div>
    </div>
  );
}

export interface LineSeries { key: string; label: string; color: string; pts: { x: number; y: number | null }[]; dots?: { x: number; y: number }[] }

/** Simple multi-series line chart with optional raw dots. x is numeric (timestamp or year). */
export function LineChart({ series, yMin, yMax, xFmt, yFmt = (v) => `${v}`, height = 220, refY, ariaLabel }: {
  series: LineSeries[]; yMin: number; yMax: number; xFmt: (x: number) => string; yFmt?: (v: number) => string; height?: number; refY?: number; ariaLabel: string;
}) {
  const W = 640, H = height, P = { l: 34, r: 84, t: 10, b: 24 };
  const xs = series.flatMap((s) => s.pts.map((p) => p.x));
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const X = (x: number) => P.l + ((x - x0) / Math.max(1e-9, x1 - x0)) * (W - P.l - P.r);
  const Y = (y: number) => P.t + (1 - (y - yMin) / (yMax - yMin)) * (H - P.t - P.b);
  const ticks = Array.from({ length: 5 }, (_, i) => yMin + ((yMax - yMin) * i) / 4);
  const xt = [...new Set(xs)].sort((a, b) => a - b);
  const xTicks = xt.length <= 12 ? xt : xt.filter((_, i) => i % Math.ceil(xt.length / 6) === 0);
  const ends = series.map((s) => { const last = [...s.pts].reverse().find((p) => p.y != null); return { s, y: last ? Y(last.y as number) : null, v: last?.y ?? null }; }).filter((e) => e.y != null).sort((a, b) => (a.y as number) - (b.y as number));
  for (let i = 1; i < ends.length; i++) if ((ends[i].y as number) - (ends[i - 1].y as number) < 13) ends[i].y = (ends[i - 1].y as number) + 13;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="au-line" role="img" aria-label={ariaLabel}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={P.l} x2={W - P.r} y1={Y(t)} y2={Y(t)} className="au-line-grid" />
          <text x={P.l - 6} y={Y(t) + 3} textAnchor="end" className="au-line-ax">{yFmt(Math.round(t * 10) / 10)}</text>
        </g>
      ))}
      {refY != null && <line x1={P.l} x2={W - P.r} y1={Y(refY)} y2={Y(refY)} className="au-line-ref" />}
      {xTicks.map((t) => <text key={t} x={X(t)} y={H - 6} textAnchor="middle" className="au-line-ax">{xFmt(t)}</text>)}
      {series.map((s) => {
        const segs: string[] = [];
        let cur = '';
        for (const p of s.pts) {
          if (p.y == null) { if (cur) segs.push(cur); cur = ''; continue; }
          cur += `${cur ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`;
        }
        if (cur) segs.push(cur);
        return (
          <g key={s.key}>
            {(s.dots ?? []).map((d, i) => <circle key={i} cx={X(d.x)} cy={Y(d.y)} r={2.6} fill={s.color} opacity={0.35} />)}
            {segs.map((d, i) => <path key={i} d={d} fill="none" stroke={s.color} strokeWidth={2.4} strokeLinejoin="round" />)}
            {s.pts.length === 1 && s.pts[0].y != null && <circle cx={X(s.pts[0].x)} cy={Y(s.pts[0].y)} r={3.5} fill={s.color} />}
          </g>
        );
      })}
      {ends.map((e) => (
        <text key={e.s.key} x={W - P.r + 6} y={(e.y as number) + 4} className="au-line-lab" fill={e.s.color}>{e.s.label} {yFmt(Math.round((e.v as number) * 10) / 10)}</text>
      ))}
    </svg>
  );
}

/** Stacked horizontal bar of seat counts (one row). */
export function SeatStack({ comp, total, majority }: { comp: [string, number][]; total: number; majority?: number }) {
  return (
    <div className="au-stack" role="img" aria-label={comp.map(([p, v]) => `${party(p).short} ${v}`).join(', ')}>
      {comp.map(([p, v]) => <span key={p} style={{ width: `${(v / total) * 100}%`, background: pColor(p) }} title={`${party(p).name} ${v}`} />)}
      {majority && <i style={{ left: `${(majority / total) * 100}%` }} aria-hidden />}
    </div>
  );
}

export const daysUntil = (d: string) => Math.ceil((Date.parse(d.length === 10 ? d + 'T00:00:00Z' : d) - Date.now()) / 864e5);
