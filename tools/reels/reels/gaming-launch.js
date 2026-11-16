// Reel (teaser, v2) — "PolTok Gaming: coming soon", styled like poltok.netlify.app: near-black ink, chartreuse accent
// (#cdf25a), the blue/red logo bars, Inter Tight + Newsreader, glass cards, LIVE pill and ticker. Motion graphics are DOM,
// driven per frame; a warp-speed particle field in brand colours runs behind (3D, with bloom).
// Real games shown: QUORUM (poltok.netlify.app/play) and the /quiz modes (Issues match, Daily trivia, Guess the map).
// Screens are real screenshots of the live site (tools/reels/assets/gaming).

export async function data() { return {}; }

export const meta = {
  title: 'PolTok Gaming',
  label: 'COMING SOON',
  out: 'poltok-gaming-launch',
  cover: 4.2,
  music: { prog: ['Em', 'C', 'G', 'D'], arp: 'updown', seed: 433, swing: 0.0 },
};

export const scenes = () => [
  { id: 'boot', beats: 6, energy: 3, voLead: 0.25, say: 'Coming soon, to PolTok.', cap: 'Coming soon to PolTok 👀' },
  { id: 'reveal', beats: 7, energy: 3, trans: { type: 'flash', dur: 0.28 }, say: 'PolTok Gaming.', cap: 'PolTok Gaming 🎮' },
  { id: 'features', beats: 9, energy: 3, trans: { type: 'whip', dir: 'up', dur: 0.36 },
    say: 'Political games, ready to play. Free. Right in your browser.', cap: 'Ready to play. Free. In your browser.' },
  { id: 'quorum', beats: 11, energy: 3, trans: { type: 'zoom', dur: 0.4 },
    say: 'Starting with Quorum. Found a party, whip the votes, and run a country.', cap: 'QUORUM: found a party, whip the votes, run a country.' },
  { id: 'more', beats: 8, energy: 2, trans: { type: 'whip', dir: 'left', dur: 0.36 },
    say: 'Plus daily trivia, and guess the map.', cap: 'Plus Daily trivia and Guess the map 🧠🗺️' },
  { id: 'ask', beats: 8, energy: 3, trans: { type: 'flash', dur: 0.28 },
    say: 'So what game should we make next? Comment it.', cap: 'What should we make next? Comment 👇' },
  { id: 'end', beats: 7, energy: 1, trans: { type: 'zoom', dur: 0.45 }, noProgress: true },
];

