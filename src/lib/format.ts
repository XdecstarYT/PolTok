import type { Lean, Party, Rating } from '../types';

export const PARTY_COLOR: Record<Party, string> = {
  D: 'var(--dem)',
  R: 'var(--rep)',
  I: 'var(--ind)',
  L: 'var(--lib)',
  G: 'var(--grn)',
  O: 'var(--oth)',
};

/** Raw hex values for canvas / d3 where CSS vars can't be used. */
export const PARTY_HEX: Record<Party, string> = {
  D: '#3d7bff',
  R: '#ff3d55',
  I: '#a96bff',
  L: '#f5c518',
  G: '#2ecc71',
  O: '#8b93a7',
};

export const PARTY_NAME: Record<Party, string> = {
  D: 'Democrat',
  R: 'Republican',
  I: 'Independent',
  L: 'Libertarian',
  G: 'Green',
  O: 'Other',
};

export const RATINGS: Rating[] = ['Solid D', 'Likely D', 'Lean D', 'Toss-up', 'Lean R', 'Likely R', 'Solid R'];

export const RATING_HEX: Record<Rating, string> = {
  'Solid D': '#1f5eff',
  'Likely D': '#4f86ff',
  'Lean D': '#93b4ff',
  'Toss-up': '#f5c518',
  'Lean R': '#ff9aa8',
  'Likely R': '#ff5c72',
  'Solid R': '#e01e3c',
};

export const LEAN_HEX: Record<Lean, string> = {
  Left: '#1f5eff',
  'Lean Left': '#7aa2ff',
  Center: '#b9a7ff',
  'Lean Right': '#ff8a9a',
  Right: '#e01e3c',
  Unrated: '#6b7280',
};

/** Blend between dem and rep hex by margin (-1..1, positive = D). */
export function marginColor(marginPct: number, max = 20): string {
  const t = Math.max(-1, Math.min(1, marginPct / max));
  const base = '#2a2f3d';
  const target = t >= 0 ? PARTY_HEX.D : PARTY_HEX.R;
  return mixHex(base, target, Math.abs(t) * 0.85 + 0.15);
}

export function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => [(s >> 16) & 255, (s >> 8) & 255, s & 255];
  const [ar, ag, ab] = ch(pa);
  const [br, bg, bb] = ch(pb);
  const m = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `#${((1 << 24) | (m(ar, br) << 16) | (m(ag, bg) << 8) | m(ab, bb)).toString(16).slice(1)}`;
}

const nf = new Intl.NumberFormat('en-US');
export const fmtInt = (n: number) => nf.format(Math.round(n));
export const fmtPct = (n: number, d = 1) => `${n.toFixed(d)}%`;
export const fmtMargin = (party: Party, m: number) => `${party}+${Math.abs(m).toFixed(1)}`;

export function timeAgo(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
