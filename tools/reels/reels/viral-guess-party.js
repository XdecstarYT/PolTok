// Reel (viral, interactive) — "Guess the party: which Victorian party promised this?" 7 real promises; countdown; reveal.
// Every answer is from ABC News' Victorian election policy tracker (4 Nov 2026). Two twists: free abortion care (Labor
// promised it; the Coalition matched it) and repealing the home gas ban (both the Coalition and One Nation).

export const meta = {
  title: 'Guess the party',
  label: 'VIC 2026 · QUIZ',
  out: 'poltok-viral-guess-the-party',
  cover: 1.2,
  music: { prog: ['Am', 'F', 'C', 'G'], arp: 'up', seed: 263, swing: 0.05 },
};

const Q = [
  { p: 'A $30 weekly cap on public transport fares', a: ['ALP'], say: 'Labor.' },
  { p: 'Lift the state\'s ban on nuclear power', a: ['ONP'], say: 'One Nation.' },
  { p: 'No stamp duty for first home buyers, up to $1 million', a: ['LNP'], say: 'The Liberals.' },
  { p: 'Free abortion care for Victorian women', a: ['ALP', 'LNP'], say: 'Labor. And the Liberals matched it.' },
  { p: '$150 sport vouchers for every school kid', a: ['ONP'], say: 'One Nation.' },
  { p: 'Pause the Suburban Rail Loop for review', a: ['LNP'], say: 'The Liberals.' },
  { p: 'Repeal the ban on gas in homes', a: ['LNP', 'ONP'], say: 'Trick question. Both the Liberals and One Nation.' },
];
const NAME = { ALP: 'Labor', LNP: 'Liberal', ONP: 'One Nation' };

export const scenes = () => [
  { id: 'hook', beats: 6, energy: 3, voLead: 0.06, say: 'Guess which party promised this. Keep score.' },
  ...Q.map((q, i) => ({ id: 'q' + i, beats: 10, energy: i % 2 ? 2 : 3, trans: { type: i % 2 ? 'whip' : 'flash', dir: 'left', dur: 0.36 },
    voLead: 3.2, say: q.say, cap: `${i + 1}. ${q.p}: ${q.a.map((k) => NAME[k]).join(' + ')}` })),
  { id: 'ask', beats: 8, energy: 2, trans: { type: 'zoom', dur: 0.45 },
    say: 'How many did you get? Comment your score out of seven.', cap: 'How many did you get? Comment your score /7 👇' },
  { id: 'end', beats: 6, energy: 0, trans: { type: 'zoom', dur: 0.5 }, noProgress: true },
];

