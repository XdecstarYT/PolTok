// Reel — ALTERNATE REALITY: "What if One Nation won Victoria?" An IMAGINED first 100 days in which One Nation simply does
// what it has promised. Every policy is One Nation's own, as listed in ABC News' Victorian policy tracker (4 Nov 2026).
// No invented events, reactions or outcomes: only promises + real constraints.
// Facts: One Nation's 2022 Victorian Legislative Assembly vote 0.3% statewide, 0 seats (VEC, src/data/au-vic.ts);
// 45 of 88 seats to govern; laws must also pass the 40-seat Legislative Council, elected proportionally.
// Leader: Warren Pickering, One Nation Victoria's lead candidate (Wikipedia). Today's poll: live average (vic-what-if.js).

export async function data() {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../../../src/data/au-vic.ts', import.meta.url), 'utf8');
  const m = src.match(/VIC_RESULTS_2022[^=]*=\s*(\{.*?\});\n/s);
  if (!m) throw new Error('could not read VIC_RESULTS_2022');
  let onp = 0, tot = 0;
  for (const r of Object.values(JSON.parse(m[1]))) for (const c of r.fp || []) { tot += c.v; if (/One Nation/i.test(c.pn)) onp += c.v; }
  const { data: vic } = await import('./vic-what-if.js');
  const d = await vic();
  return { onp2022: +(100 * onp / tot).toFixed(1), onpNow: d.avg.ONP, nPolls: d.polls.length, days: d.days };
}

export const meta = {
  title: 'Alternate reality: One Nation wins Victoria',
  label: 'ALTERNATE REALITY · IMAGINED',
  labelCls: 'warn',
  out: 'poltok-alt-reality-one-nation-vic',
  cover: 1.6,
  music: { prog: ['Dm', 'Bb', 'Gm', 'A'], arp: 'updown', seed: 241, swing: 0.03 },
};

const R = Math.round;

export const scenes = (d) => [
  { id: 'hook', beats: 7, energy: 3, voLead: 0.08,
    say: 'Imagine it\'s election night, and One Nation wins Victoria. Here\'s what they\'ve promised to do.' },
  { id: 'night', beats: 10, energy: 3, trans: { type: 'zoom', dur: 0.45 },
    say: `In twenty twenty-two, One Nation got ${d.onp2022 < 1 ? 'under one percent' : R(d.onp2022) + ' percent'}, and no seats. In this reality, they pass forty-five, and Warren Pickering forms government.`,
    cap: `2022: ${d.onp2022}% and 0 seats. In this imagined reality: 45+ seats, and Warren Pickering forms government.` },
  { id: 'rail', beats: 9, energy: 3, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: 'First up, the Suburban Rail Loop is cancelled. The money goes to the Melton line, and Airport Rail.',
    cap: 'Promise: cancel the Suburban Rail Loop; fund the Melton line and Airport Rail instead.' },
  { id: 'energy', beats: 9, energy: 3, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: 'Net zero targets are scrapped. The ban on nuclear power is lifted. And two major transmission lines are cancelled.',
    cap: 'Promise: scrap net zero targets, lift the nuclear ban, cancel VNI West and the Western Renewables Link.' },
  { id: 'money', beats: 9, energy: 3, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: 'Labor\'s land tax increases are reversed. And stamp duty on your insurance is abolished.',
    cap: 'Promise: reverse Labor\'s land tax increases; abolish the 10% stamp duty on insurance.' },
  { id: 'crime', beats: 10, energy: 3, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: 'Children who commit serious violent crimes are charged as adults. And the age of criminal responsibility goes back to ten.',
    cap: 'Promise: charge children as adults for serious violent offences; age of criminal responsibility back to 10.' },
  { id: 'more', beats: 9, energy: 2, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: 'Plus a new school curriculum, twenty-four seven emergency departments in the regions, and higher duty for foreign buyers.',
    cap: 'Promise: a knowledge-rich curriculum, 24/7 regional EDs, higher foreign buyer duty.' },
  { id: 'check', beats: 10, energy: 2, trans: { type: 'flash', dur: 0.36 },
    say: 'But reality check: every law still has to get through the upper house. And that\'s elected by proportional vote.',
    cap: 'Reality check: every law must also pass the Legislative Council, elected proportionally.' },
  { id: 'now', beats: 8, energy: 2, trans: { type: 'whip', dir: 'up', dur: 0.42 },
    say: `Back in the real world, One Nation's polling around ${R(d.onpNow)} percent, with ${d.days} days to go.`,
    cap: `Real world: One Nation polling ~${d.onpNow}%, ${d.days} days out.` },
  { id: 'ask', beats: 8, energy: 2, trans: { type: 'zoom', dur: 0.45 },
    say: 'So, would Victoria be better, or worse? Tell me in the comments.', cap: 'Better or worse? Comment 👇' },
  { id: 'end', beats: 6, energy: 0, trans: { type: 'zoom', dur: 0.5 }, noProgress: true },
];

