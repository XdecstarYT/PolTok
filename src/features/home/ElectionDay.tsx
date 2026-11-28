/** Election-day home hero. Until 6pm AEDT: polls-open mode (giant countdown, voting checklist, seats to watch, lock in
 *  your calls). From 6pm: results-night mode (live seat tally, latest VEC calls and lead changes, straight into the Live
 *  Desk). Real data only: the tally and feed come from the VEC results reader; before it reports, we say so. */
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { m } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useNow } from '../../components';
import { PersonAvatar } from '../../components/PersonAvatar';
import { useAuResults } from '../au/api';
import { partyKey } from '../au/model';
import { VIC_NAME, useVicLive, vicColor } from '../au/vicLive';
import { personFor, seatById } from '../au/parliament/people';
import './election-day.css';

export const VIC_OPEN = Date.parse('2026-11-28T08:00:00+11:00');
export const VIC_CLOSE = Date.parse('2026-11-28T18:00:00+11:00');
const grp = (x?: string | null) => { if (!x) return 'OTH'; const k = partyKey(x); return ['LIB', 'NAT', 'LNP'].includes(k) ? 'LNP' : ['ALP', 'GRN', 'ONP', 'IND'].includes(k) ? k : 'OTH'; };
const pad = (n: number) => String(n).padStart(2, '0');

function Flip({ v, label }: { v: string; label: string }) {
  return (
    <span className="ed-flip">
      <span className="ed-flip__digits">{v.split('').map((d, i) => <m.b key={`${i}-${d}`} initial={{ rotateX: -90, opacity: 0 }} animate={{ rotateX: 0, opacity: 1 }} transition={{ duration: 0.35 }}>{d}</m.b>)}</span>
      <small>{label}</small>
    </span>
  );
}

function SeatsToWatch() {
  const { data } = useVicLive();
  const model = data?.model;
  const seats = useMemo(() => !model ? [] : Object.entries(model.seats).map(([id, s]) => ({ id, s, top: Math.max(...Object.values(s.prob)) })).sort((a, b) => a.top - b.top).slice(0, 8), [model]);
  if (!seats.length) return null;
  return (
    <div className="ed-watch">
      <div className="ed-h"><span>👀</span><b>Seats to watch tonight</b><small>closest in the PolTok model</small></div>
      <div className="ed-watch__grid">
        {seats.map(({ id, s }, i) => {
          const two = Object.entries(s.prob).sort((a, b) => b[1] - a[1]).slice(0, 2);
          return (
            <m.div key={id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}>
              <Link to={`/au/victoria/parliament?seat=${id}`} className="ed-seat lg">
                <b>{seatById.get(id)?.name ?? id}</b>
                <span className="ed-seat__faces">{two.map(([k, p]) => { const per = personFor(id, k, model); return (
                  <span key={k} style={{ ['--c' as string]: vicColor(k) } as CSSProperties}>
                    {per ? <PersonAvatar name={per.name} color={vicColor(k)} lookup={{ name: per.name, scope: 'au' }} size={34} /> : <i className="ed-dot" />}
                    <small>{VIC_NAME[k] ?? k} <b>{Math.round(p * 100)}%</b></small>
                  </span>); })}</span>
              </Link>
            </m.div>
          );
        })}
      </div>
    </div>
  );
}

