/** Home-page "Election day" banner for NZ 2026 — shows 5 Nov → 10 Nov 2026 only. */
import { Link } from 'react-router-dom';
import { useNow } from '../../components';
import { POLLS_CLOSE } from './data';
import './nz.css';

export function NzBanner() {
  const now = useNow(30_000);
  if (now < Date.parse('2026-11-05T00:00:00Z') || now > Date.parse('2026-11-10T00:00:00Z')) return null;
  const before = now < POLLS_CLOSE;
  const h = Math.max(0, Math.floor((POLLS_CLOSE - now) / 36e5));
  return (
    <Link to="/nz" className="nz-banner">
      <span className="nz-banner__flag" aria-hidden="true">NZ</span>
      <span><b>{before ? 'New Zealand votes Saturday' : 'NZ election night'}</b> — {before ? `polls close 7pm NZDT (in ~${h}h)` : 'live results, MMP seat projection & coalition builder'}</span>
      <span className="nz-banner__go">Open hub →</span>
    </Link>
  );
}
