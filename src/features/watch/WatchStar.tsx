import { useWatchlist, auWatchId } from '../../lib/watchlist';
import { useToast } from '../../components';
import './watch.css';

/** Star toggle for a US race (`raceId="PA-SEN"`) or an AU seat (`auSeatId="kooyong"`). */
export function WatchStar({ raceId, auSeatId, label, compact }: { raceId?: string; auSeatId?: string; label?: string; compact?: boolean }) {
  const { has, toggle } = useWatchlist();
  const toast = useToast();
  const id = raceId ?? (auSeatId ? auWatchId(auSeatId) : '');
  if (!id) return null;
  const on = has(id);
  const name = label ?? raceId ?? auSeatId;
  return (
    <button
      type="button"
      className={`wt-star ${on ? 'is-on' : ''} ${compact ? 'wt-star--compact' : ''}`}
      aria-pressed={on}
      aria-label={on ? `Remove ${name} from watchlist` : `Add ${name} to watchlist`}
      title={on ? 'Watching — click to remove' : 'Add to watchlist'}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(id);
        toast.push({ kicker: 'WATCHLIST', title: on ? `Removed ${name}` : `Watching ${name}`, body: on ? undefined : 'Alerts on calls & lead changes', tone: 'info', to: '/watch', duration: 2600 });
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
        <path d="M12 2.8l2.85 5.78 6.38.93-4.62 4.5 1.09 6.35L12 17.36l-5.7 3 1.09-6.35-4.62-4.5 6.38-.93z" />
      </svg>
      {!compact && <span>{on ? 'Watching' : 'Watch'}</span>}
    </button>
  );
}

export default WatchStar;
