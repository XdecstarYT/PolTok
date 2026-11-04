/** /au/party/:id — party profile: leaders, seats (federal, Senate, Victoria), polling trend, key seats, news. */
import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card, EmptyState } from '../../components';
import { AU_PARTY_PROFILES, NSW_2027, SENATORS } from '../../data/au';
import { relatedNews, useAuNews } from './api';
import { AuNav } from './AuNav';
import { AU_POLLS, FEDERAL, normPolls, party, partyKey, pColor, VICTORIA, type AuSeat, type PollRow } from './model';
import { LeaderCard, NewsPanel } from './widgets';
import './au.css';

export const PARTY_IDS = ['ALP', 'LIB', 'NAT', 'LNP', 'GRN', 'ONP', 'CSA', 'IND'];
/** Poll series key: Coalition parties share the "LNP" (Coalition) primary column. */
const pollKey = (id: string) => (['LIB', 'NAT', 'LNP'].includes(id) ? 'LNP' : id);

export default function PartyPage() {
  const { id: raw = 'ALP' } = useParams();
  const id = raw.toUpperCase();
  const prof = AU_PARTY_PROFILES[id];
  const news = useAuNews();
  const p = party(id);
  const fedSeats = useMemo(() => (FEDERAL.seats ?? []).filter((s) => partyKey(s.party) === id), [id]);
  const vicSeats = useMemo(() => (VICTORIA.seats ?? []).filter((s) => partyKey(s.party) === id && !s.vacant), [id]);
  const senators = SENATORS.filter((s) => s.party === id);
  const fedHouse = (FEDERAL.house as Record<string, number>)[id];
  const nsw = NSW_2027.composition[id];
  const fedPolls = useMemo(() => normPolls(AU_POLLS.federal), []);
  const vicPolls = useMemo(() => normPolls(AU_POLLS.victoria), []);
  const words = prof?.keywords ?? [p.name.toLowerCase()];
  const items = useMemo(() => (news.data ? relatedNews(news.data, words) : null), [news.data, words]);
  const marginal = (list: AuSeat[]) => list.filter((s) => s.margin != null).sort((a, b) => (a.margin ?? 0) - (b.margin ?? 0)).slice(0, 8);

  if (!prof && !PARTY_IDS.includes(id))
    return <div className="page au-page"><AuNav /><EmptyState title="Party not found" description={<>No profile for “{raw}”. <Link to="/au/party/ALP">Labor</Link></>} /></div>;

  return (
    <div className="page au-page">
      <AuNav />
      <nav className="au-party-pick" aria-label="Choose party">
        {PARTY_IDS.map((k) => (
          <Link key={k} to={`/au/party/${k}`} className={k === id ? 'is-on' : ''} aria-current={k === id ? 'page' : undefined}><i style={{ background: pColor(k) }} />{party(k).short}</Link>
        ))}
      </nav>
      <header className="au-head" style={{ ['--pc' as string]: p.color }}>
        <div>
          <div className="au-kicker mono">AUSTRALIA · PARTY</div>
          <h1 className="au-seat-h"><i style={{ background: p.color }} />{p.name}</h1>
          {prof?.blurb && <p className="au-sub">{prof.blurb}</p>}
        </div>
        <dl className="au-stats mono">
          <div><dt>House (fed)</dt><dd>{fedHouse ?? 0}/150</dd></div>
          <div><dt>Senate</dt><dd>{senators.length}/76</dd></div>
          <div><dt>Vic Assembly</dt><dd>{vicSeats.length}/88</dd></div>
          {nsw != null && <div><dt>NSW Assembly</dt><dd>{nsw}/93</dd></div>}
        </dl>
      </header>

      {prof && (prof.federalLeader || prof.vicLeader || prof.nswLeader) && (
        <div className="au-vic-hero">
          {prof.federalLeader && <LeaderCard role={`Federal leader${prof.federalLeader.note ? ' · ' + prof.federalLeader.note : ''}`} name={prof.federalLeader.name} partyCode={id} seat={prof.federalLeader.seat} />}
          {prof.vicLeader && <LeaderCard role={`Victorian leader${prof.vicLeader.note ? ' · ' + prof.vicLeader.note : ''}`} name={prof.vicLeader.name} partyCode={id} seat={prof.vicLeader.seat} />}
          {prof.nswLeader && <LeaderCard role={`NSW leader${prof.nswLeader.note ? ' · ' + prof.nswLeader.note : ''}`} name={prof.nswLeader.name} partyCode={id} seat={prof.nswLeader.seat} />}
        </div>
      )}

      <div className="au-grid-2">
        <Trend title="Federal primary vote" polls={fedPolls} k={pollKey(id)} color={p.color} />
        <Trend title="Victorian primary vote" polls={vicPolls} k={pollKey(id)} color={p.color} />
      </div>
      {['LIB', 'NAT', 'LNP'].includes(id) && <p className="au-note">Pollsters report the Coalition (Liberal + Nationals + LNP) as one primary figure.</p>}

      <div className="au-grid-2">
        <SeatList title="Federal seats" kicker={`${fedSeats.length} held · closest margins first`} seats={marginal(fedSeats)} empty="No federal House seats." />
        <SeatList title="Victorian districts" kicker={`${vicSeats.length} held · closest margins first`} seats={marginal(vicSeats)} empty="No Victorian Assembly districts." />
      </div>

      {senators.length > 0 && (
        <Card title="Senators" kicker={<Link to="/au/senate">{senators.length} senators · full Senate →</Link>}>
          <ul className="au-sen-list">
            {senators.map((s) => <li key={s.name}><i style={{ background: p.color }} /><span>{s.name}</span><span className="mono muted">{s.state}</span>{s.note && <small>{s.note}</small>}</li>)}
          </ul>
        </Card>
      )}

      <NewsPanel items={items} error={news.error} title={`${p.name} in the news`} emptyNote={`No stories mentioning ${p.name} in the current feed.`} />
      <p className="au-foot muted">Seat counts: federal House as of {FEDERAL.houseAsOf}; Victoria = pre-election holders; NSW per current Assembly snapshot. Polls: published primary votes compiled by PolTok.</p>
    </div>
  );
}

