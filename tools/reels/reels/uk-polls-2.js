// Reel — UK polls PART 2: what happened between May and November 2026 that took Labour from last place to first.
// Poll numbers come LIVE from the same Wikipedia poll tables as uk-polls.js (PolTok monthly averages, GB polls).
// Events are fixed, dated facts (sources: BBC News via Wikipedia "2026 in United Kingdom politics and government";
// "Burnham bounce" coverage in HuffPost UK / Washington Post / US News, late July–Aug 2026). No causal claims beyond
// what those reports say: the reel lists what happened alongside the polls.

export async function data() {
  const { data: polls } = await import('./uk-polls.js');
  const d = await polls();
  const m = (y, mo) => d.months.find((x) => x.y === y && x.m === mo);
  const may = m(2026, 5), aug = m(2026, 8), mar = m(2026, 3);
  if (!may || !aug) throw new Error('missing May/Aug 2026 monthly averages');
  return { now: d.now, nRecent: d.nRecent, latestLabel: d.latestLabel, may, aug, mar, refBelowCon: d.refBelowCon };
}

export const meta = {
  title: 'UK polls part 2: how Reform lost the lead',
  label: 'PART 2 · EXPLAINED',
  out: 'poltok-uk-polls-part2',
  cover: 1.6,
  music: { prog: ['Gm', 'Eb', 'Bb', 'F'], arp: 'updown', seed: 22, swing: 0.04 },
};

const R = Math.round;

export const scenes = (d) => [
  { id: 'hook', beats: 8, energy: 3, voLead: 0.08,
    say: 'Reform led the polls for sixteen months. Here\'s how they lost it.' },
  { id: 'may', beats: 10, energy: 2, trans: { type: 'fade', dur: 0.45 },
    say: `May. Reform win big at the local elections, and Labour MPs turn on [Keir Starmer](/kˈɪɹ stˈɑːɹmɚ/).`,
    cap: `May: Reform win big in the local elections. Labour ${d.may.Lab}%.` },
  { id: 'burnham', beats: 12, energy: 3, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: 'June. Andy [Burnham](/bˈɜːnəm/) wins a by-election. [Starmer](/stˈɑːɹmɚ/) quits. And by July, [Burnham](/bˈɜːnəm/)\'s prime minister.',
    cap: 'June: Burnham wins Makerfield. Starmer quits. 20 July: Burnham becomes PM.' },
  { id: 'bounce', beats: 10, energy: 3, trans: { type: 'flash', dur: 0.36 },
    say: `Then came the [Burnham](/bˈɜːnəm/) bounce. By August, Labour's ahead.`,
    cap: `The "Burnham bounce": Labour ${d.aug.Lab}% by August, ahead of Reform.` },
  { id: 'reform', beats: 12, energy: 2, trans: { type: 'whip', dir: 'up', dur: 0.42 },
    say: 'And Reform? Questions over a five million pound gift to [Farage](/fˈæɹɑːʒ/). A Channel 4 undercover report. A police probe into donations. And Restore Britain splitting the right.',
    cap: 'Reform: questions over a £5m gift to Farage, a Channel 4 undercover report, a police probe into donations, and the Restore Britain split.' },
  { id: 'now', beats: 10, energy: 3, trans: { type: 'flash', dur: 0.36 },
    say: `Now? Labour ${R(d.now.Lab)}. The Tories ${R(d.now.Con)}. Reform ${R(d.now.Ref)}${d.refBelowCon ? ', in third' : ''}.`,
    cap: `Now: Labour ${d.now.Lab}% · Conservatives ${d.now.Con}% · Reform ${d.now.Ref}%` },
  { id: 'ask', beats: 8, energy: 2, trans: { type: 'zoom', dur: 0.45 },
    say: 'So, can Reform come back? Tell me in the comments.', cap: 'Can Reform come back? 👇' },
  { id: 'end', beats: 6, energy: 0, trans: { type: 'zoom', dur: 0.5 }, noProgress: true },
];

