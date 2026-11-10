import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { m as motion } from 'framer-motion';
import type { Race, Rating } from '../../types';
import { HOUSE_BASELINE, RACES, SENATE_NOT_UP } from '../../data';
import { useLive } from '../../lib/live';
import { RatingBadge, SimBadge, PartyDot } from '../../components';
import { PARTY_HEX, RATING_HEX, RATINGS } from '../../lib/format';
import { RaceChip, MarginPill } from './parts';
import { CHAMBER_LABEL, type ChamberTab, headlinePair, incumbentOf, leaderOf, longTitle, ratingIndex, seatMath, totalVotes } from './util';
import './races.css';

const TABS: ChamberTab[] = ['senate', 'governor', 'house'];
const SOLID_CAP = 18;

type Results = ReturnType<typeof useLive>['results'];
type SortKey = 'race' | 'incumbent' | 'rating' | 'leader' | 'expected';

export default function RacesIndex() {
  const [params, setParams] = useSearchParams();
  const tab = (TABS.includes(params.get('c') as ChamberTab) ? params.get('c') : 'senate') as ChamberTab;
  const view = params.get('view') === 'table' ? 'table' : 'board';
  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    next.set(k, v);
    setParams(next, { replace: true });
  };
  const { results, mode } = useLive();

  const races = useMemo(() => RACES.filter((r) => r.chamber === tab), [tab]);
  const math = useMemo(() => seatMath(tab), [tab]);
  const counts = useMemo(() => Object.fromEntries(TABS.map((t) => [t, RACES.filter((r) => r.chamber === t).length])) as Record<ChamberTab, number>, []);
  const called = races.filter((r) => results[r.id]?.calledFor).length;

  useEffect(() => {
    document.title = `Race Ratings · ${CHAMBER_LABEL[tab]} · PolTok`;
  }, [tab]);

  return (
    <div className="page rx-page">
      <header className="rx-index-head">
        <div>
          <span className="rx-eyebrow">
            <span className="rx-live-dot" /> Election Day · Nov 3, 2026
          </span>
          <h1 className="rx-h1">Race Ratings Board</h1>
          <p className="rx-muted rx-lede">
            Every {CHAMBER_LABEL[tab].toLowerCase()} race on the ballot, from Solid D to Solid R — with live leaders and calls laid on top as the count comes in.
          </p>
        </div>
        <div className="rx-head-meta">
          <SimBadge />
          <span className="mono rx-muted">
            {called}/{races.length} called{mode === 'connecting' ? ' · connecting…' : ''}
          </span>
        </div>
      </header>

      <div className="rx-toolbar">
        <div className="rx-tabs" role="tablist" aria-label="Chamber">
          {TABS.map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'is-on' : ''} onClick={() => setParam('c', t)}>
              {tab === t && <motion.span layoutId="rx-tab-pill" className="rx-tab-pill" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
              <span className="rx-tab-label">
                {CHAMBER_LABEL[t]} <small className="mono">{counts[t]}</small>
              </span>
            </button>
          ))}
        </div>
        <div className="rx-seg" role="group" aria-label="View">
          <button aria-pressed={view === 'board'} className={view === 'board' ? 'is-on' : ''} onClick={() => setParam('view', 'board')}>
            Board
          </button>
          <button aria-pressed={view === 'table'} className={view === 'table' ? 'is-on' : ''} onClick={() => setParam('view', 'table')}>
            Table
          </button>
        </div>
      </div>

      <SeatSummary tab={tab} math={math} races={races} />

      {races.length === 0 ? (
        <div className="card rx-empty">
          <h3>No {CHAMBER_LABEL[tab].toLowerCase()} races loaded yet</h3>
          <p className="rx-muted">Race data is still being compiled. Check back shortly — this board fills in automatically.</p>
        </div>
      ) : view === 'board' ? (
        <Board races={races} tab={tab} results={results} />
      ) : (
        <RaceTable races={races} results={results} />
      )}
    </div>
  );
}

