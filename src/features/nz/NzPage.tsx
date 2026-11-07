/**
 * /nz — NZ 2026 general election night hub. Live party vote + MMP projection from the Electoral
 * Commission's results pages (via /api/nz/results), coalition builder, electorate map & list,
 * polls, Polymarket odds, NZ news. Before 7pm NZDT shows polls-based projection, clearly labelled.
 */
import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { Link } from 'react-router-dom';
import { geoMercator, geoPath } from 'd3-geo';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { Card, useNow, fmtTime, tzAbbr, splitDuration } from '../../components';
import {
  CURRENT_PARLIAMENT, EC_RESULTS_URL, NZ_ELECTORATES, NZ_POLLS, NZ_TZ, PARTIES, POLLS_CLOSE, RESULT_2023,
  allocateMMP, callOf, incumbentElectorates, partyMeta, pollAverage, useNzNews, useNzResults, usePolymarket,
  type Alloc, type LiveElectorate, type NzResults,
} from './data';
import './nz.css';

const nzdt = (ts: number) => new Intl.DateTimeFormat('en-NZ', { timeZone: NZ_TZ, hour: 'numeric', minute: '2-digit', weekday: 'short' }).format(new Date(ts));
const pct = (x: number, d = 1) => `${x.toFixed(d)}%`;

export default function NzPage() {
  const { data, err } = useNzResults();
  const live = data && data.status !== 'pre' && data.party.length > 0;
  const { avg } = useMemo(() => pollAverage(), []);

  // Projection: live party votes + live electorate leaders; else polling average + incumbents' seats.
  const proj = useMemo(() => {
    if (live) {
      const votes = Object.fromEntries(data.party.map((p) => [p.party, p.votes]));
      const el: Record<string, number> = {};
      if (data.electorates.length) for (const e of data.electorates) { if (e.leadingParty) el[e.leadingParty] = (el[e.leadingParty] || 0) + 1; }
      else for (const p of data.party) if (p.electorateSeats) el[p.party] = p.electorateSeats;
      return { ...allocateMMP(votes, el), basis: 'live' as const };
    }
    return { ...allocateMMP(avg, incumbentElectorates()), basis: 'polls' as const };
  }, [data, live, avg]);

  useDocTitle('NZ Election 2026 — live results · PolTok');

  return (
    <div className="nz page">
      <header className="nz-hero">
        <div>
          <span className="kicker">New Zealand · General election · Sat 7 Nov 2026</span>
          <h1>Aotearoa decides</h1>
          <p className="nz-sub">
            71 electorates (64 general + 7 Māori) · 49 list seats · MMP · 61 for a majority of 120 (more if overhang).
            PM <b>Christopher Luxon</b> (National, with ACT &amp; NZ First) vs Opposition leader <b>Chris Hipkins</b> (Labour).
          </p>
        </div>
        <Clock data={data} />
      </header>

      <StatusBar data={data} err={err} />

      <div className="nz-grid">
        <Card title={live ? 'Party vote — live' : 'Party vote — polling average'} kicker={live ? `Electoral Commission · ${data.status === 'final' ? 'official' : 'preliminary'}` : 'Latest poll from each pollster (≤21 days)'} live={!!live}>
          <PartyBars data={data} avg={avg} />
        </Card>
        <Card title="Projected Parliament" kicker={proj.basis === 'live' ? 'PolTok MMP projection from live count — not official' : 'PolTok MMP projection from polls — not a result'}>
          <Hemicycle rows={proj.rows} total={proj.total} majority={proj.majority} />
          <p className="nz-note">
            {proj.total} seats{proj.overhang > 0 ? ` (incl. ${proj.overhang} overhang)` : ''} · majority {proj.majority}. Sainte-Laguë, 5% threshold or electorate waiver.
            {proj.basis === 'polls' && ' Electorate seats assumed held by sitting MPs’ parties.'}
          </p>
        </Card>
        <Card title="Coalition builder" kicker="Drag or tap parties into the government">
          <Coalition rows={proj.rows} majority={proj.majority} />
        </Card>
      </div>

      <Electorates data={data} />

      <div className="nz-grid">
        <Card title="Polls" kicker="Party vote, 2026 · source: Wikipedia poll table">
          <PollChart />
        </Card>
        <Card title="Prediction markets" kicker="Polymarket · live prices">
          <Markets />
        </Card>
        <Card title="NZ news" kicker="RNZ · Stuff · NZ Herald · 1News · Newsroom">
          <News />
        </Card>
      </div>

      <Card title="Parliament at dissolution" kicker="123 seats incl. overhang · 2023 party vote in brackets">
        <div className="nz-chips">
          {Object.entries(CURRENT_PARLIAMENT).map(([p, n]) => (
            <span key={p} className="nz-chip" style={{ ['--pc' as string]: partyMeta(p).color }}>
              <i /> {partyMeta(p).name} <b>{n}</b>{RESULT_2023[p] != null && <small> ({RESULT_2023[p]}%)</small>}
            </span>
          ))}
        </div>
        <p className="nz-note">Government: National + ACT + NZ First = 68 of 123.</p>
      </Card>
    </div>
  );
}