export function build({ E, THREE }) {
  const { ease, remap } = E;
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, k) => a + (b - a) * k;
  const LIME = '#cdf25a', BLUE = '#3d7bff', RED = '#ff3d55', INK = '#090b10', CREAM = '#f3e3c3', GOLD = '#d8b25a';
  const FONT = "'Inter Tight', Inter, system-ui, sans-serif", SERIF = "'Newsreader', Georgia, serif", MONO = "'JetBrains Mono', monospace";

  // ---------- preload real screenshots; the renderer waits on E.pending before capturing ----------
  E.pending = E.pending || [];
  const SRC = { title: '/assets/gaming/quorum-title.jpg', party: '/assets/gaming/quorum-party.jpg', quiz: '/assets/gaming/quiz.jpg' };
  for (const u of Object.values(SRC)) { const im = new Image(); im.src = u; E.pending.push(im.decode().catch(() => { throw new Error('asset failed: ' + u); })); }

  // ---------- DOM helpers ----------
  const add = (parent, html, css) => { const d = document.createElement('div'); if (html) d.innerHTML = html; d.style.cssText = 'position:absolute;' + css; parent.appendChild(d); return d; };
  const css = (el, o) => { for (const k in o) el.style[k] = o[k]; };
  const logo = (parent, x, y, s = 1) => add(parent, `
    <div style="display:flex;align-items:center;gap:${18 * s}px">
      <div class="bars" style="display:flex;gap:${8 * s}px;align-items:flex-start">
        <i style="display:block;width:${22 * s}px;height:${64 * s}px;border-radius:${11 * s}px;background:${BLUE};box-shadow:0 0 ${30 * s}px ${BLUE}"></i>
        <i style="display:block;width:${22 * s}px;height:${64 * s}px;border-radius:${11 * s}px;background:${RED};margin-top:${18 * s}px;box-shadow:0 0 ${30 * s}px ${RED}"></i>
      </div>
      <div class="wm" style="font:900 ${96 * s}px/1 ${FONT};letter-spacing:-0.02em;color:#fff">POL<span style="color:${LIME}">TOK</span></div>
    </div>`, `left:${x}px;top:${y}px;transform-origin:left center`);
  const pill = (parent, txt, bg, col, css2 = '') => add(parent, `<span class="dot" style="display:inline-block;width:18px;height:18px;border-radius:50%;background:${col};margin-right:14px;vertical-align:middle"></span><span style="vertical-align:middle">${txt}</span>`,
    `padding:14px 28px;border-radius:14px;background:${bg};color:${col};font:800 34px/1 ${FONT};letter-spacing:.12em;white-space:nowrap;` + css2);
  const card = (parent, icon, title, sub, y) => add(parent, `
    <div style="display:flex;align-items:center;gap:30px">
      <div style="width:104px;height:104px;border-radius:26px;background:rgba(205,242,90,.12);border:1px solid rgba(205,242,90,.45);display:grid;place-items:center;font-size:54px">${icon}</div>
      <div><div style="font:800 52px/1.05 ${FONT};color:#fff">${title}</div><div style="font:500 30px/1.3 ${FONT};color:#9aa3b5;margin-top:8px">${sub}</div></div>
    </div><div class="shine" style="position:absolute;inset:0;border-radius:28px;background:linear-gradient(105deg,transparent 35%,rgba(255,255,255,.14) 50%,transparent 65%);background-size:250% 100%"></div>`,
    `left:90px;right:90px;top:${y}px;padding:30px 34px;border-radius:28px;background:linear-gradient(160deg,rgba(255,255,255,.08),rgba(255,255,255,.02));border:1px solid rgba(255,255,255,.14);box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 24px 60px rgba(0,0,0,.45);overflow:hidden;transform-origin:center top`);
  const phone = (parent, src, x, y, w = 560) => {
    const h = Math.round(w * 2.164);
    const p = add(parent, `<div class="scr" style="position:absolute;inset:16px;border-radius:58px;overflow:hidden;background:#000">
        <img class="a" src="${src}" style="position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover"/>
        <img class="b" style="position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;opacity:0"/>
        <div class="glare" style="position:absolute;inset:0;background:linear-gradient(120deg,rgba(255,255,255,.16),transparent 40%)"></div></div>
      <div style="position:absolute;left:50%;top:30px;width:150px;height:40px;margin-left:-75px;border-radius:20px;background:#000"></div>`,
      `left:${x}px;top:${y}px;width:${w}px;height:${h}px;border-radius:74px;background:linear-gradient(145deg,#2a2f3b,#11141b);box-shadow:0 0 0 2px #3a4150,0 50px 120px rgba(0,0,0,.7),0 0 120px rgba(205,242,90,.18);transform-style:preserve-3d`);
    return { el: p, a: p.querySelector('.a'), b: p.querySelector('.b') };
  };
  // RGB-split glitch: offset red/blue shadows that settle to zero
  const rgb = (k, amp = 14) => { const o = amp * k; return `${-o}px 0 0 ${RED}, ${o}px 0 0 ${BLUE}, 0 0 40px rgba(205,242,90,${0.35 * (1 - k) + 0.25})`; };
  const noise = (t) => Math.sin(t * 91.7) * Math.sin(t * 37.3 + 1.7);

  // ---------- 3D: warp-speed particle field in brand colours (bloom makes it glow) ----------
  const field = (S, o = {}) => {
    S.scene.background = new THREE.Color(0x07080d);
    const n = o.n ?? 1400, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), seed = new Float32Array(n);
    const pal = [new THREE.Color(LIME), new THREE.Color(BLUE), new THREE.Color(RED), new THREE.Color('#ffffff')];
    for (let i = 0; i < n; i++) {
      const a = (i * 2.399963) % (Math.PI * 2), r = 1.5 + ((i * 7919) % 1000) / 1000 * 14;
      pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = Math.sin(a) * r * 1.6; seed[i] = ((i * 104729) % 1000) / 1000;
      const c = pal[i % 7 === 0 ? 1 : i % 7 === 1 ? 2 : i % 5 === 0 ? 3 : 0]; col.set([c.r, c.g, c.b], i * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.PointsMaterial({ size: o.size ?? 0.09, vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    const pts = new THREE.Points(g, m); S.scene.add(pts);
    // faint perspective grid floor in chartreuse
    const grid = new THREE.GridHelper(80, 40, 0xcdf25a, 0xcdf25a); grid.material.transparent = true; grid.material.opacity = o.grid ?? 0.08; grid.position.y = -6; S.scene.add(grid);
    S.camera.position.set(0, 0, 10); S.camera.lookAt(0, 0, -50); S.camera.fov = 60; S.camera.updateProjectionMatrix();
    S.aperture = 0;
    const speed = o.speed ?? ((lt) => 18);
    S.update((lt) => {
      const sp = speed(lt), p = g.attributes.position.array;
      for (let i = 0; i < n; i++) p[i * 3 + 2] = -60 + (((seed[i] * 70 + lt * sp) % 70) + 70) % 70;
      g.attributes.position.needsUpdate = true;
      grid.position.z = (lt * sp * 0.5) % 2;
      S.camera.rotation.z = Math.sin(lt * 0.7) * 0.04;
    });
  };

  // ---------- scenes ----------
  E.defineScene('boot', (S) => {
    field(S, { speed: (lt) => lerp(60, 10, ease.out(remap(lt, 0, 1.6))) });
    const L = logo(S.layer, 0, 700, 1.25);
    const bars = L.querySelectorAll('i'), wm = L.querySelector('.wm');
    const cs = pill(S.layer, 'COMING SOON', 'rgba(205,242,90,.12)', LIME, 'border:2px solid rgba(205,242,90,.6);left:50%;top:960px');
    const scan = add(S.layer, '', `inset:0;background:repeating-linear-gradient(0deg,rgba(255,255,255,.035) 0 2px,transparent 2px 6px);mix-blend-mode:overlay`);
    E.cue(S.t0 + 0.12, 'boom', { g: 0.9 }); E.cue(S.t0 + 0.9, 'blip'); E.cue(S.t0 + 1.5, 'pop', { i: 2 });
    S.update((lt) => {
      // bars drop in with overshoot, then wordmark types in
      bars.forEach((b, i) => { const k = ease.back(remap(lt, 0.1 + i * 0.12, 0.55 + i * 0.12)); b.style.transform = `translateY(${(1 - k) * -500}px) scaleY(${lerp(1.6, 1, k)})`; b.style.opacity = remap(lt, 0.1 + i * 0.12, 0.25 + i * 0.12); });
      const n = Math.round(clamp((lt - 0.7) / 0.5) * 6); const txt = 'POLTOK'.slice(0, n);
      wm.innerHTML = txt.slice(0, 3) + `<span style="color:${LIME}">${txt.slice(3)}</span>` + (lt < 1.4 && Math.floor(lt * 8) % 2 ? `<span style="color:${LIME}">▌</span>` : '');
      const gk = Math.max(0, 1 - remap(lt, 0.7, 1.4)) + (Math.abs(noise(lt)) > 0.85 ? 0.6 : 0);
      wm.style.textShadow = rgb(gk, 16);
      const w = L.offsetWidth || 760; L.style.left = (540 - w / 2) + 'px';
      L.style.transform = `scale(${lerp(1.08, 1, ease.out(remap(lt, 0, 2.5)))})`;
      const k = ease.back(remap(lt, 1.45, 1.9));
      cs.style.transform = `translateX(-50%) scale(${k})`; cs.style.opacity = k > 0 ? 1 : 0;
      cs.querySelector('.dot').style.opacity = 0.35 + 0.65 * (Math.sin(lt * 9) > 0 ? 1 : 0.3);
      scan.style.opacity = 0.6 + 0.4 * Math.abs(noise(lt * 0.3));
    });
  });

  E.defineScene('reveal', (S) => {
    field(S, { speed: (lt) => lerp(140, 26, ease.out(remap(lt, 0, 1.2))), grid: 0.12 });
    const small = logo(S.layer, 0, 560, 0.62);
    const big = add(S.layer, 'GAMING'.split('').map((c) => `<span style="display:inline-block">${c}</span>`).join(''),
      `left:0;right:0;top:680px;text-align:center;font:900 214px/1 ${FONT};letter-spacing:-0.03em;color:${LIME}`);
    const letters = big.querySelectorAll('span');
    const pad = add(S.layer, '🎮', `left:50%;top:930px;font-size:150px;transform:translateX(-50%)`);
    const tick = add(S.layer, `<div class="tk" style="white-space:nowrap;font:700 36px/1 ${MONO};color:#cfd6e4">${'<span style="color:#ff3d55">●</span>&nbsp; NEW &nbsp;◆&nbsp; FREE TO PLAY &nbsp;◆&nbsp; NO DOWNLOAD &nbsp;◆&nbsp; IN YOUR BROWSER &nbsp;◆&nbsp; '.repeat(4)}</div>`,
      `left:0;right:0;top:1200px;padding:26px 0;background:rgba(15,18,24,.86);border-top:1px solid rgba(255,255,255,.14);border-bottom:1px solid rgba(255,255,255,.14);overflow:hidden`);
    const tk = tick.querySelector('.tk');
    letters.forEach((_, i) => E.cue(S.t0 + 0.08 + i * 0.07, 'tick', { k: 0.4 }));
    E.cue(S.t0 + 0.6, 'boom', { g: 0.7 });
    S.update((lt) => {
      const sw = small.offsetWidth || 470; small.style.left = (540 - sw / 2) + 'px';
      small.style.opacity = remap(lt, 0, 0.3);
      letters.forEach((el, i) => {
        const k = ease.back(remap(lt, 0.05 + i * 0.07, 0.4 + i * 0.07));
        el.style.transform = `translateY(${(1 - k) * 160}px) scale(${lerp(2.2, 1, ease.expo(remap(lt, 0.05 + i * 0.07, 0.4 + i * 0.07)))}) rotate(${(1 - k) * (i % 2 ? 12 : -12)}deg)`;
        el.style.opacity = remap(lt, 0.05 + i * 0.07, 0.15 + i * 0.07);
      });
      const gl = Math.max(0, 1 - remap(lt, 0.5, 1.2)) + (Math.abs(noise(lt + 3)) > 0.88 ? 0.5 : 0);
      big.style.textShadow = rgb(gl, 22) + `, 0 0 80px rgba(205,242,90,${0.35 + 0.15 * Math.sin(lt * 4)})`;
      const pk = ease.back(remap(lt, 0.8, 1.25)); pad.style.transform = `translateX(-50%) scale(${pk}) rotate(${Math.sin(lt * 3) * 8}deg)`; pad.style.opacity = pk > 0 ? 1 : 0;
      const tkk = ease.expo(remap(lt, 0.9, 1.4)); tick.style.transform = `translateX(${(1 - tkk) * 1100}px)`;
      tk.style.transform = `translateX(${-lt * 220}px)`;
    });
  });

  E.defineScene('features', (S) => {
    field(S, { speed: () => 16 });
    const head = add(S.layer, `<span style="display:inline-block;width:56px;height:6px;background:${LIME};vertical-align:middle;margin-right:18px;border-radius:3px"></span>POLTOK GAMING`,
      `left:90px;top:340px;font:700 34px/1 ${MONO};letter-spacing:.14em;color:#7cc0ff`);
    const items = [['🗳️', 'Political games', 'Built on real-world politics'], ['⚡', 'Ready to play', 'No waitlist. Tap and go'], ['💸', '100% free', 'No paywall. No catch'], ['🌐', 'In your browser', 'Nothing to download']];
    const cards = items.map(([ic, t, s], i) => card(S.layer, ic, t, s, 420 + i * 230));
    items.forEach((_, i) => E.cue(S.t0 + 0.35 + i * 0.75, 'pop', { i }));
    S.update((lt) => {
      head.style.opacity = remap(lt, 0, 0.3);
      cards.forEach((c, i) => {
        const t0 = 0.3 + i * 0.75, k = ease.out(remap(lt, t0, t0 + 0.55));
        c.style.transform = `perspective(1400px) rotateX(${(1 - k) * -80}deg) translateY(${(1 - k) * 120}px)`;
        c.style.opacity = remap(lt, t0, t0 + 0.2);
        const lit = remap(lt, t0 + 0.4, t0 + 0.75) > 0 && lt < t0 + 1.0;
        c.style.borderColor = lit ? 'rgba(205,242,90,.85)' : 'rgba(255,255,255,.14)';
        c.style.boxShadow = lit ? '0 0 0 1px rgba(205,242,90,.5), 0 0 50px -6px rgba(205,242,90,.6)' : 'inset 0 1px 0 rgba(255,255,255,.12),0 24px 60px rgba(0,0,0,.45)';
        c.querySelector('.shine').style.backgroundPosition = `${lerp(160, -60, ease.inOut(remap(lt, t0 + 0.3, t0 + 1.1)))}% 0`;
      });
    });
  });

  E.defineScene('quorum', (S) => {
    field(S, { speed: () => 12, grid: 0.05 });
    const kick = add(S.layer, 'FIRST UP', `left:0;right:0;top:322px;text-align:center;font:700 34px/1 ${MONO};letter-spacing:.3em;color:${GOLD}`);
    const title = add(S.layer, 'QUORUM', `left:0;right:0;top:392px;text-align:center;font:800 124px/1 ${SERIF};letter-spacing:.08em;color:${CREAM};background:linear-gradient(180deg,#fff6e0,${CREAM} 45%,${GOLD});-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent`);
    const ph = phone(S.layer, SRC.title, 305, 565, 470);
    const tags = ['Found a party', 'Whip the votes', 'Run a country'].map((t, i) => add(S.layer, t,
      `left:${[40, 640, 60][i]}px;top:${[700, 980, 1250][i]}px;padding:18px 28px;border-radius:999px;background:rgba(15,18,24,.9);border:1.5px solid ${LIME};color:#fff;font:800 38px/1 ${FONT};box-shadow:0 0 40px -8px ${LIME};white-space:nowrap`));
    E.cue(S.t0 + 0.2, 'boom', { g: 0.6 }); tags.forEach((_, i) => E.cue(S.t0 + 1.6 + i * 0.9, 'pop', { i }));
    E.cue(S.t0 + 3.0, 'whoosh', { dir: 'left', dur: 0.4 });
    S.update((lt) => {
      kick.style.opacity = remap(lt, 0, 0.3);
      const tk = ease.expo(remap(lt, 0.05, 0.7)); title.style.transform = `scale(${lerp(1.6, 1, tk)})`; title.style.opacity = tk; title.style.filter = `blur(${(1 - tk) * 14}px)`;
      const pk = ease.out(remap(lt, 0.2, 1.2));
      ph.el.style.transform = `perspective(1800px) translateY(${(1 - pk) * 900}px) rotateY(${lerp(-28, -8, pk) + Math.sin(lt * 0.9) * 6}deg) rotateX(${lerp(18, 4, pk)}deg)`;
      // swipe from the title screen to "Found your party"
      const sk = ease.inOut(remap(lt, 3.0, 3.5));
      if (sk > 0 && !ph.b.src) ph.b.src = SRC.party;
      ph.a.style.transform = `translateX(${-sk * 100}%)`; ph.b.style.transform = `translateX(${(1 - sk) * 100}%)`; ph.b.style.opacity = sk > 0 ? 1 : 0;
      tags.forEach((t, i) => { const k = ease.back(remap(lt, 1.5 + i * 0.9, 1.9 + i * 0.9)); t.style.transform = `scale(${k}) rotate(${(i % 2 ? 3 : -3)}deg) translateY(${Math.sin(lt * 2 + i) * 8}px)`; t.style.opacity = k > 0 ? 1 : 0; });
    });
  });

  E.defineScene('more', (S) => {
    field(S, { speed: () => 20 });
    const ph = phone(S.layer, SRC.quiz, 330, 500, 440);
    const head = add(S.layer, `Plus <span style="color:${LIME}">more</span>`, `left:0;right:0;top:320px;text-align:center;font:900 120px/1 ${FONT};color:#fff;letter-spacing:-0.02em`);
    const chips = [['🧠', 'Daily trivia'], ['🗺️', 'Guess the map'], ['🤝', 'Issues match']].map(([ic, t], i) => add(S.layer, `${ic}&nbsp; ${t}`,
      `left:${[50, 560, 70][i]}px;top:${[720, 940, 1180][i]}px;padding:22px 32px;border-radius:22px;background:linear-gradient(160deg,rgba(255,255,255,.12),rgba(255,255,255,.04));border:1px solid rgba(255,255,255,.22);color:#fff;font:800 42px/1 ${FONT};box-shadow:0 20px 50px rgba(0,0,0,.5);white-space:nowrap;backdrop-filter:blur(12px)`));
    chips.forEach((_, i) => E.cue(S.t0 + 0.6 + i * 0.5, 'pop', { i }));
    S.update((lt) => {
      const hk = ease.back(remap(lt, 0.05, 0.45)); head.style.transform = `scale(${hk})`; head.style.opacity = hk > 0 ? 1 : 0;
      const pk = ease.out(remap(lt, 0.1, 0.9));
      ph.el.style.transform = `perspective(1800px) translateX(${(1 - pk) * 900}px) rotateY(${lerp(30, 10, pk) + Math.sin(lt) * 4}deg)`;
      chips.forEach((c, i) => { const k = ease.back(remap(lt, 0.55 + i * 0.5, 0.95 + i * 0.5)); c.style.transform = `translateY(${(1 - k) * 80 + Math.sin(lt * 2.2 + i) * 10}px) scale(${k})`; c.style.opacity = k > 0 ? 1 : 0; });
    });
  });

  E.defineScene('ask', (S) => {
    field(S, { speed: (lt) => 14 + 10 * Math.sin(lt * 2) });
    const q = add(S.layer, `What should we<br><span style="color:${LIME};font-style:italic;font-family:${SERIF};font-weight:600">make next?</span>`,
      `left:0;right:0;top:420px;text-align:center;font:900 110px/1.05 ${FONT};color:#fff;letter-spacing:-0.02em`);
    const btn = add(S.layer, 'Comment your idea 👇', `left:50%;top:860px;padding:38px 64px;border-radius:24px;background:${LIME};color:#0d1200;font:800 52px/1 ${FONT};white-space:nowrap`);
    const marks = Array.from({ length: 9 }, (_, i) => add(S.layer, '?', `left:${80 + (i * 113) % 920}px;top:${1080 + ((i * 197) % 300)}px;font:900 ${70 + (i % 3) * 30}px/1 ${FONT};color:${[LIME, BLUE, RED][i % 3]};opacity:0`));
    E.cue(S.t0 + 0.9, 'ding');
    S.update((lt) => {
      const k = ease.expo(remap(lt, 0.05, 0.6)); q.style.transform = `translateY(${(1 - k) * 60}px)`; q.style.opacity = k; q.style.textShadow = rgb(Math.max(0, 1 - remap(lt, 0.1, 0.7)), 12);
      const bk = ease.back(remap(lt, 0.8, 1.2)); const pulse = 1 + 0.04 * Math.sin(lt * 7);
      btn.style.transform = `translateX(-50%) scale(${bk * pulse})`; btn.style.opacity = bk > 0 ? 1 : 0;
      btn.style.boxShadow = `0 0 0 ${8 + 8 * Math.abs(Math.sin(lt * 3.5))}px rgba(205,242,90,.18), 0 0 70px rgba(205,242,90,.55)`;
      marks.forEach((m, i) => { const mk = remap(lt, 1.2 + i * 0.12, 1.5 + i * 0.12); m.style.opacity = mk * 0.85; m.style.transform = `translateY(${-((lt - 1.2) * 60 + i * 10) % 300}px) rotate(${Math.sin(lt * 2 + i) * 20}deg)`; });
    });
  });

  E.defineScene('end', (S) => {
    field(S, { speed: (lt) => lerp(20, 6, remap(lt, 0, 2)) });
    const L = logo(S.layer, 0, 560, 1.1);
    const sub = add(S.layer, `GAMING <span style="color:#fff">· COMING SOON</span>`, `left:0;right:0;top:720px;text-align:center;font:800 54px/1 ${FONT};letter-spacing:.18em;color:${LIME}`);
    const url = add(S.layer, 'poltok.netlify.app/play', `left:50%;top:860px;padding:30px 52px;border-radius:22px;background:${LIME};color:#0d1200;font:800 46px/1 ${FONT};white-space:nowrap`);
    const fol = add(S.layer, '🔔 Follow so you don\'t miss the launch', `left:0;right:0;top:1010px;text-align:center;font:600 38px/1 ${FONT};color:#cfd6e4`);
    const note = add(S.layer, 'QUORUM is an original PolTok game. Calderra and its parties are fictional.', `left:100px;right:100px;top:1440px;text-align:center;font:500 26px/1.4 ${FONT};color:#6b7385`);
    S.update((lt) => {
      const lw = L.offsetWidth || 700; L.style.left = (540 - lw / 2) + 'px';
      const k = ease.back(remap(lt, 0.05, 0.5)); L.style.transform = `scale(${k})`; L.style.opacity = k > 0 ? 1 : 0;
      sub.style.opacity = remap(lt, 0.4, 0.7); sub.style.letterSpacing = `${lerp(0.5, 0.18, ease.out(remap(lt, 0.4, 1.0)))}em`;
      const uk = ease.back(remap(lt, 0.7, 1.1)); url.style.transform = `translateX(-50%) scale(${uk})`; url.style.opacity = uk > 0 ? 1 : 0;
      url.style.boxShadow = `0 0 60px rgba(205,242,90,${0.3 + 0.25 * Math.sin(lt * 4)})`;
      fol.style.opacity = remap(lt, 1.1, 1.5); note.style.opacity = remap(lt, 1.3, 1.7);
    });
  });
}
