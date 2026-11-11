// Realistic reel — trailer for QUORUM: The Calderra Ledger, PolTok's own original political strategy game
// (/play). Uses the game's own content (src/features/play/engine/content.json): the fictional Republic of
// Calderra, its 72-seat Assembly (37 to pass a law), three eras and its rival parties. No real-world claims.

export async function data() {
  const fs = await import('node:fs');
  const c = JSON.parse(fs.readFileSync(new URL('../../../src/features/play/engine/content.json', import.meta.url), 'utf8'));
  return {
    rivals: c.rivals.slice(0, 3).map((r) => ({ name: r.name, color: r.color })),
    eras: c.eras.map((e) => ({ name: e.name, years: e.years })),
    laws: c.laws.length, events: c.events.length,
  };
}

export const meta = {
  title: 'QUORUM — trailer',
  label: 'NEW GAME',
  out: 'poltok-quorum-trailer',
  cover: 1.6,
  music: { prog: ['Cm', 'Ab', 'Fm', 'G'], arp: 'up', seed: 97, swing: 0.03 },
};

export const scenes = (d) => [
  { id: 'hook', beats: 6, energy: 3 },
  { id: 'found', beats: 10, energy: 2, trans: { type: 'fade', dur: 0.5 },
    say: 'The Republic of Calderra is new. Its first Assembly has seventy-two seats.',
    cap: 'The Republic of Calderra is new. Its Assembly has 72 seats.' },
  { id: 'rivals', beats: 10, energy: 2, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: 'Found your party. Outplay three rivals.', cap: 'Found your party. Outplay three rivals.' },
  { id: 'vote', beats: 14, energy: 3, trans: { type: 'flash', dur: 0.36 },
    say: 'Whip the votes. Thirty-seven passes a law.', cap: 'Whip the votes. 37 passes a law.' },
  { id: 'eras', beats: 10, energy: 2, trans: { type: 'whip', dir: 'up', dur: 0.42 },
    say: `Three eras. ${d.laws} laws. ${d.events} crises.`, cap: `3 eras · ${d.laws} laws · ${d.events} crises.` },
  { id: 'end', beats: 6, energy: 0, trans: { type: 'zoom', dur: 0.5 }, noProgress: true },
];

