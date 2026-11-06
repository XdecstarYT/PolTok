/**
 * Creative v2 — 20 premium templates built on the design system (type.ts), procedural
 * backgrounds (bg.ts), geography art (geo.ts) and data-viz primitives (viz.ts).
 * Every layout is fluid (relative to the grid), so reflowing to any size stays composed.
 * These designs resolve the style palette themselves and draw on the raw context.
 */
import type { CardKind } from './types';
import { MESSAGE_KINDS } from './types';
import { type Design, X, SQ, PT, ST, hero } from './common';
import { type Ctx, type K, contrast, hexToRgb, mix, rgba, rr, rowsOf, wordmark, loadImage } from './kit';
import { initials } from '../format';
import { type Background, drawBackground, filmGrain, prng } from './bg';
import { type Grid, type FFam, grid, ff, balanced, drawBlock, label, tabular, fitNum, track, untrack } from './type';
import { silhouette, usChoropleth, hexMap, regionPath } from './geo';
import { hBars, needle, waffle, seatArc, sparkArea, swingArrow, type BarRow } from './viz';
void loadImage;

const DATA: CardKind[] = ['race', 'flip', 'au-seat', 'balance', 'stat', 'candidate', 'promo', 'custom'];
const ALLK: CardKind[] = [...DATA, 'quote', ...MESSAGE_KINDS];
const VOICE: CardKind[] = ['quote', 'custom', 'promo', ...MESSAGE_KINDS];
const HEXRE = /^#[0-9a-f]{6}$/i;

/* ───────── palette + content ───────── */

interface Pal { bg: string; fg: string; muted: string; faint: string; accent: string; line: string; party: (c: string) => string }
function pal(k: K, def: { bg: string; fg: string; accent?: string }): Pal {
  const p = k.st?.palette ?? {};
  const bg = p.bg && HEXRE.test(p.bg) ? p.bg : def.bg;
  let fg = p.fg && HEXRE.test(p.fg) ? p.fg : def.fg;
  if (contrast(fg, bg) < 4.5) fg = contrast('#ffffff', bg) > contrast('#0b0d14', bg) ? '#ffffff' : '#0b0d14';
  let accent = p.accent && HEXRE.test(p.accent) ? p.accent : def.accent ?? (HEXRE.test(k.accent) ? k.accent : '#c6ff3d');
  for (let t = 0.15; contrast(accent, bg) < 3 && t <= 1; t += 0.15) accent = mix(accent, fg, t);
  return { bg, fg, accent, muted: mix(fg, bg, 0.32), faint: mix(fg, bg, 0.78), line: mix(fg, bg, 0.65), party: (c: string) => (k.map && HEXRE.test(c) ? k.map(c).replace(/^rgba?\(.*\)$/, c) : c) };
}
/** Paints the style background (if any) or the design default, with palette overrides. */
function paint(k: K, P: Pal, def: Background) {
  const c = k.raw ?? k.ctx;
  const spec = k.st?.background ?? { ...def, colors: [P.bg, ...(def.colors ?? []).slice(1).map((x, i) => (i === 0 && k.st?.palette?.accent ? P.accent : x))] };
  drawBackground(c, k.W, k.H, spec);
}
const plain = (s?: string) => String(s ?? '').replace(/\*/g, '').trim();
const isMsg = (k: K) => (MESSAGE_KINDS as string[]).includes(k.d.kind) || k.d.kind === 'quote' || k.d.kind === 'brand';
function rows(k: K, P: Pal, n = 4): BarRow[] { return rowsOf(k, n).map((r) => ({ ...r, color: P.party(r.color) })); }
const kicker = (k: K) => (k.d.kind === 'flip' ? 'Seat flip' : k.kicker);
function dateline(k: K) { return k.stamp; }

/** Footer: source · time (left), wordmark (right), with a hairline above. */
function footer(k: K, g: Grid, P: Pal, o: { rule?: boolean; fam?: FFam; y?: number; center?: boolean } = {}) {
  const c = k.raw ?? k.ctx;
  const px = Math.max(11, g.ts(-1.6));
  const y = o.y ?? g.H - g.m * 0.62;
  if (o.rule !== false) { c.fillStyle = P.line; c.fillRect(g.x, y - px * 2.3, g.w, Math.max(1, g.bl * 0.18)); }
  if (o.center) { wordmark(c, g.W / 2, y, px * 1.5, { color: P.fg, accent: P.accent, align: 'center' }); return; }
  const wm = wordmark(c, g.x + g.w, y, px * 1.5, { color: P.fg, accent: P.accent, align: 'right' });
  label(c, `${k.attr}  ·  ${dateline(k)}`, g.x, y - px * 0.1, o.fam ?? 'tight', px, P.muted, { upper: false, weight: 500, tracking: 0.01, maxW: g.w - wm - px * 2 });
}

/** Best visualization for the data in a box. */
function dataViz(k: K, P: Pal, x: number, y: number, w: number, h: number, o: { fam?: FFam; numFam?: FFam; track?: string } = {}) {
  const c = k.raw ?? k.ctx;
  const d = k.d;
  const track = o.track ?? rgba(P.fg.startsWith('#') ? P.fg : '#ffffff', 0.1);
  if (h < 30 || w < 60) return;
  if (d.kind === 'balance' && d.stats && d.stats.length >= 2) {
    const dem = parseInt(d.stats[0].value, 10) || 0, rep = parseInt(d.stats[1].value, 10) || 0, und = parseInt(d.stats[2]?.value ?? '', 10) || 0;
    const R = Math.min(w / 2, h * 0.82);
    const cx = x + w / 2, cy = y + R;
    seatArc(c, cx, cy, R, [{ n: dem, color: P.party(d.stats[0].color ?? '#3d7bff') }, { n: und, color: P.faint }, { n: rep, color: P.party(d.stats[1].color ?? '#ff3d55') }]);
    const npx = R * 0.34;
    tabular(c, `${dem}`, cx - R * 0.08, cy - R * 0.02, ff(o.numFam ?? 'tight', npx, 800), P.party(d.stats[0].color ?? '#3d7bff'), 'right');
    tabular(c, `${rep}`, cx + R * 0.08, cy - R * 0.02, ff(o.numFam ?? 'tight', npx, 800), P.party(d.stats[1].color ?? '#ff3d55'), 'left');
    const maj = d.stats[3]?.value;
    if (maj) label(c, `${maj} for control`, cx, cy + R * 0.16, o.fam ?? 'tight', Math.max(11, R * 0.075), P.muted, { align: 'center' });
    return;
  }
  if (d.series?.some((s) => s.points.length >= 2)) {
    const lp = Math.max(11, h * 0.06);
    let lx = x;
    d.series.slice(0, 4).forEach((s) => { c.fillStyle = P.party(s.color); c.fillRect(lx, y + lp * 0.1, lp * 0.9, lp * 0.9); lx += lp * 1.3 + label(c, s.label, lx + lp * 1.3, y + lp, o.fam ?? 'tight', lp, P.muted, { upper: false, weight: 600 }) + lp * 1.2; });
    sparkArea(c, d.series.map((s) => ({ ...s, color: P.party(s.color) })), x, y + lp * 2.2, w, h - lp * 2.2, { fg: P.fg, grid: rgba(P.fg.startsWith('#') ? P.fg : '#ffffff', 0.08), labels: true, fam: o.numFam });
    return;
  }
  const r = rows(k, P, 4);
  if (!r.length) return;
  const numeric = r.filter((x) => /\d/.test(x.value) && x.value.length <= 8);
  if (d.bars?.length || (numeric.length === r.length && d.kind !== 'candidate')) {
    hBars(c, r, x, y, w, h, { fam: o.fam, numFam: o.numFam, fg: P.fg, muted: P.muted, track, max: d.kind === 'race' || d.kind === 'flip' ? 100 : undefined });
    return;
  }
  // stat grid
  const n = Math.min(r.length, 3);
  const cw = w / n;
  r.slice(0, n).forEach((s, i) => {
    const vx = x + i * cw;
    const vp = fitNum(c, s.value, cw * 0.9, Math.min(h * 0.5, cw * 0.4), o.numFam ?? 'tight', 800);
    tabular(c, s.value, vx, y + vp * 0.9, ff(o.numFam ?? 'tight', vp, 800), i === 0 ? P.accent : P.fg);
    label(c, s.label, vx, y + vp * 0.9 + Math.max(12, vp * 0.3), o.fam ?? 'tight', Math.max(11, vp * 0.2), P.muted, { maxW: cw * 0.9 });
  });
}

/** Headline block helper: returns bottom y. */
function head(k: K, P: Pal, t: string, x: number, y: number, w: number, h: number, o: { fam: FFam; max: number; weight?: number | string; italic?: boolean; upper?: boolean; lh?: number; color?: string; align?: CanvasTextAlign; maxLines?: number; shadow?: string; stroke?: { color: string; width: number } }) {
  const c = k.raw ?? k.ctx;
  const b = balanced(c, t, w, h, { maxPx: o.max, fam: o.fam, weight: o.weight ?? 700, italic: o.italic, upper: o.upper, lh: o.lh ?? 1.02, maxLines: o.maxLines ?? 4 });
  const ax = o.align === 'center' ? x + w / 2 : o.align === 'right' ? x + w : x;
  return { bottom: drawBlock(c, b, ax, y, o.color ?? P.fg, o.align ?? 'left', { shadow: o.shadow, stroke: o.stroke }), b };
}

