/** Followed Victorian seats (per browser, localStorage) + optional browser notifications for changes. */
import { useSyncExternalStore } from 'react';

const KEY = 'poltok.vic.follow';
let cache: string[] | null = null;
const subs = new Set<() => void>();
const read = (): string[] => {
  if (cache) return cache;
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? '[]'); cache = Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 30) : []; } catch { cache = []; }
  return cache;
};
const write = (v: string[]) => { cache = v; try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private mode: keep in memory */ } subs.forEach((f) => f()); };
if (typeof window !== 'undefined') window.addEventListener('storage', (e) => { if (e.key === KEY) { cache = null; subs.forEach((f) => f()); } });

export function useFollowed(): [string[], (id: string) => void] {
  const list = useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, read, () => []);
  return [list, (id) => write(list.includes(id) ? list.filter((x) => x !== id) : [...list, id])];
}

export const notifySupported = () => typeof window !== 'undefined' && 'Notification' in window;
export const notifyAllowed = () => notifySupported() && Notification.permission === 'granted';
export async function askNotify(): Promise<boolean> {
  if (!notifySupported()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  return (await Notification.requestPermission()) === 'granted';
}
export function notify(title: string, body: string, tag: string) {
  if (!notifyAllowed()) return;
  try { new Notification(title, { body, tag, icon: '/favicon.svg' }); } catch { /* some mobile browsers only allow SW notifications */ }
}
