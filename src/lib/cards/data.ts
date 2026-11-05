/** Builds CardData from live results / balance / calls / AU seat data. */
import type { Candidate, Party, Race, RaceResult } from '../../types';
import type { LiveState } from '../live';
import type { CardData, CardKind } from './types';
import { RACES, raceById } from '../../data';
import { PARTY_HEX, PARTY_NAME } from '../format';
import { pColor, party as auParty, seatById, stateName as auStateName, ALL_SEATS } from '../../features/au/model';

export const US_ATTR = 'Results: AP via NYT';
export const AU_ATTR = 'Margins: Wikipedia pendulum (AEC / VEC)';
export const SITE = 'poltok.netlify.app';
const NEUTRAL = '#c6ff3d';
const GREY = '#8b93a7';

type Live = Pick<LiveState, 'results' | 'balance' | 'calls' | 'news' | 'lastUpdate'>;
const side = (p: string) => (p === 'I' ? 'D' : p);
const pHex = (p: string) => PARTY_HEX[p as Party] ?? PARTY_HEX.O;
const chamberLabel = (r: Race) => (r.chamber === 'house' ? 'U.S. House' : r.chamber === 'senate' ? 'U.S. Senate' : 'Governor') + (r.special ? ' (special)' : '');

function cands(race: Race, r?: RaceResult): Candidate[] {
  return r?.candidates?.length ? r.candidates : race.candidates;
}

function raceData(kind: 'race' | 'flip', race: Race, r: RaceResult | undefined): CardData {
  const list = cands(race, r);
  const total = r ? Object.values(r.votes).reduce((a, b) => a + b, 0) : 0;
  const rows = list
    .map((c) => {
      const v = r?.votes[c.id] ?? 0;
      return { c, v, pct: total > 0 ? (v / total) * 100 : 0 };
    })
    .sort((a, b) => b.v - a.v || (a.c.party === 'D' ? -1 : a.c.party === 'R' ? 0 : 1))
    .slice(0, 4);
  const winner = list.find((c) => c.id === r?.calledFor);
  const lead = winner ?? rows[0]?.c;
  const flip = !!winner && side(winner.party) !== side(race.incumbentParty);
  let status: string;
  if (winner) status = flip ? `${PARTY_NAME[winner.party] ?? winner.party} flip · ${winner.name} projected winner` : `Projected winner: ${winner.name}`;
  else if (r?.status === 'too-close') status = `Too close to call · ~${Math.round(r.expectedPct)}% counted`;
  else if (r && r.expectedPct > 0) status = `Counting · ~${Math.round(r.expectedPct)}% of expected vote in`;
  else status = r?.status === 'polls-closed' ? 'Polls closed · awaiting results' : 'Awaiting results';
  if (kind === 'flip' && !flip) status = winner ? `Hold for ${PARTY_NAME[winner.party]}s · ${winner.name}` : `Flip watch · held by ${PARTY_NAME[race.incumbentParty] ?? race.incumbentParty}s`;
  const color = lead && (winner || total > 0) ? pHex(lead.party) : NEUTRAL;
  return {
    kind,
    title: race.title,
    subtitle: `${chamberLabel(race)} · ${status}`,
    stats: rows.map(({ c, pct }) => ({ label: c.name, value: total > 0 ? `${pct.toFixed(1)}%` : '—', color: pHex(c.party) })),
    bars: rows.map(({ c, pct }) => ({ label: c.name, value: pct, color: pHex(c.party) })),
    party: lead?.party,
    color,
    photo: lead?.photo,
    footer: US_ATTR,
    url: SITE,
    mapState: race.state,
  };
}

