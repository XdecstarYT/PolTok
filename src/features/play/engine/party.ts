// v2 party systems: the three wings of your own party, named politicians, the cabinet,
// character crises (scandal, defection, leadership challenge) and debates.
import type {
  CabinetEffect, ChallengeOdds, CharacterId, CharacterState, DebateChoicePreview, DebateDef, DocketItem, EventContext,
  EventDef, GameState, GroupId, LawId, PostId, RivalId, WingId, WingMood,
} from './types';
import * as K from './constants';
import {
  AMENDMENTS, CHARACTERS, CHARACTER_IDS, CONTENT, DEBATES, LAWS, POSTS, POST_IDS, RIVALS, RIVAL_IDS, TRAITS, WINGS, WING_IDS,
} from './content';
import { rand, weightedIndex } from './rng';
import { Ctx, addApproval, addStat, clamp, dist, playerInGovernment, round1 } from './core';

const name = (id: CharacterId) => CHARACTERS[id]?.name ?? id;

// ------------------------------------------------------------------ wings

/** A wing's position: the party's position plus the wing's offset, clamped to -1..1. */
export function wingPosition(s: GameState, w: WingId): [number, number] {
  const o = WINGS[w].offset;
  return [clamp(s.player.economic + o[0], -1, 1), clamp(s.player.social + o[1], -1, 1)];
}

/** Support (0..1, 0.5 = indifferent) of a wing for enacting or repealing a law. */
export function wingSupport(s: GameState, w: WingId, lawId: LawId, kind: 'enact' | 'repeal' = 'enact'): number {
  const law = LAWS[lawId];
  const d = dist(wingPosition(s, w), law.axis);
  const def = WINGS[w];
  const cat = def.likes.includes(law.category) ? 0.1 : def.dislikes.includes(law.category) ? -0.1 : 0;
  const sup = kind === 'enact' ? 1 - d / 1.4 + cat : d / 1.4 - cat;
  return Math.round(sup * 100) / 100;
}

/** Happiness change of every wing if the player passes this law (with optional amendment). */
export function wingReaction(s: GameState, lawId: LawId, kind: 'enact' | 'repeal' = 'enact', amendmentId?: string): Partial<Record<WingId, number>> {
  const law = LAWS[lawId];
  const out: Partial<Record<WingId, number>> = {};
  if (!law) return out;
  for (const w of WING_IDS) {
    const d = dist(wingPosition(s, w), law.axis);
    const sup = kind === 'enact' ? 1 - d / 1.4 : d / 1.4;
    const def = WINGS[w];
    let cat = def.likes.includes(law.category) ? K.WING_CATEGORY : def.dislikes.includes(law.category) ? -K.WING_CATEGORY : 0;
    if (kind === 'repeal') cat = -cat;
    let v = clamp(Math.round((sup - 0.5) * K.WING_LAW_SCALE) + cat, -K.WING_LAW_CAP, K.WING_LAW_CAP);
    const a = amendmentId ? AMENDMENTS[amendmentId] : undefined;
    if (a?.wings?.[w]) v += a.wings[w]!;
    out[w] = v;
  }
  return out;
}

export function addWing(s: GameState, w: WingId, delta: number) {
  if (s.wings[w] === undefined) return;
  s.wings[w] = round1(clamp(s.wings[w] + delta, 0, 100));
}

/** Seat-weighted average wing happiness. */
export function partyMood(s: GameState): number {
  return CONTENT.wings.reduce((a, w) => a + w.size * (s.wings[w.id] ?? K.WING_START), 0);
}

/** Seats each wing controls (largest remainder split of the player's seats). */
export function wingSeats(s: GameState): Record<WingId, number> {
  const seats = s.seats.player ?? 0;
  const raw = CONTENT.wings.map((w) => ({ id: w.id, v: seats * w.size }));
  const out: Record<WingId, number> = Object.fromEntries(raw.map((r) => [r.id, Math.floor(r.v)]));
  let left = seats - Object.values(out).reduce((a, b) => a + b, 0);
  for (const r of [...raw].sort((a, b) => (b.v % 1) - (a.v % 1) || a.id.localeCompare(b.id))) {
    if (left <= 0) break;
    out[r.id]++; left--;
  }
  return out;
}

