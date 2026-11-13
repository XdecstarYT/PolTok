// Reel (viral, non-partisan) — "93 people decided this seat." The closest 2022 Victorian seats by raw votes, from the VEC
// two-candidate counts in src/data/au-vic.ts (only districts whose `final` really is a 2-candidate result are used).
// "People to flip" = floor(gap / 2) + 1. Non-voters = enrolment − turnout. Informal = VEC informal count. Parties only; no names.

export async function data() {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../../../src/data/au-vic.ts', import.meta.url), 'utf8');
  const m = src.match(/VIC_RESULTS_2022[^=]*=\s*(\{.*?\});\n/s);
  if (!m) throw new Error('could not read VIC_RESULTS_2022');
  const P = { ALP: 'Labor', LIB: 'Liberal', NAT: 'Nationals', GRN: 'Greens', IND: 'an independent' };
  const title = (k) => k.replace(/^vic-/, '').split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
  const rows = Object.entries(JSON.parse(m[1])).filter(([, r]) => r.final?.length === 2).map(([k, r]) => {
    const [a, b] = [...r.final].sort((x, y) => y.v - x.v);
    return { seat: title(k), gap: a.v - b.v, flip: Math.floor((a.v - b.v) / 2) + 1, win: P[a.p] || a.p, lose: P[b.p] || b.p,
      winPct: a.pct, losePct: b.pct, nonVoters: (r.enrol || 0) - (r.turnout || 0), informal: r.informal || 0, formal: r.formal || 0 };
  }).sort((x, y) => x.gap - y.gap);
  return { top: rows.slice(0, 3) };
}

export const meta = {
  title: 'This seat was decided by 184 votes',
  label: 'YOUR VOTE · 2022 RESULTS',
  out: 'poltok-viral-votes-matter',
  cover: 1.4,
  music: { prog: ['Em', 'C', 'G', 'D'], arp: 'up', seed: 251, swing: 0.03 },
};

const fmt = (n) => n.toLocaleString('en-AU');

export const scenes = (d) => {
  const [a, b, c] = d.top;
  return [
    { id: 'hook', beats: 6, energy: 3, voLead: 0.06, say: `${a.flip} people. That's all it would've taken to flip this seat.` },
    { id: 'seat', beats: 10, energy: 2, trans: { type: 'flash', dur: 0.36 },
      say: `${a.seat}, twenty twenty-two. ${a.win} beat the ${a.lose} by ${a.gap} votes, out of more than ${Math.floor(a.formal / 1000)} thousand.`,
      cap: `${a.seat} 2022: ${a.win} beat the ${a.lose} by ${a.gap} votes, out of ${fmt(a.formal)}.` },
    { id: 'didnt', beats: 10, energy: 3, trans: { type: 'whip', dir: 'left', dur: 0.42 },
      say: `Meanwhile, ${fmt(a.nonVoters)} people on the roll there didn't vote at all.`,
      cap: `${fmt(a.nonVoters)} enrolled people in ${a.seat} didn't vote.` },
    { id: 'more', beats: 10, energy: 3, trans: { type: 'whip', dir: 'left', dur: 0.42 },
      say: `And it's not just there. ${b.seat}, ${b.gap} votes. ${c.seat}, ${c.gap}.`,
      cap: `${b.seat}: ${b.gap} votes. ${c.seat}: ${c.gap} votes.` },
    { id: 'ask', beats: 9, energy: 2, trans: { type: 'zoom', dur: 0.45 },
      say: 'Still think your vote doesn\'t count? Tag someone who never votes.', cap: 'Still think your vote doesn\'t count? Tag someone who never votes 👇' },
    { id: 'end', beats: 6, energy: 0, trans: { type: 'zoom', dur: 0.5 }, noProgress: true },
  ];
};

