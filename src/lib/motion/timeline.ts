/**
 * Motion timeline — animates any card design without duplicating its content.
 *
 * Designs draw one static frame (public API: renderCardCanvas), so motion animates THAT frame:
 * staggered band reveals (wipe from the left / slide / fade-rise — bars and text blocks appear
 * in sequence), punch-in zoom + shake, a card flip, Ken Burns. Nothing that the card already shows
 * is redrawn: added graphics live only in a reserved caption strip outside the card (caption,
 * ticker, ticking countdown, follow line) plus decorative confetti for flips/milestones.
 *
 * Layout: `motionLayout(W, H)` returns the card rect (render the card at that size so the design
 * reflows instead of letterboxing — `bestDesignFor` picks the closest-aspect design) and the strip.
 * Per-element progress 0..1 comes from AnimCtx windows (fractions of the clip) so a preset scales to 6–15 s.
 */
import type { CardData } from '../cards';

export type PresetId = 'election' | 'breaking' | 'countdown' | 'flip' | 'calm' | 'kinetic';
export type Ease = (x: number) => number;
export const EASE = {
  linear: (x: number) => x,
  outCubic: (x: number) => 1 - (1 - x) ** 3,
  outQuint: (x: number) => 1 - (1 - x) ** 5,
  inOutCubic: (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2),
  outBack: (x: number) => { const c = 1.70158; return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2; },
  outElastic: (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : 2 ** (-10 * x) * Math.sin((x * 10 - 0.75) * (2 * Math.PI / 3)) + 1),
} satisfies Record<string, Ease>;
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export type EaseName = keyof typeof EASE;
export type Track = [number, number, EaseName?];
export type Element = 'reveal' | 'strip' | 'caption' | 'ticker' | 'countdown' | 'kinetic' | 'undim' | 'shake' | 'flip';
export type Reveal = 'wipe' | 'slide' | 'rise' | 'punch' | 'flip' | 'fade';
export interface PresetDef {
  id: PresetId; label: string; blurb: string;
  reveal: Reveal; bands: number; kenBurns: number;
  tracks: Partial<Record<Element, Track>>;
  bursts?: number[];
  strip: 'caption' | 'type' | 'ticker' | 'countdown' | 'by';
  defaultDuration: number;
}

