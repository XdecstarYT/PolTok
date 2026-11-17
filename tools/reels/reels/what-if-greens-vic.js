// Reel (what if) — "What if the Greens won Victoria?" Every promise is the Greens' own, per the ABC News Victorian
// election policy tracker (4 Nov 2026). Leader Ellen Sandell; aim to "replace Labor"; targeting six inner-city Labor seats
// (The Conversation, Nov 2026). 2022: 4 seats (VEC). Polling: live average of the latest 4 Victorian polls. The middle
// section is labelled IMAGINED.

export async function data() {
  const { data: vic } = await import('./vic-what-if.js');
  const v = await vic();
  return { grn: v.avg.GRN, days: v.days };
}

export const meta = {
  title: 'What if the Greens won Victoria?',
  label: 'WHAT IF · VIC 2026',
  out: 'poltok-what-if-greens-vic',
  cover: 1.4,
  music: { prog: ['Em', 'C', 'G', 'D'], arp: 'updown', seed: 449, swing: 0.05 },
};

const R = Math.round;
export const scenes = (d) => [
  { id: 'hook', beats: 6, energy: 3, voLead: 0.08, say: 'What if the Greens won Victoria?', cap: 'What if the Greens won Victoria? 🟢' },
  { id: 'real', beats: 11, energy: 2, trans: { type: 'zoom', dur: 0.45 },
    say: `Right now they hold four seats, and they're polling around ${R(d.grn)} percent. But leader Ellen Sandell says the goal is to replace Labor.`,
    cap: `Now: 4 seats · polling ~${R(d.grn)}% · aim: "replace Labor"` },
  { id: 'free', beats: 10, energy: 3, trans: { type: 'whip', dir: 'left', dur: 0.4 },
    say: 'So imagine it. Public transport is free. Permanently. And dental care is free, for every Victorian.',
    cap: 'IMAGINED: free public transport, free dental for all.' },
  { id: 'rent', beats: 10, energy: 3, trans: { type: 'whip', dir: 'right', dur: 0.4 },
    say: 'Rents are frozen for the first two years of every new lease. And stamp duty is scrapped on homes under one point one million.',
    cap: 'IMAGINED: 2-year rent freeze on new leases, no stamp duty under $1.1m.' },
  { id: 'roads', beats: 10, energy: 3, trans: { type: 'whip', dir: 'left', dur: 0.4 },
    say: 'Speed limits drop to thirty on residential streets. And [rego](/ɹˈɛʤoʊ/) doubles for vehicles with bonnets wider than a hundred and twenty centimetres.',
    cap: 'IMAGINED: 30km/h residential streets, double rego for bonnets over 120cm.' },
  { id: 'wild', beats: 9, energy: 3, trans: { type: 'flash', dur: 0.32 },
    say: 'Cannabis is legalised. And a four-day work week gets a trial.', cap: 'IMAGINED: legal cannabis, four-day week trial.' },
  { id: 'pay', beats: 10, energy: 2, trans: { type: 'whip', dir: 'up', dur: 0.4 },
    say: 'Who pays? A levy on the big five banks. And a new tax on investors with over five million dollars in property.',
    cap: 'Paid for by: a big-bank levy + tax on investors with $5m+ in property.' },
  { id: 'ask', beats: 8, energy: 2, trans: { type: 'zoom', dur: 0.45 },
    say: 'So, would Victoria be better, or worse? Tell me in the comments.', cap: 'Better or worse? Comment 👇' },
  { id: 'end', beats: 6, energy: 0, trans: { type: 'zoom', dur: 0.5 }, noProgress: true },
];

