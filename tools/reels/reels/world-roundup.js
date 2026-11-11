// Realistic reel — "Elections you might have missed": the latest national results worldwide, pulled LIVE at
// render time from PolTok's /api/world/elections + /api/world/results (each election's Wikipedia infobox,
// unofficial). Nothing is hard-coded; if fewer than 3 elections have results, data() throws.

const BASE = 'https://poltok.netlify.app/api/world';
const get = async (u) => { const r = await fetch(u, { headers: { 'user-agent': 'poltok-reels/1.0' } }); if (!r.ok) throw new Error(u + ' HTTP ' + r.status); return r.json(); };
const clean = (s) => String(s || '').replace(/\s*\((?:[A-Z][\w ]+)\)$/, '').replace(/ politicians in [A-Z][\w ]+$/, 's').trim();

export async function data() {
  const el = await get(BASE + '/elections');
  const today = new Date().toISOString().slice(0, 10);
  const since = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10);
  const recent = el.elections
    .filter((e) => e.date && e.date <= today && e.date >= since && e.article && !e.indirect && !e.approx)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const out = [], seen = new Set();
  for (const e of recent) {
    if (out.length >= 3) break;
    if (seen.has(e.country) || /^(New Zealand|Australia|United States)$/.test(e.country)) continue; // covered by their own reels
    let r;
    try { r = await get(BASE + '/results?title=' + encodeURIComponent(e.article)); } catch { continue; }
    const res = r.results;
    if (!res || res.rows.length < 2) continue;
    const leg = res.kind === 'legislative';
    const rows = res.rows.slice(0, 3).map((x) => ({
      name: clean(leg ? x.party || x.candidate : x.candidate || x.party),
      value: leg ? x.seats : x.pct,
      pct: x.pct,
    })).filter((x) => x.name && Number.isFinite(x.value));
    if (rows.length < 2) continue;
    seen.add(e.country);
    out.push({ country: e.country, office: e.office, date: e.dateLabel || e.date, kind: res.kind, rows, url: r.url });
  }
  if (out.length < 3) throw new Error('fewer than 3 recent elections with published results (' + out.length + ')');
  return { items: out, asOf: new Date().toUTCString().slice(5, 16) };
}

export const meta = {
  title: 'Elections you might have missed',
  label: 'WORLD',
  out: 'poltok-world-roundup',
  cover: 1.4,
  music: { prog: ['Am', 'F', 'C', 'G'], arp: 'up', seed: 83, swing: 0.05 },
};

export const scenes = (d) => [
  { id: 'hook', beats: 6, energy: 3 },
  ...d.items.map((it, i) => ({
    id: 'e' + i, beats: 12, energy: 2, trans: { type: i % 2 ? 'whip' : 'zoom', dir: 'left', dur: 0.45 },
    say: `${it.country}: ${it.rows[0].name} ${it.kind === 'legislative' ? `won the most seats, with ${it.rows[0].value}` : `led with ${it.rows[0].value} percent`}.`,
    cap: `${it.country}: ${it.rows[0].name} ${it.kind === 'legislative' ? `won the most seats (${it.rows[0].value})` : `led with ${it.rows[0].value}%`}.`,
  })),
  { id: 'more', beats: 8, energy: 2, trans: { type: 'flash', dur: 0.36 },
    say: 'Every national vote, on the PolTok world map.', cap: 'Every national vote, on the PolTok world map.' },
  { id: 'end', beats: 6, energy: 0, trans: { type: 'zoom', dur: 0.5 }, noProgress: true },
];

