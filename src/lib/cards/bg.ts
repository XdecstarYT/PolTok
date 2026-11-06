/**
 * Procedural premium backgrounds, fully deterministic from a seed (same spec → same pixels).
 * Exposed to styles as CardStyle.background = { type, seed, colors, intensity }.
 */
import { type Ctx, hexToRgb, mix, rgba, rr } from './kit';

export type BgType = 'mesh' | 'grain' | 'leak' | 'halftone' | 'duotone' | 'iso' | 'topo' | 'stripes' | 'glass' | 'extrude' | 'aurora' | 'paper';
export const BG_TYPES: BgType[] = ['mesh', 'grain', 'leak', 'halftone', 'duotone', 'iso', 'topo', 'stripes', 'glass', 'extrude', 'aurora', 'paper'];
export const BG_LABEL: Record<BgType, string> = {
  mesh: 'Mesh gradient', grain: 'Film grain', leak: 'Light leak', halftone: 'Halftone', duotone: 'Duotone noise', iso: 'Isometric',
  topo: 'Topographic', stripes: 'Flag stripes', glass: 'Glass panels', extrude: '3D shapes', aurora: 'Aurora', paper: 'Paper',
};
export interface Background {
  type: BgType;
  seed?: number;
  /** 2–5 colours, first is the base */
  colors?: string[];
  /** 0..1 */
  intensity?: number;
}

const HEX = /^#[0-9a-f]{6}$/i;
export function normBg(b?: Background | null): Required<Background> | null {
  if (!b || !BG_TYPES.includes(b.type)) return null;
  const colors = (b.colors ?? []).filter((c) => HEX.test(c)).slice(0, 5);
  while (colors.length < 3) colors.push(['#0b0d14', '#3d5afe', '#ff3d7f', '#ffd166'][colors.length + (colors.length ? 0 : 0)] ?? '#888888');
  return { type: b.type, seed: Math.abs(Math.floor(b.seed ?? 1)) % 1e9, colors, intensity: Math.max(0, Math.min(1, b.intensity ?? 0.6)) };
}

/** mulberry32 */
export function prng(seed: number) {
  let a = seed >>> 0 || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seeded 2D value noise with smooth interpolation. */
export function noise2(seed: number) {
  const r = prng(seed);
  const P = new Uint8Array(512);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) P[i] = p[i & 255];
  const V = Float32Array.from({ length: 256 }, () => r());
  const sm = (t: number) => t * t * (3 - 2 * t);
  const n = (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const h = (a: number, b: number) => V[P[(P[a & 255] + b) & 255]];
    const u = sm(xf), v = sm(yf);
    const a = h(xi, yi) + (h(xi + 1, yi) - h(xi, yi)) * u;
    const b = h(xi, yi + 1) + (h(xi + 1, yi + 1) - h(xi, yi + 1)) * u;
    return a + (b - a) * v;
  };
  return (x: number, y: number, oct = 4) => { let s = 0, amp = 0.5, f = 1, t = 0; for (let i = 0; i < oct; i++) { s += n(x * f, y * f) * amp; t += amp; amp *= 0.5; f *= 2.03; } return s / t; };
}

