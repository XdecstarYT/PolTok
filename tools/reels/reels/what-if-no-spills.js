// Reel (history flip) — "What if the leadership knifings never happened?" Real: Rudd (June 2010), Gillard (June 2013),
// Abbott (Sept 2015), Turnbull (Aug 2018) all removed by their own party; Morrison sworn in as the sixth PM in a decade
// (SBS). Labor changed its leadership rules in 2013 (Rudd); the Liberals adopted a two-thirds party-room threshold to
// remove a sitting PM who has won an election (3 Dec 2018). Sussan Ley lost a party-room ballot to Angus Taylor, 34–17,
// on 13 Feb 2026 (ABC via The Star; Barton Deakin). The middle section is clearly labelled imagined.

export async function data() { return {}; }

export const meta = {
  title: 'What if the knifings never happened?',
  label: 'HISTORY FLIP',
  out: 'poltok-what-if-no-spills',
  cover: 1.3,
  music: { prog: ['Dm', 'Bb', 'Gm', 'A'], arp: 'updown', seed: 409, swing: 0.04 },
};

const PMS = [['Rudd', 'ALP', '2007'], ['Gillard', 'ALP', '2010'], ['Rudd', 'ALP', '2013'], ['Abbott', 'LNP', '2013'], ['Turnbull', 'LNP', '2015'], ['Morrison', 'LNP', '2018']];

export const scenes = () => [
  { id: 'hook', beats: 6, energy: 3, voLead: 0.08, say: 'What if Australia\'s leadership knifings never happened?', cap: 'What if the knifings never happened? 🔪' },
  { id: 'real', beats: 12, energy: 3, trans: { type: 'zoom', dur: 0.45 },
    say: 'Between twenty ten and twenty eighteen, four prime ministers were dumped by their own party. Rudd. Gillard. Abbott. Turnbull. Six prime ministers in about a decade.',
    cap: '2010–2018: Rudd, Gillard, Abbott, Turnbull, all dumped by their own party.' },
  { id: 'imag1', beats: 11, energy: 2, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: 'Now imagine no spills. Kevin Rudd faces voters himself in twenty ten. Julia Gillard might never become prime minister.',
    cap: 'IMAGINED: Rudd faces the 2010 election himself.' },
  { id: 'imag2', beats: 11, energy: 2, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: 'Tony Abbott leads the Coalition into twenty sixteen. Malcolm Turnbull may never get the top job. And Scott Morrison? Possibly never prime minister at all.',
    cap: 'IMAGINED: Abbott into 2016. No Turnbull. No Morrison.' },
  { id: 'rules', beats: 11, energy: 3, trans: { type: 'flash', dur: 0.36 },
    say: 'In real life, both big parties changed their rules. Labor in twenty thirteen. The Liberals in twenty eighteen: two thirds of the party room, to dump a prime minister who won an election.',
    cap: 'Labor changed its rules in 2013. Liberals in Dec 2018: two-thirds to dump an election-winning PM.' },
  { id: 'since', beats: 10, energy: 3, trans: { type: 'whip', dir: 'up', dur: 0.42 },
    say: 'No sitting prime minister has been knifed since. But in February, the Liberals still dumped Sussan Ley as opposition leader. Thirty four votes to seventeen.',
    cap: 'Feb 2026: Sussan Ley dumped as Liberal leader, 34–17.' },
  { id: 'ask', beats: 8, energy: 2, trans: { type: 'zoom', dur: 0.45 },
    say: 'So, should a party be allowed to dump the prime minister you voted for? Yes, or no?', cap: 'Should parties be able to dump your PM? Yes or no 👇' },
  { id: 'end', beats: 6, energy: 0, trans: { type: 'zoom', dur: 0.5 }, noProgress: true },
];

