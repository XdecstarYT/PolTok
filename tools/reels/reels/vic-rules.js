// Reel — "What if Victoria counted votes differently?" The real 2022 Victorian state election (VEC data in
// src/data/au-vic.ts), re-run under two other rules:
//  • First-past-the-post: each district goes to the candidate with the most first preferences (no preferences).
//  • Proportional: 88 seats shared by statewide first-preference vote, largest-remainder (Hare) method, no threshold;
//    independents' votes (~5.8%) can't be allocated to a party list and are left out. Liberal + National = Coalition.
// This is arithmetic on real votes. It assumes people would have voted the same way, which they might not have — the reel says so.

const norm = (c) => {
  if (/Liberal Democrat/i.test(c.pn)) return 'OTH';
  if (/Labor/i.test(c.pn) && !/DLP|Democratic Labour/i.test(c.pn)) return 'ALP';
  if (/^Liberal$|Liberal Party|National/i.test(c.pn)) return 'LNP';
  if (/Green/i.test(c.pn)) return 'GRN';
  if (/Independent/i.test(c.pn)) return 'IND';
  return 'OTH';
};

export async function data() {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../../../src/data/au-vic.ts', import.meta.url), 'utf8');
  const m = src.match(/VIC_RESULTS_2022[^=]*=\s*(\{.*?\});\n/s);
  if (!m) throw new Error('could not read VIC_RESULTS_2022');
  const R = JSON.parse(m[1]);
  const actual = {}, fptp = {}, flips = [], votes = {}; let tot = 0;
  const title = (k) => k.replace(/^vic-/, '').split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
  for (const [k, r] of Object.entries(R)) {
    if (!r.fp?.length || !r.final?.length) continue;
    const a = [...r.final].sort((x, y) => y.v - x.v)[0], f = [...r.fp].sort((x, y) => y.v - x.v)[0];
    actual[norm(a)] = (actual[norm(a)] || 0) + 1; fptp[norm(f)] = (fptp[norm(f)] || 0) + 1;
    if (a.n !== f.n) flips.push({ seat: title(k), from: norm(a), to: norm(f) });
    for (const c of r.fp) { votes[norm(c)] = (votes[norm(c)] || 0) + c.v; tot += c.v; }
  }
  const pct = Object.fromEntries(Object.entries(votes).map(([k, v]) => [k, +(100 * v / tot).toFixed(1)]));
  const parties = Object.entries(votes).filter(([k]) => k !== 'IND');
  const pt = parties.reduce((a, [, v]) => a + v, 0);
  const q = parties.map(([k, v]) => { const e = (88 * v) / pt; return { k, s: Math.floor(e), r: e - Math.floor(e) }; });
  let left = 88 - q.reduce((a, x) => a + x.s, 0);
  q.sort((a, b) => b.r - a.r).forEach((x) => { if (left > 0) { x.s++; left--; } });
  const pr = Object.fromEntries(q.map((x) => [x.k, x.s]));
  if (Object.values(actual).reduce((a, b) => a + b, 0) !== 88) throw new Error('expected 88 districts');
  return { actual, fptp, pr, pct, flips };
}

export const meta = {
  title: 'What if Victoria counted differently?',
  label: 'WHAT IF · ELECTION RULES',
  out: 'poltok-vic-what-if-rules',
  cover: 1.6,
  music: { prog: ['Am', 'F', 'C', 'G'], arp: 'updown', seed: 171, swing: 0.04 },
};

const W = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

export const scenes = (d) => [
  { id: 'hook', beats: 6, energy: 3, voLead: 0.08, say: 'What if Victoria counted votes differently?' },
  { id: 'real', beats: 9, energy: 2, trans: { type: 'zoom', dur: 0.45 },
    say: `In twenty twenty-two, Labor won ${d.actual.ALP} of eighty-eight seats, with ${Math.round(d.pct.ALP)} percent of the vote.`,
    cap: `2022: Labor won ${d.actual.ALP} of 88 seats with ${d.pct.ALP}% of first preferences.` },
  { id: 'fptp', beats: 10, energy: 3, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: `Switch to first-past-the-post, like the UK, and almost nothing changes. Just ${W[d.flips.length] ?? d.flips.length} seats flip.`,
    cap: `First-past-the-post: only ${d.flips.length} seats change (${d.flips.map((f) => f.seat).join(', ')}).` },
  { id: 'pr', beats: 11, energy: 3, trans: { type: 'flash', dur: 0.36 },
    say: `But hand out seats by vote share, and Labor drops to ${d.pr.ALP}. To govern, it would need the Greens.`,
    cap: `Proportional: Labor ${d.pr.ALP}, Coalition ${d.pr.LNP}, Greens ${d.pr.GRN}, others ${d.pr.OTH}. Labor would need the Greens.` },
  { id: 'note', beats: 6, energy: 1, trans: { type: 'fade', dur: 0.4 },
    say: 'Same votes. Different rules.', cap: 'Same votes, different rules. (Assumes people voted the same way.)' },
  { id: 'ask', beats: 8, energy: 2, trans: { type: 'zoom', dur: 0.45 },
    say: 'So which system is the fairest? Tell me in the comments.', cap: 'Which system is fairest? 👇' },
  { id: 'end', beats: 6, energy: 0, trans: { type: 'zoom', dur: 0.5 }, noProgress: true },
];