/** Adds monochrome film grain via ImageData (deterministic). */
export function filmGrain(ctx: Ctx, W: number, H: number, amount: number, seed: number) {
  if (amount <= 0) return;
  const r = prng(seed ^ 0xabc);
  const tile = 256;
  const c = document.createElement('canvas');
  c.width = c.height = tile;
  const x = c.getContext('2d')!;
  const im = x.createImageData(tile, tile);
  for (let i = 0; i < im.data.length; i += 4) { const v = r() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
  x.putImageData(im, 0, 0);
  ctx.save();
  ctx.globalAlpha = Math.min(0.5, amount);
  ctx.globalCompositeOperation = 'overlay';
  const pat = ctx.createPattern(c, 'repeat');
  if (pat) { ctx.fillStyle = pat; ctx.fillRect(0, 0, W, H); }
  ctx.restore();
}

function meshBlobs(ctx: Ctx, W: number, H: number, colors: string[], r: () => number, n = 6, blur = 0.12) {
  ctx.save();
  ctx.filter = `blur(${Math.round(Math.min(W, H) * blur)}px)`;
  for (let i = 0; i < n; i++) {
    const c = colors[1 + (i % (colors.length - 1))];
    const x = r() * W, y = r() * H, rad = Math.max(W, H) * (0.25 + r() * 0.35);
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, rgba(c, 0.95));
    g.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, rad, rad * (0.6 + r() * 0.6), r() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Marching squares contour lines of a noise field. */
function contours(ctx: Ctx, W: number, H: number, field: (x: number, y: number) => number, levels: number, step: number, color: (i: number) => string, lw: number) {
  const cols = Math.ceil(W / step) + 1, rows = Math.ceil(H / step) + 1;
  const v = new Float32Array(cols * rows);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) v[j * cols + i] = field(i * step, j * step);
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  for (let L = 1; L < levels; L++) {
    const t = L / levels;
    ctx.beginPath();
    for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols - 1; i++) {
      const a = v[j * cols + i], b = v[j * cols + i + 1], c = v[(j + 1) * cols + i + 1], d = v[(j + 1) * cols + i];
      const idx = (a > t ? 8 : 0) | (b > t ? 4 : 0) | (c > t ? 2 : 0) | (d > t ? 1 : 0);
      if (idx === 0 || idx === 15) continue;
      const x = i * step, y = j * step;
      const lerp = (p: number, q: number) => (t - p) / (q - p || 1e-6);
      const top: [number, number] = [x + step * lerp(a, b), y];
      const right: [number, number] = [x + step, y + step * lerp(b, c)];
      const bot: [number, number] = [x + step * lerp(d, c), y + step];
      const left: [number, number] = [x, y + step * lerp(a, d)];
      const seg = (p: [number, number], q: [number, number]) => { ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); };
      switch (idx) {
        case 1: case 14: seg(left, bot); break;
        case 2: case 13: seg(bot, right); break;
        case 3: case 12: seg(left, right); break;
        case 4: case 11: seg(top, right); break;
        case 5: seg(left, top); seg(bot, right); break;
        case 6: case 9: seg(top, bot); break;
        case 7: case 8: seg(left, top); break;
        case 10: seg(left, bot); seg(top, right); break;
      }
    }
    ctx.strokeStyle = color(L);
    ctx.stroke();
  }
}

const lumOf = (c: string) => { const [r, g, b] = hexToRgb(c); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };

