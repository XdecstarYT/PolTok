/**
 * /house — live results for all 435 House races (AP via NYT results-house.json, polled every 90 s).
 * Owned by src/features/house/**.
 */
import { useSeo } from '../../lib/seo';
import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader, Sheet, fmtTime, tzAbbr } from '../../components';
import { PARTY_HEX, fmtInt } from '../../lib/format';
import { STATES, raceById } from '../../data';
import { ATTRIBUTION, POLL_MS, useHouseData, type HCand, type HRace, type P } from './data';
import { HouseGeoMap, HouseHexMap, raceFill } from './maps';
import './house.css';

const MAJORITY = 218;
const PNAME: Record<P, string> = { D: 'Dem', R: 'GOP', I: 'Ind', O: 'Oth' };
const PCLASS: Record<P, string> = { D: 'd', R: 'r', I: 'i', O: 'o' };

type Status = 'all' | 'called' | 'uncalled' | 'flips' | 'close';
type SortKey = 'district' | 'margin' | 'eevp' | 'leader' | 'called';

function Pty({ p }: { p?: P }) {
  if (!p) return <span className="hs-pty hs-pty--o">—</span>;
  return <span className={`hs-pty hs-pty--${PCLASS[p]}`}>{PNAME[p]}</span>;
}

export default function HousePage() {
  useSeo({ title: 'House races', description: 'Every US House race: maps, results and the battle for control.' });
  const { data, error, fetchedAt, loading } = useHouseData();
  const [view, setView] = useState<'hex' | 'geo'>('hex');
  const [sel, setSel] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [state, setState] = useState('');
  const [status, setStatus] = useState<Status>('all');
  const [party, setParty] = useState<'all' | 'D' | 'R'>('all');
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: 'district', dir: 1 });

  const races = data?.races ?? [];
  const byKey = data?.byKey ?? new Map<string, HRace>();
  const c = data?.control;

  const lead = useMemo(() => {
    const t = { D: 0, R: 0, I: 0 };
    for (const r of races) if (!r.called && r.leader && !r.runoff) t[r.leader.party === 'D' ? 'D' : r.leader.party === 'R' ? 'R' : 'I']++;
    return t;
  }, [races]);
  const flips = useMemo(() => races.filter((r) => r.flipped).sort((a, b) => (b.calledAt ?? 0) - (a.calledAt ?? 0)), [races]);
  const uncalled = useMemo(() => races.filter((r) => !r.called).sort((a, b) => a.margin - b.margin), [races]);
  const closest = useMemo(
    () => races.filter((r) => !r.uncontested && r.cands.length > 1 && r.totalVotes > 0).sort((a, b) => a.margin - b.margin).slice(0, 12),
    [races],
  );

  const matches = (r: HRace) => {
    if (state && r.state !== state) return false;
    if (party !== 'all' && r.party !== party) return false;
    if (status === 'called' && !r.called) return false;
    if (status === 'uncalled' && r.called) return false;
    if (status === 'flips' && !r.flipped) return false;
    if (status === 'close' && !(r.margin < 5 && r.cands.length > 1)) return false;
    if (q) {
      const s = q.toLowerCase();
      if (!r.label.toLowerCase().includes(s) && !r.stateName.toLowerCase().includes(s) && !r.cands.some((x) => x.name.toLowerCase().includes(s))) return false;
    }
    return true;
  };
  const filtering = !!(state || party !== 'all' || status !== 'all' || q);
  const rows = useMemo(() => {
    const out = races.filter(matches);
    const v = (r: HRace): number | string => {
      switch (sort.k) {
        case 'margin': return r.margin;
        case 'eevp': return r.eevp;
        case 'leader': return (r.winner ?? r.leader)?.party ?? 'Z';
        case 'called': return r.called ? r.calledAt ?? 1 : 0;
        default: return `${r.state}${String(r.district).padStart(2, '0')}`;
      }
    };
    return out.sort((a, b) => {
      const x = v(a), y = v(b);
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [races, q, state, status, party, sort]);

  const dim = filtering ? (r: HRace | undefined) => !r || !matches(r) : undefined;
  const selRace = sel ? byKey.get(sel) : undefined;
  const sortBtn = (k: SortKey, label: string) => (
    <button type="button" className="hs-sort" onClick={() => setSort((s) => ({ k, dir: s.k === k ? (-s.dir as 1 | -1) : k === 'district' ? 1 : k === 'margin' ? 1 : -1 }))}>
      {label}{sort.k === k ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}
    </button>
  );
  const ariaSort = (k: SortKey) => (sort.k === k ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none');

  return (
    <div className="hs page">
      <PageHeader
        live
        kicker="U.S. House 2026"
        title="All 435 House races"
        crumbLabel="House"
        meta={<span>
            {ATTRIBUTION}. {data?.updatedAt ? <>Results updated {fmtTime(data.updatedAt)} {tzAbbr(data.updatedAt)}. </> : null}
            {fetchedAt ? <>Checked {fmtTime(fetchedAt)} · refreshes every {POLL_MS / 1000}s.</> : null}
          </span>}
      >
        {error && <p className="hs-err" role="status">Feed error: {error}{data ? ' — showing last good data.' : ''}</p>}
      </PageHeader>

      {loading && <p className="hs-empty" aria-busy="true">Loading all 435 races (≈10 MB from the AP/NYT feed)…</p>}
      {!data && error && <p className="hs-empty">Could not reach the results feed. Retrying every {POLL_MS / 1000}s.</p>}

      {data && c && (
        <>
          <Tally c={c} lead={lead} />
          <p className="hs-note">Seat totals match NYT's party balance used across PolTok: AP-called races plus same-party contests (e.g. California top-two Democrat-vs-Democrat) whose party is already certain before AP names a winner.</p>

          <section className="card hs-mapcard" aria-labelledby="hs-map-h">
            <div className="hs-mapbar">
              <h2 id="hs-map-h">Map</h2>
              <div className="hs-seg" role="group" aria-label="Map type">
                <button type="button" aria-pressed={view === 'hex'} onClick={() => setView('hex')}>Hex (1 per seat)</button>
                <button type="button" aria-pressed={view === 'geo'} onClick={() => setView('geo')}>Districts</button>
              </div>
              <Legend />
            </div>
            {view === 'hex' ? (
              <HouseHexMap byKey={byKey} selected={sel} onSelect={setSel} dim={dim} />
            ) : (
              <>
                <HouseGeoMap byKey={byKey} selected={sel} onSelect={setSel} dim={dim} focusState={state || undefined} />
                <p className="hs-note">
                  Boundaries: U.S. Census Bureau 119th Congress cartographic boundaries (2024), simplified. Several states redrew
                  their maps for 2026, so shapes there may not match the districts on this ballot. {state ? '' : 'Pick a state below to zoom in.'}
                </p>
              </>
            )}
            {view === 'hex' && <p className="hs-note">Hex positions are approximate: each state is a contiguous block, districts placed near their real location.</p>}
          </section>

          <div className="hs-grid">
            <ListCard title={`Flips (${flips.length})`} empty="No seats have changed hands yet.">
              {flips.map((r) => (
                <RaceRow key={r.key} r={r} onClick={() => setSel(r.key)} right={<span className="hs-flip"><Pty p={r.before} /> → <Pty p={r.winner?.party} /></span>} />
              ))}
            </ListCard>
            <ListCard title="Closest races" empty="No votes counted yet.">
              {closest.map((r) => (
                <RaceRow key={r.key} r={r} onClick={() => setSel(r.key)} right={<span className="hs-mono">{r.margin.toFixed(2)} pts{r.called ? ' ✓' : ''}</span>} />
              ))}
            </ListCard>
            <ListCard title={`Uncalled (${uncalled.length})`} empty="Every race has been called.">
              {uncalled.map((r) => (
                <RaceRow key={r.key} r={r} onClick={() => setSel(r.key)} right={<span className="hs-mono">{r.runoff ? 'Runoff' : r.leader ? `${r.leader.party}+${r.margin.toFixed(1)} · ${Math.round(r.eevp)}%` : 'No votes'}</span>} />
              ))}
            </ListCard>
          </div>

          <section className="card hs-tablecard" aria-labelledby="hs-tbl-h">
            <h2 id="hs-tbl-h">Every race</h2>
            <div className="hs-filters">
              <label><span className="sr-only">Search</span>
                <input type="search" placeholder="Search district or candidate" value={q} onChange={(e) => setQ(e.target.value)} />
              </label>
              <label><span className="sr-only">State</span>
                <select value={state} onChange={(e) => setState(e.target.value)}>
                  <option value="">All states</option>
                  {STATES.filter((s) => s.houseSeats > 0).map((s) => <option key={s.abbr} value={s.abbr}>{s.name}</option>)}
                </select>
              </label>
              <label><span className="sr-only">Status</span>
                <select value={status} onChange={(e) => setStatus(e.target.value as Status)}>
                  <option value="all">All races</option>
                  <option value="called">Called</option>
                  <option value="uncalled">Uncalled</option>
                  <option value="flips">Flips</option>
                  <option value="close">Margin under 5</option>
                </select>
              </label>
              <label><span className="sr-only">Party</span>
                <select value={party} onChange={(e) => setParty(e.target.value as 'all' | 'D' | 'R')}>
                  <option value="all">Any party</option>
                  <option value="D">Dem won/leading</option>
                  <option value="R">GOP won/leading</option>
                </select>
              </label>
              <span className="hs-count" aria-live="polite">{rows.length} of {races.length}</span>
            </div>
            <div className="hs-tablewrap">
              <table className="pt-table hs-table">
                <thead>
                  <tr>
                    <th aria-sort={ariaSort('district')}>{sortBtn('district', 'District')}</th>
                    <th>Candidates</th>
                    <th aria-sort={ariaSort('leader')}>{sortBtn('leader', 'Lead')}</th>
                    <th aria-sort={ariaSort('margin')} className="num">{sortBtn('margin', 'Margin')}</th>
                    <th aria-sort={ariaSort('eevp')} className="num">{sortBtn('eevp', '% in')}</th>
                    <th aria-sort={ariaSort('called')}>{sortBtn('called', 'Called')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.key} className={r.flipped ? 'is-flip' : ''}>
                      <th scope="row">
                        <button type="button" className="hs-link" onClick={() => setSel(r.key)}>
                          <i className="hs-sw" style={{ background: raceFill(r) }} aria-hidden="true" />{r.label}
                        </button>
                      </th>
                      <td className="hs-cands">
                        {r.cands.slice(0, 3).map((x) => (
                          <span key={x.id} className={x.id === r.winner?.id ? 'is-win' : ''}>
                            {x.name}{x.incumbent ? '*' : ''} <em className={`hs-c--${PCLASS[x.party]}`}>{x.party}</em>{' '}
                            {r.uncontested ? '' : <b>{x.pct.toFixed(1)}%</b>}
                          </span>
                        ))}
                      </td>
                      <td><Pty p={(r.winner ?? r.leader)?.party} /></td>
                      <td className="num hs-mono">{r.uncontested ? 'Unopp.' : r.totalVotes ? r.margin.toFixed(1) : '—'}</td>
                      <td className="num hs-mono">{Math.round(r.eevp)}%</td>
                      <td>{r.called ? <span className="hs-ok">✓ {r.calledAt ? fmtTime(r.calledAt) : 'Yes'}</span> : r.runoff ? 'Runoff' : <span className="hs-pend">Not yet</span>}{r.flipped ? <span className="hs-fliptag">FLIP</span> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="hs-note">* incumbent. Margin = leader minus runner-up, in percentage points of votes counted. “% in” is AP’s expected-vote estimate.</p>
          </section>
        </>
      )}

      <Sheet open={!!selRace} onClose={() => setSel(null)} title={selRace ? `${selRace.stateName} ${selRace.district ? `District ${selRace.district}` : 'At-large'}` : ''}>
        {selRace && <Detail r={selRace} />}
      </Sheet>
    </div>
  );
}

function Tally({ c, lead }: { c: NonNullable<ReturnType<typeof useHouseData>['data']>['control']; lead: { D: number; R: number; I: number } }) {
  const total = 435;
  const pct = (n: number) => `${(n / total) * 100}%`;
  const unc = total - c.D - c.R - c.I;
  return (
    <section className="card hs-tally" aria-label="Seat tally">
      <div className="hs-tally__nums">
        <div className="hs-t hs-t--d"><b>{c.D}</b><span>Democrats{c.flipsD ? ` · +${c.flipsD} flips` : ''}</span></div>
        <div className="hs-t hs-t--mid">
          <span>{MAJORITY} for majority</span>
          <span>{unc} uncalled{c.I ? ` · ${c.I} other` : ''}</span>
          {c.winner && <strong className={`hs-ctl hs-ctl--${PCLASS[c.winner]}`}>{c.winner === 'D' ? 'Democrats' : 'Republicans'} win the House (AP)</strong>}
        </div>
        <div className="hs-t hs-t--r"><b>{c.R}</b><span>Republicans{c.flipsR ? ` · +${c.flipsR} flips` : ''}</span></div>
      </div>
      <div className="hs-bar" role="img" aria-label={`Democrats ${c.D} called plus ${lead.D} leading; Republicans ${c.R} called plus ${lead.R} leading; ${MAJORITY} needed`}>
        <i className="hs-bar__d" style={{ width: pct(c.D) }} />
        <i className="hs-bar__d hs-bar--lead" style={{ width: pct(lead.D) }} />
        <i className="hs-bar__gap" />
        <i className="hs-bar__r hs-bar--lead" style={{ width: pct(lead.R) }} />
        <i className="hs-bar__r" style={{ width: pct(c.R) }} />
        <span className="hs-bar__218" style={{ left: pct(MAJORITY) }} aria-hidden="true" />
      </div>
      <p className="hs-tally__lead">
        Solid = called. Lighter = leading in uncalled races (D {lead.D} · R {lead.R}{lead.I ? ` · other ${lead.I}` : ''}).
        {c.prevD != null && c.prevR != null ? ` Before the election: D ${c.prevD}, R ${c.prevR}.` : ''}
      </p>
    </section>
  );
}

function Legend() {
  return (
    <div className="hs-legend" aria-label="Legend">
      <span><i style={{ background: raceFill({ party: 'D', margin: 30, called: true } as HRace) }} />D</span>
      <span><i style={{ background: raceFill({ party: 'R', margin: 30, called: true } as HRace) }} />R</span>
      <span><i className="hs-legend__hatch" />Uncalled (hatched)</span>
      <span><i className="hs-legend__ramp" />Paler = closer</span>
      <span><i className="hs-legend__flip" />Flip</span>
    </div>
  );
}

function ListCard({ title, empty, children }: { title: string; empty: string; children: ReactNode[] }) {
  return (
    <section className="card hs-list">
      <h2>{title}</h2>
      {children.length ? <ul>{children}</ul> : <p className="hs-empty">{empty}</p>}
    </section>
  );
}

function RaceRow({ r, onClick, right }: { r: HRace; onClick: () => void; right: ReactNode }) {
  const lead = r.winner ?? r.leader;
  return (
    <li>
      <button type="button" onClick={onClick} className="hs-row">
        <i className="hs-sw" style={{ background: raceFill(r) }} aria-hidden="true" />
        <span className="hs-row__k">{r.label}</span>
        <span className="hs-row__n">{lead?.name ?? '—'}</span>
        <span className="hs-row__r">{right}</span>
      </button>
    </li>
  );
}

function Detail({ r }: { r: HRace }) {
  const max = Math.max(1, ...r.cands.map((c) => c.pct));
  const raceLink = raceById.has(r.key) ? `/race/${r.key}` : null;
  return (
    <div className="hs-detail">
      <p className="hs-detail__status">
        {r.called ? <span className="hs-ok">✓ Called for {r.winner?.name} ({r.winner?.party}){r.calledAt ? ` at ${fmtTime(r.calledAt)} ${tzAbbr(r.calledAt)}` : ''}</span>
          : r.runoff ? 'Headed to a runoff' : 'Not yet called'}
        {r.flipped && <span className="hs-fliptag">FLIP {r.before}→{r.winner?.party}</span>}
        {r.uncontested && <span className="hs-pend"> · Uncontested</span>}
      </p>
      <ul className="hs-dc">
        {r.cands.map((c: HCand) => (
          <li key={c.id} className={c.id === r.winner?.id ? 'is-win' : ''}>
            <div className="hs-dc__top">
              {c.img ? <img src={c.img} alt="" width={36} height={36} loading="lazy" /> : <span className="hs-dc__ph" aria-hidden="true" />}
              <span className="hs-dc__name">{c.name}{c.incumbent ? <small> (incumbent)</small> : null}<small>{c.partyName}</small></span>
              <span className="hs-dc__pct">{r.uncontested && !c.votes ? '—' : `${c.pct.toFixed(1)}%`}<small>{fmtInt(c.votes)}</small></span>
            </div>
            <div className="hs-dc__bar"><i style={{ width: `${(c.pct / max) * 100}%`, background: PARTY_HEX[c.party] }} /></div>
          </li>
        ))}
      </ul>
      <dl className="hs-facts">
        <div><dt>Expected vote in</dt><dd>{Math.round(r.eevp)}%</dd></div>
        <div><dt>Votes counted</dt><dd>{fmtInt(r.totalVotes)}</dd></div>
        <div><dt>Margin</dt><dd>{r.cands.length > 1 && r.totalVotes ? `${(r.winner ?? r.leader)?.party}+${r.margin.toFixed(2)}` : '—'}</dd></div>
        {r.pres2024Margin != null && <div><dt>2024 president (NYT)</dt><dd>{r.pres2024Margin >= 0 ? `Harris +${r.pres2024Margin.toFixed(1)}` : `Trump +${(-r.pres2024Margin).toFixed(1)}`}</dd></div>}
      </dl>
      {r.counties.length > 0 && (
        <>
          <h3>By county / area</h3>
          <ul className="hs-counties">
            {r.counties.slice(0, 40).map((x) => (
              <li key={x.name}>
                <span>{x.name}</span>
                <span className="hs-mono">{x.lead ? `${x.lead}+${x.margin.toFixed(1)}` : '—'}</span>
                <span className="hs-mono">{Math.round(x.eevp)}%</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="hs-note">{ATTRIBUTION}.{raceLink ? <> <Link to={raceLink}>Full race page →</Link></> : null}</p>
    </div>
  );
}