export function build({ E, kit, ui, THREE, endCard, real }) {
  const { C, ease, remap } = E;
  const d = E.data;
  const CSS = { Lab: '#ff4d6d', Con: '#3fa9ff', Ref: '#2fd3e6', Grn: '#3ed17a' };

  // a fictional broadsheet front page (own masthead, no real outlet) with a wrapped headline
  const paper = (head, sub, date) => real.sheet(1.5, 2.0, (c, w, h) => {
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

  // a desk with front pages dropping onto it one after another
  const deskScene = (S, pages, o = {}) => {
    real.room(S, { carpet: 0x23283a, wood: 0x4e3320, width: 16, depth: 14, height: 7, key: o.key ?? 100, area: 2.4, fill: 0.28 });
    const desk = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.16, 3.8), real.pbr(real.tex.wood(0x5c3a20), { repeat: [2, 1], clearcoat: 0.7, clearcoatRoughness: 0.2 }));
    desk.position.set(0, 1.0, 0); desk.receiveShadow = true; desk.castShadow = true; S.scene.add(desk);
    const meshes = pages.map(([h, s, dt], i) => {
      const p = paper(h, s, dt);
      p.rotation.x = -Math.PI / 2; p.rotation.z = (i - (pages.length - 1) / 2) * 0.1 + Math.sin(i * 2.3) * 0.04;
      p.position.set((i - (pages.length - 1) / 2) * 0.32, 1.09 + i * 0.012, (pages.length - 1 - i) * -0.18);
      S.scene.add(p); return p;
    });
    const at = o.at ?? ((i) => 0.25 + i * 0.7);
    meshes.forEach((_, i) => E.cue(S.t0 + at(i) + 0.35, 'pop', { i }));
    S.update((lt) => meshes.forEach((p, i) => { const k = ease.expo(remap(lt, at(i), at(i) + 0.5)); p.position.y = 1.09 + i * 0.012 + (1 - k) * 2.6; p.visible = k > 0.01; }));
    E.camPath(S, [{ t: 0, pos: [0, 5.3, 3.3], look: [0, 1.1, -0.1], fov: 34 }, { t: S.dur, pos: [0.25, 4.9, 3.0], look: [0, 1.1, -0.1], fov: 34 }], { shake: 0.012, shiftY: 470, focusOn: true });
    S.aperture = 0.35;
    return meshes;
  };

  E.defineScene('hook', (S) => {
    deskScene(S, [['Reform lead slips', 'Pollsters record a summer swing', 'Summer 2026'], ['Labour back in front', 'First lead in sixteen months', 'August 2026']], { at: (i) => 0.05 + i * 0.5 });
    E.cue(S.t0 + 0.3, 'boom', { g: 0.7 });
    ui.kicker(S, { t0: 0, text: 'UK polls · part 2', y: 372 });
    ui.headline(S, { t0: 0, html: 'How Reform <em>lost the lead</em>', y: 410, size: 96, style: 'slam', stagger: 0.04, t1: S.dur + 1 });
    ui.block(S, { t0: 0.35, html: '6 months that flipped UK politics, explained', cls: 'body', y: 600, w: 920, size: 44, t1: S.dur + 1 });
  });

  E.defineScene('may', (S) => {
    deskScene(S, [['Reform sweep local elections', 'Big gains from Labour and the Tories', '8 May 2026'], ['Labour MPs turn on Starmer', 'Leadership pressure grows', 'May 2026']]);
    ui.kicker(S, { t0: 0.05, text: 'May 2026', y: 372 });
    ui.headline(S, { t0: 0.1, html: 'Reform\'s <em>big night</em>', y: 410, size: 104, style: 'rise' });
    ui.counter(S, { t0: 0.8, dur: 1.0, to: d.may.Lab, decimals: 1, suffix: '%', y: 560, x: 80, w: 440, size: 120, color: CSS.Lab, label: 'Labour · May average' });
    ui.counter(S, { t0: 1.0, dur: 1.0, to: d.may.Ref, decimals: 1, suffix: '%', y: 560, x: 540, w: 460, size: 120, align: 'right', color: CSS.Ref, label: 'Reform', ticks: false });
  });

  E.defineScene('burnham', (S) => {
    deskScene(S, [['Burnham wins Makerfield', 'By-election majority of 9,231', '19 June 2026'], ['Starmer to step down', 'Labour leadership contest begins', '22 June 2026'], ['Burnham becomes PM', 'Elected Labour leader unopposed', '20 July 2026']], { at: (i) => 0.3 + i * 1.2 });
    ui.kicker(S, { t0: 0.05, text: 'June – July 2026', y: 372 });
    ui.list(S, { t0: 0.35, stagger: 1.2, y: 420, size: 46, mark: '●', markColor: CSS.Lab, items: [
      '<b>19 Jun</b> · Burnham wins Makerfield',
      '<b>22 Jun</b> · Starmer says he\'ll quit',
      '<b>20 Jul</b> · Burnham becomes <b style="color:#c8f04a">PM</b>',
    ] });
  });

  E.defineScene('bounce', (S) => {
    real.room(S, { carpet: 0x23283a, wood: 0x4e3320, width: 30, depth: 26, height: 10, key: 240 });
    const N = 100; const ch = real.chamber(N, { rows: 5, r0: 3.4, r1: 7.6, leather: 0x2a2f45, wood: 0x5c3a20, open: 0.6 });
    S.scene.add(ch.group);
    const lab = R(d.aug.Lab), ref = R(d.aug.Ref);
    E.camPath(S, [{ t: 0, pos: [0, 13, 14.5], look: [0, 0, -2.5], fov: 44 }, { t: S.dur, pos: [0, 12, 13.5], look: [0, 0.3, -2.8], fov: 44 }], { shake: 0.015, shiftY: 260, focusOn: true });
    S.aperture = 0.1;
    // seats as poll share: May split, sweeping to the August split
    const split = (L, Rf) => Array.from({ length: N }, (_, i) => (i < L ? 0xe4003b : i >= N - Rf ? 0x12b6cf : 0xffe2b0));
    const A = split(R(d.may.Lab), R(d.may.Ref)), B = split(lab, ref);
    S.update((lt) => { const k = ease.inOut(remap(lt, 0.6, 2.2)); for (let i = 0; i < N; i++) { const c = (i / N) < k ? B[i] : A[i]; ch.set(i, c, c === 0xffe2b0 ? 0.25 : 1.2); } ch.commit(); });
    ui.kicker(S, { t0: 0.05, text: 'The Burnham bounce', y: 372 });
    ui.counter(S, { t0: 0.6, dur: 1.6, from: d.may.Lab, to: d.aug.Lab, decimals: 1, suffix: '%', y: 410, x: 80, w: 440, size: 150, color: CSS.Lab, label: 'Labour · May → Aug' });
    ui.counter(S, { t0: 0.6, dur: 1.6, from: d.may.Ref, to: d.aug.Ref, decimals: 1, suffix: '%', y: 410, x: 540, w: 460, size: 150, align: 'right', color: CSS.Ref, label: 'Reform', ticks: false });
    ui.block(S, { t0: 2.4, html: 'Seats show poll share out of 100. Illustrative.', cls: 'body', y: 640, align: 'center', size: 30 });
  });

  E.defineScene('reform', (S) => {
    deskScene(S, [['Questions over £5m gift', 'Farage says he had no duty to declare it', 'April 2026'], ['Undercover report airs', 'Channel 4 News investigation', 'September 2026'], ['Police probe donations', 'Met launches investigation', 'September 2026'], ['Restore Britain splits right', 'Rupert Lowe\'s new party', 'February 2026']], { at: (i) => 0.3 + i * 1.0 });
    ui.kicker(S, { t0: 0.05, text: 'Meanwhile, at Reform', y: 372 });
    ui.list(S, { t0: 0.35, stagger: 1.0, y: 420, size: 42, mark: '●', markColor: CSS.Ref, items: [
      'Questions over a <b>£5m gift</b> to Farage',
      'A <b>Channel 4</b> undercover report',
      'A <b>police probe</b> into donations',
      '<b>Restore Britain</b> splits the right',
    ] });
  });

  E.defineScene('now', (S) => {
    real.room(S, { carpet: 0x23283a, wood: 0x4e3320, width: 30, depth: 26, height: 10, key: 260 });
    const N = 100; const ch = real.chamber(N, { rows: 5, r0: 3.4, r1: 7.6, leather: 0x2a2f45, wood: 0x5c3a20, open: 0.6 });
    S.scene.add(ch.group);
    const L = R(d.now.Lab), Cn = R(d.now.Con), Rf = R(d.now.Ref);
    const cols = Array.from({ length: N }, (_, i) => (i < L ? 0xe4003b : i < L + Cn ? 0x0087dc : i < L + Cn + Rf ? 0x12b6cf : 0xffe2b0));
    E.camPath(S, [{ t: 0, pos: [-3, 2.4, 6.2], look: [0, 1, -5], fov: 36 }, { t: S.dur, pos: [2, 3.6, 9.5], look: [0, 0.8, -4], fov: 36 }], { shake: 0.02, focusOn: true });
    S.aperture = 0.3;
    S.update((lt) => { for (let i = 0; i < N; i++) ch.set(i, cols[i], (cols[i] === 0xffe2b0 ? 0.25 : 1.2) * ease.back(remap(lt, 0.2 + (i / N) * 1.2, 0.5 + (i / N) * 1.2))); ch.commit(); });
    ui.kicker(S, { t0: 0.05, text: `Now · last ${d.nRecent} polls`, y: 372 });
    const rows = ['Lab', 'Con', 'Ref'].sort((a, b) => d.now[b] - d.now[a]);
    const NAMES = { Lab: 'Labour', Con: 'Conservatives', Ref: 'Reform UK' };
    rows.forEach((k, i) => ui.counter(S, { t0: 0.3 + i * 0.35, dur: 1.0, to: d.now[k], decimals: 1, suffix: '%', y: 400 + i * 125, x: 80, w: 920, size: 80, color: CSS[k], label: `${i + 1}. ${NAMES[k]}`, ticks: i === 0 }));
  });

  E.defineScene('ask', (S) => {
    deskScene(S, [['Can Reform come back?', 'Next general election due by 2029', 'Your call']], { at: () => 0.1, key: 110 });
    ui.kicker(S, { t0: 0.05, text: 'Your turn', y: 372 });
    ui.headline(S, { t0: 0.1, html: 'Can Reform <em>come back?</em>', y: 410, size: 104, style: 'rise' });
    ui.block(S, { t0: 0.9, html: '<b style="color:#c8f04a">Comment</b> 👇 &nbsp;·&nbsp; <b>Follow</b> for part 3', cls: 'body', y: 600, w: 920, size: 44 });
  });

  E.defineScene('end', (S) => endCard(S, { title: 'Polls, <em>live</em>', sub: 'poltok.netlify.app', sources: `Polls: PolTok averages of GB polls on Wikipedia, to ${d.latestLabel}. Events: BBC News.<br>Newspaper pages are illustrative; The PolTok Ledger is not a real paper.` }));
}
