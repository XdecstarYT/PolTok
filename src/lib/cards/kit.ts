/** Shared canvas toolkit for the card designs (fonts, text fitting, wordmark, avatars, maps, textures). */
import type { CardData, CardKind } from './types';
import { initials } from '../format';
import { stateShape } from '../../features/map/geometry';
import { FEDERAL_HEX, VIC_HEX } from '../../features/au/map/hex';

export type Ctx = CanvasRenderingContext2D;

export const FAM = {
  sans: `Inter, 'Segoe UI', system-ui, -apple-system, Roboto, Helvetica, Arial, sans-serif`,
  display: `'Space Grotesk', Inter, system-ui, sans-serif`,
  mono: `'JetBrains Mono', 'IBM Plex Mono', ui-monospace, Menlo, Consolas, monospace`,
  plex: `'IBM Plex Mono', 'JetBrains Mono', ui-monospace, monospace`,
  cond: `Oswald, 'Roboto Condensed', 'Arial Narrow', Impact, sans-serif`,
  rc: `'Roboto Condensed', Oswald, 'Arial Narrow', sans-serif`,
  serif: `'Playfair Display', Georgia, 'Times New Roman', serif`,
  text: `'Source Serif 4', Georgia, 'Times New Roman', serif`,
} as const;
export type Fam = keyof typeof FAM;

/** Font loads to request before drawing (Google Fonts are declared on the page but load lazily). */
export const FONT_LOADS = [
  '400 20px Inter', '600 20px Inter', '800 20px Inter',
  '700 20px "Space Grotesk"', '500 20px "Space Grotesk"',
  '400 20px "JetBrains Mono"', '700 20px "JetBrains Mono"',
  '400 20px "IBM Plex Mono"', '700 20px "IBM Plex Mono"',
  '500 20px Oswald', '700 20px Oswald',
  '400 20px "Roboto Condensed"', '700 20px "Roboto Condensed"', '900 20px "Roboto Condensed"',
  '700 20px "Playfair Display"', '900 20px "Playfair Display"', 'italic 700 20px "Playfair Display"',
  '400 20px "Source Serif 4"', '600 20px "Source Serif 4"', 'italic 400 20px "Source Serif 4"',
];

/** Render-scoped overrides set by the style layer (drawing is synchronous, so module state is safe). */
export const RT: { display?: string; body?: string; logoOff?: boolean; align?: 'left' | 'center' | 'right' } = {};
const DISPLAY_FAMS: Fam[] = ['display', 'cond', 'serif'];
const BODY_FAMS: Fam[] = ['sans', 'rc', 'text'];

export function font(fam: Fam, px: number, weight: number | string = 600, italic = false) {
  let stack: string = FAM[fam];
  if (RT.display && DISPLAY_FAMS.includes(fam)) stack = `'${RT.display}', ${stack}`;
  else if (RT.body && BODY_FAMS.includes(fam)) stack = `'${RT.body}', ${stack}`;
  return `${italic ? 'italic ' : ''}${weight} ${Math.max(1, Math.round(px))}px ${stack}`;
}

export interface K {
  ctx: Ctx;
  W: number;
  H: number;
  /** scale relative to a 1080px short side */
  s: number;
  d: CardData;
  img: HTMLImageElement | null;
  /** second portrait (CardData.photo2) */
  img2?: HTMLImageElement | null;
  accent: string;
  kicker: string;
  stamp: string;
  attr: string;
  url: string;
  /** corner radius hint for designs that use one (style.cornerRadius) */
  radius?: number;
  /** palette colour remapper active for this render (style wrapper), if any */
  map?: (c: string) => string;
}

export const KIND_LABEL: Record<CardKind, string> = {
  race: 'Race result', balance: 'Balance of power', 'au-seat': 'Australian seat', promo: 'Live results', stat: 'By the numbers', flip: 'Seat flip', quote: 'Quote', candidate: 'Candidate', custom: 'PolTok',
};

/* ───────── geometry + text ───────── */

export function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, rad);
  else ctx.rect(x, y, w, h);
}

/** Shrinks the font until `text` fits `maxW`; leaves ctx.font set. Returns the px size used. */
export function fit(ctx: Ctx, text: string, maxW: number, px: number, fam: Fam, weight: number | string = 700, min = 14, italic = false): number {
  let size = px;
  ctx.font = font(fam, size, weight, italic);
  const w = ctx.measureText(text).width;
  if (w > maxW) {
    size = Math.max(min, Math.floor((px * maxW) / w));
    ctx.font = font(fam, size, weight, italic);
    while (size > min && ctx.measureText(text).width > maxW) { size -= 1; ctx.font = font(fam, size, weight, italic); }
  }
  return size;
}

