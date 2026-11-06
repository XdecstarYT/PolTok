/**
 * Update 4 designs — message / brand-voice cards and X formats (thread, poll, reply frame, breaking,
 * did-you-know, header, avatar, highlight cover, story template). All layouts are relative to W/H
 * (fluid) and long text is auto-fitted with *asterisk* emphasis drawn in the accent colour.
 */
import type { CardKind } from './types';
import { MESSAGE_KINDS } from './types';
import { type Design, X, SQ, PT, ST } from './common';
import { type Ctx, type Fam, type K, blob, caps, capsFit, contrast, ellipsize, font, grain, inkOn, mix, rgba, rng, rr, wordmark, RT, fit } from './kit';

const MSG: CardKind[] = [...MESSAGE_KINDS, 'quote', 'custom'];
const BRAND: CardKind[] = ['brand', 'promo', 'custom', ...MESSAGE_KINDS];
const u = (k: K) => Math.min(k.W, k.H * 1.5) / 1080;

/* ───────── rich text: *emphasis* → accent, auto-fit, wrapping, paragraphs ───────── */
type Run = { t: string; em: boolean };
type Word = Run[];
type Line = Word[];
function tokens(text: string): Word[][] {
  return String(text ?? '').split(/\n+/).map((para) => {
    const words: Word[] = [];
    let cur: Word = [];
    let em = false;
    const push = (ch: string) => { const last = cur[cur.length - 1]; if (last && last.em === em) last.t += ch; else cur.push({ t: ch, em }); };
    for (const ch of para) {
      if (ch === '*') { em = !em; continue; }
      if (/\s/.test(ch)) { if (cur.length) words.push(cur); cur = []; continue; }
      push(ch);
    }
    if (cur.length) words.push(cur);
    return words;
  }).filter((p) => p.length);
}
const wordW = (ctx: Ctx, w: Word) => w.reduce((a, r) => a + ctx.measureText(r.t).width, 0);
function layout(ctx: Ctx, paras: Word[][], maxW: number): Line[] {
  const sp = ctx.measureText(' ').width;
  const lines: Line[] = [];
  for (const p of paras) {
    let cur: Line = [], cw = 0;
    for (const t of p) {
      const w = wordW(ctx, t);
      if (cur.length && cw + sp + w > maxW) { lines.push(cur); cur = [t]; cw = w; } else { cw += (cur.length ? sp : 0) + w; cur.push(t); }
    }
    if (cur.length) lines.push(cur);
  }
  return lines;
}
export interface RichFit { lines: Line[]; px: number; lh: number; fam: Fam; weight: number | string; italic: boolean }
/** Largest font size (≤ maxPx) whose wrapped lines fit maxW × maxH. */
export function richFit(ctx: Ctx, text: string, maxW: number, maxH: number, maxPx: number, minPx: number, fam: Fam, weight: number | string = 800, lhf = 1.12, italic = false): RichFit {
  (ctx as Ctx & { letterSpacing?: string }).letterSpacing = '0px';
  const paras = tokens(text);
  let px = maxPx;
  for (; px > minPx; px -= Math.max(1, Math.round(px * 0.04))) {
    ctx.font = font(fam, px, weight, italic);
    const lines = layout(ctx, paras, maxW);
    const longest = Math.max(0, ...lines.flatMap((l) => l.map((t) => wordW(ctx, t))));
    if (lines.length * px * lhf <= maxH && longest <= maxW) return { lines, px, lh: px * lhf, fam, weight, italic };
  }
  ctx.font = font(fam, minPx, weight, italic);
  let lines = layout(ctx, paras, maxW);
  const max = Math.max(1, Math.floor(maxH / (minPx * lhf)));
  if (lines.length > max) { lines = lines.slice(0, max); lines[max - 1] = [...lines[max - 1], [{ t: '…', em: false }]]; }
  return { lines, px: minPx, lh: minPx * lhf, fam, weight, italic };
}
/** Draws fitted rich text; `y` is the top of the block. Returns the bottom y. */
export function drawRich(k: K, f: RichFit, x: number, y: number, maxW: number, color: string, em: string, align: 'left' | 'center' | 'right' = 'left', mark = false) {
  const { ctx } = k;
  if (RT.align) align = RT.align;
  (ctx as Ctx & { letterSpacing?: string }).letterSpacing = '0px';
  ctx.font = font(f.fam, f.px, f.weight, f.italic);
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  const sp = ctx.measureText(' ').width;
  f.lines.forEach((l, i) => {
    const ws = l.map((t) => wordW(ctx, t));
    const lw = ws.reduce((a, b) => a + b, 0) + sp * (l.length - 1);
    let cx = align === 'center' ? x + (maxW - lw) / 2 : align === 'right' ? x + maxW - lw : x;
    const by = y + i * f.lh + f.px * 0.92;
    l.forEach((w, j) => {
      // emphasis may continue across the space between two emphasised words
      const nextEm = w[w.length - 1].em && l[j + 1]?.[0].em;
      for (const r of w) {
        const rw = ctx.measureText(r.t).width;
        if (r.em && mark) { ctx.fillStyle = rgba(em.startsWith('!') ? em.slice(1) : em, 0.28); ctx.fillRect(cx - f.px * 0.06, by - f.px * 0.3, rw + f.px * 0.12 + (r === w[w.length - 1] && nextEm ? sp : 0), f.px * 0.36); }
        ctx.fillStyle = r.em ? em : color;
        ctx.fillText(r.t, cx, by);
        cx += rw;
      }
      cx += sp;
    });
  });
  return y + f.lines.length * f.lh;
}
/** Emphasis colour: the accent, nudged toward `ink` until it reads (≥3:1) on `bg` (after palette remap). */
function emOn(k: K, bg: string, ink: string): string {
  const map = k.map ?? ((c: string) => c);
  const B = map(bg);
  let c = k.accent;
  for (let t = 0; t <= 1 && contrast(map(c), B) < 3; t += 0.15) c = mix(k.accent, ink, t);
  return k.map ? '!' + c : c;
}
/** literal colour that bypasses the palette remap */
const raw = (k: K, c: string) => (k.map ? '!' + c : c);
const plain = (s?: string) => String(s ?? '').replace(/\*/g, '');
function foot(k: K, y: number, color: string, accent = k.accent, align: 'left' | 'center' = 'left') {
  const s = u(k), P = 64 * s;
  (k.ctx as Ctx & { letterSpacing?: string }).letterSpacing = '0px';
  if (align === 'center') { wordmark(k.ctx, k.W / 2, y, 34 * s, { color, accent, align: 'center' }); return; }
  wordmark(k.ctx, P, y, 34 * s, { color, accent });
  k.ctx.font = font('sans', 22 * s, 700);
  k.ctx.fillStyle = color; k.ctx.textAlign = 'right';
  k.ctx.globalAlpha = 0.7; k.ctx.fillText(k.d.handle?.trim() || k.url, k.W - P, y - 4 * s); k.ctx.globalAlpha = 1;
}
const ctaPill = (k: K, cx: number, y: number, t: string, bg: string, fgPref: string, left = false) => {
  const { ctx } = k, s = u(k);
  ctx.font = font('sans', 28 * s, 800);
  const tt = ellipsize(ctx, t, k.W * 0.8);
  const w = ctx.measureText(tt).width + 64 * s, h = 64 * s;
  if (left) cx += w / 2;
  rr(ctx, cx - w / 2, y, w, h, h / 2); ctx.fillStyle = bg; ctx.fill();
  ctx.fillStyle = inkOn(k, bg, fgPref); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(tt, cx, y + h / 2 + 2 * s); ctx.textBaseline = 'alphabetic';
};
const kick = (k: K) => k.d.subtitle && k.d.kind !== 'question' ? '' : k.kicker;

