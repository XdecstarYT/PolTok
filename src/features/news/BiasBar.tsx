import type { Coverage, Side } from './newsUtils';
import { SIDE_HEX, SIDE_LABEL } from './newsUtils';

/** Ground-News-style Left / Center / Right coverage distribution bar. */
export function CoverageBar({
  coverage,
  height = 8,
  showLabels = false,
  compact = false,
}: {
  coverage: Coverage;
  height?: number;
  showLabels?: boolean;
  compact?: boolean;
}) {
  const rated = coverage.L + coverage.C + coverage.R;
  const denom = rated || 1;
  const pct = (n: number) => Math.round((n / denom) * 100);
  const sides: Side[] = ['L', 'C', 'R'];
  const label = rated
    ? `Coverage: ${pct(coverage.L)}% left, ${pct(coverage.C)}% center, ${pct(coverage.R)}% right of ${rated} rated outlet${rated === 1 ? '' : 's'}`
    : 'Coverage: no rated outlets yet';
  return (
    <div className="nw-bias" role="img" aria-label={label} title={label}>
      <div className="nw-bias-track" style={{ height }}>
        {rated === 0 ? (
          <span style={{ flex: 1, background: SIDE_HEX.U, opacity: 0.4 }} />
        ) : (
          sides.map((s) =>
            coverage[s] ? (
              <span key={s} style={{ flex: coverage[s], background: SIDE_HEX[s] }}>
                {!compact && height >= 14 && pct(coverage[s]) >= 18 ? (
                  <em>
                    {s} {pct(coverage[s])}%
                  </em>
                ) : null}
              </span>
            ) : null,
          )
        )}
      </div>
      {showLabels && (
        <div className="nw-bias-legend mono">
          {sides.map((s) => (
            <span key={s}>
              <i style={{ background: SIDE_HEX[s] }} />
              {SIDE_LABEL[s]} {pct(coverage[s])}%
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function BlindspotBadge({ side }: { side: Side }) {
  return (
    <span className="nw-blindspot" title={`Covered mostly by ${side === 'R' ? 'left' : 'right'}-leaning outlets`}>
      <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 5C6 5 2 12 2 12s4 7 10 7 10-7 10-7-4-7-10-7zm0 11a4 4 0 110-8 4 4 0 010 8zM3 3l18 18-1.4 1.4L1.6 4.4z"
        />
      </svg>
      Blindspot for the {SIDE_LABEL[side]}
    </span>
  );
}

export function LeanDot({ hex, size = 8, title }: { hex: string; size?: number; title?: string }) {
  return (
    <span
      title={title}
      aria-hidden={title ? undefined : true}
      style={{ display: 'inline-block', width: size, height: size, borderRadius: 99, background: hex, flex: 'none', boxShadow: `0 0 0 2px ${hex}33` }}
    />
  );
}
