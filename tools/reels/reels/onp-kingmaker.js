// Reel — "In N days, One Nation could pick Victoria's premier." The hung-parliament scenario, on-the-record positions only.
// ABC (Casey Briggs, 3 Oct 2026): 45 of 88; short of a majority the Coalition "could consider a formal governing agreement with
// One Nation" or negotiate bill by bill. The Age/Resolve (9 Nov): Wilson rules out a coalition with One Nation but not relying
// on its support; Carroll would "throw the keys back" rather than govern with the Greens. The Australian via News24: Coalition
// and One Nation to preference each other ahead of Labor in key seats. Roy Morgan (4 Nov): One Nation could win regional seats
// that prevent a Coalition majority. One Nation 2022: 0.3% (VEC). Polls: live (vic-what-if.js). Seat layouts illustrative.

export async function data() {
  const { data: vic } = await import('./vic-what-if.js');
  const d = await vic();
  return { avg: d.avg, nPolls: d.polls.length, days: d.days };
}

export const meta = {
  title: 'One Nation: Victoria\'s kingmaker?',
  label: 'VIC 2026 · WHAT IF',
  out: 'poltok-one-nation-kingmaker',
  cover: 1.4,
  music: { prog: ['Em', 'C', 'G', 'D'], arp: 'updown', seed: 359, swing: 0.04 },
};

const R = Math.round;
const W = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];

