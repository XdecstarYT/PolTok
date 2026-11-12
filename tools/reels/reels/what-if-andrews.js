// Reel — "What if Dan Andrews never resigned?" Facts only: Andrews was Premier from Dec 2014, won the 2014, 2018 and 2022
// elections, and announced his resignation on 26 Sep 2023. Jacinta Allan became Premier on 27 Sep 2023. After weeks of poor
// polling, Ben Carroll replaced her as Labor leader on 28 Jul 2026 (Wikipedia, "2026 Victorian state election").
// Labor's 2022 first-preference vote is computed from VEC data; "now" is the live average of the latest 4 polls (same as
// vic-what-if.js). The counterfactual itself is left to the viewer. No claims about Andrews' conduct.

export async function data() {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../../../src/data/au-vic.ts', import.meta.url), 'utf8');
  const m = src.match(/VIC_RESULTS_2022[^=]*=\s*(\{.*?\});\n/s);
  if (!m) throw new Error('could not read VIC_RESULTS_2022');
  let alp = 0, tot = 0;
  for (const r of Object.values(JSON.parse(m[1]))) for (const c of r.fp || []) { tot += c.v; if (/Labor/i.test(c.pn) && !/DLP|Democratic Labour/i.test(c.pn)) alp += c.v; }
  const { data: vic } = await import('./vic-what-if.js');
  const d = await vic();
  return { alp2022: +(100 * alp / tot).toFixed(1), alpNow: d.avg.ALP, nPolls: d.polls.length, days: d.days };
}

export const meta = {
  title: 'What if Dan Andrews never resigned?',
  label: 'WHAT IF · HISTORY',
  out: 'poltok-what-if-andrews',
  cover: 1.6,
  music: { prog: ['Am', 'F', 'C', 'G'], arp: 'up', seed: 205, swing: 0.04 },
};

const R = Math.round;

export const scenes = (d) => [
  { id: 'hook', beats: 6, energy: 3, voLead: 0.08, say: 'What if Dan Andrews never resigned?' },
  { id: 'quit', beats: 9, energy: 2, trans: { type: 'zoom', dur: 0.45 },
    say: 'He quit in September twenty twenty-three, after nine years as premier and three election wins.',
    cap: 'Andrews resigned in September 2023 after 9 years and 3 election wins.' },
  { id: 'after', beats: 10, energy: 3, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: 'Jacinta Allan took over. Then, this July, after weeks of bad polls, Ben Carroll replaced her.',
    cap: 'Jacinta Allan took over. In July 2026, Ben Carroll replaced her.' },
  { id: 'polls', beats: 9, energy: 3, trans: { type: 'flash', dur: 0.36 },
    say: `Labor won ${R(d.alp2022)} percent in twenty twenty-two. Now it's polling around ${R(d.alpNow)}.`,
    cap: `Labor: ${d.alp2022}% in 2022 → about ${d.alpNow}% in the latest polls.` },
  { id: 'ask', beats: 9, energy: 2, trans: { type: 'zoom', dur: 0.45 },
    say: `Would Andrews have saved Labor, or made it worse? Victoria votes in ${d.days} days. Tell me in the comments.`,
    cap: 'Would Andrews have saved Labor, or made it worse? 👇' },
  { id: 'end', beats: 6, energy: 0, trans: { type: 'zoom', dur: 0.5 }, noProgress: true },
];

