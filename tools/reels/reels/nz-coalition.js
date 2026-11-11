// Realistic reel — NZ 2026: how the governing parties reach a majority on PRELIMINARY, unofficial figures.
// Figures (Wikipedia infobox, election night, unofficial): National 42, Labour 36, Green 16, ACT 13, NZ First 12,
// Opportunity 7, Te Pāti Māori 5 = 131 seats (incl. 11 overhang), 66 for a majority.
// No claims about the content or timing of any coalition agreement are made; the official count can change seats.

export const meta = {
  title: 'NZ: the coalition maths',
  label: 'PRELIMINARY · UNOFFICIAL',
  labelCls: 'warn',
  out: 'poltok-nz-coalition-maths',
  cover: 1.4,
  music: { prog: ['Em', 'C', 'G', 'D'], arp: 'updown', seed: 72, swing: 0.05 },
};

const P = {
  NAT: { n: 'National', s: 42, c: 0x2f6fe0 },
  ACT: { n: 'ACT', s: 13, c: 0xf2c200 },
  NZF: { n: 'NZ First', s: 12, c: 0x9aa3b2 },
  LAB: { n: 'Labour', s: 36, c: 0xe0463c },
  GRN: { n: 'Green', s: 16, c: 0x3fae49 },
  OPP: { n: 'Opportunity', s: 7, c: 0x22b3a3 },
  TPM: { n: 'Te Pāti Māori', s: 5, c: 0xd2504f },
};
const TOTAL = 131, MAJ = 66;
// seating order left → right (opposition on the left, government on the right)
const ORDER = ['TPM', 'GRN', 'LAB', 'OPP', 'NZF', 'ACT', 'NAT'];

export const scenes = () => [
  { id: 'hook', beats: 6, energy: 3, voLead: 0.08,
    say: "Sixty-seven seats. That's one more than they need." },
  { id: 'house', beats: 12, energy: 2, trans: { type: 'zoom', dur: 0.5 },
    say: "So, on the preliminary count, Parliament's got a hundred and thirty-one seats. You need sixty-six to govern.",
    cap: 'Preliminary results: 131 seats. 66 is a majority.' },
  { id: 'build', beats: 16, energy: 3, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: "National's on forty-two. Add ACT's thirteen... then New Zealand First's twelve. And that's sixty-seven.",
    cap: 'National 42 + ACT 13 + NZ First 12 = 67.' },
  { id: 'other', beats: 12, energy: 2, trans: { type: 'whip', dir: 'right', dur: 0.42 },
    say: 'On the other side, Labour, the Greens, Opportunity and [Te Pāti Māori](/tˈɛ pˈɑːti mˈɑːoɹi/) add up to sixty-four.',
    cap: 'Labour, Greens, Opportunity and Te Pāti Māori: 64.' },
  { id: 'caveat', beats: 12, energy: 1, trans: { type: 'fade', dur: 0.5 },
    say: "Heads up though. These are election-night numbers. Special votes haven't been counted yet, so a seat or two could still move.",
    cap: 'Election-night numbers. Special votes are still to come, and the official count can move seats.' },
  { id: 'end', beats: 6, energy: 0, trans: { type: 'zoom', dur: 0.5 }, noProgress: true },
];

