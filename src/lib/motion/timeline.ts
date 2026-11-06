/**
 * Motion timeline — animates any card design with a generic layer approach.
 *
 * Designs draw a single static frame (src/lib/cards public API: renderCardCanvas), so motion
 * composites that frame as a layer (entrance wipe / zoom / slide, Ken Burns, shake) and draws
 * animated primitives on top driven by the card's real CardData: count-up numbers, growing
 * bars, a sweeping needle, US states filling in sequence, typewriter / word-by-word / kinetic
 * captions, confetti bursts, LIVE badge pulse, breaking banner + ticker and a countdown clock.
 *
 * Every element gets its own progress 0..1 from an AnimCtx: `a.p('bars')` reads the window the
 * preset assigned to that element (fractions of the clip), so the same preset scales to 6–15 s.
 */
import type { CardData } from '../cards';
import { getGeometry } from '../../features/map/geometry';

export type PresetId = 'election' | 'breaking' | 'countdown' | 'flip' | 'calm' | 'kinetic';
export type Ease = (x: number) => number;
export const EASE = {
  linear: (x: number) => x,
  outCubic: (x: number) => 1 - (1 - x) ** 3,
  inOutCubic: (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2),
  outBack: (x: number) => { const c = 1.70158; return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2; },
  outElastic: (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : 2 ** (-10 * x) * Math.sin((x * 10 - 0.75) * (2 * Math.PI / 3)) + 1),
} satisfies Record<string, Ease>;
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** [start, end] as fractions of the clip, optional easing. */
export type EaseName = keyof typeof EASE;
export type Track = [number, number, EaseName?];
export interface PresetDef {
  id: PresetId; label: string; blurb: string;
  enter: 'wipe' | 'zoom' | 'slide' | 'fade';
  /** Ken Burns zoom amount over the whole clip */
  kenBurns: number;
  tracks: Partial<Record<Element, Track>>;
  /** fraction(s) of the clip at which a confetti burst fires */
  bursts?: number[];
  caption: 'word' | 'type' | 'kinetic' | 'none';
  defaultDuration: number;
}
export type Element = 'enter' | 'live' | 'bars' | 'count' | 'needle' | 'map' | 'caption' | 'banner' | 'ticker' | 'sticker' | 'countdown' | 'kinetic' | 'by' | 'shake' | 'panel';

export const MOTION_PRESETS: PresetDef[] = [
  { id: 'election', label: 'Election night', blurb: 'Wipe-in, LIVE pulse, states fill, bars grow, needle sweeps', enter: 'wipe', kenBurns: 0.05, caption: 'word', defaultDuration: 10,
    tracks: { enter: [0, 0.1, 'inOutCubic'], live: [0.05, 1], panel: [0.12, 0.2, 'outCubic'], map: [0.15, 0.6], bars: [0.2, 0.55, 'outCubic'], count: [0.2, 0.55, 'outCubic'], needle: [0.3, 0.75, 'outElastic'], caption: [0.6, 0.92] } },
  { id: 'breaking', label: 'Breaking', blurb: 'Punch-in zoom, shake, red banner, typewriter, ticker', enter: 'zoom', kenBurns: 0.04, caption: 'type', defaultDuration: 8,
    tracks: { enter: [0, 0.08, 'outBack'], shake: [0.02, 0.14], banner: [0.06, 0.16, 'outCubic'], caption: [0.16, 0.55], ticker: [0.15, 1], panel: [0.45, 0.52, 'outCubic'], count: [0.45, 0.75, 'outCubic'], bars: [0.45, 0.75, 'outCubic'], live: [0.1, 1] } },
  { id: 'countdown', label: 'Countdown', blurb: 'Live ticking clock with a sweeping ring', enter: 'fade', kenBurns: 0.06, caption: 'word', defaultDuration: 10,
    tracks: { enter: [0, 0.1, 'outCubic'], countdown: [0.08, 1], caption: [0.55, 0.9] } },
  { id: 'flip', label: 'Flip celebration', blurb: 'Slide-in, FLIP sticker pop, confetti bursts, bars', enter: 'slide', kenBurns: 0.03, caption: 'word', defaultDuration: 8, bursts: [0.28, 0.62],
    tracks: { enter: [0, 0.12, 'outCubic'], sticker: [0.25, 0.35, 'outElastic'], panel: [0.12, 0.2, 'outCubic'], bars: [0.15, 0.45, 'outCubic'], count: [0.15, 0.45, 'outCubic'], map: [0.1, 0.4], caption: [0.55, 0.9] } },
  { id: 'calm', label: 'Calm explainer', blurb: 'Slow fade + Ken Burns, word-by-word caption', enter: 'fade', kenBurns: 0.09, caption: 'word', defaultDuration: 12,
    tracks: { enter: [0, 0.18, 'inOutCubic'], panel: [0.22, 0.32, 'inOutCubic'], bars: [0.25, 0.6, 'inOutCubic'], count: [0.25, 0.6, 'inOutCubic'], caption: [0.3, 0.92] } },
  { id: 'kinetic', label: 'Kinetic quote', blurb: 'Big word-by-word type over the dimmed card', enter: 'fade', kenBurns: 0.12, caption: 'kinetic', defaultDuration: 8,
    tracks: { enter: [0, 0.12, 'outCubic'], kinetic: [0.08, 0.72], by: [0.74, 0.9] } },
];
export const presetById = (id: string) => MOTION_PRESETS.find((p) => p.id === id) ?? MOTION_PRESETS[0];

