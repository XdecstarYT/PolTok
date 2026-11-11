import { useMemo, useState, type PointerEvent } from 'react';
import { scaleBand, scaleLinear } from 'd3-scale';
import { m } from 'framer-motion';
import { PARTY_COLOR, PARTY_HEX, ink } from '../../lib/format';
import { useReducedMotion, useSize } from './hooks';

function domainOf(hist: number[], n: number, minSpan: number, must: number) {
  let lo = 0;
  let hi = hist.length - 1;
  if (n > 0) {
    let c = 0;
    for (let i = 0; i < hist.length; i++) {
      c += hist[i];
      if (c / n > 0.002) { lo = i; break; }
    }
    c = 0;
    for (let i = hist.length - 1; i >= 0; i--) {
      c += hist[i];
      if (c / n > 0.002) { hi = i; break; }
    }
  }
  lo = Math.min(lo, must - 1) - 1;
  hi = Math.max(hi, must) + 1;
  while (hi - lo < minSpan) { lo--; hi++; }
  return [Math.max(0, lo), Math.min(hist.length - 1, hi)] as const;
}

export function SeatHistogram({ hist, n, dNeeds, total, label, height = 230, minSpan = 14 }: { hist: number[]; n: number; dNeeds: number; total: number; label: string; height?: number; minSpan?: number }) {
  const [ref, { width }] = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const [lo, hi] = useMemo(() => domainOf(hist, n, minSpan, dNeeds), [hist, n, minSpan, dNeeds]);
  const M = { top: 22, right: 8, bottom: 34, left: 36 };
  const w = Math.max(260, width);
  const iw = w - M.left - M.right;
  const ih = height - M.top - M.bottom;
  const idx = useMemo(() => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i), [lo, hi]);
  const x = scaleBand<number>().domain(idx).range([0, iw]).paddingInner(idx.length > 40 ? 0.08 : 0.16);
  const maxP = Math.max(0.02, ...idx.map((i) => (n ? hist[i] / n : 0)));
  const y = scaleLinear().domain([0, maxP * 1.08]).nice().range([ih, 0]);
  const step = Math.max(1, Math.ceil(idx.length / Math.max(4, Math.floor(iw / 38))));
  const thrX = (x(dNeeds) ?? 0) - (x.step() * x.paddingInner()) / 2;

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left - M.left;
    const i = Math.floor(px / x.step());
    setHover(i >= 0 && i < idx.length ? idx[i] : null);
  };
  const hp = hover != null && n ? hist[hover] / n : 0;
  const pos = hover != null ? M.left + (x(hover) ?? 0) + x.bandwidth() / 2 : 0;

  return (
    <div ref={ref} className="fc-hist" style={{ height }}>
      {width > 0 && (
        <svg width={w} height={height} onPointerMove={onMove} onPointerLeave={() => setHover(null)} role="img" aria-label={`Histogram of simulated outcomes by ${label}. Control threshold ${dNeeds}.`}>
          <g transform={`translate(${M.left},${M.top})`}>
            {y.ticks(4).map((t) => (
              <g key={t} transform={`translate(0,${y(t)})`}>
                <line x2={iw} className="pc-grid" />
                <text x={-6} dy="0.32em" textAnchor="end" className="pc-tick">{Math.round(t * 100)}%</text>
              </g>
            ))}
            {idx.map((i) => {
              const p = n ? hist[i] / n : 0;
              const d = i >= dNeeds;
              return (
                <rect
                  key={i}
                  className="fc-bar"
                  x={x(i)}
                  width={x.bandwidth()}
                  y={y(p)}
                  height={Math.max(0, ih - y(p))}
                  rx={Math.min(2, x.bandwidth() / 3)}
                  style={{ fill: d ? PARTY_HEX.D : PARTY_HEX.R, opacity: hover == null || hover === i ? 0.95 : 0.45 }}
                />
              );
            })}
            {idx.filter((_, k) => k % step === 0).map((i) => (
              <text key={i} x={(x(i) ?? 0) + x.bandwidth() / 2} y={ih + 15} textAnchor="middle" className="pc-tick">{i}</text>
            ))}
            <text x={iw / 2} y={ih + 30} textAnchor="middle" className="pc-tick fc-axis-label">{label} →</text>
            <line x1={thrX} x2={thrX} y1={-14} y2={ih} className="fc-thr" />
            <text x={thrX + 5} y={-6} className="pc-tick fc-thr-l">D CONTROL ≥ {dNeeds}</text>
            <text x={thrX - 5} y={-6} textAnchor="end" className="pc-tick fc-thr-l">R CONTROL</text>
          </g>
        </svg>
      )}
      {hover != null && (
        <div className="pc-tip fc-hist-tip" style={{ left: pos, transform: `translateX(${pos > w * 0.6 ? 'calc(-100% - 10px)' : '10px'})` }}>
          <div className="pc-tip-row"><span className="pc-sw" style={{ background: PARTY_HEX.D }} /><span>Dem</span><span className="mono">{hover}</span></div>
          <div className="pc-tip-row"><span className="pc-sw" style={{ background: PARTY_HEX.R }} /><span>Rep</span><span className="mono">{total - hover}</span></div>
          <div className="pc-tip-margin mono">{(hp * 100).toFixed(1)}% of sims</div>
        </div>
      )}
    </div>
  );
}

