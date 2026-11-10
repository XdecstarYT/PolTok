/** Editor for one X post / thread: live 280 counter, AI tone rewrite, hashtags, 1200×675 card + badge, alt text, actions. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../../../components';
import { CARD_DESIGNS, designsFor } from '../../../lib/cards';
import { loadSettings, studioAi, StudioError } from '../aiStudioApi';
import { BADGE_LABELS, type BadgeLabel, type Corner, BADGE_OFF } from './badge';
import { canCopyImage, canShareFiles, copyImage, copyText, downloadBlob, exportClip, fileBase, openInX, renderDraftCard, shareToApp, zipDraft, type Rendered } from './actions';
import { assemblePost, hashtagsIn, X_MAX, xLength } from './xtext';
import { fmtBoth, suggestSlots, toLocalInput } from './schedule';
import { markPosted, queueState, saveDraft } from './queue';
import type { XDraft } from './types';

const TONES = [
  { id: 'neutral', label: 'Neutral' },
  { id: 'punchy', label: 'Punchy' },
  { id: 'explainer', label: 'Explainer' },
] as const;
const SUGGESTED_TAGS = ['#PolTok', '#Politics', '#Midterms2026', '#ElectionNight', '#auspol', '#VicVotes', '#nzpol', '#uspolitics'];
const CORNERS: { id: Corner; label: string }[] = [{ id: 'tl', label: '↖' }, { id: 'tr', label: '↗' }, { id: 'bl', label: '↙' }, { id: 'br', label: '↘' }];

export function Counter({ text }: { text: string }) {
  const n = xLength(text);
  return <span className={`ow-count ${n > X_MAX ? 'is-over' : ''}`} aria-live="polite">{n}/{X_MAX}</span>;
}

/** Remove the link + all hashtags from a post body (to re-assemble with a new tag set). */
function stripTail(post: string, url: string) {
  return post.replace(url, '').replace(/(^|\s)#[\p{L}\p{N}_]+/gu, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function PostEditor({ draft, onChange, onClose }: { draft: XDraft; onChange: (d: XDraft) => void; onClose?: () => void }) {
  const [r, setR] = useState<Rendered | null>(null);
  const [rendering, setRendering] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [tone, setTone] = useState<(typeof TONES)[number]['id']>('punchy');
  const [aiBusy, setAiBusy] = useState(false);
  const [busy, setBusy] = useState('');
  const [postedUrl, setPostedUrl] = useState('');
  const set = (p: Partial<XDraft>) => onChange({ ...draft, ...p, updated: Date.now() });
  const say = (ok: boolean, t: string) => setMsg({ ok, t });

  /* ---- live card preview (debounced) ---- */
  const cardKey = JSON.stringify([draft.designId, draft.card, draft.brand, draft.badge, draft.url]);
  const seq = useRef(0);
  useEffect(() => {
    const my = ++seq.current;
    setRendering(true);
    const t = setTimeout(() => {
      renderDraftCard(draft)
        .then((x) => {
          if (my !== seq.current) return URL.revokeObjectURL(x.url);
          setR((old) => {
            if (old) URL.revokeObjectURL(old.url);
            return x;
          });
        })
        .catch(() => my === seq.current && say(false, 'Card render failed.'))
        .finally(() => my === seq.current && setRendering(false));
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardKey]);
  useEffect(() => () => { if (r) URL.revokeObjectURL(r.url); }, [r]);

  const designs = useMemo(() => {
    const own = designsFor(draft.cardKind);
    const base = own.length ? own : CARD_DESIGNS;
    const list = base.some((d) => d.id === draft.designId) ? base : [...CARD_DESIGNS.filter((d) => d.id === draft.designId), ...base];
    // native 1200×675 designs first (others are re-flowed / letterboxed to X size)
    const native = (d: (typeof list)[number]) => d.size.w === 1200 && d.size.h === 675;
    return [...list.filter(native), ...list.filter((d) => !native(d))].map((d) => ({ ...d, name: native(d) ? `${d.name} · native` : `${d.name} · ${d.preview ?? 'reflowed'}` }));
  }, [draft.cardKind, draft.designId]);

  /* ---- posts ---- */
  const setPost = (i: number, t: string) => set({ posts: draft.posts.map((p, j) => (j === i ? t : p)) });
  const addPost = () => set({ posts: [...draft.posts, ''] });
  const removePost = (i: number) => draft.posts.length > 1 && set({ posts: draft.posts.filter((_, j) => j !== i) });
  const renumber = (posts: string[]) => {
    const bare = posts.map((p) => p.replace(/\n*\d+\/\d+\s*$/, '').trimEnd());
    return bare.length < 2 ? bare : bare.map((p, i) => `${p}\n\n${i + 1}/${bare.length}`);
  };
  const over = draft.posts.some((p) => xLength(p) > X_MAX);
  const allText = draft.posts.join('\n\n');

  /* ---- hashtags (live in post 1) ---- */
  const active = new Set(hashtagsIn(draft.posts[0] ?? '').map((t) => t.toLowerCase()));
  const tagPool = [...new Set([...draft.hashtags, ...SUGGESTED_TAGS])];
  const toggleTag = (tag: string) => {
    const now = [...active].map((t) => tagPool.find((x) => x.toLowerCase() === t) ?? t);
    const next = active.has(tag.toLowerCase()) ? now.filter((t) => t.toLowerCase() !== tag.toLowerCase()) : [...now, tag];
    const p0 = draft.posts[0] ?? '';
    const counter = /\n*(\d+\/\d+)\s*$/.exec(p0)?.[1];
    const body = stripTail(p0.replace(/\n*\d+\/\d+\s*$/, ''), draft.url);
    const rebuilt = assemblePost(body, { tags: next, url: p0.includes(draft.url) || draft.posts.length === 1 ? draft.url : undefined, max: counter ? X_MAX - counter.length - 2 : X_MAX });
    set({ posts: [counter ? `${rebuilt}\n\n${counter}` : rebuilt, ...draft.posts.slice(1)], hashtags: [...new Set([...draft.hashtags, ...next])] });
  };

  /* ---- AI rewrite through the existing Groq endpoint ---- */
  const rewrite = async () => {
    setAiBusy(true);
    setMsg(null);
    try {
      const settings = { ...loadSettings(), voice: tone, hashtags: 'none' as const, link: false };
      const tags = [...active].map((t) => tagPool.find((x) => x.toLowerCase() === t) ?? t);
      if (draft.posts.length > 1) {
        const res = await studioAi<{ tweets: string[] }>('thread', {
          prompt: `Rewrite this PolTok X thread in a ${tone} tone. Keep every fact and number exactly; do not add facts. Same number of posts.`,
          context: draft.posts.map((p) => stripTail(p, draft.url).replace(/\n*\d+\/\d+\s*$/, '')).join('\n---\n'),
          n: Math.max(3, Math.min(10, draft.posts.length)),
          settings,
        });
        const tw = res.result.tweets.map((t) => t.replace(/^\d+\/\s*/, ''));
        const first = assemblePost(tw[0], { tags, url: draft.url, max: X_MAX - 8 });
        set({ posts: renumber([first, ...tw.slice(1)]) });
        say(true, `Rewritten (${tone}) with ${res.model || 'Groq'}. Check every fact before posting.`);
      } else {
        const res = await studioAi<{ variants: { tweet: string }[] }>('variants', {
          prompt: `Rewrite this PolTok X post in a ${tone} tone. Keep every fact, number and name exactly; do not add facts.`,
          context: stripTail(draft.posts[0], draft.url),
          n: 2,
          settings,
        });
        const v = res.result.variants[0]?.tweet;
        if (!v) throw new StudioError('bad_output', 'AI returned nothing usable.');
        set({ posts: [assemblePost(v, { tags, url: draft.url })] });
        say(true, `Rewritten (${tone}) with ${res.model || 'Groq'}. Check every fact before posting.`);
      }
    } catch (e) {
      say(false, e instanceof StudioError ? e.message : 'AI rewrite failed — the template text is unchanged.');
    } finally {
      setAiBusy(false);
    }
  };
  const aiAlt = async () => {
    setAiBusy(true);
    try {
      const c = draft.card;
      const res = await studioAi<{ alt: string }>('image-alt', {
        prompt: 'Alt text for this 1200x675 PolTok share card.',
        context: JSON.stringify({ design: draft.designId, title: c.title, subtitle: c.subtitle, stats: c.stats, bars: c.bars, footer: c.footer, badge: draft.badge?.on ? draft.badge.label : undefined }),
        settings: loadSettings(),
      });
      if (res.result.alt) set({ alt: res.result.alt.slice(0, 1000) });
    } catch (e) {
      say(false, e instanceof StudioError ? e.message : 'AI alt text failed.');
    } finally {
      setAiBusy(false);
    }
  };

  /* ---- actions ---- */
  const name = fileBase(draft);
  const doCopyText = async (t = allText) => {
    const ok = await copyText(t);
    say(ok, ok ? 'Text copied.' : 'Copy failed — select the text and copy manually.');
  };
  const doCopyImage = async () => {
    if (!r) return;
    const ok = await copyImage(r.blob);
    say(ok, ok ? 'Image copied — paste it into the X composer (Ctrl/⌘+V).' : 'This browser cannot copy images — use Download PNG.');
  };
  const doZip = async () => {
    if (!r) return;
    downloadBlob(await zipDraft(draft, r.blob), `${name}.zip`);
  };
  const doShare = async () => {
    if (!r) return;
    const res = await shareToApp(allText, r.blob, name);
    say(res !== 'unsupported', res === 'shared' ? 'Shared.' : res === 'cancelled' ? 'Share cancelled.' : 'Sharing files is not supported here.');
  };
  const doClip = async () => {
    if (!r) return;
    setBusy('clip');
    try {
      const { blob, ext } = await exportClip(r, draft, () => {});
      downloadBlob(blob, `${name}.${ext}`);
      say(true, `Clip saved (${ext.toUpperCase()}, 5s, pulsing live dot).`);
    } catch (e) {
      say(false, (e as Error).message || 'Video export failed.');
    } finally {
      setBusy('');
    }
  };
  const save = async (p: Partial<XDraft> = {}) => {
    setBusy('save');
    const d = await saveDraft({ ...draft, ...p });
    onChange(d);
    setBusy('');
    say(true, p.status === 'scheduled' ? `Scheduled for ${fmtBoth(d.scheduledAt!)}.` : 'Saved to queue.');
  };
  const posted = async () => {
    await saveDraft(draft);
    await markPosted(draft.id, postedUrl.trim() || undefined);
    const d = queueState().drafts.find((x) => x.id === draft.id);
    if (d) onChange(d);
    say(true, 'Marked as posted — added to history.');
  };
  const taken = queueState().drafts.filter((d) => d.id !== draft.id && d.scheduledAt && d.status !== 'posted').map((d) => d.scheduledAt!);
  const slots = useMemo(() => suggestSlots(Date.now(), 4, taken), [taken.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const badge = draft.badge ?? BADGE_OFF;

  return (
    <div className="xs-editor">
      <section className="ow-tweet" aria-label="Post text">
        <div className="ow-tweet__h">
          <input className="ow-select xs-title" value={draft.title} onChange={(e) => set({ title: e.target.value })} aria-label="Draft title" />
          <span className={`xs-status xs-status--${draft.status}`}>{draft.status}{draft.auto ? ' · auto' : ''}</span>
          {onClose && <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>}
        </div>
        {draft.posts.map((p, i) => (
          <div key={i} className="xs-post">
            <div className="ow-block__h">
              <b>{draft.posts.length > 1 ? `Post ${i + 1}` : 'Post'}</b>
              <Counter text={p} />
            </div>
            <textarea className="ow-tweet__t" rows={draft.posts.length > 1 ? 5 : 7} value={p} onChange={(e) => setPost(i, e.target.value)} aria-label={`Post ${i + 1} text`} />
            <div className="ow-actions">
              <Button size="sm" variant="ghost" onClick={() => doCopyText(p)}>Copy</Button>
              <Button size="sm" variant="ghost" onClick={() => openInX(p, i === 0 ? draft.url : undefined)}>Open in X</Button>
              {draft.posts.length > 1 && <Button size="sm" variant="ghost" onClick={() => removePost(i)}>Remove</Button>}
            </div>
          </div>
        ))}
        <div className="ow-actions">
          <Button size="sm" variant="ghost" onClick={addPost}>+ Add post (thread)</Button>
          {draft.posts.length > 1 && <Button size="sm" variant="ghost" onClick={() => set({ posts: renumber(draft.posts) })}>Renumber 1/n</Button>}
        </div>
        {over && <p className="ow-err">A post is over 280 (URLs count as 23). Trim it or split into a thread.</p>}

        <div className="xs-group">
          <b className="ow-muted">AI rewrite (Groq)</b>
          <div className="ow-filter" role="radiogroup" aria-label="Tone" style={{ margin: 0 }}>
            {TONES.map((t) => <button key={t.id} type="button" role="radio" aria-checked={tone === t.id} className={`ow-pill ${tone === t.id ? 'is-on' : ''}`} onClick={() => setTone(t.id)}>{t.label}</button>)}
            <Button size="sm" variant="ghost" onClick={rewrite} disabled={aiBusy}>{aiBusy ? 'Rewriting…' : 'Rewrite'}</Button>
          </div>
        </div>
        <div className="xs-group">
          <b className="ow-muted">Hashtags (tap to add/remove in post 1)</b>
          <div className="ow-filter" style={{ margin: 0 }}>
            {tagPool.map((t) => <button key={t} type="button" aria-pressed={active.has(t.toLowerCase())} className={`ow-pill ${active.has(t.toLowerCase()) ? 'is-on' : ''}`} onClick={() => toggleTag(t)}>{t}</button>)}
          </div>
        </div>
        <p className="ow-muted">Link: <a className="ow-link" href={draft.url} target="_blank" rel="noopener noreferrer">{draft.url}</a></p>
      </section>

      <section className="ow-tweet" aria-label="Image card">
        <div className="ow-block__h"><b>Image card · 1200×675</b>{rendering && <span className="ow-count">rendering…</span>}</div>
        <div className="ow-img__frame xs-preview">{r ? <img src={r.url} alt={draft.alt || 'Card preview'} /> : <span className="ow-muted">Rendering…</span>}</div>
        <div className="ow-studio__ctl">
          <label>Design
            <select className="ow-select" value={draft.designId} onChange={(e) => set({ designId: e.target.value })}>
              {designs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          <label className="xs-check"><input type="checkbox" checked={!!draft.brand} onChange={(e) => set({ brand: e.target.checked })} /> Brand palette &amp; fonts</label>
        </div>
        <div className="xs-group">
          <label className="xs-check"><input type="checkbox" checked={badge.on} onChange={(e) => set({ badge: { ...badge, on: e.target.checked } })} /> “{badge.label}” badge</label>
          {badge.on && (
            <div className="ow-actions">
              <div className="ow-filter" role="radiogroup" aria-label="Badge corner" style={{ margin: 0 }}>
                {CORNERS.map((c) => <button key={c.id} type="button" role="radio" aria-checked={badge.corner === c.id} aria-label={`Corner ${c.id}`} className={`ow-pill ${badge.corner === c.id ? 'is-on' : ''}`} onClick={() => set({ badge: { ...badge, corner: c.id } })}>{c.label}</button>)}
              </div>
              <select className="ow-select" style={{ width: 'auto' }} value={badge.label} onChange={(e) => set({ badge: { ...badge, label: e.target.value as BadgeLabel } })} aria-label="Badge label">
                {BADGE_LABELS.map((l) => <option key={l}>{l}</option>)}
              </select>
            </div>
          )}
        </div>
        <label className="ow-muted">Alt text <span className="ow-count">{draft.alt.length}/1000</span>
          <textarea className="ow-tweet__t" style={{ minHeight: 70 }} rows={3} value={draft.alt} maxLength={1000} onChange={(e) => set({ alt: e.target.value })} />
        </label>
        <div className="ow-actions"><Button size="sm" variant="ghost" onClick={aiAlt} disabled={aiBusy}>AI alt text</Button></div>
      </section>

      <section className="ow-tweet xs-actions" aria-label="Ready to post">
        <b>Ready to post</b>
        <div className="ow-actions">
          <Button size="sm" onClick={() => doCopyText()}>Copy text</Button>
          <Button size="sm" onClick={doCopyImage} disabled={!r || !canCopyImage()}>Copy image</Button>
          <Button size="sm" variant="ghost" onClick={() => r && downloadBlob(r.blob, `${name}.png`)} disabled={!r}>Download PNG</Button>
          <Button size="sm" variant="ghost" onClick={doZip} disabled={!r}>Download all (.zip)</Button>
          <Button size="sm" variant="ghost" onClick={() => openInX(draft.posts[0], draft.url)}>Open in X</Button>
          {canShareFiles() && <Button size="sm" variant="ghost" onClick={doShare} disabled={!r}>Share to app…</Button>}
          <Button size="sm" variant="ghost" onClick={doClip} disabled={!r || busy === 'clip'}>{busy === 'clip' ? 'Recording…' : 'Video clip'}</Button>
        </div>
        <p className="ow-muted">X can’t attach images through a link: tap <b>Copy image</b>, then paste it into the X composer that <b>Open in X</b> opens. On a phone, <b>Share to app…</b> sends text + image straight to the X app.</p>
        <div className="xs-group">
          <b className="ow-muted">Schedule (you still post manually)</b>
          <div className="ow-filter" style={{ margin: 0 }}>
            {slots.map((s) => (
              <button key={s.ts} type="button" className={`ow-pill ${draft.scheduledAt === s.ts ? 'is-on' : ''}`} title={s.why} onClick={() => set({ scheduledAt: s.ts, status: 'scheduled' })}>
                {s.label}: {fmtBoth(s.ts)}
              </button>
            ))}
          </div>
          <label className="ow-muted">Custom time (your device zone)
            <input className="ow-select" type="datetime-local" value={draft.scheduledAt ? toLocalInput(draft.scheduledAt) : ''} onChange={(e) => set(e.target.value ? { scheduledAt: new Date(e.target.value).getTime(), status: 'scheduled' } : { scheduledAt: undefined, status: 'draft' })} />
          </label>
          {draft.scheduledAt && <p className="ow-muted">Planned: {fmtBoth(draft.scheduledAt)}</p>}
        </div>
        <div className="ow-actions">
          <Button size="sm" onClick={() => save(draft.scheduledAt ? { status: 'scheduled' } : {})} disabled={busy === 'save'}>{draft.scheduledAt ? 'Save scheduled' : 'Save to queue'}</Button>
          {draft.status !== 'posted' && <>
            <input className="ow-select" style={{ flex: '1 1 180px', width: 'auto' }} placeholder="Posted tweet URL (optional)" value={postedUrl} onChange={(e) => setPostedUrl(e.target.value)} aria-label="Posted tweet URL" />
            <Button size="sm" variant="ghost" onClick={posted}>Mark posted</Button>
          </>}
        </div>
        {msg && <p className={msg.ok ? 'ow-muted' : 'ow-err'} role="status">{msg.t}</p>}
      </section>
    </div>
  );
}
