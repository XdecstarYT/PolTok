// Reel — UK voting intention: the national polling trend, pulled LIVE at render time from Wikipedia's
// "Opinion polling for the next United Kingdom general election" tables (GB/UK-wide polls only).
// Monthly figures and the "now" figure are PolTok's simple averages of the published polls; nothing is hard-coded.

const PAGE = 'Opinion_polling_for_the_next_United_Kingdom_general_election';
const MON = { Jan: 1, January: 1, Feb: 2, February: 2, Mar: 3, March: 3, Apr: 4, April: 4, May: 5, Jun: 6, June: 6, Jul: 7, July: 7, Aug: 8, August: 8, Sep: 9, Sept: 9, September: 9, Oct: 10, October: 10, Nov: 11, November: 11, Dec: 12, December: 12 };
const MNAME = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const KEYS = ['Lab', 'Con', 'Ref', 'LD', 'Grn'];

function parsePolls(t) {
  const polls = [];
  for (const tb of t.split(/\n\{\| class="wikitable/).slice(1)) {
    const body = tb.split('\n|}')[0];
    const head = body.split('\n|-')[0];
    const cols = [...head.matchAll(/\|\[\[[^|\]]+\|(\w+)\]\]/g)].map((m) => m[1]);
    if (!cols.includes('Lab') || !cols.includes('Ref')) continue;
    for (const row of body.split('\n|-').slice(2)) {
      const cells = [];
      for (const line of row.split('\n')) { if (/^\|(?![-}])/.test(line)) cells.push(line.slice(1)); else if (cells.length) cells[cells.length - 1] += '\n' + line; }
      const od = cells[0]?.match(/\{\{opdrts\|([^}]*)\}\}/);
      if (!od) continue;
      const m = od[1].split('|').filter((x) => !/=/.test(x));
      const yr = +m.at(-1), mon = MON[m.filter((x) => MON[x]).at(-1)], day = +m.filter((x) => /^\d{1,2}$/.test(x)).at(-1);
      if (!yr || !mon || !day) continue;
      const area = (cells[3] || '').trim();
      if (!/^(GB|UK)$/.test(area)) continue;
      const v = {};
      cols.forEach((c, i) => { const x = (cells[5 + i] || '').replace(/^.*\|/s, '').match(/(\d+(?:\.\d+)?)%/); if (x) v[c] = +x[1]; });
      if (!v.Lab || !v.Con || !v.Ref) continue;
      polls.push({ date: new Date(Date.UTC(yr, mon - 1, day)), ...v });
    }
  }
  return polls.sort((a, b) => a.date - b.date);
}
const avg = (ps) => Object.fromEntries(KEYS.map((k) => [k, +(ps.reduce((a, p) => a + (p[k] || 0), 0) / ps.length).toFixed(1)]));

export async function data() {
  const r = await fetch(`https://en.wikipedia.org/w/index.php?title=${PAGE}&action=raw&_=${Date.now()}`, { headers: { 'user-agent': 'poltok-reels/1.0' } });
  if (!r.ok) throw new Error('Wikipedia HTTP ' + r.status);
  const polls = parsePolls(await r.text());
  if (polls.length < 50) throw new Error('too few polls parsed: ' + polls.length);
  const latest = polls.at(-1).date;
  const recent = polls.filter((p) => latest - p.date <= 14 * 864e5);
  const now = avg(recent);
  // monthly averages from Jan 2025 up to the last complete-ish month, then "now"
  const byMonth = new Map();
  for (const p of polls) { if (p.date.getUTCFullYear() < 2025) continue; const k = p.date.getUTCFullYear() * 12 + p.date.getUTCMonth(); (byMonth.get(k) || byMonth.set(k, []).get(k)).push(p); }
  const months = [...byMonth.entries()].sort((a, b) => a[0] - b[0]).filter(([, ps]) => ps.length >= 6)
    .map(([k, ps]) => ({ y: Math.floor(k / 12), m: (k % 12) + 1, n: ps.length, ...avg(ps) }));
  // how long the leader before the current one held the lead, and when it changed
  const leader = (o) => KEYS.reduce((a, k) => (o[k] > o[a] ? k : a), 'Lab');
  const nowLead = leader(now);
  let i = months.length - 1; while (i >= 0 && leader(months[i]) === nowLead) i--;
  const prevLead = i >= 0 ? leader(months[i]) : null;
  let j = i; while (j >= 0 && leader(months[j]) === prevLead) j--;
  const flip = i >= 0 ? months[i + 1] : null; // first month of the current leader
  const prevRunMonths = i - j;
  const low = months.reduce((a, m) => (m[nowLead] < a[nowLead] ? m : a), months[0]);
  // the trailing party's lowest point: how far back until its monthly average was this low
  let since = null; for (let q = months.length - 1; q >= 0; q--) if (months[q][prevLead] <= now[prevLead]) { since = months[q]; break; }
  return { now, nRecent: recent.length, latest: latest.toISOString().slice(0, 10), months, nowLead, prevLead, flip, prevRunMonths, low, refBelowCon: now.Con > now.Ref, since,
    latestLabel: latest.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) };
}

