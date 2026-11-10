/**
 * Suggested posting slots for a US + Australian audience, shown in ET and AEDT (Sydney/Melbourne time).
 * Pure (Intl only) so it can be unit-tested.
 */
export const ET = 'America/New_York';
export const AET = 'Australia/Sydney';

/** UTC offset (minutes) of `tz` at instant `ts`. */
export function tzOffset(ts: number, tz: string): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(ts)
      .map((x) => [x.type, x.value]),
  );
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return Math.round((asUtc - Math.floor(ts / 1000) * 1000) / 60000);
}

/** Epoch ms for wall-clock y-m-d hh:mm in `tz`. */
export function zonedTs(y: number, m: number, d: number, hh: number, mm: number, tz: string): number {
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let ts = guess - tzOffset(guess, tz) * 60000;
  ts = guess - tzOffset(ts, tz) * 60000; // settle across DST edges
  return ts;
}

/** Y/M/D of instant `ts` in `tz`. */
export function ymdIn(ts: number, tz: string): [number, number, number] {
  const s = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ts);
  const [y, m, d] = s.split('-').map(Number);
  return [y, m, d];
}

export interface Slot { ts: number; label: string; why: string }
/** Best-practice windows: [tz, hh, mm, label, why]. */
export const WINDOWS: [string, number, number, string, string][] = [
  [ET, 8, 30, 'US morning', 'US East Coast commute scroll'],
  [ET, 12, 15, 'US lunch', 'Peak US weekday engagement'],
  [ET, 19, 0, 'US evening / AU morning', '7pm ET = 11am AEDT next day: both audiences awake'],
  [AET, 7, 30, 'AU breakfast', 'Australian morning news cycle (3:30pm ET)'],
];

/** Next `n` suggested slots after `now` (optionally skipping already-taken times within 45 min). */
export function suggestSlots(now = Date.now(), n = 6, taken: number[] = []): Slot[] {
  const out: Slot[] = [];
  for (let day = 0; day < 8 && out.length < n * 2; day++) {
    for (const [tz, hh, mm, label, why] of WINDOWS) {
      const [y, m, d] = ymdIn(now + day * 864e5, tz);
      const ts = zonedTs(y, m, d, hh, mm, tz);
      if (ts <= now + 10 * 60000) continue;
      if (taken.some((t) => Math.abs(t - ts) < 45 * 60000)) continue;
      if (out.some((s) => Math.abs(s.ts - ts) < 30 * 60000)) continue;
      out.push({ ts, label, why });
    }
  }
  return out.sort((a, b) => a.ts - b.ts).slice(0, n);
}

/** "Tue 10 Nov, 8:30 AM ET · Wed 11 Nov, 12:30 AM AEDT" */
export function fmtIn(ts: number, tz: string): string {
  const s = new Intl.DateTimeFormat('en-AU', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }).format(ts);
  const abbr = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' }).formatToParts(ts).find((p) => p.type === 'timeZoneName')?.value ?? '';
  const nice = tz === AET ? (tzOffset(ts, AET) === 660 ? 'AEDT' : 'AEST') : tz === ET ? (/^GMT/.test(abbr) ? (tzOffset(ts, ET) === -240 ? 'EDT' : 'EST') : abbr) : abbr;
  return `${s.replace(/\s?(am|pm)/i, (x) => x.toUpperCase())} ${nice}`;
}
export const fmtBoth = (ts: number) => `${fmtIn(ts, ET)} · ${fmtIn(ts, AET)}`;

/** <input type="datetime-local"> value in the browser's zone ↔ epoch ms */
export const toLocalInput = (ts: number) => new Date(ts - new Date(ts).getTimezoneOffset() * 60000).toISOString().slice(0, 16);
