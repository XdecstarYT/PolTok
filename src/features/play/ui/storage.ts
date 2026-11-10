import type { GameState } from '../engine/types';
import { deserialize } from '../engine';

const SAVE_KEY = 'poltok.quorum.save.v1';
const META_KEY = 'poltok.quorum.meta.v1';
const PREFS_KEY = 'poltok.quorum.prefs.v1';

export interface Meta { bestScore: number; achievements: string[]; tutorialDone: boolean; games: number; daily?: { date: string; score: number } | null }
export interface Prefs {
  muted: boolean; volume: number; reduceMotion: boolean; music: boolean; musicVolume: number; advisor: boolean;
  /** Use the 3D map and chamber when the browser supports WebGL2. */
  map3d: boolean;
  /** 3D quality; 'auto' picks by device and steps down if frames are slow. */
  quality3d: 'auto' | 'low' | 'medium' | 'high';
}

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
export const loadPrefs = (): Prefs => ({ muted: false, volume: 0.8, reduceMotion: false, music: true, musicVolume: 0.5, advisor: true, map3d: true, quality3d: 'auto', ...(read<Partial<Prefs>>(PREFS_KEY) ?? {}) });
export const writePrefs = (p: Prefs) => write(PREFS_KEY, p);
export const resetAll = () => { for (const k of [SAVE_KEY, META_KEY, 'poltok.quorum.chronicle.v1' /* legacy UI chronicle, now s.timeline */]) try { localStorage.removeItem(k); } catch { /* ignore */ } };

const SEEN_KEY = 'poltok.quorum.seen.v1';
/** Turn of the last election night the player watched to the end (so Continue can replay an unseen one). */
export const loadSeenElection = (): number => { const v = read<number>(SEEN_KEY); return typeof v === 'number' ? v : -1; };
export const writeSeenElection = (turn: number) => write(SEEN_KEY, turn);
