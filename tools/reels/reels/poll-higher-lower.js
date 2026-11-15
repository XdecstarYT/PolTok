// Reel (viral, interactive) — "Who's polling higher?" Five live match-ups; viewers guess, then the answer is revealed.
// All numbers live: average of the latest 4 Victorian polls (vic-what-if.js) and latest 4 national polls (au-what-if.js),
// plus One Nation's 2025 federal election vote (au-what-if.js, onp2025). Answers are computed at render time.

export async function data() {
  const { data: vic } = await import('./vic-what-if.js');
  const { data: au } = await import('./au-what-if.js');
  const [v, a] = await Promise.all([vic(), au()]);
  return { vic: v.avg, au: a.avg, onp2025: a.onp2025, days: v.days };
}

export const meta = {
  title: 'Who\'s polling higher?',
  label: 'HIGHER OR LOWER',
  out: 'poltok-higher-or-lower',
  cover: 1.4,
  music: { prog: ['Em', 'C', 'G', 'D'], arp: 'updown', seed: 383, swing: 0.05 },
};

const NAME = { ALP: 'Labor', LNP: 'the Coalition', ONP: 'One Nation', GRN: 'the Greens', ONP25: 'One Nation in 2025' };
const SHORT = { ALP: 'Labor', LNP: 'Coalition', ONP: 'One Nation', GRN: 'Greens', ONP25: 'ONP · 2025 election' };
const cap1 = (s) => s[0].toUpperCase() + s.slice(1);

export const rounds = (d) => [
  { where: 'Victoria', a: ['ONP', d.vic.ONP], b: ['ALP', d.vic.ALP] },
  { where: 'Australia', a: ['ONP', d.au.ONP], b: ['LNP', d.au.LNP] },
  { where: 'Australia', a: ['ONP', d.au.ONP], b: ['ALP', d.au.ALP] },
  { where: 'Victoria', a: ['ALP', d.vic.ALP], b: ['LNP', d.vic.LNP] },
  { where: 'One Nation, then and now', a: ['ONP', d.au.ONP], b: ['ONP25', d.onp2025], then: true },
];
// say both numbers; use one decimal when they'd round to the same whole number
const nums = (x, y) => (Math.round(x) === Math.round(y) ? [x.toFixed(1), y.toFixed(1)] : [Math.round(x), Math.round(y)]);

export const scenes = (d) => [
  { id: 'hook', beats: 6, energy: 3, voLead: 0.06, say: 'Five polling match-ups. Guess who\'s higher, and keep score.', cap: '5 match-ups. Guess who\'s higher 👀' },
  ...rounds(d).flatMap((r, i) => {
    const [ka, va] = r.a, [kb, vb] = r.b; const [na, nb] = nums(va, vb);
    const win = va >= vb ? ka : kb; const [w, l] = va >= vb ? [na, nb] : [nb, na];
    const q = r.then ? 'One Nation now, or One Nation at the last federal election. Which is higher?'
      : `${r.where}. ${cap1(NAME[ka])}, or ${NAME[kb]}. Who's polling higher?`;
    const ans = r.then ? `Now. ${na} percent, up from ${nb} at the twenty twenty-five election.`
      : `${cap1(NAME[win])}. ${w} to ${l}.`;
    return [
      { id: 'q' + i, beats: 7, energy: i % 2 ? 2 : 3, trans: { type: i % 2 ? 'whip' : 'flash', dir: 'left', dur: 0.36 }, say: q,
        cap: `${i + 1}/5 · ${r.where}: ${SHORT[ka]} or ${SHORT[kb]}?` },
      { id: 'a' + i, beats: 5, energy: 3, trans: { type: 'flash', dur: 0.3 }, say: ans,
        cap: `${SHORT[ka]} ${va}% · ${SHORT[kb]} ${vb}%` },
    ];
  }),
  { id: 'ask', beats: 8, energy: 2, trans: { type: 'zoom', dur: 0.45 },
    say: 'How many did you get right? Comment your score out of five.', cap: 'Comment your score /5 👇' },
  { id: 'end', beats: 6, energy: 0, trans: { type: 'zoom', dur: 0.5 }, noProgress: true },
];

