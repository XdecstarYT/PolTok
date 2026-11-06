/**
 * PolTok brand identity — logo geometry as vector paths (one source for SVG + canvas/PNG).
 * Mark = D-blue "P" bar + R-red "T" bar + lime dot (from public/favicon.svg), optional container.
 * Wordmark = geometric letterforms built from paths (no font needed, so SVG export is pure vector).
 */
export interface BrandPalette { bg: string; surface: string; fg: string; muted: string; dem: string; rep: string; dot: string; light: string; ink: string }
export type Container = 'rounded' | 'circle' | 'square' | 'none';
export type DotShape = 'circle' | 'square' | 'diamond';
export interface LogoStyle { id: string; label: string; weight: number; container: Container; dot: DotShape; radius: number; tokAccent: boolean }
export interface Brand { name: string; palette: BrandPalette; logo: LogoStyle; tagline: string; fontDisplay: string; fontBody: string }
export type LogoVariant = 'full' | 'stacked' | 'monogram' | 'icon';
export type LogoMode = 'dark' | 'light' | 'mono-dark' | 'mono-light';

export const HOUSE_PALETTE: BrandPalette = { bg: '#05070d', surface: '#121726', fg: '#f2f5ff', muted: '#a3adc8', dem: '#3d7bff', rep: '#ff3d55', dot: '#c6ff3d', light: '#f6f7fb', ink: '#0a0f00' };
export const LOGO_STYLES: LogoStyle[] = [
  { id: 'classic', label: 'Classic (house)', weight: 6, container: 'rounded', dot: 'circle', radius: 14, tokAccent: true },
  { id: 'bold', label: 'Bold', weight: 8, container: 'rounded', dot: 'circle', radius: 10, tokAccent: true },
  { id: 'badge', label: 'Badge (circle)', weight: 6, container: 'circle', dot: 'circle', radius: 32, tokAccent: true },
  { id: 'editorial', label: 'Editorial (square dot)', weight: 5, container: 'square', dot: 'square', radius: 0, tokAccent: false },
  { id: 'signal', label: 'Signal (diamond dot)', weight: 7, container: 'rounded', dot: 'diamond', radius: 20, tokAccent: true },
  { id: 'open', label: 'Open (no container)', weight: 6, container: 'none', dot: 'circle', radius: 0, tokAccent: true },
];
export const DEFAULT_BRAND: Brand = { name: 'PolTok', palette: HOUSE_PALETTE, logo: LOGO_STYLES[0], tagline: 'Every race. Every call. Live.', fontDisplay: 'Space Grotesk', fontBody: 'Inter' };

/** A filled shape: SVG path data + fill-rule + colour role. */
export interface Shape { d: string; role: 'container' | 'dem' | 'rep' | 'dot' | 'word' | 'tok'; rule?: 'evenodd' }
export interface Lockup { w: number; h: number; shapes: Shape[] }

