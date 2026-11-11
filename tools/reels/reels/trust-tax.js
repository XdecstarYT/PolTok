// Reel 1 — Trust tax v2: the 30% minimum tax on discretionary trusts.
// Facts (supplied by the editor): Income Tax Rates Amendment (Minimum Tax on Discretionary Trusts) Bill 2026;
// 30% minimum tax on discretionary trusts' taxable income from 1 July 2028, aligned with the 30% rate for workers
// earning $45k–$135k; exclusions; passed the House 90–45; Senate Economics committee review; 3 years of roll-over
// relief from 1 July 2027.

export const meta = {
  title: 'The 30% trust tax, explained',
  label: 'EXPLAINED',
  out: 'poltok-trust-tax-v2',
  cover: 13.0,
  music: { prog: ['Am', 'F', 'C', 'G'], arp: 'updown', seed: 3, swing: 0.08 },
  voice: { lengthScale: 0.8 },
  geo: { au: { src: 'au-federal', mode: 'outline', width: 10, raster: 520 } },
};

export const scenes = [
  { id: 'hook', beats: 3, energy: 3 },
  { id: 'bill', beats: 8, energy: 1, trans: { type: 'zoom', dur: 0.5 },
    say: 'A new bill sets a thirty per cent minimum tax on discretionary trusts.',
    cap: 'A new bill sets a 30% minimum tax on discretionary trusts.' },
  { id: 'how', beats: 8, energy: 2, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: 'The trustee decides who gets the income. Often, family on lower tax rates.',
    cap: 'The trustee decides who gets the income. Often, family on lower tax rates.' },
  { id: 'floor', beats: 8, energy: 3, trans: { type: 'whip', dir: 'up', dur: 0.42 },
    say: 'From July 2028, trusts pay at least thirty per cent. The same rate many workers pay.',
    cap: 'From July 2028, trusts pay at least 30%. The same rate many workers pay.' },
  { id: 'out', beats: 8, energy: 2, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: 'Some are exempt: fixed and charitable trusts, super funds, deceased estates and more.',
    cap: 'Some are exempt: fixed and charitable trusts, super funds, deceased estates and more.' },
  { id: 'vote', beats: 8, energy: 3, trans: { type: 'flash', dur: 0.36 },
    say: 'It passed the House ninety to forty-five. The Coalition, One Nation and Katter\'s voted no.',
    cap: 'It passed the House 90–45. The Coalition, One Nation and Katter’s voted No.' },
  { id: 'senate', beats: 6, energy: 2, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: 'Now, a Senate committee is reviewing it.',
    cap: 'Now, a Senate committee is reviewing it.' },
  { id: 'relief', beats: 8, energy: 2, trans: { type: 'whip', dir: 'up', dur: 0.42 },
    say: 'Trusts get three years of roll-over relief, from July 2027.',
    cap: 'Trusts get 3 years of roll-over relief, from July 2027.' },
  { id: 'end', beats: 6, energy: 0, trans: { type: 'zoom', dur: 0.5 }, noProgress: true },
];

