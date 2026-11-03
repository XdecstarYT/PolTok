// Local building blocks for the Races & States feature.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { line as d3line, curveMonotoneX } from 'd3-shape';
import type { NewsItem, PollSeries, Race, RaceResult, StateInfo } from '../../types';
import { Avatar, PartyDot, RatingBadge, SimBadge } from '../../components';
import { fmtInt, LEAN_HEX, PARTY_COLOR, PARTY_HEX, PARTY_NAME, RATING_HEX, timeAgo } from '../../lib/format';
import { RACES, stateByAbbr } from '../../data';
import {
  demMargin,
  fmtSignedMargin,
  headlinePair,
  isFlip,
  leaderOf,
  longTitle,
  presMargin,
  sharesOf,
  shortLabel,
  statusText,
  suggest,
  totalVotes,
} from './util';

/* ---------------- AnimatedNum ---------------- */

export function AnimatedNum({ value, format = fmtInt, duration = 700 }: { value: number; format?: (n: number) => string; duration?: number }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (reduce) {
      setShown(value);
      from.current = value;
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / duration);
      const e = 1 - Math.pow(1 - k, 3);
      const v = a + (value - a) * e;
      setShown(v);
      from.current = v;
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, reduce]);
  return <span className="mono">{format(shown)}</span>;
}

/* ---------------- Win-probability needle ---------------- */

const NEEDLE_ZONES = [
  { to: 0.05, color: PARTY_HEX.D, label: 'Very likely' },
  { to: 0.2, color: '#5f93ff', label: 'Likely' },
  { to: 0.35, color: '#9cbaff', label: 'Lean' },
  { to: 0.65, color: '#e9e3c9', label: 'Toss-up' },
  { to: 0.8, color: '#ffa3b0', label: 'Lean' },
  { to: 0.95, color: '#ff6b7f', label: 'Likely' },
  { to: 1, color: PARTY_HEX.R, label: 'Very likely' },
];

/** NYT-style needle. `right` = probability the right-hand (usually R) candidate wins (0..1). */
export function Needle({
  right,
  leftLabel,
  rightLabel,
  leftColor = PARTY_HEX.D,
  rightColor = PARTY_HEX.R,
  jitter = true,
}: {
  right: number | undefined;
  leftLabel: string;
  rightLabel: string;
  leftColor?: string;
  rightColor?: string;
  jitter?: boolean;
}) {
  const reduce = useReducedMotion();
  const p = right === undefined ? 0.5 : Math.max(0, Math.min(1, right));
  const angle = -90 + p * 180;
  const cx = 150;
  const cy = 150;
  const R = 120;
  const arc = (a0: number, a1: number) => {
    const t0 = Math.PI * (1 - a0);
    const t1 = Math.PI * (1 - a1);
    const x0 = cx + R * Math.cos(t0);
    const y0 = cy - R * Math.sin(t0);
    const x1 = cx + R * Math.cos(t1);
    const y1 = cy - R * Math.sin(t1);
    return `M${x0},${y0} A${R},${R} 0 0 1 ${x1},${y1}`;
  };
  let prev = 0;
  const leftPct = Math.round((1 - p) * 100);
  const rightPct = 100 - leftPct;
  const fav = right === undefined ? null : p > 0.5 ? 'right' : p < 0.5 ? 'left' : null;
  return (
    <div className="rx-needle" role="img" aria-label={right === undefined ? 'Win probability not yet available' : `Win probability: ${leftLabel} ${leftPct}%, ${rightLabel} ${rightPct}%`}>
      <svg viewBox="0 0 300 170">
        {NEEDLE_ZONES.map((z, i) => {
          const d = arc(prev, z.to);
          prev = z.to;
          return <path key={i} d={d} stroke={i === 0 ? leftColor : i === NEEDLE_ZONES.length - 1 ? rightColor : z.color} strokeWidth={22} fill="none" opacity={0.85} />;
        })}
        {[0.25, 0.5, 0.75].map((t) => {
          const th = Math.PI * (1 - t);
          return <line key={t} x1={cx + (R - 16) * Math.cos(th)} y1={cy - (R - 16) * Math.sin(th)} x2={cx + (R + 14) * Math.cos(th)} y2={cy - (R + 14) * Math.sin(th)} stroke="var(--bg)" strokeWidth={2} />;
        })}
        <motion.g
          initial={{ rotate: 0 }}
          animate={{ rotate: angle }}
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 60, damping: 9 }}
          style={{ originX: `${cx}px`, originY: `${cy}px` }}
        >
          <g className={jitter && right !== undefined && !reduce ? 'rx-needle-jit' : ''} style={{ transformOrigin: `${cx}px ${cy}px` }}>
            <path d={`M${cx - 5},${cy} L${cx},${cy - R + 6} L${cx + 5},${cy} Z`} fill="var(--text)" />
          </g>
        </motion.g>
        <circle cx={cx} cy={cy} r={11} fill="var(--bg-2)" stroke="var(--text)" strokeWidth={2} />
      </svg>
      <div className="rx-needle-legend">
        <div style={{ color: leftColor }} className={fav === 'left' ? 'is-fav' : ''}>
          <b className="mono">{right === undefined ? '—' : `${leftPct}%`}</b>
          <span>{leftLabel}</span>
        </div>
        <div className="rx-needle-mid">{right === undefined ? 'Model warms up when votes arrive' : zoneLabel(p)}</div>
        <div style={{ color: rightColor }} className={fav === 'right' ? 'is-fav' : ''}>
          <b className="mono">{right === undefined ? '—' : `${rightPct}%`}</b>
          <span>{rightLabel}</span>
        </div>
      </div>
    </div>
  );
}

