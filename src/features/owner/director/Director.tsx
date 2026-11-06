// AI Creative Director: brief → 4 concepts (side by side) → self-critique + one auto-refine pass,
// Brand Kit + "learn from my edits", campaign generator (CSV / .ics / ZIP), smart copy tools,
// fact-check gate before posting. Sequential Groq calls with a shared 429 countdown.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../../../components';
import { useLive } from '../../../lib/live';
import { displayTZ, zonedTime } from '../../../components/time';
import { cardDataFor, renderCard, type CardData, type CardKind, type CardStyle } from '../../../lib/cards';
import { STYLE_FONTS, type ComposeResult } from '../../../../shared/compose.js';
import { ADAPT_PLATFORMS, LOGO_PLACEMENTS, PLATFORM_LIMITS, applyFixes, campaignCsv, campaignFile, campaignIcs, sanitizeBrand, type AdaptPlatform, type BrandKit, type Campaign, type CampaignPost, type Concept, type Critique, type Hook } from '../../../../shared/director.js';
import { CardPreview } from '../CardPreview';
import { applyTexts } from '../editorBus';
import { download } from '../cards';
import { copyText, intentUrl } from '../LinkedTweet';
import { pathFor } from '../tweets';
import { loadSettings, studioAi, StudioError } from '../aiStudioApi';
import { makeZip } from '../studio/zip';
import { DESIGNS_ALL, cooldown, director, errText, learnEdit, loadBrand, loadPrefs, onCooldown, saveBrand, savePrefs } from './directorApi';

type Live = ReturnType<typeof useLive>;
function cardFor(r: ComposeResult, live: Live): CardData {
  const s = r.subject;
  if (r.post === 'message') return applyTexts({ kind: s.kind as CardKind, title: '', url: 'poltok.netlify.app' }, r.texts);
  return applyTexts({ ...cardDataFor(s.kind as CardKind, s.id, live), ...r.cardOverrides }, r.texts);
}
const pathOf = (r: ComposeResult) => (r.post === 'message' ? '/' : pathFor(r.subject as Parameters<typeof pathFor>[0]) || '/');
const blobText = (s: string) => new TextEncoder().encode(s);

function useCooldown() {
  const [, tick] = useState(0);
  useEffect(() => onCooldown(() => tick((x) => x + 1)), []);
  return cooldown();
}

/** Textarea that stores the owner's edit as preference notes ("learn from my edits") on blur. */
function EditText({ value, original, onChange, rows = 3, label }: { value: string; original: string; onChange: (v: string) => void; rows?: number; label: string }) {
  const [learned, setLearned] = useState<string[]>([]);
  return (
    <label className="ow-muted">{label}
      <textarea className="ow-tweet__t" rows={rows} value={value} aria-label={label} onChange={(e) => onChange(e.target.value)} onBlur={() => { const n = learnEdit(original, value); if (n.length) setLearned(n); }} />
      {learned.length > 0 && <span className="ow-muted"> Learned: {learned.join('; ')}</span>}
    </label>
  );
}

