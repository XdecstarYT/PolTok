/** Colour-theory palettes (complementary / analogous / triadic / split / mono) with WCAG-checked text colour. */
import { contrast } from './kit';
import { prng, type Background, type BgType } from './bg';

export type Harmony = 'complementary' | 'analogous' | 'triadic' | 'split' | 'mono';
export const HARMONIES: Harmony[] = ['complementary', 'analogous', 'triadic', 'split', 'mono'];

export function hsl(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const hx = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${hx(r)}${hx(g)}${hx(b)}`;
}

/** Adjusts lightness of `c` (hue/sat kept) until it reaches `min` contrast on `bg`. */
export function ensureContrast(fgH: number, fgS: number, fgL: number, bg: string, min = 4.5): string {
  const dark = contrast('#000000', bg) > contrast('#ffffff', bg);
  let l = fgL;
  for (let i = 0; i < 40; i++) {
    const c = hsl(fgH, fgS, l);
    if (contrast(c, bg) >= min) return c;
    l += dark ? -0.025 : 0.025;
  }
  return dark ? '#0b0d14' : '#ffffff';
}

export interface Harmonized { scheme: Harmony; bg: string; fg: string; accent: string; colors: string[]; dark: boolean }

/** Deterministic palette for a seed. Accent is ≥3:1 on bg (large text), fg ≥ 7:1. */
export function harmonize(seed: number, scheme?: Harmony, dark?: boolean): Harmonized {
  const r = prng(seed * 7919 + 13);
  const sch = scheme ?? HARMONIES[Math.floor(r() * HARMONIES.length)];
  const isDark = dark ?? r() < 0.68;
  const h = Math.floor(r() * 360);
  const offs: Record<Harmony, number[]> = { complementary: [0, 180, 20], analogous: [0, 30, -30], triadic: [0, 120, 240], split: [0, 150, 210], mono: [0, 0, 12] };
  const hs = offs[sch].map((o) => h + o);
  const bg = isDark ? hsl(hs[0], 0.35 + r() * 0.25, 0.06 + r() * 0.05) : hsl(hs[0], 0.25 + r() * 0.3, 0.93 + r() * 0.04);
  const fg = ensureContrast(hs[0], 0.15, isDark ? 0.96 : 0.08, bg, 7);
  const accent = ensureContrast(hs[1], 0.75 + r() * 0.2, isDark ? 0.6 : 0.42, bg, 3);
  const c2 = hsl(hs[2], 0.7, isDark ? 0.45 : 0.62);
  const c3 = hsl(hs[1], 0.65, isDark ? 0.32 : 0.75);
  return { scheme: sch, bg, fg, accent, colors: [bg, accent, c2, c3], dark: isDark };
}

const SHUFFLE_BG: BgType[] = ['mesh', 'aurora', 'leak', 'grain', 'duotone', 'topo', 'stripes', 'glass', 'extrude', 'halftone', 'iso', 'paper'];
/** A full random style: palette + background spec from one seed. */
export function shuffleStyle(seed: number, scheme?: Harmony): { palette: { bg: string; fg: string; accent: string }; background: Background; harmony: Harmonized } {
  const hz = harmonize(seed, scheme);
  const r = prng(seed + 1);
  let type = SHUFFLE_BG[Math.floor(r() * SHUFFLE_BG.length)];
  if (type === 'paper' && hz.dark) type = 'grain';
  const loud = type === 'stripes' || type === 'extrude' || type === 'halftone' || type === 'iso';
  const intensity = +((loud ? 0.2 : 0.35) + r() * (loud ? 0.25 : 0.4)).toFixed(2);
  return { palette: { bg: hz.bg, fg: hz.fg, accent: hz.accent }, background: { type, seed, colors: hz.colors, intensity }, harmony: hz };
}
