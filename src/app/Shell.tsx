/**
 * App shell: sticky top bar (wordmark, nav, live status, ⌘K search), breaking ticker,
 * mobile bottom tab bar, race-call takeover + toasts, and page transitions.
 *
 * Layout contract for pages:
 *  - `--shell-top` = height of fixed chrome above content (nav + ticker; nav only on /feed).
 *  - `--shell-bottom` = height of the mobile tab bar incl. safe area (0 on desktop).
 *  - /feed renders "immersive": no ticker, no page padding; the page should fill
 *    `height: calc(100dvh - var(--shell-top) - var(--shell-bottom))`.
 */
import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLive } from '../lib/live';
import { SimBadge, ToastProvider, Kbd, useNow, useReducedMotion } from '../components';
import { Ticker } from './shell/Ticker';
import { CommandPalette } from './shell/CommandPalette';
import { RaceCallWatcher } from './shell/RaceCallWatcher';
import { IconFeed, IconHome, IconLive, IconMap, IconNews, IconSearch } from './shell/icons';
import './shell/shell.css';

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

const TABS = [
  { to: '/', label: 'Home', Icon: IconHome },
  { to: '/live', label: 'Live', Icon: IconLive },
  { to: '/map', label: 'Map', Icon: IconMap },
  { to: '/feed', label: 'PolTok', Icon: IconFeed },
  { to: '/news', label: 'News', Icon: IconNews },
];

function Wordmark() {
  return (
    <Link to="/" className="sh-logo" aria-label="PolTok home">
      <span className="sh-logo__mark" aria-hidden="true">
        <span className="sh-logo__d" />
        <span className="sh-logo__r" />
      </span>
      <span className="sh-logo__word">
        POL<span>TOK</span>
      </span>
      <span className="sh-logo__pulse pulse" aria-hidden="true" style={{ '--pulse-c': 'var(--accent)' } as CSSProperties} />
    </Link>
  );
}

function LiveStatus() {
  const { mode, connected } = useLive();
  const sim = mode === 'simulation' || mode === 'browser-simulation';
  const state =
    mode === 'connecting' ? { cls: 'is-wait', label: 'CONNECTING' }
    : !connected && mode !== 'browser-simulation' ? { cls: 'is-wait', label: 'RECONNECTING' }
    : mode === 'browser-simulation' ? { cls: 'is-live', label: 'LIVE · LOCAL' }
    : { cls: 'is-live', label: 'LIVE' };
  return (
    <span className="sh-status">
      <span className={`sh-pill ${state.cls}`} role="status" aria-live="polite" title={sim ? 'Results stream is simulated' : 'Connected to live stream'}>
        <span className="pulse" aria-hidden="true" />
        {state.label}
      </span>
      {sim && <SimBadge compact />}
    </span>
  );
}

function Clock() {
  const now = useNow(1000);
  const t = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', second: '2-digit' }).format(now);
  return (
    <span className="sh-clock num" aria-label={`Eastern time ${t}`}>
      {t} <span>ET</span>
    </span>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const reduce = useReducedMotion();
  const immersive = loc.pathname === '/feed' || loc.pathname.startsWith('/feed/');
  const [cmdk, setCmdk] = useState(false);
  const closeCmdk = useCallback(() => setCmdk(false), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const typing = /^(input|textarea|select)$/i.test((e.target as HTMLElement)?.tagName ?? '') || (e.target as HTMLElement)?.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && k === 'k') {
        e.preventDefault();
        setCmdk((o) => !o);
      } else if (k === '/' && !typing) {
        e.preventDefault();
        setCmdk(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('is-immersive', immersive);
  }, [immersive]);

  useEffect(() => {
    if (!immersive) window.scrollTo({ top: 0 });
  }, [loc.pathname, immersive]);

  const isActive = (to: string) => (to === '/' ? loc.pathname === '/' : loc.pathname === to || loc.pathname.startsWith(to + '/'));

  return (
    <ToastProvider>
      <a href="#main" className="sh-skip">Skip to content</a>
      <div className={`sh-chrome ${immersive ? 'is-immersive' : ''}`}>
        <header className="sh-top">
          <Wordmark />
          <nav className="sh-nav" aria-label="Primary">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === '/'} className={() => `sh-nav__a ${isActive(n.to) ? 'is-active' : ''}`}>
                {isActive(n.to) && <motion.span layoutId="sh-nav-bar" className="sh-nav__bar" transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 40 }} />}
                <span className="sh-nav__t">{n.label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="sh-right">
            <Clock />
            <LiveStatus />
            <button type="button" className="sh-search" onClick={() => setCmdk(true)} aria-label="Search (Ctrl+K)">
              <IconSearch width={17} height={17} />
              <span className="sh-search__t">Search</span>
              <span className="sh-search__k"><Kbd>⌘K</Kbd></span>
            </button>
          </div>
        </header>
        {!immersive && <Ticker />}
      </div>

      <motion.main
        id="main"
        key={loc.pathname}
        className={`sh-main ${immersive ? 'sh-main--immersive' : ''}`}
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.main>

      <nav className="sh-tabbar" aria-label="Primary mobile">
        {TABS.map(({ to, label, Icon }) => {
          const on = isActive(to);
          return (
            <Link key={to} to={to} className={`sh-tab ${on ? 'is-active' : ''}`} aria-current={on ? 'page' : undefined}>
              <span className="sh-tab__icon">
                <Icon width={22} height={22} />
                {to === '/live' && <span className="sh-tab__dot" aria-hidden="true" />}
              </span>
              <span className="sh-tab__t">{label}</span>
            </Link>
          );
        })}
      </nav>

      <CommandPalette open={cmdk} onClose={closeCmdk} />
      <RaceCallWatcher />
    </ToastProvider>
  );
}
