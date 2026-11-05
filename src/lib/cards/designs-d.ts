/** Update 3 designs (31–40). Laid out relative to W/H so they reflow cleanly to any size preset. */
import { ALL, X, SQ, PT, type Design, hero, headline } from './common';
import { blob, caps, capsFit, dek, drawLines, drawMap, fitBlock, font, footerLine, grain, ink, mix, nameOf, portrait, rgba, rr, rowsOf, text, wordmark, wrap, ellipsize, fit, type K, inkOn } from './kit';

const num = (s?: string) => { const v = parseFloat(String(s ?? '').replace(/[^0-9.+-]/g, '')); return Number.isFinite(v) ? v : NaN; };
const sideRows = (k: K) => {
  const d = k.d;
  const rows = d.kind === 'balance' ? (d.stats ?? []).slice(0, 2).map((s) => ({ label: s.label.replace(/ \(.*\)/, ''), value: s.value, num: num(s.value) || 0, color: s.color ?? k.accent })) : (d.bars ?? []).slice(0, 2).map((b, i) => ({ label: b.label, value: d.kind === 'au-seat' ? `${b.value.toFixed(1)}%` : (d.stats?.[i]?.label === b.label ? d.stats[i].value : `${b.value.toFixed(1)}%`), num: b.value, color: b.color }));
  if (rows.length < 2 && d.kind !== 'balance') (d.stats ?? []).slice(rows.length, 2).forEach((s) => rows.push({ label: s.label, value: s.value, num: num(s.value) || 0, color: s.color ?? k.accent }));
  while (rows.length < 2) rows.push({ label: rows.length ? 'Challenger' : nameOf(k), value: '—', num: 0, color: '#5a6275' });
  return rows;
};
/** Top bar shared by the new designs: wordmark left, kicker right. */
function topBar(k: K, y: number, color = '#ffffff', muted = 'rgba(255,255,255,0.6)', accent = k.accent) {
  const u = U(k), P = 64 * u;
  wordmark(k.ctx, P, y, 38 * u, { color, accent });
  capsFit(k.ctx, k.d.slide ? `${k.kicker} · ${k.d.slide.i}/${k.d.slide.n}` : k.kicker, k.W * 0.5, k.W - P, y - 6 * u, font('sans', 20 * u, 800), muted, 0.16, 'right');
}
/** unit scale: 1 at 1080 short side, landscape cards get a little more */
const U = (k: K) => Math.min(k.W, k.H * 1.5) / 1080;
const ctaOr = (k: K) => k.d.cta?.trim() || `Follow live at ${k.url}`;

/* 31 ─ Countdown clock */
const countdown: Design = {
  id: 'countdown', name: 'Countdown clock', kinds: ['promo', 'custom', 'stat'], size: SQ, isNew: true, fluid: true, drawsCta: true,
  draw(k) {
    const { ctx, W, H, d } = k;
    const u = U(k), P = 64 * u;
    ctx.fillStyle = '#0a0c14'; ctx.fillRect(0, 0, W, H);
    blob(ctx, W * 0.5, H * 0.45, W * 0.75, k.accent, 0.22);
    grain(ctx, W, H, 0.035, 4);
    topBar(k, P + 30 * u);
    const to = d.countdownTo ?? NaN;
    const ms = Number.isFinite(to) ? Math.max(0, to - Date.now()) : NaN;
    const parts = Number.isFinite(ms) ? [Math.floor(ms / 864e5), Math.floor(ms / 36e5) % 24, Math.floor(ms / 6e4) % 60] : [NaN, NaN, NaN];
    const labels = ['Days', 'Hours', 'Minutes'];
    const tb = fitBlock(ctx, d.title, W - P * 2, H * 0.2, 92 * u, 'display', 700, 1.02, 2, 30 * u);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
    let y = drawLines(ctx, tb.lines, P, H * 0.2 + tb.px * 0.85, tb.lh);
    ctx.font = font('sans', 28 * u, 500); ctx.fillStyle = 'rgba(255,255,255,0.7)';
    y = drawLines(ctx, wrap(ctx, dek(k), W - P * 2, 2), P, y + 10 * u, 38 * u);
    const gap = 24 * u, tw = (W - P * 2 - gap * 2) / 3;
    const ty = y + 50 * u;
    const th = Math.max(80 * u, Math.min(tw * 1.08, H - 150 * u - 140 * u - ty));
    parts.forEach((v, i) => {
      const x = P + i * (tw + gap);
      const g = ctx.createLinearGradient(0, ty, 0, ty + th); g.addColorStop(0, '#1d2233'); g.addColorStop(1, '#121522');
      rr(ctx, x, ty, tw, th, 22 * u); ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 2 * u; ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(x, ty + th * 0.5 - 2 * u, tw, 4 * u);
      const s = Number.isFinite(v) ? String(v).padStart(2, '0') : '––';
      headline(k, s, x + tw / 2, ty + th * 0.5 + th * 0.2, tw - 30 * u, th * 0.58, 'display', i === 0 ? k.accent : '#ffffff', 700, 'center');
      caps(ctx, labels[i], x + tw / 2, ty + th + 44 * u, font('sans', 22 * u, 800), 'rgba(255,255,255,0.6)', 0.18, 'center');
    });
    const when = Number.isFinite(to) ? new Date(to).toLocaleString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }) : 'Date to be confirmed';
    caps(ctx, Number.isFinite(ms) && ms === 0 ? 'It’s here' : `Until ${when}`, W / 2, ty + th + 100 * u, font('sans', 22 * u, 700), k.accent, 0.1, 'center');
    const by = H - 150 * u;
    ctx.font = font('sans', 28 * u, 800);
    const cta = ellipsize(ctx, ctaOr(k), W - P * 2 - 60 * u);
    const cw = ctx.measureText(cta).width + 70 * u;
    rr(ctx, (W - cw) / 2, by - 46 * u, cw, 70 * u, 35 * u); ctx.fillStyle = k.accent; ctx.fill();
    text(ctx, cta, W / 2, by - 1 * u, font('sans', 28 * u, 800), inkOn(k, k.accent), 'center');
    footerLine(k, P, H - 40 * u, W - P * 2, 18 * u, 'rgba(255,255,255,0.45)', 'rgba(255,255,255,0.7)');
  },
};

