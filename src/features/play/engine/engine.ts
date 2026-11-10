// QUORUM engine: pure functions over GameState. No React, no DOM.
import type {
  Action, ActionPreview, ApplyResult, BlocStance, DocketItem, ElectionResult, GameState, GroupId,
  LawDef, LawId, LogEntry, LogKind, NewGameOptions, PartyId, RegionId, RelationStep, RivalId,
  ScoreBreakdown, Stance, StatId, VoteTally, AchievementId, EraId, Outcome, TimedEffect, CoalitionTerms, Transitions,
  AmendmentOption, AnyAchievementId, TurnSnapshot, CharacterId, DifficultyId, EventContext, EventDef, PostId, ScenarioGoal, ScenarioId, WingId,
} from './types';
import * as K from './constants';
import {
  CONTENT, EVENTS, GROUPS, GROUP_IDS, LAWS, REGIONS, REGION_IDS, RIVALS, RIVAL_IDS,
  AMENDMENTS, CHARACTERS, DEBATES, DIFFICULTIES, PERKS, POSTS, POST_IDS, SCENARIOS, WING_IDS,
} from './content';
import {
  activeCharacters, addWing, applyDebate, appoint, cabinetTurn, challengeOdds, charactersTurn, contextValid, debateChoice, dismiss, fillEvent,
  initCharacters, lobbyCost, postStrength, purseIncome, resolveCharacterEvent, rollCharacterCrisis, rollDebate, seatCabinet,
  wingRebels, wingReaction, wingsAfterElection, wingsAfterVote, wingsTurn,
} from './party';
import { DEFAULT_MODS, isElectionTurn, resolveMods, sanitizePerks } from './meta';
import { rand, seedToState, uniform, weightedIndex } from './rng';
import {
  clamp, round1, clone, dist, NO_TRANSITIONS, Ctx, partyAxis, axisDist, approvalOf, addApproval, addStat, isGov,
  playerInGovernment, parties, STAT_IDS,
} from './core';

const EXCLUSIVE: Record<LawId, LawId> = {
  income_tax: 'flat_tax', flat_tax: 'income_tax', harbor_tariff: 'open_ports', open_ports: 'harbor_tariff',
};
/** Categories each rival style cares about (relation -1 if the player votes NO on them). */
export const STYLE_CATEGORIES: Record<string, string[]> = {
  hawk: ['security', 'faith'],
  populist: ['welfare', 'labor'],
  technocrat: ['trade', 'rights', 'economy'],
};

// ------------------------------------------------------------------ utils (shared helpers live in core.ts)

export { partyAxis, axisDist, approvalOf, playerInGovernment, STAT_IDS } from './core';

/** Group furthest from g on the axes (court penalty target). */
export function rivalGroup(g: GroupId): GroupId {
  const a = GROUPS[g];
  let best = g;
  let bd = -1;
  for (const id of GROUP_IDS) {
    const d = dist([a.economic, a.social], [GROUPS[id].economic, GROUPS[id].social]);
    if (d > bd) { bd = d; best = id; }
  }
  return best;
}

/** Approval gained by courting g now (+5, or +2 once approval is 75+). */
export function courtGain(s: GameState, g: GroupId): number {
  return s.approval[g] >= K.COURT_SOFT_CAP ? K.COURT_GAIN_HIGH : K.COURT_GAIN;
}

/** Top-3 groups by approval for a party. */
export function topGroups(s: GameState, p: PartyId, n = 3): GroupId[] {
  const ap = approvalOf(s, p);
  return [...GROUP_IDS].sort((a, b) => ap[b] - ap[a] || a.localeCompare(b)).slice(0, n);
}

/** Starting approval of a party at (econ, social) with group g. */
export function startingApproval(econ: number, social: number, g: GroupId): number {
  const gr = GROUPS[g];
  const d = dist([econ, social], [gr.economic, gr.social]) / 2.83;
  return Math.round(clamp(50 - 25 * d, 10, 90));
}

function eraForTurn(turn: number): EraId {
  return turn <= 8 ? 1 : turn <= 16 ? 2 : 3;
}

/** Laws unlocked in the current era and not enacted. */
export function draftableLaws(s: GameState): LawDef[] {
  return CONTENT.laws.filter((l) => l.era <= s.era && !s.enacted.includes(l.id));
}

// ------------------------------------------------------------------ new game / save

/** Apply an era's population shift to group shares and region mixes. */
function applyEraShift(s: GameState, era: EraId) {
  if (era === 1) return;
  const shift: Record<GroupId, number> = era === 2 ? { laborers: 0.03, growers: -0.03 } : { scholars: 0.03, elders: 0.02, growers: -0.02, chapel: -0.03 };
  const norm = (m: Record<GroupId, number>) => {
    for (const [g, d] of Object.entries(shift)) m[g] = Math.max(0.005, (m[g] ?? 0) + d);
    const t = Object.values(m).reduce((a, b) => a + b, 0);
    for (const g of Object.keys(m)) m[g] = Math.round((m[g] / t) * 10000) / 10000;
  };
  norm(s.shares);
  for (const r of REGION_IDS) norm(s.mixes[r]);
}

/** v2 fields for a fresh state (no RNG consumed). */
function v2Defaults(scenarioId: ScenarioId, difficulty: DifficultyId, perks: string[]) {
  const scen = SCENARIOS[scenarioId];
  return {
    scenarioId, difficulty, mods: resolveMods(scenarioId, difficulty, perks),
    electionTurns: [...scen.electionTurns], totalTurns: scen.totalTurns,
    characters: {}, cabinet: Object.fromEntries(POST_IDS.map((p) => [p, null])) as Record<PostId, CharacterId | null>,
    wings: Object.fromEntries(WING_IDS.map((w) => [w, K.WING_START])), wingsStart: Object.fromEntries(WING_IDS.map((w) => [w, K.WING_START])),
    pendingDebate: null, debateHistory: {}, debatesWon: 0, timeline: [] as TurnSnapshot[], scheduledEvents: [], eventContext: null,
    perks, daily: null, lawAmendments: {}, lawExtraUpkeep: {}, pcProgress: 0,
    scandals: 0, challengesSurvived: 0, defections: 0, fullCabinetTurns: 0, lastChallenge: -99, goalsDone: [],
  };
}

/** Start a new game. Runs the founding assembly so all 72 seats are filled on the first turn.
 *  v2: `scenarioId`, `difficulty`, `perks` and `daily` set up the scenario rules (see docs/game/v2-api.md). */
export function newGame(opts: NewGameOptions = {}): GameState {
  const ideo = CONTENT.ideologies.find((i) => i.id === (opts.ideologyId ?? 'commonwealth')) ?? CONTENT.ideologies[0];
  const economic = clamp(opts.economic ?? ideo.economic ?? 0, -1, 1);
  const social = clamp(opts.social ?? ideo.social ?? 0, -1, 1);
  const seed = Math.floor(opts.seed ?? 1);
  const scenarioId: ScenarioId = opts.scenarioId && SCENARIOS[opts.scenarioId] ? opts.scenarioId : 'sandbox';
  const difficulty: DifficultyId = opts.difficulty && DIFFICULTIES[opts.difficulty] ? opts.difficulty : 'normal';
  const perks = opts.daily ? [] : sanitizePerks(opts.perks);
  const scen = SCENARIOS[scenarioId];
  const diff = DIFFICULTIES[difficulty];
  const v2 = v2Defaults(scenarioId, difficulty, perks);
  const approval = Object.fromEntries(GROUP_IDS.map((g) => [g, startingApproval(economic, social, g)]));
  const rivals = Object.fromEntries(CONTENT.rivals.map((r) => {
    const relationRaw = dist([economic, social], [r.economic, r.social]);
    let relation: RelationStep = relationRaw < 0.8 ? 0 : relationRaw < 1.6 ? -1 : -2;
    if (scenarioId === 'insurgent') relation = clamp(relation - 1, -2, 2) as RelationStep;
    return [r.id, {
      id: r.id,
      approval: Object.fromEntries(GROUP_IDS.map((g) => [g, (r.base[g] ?? K.RIVAL_DEFAULT_APPROVAL) + v2.mods.rivalApproval])),
      campaign: Object.fromEntries(REGION_IDS.map((id) => [id, 0])),
      relation,
      termWelfareDone: false,
    }];
  }));
  const era = eraForTurn(scen.startTurn);
  const s: GameState = {
    version: K.SAVE_VERSION,
    seed,
    rng: seedToState(seed),
    turn: scen.startTurn,
    era,
    phase: 'actions',
    ap: K.AP_PER_TURN,
    draftsThisTurn: 0,
    player: {
      name: (opts.partyName ?? 'Lantern Party').slice(0, 24),
      color: opts.color ?? '#6b4fd8',
      ideologyId: ideo.id,
      economic, social,
    },
    approval,
    approvalBase: { ...approval },
    approvalStart: { ...approval },
    rivals,
    shares: Object.fromEntries(CONTENT.groups.map((g) => [g.id, g.share])),
    mixes: Object.fromEntries(CONTENT.regions.map((r) => [r.id, { ...r.mix }])),
    campaign: Object.fromEntries(REGION_IDS.map((id) => [id, 0])),
    stats: { economy: 50, order: 50, liberty: 50, environment: 50, health: 50 },
    statZeroTurns: { economy: 0, order: 0, liberty: 0, environment: 0, health: 0 },
    treasury: Math.max(0, K.START_TREASURY + diff.treasury),
    debt: 0,
    partyFunds: K.START_PARTY_FUNDS,
    politicalCapital: clamp(K.START_PC + diff.politicalCapital, 0, v2.mods.maxPc),
    seats: Object.fromEntries(parties({} as GameState).map((p) => [p, 0])),
    government: { leader: null, members: [], minority: false },
    pendingCoalition: null,
    enacted: [],
    enactedBy: {},
    playerPassed: [],
    docket: [],
    nextDocketId: 1,
    pendingEvent: null,
    eventHistory: {},
    timed: [],
    elections: [],
    votes: [],
    lawsEnactedAsProposer: 0,
    turnsInGovernment: 0,
    termsInCoalition: 0,
    everWhipped: false,
    everRepealed: false,
    hadLowSeats: false,
    comeback: false,
    maxSeats: 0,
    maxEnvironment: 50,
    lowSeatElections: 0,
    unanimous: false,
    outcome: null,
    history: [],
    ...v2,
    daily: opts.daily ? opts.daily.slice(0, 10) : null,
  };
  applyEraShift(s, era);
  s.characters = initCharacters(s, true, perks.includes('deep_bench') ? 10 : 0);
  applyStartPerks(s);
  let founding = K.FOUNDING_FACTOR;
  // ---- scenario setup
  if (scenarioId === 'snap_election') {
    for (const [id, by] of [['rail_bond', 'harbor_left'], ['lamp_schools', 'glass_circle'], ['watch_houses', 'iron_crown'], ['harbor_tariff', 'harbor_left']] as [LawId, PartyId][]) {
      s.enacted.push(id); s.enactedBy[id] = by;
    }
    s.treasury = Math.max(0, 80 + diff.treasury); s.debt = 30;
    // incumbency: the governing party is known everywhere and its base is fired up for the snap vote
    for (const g of topGroups(s, 'player')) { s.approval[g] += 8; s.approvalBase[g] += 4; }
    for (const r of REGION_IDS) s.campaign[r] = 1;
    founding = 1;
  } else if (scenarioId === 'debt_crisis') {
    s.treasury = Math.max(0, diff.treasury); s.debt = 170; s.stats.economy = 45;
    founding = 0.85;
  } else if (scenarioId === 'insurgent') {
    s.partyFunds = 90; s.politicalCapital = clamp(s.politicalCapital + 2, 0, s.mods.maxPc);
    founding = 0.3;
  }
  const c = new Ctx(s);
  const caretaker = scenarioId === 'snap_election' || scenarioId === 'debt_crisis';
  c.push('info', scenarioId === 'sandbox' ? `${s.player.name} is founded. The Republic of Calderra convenes its first Assembly.` : `${scen.name}: ${scen.blurb}`);
  const res = runElection(s, 0, true, founding);
  if (caretaker) {
    s.seats = { ...res.seats };
    s.elections.push(res);
    c.push('election', `The outgoing Assembly: you hold ${res.seats.player} of 72 seats.`, res);
    if (res.seats.player < 10) s.hadLowSeats = true;
    rollPacts(s);
    setGovernment(c, 'player', ['player']);
    c.push('coalition', scenarioId === 'snap_election' ? 'You lead a caretaker government until the snap election.' : 'You lead a caretaker government. The creditors are waiting.');
  } else applyElection(c, res);
  seatCabinet(s);
  s.timeline = [snapshot(s)];
  if (s.phase !== 'coalition') startActions(c);
  return s;
}

