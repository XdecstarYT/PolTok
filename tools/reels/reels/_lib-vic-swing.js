// Shared data for the "what if the polls are right?" reels: the 2022 Victorian pendulum + the live two-party swing.
// • 2022 two-candidate margins per district: VEC (src/data/au-vic.ts). Statewide 2022 2PP: Labor 55.00 / Coalition 45.00 (VEC).
// • Current 2PP: latest polls on Wikipedia that publish an ALP-v-Coalition 2PP (average of up to 4).
// • Method: uniform swing (the classic pendulum). Only Labor-v-Coalition contests can flip this way; Greens, independents and
//   One Nation are NOT modelled — the reels say so. It's a rough guide, not a seat projection.

const PAGE = 'Opinion_polling_for_the_2026_Victorian_state_election';
const ALP_2PP_2022 = 55.0;

const norm = (c) => (/Labor/i.test(c.pn) && !/DLP|Democratic Labour/i.test(c.pn) ? 'ALP'
  : /^Liberal$|Liberal Party|National/i.test(c.pn) ? 'LNP' : /Green/i.test(c.pn) ? 'GRN' : /Independent/i.test(c.pn) ? 'IND' : 'OTH');
const title = (k) => k.replace(/^vic-/, '').split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

export async function swingData() {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../../../src/data/au-vic.ts', import.meta.url), 'utf8');
  const m = src.match(/VIC_RESULTS_2022[^=]*=\s*(\{.*?\});\n/s);
  if (!m) throw new Error('could not read VIC_RESULTS_2022');
  const R = JSON.parse(m[1]);
  const seats = Object.entries(R).map(([k, r]) => {
    const f = [...r.final].sort((a, b) => b.v - a.v);
    return { seat: title(k), win: norm(f[0]), vs: norm(f[1]), margin: +(f[0].pct - 50).toFixed(2) };
  });
  const held = (p) => seats.filter((s) => s.win === p).length;

  // live 2PP: rows of the first polling table; 2PP cells follow the primary-vote cells, and may be '!' header cells
  const r = await fetch(`https://en.wikipedia.org/w/index.php?title=${PAGE}&action=raw&_=${Date.now()}`, { headers: { 'user-agent': 'poltok-reels/1.0' } });
  if (!r.ok) throw new Error('Wikipedia HTTP ' + r.status);
  const t = await r.text();
  const table = t.split(/\n\{\| class="wikitable/)[1].split('\n|}')[0];
  const polls = [];
  for (const row of table.split('\n|-').slice(1)) {
    const cells = row.split('\n').filter((l) => /^[|!](?![-}])/.test(l)).map((l) => l.slice(1).replace(/^[^|]*?=[^|]*?\|(?!\|)/, '').replace(/'''/g, '').trim());
    const si = cells.findIndex((c) => /^[\d,]{3,6}$/.test(c));
    if (si < 2) continue;
    const pc = cells.slice(si + 1).map((c) => { const x = c.match(/^(\d+(?:\.\d+)?)%$/); return x ? +x[1] : c.includes('n/a') ? NaN : null; }).filter((x) => x !== null);
    // primaries: ALP, LNP, GRN, ONP, (IND), (OTH) → 2PP pair is the first ALP+LNP pair that sums to ~100
    let tpp = null;
    for (let i = 4; i < pc.length - 1; i++) if (Number.isFinite(pc[i]) && Number.isFinite(pc[i + 1]) && Math.abs(pc[i] + pc[i + 1] - 100) < 0.6) { tpp = { ALP: pc[i], LNP: pc[i + 1] }; break; }
    if (!tpp) continue;
    polls.push({ firm: cells[1].split('<ref')[0].replace(/\[\[([^|\]]*\|)?([^\]]*)\]\]/g, '$2').trim(), ...tpp });
    if (polls.length === 4) break;
  }
  if (polls.length < 2) throw new Error('could not parse two-party-preferred polls');
  const lnp = +(polls.reduce((a, p) => a + p.LNP, 0) / polls.length).toFixed(1);
  const swing = +(lnp - (100 - ALP_2PP_2022)).toFixed(1);

  const pendulum = seats.filter((s) => s.win === 'ALP' && s.vs === 'LNP').sort((a, b) => a.margin - b.margin);
  const falls = pendulum.filter((s) => s.margin < swing);
  const band = (lo, hi) => pendulum.filter((s) => s.margin >= lo && s.margin < hi).map((s) => s.seat);
  return {
    polls, lnp, alp: +(100 - lnp).toFixed(1), swing, alp2022: ALP_2PP_2022,
    seats2022: { ALP: held('ALP'), LNP: held('LNP'), GRN: held('GRN'), IND: held('IND') },
    falls: falls.map((s) => ({ seat: s.seat, margin: s.margin })),
    after: { ALP: held('ALP') - falls.length, LNP: held('LNP') + falls.length },
    niddrie: pendulum.find((s) => s.seat === 'Niddrie'),
    bands: { b5: band(0, 5), b8: band(5, 8), bS: band(8, swing) },
  };
}
