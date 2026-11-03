// STUB — Design/Shell agent replaces with nav, live ticker, command palette, mobile tab bar.
import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
export const NAV = [
  { to: '/', label: 'Home' },
  { to: '/live', label: 'Live' },
  { to: '/map', label: 'Map' },
  { to: '/feed', label: 'PolTok' },
  { to: '/news', label: 'News' },
  { to: '/polls', label: 'Polls' },
  { to: '/forecast', label: 'Forecast' },
  { to: '/races', label: 'Races' },
];
export function Shell({ children }: { children: ReactNode }) {
  return (
    <>
      <nav style={{ display: 'flex', gap: 16, padding: 16 }}>
        {NAV.map((n) => <NavLink key={n.to} to={n.to}>{n.label}</NavLink>)}
      </nav>
      <main>{children}</main>
    </>
  );
}
