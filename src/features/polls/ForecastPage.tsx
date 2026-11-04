import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Market } from '../../types';
import { RatingBadge, SimBadge } from '../../components';
import { useLive } from '../../lib/live';
import { marginColor, PARTY_HEX } from '../../lib/format';
import { USMap } from '../map/USMap';
import { useDebounced } from './hooks';
import { buildHouseModel, buildSenateModel } from './model';
import { conditionOnLive, summarize, type LiveSeatInput, type SimModel, type SimSeat, type SimSnapshot } from './sim';
import { raceById } from '../../data';
import { useMonteCarlo } from './useMonteCarlo';
import { ControlBar, fmtP, OutcomeDots, SeatHistogram } from './forecastCharts';
import { MARKET_REFERENCE, COOK_HOUSE } from './forecastData';
import { signed } from './pollMath';
import { Slider, Spark } from './ui';
import './polls.css';

const SENATE_SIMS = 20000;
const HOUSE_SIMS = 10000;
const BUILD_SIMS = 6000;

const envLabel = (v: number) => (Math.abs(v) < 0.05 ? 'Ratings as-is' : `${v > 0 ? 'D' : 'R'}+${Math.abs(v).toFixed(1)} shift`);
const probColor = (p: number) => marginColor((p - 0.5) * 100, 50);

/* ---------- small stat ---------- */
function Stat({ label, children, sub }: { label: string; children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="fc-stat">
      <div className="pl-stat-label">{label}</div>
      <div className="fc-stat-v mono">{children}</div>
      {sub && <div className="pl-stat-sub">{sub}</div>}
    </div>
  );
}

function Progress({ snap }: { snap: SimSnapshot | null }) {
  const p = snap ? snap.n / snap.target : 0;
  return (
    <div className="fc-prog" aria-live="polite">
      <div className="fc-prog-bar"><span style={{ width: `${p * 100}%` }} /></div>
      <span className="mono">{snap ? `${snap.n.toLocaleString('en-US')} / ${snap.target.toLocaleString('en-US')} sims` : 'idle'}</span>
    </div>
  );
}

const seatLabel = (s: SimSeat) => (s.state ? `${s.state}${s.id.endsWith('-S') ? '*' : ''}` : s.title);

