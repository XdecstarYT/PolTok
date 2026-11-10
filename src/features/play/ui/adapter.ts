// Thin UI adapter over the engine: content lookups, party colours, and derived view helpers.
// Engine files are owned by the engine engineer; nothing here mutates GameState.
import * as engine from '../engine';
import rawContent from '../engine/content.json';
import type {
  Action, ActionPreview, ApplyResult, CoalitionTerms, Content, GameState, GroupId, LawDef, PartyId, RegionId, RivalId, StatId, VoteTally,
} from '../engine/types';

export const CONTENT = rawContent as unknown as Content;
export const MAJORITY = CONTENT.meta.majority ?? 37;
export const SEATS_TOTAL = CONTENT.meta.seatsTotal ?? 72;
export const TURNS_TOTAL = CONTENT.meta.turnsTotal ?? 24;

export const api = {
  newGame: engine.newGame,
  apply: engine.apply as (s: GameState, a: Action) => ApplyResult,
  forecastVote: engine.forecastVote as (s: GameState, id: string) => VoteTally | null,
  previewAction: engine.previewAction as (s: GameState, a: Action) => ActionPreview,
  endTurn: engine.endTurn as (s: GameState) => ApplyResult,
  listAvailableActions: engine.listAvailableActions as (s: GameState) => Action[],
  score: engine.score,
  /** Engine's own coalition rule: which rivals accept a player-led government, and why. */
  coalitionTerms: engine.coalitionTerms as (s: GameState) => CoalitionTerms[],
  /** Who governs if the player passes on forming/joining a coalition. */
  fallbackGovernment: engine.fallbackGovernment as (s: GameState) => PartyId[],
};

export const STATS: StatId[] = ['economy', 'order', 'liberty', 'environment', 'health'];
export const STAT_LABEL: Record<StatId, string> = { economy: 'Economy', order: 'Order', liberty: 'Liberty', environment: 'Environment', health: 'Health' };
export const STAT_ICON: Record<StatId, string> = { economy: '⚙', order: '⚖', liberty: '✦', environment: '❦', health: '✚' };

/** Text glyphs for group icons (no external assets). */
export const GROUP_GLYPH: Record<string, string> = {
  wrench: '⚒', wheat: '❀', coins: '◎', lantern: '☼', book: '✎', cane: '❖', leaf: '❦', shield: '⛨',
};
export const groupGlyph = (id: GroupId) => GROUP_GLYPH[CONTENT.groups.find((g) => g.id === id)?.icon ?? ''] ?? '●';
export const groupName = (id: GroupId) => CONTENT.groups.find((g) => g.id === id)?.name ?? id;
export const regionName = (id: RegionId) => CONTENT.regions.find((r) => r.id === id)?.name ?? id;
export const lawById = (id: string): LawDef | undefined => CONTENT.laws.find((l) => l.id === id);
export const rivalDef = (id: RivalId) => CONTENT.rivals.find((r) => r.id === id);

export const PARTY_SWATCHES = ['#7a4fd6', '#2f9e6b', '#d6456b', '#3f6fd8', '#e0782f', '#1fa3a3'];

export function partyColor(s: GameState | null, p: PartyId): string {
  if (p === 'player') return s?.player.color ?? PARTY_SWATCHES[0];
  return rivalDef(p)?.color ?? '#888';
}
export function partyName(s: GameState | null, p: PartyId): string {
  if (p === 'player') return s?.player.name ?? 'Your party';
  return rivalDef(p)?.name ?? p;
}
export function partyShort(s: GameState | null, p: PartyId): string {
  const n = partyName(s, p);
  return n.split(/\s+/).filter((w) => /^[A-Z]/.test(w)).map((w) => w[0]).join('').slice(0, 3) || n.slice(0, 3);
}
export function partyAxis(s: GameState, p: PartyId): [number, number] {
  if (p === 'player') return [s.player.economic, s.player.social];
  const r = rivalDef(p);
  return [r?.economic ?? 0, r?.social ?? 0];
}
/** All parties, ordered left-to-right on the economic axis (for hemicycle seating). */
export function partiesLeftToRight(s: GameState): PartyId[] {
  const ps: PartyId[] = ['player', ...CONTENT.rivals.map((r) => r.id)];
  return ps.sort((a, b) => partyAxis(s, a)[0] - partyAxis(s, b)[0]);
}
/** Seat list (72 party ids) in left-to-right hemicycle order. */
export function seatList(s: GameState): PartyId[] {
  const out: PartyId[] = [];
  for (const p of partiesLeftToRight(s)) for (let i = 0; i < (s.seats[p] ?? 0); i++) out.push(p);
  while (out.length < SEATS_TOTAL) out.push('');
  return out;
}
export const axisDist = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export const RELATION_LABEL: Record<number, string> = { [-2]: 'Hostile', [-1]: 'Cool', 0: 'Neutral', 1: 'Friendly', 2: 'Ally' };

