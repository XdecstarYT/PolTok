/** Tab navigation for the /au section. */
import { NavLink, useLocation } from 'react-router-dom';

const TABS = [
  { to: '/au', label: 'Overview', end: true },
  { to: '/au/victoria', label: 'Victoria 2026' },
  { to: '/au/swingometer', label: 'Swingometer' },
  { to: '/au/senate', label: 'Senate' },
  { to: '/au/nsw', label: 'NSW 2027' },
  { to: '/au/party/ALP', label: 'Parties' },
];

export function AuNav() {
  const loc = useLocation();
  return (
    <nav className="au-nav" aria-label="Australia sections">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `au-nav-t${isActive || (t.to.startsWith('/au/party') && loc.pathname.startsWith('/au/party')) ? ' is-on' : ''}`}>
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