/** End-of-turn snapshot for statistics charts. */
function snapshot(s: GameState): TurnSnapshot {
  return {
    turn: s.turn, approval: { ...s.approval }, seats: { ...s.seats }, debt: s.debt, treasury: s.treasury,
    politicalCapital: s.politicalCapital, wings: { ...s.wings }, stats: { ...s.stats },
  };
}

/** v2: true if applying `action` now draws from the seeded RNG (votes, events, debates with risk, ending the turn...).
 *  Such actions reveal hidden dice, so the UI should not offer undo for them. Invalid actions return false. */
export function consumesRng(s: GameState, action: Action): boolean {
  if (validate(s, action)) return false;
  return apply(s, action).state.rng !== s.rng;
}

/** v2: the negation of consumesRng (safe to undo). */
export function isDeterministic(s: GameState, action: Action): boolean {
  return !consumesRng(s, action);
}

/** Start-of-game perk effects. */
function applyStartPerks(s: GameState) {
  const has = (p: string) => s.perks.includes(p);
  if (has('war_chest')) { s.partyFunds += 40; s.treasury += 20; }
  if (has('grassroots')) {
    const near = [...GROUP_IDS].sort((a, b) => dist(partyAxis(s, 'player'), [GROUPS[a].economic, GROUPS[a].social]) - dist(partyAxis(s, 'player'), [GROUPS[b].economic, GROUPS[b].social]) || a.localeCompare(b)).slice(0, 3);
    for (const g of near) addApproval(s, 'player', g, 4);
  }
  if (has('green_roots')) { addApproval(s, 'player', 'greenward', 5); addApproval(s, 'player', 'scholars', 5); }
  if (has('iron_discipline')) for (const w of WING_IDS) { s.wings[w] = 75; s.wingsStart[w] = 75; }
  if (has('old_friends')) {
    const near = [...RIVAL_IDS].sort((a, b) => axisDist(s, 'player', a) - axisDist(s, 'player', b))[0];
    s.rivals[near].relation = clamp(s.rivals[near].relation + 1, -2, 2) as RelationStep;
  }
  if (has('second_wind')) s.politicalCapital = Math.min(s.mods.maxPc, s.politicalCapital + 1);
}

/** Upgrade an older save to the current version. Returns null if it cannot be used. */
export function migrate(raw: unknown): GameState | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Partial<GameState>;
  if (typeof s.version !== 'number') return null;
  // v1 is current. Future: if (s.version === 1) { ...; s.version = 2 }
  if (s.version > K.SAVE_VERSION) return null;
  if (s.approval && !s.approvalBase) s.approvalBase = { ...s.approval };
  if (!s.approval || !s.rivals || !s.seats || typeof s.rng !== 'number') return null;
  if (s.version < 2) {
    // v1 -> v2: sandbox on normal, default politicians (no jitter, no RNG used) and a best-fit cabinet.
    const g = s as GameState;
    Object.assign(g, { ...v2Defaults('sandbox', 'normal', []), mods: { ...DEFAULT_MODS } });
    g.characters = initCharacters(g, false);
    seatCabinet(g);
    g.version = 2;
  }
  return s as GameState;
}

/** Serialise for localStorage. */
export function serialize(s: GameState): string { return JSON.stringify(s); }
/** Parse + migrate a save string; null on any failure. */
export function deserialize(text: string): GameState | null {
  try { return migrate(JSON.parse(text)); } catch { return null; }
}

// ------------------------------------------------------------------ elections

/** D'Hondt allocation. Parties below `threshold` of the votes get nothing. */
export function dhondt(votes: Record<string, number>, seats: number, threshold = K.REGION_THRESHOLD): Record<string, number> {
  const total = Object.values(votes).reduce((a, b) => a + b, 0);
  const out: Record<string, number> = Object.fromEntries(Object.keys(votes).map((k) => [k, 0]));
  const eligible = Object.keys(votes).filter((k) => total > 0 && votes[k] / total >= threshold);
  if (!eligible.length) return out;
  for (let i = 0; i < seats; i++) {
    let best = eligible[0];
    let bq = -1;
    for (const k of eligible) {
      const q = votes[k] / (out[k] + 1);
      if (q > bq + 1e-12) { bq = q; best = k; }
    }
    out[best]++;
  }
  return out;
}

function attraction(s: GameState, p: PartyId, g: GroupId): number {
  const a = approvalOf(s, p)[g] / 100;
  let v = a * a;
  if (g === 'scholars' && s.enacted.includes('womens_vote')) v *= 1.2;
  return v;
}

/** Expected (or noisy) vote shares in one region. */
export function regionShares(s: GameState, r: RegionId, noise = false, founding = false, foundingFactor = K.FOUNDING_FACTOR): Record<PartyId, number> {
  const mix = s.mixes[r];
  const raw: Record<PartyId, number> = {};
  for (const p of parties(s)) {
    let v = 0;
    for (const g of GROUP_IDS) v += (mix[g] ?? 0) * attraction(s, p, g);
    if (p === 'player') {
      if (founding) v *= foundingFactor;
      v += s.campaign[r] * K.CAMPAIGN_BOOST * (s.mods?.campaignMult ?? 1) * (1 + K.HERALD_CAMPAIGN_BONUS * postStrength(s, 'herald'));
    } else {
      v += s.rivals[p].campaign[r] * K.RIVAL_CAMPAIGN_BOOST;
    }
    if (noise) v *= 1 + uniform(s, -K.TURNOUT_NOISE, K.TURNOUT_NOISE);
    raw[p] = Math.max(v, 1e-6);
  }
  const tot = Object.values(raw).reduce((a, b) => a + b, 0);
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v / tot]));
}

/** Run an election (mutates RNG of s). Does not change seats; see applyElection. */
function runElection(s: GameState, turn: number, founding = false, foundingFactor = K.FOUNDING_FACTOR): ElectionResult {
  const seats: Record<PartyId, number> = Object.fromEntries(parties(s).map((p) => [p, 0]));
  const nat: Record<PartyId, number> = Object.fromEntries(parties(s).map((p) => [p, 0]));
  const regions: ElectionResult['regions'] = [];
  let totalW = 0;
  for (const r of CONTENT.regions) {
    const share = regionShares(s, r.id, true, founding, foundingFactor);
    const rs = dhondt(share, r.seats);
    for (const p of parties(s)) { seats[p] += rs[p]; nat[p] += share[p] * r.seats; }
    totalW += r.seats;
    regions.push({ regionId: r.id, share, seats: rs });
  }
  for (const p of parties(s)) nat[p] /= totalW;
  return { turn, share: nat, seats, regions };
}

/** Projected seats right now (no noise) — for the map / hemicycle preview. */
export function projectSeats(s: GameState): Record<PartyId, number> {
  const seats: Record<PartyId, number> = Object.fromEntries(parties(s).map((p) => [p, 0]));
  for (const r of CONTENT.regions) {
    const rs = dhondt(regionShares(s, r.id), r.seats);
    for (const p of parties(s)) seats[p] += rs[p];
  }
  return seats;
}

function applyElection(c: Ctx, res: ElectionResult) {
  const s = c.s;
  // populist coalition price, checked at the end of each term
  if (res.turn > 0) {
    for (const id of RIVAL_IDS) {
      const rv = s.rivals[id];
      if (RIVALS[id].aiStyle === 'populist' && s.government.leader === 'player' && isGov(s, id) && !rv.termWelfareDone) {
        rv.relation = clamp(rv.relation - 2, -2, 2) as RelationStep;
        c.push('rival', `${RIVALS[id].name} is furious: no welfare law this term (relation -2).`);
      }
      rv.termWelfareDone = false;
    }
  }
  // rivals that lose seats while the player gains blame the player's campaign
  if (res.turn > 0 && res.seats.player > s.seats.player) {
    for (const id of RIVAL_IDS) {
      const lost = s.seats[id] - res.seats[id];
      if (lost >= K.BLAME_SEAT_LOSS) {
        const rv = s.rivals[id];
        const before = rv.relation;
        rv.relation = clamp(rv.relation - 1, -2, 2) as RelationStep;
        if (rv.relation !== before) c.push('rival', `${RIVALS[id].name} lost ${lost} seats and blames your campaign (relation -1).`);
      }
    }
  }
  const seatsBefore = s.seats.player;
  s.seats = { ...res.seats };
  s.elections.push(res);
  if (res.turn > 0) { c.tr.electionHeld = true; wingsAfterElection(c, seatsBefore, res.seats.player); }
  c.push('election', res.turn === 0 ? `Founding Assembly: you hold ${res.seats.player} of 72 seats.` : `Election: you win ${res.seats.player} of 72 seats.`, res);
  s.campaign = Object.fromEntries(REGION_IDS.map((id) => [id, 0]));
  for (const id of RIVAL_IDS) s.rivals[id].campaign = Object.fromEntries(REGION_IDS.map((r) => [r, 0]));
  if (res.turn > 0) {
    s.maxSeats = Math.max(s.maxSeats, res.seats.player);
    if (res.seats.player < (s.mods?.dissolveBelow ?? 8)) s.lowSeatElections++; else s.lowSeatElections = 0;
  }
  if (res.seats.player < 10) s.hadLowSeats = true;
  rollPacts(s);
  // goals are checked once the new government exists (setGovernment), not against the outgoing one
  formGovernment(c);
}

