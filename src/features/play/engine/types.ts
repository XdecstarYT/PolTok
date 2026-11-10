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
  /** v2: party-wing happiness deltas. */
  wings?: Partial<Record<WingId, number>>;
  /** v2: relation step deltas with rivals. */
  relations?: Partial<Record<RivalId, number>>;
  /** v2: schedule a follow-up event `delay` turns later (multi-turn chains). `chance` defaults to 1;
   *  when the roll fails and `else` is set, that event is scheduled instead. */
  followUp?: { event: string; delay: number; chance?: number; else?: string };
}
/** Event card. `era` 0 = any era. `condition` like `law:rail_bond`. */
export interface EventDef {
  id: string; era: 0 | EraId; title: string; text: string; choices: EventChoiceDef[];
  weight: number; condition?: string;
  /** v2: only fires as a scheduled follow-up (or a character crisis), never from the random draw. */
  chainOnly?: boolean;
  /** v2: chain name shared by the events of one storyline (for UI badges). */
  chain?: string;
  /** v2: dynamic character event; text/labels contain {name}, {post}, {wing}, {rival}, {odds}
   *  placeholders. Always render events through currentEvent(s), which fills them in. */
  character?: boolean;
}
/** The whole content.json. */
export interface Content {
  meta: { game: string; country: string; version: number; seatsTotal: number; majority: number; turnsTotal: number };
  eras: EraDef[]; groups: GroupDef[]; regions: RegionDef[]; ideologies: IdeologyDef[];
  rivals: RivalDef[]; laws: LawDef[]; events: EventDef[];
  // ---- v2 content
  wings: WingDef[]; posts: PostDef[]; traits: TraitDef[]; characters: CharacterDef[];
  debates: DebateDef[]; amendments: AmendmentDef[]; scenarios: ScenarioDef[];
  difficulties: DifficultyDef[]; perks: PerkDef[]; achievements: AchievementDef[];
  /** Newspaper mastheads used by headlines(). */
  papers: string[];
}

// ---------------------------------------------------------------- v2 content types

/** Party wing id: 'reformers' | 'pragmatists' | 'traditionalists'. */
export type WingId = string;
/** Cabinet post id. */
export type PostId = 'purse' | 'interior' | 'commons' | 'whip' | 'herald';
/** Politician id (12 in content.json). */
export type CharacterId = string;
/** Politician trait id. */
export type TraitId = 'orator' | 'bean_counter' | 'enforcer' | 'idealist' | 'fixer' | 'diplomat' | 'firebrand' | 'schemer' | 'veteran' | 'reformer';
/** Starting scenario. */
export type ScenarioId = 'sandbox' | 'snap_election' | 'debt_crisis' | 'insurgent';
/** Difficulty level. */
export type DifficultyId = 'story' | 'normal' | 'hard' | 'ironclad';
/** Party perk id (meta progression). */
export type PerkId = string;

