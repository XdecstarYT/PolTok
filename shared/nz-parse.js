// NZ Electoral Commission results-page parsers — browser-safe, shared by server/nz.js and the
// /nz page (which retries directly from the visitor's browser if the server is blocked).
/* ------------------------------------------------ helpers ------------------------------------------------ */
export const nzSlug = (s) =>
  String(s || '')
    .replace(/\bMount\b/, 'Mt')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export const ent = (s) =>
  String(s || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&rsquo;|&#8217;/g, '’')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/\s+/g, ' ')
    .trim();
export const num = (s) => {
  const t = ent(s).replace(/,/g, '');
  if (!t || t === '-') return 0;
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : 0;
};

// Party name or EC abbreviation → PolTok party code.
const CODES = [
  [/^(NAT|National)/i, 'NAT'],
  [/^(LAB|Labour)/i, 'LAB'],
  [/^(GP|GRN|Green)/i, 'GRN'],
  [/^(ACT)\b/i, 'ACT'],
  [/^(NZF|New Zealand First)/i, 'NZF'],
  [/^(TPMAO|TPM|MAOR|Te P[aā]ti M[aā]ori|M[aā]ori Party)/i, 'TPM'],
  [/^(TOP|OPP|The Opportunit|Opportunit)/i, 'OPP'],
  [/^(IND|Independent)/i, 'IND'],
];
export function partyCode(name) {
  const n = String(name || '').trim();
  if (!n) return 'IND';
  for (const [re, c] of CODES) if (re.test(n)) return c;
  return n;
}

function statusOf(html) {
  const h = ent((html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i) || [])[1] || '');
  if (/official result/i.test(h)) return { status: 'final', heading: h };
  return { status: 'counting', heading: h };
}
function countedPct(html) {
  const t = ent(html);
  const m =
    t.match(/([\d.]+)\s*%\s*(?:of\s+)?(?:voting places|votes)?\s*(?:counted|reported|reporting)/i) ||
    t.match(/(?:counted|reported|reporting)[^%\d]{0,40}?(?:[\d,]+\s+)?([\d.]+)\s*%/i);
  return m ? Math.min(100, parseFloat(m[1])) : null;
}

/* ------------------------------------------------ parsers ------------------------------------------------ */
/** index.html → nationwide party table. */
export function parsePartyPage(html) {
  const table = (html.match(/<table[^>]*id="overall-results-table"[\s\S]*?<\/table>/i) || [])[0];
  if (!table) return null;
  const party = [];
  for (const row of table.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || []) {
    if (/text-indent/.test(row) || /<th/i.test(row)) continue; // component parties of a combined list
    const cells = (row.match(/<td[^>]*>[\s\S]*?<\/td>/gi) || []).map((c) => c);
    if (cells.length < 6) continue;
    const name = ent(cells[0]);
    if (!name || /^total/i.test(name)) continue;
    const votes = num(cells[1]);
    const e = num(cells[3]), l = num(cells[4]);
    party.push({ party: partyCode(name), name, votes, pct: num(cells[2]), electorateSeats: e, listSeats: l, totalSeats: num(cells[5]) || e + l });
  }
  return { ...statusOf(html), votesCountedPct: countedPct(html), party };
}

