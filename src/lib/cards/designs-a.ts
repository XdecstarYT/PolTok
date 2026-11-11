import { ALL, X, SQ, PT, type Design, hero, resultList, balanceBlock, tag, headline, glass } from './common';
import { blob, caps, capsFit, dek, drawLines, drawMap, fitBlock, font, footerLine, grain, halftone, ink, mix, nameOf, portrait, rgba, rr, rng, stackBar, text, vignette, wordmark, wrap, ellipsize, fit, inkOn } from './kit';

/* 1 ─ Broadcast lower third */
const broadcast: Design = {
  id: 'broadcast', name: 'Broadcast lower-third', kinds: ['race', 'flip', 'balance', 'au-seat', 'stat', 'promo'], size: X,
  draw(k) {
    const { ctx, W, H, d } = k;
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#0a1f4d'); g.addColorStop(1, '#030915');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    blob(ctx, W * 0.8, H * 0.2, 520, k.accent, 0.35);
    // studio light streaks
    ctx.save(); ctx.globalAlpha = 0.07;
    for (let i = 0; i < 9; i++) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(i * 160 - 100, 0); ctx.lineTo(i * 160 - 40, 0); ctx.lineTo(i * 160 + 160, H); ctx.lineTo(i * 160 + 100, H); ctx.fill(); }
    ctx.restore();
    // corner bug
    wordmark(ctx, W - 48, 70, 40, { align: 'right' });
    rr(ctx, 48, 36, 150, 44, 4); ctx.fillStyle = '#e8112d'; ctx.fill();
    caps(ctx, d.kind === 'flip' ? '● Flip' : '● Live', 66, 67, font('cond', 26, 700), '#fff', 0.1);
    // map or portrait panel
    const pw = 300, ph = 300;
    if (!drawMap(ctx, d.mapState, 60, 120, 420, 280, { fill: rgba(k.accent, 0.85), stroke: '#fff', lineWidth: 3, glow: k.accent }))
      portrait(ctx, k.img, nameOf(k), 60, 110, pw, ph * 0.95, k.accent, { radius: 8, fam: 'cond' });
    // results on right
    if (d.kind === 'balance') balanceBlock(k, 520, 120, W - 570, 290, { fam: 'cond' });
    else resultList(k, 520, 120, W - 570, 280, { fam: 'cond', valueFam: 'cond', upper: true, maxRows: 3, radius: 0 });
    // lower third
    const ly = H - 210;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, ly, W, 104);
    ctx.fillStyle = k.accent; ctx.fillRect(0, ly, 24, 104);
    const tagW = tag(k, d.kind === 'flip' ? 'Seat flip' : d.kind === 'balance' ? 'Control' : k.kicker, 50, ly - 26, 22, '#e8112d', '#fff', 'cond', 2);
    void tagW;
    headline(k, d.title.toUpperCase(), 50, ly + 82, W - 100, 70, 'cond', '#0a1230', 700);
    ctx.fillStyle = '#0a1230'; ctx.fillRect(0, ly + 104, W, 54);
    ctx.font = font('rc', 26, 700); ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
    ctx.fillText(ellipsize(ctx, dek(k).toUpperCase(), W - 100), 50, ly + 141);
    ctx.fillStyle = '#e8112d'; ctx.fillRect(0, H - 52, W, 52);
    footerLine(k, 50, H - 18, W - 100, 22, '#fff', '#fff', 'rc');
  },
};