export const inGovernment = (s: GameState) => s.government.members.includes('player');
export const eraDef = (s: GameState) => CONTENT.eras.find((e) => e.id === s.era) ?? CONTENT.eras[0];
export const isElectionTurn = (t: number) => t % 4 === 0;
export const turnsToElection = (t: number) => (4 - (t % 4)) % 4;

/** Highest-fit unlocked law for the player (tutorial suggestion). */
export function suggestedLaw(s: GameState): LawDef | undefined {
  const me: [number, number] = [s.player.economic, s.player.social];
  return availableLaws(s)
    .map((l) => ({ l, fit: 1 - axisDist(me, l.axis) / 1.4 + Object.values(l.groupEffects).reduce((a, b) => a + b, 0) / 40 }))
    .sort((a, b) => b.fit - a.fit)[0]?.l;
}
export const availableLaws = (s: GameState) => CONTENT.laws.filter((l) => l.era <= s.era && !s.enacted.includes(l.id));

export function canDo(s: GameState, a: Action): ActionPreview {
  try { return api.previewAction(s, a); } catch (e) {
    return { valid: false, reason: String((e as Error)?.message ?? e), cost: { ap: 0, pc: 0, treasury: 0, partyFunds: 0 }, approvalDelta: {}, statsDelta: {}, treasuryDelta: 0 };
  }
}
export const signed = (n: number) => (n > 0 ? `+${Math.round(n)}` : `${Math.round(n)}`);

// ---------------------------------------------------------------- v2-aware schedule helpers

/** Last turn of this game (scenarios can shorten it). */
export const totalTurns = (s: GameState) => s.totalTurns ?? TURNS_TOTAL;
/** Turns (at the end of which) an election is held. */
export const electionTurnsOf = (s: GameState): number[] => s.electionTurns ?? Array.from({ length: Math.floor(TURNS_TOTAL / 4) }, (_, i) => (i + 1) * 4);
/** Turns until the next election (0 = at the end of this turn), or null if none remain. */
export function nextElectionIn(s: GameState): number | null {
  const t = electionTurnsOf(s).filter((x) => x >= s.turn).sort((a, b) => a - b)[0];
  return t === undefined ? null : t - s.turn;
}
/** Era-calendar year for a turn (two years per turn inside each era's span). */
export function yearOf(turn: number): number {
  const era = CONTENT.eras.find((e) => turn >= e.turns[0] && turn <= e.turns[1]) ?? CONTENT.eras[0];
  const y0 = Number(era.years.split('-')[0]) || 1871;
  return y0 + Math.max(0, turn - era.turns[0]) * 2;
}

export const projectSeats = engine.projectSeats as (s: GameState) => Record<PartyId, number>;
export const regionSharesNow = (s: GameState, r: RegionId) => engine.regionShares(s, r) as Record<PartyId, number>;
export const dhondt = engine.dhondt as (v: Record<string, number>, seats: number) => Record<string, number>;
export const budgetOf = engine.budget;

/** Population-weighted approval of the player (0..100). */
export function approvalIndex(s: GameState): number {
  let a = 0, w = 0;
  for (const g of CONTENT.groups) { const sh = s.shares?.[g.id] ?? g.share; a += (s.approval[g.id] ?? 0) * sh; w += sh; }
  return w ? a / w : 0;
}

/** Achievement icon names (content.json) -> text glyphs. */
const ACH_GLYPH: Record<string, string> = {
  hand: '✋', crown: '♛', scales: '⚖', leaf: '❦', shield: '⛨', cycle: '↺', sparkle: '✧', infinity: '∞', mic: '❝', broom: '✓',
  flag: '⚑', chairs: '⑤', bolt: 'ϟ', coin: '◎', fist: '✊', anvil: '⚒', calendar: '☼', star: '★',
};
export const achGlyph = (icon: string) => ACH_GLYPH[icon] ?? (icon.length <= 2 ? icon : '★');
