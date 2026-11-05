import { useMemo, type CSSProperties } from 'react';
import { useSeo } from '../../lib/seo';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLive } from '../../lib/live';
import { RACES, STATES } from '../../data';
import { PARTY_HEX, fmtInt, fmtPct, marginColor, timeAgo } from '../../lib/format';
import type { BalanceOfPower, Candidate, NewsItem, Party, Race, RaceResult } from '../../types';
import {
  Avatar, BiasBar, Button, Card, Chip, Countdown, EmptyState, LiveDot, SectionHeader, SimBadge, Skeleton,
  fmtTime, leanCounts, useNow, useReducedMotion,
} from '../../components';
import { USMap } from '../map/USMap';
import { useFlipsData, type FlipRace } from '../flips/data';
import './home.css';
import { WatchStrip } from '../watch/WatchStrip';

/* ───────── helpers ───────── */

type Ch = 'senate' | 'house';
const CH_NAME: Record<Ch, string> = { senate: 'Senate', house: 'House' };
/** Party in control going into the 2026 election (119th Congress). */
const PRIOR: Record<Ch, 'D' | 'R'> = { senate: 'R', house: 'R' };
const PLURAL: Record<'D' | 'R', string> = { D: 'Democrats', R: 'Republicans' };
/** Victorian state election — polls close 6pm AEDT Sat 28 Nov 2026 (UTC+11). */
const VIC_CLOSE = Date.parse('2026-11-28T18:00:00+11:00');

/** Only names a winner once the seat count shows a party at/over the majority line. */
function controlOf(b?: BalanceOfPower): 'D' | 'R' | undefined {
  if (!b || !b.total || !b.majority) return undefined;
  if (b.dem + b.ind >= b.majority) return 'D';
  if (b.rep >= b.majority) return 'R';
  return undefined;
}

function candsFor(race: Race, r?: RaceResult): Candidate[] {
  return r?.candidates?.length ? r.candidates : race.candidates ?? [];
}

function summarize(race: Race, result?: RaceResult) {
  const cands = candsFor(race, result);
  const votes = result?.votes ?? {};
  const total = Object.values(votes).reduce((a, b) => a + (b || 0), 0);
  const rows = cands
    .map((c) => ({ c, v: votes[c.id] ?? 0, pct: total ? ((votes[c.id] ?? 0) / total) * 100 : 0 }))
    .sort((a, b) => b.v - a.v);
  const margin = total && rows.length > 1 ? rows[0].pct - rows[1].pct : 0;
  return { rows, total, lead: total ? rows[0] : undefined, margin };
}

/** Net seat change per chamber from real flips (AP "gained" flag). */
function netChange(flips: FlipRace[], office: FlipRace['office']) {
  let d = 0, r = 0;
  for (const f of flips) {
    if (f.office !== office || !f.flipped || !f.winner) continue;
    if (f.winner.party === 'D') d++; else if (f.winner.party === 'R') r++;
    if (f.before === 'D') d--; else if (f.before === 'R') r--;
  }
  return { d, r };
}

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '±0');

function useResultsData() {
  const live = useLive();
  const { data, loading } = useFlipsData(120000);
  const flips = useMemo(() => (data?.races ?? []).filter((r) => r.flipped).sort((a, b) => (b.calledAt ?? 0) - (a.calledAt ?? 0)), [data]);
  return { ...live, flipsAll: data?.races ?? [], flips, flipsLoading: loading };
}

/* ───────── banner ───────── */

