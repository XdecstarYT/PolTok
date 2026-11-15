// Reel (viral, interactive) — "Red flag or green flag? Victorian election promises." Six real promises, two per party,
// shown without the party name; viewers judge, then the party is revealed. Every promise is the party's own, per the ABC
// News Victorian election policy tracker (4 Nov 2026), the same set used in vic-which-party.js.

export async function data() {
  const now = new Date();
  return { days: Math.round((Date.UTC(2026, 10, 28) - Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) / 864e5) };
}

export const meta = {
  title: 'Red flag or green flag?',
  label: 'VIC 2026 · YOU DECIDE',
  out: 'poltok-red-flag-green-flag-vic',
  cover: 1.2,
  music: { prog: ['Gm', 'Eb', 'Bb', 'F'], arp: 'up', seed: 389, swing: 0.06 },
};

// [card text, spoken text, party]
const P = [
  ['Charge kids as adults for serious violent crime', 'Charge kids as adults, for serious violent crime.', 'ONP'],
  ['Cap public transport fares at $30 a week', 'Cap public transport fares at thirty dollars a week.', 'ALP'],
  ['No stamp duty on first homes up to $1 million', 'No stamp duty on first homes, up to one million dollars.', 'LNP'],
  ['1,500 more police', 'Fifteen hundred more police.', 'ALP'],
  ['Cancel the Suburban Rail Loop', 'Cancel the Suburban Rail Loop.', 'ONP'],
  ['Cap tolls at $50 a week', 'Cap tolls at fifty dollars a week.', 'LNP'],
];
const NAME = { ALP: 'Labor', LNP: 'the Liberals', ONP: 'One Nation' };
const SHORT = { ALP: 'Labor', LNP: 'Liberal–National', ONP: 'One Nation' };

export const scenes = (d) => [
  { id: 'hook', beats: 6, energy: 3, voLead: 0.06, say: 'Real Victorian election promises. Red flag, or green flag? Party revealed after each one.',
    cap: 'Red flag 🚩 or green flag 🟢? Real Vic promises.' },
  ...P.flatMap(([card, spoken, p], i) => [
    { id: 'p' + i, beats: 7, energy: i % 2 ? 2 : 3, trans: { type: i % 2 ? 'whip' : 'flash', dir: 'left', dur: 0.36 },
      say: `${spoken} Red flag, or green flag?`, cap: `${i + 1}/6 · ${card}: 🚩 or 🟢?` },
    { id: 'r' + i, beats: 4, energy: 3, trans: { type: 'flash', dur: 0.3 }, say: `That's ${NAME[p]}.`, cap: `That's ${SHORT[p]}.` },
  ]),
  { id: 'ask', beats: 8, energy: 2, trans: { type: 'zoom', dur: 0.45 },
    say: `Which one's the biggest red flag? Comment the number. Victoria votes in ${d.days} days.`, cap: 'Biggest red flag? Comment the number 👇' },
  { id: 'end', beats: 6, energy: 0, trans: { type: 'zoom', dur: 0.5 }, noProgress: true },
];

