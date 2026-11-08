/**
 * /map and /map/:mode — full-bleed interactive electoral map.
 * Modes: pres2024 | senate | governor | house | live | build
 */
import { useSeo } from '../../lib/seo';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, m as motion, useReducedMotion } from 'framer-motion';
import type { Chamber, Race, Rating } from '../../types';
import { racesByState } from '../../data';
import { useLive } from '../../lib/live';
import { fmtPct, marginColor, PARTY_HEX, PARTY_NAME, RATING_HEX, RATINGS } from '../../lib/format';
import { PartyDot, RatingBadge, SimBadge } from '../../components';
import { USMap } from './USMap';
import { ElectoralBar, type BarSegment } from './ElectoralBar';
import { ALL_ABBRS, pres2024, stateEV, stateName } from './stateTable';
import {
  AWAITING,
  byState,
  HOUSE_SEATS,
  houseFills,
  houseSplit,
  isMode,
  leaderColor,
  leaderOf,
  liveFills,
  MODES,
  NO_RACE,
  presEV,
  presFills,
  racesOf,
  ratingCounts,
  ratingFills,
  RATING_SCORE,
  senateNow,
  type Leader,
  type MapMode,
} from './modes';
import './map-page.css';

// ---------------- build-your-own ----------------
type BuildRating = 'Solid D' | 'Lean D' | 'Toss-up' | 'Lean R' | 'Solid R';
const BUILD_CYCLE: BuildRating[] = ['Solid D', 'Lean D', 'Toss-up', 'Lean R', 'Solid R'];
const BUILD_LABEL: Record<BuildRating, string> = { 'Solid D': 'Safe D', 'Lean D': 'Lean D', 'Toss-up': 'Toss-up', 'Lean R': 'Lean R', 'Solid R': 'Safe R' };
const BUILD_KEY = 'poltok.map.build.v1';

function buildFrom2024(): Record<string, BuildRating> {
  const out: Record<string, BuildRating> = {};
  for (const a of ALL_ABBRS) {
    const p = pres2024(a);
    const close = Math.abs(p.margin) < 3;
    out[a] = p.winner === 'D' ? (close ? 'Lean D' : 'Solid D') : close ? 'Lean R' : 'Solid R';
  }
  return out;
}
function loadBuild(): Record<string, BuildRating> {
  const base = buildFrom2024();
  try {
    const raw = localStorage.getItem(BUILD_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Record<string, string>;
      for (const [k, v] of Object.entries(saved)) if (k in base && BUILD_CYCLE.includes(v as BuildRating)) base[k] = v as BuildRating;
    }
  } catch {
    /* storage unavailable */
  }
  return base;
}

const VARIANT_KEY = 'poltok.map.variant';
const LIVE_CHAMBERS: { id: Chamber; label: string }[] = [
  { id: 'senate', label: 'Senate' },
  { id: 'governor', label: 'Governor' },
  { id: 'house', label: 'House' },
];
const CHAMBER_ORDER: Record<Chamber, number> = { senate: 0, governor: 1, house: 2 };

