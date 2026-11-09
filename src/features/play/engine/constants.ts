// Tunable constants. See docs/game/balance.md for the tuning notes.

/** Save format version. Bump and extend migrate() on breaking changes. */
export const SAVE_VERSION = 1;
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
export const RIVAL_DEFAULT_APPROVAL = 46;
// coalitions
/** Policy distance a neutral rival tolerates in a coalition with the player. */
export const COALITION_DIST = 0.7;
/** Extra (or less) tolerated distance per relation step (hostile -2 .. friendly +1; allies always accept). */
export const COALITION_REL_STEP = 0.35;
/** Two rivals will govern together within this distance. */
export const RIVAL_COALITION_DIST = 1.6;
/** Chance, rolled per election, that two rivals within RIVAL_COALITION_DIST are willing to deal this term. */
export const RIVAL_PACT_CHANCE = 0.16;
/** A rival losing this many seats at an election in which the player gains blames the player (relation -1). */
export const BLAME_SEAT_LOSS = 2;
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
