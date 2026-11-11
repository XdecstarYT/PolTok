/**
 * /calendar — elections & key dates (US + Australia). Data: /api/calendar (server/calendar.js ·
 * netlify/functions/calendar.mjs). Curated from official sources; each event shows source + confidence.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, ErrorState, PageHeader, Skeleton, fmtTime, tzAbbr, useNow } from '../../components';
import './calendar.css';

type Ev = {
  id: string; date: string; end?: string; time?: string; tz?: string; start?: number; title: string; jurisdiction: string;
  country: 'US' | 'AU'; type: string; confidence: 'confirmed' | 'scheduled' | 'tentative'; source: string; sourceName: string; notes?: string; link?: string;
};
type Res = { title: string; url: string; note?: string };
const TYPES: Record<string, string> = { election: 'Election', runoff: 'Runoff', voting: 'Early voting', deadline: 'Deadline', sitting: 'Sitting', transition: 'Swearing-in' };
const FLAG = { US: '🇺🇸', AU: '🇦🇺' } as const;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** All-day dates are calendar dates (no zone); compare against the viewer's local "today". */
const todayISO = () => new Date().toLocaleDateString('en-CA');
const dayTs = (iso: string) => Date.parse(iso + 'T00:00:00');
const fmtDate = (iso: string) => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const covers = (e: Ev, iso: string) => iso >= e.date && iso <= (e.end || e.date);

function countdown(e: Ev, now: number) {
  const target = e.start ?? dayTs(e.date);
  const endT = e.start ? e.start : dayTs(e.end || e.date) + 864e5;
  if (now >= target && now < endT) return 'Today / under way';
  if (now >= endT) return 'Past';
  const d = Math.floor((target - now) / 864e5);
  if (d >= 1) return `in ${d} day${d === 1 ? '' : 's'}`;
  const h = Math.floor((target - now) / 36e5);
  return h >= 1 ? `in ${h}h ${Math.floor(((target - now) % 36e5) / 6e4)}m` : `in ${Math.max(1, Math.floor((target - now) / 6e4))}m`;
}

function EventCard({ e, now }: { e: Ev; now: number }) {
  return (
    <article className={`cal-ev cal-ev--${e.type}`}>
      <div className="cal-ev__date">
        <b>{fmtDate(e.date)}</b>
        {e.end && <span>→ {fmtDate(e.end)}</span>}
        {e.start && <span>{fmtTime(e.start)} {tzAbbr(e.start)}</span>}
      </div>
      <div className="cal-ev__body">
        <h3>{e.link ? <Link to={e.link}>{e.title}</Link> : e.title}</h3>
        <div className="cal-ev__meta">
          <span>{FLAG[e.country]} {e.jurisdiction}</span>
          <span className="cal-tag">{TYPES[e.type] ?? e.type}</span>
          <span className={`cal-conf cal-conf--${e.confidence}`}>{e.confidence}</span>
          <span className="cal-cd">{countdown(e, now)}</span>
        </div>
        {e.notes && <p>{e.notes}</p>}
        <div className="cal-ev__foot">
          <a href={e.source} target="_blank" rel="noreferrer">Source: {e.sourceName} ↗</a>
          <a href={`/api/calendar.ics?id=${encodeURIComponent(e.id)}&dl=1`} download={`poltok-${e.id}.ics`}>+ Add to calendar (.ics)</a>
        </div>
      </div>
    </article>
  );
}

