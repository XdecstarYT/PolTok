import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button } from '../../components';
import { useLive } from '../../lib/live';
import { raceById } from '../../data';
import { VICTORIA, FEDERAL } from '../../data/au';
import { LANGS, STUDIO_N, VOICES, sanitizeSettings, type StudioMode, type StudioSettings } from '../../../shared/compose.js';
import { cardData, designsForKind, download, type Subject } from './cards';
import { useDesigns } from './TweetKit';
import { ImagePanel } from './ImagePanel';
import { pathFor } from './tweets';
import { copyText, intentUrl, xWeight } from './LinkedTweet';
import { StudioError, draftsCsv, fetchModels, loadDrafts, loadSettings, onUsage, saveDrafts, saveSettings, studioAi, usage, type DraftStatus, type StudioDraft } from './aiStudioApi';

/* ------------------------------------ shared studio state ------------------------------------ */
interface Fact { verdict: 'ok' | 'issues'; issues: { claim: string; problem: string; evidence: string; fix: string }[]; corrected: string; mismatched: string[]; correctedUnverified: string[] }
interface Ctx {
  settings: StudioSettings;
  run: <T>(mode: StudioMode, o: { prompt: string; context?: string; n?: number }) => Promise<T | null>;
  busy: string;
  wait: number;
  err: string;
  addDraft: (text: string, source: string, subject?: Subject | null) => void;
}
const StudioCtx = createContext<Ctx | null>(null);
const useStudio = () => useContext(StudioCtx)!;

const AU_IDS = new Set([...VICTORIA.seats, ...FEDERAL.seats].map((s) => s.id));
const FIXED: Record<string, string[]> = { balance: ['senate', 'house'], promo: ['default', 'live', 'map', 'au', 'vic-countdown', 'swingometer'], stat: ['calls', 'flips', 'senate', 'house', 'au-marginal'] };
function validSubject(s: Subject | null | undefined): Subject | null {
  if (!s) return null;
  if (s.kind === 'race' || s.kind === 'flip') return raceById.has(s.id) ? s : null;
  if (s.kind === 'au-seat') return AU_IDS.has(s.id) ? s : null;
  if (s.kind === 'quote') return null;
  return (FIXED[s.kind] ?? []).includes(s.id) ? s : null;
}
function parseSubject(t: string): Subject | null {
  const m = t.trim().match(/^(race|balance|au-seat|promo|stat|flip):(\S+)$/);
  if (m) return validSubject({ kind: m[1] as Subject['kind'], id: m[2] });
  const up = t.trim().toUpperCase();
  if (raceById.has(up)) return { kind: 'race', id: up };
  const low = t.trim().toLowerCase();
  return AU_IDS.has(low) ? { kind: 'au-seat', id: low } : null;
}

/* ------------------------------------------- pieces ------------------------------------------- */
/** Text with flagged numbers highlighted. */
function Highlight({ text, bad }: { text: string; bad: string[] }) {
  if (!bad.length) return <>{text}</>;
  const parts = text.split(/(\d[\d,]*(?:\.\d+)?)/g);
  return <>{parts.map((p, i) => (bad.includes(p.replace(/,/g, '')) ? <mark key={i} className="ow-bad" title="Not found in live data">{p}</mark> : <span key={i}>{p}</span>))}</>;
}

