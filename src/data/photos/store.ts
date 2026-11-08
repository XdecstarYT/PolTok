/**
 * Lazy portrait index. The generated maps (./generated.ts, ./generated-us26.ts, ../au-photos.ts — ~250 KB together) are
 * split into their own chunks and fetched on first use of the scope that needs them; until a chunk arrives its lookups
 * return undefined and avatars show initials. Components that resolve photos call usePhotoIndex() so they re-render
 * once the maps land.
 */
import { useEffect, useSyncExternalStore } from 'react';
import type { OfficialRec } from './official';

export type CommonsRec = { f: string; a: string; l: string; u: string; q?: string };
export type GenRec = CommonsRec | { b: string; q: string };
/** Which chunk a lookup needs: AU people, 2026 US candidates, or everything else (NZ, 2028, world leaders); 'off' = official headshots (gap filler, always loaded alongside). */
export type PhotoChunk = 'au' | 'us26' | 'gen' | 'off';

const LOADERS: Record<PhotoChunk, () => Promise<Record<string, GenRec>>> = {
  au: () => import('../au-photos').then((m) => m.AU_PHOTOS),
  us26: () => import('./generated-us26').then((m) => m.PHOTOS),
  gen: () => import('./generated').then((m) => m.PHOTOS),
  off: () => import('./official').then((m) => m.OFFICIAL as unknown as Record<string, GenRec>),
};
const maps: Partial<Record<PhotoChunk, Record<string, GenRec>>> = {};
const pending: Partial<Record<PhotoChunk, Promise<void>>> = {};
let version = 0;
const subs = new Set<() => void>();

export function loadPhotoIndex(chunk: PhotoChunk = 'gen'): Promise<void> {
  if (chunk !== 'off') void loadPhotoIndex('off'); // official headshots fill gaps in every scope
  pending[chunk] ??= LOADERS[chunk]()
    .then((m) => {
      maps[chunk] = m;
      version++;
      subs.forEach((f) => f());
    })
    .catch(() => {
      delete pending[chunk]; // offline / chunk failed: stay on initials, retry on next mount
    });
  return pending[chunk]!;
}

export const chunkOf = (key: string): PhotoChunk => (key.startsWith('us26:') ? 'us26' : 'gen');
export const genRec = (k: string): GenRec | undefined => maps[chunkOf(k)]?.[k];
export const auRec = (k: string): CommonsRec | undefined => maps.au?.[k] as CommonsRec | undefined;
export const offRec = (k: string): OfficialRec | undefined => maps.off?.[k] as unknown as OfficialRec | undefined;
export const photoIndexReady = (chunk: PhotoChunk = 'gen') => !!maps[chunk];

const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
const snap = () => version;

/**
 * Subscribe to the lazy photo index and start loading `chunk` (pass null to subscribe without loading).
 * Returns a version number that bumps whenever a chunk lands.
 */
export function usePhotoIndex(chunk: PhotoChunk | null = 'au'): number {
  const v = useSyncExternalStore(subscribe, snap, snap);
  useEffect(() => { if (chunk && (!maps[chunk] || !maps.off)) void loadPhotoIndex(chunk); }, [chunk]);
  return v;
}