/* 32 ─ Head-to-head with photos */
const h2h: Design = {
  id: 'h2h', name: 'Head-to-head (photos)', kinds: ['race', 'flip', 'au-seat', 'balance'], size: X, isNew: true, fluid: true,
  draw(k) {
    const { ctx, W, H, d } = k;
    const u = U(k), P = 56 * u;
    const [a, b] = sideRows(k);
    ctx.fillStyle = '#0b0d14'; ctx.fillRect(0, 0, W, H);
    const half = W / 2;
    const a0 = mix(a.color, '#0b0d14', 0.35), a1 = mix(a.color, '#0b0d14', 0.8);
    const b0 = mix(b.color, '#0b0d14', 0.35), b1 = mix(b.color, '#0b0d14', 0.8);
    const ga = ctx.createLinearGradient(0, 0, half, 0); ga.addColorStop(0, a0); ga.addColorStop(1, a1);
    ctx.fillStyle = ga; ctx.fillRect(0, 0, half, H);
    const gb = ctx.createLinearGradient(W, 0, half, 0); gb.addColorStop(0, b0); gb.addColorStop(1, b1);
    ctx.fillStyle = gb; ctx.fillRect(half, 0, half, H);
    // text colours judged against the real (palette-remapped) half backgrounds
    const inkA = inkOn(k, [a0, a1], '#fff'), inkB = inkOn(k, [b0, b1], '#fff'), inkAB = inkOn(k, [a0, a1, b0, b1], '#fff');
    const ph = Math.min(H * 0.46, W * 0.2);
    const py = H * 0.17;
    const isPeople = d.kind !== 'balance';
    if (isPeople) {
      portrait(ctx, k.img, a.label, P, py, ph, ph, a.color, { circle: true, ring: 6 * u });
      portrait(ctx, k.img2 ?? null, b.label, W - P - ph, py, ph, ph, b.color, { circle: true, ring: 6 * u });
    }
    const lx = isPeople ? P + ph + 28 * u : P, rx = isPeople ? W - P - ph - 28 * u : W - P;
    const colW = half - (lx) - 40 * u;
    headline(k, a.label, lx, py + ph * 0.32, colW, 40 * u, 'display', inkA, 700);
    headline(k, b.label, rx, py + ph * 0.32, colW, 40 * u, 'display', inkB, 700, 'right');
    headline(k, a.value, lx, py + ph * 0.32 + 120 * u, colW, 116 * u, 'display', inkA, 700);
    headline(k, b.value, rx, py + ph * 0.32 + 120 * u, colW, 116 * u, 'display', inkB, 700, 'right');
    // VS medallion
    ctx.save(); ctx.translate(half, py + ph * 0.5);
    ctx.fillStyle = '#0b0d14'; ctx.beginPath(); ctx.arc(0, 0, 44 * u, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 4 * u; ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.stroke();
    text(ctx, 'VS', 0, 2 * u, font('cond', 40 * u, 700), inkOn(k, '#0b0d14', '#fff'), 'center', 'middle'); ctx.restore();
    // share bar
    const by = H * 0.7, bh = 26 * u, tot = a.num + b.num;
    rr(ctx, P, by, W - P * 2, bh, bh / 2); ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fill();
    if (tot > 0) {
      ctx.save(); rr(ctx, P, by, W - P * 2, bh, bh / 2); ctx.clip();
      const aw = ((W - P * 2) * a.num) / Math.max(tot, d.kind === 'race' || d.kind === 'flip' ? 100 : tot);
      const bw = ((W - P * 2) * b.num) / Math.max(tot, d.kind === 'race' || d.kind === 'flip' ? 100 : tot);
      ctx.fillStyle = a.color; ctx.fillRect(P, by, aw, bh);
      ctx.fillStyle = b.color; ctx.fillRect(W - P - bw, by, bw, bh);
      ctx.restore();
    }
    ctx.fillStyle = '#fff'; ctx.fillRect(half - 1.5 * u, by - 10 * u, 3 * u, bh + 20 * u);
    headline(k, d.title, P, H - 90 * u, W * 0.6, 40 * u, 'display', inkAB, 700);
    ctx.font = font('sans', 24 * u, 500); ctx.fillStyle = inkAB; ctx.textAlign = 'left';
    ctx.fillText(ellipsize(ctx, dek(k), W * 0.6), P, H - 56 * u);
    wordmark(ctx, W - P, H - 76 * u, 30 * u, { align: 'right', color: inkB });
    ctx.font = font('sans', 18 * u, 500); ctx.fillStyle = inkB; ctx.textAlign = 'right';
    ctx.fillText(ellipsize(ctx, `${k.attr} · ${k.url}`, W * 0.34), W - P, H - 44 * u);
  },
};

/* 33 ─ Seat-change waterfall */
const waterfall: Design = {
  id: 'waterfall', name: 'Seat-change waterfall', kinds: ['balance', 'stat', 'custom', 'promo'], size: X, isNew: true, fluid: true,
  draw(k) {
    const { ctx, W, H, d } = k;
    const u = U(k), P = 60 * u;
    ctx.fillStyle = '#f6f5f1'; ctx.fillRect(0, 0, W, H);
    wordmark(ctx, P, P + 20 * u, 32 * u, { color: '#111', accent: mix(k.accent, '#000', 0.25) });
    capsFit(ctx, k.kicker, W * 0.4, W - P, P + 14 * u, font('sans', 18 * u, 800), '#666', 0.16, 'right');
    headline(k, d.title, P, P + 96 * u, W - P * 2, 52 * u, 'display', '#111', 700);
    ctx.font = font('sans', 22 * u, 500); ctx.fillStyle = '#555'; ctx.textAlign = 'left';
    ctx.fillText(ellipsize(ctx, dek(k), W - P * 2), P, P + 134 * u);
    // steps: balance → bars as stacked contributions; otherwise stats parsed (+/- deltas)
    type Step = { label: string; v: number; color: string; total?: boolean };
    let steps: Step[] = [];
    if (d.kind === 'balance' && d.bars?.length) steps = d.bars.filter((b) => b.value > 0).map((b) => ({ label: b.label, v: b.value, color: b.color }));
    else steps = (d.stats ?? []).map((s) => ({ label: s.label, v: num(s.value), color: s.color ?? k.accent })).filter((s) => Number.isFinite(s.v)).slice(0, 7);
    if (steps.length) steps.push({ label: 'Total', v: steps.reduce((a, s) => a + s.v, 0), color: '#111', total: true });
    const top = P + 170 * u, bot = H - 110 * u, ch = bot - top;
    let lo = 0, hi = 0, run = 0;
    for (const s of steps) { if (s.total) { hi = Math.max(hi, s.v); lo = Math.min(lo, s.v); continue; } const n = run + s.v; hi = Math.max(hi, run, n); lo = Math.min(lo, run, n); run = n; }
    const span = hi - lo || 1;
    const Y = (v: number) => bot - ((v - lo) / span) * ch;
    const n = Math.max(1, steps.length), cw = (W - P * 2) / n, bw = Math.min(cw * 0.62, 150 * u);
    ctx.fillStyle = '#ddd'; ctx.fillRect(P, Y(0), W - P * 2, 2 * u);
    run = 0;
    steps.forEach((s, i) => {
      const x = P + i * cw + (cw - bw) / 2;
      const a = s.total ? 0 : run, b = s.total ? s.v : run + s.v;
      const y1 = Y(Math.max(a, b)), y2 = Y(Math.min(a, b));
      rr(ctx, x, y1, bw, Math.max(3 * u, y2 - y1), 6 * u); ctx.fillStyle = s.color; ctx.fill();
      if (!s.total && i < steps.length - 1) { ctx.setLineDash([6 * u, 5 * u]); ctx.strokeStyle = '#999'; ctx.lineWidth = 2 * u; ctx.beginPath(); ctx.moveTo(x + bw, Y(b)); ctx.lineTo(x + cw, Y(b)); ctx.stroke(); ctx.setLineDash([]); }
      const lbl = s.total ? String(Math.round(s.v)) : `${s.v > 0 && d.kind !== 'balance' && i > 0 ? '+' : ''}${Math.round(s.v * 10) / 10}`;
      text(ctx, lbl, x + bw / 2, y1 - 12 * u, font('display', 34 * u, 700), '#111', 'center');
      ctx.font = font('sans', 18 * u, 700); ctx.fillStyle = '#444'; ctx.textAlign = 'center';
      drawLines(ctx, wrap(ctx, s.label, cw - 12 * u, 2), x + bw / 2, bot + 34 * u, 22 * u);
      if (!s.total) run = b;
    });
    if (!steps.length) text(ctx, 'No numeric data for this subject', W / 2, H / 2, font('sans', 28 * u, 600), '#888', 'center');
    footerLine(k, P, H - 26 * u, W - P * 2, 16 * u, '#777', '#111');
  },
};

/* 34 ─ Bill progress */
const DEFAULT_STEPS = ['Introduced', 'Committee', 'Passed House', 'Passed Senate', 'Signed into law'];
const bill: Design = {
  id: 'bill', name: 'Bill progress tracker', kinds: ['custom', 'promo', 'stat', 'quote'], size: X, isNew: true, fluid: true,
  draw(k) {
    const { ctx, W, H, d } = k;
    const u = U(k), P = 64 * u;
    ctx.fillStyle = '#0f1420'; ctx.fillRect(0, 0, W, H);
    blob(ctx, W * 0.85, 0, W * 0.6, k.accent, 0.18);
    topBar(k, P + 4 * u);
    const tb = fitBlock(ctx, d.title, W - P * 2, H * 0.26, 64 * u, 'display', 700, 1.04, 2, 26 * u);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
    let y = drawLines(ctx, tb.lines, P, P + 70 * u + tb.px * 0.85, tb.lh);
    ctx.font = font('sans', 23 * u, 500); ctx.fillStyle = 'rgba(255,255,255,0.7)';
    y = drawLines(ctx, wrap(ctx, dek(k), W - P * 2, 2), P, y + 6 * u, 32 * u);
    const steps = d.steps?.length ? d.steps : (d.stats?.length ? d.stats.map((s) => ({ label: `${s.label}${s.value ? ` · ${s.value}` : ''}`, done: true })) : DEFAULT_STEPS.map((l) => ({ label: l, done: false })));
    const n = steps.length, lineY = Math.max(y + 110 * u, H * 0.62), x0 = P + 30 * u, x1 = W - P - 30 * u;
    const lastDone = steps.reduce((a, s, i) => (s.done ? i : a), -1);
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 10 * u; ctx.beginPath(); ctx.moveTo(x0, lineY); ctx.lineTo(x1, lineY); ctx.stroke();
    if (lastDone >= 0 && n > 1) { ctx.strokeStyle = k.accent; ctx.beginPath(); ctx.moveTo(x0, lineY); ctx.lineTo(x0 + ((x1 - x0) * lastDone) / (n - 1), lineY); ctx.stroke(); }
    steps.forEach((s, i) => {
      const cx = n > 1 ? x0 + ((x1 - x0) * i) / (n - 1) : (x0 + x1) / 2;
      const cur = i === lastDone + 1;
      ctx.beginPath(); ctx.arc(cx, lineY, (cur ? 26 : 22) * u, 0, Math.PI * 2);
      ctx.fillStyle = s.done ? k.accent : '#0f1420'; ctx.fill();
      ctx.lineWidth = 5 * u; ctx.strokeStyle = s.done ? k.accent : cur ? '#fff' : 'rgba(255,255,255,0.3)'; ctx.stroke();
      if (s.done) { ctx.strokeStyle = ink(k.accent); ctx.lineWidth = 5 * u; ctx.beginPath(); ctx.moveTo(cx - 9 * u, lineY); ctx.lineTo(cx - 2 * u, lineY + 8 * u); ctx.lineTo(cx + 11 * u, lineY - 8 * u); ctx.stroke(); }
      const al: CanvasTextAlign = i === 0 && n > 2 ? 'left' : i === n - 1 && n > 2 ? 'right' : 'center';
      const tx = al === 'left' ? cx - 22 * u : al === 'right' ? cx + 22 * u : cx;
      ctx.font = font('sans', 20 * u, s.done || cur ? 800 : 600); ctx.fillStyle = s.done ? '#fff' : cur ? '#fff' : 'rgba(255,255,255,0.55)'; ctx.textAlign = al;
      drawLines(ctx, wrap(ctx, s.label, Math.min(220 * u, (x1 - x0) / Math.max(1, n - 1) - 10 * u), 3), tx, lineY + 62 * u, 24 * u);
      if (cur) caps(ctx, 'Next', tx, lineY - 44 * u, font('sans', 16 * u, 800), k.accent, 0.16, al);
    });
    footerLine(k, P, H - 34 * u, W - P * 2, 17 * u, 'rgba(255,255,255,0.45)', k.accent);
  },
};

/* 35 ─ Poll-trend sparkline */
const trend: Design = {
  id: 'trend', name: 'Poll trend', kinds: ['stat', 'custom', 'promo', 'au-seat', 'candidate'], size: X, isNew: true, fluid: true,
  draw(k) {
    const { ctx, W, H, d } = k;
    const u = U(k), P = 60 * u;
    ctx.fillStyle = '#0c1018'; ctx.fillRect(0, 0, W, H);
    topBar(k, P + 4 * u);
    headline(k, d.title, P, P + 78 * u, W - P * 2, 50 * u, 'display', '#fff', 700);
    ctx.font = font('sans', 21 * u, 500); ctx.fillStyle = 'rgba(255,255,255,0.68)'; ctx.textAlign = 'left';
    ctx.fillText(ellipsize(ctx, dek(k), W - P * 2), P, P + 114 * u);
    const series = (d.series ?? []).filter((s) => s.points.length >= 2);
    const gx = P, gy = P + 160 * u, legendW = 250 * u, gw = W - P * 2 - legendW, gh = H - gy - 90 * u;
    if (series.length) {
      const pts = series.flatMap((s) => s.points);
      const t0 = Math.min(...pts.map((p) => p.t)), t1 = Math.max(...pts.map((p) => p.t));
      let v0 = Math.min(...pts.map((p) => p.v)), v1 = Math.max(...pts.map((p) => p.v));
      const pad = Math.max(2, (v1 - v0) * 0.15); v0 = Math.max(0, Math.floor(v0 - pad)); v1 = Math.ceil(v1 + pad);
      const X_ = (t: number) => gx + ((t - t0) / (t1 - t0 || 1)) * gw, Y_ = (v: number) => gy + gh - ((v - v0) / (v1 - v0 || 1)) * gh;
      const tick = (v1 - v0) > 24 ? 10 : 5;
      ctx.font = font('mono', 15 * u, 400); ctx.textAlign = 'right';
      for (let v = Math.ceil(v0 / tick) * tick; v <= v1; v += tick) { ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(gx, Y_(v), gw, 1.5 * u); ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillText(`${v}`, gx + gw + 40 * u, Y_(v) + 5 * u); }
      const fmt = (t: number) => new Date(t).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
      ctx.textAlign = 'left'; ctx.fillText(fmt(t0), gx, gy + gh + 28 * u); ctx.textAlign = 'right'; ctx.fillText(fmt(t1), gx + gw, gy + gh + 28 * u);
      const ends: { y: number; s: (typeof series)[0] }[] = [];
      series.forEach((s) => {
        const ps = [...s.points].sort((a, b) => a.t - b.t);
        // smoothed average line + raw dots
        ctx.fillStyle = rgba(s.color, 0.35);
        ps.forEach((p) => { ctx.beginPath(); ctx.arc(X_(p.t), Y_(p.v), 4 * u, 0, Math.PI * 2); ctx.fill(); });
        const sm = ps.map((p, i) => { const w = ps.slice(Math.max(0, i - 2), i + 3); return { t: p.t, v: w.reduce((a, q) => a + q.v, 0) / w.length }; });
        ctx.strokeStyle = s.color; ctx.lineWidth = 5 * u; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.beginPath(); sm.forEach((p, i) => (i ? ctx.lineTo(X_(p.t), Y_(p.v)) : ctx.moveTo(X_(p.t), Y_(p.v)))); ctx.stroke();
        const last = sm[sm.length - 1];
        ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(X_(last.t), Y_(last.v), 8 * u, 0, Math.PI * 2); ctx.fill();
        ends.push({ y: Y_(last.v), s: { ...s, points: [last] } });
      });
      // legend (de-overlapped) at the right
      ends.sort((a, b) => a.y - b.y);
      const lh = 34 * u;
      for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < lh) ends[i].y = ends[i - 1].y + lh;
      ends.forEach((e) => {
        const lx = gx + gw + 60 * u;
        rr(ctx, lx, e.y - 12 * u, 22 * u, 22 * u, 5 * u); ctx.fillStyle = e.s.color; ctx.fill();
        text(ctx, e.s.label, lx + 32 * u, e.y + 7 * u, font('sans', 20 * u, 700), '#fff');
        text(ctx, `${e.s.points[0].v.toFixed(1)}`, W - P, e.y + 7 * u, font('display', 22 * u, 700), e.s.color, 'right');
      });
    } else {
      // fallback: horizontal bars of the stats
      const rows = rowsOf(k, 5); const max = Math.max(1, ...rows.map((r) => r.num));
      const rh = Math.min(70 * u, gh / Math.max(1, rows.length));
      rows.forEach((r, i) => {
        const yy = gy + i * rh;
        text(ctx, ellipsize(ctx, r.label, 300 * u), gx, yy + rh * 0.55, font('sans', 22 * u, 700), '#fff');
        rr(ctx, gx + 320 * u, yy + rh * 0.25, (W - P * 2 - 460 * u) * (r.num / max), rh * 0.45, 6 * u); ctx.fillStyle = r.color; ctx.fill();
        text(ctx, r.value, W - P, yy + rh * 0.6, font('display', 26 * u, 700), '#fff', 'right');
      });
    }
    footerLine(k, P, H - 30 * u, W - P * 2, 16 * u, 'rgba(255,255,255,0.45)', k.accent);
  },
};

