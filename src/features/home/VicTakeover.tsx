/** Home-page takeover for the Victorian state election (Sat 28 Nov 2026). Live data from /api/vic/live; after polls close it
 *  switches to the live count from /api/au/results. Hidden a week after election day. */
import { useMemo } from 'react';
import { Button, Countdown, Skeleton, useNow } from '../../components';
import { useAuResults } from '../au/api';
import { partyKey } from '../au/model';
import { AverageBars, EarlyVotes, NewestPoll, ProjectionBar, TppBar } from '../au/VicLiveWidgets';
import { VIC_NAME, useVicLive, vicColor } from '../au/vicLive';
import '../au/vic-live.css';
import '../../lib/liquidGlass';
import { Link } from 'react-router-dom';

/** Polls close 6pm AEDT Sat 28 Nov 2026 (UTC+11). */
export const VIC_CLOSE = Date.parse('2026-11-28T18:00:00+11:00');
const HIDE_AFTER = Date.parse('2026-12-05T00:00:00+11:00');

function Counting() {
  const res = useAuResults('vic2026');
  const tally = useMemo(() => {
    const o: Record<string, { won: number; lead: number }> = {};
    for (const s of Object.values(res.data?.seats ?? {})) {
      const p = s.called ?? s.leader;
      if (!p) continue;
      let k = partyKey(p); if (['LIB', 'NAT', 'LNP'].includes(k)) k = 'LNP';
      o[k] ??= { won: 0, lead: 0 }; o[k][s.called ? 'won' : 'lead']++;
    }
    return Object.entries(o).sort((a, b) => b[1].won + b[1].lead - (a[1].won + a[1].lead));
  }, [res.data]);
  const counting = res.data && res.data.status !== 'pre-election' && tally.length > 0;
  return (
    <div className="vt__panel lg">
      <h3>{res.data?.status === 'final' ? 'Final result' : 'Live count · won + leading'}</h3>
      {counting ? (
        <div className="vt__big" style={{ gap: 18 }}>
          {tally.slice(0, 4).map(([k, v]) => <span key={k}><b className="num" style={{ color: vicColor(k) }}>{v.won + v.lead}</b> <span className="faint">{VIC_NAME[k] ?? k}{v.lead ? ` (${v.won} won)` : ''}</span></span>)}
        </div>
      ) : <p className="vt__note">Polls have closed. Results appear here as the VEC reports them. 45 seats for a majority.</p>}
    </div>
  );
}

export default function VicTakeover() {
  const now = useNow(30000);
  const { data, error, loading } = useVicLive();
  if (now > HIDE_AFTER) return null;
  const closed = now >= VIC_CLOSE;
  const days = Math.max(0, Math.ceil((VIC_CLOSE - now) / 864e5));
  const p = data?.projection;
  return (
    <section className="vt" aria-labelledby="vt-title">
      <div className="vt__top">
        <span className="vt__live">{closed ? 'Counting' : 'Live data'}</span>
        <span className="kicker kicker--accent">Victorian state election</span>
        <span className="kicker kicker--muted">Saturday 28 November · polls close 6pm AEDT</span>
      </div>
      <h2 id="vt-title" className="vt__title">
        {closed ? <>Victoria has <em>voted</em></> : <>Victoria votes <em>{days <= 1 ? 'tomorrow' : `in ${days} days`}</em></>}
        {!closed && <span className="vt__count">Polls close in <span className="num"><Countdown to={VIC_CLOSE} compact doneLabel="now" /></span></span>}
      </h2>
      {data?.polls && !closed && <NewestPoll d={data} />}
      {loading && !data ? <Skeleton lines={4} /> : error && !data ? <p className="vt__err">Live poll data is briefly unavailable. The Victoria hub has everything else.</p> : data && (
        <div className="vt__grid">
          {closed && <Counting />}
          {data.polls && (
            <div className="vt__panel lg">
              <h3>Poll average · latest {data.polls.averageOf.length}</h3>
              <AverageBars d={data} compact />
              <TppBar d={data} />
            </div>
          )}
          {data.model && !closed && (
            <div className="vt__panel lg">
              <h3>PolTok seat model · {data.model.sims.toLocaleString()} simulations</h3>
              <div className="vt__big">{(['LNP', 'ALP', 'ONP', 'GRN'] as const).filter((k) => data.model!.range[k]).map((k) => <span key={k} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}><b className="num" style={{ color: vicColor(k) }}>{data.model!.range[k].median}</b><span className="faint">{VIC_NAME[k]}</span></span>)}</div>
              <p className="vt__note" style={{ fontSize: 13, color: 'var(--text-2)' }}><b style={{ color: vicColor('LNP') }}>{Math.round(data.model.majority.LNP * 100)}%</b> Coalition majority · <b>{Math.round(data.model.majority.hung * 100)}%</b> hung parliament</p>
              <Link to="/au/victoria/parliament" className="lg lg--pill lg-btn" style={{ justifySelf: 'start' }}>👥 Live Parliament & every candidate →</Link>
            </div>
          )}
          {p && (
            <div className="vt__panel lg">
              <h3>If the polls are right · uniform swing</h3>
              <div className="vt__big"><b className="num" style={{ color: vicColor('LNP') }}>{p.after.LNP ?? 0}</b><span className="faint">Coalition</span><b className="num" style={{ color: vicColor('ALP') }}>{p.after.ALP ?? 0}</b><span className="faint">Labor</span></div>
              <ProjectionBar d={data} />
              <p className="vt__note">A {Math.abs(p.swing)}-point two-party swing applied evenly to the 2022 result. Illustrative, not a forecast. One Nation and independents aren't modelled.</p>
            </div>
          )}
          {data.earlyVotes && (
            <div className="vt__panel lg">
              <h3>Already voted · VEC</h3>
              <EarlyVotes d={data} />
              <p className="vt__note">Early votes cast since 17 November{data.earlyVotes.updated ? `, as of ${data.earlyVotes.updated}` : ''}.</p>
            </div>
          )}
        </div>
      )}
      <div className="vt__ctas">
        <Link to="/au/victoria/immersive" className="lg-immersive"><span className="lg-immersive__icon" aria-hidden="true">🌏</span><span><small>New · 3D</small>Enter Immersive Mode</span></Link>
        <Button variant="accent" size="lg" to="/au/victoria">{closed ? 'Live results →' : 'Victoria hub →'}</Button>
        <Button variant="ghost" size="lg" to="/au/victoria/districts">All 88 seats</Button>
        <Button variant="ghost" size="lg" to="/au/swingometer">Swingometer</Button>
      </div>
    </section>
  );
}
