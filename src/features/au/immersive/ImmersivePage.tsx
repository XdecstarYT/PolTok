/** /au/victoria/immersive — "Immersive Mode": a full-screen 3D Victoria with a Liquid Glass HUD.
 *  Live data from /api/vic/live (polls + 2022 pendulum); the swing slider re-runs the uniform swing on the client. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSeo } from '../../../lib/seo';
import '../../../lib/liquidGlass';
import { Countdown, useReducedMotion } from '../../../components';
import { useVicLive, vicColor, VIC_NAME, type VicSeatProj } from '../vicLive';
import { createImmersive, type District, type Immersive } from './scene';
import './immersive.css';

const VIC_CLOSE = Date.parse('2026-11-28T18:00:00+11:00');
type Geo = { features: { properties: { id: string; name: string }; geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown } }[] };

/** uniform swing (+ = towards the Coalition) applied to the 2022 pendulum */
function project(seats: Record<string, VicSeatProj>, swing: number) {
  const out: Record<string, string> = {};
  for (const [id, s] of Object.entries(seats)) {
    let w = s.win2022;
    if (swing > 0 && s.win2022 === 'ALP' && s.vs === 'LNP' && s.margin < swing) w = 'LNP';
    if (swing < 0 && s.win2022 === 'LNP' && s.vs === 'ALP' && s.margin < -swing) w = 'ALP';
    out[id] = w;
  }
  return out;
}

