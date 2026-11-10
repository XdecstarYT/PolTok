/** X Studio: release → X post, live-data posts, queue + calendar. The owner always posts manually. */
import { useEffect, useMemo, useState } from 'react';
import { Button, Tabs } from '../../../components';
import { getToken } from '../auth';
import { loadUpdates, type UpdatePost } from '../../updates/api';
import { draftForUpdates, updatesSince } from './compose';
import { buildLivePost, TEMPLATES, type TemplateId } from './livePosts';
import { BADGE_LIVE } from './badge';
import { PostEditor } from './PostEditor';
import { deleteDraft, loadQueue, markPosted, queueMode, queueState, subscribeQueue, type QueueMode } from './queue';
import { fmtBoth, fmtIn, ET, suggestSlots, ymdIn } from './schedule';
import { renderDraftCard, zipMany, downloadBlob } from './actions';
import { newId } from './compose';
import type { QueueState, XDraft } from './types';
import './xstudio.css';

export type XTab = 'release' | 'live' | 'queue';
const TABS: { id: XTab; label: string }[] = [
  { id: 'release', label: 'Release → X' },
  { id: 'live', label: 'Live-data posts' },
  { id: 'queue', label: 'Queue & calendar' },
];

function useQueue(): [QueueState, QueueMode] {
  const [s, setS] = useState<[QueueState, QueueMode]>([queueState(), queueMode()]);
  useEffect(() => subscribeQueue((st, m) => setS([st, m])), []);
  return s;
}

export function XStudio({ initialTab = 'release', openId }: { initialTab?: XTab; openId?: string | null }) {
  const [tab, setTab] = useState<XTab>(initialTab);
  const [work, setWork] = useState<XDraft | null>(null);
  const [state, mode] = useQueue();
  useEffect(() => {
    void loadQueue().then(({ state: s }) => {
      if (openId) {
        const d = s.drafts.find((x) => x.id === openId);
        if (d) setWork(d);
      }
    });
  }, [openId]);
  useEffect(() => setTab(initialTab), [initialTab]);

  return (
    <div className="xs">
      <div className="xs-head">
        <div>
          <h2 className="xs-h">X Studio</h2>
          <p className="ow-muted">Ready-to-post X copy + 1200×675 cards. Nothing is posted automatically — you post by hand.</p>
        </div>
        <span className={`xs-mode ${mode === 'server' ? 'is-ok' : ''}`} title={mode === 'server' ? 'Queue stored in Netlify Blobs' : 'Queue API unreachable — saved in this browser and synced later'}>
          {mode === 'server' ? 'Queue synced' : 'Local queue (offline)'}
        </span>
      </div>
      {!work && <Tabs tabs={TABS} value={tab} onChange={setTab} variant="pill" ariaLabel="X Studio sections" />}
      {work ? (
        <PostEditor draft={work} onChange={setWork} onClose={() => setWork(null)} />
      ) : tab === 'release' ? (
        <ReleasePicker onDraft={setWork} lastPosted={state.meta.lastPostedUpdateAt} />
      ) : tab === 'live' ? (
        <LivePicker onDraft={setWork} />
      ) : (
        <QueueView state={state} onOpen={setWork} />
      )}
    </div>
  );
}

