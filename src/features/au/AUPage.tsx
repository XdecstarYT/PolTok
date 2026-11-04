/** /au — Australia hub (AU-UI). Data: src/data/au.ts (static, researched) + /api/au/* (live). */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card, Countdown, LiveDot } from '../../components';
import { fmtDay } from '../../components/time';
import { useAuMarkets, useAuNews } from './api';
import { MapPanel, type Region } from './MapPanel';
import { AU_POLLS, counts, FEDERAL, leader, normPolls, OTHER, VIC_CLOSE, VICTORIA, type AuSeat } from './model';
import { FeedStatus, Hemicycle, LeaderCard, MarketsPanel, NewsPanel, PollsPanel, Pendulum, TallyBar } from './widgets';
import './au.css';

const NSW_DATE = Date.parse('2027-03-27T07:00:00Z');

export const FED_REGIONS: Region[] = [
  { id: 'all', label: 'All', match: () => true },
  ...['NSW', 'VIC', 'QLD', 'WA', 'SA'].map((st) => ({ id: st, label: st, match: (s: AuSeat) => s.state === st })),
  { id: 'small', label: 'TAS·ACT·NT', match: (s: AuSeat) => ['TAS', 'ACT', 'NT'].includes(s.state) },
];

export default function AUPage() {
  const news = useAuNews();
  const markets = useAuMarkets();
  const pm = leader(FEDERAL.pm);
  const opp = leader(FEDERAL.opposition);
  const house = useMemo(() => counts(FEDERAL.house), []);
  const senate = useMemo(() => counts(FEDERAL.senate), []);
  const fedPolls = useMemo(() => normPolls(AU_POLLS.federal), []);
  const houseTotal = house.reduce((a, [, v]) => a + v, 0) || 150;
  const senateTotal = senate.reduce((a, [, v]) => a + v, 0) || 76;
  const seats = FEDERAL.seats ?? [];
  const marginals = seats.filter((s) => s.margin != null && s.margin < 3).length;
  const vicPrem = leader(VICTORIA.premier);
  const vicOpp = leader(VICTORIA.opposition);

  return (
    <div className="page au-page">
      <header className="au-head">
        <div>
          <div className="au-kicker mono"><LiveDot /> AUSTRALIA · 48TH PARLIAMENT</div>
          <h1>Australia</h1>
          <p className="au-sub">Federal parliament, polls, markets and the road to Victoria's 28 November state election.</p>
        </div>
        <dl className="au-stats mono">
          <div><dt>House</dt><dd>{houseTotal} seats</dd></div>
          <div><dt>Senate</dt><dd>{senateTotal} seats</dd></div>
          <div><dt>Marginal &lt;3%</dt><dd>{marginals}</dd></div>
          <div><dt>Vic polls close</dt><dd><Countdown to={VIC_CLOSE} compact doneLabel="Closed" /></dd></div>
        </dl>
      </header>

      <div className="au-leaders">
        <LeaderCard role="Prime Minister" name={pm.name} partyCode={pm.party ?? 'ALP'} seat={pm.seat} />
        <LeaderCard role="Opposition Leader" name={opp.name} partyCode={opp.party ?? 'LIB'} seat={opp.seat} />
        <Link to="/au/victoria" className="au-vic-cta">
          <span className="mono">VIC STATE ELECTION · SAT 28 NOV</span>
          <b>Victoria decides</b>
          <span className="muted">{vicPrem.name} (ALP) v {vicOpp.name} (LIB) · 45 seats for majority</span>
          <Countdown to={VIC_CLOSE} doneLabel="Polls closed" />
        </Link>
      </div>

      <div className="au-grid-2">
        <Hemicycle title="House of Representatives" total={houseTotal} comp={house} majority={76} govLabel="Labor majority government" note={<>Party standings after defections and by-elections (Joyce to One Nation; One Nation won Farrer; Spender and Steggall formed Community Strong).</>} />
        <Hemicycle title="Senate" total={senateTotal} comp={senate} majority={39} govLabel="76 senators · 39 to pass alone" note="Crossbench split is uncertain in published sources; shown as compiled by PolTok research." />
      </div>

      <Card title="House balance" kicker="Seats held now">
        <TallyBar comp={house} total={houseTotal} majority={76} />
      </Card>

      <div className="au-grid-main">
        <PollsPanel polls={fedPolls} title="Federal voting intention" kicker="Primary vote · One Nation surge" />
        <div className="au-side">
          <MarketsPanel markets={markets.data} error={markets.error} />
          <FeedStatus updated={markets.updated} error={markets.error} label="Polymarket" />
        </div>
      </div>

      <MapPanel
        layer="federal"
        seats={seats}
        title="Federal electorates"
        kicker="150 divisions · coloured by holding party"
        regions={FED_REGIONS}
        legendNote="Click a division for its member, margin and news. Boundaries: ABS CED 2025."
      />

      <Pendulum seats={seats} title="Federal pendulum" />

      <section className="au-elections">
        <h2 className="au-h2">Upcoming & recent elections</h2>
        <div className="au-el-grid">
          <Link to="/au/victoria" className="au-el au-el--hot">
            <span className="mono">VICTORIA · STATE</span>
            <b>{fmtDay(Date.parse('2026-11-28T00:00:00Z'))}</b>
            <span className="muted">88 Assembly seats · polls close 6pm AEDT</span>
            <Countdown to={VIC_CLOSE} doneLabel="Polls closed" />
          </Link>
          <div className="au-el">
            <span className="mono">NEW SOUTH WALES · STATE</span>
            <b>27 March 2027</b>
            <span className="muted">93 Assembly seats</span>
            <Countdown to={NSW_DATE} compact />
          </div>
          {OTHER.filter((e) => !/new south wales/i.test(e.name)).map((e) => (
            <div className={`au-el ${e.status === 'held' ? 'is-past' : ''}`} key={e.name + e.date}>
              <span className="mono">{e.status.toUpperCase()}</span>
              <b>{e.name}</b>
              <span className="num muted">{e.date}</span>
              {e.note && e.note !== 'TBD' && <span className="au-el-note">{e.note}</span>}
            </div>
          ))}
        </div>
      </section>

      <NewsPanel items={news.data} error={news.error} limit={14} />

      <p className="au-foot muted">
        Static data (composition, seats, margins, polls) is PolTok research compiled 4 Nov 2026 from the AEC, Wikipedia pendulums and pollster releases; margins are 2025 two-candidate-preferred.
        Markets and news are live feeds.
      </p>
    </div>
  );
}