function useDocTitle(t: string) {
  useEffect(() => {
    const prev = document.title;
    document.title = t;
    return () => void (document.title = prev);
  }, [t]);
}

function Clock({ data }: { data: NzResults | null }) {
  const now = useNow(1000);
  const left = POLLS_CLOSE - now;
  const { h, m, s } = splitDuration(Math.max(0, left));
  const d = Math.floor(h / 24);
  return (
    <div className="nz-clock" aria-live="polite">
      {left > 0 ? (
        <>
          <span className="kicker">Polls close in</span>
          <strong className="mono">{d > 0 ? `${d}d ${h % 24}h ${m}m` : `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`}</strong>
          <span>7:00pm NZDT · {fmtTime(POLLS_CLOSE)} {tzAbbr(POLLS_CLOSE)}</span>
        </>
      ) : (
        <>
          <span className="kicker">Polls closed</span>
          <strong>{data?.status === 'final' ? 'Official result' : data?.status === 'counting' ? 'Counting' : 'Awaiting results'}</strong>
          <span>NZ time {nzdt(now)}</span>
        </>
      )}
    </div>
  );
}

function StatusBar({ data, err }: { data: NzResults | null; err: string | null }) {
  if (err) return <div className="nz-status nz-status--warn">Results feed unreachable ({err}). Official results: <a href={EC_RESULTS_URL} target="_blank" rel="noreferrer">electionresults.govt.nz</a></div>;
  if (!data) return <div className="nz-status">Connecting to results feed…</div>;
  if (data.status === 'pre' && Date.now() >= POLLS_CLOSE && /403/.test(data.error || ''))
    return (
      <div className="nz-status nz-status--warn">
        <b>Counting is underway — but PolTok can’t show live numbers.</b> The Electoral Commission’s results site blocks automated access, so we can’t
        read its count, and no other reliable source has published figures yet. We won’t guess or show made-up numbers.{' '}
        <a className="nz-official-btn" href={EC_RESULTS_URL} target="_blank" rel="noreferrer">
          Follow the official count at electionresults.govt.nz →
        </a>{' '}
        Live headlines are below. Checked {fmtTime(data.updatedAt)}
      </div>
    );
  if (data.status === 'pre')
    return (
      <div className="nz-status">
        <b>No results yet.</b> Preliminary results stream from 7:00pm NZDT as voting places report (EC targets 50% by 10pm, 95% by 11:30pm; special votes counted later, official result 27 Nov). Checked {fmtTime(data.updatedAt)} · <a href={data.source} target="_blank" rel="noreferrer">source</a>
      </div>
    );
  if (data.sourceKind === 'wikipedia')
    return (
      <div className="nz-status nz-status--warn">
        <b>UNOFFICIAL — community-edited Wikipedia figures.</b> The Electoral Commission results site is blocking our server, so these numbers come from{' '}
        <a href={data.source} target="_blank" rel="noreferrer">Wikipedia</a> and may be wrong or out of date. Always check{' '}
        <a href={EC_RESULTS_URL} target="_blank" rel="noreferrer">electionresults.govt.nz</a> · updated {fmtTime(data.updatedAt)}
      </div>
    );
  return (
    <div className={`nz-status nz-status--live`}>
      <span className="pulse" aria-hidden="true" /> <b>{data.status === 'final' ? 'OFFICIAL RESULT' : 'PRELIMINARY COUNT'}</b>
      {data.votesCountedPct != null && <> · {pct(data.votesCountedPct)} counted</>} · updated {fmtTime(data.updatedAt)} ·{' '}
      <a href={data.source} target="_blank" rel="noreferrer">Electoral Commission</a> · refreshes every 60s
    </div>
  );
}

