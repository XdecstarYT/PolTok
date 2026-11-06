// Creative Director client: POST /api/ai mode 'director', Brand Kit + learned preferences (local),
// shared 429 cooldown (countdown) so calls stay sequential on the Groq free tier.
import { DEFAULT_BRAND, editDelta, mergePrefs, sanitizeBrand, type BrandKit, type DirectorTask, type Pref } from '../../../../shared/director.js';
import { CARD_DESIGNS } from '../../../lib/cards';
import { displayTZ } from '../../../components/time';
import { loadSettings, StudioError } from '../aiStudioApi';

const BKEY = 'poltok.owner.brandKit.v1';
const PKEY = 'poltok.owner.editPrefs.v1';
const get = <T,>(k: string, d: T): T => { try { const r = localStorage.getItem(k); return r ? (JSON.parse(r) as T) : d; } catch { return d; } };
const put = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };

export const loadBrand = (): BrandKit => sanitizeBrand(get(BKEY, DEFAULT_BRAND));
export const saveBrand = (b: BrandKit) => put(BKEY, sanitizeBrand(b));
export const loadPrefs = (): Pref[] => { const p = get<Pref[]>(PKEY, []); return Array.isArray(p) ? p : []; };
export const savePrefs = (p: Pref[]) => put(PKEY, p);
/** "Learn from my edits": store the delta between AI output and the owner's edit. Returns new notes. */
export function learnEdit(before: string, after: string): string[] {
  const notes = editDelta(before, after);
  if (notes.length) savePrefs(mergePrefs(loadPrefs(), notes));
  return notes;
}

export const DESIGNS_ALL = CARD_DESIGNS.map((d) => ({ id: d.id, name: d.name, kinds: d.kinds as string[], w: d.size.w, h: d.size.h }));

/* ---- shared cooldown after a 429 ---- */
let until = 0;
const subs = new Set<() => void>();
export const cooldown = () => Math.max(0, Math.ceil((until - Date.now()) / 1000));
export function onCooldown(f: () => void) { subs.add(f); return () => void subs.delete(f); }
setInterval(() => { if (until && subs.size) subs.forEach((f) => f()); }, 1000);

let inflight = false;
export interface DirectorResp<T> { result: T; model: string; terms?: { term: string; tag: string; count: number }[]; facts?: string }
export async function director<T>(task: DirectorTask, body: Record<string, unknown> & { prompt: string }, signal?: AbortSignal): Promise<DirectorResp<T>> {
  if (cooldown()) throw new StudioError('rate_limited', `Groq free-tier limit — retry in ${cooldown()}s.`, cooldown());
  if (inflight) throw new StudioError('busy', 'Another AI call is running — calls are sequential on the free tier.');
  inflight = true;
  try {
    const { prompt, ...rest } = body;
    let r: Response;
    try {
      r = await fetch('/api/ai', { method: 'POST', headers: { 'content-type': 'application/json' }, signal, body: JSON.stringify({ question: prompt.slice(0, 600), mode: 'director', task, brand: loadBrand(), prefs: loadPrefs().slice(-8), settings: loadSettings(), tz: displayTZ(), ...rest }) });
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e;
      throw new StudioError('unavailable', 'The AI service could not be reached.');
    }
    let d: { ok?: boolean; result?: T; model?: string; terms?: DirectorResp<T>['terms']; facts?: string; error?: string; code?: string; retryAfter?: number } = {};
    try { d = (r.headers.get('content-type') || '').includes('json') ? await r.json() : {}; } catch { /* ignore */ }
    if (!r.ok || !d.ok || !d.result) {
      const ra = Number(d.retryAfter || r.headers.get('retry-after')) || (r.status === 429 ? 30 : 0);
      if (r.status === 429) { until = Date.now() + ra * 1000; subs.forEach((f) => f()); }
      throw new StudioError(d.code ?? (r.status === 429 ? 'rate_limited' : 'upstream'), d.error ?? `AI error (${r.status})`, ra);
    }
    return { result: d.result, model: d.model ?? '', terms: d.terms, facts: d.facts };
  } finally {
    inflight = false;
  }
}
export function errText(e: unknown): string {
  const se = e as StudioError;
  if (se?.code === 'rate_limited') return `Groq free-tier limit — retry in ${se.retryAfter || cooldown() || 30}s.`;
  if (se?.code === 'not_configured') return 'AI is not configured (set GROQ).';
  return se?.message || 'AI unavailable';
}
