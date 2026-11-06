import { AU_PHOTOS } from './au-photos';
import { auPhotoKey, toAuPhoto, type AuPhoto } from './au-photo-key';
export type { AuPhoto };
/** Free-licensed Wikimedia Commons portrait for an Australian person, or undefined (use initials). */
export const auPhoto = (name: string | undefined | null): AuPhoto | undefined => (name ? toAuPhoto(AU_PHOTOS[auPhotoKey(name)]) : undefined);