/* ───────── 1. Editorial front page ───────── */
const frontPage: Design = {
  id: 'front-page', name: 'Editorial front page', kinds: ALLK, size: PT, isNew: true, premium: true, fluid: true, ownBg: true, fonts: ['Fraunces', 'Inter Tight'],
  draw(k) {
    const g = grid(k, { margin: 0.06 }), c = k.raw!;
    const P = pal(k, { bg: '#f3efe6', fg: '#141210', accent: '#b3261e' });
    paint(k, P, { type: 'paper', seed: 11, colors: [P.bg, P.accent, '#000000'], intensity: 0.5 });
    // masthead
    let y = g.y;
    const mp = Math.min(g.w * 0.105, g.h * 0.075);
    c.font = ff('fraunces', mp, 900); track(c, mp, -0.02);
    c.fillStyle = P.fg; c.textAlign = 'center'; c.fillText('The PolTok Daily', g.W / 2, y + mp * 0.85); untrack(c);
    y += mp * 1.15;
    c.fillStyle = P.fg; c.fillRect(g.x, y, g.w, Math.max(2, g.bl * 0.5)); c.fillRect(g.x, y + g.bl * 0.9, g.w, Math.max(1, g.bl * 0.15));
    const dp = Math.max(11, g.ts(-1.5));
    y += g.bl * 0.9 + dp * 1.7;
    label(c, kicker(k), g.x, y, 'tight', dp, P.accent, { weight: 800 });
    label(c, dateline(k), g.x + g.w / 2, y, 'tight', dp, P.muted, { align: 'center', weight: 600 });
    label(c, 'Late edition', g.x + g.w, y, 'tight', dp, P.muted, { align: 'right', weight: 600 });
    y += dp * 0.9;
    c.fillStyle = P.line; c.fillRect(g.x, y, g.w, Math.max(1, g.bl * 0.15));
    y += g.bl * 3;
    const hasData = !isMsg(k) && (rows(k, P).length > 0 || !!k.d.series);
    const avail = g.H - g.m * 1.6 - y;
    const hd = head(k, P, plain(k.d.title), g.x, y, g.w, avail * (hasData ? 0.36 : 0.62), { fam: 'fraunces', max: g.ts(7.2), weight: 800, lh: 0.98, maxLines: 4 });
    y = hd.bottom + g.bl * 2.2;
    const dek = plain(k.d.subtitle ?? (k.d.quoteBy ? `— ${k.d.quoteBy}` : ''));
    if (dek) { const db = head(k, P, dek, g.x, y, g.w * 0.92, g.ts(2.2) * 3.4, { fam: 'fraunces', max: g.ts(1.6), weight: 400, italic: true, lh: 1.25, maxLines: 3, color: mix(P.fg, P.bg, 0.15) }); y = db.bottom + g.bl * 3; }
    if (hasData) {
      const h2 = g.H - g.m * 1.9 - y;
      c.fillStyle = P.fg; c.fillRect(g.x, y, g.w, Math.max(1, g.bl * 0.25));
      y += g.bl * 2.5;
      const ms = k.d.mapState;
      const mapW = ms ? g.w * (g.wide ? 0.42 : 0.46) : 0;
      if (ms) {
        if (!ms.startsWith('AU:')) {
          usChoropleth(c, g.x, y, mapW, h2 * 0.78, { highlight: ms, dem: P.party('#3d7bff'), rep: P.party('#ff3d55'), neutral: mix(P.bg, P.fg, 0.08), border: P.bg });
          label(c, 'Fig. 1 — 2024 presidential margin by state; outlined: this race', g.x, y + h2 * 0.9, 'tight', Math.max(10, dp * 0.85), P.muted, { upper: false, maxW: mapW, weight: 500 });
        } else {
          silhouette(c, ms, g.x, y, mapW, h2 * 0.8, { fill: P.fg, inner: 'rgba(255,255,255,0.35)' });
          label(c, `Fig. 1 — ${plain(k.d.title)} electorate`, g.x, y + h2 * 0.9, 'tight', Math.max(10, dp * 0.85), P.muted, { upper: false, maxW: mapW, weight: 500 });
        }
        c.fillStyle = P.line; c.fillRect(g.x + mapW + g.g, y, 1, h2 * 0.9);
      }
      const bx = g.x + (ms ? mapW + g.g * 2 : 0);
      dataViz(k, P, bx, y, g.x + g.w - bx, h2 * 0.9, { fam: 'tight', numFam: 'fraunces', track: mix(P.bg, P.fg, 0.1) });
    }
    footer(k, g, P);
  },
};

/* ───────── 2. Magazine cover ───────── */
const magCover: Design = {
  id: 'mag-cover', name: 'Magazine cover', kinds: ALLK, size: PT, isNew: true, premium: true, fluid: true, ownBg: true, fonts: ['Instrument Serif', 'Inter Tight'],
  draw(k) {
    const g = grid(k, { margin: 0.055 }), c = k.raw!;
    const P = pal(k, { bg: '#10101a', fg: '#fbf7ef', accent: '#ff5a36' });
    paint(k, P, { type: 'mesh', seed: 23, colors: [P.bg, P.accent, '#5b2bd6', '#1a7a8c'], intensity: 0.75 });
    if (k.d.mapState) { c.save(); c.globalAlpha = 0.9; silhouette(c, k.d.mapState, g.W * 0.18, g.H * 0.2, g.W * 0.95, g.H * 0.55, { fill: rgba(P.fg, 0.07), glow: rgba(P.accent, 0.6), stroke: rgba(P.fg, 0.35), lineWidth: Math.max(1.5, g.bl * 0.3) }); c.restore(); }
    // masthead fills the width
    const mt = 'PolTok';
    let mp = g.h * 0.2;
    c.font = ff('instrument', mp, 400); track(c, mp, -0.03);
    mp = Math.min(mp, (mp * g.w) / c.measureText(mt).width);
    c.font = ff('instrument', mp, 400); track(c, mp, -0.03);
    c.fillStyle = P.fg; c.textAlign = 'left'; c.fillText(mt, g.x - mp * 0.03, g.y + mp * 0.74); untrack(c);
    const sp = Math.max(11, g.ts(-1.4));
    let y = g.y + mp * 0.74 + sp * 1.8;
    label(c, `The election issue  ·  ${dateline(k)}`, g.x, y, 'tight', sp, P.fg, { weight: 600 });
    // cover lines (right column)
    const r = rows(k, P, 3);
    const h0 = hero(k);
    const colX = g.x + g.w * (g.wide ? 0.68 : 0.62);
    let cy = y + g.bl * 8;
    if (h0.value && !isMsg(k)) {
      const vp = fitNum(c, h0.value, g.x + g.w - colX, g.ts(5.5), 'instrument', 400);
      tabular(c, h0.value, g.x + g.w, cy + vp * 0.8, ff('instrument', vp, 400), P.accent, 'right');
      cy += vp * 0.95;
      label(c, h0.label, g.x + g.w, cy, 'tight', sp, P.fg, { align: 'right', weight: 700, maxW: g.x + g.w - colX });
      cy += sp * 3;
      r.slice(1, 3).forEach((x) => { label(c, `${x.label} ${x.value}`, g.x + g.w, cy, 'tight', sp * 1.05, rgba(P.fg, 0.82), { align: 'right', upper: false, weight: 600, maxW: g.x + g.w - colX }); cy += sp * 1.9; });
    }
    // cover headline
    const ht = plain(k.d.title);
    const bottomY = g.H - g.m * 1.5;
    const bH = g.h * 0.42;
    const b = balanced(c, ht, g.w * 0.92, bH, { maxPx: g.ts(8.5), fam: 'instrument', weight: 400, italic: true, lh: 0.92, maxLines: 4 });
    const top = bottomY - b.height - g.ts(2) * 2.5;
    drawBlock(c, b, g.x, top, P.fg, 'left', { shadow: 'rgba(0,0,0,0.35)' });
    const dek = plain(k.d.subtitle ?? k.d.quoteBy ?? '');
    if (dek) head(k, P, dek, g.x, top + b.height + g.bl * 1.5, g.w * 0.8, g.ts(1.4) * 2.6, { fam: 'tight', max: g.ts(1.2), weight: 500, lh: 1.25, maxLines: 2, color: rgba(P.fg, 0.85) });
    footer(k, g, P, { rule: false });
  },
};