/** "50 outcomes": each dot is one simulated election, stacked by Dem seat count. */
export function OutcomeDots({ samples, dNeeds, runKey, minSpan = 14 }: { samples: number[]; dNeeds: number; runKey: string; minSpan?: number }) {
  const [ref, { width }] = useSize<HTMLDivElement>();
  const reduced = useReducedMotion();
  const s = samples.slice(0, 50);
  const lo0 = Math.min(dNeeds - 1, ...s);
  const hi0 = Math.max(dNeeds, ...s);
  let lo = lo0 - 1;
  let hi = hi0 + 1;
  while (hi - lo < minSpan) { lo--; hi++; }
  const w = Math.max(260, width);
  const M = { l: 12, r: 12 };
  const x = scaleLinear().domain([lo - 0.5, hi + 0.5]).range([M.l, w - M.r]);
  const colW = x(1) - x(0);
  const r = Math.max(2.4, Math.min(6, colW / 2 - 1));
  const counts = new Map<number, number>();
  const dots = s.map((v, i) => {
    const k = counts.get(v) ?? 0;
    counts.set(v, k + 1);
    return { v, k, i };
  });
  const maxStack = Math.max(1, ...counts.values());
  const h = Math.max(70, maxStack * (r * 2 + 2) + 30);
  const thrX = x(dNeeds - 0.5);
  const dWins = s.filter((v) => v >= dNeeds).length;
  return (
    <div ref={ref} className="fc-dots">
      <div className="fc-dots-cap">
        <span><b className="mono" style={{ color: ink(PARTY_COLOR.D) }}>{dWins}</b> of {s.length} → D control</span>
        <span><b className="mono" style={{ color: ink(PARTY_COLOR.R) }}>{s.length - dWins}</b> → R control</span>
      </div>
      {width > 0 && (
        <svg width={w} height={h} role="img" aria-label={`${s.length} simulated outcomes: Democrats win control in ${dWins}.`}>
          <line x1={thrX} x2={thrX} y1={4} y2={h - 18} className="fc-thr" />
          {dots.map((d) => (
            <m.circle
              key={`${runKey}-${d.i}`}
              cx={x(d.v)}
              cy={h - 24 - r - d.k * (r * 2 + 2)}
              r={r}
              initial={reduced ? false : { opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: reduced ? 0 : d.i * 0.018, type: 'spring', stiffness: 400, damping: 22 }}
              style={{ fill: d.v >= dNeeds ? PARTY_HEX.D : PARTY_HEX.R, transformOrigin: `${x(d.v)}px ${h - 24 - r - d.k * (r * 2 + 2)}px` }}
            />
          ))}
          {Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
            .filter((v) => v % (colW < 18 ? 5 : colW < 30 ? 2 : 1) === 0)
            .map((v) => (
              <text key={v} x={x(v)} y={h - 4} textAnchor="middle" className="pc-tick">{v}</text>
            ))}
        </svg>
      )}
    </div>
  );
}

/** Tug-of-war control bar. */
export function ControlBar({ pD, dLabel = 'Democrats', rLabel = 'Republicans' }: { pD: number; dLabel?: string; rLabel?: string }) {
  const d = Math.round(pD * 1000) / 10;
  const r = Math.round((1 - pD) * 1000) / 10;
  return (
    <div className="fc-ctl">
      <div className="fc-ctl-nums">
        <div className={pD >= 0.5 ? 'lead' : ''}>
          <span className="fc-ctl-lab" style={{ color: ink(PARTY_COLOR.D) }}>{dLabel}</span>
          <span className="mono fc-ctl-pct" style={{ color: ink(PARTY_COLOR.D) }}>{fmtP(pD)}</span>
        </div>
        <div className={`right ${pD < 0.5 ? 'lead' : ''}`}>
          <span className="fc-ctl-lab" style={{ color: ink(PARTY_COLOR.R) }}>{rLabel}</span>
          <span className="mono fc-ctl-pct" style={{ color: ink(PARTY_COLOR.R) }}>{fmtP(1 - pD)}</span>
        </div>
      </div>
      <div className="fc-ctl-bar" role="img" aria-label={`Democrats ${d}%, Republicans ${r}% chance of control`}>
        <div className="d" style={{ width: `${pD * 100}%` }} />
        <div className="r" style={{ width: `${(1 - pD) * 100}%` }} />
        <span className="mid" />
      </div>
    </div>
  );
}

export const fmtP = (p: number) => {
  const v = p * 100;
  if (v > 99 && v < 100) return '>99%';
  if (v < 1 && v > 0) return '<1%';
  return `${Math.round(v)}%`;
};
