// PolTok elections & key-dates calendar (US + Australia). Hand-curated from official/primary sources —
// every event carries its source link and a confidence level. No dates are invented: when sources conflict
// the event is marked "tentative" with a note.
//   GET /api/calendar            { events, updatedAt, sources }   (?country=US|AU&type=)
//   GET /api/calendar.ics        full subscribable iCalendar feed (?country=&type=&id=)
export const UPDATED_AT = '2026-11-05';

const VEC = 'https://www.vec.vic.gov.au/voting/2026-state-election';
const VEC_ACT = 'https://www.vec.vic.gov.au/about-us/legislation/electoral-act-amendments-2026';
const LA_SOS = 'https://www.sos.la.gov/electionsandvoting/getelectioninformation/pages/default.aspx';
const BP_GOV27 = 'https://ballotpedia.org/Gubernatorial_elections,_2027';

/** @typedef {{id:string,date:string,end?:string,time?:string,tz?:string,title:string,jurisdiction:string,country:'US'|'AU',type:string,confidence:'confirmed'|'scheduled'|'tentative',source:string,sourceName:string,notes?:string,link?:string}} CalEvent */
/** @type {CalEvent[]} */
export const EVENTS = [
  // ── United States ───────────────────────────────────────────────
  { id: 'la-reg-dec12', date: '2026-11-12', title: 'Louisiana: voter registration deadline for Dec 12 election', jurisdiction: 'Louisiana', country: 'US', type: 'deadline', confidence: 'confirmed', source: LA_SOS, sourceName: 'Louisiana Secretary of State', notes: 'In person, by mail or at an OMV office.' },
  { id: 'la-ev-dec12', date: '2026-11-28', end: '2026-12-05', title: 'Louisiana: early voting for Dec 12 open general', jurisdiction: 'Louisiana', country: 'US', type: 'voting', confidence: 'tentative', source: 'https://www.aarp.org/states/louisiana/voter-guide/', sourceName: 'AARP Louisiana voter guide', notes: '8:30am–6pm, excluding Sunday Nov 29. Single secondary source — confirm on GeauxVote.' },
  { id: 'ga-runoff', date: '2026-12-01', time: '19:00', tz: 'America/New_York', title: 'Georgia general election runoff', jurisdiction: 'Georgia', country: 'US', type: 'runoff', confidence: 'scheduled', source: 'https://georgia.gov/node/34056', sourceName: 'Georgia.gov 2026 Election', notes: 'Held only for races where no candidate passed 50% on Nov 3. Polls 7am–7pm ET (time shown is poll close).' },
  { id: 'la-dec12', date: '2026-12-12', time: '20:00', tz: 'America/Chicago', title: 'Louisiana open general election (runoffs)', jurisdiction: 'Louisiana', country: 'US', type: 'runoff', confidence: 'confirmed', source: LA_SOS, sourceName: 'Louisiana Secretary of State', notes: 'Decides Nov 3 open-primary races (incl. U.S. House) where no one won a majority. Polls 7am–8pm CT (time shown is poll close).', link: '/races' },
  { id: 'us-congress-120', date: '2027-01-03', time: '12:00', tz: 'America/New_York', title: '120th Congress convenes; new members sworn in', jurisdiction: 'United States', country: 'US', type: 'transition', confidence: 'scheduled', source: 'https://constitution.congress.gov/constitution/amendment-20/', sourceName: 'U.S. Constitution, 20th Amendment', notes: 'Noon on Jan 3 unless Congress sets a different day by law.', link: '/parliament' },
  { id: 'la-gov-27', date: '2027-10-09', title: 'Louisiana governor & legislature: primary', jurisdiction: 'Louisiana', country: 'US', type: 'election', confidence: 'scheduled', source: BP_GOV27, sourceName: 'Ballotpedia' },
  { id: 'ky-gov-27', date: '2027-11-02', title: 'Kentucky governor election', jurisdiction: 'Kentucky', country: 'US', type: 'election', confidence: 'scheduled', source: BP_GOV27, sourceName: 'Ballotpedia', notes: 'Gov. Andy Beshear (D) is term-limited.' },
  { id: 'ms-gov-27', date: '2027-11-02', title: 'Mississippi governor & legislature election', jurisdiction: 'Mississippi', country: 'US', type: 'election', confidence: 'scheduled', source: BP_GOV27, sourceName: 'Ballotpedia', notes: 'Gov. Tate Reeves (R) is term-limited.' },
  { id: 'nj-leg-27', date: '2027-11-02', title: 'New Jersey Legislature elections', jurisdiction: 'New Jersey', country: 'US', type: 'election', confidence: 'scheduled', source: 'https://en.wikipedia.org/wiki/2027_United_States_elections', sourceName: 'Wikipedia: 2027 U.S. elections' },
  { id: 'va-ga-27', date: '2027-11-02', title: 'Virginia General Assembly elections', jurisdiction: 'Virginia', country: 'US', type: 'election', confidence: 'scheduled', source: 'https://en.wikipedia.org/wiki/2027_United_States_elections', sourceName: 'Wikipedia: 2027 U.S. elections', notes: 'House of Delegates and state Senate.' },
  { id: 'la-gov-27-runoff', date: '2027-11-20', title: 'Louisiana governor: general/runoff (if needed)', jurisdiction: 'Louisiana', country: 'US', type: 'runoff', confidence: 'tentative', source: BP_GOV27, sourceName: 'Ballotpedia / Wikipedia', notes: 'Sources conflict (Nov 13 vs Nov 20) — confirm with the Louisiana Secretary of State.' },
  { id: 'us-pres-28', date: '2028-11-07', title: 'U.S. presidential & congressional election', jurisdiction: 'United States', country: 'US', type: 'election', confidence: 'confirmed', source: 'https://www.law.cornell.edu/uscode/text/3/1', sourceName: '3 U.S.C. § 1', notes: 'Tuesday after the first Monday in November.' },
  // ── Australia ───────────────────────────────────────────────────
  { id: 'vic-noms', date: '2026-11-09', time: '12:00', tz: 'Australia/Melbourne', title: 'Victoria: candidate nominations close', jurisdiction: 'Victoria', country: 'AU', type: 'deadline', confidence: 'confirmed', source: VEC_ACT, sourceName: 'Victorian Electoral Commission', notes: 'All nomination types close 6 days after writs (2026 Electoral Act amendments).', link: '/au/victoria' },
  { id: 'vic-ev', date: '2026-11-18', end: '2026-11-27', title: 'Victoria: early voting', jurisdiction: 'Victoria', country: 'AU', type: 'voting', confidence: 'confirmed', source: VEC, sourceName: 'Victorian Electoral Commission', notes: '9am–8pm daily (closed Sunday); closes 6pm on the final day.', link: '/au/victoria' },
  { id: 'vic-postal', date: '2026-11-25', title: 'Victoria: postal vote applications close', jurisdiction: 'Victoria', country: 'AU', type: 'deadline', confidence: 'confirmed', source: VEC, sourceName: 'VEC election service plan', link: '/au/victoria' },
  { id: 'vic-election', date: '2026-11-28', time: '18:00', tz: 'Australia/Melbourne', title: 'Victorian state election', jurisdiction: 'Victoria', country: 'AU', type: 'election', confidence: 'confirmed', source: VEC, sourceName: 'Victorian Electoral Commission', notes: 'Polls 8am–6pm AEDT (time shown is poll close).', link: '/au/victoria' },
  { id: 'act-sit-dec', date: '2026-12-01', end: '2026-12-03', title: 'ACT Legislative Assembly sitting week', jurisdiction: 'ACT', country: 'AU', type: 'sitting', confidence: 'scheduled', source: 'https://www.parliament.act.gov.au/parliamentary-business/calendar', sourceName: 'ACT Legislative Assembly' },
  { id: 'nsw-election', date: '2027-03-13', time: '18:00', tz: 'Australia/Sydney', title: 'NSW state election', jurisdiction: 'New South Wales', country: 'AU', type: 'election', confidence: 'confirmed', source: 'https://elections.nsw.gov.au/bulletins/2027-nsw-state-election-bulletin-no-2', sourceName: 'NSW Electoral Commission, Bulletin No. 2', notes: 'Moved from 27 March to avoid Easter. Polls close 6pm AEDT.', link: '/au/nsw' },
];