/** Platform UI overlap as fractions of the frame (vertical video). */
export const SAFE_ZONES = {
  tiktok: { label: 'TikTok', top: 0.11, bottom: 0.22, left: 0.04, right: 0.14 },
  reels: { label: 'Reels', top: 0.12, bottom: 0.2, left: 0.04, right: 0.12 },
  shorts: { label: 'Shorts', top: 0.08, bottom: 0.18, left: 0.04, right: 0.13 },
} as const;
export type SafeZoneId = keyof typeof SAFE_ZONES;

export const MOTION_SIZES = [
  { id: 'x', label: 'X / landscape 1280×720', w: 1280, h: 720 },
  { id: 'square', label: 'Square 1080×1080', w: 1080, h: 1080 },
  { id: 'vertical', label: 'Vertical 1080×1920 (TikTok / Reels / Shorts)', w: 1080, h: 1920 },
] as const;

export interface MapFill { abbr: string; color: string }
export interface MotionInput {
  /** the rendered static card (renderCardCanvas output) */
  card: HTMLCanvasElement | HTMLImageElement | ImageBitmap | OffscreenCanvas;
  data: CardData;
  /** states to fill in sequence (election night / flip), e.g. called races */
  mapFills?: MapFill[];
  /** caption override; defaults to subtitle/title */
  caption?: string;
}
export interface MotionOptions {
  preset: PresetId;
  /** clip length in seconds */
  duration: number;
  /** epoch ms used for countdown (frame time is added) */
  now?: number;
  /** draw safe-zone guides (preview only — never in exports) */
  guides?: SafeZoneId | null;
  /** zone the overlays keep clear of (defaults to TikTok on vertical frames) */
  safe?: SafeZoneId | null;
  seed?: number;
}

/** Per-element progress for one frame. */
export class AnimCtx {
  constructor(readonly t: number, readonly T: number, readonly def: PresetDef) {}
  get f() { return this.T > 0 ? clamp01(this.t / this.T) : 1; }
  has(el: Element) { return !!this.def.tracks[el]; }
  /** eased 0..1 progress of element `el` (1 when the preset doesn't animate it). */
  p(el: Element, ease?: keyof typeof EASE): number {
    const tr = this.def.tracks[el];
    if (!tr) return 1;
    const raw = tr[1] > tr[0] ? clamp01((this.f - tr[0]) / (tr[1] - tr[0])) : this.f >= tr[0] ? 1 : 0;
    return EASE[ease ?? tr[2] ?? 'linear'](raw);
  }
  /** seconds since element `el` started (can be negative) */
  since(el: Element) { const tr = this.def.tracks[el]; return tr ? this.t - tr[0] * this.T : this.t; }
}

// ---------- number formatting ----------
export interface ParsedNum { pre: string; num: number; dec: number; suf: string; comma: boolean }
export function parseNum(v: string): ParsedNum | null {
  const m = /^(\D*?)(-?[\d,]*\.?\d+)(.*)$/.exec(v.trim());
  if (!m) return null;
  const n = Number(m[2].replace(/,/g, ''));
  if (!Number.isFinite(n)) return null;
  return { pre: m[1], num: n, dec: (m[2].split('.')[1] ?? '').length, suf: m[3], comma: m[2].includes(',') };
}
export function fmtNum(p: ParsedNum, k: number): string {
  const v = p.num * k;
  const s = p.comma ? v.toLocaleString('en-US', { minimumFractionDigits: p.dec, maximumFractionDigits: p.dec }) : v.toFixed(p.dec);
  return `${p.pre}${s}${p.suf}`;
}

