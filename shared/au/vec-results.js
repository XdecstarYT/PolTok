// Election-night results reader for the 2026 Victorian state election, from the VEC's own public district results
// pages (same layout as the 2022 pages that scripts/gen-au-vic.py parses). VEC publishes no public JSON feed; these
// pages are what the public sees. Nothing is ever invented: a district with no published figures is simply absent.
// Output shape matches server/au.js parseResultsPayload: { status, seats: { [id]: { counted, tcp?, leader?, called?, fp? } } }.

const BASE = process.env.VEC_RESULTS_BASE || 'https://www.vec.vic.gov.au/results/state-election-results/2026-state-election-results/results-by-district/';
const UA = { 'user-agent': 'Mozilla/5.0 (PolTok results reader; +https://poltok.netlify.app)' };
const PARTY = [[/labor/i, 'ALP'], [/liberal(?! democrat)/i, 'LIB'], [/national/i, 'NAT'], [/greens/i, 'GRN'], [/one nation/i, 'ONP']];
const pcode = (p) => (!p ? 'IND' : PARTY.find(([re]) => re.test(p))?.[1] ?? 'OTH');
const ROW = /([A-Z][A-Z'’\- ]+), ([A-Z][^0-9]*?) ([\d,]+) ([\d.]+)%/g;
const PARTY_TAIL = / (Liberal|Australian|National|Victorian|Animal|Family|Freedom|Democratic|Legalise|Shooters|Libertarian|Reason|Sustainable|Health|Angry|New Democrats|Companions|Transport|United|Pauline|Labour|The Greens|Climate|Safety|Fusion).*$/;

const text = (html) => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").replace(/\s+/g, ' ');
const num = (s) => Number(String(s).replace(/,/g, ''));

function rows(seg) {
  const out = [];
  for (const g of seg.matchAll(ROW)) {
    const rest = g[2].trim();
    const pm = PARTY_TAIL.exec(' ' + rest);
    const party = pm ? pm[0].trim() : '';
    out.push({ name: `${(pm ? rest.slice(0, pm.index - 1) : rest).trim()} ${g[1].charAt(0)}${g[1].slice(1).toLowerCase()}`.trim(), party: pcode(party), v: num(g[3]), pct: Number(g[4]) });
  }
  return out;
}

/** Parse one district results page. Returns null when the page has no counted votes yet. */
export function parseDistrictPage(html) {
  const t = text(html);
  const enrol = num((/Total enrolment[^:]*: ([\d,]+)/.exec(t) || [])[1] ?? NaN);
  const formal = num((/Formal votes: ([\d,]+)/.exec(t) || [])[1] ?? NaN);
  const informal = num((/Informal votes: ([\d,]+)/.exec(t) || [])[1] ?? NaN);
  const i = t.indexOf('First preference votes');
  const fp = i >= 0 ? rows(t.slice(i, (t.indexOf('Recheck', i) + 1 || t.indexOf('Two candidate', i) + 1 || t.length + 1) - 1)) : [];
  // finished seats: the preference distribution replaces the 2CP count; during counting: the 2CP table
  const pd = t.indexOf('Preference distribution results');
  const pdDone = pd >= 0 && /finished the preference distribution/i.test(t.slice(pd, pd + 200));
  const c = pdDone ? pd : t.indexOf('Two candidate preferred results Candidate');
  const end = t.indexOf('Distributions', c) > 0 ? t.indexOf('Distributions', c) : t.indexOf('Two candidate preferred results by', c);
  const tcpRows = c >= 0 ? rows(t.slice(c, end > c ? end : c + 600)) : [];
  const fpVotes = fp.reduce((a, r) => a + r.v, 0);
  if (!fpVotes && !tcpRows.length) return null;
  const counted = Number.isFinite(enrol) && enrol > 0 ? +(((Number.isFinite(formal) ? formal : fpVotes) + (Number.isFinite(informal) ? informal : 0)) / enrol * 100).toFixed(1) : fpVotes;
  const seat = { counted, fp: fp.sort((a, b) => b.v - a.v).slice(0, 8).map((r) => ({ party: r.party, name: r.name, pct: r.pct })) };
  if (tcpRows.length >= 2) {
    const tcp = tcpRows.slice(0, 2).map((r) => ({ party: r.party, name: r.name, pct: r.pct })).sort((a, b) => b.pct - a.pct);
    seat.tcp = tcp; seat.leader = tcp[0].party;
    // conservative call: a big two-candidate lead with most of the roll counted, or the page says a candidate is elected
    if (pdDone || (typeof counted === 'number' && counted >= 55 && counted <= 100 && tcp[0].pct - tcp[1].pct >= 8)) seat.called = tcp[0].party;
    if (pdDone) seat.final = true;
  } else if (fp.length) {
    seat.leader = fp[0].party; // first-preference leader only; not a call
  }
  return seat;
}

/** Fetch every district page (bounded concurrency). ids: ['vic-albert-park', …]. */
export async function fetchVecDistricts(ids, { concurrency = 10, timeoutMs = 8000 } = {}) {
  const seats = {}; let ok = 0, missing = 0, failed = 0;
  const queue = [...ids];
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (queue.length) {
      const id = queue.shift();
      try {
        const r = await fetch(BASE + id.replace(/^vic-/, '') + '-district-results', { headers: UA, signal: AbortSignal.timeout(timeoutMs) });
        if (r.status === 404) { missing++; continue; }
        if (!r.ok) { failed++; continue; }
        const s = parseDistrictPage(await r.text());
        if (s) { seats[id] = s; ok++; } else missing++;
      } catch { failed++; }
    }
  }));
  const called = Object.values(seats).filter((s) => s.called).length;
  return { status: called === ids.length ? 'final' : 'counting', updatedAt: Date.now(), source: 'Victorian Electoral Commission district results pages', seats, stats: { ok, missing, failed } };
}

/** Diff two snapshots into feed events: a new leader, a seat called, or first results in. Pure (testable). */
export function diffResults(prev, next, at = Date.now()) {
  const ev = [];
  for (const [id, s] of Object.entries(next?.seats ?? {})) {
    const p = prev?.seats?.[id];
    if (s.called && s.called !== p?.called) ev.push({ at, id, kind: 'called', party: s.called, prev: p?.called ?? p?.leader ?? null });
    else if (!p && s.leader) ev.push({ at, id, kind: 'first', party: s.leader });
    else if (p && s.leader && p.leader && s.leader !== p.leader && !s.called) ev.push({ at, id, kind: 'lead', party: s.leader, prev: p.leader });
  }
  return ev;
}
