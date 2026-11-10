// v2 newspaper headlines. Reads the state (recent log, votes, stats, polls) and writes a few short,
// deterministic headlines. Never touches the RNG: template variants come from a hash of seed + turn.
import type { ElectionResult, GameState, Headline, PartyId } from './types';
import { CHARACTERS, CONTENT, LAWS, RIVALS, WINGS } from './content';
import { projectSeats } from './engine';
import { hashString, turnsToElection } from './meta';

type Fact = Omit<Headline, 'paper'> & { weight: number };

/** Pick a template variant deterministically. */
function pick<T>(s: GameState, key: string, options: T[]): T {
  return options[hashString(`${s.seed}:${s.turn}:${key}`) % options.length];
}

const partyName = (s: GameState, p: PartyId) => (p === 'player' ? s.player.name : RIVALS[p]?.name ?? p);

function electionFact(s: GameState, e: ElectionResult): Fact {
  const prev = [...s.elections].reverse().find((x) => x.turn < e.turn);
  const me = e.seats.player;
  const diff = prev ? me - prev.seats.player : 0;
  const winner = (Object.keys(e.seats) as PartyId[]).reduce((a, b) => (e.seats[b] > e.seats[a] ? b : a));
  if (winner === 'player') {
    return { weight: 100, topic: 'election', tone: 'good', text: pick(s, 'el-win', [
      `${s.player.name.toUpperCase()} TOPS THE POLL WITH ${me} SEATS`,
      `Landslide talk in Brassport as ${s.player.name} takes ${me} seats`,
      `${me} seats: ${s.player.name} is the Assembly's largest party`,
    ]) };
  }
  return { weight: 100, topic: 'election', tone: diff >= 0 ? 'neutral' : 'bad', text: diff < -2
    ? pick(s, 'el-loss', [`Night of losses: ${s.player.name} sheds ${-diff} seats`, `${partyName(s, winner)} surges as ${s.player.name} slumps to ${me}`])
    : pick(s, 'el-other', [`${partyName(s, winner)} leads the new Assembly; ${s.player.name} on ${me}`, `Hung chamber: ${partyName(s, winner)} first, ${s.player.name} holds ${me}`]) };
}

