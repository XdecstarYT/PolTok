// Reel (viral, site-styled motion graphics) — "6 things Australian elections do that the rest of the world finds wild."
// Facts: secret ballot — Victoria's Electoral Act 1856 (Tasmania also legislated it in 1856); adopted in the US as the
// "Australian ballot" (NMA, MoAD). South Australia 1894: women could vote and stand for parliament, the first place to
// allow women to stand. Preferential voting federally since the 1918 Corangamite by-election. Compulsory federal voting
// since 1924. Federal elections must be held on a Saturday (Commonwealth Electoral Act s158); Victoria votes on the last
// Saturday in November. "Democracy sausage": Australian National Dictionary Centre's Word of the Year 2016.
import { mg } from './_lib-mg.js';

export async function data() {
  const now = new Date();
  return { days: Math.round((Date.UTC(2026, 10, 28) - Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) / 864e5) };
}

export const meta = {
  title: 'Aussie elections are different',
  label: 'DID YOU KNOW',
  out: 'poltok-aussie-election-facts',
  cover: 3.0,
  music: { prog: ['G', 'D', 'Em', 'C'], arp: 'up', seed: 439, swing: 0.04 },
};

// [n, emoji, headline, sub, spoken]
const F = [
  [6, '📅', 'Always a <em>Saturday</em>', 'Federal law says so. Victoria votes the last Saturday in November', 'Number six. Elections are always on a Saturday. It\'s the law.'],
  [5, '🌭', 'You get a <em>sausage</em>', '"Democracy sausage": Word of the Year, 2016', 'Five. You get a sausage. The democracy sausage was literally Word of the Year.'],
  [4, '⚖️', 'Voting is <em>compulsory</em>', 'For federal elections since 1924', 'Four. Voting is compulsory. Has been for over a hundred years.'],
  [3, '🔢', 'You <em>rank</em> everyone', 'Preferential voting, federally since 1918', 'Three. You don\'t just pick one. You rank them. Since nineteen eighteen.'],
  [2, '🙋‍♀️', 'Women in <em>parliament</em>', 'South Australia, 1894: women could vote and stand. A world first for standing', 'Two. In eighteen ninety-four, South Australia let women vote, and run for parliament. A world first.'],
  [1, '🗳️', 'The <em>secret ballot</em>', '1856, Victoria and Tasmania. The US called it "the Australian ballot"', 'And number one. Australia gave the world the secret ballot. In America, they literally called it the Australian ballot.'],
];

export const scenes = (d) => [
  { id: 'hook', beats: 6, energy: 3, voLead: 0.1, say: 'Six things Australian elections do, that the rest of the world finds wild.', cap: '6 things Aussie elections do that the world finds wild 🇦🇺' },
  ...F.map(([n, , h, sub, say], i) => ({ id: 'f' + i, beats: 9, energy: i % 2 ? 2 : 3, trans: { type: i % 2 ? 'whip' : 'flash', dir: i % 2 ? 'left' : 'up', dur: 0.34 }, say,
    cap: `#${n} · ${h.replace(/<[^>]+>/g, '')}` })),
  { id: 'ask', beats: 8, energy: 3, trans: { type: 'zoom', dur: 0.4 },
    say: `Which one surprised you? Comment the number. And Victoria, your Saturday's in ${d.days} days.`, cap: 'Which one surprised you? Comment the number 👇' },
  { id: 'end', beats: 6, energy: 1, trans: { type: 'zoom', dur: 0.45 }, noProgress: true },
];

