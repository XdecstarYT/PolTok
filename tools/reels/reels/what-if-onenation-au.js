// Reel — ALTERNATE REALITY: "What if One Nation won Australia?" An IMAGINED first year in which One Nation does what its
// federal platform promises. Every policy is One Nation's own, per ABC News ("More people say they'll vote One Nation.
// What are they voting for?", 10 Feb 2026). No invented events, reactions or outcomes.
// Facts: 2025 federal election One Nation 6.4% (Crikey, 11 Nov 2026), no House seats; first House seat won at the Farrer
// by-election, 9 May 2026 (AEC). 150 House seats, 76 to govern; the Senate (76 senators) must pass every law.
// Leader: Pauline Hanson. Today's poll: live average of the latest 4 national polls (au-what-if.js).

export async function data() {
  const { data: au } = await import('./au-what-if.js');
  const d = await au();
  return { onpNow: d.avg.ONP, alpNow: d.avg.ALP, nPolls: d.polls.length };
}

export const meta = {
  title: 'Alternate reality: One Nation wins Australia',
  label: 'ALTERNATE REALITY · IMAGINED',
  labelCls: 'warn',
  out: 'poltok-alt-reality-one-nation-au',
  cover: 1.6,
  music: { prog: ['Dm', 'Bb', 'Gm', 'A'], arp: 'updown', seed: 307, swing: 0.03 },
};

const R = Math.round;

export const scenes = (d) => [
  { id: 'hook', beats: 7, energy: 3, voLead: 0.08,
    say: 'Imagine One Nation wins the next federal election. Here\'s what they\'ve promised to do.' },
  { id: 'night', beats: 11, energy: 3, trans: { type: 'zoom', dur: 0.45 },
    say: 'At the last election, One Nation got six percent, and no lower house seats. In May, it won its first, in Farrer. In this reality, it passes seventy-six, and Pauline Hanson is prime minister.',
    cap: '2025: 6.4% and no House seats. May 2026: first seat (Farrer). In this imagined reality: 76+ seats, PM Pauline Hanson.' },
  { id: 'migration', beats: 10, energy: 3, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: 'First, migration. Visas capped at a hundred and thirty thousand a year. And Australia leaves the UN Refugee Convention.',
    cap: 'Promise: cap visas at 130,000 a year; withdraw from the UN Refugee Convention; deport 75,000 people.' },
  { id: 'energy', beats: 10, energy: 3, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: 'Net zero is scrapped. New coal plants, a nuclear reactor in regional New South Wales, and out of the Paris Agreement.',
    cap: 'Promise: scrap net zero; build coal plants; a nuclear reactor in regional NSW; leave the Paris Agreement.' },
  { id: 'wallet', beats: 10, energy: 3, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: 'Fuel excise is halved. Couples with kids can file tax together. And no GST on materials for new homes.',
    cap: 'Promise: halve fuel excise; joint tax returns for couples with kids; no GST on building materials for new homes.' },
  { id: 'cuts', beats: 9, energy: 3, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: 'And to pay for it, ninety billion dollars a year cut from Commonwealth spending.',
    cap: 'Promise: cut Commonwealth spending by $90 billion a year.' },
  { id: 'check', beats: 9, energy: 2, trans: { type: 'flash', dur: 0.36 },
    say: 'But reality check: every law still has to pass the Senate.',
    cap: 'Reality check: every law must also pass the Senate.' },
  { id: 'now', beats: 8, energy: 2, trans: { type: 'whip', dir: 'up', dur: 0.42 },
    say: `Back in the real world, One Nation's polling around ${R(d.onpNow)} percent. Labor's on ${R(d.alpNow)}.`,
    cap: `Real world: One Nation ~${d.onpNow}%, Labor ~${d.alpNow}% (latest ${d.nPolls}-poll average).` },
  { id: 'ask', beats: 8, energy: 2, trans: { type: 'zoom', dur: 0.45 },
    say: 'So, would Australia be better, or worse? Tell me in the comments.', cap: 'Better or worse? Comment 👇' },
  { id: 'end', beats: 6, energy: 0, trans: { type: 'zoom', dur: 0.5 }, noProgress: true },
];

