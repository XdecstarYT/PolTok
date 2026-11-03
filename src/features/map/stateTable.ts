/**
 * Map-local fallback table for all 50 states + DC. Used when shared data is
 * missing/partial (the data agent may still be filling STATES). Real values in
 * `src/data` always win — see `getState()` below.
 *
 * hex = tile-grid position (odd rows are offset half a tile to the right).
 * ev  = 2024-apportioned electoral votes. m24 = approx. 2024 presidential margin
 * (D minus R, percentage points; positive = Harris).
 */
import type { StateInfo } from '../../types';
import { stateByAbbr, stateByFips, STATES } from '../../data';

export interface MapState {
  abbr: string;
  fips: string;
  name: string;
  ev: number;
  col: number;
  row: number;
  m24: number;
}

// prettier-ignore
const RAW: [string, string, string, number, number, number, number][] = [
  // abbr, fips, name, ev, col, row, margin24
  ['AK', '02', 'Alaska', 3, 0, 0, -13.1],
  ['ME', '23', 'Maine', 4, 10, 0, 7.0],
  ['WI', '55', 'Wisconsin', 10, 5, 1, -0.9],
  ['VT', '50', 'Vermont', 3, 9, 1, 31.5],
  ['NH', '33', 'New Hampshire', 4, 10, 1, 2.8],
  ['WA', '53', 'Washington', 12, 0, 2, 18.2],
  ['ID', '16', 'Idaho', 4, 1, 2, -36.5],
  ['MT', '30', 'Montana', 4, 2, 2, -19.9],
  ['ND', '38', 'North Dakota', 3, 3, 2, -36.5],
  ['MN', '27', 'Minnesota', 10, 4, 2, 4.2],
  ['IL', '17', 'Illinois', 19, 5, 2, 10.9],
  ['MI', '26', 'Michigan', 15, 6, 2, -1.4],
  ['NY', '36', 'New York', 28, 8, 2, 12.6],
  ['MA', '25', 'Massachusetts', 11, 9, 2, 25.2],
  ['OR', '41', 'Oregon', 8, 0, 3, 14.3],
  ['NV', '32', 'Nevada', 6, 1, 3, -3.1],
  ['WY', '56', 'Wyoming', 3, 2, 3, -45.8],
  ['SD', '46', 'South Dakota', 3, 3, 3, -29.2],
  ['IA', '19', 'Iowa', 6, 4, 3, -13.2],
  ['IN', '18', 'Indiana', 11, 5, 3, -19.0],
  ['OH', '39', 'Ohio', 17, 6, 3, -11.2],
  ['PA', '42', 'Pennsylvania', 19, 7, 3, -1.7],
  ['NJ', '34', 'New Jersey', 14, 8, 3, 5.9],
  ['CT', '09', 'Connecticut', 7, 9, 3, 14.5],
  ['RI', '44', 'Rhode Island', 4, 10, 3, 13.8],
  ['CA', '06', 'California', 54, 0, 4, 20.1],
  ['UT', '49', 'Utah', 6, 1, 4, -21.6],
  ['CO', '08', 'Colorado', 10, 2, 4, 11.0],
  ['NE', '31', 'Nebraska', 5, 3, 4, -20.5],
  ['MO', '29', 'Missouri', 10, 4, 4, -18.4],
  ['KY', '21', 'Kentucky', 8, 5, 4, -30.5],
  ['WV', '54', 'West Virginia', 4, 6, 4, -41.9],
  ['VA', '51', 'Virginia', 13, 7, 4, 5.8],
  ['MD', '24', 'Maryland', 10, 8, 4, 28.5],
  ['DE', '10', 'Delaware', 3, 9, 4, 14.7],
  ['AZ', '04', 'Arizona', 11, 1, 5, -5.5],
  ['NM', '35', 'New Mexico', 5, 2, 5, 6.0],
  ['KS', '20', 'Kansas', 6, 3, 5, -16.1],
  ['AR', '05', 'Arkansas', 6, 4, 5, -30.6],
  ['TN', '47', 'Tennessee', 11, 5, 5, -29.7],
  ['NC', '37', 'North Carolina', 16, 6, 5, -3.2],
  ['SC', '45', 'South Carolina', 9, 7, 5, -17.8],
  ['DC', '11', 'District of Columbia', 3, 8, 5, 83.8],
  ['OK', '40', 'Oklahoma', 7, 3, 6, -34.3],
  ['LA', '22', 'Louisiana', 8, 4, 6, -22.0],
  ['MS', '28', 'Mississippi', 6, 5, 6, -22.9],
  ['AL', '01', 'Alabama', 9, 6, 6, -30.5],
  ['GA', '13', 'Georgia', 16, 7, 6, -2.2],
  ['HI', '15', 'Hawaii', 4, 0, 7, 23.1],
  ['TX', '48', 'Texas', 40, 3, 7, -13.7],
  ['FL', '12', 'Florida', 30, 8, 7, -13.1],
];

