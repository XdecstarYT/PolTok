/** Ready-to-post X/Twitter copy generated from live app data. Every tweet ≤ 280 chars incl. link. */
import type { LiveState } from '../../lib/live';
import type { Candidate, Race, RaceResult } from '../../types';
import { RACES, raceById, POLL_SERIES } from '../../data';
import { VICTORIA, FEDERAL } from '../../data/au';
import type { FlipRace } from '../flips/data';
import type { Subject } from './cards';

export const SITE = 'https://poltok.netlify.app';
export interface Tweet {
  id: string;
  group: 'Results' | 'Races' | 'Polls & markets' | 'Australia' | 'Features';
  text: string; // body incl. hashtags (no link)
  path: string; // deep link path
  subject: Subject;
  hints: string[]; // design-matching hints
}

const URL_LEN = 23; // X counts every link as 23 chars
export const linkFor = (t: Pick<Tweet, 'path'>) => SITE + t.path;
export const fullText = (t: Pick<Tweet, 'text' | 'path'>) => `${t.text}\n${linkFor(t)}`;
export const weight = (t: Pick<Tweet, 'text'>) => [...t.text].length + 1 + URL_LEN;
function fit(body: string, tags: string) {
  const max = 280 - URL_LEN - 2 - [...tags].length;
  const b = [...body].length > max ? [...body].slice(0, max - 1).join('').trimEnd() + '…' : body;
  return `${b}\n${tags}`;
}

const SIDE = (p: string) => (p === 'I' ? 'D' : p);
const PN: Record<string, string> = { D: 'Dems', R: 'GOP', I: 'Ind', L: 'Lib', G: 'Green', O: 'Other' };
const pct = (n: number) => `${n.toFixed(1)}%`;

interface Line { c: Candidate; votes: number; pct: number }
function lines(race: Race, r?: RaceResult): Line[] {
  const cands = r?.candidates?.length ? r.candidates : race.candidates;
  const total = r ? Object.values(r.votes).reduce((a, b) => a + b, 0) : 0;
  return cands.map((c) => ({ c, votes: r?.votes[c.id] || 0, pct: total ? (100 * (r?.votes[c.id] || 0)) / total : 0 })).sort((a, b) => b.votes - a.votes);
}
const tag = (race: Race) => `#${race.state}${race.chamber === 'senate' ? 'Sen' : race.chamber === 'governor' ? 'Gov' : race.district ? String(race.district).padStart(2, '0') : ''}`;
const raceSubj = (id: string): Subject => ({ kind: 'race', id });

