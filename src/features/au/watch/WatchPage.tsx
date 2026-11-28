/** /au/victoria/watch — PolTok WATCH: a full-screen broadcast for the TV or second screen. Rotating segments on the main
 *  stage, a live parliament + feed rail, a bottom crawl and a "seat called" flash when the VEC count calls a seat.
 *  Before 6pm it runs the pre-show (model, Premier race, seats to watch); from 6pm, real VEC results only.
 *  Keys: ← → change segment · Space pause · F fullscreen · M sound. */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useNow } from '../../../components';
import { PersonAvatar } from '../../../components/PersonAvatar';
import { useSeo } from '../../../lib/seo';
import { useAuResults, type AuResults, type SeatResult } from '../api';
import { partyKey } from '../model';
import { VIC_NAME, useVicLive, vicColor, type VicLive } from '../vicLive';
import { candidates, personFor, seatById, type Person } from '../parliament/people';
import { Hemicycle } from '../parliament/components';
import { ProfileHost } from '../parliament/Profile';
import { liveOdds } from '../live/liveModel';
import './watch.css';

const VIC_CLOSE = Date.parse('2026-11-28T18:00:00+11:00');
const SEG_MS = 14000;
const grp = (p?: string | null) => { if (!p) return 'OTH'; const k = partyKey(p); return ['LIB', 'NAT', 'LNP'].includes(k) ? 'LNP' : ['ALP', 'GRN', 'ONP', 'IND'].includes(k) ? k : 'OTH'; };
const ORDER = ['LNP', 'ONP', 'IND', 'OTH', 'GRN', 'ALP'];
const name = (id: string) => seatById.get(id)?.name ?? id.replace(/^vic-/, '');
const pct = (x: number) => (x >= 0.995 ? '>99%' : x <= 0.005 ? '<1%' : `${Math.round(x * 100)}%`);
type Ev = { at: number; id: string; kind: 'first' | 'lead' | 'called'; party: string; prev?: string | null };

/* ── small pieces ── */
function Face({ p, size, c }: { p: Person | null; size: number; c: string }) {
  return p ? <PersonAvatar name={p.name} color={c} lookup={{ name: p.name, scope: 'au' }} size={size} /> : <span className="wt-noface" style={{ width: size, height: size, background: c }} />;
}
function Race({ tally, striped }: { tally: Record<string, { won: number; lead: number }>; striped?: boolean }) {
  const used = Object.values(tally).reduce((a, v) => a + v.won + v.lead, 0);
  return (
    <div className="wt-race">
      {ORDER.filter((k) => tally[k]).map((k) => (
        <span key={k} style={{ flexGrow: tally[k].won + tally[k].lead, ['--c' as string]: vicColor(k) } as CSSProperties}>
          {tally[k].won > 0 && <i className="won" style={{ flexGrow: tally[k].won }} />}
          {tally[k].lead > 0 && <i className={striped ? 'lead lead--model' : 'lead'} style={{ flexGrow: tally[k].lead }} />}
        </span>
      ))}
      {used < 88 && <span className="wt-race__rest" style={{ flexGrow: 88 - used }} />}
      <b className="wt-race__45"><em>45</em></b>
    </div>
  );
}
function Chime(on: boolean) {
  return () => {
    if (!on) return;
    try {
      const A = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      [880, 1320].forEach((f, i) => { const o = A.createOscillator(), g = A.createGain(); o.frequency.value = f; o.type = 'sine'; g.gain.setValueAtTime(0.0001, A.currentTime + i * 0.12); g.gain.exponentialRampToValueAtTime(0.18, A.currentTime + i * 0.12 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, A.currentTime + i * 0.12 + 0.6); o.connect(g).connect(A.destination); o.start(A.currentTime + i * 0.12); o.stop(A.currentTime + i * 0.12 + 0.7); });
    } catch { /* no audio */ }
  };
}

/* ── segments ── */
type Ctx = { data: VicLive | null; res: AuResults | null; live: boolean; now: number; events: Ev[] };

