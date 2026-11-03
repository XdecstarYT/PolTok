import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Market, RaceCallEvent, StateInfo } from '../../types';
import { raceById, STATES } from '../../data';
import { PARTY_HEX, marginColor, mixHex, timeAgo } from '../../lib/format';
import { USMap } from '../map/USMap';
import type { ChamberSummary, RaceView } from './model';
import { closeMinutes, etNowMinutes, fmtClock, fmtEtTime, isDSide, mainRaceByState } from './model';
import { AnimNum, BalanceBar, ControlNeedle, Sparkline, StatusChip } from './widgets';

const partyWord = { D: 'Democrats', R: 'Republicans' } as const;
const abbrList = (vs: RaceView[], n = 6) =>
  vs
    .slice(0, n)
    .map((v) => v.race.state + (v.race.special ? '*' : ''))
    .join(', ');

// ---------------------------------------------------------------------------
// Control room: needle + bar + seats + paths

export function ChamberControl({ s, title }: { s: ChamberSummary; title: string }) {
  const ready = s.ready;
  const decided = !ready ? null : s.dNeed === 0 ? 'D' : s.rNeed === 0 ? 'R' : null;
  return (
    <section className="lv-panel lv-chamber" aria-labelledby={`lv-${s.chamber}-h`}>
      <header className="lv-panel-h">
        <h2 id={`lv-${s.chamber}-h`}>{title}</h2>
        <span className="lv-panel-sub mono">{s.majority} for majority</span>
      </header>
      <div className="lv-chamber-body">
        <ControlNeedle probD={s.probD} uncertainty={s.uncalledFrac} ready={ready} label={`${title} control`} />
        <div className="lv-chamber-nums">
          <div className="lv-seats d">
            <span className="lv-seats-l">DEM{s.chamber === 'senate' ? ' + IND' : ''}</span>
            <span className="lv-seats-n mono">{ready ? <AnimNum value={s.dSeats} /> : '–'}</span>
            <span className="lv-seats-p mono">proj. {ready ? <AnimNum value={s.projD} flash={false} /> : '–'}</span>
          </div>
          <div className="lv-seats u">
            <span className="lv-seats-l">UNDECIDED</span>
            <span className="lv-seats-n mono">{ready ? <AnimNum value={s.undecided} flash={false} /> : '–'}</span>
          </div>
          <div className="lv-seats r">
            <span className="lv-seats-l">GOP</span>
            <span className="lv-seats-n mono">{ready ? <AnimNum value={s.rSeats} /> : '–'}</span>
            <span className="lv-seats-p mono">proj. {ready ? <AnimNum value={s.projR} flash={false} /> : '–'}</span>
          </div>
        </div>
        <BalanceBar dWon={s.dSeats} rWon={s.rSeats} dProj={s.projD} rProj={s.projR} total={s.total} majority={s.majority} ready={ready} label={`${title} balance of power`} />
        <ul className="lv-paths">
          {!ready ? (
            <>
              <li><span className="lv-skel lv-skel-line" style={{ width: '90%' }} /></li>
              <li><span className="lv-skel lv-skel-line" style={{ width: '70%' }} /></li>
            </>
          ) : decided ? (
            <li className="lv-path-done" style={{ color: PARTY_HEX[decided] }}>
              ✓ {partyWord[decided]} win control of the {s.chamber === 'senate' ? 'Senate' : 'House'}
            </li>
          ) : (
            <>
              <PathLine party="D" need={s.dNeed} leads={s.dLeads} others={s.rLeads} chamber={s.chamber} undecided={s.undecided} projected={s.projD} won={s.dSeats} />
              <PathLine party="R" need={s.rNeed} leads={s.rLeads} others={s.dLeads} chamber={s.chamber} undecided={s.undecided} projected={s.projR} won={s.rSeats} />
            </>
          )}
        </ul>
      </div>
    </section>
  );
}

