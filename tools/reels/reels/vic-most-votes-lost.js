// Reel — "They got the most votes, and still lost." Preferential voting explained with the three 2022 Victorian districts
// where the first-preference leader lost after preferences (VEC data, src/data/au-vic.ts; these three districts' `final`
// is a true two-candidate result). Parties only — no candidate names.

export async function data() {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../../../src/data/au-vic.ts', import.meta.url), 'utf8');
  const m = src.match(/VIC_RESULTS_2022[^=]*=\s*(\{.*?\});\n/s);
  if (!m) throw new Error('could not read VIC_RESULTS_2022');
  const R = JSON.parse(m[1]);
  const P = { ALP: 'Labor', LIB: 'the Liberals', NAT: 'the Nationals', GRN: 'the Greens', IND: 'an independent' };
  const S = { ALP: 'Labor', LIB: 'Liberal', NAT: 'Nationals', GRN: 'Greens', IND: 'Independent' };
  const pick = (k) => {
    const r = R[k];
    if (r.final.length !== 2) throw new Error(k + ': final is not two-candidate');
    const fp = [...r.fp].sort((a, b) => b.v - a.v);
    const fin = [...r.final].sort((a, b) => b.v - a.v);
    if (fp[0].n === fin[0].n) throw new Error(k + ': first-preference leader did not lose');
    const leader = fp[0], winner = fp.find((c) => c.n === fin[0].n);
    return { seat: k.replace(/^vic-/, '').replace(/^\w/, (c) => c.toUpperCase()), lead: P[leader.p], leadS: S[leader.p], leadP: leader.p, leadFp: leader.pct, leadFin: fin[1].pct,
      win: P[winner.p], winS: S[winner.p], winP: winner.p, winFp: winner.pct, winFin: fin[0].pct, gapVotes: leader.v - winner.v };
  };
  return { a: pick('vic-morwell'), b: pick('vic-mildura'), c: pick('vic-hastings') };
}

export const meta = {
  title: 'Most votes, still lost',
  label: 'HOW VOTING WORKS',
  out: 'poltok-most-votes-still-lost',
  cover: 1.4,
  music: { prog: ['Am', 'F', 'C', 'G'], arp: 'up', seed: 271, swing: 0.04 },
};

const R = Math.round;
const cap1 = (s) => s[0].toUpperCase() + s.slice(1);

export const scenes = (d) => [
  { id: 'hook', beats: 6, energy: 3, voLead: 0.06, say: 'This party got the most votes, and still lost.' },
  { id: 'first', beats: 10, energy: 2, trans: { type: 'flash', dur: 0.36 },
    say: `${d.a.seat}, twenty twenty-two. ${cap1(d.a.lead)} topped the first count, ${R(d.a.leadFp)} percent to ${d.a.win}' ${R(d.a.winFp)}.`.replace("' ", "'s ").replace("Nationals's", "Nationals'"),
    cap: `${d.a.seat} 2022, first count: ${d.a.leadS} ${d.a.leadFp}% · ${d.a.winS} ${d.a.winFp}%.` },
  { id: 'final', beats: 9, energy: 3, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: `But after preferences, ${d.a.win} won, ${R(d.a.winFin)} to ${R(d.a.leadFin)}.`,
    cap: `After preferences: ${d.a.winS} ${d.a.winFin}% · ${d.a.leadS} ${d.a.leadFin}%.` },
  { id: 'how', beats: 12, energy: 2, trans: { type: 'whip', dir: 'up', dur: 0.42 },
    say: 'That\'s preferential voting. If nobody gets half, the last candidate is knocked out, and their votes go to each voter\'s next choice. Until someone passes fifty percent.',
    cap: 'No one over 50%? The last candidate is knocked out and their votes move to each voter\'s next choice, until someone passes 50%.' },
  { id: 'more', beats: 9, energy: 3, trans: { type: 'flash', dur: 0.36 },
    say: `It happened in ${d.b.seat} too, where ${d.b.lead} led. And in ${d.c.seat}, where ${d.c.lead} led.`,
    cap: `Same in ${d.b.seat} (${d.b.leadS} led) and ${d.c.seat} (${d.c.leadS} led).` },
  { id: 'ask', beats: 8, energy: 2, trans: { type: 'zoom', dur: 0.45 },
    say: 'So your second choice really counts. Who\'s getting your preferences? Comment below.', cap: 'Your 2nd choice counts. Who gets your preferences? 👇' },
  { id: 'end', beats: 6, energy: 0, trans: { type: 'zoom', dur: 0.5 }, noProgress: true },
];

