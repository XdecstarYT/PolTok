// Reel (teaser) — "Coming soon to PolTok: PolTok Gaming. Games, ready to play, free." QUORUM (poltok.netlify.app/play)
// is the existing original PolTok game; Calderra and its parties are fictional.

export async function data() { return {}; }

export const meta = {
  title: 'PolTok Gaming',
  label: 'COMING SOON',
  out: 'poltok-gaming-coming-soon',
  cover: 2.4,
  music: { prog: ['Em', 'C', 'G', 'D'], arp: 'up', seed: 431, swing: 0.02 },
};

export const scenes = () => [
  { id: 'hook', beats: 5, energy: 3, voLead: 0.06, say: 'Coming soon, to PolTok.', cap: 'Coming soon to PolTok 👀' },
  { id: 'reveal', beats: 6, energy: 3, trans: { type: 'flash', dur: 0.3 }, say: 'PolTok Gaming.', cap: 'PolTok Gaming 🎮' },
  { id: 'free', beats: 8, energy: 3, trans: { type: 'whip', dir: 'left', dur: 0.36 },
    say: 'Political games, ready to play. Free. Right in your browser.', cap: 'Games ready to play. Free. In your browser.' },
  { id: 'quorum', beats: 9, energy: 2, trans: { type: 'whip', dir: 'up', dur: 0.36 },
    say: 'Starting with Quorum. Found a party, whip the votes, and run a country.', cap: 'First up: QUORUM. Found a party. Whip the votes.' },
  { id: 'ask', beats: 8, energy: 2, trans: { type: 'zoom', dur: 0.45 },
    say: 'So, what game should we make next? Comment it.', cap: 'What game should we make next? 👇' },
  { id: 'end', beats: 6, energy: 0, trans: { type: 'zoom', dur: 0.5 }, noProgress: true },
];

