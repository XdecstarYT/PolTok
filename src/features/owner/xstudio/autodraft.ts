/** Auto-draft: every newly published update gets an X post + card drafted into the queue (never posted). */
import type { UpdatePost } from '../../updates/api';
import { draftForUpdates } from './compose';
import { loadQueue, queueState, saveDraft, saveMeta } from './queue';

/** Draft one update right now (called after "Publish" in the Updates tool). */
export async function autoDraftUpdate(post: UpdatePost) {
  if (post.draft) return null;
  const s = queueState();
  if (s.drafts.some((d) => d.source.type === 'update' && d.source.ids.length === 1 && d.source.ids[0] === post.id)) return null;
  const d = await saveDraft({ ...draftForUpdates([post]), auto: true });
  await saveMeta({ knownUpdateIds: [...(s.meta.knownUpdateIds ?? []), post.id].slice(-500) });
  return d;
}

/**
 * Catch-up when the panel opens: updates published since the last check (e.g. from another device) get drafted.
 * The first run only records what exists, so old release notes are not drafted.
 */
export async function autoDraftNew(posts: UpdatePost[]): Promise<number> {
  const { state } = await loadQueue();
  const published = posts.filter((p) => !p.draft);
  const known = state.meta.knownUpdateIds;
  if (!known) {
    await saveMeta({ knownUpdateIds: published.map((p) => p.id).slice(-500) });
    return 0;
  }
  const fresh = published.filter((p) => !known.includes(p.id) && Date.now() - Date.parse(p.date) < 14 * 864e5);
  let n = 0;
  for (const p of fresh) if (await autoDraftUpdate(p)) n++;
  const unknown = published.filter((p) => !known.includes(p.id)).map((p) => p.id);
  if (unknown.length) await saveMeta({ knownUpdateIds: [...new Set([...known, ...unknown])].slice(-500) });
  return n;
}
