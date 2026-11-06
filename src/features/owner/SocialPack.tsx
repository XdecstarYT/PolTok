import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../../components';
import { AiError, composeAi } from '../../lib/ai';
import { SOCIAL_LIMITS, SOCIAL_PLATFORMS, validateSocial, type SocialPlatform, type SocialResult } from '../../../shared/compose.js';
import { EXTRA_ASSETS, packAssets, packReadme, SPECS, type PackAsset } from '../../../shared/social.js';
import { download } from './cards';
import { makeZip } from './studio/zip';
import { loadSettings } from './aiStudioApi';
import { copyText } from './LinkedTweet';
import { DEFAULT_BRAND, HOUSE_PALETTE, LOGO_STYLES, clearSpace, contrast, isHex, lockup, logoPng, logoSvg, MIN_SIZE, type Brand, type BrandPalette, type LogoMode, type LogoVariant } from './brand/logo';
import { renderAsset, safeWarnings, toPng } from './brand/render';
import { brandGuideHtml, pairings, printGuide, swatches, TYPE_SCALE } from './brand/guide';
import { iconSvg } from './brand/icons';
import { MOCK_CSS, Mockups, type Asset } from './brand/Mockups';

const KEY = 'poltok.owner.brand.v2';
const NAMES: Record<SocialPlatform, string> = { x: 'X', instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', facebook: 'Facebook', linkedin: 'LinkedIn', threads: 'Threads', bluesky: 'Bluesky', discord: 'Discord' };
const PALETTES: { id: string; label: string; p: BrandPalette }[] = [
  { id: 'house', label: 'House (void + lime)', p: HOUSE_PALETTE },
  { id: 'navy', label: 'Navy newsroom', p: { ...HOUSE_PALETTE, bg: '#0b1a33', surface: '#13284d', muted: '#a9b8d6', dot: '#f5b700' } },
  { id: 'ink', label: 'Ink & paper', p: { ...HOUSE_PALETTE, bg: '#141414', surface: '#232323', fg: '#f6f1e7', muted: '#b9b2a4', dot: '#e4ff5c' } },
  { id: 'midnight', label: 'Midnight cyan', p: { ...HOUSE_PALETTE, bg: '#071219', surface: '#0f2430', dot: '#22d3ee' } },
];
const VARIANTS: LogoVariant[] = ['full', 'stacked', 'monogram', 'icon'];
const MODES: LogoMode[] = ['dark', 'light', 'mono-dark', 'mono-light'];
type Tab = 'identity' | 'color' | 'mockups' | 'assets' | 'guide';
interface Stored { brand: Brand; draft: Brand; platforms: SocialPlatform[]; copy: SocialResult | null }
const load = (): Partial<Stored> => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; } };
const store = (s: Stored) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ } };
const ALL = packAssets(SOCIAL_PLATFORMS);
interface Out extends Asset { blob: Blob }