/** Fact-check gate: post only after the live-data fact-check passes (or the owner overrides). */
interface Fact { verdict: 'ok' | 'issues'; issues: { claim: string; problem: string; evidence?: string; fix?: string }[]; corrected?: string; mismatched?: string[] }
export function FactGate({ text, path = '/', onUse }: { text: string; path?: string; onUse?: (t: string) => void }) {
  const [st, setSt] = useState<'idle' | 'busy' | Fact>('idle');
  const [err, setErr] = useState('');
  useEffect(() => setSt('idle'), [text]);
  const check = async () => {
    setErr('');
    setSt('busy');
    try {
      const r = await studioAi<Fact>('factcheck', { prompt: 'Fact-check this draft post', context: text, settings: loadSettings() });
      setSt(r.result);
      if (r.result.verdict === 'ok' && !r.result.mismatched?.length) window.open(intentUrl(text, path), '_blank', 'noopener');
    } catch (e) {
      setSt('idle');
      setErr((e as StudioError).code === 'rate_limited' ? `Groq free-tier limit — retry in ${(e as StudioError).retryAfter || 30}s.` : errText(e));
    }
  };
  const ok = typeof st === 'object' && st.verdict === 'ok' && !st.mismatched?.length;
  return (
    <div className="dir-gate">
      <div className="ow-actions">
        <Button size="sm" disabled={st === 'busy' || !text.trim()} onClick={check}>{st === 'busy' ? 'Checking facts…' : ok ? 'Fact-checked ✓ — post again' : 'Fact-check & post on X'}</Button>
        <Button size="sm" variant="ghost" onClick={async () => setErr((await copyText(text)) ? 'Copied (not fact-checked)' : 'Copy failed')}>Copy</Button>
      </div>
      {typeof st === 'object' && !ok && (
        <div className="ow-warn" role="alert">
          <strong>Fact-check found issues — not posted.</strong>
          <ul>{st.issues.map((i, k) => <li key={k}>{i.claim}: {i.problem}{i.evidence ? ` (${i.evidence})` : ''}</li>)}{st.mismatched?.length ? <li>Numbers not in live data: {st.mismatched!.join(', ')}</li> : null}</ul>
          <div className="ow-actions">
            {st.corrected && onUse && <Button size="sm" onClick={() => onUse(st.corrected!)}>Use corrected text</Button>}
            <Button size="sm" variant="ghost" href={intentUrl(text, path)}>Post anyway</Button>
          </div>
        </div>
      )}
      {err && <p className="ow-muted" role="status">{err}</p>}
    </div>
  );
}