export function ellipsize(ctx: Ctx, text: string, maxW: number) {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t.trimEnd() + '…';
}

/** Word-wraps with the current ctx.font; last line ellipsized when over maxLines. */
export function wrap(ctx: Ctx, text: string, maxW: number, maxLines = 4): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const t = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t).width <= maxW || !cur) cur = t;
    else {
      lines.push(cur);
      cur = w;
      if (lines.length === maxLines - 1) { cur = words.slice(i).join(' '); break; }
    }
  }
  if (cur) lines.push(cur);
  return lines.map((l, i) => (i === lines.length - 1 ? ellipsize(ctx, l, maxW) : l));
}

/** Fits a wrapped block in a box: picks the largest px (≤ max) whose wrapped lines fit maxLines and height. */
export function fitBlock(ctx: Ctx, text: string, maxW: number, maxH: number, maxPx: number, fam: Fam, weight: number | string = 800, lh = 1.08, maxLines = 4, minPx = 16, italic = false): { lines: string[]; px: number; lh: number } {
  let px = maxPx;
  for (; px > minPx; px -= Math.max(1, Math.round(px * 0.05))) {
    ctx.font = font(fam, px, weight, italic);
    const lines = wrapNoEllipsis(ctx, text, maxW);
    const longest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    if (lines.length <= maxLines && lines.length * px * lh <= maxH && longest <= maxW) return { lines, px, lh: px * lh };
  }
  ctx.font = font(fam, minPx, weight, italic);
  return { lines: wrap(ctx, text, maxW, maxLines), px: minPx, lh: minPx * lh };
}

function wrapNoEllipsis(ctx: Ctx, text: string, maxW: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t).width <= maxW || !cur) cur = t;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}

export function drawLines(ctx: Ctx, lines: string[], x: number, y: number, lh: number) {
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lh));
  return y + lines.length * lh;
}

export function text(ctx: Ctx, t: string, x: number, y: number, f: string, color: string, align: CanvasTextAlign = 'left', base: CanvasTextBaseline = 'alphabetic') {
  ctx.font = f;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = base;
  ctx.fillText(t, x, y);
  return ctx.measureText(t).width;
}

/** Spaced caps text (letterSpacing where supported). */
export function caps(ctx: Ctx, t: string, x: number, y: number, f: string, color: string, spacing = 0.12, align: CanvasTextAlign = 'left') {
  ctx.font = f;
  const px = parseFloat(/(\d+)px/.exec(f)?.[1] ?? '16');
  const c = ctx as Ctx & { letterSpacing?: string };
  const prev = c.letterSpacing;
  if ('letterSpacing' in c) c.letterSpacing = `${(px * spacing).toFixed(1)}px`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(t.toUpperCase(), x, y);
  const w = ctx.measureText(t.toUpperCase()).width;
  if ('letterSpacing' in c) c.letterSpacing = prev ?? '0px';
  return w;
}

/** caps() that ellipsizes to maxW using the caps font. */
export function capsFit(ctx: Ctx, t: string, maxW: number, x: number, y: number, f: string, color: string, spacing = 0.12, align: CanvasTextAlign = 'left') {
  ctx.font = f;
  const px = parseFloat(/(\d+)px/.exec(f)?.[1] ?? '16');
  let u = t.toUpperCase();
  const est = (s: string) => ctx.measureText(s).width + s.length * px * spacing;
  if (est(u) > maxW) { while (u.length > 1 && est(u + '…') > maxW) u = u.slice(0, -1); u = u.trimEnd() + '…'; }
  return caps(ctx, u, x, y, f, color, spacing, align);
}

/* ───────── colour ───────── */

