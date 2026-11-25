// Reel (flagship) — "The final Victorian election update." Site-styled motion graphics + a 3D map of all 88 districts.
// All numbers live at render time via _lib-vic-final.js (Wikipedia poll history, 2022 official pendulum + uniform swing,
// VEC early-vote statistics). Premier Ben Carroll holds Niddrie. Seat projections are a uniform-swing illustration only.
import { mg } from './_lib-mg.js';

export async function data() {
  const { finalData } = await import('./_lib-vic-final.js');
  return finalData();
}

export const meta = {
  title: 'Victoria: the final update',
  label: 'VIC 2026 · FINAL UPDATE',
  out: 'poltok-vic-final-update',
  cover: 1.6,
  music: { prog: ['Am', 'F', 'C', 'G'], arp: 'updown', seed: 457, swing: 0.02 },
  geo: { vic: { src: 'vic-districts', mode: 'both', width: 6, minArea: 1e-7, tol: 0.004, raster: 420 } },
};

const R = Math.round;
const W = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'];
const NAME = { ALP: 'Labor', LNP: 'the Coalition', GRN: 'the Greens', ONP: 'One Nation' };

export const scenes = (d) => {
  const n = d.newest, t0 = d.trend[0], tl = d.trend[d.trend.length - 1];
  const onpMin = Math.min(...d.trend.map((x) => x.ONP));
  const mil = (d.early.total / 1e6).toFixed(2);
  return [
    { id: 'hook', beats: 7, energy: 3, voLead: 0.1, say: `${d.days === 1 ? 'One day' : W[d.days] ? W[d.days][0].toUpperCase() + W[d.days].slice(1) + ' days' : d.days + ' days'} until Victoria votes. This is everything you need to know.`,
      cap: `${d.days} days. The final Victorian election update 🗳️` },
    { id: 'breaking', beats: 11, energy: 3, trans: { type: 'flash', dur: 0.28 },
      say: `Breaking. The newest poll, from ${n.firm}, has Labor on just ${R(n.ALP)} percent. ${n.tpp ? `After preferences, Coalition ${R(n.tpp.LNP)}, Labor ${R(n.tpp.ALP)}.` : `The Coalition's on ${R(n.LNP)}.`}`,
      cap: `NEW · ${n.firm} (${n.date}): Labor ${n.ALP} · Coalition ${n.LNP} · One Nation ${n.ONP} · Greens ${n.GRN}` },
    { id: 'trend', beats: 13, energy: 2, trans: { type: 'whip', dir: 'left', dur: 0.36 },
      say: `Here's the whole year, all ${d.polls} polls. Labor's slid from ${R(t0.ALP)} to ${R(tl.ALP)}. The Coalition's climbed to ${R(tl.LNP)}. And One Nation hasn't dropped below ${Math.floor(onpMin)} all year.`,
      cap: `${d.polls} polls since Feb: Labor ${t0.ALP}→${tl.ALP} · Coalition ${t0.LNP}→${tl.LNP} · One Nation ${tl.ONP}` },
    { id: 'avg', beats: 11, energy: 3, trans: { type: 'whip', dir: 'up', dur: 0.36 },
      say: `Average the latest four, and it's Coalition ${R(d.avg.LNP)}, One Nation ${R(d.avg.ONP)}, Labor ${R(d.avg.ALP)}, Greens ${R(d.avg.GRN)}. Two-party: ${R(d.tpp.LNP)} to ${R(d.tpp.ALP)}.`,
      cap: `Latest-4 average · 2PP Coalition ${d.tpp.LNP} – Labor ${d.tpp.ALP}` },
    { id: 'map', beats: 14, energy: 3, trans: { type: 'zoom', dur: 0.4 },
      say: `That's a ${R(d.swing)} point swing. Spread it evenly across the map, and Labor falls from fifty-six seats to ${d.now.ALP}. The Coalition wins ${d.now.LNP}. You need forty-five.`,
      cap: `Even ${d.swing}-pt swing: Coalition ${d.now.LNP} · Labor ${d.now.ALP} · Greens ${d.now.GRN} (45 to win)` },
    { id: 'melb', beats: 9, energy: 3, trans: { type: 'zoom', dur: 0.4 },
      say: `${d.metro.LNP > d.metro.ALP ? 'Even Melbourne turns blue.' : 'Melbourne holds for Labor.'} The Coalition takes ${d.metro.LNP} of fifty-five city seats.`,
      cap: `Melbourne: Coalition ${d.metro.LNP} · Labor ${d.metro.ALP} · Greens ${d.metro.GRN} (of 55)` },
    { id: 'premier', beats: 10, energy: 3, trans: { type: 'flash', dur: 0.28 },
      say: d.niddrie.falls ? `And on those numbers, even Premier Ben Carroll's own seat, Niddrie, would fall. It's held by ${d.niddrie.margin} percent.`
        : `Premier Ben Carroll's own seat, Niddrie, is held by ${d.niddrie.margin} percent. On these numbers, it survives.`,
      cap: `Premier Ben Carroll · Niddrie · margin ${d.niddrie.margin}% vs swing ${d.swing}%` },
    { id: 'edge', beats: 10, energy: 2, trans: { type: 'whip', dir: 'left', dur: 0.36 },
      say: 'And these four seats are right on the knife\'s edge. Watch them on the night.', cap: `Knife's edge: ${d.edge.map((e) => e.seat).join(', ')}` },
    { id: 'early', beats: 10, energy: 3, trans: { type: 'whip', dir: 'up', dur: 0.36 },
      say: `Already, ${mil} million Victorians have voted early.`, cap: `${d.early.total.toLocaleString('en-AU')} early votes cast (VEC, ${d.early.updated})` },
    { id: 'onp', beats: 9, energy: 3, trans: { type: 'flash', dur: 0.28 },
      say: `And One Nation? Under one percent last time. ${R(d.avg.ONP)} now. Where its preferences go could decide the close ones.`, cap: `One Nation: 0.3% in 2022 → ${d.avg.ONP}% now` },
    { id: 'howto', beats: 10, energy: 2, trans: { type: 'zoom', dur: 0.4 },
      say: 'Saturday. Polls close at six. Number every box. And grab a sausage.', cap: 'Sat 28 Nov · polls close 6pm · number every box 🌭' },
    { id: 'ask', beats: 8, energy: 3, trans: { type: 'flash', dur: 0.28 },
      say: 'So, who wins Saturday? Comment your call. And watch every seat, live, on PolTok.', cap: 'Who wins Saturday? Comment your call 👇' },
    { id: 'end', beats: 7, energy: 1, trans: { type: 'zoom', dur: 0.45 }, noProgress: true },
  ];
};

