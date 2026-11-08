import { auRec } from './photos/store';
import { officialPhoto } from './photos';
import { auPhotoKey, toAuPhoto, type AuPhoto } from './au-photo-key';
export type { AuPhoto };
export { usePhotoIndex } from './photos/store';
/**
 * Portrait for an Australian person, or undefined (use initials): a free-licensed Wikimedia Commons file first, else an
 * official headshot from the person's own party / parliament page (stored locally, credited, takedown-blocklist aware).
 * The maps load lazily: call usePhotoIndex() in the component so it re-renders when they arrive.
 */
export const auPhoto = (name: string | undefined | null): AuPhoto | undefined => {
  if (!name) return undefined;
  const k = auPhotoKey(name);
  const free = toAuPhoto(auRec(k));
  if (free) return free;
  const o = officialPhoto(`au:${k}`);
  return o ? { file: '', thumbUrl: o.url, author: '', licence: o.licence, licenceUrl: '', sourcePage: o.source, credit: o.credit, official: true } : undefined;
};
