// Reel (viral) — "One Nation or the Greens: who's Australia's real third party?" Real numbers only.
// Victoria 2022 (VEC, src/data/au-vic.ts): Greens 11.5% statewide, 4 seats (Brunswick, Melbourne, Prahran, Richmond — all
// inner Melbourne); One Nation 0.3%, 0 seats. Now: live Victorian polls (vic-what-if.js) and national polls (au-what-if.js).
// ABC analysis (3 Oct 2026): One Nation's threat is mainly in regional Victoria and outer suburbs.

export async function data() {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../../../src/data/au-vic.ts', import.meta.url), 'utf8');
  const m = src.match(/VIC_RESULTS_2022[^=]*=\s*(\{.*?\});\n/s);
  if (!m) throw new Error('could not read VIC_RESULTS_2022');
  let grn = 0, onp = 0, tot = 0, grnSeats = 0;
  for (const r of Object.values(JSON.parse(m[1]))) {
    for (const c of r.fp || []) { tot += c.v; if (/Green/i.test(c.pn)) grn += c.v; if (/One Nation/i.test(c.pn)) onp += c.v; }
    const w = [...r.final].sort((a, b) => b.v - a.v)[0]; if (/Green/i.test(w.pn)) grnSeats++;
  }
  const { data: vic } = await import('./vic-what-if.js');
  const { data: au } = await import('./au-what-if.js');
  const [v, a] = await Promise.all([vic(), au()]);
  return { grn22: +(100 * grn / tot).toFixed(1), onp22: +(100 * onp / tot).toFixed(1), grnSeats,
    vic: { ONP: v.avg.ONP, GRN: v.avg.GRN }, au: { ONP: a.avg.ONP, GRN: a.avg.GRN } };
}

export const meta = {
  title: 'One Nation vs the Greens',
  label: 'THE BATTLE FOR THIRD',
  out: 'poltok-one-nation-vs-greens',
  cover: 1.4,
  music: { prog: ['Dm', 'Bb', 'F', 'C'], arp: 'updown', seed: 379, swing: 0.04 },
};

const R = Math.round;

export const scenes = (d) => [
  { id: 'hook', beats: 6, energy: 3, voLead: 0.06, say: 'One Nation or the Greens. Who\'s Australia\'s real third party?' },
  { id: 'then', beats: 11, energy: 2, trans: { type: 'zoom', dur: 0.45 },
    say: `At Victoria's last election, the Greens got ${R(d.grn22)} percent, and ${d.grnSeats === 4 ? 'four' : d.grnSeats} seats. One Nation got under one percent, and zero seats.`,
    cap: `Victoria 2022: Greens ${d.grn22}% and ${d.grnSeats} seats. One Nation ${d.onp22}%, 0 seats.` },
  { id: 'vic', beats: 9, energy: 3, trans: { type: 'flash', dur: 0.36 },
    say: `Now? In Victoria, One Nation's polling ${R(d.vic.ONP)}. The Greens, ${R(d.vic.GRN)}.`,
    cap: `Victoria now: One Nation ${d.vic.ONP}% · Greens ${d.vic.GRN}%.` },
  { id: 'au', beats: 9, energy: 3, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: `Nationally, the gap's even bigger. One Nation ${R(d.au.ONP)}. Greens ${R(d.au.GRN)}.`,
    cap: `Australia now: One Nation ${d.au.ONP}% · Greens ${d.au.GRN}%.` },
  { id: 'seats', beats: 11, energy: 2, trans: { type: 'whip', dir: 'up', dur: 0.42 },
    say: 'But votes aren\'t seats. All four Greens seats are in inner Melbourne. One Nation\'s best shots are in the regions and outer suburbs.',
    cap: 'Greens seats: Brunswick, Melbourne, Prahran, Richmond (inner Melbourne). One Nation\'s chances: regions and outer suburbs.' },
  { id: 'ask', beats: 8, energy: 2, trans: { type: 'zoom', dur: 0.45 },
    say: 'So, who\'s the real third party? One Nation, or the Greens? Comment below.', cap: 'One Nation or the Greens? Comment 👇' },
  { id: 'end', beats: 6, energy: 0, trans: { type: 'zoom', dur: 0.5 }, noProgress: true },
];