function SeatList({ title, kicker, seats, empty }: { title: string; kicker: string; seats: AuSeat[]; empty: string }) {
  return (
    <Card title={title} kicker={kicker}>
      {seats.length ? (
        <ul className="au-keyseats">
          {seats.map((s) => (
            <li key={s.id}>
              <Link to={`/au/seat/${s.id}`}>
                <i style={{ background: pColor(s.party) }} />
                <span className="au-ks-n">{s.name}</span>
                <span className="muted au-ks-m">{s.member}</span>
                <span className="num au-ks-v">{s.margin!.toFixed(1)}{s.vs ? ` v ${s.vs}` : ''}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : <p className="muted">{empty}</p>}
    </Card>
  );
}

/** Small line chart of one party's primary vote across published polls. */
export function Trend({ title, polls, k, color }: { title: string; polls: PollRow[]; k: string; color: string }) {
  const pts = polls.filter((r) => typeof r.primary[k] === 'number').sort((a, b) => a.ts - b.ts);
  if (pts.length < 2) return <Card title={title}><p className="muted">Not enough published polls report this party separately.</p></Card>;
  const W = 320, H = 120, P = 22;
  const t0 = pts[0].ts, t1 = pts[pts.length - 1].ts || t0 + 1;
  const vs = pts.map((r) => r.primary[k]);
  const lo = Math.floor(Math.min(...vs) - 2), hi = Math.ceil(Math.max(...vs) + 2);
  const x = (t: number) => P + ((t - t0) / Math.max(1, t1 - t0)) * (W - 2 * P);
  const y = (v: number) => H - P + -((v - lo) / Math.max(1, hi - lo)) * (H - 2 * P);
  const avg = vs.slice(-4).reduce((a, b) => a + b, 0) / Math.min(4, vs.length);
  return (
    <Card title={title} kicker={`Last 4 polls avg ${avg.toFixed(1)}% · ${pts.length} polls`} className="au-trend">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}: from ${vs[0]}% to ${vs[vs.length - 1]}%`}>
        <line x1={P} x2={W - P} y1={y(lo)} y2={y(lo)} stroke="var(--line)" />
        <text x={2} y={y(hi) + 4}>{hi}%</text>
        <text x={2} y={y(lo)}>{lo}%</text>
        <polyline fill="none" stroke={color} strokeWidth={2} points={pts.map((r) => `${x(r.ts)},${y(r.primary[k])}`).join(' ')} />
        {pts.map((r) => <circle key={r.pollster + r.date} cx={x(r.ts)} cy={y(r.primary[k])} r={3} fill={color}><title>{`${r.pollster} ${r.date}: ${r.primary[k]}%`}</title></circle>)}
        <text x={P} y={H - 4}>{pts[0].date}</text>
        <text x={W - P} y={H - 4} textAnchor="end">{pts[pts.length - 1].date}</text>
      </svg>
    </Card>
  );
}
