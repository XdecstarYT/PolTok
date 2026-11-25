/** People behind every Victorian seat: 2026 candidates (VEC, ballot order), sitting members, and who the model picks. */
import { VIC_CANDIDATES_2026 } from '../../../data/vic-candidates';
import { auPhotoKey } from '../../../data/au-photo-key';
import { VICTORIA } from '../model';
import type { VicModel } from '../vicLive';

export interface Person { name: string; party: string; partyName: string; bucket: string; seatId: string; seatName: string; ballot?: number; sitting: boolean; leader?: string }

export const bucket = (p: string) => (p === 'ALP' ? 'ALP' : p === 'LIB' || p === 'NAT' || p === 'LNP' ? 'LNP' : p === 'GRN' ? 'GRN' : p === 'ONP' ? 'ONP' : p === 'IND' ? 'IND' : 'OTH');
const PARTY_NAMES: Record<string, string> = { ...VIC_CANDIDATES_2026.parties, ALP: 'Australian Labor Party', LIB: 'Liberal Party', NAT: 'The Nationals', GRN: 'Australian Greens', ONP: "Pauline Hanson's One Nation", IND: 'Independent' };
export const partyName = (p: string) => PARTY_NAMES[p] ?? p;
const LEADERS: Record<string, string> = { 'ben carroll': 'Premier · Labor leader', 'jess wilson': 'Opposition Leader · Liberal leader', 'ellen sandell': 'Greens leader' };

export const SEATS = (VICTORIA.seats ?? []).filter((s) => s.id.startsWith('vic-')).sort((a, b) => a.name.localeCompare(b.name));
export const seatById = new Map(SEATS.map((s) => [s.id, s]));
export const candidatesAsAt = VIC_CANDIDATES_2026.asAt;

export function candidates(seatId: string): Person[] {
  const seat = seatById.get(seatId);
  const memberKey = seat?.member ? auPhotoKey(seat.member) : '';
  return (VIC_CANDIDATES_2026.districts[seatId] ?? []).map(([name, party, ballot]) => {
    const k = auPhotoKey(name);
    return { name, party, partyName: partyName(party), bucket: bucket(party), seatId, seatName: seat?.name ?? seatId, ballot, sitting: !!memberKey && k === memberKey, leader: LEADERS[k] };
  });
}

let all: Person[] | null = null;
export const allCandidates = () => (all ??= SEATS.flatMap((s) => candidates(s.id)));

/** the 2022-elected member as a Person */
export function member2022(seatId: string): Person | null {
  const s = seatById.get(seatId);
  if (!s?.member) return null;
  const p = s.party;
  return { name: s.member, party: p, partyName: partyName(p), bucket: bucket(p), seatId, seatName: s.name, sitting: true, leader: LEADERS[auPhotoKey(s.member)] };
}

/** the candidate standing for a party group in a seat (Coalition: the Liberal or National candidate most likely to hold it) */
export function personFor(seatId: string, group: string, model?: VicModel | null): Person | null {
  const list = candidates(seatId).filter((c) => c.bucket === group);
  if (!list.length) return group === 'IND' && model?.seats[seatId]?.ind ? { name: model.seats[seatId].ind!.n, party: 'IND', partyName: 'Independent', bucket: 'IND', seatId, seatName: seatById.get(seatId)?.name ?? seatId, sitting: false } : null;
  if (list.length === 1) return list[0];
  const sitting = list.find((c) => c.sitting);
  if (sitting) return sitting;
  if (group === 'IND' && model?.seats[seatId]?.ind) { const k = auPhotoKey(model.seats[seatId].ind!.n); return list.find((c) => auPhotoKey(c.name) === k) ?? list[0]; }
  const held = seatById.get(seatId)?.party;
  return list.find((c) => c.party === held) ?? list.find((c) => c.party === 'LIB') ?? list[0];
}