/* 36 ─ Senate hemicycle (portrait) */
const senateArc: Design = {
  id: 'senate-arc', name: 'Chamber arc (portrait)', kinds: ['balance'], size: PT, isNew: true, fluid: true,
  draw(k) {
    const { ctx, W, H, d } = k;
    const u = U(k), P = 70 * u;
    ctx.fillStyle = '#f3f1ec'; ctx.fillRect(0, 0, W, H);
    wordmark(ctx, P, P + 30 * u, 40 * u, { color: '#111', accent: mix(k.accent, '#000', 0.3) });
    capsFit(ctx, k.kicker, W * 0.5, W - P, P + 24 * u, font('sans', 20 * u, 800), '#666', 0.16, 'right');
    const tb = fitBlock(ctx, d.title, W - P * 2, 220 * u, 110 * u, 'serif', 900, 1.0, 2, 40 * u);
    ctx.fillStyle = '#111'; ctx.textAlign = 'left';
    let y = drawLines(ctx, tb.lines, P, P + 120 * u + tb.px * 0.8, tb.lh);
    ctx.font = font('text', 30 * u, 400, true); ctx.fillStyle = '#444';
    y = drawLines(ctx, wrap(ctx, dek(k), W - P * 2, 2), P, y + 10 * u, 40 * u);
    const bars = (d.bars ?? []).filter((b) => b.value > 0);
    const total = Math.round(bars.reduce((a, b) => a + b.value, 0)) || 100;
    const cx = W / 2, R = (W - P * 2) / 2, cy = Math.max(y + 40 * u + R, H * 0.68);
    const rowsN = total > 200 ? 14 : total > 120 ? 9 : 7, rIn = R * 0.42;
    const seats: { x: number; y: number; a: number }[] = [];
    const radii = Array.from({ length: rowsN }, (_, i) => rIn + ((R - rIn) * i) / (rowsN - 1));
    const len = radii.reduce((a, r) => a + r, 0);
    radii.forEach((r, i) => { const n = i === rowsN - 1 ? total - seats.length : Math.round((total * r) / len); for (let j = 0; j < n; j++) { const a = Math.PI - (Math.PI * (j + 0.5)) / n; seats.push({ x: cx + r * Math.cos(a), y: cy - r * Math.sin(a), a }); } });
    seats.sort((p, q) => q.a - p.a || p.y - q.y);
    const colors: string[] = []; bars.forEach((b) => { for (let i = 0; i < Math.round(b.value); i++) colors.push(b.color); });
    const dot = Math.min(((R - rIn) / rowsN) * 0.44, 22 * u);
    seats.forEach((s, i) => { ctx.fillStyle = colors[i] ?? '#cfcabf'; ctx.beginPath(); ctx.arc(s.x, s.y, dot, 0, Math.PI * 2); ctx.fill(); });
    const st = d.stats ?? [];
    const maj = parseInt(st[3]?.value ?? '', 10);
    ctx.strokeStyle = '#111'; ctx.lineWidth = 3 * u; ctx.setLineDash([8 * u, 6 * u]); ctx.beginPath(); ctx.moveTo(cx, cy - R - 24 * u); ctx.lineTo(cx, cy - rIn + 30 * u); ctx.stroke(); ctx.setLineDash([]);
    if (maj) caps(ctx, `${maj} for majority`, cx, cy - R - 36 * u, font('sans', 18 * u, 800), '#111', 0.12, 'center');
    if (st[0] && st[1]) {
      text(ctx, st[0].value, cx - 20 * u, cy - 10 * u, font('display', 110 * u, 700), st[0].color ?? '#3d7bff', 'right');
      text(ctx, st[1].value, cx + 20 * u, cy - 10 * u, font('display', 110 * u, 700), st[1].color ?? '#ff3d55', 'left');
    }
    ctx.fillStyle = '#111'; ctx.fillRect(P, cy + 30 * u, W - P * 2, 2 * u);
    let lx = P;
    bars.forEach((b) => {
      ctx.font = font('sans', 20 * u, 700);
      const t = `${b.label} ${Math.round(b.value)}`;
      const w = ctx.measureText(t).width + 40 * u;
      if (lx + w > W - P) return;
      ctx.fillStyle = b.color; ctx.beginPath(); ctx.arc(lx + 10 * u, cy + 74 * u, 10 * u, 0, Math.PI * 2); ctx.fill();
      text(ctx, t, lx + 28 * u, cy + 81 * u, font('sans', 20 * u, 700), '#222');
      lx += w + 18 * u;
    });
    footerLine(k, P, H - 46 * u, W - P * 2, 18 * u, '#666', '#111');
  },
};