/* 2 ─ Newspaper front page */
const newspaper: Design = {
  id: 'newspaper', name: 'Newspaper front page', kinds: ['race', 'flip', 'balance', 'quote', 'au-seat', 'stat'], size: PT,
  draw(k) {
    const { ctx, W, H, d } = k;
    ctx.fillStyle = '#f3ecdc'; ctx.fillRect(0, 0, W, H);
    grain(ctx, W, H, 0.05, 3);
    const P = 64;
    ctx.fillStyle = '#1b1712';
    text(ctx, 'The PolTok Times', W / 2, 150, font('serif', 104, 900), '#1b1712', 'center');
    ctx.fillRect(P, 182, W - P * 2, 3); ctx.fillRect(P, 190, W - P * 2, 1);
    caps(ctx, `Late edition`, P, 222, font('text', 22, 600), '#1b1712', 0.1);
    caps(ctx, k.stamp, W / 2, 222, font('text', 22, 600), '#1b1712', 0.06, 'center');
    caps(ctx, k.url, W - P, 222, font('text', 22, 600), '#1b1712', 0.06, 'right');
    ctx.fillRect(P, 238, W - P * 2, 1); ctx.fillRect(P, 243, W - P * 2, 3);
    // headline
    const head = d.kind === 'quote' ? `“${d.title}”` : d.kind === 'flip' ? `${d.title.toUpperCase()} FLIPS` : d.title.toUpperCase();
    const hb = fitBlock(ctx, head, W - P * 2, 330, 150, 'serif', 900, 0.98, 3, 40);
    ctx.fillStyle = '#111'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    let y = drawLines(ctx, hb.lines, W / 2, 270 + hb.px * 0.92, hb.lh);
    ctx.font = font('text', 34, 400, true); ctx.fillStyle = '#3a332a';
    const dl = wrap(ctx, dek(k), W - P * 2 - 80, 2);
    y = drawLines(ctx, dl, W / 2, y + 30, 44) + 10;
    ctx.fillStyle = '#1b1712'; ctx.fillRect(P, y, W - P * 2, 2);
    // columns: left photo/map, right results
    const cy = y + 34, ch = H - cy - 130, colW = (W - P * 2 - 40) / 2;
    if (d.kind === 'balance') { balanceBlock(k, P, cy + 20, W - P * 2, ch * 0.7, { fam: 'serif', color: '#1b1712', muted: '#4b4236', track: '#d8ceb8' }); text(ctx, k.attr, P, H - 54, font('text', 22, 600), '#1b1712'); wordmark(ctx, W - P, H - 50, 34, { color: '#1b1712', accent: '#b0241b', fam: 'serif', align: 'right' }); return; }
    ctx.save(); ctx.filter = 'grayscale(1) contrast(1.15)';
    if (!drawMap(ctx, d.mapState, P, cy, colW, ch * 0.75, { fill: '#2b2620', stroke: '#2b2620', base: '#cbbf a6'.replace(' ', '') })) portrait(ctx, k.img, nameOf(k), P, cy, colW, ch * 0.75, '#6d6253', { fam: 'serif' });
    ctx.restore();
    ctx.font = font('text', 20, 400, true); ctx.fillStyle = '#4b4236'; ctx.textAlign = 'left';
    ctx.fillText(ellipsize(ctx, d.mapState ? `Above: ${d.mapState.replace('AU:', '')}` : nameOf(k), colW), P, cy + ch * 0.75 + 32);
    ctx.fillStyle = '#b9ad95'; ctx.fillRect(P + colW + 19, cy, 1, ch);
    const rx = P + colW + 40;
    if (d.kind === 'quote') {
      ctx.font = font('text', 28, 400); ctx.fillStyle = '#2b2620';
      drawLines(ctx, wrap(ctx, `${d.subtitle ?? 'PolTok'} — Live coverage continues on ${k.url}, with every race call, flip and the balance of power updated as the count progresses.`, colW, 9), rx, cy + 30, 40);
    } else resultList(k, rx, cy, colW, Math.min(ch * 0.8, 520), { fam: 'text', valueFam: 'serif', labelColor: '#1b1712', track: '#d8ceb8', radius: 0, bars: true });
    ctx.fillStyle = '#1b1712'; ctx.fillRect(P, H - 92, W - P * 2, 2);
    text(ctx, k.attr, P, H - 54, font('text', 22, 600), '#1b1712');
    wordmark(ctx, W - P, H - 50, 34, { color: '#1b1712', accent: '#b0241b', fam: 'serif', align: 'right' });
  },
};

