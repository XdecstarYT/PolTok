// Reel — US 2026: the races still too close to call, pulled LIVE from PolTok's results feed at render time
// (vote counts via the NYT provider). Only races the feed marks as not yet called; sorted by raw vote gap.
import { COL, CSS, ballotStacks } from './_lib-us.js';

export async function data() {
  const L = await import('./_lib-us.js');
  const j = await L.snapshot();
  const open = j.results.filter((r) => r.status !== 'called' && !r.calledFor).map((r) => {
    const st = L.standings(r);
    return { id: r.raceId, label: L.raceLabel(r.raceId), lead: st[0], trail: st[1], gap: st[0].gap, total: st[0].total, expected: r.expectedPct ?? null };
  }).filter((x) => x.lead && x.trail).sort((a, b) => a.gap - b.gap);
  if (!open.length) throw new Error('every race is called: nothing too close to call');
  return { open: open.slice(0, 5), count: open.length, asOf: L.asOfLabel(j), sayVotes: open.slice(0, 5).map((o) => L.sayVotes(o.gap)) };
}

export const meta = {
  title: 'Still too close to call',
  label: 'LIVE · UNCALLED',
  labelCls: 'warn',
  out: 'poltok-us-too-close',
  cover: 1.6,
  music: { prog: ['Em', 'C', 'D', 'B'], arp: 'up', seed: 64, swing: 0.02 },
};

const last = (n) => n.split(' ').filter((w) => !/^(I|II|III|IV|Jr\.?|Sr\.?)$/.test(w)).at(-1);

export const scenes = (d) => {
  const t = d.open[0], more = d.open.slice(1, 3);
  return [
    { id: 'hook', beats: 8, energy: 3, voLead: 0.08,
      say: `${t.gap < 1000 ? t.gap.toLocaleString('en-US') + ' votes' : d.sayVotes[0]}. That's all that's separating this race.` },
    { id: 'top', beats: 12, energy: 3, trans: { type: 'flash', dur: 0.36 },
      say: `${t.label}. ${t.lead.name} is ahead of ${t.trail.name}, out of more than ${Math.floor(t.total / 1000)} thousand votes.`,
      cap: `${t.label}: ${t.lead.name} leads ${t.trail.name} by ${t.gap.toLocaleString('en-US')} votes.` },
    ...(more.length ? [{ id: 'more', beats: 12, energy: 2, trans: { type: 'whip', dir: 'left', dur: 0.42 },
      say: `And it's not the only one. ${more.map((m, i) => `${i === more.length - 1 && more.length > 1 ? 'And ' : ''}${m.label}, ${d.sayVotes[i + 1]}.`).join(' ')}`,
      cap: `Also too close: ${more.map((m) => `${m.label} (${m.gap.toLocaleString('en-US')})`).join(', ')}.` }] : []),
    { id: 'ask', beats: 10, energy: 2, trans: { type: 'zoom', dur: 0.45 },
      say: `Who do you reckon takes ${t.label.replace(/'s /, "'s ")}? Comment, and follow so you see the result.`,
      cap: 'Who wins it? Comment 👇 and follow for the result.' },
    { id: 'end', beats: 6, energy: 0, trans: { type: 'zoom', dur: 0.5 }, noProgress: true },
  ];
};

