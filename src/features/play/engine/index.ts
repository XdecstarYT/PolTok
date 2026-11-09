// Public entry point for the QUORUM engine. Import from 'features/play/engine'.
export * from './types';
export {
  newGame, apply, endTurn, forecastVote, previewAction, listAvailableActions, score,
  validate, budget, courtGain, projectSeats, regionShares, dhondt, eventChoice, acceptablePartners,
  draftableLaws, playerInGovernment, rivalGroup, topGroups, startingApproval, axisDist, partyAxis,
  migrate, serialize, deserialize, STAT_IDS, STYLE_CATEGORIES,
} from './engine';
export { CONTENT, LAWS, EVENTS, RIVALS, GROUPS, REGIONS, GROUP_IDS, REGION_IDS, RIVAL_IDS } from './content';
export * as CONSTANTS from './constants';

import type { EngineApi } from './types';
import { newGame, apply, endTurn, forecastVote, previewAction, listAvailableActions, score } from './engine';
/** The public API as one object (same functions as the named exports). */
export const engine: EngineApi = { newGame, apply, endTurn, forecastVote, previewAction, listAvailableActions, score };