// ---------- drawing helpers ----------
type C = CanvasRenderingContext2D;
const SANS = `Inter, 'Segoe UI', system-ui, sans-serif`;
const DISP = `'Space Grotesk', Inter, system-ui, sans-serif`;
const COND = `Oswald, 'Roboto Condensed', 'Arial Narrow', Impact, sans-serif`;
const f = (px: number, w = 700, fam = SANS) => `${w} ${Math.max(1, Math.round(px))}px ${fam}`;
function rrect(c: C, x: number, y: number, w: number, h: number, r: number) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
function rng(seed: number) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function wrapWords(c: C, words: string[], maxW: number): string[][] {
  const lines: string[][] = [[]];
  for (const w of words) {
    const cur = lines[lines.length - 1];
    if (cur.length && c.measureText([...cur, w].join(' ')).width > maxW) lines.push([w]); else cur.push(w);
  }
  return lines;
}
const isHex = (s?: string) => !!s && /^#[0-9a-f]{6}$/i.test(s);
const accentOf = (d: CardData) => (isHex(d.color) ? d.color! : '#c6ff3d');

interface Box { x: number; y: number; w: number; h: number }
/** content rect clear of platform UI */
export function safeRect(W: number, H: number, safe?: SafeZoneId | null): Box {
  const z = safe ? SAFE_ZONES[safe] : null;
  const m = Math.min(W, H) * 0.045;
  if (!z) return { x: m, y: m, w: W - 2 * m, h: H - 2 * m };
  const x = W * z.left, y = H * z.top;
  return { x, y, w: W * (1 - z.left - z.right), h: H * (1 - z.top - z.bottom) };
}

function drawCardLayer(c: C, inp: MotionInput, W: number, H: number, a: AnimCtx, dim = 0) {
  const card = inp.card as CanvasImageSource & { width: number; height: number };
  const cw = card.width, ch = card.height;
  const e = a.p('enter');
  const kb = 1 + a.def.kenBurns * a.f;
  // background: blurred cover copy when the aspect differs
  const cover = Math.max(W / cw, H / ch), contain = Math.min(W / cw, H / ch);
  const sameAspect = Math.abs(cw / ch - W / H) < 0.02;
  c.fillStyle = '#05060a'; c.fillRect(0, 0, W, H);
  if (!sameAspect) {
    c.save(); c.filter = `blur(${Math.round(Math.min(W, H) / 28)}px) brightness(0.5)`;
    const s = cover * 1.12 * kb; c.drawImage(card, (W - cw * s) / 2, (H - ch * s) / 2, cw * s, ch * s); c.restore();
  }
  let s = (sameAspect ? cover : contain) * kb, ox = 0, oy = 0, alpha = 1;
  const mode = a.def.enter;
  if (mode === 'zoom') s *= 1.25 - 0.25 * e;
  if (mode === 'slide') ox = (1 - e) * W * 0.9;
  if (mode === 'fade') { alpha = e; s *= 1.04 - 0.04 * e; }
  if (a.has('shake')) {
    const sp = a.p('shake');
    if (sp > 0 && sp < 1) { const amp = (1 - sp) * Math.min(W, H) * 0.012; ox += Math.sin(a.t * 90) * amp; oy += Math.cos(a.t * 70) * amp; }
  }
  // slow drift towards the upper-left for Ken Burns
  const drift = a.def.kenBurns * a.f * 0.25;
  const dw = cw * s, dh = ch * s, x = (W - dw) / 2 + ox - dw * drift * 0.2, y = (H - dh) / 2 + oy - dh * drift * 0.15;
  c.save();
  c.globalAlpha = alpha;
  if (mode === 'wipe' && e < 1) { c.beginPath(); c.rect(0, 0, W * e, H); c.clip(); }
  c.drawImage(card, x, y, dw, dh);
  c.restore();
  if (mode === 'wipe' && e > 0 && e < 1) { c.fillStyle = accentOf(inp.data); c.fillRect(W * e - W * 0.006, 0, W * 0.012, H); }
  if (dim > 0) { c.fillStyle = `rgba(4,5,10,${dim})`; c.fillRect(0, 0, W, H); }
}

function liveBadge(c: C, x: number, y: number, u: number, t: number, label = 'LIVE') {
  const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 0.9);
  c.save();
  c.font = f(u * 0.42, 800, SANS);
  const tw = c.measureText(label).width, h = u * 0.78, w = tw + u * 1.25;
  rrect(c, x, y, w, h, h / 2); c.fillStyle = '#e11d2e'; c.fill();
  c.beginPath(); c.arc(x + u * 0.42, y + h / 2, u * 0.13, 0, Math.PI * 2); c.fillStyle = '#fff'; c.fill();
  c.beginPath(); c.arc(x + u * 0.42, y + h / 2, u * (0.13 + 0.22 * pulse), 0, Math.PI * 2); c.strokeStyle = `rgba(255,255,255,${0.8 * (1 - pulse)})`; c.lineWidth = u * 0.05; c.stroke();
  c.fillStyle = '#fff'; c.textBaseline = 'middle'; c.fillText(label, x + u * 0.72, y + h / 2 + u * 0.02);
  c.restore();
  return w;
}

