import { Link } from 'react-router-dom';
import { Markdown } from './Markdown';
import { CategoryChip } from './PostView';
import { fmtPostDate, lastSeen, useUpdates } from './api';
import './updates.css';

/** Compact "latest update" card, for the home page (mount: <LatestUpdateCard />). */
export function LatestUpdateCard({ className }: { className?: string }) {
  const p = useUpdates()[0];
  if (!p) return null;
  const seen = lastSeen();
  const isNew = seen === null || Date.parse(p.date) > seen;
  const excerpt = p.body.split(/\n{2,}/)[0];
  return (
    <section className={`up-latest ${className ?? ''}`} aria-label="Latest update">
      <div className="up-latest__meta">
        <span className="up-kicker">{isNew ? 'New update' : 'Latest update'}</span>
        {p.version && <span className="up-ver num">{p.version}</span>}
        <time dateTime={p.date}>{fmtPostDate(p.date)}</time>
      </div>
      <h3 className="up-latest__t"><Link to={`/updates#${p.id}`}>{p.title}</Link></h3>
      <div className="up-chips">{p.categories.map((c) => <CategoryChip key={c} c={c} />)}</div>
      <Markdown text={excerpt} className="up-md up-md--clamp" />
      <Link to="/updates" className="up-try__a">See all updates →</Link>
    </section>
  );
}