/* ───────── 3. Cinematic poster ───────── */
const cinema: Design = {
  id: 'cinema', name: 'Cinematic poster', kinds: ALLK, size: ST, isNew: true, premium: true, fluid: true, ownBg: true, fonts: ['Anton', 'Instrument Serif', 'Inter Tight'],
  draw(k) {
    const g = grid(k, { margin: 0.07 }), c = k.raw!;
    const P = pal(k, { bg: '#07070a', fg: '#f4efe6', accent: '#ffb547' });
    paint(k, P, { type: 'leak', seed: 5, colors: [P.bg, P.accent, '#ff3d55', '#3d7bff'], intensity: 0.7 });
    const sw = g.W, sh = g.H;
    const ms = k.d.mapState;
    const artH = g.tall ? sh * 0.42 : sh * 0.5;
    if (ms) silhouette(c, ms, g.W * 0.1, g.H * (g.wide ? 0.08 : 0.14), g.W * 0.8, artH, { fill: mix(P.bg, P.accent, 0.12), glow: rgba(P.accent, 0.9), glowSize: Math.min(sw, sh) * 0.12, inner: rgba(P.accent, 0.8), stroke: rgba(P.accent, 0.9) });
    else { c.save(); c.globalCompositeOperation = 'screen'; const gg = c.createRadialGradient(g.W / 2, g.H * 0.35, 0, g.W / 2, g.H * 0.35, g.w * 0.5); gg.addColorStop(0, rgba(P.accent, 0.6)); gg.addColorStop(1, rgba(P.accent, 0)); c.fillStyle = gg; c.fillRect(0, 0, g.W, g.H); c.restore(); }
    // letterbox shade
    const sg = c.createLinearGradient(0, g.H * 0.45, 0, g.H);
    sg.addColorStop(0, rgba(P.bg, 0)); sg.addColorStop(0.45, rgba(P.bg, 0.85)); sg.addColorStop(1, P.bg);
    c.fillStyle = sg; c.fillRect(0, 0, g.W, g.H);
    const sp = Math.max(11, g.ts(-1.2));
    label(c, `PolTok presents`, g.W / 2, g.y + sp, 'tight', sp, rgba(P.fg, 0.75), { align: 'center', weight: 600, tracking: 0.4 });
    // title
    const credY = g.H - g.m * 1.3 - sp * 6.5;
    const ht = plain(k.d.title);
    const b = balanced(c, ht, g.w, g.h * (g.wide ? 0.38 : 0.26), { maxPx: g.ts(9.5), fam: 'anton', weight: 400, upper: true, lh: 0.95, maxLines: 3, tracking: 0.01 });
    const tagT = plain(k.d.subtitle ?? k.d.quoteBy ?? '');
    const tagH = tagT ? g.ts(1.8) * 1.4 * 2 : 0;
    const top = credY - g.bl * 4 - tagH - b.height;
    drawBlock(c, b, g.W / 2, top, P.fg, 'center', { shadow: rgba(P.accent, 0.5) });
    if (tagT) head(k, P, tagT, g.x, top + b.height + g.bl * 1.6, g.w, tagH, { fam: 'instrument', max: g.ts(1.8), weight: 400, italic: true, lh: 1.15, align: 'center', maxLines: 2, color: P.accent });
    // credit block
    const r = rows(k, P, 4);
    const credit = isMsg(k) ? [k.d.quoteBy ?? 'The PolTok team', k.d.handle ?? '@PolTok'] : r.map((x) => `${x.label}  ${x.value}`);
    c.fillStyle = rgba(P.fg, 0.3); c.fillRect(g.x + g.w * 0.2, credY - g.bl * 1.5, g.w * 0.6, 1);
    const cp = Math.max(10, sp * 0.95);
    c.save(); c.font = ff('anton', cp * 1.35, 400); track(c, cp, 0.12);
    c.textAlign = 'center'; c.fillStyle = rgba(P.fg, 0.85);
    const line = credit.join('   ·   ').toUpperCase();
    let L = line; while (L.length > 4 && c.measureText(L).width > g.w) L = L.slice(0, -2);
    c.fillText(L === line ? L : L + '…', g.W / 2, credY + cp * 1.6); c.restore();
    label(c, `${k.attr}`, g.W / 2, credY + cp * 3.6, 'tight', cp * 0.85, rgba(P.fg, 0.55), { align: 'center', weight: 500, maxW: g.w });
    label(c, dateline(k), g.W / 2, credY + cp * 5.2, 'tight', cp * 0.85, rgba(P.fg, 0.55), { align: 'center', weight: 500 });
    footer(k, g, P, { rule: false, center: true, y: g.H - g.m * 0.45 });
  },
};

/* ───────── 4. Swiss data poster ───────── */
const swissData: Design = {
  id: 'swiss-data', name: 'Swiss data poster', kinds: ALLK, size: PT, isNew: true, premium: true, fluid: true, ownBg: true, fonts: ['Inter Tight'],
  draw(k) {
    const g = grid(k, { margin: 0.065, cols: 6 }), c = k.raw!;
    const P = pal(k, { bg: '#f2f0eb', fg: '#111111', accent: '#e4251b' });
    paint(k, P, { type: 'grain', seed: 4, colors: [P.bg, P.bg, P.bg], intensity: 0.15 });
    // column grid hairlines
    c.fillStyle = rgba(P.fg.startsWith('#') ? P.fg : '#111111', 0.06);
    for (let i = 1; i < g.cols; i++) c.fillRect(g.col(i) - g.g / 2, 0, 1, g.H);
    const sp = Math.max(11, g.ts(-1.3));
    label(c, '01', g.x, g.y + sp, 'tight', sp, P.accent, { weight: 800 });
    label(c, kicker(k), g.col(1), g.y + sp, 'tight', sp, P.fg, { weight: 700 });
    label(c, dateline(k), g.x + g.w, g.y + sp, 'tight', sp, P.muted, { align: 'right', weight: 500 });
    const h0 = hero(k);
    let y = g.y + sp * 3;
    const msg = isMsg(k) || !h0.value;
    if (!msg) {
      const vp = fitNum(c, h0.value, g.w, Math.min(g.h * (g.wide ? 0.42 : 0.3), g.w * 0.36), 'tight', 900);
      c.save(); c.font = ff('tight', vp, 900); track(c, vp, -0.05); c.fillStyle = P.accent; c.textAlign = 'left'; c.fillText(h0.value, g.x - vp * 0.04, y + vp * 0.78); c.restore();
      y += vp * 0.82 + g.bl * 2;
      label(c, h0.label, g.x, y + sp, 'tight', sp * 1.1, P.fg, { weight: 700, maxW: g.w });
      y += sp * 2.6;
    }
    c.fillStyle = P.fg; c.fillRect(g.x, y, g.w, Math.max(2, g.bl * 0.35));
    y += g.bl * 3;
    const avail = g.H - g.m * 1.6 - y;
    const tw = g.wide ? g.w * 0.5 : g.w;
    const hd = head(k, P, plain(k.d.title), g.x, y, tw, avail * (msg ? 0.7 : 0.38), { fam: 'tight', max: g.ts(msg ? 7 : 5), weight: 800, lh: 0.98, maxLines: msg ? 6 : 3 });
    let by = hd.bottom + g.bl * 1.5;
    const dek = plain(k.d.subtitle ?? k.d.quoteBy ?? '');
    if (dek) by = head(k, P, dek, g.x, by, tw * 0.9, g.ts(1.2) * 3.8, { fam: 'tight', max: g.ts(1.1), weight: 500, lh: 1.3, maxLines: 3, color: P.muted }).bottom + g.bl * 3;
    if (!msg) {
      const vx = g.wide ? g.x + g.w * 0.56 : g.x, vy = g.wide ? y : by;
      dataViz(k, P, vx, vy, g.wide ? g.w * 0.44 : g.w, g.H - g.m * 1.7 - vy, { fam: 'tight', numFam: 'tight', track: rgba('#111111', 0.08) });
    }
    footer(k, g, P);
  },
};

/* ───────── 5. Election-night scoreboard ───────── */
const nightBoard: Design = {
  id: 'night-board', name: 'Election-night scoreboard', kinds: DATA, size: X, isNew: true, premium: true, fluid: true, ownBg: true, fonts: ['Inter Tight', 'IBM Plex Mono'],
  draw(k) {
    const g = grid(k, { margin: 0.055 }), c = k.raw!;
    const P = pal(k, { bg: '#080b12', fg: '#f3f6fb', accent: '#ffd400' });
    paint(k, P, { type: 'grain', seed: 9, colors: [P.bg, '#16203a', '#0d1426'], intensity: 0.4 });
    // header band
    const hp = Math.max(12, g.ts(-0.8));
    const bandH = hp * 2.6;
    c.fillStyle = rgba('#ffffff', 0.05); c.fillRect(0, g.y - hp * 0.6, g.W, bandH);
    rr(c, g.x, g.y, hp * 4.6, hp * 1.5, hp * 0.3); c.fillStyle = '#e8112d'; c.fill();
    label(c, 'Live', g.x + hp * 2.3, g.y + hp * 1.08, 'tight', hp * 0.82, '#ffffff', { align: 'center', weight: 800 });
    label(c, `${kicker(k)} · ${plain(k.d.title)}`, g.x + hp * 5.6, g.y + hp * 1.1, 'tight', hp, P.fg, { weight: 700, maxW: g.w * 0.62 });
    label(c, dateline(k), g.x + g.w, g.y + hp * 1.1, 'plex', hp * 0.85, P.muted, { align: 'right', upper: false });
    const top = g.y + bandH + g.bl * 2, bot = g.H - g.m * 1.4;
    const H2 = bot - top;
    const r = rows(k, P, 3);
    const d = k.d;
    if (d.kind === 'balance' || d.series) { dataViz(k, P, g.x, top, g.w, H2, { fam: 'tight', numFam: 'tight' }); footer(k, g, P); return; }
    // scoreboard tiles (two leading)
    const n = Math.max(1, Math.min(2, r.length));
    const rightW = g.wide && r.length >= 2 ? g.w * 0.3 : 0;
    const tw = (g.w - rightW - (rightW ? g.g * 2 : 0) - g.g * (n - 1)) / n;
    r.slice(0, n).forEach((x, i) => {
      const tx = g.x + i * (tw + g.g);
      rr(c, tx, top, tw, H2, g.bl * 1.2); c.fillStyle = rgba('#ffffff', 0.04); c.fill();
      c.fillStyle = x.color; c.fillRect(tx, top, g.bl * 0.9, H2);
      const lp = Math.max(12, Math.min(tw * 0.07, H2 * 0.1));
      label(c, x.label, tx + g.bl * 3, top + lp * 1.8, 'tight', lp, P.fg, { weight: 700, upper: false, maxW: tw - g.bl * 5 });
      if (i === 0 && /winner|projected|called/i.test(d.subtitle ?? '')) label(c, '✓ Projected', tx + g.bl * 3, top + lp * 3.4, 'tight', lp * 0.75, P.accent, { weight: 800 });
      const vp = fitNum(c, x.value, tw - g.bl * 6, H2 * 0.5, 'plex', 700);
      c.save(); c.shadowColor = rgba(x.color, 0.6); c.shadowBlur = vp * 0.2;
      tabular(c, x.value, tx + tw - g.bl * 3, top + H2 - g.bl * 4, ff('plex', vp, 700), P.fg, 'right'); c.restore();
    });
    if (rightW) {
      const lead = r[0], two = r[1];
      const share = lead.num + two.num > 0 ? (lead.num / (lead.num + two.num)) * 100 : 50;
      const leftIsLead = /^#3d7bff$/i.test(lead.color) || lead.color === P.party('#3d7bff');
      const R = Math.min(rightW / 2, H2 * 0.62);
      const cx = g.x + g.w - rightW / 2, cy = top + H2 * 0.62;
      needle(c, cx, cy, R * 0.92, leftIsLead ? 100 - share : share, { left: leftIsLead ? lead.color : two.color, right: leftIsLead ? two.color : lead.color, track: mix(P.bg, P.fg, 0.2), fg: P.fg, ticks: rgba(P.fg, 0.4) });
      label(c, 'Two-way share', cx, cy + R * 0.32, 'tight', Math.max(10, R * 0.12), P.muted, { align: 'center', weight: 600 });
    }
    footer(k, g, P);
  },
};