export function build({ E, kit, ui, THREE, endCard, real }) {
  const { C, ease, remap } = E;
  const d = E.data;
  const N = 72, PASS = 37;
  const hall = (S, o = {}) => {
    real.room(S, { carpet: 0x3a1f22, wood: 0x4e2d17, width: 28, depth: 24, height: 10, key: o.key ?? 260, warm: 0xffcf96 });
    const ch = real.chamber(N, { rows: 4, r0: 3.0, r1: 6.4, leather: 0x6b1f24, wood: 0x5a3418, open: 0.6 });
    S.scene.add(ch.group);
    return ch;
  };

  E.defineScene('hook', (S) => {
    const ch = hall(S, { key: 180 });
    E.camPath(S, [{ t: 0, pos: [0, 1.6, 4.5], look: [0, 1.2, -5], fov: 34 }, { t: S.dur + 0.4, pos: [0, 2.6, 7.5], look: [0, 1.0, -4], fov: 34 }], { shake: 0.02, focusOn: true });
    S.aperture = 0.45;
    S.update((lt) => { for (let i = 0; i < N; i++) ch.set(i, 0xffd9a0, 0.6 * ease.inOut(remap(lt, 0.4 + (i % 9) * 0.08, 1.0 + (i % 9) * 0.08))); ch.commit(); });
    E.cue(S.t0 + 0.5, 'boom', { g: 0.7 });
    ui.kicker(S, { t0: 0.05, text: 'A PolTok original', y: 372 });
    ui.headline(S, { t0: 0.2, html: '<em>QUORUM</em>', y: 428, size: 150, style: 'slam', t1: S.dur + 1 });
    ui.block(S, { t0: 0.9, html: 'The Calderra Ledger', cls: 'body', y: 620, size: 54 });
  });

  E.defineScene('found', (S) => {
    const ch = hall(S);
    E.camPath(S, [{ t: 0, pos: [-7, 8, 9], look: [0, 0.4, -2.5], fov: 40 }, { t: S.dur, pos: [6, 7.4, 8.4], look: [0, 0.4, -2.5], fov: 40 }], { shake: 0.015, shiftY: 240, focusOn: true });
    S.aperture = 0.2;
    S.update((lt) => { for (let i = 0; i < N; i++) ch.set(i, 0xffd9a0, 0.5); ch.commit(); });
    ui.kicker(S, { t0: 0.05, text: 'The Republic of Calderra', y: 372 });
    ui.counter(S, { t0: 0.3, dur: 1.2, to: N, y: 410, size: 220, label: 'seats in the Assembly' });
  });

  E.defineScene('rivals', (S) => {
    const ch = hall(S);
    const cols = [0xc8f04a, ...d.rivals.map((r) => new THREE.Color(r.color).getHex())];
    const share = [12, 22, 20, 18];
    const owner = []; share.forEach((n, k) => { for (let j = 0; j < n; j++) owner.push(k); });
    E.camPath(S, [{ t: 0, pos: [0, 9.5, 10.5], look: [0, 0, -2.5], fov: 40 }, { t: S.dur, pos: [0, 8, 9], look: [0, 0.3, -2.8], fov: 40 }], { shake: 0.015, shiftY: 240, focusOn: true });
    S.aperture = 0.15;
    S.update((lt) => { for (let i = 0; i < N; i++) { const k = owner[i]; ch.set(i, cols[k], 1.2 * ease.back(remap(lt, 0.3 + k * 0.45, 0.8 + k * 0.45))); } ch.commit(); });
    ui.kicker(S, { t0: 0.05, text: 'Found your party', y: 372 });
    ui.list(S, { t0: 0.6, stagger: 0.45, y: 440, size: 48, mark: '●', markColor: '#c8f04a', items: ['<b style="color:#c8f04a">Your party</b>', ...d.rivals.map((r) => `<span style="color:${r.color}">${r.name}</span>`)] });
    ui.block(S, { t0: 2.6, html: 'Seat colours are illustrative.', cls: 'body', y: 760, size: 30 });
  });

  E.defineScene('vote', (S) => {
    const ch = hall(S, { key: 300 });
    const order = Array.from({ length: N }, (_, i) => i).sort((a, b) => Math.sin(a * 12.9898) - Math.sin(b * 12.9898));
    const yes = new Set(order.slice(0, 41));
    E.camPath(S, [{ t: 0, pos: [4, 4.5, 7], look: [0, 0.8, -3], fov: 38 }, { t: S.dur, pos: [-4, 5, 8], look: [0, 0.8, -3], fov: 38 }], { shake: 0.02, shiftY: 260, focusOn: true });
    S.aperture = 0.25;
    order.forEach((i, j) => { if (j % 4 === 0) E.cue(S.t0 + 0.6 + j * 0.045, 'blip', { i: j / 4 }); });
    E.cue(S.t0 + 0.6 + N * 0.045 + 0.2, 'ding', {});
    S.update((lt) => {
      let ycount = 0;
      order.forEach((i, j) => { const on = lt > 0.6 + j * 0.045; if (on && yes.has(i)) ycount++; ch.set(i, on ? (yes.has(i) ? 0xc8f04a : 0xff5a6e) : 0xffd9a0, on ? 1.4 : 0.25); });
      ch.commit();
    });
    ui.kicker(S, { t0: 0.05, text: 'The roll call', y: 372 });
    ui.counter(S, { t0: 0.6, dur: N * 0.045, to: 41, y: 410, size: 200, label: `YES · ${PASS} to pass`, color: '#c8f04a' });
    ui.headline(S, { t0: 0.6 + N * 0.045 + 0.3, html: '<em>PASSED</em>', y: 700, size: 130, style: 'slam' });
  });

  E.defineScene('eras', (S) => {
    real.room(S, { carpet: 0x3a1f22, wood: 0x4e2d17, width: 16, depth: 14, height: 7, key: 120, area: 3, fill: 0.3 });
    const desk = new THREE.Mesh(new THREE.BoxGeometry(6, 0.16, 3.4), real.pbr(real.tex.wood(0x5a3418), { repeat: [2, 1], clearcoat: 0.7, clearcoatRoughness: 0.2 }));
    desk.position.set(0, 1.0, 0); desk.receiveShadow = true; S.scene.add(desk);
    const papers = d.eras.map((e, i) => {
      const p = real.sheet(1.3, 1.75, (c, w) => {
        c.fillStyle = 'rgba(25,20,15,.85)'; c.font = '800 70px Newsreader'; c.fillText('THE', 70, 150);
        c.font = '800 96px Newsreader'; c.fillText(e.name.replace(/^The /, '').toUpperCase(), 70, 260);
        c.font = '600 44px "Inter Tight"'; c.fillStyle = 'rgba(25,20,15,.6)'; c.fillText(e.years, 70, 330);
        c.fillStyle = 'rgba(25,20,15,.2)'; for (let l = 0; l < 9; l++) c.fillRect(70, 400 + l * 60, w - 140 - (l % 3) * 120, 16);
      });
      p.rotation.x = -Math.PI / 2; p.rotation.z = (i - 1) * 0.12; p.position.set((i - 1) * 1.45, 1.09 + i * 0.004, 0);
      S.scene.add(p); return p;
    });
    E.camPath(S, [{ t: 0, pos: [0, 7.4, 9.0], look: [0, 1.1, 0], fov: 34 }, { t: S.dur, pos: [0.4, 6.6, 8.0], look: [0, 1.1, 0], fov: 34 }], { shake: 0.012, shiftY: 330, focusOn: true });
    S.aperture = 0.45;
    papers.forEach((_, i) => E.cue(S.t0 + 0.3 + i * 0.5, 'pop', { i }));
    S.update((lt) => papers.forEach((p, i) => { const k = ease.expo(remap(lt, 0.3 + i * 0.5, 0.8 + i * 0.5)); p.position.y = 1.09 + i * 0.004 + (1 - k) * 3; p.visible = k > 0.01; }));
    ui.kicker(S, { t0: 0.05, text: '24 turns · 20–40 minutes', y: 372 });
    ui.headline(S, { t0: 0.15, html: `3 eras · <em>${d.laws} laws</em>`, y: 428, size: 100, style: 'rise' });
    ui.block(S, { t0: 1.0, html: `${d.events} crises · cabinets · coalitions · a 3D map`, cls: 'body', y: 600, w: 900 });
  });

  E.defineScene('end', (S) => endCard(S, { title: 'Play <em>free</em>', sub: 'poltok.netlify.app/play', sources: 'QUORUM is an original PolTok game. Calderra and its parties are fictional.' }));
}