/** A wing of the player's own party. Its position is the party's position + `offset` (clamped). */
export interface WingDef {
  id: WingId; name: string; blurb: string; offset: [number, number];
  /** Share of the player's seats this wing controls (sums to 1 across wings). */
  size: number;
  /** Law categories the wing loves / hates. */
  likes: string[]; dislikes: string[];
  /** Groups the wing speaks for (flavour + debate targeting). */
  groups: GroupId[];
}
/** Cabinet post. */
export interface PostDef { id: PostId; name: string; short: string; desc: string }
/** Politician trait. `fit` = competence per post (missing = 0.25). */
export interface TraitDef { id: TraitId; name: string; desc: string; fit: Partial<Record<PostId, number>>; scandalRisk: number }
/** A named politician in the player's party. loyalty/ambition 0..100 (jittered per game). */
export interface CharacterDef { id: CharacterId; name: string; wing: WingId; trait: TraitId; loyalty: number; ambition: number; bio: string }
/** One rhetorical option in a debate / press conference. */
export interface DebateChoiceDef {
  label: string; tone: 'rousing' | 'measured' | 'combative';
  groupEffects: Record<GroupId, number>;
  wings?: Partial<Record<WingId, number>>;
  politicalCapital: number;
  /** Chance (0..1) the line backfires: positive group effects turn into half-size losses and PC -1. */
  risk?: number;
  relations?: Partial<Record<RivalId, number>>;
  /** Approval change for one rival party (attacks). */
  rivalApproval?: { rival: RivalId; groupEffects: Record<GroupId, number> };
}
/** Optional Assembly debate or press conference offered during the actions phase. */
export interface DebateDef {
  id: string; era: 0 | EraId; kind: 'debate' | 'press'; title: string; prompt: string;
  choices: DebateChoiceDef[]; weight: number; condition?: string;
}
/** Amendment template attached to a player bill to win over a bloc. */
export interface AmendmentDef {
  id: string; name: string; desc: string;
  /** Rival bloc it courts ('any' = small boost to every rival). */
  target: RivalId | 'any';
  /** Added to the target bloc's support (0.55 = YES, 0.35 = NO line). */
  support: number;
  /** Applied when the amended law is enacted. */
  groupEffects: Record<GroupId, number>;
  wings?: Partial<Record<WingId, number>>;
  stats?: Partial<Record<StatId, number>>;
  /** Extra per-turn upkeep while the law is in force. */
  upkeep: number;
  /** Treasury paid when attached (negative = cost). */
  oneOff?: number;
  /** Political Capital paid when attached. */
  politicalCapital?: number;
  /** Law categories it fits (empty/missing = any). */
  categories?: string[];
}
/** Starting scenario. */
export interface ScenarioDef {
  id: ScenarioId; name: string; blurb: string;
  /** One-line headline goal shown on the setup screen. */
  goal: string;
  goals: { id: string; text: string; bonus: number }[];
  startTurn: number; electionTurns: number[]; totalTurns: number;
}
/** Difficulty level. */
export interface DifficultyDef {
  id: DifficultyId; name: string; blurb: string;
  /** Added to every rival's approval with every group (and to its drift target). */
  rivalApproval: number;
  treasury: number; politicalCapital: number;
  /** Multiplier on negative event / scandal effects. */
  eventSeverity: number;
  pactChance: number;
  /** Final score multiplier. */
  scoreMult: number;
}
/** Party perk unlocked by an achievement; up to MAX_PERKS chosen at newGame. */
export interface PerkDef { id: PerkId; name: string; desc: string; unlockedBy: AnyAchievementId }

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
  /** v2: amendment id attached to a player bill (see amendmentsFor). */
  amendment?: string;
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
    /** `support` normalised for display: 0..100 (rival blocs: raw support clamped; the player's
     *  own bloc: 100 YES, 50 ABSTAIN, 0 NO). YES at 55+, NO at 35 or less, otherwise ABSTAIN. */
    supportPct: number;
    /** v2, player bloc only: rebels per unhappy party wing (included in `rebels`). */
    wingRebels?: Partial<Record<WingId, number>>;
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
/** v2 achievements (kept out of AchievementId so exhaustive v1 records keep compiling). */
export type AchievementIdV2 =
  | 'silver_tongue' | 'clean_cabinet' | 'survivor' | 'full_bench'
  | 'snap_victory' | 'debt_slayer' | 'insurgent_rise' | 'iron_will' | 'daily_done';
/** Any achievement, v1 or v2. */
export type AnyAchievementId = AchievementId | AchievementIdV2;
/** Display data for an achievement (ACHIEVEMENTS table). */
export interface AchievementDef { id: AnyAchievementId; name: string; desc: string; icon: string }

/** Game outcome. Wins (in government at the end): 'majority' (37+ alone), 'coalition' (leading a coalition),
 *  'minority' (governing alone without 37), 'junior' (junior coalition partner).
 *  'opposition' = finished out of government. Losses: 'bankrupt' | 'collapse' | 'dissolved'. */
export type Outcome = 'majority' | 'coalition' | 'minority' | 'junior' | 'opposition' | 'bankrupt' | 'collapse' | 'dissolved'
  /** v2 loss: you lost a leadership challenge inside your own party. */
  | 'ousted';

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
  /** Rival pairs ("a+b", ids sorted) whose coalition talks succeeded at the last election.
   *  Rolled once per election so formation previews are deterministic. Missing in old saves = none. */
  rivalPacts?: string[];
  /** Free-form log of the whole game (most recent last). */
  history: LogEntry[];

  // ---------------------------------------------------------------- v2 (save version 2)
  scenarioId: ScenarioId;
  difficulty: DifficultyId;
  /** Resolved rule modifiers from scenario + difficulty + perks (persisted so saves are self-contained). */
  mods: Modifiers;
  /** Turns at the end of which an election is held. */
  electionTurns: number[];
  /** Last turn of the game. */
  totalTurns: number;
  characters: Record<CharacterId, CharacterState>;
  cabinet: Record<PostId, CharacterId | null>;
  /** Wing happiness 0..100. */
  wings: Record<WingId, number>;
  /** Wing happiness at the start of this turn (trend arrows). */
  wingsStart: Record<WingId, number>;
  /** Debate / press conference on offer this turn (optional; expires at end of turn). */
  pendingDebate: string | null;
  /** Debate id -> turn it was last offered. */
  debateHistory: Record<string, number>;
  /** Debates answered without a backfire. */
  debatesWon: number;
  /** Follow-up events waiting to fire at the start of `turn`. */
  scheduledEvents: { event: string; turn: number; context?: EventContext }[];
  /** Context of the pending event (character crises). */
  eventContext: EventContext | null;
  /** Perks equipped this game. */
  perks: PerkId[];
  /** Daily challenge date (YYYY-MM-DD) or null. */
  daily: string | null;
  /** Amendment attached to each enacted law. */
  lawAmendments: Record<LawId, string>;
  /** Extra upkeep per enacted law from amendments. */
  lawExtraUpkeep: Record<LawId, number>;
  /** Fractional PC from the Chief Whip, paid out at 1. */
  pcProgress: number;
  scandals: number;
  challengesSurvived: number;
  defections: number;
  /** Turns with all five cabinet posts filled. */
  fullCabinetTurns: number;
  /** Turn of the last leadership challenge (-99 = never). */
  lastChallenge: number;
  /** Scenario goal ids achieved so far. */
  goalsDone: string[];
  /** v2: one snapshot per completed turn (plus the starting position), oldest first. For statistics charts.
   *  (`history` was already taken by the log.) */
  timeline: TurnSnapshot[];
}

