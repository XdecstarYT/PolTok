import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, EmptyState, SectionHeader, Skeleton, Tabs, fmtTime, tzAbbr } from '../../components';
import { stateByAbbr } from '../../data';
import { POLL_SERIES } from '../../data/polls';
import { PARTY_HEX, fmtInt } from '../../lib/format';
import { useSettings } from '../../lib/settings';
import { NYT_CREDIT, fmtSigned, loadOverview, loadRaceDetail, type NRace, type Overview, type RaceDetail } from './nyt';
import { Scatter, ShiftMap, type ScatterPt } from './charts';
import './analysis.css';

const pc = (p: string) => (PARTY_HEX as Record<string, string>)[p] ?? '#8b93a7';
const swingOf = (r: NRace) => (r.margin != null && r.pres24 ? r.margin - r.pres24.margin : undefined);
const Signed = ({ v, d = 1 }: { v?: number; d?: number }) => (v == null ? <span className="faint">—</span> : <b className={`num ${v > 0 ? 'dem' : v < 0 ? 'rep' : ''}`}>{fmtSigned(v, d)}</b>);

export default function AnalysisPage() {
  useSettings();
  const [ov, setOv] = useState<Overview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    loadOverview().then(setOv, (e) => setErr(String(e?.message ?? e)));
  }, []);
  if (err) return <div className="page"><EmptyState title="Couldn’t load the NYT results feed" description={err} /></div>;
  if (!ov) return <div className="page an"><Skeleton height={40} width={320} /><Skeleton height={300} style={{ marginTop: 16 }} /></div>;
  return <Analysis ov={ov} />;
}

