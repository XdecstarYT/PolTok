// Reel — "Dan Andrews: the wins, the fails, and what if he'd stayed." Balanced: four wins, four fails, same airtime.
// Facts (ABC News, 27 Sep 2023, "praised and panned during near a decade as premier"): sworn in Dec 2014; three straight
// wins with increasing margins; 3,200+ days as premier; level crossings — 110 to go by 2030, 70+ removed by Sept 2023;
// first state to legislate assisted dying; withdrew from hosting the 2026 Commonwealth Games (July 2023).
// East West Link: Victorian Auditor-General (Dec 2015) — cancelling cost "in excess of $1.1 billion".
// Royal Commission into Family Violence (2015–16): 227 recommendations, all accepted. Free TAFE: from 2019.
// Hotel quarantine: the Coate inquiry (2020) linked breaches at two quarantine hotels to Melbourne's second wave.
// Lockdowns: Melbourne's cumulative lockdowns were about 260 days, among the longest in the world.
// Commonwealth Games: Andrews said hosting would cost $6–7 billion against a $2.6 billion budget.
// "What if he'd stayed" is posed as a question over live polls — no prediction is made. Labor 2022 vote: VEC; now: latest 4 polls.

export async function data() {
  const { data: base } = await import('./what-if-andrews.js');
  return base();
}

export const meta = {
  title: 'Dan Andrews: wins, fails, what if',
  label: 'WHAT IF · HISTORY',
  out: 'poltok-andrews-wins-fails-what-if',
  cover: 1.6,
  music: { prog: ['Am', 'F', 'C', 'G'], arp: 'updown', seed: 211, swing: 0.04 },
};

const R = Math.round;
const JA = '[Jacinta Allan](/dʒəsˈɪntə ˈælən/)';

export const scenes = (d) => [
  { id: 'hook', beats: 6, energy: 3, voLead: 0.08, say: 'Dan Andrews. The wins, the fails, and what if he\'d stayed.' },
  { id: 'record', beats: 8, energy: 2, trans: { type: 'zoom', dur: 0.45 },
    say: 'Nine years as premier. Three election wins, each one bigger than the last.',
    cap: 'Premier 2014–2023. Three straight election wins, with growing margins.' },
  { id: 'wins', beats: 16, energy: 3, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: 'The wins. Over seventy level crossings removed. The first state to legalise assisted dying. Free TAFE. And a family violence royal commission, with all two hundred and twenty-seven recommendations accepted.',
    cap: 'Wins: 70+ level crossings gone · first assisted dying law · Free TAFE · all 227 family violence recommendations accepted.' },
  { id: 'fails', beats: 16, energy: 3, trans: { type: 'whip', dir: 'right', dur: 0.42 },
    say: 'The fails. Hotel quarantine breaches, linked to the second wave. Around two hundred and sixty days of lockdown. The Commonwealth Games, cancelled after costs blew out. And over a billion dollars to scrap the East West Link.',
    cap: 'Fails: hotel quarantine breaches · ~260 days of lockdown · Commonwealth Games cancelled · $1.1b+ to scrap East West Link.' },
  { id: 'after', beats: 9, energy: 2, trans: { type: 'flash', dur: 0.36 },
    say: `He quit in twenty twenty-three. ${JA} took over, then Ben Carroll.`,
    cap: 'Sept 2023: Andrews quits. Then Jacinta Allan, then Ben Carroll (July 2026).' },
  { id: 'whatif', beats: 11, energy: 3, trans: { type: 'whip', dir: 'up', dur: 0.42 },
    say: `If he'd stayed, he'd be fighting this election with Labor on ${R(d.alpNow)} percent. It won ${R(d.alp2022)} last time.`,
    cap: `If he'd stayed: Labor's now on ~${d.alpNow}%, down from ${d.alp2022}% in 2022.` },
  { id: 'ask', beats: 9, energy: 2, trans: { type: 'zoom', dur: 0.45 },
    say: 'So, would Andrews have saved Labor? Or made it worse? Tell me in the comments.',
    cap: 'Would Andrews have saved Labor, or made it worse? 👇' },
  { id: 'end', beats: 6, energy: 0, trans: { type: 'zoom', dur: 0.5 }, noProgress: true },
];