/* 37 ─ AU 2PP swing */
const auSwing: Design = {
  id: 'au-swing', name: 'AU 2PP swing meter', kinds: ['au-seat'], size: X, isNew: true, fluid: true,
  draw(k) {
    const { ctx, W, H, d } = k;
    const u = U(k), P = 60 * u;
    ctx.fillStyle = '#0f1a24'; ctx.fillRect(0, 0, W, H);
    blob(ctx, W * 0.2, H, W * 0.5, k.accent, 0.2);
    topBar(k, P + 4 * u, '#fff', 'rgba(255,255,255,0.6)', '#ffb000');
    const mapW = Math.min(300 * u, W * 0.26);
    drawMap(ctx, d.mapState, W - P - mapW, P + 40 * u, mapW, mapW * 0.8, { fill: k.accent, stroke: '#fff', glow: k.accent, base: 'rgba(255,255,255,0.12)' });
    const tw = W - P * 2 - mapW - 30 * u;
    headline(k, d.title, P, P + 110 * u, tw, 84 * u, 'display', '#fff', 700);
    ctx.font = font('sans', 22 * u, 500); ctx.fillStyle = 'rgba(255,255,255,0.72)'; ctx.textAlign = 'left';
    drawLines(ctx, wrap(ctx, dek(k), tw, 2), P, P + 150 * u, 30 * u);
    const [a, b] = sideRows(k);
    const m = a.num ? a.num - 50 : num(d.stats?.[0]?.value);
    const range = Math.max(10, Math.ceil((Math.abs(m) || 0) / 5) * 5 + 5);
    const x0 = P, x1 = W - P, my = H * 0.66, cx = (x0 + x1) / 2;
    const X_ = (v: number) => cx + (v / range) * (x1 - x0) / 2;
    const g = ctx.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, b.color); g.addColorStop(0.5, mix(a.color, b.color, 0.5)); g.addColorStop(1, a.color);
    rr(ctx, x0, my - 16 * u, x1 - x0, 32 * u, 16 * u); ctx.fillStyle = g; ctx.globalAlpha = 0.85; ctx.fill(); ctx.globalAlpha = 1;
    for (let v = -range; v <= range; v += 5) { ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(X_(v) - 1, my + 24 * u, 2 * u, 12 * u); text(ctx, v === 0 ? '50/50' : `${Math.abs(v)}`, X_(v), my + 60 * u, font('mono', 16 * u, 400), 'rgba(255,255,255,0.6)', 'center'); }
    ctx.fillStyle = '#fff'; ctx.fillRect(cx - 1.5 * u, my - 34 * u, 3 * u, 68 * u);
    if (Number.isFinite(m)) {
      const mx = X_(Math.max(-range, Math.min(range, m)));
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(mx, my - 22 * u); ctx.lineTo(mx - 16 * u, my - 52 * u); ctx.lineTo(mx + 16 * u, my - 52 * u); ctx.closePath(); ctx.fill();
      text(ctx, `${a.label} +${Math.abs(m).toFixed(1)}`, mx, my - 66 * u, font('display', 30 * u, 700), '#fff', 'center');
      ctx.strokeStyle = '#ffb000'; ctx.lineWidth = 4 * u; ctx.setLineDash([10 * u, 8 * u]); ctx.beginPath(); ctx.moveTo(cx, my + 82 * u); ctx.lineTo(mx, my + 82 * u); ctx.stroke(); ctx.setLineDash([]);
      text(ctx, `${Math.abs(m).toFixed(1)}% swing to ${b.label} flips it`, (cx + mx) / 2, my + 116 * u, font('sans', 22 * u, 800), '#ffb000', 'center');
    }
    text(ctx, `← ${b.label}`, x0, my - 30 * u, font('sans', 20 * u, 800), mix(b.color, '#fff', 0.3));
    text(ctx, `${a.label} →`, x1, my - 30 * u, font('sans', 20 * u, 800), mix(a.color, '#fff', 0.3), 'right');
    footerLine(k, P, H - 30 * u, W - P * 2, 16 * u, 'rgba(255,255,255,0.45)', '#ffb000');
  },
};