/** v2: end-of-turn snapshot for charts. `turn` is the turn that just ended (the first entry is the start of the game). */
export interface TurnSnapshot {
  turn: number;
  approval: Record<GroupId, number>;
  seats: Record<PartyId, number>;
  debt: number;
  treasury: number;
  politicalCapital: number;
  wings: Record<WingId, number>;
  stats: Record<StatId, number>;
}

/** v2: resolved rule modifiers. */
export interface Modifiers {
  rivalApproval: number;
  eventSeverity: number;
  pactChance: number;
  campaignMult: number;
  /** Party dissolves after two consecutive elections below this many seats. */
  dissolveBelow: number;
  lobbyPc: number;
  maxPc: number;
  scoreMult: number;
  /** Debate backfire chance reduction. */
  debateRiskCut: number;
}

/** v2: who/what a dynamic (character) event is about. */
export interface EventContext { characterId?: CharacterId; rivalId?: RivalId; post?: PostId }

/** v2: mutable politician state. */
export interface CharacterState {
  id: CharacterId;
  loyalty: number;
  ambition: number;
  /** 'active' = in the party (bench or cabinet); 'disgraced' = resigned in scandal; 'defected' = crossed the floor. */
  status: 'active' | 'disgraced' | 'defected';
  post: PostId | null;
  /** Rival joined on defection. */
  joined?: RivalId;
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
  | { type: 'draft'; lawId: LawId; amendment?: string }
  /** 1 AP: put a repeal of an enacted, repealable law on the docket. */
  | { type: 'repeal'; lawId: LawId }
  /** v2: free; appoint an active politician to a cabinet post. Replacing a sitting minister costs 1 PC
   *  and angers them (loyalty -20). Moving a minister between posts is allowed. */
  | { type: 'appoint'; post: PostId; characterId: CharacterId }
  /** v2: free; sack the minister in a post (loyalty -20). */
  | { type: 'dismiss'; post: PostId }
  /** v2: free; answer the pending debate/press conference with choice 0, 1 or 2. */
  | { type: 'debate'; choice: 0 | 1 | 2 }
  /** v2: free; attach an amendment (one per bill) to one of your own 'enact' docket items; pays its one-off/PC cost. */
  | { type: 'amend'; itemId: string; amendmentId: string }
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
  | 'coalition' | 'era' | 'rival' | 'stat' | 'gameover' | 'achievement'
  // v2
  | 'character' | 'debate' | 'wing';

/** One line of narrative plus optional structured data for animations. */
export interface LogEntry { turn: number; kind: LogKind; text: string; data?: unknown }

/** What happened during an apply/endTurn, so the UI does not have to diff states. */
export interface Transitions {
  /** An election was held (seats changed hands). */
  electionHeld: boolean;
  /** A new era began (the new era is state.era). */
  eraChanged: boolean;
  /** The game ended (see state.outcome). */
  gameOver: boolean;
  /** A government was formed (state.government is the new one). */
  governmentFormed: boolean;
}

/** Result of apply/endTurn. The input state is never mutated. */
export interface ApplyResult { state: GameState; log: LogEntry[]; transitions: Transitions }

/** Whether a rival would join a coalition, and why. */
export interface CoalitionTerms {
  party: RivalId;
  accepts: boolean;
  /** Human-readable reasons (first one is the deciding reason). */
  reasons: string[];
  /** Axis distance between the two parties. */
  distance: number;
  /** Largest distance this rival tolerates at the current relation. */
  maxDistance: number;
  seats: number;
}

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
  /** v2: starting scenario (default 'sandbox'). */
  scenarioId?: ScenarioId;
  /** v2: difficulty (default 'normal'). */
  difficulty?: DifficultyId;
  /** v2: perks to equip (max MAX_PERKS; unknown ids ignored). The UI checks unlocks via unlockedPerks(). */
  perks?: PerkId[];
  /** v2: daily challenge date (YYYY-MM-DD); recorded in state.daily. Use dailyChallenge(date).options. */
  daily?: string;
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
  /** For callVote / whip / setStance / draft / amend: the resulting forecast. */
  forecast?: VoteTally;
  /** v2: wing happiness change. */
  wingsDelta?: Partial<Record<WingId, number>>;
  /** v2: loyalty change per politician. */
  loyaltyDelta?: Partial<Record<CharacterId, number>>;
  /** v2 (debate): backfire chance of the chosen line. */
  risk?: number;
}

