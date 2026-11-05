/**
 * Adapter over the shared card system at src/lib/cards (CARD_DESIGNS, renderCard, cardDataFor).
 * Loaded via import.meta.glob so the panel still builds if that module is absent; in that case
 * it falls back to the classic share cards in src/lib/share.ts (2 designs).
 */
import type { LiveState } from '../../lib/live';

export type Subject = { kind: 'race' | 'balance' | 'au-seat' | 'promo' | 'flip'; id: string };
export interface Design { id: string; name: string; w?: number; h?: number; tags?: string[] }
type LiveLike = Pick<LiveState, 'results' | 'balance' | 'lastUpdate'> & Partial<LiveState>;

interface CardsMod {
  CARD_DESIGNS: unknown;
  renderCard: (designId: string, data: unknown) => Promise<Blob>;
  cardDataFor: (kind: string, id: string, live: unknown) => unknown;
}
const mods = import.meta.glob('../../lib/cards/index.{ts,tsx}');
let modP: Promise<CardsMod | null> | null = null;
export function loadCards(): Promise<CardsMod | null> {
  const loader = Object.values(mods)[0];
  modP ??= loader ? (loader() as Promise<CardsMod>).catch(() => null) : Promise.resolve(null);
  return modP;
}

const FALLBACK: Design[] = [
  { id: 'share:landscape', name: 'Classic · 1200×630', w: 1200, h: 630 },
  { id: 'share:story', name: 'Classic story · 1080×1920', w: 1080, h: 1920 },
];

function normDesigns(raw: unknown): Design[] {
  const arr = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? Object.entries(raw as Record<string, unknown>).map(([id, v]) => ({ id, ...(v as object) })) : [];
  return arr
    .map((d) => {
      const o = d as Record<string, unknown>;
      const size = o.size as { w?: number; h?: number } | undefined;
      return {
        id: String(o.id ?? ''),
        name: String(o.name ?? o.label ?? o.title ?? o.id ?? ''),
        w: Number(o.w ?? o.width ?? size?.w) || undefined,
        h: Number(o.h ?? o.height ?? size?.h) || undefined,
        tags: [o.kind, o.category, o.format, ...(Array.isArray(o.tags) ? o.tags : []), ...(Array.isArray(o.kinds) ? o.kinds : [])].filter(Boolean).map(String),
      };
    })
    .filter((d) => d.id);
}

export async function listDesigns(): Promise<{ designs: Design[]; shared: boolean }> {
  const m = await loadCards();
  const d = m ? normDesigns(m.CARD_DESIGNS) : [];
  return d.length ? { designs: d, shared: true } : { designs: FALLBACK, shared: false };
}

/** Pick a design whose name/tags match any hint word; else a stable index pick. */
export function pickDesign(designs: Design[], hints: string[], salt = 0, kind?: string): Design {
  const byKind = kind ? designs.filter((d) => d.tags?.includes(kind)) : [];
  if (byKind.length) designs = byKind;
  const hit = designs.filter((d) => hints.some((h) => `${d.id} ${d.name} ${(d.tags || []).join(' ')}`.toLowerCase().includes(h)));
  const pool = hit.length ? hit : designs;
  return pool[salt % pool.length];
}

export async function render(designId: string, subj: Subject, live: LiveLike): Promise<Blob | null> {
  if (designId.startsWith('share:')) {
    if (subj.kind === 'promo') return null;
    const { renderShareCard } = await import('../../lib/share');
    return renderShareCard(subj.kind === 'flip' ? 'race' : subj.kind, subj.id, designId === 'share:story' ? 'story' : 'landscape', live);
  }
  const m = await loadCards();
  if (!m) return null;
  const AU_PROMOS = ['vic-countdown', 'swingometer', 'au-senate', 'nsw', 'au'];
  const id = subj.kind === 'promo' && AU_PROMOS.includes(subj.id) ? 'au' : subj.id;
  const data = m.cardDataFor(subj.kind, id, live);
  if (!data) return null;
  return m.renderCard(designId, data);
}

/* ---- blob actions ---- */
export function download(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
export async function copyImage(blob: Blob): Promise<boolean> {
  try {
    await navigator.clipboard.write([new ClipboardItem({ [blob.type || 'image/png']: blob })]);
    return true;
  } catch {
    return false;
  }
}
export async function shareImage(blob: Blob, name: string, text?: string): Promise<'ok' | 'unsupported' | 'cancel'> {
  const file = new File([blob], name, { type: blob.type || 'image/png' });
  if (typeof navigator.share !== 'function' || (navigator.canShare && !navigator.canShare({ files: [file] }))) return 'unsupported';
  try {
    await navigator.share({ files: [file], text });
    return 'ok';
  } catch {
    return 'cancel';
  }
}
