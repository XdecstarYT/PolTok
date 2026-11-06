/**
 * In-house animated GIF encoder (no deps): median-cut palette, nearest-colour mapping with a
 * 15-bit cache, LZW (classic hashed `compress` algorithm), NETSCAPE looping and per-frame
 * dirty-rectangle cropping. Pure TS with no imports so node tests can load it directly.
 */
export interface GifOptions { /** frame delay in 1/100 s */ delayCs?: number; /** 0 = loop forever, -1 = play once */ loop?: number; colors?: number; sampleStep?: number }

/** Median-cut quantiser over packed RGB samples (Uint8 r,g,b triples). Returns a flat RGB palette. */
export function medianCut(rgb: Uint8Array, maxColors = 256): Uint8Array {
  const n = Math.floor(rgb.length / 3);
  const idx = new Uint32Array(n);
  for (let i = 0; i < n; i++) idx[i] = i;
  type Box = { lo: number; hi: number; range: number; ch: number };
  const measure = (lo: number, hi: number): Box => {
    const mn = [255, 255, 255], mx = [0, 0, 0];
    for (let i = lo; i < hi; i++) {
      const p = idx[i] * 3;
      for (let c = 0; c < 3; c++) { const v = rgb[p + c]; if (v < mn[c]) mn[c] = v; if (v > mx[c]) mx[c] = v; }
    }
    const r = [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]];
    const ch = r[1] >= r[0] && r[1] >= r[2] ? 1 : r[0] >= r[2] ? 0 : 2;
    return { lo, hi, range: r[ch], ch };
  };
  const boxes: Box[] = n ? [measure(0, n)] : [];
  while (boxes.length < maxColors) {
    let bi = -1, best = 0;
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      const score = b.range * Math.sqrt(b.hi - b.lo);
      if (b.hi - b.lo > 1 && b.range > 0 && score > best) { best = score; bi = i; }
    }
    if (bi < 0) break;
    const b = boxes[bi];
    const sub = Array.from(idx.subarray(b.lo, b.hi)).sort((x, y) => rgb[x * 3 + b.ch] - rgb[y * 3 + b.ch]);
    idx.set(sub, b.lo);
    const mid = b.lo + ((b.hi - b.lo) >> 1);
    boxes.splice(bi, 1, measure(b.lo, mid), measure(mid, b.hi));
  }
  const pal = new Uint8Array(Math.max(1, boxes.length) * 3);
  boxes.forEach((b, k) => {
    let r = 0, g = 0, bl = 0;
    for (let i = b.lo; i < b.hi; i++) { const p = idx[i] * 3; r += rgb[p]; g += rgb[p + 1]; bl += rgb[p + 2]; }
    const c = b.hi - b.lo || 1;
    pal[k * 3] = Math.round(r / c); pal[k * 3 + 1] = Math.round(g / c); pal[k * 3 + 2] = Math.round(bl / c);
  });
  return pal;
}

/** Maps RGBA pixels to palette indices (nearest colour, cached per 15-bit colour). */
export function mapToPalette(rgba: Uint8ClampedArray | Uint8Array, pal: Uint8Array, cache = new Int16Array(32768).fill(-1)): Uint8Array {
  const n = rgba.length >> 2, out = new Uint8Array(n), pc = pal.length / 3;
  for (let i = 0; i < n; i++) {
    const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2];
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    let ci = cache[key];
    if (ci < 0) {
      let bd = Infinity;
      for (let k = 0; k < pc; k++) {
        const dr = pal[k * 3] - r, dg = pal[k * 3 + 1] - g, db = pal[k * 3 + 2] - b;
        const d = dr * dr * 2 + dg * dg * 4 + db * db * 3;
        if (d < bd) { bd = d; ci = k; }
      }
      cache[key] = ci;
    }
    out[i] = ci;
  }
  return out;
}

export class Bytes {
  buf = new Uint8Array(1 << 16); len = 0;
  byte(b: number) { if (this.len >= this.buf.length) { const n = new Uint8Array(this.buf.length * 2); n.set(this.buf); this.buf = n; } this.buf[this.len++] = b & 255; }
  u16(v: number) { this.byte(v); this.byte(v >> 8); }
  str(s: string) { for (let i = 0; i < s.length; i++) this.byte(s.charCodeAt(i)); }
  bytes(a: ArrayLike<number>) { for (let i = 0; i < a.length; i++) this.byte(a[i]); }
  out() { return this.buf.slice(0, this.len); }
}