/** Would `cand` join a government led by `leader`? Returns the decision and the reasons behind it.
 *  Player <-> rival: tolerated distance grows with relation (COALITION_DIST + COALITION_REL_STEP * relation);
 *  allies always accept. Rival <-> rival: within RIVAL_COALITION_DIST. Hawks never sit with progressives. */
export function coalitionStance(s: GameState, leader: PartyId, cand: PartyId): { accepts: boolean; reasons: string[]; distance: number; maxDistance: number } {
  const name = (p: PartyId) => (p === 'player' ? s.player.name : RIVALS[p].name);
  const distance = Math.round(axisDist(s, leader, cand) * 100) / 100;
  for (const [a, b] of [[cand, leader], [leader, cand]] as [PartyId, PartyId][]) {
    if (a !== 'player' && RIVALS[a].aiStyle === 'hawk' && partyAxis(s, b)[1] > K.HAWK_SOCIAL_LIMIT) {
      return { accepts: false, reasons: [`${name(a)} will not govern with a progressive party (social above ${K.HAWK_SOCIAL_LIMIT}).`], distance, maxDistance: 0 };
    }
  }
  if (cand !== 'player' && leader !== 'player') {
    const maxDistance = K.RIVAL_COALITION_DIST;
    if (distance >= maxDistance) return { accepts: false, reasons: [`Too far apart on policy (${distance.toFixed(2)}, limit ${maxDistance}).`], distance, maxDistance };
    const accepts = (s.rivalPacts ?? []).includes(pactKey(leader, cand));
    return { accepts, reasons: [accepts ? `${name(leader)} and ${name(cand)} have a working deal this term.` : `Talks between ${name(leader)} and ${name(cand)} broke down this term.`], distance, maxDistance };
  }
  const rival = cand === 'player' ? leader : cand;
  const rel = s.rivals[rival].relation;
  const relName = ['hostile', 'cool', 'neutral', 'friendly', 'an ally'][rel + 2];
  if (rel >= 2) return { accepts: true, reasons: [`${name(rival)} is your ally and will deal regardless of policy.`], distance, maxDistance: 99 };
  const maxDistance = Math.round((K.COALITION_DIST + K.COALITION_REL_STEP * rel) * 100) / 100;
  const accepts = distance < maxDistance;
  const reasons = accepts
    ? [`Policy gap ${distance.toFixed(2)} is within what a ${relName} party tolerates (${maxDistance.toFixed(2)}).`]
    : [`Policy gap ${distance.toFixed(2)} is too wide while relations are ${relName} (tolerates ${maxDistance.toFixed(2)}).`];
  if (!accepts) {
    const need = [-1, 0, 1, 2].find((r) => r > rel && (r >= 2 || distance < K.COALITION_DIST + K.COALITION_REL_STEP * r));
    if (need !== undefined) reasons.push(`Lobby them up to ${['cool', 'neutral', 'friendly', 'ally'][need + 1]} and they would accept.`);
  }
  return { accepts, reasons, distance, maxDistance };
}

const pactKey = (a: PartyId, b: PartyId) => [a, b].sort().join('+');

/** Roll which rival pairs are willing to deal this term (once per election). */
function rollPacts(s: GameState) {
  const out: string[] = [];
  for (let i = 0; i < RIVAL_IDS.length; i++) {
    for (let j = i + 1; j < RIVAL_IDS.length; j++) {
      const [a, b] = [RIVAL_IDS[i], RIVAL_IDS[j]];
      if (axisDist(s, a, b) < K.RIVAL_COALITION_DIST && rand(s) < (s.mods?.pactChance ?? K.RIVAL_PACT_CHANCE)) out.push(pactKey(a, b));
    }
  }
  s.rivalPacts = out;
}

function rivalAccepts(s: GameState, leader: PartyId, cand: PartyId): boolean {
  return coalitionStance(s, leader, cand).accepts;
}

/** Which rivals would accept joining a player-led coalition right now. */
export function acceptablePartners(s: GameState): RivalId[] {
  return RIVAL_IDS.filter((id) => rivalAccepts(s, 'player', id));
}

/** Coalition terms of every rival for a player-led government (accept/refuse plus reasons). */
export function coalitionTerms(s: GameState): CoalitionTerms[] {
  return RIVAL_IDS.map((id) => ({ party: id, seats: s.seats[id] ?? 0, ...coalitionStance(s, 'player', id) }));
}

/** The government that forms if the player declines to lead or join one: a majority coalition of
 *  rivals if one can be built (biggest rival first), otherwise the largest party alone as a minority. */
export function fallbackGovernment(s: GameState): PartyId[] {
  const byseats = [...RIVAL_IDS].filter((id) => s.seats[id] > 0).sort((a, b) => s.seats[b] - s.seats[a]);
  for (const r of byseats) {
    const m = aiFormation(s, r, ['player']);
    if (m.length > 1) return m;
  }
  return [largestParty(s)];
}

function setGovernment(c: Ctx, leader: PartyId, members: PartyId[]) {
  const s = c.s;
  const seats = members.reduce((a, p) => a + s.seats[p], 0);
  s.government = { leader, members, minority: seats < K.MAJORITY };
  s.pendingCoalition = null;
  c.tr.governmentFormed = true;
  const inGov = members.includes('player');
  if (inGov && s.elections.length > 1) s.politicalCapital = Math.min(s.mods.maxPc, s.politicalCapital + 2);
  if (inGov && s.elections.length > 1) addWing(s, 'pragmatists', 4);
  if (inGov && members.length > 1 && s.elections.length > 1) s.termsInCoalition++;
  if (inGov && s.hadLowSeats) s.comeback = true;
  const name = (p: PartyId) => (p === 'player' ? s.player.name : RIVALS[p].name);
  c.push('coalition', `Government: ${members.map(name).join(' + ')} (${seats} seats${s.government.minority ? ', minority' : ''}).`, s.government);
  updateGoals(s);
}

function largestParty(s: GameState): PartyId {
  return parties(s).reduce((a, b) => (s.seats[b] > s.seats[a] ? b : a));
}

function aiFormation(s: GameState, leader: RivalId, exclude: PartyId[] = []): PartyId[] {
  const members: PartyId[] = [leader];
  let seats = s.seats[leader];
  const cands = parties(s).filter((p) => p !== leader && !exclude.includes(p) && s.seats[p] > 0)
    .sort((a, b) => axisDist(s, leader, a) - axisDist(s, leader, b));
  for (const p of cands) {
    if (seats >= K.MAJORITY) break;
    if (rivalAccepts(s, leader, p)) { members.push(p); seats += s.seats[p]; }
  }
  return seats >= K.MAJORITY ? members : [leader];
}

function formGovernment(c: Ctx) {
  const s = c.s;
  for (const p of parties(s)) {
    if (s.seats[p] >= K.MAJORITY) { setGovernment(c, p, [p]); return; }
  }
  const lead = largestParty(s);
  if (lead === 'player') {
    s.phase = 'coalition';
    s.pendingCoalition = { kind: 'form', seats: { ...s.seats } };
    c.push('coalition', 'You lead the largest bloc. Choose coalition partners to reach 37.');
    return;
  }
  const members = aiFormation(s, lead);
  if (members.length === 1) {
    // the largest party found no majority: any other majority coalition gets its chance
    const ok = acceptablePartners(s).reduce((a, p) => a + s.seats[p], s.seats.player);
    if (s.seats.player > 0 && ok >= K.MAJORITY) {
      s.phase = 'coalition';
      s.pendingCoalition = { kind: 'form', seats: { ...s.seats } };
      c.push('coalition', `${RIVALS[lead].name} cannot find a majority. Coalition talks pass to you.`);
      return;
    }
    const alt = fallbackGovernment(s);
    if (alt.length > 1) { c.push('coalition', `${RIVALS[lead].name} cannot find a majority; ${alt.map((p) => RIVALS[p].name).join(' and ')} strike a deal.`); setGovernment(c, alt[0], alt); return; }
  }
  if (members.includes('player')) {
    s.phase = 'coalition';
    s.pendingCoalition = { kind: 'offer', leader: lead, partners: members.filter((p) => p !== 'player' && p !== lead) };
    c.push('coalition', `${RIVALS[lead].name} invites you into government.`);
    return;
  }
  setGovernment(c, lead, members);
}

// ------------------------------------------------------------------ budget

/** Per-turn budget forecast. */
export function budget(s: GameState) {
  const income = Math.round(K.BASE_INCOME + s.stats.economy * K.INCOME_PER_ECONOMY);
  let upkeep = 0;
  for (const id of s.enacted) {
    if (id === 'rail_bond' && s.enacted.includes('privatize_rail')) continue;
    upkeep += LAWS[id].upkeep + (s.lawExtraUpkeep?.[id] ?? 0);
  }
  const timed = s.timed.reduce((a, t) => a + t.treasury, 0);
  let rate = s.enacted.includes('central_bank') ? K.DEBT_INTEREST_CENTRAL_BANK : K.DEBT_INTEREST;
  if (s.perks?.includes('fiscal_hawk')) rate = Math.round((rate - 0.01) * 100) / 100;
  const interest = Math.round(s.debt * rate);
  /** v2: the Chancellor of the Purse's contribution. */
  const cabinet = s.cabinet ? purseIncome(s) : 0;
  const net = income - K.BASE_EXPENSES - upkeep + timed + cabinet;
  return { income, baseExpenses: K.BASE_EXPENSES, upkeep, timed, net, interestRate: rate, interest, cabinet };
}

function resolveBudget(c: Ctx) {
  const s = c.s;
  const b = budget(s);
  s.treasury += b.net;
  s.debt += b.interest;
  if (s.treasury < 0) { s.debt += -s.treasury; s.treasury = 0; }
  if (s.treasury > K.TREASURY_RESERVE && s.debt > 0) {
    const pay = Math.min(s.debt, s.treasury - K.TREASURY_RESERVE);
    s.debt -= pay; s.treasury -= pay;
  }
  s.debt = Math.round(s.debt);
  s.treasury = Math.round(s.treasury);
  c.push('budget', `Budget: income ${b.income}, expenses ${b.baseExpenses + b.upkeep}, net ${b.net >= 0 ? '+' : ''}${b.net}. Debt ${s.debt}.`, b);
}

