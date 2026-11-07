/**
 * Unified people-photo index. Every portrait comes from a legitimately reusable source with a credit line:
 *  - US members of Congress: unitedstates/images (official congressional portraits, public domain), keyed by bioguide.
 *  - US 2026 candidates: AP headshots delivered in the NYT results feed (credit "AP via NYT"; already licensed for display).
 *  - AU people: Wikimedia Commons free licences (scripts/gen-au-photos.mts → ../au-photos.ts).
 *  - NZ 2026 candidates, 2028 contenders, world leaders: Wikimedia Commons free / open-government licences
 *    (scripts/gen-photos.mts → ./generated.ts), strict identity matching.
 * Unknown people get no photo — the UI renders an initials avatar, never a generated face.
 */
import { AU_PHOTOS } from '../au-photos';
import { PHOTOS, PHOTO_STATS } from './generated';
import { personKey } from './key';
export { personKey, PHOTO_STATS };

export interface PersonPhoto { url: string; credit: string; licence: string; licenceUrl?: string; source: string }
export type PhotoScope = 'au' | 'nz' | 'us' | 'world';

const commons = (r: { f: string; a: string; l: string; u: string } | undefined): PersonPhoto | undefined => {
  if (!r) return undefined;
  const f = encodeURIComponent(r.f.replace(/ /g, '_'));
  return {
    url: `https://commons.wikimedia.org/wiki/Special:FilePath/${f}?width=256`,
    credit: `Photo: ${r.a}, ${r.l} via Wikimedia Commons`, licence: r.l, licenceUrl: r.u || undefined,
    source: `https://commons.wikimedia.org/wiki/File:${f}`,
  };
};

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

/** Look up a portrait by stable id: `qid:Q…`, `bioguide:X000000`, or scope + name. */
export function personPhoto(q: { name?: string | null; scope?: PhotoScope; qid?: string; bioguide?: string; src?: string }): PersonPhoto | undefined {
  if (q.bioguide) return bioguidePhoto(q.bioguide);
  if (q.qid && PHOTOS[`qid:${q.qid}`]) return commons(PHOTOS[`qid:${q.qid}`]);
  if (q.src) return photoFromUrl(q.src);
  if (!q.name) return undefined;
  const k = personKey(q.name);
  if (q.scope === 'au') return commons(AU_PHOTOS[k]);
  if (q.scope === 'nz') return commons(PHOTOS[`nz:${k}`]);
  if (q.scope === 'us') return commons(PHOTOS[`us:${k}`]);
  return undefined;
}
