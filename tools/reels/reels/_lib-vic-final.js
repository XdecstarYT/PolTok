// Data for the final Victorian election update. Everything live at render time:
//  • polls: full history (Wikipedia) → newest poll, Feb→now trend, latest-4 primary average, latest-4 two-party average
//  • seats: 2022 official pendulum + uniform swing from that two-party average → every district's projected winner
//    (Labor-v-Coalition contests only; Greens/other seats held), statewide and Melbourne-only counts
//  • early votes: VEC "early and postal vote statistics" page, daily early votes
import { pollHistory, summarise } from './_lib-vic-polls.js';
import { pendulum2022, ALP_2PP_2022 } from './_lib-vic-swing.js';

async function earlyVotes() {
  const r = await fetch('https://www.vec.vic.gov.au/voting/2026-state-election/voting-statistics', { headers: { 'user-agent': 'Mozilla/5.0 poltok-reels/1.0' } });
  if (!r.ok) throw new Error('VEC HTTP ' + r.status);
  const html = await r.text();
  const txt = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
  const days = [...txt.matchAll(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday) (\d{1,2}) November ([\d,]+) ([\d,]+)/g)]
    .map((m) => ({ day: m[1].slice(0, 3), date: +m[2], early: +m[3].replace(/,/g, '') }));
  if (days.length < 3) throw new Error('VEC early vote parse failed');
  const upd = (txt.match(/Last updated: (\d{1,2} \w+ 20\d\d)/) || [])[1] || '';
  return { days, total: days.reduce((a, d) => a + d.early, 0), updated: upd };
}

export async function finalData() {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../../../src/data/au-vic.ts', import.meta.url), 'utf8');
  const REG = JSON.parse(src.match(/VIC_REGION_OF[^=]*=\s*(\{[^;]*\})/s)[1]);
  const [rows, seats, early] = await Promise.all([pollHistory(), pendulum2022(), earlyVotes()]);
  const s = summarise(rows, 4, 14);
  if (!s.tpp) throw new Error('no two-party polls');
  const newest = rows[0];
  const alpMin = Math.min(...rows.map((r) => r.ALP));
  const swing = +(ALP_2PP_2022 - s.tpp.ALP).toFixed(1);
  const slug = (x) => 'vic-' + x.replace(/\{\{.*$/, '').trim().toLowerCase().replace(/ /g, '-');
  const proj = {}; // tile id → { win2022, winNow, margin, vs, region }
  for (const x of seats) {
    const id = slug(x.seat);
    if (!REG[id]) throw new Error('no region for ' + x.seat);
    const flips = x.win === 'ALP' && x.vs === 'LNP' && x.margin < swing;
    proj[id] = { seat: x.seat.replace(/\{\{.*$/, '').trim(), win2022: x.win, winNow: flips ? 'LNP' : x.win, margin: x.margin, vs: x.vs, metro: /Metropolitan/.test(REG[id]) };
  }
  const count = (f) => { const o = { ALP: 0, LNP: 0, GRN: 0, OTH: 0 }; for (const p of Object.values(proj).filter(f)) o[p.winNow in o ? p.winNow : 'OTH']++; return o; };
  const now = count(() => true), metro = count((p) => p.metro);
  const niddrie = proj['vic-niddrie'];
  // knife-edge: Labor-v-Coalition Labor seats whose margin is closest to the swing
  const edge = Object.values(proj).filter((p) => p.win2022 === 'ALP' && p.vs === 'LNP').sort((a, b) => Math.abs(a.margin - swing) - Math.abs(b.margin - swing)).slice(0, 4)
    .sort((a, b) => a.margin - b.margin).map((p) => ({ seat: p.seat, margin: p.margin, falls: p.margin < swing }));
  return {
    days: Math.round((Date.UTC(2026, 10, 28) - Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())) / 864e5),
    newest: { firm: newest.firm.split('/')[0].trim(), date: newest.date, ALP: newest.ALP, LNP: newest.LNP, GRN: newest.GRN, ONP: newest.ONP, tpp: newest.tpp, alpLow: newest.ALP <= alpMin },
    avg: s.now, tpp: s.tpp, latest: s.latest.map((r) => r.firm.split('/')[0].trim()), trend: s.trend, polls: s.count,
    swing, proj, now, metro, niddrie: { margin: niddrie.margin, falls: niddrie.winNow !== 'ALP' }, edge, early,
  };
}
