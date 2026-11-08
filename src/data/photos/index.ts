/**
 * Unified people-photo index. Every portrait comes from a legitimately reusable source with a credit line:
 *  - US members of Congress: unitedstates/images (official congressional portraits, public domain), keyed by bioguide.
 *  - US 2026 candidates: AP headshots delivered in the NYT results feed (credit "AP via NYT"; already licensed for display).
 *  - AU people: Wikimedia Commons free licences (scripts/gen-au-photos.mts → ../au-photos.ts).
 *  - NZ 2026 candidates, 2028 contenders, world leaders: Wikimedia Commons free / open-government licences
 *    (scripts/gen-photos.mts → ./generated.ts), strict identity matching.
 *  - Gaps only: official headshots from the person's own party / parliament / government / campaign page, stored locally
 *    under public/portraits/ with source page and credit (scripts/gen-official-photos.mts → ./official.ts). Free photos
 *    always win; slugs in ./blocklist.ts are never shown (takedown requests).
 * Unknown people get no photo — the UI renders an initials avatar, never a generated face.
 */
import { personKey } from './key';
import { auRec, genRec, offRec, type GenRec, type PhotoChunk } from './store';
import { isPhotoBlocked } from './blocklist';
export { PHOTO_BLOCKLIST, isPhotoBlocked, photoSlug } from './blocklist';
export { personKey };
export { usePhotoIndex, loadPhotoIndex, photoIndexReady } from './store';

export interface PersonPhoto { url: string; credit: string; licence: string; licenceUrl?: string; source: string; official?: boolean }
export type PhotoScope = 'au' | 'nz' | 'us' | 'us26' | 'world';
export type PhotoQuery = { name?: string | null; scope?: PhotoScope; qid?: string; bioguide?: string; src?: string };
/** The lazy chunk a query needs (null when it resolves without one). */
export const chunkFor = (q: PhotoQuery): PhotoChunk | null =>
  q.bioguide || q.src ? null : q.qid ? 'gen' : !q.name ? null : q.scope === 'au' ? 'au' : q.scope === 'us26' ? 'us26' : q.scope ? 'gen' : null;

const commons = (r: GenRec | undefined): PersonPhoto | undefined => {
  if (!r) return undefined;
  if ('b' in r) return bioguidePhoto(r.b);
  const f = encodeURIComponent(r.f.replace(/ /g, '_'));
  return {
    url: `https://commons.wikimedia.org/wiki/Special:FilePath/${f}?width=256`,
    credit: `Photo: ${r.a}, ${r.l} via Wikimedia Commons`, licence: r.l, licenceUrl: r.u || undefined,
    source: `https://commons.wikimedia.org/wiki/File:${f}`,
  };
};

/** Official headshot (gap filler) for a key in ./official.ts, unless its slug is on the takedown blocklist. */
export function officialPhoto(key: string): PersonPhoto | undefined {
  const r = offRec(key);
  if (!r || isPhotoBlocked(r.p.replace(/^\/portraits\//, '').replace(/\.webp$/, ''))) return undefined;
  return { url: r.p, credit: r.c, licence: 'Official photo, used with credit', source: r.s, official: true };
}

/** Official congressional portrait (public domain) for a sitting/former member by bioguide id. */
export const bioguidePhoto = (bioguide: string, size: '225x275' | '450x550' = '225x275'): PersonPhoto => ({
  url: `https://unitedstates.github.io/images/congress/${size}/${bioguide}.jpg`,
  credit: 'Official congressional portrait via unitedstates/images (public domain)', licence: 'Public domain',
  source: `https://bioguide.congress.gov/search/bio/${bioguide}`,
});

/** AP headshot delivered in the NYT results feed. */
export const apPhoto = (url: string): PersonPhoto => ({ url, credit: 'Photo: AP via NYT', licence: 'AP (via NYT results feed)', source: url });

/** Wrap a raw URL from a known feed into a PersonPhoto with the right credit. */
export function photoFromUrl(url: string | undefined): PersonPhoto | undefined {
  if (!url) return undefined;
  const bg = url.match(/unitedstates\.github\.io\/images\/congress\/[^/]+\/([A-Z]\d{6})/);
  if (bg) return { ...bioguidePhoto(bg[1]), url };
  if (/commons\.wikimedia\.org|upload\.wikimedia\.org/.test(url)) return { url, credit: 'Photo via Wikimedia Commons', licence: 'See source', source: url };
  return apPhoto(url);
}

/**
 * Look up a portrait by stable id: `qid:Q…`, `bioguide:X000000`, or scope + name. The Commons maps load lazily, so this
 * returns undefined until they arrive — components should call usePhotoIndex() (PersonAvatar's `lookup` prop does).
 */
export function personPhoto(q: PhotoQuery): PersonPhoto | undefined {
  if (q.bioguide) return bioguidePhoto(q.bioguide);
  if (q.qid && genRec(`qid:${q.qid}`)) return commons(genRec(`qid:${q.qid}`));
  if (q.src) return photoFromUrl(q.src);
  if (q.qid && offRec(`qid:${q.qid}`)) return officialPhoto(`qid:${q.qid}`);
  if (!q.name) return undefined;
  const k = personKey(q.name);
  if (q.scope === 'au') return commons(auRec(k)) ?? officialPhoto(`au:${k}`);
  if (q.scope === 'nz' || q.scope === 'us' || q.scope === 'us26') return commons(genRec(`${q.scope}:${k}`)) ?? officialPhoto(`${q.scope}:${k}`);
  return undefined;
}
