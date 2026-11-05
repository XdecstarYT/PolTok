import { tzAbbr } from '../../components/time';
/**
 * /live — Election-night control room. Owned by the Live agent (src/features/live/**).
 * Results come from useLive(): live AP data (via NYT) or the simulation, per the user toggle.
 */
import { useSeo } from '../../lib/seo';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { LiveDot, SimBadge } from '../../components';
import { useLive } from '../../lib/live';
import { raceById } from '../../data';
import { PARTY_HEX } from '../../lib/format';
import type { RaceCallEvent } from '../../types';
import { buildViews, fmtEtTimeSec, summarizeChamber, type ChamberSummary } from './model';
import { CallFeed, ChamberControl, LiveMap, Markets, PollTimeline, Swings } from './panels';
import { RaceGrid } from './RaceGrid';
import { AnimNum, prefersReducedMotion, useNow } from './widgets';
import './live.css';

export default function LivePage() {
  useSeo({ title: 'Live results', description: 'Real-time election night results, race calls and balance of power.' });
  const live = useLive();
  const now = useNow(1000);
  const views = useMemo(() => buildViews(live.results), [live.results]);
  const senate = useMemo(() => summarizeChamber('senate', live.balance.senate, views.filter((v) => v.race.chamber === 'senate')), [live.balance.senate, views]);
  const house = useMemo(() => summarizeChamber('house', live.balance.house, views.filter((v) => v.race.chamber === 'house')), [live.balance.house, views]);

  const heroRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const el = heroRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const statusCounts = useMemo(() => {
    let counting = 0, called = 0, total = 0;
    for (const v of views) {
      if (v.race.chamber === 'house') continue;
      total++;
      if (v.winner) called++;
      else if (v.status === 'counting' || v.status === 'too-close') counting++;
    }
    return { counting, called, total };
  }, [views]);

  // Sim clock: prefer an explicit clock from the provider (if the lead exposes one), else infer
  // from the latest poll-closing wave that has started reporting.
  const simMin = useMemo(() => {
    const clk = (live as { clock?: { simMinute?: number; live?: boolean } }).clock;
    if (clk?.live) return undefined; // real wall clock
    if (clk && typeof clk.simMinute === 'number') return 18 * 60 + clk.simMinute;
    if (live.mode === 'live' || live.mode === 'connecting') return undefined;
    let m = 0;
    for (const v of views) if (v.status !== 'not-started' && v.closeMin > m) m = v.closeMin;
    return m || undefined;
  }, [live, views]);

  const modeLabel =
    live.mode === 'connecting' ? 'Connecting…' : live.mode === 'browser-simulation' ? 'In-browser simulation' : live.mode === 'simulation' ? 'Server simulation' : live.mode === 'browser-live' ? 'AP via NYT (direct)' : 'AP via NYT';

  return (
    <div className="page lv-page">
      <StickyScore senate={senate} house={house} show={stuck} lastCall={live.calls[0]} />
      <CallAlert calls={live.calls} />

      <header className="lv-top">
        <div className="lv-top-l">
          <div className="lv-kicker mono">
            <LiveDot /> <span>MIDTERMS · NOV 3, 2026</span> <SimBadge />
          </div>
          <h1>Election Night Control Room</h1>
        </div>
        <dl className="lv-top-stats mono">
          <div>
            <dt>{tzAbbr()}</dt>
            <dd>{fmtEtTimeSec(now)}</dd>
          </div>
          <div>
            <dt>Called</dt>
            <dd>
              <AnimNum value={statusCounts.called} />/{statusCounts.total}
            </dd>
          </div>
          <div>
            <dt>Counting</dt>
            <dd>
              <AnimNum value={statusCounts.counting} flash={false} />
            </dd>
          </div>
          <div>
            <dt>Feed</dt>
            <dd className={live.connected ? 'ok' : 'muted'}>{modeLabel}</dd>
          </div>
        </dl>
      </header>

      <div ref={heroRef} className="lv-hero">
        <ChamberControl s={senate} title="Senate" />
        <ChamberControl s={house} title="House" />
        <CallFeed calls={live.calls} now={now} />
      </div>

      <PollTimeline views={views} now={now} simMin={simMin} />

      <div className="lv-row-map">
        <LiveMap views={views} calls={live.calls} now={now} />
        <div className="lv-side">
          <Swings views={views} />
          <Markets markets={live.markets} />
        </div>
      </div>

      <RaceGrid views={views} now={now} />

      <p className="lv-foot muted">
        {live.source === 'live' ? (
          <>Results and race calls are <b>live</b>: AP vote counts and race calls, with win probabilities from The New York Times model, via the NYT results feed. Market prices are the last real quotes before Election Day.</>
        ) : (
          <>Results, race calls, probabilities and market prices on this page are <b>simulated</b> for demonstration (switch to <b>Live</b> in the top bar for real results); candidates and 2024 baselines come from PolTok research data.</>
        )} Senate majority shown as 51; a 50–50 split is decided by the Vice President's tiebreak.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------

function StickyScore({ senate, house, show, lastCall }: { senate: ChamberSummary; house: ChamberSummary; show: boolean; lastCall?: RaceCallEvent }) {
  const race = lastCall ? raceById.get(lastCall.raceId) : undefined;
  return (
    <div className={`lv-sticky ${show ? 'is-on' : ''}`} aria-hidden={!show}>
      <div className="lv-sticky-in">
        <MiniChamber s={senate} label="Senate" />
        <MiniChamber s={house} label="House" />
        {lastCall && race && (
          <Link to={`/race/${race.id}`} className="lv-sticky-call mono" tabIndex={show ? 0 : -1}>
            <span className="muted">LAST CALL</span> <b style={{ color: PARTY_HEX[lastCall.party] }}>{race.state} {race.chamber === 'senate' ? 'SEN' : race.chamber === 'governor' ? 'GOV' : race.id.split('-')[1]}</b> → {lastCall.party}
            {lastCall.flip && <span className="lv-gain">GAIN</span>}
          </Link>
        )}
        <SimBadge />
      </div>
    </div>
  );
}

function MiniChamber({ s, label }: { s: ChamberSummary; label: string }) {
  const pc = (n: number) => `${(n / Math.max(1, s.total)) * 100}%`;
  return (
    <div className="lv-mini">
      <span className="lv-mini-l">{label}</span>
      <b className="mono" style={{ color: PARTY_HEX.D }}>
        <AnimNum value={s.dSeats} />
      </b>
      <span className="lv-mini-bar" aria-hidden>
        <i className="d" style={{ width: pc(s.dSeats) }} />
        <i className="r" style={{ width: pc(s.rSeats) }} />
        <em style={{ left: pc(s.majority) }} />
      </span>
      <b className="mono" style={{ color: PARTY_HEX.R }}>
        <AnimNum value={s.rSeats} />
      </b>
      <span className="lv-mini-p mono muted">{s.ready ? `${Math.round(Math.max(s.probD, 1 - s.probD) * 100)}% ${s.probD >= 0.5 ? 'D' : 'R'}` : ''}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slide-in "Key race alert" banner on new calls (skips the initial backlog).

function CallAlert({ calls }: { calls: RaceCallEvent[] }) {
  const seen = useRef<string | null | undefined>(undefined);
  const [cur, setCur] = useState<RaceCallEvent | null>(null);
  useEffect(() => {
    const top = calls[0];
    const id = top ? top.raceId + top.at : null;
    if (seen.current === undefined) {
      // first render: don't alert on backlog
      seen.current = id;
      return;
    }
    if (id && id !== seen.current) {
      seen.current = id;
      const race = raceById.get(top.raceId);
      if (race?.key || top.flip || race?.chamber !== 'house') {
        setCur(top);
        const t = setTimeout(() => setCur(null), prefersReducedMotion() ? 6000 : 4200);
        return () => clearTimeout(t);
      }
    }
  }, [calls]);
  const race = cur ? raceById.get(cur.raceId) : undefined;
  const cand = race?.candidates.find((c) => c.id === cur?.candidateId);
  return (
    <div className="lv-alert-wrap" aria-live="assertive">
      <AnimatePresence>
        {cur && race && (
          <motion.div
            key={cur.raceId + cur.at}
            className="lv-alert-card"
            style={{ ['--pc' as string]: PARTY_HEX[cur.party] }}
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          >
            <span className="lv-alert-k mono">{cur.flip ? `${cur.party === 'I' ? 'D' : cur.party} GAIN · ` : ''}KEY RACE ALERT</span>
            <Link to={`/race/${race.id}`} className="lv-alert-t" onClick={() => setCur(null)}>
              <b>{cand?.name ?? cur.party}</b> projected to win {race.title}
            </Link>
            <span className="lv-alert-s mono">
              CALL: POLTOK SIM <SimBadge />
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
