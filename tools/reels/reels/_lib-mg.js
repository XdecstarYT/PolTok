// Shared motion-graphics kit in the poltok.netlify.app style (near-black ink, chartreuse, blue/red logo bars, Inter Tight,
// glass cards). DOM elements are driven per frame from S.update; a warp particle field runs in 3D behind (with bloom).
export function mg(E, THREE) {
  const { ease, remap } = E;
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, k) => a + (b - a) * k;
  const T = { LIME: '#cdf25a', BLUE: '#3d7bff', RED: '#ff3d55', ORANGE: '#ff9a4a', GREEN: '#5fd17f', SKY: '#7cc0ff', MUTED: '#9aa3b5',
    FONT: "'Inter Tight', Inter, system-ui, sans-serif", SERIF: "'Newsreader', Georgia, serif", MONO: "'JetBrains Mono', monospace" };
  const add = (parent, html, css) => { const d = document.createElement('div'); if (html != null) d.innerHTML = html; d.style.cssText = 'position:absolute;' + css; parent.appendChild(d); return d; };
  const rgb = (k, amp = 14) => { const o = amp * k; return `${-o}px 0 0 ${T.RED}, ${o}px 0 0 ${T.BLUE}, 0 0 40px rgba(205,242,90,${0.35 * (1 - k) + 0.2})`; };
  const noise = (t) => Math.sin(t * 91.7) * Math.sin(t * 37.3 + 1.7);
  const kicker = (parent, txt, y, col = T.SKY) => add(parent, `<span style="display:inline-block;width:56px;height:6px;background:${T.LIME};vertical-align:middle;margin-right:18px;border-radius:3px"></span>${txt}`,
    `left:90px;right:90px;top:${y}px;font:700 34px/1.2 ${T.MONO};letter-spacing:.12em;color:${col}`);
  const glass = (parent, html, css) => add(parent, html + `<div class="shine" style="position:absolute;inset:0;border-radius:inherit;background:linear-gradient(105deg,transparent 35%,rgba(255,255,255,.14) 50%,transparent 65%);background-size:250% 100%;background-position:160% 0"></div>`,
    `border-radius:28px;background:linear-gradient(160deg,rgba(255,255,255,.08),rgba(255,255,255,.02));border:1px solid rgba(255,255,255,.14);box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 24px 60px rgba(0,0,0,.45);overflow:hidden;` + css);
  // standard entrances
  const flipIn = (el, lt, t0, d = 0.55) => { const k = ease.out(remap(lt, t0, t0 + d)); el.style.transform = `perspective(1400px) rotateX(${(1 - k) * -80}deg) translateY(${(1 - k) * 120}px)`; el.style.opacity = remap(lt, t0, t0 + 0.2); return k; };
  const popIn = (el, lt, t0, d = 0.4, base = '') => { const k = ease.back(remap(lt, t0, t0 + d)); el.style.transform = `${base} scale(${k})`; el.style.opacity = k > 0 ? 1 : 0; return k; };
  const slideIn = (el, lt, t0, dx = 0, dy = 80, d = 0.5) => { const k = ease.expo(remap(lt, t0, t0 + d)); el.style.transform = `translate(${(1 - k) * dx}px,${(1 - k) * dy}px)`; el.style.opacity = k; return k; };
  const shine = (el, lt, t0) => { const s = el.querySelector('.shine'); if (s) s.style.backgroundPosition = `${lerp(160, -60, ease.inOut(remap(lt, t0, t0 + 0.8)))}% 0`; };
  const glitchText = (el, lt, t0, t1, amp = 16, extra = '') => { const gk = Math.max(0, 1 - remap(lt, t0, t1)) + (Math.abs(noise(lt)) > 0.88 ? 0.5 : 0); el.style.textShadow = rgb(gk, amp) + extra; };
  // warp-speed particle field in brand colours + faint chartreuse grid floor
  const field = (S, o = {}) => {
    S.scene.background = new THREE.Color(o.bg ?? 0x07080d);
    const n = o.n ?? 1400, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), seed = new Float32Array(n);
    const pal = (o.palette ?? [T.LIME, T.BLUE, T.RED, '#ffffff']).map((c) => new THREE.Color(c));
    for (let i = 0; i < n; i++) {
      const a = (i * 2.399963) % (Math.PI * 2), r = 1.5 + ((i * 7919) % 1000) / 1000 * 14;
      pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = Math.sin(a) * r * 1.6; seed[i] = ((i * 104729) % 1000) / 1000;
      const c = pal[i % 7 === 0 ? 1 % pal.length : i % 7 === 1 ? 2 % pal.length : i % 5 === 0 ? 3 % pal.length : 0]; col.set([c.r, c.g, c.b], i * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.PointsMaterial({ size: o.size ?? 0.09, vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    S.scene.add(new THREE.Points(g, m));
    const gc = new THREE.Color(o.gridColor ?? T.LIME).getHex();
    const grid = new THREE.GridHelper(80, 40, gc, gc); grid.material.transparent = true; grid.material.opacity = o.grid ?? 0.08; grid.position.y = -6; S.scene.add(grid);
    S.camera.position.set(0, 0, 10); S.camera.lookAt(0, 0, -50); S.camera.fov = 60; S.camera.updateProjectionMatrix();
    S.aperture = 0;
    const speed = o.speed ?? (() => 16);
    S.update((lt) => {
      const sp = speed(lt), p = g.attributes.position.array;
      for (let i = 0; i < n; i++) p[i * 3 + 2] = -60 + (((seed[i] * 70 + lt * sp) % 70) + 70) % 70;
      g.attributes.position.needsUpdate = true;
      grid.position.z = (lt * sp * 0.5) % 2;
      S.camera.rotation.z = Math.sin(lt * 0.7) * 0.04;
    });
  };
  return { T, add, rgb, noise, kicker, glass, flipIn, popIn, slideIn, shine, glitchText, field, clamp, lerp };
}
