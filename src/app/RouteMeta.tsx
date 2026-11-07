/**
 * Per-route <title>, description, canonical and Open Graph tags. Runs on every pathname change so a
 * title set by one page never leaks onto the next; pages with dynamic names (candidate, country,
 * search) still override the title in their own effects, which run after this one.
 */
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ORIGIN = 'https://poltok.netlify.app';
const SITE = 'PolTok';
const DEFAULT_DESC = 'Live election results, maps, markets and news.';

type Meta = [title: string, desc?: string];

const EXACT: Record<string, Meta> = {
  '/': ['Election Night Command Center', DEFAULT_DESC],
  '/updates': ['Updates', 'The latest race calls, results and site updates.'],
  '/map': ['Results map', 'Interactive map of live results by state and district.'],
  '/live': ['Live results', 'Race-by-race live results, calls and the balance of power.'],
  '/news': ['News', 'Election news from across the political spectrum, with source bias labels.'],
  '/feed': ['PolTok feed', 'A swipeable feed of the races, polls and stories that matter right now.'],
  '/polls': ['Polls', 'Polling averages for the Senate, House, governors and approval.'],
  '/forecast': ['Forecast', 'Prediction-market odds and ratings for control of Congress.'],
  '/races': ['Races', 'Every Senate, House and governor race on the ballot.'],
  '/au': ['Australia', 'Australian federal and state elections: results, seats and polls.'],
  '/au/victoria': ['Victoria 2026', 'Victorian state election results and districts.'],
  '/au/senate': ['Australian Senate', 'Australian Senate composition and results by state.'],
  '/au/nsw': ['New South Wales', 'NSW state election seats and results.'],
  '/au/swingometer': ['Swingometer', 'Apply a uniform swing to Australian federal seats.'],
  '/au/states': ['Australian states', 'Parliaments of every Australian state and territory.'],
  '/au/history': ['Australian election history', 'Federal election results over time.'],
  '/au/polls': ['Australian polls', 'Australian federal polling average.'],
  '/au/victoria/districts': ['Victorian districts', 'Every district in the Victorian Legislative Assembly.'],
  '/watch': ['Watchlist', 'The races you follow, in one place.'],
  '/compare': ['Compare races', 'Compare races side by side.'],
  '/flips': ['Flips', 'Seats that changed party hands.'],
  '/money': ['Money', 'Campaign fundraising and spending.'],
  '/measures': ['Ballot measures', 'Statewide ballot measures and their results.'],
  '/house': ['House', 'Every U.S. House race, ratings and results.'],
  '/governors': ['Governors', 'Every governor race on the ballot.'],
  '/search': ['Search'],
  '/replay': ['Replay', 'Replay how election night unfolded.'],
  '/analysis': ['Analysis', 'Analysis of results, turnout and swing.'],
  '/candidates': ['Candidates', 'Profiles of the candidates on the ballot.'],
  '/parliament': ['Congress', 'Bills, votes and the floor schedule in Congress.'],
  '/world': ['World elections', 'Upcoming and recent elections around the world.'],
  '/nz': ['New Zealand', 'New Zealand election results.'],
  '/members': ['Members', 'Members of Congress.'],
  '/embed': ['Embed builder', 'Embed live PolTok widgets on your site.'],
  '/menu': ['Menu'],
  '/my': ['My area', 'Your local races and representatives.'],
  '/ask': ['Ask', 'Ask questions about the election.'],
  '/quiz': ['Quiz', 'Test your political knowledge.'],
  '/calendar': ['Election calendar', 'Upcoming election dates and deadlines.'],
  '/owner': ['Owner'],
  '/2028': ['2028 presidential race', 'The early field for the 2028 presidential election.'],
};

const PREFIX: [string, Meta][] = [
  ['/race/', ['Race']],
  ['/state/', ['State']],
  ['/story/', ['Story']],
  ['/topic/', ['Topic']],
  ['/source/', ['Source']],
  ['/au/seat/', ['Seat']],
  ['/au/party/', ['Party']],
  ['/au/state/', ['State']],
  ['/governors/', ['Governor race']],
  ['/candidate/', ['Candidate']],
  ['/member/', ['Member']],
  ['/parliament/bill/', ['Bill']],
  ['/nz/electorate/', ['Electorate']],
  ['/country/', ['Country']],
  ['/map/', ['Results map']],
];

function setTag(attr: 'name' | 'property', key: string, value: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = value;
}

export function metaFor(pathname: string): { title: string; desc: string } {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  const hit = EXACT[path] ?? PREFIX.find(([p]) => path.startsWith(p))?.[1] ?? EXACT['/'];
  const title = path === '/' || hit === EXACT['/'] ? `${SITE} — ${hit[0]}` : `${hit[0]} · ${SITE}`;
  return { title, desc: hit[1] ?? DEFAULT_DESC };
}

export function RouteMeta() {
  const { pathname } = useLocation();
  useEffect(() => {
    const { title, desc } = metaFor(pathname);
    const url = ORIGIN + pathname;
    document.title = title;
    setTag('name', 'description', desc);
    setTag('property', 'og:title', title);
    setTag('property', 'og:description', desc);
    setTag('property', 'og:url', url);
    setTag('name', 'twitter:title', title);
    setTag('name', 'twitter:description', desc);
    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    link.href = url;
  }, [pathname]);
  return null;
}