export default function MapPage() {
  useSeo({ title: 'Election map', description: 'Interactive US election map with state and county results.' });
  const params = useParams<{ mode?: string }>();
  const navigate = useNavigate();
  const mode: MapMode = isMode(params.mode) ? params.mode : 'pres2024';
  const live = useLive();
  const reduce = useReducedMotion();

  const [variant, setVariant] = useState<'geo' | 'hex'>(() => {
    try {
      return localStorage.getItem(VARIANT_KEY) === 'hex' ? 'hex' : 'geo';
    } catch {
      return 'geo';
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(VARIANT_KEY, variant);
    } catch {
      /* ignore */
    }
  }, [variant]);

  const [liveChamber, setLiveChamber] = useState<Chamber>('senate');
  const [hover, setHover] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [competitiveOnly, setCompetitiveOnly] = useState(false);
  const [build, setBuild] = useState<Record<string, BuildRating>>(loadBuild);
  useEffect(() => {
    try {
      localStorage.setItem(BUILD_KEY, JSON.stringify(build));
    } catch {
      /* ignore */
    }
  }, [build]);

  // Close drawer on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSelected(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const setMode = (m: MapMode) => navigate(m === 'pres2024' ? '/map' : `/map/${m}`);

  // ---------- fills ----------
  const staticFills = useMemo(
    () => ({ pres2024: presFills(), senate: ratingFills('senate'), governor: ratingFills('governor'), house: houseFills() }),
    [],
  );
  const liveFill = useMemo(() => (mode === 'live' ? liveFills(liveChamber, live.results) : {}), [mode, liveChamber, live.results]);
  const buildFills = useMemo(() => {
    const o: Record<string, string> = {};
    for (const [a, r] of Object.entries(build)) o[a] = RATING_HEX[r];
    return o;
  }, [build]);

  const fills: Record<string, string> =
    mode === 'live' ? liveFill : mode === 'build' ? buildFills : staticFills[mode];
  const emptyFill = mode === 'pres2024' || mode === 'build' ? AWAITING : NO_RACE;

  const chamberForMode: Chamber | null = mode === 'senate' || mode === 'governor' || mode === 'house' ? mode : mode === 'live' ? liveChamber : null;
  const stateRaces = useMemo(() => (chamberForMode ? byState(chamberForMode) : new Map<string, Race[]>()), [chamberForMode]);

  const focus = useMemo(() => {
    if (!competitiveOnly || !chamberForMode || mode === 'live') return undefined;
    const out: string[] = [];
    for (const [a, rs] of stateRaces) if (rs.some((r) => Math.abs(RATING_SCORE[r.rating]) <= 1)) out.push(a);
    return out.length ? out : undefined;
  }, [competitiveOnly, chamberForMode, stateRaces, mode]);

  const highlight = useMemo(() => {
    if (mode !== 'live') return undefined;
    const out: string[] = [];
    for (const c of live.calls) {
      const st = c.raceId.split('-')[0];
      const race = stateRaces.get(st)?.find((r) => r.id === c.raceId);
      if (race && !out.includes(st)) out.push(st);
      if (out.length >= 3) break;
    }
    return out;
  }, [mode, live.calls, stateRaces]);

  const sublabels = useMemo(() => {
    const o: Record<string, string> = {};
    if (mode === 'pres2024' || mode === 'build') for (const a of ALL_ABBRS) o[a] = String(stateEV(a));
    else if (mode === 'house') for (const a of ALL_ABBRS) {
      const s = houseSplit(a);
      if (s.n) o[a] = `${s.d}·${s.t}·${s.r}`;
    }
    return o;
  }, [mode]);

  const onStateClick = useCallback(
    (abbr: string) => {
      if (mode === 'build') {
        setBuild((b) => {
          const cur = b[abbr] ?? 'Toss-up';
          return { ...b, [abbr]: BUILD_CYCLE[(BUILD_CYCLE.indexOf(cur) + 1) % BUILD_CYCLE.length] };
        });
        return;
      }
      setSelected((s) => (s === abbr ? null : abbr));
    },
    [mode],
  );

  // ---------- tooltip ----------
  const renderTooltip = (abbr: string) => <Tooltip abbr={abbr} mode={mode} chamber={chamberForMode} races={stateRaces.get(abbr)} build={build[abbr]} />;
  const describe = (abbr: string) => tipText(abbr, mode, stateRaces.get(abbr), build[abbr], live.results);

  const panelAbbr = mode === 'build' ? hover : (hover ?? selected);

  return (
    <div className={`mp ${selected && mode !== 'build' ? 'has-sel' : ''}`}>
      <div className="mp-bg" aria-hidden />
      <header className="mp-head">
        <div className="mp-title">
          <span className="mp-kicker mono">ELECTION DAY · NOV 3, 2026</span>
          <h1>The Map</h1>
        </div>
        <nav className="mp-tabs" role="tablist" aria-label="Map mode">
          {MODES.map((m) => (
            <button
              key={m.id}
              role="tab"
              aria-selected={mode === m.id}
              className={`mp-tab ${mode === m.id ? 'is-on' : ''} ${m.id === 'live' ? 'is-live' : ''}`}
              onClick={() => setMode(m.id)}
            >
              {mode === m.id && <motion.span layoutId="mp-tab-pill" className="mp-tab-pill" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
              <span className="mp-tab-txt">
                {m.id === 'live' && <span className="mp-livedot" aria-hidden />}
                <span className="mp-tab-long">{m.label}</span>
                <span className="mp-tab-short">{m.short}</span>
              </span>
            </button>
          ))}
        </nav>
      </header>

      <AnimatePresence mode="wait" initial={false}>
        <motion.section
          key={mode === 'live' ? `live-${liveChamber}` : mode}
          className="mp-stats"
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? undefined : { opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
        >
          <StatsHeader mode={mode} chamber={liveChamber} build={build} onReset={() => setBuild(buildFrom2024())} />
        </motion.section>
      </AnimatePresence>

      <div className="mp-body">
        <div className="mp-stage">
          <div className="mp-toolbar">
            <div className="mp-seg" role="group" aria-label="Map style">
              <button className={variant === 'geo' ? 'is-on' : ''} aria-pressed={variant === 'geo'} onClick={() => setVariant('geo')}>
                Map
              </button>
              <button className={variant === 'hex' ? 'is-on' : ''} aria-pressed={variant === 'hex'} onClick={() => setVariant('hex')}>
                Hex
              </button>
            </div>
            {mode === 'live' && (
              <div className="mp-seg" role="group" aria-label="Live chamber">
                {LIVE_CHAMBERS.map((c) => (
                  <button key={c.id} className={liveChamber === c.id ? 'is-on' : ''} aria-pressed={liveChamber === c.id} onClick={() => setLiveChamber(c.id)}>
                    {c.label}
                  </button>
                ))}
              </div>
            )}
            {(mode === 'senate' || mode === 'governor' || mode === 'house') && (
              <label className="mp-check">
                <input type="checkbox" checked={competitiveOnly} onChange={(e) => setCompetitiveOnly(e.target.checked)} />
                <span>Competitive only</span>
              </label>
            )}
            {mode === 'build' && <span className="mp-hint">Click states to cycle Safe D → Lean D → Toss-up → Lean R → Safe R</span>}
          </div>

          <div className="mp-mapwrap">
            <USMap
              fills={fills}
              emptyFill={emptyFill}
              variant={variant}
              labels
              sublabels={sublabels}
              highlight={highlight}
              focus={focus}
              selected={mode === 'build' ? null : selected}
              onStateClick={onStateClick}
              onStateHover={setHover}
              renderTooltip={renderTooltip}
              describe={describe}
              title={`${MODES.find((m) => m.id === mode)?.label} map`}
            />
          </div>
          <Legend mode={mode} chamber={liveChamber} />
        </div>

        <aside className="mp-panel" aria-live="polite">
          {selected && mode !== 'build' && (
            <button className="mp-close" onClick={() => setSelected(null)} aria-label="Close state details">
              ×
            </button>
          )}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={panelAbbr ?? `overview-${mode}`}
              initial={reduce ? false : { opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? undefined : { opacity: 0, x: -10 }}
              transition={{ duration: 0.16 }}
            >
              {panelAbbr ? (
                <StatePanel abbr={panelAbbr} mode={mode} build={build[panelAbbr]} onBuild={(r) => setBuild((b) => ({ ...b, [panelAbbr]: r }))} />
              ) : (
                <Overview mode={mode} chamber={chamberForMode} onPick={(a) => (mode === 'build' ? undefined : setSelected(a))} />
              )}
            </motion.div>
          </AnimatePresence>
        </aside>
        {selected && mode !== 'build' && <button className="mp-scrim" aria-label="Close details" onClick={() => setSelected(null)} />}
      </div>
    </div>
  );
}

// ======================================================================
// Stats header
// ======================================================================
function ratingSegments(list: Race[], extraD = 0, extraR = 0): BarSegment[] {
  const c = ratingCounts(list);
  const segs: BarSegment[] = [];
  if (extraD) segs.push({ key: 'notup-d', value: extraD, color: '#16316e', label: 'D not up' });
  for (const r of RATINGS) segs.push({ key: r, value: c[r], color: RATING_HEX[r], label: r });
  if (extraR) segs.push({ key: 'notup-r', value: extraR, color: '#6e1624', label: 'R not up' });
  return segs;
}
const dSide = (list: Race[]) => list.filter((r) => RATING_SCORE[r.rating] > 0).length;
const rSide = (list: Race[]) => list.filter((r) => RATING_SCORE[r.rating] < 0).length;
const tossN = (list: Race[]) => list.filter((r) => RATING_SCORE[r.rating] === 0).length;

function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: 'd' | 'r' | 't' }) {
  return (
    <div className={`mp-stat ${tone ? `is-${tone}` : ''}`}>
      <span className="mp-stat-v mono">{value}</span>
      <span className="mp-stat-l">{label}</span>
    </div>
  );
}

function StatsHeader({ mode, chamber, build, onReset }: { mode: MapMode; chamber: Chamber; build: Record<string, BuildRating>; onReset: () => void }) {
  const live = useLive();
  if (mode === 'pres2024') {
    const ev = presEV();
    return (
      <div className="mp-stats-grid">
        <div className="mp-stats-line">
          <Stat label="2024 winner" value="Trump" tone="r" />
          <Stat label="States flipped from 2020" value={6} />
          <span className="mp-note">Presidential results by state, shaded by margin</span>
        </div>
        <ElectoralBar dem={ev.D} rep={ev.R} leftLabel="Harris" rightLabel="Trump" />
      </div>
    );
  }
  if (mode === 'senate') {
    const list = racesOf('senate');
    const now = senateNow();
    const total = now.known ? now.D + now.R : 100;
    return (
      <div className="mp-stats-grid">
        <div className="mp-stats-line">
          <Stat label="Senate now" value={now.known ? <>D {now.D} · R {now.R}</> : '—'} />
          <Stat label="Races" value={list.length} />
          <Stat label="Toss-ups" value={tossN(list)} tone="t" />
        </div>
        <ElectoralBar
          segments={ratingSegments(list, now.notUpD, now.notUpR)}
          total={Math.max(total, 1)}
          threshold={51}
          thresholdLabel="51 for control"
          leftValue={now.notUpD + dSide(list)}
          rightValue={now.notUpR + rSide(list)}
          leftLabel="D held/fav."
          rightLabel="R held/fav."
        />
      </div>
    );
  }
  if (mode === 'governor') {
    const list = racesOf('governor');
    const heldD = list.filter((r) => r.incumbentParty === 'D').length;
    const heldR = list.filter((r) => r.incumbentParty === 'R').length;
    return (
      <div className="mp-stats-grid">
        <div className="mp-stats-line">
          <Stat label="Governor races" value={list.length} />
          <Stat label="Now held" value={<>D {heldD} · R {heldR}</>} />
          <Stat label="Toss-ups" value={tossN(list)} tone="t" />
        </div>
        <ElectoralBar segments={ratingSegments(list)} total={Math.max(1, list.length)} threshold={null} leftValue={dSide(list)} rightValue={rSide(list)} leftLabel="D favored" rightLabel="R favored" />
      </div>
    );
  }
  if (mode === 'house') {
    const list = racesOf('house');
    const unrated = Math.max(0, HOUSE_SEATS - list.length);
    const segs = ratingSegments(list);
    if (unrated) {
      // Split unrated seats around the toss-up block so toss-ups stay centered.
      const ti = segs.findIndex((x) => x.key === 'Toss-up');
      segs.splice(ti + 1, 0, { key: 'unrated-r', value: Math.floor(unrated / 2), color: 'transparent', label: 'Not in dataset' });
      segs.splice(ti, 0, { key: 'unrated-d', value: Math.ceil(unrated / 2), color: 'transparent', label: 'Not in dataset' });
    }
    return (
      <div className="mp-stats-grid">
        <div className="mp-stats-line">
          <Stat label="House seats" value={HOUSE_SEATS} />
          <Stat label="Rated races" value={list.length} />
          <Stat label="Toss-ups" value={tossN(list)} tone="t" />
        </div>
        <ElectoralBar segments={segs} total={HOUSE_SEATS} threshold={Math.floor(HOUSE_SEATS / 2) + 1} leftValue={dSide(list)} rightValue={rSide(list)} leftLabel="D favored" rightLabel="R favored" />
      </div>
    );
  }
  if (mode === 'live') {
    const list = racesOf(chamber);
    let called = 0,
      dLead = 0,
      rLead = 0,
      dWon = 0,
      rWon = 0;
    for (const r of list) {
      const l = leaderOf(r, live.results[r.id]);
      if (!l) continue;
      if (l.called) {
        called++;
        if (l.party === 'R') rWon++;
        else dWon++;
      } else if (l.party === 'R') rLead++;
      else dLead++;
    }
    const b = chamber === 'governor' ? undefined : live.balance[chamber];
    const bar = b ? (
      <ElectoralBar
        segments={[
          { key: 'd', value: b.dem + b.ind, color: PARTY_HEX.D, label: 'Dem + Ind' },
          { key: 'u', value: Math.max(0, b.total - b.dem - b.ind - b.rep), color: 'transparent', label: 'Undecided' },
          { key: 'r', value: b.rep, color: PARTY_HEX.R, label: 'Rep' },
        ]}
        total={b.total}
        threshold={b.majority}
        leftValue={b.dem + b.ind}
        rightValue={b.rep}
        leftLabel="Dem"
        rightLabel="Rep"
        thresholdLabel={`${b.majority} for control`}
      />
    ) : (
      <ElectoralBar
        segments={[
          { key: 'dw', value: dWon, color: PARTY_HEX.D, label: 'D won' },
          { key: 'dl', value: dLead, color: '#24447f', label: 'D leading' },
          { key: 'u', value: Math.max(0, list.length - called - dLead - rLead), color: 'transparent', label: 'Awaiting' },
          { key: 'rl', value: rLead, color: '#7f2433', label: 'R leading' },
          { key: 'rw', value: rWon, color: PARTY_HEX.R, label: 'R won' },
        ]}
        total={Math.max(1, list.length)}
        threshold={null}
        leftValue={dWon}
        rightValue={rWon}
        leftLabel="D won"
        rightLabel="R won"
      />
    );
    return (
      <div className="mp-stats-grid">
        <div className="mp-stats-line">
          <Stat
            label={`${chamber === 'governor' ? 'Governor' : chamber === 'senate' ? 'Senate' : 'House'} · called`}
            value={
              <>
                {called}/{list.length}
              </>
            }
          />
          <Stat label="D leading" value={dLead} tone="d" />
          <Stat label="R leading" value={rLead} tone="r" />
          <span className="mp-note">
            <SimBadge /> {live.mode === 'connecting' ? 'Connecting…' : 'Results update in real time'}
          </span>
        </div>
        {bar}
      </div>
    );
  }
  // build
  const sum: Record<BuildRating, number> = { 'Solid D': 0, 'Lean D': 0, 'Toss-up': 0, 'Lean R': 0, 'Solid R': 0 };
  for (const a of ALL_ABBRS) sum[build[a] ?? 'Toss-up'] += stateEV(a);
  const D = sum['Solid D'] + sum['Lean D'];
  const R = sum['Solid R'] + sum['Lean R'];
  const verdict = D >= 270 ? 'Democrats win' : R >= 270 ? 'Republicans win' : D === 269 && R === 269 ? '269–269 tie → House decides' : `${sum['Toss-up']} EVs in play`;
  return (
    <div className="mp-stats-grid">
      <div className="mp-stats-line">
        <Stat label="Safe + Lean D" value={D} tone="d" />
        <Stat label="Toss-up" value={sum['Toss-up']} tone="t" />
        <Stat label="Safe + Lean R" value={R} tone="r" />
        <span className={`mp-verdict ${D >= 270 ? 'is-d' : R >= 270 ? 'is-r' : ''}`}>{verdict}</span>
        <button className="mp-btn" onClick={onReset}>
          Reset to 2024
        </button>
      </div>
      <ElectoralBar
        segments={BUILD_CYCLE.map((r) => ({ key: r, value: sum[r], color: RATING_HEX[r], label: BUILD_LABEL[r] }))}
        leftValue={D}
        rightValue={R}
        leftLabel="Dem"
        rightLabel="Rep"
      />
    </div>
  );
}

// ======================================================================
// Legend
// ======================================================================
function Legend({ mode, chamber }: { mode: MapMode; chamber: Chamber }) {
  let body: ReactNode;
  if (mode === 'pres2024' || mode === 'house' || (mode === 'live' && chamber === 'house')) {
    const stops = [-20, -10, -5, 0, 5, 10, 20].map((m) => marginColor(m));
    body = (
      <div className="mp-legend-grad">
        <span>{mode === 'pres2024' ? 'R+20' : 'R seats'}</span>
        <span className="mp-grad" style={{ background: `linear-gradient(90deg, ${stops.join(',')})` }} />
        <span>{mode === 'pres2024' ? 'D+20' : 'D seats'}</span>
        {mode === 'house' && (
          <>
            <Swatch color={RATING_HEX['Toss-up']} label="Even / toss-ups" />
            <Swatch color={NO_RACE} label="No rated races" />
            <span className="mp-legend-note">Hex labels: D-fav · toss · R-fav</span>
          </>
        )}
      </div>
    );
  } else if (mode === 'live') {
    const items: [string, string][] = [
      [PARTY_HEX.D, 'D won'],
      [leaderColor({ party: 'D', margin: 4, prob: 0.6, called: false } as Leader), 'D leading'],
      [AWAITING, 'Awaiting'],
      [leaderColor({ party: 'R', margin: 4, prob: 0.6, called: false } as Leader), 'R leading'],
      [PARTY_HEX.R, 'R won'],
      [NO_RACE, 'No race'],
    ];
    body = items.map(([c, l]) => <Swatch key={l} color={c} label={l} />);
  } else if (mode === 'build') {
    body = BUILD_CYCLE.map((r) => <Swatch key={r} color={RATING_HEX[r]} label={BUILD_LABEL[r]} />);
  } else {
    body = (
      <>
        {RATINGS.map((r) => (
          <Swatch key={r} color={RATING_HEX[r]} label={r} />
        ))}
        <Swatch color={NO_RACE} label="No race" />
      </>
    );
  }
  return (
    <div className="mp-legend" aria-label="Legend">
      {body}
    </div>
  );
}
function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="mp-swatch">
      <i style={{ background: color }} />
      {label}
    </span>
  );
}