function moodLabel(h: number): WingMood['mood'] {
  return h < K.WING_REVOLT_AT ? 'revolt' : h < K.WING_REBEL_AT ? 'rebellious' : h < 55 ? 'restless' : 'content';
}

/** Mood of each wing for the party screen. */
export function wingMood(s: GameState): WingMood[] {
  const seats = wingSeats(s);
  return CONTENT.wings.map((w) => ({
    id: w.id, name: w.name, happiness: s.wings[w.id], trend: round1(s.wings[w.id] - (s.wingsStart?.[w.id] ?? s.wings[w.id])),
    mood: moodLabel(s.wings[w.id]), seats: seats[w.id], position: wingPosition(s, w.id),
  }));
}

/** Rebels per unhappy wing on a docket item (deterministic). Whipping removes them, unless the wing is in revolt (halved). */
export function wingRebels(s: GameState, item: DocketItem, whipped: boolean): Partial<Record<WingId, number>> {
  const out: Partial<Record<WingId, number>> = {};
  if (item.playerStance === 'abstain') return out;
  const seats = wingSeats(s);
  for (const w of WING_IDS) {
    const h = s.wings[w];
    if (h >= K.WING_REBEL_AT) continue;
    const sup = wingSupport(s, w, item.lawId, item.kind);
    const revolt = h < K.WING_REVOLT_AT;
    const dislikes = item.playerStance === 'yes' ? sup < 0.5 : sup > 0.6;
    if (!revolt && !dislikes) continue;
    let n = Math.min(seats[w], Math.round(seats[w] * ((K.WING_REBEL_AT - h) / K.WING_REBEL_AT) * K.WING_REBEL_FACTOR));
    if (whipped) n = revolt ? Math.floor(n / 2) : 0;
    if (n > 0) out[w] = n;
  }
  return out;
}

/** Wings react to a vote result. */
export function wingsAfterVote(c: Ctx, item: DocketItem, passed: boolean) {
  const s = c.s;
  if (item.playerStance === 'abstain') return;
  const react = wingReaction(s, item.lawId, item.kind, item.amendment);
  const moved: string[] = [];
  for (const w of WING_IDS) {
    let d = 0;
    const r = react[w] ?? 0;
    if (passed && item.playerStance === 'yes') d = r;
    else if (!passed && item.proposer === 'player' && r > 0) d = Math.round(r / 2); // they appreciate the attempt
    else if (passed && item.playerStance === 'no' && r >= 4) d = -2; // you voted against their bill
    if (d) { addWing(s, w, d); moved.push(`${WINGS[w].name} ${d > 0 ? '+' : ''}${d}`); }
  }
  if (moved.length) c.push('wing', `Party wings: ${moved.join(', ')}.`, { wings: react });
}

/** Per-turn wing updates: conditions, the Chief Whip's care, drift toward rest. */
export function wingsTurn(c: Ctx, budgetNet: number) {
  const s = c.s;
  const gov = playerInGovernment(s);
  addWing(s, 'pragmatists', gov ? 1 : -1);
  if (s.debt > 100) addWing(s, 'pragmatists', -2);
  if (budgetNet < 0) addWing(s, 'pragmatists', -1);
  if (s.stats.liberty >= 60 || s.stats.environment >= 60) addWing(s, 'reformers', 1);
  if (s.stats.liberty < 40) addWing(s, 'reformers', -1);
  if (s.stats.order >= 60) addWing(s, 'traditionalists', 1);
  if (s.stats.order < 40) addWing(s, 'traditionalists', -1);
  const whip = postStrength(s, 'whip');
  if (whip > 0) {
    const low = [...WING_IDS].sort((a, b) => s.wings[a] - s.wings[b] || a.localeCompare(b))[0];
    addWing(s, low, K.WHIP_WING_CARE * whip);
  }
  for (const w of WING_IDS) s.wings[w] = round1(s.wings[w] + (K.WING_REST - s.wings[w]) * K.WING_DRIFT);
  for (const w of WING_IDS) {
    const before = s.wingsStart[w] ?? s.wings[w];
    if (before >= K.WING_REBEL_AT && s.wings[w] < K.WING_REBEL_AT) c.push('wing', `${WINGS[w].name} turn rebellious: they will vote against bills they dislike.`);
    if (before >= K.WING_REVOLT_AT && s.wings[w] < K.WING_REVOLT_AT) c.push('wing', `${WINGS[w].name} are in open revolt.`);
  }
}

