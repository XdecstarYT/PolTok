// Reel — Australia (federal) "What if they won?": Labor, the Coalition or One Nation.
// Polls: LIVE from Wikipedia "Opinion polling for the next Australian federal election" (latest 4 polls, simple average;
// Lib + Nat summed where split). One Nation's 2025 federal result (6.4%) per Crikey, 11 Nov 2026.
// Policies (each party's own, as reported): Labor — 2026 federal budget (negative gearing ended for existing properties,
// kept for new builds; Help to Buy expanded; 1.2m homes target), net zero by 2050 (Climate Change Act 2022).
// Coalition (Opposition Leader Angus Taylor) — ABC News 6 Oct 2026: net overseas migration 100,000 a year for the first two
// years, humanitarian intake halved to 10,000; May 2026 budget reply: rejects net zero.
// One Nation (Pauline Hanson) — ABC News 10 Feb / 23 Aug 2026, Crikey 27 Jan 2026: net migration capped at 130,000,
// withdraw from the UN Refugee Convention, scrap net zero, more coal and a nuclear reactor, 15% domestic gas reservation.
// Same number of promises per party, same framing. No predictions.

const PAGE = 'Opinion_polling_for_the_next_Australian_federal_election';

export async function data() {
  const r = await fetch(`https://en.wikipedia.org/w/index.php?title=${PAGE}&action=raw&_=${Date.now()}`, { headers: { 'user-agent': 'poltok-reels/1.0' } });
  if (!r.ok) throw new Error('Wikipedia HTTP ' + r.status);
  const t = await r.text();
  const table = t.split(/\n\{\| class="wikitable/)[1].split('\n|}')[0];
  const polls = [];
  for (const row of table.split('\n|-').slice(1)) {
    const raw = row.split('\n').filter((l) => /^[|!](?![-}])/.test(l)).map((l) => l.slice(1));
    const val = (c) => c.replace(/^([^|]*?=[^|]*?)\|(?!\|)/, '').replace(/'''/g, '').trim();
    const cells = raw.map((c) => ({ raw: c, v: val(c) }));
    const si = cells.findIndex((c) => /^[\d,]{3,6}$/.test(c.v));
    if (si < 2) continue;
    const pct = (c) => +((c?.v.match(/(\d+(?:\.\d+)?)%/) || [])[1]);
    let j = si + 1;
    const ALP = pct(cells[j++]);
    let LNP;
    if (/colspan="?2/.test(cells[j]?.raw)) LNP = pct(cells[j++]); else { LNP = pct(cells[j]) + pct(cells[j + 1]); j += 2; }
    const GRN = pct(cells[j++]), ONP = pct(cells[j++]);
    if (![ALP, LNP, GRN, ONP].every(Number.isFinite)) continue;
    const firm = cells[1].v.split('<ref')[0].replace(/\[\[([^|\]]*\|)?([^\]]*)\]\]/g, '$2').trim();
    polls.push({ date: cells[0].v, firm, ALP, LNP, GRN, ONP });
    if (polls.length === 4) break;
  }
  if (polls.length < 3) throw new Error('could not parse latest federal polls');
  const avg = (k) => +(polls.reduce((a, p) => a + p[k], 0) / polls.length).toFixed(1);
  return { polls, avg: { ALP: avg('ALP'), LNP: avg('LNP'), GRN: avg('GRN'), ONP: avg('ONP') }, onp2025: 6.4 };
}

export const meta = {
  title: 'What if they ran Australia?',
  label: 'AUSTRALIA · WHAT IF',
  out: 'poltok-au-what-if',
  cover: 1.6,
  music: { prog: ['Am', 'F', 'C', 'G'], arp: 'up', seed: 151, swing: 0.04 },
};

const R = Math.round;

export const scenes = (d) => [
  { id: 'hook', beats: 6, energy: 3, voLead: 0.08, say: 'What if Labor, the Coalition, or One Nation ran Australia?' },
  { id: 'polls', beats: 10, energy: 2, trans: { type: 'zoom', dur: 0.45 },
    say: `One Nation's polling around ${R(d.avg.ONP)} percent. At the last election, it got six. Labor's on ${R(d.avg.ALP)}, the Coalition ${R(d.avg.LNP)}.`,
    cap: `Latest polls: One Nation ${d.avg.ONP}% (6.4% in 2025) · Labor ${d.avg.ALP}% · Coalition ${d.avg.LNP}%` },
  { id: 'alp', beats: 10, energy: 3, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: 'If Labor wins, Anthony Albanese stays PM. Negative gearing ends on existing homes. And net zero by 2050 stays.',
    cap: 'Labor: Albanese stays · negative gearing ends on existing homes · net zero 2050 stays' },
  { id: 'lnp', beats: 10, energy: 3, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: 'If the Coalition wins, Angus Taylor is PM. Migration is cut to a hundred thousand a year. And net zero is scrapped.',
    cap: 'Coalition: Taylor PM · net migration cut to 100,000 · net zero scrapped' },
  { id: 'onp', beats: 10, energy: 3, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: 'If One Nation wins, Pauline Hanson\'s in charge. Migration is capped at a hundred and thirty thousand. And Australia leaves the UN Refugee Convention.',
    cap: 'One Nation: Hanson leads · net migration capped at 130,000 · leave the UN Refugee Convention' },
  { id: 'ask', beats: 8, energy: 2, trans: { type: 'zoom', dur: 0.45 },
    say: 'So which one gets your vote? Comment Labor, Coalition, or One Nation.', cap: 'Labor, Coalition or One Nation? Comment 👇' },
  { id: 'end', beats: 6, energy: 0, trans: { type: 'zoom', dur: 0.5 }, noProgress: true },
];

export function build({ E, kit, ui, THREE, endCard, real }) {
  const { C, ease, remap } = E;
  const d = E.data;
  const N = 150, MAJ = 76, WARM = 0xffe2b0;
  const COL = { ALP: 0xe53935, LNP: 0x1f5fd1, ONP: 0xd9480f, GRN: 0x2fa84f };
  const CSS = { ALP: '#ff6b6b', LNP: '#6ea2ff', ONP: '#ff9a4a', GRN: '#5fd17f' };
  const hall = (S, o = {}) => {
    real.room(S, { carpet: 0x2f5a3a, wood: 0x6a4524, width: 32, depth: 28, height: 11, key: o.key ?? 300 });
    const ch = real.chamber(N, { rows: 6, r0: 3.6, r1: 8.6, leather: 0x1d5634, wood: 0x7a4a26, open: 0.6 });
    S.scene.add(ch.group);
    return ch;
  };
  const order = Array.from({ length: N }, (_, i) => i).sort((a, b) => Math.abs(a - (N - 1) / 2) - Math.abs(b - (N - 1) / 2));
  const rank = new Array(N); order.forEach((s, j) => { rank[s] = j; });

  E.defineScene('hook', (S) => {
    const ch = hall(S);
    E.camPath(S, [{ t: 0, pos: [0, 2.4, 7], look: [0, 1.0, -5], fov: 36 }, { t: S.dur + 0.4, pos: [0.6, 4.4, 11.5], look: [0, 0.7, -3.5], fov: 36 }], { shake: 0.025, focusOn: true });
    S.aperture = 0.3;
    const cyc = [COL.ALP, COL.LNP, COL.ONP];
    E.cue(S.t0 + 0.3, 'boom', { g: 0.7 });
    S.update((lt) => { const p = Math.floor(lt * 1.6) % 3; for (let i = 0; i < N; i++) ch.set(i, rank[i] < MAJ ? cyc[p] : WARM, rank[i] < MAJ ? 1.3 : 0.25); ch.commit(); });
    ui.kicker(S, { t0: 0, text: 'Next federal election · due by 2028', y: 372 });
    ui.headline(S, { t0: 0, html: 'What if <em>they</em> ran Australia?', y: 410, size: 100, style: 'slam', stagger: 0.04, t1: S.dur + 1 });
    ui.block(S, { t0: 0.35, html: `<b style="color:${CSS.ALP}">Labor</b> · <b style="color:${CSS.LNP}">Coalition</b> · <b style="color:${CSS.ONP}">One Nation</b><br>The real policies, side by side`, cls: 'body', y: 600, w: 920, size: 46, t1: S.dur + 1 });
  });

  E.defineScene('polls', (S) => {
    const ch = hall(S, { key: 260 });
    const a = d.avg; const seatsFor = (v) => R((v / 100) * N);
    const cols = [...Array(seatsFor(a.ALP)).fill(COL.ALP), ...Array(seatsFor(a.GRN)).fill(COL.GRN), ...Array(seatsFor(a.LNP)).fill(COL.LNP), ...Array(seatsFor(a.ONP)).fill(COL.ONP)];
    E.camPath(S, [{ t: 0, pos: [0, 13.5, 15], look: [0, 0, -3], fov: 44 }, { t: 6, pos: [0, 12.5, 14], look: [0, 0.3, -3.2], fov: 44 }], { shake: 0.015, shiftY: 280, focusOn: true });
    S.aperture = 0.1;
    S.update((lt) => { for (let i = 0; i < N; i++) ch.set(i, cols[i] ?? WARM, (cols[i] ? 1.2 : 0.2) * ease.back(remap(lt, 0.2 + (i / N) * 1.2, 0.5 + (i / N) * 1.2))); ch.commit(); });
    ui.kicker(S, { t0: 0.05, text: `Average of the last ${d.polls.length} national polls`, y: 372 });
    const rows = ['ONP', 'ALP', 'LNP', 'GRN'].sort((x, y) => a[y] - a[x]);
    const NAME = { LNP: 'Coalition', ONP: 'One Nation <span style="opacity:.6">(6.4% in 2025)</span>', ALP: 'Labor', GRN: 'Greens' };
    rows.forEach((k, i) => ui.counter(S, { t0: 0.3 + i * 0.3, dur: 0.9, to: a[k], decimals: 1, suffix: '%', y: 400 + i * 110, x: 80, w: 920, size: 72, color: CSS[k], label: NAME[k], ticks: i === 0 }));
  });

  const ifWins = (id, k, kicker, head, items, cam) => E.defineScene(id, (S) => {
    const ch = hall(S, { key: 300 });
    E.camPath(S, cam, { shake: 0.02, shiftY: 300, focusOn: true });
    S.aperture = 0.2;
    E.cue(S.t0 + 0.4, 'boom', { g: 0.45 });
    S.update((lt) => { for (let i = 0; i < N; i++) { const on = rank[i] < MAJ; ch.set(i, on ? COL[k] : WARM, on ? 1.4 * ease.back(remap(lt, 0.3 + rank[i] * 0.01, 0.6 + rank[i] * 0.01)) : 0.2); } ch.commit(); });
    ui.kicker(S, { t0: 0.05, text: kicker, y: 372 });
    ui.headline(S, { t0: 0.1, html: head, y: 410, size: 78, style: 'rise' });
    ui.list(S, { t0: 0.7, stagger: (S.dur - 2.2) / items.length, y: 540, w: 880, size: 40, mark: '●', markColor: CSS[k], items });
  });
  ifWins('alp', 'ALP', 'What if Labor wins?', `<span style="color:${CSS.ALP}">PM</span> <em>Anthony Albanese</em>`,
    ['Negative gearing <b>ends</b> on existing homes', 'Kept for <b>new builds</b>', '<b>Help to Buy</b> expanded', 'Net zero by <b>2050</b> stays'],
    [{ t: 0, pos: [-7, 7.5, 10.5], look: [0, 0.4, -3], fov: 40 }, { t: 6, pos: [-5, 8.5, 12], look: [0, 0.4, -3], fov: 40 }]);
  ifWins('lnp', 'LNP', 'What if the Coalition wins?', `<span style="color:${CSS.LNP}">PM</span> <em>Angus Taylor</em>`,
    ['Net migration cut to <b>100,000</b> a year', 'Humanitarian intake <b>halved</b> to 10,000', 'Net zero <b>scrapped</b>', '<b>650,000</b> fewer temporary visas'],
    [{ t: 0, pos: [7, 7.5, 10.5], look: [0, 0.4, -3], fov: 40 }, { t: 6, pos: [5, 8.5, 12], look: [0, 0.4, -3], fov: 40 }]);
  ifWins('onp', 'ONP', 'What if One Nation wins?', `<span style="color:${CSS.ONP}">Leader</span> <em>Pauline Hanson</em>`,
    ['Net migration capped at <b>130,000</b>', '<b>Leave</b> the UN Refugee Convention', 'Net zero scrapped · <b>coal and nuclear</b>', '<b>15%</b> of gas reserved for Australia'],
    [{ t: 0, pos: [0, 3.2, 8.5], look: [0, 0.8, -5], fov: 38 }, { t: 6, pos: [0, 5.0, 12], look: [0, 0.6, -4], fov: 38 }]);

  E.defineScene('ask', (S) => {
    const ch = hall(S, { key: 240 });
    E.camPath(S, [{ t: 0, pos: [-3, 2.6, 7], look: [0, 1, -5], fov: 36 }, { t: 6, pos: [2, 3.2, 8.5], look: [0, 0.9, -4.5], fov: 36 }], { shake: 0.02, focusOn: true });
    S.aperture = 0.35;
    const third = Math.floor(N / 3);
    S.update((lt) => { for (let i = 0; i < N; i++) { const c = i < third ? COL.ALP : i < 2 * third ? COL.LNP : COL.ONP; ch.set(i, c, 0.9 + 0.4 * Math.sin(lt * 4 + i * 0.3)); } ch.commit(); });
    ui.kicker(S, { t0: 0.05, text: 'Your vote', y: 372 });
    ui.headline(S, { t0: 0.1, html: 'Which one gets <em>your vote?</em>', y: 410, size: 100, style: 'rise' });
    ui.block(S, { t0: 0.9, html: `Comment <b style="color:${CSS.ALP}">Labor</b>, <b style="color:${CSS.LNP}">Coalition</b> or <b style="color:${CSS.ONP}">One Nation</b> 👇`, cls: 'body', y: 640, w: 920, size: 44 });
    ui.block(S, { t0: 1.6, html: '<b>Follow</b> for the polls every week', cls: 'body', y: 760, w: 920, size: 42 });
  });

  E.defineScene('end', (S) => endCard(S, { title: 'Polls, <em>live</em>', sub: 'poltok.netlify.app', sources: `Policies: 2026 federal budget; ABC News (6 Oct, 10 Feb, 23 Aug 2026); Crikey. Polls: latest ${d.polls.length} on Wikipedia.<br>Seat lighting is illustrative, not a prediction.` }));
}
