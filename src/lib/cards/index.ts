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
import { FONT_LOADS, KIND_LABEL, loadImage, RT, rr } from './kit';
import { type CardStyle, colorMapper, mappedCtx, coverImage, drawOverlays, ensureFont, hasStyle } from './style';
import { DESIGNS_D } from './designs-d';
import { DESIGNS_A } from './designs-a';
import { DESIGNS_B } from './designs-b';
import { DESIGNS_C } from './designs-c';
import type { Design } from './common';
import { cardDataFor as buildData, SITE, US_ATTR } from './data';
import { fmtDay, fmtTime, tzAbbr } from '../../components/time';
import type { useLive } from '../live';

export type { CardData, CardDesign, CardKind, CardSeries } from './types';
export type { CardStyle, CardPalette, Sticker, StickerPreset, Texture } from './style';
export { SIZE_PRESETS, TEXTURES, FONT_CHOICES, STICKER_PRESETS, ensureFont, toneOf } from './style';

const ALL_DESIGNS: Design[] = [...DESIGNS_A, ...DESIGNS_B, ...DESIGNS_C, ...DESIGNS_D];
const byId = new Map(ALL_DESIGNS.map((d) => [d.id, d]));

const sizeLabel = (w: number, h: number) => (w === 1080 && h === 1920 ? 'Story' : w === h ? 'Square' : h > w ? 'Portrait' : 'Post');

export const CARD_DESIGNS: CardDesign[] = ALL_DESIGNS.map(({ id, name, kinds, size, isNew }) => ({ id, name, kinds, size, isNew, preview: `${sizeLabel(size.w, size.h)} · ${size.w}×${size.h}` }));

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

function sizeFor(design: Design, st?: CardStyle) {
  const w = Math.round(st?.size?.w ?? 0), h = Math.round(st?.size?.h ?? 0);
  return w >= 200 && h >= 200 && w <= 4096 && h <= 4096 ? { w, h } : design.size;
}

function drawDesign(design: Design, data: CardData, st: CardStyle | undefined, W: number, H: number, I: { img: HTMLImageElement | null; img2: HTMLImageElement | null; bg: HTMLImageElement | null }, now: number): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const raw = cv.getContext('2d')!;
  const map = colorMapper(design.id, st);
  const ctx = map ? mappedCtx(raw, map) : raw;
  if (I.bg) coverImage(raw, I.bg, W, H);
  const accentIn = st?.palette?.accent ?? data.color;
  const k: K = {
    ctx, W, H, s: Math.min(W, H) / 1080, d: data, img: I.img, img2: I.img2,
    accent: accentIn && /^#[0-9a-f]{6}$/i.test(accentIn) ? accentIn : '#c6ff3d',
    kicker: KIND_LABEL[data.kind] ?? 'PolTok',
    stamp: `${fmtDay(now, 'short')} ${fmtTime(now)} ${tzAbbr(now)}`,
    attr: data.footer ?? US_ATTR,
    url: data.url ?? SITE,
    radius: st?.cornerRadius, map: map ?? undefined,
  };
  RT.display = st?.fontDisplay || undefined;
  RT.body = st?.fontBody || undefined;
  RT.logoOff = !!st?.logo && st.logo !== 'design';
  RT.align = st?.align && st.align !== 'design' ? st.align : undefined;
  raw.save();
  try { design.draw(k); } finally {
    raw.restore();
    RT.display = RT.body = undefined; RT.logoOff = false; RT.align = undefined;
  }
  return cv;
}

/** Renders to a canvas (exported for previews / tests). `style` is optional and fully backward compatible. */
export async function renderCardCanvas(designId: string, data: CardData, style?: CardStyle): Promise<HTMLCanvasElement> {
  const design = byId.get(designId) ?? ALL_DESIGNS[0];
  const st = hasStyle(style) ? style : undefined;
  const target = sizeFor(design, st);
  const [, img, img2, bg] = await Promise.all([
    Promise.all([ensureFonts(), ensureFont(st?.fontDisplay), ensureFont(st?.fontBody)]),
    loadImage(data.photo), loadImage(data.photo2), loadImage(st?.bgImage, 6000),
  ]);
  const d = data;
  const I = { img, img2, bg };
  const now = Date.now();
  const { w: nW, h: nH } = design.size;
  const { w: tW, h: tH } = target;
  const accent = st?.palette?.accent ?? (data.color && /^#[0-9a-f]{6}$/i.test(data.color) ? data.color : '#c6ff3d');
  let out: HTMLCanvasElement;
  if (tW === nW && tH === nH) out = drawDesign(design, d, st, nW, nH, I, now);
  else {
    const ar = (tW / tH) / (nW / nH);
    const mode = st?.fit && st.fit !== 'auto' ? st.fit : design.fluid ? 'reflow' : ar > 1.4 || ar < 1 / 1.4 ? 'letterbox' : 'reflow';
    out = document.createElement('canvas');
    out.width = tW; out.height = tH;
    const o = out.getContext('2d')!;
    if (mode === 'reflow') {
      // lay the design out on a virtual canvas of the target aspect, at least as large as native
      const f = Math.min(tW / nW, tH / nH);
      const vW = Math.round(tW / f), vH = Math.round(tH / f);
      const src = drawDesign(design, d, st, vW, vH, I, now);
      o.drawImage(src, 0, 0, tW, tH);
    } else {
      const src = drawDesign(design, d, st, nW, nH, I, now);
      const cover = Math.max(tW / nW, tH / nH);
      o.save();
      o.filter = `blur(${Math.round(Math.min(tW, tH) / 30)}px) brightness(0.55) saturate(1.2)`;
      o.drawImage(src, (tW - nW * cover * 1.1) / 2, (tH - nH * cover * 1.1) / 2, nW * cover * 1.1, nH * cover * 1.1);
      o.restore();
      const fit = Math.min(tW / nW, tH / nH) * 0.94;
      const w = nW * fit, h = nH * fit;
      o.save();
      o.shadowColor = 'rgba(0,0,0,0.5)'; o.shadowBlur = Math.min(tW, tH) / 25; o.shadowOffsetY = Math.min(tW, tH) / 80;
      const x = (tW - w) / 2, y = (tH - h) / 2, r = Math.min(tW, tH) / 60;
      rr(o, x, y, w, h, r); o.fillStyle = '#000'; o.fill();
      o.shadowColor = 'transparent';
      o.save(); rr(o, x, y, w, h, r); o.clip(); o.drawImage(src, x, y, w, h); o.restore();
      o.restore();
    }
  }
  if (st) {
    const o = out.getContext('2d')!;
    o.save();
    try { drawOverlays(o, out.width, out.height, st, data, accent, { drawsCta: !!design.drawsCta }); } finally { o.restore(); }
  } else if (data.cta?.trim() && !design.drawsCta) {
    const o = out.getContext('2d')!;
    drawOverlays(o, out.width, out.height, {}, data, accent);
  }
  return out;
}

export async function renderCard(designId: string, data: CardData, style?: CardStyle): Promise<Blob> {
  const cv = await renderCardCanvas(designId, data, style);
  return new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/png'));
}

export function cardFileName(designId: string, data: CardData) {
  return `poltok-${data.kind}-${designId}-${data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)}.png`;
}
