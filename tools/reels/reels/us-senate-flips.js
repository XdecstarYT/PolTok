// Reel — US Senate 2026: the seats that changed party, pulled LIVE from PolTok's results feed at render time
// (AP calls via the NYT provider). A "flip" = the called winner's party differs from the party that held the seat.
import { STATES, COL, CSS, WORDS, senateKey, ballotStacks } from './_lib-us.js';

export async function data() {
  const L = await import('./_lib-us.js');
  const j = await L.snapshot();
  const sen = j.results.filter((r) => /-SEN/.test(r.raceId));
  const flips = [], counting = [];
  for (const r of sen) {
    const st = L.standings(r), key = senateKey(r.raceId), prior = L.SENATE_PRIOR[key];
    const state = STATES[key.split('-')[0]];
    if (r.status === 'called' && r.calledFor) {
      const w = st.find((c) => c.id === r.calledFor); const l = st.find((c) => c.id !== r.calledFor);
      if (prior && w.party !== prior) flips.push({ state, prior, win: w, lose: l, margin: +(w.pct - l.pct).toFixed(1) });
    } else counting.push({ state, prior, lead: st[0], trail: st[1], expected: r.expectedPct });
  }
  if (!flips.length) throw new Error('no Senate flips in the feed');
  // Texas leads if it flipped (the night's biggest surprise); the rest by margin
  flips.sort((a, b) => (b.state === 'Texas') - (a.state === 'Texas') || b.margin - a.margin);
  const b = j.balance.find((x) => x.chamber === 'senate');
  return { flips, counting, toD: flips.filter((f) => f.win.party === 'D').length, toR: flips.filter((f) => f.win.party === 'R').length,
    senate: { dem: b.dem, rep: b.rep, ind: b.ind, majority: b.majority, undecided: b.undecided }, asOf: L.asOfLabel(j) };
}

export const meta = {
  title: 'US Senate: the seats that flipped',
  label: 'LIVE RESULTS',
  out: 'poltok-us-senate-flips',
  cover: 1.6,
  music: { prog: ['Dm', 'Bb', 'F', 'C'], arp: 'up', seed: 41, swing: 0.03 },
};

const W = (n) => WORDS[n] ?? String(n);
const big = (d) => d.flips[0];

export const scenes = (d) => {
  const n = d.flips.length, other = d.toD >= d.toR ? d.toR : d.toD;
  const rest = d.flips.slice(1).map((f) => f.state);
  const listSay = rest.length > 1 ? `${rest.slice(0, -1).join(', ')} and ${rest.at(-1)}` : rest[0] || '';
  const lead = d.counting.length ? d.counting.map((c) => c.state) : [];
  return [
    { id: 'hook', beats: 8, energy: 3, voLead: 0.08,
      say: `${W(n)} Senate seats just flipped. ${other === 0 ? 'And not one went the other way.' : `${W(other)} went the other way.`}` },
    { id: 'big', beats: 10, energy: 3, trans: { type: 'flash', dur: 0.36 },
      say: `The biggest shock? ${big(d).state}. ${big(d).win.name} beat ${big(d).lose.name} by ${Math.round(big(d).margin)} points.`,
      cap: `${big(d).state}: ${big(d).win.name} beat ${big(d).lose.name} by ${big(d).margin} points.` },
    ...(rest.length ? [{ id: 'rest', beats: 10, energy: 2, trans: { type: 'whip', dir: 'left', dur: 0.42 },
      say: `Then ${listSay}.`, cap: `Also flipped: ${rest.join(', ')}.` }] : []),
    { id: 'now', beats: 10, energy: 2, trans: { type: 'whip', dir: 'up', dur: 0.42 },
      say: (lead.length ? `${lead.join(' and ')} ${lead.length > 1 ? 'are' : 'is'} still counting. ` : '') + `Right now, that's ${d.senate.dem} seats. ${d.senate.majority} runs the Senate.`,
      cap: (lead.length ? `Still counting: ${lead.join(', ')}. ` : '') + `Democrats: ${d.senate.dem} seats. ${d.senate.majority} for control.` },
    { id: 'ask', beats: 8, energy: 2, trans: { type: 'zoom', dur: 0.45 },
      say: 'Which one shocked you most? Tell me in the comments.', cap: 'Which one shocked you most? 👇' },
    { id: 'end', beats: 6, energy: 0, trans: { type: 'zoom', dur: 0.5 }, noProgress: true },
  ];
};

