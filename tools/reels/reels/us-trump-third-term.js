// Reel (other country, viral) — "What if Trump tried for a third term?" Facts + live numbers, no predictions.
// 22nd Amendment (ratified 1951): no person shall be elected President more than twice. Trump: elected 2016 and 2024.
// Statements: "not joking" about a third term (NBC, 30 Mar 2025); "I'm not allowed to run. It's too bad." (Air Force One,
// 29 Oct 2025 — AP/Axios/PBS). Amendment process (Art. V): two-thirds of both houses, then three-quarters of states (38/50).
// Congress just elected: LIVE from PolTok's results feed (AP calls). Trump won 31 states in 2024. 27 amendments; last 1992.

export async function data() {
  const { snapshot, asOfLabel } = await import('./_lib-us.js');
  const j = await snapshot();
  const pick = (c) => { const b = j.balance.find((x) => x.chamber === c); if (!b) throw new Error('missing ' + c); return { dem: b.dem, rep: b.rep, total: b.total, und: Math.max(0, b.total - b.dem - b.rep - (b.ind || 0)) }; };
  const house = pick('house'), senate = pick('senate');
  return { house, senate, needH: Math.ceil((2 / 3) * 435), needS: Math.ceil((2 / 3) * 100), asOf: asOfLabel(j) };
}

export const meta = {
  title: 'What if Trump tried for a third term?',
  label: 'USA · WHAT IF',
  out: 'poltok-what-if-trump-third-term',
  cover: 1.4,
  music: { prog: ['Dm', 'Bb', 'F', 'C'], arp: 'up', seed: 293, swing: 0.03 },
};

export const scenes = (d) => [
  { id: 'hook', beats: 6, energy: 3, voLead: 0.06, say: 'What if Trump tried for a third term?' },
  { id: 'rule', beats: 10, energy: 2, trans: { type: 'zoom', dur: 0.45 },
    say: 'Since nineteen fifty-one, the 22nd Amendment says no one can be elected president more than twice. Trump\'s been elected twice.',
    cap: '22nd Amendment (1951): no one can be elected president more than twice. Trump: elected 2016 and 2024.' },
  { id: 'said', beats: 11, energy: 3, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: 'In March twenty twenty-five, he said he was not joking about it. Seven months later: I\'m not allowed to run. It\'s too bad.',
    cap: 'Mar 2025: "not joking" about a third term. Oct 2025: "I\'m not allowed to run. It\'s too bad."' },
  { id: 'how', beats: 9, energy: 2, trans: { type: 'whip', dir: 'up', dur: 0.42 },
    say: 'To change it, you need two-thirds of both houses of Congress. Then thirty-eight states.',
    cap: 'To change it: two-thirds of the House and the Senate, then 38 of 50 states.' },
  { id: 'congress', beats: 12, energy: 3, trans: { type: 'flash', dur: 0.36 },
    say: `The Congress Americans just elected? Republicans have ${d.house.rep} House seats. They'd need ${d.needH}. And ${d.senate.rep} senators. They'd need ${d.needS}.`,
    cap: `New Congress: Republicans ${d.house.rep}/435 House (need ${d.needH}), ${d.senate.rep}/100 Senate (need ${d.needS}).` },
  { id: 'states', beats: 8, energy: 3, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: 'And in twenty twenty-four, Trump won thirty-one states. Seven short.',
    cap: '2024: Trump won 31 states. 38 needed. Seven short.' },
  { id: 'ask', beats: 8, energy: 2, trans: { type: 'zoom', dur: 0.45 },
    say: 'So, should presidents be limited to two terms? Tell me in the comments.', cap: 'Should presidents be limited to two terms? 👇' },
  { id: 'end', beats: 6, energy: 0, trans: { type: 'zoom', dur: 0.5 }, noProgress: true },
];

