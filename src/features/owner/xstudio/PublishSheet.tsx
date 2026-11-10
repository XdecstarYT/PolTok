/**
 * Owner-only "Publish to X" confirm sheet for one update. Text + 1200×675 card (with Follow-live badge, utm_source=x
 * link and alt text) come from X Studio's compose/render path; Publish now posts for real through /api/xpost.
 * When X keys aren't configured it shows the setup steps and the manual path (copy / open in X / share).
 */
import { useEffect, useMemo, useState } from 'react';
import { Button, Sheet } from '../../../components';
import type { UpdatePost } from '../../updates/api';
import { canCopyImage, canShareFiles, copyImage, copyText, fileBase, openInX, renderDraftCard, shareToApp, type Rendered } from './actions';
import { BADGE_LIVE } from './badgeOpts';
import { draftForUpdates } from './compose';
import { loadQueue } from './queue';
import { trimToFit, X_MAX, xLength } from './xtext';
import { publishToX, xpostConfigured } from './xpost';
import './xpost.css';

export interface PostedInfo { postedUrl?: string; postedAt?: number }
const MAX_POSTS = 4;
const COUNTER_RE = /\n*\s*\d+\/\d+\s*$/;
const renumber = (posts: string[]) => {
  const bare = posts.map((p) => p.replace(COUNTER_RE, '').trimEnd());
  if (bare.length < 2) return bare;
  return bare.map((p, i) => {
    const tag = `\n\n${i + 1}/${bare.length}`;
    return `${p.trim() ? trimToFit(p, X_MAX - xLength(tag)) : p}${tag}`;
  });
};
const fmt = (t?: number) => (t ? new Date(t).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '');

function Count({ text }: { text: string }) {
  const n = xLength(text);
  return <span className={`xp-count ${n > X_MAX ? 'is-over' : ''}`} aria-live="polite">{n}/{X_MAX}</span>;
}

