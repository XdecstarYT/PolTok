// Statistics tab: per-turn history as small multiples (one y-axis per chart), with crosshair tooltips and a table view.
import { useState } from 'react';
import type { GameState } from '../engine/types';
import { approvalIndex, MAJORITY, partyColor, partyName, partiesLeftToRight, projectSeats, STAT_LABEL, STATS, yearOf } from './adapter';

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
          {turns.map((t, i) => (n <= 12 || i % Math.ceil(n / 8) === 0 || i === n - 1) && <text key={`${t}-${i}`} x={x(i)} y={H - 6} textAnchor="middle" className="q-chart__ax">{turnLabel(t)}</text>)}
          {c.series.map((s) => <path key={s.key} d={path(s.values)} className={`q-chart__line${s.dashed ? ' is-dashed' : ''}`} style={{ stroke: s.color }} />)}
          {c.series.map((s) => { const last = s.values.reduce<number>((a, v, i) => (v !== null ? i : a), -1); return last >= 0 ? <circle key={s.key} cx={x(last)} cy={y(s.values[last]!)} r="4" className="q-chart__end" style={{ fill: s.color }} /> : null; })}
          {hi !== null && <g><line x1={x(hi)} x2={x(hi)} y1={PT} y2={H - PB} className="q-chart__cross" />{c.series.map((s) => s.values[hi] !== null && <circle key={s.key} cx={x(hi)} cy={y(s.values[hi]!)} r="4.5" className="q-chart__dot" style={{ fill: s.color }} />)}</g>}
        </svg>
        {hi !== null && (
          <div className="q-chart__tip" style={{ left: `${(x(hi) / W) * 100}%` }} role="status">
            <b>{turns[hi] <= 0 ? 'Start of the game' : `End of turn ${turns[hi]} · ${yearOf(turns[hi])}`}</b>
            {c.series.map((s) => s.values[hi] !== null && <span key={s.key}><i style={{ background: s.color }} />{s.label} <b className="q-num">{fmt(s.values[hi]!)}</b></span>)}
          </div>
        )}
      </div>
    </figure>
  );
}

/** One chart row per engine timeline snapshot (`s.timeline`: the start of the game, then each completed turn). */
interface Row { turn: number; approval: number; seats: Record<string, number>; projected: number | null; debt: number; treasury: number; pc: number; stats: Record<string, number> }
function rowsOf(s: GameState): Row[] {
  const tl = s.timeline ?? [];
  const rows: Row[] = tl.map((e) => ({
    turn: e.turn, approval: Math.round(approvalIndex({ ...s, approval: e.approval }) * 10) / 10, seats: e.seats, projected: null,
    debt: e.debt, treasury: e.treasury, pc: e.politicalCapital, stats: e.stats,
  }));
  // the live projection only exists for "now": attach it to the latest point
  if (rows.length && s.phase !== 'over') { try { rows[rows.length - 1].projected = projectSeats(s).player ?? null; } catch { /* ignore */ } }
  return rows;
}
const turnLabel = (t: number) => (t <= 0 ? 'Start' : `T${t}`);

export function StatsView({ s }: { s: GameState }) {
  const [table, setTable] = useState(false);
  const snaps = rowsOf(s);
  if (snaps.length < 2) return <section className="q-card"><p className="q-muted">History builds up as you play. Check back after ending a turn.</p></section>;
  const turns = snaps.map((x) => x.turn);
  const me = s.player.color;
  const debtMax = Math.max(320, ...snaps.map((x) => x.debt + 20));
  const tMax = Math.max(100, ...snaps.map((x) => x.treasury + 10));
  const charts: ChartDef[] = [
    { id: 'appr', title: 'National approval', unit: '0–100', min: 0, max: 100, series: [{ key: 'a', label: 'Approval', color: me, values: snaps.map((x) => x.approval) }] },
    { id: 'seats', title: 'Seats in the Assembly', unit: 'of 72', min: 0, max: 72, refs: [{ y: MAJORITY, label: `${MAJORITY} majority` }],
      series: [...partiesLeftToRight(s).map((p) => ({ key: p, label: partyName(s, p), color: partyColor(s, p), values: snaps.map((x) => x.seats[p] ?? 0) })),
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
            <tbody>{snaps.map((x, i) => <tr key={`${x.turn}-${i}`}><th scope="row">{turnLabel(x.turn)}</th><td>{Math.round(x.approval)}</td><td>{x.seats.player ?? 0}</td><td>{x.projected ?? '—'}</td><td>{Math.round(x.debt)}</td><td>{Math.round(x.treasury)}</td>{STATS.map((k) => <td key={k}>{Math.round(x.stats[k] ?? 0)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
