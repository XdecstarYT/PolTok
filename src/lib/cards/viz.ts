/** Data-viz primitives for cards: labelled bars, needle, waffle, seat arc, sparkline area, swing arrow. */
import type { CardSeries } from './types';
import { type Ctx, mix, rgba, rr } from './kit';
import { type FFam, ff, label, tabular } from './type';

export interface BarRow { label: string; value: string; num: number; color: string }

/** Horizontal bars with name above, tabular value right-aligned, winner emphasised. */
export function hBars(ctx: Ctx, rows: BarRow[], x: number, y: number, w: number, h: number, o: { fam?: FFam; numFam?: FFam; fg: string; muted: string; track: string; max?: number; radius?: number; check?: number }) {
  if (!rows.length) return;
  const n = rows.length;
  const rowH = Math.min(h / n, w * 0.16);
  const max = o.max ?? Math.max(50, ...rows.map((r) => r.num));
  rows.forEach((r, i) => {
    const ry = y + i * rowH;
    const lead = i === 0;
    const px = rowH * 0.24;
    const vpx = rowH * (lead ? 0.42 : 0.34);
    const barY = ry + rowH * 0.56, barH = rowH * (lead ? 0.2 : 0.14);
    tabular(ctx, r.value, x + w, barY - rowH * 0.1, ff(o.numFam ?? 'tight', vpx, lead ? 800 : 600), lead ? o.fg : o.muted, 'right');
    ctx.font = ff(o.numFam ?? 'tight', vpx, 800);
    const vw = ctx.measureText(r.value).width * 1.1;
    label(ctx, r.label, x, barY - rowH * 0.1, o.fam ?? 'tight', px, lead ? o.fg : o.muted, { upper: false, weight: lead ? 700 : 500, maxW: w - vw - px });
    rr(ctx, x, barY, w, barH, o.radius ?? barH / 2); ctx.fillStyle = o.track; ctx.fill();
    const bw = Math.max(barH, (w * Math.max(0, r.num)) / max);
    rr(ctx, x, barY, bw, barH, o.radius ?? barH / 2); ctx.fillStyle = r.color; ctx.fill();
  });
}

/** Semicircle needle gauge: value 0..100 (50 = centre). */
export function needle(ctx: Ctx, cx: number, cy: number, R: number, value: number, o: { left: string; right: string; track: string; fg: string; ticks?: string }) {
  const t = Math.max(0, Math.min(100, value)) / 100;
  const lw = R * 0.16;
  const seg = 24;
  for (let i = 0; i < seg; i++) {
    const a0 = Math.PI + (i / seg) * Math.PI, a1 = Math.PI + ((i + 1) / seg) * Math.PI - 0.012;
    const k = i / (seg - 1);
    const c = k < 0.5 ? mix(o.left, o.track, k * 2 * 0.85) : mix(o.track, o.right, 0.15 + (k - 0.5) * 2 * 0.85);
    ctx.beginPath(); ctx.arc(cx, cy, R, a0, a1); ctx.lineWidth = lw; ctx.strokeStyle = c; ctx.stroke();
  }
  if (o.ticks) {
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI + (i / 10) * Math.PI;
      const r0 = R - lw * 0.9, r1 = R - lw * (i % 5 ? 1.2 : 1.6);
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.lineWidth = R / 140; ctx.strokeStyle = o.ticks; ctx.stroke();
    }
  }
  const a = Math.PI + t * Math.PI;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = R * 0.05; ctx.shadowOffsetY = R * 0.02;
  ctx.beginPath();
  const w = R * 0.035;
  ctx.moveTo(cx + Math.cos(a) * R * 0.92, cy + Math.sin(a) * R * 0.92);
  ctx.lineTo(cx + Math.cos(a + Math.PI / 2) * w, cy + Math.sin(a + Math.PI / 2) * w);
  ctx.lineTo(cx + Math.cos(a - Math.PI / 2) * w, cy + Math.sin(a - Math.PI / 2) * w);
  ctx.closePath(); ctx.fillStyle = o.fg; ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, R * 0.07, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/** 10×10 waffle; parts are percentages. */
export function waffle(ctx: Ctx, x: number, y: number, size: number, parts: { v: number; color: string }[], empty: string, gapF = 0.14, round = 0.2) {
  const cell = size / 10, gap = cell * gapF;
  const counts = parts.map((p) => Math.round(Math.max(0, p.v)));
  let idx = 0;
  const colors: string[] = [];
  counts.forEach((c, i) => { for (let j = 0; j < c && idx < 100; j++, idx++) colors.push(parts[i].color); });
  for (let i = 0; i < 100; i++) {
    const col = i % 10, row = Math.floor(i / 10);
    rr(ctx, x + col * cell + gap / 2, y + row * cell + gap / 2, cell - gap, cell - gap, (cell - gap) * round);
    ctx.fillStyle = colors[i] ?? empty; ctx.fill();
  }
}

