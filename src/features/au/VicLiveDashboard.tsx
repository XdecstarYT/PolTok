/** /au/victoria — live campaign dashboard (polls, uniform-swing projection map, knife's-edge seats, early votes). */
import { useMemo, useState } from 'react';
import { Card, Skeleton } from '../../components';
import { MapPanel, VIC_ZOOMS } from './MapPanel';
import { party, pColor, VICTORIA } from './model';
import { AverageBars, EarlyVotes, EdgeSeats, NewestPoll, PollTrend, ProjectionBar, TppBar, projectionFills, shortFirm } from './VicLiveWidgets';
import { VIC_NAME, useVicLive, vicColor } from './vicLive';
import './vic-live.css';
import '../../lib/liquidGlass';
import { Link } from 'react-router-dom';
import { FindSeat } from './parliament/FindSeat';

function SeatWatch({ name, who, margin, swing, holder }: { name: string; who: string; margin: number; swing: number; holder: string }) {
  const max = Math.max(16, margin, Math.abs(swing)) * 1.1;
  const threatened = holder === 'ALP' ? swing > 0 && margin < swing : swing < 0 && margin < -swing;
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div className="row spread" style={{ alignItems: 'baseline', gap: 10 }}>
        <span><b style={{ fontSize: 20 }}>{name}</b> <span className="faint">· {who}</span></span>
        <span className={`vl-edge__stamp ${threatened ? 'is-falls' : 'is-holds'}`}>{threatened ? 'Falls' : 'Holds'}</span>
      </div>
      <div className="vl-bars is-compact" style={{ gap: 6 }}>
        <div className="vl-bars__track" style={{ ['--c' as string]: vicColor(holder), ['--w' as string]: `${(margin / max) * 100}%`, ['--i' as string]: 0 }}><i /></div>
        <span className="faint" style={{ fontSize: 12 }}>Margin {margin}% ({VIC_NAME[holder] ?? holder})</span>
        <div className="vl-bars__track" style={{ ['--c' as string]: vicColor(swing > 0 ? 'LNP' : 'ALP'), ['--w' as string]: `${(Math.abs(swing) / max) * 100}%`, ['--i' as string]: 1 }}><i /></div>
        <span className="faint" style={{ fontSize: 12 }}>Projected swing {Math.abs(swing)}% to {swing > 0 ? 'the Coalition' : 'Labor'}</span>
      </div>
    </div>
  );
}