/** GIF-flavoured LZW of an index stream, written as data sub-blocks (incl. min code size + terminator). */
export function lzwEncode(pixels: Uint8Array, minCodeSize: number, w: Bytes = new Bytes()): Bytes {
  const HSIZE = 5003, MAXMAX = 4096;
  const htab = new Int32Array(HSIZE).fill(-1), codetab = new Int32Array(HSIZE);
  const initBits = minCodeSize + 1, clearCode = 1 << minCodeSize, eof = clearCode + 1;
  let nBits = initBits, maxcode = (1 << nBits) - 1, freeEnt = clearCode + 2, clearFlg = false;
  let acc = 0, accBits = 0;
  const block = new Uint8Array(255); let bl = 0;
  const flushBlock = () => { if (bl) { w.byte(bl); for (let i = 0; i < bl; i++) w.byte(block[i]); bl = 0; } };
  const put = (b: number) => { block[bl++] = b; if (bl === 255) flushBlock(); };
  const output = (code: number) => {
    acc |= code << accBits; accBits += nBits;
    while (accBits >= 8) { put(acc & 255); acc >>>= 8; accBits -= 8; }
    if (freeEnt > maxcode || clearFlg) {
      if (clearFlg) { nBits = initBits; maxcode = (1 << nBits) - 1; clearFlg = false; }
      else { nBits++; maxcode = nBits === 12 ? MAXMAX : (1 << nBits) - 1; }
    }
    if (code === eof) { while (accBits > 0) { put(acc & 255); acc >>>= 8; accBits -= 8; } accBits = 0; flushBlock(); }
  };
  w.byte(minCodeSize);
  output(clearCode);
  if (pixels.length) {
    let ent = pixels[0];
    outer: for (let i = 1; i < pixels.length; i++) {
      const c = pixels[i];
      const fcode = (c << 12) + ent;
      let h = (c << 4) ^ ent;
      if (htab[h] === fcode) { ent = codetab[h]; continue; }
      if (htab[h] >= 0) {
        const disp = h === 0 ? 1 : HSIZE - h;
        do {
          h -= disp; if (h < 0) h += HSIZE;
          if (htab[h] === fcode) { ent = codetab[h]; continue outer; }
        } while (htab[h] >= 0);
      }
      output(ent);
      ent = c;
      if (freeEnt < MAXMAX) { codetab[h] = freeEnt++; htab[h] = fcode; }
      else { htab.fill(-1); freeEnt = clearCode + 2; clearFlg = true; output(clearCode); }
    }
    output(ent);
  }
  output(eof);
  w.byte(0);
  return w;
}

export interface GifFrame { rgba: Uint8ClampedArray | Uint8Array; delayCs?: number }

/** Builds a global palette from a sample of every frame. */
export function paletteFor(frames: GifFrame[], colors = 256, step = 0): Uint8Array {
  const total = frames.reduce((a, f) => a + (f.rgba.length >> 2), 0);
  const st = step || Math.max(1, Math.floor(total / 120000));
  const s: number[] = [];
  let k = 0;
  for (const f of frames) for (let i = 0; i < f.rgba.length; i += 4) { if (k++ % st === 0) s.push(f.rgba[i], f.rgba[i + 1], f.rgba[i + 2]); }
  return medianCut(Uint8Array.from(s), colors);
}

/** Encodes RGBA frames (all w×h) into an animated GIF file. */
export function encodeGif(frames: GifFrame[], w: number, h: number, opts: GifOptions = {}): Uint8Array {
  if (!frames.length) throw new Error('no frames');
  const pal = paletteFor(frames, Math.min(256, Math.max(2, opts.colors ?? 256)), opts.sampleStep);
  let bits = 1; while ((1 << bits) < pal.length / 3) bits++;
  const size = 1 << bits;
  const out = new Bytes();
  out.str('GIF89a'); out.u16(w); out.u16(h);
  out.byte(0x80 | 0x70 | (bits - 1)); out.byte(0); out.byte(0);
  for (let i = 0; i < size * 3; i++) out.byte(i < pal.length ? pal[i] : 0);
  if ((opts.loop ?? 0) >= 0) { out.byte(0x21); out.byte(0xff); out.byte(11); out.str('NETSCAPE2.0'); out.byte(3); out.byte(1); out.u16(opts.loop ?? 0); out.byte(0); }
  const cache = new Int16Array(32768).fill(-1);
  let prev: Uint8Array | null = null;
  for (const f of frames) {
    const idx = mapToPalette(f.rgba, pal, cache);
    // dirty rectangle vs previous frame (disposal 1 keeps the rest)
    let x0 = 0, y0 = 0, x1 = w - 1, y1 = h - 1;
    if (prev) {
      x0 = w; y0 = h; x1 = -1; y1 = -1;
      for (let y = 0; y < h; y++) for (let x = 0, o = y * w; x < w; x++, o++) if (idx[o] !== prev[o]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 < 0) { x0 = y0 = 0; x1 = y1 = 0; }
    }
    const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
    const sub = new Uint8Array(cw * ch);
    for (let y = 0; y < ch; y++) sub.set(idx.subarray((y + y0) * w + x0, (y + y0) * w + x0 + cw), y * cw);
    out.byte(0x21); out.byte(0xf9); out.byte(4); out.byte(1 << 2); out.u16(Math.max(2, Math.round(f.delayCs ?? opts.delayCs ?? 7))); out.byte(0); out.byte(0);
    out.byte(0x2c); out.u16(x0); out.u16(y0); out.u16(cw); out.u16(ch); out.byte(0);
    lzwEncode(sub, Math.max(2, bits), out);
    prev = idx;
  }
  out.byte(0x3b);
  return out.out();
}
