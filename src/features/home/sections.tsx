/**
 * Below-the-fold home sections. This whole module is lazy-loaded by HomePage (one chunk) so the
 * first paint only needs the hero + balance of power.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useLive } from '../../lib/live';
import { useWatchlist } from '../../lib/watchlist';
import { RACES } from '../../data';
import { PARTY_HEX, fmtInt, fmtPct, timeAgo } from '../../lib/format';
import type { NewsItem, Party } from '../../types';
import { BiasBar, Button, Card, Chip, Countdown, EmptyState, SectionHeader, Skeleton, leanCounts, useNow } from '../../components';
import { useWorldElections, daysUntil } from '../world/data';
import { useFlipsData } from '../flips/data';
import { WatchStrip } from '../watch/WatchStrip';
import { readHistory, readLocal, type Visit } from './prefs';

/* ───────── tiny fetch hook ───────── */
const cache = new Map<string, Promise<unknown>>();
function useJSON<T>(url: string): T | null | undefined {
  const [d, setD] = useState<T | null | undefined>(undefined);
  useEffect(() => {
    let on = true;
    let p = cache.get(url);
    if (!p) {
      p = fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      cache.set(url, p);
    }
    p.then((v) => on && setD(v as T | null));
    return () => { on = false; };
  }, [url]);
  return d;
}

