import { useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageHeader, Skeleton, ErrorState } from '../../components';
import type { NewsItem } from '../../types';
import { timeAgo, LEAN_HEX } from '../../lib/format';
import { useSeo } from '../../lib/seo';
import { BlindspotBadge, CoverageBar, LeanDot } from './BiasBar';
import { Chips, HeadlineRow } from './News2Bits';
import { cleanText, SIDE_HEX, SIDE_LABEL, SIDE_OF, useNow } from './newsUtils';
import { detectRelated, neutralSummary, sourceHref, TOPIC_LIST, useNewsApi, type StoryRes } from './news2';
import { topicMatchClient } from './topicMatch';

export default function StoryPage() {
  const { id = '' } = useParams();
  const { data, error, loading } = useNewsApi<StoryRes>(`/api/news/story/${encodeURIComponent(id)}`);
  const now = useNow();
  const items = data?.items ?? [];
  const lead = useMemo(() => [...items].reverse().find((i) => i.image) ?? items[items.length - 1], [items]);
  useSeo({ title: lead ? cleanText(lead.title) : 'Story', description: data ? `${new Set(items.map((i) => i.source)).size} outlets covering this story, grouped Left / Center / Right.` : undefined });

  const bySide = useMemo(() => {
    const b: Record<'L' | 'C' | 'R', NewsItem[]> = { L: [], C: [], R: [] };
    const seen = new Set<string>();
    for (const i of [...items].reverse()) {
      if (seen.has(i.source)) continue;
      seen.add(i.source);
      const s = SIDE_OF[i.sourceLean] ?? 'U';
      b[s === 'U' ? 'C' : s].push(i);
    }
    return b;
  }, [items]);
  const related = useMemo(() => (data ? detectRelated(items, data.tags, data.region) : null), [data, items]);
  const topics = useMemo(() => TOPIC_LIST.filter((t) => (t.region === 'both' || t.region === data?.region) && items.some((i) => topicMatchClient(i, t.slug))), [items, data]);

  return (
    <div className="container n2">
      <PageHeader
        className="n2-head"
        kicker="Story · coverage across the spectrum"
        crumbLabel="Story"
        title={data && lead ? cleanText(lead.title) : error && !data ? 'Story unavailable' : <Skeleton width="min(640px, 90%)" height={36} />}
        sub={
          data && lead ? (
            <>Headline from {lead.source}. Covered by <b>{data.coverage.total}</b> outlet{data.coverage.total === 1 ? '' : 's'} · first seen {timeAgo(items[0].publishedAt, now)} · latest {timeAgo(items[items.length - 1].publishedAt, now)}</>
          ) : undefined
        }
      />
      {loading && !data && <Skeleton lines={6} />}
      {error && !data && (
        <ErrorState title="Couldn't load this story" description={<>{error}. <Link to="/news">Back to News</Link></>} onRetry={() => location.reload()} />
      )}
      {data && lead && (
        <>
          <div className="n2-grid">
            <div>
              <section className="n2-panel" aria-labelledby="n2-cov">
                <h2 id="n2-cov" className="n2-h2">Headlines side by side</h2>
                <div className="n2-sides">
                  {(['L', 'C', 'R'] as const).map((k) => (
                    <div key={k} className="n2-side">
                      <h3 style={{ color: SIDE_HEX[k] }}>
                        <LeanDot hex={SIDE_HEX[k]} /> {SIDE_LABEL[k]} ({bySide[k].length})
                      </h3>
                      {bySide[k].length ? (
                        <ul className="n2-list">
                          {bySide[k].map((i) => (
                            <HeadlineRow key={i.id} item={i} now={now} showStory={false} />
                          ))}
                        </ul>
                      ) : (
                        <p className="n2-empty">No {SIDE_LABEL[k].toLowerCase()}-leaning outlet in our feeds has covered this yet.</p>
                      )}
                    </div>
                  ))}
                </div>
                <p className="n2-muted" style={{ marginTop: 12 }}>Headlines are the publishers' own, linked to the original. Unrated outlets are shown under Center.</p>
              </section>
              <AiSummary items={items} />
              <section className="n2-panel" aria-labelledby="n2-tl">
                <h2 id="n2-tl" className="n2-h2">Coverage timeline</h2>
                <ol className="n2-timeline">
                  {items.map((i) => (
                    <li key={i.id} style={{ ['--tl' as string]: LEAN_HEX[i.sourceLean] ?? LEAN_HEX.Unrated }}>
                      <span className="mono">{new Date(i.publishedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                      <Link to={sourceHref(i.source)}>{i.source}</Link>: {cleanText(i.title)}
                    </li>
                  ))}
                </ol>
              </section>
            </div>
            <aside>
              <section className="n2-panel">
                <h3 className="n2-h3">Bias distribution</h3>
                <CoverageBar coverage={data.coverage} height={14} showLabels />
                {data.blindspot ? (
                  <div className="n2-blind">
                    <BlindspotBadge side={data.blindspot} />
                    <p style={{ margin: '6px 0 0' }}>
                      <b>Blindspot:</b> over 75% of rated coverage comes from one side; few or no {SIDE_LABEL[data.blindspot].toLowerCase()}-leaning outlets in our feeds are covering it.
                    </p>
                  </div>
                ) : (
                  <p className="n2-muted" style={{ marginTop: 10 }}>No blindspot: coverage isn't dominated by one side (needs 3+ rated outlets to judge).</p>
                )}
              </section>
              {related && (
                <section className="n2-panel">
                  <Chips title="Related races" links={related.races} />
                  <Chips title="Candidates mentioned" links={related.candidates} />
                  <Chips title="Seats" links={related.seats} />
                  <Chips title="States" links={related.states} />
                  <Chips title="Topics" links={topics.map((t) => ({ to: `/topic/${t.slug}`, label: t.label }))} />
                  {!related.races.length && !related.candidates.length && !related.seats.length && !related.states.length && !topics.length && (
                    <p className="n2-muted">No related races or seats detected in these headlines.</p>
                  )}
                </section>
              )}
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

function AiSummary({ items }: { items: NewsItem[] }) {
  const [text, setText] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'err'>('idle');
  const [err, setErr] = useState('');
  const ctl = useRef<AbortController | null>(null);
  const run = async () => {
    ctl.current?.abort();
    ctl.current = new AbortController();
    setState('busy');
    setText('');
    try {
      await neutralSummary(items, setText, ctl.current.signal);
      setState('done');
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      setErr((e as Error).message || 'AI unavailable');
      setState('err');
    }
  };
  return (
    <section className="n2-panel n2-ai" aria-labelledby="n2-ai">
      <h2 id="n2-ai" className="n2-h2">AI neutral summary</h2>
      <p className="n2-ai-label">AI-generated from only the {items.length} headlines and publisher summaries on this page. It can be wrong. Check the original reporting.</p>
      {state === 'idle' && (
        <button className="n2-btn" onClick={run}>
          Generate summary
        </button>
      )}
      {(state === 'busy' || state === 'done') && <p className="n2-ai-text" aria-live="polite">{text || 'Summarising…'}</p>}
      {state === 'err' && (
        <p className="n2-muted">
          {err} <button className="n2-btn" onClick={run}>Retry</button>
        </p>
      )}
    </section>
  );
}
