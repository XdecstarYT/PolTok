// Procedural WebAudio SFX for QUORUM. No samples. One lazily-created AudioContext.
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
let volume = 0.8;
let lastTick = 0;
let bed: { stop: () => void } | null = null;

function ac(): AudioContext | null {
  if (muted) return null;
  try {
    if (!ctx) {
      const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!C) return null;
      ctx = new C();
      master = ctx.createGain();
      master.gain.value = 0.4 * volume;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch { return null; }
}

export function setAudio(opts: { muted?: boolean; volume?: number }) {
  if (opts.muted !== undefined) muted = opts.muted;
  if (opts.volume !== undefined) volume = opts.volume;
  if (master) master.gain.value = muted ? 0 : 0.4 * volume;
  if (muted) stopBed();
  music.refresh();
}

function tone(freq: number, dur: number, type: OscillatorType, gain = 0.5, at = 0, endFreq?: number, filter?: BiquadFilterNode) {
  const c = ac(); if (!c || !master) return;
  const t = c.currentTime + at;
  const o = c.createOscillator(); const g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); (filter ? (g.connect(filter), filter) : g).connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

function noise(dur: number, freq: number, q = 1, gain = 0.4, at = 0, type: BiquadFilterType = 'bandpass') {
  const c = ac(); if (!c || !master) return;
  const t = c.currentTime + at;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = c.createGain(); g.gain.value = gain;
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

export const sfx = {
  click: () => noise(0.002 + 0.01, 2000, 2, 0.35),
  gavel: () => { tone(80, 0.12, 'sine', 0.9, 0, 40); noise(0.02, 3000, 1, 0.5); tone(80, 0.12, 'sine', 0.7, 0.18, 40); noise(0.02, 3000, 1, 0.4, 0.18); },
  tick: (yes: boolean) => {
    const now = performance.now(); if (now - lastTick < 25) return; lastTick = now;
    tone(yes ? 880 : 220, 0.03, yes ? 'triangle' : 'square', yes ? 0.18 : 0.08);
  },
  ballot: () => { noise(0.06, 1200, 0.8, 0.3); tone(520, 0.05, 'triangle', 0.15, 0.04); },
  passed: () => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.18, 'triangle', 0.35, i * 0.09)),
  cheer: () => { for (let i = 0; i < 6; i++) noise(0.35, 900 + i * 300, 0.6, 0.12, i * 0.05); sfx.passed(); },
  failed: () => {
    const c = ac(); if (!c) return;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.connect(master!);
    tone(311.13, 0.28, 'sawtooth', 0.25, 0, undefined, lp);
    tone(293.66, 0.45, 'sawtooth', 0.25, 0.26, undefined, lp);
  },
  flip: () => { tone(660, 0.08, 'triangle', 0.22); tone(990, 0.12, 'triangle', 0.2, 0.06); noise(0.05, 4000, 2, 0.12); },
  paper: () => { noise(0.18, 1800, 0.7, 0.18); noise(0.12, 900, 0.7, 0.12, 0.1); },
  coin: () => { tone(1320, 0.09, 'sine', 0.25); tone(1760, 0.14, 'sine', 0.25, 0.07); },
  era: () => [261.63, 329.63, 392, 493.88].forEach((f, i) => tone(f, 1.6 - i * 0.2, 'sine', 0.16, i * 0.25)),
};

/** Election night drone: two detuned sines + a filtered noise pulse each second. */
export function startBed() {
  const c = ac(); if (!c || !master || bed) return;
  const g = c.createGain(); g.gain.value = 0.0001; g.gain.exponentialRampToValueAtTime(0.18, c.currentTime + 1);
  g.connect(master);
  const oscs = [55, 55.4].map((f) => { const o = c.createOscillator(); o.frequency.value = f; o.connect(g); o.start(); return o; });
  const iv = window.setInterval(() => noise(0.15, 400, 2, 0.12), 1000);
  bed = {
    stop: () => {
      window.clearInterval(iv);
      try { g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.4); oscs.forEach((o) => o.stop(c.currentTime + 0.5)); } catch { /* ignore */ }
    },
  };
}
export function stopBed() { bed?.stop(); bed = null; }

