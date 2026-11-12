// Reel — "What if voting wasn't compulsory?" Victoria's real 2022 turnout (VEC: turnout ÷ enrolment, summed across all 88
// districts in src/data/au-vic.ts) against the UK's 2024 general election turnout (59.7%, voluntary voting). The
// "fewer voters" figure is simple arithmetic: enrolment × (Vic turnout − UK turnout). It's a what-if, not a forecast.
// Compulsory voting: federal since 1924; Victorian Legislative Assembly since 1926.

const UK_2024 = 59.7;

export async function data() {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../../../src/data/au-vic.ts', import.meta.url), 'utf8');
  const m = src.match(/VIC_RESULTS_2022[^=]*=\s*(\{.*?\});\n/s);
  if (!m) throw new Error('could not read VIC_RESULTS_2022');
  let enrol = 0, turnout = 0;
  for (const r of Object.values(JSON.parse(m[1]))) { enrol += r.enrol || 0; turnout += r.turnout || 0; }
  const vic = +(100 * turnout / enrol).toFixed(1);
  const fewer = Math.round(enrol * (vic - UK_2024) / 100);
  return { enrol, turnout, vic, uk: UK_2024, fewer, fewerM: +(fewer / 1e6).toFixed(2) };
}

export const meta = {
  title: 'What if voting wasn\'t compulsory?',
  label: 'WHAT IF · ELECTION RULES',
  out: 'poltok-what-if-voluntary-voting',
  cover: 1.6,
  music: { prog: ['Dm', 'Bb', 'F', 'C'], arp: 'up', seed: 183, swing: 0.04 },
};

export const scenes = (d) => [
  { id: 'hook', beats: 6, energy: 3, voLead: 0.08, say: 'What if you didn\'t have to vote?' },
  { id: 'now', beats: 8, energy: 2, trans: { type: 'zoom', dur: 0.45 },
    say: `At Victoria's last election, ${Math.round(d.vic)} percent of people on the roll voted.`,
    cap: `Victoria 2022: ${d.vic}% of enrolled voters turned out.` },
  { id: 'uk', beats: 8, energy: 3, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: 'In the UK, where voting is voluntary, it was under sixty percent.',
    cap: `UK 2024 general election (voluntary): ${d.uk}% turnout.` },
  { id: 'gap', beats: 10, energy: 3, trans: { type: 'flash', dur: 0.36 },
    say: `At UK turnout, about ${d.fewerM.toFixed(1).replace('.', ' point ')} million fewer Victorians would vote.`,
    cap: `At UK turnout: about ${(d.fewer).toLocaleString('en-AU')} fewer Victorian voters.` },
  { id: 'camp', beats: 8, energy: 2, trans: { type: 'whip', dir: 'up', dur: 0.42 },
    say: 'And campaigns would change. Winning would mean getting your own voters to turn up.',
    cap: 'Campaigns would be about getting your own side to turn up.' },
  { id: 'ask', beats: 8, energy: 2, trans: { type: 'zoom', dur: 0.45 },
    say: 'So, should voting be compulsory? Yes or no, in the comments.', cap: 'Should voting be compulsory? Yes or no 👇' },
  { id: 'end', beats: 6, energy: 0, trans: { type: 'zoom', dur: 0.5 }, noProgress: true },
];

