/** Live Victorian election widgets (data: /api/vic/live). Shared by the home takeover and /au/victoria. */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatedNumber } from '../../components';
import { VIC_KEYS, VIC_NAME, fmtK, vicColor, type VicKey, type VicLive } from './vicLive';
import './vic-live.css';

export const shortFirm = (f: string) => f.split('/')[0].trim();
const fmtDay = (t: number) => new Date(t).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** "Breaking" strip for the newest poll. */
export function NewestPoll({ d }: { d: VicLive }) {
  const n = d.polls?.newest;
  if (!n) return null;
  return (
    <div className="vl-breaking" role="note" aria-label={`Newest poll: ${n.firm}, ${n.date}`}>
      <span className="vl-breaking__tag">New poll</span>
      <span className="vl-breaking__who">{shortFirm(n.firm)} <span className="faint">· {n.date}</span></span>
      <span className="vl-breaking__nums num">
        {VIC_KEYS.map((k) => <b key={k} style={{ color: vicColor(k) }}>{VIC_NAME[k].replace('One Nation', 'ONP').replace('Coalition', 'L/NP')} {n[k]}</b>)}
        {n.tpp && <b className="vl-breaking__tpp">2PP {n.tpp.LNP}–{n.tpp.ALP}</b>}
      </span>
    </div>
  );
}

/** Primary-vote average bars (latest 4 polls). */
export function AverageBars({ d, compact }: { d: VicLive; compact?: boolean }) {
  const a = d.polls?.average;
  if (!a) return null;
  const max = Math.max(...VIC_KEYS.map((k) => a[k]));
  return (
    <ul className={`vl-bars${compact ? ' is-compact' : ''}`} aria-label="Primary vote, average of the latest four polls">
      {[...VIC_KEYS].sort((x, y) => a[y] - a[x]).map((k, i) => (
        <li key={k} style={{ ['--c' as string]: vicColor(k), ['--w' as string]: `${(a[k] / max) * 100}%`, ['--i' as string]: i }}>
          <span className="vl-bars__name">{VIC_NAME[k]}</span>
          <span className="vl-bars__val num"><AnimatedNumber value={a[k]} format={(n) => n.toFixed(1)} />%</span>
          <span className="vl-bars__track"><i /></span>
        </li>
      ))}
    </ul>
  );
}

/** Two-party bar (average of the latest polls that publish a 2PP). */
export function TppBar({ d }: { d: VicLive }) {
  const t = d.polls?.tpp;
  if (!t) return null;
  return (
    <div className="vl-tpp" aria-label={`Two-party preferred average: Coalition ${t.LNP}, Labor ${t.ALP}`}>
      <div className="vl-tpp__labels num"><b style={{ color: vicColor('LNP') }}>Coalition {t.LNP}</b><span className="faint">Two-party · avg of {t.of.length}</span><b style={{ color: vicColor('ALP') }}>Labor {t.ALP}</b></div>
      <div className="vl-tpp__bar"><span style={{ width: `${t.LNP}%`, background: vicColor('LNP') }} /><span style={{ width: `${t.ALP}%`, background: vicColor('ALP') }} /><i aria-hidden="true" /></div>
    </div>
  );
}

/** 88-seat bar: projected seats under a uniform swing vs the 45 line. */
export function ProjectionBar({ d, which = 'after' }: { d: VicLive; which?: 'before' | 'after' }) {
  const p = d.projection;
  if (!p) return null;
  const tally = p[which];
  const order = ['LNP', 'ONP', 'IND', 'GRN', 'ALP'].filter((k) => tally[k]).concat(Object.keys(tally).filter((k) => !['LNP', 'ONP', 'IND', 'GRN', 'ALP'].includes(k)));
  return (
    <div className="vl-seatbar">
      <div className="vl-seatbar__bar" role="img" aria-label={order.map((k) => `${VIC_NAME[k] ?? k} ${tally[k]}`).join(', ') + `. ${p.majority} for a majority.`}>
        {order.map((k) => <span key={k} style={{ flex: tally[k], background: vicColor(k) }} title={`${VIC_NAME[k] ?? k} ${tally[k]}`}><b className="num">{tally[k] >= 4 ? tally[k] : ''}</b></span>)}
        <i style={{ left: `${(p.majority / p.total) * 100}%` }} aria-hidden="true"><em>{p.majority} to win</em></i>
      </div>
      <div className="vl-seatbar__legend">{order.map((k) => <span key={k}><i style={{ background: vicColor(k) }} />{VIC_NAME[k] ?? k} <b className="num">{tally[k]}</b></span>)}</div>
    </div>
  );
}

