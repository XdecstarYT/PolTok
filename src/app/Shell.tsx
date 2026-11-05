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
import { lazy, Suspense, useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent as RMouseEvent, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLive } from '../lib/live';
import { useSettings } from '../lib/settings';
import { ToastProvider, Kbd, useNow, useReducedMotion, fmtTime, tzAbbr } from '../components';
import { Ticker } from './shell/Ticker';
import { CommandPalette } from './shell/CommandPalette';
import { RaceCallWatcher } from './shell/RaceCallWatcher';
import { AskPolTok } from '../features/ask/AskPolTok';
import { UpdatePrompt } from '../lib/pwa';
import { IconGrid, IconHome, IconLive, IconMap, IconNews, IconSearch } from './shell/icons';
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
  { to: '/analysis', label: 'Analysis' },
  { to: '/au', label: 'Australia' },
];

const TABS = [
  { to: '/', label: 'Home', Icon: IconHome },
  { to: '/live', label: 'Live', Icon: IconLive },
  { to: '/map', label: 'Map', Icon: IconMap },
  { to: '/news', label: 'News', Icon: IconNews },
  { to: '/menu', label: 'Menu', Icon: IconGrid },
];

const OwnerLoginModal = lazy(() => import('../features/owner/OwnerLoginModal'));

/** Logo → home. Hidden: 10 taps within ~4s opens the owner sign-in (only the 10th tap is intercepted). */
function Wordmark() {
  const taps = useRef<number[]>([]);
  const [owner, setOwner] = useState(false);
  const onClick = (e: RMouseEvent) => {
    const now = Date.now();
    taps.current = [...taps.current.filter((t) => now - t < 4000), now];
    if (taps.current.length >= 10) {
      taps.current = [];
      e.preventDefault();
      setOwner(true);
    }
  };
  return (
    <>
    {owner && <Suspense fallback={null}><OwnerLoginModal open={owner} onClose={() => setOwner(false)} /></Suspense>}
    <Link to="/" className="sh-logo" aria-label="PolTok home" onClick={onClick}>
      <span className="sh-logo__mark" aria-hidden="true">
        <span className="sh-logo__d" />
        <span className="sh-logo__r" />
      </span>
      <span className="sh-logo__word">
        POL<span>TOK</span>
      </span>
      <span className="sh-logo__pulse pulse" aria-hidden="true" style={{ '--pulse-c': 'var(--accent)' } as CSSProperties} />
    </Link>
    </>
  );
}

function LiveStatus() {
  const { mode, connected, source } = useLive();
  const local = mode === 'browser-live' || mode === 'browser-simulation';
  const state =
    mode === 'connecting' ? { cls: 'is-wait', label: 'CONNECTING' }
    : !connected && !local ? { cls: 'is-wait', label: 'RECONNECTING' }
    : source === 'live' ? { cls: 'is-live', label: 'LIVE' }
    : { cls: 'is-demo', label: 'DEMO' };
  return (
    <span className="sh-status">
      <span className={`sh-pill ${state.cls}`} role="status" aria-live="polite" title={source === 'live' ? 'Real results: AP via The New York Times' : 'Demo replay (simulated) — change in Settings'}>
        <span className="pulse" aria-hidden="true" />
        {state.label}
      </span>
    </span>
  );
}

function Clock() {
  const now = useNow(1000);
  const t = fmtTime(now, true);
  const z = tzAbbr(now);
  return (
    <span className="sh-clock num" aria-label={`${t} ${z}`}>
      {t} <span>{z}</span>
    </span>
  );
}

/** Secondary pages, grouped under the "More" menu so the top bar fits. */
export const NAV_MORE = [
  { to: '/house', label: 'House', sub: 'All 435 districts, live' },
  { to: '/2028', label: '2028', sub: 'Presidential race odds & path to 270' },
  { to: '/embed', label: 'Embed', sub: 'Live widgets for your site' },
  { to: '/candidates', label: 'Candidates', sub: 'Every nominee, headshots & results' },
  { to: '/flips', label: 'Flips', sub: 'Seats that changed hands' },
  { to: '/measures', label: 'Ballot measures', sub: 'Live statewide measures' },
  { to: '/governors', label: 'Governors', sub: '36 races + state dashboards' },
  { to: '/replay', label: 'Replay', sub: 'Relive election night' },
  { to: '/compare', label: 'Compare', sub: 'Races side by side, polling miss' },
  { to: '/watch', label: 'Watchlist', sub: 'Your starred races' },
  { to: '/parliament', label: 'Parliament', sub: 'Live bills — US Congress & Australia' },
  { to: '/calendar', label: 'Calendar', sub: 'Elections & key dates — US & AU' },
];

function MoreMenu() {
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setOpen(false);
  }, [loc.pathname]);
  useEffect(() => {
    if (!open) return;
    const off = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', off);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('pointerdown', off);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);
  const active = NAV_MORE.some((n) => loc.pathname.startsWith(n.to));
  return (
    <div className="sh-more" ref={ref}>
      <button type="button" className={`sh-nav__a sh-more__btn ${active ? 'is-active' : ''}`} aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((o) => !o)}>
        <span className="sh-nav__t">More ▾</span>
      </button>
      {open && (
        <div className="sh-more__menu" role="menu">
          {NAV_MORE.map((n) => (
            <NavLink key={n.to} to={n.to} role="menuitem" className={({ isActive }) => `sh-more__item ${isActive ? 'is-on' : ''}`}>
              <b>{n.label}</b>
              <span>{n.sub}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const reduce = useReducedMotion();
  const immersive =
    loc.pathname === '/feed' || loc.pathname.startsWith('/feed/');
  const [cmdk, setCmdk] = useState(false);
  const { setPanelOpen: setSettingsOpen } = useSettings();
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
          <Link to="/menu" className={`sh-menubtn ${isActive('/menu') ? 'is-active' : ''}`} aria-label="Main menu" title="Main menu" aria-current={isActive('/menu') ? 'page' : undefined}>
            <IconGrid width={18} height={18} />
            <span className="sh-menubtn__t">Menu</span>
          </Link>
          <Wordmark />
          <nav className="sh-nav" aria-label="Primary">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === '/'} className={() => `sh-nav__a ${isActive(n.to) ? 'is-active' : ''}`}>
                {isActive(n.to) && <motion.span layoutId="sh-nav-bar" className="sh-nav__bar" transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 40 }} />}
                <span className="sh-nav__t">{n.label}</span>
              </NavLink>
            ))}
            <MoreMenu />
          </nav>
          <div className="sh-right">
            <Clock />
            <LiveStatus />
            <button type="button" className="sh-gear" onClick={() => setSettingsOpen(true)} aria-label="Settings" title="Settings">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
            </button>
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
      <AskPolTok />
      <UpdatePrompt />
    </ToastProvider>
  );
}