/** Editable post card: text, linked card image, fact-check gate, Post on X, save as draft. */
export function PostCard({ text: initial, subject, source, label }: { text: string; subject?: Subject | null; source: string; label?: string }) {
  const { run, busy, wait, addDraft, settings } = useStudio();
  const ds = useDesigns();
  const [text, setText] = useState(initial);
  const [fact, setFact] = useState<Fact | null>(null);
  const [checkedText, setCheckedText] = useState('');
  const [msg, setMsg] = useState('');
  const subj = validSubject(subject);
  const [designId, setDesignId] = useState('');
  const list = ds && subj ? designsForKind(ds.designs, subj.kind) : [];
  const design = designId || list[0]?.id || '';
  const path = subj ? pathFor(subj) : settings.link ? '/live' : '';
  const w = xWeight(text, !!path);
  const ok = checkedText === text && fact?.verdict === 'ok';
  const check = async () => {
    setMsg('');
    const r = await run<Fact>('factcheck', { prompt: 'Fact-check this draft tweet', context: text });
    if (r) {
      setFact(r);
      setCheckedText(text);
    }
  };
  return (
    <article className="ow-tweet ow-card">
      <header className="ow-tweet__h">
        {label && <strong>{label}</strong>}
        <span className="ow-ai">AI — check facts</span>
        {checkedText === text && fact && <span className={fact.verdict === 'ok' ? 'ow-okb' : 'ow-warn'}>{fact.verdict === 'ok' ? 'fact-check passed' : `${fact.issues.length + fact.mismatched.length} issue(s)`}</span>}
        <span className={`ow-count ${w > 280 ? 'is-over' : ''}`}>{w}/280</span>
      </header>
      {subj && ds && design && (
        <div className="ow-card__img">
          <ImagePanel designId={design} subject={subj} name={`poltok-${design}-${subj.kind}-${subj.id}`} text={text} />
          <select className="ow-select" value={design} onChange={(e) => setDesignId(e.target.value)} aria-label="Card design">
            {list.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      )}
      <textarea className="ow-tweet__t" value={text} onChange={(e) => setText(e.target.value)} rows={4} aria-label="Post text" />
      {subj && <p className="ow-muted">Card: {subj.kind} · {subj.id}</p>}
      {fact && checkedText === text && fact.verdict === 'issues' && (
        <div className="ow-fact" role="alert">
          <p className="ow-muted">Draft with unverified numbers highlighted:</p>
          <p className="ow-fact__t"><Highlight text={text} bad={fact.mismatched} /></p>
          <ul>{fact.issues.map((i, k) => <li key={k}><strong>{i.claim}</strong> — {i.problem}{i.evidence && <><br /><span className="ow-muted">Evidence: {i.evidence}</span></>}</li>)}</ul>
          {fact.corrected && fact.corrected !== text && (
            <>
              <p className="ow-muted">Suggested correction{fact.correctedUnverified.length ? ' (still has unverified numbers)' : ''}:</p>
              <p className="ow-fact__t"><Highlight text={fact.corrected} bad={fact.correctedUnverified} /></p>
              <Button size="sm" variant="ghost" onClick={() => setText(fact.corrected)}>Use correction</Button>
            </>
          )}
        </div>
      )}
      <div className="ow-actions">
        {ok ? <Button size="sm" href={intentUrl(text, path)}>Post on X ✓</Button> : <Button size="sm" disabled={!!busy || wait > 0 || !text.trim()} onClick={check}>Fact-check, then post</Button>}
        {fact && checkedText === text && !ok && <Button size="sm" variant="ghost" href={intentUrl(text, path)}>Post anyway</Button>}
        <Button size="sm" variant="ghost" onClick={async () => setMsg((await copyText(path ? `${text}\nhttps://poltok.netlify.app${path}` : text)) ? 'Copied' : 'Copy failed')}>Copy</Button>
        <Button size="sm" variant="ghost" onClick={() => { addDraft(text, source, subj); setMsg('Saved to drafts'); }}>Save draft</Button>
      </div>
      {msg && <p className="ow-muted" role="status">{msg}</p>}
    </article>
  );
}

function ToolForm({ mode, placeholder, ideas, withContext, contextLabel, nLabel, onResult }: { mode: StudioMode; placeholder: string; ideas?: string[]; withContext?: boolean; contextLabel?: string; nLabel?: string; onResult: (r: Record<string, unknown>) => void }) {
  const { run, busy, wait } = useStudio();
  const range = STUDIO_N[mode];
  const [q, setQ] = useState('');
  const [ctx, setCtx] = useState('');
  const [n, setN] = useState(range?.[2] ?? 0);
  const go = async (prompt = q) => {
    if (!prompt.trim()) return;
    setQ(prompt);
    const r = await run<Record<string, unknown>>(mode, { prompt, context: withContext ? ctx : undefined, n: range ? n : undefined });
    if (r) onResult(r);
  };
  return (
    <form className="ow-make__form" onSubmit={(e) => { e.preventDefault(); go(); }}>
      <textarea value={q} maxLength={600} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} rows={2} aria-label="Topic" />
      {withContext && <textarea value={ctx} maxLength={1800} onChange={(e) => setCtx(e.target.value)} placeholder={contextLabel} rows={4} aria-label={contextLabel} />}
      {ideas && <div className="ow-filter">{ideas.map((i) => <button key={i} type="button" className="ow-pill" disabled={!!busy || wait > 0} onClick={() => go(i)}>{i}</button>)}</div>}
      <div className="ow-actions">
        {range && <label className="ow-muted">{nLabel ?? 'Count'} <input type="number" min={range[0]} max={range[1]} value={n} onChange={(e) => setN(Number(e.target.value))} className="ow-num" /></label>}
        <Button type="submit" size="sm" disabled={!!busy || wait > 0 || !q.trim()}>{wait > 0 ? `Wait ${wait}s` : busy || 'Generate'}</Button>
      </div>
    </form>
  );
}

