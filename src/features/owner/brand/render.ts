/** Renders pack assets from the brand: brand-drawn (logo geometry) or card templates via renderCardCanvas. */
import { renderCardCanvas, type CardData, type CardStyle } from '../../../lib/cards';
import type { PackAsset, Rect } from '../../../../shared/social.js';
import { drawLogo, type Brand } from './logo';
import { drawIcon } from './icons';

export interface Rendered { canvas: HTMLCanvasElement; keys: Rect[] }
export interface Copy { handle?: string; pinned?: string }

export const cardStyleOf = (b: Brand): CardStyle => ({ palette: { bg: b.palette.bg, fg: b.palette.fg, accent: b.palette.dot }, fontDisplay: b.fontDisplay, fontBody: b.fontBody });

const plain = (t: string) => t.replace(/\*/g, '');
const FONT = (b: Brand, w: number, px: number) => `${w} ${Math.round(px)}px '${b.fontDisplay}', 'Space Grotesk', Inter, system-ui, sans-serif`;

function fitText(ctx: CanvasRenderingContext2D, b: Brand, t: string, maxW: number, px: number, w = 700) {
  let s = px;
  ctx.font = FONT(b, w, s);
  while (s > 8 && ctx.measureText(t).width > maxW) { s *= 0.94; ctx.font = FONT(b, w, s); }
  return s;
}

/** Content box: safe area (or inset), pushed clear of covers that sit at the left/right bottom. */
function contentBox(a: PackAsset) {
  const W = a.w, H = a.h;
  const s = a.safe?.[0];
  let x = s ? s.x * W : W * 0.06, y = s ? s.y * H : H * 0.12, w = s ? s.w * W : W * 0.88, h = s ? s.h * H : H * 0.76;
  if (!s && a.type !== 'splash') { const pad = Math.min(W, H) * 0.12; y = pad; h = H - pad * 2; }
  for (const c of a.covers ?? []) {
    const cx = c.x * W, cw = c.w * W;
    if (cx < x + w * 0.5 && cx + cw > x) { const nx = cx + cw + W * 0.03; w -= nx - x; x = nx; }
  }
  return { x, y, w, h };
}

function bgArt(ctx: CanvasRenderingContext2D, b: Brand, W: number, H: number) {
  const p = b.palette;
  ctx.fillStyle = p.bg; ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W * 0.85, H * 0.1, 0, W * 0.85, H * 0.1, Math.max(W, H) * 0.7);
  g.addColorStop(0, p.surface); g.addColorStop(1, p.bg);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // signature: two slanted bars (D-blue / R-red) bleeding off the right edge + faint dot grid
  const u = Math.min(W, H);
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.translate(W, H); ctx.rotate(-0.42);
  ctx.fillStyle = p.dem; ctx.fillRect(-u * 0.9, -u * 0.62, u * 1.4, u * 0.075);
  ctx.fillStyle = p.rep; ctx.fillRect(-u * 0.75, -u * 0.48, u * 1.4, u * 0.075);
  ctx.restore();
  ctx.fillStyle = p.muted; ctx.globalAlpha = 0.09;
  const step = Math.max(14, u / 18);
  for (let y = step / 2; y < H; y += step) for (let x = step / 2; x < W; x += step) { ctx.beginPath(); ctx.arc(x, y, Math.max(1, u / 500), 0, 6.283); ctx.fill(); }
  ctx.globalAlpha = 1;
}

function drawBanner(ctx: CanvasRenderingContext2D, a: PackAsset, b: Brand, copy: Copy): Rect[] {
  const W = a.w, H = a.h;
  bgArt(ctx, b, W, H);
  const box = contentBox(a);
  const keys: Rect[] = [];
  const email = a.type === 'email';
  const splash = a.type === 'splash';
  const wide = box.w / box.h > 3.2;
  if (splash) {
    // logo centered above the dialog cover, tagline below it
    const lh = H * 0.12;
    const r = drawLogo(ctx, b, 'full', 'dark', { x: W * 0.2, y: H * 0.07, w: W * 0.6, h: lh });
    keys.push({ x: r.x / W, y: r.y / H, w: r.w / W, h: r.h / H, label: 'Logo' });
    const t = plain(b.tagline);
    const s = fitText(ctx, b, t, W * 0.7, H * 0.06);
    ctx.fillStyle = b.palette.fg; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(t, W / 2, H * 0.88);
    const tw = ctx.measureText(t).width;
    keys.push({ x: (W - tw) / 2 / W, y: (H * 0.88 - s) / H, w: tw / W, h: s * 1.1 / H, label: 'Tagline' });
    return keys;
  }
  // logo left, tagline + url right (wide), or stacked lines (tall-ish)
  const lh = Math.min(box.h * (wide ? 0.5 : 0.34), box.w * 0.14);
  const r = drawLogo(ctx, b, 'full', 'dark', { x: box.x, y: wide ? box.y + (box.h - lh) / 2 : box.y + box.h * 0.12, w: box.w * (wide ? 0.36 : 0.6), h: lh }, 'left');
  keys.push({ x: r.x / W, y: r.y / H, w: r.w / W, h: r.h / H, label: 'Logo' });
  const t = plain(b.tagline);
  const tx = wide ? r.x + r.w + box.w * 0.05 : box.x;
  const tmax = wide ? box.x + box.w - tx : box.w;
  const s = fitText(ctx, b, t, tmax, lh * (wide ? 0.42 : 0.5));
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = b.palette.fg;
  const ty = wide ? box.y + box.h / 2 + s * 0.1 : r.y + r.h + s * 1.5;
  ctx.fillText(t, tx, ty);
  const tw = ctx.measureText(t).width;
  keys.push({ x: tx / W, y: (ty - s) / H, w: tw / W, h: (s * 1.15) / H, label: 'Tagline' });
  const sub = email ? `${copy.handle ?? '@PolTok'} · poltok.netlify.app` : 'Live results · US + Australia · poltok.netlify.app';
  const s2 = fitText(ctx, b, sub, tmax, s * 0.48, 500);
  ctx.fillStyle = b.palette.muted;
  ctx.fillText(sub, tx, ty + s2 * 1.9);
  // lime underline
  ctx.fillStyle = b.palette.dot; ctx.fillRect(tx, ty + s2 * 2.5, Math.min(tw, s * 3), Math.max(2, s * 0.08));
  return keys;
}

