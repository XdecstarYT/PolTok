// Reel — "Who's actually voting One Nation?" From Crikey, 11 Nov 2026 ("'I didn't change. Labor did'"): Utting Research survey
// of 1,014 One Nation voters — 70% voted for another party or didn't vote at the 2025 federal election; voter quotes from
// interviews (shown anonymously, by former vote and place, as the article describes them); Scanlon Foundation trust in the
// federal government 56% (Nov 2020) → 37% (Jul 2025); Coalition voters' trust 72% (2021) → 29% (2025). The article's own
// caveat is kept: interviews aren't a representative sample, and several weren't sure One Nation could govern.
// Today's poll: live national average (au-what-if.js).

export async function data() {
  const { data: au } = await import('./au-what-if.js');
  const d = await au();
  return { now: d.avg.ONP, nPolls: d.polls.length };
}

export const meta = {
  title: 'Who is voting One Nation?',
  label: 'ONE NATION · WHO & WHY',
  out: 'poltok-who-votes-one-nation',
  cover: 1.4,
  music: { prog: ['Am', 'F', 'C', 'G'], arp: 'up', seed: 353, swing: 0.04 },
};

const R = Math.round;

export const scenes = (d) => [
  { id: 'hook', beats: 6, energy: 3, voLead: 0.06, say: `One Nation's polling ${R(d.now)} percent. So who's actually voting for them?` },
  { id: 'switch', beats: 10, energy: 3, trans: { type: 'zoom', dur: 0.45 },
    say: 'In one survey of over a thousand One Nation voters, seventy percent backed another party at the last election, or didn\'t vote at all.',
    cap: 'Utting Research, 1,014 One Nation voters: 70% voted for another party in 2025, or didn\'t vote.' },
  { id: 'q1', beats: 8, energy: 2, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: 'A former Labor voter from Bondi put it like this. I didn\'t change. Labor did.',
    cap: '"I didn\'t change. Labor did." A former Labor voter, Bondi.' },
  { id: 'q2', beats: 8, energy: 2, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: 'A retired pilot said: a lot of people think, well, what have we got to lose?',
    cap: '"A lot of people think: well, what have we got to lose?" A former Labor voter.' },
  { id: 'trust', beats: 11, energy: 3, trans: { type: 'flash', dur: 0.36 },
    say: 'Behind it? Trust. In twenty twenty, fifty-six percent trusted the federal government. By last year, thirty-seven.',
    cap: 'Scanlon Foundation: trust in the federal government 56% (2020) → 37% (2025).' },
  { id: 'coal', beats: 9, energy: 3, trans: { type: 'whip', dir: 'up', dur: 0.42 },
    say: 'Among Coalition voters, it crashed from seventy-two percent to twenty-nine.',
    cap: 'Coalition voters\' trust: 72% (2021) → 29% (2025).' },
  { id: 'doubt', beats: 9, energy: 2, trans: { type: 'fade', dur: 0.45 },
    say: 'But even some of these voters told Crikey they weren\'t sure One Nation could actually govern.',
    cap: 'Even so, several said they weren\'t sure One Nation could govern.' },
  { id: 'ask', beats: 8, energy: 2, trans: { type: 'zoom', dur: 0.45 },
    say: 'So, have you switched? Tell me why in the comments.', cap: 'Have you switched? Tell me why 👇' },
  { id: 'end', beats: 6, energy: 0, trans: { type: 'zoom', dur: 0.5 }, noProgress: true },
];