function glass(c: C, b: Box, p: number, r: number) {
  c.save();
  c.globalAlpha = p;
  rrect(c, b.x, b.y + (1 - p) * b.h * 0.25, b.w, b.h, r);
  c.fillStyle = 'rgba(8,10,18,0.78)'; c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.12)'; c.lineWidth = Math.max(1, r * 0.06); c.stroke();
  c.restore();
}

function barsEl(c: C, b: Box, d: CardData, p: number, u: number) {
  const bars = (d.bars ?? []).filter((x) => x.value > 0).slice(0, 4);
  if (!bars.length) return false;
  const max = Math.max(...bars.map((x) => x.value), 1);
  const total = bars.reduce((s, x) => s + x.value, 0);
  const pct = total > 0 && total <= 101 && bars.length > 1;
  const rowH = b.h / bars.length;
  bars.forEach((bar, i) => {
    const local = clamp01(p * 1.25 - i * 0.08);
    const y = b.y + i * rowH, bh = Math.min(rowH * 0.42, u * 0.5);
    c.font = f(u * 0.5, 700); c.fillStyle = '#e8ebf5'; c.textBaseline = 'alphabetic';
    c.fillText(bar.label.slice(0, 28), b.x, y + rowH * 0.42);
    const val = bar.value * EASE.outCubic(local);
    const txt = pct ? `${val.toFixed(1)}%` : Math.round(val).toLocaleString('en-US');
    c.textAlign = 'right'; c.fillText(txt, b.x + b.w, y + rowH * 0.42); c.textAlign = 'left';
    const by = y + rowH * 0.52;
    rrect(c, b.x, by, b.w, bh, bh / 2); c.fillStyle = 'rgba(255,255,255,0.1)'; c.fill();
    const bw = Math.max(bh, b.w * (bar.value / max) * local);
    if (local > 0) { rrect(c, b.x, by, bw, bh, bh / 2); c.fillStyle = isHex(bar.color) ? bar.color : '#9aa3b8'; c.fill(); }
  });
  return true;
}

function countEl(c: C, b: Box, d: CardData, p: number, u: number) {
  const stats = (d.stats ?? []).map((s) => ({ ...s, n: parseNum(s.value) })).filter((s) => s.n).slice(0, 3);
  if (!stats.length) return false;
  const cw = b.w / stats.length;
  stats.forEach((s, i) => {
    const local = clamp01(p * 1.2 - i * 0.1);
    const cx = b.x + cw * i + cw / 2;
    c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    let px = Math.min(b.h * 0.55, u * 1.3);
    const txt = fmtNum(s.n!, local);
    c.font = f(px, 800, DISP);
    const wFull = c.measureText(fmtNum(s.n!, 1)).width;
    if (wFull > cw * 0.9) { px *= (cw * 0.9) / wFull; c.font = f(px, 800, DISP); }
    c.fillStyle = isHex(s.color) ? s.color! : '#ffffff';
    c.fillText(txt, cx, b.y + b.h * 0.62);
    c.font = f(Math.min(u * 0.32, b.h * 0.2), 700); c.fillStyle = 'rgba(232,235,245,0.75)';
    c.fillText(s.label.toUpperCase().slice(0, 24), cx, b.y + b.h * 0.9);
  });
  c.textAlign = 'left';
  return true;
}