function Analysis({ ov }: { ov: Overview }) {
  const statewide = useMemo(() => ov.races.filter((r) => r.chamber !== 'house'), [ov]);
  const contested = (r: NRace) => r.margin != null && !r.uncontested && !r.jungle;

  /* ── House popular vote ── */
  const hpv = useMemo(() => {
    const s = { D: 0, R: 0, O: 0, races: 0 };
    for (const r of ov.races) {
      if (r.chamber !== 'house') continue;
      s.races++;
      for (const [p, v] of Object.entries(r.partyVotes)) {
        if (p === 'D') s.D += v!;
        else if (p === 'R') s.R += v!;
        else s.O += v!;
      }
    }
    const tot = s.D + s.R + s.O;
    return { ...s, tot, margin: tot ? ((s.D - s.R) / tot) * 100 : 0 };
  }, [ov]);
  const flips = ov.races.filter((r) => r.flipped && r.winner);
  const calls = ov.races.filter((r) => r.winner);

  /* ── Swing ── */
  const [swCh, setSwCh] = useState<'senate' | 'governor'>('senate');
  const swingRows = useMemo(() => statewide.filter((r) => r.chamber === swCh && contested(r) && r.pres24).map((r) => ({ r, s: swingOf(r)! })).sort((a, b) => b.s - a.s), [statewide, swCh]);
  const pts: ScatterPt[] = swingRows.map(({ r }) => ({ id: r.nytId, label: r.label, x: r.pres24!.margin, y: r.margin!, color: pc(r.winner?.party ?? (r.margin! > 0 ? 'D' : 'R')), shape: r.winner ? 'circle' : 'square' }));
  const avgSwing = swingRows.length ? swingRows.reduce((a, b) => a + b.s, 0) / swingRows.length : 0;
  const medSwing = swingRows.length ? swingRows[Math.floor(swingRows.length / 2)].s : 0;

  /* ── Over-performers (all chambers, ≥90% expected vote in) ── */
  const over = useMemo(() => ov.races.filter((r) => contested(r) && r.pres24 && r.eevp >= 90).map((r) => ({ r, s: swingOf(r)! })).sort((a, b) => b.s - a.s), [ov]);

  /* ── Polling accuracy ── */
  const polls = useMemo(() => {
    const rows: { id: string; label: string; poll: number; result: number; n: number; names: string; link?: string }[] = [];
    const P = { d: 'D', r: 'R', i: 'I' } as Record<string, 'D' | 'R' | 'I'>;
    const avg = (s: (typeof POLL_SERIES)[number], a: string, b: string) => {
      const sorted = [...s.polls].filter((p) => p.values[a] != null && p.values[b] != null && p.date <= '2026-11-03').sort((x, y) => (x.date < y.date ? 1 : -1));
      if (!sorted.length) return null;
      const cut = new Date(Date.parse(sorted[0].date) - 14 * 864e5).toISOString().slice(0, 10);
      let use = sorted.filter((p) => p.date >= cut);
      if (use.length < 3) use = sorted.slice(0, 3);
      return { m: use.reduce((acc, p) => acc + p.values[a] - p.values[b], 0) / use.length, n: use.length };
    };
    for (const s of POLL_SERIES) {
      if (s.id === 'generic-ballot') {
        const a = avg(s, 'D', 'R');
        if (a && hpv.tot) rows.push({ id: s.id, label: 'Generic ballot → House popular vote', poll: a.m, result: hpv.margin, n: a.n, names: 'Democrats vs Republicans' });
        continue;
      }
      if (s.keys.length < 2) continue;
      const r = ov.races.find((x) => x.id === s.id);
      if (!r || !r.totalVotes) continue;
      const [k0, k1] = s.keys;
      const p0 = P[k0.key.slice(-1)], p1 = P[k1.key.slice(-1)];
      const sh = (p: 'D' | 'R' | 'I') => r.share[p] ?? (p === 'I' ? r.share.O : undefined);
      const a = avg(s, k0.key, k1.key);
      const s0 = sh(p0), s1 = sh(p1);
      if (!a || s0 == null || s1 == null) continue;
      // Express as D−R where possible (independent counted on the D side, labelled).
      const sign = p0 === 'R' ? -1 : 1;
      rows.push({ id: s.id, label: r.label, poll: sign * a.m, result: sign * (s0 - s1), n: a.n, names: `${k0.label} vs ${k1.label}`, link: `/race/${s.id}` });
    }
    return rows.map((x) => ({ ...x, err: x.result - x.poll })).sort((a, b) => b.err - a.err);
  }, [ov, hpv]);
  const meanErr = polls.length ? polls.reduce((a, b) => a + b.err, 0) / polls.length : 0;

  /* ── Turnout ── */
  const turnout = useMemo(() => statewide.filter((r) => r.chamber === 'senate' || !statewide.some((x) => x.chamber === 'senate' && x.state === r.state))
    .filter((r) => r.totalVotes > 0)
    .map((r) => ({ r, vs24: r.pres24?.votes ? (r.expectedVote / r.pres24.votes) * 100 : undefined }))
    .sort((a, b) => (b.vs24 ?? 0) - (a.vs24 ?? 0)), [statewide]);

  /* ── County shift ── */
  const shiftable = useMemo(() => statewide.filter((r) => r.slug && contested(r)).sort((a, b) => a.label.localeCompare(b.label)), [statewide]);
  const [shiftId, setShiftId] = useState(() => shiftable.find((r) => r.id === 'GA-SEN')?.nytId ?? shiftable[0]?.nytId);
  const shiftRace = shiftable.find((r) => r.nytId === shiftId);
  const [det, setDet] = useState<RaceDetail | null>(null);
  const [detErr, setDetErr] = useState(false);
  useEffect(() => {
    if (!shiftRace?.slug) return;
    let alive = true;
    setDet(null);
    setDetErr(false);
    loadRaceDetail(shiftRace.slug, shiftRace.special).then((d) => alive && setDet(d), () => alive && setDetErr(true));
    return () => {
      alive = false;
    };
  }, [shiftRace?.slug, shiftRace?.special]);
  const countySummary = useMemo(() => {
    if (!det) return null;
    const c = det.counties.filter((x) => x.margin != null && x.pres24 != null && x.eevp >= 50);
    if (!c.length) return null;
    const towardD = c.filter((x) => x.margin! > x.pres24!).length;
    const s = c.map((x) => ({ x, s: x.margin! - x.pres24! })).sort((a, b) => b.s - a.s);
    return { n: c.length, towardD, top: s[0], bottom: s.at(-1)! };
  }, [det]);
  const raceInsights = useMemo(() => (shiftRace ? ov.insights.filter((i) => i.raceId === shiftRace.nytId && i.kind !== 'first-results').reverse() : []), [ov, shiftRace]);
  const st = shiftRace ? stateByAbbr.get(shiftRace.state) : undefined;
  const z = tzAbbr(ov.updated);

  return (
    <div className="page an">
      <h1 className="sr-only">Election analysis</h1>
      <SectionHeader
        kicker="2026 midterms · the morning after"
        title="What happened"
        sub={<>Data-driven takeaways computed from AP vote counts as published by The New York Times (updated {fmtTime(ov.updated)} {z}). Counts are still coming in; numbers will move.</>}
        action={<Link to="/replay" className="an-link">Relive the night →</Link>}
      />

      <div className="an-stats">
        <div className="an-stat card">
          <span className="kicker">House popular vote</span>
          <span className={`an-stat__big num ${hpv.margin > 0 ? 'dem' : 'rep'}`}>{fmtSigned(hpv.margin)}</span>
          <span className="an-stat__sub num">D {fmtInt(hpv.D)} · R {fmtInt(hpv.R)} · other {fmtInt(hpv.O)}</span>
          <span className="an-stat__foot">Sum of {hpv.races} district races (uncontested seats may report few/no votes){ov.houseNational ? <> · NYT national tally: D {fmtInt(ov.houseNational.D)} / R {fmtInt(ov.houseNational.R)}, {Math.round(ov.houseNational.eevp)}% of expected vote in</> : null}</span>
        </div>
        <div className="an-stat card">
          <span className="kicker">Races called by AP</span>
          <span className="an-stat__big num">{calls.length}<span className="faint"> / {ov.races.length}</span></span>
          <span className="an-stat__sub num">D {calls.filter((r) => r.winner!.party === 'D').length} · R {calls.filter((r) => r.winner!.party === 'R').length} · other {calls.filter((r) => !'DR'.includes(r.winner!.party)).length}</span>
          <span className="an-stat__foot">Senate, governor & House combined</span>
        </div>
        <div className="an-stat card">
          <span className="kicker">Seats that flipped</span>
          <span className="an-stat__big num">{flips.length}</span>
          <span className="an-stat__sub num">to D {flips.filter((r) => r.winner!.party === 'D').length} · to R {flips.filter((r) => r.winner!.party === 'R').length}</span>
          <span className="an-stat__foot">{flips.filter((r) => r.chamber !== 'house').map((r) => r.label).join(', ') || '—'}</span>
        </div>
        <div className="an-stat card">
          <span className="kicker">Median swing vs 2024 pres</span>
          <span className={`an-stat__big num ${medSwing > 0 ? 'dem' : 'rep'}`}>{fmtSigned(medSwing)}</span>
          <span className="an-stat__sub">{swCh === 'senate' ? 'Senate' : 'Governor'} races · mean {fmtSigned(avgSwing)}</span>
          <span className="an-stat__foot">2026 D−R margin minus 2024 Harris−Trump margin in the same state</span>
        </div>
      </div>

      <section className="an-sec">
        <SectionHeader as="h2" kicker="Swing" title="How far each state moved from 2024" action={<Tabs variant="pill" ariaLabel="Race type" value={swCh} onChange={(v) => setSwCh(v as 'senate' | 'governor')} tabs={[{ id: 'senate', label: 'Senate' }, { id: 'governor', label: 'Governor' }]} />} />
        <div className="an-grid an-grid--2">
          <Card title="2026 margin vs 2024 presidential margin">
            <Scatter pts={pts} xLabel="2024 presidential margin" yLabel="2026 margin" tip={(p) => {
              const r = swingRows.find((x) => x.r.nytId === p.id)!;
              return <><b>{p.label}</b><br />2024: {fmtSigned(p.x)} · 2026: {fmtSigned(p.y)}<br />Swing: <b>{fmtSigned(r.s)}</b>{r.r.winner ? <> · {r.r.winner.name} won</> : ' · not called'}</>;
            }} />
            <p className="an-note">Points above the dashed line moved toward Democrats. ● called race (colored by winner) · ■ not yet called (colored by leader). Excludes races without both a Democrat and a Republican on the ballot.</p>
          </Card>
          <Card title="By state" flush>
            <div className="an-tablewrap">
              <table className="an-table">
                <thead><tr><th>Race</th><th>2024 pres</th><th>2026</th><th>Swing</th><th>In</th></tr></thead>
                <tbody>
                  {swingRows.map(({ r, s }) => (
                    <tr key={r.nytId}>
                      <td><Link to={`/race/${r.id}`}>{r.label}</Link>{r.flipped && <span className="an-flip"> FLIP</span>}</td>
                      <td><Signed v={r.pres24!.margin} /></td>
                      <td><Signed v={r.margin} /></td>
                      <td><Signed v={s} /></td>
                      <td className="num faint">{Math.round(r.eevp)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </section>

      <section className="an-sec">
        <SectionHeader as="h2" kicker="Over- & under-performers" title="Biggest moves vs the top of the ticket in 2024" sub="All Senate, governor and House races with ≥90% of the expected vote counted and both a D and an R on the ballot (Louisiana all-party primaries excluded). House baselines are 2024 presidential results by district as published by NYT." />
        <div className="an-grid an-grid--2">
          {([['Most toward Democrats', over.slice(0, 10)], ['Most toward Republicans (or least toward D)', over.slice(-10).reverse()]] as const).map(([title, rows]) => (
            <Card key={title} title={title} flush>
              <ol className="an-rank">
                {rows.map(({ r, s }) => (
                  <li key={r.nytId}>
                    <span className="an-rank__l"><Link to={`/race/${r.id}`}>{r.label}</Link> <span className="faint">{r.chamber === 'house' ? 'House' : ''}</span><br /><span className="faint an-rank__s">2024 {fmtSigned(r.pres24!.margin)} → 2026 {fmtSigned(r.margin!)}{r.winner ? ` · ${r.winner.name}` : ''}</span></span>
                    <span className="an-rank__bar" aria-hidden="true"><i style={{ width: `${Math.min(100, (Math.abs(s) / Math.max(1, Math.abs(over[0]?.s ?? 1), Math.abs(over.at(-1)?.s ?? 1))) * 100)}%`, background: s > 0 ? PARTY_HEX.D : PARTY_HEX.R }} /></span>
                    <Signed v={s} />
                  </li>
                ))}
              </ol>
            </Card>
          ))}
        </div>
      </section>

      <section className="an-sec">
        <SectionHeader as="h2" kicker="Polling accuracy" title="Final polling average vs result" sub={<>Poll average = mean D−R margin of polls ending in the final 14 days before Nov 3 (or the last 3 polls if fewer), from PolTok’s poll database. Positive error = Democrats beat their polls. Mean error: <Signed v={meanErr} />.</>} />
        <Card flush>
          <div className="an-tablewrap">
            <table className="an-table">
              <thead><tr><th>Race</th><th>Polls</th><th>Poll avg</th><th>Result</th><th>Miss</th><th className="an-hide-s">Error</th></tr></thead>
              <tbody>
                {polls.map((p) => (
                  <tr key={p.id}>
                    <td>{p.link ? <Link to={p.link}>{p.label}</Link> : p.label}<br /><span className="faint an-rank__s">{p.names}</span></td>
                    <td className="num faint">{p.n}</td>
                    <td><Signed v={p.poll} /></td>
                    <td><Signed v={p.result} /></td>
                    <td><Signed v={p.err} /></td>
                    <td className="an-hide-s"><span className="an-err"><i style={{ left: '50%', width: `${Math.min(50, Math.abs(p.err) * 2)}%`, transform: p.err < 0 ? 'translateX(-100%)' : undefined, background: p.err > 0 ? PARTY_HEX.D : PARTY_HEX.R }} /></span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="an-note" style={{ padding: '0 16px 14px' }}>“D+” for Nebraska means the independent (Dan Osborn) side. Results are partial where counting continues.</p>
        </Card>
      </section>

      <section className="an-sec">
        <SectionHeader as="h2" kicker="Turnout" title="Votes counted vs expected" sub="“Expected” is the NYT’s estimate of the final total vote. “vs 2024” compares that expected total to the 2024 presidential vote in the state (midterms normally run well below presidential years). One statewide race per state." />
        <Card flush>
          <div className="an-tablewrap">
            <table className="an-table">
              <thead><tr><th>State</th><th>Counted</th><th>Expected</th><th>% in</th><th>vs 2024 pres</th></tr></thead>
              <tbody>
                {turnout.map(({ r, vs24 }) => (
                  <tr key={r.nytId}>
                    <td>{r.stateName} <span className="faint">({r.chamber === 'senate' ? 'Sen' : 'Gov'})</span></td>
                    <td className="num">{fmtInt(r.totalVotes)}</td>
                    <td className="num faint">{fmtInt(r.expectedVote)}</td>
                    <td><span className="an-pbar"><i style={{ width: `${Math.min(100, r.eevp)}%` }} /></span> <span className="num">{Math.round(r.eevp)}%</span></td>
                    <td className="num">{vs24 != null ? `${vs24.toFixed(0)}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      <section className="an-sec">
        <SectionHeader as="h2" kicker="County shifts" title="Where the vote moved" action={
          <select className="an-select" value={shiftId} onChange={(e) => setShiftId(e.target.value)} aria-label="Choose statewide race">
            {shiftable.map((r) => <option key={r.nytId} value={r.nytId}>{r.label}</option>)}
          </select>
        } />
        <div className="an-grid an-grid--map">
          <Card title={shiftRace ? `${shiftRace.label}: county shift vs 2024 president` : 'County shift'}>
            {detErr ? <p className="faint">Couldn’t load county data for this race.</p> : !det || !st ? <Skeleton height={320} /> : <ShiftMap stateFips={st.fips} counties={det.counties} stateName={st.name} />}
          </Card>
          <div className="stack" style={{ gap: 16 }}>
            <Card title="Summary">
              {countySummary ? (
                <ul className="an-bullets">
                  <li><b className="num">{countySummary.towardD}</b> of <b className="num">{countySummary.n}</b> counties (≥50% in) moved toward Democrats vs 2024.</li>
                  <li>Biggest move toward D: <b>{countySummary.top.x.name}</b> <Signed v={countySummary.top.s} />.</li>
                  <li>Biggest move toward R (or smallest toward D): <b>{countySummary.bottom.x.name}</b> <Signed v={countySummary.bottom.s} />.</li>
                </ul>
              ) : <p className="faint">{det ? 'No 2024 county baseline available for this race.' : 'Loading…'}</p>}
            </Card>
            <Card title="NYT race insights" kicker="Written by The New York Times">
              {raceInsights.length ? (
                <ul className="an-quotes">
                  {raceInsights.slice(0, 6).map((i) => <li key={i.id}><q>{i.text}</q> <span className="faint num">— NYT, {fmtTime(i.at)}</span></li>)}
                </ul>
              ) : <p className="faint">No NYT insights published for this race.</p>}
            </Card>
          </div>
        </div>
      </section>

      <p className="an-credit">{NYT_CREDIT}. 2024 baselines are the presidential results NYT embeds in each race file. Poll averages are PolTok’s own calculation. Nothing on this page is simulated.</p>
    </div>
  );
}