function PollingDay({ now }: { now: number }) {
  const left = Math.max(0, VIC_CLOSE - now);
  const h = Math.floor(left / 36e5), mi = Math.floor((left % 36e5) / 6e4), s = Math.floor((left % 6e4) / 1e3);
  const open = now >= VIC_OPEN;
  const dayPct = Math.min(100, Math.max(0, ((now - VIC_OPEN) / (VIC_CLOSE - VIC_OPEN)) * 100));
  return (
    <section className="ed ed--day" aria-labelledby="ed-title">
      <div className="ed-bg" aria-hidden="true"><i /><i /><i /><i /></div>
      <div className="ed-top"><span className="ed-pulse" />{open ? 'Polls are open across Victoria' : 'Polls open at 8am'}<span className="ed-date">Saturday 28 November</span></div>
      <h1 id="ed-title" className="ed-title">Election <em>day</em></h1>
      <div className="ed-clock" role="timer" aria-label={`Polls close in ${h} hours ${mi} minutes`}>
        <span className="ed-clock__lead">{open ? 'Polls close in' : 'Polls open 8am · close in'}</span>
        <div className="ed-clock__digits"><Flip v={pad(h)} label="hours" /><i>:</i><Flip v={pad(mi)} label="mins" /><i>:</i><Flip v={pad(s)} label="secs" /></div>
        <div className="ed-day" aria-hidden="true"><span>8am</span><div><m.i animate={{ width: `${dayPct}%` }} /></div><span>6pm</span></div>
      </div>
      <div className="ed-check">
        <a className="ed-card lg" href="https://www.vec.vic.gov.au/voting/2026-state-election/voting-locations" target="_blank" rel="noreferrer">
          <span className="ed-card__n">1</span><span className="ed-card__e">📍</span><b>Where do I vote?</b><small>Any voting centre in Victoria, 8am–6pm (one in your own district is quickest). Find one on the VEC site ↗</small>
        </a>
        <a className="ed-card lg" href="#find-seat" onClick={(e) => { const el = document.getElementById('find-seat'); if (el) { e.preventDefault(); el.scrollIntoView({ behavior: 'smooth', block: 'start' }); el.querySelector('input')?.focus({ preventScroll: true }); } }}>
          <span className="ed-card__n">2</span><span className="ed-card__e">🗺️</span><b>Who's on my ballot?</b><small>Enter your postcode or suburb to see your district and every candidate</small>
        </a>
        <div className="ed-card lg">
          <span className="ed-card__n">3</span><span className="ed-card__e">✏️</span><b>Filling it in</b>
          <small><b>Lower house (Legislative Assembly):</b> number every box in your order of preference.<br /><b>Upper house (Legislative Council):</b> a 1 in one box above the line, or number at least 5 boxes below it.</small>
        </div>
        <a className="ed-card lg" href="https://www.vec.vic.gov.au/voting/2026-state-election/voting-options" target="_blank" rel="noreferrer">
          <span className="ed-card__n">4</span><span className="ed-card__e">🙋</span><b>Not sure you're enrolled?</b><small>Voting is compulsory. The VEC explains your options on the day ↗</small>
        </a>
      </div>
      <div className="ed-ctas">
        <Link to="/au/victoria/predict" className="ed-cta ed-cta--hot">🎯 Lock in your calls<small>Predictions lock at 6pm. Get scored live tonight</small></Link>
        <Link to="/au/victoria/match" className="ed-cta">💘 Who matches you?<small>Still deciding? Swipe 14 issues</small></Link>
        <Link to="/au/victoria/watch" className="ed-cta">📺 PolTok WATCH<small>Put it on the TV: the full-screen broadcast</small></Link>
      </div>
      <div className="ed-tonight">
        <div className="ed-h"><span>🌙</span><b>Tonight on PolTok</b></div>
        <ol>
          <li><b>6:00pm</b><span>Polls close. The Live Desk switches to the live count.</span></li>
          <li><b>From ~6:30pm</b><span>First small-booth results arrive from the VEC. Faces on the live parliament fill in seat by seat.</span></li>
          <li><b>Through the night</b><span>Election-day votes are counted; the needle and race to 45 update every couple of minutes.</span></li>
          <li><b>Next days</b><span>Early, postal and absent votes are added. Close seats can take a week or more.</span></li>
        </ol>
      </div>
      <SeatsToWatch />
    </section>
  );
}