export function build({ E, kit, ui, THREE, endCard, real }) {
  const { ease, remap, lerp } = E;
  const d = E.data;
  const COL = { ALP: 0xe53935, LNP: 0x1f5fd1, ONP: 0xd9480f, GRN: 0x2fa84f, ONP25: 0x9a5a36 };
  const CSS = { ALP: '#ff6b6b', LNP: '#6ea2ff', ONP: '#ff9a4a', GRN: '#5fd17f', ONP25: '#d0a07a' };
  const RS = rounds(d);

  // two ballot stacks on a desk, one sheet per percentage point
  const stacks = (S, ka, kb, o = {}) => {
    real.room(S, { carpet: 0x2b2420, wood: 0x4e3320, width: 16, depth: 14, height: 7, key: (o.key ?? 110) * 0.22, area: 2.4, fill: 0.16 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(6, 0.16, 3.4), real.pbr(real.tex.wood(0x5c3a20), { repeat: [2, 1], clearcoat: 0.7, clearcoatRoughness: 0.2 }));
    top.position.set(0, 1.0, 0); top.receiveShadow = true; top.castShadow = true; S.scene.add(top);
    const mk = (x, col) => {
      const g = new THREE.Group();
      for (let j = 0; j < 36; j++) { const s = real.sheet(0.6, 0.8, (c, w) => { c.fillStyle = '#cdbf9f'; c.fillRect(0, 0, w, 2000); c.fillStyle = 'rgba(30,30,30,.55)'; c.font = '600 60px "Inter Tight"'; c.fillText('BALLOT', 60, 120); c.fillStyle = '#' + new THREE.Color(col).getHexString(); c.fillRect(60, 160, w - 120, 22); }); s.rotation.x = -Math.PI / 2; s.rotation.z = Math.sin(j * 7.1) * 0.05; s.position.set(Math.sin(j * 3.3) * 0.015, j * 0.03, Math.cos(j * 2.1) * 0.015); g.add(s); }
      g.position.set(x, 1.09, 0); S.scene.add(g); return g;
    };
    const A = mk(-0.5, COL[ka]), B = mk(0.5, COL[kb]);
    E.camPath(S, o.cam ?? [{ t: 0, pos: [0, 2.9, 5.4], look: [0, 1.4, 0], fov: 36 }, { t: 6, pos: [0.2, 2.8, 5.0], look: [0, 1.4, 0], fov: 36 }], { shake: 0.012, shiftY: 260, focusOn: true });
    S.aperture = 0.35;
    const set = (g, v) => { const n = Math.round(v); g.children.forEach((c, i) => { c.visible = i < n; }); };
    return { set: (a, b) => { set(A, a); set(B, b); } };
  };
  const SH = { ALP: 'Labor', LNP: 'Coalition', ONP: 'One Nation', GRN: 'Greens', ONP25: 'One Nation<br><small>2025 election</small>' };

  E.defineScene('hook', (S) => {
    const st = stacks(S, 'ONP', 'ALP', { cam: [{ t: 0, pos: [0, 1.9, 2.6], look: [0, 1.5, 0], fov: 36 }, { t: 4, pos: [0.2, 2.7, 4.6], look: [0, 1.4, 0], fov: 36 }] });
    E.cue(S.t0 + 0.3, 'boom', { g: 0.9 });
    S.update((lt) => { const k = (Math.sin(lt * 3) + 1) / 2; st.set(lerp(12, 30, k), lerp(30, 12, k)); });
    ui.kicker(S, { t0: 0, text: 'Live polls · keep score', y: 372 });
    ui.headline(S, { t0: 0, html: 'Higher or <em>lower?</em>', y: 410, size: 120, style: 'slam', stagger: 0.04, t1: S.dur + 1 });
  });

  RS.forEach((r, i) => {
    const [ka, va] = r.a, [kb, vb] = r.b;
    E.defineScene('q' + i, (S) => {
      const st = stacks(S, ka, kb, { key: 100 + i * 10 });
      [2.4, 3.2, 4.0].forEach((t) => E.cue(S.t0 + t, 'tick', { k: 0.5 }));
      S.update((lt) => { const k = (Math.sin(lt * 4) + 1) / 2; st.set(lerp(14, 24, k), lerp(24, 14, k)); });
      ui.kicker(S, { t0: 0.02, text: `Round ${i + 1} of 5 · ${r.where}`, y: 372 });
      ui.headline(S, { t0: 0.08, html: `<span style="color:${CSS[ka]}">${SH[ka]}</span> or <span style="color:${CSS[kb]}">${SH[kb]}</span>?`, y: 410, size: 82, style: 'rise' });
      ui.block(S, { t0: 2.2, html: '⏸ Who\'s higher?', cls: 'body', y: 640, align: 'center', size: 40 });
    });
    E.defineScene('a' + i, (S) => {
      const st = stacks(S, ka, kb, { key: 140 });
      E.cue(S.t0 + 0.15, 'ding');
      S.update((lt) => { const k = ease.expo(remap(lt, 0.1, 1.0)); st.set(va * k, vb * k); });
      ui.kicker(S, { t0: 0.02, text: `Round ${i + 1} · answer`, y: 372 });
      ui.counter(S, { t0: 0.1, dur: 0.9, to: va, decimals: 1, suffix: '%', y: 400, x: 80, w: 440, size: 120, color: CSS[ka], label: SH[ka].replace(/<br>.*/, '') + (va >= vb ? ' ✓' : '') });
      ui.counter(S, { t0: 0.1, dur: 0.9, to: vb, decimals: 1, suffix: '%', y: 400, x: 540, w: 460, size: 120, align: 'right', color: CSS[kb], label: (r.then ? '2025 election' : SH[kb]) + (vb > va ? ' ✓' : ''), ticks: false });
    });
  });

  E.defineScene('ask', (S) => {
    const st = stacks(S, 'ONP', 'LNP', { key: 120 });
    S.update((lt) => { const k = (Math.sin(lt * 1.6) + 1) / 2; st.set(lerp(d.au.ONP, d.au.LNP, k), lerp(d.au.LNP, d.au.ONP, k)); });
    ui.kicker(S, { t0: 0.05, text: 'Final score', y: 372 });
    ui.headline(S, { t0: 0.1, html: 'How many did <em>you get?</em>', y: 410, size: 100, style: 'rise' });
    ui.block(S, { t0: 0.9, html: '<b>Comment your score</b> out of 5 👇', cls: 'body', y: 660, w: 920, size: 46 });
  });

  E.defineScene('end', (S) => endCard(S, { title: 'Polls, <em>live</em>', sub: 'poltok.netlify.app', sources: 'Averages of the latest 4 Victorian and latest 4 national primary-vote polls (Wikipedia), at render time. 2025: AEC first preferences.<br>Stacks: one ballot per percentage point.' }));
}
