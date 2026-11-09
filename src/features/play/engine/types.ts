// QUORUM: The Calderra Ledger — engine types and public API contract.
// Pure data: everything in GameState is JSON-serialisable. No React, no DOM.
// API stability: this file only grows. Existing fields/members are never removed or renamed.

// ---------------------------------------------------------------- content

/** Interest group id (8 groups in content.json). */
export type GroupId = string;
/** Region id (8 regions, 72 seats). */
export type RegionId = string;
/** Law id (35 laws). */
export type LawId = string;
/** Rival party id (3 rivals). */
export type RivalId = string;
/** 'player' or a rival id. */
export type PartyId = 'player' | RivalId;
/** The five national stats, each 0..100. */
export type StatId = 'economy' | 'order' | 'liberty' | 'environment' | 'health';
/** Era number. */
export type EraId = 1 | 2 | 3;
/** Rival AI archetype. */
export type AiStyle = 'hawk' | 'populist' | 'technocrat';

/** Era definition from content.json. */
export interface EraDef { id: EraId; name: string; years: string; turns: [number, number]; blurb: string }
/** Interest group definition. `economic` -1 left..+1 right, `social` -1 traditional..+1 progressive. */
export interface GroupDef { id: GroupId; name: string; icon: string; share: number; economic: number; social: number; wants: string }
/** Region definition; `mix` is the group composition of its voters (sums to ~1). */
export interface RegionDef { id: RegionId; name: string; seats: number; blurb: string; mix: Record<GroupId, number> }
/** Starting ideology preset (`custom` has null axes). */
export interface IdeologyDef { id: string; name: string; economic: number | null; social: number | null }
/** Rival party definition. `base` = starting approval per group (missing groups = 30). */
export interface RivalDef {
  id: RivalId; name: string; color: string; economic: number; social: number; leader: string;
  base: Record<GroupId, number>; aiStyle: AiStyle; personality: string;
}
/** Law definition. `upkeep` per turn (negative = revenue); `oneOff` is a treasury delta on enactment. */
export interface LawDef {
  id: LawId; name: string; era: EraId; category: string; upkeep: number;
  groupEffects: Record<GroupId, number>; stats: Partial<Record<StatId, number>>;
  axis: [number, number]; desc: string; repealable: boolean; oneOff?: number;
}
/** One of an event's two choices. */
export interface EventChoiceDef {
  label: string; groupEffects: Record<GroupId, number>; treasury: number;
  stats: Partial<Record<StatId, number>>; politicalCapital: number;
}
/** Event card. `era` 0 = any era. `condition` like `law:rail_bond`. */
export interface EventDef {
  id: string; era: 0 | EraId; title: string; text: string; choices: EventChoiceDef[];
  weight: number; condition?: string;
}
/** The whole content.json. */
export interface Content {
  meta: { game: string; country: string; version: number; seatsTotal: number; majority: number; turnsTotal: number };
  eras: EraDef[]; groups: GroupDef[]; regions: RegionDef[]; ideologies: IdeologyDef[];
  rivals: RivalDef[]; laws: LawDef[]; events: EventDef[];
}

// ---------------------------------------------------------------- state

/** Turn phase. 'event' = an event card must be resolved; 'actions' = spend AP / vote;
 *  'coalition' = government formation awaits the player; 'over' = game finished. */
export type Phase = 'event' | 'actions' | 'coalition' | 'over';

/** Relation step with a rival: -2 hostile, -1 cool, 0 neutral, +1 friendly, +2 ally. */
export type RelationStep = -2 | -1 | 0 | 1 | 2;

/** Player's chosen stance on a docket item. */
export type Stance = 'yes' | 'no' | 'abstain';

/** A bill waiting for a roll call this turn. */
export interface DocketItem {
  /** Unique id within the game (e.g. "d12"). */
  id: string;
  kind: 'enact' | 'repeal';
  lawId: LawId;
  proposer: PartyId;
  /** Proposer was in government when drafted. */
  government: boolean;
  /** How the player's bloc votes. Defaults to 'yes' on own bills, ideology-based on rival bills. */
  playerStance: Stance;
  /** Parties whipped on this bill (1 PC each). */
  whips: PartyId[];
}

/** A temporary per-turn effect (foreign loan, silver seam royalties, retraining fund...). */
export interface TimedEffect {
  id: string; label: string; turnsLeft: number;
  /** Treasury delta per turn (negative = cost). */
  treasury: number;
  stats: Partial<Record<StatId, number>>;
  groupEffects: Record<GroupId, number>;
}

/** Government after formation. */
export interface Government {
  /** Leading party, or null before the founding assembly. */
  leader: PartyId | null;
  /** All member parties, leader included. */
  members: PartyId[];
  /** True if members hold fewer than 37 seats. */
  minority: boolean;
}