type Ev = { at: number; id: string; kind: 'called' | 'first' | 'lead'; party: string; prev?: string | null };
function ResultsNight() {
  const res = useAuResults('vic2026');
  const [events, setEvents] = useState<Ev[]>([]);
  useEffect(() => {
    let dead = false;
    const run = () => fetch('/api/vic/events').then((r) => r.json()).then((j) => { if (!dead && Array.isArray(j.events)) setEvents(j.events); }).catch(() => {});
    run(); const t = setInterval(run, 30000); return () => { dead = true; clearInterval(t); };
  }, []);
  const seats = res.data?.seats ?? {};
  const ids = Object.keys(seats);
  const tally = useMemo(() => {
    const o: Record<string, { won: number; lead: number }> = {};
    for (const s of Object.values(seats)) { const p = s.called ?? s.leader; if (!p) continue; const k = grp(p); o[k] ??= { won: 0, lead: 0 }; o[k][s.called ? 'won' : 'lead']++; }
    return Object.entries(o).sort((a, b) => b[1].won + b[1].lead - (a[1].won + a[1].lead));
  }, [seats]);
  const counted = ids.length ? ids.reduce((a, id) => a + (seats[id].counted ?? 0), 0) / 88 : 0;
  const final = res.data?.status === 'final';
  return (
    <section className="ed ed--night" aria-labelledby="ed-title">
      <div className="ed-bg" aria-hidden="true"><i /><i /><i /><i /></div>
      <div className="ed-top"><span className="ed-pulse ed-pulse--red" />{final ? 'Final result' : 'LIVE · Counting under way'}<span className="ed-date">Victorian state election 2026</span></div>
      <h1 id="ed-title" className="ed-title">Victoria <em>decides</em></h1>
      {ids.length ? (
        <div className="ed-tally">
          {tally.slice(0, 5).map(([k, v], i) => (
            <m.div key={k} className="ed-tally__p lg" style={{ ['--c' as string]: vicColor(k) } as CSSProperties} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.08 }}>
              <b className="num">{v.won + v.lead}</b><span>{VIC_NAME[k] ?? k}</span><small>{v.won} won · {v.lead} leading</small>
            </m.div>
          ))}
          <div className="ed-tally__meta"><b>45</b> for a majority · <b>{ids.length}</b>/88 seats reporting · about <b>{Math.round(counted)}%</b> counted</div>
        </div>
      ) : (
        <p className="ed-wait">Polls have closed. The first figures appear here the moment the VEC publishes them, usually from about 6:30pm. Hang tight.</p>
      )}
      <div className="ed-ctas">
        <Link to="/au/victoria/live" className="ed-cta ed-cta--hot">🔴 Open the Live Desk<small>The needle, race to 45, every seat</small></Link>
        <Link to="/au/victoria/predict" className="ed-cta">🎯 Your calls v the model<small>Scores update as seats are called</small></Link>
        <Link to="/au/victoria/watch" className="ed-cta">📺 PolTok WATCH<small>Full-screen broadcast for the TV</small></Link>
      </div>
      {events.length > 0 && (
        <div className="ed-feed">
          <div className="ed-h"><span>⚡</span><b>Latest from the count</b></div>
          <ul>{events.slice(0, 8).map((e, i) => (
            <m.li key={`${e.at}-${e.id}-${e.kind}`} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} style={{ ['--c' as string]: vicColor(grp(e.party)) } as CSSProperties}>
              <time>{new Date(e.at).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', timeZone: 'Australia/Melbourne' })}</time>
              <span><b>{seatById.get(e.id)?.name ?? e.id}</b> · {e.kind === 'called' ? <>called for <em>{VIC_NAME[grp(e.party)] ?? e.party}</em>{e.prev && grp(e.prev) !== grp(e.party) ? ' (change)' : ''}</> : e.kind === 'lead' ? <><em>{VIC_NAME[grp(e.party)] ?? e.party}</em> takes the lead</> : <>first results, <em>{VIC_NAME[grp(e.party)] ?? e.party}</em> ahead</>}</span>
            </m.li>))}</ul>
        </div>
      )}
    </section>
  );
}

/** Rendered at the very top of the home page on election day (and the morning after). */
export default function ElectionDay() {
  const now = useNow(1000);
  if (now < VIC_OPEN - 6 * 36e5 || now > VIC_CLOSE + 36 * 36e5) return null;
  return now < VIC_CLOSE ? <PollingDay now={now} /> : <ResultsNight />;
}
