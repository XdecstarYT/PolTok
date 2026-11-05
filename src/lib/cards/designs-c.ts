import { ALL, X, SQ, PT, ST, type Design, hero, resultList, balanceBlock, tag, headline, glass } from './common';
import { blob, caps, capsFit, dek, drawLines, drawMap, drawAuHex, fitBlock, font, footerLine, grain, halftone, ink, mix, nameOf, portrait, rgba, rr, stackBar, text, vignette, wordmark, wrap, ellipsize, fit, rowsOf, inkOn } from './kit';

/* 21 ─ Swing dial */
const dial: Design = {
  id: 'dial', name: 'Swing dial', kinds: ['au-seat', 'race', 'flip'], size: SQ,
  draw(k) {
    const { ctx, W, H, d } = k;
    ctx.fillStyle = '#10131c'; ctx.fillRect(0, 0, W, H);
    blob(ctx, W / 2, 560, 600, k.accent, 0.2);
    wordmark(ctx, 70, 100, 40);
    caps(ctx, k.kicker, W - 70, 92, font('sans', 22, 800), 'rgba(255,255,255,0.6)', 0.14, 'right');
    const bars = d.bars ?? [];
    const a = bars[0], b = bars[1];
    const tot = (a?.value ?? 50) + (b?.value ?? 50) || 100;
    const share = a ? a.value / tot : 0.5;
    const cx = W / 2, cy = 600, R = 380;
    ctx.lineWidth = 70; ctx.lineCap = 'butt';
    ctx.strokeStyle = b?.color ?? '#555'; ctx.beginPath(); ctx.arc(cx, cy, R, Math.PI, 2 * Math.PI); ctx.stroke();
    ctx.strokeStyle = a?.color ?? '#888'; ctx.beginPath(); ctx.arc(cx, cy, R, Math.PI, Math.PI + Math.PI * share); ctx.stroke();
    for (let i = 0; i <= 20; i++) { const ang = Math.PI + (Math.PI * i) / 20; ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = i % 5 ? 2 : 4; ctx.beginPath(); ctx.moveTo(cx + (R - 50) * Math.cos(ang), cy + (R - 50) * Math.sin(ang)); ctx.lineTo(cx + (R - (i % 5 ? 64 : 76)) * Math.cos(ang), cy + (R - (i % 5 ? 64 : 76)) * Math.sin(ang)); ctx.stroke(); }
    // 50% marker + needle
    ctx.fillStyle = '#fff'; ctx.fillRect(cx - 2, cy - R - 50, 4, 100);
    const na = Math.PI + Math.PI * share;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + (R - 90) * Math.cos(na), cy + (R - 90) * Math.sin(na)); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, 20, 0, Math.PI * 2); ctx.fill();
    const h = hero(k);
    headline(k, d.kind === 'au-seat' ? h.value : a ? `${a.value.toFixed(1)}%` : '—', cx, cy - 90, 340, 110, 'display', '#fff', 700, 'center');
    caps(ctx, d.kind === 'au-seat' ? 'margin' : 'leader share', cx, cy - 50, font('sans', 20, 800), 'rgba(255,255,255,0.6)', 0.14, 'center');
    if (a) headline(k, a.label, cx - R - 35, cy + 70, 360, 30, 'sans', a.color, 800, 'left');
    if (b) headline(k, b.label, cx + R + 35, cy + 70, 360, 30, 'sans', mix(b.color, '#ffffff', 0.2), 800, 'right');
    headline(k, d.title, cx, 800, W - 140, 80, 'display', '#fff', 700, 'center');
    ctx.font = font('sans', 26, 500); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.textAlign = 'center';
    drawLines(ctx, wrap(ctx, dek(k), W - 160, 2), cx, 852, 36);
    footerLine(k, 70, H - 50, W - 140, 20, 'rgba(255,255,255,0.5)', '#c6ff3d');
  },
};

