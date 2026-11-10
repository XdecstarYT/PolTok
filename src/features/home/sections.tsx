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
/** Minimal shape of /api/nz/results (see server/nz.js) — kept local so the NZ data module stays out of this chunk. */
interface NzParty { party: string; name?: string; pct: number; totalSeats: number }
interface NzRes { status: 'pre' | 'counting' | 'final'; updatedAt: number; votesCountedPct: number | null; party: NzParty[]; sourceKind?: 'ec' | 'wikipedia' | 'none'; error?: string }
const NZ_COLOR: Record<string, string> = { NAT: '#1f5fbf', LAB: '#d82a20', GRN: '#2e9e44', ACT: '#e8b400', NZF: '#6b6b6b', TPM: '#a2463c', OPP: '#1fb5a3' };
const NZ_SHORT: Record<string, string> = { NAT: 'National', LAB: 'Labour', GRN: 'Green', ACT: 'ACT', NZF: 'NZ First', TPM: 'Te Pāti Māori', OPP: 'Opportunity' };
/** Victorian state election — polls close 6pm AEDT Sat 28 Nov 2026. */
const VIC_DATE = '2026-11-28';
const VIC_CLOSE_MS = Date.parse('2026-11-28T18:00:00+11:00');

function NzResultCard({ r }: { r: NzRes }) {
  const top = [...r.party].sort((a, b) => b.pct - a.pct).slice(0, 4);
  const seats = r.party.some((p) => p.totalSeats > 0);
  const label = r.status === 'final' ? 'Official result' : r.sourceKind === 'wikipedia' ? 'Preliminary · unofficial' : 'Preliminary count';
  return (
    <Link to="/nz" className="card card--hover hm-wl hm-wl--res">
      <span className="row spread" style={{ gap: 6 }}>
        <span className="kicker kicker--muted truncate">Oceania</span>
        <Chip size="sm" tone={r.status === 'final' ? undefined : 'live'}>{r.status === 'final' ? 'Final' : 'Counting'}</Chip>
      </span>
      <b className="truncate">🇳🇿 New Zealand</b>
      <span className="hm-wl__bar" aria-hidden="true">
        {top.map((p) => <i key={p.party} style={{ width: `${p.pct}%`, background: NZ_COLOR[p.party] ?? 'var(--text-3)' }} />)}
      </span>
      <ul className="hm-wl__rows" aria-label="Party vote">
        {top.map((p) => (
          <li key={p.party}>
            <i style={{ background: NZ_COLOR[p.party] ?? 'var(--text-3)' }} aria-hidden="true" />
            <span className="truncate">{NZ_SHORT[p.party] ?? p.name ?? p.party}</span>
            <b className="num">{p.pct.toFixed(1)}%</b>
            {seats && <span className="num faint">{p.totalSeats}</span>}
          </li>
        ))}
      </ul>
      <span className="faint hm-wl__foot">{label}{r.votesCountedPct != null ? ` · ${Math.round(r.votesCountedPct)}% counted` : ''}{seats ? ' · seats' : ''}</span>
    </Link>
  );
}

function UsResultCard({ balance }: { balance: ReturnType<typeof useLive>['balance'] }) {
  const rows = (['senate', 'house'] as const).map((ch) => ({ ch, b: balance[ch] })).filter((x) => x.b?.total);
  return (
    <Link to="/live" className="card card--hover hm-wl hm-wl--res">
      <span className="row spread" style={{ gap: 6 }}>
        <span className="kicker kicker--muted truncate">Americas</span>
        <Chip size="sm">AP</Chip>
      </span>
      <b className="truncate">🇺🇸 United States</b>
      <ul className="hm-wl__rows" aria-label="Seats won">
        {rows.map(({ ch, b }) => (
          <li key={ch} className="hm-wl__ch">
            <span>{ch === 'senate' ? 'Senate' : 'House'}</span>
            <b className="num" style={{ color: 'var(--dem)' }}>{b!.dem + b!.ind}</b>
            <b className="num" style={{ color: 'var(--rep)' }}>{b!.rep}</b>
            <span className="num faint">{b!.undecided ? `${b!.undecided} open` : 'all called'}</span>
          </li>
        ))}
      </ul>
      <span className="faint hm-wl__foot">D (incl. caucusing ind.) – R · {rows[0].b!.majority} for Senate majority</span>
    </Link>
  );
}

type WItem = { kind: 'live' | 'soon'; key: string; d: number; country: string; region: string; office: string; dateLabel: string; at: number; to?: string; href?: string };

