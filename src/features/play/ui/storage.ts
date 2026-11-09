import type { GameState, AchievementId } from '../engine/types';
import { deserialize } from '../engine';

const SAVE_KEY = 'poltok.quorum.save.v1';
const META_KEY = 'poltok.quorum.meta.v1';
const PREFS_KEY = 'poltok.quorum.prefs.v1';

export interface Meta { bestScore: number; achievements: AchievementId[]; tutorialDone: boolean; games: number }
export interface Prefs { muted: boolean; volume: number; reduceMotion: boolean }

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
export const hasSave = () => { const s = loadSave(); return !!s && s.phase !== 'over'; };
export const writeSave = (s: GameState) => write(SAVE_KEY, s);
export const clearSave = () => { try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } };

export const loadMeta = (): Meta => ({ bestScore: 0, achievements: [], tutorialDone: false, games: 0, ...(read<Partial<Meta>>(META_KEY) ?? {}) });
export const writeMeta = (m: Meta) => write(META_KEY, m);
export const loadPrefs = (): Prefs => ({ muted: false, volume: 0.8, reduceMotion: false, ...(read<Partial<Prefs>>(PREFS_KEY) ?? {}) });
export const writePrefs = (p: Prefs) => write(PREFS_KEY, p);
export const resetAll = () => { for (const k of [SAVE_KEY, META_KEY]) try { localStorage.removeItem(k); } catch { /* ignore */ } };