// ======================================================================
// Tooltip
// ======================================================================
function tipText(abbr: string, mode: MapMode, races: Race[] | undefined, b: BuildRating | undefined, results: ReturnType<typeof useLive>['results']): string {
  const ev = stateEV(abbr);
  if (mode === 'pres2024') {
    const p = pres2024(abbr);
    return `${p.winner === 'D' ? 'Harris' : 'Trump'} won by ${Math.abs(p.margin).toFixed(1)} points, ${ev} electoral votes`;
  }
  if (mode === 'build') return `${b ? BUILD_LABEL[b] : 'Toss-up'}, ${ev} electoral votes. Press Enter to change.`;
  if (!races?.length) return 'no race this cycle';
  if (mode === 'live') {
    const l = leaderOf(races[0], results[races[0].id]);
    if (!l) return `${races[0].title}: awaiting results`;
    return `${races[0].title}: ${l.name} (${l.party}) ${l.called ? 'projected winner' : 'leading'} ${fmtPct(l.pct)}`;
  }
  if (mode === 'house') {
    const s = houseSplit(abbr);
    return `${s.n} rated House races: ${s.d} D-favored, ${s.t} toss-up, ${s.r} R-favored`;
  }
  return races.map((r) => `${r.title}: ${r.rating}`).join('; ');
}