function Banner() {
  const { balance, source, lastUpdate } = useLive();
  const s = controlOf(balance.senate);
  const h = controlOf(balance.house);
  let head: string;
  let sub: string;
  const verb = (p: 'D' | 'R', ch: Ch) => (p === PRIOR[ch] ? 'hold' : 'win');
  if (s && h && s === h) {
    head = `${PLURAL[s]} ${s === PRIOR.senate && s === PRIOR.house ? 'hold' : 'win'} Congress`;
    sub = `${PLURAL[s]} have reached a majority in both the Senate and the House.`;
  } else if (s && h) {
    head = `Split decision`;
    sub = `${PLURAL[h]} ${verb(h, 'house')} the House; ${PLURAL[s]} ${verb(s, 'senate')} the Senate.`;
  } else if (s || h) {
    const [p, ch, other] = s ? [s, 'senate' as Ch, 'house' as Ch] : [h!, 'house' as Ch, 'senate' as Ch];
    head = `${PLURAL[p]} ${verb(p, ch)} the ${CH_NAME[ch]}`;
    sub = `Control of the ${CH_NAME[other]} is still undecided — ${balance[other]?.undecided ?? '—'} seats uncalled.`;
  } else {
    head = 'Control still undecided';
    sub = `Neither party has reached a majority in either chamber yet. ${(balance.senate?.undecided ?? 0) + (balance.house?.undecided ?? 0) || '—'} seats remain uncalled.`;
  }
  const tone = s && h && s === h ? s : s && !h ? s : h && !s ? h : undefined;
  return (
    <section className={`hm-banner ${tone ? `is-${tone}` : 'is-open'}`} aria-labelledby="hm-title">
      <div className="hm-banner__top">
        <LiveDot label={source === 'live' ? 'RESULTS · AP' : 'SIMULATED'} />
        <span className="kicker kicker--muted">2026 U.S. Midterms · The morning after</span>
        {lastUpdate > 0 && <span className="kicker kicker--muted">Updated {fmtTime(lastUpdate)}</span>}
        {source !== 'live' && <SimBadge compact />}
      </div>
      <h1 id="hm-title" className="hm-banner__title">{head}</h1>
      <p className="hm-banner__sub">{sub}</p>
      <div className="row row-wrap" style={{ gap: 10 }}>
        <Button variant="accent" size="lg" to="/analysis">Read the analysis →</Button>
        <Button variant="ghost" size="lg" to="/replay">Replay the night</Button>
        <Button variant="ghost" size="lg" to="/live">Results desk</Button>
      </div>
    </section>
  );
}

/* ───────── balance of power ───────── */

function SeatBar({ b }: { b: BalanceOfPower }) {
  const d = b.dem + b.ind, r = b.rep, u = Math.max(0, b.total - d - r);
  const pct = (n: number) => `${(n / b.total) * 100}%`;
  return (
    <div className="hm-seatbar" role="img" aria-label={`${d} Democratic or caucusing, ${r} Republican, ${u} undecided of ${b.total}. ${b.majority} for majority.`}>
      <span className="hm-seatbar__d" style={{ width: pct(d) }} />
      <span className="hm-seatbar__u" style={{ width: pct(u) }} />
      <span className="hm-seatbar__r" style={{ width: pct(r) }} />
      <i className="hm-seatbar__mid" style={{ left: pct(b.majority) }} aria-hidden="true" />
    </div>
  );
}

function Chamber({ ch, b, net }: { ch: Ch; b?: BalanceOfPower; net?: { d: number; r: number } }) {
  const winner = controlOf(b);
  return (
    <Card className={`hm-ch ${winner ? `is-${winner}` : ''}`}>
      <div className="row spread row-wrap" style={{ gap: 8 }}>
        <h3 className="hm-ch__name">{CH_NAME[ch]}</h3>
        {winner ? (
          <Chip size="sm" tone={winner === 'D' ? 'dem' : 'rep'}>{winner === 'D' ? 'DEM' : 'GOP'} {winner === PRIOR[ch] ? 'HOLD' : 'GAIN'} · MAJORITY</Chip>
        ) : (
          <Chip size="sm" tone="tossup">UNDECIDED</Chip>
        )}
      </div>
      {b && b.total ? (
        <>
          <div className="hm-ch__nums num">
            <span className="hm-ch__n is-d"><b>{b.dem + b.ind}</b><small>Dem{b.ind ? ` (incl. ${b.ind} ind.)` : ''}</small></span>
            <span className="hm-ch__n is-u"><b>{b.undecided}</b><small>Uncalled</small></span>
            <span className="hm-ch__n is-r"><b>{b.rep}</b><small>Rep</small></span>
          </div>
          <SeatBar b={b} />
          <div className="row spread row-wrap faint" style={{ fontSize: 12.5, gap: 6 }}>
            <span>{b.majority} needed for majority</span>
            {net && (
              <span className="num">
                Net change: <b style={{ color: 'var(--dem)' }}>D {signed(net.d)}</b> · <b style={{ color: 'var(--rep)' }}>R {signed(net.r)}</b>
              </span>
            )}
          </div>
          {ch === 'senate' && <p className="faint" style={{ fontSize: 11.5 }}>Seat totals include senators not up this year. A 50–50 Senate is decided by the vice president.</p>}
        </>
      ) : (
        <Skeleton lines={3} height={18} />
      )}
      <Link className="link" to={ch === 'house' ? '/house' : '/map/senate'} style={{ fontSize: 13 }}>{CH_NAME[ch]} results →</Link>
    </Card>
  );
}

