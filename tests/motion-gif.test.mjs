// node --test tests/ — in-house GIF encoder: decode the output with a minimal reference decoder and compare.
import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeGif, medianCut } from '../src/lib/motion/gif.ts';

function decodeGif(b) {
  let p = 0;
  const u8 = () => b[p++], u16 = () => { const v = b[p] | (b[p + 1] << 8); p += 2; return v; };
  assert.equal(String.fromCharCode(...b.slice(0, 6)), 'GIF89a'); p = 6;
  const W = u16(), H = u16(), fl = u8(); u8(); u8();
  const gsize = 2 << (fl & 7); const pal = b.slice(p, p + gsize * 3); p += gsize * 3;
  const canvas = new Uint8Array(W * H); const frames = []; let loop = null;
  for (;;) {
    const t = u8();
    if (t === 0x3b) break;
    if (t === 0x21) {
      const label = u8();
      if (label === 0xff) { const n = u8(); const id = String.fromCharCode(...b.slice(p, p + n)); p += n; const sz = u8(); if (id === 'NETSCAPE2.0') { u8(); loop = u16(); } else p += sz; u8(); continue; }
      for (let s = u8(); s; s = u8()) p += s; continue;
    }
    assert.equal(t, 0x2c);
    const x = u16(), y = u16(), w = u16(), h = u16(); u8();
    const min = u8(); const data = [];
    for (let s = u8(); s; s = u8()) { for (let i = 0; i < s; i++) data.push(b[p + i]); p += s; }
    // LZW decode
    const clear = 1 << min, eoi = clear + 1; let size = min + 1, dict = [], out = [], prev = null, bit = 0;
    const reset = () => { dict = []; for (let i = 0; i < clear; i++) dict[i] = [i]; dict[clear] = []; dict[eoi] = null; size = min + 1; prev = null; };
    reset();
    for (;;) {
      let code = 0; for (let i = 0; i < size; i++, bit++) code |= ((data[bit >> 3] >> (bit & 7)) & 1) << i;
      if (code === clear) { reset(); continue; }
      if (code === eoi) break;
      let entry;
      if (code < dict.length && dict[code]) entry = dict[code];
      else { assert.equal(code, dict.length, 'bad code'); entry = [...prev, prev[0]]; }
      out.push(...entry);
      if (prev) dict.push([...prev, entry[0]]);
      prev = entry;
      if (dict.length === (1 << size) && size < 12) size++;
    }
    assert.equal(out.length, w * h);
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) canvas[(y + r) * W + x + c] = out[r * w + c];
    frames.push(canvas.slice());
  }
  return { W, H, pal, frames, loop };
}

function frame(w, h, f) {
  const a = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 4;
    const on = x > f * 3 && x < f * 3 + 10;
    a[o] = on ? 255 : (x * 4) & 255; a[o + 1] = on ? 0 : (y * 4) & 255; a[o + 2] = on ? 0 : 128; a[o + 3] = 255;
  }
  return a;
}

test('median cut returns ≤ n colours and finds exact colours of a small image', () => {
  const rgb = new Uint8Array([255, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 255]);
  const p = medianCut(rgb, 4);
  assert.ok(p.length / 3 <= 4);
  const has = (r, g, b) => { for (let i = 0; i < p.length; i += 3) if (p[i] === r && p[i + 1] === g && p[i + 2] === b) return true; return false; };
  assert.ok(has(255, 0, 0) && has(0, 255, 0) && has(0, 0, 255));
  assert.ok(medianCut(new Uint8Array(3000).map((_, i) => i * 37), 16).length / 3 <= 16);
});

test('animated GIF round-trips through a reference decoder', () => {
  const W = 64, H = 48, frames = [0, 1, 2, 3, 4].map((f) => ({ rgba: frame(W, H, f) }));
  const gif = encodeGif(frames, W, H, { delayCs: 5 });
  const d = decodeGif(gif);
  assert.equal(d.W, W); assert.equal(d.H, H); assert.equal(d.loop, 0); assert.equal(d.frames.length, 5);
  for (let f = 0; f < 5; f++) {
    let err = 0;
    for (let i = 0; i < W * H; i++) {
      const ci = d.frames[f][i];
      for (let c = 0; c < 3; c++) err += Math.abs(d.pal[ci * 3 + c] - frames[f].rgba[i * 4 + c]);
    }
    assert.ok(err / (W * H * 3) < 6, `frame ${f} mean error ${err / (W * H * 3)}`);
  }
});

test('large noisy frame exercises code-table resets', () => {
  const W = 200, H = 150, a = new Uint8ClampedArray(W * H * 4);
  let s = 1; for (let i = 0; i < a.length; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; a[i] = i % 4 === 3 ? 255 : s >> 16; }
  const d = decodeGif(encodeGif([{ rgba: a }], W, H, { colors: 64 }));
  assert.equal(d.frames.length, 1);
});