/* 3 ─ Neon command center */
const neon: Design = {
  id: 'neon', name: 'Neon command center', kinds: ALL, size: X,
  draw(k) {
    const { ctx, W, H, d } = k;
    ctx.fillStyle = '#03040a'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(0,255,240,0.07)'; ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 30) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    blob(ctx, 0, H, 600, '#ff00d4', 0.25); blob(ctx, W, 0, 600, '#00f0ff', 0.25);
    const cyan = '#00f0ff', mag = '#ff2bd6';
    // HUD corners
    ctx.strokeStyle = cyan; ctx.lineWidth = 4;
    const c = 40, m = 28;
    for (const [x, y, sx, sy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]) { ctx.beginPath(); ctx.moveTo(x, y + sy * c); ctx.lineTo(x, y); ctx.lineTo(x + sx * c, y); ctx.stroke(); }
    ctx.shadowColor = cyan; ctx.shadowBlur = 18;
    caps(ctx, `// ${k.kicker} :: ${d.mapState?.replace('AU:', '') ?? 'NAT'}`, 70, 92, font('mono', 22, 700), cyan, 0.08);
    ctx.shadowColor = mag;
    headline(k, d.kind === 'quote' ? `“${d.title}”` : d.title, 70, 170, W - 140, d.kind === 'quote' ? 54 : 74, 'display', '#fff', 700);
    ctx.shadowBlur = 0;
    text(ctx, ellipsize(ctx, dek(k), W - 140), 70, 214, font('mono', 22, 400), rgba(cyan, 0.85));
    ctx.save(); ctx.shadowColor = k.accent; ctx.shadowBlur = 20;
    if (d.kind === 'balance') balanceBlock(k, 70, 260, W - 140, 290, { fam: 'mono', color: cyan, muted: rgba(cyan, 0.8), track: 'rgba(0,240,255,0.1)' });
    else if (d.kind === 'quote') {
      ctx.font = font('mono', 28, 400); ctx.fillStyle = rgba(cyan, 0.9);
      drawLines(ctx, ['> source: ' + (d.subtitle ?? 'PolTok'), '> status: verified feed', '> stream: ' + k.url], 70, 300, 46);
    } else resultList(k, 70, 270, W - 140 - (d.mapState ? 330 : 0), 270, { fam: 'mono', valueFam: 'display', upper: true, track: 'rgba(0,240,255,0.12)', radius: 0, swatch: true });
    ctx.restore();
    if (d.mapState && d.kind !== 'balance' && d.kind !== 'quote') {
      ctx.strokeStyle = rgba(cyan, 0.3); ctx.lineWidth = 2; ctx.strokeRect(W - 380, 250, 310, 300);
      drawMap(ctx, d.mapState, W - 370, 260, 290, 280, { fill: rgba(k.accent, 0.35), stroke: k.accent, lineWidth: 3, glow: k.accent, base: 'rgba(0,240,255,0.15)' });
    }
    ctx.fillStyle = rgba(cyan, 0.3); ctx.fillRect(70, H - 88, W - 140, 2);
    wordmark(ctx, 70, H - 44, 30, { accent: mag });
    ctx.font = font('mono', 18, 400); ctx.fillStyle = rgba(cyan, 0.85); ctx.textAlign = 'right';
    ctx.fillText(ellipsize(ctx, `${k.attr} · ${k.stamp} · ${k.url}`, W - 400), W - 70, H - 50);
  },
};

