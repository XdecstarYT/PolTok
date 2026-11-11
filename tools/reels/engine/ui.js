// DOM overlay: kinetic typography, counters, captions, brand chrome. All animation is a pure function of time.
import { E, ease, clamp, remap, lerp, W, H } from './core.js';

export const SAFE = { top: 220, bottom: H - 380, left: 64, right: W - 64 };

const ov = () => document.getElementById('ov');
const mk = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

// wrap every word of the element's text nodes in <span class="w"><span class="i">word</span></span>
function splitWords(root) {
  const words = [];
  const walk = (node) => {
    for (const ch of [...node.childNodes]) {
      if (ch.nodeType === 3) {
        const parts = ch.textContent.split(/(\s+)/);
        const frag = document.createDocumentFragment();
        for (const p of parts) {
          if (!p) continue;
          if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(' ')); continue; }
          const w = mk('span', 'w'); const i = mk('span', 'i'); i.textContent = p; w.appendChild(i); frag.appendChild(w); words.push(i);
        }
        ch.replaceWith(frag);
      } else if (ch.nodeType === 1 && !ch.classList.contains('nosplit')) walk(ch);
      else if (ch.nodeType === 1) { const w = mk('span', 'w'); ch.replaceWith(w); w.appendChild(ch); words.push(ch); }
    }
  };
  walk(root);
  return words;
}

const host = (S) => (S ? S.layer : ov());
const reg = (S, fn) => (S ? S.update((lt, t) => fn(lt, t)) : E.updaters.push((t) => fn(t, t)));
const pos = (el, o) => {
  el.style.position = 'absolute';
  if (o.y != null) el.style.top = o.y + 'px';
  if (o.bottom != null) el.style.bottom = o.bottom + 'px';
  el.style.left = (o.x ?? 80) + 'px';
  el.style.width = (o.w ?? W - 2 * (o.x ?? 80)) + 'px';
  el.style.textAlign = o.align || 'left';
};

/**
 * Kinetic headline. o: {t0, t1, html, y, x, w, size, font:'serif'|'sans'|'mono', align, style:'rise'|'pop'|'slam'|'type', stagger, color, cue}
 * Times are scene-local when S is given. Use *word* for lime accent, or inline HTML (<b style="color:..">).
 */
export function headline(S, o) {
  const el = mk('div', `hl txt ${o.font || 'serif'} st-${o.style || 'rise'} ${o.cls || ''}`);
  const html = (o.html || '').replace(/\*([^*]+)\*/g, '<em>$1</em>');
  el.innerHTML = html;
  pos(el, o);
  el.style.fontSize = (o.size ?? 92) + 'px';
  if (o.color) el.style.color = o.color;
  host(S).appendChild(el);
  const words = splitWords(el);
  const style = o.style || 'rise';
  const st = o.stagger ?? (style === 'type' ? 0.03 : 0.065);
  const t0 = o.t0 ?? 0.15, t1 = o.t1 ?? (S ? S.dur - 0.1 : 1e9);
  const inD = o.inDur ?? (style === 'slam' ? 0.42 : 0.6);
  if (o.cue !== false && S) E.cue(S.t0 + t0, style === 'slam' ? 'slam' : 'type', { n: words.length });
  reg(S, (lt) => {
    const vis = lt > t0 - 0.05 && lt < t1 + 0.6;
    el.style.display = vis ? 'block' : 'none';
    if (!vis) return;
    words.forEach((w, i) => {
      const k = remap(lt, t0 + i * st, t0 + i * st + inD);
      const kout = ease.in(remap(lt, t1 - 0.3 + i * 0.015, t1 + i * 0.015));
      let tf = '', op = 1, fl = '';
      if (style === 'rise') {
        const e = ease.expo(k);
        tf = `translateY(${((1 - e) * 110 - kout * 110).toFixed(2)}%) rotate(${((1 - e) * 7).toFixed(2)}deg)`;
      } else if (style === 'pop') {
        const e = ease.back(k);
        tf = `scale(${(0.4 + 0.6 * e).toFixed(3)}) translateY(${(-kout * 40).toFixed(1)}px)`;
        op = clamp(k * 2.5) * (1 - kout);
        fl = `blur(${((1 - ease.out(k)) * 10 + kout * 8).toFixed(1)}px)`;
      } else if (style === 'slam') {
        const e = ease.out(k);
        tf = `scale(${(2.6 - 1.6 * e + kout * 0.4).toFixed(3)})`;
        op = clamp(k * 3) * (1 - kout);
        fl = `blur(${((1 - e) * 16 + kout * 10).toFixed(1)}px)`;
      } else if (style === 'type') {
        op = k > 0 ? 1 - kout : 0;
        tf = `translateY(${(-kout * 30).toFixed(1)}px)`;
      }
      w.style.transform = tf; w.style.opacity = op; w.style.filter = fl;
    });
    el.style.setProperty('--hl', ease.expo(remap(lt, t0 + words.length * st + 0.1, t0 + words.length * st + 0.6)).toFixed(3));
  });
  return el;
}

