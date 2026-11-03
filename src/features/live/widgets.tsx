/**
 * Local live-page primitives (number roller, control needle, balance bar, sparkline, status chip).
 * Kept inside src/features/live so we don't depend on in-flight design-system components.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { arc as d3arc, line as d3line, curveMonotoneX } from 'd3-shape';
import type { Party } from '../../types';
import { PARTY_HEX } from '../../lib/format';
import type { RaceView } from './model';
import { zoneLabel } from './model';

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------------------
// AnimNum — tweens to new values (direct DOM writes, no re-render) and flashes.

export function AnimNum({
  value,
  format = (n) => Math.round(n).toLocaleString('en-US'),
  className,
  flash = true,
  duration = 650,
}: {
  value: number;
  format?: (n: number) => string;
  className?: string;
  flash?: boolean;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(value);
  const fmt = useRef(format);
  fmt.current = format;
  useEffect(() => {
    const el = ref.current;
    const v = isFinite(value) ? value : 0;
    if (!el) return;
    const from = shown.current;
    if (from === v) {
      el.textContent = fmt.current(v);
      return;
    }
    if (flash) {
      el.classList.remove('lv-flash-up', 'lv-flash-down');
      void el.offsetWidth; // restart animation
      el.classList.add(v > from ? 'lv-flash-up' : 'lv-flash-down');
    }
    if (prefersReducedMotion() || duration <= 0) {
      shown.current = v;
      el.textContent = fmt.current(v);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / duration);
      const e = 1 - Math.pow(1 - k, 3);
      const cur = from + (v - from) * e;
      shown.current = cur;
      el.textContent = fmt.current(cur);
      if (k < 1) raf = requestAnimationFrame(step);
      else shown.current = v;
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      shown.current = v;
    };
  }, [value, flash, duration]);
  return (
    <span ref={ref} className={`lv-num ${className ?? ''}`}>
      {format(isFinite(value) ? value : 0)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// ControlNeedle — NYT-style semicircle gauge with a jittering uncertainty band.

const W = 300;
const H = 172;
const CX = W / 2;
const CY = 150;
const R_OUT = 132;
const R_IN = 92;
const deg = (pR: number) => -90 + pR * 180; // pR=0 → far left (D)
const rad = (d: number) => (d * Math.PI) / 180;

const BANDS: { from: number; to: number; color: string }[] = [
  { from: 0, to: 0.05, color: '#1f5eff' },
  { from: 0.05, to: 0.25, color: '#3d7bff' },
  { from: 0.25, to: 0.4, color: '#7ea4ff' },
  { from: 0.4, to: 0.6, color: '#6f7488' },
  { from: 0.6, to: 0.75, color: '#ff8c9b' },
  { from: 0.75, to: 0.95, color: '#ff3d55' },
  { from: 0.95, to: 1, color: '#e01e3c' },
];

export function ControlNeedle({
  probD,
  uncertainty,
  label,
  ready,
}: {
  /** chance D side wins control 0..1 */
  probD: number;
  /** 0..1, how much is still unknown (drives band width + jitter) */
  uncertainty: number;
  label: string;
  ready: boolean;
}) {
  const pR = Math.min(1, Math.max(0, 1 - (isFinite(probD) ? probD : 0.5)));
  const spread = ready ? Math.min(0.3, (0.03 + 0.27 * uncertainty) * Math.sqrt(Math.max(0.04, 4 * pR * (1 - pR)))) : 0.3;
  const lo = Math.max(0, pR - spread);
  const hi = Math.min(1, pR + spread);
  const needleRef = useRef<SVGGElement>(null);
  const cur = useRef(deg(0.5));

  useEffect(() => {
    const reduced = prefersReducedMotion();
    let raf = 0;
    let target = deg(pR);
    let nextJitter = 0;
    const tick = (t: number) => {
      if (!reduced && ready && t > nextJitter) {
        // random point inside band, biased toward center
        const r = (Math.random() + Math.random() + Math.random()) / 3 - 0.5;
        target = deg(Math.min(1, Math.max(0, pR + r * 2 * spread * 0.9)));
        nextJitter = t + 140 + Math.random() * 260;
      } else if (reduced || !ready) target = deg(pR);
      const k = reduced ? 1 : 0.12;
      cur.current += (target - cur.current) * k;
      needleRef.current?.setAttribute('transform', `rotate(${cur.current.toFixed(2)} ${CX} ${CY})`);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [pR, spread, ready]);

  const arcGen = useMemo(() => d3arc<{ a0: number; a1: number; r0: number; r1: number }>()
    .startAngle((d) => d.a0)
    .endAngle((d) => d.a1)
    .innerRadius((d) => d.r0)
    .outerRadius((d) => d.r1), []);

  const z = zoneLabel(1 - pR);
  const lead: Party | null = pR < 0.5 ? 'D' : pR > 0.5 ? 'R' : null;
  const pct = Math.round(Math.max(pR, 1 - pR) * 100);

  const tick = (p: number, text: string, anchor: 'start' | 'middle' | 'end') => {
    const a = rad(deg(p) - 90);
    const r = R_OUT + 12;
    return (
      <text x={CX + Math.cos(a) * r} y={CY + Math.sin(a) * r} textAnchor={anchor} className="lv-needle-tick">
        {text}
      </text>
    );
  };

  return (
    <figure className="lv-needle" aria-label={`${label}: ${ready ? `${z.text}, ${lead ?? 'even'} ${pct}% chance of control` : 'awaiting results'}`}>
      <svg viewBox={`-26 -6 ${W + 52} ${H + 2}`} role="img" aria-hidden>
        <g transform={`translate(${CX} ${CY})`}>
          {BANDS.map((b) => (
            <path
              key={b.from}
              d={arcGen({ a0: rad(deg(b.from)), a1: rad(deg(b.to)), r0: R_IN, r1: R_OUT }) ?? ''}
              fill={b.color}
              opacity={ready ? 0.28 : 0.12}
            />
          ))}
          {ready && (
            <path
              className="lv-needle-band"
              d={arcGen({ a0: rad(deg(lo)), a1: rad(deg(hi)), r0: R_IN - 4, r1: R_OUT + 4 }) ?? ''}
              fill={lead ? PARTY_HEX[lead] : '#c9cfe0'}
            />
          )}
          {[0.25, 0.5, 0.75].map((p) => {
            const a = rad(deg(p) - 90);
            return (
              <line key={p} x1={Math.cos(a) * (R_IN - 2)} y1={Math.sin(a) * (R_IN - 2)} x2={Math.cos(a) * (R_OUT + 3)} y2={Math.sin(a) * (R_OUT + 3)} className="lv-needle-gridline" />
            );
          })}
        </g>
        {tick(0.06, 'Likely D', 'end')}
        {tick(0.5, 'Toss-up', 'middle')}
        {tick(0.94, 'Likely R', 'start')}
        <g ref={needleRef} transform={`rotate(0 ${CX} ${CY})`} className={ready ? '' : 'is-idle'}>
          <path d={`M ${CX - 4} ${CY} L ${CX} ${CY - R_OUT + 6} L ${CX + 4} ${CY} Z`} className="lv-needle-hand" />
        </g>
        <circle cx={CX} cy={CY} r={9} className="lv-needle-hub" />
      </svg>
      <figcaption>
        {ready ? (
          <>
            <span className="lv-needle-zone" style={{ color: z.party ? PARTY_HEX[z.party] : 'var(--tossup)' }}>
              {z.text}
            </span>
            <span className="lv-needle-pct mono">
              {lead ? <b style={{ color: PARTY_HEX[lead] }}>{lead === 'D' ? 'DEM' : 'GOP'}</b> : <b>EVEN</b>}{' '}
              <AnimNum value={pct} format={(n) => `${Math.round(n)}%`} />
            </span>
          </>
        ) : (
          <span className="lv-skel lv-skel-line" style={{ width: 120 }} />
        )}
      </figcaption>
    </figure>
  );
}

// ---------------------------------------------------------------------------
// Balance-of-power bar with majority line, won (solid) + projected (hatched)

export function BalanceBar({
  dWon,
  rWon,
  dProj,
  rProj,
  total,
  majority,
  ready,
  label,
}: {
  dWon: number;
  rWon: number;
  dProj: number;
  rProj: number;
  total: number;
  majority: number;
  ready: boolean;
  label: string;
}) {
  const pc = (n: number) => `${(Math.max(0, n) / Math.max(1, total)) * 100}%`;
  const dP = Math.max(0, Math.min(dProj, total - rWon) - dWon);
  const rP = Math.max(0, Math.min(rProj, total - dWon - dP) - rWon);
  return (
    <div className="lv-bop" role="img" aria-label={`${label}: Democrats ${dWon} won, ${dProj} projected; Republicans ${rWon} won, ${rProj} projected; ${majority} for majority of ${total}.`}>
      <div className={`lv-bop-track ${ready ? '' : 'is-loading'}`}>
        <div className="lv-bop-seg d won" style={{ width: pc(dWon) }} />
        <div className="lv-bop-seg d proj" style={{ width: pc(dP) }} />
        <div className="lv-bop-gap" />
        <div className="lv-bop-seg r proj" style={{ width: pc(rP) }} />
        <div className="lv-bop-seg r won" style={{ width: pc(rWon) }} />
        <div className="lv-bop-maj" style={{ left: pc(majority) }}>
          <span className="mono">{majority}</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function Sparkline({ data, width = 120, height = 32, color = '#c6ff3d' }: { data: number[]; width?: number; height?: number; color?: string }) {
  if (data.length < 2) return <svg width={width} height={height} className="lv-spark" aria-hidden />;
  const min = Math.min(...data, 0.4);
  const max = Math.max(...data, 0.6);
  const x = (i: number) => (i / (data.length - 1)) * (width - 4) + 2;
  const y = (v: number) => height - 3 - ((v - min) / Math.max(1e-6, max - min)) * (height - 6);
  const d = d3line<number>().x((_, i) => x(i)).y(y).curve(curveMonotoneX)(data) ?? '';
  const last = data[data.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="lv-spark" aria-hidden>
      <line x1={0} x2={width} y1={y(0.5)} y2={y(0.5)} className="lv-spark-mid" />
      <path d={`${d} L ${x(data.length - 1)} ${height} L ${x(0)} ${height} Z`} fill={color} opacity={0.1} />
      <path d={d} fill="none" stroke={color} strokeWidth={1.6} />
      <circle cx={x(data.length - 1)} cy={y(last)} r={2.6} fill={color} />
    </svg>
  );
}

// ---------------------------------------------------------------------------

export function StatusChip({ v }: { v: RaceView }) {
  if (v.winner) {
    const p = v.winner.party;
    return (
      <span className="lv-chip is-called" style={{ ['--pc' as string]: PARTY_HEX[p] }}>
        <span aria-hidden>✓</span> {p} WIN
        {v.flip && <span className="lv-gain">{(p === 'I' ? 'D' : p)} GAIN</span>}
      </span>
    );
  }
  switch (v.status) {
    case 'too-close':
      return <span className="lv-chip is-close">Too close</span>;
    case 'counting':
      return <span className="lv-chip is-counting"><i className="lv-pulse" aria-hidden /> Counting</span>;
    case 'polls-closed':
      return <span className="lv-chip is-closed">Polls closed</span>;
    default:
      return <span className="lv-chip">Not started</span>;
  }
}

/** Re-render every `ms` (for clocks / "x ago"). */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}