/* 41 ─ Bold statement */
const statement: Design = {
  id: 'statement', name: 'Bold statement', kinds: MSG, size: SQ, isNew: true, fluid: true, drawsCta: true,
  draw(k) {
    const { ctx, W, H, d } = k; const s = u(k), P = 72 * s;
    ctx.fillStyle = '#0b0d14'; ctx.fillRect(0, 0, W, H);
    blob(ctx, W * 0.9, H * 0.05, W * 0.6, k.accent, 0.18); grain(ctx, W, H, 0.03, 5);
    ctx.fillStyle = k.accent; ctx.fillRect(P, P, 90 * s, 12 * s);
    capsFit(ctx, k.kicker, W - P * 2 - 120 * s, P + 120 * s, P + 13 * s, font('sans', 22 * s, 800), 'rgba(255,255,255,0.7)', 0.16);
    const bottom = H - P - 60 * s - (d.cta ? 90 * s : 0) - (d.quoteBy ? 60 * s : 0);
    const f = richFit(ctx, d.title, W - P * 2, bottom - (P + 80 * s), 150 * s, 34 * s, 'display', 700, 1.06);
    const y = drawRich(k, f, P, P + 70 * s, W - P * 2, '#ffffff', emOn(k, '#0b0d14', '#ffffff'));
    if (d.subtitle) { ctx.font = font('sans', Math.max(24 * s, f.px * 0.3), 500); ctx.fillStyle = 'rgba(255,255,255,0.72)'; ctx.textAlign = 'left'; ctx.fillText(ellipsize(ctx, plain(d.subtitle), W - P * 2), P, Math.min(bottom + 10 * s, y + f.px * 0.6)); }
    if (d.quoteBy) caps(ctx, `— ${d.quoteBy}`, P, H - P - 60 * s - (d.cta ? 90 * s : 0), font('sans', 26 * s, 800), k.accent, 0.08);
    if (d.cta) ctaPill(k, W / 2, H - P - 130 * s, d.cta, k.accent, '#0b0d14');
    foot(k, H - P + 10 * s, '#ffffff');
  },
};

