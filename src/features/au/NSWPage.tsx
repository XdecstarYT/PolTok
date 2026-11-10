/** /au/nsw — NSW state election 2027 (same template as /au/victoria, pre-election only). */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card, Countdown, LiveDot } from '../../components';
import { fmtDay, fmtTime, tzAbbr } from '../../components/time';
import { NSW_2027 } from '../../data/au';
import { relatedNews, useAuMarkets, useAuNews } from './api';
import { AuNav } from './AuNav';
import { OTHER, party, pColor, sortParties } from './model';
import { LeaderCard, MarketsPanel, NewsPanel, TallyBar } from './widgets';
import './au.css';

const CLOSE = Date.parse(NSW_2027.pollsCloseUtc);

export default function NSWPage() {
  const news = useAuNews();
  const markets = useAuMarkets();
  const comp = useMemo(() => sortParties(Object.entries(NSW_2027.composition)), []);
  const alp = NSW_2027.composition.ALP ?? 0;
  const coal = (NSW_2027.composition.LIB ?? 0) + (NSW_2027.composition.NAT ?? 0);
  const items = useMemo(() => (news.data ? relatedNews(news.data, ['nsw', 'new south wales', 'minns', 'sloane', 'macquarie street', ...NSW_2027.keySeats.map((s) => s.name)]) : null), [news.data]);
  const upcoming = OTHER.filter((e) => !/new south wales/i.test(e.name) && /upcoming|future/i.test(e.status));

  return (
    <div className="page au-page">
      <AuNav />
      <header className="au-head">
        <div>
          <div className="au-kicker mono"><LiveDot color="var(--text-3)" label="PRE-ELECTION" /> NSW STATE ELECTION · SAT 13 MAR 2027</div>
          <h1>New South Wales 2027</h1>
          <p className="au-sub"><Link to="/au">Australia</Link> / Legislative Assembly · {NSW_2027.totalSeats} seats · {NSW_2027.majority} for majority · plus {NSW_2027.upperHouse}</p>
        </div>
        <dl className="au-stats mono">
          <div><dt>Election</dt><dd>{fmtDay(CLOSE)}</dd></div>
          <div><dt>Polls close</dt><dd>{fmtTime(CLOSE)} {tzAbbr(CLOSE)}</dd></div>
          <div><dt>Status</dt><dd>Pre-election</dd></div>
        </dl>
      </header>

      <div className="au-vic-hero">
        <Card className="au-count-card" kicker="6:00pm AEDT · 07:00 UTC" title="Polls close in">
          <Countdown to={CLOSE} doneLabel="Polls closed" />
          <p className="au-note">Moved forward from 27 March, which clashes with Easter.</p>
        </Card>
        <LeaderCard role="Premier" name={NSW_2027.premier.name} partyCode="ALP" seat={NSW_2027.premier.seat} />
        <LeaderCard role="Opposition Leader" name={NSW_2027.opposition.name} partyCode="LIB" seat={NSW_2027.opposition.seat} />
      </div>

      <Card title="Seats needed for majority" kicker="BASELINE · current Assembly (no votes cast)">
        <TallyBar comp={comp} total={NSW_2027.totalSeats} majority={NSW_2027.majority} />
        <div className="au-need">
          {([['ALP', 'Labor holds', alp], ['LIB', 'Coalition holds', coal]] as const).map(([k, l, v]) => (
            <div key={k} style={{ ['--pc' as string]: pColor(k) }}>
              <span className="mono">{l}</span>
              <b className="num">{v}</b>
              <span className="muted">{v >= NSW_2027.majority ? `${v - NSW_2027.majority + 1} to spare` : `needs ${NSW_2027.majority - v} more`}</span>
            </div>
          ))}
        </div>
        <p className="au-note">{NSW_2027.compositionNote} Labor governs in minority with crossbench support.</p>
      </Card>

      <div className="au-grid-main">
        <Card title="Key seats" kicker="Closest 2023 margins">
          <table className="pt-table au-table">
            <thead><tr><th>Seat</th><th>Held by</th><th className="num">Margin</th></tr></thead>
            <tbody>
              {NSW_2027.keySeats.map((s) => (
                <tr key={s.name}>
                  <td>{s.name}</td>
                  <td><span style={{ color: pColor(s.party) }}>■</span> {party(s.party).short}{s.vs ? <span className="muted"> v {s.vs}</span> : null}</td>
                  <td className="num">{s.margin.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="au-note">No NSW district map yet: PolTok's map covers federal divisions and Victorian districts.</p>
        </Card>
        <div className="au-side">
          <MarketsPanel title="NSW markets" markets={markets.data} error={markets.error} filter={(m) => /new south wales|nsw|minns/i.test(m.question)} />
        </div>
      </div>

      <NewsPanel items={items} error={news.error} title="NSW politics news" emptyNote="No NSW stories in the current feed." />

      <section className="au-elections">
        <h2 className="au-h2">Other upcoming contests</h2>
        <div className="au-el-grid">
          <Link to="/au/victoria" className="au-el au-el--hot"><span className="mono">VICTORIA · STATE</span><b>28 November 2026</b><span className="muted">88 Assembly seats</span></Link>
          {upcoming.map((e) => (
            <div className="au-el" key={e.name}><span className="mono">{e.status.toUpperCase()}</span><b>{e.name}</b><span className="num muted">{e.date}</span></div>
          ))}
        </div>
        <p className="au-note">Queensland, ACT, NT and WA dates are fixed-term estimates; no candidate or seat data is published yet.</p>
      </section>
    </div>
  );
}
