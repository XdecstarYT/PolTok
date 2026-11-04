import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BalanceBar, Button, Card, Chip, EmptyState, Needle, SectionHeader, Skeleton, Tabs, fmtTime, tzAbbr, useReducedMotion } from '../../components';
import { PARTY_HEX } from '../../lib/format';
import { useSettings } from '../../lib/settings';
import { USMap } from '../map/USMap';
import type { BalanceOfPower } from '../../types';
import { NYT_CREDIT, atTime, loadOverview, loadRaceDetail, type Chamber, type NRace, type Overview, type RaceDetail } from './nyt';
import { TimeChart } from './charts';
import './analysis.css';

const SPEEDS = [
  { x: 120, label: '2 min/s' },
  { x: 600, label: '10 min/s' },
  { x: 1800, label: '30 min/s' },
];
const MARQUEE = ['GA-SEN', 'MI-SEN', 'NC-SEN', 'ME-SEN', 'TX-SEN', 'OH-SEN-S', 'IA-SEN', 'AK-SEN', 'NH-SEN', 'MI-GOV', 'GA-GOV', 'AZ-GOV'];
const pc = (p: string) => (PARTY_HEX as Record<string, string>)[p] ?? '#8b93a7';

export default function ReplayPage() {
  useSettings(); // re-render on time-zone change
  const [ov, setOv] = useState<Overview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    loadOverview().then(setOv, (e) => setErr(String(e?.message ?? e)));
  }, []);

  if (err) return <div className="page"><EmptyState title="Couldn’t load the NYT results feed" description={err} /></div>;
  if (!ov) return <div className="page an"><Skeleton height={40} width={320} /><Skeleton height={420} style={{ marginTop: 16 }} /></div>;
  return <Replay ov={ov} />;
}

