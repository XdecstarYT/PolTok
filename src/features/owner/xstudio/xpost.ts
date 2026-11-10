/** Client for /api/xpost (owner-only real posting to X). The X keys live only in server env vars. */
import { getToken } from '../auth';
import type { XDraft } from './types';

export type PublishResult =
  | { kind: 'ok'; urls: string[]; ids: string[]; recorded: boolean; warnings: string[] }
  | { kind: 'not_configured' }
  | { kind: 'already_posted'; postedUrl?: string; postedAt?: number; error: string }
  | { kind: 'error'; error: string; code?: string; retryAfter?: number; partial?: { urls: string[] } };

const auth = () => ({ authorization: `Bearer ${getToken() ?? ''}` });

export async function xpostConfigured(): Promise<boolean | null> {
  try {
    const r = await fetch('/api/xpost', { headers: auth(), cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (!r.ok || !(r.headers.get('content-type') || '').includes('json')) return null;
    return !!((await r.json()) as { configured?: boolean }).configured;
  } catch {
    return null;
  }
}

export async function publishToX(input: { posts: string[]; alt: string; image?: Blob; updateId?: string; draft?: XDraft; force?: boolean }): Promise<PublishResult> {
  const fd = new FormData();
  const { image, ...payload } = input;
  fd.set('payload', JSON.stringify(payload));
  if (image) fd.set('image', image, 'card.png');
  let r: Response;
  try {
    r = await fetch('/api/xpost', { method: 'POST', headers: auth(), body: fd, signal: AbortSignal.timeout(60000) });
  } catch {
    return { kind: 'error', error: 'Network error — could not reach the publish function.' };
  }
  if (!(r.headers.get('content-type') || '').includes('json')) return { kind: 'error', error: `Publish API unavailable (${r.status}).` };
  const d = (await r.json()) as Record<string, unknown>;
  if (d.configured === false) return { kind: 'not_configured' };
  if (r.ok && d.ok) return { kind: 'ok', urls: (d.urls as string[]) ?? [], ids: (d.ids as string[]) ?? [], recorded: !!d.recorded, warnings: (d.warnings as string[]) ?? [] };
  if (d.code === 'already_posted') return { kind: 'already_posted', postedUrl: d.postedUrl as string | undefined, postedAt: d.postedAt as number | undefined, error: String(d.error) };
  return { kind: 'error', error: String(d.error || `HTTP ${r.status}`), code: d.code as string | undefined, retryAfter: d.retryAfter as number | undefined, partial: d.partial as { urls: string[] } | undefined };
}