export function build({ E, kit, ui, THREE, endCard, real }) {
  const { C, ease, remap } = E;
  const colors = ORDER.flatMap((k) => Array(P[k].s).fill(P[k].c));
  const party = ORDER.flatMap((k) => Array(P[k].s).fill(k));

  const house = (S, o = {}) => {
    real.room(S, { carpet: 0x23402c, wood: 0x6a4524, width: 32, depth: 28, height: 11, key: o.key ?? 300 });
    const ch = real.chamber(TOTAL, { rows: 6, r0: 3.6, r1: 8.6, leather: 0x1d5634, wood: 0x7a4a26, open: 0.6 });
    S.scene.add(ch.group);
    return ch;
  };
  const light = (ch, fn) => { for (let i = 0; i < TOTAL; i++) { const [c, k] = fn(i); ch.set(i, c, k); } ch.commit(); };

  E.defineScene('hook', (S) => {
    const ch = house(S);
    E.camPath(S, [{ t: 0, pos: [-3, 2.2, 6], look: [0, 1, -5], fov: 36 }, { t: S.dur + 0.5, pos: [2, 3.2, 8.5], look: [0, 0.8, -4], fov: 36 }], { shake: 0.02, focusOn: true });
    S.aperture = 0.3;
    S.update((lt) => light(ch, (i) => [colors[i], 1.2 * ease.inOut(remap(lt, 0.3 + (i / TOTAL) * 1.4, 0.7 + (i / TOTAL) * 1.4))]));
    E.cue(S.t0 + 0.4, 'boom', { g: 0.5 });
    ui.kicker(S, { t0: 0, text: 'New Zealand · preliminary', y: 372 });
    ui.headline(S, { t0: 0, html: '<em>67</em> seats. Just one over.', y: 410, size: 100, style: 'slam', stagger: 0.04, t1: S.dur + 1 });
    ui.block(S, { t0: 0.35, html: 'National + ACT + NZ First clear the 66 line by <b>a single seat</b>. Here\'s the maths.', cls: 'body', y: 690, w: 920, size: 46, t1: S.dur + 1 });
  });

  E.defineScene('house', (S) => {
    const ch = house(S);
    E.camPath(S, [{ t: 0, pos: [0, 10, 12], look: [0, 0, -3], fov: 40 }, { t: S.dur, pos: [0, 8.5, 10], look: [0, 0.3, -3.2], fov: 40 }], { shake: 0.015, shiftY: 240, focusOn: true });
    S.aperture = 0.15;
    S.update((lt) => light(ch, (i) => [colors[i], 1.1]));
    ui.counter(S, { t0: 0.3, dur: 1.2, to: TOTAL, y: 380, size: 210, label: 'seats (incl. 11 overhang)' });
    ui.block(S, { t0: 1.6, html: '<b style="color:#c8f04a">66</b> for a majority', cls: 'body', y: 660, size: 60 });
  });

  E.defineScene('build', (S) => {
    const ch = house(S, { key: 260 });
    E.camPath(S, [{ t: 0, pos: [6, 6.5, 8], look: [1.5, 0.4, -3], fov: 40 }, { t: S.dur, pos: [4, 7.5, 9.5], look: [0.5, 0.4, -3], fov: 40 }], { shake: 0.015, shiftY: 260, focusOn: true });
    S.aperture = 0.2;
    const steps = [['NAT', 0.4], ['ACT', 2.2], ['NZF', 4.0]];
    steps.forEach(([k, t]) => E.cue(S.t0 + t, 'pop', { i: 1 }));
    E.cue(S.t0 + 5.0, 'ding', {});
    S.update((lt) => light(ch, (i) => {
      const st = steps.find(([k]) => k === party[i]);
      if (!st) return [0xffe2b0, 0.15];
      return [P[party[i]].c, 1.6 * ease.back(remap(lt, st[1], st[1] + 0.5))];
    }));
    ui.kicker(S, { t0: 0.05, text: 'Governing parties · preliminary', y: 372 });
    let acc = 0;
    steps.forEach(([k, t], j) => {
      acc += P[k].s;
      ui.block(S, { t0: t, html: `<span style="color:#${new THREE.Color(P[k].c).getHexString()}">●</span> <b>${P[k].n}</b> +${P[k].s} <span style="opacity:.6">→ ${acc}</span>`, cls: 'body', y: 440 + j * 82, size: 58, style: 'left' });
    });
    ui.counter(S, { t0: 4.4, dur: 0.9, from: 55, to: 67, y: 720, size: 200, label: 'seats · majority is 66', color: '#c8f04a' });
  });

  E.defineScene('other', (S) => {
    const ch = house(S, { key: 260 });
    E.camPath(S, [{ t: 0, pos: [-6, 6.5, 8], look: [-1.5, 0.4, -3], fov: 40 }, { t: S.dur, pos: [-4, 7.5, 9.5], look: [-0.5, 0.4, -3], fov: 40 }], { shake: 0.015, shiftY: 260, focusOn: true });
    S.aperture = 0.2;
    const other = new Set(['LAB', 'GRN', 'OPP', 'TPM']);
    S.update((lt) => light(ch, (i) => other.has(party[i]) ? [P[party[i]].c, 1.5 * ease.back(remap(lt, 0.3, 0.9))] : [P[party[i]].c, 0.35]));
    ui.kicker(S, { t0: 0.05, text: 'The other side · preliminary', y: 372 });
    ui.list(S, { t0: 0.4, stagger: 0.3, y: 440, size: 50, mark: '●', markColor: '#ffffff', items: ['LAB', 'GRN', 'OPP', 'TPM'].map((k) => `<span style="color:#${new THREE.Color(P[k].c).getHexString()}">${P[k].n}</span> <b>${P[k].s}</b>`) });
    ui.counter(S, { t0: 1.9, dur: 0.9, to: 64, y: 760, size: 190, label: 'seats combined' });
  });

  E.defineScene('caveat', (S) => {
    real.room(S, { carpet: 0x23402c, wood: 0x6a4524, width: 16, depth: 14, height: 7, key: 110, area: 3, fill: 0.3 });
    const desk = new THREE.Mesh(new THREE.BoxGeometry(6, 0.16, 3.4), real.pbr(real.tex.wood(0x7a4a26), { repeat: [2, 1], clearcoat: 0.7, clearcoatRoughness: 0.2 }));
    desk.position.set(0, 1.0, 0); desk.receiveShadow = true; S.scene.add(desk);
    const sheets = [];
    for (let i = 0; i < 9; i++) {
      const sh = real.sheet(0.75, 1.0, (c, w) => { c.fillStyle = 'rgba(30,30,30,.6)'; c.font = '700 54px "Inter Tight"'; c.fillText('SPECIAL VOTE', 60, 120); c.fillStyle = 'rgba(30,30,30,.25)'; for (let l = 0; l < 7; l++) c.fillRect(60, 190 + l * 70, w - 120 - (l % 3) * 90, 18); });
      sh.rotation.x = -Math.PI / 2; sh.rotation.z = (i - 4) * 0.12;
      sh.position.set((i - 4) * 0.42, 1.09 + i * 0.004, Math.sin(i * 1.7) * 0.25);
      S.scene.add(sh); sheets.push(sh);
    }
    E.camPath(S, [{ t: 0, pos: [0, 5.4, 6.5], look: [0, 1.1, 0], fov: 32 }, { t: S.dur, pos: [0.4, 4.4, 5.2], look: [0, 1.1, 0], fov: 32 }], { shake: 0.012, shiftY: 330, focusOn: true });
    S.aperture = 0.5;
    S.update((lt) => sheets.forEach((sh, i) => { const k = ease.expo(remap(lt, 0.2 + i * 0.12, 0.7 + i * 0.12)); sh.position.y = 1.09 + i * 0.004 + (1 - k) * 2.5; sh.visible = k > 0.01; }));
    ui.kicker(S, { t0: 0.05, text: 'Not final yet', y: 372 });
    ui.headline(S, { t0: 0.15, html: 'Special votes are <em>still to come</em>', y: 428, size: 96, style: 'rise' });
    ui.block(S, { t0: 1.2, html: 'The official count can change seats. PolTok will update as results firm up.', cls: 'body', y: 660, w: 900 });
    ui.block(S, { t0: 2.4, html: '<b style="color:#c8f04a">Follow</b> so you see the final numbers →', cls: 'body', y: 800, w: 900, size: 42 });
  });

  E.defineScene('end', (S) => endCard(S, { title: 'Follow it <em>live</em>', sub: 'poltok.netlify.app/nz', sources: 'Seats: election-night preliminary results as listed on Wikipedia (unofficial, community-edited).<br>Official results: electionresults.govt.nz. Seat positions in the chamber are illustrative.' }));
}