// ------------------------------------------------------------------ votes

function lawSupport(s: GameState, p: PartyId, item: DocketItem): number {
  const law = LAWS[item.lawId];
  const d = dist(partyAxis(s, p), law.axis);
  const sign = item.kind === 'enact' ? 1 : -1;
  let sup = item.kind === 'enact' ? 1 - d / 1.4 : d / 1.4;
  if (isGov(s, p) && item.government) sup += 0.25;
  if (p !== 'player') {
    const rel = item.proposer === 'player' ? s.rivals[p].relation : item.proposer === p ? 2 : 0;
    sup += 0.15 * rel;
    const am = item.amendment ? AMENDMENTS[item.amendment] : undefined;
    if (am && (am.target === p || am.target === 'any')) sup += am.support;
  }
  const top = topGroups(s, p);
  const avg = top.reduce((a, g) => a + (law.groupEffects[g] ?? 0), 0) / top.length;
  sup += 0.1 * sign * avg / 10;
  return round1(sup * 100) / 100;
}

function playerRebels(s: GameState, item: DocketItem): number {
  if (item.playerStance === 'abstain') return 0;
  const law = LAWS[item.lawId];
  const sign = (item.kind === 'enact' ? 1 : -1) * (item.playerStance === 'yes' ? 1 : -1);
  const top = topGroups(s, 'player');
  const hurts = top.some((g) => sign * (law.groupEffects[g] ?? 0) < -10);
  return hurts ? Math.floor(s.seats.player * 0.1) : 0;
}

function threshold(item: DocketItem): number {
  return item.kind === 'enact' && !LAWS[item.lawId].repealable ? K.SUPERMAJORITY : K.QUORUM;
}

/** Default player stance on a bill: yes if own bill, else by ideology. */
function defaultStance(s: GameState, item: DocketItem): Stance {
  if (item.proposer === 'player') return 'yes';
  const sup = lawSupport(s, 'player', { ...item, government: false });
  return sup >= 0.55 ? 'yes' : sup <= 0.35 ? 'no' : 'abstain';
}

/** Compute a tally. `rollRng` given → actual vote with per-seat dice; otherwise deterministic forecast. */
function tally(s: GameState, item: DocketItem, actual: boolean): VoteTally {
  const blocs: VoteTally['blocs'] = [];
  const rollCall: { party: PartyId; vote: BlocStance }[] = [];
  let yes = 0, no = 0, abstain = 0;
  for (const p of parties(s)) {
    const seats = s.seats[p];
    if (seats <= 0) continue;
    const whipped = item.whips.includes(p);
    let sup = 0, stance: BlocStance, defectors = 0, rebels = 0;
    const b = { yes: 0, no: 0, abstain: 0 };
    let wr: Partial<Record<WingId, number>> | undefined;
    if (p === 'player') {
      sup = 1;
      stance = item.playerStance;
      rebels = whipped ? 0 : playerRebels(s, item);
      if (s.wings) {
        const w = wingRebels(s, item, whipped);
        wr = w;
        rebels = Math.min(seats, rebels + Object.values(w).reduce((x: number, y) => x + (y ?? 0), 0));
      }
      const opposite: BlocStance = stance === 'yes' ? 'no' : 'yes';
      b[stance] += seats - rebels;
      if (rebels) b[opposite] += rebels;
      for (let i = 0; i < seats - rebels; i++) rollCall.push({ party: p, vote: stance });
      for (let i = 0; i < rebels; i++) rollCall.push({ party: p, vote: opposite });
    } else {
      sup = lawSupport(s, p, item);
      const partnerLoyal = item.government && isGov(s, p) && dist(partyAxis(s, p), LAWS[item.lawId].axis) <= 1.2;
      if (item.proposer === p || partnerLoyal) stance = 'yes';
      else stance = sup >= 0.55 ? 'yes' : sup <= 0.35 ? 'no' : 'abstain';
      if (stance === 'abstain' && whipped) stance = 'yes';
      const pDef = stance === 'yes' ? Math.max(0, 0.6 - sup) * 0.5 : stance === 'no' ? Math.max(0, sup - 0.3) * 0.5 : 0;
      const opposite: BlocStance = stance === 'yes' ? 'no' : 'yes';
      if (actual) {
        for (let i = 0; i < seats; i++) {
          const v = stance !== 'abstain' && rand(s) < pDef ? opposite : stance;
          if (v !== stance) defectors++;
          b[v]++;
          rollCall.push({ party: p, vote: v });
        }
      } else {
        defectors = stance === 'abstain' ? 0 : Math.round(seats * pDef);
        b[stance] += seats - defectors;
        if (defectors) b[opposite] += defectors;
      }
    }
    yes += b.yes; no += b.no; abstain += b.abstain;
    const supportPct = p === 'player' ? (stance === 'yes' ? 100 : stance === 'no' ? 0 : 50) : Math.round(clamp(sup, 0, 1) * 100);
    blocs.push({ party: p, seats, stance, support: sup, ...b, defectors, rebels, whipped, supportPct, ...(wr && Object.keys(wr).length ? { wingRebels: wr } : {}) });
  }
  const th = threshold(item);
  const t: VoteTally = {
    itemId: item.id, lawId: item.lawId, kind: item.kind, threshold: th, yes, no, abstain,
    passes: yes > no && yes >= th, blocs,
  };
  if (actual) {
    // interleave blocs for a nicer seat-by-seat animation
    for (let i = rollCall.length - 1; i > 0; i--) {
      const j = Math.floor(rand(s) * (i + 1));
      [rollCall[i], rollCall[j]] = [rollCall[j], rollCall[i]];
    }
    t.rollCall = rollCall;
  }
  return t;
}

function hypotheticalItem(s: GameState, lawId: LawId): DocketItem {
  const kind = s.enacted.includes(lawId) ? 'repeal' : 'enact';
  const item: DocketItem = { id: 'preview', kind, lawId, proposer: 'player', government: playerInGovernment(s), playerStance: 'yes', whips: [] };
  return item;
}

/** Deterministic forecast for a docket item (by item id) or, if not on the docket, for a law
 *  as if the player drafted it now. Null if the id is unknown. */
export function forecastVote(s: GameState, lawIdOrItemId: string): VoteTally | null {
  const item = s.docket.find((d) => d.id === lawIdOrItemId) ?? s.docket.find((d) => d.lawId === lawIdOrItemId);
  if (item) return tally(s, item, false);
  if (!LAWS[lawIdOrItemId]) return null;
  return tally(s, hypotheticalItem(s, lawIdOrItemId), false);
}

function enactLaw(c: Ctx, item: DocketItem, t: VoteTally) {
  const s = c.s;
  const law = LAWS[item.lawId];
  const playerYes = item.playerStance === 'yes';
  const excl = EXCLUSIVE[law.id];
  if (excl && s.enacted.includes(excl)) {
    s.enacted = s.enacted.filter((x) => x !== excl);
    delete s.enactedBy[excl];
    delete s.lawAmendments[excl];
    delete s.lawExtraUpkeep[excl];
    s.playerPassed = s.playerPassed.filter((x) => x !== excl);
    c.push('law', `${LAWS[excl].name} is automatically repealed.`);
  }
  s.enacted.push(law.id);
  s.enactedBy[law.id] = item.proposer;
  const f = playerYes ? 1 : K.OPPOSED_LAW_FACTOR;
  for (const [g, v] of Object.entries(law.groupEffects)) addApproval(s, 'player', g, v * f);
  if (playerYes) {
    s.playerPassed.push(law.id);
    if (dist(partyAxis(s, 'player'), law.axis) > K.BETRAYAL_DIST) {
      for (const g of GROUP_IDS) {
        if (dist(partyAxis(s, 'player'), [GROUPS[g].economic, GROUPS[g].social]) <= 0.5) addApproval(s, 'player', g, -K.BETRAYAL_COST);
      }
      c.push('approval', 'Your base calls it a betrayal (-3 with your core groups).');
    }
  }
  for (const b of t.blocs) {
    if (b.party === 'player' || b.stance !== 'yes') continue;
    for (const [g, v] of Object.entries(law.groupEffects)) addApproval(s, b.party, g, v * K.RIVAL_LAW_FACTOR);
  }
  for (const [k, v] of Object.entries(law.stats)) addStat(s, k as StatId, v ?? 0);
  if (law.oneOff) s.treasury += law.oneOff;
  const am = item.amendment ? AMENDMENTS[item.amendment] : undefined;
  if (am) {
    for (const [g, v] of Object.entries(am.groupEffects)) addApproval(s, 'player', g, v * f);
    for (const [k, v] of Object.entries(am.stats ?? {})) addStat(s, k as StatId, v ?? 0);
    s.lawAmendments[law.id] = am.id;
    if (am.upkeep) s.lawExtraUpkeep[law.id] = am.upkeep;
  }
  if (item.proposer === 'player') s.lawsEnactedAsProposer++;
  if (law.category === 'welfare') for (const id of RIVAL_IDS) s.rivals[id].termWelfareDone = true;
  c.push('law', `${law.name} is enacted.`, { lawId: law.id });
}

function repealLaw(c: Ctx, item: DocketItem) {
  const s = c.s;
  const law = LAWS[item.lawId];
  const playerYes = item.playerStance === 'yes';
  s.enacted = s.enacted.filter((x) => x !== law.id);
  delete s.enactedBy[law.id];
  delete s.lawAmendments[law.id];
  delete s.lawExtraUpkeep[law.id];
  const f = playerYes ? 1 : K.OPPOSED_LAW_FACTOR;
  for (const [g, v] of Object.entries(law.groupEffects)) addApproval(s, 'player', g, -v * f);
  for (const [k, v] of Object.entries(law.stats)) addStat(s, k as StatId, -(v ?? 0));
  if (playerYes && s.playerPassed.includes(law.id)) {
    for (const g of GROUP_IDS) addApproval(s, 'player', g, -K.CYNICISM_COST);
    c.push('approval', 'Voters call it cynical: you repealed your own law (-4 with all groups).');
  }
  s.playerPassed = s.playerPassed.filter((x) => x !== law.id);
  c.push('law', `${law.name} is repealed.`, { lawId: law.id });
}

function relationAfterVote(c: Ctx, item: DocketItem) {
  const s = c.s;
  if (item.proposer === 'player') return;
  const rv = s.rivals[item.proposer];
  const law = LAWS[item.lawId];
  let d = 0;
  if (item.playerStance === 'yes') d = 1;
  else if (item.playerStance === 'no' && STYLE_CATEGORIES[RIVALS[rv.id].aiStyle].includes(law.category)) d = -1;
  if (d) {
    const before = rv.relation;
    rv.relation = clamp(rv.relation + d, -2, 2) as RelationStep;
    if (rv.relation !== before) c.push('rival', `${RIVALS[rv.id].name}: relation ${d > 0 ? '+1' : '-1'}.`);
  }
}