export const RESOURCES = [
  { title: 'Federal Parliament sitting calendar 2026 (PM&C PDF)', url: 'https://www.pmc.gov.au/sites/default/files/resource/download/parliamentary-sitting-calendar-2026.pdf', note: 'Sitting weeks are colour-coded in the PDF and not machine-readable, so they are not listed as events.' },
  { title: 'Special elections to the 119th Congress (Ballotpedia)', url: 'https://ballotpedia.org/Special_elections_to_the_119th_United_States_Congress_(2025-2026)', note: 'No congressional special elections found scheduled for Dec 2026–Jan 2027 as of ' + UPDATED_AT + '.' },
  { title: 'Victoria 2026 Electoral Act amendments (VEC)', url: VEC_ACT },
];

/* ── time helpers (DST-safe wall-clock → UTC) ── */
function tzOffset(ts, tz) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(ts));
  const g = (t) => Number(p.find((x) => x.type === t)?.value ?? 0);
  return Date.UTC(g('year'), g('month') - 1, g('day'), g('hour') % 24, g('minute'), g('second')) - (ts - (ts % 1000));
}
export function zoned(date, hhmm, tz) {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = hhmm.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let ts = guess - tzOffset(guess, tz);
  return guess - tzOffset(ts, tz);
}
const withTs = (e) => (e.time && e.tz ? { ...e, start: zoned(e.date, e.time, e.tz) } : e);

