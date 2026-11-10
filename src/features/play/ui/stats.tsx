// Statistics tab: per-turn history as small multiples (one y-axis per chart), with crosshair tooltips and a table view.
import { useState } from 'react';
import type { GameState } from '../engine/types';
import { MAJORITY, partyColor, partyName, partiesLeftToRight, STAT_LABEL, STATS, yearOf } from './adapter';
import type { Snapshot } from './storage';

interface Series { key: string; label: string; color: string; values: (number | null)[]; dashed?: boolean }
interface ChartDef { id: string; title: string; unit?: string; min: number; max: number; series: Series[]; refs?: { y: number; label: string; tone?: 'bad' | 'neutral' }[]; fmt?: (n: number) => string }

const W = 320, H = 150, PL = 30, PR = 10, PT = 12, PB = 22;

function LineChart({ c, turns }: { c: ChartDef; turns: number[] }) {
  const [hi, setHi] = useState<number | null>(null);
  const n = turns.length;
  const x = (i: number) => PL + (n < 2 ? (W - PL - PR) / 2 : (i * (W - PL - PR)) / (n - 1));
  const y = (v: number) => PT + (1 - (v - c.min) / (c.max - c.min || 1)) * (H - PT - PB);
  const fmt = c.fmt ?? ((v: number) => String(Math.round(v)));
  const ticks = [c.min, (c.min + c.max) / 2, c.max];
  const pick = (clientX: number, el: SVGSVGElement) => {
    const r = el.getBoundingClientRect(); const px = ((clientX - r.left) / r.width) * W;
    let best = 0; for (let i = 0; i < n; i++) if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    setHi(best);
  };
  const path = (vals: (number | null)[]) => { let d = ''; let pen = false; vals.forEach((v, i) => { if (v === null) { pen = false; return; } d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`; pen = true; }); return d; };
  const multi = c.series.length > 1;
  return (
    <figure className="q-chart">
      <figcaption className="q-chart__t"><b>{c.title}</b>{c.unit && <span className="q-muted q-small"> {c.unit}</span>}</figcaption>
      {multi && <ul className="q-chart__legend">{c.series.map((s) => <li key={s.key}><i style={{ background: s.color }} className={s.dashed ? 'is-dashed' : ''} />{s.label}</li>)}</ul>}
      <div className="q-chart__plot">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" tabIndex={0}
          aria-label={`${c.title}: ${c.series.map((s) => `${s.label} ${s.values.filter((v) => v !== null).map((v) => fmt(v!)).join(', ')}`).join('; ')}`}
          onPointerMove={(e) => pick(e.clientX, e.currentTarget)} onPointerDown={(e) => pick(e.clientX, e.currentTarget)} onPointerLeave={(e) => { if (e.pointerType === 'mouse') setHi(null); }}
          onKeyDown={(e) => { if (e.key === 'ArrowRight') { e.preventDefault(); setHi((h) => Math.min(n - 1, (h ?? -1) + 1)); } if (e.key === 'ArrowLeft') { e.preventDefault(); setHi((h) => Math.max(0, (h ?? n) - 1)); } }}
          onBlur={() => setHi(null)}>
          {ticks.map((t) => <g key={t}><line x1={PL} x2={W - PR} y1={y(t)} y2={y(t)} className="q-chart__grid" /><text x={PL - 4} y={y(t) + 3} className="q-chart__ax" textAnchor="end">{fmt(t)}</text></g>)}
          {c.refs?.map((r) => <g key={r.label}><line x1={PL} x2={W - PR} y1={y(r.y)} y2={y(r.y)} className={`q-chart__ref is-${r.tone ?? 'neutral'}`} /><text x={W - PR} y={y(r.y) - 3} textAnchor="end" className="q-chart__reflbl">{r.label}</text></g>)}
          {turns.map((t, i) => (n <= 12 || i % Math.ceil(n / 8) === 0 || i === n - 1) && <text key={t} x={x(i)} y={H - 6} textAnchor="middle" className="q-chart__ax">T{t}</text>)}
          {c.series.map((s) => <path key={s.key} d={path(s.values)} className={`q-chart__line${s.dashed ? ' is-dashed' : ''}`} style={{ stroke: s.color }} />)}
          {c.series.map((s) => { const last = s.values.reduce<number>((a, v, i) => (v !== null ? i : a), -1); return last >= 0 ? <circle key={s.key} cx={x(last)} cy={y(s.values[last]!)} r="4" className="q-chart__end" style={{ fill: s.color }} /> : null; })}
          {hi !== null && <g><line x1={x(hi)} x2={x(hi)} y1={PT} y2={H - PB} className="q-chart__cross" />{c.series.map((s) => s.values[hi] !== null && <circle key={s.key} cx={x(hi)} cy={y(s.values[hi]!)} r="4.5" className="q-chart__dot" style={{ fill: s.color }} />)}</g>}
        </svg>
        {hi !== null && (
          <div className="q-chart__tip" style={{ left: `${(x(hi) / W) * 100}%` }} role="status">
            <b>Turn {turns[hi]} · {yearOf(turns[hi])}</b>
            {c.series.map((s) => s.values[hi] !== null && <span key={s.key}><i style={{ background: s.color }} />{s.label} <b className="q-num">{fmt(s.values[hi]!)}</b></span>)}
          </div>
        )}
      </div>
    </figure>
  );
}

export function StatsView({ s, snaps }: { s: GameState; snaps: Snapshot[] }) {
  const [table, setTable] = useState(false);
  if (snaps.length < 1) return <section className="q-card"><p className="q-muted">History builds up from the first turn you play. Check back after ending a turn.</p></section>;
  const turns = snaps.map((x) => x.turn);
  const me = s.player.color;
  // seats: actual (stepwise between elections) for each party from the election record; projection for you
  const seatAt = (turn: number, p: string) => { const e = [...s.elections].reverse().find((el) => el.turn <= turn); return e ? e.seats[p] ?? 0 : null; };
  const debtMax = Math.max(320, ...snaps.map((x) => x.debt + 20));
  const tMax = Math.max(100, ...snaps.map((x) => x.treasury + 10));
  const charts: ChartDef[] = [
    { id: 'appr', title: 'National approval', unit: '0–100', min: 0, max: 100, series: [{ key: 'a', label: 'Approval', color: me, values: snaps.map((x) => x.approval) }] },
    { id: 'seats', title: 'Seats in the Assembly', unit: 'of 72', min: 0, max: 72, refs: [{ y: MAJORITY, label: `${MAJORITY} majority` }],
      series: [...partiesLeftToRight(s).map((p) => ({ key: p, label: partyName(s, p), color: partyColor(s, p), values: turns.map((t) => seatAt(t, p)) })),
        { key: 'proj', label: 'You, if voted today', color: me, dashed: true, values: snaps.map((x) => x.projected) }] },
    { id: 'debt', title: 'Debt', min: 0, max: Math.ceil(debtMax / 50) * 50, refs: [{ y: 150, label: 'drags economy' }, { y: 300, label: 'bankrupt', tone: 'bad' }], series: [{ key: 'd', label: 'Debt', color: 'var(--q-chart-debt)', values: snaps.map((x) => x.debt) }] },
    { id: 'treas', title: 'Treasury', min: 0, max: Math.ceil(tMax / 50) * 50, series: [{ key: 't', label: 'Treasury', color: 'var(--q-chart-money)', values: snaps.map((x) => x.treasury) }] },
  ];
  return (
    <section className="q-statsview" aria-label="Statistics">
      <div className="q-statsview__head">
        <h2 className="q-h2">Statistics</h2>
        <button className="btn q-btn-sm q-btn-ghost" aria-pressed={table} onClick={() => setTable(!table)}>{table ? 'Show charts' : 'Show table'}</button>
      </div>
      {!table ? (
        <div className="q-charts">{charts.map((c) => <div key={c.id} className="q-card"><LineChart c={c} turns={turns} /></div>)}</div>
      ) : (
        <div className="q-card q-tablewrap">
          <table className="q-table">
            <thead><tr><th scope="col">Turn</th><th scope="col">Approval</th><th scope="col">Seats</th><th scope="col">Projected</th><th scope="col">Debt</th><th scope="col">Treasury</th>{STATS.map((k) => <th key={k} scope="col">{STAT_LABEL[k]}</th>)}</tr></thead>
            <tbody>{snaps.map((x) => <tr key={x.turn}><th scope="row">T{x.turn}</th><td>{Math.round(x.approval)}</td><td>{x.seats}</td><td>{x.projected}</td><td>{Math.round(x.debt)}</td><td>{Math.round(x.treasury)}</td>{STATS.map((k) => <td key={k}>{Math.round(x.stats[k] ?? 0)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
