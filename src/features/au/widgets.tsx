import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { Market, NewsItem } from '../../types';
import { BiasBar, Card, EmptyState, LiveDot, Skeleton, leanCounts, useReducedMotion } from '../../components';
import { fmtDay, fmtTime } from '../../components/time';
import { LEAN_HEX, timeAgo } from '../../lib/format';
import { party, partyKey, pColor, sortParties, type AuSeat, type PollRow } from './model';
import { auPhoto } from '../../data/au-photo';

/* ═════════════ Hemicycle (parliament arc) ═════════════ */

function arcLayout(n: number) {
  const rows = n > 120 ? 8 : n > 80 ? 6 : 5;
  const inner = 0.38;
  const radii = Array.from({ length: rows }, (_, i) => inner + ((1 - inner) * i) / (rows - 1));
  const sum = radii.reduce((a, b) => a + b, 0);
  const per = radii.map((r) => Math.round((n * r) / sum));
  let diff = n - per.reduce((a, b) => a + b, 0);
  for (let i = rows - 1; diff !== 0; i = (i - 1 + rows) % rows) {
    per[i] += Math.sign(diff);
    diff -= Math.sign(diff);
  }
  const pts: { x: number; y: number; a: number }[] = [];
  radii.forEach((r, i) => {
    const k = per[i];
    for (let j = 0; j < k; j++) {
      const a = Math.PI - (k === 1 ? Math.PI / 2 : (Math.PI * j) / (k - 1));
      pts.push({ x: r * Math.cos(a), y: r * Math.sin(a), a });
    }
  });
  pts.sort((p, q) => q.a - p.a || p.y - q.y);
  return { pts, dot: (((1 - inner) / (rows - 1)) * 0.82) / 2 };
}

export function Hemicycle({
  title, total, comp, majority, note, govLabel,
}: { title: string; total: number; comp: [string, number][]; majority: number; note?: ReactNode; govLabel?: string }) {
  const rows = useMemo(() => sortParties(comp.filter(([, v]) => v > 0)), [comp]);
  const seats = useMemo(() => rows.flatMap(([p, v]) => Array.from({ length: v }, () => p)), [rows]);
  const n = Math.max(total, seats.length);
  const { pts, dot } = useMemo(() => arcLayout(n), [n]);
  const [hover, setHover] = useState<string | null>(null);
  const reduce = useReducedMotion();
  return (
    <Card title={title} kicker={govLabel} className="au-hemi">
      <svg viewBox="-1.06 -1.06 2.12 1.14" className="au-hemi-svg" role="img" aria-label={`${title}: ${rows.map(([p, v]) => `${party(p).short} ${v}`).join(', ')}`}>
        {pts.map((p, i) => {
          const pk = seats[i];
          const dim = hover && pk !== hover;
          return (
            <motion.circle
              key={i}
              cx={p.x}
              cy={-p.y}
              r={dot}
              fill={pk ? pColor(pk) : 'var(--bg-4)'}
              opacity={dim ? 0.18 : 1}
              initial={reduce ? false : { opacity: 0, scale: 0.2 }}
              animate={{ opacity: dim ? 0.18 : 1, scale: 1 }}
              transition={{ delay: reduce ? 0 : i * 0.003, duration: 0.25 }}
            />
          );
        })}
        <text x="0" y="-0.12" textAnchor="middle" className="au-hemi-n">{n}</text>
        <text x="0" y="0.0" textAnchor="middle" className="au-hemi-m">{majority} for majority</text>
      </svg>
      <ul className="au-legend" onMouseLeave={() => setHover(null)}>
        {rows.map(([p, v]) => (
          <li key={p} onMouseEnter={() => setHover(p)} onFocus={() => setHover(p)} tabIndex={0}>
            <i style={{ background: pColor(p) }} />
            <span>{party(p).name}</span>
            <b className="num">{v}</b>
          </li>
        ))}
      </ul>
      {note && <p className="au-note">{note}</p>}
    </Card>
  );
}

/* ═════════════ Majority tally bar ═════════════ */

