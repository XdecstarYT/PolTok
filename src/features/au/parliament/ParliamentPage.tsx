/** /au/victoria/parliament — Victoria 2026: PolTok seat model + a live 88-seat parliament of faces + ratings + seat profiles. */
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Card, Countdown, PageHeader, Skeleton } from '../../../components';
import { useSeo } from '../../../lib/seo';
import '../../../lib/liquidGlass';
import { AuNav } from '../AuNav';
import { useAuResults } from '../api';
import { partyKey } from '../model';
import { VIC_NAME, useVicLive, vicColor } from '../vicLive';
import { Hemicycle, ModelSummary, RatingsBoard, SeatProfile, type HView } from './components';
import { candidatesAsAt, allCandidates } from './people';
import '../au.css';

const VIC_CLOSE = Date.parse('2026-11-28T18:00:00+11:00');

export default function ParliamentPage() {
  useSeo({ title: 'Victoria 2026: seat projection & live parliament', description: 'PolTok seat model for the Victorian election: win chances for all 88 districts, a live parliament of faces, and a profile for every candidate.' });
  const { data, loading, error } = useVicLive();
  const res = useAuResults('vic2026');
  const [params, setParams] = useSearchParams();
  const seat = params.get('seat');
  const pick = (id: string | null) => { const p = new URLSearchParams(params); if (id) p.set('seat', id); else p.delete('seat'); setParams(p, { replace: false }); };
  const counting = !!res.data && res.data.status !== 'pre-election' && Object.keys(res.data.seats ?? {}).length > 0;
  const [view, setView] = useState<HView>(counting ? 'live' : 'model');
  const live = useMemo(() => {
    if (!counting) return undefined;
    const o: Record<string, string> = {};
    for (const [id, s] of Object.entries(res.data!.seats)) { const p = s.called ?? s.leader; if (!p) continue; const k = partyKey(p); o[id] = ['LIB', 'NAT', 'LNP'].includes(k) ? 'LNP' : ['ALP', 'GRN', 'ONP', 'IND'].includes(k) ? k : 'OTH'; }
    return o;
  }, [counting, res.data]);
  const m = data?.model;
  const nCands = useMemo(() => allCandidates().length, []);

  return (
    <div className="page au-page">
      <PageHeader className="au-pagehead" kicker={counting ? 'Counting · Victorian state election' : 'Victorian state election · Sat 28 Nov 2026'} title="Seats & people" crumbLabel="Victoria parliament"
        sub={<>The PolTok seat model, a live 88-seat parliament, and a profile for all {nCands} candidates.</>}>
        <AuNav />
      </PageHeader>

      <section className="vp-hero lg">
        <span className="kicker kicker--accent">PolTok seat model</span>
        {m ? (
          <h1><em style={{ color: vicColor('LNP'), fontStyle: 'normal' }}>{m.range.LNP?.median ?? 0}</em> Coalition · <span style={{ color: vicColor('ALP') }}>{m.range.ALP?.median ?? 0}</span> Labor · <span style={{ color: vicColor('ONP') }}>{m.range.ONP?.median ?? 0}</span> One Nation · <span style={{ color: vicColor('GRN') }}>{m.range.GRN?.median ?? 0}</span> Greens</h1>
        ) : <h1>Victoria <em>2026</em></h1>}
        <p>{m ? <>Median seats across {m.sims.toLocaleString()} simulations of the latest polls ({Object.entries(m.now).map(([k, v]) => `${VIC_NAME[k] ?? k} ${v}`).join(', ')}). {Math.round(m.majority.LNP * 100)}% chance of a Coalition majority, {Math.round(m.majority.hung * 100)}% chance of a hung parliament.</> : 'Loading the latest polls…'}{' '}
          {Date.now() < VIC_CLOSE && <>Polls close in <b><Countdown to={VIC_CLOSE} compact /></b>.</>}</p>
        <div className="row row-wrap" style={{ gap: 10, marginTop: 14 }}>
          <Link to="/au/victoria/candidates" className="lg lg--pill lg-btn">👥 All {nCands} candidates</Link>
          <Link to="/au/victoria/immersive" className="lg-immersive"><span className="lg-immersive__icon" aria-hidden="true">🌏</span><span><small>3D</small>Immersive Mode</span></Link>
        </div>
      </section>

      {loading && !data ? <Card><Skeleton lines={8} /></Card> : error && !data ? <Card><p className="au-note">Live model data is briefly unavailable. Try again shortly.</p></Card> : (
        <div className="vp-grid">
          <Card className="vp-wide" title="Live Parliament" kicker={view === 'model' ? 'Projected winner · every seat' : view === '2022' ? 'Members elected in 2022' : 'Live count · leading or won'} live={view === 'live'}
            action={
              <div className="pv-toggle lg lg--pill" role="group" aria-label="Parliament view">
                <button type="button" aria-pressed={view === 'model'} onClick={() => setView('model')}>Projection</button>
                <button type="button" aria-pressed={view === '2022'} onClick={() => setView('2022')}>2022</button>
                <button type="button" aria-pressed={view === 'live'} onClick={() => setView('live')} disabled={!counting} title={counting ? '' : 'Live once counting starts after 6pm Saturday'}>Live count</button>
              </div>
            }>
            <Hemicycle data={data} view={view} live={live} onPick={pick} />
            <p className="vp-method">Hover a face for the candidate's profile card, tap for the full seat profile. Dashed, pulsing seats are toss-ups. Faces appear only where a freely licensed or official photo is available; everyone else is shown with initials.</p>
          </Card>
          {m && <Card title="Seat projection" kicker="Median, 80% range and majority chances"><ModelSummary m={m} /></Card>}
          {m && (
            <Card title="How the model works" kicker="Transparent by design">
              <div className="vp-method">
                <p>{m.method}</p>
                <details>
                  <summary>Assumed preference flows</summary>
                  <table>
                    <thead><tr><th>From ↓ / to →</th>{['ALP', 'LNP', 'GRN', 'ONP', 'IND', 'OTH'].map((k) => <th key={k}>{k}</th>)}</tr></thead>
                    <tbody>{Object.entries(m.flows).map(([f, row]) => <tr key={f}><td>{VIC_NAME[f] ?? f}</td>{['ALP', 'LNP', 'GRN', 'ONP', 'IND', 'OTH'].map((k) => <td key={k}>{row[k] != null ? `${Math.round(row[k] * 100)}%` : '—'}</td>)}</tr>)}</tbody>
                  </table>
                </details>
                <p>Candidates: Victorian Electoral Commission, as at {candidatesAsAt}. Polls: latest four on Wikipedia's Victorian polling page. This is a model, not a prediction.</p>
              </div>
            </Card>
          )}
          {m && <Card className="vp-wide" title="Every seat, rated" kicker="Tap a seat for its profile"><RatingsBoard m={m} onPick={pick} /></Card>}
        </div>
      )}
      {seat && <SeatProfile id={seat} data={data} onClose={() => pick(null)} />}
    </div>
  );
}