/** Pending formation step that needs the player's input. */
export type PendingCoalition =
  | { kind: 'form'; seats: Record<PartyId, number> }
  | { kind: 'offer'; leader: RivalId; partners: RivalId[] };

/** Summary of one election. */
export interface ElectionResult {
  turn: number;
  /** National vote share per party (0..1). */
  share: Record<PartyId, number>;
  /** Seats per party, sums to 72. */
  seats: Record<PartyId, number>;
  /** Region breakdown. */
  regions: { regionId: RegionId; share: Record<PartyId, number>; seats: Record<PartyId, number> }[];
}

/** Bloc stance in a roll call. */
export type BlocStance = 'yes' | 'no' | 'abstain';

/** Forecast (deterministic) or actual roll call for one bill. */
export interface VoteTally {
  itemId: string;
  lawId: LawId;
  kind: 'enact' | 'repeal';
  /** Votes needed: 25 quorum normally, 48 for non-repealable laws. */
  threshold: number;
  yes: number; no: number; abstain: number;
  passes: boolean;
  blocs: {
    party: PartyId; seats: number; stance: BlocStance; support: number;
    yes: number; no: number; abstain: number;
    /** Seats expected/actually defecting from the bloc stance. */
    defectors: number;
    /** Player bloc only: rebels voting against the player's stance. */
    rebels: number;
    whipped: boolean;
  }[];
  /** Actual results only: per-seat votes in roll-call order (party, vote). */
  rollCall?: { party: PartyId; vote: BlocStance }[];
}

/** A completed vote stored for history. */
export interface VoteRecord { turn: number; tally: VoteTally; proposer: PartyId; playerStance: Stance }

/** Achievement id. */
export type AchievementId =
  | 'unanimous' | 'kingmaker' | 'balanced_books' | 'green_republic'
  | 'iron_majority' | 'comeback' | 'clean_hands' | 'long_memory';

/** Game outcome. Wins (in government at the end): 'majority' (37+ alone), 'coalition' (leading a coalition),
 *  'minority' (governing alone without 37), 'junior' (junior coalition partner).
 *  'opposition' = finished out of government. Losses: 'bankrupt' | 'collapse' | 'dissolved'. */
export type Outcome = 'majority' | 'coalition' | 'minority' | 'junior' | 'opposition' | 'bankrupt' | 'collapse' | 'dissolved';

/** Player party profile. */
export interface PlayerParty { name: string; color: string; ideologyId: string; economic: number; social: number }

/** Per-rival mutable AI state. */
export interface RivalState {
  id: RivalId;
  approval: Record<GroupId, number>;
  /** Campaign counters per region since the last election (+0.04 attraction each). */
  campaign: Record<RegionId, number>;
  /** Relation with the player. */
  relation: RelationStep;
  /** Populist: welfare law enacted this term while in coalition with the player. */
  termWelfareDone: boolean;
}

/** Complete, JSON-serialisable game state. */
export interface GameState {
  /** Save format version; see migrate(). */
  version: number;
  /** Original seed (for replay/share). */
  seed: number;
  /** Current mulberry32 state. All randomness comes from here. */
  rng: number;
  turn: number;
  era: EraId;
  phase: Phase;
  ap: number;
  /** Player docket items drafted this turn (opposition max 1). */
  draftsThisTurn: number;
  player: PlayerParty;
  /** Player approval per group, 0..100. */
  approval: Record<GroupId, number>;
  /** Neutral point approval drifts back to (the party's ideological starting approval). */
  approvalBase: Record<GroupId, number>;
  /** Approval at the start of this turn (trend arrows, zero-sum drift). */
  approvalStart: Record<GroupId, number>;
  rivals: Record<RivalId, RivalState>;
  /** Current group population shares (era shifts). */
  shares: Record<GroupId, number>;
  /** Current region mixes (era shifts applied). */
  mixes: Record<RegionId, Record<GroupId, number>>;
  /** Player campaign counters per region since last election. */
  campaign: Record<RegionId, number>;
  stats: Record<StatId, number>;
  /** Consecutive turns each stat has been at 0. */
  statZeroTurns: Record<StatId, number>;
  treasury: number;
  debt: number;
  partyFunds: number;
  politicalCapital: number;
  seats: Record<PartyId, number>;
  government: Government;
  pendingCoalition: PendingCoalition | null;
  enacted: LawId[];
  /** Who proposed each enacted law. */
  enactedBy: Record<LawId, PartyId>;
  /** Laws the player voted YES on when enacted (for cynicism). */
  playerPassed: LawId[];
  docket: DocketItem[];
  nextDocketId: number;
  /** Event currently awaiting a choice. */
  pendingEvent: string | null;
  /** Event id -> turn it last fired. */
  eventHistory: Record<string, number>;
  timed: TimedEffect[];
  elections: ElectionResult[];
  votes: VoteRecord[];
  // ---- score bookkeeping
  lawsEnactedAsProposer: number;
  turnsInGovernment: number;
  termsInCoalition: number;
  everWhipped: boolean;
  everRepealed: boolean;
  /** Player seat count dipped below 10 at some election (for Comeback). */
  hadLowSeats: boolean;
  /** Comeback achieved: in government after having fewer than 10 seats. */
  comeback: boolean;
  maxSeats: number;
  maxEnvironment: number;
  lowSeatElections: number;
  unanimous: boolean;
  outcome: Outcome | null;
  /** Free-form log of the whole game (most recent last). */
  history: LogEntry[];
}

