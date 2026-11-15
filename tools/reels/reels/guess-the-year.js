// Reel (viral quiz) — "Guess the year: Australian politics." Seven well-documented events; viewers guess, then the year
// is revealed. Within two years counts as a point.
// Compulsory federal voting: Commonwealth Electoral Act amendment, 1924. One Nation founded: April 1997. GST: 1 July 2000.
// Julia Gillard first female PM: June 2010. Same-sex marriage legal: Dec 2017. Morrison replaces Turnbull: Aug 2018.
// Voice referendum fails: 14 Oct 2023.

export async function data() { return {}; }

export const meta = {
  title: 'Guess the year',
  label: 'AUSTRALIA · QUIZ',
  out: 'poltok-guess-the-year',
  cover: 1.2,
  music: { prog: ['C', 'Am', 'F', 'G'], arp: 'up', seed: 419, swing: 0.05 },
};

// [card, spoken question, year, spoken year]
const Q = [
  ['Pauline Hanson founds One Nation', 'Pauline Hanson founds One Nation.', 1997, 'Nineteen ninety-seven.'],
  ['The GST starts', 'The GST starts.', 2000, 'Two thousand.'],
  ['Australia gets its first female PM', 'Australia gets its first female prime minister.', 2010, 'Twenty ten. Julia Gillard.'],
  ['Voting becomes compulsory', 'Voting becomes compulsory, for federal elections.', 1924, 'Nineteen twenty-four. Over a hundred years ago.'],
  ['Same-sex marriage becomes legal', 'Same-sex marriage becomes legal.', 2017, 'Twenty seventeen.'],
  ['Scott Morrison replaces Malcolm Turnbull', 'Scott Morrison replaces Malcolm Turnbull as prime minister.', 2018, 'Twenty eighteen.'],
  ['The Voice referendum is voted down', 'The Voice referendum is voted down.', 2023, 'Twenty twenty-three.'],
];

export const scenes = () => [
  { id: 'hook', beats: 6, energy: 3, voLead: 0.06, say: 'Guess the year. Seven moments in Australian politics. Within two years gets you a point.',
    cap: 'Guess the year 📅 Within 2 years = 1 point' },
  ...Q.flatMap(([card, q, yr, sy], i) => [
    { id: 'q' + i, beats: 9, energy: i % 2 ? 2 : 3, trans: { type: i % 2 ? 'whip' : 'flash', dir: 'left', dur: 0.36 }, say: q, cap: `${i + 1}/7 · ${card}` },
    { id: 'a' + i, beats: 4, energy: 3, trans: { type: 'flash', dur: 0.3 }, say: sy, cap: `${yr}` },
  ]),
  { id: 'ask', beats: 8, energy: 2, trans: { type: 'zoom', dur: 0.45 },
    say: 'How many did you get? Comment your score out of seven.', cap: 'Comment your score /7 👇' },
  { id: 'end', beats: 6, energy: 0, trans: { type: 'zoom', dur: 0.5 }, noProgress: true },
];