/* 4 ─ Minimalist Swiss */
const swiss: Design = {
  id: 'swiss', name: 'Swiss grid', kinds: ALL, size: SQ,
  draw(k) {
    const { ctx, W, H, d } = k;
    ctx.fillStyle = '#f4f4f0'; ctx.fillRect(0, 0, W, H);
    const red = '#e3000f';
    ctx.strokeStyle = 'rgba(0,0,0,0.08)'; ctx.lineWidth = 1;
    for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo((W / 6) * i, 0); ctx.lineTo((W / 6) * i, H); ctx.stroke(); }
    ctx.fillStyle = red; ctx.fillRect(0, 0, W / 6 * 2, 360);
    ctx.save(); ctx.translate(60, 330); ctx.rotate(-Math.PI / 2);
    capsFit(ctx, k.kicker, 290, 0, 30, font('sans', 26, 800), '#fff', 0.08); ctx.restore();
    const h = hero(k);
    if (h.value) { fit(ctx, h.value, W / 6 * 2 - 130, 120, 'sans', 800); ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.fillText(h.value, 120, 320); }
    ctx.font = font('sans', 22, 600); text(ctx, ellipsize(ctx, h.label, W / 6 * 2 - 140), 120, 210, font('sans', 22, 600), 'rgba(255,255,255,0.85)');
    wordmark(ctx, W - 60, 90, 40, { color: '#111', accent: red, fam: 'sans', align: 'right' });
    const tb = fitBlock(ctx, d.kind === 'quote' ? `“${d.title}”` : d.title, W - 120, 330, 118, 'sans', 800, 0.98, 4, 40);
    ctx.fillStyle = '#111'; ctx.textAlign = 'left';
    let y = drawLines(ctx, tb.lines, 60, 400 + tb.px * 0.85, tb.lh);
    ctx.font = font('sans', 30, 500); ctx.fillStyle = '#444';
    y = drawLines(ctx, wrap(ctx, dek(k), W - 240, 2), 60, y + 20, 40);
    const by = Math.max(y + 30, 780);
    ctx.fillStyle = '#111'; ctx.fillRect(60, by - 20, W - 120, 4);
    if (d.kind === 'balance') balanceBlock(k, 60, by, W - 120, 180, { fam: 'sans', color: '#111', muted: '#555', track: '#ddd' });
    else if (d.kind !== 'quote') resultList(k, 60, by, W - 120, H - by - 110, { fam: 'sans', valueFam: 'sans', labelColor: '#111', valueColor: '#111', track: '#ddd', radius: 0, maxRows: 3 });
    ctx.fillStyle = '#111'; ctx.fillRect(60, H - 90, W - 120, 1);
    footerLine(k, 60, H - 50, W - 120, 20, '#555', red, 'sans');
  },
};

/* 5 ─ Bold poster */
const poster: Design = {
  id: 'poster', name: 'Bold poster', kinds: ALL, size: PT,
  draw(k) {
    const { ctx, W, H, d } = k;
    const bg = k.accent, fg = inkOn(k, bg);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    halftone(ctx, 0, 0, W, H * 0.6, rgba(fg.replace('!', '') === '#ffffff' ? '#000000' : '#ffffff', 0.12), 22, 8, 'y');
    ctx.fillStyle = fg; ctx.fillRect(60, 60, W - 120, 10);
    caps(ctx, k.kicker, 60, 130, font('cond', 40, 700), fg, 0.12);
    wordmark(ctx, W - 60, 130, 44, { color: fg, accent: fg.replace('!', '') === '#ffffff' ? '#0b0d14' : '#ffffff', fam: 'cond', align: 'right' });
    const words = (d.kind === 'quote' ? d.title : d.title).toUpperCase();
    const tb = fitBlock(ctx, words, W - 120, 640, 260, 'cond', 700, 0.92, 5, 50);
    ctx.fillStyle = fg; ctx.textAlign = 'left';
    let y = drawLines(ctx, tb.lines, 54, 200 + tb.px * 0.85, tb.lh);
    ctx.font = font('rc', 36, 700); ctx.fillStyle = fg;
    y = drawLines(ctx, wrap(ctx, dek(k).toUpperCase(), W - 120, 2), 60, y + 20, 46);
    // block bottom
    const by = Math.max(y + 30, H - 420);
    ctx.fillStyle = fg === '#ffffff' ? '#0b0d14' : '#0b0d14'; ctx.fillRect(0, by, W, H - by);
    if (d.kind === 'balance') balanceBlock(k, 60, by + 40, W - 120, 230, { fam: 'cond' });
    else if (d.kind === 'quote') text(ctx, `— ${d.subtitle ?? 'PolTok'}`, 60, by + 120, font('cond', 64, 700), bg);
    else resultList(k, 60, by + 40, W - 120, H - by - 160, { fam: 'cond', valueFam: 'cond', upper: true, maxRows: 3, radius: 0 });
    footerLine(k, 60, H - 50, W - 120, 22, 'rgba(255,255,255,0.7)', bg, 'rc');
  },
};