// ---------------------------------------------------------------- actions

/** Every player action. Dispatch with apply(state, action). */
export type Action =
  /** Pick choice 0 or 1 of the pending event. */
  | { type: 'resolveEvent'; choice: 0 | 1 }
  /** 1 AP, 10 treasury in government / 10 party funds in opposition: +1 campaign in region. */
  | { type: 'campaign'; regionId: RegionId }
  /** 1 AP: +5 approval with group, -2 with its rival group. */
  | { type: 'court'; groupId: GroupId }
  /** 1 AP: put an unlocked, un-enacted law on the docket. */
  | { type: 'draft'; lawId: LawId }
  /** 1 AP: put a repeal of an enacted, repealable law on the docket. */
  | { type: 'repeal'; lawId: LawId }
  /** 1 AP + 2 PC: +1 relation step with a rival. */
  | { type: 'lobby'; rivalId: RivalId }
  /** Free: set how your bloc votes on a docket item. */
  | { type: 'setStance'; itemId: string; stance: Stance }
  /** 1 PC: whip a bloc on a docket item (abstain->yes, or remove rebels for the player bloc). */
  | { type: 'whip'; itemId: string; party: PartyId }
  /** Free: hold the roll call for one docket item now. */
  | { type: 'callVote'; itemId: string }
  /** Coalition phase ('form'): choose partners. Empty list = minority government. */
  | { type: 'formCoalition'; partners: RivalId[] }
  /** Coalition phase ('offer'): accept or decline joining a rival-led government. */
  | { type: 'answerOffer'; accept: boolean }
  /** Same as calling endTurn(state). */
  | { type: 'endTurn' };

/** Log entry kinds for the UI ticker / animations. */
export type LogKind =
  | 'info' | 'error' | 'event' | 'approval' | 'vote' | 'law' | 'budget' | 'election'
  | 'coalition' | 'era' | 'rival' | 'stat' | 'gameover' | 'achievement';

/** One line of narrative plus optional structured data for animations. */
export interface LogEntry { turn: number; kind: LogKind; text: string; data?: unknown }

/** Result of apply/endTurn. The input state is never mutated. */
export interface ApplyResult { state: GameState; log: LogEntry[] }

/** Options for newGame. */
export interface NewGameOptions {
  /** RNG seed (any integer). Default: 1. */
  seed?: number;
  partyName?: string;
  color?: string;
  /** 'commonwealth' | 'hearth' | 'ledger' | 'custom'. Default 'commonwealth'. */
  ideologyId?: string;
  /** Used when ideologyId = 'custom' (or to override); clamped to -1..1. */
  economic?: number;
  social?: number;
}

/** Preview of an action without committing (all deltas are new - old). */
export interface ActionPreview {
  valid: boolean;
  /** Why it is invalid, if so. */
  reason?: string;
  cost: { ap: number; pc: number; treasury: number; partyFunds: number };
  approvalDelta: Record<GroupId, number>;
  statsDelta: Partial<Record<StatId, number>>;
  treasuryDelta: number;
  /** Relation change for lobby. */
  relationDelta?: Partial<Record<RivalId, number>>;
  /** For callVote / whip / setStance: the resulting forecast. */
  forecast?: VoteTally;
}

/** Final score breakdown. */
export interface ScoreBreakdown {
  laws: number; seats: number; government: number; stats: number; debt: number;
  total: number;
  rank: 'Backbencher' | 'Whip' | 'Minister' | 'First Speaker' | 'Founder of the Republic';
  achievements: AchievementId[];
}

/** Public engine API (implemented in ./engine.ts, re-exported from ./index.ts). */
export interface EngineApi {
  newGame(opts?: NewGameOptions): GameState;
  apply(state: GameState, action: Action): ApplyResult;
  forecastVote(state: GameState, lawIdOrItemId: string): VoteTally | null;
  previewAction(state: GameState, action: Action): ActionPreview;
  endTurn(state: GameState): ApplyResult;
  listAvailableActions(state: GameState): Action[];
  score(state: GameState): ScoreBreakdown;
}
