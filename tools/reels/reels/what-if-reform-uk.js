// Reel — ALTERNATE REALITY: "What if Reform won Britain?" An IMAGINED first term in which Reform UK does what it has promised.
// Every policy is Reform's own, per Reuters' factbox "Reform UK's platform: Deportations, patriotism and 'save our pubs'"
// (17 Mar 2026). No invented events or outcomes. Facts: 2024 general election, Reform 14.3% and 5 seats; 326 of 650 to
// govern; the House of Lords can delay most bills for about a year (Parliament Acts). Today: live GB poll average (uk-polls.js).

export async function data() {
  const { data: polls } = await import('./uk-polls.js');
  const d = await polls();
  const order = ['Lab', 'Con', 'Ref', 'LD', 'Grn'].sort((a, b) => d.now[b] - d.now[a]);
  return { now: d.now, refRank: order.indexOf('Ref') + 1, nRecent: d.nRecent };
}

export const meta = {
  title: 'Alternate reality: Reform wins Britain',
  label: 'ALTERNATE REALITY · IMAGINED',
  labelCls: 'warn',
  out: 'poltok-alt-reality-reform-uk',
  cover: 1.6,
  music: { prog: ['Gm', 'Eb', 'Bb', 'F'], arp: 'updown', seed: 331, swing: 0.03 },
};

const R = Math.round;
const FAR = '[Farage](/fˈæɹɑːʒ/)';
const ORD = ['', 'first', 'second', 'third', 'fourth', 'fifth'];

export const scenes = (d) => [
  { id: 'hook', beats: 7, energy: 3, voLead: 0.08, say: 'Imagine Reform wins the next UK election. Here\'s what they\'ve promised to do.' },
  { id: 'night', beats: 10, energy: 3, trans: { type: 'zoom', dur: 0.45 },
    say: `In twenty twenty-four, Reform got fourteen percent, and five seats. In this reality, it passes three hundred and twenty-six, and Nigel ${FAR} is prime minister.`,
    cap: '2024: 14.3% and 5 seats. In this imagined reality: 326+ seats, PM Nigel Farage.' },
  { id: 'migration', beats: 11, energy: 3, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: 'First, Britain leaves the European Convention on Human Rights. Up to six hundred thousand asylum seekers deported. And a new Deportation Command, modelled on America\'s ICE.',
    cap: 'Promise: leave the ECHR; deport up to 600,000 asylum seekers; a Deportation Command modelled on ICE.' },
  { id: 'energy', beats: 9, energy: 3, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: 'Net zero targets are scrapped, including the electric car mandate. More oil, more gas, more nuclear.',
    cap: 'Promise: scrap net zero targets and the zero-emission vehicle mandate; maximise oil and gas; scale up nuclear.' },
  { id: 'state', beats: 10, energy: 3, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: 'Sixty-eight thousand government jobs cut. No benefits for foreign nationals. And VAT for pubs and restaurants cut to ten percent.',
    cap: 'Promise: cut 68,500 government jobs; end benefits for foreign nationals; 10% VAT for hospitality.' },
  { id: 'culture', beats: 10, energy: 3, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: 'The Equality Act is scrapped. Schools get a patriotic curriculum. And the Bank of England gets a bitcoin reserve.',
    cap: 'Promise: axe the Equality Act 2010; a "patriotic" curriculum; a bitcoin reserve at the Bank of England.' },
  { id: 'check', beats: 9, energy: 2, trans: { type: 'flash', dur: 0.36 },
    say: 'But reality check: the House of Lords can still delay most new laws for about a year.',
    cap: 'Reality check: the House of Lords can delay most bills for about a year.' },
  { id: 'now', beats: 8, energy: 2, trans: { type: 'whip', dir: 'up', dur: 0.42 },
    say: `Back in the real world, Reform's polling around ${R(d.now.Ref)} percent, in ${ORD[d.refRank] || d.refRank + 'th'} place.`,
    cap: `Real world: Reform ~${d.now.Ref}%, ${ORD[d.refRank] || d.refRank + 'th'} in the latest ${d.nRecent}-poll average.` },
  { id: 'ask', beats: 8, energy: 2, trans: { type: 'zoom', dur: 0.45 },
    say: 'So, would Britain be better, or worse? Tell me in the comments.', cap: 'Better or worse? Comment 👇' },
  { id: 'end', beats: 6, energy: 0, trans: { type: 'zoom', dur: 0.5 }, noProgress: true },
];