function zoneLabel(p: number) {
  const z = NEEDLE_ZONES.find((z) => p <= z.to) ?? NEEDLE_ZONES[3];
  if (z.label === 'Toss-up') return 'Toss-up';
  return `${z.label} ${p < 0.5 ? '←' : '→'}`;
}

/* ---------------- Expected vote meter ---------------- */

export function ExpectedMeter({ pct, compact }: { pct: number; compact?: boolean }) {
  const v = Math.max(0, Math.min(100, pct || 0));
  return (
    <div className={`rx-meter ${compact ? 'is-compact' : ''}`}>
      {!compact && (
        <div className="rx-meter-head">
          <span>Est. expected vote counted</span>
          <b className="mono">{v < 1 && v > 0 ? '<1' : Math.round(v)}%</b>
        </div>
      )}
      <div className="rx-meter-track" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v)} aria-label="Expected vote counted">
        <motion.div className="rx-meter-fill" initial={false} animate={{ width: `${v}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} />
        {!compact && [25, 50, 75].map((t) => <i key={t} style={{ left: `${t}%` }} />)}
      </div>
    </div>
  );
}

/* ---------------- Result rows ---------------- */

export function ResultRows({ race, result, big }: { race: Race; result?: RaceResult; big?: boolean }) {
  const shares = sharesOf(race, result);
  const counted = totalVotes(result) > 0;
  if (!shares.length) return <p className="rx-muted">Candidates TBD.</p>;
  return (
    <ul className={`rx-rows ${big ? 'is-big' : ''}`}>
      {shares.map((s) => {
        const won = result?.calledFor === s.cand.id;
        return (
          <li key={s.cand.id} className={won ? 'is-won' : ''} style={{ ['--pc' as string]: PARTY_HEX[s.cand.party] ?? PARTY_HEX.O }}>
            <div className="rx-row-top">
              <span className="rx-row-name">
                {big && <Avatar name={s.cand.name} party={s.cand.party} src={s.cand.photo} size={34} />}
                <span>
                  <b>{s.cand.name}</b>
                  {won && <span className="rx-check" aria-label="Projected winner">✓</span>}
                  <small>
                    {PARTY_NAME[s.cand.party]}
                    {s.cand.incumbent ? ' · Incumbent' : ''}
                  </small>
                </span>
              </span>
              <span className="rx-row-num">
                <b className="mono">{counted ? <AnimatedNum value={s.pct} format={(n) => `${n.toFixed(1)}%`} /> : '—'}</b>
                <small className="mono">{counted ? <AnimatedNum value={s.votes} /> : '0'} votes</small>
              </span>
            </div>
            <div className="rx-row-bar">
              <motion.span initial={false} animate={{ width: `${s.pct}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------------- Board chip ---------------- */

export function RaceChip({ race, result }: { race: Race; result?: RaceResult }) {
  const lead = leaderOf(race, result);
  const flip = isFlip(race, result);
  const stripe = lead ? PARTY_HEX[lead.cand.party] : 'transparent';
  const label = `${longTitle(race)}, rated ${race.rating}${lead ? `, ${lead.called ? 'called for' : 'leading:'} ${lead.cand.name}` : ''}${flip ? ', flip' : ''}`;
  return (
    <Link to={`/race/${race.id}`} className={`rx-chip ${lead?.called ? 'is-called' : ''} ${race.key ? 'is-key' : ''}`} style={{ ['--stripe' as string]: stripe }} aria-label={label} title={label}>
      <span className="rx-chip-id mono">{shortLabel(race)}</span>
      {lead?.called && <span className="rx-chip-check" style={{ background: stripe }} aria-hidden>✓</span>}
      {flip && <span className="rx-chip-flip">FLIP</span>}
      <span className="rx-chip-sub">
        {race.open ? 'Open' : `${incLast(race)}`}
        {lead && !lead.called && <span className="mono" style={{ color: stripe }}> · {lead.cand.party}+{lead.marginPct.toFixed(0)}</span>}
      </span>
    </Link>
  );
}

function incLast(race: Race) {
  const inc = race.candidates?.find((c) => c.incumbent);
  if (!inc) return `${race.incumbentParty} held`;
  const parts = inc.name.split(/\s+/);
  return `${parts[parts.length - 1]} (${inc.party})`;
}

/* ---------------- Live race card ---------------- */

export function RaceCard({ race, result }: { race: Race; result?: RaceResult }) {
  const st = stateByAbbr.get(race.state);
  const lead = leaderOf(race, result);
  const flip = isFlip(race, result);
  const glow = lead ? PARTY_HEX[lead.cand.party] : RATING_HEX[race.rating] ?? '#888';
  const shares = sharesOf(race, result).slice(0, 3);
  const counted = totalVotes(result) > 0;
  return (
    <Link to={`/race/${race.id}`} className={`rx-card ${lead?.called ? 'is-called' : ''}`} style={{ ['--glow' as string]: glow }}>
      <header>
        <div>
          <span className="rx-kicker">{race.chamber === 'house' ? 'House' : race.chamber === 'senate' ? (race.special ? 'Senate · Special' : 'Senate') : 'Governor'}</span>
          <h4>{longTitle(race)}</h4>
        </div>
        <RatingBadge rating={race.rating} />
      </header>
      <ul className="rx-mini-rows">
        {shares.map((s) => (
          <li key={s.cand.id}>
            <PartyDot party={s.cand.party} />
            <span className="rx-mini-name">
              {s.cand.name}
              {s.cand.incumbent && <em title="Incumbent">INC</em>}
              {result?.calledFor === s.cand.id && <span className="rx-check">✓</span>}
            </span>
            <b className="mono">{counted ? `${s.pct.toFixed(1)}%` : ''}</b>
            <span className="rx-mini-bar" style={{ ['--pc' as string]: PARTY_COLOR[s.cand.party] }}>
              <motion.i initial={false} animate={{ width: `${s.pct}%` }} />
            </span>
          </li>
        ))}
      </ul>
      <footer>
        <span className={`rx-status s-${result?.status ?? 'not-started'}`}>{statusText(result, st)}</span>
        {flip && <span className="rx-flip">FLIP</span>}
        {result && result.expectedPct > 0 && <span className="mono rx-muted">{Math.round(result.expectedPct)}% in</span>}
      </footer>
      {result && result.expectedPct > 0 && <ExpectedMeter pct={result.expectedPct} compact />}
    </Link>
  );
}

/* ---------------- 2024 presidential bar ---------------- */

export function PresBar({ st, current }: { st: StateInfo; current?: number }) {
  const d = st.pres2024?.dem ?? 0;
  const r = st.pres2024?.rep ?? 0;
  const tot = d + r || 1;
  const m = presMargin(st);
  return (
    <div className="rx-pres">
      <div className="rx-pres-head">
        <span>2024 President</span>
        <b className="mono" style={{ color: m >= 0 ? 'var(--dem)' : 'var(--rep)' }}>
          {m >= 0 ? 'Harris' : 'Trump'} {fmtSignedMargin(m)}
        </b>
      </div>
      <div className="rx-pres-bar" aria-label={`2024: Harris ${d.toFixed(1)}%, Trump ${r.toFixed(1)}%`}>
        <span style={{ width: `${(d / tot) * 100}%`, background: 'var(--dem)' }}>
          <small className="mono">{d.toFixed(1)}</small>
        </span>
        <span style={{ width: `${(r / tot) * 100}%`, background: 'var(--rep)' }}>
          <small className="mono">{r.toFixed(1)}</small>
        </span>
        <i />
      </div>
      {current !== undefined && (
        <div className="rx-pres-cmp">
          <span>Tonight's margin</span>
          <b className="mono" style={{ color: current >= 0 ? 'var(--dem)' : 'var(--rep)' }}>
            {fmtSignedMargin(current)}
          </b>
          <span className="rx-muted mono">
            ({current - m >= 0 ? 'D' : 'R'} shift {Math.abs(current - m).toFixed(1)} pts vs 2024)
          </span>
        </div>
      )}
    </div>
  );
}

/* ---------------- Polls ---------------- */

export function PollPanel({ series }: { series: PollSeries }) {
  const polls = useMemo(() => [...(series.polls ?? [])].sort((a, b) => a.date.localeCompare(b.date)), [series]);
  const keys = series.keys ?? [];
  const W = 560;
  const H = 180;
  const pad = { l: 30, r: 12, t: 12, b: 22 };
  if (!polls.length) return <p className="rx-muted">No public polls on file for this race.</p>;
  const ts = polls.map((p) => Date.parse(p.date));
  const t0 = Math.min(...ts);
  const t1 = Math.max(...ts);
  const vals = polls.flatMap((p) => keys.map((k) => p.values[k.key]).filter((v): v is number => typeof v === 'number'));
  const lo = Math.floor((Math.min(...vals) - 3) / 5) * 5;
  const hi = Math.ceil((Math.max(...vals) + 3) / 5) * 5;
  const x = (t: number) => pad.l + (t1 === t0 ? 0.5 : (t - t0) / (t1 - t0)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo || 1)) * (H - pad.t - pad.b);
  // rolling average (last 4 polls) per key
  const avg = (k: string) =>
    polls.map((_, i) => {
      const win = polls.slice(Math.max(0, i - 3), i + 1).map((p) => p.values[k]).filter((v): v is number => typeof v === 'number');
      return [x(ts[i]), y(win.reduce((s, v) => s + v, 0) / (win.length || 1))] as [number, number];
    });
  const gen = d3line<[number, number]>().curve(curveMonotoneX);
  const ticks: number[] = [];
  for (let v = lo; v <= hi; v += 5) ticks.push(v);
  const latest = polls[polls.length - 1];
  return (
    <div className="rx-polls">
      <div className="rx-polls-legend">
        {keys.map((k) => (
          <span key={k.key}>
            <i style={{ background: k.color }} /> {k.label}
            {latest?.values[k.key] !== undefined && <b className="mono"> {latest.values[k.key]}%</b>}
          </span>
        ))}
        <span className="rx-muted">Line = 4-poll average</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="rx-polls-chart" role="img" aria-label={`Poll trend: ${series.title}`}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--line)" />
            <text x={pad.l - 6} y={y(v)} fill="var(--text-3)" fontSize={10} textAnchor="end" dominantBaseline="middle" className="mono">
              {v}
            </text>
          </g>
        ))}
        {keys.map((k) =>
          polls.map((p, i) =>
            typeof p.values[k.key] === 'number' ? <circle key={k.key + i} cx={x(ts[i])} cy={y(p.values[k.key])} r={3} fill={k.color} opacity={0.35} /> : null,
          ),
        )}
        {keys.map((k) => (
          <path key={k.key} d={gen(avg(k.key)) ?? ''} stroke={k.color} strokeWidth={2.5} fill="none" />
        ))}
        <text x={pad.l} y={H - 4} fill="var(--text-3)" fontSize={10} className="mono">
          {polls[0].date}
        </text>
        <text x={W - pad.r} y={H - 4} fill="var(--text-3)" fontSize={10} textAnchor="end" className="mono">
          {latest.date}
        </text>
      </svg>
      <div className="rx-table-wrap">
        <table className="rx-ptable">
          <thead>
            <tr>
              <th>Pollster</th>
              <th>Date</th>
              <th className="hide-sm">Sample</th>
              {keys.map((k) => (
                <th key={k.key} className="num">
                  {k.label}
                </th>
              ))}
              <th className="num">Net</th>
            </tr>
          </thead>
          <tbody>
            {[...polls].reverse().slice(0, 10).map((p, i) => {
              const a = keys[0] ? p.values[keys[0].key] : undefined;
              const b = keys[1] ? p.values[keys[1].key] : undefined;
              const net = a !== undefined && b !== undefined ? a - b : undefined;
              return (
                <tr key={i}>
                  <td>
                    {p.pollster}
                    {p.grade && <small className="rx-grade">{p.grade}</small>}
                  </td>
                  <td className="mono">{p.date.slice(5)}</td>
                  <td className="mono hide-sm">{p.sample ? `${fmtInt(p.sample)} ${p.population ?? ''}` : '—'}</td>
                  {keys.map((k) => (
                    <td key={k.key} className="mono num">
                      {p.values[k.key] ?? '—'}
                    </td>
                  ))}
                  <td className="mono num" style={{ color: net === undefined ? undefined : net >= 0 ? keys[0]?.color : keys[1]?.color }}>
                    {net === undefined ? '—' : net === 0 ? 'Tie' : `${net > 0 ? keys[0].label.split(' ').pop() : keys[1].label.split(' ').pop()} +${Math.abs(net)}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- News ---------------- */

export function NewsList({ items, empty }: { items: NewsItem[]; empty: string }) {
  if (!items.length) return <p className="rx-muted">{empty}</p>;
  return (
    <ul className="rx-news">
      {items.map((n) => (
        <li key={n.id}>
          <a href={n.url} target="_blank" rel="noopener noreferrer">
            <span className="rx-news-src">
              <i style={{ background: LEAN_HEX[n.sourceLean] ?? LEAN_HEX.Unrated }} title={`Source lean: ${n.sourceLean}`} />
              {n.source}
              <span className="rx-muted"> · {n.sourceLean} · {timeAgo(n.publishedAt)}</span>
              {n.breaking && <em>BREAKING</em>}
            </span>
            <b>{n.title}</b>
            <span className="rx-news-out" aria-hidden>↗</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

/* ---------------- Status / called banner ---------------- */

export function CallBanner({ race, result }: { race: Race; result?: RaceResult }) {
  const winner = result?.calledFor ? race.candidates?.find((c) => c.id === result.calledFor) : undefined;
  const flip = isFlip(race, result);
  const st = stateByAbbr.get(race.state);
  const key = winner ? `w-${winner.id}` : result?.status ?? 'none';
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={key}
        className={`rx-banner ${winner ? 'is-called' : `s-${result?.status ?? 'not-started'}`}`}
        style={winner ? { ['--pc' as string]: PARTY_HEX[winner.party] } : undefined}
        initial={{ opacity: 0, y: -10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.35 }}
        role="status"
        aria-live="polite"
      >
        {winner ? (
          <>
            <span className="rx-banner-k">Projected winner</span>
            <b>
              <span className="rx-check big">✓</span> {winner.name} ({winner.party})
            </b>
            {flip && <span className="rx-flip big">{race.incumbentParty} → {winner.party} FLIP</span>}
            {!flip && <span className="rx-hold">{winner.party} HOLD</span>}
            {result?.calledAt && <span className="rx-muted mono">called {timeAgo(result.calledAt)}</span>}
          </>
        ) : (
          <>
            <span className={`rx-pulse s-${result?.status ?? 'not-started'}`} aria-hidden />
            <b>{statusText(result, st)}</b>
            {result?.reportingNote && result.reportingNote !== statusText(result, st) && <span className="rx-muted">{result.reportingNote}</span>}
          </>
        )}
        <span style={{ marginLeft: 'auto' }}>
          <SimBadge />
        </span>
      </motion.div>
    </AnimatePresence>
  );
}

/* ---------------- Share ---------------- */

export function ShareButton({ title }: { title: string }) {
  const [done, setDone] = useState(false);
  const onClick = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setDone(true);
      setTimeout(() => setDone(false), 1800);
    } catch {
      /* user cancelled */
    }
  };
  return (
    <button className="rx-btn" onClick={onClick} aria-label={`Share ${title}`}>
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v14" />
      </svg>
      {done ? 'Link copied' : 'Share'}
    </button>
  );
}

/* ---------------- 404 ---------------- */

export function NotFound({ kind, query }: { kind: 'race' | 'state'; query: string }) {
  const [q, setQ] = useState(query.replace(/[-_]/g, ' '));
  const hits = suggest(q, 8);
  return (
    <div className="page rx-404">
      <div className="rx-404-code mono">404</div>
      <h1>
        No {kind} found for <span className="mono">“{query}”</span>
      </h1>
      <p className="rx-muted">
        {kind === 'race' ? 'Race ids look like PA-SEN, OH-SEN-S, PA-GOV or PA-07.' : 'Use a two-letter state code like PA or GA.'} Try a search:
      </p>
      <input className="rx-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a state, race or candidate…" aria-label="Search races and states" autoFocus />
      {hits.length > 0 ? (
        <ul className="rx-suggest">
          {hits.map((h) => (
            <li key={h.to}>
              <Link to={h.to}>
                <b>{h.label}</b>
                <span className="rx-muted">{h.sub}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <>
          <p className="rx-muted">No matches. Key races tonight:</p>
          <ul className="rx-suggest">
            {RACES.filter((r) => r.key)
              .slice(0, 6)
              .map((r) => (
                <li key={r.id}>
                  <Link to={`/race/${r.id}`}>
                    <b>{longTitle(r)}</b>
                    <span className="rx-muted">{r.rating}</span>
                  </Link>
                </li>
              ))}
          </ul>
        </>
      )}
      <p>
        <Link className="rx-btn" to="/races">
          ← Race ratings board
        </Link>
      </p>
    </div>
  );
}

/* ---------------- Misc ---------------- */

export function MarginPill({ race, result }: { race: Race; result?: RaceResult }) {
  const m = demMargin(race, result);
  if (m === undefined) return <span className="rx-muted">—</span>;
  return (
    <span className="mono" style={{ color: m >= 0 ? 'var(--dem)' : 'var(--rep)' }}>
      {fmtSignedMargin(m)}
    </span>
  );
}

export const raceHeadline = (race: Race) => {
  const [a, b] = headlinePair(race);
  return [a?.name, b?.name].filter(Boolean).join(' vs. ') || 'Candidates TBD';
};