export function hexToRgb(c: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(c.trim());
  if (!m) return [128, 128, 128];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const rgba = (c: string, a: number) => { const [r, g, b] = hexToRgb(c); return `rgba(${r},${g},${b},${a})`; };
export function mix(a: string, b: string, t: number) {
  const A = hexToRgb(a), B = hexToRgb(b);
  const h = (i: number) => Math.round(A[i] + (B[i] - A[i]) * t).toString(16).padStart(2, '0');
  return `#${h(0)}${h(1)}${h(2)}`;
}
export function lum(c: string) { const [r, g, b] = hexToRgb(c); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; }
/** readable ink colour on top of `bg` */
export const ink = (bg: string, dark = '#0b0d14', light = '#ffffff') => (lum(bg) > 0.6 ? dark : light);

/** WCAG 2.x relative luminance; accepts #hex or rgb()/rgba(). */
export function wcagLum(c: string): number {
  let rgb: number[];
  const m = /^rgba?\(([^)]+)\)$/i.exec(c.trim());
  if (m) rgb = m[1].split(/[\s,/]+/).filter(Boolean).slice(0, 3).map(Number);
  else rgb = hexToRgb(c.length === 4 && c[0] === '#' ? '#' + [...c.slice(1)].map((x) => x + x).join('') : c);
  const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
}
export function contrast(a: string, b: string) {
  const x = wcagLum(a), y = wcagLum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
/**
 * Text colour with ≥4.5:1 contrast against every given background, judged on the colours that
 * actually reach the canvas (after the style palette remap). The result bypasses the remap.
 */
export function inkOn(k: K, bgs: string | string[], prefer?: string): string {
  const map = k.map ?? ((c: string) => c);
  const list = (Array.isArray(bgs) ? bgs : [bgs]).map(map);
  const score = (c: string) => Math.min(...list.map((b) => contrast(c, b)));
  const cands = [...(prefer ? [map(prefer)] : []), '#ffffff', '#0b0d14', '#000000'];
  let best = cands[0], bs = -1;
  for (const c of cands) { const s = score(c); if (s >= 4.5) { best = c; break; } if (s > bs) { bs = s; best = c; } }
  return k.map ? '!' + best : best;
}

/* ───────── branding ───────── */

/** PolTok wordmark: dot + "Pol" + "Tok". `y` is the baseline. Returns width. */
export function wordmark(ctx: Ctx, x: number, y: number, size: number, opts: { color?: string; accent?: string; fam?: Fam; align?: 'left' | 'right' | 'center'; force?: boolean } = {}) {
  if (RT.logoOff && !opts.force) return 0;
  const color = opts.color ?? '#f2f5ff';
  const accent = opts.accent ?? '#c6ff3d';
  ctx.font = font(opts.fam ?? 'display', size, 700);
  const wPol = ctx.measureText('Pol').width, wTok = ctx.measureText('Tok').width;
  const dot = size * 0.62;
  const total = dot + wPol + wTok;
  let x0 = x;
  if (opts.align === 'right') x0 = x - total;
  else if (opts.align === 'center') x0 = x - total / 2;
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(x0 + size * 0.24, y - size * 0.34, size * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = color;
  ctx.fillText('Pol', x0 + dot, y);
  ctx.fillStyle = accent;
  ctx.fillText('Tok', x0 + dot + wPol, y);
  return total;
}

/** One-line footer: attribution · timestamp on the left, URL on the right. */
export function footerLine(k: K, x: number, y: number, w: number, px: number, color: string, urlColor: string, fam: Fam = 'sans') {
  const { ctx } = k;
  ctx.font = font(fam, px, 700);
  const uw = ctx.measureText(k.url).width;
  text(ctx, k.url, x + w, y, font(fam, px, 700), urlColor, 'right');
  ctx.font = font(fam, px, 500);
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.fillText(ellipsize(ctx, `${k.attr} · ${k.stamp}`, w - uw - px * 1.5), x, y);
}

/* ───────── images ───────── */

const imgCache = new Map<string, Promise<HTMLImageElement | null>>();
export function loadImage(src?: string, timeout = 2500): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  let p = imgCache.get(src);
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.decoding = 'async';
      const t = setTimeout(() => resolve(null), timeout);
      img.onload = () => {
        clearTimeout(t);
        // verify the canvas won't be tainted
        try { const c = document.createElement('canvas'); c.width = c.height = 2; const x = c.getContext('2d')!; x.drawImage(img, 0, 0, 2, 2); x.getImageData(0, 0, 1, 1); resolve(img); } catch { resolve(null); }
      };
      img.onerror = () => { clearTimeout(t); resolve(null); };
      img.src = src;
    });
    imgCache.set(src, p);
  }
  return p;
}

export function nameOf(k: K) {
  if (k.d.kind === 'candidate') return k.d.title;
  if (k.d.kind === 'quote' && k.d.quoteBy) return k.d.quoteBy;
  if (k.d.kind === 'promo' || k.d.kind === 'stat' || k.d.kind === 'quote' || k.d.kind === 'balance' || k.d.kind === 'custom') return 'Pol Tok';
  return k.d.stats?.[0]?.label && (k.d.kind === 'race' || k.d.kind === 'flip') ? k.d.stats[0].label : k.d.title;
}