function Replay({ ov }: { ov: Overview }) {
  const calls = useMemo(() => ov.races.filter((r) => r.winner).sort((a, b) => a.winner!.at - b.winner!.at), [ov]);
  const t0 = useMemo(() => {
    const first = Math.min(...ov.pollCloses.map((p) => p.at), calls[0]?.winner!.at ?? Infinity, ov.model[0]?.t ?? Infinity);
    return Math.floor((first - 15 * 60e3) / 60e3) * 60e3;
  }, [ov, calls]);
  const t1 = useMemo(() => Math.max(calls.at(-1)?.winner!.at ?? 0, ov.model.at(-1)?.t ?? 0) + 5 * 60e3, [ov, calls]);

  const [t, setT] = useState(t0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(600);
  const reduce = useReducedMotion();
  const last = useRef<number | null>(null);
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const step = (now: number) => {
      const dt = last.current == null ? 0 : now - last.current;
      last.current = now;
      setT((cur) => {
        const n = cur + dt * speed;
        if (n >= t1) {
          setPlaying(false);
          return t1;
        }
        return n;
      });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      last.current = null;
    };
  }, [playing, speed, t1]);

  const toggle = useCallback(() => {
    setPlaying((p) => {
      if (!p && t >= t1) setT(t0);
      return !p;
    });
  }, [t, t0, t1]);
  const jump = useCallback((dir: 1 | -1) => {
    setT((cur) => {
      if (dir > 0) return calls.find((c) => c.winner!.at > cur + 500)?.winner!.at ?? t1;
      const prev = [...calls].reverse().find((c) => c.winner!.at < cur - 500);
      return prev?.winner!.at ?? t0;
    });
  }, [calls, t0, t1]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.key === ' ') (e.preventDefault(), toggle());
      else if (e.key === 'ArrowRight' && e.shiftKey) jump(1);
      else if (e.key === 'ArrowLeft' && e.shiftKey) jump(-1);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [toggle, jump]);

  const done = useMemo(() => calls.filter((c) => c.winner!.at <= t), [calls, t]);
  const model = atTime(ov.model, t);

  const bal = (ch: 'senate' | 'house'): BalanceOfPower => {
    const mine = done.filter((c) => c.chamber === ch);
    const n = (p: string) => mine.filter((c) => c.winner!.party === p).length;
    const base = ch === 'senate' ? ov.senateBase : { D: 0, R: 0, O: 0, total: 435, toWin: 218 };
    const dem = base.D + n('D'), rep = base.R + n('R'), ind = base.O + n('I') + n('O');
    const m = ch === 'senate' ? model?.S : model?.H;
    return {
      chamber: ch, total: base.total, majority: base.toWin, dem, rep, ind, undecided: Math.max(0, base.total - dem - rep - ind),
      projected: m ? { dem: m.D, rep: m.R } : undefined, controlProb: m ? { D: m.pD, R: 1 - m.pD } : undefined,
    };
  };

  const [mapCh, setMapCh] = useState<Chamber>('senate');
  const fills = useMemo(() => {
    const f: Record<string, string> = {};
    for (const r of ov.races) {
      if (r.chamber !== mapCh || r.chamber === 'house') continue;
      if (r.winner && r.winner.at <= t) f[r.state] = pc(r.winner.party);
      else if (!f[r.state]) f[r.state] = '#3a3f52';
    }
    return f;
  }, [ov, mapCh, t]);
  const fresh = useMemo(() => done.filter((c) => c.chamber === mapCh && t - c.winner!.at < 20 * 60e3).map((c) => c.state), [done, mapCh, t]);

  const [feedCh, setFeedCh] = useState<'all' | Chamber>('all');
  const feed = useMemo(() => done.filter((c) => feedCh === 'all' || c.chamber === feedCh).slice(-60).reverse(), [done, feedCh]);
  const latestInsight = useMemo(() => [...ov.insights].reverse().find((i) => i.at <= t && i.kind !== 'first-results'), [ov, t]);

  const modelSeries = useMemo(() => {
    const mk = (ch: 'S' | 'H') => ov.model.filter((m) => m[ch]).map((m) => ({ t: m.t, v: m[ch]!.pD * 100 }));
    return [
      { key: 's', label: 'Senate: Dem control chance', color: PARTY_HEX.D, pts: mk('S') },
      { key: 'h', label: 'House: Dem control chance', color: '#9aa6ff', pts: mk('H'), dash: '5 3' },
    ];
  }, [ov]);

  const pct = ((t - t0) / (t1 - t0)) * 100;
  const z = tzAbbr(t);

  return (
    <div className="page an">
      <SectionHeader
        kicker="Election night · Nov 3–4, 2026"
        title="Relive election night"
        sub={<>Every AP race call, in order, at the moment it landed — with the NYT model’s live chamber forecast. Times in {z}.</>}
        action={<Link to="/analysis" className="an-link">What happened →</Link>}
      />

      <div className="an-player card" role="group" aria-label="Replay controls">
        <div className="an-clock">
          <span className="an-clock__t num">{fmtTime(t)}</span>
          <span className="an-clock__z">{z}</span>
          <span className="faint num an-clock__n">{done.length} / {calls.length} calls</span>
        </div>
        <div className="an-ctrls">
          <Button size="sm" variant="ghost" onClick={() => jump(-1)} aria-label="Previous call">⏮</Button>
          <Button size="sm" variant="accent" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>{playing ? '❚❚ Pause' : t >= t1 ? '↺ Replay' : '▶ Play'}</Button>
          <Button size="sm" variant="ghost" onClick={() => jump(1)} aria-label="Next call">⏭</Button>
          <div className="an-speeds" role="radiogroup" aria-label="Playback speed">
            {SPEEDS.map((s) => (
              <button key={s.x} role="radio" aria-checked={speed === s.x} className={`an-speed ${speed === s.x ? 'is-on' : ''}`} onClick={() => setSpeed(s.x)}>{s.label}</button>
            ))}
          </div>
        </div>
        <div className="an-scrub">
          <div className="an-scrub__ticks" aria-hidden="true">
            {calls.map((c) => (
              <i key={c.nytId} className={c.chamber === 'house' ? 'is-h' : ''} style={{ left: `${((c.winner!.at - t0) / (t1 - t0)) * 100}%`, background: pc(c.winner!.party), opacity: c.winner!.at <= t ? 1 : 0.35 }} />
            ))}
          </div>
          <input
            type="range" min={t0} max={t1} step={30e3} value={t} aria-label="Time of night" aria-valuetext={`${fmtTime(t)} ${z}`}
            onChange={(e) => (setT(Number(e.target.value)), setPlaying(false))}
            style={{ ['--p' as string]: `${pct}%` }}
          />
          <div className="an-scrub__ends faint num"><span>{fmtTime(t0)}</span><span>{fmtTime(t1)} {z}</span></div>
        </div>
        <p className="an-hint faint">Space = play/pause · Shift+←/→ = previous/next call</p>
      </div>

      {latestInsight && (
        <div className="an-insight" aria-live={reduce ? 'off' : 'polite'}>
          <span className="kicker">NYT · {fmtTime(latestInsight.at)}</span> {latestInsight.text}
        </div>
      )}

      <div className="an-grid an-grid--replay">
        <Card title="Balance of power — called seats" kicker="AP calls + seats not up">
          <div className="stack" style={{ gap: 18 }}>
            <BalanceBar balance={bal('senate')} title="Senate" />
            <BalanceBar balance={bal('house')} title="House" />
          </div>
          <p className="an-note">Bars count AP-called races up to {fmtTime(t)} plus Senate seats not on the ballot. Faint projections are the NYT model’s seat estimate at that moment.</p>
        </Card>

        <Card title="Race calls map" action={<Tabs variant="pill" ariaLabel="Map chamber" value={mapCh} onChange={(v) => setMapCh(v as Chamber)} tabs={[{ id: 'senate', label: 'Senate' }, { id: 'governor', label: 'Governor' }]} />}>
          <USMap fills={fills} highlight={fresh} labels title={`${mapCh === 'senate' ? 'Senate' : 'Governor'} calls at ${fmtTime(t)}`}
            describe={(a) => {
              const r = ov.races.find((x) => x.chamber === mapCh && x.state === a && x.winner && x.winner.at <= t);
              return r ? `${r.winner!.name} (${r.winner!.party}) called at ${fmtTime(r.winner!.at)}` : fills[a] ? 'not yet called' : 'no race';
            }}
            renderTooltip={(a) => {
              const rs = ov.races.filter((x) => x.chamber === mapCh && x.state === a);
              if (!rs.length) return <span>No {mapCh} race</span>;
              return rs.map((r) => (
                <div key={r.nytId}><b>{r.label}</b><br />{r.winner && r.winner.at <= t ? <>{r.winner.name} ({r.winner.party}) · called {fmtTime(r.winner.at)}{r.flipped ? ' · FLIP' : ''}</> : 'Not yet called'}</div>
              ));
            }}
          />
          <div className="an-legend"><span><i style={{ background: PARTY_HEX.D }} /> Dem call</span><span><i style={{ background: PARTY_HEX.R }} /> Rep call</span><span><i style={{ background: '#3a3f52' }} /> Not yet called</span><span>Glow = called in last 20 min</span></div>
        </Card>

        <Card title="Call log" className="an-feedcard" action={<Tabs variant="pill" ariaLabel="Call log filter" value={feedCh} onChange={(v) => setFeedCh(v as 'all' | Chamber)} tabs={[{ id: 'all', label: 'All' }, { id: 'senate', label: 'Sen' }, { id: 'governor', label: 'Gov' }, { id: 'house', label: 'House' }]} />}>
          {feed.length === 0 ? <p className="faint">No calls yet. Press play.</p> : (
            <ol className="an-feed">
              {feed.map((c) => (
                <li key={c.nytId}>
                  <span className="num faint an-feed__t">{fmtTime(c.winner!.at)}</span>
                  <i className="an-dot" style={{ background: pc(c.winner!.party) }} aria-hidden="true" />
                  <span className="an-feed__body"><Link to={`/race/${c.id}`}>{c.label}</Link> — {c.winner!.name} ({c.winner!.party}){c.flipped && <Chip tone={c.winner!.party === 'D' ? 'dem' : 'rep'}>FLIP</Chip>}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card title="NYT model: chance of chamber control" kicker="Over the night">
          <TimeChart series={modelSeries} t0={t0} t1={t1} cursor={t} yMin={0} yMax={100} refY={50} fmtY={(v) => `${Math.round(v)}%`} label="NYT model Democratic control probability over election night" onSeek={(x) => (setT(x), setPlaying(false))} />
          <div className="an-needles">
            <Needle demProb={model?.S?.pD} label="Senate control" size={200} jitter={false} />
            <Needle demProb={model?.H?.pD} label="House control" size={200} jitter={false} />
          </div>
          {!model && <p className="an-note">The NYT model had not published yet at this time.</p>}
        </Card>

        <MarqueeNeedle races={ov.races} t={t} t0={t0} t1={t1} onSeek={(x) => (setT(x), setPlaying(false))} />
      </div>
      <p className="an-credit">{NYT_CREDIT}. Call times are AP’s “winner accepted” timestamps; model data is the NYT needle’s published history.</p>
    </div>
  );
}

function MarqueeNeedle({ races, t, t0, t1, onSeek }: { races: NRace[]; t: number; t0: number; t1: number; onSeek: (t: number) => void }) {
  const options = useMemo(() => MARQUEE.map((id) => races.find((r) => r.id === id && r.slug)).filter(Boolean) as NRace[], [races]);
  const [sel, setSel] = useState(options[0]?.id ?? '');
  const race = options.find((o) => o.id === sel);
  const [det, setDet] = useState<RaceDetail | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    if (!race?.slug) return;
    let alive = true;
    setDet(null);
    setErr(false);
    loadRaceDetail(race.slug, race.special).then((d) => alive && setDet(d), () => alive && setErr(true));
    return () => {
      alive = false;
    };
  }, [race?.slug, race?.special]);
  const pt = det ? atTime(det.points, t) : undefined;
  const final = det?.points.at(-1);
  const series = useMemo(() => (det ? [{ key: 'p', label: `${det.dName ?? 'Dem'} win chance`, color: PARTY_HEX.D, pts: det.points.filter((p) => p.pD != null).map((p) => ({ t: p.t, v: p.pD! * 100 })) }] : []), [det]);
  return (
    <Card title="Marquee race needle" className="an-marquee" action={
      <select className="an-select" value={sel} onChange={(e) => setSel(e.target.value)} aria-label="Choose race">
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    }>
      {err ? <p className="faint">Couldn’t load this race’s file.</p> : !det ? <Skeleton height={220} /> : (
        <div className="an-mq">
          <Needle demProb={pt?.pD} label={race?.label} size={220} jitter={false} demLabel={det.dName?.split(' ').at(-1)?.toUpperCase() ?? 'DEM'} repLabel={det.rName?.split(' ').at(-1)?.toUpperCase() ?? 'REP'} />
          <div className="an-mq__nums">
            {pt ? (
              <>
                <div><span className="faint">Votes counted</span> <b className="num">{pt.votes.toLocaleString()}</b>{final?.votes ? <span className="faint num"> ({Math.round((pt.votes / final.votes) * 100)}% of latest count)</span> : null}</div>
                <div><i className="an-dot" style={{ background: PARTY_HEX.D }} /> {det.dName} <b className="num">{pt.shareD?.toFixed(1)}%</b></div>
                <div><i className="an-dot" style={{ background: PARTY_HEX.R }} /> {det.rName} <b className="num">{pt.shareR?.toFixed(1)}%</b></div>
                {race?.winner && race.winner.at <= t && <Chip tone={race.winner.party === 'D' ? 'dem' : 'rep'}>AP CALL {fmtTime(race.winner.at)}</Chip>}
              </>
            ) : <p className="faint">No votes reported yet at {fmtTime(t)}.</p>}
          </div>
          <TimeChart series={series} t0={t0} t1={t1} cursor={t} yMin={0} yMax={100} refY={50} height={140} fmtY={(v) => `${Math.round(v)}%`} label={`${race?.label} NYT model win probability over the night`} onSeek={onSeek} />
        </div>
      )}
    </Card>
  );
}
