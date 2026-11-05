import type { CardStyle } from '../../../lib/cards';

export interface Preset { name: string; designId?: string; style: CardStyle; savedAt: number }
const KEY = 'poltok.cardStudio.presets.v1';

/** Strips the background image (data URLs are big and personal) before persisting. */
const clean = (st: CardStyle): CardStyle => { const { bgImage, ...rest } = st; void bgImage; return rest; };

export function loadPresets(): Preset[] {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v.filter((p) => p && typeof p.name === 'string' && p.style && typeof p.style === 'object') : [];
  } catch { return []; }
}
export function savePresets(list: Preset[]): boolean {
  try { localStorage.setItem(KEY, JSON.stringify(list.map((p) => ({ ...p, style: clean(p.style) })))); return true; } catch { return false; }
}
export function upsertPreset(list: Preset[], p: Preset): Preset[] {
  const next = [...list.filter((x) => x.name !== p.name), { ...p, style: clean(p.style) }].sort((a, b) => a.name.localeCompare(b.name));
  savePresets(next);
  return next;
}
export function exportPreset(p: Preset): Blob {
  return new Blob([JSON.stringify({ poltokCardPreset: 1, ...p, style: clean(p.style) }, null, 2)], { type: 'application/json' });
}
export function parsePreset(text: string): Preset | null {
  try {
    const o = JSON.parse(text);
    if (!o || typeof o !== 'object' || typeof o.style !== 'object') return null;
    return { name: String(o.name || 'Imported preset').slice(0, 60), designId: typeof o.designId === 'string' ? o.designId : undefined, style: clean(o.style as CardStyle), savedAt: Date.now() };
  } catch { return null; }
}