/* 22 ─ Ledger */
const ledger: Design = {
  id: 'ledger', name: 'Ledger sheet', kinds: ['race', 'balance', 'stat', 'au-seat', 'flip'], size: PT,
  draw(k) {
    const { ctx, W, H, d } = k;
    ctx.fillStyle = '#f7f9f4'; ctx.fillRect(0, 0, W, H);
    const RH = 96;
    for (let y = 300, i = 0; y < H - 190; y += RH, i++) { ctx.fillStyle = i % 2 ? '#f7f9f4' : '#eaf2e3'; ctx.fillRect(0, y, W, RH); }
    ctx.fillStyle = '#e57373'; ctx.fillRect(130, 0, 2, H); ctx.fillRect(136, 0, 2, H);
    ctx.fillStyle = '#1f3d2b'; ctx.fillRect(0, 0, W, 240);
    wordmark(ctx, 170, 96, 40, { color: '#f7f9f4', accent: '#a7e07d' });
    caps(ctx, k.kicker, W - 70, 88, font('plex', 22, 700), '#a7e07d', 0.1, 'right');
    headline(k, d.title, 170, 190, W - 240, 76, 'serif', '#fff', 700);
    caps(ctx, 'Entry', 170, 290, font('plex', 20, 700), '#1f3d2b', 0.14);
    caps(ctx, 'Value', W - 70, 290, font('plex', 20, 700), '#1f3d2b', 0.14, 'right');
    const rows = [...(d.stats ?? []).map((s) => ({ label: s.label, value: s.value, color: s.color ?? '#1f3d2b' }))];
    if (d.kind === 'au-seat' && d.bars) d.bars.forEach((b) => rows.push({ label: `2PP · ${b.label}`, value: `${b.value.toFixed(1)}%`, color: b.color }));
    rows.slice(0, 8).forEach((r, i) => {
      const y = 300 + i * RH + 62;
      ctx.fillStyle = r.color; ctx.fillRect(150, y - 32, 10, 40);
      ctx.font = font('text', 40, 400); ctx.fillStyle = '#1b1b1b'; ctx.textAlign = 'left';
      ctx.fillText(ellipsize(ctx, r.label, W - 500), 170, y);
      text(ctx, r.value, W - 70, y, font('plex', 44, 700), '#1b1b1b', 'right');
    });
    const ny = 300 + Math.min(rows.length, 8) * RH + 80;
    ctx.font = font('text', 34, 400, true); ctx.fillStyle = '#3d5a45'; ctx.textAlign = 'left';
    drawLines(ctx, wrap(ctx, `Note: ${dek(k)}`, W - 240, 3), 170, ny, 48);
    ctx.strokeStyle = '#1f3d2b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(170, H - 170); ctx.lineTo(W - 70, H - 170); ctx.stroke(); ctx.beginPath(); ctx.moveTo(170, H - 162); ctx.lineTo(W - 70, H - 162); ctx.stroke();
    footerLine(k, 170, H - 100, W - 240, 20, '#3d5a45', '#1f3d2b', 'plex');
  },
};

