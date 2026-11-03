import { useMemo, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLive } from '../../lib/live';
import { POLL_SERIES, RACES, STATES, raceById } from '../../data';
import { PARTY_HEX, PARTY_NAME, RATING_HEX, fmtPct, marginColor, timeAgo } from '../../lib/format';
import type { NewsItem, PollSeries, Race, RaceResult } from '../../types';
import {
  Avatar, BalanceBar, BiasBar, Button, Card, Chip, Countdown, ELECTION_DATE, EmptyState, LiveDot, MarginChip, Needle,
  PartyDot, ProgressBar, RatingBadge, SectionHeader, SimBadge, Skeleton, Sparkline, fmtHHMM, leanCounts, useNow,
  useReducedMotion, zonedTime,
} from '../../components';
import { USMap } from '../map/USMap';
import './home.css';

/* ───────── helpers ───────── */

function summarize(race: Race, result?: RaceResult) {
  const cands = race.candidates ?? [];
  const votes = result?.votes ?? {};
  const total = Object.values(votes).reduce((a, b) => a + (b || 0), 0);
  const rows = cands
    .map((c) => ({ c, v: votes[c.id] ?? 0, pct: total ? ((votes[c.id] ?? 0) / total) * 100 : 0, prob: result?.winProb?.[c.id] }))
    .sort((a, b) => b.v - a.v || (b.prob ?? 0) - (a.prob ?? 0));
  const lead = total ? rows[0] : undefined;
  const margin = total && rows.length > 1 ? rows[0].pct - rows[1].pct : 0;
  return { rows, total, lead, margin };
}

function useClosings(now: number) {
  return useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const s of STATES ?? []) {
      if (!s?.pollClose) continue;
      groups.set(s.pollClose, [...(groups.get(s.pollClose) ?? []), s.abbr]);
    }
    const list = [...groups.entries()]
      .map(([hhmm, states]) => ({ hhmm, states: states.sort(), at: zonedTime(ELECTION_DATE, hhmm) }))
      .sort((a, b) => a.at - b.at);
    const next = list.find((g) => g.at > now);
    const closed = list.filter((g) => g.at <= now).reduce((a, g) => a + g.states.length, 0);
    return { list, next, closed };
  }, [Math.floor(now / 30000)]);
}