export default function PublishSheet({ post, open, onClose, posted, onPosted }: {
  post: UpdatePost; open: boolean; onClose: () => void; posted: PostedInfo | null; onPosted: (p: PostedInfo) => void;
}) {
  const draft = useMemo(() => ({ ...draftForUpdates([post]), badge: { ...BADGE_LIVE } }), [post]);
  const composed = draft.posts;
  const [mode, setMode] = useState<'single' | 'thread'>(composed.length > 1 ? 'thread' : 'single');
  const [single, setSingle] = useState(() => composed[0].replace(' 🧵', '').replace(COUNTER_RE, '').trimEnd());
  const [thread, setThread] = useState(() => renumber(composed.slice(0, MAX_POSTS)));
  const [alt, setAlt] = useState(draft.alt);
  const [r, setR] = useState<Rendered | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [prev, setPrev] = useState<PostedInfo | null>(posted);
  const [again, setAgain] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [done, setDone] = useState<string[] | null>(null);

  useEffect(() => setPrev(posted), [posted]);
  useEffect(() => {
    if (!open) return;
    let live = true;
    xpostConfigured().then((c) => live && setConfigured(c));
    renderDraftCard(draft).then((x) => (live ? setR(x) : URL.revokeObjectURL(x.url))).catch(() => live && setMsg({ ok: false, t: 'Card render failed.' }));
    return () => void (live = false);
  }, [open, draft]);
  useEffect(() => () => { if (r) URL.revokeObjectURL(r.url); }, [r]);

  const posts = mode === 'single' ? [single] : thread;
  const over = posts.some((p) => xLength(p) > X_MAX);
  const empty = posts.some((p) => !p.replace(COUNTER_RE, '').trim());
  const needConfirm = !!prev && !again;
  const canPublish = configured !== false && !busy && !over && !empty && !needConfirm && !!r && !done;
  const all = posts.join('\n\n');

  const publish = async () => {
    if (!r) return;
    setBusy(true);
    setMsg(null);
    const res = await publishToX({ posts, alt, image: r.blob, updateId: post.id, draft: { ...draft, posts, alt }, force: !!prev });
    setBusy(false);
    if (res.kind === 'ok') {
      setDone(res.urls);
      const info = { postedUrl: res.urls[0], postedAt: Date.now() };
      setPrev(info);
      onPosted(info);
      void loadQueue();
      setMsg({ ok: true, t: `Posted to X${res.urls.length > 1 ? ` (${res.urls.length}-post thread)` : ''}.${res.recorded ? ' Added to X queue history.' : ''}${res.warnings.length ? ' ' + res.warnings.join(' ') : ''}` });
    } else if (res.kind === 'not_configured') {
      setConfigured(false);
    } else if (res.kind === 'already_posted') {
      setPrev({ postedUrl: res.postedUrl, postedAt: res.postedAt });
      setAgain(false);
      setMsg({ ok: false, t: res.error + ' Confirm below to post it again.' });
    } else {
      setMsg({ ok: false, t: res.error + (res.partial?.urls.length ? ` ${res.partial.urls.length} post(s) went out before the error.` : '') });
      if (res.partial?.urls.length) setDone(res.partial.urls);
    }
  };

  const say = (ok: boolean, t: string) => setMsg({ ok, t });
  const setPost = (i: number, t: string) => setThread((xs) => xs.map((p, j) => (j === i ? t : p)));

  return (
    <Sheet open={open} onClose={onClose} title="Publish to X">
      <div className="xp">
        <p className="xp-for">Update: <b>{post.title}</b></p>

        {prev && (
          <div className="xp-warn" role="alert">
            <span>Already posted to X{prev.postedAt ? ` on ${fmt(prev.postedAt)}` : ''}.{' '}
              {prev.postedUrl && <a href={prev.postedUrl} target="_blank" rel="noopener noreferrer">View on X</a>}
            </span>
            {!done && (
              <label className="xp-check">
                <input type="checkbox" checked={again} onChange={(e) => setAgain(e.target.checked)} /> Post it again anyway
              </label>
            )}
          </div>
        )}

        <div className="xp-grid">
          <figure className="xp-card">
            {r ? <img src={r.url} alt={alt} width={1200} height={675} /> : <div className="xp-card__ph">Rendering card…</div>}
            <figcaption>1200×675 · Follow-live badge · links to <code>utm_source=x</code></figcaption>
          </figure>

          <div className="xp-text">
            <div className="xp-mode" role="radiogroup" aria-label="Post type">
              {(['single', 'thread'] as const).map((m) => (
                <button key={m} type="button" role="radio" aria-checked={mode === m} className={`xp-mode__b ${mode === m ? 'is-on' : ''}`} onClick={() => setMode(m)}>
                  {m === 'single' ? 'Single post' : `Thread (${thread.length})`}
                </button>
              ))}
            </div>
            {mode === 'single' ? (
              <label className="xp-field">
                <span className="xp-field__h">Post <Count text={single} /></span>
                <textarea rows={7} value={single} onChange={(e) => setSingle(e.target.value)} />
              </label>
            ) : (
              thread.map((p, i) => (
                <label key={i} className="xp-field">
                  <span className="xp-field__h">
                    Post {i + 1}{i === 0 ? ' · with card' : ''} <Count text={p} />
                    {thread.length > 1 && <button type="button" className="xp-x" aria-label={`Remove post ${i + 1}`} onClick={() => setThread((xs) => renumber(xs.filter((_, j) => j !== i)))}>✕</button>}
                  </span>
                  <textarea rows={i === 0 ? 6 : 4} value={p} onChange={(e) => setPost(i, e.target.value)} />
                </label>
              ))
            )}
            {mode === 'thread' && thread.length < MAX_POSTS && (
              <Button size="sm" variant="ghost" onClick={() => setThread((xs) => renumber([...xs, '']))}>+ Add post</Button>
            )}
            <label className="xp-field">
              <span className="xp-field__h">Alt text <span className="xp-count">{alt.length}/1000</span></span>
              <textarea rows={3} maxLength={1000} value={alt} onChange={(e) => setAlt(e.target.value)} />
            </label>
          </div>
        </div>

        {configured === false && (
          <div className="xp-setup">
            <b>Direct posting isn't set up yet.</b> To turn it on:
            <ol>
              <li>Create an app at <a href="https://developer.x.com" target="_blank" rel="noopener noreferrer">developer.x.com</a> with <b>Read and Write</b> permission.</li>
              <li>Generate the <b>Access Token and Secret</b> for your own X account (after setting Read and Write).</li>
              <li>In Netlify → Site configuration → Environment variables, add <code>X_API_KEY</code>, <code>X_API_SECRET</code>, <code>X_ACCESS_TOKEN</code>, <code>X_ACCESS_SECRET</code>.</li>
              <li>Redeploy the site.</li>
            </ol>
            Until then, post it manually with the buttons below.
          </div>
        )}

        {msg && <p className={`xp-msg ${msg.ok ? 'is-ok' : 'is-err'}`} role="status">{msg.t}</p>}
        {done && (
          <p className="xp-done">
            {done.map((u, i) => (
              <a key={u} className="xp-chip" href={u} target="_blank" rel="noopener noreferrer">Posted ✓ View on X{done.length > 1 ? ` (${i + 1})` : ''}</a>
            ))}
          </p>
        )}

        <div className="xp-actions">
          {configured !== false && !done && (
            <Button onClick={publish} disabled={!canPublish} aria-busy={busy}>
              {busy ? 'Publishing…' : configured === null ? 'Publish now' : `Publish now${mode === 'thread' && thread.length > 1 ? ` (${thread.length} posts)` : ''}`}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={async () => { const ok = await copyText(all); say(ok, ok ? 'Text copied.' : 'Copy failed.'); }}>Copy text</Button>
          {canCopyImage() && (
            <Button size="sm" variant="ghost" disabled={!r} onClick={async () => { const ok = r ? await copyImage(r.blob) : false; say(ok, ok ? 'Image copied — paste it into the X composer.' : 'This browser cannot copy images.'); }}>Copy image</Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => openInX(posts[0], draft.url)}>Open in X</Button>
          {canShareFiles() && (
            <Button size="sm" variant="ghost" disabled={!r} onClick={async () => { if (!r) return; const s = await shareToApp(all, r.blob, fileBase(draft)); say(s !== 'unsupported', s === 'shared' ? 'Shared.' : s === 'cancelled' ? 'Share cancelled.' : 'Sharing files is not supported here.'); }}>Share to app</Button>
          )}
        </div>
        {(over || empty) && <p className="xp-msg is-err">{over ? `Each post must be ${X_MAX} characters or fewer.` : 'Posts cannot be empty.'}</p>}
      </div>
    </Sheet>
  );
}
