import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, SectionHeader, SimBadge } from '../../components';
import { POLL_SERIES, RACES, raceById } from '../../data';
import { useLive } from '../../lib/live';
import { PARTY_HEX } from '../../lib/format';
import type { Race, RaceResult } from '../../types';
import { WatchStar } from './WatchStar';
import { useWatchlist, isAuWatchId } from '../../lib/watchlist';
import { demMarginOf, fmtMargin, marketFor, pollAverage, presMarginOf, shares, statusLabel } from './model';
import './watch.css';

const MAX = 4;
const CHAMBERS: { id: Race['chamber']; label: string }[] = [
  { id: 'senate', label: 'Senate' },
  { id: 'governor', label: 'Governor' },
  { id: 'house', label: 'House' },
];

const signed = (n: number | undefined, d = 1) => (n == null || !Number.isFinite(n) ? '—' : `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n).toFixed(d)}`);
const missTxt = (n: number | undefined) => (n == null ? '—' : Math.abs(n) < 0.05 ? 'Polls exact' : `${n > 0 ? 'Democrat' : 'Republican'} beat the polls by ${Math.abs(n).toFixed(1)}`);

function Stat({ k, v, color, hint }: { k: string; v: string; color?: string; hint?: string }) {
  return (
    <div className="cp-stat" title={hint}>
      <dt>{k}</dt>
      <dd className="num" style={color ? { color } : undefined}>{v}</dd>
    </div>
  );
}

function Column({ race, r, onRemove }: { race: Race; r?: RaceResult; onRemove: () => void }) {
  const { markets } = useLive();
  const rows = shares(race, r).slice(0, 4);
  const m = demMarginOf(race, r);
  const pres = presMarginOf(race);
  const poll = pollAverage(race);
  const miss = m != null && poll ? m - poll.margin : undefined;
  const mk = marketFor(markets, race);
  const col = (x?: number) => (x == null ? undefined : PARTY_HEX[x >= 0 ? 'D' : 'R']);
  return (
    <article className="cp-col">
      <header className="cp-col__h">
        <div>
          <span className="wt-kick mono">{race.chamber.toUpperCase()} · {statusLabel(r)}{r ? ` · ${Math.round(r.expectedPct)}% in` : ''}</span>
          <Link to={`/race/${race.id}`} className="wt-card__name">{race.title}</Link>
        </div>
        <div className="row" style={{ gap: 4 }}>
          <WatchStar raceId={race.id} label={race.title} compact />
          <button type="button" className="cp-x" onClick={onRemove} aria-label={`Remove ${race.title} from comparison`}>✕</button>
        </div>
      </header>
      <ul className="wt-rows">
        {rows.map((x) => (
          <li key={x.cand.id} className={r?.calledFor === x.cand.id ? 'is-win' : ''}>
            <div className="wt-row__top">
              <span className="wt-row__n"><i style={{ background: PARTY_HEX[x.cand.party] }} />{x.cand.name}{r?.calledFor === x.cand.id && <b className="wt-check"> ✓</b>}</span>
              <span className="num wt-row__p">{x.pct.toFixed(1)}%</span>
            </div>
            <div className="wt-bar"><span style={{ width: `${x.pct}%`, background: PARTY_HEX[x.cand.party] }} /></div>
            {poll?.byKey[x.cand.id] != null && <span className="wt-row__v num">Final polls {poll.byKey[x.cand.id].toFixed(1)}%</span>}
          </li>
        ))}
      </ul>
      <dl className="cp-stats">
        <Stat k="Result margin" v={fmtMargin(m)} color={col(m)} />
        <Stat k="2024 pres. (state)" v={fmtMargin(pres)} color={col(pres)} />
        <Stat k="vs. 2024 pres." v={m != null && pres != null ? `${signed(m - pres)} D` : '—'} color={m != null && pres != null ? col(m - pres) : undefined} hint="Result margin minus Trump–Harris 2024 statewide margin; positive = Democrat ran ahead of Harris" />
        <Stat k={poll ? `Poll avg (${poll.n})` : 'Poll avg'} v={poll ? fmtMargin(poll.margin) : 'No polls'} color={col(poll?.margin)} hint={poll ? `Average of polls within 21 days of ${poll.last}` : undefined} />
        <Stat k="Polling miss" v={miss == null ? '—' : `${signed(miss)} D`} color={col(miss)} hint={missTxt(miss)} />
        <Stat k="Market" v={mk ? mk.outcomes.slice(0, 2).map((o) => `${o.label} ${Math.round(o.prob * 100)}%`).join(' · ') : '—'} hint={mk?.source} />
      </dl>
      {miss != null && <p className="cp-miss">{missTxt(miss)} pts{r && r.expectedPct < 95 ? ` (with ${Math.round(r.expectedPct)}% counted)` : ''}.</p>}
    </article>
  );
}