function drawAvatar(ctx: CanvasRenderingContext2D, a: PackAsset, b: Brand) {
  const W = a.w;
  ctx.fillStyle = b.palette.bg; ctx.fillRect(0, 0, W, W);
  // circle-safe: monogram inside the inscribed circle's 60% square
  if (a.brand === 'icon') { drawLogo(ctx, b, 'icon', 'dark', { x: W * 0.08, y: W * 0.08, w: W * 0.84, h: W * 0.84 }); return; }
  ctx.fillStyle = b.palette.surface; ctx.beginPath(); ctx.arc(W / 2, W / 2, W * 0.48, 0, 6.283); ctx.fill();
  drawLogo(ctx, b, 'monogram', 'dark', { x: W * 0.2, y: W * 0.26, w: W * 0.6, h: W * 0.48 });
}

function drawHighlight(ctx: CanvasRenderingContext2D, a: PackAsset, b: Brand) {
  const W = a.w, H = a.h;
  ctx.fillStyle = b.palette.bg; ctx.fillRect(0, 0, W, H);
  const cx = W / 2, cy = H / 2, r = W * 0.3;
  ctx.fillStyle = b.palette.surface; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.283); ctx.fill();
  ctx.strokeStyle = b.palette.dot; ctx.lineWidth = W * 0.012; ctx.beginPath(); ctx.arc(cx, cy, r - W * 0.02, 0, 6.283); ctx.stroke();
  const col = a.icon === 'live' ? b.palette.rep : a.icon === 'au' ? b.palette.dot : a.icon === 'polls' || a.icon === 'map' ? b.palette.dem : b.palette.fg;
  drawIcon(ctx, a.icon ?? 'menu', cx, cy, r * 1.05, col);
}

function cardData(a: PackAsset, b: Brand, copy: Copy): CardData {
  const base = { url: 'poltok.netlify.app', handle: copy.handle ?? '@PolTok' };
  if (a.type === 'story') return { kind: 'brand', title: b.tagline, subtitle: 'Live results, calls and flips — free.', cta: 'Link in bio', ...base };
  if (a.type === 'thumbnail') return { kind: 'brand', title: 'Your *headline* here', subtitle: 'Thumbnail template — swap in the episode title', ...base };
  return { kind: 'brand', title: copy.pinned || b.tagline, cta: 'Follow for live calls', ...base };
}

export async function renderAsset(a: PackAsset, b: Brand, copy: Copy = {}): Promise<Rendered> {
  if (!a.brand) {
    const src = await renderCardCanvas(a.design, cardData(a, b, copy), { ...cardStyleOf(b), size: { w: a.w, h: a.h }, fit: 'reflow' });
    return { canvas: src, keys: [] };
  }
  const cv = document.createElement('canvas');
  cv.width = a.w; cv.height = a.h;
  const ctx = cv.getContext('2d')!;
  let keys: Rect[] = [];
  if (a.brand === 'avatar' || a.brand === 'icon') drawAvatar(ctx, a, b);
  else if (a.brand === 'highlight') drawHighlight(ctx, a, b);
  else keys = drawBanner(ctx, a, b, copy);
  return { canvas: cv, keys };
}

export const toPng = (cv: HTMLCanvasElement) => new Promise<Blob>((res, rej) => cv.toBlob((x) => (x ? res(x) : rej(new Error('png'))), 'image/png'));

/** Fractional rect overlap area / rect area. */
export function overlap(a: Rect, c: Rect) {
  const w = Math.min(a.x + a.w, c.x + c.w) - Math.max(a.x, c.x), h = Math.min(a.y + a.h, c.y + c.h) - Math.max(a.y, c.y);
  return w > 0 && h > 0 ? (w * h) / (a.w * a.h) : 0;
}
/** Warnings for key content covered by UI (covers) or outside every safe area. */
export function safeWarnings(keys: Rect[], covers: Rect[] = [], safe: Rect[] = []): string[] {
  const out: string[] = [];
  for (const k of keys) {
    for (const c of covers) { const o = overlap(k, c); if (o > 0.02) out.push(`${k.label} ${Math.round(o * 100)}% covered by ${c.label}`); }
    for (const s of safe) { const o = overlap(k, s); if (o < 0.98) out.push(`${k.label} ${Math.round((1 - o) * 100)}% outside ${s.label}`); }
  }
  return out;
}
