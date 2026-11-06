import { useMemo, useState } from 'react';
import { Button } from '../../components';
import { useLive } from '../../lib/live';
import { AiError, composeAi, type ComposeDesign } from '../../lib/ai';
import { raceById } from '../../data';
import { VICTORIA, FEDERAL } from '../../data/au';
import { validateCompose, type ComposeResult } from '../../../shared/compose.js';
import { CARD_DESIGNS, cardDataFor, type CardData, type CardKind, type CardStyle } from '../../lib/cards';
import { copyImage, download, shareImage } from './cards';
import { CardPreview } from './CardPreview';
import { applyTexts } from './editorBus';
import { loadSettings } from './aiStudioApi';
import { SITE, pathFor } from './tweets';
import { copyText, intentUrl, xWeight } from './LinkedTweet';

const DATA_IDEAS = [
  'Post about the Texas Senate race, comic style',
  'Victoria countdown, story size',
  'Senate balance of power, broadcast style, navy and gold',
  'Biggest flip of the night, breaking news',
  'Most marginal federal seat in Australia',
  'How many races are called so far, big number, rounded corners',
];
const MSG_IDEAS = [
  'Thank followers for staying up all night with us',
  'We just hit 10,000 followers',
  'Announce our new Australian results page',
  'Ask followers which race they are watching tonight (poll)',
  'Statement: we never paywall election results',
  'A short memo on how we source results',
];
const DATA_KINDS = ['race', 'balance', 'au-seat', 'promo', 'stat', 'flip', 'quote'];
const AU_IDS = new Set([...VICTORIA.seats, ...FEDERAL.seats].map((s) => s.id));
const IDS: Record<string, string[]> = {
  balance: ['senate', 'house'],
  promo: ['default', 'live', 'map', 'au', 'vic-countdown', 'swingometer'],
  stat: ['calls', 'flips', 'senate', 'house', 'au-marginal'],
};

function errText(e: unknown): string {
  if (e instanceof AiError) {
    if (e.code === 'not_configured') return 'AI is not configured on this deployment (set the GROQ env var).';
    if (e.code === 'rate_limited') return `${e.message} (Groq free tier — wait a minute and retry.)`;
    if (e.code === 'too_large') return 'Request too large for the free AI plan — shorten the prompt.';
    return e.message;
  }
  return (e as Error)?.message || 'AI unavailable';
}

type Post = 'data' | 'message';
interface Draft { r: ComposeResult; tweet: string; designId: string }

