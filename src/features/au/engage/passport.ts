/** Vic Passport: which Victorian election features this browser has explored (localStorage only, never sent anywhere). */
import { useSyncExternalStore } from 'react';

export const STAMPS = [
  { to: '/au/victoria', emoji: '🗳️', title: 'Victoria 2026 hub', sub: 'Where it all starts' },
  { to: '/au/victoria/live', emoji: '🔴', title: 'Live Desk', sub: 'The needle and every call' },
  { to: '/au/victoria/watch', emoji: '📺', title: 'PolTok WATCH', sub: 'Full-screen election broadcast' },
  { to: '/au/victoria/parliament', emoji: '🏛️', title: 'Projection', sub: 'The seat model, live' },
  { to: '/au/victoria/premier', emoji: '👑', title: 'Battle for Premier', sub: 'Carroll v Wilson v Pickering' },
  { to: '/au/victoria/match', emoji: '💘', title: 'Who matches you?', sub: 'Swipe 14 issues, find your party' },
  { to: '/au/victoria/predict', emoji: '🎯', title: 'Make your calls', sub: 'Pick the close seats, get scored' },
  { to: '/au/victoria/voters', emoji: '🧭', title: 'Voter explorer', sub: 'By region, age, gender' },
  { to: '/au/victoria/candidates', emoji: '👥', title: 'Every candidate', sub: '734 profiles' },
  { to: '/au/victoria/policies', emoji: '⚖️', title: 'Compare the promises', sub: 'Party v party by topic' },
  { to: '/au/victoria/build', emoji: '🎛️', title: 'Build your own', sub: 'Drag the vote, share it' },
  { to: '/au/victoria/immersive', emoji: '🌏', title: 'Immersive Mode', sub: 'Fly through 3D Victoria' },
] as const;

const KEY = 'poltok.vic.passport';
let cache: string[] | null = null;
const subs = new Set<() => void>();
const read = () => {
  if (cache) return cache;
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? '[]'); cache = Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []; } catch { cache = []; }
  return cache;
};
/** the stamp a path earns (a candidate page counts as the candidates stamp) */
export const stampFor = (path: string) => {
  const p = path.replace(/\/+$/, '') || '/';
  if (p.startsWith('/au/victoria/candidate/')) return '/au/victoria/candidates';
  return STAMPS.find((s) => s.to === p)?.to ?? null;
};
/** record a visit; returns true when it is a new stamp */
export function stamp(path: string): boolean {
  const s = stampFor(path);
  const cur = read();
  if (!s || cur.includes(s)) return false;
  cache = [...cur, s];
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* private mode: memory only */ }
  subs.forEach((f) => f());
  return true;
}
export const usePassport = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, read, () => [] as string[]);

/** small shared localStorage JSON helper for the engagement features */
export function loadJson<T>(key: string, fallback: T): T { try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; } }
export function saveJson(key: string, v: unknown) { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ } }
