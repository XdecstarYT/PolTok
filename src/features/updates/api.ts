/** "What's new" posts: fetch (/api/updates) with the bundled seed as offline fallback, plus read-state. */
import { useEffect, useState } from 'react';
import { displayTZ, tzAbbr } from '../../components/time';
import SEED from './seed.json';

export type UpdateCategory = 'New' | 'Improved' | 'Fixed' | 'Data';
export const CATEGORIES: UpdateCategory[] = ['New', 'Improved', 'Fixed', 'Data'];
export interface UpdatePost {
  id: string;
  title: string;
  date: string;
  version?: string;
  categories: UpdateCategory[];
  body: string;
  links?: { label: string; to: string }[];
  image?: string;
  imageAlt?: string;
  major?: boolean;
  draft?: boolean;
  source?: 'seed' | 'owner' | 'edited';
}

export const SEED_POSTS: UpdatePost[] = (SEED as UpdatePost[])
  .map((p) => ({ ...p, source: 'seed' as const }))
  .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));

let cache: UpdatePost[] | null = null;
let inflight: Promise<UpdatePost[]> | null = null;
const subs = new Set<(p: UpdatePost[]) => void>();

export function loadUpdates(force = false, token?: string | null): Promise<UpdatePost[]> {
  if (cache && !force) return Promise.resolve(cache);
  if (inflight && !force) return inflight;
  inflight = fetch('/api/updates', { cache: 'no-store', headers: token ? { authorization: `Bearer ${token}` } : {} })
    .then(async (r) => {
      const d = (await r.json()) as { posts?: UpdatePost[] };
      if (!r.ok || !Array.isArray(d.posts)) throw new Error('bad');
      return d.posts;
    })
    .catch(() => cache ?? SEED_POSTS)
    .then((posts) => {
      cache = posts;
      inflight = null;
      subs.forEach((f) => f(posts));
      return posts;
    });
  return inflight;
}

/** Posts (seed immediately, then server list). */
export function useUpdates(): UpdatePost[] {
  const [posts, setPosts] = useState<UpdatePost[]>(cache ?? SEED_POSTS);
  useEffect(() => {
    subs.add(setPosts);
    loadUpdates().then(setPosts);
    return () => void subs.delete(setPosts);
  }, []);
  return posts;
}

/* ── read state (per browser) ── */
const SEEN = 'poltok.updates.seen';
const TOASTED = 'poltok.updates.toasted';
const get = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const set = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* private mode */
  }
};
export const SEEN_EVENT = 'poltok:updates-seen';
/** epoch ms of the last visit to the updates, or null for a first-time visitor. */
export const lastSeen = (): number | null => {
  const v = Number(get(SEEN));
  return Number.isFinite(v) && v > 0 ? v : null;
};
export function markSeen(posts: UpdatePost[]) {
  const newest = Math.max(Date.now(), ...posts.map((p) => Date.parse(p.date)));
  set(SEEN, String(newest));
  window.dispatchEvent(new Event(SEEN_EVENT));
}
export const unread = (posts: UpdatePost[], seen = lastSeen()) => posts.filter((p) => !p.draft && Date.parse(p.date) > (seen ?? 0));
export const wasToasted = (id: string) => get(TOASTED) === id;
export const setToasted = (id: string) => set(TOASTED, id);

/* ── formatting (Settings time zone) ── */
export function fmtPostDate(iso: string, withTime = false): string {
  const ts = Date.parse(iso);
  try {
    const s = new Intl.DateTimeFormat('en-US', { timeZone: displayTZ(), month: 'short', day: 'numeric', year: 'numeric', ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}) }).format(ts);
    return withTime ? `${s} ${tzAbbr(ts)}` : s;
  } catch {
    return new Date(ts).toDateString();
  }
}
export const dayKey = (iso: string) => {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: displayTZ(), year: 'numeric', month: '2-digit', day: '2-digit' }).format(Date.parse(iso));
  } catch {
    return iso.slice(0, 10);
  }
};
export const CAT_TONE: Record<UpdateCategory, string> = { New: 'var(--accent)', Improved: 'var(--signal)', Fixed: 'var(--terminal)', Data: 'var(--ind)' };