export function build({ E, kit, ui, THREE, endCard, real }) {
  const { C, ease, remap } = E;
  const d = E.data;
  const N = 88, WARM = 0xffe2b0;
  const COL = { ALP: 0xe53935, LNP: 0x1f5fd1, GRN: 0x2fa84f, IND: 0x9aa3b2, OTH: 0xb58cff };
  const CSS = { ALP: '#ff6b6b', LNP: '#6ea2ff', GRN: '#5fd17f', IND: '#c3c9d4', OTH: '#c9b0ff' };
  const hall = (S, o = {}) => {
    real.room(S, { carpet: 0x2d4a33, wood: 0x5a361d, width: 30, depth: 26, height: 10, key: o.key ?? 260 });
    const ch = real.chamber(N, { rows: 5, r0: 3.4, r1: 7.6, leather: 0x1f5a38, wood: 0x6a3d1f, open: 0.6 });
    S.scene.add(ch.group);
    return ch;
  };
  const ORDER = ['GRN', 'ALP', 'IND', 'OTH', 'LNP'];
  const layout = (counts) => ORDER.flatMap((k) => Array(counts[k] || 0).fill(k)).concat(Array(N).fill(null)).slice(0, N);
  const A = layout(d.actual), F = layout(d.fptp), P = layout(d.pr);
  const WIDE = [{ t: 0, pos: [0, 12, 13.5], look: [0, 0, -2.5], fov: 44 }, { t: 6, pos: [0, 11, 12.5], look: [0, 0.3, -2.8], fov: 44 }];
  const paint = (ch, from, to, k) => { for (let i = 0; i < N; i++) { const c = (i / N) < k ? to[i] : from[i]; ch.set(i, c ? COL[c] : WARM, c ? 1.2 : 0.2); } ch.commit(); };
  const tally = (S, counts, y0, keys) => keys.filter((k) => counts[k]).forEach((k, i) => ui.counter(S, { t0: 0.4 + i * 0.25, dur: 0.9, to: counts[k], y: y0 + i * 112, x: 80, w: 920, size: 64, color: CSS[k], label: { ALP: 'Labor', LNP: 'Coalition', GRN: 'Greens', IND: 'Independents', OTH: 'Others' }[k], ticks: i === 0 }));

  E.defineScene('hook', (S) => {
    const ch = hall(S);
    E.camPath(S, [{ t: 0, pos: [0, 2.2, 6.2], look: [0, 1.0, -5], fov: 36 }, { t: S.dur + 0.4, pos: [0.6, 4.0, 10], look: [0, 0.7, -3.5], fov: 36 }], { shake: 0.025, focusOn: true });
    S.aperture = 0.3;
    E.cue(S.t0 + 0.3, 'boom', { g: 0.7 });
    S.update((lt) => { const x = ((Math.floor(lt * 2) % 3) + 3) % 3; paint(ch, [A, F, P][x], [A, F, P][x], 1); });
    ui.kicker(S, { t0: 0, text: 'Victoria 2022 · re-counted', y: 372 });
    ui.headline(S, { t0: 0, html: 'Same votes. <em>Different rules.</em>', y: 410, size: 92, style: 'slam', stagger: 0.04, t1: S.dur + 1 });
  });

  E.defineScene('real', (S) => {
    const ch = hall(S, { key: 240 });
    E.camPath(S, WIDE, { shake: 0.015, shiftY: 300, focusOn: true });
    S.aperture = 0.1;
    S.update((lt) => paint(ch, Array(N).fill(null), A, ease.inOut(remap(lt, 0.2, 1.4))));
    ui.kicker(S, { t0: 0.05, text: 'What actually happened · preferential voting', y: 372 });
    ui.counter(S, { t0: 0.3, dur: 1.2, to: d.actual.ALP, y: 400, x: 80, w: 440, size: 150, color: CSS.ALP, label: 'Labor seats of 88' });
    ui.counter(S, { t0: 0.5, dur: 1.2, to: d.pct.ALP, decimals: 1, suffix: '%', y: 400, x: 540, w: 460, size: 150, align: 'right', color: '#ffffff', label: 'of the first-preference vote', ticks: false });
  });

  E.defineScene('fptp', (S) => {
    const ch = hall(S, { key: 260 });
    E.camPath(S, WIDE, { shake: 0.015, shiftY: 300, focusOn: true });
    S.aperture = 0.1;
    S.update((lt) => paint(ch, A, F, ease.inOut(remap(lt, 0.6, 2.0))));
    ui.kicker(S, { t0: 0.05, text: 'Rule 1 · first-past-the-post', y: 372 });
    ui.headline(S, { t0: 0.1, html: `Only <em>${d.flips.length} seats</em> flip`, y: 410, size: 100, style: 'rise' });
    ui.list(S, { t0: 0.9, stagger: 0.45, y: 560, w: 880, size: 40, mark: '●', markColor: '#c8f04a', items: d.flips.map((f) => `<b>${f.seat}</b> <span style="color:${CSS[f.from]}">${f.from === 'LNP' ? 'Coalition' : f.from}</span> → <span style="color:${CSS[f.to]}">${{ ALP: 'Labor', LNP: 'Coalition', GRN: 'Greens', IND: 'Independent', OTH: 'Other' }[f.to]}</span>`) });
  });

  E.defineScene('pr', (S) => {
    const ch = hall(S, { key: 260 });
    E.camPath(S, WIDE, { shake: 0.015, shiftY: 300, focusOn: true });
    S.aperture = 0.1;
    S.update((lt) => paint(ch, F, P, ease.inOut(remap(lt, 0.6, 2.2))));
    ui.kicker(S, { t0: 0.05, text: 'Rule 2 · seats by vote share', y: 372 });
    tally(S, d.pr, 400, ['ALP', 'LNP', 'GRN', 'OTH']);
    ui.block(S, { t0: 2.4, html: `Labor ${d.pr.ALP} + Greens ${d.pr.GRN} = <b style="color:#c8f04a">${d.pr.ALP + d.pr.GRN}</b> · majority is 45`, cls: 'body', y: 830, align: 'center', size: 40 });
  });

  E.defineScene('note', (S) => {
    const ch = hall(S, { key: 200 });
    E.camPath(S, [{ t: 0, pos: [-3, 2.4, 6.2], look: [0, 1, -5], fov: 36 }, { t: 6, pos: [2, 3.4, 9], look: [0, 0.8, -4], fov: 36 }], { shake: 0.015, focusOn: true });
    S.aperture = 0.35;
    S.update((lt) => paint(ch, P, P, 1));
    ui.headline(S, { t0: 0.1, html: 'Same votes. <em>Different rules.</em>', y: 410, size: 92, style: 'rise' });
    ui.block(S, { t0: 0.8, html: 'Assumes everyone voted the same way. Independents (5.8%) aren\'t a party list, so they\'re left out of the share count.', cls: 'body', y: 600, w: 900, size: 34 });
  });

  E.defineScene('ask', (S) => {
    const ch = hall(S, { key: 220 });
    E.camPath(S, [{ t: 0, pos: [-3, 2.4, 6], look: [0, 1, -5], fov: 36 }, { t: 6, pos: [2, 3.0, 7.5], look: [0, 0.9, -4.5], fov: 36 }], { shake: 0.02, focusOn: true });
    S.aperture = 0.35;
    S.update((lt) => { const x = ((Math.floor(lt * 1.2) % 3) + 3) % 3; paint(ch, [A, F, P][x], [A, F, P][x], 1); });
    ui.kicker(S, { t0: 0.05, text: 'Your call', y: 372 });
    ui.headline(S, { t0: 0.1, html: 'Which system is <em>fairest?</em>', y: 410, size: 100, style: 'rise' });
    ui.block(S, { t0: 0.9, html: '<b style="color:#c8f04a">Preferential</b> · <b style="color:#c8f04a">first-past-the-post</b> · <b style="color:#c8f04a">proportional</b>. Comment 👇', cls: 'body', y: 640, w: 920, size: 40 });
  });

  E.defineScene('end', (S) => endCard(S, { title: 'Follow it <em>live</em>', sub: 'poltok.netlify.app/au/victoria', sources: 'Votes: VEC 2022 Victorian state election results (Legislative Assembly). Proportional = largest remainder, 88 seats, no threshold, independents excluded.<br>Seat positions are illustrative.' }));
}