/* 23 ─ Magazine cover */
const magazine: Design = {
  id: 'magazine', name: 'Magazine cover', kinds: ALL, size: PT,
  draw(k) {
    const { ctx, W, H, d } = k;
    if (k.img) portrait(ctx, k.img, nameOf(k), 0, 0, W, H, k.accent);
    else {
      const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, mix(k.accent, '#ffffff', 0.15)); g.addColorStop(1, mix(k.accent, '#000000', 0.45));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      halftone(ctx, 0, 0, W, H, 'rgba(0,0,0,0.12)', 14, 4.5, 'radial');
      if (!drawMap(ctx, d.mapState, 120, 300, W - 240, 700, { fill: 'rgba(255,255,255,0.22)', stroke: 'rgba(255,255,255,0.6)', lineWidth: 4, base: 'rgba(255,255,255,0.12)' })) {
        ctx.font = font('serif', 600, 900); ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.textAlign = 'center'; ctx.fillText(d.kind === 'quote' ? '“' : (hero(k).value || '★').slice(0, 3), W / 2, 900);
      }
    }
    const shade = ctx.createLinearGradient(0, H * 0.45, 0, H); shade.addColorStop(0, 'rgba(0,0,0,0)'); shade.addColorStop(1, 'rgba(0,0,0,0.85)');
    ctx.fillStyle = shade; ctx.fillRect(0, 0, W, H);
    // masthead
    fit(ctx, 'POLTOK', W - 100, 300, 'serif', 900);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText('POLTOK', W / 2, 250);
    caps(ctx, `Election special · ${k.stamp}`, W / 2, 300, font('sans', 22, 800), '#fff', 0.2, 'center');
    // coverline left
    ctx.save(); ctx.translate(60, 420); ctx.rotate(-0.05); tag(k, k.kicker, 0, 0, 26, '#ffd400', '#111', 'sans', 2); ctx.restore();
    const tb = fitBlock(ctx, d.kind === 'quote' ? `“${d.title}”` : d.title, W - 120, 320, 120, 'serif', 900, 1.0, 3, 40, d.kind === 'quote');
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
    const y0 = H - 260 - tb.lines.length * tb.lh;
    let y = drawLines(ctx, tb.lines, 60, y0 + tb.px * 0.85, tb.lh);
    ctx.font = font('text', 32, 400, true); ctx.fillStyle = 'rgba(255,255,255,0.88)';
    y = drawLines(ctx, wrap(ctx, dek(k), W - 120, 2), 60, y + 10, 42);
    const h = hero(k);
    if (h.value && d.kind !== 'quote') {
      ctx.save(); ctx.translate(W - 190, 560); ctx.rotate(0.12);
      ctx.fillStyle = '#ffd400'; ctx.beginPath(); ctx.arc(0, 0, 130, 0, Math.PI * 2); ctx.fill();
      headline(k, h.value, 0, 20, 200, 80, 'cond', '#111', 700, 'center');
      capsFit(ctx, h.label, 200, 0, 62, font('sans', 18, 800), '#111', 0.06, 'center'); ctx.restore();
    }
    footerLine(k, 60, H - 60, W - 120, 20, 'rgba(255,255,255,0.75)', '#ffd400');
    ctx.fillStyle = '#fff'; ctx.fillRect(W - 220, H - 160, 160, 70);
    for (let i = 0; i < 30; i++) { ctx.fillStyle = '#111'; ctx.fillRect(W - 210 + i * 5, H - 150, i % 3 ? 2 : 3, 50); }
  },
};