function Board({ races, tab, results }: { races: Race[]; tab: ChamberTab; results: Results }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const byRating = useMemo(() => {
    const m = new Map<Rating, Race[]>(RATINGS.map((r) => [r, []]));
    for (const r of races) m.get(r.rating)?.push(r);
    for (const list of m.values()) list.sort((a, b) => (b.key ? 1 : 0) - (a.key ? 1 : 0) || a.state.localeCompare(b.state) || (a.district ?? 0) - (b.district ?? 0));
    return m;
  }, [races]);
  return (
    <div className="rx-board" aria-label={`${CHAMBER_LABEL[tab]} ratings board`}>
      {RATINGS.map((rating, ci) => {
        const list = byRating.get(rating) ?? [];
        const isSolid = rating.startsWith('Solid');
        const cap = isSolid && !expanded[rating] && list.length > SOLID_CAP;
        const shown = cap ? list.slice(0, SOLID_CAP) : list;
        const dLead = list.filter((r) => {
          const l = leaderOf(r, results[r.id]);
          return l && (l.cand.party === 'D' || l.cand.party === 'I');
        }).length;
        const rLead = list.filter((r) => leaderOf(r, results[r.id])?.cand.party === 'R').length;
        return (
          <motion.section
            key={rating}
            className={`rx-col ${rating === 'Toss-up' ? 'is-tossup' : ''}`}
            style={{ ['--rc' as string]: RATING_HEX[rating] }}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: ci * 0.04, duration: 0.35 }}
          >
            <header>
              <h3>{rating}</h3>
              <span className="mono rx-col-count">{list.length}</span>
            </header>
            {(dLead > 0 || rLead > 0) && (
              <div className="rx-col-live mono" aria-label={`Leading: ${dLead} Democrat, ${rLead} Republican`}>
                <span style={{ color: PARTY_HEX.D }}>D {dLead}</span>
                <span style={{ color: PARTY_HEX.R }}>R {rLead}</span>
              </div>
            )}
            <div className="rx-chips">
              {shown.map((r) => (
                <RaceChip key={r.id} race={r} result={results[r.id]} />
              ))}
              {list.length === 0 && <span className="rx-col-empty">—</span>}
              {cap && (
                <button className="rx-more" onClick={() => setExpanded((e) => ({ ...e, [rating]: true }))}>
                  +{list.length - SOLID_CAP} more
                </button>
              )}
            </div>
          </motion.section>
        );
      })}
    </div>
  );
}

