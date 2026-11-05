import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../../../components';
import { useLive } from '../../../lib/live';
import { RACES } from '../../../data';
import { VICTORIA, FEDERAL } from '../../../data/au';
import {
  CARD_DESIGNS, cardDataFor, renderCardCanvas, renderCard, SIZE_PRESETS, TEXTURES, FONT_CHOICES, STICKER_PRESETS,
  type CardData, type CardKind, type CardStyle, type StickerPreset, type Texture,
} from '../../../lib/cards';
import { PARTY_NAME } from '../../../lib/format';
import { copyImage, download } from '../cards';
import { LinkedTweet } from '../LinkedTweet';
import { makeZip } from './zip';
import { exportPreset, loadPresets, parsePreset, savePresets, upsertPreset, type Preset } from './presets';
import './studio.css';

type Subject = 'race' | 'flip' | 'balance' | 'au-seat' | 'candidate' | 'promo' | 'stat' | 'quote' | 'custom';
const SUBJECTS: { id: Subject; label: string }[] = [
  { id: 'race', label: 'Race' }, { id: 'flip', label: 'Flip' }, { id: 'balance', label: 'Balance of power' }, { id: 'au-seat', label: 'AU seat' },
  { id: 'candidate', label: 'Candidate' }, { id: 'promo', label: 'Promo' }, { id: 'stat', label: 'Stat' }, { id: 'quote', label: 'Quote / headline' }, { id: 'custom', label: 'Custom (blank)' },
];
const PROMOS = ['default', 'live', 'map', 'au', 'vic-countdown'];
const STATS = ['calls', 'flips', 'senate', 'house', 'au-marginal', 'au-polls-federal', 'au-polls-vic'];

type Row = { label: string; value: string; color?: string };
interface Edits { title?: string; subtitle?: string; stats?: Row[]; footer?: string; cta?: string; quoteBy?: string; steps?: { label: string; done: boolean }[]; countdownTo?: number; slide?: { i: number; n: number } }
interface Snap { design: string; edits: Edits; style: CardStyle }

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const blobBytes = async (b: Blob) => new Uint8Array(await b.arrayBuffer());
const toBlob = (cv: HTMLCanvasElement) => new Promise<Blob>((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('toBlob'))), 'image/png'));

function useHistory(init: Snap) {
  const [st, setSt] = useState({ past: [] as Snap[], cur: init, future: [] as Snap[] });
  const last = useRef(0);
  const set = useCallback((f: (s: Snap) => Snap, coalesce = false) => setSt((h) => {
    const next = f(h.cur);
    if (next === h.cur) return h;
    const now = Date.now();
    const merge = coalesce && now - last.current < 800;
    last.current = now;
    return { past: merge ? h.past : [...h.past.slice(-60), h.cur], cur: next, future: [] };
  }), []);
  const undo = useCallback(() => setSt((h) => (h.past.length ? { past: h.past.slice(0, -1), cur: h.past[h.past.length - 1], future: [h.cur, ...h.future] } : h)), []);
  const redo = useCallback(() => setSt((h) => (h.future.length ? { past: [...h.past, h.cur], cur: h.future[0], future: h.future.slice(1) } : h)), []);
  return { snap: st.cur, set, undo, redo, canUndo: st.past.length > 0, canRedo: st.future.length > 0 };
}

