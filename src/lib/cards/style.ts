/**
 * Theming layer shared by every card design.
 *
 * Designs keep drawing with their own hard-coded colours; a thin ctx proxy remaps them at
 * draw time: near-background colours → palette.bg, neutral greys/whites/blacks → a bg→fg ramp,
 * the house accent → palette.accent and the D/R party hexes → palette.dem/rep. Fonts are swapped
 * through kit.RT, logo/alignment the same way. Textures, border, watermark, stickers, CTA, logo
 * placement and rounded corners are composited on top. Size presets either reflow the layout
 * (similar aspect) or letterbox the native render over a blurred copy of itself.
 */
import type { CardData } from './types';
import { type Ctx, grain, halftone, font, rr, rgba, wordmark, ellipsize, star, rng } from './kit';
import { PARTY_HEX } from '../format';

export type Texture = 'none' | 'grain' | 'halftone' | 'grid' | 'scanlines' | 'paper';
export type Corner = 'tl' | 'tr' | 'bl' | 'br';
export type StickerPreset = 'live' | 'flip' | 'breaking' | 'called' | 'custom';
export interface Sticker { preset: StickerPreset; text?: string; pos: Corner | 'c'; rotate?: number; scale?: number }

export interface CardPalette { bg?: string; fg?: string; accent?: string; dem?: string; rep?: string }

export interface CardStyle {
  palette?: CardPalette;
  /** font family names (must be loaded on the page or via ensureFont) */
  fontDisplay?: string;
  fontBody?: string;
  /** final-image corner radius in px (transparent corners) */
  cornerRadius?: number;
  texture?: Texture;
  textureOpacity?: number;
  /** 'design' = where the design puts it; 'off'; or a corner */
  logo?: 'design' | 'off' | Corner;
  watermark?: string;
  border?: { width: number; color: string };
  /** data:/blob: URL of a user image (never uploaded) */
  bgImage?: string;
  /** 0..1 how strongly the design background still covers the image */
  bgImageDim?: number;
  stickers?: Sticker[];
  align?: 'design' | 'left' | 'center' | 'right';
  size?: { w: number; h: number };
  fit?: 'auto' | 'reflow' | 'letterbox';
}

export const SIZE_PRESETS: { id: string; label: string; w: number; h: number }[] = [
  { id: 'x', label: 'X / Twitter post', w: 1200, h: 675 },
  { id: 'square', label: 'Square (IG)', w: 1080, h: 1080 },
  { id: 'portrait', label: 'Portrait 4:5', w: 1080, h: 1350 },
  { id: 'story', label: 'Story / Reel 9:16', w: 1080, h: 1920 },
  { id: 'linkedin', label: 'LinkedIn 1.91:1', w: 1200, h: 627 },
  { id: 'x-header', label: 'X header 3:1', w: 1500, h: 500 },
  { id: 'avatar', label: 'Profile picture', w: 400, h: 400 },
];

export const TEXTURES: Texture[] = ['none', 'grain', 'halftone', 'grid', 'scanlines', 'paper'];

/** Fonts the page already loads, plus a few extra Google Fonts injected on demand. */
export const PAGE_FONTS = ['Inter', 'Space Grotesk', 'Oswald', 'Roboto Condensed', 'Playfair Display', 'Source Serif 4', 'JetBrains Mono', 'IBM Plex Mono'];
export const EXTRA_FONTS: Record<string, string> = {
  Anton: 'Anton',
  'Bebas Neue': 'Bebas+Neue',
  'DM Serif Display': 'DM+Serif+Display',
  'Archivo Black': 'Archivo+Black',
  Fraunces: 'Fraunces:wght@400;700;900',
  'Barlow Condensed': 'Barlow+Condensed:wght@500;700;800',
};
export const FONT_CHOICES = [...PAGE_FONTS, ...Object.keys(EXTRA_FONTS)];

const injected = new Set<string>();
/** Loads a font for canvas use; extra fonts get a stylesheet link added on first use. */
export async function ensureFont(name?: string): Promise<void> {
  if (!name || typeof document === 'undefined') return;
  const q = EXTRA_FONTS[name];
  if (q && !injected.has(name)) {
    injected.add(name);
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = `https://fonts.googleapis.com/css2?family=${q}&display=swap`;
    document.head.appendChild(l);
    await new Promise((r) => { l.onload = r; l.onerror = r; setTimeout(r, 2500); });
  }
  const fs = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (!fs) return;
  await Promise.race([
    Promise.all(['400', '700', '900'].map((w) => fs.load(`${w} 40px '${name}'`).catch(() => []))),
    new Promise((r) => setTimeout(r, 2500)),
  ]);
}

