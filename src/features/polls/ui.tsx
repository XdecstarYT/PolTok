/** Small local UI pieces for the polls/forecast feature. */
import { useMemo, type ReactNode } from 'react';
import { scaleLinear } from 'd3-scale';
import { area, curveMonotoneX, line } from 'd3-shape';

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; label: string }) {
  return (
    <div className="pl-seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={o.value === value}
          className={o.value === value ? 'on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Inline sparkline. `values` evenly spaced, `domain` optional fixed y-domain. */
export function Spark({ values, color = 'var(--accent)', width = 120, height = 32, domain, refLine }: { values: number[]; color?: string; width?: number; height?: number; domain?: [number, number]; refLine?: number }) {
  const d = useMemo(() => {
    if (values.length < 2) return null;
    const lo = domain ? domain[0] : Math.min(...values);
    const hi = domain ? domain[1] : Math.max(...values);
    const pad = (hi - lo) * 0.1 || 0.01;
    const x = scaleLinear().domain([0, values.length - 1]).range([1, width - 3]);
    const y = scaleLinear().domain([lo - pad, hi + pad]).range([height - 2, 2]);
    return {
      line: line<number>().x((_, i) => x(i)).y((v) => y(v)).curve(curveMonotoneX)(values) ?? '',
      area: area<number>().x((_, i) => x(i)).y0(height).y1((v) => y(v)).curve(curveMonotoneX)(values) ?? '',
      end: { x: x(values.length - 1), y: y(values[values.length - 1]) },
      ref: refLine != null ? y(refLine) : null,
    };
  }, [values, width, height, domain, refLine]);
  if (!d) return <svg width={width} height={height} aria-hidden />;
  return (
    <svg width={width} height={height} aria-hidden className="pl-spark">
      {d.ref != null && <line x1={0} x2={width} y1={d.ref} y2={d.ref} stroke="var(--line-2)" strokeDasharray="2 3" />}
      <path d={d.area} style={{ fill: color, opacity: 0.12 }} />
      <path d={d.line} style={{ stroke: color }} fill="none" strokeWidth={1.6} />
      <circle cx={d.end.x} cy={d.end.y} r={2.6} style={{ fill: color }} />
    </svg>
  );
}

export function Slider({ label, value, min, max, step, onChange, format, left, right, id }: { id: string; label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format: (v: number) => ReactNode; left?: ReactNode; right?: ReactNode }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="fc-slider">
      <div className="fc-slider-top">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id} className="mono">{format(value)}</output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ ['--pct' as string]: `${pct}%` }}
      />
      {(left || right) && (
        <div className="fc-slider-ends">
          <span>{left}</span>
          <span>{right}</span>
        </div>
      )}
    </div>
  );
}