/* 24 ─ Trading card */
const trading: Design = {
  id: 'trading-card', name: 'Trading card', kinds: ['race', 'flip', 'au-seat'], size: PT,
  draw(k) {
    const { ctx, W, H, d } = k;
    ctx.fillStyle = '#14121f'; ctx.fillRect(0, 0, W, H);
    const holo = ctx.createLinearGradient(0, 0, W, H);
    ['#ff6ec7', '#7afcff', '#feff9c', '#a0ff8a', '#c86bff', '#ff6ec7'].forEach((c, i) => holo.addColorStop(i / 5, c));
    rr(ctx, 60, 50, W - 120, H - 170, 40); ctx.fillStyle = holo; ctx.fill();
    rr(ctx, 84, 74, W - 168, H - 218, 28); ctx.fillStyle = mix(k.accent, '#0b0b12', 0.55); ctx.fill();
    // header bar
    headline(k, nameOf(k).toUpperCase(), 120, 150, W - 420, 52, 'cond', '#fff', 700);
    const h = hero(k);
    text(ctx, h.value || '', W - 120, 150, font('cond', 60, 700), '#feff9c', 'right');
    // art window
    rr(ctx, 120, 190, W - 240, 560, 10); ctx.save(); ctx.clip();
    const gg = ctx.createLinearGradient(0, 190, 0, 750); gg.addColorStop(0, mix(k.accent, '#fff', 0.25)); gg.addColorStop(1, mix(k.accent, '#000', 0.35)); ctx.fillStyle = gg; ctx.fillRect(120, 190, W - 240, 560);
    halftone(ctx, 120, 190, W - 240, 560, 'rgba(255,255,255,0.15)', 18, 5);
    if (k.img) portrait(ctx, k.img, nameOf(k), 120, 190, W - 240, 560, k.accent);
    else if (!drawMap(ctx, d.mapState, 170, 220, W - 340, 500, { fill: '#fff', stroke: 'rgba(0,0,0,0.3)', lineWidth: 4, glow: 'rgba(0,0,0,0.4)', base: 'rgba(255,255,255,0.25)' })) portrait(ctx, null, nameOf(k), W / 2 - 200, 270, 400, 400, mix(k.accent, '#000', 0.2), { circle: true });
    ctx.restore();
    ctx.lineWidth = 6; ctx.strokeStyle = '#feff9c'; rr(ctx, 120, 190, W - 240, 560, 10); ctx.stroke();
    // type line
    rr(ctx, 110, 770, W - 220, 60, 30); ctx.fillStyle = '#feff9c'; ctx.fill();
    headline(k, `${d.title} · ${k.kicker}`.toUpperCase(), W / 2, 812, W - 280, 28, 'cond', '#14121f', 700, 'center');
    rr(ctx, 120, 850, W - 240, 300, 10); ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fill();
    ctx.font = font('text', 26, 400, true); ctx.fillStyle = '#222'; ctx.textAlign = 'left';
    drawLines(ctx, wrap(ctx, dek(k), W - 300, 2), 150, 896, 34);
    resultList(k, 150, 960, W - 300, 170, { fam: 'cond', valueFam: 'cond', labelColor: '#222', track: '#ddd', maxRows: 2, upper: true, radius: 3 });
    wordmark(ctx, 90, H - 50, 32);
    ctx.font = font('sans', 16, 500); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.textAlign = 'right';
    ctx.fillText(ellipsize(ctx, `${k.attr} · ${k.stamp} · ${k.url}`, W - 400), W - 90, H - 56);
  },
};

/* 25 ─ Synthwave */
const synth: Design = {
  id: 'synthwave', name: 'Synthwave sunset', kinds: ['promo', 'stat', 'flip', 'race', 'quote'], size: X,
  draw(k) {
    const { ctx, W, H, d } = k;
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.62); sky.addColorStop(0, '#0b0628'); sky.addColorStop(1, '#5a1a6e');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    const hz = H * 0.62;
    // sun
    const sun = ctx.createLinearGradient(0, hz - 260, 0, hz); sun.addColorStop(0, '#ffe066'); sun.addColorStop(1, '#ff2d95');
    ctx.save(); ctx.beginPath(); ctx.arc(W * 0.78, hz, 230, Math.PI, 0); ctx.clip(); ctx.fillStyle = sun; ctx.fillRect(0, 0, W, hz);
    ctx.fillStyle = '#3a1050'; for (let i = 0; i < 7; i++) ctx.fillRect(0, hz - 20 - i * 30, W, 4 + i * 1.2);
    ctx.restore();
    // grid floor
    ctx.fillStyle = '#12021f'; ctx.fillRect(0, hz, W, H - hz);
    ctx.strokeStyle = '#ff2d95'; ctx.lineWidth = 2; ctx.shadowColor = '#ff2d95'; ctx.shadowBlur = 10;
    for (let i = -20; i <= 20; i++) { ctx.beginPath(); ctx.moveTo(W / 2 + i * 30, hz); ctx.lineTo(W / 2 + i * 180, H); ctx.stroke(); }
    for (let j = 0; j < 9; j++) { const y = hz + Math.pow(j / 8, 2) * (H - hz); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.shadowBlur = 0;
    wordmark(ctx, 60, 84, 36, { accent: '#ff2d95' });
    caps(ctx, k.kicker, 60, 150, font('display', 24, 700), '#7afcff', 0.2);
    const tb = fitBlock(ctx, d.kind === 'quote' ? `“${d.title}”` : d.title, W * 0.56, 200, 78, 'display', 700, 1.02, 3, 30, true);
    ctx.save(); ctx.shadowColor = '#7afcff'; ctx.shadowBlur = 16; ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
    const y = drawLines(ctx, tb.lines, 60, 180 + tb.px * 0.85, tb.lh); ctx.restore();
    ctx.font = font('sans', 22, 600); ctx.fillStyle = '#ffd1f0';
    drawLines(ctx, wrap(ctx, dek(k), W * 0.55, 2), 60, y + 12, 30);
    const h = hero(k);
    if (h.value) {
      ctx.save(); ctx.shadowColor = '#ff2d95'; ctx.shadowBlur = 30;
      headline(k, h.value, W * 0.78, hz - 60, 400, 120, 'display', '#fff', 700, 'center', true); ctx.restore();
      capsFit(ctx, h.label, 380, W * 0.78, hz - 20, font('sans', 18, 800), '#fff', 0.1, 'center');
    }
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, H - 60, W, 60);
    footerLine(k, 60, H - 22, W - 120, 18, '#ffd1f0', '#7afcff');
  },
};

