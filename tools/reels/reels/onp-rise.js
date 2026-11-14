// Reel — "One Nation: the rise, the crash, the comeback." Dated facts only.
// 1997 founded by Pauline Hanson (with David Oldfield and David Ettridge). 1998 Queensland election: 22.7%, 11 of 89 seats.
// 1998 federal: 8.4% House vote, no House seats (Hanson lost Blair), 1 senator. 2001 Queensland: 3 seats, 8.69%.
// 2016 federal: 4 senators (4.3% Senate vote). 2025 federal: 6.4% House vote, 4 senators. 9 May 2026: first House seat
// (Farrer by-election, AEC). Now: live average of the latest 4 national polls (au-what-if.js). Sources: Wikipedia/SBS/AEC.

export async function data() {
  const { data: au } = await import('./au-what-if.js');
  const d = await au();
  return { now: d.avg.ONP, alp: d.avg.ALP, lnp: d.avg.LNP, nPolls: d.polls.length };
}

export const meta = {
  title: 'One Nation: rise, crash, comeback',
  label: 'ONE NATION · 1997–2026',
  out: 'poltok-one-nation-rise',
  cover: 1.4,
  music: { prog: ['Dm', 'Bb', 'F', 'C'], arp: 'up', seed: 347, swing: 0.03 },
};

const R = Math.round;
// House-of-Representatives national vote (%), plus today's poll average
const POINTS = (now) => [['1998', 8.4, 'Federal election'], ['2016', 1.3, 'Federal election'], ['2025', 6.4, 'Federal election'], ['NOW', now, 'Poll average']];

export const scenes = (d) => [
  { id: 'hook', beats: 6, energy: 3, voLead: 0.06, say: `Six percent at the last election. ${R(d.now)} percent now. How did One Nation get here?` },
  { id: 'born', beats: 10, energy: 2, trans: { type: 'zoom', dur: 0.45 },
    say: 'Nineteen ninety-seven. Pauline Hanson starts a new party. A year later, it wins eleven seats in Queensland, with twenty-three percent of the vote.',
    cap: '1997: Pauline Hanson founds One Nation. 1998 Queensland election: 22.7% and 11 seats.' },
  { id: 'crash', beats: 9, energy: 3, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: 'Then it falls apart. Hanson loses her place in Parliament, and by 2001, it\'s down to three seats in Queensland.',
    cap: '1998: Hanson loses her place in Parliament. 2001 Queensland: down to 3 seats.' },
  { id: 'back', beats: 9, energy: 3, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: 'In 2016, Hanson\'s back in the Senate, with three more senators. In 2025, six percent nationally.',
    cap: '2016: Hanson returns to the Senate with 3 more senators. 2025: 6.4% nationally, 4 senators.' },
  { id: 'farrer', beats: 9, energy: 3, trans: { type: 'flash', dur: 0.36 },
    say: 'May twenty twenty-six. Farrer, in New South Wales. One Nation wins its first ever lower house seat.',
    cap: '9 May 2026: Farrer by-election. One Nation\'s first ever House of Representatives seat.' },
  { id: 'now', beats: 10, energy: 3, trans: { type: 'whip', dir: 'up', dur: 0.42 },
    say: `And now? Around ${R(d.now)} percent. Neck and neck with Labor, and ahead of the Coalition.`,
    cap: `Now: One Nation ${d.now}% · Labor ${d.alp}% · Coalition ${d.lnp}% (latest ${d.nPolls} polls).` },
  { id: 'ask', beats: 8, energy: 2, trans: { type: 'zoom', dur: 0.45 },
    say: 'So, is this a moment, or a movement? Tell me in the comments.', cap: 'A moment or a movement? 👇' },
  { id: 'end', beats: 6, energy: 0, trans: { type: 'zoom', dur: 0.5 }, noProgress: true },
];

