import { ALL, X, SQ, PT, ST, type Design, hero, resultList, balanceBlock, tag, headline, glass } from './common';
import { blob, caps, capsFit, dek, drawLines, drawMap, fitBlock, font, footerLine, grain, halftone, ink, mix, nameOf, portrait, rgba, rr, rng, stackBar, star, text, vignette, wordmark, wrap, ellipsize, fit, rowsOf } from './kit';

/* 11 ─ Retro CRT */
const crt: Design = {
  id: 'crt', name: 'Retro CRT', kinds: ALL, size: SQ,
  draw(k) {
    const { ctx, W, H, d } = k;
    ctx.fillStyle = '#020a04'; ctx.fillRect(0, 0, W, H);
    const G = '#39ff7a';
    const g2 = ctx.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, W * 0.75);
    g2.addColorStop(0, 'rgba(57,255,122,0.10)'); g2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.shadowColor = G; ctx.shadowBlur = 14;
    const L = 80;
    text(ctx, 'POLTOK ELECTION TERMINAL v26.11', L, 120, font('plex', 28, 700), G);
    text(ctx, '='.repeat(40), L, 160, font('plex', 28, 400), rgba(G, 0.6));
    caps(ctx, `> ${k.kicker}`, L, 220, font('plex', 30, 700), G, 0.04);
    const tb = fitBlock(ctx, (d.kind === 'quote' ? `"${d.title}"` : d.title).toUpperCase(), W - L * 2, 250, 84, 'plex', 700, 1.1, 3, 30);
    ctx.fillStyle = G; ctx.textAlign = 'left';
    let y = drawLines(ctx, tb.lines, L, 250 + tb.px, tb.lh);
    ctx.font = font('plex', 26, 400); ctx.fillStyle = rgba(G, 0.8);
    y = drawLines(ctx, wrap(ctx, dek(k), W - L * 2, 2), L, y + 20, 36);
    y += 30;
    const rows = rowsOf(k, 4);
    if (d.kind === 'balance' || rows.length) {
      rows.forEach((r) => {
        const blocks = Math.round(Math.min(1, r.num / Math.max(100, ...rows.map((x) => x.num))) * 20);
        const lab = ellipsize(ctx, r.label.toUpperCase(), 420);
        ctx.font = font('plex', 28, 700); ctx.fillStyle = G;
        ctx.fillText(lab, L, y);
        ctx.textAlign = 'right'; ctx.fillText(r.value, W - L, y); ctx.textAlign = 'left';
        ctx.font = font('plex', 26, 400); ctx.fillStyle = rgba(G, 0.9);
        ctx.fillText('█'.repeat(blocks) + '░'.repeat(20 - blocks), L, y + 38);
        y += 96;
      });
    }
    ctx.font = font('plex', 28, 700); ctx.fillStyle = G;
    ctx.fillText(`> ${k.url}_`, L, H - 140);
    ctx.font = font('plex', 20, 400); ctx.fillStyle = rgba(G, 0.7);
    ctx.fillText(ellipsize(ctx, `${k.attr} · ${k.stamp}`, W - L * 2), L, H - 96);
    ctx.restore();
    for (let yy = 0; yy < H; yy += 4) { ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(0, yy, W, 2); }
    vignette(ctx, W, H, 0.85);
    ctx.strokeStyle = '#111'; ctx.lineWidth = 50; rr(ctx, -10, -10, W + 20, H + 20, 90); ctx.stroke();
  },
};

