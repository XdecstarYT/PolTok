// Reel 3 — US 2026 midterms: Senate and House seat counts and races called, pulled LIVE from
// https://poltok.netlify.app/api/snapshot at render time. No numbers are hard-coded: if the API does not return
// both chambers' balance, data() throws and the render stops (exit code 2).

const API = 'https://poltok.netlify.app/api/snapshot?source=live';

export async function data() {
  let j = null, lastErr = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(API + '&_=' + Date.now(), { headers: { 'user-agent': 'poltok-reels/1.0' } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      j = await r.json();
      if (Array.isArray(j.balance) && j.balance.some((b) => b.chamber === 'senate') && j.balance.some((b) => b.chamber === 'house')) break;
      lastErr = `API answered without both Senate and House balance (balance=${JSON.stringify(j.balance)}, clock.lastOk=${j.clock?.lastOk}, lastError=${JSON.stringify(j.clock?.lastError)}, fetchedAt=${j.fetchedAt})`;
      j = null;
    } catch (e) { lastErr = e.message; }
    await new Promise((res) => setTimeout(res, 4000));
  }
  if (!j) throw new Error('snapshot API unusable: ' + lastErr);
  const pick = (c) => {
    const b = j.balance.find((x) => x.chamber === c);
    for (const k of ['dem', 'rep', 'ind', 'total', 'majority']) if (!Number.isFinite(b[k])) throw new Error(`balance.${c}.${k} missing`);
    return { dem: b.dem, rep: b.rep, ind: b.ind, total: b.total, majority: b.majority, undecided: Math.max(0, b.total - b.dem - b.rep - b.ind) };
  };
  const results = Array.isArray(j.results) ? j.results : [];
  const asOf = new Date(j.fetchedAt || Date.now());
  return {
    senate: pick('senate'), house: pick('house'),
    called: results.filter((r) => r.status === 'called' || r.calledFor).length,
    tracked: results.length,
    asOf: asOf.toISOString(),
    asOfLabel: asOf.toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' ET',
  };
}

export const meta = {
  title: 'US midterms 2026: where the count stands',
  label: 'LIVE DATA',
  out: 'poltok-us-midterms-2026',
  cover: 5.5,
  music: { prog: ['Em', 'C', 'G', 'D'], arp: 'up', seed: 33, swing: 0 },
  voice: { lengthScale: 0.8 },
  geo: { us: { src: 'us-states', mode: 'tiles', width: 6 } },
};

const seatLine = (c, name) => {
  const parts = [`Democrats ${c.dem}`, `Republicans ${c.rep}`];
  if (c.ind) parts.push(`independents ${c.ind}`);
  return `${name}: ${parts.join(', ')}.` + (c.undecided ? ` ${c.undecided} still undecided.` : '');
};

export const scenes = (d) => [
  { id: 'hook', beats: 3, energy: 3 },
  { id: 'intro', beats: 6, energy: 1, trans: { type: 'zoom', dur: 0.5 },
    say: 'The 2026 midterms. Here is where the count stands.', cap: 'The 2026 midterms. Here is where the count stands.' },
  { id: 'senate', beats: 10, energy: 3, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: seatLine(d.senate, 'In the Senate') + ` ${d.senate.majority} seats are needed for control.`,
    cap: seatLine(d.senate, 'Senate') + ` ${d.senate.majority} for control.` },
  { id: 'house', beats: 10, energy: 3, trans: { type: 'whip', dir: 'up', dur: 0.42 },
    say: seatLine(d.house, 'In the House') + ` The majority is ${d.house.majority}.`,
    cap: seatLine(d.house, 'House') + ` Majority: ${d.house.majority}.` },
  { id: 'called', beats: 8, energy: 2, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: `Of the ${d.tracked} key races PolTok tracks, ${d.called} have been called.`,
    cap: `${d.called} of ${d.tracked} key races PolTok tracks have been called.` },
  { id: 'end', beats: 6, energy: 0, trans: { type: 'zoom', dur: 0.5 }, noProgress: true },
];