export function build({ E, kit, ui, THREE, endCard, real }) {
  const { C, ease, remap, lerp } = E;
  const d = E.data;
  const ONP = 0xd9480f, GRN = 0x2fa84f, OC = '#ff9a4a', GC = '#5fd17f';

  // two ballot stacks (One Nation left, Greens right), one sheet per percentage point
  const stacks = (S, o = {}) => {
    real.room(S, { carpet: 0x2b2420, wood: 0x4e3320, width: 16, depth: 14, height: 7, key: (o.key ?? 110) * 0.35, area: 2.4, fill: 0.22 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(6, 0.16, 3.4), real.pbr(real.tex.wood(0x5c3a20), { repeat: [2, 1], clearcoat: 0.7, clearcoatRoughness: 0.2 }));
    top.position.set(0, 1.0, 0); top.receiveShadow = true; top.castShadow = true; S.scene.add(top);
    const mk = (x, col) => {
      const g = new THREE.Group();
      for (let j = 0; j < 30; j++) { const s = real.sheet(0.6, 0.8, (c, w) => { c.fillStyle = '#e9e1cf'; c.fillRect(0, 0, w, 2000); c.fillStyle = 'rgba(30,30,30,.55)'; c.font = '600 60px "Inter Tight"'; c.fillText('BALLOT', 60, 120); c.fillStyle = '#' + new THREE.Color(col).getHexString(); c.fillRect(60, 160, w - 120, 22); }); s.rotation.x = -Math.PI / 2; s.rotation.z = Math.sin(j * 7.1) * 0.05; s.position.set(Math.sin(j * 3.3) * 0.015, j * 0.03, Math.cos(j * 2.1) * 0.015); g.add(s); }
      g.position.set(x, 1.09, 0); S.scene.add(g); return g;
    };
    const A = mk(-0.5, ONP), B = mk(0.5, GRN);
    E.camPath(S, o.cam ?? [{ t: 0, pos: [0, 2.7, 4.6], look: [0, 1.4, 0], fov: 36 }, { t: 6, pos: [0.2, 2.6, 4.2], look: [0, 1.4, 0], fov: 36 }], { shake: 0.012, shiftY: 260, focusOn: true });
    S.aperture = 0.35;
    const set = (g, v) => { const n = Math.round(v); g.children.forEach((c, i) => { c.visible = i < n; }); };
    if (!o.noTags) ui.tag3d(S, { at: new THREE.Vector3(-0.5, 2.25, 0.3), html: 'One Nation', cls: 'chip', t0: 0.6 });
    if (!o.noTags) ui.tag3d(S, { at: new THREE.Vector3(0.5, 2.25, 0.3), html: 'Greens', cls: 'chip', t0: 0.6 });
    return { set: (a, b) => { set(A, a); set(B, b); } };
  };

  E.defineScene('hook', (S) => {
    const st = stacks(S, { cam: [{ t: 0, pos: [0, 1.9, 2.6], look: [0, 1.5, 0], fov: 36 }, { t: 4, pos: [0.2, 2.7, 4.6], look: [0, 1.4, 0], fov: 36 }] });
    E.cue(S.t0 + 0.3, 'boom', { g: 0.9 });
    S.update((lt) => { const k = ease.inOut(remap(lt, 0.2, 2.2)); st.set(lerp(d.onp22, d.au.ONP, k), lerp(d.grn22, d.au.GRN, k)); });
    ui.kicker(S, { t0: 0, text: 'The battle for third', y: 372 });
    ui.headline(S, { t0: 0, html: `<span style="color:${OC}">One Nation</span> vs <span style="color:${GC}">Greens</span>`, y: 410, size: 92, style: 'slam', stagger: 0.04, t1: S.dur + 1 });
  });

  E.defineScene('then', (S) => {
    const st = stacks(S);
    S.update((lt) => { const k = ease.expo(remap(lt, 0.4, 1.6)); st.set(d.onp22 * k + (k > 0 ? 0.6 : 0), d.grn22 * k); });
    ui.kicker(S, { t0: 0.05, text: 'Victoria · 2022 election', y: 372 });
    ui.counter(S, { t0: 0.4, dur: 1.2, to: d.onp22, decimals: 1, suffix: '%', y: 400, x: 80, w: 440, size: 120, color: OC, label: 'One Nation · 0 seats' });
    ui.counter(S, { t0: 0.6, dur: 1.2, to: d.grn22, decimals: 1, suffix: '%', y: 400, x: 540, w: 460, size: 120, align: 'right', color: GC, label: `Greens · ${d.grnSeats} seats`, ticks: false });
  });

  E.defineScene('vic', (S) => {
    const st = stacks(S, { key: 130 });
    E.cue(S.t0 + 1.2, 'boom', { g: 0.5 });
    S.update((lt) => { const k = ease.inOut(remap(lt, 0.4, 2.0)); st.set(lerp(d.onp22, d.vic.ONP, k), lerp(d.grn22, d.vic.GRN, k)); });
    ui.kicker(S, { t0: 0.05, text: 'Victoria · latest polls', y: 372 });
    ui.counter(S, { t0: 0.4, dur: 1.6, from: d.onp22, to: d.vic.ONP, decimals: 1, suffix: '%', y: 400, x: 80, w: 440, size: 120, color: OC, label: 'One Nation' });
    ui.counter(S, { t0: 0.4, dur: 1.6, from: d.grn22, to: d.vic.GRN, decimals: 1, suffix: '%', y: 400, x: 540, w: 460, size: 120, align: 'right', color: GC, label: 'Greens', ticks: false });
  });

  E.defineScene('au', (S) => {
    const st = stacks(S, { key: 140 });
    S.update((lt) => { const k = ease.inOut(remap(lt, 0.3, 1.6)); st.set(lerp(d.vic.ONP, d.au.ONP, k), lerp(d.vic.GRN, d.au.GRN, k)); });
    ui.kicker(S, { t0: 0.05, text: 'Australia · latest national polls', y: 372 });
    ui.counter(S, { t0: 0.4, dur: 1.2, from: d.vic.ONP, to: d.au.ONP, decimals: 1, suffix: '%', y: 400, x: 80, w: 440, size: 120, color: OC, label: 'One Nation' });
    ui.counter(S, { t0: 0.4, dur: 1.2, from: d.vic.GRN, to: d.au.GRN, decimals: 1, suffix: '%', y: 400, x: 540, w: 460, size: 120, align: 'right', color: GC, label: 'Greens', ticks: false });
  });

  E.defineScene('seats', (S) => {
    real.room(S, { carpet: 0x2d4a33, wood: 0x5a361d, width: 30, depth: 26, height: 10, key: 260 });
    const N = 88; const ch = real.chamber(N, { rows: 5, r0: 3.4, r1: 7.6, leather: 0x1f5a38, wood: 0x6a3d1f, open: 0.6 }); S.scene.add(ch.group);
    E.camPath(S, [{ t: 0, pos: [0, 12, 13.5], look: [0, 0, -2.5], fov: 44 }, { t: 6, pos: [0, 11, 12.5], look: [0, 0.3, -2.8], fov: 44 }], { shake: 0.015, shiftY: 300, focusOn: true });
    S.aperture = 0.1;
    S.update((lt) => { for (let i = 0; i < N; i++) { const g = i < 4; ch.set(i, g ? GRN : 0xffe2b0, g ? 1.4 + 0.5 * Math.abs(Math.sin(lt * 4)) : 0.2); } ch.commit(); });
    ui.kicker(S, { t0: 0.05, text: 'Votes aren\'t seats', y: 372 });
    ui.list(S, { t0: 0.4, stagger: 1.6, y: 420, w: 900, size: 42, mark: '●', markColor: '#c8f04a', items: [
      `<b style="color:${GC}">Greens:</b> 4 seats, all inner Melbourne`, `<b style="color:${OC}">One Nation:</b> best chances in the regions and outer suburbs`] });
  });

  E.defineScene('ask', (S) => {
    const st = stacks(S, { key: 120, noTags: true });
    S.update((lt) => { const k = (Math.sin(lt * 1.6) + 1) / 2; st.set(lerp(d.au.ONP, d.au.GRN, k), lerp(d.au.GRN, d.au.ONP, k)); });
    ui.kicker(S, { t0: 0.05, text: 'Your call', y: 372 });
    ui.headline(S, { t0: 0.1, html: 'Who\'s the real <em>third party?</em>', y: 410, size: 96, style: 'rise' });
    ui.block(S, { t0: 0.9, html: `Comment <b style="color:${OC}">One Nation</b> or <b style="color:${GC}">Greens</b> 👇`, cls: 'body', y: 640, w: 920, size: 46 });
  });

  E.defineScene('end', (S) => endCard(S, { title: 'Polls, <em>live</em>', sub: 'poltok.netlify.app', sources: 'Victoria 2022: VEC first preferences and seats. Polls: latest 4 Victorian and national polls (Wikipedia). ABC analysis (3 Oct 2026).<br>Stacks: one ballot per percentage point.' }));
}