/* 26 ─ Blueprint */
const blueprint: Design = {
  id: 'blueprint', name: 'Blueprint', kinds: ALL, size: X,
  draw(k) {
    const { ctx, W, H, d } = k;
    const c = (col: string) => inkOn(k, '#0d3b78', col);
    ctx.fillStyle = '#0d3b78'; ctx.fillRect(0, 0, W, H);
    for (let x = 0; x < W; x += 25) { ctx.fillStyle = x % 125 ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.14)'; ctx.fillRect(x, 0, 1, H); }
    for (let y = 0; y < H; y += 25) { ctx.fillStyle = y % 125 ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.14)'; ctx.fillRect(0, y, W, 1); }
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.strokeRect(30, 30, W - 60, H - 60);
    // title block
    const tbx = W - 490, tby = H - 190;
    ctx.lineWidth = 2; ctx.strokeRect(tbx, tby, 460, 160); ctx.beginPath(); ctx.moveTo(tbx, tby + 50); ctx.lineTo(tbx + 460, tby + 50); ctx.moveTo(tbx + 220, tby + 50); ctx.lineTo(tbx + 220, tby + 160); ctx.stroke();
    wordmark(ctx, tbx + 16, tby + 38, 28, { accent: '#ffd166', fam: 'mono' });
    ctx.font = font('mono', 18, 400); ctx.fillStyle = c('#cfe3ff'); ctx.textAlign = 'left';
    ctx.fillText(ellipsize(ctx, 'DWG: ' + d.kind.toUpperCase(), 196), tbx + 14, tby + 82); ctx.fillText('SCALE 1:1', tbx + 14, tby + 114); ctx.fillText(ellipsize(ctx, k.url, 196), tbx + 14, tby + 146);
    ctx.fillText(ellipsize(ctx, k.stamp, 222), tbx + 232, tby + 82); drawLines(ctx, wrap(ctx, k.attr, 216, 2), tbx + 232, tby + 114, 26);
    // drawing
    if (d.mapState && d.kind !== 'balance') {
      ctx.setLineDash([10, 6]); ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.strokeRect(W - 450, 60, 400, 380); ctx.setLineDash([]);
      drawMap(ctx, d.mapState, W - 430, 80, 360, 340, { fill: 'rgba(255,255,255,0.08)', stroke: '#fff', lineWidth: 3, base: 'rgba(255,255,255,0.12)' });
      caps(ctx, `FIG.1 — ${d.mapState.replace('AU:', '')}`, W - 450, 466, font('mono', 20, 700), c('#cfe3ff'), 0.1);
    }
    caps(ctx, `// ${k.kicker}`, 70, 100, font('mono', 24, 700), c('#ffd166'), 0.1);
    const tw = d.mapState && d.kind !== 'balance' ? W - 600 : W - 140;
    const tb = fitBlock(ctx, d.kind === 'quote' ? `“${d.title}”` : d.title, tw, 170, 72, 'mono', 700, 1.05, 3, 26);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
    let y = drawLines(ctx, tb.lines, 70, 120 + tb.px, tb.lh);
    ctx.font = font('mono', 22, 400); ctx.fillStyle = c('#cfe3ff');
    y = drawLines(ctx, wrap(ctx, dek(k), tw, 2), 70, y + 8, 30) + 20;
    if (d.kind === 'balance') balanceBlock(k, 70, y, W - 140, tby - y - 20, { fam: 'mono', color: '#ffd166', muted: '#cfe3ff', track: 'rgba(255,255,255,0.1)' });
    else resultList(k, 70, y, tw, (d.mapState ? H - 80 : tby - 30) - y, { fam: 'mono', valueFam: 'mono', upper: true, track: 'rgba(255,255,255,0.12)', radius: 0, valueColor: '#fff' });
  },
};