export function build({ E, kit, ui, THREE, endCard, real }) {
  const { ease, remap } = E;
  const N = 88;
  const NEON = [0xc8f04a, 0x4ad8f0, 0xf04ac8, 0xffb13b];
  const hall = (S, o = {}) => {
    real.room(S, { carpet: 0x1c1f2a, wood: 0x2a2230, width: 30, depth: 26, height: 10, key: o.key ?? 120 });
    const ch = real.chamber(N, { rows: 5, r0: 3.4, r1: 7.6, leather: 0x1a1d2a, wood: 0x3a2a3a, open: 0.6 });
    S.scene.add(ch.group); return ch;
  };
  // seats light in a chase pattern, like an arcade marquee
  const chase = (ch, lt, speed = 10, k = 1) => { for (let i = 0; i < N; i++) { const ph = (i - lt * speed) / 6; const on = ((Math.floor(ph) % 2) + 2) % 2 === 0; ch.set(i, NEON[((Math.floor(i / 11) % 4) + 4) % 4], k * (on ? 1.4 : 0.15)); } ch.commit(); };
  const LOW = [{ t: 0, pos: [0, 2.6, 7], look: [0, 1, -5], fov: 36 }, { t: 6, pos: [0, 3.4, 9], look: [0, 0.8, -4], fov: 36 }];
  const TOP = [{ t: 0, pos: [0, 12, 13.5], look: [0, 0, -2.5], fov: 44 }, { t: 6, pos: [0, 11, 12.5], look: [0, 0.3, -2.8], fov: 44 }];

  E.defineScene('hook', (S) => {
    const ch = hall(S, { key: 60 });
    E.camPath(S, [{ t: 0, pos: [0, 1.8, 4.5], look: [0, 1.2, -5], fov: 36 }, { t: 4, pos: [0, 2.6, 7], look: [0, 1, -5], fov: 36 }], { shake: 0.02, shiftY: 200, focusOn: true });
    S.aperture = 0.35;
    S.update((lt) => { const k = ease.inOut(remap(lt, 0.2, 2.2)); for (let i = 0; i < N; i++) ch.set(i, 0xc8f04a, (i / N) < k ? 0.6 : 0.05); ch.commit(); });
    ui.kicker(S, { t0: 0.1, text: 'Something new', y: 372 });
    ui.headline(S, { t0: 0.1, html: 'Coming soon <em>to PolTok</em>', y: 410, size: 104, style: 'slam', stagger: 0.05 });
  });

  E.defineScene('reveal', (S) => {
    const ch = hall(S, { key: 160 });
    E.camPath(S, TOP, { shake: 0.03, shiftY: 300, focusOn: true });
    S.aperture = 0.1;
    E.cue(S.t0 + 0.05, 'boom', { g: 1.0 });
    S.update((lt) => chase(ch, lt, 14));
    ui.kicker(S, { t0: 0.02, text: 'Introducing', y: 372 });
    ui.headline(S, { t0: 0.05, html: 'PolTok <em>Gaming</em> 🎮', y: 410, size: 128, style: 'slam', stagger: 0.03 });
  });

  E.defineScene('free', (S) => {
    const ch = hall(S, { key: 140 });
    E.camPath(S, [{ t: 0, pos: [-6, 6.5, 9], look: [0, 0.4, -3], fov: 40 }, { t: 6, pos: [-4.5, 7.2, 10.2], look: [0, 0.4, -3], fov: 40 }], { shake: 0.02, shiftY: 300, focusOn: true });
    S.aperture = 0.2;
    [0.5, 1.6, 2.6].forEach((t, j) => E.cue(S.t0 + t, 'pop', { i: j }));
    S.update((lt) => chase(ch, lt, 8, 0.8));
    ui.kicker(S, { t0: 0.02, text: 'PolTok Gaming', y: 372 });
    ui.list(S, { t0: 0.4, stagger: 1.0, y: 420, w: 900, size: 58, mark: '✓', markColor: '#c8f04a', items: ['Political games', 'Ready to play', '<b>100% free</b>', 'Right in your browser'] });
  });

  E.defineScene('quorum', (S) => {
    const ch = hall(S, { key: 180 });
    E.camPath(S, [{ t: 0, pos: [6, 6.5, 9], look: [0, 0.4, -3], fov: 40 }, { t: 6, pos: [4.5, 7.2, 10.2], look: [0, 0.4, -3], fov: 40 }], { shake: 0.02, shiftY: 300, focusOn: true });
    S.aperture = 0.2;
    // 37 of 72-style majority: light seats one by one past the halfway line
    S.update((lt) => { const k = ease.inOut(remap(lt, 0.8, 4.0)); for (let i = 0; i < N; i++) ch.set(i, (i / N) < k ? 0xc8f04a : 0x3a3a4a, (i / N) < k ? 1.2 : 0.15); ch.commit(); });
    E.cue(S.t0 + 4.0, 'ding');
    ui.kicker(S, { t0: 0.02, text: 'First up', y: 372 });
    ui.headline(S, { t0: 0.05, html: '<em>QUORUM</em>', y: 410, size: 140, style: 'slam', stagger: 0.04 });
    ui.list(S, { t0: 0.8, stagger: 1.1, y: 620, w: 900, size: 44, mark: '→', items: ['Found your party', 'Whip the votes', 'Run a country'] });
  });

  E.defineScene('ask', (S) => {
    const ch = hall(S, { key: 120 });
    E.camPath(S, LOW, { shake: 0.02, shiftY: 200, focusOn: true });
    S.aperture = 0.35;
    S.update((lt) => chase(ch, lt, 6, 0.9));
    ui.kicker(S, { t0: 0.05, text: 'You decide', y: 372 });
    ui.headline(S, { t0: 0.1, html: 'What game should we <em>make next?</em>', y: 410, size: 92, style: 'rise' });
    ui.block(S, { t0: 0.9, html: '<b>Comment your idea</b> 👇 &nbsp;Follow so you don\'t miss the launch', cls: 'body', y: 680, w: 920, size: 40 });
  });

  E.defineScene('end', (S) => endCard(S, { title: 'PolTok <em>Gaming</em>', sub: 'poltok.netlify.app/play', sources: 'Coming soon. Free to play in your browser.<br>QUORUM is an original PolTok game; Calderra and its parties are fictional.' }));
}