/** electorate-status.html → one row per electorate. */
export function parseStatusPage(html) {
  const table = (html.match(/<table[^>]*id="electorate-status-table"[\s\S]*?<\/table>/i) || [])[0];
  if (!table) return null;
  const out = [];
  for (const row of table.match(/<tr[^>]*id="electorate-row-\d+"[\s\S]*?<\/tr>/gi) || []) {
    const link = row.match(/href="\.?\/?(electorate-details-\d+\.html)"[^>]*>([\s\S]*?)<\/a>/i);
    const cells = (row.match(/<td[^>]*>[\s\S]*?<\/td>/gi) || []).map((c) => ent(c.replace(/<span class="mobile-show[^"]*"[^>]*>[\s\S]*?<\/span>/gi, '')));
    if (!link || cells.length < 4) continue;
    const name = ent(link[2]);
    const cand = (s) => {
      const m = s.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
      return m ? { name: m[1].trim(), party: partyCode(m[2]) } : { name: s, party: 'IND' };
    };
    const lead = cand(cells[1]), second = cand(cells[2]);
    const pctCell = cells.slice(3).find((c) => /%/.test(c));
    out.push({
      id: nzSlug(name),
      name,
      href: link[1],
      leader: lead.name || null,
      leadingParty: lead.name ? lead.party : null,
      second: second.name || null,
      secondParty: second.name ? second.party : null,
      margin: num(cells[3]),
      countedPct: pctCell ? parseFloat(pctCell) : null,
    });
  }
  return { ...statusOf(html), electorates: out };
}

/** electorate-details-NN.html → full candidate + party-vote tables. */
export function parseDetailsPage(html) {
  const st = statusOf(html);
  const name = st.heading.replace(/\s*-\s*(Official|Preliminary|Progress)[\s\S]*$/i, '').trim();
  const summary = (html.match(/<table[^>]*id="electorate_details_table"[\s\S]*?<\/table>/i) || [])[0] || '';
  const sRows = (summary.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || []).map((r) => (r.match(/<td[^>]*>[\s\S]*?<\/td>/gi) || []).map(ent));
  const counted = sRows.find((r) => /VOTES COUNTED/i.test(r[0] || ''));
  const body = (html.match(/<table[^>]*id="partyCandidatesResultsTable"[\s\S]*?<\/table>/i) || [])[0];
  if (!body) return null;
  const candidates = [], partyVotes = [];
  let candInformal = 0, partyInformal = 0;
  for (const row of body.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || []) {
    const tds = row.match(/<td[^>]*>[\s\S]*?<\/td>/gi) || [];
    if (tds.length < 2) continue;
    const pair = (td) => {
      const spans = td.match(/<span[^>]*>[\s\S]*?<\/span>/gi) || [];
      const label = ent((td.match(/<label[^>]*>([\s\S]*?)<\/label>/i) || [])[1] || '');
      return { label, name: ent(spans[0] || ''), votes: num(spans[1] || '') };
    };
    const c = pair(tds[0]), p = pair(tds[1]);
    if (/informal/i.test(c.label)) { candInformal = num(tds[0].match(/<span[^>]*>([\s\S]*?)<\/span>/i)?.[1]); partyInformal = num(tds[1].match(/<span[^>]*>([\s\S]*?)<\/span>/i)?.[1]); continue; }
    if (c.label || p.label) continue; // totals
    // Each candidate row is paired with their own party in the same row (blank = independent).
    if (c.name) candidates.push({ name: c.name, party: p.name ? partyCode(p.name) : 'IND', partyName: p.name || 'Independent', votes: c.votes });
    if (p.name) partyVotes.push({ party: partyCode(p.name), name: p.name, votes: p.votes });
  }
  candidates.sort((a, b) => b.votes - a.votes);
  partyVotes.sort((a, b) => b.votes - a.votes);
  const lead = candidates[0], second = candidates[1];
  return {
    ...st,
    id: nzSlug(name),
    name,
    votesCounted: counted ? num(counted[1]) : null,
    countedPct: counted ? num(counted[2]) : null,
    leader: lead?.name ?? null,
    leadingParty: lead?.party ?? null,
    margin: lead && second ? lead.votes - second.votes : null,
    candidates,
    partyVotes,
    informal: { candidate: candInformal, party: partyInformal },
  };
}

export const MAORI = new Set(['hauraki-waikato', 'ikaroa-rawhiti', 'tamaki-makaurau', 'te-tai-hauauru', 'te-tai-tokerau', 'te-tai-tonga', 'waiariki']);

/** Combine parsed index + status pages into the /api/nz/results shape (null = no votes yet). */
export function combineNzResults(idxHtml, statusHtml, base, pollsClose) {
  const p = parsePartyPage(idxHtml);
  const s = statusHtml ? parseStatusPage(statusHtml) : null;
  if (!p || !p.party.length || p.party.every((x) => !x.votes)) return null;
  const totalVotes = p.party.reduce((a, x) => a + x.votes, 0);
  return {
    status: p.status,
    heading: p.heading,
    updatedAt: Date.now(),
    votesCountedPct: p.votesCountedPct ?? (p.status === 'final' ? 100 : null),
    totalVotes,
    party: p.party,
    electorates: (s?.electorates || []).map(({ href, ...x }) => ({ ...x, type: MAORI.has(x.id) ? 'maori' : 'general', candidates: [] })),
    source: base,
    pollsClose,
  };
}

/* ------------------------------------------------ Wikipedia backup ------------------------------------------------ */
// Backup ONLY (community-edited, unofficial): the English Wikipedia election article's "Results"
// wikitext table, as used for 2023 ({{election table}} / wikitable rows that start with
// {{party name with colour|…}}; columns: party votes, %, ±, list seats, electorate votes, %, ±,
// electorate seats, '''total''', ±). Returns null unless at least one party has votes.
const wtCell = (c) =>
  String(c || '')
    .replace(/<ref[^>]*\/>|<ref[\s\S]*?<\/ref>/gi, '')
    .replace(/\{\{(?:increase|decrease|steady|nochange)\}\}/gi, '')
    .replace(/'''?/g, '')
    .replace(/^[^|[{]*\|(?![|])/, (m) => (/=/.test(m) ? '' : m)) // drop "style=…|" attribute prefix
    .trim();
export function parseWikipediaResults(wikitext) {
  const t = String(wikitext || '');
  const at = t.search(/^==\s*Results\s*==/m);
  if (at < 0) return null;
  const next = t.slice(at + 5).search(/^==[^=]/m);
  const sec = next < 0 ? t.slice(at) : t.slice(at, at + 5 + next);
  const party = [];
  for (const row of sec.split(/\n\|-[^\n]*/)) {
    const m = row.match(/\{\{\s*party name with colou?r\s*\|\s*([^}|]+)/i);
    if (!m) continue;
    const name = m[1].trim();
    const cells = row
      .slice(row.indexOf(m[0]) + m[0].length)
      .replace(/^[^\n]*/, '')
      .split(/\n\||\|\|/)
      .map(wtCell)
      .slice(1);
    const n = cells.map((c) => num(c.replace(/^\s*[+−–-]?\s*$/, '')));
    const votes = n[0], pct = n[1];
    if (!votes) continue;
    const list = n[3] || 0, elec = n[7] || 0, total = n[8] || elec + list;
    party.push({ party: partyCode(name.replace(/^New Zealand (?=National|Labour)/, '')), name, votes, pct, electorateSeats: elec, listSeats: list, totalSeats: total });
  }
  if (!party.length || party.every((p) => !p.votes)) return null;
  party.sort((a, b) => b.votes - a.votes);
  return { party };
}