function PartyBars({ data, avg }: { data: NzResults | null; avg: Record<string, number> }) {
  const live = data && data.status !== 'pre' && data.party.length;
  const rows = live
    ? data.party.filter((p) => p.pct >= 0.4).map((p) => ({ party: p.party, pct: p.pct, votes: p.votes, seats: p.totalSeats }))
    : Object.entries(avg).sort((a, b) => b[1] - a[1]).map(([party, v]) => ({ party, pct: v, votes: null as number | null, seats: null as number | null }));
  const max = Math.max(40, ...rows.map((r) => r.pct));
  return (
    <ul className="nz-bars">
      {rows.map((r) => {
        const m = partyMeta(r.party);
        return (
          <li key={r.party} style={{ ['--pc' as string]: m.color }}>
            <span className="nz-bars__name">{m.name}</span>
            <span className="nz-bars__track" aria-hidden="true">
              <span style={{ width: `${(r.pct / max) * 100}%` }} />
              <span className="nz-bars__thr" style={{ left: `${(5 / max) * 100}%` }} title="5% threshold" />
            </span>
            <span className="nz-bars__val mono">{pct(r.pct)}</span>
            {r.votes != null && <small className="mono">{r.votes.toLocaleString()} · {r.seats} seats (EC)</small>}
            {r.votes == null && RESULT_2023[r.party] != null && <small className="mono">2023: {RESULT_2023[r.party]}%</small>}
          </li>
        );
      })}
    </ul>
  );
}

function Hemicycle({ rows, total, majority }: { rows: Alloc[]; total: number; majority: number }) {
  // Order left→right by bloc for a readable chamber.
  const order = ['GRN', 'TPM', 'LAB', 'OPP', 'IND', 'NZF', 'NAT', 'ACT'];
  const seats: string[] = [];
  [...rows].sort((a, b) => (order.indexOf(a.party) + 99) % 99 - ((order.indexOf(b.party) + 99) % 99)).forEach((r) => { for (let i = 0; i < r.total; i++) seats.push(r.party); });
  // Place seats on concentric arcs.
  const pts = useMemo(() => {
    const rowsN = 7, out: { x: number; y: number; a: number }[] = [];
    const radii = Array.from({ length: rowsN }, (_, i) => 0.42 + (i * 0.58) / (rowsN - 1));
    const sum = radii.reduce((a, b) => a + b, 0);
    radii.forEach((r) => {
      const n = Math.max(1, Math.round((total * r) / sum));
      for (let j = 0; j < n; j++) { const a = Math.PI - (Math.PI * (j + 0.5)) / n; out.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, a }); }
    });
    return out.sort((p, q) => q.a - p.a).slice(0, total);
  }, [total]);
  const leader = rows[0];
  return (
    <figure className="nz-hemi">
      <svg viewBox="-1.08 -1.06 2.16 1.14" role="img" aria-label={`Projected ${total}-seat Parliament: ${rows.filter((r) => r.total).map((r) => `${partyMeta(r.party).name} ${r.total}`).join(', ')}`}>
        {pts.map((p, i) => <circle key={i} cx={p.x} cy={-p.y} r={0.034} fill={seats[i] ? partyMeta(seats[i]).color : 'var(--line-2)'} />)}
        <line x1="0" y1="-1.04" x2="0" y2="-0.36" stroke="var(--text-3)" strokeDasharray="0.02 0.02" strokeWidth="0.008" />
        <text x="0" y="-0.12" textAnchor="middle" className="nz-hemi__big">{majority}</text>
        <text x="0" y="0.02" textAnchor="middle" className="nz-hemi__small">for majority</text>
      </svg>
      <figcaption className="nz-chips">
        {rows.filter((r) => r.total > 0).map((r) => (
          <span key={r.party} className="nz-chip" style={{ ['--pc' as string]: partyMeta(r.party).color }}>
            <i /> {partyMeta(r.party).short} <b>{r.total}</b> <small>{r.electorate}e+{r.list}l</small>
          </span>
        ))}
        {leader && <span className="sr-only">Largest: {partyMeta(leader.party).name}</span>}
      </figcaption>
    </figure>
  );
}

