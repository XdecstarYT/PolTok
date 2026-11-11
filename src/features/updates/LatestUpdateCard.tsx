import { Link } from 'react-router-dom';
import { Markdown } from './Markdown';
import { CategoryChip } from './PostView';
import { fmtPostDate, lastSeen, useUpdates } from './api';
import { XShare } from './XShare';
import './updates.css';

/**
 * "Latest update" card (mount: <LatestUpdateCard />). `compact` renders a one-row "What's new" strip
 * for the home page: kicker, version, title, date, a link to all updates and the X actions
 * (public "Share on X"; owner-only "Publish to X").
 */
export function LatestUpdateCard({ className, compact }: { className?: string; compact?: boolean }) {
  const p = useUpdates()[0];
  if (!p) return null;
  const seen = lastSeen();
  const isNew = seen === null || Date.parse(p.date) > seen;
  const excerpt = p.body.split(/\n{2,}/)[0];
  if (compact)
    return (
      <section className={`up-strip ${isNew ? 'is-new' : ''} ${className ?? ''}`} aria-labelledby="up-strip-t">
        <span className="up-strip__k">
          {isNew && <span className="up-strip__dot" aria-hidden="true" />}
          What&apos;s new
        </span>
        <div className="up-strip__main">
          <h2 id="up-strip-t" className="up-strip__t">
            <Link to={`/updates#${p.id}`}>{p.title}</Link>
          </h2>
          <span className="up-strip__meta">
            {p.version && <span className="num">{p.version}</span>}
            <time dateTime={p.date}>{fmtPostDate(p.date)}</time>
          </span>
        </div>
        <div className="up-strip__acts">
          <Link to="/updates" className="up-strip__all">All updates</Link>
          <XShare post={p} />
        </div>
      </section>
    );
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
      <XShare post={p} />
    </section>
  );
}
