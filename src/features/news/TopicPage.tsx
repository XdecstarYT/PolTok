import { Link, useParams } from 'react-router-dom';
import { timeAgo } from '../../lib/format';
import { useSeo } from '../../lib/seo';
import { CoverageBar } from './BiasBar';
import { Chips, HeadlineRow, Spark } from './News2Bits';
import { cleanText, useNow } from './newsUtils';
import { sourceHref, TOPIC_LIST, TOPIC_PAGES, useNewsApi, type TopicRes } from './news2';

export default function TopicPage() {
  const { slug = '' } = useParams();
  const known = TOPIC_LIST.find((t) => t.slug === slug);
  const { data, error, loading } = useNewsApi<TopicRes>(`/api/news/topic/${encodeURIComponent(slug)}`, 60_000);
  const now = useNow();
  const label = data?.label ?? known?.label ?? slug;
  useSeo({ title: `${label} news`, description: `Live ${label} headlines from outlets across the spectrum, top stories and 48-hour coverage trend.` });

  return (
    <main className="container n2">
      <nav className="n2-crumb" aria-label="Breadcrumb">
        <Link to="/news">News</Link> <span aria-hidden="true">/</span> <span>Topics</span>
      </nav>
      <h1>{label}</h1>
      <div className="n2-chips">
        <div>
          {TOPIC_LIST.map((t) => (
            <Link key={t.slug} to={`/topic/${t.slug}`} className="n2-chip" aria-current={t.slug === slug ? 'page' : undefined}>
              {t.label}
            </Link>
          ))}
        </div>
      </div>
      {!known && <p className="n2-muted">Unknown topic. Pick one above.</p>}
      {known && loading && !data && <p className="n2-muted">Loading live feed…</p>}
      {known && error && !data && <p className="n2-muted">Couldn't load this topic: {error}.</p>}
      {data && (
        <div className="n2-grid">
          <div>
            <section className="n2-panel" aria-labelledby="n2-top">
              <h2 id="n2-top" className="n2-h2">Top stories</h2>
              {data.top.length ? (
                <ol className="n2-top">
                  {data.top.map((c) => (
                    <li key={c.id}>
                      <Link to={`/story/${encodeURIComponent(c.id)}`}>{cleanText(c.lead.title)}</Link>
                      <div className="n2-row-meta">
                        {c.sources} outlet{c.sources === 1 ? '' : 's'} · {timeAgo(c.latest, now)}
                      </div>
                      <CoverageBar coverage={c.coverage} height={5} compact />
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="n2-muted">No stories on this topic in the current feeds (last ~7 days).</p>
              )}
            </section>
            <section className="n2-panel" aria-labelledby="n2-feed">
              <h2 id="n2-feed" className="n2-h2">Live feed</h2>
              <ul className="n2-list">
                {data.items.slice(0, 60).map((i) => (
                  <HeadlineRow key={i.id} item={i} now={now} />
                ))}
              </ul>
            </section>
          </div>
          <aside>
            <section className="n2-panel">
              <h3 className="n2-h3">Story volume, last 48h</h3>
              <Spark vals={data.volume48h} label={`${label} story volume`} />
            </section>
            <section className="n2-panel">
              <h3 className="n2-h3">Who's covering it</h3>
              <CoverageBar coverage={data.coverage} height={12} showLabels />
              <p className="n2-muted" style={{ marginTop: 8 }}>
                {data.total} headlines from {data.coverage.total} outlets.
              </p>
              <TopSources items={data.items} />
            </section>
            <section className="n2-panel">
              <Chips title="Related pages" links={TOPIC_PAGES[slug] ?? []} />
            </section>
          </aside>
        </div>
      )}
    </main>
  );
}

function TopSources({ items }: { items: TopicRes['items'] }) {
  const counts = new Map<string, number>();
  for (const i of items) counts.set(i.source, (counts.get(i.source) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  return <Chips title="Top outlets" links={top.map(([s, n]) => ({ to: sourceHref(s), label: `${s} · ${n}` }))} />;
}
