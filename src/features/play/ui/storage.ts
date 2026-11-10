import type { GameState } from '../engine/types';
import { deserialize } from '../engine';

const SAVE_KEY = 'poltok.quorum.save.v1';
const META_KEY = 'poltok.quorum.meta.v1';
const PREFS_KEY = 'poltok.quorum.prefs.v1';

export interface Meta { bestScore: number; achievements: string[]; tutorialDone: boolean; games: number; daily?: { date: string; score: number } | null }
export interface Prefs { muted: boolean; volume: number; reduceMotion: boolean; music: boolean; musicVolume: number; advisor: boolean }

function read<T>(key: string): T | null {
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : null; } catch { return null; }
}
function write(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage full or blocked */ }
}

export function loadSave(): GameState | null {
  let s: GameState | null = null;
  try { const raw = localStorage.getItem(SAVE_KEY); s = raw ? deserialize(raw) : null; } catch { s = null; }
  if (!s || typeof s !== 'object' || typeof s.turn !== 'number' || !s.player || !s.approval) return null;
  return s;
}
/** A save exists (an unfinished game, or a finished one whose results have not been dismissed). */
export const hasSave = () => !!loadSave();
/** The saved game has ended (Continue shows its results). */
export const saveIsOver = () => loadSave()?.phase === 'over';
export const writeSave = (s: GameState) => write(SAVE_KEY, s);
export const clearSave = () => { try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } };

export const loadMeta = (): Meta => ({ bestScore: 0, achievements: [], tutorialDone: false, games: 0, ...(read<Partial<Meta>>(META_KEY) ?? {}) });
export const writeMeta = (m: Meta) => write(META_KEY, m);
export const loadPrefs = (): Prefs => ({ muted: false, volume: 0.8, reduceMotion: false, music: true, musicVolume: 0.5, advisor: true, ...(read<Partial<Prefs>>(PREFS_KEY) ?? {}) });
export const writePrefs = (p: Prefs) => write(PREFS_KEY, p);
export const resetAll = () => { for (const k of [SAVE_KEY, META_KEY]) try { localStorage.removeItem(k); } catch { /* ignore */ } };

const SEEN_KEY = 'poltok.quorum.seen.v1';
/** Turn of the last election night the player watched to the end (so Continue can replay an unseen one). */
export const loadSeenElection = (): number => { const v = read<number>(SEEN_KEY); return typeof v === 'number' ? v : -1; };
export const writeSeenElection = (turn: number) => write(SEEN_KEY, turn);

// ---------------------------------------------------------------- chronicle (per-turn snapshots for the Statistics tab)

export interface Snapshot { turn: number; approval: number; seats: number; projected: number; debt: number; treasury: number; pc: number; stats: Record<string, number>; inGov: boolean }
const CHRON_KEY = 'poltok.quorum.chronicle.v1';
/** Snapshots for the game with this seed (one per turn; later writes for the same turn replace earlier ones). */
export function loadChronicle(seed: number): Snapshot[] {
  const c = read<{ seed: number; snaps: Snapshot[] }>(CHRON_KEY);
  return c && c.seed === seed && Array.isArray(c.snaps) ? c.snaps : [];
}
export function recordSnapshot(seed: number, snap: Snapshot) {
  const snaps = loadChronicle(seed).filter((x) => x.turn !== snap.turn);
  snaps.push(snap); snaps.sort((a, b) => a.turn - b.turn);
  write(CHRON_KEY, { seed, snaps });
}