/** Wings react to an election result (seat gains please everyone, losses sour the party room). */
export function wingsAfterElection(c: Ctx, before: number, after: number) {
  const d = clamp(Math.round((after - before) * K.WING_ELECTION_PER_SEAT), -6, 6);
  if (!d) return;
  for (const w of WING_IDS) addWing(c.s, w, d);
  c.push('wing', d > 0 ? `The party room cheers the result (wings +${d}).` : `The party room is bitter after the losses (wings ${d}).`);
}

// ------------------------------------------------------------------ politicians and cabinet

/** Trait fit of a politician for a post, 0..1 (0.25 when the trait has no affinity). */
export function competence(characterId: CharacterId, post: PostId): number {
  const ch = CHARACTERS[characterId];
  if (!ch) return 0;
  return TRAITS[ch.trait]?.fit[post] ?? 0.25;
}

/** Effective strength of a post this turn: holder competence, halved in opposition (shadow cabinet). */
export function postStrength(s: GameState, post: PostId): number {
  const id = s.cabinet?.[post];
  if (!id || s.characters[id]?.status !== 'active') return 0;
  return competence(id, post) * (playerInGovernment(s) ? 1 : K.SHADOW_FACTOR);
}

/** Politicians still in the party (bench and cabinet). */
export function activeCharacters(s: GameState): CharacterId[] {
  return CHARACTER_IDS.filter((id) => s.characters[id]?.status === 'active');
}

/** Best-fit cabinet from active politicians (greedy by competence, ambition breaks ties: ambitious
 *  politicians are happier in office). Deterministic. */
export function suggestCabinet(s: GameState): Record<PostId, CharacterId | null> {
  const out = Object.fromEntries(POST_IDS.map((p) => [p, null])) as Record<PostId, CharacterId | null>;
  const pool = new Set(activeCharacters(s));
  const pairs: { p: PostId; id: CharacterId; v: number }[] = [];
  for (const p of POST_IDS) for (const id of pool) pairs.push({ p, id, v: competence(id, p) + s.characters[id].ambition / 1000 });
  pairs.sort((a, b) => b.v - a.v || a.id.localeCompare(b.id) || a.p.localeCompare(b.p));
  for (const { p, id } of pairs) {
    if (out[p] || !pool.has(id)) continue;
    out[p] = id;
    pool.delete(id);
  }
  return out;
}

/** Create the 12 politicians. With `jitter`, loyalty/ambition vary per game (consumes RNG). */
export function initCharacters(s: GameState, jitter: boolean, loyaltyBonus = 0): Record<CharacterId, CharacterState> {
  const out: Record<CharacterId, CharacterState> = {};
  for (const ch of CONTENT.characters) {
    const j = () => (jitter ? Math.round((rand(s) * 2 - 1) * K.CHAR_JITTER) : 0);
    out[ch.id] = { id: ch.id, loyalty: clamp(ch.loyalty + j() + loyaltyBonus, 0, 100), ambition: clamp(ch.ambition + j(), 0, 100), status: 'active', post: null };
  }
  return out;
}