/* 27 ─ Split photo */
const split: Design = {
  id: 'split', name: 'Split portrait', kinds: ['race', 'flip', 'au-seat', 'quote', 'promo'], size: X,
  draw(k) {
    const { ctx, W, H, d } = k;
    const pw = 460;
    ctx.fillStyle = '#f5f3ee'; ctx.fillRect(0, 0, W, H);
    if (k.img) portrait(ctx, k.img, nameOf(k), 0, 0, pw, H, k.accent);
    else {
      ctx.fillStyle = k.accent; ctx.fillRect(0, 0, pw, H);
      halftone(ctx, 0, 0, pw, H, rgba(ink(k.accent) === '#ffffff' ? '#ffffff' : '#000000', 0.16), 16, 5, 'radial');
      if (!drawMap(ctx, d.mapState, 40, 120, pw - 80, H - 240, { fill: ink(k.accent), stroke: ink(k.accent), base: rgba(ink(k.accent), 0.25) }))
        portrait(ctx, null, d.kind === 'quote' ? (d.subtitle ?? 'PolTok') : nameOf(k), pw / 2 - 150, H / 2 - 150, 300, 300, mix(k.accent, '#000', 0.25), { circle: true });
    }
    ctx.fillStyle = k.accent; ctx.fillRect(pw, 0, 12, H);
    const x = pw + 70, w = W - x - 60;
    caps(ctx, k.kicker, x, 90, font('sans', 20, 800), mix(k.accent, '#000', 0.3), 0.16);
    const tb = fitBlock(ctx, d.kind === 'quote' ? `“${d.title}”` : d.title, w, 230, 76, 'serif', 900, 1.05, 4, 28, d.kind === 'quote');
    ctx.fillStyle = '#14161c'; ctx.textAlign = 'left';
    let y = drawLines(ctx, tb.lines, x, 110 + tb.px, tb.lh);
    ctx.font = font('text', 24, 400); ctx.fillStyle = '#555';
    y = drawLines(ctx, wrap(ctx, dek(k), w, 2), x, y + 10, 32) + 20;
    if (d.kind !== 'quote') resultList(k, x, y, w, H - y - 110, { fam: 'sans', valueFam: 'serif', labelColor: '#14161c', track: '#e2ded5', radius: 4, maxRows: 3 });
    ctx.fillStyle = '#ddd'; ctx.fillRect(x, H - 92, w, 1);
    wordmark(ctx, x, H - 44, 28, { color: '#14161c', accent: mix(k.accent, '#000', 0.2) });
    ctx.font = font('sans', 15, 500); ctx.fillStyle = '#777'; ctx.textAlign = 'right';
    ctx.fillText(ellipsize(ctx, `${k.attr} · ${k.stamp} · ${k.url}`, w - 180), W - 60, H - 50);
  },
};

