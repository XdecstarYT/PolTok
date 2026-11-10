// Shared engine helpers (no game rules beyond the basics). Imported by engine.ts and the v2 modules.
import type { ApplyResult, GameState, GroupId, LogEntry, LogKind, PartyId, StatId, Transitions } from './types';
import { RIVALS, RIVAL_IDS } from './content';

export const STAT_IDS: StatId[] = ['economy', 'order', 'liberty', 'environment', 'health'];

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const round1 = (v: number) => Math.round(v * 10) / 10;
export const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
export const dist = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export const NO_TRANSITIONS: Transitions = { electionHeld: false, eraChanged: false, gameOver: false, governmentFormed: false };

export class Ctx {
  log: LogEntry[] = [];
  tr: Transitions = { ...NO_TRANSITIONS };
  result(): ApplyResult { return { state: this.s, log: this.log, transitions: this.tr }; }
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

export function addApproval(s: GameState, p: PartyId, g: GroupId, delta: number) {
  const ap = approvalOf(s, p);
  if (ap[g] === undefined) return;
  ap[g] = round1(clamp(ap[g] + delta, 0, 100));
}

export function addStat(s: GameState, k: StatId, delta: number) {
  s.stats[k] = clamp(Math.round(s.stats[k] + delta), 0, 100);
  if (k === 'environment') s.maxEnvironment = Math.max(s.maxEnvironment, s.stats[k]);
}

export function isGov(s: GameState, p: PartyId) { return s.government.members.includes(p); }
/** True when the player is in government (alone, leading, or as a partner). */
export function playerInGovernment(s: GameState): boolean { return isGov(s, 'player'); }

export function parties(s: GameState): PartyId[] { return ['player', ...RIVAL_IDS]; }

