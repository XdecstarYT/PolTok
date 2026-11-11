// Offline procedural soundtrack + SFX + voiceover mix for the reel engine (pure Node, deterministic).
// Everything here is synthesised from scratch: no samples, no third-party music.
import fs from 'node:fs';

export const SR = 48000;
const TAU = Math.PI * 2;

// ---------- small DSP kit ----------
function mulberry(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

class SVF { // TPT state-variable filter
  constructor() { this.ic1 = 0; this.ic2 = 0; }
  run(x, fc, q, mode) {
    const g = Math.tan(Math.PI * clamp(fc, 20, SR * 0.45) / SR), k = 1 / q;
    const a1 = 1 / (1 + g * (g + k)), a2 = g * a1, a3 = g * a2;
    const v3 = x - this.ic2, v1 = a1 * this.ic1 + a2 * v3, v2 = this.ic2 + a2 * this.ic1 + a3 * v3;
    this.ic1 = 2 * v1 - this.ic1; this.ic2 = 2 * v2 - this.ic2;
    return mode === 'lp' ? v2 : mode === 'bp' ? v1 : mode === 'hp' ? x - k * v1 - v2 : v2;
  }
}
function blep(t, dt) { if (t < dt) { t /= dt; return t + t - t * t - 1; } if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; } return 0; }
class Saw { constructor(ph = 0) { this.p = ph; } next(f) { const dt = f / SR; this.p += dt; if (this.p >= 1) this.p -= 1; return 2 * this.p - 1 - blep(this.p, dt); } }
class Sq { constructor(ph = 0) { this.p = ph; } next(f, pw = 0.5) { const dt = f / SR; this.p += dt; if (this.p >= 1) this.p -= 1; let v = this.p < pw ? 1 : -1; v += blep(this.p, dt); v -= blep((this.p + 1 - pw) % 1, dt); return v; } }

// ---------- buses ----------
class Bus {
  constructor(n) { this.L = new Float32Array(n); this.R = new Float32Array(n); }
  add(i, v, pan = 0) { if (i < 0 || i >= this.L.length) return; const a = (pan + 1) * Math.PI / 4; this.L[i] += v * Math.cos(a); this.R[i] += v * Math.sin(a); }
}

function freeverb(inL, inR, o = {}) {
  const n = inL.length, sc = SR / 44100;
  const combT = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617], apT = [556, 441, 341, 225];
  const room = o.room ?? 0.86, damp = o.damp ?? 0.32, spread = 23;
  const outL = new Float32Array(n), outR = new Float32Array(n);
  const ch = (input, out, off) => {
    const combs = combT.map((t) => ({ b: new Float32Array(Math.round((t + off) * sc)), i: 0, f: 0 }));
    const aps = apT.map((t) => ({ b: new Float32Array(Math.round((t + off) * sc)), i: 0 }));
    for (let s = 0; s < n; s++) {
      const x = input[s] * 0.015;
      let y = 0;
      for (const c of combs) { const o2 = c.b[c.i]; c.f = o2 * (1 - damp) + c.f * damp; c.b[c.i] = x + c.f * room; if (++c.i >= c.b.length) c.i = 0; y += o2; }
      for (const a of aps) { const bo = a.b[a.i]; const v = -y + bo; a.b[a.i] = y + bo * 0.5; if (++a.i >= a.b.length) a.i = 0; y = v; }
      out[s] = y;
    }
  };
  ch(inL, outL, 0); ch(inR, outR, spread);
  return [outL, outR];
}
function pingpong(inL, inR, delaySec, fb = 0.38) {
  const n = inL.length, d = Math.round(delaySec * SR);
  const L = new Float32Array(n), R = new Float32Array(n);
  let lpL = 0, lpR = 0;
  for (let i = 0; i < n; i++) {
    const dl = i >= d ? L[i - d] : 0, dr = i >= d ? R[i - d] : 0;
    lpL += (dr - lpL) * 0.35; lpR += (dl - lpR) * 0.35;
    L[i] = (inL[i] + inR[i]) * 0.5 + lpL * fb;
    R[i] = lpR * fb;
  }
  // output only the echoes (remove dry)
  for (let i = 0; i < n; i++) L[i] -= (inL[i] + inR[i]) * 0.5;
  return [L, R];
}