export function filterEvents(params) {
  const c = (params.get('country') || '').toUpperCase();
  const t = params.get('type') || '';
  const id = params.get('id') || '';
  return EVENTS.filter((e) => (!c || e.country === c) && (!t || e.type === t) && (!id || e.id === id))
    .map(withTs)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/* ── iCalendar (RFC 5545) ── */
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const fold = (line) => {
  const out = [];
  let s = line;
  while (s.length > 74) (out.push(s.slice(0, 74)), (s = ' ' + s.slice(74)));
  out.push(s);
  return out.join('\r\n');
};
const dOnly = (iso) => iso.replace(/-/g, '');
const nextDay = (iso) => new Date(Date.parse(iso + 'T00:00:00Z') + 864e5).toISOString().slice(0, 10);
const utc = (ts) => new Date(ts).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

export function toICS(events, name = 'PolTok — Elections & key dates') {
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PolTok//Calendar//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${esc(name)}`, 'X-PUBLISHED-TTL:PT12H', 'REFRESH-INTERVAL;VALUE=DURATION:PT12H'];
  const stamp = utc(Date.parse(UPDATED_AT + 'T00:00:00Z'));
  for (const e of events) {
    L.push('BEGIN:VEVENT', `UID:${e.id}@poltok.netlify.app`, `DTSTAMP:${stamp}`);
    if (e.start) L.push(`DTSTART:${utc(e.start)}`, `DTEND:${utc(e.start + 36e5)}`);
    else L.push(`DTSTART;VALUE=DATE:${dOnly(e.date)}`, `DTEND;VALUE=DATE:${dOnly(nextDay(e.end || e.date))}`);
    L.push(
      `SUMMARY:${esc(e.title)}`,
      `DESCRIPTION:${esc(`${e.jurisdiction} · ${e.type} · ${e.confidence}${e.notes ? '\n' + e.notes : ''}\nSource: ${e.sourceName} ${e.source}`)}`,
      `LOCATION:${esc(e.jurisdiction)}`,
      `URL:${e.source}`,
      `CATEGORIES:${esc(e.type.toUpperCase())}`,
      `STATUS:${e.confidence === 'tentative' ? 'TENTATIVE' : 'CONFIRMED'}`,
      'END:VEVENT',
    );
  }
  L.push('END:VCALENDAR');
  return L.map(fold).join('\r\n') + '\r\n';
}

/** Shared core → { status, body, contentType, maxAge, filename? } */
export function calendarApi(pathname, params) {
  const evs = filterEvents(params);
  if (/\.ics$/.test(pathname)) {
    const id = params.get('id');
    return { status: id && !evs.length ? 404 : 200, body: toICS(evs, id && evs[0] ? evs[0].title : undefined), contentType: 'text/calendar; charset=utf-8', maxAge: 3600, filename: id ? `poltok-${id}.ics` : 'poltok-calendar.ics' };
  }
  return { status: 200, body: JSON.stringify({ events: evs, updatedAt: UPDATED_AT, resources: RESOURCES }), contentType: 'application/json; charset=utf-8', maxAge: 3600 };
}

export function nodeCalendarHandler(p, url, res) {
  const r = calendarApi(p, url.searchParams);
  const h = { 'content-type': r.contentType, 'access-control-allow-origin': '*', 'cache-control': 'public, max-age=600' };
  if (r.filename && url.searchParams.get('dl')) h['content-disposition'] = `attachment; filename="${r.filename}"`;
  res.writeHead(r.status, h);
  res.end(r.body);
}