export function build({ E, kit, ui, THREE, endCard, real }) {
  const { C, ease, remap } = E;
  const N = 88, WARM = 0xffe2b0;
  const COL = { ALP: 0xe53935, LNP: 0x1f5fd1, ONP: 0xd9480f };
  const CSS = { ALP: '#ff6b6b', LNP: '#6ea2ff', ONP: '#ff9a4a' };
  const hall = (S, o = {}) => {
    real.room(S, { carpet: 0x2d4a33, wood: 0x5a361d, width: 30, depth: 26, height: 10, key: o.key ?? 260 });
    const ch = real.chamber(N, { rows: 5, r0: 3.4, r1: 7.6, leather: 0x1f5a38, wood: 0x6a3d1f, open: 0.6 });
    S.scene.add(ch.group);
    return ch;
  };
  const CAMS = [
    [{ t: 0, pos: [0, 2.6, 7], look: [0, 1, -5], fov: 36 }, { t: 6, pos: [0, 3.6, 9.5], look: [0, 0.8, -4], fov: 36 }],
    [{ t: 0, pos: [-6, 6.5, 9], look: [0, 0.4, -3], fov: 40 }, { t: 6, pos: [-4.5, 7.2, 10.2], look: [0, 0.4, -3], fov: 40 }],
    [{ t: 0, pos: [6, 6.5, 9], look: [0, 0.4, -3], fov: 40 }, { t: 6, pos: [4.5, 7.2, 10.2], look: [0, 0.4, -3], fov: 40 }],
  ];

  E.defineScene('hook', (S) => {
    const ch = hall(S);
    E.camPath(S, CAMS[0], { shake: 0.025, focusOn: true });
    S.aperture = 0.3;
    E.cue(S.t0 + 0.2, 'boom', { g: 0.8 });
    S.update((lt) => { const p = ((Math.floor(lt * 4) % 3) + 3) % 3; const k = ['ALP', 'LNP', 'ONP'][p]; for (let i = 0; i < N; i++) ch.set(i, COL[k], 0.6 + 0.5 * Math.sin(lt * 6 + i)); ch.commit(); });
    ui.kicker(S, { t0: 0, text: 'Victoria votes 28 November', y: 372 });
    ui.headline(S, { t0: 0, html: 'Guess <em>the party</em>', y: 410, size: 130, style: 'slam', stagger: 0.04, t1: S.dur + 1 });
    ui.block(S, { t0: 0.3, html: `<b style="color:${CSS.ALP}">Labor</b> · <b style="color:${CSS.LNP}">Liberal</b> · <b style="color:${CSS.ONP}">One Nation</b> · 7 real promises`, cls: 'body', y: 600, w: 920, size: 44, t1: S.dur + 1 });
  });

  Q.forEach((q, i) => E.defineScene('q' + i, (S) => {
    const ch = hall(S, { key: 240 + (i % 3) * 30 });
    E.camPath(S, CAMS[i % 3], { shake: 0.02, shiftY: 300, focusOn: true });
    S.aperture = 0.2;
    const REVEAL = 3.1;
    [0.4, 1.3, 2.2].forEach((t) => E.cue(S.t0 + t, 'tick', { k: 0.5 }));
    E.cue(S.t0 + REVEAL, 'ding', {});
    const cols = q.a.map((k) => COL[k]);
    S.update((lt) => {
      const k = ease.out(remap(lt, REVEAL, REVEAL + 0.6));
      for (let j = 0; j < N; j++) {
        const c = cols.length === 1 ? cols[0] : cols[j < N / 2 ? 0 : 1];
        ch.set(j, lt < REVEAL ? WARM : c, lt < REVEAL ? 0.25 + 0.15 * Math.sin(lt * 8 + j) : 1.4 * k);
      }
      ch.commit();
    });
    ui.kicker(S, { t0: 0.02, text: `Question ${i + 1} of ${Q.length} · who promised this?`, y: 372 });
    ui.block(S, { t0: 0.1, html: `“${q.p}”`, cls: 'body', y: 420, w: 920, size: 64 });
    ['3', '2', '1'].forEach((n, j) => ui.block(S, { t0: 0.4 + j * 0.9, t1: 0.4 + (j + 1) * 0.9, html: `<b style="font-size:1.6em;color:#c8f04a">${n}</b>`, cls: 'body', y: 640, align: 'center', size: 80 }));
    ui.block(S, { t0: REVEAL, html: q.a.map((k) => `<b style="color:${CSS[k]}">${NAME[k]}</b>`).join(' <span style="opacity:.7">+</span> ') + (q.a.length > 1 ? ' <span style="opacity:.8">· twist!</span>' : ''), cls: 'body', y: 640, align: 'center', size: 76 });
  }));

  E.defineScene('ask', (S) => {
    const ch = hall(S, { key: 220 });
    E.camPath(S, CAMS[0], { shake: 0.02, focusOn: true });
    S.aperture = 0.35;
    const third = Math.floor(N / 3);
    S.update((lt) => { for (let i = 0; i < N; i++) { const c = i < third ? COL.ALP : i < 2 * third ? COL.LNP : COL.ONP; ch.set(i, c, 0.9 + 0.4 * Math.sin(lt * 4 + i * 0.3)); } ch.commit(); });
    ui.kicker(S, { t0: 0.05, text: 'Final score', y: 372 });
    ui.headline(S, { t0: 0.1, html: 'How many did <em>you get?</em>', y: 410, size: 104, style: 'rise' });
    ui.block(S, { t0: 0.9, html: '<b style="color:#c8f04a">Comment your score</b> out of 7 👇 &nbsp;·&nbsp; <b>Follow</b> for more', cls: 'body', y: 640, w: 920, size: 42 });
  });

  E.defineScene('end', (S) => endCard(S, { title: 'Know your <em>vote</em>', sub: 'poltok.netlify.app/au/victoria', sources: 'All promises: ABC News Victorian election policy tracker (4 Nov 2026).<br>Free abortion care: Labor pledged it, the Coalition matched it. Gas ban repeal: Coalition and One Nation.' }));
}