export function build({ E, kit, ui, THREE, endCard, real }) {
  const { C, ease, remap } = E;
  const d = E.data;
  const RED = '#ff6b6b';

  const paper = (head, sub, date) => real.sheet(1.5, 2.0, (c, w) => {
    c.fillStyle = 'rgba(20,18,15,.9)'; c.font = '900 92px Newsreader'; c.textAlign = 'center'; c.fillText('The PolTok Ledger', w / 2, 120);
    c.fillRect(50, 150, w - 100, 6); c.font = '600 30px "Inter Tight"'; c.fillText(date, w / 2, 196); c.fillRect(50, 214, w - 100, 2);
    c.textAlign = 'left'; c.font = '800 104px Newsreader';
    const words = head.split(' '); let line = '', y = 340;
    for (const wd of words) { const t = line ? line + ' ' + wd : wd; if (c.measureText(t).width > w - 110 && line) { c.fillText(line, 55, y); line = wd; y += 108; } else line = t; }
    c.fillText(line, 55, y);
    c.font = '500 40px Newsreader'; c.fillStyle = 'rgba(20,18,15,.7)'; c.fillText(sub, 55, y + 80);
    c.fillStyle = 'rgba(20,18,15,.18)';
    for (let col = 0; col < 3; col++) for (let l = 0; l < 14; l++) c.fillRect(55 + col * ((w - 110) / 3), y + 140 + l * 44, (w - 110) / 3 - 30 - ((l * 7 + col) % 4) * 18, 14);
  });
  const desk = (S, pages, o = {}) => {
    real.room(S, { carpet: 0x23283a, wood: 0x4e3320, width: 16, depth: 14, height: 7, key: o.key ?? 100, area: 2.4, fill: 0.28 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.16, 3.8), real.pbr(real.tex.wood(0x5c3a20), { repeat: [2, 1], clearcoat: 0.7, clearcoatRoughness: 0.2 }));
    top.position.set(0, 1.0, 0); top.receiveShadow = true; top.castShadow = true; S.scene.add(top);
    const ms = pages.map(([h, s, dt], i) => { const p = paper(h, s, dt); p.rotation.x = -Math.PI / 2; p.rotation.z = (i - (pages.length - 1) / 2) * 0.1 + Math.sin(i * 2.3) * 0.04; p.position.set((i - (pages.length - 1) / 2) * 0.32, 1.09 + i * 0.012, (pages.length - 1 - i) * -0.18); S.scene.add(p); return p; });
    const at = o.at ?? ((i) => 0.25 + i * 0.7);
    ms.forEach((_, i) => E.cue(S.t0 + at(i) + 0.35, 'pop', { i }));
    S.update((lt) => ms.forEach((p, i) => { const k = ease.expo(remap(lt, at(i), at(i) + 0.5)); p.position.y = 1.09 + i * 0.012 + (1 - k) * 2.6; p.visible = k > 0.01; }));
    E.camPath(S, [{ t: 0, pos: [0, 5.3, 3.3], look: [0, 1.1, -0.1], fov: 34 }, { t: S.dur, pos: [0.25, 4.9, 3.0], look: [0, 1.1, -0.1], fov: 34 }], { shake: 0.012, shiftY: 470, focusOn: true });
    S.aperture = 0.35;
  };

  E.defineScene('hook', (S) => {
    desk(S, [['Andrews resigns', 'Premier steps down after nine years', '26 September 2023']], { at: () => 0.05 });
    E.cue(S.t0 + 0.3, 'boom', { g: 0.7 });
    ui.kicker(S, { t0: 0, text: 'Victoria · alternate history', y: 372 });
    ui.headline(S, { t0: 0, html: 'What if Andrews <em>never quit?</em>', y: 410, size: 92, style: 'slam', stagger: 0.04, t1: S.dur + 1 });
  });

  E.defineScene('quit', (S) => {
    desk(S, [['Andrews wins again', 'Third straight election win', 'November 2022'], ['Andrews resigns', 'Premier since 2014', 'September 2023']]);
    ui.kicker(S, { t0: 0.05, text: 'What actually happened', y: 372 });
    ui.list(S, { t0: 0.4, stagger: 0.8, y: 420, w: 900, size: 46, mark: '●', markColor: RED, items: ['Premier for <b>9 years</b>', 'Won <b>2014, 2018, 2022</b>', 'Resigned <b>Sept 2023</b>'] });
  });

  E.defineScene('after', (S) => {
    desk(S, [['Allan becomes Premier', 'Sworn in after Andrews exit', '27 September 2023'], ['Carroll replaces Allan', 'Labor leadership change', 'July 2026']], { at: (i) => 0.3 + i * 1.6 });
    ui.kicker(S, { t0: 0.05, text: 'Since then', y: 372 });
    ui.list(S, { t0: 0.35, stagger: 1.6, y: 420, w: 900, size: 46, mark: '●', markColor: RED, items: ['<b>Sept 2023</b> · Jacinta Allan', '<b>July 2026</b> · Ben Carroll'] });
  });

  E.defineScene('polls', (S) => {
    real.room(S, { carpet: 0x2d4a33, wood: 0x5a361d, width: 30, depth: 26, height: 10, key: 260 });
    const N = 88; const ch = real.chamber(N, { rows: 5, r0: 3.4, r1: 7.6, leather: 0x1f5a38, wood: 0x6a3d1f, open: 0.6 }); S.scene.add(ch.group);
    E.camPath(S, [{ t: 0, pos: [0, 12, 13.5], look: [0, 0, -2.5], fov: 44 }, { t: 6, pos: [0, 11, 12.5], look: [0, 0.3, -2.8], fov: 44 }], { shake: 0.015, shiftY: 280, focusOn: true });
    S.aperture = 0.1;
    const a = R((d.alp2022 / 100) * N), b = R((d.alpNow / 100) * N);
    S.update((lt) => { const k = ease.inOut(remap(lt, 0.8, 2.2)); const n = R(a - (a - b) * k); for (let i = 0; i < N; i++) ch.set(i, i < n ? 0xe53935 : 0xffe2b0, i < n ? 1.3 : 0.2); ch.commit(); });
    ui.kicker(S, { t0: 0.05, text: 'Labor\'s vote', y: 372 });
    ui.counter(S, { t0: 0.3, dur: 2.0, from: d.alp2022, to: d.alpNow, decimals: 1, suffix: '%', y: 400, size: 190, color: RED, label: `2022 election → latest ${d.nPolls}-poll average` });
    ui.block(S, { t0: 2.4, html: 'Seats lit = share of the vote. Illustrative.', cls: 'body', y: 640, align: 'center', size: 30 });
  });

  E.defineScene('ask', (S) => {
    desk(S, [['What if?', 'Victoria votes 28 November', 'Your call']], { at: () => 0.1, key: 110 });
    ui.kicker(S, { t0: 0.05, text: 'Your turn', y: 372 });
    ui.headline(S, { t0: 0.1, html: 'Saved Labor, or <em>made it worse?</em>', y: 410, size: 92, style: 'rise' });
    ui.block(S, { t0: 0.9, html: '<b style="color:#c8f04a">Comment</b> 👇 &nbsp;·&nbsp; <b>Follow</b> for more what-ifs', cls: 'body', y: 640, w: 920, size: 42 });
  });

  E.defineScene('end', (S) => endCard(S, { title: 'More <em>what ifs</em>', sub: 'poltok.netlify.app/au/victoria', sources: `Timeline: Wikipedia (2026 Victorian state election). Labor 2022: VEC first preferences. Now: average of the latest ${d.nPolls} polls.<br>Newspaper pages are illustrative; The PolTok Ledger is not a real paper.` }));
}
