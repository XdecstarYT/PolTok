// Full Victorian state poll history, live from Wikipedia ("Opinion polling for the 2026 Victorian state election").
// Returns every row with primaries (ALP, LNP, GRN, ONP) and, where given, the ALP-v-L/NP two-party figure. Rows are newest
// first; the year is inferred by walking back through the months (the table only prints "20-23 Nov").
const PAGE = 'Opinion_polling_for_the_2026_Victorian_state_election';
const MON = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

export async function pollHistory() {
  const r = await fetch(`https://en.wikipedia.org/w/index.php?title=${PAGE}&action=raw&_=${Date.now()}`, { headers: { 'user-agent': 'poltok-reels/1.0' } });
  if (!r.ok) throw new Error('Wikipedia HTTP ' + r.status);
  const t = await r.text();
  const table = t.split(/\n\{\| class="wikitable/)[1].split('\n|}')[0];
  const rows = [];
  let year = 2026, lastMonth = 12;
  for (const row of table.split('\n|-').slice(1)) {
    const cells = row.split('\n').filter((l) => /^[|!](?![-}])/.test(l) && !/^!\s*(rowspan|colspan|width|data-sort)/.test(l)).map((l) => l.slice(1).replace(/^[^|]*\|(?!\|)/, (m) => (/=/.test(m) ? '' : m)).trim());
    const si = cells.findIndex((c) => /^[\d,]{3,6}$/.test(c.replace(/'/g, '')));
    if (si < 2) continue;
    const num = (c) => +((String(c || '').match(/(\d+(?:\.\d+)?)%?/) || [])[1]);
    const pct = cells.slice(si + 1, si + 5).map(num);
    if (pct.some((x) => !Number.isFinite(x))) continue;
    const date = cells[0].replace(/'''?/g, '').replace(/<[^>]+>/g, '').trim();
    const months = [...date.toLowerCase().matchAll(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/g)].map((m) => MON[m[1]]);
    const yr = date.match(/20\d\d/);
    const m = months.length ? months[months.length - 1] : lastMonth;
    if (yr) year = +yr[0]; else if (m - lastMonth >= 2) year -= 1; // ranges like 'Oct–Nov' can step forward one month
    lastMonth = m;
    const day = +((date.match(/(\d{1,2})\D*$/) || date.match(/(\d{1,2})/) || [, 15])[1]);
    const firm = cells[1].split('<ref')[0].replace(/\[\[([^|\]]*\|)?([^\]]*)\]\]/g, '$2').replace(/'''?/g, '').trim();
    // 2PP: the cells after primaries + IND + Others; ALP and L/NP
    const rest = cells.slice(si + 7).map(num);
    const tpp = Number.isFinite(rest[0]) && Number.isFinite(rest[1]) && Math.abs(rest[0] + rest[1] - 100) < 1.5 ? { ALP: rest[0], LNP: rest[1] } : null;
    rows.push({ date, firm, t: Date.UTC(year, m, Math.min(day, 28)), ALP: pct[0], LNP: pct[1], GRN: pct[2], ONP: pct[3], tpp });
  }
  if (rows.length < 10) throw new Error('poll history parse: too few rows (' + rows.length + ')');
  // newest first by fieldwork end date (the table isn't strictly ordered)
  return rows.map((r, i) => ({ r, i })).sort((a, b) => b.r.t - a.r.t || a.i - b.i).map((x) => x.r);
}

// average of the latest n polls, and an n-poll rolling trend (oldest → newest) sampled at k points
export function summarise(rows, n = 4, k = 12) {
  const avg = (list, key) => +(list.reduce((a, p) => a + p[key], 0) / list.length).toFixed(1);
  const latest = rows.slice(0, n);
  const K = ['ALP', 'LNP', 'GRN', 'ONP'];
  const now = Object.fromEntries(K.map((x) => [x, avg(latest, x)]));
  const tpps = rows.filter((r) => r.tpp).slice(0, n);
  const tpp = tpps.length ? { ALP: avg(tpps.map((r) => r.tpp), 'ALP'), LNP: avg(tpps.map((r) => r.tpp), 'LNP'), n: tpps.length } : null;
  const chron = [...rows].reverse();
  const trend = [];
  for (let i = 0; i < k; i++) {
    const j = Math.round(((n - 1) + i * (chron.length - n) / (k - 1)));
    const win = chron.slice(Math.max(0, j - n + 1), j + 1);
    trend.push({ t: chron[j].t, ...Object.fromEntries(K.map((x) => [x, avg(win, x)])) });
  }
  return { latest, now, tpp, trend, count: rows.length, first: chron[0] };
}
