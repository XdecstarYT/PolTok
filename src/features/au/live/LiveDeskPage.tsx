/** /au/victoria/live — election-night Live Desk. Real VEC results only (via /api/au/results + /api/vic/events); before
 *  polls close it shows the countdown, your followed seats and the pre-election model. */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Card, Countdown, PageHeader, useNow } from '../../../components';
import { PersonAvatar } from '../../../components/PersonAvatar';
import { useSeo } from '../../../lib/seo';
import '../../../lib/liquidGlass';
import { AuNav } from '../AuNav';
import { useAuResults, type AuResults, type SeatResult } from '../api';
import { askNotify, notify, notifyAllowed, notifySupported, useFollowed } from '../follow';
import { partyKey } from '../model';
import { FindSeat } from '../parliament/FindSeat';
import { FollowButton, SeatProfile } from '../parliament/components';
import { personFor, seatById } from '../parliament/people';
import { VIC_NAME, useVicLive, vicColor } from '../vicLive';
import { ProfileHost } from '../parliament/Profile';
import '../au.css';
import './live.css';
import { liveOdds } from './liveModel';
import { Needle, PathTo45, Swingometer, Timeline } from './LiveWidgets';
import { Face } from '../parliament/Profile';
import { Hemicycle } from '../parliament/components';
import { MapPanel, VIC_ZOOMS } from '../MapPanel';
import { VICTORIA } from '../model';

const VIC_CLOSE = Date.parse('2026-11-28T18:00:00+11:00');
const ORDER = ['LNP', 'ONP', 'IND', 'OTH', 'GRN', 'ALP'];
const grp = (p?: string | null) => { if (!p) return 'OTH'; const k = partyKey(p); return ['LIB', 'NAT', 'LNP'].includes(k) ? 'LNP' : ['ALP', 'GRN', 'ONP', 'IND'].includes(k) ? k : 'OTH'; };
type Ev = { at: number; id: string; kind: 'first' | 'lead' | 'called'; party: string; prev?: string | null };
const ago = (t: number, now: number) => { const s = Math.max(0, Math.round((now - t) / 1000)); return s < 60 ? 'just now' : s < 3600 ? `${Math.floor(s / 60)}m ago` : `${Math.floor(s / 3600)}h ago`; };
const lead = (s: SeatResult) => (s.tcp && s.tcp.length >= 2 ? +(s.tcp[0].pct - s.tcp[1].pct).toFixed(1) : null);

function diff(prev: AuResults | null, next: AuResults): Ev[] {
  const out: Ev[] = [], at = Date.now();
  for (const [id, s] of Object.entries(next.seats)) {
    const p = prev?.seats[id];
    if (s.called && s.called !== p?.called) out.push({ at, id, kind: 'called', party: s.called, prev: p?.called ?? p?.leader ?? null });
    else if (!p && s.leader && prev) out.push({ at, id, kind: 'first', party: s.leader });
    else if (p?.leader && s.leader && p.leader !== s.leader && !s.called) out.push({ at, id, kind: 'lead', party: s.leader, prev: p.leader });
  }
  return out;
}