function needleEl(c: C, b: Box, d: CardData, p: number, u: number) {
  const bars = (d.bars ?? []).filter((x) => x.value > 0);
  if (bars.length < 2) return false;
  const [A, B] = bars;
  const margin = (A.value - B.value) / (A.value + B.value); // -1..1, A on the left
  const cx = b.x + b.w / 2, cy = b.y + b.h * 0.92, r = Math.min(b.w / 2, b.h * 0.85);
  const segs = 24;
  for (let i = 0; i < segs; i++) {
    const a0 = Math.PI + (i / segs) * Math.PI, a1 = Math.PI + ((i + 1) / segs) * Math.PI - 0.02;
    c.beginPath(); c.arc(cx, cy, r, a0, a1); c.lineWidth = r * 0.16;
    c.strokeStyle = i < segs / 2 ? (isHex(A.color) ? A.color : '#3b82f6') : isHex(B.color) ? B.color : '#ef4444';
    c.globalAlpha = 0.35 + 0.65 * Math.abs(i - segs / 2 + 0.5) / (segs / 2); c.stroke();
  }
  c.globalAlpha = 1;
  // sweep from far side with a little overshoot (outElastic)
  const target = Math.max(-0.95, Math.min(0.95, -margin * 2.5));
  const v = -1 + (target + 1) * p;
  const ang = Math.PI * 1.5 + v * Math.PI / 2;
  c.save(); c.translate(cx, cy); c.rotate(ang);
  c.beginPath(); c.moveTo(-r * 0.04, 0); c.lineTo(0, -r * 0.92); c.lineTo(r * 0.04, 0); c.closePath(); c.fillStyle = '#fff'; c.fill();
  c.restore();
  c.beginPath(); c.arc(cx, cy, r * 0.08, 0, Math.PI * 2); c.fillStyle = '#fff'; c.fill();
  c.font = f(u * 0.3, 700); c.fillStyle = 'rgba(232,235,245,0.8)'; c.textAlign = 'left';
  c.fillText(A.label.slice(0, 14), b.x, cy + u * 0.1); c.textAlign = 'right'; c.fillText(B.label.slice(0, 14), b.x + b.w, cy + u * 0.1); c.textAlign = 'left';
  return true;
}

let geoPaths: { abbr: string; p: Path2D }[] | null = null;
function mapEl(c: C, b: Box, fills: MapFill[], p: number) {
  if (!fills.length) return false;
  try {
    if (!geoPaths) geoPaths = getGeometry().geo.map((g) => ({ abbr: g.abbr, p: new Path2D(g.d) }));
  } catch { return false; }
  const s = Math.min(b.w / 975, b.h / 610), ox = b.x + (b.w - 975 * s) / 2, oy = b.y + (b.h - 610 * s) / 2;
  const order = new Map(fills.map((x, i) => [x.abbr, i]));
  c.save(); c.translate(ox, oy); c.scale(s, s);
  for (const g of geoPaths) {
    const i = order.get(g.abbr);
    c.fillStyle = 'rgba(255,255,255,0.12)'; c.fill(g.p);
    if (i !== undefined) {
      const local = clamp01(p * (fills.length + 2) - i);
      if (local > 0) { c.globalAlpha = local; c.fillStyle = fills[i].color; c.fill(g.p); c.globalAlpha = 1; }
    }
    c.strokeStyle = 'rgba(8,10,18,0.9)'; c.lineWidth = 1 / s; c.stroke(g.p);
  }
  c.restore();
  return true;
}

/** Word-by-word / typewriter caption in a pill at the bottom of `b`. */
export function captionEl(c: C, b: Box, text: string, p: number, u: number, mode: 'word' | 'type', accent: string) {
  if (!text.trim() || p <= 0) return;
  const px = u * 0.62;
  c.font = f(px, 800, SANS);
  const words = text.trim().split(/\s+/).slice(0, 40);
  const lines = wrapWords(c, words, b.w * 0.86).slice(0, 4);
  const lh = px * 1.25, padY = px * 0.55;
  const boxH = lines.length * lh + padY * 2, boxW = Math.min(b.w, Math.max(...lines.map((l) => c.measureText(l.join(' ')).width)) + px * 1.4);
  const x = b.x + (b.w - boxW) / 2, y = b.y + b.h - boxH;
  c.save(); c.globalAlpha = clamp01(p * 6);
  rrect(c, x, y, boxW, boxH, px * 0.45); c.fillStyle = 'rgba(8,10,18,0.82)'; c.fill();
  c.fillStyle = accent; c.fillRect(x, y + px * 0.4, px * 0.14, boxH - px * 0.8);
  c.restore();
  const totalWords = lines.reduce((s, l) => s + l.length, 0);
  const totalChars = lines.reduce((s, l) => s + l.join(' ').length, 0);
  let wi = 0, ci = 0;
  c.textBaseline = 'alphabetic'; c.textAlign = 'left';
  lines.forEach((l, li) => {
    const lw = c.measureText(l.join(' ')).width;
    let cx = x + (boxW - lw) / 2;
    const cy = y + padY + lh * li + px;
    for (const w of l) {
      const ww = c.measureText(w + ' ').width;
      if (mode === 'word') {
        const local = clamp01(p * totalWords * 1.15 - wi);
        if (local > 0) { c.save(); c.globalAlpha = local; c.fillStyle = '#fff'; c.fillText(w, cx, cy + (1 - EASE.outCubic(local)) * px * 0.5); c.restore(); }
      } else {
        const shown = Math.floor(p * totalChars * 1.05) - ci;
        if (shown > 0) { c.fillStyle = '#fff'; c.fillText(w.slice(0, shown), cx, cy); }
        ci += w.length + 1;
      }
      cx += ww; wi++;
    }
  });
  if (mode === 'type' && p < 1 && Math.floor(p * 40) % 2 === 0) {
    c.fillStyle = accent; c.fillRect(x + boxW - px * 0.7, y + boxH - padY - px, px * 0.08, px);
  }
}