export function build({ E, kit, ui, THREE, endCard, real }) {
  const { C, ease, remap } = E;
  const d = E.data;
  const t = d.open[0];
  const pc = (p) => COL[p] ?? COL.I, pcss = (p) => CSS[p] ?? CSS.I;

  E.defineScene('hook', (S) => {
    const st = ballotStacks(S, { real, THREE }, t.lead.pct, t.trail.pct, pc(t.lead.party), pc(t.trail.party));
    E.camPath(S, [{ t: 0, pos: [0, 4.6, 7.6], look: [0, 1.25, 0], fov: 30 }, { t: S.dur + 0.4, pos: [0.5, 5.6, 9.2], look: [0, 1.2, 0], fov: 30 }], { shake: 0.02, shiftY: 300, focusOn: true });
    S.aperture = 0.4;
    E.cue(S.t0 + 0.3, 'boom', { g: 0.7 });
    S.update((lt) => st.update(ease.expo(remap(lt, 0.0, 1.2))));
    ui.kicker(S, { t0: 0, text: 'Still too close to call', y: 372 });
    ui.headline(S, { t0: 0, html: `<em>${t.gap.toLocaleString('en-US')}</em> votes`, y: 410, size: 130, style: 'slam', stagger: 0.04, t1: S.dur + 1 });
    ui.block(S, { t0: 0.35, html: `That's the gap in <b>${t.label}</b>. Out of ${t.total.toLocaleString('en-US')}.`, cls: 'body', y: 600, w: 920, size: 48, t1: S.dur + 1 });
  });

  E.defineScene('top', (S) => {
    const st = ballotStacks(S, { real, THREE }, t.lead.pct, t.trail.pct, pc(t.lead.party), pc(t.trail.party), { key: 150 });
    E.camPath(S, [{ t: 0, pos: [0, 6.0, 9.5], look: [0, 1.2, 0], fov: 30 }, { t: S.dur, pos: [0.8, 5.2, 8.4], look: [0, 1.25, 0], fov: 30 }], { shake: 0.015, shiftY: 330, focusOn: true });
    S.aperture = 0.35;
    S.update(() => st.update(1));
    ui.kicker(S, { t0: 0.05, text: t.label, y: 372 });
    ui.block(S, { t0: 0.2, html: `<b style="color:${pcss(t.lead.party)}">${t.lead.name}</b> <span style="opacity:.7">(${t.lead.party})</span> ${t.lead.pct.toFixed(2)}%`, cls: 'body', y: 430, size: 52, style: 'left' });
    ui.block(S, { t0: 0.5, html: `<b style="color:${pcss(t.trail.party)}">${t.trail.name}</b> <span style="opacity:.7">(${t.trail.party})</span> ${t.trail.pct.toFixed(2)}%`, cls: 'body', y: 510, size: 52, style: 'left' });
    ui.counter(S, { t0: 0.9, dur: 1.2, to: t.gap, comma: true, y: 600, size: 170, color: '#c8f04a', label: 'votes apart' + (t.expected ? ` · ~${Math.round(t.expected)}% of the expected vote in` : '') });
    ui.tag3d(S, { at: new THREE.Vector3(-0.85, 1.85, 0.9), html: last(t.lead.name), cls: 'chip', t0: 1.2 });
    ui.tag3d(S, { at: new THREE.Vector3(0.85, 1.85, 0.9), html: last(t.trail.name), cls: 'chip', t0: 1.2 });
  });

  if (d.open.length > 1) E.defineScene('more', (S) => {
    real.room(S, { carpet: 0x1f2a44, wood: 0x4e3320, width: 16, depth: 14, height: 7, key: 110, area: 3, fill: 0.3 });
    const desk = new THREE.Mesh(new THREE.BoxGeometry(6, 0.16, 3.4), real.pbr(real.tex.wood(0x5c3a20), { repeat: [2, 1], clearcoat: 0.7, clearcoatRoughness: 0.2 }));
    desk.position.set(0, 1.0, 0); desk.receiveShadow = true; S.scene.add(desk);
    const sheets = [];
    for (let i = 0; i < 9; i++) {
      const sh = real.sheet(0.75, 1.0, (c, w) => { c.fillStyle = 'rgba(30,30,30,.6)'; c.font = '700 54px "Inter Tight"'; c.fillText('PROVISIONAL', 60, 120); c.fillStyle = 'rgba(30,30,30,.25)'; for (let l = 0; l < 7; l++) c.fillRect(60, 190 + l * 70, w - 120 - (l % 3) * 90, 18); });
      sh.rotation.x = -Math.PI / 2; sh.rotation.z = (i - 4) * 0.12;
      sh.position.set((i - 4) * 0.42, 1.09 + i * 0.004, Math.sin(i * 1.7) * 0.25);
      S.scene.add(sh); sheets.push(sh);
    }
    E.camPath(S, [{ t: 0, pos: [0, 5.4, 6.5], look: [0, 1.1, 0], fov: 32 }, { t: S.dur, pos: [0.4, 4.4, 5.2], look: [0, 1.1, 0], fov: 32 }], { shake: 0.012, shiftY: 330, focusOn: true });
    S.aperture = 0.5;
    S.update((lt) => sheets.forEach((sh, i) => { const k = ease.expo(remap(lt, 0.2 + i * 0.1, 0.7 + i * 0.1)); sh.position.y = 1.09 + i * 0.004 + (1 - k) * 2.5; sh.visible = k > 0.01; }));
    const more = d.open.slice(1, 3);
    more.forEach((_, j) => E.cue(S.t0 + 0.5 + j * 0.5, 'pop', { i: j }));
    ui.kicker(S, { t0: 0.05, text: `${d.count} races still uncalled`, y: 372 });
    ui.list(S, {
      t0: 0.5, stagger: 0.5, y: 440, size: 44, mark: '●', markColor: '#c8f04a',
      items: more.map((m) => `<b>${m.label}</b><br><span style="color:${pcss(m.lead.party)}">${last(m.lead.name)}</span> <span style="opacity:.7">leads by</span> <b style="color:#c8f04a">${m.gap.toLocaleString('en-US')}</b>`),
    });
  });

  E.defineScene('ask', (S) => {
    const st = ballotStacks(S, { real, THREE }, t.lead.pct, t.trail.pct, pc(t.lead.party), pc(t.trail.party), { key: 120 });
    E.camPath(S, [{ t: 0, pos: [-2.5, 4.2, 6.5], look: [0, 1.3, 0], fov: 32 }, { t: S.dur, pos: [2.5, 4.6, 7.2], look: [0, 1.3, 0], fov: 32 }], { shake: 0.015, shiftY: 330, focusOn: true });
    S.aperture = 0.45;
    S.update(() => st.update(1));
    ui.kicker(S, { t0: 0.05, text: 'Your call', y: 372 });
    ui.headline(S, { t0: 0.1, html: `${last(t.lead.name)} or <em>${last(t.trail.name)}?</em>`, y: 410, size: 100, style: 'rise' });
    ui.block(S, { t0: 0.9, html: `<b style="color:#c8f04a">Comment</b> who takes ${t.label} 👇`, cls: 'body', y: 640, w: 920, size: 46 });
    ui.block(S, { t0: 1.6, html: '<b>Follow</b> so you see the result', cls: 'body', y: 760, w: 920, size: 42 });
  });

  E.defineScene('end', (S) => endCard(S, { title: 'Every race, <em>live</em>', sub: 'poltok.netlify.app', sources: `Live counts (NYT/AP) via PolTok, ${d.asOf}.<br>Not called yet. Numbers will change.` }));
}