/** Fill the cabinet with suggestCabinet() (no loyalty bonus: this is the founding cabinet). */
export function seatCabinet(s: GameState) {
  const cab = suggestCabinet(s);
  s.cabinet = cab;
  for (const id of CHARACTER_IDS) if (s.characters[id]) s.characters[id].post = null;
  for (const p of POST_IDS) { const id = cab[p]; if (id) s.characters[id].post = p; }
}

/** Human-readable cabinet lines. */
export function cabinetEffects(s: GameState): CabinetEffect[] {
  return POST_IDS.map((post) => {
    const id = s.cabinet?.[post] ?? null;
    const st = postStrength(s, post);
    const comp = id ? competence(id, post) : 0;
    let text = 'Vacant: no effect.';
    if (id) {
      switch (post) {
        case 'purse': text = `+${Math.round(K.PURSE_INCOME * st)} treasury per turn`; break;
        case 'interior': text = `${st >= 0.5 ? '+1 order per turn (up to 65), ' : ''}+${round1(K.CABINET_APPROVAL * st)} Watch & Guard approval per turn`; break;
        case 'commons': text = `${st >= 0.5 ? '+1 health per turn (up to 65), ' : ''}+${round1(K.CABINET_APPROVAL * st)} Silver Elders approval per turn`; break;
        case 'whip': text = `+${round1(K.WHIP_PC_RATE * st)} PC per turn, +${round1(K.WHIP_WING_CARE * st)} happiness for the unhappiest wing${CHARACTERS[id].trait === 'diplomat' ? '; lobbying costs 1 PC less' : ''}`; break;
        case 'herald': text = `Debate gains x${round1(1 + K.HERALD_DEBATE_BONUS * st)}, backfire -${Math.round(K.HERALD_RISK_CUT * st * 100)}%, campaigns +${Math.round(K.HERALD_CAMPAIGN_BONUS * st * 100)}%`; break;
      }
      if (!playerInGovernment(s)) text += ' (shadow cabinet: half strength)';
    }
    return { post, characterId: id, competence: comp, text };
  });
}

/** Per-turn cabinet effects (the Purse is counted in budget()). */
export function cabinetTurn(c: Ctx) {
  const s = c.s;
  const interior = postStrength(s, 'interior');
  if (interior >= 0.5 && s.stats.order < 65) addStat(s, 'order', 1);
  if (interior > 0) addApproval(s, 'player', 'guardians', round1(K.CABINET_APPROVAL * interior));
  const commons = postStrength(s, 'commons');
  if (commons >= 0.5 && s.stats.health < 65) addStat(s, 'health', 1);
  if (commons > 0) { addApproval(s, 'player', 'elders', round1(K.CABINET_APPROVAL * commons)); addApproval(s, 'player', 'laborers', round1(K.CABINET_APPROVAL * 0.5 * commons)); }
  const whip = postStrength(s, 'whip');
  if (whip > 0) {
    s.pcProgress = round1(s.pcProgress + K.WHIP_PC_RATE * whip);
    while (s.pcProgress >= 1) { s.pcProgress = round1(s.pcProgress - 1); s.politicalCapital = Math.min(s.mods.maxPc, s.politicalCapital + 1); }
  }
}

/** Purse income this turn (used by budget()). */
export function purseIncome(s: GameState): number {
  return Math.round(K.PURSE_INCOME * postStrength(s, 'purse'));
}

/** Lobby cost in PC (a diplomat Chief Whip makes it 1 cheaper, minimum 1). */
export function lobbyCost(s: GameState): number {
  const id = s.cabinet?.whip;
  const base = s.mods?.lobbyPc ?? K.LOBBY_PC;
  return id && s.characters[id]?.status === 'active' && CHARACTERS[id].trait === 'diplomat' ? Math.max(1, base - 1) : base;
}

