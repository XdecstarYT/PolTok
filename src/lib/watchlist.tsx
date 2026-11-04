/**
 * Watchlist: starred US races (race id, e.g. "PA-SEN") and Australian seats ("au:<seat id>").
 * Persisted per browser in localStorage (all access guarded).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

const KEY = 'poltok:watchlist';
const MAX = 40;

export const auWatchId = (seatId: string) => `au:${seatId}`;
export const isAuWatchId = (id: string) => id.startsWith('au:');

function load(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, MAX) : [];
  } catch {
    return [];
  }
}

interface WatchApi {
  ids: string[];
  has: (id: string) => boolean;
  toggle: (id: string) => void;
  add: (ids: string[]) => void;
  remove: (id: string) => void;
  move: (id: string, delta: number) => void;
  setAll: (ids: string[]) => void;
}

const Ctx = createContext<WatchApi>({ ids: [], has: () => false, toggle: () => {}, add: () => {}, remove: () => {}, move: () => {}, setAll: () => {} });

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<string[]>(load);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(ids));
    } catch {
      /* storage unavailable */
    }
  }, [ids]);
  // keep tabs in sync
  useEffect(() => {
    const on = (e: StorageEvent) => e.key === KEY && setIds(load());
    window.addEventListener('storage', on);
    return () => window.removeEventListener('storage', on);
  }, []);
  const has = useCallback((id: string) => ids.includes(id), [ids]);
  const toggle = useCallback((id: string) => setIds((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id].slice(0, MAX))), []);
  const add = useCallback((more: string[]) => setIds((xs) => [...xs, ...more.filter((m) => !xs.includes(m))].slice(0, MAX)), []);
  const remove = useCallback((id: string) => setIds((xs) => xs.filter((x) => x !== id)), []);
  const move = useCallback(
    (id: string, delta: number) =>
      setIds((xs) => {
        const i = xs.indexOf(id);
        const j = i + delta;
        if (i < 0 || j < 0 || j >= xs.length) return xs;
        const next = [...xs];
        [next[i], next[j]] = [next[j], next[i]];
        return next;
      }),
    [],
  );
  const setAll = useCallback((next: string[]) => setIds([...new Set(next)].slice(0, MAX)), []);
  const api = useMemo(() => ({ ids, has, toggle, add, remove, move, setAll }), [ids, has, toggle, add, remove, move, setAll]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export const useWatchlist = () => useContext(Ctx);