function holdVote(c: Ctx, itemId: string): VoteTally | null {
  const s = c.s;
  const item = s.docket.find((d) => d.id === itemId);
  if (!item) return null;
  const t = tally(s, item, true);
  s.docket = s.docket.filter((d) => d.id !== itemId);
  s.votes.push({ turn: s.turn, tally: { ...t, rollCall: undefined }, proposer: item.proposer, playerStance: item.playerStance });
  if (s.votes.length > 120) s.votes.splice(0, s.votes.length - 120);
  c.push('vote', `${item.kind === 'repeal' ? 'Repeal of ' : ''}${LAWS[item.lawId].name}: ${t.yes} yes, ${t.no} no, ${t.abstain} abstain — ${t.passes ? 'PASSED' : 'FAILED'}.`, t);
  if (t.passes) {
    if (item.proposer === 'player' && t.no === 0) s.unanimous = true;
    if (item.kind === 'enact') enactLaw(c, item, t); else repealLaw(c, item);
  }
  wingsAfterVote(c, item, t.passes);
  relationAfterVote(c, item);
  return t;
}

// ------------------------------------------------------------------ events

function eventEligible(s: GameState, id: string): number {
  const e = EVENTS[id];
  if (e.chainOnly || e.character) return 0;
  if (e.era !== 0 && e.era !== s.era) return 0;
  if (e.condition?.startsWith('law:') && !s.enacted.includes(e.condition.slice(4))) return 0;
  const last = s.eventHistory[id];
  if (last !== undefined && s.turn - last < K.EVENT_COOLDOWN) return 0;
  let w = e.weight;
  // each era's own crises come up more often than the evergreen ones, so eras feel distinct
  if (e.era !== 0) w *= K.ERA_EVENT_WEIGHT;
  // Corvane Border Line: manned border posts halve skirmish odds.
  if (id === 'border_skirmish' && s.enacted.includes('border_wall')) w *= 0.5;
  return w;
}

function fireEvent(c: Ctx, id: string, context: EventContext | null) {
  const s = c.s;
  s.pendingEvent = id;
  s.eventContext = context;
  s.eventHistory[id] = s.turn;
  s.phase = 'event';
  c.push('event', fillEvent(s, EVENTS[id], context).title, { eventId: id, ...(context ? { context } : {}) });
}

function rollEvent(c: Ctx) {
  const s = c.s;
  s.eventContext = null;
  // 1) a storyline follow-up that is due
  const due = s.scheduledEvents.filter((e) => e.turn <= s.turn);
  for (const d of due) {
    s.scheduledEvents = s.scheduledEvents.filter((e) => e !== d);
    if (EVENTS[d.event] && contextValid(s, d.context)) { fireEvent(c, d.event, d.context ?? null); return; }
  }
  // 2) a crisis inside your own party
  const crisis = rollCharacterCrisis(s);
  if (crisis) { fireEvent(c, crisis.event, crisis.context); return; }
  // 3) the random draw
  if (s.turn <= 1 || rand(s) >= K.EVENT_CHANCE) return;
  const ids = CONTENT.events.map((e) => e.id);
  const i = weightedIndex(s, ids.map((id) => eventEligible(s, id)));
  if (i < 0) return;
  fireEvent(c, ids[i], null);
}

/** v2: the pending event with character placeholders filled in. Use this to render event cards. */
export function currentEvent(s: GameState): EventDef | null {
  if (!s.pendingEvent || !EVENTS[s.pendingEvent]) return null;
  return fillEvent(s, EVENTS[s.pendingEvent], s.eventContext ?? null);
}

/** Effective event choice after special rules (what the UI should display). */
export function eventChoice(s: GameState, eventId: string, choice: 0 | 1) {
  const e = EVENTS[eventId];
  const ch = clone(e.choices[choice]);
  const timed: TimedEffect[] = [];
  let seatSwing = false;
  if (eventId === 'border_skirmish' && choice === 0 && s.enacted.includes('border_wall')) ch.treasury = 0;
  if (eventId === 'foreign_loan' && choice === 0) timed.push({ id: 'foreign_loan', label: 'Foreign loan repayments', turnsLeft: 6, treasury: -5, stats: {}, groupEffects: {} });
  if (eventId === 'windfall') {
    if (choice === 0) timed.push({ id: 'silver_royalties', label: 'Silver Seam royalties', turnsLeft: 4, treasury: 5, stats: {}, groupEffects: {} });
    else ch.stats = { ...ch.stats, economy: (ch.stats.economy ?? 0) + 2 };
  }
  if (eventId === 'ai_rumor' && choice === 0) timed.push({ id: 'retraining_fund', label: 'Thinking Loom retraining fund', turnsLeft: 3, treasury: 0, stats: { economy: 1 }, groupEffects: { laborers: 1 } });
  if (eventId === 'defector' && choice === 0) seatSwing = true;
  // v2: difficulty scales the bad news; the Spin Room halves scandal damage
  const sev = s.mods?.eventSeverity ?? 1;
  const spin = (eventId === 'minister_scandal' || eventId === 'scandal_deepens') && s.perks?.includes('spin_room') ? 0.5 : 1;
  for (const [g, v] of Object.entries(ch.groupEffects)) if (v < 0) ch.groupEffects[g] = round1(v * sev * spin);
  if (ch.treasury < 0) ch.treasury = Math.round(ch.treasury * sev);
  if (e.character) ch.label = fillEvent(s, e, s.eventContext ?? null).choices[choice].label;
  return { ...ch, wings: { ...(ch.wings ?? {}) }, relations: { ...(ch.relations ?? {}) }, timed, seatSwing,
    /** v2 (leadership challenge, choice 0): chance to win the ballot. */
    ...(eventId === 'leadership_challenge' && choice === 0 ? { winChance: challengeOdds(s)?.winChance ?? 0 } : {}) };
}

function resolveEvent(c: Ctx, choice: 0 | 1) {
  const s = c.s;
  const id = s.pendingEvent!;
  const ch = eventChoice(s, id, choice);
  for (const [g, v] of Object.entries(ch.groupEffects)) addApproval(s, 'player', g, v);
  s.treasury += ch.treasury;
  for (const [k, v] of Object.entries(ch.stats)) addStat(s, k as StatId, v ?? 0);
  s.politicalCapital = clamp(s.politicalCapital + ch.politicalCapital, 0, s.mods.maxPc);
  s.timed.push(...ch.timed);
  if (ch.seatSwing) {
    const big = RIVAL_IDS.reduce((a, b) => (s.seats[b] > s.seats[a] ? b : a));
    if (s.seats[big] > 0) { s.seats[big]--; s.seats.player++; }
  }
  for (const [w, v] of Object.entries(ch.wings)) addWing(s, w, v ?? 0);
  for (const [r, v] of Object.entries(ch.relations)) {
    const rv = s.rivals[r];
    if (rv) rv.relation = clamp(rv.relation + (v ?? 0), -2, 2) as RelationStep;
  }
  const ctx = s.eventContext;
  if (ch.followUp) {
    const fu = ch.followUp;
    const next = fu.chance === undefined || fu.chance >= 1 || rand(s) < fu.chance ? fu.event : fu.else;
    if (next) s.scheduledEvents.push({ event: next, turn: s.turn + fu.delay, ...(ctx ? { context: ctx } : {}) });
  }
  const title = currentEvent(s)?.title ?? EVENTS[id].title;
  let ousted: 'ousted' | null = null;
  if (EVENTS[id].character && ctx) ousted = resolveCharacterEvent(c, id, choice, ctx);
  s.pendingEvent = null;
  s.eventContext = null;
  c.push('event', `${title}: ${ch.label}.`, { eventId: id, choice });
  if (ousted) { finish(c, 'ousted'); return; }
  startActions(c);
}

// ------------------------------------------------------------------ rival AI

function lawFit(s: GameState, rival: RivalId, law: LawDef): number {
  const r = RIVALS[rival];
  const d = dist([r.economic, r.social], law.axis);
  const base = Object.keys(r.base).reduce((a, g) => a + (law.groupEffects[g] ?? 0), 0);
  // rivals push the new agenda of the era rather than re-tabling old bills
  const fresh = law.era === s.era ? K.RIVAL_NEW_LAW_BONUS : 0;
  return 1 - d / 1.4 + base / 40 + fresh;
}

function rivalProposals(c: Ctx) {
  const s = c.s;
  for (const id of RIVAL_IDS) {
    if (s.seats[id] <= 0) continue;
    const p = isGov(s, id) ? K.RIVAL_PROPOSE_P_GOV : K.RIVAL_PROPOSE_P;
    if (rand(s) >= p) continue;
    const cands = draftableLaws(s).filter((l) => !s.docket.some((d) => d.lawId === l.id));
    if (!cands.length) continue;
    const best = cands.reduce((a, b) => (lawFit(s, id, b) > lawFit(s, id, a) ? b : a));
    if (lawFit(s, id, best) <= 0.5) continue;
    const item: DocketItem = { id: `d${s.nextDocketId++}`, kind: 'enact', lawId: best.id, proposer: id, government: isGov(s, id), playerStance: 'abstain', whips: [] };
    item.playerStance = defaultStance(s, item);
    s.docket.push(item);
    c.push('rival', `${RIVALS[id].name} tables the ${best.name}.`, { itemId: item.id });
  }
}

function rivalCampaigns(c: Ctx) {
  const s = c.s;
  const shares = Object.fromEntries(REGION_IDS.map((r) => [r, regionShares(s, r)]));
  for (const id of RIVAL_IDS) {
    let best: RegionId | null = null;
    let bg = -Infinity;
    for (const r of REGION_IDS) {
      const gap = shares[r][id] - shares[r].player;
      if (Math.abs(gap) <= 0.1 && gap > bg) { bg = gap; best = r; }
    }
    if (!best) best = REGION_IDS.reduce((a, b) => (shares[b][id] * REGIONS[b].seats > shares[a][id] * REGIONS[a].seats ? b : a));
    s.rivals[id].campaign[best]++;
  }
}

