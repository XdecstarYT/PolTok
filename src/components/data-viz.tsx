import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { animate, useMotionValue, useSpring } from 'framer-motion';
import type { BalanceOfPower, Lean } from '../types';
import { fmtInt, LEAN_HEX } from '../lib/format';
import { useReducedMotion } from './hooks';
import { Skeleton } from './primitives';

/* ═════════════════ AnimatedNumber ═════════════════ */

const DIGITS = '0123456789';

/**
 * Odometer-style rolling number with tabular figures. Each digit column rolls to its new value.
 * Flashes a glow (`flashColor`) when the value changes. Falls back to plain text with reduced motion.
 * @param value  numeric value
 * @param format formatter → string (default: fmtInt, e.g. "1,234"). Any non-digit chars render statically.
 */
export function AnimatedNumber({
  value, format = fmtInt, className, style, flashColor, ariaLabel,
}: { value: number; format?: (n: number) => string; className?: string; style?: CSSProperties; flashColor?: string; ariaLabel?: string }) {
  const reduce = useReducedMotion();
  const text = Number.isFinite(value) ? format(value) : '—';
  const [flash, setFlash] = useState(false);
  const prev = useRef(text);
  useEffect(() => {
    if (prev.current !== text && flashColor && !reduce) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 700);
      prev.current = text;
      return () => clearTimeout(t);
    }
    prev.current = text;
  }, [text, flashColor, reduce]);

  const chars = text.split('');
  return (
    <span
      className={`pt-odo num ${className ?? ''}`}
      style={{ ...style, textShadow: flash ? `0 0 18px ${flashColor}` : undefined }}
      aria-label={ariaLabel ?? text}
      role="text"
    >
      {reduce ? (
        <span aria-hidden="true">{text}</span>
      ) : (
        chars.map((ch, i) => {
          const keyFromEnd = chars.length - i;
          const d = DIGITS.indexOf(ch);
          if (d < 0)
            return (
              <span key={`s${keyFromEnd}`} aria-hidden="true" className="pt-odo__static">
                {ch}
              </span>
            );
          return (
            <span key={`d${keyFromEnd}`} className="pt-odo__col" aria-hidden="true">
              <span className="pt-odo__reel" style={{ transform: `translateY(${-d * 10}%)` }}>
                {DIGITS.split('').map((x) => (
                  <span key={x}>{x}</span>
                ))}
              </span>
              <span className="pt-odo__sizer">0</span>
            </span>
          );
        })
      )}
    </span>
  );
}

/* ═════════════════ Sparkline ═════════════════ */

/**
 * Tiny SVG trend line. `values` in chronological order. Optional area fill and end dot.
 * Renders nothing meaningful for < 2 points (flat dashed line).
 */
export function Sparkline({
  values, width = 96, height = 28, color = 'var(--accent)', fill = true, dot = true, strokeWidth = 1.75, min, max, ariaLabel, className,
}: {
  values: number[]; width?: number; height?: number; color?: string; fill?: boolean; dot?: boolean; strokeWidth?: number;
  /** fixed y-domain (defaults to data extent) */ min?: number; max?: number; ariaLabel?: string; className?: string;
}) {
  const id = useMemo(() => `sp${Math.random().toString(36).slice(2, 8)}`, []);
  const vals = (values ?? []).filter((v) => Number.isFinite(v));
  const pad = strokeWidth + 2;
  if (vals.length < 2)
    return (
      <svg width={width} height={height} className={className} role="img" aria-label={ariaLabel ?? 'No trend data'}>
        <line x1={0} x2={width} y1={height / 2} y2={height / 2} stroke="var(--line-2)" strokeDasharray="3 3" />
      </svg>
    );
  const lo = min ?? Math.min(...vals);
  const hi = max ?? Math.max(...vals);
  const span = hi - lo || 1;
  const x = (i: number) => (i / (vals.length - 1)) * (width - pad * 2) + pad;
  const y = (v: number) => height - pad - ((v - lo) / span) * (height - pad * 2);
  const d = vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${d} L${x(vals.length - 1).toFixed(1)},${height} L${x(0).toFixed(1)},${height} Z`;
  const last = vals[vals.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} role="img" aria-label={ariaLabel ?? `Trend, latest ${last}`}>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.35" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#${id})`} />}
      <path d={d} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
      {dot && <circle cx={x(vals.length - 1)} cy={y(last)} r={strokeWidth + 1.25} fill={color} />}
    </svg>
  );
}

/* ═════════════════ Needle / Gauge ═════════════════ */