/* ───────── 6. Minimal luxe ───────── */
const luxe: Design = {
  id: 'luxe', name: 'Minimal luxe', kinds: ALLK, size: SQ, isNew: true, premium: true, fluid: true, ownBg: true, fonts: ['Instrument Serif', 'Inter Tight'],
  draw(k) {
    const g = grid(k, { margin: 0.09 }), c = k.raw!;
    const P = pal(k, { bg: '#f4efe6', fg: '#1a1714', accent: '#9a7440' });
    paint(k, P, { type: 'paper', seed: 3, colors: [P.bg, P.accent, P.fg], intensity: 0.2 });
    const inset = g.m * 0.45;
    c.strokeStyle = rgba(P.accent, 0.7); c.lineWidth = Math.max(1, g.bl * 0.12);
    c.strokeRect(inset, inset, g.W - inset * 2, g.H - inset * 2);
    const sp = Math.max(10, g.ts(-1.6));
    label(c, kicker(k), g.W / 2, g.y + sp, 'tight', sp, P.accent, { align: 'center', weight: 600, tracking: 0.38 });
    c.fillStyle = P.accent; c.fillRect(g.W / 2 - g.w * 0.04, g.y + sp * 2.3, g.w * 0.08, 1);
    const h0 = hero(k);
    const msg = isMsg(k) || !h0.value;
    let y = g.y + sp * 4.5;
    const avail = g.H - g.m * 1.5 - y;
    const hd = head(k, P, plain(k.d.title), g.x + g.w * 0.05, y + (msg ? avail * 0.12 : 0), g.w * 0.9, avail * (msg ? 0.62 : 0.34), { fam: 'instrument', max: g.ts(msg ? 6.4 : 5.2), weight: 400, lh: 1.02, align: 'center', maxLines: msg ? 5 : 3 });
    y = hd.bottom + g.bl * 2.5;
    if (!msg) {
      const vp = fitNum(c, h0.value, g.w * 0.6, avail * 0.3, 'instrument', 400);
      tabular(c, h0.value, g.W / 2, y + vp * 0.8, ff('instrument', vp, 400, true), P.accent, 'center');
      y += vp * 0.95;
      label(c, h0.label, g.W / 2, y + sp, 'tight', sp, P.muted, { align: 'center', weight: 600, tracking: 0.3 });
      y += sp * 3;
      const r = rows(k, P, 3).slice(1);
      if (r.length) {
        const line = r.map((x) => `${x.label} ${x.value}`).join('   ·   ');
        label(c, line, g.W / 2, y + sp, 'tight', sp * 1.05, P.fg, { align: 'center', upper: false, weight: 500, maxW: g.w });
      }
    } else {
      const by = k.d.quoteBy ?? k.d.subtitle;
      if (by) label(c, `— ${plain(by)}`, g.W / 2, y + sp * 1.4, 'instrument', sp * 1.8, P.accent, { align: 'center', upper: false, italic: true, maxW: g.w });
    }
    footer(k, g, P, { rule: false, center: true, y: g.H - g.m * 0.95 });
  },
};

/* ───────── 7. Neon nightlife ───────── */
const neonNight: Design = {
  id: 'neon-night', name: 'Neon nightlife', kinds: ALLK, size: SQ, isNew: true, premium: true, fluid: true, ownBg: true, fonts: ['Bricolage Grotesque', 'Inter Tight'],
  draw(k) {
    const g = grid(k), c = k.raw!;
    const P = pal(k, { bg: '#0a0414', fg: '#fff4fb', accent: '#ff2bd6' });
    paint(k, P, { type: 'aurora', seed: 17, colors: [P.bg, P.accent, '#00e5ff', '#7a2bff'], intensity: 0.55 });
    // perspective floor grid
    c.save(); c.strokeStyle = rgba('#00e5ff', 0.22); c.lineWidth = Math.max(1, g.bl * 0.15);
    const hz = g.H * 0.72;
    for (let i = -10; i <= 10; i++) { c.beginPath(); c.moveTo(g.W / 2 + i * g.W * 0.02, hz); c.lineTo(g.W / 2 + i * g.W * 0.2, g.H); c.stroke(); }
    for (let j = 1; j < 8; j++) { const t = (j / 8) ** 2; const yy = hz + (g.H - hz) * t; c.beginPath(); c.moveTo(0, yy); c.lineTo(g.W, yy); c.stroke(); }
    c.restore();
    const sp = Math.max(11, g.ts(-1.2));
    label(c, `● ${kicker(k)}`, g.x, g.y + sp, 'tight', sp, '#00e5ff', { weight: 800 });
    const glow = (col: string) => ({ shadow: rgba(col, 0.9) });
    const msg = isMsg(k);
    const avail = hz - g.y - sp * 3;
    const hd = head(k, P, plain(k.d.title), g.x, g.y + sp * 3, g.w, avail * (msg ? 0.9 : 0.5), { fam: 'bricolage', max: g.ts(7), weight: 800, lh: 0.98, maxLines: msg ? 5 : 3, color: P.fg, ...glow(P.accent), stroke: { color: rgba(P.accent, 0.9), width: Math.max(2, g.bl * 0.35) } });
    if (!msg) dataViz(k, P, g.x, hd.bottom + g.bl * 3, g.w, g.H - g.m * 1.7 - hd.bottom - g.bl * 3, { fam: 'tight', numFam: 'bricolage', track: rgba('#ffffff', 0.08) });
    else if (k.d.quoteBy) label(c, plain(k.d.quoteBy), g.x, hd.bottom + g.bl * 4, 'tight', sp * 1.2, '#00e5ff', { weight: 700 });
    footer(k, g, P, { rule: false });
  },
};

/* ───────── 8. Risograph print ───────── */
const riso: Design = {
  id: 'riso', name: 'Risograph print', kinds: ALLK, size: PT, isNew: true, premium: true, fluid: true, ownBg: true, fonts: ['Archivo Black', 'Inter Tight'],
  draw(k) {
    const g = grid(k), c = k.raw!;
    const P = pal(k, { bg: '#f5efe0', fg: '#1d2a6b', accent: '#ff4f9a' });
    paint(k, P, { type: 'paper', seed: 41, colors: [P.bg, P.accent, P.fg], intensity: 0.4 });
    const ink2 = P.accent, ink1 = P.fg;
    const r = prng(77);
    // halftone disc in ink 2, offset blob in ink 1, multiply
    c.save(); c.globalCompositeOperation = 'multiply';
    const step = Math.min(g.W, g.H) / 70;
    const cx = g.W * 0.72, cy = g.H * 0.3, R = Math.min(g.W, g.H) * 0.42;
    c.fillStyle = rgba(ink2, 0.9);
    for (let yy = cy - R; yy < cy + R; yy += step) for (let xx = cx - R; xx < cx + R; xx += step) { const d = Math.hypot(xx - cx, yy - cy) / R; if (d > 1) continue; c.beginPath(); c.arc(xx, yy, step * 0.5 * (1 - d * 0.85), 0, Math.PI * 2); c.fill(); }
    if (k.d.mapState) silhouette(c, k.d.mapState, cx - R * 0.95 + R * 0.06, cy - R * 0.7, R * 1.9, R * 1.4, { fill: rgba(ink1, 0.75) });
    c.restore();
    const sp = Math.max(11, g.ts(-1.2));
    label(c, kicker(k), g.x, g.y + sp, 'tight', sp, ink1, { weight: 800 });
    label(c, dateline(k), g.x, g.y + sp * 2.6, 'tight', sp * 0.9, rgba(ink1, 0.75), { weight: 600 });
    const msg = isMsg(k);
    const y0 = g.H * (msg ? 0.4 : 0.5);
    const avail = g.H - g.m * 1.6 - y0;
    const b = balanced(c, plain(k.d.title), g.w, avail * (msg ? 0.8 : 0.42), { maxPx: g.ts(7.5), fam: 'archivo', weight: 400, upper: true, lh: 0.96, maxLines: 4 });
    c.save(); c.globalCompositeOperation = 'multiply';
    const off = Math.max(2, b.px * 0.035) * (r() > 0.5 ? 1 : -1);
    drawBlock(c, b, g.x + off, y0 + off * 0.6, rgba(ink2, 0.95));
    const bottom = drawBlock(c, b, g.x, y0, rgba(ink1, 0.92));
    c.restore();
    if (!msg) dataViz(k, P, g.x, bottom + g.bl * 3, g.w, g.H - g.m * 1.7 - bottom - g.bl * 3, { fam: 'tight', numFam: 'archivo', track: rgba(ink2, 0.25) });
    else if (k.d.quoteBy) label(c, plain(k.d.quoteBy), g.x, bottom + g.bl * 4, 'tight', sp * 1.2, ink2, { weight: 800 });
    filmGrain(c, g.W, g.H, 0.18, 5);
    footer(k, g, { ...P, muted: rgba(ink1, 0.8) });
  },
};

