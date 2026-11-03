/**
 * Reference numbers for the forecast lab, transcribed from docs/research/midterms-2026-data.md
 * (compiled Nov 3 2026). Used only where the shared data layer doesn't (yet) provide them.
 */
import type { Race } from '../../types';
import { HOUSE_TOTAL, RACES, SENATE_NOT_UP } from '../../data';

/** Senate seats not on the ballot (from composition: 47 D-caucus / 53 R, 13 D + 22 R seats up). */
const NOT_UP_FALLBACK = { D: 34, R: 31 };

export function senateBase(senateRaces: Race[]) {
  const nu = SENATE_NOT_UP;
  const sum = (nu?.D ?? 0) + (nu?.R ?? 0) + (nu?.I ?? 0);
  const base = sum > 0 ? { D: (nu.D ?? 0) + (nu.I ?? 0), R: nu.R ?? 0 } : NOT_UP_FALLBACK;
  // If counts don't add to 100 (data still loading), pad R/D proportionally so math stays sane.
  const total = base.D + base.R + senateRaces.length;
  return { ...base, total: Math.max(100, total), consistent: total === 100 };
}

/** Cook Political Report House totals, Nov 2 2026 (D-leaning / R-leaning / Toss-up). */
export const COOK_HOUSE = { D: 222, R: 195, tossup: 18, date: '2026-11-02' };

export const HOUSE_SEATS = HOUSE_TOTAL || 435;

/** Last real market quotes before Election Day (for comparison with simulated markets). */
export const MARKET_REFERENCE = {
  asOf: 'Nov 2, 2026, noon ET',
  rows: [
    { source: 'Kalshi', chamber: 'senate' as const, dem: 0.74 },
    { source: 'Polymarket', chamber: 'senate' as const, dem: 0.72 },
    { source: 'Kalshi', chamber: 'house' as const, dem: 0.94 },
    { source: 'Polymarket', chamber: 'house' as const, dem: 0.95 },
  ],
};

export const senateRaces = () => RACES.filter((r) => r.chamber === 'senate');
export const houseRaces = () => RACES.filter((r) => r.chamber === 'house');
