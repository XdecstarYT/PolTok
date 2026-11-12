// Reel — UK "What if they won?": Labour, the Conservatives or Reform UK at the next general election (due by Aug 2029).
// Polls: LIVE, same Wikipedia tables and method as uk-polls.js (average of polls in the last 14 days).
// Policies (each party's own, as reported): Labour/Burnham — digital ID scrapped, VAT removed from household electricity
// bills from 1 Oct 2026, national care service accelerated, council housebuilding push (BBC via Wikipedia "2026 in UK
// politics"; Full Fact government tracker). Conservatives/Badenoch — CPC26: abolish stamp duty on main homes, abolish
// inheritance tax on the family home, £36bn a year welfare cut (conservatives.com; GB News; Tax Policy Associates).
// Reform/Farage — Sept 2026 conference: £80bn public spending cut within five years via welfare, net zero, overseas aid and
// civil service cuts; £50bn welfare cuts (Jenrick, Aug 2026) (BBC via Wikipedia). Same number of promises per party.

export async function data() {
  const { data: polls } = await import('./uk-polls.js');
  const d = await polls();
  return { now: d.now, nRecent: d.nRecent, latestLabel: d.latestLabel };
}

export const meta = {
  title: 'What if they ran Britain?',
  label: 'UK · WHAT IF',
  out: 'poltok-uk-what-if',
  cover: 1.6,
  music: { prog: ['Gm', 'Eb', 'Bb', 'F'], arp: 'up', seed: 163, swing: 0.04 },
};

const R = Math.round;
const BURN = '[Burnham](/bˈɝnəm/)', BADE = '[Badenoch](/bˈeɪdənɑːk/)', FAR = '[Farage](/fˈæɹɑːʒ/)';

export const scenes = (d) => [
  { id: 'hook', beats: 6, energy: 3, voLead: 0.08, say: 'What if Labour, the Tories, or Reform won the next UK election?' },
  { id: 'polls', beats: 8, energy: 2, trans: { type: 'zoom', dur: 0.45 },
    say: `Right now, Labour's on ${R(d.now.Lab)}. The Tories, ${R(d.now.Con)}. Reform, ${R(d.now.Ref)}.`,
    cap: `Latest polls: Labour ${d.now.Lab}% · Conservatives ${d.now.Con}% · Reform ${d.now.Ref}%` },
  { id: 'lab', beats: 10, energy: 3, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: `If Labour wins, Andy ${BURN} stays PM. A national care service. And a big council housebuilding push.`,
    cap: 'Labour: Burnham stays · national care service · council housebuilding' },
  { id: 'con', beats: 10, energy: 3, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: `If the Tories win, Kemi ${BADE} is PM. Stamp duty on your home, gone. And thirty-six billion cut from welfare.`,
    cap: 'Conservatives: Badenoch PM · no stamp duty on main homes · £36bn welfare cut' },
  { id: 'ref', beats: 10, energy: 3, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: `If Reform wins, Nigel ${FAR} is PM. Eighty billion in spending cuts. Including welfare, and net zero.`,
    cap: 'Reform: Farage PM · £80bn spending cuts, including welfare and net zero' },
  { id: 'ask', beats: 8, energy: 2, trans: { type: 'zoom', dur: 0.45 },
    say: 'So which one would you pick? Comment Labour, Tory, or Reform.', cap: 'Labour, Tory or Reform? Comment 👇' },
  { id: 'end', beats: 6, energy: 0, trans: { type: 'zoom', dur: 0.5 }, noProgress: true },
];