function RaceTable({ races, results }: { races: Race[]; results: Results }) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: 'rating', dir: 1 });
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const filtered = s
      ? races.filter((r) => `${r.id} ${longTitle(r)} ${r.state} ${r.rating} ${(r.candidates ?? []).map((c) => c.name).join(' ')}`.toLowerCase().includes(s))
      : races;
    const val = (r: Race): string | number => {
      const res = results[r.id];
      switch (sort.k) {
        case 'race':
          return r.id;
        case 'incumbent':
          return incumbentOf(r)?.name ?? `~${r.incumbentParty}`;
        case 'rating':
          return ratingIndex(r.rating) * 1000 + (r.district ?? 0);
        case 'leader': {
          const l = leaderOf(r, res);
          if (!l) return sort.dir === 1 ? 1e9 : -1e9;
          return (l.cand.party === 'R' ? 1 : -1) * l.marginPct;
        }
        case 'expected':
          return res?.expectedPct ?? -1;
      }
    };
    return [...filtered].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      return (typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb))) * sort.dir;
    });
  }, [races, q, sort, results]);
  const th = (k: SortKey, label: string, cls = '') => (
    <th className={cls} aria-sort={sort.k === k ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button onClick={() => setSort((s) => ({ k, dir: s.k === k ? ((-s.dir) as 1 | -1) : 1 }))}>
        {label}
        <span aria-hidden className="rx-sort">{sort.k === k ? (sort.dir === 1 ? '▲' : '▼') : '↕'}</span>
      </button>
    </th>
  );
  return (
    <div className="card rx-tablecard">
      <div className="rx-table-tools">
        <input className="rx-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by state, race id or candidate…" aria-label="Filter races" />
        <span className="rx-muted mono">{rows.length} races</span>
      </div>
      <div className="rx-table-wrap">
        <table className="pt-table rx-table">
          <thead>
            <tr>
              {th('race', 'Race')}
              {th('incumbent', 'Incumbent', 'hide-md')}
              <th className="hide-sm">Candidates</th>
              {th('rating', 'Rating')}
              {th('leader', 'Live leader')}
              {th('expected', 'Exp. in', 'num hide-sm')}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const res = results[r.id];
              const lead = leaderOf(r, res);
              const inc = incumbentOf(r);
              const [a, b] = headlinePair(r);
              return (
                <tr key={r.id} style={{ ['--stripe' as string]: lead ? PARTY_HEX[lead.cand.party] : 'transparent' }}>
                  <td>
                    <Link to={`/race/${r.id}`} className="rx-tlink">
                      <b className="mono">{r.id}</b>
                      <small>{longTitle(r)}</small>
                    </Link>
                  </td>
                  <td className="hide-md">
                    {inc ? (
                      <span className="rx-inline">
                        <PartyDot party={inc.party} /> {inc.name}
                      </span>
                    ) : (
                      <span className="rx-muted">Open ({r.incumbentParty})</span>
                    )}
                  </td>
                  <td className="hide-sm">
                    <span className="rx-inline">
                      {a && <PartyDot party={a.party} />} {a?.name ?? 'TBD'} <span className="rx-muted">vs</span> {b && <PartyDot party={b.party} />} {b?.name ?? 'TBD'}
                    </span>
                  </td>
                  <td>
                    <RatingBadge rating={r.rating} />
                  </td>
                  <td>
                    {lead ? (
                      <span className="rx-inline">
                        {lead.called && <span className="rx-check" aria-label="called">✓</span>}
                        <span style={{ color: PARTY_HEX[lead.cand.party] }}>{lead.cand.name.split(' ').slice(-1)[0]}</span>
                        <MarginPill race={r} result={res} />
                      </span>
                    ) : (
                      <span className="rx-muted">{res && totalVotes(res) === 0 && res.status !== 'not-started' ? 'Awaiting' : '—'}</span>
                    )}
                  </td>
                  <td className="num mono hide-sm">{res ? `${Math.round(res.expectedPct)}%` : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SeatSummary({ tab, math, races }: { tab: ChamberTab; math: ReturnType<typeof seatMath>; races: Race[] }) {
  const nu = SENATE_NOT_UP ?? { D: 0, R: 0, I: 0 };
  const segs: { label: string; n: number; color: string; notUp?: boolean }[] = [
    ...(tab === 'senate' ? [{ label: 'D not up', n: (nu.D || 0) + (nu.I || 0), color: '#14327a', notUp: true }] : []),
    ...(tab === 'house' && HOUSE_BASELINE?.D ? [{ label: 'D safe (untracked)', n: HOUSE_BASELINE.D, color: '#14327a', notUp: true }] : []),
    ...RATINGS.map((r) => ({ label: r, n: math.counts[r], color: RATING_HEX[r] })),
    ...(tab === 'senate' ? [{ label: 'R not up', n: nu.R || 0, color: '#6e1020', notUp: true }] : []),
    ...(tab === 'house' && HOUSE_BASELINE?.R ? [{ label: 'R safe (untracked)', n: HOUSE_BASELINE.R, color: '#6e1020', notUp: true }] : []),
  ];
  const segTotal = segs.reduce((s, g) => s + g.n, 0);
  const majPct = tab === 'senate' && segTotal >= 90 ? (51 / segTotal) * 100 : tab === 'house' && segTotal >= 400 ? (218 / segTotal) * 100 : undefined;
  const { results } = useLive();
  const liveD = races.filter((r) => {
    const w = results[r.id]?.calledFor;
    const c = w && r.candidates.find((x) => x.id === w);
    return c && (c.party === 'D' || c.party === 'I');
  }).length;
  const liveR = races.filter((r) => {
    const w = results[r.id]?.calledFor;
    return w && r.candidates.find((x) => x.id === w)?.party === 'R';
  }).length;

  let headline: ReactNode;
  if (tab === 'senate') {
    headline = (
      <>
        <b style={{ color: 'var(--dem)' }}>D need {math.dNeed > 0 ? `+${math.dNeed}` : 'to hold'}</b> for a Senate majority (51)
        <span className="rx-sep">·</span>
        <b style={{ color: 'var(--rep)' }}>R need {math.rNeed > 0 ? `+${math.rNeed}` : '50 seats'}</b> to hold control (VP tiebreak)
      </>
    );
  } else if (tab === 'house') {
    headline = (
      <>
        <b>218</b> for a House majority
        <span className="rx-sep">·</span>
        <b style={{ color: 'var(--dem)' }}>D {math.dBase}</b> safe+lean · <b style={{ color: 'var(--tossup)' }}>{math.tossups}</b> toss-ups · <b style={{ color: 'var(--rep)' }}>R {math.rBase}</b>
        {HOUSE_BASELINE?.D ? <span className="rx-muted rx-small"> (incl. {HOUSE_BASELINE.D + HOUSE_BASELINE.R} untracked safe seats)</span> : null}
      </>
    );
  } else {
    headline = (
      <>
        <b className="mono">{math.tracked}</b> governorships on the ballot · <span style={{ color: 'var(--dem)' }}>{math.dHeld} D-held</span> /{' '}
        <span style={{ color: 'var(--rep)' }}>{math.rHeld} R-held</span>
      </>
    );
  }

  return (
    <section className="card rx-seat" aria-label="Seat math">
      <div className="rx-seat-head">
        <p className="rx-seat-line">{headline}</p>
        {tab !== 'governor' && math.tracked > 0 && (
          <div className="rx-seat-nums mono">
            <span>
              <small>D safe+lean</small>
              <b style={{ color: 'var(--dem)' }}>{math.dBase}</b>
            </span>
            <span>
              <small>Toss-ups</small>
              <b style={{ color: 'var(--tossup)' }}>{math.tossups}</b>
            </span>
            <span>
              <small>R safe+lean</small>
              <b style={{ color: 'var(--rep)' }}>{math.rBase}</b>
            </span>
            <span>
              <small>D need of toss-ups</small>
              <b>{Math.max(0, math.majority - math.dBase)}</b>
            </span>
          </div>
        )}
        {(liveD > 0 || liveR > 0) && (
          <div className="rx-seat-live mono">
            Called tonight: <b style={{ color: 'var(--dem)' }}>D {liveD}</b> · <b style={{ color: 'var(--rep)' }}>R {liveR}</b> <SimBadge />
          </div>
        )}
      </div>
      <div className="rx-ratingbar" role="img" aria-label={segs.map((g) => `${g.label}: ${g.n}`).join(', ')}>
        {segs.map((g) =>
          g.n ? (
            <motion.span key={g.label} initial={{ flexGrow: 0 }} animate={{ flexGrow: g.n }} transition={{ duration: 0.6 }} style={{ background: g.color }} className={g.notUp ? 'is-notup' : ''} title={`${g.label}: ${g.n}`}>
              <small className="mono">{g.n}</small>
            </motion.span>
          ) : null,
        )}
        {majPct !== undefined && (
          <i className="rx-majline" style={{ left: `${majPct}%` }}>
            <em className="mono">{math.majority} · majority</em>
          </i>
        )}
      </div>
      <div className="rx-ratinglegend">
        {RATINGS.map((r) => (
          <span key={r}>
            <i style={{ background: RATING_HEX[r] }} /> {r}
          </span>
        ))}
      </div>
    </section>
  );
}