/* ------------------------------ Release → X ------------------------------ */
function ReleasePicker({ onDraft, lastPosted }: { onDraft: (d: XDraft) => void; lastPosted?: number }) {
  const [posts, setPosts] = useState<UpdatePost[]>([]);
  const [sel, setSel] = useState<string[]>([]);
  useEffect(() => {
    void loadUpdates(true, getToken()).then((p) => setPosts(p.filter((x) => !x.draft)));
  }, []);
  const since = useMemo(() => updatesSince(posts, lastPosted ?? 0), [posts, lastPosted]);
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const make = (list: UpdatePost[]) => list.length && onDraft(draftForUpdates(list));
  return (
    <section className="ow-tweet" aria-label="Pick updates">
      <div className="ow-actions">
        <Button size="sm" onClick={() => make(posts.filter((p) => sel.includes(p.id)))} disabled={!sel.length}>
          Make X {sel.length > 1 ? 'thread' : 'post'}{sel.length ? ` (${sel.length})` : ''}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { setSel(since.map((p) => p.id)); }} disabled={!since.length}>
          Select {lastPosted ? `all since last posted (${since.length})` : `all (${since.length})`}
        </Button>
        {lastPosted ? <span className="ow-muted">Last update post: {fmtBoth(lastPosted)}</span> : <span className="ow-muted">No update posted from Studio yet.</span>}
      </div>
      <ul className="xs-list">
        {posts.map((p) => (
          <li key={p.id} className="xs-row">
            <label className="xs-check">
              <input type="checkbox" checked={sel.includes(p.id)} onChange={() => toggle(p.id)} />
              <span><b>{p.version ? p.version + ' — ' : ''}{p.title}</b><br /><span className="ow-muted">{new Date(p.date).toLocaleDateString()}{since.some((x) => x.id === p.id) && lastPosted ? ' · not yet posted' : ''}</span></span>
            </label>
            <Button size="sm" variant="ghost" onClick={() => make([p])}>One-click post</Button>
          </li>
        ))}
        {!posts.length && <li className="ow-muted">Loading updates…</li>}
      </ul>
    </section>
  );
}