function Svg({ html, className }: { html: string; className?: string }) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function SocialPack() {
  const init = useMemo(load, []);
  const [tab, setTab] = useState<Tab>('identity');
  const [brand, setBrand] = useState<Brand>(init.brand ?? DEFAULT_BRAND);
  const [draft, setDraft] = useState<Brand>(init.draft ?? init.brand ?? DEFAULT_BRAND);
  const [platforms, setPlatforms] = useState<SocialPlatform[]>(init.platforms ?? [...SOCIAL_PLATFORMS]);
  const [copy, setCopy] = useState<SocialResult | null>(init.copy ?? null);
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [outs, setOuts] = useState<Map<string, Out>>(new Map());
  const [zones, setZones] = useState(true);
  const gen = useRef(0);
  const dirty = JSON.stringify(brand) !== JSON.stringify(draft);
  const handle = copy?.handles[0] ? `@${copy.handles[0]}` : '@PolTok';

  useEffect(() => store({ brand, draft, platforms, copy }), [brand, draft, platforms, copy]);

  // (Re)render every asset whenever the applied brand or copy changes — "apply to all".
  useEffect(() => {
    const id = ++gen.current;
    const list = [...ALL, ...EXTRA_ASSETS];
    const next = new Map<string, Out>();
    (async () => {
      const fs = (document as Document & { fonts?: FontFaceSet }).fonts;
      await fs?.load(`700 40px '${brand.fontDisplay}'`).catch(() => null);
      for (const a of list) {
        if (gen.current !== id) return;
        try {
          const r = await renderAsset(a, brand, { handle, pinned: copy?.pinned });
          const blob = await toPng(r.canvas);
          next.set(a.file, { url: URL.createObjectURL(blob), keys: r.keys, w: a.w, h: a.h, blob });
        } catch { /* skip asset */ }
        if (next.size % 8 === 0) setOuts(new Map(next));
      }
      if (gen.current === id) setOuts((old) => { old.forEach((o) => { if (![...next.values()].includes(o)) URL.revokeObjectURL(o.url); }); return next; });
    })();
  }, [brand, handle, copy?.pinned]);

  const get = (p: string, id: string) => { const a = ALL.find((x) => x.platform === p && x.id === id); return a ? outs.get(a.file) : undefined; };
  const setP = (k: keyof BrandPalette, v: string) => setDraft((d) => ({ ...d, palette: { ...d.palette, [k]: v } }));

  const aiStyle = async () => {
    if (busy) return;
    setBusy('ai'); setErr('');
    try {
      const raw = await composeAi({ task: 'social', prompt: prompt.trim() || 'Clean, trustworthy, energetic brand kit for PolTok', platforms, settings: loadSettings(), temperature: 0.6 });
      const r = validateSocial(raw, platforms);
      setCopy(r);
      const pal = (r.style as { palette?: { bg?: string; fg?: string; accent?: string } }).palette ?? {};
      const h = [...(prompt || r.tagline || 'x')].reduce((s, c) => s + c.charCodeAt(0), 0);
      setDraft((d) => {
        const p = { ...d.palette };
        if (isHex(pal.bg) && contrast(pal.bg, '#ffffff') >= 7) { p.bg = pal.bg; p.surface = pal.bg; }
        if (isHex(pal.fg) && contrast(pal.fg, p.bg) >= 7) p.fg = pal.fg;
        if (isHex(pal.accent) && contrast(pal.accent, p.bg) >= 4.5) p.dot = pal.accent;
        return { ...d, palette: p, logo: LOGO_STYLES[h % LOGO_STYLES.length], tagline: r.tagline ? r.tagline.replace(/\*/g, '') : d.tagline };
      });
      setMsg('AI suggestion loaded into the draft — review, then “Apply to all”.');
    } catch (e) { setErr(e instanceof AiError ? e.message : 'AI unavailable'); } finally { setBusy(''); }
  };

  const exportZip = async () => {
    setBusy('zip'); setErr('');
    try {
      const enc = new TextEncoder();
      const files: { name: string; data: Uint8Array }[] = [];
      const add = async (name: string, b: Blob) => files.push({ name, data: new Uint8Array(await b.arrayBuffer()) });
      for (const a of [...packAssets(platforms), ...EXTRA_ASSETS]) {
        let o = outs.get(a.file)?.blob;
        if (!o) o = await toPng((await renderAsset(a, brand, { handle, pinned: copy?.pinned })).canvas);
        await add(a.file, o);
      }
      for (const v of VARIANTS) for (const m of MODES) {
        files.push({ name: `brand/logo/svg/poltok-${v}-${m}.svg`, data: enc.encode(logoSvg(brand, v, m)) });
        files.push({ name: `brand/logo/svg/poltok-${v}-${m}-transparent.svg`, data: enc.encode(logoSvg(brand, v, m, { bg: false })) });
        for (const px of v === 'icon' || v === 'monogram' ? [16, 32, 64, 180, 512, 1024] : [64, 128, 256, 512]) await add(`brand/logo/png/poltok-${v}-${m}-${px}.png`, await logoPng(brand, v, m, px));
      }
      for (const i of ['live', 'map', 'au', 'news', 'polls', 'results', 'ask', 'menu']) files.push({ name: `brand/icons/${i}.svg`, data: enc.encode(iconSvg(i, brand.palette.fg, brand.palette.surface, 512)) });
      files.push({ name: 'brand-guide.html', data: enc.encode(brandGuideHtml(brand)) });
      files.push({ name: 'brand/brand.json', data: enc.encode(JSON.stringify(brand, null, 2)) });
      files.push({ name: 'README.md', data: enc.encode(packReadme(platforms, copy ?? {}, SOCIAL_LIMITS) + `\nLogos: brand/logo/svg (vector paths) + png (sizes in file names). Clear space = ¼ mark height.\n`) });
      if (copy) files.push({ name: 'copy.json', data: enc.encode(JSON.stringify(copy, null, 2)) });
      download(makeZip(files), `poltok-brand-pack-${new Date().toISOString().slice(0, 10)}.zip`);
      setMsg(`Exported ${files.length} files`);
    } catch { setErr('ZIP export failed'); } finally { setBusy(''); }
  };

  const toggle = (p: SocialPlatform) => setPlatforms((l) => (l.includes(p) ? l.filter((x) => x !== p) : [...l, p]));
  const shown = [...packAssets(platforms), ...EXTRA_ASSETS];
  const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
  const lk = lockup(draft.logo, 'full');
  const cs = clearSpace(lk, 'full');

  return (
    <section className="sp">
      <style>{CSS + MOCK_CSS}</style>
      <div className="ow-filter" role="tablist">
        {([['identity', 'Logo & identity'], ['color', 'Colour & type'], ['mockups', 'Profile mockups'], ['assets', 'Asset matrix'], ['guide', 'Guide & export']] as [Tab, string][]).map(([id, l]) =>
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={`ow-pill ${tab === id ? 'is-on' : ''}`} onClick={() => setTab(id)}>{l}</button>)}
      </div>
      <fieldset className="ow-make__form">
        <legend><strong>Platforms</strong></legend>
        <div className="ow-filter">{SOCIAL_PLATFORMS.map((p) => <button key={p} type="button" aria-pressed={platforms.includes(p)} className={`ow-pill ${platforms.includes(p) ? 'is-on' : ''}`} onClick={() => toggle(p)}>{NAMES[p]}</button>)}</div>
        <div className="ow-actions">
          <Button size="sm" disabled={!dirty} onClick={() => { setBrand(draft); setMsg('Applied to every asset, mockup and the guide.'); }}>{dirty ? 'Apply to all (draft changed)' : 'Applied to all'}</Button>
          {dirty && <Button size="sm" variant="ghost" onClick={() => setDraft(brand)}>Discard draft</Button>}
          <Button size="sm" variant="ghost" disabled={!!busy} onClick={exportZip}>{busy === 'zip' ? 'Zipping…' : `Export ZIP (${shown.length} assets + logos + guide)`}</Button>
          <span className="ow-muted">{outs.size}/{ALL.length + EXTRA_ASSETS.length} rendered</span>
        </div>
        {err && <p className="ow-err" role="alert">{err}</p>}
        {msg && <p className="ow-muted" role="status">{msg}</p>}
      </fieldset>

      {tab === 'identity' && <div>
        <div className="bi-row">
          <label className="ow-muted">Logo style
            <select className="ow-select" value={draft.logo.id} onChange={(e) => setDraft((d) => ({ ...d, logo: LOGO_STYLES.find((s) => s.id === e.target.value) ?? d.logo }))}>{LOGO_STYLES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
          <label className="ow-muted">Weight <input type="range" min={4} max={10} step={0.5} value={draft.logo.weight} onChange={(e) => setDraft((d) => ({ ...d, logo: { ...d.logo, id: 'custom', label: 'Custom', weight: +e.target.value } }))} /></label>
          <label className="ow-muted">Container <select className="ow-select" value={draft.logo.container} onChange={(e) => setDraft((d) => ({ ...d, logo: { ...d.logo, id: 'custom', label: 'Custom', container: e.target.value as Brand['logo']['container'] } }))}>{['rounded', 'circle', 'square', 'none'].map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="ow-muted">Dot <select className="ow-select" value={draft.logo.dot} onChange={(e) => setDraft((d) => ({ ...d, logo: { ...d.logo, id: 'custom', label: 'Custom', dot: e.target.value as Brand['logo']['dot'] } }))}>{['circle', 'square', 'diamond'].map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="ow-muted"><input type="checkbox" checked={draft.logo.tokAccent} onChange={(e) => setDraft((d) => ({ ...d, logo: { ...d.logo, id: 'custom', label: 'Custom', tokAccent: e.target.checked } }))} /> “Tok” in accent</label>
          <label className="ow-muted">Tagline <input className="ow-select" value={draft.tagline} maxLength={60} onChange={(e) => setDraft((d) => ({ ...d, tagline: e.target.value }))} /></label>
        </div>
        <div className="bi-row">
          <textarea value={prompt} maxLength={600} rows={2} onChange={(e) => setPrompt(e.target.value)} placeholder="Brief for the AI (palette, mood, bios) e.g. calm newsroom, navy and gold" aria-label="AI brief" style={{ flex: 1 }} />
          <Button size="sm" disabled={!!busy} onClick={aiStyle}>{busy === 'ai' ? 'Thinking…' : 'AI: suggest style + bios'}</Button>
        </div>
        <h3>Lockups</h3>
        <div className="bi-grid">{VARIANTS.map((v) => <figure key={v}><Svg className="bi-logo" html={logoSvg(draft, v, 'dark')} /><figcaption><b>{v}</b> · min {MIN_SIZE[v]} <button type="button" className="st-link" onClick={() => download(new Blob([logoSvg(draft, v, 'dark')], { type: 'image/svg+xml' }), `poltok-${v}.svg`)}>SVG</button> <button type="button" className="st-link" onClick={async () => download(await logoPng(draft, v, 'dark', 512), `poltok-${v}-512.png`)}>PNG</button></figcaption></figure>)}</div>
        <h3>Colour versions</h3>
        <div className="bi-grid">{MODES.map((m) => <figure key={m}><Svg className="bi-logo" html={logoSvg(draft, 'full', m)} /><figcaption>{m}</figcaption></figure>)}</div>
        <h3>Clear space</h3>
        <div className="bi-cs"><div style={{ padding: (cs * 90) / lk.h }}><Svg html={logoSvg(draft, 'full', 'dark', { pad: 0, bg: false })} /></div></div>
        <p className="ow-muted">Keep clear space of ¼ the mark height (x) on every side — shown hatched. Don’t recolour the bars or dot, stretch, rotate, outline or put the logo on busy photos.</p>
      </div>}

      {tab === 'color' && <div>
        <h3>Palette</h3>
        <div className="bi-row">
          <label className="ow-muted">Preset <select className="ow-select" onChange={(e) => { const p = PALETTES.find((x) => x.id === e.target.value); if (p) setDraft((d) => ({ ...d, palette: p.p })); }} defaultValue="">{[<option key="" value="" disabled>Choose…</option>, ...PALETTES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)]}</select></label>
        </div>
        <div className="bi-sw">{swatches(draft).map((s) => <label key={s.k} className="bi-swatch"><input type="color" value={s.hex} onChange={(e) => setP(s.k, e.target.value)} aria-label={s.name} /><b>{s.name}</b><code>{s.hex}</code><small>{s.use}</small></label>)}</div>
        <h3>Contrast table (WCAG 2.x)</h3>
        <div className="bi-table"><table><thead><tr><th>Sample</th><th>Text</th><th>On</th><th>Ratio</th><th>Grade</th></tr></thead><tbody>
          {pairings(draft).sort((a, b) => b.ratio - a.ratio).map((x, i) => <tr key={i} className={x.grade === 'Fail' ? 'is-fail' : ''}><td><span className="bi-chip" style={{ background: x.bg, color: x.fg }}>Aa</span></td><td>{x.fgName}</td><td>{x.bgName}</td><td>{x.ratio.toFixed(2)}:1</td><td>{x.grade}</td></tr>)}
        </tbody></table></div>
        <h3>Type scale (1.25)</h3>
        <div className="bi-row"><label className="ow-muted">Display font <select className="ow-select" value={draft.fontDisplay} onChange={(e) => setDraft((d) => ({ ...d, fontDisplay: e.target.value }))}>{['Space Grotesk', 'Inter', 'Oswald', 'Playfair Display'].map((f) => <option key={f}>{f}</option>)}</select></label></div>
        <div className="bi-type" style={{ background: draft.palette.bg, color: draft.palette.fg }}>{TYPE_SCALE.map((t) => <div key={t.name} style={{ font: `${t.w} ${t.px}px '${t.fam === 'display' ? draft.fontDisplay : draft.fontBody}', system-ui` }}>{t.name} <small style={{ fontSize: 12, color: draft.palette.muted }}>{t.px}px / {t.w}</small></div>)}</div>
        <h3>Usage</h3>
        <div className="bi-usage" style={{ background: draft.palette.bg, color: draft.palette.fg }}>
          <span className="bi-tag" style={{ background: draft.palette.rep }}>● LIVE</span>
          <h4 style={{ font: `700 28px '${draft.fontDisplay}'`, margin: '8px 0' }}>Senate control flips on a 0.4-pt margin</h4>
          <p style={{ color: draft.palette.muted }}>Secondary text uses Muted on Void.</p>
          <span className="bi-cta" style={{ background: draft.palette.dot, color: draft.palette.ink }}>Follow live calls</span>
          <span style={{ color: draft.palette.dem, marginLeft: 12 }}>D 48.2%</span> <span style={{ color: draft.palette.rep }}>R 47.8%</span>
        </div>
      </div>}

      {tab === 'mockups' && <Mockups platforms={platforms} get={get} bios={copy?.bios ?? {}} name={brand.name} handle={handle} />}

      {tab === 'assets' && <div>
        <p className="ow-muted"><button type="button" className="st-link" onClick={() => setZones((z) => !z)}>{zones ? 'Hide' : 'Show'} safe zones</button> · red = covered by app UI, green = keep inside. Warnings appear when the logo or tagline crosses them.</p>
        {[...platforms, 'web'].map((p) => {
          const list = shown.filter((a) => a.platform === p);
          return list.length > 0 && <div key={p}>
            <h3>{NAMES[p as SocialPlatform] ?? 'Web & email'}</h3>
            <div className="sp-grid">{list.map((a) => <AssetCard key={a.file} a={a} o={outs.get(a.file)} zones={zones} pct={pct} />)}</div>
          </div>;
        })}
        <h3>Spec sources</h3>
        <div className="bi-table"><table><thead><tr><th>Platform</th><th>Item</th><th>Size</th><th>Note</th><th>Checked</th></tr></thead><tbody>
          {SPECS.map((s, i) => <tr key={i}><td>{s.platform}</td><td><a href={s.source} target="_blank" rel="noreferrer">{s.item}</a></td><td>{s.size}</td><td>{s.note}</td><td>{s.checked}</td></tr>)}
        </tbody></table></div>
      </div>}

      {tab === 'guide' && <div>
        <div className="ow-actions">
          <Button size="sm" onClick={() => { if (!printGuide(brand)) setErr('Pop-up blocked — allow pop-ups to print the guide.'); }}>Print / save PDF</Button>
          <Button size="sm" variant="ghost" onClick={() => download(new Blob([brandGuideHtml(brand)], { type: 'text/html' }), 'brand-guide.html')}>Download HTML</Button>
          <span className="ow-muted">Owner-only — not published on the site.</span>
        </div>
        <iframe title="Brand guide preview" className="bi-guide" srcDoc={brandGuideHtml(brand)} />
      </div>}

      {copy && tab !== 'guide' && (
        <div className="sp-copy">
          <h3>Profile copy</h3>
          {platforms.map((p) => copy.bios[p] && (
            <p key={p}><strong>{NAMES[p]} bio</strong> <span className="ow-muted">{[...copy.bios[p]!].length}/{SOCIAL_LIMITS[p].bio}</span><br />{copy.bios[p]} <button type="button" className="st-link" onClick={() => copyText(copy.bios[p]!)}>Copy</button></p>
          ))}
          {copy.handles.length > 0 && <p><strong>Handles:</strong> {copy.handles.map((h) => '@' + h).join(' · ')}</p>}
          {copy.pinned && <p><strong>Pinned post:</strong> {copy.pinned} <button type="button" className="st-link" onClick={() => copyText(copy.pinned)}>Copy</button></p>}
        </div>
      )}
    </section>
  );
}

function AssetCard({ a, o, zones, pct }: { a: PackAsset; o?: Out; zones: boolean; pct: (v: number) => string }) {
  const warn = o ? safeWarnings(o.keys, a.covers, a.safe) : [];
  return (
    <figure className="sp-asset">
      <div className="sp-frame" style={{ aspectRatio: `${a.w} / ${a.h}`, width: `min(100%, ${Math.round((420 * a.w) / a.h)}px)` }}>
        {o ? <img src={o.url} alt={`${a.platform} ${a.label}`} /> : <span className="ow-muted">Rendering…</span>}
        {zones && a.circle && <div className="sp-circle" style={a.type === 'highlight' ? { inset: '38.75% 20%' } : undefined} aria-hidden="true" />}
        {zones && a.covers?.map((c, i) => <div key={`c${i}`} className="sp-cover" style={{ left: pct(c.x), top: pct(c.y), width: pct(c.w), height: pct(c.h) }} title={c.label}><span>{c.label}</span></div>)}
        {zones && a.safe?.map((c, i) => <div key={`s${i}`} className="sp-safe" style={{ left: pct(c.x), top: pct(c.y), width: pct(c.w), height: pct(c.h) }} title={c.label}><span>{c.label}</span></div>)}
      </div>
      <figcaption>
        <strong>{a.label}</strong> <span className="ow-muted">{a.w}×{a.h}</span>
        <button type="button" className="st-link" disabled={!o} onClick={() => o && download(o.blob, a.file.replace('/', '-'))}>Download</button>
        {warn.map((w) => <span key={w} className="mk-warn">⚠ {w}</span>)}
      </figcaption>
    </figure>
  );
}

const CSS = `
.sp h3{margin:18px 0 8px}
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
.bi-row{display:flex;flex-wrap:wrap;gap:12px;align-items:end;margin:8px 0}
.bi-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}
.bi-grid figure{margin:0}.bi-logo svg{width:100%;height:120px;display:block;border-radius:8px;border:1px solid var(--line-2)}
.bi-cs{display:inline-block;background:repeating-linear-gradient(45deg,rgba(255,61,85,.18) 0 4px,transparent 4px 8px);outline:1px dashed #ff3d55}
.bi-cs svg{height:90px;width:auto;display:block;background:#05070d}
.bi-sw{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px}
.bi-swatch{display:grid;grid-template-columns:44px 1fr;column-gap:8px;align-items:center}.bi-swatch input{grid-row:span 3;width:44px;height:44px;border:0;padding:0;background:none}.bi-swatch small{color:var(--text-3)}
.bi-table{max-height:340px;overflow:auto}.bi-table table{border-collapse:collapse;width:100%;font-size:13px}.bi-table td,.bi-table th{padding:4px 8px;border-bottom:1px solid var(--line);text-align:left}
.bi-table tr.is-fail{opacity:.55}.bi-chip{display:inline-block;padding:2px 8px;border-radius:4px;font-weight:700}
.bi-type,.bi-usage{padding:16px;border-radius:10px}.bi-type div{margin:4px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bi-tag{color:#fff;font:800 11px system-ui;padding:3px 8px;border-radius:4px}.bi-cta{display:inline-block;padding:8px 16px;border-radius:999px;font-weight:700}
.bi-guide{width:100%;height:80vh;border:1px solid var(--line-2);border-radius:8px;background:#fff}
`;