/* ───────── (2) live around the world ───────── */
export function WorldLive() {
  const data = useWorldElections();
  const list = useMemo(() => (data?.elections ?? [])
    .map((e) => ({ e, d: daysUntil(e.date) }))
    .filter((x) => x.d != null && x.d >= -1 && x.d <= 7)
    .sort((a, b) => (a.d ?? 0) - (b.d ?? 0)), [data]);
  if (data && !list.length) return null;
  return (
    <section aria-labelledby="hm-world" className="hm-world">
      <div className="row spread row-wrap" style={{ gap: 8 }}>
        <h2 id="hm-world" className="hm-strip__title"><span className="hm-pulse" aria-hidden="true" />Live around the world <span className="faint">· this week</span></h2>
        <Link to="/world" className="link" style={{ fontSize: 13 }}>World calendar →</Link>
      </div>
      {!data ? <Skeleton height={64} radius={12} /> : (
        <ul className="hm-hscroll" aria-label="Elections this week">
          {list.map(({ e, d }) => {
            const at = Date.parse(`${e.date}T00:00:00Z`);
            const nz = e.country === 'New Zealand';
            const body = (
              <>
                <span className="row spread" style={{ gap: 6 }}>
                  <span className="kicker kicker--muted truncate">{e.region}</span>
                  {d === 0 ? <Chip size="sm" tone="live">TODAY</Chip> : d! < 0 ? <Chip size="sm">Counting</Chip> : null}
                </span>
                <b className="truncate">{e.country}</b>
                <span className="faint truncate" style={{ fontSize: 12.5 }}>{e.office}</span>
                <span className="num hm-wl__cd">{d! > 0 ? <Countdown to={at} compact /> : e.dateLabel}</span>
              </>
            );
            return (
              <li key={e.id}>
                {nz ? <Link to="/nz" className="card card--hover hm-wl">{body}</Link>
                  : <a href={e.articleUrl ?? '/world'} target="_blank" rel="noreferrer noopener" className="card card--hover hm-wl">{body}</a>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ───────── (5) markets ticker ───────── */
interface AuMk { id: string; question: string; url?: string; outcomes: { label: string; prob: number; color?: string }[] }
interface P28 { id: string; title: string; url?: string; outcomes: { label: string; prob: number; change1w?: number }[] }
interface Tick { k: string; label: string; lead: string; p: number; color: string; to: string; ext?: boolean; delta?: number }

export function Markets() {
  const { markets } = useLive();
  const au = useJSON<{ markets: AuMk[] }>('/api/au/markets');
  const p28 = useJSON<{ markets: P28[] }>('/api/pres2028');
  const ticks = useMemo(() => {
    const out: Tick[] = [];
    const top = <T extends { prob: number }>(o: T[]) => [...o].sort((a, b) => b.prob - a.prob)[0];
    for (const ch of ['House', 'Senate']) {
      const m = markets.find((x) => !x.raceId && new RegExp(`\\b${ch}\\b`).test(x.question));
      if (m?.outcomes.length) {
        const t = top(m.outcomes);
        out.push({ k: m.id, label: `US ${ch} control`, lead: t.label, p: t.prob, color: t.color ?? (/dem/i.test(t.label) ? PARTY_HEX.D : PARTY_HEX.R), to: '/polls' });
      }
    }
    const party = p28?.markets.find((m) => m.id === 'party');
    if (party?.outcomes.length) {
      const t = top(party.outcomes);
      out.push({ k: '2028', label: 'White House 2028', lead: t.label, p: t.prob, color: /dem/i.test(t.label) ? PARTY_HEX.D : PARTY_HEX.R, to: '/2028', delta: t.change1w });
    }
    for (const id of ['au:vic-winner', 'au:vic-premier', 'au:pm-next']) {
      const m = au?.markets.find((x) => x.id === id);
      if (!m?.outcomes.length) continue;
      const t = top(m.outcomes);
      out.push({ k: id, label: id === 'au:vic-winner' ? 'Victoria 2026 winner' : id === 'au:vic-premier' ? 'Next Vic Premier' : 'Next Australian PM', lead: t.label, p: t.prob, color: t.color ?? 'var(--accent)', to: '/au/victoria' });
    }
    const nz = au?.markets.find((x) => /^nz[:-]/i.test(x.id));
    if (nz?.outcomes.length) { const t = top(nz.outcomes); out.push({ k: nz.id, label: 'New Zealand', lead: t.label, p: t.prob, color: t.color ?? 'var(--accent)', to: '/nz' }); }
    return out;
  }, [markets, au, p28]);
  return (
    <section aria-labelledby="hm-mk" className="hm-mk">
      <h2 id="hm-mk" className="sr-only">Prediction markets</h2>
      <span className="hm-mk__tag kicker">Markets</span>
      {ticks.length ? (
        <ul className="hm-mk__list">
          {ticks.map((t) => (
            <li key={t.k}>
              <Link to={t.to} className="hm-mk__item" style={{ '--c': t.color } as CSSProperties}>
                <span className="faint truncate">{t.label}</span>
                <b className="truncate">{t.lead}</b>
                <span className="num hm-mk__p">{Math.round(t.p * 100)}%</span>
                {t.delta ? <span className={`num hm-mk__d ${t.delta > 0 ? 'up' : 'down'}`}>{t.delta > 0 ? '▲' : '▼'}{Math.abs(Math.round(t.delta * 100))}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : <Skeleton height={20} width="70%" />}
      <span className="hm-mk__src faint">Polymarket odds · not forecasts</span>
    </section>
  );
}

/* ───────── (3) personalised ───────── */
const AREA_KEY = 'poltok.myarea.v1';
export function ForYou() {
  const { ids } = useWatchlist();
  const [recent, setRecent] = useState<Visit[]>([]);
  useEffect(() => { setRecent(readHistory().slice(0, 6)); }, []);
  const area = useMemo(() => readLocal<{ country?: string; q?: string } | null>(AREA_KEY, null), []);
  const now = useNow(60000);
  return (
    <section aria-labelledby="hm-you" className="hm-you">
      <SectionHeader id="hm-you" kicker="For you" title="Your PolTok" sub="Saved only in this browser." />
      {ids.length > 0 && <WatchStrip />}
      <div className="hm-you__grid">
        <Link to="/my" className="card card--hover hm-you__area">
          <span className="kicker kicker--accent">Your area</span>
          <b className="hm-you__big">{area?.q ? area.q : 'Set your address or postcode'}</b>
          <span className="faint" style={{ fontSize: 13 }}>{area?.q ? `${area.country === 'au' ? 'Australia' : 'United States'} · your representatives, ballot & seats →` : 'See your representatives, districts and what\'s on your ballot →'}</span>
        </Link>
        <Card className="hm-you__watch">
          <span className="kicker kicker--muted">Watchlist</span>
          {ids.length ? (
            <><b className="hm-you__big num">{ids.length} <small className="faint">races & seats</small></b>
              <Link className="link" to="/watch" style={{ fontSize: 13 }}>Open watchlist →</Link></>
          ) : (
            <><span style={{ fontSize: 14 }}>Star races and seats to follow them here.</span>
              <Link className="link" to="/races" style={{ fontSize: 13 }}>Browse races →</Link></>
          )}
        </Card>
        <Card className="hm-you__recent">
          <span className="kicker kicker--muted">Recently viewed</span>
          {recent.length ? (
            <ul className="hm-recent">
              {recent.map((v) => (
                <li key={v.path}><Link to={v.path} className="truncate">{v.title}</Link><span className="faint num">{timeAgo(v.at, now)}</span></li>
              ))}
            </ul>
          ) : <span className="faint" style={{ fontSize: 13 }}>Pages you open will show up here.</span>}
        </Card>
      </div>
    </section>
  );
}

/* ───────── (7) quick tools ───────── */
function useTrivia() {
  return useMemo(() => {
    const s = readLocal<{ streak?: number; last?: string }>('qz.trivia', {});
    const today = new Date().toISOString().slice(0, 10);
    return { streak: s.streak ?? 0, done: s.last === today };
  }, []);
}
export function Tools() {
  const t = useTrivia();
  const tools = [
    { to: '/ask', icon: '✦', t: 'Ask PolTok', s: 'Any question, sourced answers' },
    { to: '/au/swingometer', icon: '⇄', t: 'Swingometer', s: 'Swing Victoria seat by seat' },
    { to: '/map/build', icon: '◧', t: 'Build your map', s: 'Make & share a prediction' },
    { to: '/quiz', icon: '?', t: 'Daily trivia', s: t.streak ? `${t.streak}-day streak${t.done ? ' · done today ✓' : ' · keep it going'}` : 'Five questions a day' },
    { to: '/compare', icon: '≷', t: 'Compare', s: 'Races & candidates side by side' },
  ];
  return (
    <nav aria-label="Quick tools" className="hm-tools">
      {tools.map((x) => (
        <Link key={x.to} to={x.to} className="card card--hover hm-tool">
          <span className="hm-tool__i" aria-hidden="true">{x.icon}</span>
          <span className="stack" style={{ gap: 2, minWidth: 0 }}>
            <b>{x.t}</b><span className="faint" style={{ fontSize: 12.5 }}>{x.s}</span>
          </span>
        </Link>
      ))}
    </nav>
  );
}

/* ───────── (4) top stories ───────── */
export function TopStories() {
  const { news } = useLive();
  const now = useNow(60000);
  const clusters = useMemo(() => {
    const map = new Map<string, NewsItem[]>();
    for (const n of news ?? []) {
      const k = n.clusterId ?? n.id;
      (map.get(k) ?? map.set(k, []).get(k)!).push(n);
    }
    return [...map.values()]
      .map((arr) => ({ arr, srcs: new Set(arr.map((x) => x.source)).size, latest: Math.max(...arr.map((x) => x.publishedAt)) }))
      .sort((a, b) => (b.srcs * 3 - (now - b.latest) / 3.6e6) - (a.srcs * 3 - (now - a.latest) / 3.6e6))
      .slice(0, 6);
  }, [news, now]);
  return (
    <section aria-labelledby="hm-news" className="hm-news">
      <SectionHeader id="hm-news" kicker="News 2.0" title="Top stories" sub="Grouped by story, with who's covering it." action={<Button variant="ghost" size="sm" to="/news">All news</Button>} />
      {!clusters.length ? <div className="card pt-card stack"><Skeleton height={22} /><Skeleton lines={5} /></div> : (
        <ol className="hm-stories">
          {clusters.map(({ arr, srcs, latest }, i) => {
            const lead = arr.find((x) => x.image) ?? arr[0];
            return (
              <li key={lead.id} className={i === 0 ? 'is-lead' : ''}>
                <Link to={`/story/${encodeURIComponent(lead.clusterId ?? lead.id)}`} className="card card--hover hm-st">
                  {i === 0 && lead.image && <img src={lead.image} alt="" className="hm-st__img" loading="lazy" decoding="async" width={800} height={450} />}
                  <span className="kicker kicker--muted truncate">{srcs} source{srcs > 1 ? 's' : ''} · {timeAgo(latest, now)}</span>
                  <span className="hm-st__title clamp-3">{lead.title}</span>
                  <BiasBar counts={leanCounts(arr)} height={6} />
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

/* ───────── (6) today in politics ───────── */
interface CalEv { id: string; date: string; time?: string; title: string; jurisdiction: string; country: string; type: string; link?: string; start?: number }
const FLAG: Record<string, string> = { US: '🇺🇸', AU: '🇦🇺', NZ: '🇳🇿' };
export function Today() {
  const d = useJSON<{ events: CalEv[] }>('/api/calendar');
  const evs = useMemo(() => {
    const now = Date.now();
    const today = new Date(now).toISOString().slice(0, 10);
    const end = new Date(now + 7 * 864e5).toISOString().slice(0, 10);
    return (d?.events ?? []).filter((e) => e.date >= today && e.date <= end).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8);
  }, [d]);
  return (
    <section aria-labelledby="hm-today">
      <SectionHeader id="hm-today" kicker="Next 7 days" title="Today in politics" action={<Button variant="ghost" size="sm" to="/calendar">Calendar</Button>} />
      {d === undefined ? <Skeleton lines={4} height={18} /> : !evs.length ? (
        <EmptyState compact title="Quiet week" description="No scheduled deadlines or votes in the next seven days." />
      ) : (
        <ol className="hm-cal">
          {evs.map((e) => {
            const dt = new Date(`${e.date}T12:00:00Z`);
            const inner = (
              <>
                <span className="hm-cal__date num"><b>{dt.getUTCDate()}</b><small>{dt.toLocaleString('en', { month: 'short', timeZone: 'UTC' })}</small></span>
                <span className="stack" style={{ gap: 2, minWidth: 0 }}>
                  <b className="clamp-2" style={{ fontSize: 14 }}>{e.title}</b>
                  <span className="faint truncate" style={{ fontSize: 12 }}>{FLAG[e.country] ?? '🌐'} {e.jurisdiction} · {e.type}{e.time ? ` · ${e.time}` : ''}</span>
                </span>
              </>
            );
            return <li key={e.id}>{e.link?.startsWith('/') ? <Link to={e.link} className="hm-cal__row">{inner}</Link> : <div className="hm-cal__row">{inner}</div>}</li>;
          })}
        </ol>
      )}
    </section>
  );
}

/* ───────── (8) data highlights ───────── */
export function Highlights() {
  const { data } = useFlipsData(120000);
  const { results } = useLive();
  const items = useMemo(() => {
    const all = data?.races ?? [];
    const called = all.filter((f) => f.called && f.winner && f.cands.length > 1);
    const marg = (f: (typeof called)[number]) => f.cands[0].pct - f.cands[1].pct;
    const big = called.filter((f) => f.flipped).sort((a, b) => marg(b) - marg(a))[0];
    const close = [...called].sort((a, b) => marg(a) - marg(b))[0];
    let votes = 0;
    for (const r of Object.values(results)) for (const v of Object.values(r.votes ?? {})) votes += v || 0;
    const miss = called
      .filter((f) => f.rating && /lean|likely|solid/i.test(f.rating) && !/toss/i.test(f.rating))
      .filter((f) => { const fav = /\bD\b|dem/i.test(f.rating!) ? 'D' : /\bR\b|rep/i.test(f.rating!) ? 'R' : undefined; return fav && f.winner!.party !== fav; })
      .sort((a, b) => marg(b) - marg(a))[0];
    const out: { k: string; v: string; t: string; s: string; p?: string; to: string }[] = [];
    if (big) out.push({ k: 'Biggest flip', v: `${big.winner!.party}+${marg(big).toFixed(1)}`, t: big.label, s: `${big.winner!.name} took it from the ${big.before === 'D' ? 'Democrats' : big.before === 'R' ? 'Republicans' : 'incumbent party'}`, p: big.winner!.party, to: '/flips' });
    if (close) out.push({ k: 'Closest race', v: fmtPct(marg(close), 2), t: close.label, s: `${close.cands[0].name} over ${close.cands[1].name}`, p: close.cands[0].party, to: '/flips' });
    if (votes) out.push({ k: 'Votes counted', v: `${(votes / 1e6).toFixed(1)}M`, t: 'Across tracked races', s: `${fmtInt(Object.keys(results).length)} races reporting`, to: '/live' });
    if (miss) out.push({ k: 'Polling miss', v: `${miss.winner!.party}+${marg(miss).toFixed(1)}`, t: miss.label, s: `Rated ${miss.rating} — ${miss.winner!.name} won anyway`, p: miss.winner!.party, to: '/analysis' });
    return out;
  }, [data, results]);
  return (
    <section aria-labelledby="hm-hl">
      <SectionHeader id="hm-hl" kicker="By the numbers" title="Data highlights" live />
      {!items.length ? <Skeleton height={120} radius={14} /> : (
        <ul className="hm-hscroll hm-hl" aria-label="Data highlights">
          {items.map((i) => (
            <li key={i.k}>
              <Link to={i.to} className="card card--hover hm-hlc" style={{ '--p': i.p ? PARTY_HEX[i.p as Party] : 'var(--accent)' } as CSSProperties}>
                <span className="kicker">{i.k}</span>
                <b className="hm-hlc__v num">{i.v}</b>
                <span className="hm-hlc__t truncate">{i.t}</span>
                <span className="faint clamp-2" style={{ fontSize: 12.5 }}>{i.s}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ───────── (9) what's new ───────── */
const CHANGES = [
  { d: 'Nov 6', t: 'Global home page', s: 'Switch the headline between the US, Australia, New Zealand and the world.' },
  { d: 'Nov 5', t: 'Card studio', s: 'Premium share-card designs, backgrounds and one-tap shuffle.' },
  { d: 'Nov 4', t: 'Australian portraits', s: '236 freely licensed photos of Australian MPs and candidates.' },
  { d: 'Nov 3', t: 'News 2.0', s: 'Stories grouped across outlets, with bias bars and blind spots.' },
];
export function WhatsNew() {
  return (
    <Card className="hm-new">
      <span className="kicker kicker--accent">What's new on PolTok</span>
      <ul className="hm-new__list">
        {CHANGES.map((c) => <li key={c.t}><span className="num faint">{c.d}</span><span><b>{c.t}</b> — <span className="muted">{c.s}</span></span></li>)}
      </ul>
    </Card>
  );
}
