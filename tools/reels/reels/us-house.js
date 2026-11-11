// Reel — US House 2026: who won control, pulled LIVE from PolTok's results feed at render time
// (AP calls via the NYT provider). 2024 baseline (Republicans 220, Democrats 215) is the 2024 election result.
import { COL, CSS } from './_lib-us.js';

const PREV = { rep: 220, dem: 215 };

export async function data() {
  const L = await import('./_lib-us.js');
  const j = await L.snapshot();
  const b = j.balance.find((x) => x.chamber === 'house');
  for (const k of ['dem', 'rep', 'majority', 'total']) if (!Number.isFinite(b?.[k])) throw new Error('house balance missing ' + k);
  const und = Math.max(0, b.total - b.dem - b.rep - (b.ind || 0));
  const winner = b.dem >= b.majority ? 'D' : b.rep >= b.majority ? 'R' : null;
  if (!winner) throw new Error('House not yet decided in the feed: ' + JSON.stringify(b));
  return { dem: b.dem, rep: b.rep, ind: b.ind || 0, und, majority: b.majority, total: b.total, winner, asOf: L.asOfLabel(j) };
}

export const meta = {
  title: 'US House: control flips',
  label: 'LIVE RESULTS',
  out: 'poltok-us-house',
  cover: 1.6,
  music: { prog: ['Am', 'F', 'C', 'G'], arp: 'updown', seed: 58, swing: 0.04 },
};

export const scenes = (d) => {
  const W = d.winner === 'D' ? 'Democrats' : 'Republicans';
  const won = d.winner === 'D' ? d.dem : d.rep, lost = d.winner === 'D' ? d.rep : d.dem;
  const over = won - d.majority;
  return [
    { id: 'hook', beats: 8, energy: 3, voLead: 0.08,
      say: `${W} just took the House. And it's not even close.` },
    { id: 'before', beats: 8, energy: 2, trans: { type: 'whip', dir: 'left', dur: 0.42 },
      say: 'Two years ago, Republicans won it with two hundred and twenty seats.',
      cap: '2024: Republicans 220, Democrats 215.' },
    { id: 'now', beats: 12, energy: 3, trans: { type: 'flash', dur: 0.36 },
      say: `Now? ${W} have ${won}. ${d.winner === 'D' ? 'Republicans' : 'Democrats'}, ${lost}.`,
      cap: `Now: ${W} ${won}, ${d.winner === 'D' ? 'Republicans' : 'Democrats'} ${lost}.` },
    { id: 'over', beats: 10, energy: 2, trans: { type: 'whip', dir: 'up', dur: 0.42 },
      say: `That's ${over} seats past the line.${d.und ? ` And there's still ${d.und} left to call.` : ''}`,
      cap: `${over} seats past the ${d.majority} line.${d.und ? ` ${d.und} still to call.` : ''}` },
    { id: 'ask', beats: 8, energy: 2, trans: { type: 'zoom', dur: 0.45 },
      say: 'So where does it end up? Drop your guess below.', cap: 'Final number? Drop your guess 👇' },
    { id: 'end', beats: 6, energy: 0, trans: { type: 'zoom', dur: 0.5 }, noProgress: true },
  ];
};

