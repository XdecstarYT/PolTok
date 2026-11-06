/** Video (MediaRecorder) and GIF export of any frame renderer `(ctx, tSeconds) => void`. */
import { encodeGif } from './gif';

export type FrameFn = (c: CanvasRenderingContext2D, t: number) => void;
export interface ExportOpts { width: number; height: number; duration: number; fps?: number; onProgress?: (f: number) => void; signal?: AbortSignal }

const MIME_PREFS = ['video/mp4;codecs=avc1.42E01F', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
export function pickVideoMime(prefer: 'mp4' | 'webm' | 'auto' = 'auto'): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  const list = prefer === 'webm' ? MIME_PREFS.filter((m) => m.startsWith('video/webm')) : MIME_PREFS;
  return list.find((m) => { try { return MediaRecorder.isTypeSupported(m); } catch { return false; } }) ?? null;
}
export const videoExt = (mime: string) => (mime.startsWith('video/mp4') ? 'mp4' : 'webm');

/** Real-time capture at `fps` (canvas.captureStream(0) + requestFrame). Optional user audio file, OFF by default. */
export async function exportVideo(render: FrameFn, o: ExportOpts & { audio?: Blob | null; prefer?: 'mp4' | 'webm' | 'auto'; volume?: number }): Promise<{ blob: Blob; mime: string }> {
  const mime = pickVideoMime(o.prefer);
  if (!mime) throw new Error('This browser cannot record video (MediaRecorder unavailable).');
  const fps = o.fps ?? 30;
  const cv = document.createElement('canvas');
  cv.width = o.width; cv.height = o.height;
  const ctx = cv.getContext('2d')!;
  render(ctx, 0);
  const stream = cv.captureStream(0);
  const track = stream.getVideoTracks()[0] as MediaStreamTrack & { requestFrame?: () => void };
  let actx: AudioContext | null = null;
  let src: AudioBufferSourceNode | null = null;
  if (o.audio) {
    actx = new AudioContext();
    const buf = await actx.decodeAudioData(await o.audio.arrayBuffer());
    src = actx.createBufferSource(); src.buffer = buf; src.loop = true;
    const gain = actx.createGain();
    const v = o.volume ?? 0.8;
    gain.gain.setValueAtTime(0, actx.currentTime);
    gain.gain.linearRampToValueAtTime(v, actx.currentTime + 0.4);
    gain.gain.setValueAtTime(v, actx.currentTime + Math.max(0.5, o.duration - 1));
    gain.gain.linearRampToValueAtTime(0, actx.currentTime + o.duration);
    const dest = actx.createMediaStreamDestination();
    src.connect(gain).connect(dest);
    dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
  }
  const px = o.width * o.height;
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: Math.round(Math.min(12e6, Math.max(3e6, px * fps * 0.12))) });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const done = new Promise<void>((res, rej) => { rec.onstop = () => res(); rec.onerror = (e) => rej((e as unknown as { error?: Error }).error ?? new Error('recorder error')); });
  const total = Math.max(1, Math.round(o.duration * fps));
  rec.start(500);
  src?.start();
  const t0 = performance.now();
  try {
    for (let i = 0; i <= total; i++) {
      if (o.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const due = t0 + (i * 1000) / fps;
      const wait = due - performance.now();
      if (wait > 1) await new Promise((r) => setTimeout(r, wait));
      render(ctx, Math.min(o.duration, i / fps));
      track.requestFrame?.();
      o.onProgress?.(i / total);
    }
    await new Promise((r) => setTimeout(r, 120));
  } finally {
    if (rec.state !== 'inactive') rec.stop();
    src?.stop();
    stream.getTracks().forEach((t) => t.stop());
    void actx?.close();
  }
  await done;
  return { blob: new Blob(chunks, { type: mime.split(';')[0] }), mime };
}

/** Animated GIF of a short loop (downscaled; default 15 fps, ≤ 540 px long side). */
export async function exportGif(render: FrameFn, o: ExportOpts & { maxSide?: number }): Promise<Blob> {
  const fps = o.fps ?? 15;
  const sc = Math.min(1, (o.maxSide ?? 540) / Math.max(o.width, o.height));
  const w = Math.max(2, Math.round(o.width * sc)), h = Math.max(2, Math.round(o.height * sc));
  const big = document.createElement('canvas'); big.width = o.width; big.height = o.height;
  const small = document.createElement('canvas'); small.width = w; small.height = h;
  const bc = big.getContext('2d')!, sctx = small.getContext('2d', { willReadFrequently: true })!;
  const n = Math.max(1, Math.round(o.duration * fps));
  const frames: { rgba: Uint8ClampedArray }[] = [];
  for (let i = 0; i < n; i++) {
    if (o.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    render(bc, i / fps);
    sctx.imageSmoothingQuality = 'high';
    sctx.drawImage(big, 0, 0, w, h);
    frames.push({ rgba: sctx.getImageData(0, 0, w, h).data });
    o.onProgress?.((i / n) * 0.7);
    if (i % 4 === 0) await new Promise((r) => setTimeout(r, 0));
  }
  await new Promise((r) => setTimeout(r, 0));
  const bytes = encodeGif(frames, w, h, { delayCs: Math.round(100 / fps) });
  o.onProgress?.(1);
  return new Blob([bytes], { type: 'image/gif' });
}

/** PNG sequence for review (array of blobs, one per frame). */
export async function renderPngSequence(render: FrameFn, o: ExportOpts): Promise<Blob[]> {
  const fps = o.fps ?? 30, n = Math.max(1, Math.round(o.duration * fps));
  const cv = document.createElement('canvas'); cv.width = o.width; cv.height = o.height;
  const c = cv.getContext('2d')!;
  const out: Blob[] = [];
  for (let i = 0; i < n; i++) {
    render(c, i / fps);
    out.push(await new Promise<Blob>((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('toBlob'))), 'image/png')));
    o.onProgress?.(i / n);
  }
  return out;
}
