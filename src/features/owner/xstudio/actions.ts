/** Rendering + ready-to-post actions (clipboard, download, zip, Web Share, X intent, video clip). Browser only. */
import { renderCardCanvas, type CardStyle } from '../../../lib/cards';
import { HOUSE_PALETTE } from '../brand/logo';
import { makeZip } from '../studio/zip';
import { drawBadge, BADGE_OFF } from './badge';
import { intentParts, xIntentUrl } from './xtext';
import type { XDraft } from './types';

export const X_SIZE = { w: 1200, h: 675 };
export const BRAND_STYLE: CardStyle = {
  palette: { bg: HOUSE_PALETTE.bg, fg: HOUSE_PALETTE.fg, accent: HOUSE_PALETTE.dot, dem: HOUSE_PALETTE.dem, rep: HOUSE_PALETTE.rep },
  fontDisplay: 'Space Grotesk',
  fontBody: 'Inter',
};

export interface Rendered { base: HTMLCanvasElement; canvas: HTMLCanvasElement; blob: Blob; url: string }

/** 1200×675 card for a draft (brand palette optional) + "Follow live" badge overlay. */
export async function renderDraftCard(d: Pick<XDraft, 'designId' | 'card' | 'brand' | 'badge' | 'url'>): Promise<Rendered> {
  const style: CardStyle = { ...(d.brand ? BRAND_STYLE : {}), size: X_SIZE };
  const base = await renderCardCanvas(d.designId, d.card, style);
  const canvas = document.createElement('canvas');
  canvas.width = base.width;
  canvas.height = base.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(base, 0, 0);
  drawBadge(ctx, canvas.width, canvas.height, { ...(d.badge ?? BADGE_OFF), url: d.url });
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/png'));
  return { base, canvas, blob, url: URL.createObjectURL(blob) };
}

export const fileBase = (d: Pick<XDraft, 'title' | 'id'>) =>
  `poltok-x-${d.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || d.id}`;

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export const canCopyImage = () => typeof ClipboardItem !== 'undefined' && !!navigator.clipboard?.write;
export async function copyImage(blob: Blob | Promise<Blob>): Promise<boolean> {
  if (!canCopyImage()) return false;
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return true;
  } catch {
    return false;
  }
}

export function downloadBlob(blob: Blob, name: string) {
  const a = document.createElement('a');
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

const enc = (s: string) => new TextEncoder().encode(s);
/** Zip (store-only, no deps): card PNG, each post, the full thread, alt text. */
export async function zipDraft(d: XDraft, png: Blob): Promise<Blob> {
  const entries = [
    { name: `${fileBase(d)}.png`, data: new Uint8Array(await png.arrayBuffer()) },
    ...d.posts.map((p, i) => ({ name: `post-${i + 1}.txt`, data: enc(p) })),
    { name: 'thread.txt', data: enc(d.posts.join('\n\n---\n\n')) },
    { name: 'alt-text.txt', data: enc(d.alt) },
  ];
  return makeZip(entries);
}
/** Zip several drafts (each in its own folder). */
export async function zipMany(items: { d: XDraft; png: Blob }[]): Promise<Blob> {
  const entries = [];
  for (const { d, png } of items) {
    const dir = fileBase(d) + '/';
    entries.push({ name: dir + 'card.png', data: new Uint8Array(await png.arrayBuffer()) });
    d.posts.forEach((p, i) => entries.push({ name: `${dir}post-${i + 1}.txt`, data: enc(p) }));
    entries.push({ name: dir + 'alt-text.txt', data: enc(d.alt) });
  }
  return makeZip(entries);
}

/** Open X's compose intent for one post (X appends the url itself). Images can't be attached via intents. */
export function openInX(post: string, url?: string) {
  const { text, url: u } = intentParts(post, url);
  window.open(xIntentUrl(text, u), '_blank', 'noopener');
}

export function canShareFiles(): boolean {
  try {
    const f = new File([new Uint8Array([137, 80, 78, 71])], 'x.png', { type: 'image/png' });
    return !!navigator.canShare?.({ files: [f] });
  } catch {
    return false;
  }
}
/** Web Share with the image attached (mobile → X app). */
export async function shareToApp(text: string, png: Blob, name: string): Promise<'shared' | 'cancelled' | 'unsupported'> {
  const file = new File([png], name.endsWith('.png') ? name : name + '.png', { type: 'image/png' });
  if (!navigator.canShare?.({ files: [file] })) return 'unsupported';
  try {
    await navigator.share({ files: [file], text });
    return 'shared';
  } catch {
    return 'cancelled';
  }
}

/** Short looping clip (card + pulsing badge dot) for X video posts. */
export async function exportClip(r: Rendered, d: Pick<XDraft, 'badge' | 'url'>, onProgress?: (f: number) => void) {
  const { exportVideo, videoExt } = await import('../../../lib/motion');
  const badge = d.badge?.on ? d.badge : { ...BADGE_OFF, on: true };
  const frame = (c: CanvasRenderingContext2D, t: number) => {
    c.drawImage(r.base, 0, 0);
    drawBadge(c, r.base.width, r.base.height, { ...badge, url: d.url }, t + 0.001);
  };
  const { blob, mime } = await exportVideo(frame, { width: r.base.width, height: r.base.height, duration: 5, fps: 30, onProgress, prefer: 'mp4' });
  return { blob, ext: videoExt(mime) };
}