/* 6 ─ Scoreboard */
const scoreboard: Design = {
  id: 'scoreboard', name: 'Stadium scoreboard', kinds: ['race', 'flip', 'balance', 'au-seat'], size: X,
  draw(k) {
    const { ctx, W, H, d } = k;
    ctx.fillStyle = '#111'; ctx.fillRect(0, 0, W, H);
    halftone(ctx, 0, 0, W, H, 'rgba(255,255,255,0.05)', 10, 2.2, 'x');
    rr(ctx, 40, 40, W - 80, H - 80, 20); ctx.fillStyle = '#1d1f24'; ctx.fill(); ctx.lineWidth = 8; ctx.strokeStyle = '#3a3d45'; ctx.stroke();
    const amber = '#ffb000';
    rr(ctx, 80, 70, W - 160, 70, 8); ctx.fillStyle = '#000'; ctx.fill();
    ctx.shadowColor = amber; ctx.shadowBlur = 12;
    headline(k, d.title.toUpperCase(), W / 2, 122, W - 200, 44, 'mono', amber, 700, 'center');
    ctx.shadowBlur = 0;
    const rows = d.kind === 'balance'
      ? (d.stats ?? []).slice(0, 2).map((s) => ({ label: s.label.replace(/ \(.*\)/, ''), value: s.value, color: s.color ?? '#fff' }))
      : (d.stats ?? []).slice(0, 2).map((s, i) => ({ label: s.label, value: d.kind === 'au-seat' ? (d.bars?.[i] ? `${d.bars[i].value.toFixed(1)}` : s.value) : s.value.replace('%', ''), color: d.bars?.[i]?.color ?? s.color ?? '#fff' }));
    if (d.kind === 'au-seat' && d.bars) rows.splice(0, 2, ...d.bars.map((b) => ({ label: b.label, value: b.value.toFixed(1), color: b.color })));
    const colW = (W - 200) / 2;
    rows.forEach((r, i) => {
      const x = 100 + i * (colW + 0);
      rr(ctx, x + 10, 170, colW - 20, 60, 6); ctx.fillStyle = r.color; ctx.fill();
      headline(k, r.label.toUpperCase(), x + colW / 2, 213, colW - 50, 34, 'cond', ink(r.color), 700, 'center');
      rr(ctx, x + 40, 250, colW - 80, 230, 10); ctx.fillStyle = '#000'; ctx.fill();
      ctx.shadowColor = amber; ctx.shadowBlur = 20;
      headline(k, r.value, x + colW / 2, 430, colW - 120, 190, 'mono', amber, 700, 'center');
      ctx.shadowBlur = 0;
    });
    text(ctx, d.kind === 'balance' ? 'SEATS' : d.kind === 'au-seat' ? '2PP %' : 'VOTE %', W / 2, 380, font('cond', 26, 700), '#888', 'center');
    ctx.font = font('rc', 26, 700); ctx.fillStyle = '#ddd'; ctx.textAlign = 'center';
    ctx.fillText(ellipsize(ctx, dek(k).toUpperCase(), W - 220), W / 2, 530);
    wordmark(ctx, 100, H - 70, 30);
    ctx.font = font('rc', 18, 400); ctx.fillStyle = '#999'; ctx.textAlign = 'right';
    ctx.fillText(ellipsize(ctx, `${k.attr} · ${k.stamp} · ${k.url}`, W - 400), W - 100, H - 74);
  },
};