/** Per-turn loyalty and ambition updates. */
export function charactersTurn(c: Ctx) {
  const s = c.s;
  for (const id of activeCharacters(s)) {
    const ch = s.characters[id];
    const def = CHARACTERS[id];
    if (ch.post) {
      ch.loyalty += 1;
      if (def.trait === 'schemer') ch.ambition = Math.min(100, ch.ambition + 1);
    } else if (ch.ambition >= K.PASSED_OVER_AMBITION) ch.loyalty -= 1;
    ch.loyalty += clamp(Math.round((s.wings[def.wing] - 50) / K.LOYALTY_WING_DIV), -2, 2);
    ch.loyalty = clamp(ch.loyalty, 0, 100);
  }
  if (POST_IDS.every((p) => s.cabinet[p])) s.fullCabinetTurns++;
}

/** Appoint (or move) a politician. Replacing a sitting minister costs APPOINT_REPLACE_PC. */
export function appoint(c: Ctx, post: PostId, id: CharacterId) {
  const s = c.s;
  const ch = s.characters[id];
  const prev = ch.post;
  if (prev) s.cabinet[prev] = null;
  const holder = s.cabinet[post];
  if (holder && holder !== id) {
    const h = s.characters[holder];
    h.post = null;
    h.loyalty = clamp(h.loyalty - K.DISMISS_LOYALTY, 0, 100);
    h.ambition = clamp(h.ambition + 3, 0, 100);
    s.politicalCapital -= K.APPOINT_REPLACE_PC;
    c.push('character', `${name(holder)} is replaced as ${POSTS[post].name} and returns to the back bench, bitter (loyalty -${K.DISMISS_LOYALTY}).`);
  }
  s.cabinet[post] = id;
  ch.post = post;
  if (!prev) ch.loyalty = clamp(ch.loyalty + K.APPOINT_LOYALTY, 0, 100);
  c.push('character', prev ? `${name(id)} moves to ${POSTS[post].name}.` : `${name(id)} is appointed ${POSTS[post].name} (loyalty +${K.APPOINT_LOYALTY}).`, { characterId: id, post });
}

export function dismiss(c: Ctx, post: PostId) {
  const s = c.s;
  const id = s.cabinet[post];
  if (!id) return;
  const ch = s.characters[id];
  ch.post = null;
  ch.loyalty = clamp(ch.loyalty - K.DISMISS_LOYALTY, 0, 100);
  ch.ambition = clamp(ch.ambition + 3, 0, 100);
  s.cabinet[post] = null;
  c.push('character', `${name(id)} is dismissed as ${POSTS[post].name} (loyalty -${K.DISMISS_LOYALTY}).`, { characterId: id, post });
}

function removeFromCabinet(s: GameState, id: CharacterId) {
  const ch = s.characters[id];
  if (ch.post) s.cabinet[ch.post] = null;
  ch.post = null;
}

/** Rival a defector would join: the one nearest to their wing's position. */
export function defectionTarget(s: GameState, id: CharacterId): RivalId {
  const pos = wingPosition(s, CHARACTERS[id].wing);
  return RIVAL_IDS.reduce((a, b) => (dist([RIVALS[b].economic, RIVALS[b].social], pos) < dist([RIVALS[a].economic, RIVALS[a].social], pos) ? b : a));
}

/** Odds that you win a confidence ballot against a challenger (default: the pending challenger). */
export function challengeOdds(s: GameState, characterId?: CharacterId): ChallengeOdds | null {
  const id = characterId ?? s.eventContext?.characterId;
  if (!id || !s.characters[id]) return null;
  const mood = partyMood(s);
  const ch = s.characters[id];
  const gov = playerInGovernment(s);
  let p = 0.4 + (mood - 50) / 100 + 0.03 * s.politicalCapital + (gov ? 0.1 : 0) - Math.max(0, ch.ambition - 65) / 200;
  p = Math.round(clamp(p, 0.1, 0.95) * 100) / 100;
  const reasons = [
    `Party mood ${Math.round(mood)} (${mood >= 50 ? '+' : ''}${Math.round(mood - 50)}%)`,
    `Political Capital ${s.politicalCapital} (+${3 * s.politicalCapital}%)`,
    gov ? 'In government (+10%)' : 'In opposition (+0%)',
  ];
  if (ch.ambition > 65) reasons.push(`${name(id)}'s ambition ${ch.ambition} (-${Math.round((ch.ambition - 65) / 2)}%)`);
  return { characterId: id, winChance: p, reasons };
}

