/** Site-wide Victorian election bar: party-colour stripe, live countdown (or live-count call-out on the night), quick links. */
import { Link, useLocation } from 'react-router-dom';
import { useNow } from '../../components';

const VIC_CLOSE = Date.parse('2026-11-28T18:00:00+11:00');
const VIC_OPEN = Date.parse('2026-11-28T08:00:00+11:00');
const HIDE_AFTER = Date.parse('2026-12-12T00:00:00+11:00');
const pad = (n: number) => String(n).padStart(2, '0');

export function ElectionBar() {
  const now = useNow(1000);
  const loc = useLocation();
  if (now > HIDE_AFTER) return null;
  const left = VIC_CLOSE - now;
  const d = Math.floor(left / 864e5), h = Math.floor((left % 864e5) / 36e5), m = Math.floor((left % 36e5) / 6e4), s = Math.floor((left % 6e4) / 1e3);
  const state = now >= VIC_CLOSE ? 'live' : now >= VIC_OPEN ? 'polling' : 'pre';
  const links = [
    { to: '/au/victoria/live', label: state === 'live' ? '🔴 Live results' : '🔴 Live Desk' },
    { to: '/au/victoria/watch', label: '📺 Watch live' },
    { to: '/au/victoria/parliament', label: '🏛️ Projection' },
    { to: '/au/victoria/premier', label: '👑 Premier race' },
    { to: '/au/victoria/predict', label: '🎯 Make your calls' },
    { to: '/au/victoria/candidates', label: '👥 Candidates' },
  ];
  return (
    <div className={`eb eb--${state}`} role="region" aria-label="Victorian state election">
      <span className="eb__stripe" aria-hidden="true" />
      <div className="eb__in">
        <Link to="/au/victoria" className="eb__title">
          <span className="eb__box" aria-hidden="true">🗳️</span>
          <span><b>Victoria votes</b> <span className="eb__date">Sat 28 Nov</span></span>
        </Link>
        <span className="eb__clock" role="timer" aria-live="off">
          {state === 'live' ? <><span className="eb__dot" aria-hidden="true" />Polls closed · counting now</> : <>
            <small>{state === 'polling' ? 'Polls open · close in' : 'Polls close in'}</small>
            <b className="num">{d > 0 && <>{d}<i>d</i> </>}{pad(h)}<i>h</i> {pad(m)}<i>m</i> {pad(s)}<i>s</i></b>
          </>}
        </span>
        <nav className="eb__links" aria-label="Victorian election">
          {links.map((l) => <Link key={l.to} to={l.to} className={loc.pathname === l.to ? 'is-on' : ''}>{l.label}</Link>)}
        </nav>
      </div>
    </div>
  );
}