function seriesAvg(s: PollSeries, n = 6) {
  const polls = [...(s.polls ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  const recent = polls.slice(-n);
  const avg = (k: string) => (recent.length ? recent.reduce((a, p) => a + (p.values?.[k] ?? 0), 0) / recent.length : NaN);
  return { polls, avg };
}

const statusChip = (r?: RaceResult) => {
  if (!r || r.status === 'not-started') return <Chip size="sm">Polls open</Chip>;
  if (r.status === 'called') return <Chip size="sm" tone="accent">✓ Called</Chip>;
  if (r.status === 'too-close') return <Chip size="sm" tone="tossup">Too close</Chip>;
  if (r.status === 'polls-closed') return <Chip size="sm" tone="live">Polls closed</Chip>;
  return <Chip size="sm" tone="live">Counting</Chip>;
};

/* ───────── sections ───────── */

const count = (ch: Race['chamber'], fallback: number) => {
  const n = (RACES ?? []).filter((r) => r.chamber === ch).length;
  return n >= fallback * 0.8 ? n : fallback;
};

function Hero() {
  const now = useNow(1000);
  const { next, closed, list } = useClosings(now);
  const { calls, balance } = useLive();
  const etDate = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'short', day: 'numeric' }).format(now);
  return (
    <section className="hm-hero" aria-labelledby="hm-title">
      <div className="hm-hero__copy">
        <div className="row row-wrap" style={{ gap: 10 }}>
          <LiveDot label="ELECTION NIGHT" />
          <span className="kicker kicker--muted">{etDate} · U.S. Midterms</span>
        </div>
        <h1 id="hm-title" className="hm-hero__title">
          Election Night <span className="hm-hero__year">2026</span>
        </h1>
        <p className="hm-hero__lede">
          {count('senate', 35)} Senate seats, {count('house', 435)} House seats and {count('governor', 36)} governorships on the ballot.
          Every call, every swing, every story — as it happens.
        </p>
        <div className="row row-wrap" style={{ gap: 10 }}>
          <Button variant="accent" size="lg" to="/live">Enter the command center →</Button>
          <Button variant="ghost" size="lg" to="/feed">Swipe PolTok</Button>
        </div>
        <div className="hm-hero__stats num">
          <span><b>{calls.length}</b> races called</span>
          <span><b>{closed}</b>/{(STATES ?? []).length || '—'} states closed</span>
          <span><b>{(balance.house?.undecided ?? 0) + (balance.senate?.undecided ?? 0) || '—'}</b> seats undecided</span>
        </div>
      </div>

      <div className="hm-close card card--accent">
        <div className="row spread">
          <span className="panel-title">Next poll closing</span>
          <span className="kicker kicker--muted">Eastern time</span>
        </div>
        {next ? (
          <>
            <div className="hm-close__time">
              <span className="num">{fmtHHMM(next.hhmm)}</span>
              <span className="faint"> ET</span>
            </div>
            <Countdown to={next.at} />
            <div className="hm-close__states">
              {next.states.slice(0, 18).map((a) => (
                <Chip key={a} size="sm" to={`/state/${a}`}>{a}</Chip>
              ))}
              {next.states.length > 18 && <Chip size="sm">+{next.states.length - 18}</Chip>}
            </div>
          </>
        ) : list.length ? (
          <div className="stack" style={{ gap: 6 }}>
            <div className="hm-close__time">All polls closed</div>
            <p className="muted" style={{ fontSize: 14 }}>Every state has closed. It's all about the count now.</p>
          </div>
        ) : (
          <Skeleton lines={3} height={18} />
        )}
        {list.length > 0 && (
          <ol className="hm-close__timeline" aria-label="Poll closing schedule">
            {list.map((g) => (
              <li key={g.hhmm} className={g.at <= now ? 'is-done' : g === next ? 'is-next' : ''}>
                <span className="num">{fmtHHMM(g.hhmm)}</span>
                <span className="hm-close__n">{g.states.length}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function Control() {
  const { balance } = useLive();
  const chambers = [
    { key: 'senate' as const, title: 'Senate', b: balance.senate },
    { key: 'house' as const, title: 'House', b: balance.house },
  ];
  return (
    <section aria-labelledby="hm-control">
      <SectionHeader id="hm-control" kicker="Balance of power" title="Who controls Congress?" live action={<SimBadge />} />
      <div className="hm-control">
        {chambers.map(({ key, title, b }) => (
          <Card key={key} className="hm-chamber">
            <div className="hm-chamber__needle">
              <Needle demProb={b?.controlProb?.D} label={`${title} control`} size={240} />
            </div>
            <div className="hm-chamber__bar">
              <BalanceBar balance={b} title={title} />
              <Link className="link" to={`/map/${key}`} style={{ fontSize: 13 }}>{title} map →</Link>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

function KeyRaceCard({ race, result, i }: { race: Race; result?: RaceResult; i: number }) {
  const reduce = useReducedMotion();
  const { rows, total, lead, margin } = summarize(race, result);
  const called = result?.calledFor ? race.candidates.find((c) => c.id === result.calledFor) : undefined;
  const glow = called ? PARTY_HEX[called.party] : lead ? PARTY_HEX[lead.c.party] : RATING_HEX[race.rating];
  return (
    <motion.li
      className="hm-race"
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(i, 8) * 0.04 }}
    >
      <Link to={`/race/${race.id}`} className="card card--hover hm-race__card" style={{ '--glow': glow } as CSSProperties}>
        <div className="row spread">
          <span className="kicker">{race.chamber} · {race.state}{race.special ? ' · special' : ''}</span>
          {statusChip(result)}
        </div>
        <h3 className="hm-race__title">{race.title}</h3>
        <div className="row" style={{ gap: 6 }}>
          <RatingBadge rating={race.rating} />
          {lead && total > 0 && <MarginChip party={lead.c.party} margin={margin} />}
        </div>
        <ul className="hm-race__cands">
          {(rows.length ? rows.slice(0, 2) : []).map(({ c, pct }) => (
            <li key={c.id} className={`hm-cand ${called && called.id === c.id ? 'is-win' : ''}`}>
              <Avatar name={c.name} party={c.party} src={c.photo} size={30} />
              <span className="hm-cand__name truncate">
                {c.name}
                {c.incumbent && <span className="faint"> (inc.)</span>}
              </span>
              <span className="hm-cand__pct num">{total ? fmtPct(pct) : '—'}</span>
              <span className="hm-cand__bar" aria-hidden="true">
                <span style={{ width: `${pct}%`, background: PARTY_HEX[c.party] }} />
              </span>
            </li>
          ))}
          {!rows.length && <li className="faint" style={{ fontSize: 13 }}>Candidates TBD</li>}
        </ul>
        <ProgressBar value={result?.expectedPct ?? 0} label={`${race.title} expected vote counted`} color="var(--text-2)" height={4} showValue />
      </Link>
    </motion.li>
  );
}

function KeyRaces() {
  const { results } = useLive();
  const keyRaces = useMemo(() => {
    const k = (RACES ?? []).filter((r) => r.key);
    return (k.length ? k : (RACES ?? []).filter((r) => r.rating === 'Toss-up')).slice(0, 16);
  }, []);
  return (
    <section aria-labelledby="hm-key">
      <SectionHeader id="hm-key" kicker="Races to watch" title="Key races" live action={<Button variant="ghost" size="sm" to="/races">All races</Button>} />
      {keyRaces.length ? (
        <ul className="hm-races" aria-label="Key races">
          {keyRaces.map((r, i) => (
            <KeyRaceCard key={r.id} race={r} result={results[r.id]} i={i} />
          ))}
        </ul>
      ) : (
        <ul className="hm-races" aria-busy="true">
          {Array.from({ length: 5 }, (_, i) => (
            <li key={i} className="hm-race">
              <div className="card hm-race__card"><Skeleton width="50%" height={12} /><Skeleton width="80%" height={22} /><Skeleton lines={3} /></div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function LatestCalls() {
  const { calls } = useLive();
  const now = useNow(30000);
  return (
    <Card title="Latest calls" live action={<SimBadge compact />} className="hm-calls">
      {calls.length ? (
        <ol className="hm-calls__list">
          {calls.slice(0, 7).map((c) => {
            const race = raceById.get(c.raceId);
            const cand = race?.candidates.find((x) => x.id === c.candidateId);
            return (
              <li key={c.raceId}>
                <Link to={`/race/${c.raceId}`} className="hm-call" style={{ '--p': PARTY_HEX[c.party] } as CSSProperties}>
                  <PartyDot party={c.party} size={10} />
                  <span className="hm-call__main">
                    <span className="hm-call__race truncate">{race?.title ?? c.raceId}</span>
                    <span className="hm-call__who truncate">{cand?.name ?? PARTY_NAME[c.party]} ({c.party})</span>
                  </span>
                  {c.flip && <Chip size="sm" tone={c.party === 'D' ? 'dem' : c.party === 'R' ? 'rep' : 'ind'}>FLIP</Chip>}
                  <span className="hm-call__t num">{timeAgo(c.at, now)}</span>
                </Link>
              </li>
            );
          })}
        </ol>
      ) : (
        <EmptyState compact title="No calls yet" description="Races are called once enough of the vote is counted. Calls appear here and pop up live." />
      )}
    </Card>
  );
}

function TopNews() {
  const { news } = useLive();
  const now = useNow(60000);
  const clusters = useMemo(() => {
    const map = new Map<string, NewsItem[]>();
    for (const n of news ?? []) {
      const k = n.clusterId ?? n.id;
      map.set(k, [...(map.get(k) ?? []), n]);
    }
    return [...map.values()]
      .sort((a, b) => b.length - a.length || b[0].publishedAt - a[0].publishedAt)
      .slice(0, 6);
  }, [news]);
  const [lead, ...rest] = clusters;
  return (
    <section aria-labelledby="hm-news" className="hm-news">
      <SectionHeader id="hm-news" kicker="The story right now" title="Top news" action={<Button variant="ghost" size="sm" to="/news">All news</Button>} />
      {!lead ? (
        <div className="card pt-card stack">
          <Skeleton height={160} radius={12} />
          <Skeleton width="85%" height={22} />
          <Skeleton lines={3} />
        </div>
      ) : (
        <div className="hm-news__grid">
          <a href={lead[0].url} target="_blank" rel="noreferrer noopener" className="card card--hover hm-lead">
            {lead[0].image ? <img src={lead[0].image} alt="" className="hm-lead__img" loading="lazy" /> : <div className="hm-lead__img hm-lead__img--blank" aria-hidden="true" />}
            <div className="hm-lead__body">
              <div className="row row-wrap" style={{ gap: 8 }}>
                {lead[0].breaking && <Chip size="sm" tone="live">BREAKING</Chip>}
                <span className="kicker kicker--muted">{lead[0].source} · {timeAgo(lead[0].publishedAt, now)}</span>
              </div>
              <h3 className="hm-lead__title">{lead[0].title}</h3>
              {lead[0].summary && <p className="muted clamp-2" style={{ fontSize: 14 }}>{lead[0].summary}</p>}
              <div className="hm-lead__bias">
                <span className="faint" style={{ fontSize: 12 }}>{lead.length} source{lead.length > 1 ? 's' : ''}</span>
                <BiasBar counts={leanCounts(lead)} />
              </div>
            </div>
          </a>
          <ul className="hm-news__list">
            {rest.map((c) => (
              <li key={c[0].id}>
                <a href={c[0].url} target="_blank" rel="noreferrer noopener" className="hm-story">
                  <span className="kicker kicker--muted">{c[0].source} · {timeAgo(c[0].publishedAt, now)}</span>
                  <span className="hm-story__title clamp-2">{c[0].title}</span>
                  <BiasBar counts={leanCounts(c)} labels={false} height={4} />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function MapPreview() {
  const { results } = useLive();
  const navigate = useNavigate();
  const fills = useMemo(() => {
    const f: Record<string, string> = {};
    for (const s of STATES ?? []) {
      const race = (RACES ?? []).find((r) => r.state === s.abbr && r.chamber === 'senate');
      if (!race) {
        if (s.pres2024) f[s.abbr] = marginColor(s.pres2024.dem - s.pres2024.rep) + '';
        continue;
      }
      const res = results[race.id];
      const { lead, margin, total } = summarize(race, res);
      if (res?.calledFor) {
        const w = race.candidates.find((c) => c.id === res.calledFor);
        if (w) f[s.abbr] = PARTY_HEX[w.party];
      } else if (lead && total) f[s.abbr] = marginColor(lead.c.party === 'D' ? margin : lead.c.party === 'R' ? -margin : 0, 15);
      else f[s.abbr] = RATING_HEX[race.rating] + '99';
    }
    return f;
  }, [results]);
  const key = useMemo(() => [...new Set((RACES ?? []).filter((r) => r.key && r.chamber === 'senate').map((r) => r.state))], []);
  return (
    <Card title="Senate map" live action={<Link to="/map/live" className="link" style={{ fontSize: 13 }}>Full map →</Link>} className="hm-map">
      <USMap fills={fills} variant="geo" labels={false} highlight={key} onStateClick={(a) => navigate(`/state/${a}`)} title="Senate results preview map" />
      <div className="hm-map__legend" aria-hidden="true">
        <span><i style={{ background: 'var(--dem)' }} />Dem</span>
        <span><i style={{ background: 'var(--tossup)' }} />Toss-up</span>
        <span><i style={{ background: 'var(--rep)' }} />Rep</span>
        <span><i style={{ background: 'var(--bg-3)' }} />No race</span>
      </div>
    </Card>
  );
}

function PollTile({ s }: { s: PollSeries }) {
  const { polls, avg } = seriesAvg(s);
  const [a, b] = s.keys ?? [];
  if (!a) return null;
  const va = avg(a.key);
  const vb = b ? avg(b.key) : NaN;
  const spread = b ? va - vb : NaN;
  const spark = polls.map((p) => (b ? (p.values?.[a.key] ?? 0) - (p.values?.[b.key] ?? 0) : p.values?.[a.key] ?? 0));
  const leadColor = !b ? a.color : spread >= 0 ? a.color : b.color;
  return (
    <Link to="/polls" className="card card--hover hm-poll">
      <div className="row spread">
        <span className="panel-title truncate">{s.title}</span>
        {b && Number.isFinite(spread) && (
          <span className="chip chip--sm num" style={{ color: leadColor, borderColor: leadColor + '66' }}>
            {(spread >= 0 ? a.label : b.label).slice(0, 12)} +{Math.abs(spread).toFixed(1)}
          </span>
        )}
      </div>
      <div className="hm-poll__vals">
        {[a, b].filter(Boolean).map((k) => (
          <span key={k!.key} className="hm-poll__v">
            <span className="num" style={{ color: k!.color }}>{Number.isFinite(avg(k!.key)) ? avg(k!.key).toFixed(1) : '—'}</span>
            <span className="faint">{k!.label}</span>
          </span>
        ))}
        <Sparkline values={spark.slice(-30)} width={120} height={40} color={leadColor} ariaLabel={`${s.title} trend`} />
      </div>
      <span className="faint" style={{ fontSize: 11.5 }}>Avg. of last {Math.min(6, polls.length)} polls · {polls.length} total</span>
    </Link>
  );
}

function PollsSnapshot() {
  const { markets } = useLive();
  const series = useMemo(() => {
    const all = POLL_SERIES ?? [];
    const pick = [all.find((s) => s.id === 'generic-ballot'), all.find((s) => /approval/i.test(s.id))].filter(Boolean) as PollSeries[];
    return pick.length ? pick : all.slice(0, 2);
  }, []);
  return (
    <section aria-labelledby="hm-polls">
      <SectionHeader id="hm-polls" kicker="Numbers" title="Polls & markets" action={<Button variant="ghost" size="sm" to="/forecast">Forecast</Button>} />
      <div className="hm-polls">
        {series.length ? series.map((s) => <PollTile key={s.id} s={s} />) : [0, 1].map((i) => <div key={i} className="card pt-card"><Skeleton lines={3} height={16} /></div>)}
        {(markets ?? []).slice(0, 2).map((m) => (
          <Link to="/forecast" key={m.id} className="card card--hover hm-poll">
            <span className="panel-title clamp-2">{m.question}</span>
            <div className="stack" style={{ gap: 6 }}>
              {m.outcomes.slice(0, 2).map((o) => (
                <div key={o.label} className="hm-mkt">
                  <span className="truncate" style={{ fontSize: 13 }}>{o.label}</span>
                  <ProgressBar value={o.prob * 100} color={o.color ?? 'var(--signal)'} height={6} label={`${o.label} probability`} />
                  <span className="num" style={{ fontSize: 13, fontWeight: 700 }}>{Math.round(o.prob * 100)}¢</span>
                </div>
              ))}
            </div>
            <span className="faint" style={{ fontSize: 11.5 }}>{m.source}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

const CTAS = [
  { to: '/feed', kicker: 'Swipe', title: 'PolTok feed', body: 'The night in vertical stories. Every side of every story.', cls: 'hm-cta--feed' },
  { to: '/map', kicker: 'Explore', title: 'Live map', body: 'Senate, House & governor races, state by state.', cls: 'hm-cta--map' },
  { to: '/forecast', kicker: 'Predict', title: 'Forecast', body: 'Model odds and prediction markets, in real time.', cls: 'hm-cta--fc' },
  { to: '/live', kicker: 'Watch', title: 'Command center', body: 'Every call, every county, live.', cls: 'hm-cta--live' },
];

function Ctas() {
  return (
    <nav aria-label="Explore PolTok" className="hm-ctas">
      {CTAS.map((c) => (
        <Link key={c.to} to={c.to} className={`card card--hover hm-cta ${c.cls}`}>
          <span className="kicker kicker--accent">{c.kicker}</span>
          <span className="hm-cta__title">{c.title}</span>
          <span className="muted" style={{ fontSize: 13.5 }}>{c.body}</span>
          <span className="hm-cta__arrow" aria-hidden="true">→</span>
        </Link>
      ))}
    </nav>
  );
}

export default function HomePage() {
  return (
    <div className="page hm">
      <Hero />
      <Control />
      <KeyRaces />
      <div className="hm-row">
        <TopNews />
        <div className="hm-side">
          <LatestCalls />
          <MapPreview />
        </div>
      </div>
      <PollsSnapshot />
      <Ctas />
      <p className="hm-foot faint">
        Results, race calls and market prices on PolTok are <b>simulated</b> for demonstration. Headlines are real and link to their publishers.
      </p>
    </div>
  );
}