export function build({ E, kit, ui, THREE, endCard, real }) {
  const { C, ease, remap } = E;
  const d = E.data;
  const ORANGE = 0xd9480f, OCSS = '#ff9a4a';

  // 100 figures: each 1% of One Nation voters (switchers lit orange)
  const crowd = (S, o = {}) => {
    real.room(S, { carpet: 0x2a2d3a, wood: 0x4e3320, width: 20, depth: 18, height: 8, key: o.key ?? 160, area: 3, fill: 0.3 });
    const geo = kit.pawnGeometry(0.42);
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45 }), 100); mesh.castShadow = true; mesh.receiveShadow = true;
    const m4 = new THREE.Matrix4(), col = new THREE.Color();
    for (let i = 0; i < 100; i++) { m4.makeTranslation(((i % 10) - 4.5) * 0.62 + Math.sin(i * 3.7) * 0.06, 0, (Math.floor(i / 10) - 4.5) * 0.62 + Math.cos(i * 2.1) * 0.06); mesh.setMatrixAt(i, m4); mesh.setColorAt(i, col.set(0x3a3f4c)); }
    S.scene.add(mesh);
    const ord = Array.from({ length: 100 }, (_, i) => i).sort((a, b) => Math.sin(a * 91.7) - Math.sin(b * 91.7));
    const rank = new Array(100); ord.forEach((s, j) => { rank[s] = j; });
    return { show(n, color = ORANGE, rest = 0x8a8f99) { for (let i = 0; i < 100; i++) mesh.setColorAt(i, col.set(rank[i] < n ? color : rest).multiplyScalar(rank[i] < n ? 0.9 : 0.55)); mesh.instanceColor.needsUpdate = true; } };
  };
  const CAM = [{ t: 0, pos: [0, 7.5, 8.5], look: [0, 0.2, 0], fov: 40 }, { t: 6, pos: [0.6, 6.8, 7.6], look: [0, 0.2, 0], fov: 40 }];
  // a quote card on a desk
  const quote = (S, q, who, o = {}) => {
    real.room(S, { carpet: 0x2b2420, wood: 0x4e3320, width: 16, depth: 14, height: 7, key: o.key ?? 100, area: 2.4, fill: 0.28 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.16, 3.8), real.pbr(real.tex.wood(0x5c3a20), { repeat: [2, 1], clearcoat: 0.7, clearcoatRoughness: 0.2 }));
    top.position.set(0, 1.0, 0); top.receiveShadow = true; S.scene.add(top);
    const p = real.sheet(1.5, 1.1, (c, w, h) => {
      c.fillStyle = 'rgba(217,72,15,.9)'; c.font = '900 200px Newsreader'; c.fillText('“', 60, 210);
      c.fillStyle = 'rgba(20,18,15,.88)'; c.font = 'italic 700 70px Newsreader'; const words = q.split(' '); let line = '', y = 280;
      for (const wd of words) { const t = line ? line + ' ' + wd : wd; if (c.measureText(t).width > w - 140 && line) { c.fillText(line, 70, y); line = wd; y += 84; } else line = t; }
      c.fillText(line, 70, y); c.font = '600 36px "Inter Tight"'; c.fillStyle = 'rgba(20,18,15,.6)'; c.fillText('— ' + who, 70, y + 80);
    });
    p.rotation.x = -Math.PI / 2; p.position.set(0, 1.09, 0); S.scene.add(p);
    S.update((lt) => { const k = ease.expo(remap(lt, 0.1, 0.6)); p.position.y = 1.09 + (1 - k) * 2.4; p.visible = k > 0.01; });
    E.cue(S.t0 + 0.45, 'pop', { i: 0 });
    E.camPath(S, [{ t: 0, pos: [0, 6.2, 3.7], look: [0, 1.1, -0.05], fov: 34 }, { t: 6, pos: [0.1, 5.9, 3.5], look: [0, 1.1, -0.05], fov: 34 }], { shake: 0.012, shiftY: 360, focusOn: true });
    S.aperture = 0.4;
  };
  // a bar card for trust figures
  const bars = (S, title, a, b, la, lb, o = {}) => {
    real.room(S, { carpet: 0x2b2420, wood: 0x4e3320, width: 16, depth: 14, height: 7, key: o.key ?? 110, area: 2.4, fill: 0.28 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.16, 3.8), real.pbr(real.tex.wood(0x5c3a20), { repeat: [2, 1], clearcoat: 0.7, clearcoatRoughness: 0.2 }));
    top.position.set(0, 1.0, 0); top.receiveShadow = true; S.scene.add(top);
    const p = real.sheet(1.5, 1.2, (c, w) => {
      c.fillStyle = 'rgba(20,18,15,.85)'; c.font = '700 40px "Inter Tight"'; c.fillText(title, 70, 100);
      const bar = (lab, v, yy, col) => { c.fillStyle = 'rgba(20,18,15,.8)'; c.font = '700 48px "Inter Tight"'; c.fillText(lab, 70, yy); c.fillStyle = col; c.fillRect(70, yy + 20, (w - 140) * v / 100, 110); c.fillStyle = 'rgba(20,18,15,.9)'; c.font = '800 90px Newsreader'; c.fillText(v + '%', 90 + (w - 140) * v / 100 + 10 > w - 220 ? w - 260 : 90 + (w - 140) * v / 100 + 10, yy + 105); };
      bar(la, a, 220, 'rgba(40,120,200,.85)'); bar(lb, b, 520, 'rgba(217,72,15,.85)');
    });
    p.rotation.x = -Math.PI / 2; p.position.set(0, 1.09, 0); S.scene.add(p);
    S.update((lt) => { const k = ease.expo(remap(lt, 0.1, 0.6)); p.position.y = 1.09 + (1 - k) * 2.4; p.visible = k > 0.01; });
    E.camPath(S, [{ t: 0, pos: [0, 6.2, 3.7], look: [0, 1.1, -0.05], fov: 34 }, { t: 6, pos: [0.1, 5.9, 3.5], look: [0, 1.1, -0.05], fov: 34 }], { shake: 0.012, shiftY: 360, focusOn: true });
    S.aperture = 0.4;
  };

  E.defineScene('hook', (S) => {
    const cw = crowd(S);
    E.camPath(S, [{ t: 0, pos: [0, 1.4, 5.5], look: [0, 0.6, 0], fov: 38 }, { t: S.dur + 0.4, pos: [0, 5.0, 8.0], look: [0, 0.3, 0], fov: 38 }], { shake: 0.02, shiftY: 260, focusOn: true });
    S.aperture = 0.45;
    E.cue(S.t0 + 0.2, 'boom', { g: 0.9 });
    S.update((lt) => cw.show(Math.round(d.now * ease.out(remap(lt, 0.1, 1.4)))));
    ui.kicker(S, { t0: 0, text: 'One Nation · who & why', y: 372 });
    ui.headline(S, { t0: 0, html: `Who's voting <em style="color:${OCSS}">One Nation?</em>`, y: 410, size: 96, style: 'slam', stagger: 0.04, t1: S.dur + 1 });
  });

  E.defineScene('switch', (S) => {
    const cw = crowd(S);
    E.camPath(S, CAM, { shake: 0.015, shiftY: 300, focusOn: true });
    S.aperture = 0.25;
    S.update((lt) => cw.show(Math.round(70 * ease.inOut(remap(lt, 0.4, 2.0)))));
    ui.kicker(S, { t0: 0.05, text: 'Survey of 1,014 One Nation voters', y: 372 });
    ui.counter(S, { t0: 0.4, dur: 1.6, to: 70, suffix: '%', y: 400, size: 200, color: OCSS, label: 'voted for another party in 2025, or didn\'t vote' });
  });

  E.defineScene('q1', (S) => { quote(S, 'I didn\'t change. Labor did.', 'former Labor voter, Bondi'); ui.kicker(S, { t0: 0.05, text: 'In their words', y: 372 }); });
  E.defineScene('q2', (S) => { quote(S, 'A lot of people think: well, what have we got to lose?', 'retired pilot, former Labor voter', { key: 90 }); ui.kicker(S, { t0: 0.05, text: 'In their words', y: 372 }); });

  E.defineScene('trust', (S) => {
    bars(S, 'TRUST IN THE FEDERAL GOVERNMENT · SCANLON FOUNDATION', 56, 37, 'November 2020', 'July 2025');
    ui.kicker(S, { t0: 0.05, text: 'Behind it: trust', y: 372 });
    ui.counter(S, { t0: 0.6, dur: 1.6, from: 56, to: 37, suffix: '%', y: 400, size: 160, color: '#ff8394', label: 'trust the federal government, 2020 → 2025' });
  });

  E.defineScene('coal', (S) => {
    bars(S, 'TRUST AMONG COALITION VOTERS · SCANLON FOUNDATION', 72, 29, '2021', '2025', { key: 95 });
    ui.kicker(S, { t0: 0.05, text: 'Among Coalition voters', y: 372 });
    ui.counter(S, { t0: 0.6, dur: 1.6, from: 72, to: 29, suffix: '%', y: 400, size: 160, color: '#ff8394', label: 'trust, 2021 → 2025' });
  });

  E.defineScene('doubt', (S) => {
    const cw = crowd(S, { key: 130 });
    E.camPath(S, [{ t: 0, pos: [3.5, 4.2, 6.5], look: [0, 0.4, 0], fov: 38 }, { t: 6, pos: [2.0, 3.8, 5.6], look: [0, 0.4, 0], fov: 38 }], { shake: 0.015, shiftY: 300, focusOn: true });
    S.aperture = 0.5;
    S.update((lt) => cw.show(Math.round(d.now), lt % 1.2 < 0.6 ? ORANGE : 0xc3c9d4));
    ui.kicker(S, { t0: 0.05, text: 'The catch', y: 372 });
    ui.headline(S, { t0: 0.1, html: '“Could they <em>actually govern?</em>”', y: 410, size: 92, style: 'rise' });
    ui.block(S, { t0: 1.0, html: 'Several voters told Crikey they weren\'t sure. (Seven interviews, not a representative sample.)', cls: 'body', y: 600, w: 900, size: 36 });
  });

  E.defineScene('ask', (S) => {
    const cw = crowd(S, { key: 180 });
    E.camPath(S, CAM, { shake: 0.015, shiftY: 300, focusOn: true });
    S.aperture = 0.25;
    S.update((lt) => cw.show(Math.round(d.now + 8 * Math.sin(lt * 1.5))));
    ui.kicker(S, { t0: 0.05, text: 'Your turn', y: 372 });
    ui.headline(S, { t0: 0.1, html: 'Have <em>you</em> switched?', y: 410, size: 110, style: 'rise' });
    ui.block(S, { t0: 0.9, html: '<b style="color:#c8f04a">Tell me why</b> in the comments 👇', cls: 'body', y: 640, w: 920, size: 46 });
  });

  E.defineScene('end', (S) => endCard(S, { title: 'Polls, <em>live</em>', sub: 'poltok.netlify.app', sources: 'Source: Crikey, 11 Nov 2026 (Utting Research survey; voter interviews; Scanlon Foundation trust data). Quotes are anonymised.<br>Figures = 1% of voters each. Poll: latest 4 national polls.' }));
}