/* 12 ─ Paper cutout */
const cutout: Design = {
  id: 'cutout', name: 'Paper cutout', kinds: ALL, size: PT,
  draw(k) {
    const { ctx, W, H, d } = k;
    ctx.fillStyle = '#efe6d2'; ctx.fillRect(0, 0, W, H);
    grain(ctx, W, H, 0.06, 11);
    const r = rng(42);
    const paper = (pts: [number, number][], color: string, rot = 0) => {
      ctx.save(); ctx.rotate(rot);
      ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 8;
      ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x + r() * 6, y + r() * 6) : ctx.moveTo(x, y))); ctx.closePath();
      ctx.fillStyle = color; ctx.fill(); ctx.restore();
    };
    const torn = (x: number, y: number, w: number, h: number) => { const pts: [number, number][] = []; for (let i = 0; i <= 20; i++) pts.push([x + (w * i) / 20, y + (r() - 0.5) * 14]); for (let i = 20; i >= 0; i--) pts.push([x + (w * i) / 20, y + h + (r() - 0.5) * 14]); return pts; };
    paper(torn(-20, 120, W + 40, 300), mix(k.accent, '#efe6d2', 0.15), -0.02);
    paper(torn(-20, 760, W + 40, 520), '#23324a', 0.015);
    paper([[740, 40], [1040, 70], [1010, 260], [760, 230]], '#f6d743', 0.03);
    wordmark(ctx, 780, 180, 48, { color: '#23324a', accent: '#d9472b', fam: 'display' });
    caps(ctx, k.kicker, 70, 100, font('display', 26, 700), '#23324a', 0.1);
    // headline on accent strip — letters on paper chips
    const head = d.kind === 'quote' ? `“${d.title}”` : d.title;
    const tb = fitBlock(ctx, head, W - 160, 270, 110, 'display', 700, 1.05, 3, 34);
    const fg = ink(k.accent, '#14161c');
    ctx.fillStyle = fg; ctx.textAlign = 'left';
    drawLines(ctx, tb.lines, 80, 140 + (300 - tb.lines.length * tb.lh) / 2 + tb.px * 0.85, tb.lh);
    // subtitle note card
    ctx.save(); ctx.translate(90, 470); ctx.rotate(-0.025);
    ctx.shadowColor = 'rgba(0,0,0,0.2)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 6;
    ctx.fillStyle = '#fffdf7'; ctx.fillRect(0, 0, W - 180, 230); ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(70,120,200,0.25)'; for (let yy = 50; yy < 230; yy += 40) { ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W - 180, yy); ctx.stroke(); }
    ctx.font = font('text', 34, 400, true); ctx.fillStyle = '#23324a'; ctx.textAlign = 'left';
    drawLines(ctx, wrap(ctx, dek(k), W - 260, 4), 40, 82, 40);
    ctx.restore();
    // tape
    ctx.save(); ctx.translate(W / 2 - 80, 450); ctx.rotate(0.05); ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(0, 0, 160, 44); ctx.restore();
    if (d.kind === 'balance') balanceBlock(k, 80, 820, W - 160, 300, { fam: 'display' });
    else if (d.kind === 'quote') text(ctx, `— ${d.subtitle ?? 'PolTok'}`, 80, 900, font('display', 54, 700), '#f6d743');
    else resultList(k, 80, 820, W - 160, 340, { fam: 'display', valueFam: 'display', maxRows: 3, radius: 4, track: 'rgba(255,255,255,0.15)' });
    footerLine(k, 80, H - 60, W - 160, 20, 'rgba(255,255,255,0.75)', '#f6d743', 'display');
  },
};