function PathLine({ party, need, leads, others, chamber, undecided, projected, won }: { party: 'D' | 'R'; need: number; leads: RaceView[]; others: RaceView[]; chamber: 'senate' | 'house'; undecided: number; projected: number; won: number }) {
  const color = PARTY_HEX[party];
  if (need <= 0) return <li style={{ color }}>{partyWord[party]} have clinched control.</li>;
  if (need > undecided) return <li className="muted">{partyWord[party]}: no remaining path to a majority.</li>;
  // Seats the party currently leads/is projected in among the uncalled.
  const holding = Math.max(0, Math.min(undecided, projected - won));
  const tieNote = chamber === 'senate' && party === 'R' ? ' (50 + VP tiebreak)' : '';
  const list = chamber === 'senate';
  return (
    <li>
      <b style={{ color }}>{partyWord[party]}</b> need <b className="mono">{need}</b> of <span className="mono">{undecided}</span> uncalled{tieNote}.{' '}
      {holding >= need ? (
        <>
          {chamber === 'senate' ? 'Leading' : 'Projected ahead'} in {holding}
          {list && leads.length ? ` — ${abbrList(leads)}` : ''}.
        </>
      ) : (
        <>
          Ahead in {holding}; must flip {need - holding} more{list && others.length ? ` from ${abbrList(others, 4)}` : ''}.
        </>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Poll-closing timeline

export function PollTimeline({ views, now, simMin }: { views: RaceView[]; now: number; simMin?: number }) {
  const groups = useMemo(() => {
    const byState = new Map<string, RaceView[]>();
    for (const v of views) byState.set(v.race.state, [...(byState.get(v.race.state) ?? []), v]);
    const m = new Map<number, StateInfo[]>();
    for (const s of STATES) {
      const k = closeMinutes(s.pollClose);
      m.set(k, [...(m.get(k) ?? []), s]);
    }
    return [...m.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([min, states]) => ({ min, states: states.sort((a, b) => a.abbr.localeCompare(b.abbr)), byState }));
  }, [views]);
  const nowMin = simMin ?? etNowMinutes(now);
  if (!groups.length)
    return (
      <section className="lv-panel">
        <header className="lv-panel-h"><h2>Poll closings</h2></header>
        <span className="lv-skel lv-skel-line" style={{ width: '100%', height: 40 }} />
      </section>
    );
  const first = groups[0].min - 30;
  const last = groups[groups.length - 1].min + 30;
  const pos = (m: number) => `${((Math.min(last, Math.max(first, m)) - first) / (last - first)) * 100}%`;
  const started = (abbr: string) => groups[0].byState.get(abbr)?.some((v) => v.status !== 'not-started') ?? false;
  const next = groups.find((g) => g.min > nowMin);
  const mins = next ? next.min - nowMin : 0;
  return (
    <section className="lv-panel lv-timeline" aria-labelledby="lv-tl-h">
      <header className="lv-panel-h">
        <h2 id="lv-tl-h">Poll closings · ET</h2>
        <span className="lv-panel-sub mono">
          {next ? (
            <>
              Next: <b>{fmtClock(next.min)}</b> · {next.states.length} states
              {simMin == null && <> · in {mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`}</>}
            </>
          ) : (
            'All polls closed'
          )}
        </span>
      </header>
      <div className="lv-tl-scroll">
        <div className="lv-tl" style={{ ['--cols' as string]: groups.length }}>
          <div className="lv-tl-axis" aria-hidden>
            <div className="lv-tl-fill" style={{ width: pos(nowMin) }} />
            {nowMin >= first && nowMin <= last && (
              <div className="lv-tl-now" style={{ left: pos(nowMin) }}>
                <span className="mono">{simMin == null ? 'NOW' : 'SIM'} {fmtClock(nowMin)}</span>
              </div>
            )}
          </div>
          <ol className="lv-tl-cols">
            {groups.map((g) => {
              const closed = g.min <= nowMin || g.states.some((s) => started(s.abbr));
              return (
                <li key={g.min} className={`lv-tl-col ${closed ? 'is-closed' : ''}`}>
                  <span className="lv-tl-time mono">{fmtClock(g.min)}</span>
                  <span className="lv-tl-states">
                    {g.states.map((s) => {
                      const rs = g.byState.get(s.abbr) ?? [];
                      const has = rs.some((v) => v.race.chamber !== 'house');
                      const called = rs.filter((v) => v.race.chamber !== 'house' && v.winner);
                      const c = called[0]?.winner?.party;
                      return (
                        <Link
                          key={s.abbr}
                          to={`/state/${s.abbr}`}
                          className={`lv-tl-st mono ${has ? 'has-race' : ''}`}
                          style={c ? { background: PARTY_HEX[c] + '33', borderColor: PARTY_HEX[c] } : undefined}
                          title={`${s.name} — polls close ${fmtClock(g.min)} ET${has ? '' : ' (no statewide race)'}`}
                        >
                          {s.abbr}
                        </Link>
                      );
                    })}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Race call feed

export function CallFeed({ calls, now }: { calls: RaceCallEvent[]; now: number }) {
  return (
    <section className="lv-panel lv-feed" aria-labelledby="lv-feed-h">
      <header className="lv-panel-h">
        <h2 id="lv-feed-h">Race calls</h2>
        <span className="lv-panel-sub mono">{calls.length} called</span>
      </header>
      {calls.length === 0 ? (
        <p className="lv-empty">No races called yet. Alerts appear here as projections come in.</p>
      ) : (
        <ol className="lv-feed-list" aria-live="polite">
          {calls.slice(0, 60).map((c) => {
            const race = raceById.get(c.raceId);
            const cand = race?.candidates.find((x) => x.id === c.candidateId);
            const key = race?.key || c.flip;
            const color = PARTY_HEX[c.party] ?? '#8b93a7';
            return (
              <li key={c.raceId + c.at} className={`lv-feed-item ${c.flip ? 'is-flip' : ''}`} style={{ ['--pc' as string]: color }}>
                <time className="mono" dateTime={new Date(c.at).toISOString()} title={timeAgo(c.at, now)}>
                  {fmtEtTime(c.at)}
                </time>
                <div>
                  {key && <span className="lv-alert">{c.flip ? 'FLIP · ' : ''}KEY RACE ALERT</span>}
                  <Link to={`/race/${c.raceId}`} className="lv-feed-t">
                    <b style={{ color }}>{cand?.name ?? 'Candidate'}</b> ({c.party}) wins {race?.title ?? c.raceId}
                  </Link>
                  {c.flip && <span className="lv-gain">{c.party === 'I' ? 'D' : c.party} GAIN</span>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Live map

type MapMode = 'senate' | 'governor';
export function LiveMap({ views, calls, now }: { views: RaceView[]; calls: RaceCallEvent[]; now: number }) {
  const [mode, setMode] = useState<MapMode>('senate');
  const nav = useNavigate();
  const byState = useMemo(() => mainRaceByState(views.filter((v) => v.race.chamber === mode)), [views, mode]);
  const fills = useMemo(() => {
    const f: Record<string, string> = {};
    for (const [abbr, v] of byState) {
      if (v.winner) f[abbr] = PARTY_HEX[isDSide(v.winner.party) ? 'D' : 'R'];
      else if (v.total > 0) f[abbr] = mixHex(marginColor(v.dMargin, 16), '#1c2031', 0.35);
      else f[abbr] = '#2a2f40';
    }
    return f;
  }, [byState]);
  const highlight = useMemo(
    () => calls.filter((c) => now - c.at < 90_000 && raceById.get(c.raceId)?.chamber === mode).map((c) => raceById.get(c.raceId)!.state),
    [calls, now, mode],
  );
  const counts = useMemo(() => {
    let d = 0, r = 0, lead = 0;
    for (const v of byState.values()) {
      if (v.winner) isDSide(v.winner.party) ? d++ : r++;
      else lead++;
    }
    return { d, r, lead };
  }, [byState]);
  return (
    <section className="lv-panel lv-map" aria-labelledby="lv-map-h">
      <header className="lv-panel-h">
        <h2 id="lv-map-h">Live map</h2>
        <div className="lv-seg" role="group" aria-label="Map race type">
          {(['senate', 'governor'] as MapMode[]).map((m) => (
            <button key={m} className={`lv-seg-b ${mode === m ? 'is-on' : ''}`} aria-pressed={mode === m} onClick={() => setMode(m)}>
              {m === 'senate' ? 'Senate' : 'Governor'}
            </button>
          ))}
        </div>
      </header>
      <USMap
        variant="geo"
        fills={fills}
        emptyFill="#12141d"
        highlight={highlight}
        labels
        title={`Live ${mode} results map`}
        onStateClick={(abbr) => {
          const v = byState.get(abbr);
          nav(v ? `/race/${v.race.id}` : `/state/${abbr}`);
        }}
        describe={(abbr) => {
          const v = byState.get(abbr);
          if (!v) return 'no race';
          if (v.winner) return `called for ${v.winner.name} (${v.winner.party})`;
          return v.leader ? `${v.leader.c.name} leads by ${v.lead.toFixed(1)} points, ${Math.round(v.expectedPct)}% in` : 'not started';
        }}
        renderTooltip={(abbr) => <MapTip v={byState.get(abbr)} abbr={abbr} />}
      />
      <div className="lv-map-legend mono">
        <span><i style={{ background: PARTY_HEX.D }} /> D called <b>{counts.d}</b></span>
        <span><i style={{ background: marginColor(8) }} /> D lead</span>
        <span><i style={{ background: '#2a2f40' }} /> Uncounted</span>
        <span><i style={{ background: marginColor(-8) }} /> R lead</span>
        <span><i style={{ background: PARTY_HEX.R }} /> R called <b>{counts.r}</b></span>
      </div>
    </section>
  );
}

function MapTip({ v, abbr }: { v?: RaceView; abbr: string }) {
  if (!v) return <div className="lv-tip"><b>{abbr}</b><div className="muted">No race this year</div></div>;
  return (
    <div className="lv-tip">
      <div className="lv-tip-h">
        <b>{v.race.title}</b>
        <StatusChip v={v} />
      </div>
      {v.cands.slice(0, 3).map((c) => (
        <div key={c.c.id} className="lv-tip-row mono">
          <i style={{ background: PARTY_HEX[c.c.party] }} />
          <span>{c.c.name}</span>
          <b>{v.total > 0 ? `${c.pct.toFixed(1)}%` : '—'}</b>
        </div>
      ))}
      <div className="lv-tip-f mono">{v.status === 'not-started' ? `Polls close ${fmtClock(v.closeMin)} ET` : `${Math.round(v.expectedPct)}% of est. vote in`}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Swings vs 2024 presidential margin

export function Swings({ views }: { views: RaceView[] }) {
  const rows = useMemo(() => {
    const out: { v: RaceView; cur: number; prev: number; swing: number }[] = [];
    for (const v of views) {
      if (v.race.chamber === 'house' || !v.state || v.total <= 0 || v.expectedPct < 5) continue;
      const hasD = v.cands.some((c) => isDSide(c.c.party));
      const hasR = v.cands.some((c) => c.c.party === 'R');
      if (!hasD || !hasR) continue;
      const prev = v.state.pres2024.dem - v.state.pres2024.rep;
      out.push({ v, cur: v.dMargin, prev, swing: v.dMargin - prev });
    }
    return out.sort((a, b) => Math.abs(b.swing) - Math.abs(a.swing));
  }, [views]);
  const avg = rows.length ? rows.reduce((a, r) => a + r.swing, 0) / rows.length : 0;
  const max = Math.max(10, ...rows.slice(0, 10).map((r) => Math.abs(r.swing)));
  return (
    <section className="lv-panel lv-swings" aria-labelledby="lv-sw-h">
      <header className="lv-panel-h">
        <h2 id="lv-sw-h">Biggest swings vs 2024</h2>
        {rows.length > 0 && (
          <span className="lv-panel-sub mono" style={{ color: avg >= 0 ? PARTY_HEX.D : PARTY_HEX.R }}>
            avg {avg >= 0 ? 'D' : 'R'}+{Math.abs(avg).toFixed(1)}
          </span>
        )}
      </header>
      <p className="lv-note">Current statewide margin vs. 2024 presidential margin, races with ≥5% of vote counted.</p>
      {rows.length === 0 ? (
        <p className="lv-empty">Swings appear once votes are counted.</p>
      ) : (
        <ol className="lv-sw-list">
          {rows.slice(0, 10).map(({ v, cur, prev, swing }) => {
            const p = swing >= 0 ? 'D' : 'R';
            const w = (Math.abs(swing) / max) * 50;
            return (
              <li key={v.race.id}>
                <Link to={`/race/${v.race.id}`} className="lv-sw-row">
                  <span className="lv-sw-n">
                    <b className="mono">{v.race.state}</b> <small>{v.race.chamber === 'senate' ? (v.race.special ? 'Sen*' : 'Sen') : 'Gov'}</small>
                  </span>
                  <span className="lv-sw-bar" aria-hidden>
                    <i style={{ width: `${w}%`, background: PARTY_HEX[p], [p === 'D' ? 'right' : 'left']: '50%' }} />
                  </span>
                  <span className="lv-sw-v mono" style={{ color: PARTY_HEX[p] }}>
                    {p}+{Math.abs(swing).toFixed(1)}
                  </span>
                  <span className="lv-sw-d mono muted">
                    {fmtM(prev)} → {fmtM(cur)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
const fmtM = (m: number) => `${m >= 0 ? 'D' : 'R'}+${Math.abs(m).toFixed(1)}`;

// ---------------------------------------------------------------------------
// Markets

export function Markets({ markets }: { markets: Market[] }) {
  return (
    <section className="lv-panel lv-markets" aria-labelledby="lv-mk-h">
      <header className="lv-panel-h">
        <h2 id="lv-mk-h">Prediction markets</h2>
      </header>
      {markets.length === 0 ? (
        <>
          {[0, 1, 2].map((i) => (
            <div key={i} className="lv-mk-row"><span className="lv-skel lv-skel-line" style={{ width: '100%', height: 28 }} /></div>
          ))}
        </>
      ) : (
        <ul className="lv-mk-list">
          {markets.slice(0, 6).map((m) => {
            const o = m.outcomes[0];
            const color = o?.color ?? '#c6ff3d';
            const hist = (m.history ?? []).map((h) => h.p);
            return (
              <li key={m.id} className="lv-mk-row">
                <div className="lv-mk-q">
                  <span>{m.question}</span>
                  <small className="muted">{m.source}</small>
                </div>
                <Sparkline data={hist} color={color} width={92} height={30} />
                <div className="lv-mk-o mono">
                  {m.outcomes.slice(0, 2).map((x) => (
                    <span key={x.label} style={{ color: x.color ?? 'var(--text)' }}>
                      {x.label} <b><AnimNum value={x.prob * 100} format={(n) => `${Math.round(n)}¢`} /></b>
                    </span>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