/** Parliament / seat arc: seats laid out in concentric rows, filled in party order. */
export function seatArc(ctx: Ctx, cx: number, cy: number, R: number, groups: { n: number; color: string }[], o: { rows?: number; inner?: number; empty?: string } = {}) {
  const total = groups.reduce((a, g) => a + g.n, 0);
  if (!total) return;
  const rows = o.rows ?? Math.max(4, Math.min(12, Math.round(Math.sqrt(total / 2.2))));
  const r0 = R * (o.inner ?? 0.42);
  const radii = Array.from({ length: rows }, (_, i) => r0 + ((R - r0) * (i + 0.5)) / rows);
  const lens = radii.map((r) => r * Math.PI);
  const L = lens.reduce((a, b) => a + b, 0);
  const per = radii.map((_, i) => Math.round((lens[i] / L) * total));
  let diff = total - per.reduce((a, b) => a + b, 0);
  per[rows - 1] += diff; diff = 0;
  const seats: { a: number; r: number }[] = [];
  radii.forEach((r, i) => { for (let j = 0; j < per[i]; j++) seats.push({ a: Math.PI - (per[i] === 1 ? 0.5 : j / (per[i] - 1)) * Math.PI, r }); });
  seats.sort((p, q) => q.a - p.a);
  const dot = ((R - r0) / rows) * 0.36;
  let gi = 0, used = 0;
  seats.forEach((s) => {
    while (gi < groups.length && used >= groups[gi].n) { gi++; used = 0; }
    const c = groups[gi]?.color ?? o.empty ?? '#888';
    used++;
    ctx.beginPath(); ctx.arc(cx + Math.cos(s.a) * s.r, cy - Math.sin(s.a) * s.r, dot, 0, Math.PI * 2);
    ctx.fillStyle = c; ctx.fill();
  });
}

/** Area sparkline for one or more series, with end-dot + value label. */
export function sparkArea(ctx: Ctx, series: CardSeries[], x: number, y: number, w: number, h: number, o: { fg: string; grid?: string; fam?: FFam; fill?: boolean; labels?: boolean } ) {
  const pts = series.flatMap((s) => s.points);
  if (pts.length < 2) return;
  const t0 = Math.min(...pts.map((p) => p.t)), t1 = Math.max(...pts.map((p) => p.t));
  let v0 = Math.min(...pts.map((p) => p.v)), v1 = Math.max(...pts.map((p) => p.v));
  const pad = (v1 - v0) * 0.15 || 1; v0 -= pad; v1 += pad;
  const X = (t: number) => x + ((t - t0) / (t1 - t0 || 1)) * w;
  const Y = (v: number) => y + h - ((v - v0) / (v1 - v0)) * h;
  if (o.grid) { ctx.strokeStyle = o.grid; ctx.lineWidth = 1; for (let i = 0; i <= 3; i++) { const gy = y + (h * i) / 3; ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); ctx.stroke(); } }
  const lw = Math.max(2, h / 60);
  series.forEach((s, si) => {
    const P = [...s.points].sort((a, b) => a.t - b.t);
    if (P.length < 2) return;
    const path = new Path2D();
    P.forEach((p, i) => {
      if (!i) { path.moveTo(X(p.t), Y(p.v)); return; }
      const q = P[i - 1]; const mx = (X(q.t) + X(p.t)) / 2;
      path.bezierCurveTo(mx, Y(q.v), mx, Y(p.v), X(p.t), Y(p.v));
    });
    if (o.fill !== false && si < 2) {
      const a = new Path2D(path); a.lineTo(X(P[P.length - 1].t), y + h); a.lineTo(X(P[0].t), y + h); a.closePath();
      const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, rgba(s.color, 0.32)); g.addColorStop(1, rgba(s.color, 0));
      ctx.fillStyle = g; ctx.fill(a);
    }
    ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = s.color; ctx.stroke(path);
    const e = P[P.length - 1];
    ctx.beginPath(); ctx.arc(X(e.t), Y(e.v), lw * 2.2, 0, Math.PI * 2); ctx.fillStyle = s.color; ctx.fill();
    if (o.labels) tabular(ctx, `${e.v}`, X(e.t) - lw * 4, Y(e.v) - lw * 3.5, ff(o.fam ?? 'tight', Math.max(12, h / 9), 700), s.color, 'right');
  });
}

/** Swing arrow: direction by sign, length by magnitude (pp). Draws an arrow from (x,y) of up to maxLen. */
export function swingArrow(ctx: Ctx, x: number, y: number, maxLen: number, swing: number, color: string, o: { angle?: number; thickness?: number; scale?: number } = {}) {
  const len = Math.min(1, Math.abs(swing) / (o.scale ?? 10)) * maxLen;
  const dir = swing >= 0 ? 1 : -1;
  const ang = (o.angle ?? -Math.PI / 5) * dir;
  const th = o.thickness ?? maxLen * 0.07;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(dir > 0 ? ang : Math.PI + ang);
  const head = th * 2.6;
  ctx.beginPath();
  ctx.moveTo(0, -th / 2); ctx.lineTo(Math.max(0, len - head), -th / 2); ctx.lineTo(Math.max(0, len - head), -th * 1.4);
  ctx.lineTo(len, 0); ctx.lineTo(Math.max(0, len - head), th * 1.4); ctx.lineTo(Math.max(0, len - head), th / 2); ctx.lineTo(0, th / 2);
  ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  ctx.restore();
}
