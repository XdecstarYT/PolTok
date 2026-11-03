import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Lean, NewsItem } from '../../types';
import { useLive } from '../../lib/live';
import { LEAN_HEX, timeAgo } from '../../lib/format';
import { stateByAbbr } from '../../data';
import { LiveDot } from '../../components';
import { BlindspotBadge, CoverageBar, LeanDot } from './BiasBar';
import {
  balanceInterleave,
  cleanText,
  clusterNews,
  coverageOf,
  developingScore,
  firstSentence,
  hash,
  hasTopic,
  kickerOf,
  safeUrl,
  SIDE_HEX,
  SIDE_LABEL,
  SIDE_OF,
  statesOf,
  TOPICS,
  useNow,
  type Cluster,
  type Side,
  type TopicKey,
} from './newsUtils';
import './news.css';

type View = 'cards' | 'list' | 'wall';
type TopicFilter = 'all' | 'breaking' | 'blindspot' | TopicKey;

const PREF_KEY = 'poltok.news.prefs.v1';
function loadPrefs(): { view?: View; balance?: boolean } {
  try {
    return JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
  } catch {
    return {};
  }
}
function savePrefs(p: { view: View; balance: boolean }) {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable */
  }
}

const LEAN_ORDER: Lean[] = ['Left', 'Lean Left', 'Center', 'Lean Right', 'Right', 'Unrated'];

interface SourceRow {
  name: string;
  lean: Lean;
  count: number;
  ok?: boolean;
}

