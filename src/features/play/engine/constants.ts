// Tunable constants. See docs/game/balance.md for the tuning notes.

/** Save format version. Bump and extend migrate() on breaking changes. */
export const SAVE_VERSION = 2;
export const TOTAL_SEATS = 72;
export const MAJORITY = 37;
export const QUORUM = 25;
export const SUPERMAJORITY = 48;
export const TURNS = 24;
export const ELECTION_EVERY = 4;
export const AP_PER_TURN = 3;
export const MAX_PLAYER_DOCKET = 2;
export const OPPOSITION_DRAFTS_PER_TURN = 1;

// approval
export const COURT_GAIN = 5;
export const COURT_RIVAL_LOSS = 2;
/** Courting a group already at or above this approval only gives COURT_GAIN_HIGH. */
export const COURT_SOFT_CAP = 75;
export const COURT_GAIN_HIGH = 2;
export const APPROVAL_DRIFT = 0.08;
export const BETRAYAL_DIST = 1.0;
export const BETRAYAL_COST = 3;
export const CYNICISM_COST = 4;
export const OPPOSED_LAW_FACTOR = 0.25;

// elections
export const CAMPAIGN_BOOST = 0.03;
export const RIVAL_CAMPAIGN_BOOST = 0.04;
export const TURNOUT_NOISE = 0.04;
export const REGION_THRESHOLD = 0.05;
/** A brand-new party only gets this fraction of its attraction at the founding assembly. */
export const FOUNDING_FACTOR = 0.55;
export const RIVAL_DEFAULT_APPROVAL = 52;
// coalitions
/** Policy distance a neutral rival tolerates in a coalition with the player. */
export const COALITION_DIST = 0.4;
/** Extra (or less) tolerated distance per relation step (hostile -2 .. friendly +1; allies always accept). */
export const COALITION_REL_STEP = 0.35;
/** Two rivals will govern together within this distance. */
export const RIVAL_COALITION_DIST = 1.6;
/** Chance, rolled per election, that two rivals within RIVAL_COALITION_DIST are willing to deal this term. */
export const RIVAL_PACT_CHANCE = 0.14;
/** A rival losing this many seats at an election in which the player gains blames the player (relation -1). */
export const BLAME_SEAT_LOSS = 1;
/** Hawks refuse partners more progressive than this. */
export const HAWK_SOCIAL_LIMIT = 0.4;
/** Rivals' approval drifts back toward their base by this fraction per turn. */
export const RIVAL_DRIFT = 0.05;
/** Each turn every rival courts the nearby group where the player out-polls it most. */
export const RIVAL_COURT_GAIN = 4;
export const RIVAL_COURT_RANGE = 0.9;
/** Fraction of an enacted law's group effects that rivals voting YES receive. */
export const RIVAL_LAW_FACTOR = 0.5;

// money
export const START_TREASURY = 100;
export const BASE_INCOME = 40;
export const INCOME_PER_ECONOMY = 0.4;
export const BASE_EXPENSES = 30;
export const DEBT_INTEREST = 0.06;
export const DEBT_INTEREST_CENTRAL_BANK = 0.05;
export const DEBT_ECONOMY_PENALTY_AT = 150;
export const BANKRUPTCY_DEBT = 300;
export const TECHNOCRAT_DEBT_LIMIT = 120;
/** Surplus above this treasury level is auto-paid against debt. */
export const TREASURY_RESERVE = 60;
export const CAMPAIGN_COST = 10;
export const START_PARTY_FUNDS = 30;
export const FUNDS_PER_SEAT = 0.5;

// political capital
export const START_PC = 3;
export const MAX_PC = 8;
export const LOBBY_PC = 2;
export const WHIP_PC = 1;

// events
export const EVENT_CHANCE = 0.6;
export const EVENT_COOLDOWN = 6;
/** Weight multiplier for events that belong to the current era (era 0 events keep weight 1). */
export const ERA_EVENT_WEIGHT = 2.5;

// rival AI
export const RIVAL_PROPOSE_P = 0.5;
export const RIVAL_PROPOSE_P_GOV = 0.8;
/** Fit bonus rivals give to laws unlocked in the current era. */
export const RIVAL_NEW_LAW_BONUS = 0.2;

// ---------------------------------------------------------------- v2

/** Perks a player may equip per game. */
export const MAX_PERKS = 2;

// party wings
export const WING_START = 60;
/** Wings drift toward WING_REST by this fraction per turn. */
export const WING_DRIFT = 0.06;
export const WING_REST = 55;
/** Below this a wing rebels on bills it dislikes. */
export const WING_REBEL_AT = 35;
/** Below this a wing rebels on everything and whipping only halves its rebels. */
export const WING_REVOLT_AT = 20;
/** Happiness change per 0.1 of wing support above/below 0.5 when a law passes (x10). */
export const WING_LAW_SCALE = 14;
/** Bonus/penalty for a liked/disliked law category. */
export const WING_CATEGORY = 3;
export const WING_LAW_CAP = 8;
/** Rebel seats = wing seats * (REBEL_AT - happiness) / REBEL_AT * this. */
export const WING_REBEL_FACTOR = 1.2;
/** Happiness change per seat gained (+) or lost (-) at an election, capped at +-6. */
export const WING_ELECTION_PER_SEAT = 0.5;

// politicians and cabinet
/** Starting loyalty/ambition jitter (+-). */
export const CHAR_JITTER = 8;
export const APPOINT_LOYALTY = 12;
export const DISMISS_LOYALTY = 20;
/** PC cost to replace a sitting minister. */
export const APPOINT_REPLACE_PC = 1;
/** Bench politicians with at least this ambition lose 1 loyalty per turn. */
export const PASSED_OVER_AMBITION = 60;
/** Loyalty change per turn = (wing happiness - 50) / this, capped at +-2. */
export const LOYALTY_WING_DIV = 25;
/** Cabinet effects are multiplied by this in opposition (shadow cabinet). */
export const SHADOW_FACTOR = 0.5;
/** Interior/Commons: approval per turn with their groups at full strength. */
export const CABINET_APPROVAL = 0.25;
/** Purse: treasury per turn at full strength. */
export const PURSE_INCOME = 5;
/** Chief Whip: PC per turn at full strength (fractional, accumulated in pcProgress). */
export const WHIP_PC_RATE = 0.34;
/** Chief Whip: happiness per turn for the unhappiest wing at full strength. */
export const WHIP_WING_CARE = 1.5;
/** Herald: debate effect multiplier bonus and campaign strength bonus at full strength. */
export const HERALD_DEBATE_BONUS = 0.25;
export const HERALD_CAMPAIGN_BONUS = 0.2;
/** Herald: backfire chance cut at full strength. */
export const HERALD_RISK_CUT = 0.1;
/** Scandal chance per minister per turn = trait.scandalRisk * this. */
export const SCANDAL_MULT = 1;
/** Politicians below this loyalty may threaten to defect. */
export const DEFECT_LOYALTY = 15;
export const DEFECT_CHANCE = 0.4;
export const CHALLENGE_AMBITION = 65;
export const CHALLENGE_LOYALTY = 40;
/** Weighted wing happiness below which an ambitious, disloyal politician may challenge you. */
export const CHALLENGE_WING_MOOD = 48;
export const CHALLENGE_CHANCE = 0.3;
export const CHALLENGE_COOLDOWN = 8;

// debates
export const DEBATE_COOLDOWN = 8;
/** Chance per turn (from turn 2) that a debate or press conference is on offer. */
export const DEBATE_CHANCE = 0.6;
/** Action points a debate or press conference takes. */
export const DEBATE_AP = 1;