/** Paints a full-bleed procedural background. */
export function drawBackground(ctx: Ctx, W: number, H: number, spec: Background) {
  const b = normBg(spec);
  if (!b) return;
  const { colors: C, intensity: I, seed } = b;
  const r = prng(seed);
  const S = Math.min(W, H);
  const base = C[0];
  const dark = lumOf(base) < 0.5;
  ctx.save();
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);
  switch (b.type) {
    case 'mesh': {
      ctx.globalAlpha = 0.45 + I * 0.55;
      meshBlobs(ctx, W, H, C, r, 7, 0.1);
      ctx.globalAlpha = 1;
      filmGrain(ctx, W, H, 0.08 + I * 0.1, seed);
      break;
    }
    case 'aurora': {
      ctx.globalCompositeOperation = dark ? 'screen' : 'multiply';
      ctx.filter = `blur(${Math.round(S * 0.05)}px)`;
      for (let i = 0; i < 4; i++) {
        const c = C[1 + (i % (C.length - 1))];
        const y0 = H * (0.15 + r() * 0.6), amp = H * (0.08 + r() * 0.12), fr = 1 + r() * 2, ph = r() * 6;
        const g = ctx.createLinearGradient(0, y0 - amp * 2, 0, y0 + amp * 2);
        g.addColorStop(0, rgba(c, 0)); g.addColorStop(0.5, rgba(c, 0.35 + I * 0.5)); g.addColorStop(1, rgba(c, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        for (let x = 0; x <= W; x += W / 40) { const y = y0 + Math.sin((x / W) * Math.PI * fr + ph) * amp; if (x) ctx.lineTo(x, y - amp); else ctx.moveTo(x, y - amp); }
        for (let x = W; x >= 0; x -= W / 40) { const y = y0 + Math.sin((x / W) * Math.PI * fr + ph) * amp; ctx.lineTo(x, y + amp * 1.4); }
        ctx.fill();
      }
      ctx.filter = 'none';
      ctx.globalCompositeOperation = 'source-over';
      filmGrain(ctx, W, H, 0.1, seed);
      break;
    }
    case 'grain': {
      const g = ctx.createLinearGradient(0, 0, W * 0.3, H);
      g.addColorStop(0, mix(base, C[1], 0.25 * I)); g.addColorStop(1, mix(base, C[2], 0.18 * I));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      filmGrain(ctx, W, H, 0.18 + I * 0.3, seed);
      break;
    }
    case 'leak': {
      ctx.globalCompositeOperation = 'screen';
      ctx.filter = `blur(${Math.round(S * 0.08)}px)`;
      const edge = Math.floor(r() * 4);
      for (let i = 0; i < 4; i++) {
        const c = C[1 + (i % (C.length - 1))];
        const t = r();
        const x = edge % 2 ? (edge === 1 ? W : 0) : t * W, y = edge % 2 ? t * H : edge === 2 ? H : 0;
        const rad = S * (0.3 + r() * 0.5);
        const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
        g.addColorStop(0, rgba(c, 0.5 + I * 0.5)); g.addColorStop(0.5, rgba(c, 0.2 * I)); g.addColorStop(1, rgba(c, 0));
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      }
      ctx.filter = 'none';
      ctx.globalCompositeOperation = 'source-over';
      filmGrain(ctx, W, H, 0.14, seed);
      break;
    }
    case 'halftone': {
      const ang = r() * Math.PI;
      const cx = W * r(), cy = H * r();
      const step = S / (34 + Math.round(I * 20));
      ctx.fillStyle = rgba(C[1], 0.85);
      ctx.translate(W / 2, H / 2); ctx.rotate(ang * 0.25);
      const D = Math.hypot(W, H) / 2;
      for (let y = -D; y < D; y += step) for (let x = -D; x < D; x += step) {
        const gx = x * Math.cos(-ang * 0.25) - y * Math.sin(-ang * 0.25) + W / 2, gy = x * Math.sin(-ang * 0.25) + y * Math.cos(-ang * 0.25) + H / 2;
        const t = 1 - Math.min(1, Math.hypot(gx - cx, gy - cy) / (D * 1.3));
        const rad = step * 0.5 * t * (0.4 + I * 0.7);
        if (rad < 0.5) continue;
        ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case 'duotone': {
      const n = noise2(seed);
      const s = 160, h2 = Math.round((s * H) / W);
      const c = document.createElement('canvas'); c.width = s; c.height = h2;
      const x = c.getContext('2d')!;
      const im = x.createImageData(s, h2);
      const A = hexToRgb(C[1]), B = hexToRgb(C[2]);
      for (let j = 0; j < h2; j++) for (let i = 0; i < s; i++) {
        let t = n(i / 38, j / 38, 5);
        t = Math.max(0, Math.min(1, (t - 0.5) * (1.5 + I * 2) + 0.5));
        const k = (j * s + i) * 4;
        im.data[k] = A[0] + (B[0] - A[0]) * t; im.data[k + 1] = A[1] + (B[1] - A[1]) * t; im.data[k + 2] = A[2] + (B[2] - A[2]) * t; im.data[k + 3] = 255;
      }
      x.putImageData(im, 0, 0);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(c, 0, 0, W, H);
      filmGrain(ctx, W, H, 0.12, seed);
      break;
    }
    case 'iso': {
      const a = S / (9 + Math.round((1 - I) * 6));
      const h = a * Math.sqrt(3) / 2;
      const shades = [mix(base, C[1], 0.18 + I * 0.25), mix(base, C[1], 0.08 + I * 0.1), mix(base, C[2] ?? C[1], 0.12 + I * 0.2)];
      for (let row = -1; row * a * 1.5 < H + a * 2; row++) {
        for (let col = -1; col * h * 2 < W + h * 2; col++) {
          const cx = col * h * 2 + (row % 2 ? h : 0), cy = row * a * 1.5;
          if (r() < 0.25 + (1 - I) * 0.3) continue;
          const top: [number, number][] = [[cx, cy - a], [cx + h, cy - a / 2], [cx, cy], [cx - h, cy - a / 2]];
          const left: [number, number][] = [[cx - h, cy - a / 2], [cx, cy], [cx, cy + a], [cx - h, cy + a / 2]];
          const right: [number, number][] = [[cx + h, cy - a / 2], [cx, cy], [cx, cy + a], [cx + h, cy + a / 2]];
          [top, left, right].forEach((p, i) => { ctx.beginPath(); p.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fillStyle = shades[i]; ctx.fill(); });
        }
      }
      const v = ctx.createRadialGradient(W / 2, H / 2, S * 0.2, W / 2, H / 2, Math.hypot(W, H) * 0.6);
      v.addColorStop(0, rgba(base, 0)); v.addColorStop(1, rgba(base, 0.85));
      ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
      break;
    }
    case 'topo': {
      const n = noise2(seed);
      const sc = 1 / (S * (0.22 + (1 - I) * 0.15));
      const g = ctx.createRadialGradient(W * 0.7, H * 0.3, 0, W * 0.7, H * 0.3, Math.hypot(W, H));
      g.addColorStop(0, mix(base, C[1], 0.12)); g.addColorStop(1, base);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      contours(ctx, W, H, (x, y) => n(x * sc, y * sc, 3), 16, Math.max(6, Math.round(S / 120)), (i) => rgba(i % 4 === 0 ? C[1] : C[2], i % 4 === 0 ? 0.55 * (0.5 + I / 2) : 0.22 * (0.5 + I / 2)), Math.max(1, S / 700));
      break;
    }
    case 'stripes': {
      // abstract flag-inspired wavy bands (no seals/emblems)
      const n = Math.max(3, C.length - 1 + 2);
      const ang = -0.18 - r() * 0.2;
      ctx.translate(W / 2, H / 2); ctx.rotate(ang);
      const D = Math.hypot(W, H);
      const bh = D / (n * 2.2);
      const amp = bh * (0.15 + I * 0.5), fr = 1.5 + r() * 2, ph = r() * 6;
      for (let i = 0; i < n * 2.6; i++) {
        const y0 = -D / 2 + i * bh;
        ctx.beginPath();
        for (let x = -D / 2; x <= D / 2; x += D / 60) { const y = y0 + Math.sin((x / D) * Math.PI * fr + ph) * amp; if (x === -D / 2) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
        for (let x = D / 2; x >= -D / 2; x -= D / 60) ctx.lineTo(x, y0 + bh + Math.sin((x / D) * Math.PI * fr + ph) * amp);
        ctx.closePath();
        const col = C[1 + (i % (C.length - 1))];
        ctx.fillStyle = i % 2 ? rgba(col, 0.85) : rgba(base, 0.9);
        ctx.fill();
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const sh = ctx.createLinearGradient(0, 0, W, H);
      sh.addColorStop(0, 'rgba(255,255,255,0.10)'); sh.addColorStop(0.5, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.35)');
      ctx.fillStyle = sh; ctx.fillRect(0, 0, W, H);
      filmGrain(ctx, W, H, 0.1, seed);
      break;
    }
    case 'glass': {
      meshBlobs(ctx, W, H, C, r, 6, 0.08);
      const src = document.createElement('canvas'); src.width = W; src.height = H;
      src.getContext('2d')!.drawImage(ctx.canvas, 0, 0);
      for (let i = 0; i < 3; i++) {
        const w = S * (0.35 + r() * 0.35), h = S * (0.25 + r() * 0.3), x = r() * (W - w * 0.6) - w * 0.2, y = r() * (H - h * 0.6) - h * 0.2, rad = S * 0.04;
        ctx.save();
        rr(ctx, x, y, w, h, rad); ctx.clip();
        ctx.filter = `blur(${Math.round(S * 0.03)}px) saturate(1.3)`;
        ctx.drawImage(src, 0, 0);
        ctx.filter = 'none';
        ctx.fillStyle = `rgba(255,255,255,${0.06 + I * 0.1})`; ctx.fillRect(x, y, w, h);
        ctx.restore();
        rr(ctx, x, y, w, h, rad);
        ctx.lineWidth = Math.max(1, S / 540);
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.stroke();
      }
      filmGrain(ctx, W, H, 0.08, seed);
      break;
    }
    case 'extrude': {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, mix(base, '#ffffff', dark ? 0.06 : 0)); g.addColorStop(1, mix(base, '#000000', 0.25));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const depth = S * (0.03 + I * 0.05);
      const shapes = 4 + Math.round(I * 3);
      for (let i = 0; i < shapes; i++) {
        const c = C[1 + (i % (C.length - 1))];
        const edge = r() < 0.5; const x = edge ? (r() < 0.5 ? r() * W * 0.18 : W - r() * W * 0.18) : r() * W, y = edge ? r() * H : (r() < 0.5 ? r() * H * 0.15 : H - r() * H * 0.15), sz = S * (0.06 + r() * 0.12), kind = Math.floor(r() * 3), rot = r() * Math.PI;
        const path = (ox: number, oy: number) => {
          ctx.beginPath();
          if (kind === 0) { ctx.arc(x + ox, y + oy, sz, 0, Math.PI * 2); ctx.arc(x + ox, y + oy, sz * 0.55, 0, Math.PI * 2, true); }
          else if (kind === 1) { for (let j = 0; j < 3; j++) { const a = rot + (j * 2 * Math.PI) / 3; const px = x + ox + Math.cos(a) * sz, py = y + oy + Math.sin(a) * sz; if (j) ctx.lineTo(px, py); else ctx.moveTo(px, py); } ctx.closePath(); }
          else rr(ctx, x + ox - sz, y + oy - sz * 0.35, sz * 2, sz * 0.7, sz * 0.35);
        };
        const steps = Math.ceil(depth / 2);
        for (let s = steps; s > 0; s--) { path(s * 2 * 0.7, s * 2); ctx.fillStyle = mix(c, '#000000', 0.45 + (s / steps) * 0.2); ctx.fill('evenodd'); }
        path(0, 0);
        const fg = ctx.createLinearGradient(x - sz, y - sz, x + sz, y + sz);
        fg.addColorStop(0, mix(c, '#ffffff', 0.25)); fg.addColorStop(1, c);
        ctx.fillStyle = fg; ctx.fill('evenodd');
      }
      filmGrain(ctx, W, H, 0.08, seed);
      break;
    }
    case 'paper': {
      const n = noise2(seed);
      const s = 360, h2 = Math.round((s * H) / W);
      const c = document.createElement('canvas'); c.width = s; c.height = h2;
      const x = c.getContext('2d')!;
      const im = x.createImageData(s, h2);
      const A = hexToRgb(base);
      for (let j = 0; j < h2; j++) for (let i = 0; i < s; i++) {
        const t = (n(i / 5, j / 5, 3) - 0.5) * 14 * (0.4 + I) + (n(i / 40, j / 40, 2) - 0.5) * 8 * I;
        const k = (j * s + i) * 4;
        im.data[k] = A[0] + t; im.data[k + 1] = A[1] + t; im.data[k + 2] = A[2] + t * 0.9; im.data[k + 3] = 255;
      }
      x.putImageData(im, 0, 0);
      ctx.drawImage(c, 0, 0, W, H);
      filmGrain(ctx, W, H, 0.16, seed);
      const v = ctx.createRadialGradient(W / 2, H / 2, S * 0.3, W / 2, H / 2, Math.hypot(W, H) * 0.6);
      v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(60,40,10,${0.12 + I * 0.15})`);
      ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
      break;
    }
  }
  ctx.restore();
}

/** Off-screen canvas with the background (used by the style layer). */
export function backgroundCanvas(W: number, H: number, spec: Background): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  drawBackground(c.getContext('2d')!, W, H, spec);
  return c;
}
