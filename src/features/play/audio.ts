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
