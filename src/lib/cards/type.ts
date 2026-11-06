/**
 * Typographic design system for cards: modular scale, baseline grid, size-aware margins,
 * optical tracking for display sizes, balanced line breaking (no orphans) and tabular figures.
 *
 *   const g = grid(k);                 // margins, baseline, columns for this canvas size
 *   const px = g.ts(4);                // step 4 on the modular scale
 *   const b = balanced(ctx, text, w, { px, family: 'Fraunces', weight: 700, maxLines: 3 });
 */
import type { Ctx, K } from './kit';
import { RT } from './kit';

/** Font stacks for the premium families (loaded on demand through ensureFont). */
export const FF = {
  tight: `'Inter Tight', Inter, system-ui, sans-serif`,
  fraunces: `Fraunces, 'Playfair Display', Georgia, serif`,
  instrument: `'Instrument Serif', 'DM Serif Display', 'Playfair Display', Georgia, serif`,
  bricolage: `'Bricolage Grotesque', 'Space Grotesk', Inter, sans-serif`,
  archivo: `'Archivo Black', 'Arial Black', Impact, sans-serif`,
  plex: `'IBM Plex Mono', 'JetBrains Mono', ui-monospace, monospace`,
  anton: `Anton, Oswald, Impact, sans-serif`,
  inter: `Inter, system-ui, sans-serif`,
} as const;
export type FFam = keyof typeof FF;
/** Google Font names each family needs (passed to ensureFont). */
export const FF_LOAD: Record<FFam, string | null> = {
  tight: 'Inter Tight', fraunces: 'Fraunces', instrument: 'Instrument Serif', bricolage: 'Bricolage Grotesque',
  archivo: 'Archivo Black', plex: 'IBM Plex Mono', anton: 'Anton', inter: null,
};
const DISPLAY: FFam[] = ['fraunces', 'instrument', 'bricolage', 'archivo', 'anton', 'tight'];

/** CSS font string; style-level display/body overrides still win (RT). */
export function ff(fam: FFam, px: number, weight: number | string = 400, italic = false): string {
  let stack: string = FF[fam];
  if (RT.display && DISPLAY.includes(fam)) stack = `'${RT.display}', ${stack}`;
  else if (RT.body && (fam === 'inter' || fam === 'tight')) stack = `'${RT.body}', ${stack}`;
  return `${italic ? 'italic ' : ''}${weight} ${Math.max(1, Math.round(px))}px ${stack}`;
}

/** Optical tracking (em): big display text is tightened, small caps opened up. */
export function opticalTracking(px: number, caps = false): number {
  if (caps) return px < 24 ? 0.14 : px < 48 ? 0.1 : 0.04;
  if (px >= 160) return -0.035;
  if (px >= 96) return -0.025;
  if (px >= 56) return -0.015;
  if (px >= 28) return -0.005;
  return 0.005;
}
type LS = Ctx & { letterSpacing?: string; fontKerning?: string; textRendering?: string };
export function track(ctx: Ctx, px: number, em: number) {
  const c = ctx as LS;
  if ('letterSpacing' in c) c.letterSpacing = `${(px * em).toFixed(2)}px`;
  if ('fontKerning' in c) c.fontKerning = 'normal';
  if ('textRendering' in c) c.textRendering = 'optimizeLegibility';
}
export const untrack = (ctx: Ctx) => track(ctx, 0, 0);

export interface Grid {
  W: number; H: number;
  /** outer margin */
  m: number;
  /** baseline unit */
  bl: number;
  /** content box */
  x: number; y: number; w: number; h: number;
  /** gutter */
  g: number;
  cols: number;
  /** column x for column index (0..cols) */
  col: (i: number) => number;
  /** modular scale step (1.25 major third on a size-aware base) */
  ts: (step: number) => number;
  /** snap y to the baseline grid */
  snap: (y: number) => number;
  portrait: boolean; wide: boolean; tall: boolean;
}