/* 38 ─ Quote with portrait */
const quotePortrait: Design = {
  id: 'quote-portrait', name: 'Quote with portrait', kinds: ['quote', 'candidate', 'custom', 'promo'], size: PT, isNew: true, fluid: true,
  draw(k) {
    const { ctx, W, H, d } = k;
    const u = U(k), P = 80 * u;
    ctx.fillStyle = '#101218'; ctx.fillRect(0, 0, W, H);
    const pr = Math.min(W * 0.36, H * 0.26);
    const g = ctx.createLinearGradient(0, 0, 0, H * 0.5); g.addColorStop(0, mix(k.accent, '#101218', 0.55)); g.addColorStop(1, '#101218');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H * 0.5);
    const who = d.quoteBy || (d.kind === 'quote' ? d.subtitle : nameOf(k)) || 'PolTok';
    portrait(ctx, k.img, who, P, P + 40 * u, pr, pr, mix(k.accent, '#000', 0.2), { circle: true, ring: 8 * u });
    text(ctx, '“', W - P, P + pr * 0.9, font('serif', pr * 1.4, 900), rgba(k.accent, 0.9), 'right');
    const qy = P + 40 * u + pr + 70 * u;
    const body = d.kind === 'quote' || d.kind === 'custom' ? d.title : (d.subtitle ?? d.title);
    const tb = fitBlock(ctx, body, W - P * 2, H - qy - 290 * u, 84 * u, 'serif', 700, 1.16, 7, 30 * u, true);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
    const y = drawLines(ctx, tb.lines, P, qy + tb.px * 0.85, tb.lh);
    ctx.fillStyle = k.accent; ctx.fillRect(P, y + 18 * u, 90 * u, 7 * u);
    capsFit(ctx, `— ${who}`, W - P * 2, P, y + 80 * u, font('sans', 28 * u, 800), '#fff', 0.1);
    if ((d.kind === 'quote' || d.kind === 'custom') && d.subtitle && d.subtitle !== who) { ctx.font = font('sans', 22 * u, 500); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.textAlign = 'left'; ctx.fillText(ellipsize(ctx, d.subtitle, W - P * 2), P, y + 118 * u); }
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(P, H - 130 * u, W - P * 2, 2 * u);
    wordmark(ctx, P, H - 66 * u, 36 * u);
    ctx.font = font('sans', 17 * u, 500); ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.textAlign = 'right';
    ctx.fillText(ellipsize(ctx, k.attr, W * 0.5), W - P, H - 82 * u);
    ctx.fillText(ellipsize(ctx, `${k.stamp} · ${k.url}`, W * 0.5), W - P, H - 56 * u);
  },
};