/* 13 ─ Aurora story */
const aurora: Design = {
  id: 'aurora', name: 'Gradient aurora (story)', kinds: ALL, size: ST,
  draw(k) {
    const { ctx, W, H, d } = k;
    ctx.fillStyle = '#070512'; ctx.fillRect(0, 0, W, H);
    blob(ctx, W * 0.1, H * 0.15, 900, '#7b2cff', 0.55);
    blob(ctx, W * 0.95, H * 0.35, 900, k.accent, 0.5);
    blob(ctx, W * 0.3, H * 0.8, 1000, '#00c2ff', 0.4);
    blob(ctx, W * 0.9, H * 0.95, 700, '#ff4fa3', 0.35);
    grain(ctx, W, H, 0.04, 5);
    wordmark(ctx, W / 2, 200, 64, { align: 'center' });
    tag(k, k.kicker, W / 2 - 160, 260, 26, 'rgba(255,255,255,0.15)', '#fff');
    const cx = 70, cw = W - 140;
    glass(k, cx, 380, cw, 1250, 48, 0.08);
    const ix = cx + 70, iw = cw - 140;
    let y = 470;
    if (d.kind !== 'quote' && d.kind !== 'promo' && d.kind !== 'stat' && d.kind !== 'balance') {
      if (!drawMap(ctx, d.mapState, ix + iw - 320, y - 30, 320, 260, { fill: k.accent, stroke: '#fff', lineWidth: 3, glow: k.accent, base: 'rgba(255,255,255,0.18)' })) portrait(ctx, k.img, nameOf(k), ix, y, 220, 220, k.accent, { circle: true, ring: 6 });
      y += 270;
    }
    const tb = fitBlock(ctx, d.kind === 'quote' ? `“${d.title}”` : d.title, iw, 420, 120, 'display', 700, 1.04, 4, 40);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
    y = drawLines(ctx, tb.lines, ix, y + tb.px * 0.85, tb.lh);
    ctx.font = font('sans', 36, 500); ctx.fillStyle = 'rgba(255,255,255,0.75)';
    y = drawLines(ctx, wrap(ctx, dek(k), iw, 3), ix, y + 24, 48) + 50;
    const rest = 380 + 1250 - y - 80;
    if (d.kind === 'balance') balanceBlock(k, ix, y, iw, Math.min(rest, 420), { fam: 'display' });
    else if (d.kind === 'quote') text(ctx, `— ${d.subtitle ?? 'PolTok'}`, ix, y + 40, font('display', 48, 700), '#fff');
    else resultList(k, ix, y, iw, Math.min(rest, 560), { fam: 'sans', valueFam: 'display', radius: 10, track: 'rgba(255,255,255,0.14)' });
    ctx.font = font('sans', 28, 500); ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.textAlign = 'center';
    ctx.fillText(ellipsize(ctx, k.attr, W - 140), W / 2, H - 200);
    ctx.fillText(k.stamp, W / 2, H - 155);
    text(ctx, k.url, W / 2, H - 90, font('display', 40, 700), '#fff', 'center');
  },
};