const BANDS = ['Very likely', 'Likely', 'Lean', 'Toss-up', 'Lean', 'Likely', 'Very likely'];

/**
 * NYT-style semicircle "needle". LEFT = Democrats, RIGHT = Republicans.
 * @param demProb probability (0..1) Democrats win / control. 1 → needle hard left, 0 → hard right.
 *                undefined → loading state (needle parked at center, dimmed).
 * @param jitter  idle wobble proportional to uncertainty (off under reduced motion). Default true.
 * @param label   caption above the readout, e.g. "Senate control"
 */
export function Needle({
  demProb, label, jitter = true, size = 260, showBands = true, demLabel = 'DEM', repLabel = 'REP', className,
}: {
  demProb?: number; label?: string; jitter?: boolean; size?: number; showBands?: boolean; demLabel?: string; repLabel?: string; className?: string;
}) {
  const reduce = useReducedMotion();
  const loading = demProb == null || !Number.isFinite(demProb);
  const p = loading ? 0.5 : Math.max(0, Math.min(1, demProb!));
  const target = (0.5 - p) * 176; // degrees; -88 = far left (D), +88 = far right (R)
  const base = useMotionValue(target);
  const spring = useSpring(base, { stiffness: 70, damping: 14, mass: 1.1 });
  const needleRef = useRef<SVGGElement>(null);
  useLayoutEffect(() => {
    const set = (v: number) => needleRef.current?.setAttribute('transform', `rotate(${v.toFixed(2)} 100 100)`);
    set(spring.get());
    return spring.on('change', set);
  }, [spring]);

  useEffect(() => {
    if (reduce) {
      spring.jump(target);
      base.set(target);
      return;
    }
    base.set(target);
    if (!jitter || loading) return;
    const unc = 1 - Math.abs(2 * p - 1); // 1 at 50/50, 0 at certainty
    if (unc < 0.02) return;
    const id = setInterval(() => base.set(target + (Math.random() * 2 - 1) * 3 * unc), 650);
    return () => clearInterval(id);
  }, [target, jitter, loading, reduce, p, base, spring]);

  const gid = useMemo(() => `ndl${Math.random().toString(36).slice(2, 8)}`, []);
  const R = 82;
  const arc = (a0: number, a1: number, r = R) => {
    const pt = (a: number) => [100 + r * Math.cos(Math.PI - a), 100 - r * Math.sin(Math.PI - a)];
    const [x0, y0] = pt(a0);
    const [x1, y1] = pt(a1);
    return `M${x0},${y0} A${r},${r} 0 0 1 ${x1},${y1}`;
  };
  const leader = p >= 0.5 ? 'D' : 'R';
  const pct = Math.round((leader === 'D' ? p : 1 - p) * 100);
  const tickAngles = Array.from({ length: 8 }, (_, i) => (i / 7) * Math.PI);
  return (
    <figure className={`pt-needle ${loading ? 'is-loading' : ''} ${className ?? ''}`} style={{ maxWidth: size }}>
      <svg viewBox="0 -4 200 120" role="img" aria-label={loading ? `${label ?? 'Forecast'}: loading` : `${label ?? 'Forecast'}: Democrats ${Math.round(p * 100)}%, Republicans ${Math.round((1 - p) * 100)}%`}>
        <defs>
          <linearGradient id={gid} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="var(--dem)" />
            <stop offset="0.42" stopColor="#6c7bd9" stopOpacity="0.55" />
            <stop offset="0.5" stopColor="var(--tossup)" stopOpacity="0.55" />
            <stop offset="0.58" stopColor="#d9637a" stopOpacity="0.55" />
            <stop offset="1" stopColor="var(--rep)" />
          </linearGradient>
        </defs>
        <path d={arc(0, Math.PI)} stroke="var(--bg-3)" strokeWidth="22" fill="none" />
        <path d={arc(0, Math.PI)} stroke={`url(#${gid})`} strokeWidth="18" fill="none" opacity={loading ? 0.3 : 0.95} />
        {tickAngles.map((a, i) => {
          const x0 = 100 + 70 * Math.cos(Math.PI - a), y0 = 100 - 70 * Math.sin(Math.PI - a);
          const x1 = 100 + 94 * Math.cos(Math.PI - a), y1 = 100 - 94 * Math.sin(Math.PI - a);
          return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} stroke="var(--bg)" strokeWidth="1.5" />;
        })}
        {showBands &&
          BANDS.map((b, i) => {
            if (i !== 3) return null;
            const x = 100, y = 4;
            return (
              <text key={i} x={x} y={y + 2} textAnchor="middle" fontSize="6.2" fill="var(--text-3)" fontFamily="var(--font-data)" letterSpacing="0.05em">
                {b.toUpperCase()}
              </text>
            );
          })}
        <g ref={needleRef}>
          <path d="M100,24 L103.2,100 L96.8,100 Z" fill="var(--text)" style={{ filter: 'drop-shadow(0 0 4px rgba(255,255,255,.5))' }} />
        </g>
        <circle cx="100" cy="100" r="8" fill="var(--bg-1)" stroke="var(--text)" strokeWidth="2.5" />
        <text x="8" y="114" fontSize="8" fontWeight="700" fill="var(--dem-glow)" fontFamily="var(--font-data)">{demLabel}</text>
        <text x="192" y="114" fontSize="8" fontWeight="700" fill="var(--rep-glow)" textAnchor="end" fontFamily="var(--font-data)">{repLabel}</text>
      </svg>
      <figcaption className="pt-needle__cap">
        {label && <span className="panel-title">{label}</span>}
        {loading ? (
          <Skeleton width={120} height={22} />
        ) : (
          <span className="pt-needle__read num">
            <span className="dem">D {Math.round(p * 100)}%</span>
            <span className="faint"> · </span>
            <span className="rep">R {Math.round((1 - p) * 100)}%</span>
          </span>
        )}
        {!loading && (
          <span className={`pt-needle__verdict ${leader === 'D' ? 'dem' : 'rep'}`}>
            {pct >= 95 ? `${leader === 'D' ? 'Dems' : 'GOP'} near-certain` : pct >= 75 ? `Likely ${leader === 'D' ? 'Dem' : 'GOP'}` : pct >= 60 ? `Leans ${leader === 'D' ? 'Dem' : 'GOP'}` : 'Toss-up'}
          </span>
        )}
      </figcaption>
    </figure>
  );
}
/** Alias of Needle. */
export const Gauge = Needle;