/* 39 ─ Carousel slide (n/N) */
const carousel: Design = {
  id: 'carousel', name: 'Carousel slide (1/5…5/5)', kinds: ALL, size: PT, isNew: true, fluid: true, drawsCta: true,
  draw(k) {
    const { ctx, W, H, d } = k;
    const u = U(k), P = 72 * u;
    const sl = d.slide ?? { i: 1, n: 1 };
    const last = sl.i === sl.n && sl.n > 1;
    ctx.fillStyle = '#fbfaf7'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = k.accent; ctx.fillRect(0, 0, W, 14 * u);
    wordmark(ctx, P, P + 34 * u, 36 * u, { color: '#111', accent: mix(k.accent, '#000', 0.3) });
    const pill = `${sl.i}/${sl.n}`;
    ctx.font = font('mono', 22 * u, 700);
    const pw = ctx.measureText(pill).width + 34 * u;
    rr(ctx, W - P - pw, P + 2 * u, pw, 46 * u, 23 * u); ctx.fillStyle = '#111'; ctx.fill();
    text(ctx, pill, W - P - pw / 2, P + 33 * u, font('mono', 22 * u, 700), '#fff', 'center');
    caps(ctx, k.kicker, P, P + 120 * u, font('sans', 22 * u, 800), mix(k.accent, '#000', 0.35), 0.16);
    const tb = fitBlock(ctx, d.title, W - P * 2, H * 0.3, 104 * u, 'display', 700, 1.02, 4, 36 * u);
    ctx.fillStyle = '#111'; ctx.textAlign = 'left';
    let y = drawLines(ctx, tb.lines, P, P + 150 * u + tb.px * 0.85, tb.lh);
    ctx.font = font('sans', 30 * u, 500); ctx.fillStyle = '#555';
    y = drawLines(ctx, wrap(ctx, dek(k), W - P * 2, 3), P, y + 14 * u, 42 * u) + 40 * u;
    const rows = rowsOf(k, 4);
    const avail = H - y - 230 * u;
    if (rows.length && avail > 120 * u) {
      const rh = Math.min(120 * u, avail / rows.length);
      const max = Math.max(1, ...rows.map((r) => r.num), d.kind === 'race' || d.kind === 'flip' ? 100 : 0);
      rows.forEach((r, i) => {
        const ry = y + i * rh;
        text(ctx, ellipsize(ctx, r.label, W * 0.55), P, ry + rh * 0.42, font('sans', 28 * u, 700), '#111');
        text(ctx, r.value, W - P, ry + rh * 0.42, font('display', 40 * u, 700), r.color === k.accent ? '#111' : r.color, 'right');
        rr(ctx, P, ry + rh * 0.58, W - P * 2, 14 * u, 7 * u); ctx.fillStyle = '#e9e6df'; ctx.fill();
        if (r.num > 0) { rr(ctx, P, ry + rh * 0.58, Math.max(14 * u, ((W - P * 2) * r.num) / max), 14 * u, 7 * u); ctx.fillStyle = r.color; ctx.fill(); }
      });
    }
    // progress dots + swipe / CTA
    const dy = H - 120 * u;
    const n = Math.min(sl.n, 12);
    for (let i = 0; i < n; i++) { ctx.fillStyle = i + 1 === sl.i ? '#111' : '#d6d2c8'; rr(ctx, P + i * 30 * u, dy - 6 * u, i + 1 === sl.i ? 22 * u : 12 * u, 12 * u, 6 * u); ctx.fill(); }
    const cta = last ? ctaOr(k) : 'Swipe →';
    ctx.font = font('sans', 24 * u, 800);
    const cw = Math.min(W * 0.6, ctx.measureText(cta).width + 48 * u);
    rr(ctx, W - P - cw, dy - 30 * u, cw, 60 * u, 30 * u); ctx.fillStyle = last ? k.accent : '#111'; ctx.fill();
    text(ctx, ellipsize(ctx, cta, cw - 40 * u), W - P - cw / 2, dy + 9 * u, font('sans', 24 * u, 800), last ? inkOn(k, k.accent) : '#fff', 'center');
    ctx.font = font('sans', 16 * u, 500); ctx.fillStyle = '#888'; ctx.textAlign = 'left';
    ctx.fillText(ellipsize(ctx, `${k.attr} · ${k.stamp}`, W - P * 2), P, H - 46 * u);
  },
};

