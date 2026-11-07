/** Stable person key from a name: lowercase first + last token, no diacritics/punctuation (same rule as auPhotoKey). */
export function personKey(name: string): string {
  const t = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\([^)]*\)/g, '').replace(/[^a-z\s-]/g, '').split(/\s+/).filter(Boolean);
  return t.length > 1 ? `${t[0]} ${t[t.length - 1]}` : t.join('');
}
