import { POLL_SERIES } from '../../data/polls';
import type { Rating } from '../../types';
import { COOK_HOUSE, HOUSE_SEATS, racesFor, senateBase } from './forecastData';
import { RATING_MEAN, RATING_SIGMA, seatFromRace, type SimModel, type SimSeat } from './sim';

const D_LEAN: Rating[] = ['Solid D', 'Likely D', 'Lean D'];
const R_LEAN: Rating[] = ['Solid R', 'Likely R', 'Lean R'];

export function buildSenateModel(): SimModel & { fromResearch: boolean; consistent: boolean } {
  const { races, fromResearch } = racesFor('senate');
  const base = senateBase(races);
  const seats = races.map((r) => seatFromRace(r, POLL_SERIES));
  return {
    chamber: 'senate',
    seats,
    baseD: base.D,
    baseR: base.R,
    total: base.total,
    dNeeds: 51,
    rNeeds: base.total - 50, // 50-50 → VP JD Vance (R) breaks the tie
    fromResearch,
    consistent: base.consistent,
  };
}

export function buildHouseModel(): SimModel & { fromResearch: boolean; listed: number; buckets: { d: number; r: number; t: number } } {
  const { races, fromResearch } = racesFor('house');
  const seats: SimSeat[] = races.map((r) => seatFromRace(r, POLL_SERIES));
  const listedD = races.filter((r) => D_LEAN.includes(r.rating)).length;
  const listedR = races.filter((r) => R_LEAN.includes(r.rating)).length;
  const listedT = races.filter((r) => r.rating === 'Toss-up').length;
  const remaining = Math.max(0, HOUSE_SEATS - races.length);
  let d = Math.max(0, COOK_HOUSE.D - listedD);
  let r = Math.max(0, COOK_HOUSE.R - listedR);
  let t = Math.max(0, COOK_HOUSE.tossup - listedT);
  // reconcile to the number of unlisted seats
  const diff = remaining - (d + r + t);
  if (diff !== 0) {
    const share = d + r || 1;
    d = Math.max(0, d + Math.round((diff * d) / share));
    r = Math.max(0, remaining - d - t);
  }
  const bucket = (id: string, title: string, rating: Rating, weight: number, prior: number): SimSeat => ({
    id, state: '', title, rating, prior, sigma: RATING_SIGMA[rating], dSide: 'D', weight,
  });
  if (d > 0) seats.push(bucket('HOUSE-SAFE-D', 'Unlisted D-leaning seats', 'Solid D', d, RATING_MEAN['Solid D'] + 4));
  if (r > 0) seats.push(bucket('HOUSE-SAFE-R', 'Unlisted R-leaning seats', 'Solid R', r, RATING_MEAN['Solid R'] - 4));
  if (t > 0) seats.push(bucket('HOUSE-TOSS', 'Unlisted toss-ups', 'Toss-up', t, 0));
  return {
    chamber: 'house',
    seats,
    baseD: 0,
    baseR: 0,
    total: HOUSE_SEATS,
    dNeeds: Math.floor(HOUSE_SEATS / 2) + 1,
    rNeeds: Math.floor(HOUSE_SEATS / 2) + 1,
    fromResearch,
    listed: races.length,
    buckets: { d, r, t },
  };
}
