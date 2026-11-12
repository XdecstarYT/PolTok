// Reel — Victoria 2026 "what if": what changes if Labor, the Liberal–National Coalition or One Nation wins on 28 Nov.
// Polls: LIVE from Wikipedia "Opinion polling for the 2026 Victorian state election" (latest 4 polls, simple average).
// Promises: each party's own announced policies as listed in ABC News' policy tracker (4 Nov 2026,
// abc.net.au/news/2026-11-04/victoria-2026-election-policy-promise-tracker/107247200). Same number of promises per party,
// same framing; no predictions. Leaders: Ben Carroll (Labor, Premier since 28 Jul 2026), Jess Wilson (Liberal),
// Warren Pickering (One Nation Victoria lead candidate) — per Wikipedia "2026 Victorian state election".

const PAGE = 'Opinion_polling_for_the_2026_Victorian_state_election';

export async function data() {
  const r = await fetch(`https://en.wikipedia.org/w/index.php?title=${PAGE}&action=raw&_=${Date.now()}`, { headers: { 'user-agent': 'poltok-reels/1.0' } });
  if (!r.ok) throw new Error('Wikipedia HTTP ' + r.status);
  const t = await r.text();
  const table = t.split(/\n\{\| class="wikitable/)[1].split('\n|}')[0];
  const polls = [];
  for (const row of table.split('\n|-').slice(1)) {
    const cells = row.split('\n').filter((l) => /^\|(?![-}])/.test(l)).map((l) => l.slice(1).replace(/^[^|]*\|(?!\|)/, (m) => (/=/.test(m) ? '' : m)).trim());
    const si = cells.findIndex((c) => /^[\d,]{3,6}$/.test(c.replace(/'/g, '')));
    if (si < 2) continue;
    const pct = cells.slice(si + 1, si + 5).map((c) => +((c.match(/(\d+(?:\.\d+)?)%/) || [])[1]));
    if (pct.some((x) => !Number.isFinite(x))) continue;
    const firm = cells[1].split('<ref')[0].replace(/\[\[([^|\]]*\|)?([^\]]*)\]\]/g, '$2').replace(/'''?/g, '').trim();
    polls.push({ date: cells[0].replace(/'''?/g, ''), firm, ALP: pct[0], LNP: pct[1], GRN: pct[2], ONP: pct[3] });
    if (polls.length === 4) break;
  }
  if (polls.length < 3) throw new Error('could not parse latest Victorian polls');
  const avg = (k) => +(polls.reduce((a, p) => a + p[k], 0) / polls.length).toFixed(1);
  return { polls, avg: { ALP: avg('ALP'), LNP: avg('LNP'), GRN: avg('GRN'), ONP: avg('ONP') },
    days: Math.ceil((Date.UTC(2026, 10, 28) - Date.now()) / 864e5) };
}

export const meta = {
  title: 'What if they win Victoria?',
  label: 'VIC 2026 · WHAT IF',
  out: 'poltok-vic-what-if',
  cover: 1.6,
  music: { prog: ['Am', 'F', 'C', 'G'], arp: 'up', seed: 128, swing: 0.04 },
};

const R = Math.round;
const W = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];

