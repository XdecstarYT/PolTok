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

/** "8:00 PM ET" */
export function fmtET(ts: number, withZone = true): string {
  const s = new Intl.DateTimeFormat('en-US', { timeZone: ET, hour: 'numeric', minute: '2-digit' }).format(new Date(ts));
  return withZone ? `${s} ET` : s;
}

/** "20:00" → "8 PM" / "8:30 PM" */
export function fmtHHMM(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const hr = ((h + 11) % 12) + 1;
  return `${hr}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h >= 12 ? 'PM' : 'AM'}`;
}

/** Split a duration into h/m/s (clamped at 0). */
export function splitDuration(ms: number) {
  const t = Math.max(0, Math.floor(ms / 1000));
  return { h: Math.floor(t / 3600), m: Math.floor((t % 3600) / 60), s: t % 60, total: t };
}