/** Live / recent / upcoming elections. Always has content: results already in and the next dates on the calendar. */
export function WorldLive() {
  const data = useWorldElections();
  const nz = useJSON<NzRes>('/api/nz/results');
  const { live, soon } = useMemo(() => {
    const all: WItem[] = (data?.elections ?? [])
      .filter((e) => !e.dependent)
      .map((e) => ({ e, d: daysUntil(e.date) }))
      .filter((x): x is { e: (typeof x)['e']; d: number } => x.d != null && x.d >= -1)
      .map(({ e, d }) => ({
        kind: d <= 7 ? 'live' as const : 'soon' as const, key: e.id, d, country: e.country, region: e.region, office: e.office, dateLabel: e.dateLabel,
        at: Date.parse(`${e.date}T00:00:00Z`), to: e.country === 'New Zealand' ? '/nz' : e.country === 'Australia' ? '/au' : undefined, href: e.articleUrl ?? undefined,
      }));
    // Victoria is a state election, so it is not in the national calendar; add it from PolTok's AU data.
    const vd = daysUntil(VIC_DATE);
    if (vd != null && vd >= -1 && !all.some((x) => /victoria/i.test(x.office))) {
      all.push({ kind: vd <= 7 ? 'live' : 'soon', key: 'au-vic', d: vd, country: 'Victoria, Australia', region: 'Oceania · State', office: 'Legislative Assembly', dateLabel: '28 Nov 2026', at: VIC_CLOSE_MS, to: '/au/victoria' });
    }
    all.sort((a, b) => a.d - b.d);
    // NZ is shown as a result card once figures exist, so don't repeat it as "counting".
    const nzHasNums = !!nz && nz.status !== 'pre' && nz.party?.length > 0;
    return {
      live: all.filter((x) => x.kind === 'live' && !(nzHasNums && x.country === 'New Zealand')),
      soon: all.filter((x) => x.kind === 'soon').slice(0, 8),
    };
  }, [data, nz]);
 const nzHasNums = !!nz && nz.status !== 'pre' && nz.party?.length > 0;
  const { balance } = useLive();
  const usHasNums = !!balance.senate?.total;
  return (
    <section aria-labelledby="hm-world" className="hm-world">
      <SectionHeader id="hm-world" kicker="Global" live title="Live around the world" action={<Link to="/world" className="link" style={{ fontSize: 13 }}>World calendar →</Link>} />
      {!data && nz === undefined ? <Skeleton height={118} radius={12} /> : (
        <ul className="hm-hscroll hm-wlist" aria-label="Elections: live, latest results and coming up">
          {live.map((x, i) => <li key={x.key}><GL l={i === 0 ? 'Live this week' : undefined} /><WCard x={x} /></li>)}
          {nzHasNums && <li><GL l="Latest results" /><NzResultCard r={nz!} /></li>}
          {usHasNums && <li><GL l={nzHasNums ? undefined : 'Latest results'} /><UsResultCard balance={balance} /></li>}
          {soon.map((x, i) => <li key={x.key}><GL l={i === 0 ? 'Coming up' : undefined} /><WCard x={x} /></li>)}
          {!live.length && !nzHasNums && !usHasNums && !soon.length && <li className="faint" style={{ fontSize: 13 }}>No elections on the calendar right now.</li>}
        </ul>
      )}
    </section>
  );
}
/** Group label above the first card of each group (blank spacer on the others keeps the cards aligned). */
const GL = ({ l }: { l?: string }) => <span className={`hm-wgl ${l ? '' : 'is-blank'}`} aria-hidden={!l}>{l ?? ' '}</span>;

function WCard({ x }: { x: WItem }) {
  const body = (
    <>
      <span className="row spread" style={{ gap: 6 }}>
        <span className="kicker kicker--muted truncate">{x.region}</span>
        {x.d === 0 ? <Chip size="sm" tone="live">TODAY</Chip> : x.d < 0 ? <Chip size="sm">Counting</Chip> : x.kind === 'live' ? <Chip size="sm" tone="tossup">This week</Chip> : <span className="num faint hm-wl__in">in {x.d}d</span>}
      </span>
      <b className="truncate">{x.country}</b>
      <span className="faint truncate" style={{ fontSize: 12.5 }}>{x.office}</span>
      <span className="num hm-wl__cd">{x.d > 0 && x.d <= 7 ? <Countdown to={x.at} compact /> : x.dateLabel}</span>
    </>
  );
  const cls = `card card--hover hm-wl ${x.kind === 'soon' ? 'hm-wl--soon' : ''}`;
  return x.to ? <Link to={x.to} className={cls}>{body}</Link>
    : x.href ? <a href={x.href} target="_blank" rel="noreferrer noopener" className={cls}>{body}</a>
    : <Link to="/world" className={cls}>{body}</Link>;
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
      <SectionHeader id="hm-news" kicker="The coverage" live title="Top stories" sub="Grouped by story, with who's covering it across the spectrum." action={<Button variant="ghost" size="sm" to="/news">All news</Button>} />
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