/** Draws the photo cover-cropped into a rect/circle, or an initials block in `color`. */
export function portrait(ctx: Ctx, img: HTMLImageElement | null, name: string, x: number, y: number, w: number, h: number, color: string, opts: { circle?: boolean; radius?: number; fam?: Fam; inkColor?: string; ring?: number } = {}) {
  ctx.save();
  if (opts.circle) { ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) / 2, 0, Math.PI * 2); }
  else rr(ctx, x, y, w, h, opts.radius ?? 0);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.clip();
  if (img) {
    const ir = img.naturalWidth / img.naturalHeight, br = w / h;
    let sw = img.naturalWidth, sh = img.naturalHeight, sx = 0, sy = 0;
    if (ir > br) { sw = sh * br; sx = (img.naturalWidth - sw) / 2; } else { sh = sw / br; sy = Math.max(0, (img.naturalHeight - sh) * 0.15); }
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  } else {
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, 'rgba(255,255,255,0.22)');
    g.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = opts.inkColor ?? ink(color);
    ctx.font = font(opts.fam ?? 'display', Math.min(w, h) * 0.4, 700);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials(name || 'PolTok').toUpperCase(), x + w / 2, y + h / 2 + Math.min(w, h) * 0.02);
  }
  ctx.restore();
  if (opts.ring) {
    ctx.lineWidth = opts.ring;
    ctx.strokeStyle = color;
    if (opts.circle) { ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) / 2, 0, Math.PI * 2); ctx.stroke(); }
    else { rr(ctx, x, y, w, h, opts.radius ?? 0); ctx.stroke(); }
  }
}

/* ───────── maps ───────── */

/** US state (2-letter) or AU seat ("AU:kooyong" / "AU:vic-…"). Returns true if something was drawn. */
export function drawMap(ctx: Ctx, mapState: string | undefined, x: number, y: number, w: number, h: number, opts: { fill: string; stroke?: string; lineWidth?: number; base?: string; glow?: string; hexGap?: number }): boolean {
  if (!mapState) return false;
  if (mapState.startsWith('AU:')) return drawAuHex(ctx, mapState.slice(3), x, y, w, h, opts);
  const shp = stateShape(mapState, w, h, 4);
  if (!shp) return false;
  const p = new Path2D(shp.d);
  ctx.save();
  ctx.translate(x, y);
  if (opts.glow) { ctx.shadowColor = opts.glow; ctx.shadowBlur = Math.min(w, h) * 0.08; }
  ctx.fillStyle = opts.fill;
  ctx.fill(p);
  ctx.shadowBlur = 0;
  if (opts.stroke) { ctx.lineWidth = opts.lineWidth ?? 3; ctx.lineJoin = 'round'; ctx.strokeStyle = opts.stroke; ctx.stroke(p); }
  ctx.restore();
  return true;
}

/** AU hex cartogram (federal or Victorian) with the given seat highlighted. */
export function drawAuHex(ctx: Ctx, seatId: string, x: number, y: number, w: number, h: number, opts: { fill: string; stroke?: string; base?: string; glow?: string; hexGap?: number }): boolean {
  const cells = seatId.startsWith('vic-') ? VIC_HEX : FEDERAL_HEX;
  if (!cells.length) return false;
  const cols = cells.map((c) => c[1] + (c[2] % 2 ? 0.5 : 0));
  const rows = cells.map((c) => c[2]);
  const minC = Math.min(...cols), maxC = Math.max(...cols), minR = Math.min(...rows), maxR = Math.max(...rows);
  const unitW = maxC - minC + 1, unitH = (maxR - minR) * 0.866 + 1.155;
  const r = Math.min(w / unitW, h / unitH) / Math.sqrt(3) * 1.0; // hex radius (pointy-top: width = √3 r)
  const hw = Math.sqrt(3) * r;
  const ox = x + (w - unitW * hw) / 2, oy = y + (h - unitH * hw) / 2;
  const gap = opts.hexGap ?? 0.88;
  let target: [number, number] | null = null;
  const hex = (cx: number, cy: number, rad: number) => {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + (i * Math.PI) / 3; const px = cx + rad * Math.cos(a), py = cy + rad * Math.sin(a); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
    ctx.closePath();
  };
  for (const c of cells) {
    const cx = ox + (c[1] + (c[2] % 2 ? 0.5 : 0) - minC + 0.5) * hw;
    const cy = oy + (c[2] - minR) * hw * 0.866 + hw * 0.577;
    if (c[0] === seatId) { target = [cx, cy]; continue; }
    hex(cx, cy, r * gap);
    ctx.fillStyle = opts.base ?? 'rgba(255,255,255,0.12)';
    ctx.fill();
  }
  if (target) {
    ctx.save();
    if (opts.glow) { ctx.shadowColor = opts.glow; ctx.shadowBlur = r * 3; }
    hex(target[0], target[1], r * 1.25);
    ctx.fillStyle = opts.fill;
    ctx.fill();
    ctx.restore();
    if (opts.stroke) { hex(target[0], target[1], r * 1.25); ctx.lineWidth = Math.max(2, r * 0.25); ctx.strokeStyle = opts.stroke; ctx.stroke(); }
  }
  return true;
}

