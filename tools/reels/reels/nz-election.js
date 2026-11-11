// Reel 2 — NZ election 2026, PRELIMINARY / UNOFFICIAL result.
// Figures: Wikipedia preliminary results as supplied by the editor (not the Electoral Commission's final count).

export const PARTIES = [
  // left → right seating order for the hemicycle
  { id: 'TPM', name: 'Te Pāti Māori', vote: 0.56, seats: 5, color: 0xb5544a },
  { id: 'GRN', name: 'Green', vote: 13.3, seats: 16, color: 0x2e9e44 },
  { id: 'LAB', name: 'Labour', vote: 29.31, seats: 36, color: 0xd82a20 },
  { id: 'TOP', name: 'Opportunity', vote: 5.97, seats: 7, color: 0x22b8a8 },
  { id: 'NZF', name: 'NZ First', vote: 9.77, seats: 12, color: 0x8f98a8 },
  { id: 'ACT', name: 'ACT', vote: 10.93, seats: 13, color: 0xe8b400 },
  { id: 'NAT', name: 'National', vote: 29.26, seats: 42, color: 0x1f5fbf },
];
const hex = (c) => '#' + c.toString(16).padStart(6, '0');

export const meta = {
  title: 'NZ election 2026: preliminary result',
  label: 'PRELIMINARY · UNOFFICIAL',
  labelCls: 'warn',
  out: 'poltok-nz-election-2026',
  cover: 12.5,
  music: { prog: ['Dm', 'Bb', 'F', 'C'], arp: 'pulse', seed: 21, swing: 0.05 },
  voice: { lengthScale: 0.8 },
  geo: { nz: { src: 'nz-electorates', filter: { type: 'general' }, mode: 'both', width: 6, minArea: 0.00002 } },
};

export const scenes = [
  { id: 'hook', beats: 3, energy: 3 },
  { id: 'intro', beats: 8, energy: 1, trans: { type: 'zoom', dur: 0.5 },
    say: "New Zealand's preliminary count is in. These numbers are unofficial.",
    cap: "New Zealand's preliminary count is in. These numbers are unofficial." },
  { id: 'vote', beats: 8, energy: 2, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: 'Labour won the party vote, by just five hundredths of a point.',
    cap: 'Labour won the party vote, by just 0.05 points.' },
  { id: 'seats', beats: 8, energy: 3, trans: { type: 'flash', dur: 0.36 },
    say: "But National won more seats. Forty-two, to Labour's thirty-six.",
    cap: "But National won more seats: 42 to Labour's 36." },
  { id: 'overhang', beats: 8, energy: 2, trans: { type: 'whip', dir: 'up', dur: 0.42 },
    say: 'Why? Eleven overhang seats. Parties keep electorates they win beyond their party vote share.',
    cap: 'Why? 11 overhang seats. Parties keep electorates they win beyond their party vote share.' },
  { id: 'majority', beats: 8, energy: 3, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: 'National, ACT and New Zealand First hold sixty-seven of a hundred and thirty-one. A narrow majority.',
    cap: 'National, ACT and NZ First hold 67 of 131. A narrow majority.' },
  { id: 'top', beats: 8, energy: 2, trans: { type: 'zoom', dur: 0.5 },
    say: 'And Opportunity is the first new party in Parliament since 2011.',
    cap: 'And Opportunity is the first new party in Parliament since 2011.' },
  { id: 'end', beats: 6, energy: 0, trans: { type: 'zoom', dur: 0.5 }, noProgress: true },
];