export function build({ E, kit, ui, THREE, endCard, real }) {
  const { C, ease, remap } = E;
  const d = E.data;
  const TEAL = 0x12b6cf, TCSS = '#2fd3e6';
  const N = 650, MAJ = 326, WARM = 0xffe2b0;

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
    c.save(); c.translate(w - 250, 1180); c.rotate(-0.22); c.strokeStyle = 'rgba(18,140,160,.9)'; c.lineWidth = 9; c.strokeRect(-190, -60, 380, 120); c.fillStyle = 'rgba(18,140,160,.9)'; c.font = '900 60px "Inter Tight"'; c.textAlign = 'center'; c.fillText('IMAGINED', 0, 22); c.restore();
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
  // green-leather Commons, 650 seats (illustrative seating)
  const hall = (S, o = {}) => {
    real.room(S, { carpet: 0x1f4a2c, wood: 0x5a361d, width: 40, depth: 34, height: 12, key: o.key ?? 340 });
    const ch = real.chamber(N, { rows: 13, r0: 3.4, r1: 11.0, leather: 0x1d5634, wood: 0x6a3d1f, open: 0.6 });
    S.scene.add(ch.group);
    return ch;
  };
  const order = Array.from({ length: N }, (_, i) => i).sort((a, b) => Math.abs(a - (N - 1) / 2) - Math.abs(b - (N - 1) / 2));
  const rank = new Array(N); order.forEach((s, j) => { rank[s] = j; });
  const WIDE = [{ t: 0, pos: [0, 16, 17.5], look: [0, 0, -3.5], fov: 44 }, { t: 6, pos: [0, 15, 16.5], look: [0, 0.3, -3.6], fov: 44 }];
  const promise = (id, kicker, head, items, pages) => E.defineScene(id, (S) => {
    desk(S, pages);
    ui.kicker(S, { t0: 0.05, text: kicker, y: 372 });
    ui.headline(S, { t0: 0.1, html: head, y: 410, size: 88, style: 'rise' });
    ui.list(S, { t0: 0.9, stagger: (S.dur - 2.4) / items.length, y: 560, w: 900, size: 40, mark: '●', markColor: TCSS, items });
  });

  E.defineScene('hook', (S) => {
    const ch = hall(S);
    E.camPath(S, [{ t: 0, pos: [0, 2.6, 7.5], look: [0, 1.0, -6], fov: 38 }, { t: S.dur + 0.4, pos: [0.8, 5.5, 14], look: [0, 0.7, -4], fov: 38 }], { shake: 0.025, focusOn: true });
    S.aperture = 0.3;
    E.cue(S.t0 + 0.3, 'boom', { g: 0.8 });
    S.update((lt) => { for (let i = 0; i < N; i++) { const on = rank[i] < MAJ; ch.set(i, on ? TEAL : WARM, on ? 1.3 * ease.back(remap(lt, 0.2 + rank[i] * 0.004, 0.5 + rank[i] * 0.004)) : 0.2); } ch.commit(); });
    ui.kicker(S, { t0: 0, text: 'Alternate reality · imagined', y: 372 });
    ui.headline(S, { t0: 0, html: 'What if <em style="color:#2fd3e6">Reform</em> won Britain?', y: 410, size: 88, style: 'slam', stagger: 0.04, t1: S.dur + 1 });
  });

  E.defineScene('night', (S) => {
    const ch = hall(S, { key: 360 });
    E.camPath(S, WIDE, { shake: 0.015, shiftY: 280, focusOn: true });
    S.aperture = 0.1;
    S.update((lt) => { const k = ease.inOut(remap(lt, 1.8, 4.4)); for (let i = 0; i < N; i++) { const on = rank[i] < Math.max(5, MAJ * k); ch.set(i, on ? TEAL : WARM, on ? 1.3 : 0.2); } ch.commit(); });
    ui.kicker(S, { t0: 0.05, text: 'Election night · imagined', y: 372 });
    ui.counter(S, { t0: 0.3, dur: 0.6, to: 5, y: 400, x: 80, w: 440, size: 140, color: '#c3c9d4', label: 'seats in 2024 (14.3%)', ticks: false });
    ui.counter(S, { t0: 1.8, dur: 2.6, from: 5, to: MAJ, suffix: '+', y: 400, x: 540, w: 460, size: 140, align: 'right', color: TCSS, label: 'seats in this reality' });
    ui.block(S, { t0: 4.6, html: '<b style="color:#2fd3e6">Nigel Farage</b> becomes prime minister', cls: 'body', y: 640, align: 'center', size: 44 });
  });

  promise('migration', 'Promise 1 · migration', 'Out of the <em>ECHR</em>',
    ['<b>Leave</b> the European Convention on Human Rights', 'Up to <b>600,000</b> asylum seekers deported', 'A <b>Deportation Command</b>, modelled on ICE'],
    [['Britain quits the ECHR', 'Human Rights Act to be repealed', 'Week 1']]);
  promise('energy', 'Promise 2 · energy', 'Net zero <em>scrapped</em>',
    ['<b>Net zero</b> targets scrapped', 'Electric car <b>mandate</b> gone', 'Maximum <b>oil and gas</b>, more <b>nuclear</b>'],
    [['Net zero scrapped', 'North Sea drilling to expand', 'Week 2']]);
  promise('state', 'Promise 3 · the state', '<em>68,500</em> jobs cut',
    ['<b>68,500</b> government jobs cut', '<b>No benefits</b> for foreign nationals', '<b>10% VAT</b> for pubs and restaurants'],
    [['Civil service cut', '68,500 roles to go', 'Month 1']]);
  promise('culture', 'Promise 4 · culture', 'Equality Act <em>axed</em>',
    ['The <b>Equality Act 2010</b> scrapped', 'A <b>"patriotic"</b> school curriculum', 'A <b>bitcoin reserve</b> at the Bank of England'],
    [['Equality Act axed', 'New curriculum announced', 'Month 3']]);

  E.defineScene('check', (S) => {
    real.room(S, { carpet: 0x5a1f22, wood: 0x6a4524, width: 32, depth: 28, height: 11, key: 280 });
    const LN = 200; const ch = real.chamber(LN, { rows: 7, r0: 3.4, r1: 8.6, leather: 0x8a1f28, wood: 0x6a3d1f, open: 0.6 }); S.scene.add(ch.group);
    E.camPath(S, [{ t: 0, pos: [0, 11, 12.5], look: [0, 0, -2.8], fov: 42 }, { t: 6, pos: [0, 10, 11.5], look: [0, 0.3, -3], fov: 42 }], { shake: 0.015, shiftY: 280, focusOn: true });
    S.aperture = 0.12;
    S.update((lt) => { for (let i = 0; i < LN; i++) ch.set(i, 0xffd9a0, 0.5 + 0.3 * Math.sin(lt * 2 + i * 0.2)); ch.commit(); });
    ui.kicker(S, { t0: 0.05, text: 'Reality check', y: 372 });
    ui.headline(S, { t0: 0.1, html: 'The <em>House of Lords</em>', y: 410, size: 96, style: 'rise' });
    ui.block(S, { t0: 1.0, html: 'Can delay most new laws for <b>about a year</b>. Seating shown is illustrative.', cls: 'body', y: 600, w: 900, size: 38 });
  });

  E.defineScene('now', (S) => {
    const ch = hall(S, { key: 300 });
    E.camPath(S, WIDE, { shake: 0.015, shiftY: 280, focusOn: true });
    S.aperture = 0.1;
    const a = d.now; const sf = (v) => R((v / 100) * N);
    const cols = [...Array(sf(a.Lab)).fill(0xe4003b), ...Array(sf(a.Con)).fill(0x0087dc), ...Array(sf(a.Ref)).fill(TEAL)];
    S.update(() => { for (let i = 0; i < N; i++) ch.set(i, cols[i] ?? WARM, cols[i] ? 1.1 : 0.2); ch.commit(); });
    ui.kicker(S, { t0: 0.05, text: `Back in the real world · last ${d.nRecent} polls`, y: 372 });
    ui.counter(S, { t0: 0.3, dur: 1.2, to: a.Ref, decimals: 1, suffix: '%', y: 400, size: 170, color: TCSS, label: `Reform · ${ORD[d.refRank] || d.refRank + 'th'} place` });
  });

  E.defineScene('ask', (S) => {
    desk(S, [['Better or worse?', 'Next UK general election due by 2029', 'Your call']], { at: () => 0.1, key: 110 });
    ui.kicker(S, { t0: 0.05, text: 'Your turn', y: 372 });
    ui.headline(S, { t0: 0.1, html: 'Would Britain be <em>better or worse?</em>', y: 410, size: 84, style: 'rise' });
    ui.block(S, { t0: 0.9, html: '<b style="color:#c8f04a">Comment</b> 👇 &nbsp;·&nbsp; <b>Follow</b> for more what-ifs', cls: 'body', y: 680, w: 920, size: 40 });
  });

  E.defineScene('end', (S) => endCard(S, { title: 'More <em>what ifs</em>', sub: 'poltok.netlify.app', sources: 'An imagined scenario. Policies: Reform UK\'s own platform, per Reuters (17 Mar 2026). 2024: Reform 14.3%, 5 seats. Polls: PolTok GB average.<br>Front pages are fictional; The PolTok Ledger is not a real paper. Nothing here is a prediction.' }));
}
