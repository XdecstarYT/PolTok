/**
 * ElectoralBar — horizontal 538-EV (or seat) bar with a majority marker.
 *   <ElectoralBar dem={226} rep={312} />                       // simple D vs R
 *   <ElectoralBar segments={[...]} total={100} threshold={51} />  // rating buckets
 * Segments are laid out left→right in the order given (put D first, R last).
 */
import type { ReactNode } from 'react';
import { PARTY_HEX } from '../../lib/format';
import './electoral-bar.css';

export interface BarSegment {
  key: string;
  value: number;
  color: string;
  label?: string;
}

export interface ElectoralBarProps {
  dem?: number;
  rep?: number;
  segments?: BarSegment[];
  /** total seats / EVs (default 538) */
  total?: number;
  /** majority marker (default 270); null hides it */
  threshold?: number | null;
  thresholdLabel?: string;
  leftLabel?: ReactNode;
  rightLabel?: ReactNode;
  /** sum of D-side segments for the big left number (defaults to dem or first-half segments) */
  leftValue?: number;
  rightValue?: number;
  compact?: boolean;
  className?: string;
}

export function ElectoralBar({
  dem,
  rep,
  segments,
  total = 538,
  threshold = 270,
  thresholdLabel,
  leftLabel = 'Democrats',
  rightLabel = 'Republicans',
  leftValue,
  rightValue,
  compact,
  className,
}: ElectoralBarProps) {
  const segs: BarSegment[] =
    segments ??
    [
      { key: 'D', value: dem ?? 0, color: PARTY_HEX.D, label: 'Dem' },
      { key: 'U', value: Math.max(0, total - (dem ?? 0) - (rep ?? 0)), color: 'transparent', label: 'Undecided' },
      { key: 'R', value: rep ?? 0, color: PARTY_HEX.R, label: 'Rep' },
    ];
  const L = leftValue ?? dem ?? 0;
  const R = rightValue ?? rep ?? 0;
  const safeTotal = Math.max(1, total);
  const pct = (v: number) => `${(Math.max(0, v) / safeTotal) * 100}%`;
  const wonL = threshold != null && L >= threshold;
  const wonR = threshold != null && R >= threshold;
  return (
    <div className={`ebar ${compact ? 'is-compact' : ''} ${className ?? ''}`}>
      <div className="ebar-nums">
        <div className={`ebar-side is-d ${wonL ? 'is-won' : ''}`}>
          <span className="ebar-big mono">{Math.round(L)}</span>
          <span className="ebar-name">{leftLabel}</span>
        </div>
        <div className="ebar-mid mono">{thresholdLabel ?? (threshold != null ? `${threshold} to win` : '')}</div>
        <div className={`ebar-side is-r ${wonR ? 'is-won' : ''}`}>
          <span className="ebar-name">{rightLabel}</span>
          <span className="ebar-big mono">{Math.round(R)}</span>
        </div>
      </div>
      <div
        className="ebar-track"
        role="img"
        aria-label={`${typeof leftLabel === 'string' ? leftLabel : 'Left'} ${Math.round(L)}, ${typeof rightLabel === 'string' ? rightLabel : 'Right'} ${Math.round(R)} of ${total}${threshold != null ? `; ${threshold} needed` : ''}`}
      >
        {segs.map((s) => (
          <div
            key={s.key}
            className="ebar-seg"
            title={s.label ? `${s.label}: ${s.value}` : undefined}
            style={{ width: pct(s.value), background: s.color }}
          />
        ))}
        {threshold != null && <div className="ebar-marker" style={{ left: pct(threshold) }} />}
      </div>
    </div>
  );
}

export default ElectoralBar;
