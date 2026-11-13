// Reel — "Victoria's had 7 premiers since 1999. Can you name them?" Facts: Steve Bracks (Labor, 1999–2007), John Brumby
// (Labor, 2007–2010), Ted Baillieu (Liberal, 2010–2013), Denis Napthine (Liberal, 2013–2014), Daniel Andrews (Labor,
// 2014–2023), Jacinta Allan (Labor, 2023–2026), Ben Carroll (Labor, 2026–; Labor leader from 28 July 2026 per Wikipedia).
// Each card: a short countdown, then the reveal. Ends on the 28 Nov election ("number eight?").

export const meta = {
  title: '7 premiers since 1999',
  label: 'VICTORIA · QUIZ',
  out: 'poltok-vic-7-premiers',
  cover: 1.2,
  music: { prog: ['Am', 'F', 'C', 'G'], arp: 'up', seed: 281, swing: 0.05 },
};

const PM = [
  { n: 'Steve Bracks', s: 'Steve Bracks', p: 'ALP', y: '1999–2007' },
  { n: 'John Brumby', s: 'John Brumby', p: 'ALP', y: '2007–2010' },
  { n: 'Ted Baillieu', s: 'Ted [Baillieu](/bˈeɪljuː/)', p: 'LIB', y: '2010–2013' },
  { n: 'Denis Napthine', s: 'Denis [Napthine](/nˈæpθaɪn/)', p: 'LIB', y: '2013–2014' },
  { n: 'Daniel Andrews', s: 'Daniel Andrews', p: 'ALP', y: '2014–2023' },
  { n: 'Jacinta Allan', s: '[Jacinta Allan](/dʒəsˈɪntə ˈælən/)', p: 'ALP', y: '2023–2026' },
  { n: 'Ben Carroll', s: 'Ben Carroll', p: 'ALP', y: '2026–' },
];

export const scenes = () => [
  { id: 'hook', beats: 6, energy: 3, voLead: 0.06, say: 'Victoria\'s had seven premiers since nineteen ninety-nine. How many can you name?' },
  ...PM.map((x, i) => ({ id: 'p' + i, beats: 6, energy: i % 2 ? 2 : 3, trans: { type: i % 2 ? 'whip' : 'flash', dir: 'left', dur: 0.32 },
    voLead: 1.5, say: `${x.s}.`, cap: `${i + 1}. ${x.n} (${x.p === 'ALP' ? 'Labor' : 'Liberal'}, ${x.y})` })),
  { id: 'eight', beats: 8, energy: 3, trans: { type: 'zoom', dur: 0.45 },
    say: 'Number eight? That could be decided on November twenty-eighth.', cap: 'Number 8? Victoria votes 28 November.' },
  { id: 'ask', beats: 8, energy: 2, trans: { type: 'zoom', dur: 0.45 },
    say: 'How many did you get? Comment your score out of seven.', cap: 'How many did you get? Comment your score /7 👇' },
  { id: 'end', beats: 6, energy: 0, trans: { type: 'zoom', dur: 0.5 }, noProgress: true },
];