function rivalDrift(c: Ctx) {
  const s = c.s;
  for (const g of GROUP_IDS) {
    const delta = s.approval[g] - s.approvalStart[g];
    const gp: [number, number] = [GROUPS[g].economic, GROUPS[g].social];
    const nearest = RIVAL_IDS.reduce((a, b) => (dist(partyAxis(s, b), gp) < dist(partyAxis(s, a), gp) ? b : a));
    if (delta > 5) addApproval(s, nearest, g, -2);
    else if (delta < -5) addApproval(s, nearest, g, 2);
  }
  for (const id of RIVAL_IDS) {
    const base = RIVALS[id].base;
    for (const g of GROUP_IDS) {
      const target = (base[g] ?? K.RIVAL_DEFAULT_APPROVAL) + (s.mods?.rivalApproval ?? 0);
      const ap = s.rivals[id].approval;
      ap[g] = round1(ap[g] + (target - ap[g]) * K.RIVAL_DRIFT);
    }
  }
  // rivals court the nearby group where the player out-polls them most
  for (const id of RIVAL_IDS) {
    const ra = partyAxis(s, id);
    let best: GroupId | null = null;
    let bg = 0;
    for (const g of GROUP_IDS) {
      if (dist(ra, [GROUPS[g].economic, GROUPS[g].social]) > K.RIVAL_COURT_RANGE) continue;
      const gap = s.approval[g] - s.rivals[id].approval[g];
      if (gap > bg) { bg = gap; best = g; }
    }
    if (best) addApproval(s, id, best, K.RIVAL_COURT_GAIN);
  }
  // technocrat leaves over debt
  for (const id of RIVAL_IDS) {
    if (RIVALS[id].aiStyle === 'technocrat' && s.debt > K.TECHNOCRAT_DEBT_LIMIT && isGov(s, id) && s.government.leader !== id) {
      const members = s.government.members.filter((p) => p !== id);
      const seats = members.reduce((a, p) => a + s.seats[p], 0);
      s.government = { leader: s.government.leader, members, minority: seats < K.MAJORITY };
      c.push('coalition', `${RIVALS[id].name} quits the government over the debt.`);
    }
  }
}

// ------------------------------------------------------------------ turn flow

function startActions(c: Ctx) {
  const s = c.s;
  s.phase = 'actions';
  rivalProposals(c);
}

function checkLoss(c: Ctx): boolean {
  const s = c.s;
  let o: Outcome | null = null;
  if (s.debt > K.BANKRUPTCY_DEBT) o = 'bankrupt';
  else if (STAT_IDS.some((k) => s.statZeroTurns[k] >= 2)) o = 'collapse';
  else if (s.lowSeatElections >= 2) o = 'dissolved';
  if (o) finish(c, o);
  return !!o;
}

function finish(c: Ctx, o: Outcome) {
  const s = c.s;
  s.outcome = o;
  s.phase = 'over';
  s.pendingDebate = null;
  updateGoals(s);
  c.tr.gameOver = true;
  s.docket = [];
  const sc = score(s);
  c.push('gameover', `Game over (${o}). Score ${sc.total} — ${sc.rank}.`, sc);
}

function finishAtEnd(c: Ctx) {
  const s = c.s;
  const gov = playerInGovernment(s);
  const g = s.government;
  finish(c, !gov ? 'opposition' : g.leader !== 'player' ? 'junior' : g.members.length > 1 ? 'coalition' : g.minority ? 'minority' : 'majority');
}

function nextTurn(c: Ctx) {
  const s = c.s;
  if (s.turn >= s.totalTurns) { finishAtEnd(c); return; }
  s.turn++;
  const era = eraForTurn(s.turn);
  if (era !== s.era) {
    s.era = era;
    c.tr.eraChanged = true;
    applyEraShift(s, era);
    const def = CONTENT.eras[era - 1];
    c.push('era', `${def.name} (${def.years}) begins.`, { era, unlocked: CONTENT.laws.filter((l) => l.era === era).map((l) => l.id) });
  }
  s.ap = K.AP_PER_TURN;
  s.draftsThisTurn = 0;
  s.approvalStart = { ...s.approval };
  s.wingsStart = { ...s.wings };
  rollEvent(c);
  rollDebate(c);
  if (s.phase !== 'event') startActions(c);
}

/** End the turn: vote any remaining docket, resolve budget, stats, rival AI, elections and eras. */
export function endTurn(state: GameState): ApplyResult {
  if (state.phase !== 'actions') return { state, log: [{ turn: state.turn, kind: 'error', text: `Cannot end turn during phase '${state.phase}'.` }], transitions: { ...NO_TRANSITIONS } };
  const s = clone(state);
  const c = new Ctx(s);
  for (const item of [...s.docket]) holdVote(c, item.id);
  // budget + upkeep
  const net = budget(s).net;
  resolveBudget(c);
  // timed effects
  for (const t of s.timed) {
    for (const [k, v] of Object.entries(t.stats)) addStat(s, k as StatId, v ?? 0);
    for (const [g, v] of Object.entries(t.groupEffects)) addApproval(s, 'player', g, v);
    t.turnsLeft--;
  }
  s.timed = s.timed.filter((t) => t.turnsLeft > 0);
  // v2: cabinet portfolios (the Purse is already in the budget)
  cabinetTurn(c);
  // stat feedback on approval
  if (s.stats.economy < 40) { addApproval(s, 'player', 'merchants', -2); addApproval(s, 'player', 'laborers', -2); }
  if (s.stats.order < 40) { addApproval(s, 'player', 'guardians', -2); addApproval(s, 'player', 'elders', -2); }
  if (s.stats.environment < 30) addApproval(s, 'player', 'greenward', -2);
  if (s.stats.health < 40) addApproval(s, 'player', 'elders', -2);
  if (s.debt > K.DEBT_ECONOMY_PENALTY_AT) { addStat(s, 'economy', -3); c.push('stat', 'Debt above 150 drags the economy (-3).'); }
  // stat drift toward 50
  for (const k of STAT_IDS) {
    if (s.stats[k] > 50) s.stats[k]--; else if (s.stats[k] < 50) s.stats[k]++;
    s.statZeroTurns[k] = s.stats[k] <= 0 ? s.statZeroTurns[k] + 1 : 0;
  }
  // approval drift toward neutral
  for (const g of GROUP_IDS) s.approval[g] = round1(s.approval[g] + (s.approvalBase[g] - s.approval[g]) * K.APPROVAL_DRIFT);
  // v2: party wings and politicians
  wingsTurn(c, net);
  charactersTurn(c);
  s.pendingDebate = null;
  // rivals
  rivalDrift(c);
  rivalCampaigns(c);
  // party economy
  s.partyFunds += Math.round(s.seats.player * K.FUNDS_PER_SEAT);
  if (playerInGovernment(s)) { s.turnsInGovernment++; s.politicalCapital = Math.min(s.mods.maxPc, s.politicalCapital + 1); }
  updateGoals(s);
  s.timeline.push(snapshot(s));
  if (s.timeline.length > 60) s.timeline.splice(0, s.timeline.length - 60);
  if (checkLoss(c)) return c.result();
  if (isElectionTurn(s)) {
    applyElection(c, runElection(s, s.turn));
    if (checkLoss(c)) return c.result();
    if (s.phase === 'coalition') return c.result();
  }
  nextTurn(c);
  return c.result();
}

// ------------------------------------------------------------------ v2: amendments and goals

function amendmentFits(lawId: LawId, id: string): boolean {
  const a = AMENDMENTS[id];
  return !!a && (!a.categories?.length || a.categories.includes(LAWS[lawId].category));
}

/** The two amendments on offer for a bill (a docket item id, or a law id as if you drafted it now).
 *  Ranked by whether they flip the forecast, how many votes they add, and what they cost you. */
export function amendmentsFor(s: GameState, lawIdOrItemId: string): AmendmentOption[] {
  const item = s.docket.find((d) => d.id === lawIdOrItemId) ?? (LAWS[lawIdOrItemId] ? hypotheticalItem(s, lawIdOrItemId) : null);
  if (!item || item.kind !== 'enact' || item.proposer !== 'player') return [];
  const base = tally(s, { ...item, amendment: undefined }, false);
  const top = topGroups(s, 'player');
  const stance = (t: VoteTally, p: PartyId) => t.blocs.find((b) => b.party === p);
  const scored = CONTENT.amendments.filter((a) => amendmentFits(item.lawId, a.id)).map((a) => {
    const forecast = tally(s, { ...item, amendment: a.id }, false);
    const flips = !base.passes && forecast.passes;
    const cost = a.upkeep * 3 + Math.max(0, -(a.oneOff ?? 0)) / 4 + (a.politicalCapital ?? 0) * 4
      + top.reduce((x, g) => x + Math.max(0, -(a.groupEffects[g] ?? 0)), 0);
    const tg = a.target === 'any' ? RIVAL_IDS.filter((r) => (s.seats[r] ?? 0) > 0) : [a.target];
    const stanceChanges: AmendmentOption['stanceChanges'] = [];
    // how close each target bloc ends up to the YES line (0.55): blocs far below it gain nothing visible
    let nearLine = 0;
    for (const r of tg) {
      const b0 = stance(base, r), b1 = stance(forecast, r);
      if (!b0 || !b1) continue;
      if (b0.stance !== b1.stance) stanceChanges.push({ party: r, from: b0.stance, to: b1.stance });
      if (b0.stance !== 'yes') nearLine += Math.max(0, 0.25 - Math.max(0, 0.55 - b1.support)) * b1.seats;
    }
    const yesGain = forecast.yes - base.yes;
    const noDrop = base.no - forecast.no;
    const score = (flips ? 100 : 0) + stanceChanges.length * 30 + (yesGain + noDrop) * 2 + nearLine * 2 - cost;
    const targets = tg;
    const wd = wingReaction(s, item.lawId, 'enact', a.id);
    const plain = wingReaction(s, item.lawId, 'enact');
    const wingsDelta = Object.fromEntries(WING_IDS.map((w) => [w, (wd[w] ?? 0) - (plain[w] ?? 0)]).filter(([, v]) => v !== 0));
    return { amendment: a, targets, forecast, flips, wingsDelta, stanceChanges, yesGain, noDrop, score };
  }).sort((x, y) => y.score - x.score || x.amendment.id.localeCompare(y.amendment.id));
  if (!scored.length) return [];
  const first = scored[0];
  const second = scored.find((x) => x !== first && x.amendment.target !== first.amendment.target) ?? scored[1];
  return [first, second].filter(Boolean).map(({ score: _score, ...o }) => o);
}

/** Why an amendment cannot be attached to this item, or null. */
function amendmentError(s: GameState, item: DocketItem, amendmentId: string): string | null {
  const a = AMENDMENTS[amendmentId];
  if (!a) return 'Unknown amendment.';
  if (!amendmentsFor(s, item.id === 'preview' ? item.lawId : item.id).some((o) => o.amendment.id === amendmentId)) return 'That amendment is not on offer for this bill.';
  if ((a.politicalCapital ?? 0) > s.politicalCapital) return 'Not enough Political Capital.';
  if (-(a.oneOff ?? 0) > s.treasury) return 'Treasury too low.';
  return null;
}