/** Roll for a character crisis at the start of a turn. Returns the event to fire, or null. */
export function rollCharacterCrisis(s: GameState): { event: string; context: EventContext } | null {
  if (s.turn <= 1) return null;
  const active = activeCharacters(s);
  // leadership challenge
  if (s.turn - s.lastChallenge >= K.CHALLENGE_COOLDOWN && partyMood(s) < K.CHALLENGE_WING_MOOD) {
    const cands = active.filter((id) => s.characters[id].ambition >= K.CHALLENGE_AMBITION && s.characters[id].loyalty < K.CHALLENGE_LOYALTY)
      .sort((a, b) => (s.characters[b].ambition - s.characters[b].loyalty) - (s.characters[a].ambition - s.characters[a].loyalty) || a.localeCompare(b));
    if (cands.length && rand(s) < K.CHALLENGE_CHANCE) {
      s.lastChallenge = s.turn;
      return { event: 'leadership_challenge', context: { characterId: cands[0] } };
    }
  }
  // defection threat
  const low = active.filter((id) => s.characters[id].loyalty < K.DEFECT_LOYALTY).sort((a, b) => s.characters[a].loyalty - s.characters[b].loyalty || a.localeCompare(b));
  if (low.length && s.seats.player > 1 && rand(s) < K.DEFECT_CHANCE) {
    return { event: 'defection_threat', context: { characterId: low[0], rivalId: defectionTarget(s, low[0]) } };
  }
  // scandal
  for (const post of POST_IDS) {
    const id = s.cabinet[post];
    if (!id || s.characters[id].status !== 'active') continue;
    const risk = TRAITS[CHARACTERS[id].trait].scandalRisk * K.SCANDAL_MULT * (s.characters[id].ambition > 70 ? 1.3 : 1);
    if (rand(s) < risk) return { event: 'minister_scandal', context: { characterId: id, post } };
  }
  return null;
}

/** Is a scheduled character event still meaningful (its politician still in the party)? */
export function contextValid(s: GameState, ctx?: EventContext | null): boolean {
  if (!ctx?.characterId) return true;
  return s.characters[ctx.characterId]?.status === 'active';
}

const fill = (s: GameState, text: string, ctx: EventContext | null) => {
  const id = ctx?.characterId;
  const def = id ? CHARACTERS[id] : undefined;
  const post = ctx?.post ?? (id ? s.characters[id]?.post : null);
  const odds = id && text.includes('{odds}') ? `${Math.round((challengeOdds(s, id)?.winChance ?? 0) * 100)}%` : '';
  return text
    .split('{name}').join(def?.name ?? 'a minister')
    .split('{post}').join(post ? POSTS[post].name : 'minister')
    .split('{wing}').join(def ? WINGS[def.wing].name : 'party')
    .split('{rival}').join(ctx?.rivalId ? RIVALS[ctx.rivalId].name : 'opposition')
    .split('{odds}').join(odds);
};

/** An event with its placeholders filled in for the current context. */
export function fillEvent(s: GameState, e: EventDef, ctx: EventContext | null): EventDef {
  if (!e.character) return e;
  return { ...e, title: fill(s, e.title, ctx), text: fill(s, e.text, ctx), choices: e.choices.map((c) => ({ ...c, label: fill(s, c.label, ctx) })) };
}