function kineticEl(c: C, b: Box, text: string, p: number, u: number, accent: string) {
  const words = text.trim().split(/\s+/).slice(0, 28);
  if (!words.length) return;
  let px = u * 1.5;
  let lines: string[][] = [];
  for (let k = 0; k < 12; k++) {
    c.font = f(px, 900, DISP);
    lines = wrapWords(c, words, b.w * 0.92);
    if (lines.length * px * 1.1 < b.h * 0.8) break;
    px *= 0.88;
  }
  const lh = px * 1.08, y0 = b.y + (b.h - lines.length * lh) / 2 + px * 0.85;
  let wi = 0;
  const emph = words.reduce((bi, w, i) => (w.replace(/\W/g, '').length > words[bi].replace(/\W/g, '').length ? i : bi), 0);
  lines.forEach((l, li) => {
    let cx = b.x + (b.w - c.measureText(l.join(' ')).width) / 2;
    for (const w of l) {
      const local = clamp01(p * words.length * 1.1 - wi);
      const ww = c.measureText(w).width, sp = c.measureText(' ').width;
      if (local > 0) {
        const sc = 1 + 0.6 * (1 - EASE.outBack(local));
        c.save(); c.globalAlpha = clamp01(local * 2);
        c.translate(cx + ww / 2, y0 + li * lh - px * 0.35); c.scale(sc, sc);
        c.fillStyle = wi === emph ? accent : '#fff'; c.textAlign = 'center';
        c.fillText(w, 0, px * 0.35);
        c.restore();
      }
      cx += ww + sp; wi++;
    }
  });
}

function confetti(c: C, W: number, H: number, dt: number, seed: number, colors: string[]) {
  if (dt < 0 || dt > 3.2) return;
  const r = rng(seed), n = 140, g = H * 0.9, u = Math.min(W, H);
  for (let i = 0; i < n; i++) {
    const ang = -Math.PI / 2 + (r() - 0.5) * Math.PI * 0.9, sp = u * (0.9 + r() * 1.4);
    const ox = W * (0.2 + r() * 0.6);
    const x = ox + Math.cos(ang) * sp * dt * 0.8 + Math.sin(dt * 3 + i) * u * 0.02;
    const y = H * 0.75 + Math.sin(ang) * sp * dt + 0.5 * g * dt * dt;
    if (y > H + 20) continue;
    c.save(); c.translate(x, y); c.rotate(dt * (4 + r() * 8) + i);
    c.globalAlpha = clamp01(3.2 - dt);
    c.fillStyle = colors[i % colors.length];
    const s = u * (0.008 + r() * 0.01);
    if (i % 3 === 0) { c.beginPath(); c.arc(0, 0, s * 0.7, 0, Math.PI * 2); c.fill(); } else c.fillRect(-s, -s * 0.4, s * 2, s * 0.8 * Math.abs(Math.cos(dt * 9 + i)));
    c.restore();
  }
}

function sticker(c: C, x: number, y: number, u: number, p: number, text: string, color: string) {
  if (p <= 0) return;
  c.save(); c.translate(x, y); c.rotate(-0.12); c.scale(p, p);
  c.font = f(u * 1.1, 900, COND);
  const w = c.measureText(text).width + u * 0.9, h = u * 1.5;
  rrect(c, -w / 2, -h / 2, w, h, u * 0.25); c.fillStyle = color; c.fill();
  c.lineWidth = u * 0.1; c.strokeStyle = '#fff'; c.stroke();
  c.fillStyle = '#0b0d14'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 0, u * 0.06);
  c.restore();
}

function banner(c: C, b: Box, p: number, u: number, label: string) {
  const h = u * 1.05, y = b.y, w = b.w * EASE.outCubic(p);
  if (w <= 0) return;
  c.save(); c.beginPath(); c.rect(b.x, y, w, h); c.clip();
  c.fillStyle = '#e11d2e'; c.fillRect(b.x, y, b.w, h);
  c.font = f(u * 0.62, 900, COND); c.fillStyle = '#fff'; c.textBaseline = 'middle';
  c.fillText(label, b.x + u * 0.4, y + h / 2 + u * 0.03);
  c.restore();
}