export function build({ E, kit, ui, THREE, endCard, real }) {
  const { C, ease, remap } = E;
  const d = E.data;
  const BAR = [0xc8f04a, 0x7da7ff, 0xe9b949];

  // ballot box: timber box with a brass slot plate
  const ballotBox = () => {
    const g = new THREE.Group();
    const wood = real.pbr(real.tex.wood(0x6a3d1f), { repeat: [1, 1], clearcoat: 0.8, clearcoatRoughness: 0.18 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 1.2), wood); body.position.y = 0.6; body.castShadow = body.receiveShadow = true; g.add(body);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 1.3), wood); lid.position.y = 1.24; lid.castShadow = true; g.add(lid);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.02, 0.22), kit.M.gold()); plate.position.y = 1.29; g.add(plate);
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.03, 0.05), new THREE.MeshBasicMaterial({ color: 0x050505 })); slot.position.y = 1.3; g.add(slot);
    return g;
  };

  E.defineScene('hook', (S) => {
    real.room(S, { carpet: 0x2b2f3a, wood: 0x4b2f1a, width: 18, depth: 16, height: 8, key: 160, area: 4 });
    const table = new THREE.Mesh(new THREE.BoxGeometry(5, 0.14, 3), real.pbr(real.tex.marble(), { repeat: [2, 1], clearcoat: 1, clearcoatRoughness: 0.08 }));
    table.position.y = 0.9; table.receiveShadow = true; S.scene.add(table);
    const box = ballotBox(); box.position.y = 0.97; S.scene.add(box);
    const papers = [];
    for (let i = 0; i < 10; i++) {
      const p = real.sheet(0.42, 0.6, (c, w) => { c.fillStyle = 'rgba(20,20,20,.5)'; c.fillRect(40, 60, w - 80, 22); c.fillRect(40, 120, w - 160, 16); });
      S.scene.add(p); papers.push(p);
    }
    E.camPath(S, [{ t: 0, pos: [0, 3.0, 6.8], look: [0, 1.5, 0], fov: 32 }, { t: S.dur + 0.4, pos: [0.5, 3.2, 7.6], look: [0, 1.5, 0], fov: 32 }], { shake: 0.015, shiftY: 380, focusOn: true });
    S.aperture = 0.5;
    S.update((lt) => papers.forEach((p, i) => {
      const k = remap(lt, 0.1 + i * 0.2, 0.7 + i * 0.2);
      p.visible = k > 0 && k < 1;
      p.position.set(Math.sin(i * 2.3) * 0.25, 3.4 - k * 2.1, Math.cos(i * 1.7) * 0.1);
      p.rotation.set(-0.2 + Math.sin(i + lt) * 0.3, i * 0.6 + lt, 0.1);
    }));
    E.cue(S.t0 + 0.4, 'boom', { g: 0.5 });
    ui.kicker(S, { t0: 0, text: 'Around the world · last 60 days', y: 372 });
    ui.headline(S, { t0: 0, html: `<em>${d.items.length} countries</em> just voted`, y: 410, size: 100, style: 'slam', stagger: 0.04, t1: S.dur + 1 });
    ui.block(S, { t0: 0.35, html: d.items.map((x) => `<b>${x.country}</b>`).join(' · ') + '. Did you catch the results?', cls: 'body', y: 690, w: 920, size: 46, t1: S.dur + 1 });
  });

  d.items.forEach((it, idx) => E.defineScene('e' + idx, (S) => {
    real.room(S, { carpet: 0x2b2f3a, wood: [0x4b2f1a, 0x553320, 0x3f2a1a][idx % 3], width: 18, depth: 16, height: 8, key: 170, area: 4 });
    const table = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.14, 3), real.pbr(real.tex.wood(0x5d371c), { repeat: [2, 1], clearcoat: 0.8, clearcoatRoughness: 0.15 }));
    table.position.y = 0.9; table.receiveShadow = true; S.scene.add(table);
    const max = Math.max(...it.rows.map((r) => r.value));
    // acrylic result blocks (frosted, tinted), heights proportional to seats / vote share
    const blocks = it.rows.map((r, i) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1, 0.9), new THREE.MeshPhysicalMaterial({ color: BAR[i], roughness: 0.18, transmission: 0.55, thickness: 0.8, clearcoat: 1, clearcoatRoughness: 0.05, emissive: BAR[i], emissiveIntensity: 0.12 }));
      m.position.set((i - (it.rows.length - 1) / 2) * 1.1, 0.97, 0); m.castShadow = true; S.scene.add(m);
      m.userData.h = 0.12 + (1.5 * r.value) / max; return m;
    });
    blocks.forEach((_, i) => E.cue(S.t0 + 0.6 + i * 0.35, 'pop', { i }));
    E.camPath(S, [{ t: 0, pos: [-1.4, 3.6, 10.5], look: [0, 1.5, 0], fov: 32 }, { t: S.dur, pos: [1.2, 3.4, 9.6], look: [0, 1.5, 0], fov: 32 }], { shake: 0.015, shiftY: 380, focusOn: true });
    S.aperture = 0.45;
    S.update((lt) => blocks.forEach((b, i) => { const k = ease.back(remap(lt, 0.6 + i * 0.35, 1.3 + i * 0.35)); const h = Math.max(0.01, b.userData.h * k); b.scale.y = h; b.position.y = 0.97 + h / 2; }));
    it.rows.forEach((r, i) => ui.tag3d(S, {
      at: () => new THREE.Vector3(blocks[i].position.x, 0.97 + blocks[i].scale.y + 0.25, 0.45),
      html: `<b>${it.kind === 'legislative' ? r.value + (r.value === 1 ? ' seat' : ' seats') : r.value + '%'}</b>`, cls: 'chip', t0: 1.0 + i * 0.35,
    }));
    ui.kicker(S, { t0: 0.05, text: `${it.office} · ${it.date}`, y: 372 });
    ui.headline(S, { t0: 0.12, html: `<em>${it.country}</em>`, y: 428, size: 118, style: 'rise' });
    ui.list(S, { t0: 0.7, stagger: 0.35, y: 590, size: 44, mark: '■', markColor: '#c8f04a', items: it.rows.map((r, i) => `<span style="color:#${new THREE.Color(BAR[i]).getHexString()}">■</span> ${r.name}`) });
  }));

  E.defineScene('more', (S) => {
    real.room(S, { carpet: 0x2b2f3a, wood: 0x4b2f1a, width: 18, depth: 16, height: 8, key: 160, area: 4 });
    const globe = new THREE.Mesh(new THREE.SphereGeometry(1.1, 96, 64), new THREE.MeshPhysicalMaterial({ color: 0x1d3b66, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.1 }));
    globe.position.set(0, 2.0, 0); globe.castShadow = true; S.scene.add(globe);
    const stand = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.03, 12, 96, Math.PI * 1.2), kit.M.gold()); stand.position.copy(globe.position); stand.rotation.z = -0.4; S.scene.add(stand);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, 0.12, 48), kit.M.gold()); base.position.y = 0.06 + 0.7; S.scene.add(base);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 0.7, 48), real.pbr(real.tex.marble(), { repeat: [1, 1], clearcoat: 1 })); ped.position.y = 0.35; S.scene.add(ped);
    const pins = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 12, 8), new THREE.MeshBasicMaterial({ color: 0xc8f04a }), 60);
    const r = E.rng(3), m4 = new THREE.Matrix4(), v = new THREE.Vector3();
    for (let i = 0; i < 60; i++) { v.setFromSphericalCoords(1.11, Math.acos(2 * r() - 1) * 0.8 + 0.3, r() * Math.PI * 2); m4.makeTranslation(v.x, v.y, v.z); pins.setMatrixAt(i, m4); }
    globe.add(pins);
    E.camPath(S, [{ t: 0, pos: [0, 2.8, 8.4], look: [0, 1.8, 0], fov: 32 }, { t: S.dur, pos: [0.4, 2.7, 7.6], look: [0, 1.8, 0], fov: 32 }], { shake: 0.012, shiftY: 360, focusOn: true });
    S.aperture = 0.45;
    S.update((lt) => { globe.rotation.y = lt * 0.5; });
    ui.kicker(S, { t0: 0.05, text: 'On PolTok', y: 372 });
    ui.headline(S, { t0: 0.15, html: 'Every national vote, <em>mapped</em>', y: 428, size: 100, style: 'rise' });
    ui.block(S, { t0: 1.4, html: '<b style="color:#c8f04a">Follow</b> for a weekly world roundup →', cls: 'body', y: 640, w: 900, size: 42 });
  });

  E.defineScene('end', (S) => endCard(S, { title: 'See the <em>world</em>', sub: 'poltok.netlify.app/world', sources: `Results: each election's Wikipedia article (unofficial, community-edited), via PolTok, as of ${d.asOf}.` }));
}