export const FALLBACK_STATES: MapState[] = RAW.map(([abbr, fips, name, ev, col, row, m24]) => ({ abbr, fips, name, ev, col, row, m24 }));
export const FALLBACK_BY_ABBR = new Map(FALLBACK_STATES.map((s) => [s.abbr, s]));
export const FALLBACK_BY_FIPS = new Map(FALLBACK_STATES.map((s) => [s.fips, s]));
/** All 51 abbrs in a stable order. */
export const ALL_ABBRS = FALLBACK_STATES.map((s) => s.abbr);

/** True when the shared data supplies a complete, collision-free hex layout. */
function dataHexUsable(): boolean {
  if (!Array.isArray(STATES) || STATES.length < 51) return false;
  const seen = new Set<string>();
  for (const a of ALL_ABBRS) {
    const s = stateByAbbr.get(a);
    if (!s?.hex || typeof s.hex.col !== 'number' || typeof s.hex.row !== 'number') return false;
    const k = `${s.hex.col},${s.hex.row}`;
    if (seen.has(k)) return false;
    seen.add(k);
  }
  return true;
}
const USE_DATA_HEX = dataHexUsable();

export function hexPos(abbr: string): { col: number; row: number } | undefined {
  if (USE_DATA_HEX) {
    const s = stateByAbbr.get(abbr);
    if (s?.hex) return s.hex;
  }
  const f = FALLBACK_BY_ABBR.get(abbr);
  return f ? { col: f.col, row: f.row } : undefined;
}

export function abbrFromFips(fips: string): string | undefined {
  return stateByFips.get(fips)?.abbr ?? FALLBACK_BY_FIPS.get(fips)?.abbr;
}

export function stateName(abbr: string): string {
  return stateByAbbr.get(abbr)?.name ?? FALLBACK_BY_ABBR.get(abbr)?.name ?? abbr;
}

export function stateEV(abbr: string): number {
  const s = stateByAbbr.get(abbr);
  if (s && typeof s.ev === 'number' && s.ev > 0) return s.ev;
  return FALLBACK_BY_ABBR.get(abbr)?.ev ?? 0;
}

/** 2024 presidential result (percent), preferring shared data. */
export function pres2024(abbr: string): StateInfo['pres2024'] & { margin: number; approx: boolean } {
  const s = stateByAbbr.get(abbr);
  if (s?.pres2024 && typeof s.pres2024.dem === 'number' && typeof s.pres2024.rep === 'number') {
    return { ...s.pres2024, margin: s.pres2024.dem - s.pres2024.rep, approx: false };
  }
  const m = FALLBACK_BY_ABBR.get(abbr)?.m24 ?? 0;
  // Approximate two-party-ish split from margin; ~1.5% third party.
  const dem = (98.5 + m) / 2;
  const rep = (98.5 - m) / 2;
  return { dem, rep, winner: m >= 0 ? 'D' : 'R', margin: m, approx: true };
}