function SegTally({ data, res, live }: Ctx) {
  const tally: Record<string, { won: number; lead: number }> = {};
  if (live) for (const s of Object.values(res!.seats)) { const p = s.called ?? s.leader; if (!p) continue; const k = grp(p); tally[k] ??= { won: 0, lead: 0 }; tally[k][s.called ? 'won' : 'lead']++; }
  else if (data?.model) for (const [k, r] of Object.entries(data.model.range)) if (r.median > 0) tally[k] = { won: 0, lead: Math.round(r.median) };
  const rows = Object.entries(tally).sort((a, b) => b[1].won + b[1].lead - (a[1].won + a[1].lead));
  return (
    <div className="wt-seg">
      <span className="wt-kick">{live ? 'Seats won + leading' : 'Pre-show · PolTok model median seats'}</span>
      <h2 className="wt-h">Race to <em>45</em></h2>
      <Race tally={tally} striped={!live} />
      <div className="wt-tally">
        {rows.slice(0, 5).map(([k, v], i) => (
          <m.div key={k} className="wt-tally__p" style={{ ['--c' as string]: vicColor(k) } as CSSProperties} initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 + i * 0.08 }}>
            <b className="num">{v.won + v.lead}</b><span>{VIC_NAME[k] ?? k}</span>{live && <small>{v.won} won · {v.lead} ahead</small>}
          </m.div>
        ))}
      </div>
      {!live && <p className="wt-note">Striped = model projection. Solid bars arrive as the VEC calls seats tonight.</p>}
    </div>
  );
}

function SegOdds({ data, res, live }: Ctx) {
  const odds = useMemo(() => (data?.model ? (live ? liveOdds(data.model, res) : { majority: data.model.majority }) : null), [data, res, live]);
  if (!odds) return null;
  const items = [{ k: 'LNP', label: 'Coalition majority', v: odds.majority.LNP }, { k: 'hung', label: 'Hung parliament', v: odds.majority.hung }, { k: 'ALP', label: 'Labor majority', v: odds.majority.ALP }];
  return (
    <div className="wt-seg">
      <span className="wt-kick">{live ? 'PolTok live model · updates with every count' : 'Pre-show · PolTok model'}</span>
      <h2 className="wt-h">Who forms <em>government?</em></h2>
      <div className="wt-odds">
        {items.map((x, i) => (
          <m.div key={x.k} className="wt-odds__c" style={{ ['--c' as string]: x.k === 'hung' ? '#b9bcc6' : vicColor(x.k) } as CSSProperties} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1 + i * 0.12, type: 'spring' }}>
            <svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" className="bg" /><m.circle cx="60" cy="60" r="52" className="fg" strokeDasharray={2 * Math.PI * 52} initial={{ strokeDashoffset: 2 * Math.PI * 52 }} animate={{ strokeDashoffset: 2 * Math.PI * 52 * (1 - x.v) }} transition={{ duration: 1.4, delay: 0.3 + i * 0.12 }} /></svg>
            <b className="num">{pct(x.v)}</b><span>{x.label}</span>
          </m.div>
        ))}
      </div>
    </div>
  );
}