export const scenes = (d) => [
  { id: 'hook', beats: 7, energy: 3, voLead: 0.06,
    say: `In ${W[d.days] ?? d.days} days, One Nation could decide who runs Victoria.` },
  { id: 'polls', beats: 10, energy: 2, trans: { type: 'zoom', dur: 0.45 },
    say: `At the last election, One Nation got under one percent. Now it's polling around ${R(d.avg.ONP)}. The Coalition leads on ${R(d.avg.LNP)}.`,
    cap: `2022: One Nation 0.3%. Now: One Nation ${d.avg.ONP}%, Coalition ${d.avg.LNP}%, Labor ${d.avg.ALP}%.` },
  { id: 'short', beats: 10, energy: 3, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: 'To govern alone, you need forty-five seats. Roy Morgan says One Nation could win enough regional seats to stop a Coalition majority.',
    cap: '45 of 88 to govern. Roy Morgan: One Nation regional wins could block a Coalition majority.' },
  { id: 'deal', beats: 11, energy: 3, trans: { type: 'flash', dur: 0.36 },
    say: 'Then what? Jess Wilson has ruled out a coalition with One Nation. But she hasn\'t ruled out relying on their support.',
    cap: 'Wilson: no coalition with One Nation, but hasn\'t ruled out relying on its support.' },
  { id: 'prefs', beats: 9, energy: 3, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: 'And in key seats, the Coalition and One Nation are already swapping preferences, ahead of Labor.',
    cap: 'Key seats: Coalition and One Nation preference each other ahead of Labor.' },
  { id: 'labor', beats: 8, energy: 2, trans: { type: 'whip', dir: 'right', dur: 0.42 },
    say: 'Labor\'s path? Ben Carroll says he\'d throw the keys back rather than govern with the Greens.',
    cap: 'Carroll: would "throw the keys back" rather than govern with the Greens.' },
  { id: 'ask', beats: 8, energy: 2, trans: { type: 'zoom', dur: 0.45 },
    say: 'So, should One Nation hold the balance of power? Yes or no, in the comments.', cap: 'Should One Nation hold the balance of power? 👇' },
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
  // ILLUSTRATIVE hung chamber, left → right: Greens, Labor, others, Coalition (41), One Nation (in the middle of the "short" gap)
  const blocks = [['GRN', 6], ['ALP', 26], ['IND', 3], ['ONP', 12], ['LNP', 41]];
  const seat = []; blocks.forEach(([k, n]) => { for (let i = 0; i < n; i++) seat.push(k); });
  const light = (ch, fn) => { for (let i = 0; i < N; i++) { const [c, k] = fn(i, seat[i]); ch.set(i, c, k); } ch.commit(); };
  const WIDE = [{ t: 0, pos: [0, 12, 13.5], look: [0, 0, -2.5], fov: 44 }, { t: 6, pos: [0, 11, 12.5], look: [0, 0.3, -2.8], fov: 44 }];

  E.defineScene('hook', (S) => {
    const ch = hall(S);
    E.camPath(S, [{ t: 0, pos: [3.5, 2.2, 5.5], look: [1.6, 1.0, -5], fov: 36 }, { t: S.dur + 0.4, pos: [0.6, 4.0, 10], look: [0, 0.7, -3.5], fov: 36 }], { shake: 0.025, focusOn: true });
    S.aperture = 0.3;
    E.cue(S.t0 + 0.3, 'boom', { g: 0.9 });
    S.update((lt) => light(ch, (i, k) => [k === 'ONP' ? COL.ONP : WARM, k === 'ONP' ? 1.2 + 0.8 * Math.abs(Math.sin(lt * 4)) : 0.18]));
    ui.kicker(S, { t0: 0, text: `Victoria votes in ${d.days} days`, y: 372 });
    ui.headline(S, { t0: 0, html: '<em style="color:#ff9a4a">One Nation</em>: kingmaker?', y: 410, size: 100, style: 'slam', stagger: 0.04, t1: S.dur + 1 });
  });

  E.defineScene('polls', (S) => {
    const ch = hall(S, { key: 240 });
    E.camPath(S, WIDE, { shake: 0.015, shiftY: 280, focusOn: true });
    S.aperture = 0.1;
    S.update((lt) => light(ch, (i, k) => [COL[k], 1.1 * ease.back(remap(lt, 0.2 + (i / N) * 1.2, 0.5 + (i / N) * 1.2))]));
    ui.kicker(S, { t0: 0.05, text: `Latest ${d.nPolls} polls · seats illustrative`, y: 372 });
    ui.counter(S, { t0: 0.3, dur: 0.6, to: 0.3, decimals: 1, suffix: '%', y: 400, x: 80, w: 440, size: 120, color: '#c3c9d4', label: 'One Nation, 2022', ticks: false });
    ui.counter(S, { t0: 1.4, dur: 1.4, from: 0.3, to: d.avg.ONP, decimals: 1, suffix: '%', y: 400, x: 540, w: 460, size: 120, align: 'right', color: CSS.ONP, label: 'One Nation, now' });
  });

  E.defineScene('short', (S) => {
    const ch = hall(S);
    E.camPath(S, WIDE, { shake: 0.015, shiftY: 280, focusOn: true });
    S.aperture = 0.1;
    S.update((lt) => light(ch, (i, k) => [k === 'LNP' ? COL.LNP : k === 'ONP' ? COL.ONP : WARM, k === 'LNP' ? 1.2 : k === 'ONP' ? 1.0 + 0.6 * Math.abs(Math.sin(lt * 4)) : 0.18]));
    ui.kicker(S, { t0: 0.05, text: 'The magic number: 45', y: 372 });
    ui.headline(S, { t0: 0.1, html: 'Coalition <em>short?</em>', y: 410, size: 110, style: 'rise' });
    ui.block(S, { t0: 1.2, html: 'Roy Morgan: One Nation could win enough <b>regional seats</b> to block a Coalition majority', cls: 'body', y: 600, w: 900, size: 40 });
  });

  E.defineScene('deal', (S) => {
    const ch = hall(S, { key: 300 });
    E.camPath(S, [{ t: 0, pos: [6, 6.5, 9], look: [1.5, 0.4, -3], fov: 40 }, { t: 6, pos: [4, 7.5, 10.5], look: [0.5, 0.4, -3], fov: 40 }], { shake: 0.015, shiftY: 300, focusOn: true });
    S.aperture = 0.2;
    S.update((lt) => light(ch, (i, k) => [COL[k], k === 'ONP' || k === 'LNP' ? 1.3 : 0.15]));
    ui.kicker(S, { t0: 0.05, text: 'Jess Wilson, Liberal leader', y: 372 });
    ui.list(S, { t0: 0.4, stagger: 2.2, y: 420, w: 900, size: 46, mark: '●', markColor: CSS.LNP, items: ['<b>No coalition</b> with One Nation', 'But <b>hasn\'t ruled out</b> relying on its support'] });
  });

  E.defineScene('prefs', (S) => {
    const ch = hall(S, { key: 240 });
    E.camPath(S, WIDE, { shake: 0.015, shiftY: 280, focusOn: true });
    S.aperture = 0.1;
    S.update((lt) => light(ch, (i, k) => [COL[k], k === 'ONP' || k === 'LNP' ? 1.0 + 0.4 * Math.sin(lt * 5 + i * 0.2) : 0.15]));
    ui.kicker(S, { t0: 0.05, text: 'Already happening', y: 372 });
    ui.headline(S, { t0: 0.1, html: `<span style="color:${CSS.LNP}">Coalition</span> ⇄ <span style="color:${CSS.ONP}">One Nation</span>`, y: 410, size: 64, style: 'rise' });
    ui.block(S, { t0: 0.9, html: 'Preferencing each other <b>ahead of Labor</b> in key seats', cls: 'body', y: 540, w: 920, size: 44 });
  });

  E.defineScene('labor', (S) => {
    const ch = hall(S);
    E.camPath(S, [{ t: 0, pos: [-6, 6.5, 9], look: [-1.5, 0.4, -3], fov: 40 }, { t: 6, pos: [-4, 7.5, 10.5], look: [-0.5, 0.4, -3], fov: 40 }], { shake: 0.015, shiftY: 300, focusOn: true });
    S.aperture = 0.2;
    S.update((lt) => light(ch, (i, k) => [COL[k], k === 'ALP' || k === 'GRN' ? 1.2 : 0.15]));
    ui.kicker(S, { t0: 0.05, text: 'Labor\'s path', y: 372 });
    ui.headline(S, { t0: 0.1, html: '“Throw the <em>keys back</em>”', y: 410, size: 76, style: 'rise' });
    ui.block(S, { t0: 1.0, html: `<b style="color:${CSS.ALP}">Ben Carroll</b>, rather than govern with the <b style="color:${CSS.GRN}">Greens</b>`, cls: 'body', y: 540, w: 920, size: 42 });
  });

  E.defineScene('ask', (S) => {
    const ch = hall(S, { key: 220 });
    E.camPath(S, [{ t: 0, pos: [-3, 2.4, 6.2], look: [0, 1, -5], fov: 36 }, { t: 6, pos: [2, 3.4, 9], look: [0, 0.8, -4], fov: 36 }], { shake: 0.02, focusOn: true });
    S.aperture = 0.35;
    S.update((lt) => light(ch, (i, k) => [COL[k], k === 'ONP' ? 1.2 + 0.6 * Math.abs(Math.sin(lt * 4)) : 0.5]));
    ui.kicker(S, { t0: 0.05, text: 'Your call', y: 372 });
    ui.headline(S, { t0: 0.1, html: 'Balance of power: <em>yes or no?</em>', y: 410, size: 92, style: 'rise' });
    ui.block(S, { t0: 0.9, html: '<b style="color:#c8f04a">Comment</b> 👇 &nbsp;·&nbsp; <b>Follow</b> for election night, live', cls: 'body', y: 660, w: 920, size: 40 });
  });

  E.defineScene('end', (S) => endCard(S, { title: 'Election night, <em>live</em>', sub: 'poltok.netlify.app/au/victoria', sources: 'Sources: ABC (3 Oct), The Age/Resolve (9 Nov), The Australian via News24, Roy Morgan (4 Nov 2026); VEC 2022.<br>Seat layouts are illustrative, not projections.' }));
}