function Coalition({ rows, majority }: { rows: Alloc[]; majority: number }) {
  const [inGov, setInGov] = useState<string[]>(['NAT', 'ACT', 'NZF']);
  const avail = rows.filter((r) => r.total > 0);
  const sum = avail.filter((r) => inGov.includes(r.party)).reduce((a, r) => a + r.total, 0);
  const toggle = (p: string) => setInGov((g) => (g.includes(p) ? g.filter((x) => x !== p) : [...g, p]));
  const onDrop = (target: 'gov' | 'out') => (e: DragEvent) => {
    e.preventDefault();
    const p = e.dataTransfer.getData('text/plain');
    if (!p) return;
    setInGov((g) => (target === 'gov' ? (g.includes(p) ? g : [...g, p]) : g.filter((x) => x !== p)));
  };
  const chip = (r: Alloc) => (
    <button key={r.party} type="button" draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', r.party)} onClick={() => toggle(r.party)} className="nz-chip nz-chip--btn" style={{ ['--pc' as string]: partyMeta(r.party).color }} aria-pressed={inGov.includes(r.party)}>
      <i /> {partyMeta(r.party).name} <b>{r.total}</b>
    </button>
  );
  return (
    <div className="nz-coal">
      <div className="nz-coal__zone nz-coal__zone--gov" onDragOver={(e) => e.preventDefault()} onDrop={onDrop('gov')}>
        <span className="kicker">Government</span>
        <div className="nz-chips">{avail.filter((r) => inGov.includes(r.party)).map(chip)}</div>
      </div>
      <div className="nz-coal__meter" aria-live="polite">
        <div className="nz-coal__bar"><span style={{ width: `${Math.min(100, (sum / (majority * 2 - 1)) * 100)}%` }} /><i style={{ left: `${(majority / (majority * 2 - 1)) * 100}%` }} /></div>
        <b>{sum}</b> / {majority} needed — {sum >= majority ? <span className="nz-ok">majority ✓</span> : <span className="nz-bad">{majority - sum} short</span>}
      </div>
      <div className="nz-coal__zone" onDragOver={(e) => e.preventDefault()} onDrop={onDrop('out')}>
        <span className="kicker">Opposition / crossbench</span>
        <div className="nz-chips">{avail.filter((r) => !inGov.includes(r.party)).map(chip)}</div>
      </div>
      <div className="nz-coal__presets">
        <button type="button" className="btn btn--sm" onClick={() => setInGov(['NAT', 'ACT', 'NZF'])}>Current govt</button>
        <button type="button" className="btn btn--sm" onClick={() => setInGov(['LAB', 'GRN', 'TPM'])}>Labour–Green–TPM</button>
        <button type="button" className="btn btn--sm" onClick={() => setInGov(['LAB', 'GRN', 'TPM', 'OPP'])}>+ Opportunity</button>
      </div>
    </div>
  );
}

/* ------------------------------------------- electorates ------------------------------------------- */
type GeoF = Feature<Geometry, { id: string; name: string; type: 'general' | 'maori' }>;
let geoP: Promise<GeoF[]> | null = null;
function useGeo() {
  const [g, setG] = useState<GeoF[] | null>(null);
  const [bad, setBad] = useState(false);
  useEffect(() => {
    geoP ||= fetch('/geo/nz-electorates.json').then((r) => r.json()).then((d: FeatureCollection<Geometry, GeoF['properties']>) => d.features as GeoF[]);
    geoP.then(setG).catch(() => ((geoP = null), setBad(true)));
  }, []);
  return { g, bad };
}

