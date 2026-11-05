// AI Studio client: settings persistence, POST /api/ai studio modes, model list, usage meter, drafts board.
import { DEFAULT_SETTINGS, sanitizeSettings, type StudioMode, type StudioSettings } from '../../../shared/compose.js';
import type { Subject } from './cards';

const SKEY = 'poltok.owner.aiSettings.v1';
const DKEY = 'poltok.owner.drafts.v1';

export function loadSettings(): StudioSettings {
  try {
    const raw = localStorage.getItem(SKEY);
    return raw ? sanitizeSettings(JSON.parse(raw)) : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}
export function saveSettings(s: StudioSettings) {
  try {
    localStorage.setItem(SKEY, JSON.stringify(s));
  } catch {
    /* private mode */
  }
}

/* ---------------- usage meter (calls this session) ---------------- */
let calls = 0;
const subs = new Set<(n: number) => void>();
export const usage = () => calls;
export function onUsage(f: (n: number) => void) {
  subs.add(f);
  return () => void subs.delete(f);
}

export class StudioError extends Error {
  constructor(public code: string, msg: string, public retryAfter = 0) {
    super(msg);
  }
}

export interface StudioResponse<T = Record<string, unknown>> { result: T; model: string; facts?: string }

export async function studioAi<T = Record<string, unknown>>(mode: StudioMode, opts: { prompt: string; context?: string; n?: number; settings: StudioSettings; signal?: AbortSignal }): Promise<StudioResponse<T>> {
  calls++;
  subs.forEach((f) => f(calls));
  let r: Response;
  try {
    r = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: opts.prompt.slice(0, 600), mode, n: opts.n, context: opts.context?.slice(0, 1800), settings: opts.settings }),
      signal: opts.signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new StudioError('unavailable', 'The AI service could not be reached.');
  }
  let d: { ok?: boolean; result?: T; model?: string; facts?: string; error?: string; code?: string; retryAfter?: number } = {};
  try {
    d = (r.headers.get('content-type') || '').includes('json') ? await r.json() : {};
  } catch {
    /* ignore */
  }
  if (!r.ok || !d.ok || !d.result) {
    const ra = Number(d.retryAfter || r.headers.get('retry-after')) || (r.status === 429 ? 30 : 0);
    throw new StudioError(d.code ?? (r.status === 429 ? 'rate_limited' : 'upstream'), d.error ?? `AI error (${r.status})`, ra);
  }
  return { result: d.result, model: d.model ?? '', facts: d.facts };
}

export async function fetchModels(): Promise<{ models: string[]; model: string; configured: boolean }> {
  try {
    const d = await (await fetch('/api/ai?models=1')).json();
    return { models: Array.isArray(d.models) ? d.models : [], model: String(d.model ?? ''), configured: !!d.configured };
  } catch {
    return { models: [], model: '', configured: false };
  }
}

/* ---------------- drafts board ---------------- */
export type DraftStatus = 'Draft' | 'Ready' | 'Posted';
export interface StudioDraft { id: string; text: string; status: DraftStatus; subject?: Subject | null; source: string; created: number; checked?: 'ok' | 'issues' }

export function loadDrafts(): StudioDraft[] {
  try {
    const d = JSON.parse(localStorage.getItem(DKEY) || '[]');
    return Array.isArray(d) ? d.filter((x) => x && typeof x.text === 'string').slice(0, 300) : [];
  } catch {
    return [];
  }
}
export function saveDrafts(d: StudioDraft[]) {
  try {
    localStorage.setItem(DKEY, JSON.stringify(d.slice(0, 300)));
  } catch {
    /* ignore */
  }
}
export function draftsCsv(d: StudioDraft[]): string {
  const q = (s: string) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const rows = d.map((x) => [x.status, new Date(x.created).toISOString(), x.source, x.subject ? `${x.subject.kind}:${x.subject.id}` : '', x.checked ?? '', x.text].map(q).join(','));
  return ['status,created,source,subject,factcheck,text', ...rows].join('\n');
}
