import { fmtHHMM, tzAbbr } from '../../components/time';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { m as motion } from 'framer-motion';
import type { Party, RaceResult } from '../../types';
import type { LiveState } from '../../lib/live';
import { LEAN_HEX, PARTY_HEX, PARTY_NAME, fmtInt, mixHex, timeAgo } from '../../lib/format';
import { raceById, stateByAbbr, racesByState } from '../../data';
import { Avatar, SimBadge, Sparkline } from '../../components';
import { BlindspotBadge, CoverageBar, LeanDot } from '../news/BiasBar';
import { cleanText, firstSentence, hash, kickerOf, readTime, safeUrl, SIDE_HEX, SIDE_LABEL, SIDE_OF, type Cluster } from '../news/newsUtils';
import { idOf, kindOf, leadMargin, lookupCall, lookupMarket, lookupPoll } from './feedModel';

export interface CardMeta {
  title: string;
  kicker: string;
  href?: string; // external article
  to?: string; // internal route
  image?: string;
  tint: [string, string];
  simulated: boolean;
}

const TOPIC_TINT: [string, string] = ['#5a3dff', '#ff3d8b'];

export function cardMeta(key: string, live: LiveState, clusters: Map<string, Cluster>): CardMeta | null {
  const kind = kindOf(key);
  const id = idOf(key);
  if (kind === 'story') {
    const c = clusters.get(id);
    if (!c) return null;
    const { L, R } = c.coverage;
    const tint: [string, string] = L > R ? ['#2453ff', '#7a5cff'] : R > L ? ['#ff2e4d', '#ff8a3d'] : TOPIC_TINT;
    return { title: cleanText(c.lead.title), kicker: c.breaking ? 'Breaking' : kickerOf(c.tags) ?? 'News', href: safeUrl(c.lead.url), image: c.image, tint, simulated: false };
  }
  if (kind === 'call' || kind === 'close') {
    const race = raceById.get(id);
    if (!race) return null;
    const call = lookupCall(live.calls, id);
    const party: Party = call?.party ?? 'O';
    const tint: [string, string] = kind === 'call' ? [PARTY_HEX[party], mixHex(PARTY_HEX[party], '#000000', 0.6)] : ['#f5c518', '#ff8a3d'];
    return { title: kind === 'call' ? `Projected: ${race.title}` : `Too close: ${race.title}`, kicker: kind === 'call' ? 'Race call' : 'Too close to call', to: `/race/${id}`, tint, simulated: true };
  }
  if (kind === 'market') {
    const m = lookupMarket(live.markets, id);
    if (!m) return null;
    return { title: m.question, kicker: 'Markets', to: '/forecast', tint: ['#00c2a8', '#3d7bff'], simulated: true };
  }
  if (kind === 'poll') {
    const p = lookupPoll(id);
    if (!p) return null;
    return { title: p.title, kicker: 'Polls', to: '/polls', tint: ['#f5c518', '#a96bff'], simulated: false };
  }
  const s = stateByAbbr.get(id);
  if (!s) return null;
  return { title: `${s.name} in 2024`, kicker: 'Did you know', to: `/state/${id}`, tint: s.pres2024.winner === 'D' ? ['#3d7bff', '#00c2ff'] : ['#ff3d55', '#ff9f3d'], simulated: false };
}

/* ---------------- shared bits ---------------- */

export function Kinetic({ text, active, reduced, className }: { text: string; active: boolean; reduced: boolean; className?: string }) {
  const words = text.split(/\s+/).filter(Boolean);
  const size = text.length > 110 ? 'xl' : text.length > 75 ? 'lg' : text.length > 45 ? 'md' : 'sm';
  if (reduced) return <h2 className={`fd-headline fd-h-${size} ${className ?? ''}`}>{text}</h2>;
  return (
    <h2 className={`fd-headline fd-h-${size} ${className ?? ''}`} aria-label={text}>
      {words.map((w, i) => (
        <motion.span
          key={i + w}
          aria-hidden="true"
          className="fd-word"
          initial={false}
          animate={active ? { opacity: 1, y: 0, filter: 'blur(0px)' } : { opacity: 0, y: 18, filter: 'blur(6px)' }}
          transition={{ delay: active ? 0.08 + i * 0.035 : 0, type: 'spring', stiffness: 320, damping: 28 }}
        >
          {w}{' '}
        </motion.span>
      ))}
    </h2>
  );
}