function MissBoard() {
  const { results } = useLive();
  const rows = useMemo(
    () =>
      POLL_SERIES.map((s) => raceById.get(s.id))
        .filter((r): r is Race => !!r)
        .map((race) => {
          const r = results[race.id];
          const m = demMarginOf(race, r);
          const p = pollAverage(race);
          return { race, r, miss: m != null && p ? m - p.margin : undefined, poll: p?.margin, m };
        })
        .filter((x) => x.miss != null)
        .sort((a, b) => Math.abs(b.miss!) - Math.abs(a.miss!)),
    [results],
  );
  if (!rows.length) return <p className="wt-hint mono">Polling-miss scoreboard appears once votes are counted in polled races.</p>;
  const max = Math.max(5, ...rows.map((x) => Math.abs(x.miss!)));
  const avg = rows.reduce((s, x) => s + x.miss!, 0) / rows.length;
  return (
    <>
      <p className="wt-sub">Average miss across {rows.length} polled races: <b className="num" style={{ color: PARTY_HEX[avg >= 0 ? 'D' : 'R'] }}>{signed(avg)} D</b> ({avg >= 0 ? 'Democrats beat their polls' : 'Republicans beat their polls'}).</p>
      <ul className="cp-board">
        {rows.map((x) => (
          <li key={x.race.id}>
            <Link to={`/compare?r=${x.race.id}`} className="cp-board__n">{x.race.id}</Link>
            <div className="cp-board__bar" aria-label={`${x.race.title}: ${missTxt(x.miss)}`}>
              <span className="cp-board__axis" />
              <span
                className="cp-board__fill"
                style={{
                  background: PARTY_HEX[x.miss! >= 0 ? 'D' : 'R'],
                  width: `${(Math.abs(x.miss!) / max) * 50}%`,
                  left: x.miss! >= 0 ? '50%' : `${50 - (Math.abs(x.miss!) / max) * 50}%`,
                }}
              />
            </div>
            <span className="num mono cp-board__v">{signed(x.miss)}</span>
            <span className="mono cp-board__d">poll {fmtMargin(x.poll)} → {fmtMargin(x.m)}{x.r && x.r.expectedPct < 95 ? ` · ${Math.round(x.r.expectedPct)}%` : ''}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

export default function ComparePage() {
  const [params, setParams] = useSearchParams();
  const { results } = useLive();
  const wl = useWatchlist();
  const ids = useMemo(() => (params.get('r') ?? '').split(',').filter((id) => raceById.has(id)).slice(0, MAX), [params]);
  const set = (next: string[]) => setParams(next.length ? { r: next.join(',') } : {}, { replace: true });
  const watchedUs = wl.ids.filter((i) => !isAuWatchId(i) && raceById.has(i));
  const defaults = (watchedUs.length >= 2 ? watchedUs : RACES.filter((r) => r.key).map((r) => r.id)).slice(0, 3);

  return (
    <div className="page wt">
      <header className="wt-head">
        <div>
          <span className="wt-kick mono">COMPARE</span>
          <h1 className="wt-h1">Side by side</h1>
          <p className="wt-sub">Pick 2–4 races: vote shares, margins vs. the 2024 presidential result, polls vs. result and markets.</p>
        </div>
        <div className="wt-head__acts"><SimBadge /></div>
      </header>

      <div className="cp-pick">
        {ids.length < MAX && (
          <label className="cp-select">
            <span className="mono">Add race</span>
            <select value="" onChange={(e) => e.target.value && set([...ids, e.target.value])}>
              <option value="">Choose…</option>
              {CHAMBERS.map((c) => (
                <optgroup key={c.id} label={c.label}>
                  {RACES.filter((r) => r.chamber === c.id && !ids.includes(r.id)).map((r) => (
                    <option key={r.id} value={r.id}>{r.title}{POLL_SERIES.some((p) => p.id === r.id) ? ' · polled' : ''}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        )}
        {ids.length === 0 && <Button size="sm" onClick={() => set(defaults)}>{watchedUs.length >= 2 ? 'Use my watchlist' : 'Start with key races'}</Button>}
        {ids.length > 0 && <Button size="sm" variant="ghost" onClick={() => set([])}>Clear</Button>}
      </div>

      {ids.length > 0 ? (
        <div className={`cp-grid cp-grid--${ids.length}`}>
          {ids.map((id) => (
            <Column key={id} race={raceById.get(id)!} r={results[id]} onRemove={() => set(ids.filter((x) => x !== id))} />
          ))}
        </div>
      ) : (
        <p className="wt-hint mono">No races selected.</p>
      )}

      <section className="cp-section">
        <SectionHeader kicker="POST-ELECTION" title="How much did the polls miss?" sub="Result margin minus final 3-week poll average (D−R). Right = Democrats outran polls." />
        <MissBoard />
      </section>
    </div>
  );
}