export function build({ E, kit, ui, THREE, endCard, real }) {
  const { C, ease, remap } = E;
  const N = 88, WARM = 0xffe2b0;
  const COL = { ALP: 0xe53935, LIB: 0x1f5fd1 };
  const CSS = { ALP: '#ff6b6b', LIB: '#6ea2ff' };
  const hall = (S, o = {}) => {
    real.room(S, { carpet: 0x2d4a33, wood: 0x5a361d, width: 30, depth: 26, height: 10, key: o.key ?? 260 });
    const ch = real.chamber(N, { rows: 5, r0: 3.4, r1: 7.6, leather: 0x1f5a38, wood: 0x6a3d1f, open: 0.6 });
    S.scene.add(ch.group);
    return ch;
  };
  const CAMS = [
    [{ t: 0, pos: [0, 2.6, 7], look: [0, 1, -5], fov: 36 }, { t: 6, pos: [0, 3.4, 9], look: [0, 0.8, -4], fov: 36 }],
    [{ t: 0, pos: [-6, 6.5, 9], look: [0, 0.4, -3], fov: 40 }, { t: 6, pos: [-4.5, 7.2, 10.2], look: [0, 0.4, -3], fov: 40 }],
    [{ t: 0, pos: [6, 6.5, 9], look: [0, 0.4, -3], fov: 40 }, { t: 6, pos: [4.5, 7.2, 10.2], look: [0, 0.4, -3], fov: 40 }],
  ];

  E.defineScene('hook', (S) => {
    const ch = hall(S);
    E.camPath(S, CAMS[0], { shake: 0.025, focusOn: true });
    S.aperture = 0.3;
    E.cue(S.t0 + 0.2, 'boom', { g: 0.8 });
    S.update((lt) => { const k = ((Math.floor(lt * 3) % 2) + 2) % 2 ? 'LIB' : 'ALP'; for (let i = 0; i < N; i++) ch.set(i, COL[k], 0.6 + 0.5 * Math.sin(lt * 6 + i)); ch.commit(); });
    ui.kicker(S, { t0: 0, text: 'Victoria · since 1999', y: 372 });
    ui.headline(S, { t0: 0, html: '<em>7 premiers.</em> Name them all?', y: 410, size: 100, style: 'slam', stagger: 0.04, t1: S.dur + 1 });
  });

  PM.forEach((x, i) => E.defineScene('p' + i, (S) => {
    const ch = hall(S, { key: 240 + (i % 3) * 30 });
    E.camPath(S, CAMS[i % 3], { shake: 0.02, shiftY: 300, focusOn: true });
    S.aperture = 0.2;
    const REVEAL = 1.4;
    [0.2, 0.8].forEach((t) => E.cue(S.t0 + t, 'tick', { k: 0.5 }));
    E.cue(S.t0 + REVEAL, 'ding', {});
    S.update((lt) => { const k = ease.out(remap(lt, REVEAL, REVEAL + 0.5)); for (let j = 0; j < N; j++) ch.set(j, lt < REVEAL ? WARM : COL[x.p], lt < REVEAL ? 0.25 : 1.4 * k); ch.commit(); });
    ui.kicker(S, { t0: 0.02, text: `Premier ${i + 1} of 7 · ${x.y}`, y: 372 });
    ui.block(S, { t0: 0.1, t1: REVEAL, html: '<b style="font-size:1.6em;color:#c8f04a">?</b>', cls: 'body', y: 430, align: 'center', size: 110 });
    ui.headline(S, { t0: REVEAL, html: `<em>${x.n}</em>`, y: 420, size: 110, style: 'slam' });
    ui.block(S, { t0: REVEAL + 0.2, html: `<b style="color:${CSS[x.p]}">${x.p === 'ALP' ? 'Labor' : 'Liberal'}</b> · ${x.y}`, cls: 'body', y: 600, align: 'center', size: 50 });
  }));

  E.defineScene('eight', (S) => {
    const ch = hall(S, { key: 280 });
    E.camPath(S, CAMS[0], { shake: 0.02, focusOn: true });
    S.aperture = 0.3;
    S.update((lt) => { for (let i = 0; i < N; i++) ch.set(i, WARM, 0.3 + 0.5 * Math.abs(Math.sin(lt * 3 + i * 0.2))); ch.commit(); });
    ui.kicker(S, { t0: 0.05, text: 'Premier number 8?', y: 372 });
    ui.headline(S, { t0: 0.1, html: 'Decided <em>28 November</em>', y: 410, size: 100, style: 'rise' });
  });

  E.defineScene('ask', (S) => {
    const ch = hall(S, { key: 220 });
    E.camPath(S, CAMS[0], { shake: 0.02, focusOn: true });
    S.aperture = 0.35;
    S.update((lt) => { for (let i = 0; i < N; i++) ch.set(i, i % 2 ? COL.ALP : COL.LIB, 0.8 + 0.4 * Math.sin(lt * 4 + i * 0.3)); ch.commit(); });
    ui.kicker(S, { t0: 0.05, text: 'Final score', y: 372 });
    ui.headline(S, { t0: 0.1, html: 'How many did <em>you get?</em>', y: 410, size: 104, style: 'rise' });
    ui.block(S, { t0: 0.9, html: '<b style="color:#c8f04a">Comment your score</b> out of 7 👇', cls: 'body', y: 640, w: 920, size: 46 });
  });

  E.defineScene('end', (S) => endCard(S, { title: 'Election night, <em>live</em>', sub: 'poltok.netlify.app/au/victoria', sources: 'Premiers of Victoria since 1999 and their terms (Parliament of Victoria; Wikipedia).<br>Ben Carroll became Labor leader on 28 July 2026.' }));
}
