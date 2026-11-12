// Reel — "Is your seat about to flip?" Every Labor-held seat that falls to the Coalition on a uniform two-party swing,
// named, in three bands: under 5 points, 5–8 points, and 8 points up to today's poll swing (see _lib-vic-swing.js).
// Built for comments ("is your seat on the list?"). A rough guide, NOT a projection — the reel says so.

export async function data() { const { swingData } = await import('./_lib-vic-swing.js'); return swingData(); }

export const meta = {
  title: 'Is your seat about to flip?',
  label: 'VIC 2026 · WHAT IF',
  out: 'poltok-vic-is-your-seat-next',
  cover: 1.6,
  music: { prog: ['Em', 'C', 'G', 'D'], arp: 'up', seed: 229, swing: 0.04 },
};

const R = Math.round;
const NUM = (n) => String(n);

export const scenes = (d) => [
  { id: 'hook', beats: 6, energy: 3, voLead: 0.08, say: 'Is your seat about to flip?' },
  { id: 'setup', beats: 8, energy: 2, trans: { type: 'zoom', dur: 0.45 },
    say: `The polls show a ${R(d.swing)} point swing against Labor. Here's every seat that falls.`,
    cap: `Polls: a ${d.swing}-point two-party swing against Labor. Every Labor seat that falls:` },
  { id: 'b5', beats: 12, energy: 3, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: `Under five points, ${NUM(d.bands.b5.length)} seats go.`, cap: `Under 5 points: ${d.bands.b5.length} seats.` },
  { id: 'b8', beats: 9, energy: 3, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: `Five to eight points, ${NUM(d.bands.b8.length)} more.`, cap: `5–8 points: ${d.bands.b8.length} more.` },
  { id: 'bS', beats: 9, energy: 3, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: `And up to ${R(d.swing)} points, another ${NUM(d.bands.bS.length)}. That's ${d.falls.length} in total.`,
    cap: `8–${d.swing} points: ${d.bands.bS.length} more. ${d.falls.length} seats in total.` },
  { id: 'caveat', beats: 7, energy: 1, trans: { type: 'fade', dur: 0.45 },
    say: 'This assumes every seat swings the same. They never do.',
    cap: 'Assumes every seat swings the same. They never do.' },
  { id: 'ask', beats: 8, energy: 2, trans: { type: 'zoom', dur: 0.45 },
    say: 'Is your seat on the list? Comment it below.', cap: 'Is your seat on the list? Comment it 👇' },
  { id: 'end', beats: 6, energy: 0, trans: { type: 'zoom', dur: 0.5 }, noProgress: true },
];