export function build({ E, THREE }) {
  const { ease, remap } = E;
  const M = mg(E, THREE), { T, add } = M;
  const d = E.data;

  E.defineScene('hook', (S) => {
    M.field(S, { speed: (lt) => M.lerp(70, 14, ease.out(remap(lt, 0, 1.4))) });
    const six = add(S.layer, '6', `left:0;right:0;top:300px;text-align:center;font:900 520px/1 ${T.FONT};color:${T.LIME};letter-spacing:-0.04em`);
    const h = add(S.layer, `things Aussie elections do that the world finds <span style="color:${T.LIME};font-family:${T.SERIF};font-style:italic;font-weight:600">wild</span>`,
      `left:80px;right:80px;top:860px;text-align:center;font:900 82px/1.08 ${T.FONT};color:#fff;letter-spacing:-0.02em`);
    const flag = add(S.layer, '🇦🇺', `left:50%;top:1150px;font-size:120px`);
    E.cue(S.t0 + 0.1, 'boom', { g: 0.9 });
    S.update((lt) => {
      M.popIn(six, lt, 0.05, 0.45); M.glitchText(six, lt, 0.1, 0.9, 26, ', 0 0 120px rgba(205,242,90,.45)');
      M.slideIn(h, lt, 0.5, 0, 60);
      M.popIn(flag, lt, 1.1, 0.4, 'translateX(-50%)');
    });
  });

  F.forEach(([n, emo, head, sub], i) => E.defineScene('f' + i, (S) => {
    M.field(S, { speed: (lt) => M.lerp(90, 14, ease.out(remap(lt, 0, 0.9))), grid: 0.1 });
    const num = add(S.layer, `#${n}`, `left:80px;top:280px;font:900 300px/1 ${T.FONT};color:${n === 1 ? T.LIME : 'rgba(255,255,255,.95)'};letter-spacing:-0.05em`);
    const emoji = add(S.layer, emo, `right:110px;top:330px;font-size:190px`);
    const card = M.glass(S.layer, `<div style="font:900 92px/1.02 ${T.FONT};color:#fff;letter-spacing:-0.02em">${head.replace(/<em>/g, `<em style="font-style:italic;font-family:${T.SERIF};font-weight:600;color:${T.LIME}">`)}</div>
      <div style="font:500 40px/1.35 ${T.FONT};color:${T.MUTED};margin-top:26px">${sub}</div>`, `left:80px;right:80px;top:680px;padding:52px 50px`);
    const dots = add(S.layer, F.map((_, j) => `<i style="display:inline-block;width:${j === i ? 60 : 18}px;height:18px;border-radius:9px;margin:0 7px;background:${j <= i ? T.LIME : 'rgba(255,255,255,.2)'}"></i>`).join(''),
      `left:0;right:0;top:1330px;text-align:center`);
    E.cue(S.t0 + 0.08, n === 1 ? 'boom' : 'pop', { g: 0.8, i });
    S.update((lt) => {
      const k = M.popIn(num, lt, 0.02, 0.4); M.glitchText(num, lt, 0.05, 0.7, 20, n === 1 ? ', 0 0 120px rgba(205,242,90,.5)' : '');
      emoji.style.transform = `scale(${ease.back(remap(lt, 0.2, 0.6))}) rotate(${Math.sin(lt * 2.4) * 10}deg) translateY(${Math.sin(lt * 1.7) * 12}px)`;
      M.flipIn(card, lt, 0.35); M.shine(card, lt, 0.9);
      dots.style.opacity = remap(lt, 0.4, 0.7);
    });
  }));

  E.defineScene('ask', (S) => {
    M.field(S, { speed: (lt) => 14 + 8 * Math.sin(lt * 2) });
    const q = add(S.layer, `Which one<br><span style="color:${T.LIME};font-family:${T.SERIF};font-style:italic;font-weight:600">surprised you?</span>`,
      `left:0;right:0;top:400px;text-align:center;font:900 110px/1.05 ${T.FONT};color:#fff;letter-spacing:-0.02em`);
    const nums = add(S.layer, [6, 5, 4, 3, 2, 1].map((n) => `<span style="display:inline-block;width:110px;height:110px;line-height:110px;margin:10px;border-radius:24px;border:1.5px solid rgba(255,255,255,.2);background:rgba(255,255,255,.05);font:900 64px/110px ${T.FONT};color:#fff">${n}</span>`).join(''),
      `left:60px;right:60px;top:760px;text-align:center`);
    const btn = add(S.layer, 'Comment the number 👇', `left:50%;top:1060px;padding:34px 58px;border-radius:24px;background:${T.LIME};color:#0d1200;font:800 50px/1 ${T.FONT};white-space:nowrap`);
    const cd = add(S.layer, `Victoria votes in <b style="color:${T.LIME}">${d.days} days</b> 🗳️`, `left:0;right:0;top:1230px;text-align:center;font:600 40px/1 ${T.FONT};color:#cfd6e4`);
    E.cue(S.t0 + 1.0, 'ding');
    S.update((lt) => {
      M.slideIn(q, lt, 0.05, 0, 60); M.glitchText(q, lt, 0.1, 0.7, 10);
      [...nums.children].forEach((c, i) => { const k = ease.back(remap(lt, 0.4 + i * 0.08, 0.7 + i * 0.08)); c.style.transform = `scale(${k}) translateY(${Math.sin(lt * 3 + i) * 6}px)`; c.style.borderColor = Math.floor(lt * 4) % 6 === i ? T.LIME : 'rgba(255,255,255,.2)'; });
      const bk = M.popIn(btn, lt, 1.0, 0.4, 'translateX(-50%)'); btn.style.boxShadow = `0 0 0 ${8 + 8 * Math.abs(Math.sin(lt * 3.5))}px rgba(205,242,90,.18), 0 0 70px rgba(205,242,90,.5)`;
      cd.style.opacity = remap(lt, 1.4, 1.8);
    });
  });

  E.defineScene('end', (S) => {
    M.field(S, { speed: (lt) => M.lerp(16, 6, remap(lt, 0, 2)) });
    const t = add(S.layer, `Politics, <span style="color:${T.LIME};font-family:${T.SERIF};font-style:italic;font-weight:600">explained</span>`, `left:0;right:0;top:640px;text-align:center;font:900 100px/1 ${T.FONT};color:#fff`);
    const url = add(S.layer, 'poltok.netlify.app', `left:50%;top:800px;padding:30px 52px;border-radius:22px;background:${T.LIME};color:#0d1200;font:800 46px/1 ${T.FONT};white-space:nowrap`);
    const src = add(S.layer, 'Sources: Electoral Act 1856 (Vic) · National Museum of Australia · Commonwealth Electoral Act s158 · Australian National Dictionary Centre (2016) · SA Constitutional Amendment (Adult Suffrage) Act 1894 · AEC',
      `left:100px;right:100px;top:1380px;text-align:center;font:500 26px/1.45 ${T.FONT};color:#6b7385`);
    S.update((lt) => { M.popIn(t, lt, 0.05); M.popIn(url, lt, 0.5, 0.4, 'translateX(-50%)'); src.style.opacity = remap(lt, 0.9, 1.3); });
  });
}
