/**
 * X Studio queue client: /api/xqueue (Netlify Blobs via owner-authenticated function) with a localStorage
 * mirror as fallback. Offline edits are kept locally and pushed (merge, newest wins) on the next successful load.
 */
import { getToken } from '../auth';
import type { HistoryEntry, QueueMeta, QueueState, XDraft } from './types';

const LKEY = 'poltok.owner.xqueue.v1';
const PKEY = 'poltok.owner.xqueue.pending';
export type QueueMode = 'server' | 'local';

const readLocal = (): QueueState => {
  try {
    const s = JSON.parse(localStorage.getItem(LKEY) || 'null') as QueueState | null;
    return { drafts: s?.drafts ?? [], history: s?.history ?? [], meta: s?.meta ?? {} };
  } catch {
    return { drafts: [], history: [], meta: {} };
  }
};
const writeLocal = (s: QueueState) => {
  try {
    localStorage.setItem(LKEY, JSON.stringify(s));
  } catch {
    /* quota/private mode */
  }
};
const pending = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(PKEY) || '[]') as string[];
  } catch {
    return [];
  }
};
const setPending = (ids: string[]) => {
  try {
    localStorage.setItem(PKEY, JSON.stringify([...new Set(ids)]));
  } catch {
    /* ignore */
  }
};

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch('/api/xqueue' + path, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${getToken() ?? ''}` },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(12000),
  });
  const ct = r.headers.get('content-type') || '';
  if (!ct.includes('json')) throw new Error(`Queue API unavailable (${r.status})`);
  const d = (await r.json()) as T & { error?: string };
  if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
  return d;
}

let state: QueueState = readLocal();
let mode: QueueMode = 'local';
const subs = new Set<(s: QueueState, m: QueueMode) => void>();
const emit = () => {
  writeLocal(state);
  subs.forEach((f) => f(state, mode));
};
export const subscribeQueue = (f: (s: QueueState, m: QueueMode) => void) => {
  subs.add(f);
  return () => void subs.delete(f);
};
export const queueState = () => state;
export const queueMode = () => mode;

export async function loadQueue(): Promise<{ state: QueueState; mode: QueueMode }> {
  try {
    let s = await api<QueueState>('GET', '');
    const ids = pending();
    if (ids.length) {
      const local = readLocal().drafts.filter((d) => ids.includes(d.id));
      if (local.length) {
        const r = await api<{ drafts: XDraft[] }>('POST', '/import', { drafts: local });
        s = { ...s, drafts: r.drafts };
      }
      setPending([]);
    }
    state = { drafts: s.drafts ?? [], history: s.history ?? [], meta: s.meta ?? {} };
    mode = 'server';
  } catch {
    state = readLocal();
    mode = 'local';
  }
  emit();
  return { state, mode };
}

export async function saveDraft(d: XDraft): Promise<XDraft> {
  const next = { ...d, updated: Date.now() };
  state = { ...state, drafts: [next, ...state.drafts.filter((x) => x.id !== d.id)] };
  emit();
  try {
    const r = await api<{ draft: XDraft }>('PUT', `/drafts/${encodeURIComponent(d.id)}`, next);
    state = { ...state, drafts: state.drafts.map((x) => (x.id === d.id ? r.draft : x)) };
    mode = 'server';
    emit();
    return r.draft;
  } catch {
    setPending([...pending(), d.id]);
    mode = 'local';
    emit();
    return next;
  }
}

export async function deleteDraft(id: string) {
  state = { ...state, drafts: state.drafts.filter((x) => x.id !== id) };
  emit();
  setPending(pending().filter((x) => x !== id));
  try {
    await api('DELETE', `/drafts/${encodeURIComponent(id)}`);
  } catch {
    /* local only */
  }
}

export async function markPosted(id: string, postedUrl?: string): Promise<void> {
  const now = Date.now();
  const d = state.drafts.find((x) => x.id === id);
  if (!d) return;
  const draft: XDraft = { ...d, status: 'posted', postedAt: now, updated: now, ...(postedUrl ? { postedUrl } : {}) };
  const entry: HistoryEntry = { id, title: d.title, postedAt: now, url: d.url, postedUrl, posts: d.posts.length };
  const meta: QueueMeta = { ...state.meta, ...(d.source.type === 'update' ? { lastPostedUpdateAt: Math.max(state.meta.lastPostedUpdateAt ?? 0, now) } : {}) };
  state = { drafts: state.drafts.map((x) => (x.id === id ? draft : x)), history: [entry, ...state.history.filter((h) => h.id !== id)], meta };
  emit();
  try {
    const r = await api<{ draft: XDraft; history: HistoryEntry[] }>('POST', `/drafts/${encodeURIComponent(id)}/posted`, { postedUrl });
    state = { ...state, drafts: state.drafts.map((x) => (x.id === id ? r.draft : x)), history: r.history };
    emit();
  } catch {
    setPending([...pending(), id]);
  }
}

export async function saveMeta(meta: QueueMeta) {
  state = { ...state, meta: { ...state.meta, ...meta } };
  emit();
  try {
    await api('PUT', '/meta', meta);
  } catch {
    /* local only */
  }
}

/** Reminders for the panel: scheduled posts due within 2h or overdue, plus fresh auto-drafts. */
export function reminders(s: QueueState, now = Date.now()) {
  const open = s.drafts.filter((d) => d.status !== 'posted');
  return {
    overdue: open.filter((d) => d.scheduledAt && d.scheduledAt < now).sort((a, b) => a.scheduledAt! - b.scheduledAt!),
    soon: open.filter((d) => d.scheduledAt && d.scheduledAt >= now && d.scheduledAt - now < 2 * 3600e3).sort((a, b) => a.scheduledAt! - b.scheduledAt!),
    autoDrafts: open.filter((d) => d.auto && d.status === 'draft'),
  };
}
