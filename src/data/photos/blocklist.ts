/**
 * Photo takedown list. Slugs here are never shown by any avatar, whatever the source — add one when a photo removal
 * request arrives (see the "Photo removal requests" line on the menu page) and redeploy.
 * Slug format: "<group>/<slug>", the same path as the file under public/portraits/ without ".webp"
 * (e.g. "au/jane-citizen", "nz/john-smith", "us/jane-doe", "world/john-smith").
 */
export const PHOTO_BLOCKLIST: readonly string[] = [];

const blocked = new Set(PHOTO_BLOCKLIST);
/** Same slug rule as scripts/gen-official-photos.mts. */
export const photoSlug = (group: string, name: string) =>
  `${group}/${name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
export const isPhotoBlocked = (slug: string | undefined) => !!slug && blocked.has(slug);
