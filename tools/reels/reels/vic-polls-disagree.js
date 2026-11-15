// Reel (viral) — "4 polls, 4 different answers: who's really winning Victoria?" The latest four Victorian primary-vote
// polls, live from Wikipedia via vic-what-if.js, shown side by side as 3D bars; then what they agree on, and the spread.

export async function data() {
  const { data: vic } = await import('./vic-what-if.js');
  const v = await vic();
  const K = ['LNP', 'ONP', 'ALP', 'GRN'];
  const range = Object.fromEntries(K.map((k) => [k, [Math.min(...v.polls.map((p) => p[k])), Math.max(...v.polls.map((p) => p[k]))]]));
  const lnpLeads = v.polls.filter((p) => K.every((k) => k === 'LNP' || p.LNP > p[k])).length;
  const onpOverAlp = v.polls.filter((p) => p.ONP > p.ALP).length;
  return { polls: v.polls, avg: v.avg, days: v.days, range, lnpLeads, onpOverAlp };
}

export const meta = {
  title: 'Four polls, four answers',
  label: 'VIC 2026 · POLL CHECK',
  out: 'poltok-vic-polls-disagree',
  cover: 1.3,
  music: { prog: ['Cm', 'Ab', 'Eb', 'Bb'], arp: 'updown', seed: 397, swing: 0.04 },
};

const firm = (f) => f.split('/')[0].trim();
const sayFirm = (f) => firm(f).replace('DemosAU', 'Demos A U').replace('RedBridge', 'Red Bridge');
const W = ['zero', 'one', 'two', 'three', 'four'];

export const scenes = (d) => [
  { id: 'hook', beats: 6, energy: 3, voLead: 0.06, say: `Victoria votes in ${d.days} days, and the polls don't agree. Here are the last four.`,
    cap: `${d.days} days out. 4 polls, 4 different answers.` },
  ...d.polls.map((p, i) => ({ id: 'p' + i, beats: 8, energy: i % 2 ? 2 : 3, trans: { type: i % 2 ? 'whip' : 'flash', dir: 'left', dur: 0.38 },
    say: `${sayFirm(p.firm)}. Coalition ${p.LNP}. One Nation ${p.ONP}. Labor ${p.ALP}. Greens ${p.GRN}.`,
    cap: `${firm(p.firm)} (${p.date}): LNP ${p.LNP} · ONP ${p.ONP} · ALP ${p.ALP} · GRN ${p.GRN}` })),
  { id: 'agree', beats: 10, energy: 2, trans: { type: 'zoom', dur: 0.45 },
    say: `What they agree on: the Coalition leads in ${d.lnpLeads === 4 ? 'all four' : W[d.lnpLeads]}. And One Nation's ahead of Labor in ${d.onpOverAlp === 4 ? 'all four' : W[d.onpOverAlp]}.`,
    cap: `Coalition leads in ${d.lnpLeads}/4. One Nation ahead of Labor in ${d.onpOverAlp}/4.` },
  { id: 'spread', beats: 9, energy: 2, trans: { type: 'whip', dir: 'up', dur: 0.42 },
    say: `But Labor's anywhere from ${d.range.ALP[0]} to ${d.range.ALP[1]}. That's a ${d.range.ALP[1]-d.range.ALP[0]} point gap, between the best poll and the worst poll.`,
    cap: `Labor's range: ${d.range.ALP[0]}–${d.range.ALP[1]}%.` },
  { id: 'ask', beats: 8, energy: 2, trans: { type: 'zoom', dur: 0.45 },
    say: 'So, who wins on the twenty-eighth? Comment your prediction.', cap: 'Who wins on 28 Nov? Comment 👇' },
  { id: 'end', beats: 6, energy: 0, trans: { type: 'zoom', dur: 0.5 }, noProgress: true },
];

