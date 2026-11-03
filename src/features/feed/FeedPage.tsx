import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useLive } from '../../lib/live';
import { timeAgo } from '../../lib/format';
import { raceById } from '../../data';
import { BalanceBar, Kbd, LiveDot, SimBadge, useReducedMotion } from '../../components';
import { CoverageBar, LeanDot } from '../news/BiasBar';
import { clusterNews, useNow, type Cluster } from '../news/newsUtils';
import { LEAN_HEX } from '../../lib/format';
import { buildPools, idOf, kindOf, loadStore, mix, saveStore, SEGMENT_KINDS, type FeedStore, type Pools, type Segment } from './feedModel';
import { CallCard, cardMeta, CloseCard, FactCard, MarketCard, PollCard, StoryCard, type CardMeta } from './cards';
import './feed.css';

const SEGMENTS: { key: Segment; label: string }[] = [
  { key: 'foryou', label: 'For You' },
  { key: 'live', label: 'Live Results' },
  { key: 'news', label: 'News' },
];
const REACTIONS = ['🔥', '😮', '👏', '😬', '🤔'];
const AUTO_MS = 9000;
const WINDOW = 2;

export default function FeedPage() {
  const live = useLive();
  const reduced = useReducedMotion();
  const now = useNow(30_000);
  const navigate = useNavigate();

  const [segment, setSegment] = useState<Segment>('foryou');
  const [order, setOrder] = useState<string[]>([]);
  const [active, setActive] = useState(0);
  const [store, setStore] = useState<FeedStore>(loadStore);
  const [auto, setAuto] = useState<boolean>(() => !!loadStore().auto);
  const [focus, setFocus] = useState(false);
  const [picker, setPicker] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const activeRef = useRef(0);
  activeRef.current = active;

  useEffect(() => saveStore({ ...store, auto }), [store, auto]);

  // ---------- derive pools; keep a sticky cluster snapshot so cards never vanish mid-swipe
  const clusters = useMemo(() => clusterNews(live.news), [live.news]);
  const clusterStore = useRef(new Map<string, Cluster>());
  for (const c of clusters) clusterStore.current.set(c.id, c);
  const pools: Pools = useMemo(() => buildPools(live), [live.news, live.calls, live.results, live.markets]); // eslint-disable-line react-hooks/exhaustive-deps

  const metaOf = useCallback((k: string): CardMeta | null => cardMeta(k, live, clusterStore.current), [live]);

  const visible = useMemo(() => {
    const kinds = SEGMENT_KINDS[segment];
    return order.filter((k) => (!kinds || kinds.includes(kindOf(k))) && metaOf(k));
  }, [order, segment, metaOf]);
  const activeKey = visible[Math.min(active, visible.length - 1)];

  // ---------- maintain a stable order: new cards slot in just after the one being viewed
  const activeKeyRef = useRef<string | undefined>(undefined);
  activeKeyRef.current = activeKey;
  useEffect(() => {
    setOrder((prev) => {
      if (!prev.length) return mix(pools);
      const have = new Set(prev);
      const freshCalls = pools.call.filter((k) => !have.has(k));
      const restPools: Pools = {
        ...pools,
        story: pools.story.filter((k) => !have.has(k)),
        call: [],
        close: pools.close.filter((k) => !have.has(k)),
        market: pools.market.filter((k) => !have.has(k)),
        poll: pools.poll.filter((k) => !have.has(k)),
        fact: pools.fact.filter((k) => !have.has(k)),
      };
      const fresh = [...freshCalls, ...mix(restPools)];
      if (!fresh.length) return prev;
      const at = activeKeyRef.current ? prev.indexOf(activeKeyRef.current) + 1 : 0;
      return [...prev.slice(0, at), ...fresh, ...prev.slice(at)];
    });
  }, [pools]);

  // ---------- active card tracking
  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting && e.intersectionRatio >= 0.6) setActive(Number((e.target as HTMLElement).dataset.idx));
      },
      { root, threshold: [0.6] },
    );
    root.querySelectorAll('[data-idx]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [visible.length, segment]);

  const go = useCallback(
    (i: number) => {
      const root = scroller.current;
      if (!root || !visible.length) return;
      const idx = Math.max(0, Math.min(visible.length - 1, i));
      root.scrollTo({ top: idx * root.clientHeight, behavior: reduced ? 'auto' : 'smooth' });
      setPicker(false);
    },
    [visible.length, reduced],
  );

  // one card per wheel gesture (trackpads fire many events)
  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    let locked = false;
    let t: ReturnType<typeof setTimeout> | undefined;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
      e.preventDefault();
      if (!locked && Math.abs(e.deltaY) > 4) {
        locked = true;
        go(activeRef.current + (e.deltaY > 0 ? 1 : -1));
      }
      clearTimeout(t);
      t = setTimeout(() => (locked = false), 240);
    };
    root.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      root.removeEventListener('wheel', onWheel);
      clearTimeout(t);
    };
  }, [go]);
  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable="true"]') || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      if (k === 'ArrowDown' || k === 'j' || k === 'PageDown' || (k === ' ' && !e.shiftKey)) {
        e.preventDefault();
        go(activeRef.current + 1);
      } else if (k === 'ArrowUp' || k === 'k' || k === 'PageUp' || (k === ' ' && e.shiftKey)) {
        e.preventDefault();
        go(activeRef.current - 1);
      } else if (k === 'f') setFocus((f) => !f);
      else if (k === 'a') setAuto((a) => !a);
      else if (k === 'Escape') {
        setPicker(false);
        setFocus(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  // auto-advance
  useEffect(() => {
    if (!auto || !visible.length) return;
    const t = setTimeout(() => go(active + 1 >= visible.length ? 0 : active + 1), AUTO_MS);
    return () => clearTimeout(t);
  }, [auto, active, visible.length, go]);

  // segment switch resets position
  const switchSegment = (s: Segment) => {
    setSegment(s);
    setActive(0);
    scroller.current?.scrollTo({ top: 0 });
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  // ---------- rail actions
  const meta = activeKey ? metaOf(activeKey) : null;
  const reaction = activeKey ? store.reactions[activeKey] : undefined;
  const saved = activeKey ? store.saved.includes(activeKey) : false;
  const react = (emoji: string) => {
    if (!activeKey) return;
    setStore((s) => {
      const reactions = { ...s.reactions };
      if (reactions[activeKey] === emoji) delete reactions[activeKey];
      else reactions[activeKey] = emoji;
      return { ...s, reactions };
    });
    setPicker(false);
  };
  const toggleSave = () => {
    if (!activeKey) return;
    setStore((s) => ({ ...s, saved: saved ? s.saved.filter((k) => k !== activeKey) : [activeKey, ...s.saved].slice(0, 200) }));
    setToast(saved ? 'Removed from saved' : 'Saved');
  };
  const shareUrl = meta ? meta.href ?? (meta.to ? location.origin + meta.to : location.href) : location.href;
  const share = async () => {
    if (!meta) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: meta.title, url: shareUrl });
        return;
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setToast('Link copied');
    } catch {
      setToast('Copy failed');
    }
  };
  const open = () => {
    if (!meta) return;
    if (meta.href) window.open(meta.href, '_blank', 'noopener,noreferrer');
    else if (meta.to) navigate(meta.to);
  };

  const ambient: CSSProperties = meta
    ? ({ '--a': meta.tint[0], '--b': meta.tint[1] } as CSSProperties)
    : ({ '--a': '#3d7bff', '--b': '#ff3d55' } as CSSProperties);

  const counts = useMemo(() => {
    const c = { story: 0, live: 0 };
    for (const k of order) kindOf(k) === 'story' ? c.story++ : c.live++;
    return c;
  }, [order]);
  const anySim = visible.slice(Math.max(0, active - 1), active + 2).some((k) => metaOf(k)?.simulated);

  return (
    <div className={`fd-root ${focus ? 'is-focus' : ''}`} style={ambient}>
      <div className="fd-ambient" aria-hidden="true">
        {meta?.image ? <img src={meta.image} alt="" referrerPolicy="no-referrer" /> : null}
      </div>

      {/* ---------- left side panel (desktop) ---------- */}
      <aside className="fd-side fd-left" aria-label="About this card">
        <div className="fd-brand">
          <span className="fd-logo">PolTok</span>
          <LiveDot />
        </div>
        <p className="fd-side-sub">Election night, one swipe at a time. Real headlines from {new Set(live.news.map((n) => n.source)).size || '—'} outlets, plus live results.</p>
        {activeKey && meta && <NowPanel k={activeKey} meta={meta} cluster={clusterStore.current.get(idOf(activeKey))} now={now} />}
        <div className="fd-keys">
          <div>
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> or <Kbd>J</Kbd>
            <Kbd>K</Kbd> navigate
          </div>
          <div>
            <Kbd>A</Kbd> auto-advance · <Kbd>F</Kbd> focus
          </div>
        </div>
      </aside>

      {/* ---------- the phone column ---------- */}
      <section className="fd-stage" aria-label="PolTok feed">
        <div className="fd-top">
          <div className="fd-seg" role="tablist" aria-label="Feed filter">
            {SEGMENTS.map((s) => (
              <button key={s.key} role="tab" aria-selected={segment === s.key} className={segment === s.key ? 'on' : ''} onClick={() => switchSegment(s.key)}>
                {s.label}
                {segment === s.key && !reduced && <motion.span layoutId="fd-seg-ind" className="fd-seg-ind" />}
              </button>
            ))}
          </div>
          <div className="fd-top-tools">
            <button className={`fd-icon ${auto ? 'on' : ''}`} onClick={() => setAuto((a) => !a)} aria-pressed={auto} aria-label={auto ? 'Pause auto-advance' : 'Auto-advance'} title="Auto-advance (A)">
              {auto ? (
                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 5h4v14H7zM13 5h4v14h-4z" /></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5v14l11-7z" /></svg>
              )}
            </button>
            <button className={`fd-icon ${focus ? 'on' : ''}`} onClick={() => setFocus((f) => !f)} aria-pressed={focus} aria-label="Focus mode" title="Focus mode (F)">
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 9V4h5v2H6v3zm11-5h5v5h-2V6h-3zM4 15h2v3h3v2H4zm14 3v-3h2v5h-5v-2zM12 9a3 3 0 110 6 3 3 0 010-6z" /></svg>
            </button>
          </div>
        </div>

        {auto && visible.length > 0 && (
          <div className="fd-progress" aria-hidden="true">
            <span key={`${activeKey}-${active}`} style={{ animationDuration: `${AUTO_MS}ms` }} />
          </div>
        )}

        <div className="fd-scroller" ref={scroller} tabIndex={0} role="feed" aria-busy={!visible.length} aria-label={`${SEGMENTS.find((s) => s.key === segment)?.label} feed`}>
          {visible.length === 0 ? (
            <EmptyCard segment={segment} connecting={live.mode === 'connecting'} />
          ) : (
            visible.map((k, i) => {
              const near = Math.abs(i - active) <= WINDOW;
              const m = near ? metaOf(k) : null;
              return (
                <article
                  key={k}
                  data-idx={i}
                  className={`fd-card k-${kindOf(k)} ${i === active ? 'is-active' : ''}`}
                  aria-posinset={i + 1}
                  aria-setsize={visible.length}
                  aria-label={m?.title}
                >
                  {near && m ? <CardSwitch k={k} meta={m} active={i === active} reduced={reduced} now={now} live={live} cluster={clusterStore.current.get(idOf(k))} /> : null}
                </article>
              );
            })
          )}
        </div>

        {/* progress dots */}
        {visible.length > 1 && (
          <div className="fd-dots" aria-hidden="true">
            {visible.slice(Math.max(0, active - 4), active + 5).map((k, j) => {
              const i = Math.max(0, active - 4) + j;
              return <span key={k} className={`${i === active ? 'on' : ''} k-${kindOf(k)}`} style={{ opacity: 1 - Math.abs(i - active) * 0.17 }} />;
            })}
          </div>
        )}
        <div className="fd-counter mono" aria-live="polite">
          {visible.length ? `${active + 1} / ${visible.length}` : ''}
        </div>

        {/* action rail */}
        {meta && (
          <div className="fd-rail" role="toolbar" aria-label="Card actions">
            <div className="fd-rail-item">
              <button className={`fd-rail-btn ${reaction ? 'on' : ''}`} onClick={() => setPicker((p) => !p)} aria-expanded={picker} aria-label={reaction ? `Your reaction ${reaction}. Change reaction` : 'React'}>
                {reaction ? <span className="fd-emoji">{reaction}</span> : <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 21l-1.4-1.3C5.4 15 2 12 2 8.4 2 5.4 4.4 3 7.4 3c1.7 0 3.4.8 4.6 2.1C13.2 3.8 14.9 3 16.6 3 19.6 3 22 5.4 22 8.4c0 3.6-3.4 6.6-8.6 11.3z" /></svg>}
              </button>
              <span>{reaction ? 'Reacted' : 'React'}</span>
              <AnimatePresence>
                {picker && (
                  <motion.div className="fd-picker" initial={{ opacity: 0, x: 12, scale: 0.9 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 12, scale: 0.9 }} transition={{ duration: 0.18 }}>
                    {REACTIONS.map((r) => (
                      <button key={r} onClick={() => react(r)} className={reaction === r ? 'on' : ''} aria-label={`React ${r}`}>
                        {r}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="fd-rail-item">
              <button className={`fd-rail-btn ${saved ? 'on' : ''}`} onClick={toggleSave} aria-pressed={saved} aria-label={saved ? 'Unsave' : 'Save'}>
                <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" d="M6 3h12v18l-6-4-6 4z" /></svg>
              </button>
              <span>{saved ? 'Saved' : 'Save'}</span>
            </div>
            <div className="fd-rail-item">
              <button className="fd-rail-btn" onClick={share} aria-label="Share">
                <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M14 4l7 7-7 7v-4c-5 0-8.5 1.6-11 5 1-5 4-10 11-11z" /></svg>
              </button>
              <span>Share</span>
            </div>
            <div className="fd-rail-item">
              <button className="fd-rail-btn" onClick={open} aria-label={meta.href ? 'Open source article in new tab' : 'Open details'}>
                <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M14 3h7v7h-2V6.4l-9.3 9.3-1.4-1.4L17.6 5H14zM5 5h6v2H5v12h12v-6h2v8H3V5z" /></svg>
              </button>
              <span>{meta.href ? 'Source' : 'Open'}</span>
            </div>
          </div>
        )}

        {focus && (
          <button className="fd-exit-focus" onClick={() => setFocus(false)}>
            Exit focus
          </button>
        )}

        <AnimatePresence>
          {toast && (
            <motion.div className="fd-toast" role="status" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
              {toast}
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* ---------- right side panel (desktop) ---------- */}
      <aside className="fd-side fd-right" aria-label="Up next and live">
        <div className="fd-panel">
          <h3>Up next</h3>
          <ol className="fd-next">
            {visible.slice(active + 1, active + 6).map((k, j) => {
              const m = metaOf(k);
              if (!m) return null;
              return (
                <li key={k}>
                  <button onClick={() => go(active + 1 + j)}>
                    <span className={`fd-next-kind k-${kindOf(k)}`}>{m.kicker}</span>
                    <span className="fd-next-title">{m.title}</span>
                  </button>
                </li>
              );
            })}
            {visible.length <= active + 1 && <li className="fd-muted">You’re all caught up.</li>}
          </ol>
        </div>
        <div className="fd-panel">
          <h3>
            Balance of power <SimBadge compact />
          </h3>
          <BalanceBar balance={live.balance.senate} compact />
          <div style={{ height: 12 }} />
          <BalanceBar balance={live.balance.house} compact />
          <div className="fd-stats mono">
            <span>{live.calls.length} calls</span>
            <span>{counts.story} stories</span>
            <span>{store.saved.length} saved</span>
          </div>
          {anySim && <p className="fd-muted small">Results, calls and market odds are simulated for demonstration.</p>}
        </div>
      </aside>
    </div>
  );
}

function CardSwitch({ k, meta, active, reduced, now, live, cluster }: { k: string; meta: CardMeta; active: boolean; reduced: boolean; now: number; live: ReturnType<typeof useLive>; cluster?: Cluster }) {
  const id = idOf(k);
  switch (kindOf(k)) {
    case 'story':
      return cluster ? <StoryCard cluster={cluster} meta={meta} active={active} reduced={reduced} now={now} /> : null;
    case 'call':
      return <CallCard raceId={id} live={live} meta={meta} active={active} reduced={reduced} now={now} />;
    case 'close':
      return <CloseCard raceId={id} live={live} meta={meta} active={active} reduced={reduced} />;
    case 'market':
      return <MarketCard id={id} live={live} meta={meta} active={active} reduced={reduced} />;
    case 'poll':
      return <PollCard id={id} meta={meta} active={active} reduced={reduced} />;
    case 'fact':
      return <FactCard abbr={id} meta={meta} active={active} reduced={reduced} />;
  }
}

function NowPanel({ k, meta, cluster, now }: { k: string; meta: CardMeta; cluster?: Cluster; now: number }) {
  const kind = kindOf(k);
  return (
    <div className="fd-panel">
      <h3>Now viewing</h3>
      <div className="fd-now-kick">{meta.kicker}</div>
      <p className="fd-now-title">{meta.title}</p>
      {kind === 'story' && cluster ? (
        <>
          <CoverageBar coverage={cluster.coverage} height={8} showLabels />
          <ul className="fd-srcs">
            {cluster.items.slice(0, 8).map((i) => (
              <li key={i.id}>
                <LeanDot hex={LEAN_HEX[i.sourceLean] ?? LEAN_HEX.Unrated} title={i.sourceLean} />
                <a href={/^https?:/i.test(i.url) ? i.url : undefined} target="_blank" rel="noopener noreferrer">
                  {i.source}
                </a>
                <span className="mono">{timeAgo(i.publishedAt, now)}</span>
              </li>
            ))}
          </ul>
        </>
      ) : kind === 'call' || kind === 'close' ? (
        <Link className="fd-side-link" to={`/race/${idOf(k)}`}>
          {raceById.get(idOf(k))?.title} race page →
        </Link>
      ) : meta.to ? (
        <Link className="fd-side-link" to={meta.to}>
          Go deeper →
        </Link>
      ) : null}
    </div>
  );
}

function EmptyCard({ segment, connecting }: { segment: Segment; connecting: boolean }) {
  return (
    <article className="fd-card fd-empty" data-idx={0}>
      <div className="fd-bg" aria-hidden="true">
        <div className="fd-art fd-art-loading" />
        <div className="fd-scrim" />
      </div>
      <div className="fd-body center">
        <div className="fd-spinner" aria-hidden="true" />
        <h2 className="fd-headline fd-h-md">{connecting || segment !== 'live' ? 'Connecting to the newsroom…' : 'Waiting for the first results…'}</h2>
        <p className="fd-note">
          {segment === 'live' ? 'Race calls, close races and market moves will stream in here as polls close.' : 'Pulling headlines from outlets across the spectrum.'}
        </p>
        <div className="fd-skel-lines">
          <span />
          <span />
          <span />
        </div>
      </div>
    </article>
  );
}
