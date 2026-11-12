// Reel — "What if the Voice had passed?" Facts only: the 14 Oct 2023 referendum on the Constitution Alteration
// (Aboriginal and Torres Strait Islander Voice) 2023. Proposed s 129: the Voice "may make representations to the
// Parliament and the Executive Government of the Commonwealth on matters relating to Aboriginal and Torres Strait Islander
// peoples"; Parliament would have power to make laws about its composition, functions, powers and procedures. Advisory
// only — no veto. Result (AEC): No 60.06%, Yes 39.94%; all six states No; the ACT voted Yes. Referendums since 1901:
// 45 held, 8 carried. The counterfactual is left to the viewer — the reel states what the proposal was and what happened.

export const meta = {
  title: 'What if the Voice had passed?',
  label: 'WHAT IF · HISTORY',
  out: 'poltok-what-if-voice',
  cover: 1.6,
  music: { prog: ['Em', 'C', 'G', 'D'], arp: 'up', seed: 197, swing: 0.03 },
};

export const scenes = () => [
  { id: 'hook', beats: 6, energy: 3, voLead: 0.08, say: 'What if the Voice had passed?' },
  { id: 'what', beats: 9, energy: 2, trans: { type: 'zoom', dur: 0.45 },
    say: 'In October twenty twenty-three, Australians voted on adding an Indigenous Voice to Parliament to the Constitution.',
    cap: '14 Oct 2023: a referendum on an Aboriginal and Torres Strait Islander Voice in the Constitution.' },
  { id: 'would', beats: 12, energy: 2, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: 'It would have been an advisory body. It could make representations to Parliament and the government. It couldn\'t veto laws. And Parliament would decide how it worked.',
    cap: 'An advisory body: could make representations, no veto. Parliament would set how it worked.' },
  { id: 'result', beats: 9, energy: 3, trans: { type: 'flash', dur: 0.36 },
    say: 'Instead, sixty percent voted No. Every state said No. Only the ACT said Yes.',
    cap: 'Result: No 60.06%, Yes 39.94%. All six states No; the ACT voted Yes.' },
  { id: 'history', beats: 8, energy: 2, trans: { type: 'whip', dir: 'up', dur: 0.42 },
    say: 'Australia has held forty-five referendums. Only eight have passed.',
    cap: '45 referendums since 1901. Only 8 passed.' },
  { id: 'ask', beats: 8, energy: 2, trans: { type: 'zoom', dur: 0.45 },
    say: 'Would you vote the same way today? Tell me in the comments.', cap: 'Would you vote the same way today? 👇' },
  { id: 'end', beats: 6, energy: 0, trans: { type: 'zoom', dur: 0.5 }, noProgress: true },
];

