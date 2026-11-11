// Realistic reel — Victoria 2026: the closest seats from 2022. Margins are computed at render time from
// PolTok's own VEC data (src/data/au-vic.ts: 2022 final two-candidate / preference distribution), so no
// numbers are hand-typed. Seats without a two-candidate final count in that file are skipped. MP names are
// not shown (members can change); only seat, 2022 winning party, runner-up party and margin.

const PARTY = { ALP: ['Labor', 0xe0463c], LIB: ['Liberal', 0x2f6fe0], NAT: ['Nationals', 0x2f8a55], GRN: ['Greens', 0x3fae49], IND: ['Independent', 0xb9bcc6] };

export async function data() {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../../../src/data/au-vic.ts', import.meta.url), 'utf8');
  const m = src.match(/VIC_RESULTS_2022[^=]*=\s*(\{.*?\});\n/s);
  if (!m) throw new Error('could not read VIC_RESULTS_2022');
  const d = JSON.parse(m[1]);
  const seats = Object.entries(d)
    .filter(([, v]) => v.final && v.final.length === 2)
    .map(([k, v]) => {
      const [a, b] = [...v.final].sort((x, y) => y.pct - x.pct);
      const name = k.replace(/^vic-/, '').split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
      return { name, win: a.p, lose: b.p, margin: +(a.pct - 50).toFixed(2) };
    })
    .filter((s) => PARTY[s.win] && PARTY[s.lose])
    .sort((x, y) => x.margin - y.margin);
  if (seats.length < 6) throw new Error('not enough seats with 2022 two-candidate data');
  const now = new Date();
  const days = Math.round((Date.UTC(2026, 10, 28) - Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) / 86400000);
  return { top: seats.slice(0, 6), under2: seats.filter((s) => s.margin < 2).length, days };
}

export const meta = {
  title: "Victoria's closest seats",
  label: 'VIC ELECTION',
  out: 'poltok-vic-closest-seats',
  cover: 1.4,
  music: { prog: ['Dm', 'Bb', 'F', 'C'], arp: 'up', seed: 61, swing: 0.04 },
};

const pn = (p) => PARTY[p][0];

export const scenes = (d) => [
  { id: 'hook', beats: 6, energy: 3 },
  { id: 'chamber', beats: 12, energy: 2, trans: { type: 'zoom', dur: 0.5 },
    say: `Eighty-eight seats. But ${d.under2} were decided by less than two points in 2022.`,
    cap: `88 seats. But ${d.under2} were won by under 2 points in 2022.` },
  { id: 'list', beats: 14, energy: 2, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: 'These are the closest.',
    cap: 'The closest seats from 2022:' },
  { id: 'closest', beats: 12, energy: 3, trans: { type: 'flash', dur: 0.36 },
    say: `${d.top[0].name} was decided by just ${d.top[0].margin} points.`,
    cap: `${d.top[0].name}: decided by just ${d.top[0].margin} points.` },
  { id: 'next', beats: 10, energy: 2, trans: { type: 'whip', dir: 'up', dur: 0.42 },
    say: 'Watch these seats on election night, the twenty-eighth of November.',
    cap: 'Watch these seats on election night, Saturday 28 November.' },
  { id: 'end', beats: 6, energy: 0, trans: { type: 'zoom', dur: 0.5 }, noProgress: true },
];