const n = (v: number) => +v.toFixed(2);
const rect = (x: number, y: number, w: number, h: number) => `M${n(x)} ${n(y)}h${n(w)}v${n(h)}h${n(-w)}z`;
const circ = (cx: number, cy: number, r: number) => `M${n(cx - r)} ${n(cy)}a${n(r)} ${n(r)} 0 1 0 ${n(2 * r)} 0a${n(r)} ${n(r)} 0 1 0 ${n(-2 * r)} 0z`;
const rrect = (x: number, y: number, w: number, h: number, r: number) => {
  r = Math.min(r, w / 2, h / 2);
  if (r <= 0) return rect(x, y, w, h);
  return `M${n(x + r)} ${n(y)}H${n(x + w - r)}A${n(r)} ${n(r)} 0 0 1 ${n(x + w)} ${n(y + r)}V${n(y + h - r)}A${n(r)} ${n(r)} 0 0 1 ${n(x + w - r)} ${n(y + h)}H${n(x + r)}A${n(r)} ${n(r)} 0 0 1 ${n(x)} ${n(y + h - r)}V${n(y + r)}A${n(r)} ${n(r)} 0 0 1 ${n(x + r)} ${n(y)}z`;
};
const poly = (pts: number[][]) => 'M' + pts.map(([x, y]) => `${n(x)} ${n(y)}`).join('L') + 'z';
const translate = (d: string, dx: number, dy: number, k = 1) =>
  // only absolute commands are emitted by the glyph builders below, except a/h/v (relative) — scale those, offset absolutes
  d.replace(/([MLHVAhva])([^MLHVAhvaz]*)/g, (_m, c: string, args: string) => {
    const v = args.trim().split(/[\s,]+/).filter(Boolean).map(Number);
    const o: number[] = [];
    if (c === 'M' || c === 'L') for (let i = 0; i < v.length; i += 2) o.push(v[i] * k + dx, v[i + 1] * k + dy);
    else if (c === 'H') v.forEach((x) => o.push(x * k + dx));
    else if (c === 'V') v.forEach((y) => o.push(y * k + dy));
    else if (c === 'A') for (let i = 0; i < v.length; i += 7) o.push(v[i] * k, v[i + 1] * k, v[i + 2], v[i + 3], v[i + 4], v[i + 5] * k + dx, v[i + 6] * k + dy);
    else if (c === 'a') for (let i = 0; i < v.length; i += 7) o.push(v[i] * k, v[i + 1] * k, v[i + 2], v[i + 3], v[i + 4], v[i + 5] * k, v[i + 6] * k);
    else v.forEach((x) => o.push(x * k));
    return c + o.map(n).join(' ');
  });

/** Mark in a 64×64 box (favicon geometry, weight-adjustable). */
export function markShapes(st: LogoStyle, withContainer: boolean): Shape[] {
  const sw = st.weight;
  const out: Shape[] = [];
  if (withContainer && st.container !== 'none') {
    out.push({ role: 'container', d: st.container === 'circle' ? circ(32, 32, 32) : rrect(0, 0, 64, 64, st.container === 'square' ? 0 : st.radius) });
  }
  const top = 20, bot = 44, px = 14;
  out.push({ role: 'dem', d: `M${px} ${bot}V${top}H26A8 8 0 0 1 26 36H${px + sw}V${bot}z` });
  out.push({ role: 'rep', d: `M34 ${top}H52V${top + sw}H${43 + sw / 2}V${bot}H${43 - sw / 2}V${top + sw}H34z` });
  const r = 4;
  out.push({ role: 'dot', d: st.dot === 'square' ? rect(52 - r, 44 - r, 2 * r, 2 * r) : st.dot === 'diamond' ? poly([[52, 44 - r * 1.3], [52 + r * 1.3, 44], [52, 44 + r * 1.3], [52 - r * 1.3, 44]]) : circ(52, 44, r) });
  return out;
}

/** Geometric "PolTok" wordmark, cap height 100, baseline y=100. Returns shapes + advance width. */
export function wordShapes(st: LogoStyle): { shapes: Shape[]; w: number } {
  const s = 10 + st.weight * 2; // stroke
  const gap = s * 0.7;
  const shapes: Shape[] = [];
  let x = 0;
  const glyph = (role: Shape['role'], d: string, w: number, rule?: 'evenodd') => { shapes.push({ role, d: translate(d, x, 0), rule }); x += w + gap; };
  // P — stem + bowl with counter
  const bh = 58, R = bh / 2, Wp = 64;
  glyph('word', `M0 0H${Wp - R}A${R} ${R} 0 0 1 ${Wp - R} ${bh}H${s}V100H0z` + `M${s} ${s}H${Wp - R}A${R - s} ${R - s} 0 0 1 ${Wp - R} ${bh - s}H${s}z`, Wp, 'evenodd');
  // o
  const ro = 36;
  glyph('word', circ(ro, 100 - ro, ro) + circ(ro, 100 - ro, ro - s), ro * 2, 'evenodd');
  // l
  glyph('word', rect(0, 0, s, 100), s);
  const tokRole: Shape['role'] = st.tokAccent ? 'tok' : 'word';
  // T
  const Wt = 66;
  glyph(tokRole, `M0 0H${Wt}V${s}H${Wt / 2 + s / 2}V100H${Wt / 2 - s / 2}V${s}H0z`, Wt);
  glyph(tokRole, circ(ro, 100 - ro, ro) + circ(ro, 100 - ro, ro - s), ro * 2, 'evenodd');
  // k — stem, arm (to x-height), leg (to baseline); diagonals of perpendicular thickness s, ends cut horizontally
  const Wk = 62, xh = 28;
  const diag = (x0: number, y0: number, x1: number, y1: number) => {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), hw = (s / 2) * (L / Math.abs(dy)); // horizontal half-width
    return poly([[x0 - hw, y0], [x1 - hw, y1], [x1 + hw, y1], [x0 + hw, y0]]);
  };
  const jy = 70; // junction height on the stem
  const armX1 = Wk - s * 0.75;
  // separate shapes so overlaps never cancel (opposite windings)
  for (const part of [diag(s * 0.5, jy + s * 0.4, armX1, xh), diag(s * 1.15, 60, Wk - s * 0.6, 100)]) shapes.push({ role: tokRole, d: translate(part, x, 0) });
  glyph(tokRole, rect(0, 0, s, 100), Wk);
  return { shapes, w: x - gap };
}