/* 42 ─ Notes app */
const notes: Design = {
  id: 'notes', name: 'Notes-app screenshot', kinds: MSG, size: PT, isNew: true, fluid: true,
  draw(k) {
    const { ctx, W, H, d } = k; const s = u(k), P = 64 * s;
    ctx.fillStyle = '#fffdf6'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#f2efe6'; ctx.fillRect(0, 0, W, 130 * s);
    ctx.font = font('sans', 34 * s, 600); ctx.fillStyle = '#d99a00'; ctx.textAlign = 'left'; ctx.fillText('‹ Notes', P - 16 * s, 82 * s);
    ctx.textAlign = 'right'; ctx.fillText('Done', W - P, 82 * s);
    const when = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
    ctx.font = font('sans', 24 * s, 500); ctx.fillStyle = '#8b8678'; ctx.textAlign = 'center'; ctx.fillText(when, W / 2, 190 * s);
    let y = 230 * s;
    if (d.subtitle) {
      const t = fit(ctx, plain(d.subtitle), W - P * 2, 62 * s, 'sans', 800, 28 * s);
      ctx.fillStyle = '#16140f'; ctx.textAlign = 'left'; ctx.fillText(plain(d.subtitle), P, y + t); y += t * 1.5;
    }
    const f = richFit(ctx, d.title, W - P * 2, H - y - 200 * s, 84 * s, 26 * s, 'sans', 500, 1.36);
    drawRich(k, f, P, y, W - P * 2, '#1c1a14', emOn(k, '#fffdf6', '#1c1a14'), 'left', true);
    if (d.quoteBy) { ctx.font = font('sans', 28 * s, 600, true); ctx.fillStyle = '#5a564b'; ctx.textAlign = 'left'; ctx.fillText(`— ${d.quoteBy}`, P, H - 130 * s); }
    foot(k, H - 50 * s, '#16140f');
  },
};

/* 43 ─ Letter / memo */
const memo: Design = {
  id: 'memo', name: 'Letter / memo', kinds: MSG, size: PT, isNew: true, fluid: true,
  draw(k) {
    const { ctx, W, H, d } = k; const s = u(k), P = 88 * s;
    ctx.fillStyle = '#efe9dc'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fbf8f1'; ctx.shadowColor = 'rgba(0,0,0,0.18)'; ctx.shadowBlur = 30 * s; ctx.fillRect(40 * s, 40 * s, W - 80 * s, H - 80 * s); ctx.shadowColor = 'transparent';
    caps(ctx, 'Memo', P, P + 50 * s, font('serif', 64 * s, 900), '#1b1712', 0.2);
    ctx.fillStyle = k.accent; ctx.fillRect(P, P + 76 * s, 120 * s, 6 * s);
    const rows: [string, string][] = [['From', d.quoteBy || 'PolTok'], ['To', 'Our followers'], ['Re', plain(d.subtitle) || k.kicker]];
    let y = P + 140 * s;
    rows.forEach(([a, b]) => { (ctx as Ctx & { letterSpacing?: string }).letterSpacing = '0px'; caps(ctx, a, P, y, font('sans', 20 * s, 800), '#6b6253', 0.14); (ctx as Ctx & { letterSpacing?: string }).letterSpacing = '0px'; ctx.font = font('text', 28 * s, 600); ctx.fillStyle = '#1b1712'; ctx.textAlign = 'left'; ctx.fillText(ellipsize(ctx, b, W - P * 2 - 120 * s), P + 110 * s, y); y += 46 * s; });
    ctx.fillStyle = 'rgba(27,23,18,0.25)'; ctx.fillRect(P, y, W - P * 2, 2 * s);
    const f = richFit(ctx, d.title, W - P * 2, H - y - 220 * s, 72 * s, 24 * s, 'text', 400, 1.42);
    const end = drawRich(k, f, P, y + 40 * s, W - P * 2, '#1b1712', emOn(k, '#fbf8f1', '#1b1712'));
    if (d.quoteBy) { ctx.font = font('serif', 44 * s, 700, true); ctx.fillStyle = '#1b1712'; ctx.textAlign = 'left'; ctx.fillText(d.quoteBy, P, Math.min(H - 150 * s, end + 70 * s)); }
    foot(k, H - 80 * s, '#1b1712');
  },
};

/* 44 ─ Gradient quote */
const gradQuote: Design = {
  id: 'gradient-quote', name: 'Gradient quote', kinds: MSG, size: SQ, isNew: true, fluid: true,
  draw(k) {
    const { ctx, W, H, d } = k; const s = u(k), P = 80 * s;
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#2b1055'); g.addColorStop(0.55, mix('#7a1fa2', k.accent, 0.25)); g.addColorStop(1, mix('#ff6a5b', k.accent, 0.35));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    blob(ctx, W * 0.15, H * 0.85, W * 0.6, '#ffffff', 0.12); grain(ctx, W, H, 0.04, 9);
    ctx.font = font('serif', 340 * s, 900); ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.textAlign = 'left'; ctx.fillText('“', P - 20 * s, P + 250 * s);
    const f = richFit(ctx, d.title, W - P * 2, H * 0.58, 104 * s, 30 * s, 'serif', 700, 1.14, true);
    const top = (H - f.lines.length * f.lh) / 2 - 20 * s;
    const end = drawRich(k, f, P, top, W - P * 2, raw(k, '#ffffff'), raw(k, '#ffe27a'), 'center');
    const by = d.quoteBy || plain(d.subtitle);
    if (by) caps(ctx, `— ${by}`, W / 2, end + 60 * s, font('sans', 26 * s, 800), raw(k, 'rgba(255,255,255,0.85)'), 0.12, 'center');
    foot(k, H - 56 * s, raw(k, '#ffffff'), raw(k, '#ffe27a'), 'center');
  },
};