/* ───────── 9. Collage cutout ───────── */
const collage: Design = {
  id: 'collage', name: 'Collage cutout', kinds: ALLK, size: SQ, isNew: true, premium: true, fluid: true, ownBg: true, fonts: ['Archivo Black', 'Instrument Serif', 'Inter Tight'],
  draw(k) {
    const g = grid(k), c = k.raw!;
    const P = pal(k, { bg: '#d9c7a6', fg: '#151515', accent: '#e8412c' });
    paint(k, P, { type: 'paper', seed: 8, colors: [P.bg, P.accent, P.fg], intensity: 0.9 });
    const r = prng(k.d.title.length * 31 + 7);
    const torn = (x: number, y: number, w: number, h: number, fill: string, rot: number) => {
      c.save(); c.translate(x + w / 2, y + h / 2); c.rotate(rot);
      c.shadowColor = 'rgba(0,0,0,0.28)'; c.shadowBlur = h * 0.08; c.shadowOffsetY = h * 0.04;
      c.beginPath(); const st = w / 30;
      c.moveTo(-w / 2, -h / 2);
      for (let i = 0; i <= 30; i++) c.lineTo(-w / 2 + i * st, -h / 2 + (r() - 0.5) * h * 0.05);
      for (let i = 0; i <= 12; i++) c.lineTo(w / 2 + (r() - 0.5) * w * 0.01, -h / 2 + (i * h) / 12);
      for (let i = 30; i >= 0; i--) c.lineTo(-w / 2 + i * st, h / 2 + (r() - 0.5) * h * 0.05);
      c.closePath(); c.fillStyle = fill; c.fill(); c.restore();
    };
    const tape = (x: number, y: number, w: number, rot: number) => { c.save(); c.translate(x, y); c.rotate(rot); c.fillStyle = 'rgba(255,250,225,0.65)'; c.fillRect(-w / 2, -w * 0.16, w, w * 0.32); c.restore(); };
    const ms = k.d.mapState;
    const msg = isMsg(k);
    if (ms) {
      const sx = g.x + g.w * 0.42, sy = g.y + g.h * 0.02, sw = g.w * 0.58, sh = g.h * 0.5;
      torn(sx, sy, sw, sh, '#f6f1e4', 0.04);
      c.save(); c.shadowColor = 'rgba(0,0,0,0.35)'; c.shadowBlur = 12; c.shadowOffsetY = 6;
      silhouette(c, ms, sx + sw * 0.08, sy + sh * 0.08, sw * 0.84, sh * 0.84, { fill: P.party(k.d.color && HEXRE.test(k.d.color) ? k.d.color : P.accent) });
      c.restore();
      tape(sx + sw * 0.15, sy + 4, sw * 0.28, -0.35); tape(sx + sw * 0.88, sy + sh - 4, sw * 0.24, 0.5);
    }
    // ransom-style headline strips
    const sp = Math.max(11, g.ts(-1.2));
    const ttl = plain(k.d.title);
    const b = balanced(c, ttl, g.w * (ms ? 0.62 : 0.92), g.h * (msg ? 0.55 : 0.38), { maxPx: g.ts(6.5), fam: 'archivo', weight: 400, upper: true, lh: 1.25, maxLines: 4 });
    let y = g.y + (ms ? g.h * 0.08 : g.h * 0.06);
    b.lines.forEach((l, i) => {
      c.font = b.font; const w = c.measureText(l).width + b.px * 0.6;
      const fill = i % 2 ? P.fg : '#fbf7ec';
      torn(g.x - b.px * 0.2, y, w, b.px * 1.15, fill, (r() - 0.5) * 0.05);
      c.save(); c.translate(g.x + w / 2 - b.px * 0.2, y + b.px * 0.575); c.rotate((r() - 0.5) * 0.03);
      c.font = b.font; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = i % 2 ? '#fbf7ec' : P.fg; c.fillText(l, 0, b.px * 0.06); c.restore();
      y += b.px * 1.28;
    });
    y += g.bl * 2;
    const dek = plain(k.d.subtitle ?? k.d.quoteBy ?? '');
    if (dek) y = head(k, P, dek, g.x, y, g.w * (ms ? 0.55 : 0.8), g.ts(2) * 3.2, { fam: 'instrument', max: g.ts(2), weight: 400, italic: true, lh: 1.1, maxLines: 3 }).bottom + g.bl * 3;
    if (!msg) {
      const vy = Math.max(y, g.y + g.h * 0.56);
      torn(g.x - g.bl, vy - g.bl * 2, g.w + g.bl * 2, g.H - g.m * 1.4 - vy + g.bl * 2, '#fbf7ec', -0.01);
      dataViz(k, P, g.x + g.bl * 2, vy + g.bl, g.w - g.bl * 4, g.H - g.m * 1.8 - vy, { fam: 'tight', numFam: 'archivo', track: rgba('#000000', 0.08) });
    }
    const h0 = hero(k);
    if (!msg && h0.value && ms) {
      const R = g.w * 0.13, cx = g.x + g.w - R * 0.9, cy = g.y + g.h * 0.5;
      c.save(); c.shadowColor = 'rgba(0,0,0,0.3)'; c.shadowBlur = R * 0.2; c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fillStyle = P.accent; c.fill(); c.restore();
      const vp = fitNum(c, h0.value, R * 1.6, R * 0.6, 'archivo', 400);
      c.save(); c.translate(cx, cy); c.rotate(-0.12); tabular(c, h0.value, 0, vp * 0.35, ff('archivo', vp, 400), contrast('#ffffff', P.accent) > 3 ? '#ffffff' : '#111111', 'center'); c.restore();
    }
    footer(k, g, P, { rule: false });
    void sp;
  },
};

/* ───────── 10. Isometric map ───────── */
const isoMap: Design = {
  id: 'iso-map', name: 'Isometric hex map', kinds: ['race', 'flip', 'au-seat', 'candidate', 'promo', 'custom'], size: SQ, isNew: true, premium: true, fluid: true, ownBg: true, fonts: ['Inter Tight'],
  draw(k) {
    const g = grid(k), c = k.raw!;
    const P = pal(k, { bg: '#0b1020', fg: '#eef2ff', accent: '#ffd400' });
    paint(k, P, { type: 'iso', seed: 2, colors: [P.bg, '#2b3a6b', '#1b2547'], intensity: 0.3 });
    const sp = Math.max(11, g.ts(-1.2));
    label(c, kicker(k), g.x, g.y + sp, 'tight', sp, P.accent, { weight: 800 });
    const hd = head(k, P, plain(k.d.title), g.x, g.y + sp * 2.4, g.wide ? g.w * 0.5 : g.w, g.h * 0.22, { fam: 'tight', max: g.ts(5), weight: 800, lh: 1, maxLines: 2 });
    const hi = P.party(k.d.color && HEXRE.test(k.d.color) && k.d.color !== '#c6ff3d' ? k.d.color : P.accent);
    const mapTop = g.wide ? g.y : hd.bottom + g.bl * 2;
    const mapH = (g.wide ? g.h : g.h * 0.55) * 1.0;
    const mapW = g.wide ? g.w * 0.55 : g.w;
    const mx = g.wide ? g.x + g.w - mapW : g.x;
    c.save();
    c.translate(mx + mapW / 2, mapTop + mapH / 2);
    c.scale(1, 0.62); c.rotate(-Math.PI / 12);
    hexMap(c, k.d.mapState, -mapW * 0.55, -mapH * 0.62, mapW * 1.1, mapH * 1.24, { base: mix(P.bg, P.fg, 0.16), hi, extrude: 4, fillFor: undefined });
    c.restore();
    const vy = g.wide ? hd.bottom + g.bl * 3 : mapTop + mapH + g.bl * 2;
    dataViz(k, P, g.x, vy, g.wide ? g.w * 0.42 : g.w, g.H - g.m * 1.7 - vy, { fam: 'tight', numFam: 'tight' });
    footer(k, g, P);
  },
};

/* ───────── 11. Topographic ───────── */
const topo: Design = {
  id: 'topo', name: 'Topographic', kinds: ALLK, size: X, isNew: true, premium: true, fluid: true, ownBg: true, fonts: ['Fraunces', 'Inter Tight'],
  draw(k) {
    const g = grid(k), c = k.raw!;
    const P = pal(k, { bg: '#0e1a16', fg: '#eef5ef', accent: '#9be564' });
    paint(k, P, { type: 'topo', seed: 31, colors: [P.bg, P.accent, '#5fa8a0'], intensity: 0.6 });
    const ms = k.d.mapState;
    const two = g.wide || !g.portrait;
    const artW = ms ? (two ? g.w * 0.4 : g.w) : 0, artH = two ? g.h : g.h * 0.36;
    if (ms) silhouette(c, ms, two ? g.x + g.w - artW : g.x, g.y, artW, artH, { fill: rgba(P.accent, 0.16), glow: rgba(P.accent, 0.7), inner: rgba(P.accent, 0.9), stroke: P.accent, lineWidth: Math.max(2, g.bl * 0.4) });
    const tx = g.x, tw = ms && two ? g.w - artW - g.g * 2 : g.w;
    const ty = ms && !two ? g.y + artH + g.bl * 2 : g.y;
    const sp = Math.max(11, g.ts(-1.2));
    label(c, kicker(k), tx, ty + sp, 'tight', sp, P.accent, { weight: 800 });
    const msg = isMsg(k);
    const avail = g.H - g.m * 1.6 - ty - sp * 2.5;
    const hd = head(k, P, plain(k.d.title), tx, ty + sp * 2.4, tw, avail * (msg ? 0.8 : 0.42), { fam: 'fraunces', max: g.ts(6), weight: 700, lh: 1, maxLines: 4 });
    let y = hd.bottom + g.bl * 1.5;
    const dek = plain(k.d.subtitle ?? k.d.quoteBy ?? '');
    if (dek) y = head(k, P, dek, tx, y, tw, g.ts(1.1) * 2.8, { fam: 'tight', max: g.ts(1.05), weight: 500, lh: 1.3, maxLines: 2, color: P.muted }).bottom + g.bl * 2;
    if (!msg) dataViz(k, P, tx, y, tw, g.H - g.m * 1.6 - y, { fam: 'tight', numFam: 'tight' });
    footer(k, g, P);
  },
};