/** Native [background, foreground] of each design — the anchors for palette remapping. */
export const TONES: Record<string, [string, string]> = {
  broadcast: ['#071535', '#ffffff'], newspaper: ['#f3ecdc', '#1b1712'], neon: ['#03040a', '#ffffff'], swiss: ['#f4f4f0', '#111111'],
  poster: ['#0b0d14', '#ffffff'], scoreboard: ['#111111', '#ffffff'], 'map-hero': ['#05070d', '#ffffff'], 'big-number': ['#0b0d14', '#ffffff'],
  versus: ['#0b0d14', '#ffffff'], ticker: ['#0d1117', '#ffffff'], crt: ['#020a04', '#ffffff'], cutout: ['#efe6d2', '#23324a'],
  aurora: ['#070512', '#ffffff'], terminal: ['#1e1e2e', '#cdd6f4'], comic: ['#ffffff', '#000000'], quote: ['#faf7f2', '#16181d'],
  'story-results': ['#05070d', '#ffffff'], minimal: ['#fafafa', '#111111'], ballot: ['#fffef9', '#111111'], hemicycle: ['#0c0f1a', '#ffffff'],
  dial: ['#10131c', '#ffffff'], ledger: ['#f7f9f4', '#1b1b1b'], magazine: ['#000000', '#ffffff'], 'trading-card': ['#14121f', '#ffffff'],
  synthwave: ['#12021f', '#ffffff'], blueprint: ['#0d3b78', '#ffffff'], split: ['#f5f3ee', '#14161c'], 'story-poster': ['#0b0d14', '#ffffff'],
  'au-hex': ['#0e1a14', '#ffffff'], breaking: ['#0a0a12', '#ffffff'],
  countdown: ['#0a0c14', '#ffffff'], h2h: ['#0b0d14', '#ffffff'], waterfall: ['#f6f5f1', '#111111'], bill: ['#0f1420', '#ffffff'], trend: ['#0c1018', '#ffffff'],
  'senate-arc': ['#f3f1ec', '#111111'], 'au-swing': ['#0f1a24', '#ffffff'], 'quote-portrait': ['#101218', '#ffffff'], carousel: ['#fbfaf7', '#111111'], table: ['#ffffff', '#0d1321'],
  statement: ['#0b0d14', '#ffffff'], notes: ['#fffdf6', '#1c1a14'], memo: ['#fbf8f1', '#1b1712'], 'gradient-quote': ['#2b1055', '#ffffff'], milestone: ['#0e0b1f', '#ffffff'],
  announce: ['#0d1018', '#ffffff'], ask: ['#f4f1ea', '#14120e'], typographic: ['#fafaf7', '#111111'], 'thread-cover': ['#0b0d14', '#ffffff'], 'thread-slide': ['#11131c', '#ffffff'],
  poll: ['#0f1420', '#ffffff'], 'reply-frame': ['#0b0d14', '#ffffff'], 'breaking-banner': ['#0a0a12', '#ffffff'], 'did-you-know': ['#fff8e7', '#1a1407'],
  'x-header': ['#0b0d14', '#ffffff'], 'x-avatar': ['#0b0d14', '#ffffff'], highlight: ['#0b0d14', '#ffffff'], 'story-message': ['#0b0d14', '#ffffff'],
};
const DEFAULT_TONE: [string, string] = ['#0b0d14', '#ffffff'];
export const toneOf = (id: string) => TONES[id] ?? DEFAULT_TONE;

/* ───────── colour parsing ───────── */