export function build({ E, kit, ui, THREE, endCard }) {
  const { C, ease, remap } = E;
  const d = E.data;
  const DEM = 0x3d7bff, REP = 0xff3d55, IND = 0xa98bff, UND = 0x3a4252;

  E.defineScene('hook', (S) => {
    E.stage(S, { accent: C.lime, accent2: DEM, grid: 0.07, rim: 80, glow: 0.25, center: [0, 0, 0] });
    const map = kit.mapTiles(E.geo.us, { depth: 0.18, bevel: 0.012, mat: () => kit.M.gloss(0x1d2330, { roughness: 0.45 }) });
    map.scale.setScalar(0.5);
    S.scene.add(map);
    const r = E.rng(4);
    const tiles = map.userData.tiles;
    tiles.forEach((t) => { t.d = r(); t.side = r() < 0.5 ? DEM : REP; });
    E.camPath(S, [{ t: 0, pos: [0, 7.5, 3.8], look: [0, 0, 0], fov: 40 }, { t: S.dur + 0.5, pos: [0.3, 6.0, 4.6], look: [0, 0, 0], fov: 40 }], { shiftY: 230, shake: 0.04 });
    S.focus = 7; S.aperture = 0.3;
    S.update((lt) => {
      tiles.forEach((tt, i) => {
        const k = ease.back(remap(lt, 0.05 + tt.d * 0.5, 0.45 + tt.d * 0.5));
        tt.mesh.position.y = (1 - k) * 2.5;
        tt.mesh.scale.y = Math.max(0.01, k);
        tt.mesh.material.color.setHex((i + Math.floor(lt * 12)) % 4 === 0 && lt < 1.3 ? tt.side : 0x1d2330);
      });
    });
    E.cue(S.t0 + 0.45, 'boom', { g: 0.6 });
    ui.kicker(S, { t0: 0.05, text: 'US midterms 2026', y: 372 });
    ui.headline(S, { t0: 0.1, html: 'Who controls <em>Congress?</em>', y: 428, size: 112, style: 'slam', font: 'sans', stagger: 0.1, t1: S.dur + 1 });
  });

  E.defineScene('intro', (S) => {
    E.stage(S, { accent: C.lime, accent2: DEM, grid: 0.05, rim: 50, glow: 0.14, center: [0, 0, 0] });
    const map = kit.mapTiles(E.geo.us, { depth: 0.18, bevel: 0.012, mat: () => kit.M.gloss(0x232a37, { roughness: 0.45 }) });
    map.scale.setScalar(0.5);
    S.scene.add(map);
    const dust = kit.particles({ count: 200, center: [0, 2, -2], box: [10, 6, 10], size: 20 });
    S.scene.add(dust);
    E.camPath(S, [{ t: 0, pos: [-1.2, 5.0, 5.0], look: [0, 0, 0], fov: 40 }, { t: S.dur, pos: [1.2, 5.6, 4.2], look: [0, 0, 0], fov: 40 }], { shiftY: 260, shake: 0.03, focusOn: true });
    S.aperture = 0.4;
    S.update((lt, t) => { dust.userData.tick(t); map.rotation.y = 0.05 - lt * 0.03; });
    ui.kicker(S, { t0: 0.1, text: 'Live from PolTok', y: 372 });
    ui.headline(S, { t0: 0.2, html: 'Where the <em>count</em> stands', y: 430, size: 104, style: 'rise' });
    ui.block(S, { t0: 0.9, html: `Data as of <b>${d.asOfLabel}</b>`, cls: 'body', y: 660 });
  });

  const chamber = (id, c, label, rows, scale, camZ) => E.defineScene(id, (S) => {
    E.stage(S, { accent: DEM, accent2: REP, grid: 0.05, rim: 50, glow: 0.14, center: [0, 0.3, -1.2], shadowSize: 6 });
    const cols = [...Array(c.dem).fill(DEM), ...Array(c.ind).fill(IND), ...Array(c.undecided).fill(UND), ...Array(c.rep).fill(REP)];
    const hemi = kit.hemicycle(cols, { rows, r0: 1.9, r1: 4.4, seat: id === 'house' ? 0.17 : 0.3 });
    hemi.mesh.position.z = -0.6; hemi.mesh.scale.setScalar(scale);
    S.scene.add(hemi.mesh);
    const n = hemi.count, step = Math.max(1, Math.round(n / 24));
    for (let i = 0; i < n; i += step) E.cue(S.t0 + 0.3 + (i / n) * 1.5, 'blip', { i: i / step });
    const a = hemi.spots[Math.min(n - 1, n - c.majority)].a;
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 1.12), kit.M.glow(C.lime, 2.2));
    line.position.set(Math.cos(a) * 1.13, 0.2, -0.6 - Math.sin(a) * 1.13);
    line.rotation.y = a + Math.PI / 2;
    S.scene.add(line);
    E.camPath(S, [{ t: 0, pos: [0, 5.4, camZ], look: [0, 0, -1.0], fov: 40 }, { t: S.dur, pos: [0, 4.8, camZ + 0.4], look: [0, 0, -1.0], fov: 40 }], { shiftY: 220, shake: 0.03, focusOn: true });
    S.aperture = 0.4;
    S.update((lt) => {
      for (let i = 0; i < n; i++) { const k = ease.back(remap(lt, 0.3 + (i / n) * 1.5, 0.65 + (i / n) * 1.5)); hemi.set(i, Math.max(0.0001, k), (1 - k) * 0.6); }
      hemi.commit();
      line.scale.z = Math.max(0.01, ease.expo(remap(lt, 1.8, 2.3)));
    });
    ui.kicker(S, { t0: 0.05, text: label, y: 372 });
    ui.counter(S, { t0: 0.3, dur: 1.4, to: c.dem, y: 420, x: 80, w: 440, size: 200, color: '#7da7ff', label: 'Democrats' + (c.ind ? ` <span style="color:#c4b2ff">+ ${c.ind} ind.</span>` : '') });
    ui.counter(S, { t0: 0.45, dur: 1.3, to: c.rep, y: 420, x: 560, w: 440, size: 200, align: 'right', color: '#ff8394', label: 'Republicans', ticks: false });
    ui.block(S, { t0: 1.8, html: `<b>${c.majority}</b> for control${c.undecided ? ` · <b>${c.undecided}</b> undecided` : ''}`, cls: 'body', y: 700, align: 'center' });
  });
  chamber('senate', d.senate, 'Senate', 5, 0.36, 7.2);
  chamber('house', d.house, 'House', 10, 0.36, 7.2);

  E.defineScene('called', (S) => {
    E.stage(S, { accent: C.lime, grid: 0.06, rim: 60, glow: 0.18, center: [0, 0.8, 0] });
    const ring = kit.arcGauge({ r: 1.5, tube: 0.16, mat: kit.M.lime() });
    const track = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.1, 12, 120), kit.M.std(0x262b35));
    ring.position.set(0, 1.7, 0); track.position.copy(ring.position);
    S.scene.add(track, ring);
    const frac = d.tracked ? d.called / d.tracked : 0;
    E.camPath(S, [{ t: 0, pos: [0, 1.9, 10.5], look: [0, 1.7, 0], fov: 36 }, { t: S.dur, pos: [0.6, 2.1, 9.8], look: [0, 1.7, 0], fov: 36 }], { shiftY: 260, shake: 0.03 });
    S.focus = 10; S.aperture = 0.4;
    S.update((lt) => { ring.userData.setFrac(frac * ease.expo(remap(lt, 0.3, 1.9))); ring.rotation.y = Math.sin(lt * 0.8) * 0.15; track.rotation.y = ring.rotation.y; });
    ui.kicker(S, { t0: 0.05, text: 'Races called', y: 372 });
    ui.counter(S, { t0: 0.3, dur: 1.6, to: d.called, y: 420, size: 230, suffix: `<span style="font-size:.4em;color:#b7bfcd"> / ${d.tracked}</span>`, label: 'key races PolTok tracks' });
  });

  E.defineScene('end', (S) => endCard(S, { title: 'Follow it <em>live</em>', sources: `Seat counts: PolTok live results feed, as of ${d.asOfLabel}.<br>Uncalled races can still change.` }));
}