function attachAmendment(c: Ctx, item: DocketItem, amendmentId: string) {
  const s = c.s;
  const a = AMENDMENTS[amendmentId];
  item.amendment = a.id;
  s.politicalCapital -= a.politicalCapital ?? 0;
  s.treasury += a.oneOff ?? 0;
  c.push('law', `You attach the ${a.name} to the ${LAWS[item.lawId].name}.`, { itemId: item.id, amendmentId: a.id });
}

/** Mark scenario goals reached in the current state. */
function updateGoals(s: GameState) {
  if (!s.goalsDone) return;
  const done = (id: string) => { if (!s.goalsDone.includes(id)) s.goalsDone.push(id); };
  const real = s.elections.filter((e) => e.turn > 0);
  switch (s.scenarioId) {
    case 'snap_election':
      if (s.turn === 10 && real.some((e) => e.turn === 10) && !s.pendingCoalition && playerInGovernment(s)) done('win_snap');
      if (real.some((e) => e.seats.player >= 30)) done('thirty_seats');
      break;
    case 'debt_crisis':
      if (s.turn <= 12 && s.debt < 100) done('debt_under_100');
      if (s.phase === 'over' && s.debt === 0 && s.turn >= s.totalTurns) done('debt_free');
      break;
    case 'insurgent':
      if (real.some((e) => e.seats.player >= 20)) done('twenty_seats');
      if (playerInGovernment(s)) done('enter_government');
      break;
  }
}

/** Scenario goals and whether each is done. */
export function scenarioGoals(s: GameState): ScenarioGoal[] {
  const scen = SCENARIOS[s.scenarioId ?? 'sandbox'];
  return (scen?.goals ?? []).map((g) => ({ ...g, done: (s.goalsDone ?? []).includes(g.id) }));
}

// ------------------------------------------------------------------ actions

/** Why an action is invalid right now, or null if it is valid. */
export function validate(s: GameState, a: Action): string | null {
  if (s.phase === 'over') return 'The game is over.';
  const inGov = playerInGovernment(s);
  switch (a.type) {
    case 'resolveEvent':
      if (s.phase !== 'event' || !s.pendingEvent) return 'No event to resolve.';
      return a.choice === 0 || a.choice === 1 ? null : 'Invalid choice.';
    case 'formCoalition': {
      if (s.phase !== 'coalition' || s.pendingCoalition?.kind !== 'form') return 'No coalition to form.';
      const uniq = new Set(a.partners);
      if (uniq.size !== a.partners.length) return 'Duplicate partners.';
      for (const p of a.partners) {
        if (!RIVALS[p]) return `Unknown party ${p}.`;
        if (!rivalAccepts(s, 'player', p)) return `${RIVALS[p].name} refuses to join.`;
      }
      const seats = a.partners.reduce((t, p) => t + s.seats[p], s.seats.player);
      if (a.partners.length && seats < K.MAJORITY) return `Only ${seats} seats; a coalition needs ${K.MAJORITY}.`;
      return null;
    }
    case 'answerOffer':
      return s.phase === 'coalition' && s.pendingCoalition?.kind === 'offer' ? null : 'No offer pending.';
    case 'endTurn':
      return s.phase === 'actions' ? null : `Cannot end turn during phase '${s.phase}'.`;
    default:
      break;
  }
  if (s.phase !== 'actions') return s.phase === 'event' ? 'Resolve the event first.' : 'Form the government first.';
  switch (a.type) {
    case 'appoint': {
      if (!POSTS[a.post]) return 'Unknown post.';
      const ch = s.characters[a.characterId];
      if (!ch || !CHARACTERS[a.characterId]) return 'Unknown politician.';
      if (ch.status !== 'active') return `${CHARACTERS[a.characterId].name} is no longer in the party.`;
      if (s.cabinet[a.post] === a.characterId) return 'Already in that post.';
      const holder = s.cabinet[a.post];
      if (holder && s.politicalCapital < K.APPOINT_REPLACE_PC) return 'Replacing a minister costs 1 Political Capital.';
      return null;
    }
    case 'dismiss':
      if (!POSTS[a.post]) return 'Unknown post.';
      return s.cabinet[a.post] ? null : 'That post is vacant.';
    case 'debate': {
      if (!s.pendingDebate) return 'No debate on offer.';
      if (s.ap < K.DEBATE_AP) return 'No action points left.';
      return DEBATES[s.pendingDebate]?.choices[a.choice] ? null : 'Invalid choice.';
    }
    case 'amend': {
      const it = s.docket.find((d) => d.id === a.itemId);
      if (!it) return 'Unknown docket item.';
      if (it.proposer !== 'player' || it.kind !== 'enact') return 'Only your own bills can be amended.';
      if (it.amendment) return 'This bill already carries an amendment.';
      return amendmentError(s, it, a.amendmentId);
    }
    case 'campaign':
      if (!REGIONS[a.regionId]) return 'Unknown region.';
      if (s.ap < 1) return 'No action points left.';
      if (inGov ? s.treasury < K.CAMPAIGN_COST : s.partyFunds < K.CAMPAIGN_COST) return inGov ? 'Treasury too low.' : 'Party funds too low.';
      return null;
    case 'court':
      if (!GROUPS[a.groupId]) return 'Unknown group.';
      return s.ap < 1 ? 'No action points left.' : null;
    case 'draft': {
      const law = LAWS[a.lawId];
      if (!law) return 'Unknown law.';
      if (s.ap < 1) return 'No action points left.';
      if (law.era > s.era) return 'Law not unlocked yet.';
      if (s.enacted.includes(a.lawId)) return 'Already enacted.';
      if (s.docket.some((d) => d.lawId === a.lawId)) return 'Already on the docket.';
      if (s.docket.filter((d) => d.proposer === 'player').length >= K.MAX_PLAYER_DOCKET) return 'Docket full (max 2).';
      if (!inGov && s.draftsThisTurn >= K.OPPOSITION_DRAFTS_PER_TURN) return 'In opposition you can draft only 1 bill per turn.';
      if (a.amendment !== undefined) return amendmentError(s, hypotheticalItem(s, a.lawId), a.amendment);
      return null;
    }
    case 'repeal': {
      const law = LAWS[a.lawId];
      if (!law) return 'Unknown law.';
      if (s.ap < 1) return 'No action points left.';
      if (!s.enacted.includes(a.lawId)) return 'Law is not in force.';
      if (!law.repealable) return 'This law cannot be repealed.';
      if (s.docket.some((d) => d.lawId === a.lawId)) return 'Already on the docket.';
      if (s.docket.filter((d) => d.proposer === 'player').length >= K.MAX_PLAYER_DOCKET) return 'Docket full (max 2).';
      if (!inGov && s.draftsThisTurn >= K.OPPOSITION_DRAFTS_PER_TURN) return 'In opposition you can draft only 1 bill per turn.';
      return null;
    }
    case 'lobby':
      if (!RIVALS[a.rivalId]) return 'Unknown rival.';
      if (s.ap < 1) return 'No action points left.';
      if (s.politicalCapital < lobbyCost(s)) return 'Not enough Political Capital.';
      if (s.rivals[a.rivalId].relation >= 2) return 'Already allies.';
      return null;
    case 'setStance': {
      const it = s.docket.find((d) => d.id === a.itemId);
      if (!it) return 'Unknown docket item.';
      if (!['yes', 'no', 'abstain'].includes(a.stance)) return 'Invalid stance.';
      return it.playerStance === a.stance ? 'Already set.' : null;
    }
    case 'whip': {
      const it = s.docket.find((d) => d.id === a.itemId);
      if (!it) return 'Unknown docket item.';
      if (s.politicalCapital < K.WHIP_PC) return 'Not enough Political Capital.';
      if (it.whips.includes(a.party)) return 'Already whipped.';
      if (s.seats[a.party] === undefined || s.seats[a.party] <= 0) return 'That party has no seats.';
      const bloc = tally(s, it, false).blocs.find((b) => b.party === a.party);
      if (!bloc) return 'No such bloc.';
      if (a.party === 'player') return bloc.rebels > 0 ? null : 'No rebels to whip.';
      return bloc.stance === 'abstain' ? null : 'Only abstaining blocs can be whipped.';
    }
    case 'callVote':
      return s.docket.some((d) => d.id === a.itemId) ? null : 'Unknown docket item.';
  }
  return 'Unknown action.';
}

/** Apply an action. Never mutates the input; invalid actions return the same state and an 'error' log entry. */
export function apply(state: GameState, a: Action): ApplyResult {
  const err = validate(state, a);
  if (err) return { state, log: [{ turn: state.turn, kind: 'error', text: err }], transitions: { ...NO_TRANSITIONS } };
  if (a.type === 'endTurn') return endTurn(state);
  const s = clone(state);
  const c = new Ctx(s);
  const inGov = playerInGovernment(s);
  switch (a.type) {
    case 'resolveEvent': resolveEvent(c, a.choice); break;
    case 'campaign':
      s.ap--;
      if (inGov) s.treasury -= K.CAMPAIGN_COST; else s.partyFunds -= K.CAMPAIGN_COST;
      s.campaign[a.regionId]++;
      c.push('info', `You campaign in ${REGIONS[a.regionId].name}.`, { regionId: a.regionId });
      break;
    case 'court': {
      s.ap--;
      const rg = rivalGroup(a.groupId);
      addApproval(s, 'player', a.groupId, courtGain(s, a.groupId));
      addApproval(s, 'player', rg, -K.COURT_RIVAL_LOSS);
      c.push('approval', `You court the ${GROUPS[a.groupId].name}; the ${GROUPS[rg].name} grumble (-${K.COURT_RIVAL_LOSS}).`);
      break;
    }
    case 'draft':
    case 'repeal': {
      s.ap--;
      s.draftsThisTurn++;
      const item: DocketItem = { id: `d${s.nextDocketId++}`, kind: a.type === 'draft' ? 'enact' : 'repeal', lawId: a.lawId, proposer: 'player', government: inGov, playerStance: 'yes', whips: [] };
      s.docket.push(item);
      if (a.type === 'repeal') s.everRepealed = true;
      c.push('law', `You table ${a.type === 'repeal' ? 'a repeal of ' : ''}the ${LAWS[a.lawId].name}.`, { itemId: item.id });
      if (a.type === 'draft' && a.amendment) attachAmendment(c, item, a.amendment);
      break;
    }
    case 'appoint': appoint(c, a.post, a.characterId); break;
    case 'dismiss': dismiss(c, a.post); break;
    case 'debate': s.ap -= K.DEBATE_AP; applyDebate(c, a.choice); break;
    case 'amend': attachAmendment(c, s.docket.find((d) => d.id === a.itemId)!, a.amendmentId); break;
    case 'lobby': {
      s.ap--;
      s.politicalCapital -= lobbyCost(s);
      const rv = s.rivals[a.rivalId];
      rv.relation = clamp(rv.relation + 1, -2, 2) as RelationStep;
      c.push('rival', `You lobby the ${RIVALS[a.rivalId].name} (relation +1).`);
      break;
    }
    case 'setStance': {
      const it = s.docket.find((d) => d.id === a.itemId)!;
      it.playerStance = a.stance;
      break;
    }
    case 'whip': {
      const it = s.docket.find((d) => d.id === a.itemId)!;
      it.whips.push(a.party);
      s.politicalCapital -= K.WHIP_PC;
      s.everWhipped = true;
      c.push('vote', `You whip ${a.party === 'player' ? 'your own rebels' : RIVALS[a.party].name} on the ${LAWS[it.lawId].name}.`);
      break;
    }
    case 'callVote': holdVote(c, a.itemId); break;
    case 'formCoalition': {
      const fb = a.partners.length ? null : fallbackGovernment(s);
      if (fb && fb[0] !== 'player') {
        c.push('coalition', fb.length > 1 ? `Without a deal from you, ${fb.map((p) => RIVALS[p].name).join(' and ')} form a majority. You go into opposition.` : `${RIVALS[fb[0]].name} governs as a minority.`);
        setGovernment(c, fb[0], fb);
      } else setGovernment(c, 'player', ['player', ...a.partners]);
      if (s.turn >= s.totalTurns && s.elections.length > 1) finishAtEnd(c); else if (s.elections.length === 1) startActions(c); else nextTurn(c);
      break;
    }
    case 'answerOffer': {
      const pc = s.pendingCoalition as { kind: 'offer'; leader: RivalId; partners: RivalId[] };
      const members: PartyId[] = a.accept ? [pc.leader, ...pc.partners, 'player'] : aiFormation(s, pc.leader, ['player']);
      setGovernment(c, pc.leader, members);
      if (s.turn >= s.totalTurns && s.elections.length > 1) finishAtEnd(c); else if (s.elections.length === 1) startActions(c); else nextTurn(c);
      break;
    }
  }
  return c.result();
}