/** Up to `max` headlines about the latest turn and the state of the republic, most newsworthy first. */
export function headlines(s: GameState, max = 3): Headline[] {
  const facts: Fact[] = [];
  const recent = s.history.filter((h) => h.turn >= s.turn - 1);
  for (const h of recent) {
    const d = (h.data ?? {}) as Record<string, unknown>;
    if (h.kind === 'election' && d && typeof d === 'object' && 'seats' in d && (d as unknown as ElectionResult).turn > 0) facts.push(electionFact(s, d as unknown as ElectionResult));
    else if (h.kind === 'law' && typeof d.lawId === 'string' && LAWS[d.lawId]) {
      const law = LAWS[d.lawId];
      if (h.text.endsWith('is enacted.')) {
        const by = s.enactedBy[law.id];
        facts.push({ weight: by === 'player' ? 62 : 55, topic: 'law', tone: by === 'player' ? 'good' : 'neutral', text: pick(s, `law-${law.id}`, [
          `Assembly passes the ${law.name}`, `${law.name} becomes law`, `It's law: ${law.desc.replace(/\.$/, '')}`,
        ]) });
      } else if (h.text.endsWith('is repealed.')) facts.push({ weight: 58, topic: 'law', tone: 'neutral', text: `${law.name} struck from the books` });
    } else if (h.kind === 'character' && typeof d.characterId === 'string' && CHARACTERS[d.characterId]) {
      const nm = CHARACTERS[d.characterId].name;
      if (typeof d.rivalId === 'string') facts.push({ weight: 92, topic: 'party', tone: 'bad', text: pick(s, `def-${nm}`, [`FLOOR CROSSING: ${nm} quits for the ${RIVALS[d.rivalId].name}`, `Betrayal at the dispatch box as ${nm} defects`]) });
      else if (h.text.includes('disgrace')) facts.push({ weight: 90, topic: 'scandal', tone: 'bad', text: pick(s, `res-${nm}`, [`${nm} resigns in disgrace`, `${nm} OUT: the letters were real`]) });
      else if (d.won === true) facts.push({ weight: 88, topic: 'party', tone: 'good', text: `Leader sees off ${nm} in confidence ballot` });
      else if (d.won === false) facts.push({ weight: 99, topic: 'party', tone: 'bad', text: `COUP: ${nm} topples the leader of ${s.player.name}` });
    } else if (h.kind === 'event' && typeof d.eventId === 'string' && d.choice === undefined) {
      const ctx = (d.context ?? {}) as { characterId?: string };
      const nm = ctx.characterId ? CHARACTERS[ctx.characterId]?.name : undefined;
      if (d.eventId === 'minister_scandal' && nm) facts.push({ weight: 95, topic: 'scandal', tone: 'bad', text: pick(s, `sc-${nm}`, [`CONTRACTS SCANDAL ENGULFS ${nm.toUpperCase()}`, `Letters link ${nm} to rigged contracts`]) });
      if (d.eventId === 'leadership_challenge' && nm) facts.push({ weight: 96, topic: 'party', tone: 'bad', text: `${nm} moves against the leadership` });
    } else if (h.kind === 'debate' && typeof d.debateId === 'string') {
      facts.push(d.backfire
        ? { weight: 57, topic: 'debate', tone: 'bad', text: pick(s, 'gaffe', ['GAFFE! Leader\'s jab falls flat in the chamber', 'Groans from the gallery as attack line backfires']) }
        : { weight: 34, topic: 'debate', tone: 'good', text: pick(s, 'zinger', ['Leader wins the day at the dispatch box', 'A strong performance in the chamber']) });
    } else if (h.kind === 'era' && typeof d.era === 'number') {
      const era = CONTENT.eras[d.era - 1];
      facts.push({ weight: 80, topic: 'era', tone: 'neutral', text: `A new age dawns: ${era.name} (${era.years})` });
    } else if (h.kind === 'wing' && h.text.includes('revolt')) {
      const w = CONTENT.wings.find((x) => h.text.startsWith(x.name));
      facts.push({ weight: 70, topic: 'party', tone: 'bad', text: `${w ? w.name : 'Party wing'} in open revolt against the leadership` });
    } else if (h.kind === 'wing' && h.text.includes('rebellious')) {
      const w = CONTENT.wings.find((x) => h.text.startsWith(x.name));
      facts.push({ weight: 60, topic: 'party', tone: 'bad', text: `Rumblings on the ${w ? w.name : 'back'} benches` });
    }
  }
  // failed bills of the player
  for (const v of s.votes.filter((x) => x.turn >= s.turn - 1 && x.proposer === 'player' && !x.tally.passes)) {
    facts.push({ weight: 64, topic: 'vote', tone: 'bad', text: `Defeat in the chamber: ${LAWS[v.tally.lawId]?.name ?? 'bill'} falls ${v.tally.yes}-${v.tally.no}` });
  }
  // state of the republic
  if (s.debt > 150) facts.push({ weight: 52, topic: 'economy', tone: 'bad', text: pick(s, 'debt', [`Debt hits ${s.debt}; Ostmark creditors circle`, `Ledger in the red: debt now ${s.debt}`]) });
  else if (s.debt === 0 && s.treasury >= 100) facts.push({ weight: 28, topic: 'economy', tone: 'good', text: 'Treasury flush, debt cleared' });
  if (s.stats.economy >= 65) facts.push({ weight: 40, topic: 'economy', tone: 'good', text: pick(s, 'boom', ['Boom times on the Brassport quays', 'Order books full as the economy roars']) });
  else if (s.stats.economy <= 35) facts.push({ weight: 50, topic: 'economy', tone: 'bad', text: pick(s, 'bust', ['Shutters down: slump grips Calderra', 'Breadlines lengthen as trade dries up']) });
  const statWords: Record<string, string> = { order: 'Lawlessness spreads', liberty: 'Critics cry tyranny', environment: 'Black skies over the republic', health: 'Clinics overwhelmed' };
  for (const k of ['order', 'liberty', 'environment', 'health'] as const) if (s.stats[k] <= 25) facts.push({ weight: 46, topic: 'stat', tone: 'bad', text: statWords[k] });
  if (s.stats.environment >= 75) facts.push({ weight: 30, topic: 'stat', tone: 'good', text: 'Herons return to the Fens' });
  // polls and calendar
  const tte = turnsToElection(s);
  if (s.phase !== 'over') {
    const proj = projectSeats(s);
    const lead = (Object.keys(proj) as PartyId[]).reduce((a, b) => (proj[b] > proj[a] ? b : a));
    facts.push(lead === 'player'
      ? { weight: tte === 0 ? 75 : 26, topic: 'polls', tone: 'good', text: `Poll: ${s.player.name} ahead with ${proj.player} projected seats` }
      : { weight: tte === 0 ? 75 : 25, topic: 'polls', tone: 'neutral', text: `Poll: ${partyName(s, lead)} leads; ${s.player.name} on ${proj.player}` });
    if (tte === 0) facts.push({ weight: 85, topic: 'election', tone: 'neutral', text: 'CALDERRA VOTES TONIGHT' });
  }
  for (const w of CONTENT.wings) if ((s.wings?.[w.id] ?? 60) < 20 && !facts.some((f) => f.text.includes(w.name))) facts.push({ weight: 55, topic: 'party', tone: 'bad', text: `${WINGS[w.id].name} threaten to bring down their own leader` });

  facts.sort((a, b) => b.weight - a.weight);
  const out: Headline[] = [];
  const seen = new Set<string>();
  for (const f of facts) {
    if (out.length >= max) break;
    const key = `${f.topic}:${f.text}`;
    if (seen.has(key) || out.filter((o) => o.topic === f.topic).length >= 2) continue;
    seen.add(key);
    const paper = CONTENT.papers[hashString(`${s.seed}:${s.turn}:${out.length}:${f.topic}`) % CONTENT.papers.length];
    out.push({ paper, text: f.text, tone: f.tone, topic: f.topic });
  }
  return out;
}