export function build({ E, kit, ui, THREE, endCard, real }) {
  const { C, ease, remap } = E;
  const d = E.data;
  const DEM = 0x2f6fe0, REP = 0xe0303f, UND = 0x9aa3b2, WARM = 0xffe2b0;
  const RCSS = '#ff6b75';

  // photoreal desk with Constitution pages (parchment)
  const parchment = (title, sub, body) => real.sheet(1.5, 2.0, (c, w) => {
    c.fillStyle = 'rgba(120,90,40,.10)'; c.fillRect(0, 0, w, 1400);
    c.fillStyle = 'rgba(40,28,15,.88)'; c.font = 'italic 700 44px Newsreader'; c.textAlign = 'center'; c.fillText('The Constitution of the United States', w / 2, 110);
    c.fillRect(90, 135, w - 180, 3); c.font = '800 100px Newsreader'; c.fillText(title, w / 2, 290);
    c.font = 'italic 500 42px Newsreader'; c.fillStyle = 'rgba(40,28,15,.7)'; c.fillText(sub, w / 2, 360);
    c.textAlign = 'left'; c.font = '500 40px Newsreader'; c.fillStyle = 'rgba(40,28,15,.8)';
    const words = body.split(' '); let line = '', y = 470;
    for (const wd of words) { const t = line ? line + ' ' + wd : wd; if (c.measureText(t).width > w - 180 && line) { c.fillText(line, 90, y); line = wd; y += 54; } else line = t; }
    c.fillText(line, 90, y);
    c.fillStyle = 'rgba(40,28,15,.16)'; for (let l = 0; l < 8; l++) c.fillRect(90, y + 80 + l * 46, w - 180 - (l % 4) * 70, 14);
  });
  const XXII = ['Amendment XXII', 'Section 1 · Ratified 1951', 'No person shall be elected to the office of the President more than twice, and no person who has held the office of President, or acted as President, for more than two years of a term to which some other person was elected President shall be elected to the office of the President more than once.'];
  const V = ['Article V', 'Amending the Constitution', 'The Congress, whenever two thirds of both Houses shall deem it necessary, shall propose Amendments to this Constitution, which shall be valid when ratified by the Legislatures of three fourths of the several States.'];
  const desk = (S, pages, o = {}) => {
    real.room(S, { carpet: 0x3a2430, wood: 0x4a2e1c, width: 16, depth: 14, height: 7, key: o.key ?? 105, area: 2.4, fill: 0.28 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.16, 3.8), real.pbr(real.tex.wood(0x4f2f1a), { repeat: [2, 1], clearcoat: 0.8, clearcoatRoughness: 0.18 }));
    top.position.set(0, 1.0, 0); top.receiveShadow = true; top.castShadow = true; S.scene.add(top);
    const ms = pages.map((pg, i) => { const p = parchment(...pg); p.rotation.x = -Math.PI / 2; p.rotation.z = (i - (pages.length - 1) / 2) * 0.12; p.position.set((i - (pages.length - 1) / 2) * 0.34, 1.09 + i * 0.012, (pages.length - 1 - i) * -0.16); S.scene.add(p); return p; });
    const at = o.at ?? ((i) => 0.15 + i * 0.6);
    ms.forEach((_, i) => E.cue(S.t0 + at(i) + 0.35, 'pop', { i }));
    S.update((lt) => ms.forEach((p, i) => { const k = ease.expo(remap(lt, at(i), at(i) + 0.5)); p.position.y = 1.09 + i * 0.012 + (1 - k) * 2.6; p.visible = k > 0.01; }));
    E.camPath(S, o.cam ?? [{ t: 0, pos: [0, 5.3, 3.3], look: [0, 1.1, -0.1], fov: 34 }, { t: 6, pos: [0.25, 4.9, 3.0], look: [0, 1.1, -0.1], fov: 34 }], { shake: 0.012, shiftY: 470, focusOn: true });
    S.aperture = 0.35;
  };
  // photoreal House chamber (435 seats)
  const house = (S, o = {}) => {
    real.room(S, { carpet: 0x2b2f4a, wood: 0x5a361d, width: 36, depth: 30, height: 12, key: o.key ?? 320 });
    const ch = real.chamber(435, { rows: 10, r0: 3.4, r1: 9.4, leather: 0x3a3f5c, wood: 0x5c3a20, open: 0.6 });
    S.scene.add(ch.group);
    return ch;
  };
  const houseCols = [...Array(d.house.dem).fill(DEM), ...Array(d.house.und).fill(UND), ...Array(d.house.rep).fill(REP)];

  E.defineScene('hook', (S) => {
    const ch = house(S);
    E.camPath(S, [{ t: 0, pos: [0, 2.8, 8], look: [0, 0.9, -6], fov: 38 }, { t: S.dur + 0.4, pos: [0, 6.0, 13.5], look: [0, 0.3, -4], fov: 38 }], { shake: 0.025, focusOn: true });
    S.aperture = 0.25;
    E.cue(S.t0 + 0.3, 'boom', { g: 0.9 });
    S.update((lt) => { for (let i = 0; i < 435; i++) ch.set(i, REP, 1.2 * ease.inOut(remap(lt, 0.15 + (i / 435) * 1.4, 0.45 + (i / 435) * 1.4))); ch.commit(); });
    ui.kicker(S, { t0: 0, text: 'USA · what if', y: 372 });
    ui.headline(S, { t0: 0, html: 'Trump, <em>third term?</em>', y: 410, size: 120, style: 'slam', stagger: 0.04, t1: S.dur + 1 });
  });

  E.defineScene('rule', (S) => {
    desk(S, [XXII]);
    ui.kicker(S, { t0: 0.05, text: 'The rule · 22nd Amendment', y: 372 });
    ui.block(S, { t0: 0.3, html: '“No person shall be elected to the office of the President <b>more than twice</b>”', cls: 'body', y: 420, w: 920, size: 48 });
    ui.block(S, { t0: 2.6, html: `Trump: elected <b style="color:${RCSS}">2016</b> and <b style="color:${RCSS}">2024</b>`, cls: 'body', y: 620, align: 'center', size: 46 });
  });

  E.defineScene('said', (S) => {
    desk(S, [XXII], { key: 90, cam: [{ t: 0, pos: [0.6, 4.6, 2.8], look: [0, 1.1, -0.1], fov: 34 }, { t: 6, pos: [0.9, 4.3, 2.5], look: [0, 1.1, -0.1], fov: 34 }] });
    ui.kicker(S, { t0: 0.05, text: 'What he\'s said', y: 372 });
    ui.block(S, { t0: 0.3, html: '<span style="opacity:.7">March 2025</span><br><b>“not joking”</b> about a third term', cls: 'body', y: 420, w: 920, size: 48 });
    ui.block(S, { t0: 3.0, html: '<span style="opacity:.7">October 2025</span><br><b>“I\'m not allowed to run. It\'s too bad.”</b>', cls: 'body', y: 590, w: 920, size: 48 });
  });

  E.defineScene('how', (S) => {
    desk(S, [XXII, V], { at: (i) => (i === 0 ? -1 : 0.2) });
    ui.kicker(S, { t0: 0.05, text: 'To change it · Article V', y: 372 });
    ui.list(S, { t0: 0.3, stagger: 1.3, y: 420, w: 900, size: 48, mark: '●', markColor: '#c8f04a', items: ['<b>Two-thirds</b> of the House', '<b>Two-thirds</b> of the Senate', 'Then <b>38 of 50</b> states'] });
  });

  E.defineScene('congress', (S) => {
    const ch = house(S);
    E.camPath(S, [{ t: 0, pos: [0, 13, 15], look: [0, 0, -3], fov: 44 }, { t: 6, pos: [0, 12, 14], look: [0, 0.3, -3.2], fov: 44 }], { shake: 0.015, shiftY: 300, focusOn: true });
    S.aperture = 0.1;
    // light the seats; then a lime "line" sweeps to the two-thirds mark
    S.update((lt) => { const k = ease.inOut(remap(lt, 2.4, 4.0)); for (let i = 0; i < 435; i++) { const need = i >= 435 - Math.round(d.needH * k); const c = houseCols[i]; ch.set(i, need && c !== REP ? C.lime : c, (need ? 1.4 : 1.0) * ease.back(remap(lt, 0.2 + (i / 435) * 1.2, 0.5 + (i / 435) * 1.2))); } ch.commit(); });
    ui.kicker(S, { t0: 0.05, text: "The Congress just elected", y: 372 });
    ui.counter(S, { t0: 0.3, dur: 1.2, to: d.house.rep, y: 400, x: 80, w: 440, size: 130, color: RCSS, label: `GOP House seats · need ${d.needH}` });
    ui.counter(S, { t0: 0.5, dur: 1.2, to: d.senate.rep, y: 400, x: 540, w: 460, size: 130, align: 'right', color: RCSS, label: `GOP senators · need ${d.needS}`, ticks: false });
    ui.block(S, { t0: 2.6, html: '<span style="color:#c8f04a">■</span> the extra seats a two-thirds vote would need', cls: 'body', y: 620, align: 'center', size: 34 });
  });

  E.defineScene('states', (S) => {
    // 50 state cards on a desk: 31 stamped red (won by Trump in 2024), 7 more highlighted to reach 38
    real.room(S, { carpet: 0x3a2430, wood: 0x4a2e1c, width: 16, depth: 14, height: 7, key: 110, area: 2.4, fill: 0.28 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.16, 3.8), real.pbr(real.tex.wood(0x4f2f1a), { repeat: [2, 1], clearcoat: 0.8, clearcoatRoughness: 0.18 }));
    top.position.set(0, 1.0, 0); top.receiveShadow = true; S.scene.add(top);
    const card = (i, kind) => real.sheet(0.36, 0.46, (c, w, h) => {
      c.fillStyle = kind === 'won' ? 'rgba(200,40,50,.85)' : kind === 'need' ? 'rgba(200,240,74,.9)' : 'rgba(40,28,15,.25)';
      c.fillRect(0, 0, w, 120); c.fillStyle = 'rgba(40,28,15,.75)'; c.font = '700 90px "Inter Tight"'; c.textAlign = 'center'; c.fillText('STATE', w / 2, 360); c.font = '800 160px Newsreader'; c.fillText(String(i + 1), w / 2, 560);
    });
    const cards = Array.from({ length: 50 }, (_, i) => { const kind = i < 31 ? 'won' : i < 38 ? 'need' : 'none'; const m = card(i, kind); m.rotation.x = -Math.PI / 2; m.rotation.z = Math.sin(i * 4.1) * 0.05; m.position.set(((i % 10) - 4.5) * 0.42, 1.09, (Math.floor(i / 10) - 2) * 0.52); S.scene.add(m); return m; });
    E.camPath(S, [{ t: 0, pos: [0, 5.6, 3.6], look: [0, 1.1, 0], fov: 36 }, { t: 6, pos: [0.3, 5.1, 3.2], look: [0, 1.1, 0], fov: 36 }], { shake: 0.012, shiftY: 400, focusOn: true });
    S.aperture = 0.3;
    S.update((lt) => cards.forEach((m, i) => { const t0 = i < 31 ? 0.3 + i * 0.03 : i < 38 ? 2.2 + (i - 31) * 0.12 : 0.1; const k = ease.expo(remap(lt, t0, t0 + 0.4)); m.position.y = 1.09 + (1 - k) * 1.8; m.visible = k > 0.01; }));
    ui.kicker(S, { t0: 0.05, text: '2024 presidential election', y: 372 });
    ui.counter(S, { t0: 0.3, dur: 1.2, to: 31, y: 400, size: 190, color: RCSS, label: 'states Trump won · <span style="color:#c8f04a">7 more</span> needed for 38' });
  });

  E.defineScene('ask', (S) => {
    desk(S, [V, XXII], { key: 120, at: (i) => 0.1 + i * 0.4 });
    ui.kicker(S, { t0: 0.05, text: 'Your turn', y: 372 });
    ui.headline(S, { t0: 0.1, html: 'Two terms max: <em>keep it?</em>', y: 410, size: 100, style: 'rise' });
    ui.block(S, { t0: 0.9, html: '<b style="color:#c8f04a">Comment</b> yes or no 👇 &nbsp;·&nbsp; <b>Follow</b> for more what-ifs', cls: 'body', y: 640, w: 920, size: 42 });
  });

  E.defineScene('end', (S) => endCard(S, { title: 'More <em>what ifs</em>', sub: 'poltok.netlify.app', sources: `US Constitution: Amendment XXII, Article V. Quotes: NBC (Mar 2025), AP (Oct 2025). Congress: AP calls via PolTok, ${d.asOf}.<br>2024: Trump won 31 states. Documents and cards are illustrative.` }));
}