/* 14 ─ Terminal */
const terminal: Design = {
  id: 'terminal', name: 'Terminal window', kinds: ALL, size: X,
  draw(k) {
    const { ctx, W, H, d } = k;
    const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#3a1c71'); g.addColorStop(0.5, '#d76d77'); g.addColorStop(1, '#ffaf7b');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 20;
    rr(ctx, 60, 40, W - 120, H - 80, 16); ctx.fillStyle = '#1e1e2e'; ctx.fill(); ctx.restore();
    ctx.save(); rr(ctx, 60, 40, W - 120, 50, 16); ctx.clip(); ctx.fillStyle = '#313244'; ctx.fillRect(60, 40, W - 120, 50); ctx.restore();
    ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(92 + i * 30, 65, 9, 0, Math.PI * 2); ctx.fill(); });
    text(ctx, `poltok — ${d.kind} — zsh`, W / 2, 72, font('mono', 18, 400), '#a6adc8', 'center');
    const L = 100; let y = 140;
    const line = (parts: [string, string][], px = 24) => { let x = L; ctx.font = font('mono', px, 400); ctx.textAlign = 'left'; for (const [t, c] of parts) { ctx.fillStyle = c; ctx.fillText(t, x, y); x += ctx.measureText(t).width; } y += px * 1.55; };
    line([['➜ ', '#a6e3a1'], ['~ ', '#89b4fa'], ['poltok ', '#f5c2e7'], [`${d.kind} ${(d.mapState ?? '').replace('AU:', '')}`, '#cdd6f4']]);
    ctx.font = font('mono', 40, 700); ctx.fillStyle = '#f9e2af';
    const tl = wrap(ctx, d.kind === 'quote' ? `"${d.title}"` : d.title, W - 2 * L, 2);
    y = drawLines(ctx, tl, L, y + 16, 50) + 6;
    ctx.font = font('mono', 22, 400); ctx.fillStyle = '#94e2d5';
    ctx.fillText(ellipsize(ctx, `# ${dek(k)}`, W - 2 * L), L, y); y += 46;
    const rows = rowsOf(k, 4);
    const max = Math.max(100, ...rows.map((r) => r.num));
    rows.forEach((r) => {
      ctx.font = font('mono', 24, 700); ctx.fillStyle = r.color; ctx.textAlign = 'left';
      ctx.fillText(ellipsize(ctx, r.label.padEnd(18).slice(0, 22), 360), L, y);
      const bw = Math.round((Math.min(r.num, max) / max) * 24);
      ctx.fillStyle = r.color; ctx.font = font('mono', 24, 400);
      ctx.fillText('▇'.repeat(Math.max(0, bw)), L + 370, y);
      ctx.font = font('mono', 24, 700); ctx.fillStyle = '#cdd6f4'; ctx.textAlign = 'right'; ctx.fillText(r.value, W - L, y);
      y += 40;
    });
    ctx.textAlign = 'left';
    y = Math.max(y + 10, H - 150);
    ctx.font = font('mono', 18, 400); ctx.fillStyle = '#6c7086';
    ctx.fillText(ellipsize(ctx, `${k.attr} · ${k.stamp}`, W - 2 * L - 300), L, y);
    line([['➜ ', '#a6e3a1'], ['open ', '#cdd6f4'], [`https://${k.url}`, '#89b4fa'], ['  █', '#cdd6f4']], 22);
    wordmark(ctx, W - L, y + 4, 30, { align: 'right' });
  },
};

/* 15 ─ Comic burst */
const comic: Design = {
  id: 'comic', name: 'Comic burst', kinds: ['flip', 'race', 'stat', 'promo'], size: SQ,
  draw(k) {
    const { ctx, W, H, d } = k;
    ctx.fillStyle = '#ffe14d'; ctx.fillRect(0, 0, W, H);
    // rays
    ctx.save(); ctx.translate(W / 2, H * 0.42);
    for (let i = 0; i < 24; i++) { ctx.rotate(Math.PI / 12); ctx.fillStyle = i % 2 ? '#ffd000' : '#ffe96e'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(1400, -120); ctx.lineTo(1400, 120); ctx.fill(); }
    ctx.restore();
    halftone(ctx, 0, 0, W, H, 'rgba(230,60,30,0.35)', 20, 7, 'radial');
    const r = rng(9);
    star(ctx, W / 2, H * 0.42, 16, 430, 300, 0, r);
    ctx.fillStyle = '#000'; ctx.save(); ctx.translate(14, 14); ctx.fill(); ctx.restore();
    star(ctx, W / 2, H * 0.42, 16, 430, 300, 0, rng(9));
    ctx.fillStyle = k.accent === '#c6ff3d' ? '#ff3b1f' : k.accent; ctx.fill(); ctx.lineWidth = 10; ctx.strokeStyle = '#000'; ctx.stroke();
    const word = d.kind === 'flip' ? (/flip/i.test(d.subtitle ?? '') ? 'FLIP!' : 'WATCH!') : d.kind === 'race' ? (/projected/i.test(d.subtitle ?? '') ? 'CALLED!' : 'LIVE!') : d.kind === 'stat' ? (hero(k).value || 'WOW!') : 'POW!';
    ctx.save(); ctx.translate(W / 2, H * 0.42); ctx.rotate(-0.08);
    fit(ctx, word, 560, 220, 'cond', 700);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.lineWidth = 22; ctx.strokeStyle = '#000'; ctx.strokeText(word, 0, 0);
    ctx.fillStyle = '#fff'; ctx.fillText(word, 0, 0);
    ctx.restore();
    // caption box
    ctx.save(); ctx.translate(60, 40); ctx.rotate(-0.02);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 520, 80); ctx.lineWidth = 6; ctx.strokeStyle = '#000'; ctx.strokeRect(0, 0, 520, 80);
    capsFit(ctx, k.kicker, 470, 24, 54, font('cond', 36, 700), '#000', 0.06); ctx.restore();
    // bottom panel
    const py = H * 0.78;
    ctx.fillStyle = '#fff'; ctx.fillRect(40, py - 30, W - 80, H - py - 10); ctx.lineWidth = 8; ctx.strokeStyle = '#000'; ctx.strokeRect(40, py - 30, W - 80, H - py - 10);
    headline(k, d.title.toUpperCase(), 70, py + 40, W - 140, 64, 'cond', '#000', 700);
    ctx.font = font('rc', 28, 700); ctx.fillStyle = '#222'; ctx.textAlign = 'left';
    ctx.fillText(ellipsize(ctx, dek(k).toUpperCase(), W - 140), 70, py + 88);
    ctx.font = font('rc', 18, 400); ctx.fillStyle = '#444';
    ctx.fillText(ellipsize(ctx, `${k.attr} · ${k.stamp}`, W - 450), 70, H - 52);
    wordmark(ctx, W - 70, H - 48, 34, { color: '#000', accent: '#ff3b1f', fam: 'cond', align: 'right' });
    text(ctx, k.url, W - 70, py + 88, font('rc', 22, 700), '#ff3b1f', 'right');
  },
};

