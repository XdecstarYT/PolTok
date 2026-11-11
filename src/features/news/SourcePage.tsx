import { Link, useParams } from 'react-router-dom';
import { PageHeader, Skeleton, EmptyState } from '../../components';
import { LEAN_HEX } from '../../lib/format';
import { useSeo } from '../../lib/seo';
import { LeanDot } from './BiasBar';
import { Chips, HeadlineRow, Spark } from './News2Bits';
import { useNow } from './newsUtils';
import { useNewsApi, type SourceRes } from './news2';

export default function SourcePage() {
  const { name = '' } = useParams();
  const { data, error, loading } = useNewsApi<SourceRes>(`/api/news/source/${encodeURIComponent(name)}`);
  const now = useNow();
  useSeo({ title: `${data?.name ?? name} · news source`, description: `${data?.name ?? name}: media-bias rating, recent political stories and share of coverage on PolTok.` });

  return (
    <div className="container n2">
      <PageHeader className="n2-head" kicker="News source" title={data?.name ?? name} crumbLabel={data?.name ?? name} sub="Media-bias rating, recent political stories and share of coverage on PolTok." />
      {loading && !data && <Skeleton lines={6} />}
      {error && !data && <EmptyState title="No recent stories from this outlet" description={`Nothing from this outlet is in our feeds right now (${error}).`} />}
      {data && (
        <div className="n2-grid">
          <section className="n2-panel" aria-labelledby="n2-recent">
            <h2 id="n2-recent" className="n2-h2">Recent stories</h2>
            <ul className="n2-list">
              {data.items.map((i) => (
                <HeadlineRow key={i.id} item={i} now={now} />
              ))}
            </ul>
          </section>
          <aside>
            <section className="n2-panel">
              <h3 className="n2-h3">Lean rating</h3>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
                <LeanDot hex={LEAN_HEX[data.lean] ?? LEAN_HEX.Unrated} size={12} /> {data.lean}
              </p>
              <p className="n2-muted">Outlet-level rating used across PolTok (see the News page sources list); it describes the outlet, not each article.</p>
              <div className="n2-stats">
                <div className="n2-stat">
                  <b>{data.recent48h}</b>
                  <span>stories, 48h</span>
                </div>
                <div className="n2-stat">
                  <b>{(data.share48h * 100).toFixed(1)}%</b>
                  <span>of all feed coverage, 48h</span>
                </div>
                <div className="n2-stat">
                  <b>{data.total}</b>
                  <span>in feed (~7d)</span>
                </div>
              </div>
              <Spark vals={data.volume48h} label={`${data.name} story volume`} />
            </section>
            <section className="n2-panel">
              <Chips title="Topics it covers" links={data.topics.slice(0, 10).map((t) => ({ to: `/topic/${t.slug}`, label: `${t.label} · ${t.n}` }))} />
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