export function build({ E, kit, ui, THREE, endCard, real }) {
  const { C, ease, remap } = E;
  const d = E.data;
  const N = 650, MAJ = 326, WARM = 0xffe2b0;
  const COL = { Lab: 0xe4003b, Con: 0x0087dc, Ref: 0x12b6cf, LD: 0xfaa61a, Grn: 0x02a95b };
  const CSS = { Lab: '#ff4d6d', Con: '#3fa9ff', Ref: '#2fd3e6', LD: '#ffb03b', Grn: '#3ed17a' };
  const hall = (S, o = {}) => {
    real.room(S, { carpet: 0x1f4a2c, wood: 0x5a361d, width: 40, depth: 34, height: 12, key: o.key ?? 340 });
    const ch = real.chamber(N, { rows: 13, r0: 3.4, r1: 11.0, leather: 0x1d5634, wood: 0x6a3d1f, open: 0.6 });
    S.scene.add(ch.group);
    return ch;
  };
  const order = Array.from({ length: N }, (_, i) => i).sort((a, b) => Math.abs(a - (N - 1) / 2) - Math.abs(b - (N - 1) / 2));
  const rank = new Array(N); order.forEach((s, j) => { rank[s] = j; });
  const WIDE = [{ t: 0, pos: [0, 16, 17.5], look: [0, 0, -3.5], fov: 44 }, { t: 6, pos: [0, 15, 16.5], look: [0, 0.3, -3.6], fov: 44 }];

  E.defineScene('hook', (S) => {
    const ch = hall(S);
    E.camPath(S, [{ t: 0, pos: [0, 2.6, 7.5], look: [0, 1.0, -6], fov: 38 }, { t: S.dur + 0.4, pos: [0.8, 5.5, 14], look: [0, 0.7, -4], fov: 38 }], { shake: 0.025, focusOn: true });
    S.aperture = 0.3;
    const cyc = [COL.Lab, COL.Con, COL.Ref];
    E.cue(S.t0 + 0.3, 'boom', { g: 0.7 });
    S.update((lt) => { const p = Math.floor(lt * 1.6) % 3; for (let i = 0; i < N; i++) ch.set(i, rank[i] < MAJ ? cyc[p] : WARM, rank[i] < MAJ ? 1.3 : 0.25); ch.commit(); });
    ui.kicker(S, { t0: 0, text: 'Next UK general election · due by 2029', y: 372 });
    ui.headline(S, { t0: 0, html: 'What if <em>they</em> ran Britain?', y: 410, size: 84, style: 'slam', stagger: 0.04, t1: S.dur + 1 });
    ui.block(S, { t0: 0.35, html: `<b style="color:${CSS.Lab}">Labour</b> · <b style="color:${CSS.Con}">Conservative</b> · <b style="color:${CSS.Ref}">Reform</b><br>The real policies, side by side`, cls: 'body', y: 660, w: 920, size: 46, t1: S.dur + 1 });
  });

  E.defineScene('polls', (S) => {
    const ch = hall(S, { key: 300 });
    const a = d.now; const seatsFor = (v) => R((v / 100) * N);
    const cols = [...Array(seatsFor(a.Grn)).fill(COL.Grn), ...Array(seatsFor(a.Lab)).fill(COL.Lab), ...Array(seatsFor(a.LD)).fill(COL.LD), ...Array(seatsFor(a.Con)).fill(COL.Con), ...Array(seatsFor(a.Ref)).fill(COL.Ref)];
    E.camPath(S, WIDE, { shake: 0.015, shiftY: 280, focusOn: true });
    S.aperture = 0.1;
    S.update((lt) => { for (let i = 0; i < N; i++) ch.set(i, cols[i] ?? WARM, (cols[i] ? 1.2 : 0.2) * ease.back(remap(lt, 0.2 + (i / N) * 1.2, 0.5 + (i / N) * 1.2))); ch.commit(); });
    ui.kicker(S, { t0: 0.05, text: `Last ${d.nRecent} polls · to ${d.latestLabel}`, y: 372 });
    const rows = ['Lab', 'Con', 'Ref'].sort((x, y) => a[y] - a[x]);
    const NAME = { Lab: 'Labour', Con: 'Conservatives', Ref: 'Reform UK' };
    rows.forEach((k, i) => ui.counter(S, { t0: 0.3 + i * 0.3, dur: 0.9, to: a[k], decimals: 1, suffix: '%', y: 400 + i * 115, x: 80, w: 920, size: 76, color: CSS[k], label: NAME[k], ticks: i === 0 }));
  });

  const ifWins = (id, k, kicker, head, items, cam) => E.defineScene(id, (S) => {
    const ch = hall(S, { key: 340 });
    E.camPath(S, cam, { shake: 0.02, shiftY: 300, focusOn: true });
    S.aperture = 0.2;
    E.cue(S.t0 + 0.4, 'boom', { g: 0.45 });
    S.update((lt) => { for (let i = 0; i < N; i++) { const on = rank[i] < MAJ; ch.set(i, on ? COL[k] : WARM, on ? 1.4 * ease.back(remap(lt, 0.3 + rank[i] * 0.0025, 0.6 + rank[i] * 0.0025)) : 0.2); } ch.commit(); });
    ui.kicker(S, { t0: 0.05, text: kicker, y: 372 });
    ui.headline(S, { t0: 0.1, html: head, y: 410, size: 78, style: 'rise' });
    ui.list(S, { t0: 0.7, stagger: (S.dur - 2.2) / items.length, y: 540, w: 880, size: 40, mark: '●', markColor: CSS[k], items });
  });
  ifWins('lab', 'Lab', 'What if Labour wins?', `<span style="color:${CSS.Lab}">PM</span> <em>Andy Burnham</em>`,
    ['A <b>national care service</b>, sooner', 'Big <b>council housebuilding</b> push', '<b>No VAT</b> on household electricity', '<b>Digital ID</b> scrapped'],
    [{ t: 0, pos: [-9, 9, 13], look: [0, 0.4, -4], fov: 40 }, { t: 6, pos: [-7, 10, 14.5], look: [0, 0.4, -4], fov: 40 }]);
  ifWins('con', 'Con', 'What if the Tories win?', `<span style="color:${CSS.Con}">PM</span> <em>Kemi Badenoch</em>`,
    ['<b>No stamp duty</b> on your main home', '<b>No inheritance tax</b> on the family home', '<b>£36bn</b> a year cut from welfare', 'Plus overseas aid cuts'],
    [{ t: 0, pos: [9, 9, 13], look: [0, 0.4, -4], fov: 40 }, { t: 6, pos: [7, 10, 14.5], look: [0, 0.4, -4], fov: 40 }]);
  ifWins('ref', 'Ref', 'What if Reform wins?', `<span style="color:${CSS.Ref}">PM</span> <em>Nigel Farage</em>`,
    ['<b>£80bn</b> spending cuts in five years', '<b>£50bn</b> of that from welfare', 'Cuts to <b>net zero</b> spending', 'Fewer <b>civil servants</b>, less aid'],
    [{ t: 0, pos: [0, 3.4, 10], look: [0, 0.8, -6], fov: 38 }, { t: 6, pos: [0, 6, 15], look: [0, 0.6, -5], fov: 38 }]);

  E.defineScene('ask', (S) => {
    const ch = hall(S, { key: 280 });
    E.camPath(S, [{ t: 0, pos: [-3, 2.8, 8], look: [0, 1, -6], fov: 38 }, { t: 6, pos: [2, 3.4, 10], look: [0, 0.9, -5], fov: 38 }], { shake: 0.02, focusOn: true });
    S.aperture = 0.35;
    const third = Math.floor(N / 3);
    S.update((lt) => { for (let i = 0; i < N; i++) { const c = i < third ? COL.Lab : i < 2 * third ? COL.Con : COL.Ref; ch.set(i, c, 0.9 + 0.4 * Math.sin(lt * 4 + i * 0.1)); } ch.commit(); });
    ui.kicker(S, { t0: 0.05, text: 'Your vote', y: 372 });
    ui.headline(S, { t0: 0.1, html: 'Which one would <em>you pick?</em>', y: 410, size: 100, style: 'rise' });
    ui.block(S, { t0: 0.9, html: `Comment <b style="color:${CSS.Lab}">Labour</b>, <b style="color:${CSS.Con}">Tory</b> or <b style="color:${CSS.Ref}">Reform</b> 👇`, cls: 'body', y: 640, w: 920, size: 44 });
    ui.block(S, { t0: 1.6, html: '<b>Follow</b> for the polls every week', cls: 'body', y: 760, w: 920, size: 42 });
  });

  E.defineScene('end', (S) => endCard(S, { title: 'Polls, <em>live</em>', sub: 'poltok.netlify.app', sources: `Policies: party announcements and 2026 conferences, as reported by BBC News, Full Fact and others.<br>Polls: PolTok average to ${d.latestLabel}. Seat lighting is illustrative, not a prediction.` }));
}