type RGBA = [number, number, number, number];
const parseCache = new Map<string, RGBA | null>();
export function parseColor(c: string): RGBA | null {
  let v = parseCache.get(c);
  if (v !== undefined) return v;
  v = null;
  const s = c.trim().toLowerCase();
  let m: RegExpExecArray | null;
  if ((m = /^#([0-9a-f]{3,8})$/.exec(s))) {
    const h = m[1];
    if (h.length === 3 || h.length === 4) v = [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16), h.length === 4 ? parseInt(h[3] + h[3], 16) / 255 : 1];
    else if (h.length === 6 || h.length === 8) v = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1];
  } else if ((m = /^rgba?\(([^)]+)\)$/.exec(s))) {
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    if (p.length >= 3 && p.slice(0, 3).every(Number.isFinite)) v = [p[0], p[1], p[2], Number.isFinite(p[3]) ? p[3] : 1];
  } else if (s === 'white') v = [255, 255, 255, 1];
  else if (s === 'black') v = [0, 0, 0, 1];
  parseCache.set(c, v);
  return v;
}
const L = (c: RGBA) => (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;
const chroma = (c: RGBA) => (Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2])) / 255;
const dist = (a: RGBA, b: RGBA) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const out = (c: RGBA, a: number) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${+a.toFixed(3)})`;
const lerp = (a: RGBA, b: RGBA, t: number): RGBA => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, 1];

const HOUSE_ACCENT = parseColor('#c6ff3d')!;
const DEM = parseColor(PARTY_HEX.D)!;
const REP = parseColor(PARTY_HEX.R)!;

/** Builds the colour remapper for one render; null when nothing needs remapping. */
export function colorMapper(designId: string, st: CardStyle | undefined): ((c: string) => string) | null {
  if (!st) return null;
  const p = st.palette ?? {};
  const [nb, nf] = toneOf(designId);
  const NB = parseColor(nb)!, NF = parseColor(nf)!;
  const B = p.bg ? parseColor(p.bg) : null, F = p.fg ? parseColor(p.fg) : null;
  const A = p.accent ? parseColor(p.accent) : null, D = p.dem ? parseColor(p.dem) : null, R = p.rep ? parseColor(p.rep) : null;
  const imgDim = st.bgImage ? Math.max(0, Math.min(1, st.bgImageDim ?? 0.55)) : 1;
  const ramp = !!(B || F);
  if (!ramp && !A && !D && !R && imgDim === 1) return null;
  const nb2 = B ?? NB, nf2 = F ?? NF;
  const lb = L(NB), lf = L(NF);
  const cache = new Map<string, string>();
  return (c: string) => {
    let r = cache.get(c);
    if (r !== undefined) return r;
    r = c;
    const v = parseColor(c);
    if (v) {
      if (A && dist(v, HOUSE_ACCENT) < 6) r = out(A, v[3]);
      else if (D && dist(v, DEM) < 6) r = out(D, v[3]);
      else if (R && dist(v, REP) < 6) r = out(R, v[3]);
      else if (dist(v, NB) < 26) r = out(nb2, v[3] * imgDim);
      else if (ramp && chroma(v) < 0.14) {
        const t = Math.abs(lf - lb) < 0.1 ? (L(v) > 0.5 ? 1 : 0) : Math.max(0, Math.min(1, (L(v) - lb) / (lf - lb)));
        r = out(lerp(nb2, nf2, t), v[3]);
      }
    }
    cache.set(c, r);
    return r;
  };
}

/** Wraps a 2D context so every colour assignment (incl. gradient stops) runs through `map`. */
export function mappedCtx(ctx: Ctx, map: (c: string) => string): Ctx {
  const patch = <G extends CanvasGradient>(g: G): G => {
    const add = g.addColorStop.bind(g);
    g.addColorStop = (o: number, c: string) => add(o, c[0] === '!' ? c.slice(1) : map(c));
    return g;
  };
  return new Proxy(ctx, {
    get(t, prop) {
      if (prop === 'createLinearGradient') return (...a: [number, number, number, number]) => patch(t.createLinearGradient(...a));
      if (prop === 'createRadialGradient') return (...a: [number, number, number, number, number, number]) => patch(t.createRadialGradient(...a));
      if (prop === 'createConicGradient') return (...a: [number, number, number]) => patch(t.createConicGradient(...a));
      const v = Reflect.get(t, prop, t);
      return typeof v === 'function' ? v.bind(t) : v;
    },
    set(t, prop, v) {
      if ((prop === 'fillStyle' || prop === 'strokeStyle' || prop === 'shadowColor') && typeof v === 'string') v = v[0] === '!' ? v.slice(1) : map(v);
      return Reflect.set(t, prop, v, t);
    },
  });
}

/* ───────── overlays ───────── */

export function applyTexture(ctx: Ctx, W: number, H: number, tex: Texture | undefined, op = 0.5) {
  if (!tex || tex === 'none') return;
  const o = Math.max(0, Math.min(1, op));
  const u = Math.min(W, H) / 1080;
  ctx.save();
  if (tex === 'grain') grain(ctx, W, H, 0.12 * o, 13);
  else if (tex === 'halftone') { ctx.globalCompositeOperation = 'soft-light'; halftone(ctx, 0, 0, W, H, `rgba(0,0,0,${0.7 * o})`, 14 * u, 4.5 * u, 'radial'); }
  else if (tex === 'grid') {
    ctx.strokeStyle = `rgba(128,128,128,${0.35 * o})`; ctx.lineWidth = Math.max(1, u);
    const step = 40 * u;
    ctx.beginPath();
    for (let x = step; x < W; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let y = step; y < H; y += step) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();
  } else if (tex === 'scanlines') {
    ctx.fillStyle = `rgba(0,0,0,${0.35 * o})`;
    const step = Math.max(3, 4 * u);
    for (let y = 0; y < H; y += step) ctx.fillRect(0, y, W, step / 2);
  } else if (tex === 'paper') {
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = `rgba(236,224,196,${0.45 * o})`; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    const r = rng(29);
    ctx.strokeStyle = `rgba(90,70,40,${0.08 * o})`; ctx.lineWidth = Math.max(1, u);
    for (let i = 0; i < (W * H) / 6000; i++) { const x = r() * W, y = r() * H, a = r() * Math.PI; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 14 * u, y + Math.sin(a) * 14 * u); ctx.stroke(); }
    grain(ctx, W, H, 0.07 * o, 31);
  }
  ctx.restore();
}

const STICKER: Record<StickerPreset, { text: string; bg: string; fg: string }> = {
  live: { text: '● LIVE', bg: '#e8112d', fg: '#ffffff' },
  flip: { text: 'FLIP', bg: '#ff9f1c', fg: '#111111' },
  breaking: { text: 'BREAKING', bg: '#ffffff', fg: '#e8112d' },
  called: { text: '✓ CALLED', bg: '#18b45b', fg: '#ffffff' },
  custom: { text: 'NEW', bg: '#c6ff3d', fg: '#0b0d14' },
};
export const STICKER_PRESETS = Object.keys(STICKER) as StickerPreset[];

function anchor(pos: Corner | 'c', W: number, H: number, w: number, h: number, m: number): [number, number] {
  if (pos === 'c') return [(W - w) / 2, (H - h) / 2];
  return [pos[1] === 'l' ? m : W - w - m, pos[0] === 't' ? m : H - h - m];
}

export function drawSticker(ctx: Ctx, W: number, H: number, s: Sticker, accent: string) {
  const u = Math.min(W, H) / 1080 * (s.scale ?? 1);
  const pre = STICKER[s.preset] ?? STICKER.custom;
  const label = (s.text?.trim() || pre.text).toUpperCase().slice(0, 28);
  const bg = s.preset === 'custom' ? accent : pre.bg;
  const fg = s.preset === 'custom' ? (L(parseColor(accent) ?? [0, 0, 0, 1]) > 0.6 ? '#0b0d14' : '#ffffff') : pre.fg;
  const px = 40 * u;
  ctx.save();
  ctx.font = font('cond', px, 700);
  const c = ctx as Ctx & { letterSpacing?: string };
  if ('letterSpacing' in c) c.letterSpacing = `${(px * 0.08).toFixed(1)}px`;
  const tw = ctx.measureText(label).width;
  const w = tw + px * 1.3, h = px * 1.65;
  const [x, y] = anchor(s.pos, W, H, w, h, 44 * Math.min(W, H) / 1080);
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(((s.rotate ?? -6) * Math.PI) / 180);
  ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 18 * u; ctx.shadowOffsetY = 6 * u;
  if (s.preset === 'breaking' || s.preset === 'flip') {
    star(ctx, 0, 0, 14, Math.max(w, h) * 0.62, Math.max(w, h) * 0.5, 0);
    ctx.fillStyle = bg; ctx.fill();
  } else { rr(ctx, -w / 2, -h / 2, w, h, h * 0.22); ctx.fillStyle = bg; ctx.fill(); }
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 3 * u; ctx.strokeStyle = rgba(fg, 0.9);
  if (s.preset !== 'breaking' && s.preset !== 'flip') { rr(ctx, -w / 2 + 5 * u, -h / 2 + 5 * u, w - 10 * u, h - 10 * u, h * 0.18); ctx.stroke(); }
  ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, px * 0.06);
  ctx.restore();
}

export function drawOverlays(ctx: Ctx, W: number, H: number, st: CardStyle, d: CardData, accent: string, opts: { drawsCta?: boolean } = {}) {
  const u = Math.min(W, H) / 1080;
  applyTexture(ctx, W, H, st.texture, st.textureOpacity ?? 0.5);
  if (st.watermark?.trim()) {
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#000000'; ctx.lineWidth = 2 * u;
    ctx.font = font('display', 64 * u, 700);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.translate(W / 2, H / 2); ctx.rotate(-Math.PI / 7);
    const t = st.watermark.trim().toUpperCase();
    const tw = ctx.measureText(t).width + 120 * u;
    const D = Math.hypot(W, H);
    for (let y = -D / 2, row = 0; y < D / 2; y += 190 * u, row++) for (let x = -D / 2 + (row % 2) * tw / 2; x < D / 2; x += tw) { ctx.strokeText(t, x, y); ctx.fillText(t, x, y); }
    ctx.restore();
  }
  if (d.cta?.trim() && !opts.drawsCta) {
    ctx.save();
    const px = 30 * u;
    ctx.font = font('sans', px, 800);
    const t = ellipsize(ctx, d.cta.trim(), W * 0.8);
    const w = ctx.measureText(t).width + px * 2.2, h = px * 2.1;
    const x = (W - w) / 2, y = H - h - 120 * u;
    ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 20 * u;
    rr(ctx, x, y, w, h, h / 2); ctx.fillStyle = accent; ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = L(parseColor(accent) ?? [0, 0, 0, 1]) > 0.6 ? '#0b0d14' : '#ffffff';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(t, W / 2, y + h / 2 + px * 0.04);
    ctx.restore();
  }
  for (const s of st.stickers ?? []) drawSticker(ctx, W, H, s, accent);
  if (st.logo && st.logo !== 'design' && st.logo !== 'off') {
    const size = 34 * u, m = 36 * u;
    ctx.save();
    ctx.font = font('display', size, 700);
    const w = size * 0.62 + ctx.measureText('PolTok').width + size, h = size * 1.6;
    const [x, y] = anchor(st.logo, W, H, w, h, m);
    rr(ctx, x, y, w, h, h / 2); ctx.fillStyle = 'rgba(8,10,18,0.72)'; ctx.fill();
    wordmark(ctx, x + size * 0.5, y + h * 0.68, size, { accent, force: true });
    ctx.restore();
  }
  if (st.border && st.border.width > 0) {
    const bw = st.border.width * u;
    ctx.save(); ctx.lineWidth = bw; ctx.strokeStyle = st.border.color;
    rr(ctx, bw / 2, bw / 2, W - bw, H - bw, Math.max(0, (st.cornerRadius ?? 0) * u - bw / 2)); ctx.stroke(); ctx.restore();
  }
  if (st.cornerRadius && st.cornerRadius > 0) {
    ctx.save(); ctx.globalCompositeOperation = 'destination-in';
    rr(ctx, 0, 0, W, H, st.cornerRadius * u); ctx.fillStyle = '#000'; ctx.fill(); ctx.restore();
  }
}

/** Draws `img` cover-cropped over the whole canvas. */
export function coverImage(ctx: Ctx, img: CanvasImageSource & { width: number; height: number }, W: number, H: number) {
  const iw = (img as HTMLImageElement).naturalWidth || img.width, ih = (img as HTMLImageElement).naturalHeight || img.height;
  const s = Math.max(W / iw, H / ih);
  ctx.drawImage(img, (W - iw * s) / 2, (H - ih * s) / 2, iw * s, ih * s);
}

/** True when the style changes anything about the render. */
export const hasStyle = (st?: CardStyle) => !!st && Object.values(st).some((v) => v !== undefined && v !== '' && !(Array.isArray(v) && !v.length));
