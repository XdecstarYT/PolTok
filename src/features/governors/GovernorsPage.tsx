/**
 * /governors — all 36 governor races, live AP results (NYT), map of all 50 governorships after tonight.
 */
import { useSeo } from '../../lib/seo';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Avatar, PageHeader, fmtTime, tzAbbr } from '../../components';
import { STATES, raceById } from '../../data';
import { PARTY_HEX, ink } from '../../lib/format';
import type { Party } from '../../types';
import { USMap } from '../map/USMap';
import { ATTRIBUTION, NOT_UP, pres24, signed, stateName, useGovernorRaces, type Contest } from './data';
import './governors.css';

const side = (p?: Party): 'D' | 'R' | 'O' => (p === 'D' ? 'D' : p === 'R' ? 'R' : 'O');
const PNAME = { D: 'Democratic', R: 'Republican', O: 'Independent/other' } as const;

interface Seat { abbr: string; party: 'D' | 'R' | 'O'; prior: 'D' | 'R' | 'O'; up: boolean; called: boolean; c?: Contest }

export default function GovernorsPage() {
  useSeo({ title: 'Governor races', description: 'Governor races across the states with results and context.' });
  const { races, error, at } = useGovernorRaces();
  const nav = useNavigate();
  const [filter, setFilter] = useState<'all' | 'uncalled' | 'flips' | 'close'>('all');

  const seats = useMemo(() => {
    const byState = new Map(races.map((c) => [c.state, c]));
    const out: Seat[] = [];
    for (const s of STATES) {
      if (s.abbr === 'DC') continue;
      const nu = NOT_UP[s.abbr];
      if (nu) { out.push({ abbr: s.abbr, party: side(nu.party), prior: side(nu.party), up: false, called: true }); continue; }
      const c = byState.get(s.abbr);
      const prior = side(raceById.get(`${s.abbr}-GOV`)?.incumbentParty as Party | undefined);
      const lead = c?.lines.find((l) => l.won) || (c && c.total > 0 ? c.leader : undefined);
      out.push({ abbr: s.abbr, party: lead ? side(lead.party) : prior, prior, up: true, called: !!c?.called, c });
    }
    return out;
  }, [races]);

  const count = (p: string, f: (s: Seat) => boolean = () => true) => seats.filter((s) => s.party === p && f(s)).length;
  const priorCount = (p: string) => seats.filter((s) => s.prior === p).length;
  const flips = seats.filter((s) => s.up && s.called && s.party !== s.prior);
  const netD = flips.filter((s) => s.party === 'D').length - flips.filter((s) => s.prior === 'D').length;
  const uncalled = races.filter((c) => !c.called);
  const closest = [...races].filter((c) => c.total > 0 && c.lines.length > 1).sort((a, b) => a.margin - b.margin).slice(0, 6);

  const fills: Record<string, string> = {};
  for (const s of seats) {
    const base = s.party === 'O' ? PARTY_HEX.I : PARTY_HEX[s.party];
    fills[s.abbr] = !s.up ? `${base}66` : s.called ? base : `${base}aa`;
  }
  const sublabels: Record<string, string> = {};
  for (const s of seats) if (s.up && s.called && s.party !== s.prior) sublabels[s.abbr] = 'FLIP';

  const shown = races.filter((c) => {
    const s = seats.find((x) => x.abbr === c.state);
    if (filter === 'uncalled') return !c.called;
    if (filter === 'flips') return !!s && s.called && s.party !== s.prior;
    if (filter === 'close') return c.total > 0 && c.margin < 5;
    return true;
  });

  return (
    <div className="page gv-page">
      <PageHeader
        live
        kicker="Governors · 2026 · AP live"
        title="The governorships"
        crumbLabel="Governors"
        sub="All 36 governor races from real AP results, plus the 14 states that didn't vote for governor this year, which keep their current governor's party."
        meta={<span>{ATTRIBUTION}{at ? ` · updated ${fmtTime(at)} ${tzAbbr(at)}` : ''}{error ? ` · last fetch failed (${error})` : ''}</span>}
      />

      <section className="gv-stats" aria-label="Governorships after tonight">
        <div style={{ boxShadow: `inset 0 3px 0 ${PARTY_HEX.D}` }}><b>{count('D')}</b>Dem governors <small>was {priorCount('D')}</small></div>
        <div style={{ boxShadow: `inset 0 3px 0 ${PARTY_HEX.R}` }}><b>{count('R')}</b>GOP governors <small>was {priorCount('R')}</small></div>
        {count('O') > 0 && <div><b>{count('O')}</b>Other</div>}
        <div><b>{netD === 0 ? '±0' : netD > 0 ? `D+${netD}` : `R+${-netD}`}</b>Net change <small>{flips.length} flip{flips.length === 1 ? '' : 's'} called</small></div>
        <div><b>{races.length - uncalled.length}/{races.length || 36}</b>Called</div>
      </section>
      <p className="gv-note">Counts include uncalled races at the current leader's party (shown lighter on the map). Prior party for races up tonight is the party of the outgoing governor.</p>

      <section className="gv-grid">
        <div className="gv-panel">
          <h2>Map after tonight</h2>
          <USMap
            fills={fills}
            sublabels={sublabels}
            labels
            onStateClick={(a) => nav(`/governors/${a}`)}
            describe={(a) => {
              const s = seats.find((x) => x.abbr === a);
              if (!s) return '';
              if (!s.up) return `no race in 2026, ${PNAME[s.party]} governor ${NOT_UP[a]?.name ?? ''} stays`;
              return `${s.called ? 'won by' : 'leaning'} ${PNAME[s.party]}${s.called && s.party !== s.prior ? ', flip' : ''}`;
            }}
            renderTooltip={(a) => {
              const s = seats.find((x) => x.abbr === a);
              if (!s) return null;
              return (
                <div><b>{stateName(a)}</b><br />
                  {!s.up ? <>Not up · Gov. {NOT_UP[a]?.name} ({NOT_UP[a]?.party})</> : s.c?.leader ? <>{s.c.called ? 'Winner' : 'Leading'}: {s.c.leader.name} ({s.c.leader.party}) {s.c.total ? signed(s.c.dMinusR ?? 0) : ''}<br />{s.c.eevp}% expected vote in</> : 'No results yet'}
                </div>
              );
            }}
            title="Governor party control by state after the 2026 election"
          />
          <div className="gv-legend">
            <span><i style={{ background: PARTY_HEX.D }} />Dem (called)</span><span><i style={{ background: `${PARTY_HEX.D}aa` }} />Dem leading</span>
            <span><i style={{ background: PARTY_HEX.R }} />GOP (called)</span><span><i style={{ background: `${PARTY_HEX.R}aa` }} />GOP leading</span>
            <span><i style={{ background: '#88888866' }} />Not up in 2026 (faded, current party)</span><span><b>FLIP</b> label = party change</span>
          </div>
        </div>
        <aside className="gv-panel">
          <h2>Closest races</h2>
          <ol className="gv-close">
            {closest.map((c) => (
              <li key={c.id}><Link to={`/governors/${c.state}`}><b>{stateName(c.state)}</b><span>{c.leader?.name} +{c.margin.toFixed(1)}</span><em>{c.called ? 'Called' : `${c.eevp}% in`}</em></Link></li>
            ))}
            {!closest.length && <li className="gv-muted">No votes counted yet.</li>}
          </ol>
          <h2 style={{ marginTop: 16 }}>Flips</h2>
          <ul className="gv-flips">
            {flips.map((s) => <li key={s.abbr}><Link to={`/governors/${s.abbr}`}>{stateName(s.abbr)}: {s.prior} → <b style={{ color: ink(PARTY_HEX[s.party === 'O' ? 'I' : s.party]) }}>{s.party}</b></Link></li>)}
            {!flips.length && <li className="gv-muted">No called flips yet.</li>}
          </ul>
          <h2 style={{ marginTop: 16 }}>Trifectas</h2>
          <p className="gv-muted gv-small">Not shown. NYT/AP publish individual state legislative races but not chamber control (seats not up, coalitions), so we can't source legislature control reliably tonight.</p>
        </aside>
      </section>

      <section>
        <div className="gv-seg" role="group" aria-label="Filter races">
          {(['all', 'uncalled', 'flips', 'close'] as const).map((f) => (
            <button key={f} type="button" className={filter === f ? 'on' : ''} aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f === 'all' ? `All ${races.length}` : f === 'uncalled' ? `Uncalled ${uncalled.length}` : f === 'flips' ? `Flips ${flips.length}` : 'Within 5 pts'}
            </button>
          ))}
        </div>
        <div className="gv-cards">
          {shown.map((c) => <RaceCard key={c.id} c={c} prior={seats.find((s) => s.abbr === c.state)?.prior} />)}
          {!races.length && <p className="gv-muted">{error ? 'Could not load results.' : 'Loading results…'}</p>}
        </div>
      </section>
    </div>
  );
}