export function build({ E, kit, ui, THREE, endCard, real }) {
  const { C, ease, remap } = E;
  const d = E.data;
  const ORANGE = 0xd9480f, OCSS = '#ff9a4a';
  const pts = POINTS(d.now);

  // desk with four stacks of ballot papers: one paper per percentage point of the House vote
  const stacks = (S, upto, o = {}) => {
    real.room(S, { carpet: 0x2b2420, wood: 0x4e3320, width: 16, depth: 14, height: 7, key: o.key ?? 110, area: 2.4, fill: 0.28 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.16, 3.8), real.pbr(real.tex.wood(0x5c3a20), { repeat: [2, 1], clearcoat: 0.7, clearcoatRoughness: 0.2 }));
    top.position.set(0, 1.0, 0); top.receiveShadow = true; top.castShadow = true; S.scene.add(top);
    const sheet = () => real.sheet(0.5, 0.66, (c, w) => { c.fillStyle = 'rgba(30,30,30,.55)'; c.font = '600 60px "Inter Tight"'; c.fillText('BALLOT', 60, 120); c.fillStyle = '#d9480f'; c.fillRect(60, 160, w - 120, 22); });
    const gs = pts.map(([yr, v], i) => {
      const g = new THREE.Group(); const n = Math.max(1, Math.round(v));
      for (let j = 0; j < n; j++) { const s = sheet(); s.rotation.x = -Math.PI / 2; s.rotation.z = Math.sin(j * 7.1 + i) * 0.06; s.position.set(Math.sin(j * 3.3) * 0.015, j * 0.03, Math.cos(j * 2.1) * 0.015); g.add(s); }
      g.position.set((i - 1.5) * 0.46, 1.09, 0); g.userData.n = n; S.scene.add(g); return g;
    });
    E.camPath(S, o.cam ?? [{ t: 0, pos: [0, 2.9, 6.2], look: [0, 1.45, 0], fov: 36 }, { t: 6, pos: [0.15, 2.8, 5.8], look: [0, 1.45, 0], fov: 36 }], { shake: 0.012, shiftY: 200, focusOn: true });
    S.aperture = 0.35;
    return { gs, show(i, k) { gs.forEach((g, j) => { const vis = j < i ? g.userData.n : j === i ? Math.round(g.userData.n * k) : 0; g.children.forEach((c, m) => { c.visible = m < vis; }); }); } };
  };
  const tags = (S, upto, t0) => pts.slice(0, upto).forEach(([yr, v], i) => ui.tag3d(S, { at: new THREE.Vector3((i - 1.5) * 0.46, 1.12 + Math.max(1, Math.round(v)) * 0.03 + 0.15, 0.2), html: `${yr} · ${v}%`, cls: 'chip', t0: t0 + i * 0.2 }));
  const doc = (title, sub) => real.sheet(1.5, 2.0, (c, w) => {
    c.fillStyle = 'rgba(20,18,15,.9)'; c.font = '900 92px Newsreader'; c.textAlign = 'center'; c.fillText('The PolTok Ledger', w / 2, 120);
    c.fillRect(50, 150, w - 100, 6); c.textAlign = 'left'; c.font = '800 104px Newsreader';
    const words = title.split(' '); let line = '', y = 320;
    for (const wd of words) { const t = line ? line + ' ' + wd : wd; if (c.measureText(t).width > w - 110 && line) { c.fillText(line, 55, y); line = wd; y += 108; } else line = t; }
    c.fillText(line, 55, y); c.font = '500 40px Newsreader'; c.fillStyle = 'rgba(20,18,15,.7)'; c.fillText(sub, 55, y + 80);
    c.fillStyle = 'rgba(20,18,15,.18)'; for (let col = 0; col < 3; col++) for (let l = 0; l < 12; l++) c.fillRect(55 + col * ((w - 110) / 3), y + 140 + l * 44, (w - 110) / 3 - 30 - ((l * 7 + col) % 4) * 18, 14);
  });
  const desk = (S, pages, o = {}) => {
    real.room(S, { carpet: 0x2b2420, wood: 0x4e3320, width: 16, depth: 14, height: 7, key: o.key ?? 100, area: 2.4, fill: 0.28 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.16, 3.8), real.pbr(real.tex.wood(0x5c3a20), { repeat: [2, 1], clearcoat: 0.7, clearcoatRoughness: 0.2 }));
    top.position.set(0, 1.0, 0); top.receiveShadow = true; S.scene.add(top);
    const ms = pages.map(([h, s], i) => { const p = doc(h, s); p.rotation.x = -Math.PI / 2; p.rotation.z = (i - (pages.length - 1) / 2) * 0.1; p.position.set((i - (pages.length - 1) / 2) * 0.32, 1.09 + i * 0.012, (pages.length - 1 - i) * -0.18); S.scene.add(p); return p; });
    const at = (i) => 0.25 + i * 1.0;
    ms.forEach((_, i) => E.cue(S.t0 + at(i) + 0.35, 'pop', { i }));
    S.update((lt) => ms.forEach((p, i) => { const k = ease.expo(remap(lt, at(i), at(i) + 0.5)); p.position.y = 1.09 + i * 0.012 + (1 - k) * 2.6; p.visible = k > 0.01; }));
    E.camPath(S, [{ t: 0, pos: [0, 5.3, 3.3], look: [0, 1.1, -0.1], fov: 34 }, { t: 6, pos: [0.25, 4.9, 3.0], look: [0, 1.1, -0.1], fov: 34 }], { shake: 0.012, shiftY: 470, focusOn: true });
    S.aperture = 0.35;
  };

  E.defineScene('hook', (S) => {
    const st = stacks(S, 4, { cam: [{ t: 0, pos: [0.7, 1.9, 1.8], look: [0.69, 1.6, 0], fov: 36 }, { t: 4, pos: [0.15, 2.9, 6.2], look: [0, 1.45, 0], fov: 36 }] });
    E.cue(S.t0 + 0.3, 'boom', { g: 0.9 });
    S.update((lt) => st.show(4, 1));
    ui.kicker(S, { t0: 0, text: 'One Nation · 1997 to now', y: 372 });
    ui.headline(S, { t0: 0, html: `6% → <em style="color:${OCSS}">${R(d.now)}%</em>`, y: 410, size: 140, style: 'slam', stagger: 0.04, t1: S.dur + 1 });
  });

  E.defineScene('born', (S) => {
    desk(S, [['One Nation launched', 'Pauline Hanson starts a new party · 1997'], ['11 seats in Queensland', '22.7% of the vote · June 1998']]);
    ui.kicker(S, { t0: 0.05, text: '1997–1998 · the rise', y: 372 });
    ui.counter(S, { t0: 1.4, dur: 1.2, to: 22.7, decimals: 1, suffix: '%', y: 400, size: 160, color: OCSS, label: '1998 Queensland election · 11 of 89 seats' });
  });

  E.defineScene('crash', (S) => {
    desk(S, [['Hanson out of Parliament', 'Loses Blair at the 1998 federal election'], ['Down to three', '2001 Queensland election']], { key: 85 });
    ui.kicker(S, { t0: 0.05, text: '1998–2001 · the crash', y: 372 });
    ui.counter(S, { t0: 1.4, dur: 1.0, from: 11, to: 3, y: 400, size: 180, color: '#c3c9d4', label: 'Queensland seats, 1998 → 2001', ticks: false });
  });

  E.defineScene('back', (S) => {
    const st = stacks(S, 3);
    S.update((lt) => st.show(2, ease.expo(remap(lt, 0.4, 1.6))));
    tags(S, 3, 1.8);
    ui.kicker(S, { t0: 0.05, text: '2016–2025 · the comeback', y: 372 });
    ui.block(S, { t0: 0.3, html: '<b>2016:</b> Hanson back in the Senate, with <b>3 more</b> senators<br><b>2025:</b> <b style="color:#ff9a4a">6.4%</b> nationally · 4 senators', cls: 'body', y: 420, w: 920, size: 42 });
  });

  E.defineScene('farrer', (S) => {
    real.room(S, { carpet: 0x2f5a3a, wood: 0x6a4524, width: 32, depth: 28, height: 11, key: 300 });
    const N = 150; const ch = real.chamber(N, { rows: 6, r0: 3.6, r1: 8.6, leather: 0x1d5634, wood: 0x7a4a26, open: 0.6 }); S.scene.add(ch.group);
    const at = ch.pos[N - 1];
    E.camPath(S, [{ t: 0, pos: [0, 12.5, 14], look: [0, 0, -3], fov: 44 }, { t: 6, pos: [at.x * 0.5, at.y + 3, at.z + 6], look: [at.x, at.y, at.z], fov: 38 }], { shake: 0.015, shiftY: 300, focusOn: true });
    S.aperture = 0.2;
    E.cue(S.t0 + 1.2, 'ding', {});
    S.update((lt) => { for (let i = 0; i < N; i++) ch.set(i, i === N - 1 && lt > 1.2 ? ORANGE : 0xffe2b0, i === N - 1 && lt > 1.2 ? 1.6 + 0.8 * Math.abs(Math.sin(lt * 4)) : 0.25); ch.commit(); });
    ui.kicker(S, { t0: 0.05, text: '9 May 2026 · Farrer by-election', y: 372 });
    ui.headline(S, { t0: 0.1, html: 'First ever <em style="color:#ff9a4a">House seat</em>', y: 410, size: 96, style: 'rise' });
  });

  E.defineScene('now', (S) => {
    const st = stacks(S, 4, { key: 130 });
    E.cue(S.t0 + 1.0, 'boom', { g: 0.6 });
    S.update((lt) => st.show(3, ease.expo(remap(lt, 0.6, 2.4))));
    tags(S, 4, 2.6);
    ui.kicker(S, { t0: 0.05, text: `Now · latest ${d.nPolls} national polls`, y: 372 });
    ui.counter(S, { t0: 0.6, dur: 1.8, from: 6.4, to: d.now, decimals: 1, suffix: '%', y: 400, x: 80, w: 440, size: 130, color: OCSS, label: 'One Nation' });
    ui.block(S, { t0: 2.0, html: `Labor <b style="color:#ff6b6b">${d.alp}%</b><br>Coalition <b style="color:#6ea2ff">${d.lnp}%</b>`, cls: 'body', y: 420, x: 560, w: 440, size: 44, align: 'right' });
  });

  E.defineScene('ask', (S) => {
    const st = stacks(S, 4, { key: 120 });
    S.update(() => st.show(4, 1));
    ui.kicker(S, { t0: 0.05, text: 'Your turn', y: 372 });
    ui.headline(S, { t0: 0.1, html: 'A moment, or <em>a movement?</em>', y: 410, size: 100, style: 'rise' });
    ui.block(S, { t0: 0.9, html: '<b style="color:#c8f04a">Comment</b> 👇 &nbsp;·&nbsp; <b>Follow</b> for the polls every week', cls: 'body', y: 640, w: 920, size: 42 });
  });

  E.defineScene('end', (S) => endCard(S, { title: 'Polls, <em>live</em>', sub: 'poltok.netlify.app', sources: 'Results: AEC, ECQ (via Wikipedia/SBS). Stacks = House of Representatives national vote, one ballot per point (2016: 1.3%).<br>Now: average of the latest 4 national polls. Front pages are illustrative.' }));
}