export function build({ E, kit, ui, THREE, endCard, real }) {
  const { C, ease, remap } = E;
  const d = E.data;
  // a crowd of 100 figures standing in a hall: each one is 1% of enrolled voters
  const crowd = (S, o = {}) => {
    real.room(S, { carpet: 0x2a2d3a, wood: 0x4e3320, width: 20, depth: 18, height: 8, key: o.key ?? 160, area: 3, fill: 0.3 });
    const geo = kit.pawnGeometry(0.42);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0.05 });
    const mesh = new THREE.InstancedMesh(geo, mat, 100); mesh.castShadow = true; mesh.receiveShadow = true;
    const m4 = new THREE.Matrix4(), col = new THREE.Color();
    for (let i = 0; i < 100; i++) {
      const x = (i % 10) - 4.5, z = Math.floor(i / 10) - 4.5;
      m4.makeTranslation(x * 0.62 + Math.sin(i * 3.7) * 0.06, 0, z * 0.62 + Math.cos(i * 2.1) * 0.06);
      mesh.setMatrixAt(i, m4); mesh.setColorAt(i, col.set(0xc8f04a));
    }
    S.scene.add(mesh);
    // the order people "drop out" in (scattered, deterministic)
    const ord = Array.from({ length: 100 }, (_, i) => i).sort((a, b) => Math.sin(a * 91.7) - Math.sin(b * 91.7));
    const rank = new Array(100); ord.forEach((s, j) => { rank[s] = j; });
    return {
      show(pct, k = 1) { for (let i = 0; i < 100; i++) { const on = rank[i] < pct; mesh.setColorAt(i, col.set(on ? 0xc8f04a : 0x3a3f4c).multiplyScalar(on ? 1 : 0.6 + 0.4 * (1 - k))); } mesh.instanceColor.needsUpdate = true; },
    };
  };
  const CAM = [{ t: 0, pos: [0, 7.5, 8.5], look: [0, 0.2, 0], fov: 40 }, { t: 6, pos: [0.6, 6.8, 7.6], look: [0, 0.2, 0], fov: 40 }];

  E.defineScene('hook', (S) => {
    const c = crowd(S);
    E.camPath(S, [{ t: 0, pos: [0, 1.6, 6.5], look: [0, 0.6, 0], fov: 38 }, { t: S.dur + 0.4, pos: [0, 5.5, 8.5], look: [0, 0.3, 0], fov: 38 }], { shake: 0.02, shiftY: 260, focusOn: true });
    S.aperture = 0.4;
    E.cue(S.t0 + 0.3, 'boom', { g: 0.7 });
    S.update((lt) => c.show(100 - 40 * ease.inOut(remap(lt, 0.5, 2.5))));
    ui.kicker(S, { t0: 0, text: 'Australia: compulsory since 1924', y: 372 });
    ui.headline(S, { t0: 0, html: 'What if you <em>didn\'t have to</em> vote?', y: 410, size: 92, style: 'slam', stagger: 0.04, t1: S.dur + 1 });
  });

  E.defineScene('now', (S) => {
    const c = crowd(S);
    E.camPath(S, CAM, { shake: 0.015, shiftY: 300, focusOn: true });
    S.aperture = 0.25;
    S.update((lt) => c.show(Math.round(d.vic * ease.inOut(remap(lt, 0.2, 1.4)))));
    ui.kicker(S, { t0: 0.05, text: 'Victoria 2022 · compulsory', y: 372 });
    ui.counter(S, { t0: 0.2, dur: 1.2, to: d.vic, decimals: 1, suffix: '%', y: 400, size: 190, color: '#c8f04a', label: 'of enrolled voters turned out' });
  });

  E.defineScene('uk', (S) => {
    const c = crowd(S);
    E.camPath(S, CAM, { shake: 0.015, shiftY: 300, focusOn: true });
    S.aperture = 0.25;
    S.update((lt) => c.show(Math.round(d.vic - (d.vic - d.uk) * ease.inOut(remap(lt, 0.3, 1.8))), 1));
    ui.kicker(S, { t0: 0.05, text: 'UK 2024 · voluntary', y: 372 });
    ui.counter(S, { t0: 0.3, dur: 1.5, from: d.vic, to: d.uk, decimals: 1, suffix: '%', y: 400, size: 190, color: '#ff8394', label: 'turnout at the UK general election' });
  });

  E.defineScene('gap', (S) => {
    const c = crowd(S);
    E.camPath(S, [{ t: 0, pos: [3.5, 4.2, 6.5], look: [0, 0.4, 0], fov: 38 }, { t: 6, pos: [2.0, 3.8, 5.6], look: [0, 0.4, 0], fov: 38 }], { shake: 0.015, shiftY: 300, focusOn: true });
    S.aperture = 0.5;
    S.update((lt) => c.show(Math.round(d.uk), 0.5 + 0.5 * Math.sin(lt * 4)));
    ui.kicker(S, { t0: 0.05, text: 'Victoria at UK turnout', y: 372 });
    ui.counter(S, { t0: 0.3, dur: 1.5, to: d.fewer, comma: true, y: 400, size: 150, color: '#ff8394', label: 'fewer Victorians voting' });
  });

  E.defineScene('camp', (S) => {
    const c = crowd(S, { key: 140 });
    E.camPath(S, [{ t: 0, pos: [-3.5, 3.4, 6], look: [0, 0.6, 0], fov: 38 }, { t: 6, pos: [-1.8, 3.0, 5.0], look: [0, 0.6, 0], fov: 38 }], { shake: 0.015, shiftY: 300, focusOn: true });
    S.aperture = 0.5;
    S.update((lt) => c.show(Math.round(d.uk + 12 * Math.abs(Math.sin(lt * 1.5)))));
    ui.kicker(S, { t0: 0.05, text: 'Campaigns change too', y: 372 });
    ui.headline(S, { t0: 0.1, html: 'Turnout becomes <em>the game</em>', y: 410, size: 96, style: 'rise' });
    ui.block(S, { t0: 0.9, html: 'Winning means getting <b>your side</b> to show up, not just changing minds', cls: 'body', y: 600, w: 900, size: 42 });
  });

  E.defineScene('ask', (S) => {
    const c = crowd(S, { key: 180 });
    E.camPath(S, CAM, { shake: 0.015, shiftY: 300, focusOn: true });
    S.aperture = 0.25;
    S.update((lt) => c.show(Math.round(75 + 13 * Math.sin(lt * 2))));
    ui.kicker(S, { t0: 0.05, text: 'Your call', y: 372 });
    ui.headline(S, { t0: 0.1, html: 'Should voting be <em>compulsory?</em>', y: 410, size: 96, style: 'rise' });
    ui.block(S, { t0: 0.9, html: '<b style="color:#c8f04a">Yes</b> or <b style="color:#ff6b6b">no</b> in the comments 👇', cls: 'body', y: 640, w: 920, size: 46 });
  });

  E.defineScene('end', (S) => endCard(S, { title: 'Follow it <em>live</em>', sub: 'poltok.netlify.app', sources: 'Turnout: VEC 2022 Victorian state election (turnout ÷ enrolment, all 88 districts); UK 2024 general election 59.7%.<br>"Fewer voters" is simple arithmetic, not a forecast. Each figure = 1% of enrolled voters.' }));
}