export function build({ E, kit, ui, THREE, endCard, real }) {
  const { C, ease, remap, lerp } = E;
  const d = E.data;
  const marg = new Set(d.top.map((s) => s.name));

  const buildChamber = (S, o = {}) => {
    real.room(S, { carpet: 0x2d4a33, wood: 0x5a361d, center: [0, 0, 0], width: 30, depth: 26, height: 10, key: o.key ?? 300 });
    const ch = real.chamber(88, { rows: 5, r0: 3.4, r1: 7.6, leather: 0x1f5a38, wood: 0x6a3d1f });
    S.scene.add(ch.group);
    return ch;
  };

  E.defineScene('hook', (S) => {
    const ch = buildChamber(S);
    E.camPath(S, [{ t: 0, pos: [0, 2.0, 5.0], look: [0, 1.2, -4], fov: 36 }, { t: S.dur + 0.4, pos: [0.6, 3.4, 9.5], look: [0, 0.8, -3], fov: 36 }], { shake: 0.02, focusOn: true });
    S.aperture = 0.35;
    S.update((lt) => {
      for (let i = 0; i < 88; i++) ch.set(i, 0xffe2b0, 0.9 * ease.inOut(remap(lt, 0.2 + (i % 11) * 0.06, 0.8 + (i % 11) * 0.06)));
      ch.commit();
    });
    E.cue(S.t0 + 0.4, 'boom', { g: 0.5 });
    ui.kicker(S, { t0: 0, text: `Victoria votes in ${d.days} days`, y: 372 });
    ui.headline(S, { t0: 0, html: `Won by <em>${d.top[0].margin} points</em>`, y: 410, size: 100, style: 'slam', stagger: 0.04, t1: S.dur + 1 });
    ui.block(S, { t0: 0.35, html: `<b>${d.top[0].name}</b> was Victoria's closest seat. ${d.under2} more could flip on 28 Nov.`, cls: 'body', y: 690, w: 920, size: 46, t1: S.dur + 1 });
  });

  E.defineScene('chamber', (S) => {
    const ch = buildChamber(S);
    E.camPath(S, [{ t: 0, pos: [-6, 7.5, 9], look: [0, 0.5, -2.5], fov: 40 }, { t: S.dur, pos: [5, 7.0, 8.5], look: [0, 0.5, -2.5], fov: 40 }], { shake: 0.02, shiftY: 200, focusOn: true });
    S.aperture = 0.25;
    const r = E.rng(5); const pick = new Set(); while (pick.size < d.under2) pick.add(Math.floor(r() * 88));
    const order = [...pick];
    order.forEach((i, j) => E.cue(S.t0 + 1.0 + j * 0.12, 'blip', { i: j }));
    S.update((lt) => {
      for (let i = 0; i < 88; i++) {
        const j = order.indexOf(i);
        const on = j >= 0 ? ease.back(remap(lt, 1.0 + j * 0.12, 1.3 + j * 0.12)) : 0;
        ch.set(i, j >= 0 ? C.lime : 0xffe2b0, j >= 0 ? 1.6 * on + 0.2 : 0.35);
      }
      ch.commit();
    });
    ui.counter(S, { t0: 0.3, dur: 1.0, to: 88, y: 380, size: 220, label: 'seats in the Legislative Assembly' });
    ui.block(S, { t0: 1.4, html: `<b style="color:#c8f04a">${d.under2}</b> were won by <b>under 2 points</b> in 2022`, cls: 'body', y: 700, w: 900, size: 52 });
  });

  E.defineScene('list', (S) => {
    buildChamber(S, { key: 220 });
    E.camPath(S, [{ t: 0, pos: [5.5, 3.2, 3.0], look: [-1, 0.8, -5], fov: 38 }, { t: S.dur, pos: [3.5, 3.0, 2.0], look: [-2.5, 0.8, -5], fov: 38 }], { shake: 0.015, shiftY: -320 });
    S.aperture = 1.4; S.focus = 2.0;
    ui.kicker(S, { t0: 0.05, text: 'Closest in 2022 · two-candidate margin', y: 372 });
    ui.list(S, {
      t0: 0.4, stagger: 0.38, y: 450, size: 46, mark: '●', markColor: '#c8f04a',
      items: d.top.map((s) => `<b>${s.name}</b> <span style="opacity:.7">${pn(s.win)} over ${pn(s.lose)}</span> <b style="color:#c8f04a">${s.margin.toFixed(2)}</b>`),
    });
  });

  E.defineScene('closest', (S) => {
    real.room(S, { carpet: 0x2d4a33, wood: 0x5a361d, width: 16, depth: 14, height: 7, key: 120, area: 3, fill: 0.3 });
    const s = d.top[0];
    const desk = new THREE.Mesh(new THREE.BoxGeometry(6, 0.16, 3.4), real.pbr(real.tex.wood(0x6a3d1f), { repeat: [2, 1], clearcoat: 0.7, clearcoatRoughness: 0.2 }));
    desk.position.set(0, 1.0, 0); desk.receiveShadow = true; desk.castShadow = true; S.scene.add(desk);
    // two stacks of ballot papers whose heights match the two-candidate result
    const a = 50 + s.margin, b = 50 - s.margin;
    const stack = (x, pct, col) => {
      const g = new THREE.Group(); const n = 40;
      for (let i = 0; i < n; i++) {
        const sh = real.sheet(0.75, 1.0, (c, w, h) => { c.fillStyle = 'rgba(30,30,30,.55)'; c.font = '600 46px "Inter Tight"'; c.fillText('Ballot paper', 60, 110); c.fillStyle = '#' + new THREE.Color(col).getHexString(); c.fillRect(60, 150, w - 120, 16); });
        sh.rotation.x = -Math.PI / 2; sh.rotation.z = (Math.sin(i * 7.3) * 0.05);
        sh.position.set(Math.sin(i * 3.1) * 0.02, i * 0.012, Math.cos(i * 2.7) * 0.02);
        g.add(sh);
      }
      g.position.set(x, 1.09, 0); g.userData.full = pct; S.scene.add(g); return g;
    };
    const A = stack(-0.85, a, PARTY[s.win][1]), B = stack(0.85, b, PARTY[s.lose][1]);
    E.camPath(S, [{ t: 0, pos: [0, 6.0, 9.5], look: [0, 1.2, 0], fov: 30 }, { t: S.dur, pos: [0.8, 5.2, 8.4], look: [0, 1.25, 0], fov: 30 }], { shake: 0.015, shiftY: 330, focusOn: true });
    S.aperture = 0.35;
    S.update((lt) => {
      const k = ease.expo(remap(lt, 0.3, 1.8));
      [A, B].forEach((g) => { const show = Math.round(g.children.length * k * (g.userData.full / 50.3)); g.children.forEach((c, i) => { c.visible = i < show; }); });
    });
    ui.kicker(S, { t0: 0.05, text: 'Closest seat in 2022', y: 372 });
    ui.headline(S, { t0: 0.1, html: `<em>${s.name}</em>`, y: 428, size: 120, style: 'rise' });
    ui.counter(S, { t0: 0.6, dur: 1.2, to: s.margin, decimals: 2, y: 600, size: 170, label: `points: ${pn(s.win)} over ${pn(s.lose)}` });
    ui.tag3d(S, { at: new THREE.Vector3(-0.85, 1.75, 0.9), html: pn(s.win), cls: 'chip', t0: 1.6 });
    ui.tag3d(S, { at: new THREE.Vector3(0.85, 1.75, 0.9), html: pn(s.lose), cls: 'chip', t0: 1.6 });
  });

  E.defineScene('next', (S) => {
    const ch = buildChamber(S);
    E.camPath(S, [{ t: 0, pos: [0, 9, 11], look: [0, 0, -2], fov: 40 }, { t: S.dur, pos: [0, 6.5, 8], look: [0, 0.5, -2.5], fov: 40 }], { shake: 0.02, shiftY: 200, focusOn: true });
    S.aperture = 0.2;
    S.update((lt) => { for (let i = 0; i < 88; i++) ch.set(i, (i * 7) % 11 < d.top.length ? C.lime : 0xffe2b0, ((i * 7) % 11 < d.top.length ? 1.4 : 0.4) * (0.75 + 0.25 * Math.sin(lt * 3 + i))); ch.commit(); });
    ui.kicker(S, { t0: 0.05, text: 'Election night', y: 372 });
    ui.headline(S, { t0: 0.15, html: 'Saturday <em>28 November</em>', y: 428, size: 104, style: 'rise' });
    ui.block(S, { t0: 0.9, html: 'Every seat, live, on <b>PolTok</b>', cls: 'body', y: 640, w: 900 });
    ui.block(S, { t0: 1.8, html: '<b style="color:#c8f04a">Follow</b> for a seat-by-seat preview every day →', cls: 'body', y: 760, w: 900, size: 42 });
  });

  E.defineScene('end', (S) => endCard(S, { title: 'Follow it <em>live</em>', sub: 'poltok.netlify.app/au/victoria', sources: 'Margins: 2022 Victorian state election, two-candidate results (VEC) via PolTok data.<br>Seats in the chamber scene are illustrative positions, not real seating.' }));
}