/** Character-specific consequences of resolving a character event. Returns 'ousted' when you lose a challenge. */
export function resolveCharacterEvent(c: Ctx, eventId: string, choice: 0 | 1, ctx: EventContext): 'ousted' | null {
  const s = c.s;
  const id = ctx.characterId;
  if (!id || !s.characters[id]) return null;
  const ch = s.characters[id];
  const wing = CHARACTERS[id].wing;
  const disgrace = () => {
    removeFromCabinet(s, id);
    ch.status = 'disgraced';
    addWing(s, wing, -6);
    for (const w of WING_IDS) if (w !== wing) addWing(s, w, 1);
    c.push('character', `${name(id)} resigns in disgrace. The ${WINGS[wing].name} take it hard (-6).`, { characterId: id });
  };
  switch (eventId) {
    case 'minister_scandal':
      s.scandals++;
      if (choice === 0) { ch.loyalty = clamp(ch.loyalty + 15, 0, 100); addWing(s, wing, 3); c.push('character', `You stand by ${name(id)} (loyalty +15).`); } else disgrace();
      break;
    case 'scandal_deepens':
      if (choice === 1) disgrace();
      break;
    case 'defection_threat':
      if (choice === 0) {
        const rival = ctx.rivalId ?? defectionTarget(s, id);
        const n = Math.min(ch.ambition >= 70 ? 2 : 1, Math.max(0, s.seats.player - 1));
        s.seats.player -= n;
        s.seats[rival] = (s.seats[rival] ?? 0) + n;
        const g = s.government;
        g.minority = g.members.reduce((a, p) => a + (s.seats[p] ?? 0), 0) < K.MAJORITY;
        removeFromCabinet(s, id);
        ch.status = 'defected';
        ch.joined = rival;
        s.defections++;
        addWing(s, wing, -4);
        c.push('character', `${name(id)} crosses the floor to the ${RIVALS[rival].name}${n ? `, taking ${n} seat${n > 1 ? 's' : ''}` : ''}.`, { characterId: id, rivalId: rival, seats: n });
      } else {
        ch.loyalty = clamp(ch.loyalty + 30, 0, 100);
        ch.ambition = clamp(ch.ambition - 5, 0, 100);
        c.push('character', `${name(id)} accepts your offer and stays (loyalty +30).`);
      }
      break;
    case 'leadership_challenge': {
      if (choice === 0) {
        const odds = challengeOdds(s, id)!.winChance;
        if (rand(s) < odds) {
          s.challengesSurvived++;
          s.politicalCapital = Math.min(s.mods.maxPc, s.politicalCapital + 2);
          removeFromCabinet(s, id);
          ch.loyalty = 30;
          ch.ambition = clamp(ch.ambition - 20, 0, 100);
          for (const w of WING_IDS) addWing(s, w, 5);
          c.push('character', `You win the confidence ballot. ${name(id)} retreats to the back bench, humbled.`, { characterId: id, won: true });
        } else {
          c.push('character', `You lose the confidence ballot. ${name(id)} takes over the party.`, { characterId: id, won: false });
          return 'ousted';
        }
      } else {
        const best = [...POST_IDS].sort((a, b) => competence(id, b) - competence(id, a) || a.localeCompare(b))[0];
        const holder = s.cabinet[best];
        if (holder && holder !== id) { s.characters[holder].post = null; s.characters[holder].loyalty = clamp(s.characters[holder].loyalty - K.DISMISS_LOYALTY, 0, 100); }
        removeFromCabinet(s, id);
        s.cabinet[best] = id;
        ch.post = best;
        ch.loyalty = clamp(ch.loyalty + 30, 0, 100);
        ch.ambition = clamp(ch.ambition - 10, 0, 100);
        addWing(s, wing, 6);
        for (const w of WING_IDS) if (w !== wing) addWing(s, w, -4);
        c.push('character', `You buy peace: ${name(id)} becomes ${POSTS[best].name}.`, { characterId: id, post: best });
      }
      break;
    }
  }
  return null;
}

// ------------------------------------------------------------------ debates