/* 45 ─ Milestone confetti */
const milestone: Design = {
  id: 'milestone', name: 'Milestone confetti', kinds: MSG, size: SQ, isNew: true, fluid: true, drawsCta: true,
  draw(k) {
    const { ctx, W, H, d } = k; const s = u(k), P = 72 * s;
    ctx.fillStyle = '#0e0b1f'; ctx.fillRect(0, 0, W, H);
    const r = rng(17), cols = [k.accent, '#ff5c8a', '#4cc9f0', '#ffd23f', '#9b5de5'];
    for (let i = 0; i < 140; i++) {
      const x = r() * W, y = r() * H, a = r() * Math.PI, w = (8 + r() * 14) * s, h = (4 + r() * 6) * s;
      if (Math.abs(x - W / 2) < W * 0.3 && Math.abs(y - H / 2) < H * 0.22) continue;
      ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = raw(k, cols[i % cols.length]); ctx.globalAlpha = 0.85; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.restore();
    }
    const big = d.stats?.[0]?.value || (/[\d][\d,.]*[kKmM%+]*/.exec(plain(d.title))?.[0] ?? '🎉');
    caps(ctx, k.kicker, W / 2, P + 40 * s, font('sans', 24 * s, 800), k.accent, 0.2, 'center');
    const px = fit(ctx, big, W - P * 2, 300 * s, 'display', 700, 60 * s);
    ctx.fillStyle = emOn(k, '#0e0b1f', '#ffffff'); ctx.textAlign = 'center'; ctx.fillText(big, W / 2, H * 0.48);
    const f = richFit(ctx, d.title, W - P * 2, H * 0.2, 64 * s, 26 * s, 'display', 700, 1.1);
    const end = drawRich(k, f, P, H * 0.48 + px * 0.2, W - P * 2, '#ffffff', emOn(k, '#0e0b1f', '#ffffff'), 'center');
    if (d.subtitle) { ctx.font = font('sans', 28 * s, 500); ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.textAlign = 'center'; ctx.fillText(ellipsize(ctx, plain(d.subtitle), W - P * 2), W / 2, end + 40 * s); }
    if (d.cta) ctaPill(k, W / 2, H - 200 * s, d.cta, k.accent, '#0b0d14');
    foot(k, H - 56 * s, '#ffffff', k.accent, 'center');
  },
};

/* 46 ─ Announcement banner */
const announce: Design = {
  id: 'announce', name: 'Announcement banner', kinds: MSG, size: X, isNew: true, fluid: true, drawsCta: true,
  draw(k) {
    const { ctx, W, H, d } = k; const s = Math.min(W, H * 1.6) / 1080, P = 64 * s;
    ctx.fillStyle = '#0d1018'; ctx.fillRect(0, 0, W, H);
    const bh = 92 * s;
    ctx.fillStyle = k.accent; ctx.fillRect(0, 0, W, bh);
    const ink = inkOn(k, k.accent, '#0b0d14');
    caps(ctx, `📣 ${k.kicker}`, P, bh * 0.64, font('cond', 40 * s, 700), ink, 0.14);
    ctx.font = font('sans', 22 * s, 800); ctx.fillStyle = ink; ctx.textAlign = 'right'; ctx.fillText(k.stamp, W - P, bh * 0.62);
    const bottom = H - 110 * s - (d.cta ? 90 * s : 0);
    const f = richFit(ctx, d.title, W - P * 2, (bottom - bh - 60 * s) * (d.subtitle ? 0.72 : 1), 110 * s, 30 * s, 'display', 700, 1.06);
    const end = drawRich(k, f, P, bh + 50 * s, W - P * 2, '#ffffff', emOn(k, '#0d1018', '#ffffff'));
    if (d.subtitle) {
      const g = richFit(ctx, d.subtitle, W - P * 2, bottom - end - 20 * s, 36 * s, 18 * s, 'sans', 500, 1.3);
      drawRich(k, g, P, end + 16 * s, W - P * 2, 'rgba(255,255,255,0.78)', emOn(k, '#0d1018', '#ffffff'));
    }
    if (d.cta) ctaPill(k, W / 2, H - 170 * s, d.cta, k.accent, '#0b0d14');
    foot(k, H - 44 * s, '#ffffff');
  },
};

/* 47 ─ Question to followers */
const ask: Design = {
  id: 'ask', name: 'Question to followers', kinds: MSG, size: SQ, isNew: true, fluid: true, drawsCta: true,
  draw(k) {
    const { ctx, W, H, d } = k; const s = u(k), P = 72 * s;
    ctx.fillStyle = '#f4f1ea'; ctx.fillRect(0, 0, W, H);
    ctx.font = font('display', Math.min(W, H) * 1.0, 700); ctx.fillStyle = rgba(k.accent, 0.25); ctx.textAlign = 'right'; ctx.fillText('?', W + 30 * s, H * 0.92);
    caps(ctx, 'Question for you', P, P + 30 * s, font('sans', 24 * s, 800), '#6a6458', 0.18);
    const f = richFit(ctx, d.title, W - P * 2, H * 0.55, 120 * s, 30 * s, 'display', 700, 1.06);
    const end = drawRich(k, f, P, P + 80 * s, W - P * 2, '#14120e', emOn(k, '#f4f1ea', '#14120e'));
    if (d.subtitle) { const g = richFit(ctx, d.subtitle, W - P * 2, H * 0.12, 34 * s, 18 * s, 'sans', 500, 1.3); drawRich(k, g, P, end + 20 * s, W - P * 2, '#4a463d', emOn(k, '#f4f1ea', '#14120e')); }
    ctaPill(k, P, H - P - 140 * s, d.cta?.trim() || 'Reply below 👇', '#14120e', '#ffffff', true);
    foot(k, H - P + 10 * s, '#14120e');
  },
};