/* -------------------------------------------- tools -------------------------------------------- */
type R = Record<string, unknown>;
const subj = (r: R) => (r.subject as Subject | null) ?? null;

function ThreadTool() {
  const { addDraft } = useStudio();
  const [r, setR] = useState<R | null>(null);
  const tweets = (r?.tweets as string[]) ?? [];
  return (
    <>
      <ToolForm mode="thread" placeholder="Thread topic, e.g. How the Senate could flip tonight" nLabel="Posts" ideas={['Where the Senate stands right now', 'Five races still too close to call', 'Victoria election: the seats to watch']} onResult={setR} />
      {tweets.length > 0 && <div className="ow-actions"><Button size="sm" variant="ghost" onClick={() => addDraft(tweets.join('\n\n'), 'thread', subj(r!))}>Save whole thread as draft</Button></div>}
      <div className="ow-stack">{tweets.map((t, i) => <PostCard key={`${t}-${i}`} text={t} subject={i === 0 ? subj(r!) : null} source="thread" label={`${i + 1}/${tweets.length}`} />)}</div>
    </>
  );
}
function CalendarTool() {
  const [r, setR] = useState<R | null>(null);
  const days = (r?.days as { date: string; theme: string; posts: { idea: string; tweet: string; subject: Subject | null }[] }[]) ?? [];
  return (
    <>
      <ToolForm mode="calendar" placeholder="Focus for the week, e.g. Post-election count + Victoria campaign" ideas={['Midterms count week', 'Australian politics week', 'Mixed US + AU week']} onResult={setR} />
      {days.map((d, i) => (
        <section key={i} className="ow-day">
          <h3 className="ow-h3">{d.date || `Day ${i + 1}`} · {d.theme}</h3>
          <div className="ow-grid">{d.posts.map((p, k) => <div key={k}><p className="ow-muted">{p.idea}</p><PostCard text={p.tweet || p.idea} subject={p.subject} source="calendar" /></div>)}</div>
        </section>
      ))}
    </>
  );
}
function ListTool({ mode, field, placeholder, ideas, withContext, contextLabel, nLabel }: { mode: StudioMode; field: string; placeholder: string; ideas?: string[]; withContext?: boolean; contextLabel?: string; nLabel?: string }) {
  const [r, setR] = useState<R | null>(null);
  const items = ((r?.[field] as unknown[]) ?? []).map((x) => (typeof x === 'string' ? { text: x } : { text: String((x as R).tweet ?? (x as R).text ?? ''), note: String((x as R).angle ?? (x as R).tone ?? '') }));
  return (
    <>
      <ToolForm mode={mode} placeholder={placeholder} ideas={ideas} withContext={withContext} contextLabel={contextLabel} nLabel={nLabel} onResult={setR} />
      <div className="ow-grid">{items.map((it, i) => <PostCard key={`${it.text}-${i}`} text={it.text} subject={r ? subj(r) : null} source={mode} label={(it as { note?: string }).note || `Option ${i + 1}`} />)}</div>
    </>
  );
}
function HashtagTool() {
  const [r, setR] = useState<R | null>(null);
  const [msg, setMsg] = useState('');
  const tags = (r?.hashtags as string[]) ?? [];
  return (
    <>
      <ToolForm mode="hashtags" placeholder="Topic for hashtags" ideas={['Texas Senate race', 'Victorian state election', 'Balance of power']} onResult={setR} />
      {tags.length > 0 && <div className="ow-filter">{tags.map((t) => <button key={t} type="button" className="ow-pill" onClick={async () => setMsg((await copyText(t)) ? `Copied ${t}` : '')}>{t}</button>)}<Button size="sm" variant="ghost" onClick={async () => setMsg((await copyText(tags.join(' '))) ? 'Copied all' : '')}>Copy all</Button></div>}
      {msg && <p className="ow-muted" role="status">{msg}</p>}
    </>
  );
}
function ExplainTool() {
  const [r, setR] = useState<R | null>(null);
  return (
    <>
      <ToolForm mode="explain" placeholder="Race or seat id, e.g. GA-SEN, PA-07 or kooyong" ideas={['GA-SEN', 'TX-SEN', 'kooyong']} onResult={(x) => setR(x)} />
      {r && (
        <div className="ow-pair">
          <PostCard text={String(r.post)} subject={subj(r)} source="explain" label="Explainer" />
          <ul className="ow-tweet">{((r.bullets as string[]) ?? []).map((b, i) => <li key={i}>{b}</li>)}</ul>
        </div>
      )}
    </>
  );
}
function FactTool() {
  const { run, busy, wait } = useStudio();
  const [draft, setDraft] = useState('');
  const [r, setR] = useState<(Fact & { facts?: string }) | null>(null);
  return (
    <>
      <form className="ow-make__form" onSubmit={async (e) => { e.preventDefault(); const x = await run<Fact>('factcheck', { prompt: 'Fact-check this draft tweet', context: draft }); if (x) setR(x); }}>
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={1800} rows={4} placeholder="Paste a draft tweet to check against live data" aria-label="Draft tweet" />
        <div className="ow-actions"><Button type="submit" size="sm" disabled={!!busy || wait > 0 || !draft.trim()}>{wait > 0 ? `Wait ${wait}s` : busy || 'Fact-check'}</Button></div>
      </form>
      {r && (
        <div className="ow-tweet">
          <strong className={r.verdict === 'ok' ? 'ow-okb' : 'ow-warn'}>{r.verdict === 'ok' ? 'No issues found against live data' : 'Issues found'}</strong>
          <p className="ow-fact__t"><Highlight text={draft} bad={r.mismatched} /></p>
          {r.mismatched.length > 0 && <p className="ow-muted">Numbers not found in retrieved live data: {r.mismatched.join(', ')}</p>}
          <ul>{r.issues.map((i, k) => <li key={k}><strong>{i.claim}</strong> — {i.problem}{i.evidence && <><br /><span className="ow-muted">Evidence: {i.evidence}</span></>}{i.fix && <><br />Fix: {i.fix}</>}</li>)}</ul>
          {r.corrected && <PostCard key={r.corrected} text={r.corrected} source="factcheck" label="Corrected version" />}
        </div>
      )}
    </>
  );
}
function AltTool() {
  const live = useLive();
  const { run, busy, wait } = useStudio();
  const [ref, setRef] = useState('balance:senate');
  const [r, setR] = useState<R | null>(null);
  const [err, setErr] = useState('');
  const s = parseSubject(ref);
  const go = async () => {
    setErr('');
    if (!s) return setErr('Unknown subject — use e.g. race:TX-SEN, balance:senate, kooyong');
    const d = await cardData(s, live).catch(() => null);
    const ctx = JSON.stringify(d ?? s).slice(0, 1500);
    const x = await run<R>('image-alt', { prompt: `Alt text for the ${s.kind} card ${s.id}`, context: ctx });
    if (x) setR(x);
  };
  return (
    <>
      <div className="ow-make__form">
        <input className="ow-select" value={ref} onChange={(e) => setRef(e.target.value)} aria-label="Card subject" placeholder="race:TX-SEN" />
        <div className="ow-actions"><Button size="sm" disabled={!!busy || wait > 0} onClick={go}>{wait > 0 ? `Wait ${wait}s` : busy || 'Write alt text'}</Button></div>
        {err && <p className="ow-err">{err}</p>}
      </div>
      {r && <div className="ow-tweet"><p><strong>Alt:</strong> {String(r.alt)}</p>{!!r.caption && <p><strong>Caption:</strong> {String(r.caption)}</p>}<Button size="sm" variant="ghost" onClick={() => copyText(String(r.alt))}>Copy alt text</Button></div>}
    </>
  );
}

