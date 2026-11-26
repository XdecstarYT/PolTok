// Extra live tables from Wikipedia's "Opinion polling for the 2026 Victorian state election": preferred premier, leader
// approval, sub-state regions, age / gender breakdowns, Legislative Council polling and published MRP seat projections.
// Pure parsing of the page's wikitext (fetched once in vic-live.js). Every row keeps its pollster and dates.

/** wikitext of the first table after a heading (matched by exact heading text, any level) */
function tableAfter(t, heading) {
  const re = new RegExp(`\\n=+\\s*${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*=+\\s*\\n`);
  const m = re.exec(t);
  if (!m) return null;
  const rest = t.slice(m.index + m[0].length);
  const nextHead = rest.search(/\n=+[^=\n]+=+\s*\n/);
  const scope = nextHead > 0 ? rest.slice(0, nextHead) : rest;
  const i = scope.indexOf('{|');
  if (i < 0) return null;
  const j = scope.indexOf('\n|}', i);
  return scope.slice(i, j > 0 ? j : undefined);
}

const stripRefs = (s) => s.replace(/<ref[^>]*\/>/g, '').replace(/<ref[\s\S]*?<\/ref>/g, '');
const clean = (s) => stripRefs(s).replace(/\{\{nowrap\|([^}]*)\}\}/gi, '$1').replace(/\{\{efn[^}]*\}\}/gi, '').replace(/\[\[([^|\]]*\|)?([^\]]*)\]\]/g, '$2').replace(/\[https?:\S+ ([^\]]*)\]/g, '$1').replace(/'''?/g, '').replace(/<[^>]+>/g, ' ').replace(/\{\{[^}]*\}\}/g, '').replace(/\s+/g, ' ').trim();
const num = (s) => { const m = String(s).replace(/−/g, '-').match(/([+-]?\d+(?:\.\d+)?)\s*%?/); return m ? +m[1] : null; };

/** body rows as arrays of { text, span } cells (header-only lines skipped) */
function rows(table) {
  if (!table) return [];
  const out = [];
  for (const row of table.split(/\n\|-[^\n]*/).slice(1)) {
    const cells = [];
    for (const line of row.split('\n')) {
      if (!/^[|!]/.test(line) || /^\|[-}+]/.test(line)) continue;
      if (/^!\s*(rowspan|colspan|width|class|data-sort|style="background:\{\{)/.test(line) && !/\d+%/.test(line)) continue;
      for (const part of line.slice(1).split(/\|\||!!/)) {
        const k = part.search(/\|(?!\|)/);
        const attrs = k >= 0 && /=/.test(part.slice(0, k)) && !/\[\[/.test(part.slice(0, k)) ? part.slice(0, k) : '';
        const body = attrs ? part.slice(k + 1) : part;
        const span = +((attrs.match(/colspan\s*=\s*"?(\d+)/) || [])[1] ?? 1);
        cells.push({ text: clean(body), span });
      }
    }
    if (cells.length >= 4) out.push(cells);
  }
  return out;
}
/** standard poll row: date, firm, client, sample, then numeric columns (colspans expanded as null) */
function pollRows(table, nVals) {
  return rows(table).map((c) => {
    const vals = [];
    for (const x of c.slice(4)) { vals.push(num(x.text)); for (let k = 1; k < x.span; k++) vals.push(null); }
    return { date: c[0].text, firm: c[1].text.split('/')[0].trim(), sample: num(c[3].text), v: vals.slice(0, nVals) };
  }).filter((r) => r.v.some((x) => x != null) && /\d/.test(r.date));
}

export function parseExtra(t) {
  const out = {};
  // preferred premier: Carroll, Wilson, Pickering, Don't know, (net)
  const pp = pollRows(tableAfter(t, 'Carroll vs Wilson vs Pickering'), 5);
  out.preferred = pp.slice(0, 12).map((r) => ({ date: r.date, firm: r.firm, Carroll: r.v[0], Wilson: r.v[1], Pickering: r.v[2], DK: r.v[3] }));
  // approval: second "Carroll vs Wilson vs Pickering" table (under Leadership approval)
  const ai = t.indexOf('===Leadership approval===');
  const ap = ai > 0 ? pollRows(tableAfter(t.slice(ai), 'Carroll vs Wilson vs Pickering'), 12) : [];
  out.approval = ap.slice(0, 12).map((r) => ({ date: r.date, firm: r.firm, Carroll: { pos: r.v[0], neg: r.v[1], net: r.v[3] }, Wilson: { pos: r.v[4], neg: r.v[5], net: r.v[7] }, Pickering: { pos: r.v[8], neg: r.v[9], net: r.v[11] } }));
  // sub-state regions + demographics: latest row of each (ALP, L/NP, GRN, ONP, IND, OTH)
  const latest = (h) => { const r = pollRows(tableAfter(t, h), 6)[0]; return r ? { date: r.date, firm: r.firm, ALP: r.v[0], LNP: r.v[1], GRN: r.v[2], ONP: r.v[3] } : null; };
  out.regions = Object.fromEntries([['inner', 'Inner Melbourne'], ['outer', 'Outer Melbourne'], ['provincial', 'Provincial'], ['rural', 'Rural']].map(([k, h]) => [k, latest(h)]).filter(([, v]) => v));
  out.age = Object.fromEntries(['18–34', '35–54', '55–64', '65+'].map((h) => [h, latest(h)]).filter(([, v]) => v));
  out.gender = Object.fromEntries([['women', 'Women'], ['men', 'Men']].map(([k, h]) => [k, latest(h)]).filter(([, v]) => v));
  // Legislative Council primary vote (latest 3 rows)
  const LC = ['ALP', 'LNP', 'GRN', 'LCV', 'DLP', 'LBT', 'SFF', 'ONP', 'FFP', 'AJP', 'VS', 'OTH'];
  out.council = pollRows(tableAfter(t, 'Legislative Council'), 12).slice(0, 3).map((r) => ({ date: r.date, firm: r.firm, ...Object.fromEntries(LC.map((k, i) => [k, r.v[i]])) }));
  // MRP seat projections (Assembly): ALP, LIB, NAT (or combined L/NP), GRN, ONP, IND
  const mi = t.indexOf('== Electorate projections (MRP) ==');
  if (mi > 0) {
    const mrp = rows(tableAfter(t.slice(mi), 'Legislative Assembly'));
    out.mrp = mrp.map((c) => {
      const v = []; for (const x of c.slice(5)) { v.push(num(x.text)); for (let k = 1; k < x.span; k++) v.push(null); }
      const lnp = (v[1] ?? 0) + (v[2] ?? 0);
      return { date: c[0].text, firm: c[1].text.split('/')[0].trim(), type: c[3].text, ALP: v[0], LNP: lnp, GRN: v[3], ONP: v[4], IND: v[5], result: c[c.length - 1]?.text ?? '' };
    }).filter((r) => r.ALP != null && !/election/i.test(r.firm + r.date));
  }
  return out;
}
