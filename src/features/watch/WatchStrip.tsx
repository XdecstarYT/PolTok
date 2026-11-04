/** Compact horizontal strip of watched races for the home page. Renders a slim CTA when empty. */
import { Link } from 'react-router-dom';
import { useLive } from '../../lib/live';
import { useWatchlist } from '../../lib/watchlist';
import { PARTY_HEX } from '../../lib/format';
import { demMarginOf, fmtMargin, resolveWatch, statusLabel, type WatchItem } from './model';
import { pColor, party as auParty } from '../au/model';
import './watch.css';

export function WatchStrip() {
  const { ids } = useWatchlist();
  const { results } = useLive();
  const items = ids.map(resolveWatch).filter((x): x is WatchItem => !!x).slice(0, 12);
  if (!items.length)
    return (
      <Link to="/watch" className="wt-strip wt-strip--empty">
        <span className="wt-strip__star">★</span> Star races to build your watchlist — live cards, alerts on calls & lead changes
      </Link>
    );
  return (
    <nav className="wt-strip" aria-label="Your watchlist">
      <Link to="/watch" className="wt-strip__lbl mono">★ WATCHING</Link>
      <ul>
        {items.map((i) => {
          if (i.kind === 'au')
            return (
              <li key={i.id}>
                <Link to={`/au/seat/${i.seat.id}`} className="wt-pill" style={{ ['--wc' as string]: pColor(i.seat.party) }}>
                  <b>{i.seat.name}</b><span className="mono">{auParty(i.seat.party).short}</span>
                </Link>
              </li>
            );
          const r = results[i.id];
          const m = demMarginOf(i.race, r);
          return (
            <li key={i.id}>
              <Link to={`/race/${i.id}`} className="wt-pill" style={{ ['--wc' as string]: m == null ? 'var(--line-3)' : PARTY_HEX[m >= 0 ? 'D' : 'R'] }}>
                <b>{i.race.id}</b>
                <span className="num mono">{m == null ? statusLabel(r) : `${fmtMargin(m)} · ${Math.round(r?.expectedPct ?? 0)}%`}</span>
                {r?.status === 'called' && <span aria-label="called">✓</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default WatchStrip;