/* 48 ─ Minimal typographic */
const typo: Design = {
  id: 'typographic', name: 'Minimal typographic', kinds: MSG, size: X, isNew: true, fluid: true,
  draw(k) {
    const { ctx, W, H, d } = k; const s = Math.min(W, H * 1.6) / 1080, P = 80 * s;
    ctx.fillStyle = '#fafaf7'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#111111'; ctx.fillRect(P, P, 2 * s, H - P * 2);
    const f = richFit(ctx, d.title, W - P * 2 - 60 * s, H - P * 2 - 90 * s, 120 * s, 26 * s, 'serif', 700, 1.1);
    const top = P + (H - P * 2 - 90 * s - f.lines.length * f.lh) / 2;
    drawRich(k, f, P + 50 * s, top, W - P * 2 - 60 * s, '#111111', emOn(k, '#fafaf7', '#111111'));
    caps(ctx, d.quoteBy || plain(d.subtitle) || k.kicker, P + 50 * s, H - P, font('sans', 20 * s, 700), '#666666', 0.2);
    wordmark(ctx, W - P, H - P, 28 * s, { color: '#111111', accent: k.accent, align: 'right' });
  },
};

/* 49 ─ Thread cover */
const threadCover: Design = {
  id: 'thread-cover', name: 'Thread cover', kinds: [...MSG, 'promo', 'stat', 'race', 'balance', 'au-seat', 'flip'], size: PT, isNew: true, fluid: true, drawsCta: true,
  draw(k) {
    const { ctx, W, H, d } = k; const s = u(k), P = 72 * s;
    ctx.fillStyle = '#0b0d14'; ctx.fillRect(0, 0, W, H);
    blob(ctx, 0, H, W, k.accent, 0.22); grain(ctx, W, H, 0.03, 3);
    rr(ctx, P, P, 230 * s, 64 * s, 32 * s); ctx.fillStyle = k.accent; ctx.fill();
    caps(ctx, '🧵 Thread', P + 30 * s, P + 43 * s, font('sans', 26 * s, 800), inkOn(k, k.accent, '#0b0d14'), 0.12);
    const f = richFit(ctx, d.title, W - P * 2, H * 0.5, 130 * s, 34 * s, 'display', 700, 1.04);
    const end = drawRich(k, f, P, P + 140 * s, W - P * 2, '#ffffff', emOn(k, '#0b0d14', '#ffffff'));
    if (d.subtitle) { const g = richFit(ctx, d.subtitle, W - P * 2, H * 0.16, 40 * s, 20 * s, 'sans', 500, 1.3); drawRich(k, g, P, end + 30 * s, W - P * 2, 'rgba(255,255,255,0.75)', emOn(k, '#0b0d14', '#ffffff')); }
    const n = d.slide?.n;
    caps(ctx, d.cta?.trim() || (n ? `${n} posts · read on ↓` : 'Read the thread ↓'), P, H - 140 * s, font('sans', 28 * s, 800), k.accent, 0.1);
    foot(k, H - 56 * s, '#ffffff');
  },
};

/* 50 ─ Thread slide (numbered) */
const threadSlide: Design = {
  id: 'thread-slide', name: 'Thread slide (numbered)', kinds: [...MSG, 'promo', 'stat', 'race', 'balance', 'au-seat', 'flip'], size: PT, isNew: true, fluid: true,
  draw(k) {
    const { ctx, W, H, d } = k; const s = u(k), P = 72 * s;
    ctx.fillStyle = '#11131c'; ctx.fillRect(0, 0, W, H);
    const i = d.slide?.i ?? 1, n = d.slide?.n ?? 1;
    ctx.font = font('display', 200 * s, 700); ctx.fillStyle = emOn(k, '#11131c', '#ffffff'); ctx.textAlign = 'left'; ctx.fillText(String(i), P - 8 * s, P + 170 * s);
    const nw = ctx.measureText(String(i)).width;
    ctx.font = font('display', 60 * s, 500); ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillText(`/${n}`, P + nw + 6 * s, P + 170 * s);
    const f = richFit(ctx, d.title, W - P * 2, H - P * 2 - 330 * s, 76 * s, 26 * s, 'sans', 600, 1.3);
    drawRich(k, f, P, P + 230 * s, W - P * 2, '#ffffff', emOn(k, '#11131c', '#ffffff'), 'left', true);
    const dot = 14 * s, gap = 12 * s, tw = n * dot + (n - 1) * gap;
    for (let j = 0; j < n && n <= 20; j++) { ctx.beginPath(); ctx.arc(W / 2 - tw / 2 + j * (dot + gap) + dot / 2, H - 130 * s, dot / 2, 0, Math.PI * 2); ctx.fillStyle = j + 1 === i ? k.accent : 'rgba(255,255,255,0.25)'; ctx.fill(); }
    foot(k, H - 56 * s, '#ffffff');
  },
};

