import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../components';
import { AiError, composeAi } from '../../lib/ai';
import { renderCard, type CardData, type CardStyle } from '../../lib/cards';
import { SOCIAL_LIMITS, SOCIAL_PLATFORMS, validateSocial, type SocialPlatform, type SocialResult } from '../../../shared/compose.js';
import { packAssets, packReadme, type PackAsset } from '../../../shared/social.js';
import { download } from './cards';
import { makeZip } from './studio/zip';
import { loadSettings } from './aiStudioApi';
import { copyText } from './LinkedTweet';

const KEY = 'poltok.owner.socialPacks.v1';
const NAMES: Record<SocialPlatform, string> = { x: 'X', instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', facebook: 'Facebook', linkedin: 'LinkedIn', threads: 'Threads', bluesky: 'Bluesky', discord: 'Discord' };
const STYLES: { id: string; label: string; style: CardStyle }[] = [
  { id: 'house', label: 'PolTok house (lime)', style: {} },
  { id: 'navy', label: 'Navy & gold', style: { palette: { bg: '#0b1a33', fg: '#ffffff', accent: '#f5b700' }, fontDisplay: 'Fraunces' } },
  { id: 'paper', label: 'Paper & ink', style: { palette: { bg: '#f6f1e7', fg: '#141414', accent: '#d7263d' }, fontDisplay: 'DM Serif Display', texture: 'paper' } },
  { id: 'neon', label: 'Neon pink', style: { palette: { bg: '#12021f', fg: '#ffffff', accent: '#ff3d9a' }, fontDisplay: 'Bebas Neue', texture: 'grain' } },
];
const HIGHLIGHTS = ['🔴 Live', '📊 Polls', '🇦🇺 AU', '🗳️ Calls'];
interface Saved { name: string; platforms: SocialPlatform[]; style: CardStyle; copy: SocialResult | null; tagline: string }
const load = (): Saved[] => { try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
const save = (l: Saved[]) => { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch { /* private mode */ } };

function dataFor(a: PackAsset, tagline: string, copy: SocialResult | null): CardData {
  const base = { url: 'poltok.netlify.app', handle: copy?.handles[0] ? `@${copy.handles[0]}` : '@PolTok' };
  if (a.type === 'avatar') return { kind: 'brand', title: 'PT', ...base };
  if (a.type === 'highlight') return { kind: 'brand', title: HIGHLIGHTS[(Number(a.id.split('-')[1]) - 1) % HIGHLIGHTS.length], ...base };
  if (a.type === 'banner') return { kind: 'brand', title: tagline, subtitle: 'US midterms + Australian politics · live results', ...base };
  if (a.type === 'story') return { kind: 'brand', title: tagline, subtitle: 'Live results, calls and flips — free.', cta: 'Link in bio', ...base };
  return { kind: 'brand', title: copy?.pinned || tagline, cta: 'Follow for live calls', ...base };
}

function AssetCard({ a, data, style, onBlob }: { a: PackAsset; data: CardData; style: CardStyle; onBlob: (f: string, b: Blob) => void }) {
  const [url, setUrl] = useState('');
  const [blob, setBlob] = useState<Blob | null>(null);
  const [zones, setZones] = useState(true);
  const k = JSON.stringify([a.file, data, style]);
  useEffect(() => {
    let alive = true;
    renderCard(a.design, data, { ...style, size: { w: a.w, h: a.h }, fit: 'reflow' }).then((b) => { if (!alive) return; setBlob(b); onBlob(a.file, b); setUrl(URL.createObjectURL(b)); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
  return (
    <figure className="sp-asset">
      <div className="sp-frame" style={{ aspectRatio: `${a.w} / ${a.h}`, width: `min(100%, ${Math.round((420 * a.w) / a.h)}px)` }}>
        {url ? <img src={url} alt={`${NAMES[a.platform as SocialPlatform]} ${a.label}`} /> : <span className="ow-muted">Rendering…</span>}
        {zones && a.circle && <div className="sp-circle" aria-hidden="true" />}
        {zones && a.covers?.map((c, i) => <div key={`c${i}`} className="sp-cover" style={{ left: pct(c.x), top: pct(c.y), width: pct(c.w), height: pct(c.h) }} title={c.label}><span>{c.label}</span></div>)}
        {zones && a.safe?.map((c, i) => <div key={`s${i}`} className="sp-safe" style={{ left: pct(c.x), top: pct(c.y), width: pct(c.w), height: pct(c.h) }} title={c.label}><span>{c.label}</span></div>)}
      </div>
      <figcaption>
        <strong>{a.label}</strong> <span className="ow-muted">{a.w}×{a.h}</span>
        <span className="ow-actions">
          {(a.circle || a.covers || a.safe) && <button type="button" className="st-link" onClick={() => setZones((z) => !z)}>{zones ? 'Hide' : 'Show'} safe zones</button>}
          <button type="button" className="st-link" disabled={!blob} onClick={() => blob && download(blob, a.file.replace('/', '-'))}>Download</button>
        </span>
      </figcaption>
    </figure>
  );
}

export function SocialPack() {
  const [platforms, setPlatforms] = useState<SocialPlatform[]>(['x', 'instagram', 'youtube']);
  const [styleId, setStyleId] = useState('house');
  const [aiStyle, setAiStyle] = useState<CardStyle | null>(null);
  const [tagline, setTagline] = useState('Every race. Every call. *Live.*');
  const [prompt, setPrompt] = useState('');
  const [copy, setCopy] = useState<SocialResult | null>(null);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [saved, setSaved] = useState<Saved[]>(load);
  const [packName, setPackName] = useState('');
  const blobs = useMemo(() => new Map<string, Blob>(), []);
  const style = aiStyle ?? STYLES.find((s) => s.id === styleId)?.style ?? {};
  const assets = useMemo(() => packAssets(platforms), [platforms]);

  const generate = async () => {
    if (busy) return;
    setBusy('Designing pack…'); setErr('');
    try {
      const raw = await composeAi({ task: 'social', prompt: prompt.trim() || 'Clean, trustworthy, energetic brand kit for PolTok', platforms, settings: loadSettings(), temperature: 0.6 });
      const r = validateSocial(raw, platforms); // client re-validates (limits, handles, style)
      setCopy(r);
      if (Object.keys(r.style).length) setAiStyle(r.style as CardStyle);
      if (r.tagline) setTagline(r.tagline);
    } catch (e) {
      setErr(e instanceof AiError ? e.message : 'AI unavailable');
    } finally { setBusy(''); }
  };
  const zipAll = async () => {
    setBusy('Zipping…');
    try {
      const enc = new TextEncoder();
      const files = [];
      for (const a of assets) {
        const b = blobs.get(a.file) ?? (await renderCard(a.design, dataFor(a, tagline, copy), { ...style, size: { w: a.w, h: a.h }, fit: 'reflow' }));
        files.push({ name: a.file, data: new Uint8Array(await b.arrayBuffer()) });
      }
      files.push({ name: 'README.txt', data: enc.encode(packReadme(platforms, copy ?? {}, SOCIAL_LIMITS)) });
      if (copy) files.push({ name: 'copy.json', data: enc.encode(JSON.stringify(copy, null, 2)) });
      download(makeZip(files), `poltok-social-pack-${new Date().toISOString().slice(0, 10)}.zip`);
      setMsg(`Zipped ${files.length} files`);
    } catch { setErr('ZIP export failed'); } finally { setBusy(''); }
  };
  const toggle = (p: SocialPlatform) => setPlatforms((l) => (l.includes(p) ? l.filter((x) => x !== p) : [...l, p]));

  return (
    <section className="sp">
      <style>{CSS}</style>
      <fieldset className="ow-make__form">
        <legend><strong>Platforms</strong></legend>
        <div className="ow-filter">{SOCIAL_PLATFORMS.map((p) => <button key={p} type="button" aria-pressed={platforms.includes(p)} className={`ow-pill ${platforms.includes(p) ? 'is-on' : ''}`} onClick={() => toggle(p)}>{NAMES[p]}</button>)}</div>
        <label className="ow-muted">Style
          <select className="ow-select" value={aiStyle ? 'ai' : styleId} onChange={(e) => { if (e.target.value !== 'ai') { setAiStyle(null); setStyleId(e.target.value); } }}>
            {STYLES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            {aiStyle && <option value="ai">AI-designed</option>}
          </select>
        </label>
        <label className="ow-muted">Tagline (banners, stories — *word* = accent)<input className="ow-select" value={tagline} maxLength={60} onChange={(e) => setTagline(e.target.value)} /></label>
        <textarea value={prompt} maxLength={600} rows={2} onChange={(e) => setPrompt(e.target.value)} placeholder="Optional brief for the AI, e.g. calm newsroom look, navy and gold, Aussie-friendly bios" aria-label="AI brief" />
        <div className="ow-actions">
          <Button size="sm" disabled={!!busy || !platforms.length} onClick={generate}>{busy === 'Designing pack…' ? busy : 'AI: bios + style'}</Button>
          <Button size="sm" variant="ghost" disabled={!!busy || !platforms.length} onClick={zipAll}>{busy === 'Zipping…' ? busy : `Download ZIP (${assets.length} images + README)`}</Button>
        </div>
        <div className="st-row">
          <input className="ow-select" placeholder="Pack name" value={packName} onChange={(e) => setPackName(e.target.value)} />
          <Button size="sm" variant="ghost" disabled={!packName.trim()} onClick={() => { const n = [...saved.filter((s) => s.name !== packName.trim()), { name: packName.trim(), platforms, style, copy, tagline }]; setSaved(n); save(n); setMsg('Pack saved'); }}>Save pack</Button>
          {saved.map((s) => <span key={s.name}><button type="button" className="ow-pill" onClick={() => { setPlatforms(s.platforms); setAiStyle(s.style); setCopy(s.copy); setTagline(s.tagline); }}>{s.name}</button><button type="button" className="st-x" aria-label={`Delete ${s.name}`} onClick={() => { const n = saved.filter((x) => x.name !== s.name); setSaved(n); save(n); }}>×</button></span>)}
        </div>
        {err && <p className="ow-err" role="alert">{err}</p>}
        {msg && <p className="ow-muted" role="status">{msg}</p>}
      </fieldset>

      {copy && (
        <div className="sp-copy">
          <h3>Profile copy</h3>
          {platforms.map((p) => copy.bios[p] && (
            <p key={p}><strong>{NAMES[p]} bio</strong> <span className="ow-muted">{[...copy.bios[p]!].length}/{SOCIAL_LIMITS[p].bio}</span><br />{copy.bios[p]} <button type="button" className="st-link" onClick={() => copyText(copy.bios[p]!)}>Copy</button></p>
          ))}
          {copy.names.length > 0 && <p><strong>Display names:</strong> {copy.names.join(' · ')}</p>}
          {copy.handles.length > 0 && <p><strong>Handles:</strong> {copy.handles.map((h) => '@' + h).join(' · ')}</p>}
          {copy.pinned && <p><strong>Pinned post:</strong> {copy.pinned} <button type="button" className="st-link" onClick={() => copyText(copy.pinned)}>Copy</button></p>}
          {copy.links.length > 0 && <p><strong>Link in bio:</strong> {copy.links.map((l) => `${l.label} → poltok.netlify.app${l.path}`).join(' · ')}</p>}
        </div>
      )}

      {platforms.map((p) => (
        <div key={p}>
          <h3>{NAMES[p]}</h3>
          <div className="sp-grid">{assets.filter((a) => a.platform === p).map((a) => <AssetCard key={a.file} a={a} data={dataFor(a, tagline, copy)} style={style} onBlob={(f, b) => blobs.set(f, b)} />)}</div>
        </div>
      ))}
    </section>
  );
}

const CSS = `
.sp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px;align-items:start}
.sp-asset{margin:0}
.sp-frame{position:relative;background:#222;border-radius:8px;overflow:hidden}
.sp-frame img{width:100%;height:100%;display:block}
.sp-circle{position:absolute;inset:0;border-radius:50%;box-shadow:0 0 0 999px rgba(0,0,0,.45);outline:2px dashed rgba(255,255,255,.8);outline-offset:-2px}
.sp-cover,.sp-safe{position:absolute;font:600 10px/1.2 system-ui;color:#fff;padding:2px}
.sp-cover{background:rgba(255,40,80,.35);outline:1px dashed #ff2850}
.sp-safe{outline:2px dashed #3dff9a;background:rgba(61,255,154,.08)}
.sp-cover span,.sp-safe span{background:rgba(0,0,0,.6);padding:1px 3px;border-radius:3px}
.sp-asset figcaption{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:6px}
.sp-copy p{margin:.4em 0}
`;
