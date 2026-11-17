// Reel (site-styled motion graphics) — "Victoria's race in 30 seconds." All live at render time: average of the latest 4
// Victorian primary-vote polls (vic-what-if.js), the two-party estimate and uniform-swing seat count (_lib-vic-swing.js:
// 2022 official pendulum + live 2PP). Days to 28 Nov computed. Seats are illustrative, not a forecast.
import { mg } from './_lib-mg.js';

export async function data() {
  const { data: vic } = await import('./vic-what-if.js');
  const { swingData } = await import('./_lib-vic-swing.js');
  const [v, s] = await Promise.all([vic(), swingData()]);
  const now = new Date();
  return { avg: v.avg, polls: v.polls.map((p) => p.firm.split('/')[0].trim()), lnp2pp: s.lnp, alp2pp: s.alp, swing: s.swing, after: s.after, falls: s.falls.length,
    days: Math.round((Date.UTC(2026, 10, 28) - Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) / 864e5) };
}

export const meta = {
  title: 'Victoria in 30 seconds',
  label: 'VIC 2026 · LIVE',
  out: 'poltok-vic-race-30-seconds',
  cover: 2.6,
  music: { prog: ['Am', 'F', 'C', 'G'], arp: 'updown', seed: 443, swing: 0.02 },
};

const R = Math.round;
export const scenes = (d) => [
  { id: 'hook', beats: 6, energy: 3, voLead: 0.1, say: `${d.days} days to go. Here's Victoria's election, in thirty seconds.`, cap: `${d.days} days. Victoria in 30 seconds ⏱️` },
  { id: 'primary', beats: 11, energy: 3, trans: { type: 'flash', dur: 0.3 },
    say: `First preferences. Coalition ${R(d.avg.LNP)}. One Nation ${R(d.avg.ONP)}. Labor ${R(d.avg.ALP)}. Greens ${R(d.avg.GRN)}.`,
    cap: `Coalition ${d.avg.LNP} · One Nation ${d.avg.ONP} · Labor ${d.avg.ALP} · Greens ${d.avg.GRN}` },
  { id: 'tpp', beats: 8, energy: 3, trans: { type: 'whip', dir: 'left', dur: 0.36 },
    say: `After preferences, it's Coalition ${d.lnp2pp}, Labor ${d.alp2pp}.`, cap: `Two-party: Coalition ${d.lnp2pp} · Labor ${d.alp2pp}` },
  { id: 'seats', beats: 10, energy: 3, trans: { type: 'whip', dir: 'up', dur: 0.36 },
    say: `Swing that evenly, and Labor drops from fifty-six seats to ${d.after.ALP}. The Coalition gets ${d.after.LNP}. You need forty-five.`,
    cap: `Uniform swing: Coalition ${d.after.LNP} · Labor ${d.after.ALP} (45 to win)` },
  { id: 'but', beats: 7, energy: 2, trans: { type: 'flash', dur: 0.3 },
    say: 'But polls aren\'t votes. And where One Nation\'s preferences go could change seats.', cap: 'Polls aren\'t votes. One Nation preferences could change seats.' },
  { id: 'ask', beats: 7, energy: 3, trans: { type: 'zoom', dur: 0.4 },
    say: 'Your prediction? Comment it now, and we\'ll check on the night.', cap: 'Your prediction? Comment it 👇 We\'ll check on the night.' },
  { id: 'end', beats: 6, energy: 1, trans: { type: 'zoom', dur: 0.45 }, noProgress: true },
];