function Electorates({ data }: { data: NzResults | null }) {
  const liveById = useMemo(() => new Map((data?.electorates || []).map((e) => [e.id, e])), [data]);
  const [layer, setLayer] = useState<'general' | 'maori'>('general');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const { g, bad } = useGeo();
  const status = data?.status || 'pre';
  const nat = data?.votesCountedPct ?? null;
  const fillOf = (id: string) => {
    const l = liveById.get(id);
    if (l?.leadingParty) return { c: partyMeta(l.leadingParty).color, o: callOf(l, status, nat) === 'leading' ? 0.55 : 1 };
    const info = NZ_ELECTORATES.find((e) => e.id === id);
    const p = info?.candidates.find((c) => c.inc)?.party || info?.r2023?.party;
    return { c: p ? partyMeta(p).color : 'var(--bg-3)', o: 0.22 };
  };
  const list = NZ_ELECTORATES.filter((e) => (!q || e.name.toLowerCase().includes(q.toLowerCase())));
  const calls = (data?.electorates || []).filter((e) => callOf(e, status, nat) === 'likely' || callOf(e, status, nat) === 'official');

  const W = 420, H = 560;
  const paths = useMemo(() => {
    if (!g) return [];
    const fs = g.filter((f) => f.properties.type === layer);
    const proj = geoMercator().fitSize([W, H], { type: 'FeatureCollection', features: fs } as FeatureCollection);
    const path = geoPath(proj);
    return fs.map((f) => ({ id: f.properties.id, name: f.properties.name, d: path(f) || '' }));
  }, [g, layer]);
  const selLive = sel ? liveById.get(sel) : undefined;
  const selInfo = sel ? NZ_ELECTORATES.find((e) => e.id === sel) : undefined;

  return (
    <section className="nz-elec">
      <Card title="Electorate map" kicker={data?.status === 'pre' || !data ? 'Shaded faintly by sitting MP’s party · results fill in from 7pm' : 'Solid = PolTok “likely” / official · pale = leading'} action={
        <div className="nz-seg" role="tablist">
          {(['general', 'maori'] as const).map((l) => <button key={l} role="tab" aria-selected={layer === l} className={layer === l ? 'on' : ''} onClick={() => setLayer(l)}>{l === 'general' ? 'General (64)' : 'Māori (7)'}</button>)}
        </div>
      }>
        {bad ? <HexFallback fillOf={fillOf} /> : !g ? <div className="nz-note">Loading boundaries…</div> : (
          <div className="nz-map">
            <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${layer} electorates map`}>
              {paths.map((p) => {
                const f = fillOf(p.id);
                return (
                  <path key={p.id} d={p.d} fill={f.c} fillOpacity={f.o} stroke="var(--bg)" strokeWidth={0.5} tabIndex={0} role="button" aria-label={p.name} className={sel === p.id ? 'sel' : ''}
                    onClick={() => setSel(p.id)} onKeyDown={(e) => e.key === 'Enter' && setSel(p.id)} onMouseEnter={() => setSel(p.id)}>
                    <title>{p.name}</title>
                  </path>
                );
              })}
            </svg>
            <div className="nz-map__info">
              {selInfo ? (
                <>
                  <b>{selInfo.name}</b> <small>{selInfo.type === 'maori' ? 'Māori electorate' : 'General electorate'}</small>
                  {selLive?.leader ? <p>{selLive.leader} ({selLive.leadingParty}) leads by {selLive.margin.toLocaleString()}</p> : <p>Sitting: {selInfo.candidates.find((c) => c.inc)?.name || 'open seat'}</p>}
                  <Link to={`/nz/electorate/${selInfo.id}`}>Full results →</Link>
                </>
              ) : <span className="nz-note">Hover or tap an electorate (Auckland & Wellington are small — zoom with the browser).</span>}
            </div>
          </div>
        )}
      </Card>

      <Card title="Electorates" kicker={`${NZ_ELECTORATES.length} seats`} action={<input className="nz-search" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search electorates" />}>
        {calls.length > 0 && (
          <div className="nz-calls" role="status">
            {calls.slice(0, 8).map((e) => (
              <span key={e.id} className="nz-call" style={{ ['--pc' as string]: partyMeta(e.leadingParty || '').color }}>
                {callOf(e, status, nat) === 'official' ? 'Official (EC)' : 'PolTok projection: likely'} — <b>{e.name}</b>: {e.leader} ({e.leadingParty})
              </span>
            ))}
          </div>
        )}
        <ul className="nz-elist">
          {list.map((e) => {
            const l: LiveElectorate | undefined = liveById.get(e.id);
            const c = l ? callOf(l, status, nat) : null;
            const inc = e.candidates.find((x) => x.inc);
            return (
              <li key={e.id}>
                <Link to={`/nz/electorate/${e.id}`} style={{ ['--pc' as string]: partyMeta(l?.leadingParty || inc?.party || '').color }}>
                  <i />
                  <span className="nz-elist__n">{e.name}{e.type === 'maori' && <small> · Māori</small>}</span>
                  {l?.leader ? (
                    <span className="nz-elist__l">{l.leader} <b>{l.leadingParty}</b> +{l.margin.toLocaleString()} {c === 'likely' && <em>likely</em>}{c === 'official' && <em>official</em>}</span>
                  ) : (
                    <span className="nz-elist__l nz-dim">{inc ? `${inc.name} (${inc.party}) seeks re-election` : 'Open seat'}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>
    </section>
  );
}

function HexFallback({ fillOf }: { fillOf: (id: string) => { c: string; o: number } }) {
  return (
    <div className="nz-hex">
      {NZ_ELECTORATES.map((e) => { const f = fillOf(e.id); return <Link key={e.id} to={`/nz/electorate/${e.id}`} title={e.name} style={{ background: f.c, opacity: Math.max(0.35, f.o) }}>{e.name.slice(0, 3)}</Link>; })}
    </div>
  );
}

/* ------------------------------------------- polls / markets / news ------------------------------------------- */
function PollChart() {
  const keys = ['NAT', 'LAB', 'GRN', 'ACT', 'NZF', 'OPP', 'TPM'] as const;
  const polls = useMemo(() => NZ_POLLS.filter((p) => p.date >= '2026-01-01').slice().reverse(), []);
  const W = 520, H = 220, P = 26;
  const t0 = Date.parse(polls[0]?.date || '2026-01-01'), t1 = Date.parse(polls.at(-1)?.date || '2026-11-03');
  const x = (d: string) => P + ((Date.parse(d) - t0) / (t1 - t0 || 1)) * (W - P - 8);
  const y = (v: number) => H - 18 - (v / 40) * (H - 30);
  const smooth = (k: (typeof keys)[number]) => polls.map((p, i) => { const w = polls.slice(Math.max(0, i - 4), i + 1); return { d: p.date, v: w.reduce((a, q) => a + q[k], 0) / w.length }; });
  const { avg, polls: latest } = pollAverage();
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="nz-polls" role="img" aria-label="Party vote polls in 2026">
        {[0, 10, 20, 30, 40].map((v) => <g key={v}><line x1={P} x2={W} y1={y(v)} y2={y(v)} stroke="var(--line)" /><text x={2} y={y(v) + 3} className="nz-ax">{v}</text></g>)}
        <line x1={P} x2={W} y1={y(5)} y2={y(5)} stroke="var(--text-3)" strokeDasharray="3 3" />
        {keys.map((k) => (
          <g key={k}>
            {polls.map((p, i) => <circle key={i} cx={x(p.date)} cy={y(p[k])} r={1.6} fill={partyMeta(k).color} opacity={0.35} />)}
            <path d={smooth(k).map((p, i) => `${i ? 'L' : 'M'}${x(p.d).toFixed(1)},${y(p.v).toFixed(1)}`).join('')} fill="none" stroke={partyMeta(k).color} strokeWidth={2} />
          </g>
        ))}
      </svg>
      <table className="nz-ptable">
        <thead><tr><th>Latest</th>{keys.map((k) => <th key={k}>{k}</th>)}</tr></thead>
        <tbody>
          {latest.map((p) => <tr key={p.pollster}><td>{p.pollster} <small>{p.date}</small></td>{keys.map((k) => <td key={k} className="mono">{p[k]}</td>)}</tr>)}
          <tr className="nz-avg"><td>Average</td>{keys.map((k) => <td key={k} className="mono">{avg[k].toFixed(1)}</td>)}</tr>
        </tbody>
      </table>
    </div>
  );
}

function Markets() {
  const m = usePolymarket();
  if (!m) return <div className="nz-note">Loading Polymarket…</div>;
  if (!m.length) return <div className="nz-note">Polymarket unavailable right now.</div>;
  return (
    <div className="stack" style={{ gap: 14 }}>
      {m.map((x) => (
        <div key={x.slug}>
          <a href={`https://polymarket.com/event/${x.slug}`} target="_blank" rel="noreferrer" className="nz-mk__t">{x.title}</a>
          <ul className="nz-mk">
            {x.outcomes.map((o) => <li key={o.label}><span>{o.label}</span><span className="nz-mk__b"><span style={{ width: `${o.p * 100}%` }} /></span><b className="mono">{Math.round(o.p * 100)}%</b></li>)}
          </ul>
          <small className="nz-dim">${Math.round(x.volume).toLocaleString()} volume</small>
        </div>
      ))}
    </div>
  );
}

function News() {
  const items = useNzNews();
  const ref = useRef<HTMLUListElement>(null);
  if (!items) return <div className="nz-note">Loading headlines…</div>;
  if (!items.length) return <div className="nz-note">No headlines available right now.</div>;
  return (
    <ul className="nz-news" ref={ref}>
      {items.slice(0, 14).map((i) => (
        <li key={i.id}><a href={i.url} target="_blank" rel="noreferrer">{i.title}</a><small>{i.source} · {fmtTime(i.publishedAt)}</small></li>
      ))}
    </ul>
  );
}

export { PARTIES };
