/** Reusable content blocks shared by several designs. */
import type { CardDesign, CardKind } from './types';
import { RT, type Fam, type K, caps, ellipsize, inkOn, fit, font, rowsOf, rr, text, rgba, stackBar } from './kit';

export interface Design extends CardDesign {
  draw: (k: K) => void;
  /** design renders d.cta itself (skip the generic CTA overlay) */
  drawsCta?: boolean;
  /** layout is fully relative: always reflow to other sizes */
  fluid?: boolean;
  /** Google Fonts this design needs (loaded on demand) */
  fonts?: string[];
  /** design paints CardStyle.background itself (not composited under it) */
  ownBg?: boolean;
}

export const ALL: CardKind[] = ['race', 'balance', 'au-seat', 'promo', 'stat', 'flip', 'quote', 'candidate', 'custom'];
export const X = { w: 1200, h: 675 };
export const SQ = { w: 1080, h: 1080 };
export const PT = { w: 1080, h: 1350 };
export const ST = { w: 1080, h: 1920 };

/** The single most important number on a card. */
export function hero(k: K): { value: string; label: string; color: string } {
  const d = k.d;
  const s0 = d.stats?.[0];
  if (d.kind === 'balance' && d.stats && d.stats.length >= 2) return { value: `${d.stats[0].value}–${d.stats[1].value}`, label: 'Dem – Rep seats', color: k.accent };
  if (d.kind === 'au-seat') return { value: s0?.value ?? '—', label: 'margin (2PP)', color: k.accent };
  if (!s0) return { value: '', label: '', color: k.accent };
  return { value: s0.value, label: s0.label, color: s0.color ?? k.accent };
}

export interface ListStyle {
  fam?: Fam;
  valueFam?: Fam;
  labelColor?: string;
  valueColor?: string;
  track?: string;
  barH?: number;
  rowGap?: number;
  maxRows?: number;
  radius?: number;
  upper?: boolean;
  swatch?: boolean;
  bars?: boolean;
}

/** Label / value rows with optional bars, fitted in a box. */
export function resultList(k: K, x: number, y: number, w: number, h: number, st: ListStyle = {}) {
  const { ctx } = k;
  const rows = rowsOf(k, st.maxRows ?? 4);
  if (!rows.length) return;
  const showBars = st.bars ?? (k.d.kind === 'race' || k.d.kind === 'flip' || k.d.kind === 'au-seat');
  const n = rows.length;
  const gap = st.rowGap ?? h * 0.06;
  const rowH = Math.min((h - gap * (n - 1)) / n, k.s * 150);
  const barH = showBars ? (st.barH ?? Math.max(6, rowH * 0.14)) : 0;
  const fs = Math.min(rowH * (showBars ? 0.36 : 0.46), k.s * 52);
  const vfs = Math.min(rowH * (showBars ? 0.56 : 0.66), k.s * 84);
  const max = Math.max(100, ...rows.map((r) => r.num));
  rows.forEach((r, i) => {
    const ry = y + i * (rowH + gap);
    const base = ry + rowH - barH - (showBars ? rowH * 0.14 : rowH * 0.22);
    ctx.font = font(st.valueFam ?? st.fam ?? 'display', vfs, 700);
    const vw = ctx.measureText(r.value).width;
    let lx = x;
    if (st.swatch) { ctx.fillStyle = r.color; rr(ctx, x, base - fs * 0.78, fs * 0.5, fs * 0.82, 3); ctx.fill(); lx += fs * 0.85; }
    ctx.font = font(st.fam ?? 'sans', fs, 700);
    ctx.fillStyle = st.labelColor ?? '#fff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const label = st.upper ? r.label.toUpperCase() : r.label;
    ctx.fillText(ellipsize(ctx, label, w - vw - (lx - x) - fs), lx, base);
    text(ctx, r.value, x + w, base, font(st.valueFam ?? st.fam ?? 'display', vfs, 700), st.valueColor ?? r.color, 'right');
    if (showBars) {
      const by = ry + rowH - barH;
      rr(ctx, x, by, w, barH, st.radius ?? barH / 2);
      ctx.fillStyle = st.track ?? 'rgba(255,255,255,0.1)';
      ctx.fill();
      if (r.num > 0) {
        rr(ctx, x, by, Math.max(barH, (w * r.num) / max), barH, st.radius ?? barH / 2);
        ctx.fillStyle = r.color;
        ctx.fill();
      }
    }
  });
}

