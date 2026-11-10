// v2 meta systems: rule modifiers (scenario + difficulty + perks), perk unlocks, the daily challenge
// and the election calendar. Pure functions; no RNG state is touched.
import type {
  AnyAchievementId, DailyChallenge, DifficultyId, GameState, Modifiers, PerkDef, PerkId, ScenarioId,
} from './types';
import * as K from './constants';
import { CONTENT, DIFFICULTIES, PERKS, SCENARIOS } from './content';

const SCENARIO_ORDER: ScenarioId[] = ['sandbox', 'snap_election', 'debt_crisis', 'insurgent'];

/** Resolve the rule modifiers for a scenario, difficulty and perk set. */
export function resolveMods(scenarioId: ScenarioId, difficulty: DifficultyId, perks: PerkId[]): Modifiers {
  const d = DIFFICULTIES[difficulty] ?? DIFFICULTIES.normal;
  return {
    // the establishment closes ranks against an insurgent movement
    rivalApproval: d.rivalApproval + (scenarioId === 'insurgent' ? 2 : 0),
    eventSeverity: d.eventSeverity,
    pactChance: d.pactChance,
    campaignMult: (perks.includes('party_machine') ? 1.25 : 1) * (scenarioId === 'insurgent' ? 1.25 : 1),
    dissolveBelow: scenarioId === 'insurgent' ? 5 : 8,
    lobbyPc: K.LOBBY_PC,
    maxPc: K.MAX_PC + (perks.includes('second_wind') ? 1 : 0),
    scoreMult: d.scoreMult,
    debateRiskCut: perks.includes('golden_throat') ? 0.1 : 0,
  };
}

/** Default modifiers (sandbox, normal, no perks) — used when migrating v1 saves. */
export const DEFAULT_MODS: Modifiers = resolveMods('sandbox', 'normal', []);

/** Keep only known perks, at most MAX_PERKS, without duplicates. */
export function sanitizePerks(perks: PerkId[] | undefined): PerkId[] {
  return [...new Set(perks ?? [])].filter((p) => PERKS[p]).slice(0, K.MAX_PERKS);
}

/** Perks unlocked by a list of earned achievement ids (store those in your meta save). */
export function unlockedPerks(achievements: readonly string[]): PerkDef[] {
  const have = new Set(achievements);
  return CONTENT.perks.filter((p) => have.has(p.unlockedBy));
}

/** FNV-1a 32-bit hash of a string. */
export function hashString(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Normalise a Date or string to 'YYYY-MM-DD'. Dates use the UTC calendar day, so every player shares one challenge. */
export function dateKey(date: Date | string): string {
  if (typeof date === 'string') return date.slice(0, 10);
  return date.toISOString().slice(0, 10);
}

/** Daily challenge for a date: same date, same seed, scenario, difficulty and ideology for everyone. */
export function dailyChallenge(date: Date | string = new Date()): DailyChallenge {
  const key = dateKey(date);
  const h = hashString(`quorum-daily-${key}`);
  const seed = h % 1_000_000_007;
  const scenarioId = SCENARIO_ORDER[(h >>> 3) % SCENARIO_ORDER.length];
  const weekday = new Date(`${key}T12:00:00Z`).getUTCDay();
  // weekends bring the hard days; Sunday is Ironclad
  const difficulty: DifficultyId = weekday === 0 ? 'ironclad' : weekday === 6 ? 'hard' : ((h >>> 7) % 3 === 0 ? 'hard' : 'normal');
  const ideologies = ['commonwealth', 'hearth', 'ledger'];
  const ideologyId = ideologies[(h >>> 11) % ideologies.length];
  const ideo = CONTENT.ideologies.find((i) => i.id === ideologyId)!;
  const label = `${SCENARIOS[scenarioId].name} · ${DIFFICULTIES[difficulty].name} · ${ideo.name.split(' ')[0]}`;
  return {
    date: key, seed, scenarioId, difficulty, ideologyId, label,
    options: { seed, scenarioId, difficulty, ideologyId, daily: key, partyName: 'Daily Dispatch Party' },
  };
}

/** True when an election is held at the end of `turn` (default: the current turn). */
export function isElectionTurn(s: GameState, turn = s.turn): boolean {
  return s.electionTurns.includes(turn);
}

/** Next election turn at or after the current turn, or null if none is left. */
export function nextElectionTurn(s: GameState): number | null {
  return s.electionTurns.find((t) => t >= s.turn) ?? null;
}

/** Turns until the next election (0 = this turn ends with one). -1 when no election is left. */
export function turnsToElection(s: GameState): number {
  const n = nextElectionTurn(s);
  return n === null ? -1 : n - s.turn;
}

/** Whether `id` is a v2 achievement id (for UIs with v1-only tables). */
export function isV2Achievement(id: AnyAchievementId): boolean {
  return !['unanimous', 'kingmaker', 'balanced_books', 'green_republic', 'iron_majority', 'comeback', 'clean_hands', 'long_memory'].includes(id);
}