export function build({ E, kit, ui, THREE, endCard, real }) {
  const { ease, remap, lerp } = E;
  const d = E.data;
  const K = ['LNP', 'ONP', 'ALP', 'GRN'];
  const COL = { ALP: 0xe53935, LNP: 0x1f5fd1, ONP: 0xd9480f, GRN: 0x2fa84f };
  const CSS = { ALP: '#ff6b6b', LNP: '#6ea2ff', ONP: '#ff9a4a', GRN: '#5fd17f' };
  const SH = { ALP: 'Labor', LNP: 'Coalition', ONP: 'One Nation', GRN: 'Greens' };
  const SC = 0.03; // metres per percentage point

  // a desk with four glossy bars (Coalition, One Nation, Labor, Greens)
  const bars = (S, o = {}) => {
    real.room(S, { carpet: 0x2b2420, wood: 0x4e3320, width: 16, depth: 14, height: 7, key: (o.key ?? 110) * 0.3, area: 2.4, fill: 0.22 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(6, 0.16, 3.4), real.pbr(real.tex.wood(0x5c3a20), { repeat: [2, 1], clearcoat: 0.7, clearcoatRoughness: 0.2 }));
    top.position.set(0, 1.0, 0); top.receiveShadow = true; top.castShadow = true; S.scene.add(top);
    const ms = K.map((k, i) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.36, 1, 0.36), new THREE.MeshPhysicalMaterial({ color: COL[k], roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 }));
      m.position.set(-0.72 + i * 0.48, 1.08, 0); m.castShadow = true; m.receiveShadow = true; S.scene.add(m); return m;
    });
    E.camPath(S, o.cam ?? [{ t: 0, pos: [0, 2.6, 5.4], look: [0, 1.4, 0], fov: 36 }, { t: 6, pos: [0.25, 2.55, 5.0], look: [0, 1.4, 0], fov: 36 }], { shake: 0.012, shiftY: 280, focusOn: true });
    S.aperture = 0.3;
    const set = (vals) => ms.forEach((m, i) => { const h = Math.max(0.01, vals[i] * SC); m.scale.y = h; m.position.y = 1.08 + h / 2; });
    return { set };
  };
  const val = (p) => K.map((k) => p[k]);

  E.defineScene('hook', (S) => {
    const b = bars(S, { cam: [{ t: 0, pos: [0, 1.9, 2.8], look: [0, 1.5, 0], fov: 36 }, { t: 4, pos: [0.2, 2.5, 4.4], look: [0, 1.45, 0], fov: 36 }] });
    E.cue(S.t0 + 0.3, 'boom', { g: 0.9 });
    S.update((lt) => { const n = d.polls.length; const f = (lt * 1.6) % n; const i0 = Math.floor(f), i1 = (i0 + 1) % n; const k = ease.inOut(f - i0); b.set(val(d.polls[i0]).map((v, j) => lerp(v, val(d.polls[i1])[j], k))); });
    ui.kicker(S, { t0: 0, text: `Victoria votes in ${d.days} days`, y: 372 });
    ui.headline(S, { t0: 0, html: '4 polls. <em>4 answers.</em>', y: 410, size: 110, style: 'slam', stagger: 0.04, t1: S.dur + 1 });
  });

  d.polls.forEach((p, i) => E.defineScene('p' + i, (S) => {
    const b = bars(S, { key: 110 + i * 8 });
    const prev = i ? d.polls[i - 1] : d.avg;
    S.update((lt) => { const k = ease.expo(remap(lt, 0.2, 1.2)); b.set(val(prev).map((v, j) => lerp(v, val(p)[j], k))); });
    ui.kicker(S, { t0: 0.02, text: `Poll ${i + 1} of ${d.polls.length} · ${p.date}`, y: 372 });
    ui.headline(S, { t0: 0.06, html: firm(p.firm), y: 410, size: 84, style: 'rise' });
    ui.list(S, { t0: 0.4, stagger: 0.55, y: 540, w: 900, size: 44, mark: '●', items: K.map((k) => `<b style="color:${CSS[k]}">${SH[k]}</b>&nbsp; ${p[k]}%`) });
  }));

  E.defineScene('agree', (S) => {
    const b = bars(S, { key: 130 });
    S.update(() => b.set(val(d.avg)));
    E.cue(S.t0 + 0.5, 'ding');
    ui.kicker(S, { t0: 0.05, text: 'What they agree on', y: 372 });
    ui.list(S, { t0: 0.3, stagger: 1.9, y: 420, w: 920, size: 44, mark: '✓', markColor: '#c8f04a', items: [
      `<b style="color:${CSS.LNP}">Coalition</b> leads in ${d.lnpLeads}/4`, `<b style="color:${CSS.ONP}">One Nation</b> ahead of <b style="color:${CSS.ALP}">Labor</b> in ${d.onpOverAlp}/4`] });
  });

  E.defineScene('spread', (S) => {
    const b = bars(S, { key: 120 });
    S.update((lt) => { const k = (Math.sin(lt * 2.4) + 1) / 2; b.set(K.map((key) => lerp(d.range[key][0], d.range[key][1], k))); });
    ui.kicker(S, { t0: 0.05, text: 'The spread', y: 372 });
    ui.list(S, { t0: 0.3, stagger: 0.35, y: 420, w: 900, size: 44, mark: '↕', items: K.map((k) => `<b style="color:${CSS[k]}">${SH[k]}</b>&nbsp; ${d.range[k][0]}–${d.range[k][1]}%`) });
  });

  E.defineScene('ask', (S) => {
    const b = bars(S, { key: 120 });
    S.update(() => b.set(val(d.avg)));
    ui.kicker(S, { t0: 0.05, text: 'Your call', y: 372 });
    ui.headline(S, { t0: 0.1, html: 'Who wins on <em>the 28th?</em>', y: 410, size: 100, style: 'rise' });
    ui.block(S, { t0: 0.9, html: '<b>Comment your prediction</b> 👇', cls: 'body', y: 660, w: 920, size: 46 });
  });

  E.defineScene('end', (S) => endCard(S, { title: 'Polls, <em>live</em>', sub: 'poltok.netlify.app/au/victoria', sources: 'Latest 4 Victorian state primary-vote polls (Wikipedia: Opinion polling for the 2026 Victorian state election), at render time.<br>Bars: primary vote, % of respondents.' }));
}