export default function NewsPage() {
  const live = useLive();
  const now = useNow(30_000);
  const prefs = useMemo(loadPrefs, []);

  const [view, setView] = useState<View>(prefs.view ?? 'cards');
  const [balance, setBalance] = useState<boolean>(prefs.balance ?? false);
  const [topic, setTopic] = useState<TopicFilter>('all');
  const [lean, setLean] = useState<Side | 'all'>('all');
  const [stateF, setStateF] = useState('');
  const [sourceF, setSourceF] = useState('');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [apiSources, setApiSources] = useState<{ name: string; lean: Lean; ok: boolean }[] | null>(null);

  useEffect(() => savePrefs({ view, balance }), [view, balance]);

  // Source health list from the aggregator (optional; falls back to items).
  useEffect(() => {
    let dead = false;
    fetch('/api/news?limit=1')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { sources?: { name: string; lean: Lean; ok: boolean }[] }) => {
        if (!dead && Array.isArray(d.sources)) setApiSources(d.sources);
      })
      .catch(() => {});
    return () => {
      dead = true;
    };
  }, []);

  // ---- "N new stories" pill: freeze the visible list while the reader is scrolled down.
  const [shown, setShown] = useState<NewsItem[]>(live.news);
  const shownIds = useMemo(() => new Set(shown.map((n) => n.id)), [shown]);
  const pending = useMemo(() => live.news.filter((n) => !shownIds.has(n.id)).length, [live.news, shownIds]);
  const atTop = useRef(true);
  useEffect(() => {
    const onScroll = () => {
      atTop.current = window.scrollY < 160;
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => {
    if (!shown.length || atTop.current) setShown(live.news);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.news]);
  const reveal = () => {
    setShown(live.news);
    window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };

  // ---- derived data
  const clusters = useMemo(() => clusterNews(shown), [shown]);
  const clusterById = useMemo(() => new Map(clusters.map((c) => [c.id, c])), [clusters]);
  const clusterOf = (n: NewsItem) => clusterById.get(n.clusterId || n.id);

  const stateOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of shown) for (const s of statesOf(n)) counts.set(s, (counts.get(s) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [shown]);

  const sources: SourceRow[] = useMemo(() => {
    const m = new Map<string, SourceRow>();
    for (const s of apiSources ?? []) m.set(s.name, { name: s.name, lean: s.lean, count: 0, ok: s.ok });
    for (const n of shown) {
      const r = m.get(n.source);
      if (r) r.count++;
      else m.set(n.source, { name: n.source, lean: n.sourceLean, count: 1 });
    }
    return [...m.values()].sort(
      (a, b) => LEAN_ORDER.indexOf(a.lean) - LEAN_ORDER.indexOf(b.lean) || b.count - a.count || a.name.localeCompare(b.name),
    );
  }, [shown, apiSources]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = shown.filter((n) => {
      if (sourceF && n.source !== sourceF) return false;
      if (lean !== 'all') {
        const s = SIDE_OF[n.sourceLean] ?? 'U';
        if (lean === 'C' ? s !== 'C' && s !== 'U' : s !== lean) return false;
      }
      if (stateF && !statesOf(n).includes(stateF)) return false;
      if (topic === 'breaking' && !n.breaking) return false;
      if (topic === 'blindspot' && !clusterById.get(n.clusterId || n.id)?.blindspot) return false;
      if (topic !== 'all' && topic !== 'breaking' && topic !== 'blindspot' && !hasTopic(n, topic)) return false;
      if (needle) {
        const hay = (n.title + ' ' + n.source + ' ' + (n.summary ?? '') + ' ' + (n.tags ?? []).join(' ')).toLowerCase();
        if (!needle.split(/\s+/).every((w) => hay.includes(w))) return false;
      }
      return true;
    });
    if (balance) out = balanceInterleave(out);
    return out;
  }, [shown, q, sourceF, lean, stateF, topic, balance, clusterById]);

  const storyCards = useMemo(() => {
    const seen = new Set<string>();
    const out: { cluster: Cluster; item: NewsItem }[] = [];
    for (const n of filtered) {
      const c = clusterById.get(n.clusterId || n.id);
      if (!c || seen.has(c.id)) continue;
      seen.add(c.id);
      out.push({ cluster: c, item: n });
    }
    return out;
  }, [filtered, clusterById]);

  const developing = useMemo(() => {
    const multi = clusters.filter((c) => c.sources.length >= 2);
    const pool = multi.length >= 3 ? multi : clusters;
    return [...pool].sort((a, b) => developingScore(b, now) - developingScore(a, now)).slice(0, 10);
  }, [clusters, now]);

  const blindspots = useMemo(() => clusters.filter((c) => c.blindspot).sort((a, b) => b.latest - a.latest).slice(0, 5), [clusters]);
  const overall = useMemo(() => coverageOf(shown.map((n) => ({ ...n, source: n.id }))), [shown]);

  const selCluster = selected ? clusterById.get(selected) : undefined;
  const lastFetched = shown[0]?.publishedAt;
  const loading = shown.length === 0;
  const activeFilters = topic !== 'all' || lean !== 'all' || !!stateF || !!sourceF || !!q;
  const clearAll = () => {
    setTopic('all');
    setLean('all');
    setStateF('');
    setSourceF('');
    setQ('');
  };

  // Escape closes the reading pane
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSelected(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  return (
    <div className="page nw">
      <header className="nw-head">
        <div className="nw-head-text">
          <div className="nw-eyebrow mono">
            <LiveDot label="NEWSROOM" />
            <span>ELECTION DAY · NOV 3, 2026</span>
          </div>
          <h1>Every side of tonight’s story</h1>
          <p className="nw-sub">
            {loading ? (
              'Connecting to the newsroom…'
            ) : (
              <>
                <b className="mono">{shown.length}</b> headlines · <b className="mono">{clusters.length}</b> stories ·{' '}
                <b className="mono">{sources.filter((s) => s.count > 0).length}</b> outlets
                {lastFetched ? <> · latest {timeAgo(lastFetched, now)}</> : null}
              </>
            )}
          </p>
        </div>
        <div className="nw-mix">
          <span className="nw-mix-label mono">TODAY’S COVERAGE MIX</span>
          <CoverageBar coverage={overall} height={10} showLabels />
        </div>
      </header>

      {/* ---------- Developing ---------- */}
      {!q && !sourceF && (
        <section className="nw-dev" aria-labelledby="nw-dev-h">
          <div className="nw-section-h">
            <h2 id="nw-dev-h">
              <span className="nw-pulse" aria-hidden="true" /> Developing
            </h2>
            <span className="nw-hint">Stories clustered across outlets · tap for full coverage</span>
          </div>
          <div className="nw-dev-row">
            {loading
              ? Array.from({ length: 4 }, (_, i) => <div key={i} className="nw-dev-card nw-skel" />)
              : developing.map((c, i) => (
                  <DevCard key={c.id} cluster={c} rank={i + 1} now={now} onOpen={() => setSelected(c.id)} />
                ))}
          </div>
        </section>
      )}

      {/* ---------- Toolbar ---------- */}
      <div className="nw-toolbar">
        <div className="nw-search">
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M10 2a8 8 0 016.3 12.9l5.4 5.4-1.4 1.4-5.4-5.4A8 8 0 1110 2zm0 2a6 6 0 100 12 6 6 0 000-12z" />
          </svg>
          <input type="search" placeholder="Search headlines, outlets, states…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search news" />
        </div>
        <div className="nw-chips" role="toolbar" aria-label="Filter by topic">
          <Chip on={topic === 'all'} onClick={() => setTopic('all')}>
            All
          </Chip>
          <Chip on={topic === 'breaking'} onClick={() => setTopic('breaking')} tone="breaking">
            Breaking
          </Chip>
          {TOPICS.map((t) => (
            <Chip key={t.key} on={topic === t.key} onClick={() => setTopic(t.key)}>
              {t.label}
            </Chip>
          ))}
          <Chip on={topic === 'blindspot'} onClick={() => setTopic('blindspot')}>
            Blindspots
          </Chip>
          <span className="nw-sep" aria-hidden="true" />
          {(['L', 'C', 'R'] as Side[]).map((s) => (
            <Chip key={s} on={lean === s} onClick={() => setLean(lean === s ? 'all' : s)} dot={SIDE_HEX[s]}>
              {SIDE_LABEL[s]}
            </Chip>
          ))}
          <label className="nw-select">
            <span className="sr-only">Filter by state</span>
            <select value={stateF} onChange={(e) => setStateF(e.target.value)} aria-label="Filter by state">
              <option value="">All states</option>
              {stateOptions.map(([abbr, n]) => (
                <option key={abbr} value={abbr}>
                  {stateByAbbr.get(abbr)?.name ?? abbr} ({n})
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="nw-tools-right">
          <button
            className={`nw-toggle ${balance ? 'on' : ''}`}
            role="switch"
            aria-checked={balance}
            onClick={() => setBalance((b) => !b)}
            title="Interleave Left, Center and Right outlets"
          >
            <span className="nw-toggle-knob" aria-hidden="true" />
            Balance my feed
          </button>
          <div className="nw-seg" role="tablist" aria-label="View">
            {(
              [
                ['cards', 'Cards'],
                ['list', 'Compact'],
                ['wall', 'Headline Wall'],
              ] as [View, string][]
            ).map(([v, l]) => (
              <button key={v} role="tab" aria-selected={view === v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {activeFilters && (
        <div className="nw-active">
          <span className="mono">{filtered.length} results</span>
          {sourceF && <span className="nw-pill">Outlet: {sourceF}</span>}
          {stateF && <span className="nw-pill">State: {stateF}</span>}
          <button className="nw-link" onClick={clearAll}>
            Clear filters
          </button>
        </div>
      )}

      <div className={`nw-layout ${selCluster ? 'has-pane' : ''}`}>
        <main className="nw-main">
          {loading ? (
            <Skeletons />
          ) : filtered.length === 0 ? (
            <div className="nw-empty">
              <p>No headlines match these filters yet.</p>
              <button className="nw-link" onClick={clearAll}>
                Clear filters
              </button>
            </div>
          ) : view === 'cards' ? (
            <div className="nw-grid">
              {storyCards.slice(0, 120).map(({ cluster, item }) => (
                <StoryCard key={cluster.id} cluster={cluster} item={item} now={now} onOpen={() => setSelected(cluster.id)} active={selected === cluster.id} />
              ))}
            </div>
          ) : view === 'list' ? (
            <ol className="nw-list">
              {filtered.slice(0, 250).map((n) => (
                <ListRow key={n.id} item={n} cluster={clusterOf(n)} now={now} onOpen={(id) => setSelected(id)} />
              ))}
            </ol>
          ) : (
            <Wall items={filtered} now={now} onOpen={(id) => setSelected(id)} clusterOf={clusterOf} />
          )}
        </main>

        <aside className="nw-aside" aria-label={selCluster ? 'Full coverage' : 'Sources'}>
          {selCluster ? (
            <ReadingPane cluster={selCluster} now={now} onClose={() => setSelected(null)} />
          ) : (
            <>
              {blindspots.length > 0 && (
                <section className="nw-panel">
                  <h3 className="nw-panel-h">Blindspots</h3>
                  <p className="nw-panel-sub">Stories covered overwhelmingly by one side.</p>
                  <ul className="nw-bs-list">
                    {blindspots.map((c) => (
                      <li key={c.id}>
                        <button onClick={() => setSelected(c.id)}>
                          <BlindspotBadge side={c.blindspot!} />
                          <span className="nw-bs-title">{cleanText(c.lead.title)}</span>
                          <CoverageBar coverage={c.coverage} height={4} compact />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <SourceList sources={sources} active={sourceF} onPick={(s) => setSourceF(sourceF === s ? '' : s)} />
            </>
          )}
        </aside>
      </div>

      {selCluster && <div className="nw-scrim" onClick={() => setSelected(null)} aria-hidden="true" />}

      {pending > 0 && shown.length > 0 && (
        <button className="nw-newpill" onClick={reveal}>
          <span aria-hidden="true">↑</span> {pending} new {pending === 1 ? 'story' : 'stories'}
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Chip({ on, onClick, children, dot, tone }: { on: boolean; onClick: () => void; children: ReactNode; dot?: string; tone?: 'breaking' }) {
  return (
    <button className={`nw-chip ${on ? 'on' : ''} ${tone ?? ''}`} aria-pressed={on} onClick={onClick}>
      {dot && <LeanDot hex={dot} size={7} />}
      {children}
    </button>
  );
}

function Ext({ href, children, className, label }: { href: string; children: ReactNode; className?: string; label?: string }) {
  const u = safeUrl(href);
  if (!u) return <span className={className}>{children}</span>;
  return (
    <a href={u} target="_blank" rel="noopener noreferrer" className={className} aria-label={label}>
      {children}
    </a>
  );
}

function SourceMeta({ item, now }: { item: NewsItem; now: number }) {
  return (
    <div className="nw-meta">
      <LeanDot hex={LEAN_HEX[item.sourceLean] ?? LEAN_HEX.Unrated} title={item.sourceLean} />
      <span className="nw-src">{item.source}</span>
      <span className="nw-lean">{item.sourceLean}</span>
      <span className="nw-dotsep" aria-hidden="true">·</span>
      <time dateTime={new Date(item.publishedAt).toISOString()} className="mono">
        {timeAgo(item.publishedAt, now)}
      </time>
    </div>
  );
}

/** Generated art when an article has no image: lean-tinted mesh gradient. */
export function GenArt({ seed, coverageTint, label }: { seed: string; coverageTint?: { L: number; R: number }; label?: string }) {
  const h = hash(seed);
  const l = coverageTint?.L ?? 1;
  const r = coverageTint?.R ?? 1;
  const tilt = l + r ? (l - r) / (l + r) : 0; // -1..1
  const a = 20 + (h % 60);
  const b = 30 + ((h >> 8) % 50);
  const style = {
    backgroundImage: `radial-gradient(120% 90% at ${a}% ${b}%, ${tilt >= 0 ? '#3d7bff' : '#ff3d55'}${tilt === 0 ? '55' : '88'}, transparent 60%),
       radial-gradient(90% 80% at ${100 - a}% ${100 - b / 2}%, ${tilt > 0 ? '#7a5cff' : tilt < 0 ? '#ff8a3d' : '#ff3d55'}66, transparent 65%),
       linear-gradient(${h % 360}deg, #10131f, #07080d)`,
  };
  return (
    <div className="nw-genart" style={style} aria-hidden="true">
      {label && <span>{label}</span>}
    </div>
  );
}

function Thumb({ cluster, item }: { cluster: Cluster; item: NewsItem }) {
  const [broken, setBroken] = useState(false);
  const img = item.image ?? cluster.image;
  if (img && !broken)
    return (
      <div className="nw-thumb">
        <img src={img} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
      </div>
    );
  return (
    <div className="nw-thumb">
      <GenArt seed={cluster.id} coverageTint={cluster.coverage} label={kickerOf(cluster.tags) ?? item.source} />
    </div>
  );
}

function DevCard({ cluster, rank, now, onOpen }: { cluster: Cluster; rank: number; now: number; onOpen: () => void }) {
  const c = cluster;
  return (
    <article className="nw-dev-card">
      <Thumb cluster={c} item={c.lead} />
      <div className="nw-dev-body">
        <div className="nw-dev-top">
          <span className="nw-rank mono">{String(rank).padStart(2, '0')}</span>
          {c.breaking && <span className="nw-tag breaking">Breaking</span>}
          {kickerOf(c.tags) && <span className="nw-tag">{kickerOf(c.tags)}</span>}
        </div>
        <h3>
          <button className="nw-titlebtn" onClick={onOpen}>
            {cleanText(c.lead.title)}
          </button>
        </h3>
        <div className="nw-dev-foot">
          <CoverageBar coverage={c.coverage} height={6} compact />
          <div className="nw-dev-stats">
            <SourceStack cluster={c} />
            <span className="mono">
              {c.sources.length} source{c.sources.length === 1 ? '' : 's'} · {timeAgo(c.latest, now)}
            </span>
          </div>
          {c.blindspot && <BlindspotBadge side={c.blindspot} />}
        </div>
      </div>
    </article>
  );
}

function SourceStack({ cluster }: { cluster: Cluster }) {
  const firstBySource = new Map<string, NewsItem>();
  for (const i of cluster.items) if (!firstBySource.has(i.source)) firstBySource.set(i.source, i);
  const list = [...firstBySource.values()].slice(0, 5);
  return (
    <span className="nw-stack" aria-label={`Outlets: ${cluster.sources.join(', ')}`}>
      {list.map((i) => (
        <span key={i.source} className="nw-stack-item" style={{ background: LEAN_HEX[i.sourceLean] ?? LEAN_HEX.Unrated }} title={`${i.source} (${i.sourceLean})`}>
          {i.source.replace(/^The /, '').slice(0, 1)}
        </span>
      ))}
    </span>
  );
}

function StoryCard({ cluster, item, now, onOpen, active }: { cluster: Cluster; item: NewsItem; now: number; onOpen: () => void; active: boolean }) {
  const gist = firstSentence(item);
  const k = kickerOf(cluster.tags);
  const more = cluster.sources.length - 1;
  return (
    <article className={`nw-card ${active ? 'active' : ''}`}>
      <Thumb cluster={cluster} item={item} />
      <div className="nw-card-body">
        <div className="nw-card-kick">
          {item.breaking && <span className="nw-tag breaking">Breaking</span>}
          {k && <span className="nw-tag">{k}</span>}
          {cluster.blindspot && <BlindspotBadge side={cluster.blindspot} />}
        </div>
        <h3 className="nw-card-title">
          <Ext href={item.url}>{cleanText(item.title)}</Ext>
        </h3>
        {gist && <p className="nw-card-sum">{gist}</p>}
        <SourceMeta item={item} now={now} />
        <div className="nw-card-foot">
          <CoverageBar coverage={cluster.coverage} height={5} compact />
          <button className="nw-cov-btn" onClick={onOpen}>
            {more > 0 ? `Full coverage · ${cluster.sources.length} outlets` : 'Coverage details'}
            <span aria-hidden="true"> →</span>
          </button>
        </div>
      </div>
    </article>
  );
}

function ListRow({ item, cluster, now, onOpen }: { item: NewsItem; cluster?: Cluster; now: number; onOpen: (id: string) => void }) {
  return (
    <li className="nw-row">
      <span className="nw-row-bar" style={{ background: LEAN_HEX[item.sourceLean] ?? LEAN_HEX.Unrated }} aria-hidden="true" />
      <time className="nw-row-time mono" dateTime={new Date(item.publishedAt).toISOString()}>
        {timeAgo(item.publishedAt, now)}
      </time>
      <div className="nw-row-main">
        <Ext href={item.url} className="nw-row-title">
          {item.breaking && <span className="nw-tag breaking sm">Breaking</span>}
          {cleanText(item.title)}
        </Ext>
        <div className="nw-row-meta">
          <span className="nw-src">{item.source}</span>
          <span className="nw-lean">{item.sourceLean}</span>
          {statesOf(item).map((s) => (
            <Link key={s} to={`/state/${s}`} className="nw-row-state mono">
              {s}
            </Link>
          ))}
        </div>
      </div>
      {cluster && cluster.sources.length > 1 && (
        <button className="nw-row-cov" onClick={() => onOpen(cluster.id)} title="See full coverage">
          <CoverageBar coverage={cluster.coverage} height={4} compact />
          <span className="mono">+{cluster.sources.length - 1}</span>
        </button>
      )}
    </li>
  );
}

function Wall({ items, now, onOpen, clusterOf }: { items: NewsItem[]; now: number; onOpen: (id: string) => void; clusterOf: (n: NewsItem) => Cluster | undefined }) {
  const cols: Record<'L' | 'C' | 'R', NewsItem[]> = { L: [], C: [], R: [] };
  for (const n of items) {
    const s = SIDE_OF[n.sourceLean] ?? 'U';
    const k = s === 'U' ? 'C' : s;
    if (cols[k].length < 40) cols[k].push(n);
  }
  const title: Record<'L' | 'C' | 'R', string> = { L: 'From the Left', C: 'From the Center', R: 'From the Right' };
  return (
    <div className="nw-wall">
      {(['L', 'C', 'R'] as const).map((k) => (
        <section key={k} className={`nw-wall-col side-${k}`} aria-label={title[k]}>
          <header style={{ borderColor: SIDE_HEX[k] }}>
            <LeanDot hex={SIDE_HEX[k]} size={10} />
            <h3>{title[k]}</h3>
            <span className="mono">{cols[k].length}</span>
          </header>
          {cols[k].length === 0 ? (
            <p className="nw-wall-empty">No {SIDE_LABEL[k].toLowerCase()} coverage matches.</p>
          ) : (
            <ul>
              {cols[k].map((n) => {
                const c = clusterOf(n);
                return (
                  <li key={n.id}>
                    <Ext href={n.url} className="nw-wall-title">
                      {cleanText(n.title)}
                    </Ext>
                    <div className="nw-wall-meta">
                      <LeanDot hex={LEAN_HEX[n.sourceLean] ?? LEAN_HEX.Unrated} size={6} title={n.sourceLean} />
                      <span>{n.source}</span>
                      <span className="mono">{timeAgo(n.publishedAt, now)}</span>
                      {c && c.sources.length > 1 && (
                        <button className="nw-link sm" onClick={() => onOpen(c.id)}>
                          +{c.sources.length - 1} outlets
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

function ReadingPane({ cluster, now, onClose }: { cluster: Cluster; now: number; onClose: () => void }) {
  const lead = cluster.lead;
  const gist = firstSentence(lead, 320);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => closeRef.current?.focus(), [cluster.id]);
  const bySide: Record<'L' | 'C' | 'R', NewsItem[]> = { L: [], C: [], R: [] };
  for (const i of cluster.items) {
    const s = SIDE_OF[i.sourceLean] ?? 'U';
    bySide[s === 'U' ? 'C' : s].push(i);
  }
  return (
    <section className="nw-pane" role="dialog" aria-label="Full coverage">
      <div className="nw-pane-top">
        <span className="nw-eyebrow mono">FULL COVERAGE</span>
        <button ref={closeRef} className="nw-close" onClick={onClose} aria-label="Close coverage pane">
          ✕
        </button>
      </div>
      <Thumb cluster={cluster} item={lead} />
      <div className="nw-card-kick">
        {cluster.breaking && <span className="nw-tag breaking">Breaking</span>}
        {kickerOf(cluster.tags) && <span className="nw-tag">{kickerOf(cluster.tags)}</span>}
      </div>
      <h2 className="nw-pane-title">{cleanText(lead.title)}</h2>
      {gist && (
        <div className="nw-why">
          <span className="nw-why-label mono">WHY IT MATTERS</span>
          <p>{gist}</p>
          <span className="nw-why-src">First line of {lead.source}’s summary</span>
        </div>
      )}
      <div className="nw-pane-cov">
        <div className="nw-pane-cov-h">
          <span className="mono">{cluster.sources.length} OUTLETS</span>
          <span className="mono">since {timeAgo(cluster.earliest, now)}</span>
        </div>
        <CoverageBar coverage={cluster.coverage} height={16} showLabels />
        {cluster.blindspot && <BlindspotBadge side={cluster.blindspot} />}
      </div>
      <div className="nw-pane-sides">
        {(['L', 'C', 'R'] as const).map((k) =>
          bySide[k].length ? (
            <div key={k} className="nw-pane-side">
              <h4 style={{ color: SIDE_HEX[k] }}>
                <LeanDot hex={SIDE_HEX[k]} /> {SIDE_LABEL[k]}
              </h4>
              <ul>
                {bySide[k].map((i) => (
                  <li key={i.id}>
                    <Ext href={i.url}>{cleanText(i.title)}</Ext>
                    <span className="nw-pane-src">
                      {i.source} · {i.sourceLean} · {timeAgo(i.publishedAt, now)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null,
        )}
      </div>
      <Ext href={lead.url} className="nw-read-btn">
        Read at {lead.source} ↗
      </Ext>
    </section>
  );
}

function SourceList({ sources, active, onPick }: { sources: SourceRow[]; active: string; onPick: (s: string) => void }) {
  const [all, setAll] = useState(false);
  const list = all ? sources : sources.slice(0, 18);
  return (
    <section className="nw-panel">
      <h3 className="nw-panel-h">Outlets</h3>
      <p className="nw-panel-sub">Lean labels follow the AllSides 5-point scale. Tap to filter.</p>
      <div className="nw-lean-key">
        {LEAN_ORDER.slice(0, 5).map((l) => (
          <span key={l}>
            <LeanDot hex={LEAN_HEX[l]} size={7} /> {l}
          </span>
        ))}
      </div>
      {sources.length === 0 ? (
        <ul className="nw-sources">
          {Array.from({ length: 8 }, (_, i) => (
            <li key={i} className="nw-skel-line" />
          ))}
        </ul>
      ) : (
        <ul className="nw-sources">
          {list.map((s) => (
            <li key={s.name}>
              <button className={active === s.name ? 'on' : ''} onClick={() => onPick(s.name)} aria-pressed={active === s.name}>
                <LeanDot hex={LEAN_HEX[s.lean] ?? LEAN_HEX.Unrated} title={s.lean} />
                <span className="nw-sources-name">{s.name}</span>
                {s.ok === false && <span className="nw-off mono">offline</span>}
                <span className="mono nw-sources-n">{s.count}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {sources.length > 18 && (
        <button className="nw-link" onClick={() => setAll((a) => !a)}>
          {all ? 'Show fewer' : `Show all ${sources.length} outlets`}
        </button>
      )}
    </section>
  );
}

function Skeletons() {
  return (
    <div className="nw-grid" aria-busy="true" aria-label="Loading headlines">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="nw-card nw-skel-card">
          <div className="nw-thumb nw-skel" />
          <div className="nw-card-body">
            <div className="nw-skel-line w60" />
            <div className="nw-skel-line" />
            <div className="nw-skel-line w80" />
          </div>
        </div>
      ))}
    </div>
  );
}