function SegSpotlight({ data, res, live, now }: Ctx) {
  const model = data?.model;
  const list = useMemo(() => {
    if (live) return Object.entries(res!.seats).filter(([, s]) => !s.called && s.tcp && s.tcp.length >= 2).sort((a, b) => Math.abs(a[1].tcp![0].pct - a[1].tcp![1].pct) - Math.abs(b[1].tcp![0].pct - b[1].tcp![1].pct)).slice(0, 6).map(([id]) => id);
    return model ? Object.entries(model.seats).sort((a, b) => Math.max(...Object.values(a[1].prob)) - Math.max(...Object.values(b[1].prob))).slice(0, 6).map(([id]) => id) : [];
  }, [live, res, model]);
  const id = list[Math.floor(now / 4600) % Math.max(1, list.length)];
  if (!id) return <div className="wt-seg"><span className="wt-kick">Seat spotlight</span><h2 className="wt-h">Waiting for <em>two-candidate counts</em></h2><p className="wt-note">The closest live contests appear here once the VEC publishes two-candidate figures.</p></div>;
  const s: SeatResult | undefined = live ? res!.seats[id] : undefined;
  const sides: { k: string; v: number; label: string }[] = s?.tcp ? s.tcp.slice(0, 2).map((t) => ({ k: grp(t.party), v: t.pct, label: `${t.pct.toFixed(1)}%` })) : Object.entries(model!.seats[id].prob).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k, v]) => ({ k, v: v * 100, label: `${Math.round(v * 100)}% chance` }));
  const total = sides.reduce((a, x) => a + x.v, 0) || 1;
  return (
    <div className="wt-seg">
      <span className="wt-kick">{live ? `Closest contests · ${s?.counted ?? 0}% counted` : 'Seats to watch tonight · model chances'}</span>
      <AnimatePresence mode="wait">
        <m.div key={id} className="wt-spot" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.45 }}>
          <h2 className="wt-h">{name(id)}</h2>
          <div className="wt-spot__duel">
            {sides.map((x, i) => { const p = personFor(id, x.k, model); return (
              <div key={x.k} className={`wt-spot__side ${i ? 'r' : ''}`} style={{ ['--c' as string]: vicColor(x.k) } as CSSProperties}>
                <Face p={p} size={150} c={vicColor(x.k)} />
                <b>{p?.name ?? VIC_NAME[x.k]}</b><span>{VIC_NAME[x.k] ?? x.k}</span><strong className="num">{x.label}</strong>
              </div>); })}
          </div>
          <div className="wt-spot__bar">{sides.map((x) => <m.i key={x.k} style={{ background: vicColor(x.k) }} initial={{ flexGrow: 1 }} animate={{ flexGrow: x.v / total }} transition={{ duration: 1 }} />)}<span /></div>
        </m.div>
      </AnimatePresence>
      <div className="wt-dots">{list.map((x) => <i key={x} className={x === id ? 'on' : ''} />)}</div>
    </div>
  );
}

const LEADERS: [string, string, string][] = [['vic-kew', 'Wilson', 'LNP'], ['vic-niddrie', 'Carroll', 'ALP'], ['vic-pakenham', 'Pickering', 'ONP']];
function SegPremier({ data, res, live }: Ctx) {
  const pref = data?.extra?.preferred?.slice(0, 4) ?? [];
  const avg = (k: 'Carroll' | 'Wilson' | 'Pickering') => { const v = pref.map((p) => p[k]).filter((x): x is number => x != null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; };
  return (
    <div className="wt-seg">
      <span className="wt-kick">{live ? "The leaders' own seats, live" : 'Preferred Premier · average of the latest polls'}</span>
      <h2 className="wt-h">Battle for <em>Premier</em></h2>
      <div className="wt-leaders">
        {LEADERS.map(([seat, k, party], i) => {
          const p = candidates(seat).find((c) => c.name.endsWith(k)) ?? null;
          const r = res?.seats?.[seat];
          const mine = r?.tcp?.find((t) => grp(t.party) === party);
          return (
            <m.div key={k} className="wt-leader" style={{ ['--c' as string]: vicColor(party) } as CSSProperties} initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 + i * 0.12 }}>
              <Face p={p} size={140} c={vicColor(party)} />
              <b>{p?.name ?? k}</b>
              <span>{name(seat)}</span>
              {live ? <strong className="num">{r?.called ? (grp(r.called) === party ? '✓ Re-elected' : '✕ Lost seat') : mine ? `${mine.pct.toFixed(1)}% 2CP` : 'Awaiting count'}</strong>
                : <strong className="num">{avg(k as 'Carroll') ?? '—'}%</strong>}
            </m.div>
          );
        })}
      </div>
    </div>
  );
}

function SegCalls({ events, now }: Ctx) {
  const called = events.filter((e) => e.kind === 'called').slice(0, 8);
  return (
    <div className="wt-seg">
      <span className="wt-kick">Latest calls from the VEC count</span>
      <h2 className="wt-h">Seats <em>decided</em></h2>
      {called.length ? (
        <div className="wt-calls">{called.map((e, i) => (
          <m.div key={`${e.id}${e.at}`} className="wt-call" style={{ ['--c' as string]: vicColor(grp(e.party)) } as CSSProperties} initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}>
            <b>{name(e.id)}</b><span>{VIC_NAME[grp(e.party)] ?? e.party}{e.prev && grp(e.prev) !== grp(e.party) ? <em> GAIN from {VIC_NAME[grp(e.prev)] ?? e.prev}</em> : ' retain'}</span><time>{Math.max(1, Math.round((now - e.at) / 6e4))}m ago</time>
          </m.div>))}</div>
      ) : <p className="wt-note">No seats called yet. Calls land here, and flash full screen, the moment the count settles a seat.</p>}
    </div>
  );
}

