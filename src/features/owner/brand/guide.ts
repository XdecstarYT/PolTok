/** Printable single-page brand guide (self-contained HTML; Print → Save as PDF). */
import { SPECS } from '../../../../shared/social.js';
import { contrast, esc, logoSvg, MIN_SIZE, type Brand } from './logo';
import { iconSvg } from './icons';
import { HIGHLIGHT_ICONS, HIGHLIGHT_LABELS } from '../../../../shared/social.js';

export const TYPE_SCALE = [
  { name: 'Display', px: 61, w: 700, fam: 'display' }, { name: 'H1', px: 39, w: 700, fam: 'display' }, { name: 'H2', px: 31, w: 700, fam: 'display' },
  { name: 'H3', px: 25, w: 600, fam: 'display' }, { name: 'Lead', px: 20, w: 400, fam: 'body' }, { name: 'Body', px: 16, w: 400, fam: 'body' },
  { name: 'Small', px: 14, w: 400, fam: 'body' }, { name: 'Caption', px: 12, w: 600, fam: 'body' },
] as const;

export function swatches(b: Brand) {
  const p = b.palette;
  return [
    { k: 'bg', name: 'Void', hex: p.bg, use: 'Backgrounds' }, { k: 'surface', name: 'Panel', hex: p.surface, use: 'Cards, containers' },
    { k: 'fg', name: 'Text', hex: p.fg, use: 'Primary text on dark' }, { k: 'muted', name: 'Muted', hex: p.muted, use: 'Secondary text' },
    { k: 'dem', name: 'D-blue', hex: p.dem, use: 'P bar · Democrats' }, { k: 'rep', name: 'R-red', hex: p.rep, use: 'T bar · Republicans' },
    { k: 'dot', name: 'Live lime', hex: p.dot, use: 'Dot · accent · CTAs' }, { k: 'light', name: 'Paper', hex: p.light, use: 'Light backgrounds' },
  ] as const;
}

/** Every foreground × background pairing with WCAG verdicts. */
export function pairings(b: Brand) {
  const sw = swatches(b);
  const bgs = sw.filter((s) => ['bg', 'surface', 'light', 'dot'].includes(s.k));
  const out: { fg: string; fgName: string; bg: string; bgName: string; ratio: number; grade: string }[] = [];
  for (const bg of bgs) for (const fg of sw) {
    if (fg.k === bg.k) continue;
    const r = contrast(fg.hex, bg.hex);
    out.push({ fg: fg.hex, fgName: fg.name, bg: bg.hex, bgName: bg.name, ratio: r, grade: r >= 7 ? 'AAA' : r >= 4.5 ? 'AA' : r >= 3 ? 'AA large / UI' : 'Fail' });
  }
  return out;
}

