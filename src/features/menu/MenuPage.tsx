/** Main Menu hub: full-screen launcher of every section of PolTok. */
import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLive } from '../../lib/live';
import { useSettings } from '../../lib/settings';
import { useWatchlist } from '../../lib/watchlist';
import { useReducedMotion } from '../../components';
import './menu.css';

type Tile = { title: string; desc: string; icon: ReactNode; to?: string; action?: 'settings'; badge?: ReactNode; tone?: string };
type Section = { id: string; title: string; kicker: string; tone: string; tiles: Tile[] };

const I = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);
const ic = {
  live: I(<><circle cx="12" cy="12" r="2.5" fill="currentColor" /><path d="M7.8 7.8a6 6 0 000 8.4M16.2 7.8a6 6 0 010 8.4M5 5a10 10 0 000 14M19 5a10 10 0 010 14" /></>),
  map: I(<><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" /><path d="M9 4v14M15 6v14" /></>),
  house: I(<><path d="M3 21h18M5 21V10M19 21V10M9 21v-7h6v7M2 10l10-6 10 6" /></>),
  senate: I(<><path d="M4 20h16M6 20v-8M10 20v-8M14 20v-8M18 20v-8M3 12h18M12 3l9 5H3z" /></>),
  gov: I(<><path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z" /></>),
  people: I(<><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><circle cx="17" cy="9" r="2.4" /><path d="M16 14.2c2.8.3 5 2.6 5 5.8" /></>),
  flip: I(<><path d="M4 8h13l-3-3M20 16H7l3 3" /></>),
  ballot: I(<><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8l2 2 4-4M8 15h8" /></>),
  replay: I(<><path d="M3 12a9 9 0 109-9 9.7 9.7 0 00-6.7 2.8L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></>),
  chart: I(<><path d="M3 3v18h18" /><path d="M7 15l4-4 3 3 5-6" /></>),
  compare: I(<><rect x="3" y="4" width="7" height="16" rx="1.5" /><rect x="14" y="4" width="7" height="16" rx="1.5" /></>),
  forecast: I(<><path d="M3 17l5-5 4 3 8-8" /><path d="M15 7h5v5" /></>),
  polls: I(<><path d="M6 20V10M12 20V4M18 20v-7" /></>),
  bill: I(<><path d="M7 3h8l4 4v14H7z" /><path d="M15 3v4h4M10 12h6M10 16h6" /></>),
  au: I(<><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" /></>),
  pin: I(<><path d="M12 21s-7-6.2-7-11.5A7 7 0 0112 2.5a7 7 0 017 7C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></>),
  swing: I(<><path d="M4 18a8 8 0 0116 0" /><path d="M12 18l4.5-6.5" /><circle cx="12" cy="18" r="1.4" fill="currentColor" /></>),
  party: I(<><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></>),
  news: I(<><rect x="3" y="4" width="15" height="16" rx="2" /><path d="M18 8h3v10a2 2 0 01-2 2M7 8h7M7 12h7M7 16h4" /></>),
  feed: I(<><rect x="6" y="2.5" width="12" height="19" rx="3" /><path d="M10.5 9.5v5l4-2.5z" fill="currentColor" /></>),
  ai: I(<><path d="M12 3l1.8 4.9L19 9.5l-5.2 1.7L12 16l-1.8-4.8L5 9.5l5.2-1.6z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" /></>),
  search: I(<><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></>),
  star: I(<><path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z" /></>),
  code: I(<><path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" /></>),
  gear: I(<><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" /></>),
};

const Dot = ({ label }: { label: string }) => (
  <span className="mn-badge is-live"><span className="pulse" aria-hidden="true" />{label}</span>
);
const Count = ({ n, label }: { n: number; label: string }) => <span className="mn-badge num">{n} {label}</span>;

export default function MenuPage() {
  const { calls, source, connected, news } = useLive();
  const { setPanelOpen } = useSettings();
  const { ids } = useWatchlist();
  const reduce = useReducedMotion();
  const live = connected && source === 'live';
  const called = calls.length;
  const callsBy = (re: RegExp) => calls.filter((c) => re.test(c.raceId)).length;

  const sections: Section[] = useMemo(() => [
    {
      id: 'us', title: 'US Elections', kicker: '2026 midterms', tone: 'var(--accent)',
      tiles: [
        { title: 'Live', desc: 'Every call, as it happens', to: '/live', icon: ic.live, badge: <Dot label={live ? 'LIVE' : 'DEMO'} /> },
        { title: 'Map', desc: 'Results map, county by county', to: '/map', icon: ic.map, badge: called ? <Count n={called} label="called" /> : undefined },
        { title: 'House', desc: 'All 435 districts', to: '/house', icon: ic.house, tone: 'var(--dem)' },
        { title: 'Senate races', desc: 'Every race, ranked', to: '/races', icon: ic.senate, tone: 'var(--rep)', badge: callsBy(/-SEN/) ? <Count n={callsBy(/-SEN/)} label="called" /> : undefined },
        { title: 'Governors', desc: '36 races + state dashboards', to: '/governors', icon: ic.gov },
        { title: 'Candidates', desc: 'Every nominee & result', to: '/candidates', icon: ic.people },
        { title: 'Flips', desc: 'Seats that changed hands', to: '/flips', icon: ic.flip, tone: 'var(--tossup)' },
        { title: 'Money', desc: 'Campaign finance from the FEC', to: '/money', icon: ic.chart },
        { title: 'Ballot measures', desc: 'Statewide measures, live', to: '/measures', icon: ic.ballot },
        { title: 'Your area', desc: 'Your reps & races by address / postcode', to: '/my', icon: ic.people },
        { title: 'Replay', desc: 'Relive election night', to: '/replay', icon: ic.replay },
        { title: 'Analysis', desc: 'Swing, turnout & trends', to: '/analysis', icon: ic.chart },
        { title: 'World elections', desc: 'Global calendar, map & results', to: '/world', icon: ic.au, tone: 'var(--signal)' },
        { title: 'Compare', desc: 'Races side by side', to: '/compare', icon: ic.compare },
        { title: 'Forecast', desc: 'Model odds by chamber', to: '/forecast', icon: ic.forecast },
        { title: 'Polls', desc: 'Averages & latest polls', to: '/polls', icon: ic.polls },
        { title: '2028 race', desc: 'Presidential odds & path to 270', to: '/2028', icon: ic.map },
      ],
    },
    {
      id: 'congress', title: 'US Congress', kicker: 'Legislation', tone: 'var(--dem)',
      tiles: [{ title: 'Bills & votes', desc: 'Live bills and roll calls', to: '/parliament', icon: ic.bill }, { title: 'Members', desc: 'Every lawmaker, votes & ideology', to: '/members', icon: ic.bill }],
    },
    {
      id: 'au', title: 'Australia', kicker: 'Federal & state', tone: 'var(--ok)',
      tiles: [
        { title: 'Overview', desc: 'Federal parliament at a glance', to: '/au', icon: ic.au },
        { title: 'Victoria 2026', desc: 'State election hub', to: '/au/victoria', icon: ic.pin },
        { title: 'Swingometer', desc: 'Drag the swing, see seats fall', to: '/au/swingometer', icon: ic.swing },
        { title: 'Senate', desc: 'Upper house quotas', to: '/au/senate', icon: ic.senate },
        { title: 'NSW 2027', desc: 'Next state contest', to: '/au/nsw', icon: ic.pin },
        { title: 'Parties', desc: 'Labor, Coalition, Greens & more', to: '/au/party/ALP', icon: ic.party },
        { title: 'Parliament bills', desc: 'Bills before Canberra', to: '/parliament?tab=au', icon: ic.bill },
      ],
    },
    {
      id: 'news', title: 'News & Feed', kicker: 'Stay current', tone: 'var(--breaking)',
      tiles: [
        { title: 'News', desc: 'Breaking political headlines', to: '/news', icon: ic.news, badge: news.length ? <Count n={news.length} label="stories" /> : undefined },
        { title: 'News topics', desc: 'Topic hubs, story coverage & sources', to: '/topic/senate', icon: ic.news },
        { title: 'PolTok feed', desc: 'Swipe the night, short-form', to: '/feed', icon: ic.feed },
        { title: 'Ask PolTok AI', desc: 'Ask anything about the results', to: '/ask', icon: ic.ai, tone: 'var(--signal)' },
        { title: 'Quiz', desc: 'Issues match, daily trivia & map game', to: '/quiz', icon: ic.ballot },
      ],
    },
    {
      id: 'tools', title: 'Tools', kicker: 'Make it yours', tone: 'var(--signal)',
      tiles: [
        { title: 'Search', desc: 'Races, people, places', to: '/search', icon: ic.search },
        { title: 'Calendar', desc: 'Elections & key dates, ICS', to: '/calendar', icon: ic.forecast },
        { title: 'Watchlist', desc: 'Your starred races', to: '/watch', icon: ic.star, badge: ids.length ? <Count n={ids.length} label="starred" /> : undefined },
        { title: 'Embed builder', desc: 'Live widgets for your site', to: '/embed', icon: ic.code },
        { title: 'Settings', desc: 'Theme, data source & more', action: 'settings', icon: ic.gear },
      ],
    },
  ], [live, called, calls, news.length, ids.length]); // eslint-disable-line react-hooks/exhaustive-deps

  let i = 0;
  return (
    <div className="mn">
      <header className="mn-head">
        <p className="mn-kicker">Main menu</p>
        <h1 className="mn-title">Everything on PolTok</h1>
      </header>
      {sections.map((s) => (
        <section key={s.id} className="mn-sec" aria-labelledby={`mn-${s.id}`} style={{ '--tone': s.tone } as CSSProperties}>
          <h2 id={`mn-${s.id}`} className="mn-sec__h"><span>{s.title}</span><small>{s.kicker}</small></h2>
          <ul className="mn-grid">
            {s.tiles.map((t) => {
              const delay = Math.min(i++ * 0.025, 0.6);
              const body = (
                <>
                  <span className="mn-tile__icon">{t.icon}</span>
                  <span className="mn-tile__t">{t.title}</span>
                  <span className="mn-tile__d">{t.desc}</span>
                  {t.badge && <span className="mn-tile__b">{t.badge}</span>}
                </>
              );
              const style = (t.tone ? { '--tone': t.tone } : undefined) as CSSProperties | undefined;
              return (
                <motion.li
                  key={t.title}
                  initial={reduce ? false : { opacity: 0, y: 14, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={reduce ? { duration: 0 } : { duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] }}
                >
                  {t.action === 'settings' ? (
                    <button type="button" className="mn-tile" style={style} onClick={() => setPanelOpen(true)}>{body}</button>
                  ) : (
                    <Link to={t.to!} className="mn-tile" style={style}>{body}</Link>
                  )}
                </motion.li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
