// Reel 4 — Victorian state election (Sat 28 Nov 2026) countdown + how it works.
// Facts checked against PolTok's own data (src/data/au-states.ts, src/data/au.ts, src/features/au):
//   Legislative Assembly 88 seats, majority 45; Legislative Council 40 seats = 8 regions x 5 members;
//   polls close 6pm AEDT 28 Nov 2026; early voting 18–27 Nov; PolTok has /au/victoria (election night) and district pages/maps.
// Preferential counting is explained generically with an illustrative (made-up, labelled) example count.

const ELECTION = Date.parse('2026-11-28T00:00:00+11:00'); // Melbourne midnight, election day

export async function data() {
  // days until election day in Melbourne time, as of the render date
  const now = new Date();
  const mel = new Date(now.toLocaleString('en-US', { timeZone: 'Australia/Melbourne' }));
  const today = Date.UTC(mel.getFullYear(), mel.getMonth(), mel.getDate());
  const days = Math.round((Date.UTC(2026, 10, 28) - today) / 86400000);
  if (!(days > 0)) throw new Error('election day has passed or is today; countdown reel not applicable (days=' + days + ')');
  return { days, asOf: mel.toDateString(), election: ELECTION };
}

export const meta = {
  title: 'Victoria votes: how it works',
  label: 'VIC ELECTION',
  out: 'poltok-vic-election-countdown',
  cover: 1.2,
  music: { prog: ['Cm', 'Ab', 'Eb', 'Bb'], arp: 'updown', seed: 44, swing: 0.06 },
  voice: { lengthScale: 0.8 },
  geo: { vic: { src: 'vic-districts', mode: 'both', width: 6, minArea: 1e-7, tol: 0.004, raster: 420 } },
};

export const scenes = (d) => [
  { id: 'hook', beats: 3, energy: 3 },
  { id: 'date', beats: 8, energy: 1, trans: { type: 'zoom', dur: 0.5 },
    say: `Victoria votes in ${d.days} days. Saturday, the twenty-eighth of November.`,
    cap: `Victoria votes in ${d.days} days: Saturday 28 November.` },
  { id: 'seats', beats: 8, energy: 2, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: 'Voters fill all eighty-eight seats in the Legislative Assembly.',
    cap: 'Voters fill all 88 seats in the Legislative Assembly.' },
  { id: 'majority', beats: 8, energy: 3, trans: { type: 'flash', dur: 0.36 },
    say: 'Forty-five seats is a majority. That is how you form government in your own right.',
    cap: '45 seats is a majority: enough to govern in your own right.' },
  { id: 'ballot', beats: 8, energy: 2, trans: { type: 'whip', dir: 'up', dur: 0.42 },
    say: 'On the ballot, you number the candidates in order of preference.',
    cap: 'On the ballot, you number the candidates in order of preference.' },
  { id: 'count', beats: 10, energy: 3, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: 'If no one has over half, the last-placed candidate drops out, and their votes flow on. Until someone does.',
    cap: 'No one over half? The last-placed candidate drops out and their votes flow on, until someone does.' },
  { id: 'upper', beats: 8, energy: 2, trans: { type: 'whip', dir: 'up', dur: 0.42 },
    say: 'The upper house has forty members: five from each of eight regions.',
    cap: 'The upper house has 40 members: 5 from each of 8 regions.' },
  { id: 'poltok', beats: 8, energy: 2, trans: { type: 'zoom', dur: 0.5 },
    say: 'Find your electorate on the PolTok map, and follow election night live.',
    cap: 'Find your electorate on the PolTok map, and follow election night live.' },
  { id: 'end', beats: 6, energy: 0, trans: { type: 'zoom', dur: 0.5 }, noProgress: true },
];