export function build({ E, kit, ui, THREE, endCard, real }) {
  const { C, ease, remap } = E;
  const d = E.data;
  const N = 435, UND = 0x8a8f99, WARM = 0xffe2b0;
  const hall = (S, o = {}) => {
    real.room(S, { carpet: 0x2a2440, wood: 0x4e3320, width: 36, depth: 30, height: 12, key: o.key ?? 320 });
    const ch = real.chamber(N, { rows: 10, r0: 3.4, r1: 9.4, leather: 0x2f2a4a, wood: 0x5c3a20, open: 0.6 });
    S.scene.add(ch.group);
    return ch;
  };
  const layout = (dem, rep, und = 0) => [...Array(dem).fill(COL.D), ...Array(und).fill(UND), ...Array(rep).fill(COL.R)];
  const now = layout(d.dem, d.rep, d.und + d.ind);
  const before = layout(PREV.dem, PREV.rep);

  E.defineScene('hook', (S) => {
    const ch = hall(S);
    E.camPath(S, [{ t: 0, pos: [0, 3.0, 8], look: [0, 0.8, -5], fov: 38 }, { t: S.dur + 0.4, pos: [0, 6.5, 13], look: [0, 0.3, -3.5], fov: 38 }], { shake: 0.025, focusOn: true });
    S.aperture = 0.25;
    E.cue(S.t0 + 0.3, 'boom', { g: 0.8 });
    S.update((lt) => { for (let i = 0; i < N; i++) ch.set(i, now[i], (now[i] === UND ? 0.5 : 1.2) * ease.back(remap(lt, 0.15 + (i / N) * 1.6, 0.45 + (i / N) * 1.6))); ch.commit(); });
    ui.kicker(S, { t0: 0, text: 'US House · 2026 results', y: 372 });
    ui.headline(S, { t0: 0, html: `<em>${d.winner === 'D' ? d.dem : d.rep}</em> seats`, y: 410, size: 130, style: 'slam', stagger: 0.04, t1: S.dur + 1 });
    ui.block(S, { t0: 0.35, html: `<b style="color:${CSS[d.winner]}">${d.winner === 'D' ? 'Democrats' : 'Republicans'}</b> win the House. <b>${d.majority}</b> was needed.`, cls: 'body', y: 640, w: 920, size: 50, t1: S.dur + 1 });
  });

  E.defineScene('before', (S) => {
    const ch = hall(S, { key: 240 });
    E.camPath(S, [{ t: 0, pos: [-7, 8, 10], look: [0, 0.4, -3], fov: 40 }, { t: S.dur, pos: [-4, 8.5, 11.5], look: [0, 0.4, -3], fov: 40 }], { shake: 0.015, shiftY: 240, focusOn: true });
    S.aperture = 0.15;
    S.update(() => { for (let i = 0; i < N; i++) ch.set(i, before[i], 0.8); ch.commit(); });
    ui.kicker(S, { t0: 0.05, text: 'Two years ago · 2024', y: 372 });
    ui.counter(S, { t0: 0.3, dur: 1.0, to: PREV.rep, y: 410, x: 560, w: 440, size: 180, align: 'right', color: CSS.R, label: 'Republicans' });
    ui.counter(S, { t0: 0.45, dur: 1.0, to: PREV.dem, y: 410, x: 80, w: 440, size: 180, color: CSS.D, label: 'Democrats', ticks: false });
  });

  E.defineScene('now', (S) => {
    const ch = hall(S);
    E.camPath(S, [{ t: 0, pos: [0, 11, 13], look: [0, 0, -3], fov: 40 }, { t: S.dur, pos: [0, 9.5, 11.5], look: [0, 0.3, -3.2], fov: 40 }], { shake: 0.015, shiftY: 240, focusOn: true });
    S.aperture = 0.12;
    // seats change hands one by one from the 2024 layout to now
    const changed = []; for (let i = 0; i < N; i++) if (before[i] !== now[i]) changed.push(i);
    changed.forEach((_, j) => { if (j % 6 === 0) E.cue(S.t0 + 0.5 + (j / changed.length) * 2.0, 'blip', { i: j / 6 }); });
    S.update((lt) => {
      for (let i = 0; i < N; i++) {
        const j = changed.indexOf(i);
        if (j < 0) { ch.set(i, now[i], 0.9); continue; }
        const k = remap(lt, 0.5 + (j / changed.length) * 2.0, 0.7 + (j / changed.length) * 2.0);
        ch.set(i, k > 0 ? now[i] : before[i], k > 0 ? 0.9 + 1.0 * (1 - k) : 0.9);
      }
      ch.commit();
    });
    ui.kicker(S, { t0: 0.05, text: `Now · as of ${d.asOf}`, y: 372 });
    ui.counter(S, { t0: 0.4, dur: 2.0, from: PREV.dem, to: d.dem, y: 410, x: 80, w: 440, size: 200, color: CSS.D, label: 'Democrats' });
    ui.counter(S, { t0: 0.4, dur: 2.0, from: PREV.rep, to: d.rep, y: 410, x: 560, w: 440, size: 200, align: 'right', color: CSS.R, label: 'Republicans', ticks: false });
  });

  E.defineScene('over', (S) => {
    const ch = hall(S, { key: 260 });
    E.camPath(S, [{ t: 0, pos: [6, 6.5, 9], look: [1.5, 0.4, -3], fov: 40 }, { t: S.dur, pos: [4, 7.5, 10.5], look: [0.5, 0.4, -3], fov: 40 }], { shake: 0.015, shiftY: 260, focusOn: true });
    S.aperture = 0.2;
    const won = d.winner === 'D' ? d.dem : d.rep;
    S.update((lt) => { for (let i = 0; i < N; i++) { const extra = d.winner === 'D' ? i >= d.majority && i < d.dem : i >= N - d.rep && i < N - d.majority; ch.set(i, now[i], extra ? 1.3 + 0.5 * Math.sin(lt * 6) : now[i] === UND ? 0.4 + 0.4 * Math.sin(lt * 4) : 0.35); } ch.commit(); });
    ui.kicker(S, { t0: 0.05, text: `Majority line: ${d.majority}`, y: 372 });
    ui.counter(S, { t0: 0.3, dur: 1.2, to: won - d.majority, prefix: '+', y: 410, size: 230, color: '#c8f04a', label: 'seats past the line' });
    if (d.und) ui.block(S, { t0: 1.5, html: `<b>${d.und}</b> races still to call`, cls: 'body', y: 720, align: 'center', size: 52 });
  });

  E.defineScene('ask', (S) => {
    const ch = hall(S, { key: 220 });
    E.camPath(S, [{ t: 0, pos: [-3, 2.6, 7], look: [0, 1, -5], fov: 36 }, { t: S.dur, pos: [2, 3.2, 8.5], look: [0, 0.9, -4.5], fov: 36 }], { shake: 0.02, focusOn: true });
    S.aperture = 0.3;
    S.update((lt) => { for (let i = 0; i < N; i++) ch.set(i, now[i] === UND ? WARM : now[i], now[i] === UND ? 1.0 + 0.6 * Math.sin(lt * 5 + i) : 0.4); ch.commit(); });
    ui.kicker(S, { t0: 0.05, text: 'Your guess', y: 372 });
    ui.headline(S, { t0: 0.1, html: 'Final number: <em>?</em>', y: 410, size: 110, style: 'rise' });
    ui.block(S, { t0: 0.9, html: `<b style="color:#c8f04a">Comment</b> your final ${d.winner === 'D' ? 'Democrat' : 'Republican'} seat count 👇`, cls: 'body', y: 640, w: 920, size: 46 });
    ui.block(S, { t0: 1.6, html: '<b>Follow</b> and see who got closest', cls: 'body', y: 760, w: 920, size: 42 });
  });

  E.defineScene('end', (S) => endCard(S, { title: 'Every race, <em>live</em>', sub: 'poltok.netlify.app', sources: `AP race calls via PolTok's live feed, ${d.asOf}.<br>2024 result: R 220, D 215.` }));
}