/* 7 ─ Map hero */
const mapHero: Design = {
  id: 'map-hero', name: 'Map spotlight', kinds: ['race', 'flip', 'au-seat', 'promo'], size: SQ,
  draw(k) {
    const { ctx, W, H, d } = k;
    const g = ctx.createRadialGradient(W / 2, H * 0.45, 50, W / 2, H * 0.45, W * 0.8);
    g.addColorStop(0, mix(k.accent, '#070a14', 0.75)); g.addColorStop(1, '#05070d');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    for (let r = 100; r < W; r += 90) { ctx.beginPath(); ctx.arc(W / 2, H * 0.42, r, 0, Math.PI * 2); ctx.stroke(); }
    const drew = drawMap(ctx, d.mapState, 140, 130, W - 280, 520, { fill: k.accent, stroke: '#fff', lineWidth: 4, glow: k.accent, base: 'rgba(255,255,255,0.14)' });
    if (!drew) portrait(ctx, k.img, nameOf(k), W / 2 - 220, 150, 440, 440, k.accent, { circle: true, ring: 8 });
    wordmark(ctx, 60, 90, 38);
    caps(ctx, k.kicker, W - 60, 82, font('sans', 22, 800), 'rgba(255,255,255,0.7)', 0.12, 'right');
    const h = hero(k);
    if (h.value && d.kind !== 'promo') {
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 30;
      fit(ctx, h.value, 420, 130, 'display', 700); ctx.fillStyle = '#fff'; ctx.textAlign = 'right'; ctx.fillText(h.value, W - 60, 680);
      ctx.restore();
      capsFit(ctx, h.label, 400, W - 60, 716, font('sans', 22, 700), h.color === '#fff' ? '#fff' : mix(h.color, '#ffffff', 0.35), 0.06, 'right');
    }
    headline(k, d.title, 60, 820, W - 120, 84, 'news', '#fff', 700);
    ctx.font = font('sans', 28, 500); ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.textAlign = 'left';
    drawLines(ctx, wrap(ctx, dek(k), W - 120, 2), 60, 870, 38);
    stackBar(ctx, d, 60, 950, W - 120, 14, 7);
    footerLine(k, 60, H - 46, W - 120, 20, 'rgba(255,255,255,0.6)', '#c6ff3d');
  },
};

/* 8 ─ Big number */
const bigNumber: Design = {
  id: 'big-number', name: 'Big number', kinds: ['stat', 'balance', 'race', 'au-seat', 'promo', 'flip'], size: SQ,
  draw(k) {
    const { ctx, W, H, d } = k;
    ctx.fillStyle = '#0b0d14'; ctx.fillRect(0, 0, W, H);
    blob(ctx, W * 0.2, H * 0.3, 700, k.accent, 0.25);
    wordmark(ctx, 70, 110, 44);
    caps(ctx, k.kicker, W - 70, 100, font('sans', 22, 800), k.accent, 0.14, 'right');
    const h = hero(k);
    const v = h.value || '—';
    const px = fit(ctx, v, W - 140, 400, 'display', 700, 60);
    const grad = ctx.createLinearGradient(0, 260, 0, 260 + px);
    grad.addColorStop(0, '#ffffff'); grad.addColorStop(1, mix(h.color, '#ffffff', 0.2));
    ctx.fillStyle = grad; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(v, 62, 200 + px * 0.86);
    capsFit(ctx, h.label, W - 140, 70, 260 + px * 0.86, font('sans', 30, 800), mix(h.color, '#ffffff', 0.3), 0.1);
    const tb = fitBlock(ctx, d.title, W - 140, 220, 80, 'news', 700, 1.05, 2, 34);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
    let y = drawLines(ctx, tb.lines, 70, 340 + px * 0.86 + tb.px, tb.lh);
    ctx.font = font('sans', 28, 500); ctx.fillStyle = 'rgba(255,255,255,0.65)';
    y = drawLines(ctx, wrap(ctx, dek(k), W - 140, 2), 70, y + 6, 38);
    const rest = (d.stats ?? []).slice(1, 4);
    if (rest.length && y < H - 220) {
      const cw = (W - 140) / rest.length;
      rest.forEach((s, i) => {
        const x = 70 + i * cw;
        ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(x, H - 230, cw - 20, 2);
        headline(k, s.value, x, H - 160, cw - 30, 56, 'display', s.color ?? '#fff', 700);
        capsFit(ctx, s.label, cw - 30, x, H - 125, font('sans', 18, 700), 'rgba(255,255,255,0.6)', 0.08);
      });
    }
    footerLine(k, 70, H - 50, W - 140, 20, 'rgba(255,255,255,0.5)', k.accent);
  },
};

