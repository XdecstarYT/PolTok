/**
 * Card system — 30 client-side <canvas> share-card designs rendered to PNG.
 *
 *   const data = cardDataFor('race', 'PA-SEN', live);
 *   const blob = await renderCard('broadcast', data);
 *
 * Designs live in designs-a/b/c.ts (10 each); shared drawing helpers in kit.ts / common.ts.
 */
import type { CardData, CardDesign, CardKind } from './types';
import type { K } from './kit';
import { FONT_LOADS, KIND_LABEL, loadImage } from './kit';
import { DESIGNS_A } from './designs-a';
import { DESIGNS_B } from './designs-b';
import { DESIGNS_C } from './designs-c';
import type { Design } from './common';
import { cardDataFor as buildData, SITE, US_ATTR } from './data';
import { fmtDay, fmtTime, tzAbbr } from '../../components/time';
import type { useLive } from '../live';

export type { CardData, CardDesign, CardKind } from './types';

const ALL_DESIGNS: Design[] = [...DESIGNS_A, ...DESIGNS_B, ...DESIGNS_C];
const byId = new Map(ALL_DESIGNS.map((d) => [d.id, d]));

const sizeLabel = (w: number, h: number) => (w === 1080 && h === 1920 ? 'Story' : w === h ? 'Square' : h > w ? 'Portrait' : 'Post');

export const CARD_DESIGNS: CardDesign[] = ALL_DESIGNS.map(({ id, name, kinds, size }) => ({ id, name, kinds, size, preview: `${sizeLabel(size.w, size.h)} · ${size.w}×${size.h}` }));

export const designsFor = (kind: CardKind) => CARD_DESIGNS.filter((d) => d.kinds.includes(kind));

export function cardDataFor(kind: CardKind, id: string, live: ReturnType<typeof useLive>): CardData {
  return buildData(kind, id, live);
}

let fontsReady: Promise<void> | null = null;
function ensureFonts(): Promise<void> {
  if (!fontsReady) {
    const fs = (document as Document & { fonts?: FontFaceSet }).fonts;
    fontsReady = fs
      ? Promise.race([
          Promise.all(FONT_LOADS.map((f) => fs.load(f).catch(() => []))).then(() => fs.ready).then(() => undefined),
          new Promise<void>((r) => setTimeout(r, 3000)),
        ])
      : Promise.resolve();
  }
  return fontsReady;
}

/** Renders to a canvas (exported for previews / tests). */
export async function renderCardCanvas(designId: string, data: CardData): Promise<HTMLCanvasElement> {
  const design = byId.get(designId) ?? ALL_DESIGNS[0];
  const { w: W, h: H } = design.size;
  const [, img] = await Promise.all([ensureFonts(), loadImage(data.photo)]);
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d')!;
  const now = Date.now();
  const k: K = {
    ctx, W, H, s: Math.min(W, H) / 1080, d: data, img,
    accent: data.color && /^#[0-9a-f]{6}$/i.test(data.color) ? data.color : '#c6ff3d',
    kicker: KIND_LABEL[data.kind],
    stamp: `${fmtDay(now, 'short')} ${fmtTime(now)} ${tzAbbr(now)}`,
    attr: data.footer ?? US_ATTR,
    url: data.url ?? SITE,
  };
  ctx.save();
  try { design.draw(k); } finally { ctx.restore(); }
  return cv;
}

export async function renderCard(designId: string, data: CardData): Promise<Blob> {
  const cv = await renderCardCanvas(designId, data);
  return new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/png'));
}

export function cardFileName(designId: string, data: CardData) {
  return `poltok-${data.kind}-${designId}-${data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)}.png`;
}
