// Public entry point for the QUORUM engine. Import from 'features/play/engine'.
export * from './types';
export {
  newGame, apply, endTurn, forecastVote, previewAction, listAvailableActions, score,
  validate, budget, courtGain, projectSeats, regionShares, dhondt, eventChoice, acceptablePartners,
  coalitionStance, coalitionTerms, fallbackGovernment,
  draftableLaws, playerInGovernment, rivalGroup, topGroups, startingApproval, axisDist, partyAxis,
  migrate, serialize, deserialize, STAT_IDS, STYLE_CATEGORIES,
} from './engine';
export { CONTENT, LAWS, EVENTS, RIVALS, GROUPS, REGIONS, GROUP_IDS, REGION_IDS, RIVAL_IDS } from './content';
// ---- v2 (see docs/game/v2-api.md)
export { currentEvent, amendmentsFor, scenarioGoals, consumesRng, isDeterministic } from './engine';
export {
  currentDebate, debateChoice, wingMood, wingPosition, wingReaction, wingSupport, wingSeats, partyMood, competence,
  cabinetEffects, suggestCabinet, activeCharacters, challengeOdds, lobbyCost, postStrength, defectionTarget,
} from './party';
export {
  dailyChallenge, unlockedPerks, isElectionTurn, nextElectionTurn, turnsToElection, isV2Achievement, resolveMods, hashString,
} from './meta';
export { headlines } from './headlines';
export {
  WINGS, POSTS, TRAITS, CHARACTERS, DEBATES, AMENDMENTS, SCENARIOS, DIFFICULTIES, PERKS, ACHIEVEMENTS,
  WING_IDS, POST_IDS, CHARACTER_IDS,
} from './content';
export * as CONSTANTS from './constants';

import type { EngineApi } from './types';
import { newGame, apply, endTurn, forecastVote, previewAction, listAvailableActions, score } from './engine';
/** The public API as one object (same functions as the named exports). */
export const engine: EngineApi = { newGame, apply, endTurn, forecastVote, previewAction, listAvailableActions, score };
