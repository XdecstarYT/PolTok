/**
 * "Follow live" badge — a pill drawn on top of any rendered card (post-render overlay, works with every design).
 * Pill colour follows the pixels underneath (sampled), text colour comes from the cards kit `inkOn` helper,
 * so it stays readable on light and dark designs. `t` (seconds) animates the pulsing dot for video exports.
 */
import { inkOn, rr, type K } from '../../../lib/cards/kit';

import type { BadgeOpts } from './badgeOpts';
export * from './badgeOpts';

/** "https://poltok.netlify.app/live?utm_source=x…" → "poltok.netlify.app/live" */
export function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    return (u.host + (u.pathname === '/' ? '' : u.pathname)).replace(/\/$/, '');
  } catch {
    return url.replace(/^https?:\/\//, '').replace(/[?#].*$/, '');
  }
}

const hex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
function sample(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): string {
  try {
    const d = ctx.getImageData(Math.max(0, Math.round(x)), Math.max(0, Math.round(y)), Math.max(1, Math.round(w)), Math.max(1, Math.round(h))).data;
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 16) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
    return `#${hex(r / n)}${hex(g / n)}${hex(b / n)}`;
  } catch {
    return '#05070d';
  }
}
const lumOf = (c: string) => {
  const v = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);
  return 0.299 * v[0] + 0.587 * v[1] + 0.114 * v[2];
};

/** Draw the badge onto ctx (canvas size W×H). `url` should be the post link (with utm_source=x). */
export function drawBadge(ctx: CanvasRenderingContext2D, W: number, H: number, o: BadgeOpts & { url: string; accent?: string }, t = 0) {
  if (!o.on) return;
  const s = (Math.min(W, H) / 675) * 1.15;
  const pad = 26 * s;
  const fs = 21 * s;
  const fsUrl = 16 * s;
  ctx.save();
  ctx.font = `700 ${fs}px Inter, system-ui, sans-serif`;
  const wLabel = ctx.measureText(o.label).width;
  ctx.font = `500 ${fsUrl}px Inter, system-ui, sans-serif`;
  const urlText = shortUrl(o.url);
  const wUrl = ctx.measureText(urlText).width;
  const dotR = 7 * s;
  const h = 46 * s;
  const w = 18 * s + dotR * 2 + 12 * s + wLabel + 12 * s + wUrl + 20 * s;
  const x = o.corner.endsWith('l') ? pad : W - pad - w;
  const y = o.corner.startsWith('t') ? pad : H - pad - h;
  const under = sample(ctx, x, y, w, h);
  const darkPill = lumOf(under) > 0.55; // light design → dark pill, dark design → light-ish dark pill
  const pill = darkPill ? '#0b0d14' : '#f6f7fb';
  const k = {} as K; // inkOn only reads k.map (no palette remap on this overlay)
  const ink = inkOn(k, pill);
  const muted = inkOn(k, pill, darkPill ? '#c9cfdf' : '#3a4152');
  // pill
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 14 * s;
  ctx.shadowOffsetY = 3 * s;
  rr(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = pill;
  ctx.globalAlpha = 0.94;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = Math.max(1, 1.5 * s);
  ctx.strokeStyle = darkPill ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.14)';
  ctx.stroke();
  // pulsing live dot (static frame shows a soft halo)
  const cx = x + 18 * s + dotR, cy = y + h / 2;
  const phase = (t % 1.4) / 1.4;
  const live = '#ff3d55';
  ctx.beginPath();
  ctx.arc(cx, cy, dotR * (1.25 + phase * 1.3), 0, Math.PI * 2);
  ctx.fillStyle = live;
  ctx.globalAlpha = t ? 0.45 * (1 - phase) : 0.28;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, dotR, 0, Math.PI * 2);
  ctx.fillStyle = live;
  ctx.fill();
  // text
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  let tx = cx + dotR + 12 * s;
  ctx.font = `700 ${fs}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = ink.replace(/^!/, '');
  ctx.fillText(o.label, tx, cy + 1 * s);
  tx += wLabel + 12 * s;
  ctx.font = `500 ${fsUrl}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = muted.replace(/^!/, '');
  ctx.fillText(urlText, tx, cy + 1 * s);
  ctx.restore();
}
