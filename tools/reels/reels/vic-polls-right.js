// Reel — "What if the polls are right?" Uniform two-party swing from the 2022 result to today's polls (see _lib-vic-swing.js).
// Premier Ben Carroll's seat: Niddrie (Wikipedia, 2026 Victorian state election). A rough guide, NOT a projection —
// the reel says so: seats never swing evenly, and One Nation, Greens and independents aren't modelled.

export async function data() { const { swingData } = await import('./_lib-vic-swing.js'); return swingData(); }

export const meta = {
  title: 'What if the polls are right?',
  label: 'VIC 2026 · WHAT IF',
  out: 'poltok-vic-what-if-polls-right',
  cover: 1.6,
  music: { prog: ['Dm', 'Bb', 'F', 'C'], arp: 'up', seed: 223, swing: 0.03 },
};

const R = Math.round;

export const scenes = (d) => [
  { id: 'hook', beats: 7, energy: 3, voLead: 0.08,
    say: d.niddrie && d.niddrie.margin < d.swing ? 'If today\'s polls are right, the Premier loses his own seat.' : `If today's polls are right, Labor loses ${d.falls.length} seats.` },
  { id: 'swing', beats: 10, energy: 2, trans: { type: 'zoom', dur: 0.45 },
    say: `In twenty twenty-two, Labor won fifty-five to forty-five after preferences. Now the polls say ${R(d.alp)} to ${R(d.lnp)}. That's a ${R(d.swing)} point swing.`,
    cap: `2022: Labor 55–45 after preferences. Polls now: ${d.alp}–${d.lnp}. A ${d.swing}-point swing.` },
  { id: 'flip', beats: 11, energy: 3, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: `Swing every seat by ${R(d.swing)} points, and Labor drops from ${d.seats2022.ALP} seats to ${d.after.ALP}.`,
    cap: `Uniform ${d.swing}-point swing: Labor ${d.seats2022.ALP} → ${d.after.ALP} seats. Coalition ${d.seats2022.LNP} → ${d.after.LNP}.` },
  ...(d.niddrie && d.niddrie.margin < d.swing ? [{ id: 'niddrie', beats: 9, energy: 3, trans: { type: 'flash', dur: 0.36 },
    say: `Including Niddrie. That's Ben Carroll's own seat, and he holds it by just ${String(d.niddrie.margin.toFixed(1)).replace('.', ' point ')}.`,
    cap: `Including Niddrie, Premier Ben Carroll's seat (margin ${d.niddrie.margin.toFixed(1)}).` }] : []),
  { id: 'caveat', beats: 8, energy: 1, trans: { type: 'fade', dur: 0.45 },
    say: 'Big caveat: seats never swing evenly, and One Nation could scramble all of this.',
    cap: 'Caveat: seats never swing evenly, and One Nation could scramble it.' },
  { id: 'ask', beats: 8, energy: 2, trans: { type: 'zoom', dur: 0.45 },
    say: 'So, do you believe the polls? Tell me in the comments.', cap: 'Do you believe the polls? 👇' },
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
  // left → right: Greens, Labor (safest → most marginal), Coalition. Falling seats sit next to the Coalition block.
  const s = d.seats2022, nFall = d.falls.length;
  const base = [...Array(s.GRN).fill('GRN'), ...Array(s.ALP).fill('ALP'), ...Array(s.IND).fill('IND'), ...Array(s.LNP).fill('LNP')];
  const firstFall = s.GRN + s.ALP - nFall; // indexes [firstFall, firstFall+nFall) are the falling Labor seats, most marginal last
  const falls = (i) => i >= firstFall && i < s.GRN + s.ALP;
  const paint = (ch, k, pulse = 0) => { for (let i = 0; i < N; i++) { const f = falls(i); const flipped = f && (s.GRN + s.ALP - 1 - i) / nFall < k; ch.set(i, COL[flipped ? 'LNP' : base[i]] ?? WARM, (f && pulse ? 1.0 + 0.6 * pulse : 1.1)); } ch.commit(); };
  const WIDE = [{ t: 0, pos: [0, 12, 13.5], look: [0, 0, -2.5], fov: 44 }, { t: 6, pos: [0, 11, 12.5], look: [0, 0.3, -2.8], fov: 44 }];

  E.defineScene('hook', (S) => {
    const ch = hall(S);
    E.camPath(S, [{ t: 0, pos: [0, 2.2, 6.2], look: [0, 1.0, -5], fov: 36 }, { t: S.dur + 0.4, pos: [0.6, 4.0, 10], look: [0, 0.7, -3.5], fov: 36 }], { shake: 0.025, focusOn: true });
    S.aperture = 0.3;
    E.cue(S.t0 + 0.3, 'boom', { g: 0.8 });
    S.update((lt) => paint(ch, ease.inOut(remap(lt, 0.4, 2.6))));
    ui.kicker(S, { t0: 0, text: 'What if the polls are right?', y: 372 });
    ui.headline(S, { t0: 0, html: d.niddrie && d.niddrie.margin < d.swing ? 'The Premier <em>loses his own seat</em>' : `Labor loses <em>${nFall} seats</em>`, y: 410, size: 92, style: 'slam', stagger: 0.04, t1: S.dur + 1 });
  });

  E.defineScene('swing', (S) => {
    const ch = hall(S, { key: 240 });
    E.camPath(S, WIDE, { shake: 0.015, shiftY: 300, focusOn: true });
    S.aperture = 0.1;
    S.update(() => paint(ch, 0));
    ui.kicker(S, { t0: 0.05, text: 'After preferences · Labor v Coalition', y: 372 });
    ui.counter(S, { t0: 0.3, dur: 1.0, to: 55, y: 400, x: 80, w: 440, size: 130, color: '#ff6b6b', label: 'Labor, 2022 election' });
    ui.counter(S, { t0: 1.6, dur: 1.0, to: d.alp, decimals: d.alp % 1 ? 1 : 0, y: 400, x: 540, w: 460, size: 130, align: 'right', color: '#ff6b6b', label: `Labor, latest ${d.polls.length} polls`, ticks: false });
    ui.block(S, { t0: 3.0, html: `A <b style="color:#c8f04a">${d.swing}-point</b> swing to the Coalition`, cls: 'body', y: 620, align: 'center', size: 48 });
  });

  E.defineScene('flip', (S) => {
    const ch = hall(S);
    E.camPath(S, WIDE, { shake: 0.02, shiftY: 300, focusOn: true });
    S.aperture = 0.1;
    const t0 = 0.5, t1 = 3.4;
    d.falls.forEach((_, j) => { if (j % 3 === 0) E.cue(S.t0 + t0 + (j / nFall) * (t1 - t0), 'blip', { i: j / 3 }); });
    S.update((lt) => paint(ch, ease.inOut(remap(lt, t0, t1))));
    ui.kicker(S, { t0: 0.05, text: `Uniform ${d.swing}-point swing`, y: 372 });
    ui.counter(S, { t0: t0, dur: t1 - t0, from: s.ALP, to: d.after.ALP, y: 400, x: 80, w: 440, size: 160, color: '#ff6b6b', label: 'Labor seats', ticks: false });
    ui.counter(S, { t0: t0, dur: t1 - t0, from: s.LNP, to: d.after.LNP, y: 400, x: 540, w: 460, size: 160, align: 'right', color: '#6ea2ff', label: 'Coalition seats' });
  });

  if (d.niddrie && d.niddrie.margin < d.swing) E.defineScene('niddrie', (S) => {
    const ch = hall(S, { key: 300 });
    const idx = s.GRN + s.ALP - 1 - d.falls.findIndex((f) => f.seat === 'Niddrie');
    const at = ch.pos[idx];
    E.camPath(S, [{ t: 0, pos: [at.x * 0.4, at.y + 3.0, at.z + 5.5], look: [at.x, at.y, at.z], fov: 34 }, { t: 6, pos: [at.x * 0.6, at.y + 2.2, at.z + 4.2], look: [at.x, at.y, at.z], fov: 34 }], { shake: 0.015, shiftY: 300, focusOn: true });
    S.aperture = 0.6;
    E.cue(S.t0 + 0.8, 'boom', { g: 0.5 });
    S.update((lt) => { paint(ch, 1); ch.set(idx, lt > 0.8 ? COL.LNP : COL.ALP, 1.6 + 1.0 * Math.abs(Math.sin(lt * 5))); ch.commit(); });
    ui.kicker(S, { t0: 0.05, text: 'Including the Premier\'s seat', y: 372 });
    ui.headline(S, { t0: 0.1, html: '<em>Niddrie</em>', y: 410, size: 130, style: 'slam' });
    ui.block(S, { t0: 0.8, html: `Ben Carroll's seat · margin <b style="color:#c8f04a">${d.niddrie.margin.toFixed(1)}</b> · swing <b style="color:#c8f04a">${d.swing}</b>`, cls: 'body', y: 600, align: 'center', size: 42 });
  });

  E.defineScene('caveat', (S) => {
    const ch = hall(S, { key: 180 });
    E.camPath(S, [{ t: 0, pos: [-3, 2.4, 6.2], look: [0, 1, -5], fov: 36 }, { t: 6, pos: [2, 3.4, 9], look: [0, 0.8, -4], fov: 36 }], { shake: 0.015, focusOn: true });
    S.aperture = 0.35;
    S.update((lt) => paint(ch, 1, Math.abs(Math.sin(lt * 3))));
    ui.kicker(S, { t0: 0.05, text: 'Big caveat', y: 372 });
    ui.headline(S, { t0: 0.1, html: 'Seats <em>never</em> swing evenly', y: 410, size: 76, style: 'rise' });
    ui.block(S, { t0: 0.8, html: 'One Nation, the Greens and independents aren\'t in this maths, and could scramble it.', cls: 'body', y: 600, w: 900, size: 40 });
  });

  E.defineScene('ask', (S) => {
    const ch = hall(S, { key: 220 });
    E.camPath(S, [{ t: 0, pos: [-3, 2.4, 6], look: [0, 1, -5], fov: 36 }, { t: 6, pos: [2, 3.0, 7.5], look: [0, 0.9, -4.5], fov: 36 }], { shake: 0.02, focusOn: true });
    S.aperture = 0.35;
    S.update((lt) => paint(ch, (Math.sin(lt * 1.4) + 1) / 2));
    ui.kicker(S, { t0: 0.05, text: 'Your call', y: 372 });
    ui.headline(S, { t0: 0.1, html: 'Do you <em>believe the polls?</em>', y: 410, size: 100, style: 'rise' });
    ui.block(S, { t0: 0.9, html: '<b style="color:#c8f04a">Comment</b> 👇 &nbsp;·&nbsp; <b>Follow</b> for election night, live', cls: 'body', y: 640, w: 920, size: 42 });
  });

  E.defineScene('end', (S) => endCard(S, { title: 'Election night, <em>live</em>', sub: 'poltok.netlify.app/au/victoria', sources: `2022 margins & 2PP: VEC. Polls: ${d.polls.map((p) => p.firm.split('/')[0]).join(', ')} (Wikipedia).<br>Uniform-swing estimate, not a projection. One Nation, Greens and independents not modelled.` }));
}