export function build({ E, kit, ui, THREE, endCard }) {
  const { C, ease, remap, clamp, lerp } = E;
  const ALP = 0xe53935, COAL = 0x1e5bc6, ONP = 0xf57c00, IND = 0x8e7cc3;

  // ---------------- HOOK ----------------
  E.defineScene('hook', (S) => {
    E.stage(S, { accent: C.lime, grid: 0.07, rim: 120, glow: 0.35, center: [0, 1.6, 0] });
    const txt = kit.text3d('30%', { size: 1.3, depth: 0.5, mat: kit.M.lime() });
    txt.position.set(0, 1.75, 0);
    S.scene.add(txt);
    // coin burst
    const coinG = kit.coinGeometry(0.28, 0.07);
    const n = 46, coins = new THREE.InstancedMesh(coinG, kit.M.gold(), n);
    coins.castShadow = true;
    const r = E.rng(5), dirs = [];
    for (let i = 0; i < n; i++) { const a = r() * Math.PI * 2, el = (r() - 0.3) * 1.2; dirs.push([Math.cos(a) * (1.6 + r() * 2.2), 1.2 + el * 2 + r() * 1.5, -1 - r() * 4, r() * 6, r() * 6]); }
    S.scene.add(coins);
    const dust = kit.particles({ count: 220, center: [0, 3, -4], box: [14, 10, 10], size: 20 });
    S.scene.add(dust);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    E.camPath(S, [{ t: 0, pos: [0, 1.9, 17.5], look: [0, 1.6, 0], fov: 32 }, { t: S.dur + 0.5, pos: [0.3, 2.0, 15.6], look: [0, 1.65, 0], fov: 32 }], { shake: 0.04, shiftY: 150 });
    S.focus = 16.5; S.aperture = 0.35;
    S.update((lt, t) => {
      const k = ease.expo(remap(lt, 0.0, 0.55));
      txt.position.z = lerp(-26, 0, k);
      txt.rotation.y = (1 - k) * 0.9 + Math.sin(lt * 2.2) * 0.06;
      txt.rotation.x = (1 - k) * -0.3;
      txt.material.emissiveIntensity = 0.18 + 0.6 * Math.exp(-Math.max(0, lt - 0.5) * 5);
      const kb = ease.out(remap(lt, 0.45, 1.6));
      for (let i = 0; i < n; i++) {
        const d = dirs[i];
        const p = new THREE.Vector3(d[0] * kb * 1.2, 1.7 + (d[1] - 1.2) * kb - 1.4 * kb * kb, d[2] * kb - 0.5);
        e.set(d[3] + lt * 4, d[4] + lt * 3, 0); q.setFromEuler(e);
        m4.compose(p, q, new THREE.Vector3(1, 1, 1).multiplyScalar(lt > 0.45 ? 1 : 0.0001));
        coins.setMatrixAt(i, m4);
      }
      coins.instanceMatrix.needsUpdate = true;
      dust.userData.tick(t);
      S.flash = 0.5 * Math.exp(-Math.max(0, lt - 0.5) * 9) * (lt > 0.48 ? 1 : 0);
    });
    E.cue(S.t0 + 0.5, 'boom', { g: 0.6 });
    ui.kicker(S, { t0: 0.05, text: 'Just passed the House', y: 372 });
    ui.headline(S, { t0: 0.12, html: 'Family trusts just got a <em>tax floor</em>', y: 428, size: 104, style: 'slam', font: 'sans', stagger: 0.05, t1: S.dur + 1 });
  });

  // ---------------- BILL (Australia map) ----------------
  E.defineScene('bill', (S) => {
    E.stage(S, { accent: C.lime, grid: 0.05, rim: 30, glow: 0.12, center: [0, 0.3, 0], shadowSize: 8 });
    const au = kit.mapSlab(E.geo.au, { depth: 0.35, bevel: 0.07, edgeWidth: 0.035, edgeGlow: 1.5 });
    au.scale.setScalar(0.62);
    S.scene.add(au);
    // scanning beam
    const beam = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 6.2), kit.M.glow(C.lime, 1.4, { transparent: true, opacity: 0.8 }));
    beam.rotation.x = -Math.PI / 2; beam.position.y = 0.5;
    au.add(beam);
    // pulse rings at capital cities (approximate positions in map units)
    const dust = kit.particles({ count: 260, center: [0, 3, -2], box: [16, 8, 14], size: 22 });
    S.scene.add(dust);
    E.camPath(S, [
      { t: 0, pos: [0, 16, 4.0], look: [0, 0, -0.2], fov: 38 },
      { t: S.dur, pos: [-1.6, 9.5, 10.0], look: [0, 0, -0.3], fov: 38 },
    ], { shiftY: 260, shake: 0.04, focusOn: true });
    S.aperture = 0.5;
    S.update((lt, t) => {
      au.rotation.y = -0.05 + lt * 0.03;
      const k = ease.expo(remap(lt, -0.25, 0.6));
      au.position.y = lerp(-0.5, 0, k);
      au.userData.edgeMat.emissiveIntensity = 1.4 + 0.8 * E.beatPulse(t);
      const bu = (lt * 0.35) % 1; beam.position.x = lerp(-4.2, 4.2, bu); beam.material.opacity = 0.8 * Math.sin(Math.PI * bu);
      dust.userData.tick(t);
    });
    ui.kicker(S, { t0: 0.1, text: 'The bill', y: 372 });
    ui.headline(S, { t0: 0.2, html: 'A <em>30% minimum tax</em> on discretionary trusts', y: 430, size: 96, style: 'rise' });
    ui.block(S, { t0: 0.9, html: '<span class="mono" style="font-size:29px;letter-spacing:.02em;color:#d3d9e3;line-height:1.4;display:block">Income Tax Rates Amendment (Minimum Tax on Discretionary Trusts) Bill 2026</span>', y: 740, w: 880 });
  });

  // ---------------- HOW (trustee → beneficiaries) ----------------
  E.defineScene('how', (S) => {
    E.stage(S, { accent: C.lime, accent2: 0xe9b949, grid: 0.05, rim: 70, glow: 0.22, center: [0, 1, 0], shadowSize: 7 });
    const vault = kit.box(1.9, 1.9, 1.9, 0.18, kit.M.ink());
    vault.position.set(0, 0.95, -1.6);
    const trim = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.06, 12, 48), kit.M.glow(C.lime, 1.4));
    trim.position.set(0, 1.0, -0.62);
    const dial = kit.box(0.9, 0.12, 0.12, 0.05, kit.M.gold());
    dial.position.set(0, 1.0, -0.6);
    S.scene.add(vault, trim, dial);
    const pawnG = kit.pawnGeometry(1.15);
    const cols = [0x7da7ff, 0xe9b949, 0xff8394, 0x34c27a];
    const P = [-2.4, -0.8, 0.8, 2.4].map((x, i) => {
      const m = kit.shadow(new THREE.Mesh(pawnG, kit.M.gloss(cols[i])));
      m.position.set(x, 0, 1.6 + Math.abs(x) * -0.25);
      S.scene.add(m);
      return m;
    });
    const coinG = kit.coinGeometry(0.2, 0.06);
    const amounts = [5, 1, 7, 2];
    const flights = [];
    amounts.forEach((a, i) => { for (let j = 0; j < a; j++) flights.push({ i, j }); });
    flights.forEach((f, k) => { f.t = 0.7 + k * 0.17; });
    const coins = new THREE.InstancedMesh(coinG, kit.M.gold(), flights.length);
    coins.castShadow = true;
    S.scene.add(coins);
    flights.forEach((f, k) => E.cue(S.t0 + f.t + 0.55, 'blip', { i: k }));
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    E.camPath(S, [
      { t: 0, pos: [3.6, 5.2, 12.5], look: [0, 0.9, 0], fov: 36 },
      { t: S.dur, pos: [-2.6, 4.6, 12.0], look: [0, 0.9, 0], fov: 36 },
    ], { shiftY: 300, shake: 0.04, focusOn: true });
    S.aperture = 0.45;
    S.update((lt) => {
      dial.rotation.z = lt * 1.4;
      flights.forEach((f, k) => {
        const u = ease.inOut(remap(lt, f.t, f.t + 0.55));
        const a = new THREE.Vector3(0, 1.1, -0.5), b = P[f.i].position.clone().add(new THREE.Vector3(0.55, 0.04 + f.j * 0.065, 0.45));
        const p = a.lerp(b, u); p.y += Math.sin(u * Math.PI) * 1.6;
        q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), (1 - u) * 6);
        sc.setScalar(lt < f.t ? 0.0001 : 1);
        m4.compose(p, q, sc); coins.setMatrixAt(k, m4);
      });
      coins.instanceMatrix.needsUpdate = true;
      P.forEach((p, i) => { const last = flights.filter((f) => f.i === i).pop(); const hop = Math.max(0, Math.sin((lt - last.t - 0.55) * 9)) * Math.exp(-Math.max(0, lt - last.t - 0.55) * 4) * 0.25; p.position.y = lt > last.t + 0.55 ? hop : 0; });
    });
    ui.kicker(S, { t0: 0.1, text: 'How they work', y: 372 });
    ui.headline(S, { t0: 0.2, html: 'The trustee picks <em>who gets the income</em>', y: 430, size: 96, style: 'rise' });
    ui.block(S, { t0: 1.0, html: 'Often family members on <b>lower tax rates</b>', cls: 'body', y: 740, w: 860 });
  });

  // ---------------- FLOOR (bars pushed up to 30%) ----------------
  E.defineScene('floor', (S) => {
    E.stage(S, { accent: C.lime, grid: 0.06, rim: 80, glow: 0.26, center: [0, 1.4, 0], shadowSize: 7 });
    const H30 = 1.35;
    const heights = [0.2, 0.7, 0.4, 1.65, 0.95, 1.9];
    const bars = heights.map((h, i) => {
      const m = kit.box(0.46, 1, 0.46, 0.07, kit.M.gloss(0x3a4252));
      m.position.set((i - 2.5) * 0.64, 0, 0);
      S.scene.add(m);
      return { m, h };
    });
    const plane = kit.box(4.6, 0.05, 1.5, 0.03, new THREE.MeshPhysicalMaterial({ color: C.lime, emissive: C.lime, emissiveIntensity: 0.35, transparent: true, opacity: 0.22, roughness: 0.2, depthWrite: false }));
    plane.castShadow = false;
    S.scene.add(plane);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(4.7, 0.03, 0.03), kit.M.glow(C.lime, 3));
    S.scene.add(edge);
    const limeM = kit.M.lime();
    E.camPath(S, [
      { t: 0, pos: [-4.0, 3.6, 13.5], look: [0, 1.4, 0], fov: 34 },
      { t: S.dur, pos: [3.6, 4.2, 14.0], look: [0, 1.4, 0], fov: 34 },
    ], { shiftY: 330, shake: 0.04, focusOn: true });
    S.aperture = 0.45;
    S.update((lt) => {
      const kg = ease.expo(remap(lt, 0.1, 0.9));
      const kp = ease.inOut(remap(lt, 1.0, 2.4));
      const y = lerp(-0.2, H30, kp);
      plane.position.y = y; edge.position.set(0, y + 0.02, 0.76);
      bars.forEach((b, i) => {
        let h = Math.max(0.02, b.h * ease.expo(remap(lt, 0.1 + i * 0.07, 0.9 + i * 0.07)));
        const lifted = h < y && kp > 0;
        if (lifted) h = Math.max(h, y);
        b.m.scale.y = h; b.m.position.y = h / 2;
        b.m.material = lifted && kp > 0.98 ? limeM : b.m.material;
      });
      void kg;
    });
    ui.kicker(S, { t0: 0.1, text: 'What changes', y: 372 });
    ui.counter(S, { t0: 0.35, dur: 1.6, to: 30, suffix: '%', y: 410, size: 250, label: 'minimum tax on trust income' });
    ui.headline(S, { t0: 0.9, html: 'From <em>1 July 2028</em>', y: 718, size: 84, style: 'rise' });
    ui.block(S, { t0: 1.5, html: 'Same rate as workers earning <b>$45k–$135k</b>', cls: 'body', y: 820, w: 900 });
  });

  // ---------------- OUT (exclusions) ----------------
  E.defineScene('out', (S) => {
    E.stage(S, { accent: 0xff5a6e, accent2: C.lime, grid: 0.04, rim: 60, glow: 0.2, center: [1.5, 1.5, -2], shadowSize: 8 });
    const cols = [0x7da7ff, 0x34c27a, 0xa98bff, 0xe9b949, 0x8f98a8, 0xd9a066];
    const blocks = cols.map((c, i) => {
      const b = kit.box(0.9, 0.9, 0.9, 0.14, kit.M.gloss(c));
      S.scene.add(b);
      return b;
    });
    const dust = kit.particles({ count: 200, center: [0, 3, -3], box: [14, 9, 10], color: 0xff8394, color2: C.lime, size: 20 });
    S.scene.add(dust);
    E.camPath(S, [{ t: 0, pos: [0, 3.0, 8.5], look: [0.8, 3.3, 0], fov: 36 }, { t: S.dur, pos: [0.6, 2.8, 7.6], look: [0.8, 3.2, 0], fov: 36 }], { shake: 0.03 });
    S.focus = 3.5; S.aperture = 1.1; // blocks drift soft behind the list
    S.update((lt, t) => {
      blocks.forEach((b, i) => {
        const t0 = 0.45 + i * 0.32;
        const k = ease.out(remap(lt, t0, t0 + 1.6));
        const x = 0.4 + (i % 3) * 1.25, z = -2.6 - Math.floor(i / 3) * 1.4;
        b.position.set(x + k * 0.5, 0.45 + k * (1.1 + (i % 2) * 0.5), z);
        b.rotation.set(k * 0.9, k * (i % 2 ? 1 : -1), k * 0.4);
        b.scale.setScalar(1 - k * 0.25);
      });
      dust.userData.tick(t);
    });
    ui.kicker(S, { t0: 0.1, text: 'Not covered', y: 372, color: '#ff8394' });
    ui.headline(S, { t0: 0.2, html: "Who's <em>left out</em>", y: 430, size: 104, style: 'rise' });
    ui.list(S, { t0: 0.45, stagger: 0.32, y: 600, size: 50, items: ['Fixed trusts', 'Charitable trusts', 'Special disability trusts', 'Super funds', 'Deceased estates', 'Primary production income'] });
  });

  // ---------------- VOTE (90–45 hemicycle) ----------------
  E.defineScene('vote', (S) => {
    E.stage(S, { accent: C.lime, accent2: 0xff5a6e, grid: 0.05, rim: 80, glow: 0.24, center: [0, 0.4, -2.5], shadowSize: 8 });
    const colors = [];
    for (let i = 0; i < 90; i++) colors.push(C.lime);
    for (let i = 0; i < 45; i++) colors.push(0xff5a6e);
    const hemi = kit.hemicycle(colors, { rows: 7, r0: 1.9, r1: 4.4, seat: 0.3 });
    hemi.mesh.position.z = -1.0;
    hemi.mesh.scale.setScalar(0.4);
    S.scene.add(hemi.mesh);
    const n = hemi.count;
    for (let i = 0; i < n; i += 6) E.cue(S.t0 + 0.5 + (i / n) * 1.6, 'blip', { i: i / 6 });
    E.camPath(S, [{ t: 0, pos: [0, 6.2, 6.4], look: [0, 0, -1.6], fov: 40 }, { t: S.dur, pos: [0, 4.6, 7.4], look: [0, 0, -1.6], fov: 40 }], { shiftY: 230, shake: 0.03, focusOn: true });
    S.aperture = 0.4;
    S.update((lt) => {
      for (let i = 0; i < n; i++) {
        const k = ease.back(remap(lt, 0.5 + (i / n) * 1.6, 0.85 + (i / n) * 1.6));
        hemi.set(i, Math.max(0.0001, k), (1 - k) * 0.6);
      }
      hemi.commit();
    });
    ui.kicker(S, { t0: 0.05, text: 'The House vote', y: 372 });
    ui.counter(S, { t0: 0.4, dur: 1.4, to: 90, y: 420, x: 80, w: 440, size: 230, label: 'AYE<br><span style="font-weight:600;color:#b7bfcd">Labor + some independents</span>' });
    ui.counter(S, { t0: 0.6, dur: 1.2, to: 45, y: 420, x: 560, w: 440, size: 230, align: 'right', color: '#ff5a6e', label: 'NO<br><span style="font-weight:600;color:#b7bfcd">Coalition, One Nation, Katter’s</span>', ticks: false });
  });

  // ---------------- SENATE ----------------
  E.defineScene('senate', (S) => {
    E.stage(S, { accent: 0xff3d55, accent2: C.lime, grid: 0.04, rim: 70, glow: 0.28, center: [0, 0.4, -2], shadowSize: 8 });
    const hemi = kit.hemicycle(Array(76).fill(0x5e1220), { rows: 5, r0: 2.0, r1: 4.2, seat: 0.36 });
    hemi.mesh.position.z = -1.0;
    hemi.mesh.scale.setScalar(0.46);
    S.scene.add(hemi.mesh);
    const scan = kit.arcGauge({ r: 1.5, tube: 0.035, mat: kit.M.glow(C.lime, 1.6) });
    scan.rotation.x = -Math.PI / 2; scan.position.set(0, 0.32, -1.0);
    S.scene.add(scan);
    const col = new THREE.Color();
    E.camPath(S, [{ t: 0, pos: [-1.8, 5.6, 6.6], look: [0, 0, -1.4], fov: 40 }, { t: S.dur, pos: [1.6, 5.0, 7.0], look: [0, 0, -1.4], fov: 40 }], { shiftY: 360, shake: 0.03, focusOn: true });
    S.aperture = 0.4;
    S.update((lt) => {
      const sweep = remap(lt, 0.4, 2.2);
      scan.userData.setFrac(ease.inOut(sweep) * 0.5);
      scan.rotation.z = Math.PI / 2;
      for (let i = 0; i < hemi.count; i++) {
        const a = hemi.spots[i].a; // π (left) .. 0 (right)
        const lit = 1 - a / Math.PI <= ease.inOut(sweep);
        hemi.set(i, 1, lit ? 0.06 : 0, lit ? 0xd01c3c : 0x3a1520);
      }
      hemi.commit();
      void col;
    });
    ui.kicker(S, { t0: 0.05, text: "What's next", y: 372 });
    ui.headline(S, { t0: 0.15, html: 'Over to <em>the Senate</em>', y: 430, size: 104, style: 'rise' });
    ui.block(S, { t0: 0.8, html: 'A <b>Senate Economics committee</b> is reviewing the bill', cls: 'body', y: 660, w: 880 });
  });

  // ---------------- RELIEF (timeline receding into depth) ----------------
  E.defineScene('relief', (S) => {
    E.stage(S, { accent: C.lime, grid: 0.06, rim: 60, glow: 0.18, center: [0, 0.5, -2], shadowSize: 9 });
    const Z = (yr) => 2.2 - (yr - 2027.5) * 2.3; // 2027.5 → 2.2 (near), 2030.5 → -4.7 (far)
    const track = kit.box(0.7, 0.12, 9.5, 0.05, kit.M.gloss(0x2c3342));
    track.position.set(0, 0.06, Z(2029));
    const fill = kit.box(0.74, 0.16, 1, 0.07, kit.M.lime());
    S.scene.add(track, fill);
    const pins = [[2027.5, 'Relief starts', '1 Jul 2027'], [2028.5, '30% floor starts', '1 Jul 2028'], [2030.5, 'Relief ends', '3 years on']];
    const pinMeshes = pins.map(([yr], i) => {
      const p = kit.box(0.24, 1.3, 0.24, 0.09, i === 1 ? kit.M.gloss(0xf3f5f9) : kit.M.lime());
      p.position.set(0, 0.65, Z(yr));
      S.scene.add(p);
      return p;
    });
    pins.forEach(([yr, a, b], i) => ui.tag3d(S, { at: new THREE.Vector3(0.0, 1.45, Z(yr)), html: `${a}<small>${b}</small>`, t0: 0.6 + i * 0.5, cls: 'chip', anchor: i === 2 ? 'right' : 'left', dx: i === 2 ? -26 : 26 }));
    const dust = kit.particles({ count: 200, center: [0, 3, -3], box: [12, 8, 16], size: 20 });
    S.scene.add(dust);
    E.camPath(S, [{ t: 0, pos: [2.6, 3.0, 8.8], look: [-0.5, 0.4, -1.4], fov: 40 }, { t: S.dur, pos: [2.0, 3.6, 7.8], look: [-0.5, 0.4, -1.8], fov: 40 }], { shiftY: 250, shake: 0.03 });
    S.focus = 8.5; S.aperture = 0.5;
    S.update((lt, t) => {
      const k = ease.inOut(remap(lt, 0.5, 2.6));
      const len = Math.max(0.01, (Z(2027.5) - Z(2030.5)) * k);
      fill.scale.z = len; fill.position.set(0, 0.08, Z(2027.5) - len / 2);
      pinMeshes.forEach((p, i) => { const kk = ease.back(remap(lt, 0.4 + i * 0.5, 0.8 + i * 0.5)); p.scale.y = Math.max(0.01, kk); p.position.y = 0.65 * kk; });
      dust.userData.tick(t);
    });
    ui.kicker(S, { t0: 0.05, text: 'Time to restructure', y: 372 });
    ui.counter(S, { t0: 0.25, dur: 1.0, to: 3, y: 410, size: 250, suffix: '<span style="font-size:.42em;letter-spacing:-.02em"> years</span>', label: 'of roll-over relief from 1 July 2027' });
  });

  // ---------------- END ----------------
  E.defineScene('end', (S) => endCard(S, { sources: 'Sources: Parliament of Australia (bill, House division)<br>Facts as of 10 Nov 2026' }));
}