export function build({ E, kit, ui, THREE, endCard, real }) {
  const { ease, remap } = E;
  // a desk with a standing flip-card: "????" that flips to the year
  const desk = (S, yr, o = {}) => {
    real.room(S, { carpet: 0x2b2420, wood: 0x4e3320, width: 16, depth: 14, height: 7, key: (o.key ?? 110) * 0.3, area: 2.4, fill: 0.2 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(6, 0.16, 3.4), real.pbr(real.tex.wood(0x5c3a20), { repeat: [2, 1], clearcoat: 0.7, clearcoatRoughness: 0.2 }));
    top.position.set(0, 1.0, 0); top.receiveShadow = true; top.castShadow = true; S.scene.add(top);
    const face = (txt, col) => real.sheet(1.3, 0.8, (c, w, h) => {
      c.fillStyle = '#f2ead8'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#c8f04a'; c.fillRect(0, 0, w, 40); c.fillStyle = 'rgba(0,0,0,.15)'; c.fillRect(0, h / 2 - 2, w, 4);
      c.fillStyle = col; c.textAlign = 'center'; c.font = '800 330px "Inter Tight"'; c.fillText(txt, w / 2, h * 0.68);
    });
    const g = new THREE.Group();
    const stand = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 0.3), new THREE.MeshPhysicalMaterial({ color: 0x1d1d1d, roughness: 0.3, clearcoat: 1 }));
    stand.position.y = 0.03; stand.castShadow = true; g.add(stand);
    const q = face('????', '#3a3a3a'); q.position.set(0, 0.46, 0); q.castShadow = true; g.add(q);
    const a = yr ? face(String(yr), '#1b1b1b') : null; if (a) { a.position.set(0, 0.46, 0.002); a.visible = false; g.add(a); }
    g.position.set(0, 1.08, 0.1); g.rotation.x = -0.12; S.scene.add(g);
    E.camPath(S, o.cam ?? [{ t: 0, pos: [0, 2.0, 4.0], look: [0, 1.5, 0], fov: 36 }, { t: 6, pos: [0.25, 1.95, 3.6], look: [0, 1.5, 0], fov: 36 }], { shake: 0.012, shiftY: 280, focusOn: true });
    S.aperture = 0.3;
    // flip(k): 0 = "????" facing, 1 = year facing (card rotates about its horizontal axis)
    const flip = (k) => { const r = k * Math.PI; q.rotation.x = r; q.visible = k < 0.5; if (a) { a.rotation.x = r - Math.PI; a.visible = k >= 0.5; } };
    return { flip };
  };

  E.defineScene('hook', (S) => {
    const dk = desk(S, null, { cam: [{ t: 0, pos: [0, 1.7, 2.7], look: [0, 1.5, 0], fov: 36 }, { t: 4, pos: [0, 2.0, 4.0], look: [0, 1.5, 0], fov: 36 }] });
    E.cue(S.t0 + 0.3, 'boom', { g: 0.9 });
    S.update(() => dk.flip(0));
    ui.kicker(S, { t0: 0, text: 'Australian politics · 7 rounds', y: 372 });
    ui.headline(S, { t0: 0, html: 'Guess <em>the year</em>', y: 410, size: 120, style: 'slam', stagger: 0.04, t1: S.dur + 1 });
    ui.block(S, { t0: 0.5, html: 'Within 2 years = <b>1 point</b>', cls: 'body', y: 640, w: 920, size: 46, t1: S.dur + 1 });
  });

  Q.forEach(([card, , yr], i) => {
    E.defineScene('q' + i, (S) => {
      const dk = desk(S, yr, { key: 100 + (i % 3) * 15 });
      [2.3, 3.0, 3.7].forEach((t) => E.cue(S.t0 + t, 'tick', { k: 0.5 }));
      S.update(() => dk.flip(0));
      ui.kicker(S, { t0: 0.02, text: `Round ${i + 1} of ${Q.length}`, y: 372 });
      ui.headline(S, { t0: 0.08, html: card, y: 410, size: 80, style: 'rise' });
    });
    E.defineScene('a' + i, (S) => {
      const dk = desk(S, yr, { key: 140 });
      E.cue(S.t0 + 0.35, 'ding');
      S.update((lt) => dk.flip(ease.inOut(remap(lt, 0.05, 0.45))));
      ui.kicker(S, { t0: 0.02, text: `Round ${i + 1} · answer`, y: 372 });
      ui.headline(S, { t0: 0.3, html: `<em>${yr}</em>`, y: 410, size: 140, style: 'slam' });
      ui.block(S, { t0: 0.4, html: card, cls: 'body', y: 600, w: 920, size: 38 });
    });
  });

  E.defineScene('ask', (S) => {
    const dk = desk(S, null, { key: 120 });
    S.update(() => dk.flip(0));
    ui.kicker(S, { t0: 0.05, text: 'Final score', y: 372 });
    ui.headline(S, { t0: 0.1, html: 'How many did <em>you get?</em>', y: 410, size: 100, style: 'rise' });
    ui.block(S, { t0: 0.9, html: '<b>Comment your score</b> out of 7 👇', cls: 'body', y: 660, w: 920, size: 46 });
  });

  E.defineScene('end', (S) => endCard(S, { title: 'Politics, <em>explained</em>', sub: 'poltok.netlify.app', sources: 'Compulsory voting: Commonwealth Electoral Act 1924. One Nation founded April 1997. GST from 1 July 2000. Gillard PM June 2010. Marriage Amendment Act, Dec 2017. Morrison PM 24 Aug 2018. Voice referendum, 14 Oct 2023.' }));
}