function Tooltip({ abbr, mode, chamber, races, build }: { abbr: string; mode: MapMode; chamber: Chamber | null; races?: Race[]; build?: BuildRating }) {
  const live = useLive();
  const p = pres2024(abbr);
  return (
    <div className="mp-tip">
      <div className="mp-tip-h">
        <strong>{stateName(abbr)}</strong>
        <span className="mono">{stateEV(abbr)} EV</span>
      </div>
      {mode === 'pres2024' && (
        <div className="mp-tip-row">
          <PartyDot party={p.winner} /> {p.winner === 'D' ? 'Harris' : 'Trump'} +{Math.abs(p.margin).toFixed(1)}
          <span className="mp-tip-sub mono">
            {fmtPct(p.dem)} – {fmtPct(p.rep)}
          </span>
        </div>
      )}
      {mode === 'build' && (
        <div className="mp-tip-row">
          <i className="mp-tip-sw" style={{ background: RATING_HEX[build ?? 'Toss-up'] }} />
          {BUILD_LABEL[build ?? 'Toss-up']} <span className="mp-tip-sub">click to change</span>
        </div>
      )}
      {(mode === 'senate' || mode === 'governor') &&
        (races?.length ? (
          races.map((r) => (
            <div key={r.id} className="mp-tip-row">
              <span className="mp-tip-race">{r.special ? 'Special' : chamber === 'senate' ? 'Senate' : 'Governor'}</span>
              <RatingBadge rating={r.rating} />
            </div>
          ))
        ) : (
          <div className="mp-tip-sub">No {mode} race in 2026</div>
        ))}
      {mode === 'house' &&
        (() => {
          const s = houseSplit(abbr);
          return s.n ? (
            <div className="mp-tip-row">
              <span className="is-d">{s.d} D</span> · <span className="is-t">{s.t} toss</span> · <span className="is-r">{s.r} R</span>
              <span className="mp-tip-sub">of {s.n} rated</span>
            </div>
          ) : (
            <div className="mp-tip-sub">No rated House races</div>
          );
        })()}
      {mode === 'live' &&
        (races?.length ? (
          races.slice(0, 3).map((r) => <LiveLine key={r.id} race={r} leader={leaderOf(r, live.results[r.id])} compact />)
        ) : (
          <div className="mp-tip-sub">No race in this state</div>
        ))}
    </div>
  );
}

