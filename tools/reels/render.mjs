#!/usr/bin/env node
// PolTok reel engine — renderer / CLI.
//
//   node tools/reels/render.mjs <reel-id> [options]
//
//   --stills 1.2,5,9.5     render only these times (seconds) to PNG (use with --dpr 0.5 for fast previews)
//   --dpr 0.5              device pixel ratio (1 = 1080x1920 final)
//   --guides               draw the platform safe areas on stills
//   --no-vo                skip the voiceover even if piper is available
//   --workers 3            parallel browser pages for the full render
//   --out DIR              output directory for the MP4 / cover (default docs/social)
//   --sheet DIR            write a contact sheet of key frames to DIR
//   --frames 0-120         render only a frame range (debug)
//
// Reels live in tools/reels/reels/<id>.js. Each exports:
//   meta    { title, label, music:{prog,arp,seed,swing}, voice:{lengthScale}, cover:<seconds>, geo:{name: spec} }
//   scenes  [{ id, beats, energy, trans:{type:'whip'|'zoom'|'fade'|'flash'|'cut', dir, dur}, say, cap }]
//   data    optional async () => json (runs in Node at render time; throw to abort)
//   build   ({E, kit, ui, THREE}) => void   (runs in the page; defines one builder per scene id)
//
// Voiceover: set REELS_PIPER_DIR to a folder containing a pip `--target` install of piper-tts (pylib/)
// and a voice model (*.onnx + .onnx.json); otherwise the reel renders with music + captions only.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { buildGeo } from './engine/geo.mjs';
import { renderMix, writeWav, readWavMono, SR } from './engine/audio.mjs';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const FPS = 30;

// ---------- args ----------
const argv = process.argv.slice(2);
const id = argv[0];
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true; };
if (!id) { console.error('usage: node tools/reels/render.mjs <reel-id> [--stills t,t] [--dpr 0.5]'); process.exit(1); }
const stills = opt('stills', null);
const dpr = +opt('dpr', stills ? 0.5 : 1);
const workers = +opt('workers', 3);
const outDir = path.resolve(opt('out', path.join(ROOT, 'docs/social')));
const cacheDir = path.join(HERE, '.cache', id);
fs.mkdirSync(cacheDir, { recursive: true });
const log = (...a) => console.log(`[${id}]`, ...a);

const mod = await import(pathToFileURL(path.join(HERE, 'reels', id + '.js')).href + '?v=' + Date.now());
const meta = mod.meta || {};

// ---------- data (Node side, e.g. live API) ----------
let data = null;
const mock = process.env.REELS_MOCK_DATA;
if (mod.data && mock) {
  // layout testing only: stills with a TEST DATA watermark; the full render refuses to run
  if (!stills) { console.error(`[${id}] REELS_MOCK_DATA is for --stills previews only`); process.exit(3); }
  data = { ...JSON.parse(fs.readFileSync(mock, 'utf8')), __mock: true };
  log('MOCK DATA (layout test only)');
} else if (mod.data) {
  try { data = await mod.data(); }
  catch (e) { console.error(`[${id}] DATA FAILED: ${e.message}`); process.exit(2); }
  fs.writeFileSync(path.join(cacheDir, 'data.json'), JSON.stringify(data, null, 1));
  log('data ok');
}
const scenesDef = typeof mod.scenes === 'function' ? mod.scenes(data) : mod.scenes;

// ---------- geo ----------
const geo = {};
for (const [k, spec] of Object.entries(meta.geo || {})) geo[k] = buildGeo(ROOT, spec);