function Balance({ flipsAll }: { flipsAll: FlipRace[] }) {
  const { balance } = useLive();
  const have = flipsAll.length > 0;
  return (
    <section aria-labelledby="hm-bop">
      <SectionHeader id="hm-bop" kicker="Balance of power" title="Where Congress stands" live sub="Net change is computed from seats AP reports as flipped." />
      <div className="hm-bop">
        <Chamber ch="senate" b={balance.senate} net={have ? netChange(flipsAll, 'senate') : undefined} />
        <Chamber ch="house" b={balance.house} net={have ? netChange(flipsAll, 'house') : undefined} />
      </div>
    </section>
  );
}

/* ───────── night in numbers ───────── */

function Numbers({ flipsAll, flips }: { flipsAll: FlipRace[]; flips: FlipRace[] }) {
  const { results } = useLive();
  const stats = useMemo(() => {
    const rs = Object.values(results);
    let votes = 0;
    for (const r of rs) for (const v of Object.values(r.votes ?? {})) votes += v || 0;
    const called = flipsAll.length ? flipsAll.filter((f) => f.called).length : rs.filter((r) => r.calledFor).length;
    const outIncs = flipsAll.filter((f) => f.called && f.cands.some((c) => c.incumbent && c.id !== f.winner?.id)).length;
    const govFlips = flips.filter((f) => f.office === 'governor').length;
    const close = flipsAll
      .filter((f) => f.called && f.cands.length > 1 && f.cands[1].votes > 0)
      .map((f) => ({ f, m: f.cands[0].pct - f.cands[1].pct }))
      .sort((a, b) => a.m - b.m)[0];
    return { votes, called, outIncs, govFlips, close, total: flipsAll.length };
  }, [results, flipsAll, flips]);
  const items = [
    { k: 'Races called', v: stats.called ? fmtInt(stats.called) : '—', s: stats.total ? `of ${fmtInt(stats.total)} tracked` : 'Senate · House · Gov' },
    { k: 'Seats flipped', v: flipsAll.length ? String(flips.length) : '—', s: 'changed party hands' },
    { k: 'Incumbents defeated', v: flipsAll.length ? String(stats.outIncs) : '—', s: 'lost to a challenger' },
    { k: 'Governorships flipped', v: flipsAll.length ? String(stats.govFlips) : '—', s: '36 on the ballot' },
    { k: 'Votes counted', v: stats.votes ? `${(stats.votes / 1e6).toFixed(1)}M` : '—', s: 'in Senate & key races tracked' },
    { k: 'Closest call', v: stats.close ? fmtPct(stats.close.m, 2) : '—', s: stats.close ? stats.close.f.label : 'margin of a called race' },
  ];
  return (
    <section aria-labelledby="hm-nums" className="hm-nums">
      <h2 id="hm-nums" className="hm-nums__title">The night in numbers</h2>
      <dl className="hm-nums__grid">
        {items.map((i) => (
          <div key={i.k} className="hm-num">
            <dt>{i.k}</dt>
            <dd className="num">{i.v}</dd>
            <dd className="hm-num__s truncate">{i.s}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/* ───────── flips carousel ───────── */

function Flips({ flips, loading }: { flips: FlipRace[]; loading: boolean }) {
  const now = useNow(60000);
  return (
    <section aria-labelledby="hm-flips">
      <SectionHeader id="hm-flips" kicker="Changed hands" title="Top flips" live action={<Button variant="ghost" size="sm" to="/flips">All flips</Button>} />
      {loading ? (
        <div className="hm-flips"><div className="card hm-flip"><Skeleton lines={4} /></div></div>
      ) : flips.length ? (
        <ul className="hm-flips" aria-label="Seats that flipped">
          {flips.slice(0, 16).map((f) => {
            const w = f.winner!;
            return (
              <li key={f.id} className="hm-flipw">
                <Link to="/flips" className={`card card--hover hm-flip is-${w.party}`} style={{ '--p': PARTY_HEX[w.party as Party] ?? PARTY_HEX.O } as CSSProperties}>
                  <div className="row spread">
                    <span className="kicker">{f.office}</span>
                    <span className="hm-flip__arrow num" aria-label={`${f.before ?? '?'} to ${w.party}`}>
                      <i style={{ background: PARTY_HEX[(f.before ?? 'O') as Party] }}>{f.before ?? '?'}</i>→<i style={{ background: PARTY_HEX[w.party as Party] }}>{w.party}</i>
                    </span>
                  </div>
                  <div className="row" style={{ gap: 10 }}>
                    <Avatar name={w.name} party={w.party as Party} src={w.photo} size={48} />
                    <div className="stack" style={{ gap: 2, minWidth: 0 }}>
                      <span className="hm-flip__label truncate">{f.label}</span>
                      <span className="truncate" style={{ fontWeight: 600 }}>{w.name}</span>
                      <span className="faint num" style={{ fontSize: 12 }}>{fmtPct(w.pct)}{f.calledAt ? ` · called ${timeAgo(f.calledAt, now)}` : ''}</span>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState compact title="No flips reported yet" description="Seats that change party hands appear here once AP calls them." />
      )}
    </section>
  );
}

/* ───────── marquee results ───────── */

function ResultCard({ race, result, i }: { race: Race; result?: RaceResult; i: number }) {
  const reduce = useReducedMotion();
  const { rows, total, lead, margin } = summarize(race, result);
  const winner = result?.calledFor ? rows.find((r) => r.c.id === result.calledFor)?.c : undefined;
  const glow = winner ? PARTY_HEX[winner.party] : lead ? PARTY_HEX[lead.c.party] : 'var(--line-2)';
  const flip = winner && winner.party !== race.incumbentParty && race.incumbentParty !== 'I';
  return (
    <motion.li className="hm-race" initial={reduce ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.04 }}>
      <Link to={`/race/${race.id}`} className="card card--hover hm-race__card" style={{ '--glow': glow } as CSSProperties}>
        <div className="row spread">
          <span className="kicker">{race.chamber} · {race.state}{race.special ? ' · special' : ''}</span>
          {winner ? <Chip size="sm" tone={winner.party === 'D' ? 'dem' : winner.party === 'R' ? 'rep' : 'ind'}>{flip ? 'FLIP' : 'WIN'} ✓</Chip>
            : result?.status === 'too-close' ? <Chip size="sm" tone="tossup">Too close</Chip>
            : <Chip size="sm" tone="live">Uncalled</Chip>}
        </div>
        <h3 className="hm-race__title">{race.title}</h3>
        <ul className="hm-race__cands">
          {rows.slice(0, 2).map(({ c, pct }) => (
            <li key={c.id} className={`hm-cand ${winner?.id === c.id ? 'is-win' : ''} ${winner && winner.id !== c.id ? 'is-lose' : ''}`}>
              <Avatar name={c.name} party={c.party} src={c.photo} size={44} />
              <span className="hm-cand__name truncate">{c.name}{c.incumbent && <span className="faint"> (inc.)</span>}</span>
              <span className="hm-cand__pct num">{total ? fmtPct(pct) : '—'}</span>
              <span className="hm-cand__bar" aria-hidden="true"><span style={{ width: `${pct}%`, background: PARTY_HEX[c.party] }} /></span>
            </li>
          ))}
          {!rows.length && <li className="faint" style={{ fontSize: 13 }}>Candidates TBD</li>}
        </ul>
        <div className="row spread faint num" style={{ fontSize: 12 }}>
          <span>{lead && total ? `${lead.c.party}+${margin.toFixed(1)}` : 'No votes yet'}</span>
          <span>{Math.round(result?.expectedPct ?? 0)}% counted</span>
        </div>
      </Link>
    </motion.li>
  );
}

function Marquee() {
  const { results } = useLive();
  const races = useMemo(() => {
    const k = (RACES ?? []).filter((r) => r.key && r.chamber !== 'house');
    return (k.length ? k : (RACES ?? []).filter((r) => r.rating === 'Toss-up')).slice(0, 14);
  }, []);
  return (
    <section aria-labelledby="hm-key">
      <SectionHeader id="hm-key" kicker="Marquee races" title="How the big races ended" live action={<Button variant="ghost" size="sm" to="/races">All races</Button>} />
      <ul className="hm-races" aria-label="Marquee race results">
        {races.map((r, i) => <ResultCard key={r.id} race={r} result={results[r.id]} i={i} />)}
      </ul>
    </section>
  );
}

/* ───────── map ───────── */

function ResultsMap() {
  const { results } = useLive();
  const navigate = useNavigate();
  const fills = useMemo(() => {
    const f: Record<string, string> = {};
    for (const s of STATES ?? []) {
      const race = (RACES ?? []).find((r) => r.state === s.abbr && r.chamber === 'senate');
      if (!race) continue;
      const res = results[race.id];
      const { lead, margin, total, rows } = summarize(race, res);
      const w = res?.calledFor ? rows.find((r) => r.c.id === res.calledFor)?.c : undefined;
      if (w) f[s.abbr] = PARTY_HEX[w.party];
      else if (lead && total) f[s.abbr] = marginColor(lead.c.party === 'D' ? margin : lead.c.party === 'R' ? -margin : 0, 15);
      else f[s.abbr] = 'var(--tossup)';
    }
    return f;
  }, [results]);
  return (
    <Card title="Senate results map" live action={<Link to="/map/live" className="link" style={{ fontSize: 13 }}>Full map →</Link>} className="hm-map">
      <USMap fills={fills} variant="geo" labels={false} onStateClick={(a) => navigate(`/state/${a}`)} title="2026 Senate results by state" />
      <div className="hm-map__legend" aria-hidden="true">
        <span><i style={{ background: 'var(--dem)' }} />Dem win</span>
        <span><i style={{ background: 'var(--rep)' }} />Rep win</span>
        <span><i style={{ background: 'var(--tossup)' }} />Uncalled</span>
        <span><i style={{ background: 'var(--bg-3)' }} />No race</span>
      </div>
    </Card>
  );
}

/* ───────── news ───────── */

function TopNews() {
  const { news } = useLive();
  const now = useNow(60000);
  const clusters = useMemo(() => {
    const map = new Map<string, NewsItem[]>();
    for (const n of news ?? []) {
      const k = n.clusterId ?? n.id;
      map.set(k, [...(map.get(k) ?? []), n]);
    }
    return [...map.values()].sort((a, b) => b[0].publishedAt - a[0].publishedAt).slice(0, 7);
  }, [news]);
  const [lead, ...rest] = clusters;
  return (
    <section aria-labelledby="hm-news" className="hm-news">
      <SectionHeader id="hm-news" kicker="Latest" title="The story this morning" action={<Button variant="ghost" size="sm" to="/news">All news</Button>} />
      {!lead ? (
        <div className="card pt-card stack"><Skeleton height={160} radius={12} /><Skeleton width="85%" height={22} /><Skeleton lines={3} /></div>
      ) : (
        <div className="hm-news__grid">
          <a href={lead[0].url} target="_blank" rel="noreferrer noopener" className="card card--hover hm-lead">
            {lead[0].image ? <img src={lead[0].image} alt="" className="hm-lead__img" loading="lazy" /> : <div className="hm-lead__img hm-lead__img--blank" aria-hidden="true" />}
            <div className="hm-lead__body">
              <span className="kicker kicker--muted">{lead[0].source} · {timeAgo(lead[0].publishedAt, now)}</span>
              <h3 className="hm-lead__title">{lead[0].title}</h3>
              {lead[0].summary && <p className="muted clamp-2" style={{ fontSize: 14 }}>{lead[0].summary}</p>}
              <div className="hm-lead__bias"><BiasBar counts={leanCounts(lead)} /></div>
            </div>
          </a>
          <ul className="hm-news__list">
            {rest.map((c) => (
              <li key={c[0].id}>
                <a href={c[0].url} target="_blank" rel="noreferrer noopener" className="hm-story">
                  <span className="kicker kicker--muted">{c[0].source} · {timeAgo(c[0].publishedAt, now)}</span>
                  <span className="hm-story__title clamp-2">{c[0].title}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/* ───────── Australia + quick links ───────── */

function AUPromo() {
  return (
    <Link to="/au/victoria" className="card card--hover hm-au">
      <span className="kicker kicker--accent">Next up · Australia</span>
      <span className="hm-au__title">Victorian state election</span>
      <span className="muted" style={{ fontSize: 14 }}>Saturday 28 November 2026 · polls close 6pm AEDT</span>
      <div className="hm-au__cd num"><Countdown to={VIC_CLOSE} doneLabel="Counting under way" /></div>
      <span className="link" style={{ fontSize: 13 }}>Seats, pendulum & live count →</span>
    </Link>
  );
}

const LINKS = [
  { to: '/analysis', t: 'Analysis', s: 'What the results mean' },
  { to: '/replay', t: 'Replay', s: 'The night, call by call' },
  { to: '/flips', t: 'Flips', s: 'Every seat that changed hands' },
  { to: '/measures', t: 'Measures', s: 'Ballot questions' },
  { to: '/house', t: 'House', s: 'All 435 districts' },
  { to: '/candidates', t: 'Candidates', s: 'Who won, who lost' },
  { to: '/governors', t: 'Governors', s: '36 statehouse races' },
];

function QuickLinks() {
  return (
    <nav aria-label="Explore the results" className="hm-links">
      {LINKS.map((l) => (
        <Link key={l.to} to={l.to} className="card card--hover hm-link">
          <span className="hm-link__t">{l.t}</span>
          <span className="faint" style={{ fontSize: 12.5 }}>{l.s}</span>
          <span className="hm-link__arrow" aria-hidden="true">→</span>
        </Link>
      ))}
    </nav>
  );
}

function SourceFoot() {
  const { source } = useLive();
  return (
    <p className="hm-foot faint">
      {source === 'live' ? (
        <>Results and race calls are from the Associated Press via The New York Times. Flips and net change use AP's party-gain flag. A party is only shown as winning a chamber once its called seats reach the majority. Headlines are real and link to their publishers.</>
      ) : (
        <>Chamber results on this page are <b>simulated</b> — switch to <b>Live</b> in the top bar for real AP results. Flips are always real AP data. Headlines are real.</>
      )}
    </p>
  );
}

export default function HomePage() {
  useSeo({ description: 'Live US and Australian election results, maps, forecasts and news in one command center.' });
  const { flipsAll, flips, flipsLoading } = useResultsData();
  return (
    <div className="page hm">
      <Banner />
      <Balance flipsAll={flipsAll} />
      <Numbers flipsAll={flipsAll} flips={flips} />
      <WatchStrip />
      <Flips flips={flips} loading={flipsLoading} />
      <Marquee />
      <div className="hm-row">
        <TopNews />
        <div className="hm-side">
          <ResultsMap />
          <AUPromo />
        </div>
      </div>
      <QuickLinks />
      <SourceFoot />
    </div>
  );
}