function SeatCard({ id, s, fav, onOpen, model }: { id: string; s?: SeatResult; fav?: string; onOpen: (id: string) => void; model: ReturnType<typeof useVicLive>['data'] }) {
  const g = grp(s?.called ?? s?.leader ?? fav);
  const who = personFor(id, g, model?.model);
  const m = model?.model?.seats[id];
  const upset = s && m && grp(s.called ?? s.leader) !== m.fav;
  return (
    <article className="ld-seat lg" style={{ ['--c' as string]: vicColor(g) } as CSSProperties} onClick={() => onOpen(id)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(id); }}>
      <header>
        {who ? <Face p={who} ctx="ldcard" size={42} color={vicColor(g)} /> : <span className="ld-dot" />}
        <div><b>{seatById.get(id)?.name ?? id}</b><small>{who ? `${who.name} · ${VIC_NAME[g] ?? g}` : VIC_NAME[g] ?? g}</small></div>
        <FollowButton id={id} small />
      </header>
      {s ? (
        <>
          {s.tcp && s.tcp.length >= 2 ? (
            <div className="ld-tcp" aria-label={`${s.tcp.map((t) => `${VIC_NAME[grp(t.party)] ?? t.party} ${t.pct}%`).join(' v ')}`}>
              {s.tcp.map((t) => <span key={t.party} style={{ flex: t.pct, background: vicColor(grp(t.party)) }}><b>{t.pct.toFixed(1)}</b></span>)}
            </div>
          ) : <p className="ld-note">First preferences only · {s.fp?.slice(0, 2).map((f) => `${VIC_NAME[grp(f.party)] ?? f.party} ${f.pct}%`).join(', ')}</p>}
          <footer><span className={`ld-status ${s.called ? 'is-called' : 'is-lead'}`}>{s.called ? `✓ ${VIC_NAME[grp(s.called)] ?? s.called} wins` : `${VIC_NAME[g] ?? g} leads`}</span><span className="faint num">{s.counted <= 100 ? `${s.counted}% counted` : `${s.counted.toLocaleString()} votes`}</span>{upset && <span className="ld-upset">Upset v model</span>}</footer>
        </>
      ) : m ? (
        <footer><span className="ld-status">Model: {VIC_NAME[m.fav] ?? m.fav} {Math.round((m.prob[m.fav] ?? 0) * 100)}%</span><span className="faint">No results yet</span></footer>
      ) : null}
    </article>
  );
}

