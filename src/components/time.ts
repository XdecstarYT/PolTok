/** Time helpers for Election Night (all poll-closing times in the data are US Eastern). */
export const ELECTION_DATE = '2026-11-03';
export const ET = 'America/New_York';

/** Offset (ms) of `tz` from UTC at instant `ts`. */
function tzOffset(ts: number, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(ts));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUTC = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
  return asUTC - (ts - (ts % 1000));
}

/**
 * Epoch ms for a wall-clock time in a time zone (DST-safe).
 * zonedTime('2026-11-03', '20:00') → 8pm Eastern on election day.
 */
export function zonedTime(dateISO: string, hhmm: string, tz = ET): number {
  const [y, m, d] = dateISO.split('-').map(Number);
  const [hh, mm] = hhmm.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh || 0, mm || 0);
  let ts = guess - tzOffset(guess, tz);
  ts = guess - tzOffset(ts, tz); // second pass handles DST boundaries
  return ts;
}

/* ── Display time zone (user setting) ─────────────────────────────────────────
 * The data is in US Eastern, but every time shown in the UI is rendered in the
 * viewer's chosen zone (Settings → Time zone). The App remounts when it changes. */
let DISPLAY_TZ = ET;
export const LOCAL_TZ = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || ET;
  } catch {
    return ET;
  }
})();
export function setDisplayTZ(tz: string) {
  DISPLAY_TZ = tz === 'local' ? LOCAL_TZ : tz;
}
export const displayTZ = () => DISPLAY_TZ;

const ABBR: Record<string, string> = { 'America/New_York': 'ET', 'America/Chicago': 'CT', 'America/Denver': 'MT', 'America/Phoenix': 'MST', 'America/Los_Angeles': 'PT', 'Pacific/Honolulu': 'HT', 'America/Anchorage': 'AKT', UTC: 'UTC' };
/** Short zone label for the display zone at `ts`: "ET", "AEDT", "BST", … */
export function tzAbbr(ts = Date.now(), tz = DISPLAY_TZ): string {
  if (ABBR[tz]) return ABBR[tz];
  const locale = tz.startsWith('Australia/') ? 'en-AU' : tz.startsWith('Europe/') ? 'en-GB' : 'en-US';
  try {
    const p = new Intl.DateTimeFormat(locale, { timeZone: tz, timeZoneName: 'short' }).formatToParts(new Date(ts));
    return p.find((x) => x.type === 'timeZoneName')?.value ?? tz;
  } catch {
    return tz;
  }
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function dtf(opts: Intl.DateTimeFormatOptions) {
  const key = DISPLAY_TZ + JSON.stringify(opts);
  let f = fmtCache.get(key);
  if (!f) fmtCache.set(key, (f = new Intl.DateTimeFormat('en-US', { timeZone: DISPLAY_TZ, ...opts })));
  return f;
}
/** "8:05 PM" in the display zone (seconds optional). */
export function fmtTime(ts: number, seconds = false): string {
  return dtf({ hour: 'numeric', minute: '2-digit', ...(seconds ? { second: '2-digit' } : {}) }).format(new Date(ts));
}
/** "Tuesday, Nov 3" in the display zone. */
export function fmtDay(ts: number, weekday: 'long' | 'short' = 'long'): string {
  return dtf({ weekday, month: 'short', day: 'numeric' }).format(new Date(ts));
}

/** "8:00 PM ET" — in the display zone, with its label. */
export function fmtET(ts: number, withZone = true): string {
  const s = fmtTime(ts);
  return withZone ? `${s} ${tzAbbr(ts)}` : s;
}

/** Epoch ms for an election-night Eastern "HH:MM" (hours ≥ 24 = Nov 4). */
export function etClockToTs(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return zonedTime(ELECTION_DATE, '00:00') + ((h || 0) * 60 + (m || 0)) * 60000;
}

/** Election-night Eastern "20:00" → "8 PM" / "8:30 PM" in the display zone (no zone label). */
export function fmtHHMM(hhmm: string): string {
  const ts = etClockToTs(hhmm);
  const s = fmtTime(ts);
  return s.replace(':00 ', ' ');
}

/** Split a duration into h/m/s (clamped at 0). */
export function splitDuration(ms: number) {
  const t = Math.max(0, Math.floor(ms / 1000));
  return { h: Math.floor(t / 3600), m: Math.floor((t % 3600) / 60), s: t % 60, total: t };
}
