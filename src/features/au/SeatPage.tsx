/** /au/seat/:id — federal division or Victorian district (AU-UI). */
import { useMemo } from 'react';
import { ShareCardButton } from '../embed/ShareCardButton';
import { Link, useParams } from 'react-router-dom';
import { Card, EmptyState, PageHeader, ProgressBar } from '../../components';
import { relatedNews, useAuNews, useAuResults } from './api';
import { MapPanel } from './MapPanel';
import { FEDERAL, party, partyKey, pColor, seatById, stateName, VICTORIA } from './model';
import { fmtCounted } from './VictoriaPage';
import { FeedStatus, LeaderCard, NewsPanel } from './widgets';
import './au.css';
import { WatchStar } from '../watch/WatchStar';
import { AuNav } from './AuNav';
import { VicCandidates } from './Candidates';
import { SeatCensus, SeatResults } from './SeatData';

export default function SeatPage() {
  const { id = '' } = useParams();
  const seat = seatById.get(id);
  const isVic = seat?.chamber === 'vic';
  const res = useAuResults(isVic ? 'vic2026' : null);
  const news = useAuNews();
  const peers = useMemo(() => (seat ? (isVic ? VICTORIA.seats : FEDERAL.seats) ?? [] : []), [seat, isVic]);
  const rank = useMemo(() => {
    if (!seat || seat.margin == null) return null;
    const same = peers.filter((s) => partyKey(s.party) === partyKey(seat.party) && s.margin != null).sort((a, b) => (a.margin ?? 0) - (b.margin ?? 0));
    return { i: same.findIndex((s) => s.id === seat.id) + 1, n: same.length };
  }, [seat, peers]);
  const neighbours = useMemo(() => {
    if (!seat || seat.margin == null) return [];
    return peers.filter((s) => s.id !== seat.id && s.margin != null).sort((a, b) => Math.abs((a.margin ?? 0) - (seat.margin ?? 0)) - Math.abs((b.margin ?? 0) - (seat.margin ?? 0))).slice(0, 6);
  }, [seat, peers]);
  const surname = seat?.member?.split(/\s+/).slice(-1)[0] ?? '';
  const related = useMemo(() => (news.data ? relatedNews(news.data, seat ? [seat.name, surname] : []) : null), [news.data, seat, surname]);

  if (!seat)
    return (
      <div className="page au-page">
        <EmptyState title="Seat not found" description={<>No division or district with id “{id}”. <Link to="/au">Back to Australia</Link></>} />
      </div>
    );

  const r = isVic ? res.data?.seats?.[seat.id] : undefined;
  const status = res.data?.status;
  const c = pColor(seat.party);
  return (
    <div className="page au-page">
      <div className="au-head-wrap" style={{ ['--pc' as string]: c }}>
        <PageHeader
          className="au-pagehead"
          crumbs={[
            { to: '/', label: 'Home' },
            { to: '/au', label: 'Australia' },
            ...(isVic ? [{ to: '/au/victoria', label: 'Victoria 2026' }] : []),
            { label: seat.name },
          ]}
          kicker={isVic ? `Victoria 2026 · ${seat.state}` : `Federal · ${seat.state}`}
          title={<span className="au-seat-h"><i style={{ background: c }} aria-hidden="true" />{seat.name}</span>}
          sub={isVic ? 'Victorian Legislative Assembly district' : `Federal division · House of Representatives · ${stateName(seat.state)}`}
          meta={<><WatchStar auSeatId={seat.id} label={seat.name} /><ShareCardButton kind="au-seat" id={seat.id} /></>}
          aside={
            <dl className="au-stats mono">
              <div><dt>Held by</dt><dd style={{ color: c }}>{party(seat.party).short}</dd></div>
              <div><dt>Margin</dt><dd>{seat.margin != null ? `${seat.margin.toFixed(1)}%` : 'TBD'}</dd></div>
              <div><dt>Status</dt><dd>{seat.margin == null ? '—' : seat.margin < 3 ? 'Marginal' : seat.margin < 6 ? 'Fairly safe' : 'Safe'}</dd></div>
              {rank && <div><dt>Pendulum</dt><dd>#{rank.i} of {rank.n}</dd></div>}
            </dl>
          }
        >
          <AuNav />
        </PageHeader>
      </div>

      <div className="au-grid-main">
        <MapPanel layer={isVic ? 'vic' : 'federal'} seats={peers} selected={seat.id} title={isVic ? 'District' : 'Division'} kicker={`${seat.name} highlighted`} />
        <div className="au-side">
          <LeaderCard role={isVic ? 'Member (MP)' : 'Member (MP)'} name={seat.member || 'Vacant'} partyCode={seat.party} seat={seat.name} />
          <Card title={isVic ? 'Election night 2026' : 'Live result'} live={!!r} kicker={isVic ? 'Victorian Electoral Commission' : 'Federal'}>
            {!isVic ? (
              <p className="au-note">No federal election is being counted. The next federal election is due by 2028; {seat.name} was decided on 3 May 2025.</p>
            ) : status && status !== 'pre-election' && r ? (
              <div className="stack" style={{ gap: 10 }}>
                <span className="mono">{r.called ? `CALLED: ${party(r.called).name}` : r.leader ? `LEADING: ${party(r.leader).name}` : 'COUNTING'} · {fmtCounted(r.counted)}</span>
                {(r.tcp ?? []).map((t) => (
                  <div key={t.party}>
                    <div className="row" style={{ justifyContent: 'space-between' }}><span>{party(t.party).name}</span><b className="num">{t.pct.toFixed(1)}%</b></div>
                    <ProgressBar value={t.pct} color={pColor(t.party)} label={`${t.party} two-candidate-preferred`} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="au-note">
                {status && status !== 'pre-election' ? 'No figures for this district yet.' : 'Pre-election: no votes counted. Polls close 6pm AEDT, Sat 28 Nov. This card updates every 30 seconds.'}
              </p>
            )}
            {isVic && <FeedStatus updated={res.updated} error={res.error} label={res.data?.source ?? 'results'} />}
          </Card>
          {isVic && <VicCandidates id={seat.id} />}
          <Card title="Similar margins">
            <ul className="au-keyseats">
              {neighbours.map((s) => (
                <li key={s.id}>
                  <Link to={`/au/seat/${s.id}`}>
                    <i style={{ background: pColor(s.party) }} />
                    <span className="au-ks-n">{s.name}</span>
                    <span className="muted au-ks-m">{s.member}</span>
                    <span className="num au-ks-v">{party(s.party).short} {s.margin?.toFixed(1)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <div className="au-grid-2">
        <SeatResults id={seat.id} isVic={isVic} />
        <SeatCensus id={seat.id} isVic={isVic} name={seat.name} />
      </div>

      <NewsPanel items={related} error={news.error} title={`News mentioning ${seat.name}`} emptyNote={`No current stories mention ${seat.name}${surname ? ` or ${surname}` : ''}.`} />
      <p className="au-foot muted">Margin = {isVic ? '2022-based pre-election pendulum' : '2025 two-candidate-preferred'} margin (pp above 50). Source: PolTok research (AEC / Wikipedia); results © AEC / VEC; demographics © ABS (CC BY 4.0).</p>
    </div>
  );
}
