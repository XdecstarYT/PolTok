/** Highlight-cover icons on a 24×24 grid, stroked (round caps). Pure SVG path data → canvas + SVG. */
const star = (cx: number, cy: number, r: number) => {
  const p: string[] = [];
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; p.push(`${(cx + Math.cos(a) * rr).toFixed(2)} ${(cy + Math.sin(a) * rr).toFixed(2)}`); }
  return `M${p.join('L')}z`;
};
export const ICONS: Record<string, { stroke?: string; fill?: string }> = {
  live: { stroke: 'M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2', fill: 'M10 12a2 2 0 1 0 4 0a2 2 0 1 0-4 0z' },
  map: { stroke: 'M3 6.5l6-3 6 3 6-3v14l-6 3-6-3-6 3zM9 3.5v14M15 6.5v14' },
  au: { fill: star(12, 4.5, 2.4) + star(5.5, 11, 2.2) + star(18, 10, 2.2) + star(12, 19.5, 2.6) + star(15, 14, 1.2) },
  news: { stroke: 'M4 5h12v14H6a2 2 0 0 1-2-2zM16 9h4v8a2 2 0 0 1-2 2h-2M7 9h6M7 12.5h6M7 16h4' },
  polls: { stroke: 'M5 20v-8M12 20V5M19 20v-5M3 20h18' },
  results: { stroke: 'M4 4h16v16H4zM8 12.5l3 3 5-6.5' },
  ask: { stroke: 'M4 5h16v11H10l-5 4v-4H4zM10 9.2a2 2 0 1 1 3 1.7c-.6.4-1 .8-1 1.4M12 13.8v.1' },
  menu: { stroke: 'M5 7h14M5 12h14M5 17h14' },
};
export function drawIcon(ctx: CanvasRenderingContext2D, id: string, cx: number, cy: number, size: number, color: string) {
  const ic = ICONS[id];
  if (!ic) return;
  const k = size / 24;
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(k, k);
  ctx.strokeStyle = ctx.fillStyle = color;
  ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (ic.stroke) ctx.stroke(new Path2D(ic.stroke));
  if (ic.fill) ctx.fill(new Path2D(ic.fill));
  ctx.restore();
}
export function iconSvg(id: string, color: string, bg?: string, size = 96) {
  const ic = ICONS[id];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6 -6 36 36" width="${size}" height="${size}">${bg ? `<circle cx="12" cy="12" r="18" fill="${bg}"/>` : ''}${ic?.stroke ? `<path d="${ic.stroke}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>` : ''}${ic?.fill ? `<path d="${ic.fill}" fill="${color}"/>` : ''}</svg>`;
}