/* 16 ─ Quote card */
const quoteCard: Design = {
  id: 'quote', name: 'Quote card', kinds: ['quote', 'promo', 'stat', 'au-seat'], size: SQ,
  draw(k) {
    const { ctx, W, H, d } = k;
    ctx.fillStyle = '#faf7f2'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = k.accent === '#c6ff3d' ? '#1b4332' : mix(k.accent, '#000', 0.2); ctx.fillRect(0, 0, 24, H);
    const qc = k.accent === '#c6ff3d' ? '#2d6a4f' : k.accent;
    text(ctx, '“', 80, 380, font('serif', 420, 900), rgba(qc, 0.18));
    const q = d.kind === 'quote' ? d.title : `${d.title}. ${d.subtitle ?? ''}`.trim();
    const tb = fitBlock(ctx, q, W - 200, 560, 84, 'serif', 700, 1.18, 7, 34, true);
    ctx.fillStyle = '#16181d'; ctx.textAlign = 'left';
    const top = 200 + (560 - tb.lines.length * tb.lh) / 2;
    const y = drawLines(ctx, tb.lines, 110, top + tb.px, tb.lh);
    ctx.fillStyle = qc; ctx.fillRect(110, y + 20, 80, 6);
    const who = d.kind === 'quote' ? (d.subtitle ?? 'PolTok') : (hero(k).value ? `${hero(k).value} · ${hero(k).label}` : k.kicker);
    capsFit(ctx, who, W - 300, 110, y + 80, font('sans', 26, 800), '#16181d', 0.12);
    ctx.fillStyle = '#e8e1d5'; ctx.fillRect(110, H - 130, W - 220, 2);
    wordmark(ctx, 110, H - 66, 36, { color: '#16181d', accent: qc, fam: 'serif' });
    ctx.font = font('sans', 18, 500); ctx.fillStyle = '#6b6457'; ctx.textAlign = 'right';
    ctx.fillText(ellipsize(ctx, k.attr, W - 500), W - 110, H - 82);
    ctx.fillText(`${k.stamp} · ${k.url}`, W - 110, H - 56);
  },
};