export function MakeWithAi() {
  const live = useLive();
  const [post, setPost] = useState<Post>('data');
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [sel, setSel] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [msg, setMsg] = useState('');
  const designs: ComposeDesign[] = useMemo(
    () => CARD_DESIGNS.map((d) => ({ id: d.id, name: d.name, kinds: d.kinds.filter((k) => (post === 'data' ? DATA_KINDS : ['message', 'announcement', 'thanks', 'milestone', 'question', 'statement', 'quote']).includes(k)), w: d.size.w, h: d.size.h })).filter((d) => d.kinds.length),
    [post],
  );
  const validId = (kind: string, id: string) => {
    if (kind === 'race' || kind === 'flip') return raceById.has(id);
    if (kind === 'au-seat') return AU_IDS.has(id);
    if (kind === 'quote') return live.news.some((n) => n.id === id);
    return (IDS[kind] ?? []).includes(id);
  };
  const liveStats = (kind: string, id: string) => cardDataFor(kind as CardKind, id, live).stats?.map((s) => ({ label: s.label, value: s.value }));
  const toDraft = (raw: unknown): Draft => {
    const r = validateCompose(raw, designs, { validId, post, liveStats });
    return { r, tweet: r.tweet, designId: r.designId };
  };
  const one = (q: string, temperature: number) =>
    composeAi({ prompt: q, designs, temperature, task: post === 'message' ? 'message' : 'post', settings: post === 'message' ? loadSettings() : undefined }).then(toDraft);

  const run = async (q = prompt, n = 1) => {
    const text = q.trim();
    if (!text || busy) return;
    setPrompt(text);
    setErr('');
    setMsg('');
    setBusy(n > 1 ? `Variant 1 of ${n}…` : 'Composing…');
    const temps = n > 1 ? [0.3, 0.7, 1.0] : [0.4];
    const out: Draft[] = [];
    for (let i = 0; i < temps.length; i++) {
      if (n > 1) setBusy(`Variant ${i + 1} of ${n}…`);
      try {
        out.push(await one(text, temps[i]));
        setDrafts([...out]);
        if (i === 0) setSel(0);
      } catch (e) {
        setErr(errText(e) + (out.length ? ` (kept ${out.length} variant${out.length > 1 ? 's' : ''})` : ''));
        break; // stop on any error (rate limits) — sequential by design
      }
    }
    setBusy('');
  };

  const cur = drafts[sel];
  const upd = (p: Partial<Draft>) => setDrafts((ds0) => ds0.map((d, i) => (i === sel ? { ...d, ...p } : d)));
  const subject = cur?.r.subject;
  const isMsg = cur?.r.post === 'message';
  const path = subject && !isMsg ? pathFor(subject as Parameters<typeof pathFor>[0]) : '';
  const full = cur ? (path ? `${cur.tweet}\n${SITE}${path}` : cur.tweet) : '';
  const w = cur ? xWeight(cur.tweet) : 0;
  const list = subject ? CARD_DESIGNS.filter((d) => d.kinds.includes(subject.kind as CardKind)) : [];
  const fname = subject ? `poltok-${cur.designId}-${subject.kind}-${subject.id || 'post'}`.replace(/[^a-z0-9-]+/gi, '-') : 'poltok';
  const data: CardData | null = useMemo(() => {
    if (!cur || !subject) return null;
    if (isMsg) return applyTexts({ kind: subject.kind as CardKind, title: '', url: 'poltok.netlify.app' }, cur.r.texts);
    const base = cardDataFor(subject.kind as CardKind, subject.id, live);
    return applyTexts({ ...base, ...cur.r.cardOverrides }, cur.r.texts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur, subject?.kind, subject?.id, isMsg, live.lastUpdate]);
  const style = (cur?.r.style ?? {}) as CardStyle;

  return (
    <section className="ow-make">
      <form className="ow-make__form" onSubmit={(e) => { e.preventDefault(); run(); }}>
        <div className="ow-filter" role="radiogroup" aria-label="Post type">
          {(['data', 'message'] as Post[]).map((p) => <button key={p} type="button" role="radio" aria-checked={post === p} className={`ow-pill ${post === p ? 'is-on' : ''}`} onClick={() => { setPost(p); setDrafts([]); }}>{p === 'data' ? 'Data post' : 'Message post'}</button>)}
        </div>
        <label htmlFor="ow-make-q"><strong>{post === 'data' ? 'Describe the post' : 'What do you want to say?'}</strong></label>
        <textarea id="ow-make-q" value={prompt} maxLength={600} onChange={(e) => setPrompt(e.target.value)} placeholder={post === 'data' ? 'e.g. Post about the Texas Senate upset, comic style\nor: Victoria countdown, story size, purple and gold' : 'Type the message or a rough idea, e.g. "thanks for 10k followers, warm and confetti-ish"'} onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) run(); }} />
        <div className="ow-filter" aria-label="Quick ideas">
          {(post === 'data' ? DATA_IDEAS : MSG_IDEAS).map((i) => <button key={i} type="button" className="ow-pill" disabled={!!busy} onClick={() => run(i)}>{i}</button>)}
        </div>
        <div className="ow-actions">
          <Button type="submit" size="sm" disabled={!!busy || !prompt.trim()}>{busy || 'Make it'}</Button>
          <Button size="sm" variant="ghost" disabled={!!busy || !prompt.trim()} onClick={() => run(prompt, 3)}>3 variants</Button>
          {cur && <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => run(prompt, 1)}>Regenerate</Button>}
        </div>
        <p className="ow-muted">{post === 'data' ? 'AI picks the subject, design, text and full style; every number on the card is checked against the live feed (mismatches are replaced with live values and flagged).' : 'AI drafts the message, tweet and style in your AI Studio voice settings. Wrap words in *asterisks* for accent emphasis.'} Free-tier limited — about 8 requests a minute.</p>
        {err && <p className="ow-err" role="alert">{err}</p>}
      </form>

      {cur && subject && data && (
        <>
          {drafts.length > 1 && (
            <div className="ow-variants" role="tablist" aria-label="Variants">
              {drafts.map((d, i) => <button key={i} type="button" role="tab" aria-selected={i === sel} className={`ow-pill ${i === sel ? 'is-on' : ''}`} onClick={() => { setSel(i); setBlob(null); }}>Variant {i + 1}</button>)}
            </div>
          )}
          <div className="ow-pair">
            <CardPreview designId={cur.designId} data={data} style={style} alt={cur.r.altText} name={fname} text={full} onBlob={setBlob} subject={subject} />
            <div className="ow-tweet">
              <header className="ow-tweet__h">
                <span className="ow-ai">AI-generated — check facts</span>
                {cur.r.fixes.length > 0 && <span className="ow-warn" title={cur.r.fixes.join(', ')}>auto-corrected {cur.r.fixes.length}</span>}
                {cur.r.flagged.length > 0 && <span className="ow-warn" title={cur.r.flagged.join(', ')}>{cur.r.flagged.length} number(s) replaced with live data</span>}
                <span className={`ow-count ${w > 280 ? 'is-over' : ''}`}>{w}/280</span>
              </header>
              <p className="ow-muted">{isMsg ? `Message · ${subject.kind}` : `Subject: ${subject.kind}${subject.id ? ` · ${subject.id}` : ''}`}</p>
              <textarea className="ow-tweet__t" value={cur.tweet} onChange={(e) => upd({ tweet: e.target.value })} rows={5} aria-label="Tweet text" />
              {isMsg && <label className="ow-muted">Card message
                <textarea className="ow-tweet__t" rows={3} value={cur.r.texts.title ?? ''} onChange={(e) => upd({ r: { ...cur.r, texts: { ...cur.r.texts, title: e.target.value } } })} aria-label="Card message" />
              </label>}
              {path && <a className="ow-link" href={SITE + path} target="_blank" rel="noreferrer">{SITE + path}</a>}
              <label className="ow-muted">Design
                <select className="ow-select" value={cur.designId} onChange={(e) => upd({ designId: e.target.value })} aria-label="Card design">
                  {list.map((d) => <option key={d.id} value={d.id}>{d.name} · {d.size.w}×{d.size.h}</option>)}
                </select>
              </label>
              <div className="ow-actions">
                <Button size="sm" onClick={async () => setMsg((await copyText(full)) ? 'Tweet copied' : 'Copy failed')}>Copy tweet</Button>
                <Button size="sm" variant="ghost" href={intentUrl(cur.tweet, path)}>Post on X</Button>
                <Button size="sm" variant="ghost" disabled={!blob} onClick={() => blob && download(blob, `${fname}.png`)}>Download PNG</Button>
                <Button size="sm" variant="ghost" disabled={!blob} onClick={async () => blob && setMsg((await copyImage(blob)) ? 'Image copied' : 'Copy unsupported — download instead')}>Copy image</Button>
                <Button size="sm" variant="ghost" disabled={!blob} onClick={async () => { if (blob && (await shareImage(blob, `${fname}.png`, full)) === 'unsupported') setMsg('Share unsupported here'); }}>Share</Button>
              </div>
              <p className="ow-muted">Alt text: {cur.r.altText}</p>
              {msg && <p className="ow-muted" role="status">{msg}</p>}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