/* ------------------------------------ Concepts ------------------------------------ */
const AXES = ['hierarchy', 'readability', 'clarity', 'brand', 'factual'] as const;
function Concepts({ live, setErr }: { live: Live; setErr: (s: string) => void }) {
  const [brief, setBrief] = useState('');
  const [busy, setBusy] = useState('');
  const [items, setItems] = useState<{ orig: Concept; cur: Concept; crit?: Critique; showOrig?: boolean }[]>([]);
  const wait = useCooldown();
  const gen = async () => {
    setErr(''); setBusy('Directing 4 concepts…');
    try {
      const r = await director<{ concepts: Concept[] }>('concepts', { prompt: brief, designs: DESIGNS_ALL, n: 4 });
      setItems(r.result.concepts.map((c) => ({ orig: c, cur: c })));
    } catch (e) { setErr(errText(e)); } finally { setBusy(''); }
  };
  const critique = async () => {
    setErr(''); setBusy('Critiquing (contrast, lengths, live facts)…');
    try {
      const r = await director<{ critiques: Critique[] }>('critique', { prompt: brief || 'Critique these concepts', concepts: items.map((x) => x.cur) });
      setItems((xs) => xs.map((x, i) => {
        const crit = r.result.critiques.find((c) => c.i === i);
        return crit ? { ...x, crit, cur: applyFixes(x.cur, crit.fixes, r.facts ?? '') } : x; // one auto-refinement pass
      }));
    } catch (e) { setErr(errText(e)); } finally { setBusy(''); }
  };
  const upd = (i: number, p: Partial<Concept>) => setItems((xs) => xs.map((x, k) => (k === i ? { ...x, cur: { ...x.cur, ...p } } : x)));
  return (
    <section className="ow-make">
      <form className="ow-make__form" onSubmit={(e) => { e.preventDefault(); gen(); }}>
        <label htmlFor="dir-brief"><strong>Creative brief</strong></label>
        <textarea id="dir-brief" value={brief} maxLength={600} onChange={(e) => setBrief(e.target.value)} placeholder="e.g. Victorian election week: make undecided voters check the live seat map" />
        <div className="ow-actions">
          <Button type="submit" size="sm" disabled={!!busy || !brief.trim() || wait > 0}>{busy || (wait ? `Wait ${wait}s` : '4 concepts')}</Button>
          <Button size="sm" variant="ghost" disabled={!!busy || !items.length || wait > 0} onClick={critique}>Critique & auto-refine</Button>
        </div>
        <p className="ow-muted">One call returns 4 distinct concepts (angle, hook, design family, palette mood, typography, layout). Critique scores each on hierarchy, readability (measured contrast + text lengths), clarity, brand fit and facts vs live data, then applies its fixes once.</p>
      </form>
      <div className="dir-concepts">
        {items.map(({ cur, orig, crit, showOrig }, i) => {
          const c = showOrig ? orig : cur;
          const data = cardFor(c, live);
          return (
            <article key={i} className="dir-concept">
              <header><strong>{i + 1}. {c.angle}</strong> <span className="ow-pill">{c.family}</span></header>
              <p className="ow-muted">{[c.paletteMood, c.typography, c.layout].filter(Boolean).join(' · ')}</p>
              {c.hook && <p className="dir-hook">“{c.hook}”</p>}
              <CardPreview designId={c.designId} data={data} style={c.style as CardStyle} alt={c.altText} name={`concept-${i + 1}-${c.designId}`} text={c.tweet} subject={c.subject} />
              {crit && (
                <div className="dir-scores" aria-label={`Scores for concept ${i + 1}`}>
                  {AXES.map((k) => <span key={k} className={`dir-score ${crit.scores[k] < 5 ? 'is-low' : ''}`}>{k} <b>{crit.scores[k]}</b></span>)}
                  <span className="dir-score is-total">total <b>{crit.total}</b></span>
                  <p className="ow-muted">Contrast {crit.metrics.contrast.fgBg}:1 · title {crit.metrics.len.title} chars{crit.metrics.unsupported.length ? ` · unverified numbers ${crit.metrics.unsupported.join(', ')}` : ''}</p>
                  {crit.notes && <p className="ow-muted">{crit.notes}</p>}
                  {crit.fixes.length > 0 && <ul className="ow-muted">{crit.fixes.map((f, k) => <li key={k}>{cur.refined?.includes(f.target) ? '✓' : '✗'} {f.target} → {f.value}{f.why ? ` (${f.why})` : ''}</li>)}</ul>}
                  <button type="button" className="ow-pill" onClick={() => setItems((xs) => xs.map((x, k) => (k === i ? { ...x, showOrig: !x.showOrig } : x)))}>{showOrig ? 'Show refined' : 'Show original'}</button>
                </div>
              )}
              {!showOrig && <>
                <EditText label="Card title" rows={2} value={cur.texts.title ?? ''} original={orig.texts.title ?? ''} onChange={(v) => upd(i, { texts: { ...cur.texts, title: v } })} />
                <EditText label="Post text" value={cur.tweet} original={orig.tweet} onChange={(v) => upd(i, { tweet: v })} />
                <FactGate text={cur.tweet} path={pathOf(cur)} onUse={(t) => upd(i, { tweet: t })} />
              </>}
            </article>
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------------------ Campaign ------------------------------------ */
function Campaigns({ live, setErr }: { live: Live; setErr: (s: string) => void }) {
  const [goal, setGoal] = useState('');
  const [n, setN] = useState(10);
  const [busy, setBusy] = useState('');
  const [camp, setCamp] = useState<Campaign | null>(null);
  const [orig, setOrig] = useState<CampaignPost[]>([]);
  const [open, setOpen] = useState(-1);
  const wait = useCooldown();
  const tz = displayTZ();
  const withAt = (ps: CampaignPost[]) => ps.map((p) => ({ ...p, at: zonedTime(p.date, p.time, tz) }));
  const gen = async () => {
    setErr(''); setBusy('Planning campaign…');
    try {
      const r = await director<Campaign>('campaign', { prompt: goal, designs: DESIGNS_ALL, n });
      setCamp(r.result); setOrig(r.result.posts);
    } catch (e) { setErr(errText(e)); } finally { setBusy(''); }
  };
  const upd = (i: number, p: Partial<CampaignPost>) => setCamp((c) => c && { ...c, posts: c.posts.map((x, k) => (k === i ? { ...x, ...p } : x)) });
  const slug = (camp?.name || 'campaign').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  const zipAll = async () => {
    if (!camp) return;
    const entries: { name: string; data: Uint8Array }[] = [];
    const manifest = [];
    for (let i = 0; i < camp.posts.length; i++) {
      const p = camp.posts[i];
      setBusy(`Rendering ${i + 1}/${camp.posts.length}…`);
      const file = campaignFile(p, i);
      try {
        const b = await renderCard(p.concept.designId, cardFor(p.concept, live), p.concept.style as CardStyle);
        entries.push({ name: file, data: new Uint8Array(await b.arrayBuffer()) });
        manifest.push({ file, date: p.date, time: p.time, timeZone: tz, type: p.type, tweet: p.tweet, options: p.options, altText: p.altText, designId: p.concept.designId, subject: p.concept.subject, notes: p.notes });
      } catch { manifest.push({ file: null, error: 'render failed', date: p.date, time: p.time, tweet: p.tweet }); }
    }
    entries.push({ name: 'manifest.json', data: blobText(JSON.stringify({ name: camp.name, summary: camp.summary, timeZone: tz, generated: new Date().toISOString(), posts: manifest }, null, 2)) });
    entries.push({ name: 'campaign.csv', data: blobText(campaignCsv(camp.posts, tz)) });
    entries.push({ name: 'campaign.ics', data: blobText(campaignIcs(withAt(camp.posts), camp.name)) });
    download(makeZip(entries), `${slug}.zip`);
    setBusy('');
  };
  return (
    <section className="ow-make">
      <form className="ow-make__form" onSubmit={(e) => { e.preventDefault(); gen(); }}>
        <label htmlFor="dir-goal"><strong>Campaign goal</strong></label>
        <textarea id="dir-goal" value={goal} maxLength={600} onChange={(e) => setGoal(e.target.value)} placeholder="e.g. Grow followers during Victorian election week" />
        <label className="ow-muted">Posts: {n} <input type="range" min={7} max={14} value={n} onChange={(e) => setN(Number(e.target.value))} /></label>
        <div className="ow-actions"><Button type="submit" size="sm" disabled={!!busy || !goal.trim() || wait > 0}>{busy || (wait ? `Wait ${wait}s` : 'Generate campaign')}</Button></div>
        <p className="ow-muted">Scheduled in your Settings time zone ({tz}). Mix of data, message, thread, poll and countdown posts.</p>
      </form>
      {camp && (
        <>
          <h3>{camp.name}</h3>
          {camp.summary && <p className="ow-muted">{camp.summary}</p>}
          <div className="ow-actions">
            <Button size="sm" variant="ghost" onClick={() => download(new Blob([campaignCsv(camp.posts, tz)], { type: 'text/csv' }), `${slug}.csv`)}>Export CSV</Button>
            <Button size="sm" variant="ghost" onClick={() => download(new Blob([campaignIcs(withAt(camp.posts), camp.name)], { type: 'text/calendar' }), `${slug}.ics`)}>Export .ics</Button>
            <Button size="sm" disabled={!!busy} onClick={zipAll}>{busy.startsWith('Render') ? busy : 'Render all cards → ZIP'}</Button>
          </div>
          <ol className="dir-camp">
            {camp.posts.map((p, i) => (
              <li key={i}>
                <div className="dir-camp__h">
                  <strong>{p.date} {p.time}</strong> <span className="ow-pill">{p.type}</span> <span className="ow-muted">{p.concept.designId} · {p.concept.subject.kind}{p.concept.subject.id ? `:${p.concept.subject.id}` : ''}</span>
                  {p.fixes.length > 0 && <span className="ow-warn" title={p.fixes.join(', ')}> {p.fixes.length} auto-fix</span>}
                  <button type="button" className="ow-pill" onClick={() => setOpen(open === i ? -1 : i)}>{open === i ? 'Hide card' : 'Card'}</button>
                </div>
                <div className="dir-camp__when">
                  <input type="date" value={p.date} aria-label="Date" onChange={(e) => upd(i, { date: e.target.value })} />
                  <input type="time" value={p.time} aria-label="Time" onChange={(e) => upd(i, { time: e.target.value })} />
                </div>
                <EditText label="Post text" rows={2} value={p.tweet} original={orig[i]?.tweet ?? ''} onChange={(v) => upd(i, { tweet: v })} />
                {p.type === 'poll' && <p className="ow-muted">Poll: {p.options.join(' / ')}</p>}
                <p className="ow-muted">Alt: {p.altText}{p.notes ? ` · Tip: ${p.notes}` : ''}</p>
                {open === i && <>
                  <CardPreview designId={p.concept.designId} data={cardFor(p.concept, live)} style={p.concept.style as CardStyle} alt={p.altText} name={campaignFile(p, i).replace(/\.png$/, '')} text={p.tweet} subject={p.concept.subject} />
                  <FactGate text={p.tweet} path={pathOf(p.concept)} onUse={(t) => upd(i, { tweet: t })} />
                </>}
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}

/* ------------------------------------ Copy tools ------------------------------------ */
function CopyTools({ setErr }: { setErr: (s: string) => void }) {
  const [idea, setIdea] = useState('');
  const [busy, setBusy] = useState('');
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [terms, setTerms] = useState<{ term: string; tag: string; count: number }[]>([]);
  const [pls, setPls] = useState<AdaptPlatform[]>(['x', 'threads', 'bluesky', 'linkedin', 'instagram', 'tiktok']);
  const [posts, setPosts] = useState<Partial<Record<AdaptPlatform, string>>>({});
  const [orig, setOrig] = useState<Partial<Record<AdaptPlatform, string>>>({});
  const [tone, setTone] = useState({ playful: 30, casual: 40 });
  const wait = useCooldown();
  const toneT = useRef<ReturnType<typeof setTimeout>>();
  const runHooks = async () => {
    setErr(''); setBusy('Ranking hooks…');
    try { const r = await director<{ hooks: Hook[]; hashtags: string[] }>('hooks2', { prompt: idea }); setHooks(r.result.hooks); setTags(r.result.hashtags); setTerms(r.terms ?? []); } catch (e) { setErr(errText(e)); } finally { setBusy(''); }
  };
  const adapt = async (t = tone) => {
    if (!idea.trim() || !pls.length) return;
    setErr(''); setBusy('Adapting…');
    try { const r = await director<{ posts: Record<AdaptPlatform, string>; hashtags: string[] }>('adapt', { prompt: idea, platforms: pls, tone: t }); setPosts(r.result.posts); setOrig(r.result.posts); setTerms(r.terms ?? terms); if (r.result.hashtags.length) setTags(r.result.hashtags); } catch (e) { setErr(errText(e)); } finally { setBusy(''); }
  };
  // Tone sliders re-write live (debounced; skipped while rate-limited or busy).
  const onTone = (k: 'playful' | 'casual', v: number) => {
    const t = { ...tone, [k]: v };
    setTone(t);
    clearTimeout(toneT.current);
    if (Object.keys(posts).length) toneT.current = setTimeout(() => { if (!cooldown()) adapt(t); }, 1200);
  };
  return (
    <section className="ow-make">
      <form className="ow-make__form" onSubmit={(e) => { e.preventDefault(); adapt(); }}>
        <label htmlFor="dir-idea"><strong>One idea</strong></label>
        <textarea id="dir-idea" value={idea} maxLength={600} onChange={(e) => setIdea(e.target.value)} placeholder="e.g. Our live Victorian seat map updates every minute on election night" />
        <div className="ow-filter" aria-label="Platforms">
          {ADAPT_PLATFORMS.map((p) => <button key={p} type="button" aria-pressed={pls.includes(p)} className={`ow-pill ${pls.includes(p) ? 'is-on' : ''}`} onClick={() => setPls((x) => (x.includes(p) ? x.filter((y) => y !== p) : [...x, p]))}>{p}</button>)}
        </div>
        <label className="ow-muted">Serious ↔ playful <input type="range" min={0} max={100} value={tone.playful} onChange={(e) => onTone('playful', Number(e.target.value))} /></label>
        <label className="ow-muted">Formal ↔ casual <input type="range" min={0} max={100} value={tone.casual} onChange={(e) => onTone('casual', Number(e.target.value))} /></label>
        <div className="ow-actions">
          <Button type="submit" size="sm" disabled={!!busy || !idea.trim() || !pls.length || wait > 0}>{busy || (wait ? `Wait ${wait}s` : 'Adapt for platforms')}</Button>
          <Button size="sm" variant="ghost" disabled={!!busy || !idea.trim() || wait > 0} onClick={runHooks}>5 ranked hooks</Button>
        </div>
      </form>
      {hooks.length > 0 && <ol className="dir-hooks">{hooks.map((h, i) => <li key={i}><b>{h.score}</b> {h.text} <span className="ow-muted">{h.technique}{h.why ? ` — ${h.why}` : ''}</span> <button type="button" className="ow-pill" onClick={() => setIdea(h.text)}>Use</button></li>)}</ol>}
      {(tags.length > 0 || terms.length > 0) && (
        <div><strong>Hashtags from live news</strong>
          <div className="ow-filter">{[...new Set([...tags, ...terms.map((t) => t.tag)])].map((t) => <button key={t} type="button" className="ow-pill" onClick={() => copyText(t)} title={terms.find((x) => x.tag === t) ? `${terms.find((x) => x.tag === t)!.count} headline(s)` : 'Brand / grounded'}>{t}</button>)}</div>
          <p className="ow-muted">Only terms that appear in current headlines or your Brand Kit — no invented trends.</p>
        </div>
      )}
      <div className="dir-concepts">
        {(Object.keys(posts) as AdaptPlatform[]).map((p) => {
          const t = posts[p] ?? '';
          const n = [...t].length;
          return (
            <article key={p} className="dir-concept">
              <header><strong>{p}</strong> <span className={`ow-count ${n > PLATFORM_LIMITS[p] ? 'is-over' : ''}`}>{n}/{PLATFORM_LIMITS[p]}</span></header>
              <EditText label={`${p} text`} rows={p === 'linkedin' || p === 'instagram' ? 7 : 4} value={t} original={orig[p] ?? ''} onChange={(v) => setPosts((x) => ({ ...x, [p]: v }))} />
              {p === 'x' ? <FactGate text={t} onUse={(v) => setPosts((x) => ({ ...x, x: v }))} /> : <Button size="sm" variant="ghost" onClick={() => copyText(t)}>Copy</Button>}
            </article>
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------------------ Brand Kit ------------------------------------ */
function BrandPanel() {
  const [b, setB] = useState<BrandKit>(loadBrand);
  const [prefs, setPrefs] = useState(loadPrefs);
  const [msg, setMsg] = useState('');
  const list = (v: string[]) => v.join(', ');
  const split = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
  const set = (p: Partial<BrandKit>) => setB((x) => ({ ...x, ...p }));
  return (
    <section className="ow-make__form dir-brand">
      <p className="ow-muted">Saved in this browser and injected compactly into every Director call.</p>
      <label>Name <input className="ow-input" value={b.name} onChange={(e) => set({ name: e.target.value })} /></label>
      <label>Voice <input className="ow-input" value={b.voice} maxLength={200} onChange={(e) => set({ voice: e.target.value })} placeholder="calm, precise, a little dry" /></label>
      <label>Palette (bg, fg, accent…)
        <span className="ow-filter">{[0, 1, 2, 3, 4].map((i) => <input key={i} type="color" aria-label={`Palette colour ${i + 1}`} value={b.palette[i] ?? '#000000'} onChange={(e) => { const p = [...b.palette]; p[i] = e.target.value; set({ palette: p.map((c) => c ?? '#000000') }); }} />)}
          <button type="button" className="ow-pill" onClick={() => set({ palette: [] })}>Clear</button></span>
      </label>
      <label>Fonts (display, body)
        <span className="ow-filter">{[0, 1].map((i) => <select key={i} className="ow-select" value={b.fonts[i] ?? ''} onChange={(e) => { const f = [...b.fonts]; f[i] = e.target.value; set({ fonts: f.filter(Boolean) }); }}><option value="">Design default</option>{STYLE_FONTS.map((f) => <option key={f}>{f}</option>)}</select>)}</span>
      </label>
      <label>Logo placement <select className="ow-select" value={b.logo} onChange={(e) => set({ logo: e.target.value as BrandKit['logo'] })}>{LOGO_PLACEMENTS.map((l) => <option key={l}>{l}</option>)}</select></label>
      <label>Do words <input className="ow-input" value={list(b.dos)} onChange={(e) => set({ dos: split(e.target.value) })} /></label>
      <label>Don't words <input className="ow-input" value={list(b.donts)} onChange={(e) => set({ donts: split(e.target.value) })} /></label>
      <label>Hashtags <input className="ow-input" value={list(b.hashtags)} onChange={(e) => set({ hashtags: split(e.target.value) })} /></label>
      <label>CTA <input className="ow-input" value={b.cta} maxLength={60} onChange={(e) => set({ cta: e.target.value })} /></label>
      <div className="ow-actions"><Button size="sm" onClick={() => { const s = sanitizeBrand(b); saveBrand(s); setB(s); setMsg('Brand Kit saved'); }}>Save Brand Kit</Button></div>
      {msg && <p className="ow-muted" role="status">{msg}</p>}
      <h4>Learned from your edits ({prefs.length})</h4>
      {prefs.length ? <ul>{prefs.map((p, i) => <li key={i}>{p.note} <button type="button" className="ow-pill" onClick={() => { const n = prefs.filter((_, k) => k !== i); savePrefs(n); setPrefs(n); }}>Forget</button></li>)}</ul> : <p className="ow-muted">Edit any AI text (then click away) and PolTok learns your preferences.</p>}
      {prefs.length > 0 && <Button size="sm" variant="ghost" onClick={() => { savePrefs([]); setPrefs([]); }}>Forget all</Button>}
    </section>
  );
}

type Tab = 'concepts' | 'campaign' | 'copy' | 'brand';
export function Director() {
  const live = useLive();
  const [tab, setTab] = useState<Tab>('concepts');
  const [err, setErr] = useState('');
  const wait = useCooldown();
  const tabs = useMemo<[Tab, string][]>(() => [['concepts', 'Concepts'], ['campaign', 'Campaign'], ['copy', 'Copy tools'], ['brand', 'Brand Kit']], []);
  return (
    <section className="ow-studio dir">
      <header className="ow-studio__h">
        <div className="ow-filter" role="tablist" aria-label="Creative director">
          {tabs.map(([id, l]) => <button key={id} type="button" role="tab" aria-selected={tab === id} className={`ow-pill ${tab === id ? 'is-on' : ''}`} onClick={() => setTab(id)}>{l}</button>)}
        </div>
        {wait > 0 && <p className="ow-warn" aria-live="polite">Groq free-tier limit — next call in {wait}s.</p>}
        {err && !wait && <p className="ow-err" role="alert">{err}</p>}
      </header>
      {tab === 'concepts' && <Concepts live={live} setErr={setErr} />}
      {tab === 'campaign' && <Campaigns live={live} setErr={setErr} />}
      {tab === 'copy' && <CopyTools setErr={setErr} />}
      {tab === 'brand' && <BrandPanel />}
      <p className="ow-muted">AI-written words only — card numbers come from the live feed, posts pass a live-data fact-check before posting, and hashtags come from current headlines. One Groq call at a time (free tier).</p>
    </section>
  );
}