/* 28 ─ Story poster */
const storyPoster: Design = {
  id: 'story-poster', name: 'Story · poster', kinds: ['promo', 'stat', 'balance', 'quote', 'race', 'flip'], size: ST,
  draw(k) {
    const { ctx, W, H, d } = k;
    ctx.fillStyle = '#0b0d14'; ctx.fillRect(0, 0, W, H);
    const acc = k.accent;
    ctx.fillStyle = acc; ctx.fillRect(0, 0, W, 760);
    const fg = inkOn(k, acc);
    const big = d.kind === 'quote' ? '“' : (hero(k).value || 'LIVE');
    fit(ctx, big, W - 120, 520, 'cond', 700, 80);
    ctx.fillStyle = fg; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(big, 50, 700);
    capsFit(ctx, d.kind === 'quote' ? 'Quote' : hero(k).label || k.kicker, W - 140, 70, 120, font('cond', 44, 700), fg, 0.1);
    wordmark(ctx, W - 70, 120, 48, { color: fg, accent: fg === '#ffffff' ? '#0b0d14' : '#0b0d14', fam: 'cond', align: 'right' });
    const tb = fitBlock(ctx, d.title.toUpperCase(), W - 140, 520, 150, 'cond', 700, 0.98, 5, 40);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
    let y = drawLines(ctx, tb.lines, 70, 840 + tb.px * 0.85, tb.lh);
    ctx.font = font('sans', 38, 500); ctx.fillStyle = 'rgba(255,255,255,0.72)';
    y = drawLines(ctx, wrap(ctx, dek(k), W - 140, 3), 70, y + 30, 50) + 40;
    if (d.kind === 'balance') balanceBlock(k, 70, y, W - 140, Math.min(380, H - y - 300), { fam: 'cond' });
    else if (d.kind !== 'quote') resultList(k, 70, y, W - 140, Math.min(H - y - 300, 520), { fam: 'cond', valueFam: 'cond', upper: true, maxRows: 4, radius: 0 });
    rr(ctx, 70, H - 230, W - 140, 110, 55); ctx.fillStyle = acc; ctx.fill();
    text(ctx, `${k.url} →`, W / 2, H - 160, font('cond', 48, 700), fg, 'center');
    ctx.font = font('sans', 24, 500); ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.textAlign = 'center';
    ctx.fillText(ellipsize(ctx, `${k.attr} · ${k.stamp}`, W - 140), W / 2, H - 60);
  },
};

/* 29 ─ AU hex map */
const auHex: Design = {
  id: 'au-hex', name: 'Hex cartogram', kinds: ['au-seat', 'promo'], size: PT,
  draw(k) {
    const { ctx, W, H, d } = k;
    ctx.fillStyle = '#0e1a14'; ctx.fillRect(0, 0, W, H);
    blob(ctx, W * 0.7, H * 0.35, 700, k.accent, 0.22);
    wordmark(ctx, 70, 110, 44, { accent: '#ffb000' });
    caps(ctx, k.kicker, W - 70, 100, font('sans', 22, 800), '#ffb000', 0.14, 'right');
    const seat = d.mapState?.startsWith('AU:') ? d.mapState.slice(3) : 'kooyong';
    drawAuHex(ctx, seat, 70, 150, W - 140, 640, { fill: k.accent, stroke: '#fff', glow: k.accent, base: 'rgba(255,255,255,0.13)' });
    const tb = fitBlock(ctx, d.title, W - 140, 120, 100, 'display', 700, 1.0, 1, 40);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
    drawLines(ctx, tb.lines, 70, 900, tb.lh);
    ctx.font = font('sans', 28, 500); ctx.fillStyle = 'rgba(255,255,255,0.75)';
    drawLines(ctx, wrap(ctx, dek(k), W - 140, 2), 70, 950, 38);
    const st = (d.stats ?? []).slice(0, 3);
    const cw = (W - 140) / Math.max(1, st.length);
    st.forEach((s, i) => {
      const x = 70 + i * cw;
      rr(ctx, x, 1040, cw - 20, 150, 16); ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fill();
      capsFit(ctx, s.label, cw - 60, x + 24, 1082, font('sans', 18, 800), 'rgba(255,255,255,0.6)', 0.1);
      headline(k, s.value, x + 24, 1160, cw - 70, 60, 'display', s.color ?? '#fff', 700);
    });
    footerLine(k, 70, H - 60, W - 140, 20, 'rgba(255,255,255,0.55)', '#ffb000');
  },
};