// ---------- chord helpers ----------
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function chord(name) {
  const m = /^([A-G])([#b]?)(m?)(7|add9|sus2|sus4)?$/.exec(name);
  if (!m) throw new Error('bad chord ' + name);
  let root = NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  root = (root + 12) % 12;
  const minor = m[3] === 'm';
  let iv = minor ? [0, 3, 7] : [0, 4, 7];
  if (m[4] === '7') iv.push(minor ? 10 : 10);
  if (m[4] === 'add9') iv.push(14);
  if (m[4] === 'sus2') iv[1] = 2;
  if (m[4] === 'sus4') iv[1] = 5;
  // voice near middle C (56..70)
  let base = 48 + root; if (base < 53) base += 12;
  const notes = iv.map((x) => base + x).map((x) => (x > 72 ? x - 12 : x)).sort((a, b) => a - b);
  return { root, notes, bass: 36 + root, minor };
}

// ---------- the mix ----------
/**
 * opts: { duration, tl:{origin, beat, scenes:[{id,t0,t1,energy}]}, music:{prog:['Am','F','C','G'], seed, swing, arp:'up'|'updown'|'pulse'},
 *         cues:[{t,type,...}], vo:[{t, pcm: Float32Array(48k mono)}] }
 */
export function renderMix(opts) {
  const dur = opts.duration + 0.6;
  const N = Math.ceil(dur * SR);
  const { tl } = opts;
  const mus = opts.music || {};
  const rnd = mulberry(mus.seed ?? 11);
  const beat = tl.beat, O = tl.origin;
  const endScene = tl.scenes.find((s) => s.id === 'end');
  const endT = endScene ? endScene.t0 : opts.duration;
  const prog = (mus.prog || ['Am', 'F', 'C', 'G']).map(chord);
  const barLen = beat * 4;
  const chordAt = (t) => prog[Math.max(0, Math.floor((t - O) / (barLen * (mus.barsPerChord ?? 1)))) % prog.length];
  const energyAt = (t) => { const s = tl.scenes.find((x) => t >= x.t0 && t < x.t1); return s ? s.energy ?? 1 : 0; };

  const drums = new Bus(N), bass = new Bus(N), music = new Bus(N), sfx = new Bus(N), rev = new Bus(N), dly = new Bus(N);
  const kicks = [];
  const S = (t) => Math.round(t * SR);

  // ----- instruments -----
  const kick = (t0, vel = 1) => {
    kicks.push(t0);
    let ph = 0; const i0 = S(t0), n = S(0.5);
    for (let j = 0; j < n; j++) {
      const t = j / SR;
      const f = 46 + 130 * Math.exp(-t * 32);
      ph += f / SR;
      const a = Math.exp(-t * 6.2) * Math.min(1, t / 0.0015);
      let v = Math.tanh(1.8 * Math.sin(TAU * ph)) * a;
      v += (rnd() * 2 - 1) * Math.exp(-t * 500) * 0.25;
      drums.add(i0 + j, v * 0.95 * vel);
    }
  };
  const clap = (t0, vel = 1) => {
    const f = new SVF(); const i0 = S(t0), n = S(0.35);
    for (let j = 0; j < n; j++) {
      const t = j / SR;
      let env = 0; for (const o of [0, 0.011, 0.022]) if (t >= o) env += Math.exp(-(t - o) * 190);
      if (t > 0.022) env += Math.exp(-(t - 0.022) * 15) * 0.55;
      const v = f.run(rnd() * 2 - 1, 1500, 1.3, 'bp') * env * 1.6 + Math.sin(TAU * 185 * t) * Math.exp(-t * 40) * 0.2;
      drums.add(i0 + j, v * 0.5 * vel, (rnd() - 0.5) * 0.2);
      rev.add(i0 + j, v * 0.25 * vel);
    }
  };
  const hat = (t0, open = false, vel = 1, pan = 0) => {
    const f = new SVF(); const i0 = S(t0), n = S(open ? 0.32 : 0.07);
    for (let j = 0; j < n; j++) {
      const t = j / SR;
      const v = f.run(rnd() * 2 - 1, 8200, 0.9, 'hp') * Math.exp(-t * (open ? 13 : 70));
      drums.add(i0 + j, v * 0.16 * vel, pan);
    }
  };
  const bassNote = (t0, d, midi, vel = 1) => {
    const o1 = new Saw(), o2 = new Saw(0.3), f = new SVF(); const i0 = S(t0), n = S(d + 0.08);
    const fr = mtof(midi);
    let sp = 0;
    for (let j = 0; j < n; j++) {
      const t = j / SR;
      const a = Math.min(1, t / 0.004) * (t > d ? Math.exp(-(t - d) * 40) : 1) * (0.75 + 0.25 * Math.exp(-t * 8));
      sp += fr / 2 / SR;
      let v = (o1.next(fr) + o2.next(fr * 1.006)) * 0.5;
      v = f.run(v, 160 + 1100 * Math.exp(-t * 11) * vel, 1.1, 'lp');
      v = v * 0.8 + Math.sin(TAU * sp) * 0.65;
      bass.add(i0 + j, Math.tanh(v * 1.3) * a * 0.42 * vel);
    }
  };
  const pad = (t0, d, notes, lvl = 1, bright = 1) => {
    const i0 = S(t0), n = S(d + 1.0);
    notes.forEach((m, ni) => {
      const oscs = [new Saw(rnd()), new Saw(rnd()), new Saw(rnd())], f = new SVF();
      const det = [1, 1.0041, 0.9962], fr = mtof(m), pan = (ni / Math.max(1, notes.length - 1) - 0.5) * 0.9;
      for (let j = 0; j < n; j++) {
        const t = j / SR;
        const a = Math.min(1, t / 0.35) * (t > d ? Math.exp(-(t - d) * 3.5) : 1);
        let v = 0; for (let k = 0; k < 3; k++) v += oscs[k].next(fr * det[k]);
        v = f.run(v / 3, (700 + 500 * Math.sin((t0 + t) * 0.7)) * bright, 0.8, 'lp');
        const out = v * a * 0.17 * lvl;
        music.add(i0 + j, out, pan);
        rev.add(i0 + j, out * 0.9, pan);
      }
    });
  };
  const pluck = (t0, midi, vel = 1, pan = 0, bright = 1) => {
    const o1 = new Saw(), o2 = new Sq(), f = new SVF(); const i0 = S(t0), n = S(0.45);
    const fr = mtof(midi);
    for (let j = 0; j < n; j++) {
      const t = j / SR;
      let v = o1.next(fr) * 0.6 + o2.next(fr * 2.0, 0.3) * 0.25;
      v = f.run(v, 280 + 3600 * Math.exp(-t * 16) * bright, 1.4, 'lp');
      const a = Math.min(1, t / 0.002) * Math.exp(-t * 7.5);
      const out = v * a * 0.17 * vel;
      music.add(i0 + j, out, pan);
      dly.add(i0 + j, out * 0.55, pan);
      rev.add(i0 + j, out * 0.3, pan);
    }
  };
  const bell = (t0, midi, vel = 1, pan = 0, decay = 3.2) => {
    const i0 = S(t0), n = S(Math.min(2.5, 6 / decay)); const fr = mtof(midi);
    for (let j = 0; j < n; j++) {
      const t = j / SR;
      const idx = 2.2 * Math.exp(-t * 6);
      const v = Math.sin(TAU * fr * t + idx * Math.sin(TAU * fr * 3.5 * t)) * Math.exp(-t * decay) * Math.min(1, t / 0.001);
      sfx.add(i0 + j, v * 0.14 * vel, pan);
      rev.add(i0 + j, v * 0.12 * vel, pan);
      dly.add(i0 + j, v * 0.06 * vel, pan);
    }
  };
  const stab = (t0, notes, vel = 1) => {
    notes.concat(notes.map((m) => m + 12)).forEach((m, ni) => {
      const o = [new Saw(rnd()), new Saw(rnd())], f = new SVF(); const i0 = S(t0), n = S(1.6), fr = mtof(m), pan = (ni % 2 ? 1 : -1) * 0.35;
      for (let j = 0; j < n; j++) {
        const t = j / SR;
        let v = o[0].next(fr) + o[1].next(fr * 1.007);
        v = f.run(v * 0.5, 600 + 5000 * Math.exp(-t * 5), 0.9, 'lp');
        const out = v * Math.exp(-t * 2.4) * Math.min(1, t / 0.003) * 0.06 * vel;
        music.add(i0 + j, out, pan);
        rev.add(i0 + j, out * 1.2, pan);
      }
    });
  };
  const noiseSweep = (tc, d, o = {}) => { // whoosh: band-passed noise, swept, panned
    const f = new SVF(), f2 = new SVF(); const i0 = S(tc - d * 0.6), n = S(d);
    const p0 = o.pan0 ?? -0.8, p1 = o.pan1 ?? 0.8;
    for (let j = 0; j < n; j++) {
      const u = j / n;
      const env = Math.pow(Math.sin(Math.PI * Math.pow(u, o.skew ?? 0.8)), 2);
      const fc = (o.f0 ?? 350) + (o.f1 ?? 2600) * Math.pow(Math.sin(Math.PI * u), 1.5);
      const x = rnd() * 2 - 1;
      const v = (f.run(x, fc, 1.6, 'bp') * 0.8 + f2.run(x, fc * 2.2, 2.5, 'bp') * 0.35) * env * (o.gain ?? 0.55);
      sfx.add(i0 + j, v, p0 + (p1 - p0) * u);
      rev.add(i0 + j, v * 0.25);
    }
  };
  const boom = (t0, g = 1, len = 1.6) => {
    const f = new SVF(); const i0 = S(t0), n = S(len); let ph = 0;
    for (let j = 0; j < n; j++) {
      const t = j / SR;
      const fr = 30 + 52 * Math.exp(-t * 3.2);
      ph += fr / SR;
      let v = Math.sin(TAU * ph) * Math.exp(-t * 2.4) * 0.9;
      v += f.run(rnd() * 2 - 1, 900 + 3000 * Math.exp(-t * 20), 0.7, 'lp') * Math.exp(-t * 9) * 0.55;
      sfx.add(i0 + j, Math.tanh(v * 1.4) * 0.8 * g);
      rev.add(i0 + j, v * 0.5 * g);
    }
  };
  const riser = (t0, t1, g = 1) => {
    const f = new SVF(), o1 = new Saw(), o2 = new Saw(0.5); const i0 = S(t0), n = S(t1 - t0);
    for (let j = 0; j < n; j++) {
      const u = j / n, t = j / SR;
      const fc = 300 * Math.pow(26, u);
      let v = f.run(rnd() * 2 - 1, fc, 2.2, 'bp') * 0.6;
      const fr = 110 * Math.pow(4, u);
      v += (o1.next(fr) + o2.next(fr * 1.01)) * 0.04 * u;
      const a = Math.pow(u, 2.2) * (u > 0.985 ? (1 - u) / 0.015 : 1);
      sfx.add(i0 + j, v * a * 0.55 * g, Math.sin(t * 9) * 0.3 * u);
      rev.add(i0 + j, v * a * 0.25 * g);
    }
  };
  const click = (t0, f0 = 2400, g = 1, pan = 0) => {
    const i0 = S(t0), n = S(0.03);
    for (let j = 0; j < n; j++) { const t = j / SR; sfx.add(i0 + j, Math.sin(TAU * f0 * t) * Math.exp(-t * 210) * 0.2 * g + (rnd() * 2 - 1) * Math.exp(-t * 900) * 0.08 * g, pan); }
  };

  // ----- arrangement -----
  const arpPat = mus.arp || 'up';
  for (let b = 0; ; b++) {
    const bt = O + b * barLen;
    if (bt >= endT - 0.01) break;
    const ch = chordAt(bt + 0.01);
    const padLen = Math.min(barLen * (mus.barsPerChord ?? 1), endT - bt);
    if (b % (mus.barsPerChord ?? 1) === 0) pad(bt, padLen, ch.notes, 1, energyAt(bt + 0.01) >= 2 ? 1.25 : 0.9);
    for (let s = 0; s < 16; s++) {
      const t = bt + s * beat / 4 + (s % 2 ? (mus.swing ?? 0) * beat / 4 : 0);
      if (t >= endT - 0.02) break;
      const e = energyAt(t);
      const q = s % 4 === 0;
      if (e >= 2 && q) kick(t, s === 0 ? 1 : 0.92);
      if (e === 1 && (s === 0 || s === 10)) kick(t, 0.55);
      if (e >= 2 && (s === 4 || s === 12)) clap(t, 0.9);
      if (e >= 1 && s % 2 === 0) hat(t, false, s % 4 === 2 ? 1 : 0.55, s % 4 === 2 ? 0.25 : -0.2);
      if (e >= 3 && s % 2 === 1) hat(t, false, 0.35, 0.35);
      if (e >= 3 && s % 4 === 2) hat(t, true, 0.5, 0.15);
      if (e >= 1 && s % 2 === 1 && (e >= 2 || s % 4 === 3)) bassNote(t, beat / 4 * 0.9, ch.bass + (s === 15 && e >= 2 ? 12 : 0), e >= 2 ? 1 : 0.85);
      if (e === 1 && s % 4 === 2) pluck(t, ch.notes[((s / 4) | 0) % ch.notes.length] + 12, 0.45, 0.3, 0.7);
      if (e >= 2) {
        const tones = ch.notes.concat(ch.notes.map((m) => m + 12));
        let idx;
        if (arpPat === 'updown') { const k = s % 8; idx = k < 4 ? k : 8 - k; }
        else if (arpPat === 'pulse') idx = [0, 2, 1, 2][s % 4] + (s >= 8 ? 1 : 0);
        else idx = s % tones.length;
        const m = tones[idx % tones.length] + 12;
        pluck(t, m, s % 4 === 0 ? 1 : 0.65, ((s % 4) - 1.5) * 0.25, e >= 3 ? 1.3 : 1);
      }
      if (e >= 3 && s === 0 && b % 2 === 0) stab(t, ch.notes, 0.8);
    }
  }
  // hook: boom + riser into the grid origin, small drum fill
  boom(0.0, 1.0);
  stab(0.0, prog[0].notes, 1.1);
  riser(0.05, O, 0.9);
  for (let k = 0; k < 4; k++) clap(O - beat + (k * beat) / 4, 0.25 + k * 0.18);
  // risers into high-energy scenes
  for (let i = 1; i < tl.scenes.length; i++) {
    const s = tl.scenes[i], p = tl.scenes[i - 1];
    if ((s.energy ?? 1) >= 3 && (p.energy ?? 1) < 3 && s.t0 - p.t0 > 2) riser(s.t0 - 2 * beat * 2, s.t0, 0.6);
  }
  // end card sting + tonic tail
  if (endScene) {
    const tonic = prog[0];
    boom(endT, 0.7, 1.8);
    stab(endT, tonic.notes, 1.0);
    bell(endT + 0.02, tonic.notes[0] + 24, 1, 0);
    bell(endT + 0.26, tonic.notes[2] + 24, 0.7, 0.3);
    bell(endT + 0.52, tonic.notes[1] + 24, 0.6, -0.3);
    pad(endT, opts.duration - endT - 0.3, tonic.notes, 1.2, 0.8);
    bassNote(endT, Math.min(2, opts.duration - endT - 0.4), tonic.bass, 0.8);
  }

  // ----- cues -----
  let popIdx = 0;
  for (const c of opts.cues) {
    const ch = chordAt(Math.max(O, c.t));
    const panDir = { left: [0.8, -0.8], right: [-0.8, 0.8], up: [-0.3, 0.3], down: [0.3, -0.3] }[c.dir] || [-0.8, 0.8];
    switch (c.type) {
      case 'whoosh': noiseSweep(c.t, 0.55, { pan0: panDir[0], pan1: panDir[1] }); click(c.t, 180, 1.5); break;
      case 'zoom': noiseSweep(c.t, 0.7, { f0: 200, f1: 4200, skew: 0.6, gain: 0.5 }); boom(c.t, 0.35, 0.8); break;
      case 'swell': noiseSweep(c.t, 0.9, { f0: 500, f1: 1800, skew: 0.5, gain: 0.3, pan0: -0.2, pan1: 0.2 }); bell(c.t, ch.notes[2] + 24, 0.5); break;
      case 'hit': boom(c.t, 0.55, 1.0); noiseSweep(c.t, 0.4, { gain: 0.35 }); break;
      case 'slam': boom(c.t + 0.02, 0.6, 0.9); clap(c.t + 0.02, 0.7); break;
      case 'tick': click(c.t, 1700 + 1500 * (c.k ?? 0.5), 0.8, 0.1); break;
      case 'ding': bell(c.t, ch.notes[0] + 24, 0.9, 0.1); break;
      case 'pop': { const tones = ch.notes.concat(ch.notes.map((m) => m + 12)); bell(c.t, tones[(c.i ?? popIdx++) % tones.length] + 12, 0.55, ((c.i ?? 0) % 3 - 1) * 0.4, 7); break; }
      case 'blip': { const tones = ch.notes.concat(ch.notes.map((m) => m + 12), ch.notes.map((m) => m + 24)); click(c.t, mtof(tones[(c.i ?? 0) % tones.length] + 12), 0.5, ((c.i ?? 0) % 5 - 2) * 0.2); break; }
      case 'type': for (let k = 0; k < Math.min(c.n ?? 3, 8); k++) click(c.t + k * 0.065, 3000 + rnd() * 900, 0.35, (rnd() - 0.5) * 0.5); break;
      case 'boom': boom(c.t, c.g ?? 0.8); break;
      case 'riser': riser(c.t, c.t1, c.g ?? 0.7); break;
      default: break;
    }
  }

  // ----- sidechain + VO duck -----
  const sc = new Float32Array(N).fill(1);
  for (const k of kicks) { const i0 = S(k); for (let j = 0; j < S(0.32); j++) { const i = i0 + j; if (i >= N) break; const g = 1 - 0.55 * Math.exp(-(j / SR) * 11); if (g < sc[i]) sc[i] = g; } }
  const vo = new Float32Array(N);
  for (const v of opts.vo || []) { const i0 = S(v.t); for (let j = 0; j < v.pcm.length; j++) if (i0 + j < N) vo[i0 + j] += v.pcm[j]; }
  const duck = new Float32Array(N).fill(1);
  if (opts.vo?.length) {
    let env = 0;
    for (let i = 0; i < N; i++) { const a = Math.abs(vo[i]); env = a > env ? env + (a - env) * 0.01 : env * 0.99993; duck[i] = 1 - 0.5 * clamp(env * 9, 0, 1); }
  }
  const [rL, rR] = freeverb(rev.L, rev.R, { room: 0.86, damp: 0.35 });
  const [dL, dR] = pingpong(dly.L, dly.R, beat * 0.75, 0.38);
  const L = new Float32Array(N), R = new Float32Array(N);
  const g = mus.gain || {};
  for (let i = 0; i < N; i++) {
    const m = duck[i];
    const mm = sc[i] * m;
    L[i] = drums.L[i] * (g.drums ?? 0.85) * (0.6 + 0.4 * m) + bass.L[i] * (g.bass ?? 0.8) * mm + music.L[i] * (g.music ?? 0.8) * mm + rL[i] * 0.5 * m + dL[i] * 0.35 * m + sfx.L[i] * (g.sfx ?? 0.9) + vo[i] * 1.0;
    R[i] = drums.R[i] * (g.drums ?? 0.85) * (0.6 + 0.4 * m) + bass.R[i] * (g.bass ?? 0.8) * mm + music.R[i] * (g.music ?? 0.8) * mm + rR[i] * 0.5 * m + dR[i] * 0.35 * m + sfx.R[i] * (g.sfx ?? 0.9) + vo[i] * 1.0;
  }
  for (let i = 0; i < N; i += 997) if (!Number.isFinite(L[i]) || !Number.isFinite(R[i])) throw new Error('audio mix produced NaN near ' + (i / SR).toFixed(2) + 's');
  // fade out last 0.4s, soft clip, normalise
  const fo = S(0.45);
  for (let i = 0; i < fo; i++) { const k = i / fo; L[N - 1 - i] *= k; R[N - 1 - i] *= k; }
  let pk = 0;
  for (let i = 0; i < N; i++) { L[i] = Math.tanh(L[i] * 1.05); R[i] = Math.tanh(R[i] * 1.05); pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i])); }
  const norm = 0.89 / (pk || 1);
  for (let i = 0; i < N; i++) { L[i] *= norm; R[i] *= norm; }
  return { L, R };
}

export function writeWav(file, L, R) {
  const n = L.length, buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(clamp(L[i], -1, 1) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(clamp(R[i], -1, 1) * 32767), 46 + i * 4);
  }
  fs.writeFileSync(file, buf);
}

/** Read a 16-bit PCM mono/stereo WAV → Float32Array mono */
export function readWavMono(file) {
  const b = fs.readFileSync(file);
  let p = 12, fmt = null, data = null;
  while (p < b.length - 8) {
    const id = b.toString('ascii', p, p + 4), sz = b.readUInt32LE(p + 4);
    if (id === 'fmt ') fmt = { ch: b.readUInt16LE(p + 10), sr: b.readUInt32LE(p + 12), bits: b.readUInt16LE(p + 22) };
    if (id === 'data') data = b.subarray(p + 8, p + 8 + sz);
    p += 8 + sz + (sz & 1);
  }
  if (!fmt || !data || fmt.bits !== 16) throw new Error('unsupported wav ' + file);
  const n = data.length / 2 / fmt.ch, out = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0; for (let c = 0; c < fmt.ch; c++) s += data.readInt16LE((i * fmt.ch + c) * 2); out[i] = s / fmt.ch / 32768; }
  return { pcm: out, sr: fmt.sr };
}