export function build({ E, kit, ui, THREE, endCard, real }) {
  const { C, ease, remap, lerp } = E;
  const d = E.data;
  const COL = { ALP: 0xe53935, LIB: 0x1f5fd1, NAT: 0x2f7d32, GRN: 0x2fa84f, IND: 0x9aa3b2 };
  const CSS = { ALP: '#ff6b6b', LIB: '#6ea2ff', NAT: '#6fcf73', GRN: '#5fd17f', IND: '#c3c9d4' };

  // two ballot stacks whose heights animate between the first count and the final count
  const stacks = (S, x) => {
    real.room(S, { carpet: 0x2b2420, wood: 0x4e3320, width: 16, depth: 14, height: 7, key: 100, area: 2.4, fill: 0.28 });
    const desk = new THREE.Mesh(new THREE.BoxGeometry(6, 0.16, 3.4), real.pbr(real.tex.wood(0x5c3a20), { repeat: [2, 1], clearcoat: 0.7, clearcoatRoughness: 0.2 }));
    desk.position.set(0, 1.0, 0); desk.receiveShadow = true; desk.castShadow = true; S.scene.add(desk);
    const mk = (px, col) => {
      const g = new THREE.Group(); const n = 50;
      for (let i = 0; i < n; i++) {
        const sh = real.sheet(0.75, 1.0, (c, w) => { c.fillStyle = 'rgba(30,30,30,.55)'; c.font = '600 46px "Inter Tight"'; c.fillText('BALLOT PAPER', 60, 110); c.fillStyle = '#' + new THREE.Color(col).getHexString(); c.fillRect(60, 150, w - 120, 16); for (let l = 0; l < 5; l++) { c.strokeStyle = 'rgba(30,30,30,.5)'; c.lineWidth = 4; c.strokeRect(60, 220 + l * 90, 60, 60); } });
        sh.rotation.x = -Math.PI / 2; sh.rotation.z = Math.sin(i * 7.3) * 0.05; sh.position.set(Math.sin(i * 3.1) * 0.02, i * 0.012, Math.cos(i * 2.7) * 0.02); g.add(sh);
      }
      g.position.set(px, 1.09, 0); S.scene.add(g); return g;
    };
    const L = mk(-0.85, COL[x.leadP]), W = mk(0.85, COL[x.winP]);
    return { set(l, w) { [[L, l], [W, w]].forEach(([g, v]) => { const show = Math.round(g.children.length * v / 60); g.children.forEach((c, i) => { c.visible = i < show; }); }); } };
  };
  const CAM = [{ t: 0, pos: [0, 6.0, 9.5], look: [0, 1.2, 0], fov: 30 }, { t: 6, pos: [0.8, 5.2, 8.4], look: [0, 1.25, 0], fov: 30 }];
  const tags = (S, t0) => { ui.tag3d(S, { at: new THREE.Vector3(-0.85, 2.0, 0.9), html: d.a.leadS, cls: 'chip', t0 }); ui.tag3d(S, { at: new THREE.Vector3(0.85, 2.0, 0.9), html: d.a.winS, cls: 'chip', t0 }); };

  E.defineScene('hook', (S) => {
    const st = stacks(S, d.a);
    E.camPath(S, [{ t: 0, pos: [0, 3.2, 5.6], look: [0, 1.3, 0], fov: 30 }, { t: S.dur + 0.4, pos: [0.4, 5.4, 8.8], look: [0, 1.2, 0], fov: 30 }], { shake: 0.02, shiftY: 300, focusOn: true });
    S.aperture = 0.4;
    E.cue(S.t0 + 0.2, 'boom', { g: 0.9 });
    S.update((lt) => { const k = ease.inOut(remap(lt, 0.8, 2.6)); st.set(lerp(d.a.leadFp, d.a.leadFin, k), lerp(d.a.winFp, d.a.winFin, k)); });
    ui.kicker(S, { t0: 0, text: 'How voting works · Victoria 2022', y: 372 });
    ui.headline(S, { t0: 0, html: 'Most votes. <em>Still lost.</em>', y: 410, size: 110, style: 'slam', stagger: 0.04, t1: S.dur + 1 });
  });

  E.defineScene('first', (S) => {
    const st = stacks(S, d.a);
    E.camPath(S, CAM, { shake: 0.015, shiftY: 330, focusOn: true });
    S.aperture = 0.35;
    S.update((lt) => { const k = ease.expo(remap(lt, 0.3, 1.6)); st.set(d.a.leadFp * k, d.a.winFp * k); });
    tags(S, 1.2);
    ui.kicker(S, { t0: 0.05, text: `${d.a.seat} · first count`, y: 372 });
    ui.counter(S, { t0: 0.3, dur: 1.2, to: d.a.leadFp, decimals: 1, suffix: '%', y: 400, x: 80, w: 440, size: 130, color: CSS[d.a.leadP], label: d.a.leadS });
    ui.counter(S, { t0: 0.5, dur: 1.2, to: d.a.winFp, decimals: 1, suffix: '%', y: 400, x: 540, w: 460, size: 130, align: 'right', color: CSS[d.a.winP], label: d.a.winS, ticks: false });
    ui.block(S, { t0: 2.0, html: `${d.a.leadS} ahead by <b style="color:#c8f04a">${d.a.gapVotes.toLocaleString('en-AU')}</b> votes`, cls: 'body', y: 620, align: 'center', size: 44 });
  });

  E.defineScene('final', (S) => {
    const st = stacks(S, d.a);
    E.camPath(S, CAM, { shake: 0.02, shiftY: 330, focusOn: true });
    S.aperture = 0.35;
    E.cue(S.t0 + 1.8, 'ding', {});
    S.update((lt) => { const k = ease.inOut(remap(lt, 0.4, 2.0)); st.set(lerp(d.a.leadFp, d.a.leadFin, k), lerp(d.a.winFp, d.a.winFin, k)); });
    tags(S, 0.2);
    ui.kicker(S, { t0: 0.05, text: `${d.a.seat} · after preferences`, y: 372 });
    ui.counter(S, { t0: 0.4, dur: 1.6, from: d.a.leadFp, to: d.a.leadFin, decimals: 1, suffix: '%', y: 400, x: 80, w: 440, size: 130, color: CSS[d.a.leadP], label: `${d.a.leadS} · lost`, ticks: false });
    ui.counter(S, { t0: 0.4, dur: 1.6, from: d.a.winFp, to: d.a.winFin, decimals: 1, suffix: '%', y: 400, x: 540, w: 460, size: 130, align: 'right', color: CSS[d.a.winP], label: `${d.a.winS} · won` });
  });

  E.defineScene('how', (S) => {
    real.room(S, { carpet: 0x2b2420, wood: 0x4e3320, width: 16, depth: 14, height: 7, key: 110, area: 2.4, fill: 0.28 });
    const desk = new THREE.Mesh(new THREE.BoxGeometry(6, 0.16, 3.4), real.pbr(real.tex.wood(0x5c3a20), { repeat: [2, 1], clearcoat: 0.7, clearcoatRoughness: 0.2 }));
    desk.position.set(0, 1.0, 0); desk.receiveShadow = true; S.scene.add(desk);
    const p = real.sheet(1.5, 2.0, (c, w) => {
      c.fillStyle = 'rgba(20,18,15,.85)'; c.font = '800 54px "Inter Tight"'; c.textAlign = 'center'; c.fillText('LEGISLATIVE ASSEMBLY', w / 2, 110);
      c.font = '500 34px Newsreader'; c.fillText('Number every box in order of your choice', w / 2, 170); c.textAlign = 'left';
      const names = ['CANDIDATE A', 'CANDIDATE B', 'CANDIDATE C', 'CANDIDATE D', 'CANDIDATE E'];
      names.forEach((nm, i) => { c.strokeStyle = 'rgba(20,18,15,.7)'; c.lineWidth = 5; c.strokeRect(90, 260 + i * 190, 110, 110); c.font = '700 44px "Inter Tight"'; c.fillText(nm, 240, 330 + i * 190); c.font = '800 80px Newsreader'; c.fillStyle = 'rgba(30,60,160,.9)'; c.fillText(String([3, 1, 5, 2, 4][i]), 120, 345 + i * 190); c.fillStyle = 'rgba(20,18,15,.85)'; });
    });
    p.rotation.x = -Math.PI / 2; p.position.set(0, 1.09, 0); S.scene.add(p);
    E.camPath(S, [{ t: 0, pos: [0, 4.2, 2.4], look: [0, 1.1, 0], fov: 34 }, { t: 6, pos: [0.2, 3.8, 2.1], look: [0, 1.1, 0], fov: 34 }], { shake: 0.012, shiftY: 470, focusOn: true });
    S.aperture = 0.4;
    ui.kicker(S, { t0: 0.05, text: 'Preferential voting', y: 372 });
    ui.list(S, { t0: 0.4, stagger: 1.7, y: 420, w: 900, size: 42, mark: '●', markColor: '#c8f04a', items: [
      'Nobody gets <b>50%</b>?', 'The last candidate is <b>knocked out</b>', 'Their votes go to each voter\'s <b>next choice</b>', 'Repeat until someone passes <b>50%</b>',
    ] });
  });

  E.defineScene('more', (S) => {
    const st = stacks(S, d.b);
    E.camPath(S, CAM, { shake: 0.015, shiftY: 330, focusOn: true });
    S.aperture = 0.35;
    S.update((lt) => { const x = lt < 2.4 ? d.b : d.c; const k = ease.inOut(remap(lt % 2.4, 0.3, 1.6)); st.set(lerp(x.leadFp, x.leadFin, k), lerp(x.winFp, x.winFin, k)); });
    ui.kicker(S, { t0: 0.05, text: 'It happened twice more in 2022', y: 372 });
    ui.list(S, { t0: 0.4, stagger: 1.6, y: 420, w: 900, size: 42, mark: '●', markColor: '#c8f04a', items: [
      `<b>${d.b.seat}</b>: <span style="color:${CSS[d.b.leadP]}">${d.b.leadS}</span> led ${d.b.leadFp}%, lost ${d.b.leadFin}–${d.b.winFin}`,
      `<b>${d.c.seat}</b>: <span style="color:${CSS[d.c.leadP]}">${d.c.leadS}</span> led ${d.c.leadFp}%, lost ${d.c.leadFin}–${d.c.winFin}`,
    ] });
  });

  E.defineScene('ask', (S) => {
    const st = stacks(S, d.a);
    E.camPath(S, CAM, { shake: 0.015, shiftY: 330, focusOn: true });
    S.aperture = 0.35;
    S.update((lt) => { const k = (Math.sin(lt * 1.6) + 1) / 2; st.set(lerp(d.a.leadFp, d.a.leadFin, k), lerp(d.a.winFp, d.a.winFin, k)); });
    ui.kicker(S, { t0: 0.05, text: 'Victoria votes 28 November', y: 372 });
    ui.headline(S, { t0: 0.1, html: 'Who gets your <em>preferences?</em>', y: 410, size: 100, style: 'rise' });
    ui.block(S, { t0: 0.9, html: '<b style="color:#c8f04a">Comment</b> 👇 &nbsp;·&nbsp; <b>Send this</b> to someone who only numbers one box', cls: 'body', y: 640, w: 920, size: 40 });
  });

  E.defineScene('end', (S) => endCard(S, { title: 'Every count, <em>live</em>', sub: 'poltok.netlify.app/au/victoria', sources: 'Source: VEC 2022 Victorian state election, first preferences and final two-candidate counts (Morwell, Mildura, Hastings).<br>The ballot paper shown is illustrative.' }));
}