/** All currently valid actions (endTurn included when allowed). Coalition 'form' lists every valid partner subset. */
export function listAvailableActions(s: GameState): Action[] {
  const cands: Action[] = [];
  if (s.phase === 'event') cands.push({ type: 'resolveEvent', choice: 0 }, { type: 'resolveEvent', choice: 1 });
  if (s.phase === 'coalition') {
    if (s.pendingCoalition?.kind === 'offer') cands.push({ type: 'answerOffer', accept: true }, { type: 'answerOffer', accept: false });
    else {
      const ok = acceptablePartners(s);
      for (let m = 0; m < 1 << ok.length; m++) cands.push({ type: 'formCoalition', partners: ok.filter((_, i) => m & (1 << i)) });
    }
  }
  if (s.phase === 'actions') {
    for (const r of REGION_IDS) cands.push({ type: 'campaign', regionId: r });
    for (const g of GROUP_IDS) cands.push({ type: 'court', groupId: g });
    for (const l of CONTENT.laws) cands.push({ type: 'draft', lawId: l.id }, { type: 'repeal', lawId: l.id });
    for (const r of RIVAL_IDS) cands.push({ type: 'lobby', rivalId: r });
    for (const d of s.docket) {
      for (const st of ['yes', 'no', 'abstain'] as Stance[]) cands.push({ type: 'setStance', itemId: d.id, stance: st });
      for (const p of parties(s)) cands.push({ type: 'whip', itemId: d.id, party: p });
      cands.push({ type: 'callVote', itemId: d.id });
      if (d.proposer === 'player' && d.kind === 'enact' && !d.amendment) for (const o of amendmentsFor(s, d.id)) cands.push({ type: 'amend', itemId: d.id, amendmentId: o.amendment.id });
    }
    for (const p of POST_IDS) {
      for (const id of activeCharacters(s)) cands.push({ type: 'appoint', post: p, characterId: id });
      cands.push({ type: 'dismiss', post: p });
    }
    if (s.pendingDebate) for (const i of [0, 1, 2] as const) cands.push({ type: 'debate', choice: i });
    cands.push({ type: 'endTurn' });
  }
  return cands.filter((a) => validate(s, a) === null);
}

/** Preview an action's effects without committing. Votes are never rolled: callVote shows the forecast
 *  and, if it is forecast to pass, the deterministic effects of passing. endTurn is not previewed (use budget()). */
export function previewAction(s: GameState, a: Action): ActionPreview {
  const zero = Object.fromEntries(GROUP_IDS.map((g) => [g, 0]));
  const reason = validate(s, a);
  const out: ActionPreview = { valid: !reason, cost: { ap: 0, pc: 0, treasury: 0, partyFunds: 0 }, approvalDelta: zero, statsDelta: {}, treasuryDelta: 0 };
  if (reason) { out.reason = reason; return out; }
  let after: GameState;
  if (a.type === 'endTurn') return out;
  if (a.type === 'debate') {
    // never roll the backfire in a preview: show the clean outcome plus the risk
    after = clone(s);
    after.ap -= K.DEBATE_AP;
    applyDebate(new Ctx(after), a.choice, true);
    out.risk = debateChoice(s, a.choice).risk;
  } else if (a.type === 'callVote') {
    const item = s.docket.find((d) => d.id === a.itemId)!;
    const fc = tally(s, item, false);
    out.forecast = fc;
    after = clone(s);
    const c = new Ctx(after);
    if (fc.passes) { if (item.kind === 'enact') enactLaw(c, item, fc); else repealLaw(c, item); }
  } else {
    after = apply(s, a).state;
  }
  out.cost = {
    ap: s.ap - after.ap > 0 ? s.ap - after.ap : 0,
    pc: Math.max(0, s.politicalCapital - after.politicalCapital),
    treasury: a.type === 'campaign' && playerInGovernment(s) ? K.CAMPAIGN_COST : 0,
    partyFunds: Math.max(0, s.partyFunds - after.partyFunds),
  };
  out.approvalDelta = Object.fromEntries(GROUP_IDS.map((g) => [g, round1(after.approval[g] - s.approval[g])]));
  for (const k of STAT_IDS) if (after.stats[k] !== s.stats[k]) out.statsDelta[k] = after.stats[k] - s.stats[k];
  out.treasuryDelta = after.treasury - s.treasury;
  if (a.type === 'lobby') out.relationDelta = { [a.rivalId]: after.rivals[a.rivalId].relation - s.rivals[a.rivalId].relation };
  if (a.type === 'whip' || a.type === 'setStance' || a.type === 'amend') {
    const id = a.itemId;
    out.forecast = forecastVote(after, id) ?? undefined;
  }
  if (a.type === 'draft') {
    const item = after.docket[after.docket.length - 1];
    if (item) out.forecast = tally(after, item, false);
  }
  if (a.type === 'amend') out.cost.treasury = Math.max(0, s.treasury - after.treasury);
  const wd: Partial<Record<WingId, number>> = {};
  for (const w of WING_IDS) if (after.wings[w] !== s.wings[w]) wd[w] = round1(after.wings[w] - s.wings[w]);
  if (Object.keys(wd).length) out.wingsDelta = wd;
  const ld: Partial<Record<CharacterId, number>> = {};
  for (const id of Object.keys(s.characters)) if (after.characters[id].loyalty !== s.characters[id].loyalty) ld[id] = after.characters[id].loyalty - s.characters[id].loyalty;
  if (Object.keys(ld).length) out.loyaltyDelta = ld;
  return out;
}

// ------------------------------------------------------------------ score

const RANKS: [number, ScoreBreakdown['rank']][] = [
  [400, 'Founder of the Republic'], [300, 'First Speaker'], [200, 'Minister'], [100, 'Whip'], [-Infinity, 'Backbencher'],
];

/** Score per GDD section 11, with rank title and achievements earned so far
 *  (Balanced Books, Clean Hands and Long Memory are only awarded once the game is over). */
export function score(s: GameState): ScoreBreakdown {
  const laws = 10 * s.lawsEnactedAsProposer;
  const seats = 2 * s.elections.filter((e) => e.turn > 0).reduce((a, e) => a + e.seats.player, 0);
  const government = Math.round((50 * s.turnsInGovernment) / K.TURNS);
  const stats = STAT_IDS.reduce((a, k) => a + s.stats[k], 0) - 250;
  const debt = s.debt > 0 ? -Math.round(s.debt / 5) : 0;
  const goals = scenarioGoals(s);
  const bonus = goals.reduce((a, g) => a + (g.done ? g.bonus : 0), 0);
  const multiplier = s.mods?.scoreMult ?? 1;
  const total = Math.round((laws + seats + government + stats + debt + bonus) * multiplier);
  const rank = RANKS.find(([min]) => total >= min)![1];
  const over = s.phase === 'over';
  const a: AchievementId[] = [];
  if (s.unanimous) a.push('unanimous');
  if (s.termsInCoalition >= 3) a.push('kingmaker');
  if (over && s.debt === 0) a.push('balanced_books');
  if (s.maxEnvironment > 80) a.push('green_republic');
  if (s.maxSeats >= 40) a.push('iron_majority');
  if (s.comeback) a.push('comeback');
  if (over && !s.everWhipped) a.push('clean_hands');
  if (over && !s.everRepealed) a.push('long_memory');
  const all: AnyAchievementId[] = [...a];
  const won = over && !!s.outcome && ['majority', 'coalition', 'minority', 'junior'].includes(s.outcome);
  const fullGame = over && s.turn >= (s.totalTurns ?? K.TURNS) && !['bankrupt', 'collapse', 'dissolved', 'ousted'].includes(s.outcome ?? '');
  if ((s.debatesWon ?? 0) >= 8) all.push('silver_tongue');
  if (fullGame && (s.scandals ?? 0) === 0) all.push('clean_cabinet');
  if ((s.challengesSurvived ?? 0) > 0) all.push('survivor');
  if ((s.fullCabinetTurns ?? 0) >= 20) all.push('full_bench');
  const allGoals = over && goals.length > 0 && goals.every((g) => g.done);
  if (allGoals && s.scenarioId === 'snap_election') all.push('snap_victory');
  if (allGoals && s.scenarioId === 'debt_crisis') all.push('debt_slayer');
  if (allGoals && s.scenarioId === 'insurgent') all.push('insurgent_rise');
  if (won && (s.difficulty === 'hard' || s.difficulty === 'ironclad')) all.push('iron_will');
  if (won && s.daily) all.push('daily_done');
  return { laws, seats, government, stats, debt, bonus, multiplier, total, rank, achievements: a, allAchievements: all, goals };
}