/** The debate / press conference on offer this turn. */
export function currentDebate(s: GameState): DebateDef | null {
  return s.pendingDebate ? DEBATES[s.pendingDebate] ?? null : null;
}

/** Effective debate choice after the Herald and perks (what the UI should show). */
export function debateChoice(s: GameState, choice: 0 | 1 | 2, debateId = s.pendingDebate ?? ''): DebateChoicePreview {
  const d = DEBATES[debateId];
  const ch = d?.choices[choice];
  if (!ch) return { label: '', tone: 'measured', groupEffects: {}, wings: {}, politicalCapital: 0, risk: 0, relations: {} };
  const herald = postStrength(s, 'herald');
  const mult = 1 + K.HERALD_DEBATE_BONUS * herald;
  const groupEffects = Object.fromEntries(Object.entries(ch.groupEffects).map(([g, v]) => [g, v > 0 ? round1(v * mult) : v]));
  let risk = 0;
  if (ch.risk) {
    const firebrand = s.cabinet?.herald && CHARACTERS[s.cabinet.herald]?.trait === 'firebrand' ? 0.05 : 0;
    risk = Math.round(clamp(ch.risk + firebrand - K.HERALD_RISK_CUT * herald - (s.mods?.debateRiskCut ?? 0), 0.02, 0.9) * 100) / 100;
  }
  return { label: ch.label, tone: ch.tone, groupEffects, wings: { ...(ch.wings ?? {}) }, politicalCapital: ch.politicalCapital, risk, relations: { ...(ch.relations ?? {}) } };
}

/** Answer the pending debate. `noRoll` forces success (previews). */
export function applyDebate(c: Ctx, choice: 0 | 1 | 2, noRoll = false) {
  const s = c.s;
  const id = s.pendingDebate!;
  const def = DEBATES[id];
  const p = debateChoice(s, choice);
  const backfire = !noRoll && p.risk > 0 && rand(s) < p.risk;
  for (const [g, v] of Object.entries(p.groupEffects)) addApproval(s, 'player', g as GroupId, backfire && v > 0 ? -round1(v / 2) : v);
  for (const [w, v] of Object.entries(p.wings)) addWing(s, w, backfire && (v ?? 0) > 0 ? -Math.ceil((v ?? 0) / 2) : v ?? 0);
  s.politicalCapital = clamp(s.politicalCapital + (backfire ? -1 : p.politicalCapital), 0, s.mods.maxPc);
  for (const [r, v] of Object.entries(p.relations)) {
    const rv = s.rivals[r];
    if (rv) rv.relation = clamp(rv.relation + (v ?? 0), -2, 2) as typeof rv.relation;
  }
  const ra = def.choices[choice].rivalApproval;
  if (ra && !backfire) for (const [g, v] of Object.entries(ra.groupEffects)) addApproval(s, ra.rival, g, v);
  if (!backfire) s.debatesWon++;
  s.pendingDebate = null;
  c.push('debate', backfire ? `${def.title}: "${p.label}" backfires.` : `${def.title}: "${p.label}" lands well.`, { debateId: id, choice, backfire });
}

/** Offer a debate for this turn (from turn 2). */
export function rollDebate(c: Ctx) {
  const s = c.s;
  s.pendingDebate = null;
  if (s.turn <= 1 || rand(s) >= K.DEBATE_CHANCE) return;
  const ids = CONTENT.debates.map((d) => d.id);
  const w = ids.map((id) => {
    const d = DEBATES[id];
    if (d.era !== 0 && d.era !== s.era) return 0;
    if (d.condition?.startsWith('law:') && !s.enacted.includes(d.condition.slice(4))) return 0;
    const last = s.debateHistory[id];
    if (last !== undefined && s.turn - last < K.DEBATE_COOLDOWN) return 0;
    return d.weight * (d.era !== 0 ? 1.5 : 1);
  });
  const i = weightedIndex(s, w);
  if (i < 0) return;
  s.pendingDebate = ids[i];
  s.debateHistory[ids[i]] = s.turn;
}