/* 17 ─ Story results */
const storyResults: Design = {
  id: 'story-results', name: 'Story · results', kinds: ['race', 'flip', 'balance', 'au-seat'], size: ST,
  draw(k) {
    const { ctx, W, H, d } = k;
    ctx.fillStyle = '#05070d'; ctx.fillRect(0, 0, W, H);
    // top hero: photo/map on accent
    const hh = 900;
    const g = ctx.createLinearGradient(0, 0, 0, hh); g.addColorStop(0, mix(k.accent, '#05070d', 0.2)); g.addColorStop(1, mix(k.accent, '#05070d', 0.75));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, hh);
    halftone(ctx, 0, 0, W, hh, 'rgba(255,255,255,0.08)', 24, 6, 'y');
    if (d.kind === 'balance') balanceBlock(k, 80, 340, W - 160, 440, { fam: 'display' });
    else if (!k.img && drawMap(ctx, d.mapState, 140, 220, W - 280, 600, { fill: rgba('#ffffff', 0.92), stroke: '#fff', glow: 'rgba(0,0,0,0.4)', base: 'rgba(255,255,255,0.2)' })) { /* map */ }
    else portrait(ctx, k.img, nameOf(k), W / 2 - 260, 260, 520, 520, k.accent, { circle: true, ring: 10 });
    const fade = ctx.createLinearGradient(0, hh - 300, 0, hh); fade.addColorStop(0, 'rgba(5,7,13,0)'); fade.addColorStop(1, '#05070d');
    ctx.fillStyle = fade; ctx.fillRect(0, hh - 300, W, 300);
    wordmark(ctx, 80, 150, 56);
    tag(k, k.kicker, 80, 190, 24, 'rgba(0,0,0,0.45)', '#fff');
    const tb = fitBlock(ctx, d.title, W - 160, 280, 130, 'display', 700, 1.0, 2, 40);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
    let y = drawLines(ctx, tb.lines, 80, hh + tb.px * 0.6, tb.lh);
    ctx.font = font('sans', 36, 500); ctx.fillStyle = 'rgba(255,255,255,0.7)';
    y = drawLines(ctx, wrap(ctx, dek(k), W - 160, 2), 80, y + 20, 48) + 50;
    if (d.kind !== 'balance') resultList(k, 80, y, W - 160, H - y - 260, { fam: 'sans', valueFam: 'display', radius: 10, maxRows: 4 });
    else { ctx.font = font('sans', 34, 500); ctx.fillStyle = 'rgba(255,255,255,0.75)'; drawLines(ctx, wrap(ctx, 'Follow every race call and the fight for control live.', W - 160, 3), 80, y + 20, 48); }
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(80, H - 210, W - 160, 2);
    ctx.font = font('sans', 26, 500); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.textAlign = 'left';
    ctx.fillText(ellipsize(ctx, k.attr, W - 160), 80, H - 150); ctx.fillText(k.stamp, 80, H - 110);
    text(ctx, k.url, W - 80, H - 130, font('display', 34, 700), '#c6ff3d', 'right');
  },
};