/* ───────── 12. Glassmorphism ───────── */
const glass: Design = {
  id: 'glass', name: 'Glass panel', kinds: ALLK, size: SQ, isNew: true, premium: true, fluid: true, ownBg: true, fonts: ['Inter Tight'],
  draw(k) {
    const g = grid(k), c = k.raw!;
    const P = pal(k, { bg: '#0d0b24', fg: '#ffffff', accent: '#7cf5ff' });
    paint(k, P, { type: 'mesh', seed: 58, colors: [P.bg, '#ff4fa0', '#4f6bff', P.accent], intensity: 0.85 });
    if (k.d.mapState) silhouette(c, k.d.mapState, g.W * 0.3, g.y * 0.6, g.W * 0.75, g.H * 0.55, { fill: rgba('#ffffff', 0.18), glow: rgba('#ffffff', 0.35) });
    // frosted panel: blur a copy of what's beneath
    const px = g.x - g.m * 0.3, py = g.H * (g.wide ? 0.16 : 0.34), pw = g.w + g.m * 0.6, ph = g.H - py - g.m * 1.1, rad = g.m * 0.5;
    const snap = document.createElement('canvas'); snap.width = g.W; snap.height = g.H; snap.getContext('2d')!.drawImage(c.canvas, 0, 0);
    c.save(); rr(c, px, py, pw, ph, rad); c.clip();
    c.filter = `blur(${Math.round(Math.min(g.W, g.H) * 0.035)}px) saturate(1.4)`; c.drawImage(snap, 0, 0); c.filter = 'none';
    c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(px, py, pw, ph);
    const hl = c.createLinearGradient(px, py, px, py + ph * 0.4); hl.addColorStop(0, 'rgba(255,255,255,0.18)'); hl.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = hl; c.fillRect(px, py, pw, ph);
    c.restore();
    rr(c, px, py, pw, ph, rad); c.lineWidth = Math.max(1, g.bl * 0.2); c.strokeStyle = 'rgba(255,255,255,0.45)'; c.stroke();
    // darken text area for contrast on any mesh
    c.save(); rr(c, px, py, pw, ph, rad); c.clip(); c.fillStyle = rgba(P.bg, 0.35); c.fillRect(px, py, pw, ph); c.restore();
    const sp = Math.max(11, g.ts(-1.2));
    label(c, kicker(k), g.x, g.y + sp, 'tight', sp, '#ffffff', { weight: 800 });
    const ix = px + g.m * 0.55, iw = pw - g.m * 1.1;
    let y = py + g.m * 0.5;
    const msg = isMsg(k);
    const hd = head(k, { ...P, fg: '#ffffff' }, plain(k.d.title), ix, y, iw, ph * (msg ? 0.7 : 0.36), { fam: 'tight', max: g.ts(5.6), weight: 800, lh: 1, maxLines: msg ? 5 : 3, color: '#ffffff' });
    y = hd.bottom + g.bl * 1.5;
    const dek = plain(k.d.subtitle ?? k.d.quoteBy ?? '');
    if (dek) y = head(k, P, dek, ix, y, iw, g.ts(1.1) * 2.8, { fam: 'tight', max: g.ts(1.05), weight: 500, lh: 1.3, maxLines: 2, color: 'rgba(255,255,255,0.82)' }).bottom + g.bl * 2;
    if (!msg) dataViz(k, { ...P, fg: '#ffffff', muted: 'rgba(255,255,255,0.75)' }, ix, y, iw, py + ph - g.m * 0.4 - y, { fam: 'tight', numFam: 'tight', track: 'rgba(255,255,255,0.15)' });
    footer(k, g, { ...P, fg: '#ffffff', muted: 'rgba(255,255,255,0.75)' }, { rule: false, y: g.H - g.m * 0.42 });
  },
};

/* ───────── 13. Duotone portrait ───────── */
const duotone: Design = {
  id: 'duotone', name: 'Duotone portrait', kinds: ['candidate', 'race', 'flip', 'quote', ...MESSAGE_KINDS], size: PT, isNew: true, premium: true, fluid: true, ownBg: true, fonts: ['Archivo Black', 'Inter Tight'],
  draw(k) {
    const g = grid(k), c = k.raw!;
    const P = pal(k, { bg: '#1b1446', fg: '#ffffff', accent: '#ffcf3d' });
    const dark = P.bg, light = P.accent;
    if (k.img) {
      // draw grayscale then gradient-map to two inks
      const tmp = document.createElement('canvas'); tmp.width = g.W; tmp.height = g.H; const t = tmp.getContext('2d')!;
      const im = k.img; const ir = im.naturalWidth / im.naturalHeight, br = g.W / g.H;
      let sw = im.naturalWidth, sh = im.naturalHeight, sx = 0, sy = 0;
      if (ir > br) { sw = sh * br; sx = (im.naturalWidth - sw) / 2; } else { sh = sw / br; sy = (im.naturalHeight - sh) * 0.15; }
      t.filter = 'grayscale(1) contrast(1.25)'; t.drawImage(im, sx, sy, sw, sh, 0, 0, g.W, g.H);
      const data = t.getImageData(0, 0, g.W, g.H); const A = hexToRgb(dark), B = hexToRgb(light);
      for (let i = 0; i < data.data.length; i += 4) { const v = data.data[i] / 255; data.data[i] = A[0] + (B[0] - A[0]) * v; data.data[i + 1] = A[1] + (B[1] - A[1]) * v; data.data[i + 2] = A[2] + (B[2] - A[2]) * v; }
      t.putImageData(data, 0, 0); c.drawImage(tmp, 0, 0);
    } else {
      paint(k, P, { type: 'duotone', seed: 13, colors: [P.bg, dark, mix(light, dark, 0.35)], intensity: 0.6 });
      const nm = k.d.quoteBy ?? k.d.title;
      const ip = Math.min(g.W, g.H) * 0.5;
      c.save(); c.font = ff('archivo', ip, 400); c.textAlign = 'center'; c.fillStyle = rgba(light, 0.85); c.globalCompositeOperation = 'screen';
      c.fillText(initials(nm || 'PolTok').toUpperCase(), g.W / 2, g.H * 0.48); c.restore();
    }
    const sg = c.createLinearGradient(0, g.H * 0.4, 0, g.H); sg.addColorStop(0, rgba(dark, 0)); sg.addColorStop(0.6, rgba(dark, 0.88)); sg.addColorStop(1, dark);
    c.fillStyle = sg; c.fillRect(0, 0, g.W, g.H);
    filmGrain(c, g.W, g.H, 0.12, 3);
    const sp = Math.max(11, g.ts(-1.2));
    rr(c, g.x, g.y, label(c, kicker(k), 0, -100, 'tight', sp, '#000', { weight: 800 }) + sp * 1.6, sp * 2, sp * 0.3); c.fillStyle = light; c.fill();
    label(c, kicker(k), g.x + sp * 0.8, g.y + sp * 1.38, 'tight', sp, contrast('#111111', light) > 4.5 ? '#111111' : '#ffffff', { weight: 800 });
    const msg = isMsg(k);
    const r = rows(k, P, 2);
    const statH = !msg && r.length ? g.ts(4) * 1.6 : 0;
    const bottom = g.H - g.m * 1.5 - statH;
    const b = balanced(c, plain(k.d.title), g.w, g.h * 0.36, { maxPx: g.ts(7.5), fam: 'archivo', weight: 400, upper: true, lh: 0.95, maxLines: 4 });
    const dek = plain(k.d.subtitle ?? '');
    const dh = dek ? g.ts(1.1) * 2.8 : 0;
    const top = bottom - b.height - dh - g.bl * 2;
    drawBlock(c, b, g.x, top, '#ffffff');
    if (dek) head(k, P, dek, g.x, top + b.height + g.bl, g.w, dh, { fam: 'tight', max: g.ts(1.05), weight: 500, lh: 1.3, maxLines: 2, color: rgba('#ffffff', 0.85) });
    if (statH) {
      let sx = g.x;
      r.forEach((x, i) => {
        const vp = g.ts(4);
        const w = tabular(c, x.value, sx, bottom + vp * 0.95, ff('archivo', vp, 400), i ? rgba('#ffffff', 0.7) : light);
        label(c, x.label, sx, bottom + vp * 1.4, 'tight', sp * 0.9, rgba('#ffffff', 0.75), { weight: 700, maxW: g.w / 2 - g.g });
        sx += Math.max(w, g.w * 0.3) + g.g * 2;
      });
    }
    footer(k, g, { ...P, fg: '#ffffff', muted: rgba('#ffffff', 0.7), line: rgba('#ffffff', 0.25), accent: light });
  },
};

