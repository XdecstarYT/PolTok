import { useEffect, useMemo, useState } from 'react';
import { useSeo } from '../../lib/seo';
import { PageHeader } from '../../components';
import { PostView } from './PostView';
import { CATEGORIES, dayKey, fmtPostDate, lastSeen, markSeen, useUpdates, type UpdateCategory } from './api';
import './updates.css';

export default function UpdatesPage() {
  useSeo({ title: "What's new on PolTok", description: 'Release notes: new features, improvements, fixes and data updates.' });
  const posts = useUpdates();
  const [seen] = useState(lastSeen);
  const [cat, setCat] = useState<UpdateCategory | 'All'>('All');
  const [q, setQ] = useState('');

  useEffect(() => {
    markSeen(posts);
  }, [posts]);

  useEffect(() => {
    const id = decodeURIComponent(location.hash.slice(1));
    if (id) setTimeout(() => void document.getElementById(id)?.scrollIntoView({ block: 'start' }), 60);
  }, []);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return posts.filter(
      (p) => (cat === 'All' || p.categories.includes(cat)) && (!needle || `${p.title} ${p.body} ${p.version ?? ''}`.toLowerCase().includes(needle)),
    );
  }, [posts, cat, q]);

  const groups = useMemo(() => {
    const g: { day: string; label: string; posts: typeof shown }[] = [];
    for (const p of shown) {
      const k = dayKey(p.date);
      const last = g[g.length - 1];
      if (last?.day === k) last.posts.push(p);
      else g.push({ day: k, label: fmtPostDate(p.date), posts: [p] });
    }
    return g;
  }, [shown]);

  const counts = useMemo(() => Object.fromEntries(CATEGORIES.map((c) => [c, posts.filter((p) => p.categories.includes(c)).length])), [posts]);

  return (
    <div className="page up-page">
      <PageHeader
        kicker="Changelog"
        title="What’s new on PolTok"
        crumbLabel="What's new"
        sub="Every feature, fix and data update, as it ships. Dates shown in your Settings time zone."
        aside={
        <a className="up-rss" href="/api/updates.rss">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="19" r="2.5" /><path d="M3 10a11 11 0 0 1 11 11h-3a8 8 0 0 0-8-8zm0-7a18 18 0 0 1 18 18h-3A15 15 0 0 0 3 6z" /></svg>
          RSS feed
        </a>
        }
      />

      <div className="up-tools" role="search">
        <div className="up-filters" role="group" aria-label="Filter by category">
          {(['All', ...CATEGORIES] as const).map((c) => (
            <button key={c} type="button" className={`up-filter ${cat === c ? 'is-on' : ''}`} aria-pressed={cat === c} onClick={() => setCat(c)}>
              {c}
              {c !== 'All' && <span className="up-filter__n num">{counts[c]}</span>}
            </button>
          ))}
        </div>
        <input className="up-search" type="search" placeholder="Search updates…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search updates" />
      </div>

      {groups.length === 0 && <p className="up-empty">No updates match.</p>}
      <ol className="up-timeline">
        {groups.map((g) => (
          <li key={g.day} className="up-day">
            <h2 className="up-day__label"><span>{g.label}</span></h2>
            <div className="up-day__posts">
              {g.posts.map((p) => (
                <PostView key={p.id} post={p} isNew={seen !== null && Date.parse(p.date) > seen} />
              ))}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
