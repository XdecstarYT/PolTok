// Shared data for the "what if the polls are right?" reels: the 2022 Victorian pendulum + the live two-party swing.
// • 2022 two-party margins per district: the official post-election pendulum (ABC/Antony Green, as tabled in Wikipedia's
//   "2022 Victorian state election" article). NOTE: src/data/au-vic.ts `final` is NOT usable for margins — for 29 districts it
//   holds the preference count at the point the winner crossed 50%, not the final two-candidate result.
//   Statewide 2022 2PP: Labor 55.00 / Coalition 45.00 (VEC).
// • Current 2PP: latest polls on Wikipedia that publish an ALP-v-Coalition 2PP (average of up to 4).
// • Method: uniform swing (the classic pendulum). Only Labor-v-Coalition contests can flip this way; Greens, independents and
//   One Nation are NOT modelled — the reels say so. It's a rough guide, not a seat projection.

const PAGE = 'Opinion_polling_for_the_2026_Victorian_state_election';
const PENDULUM_PAGE = '2022_Victorian_state_election';
const ALP_2PP_2022 = 55.0;

// Parse the "Post-election pendulum" tables: rows of [seat, member, party, "x.x% [v GRN]"].
async function pendulum2022() {
  const r = await fetch(`https://en.wikipedia.org/w/index.php?title=${PENDULUM_PAGE}&action=raw&_=${Date.now()}`, { headers: { 'user-agent': 'poltok-reels/1.0' } });
  if (!r.ok) throw new Error('Wikipedia HTTP ' + r.status);
  const t = await r.text();
  const i = t.indexOf('===Post-election pendulum===');
  if (i < 0) throw new Error('post-election pendulum section not found');
  const sec = t.slice(i);
  const out = [];
  for (const row of sec.split('\n|-')) {
    const cells = row.split('\n').filter((l) => /^\|(?![-}])/.test(l)).map((l) => {
      const c = l.slice(1); const k = c.indexOf('|');
      return (k >= 0 && c.slice(0, k).includes('=') ? c.slice(k + 1) : c).trim();
    });
    if (cells.length < 4) continue;
    const m = cells[3].match(/^([\d.]+)%(?:\s*v\s*(\w+))?/);
    if (!m) continue;
    const seat = cells[0].replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1').trim();
    const party = cells[2].replace(/'''/g, '').trim();
    out.push({ seat, win: party === 'LIB' || party === 'NAT' ? 'LNP' : party, vs: m[2] ? (m[2] === 'LIB' || m[2] === 'NAT' ? 'LNP' : m[2]) : (party === 'ALP' ? 'LNP' : 'ALP'), margin: +m[1] });
    if (out.length === 88) break;
  }
  if (out.length !== 88) throw new Error(`pendulum parse: expected 88 seats, got ${out.length}`);
  return out;
}

export async function swingData() {
  const seats = await pendulum2022();
  const held = (p) => seats.filter((s) => s.win === p).length;
  if (held('ALP') !== 56) throw new Error('pendulum sanity check: Labor should hold 56 in 2022, got ' + held('ALP'));

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