/** Size-aware grid: margins are consistent per size class, base type follows the short side. */
export function grid(k: Pick<K, 'W' | 'H'>, opts: { ratio?: number; margin?: number; cols?: number } = {}): Grid {
  const { W, H } = k;
  const short = Math.min(W, H);
  const ar = W / H;
  const wide = ar > 1.6, tall = ar < 0.7, portrait = ar < 0.95;
  const m = Math.round(short * (opts.margin ?? (wide ? 0.07 : tall ? 0.075 : 0.074)));
  const bl = Math.max(4, Math.round(short / 135));
  const base = short * (wide ? 0.03 : 0.026);
  const ratio = opts.ratio ?? 1.25;
  const cols = opts.cols ?? (wide ? 12 : 6);
  const x = m, y = m, w = W - m * 2, h = H - m * 2;
  const g = Math.round(m * 0.35);
  const cw = (w - g * (cols - 1)) / cols;
  return {
    W, H, m, bl, x, y, w, h, g, cols, portrait, wide, tall,
    col: (i: number) => x + i * (cw + g),
    ts: (step: number) => base * Math.pow(ratio, step),
    snap: (v: number) => Math.round(v / bl) * bl,
  };
}

/* ───────── line breaking ───────── */

function greedy(ctx: Ctx, words: string[], maxW: number): string[] {
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (!cur || ctx.measureText(t).width <= maxW) cur = t;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Balanced wrap: same line count as greedy but the narrowest width that keeps it; never leaves a one-word last line when avoidable. */
export function balanceLines(ctx: Ctx, text: string, maxW: number): string[] {
  const words = String(text ?? '').split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const g = greedy(ctx, words, maxW);
  if (g.length < 2) return g;
  let lo = maxW * 0.4, hi = maxW, best = g;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    const t = greedy(ctx, words, mid);
    if (t.length <= g.length && Math.max(...t.map((l) => ctx.measureText(l).width)) <= mid + 0.5) { best = t; hi = mid; } else lo = mid;
  }
  // orphan control: pull a word down if the last line is a single short word
  const last = best[best.length - 1];
  if (best.length >= 2 && !last.includes(' ')) {
    const prev = best[best.length - 2].split(' ');
    if (prev.length > 2) {
      const moved = prev.pop()!;
      const nl = moved + ' ' + last;
      if (ctx.measureText(nl).width <= maxW) { best = [...best.slice(0, -2), prev.join(' '), nl]; }
    }
  }
  return best;
}

export interface Block { lines: string[]; px: number; lh: number; font: string; tracking: number; width: number; height: number }

/** Largest size ≤ maxPx whose balanced lines fit the box. */
export function balanced(ctx: Ctx, text: string, maxW: number, maxH: number, o: { maxPx: number; minPx?: number; fam: FFam; weight?: number | string; italic?: boolean; lh?: number; maxLines?: number; upper?: boolean; tracking?: number }): Block {
  const t = o.upper ? String(text ?? '').toUpperCase() : String(text ?? '');
  const min = o.minPx ?? Math.max(12, o.maxPx * 0.25);
  const lhf = o.lh ?? 1.05;
  let px = o.maxPx;
  let lines: string[] = [];
  let f = '';
  let trk = 0;
  for (; px >= min; px -= Math.max(1, px * 0.04)) {
    f = ff(o.fam, px, o.weight ?? 700, o.italic);
    ctx.font = f;
    trk = o.tracking ?? opticalTracking(px, o.upper);
    track(ctx, px, trk);
    lines = balanceLines(ctx, t, maxW);
    const longest = Math.max(0, ...lines.map((l) => ctx.measureText(l).width));
    if (lines.length <= (o.maxLines ?? 5) && lines.length * px * lhf <= maxH && longest <= maxW) break;
  }
  px = Math.max(px, min);
  f = ff(o.fam, px, o.weight ?? 700, o.italic);
  ctx.font = f;
  track(ctx, px, trk);
  lines = balanceLines(ctx, t, maxW);
  const maxL = o.maxLines ?? 5;
  if (lines.length > maxL) {
    lines = lines.slice(0, maxL);
    let l = lines[maxL - 1];
    while (l.length > 1 && ctx.measureText(l + '…').width > maxW) l = l.slice(0, -1);
    lines[maxL - 1] = l.trimEnd() + '…';
  }
  const width = Math.max(0, ...lines.map((l) => ctx.measureText(l).width));
  untrack(ctx);
  return { lines, px, lh: px * lhf, font: f, tracking: trk, width, height: lines.length * px * lhf };
}

