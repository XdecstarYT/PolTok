// Shared template for the Victoria 2026 single-party reels ("If <party> wins"). Every party gets the identical
// structure: hook → leader + live poll → the same six topics in the same order → question → end card.
// Promises are each party's own announced policies as listed in ABC News' policy tracker (4 Nov 2026):
// abc.net.au/news/2026-11-04/victoria-2026-election-policy-promise-tracker/107247200. Poll share: live average of the
// latest four polls on Wikipedia (same source and method as vic-what-if.js).

export const TOPICS = [
  ['cost', 'Cost of living'], ['housing', 'Housing'], ['health', 'Health'],
  ['crime', 'Crime & bail'], ['transport', 'Transport'], ['energy', 'Energy'],
];

export function make(P) {
  // P: { key:'ALP'|'LNP'|'ONP', name, short, leaderTitle, leader, color, css, carpet, leather, n, of, others:[names],
  //      say: {topic: spoken line}, card: {topic: [headline html, detail html]} }
  const data = async () => {
    const { data: vic } = await import('./vic-what-if.js');
    const d = await vic();
    return { pct: d.avg[P.key], avg: d.avg, nPolls: d.polls.length, days: d.days };
  };

  const meta = {
    title: `If ${P.short} ${P.verb || 'wins'} Victoria`,
    label: `VIC 2026 · PARTY ${P.n}/${P.of}`,
    out: `poltok-vic-if-${P.slug}-wins`,
    cover: 1.6,
    music: { prog: ['Am', 'F', 'C', 'G'], arp: 'up', seed: 140 + P.n, swing: 0.04 },
  };

  const scenes = (d) => [
    { id: 'hook', beats: 6, energy: 3, voLead: 0.08, say: `What if ${P.short} ${P.verb || 'wins'} Victoria?` },
    { id: 'leader', beats: 8, energy: 2, trans: { type: 'zoom', dur: 0.45 },
      say: `${P.leaderSay}. Polling around ${Math.round(d.pct)} percent.`,
      cap: `${P.leaderTitle} ${P.leader} · polling ${d.pct}%` },
    ...TOPICS.map(([k], i) => ({ id: k, beats: 7, energy: i % 2 ? 2 : 3, trans: { type: i % 2 ? 'whip' : 'flash', dir: i % 3 ? 'left' : 'up', dur: 0.38 },
      say: P.say[k], cap: P.capText[k] })),
    { id: 'ask', beats: 8, energy: 2, trans: { type: 'zoom', dur: 0.45 },
      say: `Would you vote for this? Yes or no, in the comments.`, cap: 'Would you vote for this? Yes or no 👇' },
    { id: 'end', beats: 6, energy: 0, trans: { type: 'zoom', dur: 0.5 }, noProgress: true },
  ];

  const build = ({ E, kit, ui, THREE, endCard, real }) => {
    const { C, ease, remap } = E;
    const d = E.data;
    const N = 88, MAJ = 45, WARM = 0xffe2b0;
    const order = Array.from({ length: N }, (_, i) => i).sort((a, b) => Math.abs(a - (N - 1) / 2) - Math.abs(b - (N - 1) / 2));
    const rank = new Array(N); order.forEach((s, j) => { rank[s] = j; });
    const hall = (S, o = {}) => {
      real.room(S, { carpet: 0x2d4a33, wood: 0x5a361d, width: 30, depth: 26, height: 10, key: o.key ?? 260 });
      const ch = real.chamber(N, { rows: 5, r0: 3.4, r1: 7.6, leather: 0x1f5a38, wood: 0x6a3d1f, open: 0.6 });
      S.scene.add(ch.group);
      return ch;
    };
    const CAMS = [
      [{ t: 0, pos: [-6, 6.5, 9], look: [0, 0.4, -3], fov: 40 }, { t: 4, pos: [-4.5, 7.2, 10.2], look: [0, 0.4, -3], fov: 40 }],
      [{ t: 0, pos: [6, 6.5, 9], look: [0, 0.4, -3], fov: 40 }, { t: 4, pos: [4.5, 7.2, 10.2], look: [0, 0.4, -3], fov: 40 }],
      [{ t: 0, pos: [0, 3.0, 7.5], look: [0, 0.8, -5], fov: 38 }, { t: 4, pos: [0, 4.2, 9.5], look: [0, 0.6, -4], fov: 38 }],
      [{ t: 0, pos: [0, 12, 13.5], look: [0, 0, -2.5], fov: 44 }, { t: 4, pos: [0, 11, 12.5], look: [0, 0.3, -2.8], fov: 44 }],
      [{ t: 0, pos: [5.5, 3.2, 3.0], look: [-1, 0.8, -5], fov: 38 }, { t: 4, pos: [3.5, 3.0, 2.0], look: [-2.5, 0.8, -5], fov: 38 }],
      [{ t: 0, pos: [-3, 2.4, 6.2], look: [0, 1, -5], fov: 36 }, { t: 4, pos: [2, 3.4, 9], look: [0, 0.8, -4], fov: 36 }],
    ];

    E.defineScene('hook', (S) => {
      const ch = hall(S);
      E.camPath(S, [{ t: 0, pos: [0, 2.2, 6.2], look: [0, 1.0, -5], fov: 36 }, { t: S.dur + 0.4, pos: [0.6, 4.0, 10], look: [0, 0.7, -3.5], fov: 36 }], { shake: 0.025, focusOn: true });
      S.aperture = 0.3;
      E.cue(S.t0 + 0.3, 'boom', { g: 0.7 });
      S.update((lt) => { for (let i = 0; i < N; i++) { const on = rank[i] < MAJ; ch.set(i, on ? P.color : WARM, on ? 1.4 * ease.back(remap(lt, 0.1 + rank[i] * 0.012, 0.4 + rank[i] * 0.012)) : 0.2); } ch.commit(); });
      ui.kicker(S, { t0: 0, text: `Victoria votes in ${d.days} days · ${P.n} of ${P.of}`, y: 372 });
      ui.headline(S, { t0: 0, html: `If <em style="color:${P.css}">${P.short}</em> ${P.verb || 'wins'}`, y: 410, size: 120, style: 'slam', stagger: 0.04, t1: S.dur + 1 });
      ui.block(S, { t0: 0.3, html: 'Their real promises, topic by topic', cls: 'body', y: 600, w: 920, size: 46, t1: S.dur + 1 });
    });

    E.defineScene('leader', (S) => {
      const ch = hall(S, { key: 240 });
      E.camPath(S, CAMS[3], { shake: 0.015, shiftY: 280, focusOn: true });
      S.aperture = 0.1;
      const seats = Math.round((d.pct / 100) * N);
      S.update((lt) => { for (let i = 0; i < N; i++) { const on = rank[i] < seats; ch.set(i, on ? P.color : WARM, (on ? 1.3 : 0.2) * ease.back(remap(lt, 0.3 + rank[i] * 0.02, 0.6 + rank[i] * 0.02))); } ch.commit(); });
      ui.kicker(S, { t0: 0.05, text: P.leaderTitle, y: 372 });
      ui.headline(S, { t0: 0.1, html: `<em>${P.leader}</em>`, y: 410, size: 100, style: 'rise' });
      ui.counter(S, { t0: 0.6, dur: 1.2, to: d.pct, decimals: 1, suffix: '%', y: 560, size: 150, color: P.css, label: `${P.name} · average of the latest ${d.nPolls} polls` });
    });

    TOPICS.forEach(([k, label], i) => E.defineScene(k, (S) => {
      const ch = hall(S, { key: 280 });
      E.camPath(S, CAMS[i % CAMS.length], { shake: 0.02, shiftY: i === 4 ? -320 : 300, focusOn: i !== 4 });
      if (i === 4) { S.aperture = 1.4; S.focus = 2.0; } else S.aperture = 0.2;
      E.cue(S.t0 + 0.25, 'pop', { i });
      S.update((lt) => { for (let j = 0; j < N; j++) { const on = rank[j] < MAJ; ch.set(j, on ? P.color : WARM, on ? 0.9 + 0.5 * Math.sin(lt * 3 + j * 0.2) : 0.2); } ch.commit(); });
      ui.kicker(S, { t0: 0.02, text: `${i + 1} / 6 · ${label}`, y: 372 });
      ui.headline(S, { t0: 0.08, html: P.card[k][0], y: 410, size: 92, style: 'slam', stagger: 0.03 });
      ui.block(S, { t0: 0.6, html: P.card[k][1], cls: 'body', y: 620, w: 920, size: 44 });
    }));

    E.defineScene('ask', (S) => {
      const ch = hall(S, { key: 220 });
      E.camPath(S, CAMS[5], { shake: 0.02, focusOn: true });
      S.aperture = 0.35;
      S.update((lt) => { for (let i = 0; i < N; i++) ch.set(i, rank[i] < MAJ ? P.color : WARM, rank[i] < MAJ ? 0.9 + 0.4 * Math.sin(lt * 4 + i * 0.3) : 0.2); ch.commit(); });
      ui.kicker(S, { t0: 0.05, text: 'Your vote', y: 372 });
      ui.headline(S, { t0: 0.1, html: 'Would you vote <em>for this?</em>', y: 410, size: 96, style: 'rise' });
      ui.block(S, { t0: 0.9, html: '<b style="color:#c8f04a">Yes</b> or <b style="color:#ff6b6b">no</b> in the comments 👇', cls: 'body', y: 640, w: 920, size: 48 });
      ui.block(S, { t0: 1.6, html: `<b>Follow</b> for the ${P.others.join(' and ')} versions`, cls: 'body', y: 760, w: 920, size: 40 });
    });

    E.defineScene('end', (S) => endCard(S, { title: 'Election night, <em>live</em>', sub: 'poltok.netlify.app/au/victoria', sources: `Promises: ${P.name}'s announced policies, per ABC News' policy tracker (4 Nov 2026).<br>Poll: average of the latest ${d.nPolls} polls on Wikipedia. Seat lighting is illustrative.` }));
  };

  return { data, meta, scenes, build };
}