export const meta = {
  title: 'UK polls: the lead has flipped',
  label: 'LIVE POLLING',
  out: 'poltok-uk-polls',
  cover: 1.6,
  music: { prog: ['Gm', 'Eb', 'Bb', 'F'], arp: 'up', seed: 21, swing: 0.04 },
};

const NAME = { Lab: 'Labour', Con: 'the Tories', Ref: 'Reform', LD: 'the Lib Dems', Grn: 'the Greens' };
const SHORT = { Lab: 'Labour', Con: 'Conservatives', Ref: 'Reform UK', LD: 'Lib Dems', Grn: 'Greens' };
const CSS = { Lab: '#ff4d6d', Con: '#3fa9ff', Ref: '#2fd3e6', LD: '#ffb03b', Grn: '#3ed17a' };
const HEX = { Lab: 0xe4003b, Con: 0x0087dc, Ref: 0x12b6cf, LD: 0xfaa61a, Grn: 0x02a95b };
const cap1 = (s) => s[0].toUpperCase() + s.slice(1);
const R = (x) => Math.round(x);

export const scenes = (d) => {
  const L = d.nowLead, P = d.prevLead;
  const run = d.prevRunMonths;
  const runSay = run >= 12 ? `For over a year, ${NAME[P]} led the polls.` : `For ${run} months, ${NAME[P]} led the polls.`;
  return [
    { id: 'hook', beats: 8, energy: 3, voLead: 0.08, say: `${runSay} Not anymore.` },
    { id: 'low', beats: 10, energy: 2, trans: { type: 'fade', dur: 0.45 },
      say: `Back in ${MNAME[d.low.m]}, ${NAME[L]} hit ${R(d.low[L])} percent. ${cap1(NAME[P])} were on ${R(d.low[P])}.`,
      cap: `${MNAME[d.low.m]} ${d.low.y}: ${SHORT[L]} ${d.low[L]}%, ${SHORT[P]} ${d.low[P]}%.` },
    { id: 'cross', beats: 10, energy: 3, trans: { type: 'whip', dir: 'left', dur: 0.42 },
      say: `Then, in ${MNAME[d.flip.m]}, the lines crossed.`, cap: `${MNAME[d.flip.m]} ${d.flip.y}: the lines crossed.` },
    { id: 'now', beats: 12, energy: 3, trans: { type: 'flash', dur: 0.36 },
      say: `Now? ${cap1(NAME[L])}'s on ${R(d.now[L])}. ` + (d.refBelowCon && P === 'Ref' ? `The Tories, ${R(d.now.Con)}. And Reform's down to ${R(d.now.Ref)}. They're third.` : `${cap1(NAME[P])}, ${R(d.now[P])}.`),
      cap: `Now: ${KEYS.slice(0, 3).map((k) => `${SHORT[k]} ${d.now[k]}%`).join(' · ')}` },
    { id: 'ask', beats: 8, energy: 2, trans: { type: 'zoom', dur: 0.45 },
      say: 'So what changed? Tell me in the comments.', cap: 'What changed? 👇' },
    { id: 'end', beats: 6, energy: 0, trans: { type: 'zoom', dur: 0.5 }, noProgress: true },
  ];
};

