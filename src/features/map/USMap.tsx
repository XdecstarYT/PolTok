/**
 * USMap — reusable SVG map of the 50 states + DC.
 * PUBLIC API (other agents import this; props are backwards compatible with the stub).
 *
 *   <USMap fills={{PA:'#ff3d55'}} variant="geo|hex" onStateClick={...}
 *          renderTooltip={(abbr) => <div/>} highlight={['PA']} labels focus={['PA','GA']} />
 *
 * - 'geo' = geoAlbersUsa projection; 'hex' = equal-size hex tiles. Switching variant
 *   animates tiles flying between their geographic and grid positions.
 * - Fills transition smoothly (CSS). Keyboard: Tab through states, Enter/Space = click.
 */
import { memo, useCallback, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { getGeometry, luminance, VB_H, VB_W } from './geometry';
import { stateName } from './stateTable';
import './map.css';

export interface USMapProps {
  /** fill color per state abbr; missing = neutral */
  fills?: Record<string, string>;
  /** 'geo' = albersUsa projection, 'hex' = equal-area hex cartogram */
  variant?: 'geo' | 'hex';
  onStateClick?: (abbr: string) => void;
  onStateHover?: (abbr: string | null) => void;
  /** tooltip content renderer for hovered state */
  renderTooltip?: (abbr: string) => ReactNode;
  /** states to pulse/glow (e.g. just called) */
  highlight?: string[];
  /** show state abbreviation labels */
  labels?: boolean;
  /** dim states not in this list */
  focus?: string[];
  className?: string;
  style?: CSSProperties;
  // ---- optional extensions ----
  /** persistent selection outline */
  selected?: string | null;
  /** small second line under the abbr label (e.g. EV count) */
  sublabels?: Record<string, string>;
  /** accessible description after "Name: " (default: tooltip-less summary) */
  describe?: (abbr: string) => string;
  /** fill for states without an entry in `fills` */
  emptyFill?: string;
  /** accessible name of the whole map */
  title?: string;
}

const NEUTRAL = '#1c2031';

function USMapImpl({
  fills,
  variant = 'geo',
  onStateClick,
  onStateHover,
  renderTooltip,
  highlight,
  labels = true,
  focus,
  className,
  style,
  selected,
  sublabels,
  describe,
  emptyFill = NEUTRAL,
  title = 'Map of the United States',
}: USMapProps) {
  const G = getGeometry();
  const wrapRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<string | null>(null);
  const isHex = variant === 'hex';
  const fillOf = (abbr: string) => fills?.[abbr] ?? emptyFill;
  const focusSet = useMemo(() => (focus && focus.length ? new Set(focus) : null), [focus]);
  const hl = useMemo(() => (highlight ?? []).filter((a) => G.geoByAbbr.has(a) || G.hexByAbbr.has(a)), [highlight, G]);

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

  const enter = (abbr: string) => {
    setHover(abbr);
    onStateHover?.(abbr);
  };
  const leave = () => {
    setHover(null);
    onStateHover?.(null);
  };
  const onMove = (e: PointerEvent) => {
    if (hover) placeTip(e.clientX, e.clientY);
  };
  const onFocusState = (abbr: string) => {
    enter(abbr);
    // Position tooltip at the state's center.
    requestAnimationFrame(() => {
      const svg = wrapRef.current?.querySelector('svg');
      if (!svg) return;
      const p = isHex ? G.hexByAbbr.get(abbr) : G.geoByAbbr.get(abbr);
      if (!p) return;
      const [x, y] = 'x' in p ? [p.x, p.y] : p.centroid;
      const r = svg.getBoundingClientRect();
      placeTip(r.left + (x / VB_W) * r.width, r.top + (y / VB_H) * r.height);
    });
  };
  const onKey = (e: KeyboardEvent, abbr: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onStateClick?.(abbr);
    }
  };
  const aria = (abbr: string) => `${stateName(abbr)}: ${describe ? describe(abbr) : onStateClick ? 'select for details' : 'state'}`;
  const dimmed = (abbr: string) => !!focusSet && !focusSet.has(abbr);
  const interactive = (abbr: string, active: boolean) =>
    active
      ? {
          tabIndex: 0,
          role: onStateClick ? 'button' : 'img',
          'aria-label': aria(abbr),
          onPointerEnter: (e: PointerEvent) => {
            enter(abbr);
            placeTip(e.clientX, e.clientY);
          },
          onPointerLeave: leave,
          onFocus: () => onFocusState(abbr),
          onBlur: leave,
          onClick: () => onStateClick?.(abbr),
          onKeyDown: (e: KeyboardEvent) => onKey(e, abbr),
        }
      : { tabIndex: -1, 'aria-hidden': true as const };

  const hoverGeo = hover && !isHex ? G.geoByAbbr.get(hover) : undefined;
  const hoverHex = hover && isHex ? G.hexByAbbr.get(hover) : undefined;
  const selGeo = selected && !isHex ? G.geoByAbbr.get(selected) : undefined;
  const selHex = selected && isHex ? G.hexByAbbr.get(selected) : undefined;
  const tip = hover && renderTooltip ? renderTooltip(hover) : null;

  return (
    <div
      ref={wrapRef}
      className={`usmap ${isHex ? 'is-hex' : 'is-geo'} ${focusSet ? 'has-focus' : ''} ${onStateClick ? 'is-clickable' : ''} ${className ?? ''}`}
      style={style}
      onPointerMove={onMove}
    >
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} role="group" aria-label={title} className="usmap-svg">
        <defs>
          <filter id="usmap-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ---------- GEO LAYER ---------- */}
        <g className="usmap-geo" aria-hidden={isHex}>
          <path className="usmap-nation-glow" d={G.nation} />
          {G.geo.map((s) => (
            <path
              key={s.abbr}
              d={s.d}
              className={`usmap-state ${dimmed(s.abbr) ? 'is-dim' : ''}`}
              style={{ fill: fillOf(s.abbr) }}
              {...interactive(s.abbr, !isHex)}
            />
          ))}
          <path className="usmap-borders" d={G.borders} />
          <path className="usmap-nation" d={G.nation} />
          {selGeo && <path className="usmap-selected" d={selGeo.d} />}
          {hoverGeo && <path className="usmap-hover" d={hoverGeo.d} style={{ fill: fillOf(hoverGeo.abbr) }} />}
          {!isHex &&
            hl.map((a) => {
              const g = G.geoByAbbr.get(a);
              return g ? (
                <g key={a}>
                  {/* one-shot "called" burst: white flash + expanding rings, then the looping pulse */}
                  <path className="usmap-flash" d={g.d} />
                  <circle className="usmap-ring" cx={g.centroid[0]} cy={g.centroid[1]} r={6} />
                  <circle className="usmap-ring usmap-ring--2" cx={g.centroid[0]} cy={g.centroid[1]} r={6} />
                  <path className="usmap-pulse" d={g.d} />
                </g>
              ) : null;
            })}
          {labels &&
            G.geo
              .filter((g) => g.callout)
              .map((g) => (
                <g key={g.abbr} className="usmap-leader">
                  <line x1={g.centroid[0]} y1={g.centroid[1]} x2={g.label[0] - 13} y2={g.label[1]} />
                  <circle cx={g.centroid[0]} cy={g.centroid[1]} r={1.6} />
                </g>
              ))}
          {labels &&
            G.geo
              .filter((g) => g.callout)
              .map((g) => (
                <rect
                  key={g.abbr}
                  className={`usmap-chip ${dimmed(g.abbr) ? 'is-dim' : ''}`}
                  x={g.label[0] - 12}
                  y={g.label[1] - 8}
                  width={8}
                  height={8}
                  rx={2}
                  style={{ fill: fillOf(g.abbr) }}
                  {...(isHex ? {} : { onClick: () => onStateClick?.(g.abbr), onPointerEnter: () => enter(g.abbr), onPointerLeave: leave })}
                />
              ))}
        </g>

        {/* ---------- HEX LAYER ---------- */}
        <g className="usmap-hexes" aria-hidden={!isHex}>
          {G.hex.map((h) => {
            const geo = G.geoByAbbr.get(h.abbr);
            const from = geo ? geo.centroid : [h.x, h.y];
            const t = isHex
              ? `translate(${h.x}px, ${h.y}px) scale(1)`
              : `translate(${from[0]}px, ${from[1]}px) scale(0.18)`;
            return (
              <g key={h.abbr} className="usmap-hex-cell" style={{ transform: t, transitionDelay: `${(isHex ? h.col : 10 - h.col) * 22}ms` }}>
                <path
                  d={G.hexPath}
                  className={`usmap-hex ${dimmed(h.abbr) ? 'is-dim' : ''}`}
                  style={{ fill: fillOf(h.abbr) }}
                  {...interactive(h.abbr, isHex)}
                />
              </g>
            );
          })}
          {selHex && <path className="usmap-selected" d={G.hexPath} transform={`translate(${selHex.x} ${selHex.y})`} />}
          {hoverHex && (
            <path className="usmap-hover usmap-hover-hex" d={G.hexPath} transform={`translate(${hoverHex.x} ${hoverHex.y - 3})`} style={{ fill: fillOf(hoverHex.abbr) }} />
          )}
          {isHex &&
            hl.map((a) => {
              const h = G.hexByAbbr.get(a);
              return h ? <path key={a} className="usmap-pulse" d={G.hexPath} transform={`translate(${h.x} ${h.y})`} /> : null;
            })}
        </g>

        {/* ---------- LABELS (shared, glide between layouts) ---------- */}
        {labels && (
          <g className="usmap-labels" aria-hidden>
            {G.hex.map((h) => {
              const geo = G.geoByAbbr.get(h.abbr);
              const pos = isHex || !geo ? [h.x, h.y] : geo.label;
              const onBg = !isHex && !!geo?.callout;
              const small = !isHex && !!geo && !geo.callout && geo.area < 1400;
              const L = luminance(fillOf(h.abbr));
              const cls = onBg ? 'on-bg' : L > 0.45 ? 'on-light' : 'on-dark';
              const sub = isHex ? sublabels?.[h.abbr] : undefined;
              return (
                <g
                  key={h.abbr}
                  className={`usmap-label ${cls} ${dimmed(h.abbr) ? 'is-dim' : ''} ${onBg ? 'is-callout' : ''} ${small ? 'is-small' : ''} ${hover === h.abbr ? 'is-hover' : ''}`}
                  style={{ transform: `translate(${pos[0]}px, ${pos[1]}px)` }}
                >
                  <text className="usmap-abbr" y={sub ? -3 : 0} textAnchor={onBg ? 'start' : 'middle'} dominantBaseline="central">
                    {h.abbr}
                  </text>
                  {sub && (
                    <text className="usmap-sub" y={13} textAnchor="middle" dominantBaseline="central">
                      {sub}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        )}
      </svg>
      <div ref={tipRef} className={`usmap-tip ${tip ? 'is-on' : ''}`} role="tooltip" aria-hidden={!tip}>
        {tip}
      </div>
    </div>
  );
}

export const USMap = memo(USMapImpl);
export default USMap;