export function Studio() {
  const live = useLive();
  const [kind, setKind] = useState<Subject>('race');
  const [id, setId] = useState('');
  const h = useHistory({ design: 'broadcast', edits: {}, style: {} });
  const { design, edits, style } = h.snap;
  const [presets, setPresets] = useState<Preset[]>(() => loadPresets());
  const [presetName, setPresetName] = useState('');
  const [msg, setMsg] = useState('');
  const [blob, setBlob] = useState<Blob | null>(null);
  const [busy, setBusy] = useState('');
  const [batchSel, setBatchSel] = useState<string[]>([]);
  const [batchN, setBatchN] = useState(5);
  const cvRef = useRef<HTMLDivElement>(null);

  const options = useMemo(() => {
    if (kind === 'race' || kind === 'flip') return [...RACES].sort((a, b) => Number(!!b.key) - Number(!!a.key) || a.title.localeCompare(b.title)).map((r) => ({ id: r.id, label: `${r.key ? '★ ' : ''}${r.title}` }));
    if (kind === 'balance') return [{ id: 'senate', label: 'Senate' }, { id: 'house', label: 'House' }];
    if (kind === 'au-seat') return [...VICTORIA.seats, ...FEDERAL.seats].map((s) => ({ id: s.id, label: `${s.name} (${s.chamber === 'vic' ? 'Vic' : s.state} · ${s.party})` }));
    if (kind === 'candidate') return RACES.filter((r) => r.key).concat(RACES.filter((r) => !r.key)).flatMap((r) => r.candidates.map((c) => ({ id: c.id, label: `${c.name} (${PARTY_NAME[c.party] ?? c.party}) — ${r.title}` })));
    if (kind === 'stat') return STATS.map((p) => ({ id: p, label: p }));
    if (kind === 'promo') return PROMOS.map((p) => ({ id: p, label: p }));
    if (kind === 'quote') return (live.news ?? []).slice(0, 40).map((n) => ({ id: n.id, label: `${n.source}: ${n.title}`.slice(0, 90) })).concat([{ id: 'tagline', label: 'PolTok tagline' }]);
    return [{ id: 'blank', label: 'Blank template' }];
  }, [kind, live.news]);
  const subjId = options.some((o) => o.id === id) ? id : options[0]?.id ?? '';
  const stamp = live.lastUpdate ? Math.floor(live.lastUpdate / 60000) : 0;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const liveData = useMemo<CardData>(() => cardDataFor(kind as CardKind, subjId, live), [kind, subjId, stamp, live.news]);
  const data = useMemo<CardData>(() => {
    const d: CardData = { ...liveData };
    for (const [k2, v] of Object.entries(edits)) if (v !== undefined && v !== '') (d as unknown as Record<string, unknown>)[k2] = v;
    return d;
  }, [liveData, edits]);
  const designs = useMemo(() => CARD_DESIGNS.filter((d) => d.kinds.includes(kind as CardKind)), [kind]);
  const sel = designs.find((d) => d.id === design) ?? designs[0] ?? CARD_DESIGNS[0];

  // live preview (debounced)
  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      renderCardCanvas(sel.id, data, style).then((cv) => {
        if (!alive || !cvRef.current) return;
        cv.className = 'st-canvas';
        cv.setAttribute('role', 'img');
        cv.setAttribute('aria-label', `Preview: ${sel.name} — ${data.title}`);
        cvRef.current.replaceChildren(cv);
        toBlob(cv).then((b) => alive && setBlob(b)).catch(() => {});
      }).catch(() => alive && setMsg('Render failed'));
    }, 140);
    return () => { alive = false; clearTimeout(t); };
  }, [sel.id, data, style]);

  // keyboard undo/redo
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || (e.target as HTMLElement)?.tagName === 'TEXTAREA' || (e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) h.redo(); else h.undo(); }
      else if (e.key.toLowerCase() === 'y') { e.preventDefault(); h.redo(); }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [h]);

  const setEdit = <K extends keyof Edits>(k2: K, v: Edits[K]) => h.set((s) => ({ ...s, edits: { ...s.edits, [k2]: v } }), true);
  const setStyle = (patch: Partial<CardStyle>, coalesce = true) => h.set((s) => ({ ...s, style: { ...s.style, ...patch } }), coalesce);
  const setPal = (k2: keyof NonNullable<CardStyle['palette']>, v?: string) => setStyle({ palette: { ...style.palette, [k2]: v } });
  const resetEdits = () => h.set((s) => ({ ...s, edits: {} }));
  const fname = `poltok-${sel.id}-${slug(data.title) || kind}`;
  const rows: Row[] = edits.stats ?? (liveData.stats ?? []).map((s) => ({ ...s }));

  const say = (m: string) => { setMsg(m); setTimeout(() => setMsg((x) => (x === m ? '' : x)), 4000); };

  async function batch(mode: 'designs' | 'subjects' | 'carousel') {
    setBusy(mode);
    try {
      const files: { name: string; data: Uint8Array }[] = [];
      if (mode === 'designs') {
        const ids = batchSel.length ? batchSel : designs.map((d) => d.id);
        for (const did of ids) files.push({ name: `${did}-${slug(data.title)}.png`, data: await blobBytes(await renderCard(did, data, style)) });
      } else {
        const subs = options.slice(0, Math.max(1, Math.min(batchN, 40)));
        for (let i = 0; i < subs.length; i++) {
          const d = { ...cardDataFor(kind as CardKind, subs[i].id, live), ...(edits.cta ? { cta: edits.cta } : {}), ...(edits.footer ? { footer: edits.footer } : {}) };
          const did = mode === 'carousel' ? 'carousel' : sel.id;
          if (mode === 'carousel') d.slide = { i: i + 1, n: subs.length };
          files.push({ name: `${String(i + 1).padStart(2, '0')}-${did}-${slug(d.title)}.png`, data: await blobBytes(await renderCard(did, d, style)) });
        }
      }
      download(makeZip(files), `poltok-cards-${mode}-${new Date().toISOString().slice(0, 10)}.zip`);
      say(`Zipped ${files.length} PNGs`);
    } catch { say('Batch export failed'); } finally { setBusy(''); }
  }

  const onBgFile = (f?: File) => {
    if (!f || !/^image\//.test(f.type)) return;
    if (f.size > 12e6) return say('Image too large (max 12 MB)');
    const r = new FileReader();
    r.onload = () => setStyle({ bgImage: String(r.result) }, false);
    r.readAsDataURL(f); // stays in this browser — never uploaded
  };
  const importPreset = (f?: File) => {
    if (!f) return;
    f.text().then((t) => {
      const p = parsePreset(t);
      if (!p) return say('Not a PolTok preset file');
      setPresets((l) => upsertPreset(l, p));
      applyPreset(p);
      say(`Imported “${p.name}”`);
    });
  };
  const applyPreset = (p: Preset) => h.set((s) => ({ ...s, design: p.designId ?? s.design, style: { ...p.style, bgImage: s.style.bgImage } }));
  const pal = style.palette ?? {};
  const sizeId = style.size ? SIZE_PRESETS.find((p) => p.w === style.size!.w && p.h === style.size!.h)?.id ?? 'custom' : 'native';

  return (
    <section className="st">
      <div className="st-bar">
        <Button size="sm" variant="ghost" disabled={!h.canUndo} onClick={h.undo} aria-label="Undo (Ctrl+Z)">↶ Undo</Button>
        <Button size="sm" variant="ghost" disabled={!h.canRedo} onClick={h.redo} aria-label="Redo (Ctrl+Shift+Z)">↷ Redo</Button>
        <span className="st-sep" />
        <Button size="sm" disabled={!blob} onClick={() => blob && download(blob, `${fname}.png`)}>Download PNG</Button>
        <Button size="sm" variant="ghost" disabled={!blob} onClick={async () => blob && say((await copyImage(blob)) ? 'PNG copied to clipboard' : 'Copy unsupported here — download instead')}>Copy PNG</Button>
        {msg && <span className="ow-muted" role="status">{msg}</span>}
      </div>
      <div className="st-grid">
        <aside className="st-left" aria-label="Subject and text">
          <fieldset>
            <legend>Subject</legend>
            <label>Type
              <select className="ow-select" value={kind} onChange={(e) => { setKind(e.target.value as Subject); resetEdits(); }}>
                {SUBJECTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </label>
            <label>Subject
              <select className="ow-select" value={subjId} onChange={(e) => { setId(e.target.value); resetEdits(); }}>
                {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </label>
          </fieldset>
          <fieldset>
            <legend>Text <button type="button" className="st-link" onClick={resetEdits}>Reset to live data</button></legend>
            <label>Title<input className="ow-select" value={edits.title ?? liveData.title} onChange={(e) => setEdit('title', e.target.value)} /></label>
            <label>Subtitle<textarea className="ow-select" rows={2} value={edits.subtitle ?? liveData.subtitle ?? ''} onChange={(e) => setEdit('subtitle', e.target.value)} /></label>
            <div className="st-rows" role="group" aria-label="Stat rows">
              {rows.map((r, i) => (
                <div key={i} className="st-row">
                  <input className="ow-select" aria-label={`Row ${i + 1} label`} value={r.label} onChange={(e) => setEdit('stats', rows.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                  <input className="ow-select st-val" aria-label={`Row ${i + 1} value`} value={r.value} onChange={(e) => setEdit('stats', rows.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
                  <input type="color" aria-label={`Row ${i + 1} colour`} value={/^#[0-9a-f]{6}$/i.test(r.color ?? '') ? r.color : '#c6ff3d'} onChange={(e) => setEdit('stats', rows.map((x, j) => (j === i ? { ...x, color: e.target.value } : x)))} />
                  <button type="button" className="st-x" aria-label={`Remove row ${i + 1}`} onClick={() => setEdit('stats', rows.filter((_, j) => j !== i))}>×</button>
                </div>
              ))}
              {rows.length < 8 && <button type="button" className="st-link" onClick={() => setEdit('stats', [...rows, { label: 'Label', value: '0' }])}>+ Add row</button>}
            </div>
            <label>Footer / source<input className="ow-select" value={edits.footer ?? liveData.footer ?? ''} onChange={(e) => setEdit('footer', e.target.value)} /></label>
            <label>Call to action<input className="ow-select" placeholder="e.g. Follow live at poltok.netlify.app" value={edits.cta ?? ''} onChange={(e) => setEdit('cta', e.target.value)} /></label>
            {(kind === 'quote' || kind === 'custom' || kind === 'candidate') && <label>Quote by<input className="ow-select" value={edits.quoteBy ?? liveData.quoteBy ?? ''} onChange={(e) => setEdit('quoteBy', e.target.value)} /></label>}
            {(sel.id === 'countdown' || data.countdownTo) && <label>Count down to<input className="ow-select" type="datetime-local" value={toLocal(data.countdownTo)} onChange={(e) => setEdit('countdownTo', e.target.value ? Date.parse(e.target.value) : undefined)} /></label>}
            {sel.id === 'bill' && <label>Bill steps (one per line, prefix ✓ when done)
              <textarea className="ow-select" rows={5} value={(data.steps ?? []).map((s) => `${s.done ? '✓ ' : ''}${s.label}`).join('\n')} onChange={(e) => setEdit('steps', e.target.value.split('\n').filter((l) => l.trim()).map((l) => ({ done: /^\s*[✓x*]\s*/i.test(l), label: l.replace(/^\s*[✓x*]\s*/i, '').trim() })))} />
            </label>}
            {sel.id === 'carousel' && <label>Slide<span className="st-row"><input className="ow-select st-val" type="number" min={1} max={20} value={data.slide?.i ?? 1} onChange={(e) => setEdit('slide', { i: +e.target.value || 1, n: data.slide?.n ?? 5 })} /> of <input className="ow-select st-val" type="number" min={1} max={20} value={data.slide?.n ?? 5} onChange={(e) => setEdit('slide', { i: data.slide?.i ?? 1, n: +e.target.value || 1 })} /></span></label>}
          </fieldset>
        </aside>

        <div className="st-main">
          <div className="st-controls" aria-label="Style">
            <label>Design
              <select className="ow-select" value={sel.id} onChange={(e) => h.set((s) => ({ ...s, design: e.target.value }))}>
                {designs.map((d) => <option key={d.id} value={d.id}>{d.isNew ? '✦ ' : ''}{d.name} · {d.size.w}×{d.size.h}</option>)}
              </select>
            </label>
            <label>Size
              <select className="ow-select" value={sizeId} onChange={(e) => { const p = SIZE_PRESETS.find((x) => x.id === e.target.value); setStyle({ size: e.target.value === 'native' ? undefined : p ? { w: p.w, h: p.h } : { w: style.size?.w ?? 1200, h: style.size?.h ?? 800 } }, false); }}>
                <option value="native">Design default ({sel.size.w}×{sel.size.h})</option>
                {SIZE_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label} · {p.w}×{p.h}</option>)}
                <option value="custom">Custom W×H</option>
              </select>
            </label>
            {sizeId === 'custom' && <label>W×H<span className="st-row"><input className="ow-select st-val" type="number" min={200} max={4096} value={style.size?.w ?? 1200} onChange={(e) => setStyle({ size: { w: +e.target.value, h: style.size?.h ?? 800 } })} />×<input className="ow-select st-val" type="number" min={200} max={4096} value={style.size?.h ?? 800} onChange={(e) => setStyle({ size: { w: style.size?.w ?? 1200, h: +e.target.value } })} /></span></label>}
            {style.size && <label>Fit<select className="ow-select" value={style.fit ?? 'auto'} onChange={(e) => setStyle({ fit: e.target.value as CardStyle['fit'] }, false)}><option value="auto">Auto</option><option value="reflow">Reflow layout</option><option value="letterbox">Letterbox</option></select></label>}
            <label>Display font<select className="ow-select" value={style.fontDisplay ?? ''} onChange={(e) => setStyle({ fontDisplay: e.target.value || undefined }, false)}><option value="">Design default</option>{FONT_CHOICES.map((f) => <option key={f}>{f}</option>)}</select></label>
            <label>Body font<select className="ow-select" value={style.fontBody ?? ''} onChange={(e) => setStyle({ fontBody: e.target.value || undefined }, false)}><option value="">Design default</option>{FONT_CHOICES.map((f) => <option key={f}>{f}</option>)}</select></label>
            <div className="st-swatches" role="group" aria-label="Palette">
              {(['bg', 'fg', 'accent', 'dem', 'rep'] as const).map((p) => (
                <label key={p} className="st-sw">{({ bg: 'Background', fg: 'Text', accent: 'Accent', dem: 'Dem', rep: 'Rep' })[p]}
                  <span className="st-row"><input type="color" value={pal[p] ?? ({ bg: '#0b0d14', fg: '#ffffff', accent: '#c6ff3d', dem: '#3d7bff', rep: '#ff3d55' })[p]} onChange={(e) => setPal(p, e.target.value)} />
                    {pal[p] && <button type="button" className="st-x" aria-label={`Clear ${p}`} onClick={() => setPal(p, undefined)}>×</button>}</span>
                </label>
              ))}
            </div>
            <label>Texture<select className="ow-select" value={style.texture ?? 'none'} onChange={(e) => setStyle({ texture: e.target.value as Texture }, false)}>{TEXTURES.map((t) => <option key={t}>{t}</option>)}</select></label>
            {style.texture && style.texture !== 'none' && <label>Strength<input type="range" min={0.1} max={1} step={0.05} value={style.textureOpacity ?? 0.5} onChange={(e) => setStyle({ textureOpacity: +e.target.value })} /></label>}
            <label>Corners<input type="range" min={0} max={80} value={style.cornerRadius ?? 0} onChange={(e) => setStyle({ cornerRadius: +e.target.value || undefined })} /></label>
            <label>Border<span className="st-row"><input type="range" min={0} max={40} value={style.border?.width ?? 0} onChange={(e) => setStyle({ border: +e.target.value ? { width: +e.target.value, color: style.border?.color ?? '#ffffff' } : undefined })} /><input type="color" value={style.border?.color ?? '#ffffff'} onChange={(e) => setStyle({ border: { width: style.border?.width || 8, color: e.target.value } })} /></span></label>
            <label>Logo<select className="ow-select" value={style.logo ?? 'design'} onChange={(e) => setStyle({ logo: e.target.value as CardStyle['logo'] }, false)}><option value="design">As designed</option><option value="off">Off</option><option value="tl">Top left</option><option value="tr">Top right</option><option value="bl">Bottom left</option><option value="br">Bottom right</option></select></label>
            <label>Headline align<select className="ow-select" value={style.align ?? 'design'} onChange={(e) => setStyle({ align: e.target.value as CardStyle['align'] }, false)}><option value="design">As designed</option><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
            <label>Watermark<input className="ow-select" placeholder="e.g. DRAFT" value={style.watermark ?? ''} onChange={(e) => setStyle({ watermark: e.target.value || undefined })} /></label>
            <label>Background image<span className="st-row"><input type="file" accept="image/*" onChange={(e) => onBgFile(e.target.files?.[0])} />{style.bgImage && <button type="button" className="st-x" aria-label="Remove background image" onClick={() => setStyle({ bgImage: undefined }, false)}>×</button>}</span></label>
            {style.bgImage && <label>Image cover<input type="range" min={0} max={1} step={0.05} value={style.bgImageDim ?? 0.55} onChange={(e) => setStyle({ bgImageDim: +e.target.value })} /></label>}
            <div className="st-stickers" role="group" aria-label="Stickers">
              <span>Stickers</span>
              {(style.stickers ?? []).map((s, i) => (
                <span key={i} className="st-row">
                  <select className="ow-select" aria-label="Sticker type" value={s.preset} onChange={(e) => setStyle({ stickers: style.stickers!.map((x, j) => (j === i ? { ...x, preset: e.target.value as StickerPreset } : x)) }, false)}>{STICKER_PRESETS.map((p) => <option key={p}>{p}</option>)}</select>
                  {s.preset === 'custom' && <input className="ow-select st-val" aria-label="Sticker text" value={s.text ?? ''} onChange={(e) => setStyle({ stickers: style.stickers!.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} />}
                  <select className="ow-select" aria-label="Sticker position" value={s.pos} onChange={(e) => setStyle({ stickers: style.stickers!.map((x, j) => (j === i ? { ...x, pos: e.target.value as typeof s.pos } : x)) }, false)}><option value="tl">↖</option><option value="tr">↗</option><option value="bl">↙</option><option value="br">↘</option><option value="c">center</option></select>
                  <button type="button" className="st-x" aria-label="Remove sticker" onClick={() => setStyle({ stickers: style.stickers!.filter((_, j) => j !== i) }, false)}>×</button>
                </span>
              ))}
              {(style.stickers?.length ?? 0) < 4 && <button type="button" className="st-link" onClick={() => setStyle({ stickers: [...(style.stickers ?? []), { preset: 'live', pos: 'tr' }] }, false)}>+ Sticker</button>}
            </div>
            <button type="button" className="st-link" onClick={() => h.set((s) => ({ ...s, style: {} }))}>Reset style</button>
          </div>

          <div className="st-preview" ref={cvRef} aria-live="polite"><span className="ow-muted">Rendering…</span></div>

          <div className="st-panels">
            <fieldset>
              <legend>Presets</legend>
              <div className="st-row">
                <input className="ow-select" placeholder="Preset name" value={presetName} onChange={(e) => setPresetName(e.target.value)} />
                <Button size="sm" disabled={!presetName.trim()} onClick={() => { setPresets((l) => upsertPreset(l, { name: presetName.trim(), designId: sel.id, style, savedAt: Date.now() })); say('Preset saved'); }}>Save</Button>
              </div>
              <ul className="st-presets">
                {presets.map((p) => (
                  <li key={p.name}>
                    <button type="button" className="ow-pill" onClick={() => applyPreset(p)}>{p.name}</button>
                    <button type="button" className="st-link" onClick={() => setPresets((l) => upsertPreset(l, { ...p, name: `${p.name} copy`, savedAt: Date.now() }))}>Duplicate</button>
                    <button type="button" className="st-link" onClick={() => download(exportPreset(p), `poltok-preset-${slug(p.name)}.json`)}>Export</button>
                    <button type="button" className="st-link" onClick={() => setPresets((l) => { const n = l.filter((x) => x.name !== p.name); savePresets(n); return n; })}>Delete</button>
                  </li>
                ))}
              </ul>
              <label className="st-link">Import preset JSON<input type="file" accept="application/json,.json" className="st-file" onChange={(e) => importPreset(e.target.files?.[0])} /></label>
            </fieldset>
            <fieldset>
              <legend>Batch export (ZIP)</legend>
              <p className="ow-muted">This subject in several designs (current style applies):</p>
              <div className="st-checks">
                {designs.map((d) => (
                  <label key={d.id}><input type="checkbox" checked={batchSel.includes(d.id)} onChange={(e) => setBatchSel((l) => (e.target.checked ? [...l, d.id] : l.filter((x) => x !== d.id)))} />{d.name}</label>
                ))}
              </div>
              <Button size="sm" disabled={!!busy} onClick={() => batch('designs')}>{busy === 'designs' ? 'Rendering…' : `Export ${batchSel.length || designs.length} designs`}</Button>
              <p className="ow-muted">First N subjects of this type:</p>
              <div className="st-row">
                <input className="ow-select st-val" type="number" min={1} max={40} value={batchN} onChange={(e) => setBatchN(+e.target.value || 1)} aria-label="Number of subjects" />
                <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => batch('subjects')}>{busy === 'subjects' ? 'Rendering…' : `In “${sel.name}”`}</Button>
                <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => batch('carousel')}>{busy === 'carousel' ? 'Rendering…' : 'As carousel 1/N…N/N'}</Button>
              </div>
            </fieldset>
          </div>
          <LinkedTweet subject={{ kind: (kind === 'candidate' || kind === 'custom' ? 'promo' : kind), id: subjId }} designName={sel.name} blob={blob} name={fname} />
        </div>
      </div>
    </section>
  );
}

function toLocal(ms?: number) {
  if (!ms || !Number.isFinite(ms)) return '';
  const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}
