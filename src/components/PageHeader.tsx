import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';

export interface Crumb { to?: string; label: ReactNode }

/** Top-level section names for breadcrumb trails (path prefix → label). */
const SECTION: Record<string, string> = {
  live: 'Live', map: 'Map', news: 'News', feed: 'Feed', polls: 'Polls', forecast: 'Forecast', races: 'Races',
  au: 'Australia', nz: 'New Zealand', world: 'World', house: 'House', governors: 'Governors', candidates: 'Candidates',
  members: 'Members', parliament: 'Parliament', '2028': '2028', updates: "What's new", ask: 'Ask', menu: 'Menu',
  flips: 'Flips', money: 'Money', measures: 'Ballot measures', replay: 'Replay', analysis: 'Analysis', compare: 'Compare',
  watch: 'Watchlist', search: 'Search', my: 'Your area', quiz: 'Quiz', calendar: 'Calendar', embed: 'Embed',
};
/** Detail routes whose parent is a different section. */
const PARENT: Record<string, [string, string]> = {
  race: ['/races', 'Races'], state: ['/races', 'Races'], story: ['/news', 'News'], topic: ['/news', 'News'], source: ['/news', 'News'],
  candidate: ['/candidates', 'Candidates'], member: ['/members', 'Members'], country: ['/world', 'World'],
};
const AU_SUB: Record<string, string> = {
  victoria: 'Victoria 2026', senate: 'Senate', nsw: 'NSW 2027', swingometer: 'Swingometer', states: 'States & territories',
  history: 'History', polls: 'Polling average', seat: 'Seat', party: 'Party', state: 'State', districts: 'Districts',
};

/** Breadcrumb trail derived from the URL. The final crumb is `current` (usually the page title). */
export function useCrumbs(current?: ReactNode): Crumb[] {
  const { pathname } = useLocation();
  const parts = pathname.split('/').filter(Boolean);
  const out: Crumb[] = [{ to: '/', label: 'Home' }];
  if (!parts.length) return out;
  const [head, ...rest] = parts;
  if (PARENT[head]) {
    out.push({ to: PARENT[head][0], label: PARENT[head][1] });
  } else if (SECTION[head]) {
    if (rest.length) out.push({ to: `/${head}`, label: SECTION[head] });
    if (head === 'au' && rest.length > 1 && AU_SUB[rest[0]] && rest[0] === 'victoria') out.push({ to: '/au/victoria', label: AU_SUB.victoria });
  }
  const last = current ?? (rest.length ? AU_SUB[rest[rest.length - 1]] ?? decodeURIComponent(rest[rest.length - 1]).toUpperCase() : SECTION[head] ?? head);
  out.push({ label: last });
  return out;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  if (items.length < 2) return null;
  return (
    <nav className="pt-crumbs" aria-label="Breadcrumb">
      <ol>
        {items.map((c, i) =>
          i === items.length - 1 || !c.to ? (
            <li key={i}><span aria-current={i === items.length - 1 ? 'page' : undefined}>{c.label}</span></li>
          ) : (
            <li key={i}><Link to={c.to}>{c.label}</Link></li>
          ),
        )}
      </ol>
    </nav>
  );
}

/**
 * Standard page header: breadcrumbs, kicker, serif title, standfirst, meta line and an optional
 * right-hand aside (stats, controls). `children` render below (sub-nav, tabs).
 */
export function PageHeader({
  title, kicker, sub, meta, aside, live, crumbs, crumbLabel, children, className, id,
}: {
  title: ReactNode; kicker?: ReactNode; sub?: ReactNode; meta?: ReactNode; aside?: ReactNode; live?: boolean;
  /** override the derived trail; `false` hides it */
  crumbs?: Crumb[] | false;
  /** label for the current page in the trail (defaults to a string title) */
  crumbLabel?: ReactNode;
  children?: ReactNode; className?: string; id?: string;
}) {
  const derived = useCrumbs(crumbLabel ?? (typeof title === 'string' ? title : undefined));
  const trail = crumbs === false ? [] : crumbs ?? derived;
  return (
    <header className={`pt-pagehead ${className ?? ''}`}>
      {trail.length > 1 && <Breadcrumbs items={trail} />}
      <div className="pt-pagehead__row">
        <div className="pt-pagehead__main">
          {kicker && (
            <span className={`kicker ${live ? 'kicker--live' : ''}`}>
              {live && <span className="pulse" aria-hidden="true" />}
              {kicker}
            </span>
          )}
          <h1 id={id} className="pt-pagehead__title">{title}</h1>
          {sub && <p className="pt-pagehead__sub">{sub}</p>}
          {meta && <div className="pt-pagehead__meta">{meta}</div>}
        </div>
        {aside && <div className="pt-pagehead__aside">{aside}</div>}
      </div>
      {children && <div className="pt-pagehead__extra">{children}</div>}
    </header>
  );
}
