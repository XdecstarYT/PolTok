/**
 * Motion studio (owner tab): animate any card design and export MP4/WebM, GIF or a PNG frame;
 * build a multi-slide vertical story/reel. Uses only the public card API (renderCardCanvas).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../../../components';
import { useLive } from '../../../lib/live';
import { RACES } from '../../../data';
import { CARD_DESIGNS, cardDataFor, renderCardCanvas, type CardData, type CardKind, type CardStyle } from '../../../lib/cards';
import {
  MOTION_PRESETS, MOTION_SIZES, motionLayout, bestDesignFor, SAFE_ZONES, TRANSITIONS, renderMotionFrame, drawGuides, reelRenderer, reelDuration, presetById,
  exportVideo, exportGif, pickVideoMime, videoExt,
  type FrameFn, type MotionInput, type PresetId, type SafeZoneId, type Transition,
} from '../../../lib/motion';
import { loadPresets } from '../studio/presets';
import { download } from '../cards';
import './motion.css';

type Kind = 'race' | 'flip' | 'balance' | 'stat' | 'promo' | 'quote' | 'milestone' | 'announcement';
const KINDS: { id: Kind; label: string }[] = [
  { id: 'race', label: 'Race' }, { id: 'flip', label: 'Flip' }, { id: 'balance', label: 'Balance of power' }, { id: 'stat', label: 'Stat' },
  { id: 'promo', label: 'Promo' }, { id: 'quote', label: 'Quote / headline' }, { id: 'milestone', label: 'Milestone' }, { id: 'announcement', label: 'Announcement' },
];
const STATS = ['calls', 'flips', 'senate', 'house', 'au-marginal', 'au-polls-federal', 'au-polls-vic'];
const PROMOS = ['default', 'live', 'map', 'au', 'vic-countdown'];
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'card';

interface Slide { input: MotionInput; preset: PresetId; label: string }

export function MotionStudio() {
  const live = useLive();
  const [kind, setKind] = useState<Kind>('race');
  const [id, setId] = useState('');
  const [design, setDesign] = useState('broadcast');
  const presets = useMemo(() => loadPresets(), []);
  const [presetName, setPresetName] = useState('');
  const [anim, setAnim] = useState<PresetId>('election');
  const [duration, setDuration] = useState(10);
  const [sizeId, setSizeId] = useState<(typeof MOTION_SIZES)[number]['id']>('vertical');
  const [guides, setGuides] = useState<SafeZoneId | ''>('tiktok');
  const [caption, setCaption] = useState('');
  const [card, setCard] = useState<HTMLCanvasElement | null>(null);
  const [playing, setPlaying] = useState(true);
  const [t, setT] = useState(0);
  const [busy, setBusy] = useState('');
  const [prog, setProg] = useState(0);
  const [msg, setMsg] = useState('');
  const [music, setMusic] = useState<File | null>(null);
  const [musicOn, setMusicOn] = useState(false);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [mode, setMode] = useState<'card' | 'reel'>('card');
  const [transition, setTransition] = useState<Transition>('parallax');
  const [perSlide, setPerSlide] = useState(4);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const size = MOTION_SIZES.find((s) => s.id === sizeId)!;
  const vertical = size.h > size.w;

  const options = useMemo(() => {
    if (kind === 'race' || kind === 'flip') return [...RACES].sort((a, b) => Number(!!b.key) - Number(!!a.key) || a.title.localeCompare(b.title)).map((r) => ({ id: r.id, label: `${r.key ? '★ ' : ''}${r.title}` }));
    if (kind === 'balance') return [{ id: 'senate', label: 'Senate' }, { id: 'house', label: 'House' }];
    if (kind === 'stat') return STATS.map((p) => ({ id: p, label: p }));
    if (kind === 'promo') return PROMOS.map((p) => ({ id: p, label: p }));
    if (kind === 'quote') return (live.news ?? []).slice(0, 40).map((n) => ({ id: n.id, label: `${n.source}: ${n.title}`.slice(0, 90) })).concat([{ id: 'tagline', label: 'PolTok tagline' }]);
    return [{ id: 'blank', label: 'Blank message' }];
  }, [kind, live.news]);
  const subjId = options.some((o) => o.id === id) ? id : options[0]?.id ?? '';
  const designs = useMemo(() => CARD_DESIGNS.filter((d) => d.kinds.includes(kind as CardKind)), [kind]);
  const cardBox = motionLayout(size.w, size.h).card;
  const chosen = designs.some((d) => d.id === design) ? design : designs[0]?.id ?? 'broadcast';
  // vertical/square: switch to the closest-aspect design instead of letterboxing
  const designId = bestDesignFor(designs, cardBox, chosen)?.id ?? chosen;
  const swapped = designId !== chosen;
  const stamp = live.lastUpdate ? Math.floor(live.lastUpdate / 60000) : 0;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const data = useMemo<CardData>(() => cardDataFor(kind as CardKind, subjId, live), [kind, subjId, stamp, live.news]);
  const style = useMemo<CardStyle>(() => ({ ...(presets.find((p) => p.name === presetName)?.style ?? {}), size: { w: Math.round(cardBox.w), h: Math.round(cardBox.h) } }), [presets, presetName, cardBox.w, cardBox.h]);

  useEffect(() => {
    let off = false;
    renderCardCanvas(designId, data, style).then((c) => { if (!off) setCard(c); }).catch((e) => setMsg(String(e)));
    return () => { off = true; };
  }, [designId, data, style]);

  const input = useMemo<MotionInput | null>(() => (card ? { card, data, caption: caption.trim() || undefined } : null), [card, data, caption]);
  const reelOpts = useMemo(() => ({ slides: slides.map((s) => ({ input: s.input, preset: s.preset })), perSlide, transition, preset: anim }), [slides, perSlide, transition, anim]);
  const total = mode === 'reel' && slides.length ? reelDuration(reelOpts) : duration;
  const frame = useMemo<FrameFn | null>(() => {
    if (mode === 'reel') return slides.length ? reelRenderer(reelOpts) : null;
    if (!input) return null;
    const now = Date.now();
    return (c, tt) => renderMotionFrame(c, input, { preset: anim, duration, now }, tt);
  }, [mode, slides.length, reelOpts, input, anim, duration]);
  const W = mode === 'reel' ? 1080 : size.w, H = mode === 'reel' ? 1920 : size.h;

  // preview loop
  const tRef = useRef(0);
  useEffect(() => { tRef.current = Math.min(tRef.current, total); }, [total]);
  useEffect(() => {
    const cv = cvRef.current;
    if (!cv || !frame) return;
    cv.width = W; cv.height = H;
    const c = cv.getContext('2d')!;
    let raf = 0, last = performance.now();
    const tick = (now: number) => {
      if (playing) { tRef.current = (tRef.current + (now - last) / 1000) % total; setT(tRef.current); }
      last = now;
      frame(c, tRef.current);
      const gz = (mode === 'reel' || vertical) && guides ? guides : null;
      if (gz) drawGuides(c, W, H, gz);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [frame, playing, total, W, H, guides, vertical, mode]);

  const name = mode === 'reel' ? `poltok-reel-${slides.length}` : `poltok-${anim}-${slug(data.title)}-${size.id}`;
  const run = async (label: string, fn: (signal: AbortSignal) => Promise<void>) => {
    const ac = new AbortController();
    abortRef.current = ac;
    setBusy(label); setProg(0); setMsg('');
    try { await fn(ac.signal); } catch (e) { setMsg((e as Error).name === 'AbortError' ? 'Export cancelled' : `Export failed: ${(e as Error).message}`); }
    finally { setBusy(''); abortRef.current = null; }
  };
  const doVideo = (prefer: 'mp4' | 'webm') => frame && run('video', async (signal) => {
    const { blob, mime } = await exportVideo(frame, { width: W, height: H, duration: total, fps: 30, prefer, audio: musicOn ? music : null, onProgress: setProg, signal });
    download(blob, `${name}.${videoExt(mime)}`);
    setMsg(`Saved ${videoExt(mime).toUpperCase()} · ${(blob.size / 1e6).toFixed(1)} MB · ${mime}`);
  });
  const doGif = () => frame && run('gif', async (signal) => {
    const d = Math.min(total, 8);
    const blob = await exportGif(frame, { width: W, height: H, duration: d, fps: 15, maxSide: 540, onProgress: setProg, signal });
    download(blob, `${name}.gif`);
    setMsg(`Saved GIF · ${(blob.size / 1e6).toFixed(1)} MB${total > 8 ? ' (first 8 s — GIFs are for short loops)' : ''}`);
  });
  const doPng = () => {
    if (!frame) return;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    frame(cv.getContext('2d')!, tRef.current);
    cv.toBlob((b) => b && download(b, `${name}-${tRef.current.toFixed(1)}s.png`), 'image/png');
  };
  const addSlide = async () => {
    const box = motionLayout(1080, 1920).card;
    const did = bestDesignFor(designs, box, chosen)?.id ?? designId;
    const c = await renderCardCanvas(did, data, { ...style, size: { w: Math.round(box.w), h: Math.round(box.h) } });
    setSlides((s) => [...s, { input: { card: c, data, caption: caption.trim() || undefined }, preset: anim, label: `${presetById(anim).label} · ${data.title}`.slice(0, 70) }]);
    setMsg('Slide added to reel');
  };
  const move = (i: number, d: number) => setSlides((s) => { const n = [...s]; const j = i + d; if (j < 0 || j >= n.length) return s; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const mime = useMemo(() => pickVideoMime('auto'), []);

  return (
    <div className="mo">
      <div className="mo-grid">
        <aside className="mo-side">
          <fieldset className="mo-box"><legend>Card</legend>
            <label className="ow-field">Subject<select className="ow-select" value={kind} onChange={(e) => setKind(e.target.value as Kind)}>{KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}</select></label>
            <label className="ow-field">Item<select className="ow-select" value={subjId} onChange={(e) => setId(e.target.value)}>{options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
            <label className="ow-field">Design<select className="ow-select" value={chosen} onChange={(e) => setDesign(e.target.value)}>{designs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
            {swapped && <small className="ow-muted">Using “{designs.find((d) => d.id === designId)?.name}” — closest layout for {size.w}×{size.h} (the chosen design would letterbox).</small>}
            <label className="ow-field">Style preset<select className="ow-select" value={presetName} onChange={(e) => setPresetName(e.target.value)}><option value="">Design default</option>{presets.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}</select></label>
            <label className="ow-field">Caption (optional)<input className="ow-select" value={caption} maxLength={200} placeholder="Shown in the caption strip (empty = follow line)" onChange={(e) => setCaption(e.target.value)} /></label>
          </fieldset>
          <fieldset className="mo-box"><legend>Animation</legend>
            <div className="mo-presets" role="radiogroup" aria-label="Animation preset">
              {MOTION_PRESETS.map((p) => (
                <button key={p.id} type="button" role="radio" aria-checked={anim === p.id} className={`mo-preset${anim === p.id ? ' is-on' : ''}`} onClick={() => { setAnim(p.id); setDuration(p.defaultDuration); }}>
                  <b>{p.label}</b><small>{p.blurb}</small>
                </button>
              ))}
            </div>
            <label className="ow-field">Length {duration}s<input type="range" min={6} max={15} step={1} value={duration} onChange={(e) => setDuration(Number(e.target.value))} /></label>
            <label className="ow-field">Size<select className="ow-select" value={sizeId} onChange={(e) => setSizeId(e.target.value as typeof sizeId)}>{MOTION_SIZES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
            <label className="ow-field">Safe-zone guides (vertical preview only)<select className="ow-select" value={guides} onChange={(e) => setGuides(e.target.value as SafeZoneId | '')}><option value="">Off</option>{(Object.keys(SAFE_ZONES) as SafeZoneId[]).map((z) => <option key={z} value={z}>{SAFE_ZONES[z].label}</option>)}</select></label>
          </fieldset>
          <fieldset className="mo-box"><legend>Music (off by default)</legend>
            <label className="mo-check"><input type="checkbox" checked={musicOn} disabled={!music} onChange={(e) => setMusicOn(e.target.checked)} /> Add background audio to video</label>
            <input type="file" accept="audio/*" onChange={(e) => { const f0 = e.target.files?.[0] ?? null; setMusic(f0); setMusicOn(!!f0); }} />
            <small className="ow-muted">Your own file only — nothing is bundled or uploaded. Make sure you have the rights to use it.</small>
          </fieldset>
        </aside>
        <section className="mo-main">
          <div className="mo-tabs">
            <Button size="sm" variant={mode === 'card' ? 'primary' : 'ghost'} onClick={() => setMode('card')}>Single card</Button>
            <Button size="sm" variant={mode === 'reel' ? 'primary' : 'ghost'} onClick={() => setMode('reel')}>Story / reel ({slides.length})</Button>
          </div>
          <div className={`mo-stage${H > W ? ' is-tall' : ''}`}>
            {frame ? <canvas ref={cvRef} className="mo-canvas" aria-label="Animation preview" /> : <p className="ow-muted">{mode === 'reel' ? 'Add slides from the card editor to build a reel.' : 'Rendering card…'}</p>}
          </div>
          <div className="mo-transport">
            <Button size="sm" variant="ghost" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause' : 'Play'}>{playing ? '❚❚ Pause' : '▶ Play'}</Button>
            <input className="mo-scrub" type="range" min={0} max={total} step={1 / 30} value={Math.min(t, total)} aria-label="Scrub timeline"
              onChange={(e) => { setPlaying(false); tRef.current = Number(e.target.value); setT(tRef.current); }} />
            <span className="mo-time">{t.toFixed(1)} / {total.toFixed(1)}s</span>
          </div>
          <div className="mo-export">
            <Button size="sm" disabled={!!busy || !frame || !mime} onClick={() => doVideo('mp4')}>{mime?.startsWith('video/mp4') ? 'Export MP4' : 'Export video (WebM)'}</Button>
            <Button size="sm" variant="ghost" disabled={!!busy || !frame || !mime} onClick={() => doVideo('webm')}>WebM</Button>
            <Button size="sm" variant="ghost" disabled={!!busy || !frame} onClick={doGif}>GIF loop</Button>
            <Button size="sm" variant="ghost" disabled={!frame} onClick={doPng}>PNG frame</Button>
            {busy && <><progress max={1} value={prog} aria-label={`Exporting ${busy}`} /> <Button size="sm" variant="ghost" onClick={() => abortRef.current?.abort()}>Cancel</Button></>}
          </div>
          <p className="ow-muted mo-note" role="status">{msg || (busy === 'video' ? 'Recording in real time — keep this tab visible.' : `${W}×${H} · 30 fps · ${mime ?? 'video recording unsupported in this browser'}`)}</p>
          {mode === 'card' ? (
            <Button size="sm" variant="ghost" disabled={!input} onClick={addSlide}>+ Add this card to reel</Button>
          ) : (
            <fieldset className="mo-box"><legend>Reel (vertical 1080×1920)</legend>
              <div className="mo-row">
                <label className="ow-field">Transition<select className="ow-select" value={transition} onChange={(e) => setTransition(e.target.value as Transition)}>{TRANSITIONS.map((x) => <option key={x}>{x}</option>)}</select></label>
                <label className="ow-field">Seconds per slide {perSlide}<input type="range" min={2} max={8} value={perSlide} onChange={(e) => setPerSlide(Number(e.target.value))} /></label>
              </div>
              <ol className="mo-slides">
                {slides.map((s, i) => (
                  <li key={i}><span>{s.label}</span>
                    <button type="button" className="mo-x" onClick={() => move(i, -1)} aria-label="Move up">↑</button>
                    <button type="button" className="mo-x" onClick={() => move(i, 1)} aria-label="Move down">↓</button>
                    <button type="button" className="mo-x" onClick={() => setSlides((x) => x.filter((_, k) => k !== i))} aria-label="Remove">×</button>
                  </li>
                ))}
              </ol>
              {!slides.length && <p className="ow-muted">Switch to “Single card”, pick a card + animation, then “Add this card to reel”. Each slide keeps its own animation and caption.</p>}
              {total > 60 && <p className="ow-muted">Over 60 s — some platforms trim long videos.</p>}
            </fieldset>
          )}
        </section>
      </div>
    </div>
  );
}

export default MotionStudio;
