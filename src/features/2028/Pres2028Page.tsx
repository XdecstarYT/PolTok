/** /2028 — 2028 presidential race tracker: live Polymarket odds, declared field, calendar, path-to-270 builder. */
import { useEffect, useMemo, useState } from 'react';
import { PageHeader, PersonAvatar, Sparkline } from '../../components';
import { USMap } from '../map/USMap';
import { ElectoralBar } from '../map/ElectoralBar';
import { ALL_ABBRS, pres2024, stateEV, stateName } from '../map/stateTable';
import { timeAgo } from '../../lib/format';
import './pres2028.css';

interface Outcome { label: string; prob: number; change1w?: number; volume?: number; history?: { t: number; p: number }[] }
interface Mkt { id: string; title: string; url: string; volume?: number; outcomes: Outcome[] }
interface Payload { markets: Mkt[]; fetchedAt: number; source: string; errors?: string[]; stale?: boolean; error?: string }

const DEM = '#3d7bff';
const REP = '#ff3d55';
const usd = (v?: number) => (v == null ? '—' : v >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${Math.round(v / 1e3)}K`);
const pct = (p: number) => `${(p * 100).toFixed(p < 0.1 ? 1 : 0)}%`;

// Verified 2026-11-05 via DNC adoption coverage (NOTUS, Aug 15 2026). GOP calendar not yet set.
const DEM_CAL = [
  ['South Carolina', '2028-01-22'], ['Nevada', '2028-02-01'], ['New Hampshire', '2028-02-08'],
  ['New Mexico', '2028-02-15'], ['Michigan', '2028-02-22'], ['Virginia', '2028-02-29'],
] as const;
const CAL_SRC = 'https://washingtonsun.com/democrats/dnc-new-presidential-primary-calendar-black-vote-south-carolina';

type Pick = 'D' | 'R' | 'U';

function MarketCard({ m, color }: { m: Mkt; color: string }) {
  return (
    <section className="p28-panel">
      <div className="p28-mhead">
        <h2>{m.title}</h2>
        <a href={m.url} target="_blank" rel="noreferrer">Polymarket · {usd(m.volume)} vol ↗</a>
      </div>
      <ol className="p28-cands">
        {m.outcomes.map((o) => (
          <li key={o.label}>
            <PersonAvatar name={o.label} party={m.id === 'dem' ? 'D' : m.id === 'gop' ? 'R' : 'I'} lookup={{ name: o.label, scope: 'us' }} size={34} />
            <span className="p28-name">{o.label}<small>{usd(o.volume)} vol</small></span>
            {o.history && o.history.length > 1 ? (
              <Sparkline values={o.history.map((h) => h.p)} width={80} height={24} color={color} ariaLabel={`${o.label} 1-week price`} />
            ) : <span className="p28-spark-empty" />}
            <span className="p28-prob">
              <b>{pct(o.prob)}</b>
              {o.change1w != null && Math.abs(o.change1w) >= 0.001 && (
                <small className={o.change1w > 0 ? 'up' : 'down'}>{o.change1w > 0 ? '▲' : '▼'}{(Math.abs(o.change1w) * 100).toFixed(1)} 1w</small>
              )}
            </span>
            <span className="p28-bar" style={{ width: `${Math.max(1, o.prob * 100)}%`, background: color }} />
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function Pres2028Page() {
  const [data, setData] = useState<Payload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    document.title = '2028 Presidential Race · PolTok';
    let alive = true;
    const load = () =>
      fetch('/api/pres2028').then((r) => r.json()).then((d: Payload) => {
        if (!alive) return;
        if (d.markets?.length) { setData(d); setErr(null); } else setErr(d.error || 'No market data');
      }).catch((e) => alive && setErr(String(e)));
    load();
    const t = setInterval(load, 120000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const base = useMemo(() => {
    const o: Record<string, Pick> = {};
    for (const a of ALL_ABBRS) o[a] = pres2024(a).margin > 0 ? 'D' : 'R';
    return o;
  }, []);
  const [picks, setPicks] = useState<Record<string, Pick>>(base);
  const cycle = (a: string) => setPicks((p) => ({ ...p, [a]: p[a] === 'D' ? 'R' : p[a] === 'R' ? 'U' : 'D' }));
  const tot = useMemo(() => {
    const t = { D: 0, R: 0, U: 0 };
    for (const a of ALL_ABBRS) t[picks[a]] += stateEV(a);
    return t;
  }, [picks]);
  const fills = useMemo(() => Object.fromEntries(ALL_ABBRS.map((a) => [a, picks[a] === 'D' ? DEM : picks[a] === 'R' ? REP : '#6b7280'])), [picks]);
  const sub = useMemo(() => Object.fromEntries(ALL_ABBRS.map((a) => [a, String(stateEV(a))])), []);

  const get = (id: string) => data?.markets.find((m) => m.id === id);
  const party = get('party');

  return (
    <div className="page p28-page">
      <PageHeader
        kicker="Road to 2028 · Election day Nov 7, 2028"
        title="2028 Presidential Race"
        crumbLabel="2028"
        sub="Live prediction-market odds, the declared field, the primary calendar, and a build-your-own path to 270 starting from the 2024 map."
        meta={<span>
          {data ? <>Polymarket odds · updated {timeAgo(data.fetchedAt)}{data.stale ? ' (stale — refresh failed)' : ''} · refreshes every 2 min</> : err ? <>Market data unavailable: {err}</> : 'Loading live markets…'}
        </span>}
      />

      {party && (
        <section className="p28-panel">
          <div className="p28-mhead"><h2>{party.title}</h2><a href={party.url} target="_blank" rel="noreferrer">Polymarket · {usd(party.volume)} vol ↗</a></div>
          {(() => {
            const d = party.outcomes.find((o) => /democrat/i.test(o.label))?.prob ?? 0;
            const r = party.outcomes.find((o) => /republican/i.test(o.label))?.prob ?? 0;
            return (
              <div className="p28-party">
                <span style={{ color: DEM }}><b>{pct(d)}</b> Democrats</span>
                <div className="p28-track"><i style={{ width: `${(d / (d + r || 1)) * 100}%`, background: DEM }} /><i style={{ flex: 1, background: REP }} /></div>
                <span style={{ color: REP }}>Republicans <b>{pct(r)}</b></span>
              </div>
            );
          })()}
        </section>
      )}

      <div className="p28-grid">
        {get('dem') && <MarketCard m={get('dem')!} color={DEM} />}
        {get('gop') && <MarketCard m={get('gop')!} color={REP} />}
        {get('winner') && <MarketCard m={get('winner')!} color="var(--accent)" />}
      </div>
      <p className="p28-note">Market prices are traders' implied probabilities, not polls or forecasts. Listed names are market contracts, not declared candidates. Portraits: Wikimedia Commons free licences (hover for credit); initials where none is verified.</p>

      <div className="p28-grid">
        <section className="p28-panel">
          <h2>Declared candidates</h2>
          <p><b>No major declared candidates yet.</b></p>
          <p className="p28-muted p28-small">As of Nov 5, 2026 we found no official launch or FEC Form 2 filing by a major-party contender. Several (e.g. Gavin Newsom, Andy Beshear) have publicly acknowledged considering a run. Check the <a href="https://www.fec.gov/data/candidates/president/?election_year=2028" target="_blank" rel="noreferrer">FEC 2028 presidential filings ↗</a>. We'll add candidates only once an announcement is verifiable.</p>
        </section>
        <section className="p28-panel">
          <h2>Democratic early-state calendar</h2>
          <ol className="p28-cal">
            {DEM_CAL.map(([s, d]) => (
              <li key={s}><span>{s}</span><time dateTime={d}>{new Date(d + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</time></li>
            ))}
          </ol>
          <p className="p28-muted p28-small">Adopted by the DNC Aug 15, 2026 (<a href={CAL_SRC} target="_blank" rel="noreferrer">NOTUS ↗</a>). New Hampshire state law requires it to hold the first primary, so its date may still move. <b>Republican calendar: not yet set — tentative.</b></p>
        </section>
      </div>

      <section className="p28-panel">
        <div className="p28-mhead">
          <h2>Path to 270 — build your map</h2>
          <span>
            <button type="button" className="p28-btn" onClick={() => setPicks(base)}>Reset to 2024</button>{' '}
            <button type="button" className="p28-btn" onClick={() => setPicks(Object.fromEntries(ALL_ABBRS.map((a) => [a, 'U' as Pick])))}>Clear</button>
          </span>
        </div>
        <ElectoralBar segments={[{ key: 'D', value: tot.D, color: DEM }, { key: 'U', value: tot.U, color: '#6b7280' }, { key: 'R', value: tot.R, color: REP }]} leftValue={tot.D} rightValue={tot.R} />
        <p className="p28-muted p28-small">
          {tot.D >= 270 ? 'Democrats reach 270.' : tot.R >= 270 ? 'Republicans reach 270.' : tot.U ? `${tot.U} EVs undecided.` : '269–269 tie: the House decides.'}{' '}
          Click a state to cycle D → R → toss-up. Baseline = 2024 result (Trump 312 – Harris 226); ME and NE are shown whole-state, so their split district votes (ME-2 R, NE-2 D) are not modelled. EVs use the 2020-census apportionment.
        </p>
        <USMap fills={fills} sublabels={sub} onStateClick={cycle} title="2028 path to 270 map"
          renderTooltip={(a) => { const p = pres2024(a); return <div><b>{stateName(a)}</b> · {stateEV(a)} EV<br />2024: {p.margin > 0 ? 'Harris' : 'Trump'} +{Math.abs(p.margin).toFixed(1)}</div>; }}
          describe={(a) => `${stateEV(a)} electoral votes, currently ${picks[a] === 'U' ? 'toss-up' : picks[a]}`} />
      </section>
    </div>
  );
}