export function build({ E, kit, ui, THREE, endCard, real }) {
  const { C, ease, remap } = E;
  const d = E.data;
  const [a, b, c] = d.top;
  const LIME = '#c8f04a';

  // 100 figures; lit ones stand for a share of people
  const crowd = (S, o = {}) => {
    real.room(S, { carpet: 0x2a2d3a, wood: 0x4e3320, width: 20, depth: 18, height: 8, key: o.key ?? 160, area: 3, fill: 0.3 });
    const geo = kit.pawnGeometry(0.42);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0.05 });
    const mesh = new THREE.InstancedMesh(geo, mat, 100); mesh.castShadow = true; mesh.receiveShadow = true;
    const m4 = new THREE.Matrix4(), col = new THREE.Color();
    for (let i = 0; i < 100; i++) { const x = (i % 10) - 4.5, z = Math.floor(i / 10) - 4.5; m4.makeTranslation(x * 0.62 + Math.sin(i * 3.7) * 0.06, 0, z * 0.62 + Math.cos(i * 2.1) * 0.06); mesh.setMatrixAt(i, m4); mesh.setColorAt(i, col.set(0x3a3f4c)); }
    S.scene.add(mesh);
    const ord = Array.from({ length: 100 }, (_, i) => i).sort((p, q) => Math.sin(p * 91.7) - Math.sin(q * 91.7));
    const rank = new Array(100); ord.forEach((s, j) => { rank[s] = j; });
    return { show(n, color = 0xc8f04a, pulse = 0) { for (let i = 0; i < 100; i++) { const on = rank[i] < n; mesh.setColorAt(i, col.set(on ? color : 0x3a3f4c).multiplyScalar(on ? 0.75 + 0.4 * pulse : 0.6)); } mesh.instanceColor.needsUpdate = true; } };
  };
  const CAM = [{ t: 0, pos: [0, 7.5, 8.5], look: [0, 0.2, 0], fov: 40 }, { t: 6, pos: [0.6, 6.8, 7.6], look: [0, 0.2, 0], fov: 40 }];

  E.defineScene('hook', (S) => {
    const cw = crowd(S);
    E.camPath(S, [{ t: 0, pos: [0, 1.4, 5.5], look: [0, 0.6, 0], fov: 38 }, { t: S.dur + 0.4, pos: [0, 5.0, 8.0], look: [0, 0.3, 0], fov: 38 }], { shake: 0.02, shiftY: 260, focusOn: true });
    S.aperture = 0.45;
    E.cue(S.t0 + 0.2, 'boom', { g: 0.9 });
    S.update((lt) => cw.show(Math.min(100, Math.round(a.flip / 100 * 100 * ease.out(remap(lt, 0.1, 1.2)))), 0xc8f04a, 0.15 * Math.abs(Math.sin(lt * 4))));
    ui.kicker(S, { t0: 0, text: `${a.seat} · 2022 state election`, y: 372 });
    ui.headline(S, { t0: 0, html: `<em>${a.flip} people</em> could've flipped it`, y: 410, size: 96, style: 'slam', stagger: 0.04, t1: S.dur + 1 });
  });

  E.defineScene('seat', (S) => {
    const cw = crowd(S);
    E.camPath(S, CAM, { shake: 0.015, shiftY: 300, focusOn: true });
    S.aperture = 0.25;
    S.update(() => cw.show(Math.round(a.winPct), 0xe53935));
    ui.kicker(S, { t0: 0.05, text: `${a.seat} · ${a.win} v ${a.lose}`, y: 372 });
    ui.counter(S, { t0: 0.3, dur: 1.2, to: a.gap, y: 400, size: 220, color: LIME, label: `votes apart · out of ${fmt(a.formal)}` });
  });

  E.defineScene('didnt', (S) => {
    const cw = crowd(S);
    E.camPath(S, [{ t: 0, pos: [3.5, 4.2, 6.5], look: [0, 0.4, 0], fov: 38 }, { t: 6, pos: [2.0, 3.8, 5.6], look: [0, 0.4, 0], fov: 38 }], { shake: 0.015, shiftY: 300, focusOn: true });
    S.aperture = 0.5;
    S.update((lt) => cw.show(Math.round(100 * a.nonVoters / (a.nonVoters + a.formal + a.informal)), 0xff6b6b, Math.abs(Math.sin(lt * 3))));
    ui.kicker(S, { t0: 0.05, text: `Meanwhile, in ${a.seat}`, y: 372 });
    ui.counter(S, { t0: 0.3, dur: 1.4, to: a.nonVoters, comma: true, y: 400, size: 170, color: '#ff6b6b', label: 'people on the roll didn\'t vote' });
    ui.block(S, { t0: 2.0, html: `That's <b style="color:${LIME}">${Math.round(a.nonVoters / a.gap)}×</b> the winning margin`, cls: 'body', y: 640, align: 'center', size: 46 });
  });

  E.defineScene('more', (S) => {
    const cw = crowd(S, { key: 140 });
    E.camPath(S, CAM, { shake: 0.015, shiftY: 300, focusOn: true });
    S.aperture = 0.25;
    S.update((lt) => cw.show(lt < 2.2 ? Math.round(b.flip / 10) : Math.round(c.flip / 10), LIME === '#c8f04a' ? 0xc8f04a : 0xffffff, Math.abs(Math.sin(lt * 4))));
    ui.kicker(S, { t0: 0.05, text: 'Also in 2022', y: 372 });
    ui.list(S, { t0: 0.4, stagger: 1.4, y: 420, w: 900, size: 52, mark: '●', markColor: LIME, items: [
      `<b>${b.seat}</b> · <b style="color:${LIME}">${b.gap}</b> votes`,
      `<b>${c.seat}</b> · <b style="color:${LIME}">${c.gap}</b> votes`,
    ] });
  });

  E.defineScene('ask', (S) => {
    const cw = crowd(S, { key: 180 });
    E.camPath(S, CAM, { shake: 0.015, shiftY: 300, focusOn: true });
    S.aperture = 0.25;
    S.update((lt) => cw.show(Math.round(50 + 45 * Math.abs(Math.sin(lt * 1.5)))));
    ui.kicker(S, { t0: 0.05, text: 'Victoria votes 28 November', y: 372 });
    ui.headline(S, { t0: 0.1, html: 'Still think your vote <em>doesn\'t count?</em>', y: 410, size: 88, style: 'rise' });
    ui.block(S, { t0: 0.9, html: '<b style="color:#c8f04a">Tag someone</b> who never votes 👇', cls: 'body', y: 640, w: 920, size: 48 });
  });

  E.defineScene('end', (S) => endCard(S, { title: 'Every vote, <em>live</em>', sub: 'poltok.netlify.app/au/victoria', sources: 'Source: VEC 2022 Victorian state election, two-candidate counts, enrolment and turnout.<br>"People to flip" = half the margin plus one. Figures are illustrative of scale.' }));
}
