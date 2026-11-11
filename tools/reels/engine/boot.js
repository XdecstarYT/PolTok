// Page bootstrap: load bundle + fonts + reel module, build scenes, expose __frame(t) for the renderer.
import * as THREE from 'three';
import { E, initRenderer, buildScenes, renderFrame } from './core.js';
import * as kit from './kit.js';
import * as ui from './ui.js';
import { endCard } from './blocks.js';

const q = new URLSearchParams(location.search);
const id = q.get('reel');
const dpr = +(q.get('dpr') || 1);
try {
  const bundle = await (await fetch(`/.cache/${id}/bundle.json`)).json();
  E.tl = bundle.timeline; E.data = bundle.data; E.geo = bundle.geo; E.meta = bundle.meta;
  const faces = ['700 20px Newsreader', '600 20px Newsreader', 'italic 600 20px Newsreader', '800 20px Newsreader', '500 20px "Inter Tight"', '600 20px "Inter Tight"', '700 20px "Inter Tight"', '800 20px "Inter Tight"', '900 20px "Inter Tight"', '700 20px "JetBrains Mono"', '500 20px "JetBrains Mono"'];
  await Promise.all(faces.map((f) => document.fonts.load(f, 'Aā0')));
  await document.fonts.ready;
  await Promise.all([kit.loadFont('sans', '/fonts/InterTight-900.ttf'), kit.loadFont('serif', '/fonts/Newsreader-800.ttf'), kit.loadFont('sans8', '/fonts/InterTight-800.ttf')]);
  E.svgMark = await (await fetch('/brand/favicon.svg')).text();
  initRenderer(dpr);
  const mod = await import(`/reels/${id}.js`);
  const api = { E, kit, ui, THREE, endCard };
  ui.scrims();
  mod.build(api);
  buildScenes();
  ui.chrome({ label: E.meta.label || 'EXPLAINED', cls: E.meta.labelCls });
  ui.captions(E.tl.captions);
  if (q.get('guides')) ui.safeGuides();
  if (E.data && E.data.__mock) { const w = document.createElement('div'); w.textContent = 'TEST DATA · NOT REAL'; w.style.cssText = 'position:absolute;top:900px;left:0;right:0;text-align:center;font:900 90px Inter Tight;color:rgba(255,0,80,.55);transform:rotate(-20deg);z-index:50'; document.body.appendChild(w); }
  window.__frame = (t) => renderFrame(t);
  window.__meta = () => ({ cues: E.cues.sort((a, b) => a.t - b.t) });
  window.__audit = () => ui.audit();
  // warm up shaders
  renderFrame(0.01);
  window.__ready = true;
} catch (e) {
  console.error(e);
  window.__error = String(e && e.stack || e);
}
