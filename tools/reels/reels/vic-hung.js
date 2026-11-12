// Reel — Victoria 2026 "What if nobody wins?": the hung-parliament scenarios, using only on-the-record positions.
// Sources: ABC News analysis (Casey Briggs, 3 Oct 2026): 45 of 88 for a majority; the Coalition must hold its seats and
// win at least 16 more; short of that it "could consider a formal governing agreement with One Nation" or negotiate bill
// by bill; if Labor and the Greens lose their combined majority there would "probably be no real alternative to a Wilson
// premiership". The Age / Resolve report (9 Nov 2026): Wilson has ruled out governing in coalition with One Nation but not
// relying on it for confidence and supply; Carroll would "throw the keys back" rather than govern with the Greens.
// News24 / The Australian (Nov 2026): Coalition and One Nation to preference each other ahead of Labor in key seats.
// Poll average: live, same method as vic-what-if.js. Seat layouts are ILLUSTRATIVE, not projections.

export async function data() {
  const { data: vic } = await import('./vic-what-if.js');
  const d = await vic();
  return { avg: d.avg, nPolls: d.polls.length, days: d.days };
}

export const meta = {
  title: 'What if nobody wins Victoria?',
  label: 'VIC 2026 · WHAT IF',
  out: 'poltok-vic-hung-parliament',
  cover: 1.6,
  music: { prog: ['Em', 'C', 'G', 'D'], arp: 'updown', seed: 133, swing: 0.04 },
};

export const scenes = (d) => [
  { id: 'hook', beats: 6, energy: 3, voLead: 0.08, say: 'What if nobody wins Victoria?' },
  { id: 'line', beats: 10, energy: 2, trans: { type: 'zoom', dur: 0.45 },
    say: `You need forty-five of eighty-eight seats. The Coalition leads the polls on ${Math.round(d.avg.LNP)}, but it needs sixteen more seats to get there.`,
    cap: `45 of 88 to govern. The Coalition leads on ${d.avg.LNP}% but needs 16 more seats.` },
  { id: 'onp', beats: 10, energy: 3, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: 'Fall short, and One Nation could decide it. Jess Wilson has ruled out a coalition with them, but not relying on their support.',
    cap: 'Wilson: no coalition with One Nation, but hasn\'t ruled out relying on its support.' },
  { id: 'grn', beats: 10, energy: 3, trans: { type: 'whip', dir: 'right', dur: 0.42 },
    say: 'On the other side, Ben Carroll says he\'d throw the keys back rather than govern with the Greens.',
    cap: 'Carroll: would "throw the keys back" rather than govern with the Greens.' },
  { id: 'prefs', beats: 8, energy: 2, trans: { type: 'flash', dur: 0.36 },
    say: 'And in key seats, the Coalition and One Nation are preferencing each other ahead of Labor.',
    cap: 'Key seats: Coalition and One Nation preference each other ahead of Labor.' },
  { id: 'ask', beats: 8, energy: 2, trans: { type: 'zoom', dur: 0.45 },
    say: 'So who should hold the balance of power? Tell me in the comments.', cap: 'Who should hold the balance of power? 👇' },
  { id: 'end', beats: 6, energy: 0, trans: { type: 'zoom', dur: 0.5 }, noProgress: true },
];

