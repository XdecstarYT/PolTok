/** Projection page extras: published MRP seat projections next to the PolTok model, and Legislative Council polling. */
import { type CSSProperties } from 'react';
import { vicColor, VIC_NAME, type VicLive } from '../vicLive';
import './insights.css';

const SEAT_KEYS = ['ALP', 'LNP', 'GRN', 'ONP', 'IND'] as const;

function SeatStrip({ tally }: { tally: Record<string, number> }) {
  return (
    <div className="mrp-strip" aria-hidden="true">
      {SEAT_KEYS.map((k) => (tally[k] ? <i key={k} style={{ flexGrow: tally[k], background: vicColor(k) }}>{tally[k] >= 4 ? tally[k] : ''}</i> : null))}
      <span className="mrp-strip__45" title="45 for a majority" />
    </div>
  );
}

export function MrpCompare({ data }: { data: VicLive }) {
  const mrp = data.extra?.mrp ?? [];
  const r = data.model?.range;
  if (!mrp.length && !r) return null;
  const ours = r ? Object.fromEntries(SEAT_KEYS.map((k) => [k, Math.round(r[k]?.median ?? 0)])) : null;
  const rows = [...(ours ? [{ firm: 'PolTok model', date: 'live, median of sims', type: 'Model', tally: ours, us: true }] : []),
    ...mrp.map((m) => ({ firm: m.firm, date: m.date, type: m.type, tally: { ALP: m.ALP, LNP: m.LNP, GRN: m.GRN, ONP: m.ONP, IND: m.IND } as Record<string, number>, us: false }))];
  return (
    <div className="mrp">
      {rows.map((x) => (
        <div key={x.firm + x.date} className={`mrp-row ${x.us ? 'is-us' : ''}`}>
          <span className="mrp-who"><b>{x.firm}</b><small>{x.type} · {x.date}</small></span>
          <SeatStrip tally={x.tally} />
          <span className="mrp-nums">{SEAT_KEYS.map((k) => <span key={k} style={{ ['--c' as string]: vicColor(k) } as CSSProperties}><em>{k === 'LNP' ? 'L/NP' : k}</em>{x.tally[k] ?? 0}</span>)}</span>
        </div>
      ))}
      <p className="vp-method">45 seats for a majority (white tick). Published MRP projections from Wikipedia's Victorian polling page; the PolTok row updates with the latest polls.</p>
    </div>
  );
}

const LC_KEYS = ['ALP', 'LNP', 'GRN', 'ONP', 'LCV', 'AJP', 'FFP', 'LBT', 'SFF', 'DLP', 'VS', 'OTH'];
const LC_NAME: Record<string, string> = { ...VIC_NAME, LCV: 'Legalise Cannabis', AJP: 'Animal Justice', FFP: 'Family First', LBT: 'Libertarian', SFF: 'Shooters, Fishers & Farmers', DLP: 'Labour DLP', VS: 'Victorian Socialists', OTH: 'Others' };
const LC_COL: Record<string, string> = { LCV: '#3fae49', AJP: '#0e7c7b', FFP: '#2a4d8f', LBT: '#f4b400', SFF: '#8a6d3b', DLP: '#7a1f2b', VS: '#c0262d', OTH: '#8a8f98' };

export function CouncilCard({ data }: { data: VicLive }) {
  const lc = data.extra?.council?.[0];
  if (!lc) return null;
  const vals = LC_KEYS.map((k) => ({ k, v: typeof lc[k] === 'number' ? (lc[k] as number) : 0 })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
  const max = Math.max(...vals.map((x) => x.v));
  return (
    <div className="lc">
      <p className="lc-lede">The upper house is elected by proportional representation across 8 regions (5 members each, 40 in total, 21 for a majority), so small parties win seats on a few per cent. Latest Legislative Council poll:</p>
      <div className="lc-bars">
        {vals.map(({ k, v }) => (
          <div key={k} className="vx-bar" style={{ ['--c' as string]: LC_COL[k] ?? vicColor(k) } as CSSProperties}>
            <span>{LC_NAME[k] ?? k}</span>
            <span className="vx-bar__track"><i style={{ width: `${(v / max) * 100}%` }} /></span>
            <b className="num">{v}%</b>
          </div>
        ))}
      </div>
      <small className="vx-src">{lc.firm as string} · {lc.date as string}</small>
    </div>
  );
}