/** Draws a block with its top at y (first baseline = y + cap height). Returns bottom y. */
export function drawBlock(ctx: Ctx, b: Block, x: number, y: number, color: string, align: CanvasTextAlign = 'left', opts: { shadow?: string; stroke?: { color: string; width: number } } = {}): number {
  if (RT.align && align === 'left') align = RT.align;
  ctx.save();
  ctx.font = b.font;
  track(ctx, b.px, b.tracking);
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  if (opts.shadow) { ctx.shadowColor = opts.shadow; ctx.shadowBlur = b.px * 0.25; ctx.shadowOffsetY = b.px * 0.04; }
  b.lines.forEach((l, i) => {
    const by = y + b.px * 0.8 + i * b.lh;
    if (opts.stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = opts.stroke.width; ctx.strokeStyle = opts.stroke.color; ctx.strokeText(l, x, by); }
    ctx.fillStyle = color;
    ctx.fillText(l, x, by);
  });
  ctx.restore();
  return y + b.height;
}

/** Single tracked line (caps by default). Returns its width. */
export function label(ctx: Ctx, t: string, x: number, y: number, fam: FFam, px: number, color: string, o: { weight?: number | string; upper?: boolean; tracking?: number; align?: CanvasTextAlign; maxW?: number; italic?: boolean } = {}): number {
  const up = o.upper ?? true;
  let s = up ? String(t ?? '').toUpperCase() : String(t ?? '');
  ctx.save();
  ctx.font = ff(fam, px, o.weight ?? 600, o.italic);
  track(ctx, px, o.tracking ?? opticalTracking(px, up));
  if (o.maxW) { while (s.length > 1 && ctx.measureText(s).width > o.maxW) s = s.slice(0, -2) + '…'; }
  ctx.fillStyle = color;
  ctx.textAlign = o.align ?? 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(s, x, y);
  const w = ctx.measureText(s).width;
  ctx.restore();
  return w;
}

/* ───────── numbers ───────── */

/** Typographic number formatting: thousands separators, true minus, trimmed decimals. */
export function fmtNum(v: number | string, o: { dp?: number; pct?: boolean; sign?: boolean } = {}): string {
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.+-]/g, ''));
  if (!Number.isFinite(n)) return String(v ?? '—');
  const dp = o.dp ?? (Math.abs(n) < 10 && n % 1 ? 1 : n % 1 ? 1 : 0);
  const s = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  const sign = n < 0 ? '−' : o.sign && n > 0 ? '+' : '';
  return `${sign}${s}${o.pct ? '%' : ''}`;
}

/** Draws digits in fixed-width cells (tabular figures) so columns of numbers align. Returns width. */
export function tabular(ctx: Ctx, s: string, x: number, y: number, font: string, color: string, align: 'left' | 'right' | 'center' = 'left', trackEm = 0): number {
  ctx.save();
  ctx.font = font;
  untrack(ctx);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const px = parseFloat(/(\d+)px/.exec(font)?.[1] ?? '16');
  const dw = Math.max(...'0123456789'.split('').map((d) => ctx.measureText(d).width));
  const extra = px * trackEm;
  const ws = [...s].map((c) => (/\d/.test(c) ? dw : ctx.measureText(c).width) + extra);
  const total = ws.reduce((a, b) => a + b, 0) - extra;
  let cx = align === 'right' ? x - total : align === 'center' ? x - total / 2 : x;
  ctx.fillStyle = color;
  [...s].forEach((c, i) => {
    const cw = ws[i] - extra;
    const gw = ctx.measureText(c).width;
    ctx.fillText(c, cx + (/\d/.test(c) ? (cw - gw) / 2 : 0), y);
    cx += ws[i];
  });
  ctx.restore();
  return total;
}

/** Fits a single tabular number to maxW, returns px. */
export function fitNum(ctx: Ctx, s: string, maxW: number, maxPx: number, fam: FFam, weight: number | string = 800): number {
  let px = maxPx;
  ctx.save();
  for (; px > 10; px -= Math.max(1, px * 0.04)) {
    ctx.font = ff(fam, px, weight);
    const dw = Math.max(...'0123456789'.split('').map((d) => ctx.measureText(d).width));
    const w = [...s].reduce((a, c) => a + (/\d/.test(c) ? dw : ctx.measureText(c).width), 0);
    if (w <= maxW) break;
  }
  ctx.restore();
  return px;
}