export function build({ E, kit, THREE }) {
  const { C, ease, remap } = E;
  const M = mg(E, THREE), { T, add } = M;
  const d = E.data;
  const PC = { ALP: T.RED, LNP: T.BLUE, GRN: T.GREEN, ONP: T.ORANGE };
  const HEX = { ALP: 0xe53935, LNP: 0x2a64e0, GRN: 0x2fa84f, OTH: 0x8a8f99 };
  const PARTY = [['LNP', 'Coalition'], ['ONP', 'One Nation'], ['ALP', 'Labor'], ['GRN', 'Greens']];
  const serif = (s) => `<span style="color:${T.LIME};font-family:${T.SERIF};font-style:italic;font-weight:600">${s}</span>`;
  const livePill = (parent, txt, y) => add(parent, `<span class="dot" style="display:inline-block;width:18px;height:18px;border-radius:50%;background:#fff;margin-right:14px;vertical-align:middle"></span>${txt}`,
    `left:50%;top:${y}px;padding:14px 28px;border-radius:14px;background:#d0102a;color:#fff;font:800 34px/1 ${T.FONT};letter-spacing:.12em;white-space:nowrap`);

  // ---------- 3D map of all 88 districts ----------
  const mats = Object.fromEntries(Object.entries(HEX).map(([k, c]) => [k, kit.M.gloss(c, { roughness: 0.4, emissive: c, emissiveIntensity: 0.18 })]));
  const vicMap = (scale = 0.46, withEdge = true) => {
    const grp = kit.mapTiles(E.geo.vic, { depth: 0.16, bevel: 0.01, inset: 0.003, mat: () => mats.OTH });
    const edge = kit.mapSlab({ outline: E.geo.vic.outline.slice(0, 1), size: E.geo.vic.size }, { depth: 0.17, bevel: 0, edgeWidth: 0.018, edgeGlow: 1.5, mat: new THREE.MeshBasicMaterial({ visible: false }) });
    if (withEdge) grp.add(edge); grp.scale.setScalar(scale);
    const tiles = grp.userData.tiles;
    tiles.forEach((t) => { t.p = d.proj[t.tile.id] || null; t.mesh.material = t.p ? mats[t.p.win2022] || mats.OTH : mats.OTH; });
    return { grp, tiles };
  };
  const mapStage = (S) => E.stage(S, { accent: C.lime, grid: 0.05, rim: 40, glow: 0.12, center: [0, 0, 0], shadowSize: 6 });

  // ---------------- HOOK ----------------
  E.defineScene('hook', (S) => {
    M.field(S, { speed: (lt) => M.lerp(90, 14, ease.out(remap(lt, 0, 1.4))) });
    const big = add(S.layer, String(d.days), `left:0;right:0;top:260px;text-align:center;font:900 480px/1 ${T.FONT};color:${T.LIME};letter-spacing:-0.05em`);
    const lab = add(S.layer, d.days === 1 ? 'DAY TO GO' : 'DAYS TO GO', `left:0;right:0;top:750px;text-align:center;font:800 64px/1 ${T.FONT};letter-spacing:.24em;color:#fff`);
    const h = add(S.layer, `The ${serif('final')} Victorian<br>election update`, `left:0;right:0;top:880px;text-align:center;font:900 78px/1.08 ${T.FONT};color:#fff`);
    const live = livePill(S.layer, 'LIVE DATA', 1110);
    E.cue(S.t0 + 0.1, 'boom', { g: 1.0 });
    S.update((lt) => {
      M.popIn(big, lt, 0.03, 0.45); M.glitchText(big, lt, 0.05, 1.0, 26, ', 0 0 120px rgba(205,242,90,.45)');
      M.slideIn(lab, lt, 0.4, 0, 40); M.slideIn(h, lt, 0.8, 0, 50);
      M.popIn(live, lt, 1.4, 0.35, 'translateX(-50%)'); live.firstChild.style.opacity = Math.sin(lt * 8) > 0 ? 1 : 0.3;
    });
  });

  // ---------------- BREAKING: newest poll ----------------
  E.defineScene('breaking', (S) => {
    M.field(S, { speed: () => 22, palette: [T.RED, T.LIME, T.BLUE, '#ffffff'] });
    const n = d.newest;
    const bar = add(S.layer, `<span style="background:#fff;color:#d0102a;padding:6px 14px;border-radius:8px;margin-right:18px">BREAKING</span>NEW POLL · ${n.firm.toUpperCase()} · ${n.date.toUpperCase()}`,
      `left:0;right:0;top:300px;padding:22px 60px;background:#d0102a;color:#fff;font:800 36px/1 ${T.FONT};letter-spacing:.06em;white-space:nowrap;overflow:hidden`);
    const lab = add(S.layer, `Labor on just`, `left:0;right:0;top:420px;text-align:center;font:800 64px/1 ${T.FONT};color:#fff`);
    const num = add(S.layer, '', `left:0;right:0;top:500px;text-align:center;font:900 330px/1 ${T.FONT};color:${T.RED};letter-spacing:-0.04em`);
    const row = add(S.layer, PARTY.filter(([k]) => k !== 'ALP').map(([k, nm]) => `<div style="flex:1;text-align:center"><div style="font:900 84px/1 ${T.FONT};color:${PC[k]}">${n[k]}%</div><div style="font:600 30px/1.2 ${T.FONT};color:${T.MUTED};margin-top:10px">${nm}</div></div>`).join(''),
      `left:80px;right:80px;top:880px;display:flex`);
    const tpp = n.tpp ? M.glass(S.layer, `<div style="font:700 30px/1 ${T.MONO};letter-spacing:.1em;color:${T.SKY}">AFTER PREFERENCES</div><div style="font:900 72px/1.1 ${T.FONT};color:#fff;margin-top:14px"><span style="color:${T.BLUE}">Coalition ${n.tpp.LNP}</span> · <span style="color:${T.RED}">Labor ${n.tpp.ALP}</span></div>`,
      `left:90px;right:90px;top:1100px;padding:34px 40px;text-align:center`) : null;
    E.cue(S.t0 + 0.05, 'boom', { g: 0.9 }); E.cue(S.t0 + 1.0, 'tick', { k: 0.6 });
    S.update((lt) => {
      const bk = ease.expo(remap(lt, 0, 0.35)); bar.style.transform = `translateX(${(1 - bk) * -1100}px)`; bar.style.opacity = bk;
      M.slideIn(lab, lt, 0.5, 0, 30);
      const k = ease.expo(remap(lt, 0.7, 1.7)); num.textContent = R(M.lerp(40, n.ALP, k)) + '%'; M.glitchText(num, lt, 0.7, 1.8, 18, ', 0 0 100px rgba(255,61,85,.45)');
      num.style.opacity = remap(lt, 0.6, 0.8);
      [...row.children].forEach((c, i) => M.popIn(c, lt, 2.2 + i * 0.25, 0.35));
      if (tpp) { M.flipIn(tpp, lt, 3.3); M.shine(tpp, lt, 3.8); }
    });
  });

  // ---------------- TREND: every poll this year ----------------
  E.defineScene('trend', (S) => {
    M.field(S, { speed: () => 12 });
    M.kicker(S.layer, `${d.polls} POLLS · FEB → NOV`, 335);
    const Wc = 900, Hc = 640, lo = 8, hi = 36;
    const x = (i) => (i / (d.trend.length - 1)) * Wc, y = (v) => Hc - ((v - lo) / (hi - lo)) * Hc;
    const grid = [10, 20, 30].map((v) => `<line x1="0" x2="${Wc}" y1="${y(v)}" y2="${y(v)}" stroke="rgba(255,255,255,.1)" stroke-width="2"/><text x="${Wc + 8}" y="${y(v) + 10}" fill="#6b7385" font-size="28" font-family="Inter Tight">${v}%</text>`).join('');
    const lines = PARTY.map(([k]) => { const pts = d.trend.map((p, i) => `${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join(' '); return `<polyline class="ln" data-k="${k}" points="${pts}" fill="none" stroke="${PC[k]}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 0 10px ${PC[k]})"/>`; }).join('');
    const svg = add(S.layer, `<svg width="${Wc + 70}" height="${Hc + 20}" viewBox="0 -10 ${Wc + 70} ${Hc + 20}" style="overflow:visible">${grid}${lines}</svg>`, `left:70px;top:420px`);
    const polys = [...svg.querySelectorAll('.ln')];
    polys.forEach((p) => { const L = p.getTotalLength(); p.style.strokeDasharray = L; p.dataset.L = L; });
    const tl = d.trend[d.trend.length - 1];
    const tags = PARTY.map(([k, nm]) => add(S.layer, `${nm} <b>${R(tl[k])}</b>`, `left:${70 + Wc - 20}px;top:${420 + y(tl[k]) - 26}px;transform:translateX(-100%);padding:8px 16px;border-radius:12px;background:${PC[k]};color:#0d1200;font:800 32px/1 ${T.FONT};white-space:nowrap`));
    // keep end tags from overlapping
    const ys = PARTY.map(([k]) => 420 + y(tl[k]) - 26).map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
    for (let j = 1; j < ys.length; j++) if (ys[j].v - ys[j - 1].v < 56) ys[j].v = ys[j - 1].v + 56;
    ys.forEach(({ v, i }) => { tags[i].style.top = v + 'px'; });
    const months = add(S.layer, `<span>Feb</span><span>Nov</span>`, `left:70px;width:${Wc}px;top:${420 + Hc + 30}px;display:flex;justify-content:space-between;font:600 30px/1 ${T.FONT};color:#6b7385`);
    E.cue(S.t0 + 0.4, 'whoosh', { dir: 'left', dur: 2.5 });
    S.update((lt) => {
      const k = ease.inOut(remap(lt, 0.3, 3.0));
      polys.forEach((p) => { p.style.strokeDashoffset = (1 - k) * +p.dataset.L; });
      tags.forEach((t, i) => { const tk = ease.back(remap(lt, 3.0 + i * 0.12, 3.35 + i * 0.12)); t.style.transform = `translateX(-100%) scale(${tk})`; t.style.opacity = tk > 0 ? 1 : 0; });
      months.style.opacity = remap(lt, 0.2, 0.5);
    });
  });

  // ---------------- AVERAGE: latest 4 + 2PP ----------------
  E.defineScene('avg', (S) => {
    M.field(S, { speed: () => 14 });
    M.kicker(S.layer, `LATEST 4 AVERAGE · ${d.latest.join(' · ').toUpperCase()}`, 335);
    const maxV = Math.max(...PARTY.map(([k]) => d.avg[k]));
    const rows = PARTY.map(([k, nm], i) => {
      const r = add(S.layer, `<div style="display:flex;justify-content:space-between;font:800 46px/1 ${T.FONT};color:#fff;margin-bottom:12px"><span>${nm}</span><span class="v" style="color:${PC[k]}">0</span></div>
        <div style="height:38px;border-radius:12px;background:rgba(255,255,255,.07);overflow:hidden"><div class="b" style="height:100%;width:0;border-radius:12px;background:linear-gradient(90deg,${PC[k]}99,${PC[k]});box-shadow:0 0 30px ${PC[k]}"></div></div>`,
        `left:90px;right:90px;top:${440 + i * 150}px`);
      return { r, v: r.querySelector('.v'), b: r.querySelector('.b'), val: d.avg[k] };
    });
    const tpp = add(S.layer, `<div class="l" style="position:absolute;left:0;top:0;bottom:0;width:50%;background:linear-gradient(90deg,${T.BLUE},#6ea2ff);box-shadow:0 0 40px ${T.BLUE}"></div><div class="r" style="position:absolute;right:0;top:0;bottom:0;width:50%;background:linear-gradient(90deg,#ff7a8a,${T.RED});box-shadow:0 0 40px ${T.RED}"></div><div style="position:absolute;left:50%;top:-14px;bottom:-14px;width:4px;margin-left:-2px;background:#fff"></div>`,
      `left:90px;right:90px;top:1130px;height:90px;border-radius:20px`);
    const tl = add(S.layer, '', `left:90px;top:1240px;font:900 64px/1 ${T.FONT};color:${T.BLUE}`), tr = add(S.layer, '', `right:90px;top:1240px;font:900 64px/1 ${T.FONT};color:${T.RED};text-align:right`);
    const tlab = add(S.layer, 'TWO-PARTY', `left:0;right:0;top:1080px;text-align:center;font:700 30px/1 ${T.MONO};letter-spacing:.14em;color:${T.MUTED}`);
    rows.forEach((_, i) => E.cue(S.t0 + 0.4 + i * 0.9, 'pop', { i }));
    E.cue(S.t0 + 4.4, 'boom', { g: 0.6 });
    S.update((lt) => {
      rows.forEach((o, i) => { const a = 0.3 + i * 0.9; M.slideIn(o.r, lt, a, -120, 0, 0.45); const k = ease.expo(remap(lt, a + 0.1, a + 1.0)); o.b.style.width = `${(o.val / maxV) * 100 * k}%`; o.v.textContent = (o.val * k).toFixed(1) + '%'; });
      const k = ease.inOut(remap(lt, 4.0, 5.0)); const L = M.lerp(50, d.tpp.LNP, k);
      tpp.querySelector('.l').style.width = L + '%'; tpp.querySelector('.r').style.width = (100 - L) + '%';
      tpp.style.opacity = remap(lt, 3.8, 4.1); tl.textContent = `Coalition ${R(L)}`; tr.textContent = `Labor ${R(100 - L)}`;
      [tl, tr, tlab].forEach((e) => { e.style.opacity = remap(lt, 4.0, 4.3); });
    });
  });

  // ---------------- MAP: the swing, district by district ----------------
  const flipOrder = (tiles) => tiles.filter((t) => t.p && t.p.winNow !== t.p.win2022).sort((a, b) => a.p.margin - b.p.margin);
  E.defineScene('map', (S) => {
    mapStage(S);
    const { grp, tiles } = vicMap(0.46); S.scene.add(grp);
    const flips = flipOrder(tiles);
    E.camPath(S, [{ t: 0, pos: [-0.8, 5.6, 4.6], look: [0, 0, -0.1], fov: 40 }, { t: S.dur, pos: [0.8, 4.9, 4.0], look: [0, 0, -0.1], fov: 40 }], { shiftY: 300, shake: 0.025, focusOn: true });
    S.aperture = 0.35;
    const t1 = 2.2, t2 = 6.2;
    flips.forEach((f, i) => { if (i % 3 === 0) E.cue(S.t0 + t1 + (i / flips.length) * (t2 - t1), 'blip', { i: i / 3 }); });
    M.kicker(S.layer, `EVEN ${d.swing}-PT SWING · 88 DISTRICTS`, 335);
    const cnt = add(S.layer, '', `left:0;right:0;top:400px;text-align:center;font:900 92px/1 ${T.FONT};color:#fff`);
    const maj = add(S.layer, `<b style="color:${T.LIME}">45</b> to win`, `left:0;right:0;top:510px;text-align:center;font:700 40px/1 ${T.FONT};color:${T.MUTED}`);
    S.update((lt) => {
      const k = remap(lt, t1, t2), n = Math.round(k * flips.length);
      flips.forEach((f, i) => {
        const on = i < n; f.mesh.material = on ? mats[f.p.winNow] : mats[f.p.win2022];
        const pk = remap(lt, t1 + (i / flips.length) * (t2 - t1), t1 + (i / flips.length) * (t2 - t1) + 0.35);
        f.mesh.position.y = Math.sin(pk * Math.PI) * 0.25; f.mesh.scale.y = 1 + Math.sin(pk * Math.PI) * 2;
      });
      tiles.forEach((tt) => { const a = ease.back(remap(lt, 0.05 + (tt.tile.c[0] + 3) / 6 * 0.9, 0.4 + (tt.tile.c[0] + 3) / 6 * 0.9)); if (!flips.includes(tt)) tt.mesh.scale.y = Math.max(0.01, a); });
      grp.rotation.y = 0.08 - lt * 0.025;
      const alp = 56 - n, lnp = 28 + n;
      cnt.innerHTML = `<span style="color:${T.BLUE}">${lnp}</span> <span style="font-size:52px;color:${T.MUTED}">vs</span> <span style="color:${T.RED}">${alp}</span>`;
      cnt.style.opacity = remap(lt, 0.3, 0.6); maj.style.opacity = remap(lt, 0.5, 0.8);
    });
  });

  E.defineScene('melb', (S) => {
    mapStage(S);
    const { grp, tiles } = vicMap(0.46, false); S.scene.add(grp);
    tiles.forEach((t) => { if (t.p) t.mesh.material = mats[t.p.winNow] || mats.OTH; });
    const mt = tiles.filter((t) => t.p && t.p.metro);
    const c = mt.reduce((a, t) => a.add(t.c.clone()), new THREE.Vector3()).multiplyScalar(0.46 / mt.length);
    E.camPath(S, [{ t: 0, pos: [c.x - 0.15, 3.6, c.z + 2.9], look: [c.x, 0, c.z], fov: 40 }, { t: S.dur, pos: [c.x + 0.1, 2.7, c.z + 2.1], look: [c.x, 0, c.z], fov: 40 }], { shiftY: 300, shake: 0.02, focusOn: true });
    S.aperture = 0.2;
    E.cue(S.t0 + 0.8, 'boom', { g: 0.6 });
    M.kicker(S.layer, 'MELBOURNE · 55 CITY SEATS', 335);
    const cnt = add(S.layer, `<span style="color:${T.BLUE}">Coalition ${d.metro.LNP}</span> · <span style="color:${T.RED}">Labor ${d.metro.ALP}</span> · <span style="color:${T.GREEN}">Greens ${d.metro.GRN}</span>`,
      `left:0;right:0;top:410px;text-align:center;font:900 58px/1 ${T.FONT};color:#fff`);
    S.update((lt) => {
      mt.forEach((t, i) => { const k = ease.back(remap(lt, 0.4 + (i % 11) * 0.06, 0.8 + (i % 11) * 0.06)); t.mesh.scale.y = 1 + k * 1.4; t.mesh.position.y = k * 0.05; });
      tiles.forEach((t) => { if (!t.p || !t.p.metro) t.mesh.scale.y = 0.6; });
      M.slideIn(cnt, lt, 0.6, 0, 40);
    });
  });

  // ---------------- PREMIER'S SEAT ----------------
  E.defineScene('premier', (S) => {
    M.field(S, { speed: () => 18, palette: [T.RED, T.BLUE, T.LIME, '#ffffff'] });
    M.kicker(S.layer, "THE PREMIER'S OWN SEAT", 335);
    const name = add(S.layer, 'NIDDRIE', `left:0;right:0;top:420px;text-align:center;font:900 170px/1 ${T.FONT};color:#fff;letter-spacing:.02em`);
    const who = add(S.layer, `Premier <b style="color:${T.RED}">Ben Carroll</b> · Labor`, `left:0;right:0;top:620px;text-align:center;font:700 46px/1 ${T.FONT};color:#cfd6e4`);
    const Wb = 860, sc = Wb / 16;
    const meter = add(S.layer, `<div style="position:relative;height:150px">
        <div style="font:700 30px/1 ${T.MONO};color:${T.RED};margin-bottom:12px">MARGIN ${d.niddrie.margin}%</div>
        <div style="height:40px;border-radius:12px;background:rgba(255,255,255,.07)"><div class="m" style="height:100%;width:0;border-radius:12px;background:${T.RED};box-shadow:0 0 30px ${T.RED}"></div></div>
        <div style="font:700 30px/1 ${T.MONO};color:${T.BLUE};margin:22px 0 12px">SWING ${d.swing}%</div>
        <div style="height:40px;border-radius:12px;background:rgba(255,255,255,.07)"><div class="s" style="height:100%;width:0;border-radius:12px;background:${T.BLUE};box-shadow:0 0 30px ${T.BLUE}"></div></div></div>`,
      `left:110px;width:${Wb}px;top:760px`);
    const stamp = add(S.layer, d.niddrie.falls ? 'FALLS' : 'HOLDS', `left:50%;top:1110px;padding:20px 50px;border:8px solid ${d.niddrie.falls ? T.BLUE : T.RED};border-radius:20px;color:${d.niddrie.falls ? T.BLUE : T.RED};font:900 110px/1 ${T.FONT};letter-spacing:.1em`);
    const note = add(S.layer, 'Uniform-swing projection, not a forecast', `left:0;right:0;top:1320px;text-align:center;font:500 28px/1 ${T.FONT};color:#6b7385`);
    E.cue(S.t0 + 0.05, 'boom', { g: 0.7 }); E.cue(S.t0 + 3.6, 'boom', { g: 1.0 });
    S.update((lt) => {
      M.popIn(name, lt, 0.03, 0.45); M.glitchText(name, lt, 0.05, 0.9, 18); M.slideIn(who, lt, 0.5, 0, 30);
      meter.style.opacity = remap(lt, 0.9, 1.2);
      meter.querySelector('.m').style.width = `${Math.min(100, d.niddrie.margin * sc / Wb * 100) * ease.expo(remap(lt, 1.2, 2.0))}%`;
      meter.querySelector('.s').style.width = `${Math.min(100, d.swing * sc / Wb * 100) * ease.expo(remap(lt, 2.1, 3.1))}%`;
      const sk = ease.back(remap(lt, 3.5, 3.85)); stamp.style.transform = `translateX(-50%) rotate(-8deg) scale(${M.lerp(2.4, 1, sk)})`; stamp.style.opacity = sk > 0 ? 1 : 0;
      note.style.opacity = remap(lt, 4.0, 4.3);
    });
  });

  // ---------------- KNIFE'S EDGE ----------------
  E.defineScene('edge', (S) => {
    M.field(S, { speed: () => 14 });
    M.kicker(S.layer, `KNIFE'S EDGE · SWING NEEDED vs ${d.swing}%`, 335);
    const cards = d.edge.map((e, i) => M.glass(S.layer, `<div style="display:flex;align-items:center;justify-content:space-between">
        <div><div style="font:900 60px/1 ${T.FONT};color:#fff">${e.seat}</div><div style="font:600 32px/1.3 ${T.FONT};color:${T.MUTED};margin-top:8px">Labor by ${e.margin}%</div></div>
        <div class="st" style="padding:14px 24px;border-radius:14px;border:4px solid ${e.falls ? T.BLUE : T.RED};color:${e.falls ? T.BLUE : T.RED};font:900 44px/1 ${T.FONT};letter-spacing:.08em">${e.falls ? 'FALLS' : 'HOLDS'}</div></div>`,
      `left:80px;right:80px;top:${430 + i * 210}px;padding:30px 40px`));
    cards.forEach((_, i) => E.cue(S.t0 + 0.4 + i * 0.8, 'pop', { i }));
    S.update((lt) => cards.forEach((c, i) => { const a = 0.35 + i * 0.8; M.flipIn(c, lt, a); M.shine(c, lt, a + 0.4); const st = c.querySelector('.st'); const k = ease.back(remap(lt, a + 0.5, a + 0.8)); st.style.transform = `rotate(-6deg) scale(${M.lerp(2, 1, k)})`; st.style.opacity = k > 0 ? 1 : 0; }));
  });

  // ---------------- EARLY VOTES (VEC) ----------------
  E.defineScene('early', (S) => {
    M.field(S, { speed: () => 20 });
    M.kicker(S.layer, 'EARLY VOTES · VEC', 335);
    const tot = add(S.layer, '', `left:0;right:0;top:410px;text-align:center;font:900 150px/1 ${T.FONT};color:${T.LIME};letter-spacing:-0.03em`);
    const lab = add(S.layer, 'Victorians have already voted', `left:0;right:0;top:580px;text-align:center;font:700 46px/1 ${T.FONT};color:#fff`);
    const days = d.early.days, mx = Math.max(...days.map((x) => x.early)), bh = 520;
    const chart = add(S.layer, days.map((x) => `<div style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;margin:0 8px">
        <div class="v" style="font:700 24px/1 ${T.FONT};color:#cfd6e4;margin-bottom:8px;white-space:nowrap">${x.early ? R(x.early / 1000) + 'k' : '—'}</div>
        <div class="b" style="width:100%;height:0;border-radius:12px 12px 4px 4px;background:linear-gradient(180deg,${T.LIME},#8fb03a);box-shadow:0 0 24px rgba(205,242,90,.5)"></div>
        <div style="font:700 26px/1 ${T.FONT};color:${T.MUTED};margin-top:12px">${x.day}</div><div style="font:600 24px/1 ${T.FONT};color:#6b7385;margin-top:6px">${x.date}</div></div>`).join(''),
      `left:70px;right:70px;top:700px;height:${bh + 120}px;display:flex;align-items:flex-end`);
    const bars = [...chart.querySelectorAll('.b')];
    days.forEach((_, i) => E.cue(S.t0 + 0.5 + i * 0.2, 'tick', { k: 0.4 }));
    S.update((lt) => {
      bars.forEach((b, i) => { const k = ease.back(remap(lt, 0.4 + i * 0.2, 0.8 + i * 0.2)); b.style.height = `${(days[i].early / mx) * (bh - 60) * k}px`; });
      const k = ease.expo(remap(lt, 0.3, 2.4)); tot.textContent = R(d.early.total * k).toLocaleString('en-AU');
      M.glitchText(tot, lt, 0.3, 1.0, 12, ', 0 0 80px rgba(205,242,90,.4)'); lab.style.opacity = remap(lt, 0.6, 0.9);
    });
  });

  // ---------------- ONE NATION ----------------
  E.defineScene('onp', (S) => {
    M.field(S, { speed: (lt) => 30 + 20 * Math.sin(lt * 3), palette: [T.ORANGE, '#ffb36b', T.LIME, '#ffffff'] });
    M.kicker(S.layer, 'ONE NATION · 2022 → NOW', 335, T.ORANGE);
    const a = add(S.layer, '0.3%', `left:90px;top:430px;font:900 130px/1 ${T.FONT};color:rgba(255,255,255,.55)`);
    const al = add(S.layer, '2022 election', `left:420px;top:480px;font:600 38px/1 ${T.FONT};color:${T.MUTED}`);
    const arrow = add(S.layer, '↓', `left:110px;top:570px;font:900 110px/1 ${T.FONT};color:${T.ORANGE}`);
    const b = add(S.layer, '', `left:80px;top:690px;font:900 230px/1 ${T.FONT};color:${T.ORANGE}`);
    const bl = add(S.layer, 'Poll average now', `left:94px;top:930px;font:600 38px/1 ${T.FONT};color:${T.MUTED}`);
    const c = M.glass(S.layer, `<div style="font:800 50px/1.2 ${T.FONT};color:#fff">🟠 Where One Nation's preferences go could decide the <span style="color:${T.ORANGE}">close seats</span></div>`, `left:90px;right:90px;top:1020px;padding:40px 44px`);
    E.cue(S.t0 + 0.9, 'boom', { g: 0.8 });
    S.update((lt) => {
      M.slideIn(a, lt, 0.05, -60, 0); al.style.opacity = remap(lt, 0.2, 0.5);
      M.popIn(arrow, lt, 0.5, 0.35);
      const k = ease.expo(remap(lt, 0.8, 1.8)); b.textContent = (M.lerp(0.3, d.avg.ONP, k)).toFixed(1) + '%'; b.style.opacity = remap(lt, 0.7, 0.9); M.glitchText(b, lt, 0.8, 1.8, 16, ', 0 0 100px rgba(255,154,74,.5)');
      bl.style.opacity = remap(lt, 1.2, 1.5); M.flipIn(c, lt, 2.0); M.shine(c, lt, 2.5);
    });
  });

  // ---------------- HOW TO VOTE ----------------
  E.defineScene('howto', (S) => {
    M.field(S, { speed: () => 14 });
    M.kicker(S.layer, 'SATURDAY CHECKLIST', 335);
    const items = [['📅', 'Saturday 28 November', 'Victoria votes'], ['🕕', 'Polls close at 6pm', 'Early voting ends Friday'], ['🔢', 'Number every box', 'On the lower-house ballot'], ['🌭', 'Grab a democracy sausage', 'Non-negotiable']];
    const cards = items.map(([ic, t, s], i) => M.glass(S.layer, `<div style="display:flex;align-items:center;gap:30px"><div style="width:100px;height:100px;border-radius:24px;background:rgba(205,242,90,.12);border:1px solid rgba(205,242,90,.45);display:grid;place-items:center;font-size:52px">${ic}</div>
      <div><div style="font:800 50px/1.05 ${T.FONT};color:#fff">${t}</div><div style="font:500 30px/1.3 ${T.FONT};color:${T.MUTED};margin-top:8px">${s}</div></div></div>`,
      `left:80px;right:80px;top:${430 + i * 215}px;padding:28px 32px`));
    cards.forEach((_, i) => E.cue(S.t0 + 0.4 + i * 0.75, 'pop', { i }));
    S.update((lt) => cards.forEach((c, i) => { const a = 0.3 + i * 0.75; M.flipIn(c, lt, a); M.shine(c, lt, a + 0.4); const lit = lt > a + 0.4 && lt < a + 1.0; c.style.borderColor = lit ? 'rgba(205,242,90,.85)' : 'rgba(255,255,255,.14)'; }));
  });

  // ---------------- ASK ----------------
  E.defineScene('ask', (S) => {
    M.field(S, { speed: (lt) => 14 + 10 * Math.sin(lt * 2) });
    const q = add(S.layer, `Who wins<br>${serif('Saturday?')}`, `left:0;right:0;top:400px;text-align:center;font:900 130px/1.02 ${T.FONT};color:#fff`);
    const opts = add(S.layer, [['Coalition', T.BLUE], ['Labor', T.RED], ['Hung', T.ORANGE]].map(([t, c]) => `<span style="display:inline-block;margin:10px;padding:18px 30px;border-radius:18px;border:2px solid ${c};color:${c};font:800 44px/1 ${T.FONT};background:rgba(255,255,255,.04)">${t}</span>`).join(''),
      `left:60px;right:60px;top:720px;text-align:center`);
    const btn = add(S.layer, 'Comment your call 👇', `left:50%;top:900px;padding:34px 58px;border-radius:24px;background:${T.LIME};color:#0d1200;font:800 52px/1 ${T.FONT};white-space:nowrap`);
    const sub = add(S.layer, 'Then watch every seat live on PolTok 📡', `left:0;right:0;top:1080px;text-align:center;font:600 42px/1 ${T.FONT};color:#cfd6e4`);
    E.cue(S.t0 + 1.2, 'ding');
    S.update((lt) => {
      M.slideIn(q, lt, 0.05, 0, 60); M.glitchText(q, lt, 0.1, 0.7, 12);
      [...opts.children].forEach((c, i) => { const k = ease.back(remap(lt, 0.5 + i * 0.15, 0.8 + i * 0.15)); c.style.transform = `scale(${k}) translateY(${Math.sin(lt * 3 + i) * 6}px)`; });
      M.popIn(btn, lt, 1.1, 0.4, 'translateX(-50%)'); btn.style.boxShadow = `0 0 0 ${8 + 8 * Math.abs(Math.sin(lt * 3.5))}px rgba(205,242,90,.18), 0 0 70px rgba(205,242,90,.5)`;
      sub.style.opacity = remap(lt, 1.6, 2.0);
    });
  });

  // ---------------- END ----------------
  E.defineScene('end', (S) => {
    M.field(S, { speed: (lt) => M.lerp(16, 6, remap(lt, 0, 2)) });
    const t = add(S.layer, `Election night, ${serif('live')}`, `left:0;right:0;top:600px;text-align:center;font:900 100px/1 ${T.FONT};color:#fff`);
    const live = livePill(S.layer, 'SAT 28 NOV · FROM 6PM', 740);
    const url = add(S.layer, 'poltok.netlify.app/au/victoria', `left:50%;top:860px;padding:30px 52px;border-radius:22px;background:${T.LIME};color:#0d1200;font:800 44px/1 ${T.FONT};white-space:nowrap`);
    const src = add(S.layer, `Polls: ${d.polls} Victorian polls since Feb (Wikipedia), latest-4 averages at render. Seats: 2022 official pendulum + uniform two-party swing (illustrative, not a forecast). Early votes: VEC, ${d.early.updated}.`,
      `left:100px;right:100px;top:1380px;text-align:center;font:500 26px/1.45 ${T.FONT};color:#6b7385`);
    S.update((lt) => { M.popIn(t, lt, 0.05); M.popIn(live, lt, 0.4, 0.35, 'translateX(-50%)'); M.popIn(url, lt, 0.7, 0.4, 'translateX(-50%)'); src.style.opacity = remap(lt, 1.0, 1.4); });
  });
}