const shift = (sh: Shape[], dx: number, dy: number, k: number) => sh.map((s) => ({ ...s, d: translate(s.d, dx, dy, k) }));

/** Logo lockup in its own coordinate box (clear space excluded). */
export function lockup(st: LogoStyle, variant: LogoVariant): Lockup {
  if (variant === 'icon') return { w: 64, h: 64, shapes: markShapes(st, true) };
  if (variant === 'monogram') {
    // PT bars + dot without container, cropped to the glyph box (x 14..56, y 20..48)
    return { w: 44, h: 30, shapes: shift(markShapes(st, false), -13, -19, 1) };
  }
  const word = wordShapes(st);
  if (variant === 'full') {
    const mh = 100; // mark height = cap height × 1 in word units
    const k = mh / 64;
    const gapX = 30;
    return { w: mh + gapX + word.w, h: mh, shapes: [...shift(markShapes(st, true), 0, 0, k), ...shift(word.shapes, mh + gapX, 0, 1)] };
  }
  // stacked
  const mh = 140, k = mh / 64, wk = 0.62;
  const ww = word.w * wk;
  const W = Math.max(mh, ww);
  return { w: W, h: mh + 36 + 100 * wk, shapes: [...shift(markShapes(st, true), (W - mh) / 2, 0, k), ...shift(word.shapes, (W - ww) / 2, mh + 36, wk)] };
}

/** Clear space = ¼ of the mark height on every side (the T crossbar + gap); min sizes in px. */
export const clearSpace = (lk: Lockup, variant: LogoVariant) => (variant === 'full' ? lk.h : variant === 'stacked' ? lk.h * 0.5 : lk.h) * 0.25;
export const MIN_SIZE: Record<LogoVariant, string> = { full: '24px tall (screen) / 8mm (print)', stacked: '48px tall / 16mm', monogram: '16px tall', icon: '16px (favicon)' };

/** Colours for each role in a mode. Light backgrounds swap the lime dot for a deep green (≥3:1). */
export function roleColors(p: BrandPalette, mode: LogoMode, st: LogoStyle): Record<Shape['role'], string> & { bg: string } {
  if (mode === 'mono-dark' || mode === 'mono-light') {
    const fg = mode === 'mono-dark' ? '#ffffff' : '#000000';
    const bg = mode === 'mono-dark' ? '#000000' : '#ffffff';
    // single-ink: container takes ink, marks knock out
    return { bg, container: fg, dem: bg, rep: bg, dot: bg, word: fg, tok: fg };
  }
  const light = mode === 'light';
  const bg = light ? p.light : p.bg;
  const deepDot = light && lum(p.dot) > 0.5 ? darken(p.dot, 0.45) : p.dot;
  return {
    bg,
    container: light ? (st.container === 'none' ? bg : '#0b0e18') : p.surface,
    dem: p.dem, rep: p.rep, dot: light && st.container === 'none' ? deepDot : p.dot,
    word: light ? '#0b0e18' : p.fg,
    tok: st.tokAccent ? deepDot : light ? '#0b0e18' : p.fg,
  };
}

