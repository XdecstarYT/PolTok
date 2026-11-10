/** Owner tool: write / edit / delete "What's new" posts (server: /api/updates, owner token required). */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '../../components';
import { askAi, AiError } from '../../lib/ai';
import { designsFor, renderCard, cardFileName, type CardData } from '../../lib/cards';
import { getToken } from './auth';
import { autoDraftUpdate } from './xstudio/autodraft';
import { CATEGORIES, loadUpdates, PostView, type UpdateCategory, type UpdatePost } from '../updates';

const SITE = 'https://poltok.netlify.app';
const blank = (): UpdatePost => ({ id: '', title: '', date: new Date().toISOString(), version: '', categories: ['New'], body: '', links: [] });
const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const linksToText = (l: UpdatePost['links']) => (l ?? []).map((x) => `${x.label} | ${x.to}`).join('\n');
const textToLinks = (t: string) =>
  t.split('\n').map((l) => l.split('|').map((s) => s.trim())).filter(([a, b]) => a && b).map(([label, to]) => ({ label, to }));

export function UpdatesAdmin() {
  const [posts, setPosts] = useState<UpdatePost[]>([]);
  const [edit, setEdit] = useState<UpdatePost>(blank);
  const [linksText, setLinksText] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [bullets, setBullets] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiUsed, setAiUsed] = useState(false);
  const [card, setCard] = useState<{ url: string; blob: Blob; design: string } | null>(null);
  const designs = useMemo(() => designsFor('announcement'), []);
  const [design, setDesign] = useState(designs[0]?.id ?? '');

  const refresh = useCallback(() => loadUpdates(true, getToken()).then(setPosts), []);
  useEffect(() => void refresh(), [refresh]);
  useEffect(() => () => { if (card) URL.revokeObjectURL(card.url); }, [card]);

  const isEditing = !!edit.id;
  const preview: UpdatePost = { ...edit, id: edit.id || 'preview', links: textToLinks(linksText), title: edit.title || 'Untitled update', body: edit.body || '_Write the body…_' };
  const set = (p: Partial<UpdatePost>) => setEdit((e) => ({ ...e, ...p }));
  const pick = (p: UpdatePost) => {
    setEdit({ ...p });
    setLinksText(linksToText(p.links));
    setAiUsed(false);
    setCard(null);
    setMsg(null);
  };

  const call = async (method: 'POST' | 'PUT' | 'DELETE', id?: string, body?: unknown) => {
    const r = await fetch('/api/updates' + (id ? '/' + encodeURIComponent(id) : ''), {
      method,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${getToken() ?? ''}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    const d = (await r.json().catch(() => ({}))) as { post?: UpdatePost; error?: string };
    if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
    return d;
  };

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const { source: _s, ...body } = { ...edit, links: textToLinks(linksText) };
      const d = await call(isEditing ? 'PUT' : 'POST', isEditing ? edit.id : undefined, body);
      if (d.post) pick(d.post);
      const drafted = d.post && !d.post.draft ? await autoDraftUpdate(d.post).catch(() => null) : null;
      setMsg({ ok: true, t: (isEditing ? 'Saved.' : 'Published.') + (drafted ? ' X post + card auto-drafted in X Studio → Queue.' : '') });
      refresh();
    } catch (e) {
      setMsg({ ok: false, t: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!isEditing || !confirm(`Delete “${edit.title}”?`)) return;
    setBusy(true);
    try {
      await call('DELETE', edit.id);
      pick(blank());
      setLinksText('');
      setMsg({ ok: true, t: 'Deleted.' });
      refresh();
    } catch (e) {
      setMsg({ ok: false, t: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const draftWithAi = async () => {
    if (!bullets.trim()) return;
    setAiBusy(true);
    setMsg(null);
    const question =
      'Write a short, user-facing release note for the PolTok website from these bullet points. ' +
      'Use only what the bullets say — do not invent features. Reply in this exact format:\nTITLE: <max 10 words>\nBODY:\n<one sentence intro, then "- " bullet lines; use **bold** for feature names>\n\nBullets:\n' +
      bullets.trim().slice(0, 2000);
    try {
      const out = await askAi({ question, context: {}, mode: 'chat' }, () => {});
      const t = /TITLE:\s*(.+)/i.exec(out)?.[1]?.trim();
      const b = /BODY:\s*([\s\S]+)/i.exec(out)?.[1]?.trim() ?? out.trim();
      set({ ...(t ? { title: t.replace(/^["*]+|["*]+$/g, '') } : {}), body: b });
      setAiUsed(true);
    } catch (e) {
      setMsg({ ok: false, t: e instanceof AiError ? e.message : 'AI draft failed.' });
    } finally {
      setAiBusy(false);
    }
  };

  const makeCard = async () => {
    const data: CardData = {
      kind: 'announcement',
      title: edit.title || 'What’s new on PolTok',
      subtitle: edit.body.split('\n').find((l) => l.trim())?.replace(/[*`#-]/g, '').trim().slice(0, 140),
      footer: [edit.version, 'PolTok updates'].filter(Boolean).join(' · '),
      cta: 'poltok.netlify.app/updates',
      url: `${SITE}/updates`,
    };
    try {
      const blob = await renderCard(design, data);
      setCard({ url: URL.createObjectURL(blob), blob, design });
    } catch {
      setMsg({ ok: false, t: 'Card render failed.' });
    }
  };
  const xIntent = () => {
    const text = `${edit.version ? `New on PolTok ${edit.version}: ` : 'New on PolTok: '}${edit.title}`;
    const url = `${SITE}/updates${edit.id ? '#' + edit.id : ''}`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank', 'noopener');
  };

  return (
    <div className="ow-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))' }}>
      <section className="ow-tweet" aria-label="Update editor">
        <div className="ow-tweet__h">
          <b>{isEditing ? 'Edit update' : 'New update'}</b>
          {aiUsed && <span className="ow-ai">AI draft — review before publishing</span>}
          <span className="ow-count">{edit.source ?? ''}</span>
        </div>
        <label className="ow-muted">Posts
          <select className="ow-select" value={edit.id} onChange={(e) => pick(posts.find((p) => p.id === e.target.value) ?? blank())}>
            <option value="">+ New post</option>
            {posts.map((p) => <option key={p.id} value={p.id}>{p.draft ? '[draft] ' : ''}{p.version ? p.version + ' — ' : ''}{p.title}</option>)}
          </select>
        </label>

        <details>
          <summary className="ow-muted">Draft with AI from bullet points</summary>
          <textarea className="ow-tweet__t" rows={4} value={bullets} onChange={(e) => setBullets(e.target.value)} placeholder={'- Added X\n- Fixed Y'} aria-label="Bullet points for AI draft" />
          <Button size="sm" variant="ghost" onClick={draftWithAi} disabled={aiBusy || !bullets.trim()}>{aiBusy ? 'Drafting…' : 'Draft with AI'}</Button>
        </details>

        <label className="ow-muted">Title<input className="ow-select" value={edit.title} maxLength={140} onChange={(e) => set({ title: e.target.value })} /></label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <label className="ow-muted" style={{ flex: '1 1 100px' }}>Version<input className="ow-select" value={edit.version ?? ''} maxLength={20} placeholder="v0.17" onChange={(e) => set({ version: e.target.value })} /></label>
          <label className="ow-muted" style={{ flex: '2 1 180px' }}>Date<input className="ow-select" type="datetime-local" value={toLocalInput(edit.date)} onChange={(e) => e.target.value && set({ date: new Date(e.target.value).toISOString() })} /></label>
        </div>
        <div className="ow-filter" role="group" aria-label="Categories" style={{ margin: 0 }}>
          {CATEGORIES.map((c: UpdateCategory) => {
            const on = edit.categories.includes(c);
            return (
              <button key={c} type="button" className={`ow-pill ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={() => set({ categories: on ? edit.categories.filter((x) => x !== c) : [...edit.categories, c] })}>{c}</button>
            );
          })}
        </div>
        <label className="ow-muted">Body (markdown-lite: **bold**, *em*, `code`, [link](/path), "- " lists)
          <textarea className="ow-tweet__t" rows={9} value={edit.body} onChange={(e) => set({ body: e.target.value })} />
        </label>
        <label className="ow-muted">“Try it” links (one per line: Label | /path)
          <textarea className="ow-tweet__t" style={{ minHeight: 60 }} rows={2} value={linksText} onChange={(e) => setLinksText(e.target.value)} />
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <label className="ow-muted" style={{ flex: '2 1 200px' }}>Screenshot URL (optional)<input className="ow-select" value={edit.image ?? ''} placeholder="https://… or /path.png" onChange={(e) => set({ image: e.target.value })} /></label>
          <label className="ow-muted" style={{ flex: '1 1 140px' }}>Alt text<input className="ow-select" value={edit.imageAlt ?? ''} onChange={(e) => set({ imageAlt: e.target.value })} /></label>
        </div>
        <div className="ow-actions">
          <label className="ow-muted"><input type="checkbox" checked={!!edit.major} onChange={(e) => set({ major: e.target.checked })} /> Major (one-time toast)</label>
          <label className="ow-muted"><input type="checkbox" checked={!!edit.draft} onChange={(e) => set({ draft: e.target.checked })} /> Draft (hidden)</label>
        </div>
        <div className="ow-actions">
          <Button onClick={save} disabled={busy || !edit.title.trim() || !edit.body.trim()}>{isEditing ? 'Save changes' : 'Publish'}</Button>
          {isEditing && <Button variant="ghost" onClick={remove} disabled={busy}>Delete</Button>}
          {isEditing && <Button variant="ghost" onClick={() => { pick(blank()); setLinksText(''); }}>New</Button>}
        </div>
        {msg && <p className={msg.ok ? 'ow-muted' : 'ow-err'} role="status">{msg.t}</p>}
      </section>

      <section className="ow-tweet" aria-label="Preview and share">
        <b>Live preview</b>
        <PostView post={preview} />
        <b>Share</b>
        <div className="ow-actions">
          <select className="ow-select" style={{ width: 'auto' }} value={design} onChange={(e) => setDesign(e.target.value)} aria-label="Card design">
            {designs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <Button size="sm" variant="ghost" onClick={makeCard} disabled={!edit.title.trim()}>Make announcement card</Button>
          <Button size="sm" variant="ghost" onClick={xIntent} disabled={!edit.title.trim()}>Post on X</Button>
        </div>
        {card && (
          <div className="ow-img">
            <img src={card.url} alt="Announcement share card preview" style={{ width: '100%', borderRadius: 8 }} />
            <a className="ow-link" href={card.url} download={cardFileName(card.design, { kind: 'announcement', title: edit.title } as CardData)}>Download PNG (attach it to your X post)</a>
          </div>
        )}
      </section>
    </div>
  );
}
