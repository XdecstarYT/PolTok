// Reel (viral, interactive) — "Which Victorian party are you?" Five policy choices, options shown as neutral A/B/C (letters
// shuffled per question so the party isn't obvious), then an answer key. Every option is that party's own announced policy
// per ABC News' Victorian election policy tracker (4 Nov 2026). Viewers tally their letters and comment their party.

export async function data() {
  const now = new Date();
  return { days: Math.round((Date.UTC(2026, 10, 28) - Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) / 864e5) };
}

export const meta = {
  title: 'Which Victorian party are you?',
  label: 'VIC 2026 · QUIZ',
  out: 'poltok-which-vic-party-are-you',
  cover: 1.2,
  music: { prog: ['Am', 'F', 'C', 'G'], arp: 'up', seed: 373, swing: 0.05 },
};

// each question: topic + options in DISPLAY order (A, B, C) with their party
const Q = [
  { t: 'The Suburban Rail Loop', o: [['Pause it and review it', 'LNP'], ['Cancel it', 'ONP'], ['Keep building it', 'ALP']] },
  { t: 'Energy', o: [['Keep net zero by 2045', 'ALP'], ['Scrap net zero and lift the nuclear ban', 'ONP'], ['Keep net zero, but repeal the home gas ban', 'LNP']] },
  { t: 'Crime', o: [['Charge kids as adults for serious violence', 'ONP'], ['3,000 more police and one-strike bail', 'LNP'], ['1,500 more police', 'ALP']] },
  { t: 'Housing', o: [['25,600 homes for first home buyers', 'ALP'], ['No stamp duty for first homes up to $1m', 'LNP'], ['Higher duty on foreign buyers', 'ONP']] },
  { t: 'Cost of living', o: [['Reverse the land tax increases', 'ONP'], ['A $30 weekly public transport fare cap', 'ALP'], ['No new taxes and a $50 weekly toll cap', 'LNP']] },
];
const NAME = { ALP: 'Labor', LNP: 'Liberal', ONP: 'One Nation' };
const L = ['A', 'B', 'C'];

export const scenes = (d) => [
  { id: 'hook', beats: 7, energy: 3, voLead: 0.06, say: 'Which Victorian party actually matches you? Five questions. Pick A, B, or C, and keep track.' },
  ...Q.map((q, i) => ({ id: 'q' + i, beats: 12, energy: i % 2 ? 2 : 3, trans: { type: i % 2 ? 'whip' : 'flash', dir: 'left', dur: 0.36 },
    say: `${q.t}.`, cap: `${i + 1}. ${q.t}: A, B or C?` })),
  { id: 'key', beats: 16, energy: 3, trans: { type: 'zoom', dur: 0.45 },
    say: 'Here\'s the answer key. Count up which party you picked most.', cap: 'Answer key: count which party you picked most.' },
  { id: 'ask', beats: 8, energy: 2, trans: { type: 'zoom', dur: 0.45 },
    say: `So, which party did you get? Comment it. Victoria votes in ${d.days} days.`, cap: 'Which party did you get? Comment 👇' },
  { id: 'end', beats: 6, energy: 0, trans: { type: 'zoom', dur: 0.5 }, noProgress: true },
];