/* ------------------------------ Live-data posts ------------------------------ */
function LivePicker({ onDraft }: { onDraft: (d: XDraft) => void }) {
  const [busy, setBusy] = useState<TemplateId | null>(null);
  const [err, setErr] = useState('');
  const go = async (id: TemplateId) => {
    setBusy(id);
    setErr('');
    try {
      const lp = await buildLivePost(id);
      const now = Date.now();
      onDraft({
        id: newId(id), title: lp.title, posts: lp.posts, url: lp.url, hashtags: lp.hashtags, alt: lp.alt, designId: lp.design,
        cardKind: lp.cardKind, card: lp.card, brand: true, badge: id === 'quorum' ? { ...BADGE_LIVE, on: false } : { ...BADGE_LIVE },
        source: { type: 'live', template: id }, status: 'draft', created: now, updated: now,
      });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  return (
    <section aria-label="Live templates">
      <div className="xs-tiles">
        {TEMPLATES.map((t) => (
          <button key={t.id} type="button" className="xs-tile" onClick={() => go(t.id)} disabled={!!busy}>
            <span className="xs-tile__i" aria-hidden="true">{t.icon}</span>
            <b>{busy === t.id ? 'Loading…' : t.label}</b>
            <span className="ow-muted">{t.desc}</span>
          </button>
        ))}
      </div>
      {err && <p className="ow-err" role="status">{err}</p>}
    </section>
  );
}

/* ------------------------------ Queue & calendar ------------------------------ */
function QueueView({ state, onOpen }: { state: QueueState; onOpen: (d: XDraft) => void }) {
  const [zipBusy, setZipBusy] = useState(false);
  const now = Date.now();
  const open = state.drafts.filter((d) => d.status !== 'posted');
  const scheduled = open.filter((d) => d.scheduledAt).sort((a, b) => a.scheduledAt! - b.scheduledAt!);
  const drafts = open.filter((d) => !d.scheduledAt).sort((a, b) => b.updated - a.updated);
  const slots = suggestSlots(now, 6, scheduled.map((d) => d.scheduledAt!));
  const days = Array.from({ length: 7 }, (_, i) => {
    const [y, m, d] = ymdIn(now + i * 864e5, ET);
    const key = `${y}-${m}-${d}`;
    return { key, label: fmtIn(now + i * 864e5, ET).split(',')[0], items: scheduled.filter((x) => ymdIn(x.scheduledAt!, ET).join('-') === key) };
  });
  const zipAll = async () => {
    setZipBusy(true);
    try {
      const items = [];
      for (const d of open) {
        const r = await renderDraftCard(d);
        URL.revokeObjectURL(r.url);
        items.push({ d, png: r.blob });
      }
      downloadBlob(await zipMany(items), `poltok-x-queue-${new Date().toISOString().slice(0, 10)}.zip`);
    } finally {
      setZipBusy(false);
    }
  };
  const Row = ({ d }: { d: XDraft }) => (
    <li className="xs-row">
      <div className="xs-row__t">
        <b>{d.title}</b>
        <span className="ow-muted">
          {d.posts.length > 1 ? `Thread · ${d.posts.length} posts` : 'Single post'}
          {d.auto ? ' · auto-drafted' : ''}
          {d.scheduledAt ? ` · ${fmtBoth(d.scheduledAt)}` : ''}
          {d.scheduledAt && d.scheduledAt < now ? ' · OVERDUE' : ''}
        </span>
      </div>
      <div className="ow-actions">
        <Button size="sm" onClick={() => onOpen(d)}>Open</Button>
        <Button size="sm" variant="ghost" onClick={() => markPosted(d.id)}>Mark posted</Button>
        <Button size="sm" variant="ghost" onClick={() => confirm(`Delete “${d.title}”?`) && deleteDraft(d.id)}>Delete</Button>
      </div>
    </li>
  );
  return (
    <div className="xs-queue">
      <section className="ow-tweet" aria-label="Scheduled">
        <div className="ow-block__h"><b>Scheduled ({scheduled.length})</b>
          <Button size="sm" variant="ghost" onClick={zipAll} disabled={!open.length || zipBusy}>{zipBusy ? 'Zipping…' : `Download all (${open.length}) .zip`}</Button>
        </div>
        <ul className="xs-list">{scheduled.map((d) => <Row key={d.id} d={d} />)}{!scheduled.length && <li className="ow-muted">Nothing scheduled. Open a draft and pick a suggested slot.</li>}</ul>
      </section>
      <section className="ow-tweet" aria-label="Drafts">
        <b>Drafts ({drafts.length})</b>
        <ul className="xs-list">{drafts.map((d) => <Row key={d.id} d={d} />)}{!drafts.length && <li className="ow-muted">No drafts. Publishing an update auto-drafts one here.</li>}</ul>
      </section>
      <section className="ow-tweet" aria-label="Calendar">
        <b>Next 7 days (ET days)</b>
        <div className="xs-cal">
          {days.map((d) => (
            <div key={d.key} className="xs-cal__d">
              <span className="xs-cal__h">{d.label}</span>
              {d.items.map((x) => <button key={x.id} type="button" className="xs-cal__i" onClick={() => onOpen(x)}>{fmtIn(x.scheduledAt!, ET).split(', ').pop()} · {x.title}</button>)}
            </div>
          ))}
        </div>
        <b className="ow-muted">Suggested slots (US + AU audiences)</b>
        <ul className="xs-slots">{slots.map((s) => <li key={s.ts}><b>{s.label}</b> — {fmtBoth(s.ts)} <span className="ow-muted">· {s.why}</span></li>)}</ul>
      </section>
      <section className="ow-tweet" aria-label="History">
        <b>Posted history ({state.history.length})</b>
        <ul className="xs-list">
          {state.history.slice(0, 50).map((h) => (
            <li key={h.id + h.postedAt} className="xs-row">
              <div className="xs-row__t"><b>{h.title}</b><span className="ow-muted">{fmtBoth(h.postedAt)} · {h.posts} post{h.posts === 1 ? '' : 's'}</span></div>
              {h.postedUrl && <a className="ow-link" href={h.postedUrl} target="_blank" rel="noopener noreferrer">View on X</a>}
            </li>
          ))}
          {!state.history.length && <li className="ow-muted">Nothing marked as posted yet.</li>}
        </ul>
      </section>
    </div>
  );
}
