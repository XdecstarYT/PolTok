// Reel (what if) — "What if Melbourne and country Victoria were two different states?" Real 2022 results, split by the
// upper-house regions: the 5 metropolitan regions (55 districts) vs the 3 country regions (33 districts). District → region
// from src/data/au-vic.ts (VIC_REGION_OF); 2022 winners and margins from the official post-election pendulum
// (_lib-vic-swing.js; Narracan = Liberal, supplementary election Jan 2023). "Today" applies the live two-party swing
// uniformly (classic pendulum) — Labor-v-Coalition seats only; Greens seats held.

export async function data() {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../../../src/data/au-vic.ts', import.meta.url), 'utf8');
  const REG = JSON.parse(src.match(/VIC_REGION_OF[^=]*=\s*(\{[^;]*\})/s)[1]);
  const { pendulum2022, swingData } = await import('./_lib-vic-swing.js');
  const [seats, sw] = await Promise.all([pendulum2022(), swingData()]);
  const slug = (x) => 'vic-' + x.replace(/\{\{.*$/, '').trim().toLowerCase().replace(/ /g, '-');
  const z = () => ({ ALP: 0, LNP: 0, GRN: 0 });
  const then = { metro: z(), country: z() }, now = { metro: z(), country: z() };
  for (const s of seats) {
    const g = REG[slug(s.seat)];
    if (!g) throw new Error('no region for ' + s.seat);
    const k = /Metropolitan/.test(g) ? 'metro' : 'country';
    const w = s.win === 'IND' ? 'GRN' : s.win; // none in 2022; guard
    then[k][w]++;
    now[k][(s.win === 'ALP' && s.vs === 'LNP' && s.margin < sw.swing) ? 'LNP' : w]++;
  }
  const tot = (o) => o.ALP + o.LNP + o.GRN;
  if (tot(then.metro) + tot(then.country) !== 88) throw new Error('seat total');
  return { then, now, swing: sw.swing, nMetro: tot(then.metro), nCountry: tot(then.country), days: Math.round((Date.UTC(2026, 10, 28) - Date.now()) / 864e5) };
}

export const meta = {
  title: 'What if Victoria split in two?',
  label: 'WHAT IF · VIC 2026',
  out: 'poltok-what-if-victoria-split',
  cover: 1.3,
  music: { prog: ['Am', 'F', 'C', 'G'], arp: 'updown', seed: 401, swing: 0.05 },
};

const maj = (n) => Math.floor(n / 2) + 1;
const W = (n) => String(n);

export const scenes = (d) => {
  const tm = d.then.metro, tc = d.then.country, nm = d.now.metro, nc = d.now.country;
  const win = (o) => (o.ALP >= o.LNP ? ['Labor', o.ALP] : ['the Coalition', o.LNP]);
  return [
    { id: 'hook', beats: 6, energy: 3, voLead: 0.08, say: 'What if Melbourne and country Victoria were two different states?', cap: 'What if Victoria split in two? 🏙️🌾' },
    { id: 'split', beats: 10, energy: 2, trans: { type: 'zoom', dur: 0.45 },
      say: `Victoria's upper house already splits it. Five Melbourne regions, with ${d.nMetro} seats. Three country regions, with ${d.nCountry}.`,
      cap: `Melbourne: ${d.nMetro} seats · Country: ${d.nCountry} seats` },
    { id: 'metro', beats: 10, energy: 3, trans: { type: 'whip', dir: 'left', dur: 0.4 },
      say: `Using the real twenty twenty-two results, Melbourne is a Labor landslide. ${W(tm.ALP)} seats, to the Coalition's ${W(tm.LNP)}, and the Greens' ${W(tm.GRN)}.`,
      cap: `Melbourne 2022: Labor ${tm.ALP} · Coalition ${tm.LNP} · Greens ${tm.GRN}` },
    { id: 'country', beats: 10, energy: 3, trans: { type: 'whip', dir: 'right', dur: 0.4 },
      say: `Country Victoria? The Coalition wins ${W(tc.LNP)} of ${d.nCountry}. ${tc.LNP === maj(d.nCountry) ? 'Exactly the number it needs for a majority. Not one seat to spare.' : 'Labor gets ' + tc.ALP + '.'}`,
      cap: `Country 2022: Coalition ${tc.LNP} · Labor ${tc.ALP}` },
    { id: 'now', beats: 12, energy: 3, trans: { type: 'flash', dur: 0.36 },
      say: `Now add today's polls: a swing of ${d.swing} points. In country Victoria, ${win(nc)[0]} wins ${win(nc)[1]} of ${d.nCountry}. And Melbourne? ${win(nm)[0] === 'the Coalition' ? `Even Melbourne flips. The Coalition wins ${nm.LNP} of ${d.nMetro}.` : `Labor holds on, with ${nm.ALP}.`}`,
      cap: `Today's polls: Melbourne ${win(nm)[0].replace('the ', '')} ${win(nm)[1]}/${d.nMetro} · Country ${win(nc)[0].replace('the ', '')} ${win(nc)[1]}/${d.nCountry}` },
    { id: 'ask', beats: 8, energy: 2, trans: { type: 'zoom', dur: 0.45 },
      say: 'So which Victoria do you live in? Comment Melbourne, or country.', cap: 'Melbourne or country? Comment 👇' },
    { id: 'end', beats: 6, energy: 0, trans: { type: 'zoom', dur: 0.5 }, noProgress: true },
  ];
};

export function build({ E, kit, ui, THREE, endCard, real }) {
  const { ease, remap } = E;
  const d = E.data;
  const COL = { ALP: 0xe53935, LNP: 0x1f5fd1, GRN: 0x2fa84f };
  const CSS = { ALP: '#ff6b6b', LNP: '#6ea2ff', GRN: '#5fd17f' };
  const DIM = 0x8a7a66;
  const N = 88, M = d.nMetro;
  const hall = (S, o = {}) => {
    real.room(S, { carpet: 0x2d4a33, wood: 0x5a361d, width: 30, depth: 26, height: 10, key: o.key ?? 260 });
    const ch = real.chamber(N, { rows: 5, r0: 3.4, r1: 7.6, leather: 0x1f5a38, wood: 0x6a3d1f, open: 0.6 });
    S.scene.add(ch.group); return ch;
  };
  const TOP = [{ t: 0, pos: [0, 12, 13.5], look: [0, 0, -2.5], fov: 44 }, { t: 7, pos: [0, 11, 12.5], look: [0, 0.3, -2.8], fov: 44 }];
  // seat colours: metro block = first M seats (left of the chamber), country = the rest
  const fill = (o) => { const a = []; for (const k of ['ALP', 'GRN', 'LNP']) for (let i = 0; i < o[k]; i++) a.push(k); return a; };
  const paint = (ch, lt, metro, country, show = { m: 1, c: 1 }, t0 = 0.3) => {
    const k = ease.expo(remap(lt, t0, t0 + 1.4));
    for (let i = 0; i < N; i++) {
      const isM = i < M; const p = isM ? metro[i] : country[i - M]; const on = isM ? show.m : show.c;
      const lit = (i / N) < k;
      ch.set(i, on && lit ? COL[p] : DIM, on ? (lit ? 1.1 : 0.25) : 0.12);
    }
    ch.commit();
  };

  E.defineScene('hook', (S) => {
    const ch = hall(S);
    E.camPath(S, [{ t: 0, pos: [0, 2.6, 7], look: [0, 1, -5], fov: 36 }, { t: 6, pos: [0, 3.4, 9], look: [0, 0.8, -4], fov: 36 }], { shake: 0.025, shiftY: 200, focusOn: true });
    S.aperture = 0.3;
    E.cue(S.t0 + 0.2, 'boom', { g: 0.8 });
    S.update((lt) => { for (let i = 0; i < N; i++) ch.set(i, i < M ? 0xc8a46a : 0x6aa84f, 0.5 + 0.4 * Math.sin(lt * 4 + (i < M ? 0 : Math.PI))); ch.commit(); });
    ui.kicker(S, { t0: 0, text: 'What if', y: 372 });
    ui.headline(S, { t0: 0, html: 'Victoria split <em>in two?</em>', y: 410, size: 108, style: 'slam', stagger: 0.04, t1: S.dur + 1 });
    ui.block(S, { t0: 0.5, html: '🏙️ Melbourne &nbsp;vs&nbsp; 🌾 Country', cls: 'body', y: 660, w: 920, size: 48, t1: S.dur + 1 });
  });

  E.defineScene('split', (S) => {
    const ch = hall(S);
    E.camPath(S, TOP, { shake: 0.015, shiftY: 300, focusOn: true });
    S.aperture = 0.1;
    S.update((lt) => { const k = ease.expo(remap(lt, 0.4, 1.6)); for (let i = 0; i < N; i++) ch.set(i, i < M ? 0xc8a46a : 0x6aa84f, (i / N) < k ? 1.0 : 0.2); ch.commit(); });
    ui.kicker(S, { t0: 0.05, text: 'The upper-house regions', y: 372 });
    ui.counter(S, { t0: 0.4, dur: 1.2, to: d.nMetro, y: 400, x: 80, w: 440, size: 120, color: '#e8c48a', label: '5 Melbourne regions' });
    ui.counter(S, { t0: 0.6, dur: 1.2, to: d.nCountry, y: 400, x: 540, w: 460, size: 120, align: 'right', color: '#8fd16f', label: '3 country regions', ticks: false });
  });

  const tally = (S, o, n, label, t0 = 0.4) => ui.list(S, { t0, stagger: 0.5, y: 540, w: 900, size: 46, mark: '●',
    items: ['ALP', 'LNP', 'GRN'].filter((k) => o[k]).map((k) => `<b style="color:${CSS[k]}">${{ ALP: 'Labor', LNP: 'Coalition', GRN: 'Greens' }[k]}</b>&nbsp; ${o[k]}`) });

  E.defineScene('metro', (S) => {
    const ch = hall(S, { key: 280 });
    E.camPath(S, [{ t: 0, pos: [-6, 6.5, 9], look: [0, 0.4, -3], fov: 40 }, { t: 7, pos: [-4.5, 7.2, 10.2], look: [0, 0.4, -3], fov: 40 }], { shake: 0.02, shiftY: 300, focusOn: true });
    S.aperture = 0.2;
    const mf = fill(d.then.metro), cf = fill(d.then.country);
    S.update((lt) => paint(ch, lt, mf, cf, { m: 1, c: 0 }));
    ui.kicker(S, { t0: 0.05, text: '🏙️ State of Melbourne · 2022 results', y: 372 });
    ui.headline(S, { t0: 0.1, html: `Labor <em>landslide</em>`, y: 410, size: 96, style: 'rise' });
    tally(S, d.then.metro, M);
    ui.block(S, { t0: 1.6, html: `Majority: ${maj(M)} of ${M}`, cls: 'body', y: 780, size: 34 });
  });

  E.defineScene('country', (S) => {
    const ch = hall(S, { key: 280 });
    E.camPath(S, [{ t: 0, pos: [6, 6.5, 9], look: [0, 0.4, -3], fov: 40 }, { t: 7, pos: [4.5, 7.2, 10.2], look: [0, 0.4, -3], fov: 40 }], { shake: 0.02, shiftY: 300, focusOn: true });
    S.aperture = 0.2;
    const mf = fill(d.then.metro), cf = fill(d.then.country);
    S.update((lt) => paint(ch, lt, mf, cf, { m: 0, c: 1 }));
    ui.kicker(S, { t0: 0.05, text: '🌾 State of Country Victoria · 2022 results', y: 372 });
    ui.headline(S, { t0: 0.1, html: d.then.country.LNP >= maj(d.nCountry) ? 'Coalition, <em>just</em>' : 'Too close', y: 410, size: 96, style: 'rise' });
    tally(S, d.then.country, d.nCountry);
    ui.block(S, { t0: 1.6, html: `Majority: ${maj(d.nCountry)} of ${d.nCountry}`, cls: 'body', y: 780, size: 34 });
  });

  E.defineScene('now', (S) => {
    const ch = hall(S, { key: 300 });
    E.camPath(S, TOP, { shake: 0.02, shiftY: 300, focusOn: true });
    S.aperture = 0.1;
    E.cue(S.t0 + 2.0, 'boom', { g: 0.6 });
    const mf = fill(d.now.metro), cf = fill(d.now.country);
    S.update((lt) => paint(ch, lt, mf, cf, { m: 1, c: 1 }, 0.6));
    ui.kicker(S, { t0: 0.05, text: `With today's polls · ${d.swing}-pt swing`, y: 372 });
    ui.list(S, { t0: 0.4, stagger: 1.4, y: 420, w: 920, size: 42, mark: '', items: [
      `🌾 <b>Country</b>&nbsp; <span style="color:${CSS.LNP}">Coalition ${d.now.country.LNP}</span> · <span style="color:${CSS.ALP}">Labor ${d.now.country.ALP}</span>`,
      `🏙️ <b>Melbourne</b>&nbsp; <span style="color:${CSS.LNP}">Coalition ${d.now.metro.LNP}</span> · <span style="color:${CSS.ALP}">Labor ${d.now.metro.ALP}</span> · <span style="color:${CSS.GRN}">Greens ${d.now.metro.GRN}</span>`] });
  });

  E.defineScene('ask', (S) => {
    const ch = hall(S, { key: 220 });
    E.camPath(S, [{ t: 0, pos: [0, 2.6, 7], look: [0, 1, -5], fov: 36 }, { t: 6, pos: [0, 3.4, 9], look: [0, 0.8, -4], fov: 36 }], { shake: 0.02, shiftY: 200, focusOn: true });
    S.aperture = 0.35;
    S.update((lt) => { for (let i = 0; i < N; i++) ch.set(i, i < M ? 0xc8a46a : 0x6aa84f, 0.5 + 0.4 * Math.sin(lt * 3 + (i < M ? 0 : Math.PI))); ch.commit(); });
    ui.kicker(S, { t0: 0.05, text: 'Your call', y: 372 });
    ui.headline(S, { t0: 0.1, html: 'Which Victoria <em>are you?</em>', y: 410, size: 100, style: 'rise' });
    ui.block(S, { t0: 0.9, html: 'Comment 🏙️ <b>Melbourne</b> or 🌾 <b>Country</b> 👇', cls: 'body', y: 660, w: 920, size: 46 });
  });

  E.defineScene('end', (S) => endCard(S, { title: 'Election night, <em>live</em>', sub: 'poltok.netlify.app/au/victoria', sources: 'Seats: 2022 Victorian election, official post-election pendulum; regions = Legislative Council regions (country regions include Geelong, Ballarat, Bendigo and some outer suburbs).<br>Today: live two-party swing (latest polls), applied uniformly. Illustrative, not a forecast.' }));
}