export function build({ E, kit, ui, THREE, endCard, real }) {
  const { C, ease, remap } = E;
  const YES = '#5fd17f', NO = '#ff6b6b';

  const paper = (draw) => real.sheet(1.5, 2.0, draw);
  const docPage = (title, sub) => paper((c, w) => {
    c.fillStyle = 'rgba(20,18,15,.85)'; c.font = '700 32px "Inter Tight"'; c.fillText('PROPOSED LAW · 2023', 60, 100); c.fillRect(60, 118, w - 120, 4);
    c.font = '800 80px Newsreader'; const words = title.split(' '); let line = '', y = 240;
    for (const wd of words) { const t = line ? line + ' ' + wd : wd; if (c.measureText(t).width > w - 120 && line) { c.fillText(line, 60, y); line = wd; y += 88; } else line = t; }
    c.fillText(line, 60, y);
    c.font = '500 38px Newsreader'; c.fillStyle = 'rgba(20,18,15,.65)'; c.fillText(sub, 60, y + 66);
    c.fillStyle = 'rgba(20,18,15,.16)'; for (let l = 0; l < 16; l++) c.fillRect(60, y + 120 + l * 46, w - 120 - (l % 4) * 70, 14);
  });
  const ballot = () => paper((c, w) => {
    c.fillStyle = 'rgba(20,18,15,.85)'; c.font = '800 54px "Inter Tight"'; c.textAlign = 'center'; c.fillText('REFERENDUM BALLOT PAPER', w / 2, 120);
    c.font = '500 34px Newsreader'; c.fillText('Write "Yes" or "No" in the space provided', w / 2, 190);
    c.strokeStyle = 'rgba(20,18,15,.7)'; c.lineWidth = 5; c.strokeRect(w / 2 - 200, 300, 400, 220);
    c.fillStyle = 'rgba(20,18,15,.18)'; for (let l = 0; l < 6; l++) c.fillRect(90, 600 + l * 50, w - 180 - (l % 3) * 80, 14);
    c.textAlign = 'left';
  });

  const desk = (S, pages, o = {}) => {
    real.room(S, { carpet: 0x2b2d3a, wood: 0x4a3020, width: 16, depth: 14, height: 7, key: o.key ?? 100, area: 2.4, fill: 0.28 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.16, 3.8), real.pbr(real.tex.wood(0x5c3a20), { repeat: [2, 1], clearcoat: 0.7, clearcoatRoughness: 0.2 }));
    top.position.set(0, 1.0, 0); top.receiveShadow = true; top.castShadow = true; S.scene.add(top);
    const ms = pages.map((p, i) => { p.rotation.x = -Math.PI / 2; p.rotation.z = (i - (pages.length - 1) / 2) * 0.1; p.position.set((i - (pages.length - 1) / 2) * 0.32, 1.09 + i * 0.012, (pages.length - 1 - i) * -0.18); S.scene.add(p); return p; });
    const at = o.at ?? ((i) => 0.25 + i * 0.7);
    ms.forEach((_, i) => E.cue(S.t0 + at(i) + 0.35, 'pop', { i }));
    S.update((lt) => ms.forEach((p, i) => { const k = ease.expo(remap(lt, at(i), at(i) + 0.5)); p.position.y = 1.09 + i * 0.012 + (1 - k) * 2.6; p.visible = k > 0.01; }));
    E.camPath(S, [{ t: 0, pos: [0, 5.3, 3.3], look: [0, 1.1, -0.1], fov: 34 }, { t: S.dur, pos: [0.25, 4.9, 3.0], look: [0, 1.1, -0.1], fov: 34 }], { shake: 0.012, shiftY: 470, focusOn: true });
    S.aperture = 0.35;
  };

  E.defineScene('hook', (S) => {
    desk(S, [ballot()], { at: () => 0.05 });
    E.cue(S.t0 + 0.3, 'boom', { g: 0.7 });
    ui.kicker(S, { t0: 0, text: 'Referendum · 14 October 2023', y: 372 });
    ui.headline(S, { t0: 0, html: 'What if the Voice <em>had passed?</em>', y: 410, size: 92, style: 'slam', stagger: 0.04, t1: S.dur + 1 });
  });

  E.defineScene('what', (S) => {
    desk(S, [docPage('Constitution Alteration (Voice) 2023', 'A proposed law to alter the Constitution')], { at: () => 0.2 });
    ui.kicker(S, { t0: 0.05, text: 'The question', y: 372 });
    ui.block(S, { t0: 0.3, html: 'Add an <b>Aboriginal and Torres Strait Islander Voice</b> to the Constitution?', cls: 'body', y: 420, w: 920, size: 50 });
  });

  E.defineScene('would', (S) => {
    desk(S, [docPage('Chapter IX: Recognition', 'Proposed section 129')], { at: () => 0.2 });
    ui.kicker(S, { t0: 0.05, text: 'What it would have been', y: 372 });
    ui.list(S, { t0: 0.4, stagger: 1.4, y: 420, w: 900, size: 44, mark: '●', markColor: '#c8f04a', items: [
      'An <b>advisory</b> body',
      'Could make <b>representations</b> to Parliament and government',
      '<b>No veto</b> over laws',
      '<b>Parliament</b> decides how it works',
    ] });
  });

  E.defineScene('result', (S) => {
    desk(S, [docPage('Referendum Result', 'Australian Electoral Commission')], { at: () => 0.2, key: 90 });
    ui.kicker(S, { t0: 0.05, text: 'What actually happened', y: 372 });
    ui.counter(S, { t0: 0.3, dur: 1.2, to: 60.06, decimals: 2, suffix: '%', y: 400, x: 80, w: 440, size: 120, color: NO, label: 'No' });
    ui.counter(S, { t0: 0.5, dur: 1.2, to: 39.94, decimals: 2, suffix: '%', y: 400, x: 540, w: 460, size: 120, align: 'right', color: YES, label: 'Yes', ticks: false });
    ui.block(S, { t0: 1.9, html: '<b>All six states</b> voted No · only the <b>ACT</b> voted Yes', cls: 'body', y: 600, align: 'center', size: 40 });
  });

  E.defineScene('history', (S) => {
    desk(S, [docPage('Referendums since 1901', '45 held')], { at: () => 0.2 });
    ui.kicker(S, { t0: 0.05, text: 'A hard thing to pass', y: 372 });
    ui.counter(S, { t0: 0.3, dur: 1.2, to: 8, y: 400, size: 200, color: '#c8f04a', label: 'of 45 referendums have passed', suffix: '<span style="font-size:.4em;color:#b7bfcd"> / 45</span>' });
  });

  E.defineScene('ask', (S) => {
    desk(S, [ballot()], { at: () => 0.1, key: 110 });
    ui.kicker(S, { t0: 0.05, text: 'Your turn', y: 372 });
    ui.headline(S, { t0: 0.1, html: 'Would you vote <em>the same way</em> today?', y: 410, size: 88, style: 'rise' });
    ui.block(S, { t0: 0.9, html: '<b style="color:#c8f04a">Comment</b> 👇 &nbsp;·&nbsp; <b>Follow</b> for more what-ifs', cls: 'body', y: 640, w: 920, size: 42 });
  });

  E.defineScene('end', (S) => endCard(S, { title: 'More <em>what ifs</em>', sub: 'poltok.netlify.app', sources: 'Sources: Constitution Alteration (Aboriginal and Torres Strait Islander Voice) 2023; AEC referendum results (14 Oct 2023).<br>Documents shown are illustrative.' }));
}
