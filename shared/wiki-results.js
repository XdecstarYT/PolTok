// Parse the results block of a Wikipedia election article's infobox (raw wikitext) into a
// neutral shape. Used for "latest results" of elections worldwide. Everything is labelled
// unofficial/community-edited by callers; nothing is invented — missing fields stay null.
const plain = (s) =>
  String(s || '')
    .replace(/<ref[^>]*\/>/gi, '')
    .replace(/<ref[\s\S]*?<\/ref>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/'''?/g, '')
    .replace(/\{\{\s*(?:nowrap|small|nobold)\s*\|([^{}]*)\}\}/gi, '$1')
    .replace(/\{\{[^{}]*\}\}/g, '')
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const num = (s) => {
  const m = plain(s).replace(/[,\s]/g, '').match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
};

/** Extract the first {{Infobox election ...}} block (balanced braces). */
export function infoboxBlock(wikitext) {
  const t = String(wikitext || '');
  const i = t.search(/\{\{\s*Infobox (?:election|legislative election)/i);
  if (i < 0) return '';
  let d = 0;
  for (let j = i; j < t.length - 1; j++) {
    if (t[j] === '{' && t[j + 1] === '{') { d++; j++; } else if (t[j] === '}' && t[j + 1] === '}') { d--; j++; if (d === 0) return t.slice(i, j + 1); }
  }
  return '';
}

/** Parse infobox fields into { kind, rows[], turnout } or null when the infobox has no results yet. */
export function parseElectionInfobox(wikitext) {
  const box = infoboxBlock(wikitext);
  if (!box) return null;
  const f = {};
  // split on top-level pipes only (ignore pipes inside nested templates/links)
  let depth = 0, cur = '';
  const parts = [];
  for (let j = 2; j < box.length - 2; j++) {
    const c = box[j], n = box[j + 1];
    if ((c === '{' && n === '{') || (c === '[' && n === '[')) { depth++; cur += c + n; j++; continue; }
    if ((c === '}' && n === '}') || (c === ']' && n === ']')) { depth--; cur += c + n; j++; continue; }
    if (c === '|' && depth === 0) { parts.push(cur); cur = ''; continue; }
    cur += c;
  }
  parts.push(cur);
  for (const p of parts) {
    const m = p.match(/^\s*([\w ]+?)\s*=([\s\S]*)$/);
    if (m) f[m[1].trim().toLowerCase()] = m[2].trim();
  }
  const rows = [];
  for (let i = 1; i <= 24; i++) {
    const party = plain(f[`party${i}`] || f[`alliance${i}`] || '');
    const candidate = plain(f[`nominee${i}`] || f[`candidate${i}`] || f[`leader${i}`] || '');
    if (!party && !candidate) continue;
    const votes = num(f[`popular_vote${i}`] ?? f[`votes${i}`]);
    const pctRaw = f[`percentage${i}`] ?? f[`vote_share${i}`];
    const pct = pctRaw != null ? num(pctRaw) : null;
    const seats = num(f[`seats${i}`] ?? f[`seats_after${i}`]);
    const change = null; // +/- comes from {{increase}} templates we strip; omit rather than show an unsigned number
    if (votes == null && pct == null && seats == null) continue;
    rows.push({ party: party || null, candidate: candidate || null, votes, pct, seats, seatChange: change });
  }
  if (!rows.length) return null;
  const kind = rows.some((r) => r.seats != null) ? 'legislative' : 'executive';
  rows.sort((a, b) => (b.seats ?? -1) - (a.seats ?? -1) || (b.pct ?? -1) - (a.pct ?? -1));
  return {
    kind,
    rows,
    turnout: num(f.turnout),
    seatsTotal: num(f.seats_for_election),
    majority: num(f.majority_seats),
  };
}