// ---------- voiceover ----------
const piperDir = process.env.REELS_PIPER_DIR;
const useVO = !opt('no-vo', false) && piperDir && fs.existsSync(piperDir) && meta.voice !== false;
const voDir = path.join(HERE, '.cache', 'vo');
fs.mkdirSync(voDir, { recursive: true });
function synth(text, ls) {
  const model = fs.readdirSync(piperDir).find((f) => f.endsWith('.onnx') && f.includes(meta.voice?.model || 'cori'));
  const h = crypto.createHash('sha1').update(text + '|' + ls + '|' + model).digest('hex').slice(0, 16);
  const raw = path.join(voDir, h + '.raw.wav'), wav = path.join(voDir, h + '.wav');
  if (!fs.existsSync(wav)) {
    const r = spawnSync('python3', ['-m', 'piper', '-m', path.join(piperDir, model), '-f', raw, '--length-scale', String(ls), '--sentence-silence', '0.15'], { input: text, env: { ...process.env, PYTHONPATH: path.join(piperDir, 'pylib') } });
    if (r.status !== 0) throw new Error('piper failed: ' + r.stderr);
    // resample to 48k + gentle broadcast chain
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-af', 'highpass=f=80,equalizer=f=220:t=q:w=1:g=-2,equalizer=f=3200:t=q:w=1.2:g=2.5,acompressor=threshold=-20dB:ratio=3:attack=4:release=90:makeup=3,aresample=48000', '-ac', '1', '-c:a', 'pcm_s16le', wav]);
  }
  const { pcm } = readWavMono(wav);
  // trim silence
  let a = 0, b = pcm.length - 1;
  while (a < b && Math.abs(pcm[a]) < 0.01) a++;
  while (b > a && Math.abs(pcm[b]) < 0.01) b--;
  const out = pcm.slice(Math.max(0, a - 480), Math.min(pcm.length, b + 2400));
  let pk = 0; for (const v of out) pk = Math.max(pk, Math.abs(v));
  for (let i = 0; i < out.length; i++) out[i] *= 0.7 / (pk || 1);
  return out;
}

// ---------- timeline ----------
const bpm = meta.bpm || 120, beat = 60 / bpm;
const voLines = [];
let t = 0;
const tlScenes = [];
for (const s of scenesDef) {
  let beats = s.beats ?? 8;
  const lead = s.voLead ?? 0.22;
  let vo = null;
  if (useVO && s.say) {
    const pcm = synth(s.say, s.lengthScale ?? meta.voice?.lengthScale ?? 0.92);
    vo = { t: t + lead, pcm, dur: pcm.length / SR };
    const need = Math.ceil((lead + vo.dur + (s.voTail ?? 0.3)) / beat);
    if (need > beats) { log(`scene ${s.id}: stretched ${beats} -> ${need} beats for VO`); beats = need; }
    voLines.push(vo);
  }
  const t0 = t, t1 = t + beats * beat;
  tlScenes.push({ id: s.id, t0: +t0.toFixed(4), t1: +t1.toFixed(4), energy: s.energy ?? 1, trans: s.trans || null, noProgress: !!s.noProgress, opts: s.opts || {},
    cap: s.cap || null, voT0: vo ? vo.t : null, voDur: vo ? vo.dur : null });
  t = t1;
}
const duration = +t.toFixed(4);
// captions: chunk each scene's cap and time it across the VO (or a reading-speed estimate)
function chunk(text, max = 30) {
  const words = text.split(/\s+/), out = [];
  let cur = '';
  for (const w of words) {
    if (cur && (cur + ' ' + w).length > max) { out.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w;
    if (/[.,;:!?]$/.test(w) && cur.length > max * 0.55) { out.push(cur); cur = ''; }
  }
  if (cur) out.push(cur);
  return out;
}
const captions = [];
for (const s of tlScenes) {
  if (!s.cap) continue;
  const parts = chunk(s.cap, meta.capChars || 34);
  const t0 = s.voT0 ?? s.t0 + 0.35;
  const span = s.voDur ?? Math.min(s.t1 - s.t0 - 0.6, s.cap.split(/\s+/).length / 2.7);
  const tot = parts.reduce((a, p) => a + p.length, 0);
  let c = t0;
  parts.forEach((p, i) => {
    const d = (span * p.length) / tot;
    captions.push({ t0: +c.toFixed(3), t1: +(i === parts.length - 1 ? Math.min(s.t1 - 0.12, c + d + 0.45) : c + d).toFixed(3), text: p });
    c += d;
  });
}
const timeline = { fps: FPS, bpm, beat, origin: tlScenes[1]?.t0 ?? 0, duration, scenes: tlScenes, captions, vo: !!voLines.length };
fs.writeFileSync(path.join(cacheDir, 'bundle.json'), JSON.stringify({ timeline, data, geo, meta: { label: meta.label, labelCls: meta.labelCls, title: meta.title } }));
log(`timeline ${duration.toFixed(2)}s, ${tlScenes.length} scenes, VO ${voLines.length ? 'on' : 'off'}`);
for (const s of tlScenes) log(`  ${s.id.padEnd(12)} ${s.t0.toFixed(2)}–${s.t1.toFixed(2)}${s.voDur ? `  vo ${s.voDur.toFixed(2)}s` : ''}`);

// ---------- static server ----------
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0]);
  let f;
  if (u.startsWith('/three/')) f = path.join(ROOT, 'node_modules/three', u.slice(7));
  else if (u === '/brand/favicon.svg') f = path.join(ROOT, 'public/favicon.svg');
  else f = path.join(HERE, u);
  if (!f.startsWith(ROOT)) { r.writeHead(403); return r.end(); }
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); r.end(d); });
});
await new Promise((res) => server.listen(0, res));
const PORT = server.address().port;