export function VicLiveDashboard() {
  const { data, error, loading } = useVicLive();
  const [view, setView] = useState<'projected' | 'win2022'>('projected');
  const seats = VICTORIA.seats ?? [];
  const fills = useMemo(() => projectionFills(data, view), [data, view]);
  if (loading && !data) return <Card title="Live campaign dashboard"><Skeleton lines={6} /></Card>;
  if (error && !data) return <Card title="Live campaign dashboard"><p className="au-note">Live poll data is briefly unavailable. Try again in a minute.</p></Card>;
  if (!data) return null;
  const p = data.projection;
  const nid = p?.seats['vic-niddrie'], kew = p?.seats['vic-kew'];
  const updated = new Date(data.updatedAt);
  return (
    <section className="vl-dash" aria-label="Live campaign dashboard">
      <div className="card-wide"><FindSeat /></div>
      <div className="card-wide vl-immersive-cta lg">
        <div><span className="im-badge-lite">New · 3D</span><h2>Fly through Victoria</h2><p>All 88 districts in 3D. Drag the swing and watch seats flip in real time.</p></div>
        <Link to="/au/victoria/immersive" className="lg-immersive"><span className="lg-immersive__icon" aria-hidden="true">🌏</span><span><small>Immersive Mode</small>Enter the 3D world</span></Link>
      </div>
      {data.model && (
        <div className="card-wide vl-immersive-cta lg">
          <div><span className="im-badge-lite">PolTok seat model</span><h2>Coalition {data.model.range.LNP?.median ?? 0} · Labor {data.model.range.ALP?.median ?? 0} · One Nation {data.model.range.ONP?.median ?? 0} · Greens {data.model.range.GRN?.median ?? 0}</h2><p>{Math.round(data.model.majority.LNP * 100)}% chance of a Coalition majority. See every seat's win chances, a live parliament of faces, and every candidate.</p></div>
          <div className="row row-wrap" style={{ gap: 10 }}>
            <Link to="/au/victoria/parliament" className="lg lg--pill lg-btn">👥 Live Parliament →</Link>
            <Link to="/au/victoria/candidates" className="lg lg--pill lg-btn">🪪 All candidates</Link>
            <Link to="/au/victoria/build" className="lg lg--pill lg-btn">🎛️ Build your own</Link>
          </div>
        </div>
      )}
      {data.polls && (
        <Card className="card-wide" title="Live poll tracker" kicker={`${data.polls.count} polls this year · rolling four-poll average · updated ${updated.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}`} live>
          <div style={{ display: 'grid', gap: 14 }}>
            <NewestPoll d={data} />
            <PollTrend d={data} height={300} width={1000} />
          </div>
        </Card>
      )}
      {data.polls && (
        <Card title="Poll average" kicker={`Latest ${data.polls.averageOf.length}: ${data.polls.averageOf.map(shortFirm).join(', ')}`}>
          <div style={{ display: 'grid', gap: 18 }}><AverageBars d={data} /><TppBar d={data} /></div>
        </Card>
      )}
      {p && (
        <Card title="If the polls are right" kicker={`Uniform ${Math.abs(p.swing)}-point two-party swing · illustrative`}>
          <div style={{ display: 'grid', gap: 14 }}>
            <div className="vt__big"><b className="num" style={{ color: vicColor('LNP') }}>{p.after.LNP ?? 0}</b><span className="faint">Coalition</span><b className="num" style={{ color: vicColor('ALP') }}>{p.after.ALP ?? 0}</b><span className="faint">Labor</span><b className="num" style={{ color: vicColor('GRN') }}>{p.after.GRN ?? 0}</b><span className="faint">Greens</span></div>
            <ProjectionBar d={data} />
            <p className="vl-method">{data.method}</p>
          </div>
        </Card>
      )}
      {p && (
        <div className="card-wide">
          <MapPanel
            layer="vic"
            seats={seats}
            fills={fills}
            title="Projection map"
            legendNote="Legend counts show seat holders before the election; colours follow the selected view."
            regions={VIC_ZOOMS}
            kicker={view === 'projected' ? `Seats that change under a ${Math.abs(p.swing)}-pt uniform swing are shown solid` : '2022 result (official pendulum)'}
            action={
              <div className="vl-toggle" role="group" aria-label="Map view">
                <button type="button" aria-pressed={view === 'projected'} onClick={() => setView('projected')}>Projected</button>
                <button type="button" aria-pressed={view === 'win2022'} onClick={() => setView('win2022')}>2022</button>
              </div>
            }
            tooltip={(s) => {
              const v = p.seats[s.id];
              return (
                <div className="au-tip">
                  <b>{s.name}</b>
                  {v ? <>
                    <div><i style={{ background: vicColor(v.win2022) }} /> 2022: {VIC_NAME[v.win2022] ?? party(v.win2022).short} by {v.margin}% (v {VIC_NAME[v.vs] ?? v.vs})</div>
                    <div className="mono" style={{ color: v.projected !== v.win2022 ? vicColor(v.projected) : undefined }}>Projected: {VIC_NAME[v.projected] ?? v.projected}{v.projected !== v.win2022 ? ' · GAIN' : ''}</div>
                  </> : <div><i style={{ background: pColor(s.party) }} /> {party(s.party).short}</div>}
                </div>
              );
            }}
          />
        </div>
      )}
      {p && (
        <Card title="Knife's edge" kicker={`Labor seats closest to the ${Math.abs(p.swing)}-pt line`}>
          <EdgeSeats d={data} />
        </Card>
      )}
      {p && (nid || kew) && (
        <Card title="Leaders' seats" kicker="Uniform-swing check · not a forecast">
          <div style={{ display: 'grid', gap: 22 }}>
            {nid && <SeatWatch name="Niddrie" who="Premier Ben Carroll" margin={nid.margin} swing={p.swing} holder={nid.win2022} />}
            {kew && <SeatWatch name="Kew" who="Opposition Leader Jess Wilson" margin={kew.margin} swing={p.swing} holder={kew.win2022} />}
          </div>
        </Card>
      )}
      {data.earlyVotes && (
        <Card title="Early votes" kicker="Victorian Electoral Commission · daily">
          <EarlyVotes d={data} />
        </Card>
      )}
      <p className="vl-method card-wide">
        Sources: {Object.values(data.sources).join(' · ')}. Refreshed every 10 minutes.
        {data.errors?.length ? ` Some sources are temporarily unavailable (${data.errors.length}).` : ''}
      </p>
    </section>
  );
}