/* ------------------------------------------- settings ------------------------------------------- */
function SettingsPanel({ s, set }: { s: StudioSettings; set: (s: StudioSettings) => void }) {
  const [models, setModels] = useState<string[]>([]);
  const [def, setDef] = useState('');
  useEffect(() => { fetchModels().then((m) => { setModels(m.models); setDef(m.model); }); }, []);
  const u = (p: Partial<StudioSettings>) => set(sanitizeSettings({ ...s, ...p }));
  const sel = <K extends keyof StudioSettings>(k: K, label: string, opts: [string, string][]) => (
    <label className="ow-field">{label}
      <select className="ow-select" value={String(s[k])} onChange={(e) => u({ [k]: k === 'emoji' ? Number(e.target.value) : e.target.value } as Partial<StudioSettings>)}>
        {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
  return (
    <section className="ow-settings">
      {sel('voice', 'Brand voice', Object.keys(VOICES).map((k) => [k, ({ neutral: 'Neutral news', punchy: 'Punchy', explainer: 'Explainer', 'data-nerd': 'Data nerd', aussie: 'Aussie casual' } as Record<string, string>)[k] ?? k]))}
      {sel('audience', 'Audience', [['us', 'US'], ['au', 'Australia'], ['global', 'Global']])}
      {sel('emoji', 'Emoji', [['0', 'None'], ['1', 'Light'], ['2', 'Lots']])}
      {sel('hashtags', 'Hashtags', [['none', 'None'], ['few', '1–2'], ['many', '3–4']])}
      {sel('length', 'Length', [['short', 'Short'], ['medium', 'Medium'], ['long', 'Long']])}
      {sel('cta', 'Call to action', [['none', 'None'], ['soft', 'Soft'], ['follow', 'Follow us'], ['visit', 'Visit PolTok']])}
      {sel('lang', 'Language', Object.entries(LANGS))}
      <label className="ow-field">Model
        <select className="ow-select" value={s.model} onChange={(e) => u({ model: e.target.value })}>
          <option value="">Auto ({def || 'server default'})</option>
          {models.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </label>
      <label className="ow-field">Temperature {s.temperature.toFixed(1)}
        <input type="range" min={0} max={1.2} step={0.1} value={s.temperature} onChange={(e) => u({ temperature: Number(e.target.value) })} />
      </label>
      <label className="ow-field ow-field--check"><input type="checkbox" checked={s.link} onChange={(e) => u({ link: e.target.checked })} /> Always include a PolTok link</label>
      <label className="ow-field ow-field--wide">Custom voice notes
        <textarea value={s.custom} maxLength={300} rows={2} onChange={(e) => u({ custom: e.target.value })} placeholder="e.g. Avoid partisan framing; refer to 'the count' not 'the tally'" />
      </label>
      <label className="ow-field ow-field--wide">Banned words (comma separated)
        <input className="ow-select" value={s.banned.join(', ')} onChange={(e) => set({ ...s, banned: e.target.value.split(',').map((w) => w.trimStart()).slice(0, 20) })} onBlur={() => u({})} />
      </label>
    </section>
  );
}

/* -------------------------------------------- drafts -------------------------------------------- */
function DraftsBoard({ drafts, setDrafts }: { drafts: StudioDraft[]; setDrafts: (d: StudioDraft[]) => void }) {
  const [filter, setFilter] = useState<DraftStatus | 'All'>('All');
  const shown = drafts.filter((d) => filter === 'All' || d.status === filter);
  const upd = (id: string, p: Partial<StudioDraft>) => setDrafts(drafts.map((d) => (d.id === id ? { ...d, ...p } : d)));
  return (
    <section>
      <div className="ow-actions">
        {(['All', 'Draft', 'Ready', 'Posted'] as const).map((f) => <button key={f} type="button" className={`ow-pill ${f === filter ? 'is-on' : ''}`} onClick={() => setFilter(f)}>{f} ({f === 'All' ? drafts.length : drafts.filter((d) => d.status === f).length})</button>)}
        <Button size="sm" variant="ghost" disabled={!drafts.length} onClick={() => download(new Blob([draftsCsv(drafts)], { type: 'text/csv' }), 'poltok-drafts.csv')}>Export CSV</Button>
      </div>
      {!shown.length && <p className="ow-muted">No drafts yet — use “Save draft” on any result.</p>}
      <div className="ow-grid">
        {shown.map((d) => {
          const path = d.subject ? pathFor(d.subject) : '';
          return (
            <article key={d.id} className="ow-tweet">
              <header className="ow-tweet__h">
                <select className="ow-select ow-select--sm" value={d.status} onChange={(e) => upd(d.id, { status: e.target.value as DraftStatus })} aria-label="Status">{['Draft', 'Ready', 'Posted'].map((s) => <option key={s}>{s}</option>)}</select>
                <span className="ow-muted">{d.source} · {new Date(d.created).toLocaleString()}</span>
              </header>
              <textarea className="ow-tweet__t" value={d.text} onChange={(e) => upd(d.id, { text: e.target.value })} rows={4} aria-label="Draft text" />
              <div className="ow-actions">
                <Button size="sm" variant="ghost" href={intentUrl(d.text, path)} onClick={() => upd(d.id, { status: 'Posted' })}>Post on X</Button>
                <Button size="sm" variant="ghost" onClick={() => copyText(d.text)}>Copy</Button>
                <Button size="sm" variant="ghost" onClick={() => setDrafts(drafts.filter((x) => x.id !== d.id))}>Delete</Button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

/* --------------------------------------------- hub --------------------------------------------- */
type Tool = 'thread' | 'calendar' | 'variants' | 'hooks' | 'reply' | 'hashtags' | 'explain' | 'factcheck' | 'alt' | 'drafts' | 'settings';
const TOOLS: [Tool, string][] = [['thread', 'Thread'], ['calendar', '7-day plan'], ['variants', 'Variants'], ['hooks', 'Hooks'], ['reply', 'Reply'], ['hashtags', 'Hashtags'], ['explain', 'Explainer'], ['factcheck', 'Fact-check'], ['alt', 'Alt text'], ['drafts', 'Drafts'], ['settings', 'AI settings']];
const BUSY: Record<string, string> = { thread: 'Writing thread…', calendar: 'Planning week…', factcheck: 'Checking facts…' };

export function AiStudio() {
  const [tool, setTool] = useState<Tool>('thread');
  const [settings, setSettingsS] = useState(loadSettings);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [count, setCount] = useState(usage());
  const [model, setModel] = useState('');
  const [drafts, setDraftsS] = useState(loadDrafts);
  const ctl = useRef<AbortController | null>(null);
  useEffect(() => onUsage(setCount), []);
  useEffect(() => {
    if (until <= Date.now()) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [until]);
  const wait = Math.max(0, Math.ceil((until - now) / 1000));
  const setSettings = (s: StudioSettings) => { setSettingsS(s); saveSettings(s); };
  const setDrafts = (d: StudioDraft[]) => { setDraftsS(d); saveDrafts(d); };
  const ctx = useMemo<Ctx>(() => ({
    settings,
    busy,
    wait,
    err,
    addDraft: (text, source, subject) => setDrafts([{ id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, text, source, subject: subject ?? null, status: 'Draft', created: Date.now() }, ...loadDrafts()]),
    run: async <T,>(mode: StudioMode, o: { prompt: string; context?: string; n?: number }) => {
      if (busy || Date.now() < until) return null; // sequential: one call at a time
      ctl.current = new AbortController();
      setErr('');
      setBusy(BUSY[mode] ?? 'Generating…');
      try {
        const r = await studioAi<T>(mode, { ...o, settings, signal: ctl.current.signal });
        setModel(r.model);
        return r.result;
      } catch (e) {
        if ((e as Error).name === 'AbortError') return null;
        const se = e as StudioError;
        if (se.code === 'rate_limited') {
          const ra = se.retryAfter || 30;
          setUntil(Date.now() + ra * 1000);
          setNow(Date.now());
          setErr(`Groq free-tier limit — retry in ${ra}s.`);
        } else setErr(se.code === 'not_configured' ? 'AI is not configured (set GROQ).' : se.message || 'AI unavailable');
        return null;
      } finally {
        setBusy('');
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [settings, busy, wait, err, until, drafts]);
  return (
    <StudioCtx.Provider value={ctx}>
      <section className="ow-studio">
        <header className="ow-studio__h">
          <div className="ow-filter" role="tablist" aria-label="AI Studio tools">
            {TOOLS.map(([id, l]) => <button key={id} type="button" role="tab" aria-selected={tool === id} className={`ow-pill ${tool === id ? 'is-on' : ''}`} onClick={() => setTool(id)}>{l}{id === 'drafts' && drafts.length ? ` (${drafts.length})` : ''}</button>)}
          </div>
          <p className="ow-muted" aria-live="polite">
            AI calls this session: <strong>{count}</strong>{model && ` · model ${model}`} · voice {settings.voice} · {LANGS[settings.lang]}
            {busy && <> · {busy} <button type="button" className="ow-pill" onClick={() => ctl.current?.abort()}>Cancel</button></>}
            {wait > 0 && <> · <span className="ow-warn">rate-limited, {wait}s</span></>}
          </p>
          {err && <p className="ow-err" role="alert">{wait > 0 ? `Groq free-tier limit — retry in ${wait}s.` : err}</p>}
        </header>
        {tool === 'thread' && <ThreadTool />}
        {tool === 'calendar' && <CalendarTool />}
        {tool === 'variants' && <ListTool mode="variants" field="variants" nLabel="Options" placeholder="Topic for post options" ideas={['Senate control update', 'Biggest upset so far', 'Victoria countdown']} />}
        {tool === 'hooks' && <ListTool mode="hooks" field="hooks" nLabel="Hooks" placeholder="Topic for headline / hook options" ideas={['House majority math', 'Teal seats in Melbourne']} />}
        {tool === 'reply' && <ListTool mode="reply" field="replies" nLabel="Replies" withContext contextLabel="Paste the tweet you're replying to" placeholder="Reply goal, e.g. Correct the vote count politely" />}
        {tool === 'hashtags' && <HashtagTool />}
        {tool === 'explain' && <ExplainTool />}
        {tool === 'factcheck' && <FactTool />}
        {tool === 'alt' && <AltTool />}
        {tool === 'drafts' && <DraftsBoard drafts={drafts} setDrafts={setDrafts} />}
        {tool === 'settings' && <SettingsPanel s={settings} set={setSettings} />}
        <StudioNote />
      </section>
    </StudioCtx.Provider>
  );
}

function StudioNote(): ReactNode {
  // Unverified numbers are highlighted in fact-check results.
  return <p className="ow-muted">Settings and drafts stay in this browser. Each tool makes one Groq call (free tier ≈ 8/min); numbers in posts are checked against live data by the fact-check gate — the tweet text is AI-written, card numbers always come from the live feed.</p>;
}