export const MOTION_PRESETS: PresetDef[] = [
  { id: 'election', label: 'Election night', blurb: 'Card wipes in band by band (bars grow from the left), caption word by word', reveal: 'wipe', bands: 6, kenBurns: 0.035, strip: 'caption', defaultDuration: 10,
    tracks: { reveal: [0, 0.32], strip: [0.3, 0.38, 'outCubic'], caption: [0.38, 0.8] } },
  { id: 'breaking', label: 'Breaking', blurb: 'Punch-in, shake, bands slam in, red strip with typewriter + ticker', reveal: 'punch', bands: 1, kenBurns: 0.03, strip: 'ticker', defaultDuration: 8,
    tracks: { reveal: [0, 0.16], shake: [0.12, 0.24], strip: [0.02, 0.1, 'outCubic'], caption: [0.12, 0.5], ticker: [0.5, 1] } },
  { id: 'countdown', label: 'Countdown', blurb: 'Card rises in, live ticking clock in the strip', reveal: 'rise', bands: 4, kenBurns: 0.05, strip: 'countdown', defaultDuration: 10,
    tracks: { reveal: [0, 0.25], strip: [0.2, 0.3, 'outCubic'], countdown: [0.25, 1] } },
  { id: 'flip', label: 'Flip celebration', blurb: 'Card flips over, confetti bursts, caption pops', reveal: 'flip', bands: 1, kenBurns: 0.03, strip: 'caption', defaultDuration: 8, bursts: [0.2, 0.55],
    tracks: { flip: [0, 0.18, 'outBack'], strip: [0.2, 0.28, 'outCubic'], caption: [0.28, 0.65] } },
  { id: 'calm', label: 'Calm explainer', blurb: 'Blocks fade up in sequence, slow Ken Burns, gentle caption', reveal: 'rise', bands: 5, kenBurns: 0.07, strip: 'caption', defaultDuration: 12,
    tracks: { reveal: [0, 0.4, 'inOutCubic'], strip: [0.35, 0.45, 'inOutCubic'], caption: [0.45, 0.92] } },
  { id: 'kinetic', label: 'Kinetic quote', blurb: 'Quote builds word by word, then the card resolves behind it', reveal: 'fade', bands: 1, kenBurns: 0.08, strip: 'by', defaultDuration: 8,
    tracks: { reveal: [0, 0.1], kinetic: [0.04, 0.5], undim: [0.6, 0.75, 'inOutCubic'], strip: [0.62, 0.7, 'outCubic'], caption: [0.7, 0.9] } },
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

export interface Box { x: number; y: number; w: number; h: number }
/** Card rect + reserved strip for a frame size. Vertical keeps the strip inside the TikTok/Reels safe zone. */
export function motionLayout(W: number, H: number): { card: Box; strip: Box } {
  if (H > W * 1.3) {
    const z = SAFE_ZONES.tiktok, top = Math.round(H * 0.03), ch = Math.round(H * 0.6);
    const sy = top + ch + H * 0.015, sh = H * (1 - z.bottom) - sy - H * 0.01;
    return { card: { x: 0, y: top, w: W, h: ch }, strip: { x: W * z.left, y: sy, w: W * (1 - z.left - z.right), h: sh } };
  }
  const sh = Math.round(H * (W > H * 1.3 ? 0.15 : 0.14));
  return { card: { x: 0, y: 0, w: W, h: H - sh }, strip: { x: 0, y: H - sh, w: W, h: sh } };
}
/** Closest-aspect design to the card rect; keeps `preferred` when it won't letterbox. */
export function bestDesignFor<T extends { id: string; size: { w: number; h: number } }>(designs: T[], target: { w: number; h: number }, preferred?: string): T | undefined {
  const ta = target.w / target.h;
  const off = (d: T) => { const r = (d.size.w / d.size.h) / ta; return Math.max(r, 1 / r); };
  const pref = designs.find((d) => d.id === preferred);
  if (pref && off(pref) <= 1.3) return pref;
  return [...designs].sort((a, b) => off(a) - off(b))[0] ?? pref;
}

export interface MotionInput {
  /** the static card, ideally rendered at motionLayout().card size */
  card: HTMLCanvasElement | HTMLImageElement | ImageBitmap | OffscreenCanvas;
  data: CardData;
  /** caption for the strip; when empty the strip shows the CTA / follow line (never repeats the card) */
  caption?: string;
}
export interface MotionOptions {
  preset: PresetId;
  duration: number;
  now?: number;
  /** draw safe-zone guides (preview only — never in exports) */
  guides?: SafeZoneId | null;
  seed?: number;
}

export class AnimCtx {
  constructor(readonly t: number, readonly T: number, readonly def: PresetDef) {}
  get f() { return this.T > 0 ? clamp01(this.t / this.T) : 1; }
  has(el: Element) { return !!this.def.tracks[el]; }
  p(el: Element, ease?: EaseName): number {
    const tr = this.def.tracks[el];
    if (!tr) return 1;
    const raw = tr[1] > tr[0] ? clamp01((this.f - tr[0]) / (tr[1] - tr[0])) : this.f >= tr[0] ? 1 : 0;
    return EASE[ease ?? tr[2] ?? 'linear'](raw);
  }
}

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
void COND; void parseNum;
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



let scratch: HTMLCanvasElement | OffscreenCanvas | null = null;
function scratchCtx(w: number, h: number) {
  if (!scratch) scratch = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : document.createElement('canvas');
  if (scratch.width !== w || scratch.height !== h) { scratch.width = w; scratch.height = h; }
  return scratch.getContext('2d') as C;
}

/** Background for the whole frame: dimmed, blurred cover copy of the card with an accent glow. */
function backdrop(c: C, card: CanvasImageSource & { width: number; height: number }, W: number, H: number, accent: string, f0: number) {
  c.fillStyle = '#05060b'; c.fillRect(0, 0, W, H);
  const s = Math.max(W / card.width, H / card.height) * (1.15 + 0.05 * f0);
  c.save(); c.filter = `blur(${Math.round(Math.min(W, H) / 22)}px) brightness(0.32) saturate(1.3)`;
  c.drawImage(card, (W - card.width * s) / 2, (H - card.height * s) / 2, card.width * s, card.height * s);
  c.restore();
  const g = c.createRadialGradient(W * 0.5, H, 0, W * 0.5, H, Math.max(W, H) * 0.7);
  g.addColorStop(0, accent + '33'); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
}

/** Draws the card into rect R with the preset's reveal choreography. */
function cardLayer(c: C, inp: MotionInput, R: { x: number; y: number; w: number; h: number }, a: AnimCtx, accent: string) {
  const card = inp.card as CanvasImageSource & { width: number; height: number };
  const def = a.def;
  // 1) card + Ken Burns into scratch at R size
  const w = Math.round(R.w), h = Math.round(R.h);
  const sc = scratchCtx(w, h);
  const kb = 1 + def.kenBurns * EASE.inOutCubic(a.f);
  const fit = Math.max(w / card.width, h / card.height) * kb;
  sc.clearRect(0, 0, w, h);
  sc.drawImage(card, (w - card.width * fit) / 2, (h - card.height * fit) / 2, card.width * fit, card.height * fit);
  const src = scratch as CanvasImageSource;
  let ox = 0, oy = 0;
  if (a.has('shake')) {
    const sp = a.p('shake');
    if (sp > 0 && sp < 1) { const amp = (1 - sp) ** 2 * Math.min(w, h) * 0.014; ox = Math.sin(a.t * 83) * amp; oy = Math.cos(a.t * 67) * amp; }
  }
  c.save();
  c.beginPath(); c.rect(R.x, R.y, R.w, R.h); c.clip();
  c.translate(R.x + ox, R.y + oy);
  const rp = a.p('reveal');
  if (def.reveal === 'flip') {
    const fp = a.p('flip');
    const sx = Math.max(0.001, fp);
    c.globalAlpha = clamp01(fp * 3);
    c.translate(w / 2, h / 2); c.scale(sx, 1 + 0.08 * (1 - clamp01(fp)));
    c.drawImage(src, -w / 2, -h / 2);
    c.restore();
    return;
  }
  if (def.reveal === 'punch') {
    const z = 1 + 0.35 * (1 - EASE.outQuint(rp));
    c.globalAlpha = clamp01(rp * 3);
    c.translate(w / 2, h / 2); c.scale(z, z); c.translate(-w / 2, -h / 2);
  }
  const n = def.bands, bh = h / n;
  for (let i = 0; i < n; i++) {
    const y0 = Math.floor(i * bh), y1 = Math.ceil((i + 1) * bh), hh = y1 - y0;
    const stagger = n > 1 ? 0.55 / (n - 1) : 0;
    const lp = clamp01((rp - i * stagger) / 0.45);
    if (lp <= 0) continue;
    const e = EASE.outCubic(lp);
    c.save();
    if (def.reveal === 'wipe') {
      c.beginPath(); c.rect(0, y0, w * e, hh); c.clip();
      c.drawImage(src, 0, y0, w, hh, 0, y0, w, hh);
      c.restore();
      if (lp < 1) { c.fillStyle = accent; c.fillRect(w * e - Math.max(2, w * 0.004), y0, Math.max(3, w * 0.006), hh); }
      continue;
    }
    if (def.reveal === 'rise') { c.globalAlpha = e; c.drawImage(src, 0, y0, w, hh, 0, y0 + (1 - e) * h * 0.04, w, hh); }
    else if (def.reveal === 'punch') { const ex = EASE.outQuint(lp); c.drawImage(src, 0, y0, w, hh, (i % 2 ? -1 : 1) * (1 - ex) * w * 0.6, y0, w, hh); }
    else if (def.reveal === 'slide') c.drawImage(src, 0, y0, w, hh, (1 - e) * w, y0, w, hh);
    else { c.globalAlpha = e; c.drawImage(src, 0, y0, w, hh, 0, y0, w, hh); }
    c.restore();
  }
  c.restore();
}

/** Strip text: wraps into the strip; word-by-word rise or typewriter. */
function stripText(c: C, b: Box, text: string, p: number, mode: 'word' | 'type', accent: string, center: boolean) {
  const words = text.trim().split(/\s+/).filter(Boolean).slice(0, 40);
  if (!words.length || p <= 0) return;
  let px = b.h * 0.34, lines: string[][] = [];
  for (let k = 0; k < 14; k++) {
    c.font = f(px, 800, SANS);
    lines = wrapWords(c, words, b.w);
    if (lines.length * px * 1.2 <= b.h * 0.86 && lines.every((l) => c.measureText(l.join(' ')).width <= b.w)) break;
    px *= 0.9;
  }
  const lh = px * 1.2, y0 = b.y + (b.h - lines.length * lh) / 2 + px * 0.92;
  const totalW = words.length, totalC = text.length;
  let wi = 0, ci = 0;
  c.textBaseline = 'alphabetic'; c.textAlign = 'left';
  lines.forEach((l, li) => {
    const lw = c.measureText(l.join(' ')).width;
    let x = center ? b.x + (b.w - lw) / 2 : b.x;
    const y = y0 + li * lh;
    for (const w of l) {
      const ww = c.measureText(w + ' ').width;
      if (mode === 'word') {
        const lp = clamp01(p * totalW * 1.1 - wi);
        if (lp > 0) { c.save(); c.globalAlpha = lp; c.fillStyle = '#fff'; c.fillText(w, x, y + (1 - EASE.outCubic(lp)) * px * 0.45); c.restore(); }
      } else {
        const shown = Math.floor(p * totalC * 1.05) - ci;
        if (shown > 0) { c.fillStyle = '#fff'; c.fillText(w.slice(0, shown), x, y); if (shown < w.length && Math.floor(p * 60) % 2 === 0) { c.fillStyle = accent; c.fillRect(x + c.measureText(w.slice(0, shown)).width + 2, y - px * 0.8, px * 0.08, px * 0.9); } }
        ci += w.length + 1;
      }
      x += ww; wi++;
    }
  });
}

function stripBg(c: C, b: Box, p: number, accent: string, vertical: boolean, red: boolean) {
  const e = EASE.outCubic(p);
  c.save();
  if (vertical) { rrect(c, b.x, b.y + (1 - e) * b.h * 0.3, b.w, b.h, b.h * 0.08); c.globalAlpha = e; }
  else { c.beginPath(); c.rect(b.x, b.y + (1 - e) * b.h, b.w, b.h); }
  c.fillStyle = red ? '#b3121f' : 'rgba(9,11,20,0.94)'; c.fill();
  c.restore();
  if (e > 0) { c.fillStyle = red ? '#ffffff' : accent; c.fillRect(b.x, b.y + (1 - e) * (vertical ? b.h * 0.3 : b.h), b.w * e, Math.max(3, b.h * 0.035)); }
}

function tag(c: C, x: number, y: number, h: number, label: string, bg: string, fg: string) {
  c.font = f(h * 0.56, 900, COND);
  const w = c.measureText(label).width + h * 0.7;
  c.fillStyle = bg; c.fillRect(x, y, w, h);
  c.fillStyle = fg; c.textBaseline = 'middle'; c.textAlign = 'left'; c.fillText(label, x + h * 0.35, y + h / 2 + h * 0.03);
  c.textBaseline = 'alphabetic';
  return w;
}

function clock(c: C, b: Box, target: number | undefined, now: number, p: number, accent: string) {
  if (!target || target <= now) { stripText(c, b, 'Countdown complete — follow live results', p, 'word', accent, true); return; }
  const left = target - now;
  const d = Math.floor(left / 864e5), h = Math.floor(left / 36e5) % 24, m = Math.floor(left / 6e4) % 60, s = Math.floor(left / 1e3) % 60;
  const parts: [string, string][] = [...(d ? [[String(d), 'DAYS'] as [string, string]] : []), [String(h).padStart(2, '0'), 'HRS'], [String(m).padStart(2, '0'), 'MIN'], [String(s).padStart(2, '0'), 'SEC']];
  const cw = b.w / parts.length, px = Math.min(b.h * 0.52, cw * 0.5);
  c.save(); c.globalAlpha = clamp01(p * 5);
  parts.forEach(([v, l], i) => {
    const cx = b.x + cw * (i + 0.5);
    c.textAlign = 'center';
    c.font = f(px, 800, DISP); c.fillStyle = l === 'SEC' ? accent : '#fff';
    const tick = l === 'SEC' ? 1 + 0.08 * Math.max(0, 1 - ((left % 1000) / 1000) * 4) : 1;
    c.save(); c.translate(cx, b.y + b.h * 0.58); c.scale(tick, tick); c.fillText(v, 0, 0); c.restore();
    c.font = f(px * 0.24, 700); c.fillStyle = 'rgba(232,235,245,0.7)'; c.fillText(l, cx, b.y + b.h * 0.86);
    if (i) { c.fillStyle = 'rgba(255,255,255,0.15)'; c.fillRect(b.x + cw * i, b.y + b.h * 0.2, 2, b.h * 0.6); }
  });
  c.restore(); c.textAlign = 'left';
}

export function drawGuides(c: C, W: number, H: number, z: SafeZoneId) {
  const s = SAFE_ZONES[z];
  c.save();
  c.fillStyle = 'rgba(255,0,90,0.16)';
  c.fillRect(0, 0, W, H * s.top); c.fillRect(0, H * (1 - s.bottom), W, H * s.bottom);
  c.fillRect(W * (1 - s.right), H * s.top, W * s.right, H * (1 - s.top - s.bottom));
  c.fillRect(0, H * s.top, W * s.left, H * (1 - s.top - s.bottom));
  c.setLineDash([14, 10]); c.strokeStyle = 'rgba(255,0,90,0.9)'; c.lineWidth = 3;
  c.strokeRect(W * s.left, H * s.top, W * (1 - s.left - s.right), H * (1 - s.top - s.bottom));
  c.font = f(Math.min(W, H) * 0.028, 700); c.fillStyle = '#fff'; c.fillText(`${s.label} safe zone`, W * s.left + 10, H * s.top + Math.min(W, H) * 0.04);
  c.restore();
}

/** Renders frame at time `t` seconds into `c`. Deterministic in (input, opts, t). */
export function renderMotionFrame(c: C, inp: MotionInput, opts: MotionOptions, t: number) {
  const W = c.canvas.width, H = c.canvas.height;
  const def = presetById(opts.preset);
  const a = new AnimCtx(t, Math.max(0.5, opts.duration), def);
  const d = inp.data, accent = accentOf(d);
  const vertical = H > W * 1.3;
  const L = motionLayout(W, H);
  const card = inp.card as CanvasImageSource & { width: number; height: number };
  c.save();
  c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  backdrop(c, card, W, H, accent, a.f);
  cardLayer(c, inp, L.card, a, accent);
  if (def.id === 'kinetic') {
    const dim = 0.78 * (1 - a.p('undim'));
    if (dim > 0) {
      c.fillStyle = `rgba(4,5,10,${dim * clamp01(a.p('reveal') * 2)})`; c.fillRect(L.card.x, L.card.y, L.card.w, L.card.h);
      const q = (d.title ?? '').trim();
      c.save(); c.globalAlpha = 1 - a.p('undim');
      kineticEl(c, { x: L.card.x + L.card.w * 0.07, y: L.card.y, w: L.card.w * 0.86, h: L.card.h }, q, a.p('kinetic'), Math.min(L.card.w, L.card.h) / 14, accent);
      c.restore();
    }
  }
  for (const bt of def.bursts ?? []) confetti(c, W, H, t - bt * a.T, (opts.seed ?? 7) + Math.round(bt * 100), [accent, '#ffffff', '#ffd400', '#3b82f6', '#ef4444']);

  // reserved strip — the only place motion adds text
  const S = L.strip, sp = a.p('strip');
  if (sp > 0) {
    const red = def.id === 'breaking';
    stripBg(c, S, sp, accent, vertical, red);
    const pad = Math.min(S.h * 0.22, S.w * 0.04);
    let inner: Box = { x: S.x + pad, y: S.y + pad * 0.6, w: S.w - pad * 2, h: S.h - pad * 1.2 };
    const follow = (d.cta?.trim() || `Follow live · ${(d.url ?? 'poltok.netlify.app').replace(/^https?:\/\//, '')}`);
    const cap = inp.caption?.trim() || '';
    if (red) {
      const th = Math.min(inner.h * 0.5, S.h * 0.42);
      const tw = tag(c, inner.x, inner.y + (inner.h - th) / 2, th, 'BREAKING', '#ffffff', '#b3121f');
      inner = { ...inner, x: inner.x + tw + pad, w: inner.w - tw - pad };
      const tp = a.p('ticker');
      if (tp > 0 && cap) {
        c.save(); c.beginPath(); c.rect(inner.x, S.y, inner.w + pad, S.h); c.clip();
        c.font = f(inner.h * 0.36, 800); c.fillStyle = '#fff'; c.textBaseline = 'middle';
        const seg = `${cap}   •   ${follow}   •   `, sw = c.measureText(seg).width || 1;
        let x = inner.x + inner.w * (1 - clamp01(tp * 8)) - ((tp * a.T * inner.h * 2.2) % sw);
        while (x < inner.x + inner.w + pad) { c.fillText(seg, x, inner.y + inner.h / 2); x += sw; }
        c.restore(); c.textBaseline = 'alphabetic';
      } else stripText(c, inner, cap || follow, a.p('caption'), 'type', '#fff', false);
    } else if (def.strip === 'countdown') {
      clock(c, inner, d.countdownTo, (opts.now ?? Date.now()) + t * 1000, a.p('countdown'), accent);
    } else if (def.strip === 'by') {
      const by = d.quoteBy?.trim();
      stripText(c, inner, cap || (by ? `— ${by}` : follow), a.p('caption'), 'type', accent, true);
    } else {
      stripText(c, inner, cap || follow, a.p('caption'), 'word', accent, vertical || !cap);
    }
  }
  if (opts.guides) drawGuides(c, W, H, opts.guides);
  c.restore();
}