/* 18 ─ Minimal mono */
const minimal: Design = {
  id: 'minimal', name: 'Minimal mono', kinds: ALL, size: X,
  draw(k) {
    const { ctx, W, H, d } = k;
    ctx.fillStyle = '#fafafa'; ctx.fillRect(0, 0, W, H);
    const P = 72;
    caps(ctx, k.kicker, P, 100, font('mono', 18, 700), '#777', 0.2);
    ctx.fillStyle = k.accent === '#c6ff3d' ? '#111' : k.accent; ctx.beginPath(); ctx.arc(W - P - 8, 94, 8, 0, Math.PI * 2); ctx.fill();
    const tb = fitBlock(ctx, d.kind === 'quote' ? `“${d.title}”` : d.title, W * 0.55, 260, 72, 'sans', 600, 1.08, 3, 30);
    ctx.fillStyle = '#111'; ctx.textAlign = 'left';
    let y = drawLines(ctx, tb.lines, P, 170 + tb.px * 0.8, tb.lh);
    ctx.font = font('sans', 22, 400); ctx.fillStyle = '#666';
    y = drawLines(ctx, wrap(ctx, dek(k), W * 0.5, 3), P, y + 16, 32);
    const rx = W * 0.64, rw = W - rx - P;
    ctx.fillStyle = '#e5e5e5'; ctx.fillRect(rx - 40, 80, 1, H - 200);
    const rows = rowsOf(k, 4);
    rows.forEach((r, i) => {
      const ry = 130 + i * 100;
      capsFit(ctx, r.label, rw, rx, ry, font('mono', 14, 700), '#888', 0.12);
      headline(k, r.value, rx, ry + 54, rw * 0.5, 48, 'sans', '#111', 300);
      ctx.fillStyle = '#eee'; ctx.fillRect(rx + rw * 0.55, ry + 38, rw * 0.45, 4);
      ctx.fillStyle = r.color; ctx.fillRect(rx + rw * 0.55, ry + 38, (rw * 0.45 * Math.min(r.num, 100)) / 100, 4);
    });
    if (!rows.length) { ctx.font = font('sans', 22, 400); ctx.fillStyle = '#666'; drawLines(ctx, wrap(ctx, `— ${d.subtitle ?? 'PolTok'}`, rw, 4), rx, 160, 32); }
    ctx.fillStyle = '#111'; ctx.fillRect(P, H - 96, W - 2 * P, 1);
    wordmark(ctx, P, H - 46, 26, { color: '#111', accent: '#111', fam: 'sans' });
    ctx.font = font('mono', 15, 400); ctx.fillStyle = '#777'; ctx.textAlign = 'right';
    ctx.fillText(ellipsize(ctx, `${k.attr} · ${k.stamp} · ${k.url}`, W - 2 * P - 200), W - P, H - 52);
  },
};

/* 19 ─ Ballot paper */
const ballot: Design = {
  id: 'ballot', name: 'Ballot paper', kinds: ['race', 'flip', 'au-seat'], size: PT,
  draw(k) {
    const { ctx, W, H, d } = k;
    ctx.fillStyle = '#d9d4c7'; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 14;
    ctx.translate(W / 2, H / 2); ctx.rotate(-0.012); ctx.translate(-W / 2, -H / 2);
    ctx.fillStyle = '#fffef9'; ctx.fillRect(70, 60, W - 140, H - 200); ctx.restore();
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(-0.012); ctx.translate(-W / 2, -H / 2);
    const L = 120, R = W - 120;
    ctx.fillStyle = '#111'; ctx.fillRect(L, 110, R - L, 70);
    caps(ctx, d.kind === 'au-seat' ? 'House of Representatives ballot' : 'Official ballot', W / 2, 158, font('rc', 32, 900), '#fff', 0.16, 'center');
    headline(k, d.title.toUpperCase(), W / 2, 260, R - L, 64, 'rc', '#111', 900, 'center');
    ctx.font = font('text', 24, 400, true); ctx.fillStyle = '#444'; ctx.textAlign = 'center';
    ctx.fillText(ellipsize(ctx, dek(k), R - L), W / 2, 306);
    ctx.fillStyle = '#111'; ctx.fillRect(L, 340, R - L, 3);
    caps(ctx, 'Vote for one', L, 386, font('rc', 22, 700), '#111', 0.14);
    const rows = rowsOf(k, 4);
    const winnerIdx = /projected|held/i.test(d.subtitle ?? '') || d.kind === 'au-seat' ? 0 : -1;
    rows.forEach((r, i) => {
      const y = 420 + i * (rows.length <= 2 ? 220 : 140);
      ctx.strokeStyle = '#111'; ctx.lineWidth = 4; ctx.strokeRect(L, y, 80, 80);
      if (i === winnerIdx) { ctx.strokeStyle = '#1a3fbf'; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(L + 12, y + 12); ctx.lineTo(L + 68, y + 68); ctx.moveTo(L + 68, y + 12); ctx.lineTo(L + 12, y + 68); ctx.stroke(); }
      headline(k, r.label.toUpperCase(), L + 120, y + 44, R - L - 340, 40, 'rc', '#111', 700);
      ctx.fillStyle = r.color; ctx.fillRect(L + 120, y + 60, 60, 10);
      text(ctx, r.value, R, y + 56, font('rc', 52, 900), '#111', 'right');
      ctx.fillStyle = '#ccc'; ctx.fillRect(L, y + 112, R - L, 1);
    });
    ctx.restore();
    footerLine(k, 80, H - 80, W - 160, 20, '#333', '#111', 'rc');
    wordmark(ctx, 80, H - 30, 30, { color: '#111', accent: '#1a3fbf', fam: 'rc' });
  },
};

