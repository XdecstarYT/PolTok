// Reel — "What if Australia ditched the King?" Facts only.
// 1999 republic referendum (6 Nov 1999; AEC / Wikipedia): the proposal replaced the Queen and Governor-General with a
// President appointed by a two-thirds majority of the Commonwealth Parliament. Result: Yes 45.13%, No 54.87%; no state
// majority — NSW 46.43, Vic 49.84, Qld 37.44, WA 41.48, SA 43.57, Tas 40.37; ACT 63.27 Yes; NT 48.77.
// The No side included republicans who wanted a directly elected president (Wikipedia).
// Now: Roy Morgan (Oct 2024, King's visit) 57% monarchy / 43% republic; PM Albanese ruled out a referendum (Feb 2026).

export const meta = {
  title: 'What if Australia ditched the King?',
  label: 'AUSTRALIA · WHAT IF',
  out: 'poltok-what-if-republic',
  cover: 1.4,
  music: { prog: ['Em', 'C', 'G', 'D'], arp: 'up', seed: 313, swing: 0.03 },
};

const STATES = [['NSW', 46.43], ['VIC', 49.84], ['QLD', 37.44], ['WA', 41.48], ['SA', 43.57], ['TAS', 40.37], ['ACT', 63.27], ['NT', 48.77]];

export const scenes = () => [
  { id: 'hook', beats: 6, energy: 3, voLead: 0.06, say: 'What if Australia ditched the King?' },
  { id: 'plan', beats: 11, energy: 2, trans: { type: 'zoom', dur: 0.45 },
    say: 'We nearly did. In 1999, Australians voted on replacing the Queen and the Governor-General with a president, chosen by two-thirds of Parliament.',
    cap: '1999: replace the Queen and Governor-General with a president chosen by two-thirds of Parliament.' },
  { id: 'result', beats: 10, energy: 3, trans: { type: 'flash', dur: 0.36 },
    say: 'It lost, fifty-five to forty-five. Not one state said yes.',
    cap: 'Result: No 54.87%, Yes 45.13%. No state voted yes.' },
  { id: 'victoria', beats: 9, energy: 3, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: 'Victoria came closest. Forty-nine point eight four percent. Short by less than a fifth of a point.',
    cap: 'Closest: Victoria, 49.84% yes. Only the ACT voted yes (63.27%).' },
  { id: 'change', beats: 11, energy: 2, trans: { type: 'whip', dir: 'up', dur: 0.42 },
    say: 'So what would change? An Australian president takes over from the King and the Governor-General. But Parliament, elections, and the prime minister? All stay the same.',
    cap: 'What changes: an Australian president replaces the King and Governor-General. Parliament, elections and the PM stay.' },
  { id: 'split', beats: 10, energy: 3, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: 'The catch? Who picks the president. Parliament, or you? Some republicans voted no because they wanted to elect the president themselves.',
    cap: 'The catch: who picks the president? Some republicans voted No because they wanted a direct election.' },
  { id: 'now', beats: 10, energy: 2, trans: { type: 'flash', dur: 0.36 },
    say: 'Today? A Roy Morgan poll had fifty-seven percent for keeping the monarchy. And the prime minister has ruled out a vote.',
    cap: 'Roy Morgan (Oct 2024): 57% keep the monarchy, 43% republic. Feb 2026: the PM ruled out a referendum.' },
  { id: 'ask', beats: 8, energy: 2, trans: { type: 'zoom', dur: 0.45 },
    say: 'So, King or president? Tell me in the comments.', cap: 'King or president? Comment 👇' },
  { id: 'end', beats: 6, energy: 0, trans: { type: 'zoom', dur: 0.5 }, noProgress: true },
];