/* 51 ─ X poll companion */
const poll: Design = {
  id: 'poll', name: 'X poll companion', kinds: [...MSG, 'promo'], size: SQ, isNew: true, fluid: true,
  draw(k) {
    const { ctx, W, H, d } = k; const s = u(k), P = 72 * s;
    ctx.fillStyle = '#0f1420'; ctx.fillRect(0, 0, W, H);
    caps(ctx, '📊 Poll — vote below', P, P + 30 * s, font('sans', 24 * s, 800), k.accent, 0.16);
    const opts = (d.options?.length ? d.options : ['Yes', 'No']).slice(0, 4);
    const oh = 96 * s, og = 22 * s, block = opts.length * (oh + og);
    const f = richFit(ctx, d.title, W - P * 2, H - P * 2 - block - 200 * s, 92 * s, 28 * s, 'display', 700, 1.08);
    const avail = H - 130 * s - block - (P + 70 * s);
    const t0 = P + 70 * s + Math.max(0, (avail - f.lines.length * f.lh) / 2 - 20 * s);
    const end = drawRich(k, f, P, t0, W - P * 2, '#ffffff', emOn(k, '#0f1420', '#ffffff'));
    let y = Math.max(end + 50 * s, H - 130 * s - block);
    opts.forEach((o, i) => {
      rr(ctx, P, y, W - P * 2, oh, oh / 2); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 3 * s; ctx.stroke();
      ctx.beginPath(); ctx.arc(P + oh / 2, y + oh / 2, oh * 0.32, 0, Math.PI * 2); ctx.fillStyle = k.accent; ctx.fill();
      ctx.font = font('display', 34 * s, 700); ctx.fillStyle = inkOn(k, k.accent, '#0b0d14'); ctx.textAlign = 'center'; ctx.fillText('ABCD'[i], P + oh / 2, y + oh / 2 + 12 * s);
      ctx.font = font('sans', 36 * s, 700); ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left'; ctx.fillText(ellipsize(ctx, plain(o), W - P * 2 - oh - 40 * s), P + oh + 10 * s, y + oh / 2 + 13 * s);
      y += oh + og;
    });
    foot(k, H - 50 * s, '#ffffff');
  },
};

/* 52 ─ Reply / quote frame (owner's own post, clearly labelled) */
const replyFrame: Design = {
  id: 'reply-frame', name: 'Reply / quote frame', kinds: [...MSG, 'promo'], size: X, isNew: true, fluid: true,
  draw(k) {
    const { ctx, W, H, d } = k; const s = Math.min(W, H * 1.6) / 1080, P = 56 * s;
    ctx.fillStyle = '#0b0d14'; ctx.fillRect(0, 0, W, H);
    const q = d.quoted;
    const label = (q?.label?.trim() || 'Our earlier post').slice(0, 40);
    let y = P;
    if (q?.text) {
      caps(ctx, `↩ ${label}`, P, y + 24 * s, font('sans', 22 * s, 800), 'rgba(255,255,255,0.6)', 0.14);
      const fw = W - P * 2;
      const g = richFit(ctx, q.text, fw - 60 * s, H * 0.42 - 110 * s, 40 * s, 18 * s, 'sans', 500, 1.3);
      const fh = g.lines.length * g.lh + 130 * s;
      (ctx as Ctx & { letterSpacing?: string }).letterSpacing = '0px';
      rr(ctx, P, y + 44 * s, fw, fh, 22 * s); ctx.fillStyle = '#161a26'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2 * s; ctx.stroke();
      const ax = P + 30 * s, ay = y + 74 * s, ar = 26 * s;
      ctx.beginPath(); ctx.arc(ax + ar, ay + ar, ar, 0, Math.PI * 2); ctx.fillStyle = k.accent; ctx.fill();
      ctx.font = font('sans', 26 * s, 800); ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left'; ctx.fillText(q.by?.trim() || 'PolTok', ax + ar * 2 + 16 * s, ay + 22 * s);
      ctx.font = font('sans', 22 * s, 500); ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillText(d.handle?.trim() || '@PolTok', ax + ar * 2 + 16 * s, ay + 50 * s);
      drawRich(k, g, ax, ay + 70 * s, fw - 60 * s, 'rgba(255,255,255,0.88)', emOn(k, '#161a26', '#ffffff'));
      y += 44 * s + fh + 30 * s;
    }
    const f = richFit(ctx, d.title, W - P * 2, H - y - 90 * s, 72 * s, 24 * s, 'display', 700, 1.12);
    drawRich(k, f, P, y, W - P * 2, '#ffffff', emOn(k, '#0b0d14', '#ffffff'));
    foot(k, H - 36 * s, '#ffffff');
  },
};