/* ───────── textures ───────── */

export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
}

export function grain(ctx: Ctx, W: number, H: number, alpha = 0.06, seed = 7) {
  const r = rng(seed);
  ctx.save();
  for (let i = 0; i < (W * H) / 90; i++) {
    ctx.fillStyle = r() > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
    ctx.fillRect(r() * W, r() * H, 1.6, 1.6);
  }
  ctx.restore();
}

export function halftone(ctx: Ctx, x: number, y: number, w: number, h: number, color: string, step = 18, maxR = 6, dir: 'x' | 'y' | 'radial' = 'radial') {
  ctx.save();
  ctx.fillStyle = color;
  const cx = x + w / 2, cy = y + h / 2, md = Math.hypot(w / 2, h / 2);
  for (let yy = y; yy < y + h; yy += step) {
    for (let xx = x + ((yy / step) % 2 ? step / 2 : 0); xx < x + w; xx += step) {
      const t = dir === 'x' ? (xx - x) / w : dir === 'y' ? (yy - y) / h : 1 - Math.hypot(xx - cx, yy - cy) / md;
      const rad = maxR * Math.max(0, Math.min(1, t));
      if (rad < 0.4) continue;
      ctx.beginPath();
      ctx.arc(xx, yy, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

export function vignette(ctx: Ctx, W: number, H: number, a = 0.5) {
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) / 2);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${a})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

export function blob(ctx: Ctx, x: number, y: number, r: number, color: string, a = 0.6) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, a));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/* ───────── data helpers ───────── */

export type Row = { label: string; value: string; num: number; color: string };

/** Unified rows: bars (with pct strings) for race/flip/au/balance, or stats. */
export function rowsOf(k: K, max = 4): Row[] {
  const d = k.d;
  if (d.bars?.length && (d.kind === 'race' || d.kind === 'flip' || d.kind === 'au-seat')) {
    const vals = d.stats ?? [];
    return d.bars.slice(0, max).map((b, i) => ({ label: b.label, value: vals[i]?.label === b.label ? vals[i].value : `${b.value.toFixed(1)}%`, num: b.value, color: b.color }));
  }
  return (d.stats ?? []).slice(0, max).map((s) => ({ label: s.label, value: s.value, num: parseFloat(s.value) || 0, color: s.color ?? k.accent }));
}

/** Total of bar values (for stacked bars). */
export const barTotal = (d: CardData) => (d.bars ?? []).reduce((a, b) => a + Math.max(0, b.value), 0);

/** Horizontal stacked bar of d.bars. */
export function stackBar(ctx: Ctx, d: CardData, x: number, y: number, w: number, h: number, r = 0, emptyColor = 'rgba(255,255,255,0.1)', gap = 0) {
  const bars = d.bars ?? [];
  const total = d.kind === 'race' || d.kind === 'flip' ? Math.max(100, barTotal(d)) : barTotal(d) || 1;
  ctx.save();
  rr(ctx, x, y, w, h, r);
  ctx.clip();
  ctx.fillStyle = emptyColor;
  ctx.fillRect(x, y, w, h);
  let cx = x;
  for (const b of bars) {
    const bw = (w * Math.max(0, b.value)) / total;
    ctx.fillStyle = b.color;
    ctx.fillRect(cx, y, Math.max(0, bw - gap), h);
    cx += bw;
  }
  ctx.restore();
}

export function star(ctx: Ctx, cx: number, cy: number, spikes: number, outer: number, inner: number, rot = 0, jitter?: () => number) {
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const rad = (i % 2 ? inner : outer) * (jitter ? 0.85 + jitter() * 0.3 : 1);
    const a = rot + (i * Math.PI) / spikes;
    const px = cx + Math.cos(a) * rad, py = cy + Math.sin(a) * rad;
    if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.closePath();
}

/** Short status line: subtitle, else kicker. */
export const dek = (k: K) => k.d.subtitle ?? k.kicker;