/* 20 ─ Hemicycle */
const hemicycle: Design = {
  id: 'hemicycle', name: 'Hemicycle', kinds: ['balance'], size: X,
  draw(k) {
    const { ctx, W, H, d } = k;
    ctx.fillStyle = '#0c0f1a'; ctx.fillRect(0, 0, W, H);
    blob(ctx, W / 2, H, 700, k.accent, 0.18);
    const bars = d.bars ?? [];
    const total = Math.round(bars.reduce((a, b) => a + b.value, 0)) || 100;
    const rowsN = total > 200 ? 12 : 6;
    const cx = W / 2, cy = 520, rIn = 160, rOut = 430;
    // build seat positions
    const seats: { x: number; y: number; a: number }[] = [];
    const radii = Array.from({ length: rowsN }, (_, i) => rIn + ((rOut - rIn) * i) / (rowsN - 1));
    const len = radii.reduce((a, r) => a + r, 0);
    radii.forEach((r, i) => { const n = i === rowsN - 1 ? total - seats.length : Math.round((total * r) / len); for (let j = 0; j < n; j++) { const a = Math.PI - (Math.PI * (j + 0.5)) / n; seats.push({ x: cx + r * Math.cos(a), y: cy - r * Math.sin(a), a }); } });
    seats.sort((p, q) => q.a - p.a);
    const colors: string[] = []; bars.forEach((b) => { for (let i = 0; i < Math.round(b.value); i++) colors.push(b.color); });
    const dot = Math.min(((rOut - rIn) / rowsN) * 0.42, 14);
    seats.forEach((s, i) => { ctx.fillStyle = colors[i] ?? '#2a3044'; ctx.beginPath(); ctx.arc(s.x, s.y, dot, 0, Math.PI * 2); ctx.fill(); });
    const st = d.stats ?? [];
    text(ctx, st[0]?.value ?? '', cx - 26, cy - 24, font('display', 76, 700), st[0]?.color ?? '#3d7bff', 'right');
    text(ctx, st[1]?.value ?? '', cx + 26, cy - 24, font('display', 76, 700), st[1]?.color ?? '#ff3d55', 'left');
    text(ctx, '–', cx, cy - 30, font('display', 60, 700), '#556', 'center');
    caps(ctx, st[3] ? `${st[3].value} for control · ${st[2]?.value ?? 0} undecided` : '', cx, cy + 10, font('sans', 20, 700), 'rgba(255,255,255,0.7)', 0.1, 'center');
    wordmark(ctx, 60, 80, 36);
    caps(ctx, k.kicker, W - 60, 74, font('sans', 20, 800), '#c6ff3d', 0.14, 'right');
    headline(k, d.title, W / 2, H - 92, W - 120, 48, 'display', '#fff', 700, 'center');
    ctx.font = font('sans', 20, 500); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.textAlign = 'center'; ctx.fillText(ellipsize(ctx, dek(k), W - 200), W / 2, H - 58);
    ctx.font = font('sans', 16, 500); ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillText(`${k.attr} · ${k.stamp} · ${k.url}`, W / 2, H - 24);
  },
};

export const DESIGNS_B: Design[] = [crt, cutout, aurora, terminal, comic, quoteCard, storyResults, minimal, ballot, hemicycle];
void [PT, glass, stackBar, ink, vignette, footerLine, nameOf];