export function build({ E, kit, ui, THREE, endCard }) {
  const { C, ease, remap, lerp } = E;
  const P = Object.fromEntries(PARTIES.map((p) => [p.id, p]));
  const seatColors = PARTIES.flatMap((p) => Array(p.seats).fill(p.color));
  const seatParty = PARTIES.flatMap((p) => Array(p.seats).fill(p.id));

  const nzMap = (S, o = {}) => {
    const grp = kit.mapTiles(E.geo.nz, { depth: 0.2, bevel: 0.015, mat: () => kit.M.gloss(0x1d2330, { roughness: 0.45 }) });
    const edge = kit.mapSlab({ outline: E.geo.nz.outline, size: E.geo.nz.size }, { depth: 0.2, bevel: 0.0, edgeWidth: 0.02, edgeGlow: 1.6, mat: new THREE.MeshBasicMaterial({ visible: false }) });
    grp.add(edge);
    grp.userData.edgeMat = edge.userData.edgeMat;
    return grp;
  };

  // ---------------- HOOK ----------------
  E.defineScene('hook', (S) => {
    E.stage(S, { accent: C.lime, accent2: 0x1f5fbf, grid: 0.07, rim: 90, glow: 0.3, center: [0, 0, 0] });
    const map = nzMap(S);
    map.scale.setScalar(0.5);
    S.scene.add(map);
    const tiles = map.userData.tiles;
    const r = E.rng(9);
    tiles.forEach((t) => { t.d = r(); });
    E.camPath(S, [{ t: 0, pos: [0, 12, 3.0], look: [0, 0, -0.2], fov: 40 }, { t: S.dur + 0.5, pos: [0.4, 9.5, 5.0], look: [0, 0, -0.2], fov: 40 }], { shiftY: 230, shake: 0.04 });
    S.focus = 9; S.aperture = 0.3;
    S.update((lt, t) => {
      tiles.forEach((tt, i) => {
        const k = ease.back(remap(lt, 0.05 + tt.d * 0.5, 0.45 + tt.d * 0.5));
        tt.mesh.position.y = (1 - k) * 3;
        tt.mesh.scale.y = Math.max(0.01, k);
        // red/blue flicker settling to ink
        const flick = remap(lt, 0.6, 1.3);
        tt.mesh.material.color.setHex(flick < 1 && (i + Math.floor(lt * 14)) % 3 === 0 ? (i % 2 ? 0xd82a20 : 0x1f5fbf) : 0x1d2330);
      });
      map.rotation.y = -0.2 + lt * 0.1;
      map.userData.edgeMat.emissiveIntensity = 1.2 + 1.5 * Math.exp(-Math.max(0, lt - 0.5) * 4);
    });
    E.cue(S.t0 + 0.45, 'boom', { g: 0.6 });
    ui.kicker(S, { t0: 0.05, text: 'NZ election 2026', y: 372 });
    ui.headline(S, { t0: 0.1, html: '<em>Most votes.</em> Fewer seats.', y: 428, size: 112, style: 'slam', font: 'sans', stagger: 0.12, t1: S.dur + 1 });
  });

  // ---------------- INTRO (map + unofficial) ----------------
  E.defineScene('intro', (S) => {
    E.stage(S, { accent: C.lime, accent2: 0x1f5fbf, grid: 0.05, rim: 50, glow: 0.14, center: [0, 0, 0], shadowSize: 6 });
    const map = nzMap(S);
    map.scale.setScalar(0.55);
    map.position.x = -0.3;
    S.scene.add(map);
    const tiles = map.userData.tiles;
    tiles.forEach((t, i) => { t.order = (t.c.z + 5) / 10; if (i % 4 === 0) E.cue(S.t0 + 0.2 + (1 - t.order) * 1.6, 'blip', { i: i / 4 }); });
    const dust = kit.particles({ count: 220, center: [0, 2, -2], box: [10, 6, 12], size: 20 });
    S.scene.add(dust);
    E.camPath(S, [{ t: 0, pos: [-1.2, 8.0, 6.5], look: [0, 0, -0.2], fov: 40 }, { t: S.dur, pos: [1.2, 9.5, 5.2], look: [0, 0, -0.2], fov: 40 }], { shiftY: 300, shake: 0.03, focusOn: true });
    S.aperture = 0.45;
    S.update((lt, t) => {
      tiles.forEach((tt) => {
        const k = ease.back(remap(lt, 0.2 + (1 - tt.order) * 1.6, 0.6 + (1 - tt.order) * 1.6));
        tt.mesh.scale.y = Math.max(0.01, 0.4 + 0.6 * k);
        tt.mesh.position.y = 0;
        tt.mesh.material.color.setHex(k > 0.98 ? 0x252c3a : 0x1a1f29);
      });
      map.rotation.y = 0.15 - lt * 0.04;
      dust.userData.tick(t);
    });
    ui.kicker(S, { t0: 0.1, text: 'New Zealand · 2026', y: 372 });
    ui.headline(S, { t0: 0.2, html: 'The <em>preliminary</em> count is in', y: 430, size: 100, style: 'rise' });
    ui.block(S, { t0: 0.9, html: 'Election-night figures. <b>Unofficial</b> until the final count.', cls: 'body', y: 660, w: 880 });
  });

  // ---------------- VOTE (Labour vs National, party vote) ----------------
  E.defineScene('vote', (S) => {
    E.stage(S, { accent: 0xd82a20, accent2: 0x1f5fbf, grid: 0.05, rim: 60, glow: 0.16, center: [0, 1.2, 0], shadowSize: 6 });
    const scale = 0.06; // units per %
    const others = PARTIES.filter((p) => p.id !== 'LAB' && p.id !== 'NAT');
    const bars = [];
    const mk = (p, x, z, w) => { const m = kit.box(w, 1, w, 0.08, kit.M.gloss(p.color)); m.position.set(x, 0, z); S.scene.add(m); bars.push({ m, p }); return m; };
    mk(P.LAB, -0.62, 0, 0.95); mk(P.NAT, 0.62, 0, 0.95);
    others.forEach((p, i) => mk(p, (i - 2) * 0.75, -2.6, 0.5));
    ui.tag3d(S, { at: new THREE.Vector3(-0.62, 29.31 * 0.06 + 0.35, 0), html: 'Labour', cls: 'chip', t0: 1.8 });
    ui.tag3d(S, { at: new THREE.Vector3(0.62, 29.26 * 0.06 + 0.35, 0), html: 'National', cls: 'chip', t0: 1.9 });
    E.camPath(S, [{ t: 0, pos: [-2.6, 3.2, 10.5], look: [0, 0.9, -0.5], fov: 38 }, { t: S.dur, pos: [2.2, 2.8, 9.8], look: [0, 0.9, -0.5], fov: 38 }], { shiftY: 330, shake: 0.03, focusOn: true });
    S.aperture = 0.55;
    S.update((lt) => {
      bars.forEach((b, i) => {
        const k = ease.expo(remap(lt, 0.3 + (i > 1 ? 0.2 : 0), 1.9 + (i > 1 ? 0.2 : 0)));
        const h = Math.max(0.02, b.p.vote * scale * k);
        b.m.scale.y = h; b.m.position.y = h / 2;
      });
    });
    ui.kicker(S, { t0: 0.05, text: 'Party vote', y: 372 });
    ui.counter(S, { t0: 0.3, dur: 1.6, to: 29.31, decimals: 2, suffix: '%', y: 420, x: 80, w: 440, size: 120, color: '#ff6a5e', label: 'Labour' });
    ui.counter(S, { t0: 0.3, dur: 1.6, to: 29.26, decimals: 2, suffix: '%', y: 420, x: 560, w: 440, size: 120, align: 'right', color: '#6f9bff', label: 'National', ticks: false });
    ui.block(S, { t0: 1.9, html: 'A gap of just <em>0.05 points</em>', cls: 'body', y: 620, align: 'center' });
  });

  // ---------------- SEATS (hemicycle by party) ----------------
  E.defineScene('seats', (S) => {
    E.stage(S, { accent: C.lime, accent2: 0x1f5fbf, grid: 0.05, rim: 50, glow: 0.14, center: [0, 0.3, -1.4], shadowSize: 6 });
    const hemi = kit.hemicycle(seatColors, { rows: 7, r0: 1.9, r1: 4.4, seat: 0.3 });
    hemi.mesh.position.z = -0.6; hemi.mesh.scale.setScalar(0.36);
    S.scene.add(hemi.mesh);
    const n = hemi.count;
    for (let i = 0; i < n; i += 6) E.cue(S.t0 + 0.3 + (i / n) * 1.5, 'blip', { i: i / 6 });
    E.camPath(S, [{ t: 0, pos: [0, 5.6, 5.4], look: [0, 0, -1.2], fov: 40 }, { t: S.dur, pos: [0, 4.4, 6.4], look: [0, 0, -1.2], fov: 40 }], { shiftY: 200, shake: 0.03, focusOn: true });
    S.aperture = 0.4;
    S.update((lt) => {
      for (let i = 0; i < n; i++) {
        const k = ease.back(remap(lt, 0.3 + (i / n) * 1.5, 0.65 + (i / n) * 1.5));
        const big = seatParty[i] === 'NAT' || seatParty[i] === 'LAB';
        const lift = big ? 0.25 * ease.inOut(remap(lt, 2.2, 2.8)) : 0;
        hemi.set(i, Math.max(0.0001, k), (1 - k) * 0.6 + lift);
      }
      hemi.commit();
    });
    ui.kicker(S, { t0: 0.05, text: 'Seats', y: 372 });
    ui.counter(S, { t0: 0.3, dur: 1.4, to: 42, y: 420, x: 80, w: 440, size: 200, color: '#6f9bff', label: 'National', ticks: false });
    ui.counter(S, { t0: 0.45, dur: 1.3, to: 36, y: 420, x: 560, w: 440, size: 200, align: 'right', color: '#ff6a5e', label: 'Labour', ticks: false });
    const leg = PARTIES.slice().sort((a, b) => b.seats - a.seats).map((p) => `<span><i style="background:${hex(p.color)}"></i>${p.name} ${p.seats}</span>`).join('');
    ui.block(S, { t0: 1.6, html: `<div class="legend" style="font-size:31px;justify-content:center">${leg}</div>`, y: 690, w: 920, x: 80 });
  });

  // ---------------- OVERHANG ----------------
  E.defineScene('overhang', (S) => {
    E.stage(S, { accent: C.lime, accent2: 0x7da7ff, grid: 0.05, rim: 50, glow: 0.14, center: [0, 0.3, -1.4], shadowSize: 6 });
    // 120 base seats + 11 overhang seats on the outer edge (overhang seats not attributed to parties here)
    const cols = Array(131).fill(0x3a4252);
    const hemi = kit.hemicycle(cols, { rows: 7, r0: 1.9, r1: 4.4, seat: 0.3 });
    hemi.mesh.position.z = -0.6; hemi.mesh.scale.setScalar(0.36);
    S.scene.add(hemi.mesh);
    // pick 11 outer-row seats spread evenly as the "extra" seats
    const outer = hemi.spots.map((s, i) => ({ s, i })).filter((o) => o.s.ri === 6);
    const extra = new Set(Array.from({ length: 11 }, (_, k) => outer[Math.round(((k + 0.5) / 11) * (outer.length - 1))].i));
    [...extra].forEach((i, k) => E.cue(S.t0 + 1.2 + k * 0.12, 'pop', { i: k }));
    const order = [...extra];
    E.camPath(S, [{ t: 0, pos: [-1.0, 5.4, 6.8], look: [0, 0, -1.0], fov: 40 }, { t: S.dur, pos: [1.0, 5.0, 7.0], look: [0, 0, -1.0], fov: 40 }], { shiftY: 220, shake: 0.03, focusOn: true });
    S.aperture = 0.4;
    S.update((lt) => {
      for (let i = 0; i < hemi.count; i++) {
        if (extra.has(i)) {
          const k = ease.back(remap(lt, 1.2 + order.indexOf(i) * 0.12, 1.55 + order.indexOf(i) * 0.12));
          hemi.set(i, Math.max(0.0001, k * 1.15), (1 - k) * 1.2 + 0.05, C.lime);
        } else hemi.set(i, 1, 0, 0x3a4252);
      }
      hemi.commit();
    });
    ui.kicker(S, { t0: 0.05, text: 'Why?', y: 372 });
    ui.counter(S, { t0: 1.1, dur: 1.0, to: 11, prefix: '+', y: 410, size: 230, label: 'overhang seats: 131 in total' });
    ui.block(S, { t0: 1.9, html: 'Win more electorates than your party vote earns, and you <b>keep them</b>. Parliament grows.', cls: 'body', y: 700, w: 900 });
  });

  // ---------------- MAJORITY ----------------
  E.defineScene('majority', (S) => {
    E.stage(S, { accent: 0x1f5fbf, accent2: C.lime, grid: 0.05, rim: 60, glow: 0.16, center: [0, 0.3, -1.4], shadowSize: 6 });
    const hemi = kit.hemicycle(seatColors, { rows: 7, r0: 1.9, r1: 4.4, seat: 0.3 });
    hemi.mesh.position.z = -0.6; hemi.mesh.scale.setScalar(0.36);
    S.scene.add(hemi.mesh);
    const bloc = new Set(['NAT', 'ACT', 'NZF']);
    // majority line: the seat index where 66 (majority of 131) is reached counting from the right
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 1.12), kit.M.glow(C.lime, 2.2));
    const a = hemi.spots[131 - 66].a; // boundary angle
    line.position.set(Math.cos(a) * 1.13, 0.2, -0.6 - Math.sin(a) * 1.13);
    line.rotation.y = a + Math.PI / 2;
    S.scene.add(line);
    E.camPath(S, [{ t: 0, pos: [1.4, 5.4, 6.8], look: [0, 0, -1.0], fov: 40 }, { t: S.dur, pos: [0.4, 4.8, 7.2], look: [0, 0, -1.0], fov: 40 }], { shiftY: 220, shake: 0.03, focusOn: true });
    S.aperture = 0.4;
    const dim = new THREE.Color(), c2 = new THREE.Color();
    S.update((lt) => {
      const k = ease.inOut(remap(lt, 0.5, 1.3));
      for (let i = 0; i < hemi.count; i++) {
        const inBloc = bloc.has(seatParty[i]);
        c2.setHex(seatColors[i]);
        if (!inBloc) c2.lerp(dim.setHex(0x262b35), k);
        hemi.set(i, 1, inBloc ? 0.12 * k : 0, c2.getHex());
      }
      hemi.commit();
      line.scale.x = 1; line.scale.z = Math.max(0.01, ease.expo(remap(lt, 1.2, 1.8)));
    });
    ui.kicker(S, { t0: 0.05, text: 'Who governs?', y: 372 });
    ui.counter(S, { t0: 0.6, dur: 1.4, to: 67, y: 410, x: 80, w: 500, size: 230, color: '#c8f04a', label: 'National + ACT + NZ First' });
    ui.block(S, { t0: 1.3, html: '<span style="font-family:JetBrains Mono;font-weight:700;font-size:30px;letter-spacing:.08em;color:#b7bfcd">MAJORITY</span><br><span style="font-size:96px;font-weight:900;letter-spacing:-.04em">66</span><span style="font-size:40px;font-weight:700;color:#b7bfcd"> of 131</span>', y: 425, x: 600, w: 400, align: 'right', style: 'pop' });
    ui.headline(S, { t0: 1.9, html: 'A <em>narrow</em> majority', y: 720, size: 84, style: 'rise' });
  });

  // ---------------- OPPORTUNITY ----------------
  E.defineScene('top', (S) => {
    E.stage(S, { accent: 0x22b8a8, accent2: C.lime, grid: 0.06, rim: 70, glow: 0.2, center: [0, 0.6, 0], shadowSize: 5 });
    const seats = [];
    for (let i = 0; i < 7; i++) {
      const m = kit.shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.2, 32), kit.M.gloss(0x22b8a8, { emissive: 0x22b8a8, emissiveIntensity: 0.15 })));
      const a = Math.PI * (0.15 + 0.7 * (i / 6));
      m.position.set(Math.cos(a) * 1.5, 0.1, -Math.sin(a) * 1.0 + 0.3);
      S.scene.add(m);
      seats.push(m);
      E.cue(S.t0 + 0.5 + i * 0.16, 'pop', { i });
    }
    const spot = new THREE.SpotLight(0xbff7ee, 60, 14, 0.42, 0.6, 1.4);
    spot.position.set(0, 7, 2); spot.target.position.set(0, 0, -0.2); spot.castShadow = true;
    S.scene.add(spot, spot.target);
    const yr = kit.text3d('2011', { font: 'sans', size: 0.55, depth: 0.12, mat: kit.M.gloss(0x2a3140) });
    yr.position.set(0, 0.32, -2.4);
    S.scene.add(yr);
    const dust = kit.particles({ count: 200, center: [0, 2.5, -2], box: [8, 6, 8], color: 0x7ff0e0, color2: C.lime, size: 20 });
    S.scene.add(dust);
    E.camPath(S, [{ t: 0, pos: [0, 3.4, 9.0], look: [0, 0.4, -0.8], fov: 36 }, { t: S.dur, pos: [0.8, 3.8, 8.2], look: [0, 0.4, -0.8], fov: 36 }], { shiftY: 190, shake: 0.03, focusOn: true });
    S.aperture = 0.6;
    S.update((lt, t) => {
      seats.forEach((m, i) => { const k = ease.back(remap(lt, 0.5 + i * 0.16, 0.9 + i * 0.16)); m.scale.setScalar(Math.max(0.001, k)); m.position.y = 0.1 + (1 - k) * 1.2; });
      spot.intensity = 60 * ease.out(remap(lt, 0, 0.6));
      dust.userData.tick(t);
    });
    ui.kicker(S, { t0: 0.05, text: 'New in Parliament', y: 372, color: '#5fe3d2' });
    ui.headline(S, { t0: 0.15, html: '<em style="color:#5fe3d2">Opportunity</em> is in', y: 430, size: 104, style: 'rise' });
    ui.block(S, { t0: 0.9, html: '<b>7 seats</b> on 5.97% of the party vote. The first new party in Parliament since 2011.', cls: 'body', y: 560, w: 900 });
  });

  // ---------------- END ----------------
  E.defineScene('end', (S) => endCard(S, { sources: 'Preliminary, unofficial figures (Wikipedia, election night).<br>The official result may differ.' }));
}