export function build({ E, THREE }) {
  const { ease, remap } = E;
  const M = mg(E, THREE), { T, add } = M;
  const d = E.data;
  const PARTY = [['LNP', 'Coalition', T.BLUE], ['ONP', 'One Nation', T.ORANGE], ['ALP', 'Labor', T.RED], ['GRN', 'Greens', T.GREEN]];

  E.defineScene('hook', (S) => {
    M.field(S, { speed: (lt) => M.lerp(80, 16, ease.out(remap(lt, 0, 1.2))) });
    const big = add(S.layer, String(d.days), `left:0;right:0;top:300px;text-align:center;font:900 500px/1 ${T.FONT};color:${T.LIME};letter-spacing:-0.05em`);
    const lab = add(S.layer, 'DAYS TO GO', `left:0;right:0;top:810px;text-align:center;font:800 64px/1 ${T.FONT};letter-spacing:.24em;color:#fff`);
    const tim = add(S.layer, `⏱️ Victoria in <span style="color:${T.LIME}">30 seconds</span>`, `left:0;right:0;top:950px;text-align:center;font:800 56px/1 ${T.FONT};color:#fff`);
    const live = add(S.layer, '<span style="display:inline-block;width:18px;height:18px;border-radius:50%;background:#fff;margin-right:14px;vertical-align:middle"></span>LIVE POLLS',
      `left:50%;top:1080px;padding:14px 28px;border-radius:14px;background:#d0102a;color:#fff;font:800 34px/1 ${T.FONT};letter-spacing:.12em`);
    E.cue(S.t0 + 0.1, 'boom', { g: 0.9 });
    S.update((lt) => {
      M.popIn(big, lt, 0.03, 0.45); M.glitchText(big, lt, 0.05, 0.9, 24, ', 0 0 120px rgba(205,242,90,.4)');
      M.slideIn(lab, lt, 0.4, 0, 40); M.slideIn(tim, lt, 0.8, 0, 40);
      M.popIn(live, lt, 1.2, 0.35, 'translateX(-50%)'); live.firstChild.style.opacity = Math.sin(lt * 8) > 0 ? 1 : 0.3;
    });
  });

  E.defineScene('primary', (S) => {
    M.field(S, { speed: () => 14 });
    M.kicker(S.layer, 'FIRST PREFERENCES · POLL AVG', 335);
    const maxV = Math.max(...PARTY.map(([k]) => d.avg[k]));
    const rows = PARTY.map(([k, name, col], i) => {
      const r = add(S.layer, `<div style="display:flex;justify-content:space-between;font:800 50px/1 ${T.FONT};color:#fff;margin-bottom:16px"><span>${name}</span><span class="v" style="color:${col}">0</span></div>
        <div style="height:46px;border-radius:14px;background:rgba(255,255,255,.07);overflow:hidden"><div class="b" style="height:100%;width:0;border-radius:14px;background:linear-gradient(90deg,${col}aa,${col});box-shadow:0 0 30px ${col}"></div></div>`,
        `left:90px;right:90px;top:${430 + i * 200}px`);
      return { r, v: r.querySelector('.v'), b: r.querySelector('.b'), val: d.avg[k] };
    });
    const src = add(S.layer, `Average of the latest 4: ${d.polls.join(', ')}`, `left:90px;right:90px;top:1250px;font:500 30px/1.4 ${T.FONT};color:#6b7385`);
    rows.forEach((_, i) => E.cue(S.t0 + 0.4 + i * 1.6, 'pop', { i }));
    S.update((lt) => {
      rows.forEach((o, i) => {
        const t0 = 0.3 + i * 1.6; M.slideIn(o.r, lt, t0, -120, 0, 0.45);
        const k = ease.expo(remap(lt, t0 + 0.1, t0 + 1.1));
        o.b.style.width = `${(o.val / maxV) * 100 * k}%`; o.v.textContent = (o.val * k).toFixed(1) + '%';
      });
      src.style.opacity = remap(lt, 1.0, 1.4);
    });
  });

  E.defineScene('tpp', (S) => {
    M.field(S, { speed: () => 18 });
    M.kicker(S.layer, 'AFTER PREFERENCES · 2PP', 335);
    const bar = add(S.layer, `<div class="l" style="position:absolute;left:0;top:0;bottom:0;width:50%;background:linear-gradient(90deg,${T.BLUE},#6ea2ff);box-shadow:0 0 50px ${T.BLUE}"></div>
      <div class="r" style="position:absolute;right:0;top:0;bottom:0;width:50%;background:linear-gradient(90deg,#ff7a8a,${T.RED});box-shadow:0 0 50px ${T.RED}"></div>
      <div style="position:absolute;left:50%;top:-20px;bottom:-20px;width:4px;margin-left:-2px;background:#fff"></div>`,
      `left:90px;right:90px;top:700px;height:120px;border-radius:24px;overflow:visible`);
    const l = bar.querySelector('.l'), r = bar.querySelector('.r');
    const nl = add(S.layer, '', `left:90px;top:460px;font:900 200px/1 ${T.FONT};color:${T.BLUE}`);
    const nr = add(S.layer, '', `right:90px;top:460px;font:900 200px/1 ${T.FONT};color:${T.RED};text-align:right`);
    const ll = add(S.layer, 'Coalition', `left:90px;top:880px;font:800 48px/1 ${T.FONT};color:#fff`);
    const rl = add(S.layer, 'Labor', `right:90px;top:880px;font:800 48px/1 ${T.FONT};color:#fff`);
    E.cue(S.t0 + 1.1, 'boom', { g: 0.6 });
    S.update((lt) => {
      const k = ease.inOut(remap(lt, 0.3, 1.3)); const L = M.lerp(50, d.lnp2pp, k);
      l.style.width = L + '%'; r.style.width = (100 - L) + '%';
      nl.textContent = R(L); nr.textContent = R(100 - L);
      [nl, nr, ll, rl].forEach((e, i) => { e.style.opacity = remap(lt, 0.1 + i * 0.05, 0.4 + i * 0.05); });
      bar.style.transform = `scaleX(${ease.expo(remap(lt, 0, 0.4))})`;
    });
  });

  E.defineScene('seats', (S) => {
    M.field(S, { speed: () => 14 });
    M.kicker(S.layer, `EVEN ${d.swing}-PT SWING · 88 SEATS`, 335);
    // 88 seat dots: before (2022) → after (uniform swing)
    const grid = add(S.layer, Array.from({ length: 88 }, () => '<i style="display:inline-block;width:62px;height:62px;margin:8px;border-radius:50%"></i>').join(''),
      `left:76px;right:76px;top:430px;text-align:center`);
    const dots = [...grid.children];
    const maj = add(S.layer, `<b style="color:${T.LIME}">45</b> to win`, `left:0;right:0;top:1250px;text-align:center;font:800 54px/1 ${T.FONT};color:#fff`);
    const tally = add(S.layer, '', `left:0;right:0;top:1330px;text-align:center;font:800 46px/1 ${T.FONT};color:#fff`);
    E.cue(S.t0 + 1.6, 'whoosh', { dir: 'left', dur: 0.5 }); E.cue(S.t0 + 3.4, 'boom', { g: 0.6 });
    S.update((lt) => {
      const k = remap(lt, 1.5, 3.3), flipped = Math.round(k * d.falls);
      // 2022: ALP 56, GRN 4, LNP 28. Flips run from the end of the Labor block (most marginal first)
      dots.forEach((el, i) => {
        let c = i < 56 ? T.RED : i < 60 ? T.GREEN : T.BLUE;
        if (i < 56 && i >= 56 - flipped) c = T.BLUE;
        const appear = ease.back(remap(lt, 0.05 + i * 0.008, 0.3 + i * 0.008));
        el.style.background = c; el.style.boxShadow = `0 0 18px ${c}`; el.style.transform = `scale(${appear})`;
      });
      const alp = 56 - flipped, lnp = 28 + flipped;
      tally.innerHTML = `<span style="color:${T.BLUE}">Coalition ${lnp}</span> &nbsp;·&nbsp; <span style="color:${T.RED}">Labor ${alp}</span> &nbsp;·&nbsp; <span style="color:${T.GREEN}">Greens 4</span>`;
      maj.style.opacity = remap(lt, 0.8, 1.1); tally.style.opacity = remap(lt, 0.9, 1.2);
    });
  });

  E.defineScene('but', (S) => {
    M.field(S, { speed: (lt) => 40 + 30 * Math.sin(lt * 5), palette: [T.ORANGE, T.RED, T.LIME, '#ffffff'] });
    const h = add(S.layer, `Polls aren't <span style="color:${T.LIME};font-family:${T.SERIF};font-style:italic;font-weight:600">votes</span>`, `left:0;right:0;top:420px;text-align:center;font:900 120px/1 ${T.FONT};color:#fff`);
    const c = M.glass(S.layer, `<div style="font:800 52px/1.2 ${T.FONT};color:#fff">🟠 With One Nation on <span style="color:${T.ORANGE}">${R(d.avg.ONP)}%</span>, where its preferences flow could change seats</div>`, `left:90px;right:90px;top:700px;padding:44px`);
    E.cue(S.t0 + 0.1, 'boom', { g: 0.7 });
    S.update((lt) => { M.popIn(h, lt, 0.03); M.glitchText(h, lt, 0.05, 0.8, 18); M.flipIn(c, lt, 0.6); M.shine(c, lt, 1.1); c.style.transform += ` translateX(${Math.abs(M.noise(lt)) > 0.9 ? 8 : 0}px)`; });
  });

  E.defineScene('ask', (S) => {
    M.field(S, { speed: (lt) => 14 + 8 * Math.sin(lt * 2) });
    const q = add(S.layer, `Your <span style="color:${T.LIME};font-family:${T.SERIF};font-style:italic;font-weight:600">prediction?</span>`, `left:0;right:0;top:440px;text-align:center;font:900 120px/1 ${T.FONT};color:#fff`);
    const btn = add(S.layer, 'Comment it now 👇', `left:50%;top:700px;padding:34px 58px;border-radius:24px;background:${T.LIME};color:#0d1200;font:800 52px/1 ${T.FONT};white-space:nowrap`);
    const sub = add(S.layer, 'We\'ll check them on election night 🗳️', `left:0;right:0;top:880px;text-align:center;font:600 42px/1 ${T.FONT};color:#cfd6e4`);
    E.cue(S.t0 + 0.7, 'ding');
    S.update((lt) => {
      M.slideIn(q, lt, 0.05, 0, 60); M.glitchText(q, lt, 0.1, 0.7, 10);
      M.popIn(btn, lt, 0.6, 0.4, 'translateX(-50%)'); btn.style.boxShadow = `0 0 0 ${8 + 8 * Math.abs(Math.sin(lt * 3.5))}px rgba(205,242,90,.18), 0 0 70px rgba(205,242,90,.5)`;
      sub.style.opacity = remap(lt, 1.0, 1.4);
    });
  });

  E.defineScene('end', (S) => {
    M.field(S, { speed: (lt) => M.lerp(16, 6, remap(lt, 0, 2)) });
    const t = add(S.layer, `Election night, <span style="color:${T.LIME};font-family:${T.SERIF};font-style:italic;font-weight:600">live</span>`, `left:0;right:0;top:640px;text-align:center;font:900 100px/1 ${T.FONT};color:#fff`);
    const url = add(S.layer, 'poltok.netlify.app/au/victoria', `left:50%;top:800px;padding:30px 52px;border-radius:22px;background:${T.LIME};color:#0d1200;font:800 44px/1 ${T.FONT};white-space:nowrap`);
    const src = add(S.layer, 'Polls: latest 4 Victorian primary-vote polls (Wikipedia) at render time. Two-party and seats: 2022 official pendulum with a uniform swing. Illustrative, not a forecast.',
      `left:100px;right:100px;top:1380px;text-align:center;font:500 26px/1.45 ${T.FONT};color:#6b7385`);
    S.update((lt) => { M.popIn(t, lt, 0.05); M.popIn(url, lt, 0.5, 0.4, 'translateX(-50%)'); src.style.opacity = remap(lt, 0.9, 1.3); });
  });
}