function Rise({ active, reduced, delay = 0, children, className }: { active: boolean; reduced: boolean; delay?: number; children: ReactNode; className?: string }) {
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={false}
      animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
      transition={{ delay: active ? delay : 0, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function Backdrop({ meta, seed, reduced, watermark }: { meta: CardMeta; seed: string; reduced: boolean; watermark?: string }) {
  const [broken, setBroken] = useState(false);
  const h = hash(seed);
  const a = 15 + (h % 55);
  const b = 10 + ((h >> 7) % 40);
  return (
    <div className="fd-bg" aria-hidden="true">
      {meta.image && !broken ? (
        <img className={`fd-bg-img ${reduced ? '' : 'kb'}`} src={meta.image} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
      ) : (
        <div
          className="fd-art"
          style={{
            backgroundImage: `radial-gradient(70% 55% at ${a}% ${b}%, ${meta.tint[0]}cc, transparent 70%), radial-gradient(60% 50% at ${100 - a}% ${60 + (h % 30)}%, ${meta.tint[1]}aa, transparent 70%), linear-gradient(${h % 360}deg, #0b0d18, #05060a)`,
          }}
        >
          {watermark && <span className="fd-watermark">{watermark}</span>}
        </div>
      )}
      <div className="fd-grain" />
      <div className="fd-scrim" />
    </div>
  );
}

/* ---------------- story ---------------- */

export function StoryCard({ cluster, meta, active, reduced, now }: { cluster: Cluster; meta: CardMeta; active: boolean; reduced: boolean; now: number }) {
  const lead = cluster.lead;
  const gist = firstSentence(lead, 200);
  const [broken, setBroken] = useState(false);
  const leadSide = SIDE_OF[lead.sourceLean] ?? 'U';
  const others = cluster.items.filter((i) => i.source !== lead.source && (SIDE_OF[i.sourceLean] ?? 'U') !== leadSide && SIDE_OF[i.sourceLean] !== 'U');
  const seenSide = new Set<string>();
  const alt = others.filter((i) => {
    const s = SIDE_OF[i.sourceLean];
    if (seenSide.has(s)) return false;
    seenSide.add(s);
    return true;
  }).slice(0, 2);
  const kick = kickerOf(cluster.tags);
  return (
    <>
      <Backdrop meta={meta} seed={cluster.id} reduced={reduced} watermark={kick?.split(' · ')[0] ?? lead.source} />
      <div className="fd-body">
        {meta.image && !broken && (
          <Rise active={active} reduced={reduced} className="fd-photo">
            <img src={meta.image} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
          </Rise>
        )}
        <Rise active={active} reduced={reduced} className="fd-kickers">
          {cluster.breaking && <span className="fd-chip breaking">● Breaking</span>}
          {kick && <span className="fd-chip">{kick}</span>}
          <span className="fd-chip ghost mono">{readTime(lead)}s read</span>
        </Rise>
        <Kinetic text={cleanText(lead.title)} active={active} reduced={reduced} />
        <Rise active={active} reduced={reduced} delay={0.25} className="fd-source">
          <span className="fd-lean" style={{ borderColor: LEAN_HEX[lead.sourceLean] }}>
            <LeanDot hex={LEAN_HEX[lead.sourceLean] ?? LEAN_HEX.Unrated} />
            <b>{lead.source}</b>
            <span>{lead.sourceLean}</span>
          </span>
          <span className="mono">{timeAgo(lead.publishedAt, now)}</span>
        </Rise>
        {gist && (
          <Rise active={active} reduced={reduced} delay={0.32} className="fd-why">
            <span className="fd-why-label mono">WHY IT MATTERS</span>
            <p>{gist}</p>
            <span className="fd-why-src">First line of {lead.source}’s summary</span>
          </Rise>
        )}
        <Rise active={active} reduced={reduced} delay={0.4} className="fd-cov">
          <div className="fd-cov-h mono">
            <span>
              {cluster.sources.length} OUTLET{cluster.sources.length === 1 ? '' : 'S'} COVERING
            </span>
            {cluster.blindspot && <BlindspotBadge side={cluster.blindspot} />}
          </div>
          <CoverageBar coverage={cluster.coverage} height={14} />
          {alt.length > 0 && (
            <ul className="fd-alt">
              {alt.map((i) => (
                <li key={i.id}>
                  <span className="fd-alt-side" style={{ color: SIDE_HEX[SIDE_OF[i.sourceLean]] }}>
                    {SIDE_LABEL[SIDE_OF[i.sourceLean]]}
                  </span>
                  <a href={safeUrl(i.url)} target="_blank" rel="noopener noreferrer">
                    {cleanText(i.title)}
                  </a>
                  <span className="fd-alt-src">{i.source}</span>
                </li>
              ))}
            </ul>
          )}
        </Rise>
        {meta.href && (
          <Rise active={active} reduced={reduced} delay={0.48}>
            <a className="fd-cta" href={meta.href} target="_blank" rel="noopener noreferrer">
              Read at {lead.source} <span aria-hidden="true">↗</span>
            </a>
          </Rise>
        )}
      </div>
    </>
  );
}

/* ---------------- race call ---------------- */

function sharesOf(r?: RaceResult) {
  if (!r) return new Map<string, number>();
  const tot = Object.values(r.votes).reduce((a, b) => a + b, 0) || 1;
  return new Map(Object.entries(r.votes).map(([k, v]) => [k, (v / tot) * 100]));
}

export function CallCard({ raceId, live, meta, active, reduced, now }: { raceId: string; live: LiveState; meta: CardMeta; active: boolean; reduced: boolean; now: number }) {
  const race = raceById.get(raceId)!;
  const call = lookupCall(live.calls, raceId);
  const result = live.results[raceId];
  const winnerId = call?.candidateId ?? result?.calledFor;
  const winner = race.candidates.find((c) => c.id === winnerId);
  const party: Party = winner?.party ?? call?.party ?? 'O';
  const shares = sharesOf(result);
  const color = PARTY_HEX[party];
  return (
    <>
      <div className="fd-bg" aria-hidden="true">
        <div className="fd-flood" style={{ background: `radial-gradient(90% 60% at 50% 30%, ${color}, ${mixHex(color, '#000000', 0.55)} 55%, #05060a)` }} />
        <div className="fd-rays" style={{ ['--c' as string]: color }} />
        <div className="fd-grain" />
      </div>
      <div className="fd-body center">
        <Rise active={active} reduced={reduced} className="fd-kickers center">
          <span className="fd-chip solid">Race call</span>
          <SimBadge />
        </Rise>
        <motion.div
          className="fd-stamp"
          initial={false}
          animate={active && !reduced ? { scale: [2, 0.94, 1], opacity: [0, 1, 1], rotate: -4 } : { scale: 1, opacity: 1, rotate: -4 }}
          transition={{ duration: 0.6, ease: [0.7, 0, 0.2, 1] }}
        >
          PROJECTED WINNER
        </motion.div>
        <Rise active={active} reduced={reduced} delay={0.2} className="fd-winner">
          <div className="fd-avatar-ring" style={{ boxShadow: `0 0 0 4px ${color}55, 0 0 60px ${color}` }}>
            <Avatar name={winner?.name ?? 'TBD'} party={party} src={winner?.photo} size={128} />
          </div>
          <h2 className="fd-winner-name">{winner?.name ?? 'TBD'}</h2>
          <div className="fd-winner-sub">
            {PARTY_NAME[party]} · {race.title}
          </div>
        </Rise>
        <Rise active={active} reduced={reduced} delay={0.32} className="fd-callstats">
          {call?.flip && (
            <span className="fd-flip">
              FLIP · {race.incumbentParty} → {party}
            </span>
          )}
          {winnerId && shares.has(winnerId) && (
            <span className="mono">{shares.get(winnerId)!.toFixed(1)}% of vote</span>
          )}
          {result && <span className="mono">{Math.round(result.expectedPct)}% expected in</span>}
          {call && <span className="mono">called {timeAgo(call.at, now)}</span>}
        </Rise>
        <Rise active={active} reduced={reduced} delay={0.4}>
          <Link className="fd-cta light" to={`/race/${raceId}`}>
            Open race <span aria-hidden="true">→</span>
          </Link>
        </Rise>
      </div>
    </>
  );
}

/* ---------------- too close ---------------- */

export function CloseCard({ raceId, live, meta, active, reduced }: { raceId: string; live: LiveState; meta: CardMeta; active: boolean; reduced: boolean }) {
  const race = raceById.get(raceId)!;
  const r = live.results[raceId];
  const shares = sharesOf(r);
  const cands = [...race.candidates].sort((a, b) => (r?.votes[b.id] ?? 0) - (r?.votes[a.id] ?? 0)).slice(0, 3);
  const called = !!r?.calledFor;
  const margin = r ? leadMargin(r) : 0;
  return (
    <>
      <Backdrop meta={meta} seed={raceId} reduced={reduced} watermark={race.state} />
      <div className="fd-body">
        <Rise active={active} reduced={reduced} className="fd-kickers">
          <span className={`fd-chip ${called ? 'solid' : 'amber'}`}>{called ? 'Now called' : '◐ Too close to call'}</span>
          <SimBadge />
        </Rise>
        <Kinetic text={race.title} active={active} reduced={reduced} />
        <Rise active={active} reduced={reduced} delay={0.2} className="fd-margin mono">
          Margin {margin.toFixed(1)} pts
        </Rise>
        <Rise active={active} reduced={reduced} delay={0.28} className="fd-cands">
          {cands.map((c) => {
            const pct = shares.get(c.id) ?? 0;
            const win = r?.winProb?.[c.id];
            return (
              <div key={c.id} className="fd-cand">
                <Avatar name={c.name} party={c.party} src={c.photo} size={44} />
                <div className="fd-cand-main">
                  <div className="fd-cand-row">
                    <b>
                      {c.name} <span className="fd-party">({c.party})</span>
                    </b>
                    <span className="mono fd-cand-pct">{pct.toFixed(1)}%</span>
                  </div>
                  <div className="fd-vbar">
                    <motion.span
                      style={{ background: PARTY_HEX[c.party] }}
                      initial={false}
                      animate={{ width: `${active || reduced ? pct : 0}%` }}
                      transition={{ duration: reduced ? 0 : 0.9, ease: [0.16, 1, 0.3, 1], delay: reduced ? 0 : 0.3 }}
                    />
                  </div>
                  <div className="fd-cand-sub mono">
                    {fmtInt(r?.votes[c.id] ?? 0)} votes{win !== undefined ? ` · ${Math.round(win * 100)}% win chance` : ''}
                  </div>
                </div>
              </div>
            );
          })}
        </Rise>
        <Rise active={active} reduced={reduced} delay={0.36} className="fd-expected">
          <div className="fd-cov-h mono">
            <span>EXPECTED VOTE COUNTED</span>
            <b>{Math.round(r?.expectedPct ?? 0)}%</b>
          </div>
          <div className="fd-meter">
            <span style={{ width: `${r?.expectedPct ?? 0}%` }} />
          </div>
          {r?.reportingNote && <p className="fd-note">{r.reportingNote}</p>}
        </Rise>
        <Rise active={active} reduced={reduced} delay={0.44}>
          <Link className="fd-cta" to={`/race/${raceId}`}>
            Follow this race <span aria-hidden="true">→</span>
          </Link>
        </Rise>
      </div>
    </>
  );
}

/* ---------------- market ---------------- */

export function MarketCard({ id, live, meta, active, reduced }: { id: string; live: LiveState; meta: CardMeta; active: boolean; reduced: boolean }) {
  const m = lookupMarket(live.markets, id)!;
  const hist = (m.history ?? []).map((h) => h.p * 100);
  const first = hist[0];
  const last = hist[hist.length - 1];
  const delta = first !== undefined && last !== undefined ? last - first : 0;
  return (
    <>
      <Backdrop meta={meta} seed={id} reduced={reduced} watermark="ODDS" />
      <div className="fd-body">
        <Rise active={active} reduced={reduced} className="fd-kickers">
          <span className="fd-chip">Prediction market</span>
          <SimBadge />
        </Rise>
        <Kinetic text={m.question} active={active} reduced={reduced} />
        <Rise active={active} reduced={reduced} delay={0.2} className="fd-odds">
          {m.outcomes.slice(0, 3).map((o, i) => (
            <div key={o.label} className="fd-odd">
              <div className="fd-odd-num mono" style={{ color: o.color ?? (i ? PARTY_HEX.R : PARTY_HEX.D) }}>
                {o.prob > 0.99 ? '>99' : o.prob < 0.01 ? '<1' : Math.round(o.prob * 100)}
                <small>%</small>
              </div>
              <div className="fd-odd-label">{o.label}</div>
              <div className="fd-vbar thin">
                <span style={{ width: `${o.prob * 100}%`, background: o.color ?? (i ? PARTY_HEX.R : PARTY_HEX.D) }} />
              </div>
            </div>
          ))}
        </Rise>
        {hist.length > 1 && (
          <Rise active={active} reduced={reduced} delay={0.3} className="fd-spark">
            <div className="fd-cov-h mono">
              <span>{m.outcomes[0]?.label.toUpperCase()} · TREND</span>
              <b style={{ color: delta >= 0 ? 'var(--accent)' : 'var(--rep)' }}>
                {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)} pts
              </b>
            </div>
            <Sparkline values={hist.slice(-80)} width={320} height={64} color={m.outcomes[0]?.color ?? PARTY_HEX.D} ariaLabel={`Trend for ${m.outcomes[0]?.label}`} className="fd-sparkline" />
          </Rise>
        )}
        <Rise active={active} reduced={reduced} delay={0.36} className="fd-foot-note">
          Source: {m.source}
        </Rise>
      </div>
    </>
  );
}

/* ---------------- poll ---------------- */

export function PollCard({ id, meta, active, reduced }: { id: string; meta: CardMeta; active: boolean; reduced: boolean }) {
  const s = lookupPoll(id)!;
  const polls = [...s.polls].sort((a, b) => a.date.localeCompare(b.date));
  const latest = polls[polls.length - 1];
  const recent = polls.slice(-5);
  const avg = (k: string) => recent.reduce((a, p) => a + (p.values[k] ?? 0), 0) / (recent.length || 1);
  const [k0, k1] = s.keys;
  const spread = k0 && k1 ? avg(k0.key) - avg(k1.key) : 0;
  const leader = spread >= 0 ? k0 : k1;
  const trend = k0 && k1 ? polls.map((p) => (p.values[k0.key] ?? 0) - (p.values[k1.key] ?? 0)) : [];
  return (
    <>
      <Backdrop meta={meta} seed={id} reduced={reduced} watermark="POLLS" />
      <div className="fd-body">
        <Rise active={active} reduced={reduced} className="fd-kickers">
          <span className="fd-chip">Polling</span>
          <span className="fd-chip ghost mono">{recent.length}-poll avg</span>
        </Rise>
        <Kinetic text={s.title} active={active} reduced={reduced} />
        <Rise active={active} reduced={reduced} delay={0.2} className="fd-odds">
          {s.keys.slice(0, 3).map((k) => (
            <div key={k.key} className="fd-odd">
              <div className="fd-odd-num mono" style={{ color: k.color }}>
                {avg(k.key).toFixed(1)}
                <small>%</small>
              </div>
              <div className="fd-odd-label">{k.label}</div>
            </div>
          ))}
        </Rise>
        {leader && (
          <Rise active={active} reduced={reduced} delay={0.26} className="fd-spread">
            <span className="fd-spread-chip mono" style={{ background: leader.color }}>
              {leader.label} +{Math.abs(spread).toFixed(1)}
            </span>
            <span className="fd-note">average of the last {recent.length} polls</span>
          </Rise>
        )}
        {trend.length > 1 && (
          <Rise active={active} reduced={reduced} delay={0.32} className="fd-spark">
            <Sparkline values={trend.slice(-40)} width={320} height={56} color={leader?.color} ariaLabel="Spread trend" className="fd-sparkline" />
          </Rise>
        )}
        {latest && (
          <Rise active={active} reduced={reduced} delay={0.38} className="fd-foot-note">
            Latest: {latest.pollster} · {latest.date}
            {latest.sample ? ` · n=${fmtInt(latest.sample)}${latest.population ? ' ' + latest.population : ''}` : ''}
            {' · '}
            {s.keys.map((k) => `${k.label} ${latest.values[k.key] ?? '–'}`).join(' / ')}
          </Rise>
        )}
        <Rise active={active} reduced={reduced} delay={0.44}>
          <Link className="fd-cta" to="/polls">
            All polls <span aria-hidden="true">→</span>
          </Link>
        </Rise>
      </div>
    </>
  );
}

/* ---------------- did you know ---------------- */

export function FactCard({ abbr, meta, active, reduced }: { abbr: string; meta: CardMeta; active: boolean; reduced: boolean }) {
  const s = stateByAbbr.get(abbr)!;
  const { dem, rep, winner } = s.pres2024;
  const margin = Math.abs(dem - rep);
  const w: Party = winner;
  const races = racesByState(abbr);
  const tot = dem + rep || 1;
  return (
    <>
      <Backdrop meta={meta} seed={abbr} reduced={reduced} watermark={abbr} />
      <div className="fd-body">
        <Rise active={active} reduced={reduced} className="fd-kickers">
          <span className="fd-chip solid">💡 Did you know?</span>
        </Rise>
        <Kinetic text={`${s.name} was decided by ${margin.toFixed(1)} points in 2024.`} active={active} reduced={reduced} />
        <Rise active={active} reduced={reduced} delay={0.22} className="fd-fact">
          <div className="fd-fact-big mono" style={{ color: PARTY_HEX[w] }}>
            {w}+{margin.toFixed(1)}
          </div>
          <p>
            {s.name} backed the {w === 'D' ? 'Democratic' : 'Republican'} presidential ticket. It carries {s.ev} electoral votes and{' '}
            {s.houseSeats} House seat{s.houseSeats === 1 ? '' : 's'}.
          </p>
          <div className="fd-split">
            <span style={{ width: `${(dem / tot) * 100}%`, background: PARTY_HEX.D }}>D {dem.toFixed(1)}%</span>
            <span style={{ width: `${(rep / tot) * 100}%`, background: PARTY_HEX.R }}>R {rep.toFixed(1)}%</span>
          </div>
        </Rise>
        <Rise active={active} reduced={reduced} delay={0.32} className="fd-foot-note">
          2024 presidential result · {races.length ? `${races.length} race${races.length === 1 ? '' : 's'} on tonight’s ballot here` : 'final polls close ' + fmtHHMM(s.pollClose) + ' ' + tzAbbr()}
        </Rise>
        <Rise active={active} reduced={reduced} delay={0.4}>
          <Link className="fd-cta" to={`/state/${abbr}`}>
            Explore {s.name} <span aria-hidden="true">→</span>
          </Link>
        </Rise>
      </div>
    </>
  );
}