export function brandGuideHtml(b: Brand): string {
  const p = b.palette;
  const logos = (['full', 'stacked', 'monogram', 'icon'] as const).map((v) => `<figure><div class="lg">${logoSvg(b, v, 'dark')}</div><figcaption>${v} · min ${MIN_SIZE[v]}</figcaption></figure>`).join('');
  const modes = (['dark', 'light', 'mono-dark', 'mono-light'] as const).map((m) => `<figure><div class="lg">${logoSvg(b, 'full', m)}</div><figcaption>${m}</figcaption></figure>`).join('');
  const sw = swatches(b).map((s) => `<div class="sw"><i style="background:${s.hex}"></i><b>${s.name}</b><code>${s.hex}</code><small>${s.use}</small></div>`).join('');
  const good = pairings(b).filter((x) => x.ratio >= 4.5).sort((a, c) => c.ratio - a.ratio).slice(0, 10)
    .map((x) => `<tr><td><span class="chip" style="background:${x.bg};color:${x.fg}">Aa</span></td><td>${x.fgName} on ${x.bgName}</td><td>${x.ratio.toFixed(1)}:1</td><td>${x.grade}</td></tr>`).join('');
  const type = TYPE_SCALE.map((t) => `<div style="font:${t.w} ${Math.round(t.px * 0.55)}px ${t.fam === 'display' ? 'var(--fd)' : 'var(--fb)'}">${t.name} <small>${t.px}px · ${t.w}</small></div>`).join('');
  const icons = HIGHLIGHT_ICONS.map((i) => `<figure>${iconSvg(i, p.fg, p.surface, 40)}<figcaption>${HIGHLIGHT_LABELS[i]}</figcaption></figure>`).join('');
  const specs = SPECS.map((s) => `<tr><td>${s.platform}</td><td>${esc(s.item)}</td><td>${s.size}</td></tr>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(b.name)} brand guide</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Space+Grotesk:wght@500;700&display=swap">
<style>
:root{--fd:'${b.fontDisplay}','Space Grotesk',system-ui,sans-serif;--fb:'${b.fontBody}',Inter,system-ui,sans-serif}
*{box-sizing:border-box}body{margin:0;background:#fff;color:#111;font:11px/1.35 var(--fb)}
.page{width:210mm;min-height:297mm;padding:10mm;display:grid;grid-template-columns:1fr 1fr;gap:5mm 7mm;align-content:start}
header{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:3mm}
header .lg svg{height:14mm;width:auto}h1{font:700 20px var(--fd);margin:0}h2{font:700 12px var(--fd);margin:0 0 2mm;text-transform:uppercase;letter-spacing:.06em}
section{break-inside:avoid}.row{display:grid;grid-template-columns:repeat(4,1fr);gap:2mm}figure{margin:0;text-align:center}figcaption{font-size:8px;color:#555}
.lg svg{width:100%;height:14mm;display:block;border-radius:2mm}.sw{display:grid;grid-template-columns:8mm 1fr auto;column-gap:2mm;align-items:center;margin-bottom:1mm}
.sw i{grid-row:span 2;width:8mm;height:8mm;border-radius:2mm;border:1px solid #0002}.sw small{grid-column:2/4;color:#555}
table{width:100%;border-collapse:collapse;font-size:9px}td{border-bottom:1px solid #eee;padding:.6mm 1mm}.chip{display:inline-block;padding:0 2mm;border-radius:1mm;font-weight:700}
.cs{position:relative;display:inline-block;padding:4mm;outline:1px dashed #e11;background:repeating-linear-gradient(45deg,#fee 0 3px,#fff 3px 6px)}.cs svg{height:12mm;width:auto;display:block}
ul{margin:0;padding-left:4mm}.full{grid-column:1/-1}
@page{size:A4;margin:0}@media print{.noprint{display:none}}
</style></head><body><div class="page">
<header><div><h1>${esc(b.name)} brand guide</h1><div>${esc(b.tagline)} · v${new Date().toISOString().slice(0, 10)}</div></div><div class="lg">${logoSvg(b, 'full', 'dark', { bg: false })}</div></header>
<section class="full"><h2>Logo lockups</h2><div class="row">${logos}</div></section>
<section class="full"><h2>Colour versions</h2><div class="row">${modes}</div></section>
<section><h2>Clear space &amp; minimum size</h2><div class="cs">${logoSvg(b, 'full', 'light', { pad: 0, bg: false })}</div>
<ul><li>Clear space on every side = ¼ of the mark height (x).</li><li>Never recolour the D-blue / R-red bars or the lime dot (except mono versions).</li><li>Don't stretch, rotate, outline, add shadows or place on busy photos.</li><li>On light backgrounds the lime becomes deep green for contrast.</li></ul></section>
<section><h2>Palette</h2>${sw}</section>
<section><h2>Accessible pairings (WCAG)</h2><table>${good}</table></section>
<section><h2>Type · ${esc(b.fontDisplay)} / ${esc(b.fontBody)} (1.25 scale)</h2>${type}</section>
<section><h2>Highlight icons</h2><div class="row">${icons}</div></section>
<section><h2>Asset sizes (checked ${SPECS[0]?.checked})</h2><table>${specs}</table></section>
</div></body></html>`;
}

export function printGuide(b: Brand) {
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.open(); w.document.write(brandGuideHtml(b)); w.document.close();
  setTimeout(() => { try { w.focus(); w.print(); } catch { /* user can print manually */ } }, 700);
  return true;
}