export function build({ E, kit, ui, THREE, endCard, real }) {
  const { C, ease, remap } = E;
  const d = E.data;
  const ORANGE = 0xd9480f, OCSS = '#ff9a4a';
  const N = 150, MAJ = 76, WARM = 0xffe2b0;

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
  // House of Representatives: green leather, 150 seats
  const hall = (S, o = {}) => {
    real.room(S, { carpet: 0x2f5a3a, wood: 0x6a4524, width: 32, depth: 28, height: 11, key: o.key ?? 300 });
    const ch = real.chamber(N, { rows: 6, r0: 3.6, r1: 8.6, leather: 0x1d5634, wood: 0x7a4a26, open: 0.6 });
    S.scene.add(ch.group);
    return ch;
  };
  const order = Array.from({ length: N }, (_, i) => i).sort((a, b) => Math.abs(a - (N - 1) / 2) - Math.abs(b - (N - 1) / 2));
  const rank = new Array(N); order.forEach((s, j) => { rank[s] = j; });
  const promise = (id, kicker, head, items, pages) => E.defineScene(id, (S) => {
    desk(S, pages);
    ui.kicker(S, { t0: 0.05, text: kicker, y: 372 });
    ui.headline(S, { t0: 0.1, html: head, y: 410, size: 88, style: 'rise' });
    ui.list(S, { t0: 0.9, stagger: (S.dur - 2.4) / items.length, y: 560, w: 900, size: 40, mark: '●', markColor: OCSS, items });
  });
  const WIDE = [{ t: 0, pos: [0, 13.5, 15], look: [0, 0, -3], fov: 44 }, { t: 6, pos: [0, 12.5, 14], look: [0, 0.3, -3.2], fov: 44 }];

  E.defineScene('hook', (S) => {
    const ch = hall(S);
    E.camPath(S, [{ t: 0, pos: [0, 2.4, 7], look: [0, 1.0, -5], fov: 36 }, { t: S.dur + 0.4, pos: [0.6, 4.4, 11.5], look: [0, 0.7, -3.5], fov: 36 }], { shake: 0.025, focusOn: true });
    S.aperture = 0.3;
    E.cue(S.t0 + 0.3, 'boom', { g: 0.8 });
    S.update((lt) => { for (let i = 0; i < N; i++) { const on = rank[i] < MAJ; ch.set(i, on ? ORANGE : WARM, on ? 1.4 * ease.back(remap(lt, 0.2 + rank[i] * 0.018, 0.5 + rank[i] * 0.018)) : 0.2); } ch.commit(); });
    ui.kicker(S, { t0: 0, text: 'Alternate reality · imagined', y: 372 });
    ui.headline(S, { t0: 0, html: 'What if <em style="color:#ff9a4a">One Nation</em> won Australia?', y: 410, size: 84, style: 'slam', stagger: 0.04, t1: S.dur + 1 });
  });

  E.defineScene('night', (S) => {
    const ch = hall(S, { key: 320 });
    E.camPath(S, WIDE, { shake: 0.015, shiftY: 280, focusOn: true });
    S.aperture = 0.1;
    S.update((lt) => { const k = ease.inOut(remap(lt, 2.6, 5.0)); for (let i = 0; i < N; i++) { const on = rank[i] < MAJ * k || (lt > 1.6 && rank[i] === 0); ch.set(i, on ? ORANGE : WARM, on ? 1.4 : 0.2); } ch.commit(); });
    ui.kicker(S, { t0: 0.05, text: 'Election night · imagined', y: 372 });
    ui.counter(S, { t0: 0.3, dur: 0.6, to: 0, y: 400, x: 80, w: 300, size: 120, color: '#c3c9d4', label: '2025: 6.4%', ticks: false });
    ui.counter(S, { t0: 1.6, dur: 0.4, to: 1, y: 400, x: 390, w: 300, size: 120, color: OCSS, label: 'Farrer, May 2026', ticks: false });
    ui.counter(S, { t0: 2.6, dur: 2.4, from: 1, to: MAJ, suffix: '+', y: 400, x: 700, w: 300, size: 120, align: 'right', color: OCSS, label: 'this reality' });
    ui.block(S, { t0: 5.2, html: '<b style="color:#ff9a4a">Pauline Hanson</b> becomes prime minister', cls: 'body', y: 640, align: 'center', size: 44 });
  });

  promise('migration', 'Promise 1 · migration', 'Visas <em>capped</em>',
    ['Visas capped at <b>130,000</b> a year', '<b>Out</b> of the UN Refugee Convention', '<b>75,000</b> people deported'],
    [['Visa cap announced', '130,000 a year, says new government', 'Week 1']]);
  promise('energy', 'Promise 2 · energy', 'Net zero <em>scrapped</em>',
    ['<b>Net zero</b> scrapped, <b>new coal</b> plants', 'A <b>nuclear reactor</b> in regional NSW', 'Out of the <b>Paris Agreement</b>'],
    [['Net zero scrapped', 'Coal and nuclear plan unveiled', 'Week 3']]);
  promise('wallet', 'Promise 3 · your wallet', 'Fuel excise <em>halved</em>',
    ['Fuel excise cut to <b>26c a litre</b>', '<b>Joint tax returns</b> for couples with kids', '<b>No GST</b> on materials for new homes'],
    [['Fuel excise halved', 'Down to 26 cents a litre', 'Month 1']]);
  promise('cuts', 'Promise 4 · the budget', '<em>$90b</em> a year cut',
    ['Commonwealth spending cut by <b>$90 billion a year</b>', 'Climate Change department <b>shut</b>'],
    [['$90b spending cut', 'Budget overhaul begins', 'Month 4']]);

  E.defineScene('check', (S) => {
    real.room(S, { carpet: 0x5a1f22, wood: 0x6a4524, width: 30, depth: 26, height: 10, key: 260 });
    const SN = 76; const ch = real.chamber(SN, { rows: 4, r0: 3.0, r1: 6.4, leather: 0x6b1f24, wood: 0x7a4a26, open: 0.6 }); S.scene.add(ch.group);
    E.camPath(S, [{ t: 0, pos: [0, 9.5, 11], look: [0, 0, -2.4], fov: 42 }, { t: 6, pos: [0, 8.5, 10], look: [0, 0.3, -2.6], fov: 42 }], { shake: 0.015, shiftY: 280, focusOn: true });
    S.aperture = 0.15;
    const cols = [0xe53935, 0x1f5fd1, 0x2fa84f, ORANGE, 0x9aa3b2];
    S.update((lt) => { for (let i = 0; i < SN; i++) ch.set(i, cols[(i * 7) % 5], 0.9 + 0.3 * Math.sin(lt * 3 + i)); ch.commit(); });
    ui.kicker(S, { t0: 0.05, text: 'Reality check', y: 372 });
    ui.headline(S, { t0: 0.1, html: 'Every law needs the <em>Senate</em>', y: 410, size: 92, style: 'rise' });
    ui.block(S, { t0: 1.0, html: '76 senators, elected by <b>proportional vote</b>. Colours shown are illustrative.', cls: 'body', y: 600, w: 900, size: 38 });
  });

  E.defineScene('now', (S) => {
    const ch = hall(S, { key: 260 });
    E.camPath(S, WIDE, { shake: 0.015, shiftY: 280, focusOn: true });
    S.aperture = 0.1;
    const a = R((d.onpNow / 100) * N), b = R((d.alpNow / 100) * N);
    S.update(() => { for (let i = 0; i < N; i++) { const c = i < b ? 0xe53935 : i >= N - a ? ORANGE : WARM; ch.set(i, c, c === WARM ? 0.2 : 1.2); } ch.commit(); });
    ui.kicker(S, { t0: 0.05, text: `Back in the real world · latest ${d.nPolls} polls`, y: 372 });
    ui.counter(S, { t0: 0.3, dur: 1.2, to: d.onpNow, decimals: 1, suffix: '%', y: 400, x: 540, w: 460, size: 140, align: 'right', color: OCSS, label: 'One Nation' });
    ui.counter(S, { t0: 0.5, dur: 1.2, to: d.alpNow, decimals: 1, suffix: '%', y: 400, x: 80, w: 440, size: 140, color: '#ff6b6b', label: 'Labor', ticks: false });
  });

  E.defineScene('ask', (S) => {
    desk(S, [['Better or worse?', 'Next federal election due by 2028', 'Your call']], { at: () => 0.1, key: 110 });
    ui.kicker(S, { t0: 0.05, text: 'Your turn', y: 372 });
    ui.headline(S, { t0: 0.1, html: 'Would Australia be <em>better or worse?</em>', y: 410, size: 84, style: 'rise' });
    ui.block(S, { t0: 0.9, html: '<b style="color:#c8f04a">Comment</b> 👇 &nbsp;·&nbsp; <b>Follow</b> for more what-ifs', cls: 'body', y: 680, w: 920, size: 40 });
  });

  E.defineScene('end', (S) => endCard(S, { title: 'More <em>what ifs</em>', sub: 'poltok.netlify.app', sources: 'An imagined scenario. Policies: One Nation\'s own federal platform, per ABC News (10 Feb 2026). Farrer: AEC (9 May 2026).<br>Front pages are fictional; The PolTok Ledger is not a real paper. Nothing here is a prediction.' }));
}
