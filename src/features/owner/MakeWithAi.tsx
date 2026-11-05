import { useMemo, useState } from 'react';
import { Button } from '../../components';
import { useLive } from '../../lib/live';
import { AiError, composeAi, type ComposeDesign } from '../../lib/ai';
import { raceById } from '../../data';
import { VICTORIA, FEDERAL } from '../../data/au';
import { validateCompose, type ComposeResult } from '../../../shared/compose.js';
import { copyImage, designsForKind, download, shareImage, type Design } from './cards';
import { useDesigns } from './TweetKit';
import { ImagePanel } from './ImagePanel';
import { SITE, pathFor } from './tweets';
import { copyText, intentUrl, xWeight } from './LinkedTweet';

const IDEAS = [
  'Post about the Texas Senate race, comic style',
  'Victoria countdown, story size',
  'Senate balance of power, broadcast style',
  'Biggest flip of the night, breaking news',
  'Most marginal federal seat in Australia',
  'How many races are called so far, big number',
];
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

interface Draft { r: ComposeResult; tweet: string; designId: string }

export function MakeWithAi() {
  const live = useLive();
  const ds = useDesigns();
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [sel, setSel] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [msg, setMsg] = useState('');
  const designs: ComposeDesign[] = useMemo(
    () => (ds?.designs ?? []).map((d) => ({ id: d.id, name: d.name, kinds: (d.tags ?? []).filter((t) => ['race', 'balance', 'au-seat', 'promo', 'stat', 'flip', 'quote'].includes(t)), w: d.w, h: d.h })),
    [ds],
  );
  const validId = (kind: string, id: string) => {
    if (kind === 'race' || kind === 'flip') return raceById.has(id);
    if (kind === 'au-seat') return AU_IDS.has(id);
    if (kind === 'quote') return live.news.some((n) => n.id === id);
    return (IDS[kind] ?? []).includes(id);
  };
  const toDraft = (raw: unknown): Draft => {
    const r = validateCompose(raw, designs, { validId });
    return { r, tweet: r.tweet, designId: r.designId };
  };
  const one = (q: string, temperature: number) => composeAi({ prompt: q, designs, temperature }).then(toDraft);

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
  const path = subject ? pathFor(subject) : '';
  const full = cur ? `${cur.tweet}\n${SITE}${path}` : '';
  const w = cur ? xWeight(cur.tweet) : 0;
  const list: Design[] = ds && subject ? designsForKind(ds.designs, subject.kind) : [];
  const fname = subject ? `poltok-${cur.designId}-${subject.kind}-${subject.id || 'auto'}`.replace(/[^a-z0-9-]+/gi, '-') : 'poltok';

  return (
    <section className="ow-make">
      <form className="ow-make__form" onSubmit={(e) => { e.preventDefault(); run(); }}>
        <label htmlFor="ow-make-q"><strong>Describe the post</strong></label>
        <textarea id="ow-make-q" value={prompt} maxLength={600} onChange={(e) => setPrompt(e.target.value)} placeholder={'e.g. Post about the Texas Senate upset, comic style\nor: Victoria countdown, story size'} onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) run(); }} />
        <div className="ow-filter" aria-label="Quick ideas">
          {IDEAS.map((i) => <button key={i} type="button" className="ow-pill" disabled={!!busy} onClick={() => run(i)}>{i}</button>)}
        </div>
        <div className="ow-actions">
          <Button type="submit" size="sm" disabled={!!busy || !prompt.trim() || !ds}>{busy || 'Make it'}</Button>
          <Button size="sm" variant="ghost" disabled={!!busy || !prompt.trim() || !ds} onClick={() => run(prompt, 3)}>3 variants</Button>
          {cur && <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => run(prompt, 1)}>Regenerate</Button>}
        </div>
        <p className="ow-muted">AI picks the subject, design and wording from live data; every number on the card comes from the live feed. Free-tier limited — about 8 requests a minute.</p>
        {err && <p className="ow-err" role="alert">{err}</p>}
      </form>

      {cur && subject && (
        <>
          {drafts.length > 1 && (
            <div className="ow-variants" role="tablist" aria-label="Variants">
              {drafts.map((d, i) => <button key={i} type="button" role="tab" aria-selected={i === sel} className={`ow-pill ${i === sel ? 'is-on' : ''}`} onClick={() => { setSel(i); setBlob(null); }}>Variant {i + 1}</button>)}
            </div>
          )}
          <div className="ow-pair">
            <ImagePanel designId={cur.designId} subject={subject} overrides={cur.r.cardOverrides} alt={cur.r.altText} name={fname} text={full} onBlob={setBlob} noActions />
            <div className="ow-tweet">
              <header className="ow-tweet__h">
                <span className="ow-ai">AI-generated — check facts</span>
                {cur.r.fixes.length > 0 && <span className="ow-warn" title={cur.r.fixes.join(', ')}>auto-corrected {cur.r.fixes.length}</span>}
                <span className={`ow-count ${w > 280 ? 'is-over' : ''}`}>{w}/280</span>
              </header>
              <p className="ow-muted">Subject: {subject.kind}{subject.id ? ` · ${subject.id}` : ''}</p>
              <textarea className="ow-tweet__t" value={cur.tweet} onChange={(e) => upd({ tweet: e.target.value })} rows={6} aria-label="Tweet text" />
              <a className="ow-link" href={SITE + path} target="_blank" rel="noreferrer">{SITE + path}</a>
              <label className="ow-muted">Design
                <select className="ow-select" value={cur.designId} onChange={(e) => upd({ designId: e.target.value })} aria-label="Card design">
                  {list.map((d) => <option key={d.id} value={d.id}>{d.name}{d.w ? ` · ${d.w}×${d.h}` : ''}</option>)}
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