export default function CalendarPage() {
  const now = useNow(60000);
  const [data, setData] = useState<{ events: Ev[]; updatedAt: string; resources: Res[] } | null>(null);
  const [err, setErr] = useState('');
  const [view, setView] = useState<'agenda' | 'month'>('agenda');
  const [country, setCountry] = useState<'all' | 'US' | 'AU'>('all');
  const [type, setType] = useState('all');
  const [showPast, setShowPast] = useState(false);
  const t0 = todayISO();
  const [ym, setYm] = useState(() => ({ y: Number(t0.slice(0, 4)), m: Number(t0.slice(5, 7)) - 1 }));
  const [sel, setSel] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/calendar').then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))).then(setData, (e) => setErr(String(e.message || e)));
  }, []);

  const filtered = useMemo(() => (data?.events ?? []).filter((e) => (country === 'all' || e.country === country) && (type === 'all' || e.type === type)), [data, country, type]);
  const agenda = filtered.filter((e) => showPast || (e.end || e.date) >= t0);
  const next = filtered.find((e) => (e.end || e.date) >= t0 && e.type !== 'sitting');
  const icsAll = `/api/calendar.ics${country !== 'all' || type !== 'all' ? '?' + new URLSearchParams({ ...(country !== 'all' ? { country } : {}), ...(type !== 'all' ? { type } : {}) }) : ''}`;
  const subUrl = typeof location !== 'undefined' ? `${location.origin}${icsAll}` : icsAll;

  // month grid
  const first = new Date(Date.UTC(ym.y, ym.m, 1));
  const lead = first.getUTCDay();
  const days = new Date(Date.UTC(ym.y, ym.m + 1, 0)).getUTCDate();
  const cells = Array.from({ length: Math.ceil((lead + days) / 7) * 7 }, (_, i) => {
    const d = i - lead + 1;
    return d >= 1 && d <= days ? `${ym.y}-${String(ym.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null;
  });
  const shift = (n: number) => setYm(({ y, m }) => ({ y: y + Math.floor((m + n) / 12), m: (((m + n) % 12) + 12) % 12 }));

  return (
    <div className="page cal">
      <PageHeader
        className="cal-head"
        kicker="Elections & key dates"
        title="Calendar"
        sub={<>US and Australian elections, runoffs, deadlines and swearing-ins, every date sourced. Times shown in {tzAbbr()} (change in Settings). Other countries: <Link to="/world">World elections</Link>.</>}
        aside={
          next ? (
            <div className="cal-next">
              <span>Next up</span>
              <b>{next.title}</b>
              <em>{countdown(next, now)}</em>
            </div>
          ) : undefined
        }
      />

      <div className="cal-bar">
        <div className="cal-seg" role="group" aria-label="View">
          {(['agenda', 'month'] as const).map((v) => <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}>{v === 'agenda' ? 'Agenda' : 'Month'}</button>)}
        </div>
        <div className="cal-seg" role="group" aria-label="Country">
          {(['all', 'US', 'AU'] as const).map((c) => <button key={c} type="button" aria-pressed={country === c} onClick={() => setCountry(c)}>{c === 'all' ? 'All' : `${FLAG[c]} ${c}`}</button>)}
        </div>
        <select aria-label="Event type" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="all">All types</option>
          {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {view === 'agenda' && <label className="cal-chk"><input type="checkbox" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} /> Show past</label>}
        <a className="cal-btn" href={`${icsAll}${icsAll.includes('?') ? '&' : '?'}dl=1`} download="poltok-calendar.ics">Download .ics</a>
        <button type="button" className="cal-btn" onClick={() => navigator.clipboard?.writeText(subUrl)} title={subUrl}>Copy subscribe URL</button>
      </div>

      {err && !data && <ErrorState title="Couldn’t load the calendar" description={err} onRetry={() => location.reload()} />}
      {!data && !err && <div className="cal-list" aria-busy="true" aria-label="Loading calendar">{[0, 1, 2].map((i) => <Skeleton key={i} height={96} radius={12} />)}</div>}

      {data && view === 'agenda' && (
        <section className="cal-list" aria-label="Agenda">
          {agenda.length ? agenda.map((e) => <EventCard key={e.id} e={e} now={now} />) : <EmptyState compact title="No events match these filters" description="Try another country or type, or show past events." />}
        </section>
      )}

      {data && view === 'month' && (
        <section aria-label="Month view">
          <div className="cal-mhead">
            <button type="button" onClick={() => shift(-1)} aria-label="Previous month">‹</button>
            <h2>{MONTHS[ym.m]} {ym.y}</h2>
            <button type="button" onClick={() => shift(1)} aria-label="Next month">›</button>
          </div>
          <div className="cal-grid">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d} className="cal-dow">{d}</div>)}
            {cells.map((iso, i) => {
              const evs = iso ? filtered.filter((e) => covers(e, iso)) : [];
              return (
                <button type="button" key={i} disabled={!iso} className={`cal-cell ${iso === t0 ? 'is-today' : ''} ${iso && iso === sel ? 'is-sel' : ''}`} onClick={() => iso && setSel(iso)} aria-label={iso ? `${iso}: ${evs.length} events` : undefined}>
                  {iso && <span className="cal-cell__n">{Number(iso.slice(8))}</span>}
                  {evs.slice(0, 3).map((e) => <span key={e.id} className={`cal-pill cal-ev--${e.type}`}>{FLAG[e.country]} {e.title}</span>)}
                  {evs.length > 3 && <span className="cal-more">+{evs.length - 3}</span>}
                </button>
              );
            })}
          </div>
          {sel && (
            <div className="cal-list">
              <h3 className="cal-muted">{fmtDate(sel)}</h3>
              {filtered.filter((e) => covers(e, sel)).map((e) => <EventCard key={e.id} e={e} now={now} />)}
              {!filtered.some((e) => covers(e, sel)) && <p className="cal-muted">Nothing scheduled.</p>}
            </div>
          )}
        </section>
      )}

      {data && (
        <footer className="cal-foot">
          <h2>Sources &amp; notes</h2>
          <ul>{data.resources.map((r) => <li key={r.url}><a href={r.url} target="_blank" rel="noreferrer">{r.title} ↗</a>{r.note && <> — {r.note}</>}</li>)}</ul>
          <p className="cal-muted">Curated {data.updatedAt}. Confidence: <b>confirmed</b> = set by an electoral authority or law; <b>scheduled</b> = set by statute/standard calendar, may be contingent (e.g. runoffs only if needed); <b>tentative</b> = sources conflict or single secondary source.</p>
        </footer>
      )}
    </div>
  );
}