/* 9 ─ Versus split */
const versus: Design = {
  id: 'versus', name: 'Versus split', kinds: ['race', 'flip', 'balance', 'au-seat'], size: X,
  draw(k) {
    const { ctx, W, H, d } = k;
    const rows = (d.kind === 'balance' ? (d.stats ?? []).slice(0, 2).map((s) => ({ label: s.label.replace(/ \(.*\)/, ''), value: s.value, color: s.color ?? '#888' }))
      : (d.bars ?? []).slice(0, 2).map((b, i) => ({ label: b.label, value: d.kind === 'au-seat' ? `${b.value.toFixed(1)}%` : (d.stats?.[i]?.value ?? `${b.value.toFixed(1)}%`), color: b.color })));
    while (rows.length < 2) rows.push({ label: rows.length ? 'Challenger' : d.title, value: '—', color: '#555' });
    const [a, b] = rows;
    ctx.fillStyle = mix(a.color, '#000', 0.25); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W * 0.58, 0); ctx.lineTo(W * 0.42, H); ctx.lineTo(0, H); ctx.fill();
    ctx.fillStyle = mix(b.color, '#000', 0.25); ctx.beginPath(); ctx.moveTo(W * 0.58, 0); ctx.lineTo(W, 0); ctx.lineTo(W, H); ctx.lineTo(W * 0.42, H); ctx.fill();
    halftone(ctx, 0, 0, W, H, 'rgba(0,0,0,0.18)', 16, 4, 'x');
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(W * 0.58 - 6, 0); ctx.lineTo(W * 0.58 + 6, 0); ctx.lineTo(W * 0.42 + 6, H); ctx.lineTo(W * 0.42 - 6, H); ctx.fill();
    // VS badge
    ctx.save(); ctx.translate(W / 2, H * 0.46); ctx.rotate(-0.12);
    ctx.fillStyle = '#0b0d14'; ctx.beginPath(); ctx.arc(0, 0, 70, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.stroke();
    text(ctx, 'VS', 0, 4, font('cond', 64, 700), '#fff', 'center', 'middle'); ctx.restore();
    const side = (r: typeof a, left: boolean) => {
      const x = left ? 60 : W - 60, al: CanvasTextAlign = left ? 'left' : 'right';
      if (d.kind !== 'balance') portrait(ctx, left ? k.img : null, r.label, left ? 60 : W - 210, 70, 150, 150, mix(r.color, '#000', 0.1), { circle: true, ring: 6 });
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 20;
      headline(k, r.value, x, 450, W * 0.36, 150, 'cond', '#fff', 700, al); ctx.restore();
      headline(k, r.label.toUpperCase(), x, 290, W * 0.34, 46, 'cond', '#fff', 700, al);
    };
    side(a, true); side(b, false);
    ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, H - 150, W, 150);
    headline(k, d.title, 60, H - 92, W * 0.62, 46, 'display', '#fff', 700);
    ctx.font = font('sans', 22, 500); ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.textAlign = 'left';
    ctx.fillText(ellipsize(ctx, dek(k), W * 0.62), 60, H - 56);
    wordmark(ctx, W - 60, H - 86, 34, { align: 'right' });
    ctx.font = font('sans', 16, 500); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.textAlign = 'right';
    ctx.fillText(ellipsize(ctx, `${k.attr} · ${k.stamp} · ${k.url}`, W * 0.3), W - 60, H - 46);
    ctx.fillText(ellipsize(ctx, '', 10), 0, 0);
  },
};