export function build({ E, kit, ui, THREE, endCard, real }) {
  const { C, ease, remap } = E;
  const d = E.data;
  const COL = { ALP: 0xe53935, LNP: 0x1f5fd1, ONP: 0xd9480f };
  const CSS = { ALP: '#ff6b6b', LNP: '#6ea2ff', ONP: '#ff9a4a' };
  const NEUTRAL = '#c8f04a';
  const N = 88, WARM = 0xffe2b0;
  const hall = (S, o = {}) => {
    real.room(S, { carpet: 0x2d4a33, wood: 0x5a361d, width: 30, depth: 26, height: 10, key: o.key ?? 240 });
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
    S.update((lt) => { const p = ((Math.floor(lt * 3) % 3) + 3) % 3; const k = ['ALP', 'LNP', 'ONP'][p]; for (let i = 0; i < N; i++) ch.set(i, COL[k], 0.6 + 0.5 * Math.sin(lt * 6 + i)); ch.commit(); });
    ui.kicker(S, { t0: 0, text: `Victoria votes in ${d.days} days`, y: 372 });
    ui.headline(S, { t0: 0, html: 'Which party <em>are you?</em>', y: 410, size: 110, style: 'slam', stagger: 0.04, t1: S.dur + 1 });
    ui.block(S, { t0: 0.4, html: '5 questions · pick <b>A</b>, <b>B</b> or <b>C</b> · keep track', cls: 'body', y: 690, w: 920, size: 46, t1: S.dur + 1 });
  });

  Q.forEach((q, i) => E.defineScene('q' + i, (S) => {
    const ch = hall(S, { key: 220 + (i % 3) * 30 });
    E.camPath(S, CAMS[i % 3], { shake: 0.02, shiftY: 300, focusOn: true });
    S.aperture = 0.2;
    q.o.forEach((_, j) => E.cue(S.t0 + 0.6 + j * 0.7, 'pop', { i: j }));
    [3.4, 4.2, 5.0].forEach((t) => E.cue(S.t0 + t, 'tick', { k: 0.5 }));
    S.update((lt) => { for (let j = 0; j < N; j++) ch.set(j, WARM, 0.25 + 0.15 * Math.sin(lt * 4 + j)); ch.commit(); });
    ui.kicker(S, { t0: 0.02, text: `Question ${i + 1} of ${Q.length}`, y: 372 });
    ui.headline(S, { t0: 0.08, html: q.t, y: 410, size: 74, style: 'rise' });
    ui.list(S, { t0: 0.6, stagger: 0.7, y: 560, w: 900, size: 44, mark: '', markColor: NEUTRAL,
      items: q.o.map(([txt], j) => `<b style="color:${NEUTRAL}">${L[j]}</b>&nbsp;&nbsp;${txt}`) });
    ui.block(S, { t0: 3.2, html: '⏸ Pause and pick', cls: 'body', y: 820, align: 'center', size: 36 });
  }));

  E.defineScene('key', (S) => {
    const ch = hall(S, { key: 280 });
    E.camPath(S, [{ t: 0, pos: [0, 12, 13.5], look: [0, 0, -2.5], fov: 44 }, { t: 6, pos: [0, 11, 12.5], look: [0, 0.3, -2.8], fov: 44 }], { shake: 0.015, shiftY: 300, focusOn: true });
    S.aperture = 0.1;
    const third = Math.floor(N / 3);
    S.update((lt) => { for (let j = 0; j < N; j++) { const c = j < third ? COL.ALP : j < 2 * third ? COL.LNP : COL.ONP; ch.set(j, c, 0.5 + 0.3 * Math.sin(lt * 3 + j * 0.2)); } ch.commit(); });
    ui.kicker(S, { t0: 0.05, text: 'Answer key · pause it', y: 372 });
    ui.list(S, { t0: 0.4, stagger: 0.5, y: 410, w: 920, size: 38, mark: '', markColor: NEUTRAL,
      items: Q.map((q, i) => `<b>${i + 1}.</b> ` + q.o.map(([, p], j) => `<b>${L[j]}</b> <span style="color:${CSS[p]}">${NAME[p]}</span>`).join(' &nbsp;·&nbsp; ')) });
  });

  E.defineScene('ask', (S) => {
    const ch = hall(S, { key: 220 });
    E.camPath(S, CAMS[0], { shake: 0.02, focusOn: true });
    S.aperture = 0.35;
    S.update((lt) => { const p = ((Math.floor(lt * 1.5) % 3) + 3) % 3; const k = ['ALP', 'LNP', 'ONP'][p]; for (let i = 0; i < N; i++) ch.set(i, COL[k], 0.8 + 0.4 * Math.sin(lt * 4 + i * 0.3)); ch.commit(); });
    ui.kicker(S, { t0: 0.05, text: 'Your result', y: 372 });
    ui.headline(S, { t0: 0.1, html: 'Which party <em>did you get?</em>', y: 410, size: 100, style: 'rise' });
    ui.block(S, { t0: 0.9, html: `Comment <b style="color:${CSS.ALP}">Labor</b>, <b style="color:${CSS.LNP}">Liberal</b> or <b style="color:${CSS.ONP}">One Nation</b> 👇`, cls: 'body', y: 680, w: 920, size: 44 });
    ui.block(S, { t0: 1.6, html: '<b>Share</b> it with someone who doesn\'t know who to vote for', cls: 'body', y: 790, w: 920, size: 38 });
  });

  E.defineScene('end', (S) => endCard(S, { title: 'Know your <em>vote</em>', sub: 'poltok.netlify.app/au/victoria', sources: 'Every option is a real Labor, Liberal–National or One Nation promise, per the ABC News Victorian policy tracker (4 Nov 2026).<br>For fun, not voting advice. Check each party\'s full platform.' }));
}