function LiveLine({ race, leader, compact }: { race: Race; leader: Leader | null; compact?: boolean }) {
  return (
    <div className={`mp-liveline ${compact ? 'is-compact' : ''}`}>
      <span className="mp-tip-race">{race.district != null && race.chamber === 'house' ? race.id : race.special ? 'Special' : race.chamber === 'senate' ? 'Senate' : race.chamber === 'governor' ? 'Gov' : race.id}</span>
      {leader ? (
        <span className="mp-liveline-l">
          <PartyDot party={leader.party} size={8} />
          <span className="mp-liveline-name">{leader.name}</span>
          <span className="mono">{fmtPct(leader.pct)}</span>
          {leader.called ? <span className="mp-called">✓ CALLED</span> : <span className="mono mp-tip-sub">{Math.round(leader.expectedPct)}% in</span>}
        </span>
      ) : (
        <span className="mp-tip-sub">Awaiting results</span>
      )}
    </div>
  );
}

// ======================================================================
// Side panel
// ======================================================================
function StatePanel({ abbr, mode, build, onBuild }: { abbr: string; mode: MapMode; build?: BuildRating; onBuild: (r: BuildRating) => void }) {
  const live = useLive();
  const p = pres2024(abbr);
  const all = racesByState(abbr).filter((r) => r && r.chamber && r.rating);
  const statewide = all.filter((r) => r.chamber !== 'house').sort((a, b) => CHAMBER_ORDER[a.chamber] - CHAMBER_ORDER[b.chamber]);
  const house = all.filter((r) => r.chamber === 'house').sort((a, b) => Math.abs(RATING_SCORE[a.rating]) - Math.abs(RATING_SCORE[b.rating]));
  const competitive = house.filter((r) => Math.abs(RATING_SCORE[r.rating]) <= 1);
  const houseShown = (competitive.length ? competitive : house).slice(0, 6);
  const total = p.dem + p.rep || 1;
  const showLive = mode === 'live' || Object.keys(live.results).length > 0;

  return (
    <div className="mp-sp">
      <div className="mp-sp-head">
        <span className="mp-sp-abbr" style={{ background: marginColor(p.margin) }}>
          {abbr}
        </span>
        <div>
          <h2>{stateName(abbr)}</h2>
          <div className="mp-sp-meta mono">
            {stateEV(abbr)} electoral votes · {all.length} race{all.length === 1 ? '' : 's'} in data
          </div>
        </div>
      </div>

      {mode === 'build' && (
        <div className="mp-sp-block">
          <h3>Your call</h3>
          <div className="mp-buildpick">
            {BUILD_CYCLE.map((r) => (
              <button key={r} className={build === r ? 'is-on' : ''} style={{ ['--c' as string]: RATING_HEX[r] }} onClick={() => onBuild(r)}>
                {BUILD_LABEL[r]}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mp-sp-block">
        <h3>2024 President{p.approx ? ' (approx.)' : ''}</h3>
        <div className="mp-res">
          <div className="mp-res-row">
            <span>
              <PartyDot party="D" /> Harris
            </span>
            <span className="mono">{fmtPct(p.dem)}</span>
          </div>
          <div className="mp-res-row">
            <span>
              <PartyDot party="R" /> Trump
            </span>
            <span className="mono">{fmtPct(p.rep)}</span>
          </div>
          <div className="mp-res-bar">
            <i style={{ width: `${(p.dem / total) * 100}%`, background: PARTY_HEX.D }} />
            <i style={{ width: `${(p.rep / total) * 100}%`, background: PARTY_HEX.R }} />
          </div>
          <div className="mp-res-note">
            {p.winner === 'D' ? 'Harris' : 'Trump'} won by <strong>{Math.abs(p.margin).toFixed(1)} pts</strong>
          </div>
        </div>
      </div>

      {statewide.length > 0 && (
        <div className="mp-sp-block">
          <h3>
            Statewide races {showLive && <SimBadge />}
          </h3>
          {statewide.map((r) => (
            <RaceRow key={r.id} race={r} leader={leaderOf(r, live.results[r.id])} />
          ))}
        </div>
      )}

      {house.length > 0 && (
        <div className="mp-sp-block">
          <h3>
            House {competitive.length ? `· ${competitive.length} competitive` : ''} <span className="mp-dim">of {house.length}</span>
          </h3>
          {houseShown.map((r) => (
            <RaceRow key={r.id} race={r} leader={leaderOf(r, live.results[r.id])} />
          ))}
        </div>
      )}

      {all.length === 0 && <p className="mp-dim">No 2026 races for this state in the dataset yet.</p>}

      <Link className="mp-cta" to={`/state/${abbr}`}>
        Open {stateName(abbr)} page →
      </Link>
    </div>
  );
}

function RaceRow({ race, leader }: { race: Race; leader: Leader | null }) {
  const cands = Array.isArray(race.candidates) ? race.candidates.slice(0, 2) : [];
  return (
    <Link to={`/race/${race.id}`} className="mp-race">
      <div className="mp-race-top">
        <span className="mp-race-t">{race.chamber === 'house' ? race.id : race.title}</span>
        <RatingBadge rating={race.rating as Rating} />
      </div>
      {cands.length > 0 && (
        <div className="mp-race-c">
          {cands.map((c) => (
            <span key={c.id}>
              <PartyDot party={c.party} size={8} /> {c.name}
              {c.incumbent ? <em> (inc.)</em> : null}
            </span>
          ))}
        </div>
      )}
      {leader && (
        <div className="mp-race-live">
          <span style={{ color: PARTY_HEX[leader.party] }}>
            {leader.called ? '✓ ' : '▲ '}
            {leader.name} ({leader.party})
          </span>
          <span className="mono">
            {leader.called ? 'Projected winner' : `+${leader.margin.toFixed(1)} · ${Math.round(leader.expectedPct)}% in · ${Math.round(leader.prob * 100)}% win`}
          </span>
        </div>
      )}
    </Link>
  );
}

function Overview({ mode, chamber, onPick }: { mode: MapMode; chamber: Chamber | null; onPick: (abbr: string) => void }) {
  const live = useLive();
  if (mode === 'pres2024' || mode === 'build') {
    const closest = [...ALL_ABBRS].sort((a, b) => Math.abs(pres2024(a).margin) - Math.abs(pres2024(b).margin)).slice(0, 8);
    return (
      <div className="mp-ov">
        <h2>{mode === 'build' ? 'Build your map' : 'Closest states of 2024'}</h2>
        <p className="mp-dim">
          {mode === 'build'
            ? 'Start from the 2024 result and flip states to game out 2028. Hover a state for details.'
            : 'Hover or tap a state to see its result and 2026 races.'}
        </p>
        <ul className="mp-ov-list">
          {closest.map((a) => {
            const p = pres2024(a);
            return (
              <li key={a}>
                <button onClick={() => onPick(a)} disabled={mode === 'build'}>
                  <i style={{ background: marginColor(p.margin) }} />
                  <span>{stateName(a)}</span>
                  <span className="mono">
                    {p.winner}+{Math.abs(p.margin).toFixed(1)}
                  </span>
                  <span className="mono mp-dim">{stateEV(a)} EV</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }
  const ch = chamber ?? 'senate';
  const list = racesOf(ch)
    .slice()
    .sort((a, b) => Number(!!b.key) - Number(!!a.key) || Math.abs(RATING_SCORE[a.rating]) - Math.abs(RATING_SCORE[b.rating]))
    .slice(0, 10);
  const name = ch === 'senate' ? 'Senate' : ch === 'governor' ? 'Governor' : 'House';
  return (
    <div className="mp-ov">
      <h2>
        {mode === 'live' ? `Live · ${name}` : `Key ${name} races`} {mode === 'live' && <SimBadge />}
      </h2>
      <p className="mp-dim">Hover or tap a state for its races{mode === 'live' ? ' and live count' : ''}.</p>
      {list.length === 0 ? (
        <p className="mp-dim">Race data is loading…</p>
      ) : (
        <ul className="mp-ov-list">
          {list.map((r) => {
            const l = leaderOf(r, live.results[r.id]);
            return (
              <li key={r.id}>
                <button onClick={() => onPick(r.state)}>
                  <i style={{ background: mode === 'live' ? leaderColor(l) : RATING_HEX[r.rating] }} />
                  <span>{ch === 'house' ? r.id : r.title}</span>
                  {mode === 'live' ? (
                    l ? (
                      <span className="mono" style={{ color: PARTY_HEX[l.party] }}>
                        {l.called ? '✓ ' : ''}
                        {l.party}+{l.margin.toFixed(1)}
                      </span>
                    ) : (
                      <span className="mp-dim">—</span>
                    )
                  ) : (
                    <RatingBadge rating={r.rating} />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {mode === 'live' && live.calls.length > 0 && (
        <>
          <h3 className="mp-ov-sub">Latest calls</h3>
          <ul className="mp-ov-calls">
            {live.calls.slice(0, 5).map((c) => (
              <li key={c.raceId}>
                <PartyDot party={c.party} size={8} /> <strong>{c.raceId}</strong> · {PARTY_NAME[c.party]}
                {c.flip && <span className="mp-flip">FLIP</span>}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
