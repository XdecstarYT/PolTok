// QUORUM engine: pure functions over GameState. No React, no DOM.
import type {
  Action, ActionPreview, ApplyResult, BlocStance, DocketItem, ElectionResult, GameState, GroupId,
  LawDef, LawId, LogEntry, LogKind, NewGameOptions, PartyId, RegionId, RelationStep, RivalId,
  ScoreBreakdown, Stance, StatId, VoteTally, AchievementId, EraId, Outcome, TimedEffect,
} from './types';
import * as K from './constants';
import { CONTENT, EVENTS, GROUPS, GROUP_IDS, LAWS, REGIONS, REGION_IDS, RIVALS, RIVAL_IDS } from './content';
import { rand, seedToState, uniform, weightedIndex } from './rng';

export const STAT_IDS: StatId[] = ['economy', 'order', 'liberty', 'environment', 'health'];
const EXCLUSIVE: Record<LawId, LawId> = {
  income_tax: 'flat_tax', flat_tax: 'income_tax', harbor_tariff: 'open_ports', open_ports: 'harbor_tariff',
};
/** Categories each rival style cares about (relation -1 if the player votes NO on them). */
export const STYLE_CATEGORIES: Record<string, string[]> = {
  hawk: ['security', 'faith'],
  populist: ['welfare', 'labor'],
  technocrat: ['trade', 'rights', 'economy'],
};

// ------------------------------------------------------------------ utils

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const round1 = (v: number) => Math.round(v * 10) / 10;
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const dist = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

class Ctx {
  log: LogEntry[] = [];
  constructor(public s: GameState) {}
  push(kind: LogKind, text: string, data?: unknown) {
    const e: LogEntry = { turn: this.s.turn, kind, text, ...(data === undefined ? {} : { data }) };
    this.log.push(e);
    this.s.history.push(e);
    if (this.s.history.length > 150) this.s.history.splice(0, this.s.history.length - 150);
  }
}

/** Party position on the two axes. */
export function partyAxis(s: GameState, p: PartyId): [number, number] {
  if (p === 'player') return [s.player.economic, s.player.social];
  const r = RIVALS[p];
  return [r.economic, r.social];
}

/** Euclidean distance between two parties' positions. */
export function axisDist(s: GameState, a: PartyId, b: PartyId): number {
  return dist(partyAxis(s, a), partyAxis(s, b));
}

/** Approval table for any party. */
export function approvalOf(s: GameState, p: PartyId): Record<GroupId, number> {
  return p === 'player' ? s.approval : s.rivals[p].approval;
}

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

function addApproval(s: GameState, p: PartyId, g: GroupId, delta: number) {
  const ap = approvalOf(s, p);
  if (ap[g] === undefined) return;
  ap[g] = round1(clamp(ap[g] + delta, 0, 100));
}

function addStat(s: GameState, k: StatId, delta: number) {
  s.stats[k] = clamp(Math.round(s.stats[k] + delta), 0, 100);
  if (k === 'environment') s.maxEnvironment = Math.max(s.maxEnvironment, s.stats[k]);
}

function isGov(s: GameState, p: PartyId) { return s.government.members.includes(p); }
/** True when the player is in government (alone, leading, or as a partner). */
export function playerInGovernment(s: GameState): boolean { return isGov(s, 'player'); }

function parties(s: GameState): PartyId[] { return ['player', ...RIVAL_IDS]; }

function eraForTurn(turn: number): EraId {
  return turn <= 8 ? 1 : turn <= 16 ? 2 : 3;
}

/** Laws unlocked in the current era and not enacted. */
export function draftableLaws(s: GameState): LawDef[] {
  return CONTENT.laws.filter((l) => l.era <= s.era && !s.enacted.includes(l.id));
}

// ------------------------------------------------------------------ new game / save