export default function ImmersivePage() {
  useSeo({ title: 'Immersive Mode · Victoria 2026', description: 'Fly through a 3D Victoria: all 88 districts, live polls, and a swing slider that flips seats in real time.' });
  const nav = useNavigate();
  const reduced = useReducedMotion();
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<Immersive | null>(null);
  const { data, error } = useVicLive();
  const [geo, setGeo] = useState<Geo | null>(null);
  const [geoErr, setGeoErr] = useState(false);
  const [swing, setSwing] = useState<number | null>(null);
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [touring, setTouring] = useState(false);
  const [labels, setLabels] = useState<{ key: string; label: string; x: number; y: number; visible: boolean }[]>([]);
  const [webgl, setWebgl] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => { fetch('/geo/vic-districts.json').then((r) => r.json()).then(setGeo).catch(() => setGeoErr(true)); }, []);
  useEffect(() => { if (data?.projection && swing == null) setSwing(data.projection.swing); }, [data, swing]);
  useEffect(() => {
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') nav('/au/victoria'); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [nav]);

  const seats = data?.projection?.seats;
  const now = useMemo(() => (seats && swing != null ? project(seats, swing) : null), [seats, swing]);
  const tally = useMemo(() => { const o: Record<string, number> = {}; for (const w of Object.values(now ?? {})) o[w] = (o[w] ?? 0) + 1; return o; }, [now]);

  // build the scene once geo + polls are in
  useEffect(() => {
    if (!geo || !data?.polls || !host.current || api.current) return;
    try { const c = document.createElement('canvas'); if (!(c.getContext('webgl2') || c.getContext('webgl'))) { setWebgl(false); return; } } catch { setWebgl(false); return; }
    const districts: District[] = geo.features.map((f) => ({
      id: f.properties.id, name: f.properties.name,
      rings: (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates) as [number, number][][][],
    }));
    const a = data.polls.average;
    const pillars = (['LNP', 'ONP', 'ALP', 'GRN'] as const).map((k) => ({ key: k, label: `${VIC_NAME[k]} ${a[k]}%`, value: a[k], color: vicColor(k) }));
    api.current = createImmersive(host.current, districts, pillars, {
      reduced,
      onHover: (id, x, y) => setHover(id ? { id, x, y } : null),
      onPick: (id) => { setPicked(id); setTouring(false); },
    });
    setReady(true);
    return () => { api.current?.dispose(); api.current = null; setReady(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo, !!data?.polls]);

  // push colours/heights whenever the swing changes
  useEffect(() => {
    if (!api.current || !seats || !now) return;
    const m: Record<string, { color: string; changed: boolean; height: number }> = {};
    for (const [id, s] of Object.entries(seats)) m[id] = { color: vicColor(now[id]), changed: now[id] !== s.win2022, height: 0.07 + Math.min(s.margin, 30) * 0.006 };
    api.current.setSeats(m);
  }, [seats, now, ready]);

  // pillar labels follow the 3D pillars
  useEffect(() => {
    let raf = 0;
    const tick = () => { raf = requestAnimationFrame(tick); if (api.current) setLabels(api.current.pillarScreen()); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // auto tour through the leaders' seats + the knife's edge
  useEffect(() => {
    if (!touring || !ready || !data?.projection) return;
    const stops = ['vic-niddrie', 'vic-kew', ...data.projection.edge.map((e) => e.id)].filter((id, i, a) => a.indexOf(id) === i).slice(0, 7);
    let i = 0;
    const go = () => { const id = stops[i % stops.length]; api.current?.focusSeat(id); setPicked(id); i++; };
    go();
    const t = setInterval(go, 4200);
    return () => clearInterval(t);
  }, [touring, data, ready]);

  const sel = picked && seats?.[picked] ? { id: picked, ...seats[picked], now: now?.[picked] ?? seats[picked].win2022 } : null;
  const hv = hover && seats?.[hover.id] ? { ...seats[hover.id], now: now?.[hover.id] } : null;
  const P = data?.projection;
  const sw = swing ?? 0;
  const order = ['LNP', 'GRN', 'ALP'].filter((k) => tally[k]);

  return (
    <div className="im" data-reduced={reduced || undefined}>
      <div ref={host} className="im-canvas" aria-label="3D map of Victoria's 88 electoral districts" role="img" />
      {(!webgl || geoErr) && <div className="im-fallback lg"><b>Immersive Mode needs WebGL.</b><p>Your browser couldn't start the 3D view. The full dashboard is on the <Link to="/au/victoria">Victoria page</Link>.</p></div>}
      {!ready && !geoErr && webgl && <div className="im-loading"><span className="im-loading__ring" /><span>Building Victoria…</span></div>}

      {/* top bar */}
      <header className="im-top">
        <div className="lg im-title">
          <span className="im-badge">Immersive Mode</span>
          <h1>Victoria <em>2026</em></h1>
          <p className="im-sub">Polls close in <b><Countdown to={VIC_CLOSE} compact doneLabel="— counting" /></b></p>
        </div>
        <Link to="/au/victoria" className="lg lg--pill im-exit" aria-label="Exit Immersive Mode">✕ <span>Exit</span></Link>
      </header>

      {/* pillar labels */}
      {labels.map((l) => l.visible && (
        <span key={l.key} className="lg lg--pill im-plabel" style={{ transform: `translate(${l.x}px, ${l.y}px) translate(-50%, -100%)`, ['--c' as string]: vicColor(l.key) }}>
          <i />{l.label}
        </span>
      ))}

      {/* hover tooltip */}
      {hv && hover && !sel && (
        <div className="lg lg--tight im-tip" style={{ left: hover.x + 16, top: hover.y + 16 }}>
          <b>{hv.name}</b>
          <span>2022: {VIC_NAME[hv.win2022] ?? hv.win2022} by {hv.margin}%</span>
          {hv.now && hv.now !== hv.win2022 && <span style={{ color: vicColor(hv.now) }}>→ {VIC_NAME[hv.now] ?? hv.now} gain</span>}
        </div>
      )}

      {/* selected seat card */}
      {sel && (
        <aside className="lg im-card" aria-live="polite">
          <button type="button" className="im-card__x" onClick={() => { setPicked(null); setTouring(false); api.current?.flyHome(); }} aria-label="Close seat card">✕</button>
          <span className="im-badge" style={{ background: vicColor(sel.now) }}>{sel.now !== sel.win2022 ? `${VIC_NAME[sel.now] ?? sel.now} gain` : `${VIC_NAME[sel.now] ?? sel.now} hold`}</span>
          <h2>{sel.name}</h2>
          {sel.id === 'vic-niddrie' && <p className="im-card__who">Premier Ben Carroll's seat</p>}
          {sel.id === 'vic-kew' && <p className="im-card__who">Opposition Leader Jess Wilson's seat</p>}
          <dl>
            <div><dt>2022 winner</dt><dd style={{ color: vicColor(sel.win2022) }}>{VIC_NAME[sel.win2022] ?? sel.win2022}</dd></div>
            <div><dt>Margin</dt><dd>{sel.margin}% v {VIC_NAME[sel.vs] ?? sel.vs}</dd></div>
            <div><dt>At {Math.abs(sw)}-pt swing</dt><dd style={{ color: vicColor(sel.now) }}>{VIC_NAME[sel.now] ?? sel.now}</dd></div>
          </dl>
          <Link to={`/au/seat/${sel.id}`} className="lg lg--pill lg-btn">Seat page →</Link>
        </aside>
      )}

      {/* bottom HUD */}
      <footer className="im-hud">
        <div className="lg im-panel im-seats">
          <div className="im-seats__nums">
            {order.map((k) => <span key={k}><b className="num" style={{ color: vicColor(k) }}>{tally[k]}</b><small>{VIC_NAME[k]}</small></span>)}
          </div>
          <div className="im-seatbar" role="img" aria-label={order.map((k) => `${VIC_NAME[k]} ${tally[k]}`).join(', ') + '. 45 for a majority.'}>
            {order.map((k) => <span key={k} style={{ flex: tally[k], background: vicColor(k) }} />)}
            <i style={{ left: `${(45 / 88) * 100}%` }} />
          </div>
          <label className="im-slider">
            <span className="im-slider__lab">Two-party swing <b>{sw > 0 ? `${sw} to Coalition` : sw < 0 ? `${-sw} to Labor` : 'none'}</b>{P && Math.abs(sw - P.swing) < 0.05 ? <em> · polls now</em> : null}</span>
            <input type="range" min={-6} max={20} step={0.5} value={sw} onChange={(e) => setSwing(+e.target.value)} aria-label="Two-party swing from 2022" />
          </label>
          {P && <button type="button" className="im-link" onClick={() => setSwing(P.swing)}>Reset to the polls ({P.swing} pts)</button>}
        </div>
        <div className="lg im-panel im-actions">
          <button type="button" className="lg lg--pill lg-btn" onClick={() => { setTouring(false); setPicked(null); api.current?.flyHome(); }}>🗺️ Whole state</button>
          <button type="button" className="lg lg--pill lg-btn" onClick={() => { setTouring(false); setPicked(null); api.current?.flyMelbourne(); }}>🏙️ Melbourne</button>
          <button type="button" className={`lg lg--pill lg-btn${touring ? ' is-on' : ''}`} onClick={() => setTouring((v) => !v)} aria-pressed={touring}>{touring ? '⏸ Stop tour' : '▶ Key seats tour'}</button>
        </div>
      </footer>
      {error && !data && <div className="lg im-fallback"><b>Live data unavailable.</b><p>Try again in a minute.</p></div>}
      <p className="im-note">Uniform-swing illustration on the 2022 pendulum, not a forecast. One Nation and independents aren't modelled. Drag to orbit · scroll to zoom · tap a district.</p>
    </div>
  );
}