export const scenes = (d) => [
  { id: 'hook', beats: 8, energy: 3, voLead: 0.08,
    say: 'What if Labor, Liberal, or One Nation won Victoria?' },
  { id: 'polls', beats: 10, energy: 2, trans: { type: 'zoom', dur: 0.45 },
    say: `Right now, the Coalition leads on ${R(d.avg.LNP)}. One Nation and Labor, around ${R((d.avg.ONP + d.avg.ALP) / 2)}.`,
    cap: `Latest polls: Coalition ${d.avg.LNP}% · One Nation ${d.avg.ONP}% · Labor ${d.avg.ALP}%` },
  { id: 'alp', beats: 12, energy: 3, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: 'If Labor wins, Ben Carroll stays premier. The Rail Loop keeps going. And fares are capped at thirty dollars a week.',
    cap: 'Labor: Carroll stays · Rail Loop continues · $30 weekly fare cap · 1,500 more police' },
  { id: 'lnp', beats: 12, energy: 3, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: 'If the Liberals win, Jess Wilson is premier. The Rail Loop is paused. And three thousand more police.',
    cap: 'Coalition: Wilson premier · Rail Loop paused · 3,000 police, one-strike bail · no stamp duty to $1m for first homes' },
  { id: 'onp', beats: 12, energy: 3, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: 'If One Nation wins, Warren Pickering leads. The Rail Loop is cancelled. And net zero is scrapped.',
    cap: 'One Nation: Pickering leads · Rail Loop cancelled · net zero scrapped, nuclear ban lifted · kids charged as adults for serious violence' },
  { id: 'maths', beats: 10, energy: 2, trans: { type: 'flash', dur: 0.36 },
    say: 'You need forty-five seats to govern alone. Fall short, and it\'s a hung parliament.',
    cap: 'Majority: 45 of 88 seats. Short of that, it\'s a hung parliament.' },
  { id: 'ask', beats: 8, energy: 2, trans: { type: 'zoom', dur: 0.45 },
    say: 'So which one do you want? Comment Labor, Liberal, or One Nation.', cap: 'Labor, Liberal or One Nation? Comment 👇' },
  { id: 'end', beats: 6, energy: 0, trans: { type: 'zoom', dur: 0.5 }, noProgress: true },
];