/** Every poll since February: dots per poll + rolling four-poll average lines. */
export function PollTrend({ d, height = 260, width = 640 }: { d: VicLive; height?: number; width?: number }) {
  const pl = d.polls;
  const [hover, setHover] = useState<number | null>(null);
  const geom = useMemo(() => {
    if (!pl || pl.trend.length < 2) return null;
    const W = width, H = height, padL = 6, padR = 46, padT = 10, padB = 24;
    const t0 = pl.trend[0].t, t1 = pl.trend[pl.trend.length - 1].t || t0 + 1;
    const vals = pl.list.flatMap((p) => VIC_KEYS.map((k) => p[k]));
    const lo = Math.max(0, Math.floor((Math.min(...vals) - 2) / 5) * 5), hi = Math.ceil((Math.max(...vals) + 2) / 5) * 5;
    const x = (t: number) => padL + ((t - t0) / Math.max(1, t1 - t0)) * (W - padL - padR);
    const y = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
    const ticks = []; for (let v = lo; v <= hi; v += 5) ticks.push(v);
    return { W, H, x, y, ticks, padR, padB };
  }, [pl, height, width]);
  if (!pl || !geom) return null;
  const { W, H, x, y, ticks } = geom;
  const last = pl.trend[pl.trend.length - 1];
  const hp = hover != null ? pl.list[hover] : null;
  return (
    <figure className="vl-trend">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Rolling average of ${pl.count} Victorian polls. Latest: ${VIC_KEYS.map((k) => `${VIC_NAME[k]} ${last[k]}`).join(', ')}.`} onMouseLeave={() => setHover(null)}>
        {ticks.map((v) => <g key={v}><line x1={0} x2={W - 40} y1={y(v)} y2={y(v)} className="vl-trend__grid" /><text x={W - 36} y={y(v) + 4} className="vl-trend__tick">{v}%</text></g>)}
        {pl.list.map((p, i) => VIC_KEYS.map((k) => <circle key={k + i} cx={x(p.t)} cy={y(p[k])} r={hover === i ? 4.5 : 2.4} fill={vicColor(k)} opacity={hover === i ? 1 : 0.35} />))}
        {VIC_KEYS.map((k) => (
          <polyline key={k} style={{ color: vicColor(k) }} className="vl-trend__line" points={pl.trend.map((p) => `${x(p.t).toFixed(1)},${y(p[k]).toFixed(1)}`).join(' ')} stroke={vicColor(k)} />
        ))}
        {pl.list.map((p, i) => <rect key={'h' + i} x={x(p.t) - 6} y={0} width={12} height={H} fill="transparent" onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={-1} />)}
        {hp && <line x1={x(hp.t)} x2={x(hp.t)} y1={0} y2={H - 24} className="vl-trend__cursor" />}
        <text x={2} y={H - 6} className="vl-trend__tick">{fmtDay(pl.trend[0].t)}</text>
        <text x={W - 44} y={H - 6} className="vl-trend__tick" textAnchor="end">{fmtDay(last.t)}</text>
      </svg>
      <figcaption className="vl-trend__cap">
        {hp ? (
          <span><b>{shortFirm(hp.firm)}</b> <span className="faint">{hp.date}</span> · {VIC_KEYS.map((k) => <b key={k} style={{ color: vicColor(k) }}> {VIC_NAME[k]} {hp[k]}</b>)}{hp.tpp ? <span className="faint"> · 2PP {hp.tpp.LNP}–{hp.tpp.ALP}</span> : null}</span>
        ) : (
          <span>{VIC_KEYS.map((k) => <span key={k} className="vl-trend__key"><i style={{ background: vicColor(k) }} />{VIC_NAME[k]} <b className="num">{last[k]}</b></span>)}</span>
        )}
      </figcaption>
    </figure>
  );
}

/** VEC early votes: total + daily bars. */
export function EarlyVotes({ d, compact }: { d: VicLive; compact?: boolean }) {
  const e = d.earlyVotes;
  if (!e) return null;
  const max = Math.max(...e.days.map((x) => x.early), 1);
  return (
    <div className={`vl-early${compact ? ' is-compact' : ''}`}>
      <div className="vl-early__total"><b className="num"><AnimatedNumber value={e.total} /></b><span>early votes cast{e.updated ? <span className="faint"> · VEC, {e.updated}</span> : null}</span></div>
      {!compact && (
        <ol className="vl-early__bars" aria-label="Early votes by day">
          {e.days.map((x, i) => (
            <li key={i} title={`${x.day} ${x.date} Nov: ${x.early.toLocaleString()} early votes`} style={{ ['--h' as string]: `${(x.early / max) * 100}%`, ['--i' as string]: i }}>
              <span className="num">{x.early ? fmtK(x.early) : '—'}</span><i /><small>{x.day}<br />{x.date}</small>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Seats closest to the projected swing. */
export function EdgeSeats({ d, limit = 8 }: { d: VicLive; limit?: number }) {
  const p = d.projection;
  if (!p) return null;
  return (
    <ul className="vl-edge">
      {p.edge.slice(0, limit).map((s) => (
        <li key={s.id}>
          <Link to={`/au/seat/${s.id}`} className="vl-edge__name">{s.name}</Link>
          <span className="faint num">Labor by {s.margin}%</span>
          <span className={`vl-edge__stamp ${s.falls ? 'is-falls' : 'is-holds'}`}>{s.falls ? 'Falls' : 'Holds'}</span>
        </li>
      ))}
    </ul>
  );
}

/** Seat-level fills for MapPanel. */
export function projectionFills(d: VicLive | null, which: 'win2022' | 'projected'): Record<string, string> | undefined {
  const s = d?.projection?.seats;
  if (!s) return undefined;
  return Object.fromEntries(Object.entries(s).map(([id, v]) => [id, vicColor(v[which]) + (which === 'projected' && v.projected !== v.win2022 ? '' : 'cc')]));
}

export const keyOf = (k: string) => k as VicKey;
