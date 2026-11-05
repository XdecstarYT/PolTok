/** Deterministic daily trivia + map challenge built only from real data (live AP calls + baked facts). */
import { RACES, STATES, HOUSE_TOTAL, raceById } from '../../data';
import { FEDERAL, SENATORS, AU_PARTIES } from '../../data/au';
import type { LiveState } from '../../lib/live';
import type { Party } from '../../types';

export interface Q { id: string; q: string; options: string[]; answer: number; explain: string; link?: { to: string; label: string }; source: string }

/** mulberry32 seeded PRNG */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const hash = (s: string) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const pick = <T,>(r: () => number, a: T[]) => a[Math.floor(r() * a.length)];
function shuffle<T>(r: () => number, a: T[]) { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
function mc(r: () => number, correct: string, wrong: string[]) {
  const opts = shuffle(r, [correct, ...shuffle(r, wrong.filter((w) => w !== correct)).slice(0, 3)]);
  return { options: opts, answer: opts.indexOf(correct) };
}
const PN: Record<string, string> = { D: 'Democrats', R: 'Republicans', I: 'Independent', L: 'Libertarian', G: 'Green', O: 'Other' };

export interface CalledRace { id: string; state: string; title: string; chamber: 'senate' | 'governor'; winner: string; party: Party; url?: string }

/** Senate/governor races with a real AP call (live mode only). */
export function calledRaces(live: LiveState): CalledRace[] {
  if (live.mode !== 'live' && live.mode !== 'browser-live') return [];
  const out: CalledRace[] = [];
  for (const res of Object.values(live.results)) {
    const race = raceById.get(res.raceId);
    if (!race || !res.calledFor || (race.chamber !== 'senate' && race.chamber !== 'governor')) continue;
    const c = (res.candidates ?? race.candidates).find((x) => x.id === res.calledFor) ?? race.candidates.find((x) => x.id === res.calledFor);
    if (!c) continue;
    out.push({ id: race.id, state: race.state, title: race.title, chamber: race.chamber, winner: c.name, party: c.party, url: res.sourceUrl });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

export function dailyQuestions(day: string, live: LiveState): Q[] {
  const r = rng(hash(day));
  const pool: (() => Q | null)[] = [];
  const called = calledRaces(live);
  const house = live.balance.house;
  const senate = live.balance.senate;

  if (called.length) {
    pool.push(() => {
      const c = pick(r, called);
      return { id: `call-${c.id}`, q: `Which party won the ${c.title} race?`, ...mc(r, PN[c.party], ['Democrats', 'Republicans', 'Independent']),
        explain: `${c.winner} (${PN[c.party]}) was projected the winner by the AP.`, link: { to: `/race/${c.id}`, label: `Open ${c.title}` }, source: 'AP via NYT results (live)' };
    });
    pool.push(() => {
      const c = pick(r, called);
      const others = RACES.filter((x) => x.chamber === c.chamber && x.id !== c.id).flatMap((x) => x.candidates.map((y) => y.name));
      return { id: `who-${c.id}`, q: `Who won the ${c.title} race?`, ...mc(r, c.winner, shuffle(r, others)),
        explain: `AP projection: ${c.winner} (${PN[c.party]}).`, link: { to: `/race/${c.id}`, label: 'See the race' }, source: 'AP via NYT results (live)' };
    });
  }
  pool.push(() => {
    const total = house?.total ?? HOUSE_TOTAL;
    const maj = house?.majority ?? Math.floor(total / 2) + 1;
    return { id: 'house-maj', q: `How many House seats are needed for a majority?`, ...mc(r, String(maj), ['217', '218', '220', '235', '200'].filter((x) => x !== String(maj))),
      explain: `${maj} of ${total} seats is a majority of the House.`, link: { to: '/house', label: 'House tracker' }, source: 'US House (435 seats)' };
  });
  pool.push(() => {
    const maj = senate?.majority ?? 51;
    return { id: 'sen-maj', q: 'How many Senate seats does a party need for an outright majority?', ...mc(r, String(maj), ['50', '51', '60', '67']),
      explain: `${maj} of 100. At 50–50 the Vice President breaks ties; 60 is needed to end a filibuster.`, link: { to: '/races', label: 'Senate races' }, source: 'US Senate rules' };
  });
  pool.push(() => {
    const s = pick(r, STATES.filter((x) => x.abbr !== 'DC'));
    return { id: `pres-${s.abbr}`, q: `Which party carried ${s.name} in the 2024 presidential election?`, ...mc(r, PN[s.pres2024.winner], ['Democrats', 'Republicans']),
      explain: `${s.name}: Rep ${s.pres2024.rep.toFixed(1)}% – Dem ${s.pres2024.dem.toFixed(1)}%.`, link: { to: `/state/${s.abbr}`, label: `${s.name} page` }, source: '2024 certified results' };
  });
  pool.push(() => {
    const s = pick(r, STATES.filter((x) => x.ev > 3));
    const ev = s.ev;
    return { id: `ev-${s.abbr}`, q: `How many electoral votes does ${s.name} have?`, ...mc(r, String(ev), [ev - 2, ev + 1, ev + 3, ev - 1].filter((n) => n >= 3).map(String)),
      explain: `${s.name} has ${ev} electoral votes (${s.houseSeats} House seats + 2 senators).`, link: { to: `/state/${s.abbr}`, label: `${s.name} page` }, source: '2020 census apportionment' };
  });
  pool.push(() => ({ id: 'au-house', q: 'How many seats are in Australia’s House of Representatives?', ...mc(r, '150', ['151', '120', '76', '226']),
    explain: '150 seats — 76 are needed to form majority government.', link: { to: '/au', label: 'AU parliament' }, source: 'AEC' }));
  pool.push(() => {
    const alp = FEDERAL.house.ALP;
    return { id: 'au-alp', q: 'How many House seats does Labor hold in the federal parliament?', ...mc(r, String(alp), [alp - 8, alp + 5, 77, 86].map(String)),
      explain: `Labor holds ${alp} of 150 seats (as of ${FEDERAL.houseAsOf}).`, link: { to: '/au', label: 'AU overview' }, source: 'PolTok AU data' };
  });
  pool.push(() => ({ id: 'au-pm', q: 'Who is Australia’s Prime Minister?', ...mc(r, FEDERAL.pm.name, ['Peter Dutton', FEDERAL.opposition.name, 'Scott Morrison', 'Jim Chalmers']),
    explain: `${FEDERAL.pm.name} has been PM since ${FEDERAL.pm.since}.`, link: { to: '/au/party/ALP', label: 'Labor profile' }, source: 'PolTok AU data' }));
  pool.push(() => {
    const seat = pick(r, FEDERAL.seats.filter((x) => AU_PARTIES[x.party]));
    const name = (p: string) => AU_PARTIES[p]?.name ?? p;
    return { id: `au-seat-${seat.id}`, q: `Which party holds the federal seat of ${seat.name} (${seat.state})?`, ...mc(r, name(seat.party), ['ALP', 'LIB', 'NAT', 'GRN', 'IND', 'LNP', 'ONP'].map(name)),
      explain: `${seat.member} holds ${seat.name} on a ${seat.margin != null ? seat.margin.toFixed(1) + "%" : "n/a"} margin.`, link: { to: `/au/seat/${seat.id}`, label: `${seat.name} seat page` }, source: 'AEC 2025 results' };
  });
  pool.push(() => {
    const st = pick(r, ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS']);
    const n = SENATORS.filter((s) => s.state === st).length;
    return { id: `au-sen-${st}`, q: `How many senators represent ${st}?`, ...mc(r, String(n), ['2', '6', '10', '12', '14']),
      explain: `Each state has ${n} senators; the territories have 2 each (76 total).`, link: { to: '/au/senate', label: 'AU Senate' }, source: 'Australian Constitution / AEC' };
  });

  const order = shuffle(r, pool.map((_, i) => i));
  // Prefer live questions first when available
  const out: Q[] = [];
  const liveIdx = called.length ? [0, 1] : [];
  for (const i of [...liveIdx.slice(0, 1), ...order.filter((i) => !liveIdx.slice(0, 1).includes(i))]) {
    const q = pool[i]();
    if (q && !out.some((x) => x.id === q.id)) out.push(q);
    if (out.length === 5) break;
  }
  return out;
}

export function mapRounds(day: string, live: LiveState, n = 8): CalledRace[] {
  const r = rng(hash('map' + day));
  return shuffle(r, calledRaces(live).filter((c) => c.party === 'D' || c.party === 'R')).slice(0, n);
}