/* 53 ─ Breaking banner */
const breakingBanner: Design = {
  id: 'breaking-banner', name: '“Breaking” banner', kinds: [...MSG, 'promo', 'race', 'flip', 'balance', 'au-seat', 'stat'], size: X, isNew: true, fluid: true,
  draw(k) {
    const { ctx, W, H, d } = k; const s = Math.min(W, H * 1.6) / 1080, P = 56 * s;
    ctx.fillStyle = '#0a0a12'; ctx.fillRect(0, 0, W, H);
    for (let x = -H; x < W; x += 60 * s) { ctx.fillStyle = 'rgba(255,255,255,0.025)'; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 30 * s, 0); ctx.lineTo(x + 30 * s + H, H); ctx.lineTo(x + H, H); ctx.fill(); }
    const by = H * 0.2, bh = 100 * s;
    ctx.fillStyle = raw(k, '#e8112d'); ctx.fillRect(0, by, W * 0.62, bh);
    ctx.fillStyle = raw(k, '#ffffff'); ctx.fillRect(W * 0.62, by, W * 0.38, bh);
    caps(ctx, 'Breaking', P, by + bh * 0.72, font('cond', 64 * s, 700), raw(k, '#ffffff'), 0.08);
    caps(ctx, k.stamp, W - P, by + bh * 0.64, font('sans', 24 * s, 800), raw(k, '#e8112d'), 0.06, 'right');
    const f = richFit(ctx, d.title, W - P * 2, H - by - bh - 150 * s, 96 * s, 28 * s, 'display', 700, 1.06);
    drawRich(k, f, P, by + bh + 40 * s, W - P * 2, '#ffffff', emOn(k, '#0a0a12', '#ffffff'));
    const ty = H - 80 * s;
    ctx.fillStyle = '#1a1b26'; ctx.fillRect(0, ty, W, 80 * s);
    ctx.font = font('sans', 26 * s, 700); ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.textAlign = 'left';
    ctx.fillText(ellipsize(ctx, plain(d.subtitle) || 'Developing — follow live updates', W * 0.62), P, ty + 50 * s);
    wordmark(ctx, W - P, ty + 54 * s, 30 * s, { color: '#ffffff', accent: k.accent, align: 'right' });
  },
};

/* 54 ─ Did you know */
const dyk: Design = {
  id: 'did-you-know', name: '“Did you know?” fact', kinds: [...MSG, 'stat', 'promo', 'au-seat', 'race', 'balance'], size: SQ, isNew: true, fluid: true,
  draw(k) {
    const { ctx, W, H, d } = k; const s = u(k), P = 72 * s;
    ctx.fillStyle = '#fff8e7'; ctx.fillRect(0, 0, W, H);
    ctx.beginPath(); ctx.arc(W - P - 70 * s, P + 70 * s, 70 * s, 0, Math.PI * 2); ctx.fillStyle = k.accent; ctx.fill();
    ctx.font = font('sans', 80 * s, 700); ctx.textAlign = 'center'; ctx.fillStyle = '#111'; ctx.fillText('💡', W - P - 70 * s, P + 98 * s);
    caps(ctx, 'Did you know?', P, P + 60 * s, font('serif', 64 * s, 900), '#1a1407', 0.02);
    const sv = d.stats?.[0];
    let y = P + 130 * s;
    if (sv && !MESSAGE_KINDS.includes(d.kind as never)) {
      const px = fit(ctx, sv.value, W - P * 2, 200 * s, 'display', 700, 40 * s);
      ctx.fillStyle = emOn(k, '#fff8e7', '#1a1407'); ctx.textAlign = 'left'; ctx.fillText(sv.value, P, y + px * 0.85);
      caps(ctx, sv.label, P, y + px + 30 * s, font('sans', 24 * s, 800), '#6b5d3c', 0.12); y += px + 70 * s;
    }
    const f = richFit(ctx, d.title, W - P * 2, H - y - 190 * s, 84 * s, 26 * s, 'display', 700, 1.12);
    const end = drawRich(k, f, P, y, W - P * 2, '#1a1407', emOn(k, '#fff8e7', '#1a1407'), 'left', true);
    if (d.subtitle) { const g = richFit(ctx, d.subtitle, W - P * 2, H - end - 150 * s, 32 * s, 18 * s, 'sans', 500, 1.3); drawRich(k, g, P, end + 20 * s, W - P * 2, '#4b412a', emOn(k, '#fff8e7', '#1a1407')); }
    ctx.font = font('sans', 20 * s, 600); ctx.fillStyle = '#6b5d3c'; ctx.textAlign = 'left'; ctx.fillText(ellipsize(ctx, `Source: ${k.attr}`, W - P * 2), P, H - 110 * s);
    foot(k, H - 50 * s, '#1a1407');
  },
};

/* 55 ─ Header / banner (any wide size; keeps text inside a centred safe area) */
const header: Design = {
  id: 'x-header', name: 'Profile header / banner', kinds: BRAND, size: { w: 1500, h: 500 }, isNew: true, fluid: true,
  draw(k) {
    const { ctx, W, H, d } = k; const s = Math.min(H / 500, W / 1500);
    ctx.fillStyle = '#0b0d14'; ctx.fillRect(0, 0, W, H);
    blob(ctx, W * 0.85, H * 0.2, Math.max(W, H) * 0.5, k.accent, 0.3); blob(ctx, W * 0.1, H, Math.max(W, H) * 0.4, '#3d7bff', 0.25);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1.5 * s;
    for (let x = 0; x < W; x += 50 * s) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    // safe area: central 1546×423 of a 2560×1440 (YouTube) ≈ 60%×29%; for 3:1 headers the right 70%
    const wide = W / H > 2.2 && W / H < 4.5;
    const yt = !wide && W >= 2000;
    const sw = wide ? W * 0.56 : yt ? W * 0.6 : W * 0.8, sh = wide ? H * 0.62 : yt ? H * 0.29 : H * 0.6;
    const sx = wide ? W * 0.32 : (W - sw) / 2, sy = (H - sh) / 2;
    const ws = Math.min(sh * 0.32, sw * 0.08);
    wordmark(ctx, sx, sy + ws * 0.9, ws, { color: '#ffffff', accent: k.accent });
    const f = richFit(ctx, d.title || 'Every race. Every call. Live.', sw, sh * 0.5, sh * 0.3, 10, 'display', 700, 1.05);
    const end = drawRich(k, f, sx, sy + ws * 1.4, sw, '#ffffff', emOn(k, '#0b0d14', '#ffffff'));
    if (d.subtitle) { ctx.font = font('sans', Math.max(10, sh * 0.09), 600); ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.textAlign = 'left'; ctx.fillText(ellipsize(ctx, plain(d.subtitle), sw), sx, Math.min(sy + sh, end + sh * 0.14)); }
  },
};