export function haptic(ms = 10) { try { navigator.vibrate?.(ms); } catch { /* unsupported */ } }

// ---------------------------------------------------------------- adaptive procedural music
// A quiet ambient loop per era, built from scheduled oscillators. Tension (0..1) rises during votes and
// election nights: faster pulse, brighter filter, timpani. Nothing is created until unlockMusic() runs
// inside a user gesture, so no AudioContext exists before the player interacts.

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
interface EraScore { bpm: number; chords: number[][]; scale: number[]; lead: OscillatorType; bass: OscillatorType; cutoff: number }
const SCORES: Record<number, EraScore> = {
  // Lamp Era: D dorian, music-box plucks over warm pads
  1: { bpm: 62, chords: [[50, 57, 62, 65], [48, 55, 60, 64], [43, 55, 59, 62], [50, 57, 62, 65]], scale: [62, 64, 65, 67, 69, 71, 72, 74, 76], lead: 'triangle', bass: 'sine', cutoff: 1400 },
  // Smokestack Era: A minor, heavier, low square lead
  2: { bpm: 70, chords: [[45, 52, 57, 60], [41, 53, 57, 60], [38, 50, 53, 57], [40, 52, 56, 59]], scale: [57, 59, 60, 62, 64, 65, 67, 69, 72], lead: 'square', bass: 'triangle', cutoff: 1000 },
  // Signal Era: F lydian, bright bells
  3: { bpm: 78, chords: [[41, 53, 57, 64], [43, 55, 59, 62], [45, 52, 57, 60], [41, 53, 57, 64]], scale: [65, 67, 69, 71, 72, 74, 76, 77, 79], lead: 'sine', bass: 'sine', cutoff: 2200 },
};

const mus = {
  unlocked: false, enabled: true, volume: 0.5, era: 1, tension: 0, tensionNow: 0,
  bus: null as GainNode | null, filter: null as BiquadFilterNode | null, verb: null as ConvolverNode | null,
  timer: 0, next: 0, step: 0, playing: false,
};

function musicTarget() { return mus.enabled && !muted ? 0.32 * mus.volume : 0; }

function buildMusicGraph(c: AudioContext) {
  if (mus.bus) return;
  mus.bus = c.createGain(); mus.bus.gain.value = 0.0001;
  mus.filter = c.createBiquadFilter(); mus.filter.type = 'lowpass'; mus.filter.frequency.value = SCORES[mus.era].cutoff; mus.filter.Q.value = 0.4;
  // generated reverb impulse
  const len = Math.floor(c.sampleRate * 2.6); const ir = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4); }
  mus.verb = c.createConvolver(); mus.verb.buffer = ir;
  const wet = c.createGain(); wet.gain.value = 0.55; const dry = c.createGain(); dry.gain.value = 0.6;
  mus.filter.connect(dry).connect(mus.bus);
  mus.filter.connect(mus.verb).connect(wet).connect(mus.bus);
  mus.bus.connect(c.destination);
}

function mvoice(c: AudioContext, type: OscillatorType, f: number, t: number, dur: number, gain: number, attack: number, release: number, detune = 0) {
  if (!mus.filter) return;
  const o = c.createOscillator(); const g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = detune;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.setValueAtTime(gain, t + Math.max(attack, dur - release));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(mus.filter);
  o.start(t); o.stop(t + dur + 0.05);
}

