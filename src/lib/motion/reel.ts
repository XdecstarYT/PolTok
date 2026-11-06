/** Multi-slide story / reel: sequences several cards (thread, carousel) with transitions + captions. */
import { renderMotionFrame, type MotionInput, type PresetId } from './timeline';

export type Transition = 'crossfade' | 'slide' | 'zoom' | 'parallax' | 'cut';
export const TRANSITIONS: Transition[] = ['crossfade', 'slide', 'zoom', 'parallax', 'cut'];
export interface ReelSlide { input: MotionInput; preset?: PresetId; /** seconds; default perSlide */ duration?: number }
export interface ReelOptions { slides: ReelSlide[]; perSlide: number; transition: Transition; transitionSec?: number; preset: PresetId; now?: number }

export function reelDuration(o: ReelOptions) { return o.slides.reduce((s, x) => s + (x.duration ?? o.perSlide), 0); }

/** Returns a frame renderer with two scratch canvases reused across frames. */
export function reelRenderer(o: ReelOptions) {
  const a = document.createElement('canvas'), b = document.createElement('canvas');
  const starts: number[] = [];
  let acc = 0;
  for (const s of o.slides) { starts.push(acc); acc += s.duration ?? o.perSlide; }
  const total = acc, tr = o.transition === 'cut' ? 0 : Math.min(o.transitionSec ?? 0.6, o.perSlide / 3);
  const draw = (cv: HTMLCanvasElement, i: number, t: number, W: number, H: number) => {
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const s = o.slides[i];
    renderMotionFrame(cv.getContext('2d')!, s.input, { preset: s.preset ?? o.preset, duration: s.duration ?? o.perSlide, now: o.now, seed: 11 + i }, Math.max(0, t));
  };
  return (c: CanvasRenderingContext2D, t: number) => {
    const W = c.canvas.width, H = c.canvas.height;
    if (!o.slides.length) { c.fillStyle = '#05060a'; c.fillRect(0, 0, W, H); return; }
    t = Math.max(0, Math.min(total - 1e-3, t));
    let i = starts.findIndex((st, k) => t >= st && (k === starts.length - 1 || t < starts[k + 1]));
    if (i < 0) i = 0;
    const local = t - starts[i];
    draw(a, i, local, W, H);
    const end = (o.slides[i].duration ?? o.perSlide);
    const inTr = tr > 0 && i < o.slides.length - 1 && local > end - tr;
    if (!inTr) { c.drawImage(a, 0, 0); progressDots(c, W, H, i, o.slides.length, 0); return; }
    const p = (local - (end - tr)) / tr, e = p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2;
    draw(b, i + 1, local - end, W, H);
    c.fillStyle = '#05060a'; c.fillRect(0, 0, W, H);
    c.save();
    switch (o.transition) {
      case 'crossfade': c.drawImage(a, 0, 0); c.globalAlpha = e; c.drawImage(b, 0, 0); break;
      case 'slide': c.drawImage(a, -W * e, 0); c.drawImage(b, W * (1 - e), 0); break;
      case 'parallax': c.drawImage(a, -W * 0.35 * e, 0); c.globalAlpha = 1; c.shadowColor = 'rgba(0,0,0,0.6)'; c.shadowBlur = 40; c.drawImage(b, W * (1 - e), 0); break;
      case 'zoom': {
        c.globalAlpha = 1 - e; const s1 = 1 + 0.25 * e; c.drawImage(a, (W - W * s1) / 2, (H - H * s1) / 2, W * s1, H * s1);
        c.globalAlpha = e; const s2 = 0.8 + 0.2 * e; c.drawImage(b, (W - W * s2) / 2, (H - H * s2) / 2, W * s2, H * s2); break;
      }
      default: c.drawImage(b, 0, 0);
    }
    c.restore();
    progressDots(c, W, H, i, o.slides.length, e);
  };
}

/** Story-style segmented progress bar at the very top (inside platform chrome is fine). */
function progressDots(c: CanvasRenderingContext2D, W: number, H: number, i: number, n: number, e: number) {
  if (n < 2) return;
  const m = W * 0.04, gap = W * 0.01, h = Math.max(3, H * 0.004), y = H * 0.02, w = (W - 2 * m - gap * (n - 1)) / n;
  for (let k = 0; k < n; k++) {
    c.fillStyle = k < i || (k === i + 1 && e > 0.5) || k === i ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.35)';
    c.fillRect(m + k * (w + gap), y, w, h);
  }
}