/* 56 ─ Profile avatar (circle-safe) */
const avatar: Design = {
  id: 'x-avatar', name: 'Profile picture (circle-safe)', kinds: BRAND, size: { w: 400, h: 400 }, isNew: true, fluid: true,
  draw(k) {
    const { ctx, W, H } = k; const R = Math.min(W, H) / 2, cx = W / 2, cy = H / 2;
    ctx.fillStyle = '#0b0d14'; ctx.fillRect(0, 0, W, H);
    blob(ctx, cx, cy, R * 1.3, k.accent, 0.35);
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.86, 0, Math.PI * 2); ctx.strokeStyle = k.accent; ctx.lineWidth = R * 0.05; ctx.stroke();
    const t = (k.d.title || 'PT').replace(/\*/g, '').trim();
    const mono = t.length <= 3 ? t : 'PT';
    ctx.font = font('display', R * 0.78, 700); ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let w = ctx.measureText(mono).width;
    if (w > R * 1.1) { ctx.font = font('display', R * 0.78 * (R * 1.1) / w, 700); w = R * 1.1; }
    const dr = R * 0.09;
    ctx.fillText(mono, cx - dr * 1.2, cy + R * 0.04);
    ctx.textBaseline = 'alphabetic';
    ctx.beginPath(); ctx.arc(cx - dr * 1.2 + w / 2 + dr * 1.6, cy + R * 0.26, dr, 0, Math.PI * 2); ctx.fillStyle = k.accent; ctx.fill();
  },
};

/* 57 ─ Highlight cover (IG/TikTok) */
const highlight: Design = {
  id: 'highlight', name: 'Highlight cover', kinds: BRAND, size: ST, isNew: true, fluid: true,
  draw(k) {
    const { ctx, W, H, d } = k; const R = Math.min(W, H) * 0.3, cx = W / 2, cy = H / 2;
    ctx.fillStyle = '#0b0d14'; ctx.fillRect(0, 0, W, H);
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fillStyle = k.accent; ctx.fill();
    const t = plain(d.title) || 'Live';
    const icon = /^\p{Extended_Pictographic}/u.test(t) ? [...t][0] : '';
    const word = (icon ? t.slice(icon.length) : t).trim().slice(0, 12);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (icon) { ctx.font = font('sans', R * 0.7, 400); ctx.fillText(icon, cx, cy - R * 0.12); }
    const px = fit(ctx, word.toUpperCase(), R * 1.5, icon ? R * 0.26 : R * 0.42, 'cond', 700, 10);
    ctx.fillStyle = inkOn(k, k.accent, '#0b0d14'); ctx.textBaseline = 'middle';
    ctx.fillText(word.toUpperCase(), cx, icon ? cy + R * 0.48 : cy + px * 0.05);
    ctx.textBaseline = 'alphabetic';
  },
};

/* 58 ─ Story template */
const storyMsg: Design = {
  id: 'story-message', name: 'Story template (message)', kinds: [...BRAND], size: ST, isNew: true, fluid: true, drawsCta: true,
  draw(k) {
    const { ctx, W, H, d } = k; const s = W / 1080, P = 90 * s;
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0b0d14'); g.addColorStop(1, '#1a1f33');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    blob(ctx, W * 0.5, H * 0.3, W, k.accent, 0.2);
    // keep clear of the top 250px / bottom 340px (platform UI)
    const top = 260 * s, bot = H - 360 * s;
    caps(ctx, k.kicker, W / 2, top + 30 * s, font('sans', 28 * s, 800), k.accent, 0.2, 'center');
    const f = richFit(ctx, d.title, W - P * 2, (bot - top - 200 * s) * 0.75, 170 * s, 36 * s, 'display', 700, 1.06);
    const y0 = top + 80 * s + ((bot - top - 200 * s) - f.lines.length * f.lh) / 2 * 0.6;
    const end = drawRich(k, f, P, y0, W - P * 2, '#ffffff', emOn(k, '#0b0d14', '#ffffff'), 'center');
    if (d.subtitle) { const g2 = richFit(ctx, d.subtitle, W - P * 2, 200 * s, 44 * s, 22 * s, 'sans', 500, 1.3); drawRich(k, g2, P, end + 30 * s, W - P * 2, 'rgba(255,255,255,0.78)', emOn(k, '#0b0d14', '#ffffff'), 'center'); }
    if (d.cta) ctaPill(k, W / 2, bot - 90 * s, d.cta, k.accent, '#0b0d14');
    wordmark(ctx, W / 2, bot + 20 * s, 44 * s, { color: '#ffffff', accent: k.accent, align: 'center' });
  },
};

export const DESIGNS_E: Design[] = [statement, notes, memo, gradQuote, milestone, announce, ask, typo, threadCover, threadSlide, poll, replyFrame, breakingBanner, dyk, header, avatar, highlight, storyMsg];