/** Mono kicker with lime bar wipe. o: {t0,t1,text,y,x,color} */
export function kicker(S, o) {
  const el = mk('div', 'kicker txt', `<span class="bar"></span><span class="kt">${o.text}</span>`);
  pos(el, { ...o, w: o.w ?? 900 });
  if (o.align === 'center') { el.style.justifyContent = 'center'; }
  if (o.color) el.style.setProperty('--kc', o.color);
  host(S).appendChild(el);
  const bar = el.querySelector('.bar'), kt = el.querySelector('.kt');
  const t0 = o.t0 ?? 0.05, t1 = o.t1 ?? (S ? S.dur - 0.1 : 1e9);
  reg(S, (lt) => {
    const k = ease.expo(remap(lt, t0, t0 + 0.5)), ko = ease.in(remap(lt, t1 - 0.25, t1));
    el.style.opacity = lt < t0 ? 0 : 1 - ko;
    bar.style.transform = `scaleX(${k})`;
    const n = Math.round(clamp((lt - t0 - 0.1) / 0.5) * o.text.length);
    kt.textContent = o.text.slice(0, n);
    kt.style.minWidth = '1px';
  });
  return el;
}

/** Big animated number. o: {t0, dur, from, to, decimals, prefix, suffix, y, x, w, size, color, align, label, ticks} */
export function counter(S, o) {
  const el = mk('div', 'counter txt', `<span class="num"></span>${o.label ? `<span class="clabel">${o.label}</span>` : ''}`);
  pos(el, o);
  el.style.fontSize = (o.size ?? 220) + 'px';
  if (o.color) el.style.color = o.color;
  host(S).appendChild(el);
  const num = el.querySelector('.num');
  const t0 = o.t0 ?? 0.2, d = o.dur ?? 1.4, t1 = o.t1 ?? (S ? S.dur - 0.1 : 1e9);
  const from = o.from ?? 0, to = o.to, dec = o.decimals ?? 0;
  const fmt = (v) => (o.prefix || '') + (o.comma ? v.toLocaleString('en-AU', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : v.toFixed(dec)) + (o.suffix || '');
  const curve = (k) => ease.expo(k);
  // ticks for audio: each displayed change (throttled)
  if (S && o.ticks !== false) {
    let last = -1, lastT = -1;
    for (let f = 0; f <= Math.ceil(d * 60); f++) {
      const tt = t0 + f / 60;
      const v = Math.round(lerp(from, to, curve(f / (d * 60))) * Math.pow(10, dec));
      if (v !== last && tt - lastT > 0.055) { E.cue(S.t0 + tt, 'tick', { k: f / (d * 60) }); lastT = tt; }
      last = v;
    }
    E.cue(S.t0 + t0 + d * 0.92, 'ding', {});
  }
  reg(S, (lt) => {
    const k = remap(lt, t0, t0 + d);
    const v = lerp(from, to, curve(k));
    num.innerHTML = fmt(k >= 1 ? to : Math.round(v * Math.pow(10, dec)) / Math.pow(10, dec));
    const pin = ease.back(remap(lt, t0 - 0.1, t0 + 0.35));
    const punch = 1 + 0.08 * Math.exp(-Math.max(0, lt - t0 - d) * 9) * (lt > t0 + d ? 1 : 0);
    const ko = ease.in(remap(lt, t1 - 0.3, t1));
    el.style.opacity = lt < t0 - 0.1 ? 0 : clamp(pin * 2) * (1 - ko);
    el.style.transform = `scale(${(pin * punch * (1 - ko * 0.2)).toFixed(3)})`;
    el.style.filter = `blur(${(ko * 10).toFixed(1)}px)`;
  });
  return el;
}

/** Generic element with enter/exit. o: {t0,t1,html,cls,y,x,w,align,style:'rise'|'fade'|'pop'|'left'} */
export function block(S, o) {
  const el = mk('div', `blk txt ${o.cls || ''}`, o.html);
  pos(el, o);
  if (o.size) el.style.fontSize = o.size + 'px';
  host(S).appendChild(el);
  const t0 = o.t0 ?? 0.2, t1 = o.t1 ?? (S ? S.dur - 0.1 : 1e9), st = o.style || 'rise';
  reg(S, (lt) => {
    const k = ease.expo(remap(lt, t0, t0 + 0.55)), ko = ease.in(remap(lt, t1 - 0.3, t1));
    el.style.opacity = lt < t0 ? 0 : k * (1 - ko);
    el.style.transform = st === 'rise' ? `translateY(${((1 - k) * 50 - ko * 30).toFixed(1)}px)` : st === 'pop' ? `scale(${(0.7 + 0.3 * ease.back(remap(lt, t0, t0 + 0.5))).toFixed(3)})` : st === 'left' ? `translateX(${((1 - k) * -80).toFixed(1)}px)` : '';
  });
  return el;
}

/** Staggered list. o: {t0, items:[html], y, x, w, gap, mark:'✕'|'✓'|'•', markColor, size, stagger} */
export function list(S, o) {
  const el = mk('div', 'list txt');
  pos(el, o);
  el.style.fontSize = (o.size ?? 52) + 'px';
  const rows = o.items.map((h) => { const r = mk('div', 'li', `<span class="mk" style="color:${o.markColor || '#ff5a6e'}">${o.mark || '✕'}</span><span class="lt">${h}</span>`); el.appendChild(r); return r; });
  host(S).appendChild(el);
  const t0 = o.t0 ?? 0.3, st = o.stagger ?? 0.32, t1 = o.t1 ?? (S ? S.dur - 0.1 : 1e9);
  if (S) rows.forEach((_, i) => E.cue(S.t0 + t0 + i * st, 'pop', { i }));
  reg(S, (lt) => {
    rows.forEach((r, i) => {
      const k = ease.expo(remap(lt, t0 + i * st, t0 + i * st + 0.5)), ko = ease.in(remap(lt, t1 - 0.3 + i * 0.03, t1 + i * 0.03));
      r.style.opacity = lt < t0 + i * st ? 0 : k * (1 - ko);
      r.style.transform = `translateX(${((1 - k) * 40 + ko * 40).toFixed(1)}px)`;
      const mk2 = r.querySelector('.mk');
      mk2.style.transform = `scale(${ease.back(remap(lt, t0 + i * st + 0.12, t0 + i * st + 0.45)).toFixed(3)})`;
    });
  });
  return el;
}

/** Label pinned to a 3D point. o: {at: Vector3 | () => Vector3, html, t0, t1, dx, dy, cls, anchor:'center'|'left'|'right'} */
export function tag3d(S, o) {
  const el = mk('div', `tag3d txt ${o.cls || ''}`, o.html);
  el.style.position = 'absolute';
  host(S).appendChild(el);
  const t0 = o.t0 ?? 0.3, t1 = o.t1 ?? S.dur - 0.1;
  S.late.push((lt) => {
    const v = typeof o.at === 'function' ? o.at(lt) : o.at;
    const [x, y] = E.toScreen(S, v);
    const k = ease.expo(remap(lt, t0, t0 + 0.45)), ko = ease.in(remap(lt, t1 - 0.25, t1));
    el.style.opacity = lt < t0 ? 0 : k * (1 - ko);
    const ax = o.anchor === 'left' ? '0%' : o.anchor === 'right' ? '-100%' : '-50%';
    el.style.transform = `translate(${(x + (o.dx || 0)).toFixed(1)}px, ${(y + (o.dy || 0) + (1 - k) * 24).toFixed(1)}px) translate(${ax}, -50%) scale(${(0.85 + 0.15 * k).toFixed(3)})`;
  });
  return el;
}

/** Brand chrome: wordmark, topic pill, scene progress segments. */
export function chrome(o = {}) {
  const el = mk('div', 'chrome', `
    <div class="brandrow txt"><div class="wm">Pol<i>Tok</i></div><div class="pill ${o.cls || ''}"><span class="dot"></span>${o.label || 'EXPLAINED'}</div></div>
    <div class="segs">${E.tl.scenes.filter((s) => !s.noProgress).map(() => '<div class="seg"><div></div></div>').join('')}</div>`);
  ov().appendChild(el);
  const segs = [...el.querySelectorAll('.seg > div')];
  const sc = E.tl.scenes.filter((s) => !s.noProgress);
  const endT = E.tl.scenes.find((s) => s.id === 'end')?.t0 ?? E.tl.duration;
  E.updaters.push((t) => {
    sc.forEach((s, i) => { segs[i].style.transform = `scaleX(${clamp((t - s.t0) / (s.t1 - s.t0)).toFixed(4)})`; });
    const kin = ease.expo(remap(t, o.inAt ?? 0.9, (o.inAt ?? 0.9) + 0.6));
    const kout = ease.in(remap(t, endT - 0.3, endT));
    el.style.opacity = kin * (1 - kout);
    el.style.transform = `translateY(${((1 - kin) * -30).toFixed(1)}px)`;
    el.querySelector('.dot').style.opacity = 0.45 + 0.55 * Math.abs(Math.sin(t * 3.2));
  });
  return el;
}

/** Persistent badge in the global layer. o: {text, y, from, to, cls} */
export function badge(o) {
  const el = mk('div', `badge txt ${o.cls || ''}`, o.text);
  el.style.top = (o.y ?? 330) + 'px';
  ov().appendChild(el);
  E.updaters.push((t) => {
    const k = ease.expo(remap(t, o.from, o.from + 0.5)), ko = ease.in(remap(t, o.to - 0.3, o.to));
    el.style.opacity = t < o.from ? 0 : k * (1 - ko);
  });
  return el;
}

/** Burned-in captions (bottom safe zone). caps: [{t0,t1,text}] in absolute seconds. */
export function captions(caps) {
  const el = mk('div', 'caption txt');
  const inner = mk('div', 'cin');
  el.appendChild(inner);
  ov().appendChild(el);
  let cur = -1, words = [];
  const hi = (w) => /[0-9%$]/.test(w) || /^(No|Aye|not|Senate|House|majority|preferences?|overhang)\W*$/i.test(w);
  E.updaters.push((t) => {
    const i = caps.findIndex((c) => t >= c.t0 && t < c.t1);
    if (i !== cur) {
      cur = i;
      inner.innerHTML = '';
      words = [];
      if (i >= 0) {
        for (const w of caps[i].text.split(/\s+/)) {
          const s = mk('span', 'cw' + (hi(w) ? ' hi' : ''));
          s.textContent = w;
          inner.appendChild(s); inner.appendChild(document.createTextNode(' '));
          words.push(s);
        }
      }
    }
    if (i < 0) { el.style.opacity = 0; return; }
    const c = caps[i];
    const k = ease.expo(remap(t, c.t0, c.t0 + 0.25)), ko = remap(t, c.t1 - 0.08, c.t1);
    el.style.opacity = 1 - ko;
    inner.style.transform = `translateY(${((1 - k) * 18).toFixed(1)}px) scale(${(0.96 + 0.04 * k).toFixed(3)})`;
    const span = c.t1 - c.t0;
    words.forEach((w, j) => {
      const at = c.t0 + (span * 0.85 * j) / Math.max(1, words.length);
      w.style.opacity = t >= at - 0.05 ? 1 : 0.45;
    });
  });
  return el;
}

/** Scrims for legibility over 3D */
export function scrims() {
  ov().appendChild(mk('div', 'scrim top'));
  ov().appendChild(mk('div', 'scrim bot'));
}

/** Debug: draw safe areas. */
export function safeGuides() {
  const g = mk('div', 'guides');
  g.innerHTML = `<div style="top:0;height:${SAFE.top}px"></div><div style="bottom:0;height:${H - SAFE.bottom}px"></div>`;
  document.body.appendChild(g);
}

/** Audit visible text against the safe area. Returns violations. */
export function audit() {
  const out = [];
  for (const el of document.querySelectorAll('#ov .txt')) {
    let vis = true;
    for (let n = el; n && n.id !== 'ov'; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || +cs.opacity < 0.2) { vis = false; break; }
    }
    if (!vis) continue;
    // measure the actual ink: union of word/text boxes
    const rg = document.createRange();
    rg.selectNodeContents(el);
    const r = rg.getBoundingClientRect();
    if (r.width === 0) continue;
    const bad = [];
    if (r.top < SAFE.top - 1) bad.push('top ' + Math.round(r.top));
    if (r.bottom > SAFE.bottom + 1) bad.push('bottom ' + Math.round(r.bottom));
    if (r.left < SAFE.left - 1) bad.push('left ' + Math.round(r.left));
    if (r.right > SAFE.right + 1) bad.push('right ' + Math.round(r.right));
    if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflow !== 'visible') bad.push('clipped-x');
    if (bad.length) out.push({ cls: el.className, text: el.textContent.trim().slice(0, 40), bad });
  }
  return out;
}
