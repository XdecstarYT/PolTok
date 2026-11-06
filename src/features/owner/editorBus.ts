// Hand-off from the AI tools to the Card Studio editor ("Open in editor").
import type { CardData, CardStyle } from '../../lib/cards';

export interface EditorPayload { designId: string; data: CardData; style: CardStyle; subject?: { kind: string; id: string } }
let pending: EditorPayload | null = null;
export const OPEN_EDITOR = 'poltok:open-editor';

export function openInEditor(p: EditorPayload) {
  pending = JSON.parse(JSON.stringify(p));
  window.dispatchEvent(new CustomEvent(OPEN_EDITOR));
}
export function takePending(): EditorPayload | null {
  const p = pending;
  pending = null;
  return p;
}

/** Applies validated AI text slots on top of base (live) card data. */
export function applyTexts(base: CardData, t: { title?: string; subtitle?: string; footer?: string; cta?: string; quoteBy?: string; stats?: { label: string; value: string }[]; options?: string[]; quoted?: { text: string; label?: string } }): CardData {
  const d: CardData = { ...base };
  for (const k of ['title', 'subtitle', 'footer', 'cta', 'quoteBy'] as const) if (t[k]) d[k] = t[k];
  if (t.stats?.length) {
    const prev = base.stats ?? [];
    d.stats = t.stats.map((s, i) => ({ ...s, color: prev.find((p) => p.label === s.label)?.color ?? prev[i]?.color }));
  }
  if (t.options?.length) d.options = t.options;
  if (t.quoted?.text) d.quoted = t.quoted;
  return d;
}