export function build({ E, kit, ui, THREE, endCard, real }) {
  const { C, ease, remap } = E;
  const d = E.data;
  const N = 88, MAJ = 45, WARM = 0xffe2b0;
  const COL = { ALP: 0xe53935, LNP: 0x1f5fd1, ONP: 0xd9480f, GRN: 0x2fa84f, IND: 0x9aa3b2 };
  const CSS = { ALP: '#ff6b6b', LNP: '#6ea2ff', ONP: '#ff9a4a', GRN: '#5fd17f' };
  const hall = (S, o = {}) => {
    real.room(S, { carpet: 0x2d4a33, wood: 0x5a361d, width: 30, depth: 26, height: 10, key: o.key ?? 260 });
    const ch = real.chamber(N, { rows: 5, r0: 3.4, r1: 7.6, leather: 0x1f5a38, wood: 0x6a3d1f, open: 0.6 });
    S.scene.add(ch.group);
    return ch;
  };
  // an ILLUSTRATIVE hung chamber, left → right: Greens, Labor, others, One Nation, Coalition (no majority anywhere)
  const blocks = [['GRN', 6], ['ALP', 25], ['IND', 3], ['ONP', 12], ['LNP', 42]];
  const seatCol = []; blocks.forEach(([k, n]) => { for (let i = 0; i < n; i++) seatCol.push(k); });
  const light = (ch, fn) => { for (let i = 0; i < N; i++) { const [c, k] = fn(i, seatCol[i]); ch.set(i, c, k); } ch.commit(); };
  const WIDE = [{ t: 0, pos: [0, 12, 13.5], look: [0, 0, -2.5], fov: 44 }, { t: 6, pos: [0, 11, 12.5], look: [0, 0.3, -2.8], fov: 44 }];

  E.defineScene('hook', (S) => {
    const ch = hall(S);
    E.camPath(S, [{ t: 0, pos: [0, 2.2, 6.2], look: [0, 1.0, -5], fov: 36 }, { t: S.dur + 0.4, pos: [0.6, 4.0, 10], look: [0, 0.7, -3.5], fov: 36 }], { shake: 0.025, focusOn: true });
    S.aperture = 0.3;
    E.cue(S.t0 + 0.3, 'boom', { g: 0.7 });
    S.update((lt) => light(ch, (i, k) => [COL[k], 1.2 * ease.back(remap(lt, 0.1 + (i / N) * 1.2, 0.4 + (i / N) * 1.2))]));
    ui.kicker(S, { t0: 0, text: `Victoria votes in ${d.days} days`, y: 372 });
    ui.headline(S, { t0: 0, html: 'What if <em>nobody</em> wins?', y: 410, size: 92, style: 'slam', stagger: 0.04, t1: S.dur + 1 });
    ui.block(S, { t0: 0.3, html: 'The hung parliament scenarios, explained', cls: 'body', y: 560, w: 920, size: 46, t1: S.dur + 1 });
  });

  E.defineScene('line', (S) => {
    const ch = hall(S, { key: 240 });
    E.camPath(S, WIDE, { shake: 0.015, shiftY: 280, focusOn: true });
    S.aperture = 0.1;
    S.update((lt) => { const k = ease.inOut(remap(lt, 0.3, 1.6)); light(ch, (i) => [i >= N - MAJ * k ? C.lime : WARM, i >= N - MAJ * k ? 1.3 : 0.2]); });
    ui.kicker(S, { t0: 0.05, text: 'The magic number', y: 372 });
    ui.counter(S, { t0: 0.3, dur: 1.3, to: MAJ, y: 400, size: 200, color: '#c8f04a', label: 'of 88 seats to govern alone' });
    ui.block(S, { t0: 1.8, html: `Coalition: <b style="color:${CSS.LNP}">${d.avg.LNP}%</b> in the polls, but needs <b>16 more seats</b>`, cls: 'body', y: 660, align: 'center', size: 42 });
  });

  E.defineScene('onp', (S) => {
    const ch = hall(S);
    E.camPath(S, [{ t: 0, pos: [6, 6.5, 9], look: [1.5, 0.4, -3], fov: 40 }, { t: 6, pos: [4, 7.5, 10.5], look: [0.5, 0.4, -3], fov: 40 }], { shake: 0.015, shiftY: 300, focusOn: true });
    S.aperture = 0.2;
    S.update((lt) => light(ch, (i, k) => [COL[k], k === 'ONP' ? 1.0 + 0.8 * Math.abs(Math.sin(lt * 4)) : k === 'LNP' ? 1.1 : 0.2]));
    ui.kicker(S, { t0: 0.05, text: 'Scenario 1 · Coalition falls short', y: 372 });
    ui.headline(S, { t0: 0.1, html: '<em style="color:#ff9a4a">One Nation</em> decides', y: 410, size: 96, style: 'rise' });
    ui.list(S, { t0: 1.4, stagger: 1.0, y: 560, size: 42, mark: '●', markColor: CSS.LNP, items: ['Wilson: <b>no coalition</b> with One Nation', 'But <b>hasn\'t ruled out</b> relying on its support'] });
  });

  E.defineScene('grn', (S) => {
    const ch = hall(S);
    E.camPath(S, [{ t: 0, pos: [-6, 6.5, 9], look: [-1.5, 0.4, -3], fov: 40 }, { t: 6, pos: [-4, 7.5, 10.5], look: [-0.5, 0.4, -3], fov: 40 }], { shake: 0.015, shiftY: 300, focusOn: true });
    S.aperture = 0.2;
    S.update((lt) => light(ch, (i, k) => [COL[k], k === 'GRN' ? 1.0 + 0.8 * Math.abs(Math.sin(lt * 4)) : k === 'ALP' ? 1.1 : 0.2]));
    ui.kicker(S, { t0: 0.05, text: 'Scenario 2 · Labor and the Greens', y: 372 });
    ui.headline(S, { t0: 0.1, html: '“Throw the <em>keys back</em>”', y: 410, size: 76, style: 'rise' });
    ui.block(S, { t0: 1.2, html: `<b style="color:${CSS.ALP}">Ben Carroll</b>, rather than govern with the <b style="color:${CSS.GRN}">Greens</b>`, cls: 'body', y: 560, w: 920, size: 44 });
  });

  E.defineScene('prefs', (S) => {
    const ch = hall(S, { key: 240 });
    E.camPath(S, WIDE, { shake: 0.015, shiftY: 280, focusOn: true });
    S.aperture = 0.1;
    S.update((lt) => light(ch, (i, k) => [COL[k], k === 'ONP' || k === 'LNP' ? 1.0 + 0.4 * Math.sin(lt * 5 + i * 0.2) : 0.2]));
    ui.kicker(S, { t0: 0.05, text: 'The preference deal', y: 372 });
    ui.headline(S, { t0: 0.1, html: `<span style="color:${CSS.LNP}">Coalition</span> ⇄ <span style="color:${CSS.ONP}">One Nation</span>`, y: 410, size: 64, style: 'rise' });
    ui.block(S, { t0: 0.9, html: 'Preferencing each other <b>ahead of Labor</b> in key seats', cls: 'body', y: 560, w: 920, size: 44 });
  });

  E.defineScene('ask', (S) => {
    const ch = hall(S, { key: 220 });
    E.camPath(S, [{ t: 0, pos: [-3, 2.4, 6.2], look: [0, 1, -5], fov: 36 }, { t: 6, pos: [2, 3.4, 9], look: [0, 0.8, -4], fov: 36 }], { shake: 0.02, focusOn: true });
    S.aperture = 0.35;
    S.update((lt) => light(ch, (i, k) => [COL[k], 0.9 + 0.4 * Math.sin(lt * 4 + i * 0.3)]));
    ui.kicker(S, { t0: 0.05, text: 'Your turn', y: 372 });
    ui.headline(S, { t0: 0.1, html: 'Who should hold the <em>balance of power?</em>', y: 410, size: 88, style: 'rise' });
    ui.block(S, { t0: 0.9, html: '<b style="color:#c8f04a">Comment</b> 👇 &nbsp;·&nbsp; <b>Follow</b> for election night, live', cls: 'body', y: 640, w: 920, size: 42 });
  });

  E.defineScene('end', (S) => endCard(S, { title: 'Election night, <em>live</em>', sub: 'poltok.netlify.app/au/victoria', sources: 'Sources: ABC News analysis (3 Oct); The Age/Resolve (9 Nov); The Australian via News24 (Nov 2026).<br>Seat layouts are illustrative, not projections.' }));
}