/* 10 ─ Ticker tape */
const ticker: Design = {
  id: 'ticker', name: 'Ticker tape', kinds: ALL, size: X,
  draw(k) {
    const { ctx, W, H, d } = k;
    ctx.fillStyle = '#0d1117'; ctx.fillRect(0, 0, W, H);
    const tape = (y: number, h: number, bg: string, fg: string, items: string[], off: number) => {
      ctx.fillStyle = bg; ctx.fillRect(0, y, W, h);
      ctx.font = font('mono', h * 0.42, 700); ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      let x = -off;
      let i = 0;
      while (x < W) { const t = items[i % items.length]; ctx.fillStyle = fg; ctx.fillText(t, x, y + h / 2 + 1); x += ctx.measureText(t).width + 30; ctx.fillStyle = rgba(fg === '#000000' ? '#000000' : '#ffffff', 0.5); ctx.fillText('◆', x - 22, y + h / 2); i++; }
      ctx.textBaseline = 'alphabetic';
    };
    const items = (d.stats ?? []).map((s) => `${s.label.toUpperCase()} ${s.value}`);
    tape(0, 64, '#ffcc00', '#000000', items.length ? items : [d.title.toUpperCase()], 40);
    tape(H - 120, 64, '#e8112d', '#ffffff', ['POLTOK LIVE', d.title.toUpperCase(), k.kicker.toUpperCase(), k.url.toUpperCase()], 120);
    caps(ctx, k.kicker, 60, 130, font('mono', 24, 700), '#ffcc00', 0.1);
    const tb = fitBlock(ctx, d.kind === 'quote' ? `“${d.title}”` : d.title, W * 0.6, 180, 80, 'display', 700, 1.02, 2, 30);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
    let y = drawLines(ctx, tb.lines, 60, 150 + tb.px, tb.lh);
    ctx.font = font('sans', 24, 500); ctx.fillStyle = 'rgba(255,255,255,0.7)';
    y = drawLines(ctx, wrap(ctx, dek(k), W * 0.6, 2), 60, y + 4, 32);
    // right: quote-board
    const bx = W * 0.66, bw = W - bx - 50;
    rr(ctx, bx, 100, bw, H - 250, 12); ctx.fillStyle = '#161b22'; ctx.fill(); ctx.strokeStyle = '#30363d'; ctx.lineWidth = 2; ctx.stroke();
    const rows = (d.stats ?? []).slice(0, 4);
    rows.forEach((s, i) => {
      const ry = 120 + i * ((H - 290) / Math.max(rows.length, 1));
      capsFit(ctx, s.label, bw - 40, bx + 20, ry + 30, font('mono', 18, 700), '#8b949e', 0.04);
      headline(k, s.value, bx + 20, ry + 82, bw - 40, 50, 'mono', s.color ?? '#3fb950', 700);
    });
    if (!rows.length) { ctx.font = font('mono', 24, 400); ctx.fillStyle = '#8b949e'; drawLines(ctx, wrap(ctx, d.subtitle ?? 'PolTok', bw - 40, 6), bx + 20, 160, 34); }
    stackBar(ctx, d, 60, H - 230, W * 0.6, 22, 0, '#21262d');
    wordmark(ctx, 60, H - 160, 30);
    ctx.font = font('mono', 16, 400); ctx.fillStyle = '#8b949e'; ctx.textAlign = 'right';
    ctx.fillText(ellipsize(ctx, `${k.attr} · ${k.stamp}`, W * 0.4), W * 0.62, H - 162);
    ctx.fillStyle = '#0d1117'; ctx.fillRect(0, H - 56, W, 56);
    footerLine(k, 60, H - 20, W - 120, 18, '#8b949e', '#ffcc00', 'mono');
    void rng;
  },
};

export const DESIGNS_A: Design[] = [broadcast, newspaper, neon, swiss, poster, scoreboard, mapHero, bigNumber, versus, ticker];
void glass;