function SegPolls({ data }: Ctx) {
  const a = data?.polls?.average;
  if (!a) return null;
  const keys = (['LNP', 'ONP', 'ALP', 'GRN'] as const);
  return (
    <div className="wt-seg">
      <span className="wt-kick">Final poll average · {data!.polls!.averageOf.join(', ')}</span>
      <h2 className="wt-h">Where the polls <em>landed</em></h2>
      <div className="wt-bars">{keys.map((k, i) => (
        <div key={k} className="wt-bar" style={{ ['--c' as string]: vicColor(k) } as CSSProperties}><span>{VIC_NAME[k]}</span><span className="wt-bar__t"><m.i initial={{ width: 0 }} animate={{ width: `${a[k] * 2}%` }} transition={{ duration: 1, delay: i * 0.1 }} /></span><b className="num">{a[k].toFixed(1)}%</b></div>))}
      </div>
      {data!.polls!.tpp && <p className="wt-note">Two-party preferred: Coalition {data!.polls!.tpp.LNP} · Labor {data!.polls!.tpp.ALP}</p>}
    </div>
  );
}

/* ── page ── */
export default function WatchPage() {
  useSeo({ title: 'PolTok WATCH · Victoria 2026 live', description: 'Full-screen election-night broadcast for the Victorian state election: live seats, calls, the race to 45 and the closest contests.' });
  const now = useNow(1000);
  const live0 = now >= VIC_CLOSE;
  const { data } = useVicLive();
  const resQ = useAuResults('vic2026');
  const res = resQ.data ?? null;
  const live = live0 && !!res && res.status !== 'pre-election' && Object.keys(res.seats).length > 0;
  const [events, setEvents] = useState<Ev[]>([]);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [sound, setSound] = useState(false);
  const [flash, setFlash] = useState<Ev | null>(null);
  const seen = useRef<Set<string> | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const t0 = useRef(Date.now());

  useEffect(() => {
    let dead = false;
    const run = () => fetch('/api/vic/events').then((r) => r.json()).then((j) => { if (!dead && Array.isArray(j.events)) setEvents(j.events); }).catch(() => {});
    run(); const t = setInterval(run, 30000); return () => { dead = true; clearInterval(t); };
  }, []);
  // seat-called flash: only for calls that arrive while watching
  const chime = useCallback(Chime(sound), [sound]);
  useEffect(() => {
    if (!res) return;
    const called = Object.entries(res.seats).filter(([, s]) => s.called);
    if (!seen.current) { seen.current = new Set(called.map(([id]) => id)); return; }
    const fresh = called.find(([id]) => !seen.current!.has(id));
    called.forEach(([id]) => seen.current!.add(id));
    if (fresh) { const ev = events.find((e) => e.id === fresh[0] && e.kind === 'called'); setFlash({ at: Date.now(), id: fresh[0], kind: 'called', party: fresh[1].called!, prev: ev?.prev ?? data?.projection?.seats[fresh[0]]?.win2022 ?? null }); chime(); }
  }, [res, events, data, chime]);
  useEffect(() => { if (!flash) return; const t = setTimeout(() => setFlash(null), 7000); return () => clearTimeout(t); }, [flash]);

  const segs = useMemo(() => live
    ? [{ k: 'tally', C: SegTally }, { k: 'spot', C: SegSpotlight }, { k: 'odds', C: SegOdds }, { k: 'calls', C: SegCalls }, { k: 'premier', C: SegPremier }]
    : [{ k: 'tally', C: SegTally }, { k: 'odds', C: SegOdds }, { k: 'spot', C: SegSpotlight }, { k: 'premier', C: SegPremier }, { k: 'polls', C: SegPolls }], [live]);
  useEffect(() => { if (paused) return; const t = setInterval(() => { setI((x) => (x + 1) % segs.length); t0.current = Date.now(); }, SEG_MS); return () => clearInterval(t); }, [paused, segs.length]);
  const go = (d: number) => { setI((x) => (x + d + segs.length) % segs.length); t0.current = Date.now(); };
  const fs = () => { try { if (document.fullscreenElement) document.exitFullscreen(); else root.current?.requestFullscreen?.(); } catch { /* not allowed */ } };
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.target instanceof HTMLInputElement) return; if (e.key === 'ArrowRight') go(1); else if (e.key === 'ArrowLeft') go(-1); else if (e.key === ' ') { e.preventDefault(); setPaused((p) => !p); } else if (e.key === 'f' || e.key === 'F') fs(); else if (e.key === 'm' || e.key === 'M') setSound((s) => !s); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  });

  const seg = segs[i % segs.length];
  const ctx: Ctx = { data, res, live, now, events };
  const left = VIC_CLOSE - now;
  const ids = Object.keys(res?.seats ?? {});
  const counted = ids.length ? ids.reduce((a, id) => a + (res!.seats[id].counted ?? 0), 0) / 88 : 0;
  const liveMap = useMemo(() => { if (!live) return undefined; const o: Record<string, string> = {}; for (const [id, s] of Object.entries(res!.seats)) { const p = s.called ?? s.leader; if (p) o[id] = grp(p); } return o; }, [live, res]);
  const crawl = live
    ? [...events.slice(0, 14).map((e) => `${name(e.id).toUpperCase()}: ${e.kind === 'called' ? `${VIC_NAME[grp(e.party)]} ${e.prev && grp(e.prev) !== grp(e.party) ? `GAIN from ${VIC_NAME[grp(e.prev)]}` : 'RETAIN'}` : e.kind === 'lead' ? `${VIC_NAME[grp(e.party)]} take the lead` : `first figures, ${VIC_NAME[grp(e.party)]} ahead`}`), `${ids.length} of 88 seats reporting · about ${Math.round(counted)}% counted · 45 for a majority`]
    : ['Polls close at 6pm AEDT · results from about 6:30pm', ...(data?.polls ? [`Poll average: Coalition ${data.polls.average.LNP.toFixed(0)} · One Nation ${data.polls.average.ONP.toFixed(0)} · Labor ${data.polls.average.ALP.toFixed(0)} · Greens ${data.polls.average.GRN.toFixed(0)}`] : []), ...(data?.model ? [`PolTok model: ${pct(data.model.majority.LNP)} Coalition majority · ${pct(data.model.majority.hung)} hung parliament`] : []), 'Make your calls before 6pm at poltok.netlify.app', '88 seats · 45 for a majority'];

  return (
    <div className={`wt ${live ? 'is-live' : 'is-pre'}`} ref={root}>
      <div className="wt-aura" aria-hidden="true"><i /><i /><i /></div>
      <header className="wt-top">
        <Link to="/au/victoria" className="wt-logo" aria-label="Back to PolTok"><b>POLTOK</b><span>WATCH</span></Link>
        <span className={`wt-badge ${live ? 'live' : ''}`}><i />{live ? 'LIVE' : left > 0 ? 'PRE-SHOW' : 'POLLS CLOSED'}</span>
        <span className="wt-title">Victorian state election 2026</span>
        <span className="wt-status">{live ? <><b className="num">{ids.length}</b>/88 reporting · <b className="num">{Math.round(counted)}%</b> counted</> : left > 0 ? <>Polls close in <b className="num">{Math.floor(left / 36e5)}:{String(Math.floor((left % 36e5) / 6e4)).padStart(2, '0')}:{String(Math.floor((left % 6e4) / 1e3)).padStart(2, '0')}</b></> : <>Waiting for the first VEC figures</>}</span>
        <time className="wt-clock num">{new Date(now).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', timeZone: 'Australia/Melbourne' })} <small>AEDT</small></time>
        <div className="wt-tools">
          <button type="button" onClick={() => setSound((s) => !s)} aria-pressed={sound} title="Chime on seat calls (M)">{sound ? '🔔' : '🔕'}</button>
          <button type="button" onClick={() => setPaused((p) => !p)} aria-pressed={paused} title="Pause rotation (Space)">{paused ? '▶' : '⏸'}</button>
          <button type="button" onClick={fs} title="Full screen (F)">⛶</button>
          <Link to="/au/victoria/live" title="Exit to the Live Desk">✕</Link>
        </div>
      </header>

      <main className="wt-stage">
        <section className="wt-main" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
          <AnimatePresence mode="wait">
            <m.div key={seg.k + String(live)} className="wt-slide" initial={{ opacity: 0, y: 24, filter: 'blur(6px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -24, filter: 'blur(6px)' }} transition={{ duration: 0.5 }}>
              <seg.C {...ctx} />
            </m.div>
          </AnimatePresence>
          <nav className="wt-nav" aria-label="Segments">
            <button type="button" onClick={() => go(-1)} aria-label="Previous segment">‹</button>
            {segs.map((s, j) => <button key={s.k} type="button" className={j === i % segs.length ? 'on' : ''} onClick={() => { setI(j); t0.current = Date.now(); }} aria-label={`Segment ${j + 1}`}>{j === i % segs.length && !paused && <m.i key={`${i}-${s.k}`} initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: SEG_MS / 1000, ease: 'linear' }} />}</button>)}
            <button type="button" onClick={() => go(1)} aria-label="Next segment">›</button>
          </nav>
        </section>
        <aside className="wt-rail">
          <div className="wt-card">
            <span className="wt-kick">{live ? 'Live parliament · leading or won' : 'Projected parliament'}</span>
            <Hemicycle data={data} view={live ? 'live' : 'model'} live={liveMap} onPick={() => {}} />
          </div>
          <div className="wt-card wt-feed">
            <span className="wt-kick">{live ? 'From the count' : 'Tonight'}</span>
            {live && events.length ? (
              <ul>{events.slice(0, 7).map((e) => (
                <li key={`${e.id}${e.at}${e.kind}`} style={{ ['--c' as string]: vicColor(grp(e.party)) } as CSSProperties}>
                  <time>{new Date(e.at).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', timeZone: 'Australia/Melbourne' })}</time>
                  <span><b>{name(e.id)}</b> {e.kind === 'called' ? 'called' : e.kind === 'lead' ? 'lead change' : 'first figures'} · <em>{VIC_NAME[grp(e.party)]}</em></span>
                </li>))}</ul>
            ) : (
              <ul className="wt-plan"><li><time>6:00</time><span>Polls close</span></li><li><time>~6:30</time><span>First booths report</span></li><li><time>Night</time><span>Election-day votes counted</span></li><li><time>Later</time><span>Early & postal votes added</span></li></ul>
            )}
          </div>
        </aside>
      </main>

      <footer className="wt-crawl" aria-label="News crawl">
        <span className="wt-crawl__tag">{live ? 'RESULTS' : 'TONIGHT'}</span>
        <div className="wt-crawl__track"><div className="wt-crawl__run">{[...crawl, ...crawl].map((t, j) => <span key={j}>{t}<i>◆</i></span>)}</div></div>
      </footer>

      <AnimatePresence>
        {flash && (() => {
          const g = grp(flash.party); const p = personFor(flash.id, g, data?.model); const gain = flash.prev && grp(flash.prev) !== g;
          return (
            <m.div key={flash.id} className="wt-flash" style={{ ['--c' as string]: vicColor(g) } as CSSProperties} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setFlash(null)}>
              <m.div className="wt-flash__sweep" initial={{ x: '-100%' }} animate={{ x: '0%' }} transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }} />
              <m.div className="wt-flash__in" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.3, type: 'spring', stiffness: 180, damping: 16 }}>
                <span className="wt-flash__k">{gain ? 'SEAT GAINED' : 'SEAT CALLED'}</span>
                <Face p={p} size={200} c="#fff" />
                <h2>{name(flash.id)}</h2>
                <p>{p ? `${p.name} · ` : ''}{VIC_NAME[g] ?? flash.party}{gain ? ` gain from ${VIC_NAME[grp(flash.prev)] ?? flash.prev}` : ' retain'}</p>
              </m.div>
            </m.div>
          );
        })()}
      </AnimatePresence>
      <ProfileHost />
    </div>
  );
}
