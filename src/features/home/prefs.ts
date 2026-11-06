/**
 * Home-page local preferences: chosen country hero + recently viewed pages.
 * Everything lives in this browser's localStorage; every access is guarded (private mode etc.).
 */
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

export type HomeCountry = 'us' | 'au' | 'nz' | 'world';
const C_KEY = 'poltok:home.country';
const H_KEY = 'poltok:history';
const H_MAX = 12;

const read = <T,>(k: string, d: T): T => {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : d;
  } catch {
    return d;
  }
};
const write = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* storage unavailable */
  }
};
export { read as readLocal };

const COUNTRIES: HomeCountry[] = ['us', 'au', 'nz', 'world'];
export function useHomeCountry(): [HomeCountry, (c: HomeCountry) => void] {
  const [c, setC] = useState<HomeCountry>(() => {
    const v = read<string>(C_KEY, 'us');
    return (COUNTRIES as string[]).includes(v) ? (v as HomeCountry) : 'us';
  });
  return [c, (n) => { setC(n); write(C_KEY, n); }];
}

export interface Visit { path: string; title: string; at: number }

export function readHistory(): Visit[] {
  const v = read<unknown>(H_KEY, []);
  return Array.isArray(v) ? (v as Visit[]).filter((x) => x && typeof x.path === 'string' && typeof x.title === 'string').slice(0, H_MAX) : [];
}

const SKIP = /^\/(owner|embed)?$/;

/** Mounted once in the shell: records each route the user visits (after the page sets its title). */
export function HistoryRecorder() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    if (SKIP.test(pathname)) return;
    const t = window.setTimeout(() => {
      const raw = (document.title || '').split(/\s[|·–—-]\s/)[0].trim();
      const title = raw && !/^PolTok$/i.test(raw) ? raw : pathname.replace(/^\//, '').replace(/[/-]/g, ' ');
      const path = pathname + search;
      const next = [{ path, title: title.slice(0, 70), at: Date.now() }, ...readHistory().filter((v) => v.path !== path)].slice(0, H_MAX);
      write(H_KEY, next);
    }, 900);
    return () => window.clearTimeout(t);
  }, [pathname, search]);
  return null;
}
