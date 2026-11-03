import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { scaleLinear, scaleUtc } from 'd3-scale';
import { area, curveMonotoneX, line } from 'd3-shape';
import type { PollSeries } from '../../types';
import { useReducedMotion, useSize } from './hooks';
import { DAY, fmtDay, preparePolls, rollingAverage, type AvgPoint } from './pollMath';

export type Range = '30' | '90' | 'all';

interface Props {
  series: PollSeries;
  range: Range;
  /** end of x axis (epoch ms); defaults to max(today, last poll) */
  end?: number;
  height?: number;
}

const M = { top: 14, right: 54, bottom: 26, left: 34 };

export function PollChart({ series, range, end, height = 320 }: Props) {
  const [wrapRef, { width }] = useSize<HTMLDivElement>();
  const reduced = useReducedMotion();
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const keys = series.keys ?? [];
  const polls = useMemo(() => preparePolls(series), [series]);

  const today = Math.floor(Date.now() / DAY) * DAY + DAY / 2;
  const lastPoll = polls.length ? polls[polls.length - 1].t : today;
  const xEnd = end ?? Math.max(today, lastPoll);
  const firstPoll = polls.length ? polls[0].t : xEnd - 90 * DAY;
  const xStart = range === 'all' ? Math.min(firstPoll, xEnd - 30 * DAY) : xEnd - Number(range) * DAY;

  // compute the average from a bit before the visible window so the line starts "warm"
  const avg = useMemo(
    () => rollingAverage(polls, keys.map((k) => k.key), Math.min(xStart, firstPoll), xEnd),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [polls, series.keys, xStart, xEnd, firstPoll],
  );
  const visAvg = useMemo(() => avg.filter((a) => a.t >= xStart), [avg, xStart]);
  const visPolls = useMemo(() => polls.filter((p) => p.t >= xStart && p.t <= xEnd), [polls, xStart, xEnd]);

  const w = Math.max(280, width);
  const innerW = w - M.left - M.right;
  const innerH = height - M.top - M.bottom;

  const x = useMemo(() => scaleUtc().domain([xStart, xEnd]).range([0, innerW]), [xStart, xEnd, innerW]);
  const y = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const p of visPolls) for (const k of keys) {
      const v = p.values[k.key];
      if (v != null) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    }
    for (const a of visAvg) for (const k of keys) {
      const v = a.v[k.key];
      if (v != null) { lo = Math.min(lo, v - a.band[k.key]); hi = Math.max(hi, v + a.band[k.key]); }
    }
    if (!Number.isFinite(lo)) { lo = 35; hi = 55; }
    const pad = Math.max(1.5, (hi - lo) * 0.08);
    return scaleLinear().domain([lo - pad, hi + pad]).nice().range([innerH, 0]);
  }, [visPolls, visAvg, keys, innerH]);

  const paths = useMemo(() => keys.map((k) => {
    const defined = (a: AvgPoint) => a.v[k.key] != null;
    const ln = line<AvgPoint>().defined(defined).x((a) => x(a.t)).y((a) => y(a.v[k.key])).curve(curveMonotoneX);
    const ar = area<AvgPoint>()
      .defined(defined)
      .x((a) => x(a.t))
      .y0((a) => y(a.v[k.key] - a.band[k.key]))
      .y1((a) => y(a.v[k.key] + a.band[k.key]))
      .curve(curveMonotoneX);
    return { key: k.key, color: k.color, line: ln(visAvg) ?? '', area: ar(visAvg) ?? '' };
  }), [keys, visAvg, x, y]);

  const xTicks = x.ticks(Math.max(2, Math.min(7, Math.floor(innerW / 90))));
  const yTicks = y.ticks(Math.max(3, Math.floor(innerH / 48)));
  const latest = visAvg[visAvg.length - 1];

  // End labels, nudged apart to avoid overlap
  const endLabels = useMemo(() => {
    if (!latest) return [];
    const items = keys
      .filter((k) => latest.v[k.key] != null)
      .map((k) => ({ key: k.key, color: k.color, v: latest.v[k.key], y: y(latest.v[k.key]) }))
      .sort((a, b) => a.y - b.y);
    for (let i = 1; i < items.length; i++) if (items[i].y - items[i - 1].y < 16) items[i].y = items[i - 1].y + 16;
    return items;
  }, [latest, keys, y]);

  const now = Date.now();
  const hover = hoverIdx != null ? visAvg[hoverIdx] : null;

  const pickAt = (clientX: number) => {
    const svg = svgRef.current;
    if (!svg || !visAvg.length) return;
    const r = svg.getBoundingClientRect();
    const t = x.invert(clientX - r.left - M.left).getTime();
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < visAvg.length; i++) {
      const d = Math.abs(visAvg[i].t - t);
      if (d < bd) { bd = d; best = i; }
    }
    setHoverIdx(best);
  };
  const onMove = (e: PointerEvent<SVGSVGElement>) => pickAt(e.clientX);
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (!visAvg.length) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const step = e.shiftKey ? 7 : 1;
      setHoverIdx((i) => {
        const cur = i ?? visAvg.length - 1;
        return Math.max(0, Math.min(visAvg.length - 1, cur + (e.key === 'ArrowLeft' ? -step : step)));
      });
    } else if (e.key === 'Escape') setHoverIdx(null);
  };

  const hoverPolls = hover ? visPolls.filter((p) => Math.abs(p.t - hover.t) < DAY / 2) : [];
  const tipLeft = hover ? M.left + x(hover.t) : 0;
  const tipFlip = tipLeft > w * 0.6;
  const drawKey = `${series.id}-${range}-${Math.round(innerW / 40)}`;

  const summary = latest
    ? `${series.title} polling average: ${keys.map((k) => `${k.label} ${latest.v[k.key]?.toFixed(1) ?? '–'}%`).join(', ')} as of ${fmtDay(latest.t)}. ${visPolls.length} polls shown.`
    : `${series.title}: no polls in this range.`;

  return (
    <div ref={wrapRef} className="pc-wrap" style={{ height }}>
      {width > 0 && (
        <svg
          ref={svgRef}
          width={w}
          height={height}
          className="pc-svg"
          role="img"
          aria-label={summary + ' Use left and right arrow keys to inspect days.'}
          tabIndex={0}
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHoverIdx(null)}
          onKeyDown={onKey}
          onBlur={() => setHoverIdx(null)}
        >
          <g transform={`translate(${M.left},${M.top})`}>
            {yTicks.map((t) => (
              <g key={t} transform={`translate(0,${y(t)})`}>
                <line x2={innerW} className="pc-grid" />
                <text x={-8} dy="0.32em" textAnchor="end" className="pc-tick">{t}</text>
              </g>
            ))}
            {xTicks.map((t) => (
              <text key={+t} x={x(t)} y={innerH + 18} textAnchor="middle" className="pc-tick">
                {fmtDay(+t)}
              </text>
            ))}
            {paths.map((p) => (
              <path key={`a-${p.key}-${drawKey}`} d={p.area} className={reduced ? '' : 'pc-fade'} style={{ fill: p.color, opacity: 0.11 }} />
            ))}
            {visPolls.map((p) =>
              keys.map((k) => {
                const v = p.values[k.key];
                if (v == null) return null;
                const ageD = (now - p.t) / DAY;
                const op = Math.max(0.16, Math.min(0.7, 0.75 - ageD / 120));
                const r = 2 + Math.min(2.6, Math.sqrt((p.sample ?? 600) / 600) * 1.3);
                return <circle key={`${p.idx}-${k.key}`} cx={x(p.t)} cy={y(v)} r={r} style={{ fill: k.color, opacity: op }} />;
              }),
            )}
            {paths.map((p) => (
              <path
                key={`l-${p.key}-${drawKey}`}
                d={p.line}
                pathLength={1}
                className={reduced ? 'pc-line' : 'pc-line pc-draw'}
                style={{ stroke: p.color }}
              />
            ))}
            {/* today marker */}
            {now >= xStart && now <= xEnd + DAY && (
              <g transform={`translate(${x(now)},0)`}>
                <line y2={innerH} className="pc-today" />
                <text y={-3} textAnchor="end" dx={-3} className="pc-tick pc-today-l">TODAY</text>
              </g>
            )}
            {endLabels.map((l) => (
              <g key={l.key} transform={`translate(${innerW + 6},${l.y})`} className={reduced ? '' : 'pc-fade-late'}>
                <rect x={0} y={-9} width={44} height={18} rx={4} style={{ fill: l.color }} />
                <text x={22} dy="0.34em" textAnchor="middle" className="pc-endlabel">{l.v.toFixed(1)}</text>
              </g>
            ))}
            {hover && (
              <g transform={`translate(${x(hover.t)},0)`} pointerEvents="none">
                <line y2={innerH} className="pc-cross" />
                {keys.map((k) => hover.v[k.key] != null && (
                  <circle key={k.key} cy={y(hover.v[k.key])} r={4.5} className="pc-cross-dot" style={{ fill: k.color }} />
                ))}
              </g>
            )}
            {!visPolls.length && (
              <text x={innerW / 2} y={innerH / 2} textAnchor="middle" className="pc-empty">No polls in this window</text>
            )}
          </g>
        </svg>
      )}
      {hover && (
        <div
          className="pc-tip"
          role="status"
          style={{ left: tipLeft, transform: `translateX(${tipFlip ? 'calc(-100% - 12px)' : '12px'})` }}
        >
          <div className="pc-tip-date mono">{fmtDay(hover.t, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</div>
          {keys.map((k) => hover.v[k.key] != null && (
            <div key={k.key} className="pc-tip-row">
              <span className="pc-sw" style={{ background: k.color }} />
              <span>{k.label}</span>
              <span className="mono">{hover.v[k.key].toFixed(1)}%</span>
            </div>
          ))}
          {keys.length >= 2 && hover.v[keys[0].key] != null && hover.v[keys[1].key] != null && (
            <div className="pc-tip-margin mono">
              {(() => {
                const m = hover.v[keys[0].key] - hover.v[keys[1].key];
                const lead = m >= 0 ? keys[0] : keys[1];
                return <span style={{ color: lead.color }}>{lead.label} +{Math.abs(m).toFixed(1)}</span>;
              })()}
            </div>
          )}
          <div className="pc-tip-n">{hover.n} poll{hover.n === 1 ? '' : 's'} in 14-day window</div>
          {hoverPolls.slice(0, 3).map((p) => (
            <div key={p.idx} className="pc-tip-poll mono">
              {p.pollster.length > 22 ? p.pollster.slice(0, 21) + '…' : p.pollster} · {keys.map((k) => p.values[k.key]).filter((v) => v != null).join('–')}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