export function cardDataFor(kind: CardKind, id: string, live: Live): CardData {
  const base = { footer: US_ATTR, url: SITE };
  const calls = live.calls ?? [];
  const results = live.results ?? {};

  if (kind === 'race' || kind === 'flip') {
    let rid = id;
    if (!raceById.has(rid)) {
      const call = calls.find((c) => (kind === 'flip' ? c.flip : true) && !c.preview) ?? calls[0];
      rid = call?.raceId ?? RACES.find((r) => r.key)?.id ?? RACES[0]?.id;
    }
    const race = raceById.get(rid);
    if (!race) return { kind, title: 'No race data yet', subtitle: 'Results appear here once counting starts', ...base };
    return raceData(kind, race, results[rid]);
  }

  if (kind === 'balance') {
    const ch = id === 'house' ? 'house' : 'senate';
    const b = live.balance?.[ch];
    const title = ch === 'senate' ? 'U.S. Senate' : 'U.S. House';
    if (!b) return { kind, title, subtitle: 'Balance of power · awaiting results', ...base };
    const d = b.dem + b.ind;
    const ctl = d >= b.majority ? 'D' : b.rep >= b.majority ? 'R' : undefined;
    return {
      kind,
      title,
      subtitle: ctl ? `${ctl === 'D' ? 'Democrats' : 'Republicans'} win control · ${b.majority} needed` : `${b.majority} seats for control · ${b.undecided} undecided`,
      stats: [
        { label: b.ind ? `Democrats (incl. ${b.ind} ind.)` : 'Democrats', value: String(d), color: PARTY_HEX.D },
        { label: 'Republicans', value: String(b.rep), color: PARTY_HEX.R },
        { label: 'Undecided', value: String(b.undecided), color: GREY },
        { label: 'For control', value: String(b.majority) },
      ],
      bars: [
        { label: 'Democrats', value: b.dem, color: PARTY_HEX.D },
        { label: 'Independents', value: b.ind, color: PARTY_HEX.I },
        { label: 'Undecided', value: b.undecided, color: '#3a4258' },
        { label: 'Republicans', value: b.rep, color: PARTY_HEX.R },
      ],
      party: ctl,
      color: ctl ? pHex(ctl) : NEUTRAL,
      ...base,
    };
  }

  if (kind === 'au-seat') {
    const seat = seatById.get(id) ?? ALL_SEATS.find((s) => s.margin != null);
    if (!seat) return { kind, title: 'Seat not found', footer: AU_ATTR, url: SITE };
    const p = auParty(seat.party);
    const color = pColor(seat.party);
    const m = seat.margin;
    const vs = seat.vs ? auParty(seat.vs) : null;
    return {
      kind,
      title: seat.name,
      subtitle: `${seat.vacant ? 'Vacant' : `${seat.member} · ${p.name}`} · ${auStateName(seat.state)}${seat.chamber === 'vic' ? ' (Vic. Assembly)' : ''}`,
      stats: [
        { label: 'Margin', value: m != null ? `${m.toFixed(1)}%` : '—', color },
        { label: 'Held by', value: p.short, color },
        { label: seat.chamber === 'vic' ? 'Versus' : '2025 contest', value: seat.chamber === 'vic' ? (vs?.short ?? '—') : (seat.contest ?? '—') },
      ],
      bars: m != null ? [
        { label: p.short, value: 50 + m, color },
        { label: vs?.short ?? 'Challenger', value: 50 - m, color: vs ? pColor(seat.vs) : GREY },
      ] : undefined,
      party: p.short,
      color,
      footer: AU_ATTR,
      url: SITE,
      mapState: `AU:${seat.id}`,
    };
  }

  const called = Object.values(results).filter((r) => r.calledFor).length;
  const flips = calls.filter((c) => c.flip && !c.preview).length;
  const counting = Object.values(results).filter((r) => r.expectedPct > 0).length;

  if (kind === 'stat') {
    const sen = live.balance?.senate, house = live.balance?.house;
    const variants: Record<string, CardData> = {
      calls: { kind, title: 'Races called so far', subtitle: `${counting} of ${RACES.length} races reporting votes`, stats: [{ label: 'Races called', value: String(called) }, { label: 'Reporting', value: String(counting) }, { label: 'Tracked', value: String(RACES.length) }], color: NEUTRAL, ...base },
      flips: { kind, title: 'Seats that changed hands', subtitle: 'Projected flips tonight', stats: [{ label: 'Flips', value: String(flips), color: '#ff9f1c' }, { label: 'Dem pickups', value: String(calls.filter((c) => c.flip && !c.preview && side(c.party) === 'D').length), color: PARTY_HEX.D }, { label: 'GOP pickups', value: String(calls.filter((c) => c.flip && !c.preview && c.party === 'R').length), color: PARTY_HEX.R }], color: '#ff9f1c', ...base },
      senate: { kind, title: 'Senate seats won', subtitle: sen ? `${sen.majority} needed for control` : 'Awaiting results', stats: sen ? [{ label: 'Dem + Ind', value: String(sen.dem + sen.ind), color: PARTY_HEX.D }, { label: 'Rep', value: String(sen.rep), color: PARTY_HEX.R }, { label: 'Undecided', value: String(sen.undecided), color: GREY }] : [{ label: 'Seats', value: '100' }], color: NEUTRAL, ...base },
      house: { kind, title: 'House seats won', subtitle: house ? `${house.majority} needed for control` : 'Awaiting results', stats: house ? [{ label: 'Dem', value: String(house.dem + house.ind), color: PARTY_HEX.D }, { label: 'Rep', value: String(house.rep), color: PARTY_HEX.R }, { label: 'Undecided', value: String(house.undecided), color: GREY }] : [{ label: 'Seats', value: '435' }], color: NEUTRAL, ...base },
    };
    const auClose = ALL_SEATS.filter((s) => s.chamber === 'federal' && s.margin != null && s.margin < 2).length;
    variants['au-marginal'] = { kind, title: 'Federal seats on a knife-edge', subtitle: 'Held by less than 2% (two-party preferred)', stats: [{ label: 'Seats under 2%', value: String(auClose), color: '#ffb000' }, { label: 'Federal seats', value: String(ALL_SEATS.filter((s) => s.chamber === 'federal').length) }], color: '#ffb000', footer: AU_ATTR, url: SITE };
    return variants[id] ?? variants.calls;
  }

  if (kind === 'quote') {
    const n = (live.news ?? []).find((x) => x.id === id) ?? (live.news ?? [])[0];
    if (n) return { kind, title: n.title, subtitle: n.source, color: NEUTRAL, ...base, footer: `${n.source} via PolTok · ${US_ATTR}` };
    return { kind, title: 'Every race, every call, the moment it happens.', subtitle: 'PolTok', color: NEUTRAL, ...base };
  }

  // promo
  const promos: Record<string, CardData> = {
    default: { kind, title: 'Every race. Every call. Live.', subtitle: 'Senate, House & governor results as they come in — free, fast, no paywall.', stats: [{ label: 'Races tracked', value: String(RACES.length) }, { label: 'Called', value: String(called) }, { label: 'Flips', value: String(flips) }], color: NEUTRAL, ...base },
    live: { kind, title: 'Results are coming in now', subtitle: `${counting} races reporting · ${called} called · follow along live`, stats: [{ label: 'Reporting', value: String(counting) }, { label: 'Called', value: String(called) }], color: '#ff3d55', ...base },
    map: { kind, title: 'Watch the map fill in', subtitle: 'Interactive results map, race calls and flips in real time.', stats: [{ label: 'States', value: '50' }, { label: 'Races', value: String(RACES.length) }], color: NEUTRAL, mapState: 'PA', ...base },
    au: { kind, title: 'Australian politics, seat by seat', subtitle: 'Federal & Victorian pendulums, marginal seats and polling.', stats: [{ label: 'Seats', value: String(ALL_SEATS.length) }], color: '#ffb000', footer: AU_ATTR, url: SITE, mapState: 'AU:kooyong' },
  };
  return promos[id] ?? promos.default;
}