export default function LiveDeskPage() {
  useSeo({ title: 'Victoria election night: Live Desk', description: 'Live results for the 2026 Victorian election: race to 45, every lead change and call, close seats, upsets and your followed seats.' });
  const now = useNow(15000);
  const res = useAuResults('vic2026');
  const { data } = useVicLive();
  const [followed] = useFollowed();
  const [open, setOpen] = useState<string | null>(null);
  const [alerts, setAlerts] = useState(notifyAllowed());
  const [testSeat, setTestSeat] = useState<string>('');
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const sendTest = async () => {
    const id = testSeat || followed[0] || 'vic-south-west-coast';
    const ok = await askNotify(); setAlerts(ok);
    if (!ok) { setTestMsg('Notifications are blocked for PolTok in this browser. Allow them in your browser\'s site settings, then try again.'); return; }
    const m0 = data?.model?.seats[id];
    notify(`🔔 Test alert · ${seatById.get(id)?.name ?? id}`, m0 ? `This is how PolTok will alert you on Saturday. Model favourite: ${VIC_NAME[m0.fav] ?? m0.fav} (${Math.round((m0.prob[m0.fav] ?? 0) * 100)}%).` : 'This is how PolTok will alert you on Saturday night.', 'test-' + id);
    setTestMsg(`Sent a test alert for ${seatById.get(id)?.name ?? id}. If you didn\'t see it, check your system's notification settings (Focus / Do Not Disturb) for your browser.`);
  };
  const [server, setServer] = useState<Ev[]>([]);
  const [local, setLocal] = useState<Ev[]>([]);
  const prev = useRef<AuResults | null>(null);
  const counting = !!res.data && res.data.status !== 'pre-election' && Object.keys(res.data.seats).length > 0;

  // server feed (Netlify Blobs), polled
  useEffect(() => {
    if (now < VIC_CLOSE - 60_000) return;
    let dead = false;
    const run = () => fetch('/api/vic/events').then((r) => r.json()).then((j) => { if (!dead && Array.isArray(j.events)) setServer(j.events); }).catch(() => {});
    run(); const t = setInterval(run, 30_000);
    return () => { dead = true; clearInterval(t); };
  }, [now >= VIC_CLOSE - 60_000]); // eslint-disable-line react-hooks/exhaustive-deps
  // client-side diff between polls (also drives notifications for followed seats)
  useEffect(() => {
    if (!res.data || !counting) return;
    const ev = diff(prev.current, res.data);
    prev.current = res.data;
    if (!ev.length) return;
    setLocal((l) => [...ev, ...l].slice(0, 300));
    for (const e of ev) if (followed.includes(e.id)) notify(`${seatById.get(e.id)?.name}: ${e.kind === 'called' ? `${VIC_NAME[grp(e.party)]} wins` : `${VIC_NAME[grp(e.party)]} leads`}`, 'PolTok Live Desk · Victoria 2026', e.id);
  }, [res.data, counting]); // eslint-disable-line react-hooks/exhaustive-deps
  const feed = useMemo(() => { const seen = new Set<string>(); return [...server, ...local].sort((a, b) => b.at - a.at).filter((e) => { const k = `${e.id}|${e.kind}|${e.party}`; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 60); }, [server, local]);

  const seats = res.data?.seats ?? {};
  const tally = useMemo(() => { const o: Record<string, { won: number; lead: number }> = {}; for (const s of Object.values(seats)) { const g = grp(s.called ?? s.leader); o[g] ??= { won: 0, lead: 0 }; o[g][s.called ? 'won' : 'lead']++; } return o; }, [seats]);
  const reporting = Object.keys(seats).length, called = Object.values(seats).filter((s) => s.called).length;
  const avgCounted = reporting ? Object.values(seats).filter((s) => s.counted <= 100).reduce((a, s, _, arr) => a + s.counted / arr.length, 0) : 0;
  const close = useMemo(() => Object.entries(seats).filter(([, s]) => !s.called && lead(s) != null && lead(s)! < 4).sort((a, b) => lead(a[1])! - lead(b[1])!).slice(0, 12), [seats]);
  const m = data?.model;
  const upsets = useMemo(() => (!m ? [] : Object.entries(seats).filter(([id, s]) => m.seats[id] && grp(s.called ?? s.leader) !== m.seats[id].fav).slice(0, 12)), [seats, m]);
  const swing = useMemo(() => {
    const pen = data?.projection?.seats; if (!pen) return null;
    const xs: number[] = [];
    for (const [id, s] of Object.entries(seats)) {
      const p = pen[id]; if (!p || !s.tcp || s.tcp.length < 2) continue;
      const pair = s.tcp.map((t) => grp(t.party)); if (!(pair.includes('ALP') && pair.includes('LNP')) || !((p.win2022 === 'ALP' && p.vs === 'LNP') || (p.win2022 === 'LNP' && p.vs === 'ALP'))) continue;
      const lnpNow = s.tcp.find((t) => grp(t.party) === 'LNP')!.pct, lnp22 = p.win2022 === 'LNP' ? 50 + p.margin : 50 - p.margin;
      xs.push(lnpNow - lnp22);
    }
    return xs.length ? { avg: +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1), n: xs.length } : null;
  }, [seats, data]);
  const keyIds = useMemo(() => [...new Set([...followed, 'vic-niddrie', 'vic-kew', 'vic-melbourne', ...(m ? Object.entries(m.seats).filter(([, s]) => s.rating === 'tossup').map(([id]) => id) : [])])].filter((id) => seatById.has(id)).slice(0, 16), [followed, m]);
  const parties = ORDER.filter((k) => (counting ? tally[k] : m?.range[k]?.median));
  const odds = useMemo(() => (m ? liveOdds(m, counting ? res.data : null) : null), [m, counting, res.data]);
  const [tv, setTv] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const toggleTv = () => { const on = !tv; setTv(on); try { if (on) root.current?.requestFullscreen?.(); else if (document.fullscreenElement) document.exitFullscreen(); } catch { /* fullscreen not allowed: TV layout still applies */ } };
  useEffect(() => { const f = () => { if (!document.fullscreenElement) setTv(false); }; document.addEventListener('fullscreenchange', f); return () => document.removeEventListener('fullscreenchange', f); }, []);
  // seats-through-the-night: one point per poll while counting (kept in this browser)
  const [hist, setHist] = useState<{ t: number; s: Record<string, number> }[]>(() => { try { return JSON.parse(localStorage.getItem('poltok.vic.hist') ?? '[]'); } catch { return []; } });
  useEffect(() => {
    if (!counting) return;
    const s: Record<string, number> = {}; for (const [k, v] of Object.entries(tally)) s[k] = v.won + v.lead;
    setHist((h) => { const last = h[h.length - 1]; if (last && JSON.stringify(last.s) === JSON.stringify(s)) return h; const n = [...h, { t: Date.now(), s }].slice(-400); try { localStorage.setItem('poltok.vic.hist', JSON.stringify(n)); } catch { /* ignore */ } return n; });
  }, [counting, tally]);
  const uncalledLeads = useMemo(() => { const o: Record<string, number> = {}; for (const s of Object.values(seats)) if (!s.called && s.leader) { const g = grp(s.leader); o[g] = (o[g] ?? 0) + 1; } return o; }, [seats]);
  const liveFills = useMemo(() => { const f: Record<string, string> = {}; for (const st of VICTORIA.seats ?? []) { const r = seats[st.id]; const g = r ? grp(r.called ?? r.leader) : null; f[st.id] = g ? vicColor(g) + (r!.called ? '' : '88') : m?.seats[st.id] ? vicColor(m.seats[st.id].fav) + '33' : '#2a3048'; } return f; }, [seats, m]);
  const liveMap = useMemo(() => { const o: Record<string, string> = {}; for (const [id, r] of Object.entries(seats)) { const g = grp(r.called ?? r.leader); if (g) o[id] = g; } return o; }, [seats]);

  return (
    <div className={`page au-page ld${tv ? ' ld--tv' : ''}`} ref={root}>
      <PageHeader className="au-pagehead" live={counting} kicker={counting ? `Counting · ${res.data?.source ?? 'VEC'}` : 'Victorian state election · Sat 28 Nov 2026'} title="Live Desk" crumbLabel="Victoria live"
        sub={counting ? <>Updated {new Date(res.data!.updatedAt ?? Date.now()).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', timeZone: 'Australia/Melbourne' })} AEDT · refreshes every 30 seconds</> : <>Election-night command centre. Results start after polls close at 6pm AEDT.</>}>
        <AuNav />
      </PageHeader>

      <section className="ld-hero lg">
        <div className="ld-hero__top">
          <span className={`ld-pill ${counting ? 'is-live' : ''}`}>{counting ? 'LIVE COUNT' : now < VIC_CLOSE ? 'BEFORE POLLS CLOSE' : 'AWAITING FIRST RESULTS'}</span>
          {!counting && now < VIC_CLOSE && <span className="ld-count">Polls close in <b className="num"><Countdown to={VIC_CLOSE} compact /></b></span>}
        </div>
        <h1>Race to <em>45</em></h1>
        <div className="ld-race" role="img" aria-label={parties.map((k) => `${VIC_NAME[k] ?? k} ${counting ? `${tally[k]?.won ?? 0} won, ${tally[k]?.lead ?? 0} leading` : `${m?.range[k]?.median} model median`}`).join('; ')}>
          {parties.map((k) => {
            const won = counting ? tally[k]?.won ?? 0 : 0, ld = counting ? tally[k]?.lead ?? 0 : m?.range[k]?.median ?? 0;
            return (
              <span key={k} className="ld-race__p" style={{ flex: won + ld, ['--c' as string]: vicColor(k) } as CSSProperties}>
                <i className="won" style={{ flex: won }} /><i className="lead" style={{ flex: ld }} />
              </span>
            );
          })}
          <span className="ld-race__rest" style={{ flex: Math.max(0, 88 - parties.reduce((a, k) => a + (counting ? (tally[k]?.won ?? 0) + (tally[k]?.lead ?? 0) : m?.range[k]?.median ?? 0), 0)) }} />
          <u style={{ left: `${(45 / 88) * 100}%` }}><em>45</em></u>
        </div>
        <div className="ld-race__legend">
          {parties.map((k) => <span key={k} style={{ ['--c' as string]: vicColor(k) } as CSSProperties}><b className="num">{counting ? (tally[k]?.won ?? 0) + (tally[k]?.lead ?? 0) : m?.range[k]?.median}</b>{VIC_NAME[k] ?? k}{counting && <small> {tally[k]?.won ?? 0} won</small>}</span>)}
          {!counting && <span className="faint">Pre-count: PolTok model medians (striped). Solid = won once results arrive.</span>}
        </div>
        {odds && (
          <div className="ld-gauges">
            <div className="ld-gauge lg"><h3>{counting ? 'Live chance of a majority' : 'Chance of a majority · pre-count'}</h3><Needle odds={odds} live={counting} /><small className="faint">{counting ? `PolTok live model · ${odds.reporting} seats reporting blended with the pre-election model` : 'PolTok model · moves as results land'}</small></div>
            <div className="ld-gauge lg"><h3>Swingometer</h3><Swingometer measured={swing?.avg ?? null} polls={data?.projection ? data.projection.swing : null} /><small className="faint">Two-party swing to the Coalition since 2022{swing ? ` · ${swing.n} Labor-v-Coalition seats` : ''}</small></div>
          </div>
        )}
        <dl className="ld-stats">
          <div><dt>Seats reporting</dt><dd className="num">{reporting}<small>/88</small></dd></div>
          <div><dt>Called</dt><dd className="num">{called}</dd></div>
          <div><dt>Avg counted</dt><dd className="num">{avgCounted ? `${avgCounted.toFixed(0)}%` : '—'}</dd></div>
          <div><dt>2CP swing to Coalition</dt><dd className="num">{swing ? `${swing.avg > 0 ? '+' : ''}${swing.avg}` : m && data?.projection ? `~${data.projection.swing} polls` : '—'}{swing && <small> ({swing.n} seats)</small>}</dd></div>
        </dl>
        <div className="row row-wrap" style={{ gap: 8 }}>
        <Link to="/au/victoria/watch" className="lg lg--pill lg-btn">📺 PolTok WATCH</Link>
        <button type="button" className="lg lg--pill lg-btn" onClick={toggleTv} aria-pressed={tv}>{tv ? '✕ Exit TV mode' : '📺 TV mode'}</button>
        {notifySupported() && (
          <button type="button" className={`lg lg--pill lg-btn${alerts ? ' is-on' : ''}`} onClick={async () => setAlerts(await askNotify())} disabled={alerts}>
            {alerts ? '🔔 Alerts on for your followed seats' : '🔔 Alert me when my seats change'}
          </button>
        )}
        {notifySupported() && (
          <span className="ld-test">
            <select value={testSeat} onChange={(e) => setTestSeat(e.target.value)} aria-label="Seat for the test alert">
              <option value="">{followed[0] ? seatById.get(followed[0])?.name : 'South-West Coast'}</option>
              {[...seatById.values()].map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
            </select>
            <button type="button" className="lg lg--pill lg-btn" onClick={sendTest}>🧪 Send a test alert</button>
          </span>
        )}
        </div>
        {testMsg && <p className="ld-note" role="status">{testMsg}</p>}
      </section>

      {!followed.length && <div style={{ margin: '14px 0' }}><FindSeat onSeat={(id) => setOpen(id)} /></div>}

      <div className="ld-grid">
        <Card className="ld-feed" title="Live feed" kicker={counting ? 'Every first result, lead change and call' : 'Starts when the first results land'} live={counting}>
          {feed.length ? (
            <ol className="ld-ev">{feed.map((e, i) => {
              const g = grp(e.party), who = personFor(e.id, g, m), held = data?.projection?.seats[e.id]?.win2022 ?? (e.prev ? grp(e.prev) : null);
              return (
                <li key={`${e.id}${e.kind}${e.party}${i}`} className={`k-${e.kind}`} style={{ ['--c' as string]: vicColor(g) } as CSSProperties} onClick={() => setOpen(e.id)}>
                  {who ? <Face p={who} ctx={`feed${i}`} size={34} color={vicColor(g)} /> : <span className="ld-dot" />}
                  <span><b>{seatById.get(e.id)?.name ?? e.id}</b> {e.kind === 'called' ? <>· <b style={{ color: 'var(--c)' }}>{VIC_NAME[g] ?? g} {held && held !== g ? 'GAIN' : 'RETAIN'}</b>{held && held !== g ? ` from ${VIC_NAME[held] ?? held}` : ''}</> : e.kind === 'lead' ? <>· {VIC_NAME[g] ?? g} takes the lead{e.prev ? ` from ${VIC_NAME[grp(e.prev)] ?? e.prev}` : ''}</> : <>· first results, {VIC_NAME[g] ?? g} ahead</>}</span>
                  <time className="faint">{ago(e.at, now)}</time>
                </li>
              );
            })}</ol>
          ) : <p className="ld-note">{counting ? 'Changes will appear here as the count moves.' : 'Nothing yet. Polls close at 6pm AEDT on Saturday; the first small booths usually report within the hour.'}</p>}
        </Card>
        <Card title="Too close to call" kicker="Two-candidate lead under 4 points">
          {close.length ? <ul className="ld-list">{close.map(([id, s]) => <li key={id} onClick={() => setOpen(id)}><b>{seatById.get(id)?.name}</b><span style={{ color: vicColor(grp(s.leader)) }}>{VIC_NAME[grp(s.leader)]} +{lead(s)}</span><small className="faint">{s.counted <= 100 ? `${s.counted}%` : ''}</small></li>)}</ul>
            : <p className="ld-note">{counting ? 'No seats under a 4-point margin right now.' : 'The model\'s toss-ups are below. Watch them first.'}</p>}
        </Card>
        <Card title="Upsets v the model" kicker="Leading or won against the PolTok pre-election favourite">
          {upsets.length ? <ul className="ld-list">{upsets.map(([id, s]) => <li key={id} onClick={() => setOpen(id)}><b>{seatById.get(id)?.name}</b><span style={{ color: vicColor(grp(s.called ?? s.leader)) }}>{VIC_NAME[grp(s.called ?? s.leader)]}{s.called ? ' won' : ' leads'}</span><small className="faint">model: {VIC_NAME[m!.seats[id].fav]}</small></li>)}</ul>
            : <p className="ld-note">{counting ? 'So far every reporting seat matches the model favourite.' : 'Shows seats bucking the model once counting starts.'}</p>}
        </Card>
        <Card className="ld-wide" title="Live Parliament" kicker={counting ? 'Every seat, leading or won · tap a face for the full profile' : 'Pre-count: model favourite in every seat · tap a face'} live={counting}>
          <Hemicycle data={data} view={counting ? 'live' : 'model'} live={counting ? liveMap : undefined} onPick={setOpen} />
        </Card>
        <Card title="Path to 45" kicker="Won (solid) + leading (striped) toward a majority"><PathTo45 tally={tally} uncalledLeads={uncalledLeads} /></Card>
        <Card title="Seats through the night" kicker="Won + leading, every update"><Timeline hist={hist} /></Card>
        <div className="ld-wide">
          <MapPanel layer="vic" seats={VICTORIA.seats ?? []} fills={liveFills} title="Live map" regions={VIC_ZOOMS} kicker={counting ? 'Solid = called · faded = leading · dark = no results yet' : 'Pre-count: faint model favourites'} legendNote="Legend shows 2022 holders; colours follow the live count." />
        </div>
        <Card className="ld-wide" title={followed.length ? 'Your seats + key seats' : 'Key seats'} kicker="⭐ Star any seat to pin it here · tap for the full profile">
          <div className="ld-seats">{keyIds.map((id) => <SeatCard key={id} id={id} s={seats[id]} fav={m?.seats[id]?.fav} onOpen={setOpen} model={data} />)}</div>
        </Card>
      </div>
      <p className="vp-method">Results: Victorian Electoral Commission district results, read every 2 minutes; calls only on a finished preference distribution or a large two-candidate lead with most of the roll counted. Nothing is estimated on this page except the clearly labelled model figures. <Link to="/au/victoria/parliament">Live Parliament →</Link></p>
      <ProfileHost />
      {open && <SeatProfile id={open} data={data} onClose={() => setOpen(null)} />}
    </div>
  );
}