/* ───────── 14. Waffle ───────── */
const waffleCard: Design = {
  id: 'waffle', name: 'Waffle chart', kinds: ['race', 'flip', 'au-seat', 'stat', 'balance', 'candidate'], size: SQ, isNew: true, premium: true, fluid: true, ownBg: true, fonts: ['Inter Tight'],
  draw(k) {
    const g = grid(k), c = k.raw!;
    const P = pal(k, { bg: '#fbfaf7', fg: '#121212', accent: '#2c5cff' });
    paint(k, P, { type: 'grain', seed: 6, colors: [P.bg, P.bg, P.bg], intensity: 0.1 });
    const r = rows(k, P, 4);
    const parts = k.d.kind === 'balance' && k.d.bars ? k.d.bars.map((b) => ({ v: b.value, color: P.party(b.color), label: b.label, value: `${b.value}` })) : r.map((x) => ({ v: x.num, color: x.color, label: x.label, value: x.value }));
    const tot = parts.reduce((a, p) => a + p.v, 0) || 1;
    const norm = parts.map((p) => ({ ...p, v: (p.v / (k.d.kind === 'balance' ? tot : Math.max(100, tot))) * 100 }));
    const sp = Math.max(11, g.ts(-1.2));
    label(c, kicker(k), g.x, g.y + sp, 'tight', sp, P.accent, { weight: 800 });
    const two = g.wide;
    const hd = head(k, P, plain(k.d.title), g.x, g.y + sp * 2.4, two ? g.w * 0.45 : g.w, g.h * 0.2, { fam: 'tight', max: g.ts(4.6), weight: 800, lh: 1, maxLines: 2 });
    const top = two ? g.y : hd.bottom + g.bl * 3;
    const size = Math.min(two ? g.h - g.m * 0.5 : g.w * 0.6, g.H - g.m * 1.7 - top);
    const wx = two ? g.x + g.w - size : g.x;
    waffle(c, wx, top, size, norm, mix(P.bg, P.fg, 0.08));
    const lx = two ? g.x : wx + size + g.g * 2, lw = two ? g.w - size - g.g * 3 : g.x + g.w - lx;
    let ly = two ? hd.bottom + g.bl * 3 : top;
    const lp = Math.max(12, Math.min(lw * 0.11, g.ts(0.6)));
    parts.slice(0, 4).forEach((p) => {
      c.fillStyle = p.color; rr(c, lx, ly, lp * 0.9, lp * 0.9, lp * 0.2); c.fill();
      const vp = lp * 2;
      tabular(c, k.d.kind === 'balance' ? p.value : rows(k, P).find((x) => x.label === p.label)?.value ?? p.value, lx, ly + lp * 0.9 + vp, ff('tight', vp, 800), P.fg);
      label(c, p.label, lx, ly + lp * 0.9 + vp + lp * 1.3, 'tight', lp * 0.8, P.muted, { weight: 600, maxW: lw });
      ly += lp * 0.9 + vp + lp * 2.6;
    });
    label(c, k.d.kind === 'balance' ? 'Each square ≈ 1% of seats' : 'Each square = 1% of the vote', g.x, g.H - g.m * 1.25, 'tight', sp * 0.85, P.muted, { upper: false, weight: 500 });
    footer(k, g, P);
  },
};

/* ───────── 15. Forecast needle ───────── */
const needleCard: Design = {
  id: 'needle', name: 'Needle gauge', kinds: ['race', 'flip', 'au-seat', 'candidate'], size: X, isNew: true, premium: true, fluid: true, ownBg: true, fonts: ['Inter Tight', 'Fraunces'],
  draw(k) {
    const g = grid(k), c = k.raw!;
    const P = pal(k, { bg: '#f7f5f0', fg: '#141414', accent: '#141414' });
    paint(k, P, { type: 'grain', seed: 12, colors: [P.bg, P.bg, P.bg], intensity: 0.1 });
    const r = rows(k, P, 2);
    const sp = Math.max(11, g.ts(-1.2));
    label(c, kicker(k), g.x, g.y + sp, 'tight', sp, P.muted, { weight: 700 });
    const hd = head(k, P, plain(k.d.title), g.x, g.y + sp * 2.3, g.w, g.h * 0.16, { fam: 'fraunces', max: g.ts(4.2), weight: 700, lh: 1, maxLines: 1 });
    const top = hd.bottom + g.bl * 2;
    const avH = g.H - g.m * 1.6 - top;
    const R = Math.min(g.w * 0.36, avH * 0.86);
    const cx = g.W / 2, cy = top + R;
    const a = r[0], b = r[1];
    if (a && b) {
      const share = a.num + b.num > 0 ? (a.num / (a.num + b.num)) * 100 : 50;
      needle(c, cx, cy, R, 100 - share, { left: a.color, right: b.color, track: mix(P.bg, P.fg, 0.12), fg: P.fg, ticks: rgba(P.fg.startsWith('#') ? P.fg : '#000000', 0.35) });
      const vp = Math.min(g.ts(4.5), (g.w / 2 - R) * 0.42 + R * 0.2);
      [a, b].forEach((x, i) => {
        const al = i ? 'right' : 'left';
        const xx = i ? g.x + g.w : g.x;
        tabular(c, x.value, xx, cy - vp * 0.3, ff('tight', vp, 800), x.color, al);
        label(c, x.label, xx, cy + sp * 0.9, 'tight', sp, P.fg, { align: al, weight: 700, upper: false, maxW: g.w / 2 - R * 1.05 });
      });
      label(c, 'Share of the two-way vote', cx, cy + sp * 1.8, 'tight', sp * 0.85, P.muted, { align: 'center', weight: 600 });
    } else dataViz(k, P, g.x, top, g.w, avH);
    footer(k, g, P);
  },
};

/* ───────── 16. Hex board ───────── */
const hexBoard: Design = {
  id: 'hex-board', name: 'Hex map board', kinds: ['race', 'flip', 'au-seat', 'candidate', 'promo', 'balance', 'custom'], size: X, isNew: true, premium: true, fluid: true, ownBg: true, fonts: ['Inter Tight'],
  draw(k) {
    const g = grid(k), c = k.raw!;
    const P = pal(k, { bg: '#0c0e14', fg: '#f2f4f8', accent: '#ffd400' });
    paint(k, P, { type: 'grain', seed: 21, colors: [P.bg, '#1a2030', '#141826'], intensity: 0.3 });
    const two = !g.portrait;
    const mapW = two ? g.w * 0.56 : g.w, mapH = two ? g.h : g.h * 0.42;
    const mx = two ? g.x + g.w - mapW : g.x, my = two ? g.y : g.y + g.h * 0.2;
    const ms = k.d.mapState;
    const au = ms?.startsWith('AU:');
    const fill = (abbr: string) => {
      // real 2024 presidential winner by state, muted, as context
      return mix(P.bg, P.fg, 0.12) + (abbr ? '' : '');
    };
    hexMap(c, ms, mx, my, mapW, mapH, { base: mix(P.bg, P.fg, 0.13), hi: P.accent, labels: au ? undefined : rgba(P.fg.startsWith('#') ? P.fg : '#ffffff', 0.45), fillFor: fill });
    const tw = two ? g.w - mapW - g.g * 2 : g.w;
    const ty = two ? g.y : g.y;
    const sp = Math.max(11, g.ts(-1.2));
    label(c, kicker(k), g.x, ty + sp, 'tight', sp, P.accent, { weight: 800 });
    const hd = head(k, P, plain(k.d.title), g.x, ty + sp * 2.4, tw, (two ? g.h : g.h * 0.18) * 0.35, { fam: 'tight', max: g.ts(5), weight: 800, lh: 1, maxLines: 3 });
    const vy = two ? hd.bottom + g.bl * 3 : my + mapH + g.bl * 2;
    dataViz(k, P, g.x, vy, tw, g.H - g.m * 1.6 - vy, { fam: 'tight', numFam: 'tight' });
    footer(k, g, P);
  },
};

/* ───────── 17. Flag stripes ───────── */
const stripes: Design = {
  id: 'stripes', name: 'Flag stripes banner', kinds: ALLK, size: X, isNew: true, premium: true, fluid: true, ownBg: true, fonts: ['Archivo Black', 'Inter Tight'],
  draw(k) {
    const g = grid(k), c = k.raw!;
    const P = pal(k, { bg: '#0e1a3a', fg: '#ffffff', accent: '#e8112d' });
    paint(k, P, { type: 'stripes', seed: 1776, colors: [P.bg, P.accent, '#f4f1ea', '#2c4bd4'], intensity: 0.55 });
    const pw = g.wide ? g.w * 0.62 : g.w + g.m * 0.4;
    const px = g.x - g.m * 0.2, py = g.wide ? g.y - g.m * 0.2 : g.H * 0.3, ph = (g.wide ? g.h + g.m * 0.4 : g.H - py - g.m * 0.8);
    c.save(); c.shadowColor = 'rgba(0,0,0,0.45)'; c.shadowBlur = g.m * 0.6; c.shadowOffsetY = g.m * 0.15;
    rr(c, px, py, pw, ph, g.bl); c.fillStyle = P.bg; c.fill(); c.restore();
    c.fillStyle = P.accent; c.fillRect(px, py, g.bl * 1.2, ph);
    const ix = px + g.m * 0.55, iw = pw - g.m * 0.9;
    const sp = Math.max(11, g.ts(-1.2));
    label(c, kicker(k), ix, py + g.m * 0.45 + sp, 'tight', sp, P.accent === '#e8112d' ? '#ff6b7d' : P.accent, { weight: 800 });
    const msg = isMsg(k);
    const hd = head(k, P, plain(k.d.title), ix, py + g.m * 0.45 + sp * 2.4, iw, ph * (msg ? 0.62 : 0.36), { fam: 'archivo', max: g.ts(6), weight: 400, upper: true, lh: 0.98, maxLines: 4 });
    let y = hd.bottom + g.bl * 1.5;
    const dek = plain(k.d.subtitle ?? k.d.quoteBy ?? '');
    if (dek) y = head(k, P, dek, ix, y, iw, g.ts(1.1) * 2.8, { fam: 'tight', max: g.ts(1.05), weight: 500, lh: 1.3, maxLines: 2, color: P.muted }).bottom + g.bl * 2;
    if (!msg) dataViz(k, P, ix, y, iw, py + ph - g.m * 0.95 - y, { fam: 'tight', numFam: 'archivo' });
    const fg = { ...P };
    footer(k, { ...g, x: ix, w: iw }, fg, { rule: false, y: py + ph - g.m * 0.35 });
  },
};

