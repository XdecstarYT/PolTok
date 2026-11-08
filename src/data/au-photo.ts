import { auRec } from './photos/store';
import { auPhotoKey, toAuPhoto, type AuPhoto } from './au-photo-key';
export type { AuPhoto };
export { usePhotoIndex } from './photos/store';
/**
 * Free-licensed Wikimedia Commons portrait for an Australian person, or undefined (use initials).
 * The map loads lazily: call usePhotoIndex() in the component so it re-renders when it arrives.
 */
export const auPhoto = (name: string | undefined | null): AuPhoto | undefined => (name ? toAuPhoto(auRec(auPhotoKey(name))) : undefined);