function scheduleStep(c: AudioContext, t: number) {
  const sc = SCORES[mus.era] ?? SCORES[1];
  const T = mus.tensionNow;
  const beat = 60 / (sc.bpm + T * 34);
  const bar = Math.floor(mus.step / 4) % sc.chords.length;
  const inBar = mus.step % 4;
  const chord = sc.chords[bar];
  if (inBar === 0) {
    // pad: soft detuned chord across the bar
    for (const n of chord.slice(1)) { mvoice(c, 'triangle', midi(n), t, beat * 4.4, 0.05, beat * 1.2, beat * 1.6, -6); mvoice(c, 'sine', midi(n), t, beat * 4.4, 0.05, beat * 1.4, beat * 1.6, 5); }
    mvoice(c, sc.bass, midi(chord[0] - 12), t, beat * 3.6, 0.13, 0.08, beat * 1.5);
  }
  // sparse melody; busier and higher under tension
  if (Math.random() < 0.3 + T * 0.45) {
    const pool = Math.random() < 0.6 ? chord.slice(1).map((n) => n + 12) : sc.scale;
    const n = pool[Math.floor(Math.random() * pool.length)];
    const pl = sc.lead === 'square' ? 0.018 : 0.06;
    mvoice(c, sc.lead, midi(n), t + (Math.random() < 0.3 ? beat / 2 : 0), beat * 1.6, pl, 0.01, beat * 1.4);
    if (mus.era === 3) mvoice(c, 'sine', midi(n) * 2.01, t, beat, 0.015, 0.005, beat * 0.9);
  }
  // Smokestack machinery tick on off-beats
  if (mus.era === 2 && inBar % 2 === 1) noiseTo(c, t, 0.04, 2400, 0.03);
  // tension: timpani heartbeat + tremolo string
  if (T > 0.25) {
    const o = c.createOscillator(); const g = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.25);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22 * T, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.connect(g).connect(mus.filter!); o.start(t); o.stop(t + 0.4);
    if (inBar === 0) mvoice(c, 'sawtooth', midi(chord[1] + 12), t, beat * 4, 0.012 + 0.02 * T, beat, beat);
  }
}

function noiseTo(c: AudioContext, t: number, dur: number, freq: number, gain: number) {
  if (!mus.filter) return;
  const len = Math.max(1, Math.floor(c.sampleRate * dur)); const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 3;
  const g = c.createGain(); g.gain.value = gain;
  src.connect(f).connect(g).connect(mus.filter); src.start(t);
}

function tickMusic() {
  const c = ctx; if (!c || !mus.bus || !mus.filter) return;
  mus.tensionNow += (mus.tension - mus.tensionNow) * 0.08;
  const sc = SCORES[mus.era] ?? SCORES[1];
  mus.filter.frequency.setTargetAtTime(sc.cutoff + mus.tensionNow * 2400, c.currentTime, 0.4);
  if (mus.next < c.currentTime) mus.next = c.currentTime + 0.05;
  while (mus.next < c.currentTime + 0.4) {
    scheduleStep(c, mus.next);
    mus.next += 60 / ((sc.bpm) + mus.tensionNow * 34);
    mus.step++;
  }
}

function syncMusic() {
  if (!mus.unlocked) return;
  const want = musicTarget() > 0;
  const c = want ? ac() : ctx;
  if (!c) return;
  buildMusicGraph(c);
  mus.bus!.gain.setTargetAtTime(Math.max(0.0001, musicTarget()), c.currentTime, 0.6);
  if (want && !mus.playing) { mus.playing = true; mus.next = c.currentTime + 0.1; mus.timer = window.setInterval(tickMusic, 120); }
  if (!want && mus.playing) { mus.playing = false; window.clearInterval(mus.timer); }
}

export const music = {
  /** Call from a user gesture. Until then no AudioContext is created. */
  unlock() { if (mus.unlocked) return; mus.unlocked = true; syncMusic(); },
  set(opts: { enabled?: boolean; volume?: number }) {
    if (opts.enabled !== undefined) mus.enabled = opts.enabled;
    if (opts.volume !== undefined) mus.volume = opts.volume;
    syncMusic();
  },
  setEra(era: number) { if (SCORES[era] && era !== mus.era) { mus.era = era; mus.step = 0; } },
  /** 0 calm .. 1 roll-call climax. */
  setTension(t: number) { mus.tension = Math.max(0, Math.min(1, t)); },
  /** Re-apply after the global mute changes. */
  refresh() { syncMusic(); },
  get unlocked() { return mus.unlocked; },
};