export function RaceCard({ c, prior, big }: { c: Contest; prior?: string; big?: boolean }) {
  const p24 = pres24(c.state);
  const winner = c.lines.find((l) => l.won);
  const flip = winner && prior && side(winner.party) !== prior;
  return (
    <article className={`gv-card ${big ? 'big' : ''}`}>
      <div className="gv-ctop">
        <Link to={`/governors/${c.state}`} className="gv-st">{stateName(c.state)}</Link>
        <span className={`gv-badge ${c.called ? 'called' : ''}`}>{c.called ? (flip ? 'Called · FLIP' : 'Called') : c.status === 'too_early' ? 'Too early' : c.status === 'too_close' ? 'Too close' : 'Uncalled'}</span>
      </div>
      <ul className="gv-lines">
        {c.lines.slice(0, big ? 8 : 3).map((l) => (
          <li key={l.id} className={l.won ? 'won' : ''}>
            <Avatar name={l.name} party={l.party} src={l.photo} size={big ? 44 : 34} />
            <span className="gv-nm">{l.name}{l.incumbent ? ' (inc.)' : ''} <small>{l.party}</small>{l.won && <span className="gv-check" aria-label="winner"> ✓</span>}</span>
            <span className="gv-pct">{c.total ? `${l.pct.toFixed(1)}%` : '–'}</span>
            <span className="gv-bar" aria-hidden="true"><span style={{ width: `${l.pct}%`, background: PARTY_HEX[l.party] }} /></span>
            {big && <span className="gv-votes">{l.votes.toLocaleString()} votes</span>}
          </li>
        ))}
      </ul>
      <div className="gv-foot">
        <span>{c.eevp}% expected vote</span>
        {c.dMinusR !== undefined && c.total > 0 && p24 !== undefined && (
          <span title="Governor margin vs 2024 presidential margin">{signed(c.dMinusR)} vs pres ’24 {signed(p24)} → <b>{(c.dMinusR - p24 >= 0 ? 'D' : 'R')} swing {Math.abs(c.dMinusR - p24).toFixed(1)}</b></span>
        )}
      </div>
    </article>
  );
}
