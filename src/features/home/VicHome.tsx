/** Home: the Victorian election hub (under the takeover hero): tiles to every Vic feature, a live parliament preview, and
 *  the latest Victorian election news. */
import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../../lib/liquidGlass';
import { useAuNews } from '../au/api';
import { Hemicycle } from '../au/parliament/components';
import { ProfileHost } from '../au/parliament/Profile';
import { useVicLive } from '../au/vicLive';
import { useAuResults } from '../au/api';
import { partyKey } from '../au/model';
import './vic-home.css';

const TILES = [
  { to: '/au/victoria/live', emoji: '🔴', title: 'Live Desk', sub: 'The needle, race to 45, every call' },
  { to: '/au/victoria/parliament', emoji: '🏛️', title: 'Projection', sub: 'Seat model & live parliament' },
  { to: '/au/victoria/match', emoji: '💘', title: 'Who matches you?', sub: 'Swipe the issues, find your party' },
  { to: '/au/victoria/predict', emoji: '🎯', title: 'Make your calls', sub: 'Pick 15 close seats, get scored live' },
  { to: '/au/victoria/premier', emoji: '👑', title: 'Battle for Premier', sub: 'Carroll v Wilson v Pickering' },
  { to: '/au/victoria/voters', emoji: '🧭', title: 'Voter explorer', sub: 'By region, age and gender' },
  { to: '/au/victoria/candidates', emoji: '👥', title: 'Every candidate', sub: '734 profiles: who they are' },
  { to: '/au/victoria/policies', emoji: '⚖️', title: 'Compare the promises', sub: 'Party v party, by topic' },
  { to: '/au/victoria/build', emoji: '🎛️', title: 'Build your own', sub: 'Drag the vote, share your call' },
  { to: '/au/victoria/immersive', emoji: '🌏', title: 'Immersive Mode', sub: 'Fly through 3D Victoria' },
];
const ago = (t: number) => { const m = Math.max(1, Math.round((Date.now() - t) / 6e4)); return m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`; };

export default function VicHome() {
  const nav = useNavigate();
  const { data } = useVicLive();
  const news = useAuNews();
  const res = useAuResults('vic2026');
  const counting = !!res.data && res.data.status !== 'pre-election' && Object.keys(res.data.seats).length > 0;
  const live = useMemo(() => { if (!counting) return undefined; const o: Record<string, string> = {}; for (const [id, r] of Object.entries(res.data!.seats)) { const k = partyKey(r.called ?? r.leader); o[id] = ['LIB', 'NAT', 'LNP'].includes(k) ? 'LNP' : ['ALP', 'GRN', 'ONP', 'IND'].includes(k) ? k : 'OTH'; } return o; }, [counting, res.data]);
  const vicNews = useMemo(() => (news.data ?? []).filter((x) => /victoria|victorian|melbourne|carroll|jess wilson|spring street|one nation|vec\b/i.test(x.title)).slice(0, 6), [news.data]);
  return (
    <section className="vh" aria-label="Victorian election hub">
      <div className="vh__tiles">
        {TILES.map((t, i) => (
          <Link key={t.to} to={t.to} className="vh__tile lg" style={{ animationDelay: `${i * 60}ms` }}>
            <span className="vh__emoji" aria-hidden="true">{t.emoji}</span>
            <b>{t.title}</b><small>{t.sub}</small>
          </Link>
        ))}
      </div>
      <div className="vh__row">
        <div className="vh__parl lg">
          <div className="vh__head"><span className="kicker kicker--accent">{counting ? 'Live parliament' : 'Projected parliament'}</span><Link to="/au/victoria/parliament">Open →</Link></div>
          <Hemicycle data={data} view={counting ? 'live' : 'model'} live={live} onPick={(id) => nav(`/au/victoria/parliament?seat=${id}`)} />
        </div>
        <div className="vh__news lg">
          <div className="vh__head"><span className="kicker kicker--accent">Victorian election news</span><Link to="/news">All news →</Link></div>
          {vicNews.length ? (
            <ul>{vicNews.map((n) => (
              <li key={n.id}><a href={n.url} target="_blank" rel="noreferrer"><b>{n.title}</b><small>{n.source} · {ago(n.publishedAt)}</small></a></li>
            ))}</ul>
          ) : <p className="faint">{news.data ? 'No Victoria-specific stories in the feed right now.' : 'Loading the latest news…'}</p>}
        </div>
      </div>
      <ProfileHost />
    </section>
  );
}