export function build({ E, kit, ui, THREE, endCard, real }) {
  const { ease, remap } = E;
  const COL = { ALP: 0xe53935, LNP: 0x1f5fd1, ONP: 0xd9480f };
  const CSS = { ALP: '#ff6b6b', LNP: '#6ea2ff', ONP: '#ff9a4a' };
  const RED = 0xe0312b, GREEN = 0x2fbf55;
  const N = 88;
  const hall = (S, o = {}) => {
    real.room(S, { carpet: 0x2d4a33, wood: 0x5a361d, width: 30, depth: 26, height: 10, key: o.key ?? 240 });
    const ch = real.chamber(N, { rows: 5, r0: 3.4, r1: 7.6, leather: 0x1f5a38, wood: 0x6a3d1f, open: 0.6 });
    S.scene.add(ch.group); return ch;
  };
  const CAMS = [
    [{ t: 0, pos: [-6, 6.5, 9], look: [0, 0.4, -3], fov: 40 }, { t: 6, pos: [-4.5, 7.2, 10.2], look: [0, 0.4, -3], fov: 40 }],
    [{ t: 0, pos: [6, 6.5, 9], look: [0, 0.4, -3], fov: 40 }, { t: 6, pos: [4.5, 7.2, 10.2], look: [0, 0.4, -3], fov: 40 }],
  ];
  // left half red, right half green, pulsing
  const split = (ch, lt, k = 1) => { for (let j = 0; j < N; j++) { const red = (j % 22) < 11; ch.set(j, red ? RED : GREEN, k * (0.5 + 0.35 * Math.sin(lt * 5 + (red ? 0 : Math.PI)))); } ch.commit(); };

  E.defineScene('hook', (S) => {
    const ch = hall(S);
    E.camPath(S, [{ t: 0, pos: [0, 2.6, 7], look: [0, 1, -5], fov: 36 }, { t: 6, pos: [0, 3.4, 9], look: [0, 0.8, -4], fov: 36 }], { shake: 0.025, shiftY: 200, focusOn: true });
    S.aperture = 0.3;
    E.cue(S.t0 + 0.2, 'boom', { g: 0.8 });
    S.update((lt) => split(ch, lt));
    ui.kicker(S, { t0: 0, text: 'Victorian election promises', y: 372 });
    ui.headline(S, { t0: 0, html: '<span style="color:#ff5a52">Red flag</span> or <span style="color:#5fe07f">green flag?</span>', y: 410, size: 100, style: 'slam', stagger: 0.04, t1: S.dur + 1 });
    ui.block(S, { t0: 0.5, html: '6 real promises · party revealed after each', cls: 'body', y: 660, w: 920, size: 44, t1: S.dur + 1 });
  });

  P.forEach(([card, , p], i) => {
    E.defineScene('p' + i, (S) => {
      const ch = hall(S, { key: 210 + (i % 2) * 30 });
      E.camPath(S, CAMS[i % 2], { shake: 0.02, shiftY: 300, focusOn: true });
      S.aperture = 0.2;
      [2.6, 3.4, 4.2].forEach((t) => E.cue(S.t0 + t, 'tick', { k: 0.5 }));
      S.update((lt) => split(ch, lt, 0.8));
      ui.kicker(S, { t0: 0.02, text: `Promise ${i + 1} of ${P.length} · party hidden`, y: 372 });
      ui.headline(S, { t0: 0.08, html: `“${card}”`, y: 410, size: 78, style: 'rise' });
      ui.block(S, { t0: 2.0, html: '🚩 or 🟢 &nbsp;· comment it', cls: 'body', y: 700, align: 'center', size: 44 });
    });
    E.defineScene('r' + i, (S) => {
      const ch = hall(S, { key: 280 });
      E.camPath(S, [{ t: 0, pos: [0, 12, 13.5], look: [0, 0, -2.5], fov: 44 }, { t: 4, pos: [0, 11, 12.5], look: [0, 0.3, -2.8], fov: 44 }], { shake: 0.015, shiftY: 300, focusOn: true });
      S.aperture = 0.1;
      E.cue(S.t0 + 0.1, 'boom', { g: 0.5 });
      S.update((lt) => { const k = ease.expo(remap(lt, 0, 0.8)); for (let j = 0; j < N; j++) ch.set(j, COL[p], 0.3 + 1.0 * k * (j / N < k ? 1 : 0.2)); ch.commit(); });
      ui.kicker(S, { t0: 0.02, text: `Promise ${i + 1} · revealed`, y: 372 });
      ui.headline(S, { t0: 0.05, html: `<span style="color:${CSS[p]}">${SHORT[p]}</span>`, y: 410, size: 120, style: 'slam' });
      ui.block(S, { t0: 0.3, html: `“${card}”`, cls: 'body', y: 580, w: 920, size: 40 });
    });
  });

  E.defineScene('ask', (S) => {
    const ch = hall(S, { key: 220 });
    E.camPath(S, [{ t: 0, pos: [0, 2.6, 7], look: [0, 1, -5], fov: 36 }, { t: 6, pos: [0, 3.4, 9], look: [0, 0.8, -4], fov: 36 }], { shake: 0.02, shiftY: 200, focusOn: true });
    S.aperture = 0.35;
    S.update((lt) => split(ch, lt));
    ui.kicker(S, { t0: 0.05, text: 'Your verdict', y: 372 });
    ui.headline(S, { t0: 0.1, html: 'Biggest <span style="color:#ff5a52">red flag?</span>', y: 410, size: 104, style: 'rise' });
    ui.list(S, { t0: 0.6, stagger: 0.15, y: 580, w: 920, size: 32, mark: '', items: P.map(([card, , p], i) => `<b>${i + 1}.</b> ${card} <span style="color:${CSS[p]}">· ${SHORT[p]}</span>`) });
  });

  E.defineScene('end', (S) => endCard(S, { title: 'Know your <em>vote</em>', sub: 'poltok.netlify.app/au/victoria', sources: 'Every promise is a real Labor, Liberal–National or One Nation commitment, per the ABC News Victorian election policy tracker (4 Nov 2026).<br>Two per party. Not voting advice.' }));
}