function ticker(c: C, W: number, y: number, u: number, t: number, text: string) {
  const h = u * 0.62;
  c.fillStyle = 'rgba(8,10,18,0.92)'; c.fillRect(0, y, W, h);
  c.fillStyle = '#e11d2e'; c.fillRect(0, y, W, u * 0.05);
  c.font = f(u * 0.32, 700); c.fillStyle = '#fff'; c.textBaseline = 'middle';
  const seg = `${text}   •   `;
  const sw = c.measureText(seg).width || 1;
  let x = -((t * u * 2.4) % sw);
  while (x < W) { c.fillText(seg, x, y + h / 2 + u * 0.03); x += sw; }
}

function countdownEl(c: C, b: Box, target: number | undefined, now: number, p: number, u: number, accent: string) {
  const left = Math.max(0, (target ?? now) - now);
  const d = Math.floor(left / 864e5), h = Math.floor(left / 36e5) % 24, m = Math.floor(left / 6e4) % 60, s = Math.floor(left / 1e3) % 60;
  const parts = (d > 0 ? [[d, 'DAYS'], [h, 'HRS'], [m, 'MIN'], [s, 'SEC']] : [[h, 'HRS'], [m, 'MIN'], [s, 'SEC']]) as [number, string][];
  const cw = b.w / parts.length;
  const px = Math.min(cw * 0.55, b.h * 0.5);
  const frac = (left % 1000) / 1000;
  parts.forEach(([v, lbl], i) => {
    const cx = b.x + cw * i + cw / 2, cy = b.y + b.h * 0.45, r = Math.min(cw * 0.44, b.h * 0.42);
    c.globalAlpha = clamp01(p * 4 - i * 0.3);
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fillStyle = 'rgba(8,10,18,0.78)'; c.fill();
    c.lineWidth = r * 0.08; c.strokeStyle = 'rgba(255,255,255,0.12)'; c.stroke();
    if (lbl === 'SEC') { c.beginPath(); c.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac); c.strokeStyle = accent; c.stroke(); }
    c.font = f(px * 0.75, 800, DISP); c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(String(v).padStart(2, '0'), cx, cy - r * 0.08);
    c.font = f(px * 0.2, 700); c.fillStyle = 'rgba(232,235,245,0.7)'; c.fillText(lbl, cx, cy + r * 0.48);
  });
  c.globalAlpha = 1; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  if (!target) { c.font = f(u * 0.3, 600); c.fillStyle = 'rgba(232,235,245,0.6)'; c.textAlign = 'center'; c.fillText('No countdown date on this card', b.x + b.w / 2, b.y + b.h * 0.98); c.textAlign = 'left'; }
  void u;
}

export function drawGuides(c: C, W: number, H: number, z: SafeZoneId) {
  const s = SAFE_ZONES[z];
  c.save();
  c.fillStyle = 'rgba(255,0,90,0.18)';
  c.fillRect(0, 0, W, H * s.top); c.fillRect(0, H * (1 - s.bottom), W, H * s.bottom);
  c.fillRect(W * (1 - s.right), H * s.top, W * s.right, H * (1 - s.top - s.bottom));
  c.fillRect(0, H * s.top, W * s.left, H * (1 - s.top - s.bottom));
  c.setLineDash([12, 8]); c.strokeStyle = 'rgba(255,0,90,0.9)'; c.lineWidth = 3;
  c.strokeRect(W * s.left, H * s.top, W * (1 - s.left - s.right), H * (1 - s.top - s.bottom));
  c.font = f(Math.min(W, H) * 0.028, 700); c.fillStyle = '#fff'; c.fillText(`${s.label} safe zone`, W * s.left + 10, H * s.top + Math.min(W, H) * 0.04);
  c.restore();
}

