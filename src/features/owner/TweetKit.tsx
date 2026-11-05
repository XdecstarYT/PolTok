import { useEffect, useMemo, useState } from 'react';
import { Button, Chip } from '../../components';
import { useLive } from '../../lib/live';
import { useFlipsData } from '../flips/data';
import { askAi, buildContext } from '../../lib/ai';
import { buildTweets, fullText, linkFor, weight, type Tweet } from './tweets';
import { designsForKind, listDesigns, pickDesign, type Design } from './cards';
import { ImagePanel } from './ImagePanel';

export function useDesigns() {
  const [d, setD] = useState<{ designs: Design[]; shared: boolean } | null>(null);
  useEffect(() => {
    listDesigns().then(setD);
  }, []);
  return d;
}

async function copyText(s: string) {
  try {
    await navigator.clipboard.writeText(s);
    return true;
  } catch {
    return false;
  }
}

function TweetCard({ t, designs, idx }: { t: Tweet; designs: Design[]; idx: number }) {
  const live = useLive();
  const [text, setText] = useState(t.text);
  const [ai, setAi] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [design, setDesign] = useState(() => pickDesign(designs, t.hints, idx, t.subject.kind).id);
  const [showImg, setShowImg] = useState(false);
  const fit = useMemo(() => designsForKind(designs, t.subject.kind), [designs, t.subject.kind]);
  useEffect(() => {
    if (!ai) setText(t.text);
  }, [t.text, ai]);
  const cur = { text, path: t.path };
  const w = weight(cur);
  const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(linkFor(t))}`;
  const rewrite = async () => {
    setBusy(true);
    setNote('');
    try {
      const q = `Rewrite this tweet as ONE punchier variant under 230 characters. Keep every number and name exactly as given, add no new facts, keep the hashtags, no link, output only the tweet text:\n\n${t.text}`;
      const ctx = await buildContext(live, t.text);
      const out = await askAi({ question: q, context: ctx, mode: 'chat' }, () => {});
      const clean = out.trim().replace(/^["“]|["”]$/g, '');
      if (clean) {
        setText(clean);
        setAi(true);
      }
    } catch (e) {
      setNote((e as Error).message || 'AI unavailable');
    }
    setBusy(false);
  };
  return (
    <article className="ow-tweet">
      <header className="ow-tweet__h">
        <Chip>{t.group}</Chip>
        {ai && <span className="ow-ai">AI rewrite — check facts</span>}
        <span className={`ow-count ${w > 280 ? 'is-over' : ''}`}>{w}/280</span>
      </header>
      <textarea className="ow-tweet__t" value={text} onChange={(e) => setText(e.target.value)} rows={5} aria-label="Tweet text" />
      <a className="ow-link" href={linkFor(t)} target="_blank" rel="noreferrer">{linkFor(t)}</a>
      <div className="ow-actions">
        <Button size="sm" onClick={async () => setNote((await copyText(fullText(cur))) ? 'Copied' : 'Copy failed')}>Copy text</Button>
        <Button size="sm" variant="ghost" href={intent}>Post on X</Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={rewrite}>{busy ? 'Rewriting…' : 'Rewrite with AI'}</Button>
        {ai && <Button size="sm" variant="ghost" onClick={() => { setAi(false); setText(t.text); }}>Reset</Button>}
        <Button size="sm" variant="ghost" onClick={() => setShowImg((v) => !v)}>{showImg ? 'Hide image' : 'Image'}</Button>
      </div>
      {note && <p className="ow-muted" role="status">{note}</p>}
      <label className="ow-muted">Image card ({t.subject.kind}{t.subject.id ? ` · ${t.subject.id}` : ''})
        <select className="ow-select" value={design} onChange={(e) => { setDesign(e.target.value); setShowImg(true); }} aria-label="Card design">
          {fit.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </label>
      {showImg && (
        <>
          <ImagePanel designId={design} subject={t.subject} name={`poltok-${t.subject.kind}-${t.subject.id}`} text={fullText(cur)} />
        </>
      )}
    </article>
  );
}

export function TweetKit() {
  const live = useLive();
  const { data: flips } = useFlipsData(120000);
  const ds = useDesigns();
  const tweets = useMemo(() => buildTweets(live, flips?.races ?? null), [live, flips]);
  const [group, setGroup] = useState<string>('All');
  const groups = ['All', ...Array.from(new Set(tweets.map((t) => t.group)))];
  const shown = group === 'All' ? tweets : tweets.filter((t) => t.group === group);
  return (
    <section>
      <p className="ow-muted">{tweets.length} tweets generated from live data ({live.source === 'live' ? 'AP via NYT' : 'demo replay'}; updated {live.lastUpdate ? new Date(live.lastUpdate).toLocaleTimeString() : '—'}). {ds && !ds.shared && 'Shared card designs not found — using classic share cards.'}</p>
      <div className="ow-filter">
        {groups.map((g) => (
          <button key={g} type="button" className={`ow-pill ${g === group ? 'is-on' : ''}`} onClick={() => setGroup(g)}>{g}</button>
        ))}
      </div>
      <div className="ow-grid">
        {ds && shown.map((t, i) => <TweetCard key={t.id + t.path} t={t} designs={ds.designs} idx={i} />)}
      </div>
    </section>
  );
}
