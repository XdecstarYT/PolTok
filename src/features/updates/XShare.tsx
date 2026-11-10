/**
 * X actions on an update card. Everyone gets a plain "Share on X" intent link. The signed-in owner also gets
 * "Publish to X" (opens the confirm sheet, which is lazy-loaded so visitors never download it) and a
 * "Posted ✓ View on X" chip once the update is in the X queue history.
 */
import { lazy, Suspense, useEffect, useState } from 'react';
import { useIsOwner } from '../owner/session';
import { SITE, xIntentUrl } from '../owner/xstudio/xtext';
import type { QueueState } from '../owner/xstudio/types';
import type { PostedInfo } from '../owner/xstudio/PublishSheet';
import type { UpdatePost } from './api';

const PublishSheet = lazy(() => import('../owner/xstudio/PublishSheet'));

/* owner-only: X queue state, loaded once per page and shared by every card */
let queueP: Promise<typeof import('../owner/xstudio/queue')> | null = null;
function useQueue(enabled: boolean): QueueState | null {
  const [s, setS] = useState<QueueState | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let unsub = () => {};
    let live = true;
    const first = !queueP;
    queueP ??= import('../owner/xstudio/queue');
    queueP.then((q) => {
      if (!live) return;
      unsub = q.subscribeQueue((st) => setS(st));
      if (first) void q.loadQueue();
      else setS(q.queueState());
    });
    return () => {
      live = false;
      unsub();
    };
  }, [enabled]);
  return s;
}

function postedFor(s: QueueState | null, id: string): PostedInfo | null {
  const d = s?.drafts
    .filter((x) => x.status === 'posted' && x.source.type === 'update' && x.source.ids.includes(id))
    .sort((a, b) => (b.postedAt ?? 0) - (a.postedAt ?? 0))[0];
  return d ? { postedUrl: d.postedUrl, postedAt: d.postedAt } : null;
}

const XLogo = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.9 2H22l-6.8 7.8L23 22h-6.1l-4.8-6.3L6.6 22H3.5l7.3-8.3L1 2h6.3l4.3 5.7zm-1.1 18h1.7L6.3 3.9H4.5z" /></svg>
);

export function XShare({ post }: { post: UpdatePost }) {
  const owner = useIsOwner();
  const queue = useQueue(owner);
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState<PostedInfo | null>(null);
  const posted = local ?? postedFor(queue, post.id);
  const share = xIntentUrl(`${post.title} — new on PolTok`, `${SITE}/updates#${encodeURIComponent(post.id)}`);
  return (
    <div className="up-x">
      <a className="up-x__share" href={share} target="_blank" rel="noopener noreferrer"><XLogo /> Share on X</a>
      {owner && (
        <>
          <button type="button" className="up-x__pub" onClick={() => setOpen(true)} aria-haspopup="dialog"><XLogo /> Publish to X</button>
          {posted && (
            posted.postedUrl
              ? <a className="up-x__done" href={posted.postedUrl} target="_blank" rel="noopener noreferrer">Posted ✓ View on X</a>
              : <span className="up-x__done">Posted ✓</span>
          )}
          {open && (
            <Suspense fallback={null}>
              <PublishSheet post={post} open={open} onClose={() => setOpen(false)} posted={posted} onPosted={setLocal} />
            </Suspense>
          )}
        </>
      )}
    </div>
  );
}