export function build({ E, kit, ui, THREE, endCard, real }) {
  const { ease, remap } = E;
  const COL = { ALP: 0xc62828, LNP: 0x1f4fb1 };
  const CSS = { ALP: '#ff6b6b', LNP: '#6ea2ff' };

  // a desk with six standing name plaques that topple like dominoes
  const desk = (S, o = {}) => {
    real.room(S, { carpet: 0x2b2420, wood: 0x4e3320, width: 16, depth: 14, height: 7, key: (o.key ?? 110) * 0.3, area: 2.4, fill: 0.2 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(6, 0.16, 3.4), real.pbr(real.tex.wood(0x5c3a20), { repeat: [2, 1], clearcoat: 0.7, clearcoatRoughness: 0.2 }));
    top.position.set(0, 1.0, 0); top.receiveShadow = true; top.castShadow = true; S.scene.add(top);
    const riser = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.3, 0.5), real.pbr(real.tex.wood(0x3e2614), { repeat: [1, 1], clearcoat: 0.6 }));
    riser.position.set(0, 1.23, -0.25); riser.castShadow = true; riser.receiveShadow = true; S.scene.add(riser);
    const plaques = PMS.map(([name, p, yr], i) => {
      const g = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.05, 0.16), new THREE.MeshPhysicalMaterial({ color: 0x2a1a10, roughness: 0.35, clearcoat: 1 }));
      base.position.y = 0.025; base.castShadow = true; g.add(base);
      const card = real.sheet(0.58, 0.36, (c, w, h) => {
        c.fillStyle = '#f2ead8'; c.fillRect(0, 0, w, h);
        c.fillStyle = '#' + new THREE.Color(COL[p]).getHexString(); c.fillRect(0, 0, w, 50);
        c.fillStyle = '#1b1b1b'; c.textAlign = 'center'; c.font = '700 150px "Fraunces", serif'; c.fillText(name, w / 2, h * 0.62);
        c.font = '600 64px "Inter Tight"'; c.fillStyle = '#555'; c.fillText(yr, w / 2, h * 0.88);
      });
      card.position.set(0, 0.23, 0); card.castShadow = true; g.add(card);
      g.position.set(((i % 3) - 1) * 0.66, i < 3 ? 1.08 : 1.38, i < 3 ? 0.55 : -0.25); S.scene.add(g); return g;
    });
    E.camPath(S, o.cam ?? [{ t: 0, pos: [0, 2.7, 5.6], look: [0, 1.2, 0], fov: 36 }, { t: 7, pos: [0.3, 2.6, 5.2], look: [0, 1.2, 0], fov: 36 }], { shake: 0.012, shiftY: 280, focusOn: true });
    S.aperture = 0.3;
    // tip(i, k): k 0 = standing, 1 = flat on its back
    const tip = (i, k) => { plaques[i].rotation.x = -k * Math.PI / 2 * 0.92; };
    return { plaques, tip };
  };
  const DUMPED = [0, 1, 3, 4]; // Rudd 2010, Gillard 2013, Abbott 2015, Turnbull 2018

  E.defineScene('hook', (S) => {
    const dk = desk(S, { cam: [{ t: 0, pos: [0, 2.0, 3.6], look: [0, 1.25, 0], fov: 36 }, { t: 4, pos: [0, 2.7, 5.6], look: [0, 1.2, 0], fov: 36 }] });
    E.cue(S.t0 + 0.3, 'boom', { g: 0.9 });
    S.update((lt) => PMS.forEach((_, i) => dk.tip(i, ease.inOut(remap(lt, 1.0 + i * 0.25, 1.4 + i * 0.25)))));
    ui.kicker(S, { t0: 0, text: 'History flip', y: 372 });
    ui.headline(S, { t0: 0, html: 'What if the <em>knifings</em> never happened?', y: 410, size: 92, style: 'slam', stagger: 0.04, t1: S.dur + 1 });
  });

  E.defineScene('real', (S) => {
    const dk = desk(S, { key: 120 });
    DUMPED.forEach((i, j) => E.cue(S.t0 + 2.4 + j * 0.55, 'pop', { i: j }));
    S.update((lt) => DUMPED.forEach((i, j) => dk.tip(i, ease.out(remap(lt, 2.3 + j * 0.55, 2.7 + j * 0.55)))));
    ui.kicker(S, { t0: 0.05, text: 'Real · 2010–2018', y: 372 });
    ui.headline(S, { t0: 0.1, html: '4 PMs dumped <em>by their own party</em>', y: 410, size: 82, style: 'rise' });
    ui.block(S, { t0: 5.0, html: '<b>6 prime ministers</b> in about a decade', cls: 'body', y: 600, w: 920, size: 44 });
  });

  const imag = (id, kicker, head, items) => E.defineScene(id, (S) => {
    const dk = desk(S, { key: 140, cam: [{ t: 0, pos: [-0.6, 2.7, 5.6], look: [0, 1.2, 0], fov: 36 }, { t: 7, pos: [0.4, 2.6, 5.2], look: [0, 1.2, 0], fov: 36 }] });
    S.update(() => PMS.forEach((_, i) => dk.tip(i, 0)));
    ui.kicker(S, { t0: 0.05, text: 'IMAGINED · ' + kicker, y: 372 });
    ui.headline(S, { t0: 0.1, html: head, y: 410, size: 84, style: 'rise' });
    ui.list(S, { t0: 0.8, stagger: 1.6, y: 560, w: 900, size: 40, mark: '→', items });
  });
  imag('imag1', 'No spills · 2010', 'Rudd <em>stays</em>', ['Rudd faces the 2010 election himself', 'Gillard might never become PM']);
  imag('imag2', 'No spills · 2013–2018', 'Abbott <em>stays</em>', ['Abbott leads into 2016', 'Turnbull may never get the job', 'Morrison? Possibly never PM']);

  E.defineScene('rules', (S) => {
    const dk = desk(S, { key: 120 });
    S.update(() => DUMPED.forEach((i) => dk.tip(i, 1)));
    E.cue(S.t0 + 0.4, 'ding');
    ui.kicker(S, { t0: 0.05, text: 'Real · the rule changes', y: 372 });
    ui.list(S, { t0: 0.3, stagger: 2.2, y: 420, w: 920, size: 42, mark: '✓', markColor: '#c8f04a', items: [
      `<b style="color:${CSS.ALP}">Labor</b>, 2013: harder to remove a leader`, `<b style="color:${CSS.LNP}">Liberals</b>, Dec 2018: <b>two-thirds</b> of the party room to dump a PM who won an election`] });
  });

  E.defineScene('since', (S) => {
    const dk = desk(S, { key: 130 });
    S.update(() => DUMPED.forEach((i) => dk.tip(i, 1)));
    E.cue(S.t0 + 3.0, 'boom', { g: 0.5 });
    ui.kicker(S, { t0: 0.05, text: 'Real · since 2018', y: 372 });
    ui.headline(S, { t0: 0.1, html: 'No sitting PM <em>knifed</em>', y: 410, size: 90, style: 'rise' });
    ui.block(S, { t0: 3.0, html: `But Feb 2026: <b style="color:${CSS.LNP}">Sussan Ley</b> dumped as Liberal leader, <b>34–17</b>`, cls: 'body', y: 600, w: 920, size: 40 });
  });

  E.defineScene('ask', (S) => {
    const dk = desk(S, { key: 120 });
    S.update((lt) => PMS.forEach((_, i) => dk.tip(i, 0.5 + 0.5 * Math.sin(lt * 2 + i))));
    ui.kicker(S, { t0: 0.05, text: 'Your call', y: 372 });
    ui.headline(S, { t0: 0.1, html: 'Should parties be able to <em>dump your PM?</em>', y: 410, size: 84, style: 'rise' });
    ui.block(S, { t0: 0.9, html: 'Comment <b>YES</b> or <b>NO</b> 👇', cls: 'body', y: 680, w: 920, size: 48 });
  });

  E.defineScene('end', (S) => endCard(S, { title: 'Politics, <em>explained</em>', sub: 'poltok.netlify.app', sources: 'Real: SBS ("Six PMs in 10 years", 2018); Liberal two-thirds rule, 3 Dec 2018 (SBS, RNZ); Labor leadership rules, 2013; Ley v Taylor, 13 Feb 2026, 34–17 (ABC via The Star).<br>"Imagined" scenes are speculation, not history.' }));
}