export function build({ E, kit, ui, THREE, endCard, real }) {
  const { C, ease, remap } = E;
  const YES = '#5fd17f', NO = '#ff6b6b', GOLD = '#ffcf6b';

  const doc = (kicker, title, sub, draw) => real.sheet(1.5, 2.0, (c, w) => {
    c.fillStyle = 'rgba(30,22,12,.88)'; c.font = '700 32px "Inter Tight"'; c.textAlign = 'center'; c.fillText(kicker, w / 2, 100);
    c.fillRect(90, 122, w - 180, 3); c.font = '800 84px Newsreader'; const words = title.split(' '); let line = '', y = 240;
    for (const wd of words) { const t = line ? line + ' ' + wd : wd; if (c.measureText(t).width > w - 160 && line) { c.fillText(line, w / 2, y); line = wd; y += 92; } else line = t; }
    c.fillText(line, w / 2, y);
    c.font = 'italic 500 40px Newsreader'; c.fillStyle = 'rgba(30,22,12,.7)'; c.fillText(sub, w / 2, y + 70); c.textAlign = 'left';
    if (draw) draw(c, w, y + 130); else { c.fillStyle = 'rgba(30,22,12,.16)'; for (let l = 0; l < 14; l++) c.fillRect(90, y + 140 + l * 46, w - 180 - (l % 4) * 70, 14); }
  });
  const BALLOT = () => doc('REFERENDUM · 6 NOVEMBER 1999', 'A proposed law', 'To establish the Commonwealth of Australia as a republic', (c, w, y) => {
    c.fillStyle = 'rgba(30,22,12,.8)'; c.font = '500 38px Newsreader'; c.fillText('Do you approve this proposed alteration?', 90, y + 40);
    c.strokeStyle = 'rgba(30,22,12,.8)'; c.lineWidth = 5; c.strokeRect(w / 2 - 170, y + 90, 340, 170);
  });
  const desk = (S, pages, o = {}) => {
    real.room(S, { carpet: 0x2b2d3a, wood: 0x4a2e1c, width: 16, depth: 14, height: 7, key: o.key ?? 105, area: 2.4, fill: 0.28 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.16, 3.8), real.pbr(real.tex.wood(0x4f2f1a), { repeat: [2, 1], clearcoat: 0.8, clearcoatRoughness: 0.18 }));
    top.position.set(0, 1.0, 0); top.receiveShadow = true; top.castShadow = true; S.scene.add(top);
    const ms = pages.map((p, i) => { p.rotation.x = -Math.PI / 2; p.rotation.z = (i - (pages.length - 1) / 2) * 0.12; p.position.set((i - (pages.length - 1) / 2) * 0.34, 1.09 + i * 0.012, (pages.length - 1 - i) * -0.16); S.scene.add(p); return p; });
    const at = o.at ?? ((i) => 0.15 + i * 0.7);
    ms.forEach((_, i) => E.cue(S.t0 + at(i) + 0.35, 'pop', { i }));
    S.update((lt) => ms.forEach((p, i) => { const k = ease.expo(remap(lt, at(i), at(i) + 0.5)); p.position.y = 1.09 + i * 0.012 + (1 - k) * 2.6; p.visible = k > 0.01; }));
    E.camPath(S, o.cam ?? [{ t: 0, pos: [0, 5.3, 3.3], look: [0, 1.1, -0.1], fov: 34 }, { t: 6, pos: [0.25, 4.9, 3.0], look: [0, 1.1, -0.1], fov: 34 }], { shake: 0.012, shiftY: 470, focusOn: true });
    S.aperture = 0.35;
  };
  // the eight state/territory result cards, each with a yes-bar drawn to scale and a 50% line
  const stateCards = (S, o = {}) => {
    real.room(S, { carpet: 0x2b2d3a, wood: 0x4a2e1c, width: 16, depth: 14, height: 7, key: o.key ?? 115, area: 2.4, fill: 0.28 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.16, 3.8), real.pbr(real.tex.wood(0x4f2f1a), { repeat: [2, 1], clearcoat: 0.8, clearcoatRoughness: 0.18 }));
    top.position.set(0, 1.0, 0); top.receiveShadow = true; S.scene.add(top);
    const cards = STATES.map(([st, y], i) => {
      const m = real.sheet(0.62, 0.9, (c, w, h) => {
        c.fillStyle = 'rgba(30,22,12,.85)'; c.font = '800 150px "Inter Tight"'; c.textAlign = 'center'; c.fillText(st, w / 2, 190);
        const bx = 140, bw = w - 280, by = 260, bh = 1000;
        c.fillStyle = 'rgba(30,22,12,.12)'; c.fillRect(bx, by, bw, bh);
        const yh = bh * y / 100; c.fillStyle = y >= 50 ? 'rgba(40,160,80,.9)' : 'rgba(40,120,200,.85)'; c.fillRect(bx, by + bh - yh, bw, yh);
        c.fillStyle = 'rgba(200,30,40,.9)'; c.fillRect(bx - 40, by + bh / 2 - 6, bw + 80, 12);
        c.fillStyle = 'rgba(30,22,12,.9)'; c.font = '800 120px Newsreader'; c.fillText(y.toFixed(1) + '%', w / 2, by + bh + 150);
      });
      m.rotation.x = -Math.PI / 2; m.rotation.z = Math.sin(i * 3.1) * 0.04; m.position.set(((i % 4) - 1.5) * 0.72, 1.09, (Math.floor(i / 4) - 0.5) * 1.02); S.scene.add(m); return m;
    });
    S.update((lt) => cards.forEach((m, i) => { const k = ease.expo(remap(lt, 0.2 + i * 0.18, 0.6 + i * 0.18)); m.position.y = 1.09 + (1 - k) * 2; m.visible = k > 0.01; }));
    E.camPath(S, o.cam ?? [{ t: 0, pos: [0, 5.0, 3.0], look: [0, 1.1, 0], fov: 36 }, { t: 6, pos: [0.3, 4.6, 2.7], look: [0, 1.1, 0], fov: 36 }], { shake: 0.012, shiftY: o.shift ?? 400, focusOn: true });
    S.aperture = 0.3;
    return cards;
  };

  E.defineScene('hook', (S) => {
    desk(S, [BALLOT()], { at: () => 0.05, cam: [{ t: 0, pos: [0, 3.6, 2.0], look: [0, 1.1, 0], fov: 34 }, { t: 4, pos: [0.2, 5.0, 3.2], look: [0, 1.1, -0.1], fov: 34 }] });
    E.cue(S.t0 + 0.3, 'boom', { g: 0.8 });
    ui.kicker(S, { t0: 0, text: 'Australia · what if', y: 372 });
    ui.headline(S, { t0: 0, html: 'Ditch <em>the King?</em>', y: 410, size: 128, style: 'slam', stagger: 0.04, t1: S.dur + 1 });
  });

  E.defineScene('plan', (S) => {
    desk(S, [doc('CONSTITUTION ALTERATION · 1999', 'Establishment of Republic', 'A President, appointed by two-thirds of Parliament'), BALLOT()]);
    ui.kicker(S, { t0: 0.05, text: '1999 · the plan', y: 372 });
    ui.list(S, { t0: 0.4, stagger: 1.8, y: 420, w: 900, size: 46, mark: '●', markColor: GOLD, items: ['<b>Out:</b> the Queen and Governor-General', '<b>In:</b> an Australian president', 'Chosen by <b>two-thirds of Parliament</b>'] });
  });

  E.defineScene('result', (S) => {
    stateCards(S);
    E.cue(S.t0 + 0.6, 'ding', {});
    ui.kicker(S, { t0: 0.05, text: '6 November 1999 · result', y: 372 });
    ui.counter(S, { t0: 0.3, dur: 1.2, to: 54.87, decimals: 2, suffix: '%', y: 400, x: 80, w: 440, size: 120, color: NO, label: 'No' });
    ui.counter(S, { t0: 0.5, dur: 1.2, to: 45.13, decimals: 2, suffix: '%', y: 400, x: 540, w: 460, size: 120, align: 'right', color: YES, label: 'Yes', ticks: false });
    ui.block(S, { t0: 2.2, html: '<b>No state</b> voted yes · red line = 50%', cls: 'body', y: 600, align: 'center', size: 40 });
  });

  E.defineScene('victoria', (S) => {
    stateCards(S, { key: 130, cam: [{ t: 0, pos: [-0.36, 3.9, 0.55], look: [-0.36, 1.1, -0.45], fov: 34 }, { t: 6, pos: [-0.36, 3.7, 0.45], look: [-0.36, 1.1, -0.45], fov: 34 }], shift: 230 });
    ui.kicker(S, { t0: 0.05, text: 'The closest state', y: 372 });
    ui.headline(S, { t0: 0.1, html: 'Victoria: <em>49.84%</em>', y: 410, size: 104, style: 'slam' });
    ui.block(S, { t0: 1.2, html: `Short by <b style="color:${GOLD}">0.16</b> of a point · only the <b>ACT</b> said yes (63.27%)`, cls: 'body', y: 580, w: 920, size: 40 });
  });

  E.defineScene('change', (S) => {
    real.room(S, { carpet: 0x2f5a3a, wood: 0x6a4524, width: 32, depth: 28, height: 11, key: 300 });
    const N = 150; const ch = real.chamber(N, { rows: 6, r0: 3.6, r1: 8.6, leather: 0x1d5634, wood: 0x7a4a26, open: 0.6 }); S.scene.add(ch.group);
    E.camPath(S, [{ t: 0, pos: [0, 3.0, 8.5], look: [0, 0.8, -5], fov: 38 }, { t: 6, pos: [0, 5.0, 12], look: [0, 0.6, -4], fov: 38 }], { shake: 0.015, shiftY: 300, focusOn: true });
    S.aperture = 0.25;
    S.update((lt) => { for (let i = 0; i < N; i++) ch.set(i, 0xffd9a0, 0.6 + 0.2 * Math.sin(lt * 2 + i * 0.1)); ch.commit(); });
    ui.kicker(S, { t0: 0.05, text: 'What would change', y: 372 });
    ui.list(S, { t0: 0.4, stagger: 1.6, y: 420, w: 900, size: 44, mark: '●', markColor: GOLD, items: ['<b>Changes:</b> an Australian president replaces the King and Governor-General', '<b>Stays:</b> Parliament, elections, the prime minister'] });
  });

  E.defineScene('split', (S) => {
    desk(S, [doc('THE BIG QUESTION', 'Who picks the president?', 'Parliament, or the people?')], { at: () => 0.2, key: 95 });
    ui.kicker(S, { t0: 0.05, text: 'Why it failed', y: 372 });
    ui.headline(S, { t0: 0.1, html: 'Parliament, or <em>you?</em>', y: 410, size: 104, style: 'rise' });
    ui.block(S, { t0: 1.4, html: 'Some <b>republicans</b> voted No: they wanted to <b>elect</b> the president themselves', cls: 'body', y: 600, w: 920, size: 42 });
  });

  E.defineScene('now', (S) => {
    desk(S, [doc('ROY MORGAN · OCTOBER 2024', 'Monarchy or republic?', 'Poll taken during the King\'s visit', (c, w, y) => {
      const bar = (lab, v, col, yy) => { c.fillStyle = 'rgba(30,22,12,.85)'; c.font = '700 48px "Inter Tight"'; c.fillText(lab, 90, yy); c.fillStyle = col; c.fillRect(90, yy + 20, (w - 180) * v / 100, 90); c.fillStyle = 'rgba(30,22,12,.9)'; c.font = '800 70px Newsreader'; c.fillText(v + '%', 100 + (w - 180) * v / 100 - 220, yy + 90); };
      bar('Keep the monarchy', 57, 'rgba(40,120,200,.85)', y + 60); bar('Republic', 43, 'rgba(40,160,80,.85)', y + 280);
    })], { at: () => 0.2 });
    ui.kicker(S, { t0: 0.05, text: 'Today', y: 372 });
    ui.counter(S, { t0: 0.4, dur: 1.2, to: 57, suffix: '%', y: 400, size: 150, color: '#6ea2ff', label: 'want to keep the monarchy (Roy Morgan, Oct 2024)' });
    ui.block(S, { t0: 2.6, html: 'Feb 2026: the PM <b>ruled out</b> a referendum', cls: 'body', y: 620, align: 'center', size: 42 });
  });

  E.defineScene('ask', (S) => {
    desk(S, [BALLOT()], { at: () => 0.1, key: 120 });
    ui.kicker(S, { t0: 0.05, text: 'Your vote', y: 372 });
    ui.headline(S, { t0: 0.1, html: 'King or <em>president?</em>', y: 410, size: 120, style: 'rise' });
    ui.block(S, { t0: 0.9, html: '<b style="color:#c8f04a">Comment</b> 👇 &nbsp;·&nbsp; <b>Follow</b> for more what-ifs', cls: 'body', y: 640, w: 920, size: 42 });
  });

  E.defineScene('end', (S) => endCard(S, { title: 'More <em>what ifs</em>', sub: 'poltok.netlify.app', sources: '1999 republic referendum: AEC results and proposed law. Poll: Roy Morgan (Oct 2024). Feb 2026: PM rules out referendum (GB News/Yahoo).<br>Documents and cards shown are illustrative.' }));
}