/* ───────── 18. Swing arrows ───────── */
const swing: Design = {
  id: 'swing', name: 'Swing arrows', kinds: ['au-seat', 'flip', 'race'], size: SQ, isNew: true, premium: true, fluid: true, ownBg: true, fonts: ['Inter Tight'],
  draw(k) {
    const g = grid(k), c = k.raw!;
    const P = pal(k, { bg: '#f6f4ef', fg: '#141414', accent: '#141414' });
    paint(k, P, { type: 'grain', seed: 18, colors: [P.bg, P.bg, P.bg], intensity: 0.1 });
    const sp = Math.max(11, g.ts(-1.2));
    label(c, kicker(k), g.x, g.y + sp, 'tight', sp, P.muted, { weight: 700 });
    const hd = head(k, P, plain(k.d.title), g.x, g.y + sp * 2.4, g.w, g.h * 0.2, { fam: 'tight', max: g.ts(5), weight: 800, lh: 1, maxLines: 2 });
    const dek = plain(k.d.subtitle ?? '');
    let y = hd.bottom + g.bl * 1.2;
    if (dek) y = head(k, P, dek, g.x, y, g.w, g.ts(1.1) * 2.8, { fam: 'tight', max: g.ts(1.05), weight: 500, lh: 1.3, maxLines: 2, color: P.muted }).bottom + g.bl * 2;
    const r = rows(k, P, 3);
    // margin = lead − second (pp); for AU seats the stat is the 2PP margin itself
    const lead = r[0];
    const margin = k.d.kind === 'au-seat' ? parseFloat(lead?.value ?? '0') || 0 : (r[0]?.num ?? 0) - (r[1]?.num ?? 0);
    const area = g.H - g.m * 1.6 - y;
    const ms = k.d.mapState;
    if (ms) { c.save(); c.globalAlpha = 0.9; silhouette(c, ms, g.x, y, g.w * 0.5, area * 0.9, { fill: mix(P.bg, P.fg, 0.1), stroke: mix(P.bg, P.fg, 0.35) }); c.restore(); }
    const ax = ms ? g.x + g.w * 0.25 : g.x + g.w * 0.3, ay = y + area * 0.55;
    if (lead) {
      swingArrow(c, ax, ay, g.w * 0.45, margin >= 0 ? Math.max(1.5, Math.abs(margin)) : -Math.max(1.5, Math.abs(margin)), lead.color, { scale: 12, thickness: g.w * 0.035 });
      const vp = g.ts(6);
      const vx = g.x + g.w;
      tabular(c, `${margin >= 0 ? '+' : '−'}${Math.abs(margin).toFixed(1)}`, vx, y + area * 0.3 + vp * 0.6, ff('tight', vp, 900), lead.color, 'right');
      label(c, k.d.kind === 'au-seat' ? `${lead.label} margin (2PP), pts` : `${lead.label} lead, pts`, vx, y + area * 0.3 + vp * 0.6 + sp * 1.8, 'tight', sp, P.fg, { align: 'right', weight: 700, maxW: g.w * 0.5 });
      const rest = r.slice(k.d.kind === 'au-seat' ? 1 : 0);
      let ly = y + area * 0.78;
      rest.slice(0, 2).forEach((x) => { label(c, `${x.label}  ${x.value}`, vx, ly, 'tight', sp * 1.05, P.muted, { align: 'right', upper: false, weight: 600, maxW: g.w * 0.5 }); ly += sp * 1.9; });
    }
    footer(k, g, P);
  },
};

/* ───────── 19. Newswire ───────── */
const wire: Design = {
  id: 'wire', name: 'Newswire bulletin', kinds: ALLK, size: PT, isNew: true, premium: true, fluid: true, ownBg: true, fonts: ['IBM Plex Mono', 'Inter Tight'],
  draw(k) {
    const g = grid(k, { margin: 0.07 }), c = k.raw!;
    const P = pal(k, { bg: '#f1eee6', fg: '#16140f', accent: '#c4271b' });
    paint(k, P, { type: 'paper', seed: 72, colors: [P.bg, P.accent, P.fg], intensity: 0.35 });
    const mp = Math.max(11, g.ts(-0.9));
    let y = g.y + mp;
    label(c, 'POLTOK-WIRE', g.x, y, 'plex', mp, P.fg, { weight: 700, tracking: 0.08 });
    label(c, '— URGENT —', g.x + g.w, y, 'plex', mp, P.accent, { weight: 700, align: 'right' });
    y += mp * 0.8;
    c.fillStyle = P.fg; for (let i = 0; i < 2; i++) c.fillRect(g.x, y + i * g.bl * 0.7, g.w, Math.max(1, g.bl * 0.15));
    y += g.bl * 2.5 + mp;
    label(c, `${kicker(k)} / ${dateline(k)}`, g.x, y, 'plex', mp * 0.92, P.muted, { upper: true, maxW: g.w });
    y += mp * 1.6;
    const msg = isMsg(k);
    const avail = g.H - g.m * 1.6 - y;
    const hd = head(k, P, plain(k.d.title).toUpperCase(), g.x, y, g.w, avail * (msg ? 0.55 : 0.3), { fam: 'plex', max: g.ts(4.2), weight: 700, lh: 1.12, maxLines: 4 });
    y = hd.bottom + g.bl * 2;
    const dek = plain(k.d.subtitle ?? k.d.quoteBy ?? '');
    if (dek) y = head(k, P, dek, g.x, y, g.w, g.ts(1.4) * 4.2, { fam: 'plex', max: g.ts(1.1), weight: 400, lh: 1.4, maxLines: 3, color: mix(P.fg, P.bg, 0.15) }).bottom + g.bl * 3;
    if (!msg) {
      const r = rows(k, P, 5);
      if (k.d.kind === 'balance' || k.d.series) dataViz(k, P, g.x, y, g.w, g.H - g.m * 1.7 - y, { fam: 'plex', numFam: 'plex' });
      else {
        const rp = Math.min(g.ts(1.6), (g.H - g.m * 1.8 - y) / Math.max(3, r.length * 1.9));
        r.forEach((x) => {
          c.save(); c.font = ff('plex', rp, 500);
          const lab = x.label.toUpperCase();
          const vw = c.measureText(x.value).width;
          let L = lab; while (L.length > 3 && c.measureText(L).width > g.w - vw - rp * 3) L = L.slice(0, -1);
          c.fillStyle = P.fg; c.textAlign = 'left'; c.fillText(L, g.x, y + rp);
          const lw = c.measureText(L).width;
          c.fillStyle = P.line; let dx = g.x + lw + rp * 0.6; const dw = c.measureText('.').width * 1.4; while (dx < g.x + g.w - vw - rp * 0.6) { c.fillText('.', dx, y + rp); dx += dw; }
          c.restore();
          tabular(c, x.value, g.x + g.w, y + rp, ff('plex', rp, 700), x.color, 'right');
          y += rp * 1.9;
        });
        label(c, '-- MORE --', g.W / 2, y + rp, 'plex', mp, P.muted, { align: 'center' });
      }
    } else label(c, '-- 30 --', g.W / 2, y + mp * 2, 'plex', mp, P.muted, { align: 'center' });
    footer(k, g, P, { fam: 'plex' });
  },
};

/* ───────── 20. 3D extruded number ───────── */
const extrude: Design = {
  id: 'extrude', name: '3D extruded number', kinds: ['race', 'flip', 'au-seat', 'stat', 'balance', 'candidate', 'milestone', 'promo'], size: SQ, isNew: true, premium: true, fluid: true, ownBg: true, fonts: ['Bricolage Grotesque', 'Inter Tight'],
  draw(k) {
    const g = grid(k), c = k.raw!;
    const P = pal(k, { bg: '#ff5b2e', fg: '#140c08', accent: '#fff2e6' });
    paint(k, P, { type: 'extrude', seed: 99, colors: [P.bg, mix(P.bg, '#ffffff', 0.25), mix(P.bg, '#000000', 0.2)], intensity: 0.35 });
    const h0 = hero(k);
    const sp = Math.max(11, g.ts(-1.2));
    label(c, kicker(k), g.x, g.y + sp, 'tight', sp, P.fg, { weight: 800 });
    const val = h0.value || (k.d.stats?.[0]?.value ?? '');
    const vy = g.H * (g.tall ? 0.42 : 0.52);
    if (val) {
      const vp = fitNum(c, val, g.w * 0.98, g.h * (g.wide ? 0.62 : 0.44), 'bricolage', 800);
      const depth = vp * 0.1;
      c.save(); c.font = ff('bricolage', vp, 800); track(c, vp, -0.04); c.textAlign = 'center'; c.textBaseline = 'alphabetic';
      const cx = g.W / 2 - depth * 0.35, by = vy + vp * 0.35;
      for (let i = Math.round(depth); i > 0; i -= 1) { c.fillStyle = mix(P.fg, P.bg, 0.15 + (i / depth) * 0.1); c.fillText(val, cx + i * 0.7, by + i); }
      const gr = c.createLinearGradient(0, by - vp * 0.8, 0, by);
      gr.addColorStop(0, P.accent); gr.addColorStop(1, mix(P.accent, P.bg, 0.18));
      c.fillStyle = gr; c.fillText(val, cx, by);
      c.lineWidth = Math.max(1, vp * 0.008); c.strokeStyle = P.fg; c.strokeText(val, cx, by);
      c.restore();
      label(c, h0.label || k.d.stats?.[0]?.label || '', g.W / 2, by + depth + sp * 2.2, 'tight', sp * 1.2, P.fg, { align: 'center', weight: 800, maxW: g.w });
    }
    const top = vy + g.h * 0.24;
    const hd = head(k, P, plain(k.d.title), g.x, Math.min(top, g.H - g.m * 1.6 - g.ts(3.5) * 2.2), g.w, g.ts(3.5) * 2.2, { fam: 'bricolage', max: g.ts(3.5), weight: 800, lh: 1, maxLines: 2, align: 'center' });
    void hd;
    footer(k, g, { ...P, line: rgba('#000000', 0.2), muted: mix(P.fg, P.bg, 0.2) });
  },
};

export const DESIGNS_F: Design[] = [frontPage, magCover, cinema, swissData, nightBoard, luxe, neonNight, riso, collage, isoMap, topo, glass, duotone, waffleCard, needleCard, hexBoard, stripes, swing, wire, extrude];
void VOICE; void regionPath; void (null as unknown as Ctx);