export function build({ E, kit, ui, THREE, endCard, real }) {
  const { C, ease, remap } = E;
  const d = E.data;
  const N = 88, WARM = 0xffe2b0;
  const COL = { ALP: 0xe53935, LNP: 0x1f5fd1, GRN: 0x2fa84f, IND: 0x9aa3b2 };
  const hall = (S, o = {}) => {
    real.room(S, { carpet: 0x2d4a33, wood: 0x5a361d, width: 30, depth: 26, height: 10, key: o.key ?? 260 });
    const ch = real.chamber(N, { rows: 5, r0: 3.4, r1: 7.6, leather: 0x1f5a38, wood: 0x6a3d1f, open: 0.6 });
    S.scene.add(ch.group);
    return ch;
  };
  const s = d.seats2022, nFall = d.falls.length;
  const base = [...Array(s.GRN).fill('GRN'), ...Array(s.ALP).fill('ALP'), ...Array(s.IND).fill('IND'), ...Array(s.LNP).fill('LNP')];
  const edge = s.GRN + s.ALP - 1; // most marginal Labor seat index; falls go leftwards from here
  const nB = [d.bands.b5.length, d.bands.b8.length, d.bands.bS.length];
  const cum = [nB[0], nB[0] + nB[1], nB[0] + nB[1] + nB[2]];
  // paint: `done` seats already flipped, `active` = [from,to) range pulsing now
  const paint = (ch, done, from = 0, to = 0, k = 0, lt = 0) => {
    for (let i = 0; i < N; i++) {
      const j = edge - i; // 0 = most marginal
      const isFall = j >= 0 && j < nFall;
      let c = COL[base[i]] ?? WARM, g = isFall ? 0.7 : 0.35;
      if (isFall && j < done) { c = COL.LNP; g = 1.2; }
      if (isFall && j >= from && j < to) { const on = (j - from) / Math.max(1, to - from) < k; c = on ? COL.LNP : COL.ALP; g = on ? 1.4 + 0.4 * Math.sin(lt * 6 + j) : 1.0; }
      ch.set(i, c, g);
    }
    ch.commit();
  };
  const WIDE = [{ t: 0, pos: [0, 12, 13.5], look: [0, 0, -2.5], fov: 44 }, { t: 6, pos: [0, 11, 12.5], look: [0, 0.3, -2.8], fov: 44 }];
  const names = (S, list, t0, y = 560, size = 30) => ui.block(S, { t0, html: list.map((n) => `<span style="white-space:nowrap">${n}</span>`).join(' &nbsp;·&nbsp; '), cls: 'body', y, w: 920, size, align: 'center' });

  E.defineScene('hook', (S) => {
    const ch = hall(S);
    E.camPath(S, [{ t: 0, pos: [0, 2.2, 6.2], look: [0, 1.0, -5], fov: 36 }, { t: S.dur + 0.4, pos: [0.6, 4.0, 10], look: [0, 0.7, -3.5], fov: 36 }], { shake: 0.025, focusOn: true });
    S.aperture = 0.3;
    E.cue(S.t0 + 0.3, 'boom', { g: 0.8 });
    S.update((lt) => paint(ch, 0, 0, nFall, ease.inOut(remap(lt, 0.3, 2.6)), lt));
    ui.kicker(S, { t0: 0, text: 'Victoria · if the polls are right', y: 372 });
    ui.headline(S, { t0: 0, html: 'Is <em>your seat</em> about to flip?', y: 410, size: 96, style: 'slam', stagger: 0.04, t1: S.dur + 1 });
  });

  E.defineScene('setup', (S) => {
    const ch = hall(S, { key: 240 });
    E.camPath(S, WIDE, { shake: 0.015, shiftY: 300, focusOn: true });
    S.aperture = 0.1;
    S.update((lt) => paint(ch, 0, 0, nFall, 0, lt));
    ui.kicker(S, { t0: 0.05, text: '2022 → latest polls, after preferences', y: 372 });
    ui.counter(S, { t0: 0.3, dur: 1.2, to: d.swing, decimals: 1, suffix: ' pts', y: 400, size: 160, color: '#c8f04a', label: `two-party swing against Labor (${d.alp2022}% → ${d.alp}%)` });
  });

  const band = (id, label, list, from, to) => E.defineScene(id, (S) => {
    const ch = hall(S, { key: 280 });
    E.camPath(S, WIDE, { shake: 0.02, shiftY: 340, focusOn: true });
    S.aperture = 0.1;
    for (let j = 0; j < to - from; j += 2) E.cue(S.t0 + 0.5 + (j / Math.max(1, to - from)) * 2.0, 'blip', { i: j });
    S.update((lt) => paint(ch, from, from, to, ease.inOut(remap(lt, 0.5, 2.5)), lt));
    ui.kicker(S, { t0: 0.05, text: label, y: 372 });
    ui.counter(S, { t0: 0.3, dur: 1.0, to: list.length, y: 400, size: 120, color: '#6ea2ff', label: 'Labor seats fall', ticks: false });
    names(S, list, 0.7, 560, list.length > 15 ? 28 : 34);
  });
  band('b5', 'Swing under 5 points', d.bands.b5, 0, cum[0]);
  band('b8', 'Swing 5 to 8 points', d.bands.b8, cum[0], cum[1]);
  band('bS', `Swing 8 to ${d.swing} points`, d.bands.bS, cum[1], cum[2]);

  E.defineScene('caveat', (S) => {
    const ch = hall(S, { key: 180 });
    E.camPath(S, [{ t: 0, pos: [-3, 2.4, 6.2], look: [0, 1, -5], fov: 36 }, { t: 6, pos: [2, 3.4, 9], look: [0, 0.8, -4], fov: 36 }], { shake: 0.015, focusOn: true });
    S.aperture = 0.35;
    S.update((lt) => paint(ch, nFall, 0, 0, 0, lt));
    ui.kicker(S, { t0: 0.05, text: 'Caveat', y: 372 });
    ui.headline(S, { t0: 0.1, html: 'Seats <em>never</em> swing evenly', y: 410, size: 76, style: 'rise' });
    ui.block(S, { t0: 0.8, html: 'One Nation, the Greens and independents aren\'t in this maths. A rough guide, not a prediction.', cls: 'body', y: 600, w: 900, size: 38 });
  });

  E.defineScene('ask', (S) => {
    const ch = hall(S, { key: 220 });
    E.camPath(S, [{ t: 0, pos: [-3, 2.4, 6], look: [0, 1, -5], fov: 36 }, { t: 6, pos: [2, 3.0, 7.5], look: [0, 0.9, -4.5], fov: 36 }], { shake: 0.02, focusOn: true });
    S.aperture = 0.35;
    S.update((lt) => paint(ch, 0, 0, nFall, (Math.sin(lt * 1.4) + 1) / 2, lt));
    ui.kicker(S, { t0: 0.05, text: 'Your turn', y: 372 });
    ui.headline(S, { t0: 0.1, html: 'Is your seat <em>on the list?</em>', y: 410, size: 100, style: 'rise' });
    ui.block(S, { t0: 0.9, html: '<b style="color:#c8f04a">Comment your seat</b> 👇 &nbsp;·&nbsp; <b>Follow</b> for election night', cls: 'body', y: 640, w: 920, size: 42 });
  });

  E.defineScene('end', (S) => endCard(S, { title: 'Election night, <em>live</em>', sub: 'poltok.netlify.app/au/victoria', sources: `2022 margins & 2PP: VEC. Polls: latest ${d.polls.length} with a two-party figure (Wikipedia).<br>Uniform-swing estimate, not a projection. Seat positions are illustrative.` }));
}