export function build({ E, kit, ui, THREE, endCard, real }) {
  const { C, ease, remap } = E;
  const d = E.data;
  const L = d.nowLead, P = d.prevLead;
  const ms = d.months;
  const N = ms.length;
  const X = (i) => -3.2 + (6.4 * i) / Math.max(1, N - 1);
  const Y = (v) => (v - 23.5) * 0.13 + 2.4; // ~16% → 1.4 ; ~31% → 3.4
  const SHOW = ['Lab', 'Con', 'Ref'];

  // the chart: one glowing tube per party, revealed with drawRange; grid lines at 20/25/30 %
  const chart = (S, o = {}) => {
    E.stage(S, { accent: 0x5a6a90, accent2: 0x2a3550, grid: 0.05, rim: 60, glow: 0.12, center: [0, 2.2, 0] });
    const g = new THREE.Group(); S.scene.add(g);
    [20, 25, 30].forEach((p) => {
      const ln = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.008, 0.008), new THREE.MeshBasicMaterial({ color: 0x3a4252 }));
      ln.position.set(0, Y(p), -0.05); g.add(ln);
    });
    const lines = {};
    for (const k of SHOW) {
      const pts = ms.map((m, i) => new THREE.Vector3(X(i), Y(m[k]), 0));
      const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
      const geo = new THREE.TubeGeometry(curve, N * 12, k === L || k === P ? 0.032 : 0.026, 10, false);
      const mesh = new THREE.Mesh(geo, kit.M.glow(HEX[k], k === L || k === P ? 1.5 : 1.25));
      g.add(mesh);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(k === L || k === P ? 0.08 : 0.05, 20, 14), kit.M.glow(HEX[k], 2));
      g.add(dot);
      lines[k] = { mesh, geo, curve, dot, total: geo.index.count };
    }
    const reveal = (frac) => {
      for (const k of SHOW) {
        const l = lines[k]; const f = Math.max(0.001, Math.min(1, frac));
        l.geo.setDrawRange(0, Math.floor((l.total * f) / 6) * 6);
        l.dot.position.copy(l.curve.getPointAt(f));
      }
    };
    return { g, lines, reveal };
  };
  const flipIdx = ms.findIndex((m) => m.y === d.flip.y && m.m === d.flip.m);
  const lowIdx = ms.findIndex((m) => m.y === d.low.y && m.m === d.low.m);
  const fracAt = (i) => i / Math.max(1, N - 1);

  E.defineScene('hook', (S) => {
    const c = chart(S);
    E.camPath(S, [{ t: 0, pos: [0.8, 2.6, 7.4], look: [0.4, 2.4, 0], fov: 40 }, { t: S.dur + 0.4, pos: [-0.2, 2.5, 8.6], look: [0, 2.4, 0], fov: 40 }], { shake: 0.02, shiftY: 230, focusOn: true });
    S.aperture = 0.25;
    E.cue(S.t0 + 0.3, 'boom', { g: 0.7 });
    S.update((lt) => c.reveal(0.15 + 0.85 * ease.out(remap(lt, 0, 2.4))));
    ui.kicker(S, { t0: 0, text: 'UK polls · live average', y: 372 });
    ui.headline(S, { t0: 0, html: `${SHORT[L]}'s <em>back in front</em>`, y: 410, size: 92, style: 'slam', stagger: 0.04, t1: S.dur + 1 });
    ui.block(S, { t0: 0.35, html: `<b style="color:${CSS[L]}">${SHORT[L]} ${d.now[L]}%</b> · <b style="color:${CSS.Con}">Con ${d.now.Con}%</b> · <b style="color:${CSS.Ref}">Reform ${d.now.Ref}%</b>`, cls: 'body', y: 560, w: 940, size: 44, t1: S.dur + 1 });
  });

  E.defineScene('low', (S) => {
    const c = chart(S);
    const at = new THREE.Vector3(X(lowIdx), Y(d.low[L]), 0);
    E.camPath(S, [{ t: 0, pos: [at.x - 1.0, 2.6, 6.4], look: [at.x + 0.4, 2.4, 0], fov: 40 }, { t: S.dur, pos: [at.x - 0.2, 2.6, 5.8], look: [at.x + 0.6, 2.4, 0], fov: 40 }], { shake: 0.015, shiftY: 230, focusOn: true });
    S.aperture = 0.5;
    S.update((lt) => c.reveal(fracAt(lowIdx) + 0.002 + 0.0 * lt));
    ui.kicker(S, { t0: 0.05, text: `${MNAME[d.low.m]} ${d.low.y}`, y: 372 });
    ui.counter(S, { t0: 0.3, dur: 1.0, to: d.low[L], decimals: 1, suffix: '%', y: 410, x: 80, w: 440, size: 130, color: CSS[L], label: SHORT[L] });
    ui.counter(S, { t0: 0.5, dur: 1.0, to: d.low[P], decimals: 1, suffix: '%', y: 410, x: 540, w: 440, size: 130, align: 'right', color: CSS[P], label: SHORT[P], ticks: false });
    ui.block(S, { t0: 1.4, html: `${SHORT[L]}'s <b>lowest month</b> since January 2025`, cls: 'body', y: 600, align: 'center', size: 42 });
  });

  E.defineScene('cross', (S) => {
    const c = chart(S);
    const at = new THREE.Vector3(X(flipIdx), Y(d.flip[L]), 0);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.02, 12, 64), kit.M.glow(C.lime, 3));
    ring.position.copy(at); ring.position.z = 0.05; S.scene.add(ring);
    E.camPath(S, [{ t: 0, pos: [at.x - 1.6, at.y + 0.3, 6.8], look: [at.x - 0.4, at.y + 0.1, 0], fov: 38 }, { t: S.dur, pos: [at.x - 0.3, at.y + 0.3, 5.6], look: [at.x, at.y + 0.1, 0], fov: 38 }], { shake: 0.02, shiftY: 230, focusOn: true });
    S.aperture = 0.4;
    E.cue(S.t0 + 1.6, 'ding', {});
    S.update((lt) => {
      c.reveal(fracAt(lowIdx) + (fracAt(flipIdx) - fracAt(lowIdx) + 0.01) * ease.inOut(remap(lt, 0.2, 1.6)));
      const k = ease.back(remap(lt, 1.6, 2.0)); ring.scale.setScalar(Math.max(0.001, k)); ring.rotation.z = lt;
    });
    ui.kicker(S, { t0: 0.05, text: `${MNAME[d.flip.m]} ${d.flip.y}`, y: 372 });
    ui.headline(S, { t0: 0.15, html: 'The lines <em>crossed</em>', y: 410, size: 110, style: 'rise' });
    ui.block(S, { t0: 1.7, html: `<b style="color:${CSS[L]}">${SHORT[L]} ${d.flip[L]}%</b> &nbsp;vs&nbsp; <b style="color:${CSS[P]}">${SHORT[P]} ${d.flip[P]}%</b>`, cls: 'body', y: 560, align: 'center', size: 48 });
  });

  E.defineScene('now', (S) => {
    const c = chart(S);
    const end = new THREE.Vector3(X(N - 1), Y(d.now[L]), 0);
    E.camPath(S, [{ t: 0, pos: [1.2, 2.5, 7.6], look: [0.8, 2.4, 0], fov: 40 }, { t: S.dur, pos: [2.0, 2.6, 6.6], look: [1.4, 2.4, 0], fov: 40 }], { shake: 0.015, shiftY: 300, focusOn: true });
    S.aperture = 0.3;
    S.update((lt) => c.reveal(fracAt(flipIdx) + (1 - fracAt(flipIdx)) * ease.inOut(remap(lt, 0.0, 1.2))));
    ui.kicker(S, { t0: 0.05, text: `Now · last ${d.nRecent} polls`, y: 372 });
    const rows = ['Lab', 'Con', 'Ref'].sort((a, b) => d.now[b] - d.now[a]);
    rows.forEach((k, i) => ui.counter(S, { t0: 0.3 + i * 0.35, dur: 1.0, to: d.now[k], decimals: 1, suffix: '%', y: 400 + i * 125, x: 80, w: 920, size: 80, color: CSS[k], label: `${i + 1}. ${SHORT[k]}`, ticks: i === 0 }));
  });

  E.defineScene('ask', (S) => {
    const c = chart(S);
    E.camPath(S, [{ t: 0, pos: [-1.0, 2.6, 8.2], look: [0, 2.4, 0], fov: 40 }, { t: S.dur, pos: [1.0, 2.7, 7.8], look: [0, 2.4, 0], fov: 40 }], { shake: 0.015, shiftY: 230, focusOn: true });
    S.aperture = 0.3;
    S.update(() => c.reveal(1));
    ui.kicker(S, { t0: 0.05, text: 'Your turn', y: 372 });
    ui.headline(S, { t0: 0.1, html: 'What <em>changed?</em>', y: 410, size: 120, style: 'rise' });
    ui.block(S, { t0: 0.9, html: '<b style="color:#c8f04a">Comment</b> 👇 &nbsp;·&nbsp; <b>Follow</b> for the weekly polls', cls: 'body', y: 600, w: 920, size: 44 });
  });

  E.defineScene('end', (S) => endCard(S, { title: 'Polls, <em>live</em>', sub: 'poltok.netlify.app', sources: `PolTok averages of GB-wide polls listed on Wikipedia, to ${d.latestLabel}.<br>Monthly lines = simple averages. Not a forecast.` }));
}