export function TallyBar({ comp, total, majority, label }: { comp: [string, number][]; total: number; majority: number; label?: string }) {
  const rows = sortParties(comp.filter(([, v]) => v > 0));
  return (
    <div className="au-tally">
      {label && <div className="au-tally-l mono">{label}</div>}
      <div className="au-tally-bar" role="img" aria-label={rows.map(([p, v]) => `${p} ${v}`).join(', ')}>
        {rows.map(([p, v]) => (
          <span key={p} style={{ width: `${(v / total) * 100}%`, background: pColor(p) }} title={`${party(p).name} ${v}`}>
            {v / total > 0.06 ? <em>{party(p).short} {v}</em> : null}
          </span>
        ))}
        <b style={{ left: `${(majority / total) * 100}%` }} aria-hidden />
      </div>
      <div className="au-tally-foot mono muted">
        <span>0</span>
        <span style={{ left: `${(majority / total) * 100}%` }}>{majority} majority</span>
        <span>{total}</span>
      </div>
    </div>
  );
}

/* ═════════════ Mackerras pendulum ═════════════ */

export function Pendulum({ seats, gov = 'ALP', title = 'Seat pendulum', results, linkBase = '/au/seat/' }: {
  seats: AuSeat[];
  gov?: 'ALP';
  title?: string;
  results?: Record<string, { leader?: string; called?: string }>;
  linkBase?: string;
}) {
  const [swing, setSwing] = useState(0); // + = swing against government
  const [limit, setLimit] = useState(true);
  const govSeats = seats.filter((s) => partyKey(s.party) === gov && s.margin != null).sort((a, b) => (a.margin ?? 0) - (b.margin ?? 0));
  const oppSeats = seats.filter((s) => partyKey(s.party) !== gov && s.margin != null).sort((a, b) => (a.margin ?? 0) - (b.margin ?? 0));
  const noMargin = seats.filter((s) => s.margin == null);
  const cap = limit ? 14 : 999;
  const max = 12;
  const falls = govSeats.filter((s) => (s.margin ?? 99) < swing).length;
  const gains = oppSeats.filter((s) => (s.margin ?? 99) < -swing).length;
  const col = (list: AuSeat[], side: 'gov' | 'opp') => (
    <ol className={`au-pend-col au-pend-${side}`}>
      {list.slice(0, cap).map((s) => {
        const m = s.margin ?? 0;
        const flips = side === 'gov' ? m < swing : m < -swing;
        const r = results?.[s.id];
        return (
          <li key={s.id} className={flips ? 'is-flip' : ''}>
            <Link to={linkBase + s.id}>
              <span className="au-pend-name">{s.name}</span>
              <span className="au-pend-track">
                <i style={{ width: `${Math.min(100, (m / max) * 100)}%`, background: pColor(s.party) }} />
              </span>
              <span className="num au-pend-m">{m.toFixed(1)}</span>
              {r?.called ? <span className="au-pend-r" style={{ color: pColor(r.called) }}>✓{party(r.called).short}</span> : r?.leader ? <span className="au-pend-r" style={{ color: pColor(r.leader) }}>▸{party(r.leader).short}</span> : null}
            </Link>
          </li>
        );
      })}
    </ol>
  );
  return (
    <Card title={title} kicker="Mackerras-style · margins are 2CP pp above 50" className="au-pend">
      <div className="au-pend-ctl">
        <label className="mono">
          Uniform swing {swing === 0 ? '0.0' : swing > 0 ? `${swing.toFixed(1)} against ALP` : `${(-swing).toFixed(1)} to ALP`}
          <input type="range" min={-8} max={8} step={0.5} value={swing} onChange={(e) => setSwing(+e.target.value)} aria-label="Uniform swing" />
        </label>
        <span className="au-pend-sum mono">
          {swing > 0 ? <><b style={{ color: pColor('ALP') }}>{falls}</b> ALP seats fall</> : swing < 0 ? <><b style={{ color: pColor('ALP') }}>{gains}</b> seats gained by ALP</> : 'Drag to test a swing'}
        </span>
      </div>
      <div className="au-pend-grid">
        <div>
          <h4 className="mono" style={{ color: pColor('ALP') }}>Labor-held · {govSeats.length}</h4>
          {col(govSeats, 'gov')}
        </div>
        <div>
          <h4 className="mono">Non-Labor · {oppSeats.length}</h4>
          {col(oppSeats, 'opp')}
        </div>
      </div>
      <div className="row" style={{ justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <p className="au-note">
          Margins vs the 2-candidate-preferred opponent (not always ALP v Coalition), so a uniform swing is indicative only.
          {noMargin.length ? ` ${noMargin.length} seat(s) without a verified margin omitted.` : ''}
        </p>
        <button type="button" className="au-btn" onClick={() => setLimit((v) => !v)}>
          {limit ? 'Show all seats' : 'Show marginals only'}
        </button>
      </div>
    </Card>
  );
}

/* ═════════════ Polls ═════════════ */

const SERIES = ['ALP', 'LNP', 'ONP', 'GRN', 'OTH'] as const;
const SERIES_NAME: Record<string, string> = { ALP: 'Labor', LNP: 'Coalition', ONP: 'One Nation', GRN: 'Greens', OTH: 'Others' };

export function PollsPanel({ polls, title, kicker }: { polls: PollRow[]; title: string; kicker?: string }) {
  const [tab, setTab] = useState<'chart' | 'table'>('chart');
  if (!polls.length) return <Card title={title}><EmptyState title="No polls yet" /></Card>;
  const asc = [...polls].reverse();
  const t0 = asc[0].ts, t1 = asc[asc.length - 1].ts || t0 + 1;
  const W = 600, H = 220, P = { l: 30, r: 74, t: 10, b: 22 };
  const vals = asc.flatMap((p) => SERIES.map((k) => p.primary[k]).filter((v): v is number => v != null));
  const yMax = Math.ceil((Math.max(35, ...vals) + 2) / 5) * 5;
  const x = (ts: number) => P.l + ((ts - t0) / Math.max(1, t1 - t0)) * (W - P.l - P.r);
  const y = (v: number) => P.t + (1 - v / yMax) * (H - P.t - P.b);
  // 7-poll-ish smoothing: average of polls within ±10 days
  const smooth = (k: string) =>
    asc
      .map((p) => {
        const near = asc.filter((q) => Math.abs(q.ts - p.ts) <= 10 * 864e5 && q.primary[k] != null);
        if (!near.length) return null;
        return { ts: p.ts, v: near.reduce((a, q) => a + (q.primary[k] as number), 0) / near.length };
      })
      .filter((v): v is { ts: number; v: number } => v != null);
  const latest = polls[0];
  const tpps = polls.filter((p) => p.tpp.ALP != null);
  const tppAvg = tpps.length ? tpps.slice(0, 5).reduce((a, p) => a + (p.tpp.ALP as number), 0) / Math.min(5, tpps.length) : null;
  const lines = SERIES.map((k) => ({ k, pts: smooth(k) })).filter((s) => s.pts.length);
  const labelY: Record<string, number> = {};
  [...lines].sort((a, b) => b.pts[b.pts.length - 1].v - a.pts[a.pts.length - 1].v).forEach((s, i, arr) => {
    let ly = y(s.pts[s.pts.length - 1].v);
    const prev = i ? labelY[arr[i - 1].k] : -99;
    if (ly - prev < 13) ly = prev + 13;
    labelY[s.k] = ly;
  });
  return (
    <Card
      title={title}
      kicker={kicker}
      className="au-polls"
      action={
        <div className="au-seg" role="tablist">
          {(['chart', 'table'] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} type="button">{t}</button>
          ))}
        </div>
      }
    >
      <div className="au-poll-top">
        {SERIES.map((k) => {
          const avg = polls.slice(0, 5).filter((p) => p.primary[k] != null);
          if (!avg.length) return null;
          const v = avg.reduce((a, p) => a + (p.primary[k] as number), 0) / avg.length;
          return (
            <div key={k} className="au-poll-stat">
              <span className="mono" style={{ color: pColor(k) }}>{SERIES_NAME[k]}</span>
              <b className="num">{v.toFixed(1)}</b>
            </div>
          );
        })}
        {tppAvg != null && (
          <div className="au-poll-stat au-poll-tpp">
            <span className="mono">2PP ALP v L/NP</span>
            <b className="num">{tppAvg.toFixed(1)}–{(100 - tppAvg).toFixed(1)}</b>
          </div>
        )}
      </div>
      {tab === 'chart' ? (
        <svg viewBox={`0 0 ${W} ${H}`} className="au-poll-svg" role="img" aria-label={`Primary vote trend; latest ${latest.pollster} ${latest.date}`}>
          {[0, 10, 20, 30, 40].filter((v) => v <= yMax).map((v) => (
            <g key={v}>
              <line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} className="au-grid" />
              <text x={P.l - 6} y={y(v) + 3} textAnchor="end" className="au-axis">{v}</text>
            </g>
          ))}
          {[t0, t1].map((t, i) => (
            <text key={i} x={x(t)} y={H - 6} textAnchor={i ? 'end' : 'start'} className="au-axis">{fmtDay(t, 'short')}</text>
          ))}
          {lines.map(({ k, pts }) => (
            <g key={k}>
              {asc.map((p, i) => (p.primary[k] != null ? <circle key={i} cx={x(p.ts)} cy={y(p.primary[k])} r={2.4} fill={pColor(k)} opacity={0.35} /> : null))}
              <motion.path
                d={pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.ts).toFixed(1)},${y(p.v).toFixed(1)}`).join('')}
                fill="none"
                stroke={pColor(k)}
                strokeWidth={k === 'ONP' ? 3 : 2}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.9 }}
              />
              <text x={W - P.r + 6} y={labelY[k] + 3} className="au-axis" fill={pColor(k)} style={{ fill: pColor(k) }}>
                {party(k).short} {pts[pts.length - 1].v.toFixed(0)}
              </text>
            </g>
          ))}
        </svg>
      ) : (
        <div className="au-table-wrap">
          <table className="au-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Pollster</th>
                {SERIES.map((k) => <th key={k} style={{ color: pColor(k) }}>{party(k).short}</th>)}
                <th>2PP</th>
              </tr>
            </thead>
            <tbody>
              {polls.map((p, i) => (
                <tr key={i}>
                  <td className="num">{p.date.slice(5)}</td>
                  <td>{p.pollster}</td>
                  {SERIES.map((k) => <td key={k} className="num">{p.primary[k] ?? '—'}</td>)}
                  <td className="num">{p.tpp.ALP != null ? `${p.tpp.ALP}–${p.tpp.LNP}` : p.tpp.label ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="au-note">
        Lines are a ±10-day average of published polls; dots are individual polls. Latest: {latest.pollster}, {latest.date}.
        {polls.some((p) => p.tpp.label) ? ` ${polls.find((p) => p.tpp.label)?.tpp.label} (${polls.find((p) => p.tpp.label)?.pollster}).` : ''}
      </p>
    </Card>
  );
}

/* ═════════════ Markets ═════════════ */

export function MarketsPanel({ markets, error, filter, title = 'Prediction markets' }: { markets: Market[] | null; error?: boolean; filter?: (m: Market) => boolean; title?: string }) {
  const list = (markets ?? []).filter((m) => (filter ? filter(m) : true));
  return (
    <Card title={title} live={!!markets?.length} kicker="Polymarket · live, 60s">
      {!markets && !error ? (
        <div className="stack" style={{ gap: 8 }}>
          <Skeleton height={44} />
          <Skeleton height={44} />
        </div>
      ) : !list.length ? (
        <EmptyState title={error ? 'Markets unavailable' : 'No matching markets'} description={error ? 'The Polymarket feed could not be reached. Retrying.' : undefined} />
      ) : (
        <ul className="au-mkts">
          {list.slice(0, 8).map((m) => (
            <li key={m.id}>
              <a href={m.url} target="_blank" rel="noreferrer" className="au-mkt-q">{m.question}</a>
              <div className="au-mkt-outs">
                {[...m.outcomes].sort((a, b) => b.prob - a.prob).slice(0, 3).map((o) => (
                  <div key={o.label} className="au-mkt-o">
                    <span>{o.label}</span>
                    <span className="au-mkt-bar"><i style={{ width: `${o.prob * 100}%`, background: o.color ?? guessColor(o.label) }} /></span>
                    <b className="num">{(o.prob * 100).toFixed(o.prob < 0.1 ? 1 : 0)}%</b>
                  </div>
                ))}
              </div>
              {m.volume ? <span className="au-mkt-v mono muted">${Math.round(m.volume).toLocaleString()} vol</span> : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
function guessColor(label: string) {
  const l = label.toLowerCase();
  if (/labor|alp|carroll|albanese|minns|allan/.test(l)) return pColor('ALP');
  if (/liberal|coalition|lib|wilson|taylor|nat/.test(l)) return pColor('LIB');
  if (/one nation|hanson|onp/.test(l)) return pColor('ONP');
  if (/green/.test(l)) return pColor('GRN');
  if (/^yes/.test(l)) return 'var(--accent)';
  return 'var(--text-3)';
}

/* ═════════════ News ═════════════ */

export function NewsPanel({ items, error, title = 'Australian news', limit = 10, emptyNote }: { items: NewsItem[] | null; error?: boolean; title?: string; limit?: number; emptyNote?: string }) {
  const counts = useMemo(() => leanCounts(items ?? []), [items]);
  return (
    <Card title={title} live={!!items?.length} kicker="AU outlets · refreshed every 2 min" className="au-news">
      {items && items.length > 0 && (
        <div className="au-news-bias">
          <span className="mono muted">Coverage mix</span>
          <BiasBar counts={counts} height={6} />
        </div>
      )}
      {!items && !error ? (
        <div className="stack" style={{ gap: 8 }}>
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} height={48} />)}
        </div>
      ) : !items?.length ? (
        <EmptyState title={error ? 'News feed unavailable' : 'No stories'} description={emptyNote} />
      ) : (
        <ul className="au-news-list">
          {items.slice(0, limit).map((n) => (
            <li key={n.id}>
              <span className="au-lean" style={{ background: LEAN_HEX[n.sourceLean] ?? 'var(--text-4)' }} title={n.sourceLean} />
              <div>
                <a href={n.url} target="_blank" rel="noreferrer">{n.title}</a>
                <div className="au-news-meta mono">
                  <span>{n.source}</span>
                  <span className="muted">· {n.sourceLean}</span>
                  <span className="muted" title={fmtTime(n.publishedAt)}>· {timeAgo(n.publishedAt)}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ═════════════ Misc ═════════════ */

export function LeaderCard({ role, name, partyCode, seat, extra }: { role: string; name: string; partyCode?: string; seat?: string; extra?: ReactNode }) {
  const c = pColor(partyCode);
  const ph = auPhoto(name);
  const initials = name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('');
  return (
    <div className="au-leader" style={{ ['--pc' as string]: c }}>
      <span className="au-leader-av" aria-hidden title={ph?.credit}>{ph ? <img src={ph.thumbUrl} alt="" width={46} height={46} loading="lazy" /> : initials}</span>
      <div>
        <span className="mono au-leader-role">{role}</span>
        <b>{name}</b>
        <span className="muted au-leader-sub">{partyCode ? party(partyCode).name : ''}{seat ? ` · ${seat}` : ''}</span>
        {extra}
        {ph && <a className="au-leader-credit" href={ph.sourcePage} target="_blank" rel="noopener noreferrer">{ph.credit}</a>}
      </div>
    </div>
  );
}

export function FeedStatus({ updated, error, label }: { updated: number | null; error: boolean; label: string }) {
  return (
    <span className={`au-feed mono ${error ? 'is-err' : ''}`}>
      {error ? '● ' : <LiveDot label="" />} {label}
      {updated ? ` · ${fmtTime(updated, true)}` : error ? ' · retrying' : ' · connecting…'}
    </span>
  );
}