/** Final score breakdown. */
export interface ScoreBreakdown {
  laws: number; seats: number; government: number; stats: number; debt: number;
  /** v2: scenario goal bonuses. */
  bonus: number;
  /** v2: difficulty multiplier. total = round((laws+seats+government+stats+debt+bonus) * multiplier). */
  multiplier: number;
  total: number;
  rank: 'Backbencher' | 'Whip' | 'Minister' | 'First Speaker' | 'Founder of the Republic';
  /** v1 achievements only (unchanged contract). */
  achievements: AchievementId[];
  /** v2: every achievement earned, v1 and v2. */
  allAchievements: AnyAchievementId[];
  /** v2: scenario goals with status. */
  goals: ScenarioGoal[];
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

// ---------------------------------------------------------------- v2 view helpers (returned by the engine)

/** Wing mood for the party screen (wingMood()). */
export interface WingMood {
  id: WingId; name: string; happiness: number;
  /** Change since the start of the turn. */
  trend: number;
  /** content 55+, restless 35-54, rebellious 20-34 (rebels on bills it dislikes), revolt <20 (rebels on everything; whip only halves them). */
  mood: 'content' | 'restless' | 'rebellious' | 'revolt';
  /** Seats this wing controls right now. */
  seats: number;
  position: [number, number];
}

/** One cabinet line for the UI (cabinetEffects()). */
export interface CabinetEffect {
  post: PostId; characterId: CharacterId | null;
  /** 0 (empty) .. 1 (perfect fit). Halved in opposition (shadow cabinet). */
  competence: number;
  /** Human-readable per-turn effect, e.g. "+5 treasury per turn". */
  text: string;
}

/** An amendment offered for a bill (amendmentsFor()). */
export interface AmendmentOption {
  amendment: AmendmentDef;
  /** Bloc(s) whose support rises. */
  targets: RivalId[];
  /** Forecast with the amendment attached. */
  forecast: VoteTally;
  /** True when the amendment turns a failing forecast into a passing one. */
  flips: boolean;
  /** Wing happiness change if the amended law passes (on top of the law itself). */
  wingsDelta: Partial<Record<WingId, number>>;
  /** Target blocs whose stance the amendment changes (e.g. abstain -> yes). Empty = it moves no bloc. */
  stanceChanges: { party: RivalId; from: BlocStance; to: BlocStance }[];
  /** Extra YES votes in the forecast compared with the unamended bill. */
  yesGain: number;
  /** NO votes removed from the forecast compared with the unamended bill. */
  noDrop: number;
}

/** Scenario goal status (scenarioGoals()). */
export interface ScenarioGoal { id: string; text: string; bonus: number; done: boolean }

/** A newspaper headline (headlines()). */
export interface Headline {
  paper: string; text: string;
  tone: 'good' | 'bad' | 'neutral';
  topic: 'election' | 'law' | 'vote' | 'scandal' | 'party' | 'economy' | 'stat' | 'rival' | 'debate' | 'era' | 'polls';
}

/** Daily challenge for a date (dailyChallenge()). */
export interface DailyChallenge {
  date: string; seed: number; scenarioId: ScenarioId; difficulty: DifficultyId; ideologyId: string;
  /** Short description, e.g. "Debt Crisis · Hard · Hearth". */
  label: string;
  /** Pass straight to newGame(). */
  options: NewGameOptions;
}

/** Effective debate choice (debateChoice()). */
export interface DebateChoicePreview {
  label: string; tone: DebateChoiceDef['tone'];
  groupEffects: Record<GroupId, number>;
  wings: Partial<Record<WingId, number>>;
  politicalCapital: number;
  /** Backfire chance after the Herald's skill. */
  risk: number;
  relations: Partial<Record<RivalId, number>>;
}

/** Leadership challenge odds (challengeOdds()). */
export interface ChallengeOdds { characterId: CharacterId; winChance: number; reasons: string[] }