export function build({ E, kit, ui, THREE, endCard, real }) {
  const { ease, remap } = E;
  const d = E.data;
  const GRN = 0x2fa84f, GC = '#5fd17f';
  const N = 88;
  const hall = (S, o = {}) => {
    real.room(S, { carpet: 0x2d4a33, wood: 0x5a361d, width: 30, depth: 26, height: 10, key: o.key ?? 260 });
    const ch = real.chamber(N, { rows: 5, r0: 3.4, r1: 7.6, leather: 0x1f5a38, wood: 0x6a3d1f, open: 0.6 });
    S.scene.add(ch.group); return ch;
  };
  const LOW = [{ t: 0, pos: [0, 2.6, 7], look: [0, 1, -5], fov: 36 }, { t: 6, pos: [0, 3.4, 9], look: [0, 0.8, -4], fov: 36 }];
  const TOP = [{ t: 0, pos: [0, 12, 13.5], look: [0, 0, -2.5], fov: 44 }, { t: 6, pos: [0, 11, 12.5], look: [0, 0.3, -2.8], fov: 44 }];
  const SIDE = (s) => [{ t: 0, pos: [6 * s, 6.5, 9], look: [0, 0.4, -3], fov: 40 }, { t: 6, pos: [4.5 * s, 7.2, 10.2], look: [0, 0.4, -3], fov: 40 }];
  // green wave filling the chamber up to n seats
  const greens = (ch, lt, n, t0 = 0.2, dur = 1.6) => { const k = ease.inOut(remap(lt, t0, t0 + dur)); for (let i = 0; i < N; i++) { const on = i < n * k; ch.set(i, on ? GRN : 0xffe2b0, on ? 1.0 + 0.3 * Math.sin(lt * 4 + i * 0.3) : 0.18); } ch.commit(); };

  const scene = (id, o) => E.defineScene(id, (S) => {
    const ch = hall(S, { key: o.key });
    E.camPath(S, o.cam, { shake: 0.02, shiftY: o.shiftY ?? 300, focusOn: true });
    S.aperture = o.ap ?? 0.2;
    if (o.cue) E.cue(S.t0 + o.cue[0], o.cue[1], { g: 0.7 });
    S.update((lt) => greens(ch, lt, o.seats ?? 45, o.t0 ?? 0.2));
    ui.kicker(S, { t0: 0.04, text: o.kicker, y: 372 });
    if (o.head) ui.headline(S, { t0: 0.08, html: o.head, y: 410, size: o.size ?? 92, style: o.style ?? 'rise' });
    if (o.items) ui.list(S, { t0: 0.6, stagger: o.stagger ?? 1.8, y: o.listY ?? 560, w: 920, size: 44, mark: '→', markColor: GC, items: o.items });
  });

  scene('hook', { cam: LOW, shiftY: 200, ap: 0.3, seats: 88, t0: 0.4, dur: 2, kicker: 'What if', head: 'The Greens <em>won Victoria?</em>', size: 104, style: 'slam', cue: [0.2, 'boom'] });
  E.defineScene('real', (S) => {
    const ch = hall(S);
    E.camPath(S, TOP, { shake: 0.015, shiftY: 300, focusOn: true });
    S.aperture = 0.1;
    S.update((lt) => greens(ch, lt, 4, 0.3, 0.6));
    ui.kicker(S, { t0: 0.05, text: 'Reality · right now', y: 372 });
    ui.counter(S, { t0: 0.3, dur: 0.8, to: 4, y: 400, x: 80, w: 440, size: 130, color: GC, label: 'Seats held (2022)' });
    ui.counter(S, { t0: 0.6, dur: 1.2, to: d.grn, decimals: 1, suffix: '%', y: 400, x: 540, w: 460, size: 130, align: 'right', color: GC, label: 'Polling (avg)', ticks: false });
    ui.block(S, { t0: 3.6, html: `Leader Ellen Sandell: the aim is to <b style="color:${GC}">"replace Labor"</b>`, cls: 'body', y: 640, w: 920, size: 42 });
  });
  scene('free', { cam: SIDE(-1), kicker: 'IMAGINED · Greens government', head: 'Free <em>everything?</em>', items: ['🚆 Public transport: free, permanently', '🦷 Dental care: free for all Victorians'], cue: [0.15, 'boom'] });
  scene('rent', { cam: SIDE(1), kicker: 'IMAGINED · Housing', head: 'Rents <em>frozen</em>', items: ['🏠 2-year freeze on every new lease', '💸 No stamp duty under $1.1m'] });
  scene('roads', { cam: SIDE(-1), kicker: 'IMAGINED · Roads', head: 'Slow <em>down</em>', items: ['🚸 30 km/h on residential streets', '🛻 Double rego: bonnets wider than 120cm'] });
  scene('wild', { cam: LOW, shiftY: 200, ap: 0.3, kicker: 'IMAGINED · Also', head: 'Legal cannabis. <em>4-day week.</em>', items: ['🌿 Cannabis legalised', '📅 Four-day work week trial'], stagger: 1.4, cue: [0.1, 'boom'] });
  scene('pay', { cam: TOP, ap: 0.1, kicker: 'Who pays?', head: 'Tax the <em>top</em>', items: ['🏦 A levy on the big five banks', '🏘️ Tax on investors with $5m+ in property'] });
  scene('ask', { cam: LOW, shiftY: 200, ap: 0.35, seats: 88, t0: 0, dur: 1, kicker: 'Your call', head: 'Better, or <em>worse?</em>', size: 110, items: [`Comment <b>BETTER</b> or <b>WORSE</b> 👇`], listY: 640 });

  E.defineScene('end', (S) => endCard(S, { title: 'Election night, <em>live</em>', sub: 'poltok.netlify.app/au/victoria', sources: 'Greens promises: ABC News Victorian election policy tracker (4 Nov 2026). Sandell quote: The Conversation (Nov 2026). Seats: VEC 2022. Polling: latest 4 Victorian polls, at render.<br>"Imagined" scenes are a scenario, not a forecast.' }));
}
