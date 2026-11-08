/** Normalised lookup key for an AU person's name: lowercase first + last token, no diacritics/punctuation. */
export function auPhotoKey(name: string): string {
  const t = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\([^)]*\)/g, '').replace(/[^a-z\s-]/g, '').split(/\s+/).filter(Boolean);
  return t.length > 1 ? `${t[0]} ${t[t.length - 1]}` : t.join('');
}

export interface AuPhoto { file: string; thumbUrl: string; author: string; licence: string; licenceUrl: string; sourcePage: string; credit: string; official?: boolean }

const fileUrl = (f: string) => encodeURIComponent(f.replace(/ /g, '_'));

/** Resolve a free-licensed portrait record (from au-photos.ts) into URLs + a credit line. */
export function toAuPhoto(r: { f: string; a: string; l: string; u: string } | undefined): AuPhoto | undefined {
  if (!r) return undefined;
  return {
    file: r.f,
    thumbUrl: `https://commons.wikimedia.org/wiki/Special:FilePath/${fileUrl(r.f)}?width=256`,
    author: r.a, licence: r.l, licenceUrl: r.u,
    sourcePage: `https://commons.wikimedia.org/wiki/File:${fileUrl(r.f)}`,
    credit: `Photo: ${r.a}, ${r.l} via Wikimedia Commons`,
  };
}