export function build({ E, kit, ui, THREE, endCard, real }) {
  const { C, ease, remap } = E;
  const d = E.data;
  const GOOD = '#5fd17f', BAD = '#ff6b6b';

  const paper = (head, sub, date, stamp) => real.sheet(1.5, 2.0, (c, w) => {
    c.fillStyle = 'rgba(20,18,15,.9)'; c.font = '900 92px Newsreader'; c.textAlign = 'center'; c.fillText('The PolTok Ledger', w / 2, 120);
    c.fillRect(50, 150, w - 100, 6); c.font = '600 30px "Inter Tight"'; c.fillText(date, w / 2, 196); c.fillRect(50, 214, w - 100, 2);
    c.textAlign = 'left'; c.font = '800 100px Newsreader';
    const words = head.split(' '); let line = '', y = 340;
    for (const wd of words) { const t = line ? line + ' ' + wd : wd; if (c.measureText(t).width > w - 110 && line) { c.fillText(line, 55, y); line = wd; y += 104; } else line = t; }
    c.fillText(line, 55, y);
    c.font = '500 40px Newsreader'; c.fillStyle = 'rgba(20,18,15,.7)'; c.fillText(sub, 55, y + 80);
    c.fillStyle = 'rgba(20,18,15,.18)';
    for (let col = 0; col < 3; col++) for (let l = 0; l < 12; l++) c.fillRect(55 + col * ((w - 110) / 3), y + 140 + l * 44, (w - 110) / 3 - 30 - ((l * 7 + col) % 4) * 18, 14);
    if (stamp) { c.save(); c.translate(w - 240, 1180); c.rotate(-0.22); const col = stamp === 'WIN' ? 'rgba(30,140,70,.85)' : 'rgba(190,40,40,.85)'; c.strokeStyle = col; c.lineWidth = 9; c.strokeRect(-140, -60, 280, 120); c.fillStyle = col; c.font = '900 64px "Inter Tight"'; c.textAlign = 'center'; c.fillText(stamp, 0, 22); c.restore(); }
  });
  const desk = (S, pages, o = {}) => {
    real.room(S, { carpet: 0x23283a, wood: 0x4e3320, width: 16, depth: 14, height: 7, key: o.key ?? 100, area: 2.4, fill: 0.28 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.16, 3.8), real.pbr(real.tex.wood(0x5c3a20), { repeat: [2, 1], clearcoat: 0.7, clearcoatRoughness: 0.2 }));
    top.position.set(0, 1.0, 0); top.receiveShadow = true; top.castShadow = true; S.scene.add(top);
    const ms = pages.map(([h, s, dt, st], i) => { const p = paper(h, s, dt, st); p.rotation.x = -Math.PI / 2; p.rotation.z = (i - (pages.length - 1) / 2) * 0.1 + Math.sin(i * 2.3) * 0.04; p.position.set((i - (pages.length - 1) / 2) * 0.32, 1.09 + i * 0.012, (pages.length - 1 - i) * -0.18); S.scene.add(p); return p; });
    const at = o.at ?? ((i) => 0.25 + i * 0.7);
    ms.forEach((_, i) => E.cue(S.t0 + at(i) + 0.35, 'pop', { i }));
    S.update((lt) => ms.forEach((p, i) => { const k = ease.expo(remap(lt, at(i), at(i) + 0.5)); p.position.y = 1.09 + i * 0.012 + (1 - k) * 2.6; p.visible = k > 0.01; }));
    E.camPath(S, [{ t: 0, pos: [0, 5.3, 3.3], look: [0, 1.1, -0.1], fov: 34 }, { t: S.dur, pos: [0.25, 4.9, 3.0], look: [0, 1.1, -0.1], fov: 34 }], { shake: 0.012, shiftY: 470, focusOn: true });
    S.aperture = 0.35;
  };

  E.defineScene('hook', (S) => {
    desk(S, [['Andrews wins third term', 'Labor returned with a bigger majority', 'November 2022', 'WIN'], ['Andrews resigns', 'Premier steps down after nine years', 'September 2023', null]], { at: (i) => 0.05 + i * 0.5 });
    E.cue(S.t0 + 0.3, 'boom', { g: 0.7 });
    ui.kicker(S, { t0: 0, text: 'Victoria · 2014–2023', y: 372 });
    ui.headline(S, { t0: 0, html: 'Dan Andrews: <em>wins, fails, what if</em>', y: 410, size: 84, style: 'slam', stagger: 0.04, t1: S.dur + 1 });
  });

  E.defineScene('record', (S) => {
    desk(S, [['Andrews sworn in', 'Labor ends a one-term Coalition government', 'December 2014', null]], { at: () => 0.2 });
    ui.kicker(S, { t0: 0.05, text: 'The record', y: 372 });
    ui.counter(S, { t0: 0.3, dur: 1.2, to: 3200, comma: true, suffix: '+', y: 400, size: 150, color: '#c8f04a', label: 'days as premier · 3 straight election wins' });
  });

  E.defineScene('wins', (S) => {
    desk(S, [['Level crossings removed', 'More than 70 gone, 110 by 2030', '2015–2023', 'WIN'], ['Assisted dying legalised', 'First state in Australia', '2017', 'WIN'], ['Free TAFE begins', 'Priority courses fee-free', '2019', 'WIN'], ['All 227 accepted', 'Family violence royal commission', '2016', 'WIN']], { at: (i) => 0.3 + i * 3.1 });
    ui.kicker(S, { t0: 0.05, text: 'The wins', y: 372 });
    ui.list(S, { t0: 0.35, stagger: 3.1, y: 420, w: 900, size: 42, mark: '✓', markColor: GOOD, items: [
      '<b>70+</b> level crossings removed',
      '<b>First</b> state to legalise assisted dying',
      '<b>Free TAFE</b>',
      'All <b>227</b> family violence recommendations accepted',
    ] });
  });

  E.defineScene('fails', (S) => {
    desk(S, [['Hotel quarantine breaches', 'Inquiry links them to the second wave', '2020', 'FAIL'], ['Lockdown, again', 'About 260 days in total', '2020–2021', 'FAIL'], ['Games cancelled', 'Costs blow out past $6 billion', 'July 2023', 'FAIL'], ['$1.1b to scrap East West', 'Auditor-General report', '2015', 'FAIL']], { at: (i) => 0.3 + i * 3.1 });
    ui.kicker(S, { t0: 0.05, text: 'The fails', y: 372 });
    ui.list(S, { t0: 0.35, stagger: 3.1, y: 420, w: 900, size: 42, mark: '✕', markColor: BAD, items: [
      '<b>Hotel quarantine</b> breaches, linked to the second wave',
      '<b>~260 days</b> of lockdown',
      '<b>Commonwealth Games</b> cancelled after costs blew out',
      '<b>$1.1b+</b> to scrap the East West Link',
    ] });
  });

  E.defineScene('after', (S) => {
    desk(S, [['Allan becomes Premier', 'Sworn in after Andrews exit', '27 September 2023', null], ['Carroll replaces Allan', 'Labor leadership change', 'July 2026', null]], { at: (i) => 0.3 + i * 1.4 });
    ui.kicker(S, { t0: 0.05, text: 'After Andrews', y: 372 });
    ui.list(S, { t0: 0.35, stagger: 1.4, y: 420, w: 900, size: 46, mark: '●', markColor: BAD, items: ['<b>Sept 2023</b> · Jacinta Allan', '<b>July 2026</b> · Ben Carroll'] });
  });

  E.defineScene('whatif', (S) => {
    real.room(S, { carpet: 0x2d4a33, wood: 0x5a361d, width: 30, depth: 26, height: 10, key: 260 });
    const N = 88; const ch = real.chamber(N, { rows: 5, r0: 3.4, r1: 7.6, leather: 0x1f5a38, wood: 0x6a3d1f, open: 0.6 }); S.scene.add(ch.group);
    E.camPath(S, [{ t: 0, pos: [0, 12, 13.5], look: [0, 0, -2.5], fov: 44 }, { t: 6, pos: [0, 11, 12.5], look: [0, 0.3, -2.8], fov: 44 }], { shake: 0.015, shiftY: 280, focusOn: true });
    S.aperture = 0.1;
    const a = R((d.alp2022 / 100) * N), b = R((d.alpNow / 100) * N);
    S.update((lt) => { const k = ease.inOut(remap(lt, 0.8, 2.4)); const n = R(a - (a - b) * k); for (let i = 0; i < N; i++) ch.set(i, i < n ? 0xe53935 : 0xffe2b0, i < n ? 1.3 : 0.2); ch.commit(); });
    ui.kicker(S, { t0: 0.05, text: 'What if he\'d stayed?', y: 372 });
    ui.counter(S, { t0: 0.3, dur: 2.2, from: d.alp2022, to: d.alpNow, decimals: 1, suffix: '%', y: 400, size: 180, color: BAD, label: `Labor's vote: 2022 election → latest ${d.nPolls}-poll average` });
    ui.block(S, { t0: 2.6, html: `The election he'd be fighting is <b>${d.days} days</b> away`, cls: 'body', y: 640, align: 'center', size: 40 });
  });

  E.defineScene('ask', (S) => {
    desk(S, [['What if?', 'Victoria votes 28 November', 'Your call', null]], { at: () => 0.1, key: 110 });
    ui.kicker(S, { t0: 0.05, text: 'Your turn', y: 372 });
    ui.headline(S, { t0: 0.1, html: 'Saved Labor, or <em>made it worse?</em>', y: 410, size: 92, style: 'rise' });
    ui.block(S, { t0: 0.9, html: '<b style="color:#c8f04a">Comment</b> 👇 &nbsp;·&nbsp; <b>Follow</b> for more what-ifs', cls: 'body', y: 640, w: 920, size: 42 });
  });

  E.defineScene('end', (S) => endCard(S, { title: 'More <em>what ifs</em>', sub: 'poltok.netlify.app/au/victoria', sources: 'Sources: ABC News (27 Sep 2023); Victorian Auditor-General (2015); COVID-19 Hotel Quarantine Inquiry (2020); VEC; latest polls on Wikipedia.<br>Newspaper pages are illustrative; The PolTok Ledger is not a real paper.' }));
}