export function build({ E, kit, ui, THREE, endCard, real }) {
  const { C, ease, remap } = E;
  const d = E.data;
  const N = 100;
  // seat order: the flips first (centre), then the rest
  const hall = (S, o = {}) => {
    real.room(S, { carpet: 0x1f2a44, wood: 0x4e3320, width: 30, depth: 26, height: 10, key: o.key ?? 260 });
    const ch = real.chamber(N, { rows: 5, r0: 3.4, r1: 7.6, leather: 0x24314f, wood: 0x5c3a20, open: 0.6 });
    S.scene.add(ch.group);
    return ch;
  };
  // pick flip seat indices spread across the chamber
  const flipSeats = d.flips.map((_, i) => Math.round(((i + 0.5) / d.flips.length) * 80) + 10);

  E.defineScene('hook', (S) => {
    const ch = hall(S);
    E.camPath(S, [{ t: 0, pos: [0, 2.4, 6.2], look: [0, 1.0, -5], fov: 36 }, { t: S.dur + 0.4, pos: [0.8, 4.2, 10], look: [0, 0.6, -3.5], fov: 36 }], { shake: 0.025, focusOn: true });
    S.aperture = 0.3;
    flipSeats.forEach((_, j) => E.cue(S.t0 + 0.5 + j * 0.22, 'blip', { i: j }));
    S.update((lt) => {
      for (let i = 0; i < N; i++) {
        const j = flipSeats.indexOf(i);
        if (j >= 0) {
          const k = remap(lt, 0.5 + j * 0.22, 0.75 + j * 0.22);
          ch.set(i, k > 0 ? COL[d.flips[j].win.party] : COL[d.flips[j].prior], 1.0 + 0.8 * ease.back(k));
        } else ch.set(i, 0xffe2b0, 0.25);
      }
      ch.commit();
    });
    E.cue(S.t0 + 0.3, 'boom', { g: 0.7 });
    ui.kicker(S, { t0: 0, text: 'US Senate · 2026 results', y: 372 });
    ui.headline(S, { t0: 0, html: `<em>${d.flips.length}</em> seats flipped`, y: 410, size: 112, style: 'slam', stagger: 0.04, t1: S.dur + 1 });
    ui.block(S, { t0: 0.35, html: `<span style="color:${CSS.R}">R</span> → <span style="color:${CSS.D}">D</span>: <b>${d.toD}</b> &nbsp;·&nbsp; <span style="color:${CSS.D}">D</span> → <span style="color:${CSS.R}">R</span>: <b>${d.toR}</b>`, cls: 'body', y: 640, w: 920, size: 60, t1: S.dur + 1 });
  });

  E.defineScene('big', (S) => {
    const f = d.flips[0];
    const st = ballotStacks(S, { real, THREE }, f.win.pct, f.lose.pct, COL[f.win.party], COL[f.lose.party]);
    E.camPath(S, [{ t: 0, pos: [0, 6.0, 9.5], look: [0, 1.2, 0], fov: 30 }, { t: S.dur, pos: [0.8, 5.2, 8.4], look: [0, 1.25, 0], fov: 30 }], { shake: 0.015, shiftY: 330, focusOn: true });
    S.aperture = 0.35;
    E.cue(S.t0 + 0.4, 'boom', { g: 0.5 });
    S.update((lt) => st.update(ease.expo(remap(lt, 0.3, 1.8))));
    ui.kicker(S, { t0: 0.05, text: 'Biggest shock of the night', y: 372 });
    ui.headline(S, { t0: 0.1, html: `<em>${f.state.toUpperCase()}</em>`, y: 428, size: 130, style: 'slam' });
    ui.counter(S, { t0: 0.6, dur: 1.2, to: f.margin, decimals: 1, prefix: '+', y: 600, size: 160, color: CSS[f.win.party], label: `points · ${f.win.name} over ${f.lose.name}` });
    ui.tag3d(S, { at: new THREE.Vector3(-0.85, 1.85, 0.9), html: f.win.name.split(' ').at(-1), cls: 'chip', t0: 1.6 });
    ui.tag3d(S, { at: new THREE.Vector3(0.85, 1.85, 0.9), html: f.lose.name.split(' ').at(-1), cls: 'chip', t0: 1.6 });
  });

  if (d.flips.length > 1) E.defineScene('rest', (S) => {
    hall(S, { key: 220 });
    E.camPath(S, [{ t: 0, pos: [5.5, 3.2, 3.0], look: [-1, 0.8, -5], fov: 38 }, { t: S.dur, pos: [3.5, 3.0, 2.0], look: [-2.5, 0.8, -5], fov: 38 }], { shake: 0.015, shiftY: -320 });
    S.aperture = 1.4; S.focus = 2.0;
    const rest = d.flips.slice(1);
    rest.forEach((_, j) => E.cue(S.t0 + 0.4 + j * 0.3, 'pop', { i: j }));
    ui.kicker(S, { t0: 0.05, text: 'Also flipped', y: 372 });
    ui.list(S, {
      t0: 0.4, stagger: 0.3, y: 440, size: 46, mark: '●', markColor: CSS.D,
      items: rest.map((f) => `<b>${f.state}</b> <span style="opacity:.7">${f.win.name}</span> <b style="color:${CSS[f.win.party]}">+${f.margin}</b>`),
    });
  });

  E.defineScene('now', (S) => {
    const ch = hall(S);
    const s = d.senate;
    const cols = [...Array(s.dem).fill(COL.D), ...Array(s.ind).fill(COL.I), ...Array(s.undecided).fill(0x8a8f99), ...Array(s.rep).fill(COL.R)];
    E.camPath(S, [{ t: 0, pos: [0, 9.5, 11], look: [0, 0, -2.5], fov: 40 }, { t: S.dur, pos: [0, 8, 9.5], look: [0, 0.3, -2.8], fov: 40 }], { shake: 0.015, shiftY: 240, focusOn: true });
    S.aperture = 0.15;
    S.update((lt) => { for (let i = 0; i < N; i++) ch.set(i, cols[i] ?? 0x8a8f99, (cols[i] === 0x8a8f99 ? 0.6 + 0.5 * Math.sin(lt * 6) : 1.2) * ease.back(remap(lt, 0.2 + (i / N) * 1.2, 0.5 + (i / N) * 1.2))); ch.commit(); });
    ui.kicker(S, { t0: 0.05, text: `Senate · as of ${d.asOf}`, y: 372 });
    ui.counter(S, { t0: 0.3, dur: 1.3, to: s.dem, y: 410, x: 80, w: 440, size: 200, color: CSS.D, label: 'Democrats' });
    ui.counter(S, { t0: 0.45, dur: 1.2, to: s.rep, y: 410, x: 560, w: 440, size: 200, align: 'right', color: CSS.R, label: 'Republicans', ticks: false });
    ui.block(S, { t0: 1.6, html: `<b>${s.majority}</b> for control${s.undecided ? ` · <b>${s.undecided}</b> still counting` : ''}`, cls: 'body', y: 700, align: 'center' });
  });

  E.defineScene('ask', (S) => {
    const ch = hall(S, { key: 200 });
    E.camPath(S, [{ t: 0, pos: [-3, 2.4, 6], look: [0, 1, -5], fov: 36 }, { t: S.dur, pos: [2, 3.0, 7.5], look: [0, 0.9, -4.5], fov: 36 }], { shake: 0.02, focusOn: true });
    S.aperture = 0.35;
    S.update((lt) => { for (let i = 0; i < N; i++) { const j = flipSeats.indexOf(i); ch.set(i, j >= 0 ? COL[d.flips[j].win.party] : 0xffe2b0, j >= 0 ? 1.2 + 0.4 * Math.sin(lt * 5 + j) : 0.25); } ch.commit(); });
    ui.kicker(S, { t0: 0.05, text: 'Your turn', y: 372 });
    ui.headline(S, { t0: 0.1, html: 'Which one <em>shocked</em> you?', y: 410, size: 104, style: 'rise' });
    ui.block(S, { t0: 0.9, html: d.flips.map((f) => f.state).join(' · '), cls: 'body', y: 640, w: 920, size: 40 });
    ui.block(S, { t0: 1.6, html: '<b style="color:#c8f04a">Comment</b> 👇 &nbsp;·&nbsp; <b>Follow</b> for the final count', cls: 'body', y: 780, w: 920, size: 42 });
  });

  E.defineScene('end', (S) => endCard(S, { title: 'Every race, <em>live</em>', sub: 'poltok.netlify.app', sources: `AP race calls via PolTok's live feed, ${d.asOf}.<br>Flipped = won by a different party than held it.` }));
}