/* ---------- Senate ---------- */
function SenateBlock({ model, snap }: { model: SimModel; snap: SimSnapshot | null }) {
  const sum = snap ? summarize(model, snap) : null;
  const byId = useMemo(() => new Map(model.seats.map((s) => [s.id, s])), [model]);
  const competitive = useMemo(
    () =>
      sum
        ? model.seats
            .map((s) => ({ s, p: sum.winProb(s.id), m: sum.avgMargin(s.id) }))
            .filter((x) => x.p > 0.02 && x.p < 0.98)
            .sort((a, b) => b.p - a.p)
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [snap, model],
  );

  // Map fills: per state, the more competitive race wins the fill
  const { fills, tipByState } = useMemo(() => {
    const f: Record<string, string> = {};
    const t: Record<string, { s: SimSeat; p: number }[]> = {};
    if (sum) {
      for (const s of model.seats) {
        const p = sum.winProb(s.id);
        (t[s.state] ??= []).push({ s, p });
      }
      for (const [st, list] of Object.entries(t)) {
        const most = [...list].sort((a, b) => Math.abs(a.p - 0.5) - Math.abs(b.p - 0.5))[0];
        f[st] = probColor(most.p);
      }
    }
    return { fills: f, tipByState: t };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap, model]);

  const R = model.total;
  const tip = sum?.tipping.slice(0, 4) ?? [];

  return (
    <section className="fc-section" aria-labelledby="h-senate">
      <div className="fc-sec-head">
        <div>
          <div className="eyebrow">Senate · 35 seats up</div>
          <h2 id="h-senate">Who controls the Senate?</h2>
        </div>
        <Progress snap={snap} />
      </div>
      <div className="fc-grid">
        <div className="card fc-panel">
          <ControlBar pD={sum?.pD ?? 0.5} />
          <div className="fc-stats">
            <Stat label="Most likely outcome" sub={sum ? `${(sum.modeP * 100).toFixed(1)}% of sims` : undefined}>
              {sum ? <><span style={{ color: PARTY_HEX.D }}>{sum.mode}</span>–<span style={{ color: PARTY_HEX.R }}>{R - sum.mode}</span></> : '—'}
            </Stat>
            <Stat label="80% range (D seats)" sub={sum ? `median ${sum.p50}` : undefined}>
              {sum ? `${sum.p10}–${sum.p90}` : '—'}
            </Stat>
          </div>
          <div className="fc-tip-list">
            <div className="pl-stat-label">Tipping-point race</div>
            <p className="fc-help">The seat that delivers the winning party its majority, ordered by margin.</p>
            {tip.length === 0 && <div className="muted">—</div>}
            {tip.map((t) => {
              const s = byId.get(t.id);
              return (
                <div key={t.id} className="fc-tip-row">
                  <Link to={`/race/${t.id}`} className="fc-tip-name">{s?.title ?? t.id}</Link>
                  <div className="fc-tip-bar"><span style={{ width: `${(t.p / (tip[0]?.p || 1)) * 100}%` }} /></div>
                  <span className="mono">{(t.p * 100).toFixed(0)}%</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="card fc-panel">
          <h3 className="fc-h3">Distribution of {snap?.n.toLocaleString('en-US') ?? 0} simulated Senates</h3>
          {snap && <SeatHistogram hist={snap.hist} n={snap.n} dNeeds={model.dNeeds} total={R} label="Democratic-caucus seats" />}
          <p className="fc-note">50–50 goes to Republicans: Vice President JD Vance breaks ties. Independents who caucus with Democrats count as D.</p>
          <h3 className="fc-h3" style={{ marginTop: 18 }}>50 possible outcomes</h3>
          {snap && <OutcomeDots samples={snap.samples} dNeeds={model.dNeeds} runKey={`${snap.target}-${model.seats.length}`} />}
        </div>
      </div>

      <div className="fc-grid fc-grid-map">
        <div className="card fc-panel">
          <h3 className="fc-h3">Model win probability by state</h3>
          <USMap
            fills={fills}
            labels
            title="Senate race win probabilities"
            describe={(abbr) => (tipByState[abbr] ?? []).map((x) => `${x.s.title}: Democrats ${fmtP(x.p)}`).join('; ') || 'No Senate race'}
            renderTooltip={(abbr) => {
              const list = tipByState[abbr];
              if (!list) return <div className="fc-maptip"><b>{abbr}</b><div className="muted">No Senate race in 2026</div></div>;
              return (
                <div className="fc-maptip">
                  {list.map(({ s, p }) => (
                    <div key={s.id}>
                      <b>{s.title}</b>
                      <div className="fc-maptip-row"><span style={{ color: PARTY_HEX.D }}>{s.dName ?? 'D'} ({s.dSide})</span><span className="mono">{fmtP(p)}</span></div>
                      <div className="fc-maptip-row"><span style={{ color: PARTY_HEX.R }}>{s.rName ?? 'R'}</span><span className="mono">{fmtP(1 - p)}</span></div>
                    </div>
                  ))}
                </div>
              );
            }}
          />
          <div className="fc-legend-grad" aria-hidden>
            <span>R certain</span>
            <span className="fc-grad" />
            <span>D certain</span>
          </div>
        </div>
        <div className="card fc-panel">
          <h3 className="fc-h3">Competitive races</h3>
          <div className="fc-races" role="list">
            {competitive.map(({ s, p, m }) => (
              <div key={s.id} className="fc-race" role="listitem">
                <div className="fc-race-top">
                  <Link to={`/race/${s.id}`} className="fc-race-name">{s.title}</Link>
                  <RatingBadge rating={s.rating} />
                </div>
                <div className="fc-race-bar" aria-label={`Democrats ${fmtP(p)}`}>
                  <span className="d" style={{ width: `${p * 100}%` }} />
                  <span className="r" style={{ width: `${(1 - p) * 100}%` }} />
                </div>
                <div className="fc-race-sub mono">
                  <span style={{ color: PARTY_HEX.D }}>{s.dName?.split(' ').at(-1) ?? 'D'} {fmtP(p)}</span>
                  <span className="muted">avg {m >= 0 ? 'D' : 'R'}+{Math.abs(m).toFixed(1)}{s.pollMargin != null ? ` · polls ${s.pollMargin >= 0 ? 'D' : 'R'}+${Math.abs(s.pollMargin).toFixed(1)}` : ''}</span>
                  <span style={{ color: PARTY_HEX.R }}>{fmtP(1 - p)} {s.rName?.split(' ').at(-1) ?? 'R'}</span>
                </div>
              </div>
            ))}
            {!competitive.length && <div className="pl-empty">Running simulations…</div>}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- House ---------- */
function HouseBlock({ model, snap }: { model: ReturnType<typeof buildHouseModel>; snap: SimSnapshot | null }) {
  const sum = snap ? summarize(model, snap) : null;
  return (
    <section className="fc-section" aria-labelledby="h-house">
      <div className="fc-sec-head">
        <div>
          <div className="eyebrow">House · 435 seats</div>
          <h2 id="h-house">Who controls the House?</h2>
        </div>
        <Progress snap={snap} />
      </div>
      <div className="fc-grid">
        <div className="card fc-panel">
          <ControlBar pD={sum?.pD ?? 0.5} />
          <div className="fc-stats">
            <Stat label="Most likely outcome" sub={sum ? `${(sum.modeP * 100).toFixed(1)}% of sims` : undefined}>
              {sum ? <><span style={{ color: PARTY_HEX.D }}>{sum.mode}</span>–<span style={{ color: PARTY_HEX.R }}>{model.total - sum.mode}</span></> : '—'}
            </Stat>
            <Stat label="80% range (D seats)" sub={sum ? `mean ${sum.mean.toFixed(1)}` : undefined}>{sum ? `${sum.p10}–${sum.p90}` : '—'}</Stat>
          </div>
          <p className="fc-help">
            {model.listed} individually rated competitive districts are simulated seat by seat; the other{' '}
            {model.buckets.d + model.buckets.r + model.buckets.t} seats are filled from Cook Political Report&apos;s {COOK_HOUSE.date} totals
            ({COOK_HOUSE.D} D-leaning · {COOK_HOUSE.R} R-leaning · {COOK_HOUSE.tossup} toss-ups), each with its own noise plus the shared national error.
          </p>
        </div>
        <div className="card fc-panel">
          <h3 className="fc-h3">Distribution of {snap?.n.toLocaleString('en-US') ?? 0} simulated Houses</h3>
          {snap && <SeatHistogram hist={snap.hist} n={snap.n} dNeeds={model.dNeeds} total={model.total} label="Democratic seats" minSpan={30} />}
          <h3 className="fc-h3" style={{ marginTop: 18 }}>50 possible outcomes</h3>
          {snap && <OutcomeDots samples={snap.samples} dNeeds={model.dNeeds} runKey={`h-${snap.target}`} minSpan={30} />}
        </div>
      </div>
    </section>
  );
}

/* ---------- Build your Senate ---------- */
function BuildSenate({ model, shift, corr }: { model: SimModel; shift: number; corr: number }) {
  const [picks, setPicks] = useState<Record<string, 'D' | 'R'>>({});
  const comp = useMemo(() => model.seats.filter((s) => !s.rating.startsWith('Solid')).sort((a, b) => b.prior - a.prior), [model]);
  const solidD = model.seats.filter((s) => s.rating === 'Solid D').length;
  const solidR = model.seats.filter((s) => s.rating === 'Solid R').length;
  const pickD = Object.values(picks).filter((p) => p === 'D').length;
  const pickR = Object.values(picks).filter((p) => p === 'R').length;
  const d = model.baseD + solidD + pickD;
  const r = model.baseR + solidR + pickR;
  const open = model.total - d - r;
  const params = useMemo(() => ({ shift, corr, overrides: picks }), [shift, corr, picks]);
  const snap = useMonteCarlo(model, params, BUILD_SIMS, 7);
  const pD = snap && snap.n ? snap.dControl / snap.n : null;

  let verdict: { text: string; color: string };
  if (d >= model.dNeeds) verdict = { text: `Democrats win control with ${d} seats`, color: PARTY_HEX.D };
  else if (r >= model.rNeeds) verdict = { text: `Republicans keep control with ${r} seats${r === 50 ? ' (Vance breaks the tie)' : ''}`, color: PARTY_HEX.R };
  else verdict = { text: `Democrats need ${model.dNeeds - d} of the ${open} unassigned seats; Republicans need ${model.rNeeds - r}`, color: 'var(--text)' };

  const cycle = (id: string) => setPicks((p) => {
    const cur = p[id];
    const next = { ...p };
    if (!cur) next[id] = 'D';
    else if (cur === 'D') next[id] = 'R';
    else delete next[id];
    return next;
  });
  const favorites = () => setPicks(Object.fromEntries(comp.map((s) => [s.id, s.prior + shift >= 0 ? 'D' : 'R'])));

  return (
    <section className="fc-section" aria-labelledby="h-build">
      <div className="fc-sec-head">
        <div>
          <div className="eyebrow">Interactive</div>
          <h2 id="h-build">Build your Senate</h2>
          <p className="fc-help">Tap a race to assign it: Democrat → Republican → unassigned. Solid seats are already counted. Unassigned races are simulated.</p>
        </div>
        <div className="fc-btns">
          <button className="pl-btn" onClick={favorites}>Fill with favorites</button>
          <button className="pl-btn ghost" onClick={() => setPicks({})} disabled={!Object.keys(picks).length}>Reset</button>
        </div>
      </div>
      <div className="card fc-panel">
        <div className="fc-build-tally">
          <span className="mono" style={{ color: PARTY_HEX.D }}>{d} D</span>
          <div className="fc-seatbar" role="img" aria-label={`${d} Democratic, ${r} Republican, ${open} unassigned`}>
            <span className="d" style={{ width: `${d}%` }} />
            <span className="o" style={{ width: `${open}%` }} />
            <span className="r" style={{ width: `${r}%` }} />
            <span className="fc-seatbar-mark" style={{ left: `${(model.dNeeds - 0.5) / model.total * 100}%` }}><b className="mono">51</b></span>
          </div>
          <span className="mono" style={{ color: PARTY_HEX.R }}>{r} R</span>
        </div>
        <div className="fc-verdict" style={{ color: verdict.color }}>{verdict.text}</div>
        {open > 0 && pD != null && (
          <div className="fc-verdict-sub">
            Given your picks, simulated control odds: <b className="mono" style={{ color: PARTY_HEX.D }}>D {fmtP(pD)}</b> · <b className="mono" style={{ color: PARTY_HEX.R }}>R {fmtP(1 - pD)}</b>
          </div>
        )}
        <div className="fc-build-grid">
          {comp.map((s) => {
            const pick = picks[s.id];
            return (
              <button
                key={s.id}
                className={`fc-bcard ${pick ? `pick-${pick}` : ''}`}
                onClick={() => cycle(s.id)}
                aria-pressed={!!pick}
                aria-label={`${s.title}: ${pick === 'D' ? 'assigned Democrat' : pick === 'R' ? 'assigned Republican' : 'unassigned'}. Activate to change.`}
              >
                <div className="fc-bcard-top">
                  <span className="mono fc-bcard-st">{seatLabel(s)}</span>
                  <span className="fc-bcard-pick mono">{pick ?? '·'}</span>
                </div>
                <div className="fc-bcard-c"><span style={{ color: PARTY_HEX.D }}>{s.dName ?? 'TBD'}</span></div>
                <div className="fc-bcard-c"><span style={{ color: PARTY_HEX.R }}>{s.rName ?? 'TBD'}</span></div>
                <RatingBadge rating={s.rating} />
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ---------- Markets ---------- */
function MarketsPanel({ senateP, houseP, raceP }: { senateP: number | null; houseP: number | null; raceP: (id: string) => number | null }) {
  const { markets, source } = useLive();
  const sorted = useMemo(() => {
    const pri = (m: Market) => (m.id === 'senate-control' ? 0 : m.id === 'house-control' ? 1 : 2);
    return [...markets].sort((a, b) => pri(a) - pri(b)).slice(0, 8);
  }, [markets]);
  const modelFor = (m: Market) => {
    if (m.id === 'senate-control') return senateP;
    if (m.id === 'house-control') return houseP;
    if (m.id.startsWith('race-')) {
      const p = raceP(m.id.slice(5));
      // outcome[0] is the left (usually Dem/anti-R) candidate
      return p == null ? null : /\(R\)$/.test(m.outcomes[0]?.label ?? '') ? 1 - p : p;
    }
    return null;
  };

  return (
    <section className="fc-section" aria-labelledby="h-mkts">
      <div className="fc-sec-head">
        <div>
          <div className="eyebrow">Prediction markets</div>
          <h2 id="h-mkts">What the money says</h2>
          <p className="fc-help">
            {source === 'live'
              ? <>Odds below are the last real prediction-market quotes before Election Day ({MARKET_REFERENCE.asOf}).</>
              : <>Live odds below are <b>simulated</b> and react to tonight&apos;s simulated count. For reference, the last real quotes before Election Day ({MARKET_REFERENCE.asOf}):</>}
          </p>
        </div>
        <SimBadge />
      </div>
      <div className="fc-ref">
        {MARKET_REFERENCE.rows.map((r) => {
          const mp = r.chamber === 'senate' ? senateP : houseP;
          return (
            <div key={r.source + r.chamber} className="fc-ref-item">
              <span className="pl-stat-label">{r.source} · {r.chamber}</span>
              <span className="mono" style={{ color: PARTY_HEX.D }}>D {Math.round(r.dem * 100)}%</span>
              {mp != null && <span className="mono muted">model {fmtP(mp)}</span>}
            </div>
          );
        })}
      </div>
      <div className="fc-mkts">
        {sorted.length === 0 && <div className="card pl-empty">Connecting to the market feed…</div>}
        {sorted.map((m) => {
          const o0 = m.outcomes[0];
          const mp = modelFor(m);
          const hist = (m.history ?? []).map((h) => h.p);
          const c0 = o0?.color ?? PARTY_HEX.D;
          return (
            <article key={m.id} className="card fc-mkt">
              <div className="fc-mkt-q">{m.question}</div>
              <div className="fc-mkt-row">
                <div className="fc-mkt-outs">
                  {m.outcomes.slice(0, 2).map((o, i) => (
                    <div key={i} className="fc-mkt-out">
                      <span>{o.label}</span>
                      <b className="mono" style={{ color: o.color ?? (i ? PARTY_HEX.R : PARTY_HEX.D) }}>{Math.round(o.prob * 100)}¢</b>
                    </div>
                  ))}
                </div>
                <Spark values={hist} color={c0} width={110} height={40} domain={[0, 1]} refLine={0.5} />
              </div>
              <div className="fc-mkt-foot">
                <span className="muted">{m.source}</span>
                {mp != null && o0 && (
                  <span className="mono">
                    model {fmtP(mp)} · <span style={{ color: o0.prob - mp > 0 ? PARTY_HEX.D : PARTY_HEX.R }}>{signed((o0.prob - mp) * 100, 0)} pts</span>
                  </span>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

/* ---------- page ---------- */
export default function ForecastPage() {
  const baseSenate = useMemo(buildSenateModel, []);
  const baseHouse = useMemo(buildHouseModel, []);
  const live = useLive();
  const [useLiveResults, setUseLiveResults] = useState(true);
  // Live inputs, keyed so the Monte Carlo only reruns when something material changes.
  const liveKey = useMemo(() => {
    const out: Record<string, LiveSeatInput> = {};
    for (const [id, r] of Object.entries(live.results)) {
      const race = raceById.get(id);
      if (!race) continue;
      const dSide = (pid?: string) => {
        const p = race.candidates.find((c) => c.id === pid)?.party;
        return p === 'D' || p === 'I' ? 'D' : p === 'R' ? 'R' : undefined;
      };
      let pD = 0;
      for (const [cid, p] of Object.entries(r.winProb ?? {})) if (dSide(cid) === 'D') pD += p;
      out[id] = { calledSide: r.calledFor ? dSide(r.calledFor) : undefined, pD: Math.round(pD * 100) / 100, expectedPct: Math.round(r.expectedPct / 5) * 5 };
    }
    return JSON.stringify(out);
  }, [live.results]);
  const liveInputs = useMemo(() => JSON.parse(liveKey) as Record<string, LiveSeatInput>, [liveKey]);
  const sCond = useMemo(() => conditionOnLive(baseSenate, useLiveResults ? liveInputs : {}), [baseSenate, liveInputs, useLiveResults]);
  const hCond = useMemo(() => conditionOnLive(baseHouse, useLiveResults ? liveInputs : {}), [baseHouse, liveInputs, useLiveResults]);
  const senate = sCond.model as typeof baseSenate;
  const house = hCond.model as typeof baseHouse;
  const [shift, setShift] = useState(0);
  const [corr, setCorr] = useState(0.55);
  const dShift = useDebounced(shift, 90);
  const dCorr = useDebounced(corr, 90);
  const params = useMemo(() => ({ shift: dShift, corr: dCorr }), [dShift, dCorr]);
  const sSnap = useMonteCarlo(senate, params, SENATE_SIMS);
  const hSnap = useMonteCarlo(house, params, HOUSE_SIMS);
  const sP = sSnap && sSnap.n ? sSnap.dControl / sSnap.n : null;
  const hP = hSnap && hSnap.n ? hSnap.dControl / hSnap.n : null;
  const raceP = (id: string) => {
    if (!sSnap || !sSnap.n || !(id in sSnap.dWins)) return null;
    return sSnap.dWins[id] / sSnap.n;
  };

  return (
    <div className="page pl-page fc-page">
      <header className="pl-hero">
        <div className="eyebrow">Forecast &amp; what-if lab</div>
        <h1>Run the midterms yourself</h1>
        <p className="pl-lede">
          A transparent Monte Carlo model that runs in your browser: {SENATE_SIMS.toLocaleString('en-US')} Senates and {HOUSE_SIMS.toLocaleString('en-US')} Houses per setting,
          built from race ratings, polling averages and a correlated national error. Move the sliders and watch it re-run.
        </p>
        <div className="fc-disclaimer" role="note">
          <b>This is a model for exploration, not a prediction of record.</b> It uses public race ratings and polls compiled before Election Day and makes
          simple, stated assumptions. For calls, follow the <Link to="/live">live results desk</Link>.
          {senate.fromResearch && <span className="muted"> Race list loaded from our research file while the data desk syncs.</span>}
        </div>
        <label className="fc-live-toggle">
          <input type="checkbox" checked={useLiveResults} onChange={(e) => setUseLiveResults(e.target.checked)} />
          <span>
            <b>Use tonight&apos;s results</b> — {sCond.locked + hCond.locked} races locked in from {live.source === 'live' ? 'AP calls' : 'demo calls'},{' '}
            {sCond.counting + hCond.counting} counting races use the live model.
          </span>
        </label>
      </header>

      <div className="fc-controls card">
        <Slider
          id="fc-shift"
          label="National environment shift"
          value={shift}
          min={-10}
          max={10}
          step={0.5}
          onChange={setShift}
          format={(v) => <span style={{ color: v > 0 ? PARTY_HEX.D : v < 0 ? PARTY_HEX.R : 'var(--text-2)' }}>{envLabel(v)}</span>}
          left="← Better for R"
          right="Better for D →"
        />
        <Slider
          id="fc-corr"
          label="Polling-error correlation"
          value={corr}
          min={0}
          max={0.9}
          step={0.05}
          onChange={setCorr}
          format={(v) => `ρ = ${v.toFixed(2)}`}
          left="Races miss independently"
          right="Races miss together"
        />
        <div className="fc-ctl-actions">
          <button className="pl-btn ghost" onClick={() => { setShift(0); setCorr(0.55); }} disabled={shift === 0 && corr === 0.55}>Reset</button>
        </div>
      </div>

      {senate.seats.length ? <SenateBlock model={senate} snap={sSnap} /> : <div className="card pl-empty">Senate race data is loading.</div>}
      {house.seats.length ? <HouseBlock model={house} snap={hSnap} /> : null}
      {senate.seats.length ? <BuildSenate model={senate} shift={dShift} corr={dCorr} /> : null}
      <MarketsPanel senateP={sP} houseP={hP} raceP={raceP} />

      <section className="card pl-method" aria-labelledby="h-fc-method">
        <h2 id="h-fc-method">How the model works</h2>
        <div className="pl-method-grid">
          <p><b>Priors.</b> Each race starts from its Cook rating: Solid ±18, Likely ±9, Lean ±4, Toss-up 0 (Dem-minus-Rep margin, points). Where we have a polling average, it is blended in (up to 60% weight with more polls).</p>
          <p><b>Error.</b> Each simulation draws one national error shared by every race and an independent error per race. The correlation slider (ρ) sets how much of the ~6–7 point total error is shared — high ρ means polls miss together, fattening the tails.</p>
          <p><b>Environment.</b> The shift slider moves every race&apos;s margin by the same amount — a crude stand-in for a wave or a polling miss in one direction.</p>
          <p><b>Rules.</b> Senate control needs 51; a 50–50 chamber goes to Republicans via VP JD Vance. House control needs 218. Tipping point = the race that delivers the winner&apos;s majority when races are sorted by margin.</p>
        </div>
        <p className="pl-fine">Not modeled: candidate quality beyond ratings, turnout models, ranked-choice dynamics, fundamentals. Sims run in small slices on idle time so the page stays responsive.</p>
      </section>
    </div>
  );
}