function colorsFor(b: Brand, lk: Lockup, mode: LogoMode) {
  const c = roleColors(b.palette, mode, b.logo);
  if (mode.startsWith('mono') && !lk.shapes.some((s) => s.role === 'container')) { const ink = c.word; return { ...c, dem: ink, rep: ink, dot: ink }; }
  return c;
}

/** Standalone SVG (pure vector paths). pad = clear space in logo units (default: the rule). */
export function logoSvg(brand: Brand, variant: LogoVariant, mode: LogoMode, opts: { pad?: number; bg?: boolean; px?: number } = {}): string {
  const lk = lockup(brand.logo, variant);
  const pad = opts.pad ?? clearSpace(lk, variant);
  const c = colorsFor(brand, lk, mode);
  const W = lk.w + pad * 2, H = lk.h + pad * 2;
  const px = opts.px ? ` width="${Math.round((opts.px * W) / H)}" height="${opts.px}"` : '';
  const body = lk.shapes.map((s) => `<path d="${s.d}" fill="${c[s.role]}"${s.rule ? ' fill-rule="evenodd"' : ''}/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n(-pad)} ${n(-pad)} ${n(W)} ${n(H)}"${px} role="img" aria-label="${esc(brand.name)} logo">${opts.bg !== false ? `<rect x="${n(-pad)}" y="${n(-pad)}" width="${n(W)}" height="${n(H)}" fill="${c.bg}"/>` : ''}<g>${body}</g></svg>`;
}

/** Draw a lockup on canvas fitting box (x,y,w,h), centred. Returns drawn rect. */
export function drawLogo(ctx: CanvasRenderingContext2D, brand: Brand, variant: LogoVariant, mode: LogoMode, box: { x: number; y: number; w: number; h: number }, align: 'center' | 'left' = 'center') {
  const lk = lockup(brand.logo, variant);
  const k = Math.min(box.w / lk.w, box.h / lk.h);
  const dw = lk.w * k, dh = lk.h * k;
  const x = align === 'left' ? box.x : box.x + (box.w - dw) / 2, y = box.y + (box.h - dh) / 2;
  const c = colorsFor(brand, lk, mode);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  for (const s of lk.shapes) { ctx.fillStyle = c[s.role]; ctx.fill(new Path2D(s.d), s.rule ?? 'nonzero'); }
  ctx.restore();
  return { x, y, w: dw, h: dh };
}

/** PNG of a logo at a given height (px), transparent or with background, including clear space. */
export function logoPng(brand: Brand, variant: LogoVariant, mode: LogoMode, height: number, withBg = false): Promise<Blob> {
  const lk = lockup(brand.logo, variant);
  const pad = clearSpace(lk, variant);
  const k = height / (lk.h + pad * 2);
  const cv = document.createElement('canvas');
  cv.width = Math.round((lk.w + pad * 2) * k);
  cv.height = Math.round(height);
  const ctx = cv.getContext('2d')!;
  if (withBg) { ctx.fillStyle = roleColors(brand.palette, mode, brand.logo).bg; ctx.fillRect(0, 0, cv.width, cv.height); }
  drawLogo(ctx, brand, variant, mode, { x: pad * k, y: pad * k, w: lk.w * k, h: lk.h * k });
  return new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('png'))), 'image/png'));
}

// ---- colour helpers ----
export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const hex = (h: string) => { const m = /^#?([0-9a-f]{6})$/i.exec(h.trim()); const v = m ? parseInt(m[1], 16) : 0; return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
export function lum(h: string) { const [r, g, b] = hex(h).map((c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }
export function contrast(a: string, b: string) { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); }
export function darken(h: string, f: number) { return '#' + hex(h).map((c) => Math.round(c * (1 - f)).toString(16).padStart(2, '0')).join(''); }
export const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