export function buildTweets(live: LiveState, flips: FlipRace[] | null, now = Date.now()): Tweet[] {
  const out: Tweet[] = [];
  const add = (t: Omit<Tweet, 'id'>) => out.push({ ...t, id: `t${out.length + 1}` });
  const isSim = live.source === 'simulation' || live.mode.includes('simulation');
  const simNote = isSim ? ' (demo replay)' : '';
  const results = Object.values(live.results);

  // ---- balance of power
  for (const ch of ['senate', 'house'] as const) {
    const b = live.balance[ch];
    if (!b) continue;
    const dem = b.dem + b.ind;
    const lead = dem === b.rep ? 'tied' : dem > b.rep ? `Dems lead ${dem}–${b.rep}` : `GOP leads ${b.rep}–${dem}`;
    add({
      group: 'Results',
      text: fit(`🏛️ ${ch === 'senate' ? 'SENATE' : 'HOUSE'} CONTROL${simNote}: ${lead} with ${b.undecided} seats still undecided. ${b.majority} needed for a majority.${b.controlProb ? ` Model odds: D ${Math.round(b.controlProb.D * 100)}% / R ${Math.round(b.controlProb.R * 100)}%.` : ''}\n\nLive tracker 👇`, `#Midterms2026 #${ch === 'senate' ? 'Senate' : 'House'}`),
      path: ch === 'senate' ? '/live' : '/house',
      subject: { kind: 'balance', id: ch },
      hints: ['balance', 'chamber', 'seat'],
    });
  }

  // ---- latest calls
  for (const c of live.calls.filter((c) => !c.preview).slice(0, 4)) {
    const race = raceById.get(c.raceId);
    if (!race) continue;
    const r = live.results[c.raceId];
    const ls = lines(race, r);
    const w = ls.find((l) => l.c.id === c.candidateId);
    if (!w) continue;
    add({
      group: 'Results',
      text: fit(`🚨 CALL${simNote}: ${w.c.name} (${w.c.party}) wins the ${race.title}${c.flip ? ' — a FLIP 🔄' : ''}. ${pct(w.pct)} with ${Math.round(r?.expectedPct ?? 0)}% of the expected vote in.`, `#ElectionNight ${tag(race)}`),
      path: `/race/${race.id}`,
      subject: raceSubj(race.id),
      hints: ['call', 'winner', 'race', 'result'],
    });
  }

  // ---- closest races (counting, uncalled)
  const close = results
    .filter((r) => !r.calledFor && r.expectedPct > 5 && raceById.get(r.raceId))
    .map((r) => {
      const ls = lines(raceById.get(r.raceId)!, r);
      return { r, race: raceById.get(r.raceId)!, ls, margin: (ls[0]?.pct ?? 0) - (ls[1]?.pct ?? 0) };
    })
    .filter((x) => x.ls.length >= 2)
    .sort((a, b) => a.margin - b.margin);
  close.slice(0, 3).forEach((x, i) => {
    add({
      group: 'Races',
      text: fit(`${i === 0 ? '😬 CLOSEST RACE RIGHT NOW' : '🔥 Nail-biter'}${simNote}: ${x.race.title}. ${x.ls[0].c.name} (${x.ls[0].c.party}) ${pct(x.ls[0].pct)} vs ${x.ls[1].c.name} (${x.ls[1].c.party}) ${pct(x.ls[1].pct)} — a ${x.margin.toFixed(1)}-pt gap with ${Math.round(x.r.expectedPct)}% counted.`, `#ElectionNight ${tag(x.race)}`),
      path: `/race/${x.race.id}`,
      subject: raceSubj(x.race.id),
      hints: ['race', 'close', 'versus', 'vs', 'head'],
    });
  });

  // ---- tallies
  const called = results.filter((r) => r.calledFor).length;
  if (results.length) {
    add({
      group: 'Results',
      text: fit(`📊 Scoreboard${simNote}: ${called} of ${results.length} tracked races called, ${results.length - called} still counting.\n\nEvery Senate, House & governor race in one live dashboard.`, '#Midterms2026 #ElectionResults'),
      path: '/races',
      subject: { kind: 'balance', id: 'senate' },
      hints: ['scoreboard', 'stat', 'balance'],
    });
  }
  const govs = results.filter((r) => r.calledFor && raceById.get(r.raceId)?.chamber === 'governor');
  if (govs.length) {
    const by: Record<string, number> = {};
    for (const r of govs) {
      const p = SIDE(lines(raceById.get(r.raceId)!, r).find((l) => l.c.id === r.calledFor)?.c.party ?? 'O');
      by[p] = (by[p] || 0) + 1;
    }
    add({
      group: 'Results',
      text: fit(`🏠 GOVERNORS${simNote}: ${Object.entries(by).map(([p, n]) => `${PN[p] ?? p} ${n}`).join(', ')} of ${govs.length} called so far. See every mansion on the map.`, '#Governor #Midterms2026'),
      path: '/governors',
      subject: raceSubj(govs[0].raceId),
      hints: ['governor', 'map', 'stat'],
    });
  }

  // ---- flips (real AP via NYT)
  const flipped = (flips ?? []).filter((f) => f.flipped && f.winner).sort((a, b) => (b.calledAt ?? 0) - (a.calledAt ?? 0));
  if (flipped.length) {
    const f = flipped.find((x) => x.office !== 'house') ?? flipped[0];
    add({
      group: 'Results',
      text: fit(`🔄 FLIP OF THE NIGHT: ${f.winner!.name} (${f.winner!.party}) takes ${f.label} from the ${PN[f.before ?? 'O'] ?? f.before}. ${pct(f.winner!.pct)} with ${Math.round(f.eevp)}% in. [AP via NYT]`, `#ElectionNight #${f.state}`),
      path: '/flips',
      subject: raceSubj(raceById.has(`${f.state}-${f.office === 'senate' ? 'SEN' : 'GOV'}`) ? `${f.state}-${f.office === 'senate' ? 'SEN' : 'GOV'}` : RACES.find((r) => r.key)?.id ?? RACES[0].id),
      hints: ['flip', 'call', 'winner'],
    });
    const d = flipped.filter((x) => SIDE(x.winner!.party) === 'D').length;
    add({
      group: 'Results',
      text: fit(`🔄 Flip tracker: ${flipped.length} seats have changed hands so far — ${d} to Dems, ${flipped.length - d} to the GOP/others. Every flip, with margins, in one place. [AP via NYT]`, '#Midterms2026 #Flips'),
      path: '/flips',
      subject: { kind: 'balance', id: 'house' },
      hints: ['flip', 'stat', 'list'],
    });
  }

  // ---- key races uncalled
  const keyOpen = RACES.filter((r) => r.key && !live.results[r.id]?.calledFor).slice(0, 4);
  if (keyOpen.length) {
    add({
      group: 'Races',
      text: fit(`👀 Still waiting on: ${keyOpen.map((r) => r.title.replace(' Senate', ' Sen').replace(' Governor', ' Gov')).join(', ')}. Follow each count live — no refresh needed.`, '#ElectionNight #Midterms2026'),
      path: '/watch',
      subject: raceSubj(keyOpen[0].id),
      hints: ['race', 'watch', 'list'],
    });
  }

  // ---- markets
  const m = live.markets.find((x) => /senate|house/i.test(x.question)) ?? live.markets[0];
  if (m && m.outcomes.length) {
    const top = [...m.outcomes].sort((a, b) => b.prob - a.prob)[0];
    add({
      group: 'Polls & markets',
      text: fit(`💸 Prediction markets: "${m.question}" — ${top.label} at ${Math.round(top.prob * 100)}%. [${m.source}] Markets, model and votes side by side.`, '#Polymarket #Midterms2026'),
      path: '/forecast',
      subject: { kind: 'balance', id: /house/i.test(m.question) ? 'house' : 'senate' },
      hints: ['market', 'odds', 'gauge', 'stat'],
    });
  }

  // ---- polls
  const avg = (id: string, keys: string[]) => {
    const s = POLL_SERIES.find((p) => p.id === id);
    const ps = s ? [...s.polls].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8) : [];
    return ps.length ? keys.map((k) => ps.reduce((a, p) => a + (p.values[k] ?? 0), 0) / ps.length) : null;
  };
  const gb = avg('generic-ballot', ['D', 'R']);
  if (gb) add({ group: 'Polls & markets', text: fit(`🗳️ Generic ballot, average of the last 8 polls: Dems ${pct(gb[0])}, GOP ${pct(gb[1])} — ${gb[0] >= gb[1] ? 'D' : 'R'}+${Math.abs(gb[0] - gb[1]).toFixed(1)}. Every poll, charted.`, '#Polls #Midterms2026'), path: '/polls', subject: { kind: 'balance', id: 'house' }, hints: ['poll', 'chart', 'stat'] });
  const ap = avg('trump-approval', ['approve', 'disapprove']);
  if (ap) add({ group: 'Polls & markets', text: fit(`📉 Trump approval, last 8 polls: ${pct(ap[0])} approve / ${pct(ap[1])} disapprove (net ${(ap[0] - ap[1]).toFixed(1)}).`, '#Polls #TrumpApproval'), path: '/polls', subject: { kind: 'balance', id: 'senate' }, hints: ['poll', 'chart', 'stat'] });

  // ---- Australia
  const days = Math.ceil((Date.parse(VICTORIA.pollsCloseUtc) - now) / 86400000);
  if (days > 0) {
    add({
      group: 'Australia',
      text: fit(`🇦🇺 ${days} day${days === 1 ? '' : 's'} until Victoria votes (Sat 28 Nov). ${VICTORIA.premier.name} (${VICTORIA.premier.party}) vs ${VICTORIA.opposition.name} (${VICTORIA.opposition.party}) — ${VICTORIA.majority} of ${VICTORIA.totalSeats} seats for majority. Every seat, every margin:`, '#VicVotes #springst #auspol'),
      path: '/au/victoria',
      subject: { kind: 'promo', id: 'vic-countdown' },
      hints: ['countdown', 'au', 'promo'],
    });
  }
  const vicMarg = VICTORIA.seats.filter((s) => s.margin != null).sort((a, b) => (a.margin ?? 99) - (b.margin ?? 99));
  vicMarg.slice(0, 2).forEach((s, i) => {
    add({
      group: 'Australia',
      text: fit(`📍 ${i === 0 ? 'Victoria’s most marginal seat' : 'Another one to watch'}: ${s.name}, held by ${s.member} (${s.party}) on just ${s.margin!.toFixed(1)}%${s.contest ? ` (${s.contest})` : ''}. Seat profile, candidates & swing:`, '#VicVotes #springst'),
      path: `/au/seat/${s.id}`,
      subject: { kind: 'au-seat', id: s.id },
      hints: ['seat', 'au', 'margin'],
    });
  });
  const fedMarg = FEDERAL.seats.filter((s) => s.margin != null).sort((a, b) => (a.margin ?? 99) - (b.margin ?? 99))[0];
  if (fedMarg) add({ group: 'Australia', text: fit(`🇦🇺 Federal knife-edge: ${fedMarg.name} (${fedMarg.state}) — ${fedMarg.member} (${fedMarg.party}) holds it by ${fedMarg.margin!.toFixed(1)}%. All 150 seats on the pendulum.`, '#auspol'), path: `/au/seat/${fedMarg.id}`, subject: { kind: 'au-seat', id: fedMarg.id }, hints: ['seat', 'au', 'margin'] });

  // ---- feature promos
  const P = (text: string, tags: string, path: string, id: string, hints: string[]) => add({ group: 'Features', text: fit(text, tags), path, subject: { kind: 'promo', id }, hints: ['promo', ...hints] });
  P('🗺️ The election map, but alive. Watch every state and House seat shift as votes come in — tap anywhere to drill down.', '#Midterms2026 #ElectionMap', '/map', 'map', ['map']);
  P('🤖 Ask PolTok anything about tonight: "Who’s winning Georgia?" "What’s still uncalled?" Answers grounded only in live results, with sources cited.', '#AI #ElectionNight', '/ask', 'ask', ['ai', 'ask']);
  P('📱 Politics, but scroll-native. The PolTok feed: race calls, flips and headlines in a vertical swipe — built for your thumb.', '#PolTok #Politics', '/feed', 'feed', ['feed', 'story']);
  P('🏛️ What’s Congress actually voting on? Our parliament tracker pulls bills & roll-call votes straight from official sources — US and Australia.', '#Congress #auspol', '/parliament', 'parliament', ['parliament', 'bill']);
  P('🎚️ Drag the swingometer and watch Victoria’s seats fall. How big a swing does it take to change government? Try it.', '#VicVotes #springst #auspol', '/au/swingometer', 'swingometer', ['swing', 'au']);
  P('📰 Same story, every angle. PolTok’s news wire tags each outlet Left/Center/Right so you can see the whole picture at once.', '#News #MediaBias', '/news', 'news', ['news']);
  P('⚡ Election night command center: live calls, balance of power, needles and the race ticker — all on one screen.', '#ElectionNight #Midterms2026', '/live', 'live', ['live']);
  P('⭐ Only care about a few races? Star them and PolTok builds your personal watchlist with live alerts.', '#Midterms2026', '/watch', 'watch', ['watch']);
  P('🔁 Missed the night? Replay it minute-by-minute and watch the calls land in order.', '#ElectionNight', '/replay', 'replay', ['replay']);
  P('🧩 Run a site or newsletter? Embed live PolTok results widgets — free, one line of code.', '#Journalism #DataViz', '/embed', 'embed', ['embed']);
  P('✅ Ballot measures across the country — abortion, minimum wage, redistricting & more — with live yes/no counts. [AP via NYT]', '#BallotMeasures', '/measures', 'measures', ['measures']);
  P('⚖️ Compare any two races side by side: margins, % reporting and the needle, head-to-head.', '#ElectionNight', '/compare', 'compare', ['compare']);
  P('📈 Model vs markets vs polls: our forecast page puts every signal for Senate & House control on one chart.', '#Forecast #Midterms2026', '/forecast', 'forecast', ['forecast', 'chart']);
  P('👤 Every candidate on the ballot, with photos, bios and live vote shares. Find yours.', '#Midterms2026 #Candidates', '/candidates', 'candidates', ['candidate', 'profile']);
  P(`🇦🇺 Who sits in the Senate? All 76 senators by state and party, plus ${FEDERAL.pm.name}’s government at a glance.`, '#auspol #Senate', '/au/senate', 'au-senate', ['au', 'senate']);
  P('🗳️ NSW goes to the polls in March 2027. Seats, margins and the Minns government’s path to re-election — already live on PolTok.', '#nswpol #auspol', '/au/nsw', 'nsw', ['au', 'nsw']);
  return out;
}