export function build({ E, kit, ui, THREE, endCard, real }) {
  const { C, ease, remap } = E;
  const d = E.data;
  const ORANGE = 0xd9480f, OCSS = '#ff9a4a';
  const N = 88, MAJ = 45, WARM = 0xffe2b0;

  // a fictional front page from the imagined reality — every page carries an IMAGINED stamp
  const paper = (head, sub, date) => real.sheet(1.5, 2.0, (c, w) => {
    c.fillStyle = 'rgba(20,18,15,.9)'; c.font = '900 92px Newsreader'; c.textAlign = 'center'; c.fillText('The PolTok Ledger', w / 2, 120);
    c.fillRect(50, 150, w - 100, 6); c.font = '600 30px "Inter Tight"'; c.fillText(date + ' · ALTERNATE REALITY', w / 2, 196); c.fillRect(50, 214, w - 100, 2);
    c.textAlign = 'left'; c.font = '800 100px Newsreader';
    const words = head.split(' '); let line = '', y = 340;
    for (const wd of words) { const t = line ? line + ' ' + wd : wd; if (c.measureText(t).width > w - 110 && line) { c.fillText(line, 55, y); line = wd; y += 104; } else line = t; }
    c.fillText(line, 55, y);
    c.font = '500 40px Newsreader'; c.fillStyle = 'rgba(20,18,15,.7)'; c.fillText(sub, 55, y + 80);
    c.fillStyle = 'rgba(20,18,15,.18)';
    for (let col = 0; col < 3; col++) for (let l = 0; l < 12; l++) c.fillRect(55 + col * ((w - 110) / 3), y + 140 + l * 44, (w - 110) / 3 - 30 - ((l * 7 + col) % 4) * 18, 14);
    c.save(); c.translate(w - 250, 1180); c.rotate(-0.22); c.strokeStyle = 'rgba(217,72,15,.85)'; c.lineWidth = 9; c.strokeRect(-190, -60, 380, 120); c.fillStyle = 'rgba(217,72,15,.85)'; c.font = '900 60px "Inter Tight"'; c.textAlign = 'center'; c.fillText('IMAGINED', 0, 22); c.restore();
  });
  const desk = (S, pages, o = {}) => {
    real.room(S, { carpet: 0x2b2420, wood: 0x4e3320, width: 16, depth: 14, height: 7, key: o.key ?? 100, area: 2.4, fill: 0.28 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.16, 3.8), real.pbr(real.tex.wood(0x5c3a20), { repeat: [2, 1], clearcoat: 0.7, clearcoatRoughness: 0.2 }));
    top.position.set(0, 1.0, 0); top.receiveShadow = true; top.castShadow = true; S.scene.add(top);
    const ms = pages.map(([h, s, dt], i) => { const p = paper(h, s, dt); p.rotation.x = -Math.PI / 2; p.rotation.z = (i - (pages.length - 1) / 2) * 0.1 + Math.sin(i * 2.3) * 0.04; p.position.set((i - (pages.length - 1) / 2) * 0.32, 1.09 + i * 0.012, (pages.length - 1 - i) * -0.18); S.scene.add(p); return p; });
    const at = o.at ?? ((i) => 0.25 + i * 0.9);
    ms.forEach((_, i) => E.cue(S.t0 + at(i) + 0.35, 'pop', { i }));
    S.update((lt) => ms.forEach((p, i) => { const k = ease.expo(remap(lt, at(i), at(i) + 0.5)); p.position.y = 1.09 + i * 0.012 + (1 - k) * 2.6; p.visible = k > 0.01; }));
    E.camPath(S, [{ t: 0, pos: [0, 5.3, 3.3], look: [0, 1.1, -0.1], fov: 34 }, { t: S.dur, pos: [0.25, 4.9, 3.0], look: [0, 1.1, -0.1], fov: 34 }], { shake: 0.012, shiftY: 470, focusOn: true });
    S.aperture = 0.35;
  };
  const hall = (S, o = {}) => {
    real.room(S, { carpet: 0x2d4a33, wood: 0x5a361d, width: 30, depth: 26, height: 10, key: o.key ?? 260 });
    const ch = real.chamber(N, { rows: 5, r0: 3.4, r1: 7.6, leather: 0x1f5a38, wood: 0x6a3d1f, open: 0.6 });
    S.scene.add(ch.group);
    return ch;
  };
  const order = Array.from({ length: N }, (_, i) => i).sort((a, b) => Math.abs(a - (N - 1) / 2) - Math.abs(b - (N - 1) / 2));
  const rank = new Array(N); order.forEach((s, j) => { rank[s] = j; });
  // a promise scene: kicker + big headline + 2–3 detail lines, over imagined front pages
  const promise = (id, kicker, head, items, pages) => E.defineScene(id, (S) => {
    desk(S, pages);
    ui.kicker(S, { t0: 0.05, text: kicker, y: 372 });
    ui.headline(S, { t0: 0.1, html: head, y: 410, size: 88, style: 'rise' });
    ui.list(S, { t0: 0.9, stagger: (S.dur - 2.4) / items.length, y: 560, w: 900, size: 40, mark: '●', markColor: OCSS, items });
  });

  E.defineScene('hook', (S) => {
    const ch = hall(S);
    E.camPath(S, [{ t: 0, pos: [0, 2.2, 6.2], look: [0, 1.0, -5], fov: 36 }, { t: S.dur + 0.4, pos: [0.6, 4.0, 10], look: [0, 0.7, -3.5], fov: 36 }], { shake: 0.025, focusOn: true });
    S.aperture = 0.3;
    E.cue(S.t0 + 0.3, 'boom', { g: 0.8 });
    S.update((lt) => { for (let i = 0; i < N; i++) { const on = rank[i] < MAJ; ch.set(i, on ? ORANGE : WARM, on ? 1.4 * ease.back(remap(lt, 0.2 + rank[i] * 0.03, 0.5 + rank[i] * 0.03)) : 0.2); } ch.commit(); });
    ui.kicker(S, { t0: 0, text: 'Alternate reality · imagined', y: 372 });
    ui.headline(S, { t0: 0, html: 'What if <em style="color:#ff9a4a">One Nation</em> won Victoria?', y: 410, size: 88, style: 'slam', stagger: 0.04, t1: S.dur + 1 });
  });

  E.defineScene('night', (S) => {
    const ch = hall(S, { key: 300 });
    E.camPath(S, [{ t: 0, pos: [0, 12, 13.5], look: [0, 0, -2.5], fov: 44 }, { t: 6, pos: [0, 11, 12.5], look: [0, 0.3, -2.8], fov: 44 }], { shake: 0.015, shiftY: 280, focusOn: true });
    S.aperture = 0.1;
    S.update((lt) => { const k = ease.inOut(remap(lt, 1.6, 4.2)); for (let i = 0; i < N; i++) { const on = rank[i] < MAJ * k; ch.set(i, on ? ORANGE : WARM, on ? 1.4 : 0.2); } ch.commit(); });
    ui.kicker(S, { t0: 0.05, text: 'Election night · imagined', y: 372 });
    ui.counter(S, { t0: 0.3, dur: 0.6, to: 0, y: 400, x: 80, w: 440, size: 150, color: '#c3c9d4', label: `seats in 2022 (${d.onp2022}% of the vote)`, ticks: false });
    ui.counter(S, { t0: 1.6, dur: 2.6, from: 0, to: MAJ, suffix: '+', y: 400, x: 540, w: 460, size: 150, align: 'right', color: OCSS, label: 'seats in this reality' });
    ui.block(S, { t0: 4.4, html: '<b style="color:#ff9a4a">Warren Pickering</b> forms government', cls: 'body', y: 640, align: 'center', size: 44 });
  });

  promise('rail', 'Promise 1 · transport', 'Rail Loop <em>cancelled</em>',
    ['Suburban Rail Loop <b>scrapped</b>', 'Money moved to <b>electrifying the Melton line</b>', 'And finishing <b>Airport Rail</b>'],
    [['Rail Loop axed', 'Funds redirected to Melton and Airport Rail', 'Week 1']]);
  promise('energy', 'Promise 2 · energy', 'Net zero <em>scrapped</em>',
    ['State <b>net zero targets</b> and subsidies scrapped', '<b>Nuclear ban</b> lifted', '<b>VNI West</b> and the <b>Western Renewables Link</b> cancelled'],
    [['Net zero scrapped', 'Nuclear ban to be repealed', 'Week 2']]);
  promise('money', 'Promise 3 · your wallet', 'Land tax <em>rolled back</em>',
    ['Labor\'s <b>land tax increases</b> reversed', '<b>10% stamp duty on insurance</b> abolished', 'Higher <b>payroll tax</b> threshold'],
    [['Land tax rollback', 'Insurance stamp duty abolished', 'Month 1']]);
  promise('crime', 'Promise 4 · crime', 'Kids tried <em>as adults</em>',
    ['Children charged <b>as adults</b> for serious violent offences', 'Age of criminal responsibility back to <b>10</b>', 'A <b>24/7 bail court</b>, three new Magistrates\' Courts'],
    [['Youth crime crackdown', 'Age of criminal responsibility to 10', 'Month 2']]);
  promise('more', 'Promise 5 · and more', 'Schools &amp; <em>hospitals</em>',
    ['A <b>knowledge-rich</b> school curriculum', '<b>24/7</b> regional emergency departments', 'Higher duty on <b>foreign buyers</b>'],
    [['New curriculum unveiled', 'Literacy, numeracy, science, history, civics', 'Month 3']]);

  E.defineScene('check', (S) => {
    real.room(S, { carpet: 0x5a1f22, wood: 0x5a361d, width: 30, depth: 26, height: 10, key: 260 });
    const LC = 40; const ch = real.chamber(LC, { rows: 3, r0: 3.0, r1: 5.4, leather: 0x6b1f24, wood: 0x6a3d1f, open: 0.6 }); S.scene.add(ch.group);
    E.camPath(S, [{ t: 0, pos: [0, 8.5, 10], look: [0, 0, -2.2], fov: 42 }, { t: 6, pos: [0, 7.5, 9], look: [0, 0.3, -2.4], fov: 42 }], { shake: 0.015, shiftY: 280, focusOn: true });
    S.aperture = 0.15;
    const cols = [0xe53935, 0x1f5fd1, 0x2fa84f, ORANGE, 0x9aa3b2];
    S.update((lt) => { for (let i = 0; i < LC; i++) ch.set(i, cols[(i * 7) % 5], 0.9 + 0.3 * Math.sin(lt * 3 + i)); ch.commit(); });
    ui.kicker(S, { t0: 0.05, text: 'Reality check', y: 372 });
    ui.headline(S, { t0: 0.1, html: 'Every law needs the <em>upper house</em>', y: 410, size: 84, style: 'rise' });
    ui.block(S, { t0: 1.0, html: '40 seats, elected by <b>proportional vote</b>. Colours shown are illustrative.', cls: 'body', y: 600, w: 900, size: 38 });
  });

  E.defineScene('now', (S) => {
    const ch = hall(S, { key: 240 });
    E.camPath(S, [{ t: 0, pos: [0, 12, 13.5], look: [0, 0, -2.5], fov: 44 }, { t: 6, pos: [0, 11, 12.5], look: [0, 0.3, -2.8], fov: 44 }], { shake: 0.015, shiftY: 280, focusOn: true });
    S.aperture = 0.1;
    const share = R((d.onpNow / 100) * N);
    S.update((lt) => { for (let i = 0; i < N; i++) { const on = rank[i] < share; ch.set(i, on ? ORANGE : WARM, on ? 1.2 : 0.2); } ch.commit(); });
    ui.kicker(S, { t0: 0.05, text: 'Back in the real world', y: 372 });
    ui.counter(S, { t0: 0.3, dur: 1.2, to: d.onpNow, decimals: 1, suffix: '%', y: 400, size: 180, color: OCSS, label: `One Nation · latest ${d.nPolls}-poll average · ${d.days} days to go` });
  });

  E.defineScene('ask', (S) => {
    desk(S, [['Better or worse?', 'Victoria votes 28 November', 'Your call']], { at: () => 0.1, key: 110 });
    ui.kicker(S, { t0: 0.05, text: 'Your turn', y: 372 });
    ui.headline(S, { t0: 0.1, html: 'Would Victoria be <em>better or worse?</em>', y: 410, size: 88, style: 'rise' });
    ui.block(S, { t0: 0.9, html: '<b style="color:#c8f04a">Comment</b> 👇 &nbsp;·&nbsp; <b>Follow</b> for more what-ifs', cls: 'body', y: 680, w: 920, size: 40 });
  });

  E.defineScene('end', (S) => endCard(S, { title: 'More <em>what ifs</em>', sub: 'poltok.netlify.app/au/victoria', sources: 'An imagined scenario. Policies: One Nation\'s own promises, per ABC News\' policy tracker (4 Nov 2026). 2022: VEC.<br>Front pages are fictional; The PolTok Ledger is not a real paper. Nothing here is a prediction.' }));
}