/** Balance-of-power block: big D / R numbers + stacked bar with majority tick. */
export function balanceBlock(k: K, x: number, y: number, w: number, h: number, st: { fam?: Fam; color?: string; muted?: string; track?: string; radius?: number } = {}) {
  const { ctx, d } = k;
  const s = d.stats ?? [];
  const dem = s[0], rep = s[1];
  const big = Math.min(h * 0.5, w * 0.2);
  if (dem && rep) {
    text(ctx, dem.value, x, y + big * 0.85, font(st.fam ?? 'display', big, 700), dem.color ?? '#3d7bff');
    text(ctx, rep.value, x + w, y + big * 0.85, font(st.fam ?? 'display', big, 700), rep.color ?? '#ff3d55', 'right');
    caps(ctx, 'Democrats', x, y + big * 0.85 + big * 0.28, font('sans', big * 0.15, 800), st.muted ?? 'rgba(255,255,255,0.7)', 0.1);
    caps(ctx, 'Republicans', x + w, y + big * 0.85 + big * 0.28, font('sans', big * 0.15, 800), st.muted ?? 'rgba(255,255,255,0.7)', 0.1, 'right');
    if (s[2]) caps(ctx, `${s[2].value} undecided`, x + w / 2, y + big * 0.55, font('sans', big * 0.15, 800), st.muted ?? 'rgba(255,255,255,0.7)', 0.1, 'center');
  }
  const by = y + big * 1.35, bh = Math.min(h - big * 1.35 - big * 0.3, big * 0.42);
  if (d.bars?.length) {
    stackBar(ctx, d, x, by, w, bh, st.radius ?? 0, st.track ?? 'rgba(255,255,255,0.1)');
    const maj = parseInt(s[3]?.value ?? '', 10), tot = d.bars.reduce((a, b) => a + b.value, 0);
    if (maj && tot) {
      const mx = x + (w * maj) / tot;
      ctx.fillStyle = st.color ?? '#fff';
      ctx.fillRect(mx - 2, by - bh * 0.25, 4, bh * 1.5);
      text(ctx, `${maj} for control`, mx, by + bh * 1.25 + big * 0.16, font('sans', big * 0.14, 700), st.color ?? '#fff', 'center');
    }
  } else {
    text(ctx, 'Awaiting results', x, by + bh / 2, font('sans', big * 0.2, 600), st.muted ?? '#999');
  }
}

/** Kicker pill. */
export function tag(k: K, t: string, x: number, y: number, px: number, bg: string, fg: string, fam: Fam = 'sans', radius = 999) {
  const { ctx } = k;
  ctx.font = font(fam, px, 800);
  const w = ctx.measureText(t.toUpperCase()).width + px * 1.6 + t.length * px * 0.08;
  rr(ctx, x, y, w, px * 1.9, radius === 999 ? px : radius);
  ctx.fillStyle = bg;
  ctx.fill();
  // translucent pills sit on the design background; solid ones get auto-contrast ink
  const solid = !/rgba\(/.test(bg);
  caps(ctx, t, x + px * 0.8, y + px * 1.32, font(fam, px, 800), solid ? inkOn(k, bg, fg) : fg, 0.08);
  return w;
}

/** Fits a single-line headline. */
export function headline(k: K, t: string, x: number, y: number, maxW: number, px: number, fam: Fam, color: string, weight: number | string = 800, align: CanvasTextAlign = 'left', italic = false) {
  const { ctx } = k;
  if (RT.align && align === 'left' && RT.align !== 'left') { x = RT.align === 'center' ? x + maxW / 2 : x + maxW; align = RT.align; }
  fit(ctx, t, maxW, px, fam, weight, 14, italic);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(t, x, y);
}

export const glass = (k: K, x: number, y: number, w: number, h: number, r: number, a = 0.1) => {
  const { ctx } = k;
  rr(ctx, x, y, w, h, r);
  ctx.fillStyle = `rgba(255,255,255,${a})`;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 2;
  ctx.stroke();
};

export { rgba };