/** Start a new game. Runs the founding assembly so all 72 seats are filled on turn 1. */
export function newGame(opts: NewGameOptions = {}): GameState {
  const ideo = CONTENT.ideologies.find((i) => i.id === (opts.ideologyId ?? 'commonwealth')) ?? CONTENT.ideologies[0];
  const economic = clamp(opts.economic ?? ideo.economic ?? 0, -1, 1);
  const social = clamp(opts.social ?? ideo.social ?? 0, -1, 1);
  const seed = Math.floor(opts.seed ?? 1);
  const approval = Object.fromEntries(GROUP_IDS.map((g) => [g, startingApproval(economic, social, g)]));
  const rivals = Object.fromEntries(CONTENT.rivals.map((r) => {
    const relationRaw = dist([economic, social], [r.economic, r.social]);
    const relation: RelationStep = relationRaw < 0.8 ? 0 : relationRaw < 1.6 ? -1 : -2;
    return [r.id, {
      id: r.id,
      approval: Object.fromEntries(GROUP_IDS.map((g) => [g, r.base[g] ?? K.RIVAL_DEFAULT_APPROVAL])),
      campaign: Object.fromEntries(REGION_IDS.map((id) => [id, 0])),
      relation,
      termWelfareDone: false,
    }];
  }));
  const s: GameState = {
    version: K.SAVE_VERSION,
    seed,
    rng: seedToState(seed),
    turn: 1,
    era: 1,
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
    treasury: K.START_TREASURY,
    debt: 0,
    partyFunds: K.START_PARTY_FUNDS,
    politicalCapital: K.START_PC,
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
  };
  const c = new Ctx(s);
  c.push('info', `${s.player.name} is founded. The Republic of Calderra convenes its first Assembly.`);
  const res = runElection(s, 0, true);
  applyElection(c, res);
  if (s.phase !== 'coalition') startActions(c);
  return s;
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
export function regionShares(s: GameState, r: RegionId, noise = false, founding = false): Record<PartyId, number> {
  const mix = s.mixes[r];
  const raw: Record<PartyId, number> = {};
  for (const p of parties(s)) {
    let v = 0;
    for (const g of GROUP_IDS) v += (mix[g] ?? 0) * attraction(s, p, g);
    if (p === 'player') {
      if (founding) v *= K.FOUNDING_FACTOR;
      v += s.campaign[r] * K.CAMPAIGN_BOOST;
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
function runElection(s: GameState, turn: number, founding = false): ElectionResult {
  const seats: Record<PartyId, number> = Object.fromEntries(parties(s).map((p) => [p, 0]));
  const nat: Record<PartyId, number> = Object.fromEntries(parties(s).map((p) => [p, 0]));
  const regions: ElectionResult['regions'] = [];
  let totalW = 0;
  for (const r of CONTENT.regions) {
    const share = regionShares(s, r.id, true, founding);
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
  s.seats = { ...res.seats };
  s.elections.push(res);
  c.push('election', res.turn === 0 ? `Founding Assembly: you hold ${res.seats.player} of 72 seats.` : `Election: you win ${res.seats.player} of 72 seats.`, res);
  s.campaign = Object.fromEntries(REGION_IDS.map((id) => [id, 0]));
  for (const id of RIVAL_IDS) s.rivals[id].campaign = Object.fromEntries(REGION_IDS.map((r) => [r, 0]));
  if (res.turn > 0) {
    s.maxSeats = Math.max(s.maxSeats, res.seats.player);
    if (res.seats.player < 8) s.lowSeatElections++; else s.lowSeatElections = 0;
  }
  if (res.seats.player < 10) s.hadLowSeats = true;
  formGovernment(c);
}

function rivalAccepts(s: GameState, leader: PartyId, cand: PartyId): boolean {
  // hawk refuses progressive partners; the rule is symmetric for hawk-led governments
  const hawkBlock = (a: PartyId, b: PartyId) => a !== 'player' && RIVALS[a].aiStyle === 'hawk' && partyAxis(s, b)[1] > 0.4;
  if (hawkBlock(cand, leader) || hawkBlock(leader, cand)) return false;
  if (cand === 'player' || leader === 'player') {
    const rival = cand === 'player' ? leader : cand;
    const rel = s.rivals[rival].relation;
    if (rel === 2) return true;
    return rel >= 0 && axisDist(s, 'player', rival) < 1.1;
  }
  return axisDist(s, leader, cand) < 1.1;
}

/** Which rivals would accept joining a player-led coalition right now. */
export function acceptablePartners(s: GameState): RivalId[] {
  return RIVAL_IDS.filter((id) => rivalAccepts(s, 'player', id));
}

function setGovernment(c: Ctx, leader: PartyId, members: PartyId[]) {
  const s = c.s;
  const seats = members.reduce((a, p) => a + s.seats[p], 0);
  s.government = { leader, members, minority: seats < K.MAJORITY };
  s.pendingCoalition = null;
  const inGov = members.includes('player');
  if (inGov && s.elections.length > 1) s.politicalCapital = Math.min(K.MAX_PC, s.politicalCapital + 2);
  if (inGov && members.length > 1 && s.elections.length > 1) s.termsInCoalition++;
  if (inGov && s.hadLowSeats) s.comeback = true;
  const name = (p: PartyId) => (p === 'player' ? s.player.name : RIVALS[p].name);
  c.push('coalition', `Government: ${members.map(name).join(' + ')} (${seats} seats${s.government.minority ? ', minority' : ''}).`, s.government);
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
    upkeep += LAWS[id].upkeep;
  }
  const timed = s.timed.reduce((a, t) => a + t.treasury, 0);
  const rate = s.enacted.includes('central_bank') ? K.DEBT_INTEREST_CENTRAL_BANK : K.DEBT_INTEREST;
  const interest = Math.round(s.debt * rate);
  const net = income - K.BASE_EXPENSES - upkeep + timed;
  return { income, baseExpenses: K.BASE_EXPENSES, upkeep, timed, net, interestRate: rate, interest };
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
    if (p === 'player') {
      sup = 1;
      stance = item.playerStance;
      rebels = whipped ? 0 : playerRebels(s, item);
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
    blocs.push({ party: p, seats, stance, support: sup, ...b, defectors, rebels, whipped });
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
  relationAfterVote(c, item);
  return t;
}

// ------------------------------------------------------------------ events

function eventEligible(s: GameState, id: string): number {
  const e = EVENTS[id];
  if (e.era !== 0 && e.era !== s.era) return 0;
  if (e.condition?.startsWith('law:') && !s.enacted.includes(e.condition.slice(4))) return 0;
  const last = s.eventHistory[id];
  if (last !== undefined && s.turn - last < K.EVENT_COOLDOWN) return 0;
  let w = e.weight;
  // Corvane Border Line: manned border posts halve skirmish odds.
  if (id === 'border_skirmish' && s.enacted.includes('border_wall')) w *= 0.5;
  return w;
}

function rollEvent(c: Ctx) {
  const s = c.s;
  if (s.turn <= 1 || rand(s) >= K.EVENT_CHANCE) return;
  const ids = CONTENT.events.map((e) => e.id);
  const i = weightedIndex(s, ids.map((id) => eventEligible(s, id)));
  if (i < 0) return;
  s.pendingEvent = ids[i];
  s.eventHistory[ids[i]] = s.turn;
  s.phase = 'event';
  c.push('event', EVENTS[ids[i]].title, { eventId: ids[i] });
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
  return { ...ch, timed, seatSwing };
}

function resolveEvent(c: Ctx, choice: 0 | 1) {
  const s = c.s;
  const id = s.pendingEvent!;
  const ch = eventChoice(s, id, choice);
  for (const [g, v] of Object.entries(ch.groupEffects)) addApproval(s, 'player', g, v);
  s.treasury += ch.treasury;
  for (const [k, v] of Object.entries(ch.stats)) addStat(s, k as StatId, v ?? 0);
  s.politicalCapital = clamp(s.politicalCapital + ch.politicalCapital, 0, K.MAX_PC);
  s.timed.push(...ch.timed);
  if (ch.seatSwing) {
    const big = RIVAL_IDS.reduce((a, b) => (s.seats[b] > s.seats[a] ? b : a));
    if (s.seats[big] > 0) { s.seats[big]--; s.seats.player++; }
  }
  s.pendingEvent = null;
  c.push('event', `${EVENTS[id].title}: ${ch.label}.`, { eventId: id, choice });
  startActions(c);
}

// ------------------------------------------------------------------ rival AI

function lawFit(s: GameState, rival: RivalId, law: LawDef): number {
  const r = RIVALS[rival];
  const d = dist([r.economic, r.social], law.axis);
  const base = Object.keys(r.base).reduce((a, g) => a + (law.groupEffects[g] ?? 0), 0);
  return 1 - d / 1.4 + base / 40;
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
      const target = base[g] ?? K.RIVAL_DEFAULT_APPROVAL;
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
  if (s.turn >= K.TURNS) { finishAtEnd(c); return; }
  s.turn++;
  const era = eraForTurn(s.turn);
  if (era !== s.era) {
    s.era = era;
    const shift: Record<GroupId, number> = era === 2 ? { laborers: 0.03, growers: -0.03 } : { scholars: 0.03, elders: 0.02, growers: -0.02, chapel: -0.03 };
    const norm = (m: Record<GroupId, number>) => {
      for (const [g, d] of Object.entries(shift)) m[g] = Math.max(0.005, (m[g] ?? 0) + d);
      const t = Object.values(m).reduce((a, b) => a + b, 0);
      for (const g of Object.keys(m)) m[g] = Math.round((m[g] / t) * 10000) / 10000;
    };
    norm(s.shares);
    for (const r of REGION_IDS) norm(s.mixes[r]);
    const def = CONTENT.eras[era - 1];
    c.push('era', `${def.name} (${def.years}) begins.`, { era, unlocked: CONTENT.laws.filter((l) => l.era === era).map((l) => l.id) });
  }
  s.ap = K.AP_PER_TURN;
  s.draftsThisTurn = 0;
  s.approvalStart = { ...s.approval };
  rollEvent(c);
  if (s.phase !== 'event') startActions(c);
}

/** End the turn: vote any remaining docket, resolve budget, stats, rival AI, elections and eras. */
export function endTurn(state: GameState): ApplyResult {
  if (state.phase !== 'actions') return { state, log: [{ turn: state.turn, kind: 'error', text: `Cannot end turn during phase '${state.phase}'.` }] };
  const s = clone(state);
  const c = new Ctx(s);
  for (const item of [...s.docket]) holdVote(c, item.id);
  // budget + upkeep
  resolveBudget(c);
  // timed effects
  for (const t of s.timed) {
    for (const [k, v] of Object.entries(t.stats)) addStat(s, k as StatId, v ?? 0);
    for (const [g, v] of Object.entries(t.groupEffects)) addApproval(s, 'player', g, v);
    t.turnsLeft--;
  }
  s.timed = s.timed.filter((t) => t.turnsLeft > 0);
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
  // rivals
  rivalDrift(c);
  rivalCampaigns(c);
  // party economy
  s.partyFunds += Math.round(s.seats.player * K.FUNDS_PER_SEAT);
  if (playerInGovernment(s)) { s.turnsInGovernment++; s.politicalCapital = Math.min(K.MAX_PC, s.politicalCapital + 1); }
  if (checkLoss(c)) return { state: s, log: c.log };
  if (s.turn % K.ELECTION_EVERY === 0) {
    applyElection(c, runElection(s, s.turn));
    if (checkLoss(c)) return { state: s, log: c.log };
    if (s.phase === 'coalition') return { state: s, log: c.log };
  }
  nextTurn(c);
  return { state: s, log: c.log };
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
      if (s.politicalCapital < K.LOBBY_PC) return 'Not enough Political Capital.';
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
  if (err) return { state, log: [{ turn: state.turn, kind: 'error', text: err }] };
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
      break;
    }
    case 'lobby': {
      s.ap--;
      s.politicalCapital -= K.LOBBY_PC;
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
    case 'formCoalition':
      setGovernment(c, 'player', ['player', ...a.partners]);
      if (s.turn >= K.TURNS && s.elections.length > 1) finishAtEnd(c); else if (s.elections.length === 1) startActions(c); else nextTurn(c);
      break;
    case 'answerOffer': {
      const pc = s.pendingCoalition as { kind: 'offer'; leader: RivalId; partners: RivalId[] };
      const members: PartyId[] = a.accept ? [pc.leader, ...pc.partners, 'player'] : aiFormation(s, pc.leader, ['player']);
      setGovernment(c, pc.leader, members);
      if (s.turn >= K.TURNS && s.elections.length > 1) finishAtEnd(c); else if (s.elections.length === 1) startActions(c); else nextTurn(c);
      break;
    }
  }
  return { state: s, log: c.log };
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
    }
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
  if (a.type === 'callVote') {
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
  if (a.type === 'whip' || a.type === 'setStance') {
    const id = a.itemId;
    out.forecast = forecastVote(after, id) ?? undefined;
  }
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
  const total = laws + seats + government + stats + debt;
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
  return { laws, seats, government, stats, debt, total, rank, achievements: a };
}