let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-vsync'] });
async function openPage() {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: dpr });
  page.on('pageerror', (e) => console.error('PAGE ERROR', e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.error('console:', m.text()); });
  await page.goto(`http://127.0.0.1:${PORT}/engine/player.html?reel=${id}&dpr=${dpr}${opt('guides', false) ? '&guides=1' : ''}`);
  await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 180000 });
  const err = await page.evaluate(() => window.__error);
  if (err) throw new Error('page boot failed: ' + err);
  return page;
}
const shot = async (page, t, file, type = 'jpeg') => {
  // generous timeouts + retries: software GL is slow, and other jobs may share the CPU
  for (let a = 0; ; a++) {
    try {
      await page.evaluate((t) => window.__frame(t), t);
      return await page.screenshot({ path: file, type, timeout: 300000, ...(type === 'jpeg' ? { quality: 93 } : {}) });
    } catch (e) { if (a >= 2) throw e; log(`retry frame t=${t} (${e.name})`); }
  }
};

try {
  const page = await openPage();
  const cues = await page.evaluate(() => window.__meta().cues);
  fs.writeFileSync(path.join(cacheDir, 'cues.json'), JSON.stringify(cues));

  if (stills) {
    const dir = path.join(cacheDir, 'stills');
    fs.mkdirSync(dir, { recursive: true });
    const times = stills === 'auto' ? autoTimes() : String(stills).split(',').map(Number);
    for (const tt of times) {
      const f = path.join(dir, `t${tt.toFixed(2).padStart(6, '0')}.png`);
      const t0 = Date.now();
      await shot(page, tt, f, 'png');
      const a = await page.evaluate(() => window.__audit());
      log(`still ${tt}s -> ${f} (${Date.now() - t0}ms)${a.length ? '  SAFE-AREA: ' + JSON.stringify(a) : ''}`);
    }
  } else {
    // ---------- full render ----------
    const fdir = path.join(cacheDir, 'frames');
    fs.rmSync(fdir, { recursive: true, force: true });
    fs.mkdirSync(fdir, { recursive: true });
    const total = Math.round(duration * FPS);
    const [fa, fb] = opt('frames', null) ? String(opt('frames')).split('-').map(Number) : [0, total - 1];
    const pages = [page];
    for (let w = 1; w < workers; w++) pages.push(await openPage());
    let next = fa, done = 0;
    const t0 = Date.now();
    const audits = [];
    await Promise.all(pages.map(async (p) => {
      while (next <= fb) {
        const f = next++;
        await shot(p, f / FPS, path.join(fdir, String(f).padStart(5, '0') + '.jpg'));
        if (f % 15 === 0) { const a = await p.evaluate(() => window.__audit()); if (a.length) audits.push({ f, a }); }
        if (++done % 60 === 0) log(`${done}/${fb - fa + 1} frames  ${((Date.now() - t0) / done).toFixed(0)}ms/frame`);
      }
    }));
    // a violation counts only if the same element is still out of bounds 0.5 s later (ignores mid-animation frames)
    audits.sort((p, q) => p.f - q.f);
    const key = (v) => v.cls + '|' + v.text;
    const persistent = [];
    for (let i = 1; i < audits.length; i++) {
      if (audits[i].f - audits[i - 1].f !== 15) continue;
      const prev = new Set(audits[i - 1].a.map(key));
      for (const v of audits[i].a) if (prev.has(key(v))) persistent.push({ f: audits[i].f, v });
    }
    if (persistent.length) { log('SAFE-AREA warnings (persistent):'); for (const x of persistent.slice(0, 20)) log('  frame', x.f, JSON.stringify(x.v)); }
    else log(`safe-area audit: clean (${audits.length} transient flags during motion ignored)`);

    // ---------- audio ----------
    const music = { ...(meta.music || {}) };
    const mix = renderMix({ duration, tl: timeline, music, cues, vo: voLines.map((v) => ({ t: v.t, pcm: v.pcm })) });
    const wav = path.join(cacheDir, 'audio.wav');
    writeWav(wav, mix.L, mix.R);
    log('audio ok');

    // ---------- encode ----------
    fs.mkdirSync(outDir, { recursive: true });
    const base = meta.out || `poltok-${id}`;
    const mp4 = path.join(outDir, base + '.mp4');
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-start_number', String(fa), '-i', path.join(fdir, '%05d.jpg'), '-i', wav,
      '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-profile:v', 'high', '-level', '4.2', '-pix_fmt', 'yuv420p', '-r', String(FPS),
      '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', '-shortest', mp4], { stdio: 'inherit' });
    log('wrote', mp4);
    // cover
    const coverF = Math.round((meta.cover ?? 3) * FPS);
    const cover = path.join(outDir, base + '-cover.jpg');
    fs.copyFileSync(path.join(fdir, String(Math.min(coverF, fb)).padStart(5, '0') + '.jpg'), cover);
    log('wrote', cover);
    // contact sheet
    const sheetDir = opt('sheet', null);
    if (sheetDir) {
      const ts = autoTimes();
      const list = ts.map((x) => path.join(fdir, String(Math.min(fb, Math.round(x * FPS))).padStart(5, '0') + '.jpg'));
      const sheet = path.join(sheetDir, `${id}-sheet.jpg`);
      const inputs = list.flatMap((f) => ['-i', f]);
      const cols = Math.min(6, list.length), rows = Math.ceil(list.length / cols);
      const filt = list.map((_, i) => `[${i}:v]scale=270:480[s${i}]`).join(';') + ';' + list.map((_, i) => `[s${i}]`).join('') + `xstack=inputs=${list.length}:layout=${list.map((_, i) => `${(i % cols) * 270}_${Math.floor(i / cols) * 480}`).join('|')}:fill=black[o]`;
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', filt, '-map', '[o]', '-q:v', '3', sheet]);
      log('sheet', sheet, `${cols}x${rows}`);
    }
  }
} finally {
  await browser.close();
  server.close();
}

function autoTimes() {
  // one frame from the middle-late part of each scene (text fully in) + the hook
  return tlScenes.map((s) => +(s.id === 'hook' ? Math.min(s.t1 - 0.25, s.t0 + 1.1) : s.t0 + Math.min(s.t1 - s.t0 - 0.5, (s.t1 - s.t0) * 0.62)).toFixed(2));
}