/* 40 ─ Data table */
const table: Design = {
  id: 'table', name: 'Data table', kinds: ALL, size: PT, isNew: true, fluid: true,
  draw(k) {
    const { ctx, W, H, d } = k;
    const u = U(k), P = 70 * u;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#0d1321'; ctx.fillRect(0, 0, W, 300 * u);
    wordmark(ctx, P, P + 20 * u, 36 * u, { accent: k.accent });
    capsFit(ctx, k.kicker, W * 0.5, W - P, P + 14 * u, font('sans', 20 * u, 800), k.accent, 0.16, 'right');
    const tb = fitBlock(ctx, d.title, W - P * 2, 150 * u, 74 * u, 'display', 700, 1.04, 2, 28 * u);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
    drawLines(ctx, tb.lines, P, 300 * u - 40 * u - (tb.lines.length - 1) * tb.lh, tb.lh);
    ctx.font = font('sans', 24 * u, 500); ctx.fillStyle = '#4a5368';
    const dy = drawLines(ctx, wrap(ctx, dek(k), W - P * 2, 2), P, 350 * u, 32 * u);
    const tbl = d.table?.rows.length ? d.table : {
      head: d.kind === 'race' || d.kind === 'flip' ? ['Candidate', 'Share'] : d.kind === 'au-seat' ? ['', ''] : ['Measure', 'Value'],
      rows: [...(d.stats ?? []).map((s) => [s.label, s.value]), ...(d.kind === 'au-seat' && d.bars ? d.bars.map((b) => [`2PP · ${b.label}`, `${b.value.toFixed(1)}%`]) : [])],
    };
    const colors = d.table?.rows.length ? [] : [...(d.stats ?? []).map((s) => s.color), ...(d.bars ?? []).map((b) => b.color)];
    const cols = Math.max(1, tbl.head.length, ...tbl.rows.map((r) => r.length));
    const ty = dy + 30 * u, avail = H - ty - 150 * u;
    const rh = Math.min(92 * u, avail / Math.max(1, tbl.rows.length + 1));
    const first = (W - P * 2) * (cols > 2 ? 0.44 : 0.62), rest = (W - P * 2 - first) / Math.max(1, cols - 1);
    const cx = (c: number) => (c === 0 ? P : P + first + rest * c);
    const fs = Math.min(30 * u, rh * 0.38);
    if (tbl.head.some(Boolean)) {
      for (let c = 0; c < cols; c++) capsFit(ctx, tbl.head[c] ?? '', c === 0 ? first - 20 * u : rest - 10 * u, c === 0 ? P + 16 * u : cx(c) - 16 * u, ty + rh * 0.6, font('sans', fs * 0.62, 800), '#6b7489', 0.12, c === 0 ? 'left' : 'right');
      ctx.fillStyle = '#0d1321'; ctx.fillRect(P, ty + rh - 3 * u, W - P * 2, 3 * u);
    }
    tbl.rows.slice(0, Math.floor(avail / rh) - 1).forEach((r, i) => {
      const ry = ty + rh * (i + 1);
      if (i % 2 === 0) { ctx.fillStyle = '#f3f5f9'; ctx.fillRect(P, ry, W - P * 2, rh); }
      for (let c = 0; c < cols; c++) {
        const v = r[c] ?? '';
        if (c === 0) {
          let lx = P + 16 * u;
          if (colors[i]) { ctx.fillStyle = colors[i]!; rr(ctx, lx, ry + rh * 0.3, 8 * u, rh * 0.4, 3 * u); ctx.fill(); lx += 24 * u; }
          ctx.font = font('sans', fs, 600); ctx.fillStyle = '#0d1321'; ctx.textAlign = 'left';
          ctx.fillText(ellipsize(ctx, v, first - (lx - P) - 10 * u), lx, ry + rh * 0.62);
        } else {
          ctx.font = font('display', fs * 1.05, 700); ctx.fillStyle = '#0d1321'; ctx.textAlign = 'right';
          ctx.fillText(ellipsize(ctx, v, rest - 20 * u), cx(c) - 16 * u, ry + rh * 0.64);
        }
      }
    });
    if (!tbl.rows.length) text(ctx, 'No rows', W / 2, ty + 80 * u, font('sans', 28 * u, 600), '#99a', 'center');
    ctx.fillStyle = '#0d1321'; ctx.fillRect(P, H - 110 * u, W - P * 2, 2 * u);
    footerLine(k, P, H - 60 * u, W - P * 2, 18 * u, '#6b7489', '#0d1321');
  },
};

export const DESIGNS_D: Design[] = [countdown, h2h, waterfall, bill, trend, senateArc, auSwing, quotePortrait, carousel, table];
void [X, hero, fit];
