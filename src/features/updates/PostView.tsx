import { Link } from 'react-router-dom';
import { Markdown } from './Markdown';
import { CAT_TONE, fmtPostDate, type UpdatePost } from './api';
import './updates.css';

export function CategoryChip({ c }: { c: UpdatePost['categories'][number] }) {
  return <span className="up-chip" style={{ ['--tone' as string]: CAT_TONE[c] }}>{c}</span>;
}

export function PostView({ post, isNew }: { post: UpdatePost; isNew?: boolean }) {
  return (
    <article className={`up-post ${post.major ? 'is-major' : ''}`} id={post.id} aria-labelledby={`${post.id}-t`}>
      <header className="up-post__head">
        <div className="up-post__meta">
          {post.version && <span className="up-ver num">{post.version}</span>}
          <time dateTime={post.date}>{fmtPostDate(post.date, true)}</time>
          {isNew && <span className="up-new">New</span>}
          {post.draft && <span className="up-new up-new--draft">Draft</span>}
        </div>
        <h2 className="up-post__t" id={`${post.id}-t`}>
          <a href={`#${post.id}`}>{post.title}</a>
        </h2>
        {post.categories.length > 0 && <div className="up-chips">{post.categories.map((c) => <CategoryChip key={c} c={c} />)}</div>}
      </header>
      {post.image && <img className="up-post__img" src={post.image} alt={post.imageAlt || ''} loading="lazy" decoding="async" />}
      <Markdown text={post.body} />
      {!!post.links?.length && (
        <div className="up-try">
          {post.links.map((l) =>
            l.to.startsWith('/') && !l.to.startsWith('/api/') ? (
              <Link key={l.to + l.label} to={l.to} className="up-try__a">Try it: {l.label} →</Link>
            ) : (
              <a key={l.to + l.label} href={l.to} className="up-try__a" rel="noopener noreferrer">{l.label} →</a>
            ),
          )}
        </div>
      )}
    </article>
  );
}