/* 30 ─ Breaking story */
const breaking: Design = {
  id: 'breaking', name: 'Breaking news (story)', kinds: ['flip', 'race', 'balance', 'promo', 'quote', 'au-seat'], size: ST,
  draw(k) {
    const { ctx, W, H, d } = k;
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1a0006'); g.addColorStop(0.5, '#0a0a12'); g.addColorStop(1, '#000');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    blob(ctx, W / 2, 500, 900, '#ff0a2c', 0.35);
    // diagonal hazard strip
    ctx.save(); ctx.translate(0, 260); ctx.rotate(-0.06);
    ctx.fillStyle = '#e8112d'; ctx.fillRect(-60, 0, W + 120, 190);
    ctx.fillStyle = '#fff'; ctx.fillRect(-60, 190, W + 120, 70);
    fit(ctx, 'BREAKING', W - 120, 170, 'cond', 700);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText('BREAKING', W / 2, 160);
    capsFit(ctx, k.kicker, W - 120, W / 2, 240, font('cond', 40, 700), '#e8112d', 0.2, 'center');
    ctx.restore();
    wordmark(ctx, W / 2, 160, 60, { align: 'center' });
    let y = 620;
    if (d.kind !== 'balance' && d.kind !== 'quote' && d.kind !== 'promo') {
      if (k.img || !drawMap(ctx, d.mapState, 190, 600, W - 380, 460, { fill: k.accent, stroke: '#fff', lineWidth: 5, glow: k.accent, base: 'rgba(255,255,255,0.14)' })) portrait(ctx, k.img, nameOf(k), W / 2 - 220, 620, 440, 440, k.accent, { circle: true, ring: 10 });
      y = 1130;
    } else y = 680;
    const tb = fitBlock(ctx, (d.kind === 'quote' ? `“${d.title}”` : d.title).toUpperCase(), W - 140, d.kind === 'quote' || d.kind === 'promo' ? 600 : 300, 150, 'cond', 700, 1.0, 5, 50);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    y = drawLines(ctx, tb.lines, W / 2, y + tb.px * 0.85, tb.lh);
    ctx.font = font('rc', 40, 700); ctx.fillStyle = '#ffccd3';
    y = drawLines(ctx, wrap(ctx, dek(k).toUpperCase(), W - 160, 3), W / 2, y + 20, 52) + 40;
    if (d.kind === 'balance') balanceBlock(k, 80, y, W - 160, 420, { fam: 'cond' });
    else if (d.kind !== 'quote' && d.kind !== 'promo') resultList(k, 80, y, W - 160, Math.min(H - y - 260, 380), { fam: 'cond', valueFam: 'cond', upper: true, maxRows: 3, radius: 0 });
    else if (d.kind === 'quote') text(ctx, `— ${d.subtitle ?? 'PolTok'}`, W / 2, y + 30, font('cond', 50, 700), '#fff', 'center');
    ctx.fillStyle = '#e8112d'; ctx.fillRect(0, H - 200, W, 200);
    text(ctx, k.url.toUpperCase(), W / 2, H - 112, font('cond', 56, 700), '#fff', 'center');
    ctx.font = font('rc', 24, 400); ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.textAlign = 'center';
    ctx.fillText(ellipsize(ctx, `${k.attr} · ${k.stamp}`, W - 120), W / 2, H - 58);
  },
};

export const DESIGNS_C: Design[] = [dial, ledger, magazine, trading, synth, blueprint, split, storyPoster, auHex, breaking];
void [SQ, glass, stackBar, vignette, grain, rowsOf, ST];
