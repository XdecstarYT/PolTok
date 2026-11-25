/** Render a 1080×1350 "My Victoria 2026 prediction" card (PNG) from a model run. Pure canvas, no network. */
import { VIC_NAME, vicColor, type VicModel } from '../vicLive';

const ORDER = ['GRN', 'ALP', 'IND', 'OTH', 'ONP', 'LNP'];

export async function renderShareCard(m: VicModel, mix: Record<string, number>, url: string): Promise<Blob> {
  const W = 1080, H = 1350;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  try { await document.fonts?.ready; } catch { /* ignore */ }
  const F = (w: number, s: number) => `${w} ${s}px "Inter Tight", Inter, system-ui, sans-serif`;
  // background
  g.fillStyle = '#07080d'; g.fillRect(0, 0, W, H);
  const glow = (x: number, y: number, r: number, col: string) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col); gr.addColorStop(1, 'transparent'); g.fillStyle = gr; g.fillRect(0, 0, W, H); };
  glow(120, 80, 700, 'rgba(205,242,90,0.22)'); glow(980, 1300, 760, 'rgba(61,123,255,0.30)'); glow(1000, 200, 500, 'rgba(255,61,85,0.16)');
  // logo
  g.fillStyle = '#3d7bff'; g.beginPath(); g.roundRect(72, 70, 20, 58, 10); g.fill();
  g.fillStyle = '#ff3d55'; g.beginPath(); g.roundRect(100, 86, 20, 58, 10); g.fill();
  g.font = F(900, 52); g.fillStyle = '#fff'; g.fillText('POL', 138, 126); g.fillStyle = '#cdf25a'; g.fillText('TOK', 138 + g.measureText('POL').width, 126);
  g.font = F(700, 26); g.fillStyle = 'rgba(255,255,255,0.65)'; g.textAlign = 'right'; g.fillText('VICTORIA · 28 NOV 2026', W - 72, 116); g.textAlign = 'left';
  // title
  g.font = F(900, 78); g.fillStyle = '#fff'; g.fillText('My prediction', 72, 250);
  const fav: Record<string, number> = {}; for (const s of Object.values(m.seats)) fav[s.fav] = (fav[s.fav] ?? 0) + 1;
  const verdict = m.majority.LNP > 0.5 ? 'Coalition majority' : m.majority.ALP > 0.5 ? 'Labor majority' : 'Hung parliament';
  g.font = F(800, 46); g.fillStyle = '#cdf25a'; g.fillText(verdict, 72, 318);
  // vote mix
  g.font = F(700, 28); let x = 72;
  for (const k of ['LNP', 'ALP', 'ONP', 'GRN']) { const t = `${VIC_NAME[k]} ${mix[k]?.toFixed(1)}%`; g.fillStyle = vicColor(k); g.fillText(t, x, 372); x += g.measureText(t).width + 30; }
  // hemicycle of 88 dots
  const seats = Object.values(m.seats).map((s) => s.fav).sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  const rows = 6, r0 = 0.36, r1 = 0.97, radii = Array.from({ length: rows }, (_, i) => r0 + ((r1 - r0) * i) / (rows - 1));
  const tot = radii.reduce((a, b) => a + b, 0), counts = radii.map((r) => Math.round((88 * r) / tot)); counts[rows - 1] += 88 - counts.reduce((a, b) => a + b, 0);
  const spots: { x: number; y: number; a: number }[] = [];
  radii.forEach((r, ri) => { for (let j = 0; j < counts[ri]; j++) { const a = Math.PI - (Math.PI * (j + 0.5)) / counts[ri]; spots.push({ x: 0.5 + (Math.cos(a) * r) / 2, y: 1 - Math.sin(a) * r, a }); } });
  spots.sort((p, q) => q.a - p.a);
  const cx = 72, cy = 420, cw = W - 144, ch = cw * 0.54, dot = 34;
  spots.forEach((p, i) => {
    const col = vicColor(seats[i] ?? 'OTH');
    g.shadowColor = col; g.shadowBlur = 18; g.fillStyle = col;
    g.beginPath(); g.arc(cx + p.x * cw, cy + p.y * ch, dot / 2, 0, Math.PI * 2); g.fill();
  });
  g.shadowBlur = 0;
  // totals under the arc
  g.textAlign = 'center';
  const ks = ORDER.filter((k) => fav[k]).reverse();
  const colW = cw / ks.length;
  ks.forEach((k, i) => {
    const tx = cx + colW * (i + 0.5);
    g.font = F(900, 96); g.fillStyle = vicColor(k); g.shadowColor = vicColor(k); g.shadowBlur = 30; g.fillText(String(fav[k]), tx, cy + ch + 130); g.shadowBlur = 0;
    g.font = F(700, 28); g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillText(VIC_NAME[k] ?? k, tx, cy + ch + 172);
  });
  g.font = F(700, 26); g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillText('45 seats for a majority', W / 2, cy + ch + 228);
  // footer
  g.fillStyle = '#cdf25a'; g.beginPath(); g.roundRect(W / 2 - 330, H - 150, 660, 78, 39); g.fill();
  g.font = F(800, 30); g.fillStyle = '#0d1200'; g.fillText('Build yours · poltok.netlify.app', W / 2, H - 100);
  g.font = F(500, 20); g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillText('PolTok seat model scenario · not a forecast', W / 2, H - 40);
  g.textAlign = 'left';
  void url;
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('render failed'))), 'image/png'));
}

/** Share via the Web Share API when files are supported, else download. */
export async function shareOrDownload(blob: Blob, name: string, text: string) {
  const file = new File([blob], name, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
  if (nav.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], text }); return 'shared'; } catch { /* cancelled: fall back */ } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return 'downloaded';
}
