import { Link } from 'react-router-dom';
import type { NewsItem } from '../../types';
import { LEAN_HEX, timeAgo } from '../../lib/format';
import { cleanText, safeUrl } from './newsUtils';
import { sourceHref, sparkPath, storyHref } from './news2';
import './news2.css';

export function Spark({ vals, label, w = 240, h = 40 }: { vals: number[]; label: string; w?: number; h?: number }) {
  const total = vals.reduce((a, b) => a + b, 0);
  return (
    <figure className="n2-spark">
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img" aria-label={`${label}: ${total} stories in the last 48 hours`} preserveAspectRatio="none">
        <path d={`${sparkPath(vals, w, h)} L${w},${h} L0,${h} Z`} fill="var(--accent)" opacity="0.15" />
        <path d={sparkPath(vals, w, h)} fill="none" stroke="var(--accent)" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption className="mono">
        <span>48h ago</span>
        <span>{total} stories</span>
        <span>now</span>
      </figcaption>
    </figure>
  );
}

/** One real headline row: links out to the publisher, plus story + source pages. */
export function HeadlineRow({ item, now, showStory = true }: { item: NewsItem; now: number; showStory?: boolean }) {
  const u = safeUrl(item.url);
  return (
    <li className="n2-row">
      <span className="n2-dot" style={{ background: LEAN_HEX[item.sourceLean] ?? LEAN_HEX.Unrated }} aria-hidden="true" />
      <div>
        {u ? (
          <a href={u} target="_blank" rel="noopener noreferrer" className="n2-row-title">
            {cleanText(item.title)}
          </a>
        ) : (
          <span className="n2-row-title">{cleanText(item.title)}</span>
        )}
        <div className="n2-row-meta">
          <Link to={sourceHref(item.source)}>{item.source}</Link> · {item.sourceLean} · {timeAgo(item.publishedAt, now)}
          {showStory && (
            <>
              {' · '}
              <Link to={storyHref(item)}>Full coverage →</Link>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

export function Chips({ title, links }: { title: string; links: { to: string; label: string }[] }) {
  if (!links.length) return null;
  return (
    <div className="n2-chips">
      <h3 className="n2-h3">{title}</h3>
      <div>
        {links.map((l) => (
          <Link key={l.to} to={l.to} className="n2-chip">
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