export function build({ E, kit, ui, THREE, endCard, real }) {
  const { C, ease, remap } = E;
  const d = E.data;
  const N = 88, MAJ = 45;
  const COL = { ALP: 0xe53935, LNP: 0x1f5fd1, ONP: 0xd9480f, GRN: 0x2fa84f };
  const CSS = { ALP: '#ff6b6b', LNP: '#6ea2ff', ONP: '#ff9a4a', GRN: '#5fd17f' };
  const WARM = 0xffe2b0;

  const hall = (S, o = {}) => {
    real.room(S, { carpet: 0x2d4a33, wood: 0x5a361d, width: 30, depth: 26, height: 10, key: o.key ?? 260 });
    const ch = real.chamber(N, { rows: 5, r0: 3.4, r1: 7.6, leather: 0x1f5a38, wood: 0x6a3d1f, open: 0.6 });
    S.scene.add(ch.group);
    return ch;
  };
  // seats light from the centre outwards so a "majority" reads as one block
  const centreOrder = Array.from({ length: N }, (_, i) => i).sort((a, b) => Math.abs(a - (N - 1) / 2) - Math.abs(b - (N - 1) / 2));
  const rank = new Array(N); centreOrder.forEach((s, j) => { rank[s] = j; });

  E.defineScene('hook', (S) => {
    const ch = hall(S);
    E.camPath(S, [{ t: 0, pos: [0, 2.2, 6.2], look: [0, 1.0, -5], fov: 36 }, { t: S.dur + 0.4, pos: [0.6, 4.0, 10], look: [0, 0.7, -3.5], fov: 36 }], { shake: 0.025, focusOn: true });
    S.aperture = 0.3;
    const cyc = [COL.ALP, COL.LNP, COL.ONP];
    E.cue(S.t0 + 0.3, 'boom', { g: 0.7 });
    S.update((lt) => { const p = Math.floor(lt * 1.6) % 3; for (let i = 0; i < N; i++) ch.set(i, rank[i] < MAJ ? cyc[p] : WARM, rank[i] < MAJ ? 1.3 : 0.25); ch.commit(); });
    ui.kicker(S, { t0: 0, text: `Victoria votes in ${d.days} days`, y: 372 });
    ui.headline(S, { t0: 0, html: 'What if <em>they</em> win?', y: 410, size: 112, style: 'slam', stagger: 0.04, t1: S.dur + 1 });
    ui.block(S, { t0: 0.35, html: `<b style="color:${CSS.ALP}">Labor</b> · <b style="color:${CSS.LNP}">Liberal</b> · <b style="color:${CSS.ONP}">One Nation</b><br>The real promises, side by side`, cls: 'body', y: 580, w: 920, size: 48, t1: S.dur + 1 });
  });

  E.defineScene('polls', (S) => {
    const ch = hall(S, { key: 240 });
    const a = d.avg; const seatsFor = (v) => R((v / 100) * N);
    const cols = [...Array(seatsFor(a.ALP)).fill(COL.ALP), ...Array(seatsFor(a.GRN)).fill(COL.GRN), ...Array(seatsFor(a.LNP)).fill(COL.LNP), ...Array(seatsFor(a.ONP)).fill(COL.ONP)];
    E.camPath(S, [{ t: 0, pos: [0, 12, 13.5], look: [0, 0, -2.5], fov: 44 }, { t: S.dur, pos: [0, 11, 12.5], look: [0, 0.3, -2.8], fov: 44 }], { shake: 0.015, shiftY: 280, focusOn: true });
    S.aperture = 0.1;
    S.update((lt) => { for (let i = 0; i < N; i++) ch.set(i, cols[i] ?? WARM, (cols[i] ? 1.2 : 0.2) * ease.back(remap(lt, 0.2 + (i / N) * 1.2, 0.5 + (i / N) * 1.2))); ch.commit(); });
    ui.kicker(S, { t0: 0.05, text: `Average of the last ${d.polls.length} polls`, y: 372 });
    const rows = ['LNP', 'ONP', 'ALP', 'GRN'].sort((x, y) => a[y] - a[x]);
    const NAME = { LNP: 'Coalition', ONP: 'One Nation', ALP: 'Labor', GRN: 'Greens' };
    rows.forEach((k, i) => ui.counter(S, { t0: 0.3 + i * 0.3, dur: 0.9, to: a[k], decimals: 1, suffix: '%', y: 400 + i * 110, x: 80, w: 920, size: 72, color: CSS[k], label: NAME[k], ticks: i === 0 }));
  });

  const ifWins = (id, k, kicker, head, items, cam) => E.defineScene(id, (S) => {
    const ch = hall(S, { key: 280 });
    E.camPath(S, cam, { shake: 0.02, shiftY: 300, focusOn: true });
    S.aperture = 0.2;
    E.cue(S.t0 + 0.4, 'boom', { g: 0.45 });
    S.update((lt) => { for (let i = 0; i < N; i++) { const on = rank[i] < MAJ; ch.set(i, on ? COL[k] : WARM, on ? 1.4 * ease.back(remap(lt, 0.3 + rank[i] * 0.015, 0.6 + rank[i] * 0.015)) : 0.2); } ch.commit(); });
    ui.kicker(S, { t0: 0.05, text: kicker, y: 372 });
    ui.headline(S, { t0: 0.1, html: head, y: 410, size: 78, style: 'rise' });
    ui.list(S, { t0: 0.7, stagger: (S.dur - 2.2) / items.length, y: 540, size: 44, mark: '●', markColor: CSS[k], items });
  });
  ifWins('alp', 'ALP', 'What if Labor wins?', `<span style="color:${CSS.ALP}">Premier</span> <em>Ben Carroll</em>`,
    ['Suburban Rail Loop <b>continues</b>', '<b>$30</b> weekly public transport fare cap', '<b>1,500</b> more police', '<b>10</b> free public dental clinics'],
    [{ t: 0, pos: [-6, 6.5, 9], look: [0, 0.4, -3], fov: 40 }, { t: 6, pos: [-4, 7.5, 10.5], look: [0, 0.4, -3], fov: 40 }]);
  ifWins('lnp', 'LNP', 'What if the Liberals win?', `<span style="color:${CSS.LNP}">Premier</span> <em>Jess Wilson</em>`,
    ['Suburban Rail Loop <b>paused</b> for review', '<b>3,000</b> more police · <b>one-strike</b> bail', 'No stamp duty for first homes to <b>$1m</b>', '<b>$50</b> weekly toll cap'],
    [{ t: 0, pos: [6, 6.5, 9], look: [0, 0.4, -3], fov: 40 }, { t: 6, pos: [4, 7.5, 10.5], look: [0, 0.4, -3], fov: 40 }]);
  ifWins('onp', 'ONP', 'What if One Nation wins?', `<span style="color:${CSS.ONP}">Leader</span> <em>Warren Pickering</em>`,
    ['Suburban Rail Loop <b>cancelled</b>', '<b>Net zero</b> targets scrapped', 'State <b>nuclear ban</b> lifted', 'Kids charged <b>as adults</b> for serious violence'],
    [{ t: 0, pos: [0, 3.0, 7.5], look: [0, 0.8, -5], fov: 38 }, { t: 6, pos: [0, 4.6, 10.5], look: [0, 0.6, -4], fov: 38 }]);

  E.defineScene('maths', (S) => {
    const ch = hall(S);
    E.camPath(S, [{ t: 0, pos: [0, 12, 13.5], look: [0, 0, -2.5], fov: 44 }, { t: S.dur, pos: [0, 10.5, 12], look: [0, 0.3, -2.8], fov: 44 }], { shake: 0.015, shiftY: 280, focusOn: true });
    S.aperture = 0.1;
    S.update((lt) => { const k = ease.inOut(remap(lt, 0.3, 1.8)); for (let i = 0; i < N; i++) { const on = rank[i] < MAJ * k; ch.set(i, on ? C.lime : WARM, on ? 1.4 : 0.25); } ch.commit(); });
    ui.kicker(S, { t0: 0.05, text: 'The magic number', y: 372 });
    ui.counter(S, { t0: 0.3, dur: 1.5, to: MAJ, y: 400, size: 230, color: '#c8f04a', label: 'of 88 seats to govern alone' });
    ui.block(S, { t0: 2.2, html: 'Short of that: a <b>hung parliament</b>', cls: 'body', y: 700, align: 'center', size: 48 });
  });

  E.defineScene('ask', (S) => {
    const ch = hall(S, { key: 220 });
    E.camPath(S, [{ t: 0, pos: [-3, 2.4, 6], look: [0, 1, -5], fov: 36 }, { t: S.dur, pos: [2, 3.0, 7.5], look: [0, 0.9, -4.5], fov: 36 }], { shake: 0.02, focusOn: true });
    S.aperture = 0.35;
    const third = Math.floor(N / 3);
    S.update((lt) => { for (let i = 0; i < N; i++) { const c = i < third ? COL.ALP : i < 2 * third ? COL.LNP : COL.ONP; ch.set(i, c, 0.9 + 0.4 * Math.sin(lt * 4 + i * 0.3)); } ch.commit(); });
    ui.kicker(S, { t0: 0.05, text: 'Your vote', y: 372 });
    ui.headline(S, { t0: 0.1, html: 'Which one do <em>you</em> want?', y: 410, size: 100, style: 'rise' });
    ui.block(S, { t0: 0.9, html: `Comment <b style="color:${CSS.ALP}">Labor</b>, <b style="color:${CSS.LNP}">Liberal</b> or <b style="color:${CSS.ONP}">One Nation</b> 👇`, cls: 'body', y: 640, w: 920, size: 46 });
    ui.block(S, { t0: 1.6, html: '<b>Follow</b> for election night, live', cls: 'body', y: 760, w: 920, size: 42 });
  });

  E.defineScene('end', (S) => endCard(S, { title: 'Election night, <em>live</em>', sub: 'poltok.netlify.app/au/victoria', sources: `Promises: ABC News Victorian election policy tracker (4 Nov 2026). Polls: average of the latest ${d.polls.length} polls listed on Wikipedia.<br>Seat lighting is illustrative, not a prediction.` }));
}