export function build({ E, kit, ui, THREE, endCard }) {
  const { C, ease, remap, lerp } = E;
  const d = E.data;
  const vicMap = (scale = 1, col = 0x1d2330) => {
    const grp = kit.mapTiles(E.geo.vic, { depth: 0.16, bevel: 0.01, inset: 0.003, mat: () => kit.M.gloss(col, { roughness: 0.45 }) });
    const edge = kit.mapSlab({ outline: E.geo.vic.outline.slice(0, 1), size: E.geo.vic.size }, { depth: 0.17, bevel: 0, edgeWidth: 0.018, edgeGlow: 1.5, mat: new THREE.MeshBasicMaterial({ visible: false }) });
    grp.add(edge);
    grp.userData.edgeMat = edge.userData.edgeMat;
    grp.scale.setScalar(scale);
    return grp;
  };
  // tiles sorted west → east for sweeps
  const sweep = (tiles) => { const xs = tiles.map((t) => t.c.x); const a = Math.min(...xs), b = Math.max(...xs); tiles.forEach((t) => { t.u = (t.c.x - a) / (b - a); }); };

  // ---------------- HOOK: countdown ----------------
  E.defineScene('hook', (S) => {
    E.stage(S, { accent: C.lime, accent2: 0x7da7ff, grid: 0.07, rim: 90, glow: 0.3, center: [0, 1.4, 0] });
    const num = kit.text3d(String(d.days), { size: 1.45, depth: 0.6, mat: kit.M.lime() });
    num.position.set(0, 1.6, 0);
    S.scene.add(num);
    const ring = kit.arcGauge({ r: 1.8, tube: 0.05, mat: kit.M.glow(C.lime, 1.4) });
    ring.position.set(0, 1.6, -0.8);
    S.scene.add(ring);
    const dust = kit.particles({ count: 220, center: [0, 3, -4], box: [14, 10, 10], size: 20 });
    S.scene.add(dust);
    E.camPath(S, [{ t: 0, pos: [0, 1.8, 13.5], look: [0, 1.6, 0], fov: 32 }, { t: S.dur + 0.5, pos: [0.3, 1.9, 11.8], look: [0, 1.6, 0], fov: 32 }], { shake: 0.04, shiftY: 120 });
    S.focus = 12.5; S.aperture = 0.35;
    S.update((lt, t) => {
      const k = ease.expo(remap(lt, 0.0, 0.55));
      num.position.z = lerp(-24, 0, k);
      num.rotation.y = (1 - k) * -0.8 + Math.sin(lt * 2) * 0.05;
      ring.userData.setFrac(ease.inOut(remap(lt, 0.3, 1.4)));
      ring.rotation.z = -lt * 0.5;
      dust.userData.tick(t);
    });
    E.cue(S.t0 + 0.5, 'boom', { g: 0.6 });
    ui.kicker(S, { t0: 0.05, text: 'Victoria votes', y: 372 });
    ui.headline(S, { t0: 0.1, html: `<em>${d.days} days</em> to go`, y: 428, size: 112, style: 'slam', font: 'sans', stagger: 0.1, t1: S.dur + 1 });
  });

  // ---------------- DATE ----------------
  E.defineScene('date', (S) => {
    E.stage(S, { accent: C.lime, grid: 0.05, rim: 40, glow: 0.12, center: [0, 0, 0], shadowSize: 6 });
    const map = vicMap(0.46);
    S.scene.add(map);
    const tiles = map.userData.tiles; sweep(tiles);
    const dust = kit.particles({ count: 200, center: [0, 2, -2], box: [10, 6, 10], size: 20 });
    S.scene.add(dust);
    E.camPath(S, [{ t: 0, pos: [-1.0, 7.4, 6.2], look: [0, 0, 0], fov: 40 }, { t: S.dur, pos: [1.0, 6.6, 5.6], look: [0, 0, 0], fov: 40 }], { shiftY: 280, shake: 0.03, focusOn: true });
    S.aperture = 0.4;
    S.update((lt, t) => {
      tiles.forEach((tt) => { const k = ease.back(remap(lt, 0.1 + tt.u * 1.2, 0.5 + tt.u * 1.2)); tt.mesh.scale.y = Math.max(0.01, k); });
      map.rotation.y = 0.08 - lt * 0.03;
      dust.userData.tick(t);
    });
    ui.kicker(S, { t0: 0.1, text: 'Victorian state election', y: 372 });
    ui.headline(S, { t0: 0.2, html: 'Saturday <em>28 November</em>', y: 430, size: 104, style: 'rise' });
    ui.block(S, { t0: 0.9, html: 'Early voting <b>18–27 Nov</b> · polls close <b>6pm AEDT</b>', cls: 'body', y: 660, w: 900 });
  });

  // ---------------- SEATS: 88 districts pop ----------------
  E.defineScene('seats', (S) => {
    E.stage(S, { accent: C.lime, grid: 0.05, rim: 40, glow: 0.12, center: [0, 0, 0], shadowSize: 6 });
    const map = vicMap(0.46);
    S.scene.add(map);
    map.position.x = -0.18;
    const tiles = map.userData.tiles; sweep(tiles);
    const r = E.rng(8);
    tiles.forEach((t) => { t.o = r(); });
    tiles.forEach((t, i) => { if (i % 4 === 0) E.cue(S.t0 + 0.3 + t.o * 1.4, 'blip', { i: i / 4 }); });
    const limeM = kit.M.gloss(0x8fb03a, { emissive: 0x4a6a10, emissiveIntensity: 0.25 });
    E.camPath(S, [{ t: 0, pos: [0.9, 6.2, 6.0], look: [0, 0, 0], fov: 40 }, { t: S.dur, pos: [-0.7, 6.8, 5.2], look: [0, 0, 0], fov: 40 }], { shiftY: 280, shake: 0.03, focusOn: true });
    S.aperture = 0.4;
    S.update((lt) => {
      tiles.forEach((tt) => {
        const k = ease.back(remap(lt, 0.3 + tt.o * 1.4, 0.6 + tt.o * 1.4));
        tt.mesh.position.y = k * 0.12;
        tt.mesh.scale.y = 1 + k * 1.5;
        if (k > 0.5 && tt.mesh.material !== limeM) tt.mesh.material = limeM;
      });
    });
    ui.kicker(S, { t0: 0.05, text: 'Lower house', y: 372 });
    ui.counter(S, { t0: 0.3, dur: 1.4, to: 88, y: 410, size: 250, label: 'seats in the Legislative Assembly' });
    ui.block(S, { t0: 1.5, html: 'One MP per district. <b>Every seat</b> is up.', cls: 'body', y: 720 });
  });

  // ---------------- MAJORITY: 45 of 88 ----------------
  E.defineScene('majority', (S) => {
    E.stage(S, { accent: C.lime, accent2: 0x7da7ff, grid: 0.05, rim: 50, glow: 0.14, center: [0, 0.3, -1.2], shadowSize: 6 });
    const hemi = kit.hemicycle(Array(88).fill(0x3a4252), { rows: 5, r0: 1.9, r1: 4.4, seat: 0.34 });
    hemi.mesh.position.z = -0.6; hemi.mesh.scale.setScalar(0.36);
    S.scene.add(hemi.mesh);
    for (let i = 0; i < 45; i += 3) E.cue(S.t0 + 0.6 + (i / 45) * 1.4, 'blip', { i: i / 3 });
    const a = hemi.spots[44].a;
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 1.12), kit.M.glow(0xffffff, 1.6));
    line.position.set(Math.cos(a - 0.02) * 1.13, 0.2, -0.6 - Math.sin(a - 0.02) * 1.13);
    line.rotation.y = a + Math.PI / 2;
    S.scene.add(line);
    E.camPath(S, [{ t: 0, pos: [-1.2, 5.2, 7.0], look: [0, 0, -1.0], fov: 40 }, { t: S.dur, pos: [1.0, 4.8, 7.2], look: [0, 0, -1.0], fov: 40 }], { shiftY: 220, shake: 0.03, focusOn: true });
    S.aperture = 0.4;
    S.update((lt) => {
      for (let i = 0; i < 88; i++) {
        const on = i < 45 && lt > 0.6 + (i / 45) * 1.4;
        const k = on ? ease.back(remap(lt, 0.6 + (i / 45) * 1.4, 0.9 + (i / 45) * 1.4)) : 0;
        hemi.set(i, 1, 0.12 * k, on ? C.lime : 0x3a4252);
      }
      hemi.commit();
      line.scale.z = Math.max(0.01, ease.expo(remap(lt, 2.0, 2.5)));
    });
    ui.kicker(S, { t0: 0.05, text: 'To win', y: 372 });
    ui.counter(S, { t0: 0.6, dur: 1.4, to: 45, y: 410, size: 250, label: 'seats for a majority (of 88)' });
  });

  // ---------------- BALLOT ----------------
  E.defineScene('ballot', (S) => {
    E.stage(S, { accent: C.lime, grid: 0.05, rim: 40, glow: 0.14, center: [0, 1.2, 0], shadowSize: 5 });
    const rows = ['Candidate A', 'Candidate B', 'Candidate C', 'Candidate D'];
    const tex = kit.canvasTex(600, 840, (g, w, h) => {
      g.fillStyle = '#f4f1e8'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#1b2029'; g.font = '700 30px "JetBrains Mono"'; g.fillText('SAMPLE BALLOT', 40, 70);
      g.font = '600 24px "Inter Tight"'; g.fillStyle = '#5d6576'; g.fillText('Number every box in order of preference', 40, 110);
      g.fillStyle = '#d7d2c4'; g.fillRect(40, 132, w - 80, 3);
      rows.forEach((r, i) => {
        const y = 190 + i * 160;
        g.strokeStyle = '#1b2029'; g.lineWidth = 5; g.strokeRect(40, y, 110, 110);
        g.fillStyle = '#1b2029'; g.font = '800 40px "Inter Tight"'; g.fillText(r, 180, y + 52);
        g.fillStyle = '#8f98a8'; g.font = '600 26px "Inter Tight"'; g.fillText('Example', 180, y + 90);
      });
    });
    const card = kit.box(2.4, 3.36, 0.04, 0.03, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75 }));
    // put the texture on the front face only: use a plane on top of a thin box
    card.material = new THREE.MeshStandardMaterial({ color: 0xe9e5da, roughness: 0.8 });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.36), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75 }));
    face.position.z = 0.021;
    const paper = new THREE.Group(); paper.add(card, face);
    paper.position.set(0, 1.8, 0);
    S.scene.add(paper);
    const order = [2, 0, 3, 1]; // preference numbers written in each row
    const boxPos = (i) => new THREE.Vector3(-1.2 + (95 / 600) * 2.4, 1.68 - ((245 + i * 160) / 840) * 3.36, 0.03);
    rows.forEach((_, i) => {
      const t0 = 0.8 + order[i] * 0.45;
      ui.tag3d(S, { at: () => boxPos(i).applyMatrix4(paper.matrixWorld), html: `<span style="font-family:Newsreader;font-style:italic;font-weight:600;font-size:76px;color:#2f6b00">${order[i] + 1}</span>`, t0, cls: '' });
      E.cue(S.t0 + t0, 'pop', { i: order[i] });
    });
    E.camPath(S, [{ t: 0, pos: [-1.4, 2.4, 10.8], look: [0, 1.8, 0], fov: 38 }, { t: S.dur, pos: [0.6, 2.2, 10.0], look: [0, 1.8, 0], fov: 38 }], { shiftY: 210, shake: 0.03 });
    S.focus = 10.4; S.aperture = 0.5;
    S.update((lt) => {
      const k = ease.expo(remap(lt, 0, 0.7));
      paper.rotation.set(-0.25 + (1 - k) * -0.6, 0.18 + Math.sin(lt * 0.6) * 0.06, (1 - k) * 0.3);
      paper.position.y = 1.8 + (1 - k) * -1.5;
      paper.updateMatrixWorld();
    });
    ui.kicker(S, { t0: 0.05, text: 'Preferential voting', y: 372 });
    ui.headline(S, { t0: 0.15, html: 'Number the boxes, <em>1, 2, 3…</em>', y: 430, size: 96, style: 'rise' });
  });

  // ---------------- COUNT (illustrative) ----------------
  E.defineScene('count', (S) => {
    E.stage(S, { accent: C.lime, accent2: 0x7da7ff, grid: 0.05, rim: 50, glow: 0.14, center: [0, 1, 0], shadowSize: 6 });
    const cand = [
      { n: 'A', c: C.lime, v: [38, 42, 51] },
      { n: 'B', c: 0x7da7ff, v: [34, 39, 49] },
      { n: 'C', c: 0xe9b949, v: [16, 19, 0] },
      { n: 'D', c: 0xff8394, v: [12, 0, 0] },
    ];
    const sc = 0.032;
    const bars = cand.map((c, i) => { const m = kit.box(0.6, 1, 0.6, 0.07, kit.M.gloss(c.c)); m.position.set((i - 1.5) * 0.85, 0, 0); S.scene.add(m); return m; });
    const half = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.025, 0.025), kit.M.glow(C.lime, 1.2));
    half.position.set(0, 50 * sc, 0);
    S.scene.add(half);
    cand.forEach((c, i) => ui.tag3d(S, { at: () => new THREE.Vector3((i - 1.5) * 0.85, bars[i].scale.y + 0.22, 0), html: c.n, cls: 'chip', t0: 0.4, t1: i === 3 ? 2.6 : i === 2 ? 4.2 : undefined }));
    ui.tag3d(S, { at: new THREE.Vector3(-1.62, 50 * sc + 0.18, 0), html: '50%', cls: 'chip', t0: 0.6, anchor: 'left', dx: 0 });
    const R1 = 0.4, R2 = 2.2, R3 = 3.8; // round start times (scene-local)
    E.cue(S.t0 + R2, 'pop', { i: 0 }); E.cue(S.t0 + R3, 'pop', { i: 2 }); E.cue(S.t0 + R3 + 0.8, 'ding', {});
    E.camPath(S, [{ t: 0, pos: [-1.6, 3.0, 10.2], look: [0, 1.1, 0], fov: 38 }, { t: S.dur, pos: [1.4, 3.2, 9.6], look: [0, 1.1, 0], fov: 38 }], { shiftY: 130, shake: 0.03, focusOn: true });
    S.aperture = 0.45;
    const val = (c, lt) => {
      if (lt < R2) return c.v[0] * ease.expo(remap(lt, R1, R1 + 1));
      if (lt < R3) return lerp(c.v[0], c.v[1], ease.inOut(remap(lt, R2, R2 + 0.9)));
      return lerp(c.v[1], c.v[2], ease.inOut(remap(lt, R3, R3 + 0.9)));
    };
    S.update((lt) => {
      bars.forEach((m, i) => { const h = Math.max(0.02, val(cand[i], lt) * sc); m.scale.y = h; m.position.y = h / 2; });
      half.material.emissiveIntensity = 1.1 + (lt > R3 + 0.8 ? 1.2 * Math.abs(Math.sin(lt * 6)) : 0);
    });
    ui.kicker(S, { t0: 0.05, text: 'The count · example', y: 372 });
    ui.headline(S, { t0: 0.15, html: 'Lowest is out. <em>Votes flow on.</em>', y: 430, size: 92, style: 'rise' });
    ui.block(S, { t0: R3 + 0.9, html: '<b>A</b> passes 50% and wins the seat', cls: 'body', y: 640 });
  });

  // ---------------- UPPER HOUSE ----------------
  E.defineScene('upper', (S) => {
    E.stage(S, { accent: 0x7da7ff, accent2: C.lime, grid: 0.05, rim: 50, glow: 0.14, center: [0, 0.5, -1], shadowSize: 6 });
    const geo = new THREE.CylinderGeometry(0.15, 0.15, 0.12, 24);
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshPhysicalMaterial({ roughness: 0.3, clearcoat: 1 }), 40);
    mesh.castShadow = true;
    S.scene.add(mesh);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sv = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
    for (let r = 0; r < 8; r++) E.cue(S.t0 + 0.4 + r * 0.22, 'blip', { i: r });
    E.camPath(S, [{ t: 0, pos: [0, 6.2, 7.6], look: [0, 0, -1.0], fov: 40 }, { t: S.dur, pos: [0.6, 5.6, 8.0], look: [0, 0, -1.0], fov: 40 }], { shiftY: 260, shake: 0.03, focusOn: true });
    S.aperture = 0.4;
    S.update((lt) => {
      for (let r = 0; r < 8; r++) for (let j = 0; j < 5; j++) {
        const i = r * 5 + j;
        const k = ease.back(remap(lt, 0.4 + r * 0.22 + j * 0.03, 0.75 + r * 0.22 + j * 0.03));
        p.set((r - 3.5) * 0.42, 0.06 + (1 - k) * 0.8, -1.8 + j * 0.42);
        sv.setScalar(Math.max(0.0001, k));
        m4.compose(p, q, sv); mesh.setMatrixAt(i, m4);
        mesh.setColorAt(i, col.setHex(r % 2 ? 0x7da7ff : 0xa9c4ff));
      }
      mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
    });
    ui.kicker(S, { t0: 0.05, text: 'Upper house', y: 372, color: '#7da7ff' });
    ui.counter(S, { t0: 0.3, dur: 1.2, to: 40, y: 410, size: 250, color: '#7da7ff', label: 'Legislative Council members' });
    ui.block(S, { t0: 1.4, html: '<b>8 regions</b> × <b>5 members</b> each', cls: 'body', y: 720 });
  });

  // ---------------- POLTOK ----------------
  E.defineScene('poltok', (S) => {
    E.stage(S, { accent: C.lime, grid: 0.06, rim: 50, glow: 0.16, center: [0, 0, 0], shadowSize: 6 });
    const map = vicMap(0.46);
    S.scene.add(map);
    const tiles = map.userData.tiles;
    const r = E.rng(17);
    const limeM = kit.M.lime(), hiM = kit.M.gloss(0x2f3a4c);
    tiles.forEach((t) => { t.o = r(); });
    // a "your electorate" highlight: pick a metro-ish tile near the bay, by smallest area-ish = closest to Melbourne centre
    const mel = tiles.slice().sort((a, b) => a.c.distanceTo(new THREE.Vector3(-0.2, 0, 0.6)) - b.c.distanceTo(new THREE.Vector3(-0.2, 0, 0.6)))[0];
    E.camPath(S, [{ t: 0, pos: [0.4, 7.4, 6.0], look: [0, 0, 0], fov: 40 }, { t: S.dur, pos: [-0.4, 5.6, 5.4], look: [0, 0, 0.2], fov: 40 }], { shiftY: 280, shake: 0.03, focusOn: true });
    S.aperture = 0.4;
    S.update((lt, t) => {
      tiles.forEach((tt) => {
        const pulse = Math.max(0, Math.sin((lt - tt.o * 2) * 3));
        tt.mesh.material = tt === mel && lt > 1.2 ? limeM : hiM;
        tt.mesh.scale.y = tt === mel ? 1 + 2.5 * ease.back(remap(lt, 1.2, 1.6)) : 1 + pulse * 0.5 * (lt > 0.3 ? 1 : 0);
      });
      map.userData.edgeMat.emissiveIntensity = 1.2 + E.beatPulse(t);
    });
    ui.kicker(S, { t0: 0.05, text: 'On PolTok', y: 372 });
    ui.headline(S, { t0: 0.15, html: 'Every electorate, <em>mapped</em>', y: 430, size: 100, style: 'rise' });
    ui.block(S, { t0: 1.0, html: 'District pages, the pendulum, and a <b>live election-night page</b> from 6pm on 28 Nov', cls: 'body', y: 660, w: 900 });
  });

  E.defineScene('end', (S) => endCard(S, { title: 'Watch it <em>live</em>', sub: 'poltok.netlify.app/au/victoria', sources: 'Sources: PolTok AU data (VEC, Parliament of Victoria).<br>The vote count shown earlier is an illustrative example.' }));
}