/** Renders frame at time `t` seconds into `c` (canvas W×H). Deterministic in (input, opts, t). */
export function renderMotionFrame(c: C, inp: MotionInput, opts: MotionOptions, t: number) {
  const W = c.canvas.width, H = c.canvas.height;
  const def = presetById(opts.preset);
  const a = new AnimCtx(t, Math.max(0.5, opts.duration), def);
  const d = inp.data, accent = accentOf(d);
  const vertical = H > W * 1.3;
  const safe = opts.safe !== undefined ? opts.safe : vertical ? 'tiktok' : null;
  const S = safeRect(W, H, safe);
  const u = Math.min(W, H) / 18;
  c.save();
  c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  drawCardLayer(c, inp, W, H, a, def.id === 'kinetic' ? 0.62 * a.p('enter') : def.id === 'countdown' ? 0.35 * a.p('enter') : 0);
  const caption = (inp.caption ?? d.subtitle ?? d.title ?? '').trim();

  // lower data panel (bars / counts / needle / map)
  const panelH = vertical ? S.h * 0.3 : S.h * 0.36;
  const P: Box = { x: S.x, y: S.y + S.h - panelH - (def.caption === 'word' || def.caption === 'type' ? u * 2.6 : 0), w: S.w, h: panelH };
  const hasBars = !!d.bars?.some((x) => x.value > 0), hasCount = !!d.stats?.some((s) => parseNum(s.value));
  const hasMap = !!inp.mapFills?.length && a.has('map');
  const wantPanel = a.has('panel') && (hasBars || hasCount || hasMap);
  if (wantPanel) {
    const pp = a.p('panel');
    glass(c, P, pp, u * 0.35);
    if (pp > 0.3) {
      const pad = u * 0.45;
      const inner: Box = { x: P.x + pad, y: P.y + pad, w: P.w - 2 * pad, h: P.h - 2 * pad };
      const cols: Box[] = [];
      const parts: ('map' | 'needle' | 'bars' | 'count')[] = [];
      if (hasMap) parts.push('map');
      if (a.has('needle') && (d.bars?.filter((x) => x.value > 0).length ?? 0) >= 2) parts.push('needle');
      if (hasBars && a.has('bars')) parts.push('bars'); else if (hasCount && a.has('count')) parts.push('count');
      const n = Math.min(parts.length, vertical ? 2 : 3);
      const use = parts.slice(0, n);
      const gap = u * 0.5, cw = (inner.w - gap * (n - 1)) / Math.max(1, n);
      use.forEach((_, i) => cols.push({ x: inner.x + i * (cw + gap), y: inner.y, w: cw, h: inner.h }));
      c.save(); c.globalAlpha = clamp01((pp - 0.3) / 0.7);
      use.forEach((k, i) => {
        if (k === 'map') mapEl(c, cols[i], inp.mapFills!, a.p('map'));
        if (k === 'needle') needleEl(c, cols[i], d, a.p('needle'), u);
        if (k === 'bars') barsEl(c, cols[i], d, a.p('bars'), u * (n > 2 ? 0.8 : 1));
        if (k === 'count') countEl(c, cols[i], d, a.p('count'), u);
      });
      c.restore();
    }
  }

  if (a.has('banner')) banner(c, { x: S.x, y: S.y + u * 1.2, w: S.w * 0.72, h: u }, a.p('banner'), u, 'BREAKING');
  if (a.has('live') && a.p('live') > 0) liveBadge(c, S.x, S.y, u, t, def.id === 'breaking' ? 'LIVE' : 'LIVE · ELECTION NIGHT');
  if (a.has('ticker') && a.p('ticker') > 0) {
    const tk = [d.title, ...(d.stats ?? []).map((s) => `${s.label}: ${s.value}`), d.footer].filter(Boolean).join('   •   ');
    ticker(c, W, S.y + S.h - u * 0.62, u, t, tk);
  }
  if (a.has('countdown')) countdownEl(c, { x: S.x, y: S.y + S.h * 0.32, w: S.w, h: S.h * 0.32 }, d.countdownTo, (opts.now ?? Date.now()) + t * 1000, a.p('countdown'), u, accent);
  if (a.has('sticker')) sticker(c, S.x + S.w * 0.78, S.y + S.h * 0.14, u, a.p('sticker'), d.kind === 'flip' ? 'FLIP!' : d.kind === 'milestone' ? 'MILESTONE' : 'FLIP!', accent);
  for (const bt of def.bursts ?? []) confetti(c, W, H, t - bt * a.T, (opts.seed ?? 7) + Math.round(bt * 100), [accent, '#ffffff', '#ffd400', '#3b82f6', '#ef4444']);
  if (def.caption === 'word' || def.caption === 'type') {
    const cap: Box = { x: S.x, y: S.y, w: S.w, h: S.h - (a.has('ticker') ? u * 0.8 : 0) };
    captionEl(c, cap, caption, a.p('caption'), u * (vertical ? 1.05 : 1.25), def.caption, accent);
  }
  if (def.caption === 'kinetic') {
    const q = (inp.caption ?? d.title ?? '').trim();
    kineticEl(c, { x: S.x, y: S.y, w: S.w, h: S.h * 0.8 }, q, a.p('kinetic'), u, accent);
    const by = (d.quoteBy ?? d.subtitle ?? '').trim();
    if (by) captionEl(c, S, `— ${by}`, a.p('by'), u * 0.8, 'type', accent);
  }
  if (opts.guides) drawGuides(c, W, H, opts.guides);
  c.restore();
}