/* ═════════════════ BalanceBar ═════════════════ */

/**
 * Chamber balance of power: [ DEM | IND | undecided | REP ] with a majority marker.
 * Pass `balance` from useLive().balance.senate / .house. Undefined → skeleton.
 * @param title   heading (default "Senate"/"House")
 * @param compact smaller, no legend row
 */
export function BalanceBar({ balance, title, compact, showProjected = true }: { balance?: BalanceOfPower; title?: string; compact?: boolean; showProjected?: boolean }) {
  if (!balance || !balance.total) {
    return (
      <div className="pt-balance" aria-busy="true">
        <div className="row spread"><Skeleton width={60} height={compact ? 22 : 34} /><Skeleton width={90} height={12} /><Skeleton width={60} height={compact ? 22 : 34} /></div>
        <Skeleton height={compact ? 12 : 18} radius={6} style={{ marginTop: 10 }} />
      </div>
    );
  }
  const { total, majority, dem, rep, ind, undecided } = balance;
  const pct = (n: number) => `${(Math.max(0, n) / total) * 100}%`;
  const name = title ?? (balance.chamber === 'senate' ? 'Senate' : 'House');
  const majPos = (majority / total) * 100;
  const demCtl = dem + ind >= majority;
  const repCtl = rep >= majority;
  return (
    <div className={`pt-balance ${compact ? 'pt-balance--compact' : ''}`}>
      <div className="pt-balance__nums">
        <div className="pt-balance__side">
          <AnimatedNumber value={dem} className="pt-balance__n dem" flashColor="var(--dem)" ariaLabel={`Democrats ${dem}`} />
          <span className="pt-balance__lbl">
            DEM{ind > 0 && <span className="ind"> +{ind} IND</span>}
            {demCtl && <span className="pt-balance__won"> ✓ CONTROL</span>}
          </span>
        </div>
        <div className="pt-balance__mid">
          <span className="panel-title">{name}</span>
          <span className="faint num" style={{ fontSize: 12 }}>{majority} for majority</span>
        </div>
        <div className="pt-balance__side pt-balance__side--r">
          <AnimatedNumber value={rep} className="pt-balance__n rep" flashColor="var(--rep)" ariaLabel={`Republicans ${rep}`} />
          <span className="pt-balance__lbl">
            {repCtl && <span className="pt-balance__won">CONTROL ✓ </span>}REP
          </span>
        </div>
      </div>
      <div className="pt-balance__bar" role="img" aria-label={`${name}: Democrats ${dem}, Independents ${ind}, undecided ${undecided}, Republicans ${rep}. ${majority} needed for majority.`}>
        <span className="pt-balance__seg" style={{ width: pct(dem), background: 'var(--dem)' }} />
        <span className="pt-balance__seg" style={{ width: pct(ind), background: 'var(--ind)' }} />
        <span className="pt-balance__seg pt-balance__seg--und" style={{ width: pct(undecided) }} />
        <span className="pt-balance__seg" style={{ width: pct(rep), background: 'var(--rep)', marginLeft: 'auto' }} />
        <span className="pt-balance__maj" style={{ left: `${majPos}%` }} aria-hidden="true" />
      </div>
      {!compact && (
        <div className="pt-balance__foot num">
          <span>{undecided > 0 ? `${undecided} undecided` : 'All seats decided'}</span>
          {showProjected && balance.projected && (
            <span>
              Proj. <span className="dem">D {balance.projected.dem}</span> · <span className="rep">R {balance.projected.rep}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* ═════════════════ BiasBar ═════════════════ */

const LEAN5: Lean[] = ['Left', 'Lean Left', 'Center', 'Lean Right', 'Right'];

/** Count items by `sourceLean` — feed the result to <BiasBar counts/>. */
export function leanCounts(items: { sourceLean?: Lean }[]): Partial<Record<Lean, number>> {
  const out: Partial<Record<Lean, number>> = {};
  for (const it of items ?? []) {
    const l = it.sourceLean ?? 'Unrated';
    out[l] = (out[l] ?? 0) + 1;
  }
  return out;
}

/**
 * Ground News-style coverage bias bar.
 * @param counts  number of sources/items per Lean (Unrated ignored)
 * @param buckets 3 (L / C / R, default) or 5 (full lean scale)
 * @param labels  show "L 40% · C 20% · R 40%" legend under the bar
 */
export function BiasBar({
  counts, buckets = 3, labels = true, height = 6, className,
}: { counts: Partial<Record<Lean, number>>; buckets?: 3 | 5; labels?: boolean; height?: number; className?: string }) {
  const c = (l: Lean) => counts?.[l] ?? 0;
  const segs =
    buckets === 5
      ? LEAN5.map((l) => ({ key: l, short: l.replace('Lean ', 'L-').replace('Left', 'L').replace('Right', 'R').replace('Center', 'C'), n: c(l), color: LEAN_HEX[l] }))
      : [
          { key: 'Left', short: 'L', n: c('Left') + c('Lean Left'), color: LEAN_HEX['Left'] },
          { key: 'Center', short: 'C', n: c('Center'), color: LEAN_HEX['Center'] },
          { key: 'Right', short: 'R', n: c('Right') + c('Lean Right'), color: LEAN_HEX['Right'] },
        ];
  const total = segs.reduce((a, s) => a + s.n, 0);
  const desc = total ? segs.map((s) => `${s.key} ${Math.round((s.n / total) * 100)}%`).join(', ') : 'No rated sources';
  return (
    <div className={`pt-bias ${className ?? ''}`}>
      <div className="pt-bias__bar" style={{ height }} role="img" aria-label={`Coverage bias: ${desc}`}>
        {total === 0 ? (
          <span style={{ flex: 1, background: 'var(--bg-3)' }} />
        ) : (
          segs.map((s) => (s.n ? <span key={s.key} style={{ flexGrow: s.n, background: s.color }} /> : null))
        )}
      </div>
      {labels && total > 0 && (
        <div className="pt-bias__legend num" aria-hidden="true">
          {segs.map((s) =>
            s.n ? (
              <span key={s.key} style={{ color: `color-mix(in srgb, ${s.color} 62%, var(--text))` }}>
                {s.short} {Math.round((s.n / total) * 100)}%
              </span>
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}

/* ═════════════════ CountUp (tween) ═════════════════ */

/** Smooth tween between numbers (non-odometer). Good for percentages: <CountUp value={52.3} decimals={1} suffix="%" /> */
export function CountUp({ value, decimals = 0, suffix = '', prefix = '', className }: { value: number; decimals?: number; suffix?: string; prefix?: string; className?: string }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (reduce) { setShown(value); from.current = value; return; }
    const ctl = animate(from.current, value, { duration: 0.6, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => setShown(v) });
    from.current = value;
    return () => ctl.stop();
  }, [value, reduce]);
  return <span className={`num ${className ?? ''}`}>{prefix}{Number.isFinite(shown) ? shown.toFixed(decimals) : '—'}{suffix}</span>;
}
