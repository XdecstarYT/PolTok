// Parliament bill tracker API (agent 9). Shared by the Node server (server/index.js) and the
// Netlify functions (netlify/functions/parliament.mjs) — same JSON shapes either way.
//
//   GET /api/parliament/status              { us:{...}, au:{...} }  which sources/keys are configured
//   GET /api/parliament/us/bills?q=&limit=  { bills: Bill[], source, fetchedAt, missing[], notes[] }
//   GET /api/parliament/us/bill/:id         { bill: BillDetail }      id = "119-hr-1"
//   GET /api/parliament/us/votes            { votes: Vote[], missing[], notes[] }
//   GET /api/parliament/us/floor            { house: FloorItem[], senate: FloorItem[] }
//   GET /api/parliament/au/bills?q=         { bills: Bill[], ... }
//   GET /api/parliament/au/bill/:id         { bill: BillDetail }      id = APH bill id (r7548) or FRL act id (C2026A00104)
//   GET /api/parliament/au/votes            { votes: Vote[], missing[] }   They Vote For You (needs TVFY_API_KEY)
//
// Live sources (all verified 2026-11-04):
//   US  — GovInfo BILLSTATUS bulk data (keyless; sponsors, actions, subjects, text versions, roll calls)
//         https://www.govinfo.gov/bulkdata/json/BILLSTATUS/119/{hr,s,hjres,sjres}
//       — api.congress.gov v3 (optional, CONGRESS_API_KEY from api.data.gov — DEMO_KEY is shared and
//         rate-limited to ~10 req/h, so it is not used) for the "recently updated" ordering
//       — clerk.house.gov roll-call XML (party breakdowns), senate.gov LIS vote menu (best effort),
//         falling back to Voteview CSV (voteview.com) with party breakdowns
//       — congress.gov RSS: house-floor-today / senate-floor-today
//   AU  — APH ParlInfo "bills currently before Parliament" RSS (best effort: aph.gov.au sits behind a WAF)
//       — Federal Register of Legislation API (keyless): Acts as made = bills that received assent
//       — They Vote For You API (TVFY_API_KEY) for divisions with party breakdown
// Never fabricates: a failed source yields an empty list plus a `missing`/`notes` entry.
import { XMLParser } from 'fast-xml-parser';

const UA = 'PolTok/1.0 (+parliament tracker)';
const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  textNodeName: '#text',
  isArray: (name) => ['item', 'recordedVote', 'totals-by-party', 'recorded-vote'].includes(name),
});
const arr = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);
const txt = (x) => (x == null ? '' : typeof x === 'object' ? String(x['#text'] ?? '') : String(x)).trim();

/* ----------------------------------- cache & fetch ----------------------------------- */
const cache = new Map();
async function cached(key, ttlMs, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value;
  if (hit?.pending) return hit.pending;
  const pending = fn()
    .then((value) => {
      cache.set(key, { at: Date.now(), value });
      if (cache.size > 800) cache.delete(cache.keys().next().value);
      return value;
    })
    .catch((e) => {
      if (hit) cache.set(key, hit);
      else cache.delete(key);
      throw e;
    });
  cache.set(key, { ...(hit || { at: 0 }), pending });
  return pending;
}
async function get(url, { timeout = 8000, accept = '*/*', headers = {} } = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA, accept, ...headers }, signal: ctl.signal, redirect: 'follow' });
    if (!r.ok) throw new Error(`${r.status} from ${new URL(url).host}`);
    return await r.text();
  } finally {
    clearTimeout(t);
  }
}
async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        try {
          out[k] = await fn(items[k]);
        } catch {
          out[k] = null;
        }
      }
    }),
  );
  return out;
}

/* ----------------------------------------- US ----------------------------------------- */
const CONGRESS = 119;
const TYPE_LABEL = { HR: 'H.R.', S: 'S.', HJRES: 'H.J.Res.', SJRES: 'S.J.Res.', HRES: 'H.Res.', SRES: 'S.Res.', HCONRES: 'H.Con.Res.', SCONRES: 'S.Con.Res.' };
const CG_TYPE = { HR: 'house-bill', S: 'senate-bill', HJRES: 'house-joint-resolution', SJRES: 'senate-joint-resolution', HRES: 'house-resolution', SRES: 'senate-resolution', HCONRES: 'house-concurrent-resolution', SCONRES: 'senate-concurrent-resolution' };
export const STAGES = ['Introduced', 'In committee', 'Passed one chamber', 'Passed both chambers', 'Signed into law'];
const AU_STAGES = ['Introduced', 'In committee', 'Passed one house', 'Passed both houses', 'Royal Assent'];

function usStage(actions, laws, enrolled) {
  if (laws.length || actions.some((a) => /became (public|private) law|signed by president/i.test(a.text))) return { stage: 4 };
  const vetoed = actions.some((a) => /vetoed by president/i.test(a.text));
  if (enrolled || actions.some((a) => /presented to president|cleared for white house|enrolled bill signed/i.test(a.text))) return { stage: 3, vetoed };
  const passedH = actions.some((a) => /passed\/agreed to in house|(on passage|on motion to suspend the rules and pass).*(passed|agreed to)/i.test(a.text));
  const passedS = actions.some((a) => /passed\/agreed to in senate|passed senate/i.test(a.text));
  if (passedH && passedS) return { stage: 3, vetoed };
  if (passedH || passedS) return { stage: 2, passed: passedH ? 'House' : 'Senate' };
  if (actions.some((a) => /referred to|reported|committee|placed on .*calendar/i.test(a.text))) return { stage: 1 };
  return { stage: 0 };
}

function parseBillStatus(src) {
  const doc = xml.parse(src);
  const b = doc?.billStatus?.bill;
  if (!b) throw new Error('bad BILLSTATUS');
  const type = txt(b.type).toUpperCase();
  const number = txt(b.number);
  const actions = arr(b.actions?.item)
    .map((a) => ({
      date: txt(a.actionDate),
      time: txt(a.actionTime) || undefined,
      text: txt(a.text),
      chamber: /senate/i.test(txt(a.sourceSystem?.name)) ? 'Senate' : /house/i.test(txt(a.sourceSystem?.name)) ? 'House' : undefined,
      votes: arr(a.recordedVotes?.recordedVote).map((v) => ({ chamber: txt(v.chamber), roll: Number(txt(v.rollNumber)), url: txt(v.url), date: txt(v.date) })),
    }))
    .filter((a) => a.date && a.text);
  // dedupe (House + Library of Congress often record the same action twice)
  const seen = new Set();
  const uniq = actions.filter((a) => {
    const k = a.date + a.text.slice(0, 80);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  uniq.sort((x, y) => (y.date + (y.time || '')).localeCompare(x.date + (x.time || '')));
  const laws = arr(b.laws?.item).map((l) => `${txt(l.type)} ${txt(l.number)}`);
  const texts = arr(b.textVersions?.item)
    .map((t) => ({ label: txt(t.type), date: txt(t.date).slice(0, 10), url: arr(t.formats?.item).map((f) => txt(f.url)).find((u) => /\.pdf$/i.test(u)) || arr(t.formats?.item).map((f) => txt(f.url))[0] || '' }))
    .filter((t) => t.url);
  const enrolled = texts.some((t) => /enrolled/i.test(t.label));
  const st = usStage(uniq, laws, enrolled);
  const sp = arr(b.sponsors?.item)[0];
  const titles = arr(b.titles?.item);
  const short = titles.find((t) => /short title/i.test(txt(t.titleType)) && /as introduced|as passed|as enacted/i.test(txt(t.titleType)));
  const latest = b.latestAction ? { date: txt(b.latestAction.actionDate), text: txt(b.latestAction.text) } : uniq[0] ? { date: uniq[0].date, text: uniq[0].text } : null;
  const label = `${TYPE_LABEL[type] || type} ${number}`;
  const cosponsors = Number(txt(b.cosponsors?.count) || 0) || arr(b.cosponsors?.item).length;
  return {
    id: `${CONGRESS}-${type.toLowerCase()}-${number}`,
    country: 'us',
    label,
    title: txt(b.title),
    shortTitle: short ? txt(short.title) : undefined,
    chamber: txt(b.originChamber) || (type.startsWith('S') ? 'Senate' : 'House'),
    introduced: txt(b.introducedDate),
    updated: txt(b.updateDateIncludingText) || txt(b.updateDate),
    latestAction: latest,
    stage: st.stage,
    stageLabel: st.vetoed && st.stage === 3 ? 'Vetoed / sent to President' : st.stage === 2 ? `Passed ${st.passed}` : STAGES[st.stage],
    stages: STAGES,
    sponsor: sp ? { name: txt(sp.fullName).replace(/\s*\[.*\]$/, ''), party: txt(sp.party), state: txt(sp.state), district: txt(sp.district) || undefined } : undefined,
    cosponsors,
    policyArea: txt(b.policyArea?.name) || undefined,
    subjects: arr(b.subjects?.legislativeSubjects?.item).map((s) => txt(s.name)).filter(Boolean),
    committees: arr(b.committees?.item).map((c) => txt(c.name)).filter(Boolean),
    laws,
    url: `https://www.congress.gov/bill/${CONGRESS}th-congress/${CG_TYPE[type] || 'house-bill'}/${number}`,
    actions: uniq,
    texts,
    summary: (() => {
      const s = arr(b.summaries?.summary || b.summaries?.item).slice(-1)[0];
      return s ? txt(s.text || s.cdata).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1600) : undefined;
    })(),
  };
}

const BILLSTATUS = (type, num) => `https://www.govinfo.gov/bulkdata/BILLSTATUS/${CONGRESS}/${type.toLowerCase()}/BILLSTATUS-${CONGRESS}${type.toLowerCase()}${num}.xml`;
const fetchBill = (type, num) => cached(`bs:${type}${num}`, 20 * 60e3, async () => parseBillStatus(await get(BILLSTATUS(type, num), { accept: 'application/xml' })));

function parseFrlTime(s) {
  // "31-Oct-2026 20:22"
  const m = /^(\d+)-(\w{3})-(\d{4}) (\d+):(\d+)/.exec(s || '');
  if (!m) return 0;
  return Date.parse(`${m[2]} ${m[1]} ${m[3]} ${m[4]}:${m[5]} UTC`) || 0;
}

/** Recently-updated bill ids: congress.gov API when keyed, else GovInfo BILLSTATUS bulk listings (by file mtime). */
async function recentIds(env) {
  const key = env.CONGRESS_API_KEY;
  if (key) {
    try {
      return await cached('cg:recent', 10 * 60e3, async () => {
        const j = JSON.parse(await get(`https://api.congress.gov/v3/bill/${CONGRESS}?format=json&limit=250&sort=updateDate+desc&api_key=${encodeURIComponent(key)}`, { accept: 'application/json' }));
        return arr(j.bills).map((b) => ({ type: String(b.type).toUpperCase(), num: String(b.number), t: Date.parse(b.updateDateIncludingText || b.updateDate) || 0 }));
      });
    } catch {
      /* fall through to bulk data */
    }
  }
  return cached('bulk:recent', 30 * 60e3, async () => {
    const lists = await Promise.all(
      ['hr', 's', 'hjres', 'sjres'].map((t) =>
        get(`https://www.govinfo.gov/bulkdata/json/BILLSTATUS/${CONGRESS}/${t}`, { accept: 'application/json', timeout: 9000 })
          .then((s) => JSON.parse(s).files.map((f) => {
            const m = /BILLSTATUS-\d+([a-z]+)(\d+)\.xml/.exec(f.name || '');
            return m ? { type: m[1].toUpperCase(), num: m[2], t: parseFrlTime(f.formattedLastModifiedTime) } : null;
          }).filter(Boolean))
          .catch(() => []),
      ),
    );
    const all = lists.flat().sort((a, b) => b.t - a.t);
    if (!all.length) throw new Error('GovInfo bulk data unreachable');
    return all;
  });
}

const slim = (b) => {
  if (!b) return b;
  const { actions, texts, summary, ...rest } = b;
  return { ...rest, textUrl: texts?.[texts.length - 1]?.url, actionCount: actions?.length ?? 0 };
};

const BILL_RE = /^\s*(h\.?\s*r\.?|s\.?|h\.?\s*j\.?\s*res\.?|s\.?\s*j\.?\s*res\.?)\s*(\d+)\s*$/i;

async function usBills(params, env) {
  const limit = Math.min(Number(params.get('limit')) || 30, 60);
  const q = (params.get('q') || '').trim();
  const notes = [];
  const missing = [];
  if (!env.CONGRESS_API_KEY) notes.push('Using GovInfo bulk Bill Status data (no key needed). Set CONGRESS_API_KEY (free, api.data.gov) to order by congress.gov update time.');
  // Direct lookup "HR 1234" / "S. 55"
  const m = BILL_RE.exec(q);
  if (m) {
    const type = m[1].replace(/[\s.]/g, '').toUpperCase();
    try {
      const b = await fetchBill(type, m[2]);
      return { bills: [slim(b)], source: 'GovInfo BILLSTATUS', fetchedAt: Date.now(), missing, notes };
    } catch {
      return { bills: [], source: 'GovInfo BILLSTATUS', fetchedAt: Date.now(), missing, notes: [...notes, `No Bill Status record for ${q} in the ${CONGRESS}th Congress.`] };
    }
  }
  const ids = (await recentIds(env)).slice(0, limit);
  const bills = (await pool(ids, 12, (x) => fetchBill(x.type, x.num))).filter(Boolean).map(slim);
  bills.sort((a, b) => (b.latestAction?.date || '').localeCompare(a.latestAction?.date || ''));
  return { bills, source: env.CONGRESS_API_KEY ? 'congress.gov API + GovInfo BILLSTATUS' : 'GovInfo BILLSTATUS (bulk data)', fetchedAt: Date.now(), missing, notes };
}

async function usBill(id) {
  const m = /^(\d+)-([a-z]+)-(\d+)$/i.exec(id);
  if (!m || Number(m[1]) !== CONGRESS) return null;
  const b = await fetchBill(m[2].toUpperCase(), m[3]);
  // attach House roll-call party breakdowns (Senate XML is best effort)
  const rolls = b.actions.flatMap((a) => a.votes).filter((v) => /clerk\.house\.gov/.test(v.url)).slice(0, 6);
  const votes = (await pool(rolls, 4, (v) => houseRoll(v.url))).filter(Boolean);
  return { ...b, votes };
}

function partyKey(p) {
  return /^rep/i.test(p) ? 'R' : /^dem/i.test(p) ? 'D' : 'I';
}
const houseRoll = (url) =>
  cached(`roll:${url}`, 24 * 3600e3, async () => {
    const s = await get(url, { accept: 'application/xml' });
    if (!s.includes('<rollcall-vote')) throw new Error('no roll');
    const v = xml.parse(s)['rollcall-vote']['vote-metadata'];
    const parties = arr(v['vote-totals']?.['totals-by-party']).map((p) => ({
      party: partyKey(txt(p.party)),
      name: txt(p.party),
      yea: Number(txt(p['yea-total'])) || 0,
      nay: Number(txt(p['nay-total'])) || 0,
      present: Number(txt(p['present-total'])) || 0,
      notVoting: Number(txt(p['not-voting-total'])) || 0,
    }));
    const tot = v['vote-totals']?.['totals-by-vote'] || {};
    const d = txt(v['action-date']);
    const tm = v['action-time']?.['@time-etz'] || '';
    return {
      id: `house-${txt(v.congress)}-${txt(v.session).replace(/\D/g, '')}-${txt(v['rollcall-num'])}`,
      chamber: 'House',
      roll: Number(txt(v['rollcall-num'])),
      date: d,
      ts: etTs(d, tm),
      measure: txt(v['legis-num']),
      question: txt(v['vote-question']),
      description: txt(v['vote-desc']),
      result: txt(v['vote-result']),
      type: txt(v['vote-type']),
      totals: { yea: Number(txt(tot['yea-total'])) || sum(parties, 'yea'), nay: Number(txt(tot['nay-total'])) || sum(parties, 'nay'), present: sum(parties, 'present'), notVoting: sum(parties, 'notVoting') },
      parties,
      billId: billIdFromMeasure(txt(v['legis-num'])),
      url: url.replace(/\.xml$/, '.xml'),
    };
  });
const sum = (ps, k) => ps.reduce((a, p) => a + p[k], 0);
function billIdFromMeasure(s) {
  const m = /^(H R|S|H J RES|S J RES|H RES|S RES)\s+(\d+)$/i.exec(s.trim());
  return m ? `${CONGRESS}-${m[1].replace(/\s/g, '').toLowerCase()}-${m[2]}` : undefined;
}
const MON = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
/** "6-Jan-2026" + "18:58" (US Eastern) → epoch ms (DST via Intl). */
function etTs(d, hhmm) {
  const m = /^(\d+)-(\w{3})-(\d{4})$/.exec(d);
  if (!m) return undefined;
  const [h, mi] = (hhmm || '12:00').split(':').map(Number);
  const guess = Date.UTC(+m[3], MON[m[2].toLowerCase()], +m[1], h, mi);
  const off = (ts) => {
    const p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(new Date(ts));
    const g = (t) => Number(p.find((x) => x.type === t)?.value);
    return Date.UTC(g('year'), g('month') - 1, g('day'), g('hour') % 24, g('minute')) - ts;
  };
  return guess - off(guess - off(guess));
}

async function latestHouseRoll(year) {
  const exists = async (n) => {
    try {
      const s = await get(`https://clerk.house.gov/evs/${year}/roll${String(n).padStart(3, '0')}.xml`, { timeout: 6000 });
      return s.includes('<rollcall-vote');
    } catch {
      return false;
    }
  };
  if (!(await exists(1))) return 0;
  let lo = 1, hi = 2;
  while (hi < 2000 && (await exists(hi))) { lo = hi; hi *= 2; }
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (await exists(mid)) lo = mid; else hi = mid;
  }
  return lo;
}

/* Voteview (voteview.com, UCLA) — keyless CSV mirror of every Senate roll call with member-level
   votes; used when senate.gov's WAF blocks us. cast_code 1-3 yea, 4-6 nay, 7-8 present, 9 not voting. */
function csvRows(s) {
  const rows = [];
  let row = [], f = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"') { if (s[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
    else if (c !== '\r') f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const [head, ...rest] = rows;
  return rest.filter((r) => r.length >= head.length).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}
const voteviewSenate = () =>
  cached('senate:voteview', 60 * 60e3, async () => {
    const base = 'https://voteview.com/static/data/out';
    const [rc, vt, mb] = await Promise.all([
      get(`${base}/rollcalls/S${CONGRESS}_rollcalls.csv`, { timeout: 15000 }),
      get(`${base}/votes/S${CONGRESS}_votes.csv`, { timeout: 20000 }),
      get(`${base}/members/S${CONGRESS}_members.csv`, { timeout: 15000 }),
    ]);
    const party = new Map(csvRows(mb).map((m) => [m.icpsr, m.party_code === '100' ? 'D' : m.party_code === '200' ? 'R' : 'I']));
    const calls = csvRows(rc).filter((r) => r.chamber === 'Senate').sort((a, b) => b.rollnumber - a.rollnumber).slice(0, 15);
    const want = new Set(calls.map((c) => c.rollnumber));
    const tally = new Map();
    for (const v of csvRows(vt)) {
      if (!want.has(v.rollnumber)) continue;
      const p = party.get(v.icpsr) || 'I';
      const k = +v.cast_code <= 3 ? 'yea' : +v.cast_code <= 6 ? 'nay' : +v.cast_code <= 8 ? 'present' : 'notVoting';
      const t = tally.get(v.rollnumber) || {};
      t[p] = t[p] || { party: p, name: p === 'D' ? 'Democratic' : p === 'R' ? 'Republican' : 'Independent', yea: 0, nay: 0, present: 0, notVoting: 0 };
      t[p][k]++;
      tally.set(v.rollnumber, t);
    }
    return calls.map((c) => {
      const parties = Object.values(tally.get(c.rollnumber) || {}).sort((a, b) => a.party.localeCompare(b.party));
      const sess = Number(c.session) || 1;
      const n = c.clerk_rollnumber || c.rollnumber;
      return {
        id: `senate-${CONGRESS}-${sess}-${n}`,
        chamber: 'Senate',
        roll: Number(n),
        date: c.date,
        ts: Date.parse(`${c.date}T17:00:00Z`),
        measure: c.bill_number || '',
        question: c.vote_question,
        description: c.vote_desc || c.dtl_desc,
        result: c.vote_result,
        totals: { yea: Number(c.yea_count) || sum(parties, 'yea'), nay: Number(c.nay_count) || sum(parties, 'nay'), present: sum(parties, 'present'), notVoting: sum(parties, 'notVoting') },
        parties,
        url: `https://www.senate.gov/legislative/LIS/roll_call_votes/vote${CONGRESS}${sess}/vote_${CONGRESS}_${sess}_${String(n).padStart(5, '0')}.htm`,
      };
    });
  });

async function usVotes() {
  const notes = [];
  const year = new Date().getUTCFullYear();
  const house = await cached(`house:votes:${year}`, 10 * 60e3, async () => {
    let y = year;
    let last = await latestHouseRoll(y);
    if (!last) { y -= 1; last = await latestHouseRoll(y); }
    if (!last) return [];
    const ns = Array.from({ length: Math.min(15, last) }, (_, i) => last - i);
    return (await pool(ns, 6, (n) => houseRoll(`https://clerk.house.gov/evs/${y}/roll${String(n).padStart(3, '0')}.xml`))).filter(Boolean);
  }).catch(() => {
    notes.push('House Clerk roll-call XML was unreachable.');
    return [];
  });
  const senate = await cached('senate:votes', 15 * 60e3, async () => {
    const s = await get(`https://www.senate.gov/legislative/LIS/roll_call_lists/vote_menu_${CONGRESS}_${year % 2 === 0 ? 2 : 1}.xml`, { accept: 'application/xml', timeout: 6000 });
    const d = xml.parse(s)?.vote_summary;
    return arr(d?.votes?.vote).slice(0, 15).map((v) => ({
      id: `senate-${CONGRESS}-${txt(v.vote_number)}`,
      chamber: 'Senate',
      roll: Number(txt(v.vote_number)),
      date: txt(v.vote_date),
      measure: txt(v.issue),
      question: txt(v.question),
      description: txt(v.title),
      result: txt(v.result),
      totals: { yea: Number(txt(v.vote_tally?.yeas)) || 0, nay: Number(txt(v.vote_tally?.nays)) || 0, present: 0, notVoting: 0 },
      parties: [],
      url: `https://www.senate.gov/legislative/LIS/roll_call_votes/vote${CONGRESS}${year % 2 === 0 ? 2 : 1}/vote_${CONGRESS}_${year % 2 === 0 ? 2 : 1}_${txt(v.vote_number).padStart(5, '0')}.htm`,
    }));
  }).catch(() => null);
  let senateVotes = senate || [];
  let senateSrc = 'senate.gov LIS';
  if (!senate) {
    senateVotes = await voteviewSenate().catch(() => null);
    if (senateVotes?.length) {
      senateSrc = 'Voteview (UCLA) Senate roll calls';
      notes.push(`senate.gov blocks this server, so Senate roll calls come from Voteview (voteview.com, UCLA), which republishes official Senate votes with a lag — latest available: ${senateVotes[0].date}.`);
    } else {
      senateVotes = [];
      notes.push('senate.gov and Voteview were both unreachable; Senate votes omitted.');
    }
  }
  const votes = [...house, ...senateVotes].sort((a, b) => (b.ts || 0) - (a.ts || 0));
  return { votes, missing: [], notes, source: `clerk.house.gov roll-call XML; ${senateSrc}`, fetchedAt: Date.now() };
}

function parseRss(s) {
  const d = xml.parse(s);
  const ch = d?.rss?.channel;
  return arr(ch?.item).map((i) => ({ title: txt(i.title), link: txt(i.link), date: txt(i.pubDate), description: txt(i.description).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() }));
}
async function usFloor() {
  const feed = (which) =>
    cached(`floor:${which}`, 5 * 60e3, async () => parseRss(await get(`https://www.congress.gov/rss/${which}-floor-today.xml`, { accept: 'application/rss+xml' })))
      .then((items) => ({ ok: true, items }))
      .catch(() => ({ ok: false, items: [] }));
  const [house, senate] = await Promise.all([feed('house'), feed('senate')]);
  return {
    house: house.items,
    senate: senate.items,
    ok: { house: house.ok, senate: senate.ok },
    source: 'congress.gov RSS (House Floor Today / Senate Floor Today)',
    links: { house: 'https://live.house.gov/', senate: 'https://www.senate.gov/legislative/floor_activity_pail.htm' },
    fetchedAt: Date.now(),
  };
}

/* ----------------------------------------- AU ----------------------------------------- */
const FRL = 'https://api.prod.legislation.gov.au/v1';
const APH_RSS = 'https://parlinfo.aph.gov.au/parlInfo/feeds/rss.w3p;adv=yes;orderBy=date-eLast;page=0;query=Dataset%3AbillsCurBef;resCount=100';

function frlAct(t) {
  const billId = /billhome%2F(\w+)/i.exec(t.originatingBillUri || '')?.[1];
  return {
    id: t.id,
    country: 'au',
    label: t.id,
    title: t.name,
    chamber: 'Parliament of Australia',
    introduced: undefined,
    updated: t.asMadeRegisteredAt,
    latestAction: { date: (t.makingDate || '').slice(0, 10), text: 'Royal Assent — Act registered on the Federal Register of Legislation' },
    stage: 4,
    stageLabel: 'Royal Assent',
    stages: AU_STAGES,
    subjects: [],
    url: billId ? `https://www.aph.gov.au/Parliamentary_Business/Bills_Legislation/Bills_Search_Results/Result?bId=${billId}` : `https://www.legislation.gov.au/${t.id}/asmade`,
    parlInfo: t.originatingBillUri || undefined,
    textUrl: `https://www.legislation.gov.au/${t.id}/asmade/text`,
    aphBillId: billId,
  };
}

async function auActs() {
  return cached('frl:acts', 30 * 60e3, async () => {
    const y = new Date().getUTCFullYear();
    const q = (yy) =>
      `${FRL}/titles?%24filter=startswith(id,%27C${yy}A%27)&%24orderby=makingDate%20desc&%24top=60&%24select=id,name,makingDate,originatingBillUri,asMadeRegisteredAt`;
    let rows = JSON.parse(await get(q(y), { accept: 'application/json' })).value || [];
    if (rows.length < 20) rows = rows.concat(JSON.parse(await get(q(y - 1), { accept: 'application/json' })).value || []);
    return rows.map(frlAct);
  });
}

/* Open-data mirror of APH bill status: github.com/Coedice/vibe-of-the-thing (_data/bills.yml), regenerated by a
   public GitHub Action each weekday from the Parliament of Australia bills pages. Served from raw.githubusercontent.com. */
const AU_MIRROR = 'https://raw.githubusercontent.com/Coedice/vibe-of-the-thing/main/_data/bills.yml';
const AU_MIRROR_REPO = 'https://github.com/Coedice/vibe-of-the-thing';

/** Minimal parser for the mirror's simple YAML shape: top-level lists of flat maps with plain / quoted / folded scalars. */
function parseBillsYaml(text) {
  const out = {};
  let list = null;
  let item = null;
  let key = null;
  const finish = () => {
    if (item && key != null) item[key] = yamlScalar(item[key]);
    key = null;
  };
  for (const line of text.split(/\r?\n/)) {
    let m;
    if ((m = /^([A-Za-z_]+):\s*(\[\])?\s*$/.exec(line))) {
      finish();
      list = out[m[1]] = [];
      item = null;
    } else if ((m = /^(- |  )([A-Za-z_]+):(?: (.*))?$/.exec(line)) && list) {
      finish();
      if (m[1] === '- ') list.push((item = {}));
      if (!item) continue;
      key = m[2];
      item[key] = m[3] ?? '';
    } else if (/^\s{3,}\S/.test(line) && item && key != null) {
      item[key] += ' ' + line.trim();
    }
  }
  finish();
  return out;
}
function yamlScalar(v) {
  const s = String(v).trim();
  if (s === '' || s === 'null' || s === '~') return null;
  if (s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1).replace(/''/g, "'");
  if (s.startsWith('"') && s.endsWith('"')) {
    try { return JSON.parse(s); } catch { return s.slice(1, -1); }
  }
  return s;
}
const AU_HOUSE = { 'House of Representatives': 'House of Representatives', Senate: 'Senate' };
function mirrorBill(b) {
  const orig = AU_HOUSE[b.originating_house] || 'Parliament of Australia';
  const where = /reps/i.test(b.status || '') ? 'House of Representatives' : /senate/i.test(b.status || '') ? 'Senate' : '';
  let stage = 0;
  let text = b.status || 'Status not reported';
  if (b.status === 'Act') { stage = 4; text = 'Passed both houses — now an Act (Royal Assent)'; }
  else if (b.status === 'Not Proceeding') { stage = -1; text = 'Not proceeding'; }
  else if (where && where !== orig) { stage = 2; text = `Passed the ${orig}; before the ${where}`; }
  else if (where) { stage = 0; text = `Introduced; before the ${where}`; }
  const date = b.last_updated || '';
  return {
    id: b.bill_id,
    country: 'au',
    label: b.bill_id,
    title: b.title,
    chamber: orig,
    updated: date || undefined,
    latestAction: { date, text },
    stage,
    stageLabel: stage >= 0 ? AU_STAGES[stage] : 'Not proceeding',
    stages: AU_STAGES,
    sponsor: b.introducer_name || b.introducer_party ? { name: b.introducer_name ? `${b.introducer_name}${b.introducer_division ? `, ${b.introducer_division}` : ''}` : `${b.type || ''} bill`.trim(), party: b.introducer_party || '—' } : undefined,
    policyArea: b.portfolio || undefined,
    subjects: b.type ? [`${b.type} bill`] : [],
    summary: b.summary || undefined,
    url: `https://www.aph.gov.au/Parliamentary_Business/Bills_Legislation/Bills_Search_Results/Result?bId=${b.bill_id}`,
    textUrl: b.pdf_url || undefined,
    parlInfo: `https://parlinfo.aph.gov.au/parlInfo/search/display/display.w3p;query=Id%3A%22legislation%2Fbillhome%2F${b.bill_id}%22`,
    secondReading: b.second_reading_hansard_url || undefined,
    aphBillId: b.bill_id,
    source: 'mirror',
  };
}
async function auMirror() {
  return cached('au:mirror', 60 * 60e3, async () => {
    const y = parseBillsYaml(await get(AU_MIRROR, { accept: 'text/plain', timeout: 12000 }));
    const pending = (y.pending || []).map(mirrorBill);
    const passed = (y.passed || []).map(mirrorBill);
    if (!pending.length && !passed.length) throw new Error('mirror returned no bills');
    const all = [...pending, ...passed];
    const asOf = all.reduce((m, b) => (b.latestAction.date > m ? b.latestAction.date : m), '');
    return { pending, passed, asOf };
  });
}

function auStageFromText(s) {
  if (/assent/i.test(s)) return 4;
  if (/passed both houses/i.test(s)) return 3;
  if (/(passed|agreed).*(house of representatives|senate)|third reading agreed/i.test(s)) return 2;
  if (/committee|referred|second reading/i.test(s)) return 1;
  return 0;
}
async function auBeforeParliament() {
  return cached('aph:before', 20 * 60e3, async () => {
    const s = await get(APH_RSS, { accept: 'application/rss+xml', timeout: 7000 });
    if (!/<rss/i.test(s)) throw new Error('APH returned a WAF challenge, not RSS');
    return parseRss(s).map((i) => {
      const billId = /billhome%2F(\w+)|billhome\/(\w+)/i.exec(i.link);
      const id = billId ? billId[1] || billId[2] : i.link;
      const st = auStageFromText(i.description);
      return {
        id,
        country: 'au',
        label: id,
        title: i.title,
        chamber: /senate/i.test(i.description) ? 'Senate' : /house of representatives/i.test(i.description) ? 'House of Representatives' : 'Parliament of Australia',
        latestAction: { date: i.date ? new Date(i.date).toISOString().slice(0, 10) : '', text: i.description.slice(0, 240) || 'Before Parliament' },
        stage: st,
        stageLabel: AU_STAGES[st],
        stages: AU_STAGES,
        subjects: [],
        url: i.link,
      };
    });
  });
}

async function auBills(params, env) {
  const q = (params.get('q') || '').trim().toLowerCase();
  const missing = [];
  const notes = [];
  const [mirror, before, acts] = await Promise.all([
    auMirror().catch(() => null),
    auBeforeParliament().catch(() => []),
    auActs().catch(() => {
      notes.push('Federal Register of Legislation API unreachable.');
      return [];
    }),
  ]);
  if (!env.TVFY_API_KEY) missing.push({ key: 'TVFY_API_KEY', what: 'They Vote For You API key — needed for Australian divisions (recent votes with party breakdown)', where: 'https://theyvoteforyou.org.au/users/sign_up' });
  const sources = [];
  let bills = [];
  if (before.length) {
    bills.push(...before);
    sources.push('APH ParlInfo RSS (live)');
  }
  if (mirror) {
    const seen = new Set(bills.map((b) => b.id));
    const mPassed = mirror.passed.slice().sort((a, b) => (b.latestAction.date || '').localeCompare(a.latestAction.date || '')).slice(0, 60);
    const mPending = mirror.pending.slice().sort((a, b) => (b.latestAction.date || '').localeCompare(a.latestAction.date || ''));
    bills.push(...[...mPending, ...mPassed].filter((b) => !seen.has(b.id)));
    sources.push(`APH bill status via open-data mirror (${AU_MIRROR_REPO.replace('https://', '')}, data as of ${mirror.asOf})`);
    notes.push(`Bills before Parliament and their stage come from a community open-data mirror of aph.gov.au bill pages (refreshed by a public GitHub Action each sitting weekday; latest bill update ${mirror.asOf}). aph.gov.au itself blocks cloud servers, so this can lag the official site by a day or more — always check the APH bill page.`);
    notes.push('The mirror reports which chamber a bill is before, so stages shown are Introduced → Passed one house → Royal Assent; committee referrals are not reported.');
  } else if (!before.length) {
    notes.push('Bills currently before Parliament are unavailable right now (aph.gov.au blocks cloud servers and the open-data mirror did not respond). Showing Acts that have received Royal Assent only.');
  }
  if (acts.length) {
    const seen = new Set(bills.map((b) => b.aphBillId || b.id));
    const extra = acts.filter((a) => !a.aphBillId || !seen.has(a.aphBillId)).map((a) => ({ ...a, source: 'frl' }));
    bills.push(...extra);
    sources.push('Federal Register of Legislation (assented Acts, live)');
  }
  if (q) bills = bills.filter((b) => `${b.title} ${b.label} ${b.sponsor?.name || ''} ${b.policyArea || ''}`.toLowerCase().includes(q));
  return { bills, source: sources.join(' + ') || 'none reachable', fetchedAt: Date.now(), missing, notes };
}

async function auBill(id) {
  if (/^C\d{4}A\d+$/i.test(id)) {
    const acts = await auActs().catch(() => []);
    let a = acts.find((x) => x.id.toUpperCase() === id.toUpperCase());
    if (!a) {
      const t = JSON.parse(await get(`${FRL}/titles('${encodeURIComponent(id)}')`, { accept: 'application/json' }));
      a = frlAct(t);
    }
    return {
      ...a,
      actions: [
        a.updated ? { date: a.updated.slice(0, 10), text: 'Registered on the Federal Register of Legislation (as made)' } : null,
        { date: a.latestAction.date, text: 'Royal Assent' },
      ].filter(Boolean),
      texts: [{ label: 'Act as made (Federal Register of Legislation)', date: a.latestAction.date, url: a.textUrl }, ...(a.parlInfo ? [{ label: 'Bill homepage (ParlInfo — bill history, explanatory memorandum)', date: '', url: a.parlInfo }] : [])],
      votes: [],
    };
  }
  const mirror = await auMirror().catch(() => null);
  const m = mirror && [...mirror.pending, ...mirror.passed].find((x) => x.id === id);
  if (m) {
    return {
      ...m,
      actions: [{ date: m.latestAction.date, text: `${m.latestAction.text} (status from open-data mirror of aph.gov.au, data as of ${mirror.asOf})` }],
      texts: [
        { label: 'Bill homepage (APH — full history, explanatory memorandum)', date: '', url: m.url },
        ...(m.textUrl ? [{ label: 'Latest bill text (PDF, ParlInfo)', date: m.latestAction.date, url: m.textUrl }] : []),
        ...(m.secondReading ? [{ label: 'Second reading speech (Hansard)', date: '', url: m.secondReading }] : []),
      ],
      votes: [],
    };
  }
  const before = await auBeforeParliament().catch(() => []);
  const b = before.find((x) => x.id === id);
  if (!b) return null;
  return { ...b, actions: [{ date: b.latestAction.date, text: b.latestAction.text }], texts: [{ label: 'Bill homepage (APH)', date: '', url: b.url }], votes: [] };
}

async function auVotes(env) {
  const key = env.TVFY_API_KEY;
  if (!key) {
    return {
      votes: [],
      missing: [{ key: 'TVFY_API_KEY', what: 'They Vote For You API key — Australian House & Senate divisions with party breakdown', where: 'https://theyvoteforyou.org.au/users/sign_up' }],
      notes: [],
      fetchedAt: Date.now(),
    };
  }
  const votes = await cached('tvfy:divs', 15 * 60e3, async () => {
    const list = JSON.parse(await get(`https://theyvoteforyou.org.au/api/v1/divisions.json?key=${encodeURIComponent(key)}`, { accept: 'application/json' }));
    const top = arr(list).slice(0, 12);
    const details = await pool(top, 4, async (d) => JSON.parse(await get(`https://theyvoteforyou.org.au/api/v1/divisions/${d.id}.json?key=${encodeURIComponent(key)}`, { accept: 'application/json' })));
    return top.map((d, i) => {
      const det = details[i];
      const byParty = new Map();
      for (const v of arr(det?.votes)) {
        const p = v.member?.party || 'Other';
        const e = byParty.get(p) || { party: p, name: p, yea: 0, nay: 0, present: 0, notVoting: 0 };
        if (v.vote === 'aye') e.yea++;
        else if (v.vote === 'no') e.nay++;
        byParty.set(p, e);
      }
      return {
        id: `tvfy-${d.id}`,
        chamber: d.house === 'senate' ? 'Senate' : 'House of Representatives',
        roll: d.number,
        date: d.date,
        measure: arr(det?.bills).map((b) => b.official_title).join('; ') || undefined,
        question: d.name,
        description: '',
        result: d.aye_votes > d.no_votes ? 'Agreed' : 'Not agreed',
        totals: { yea: d.aye_votes, nay: d.no_votes, present: 0, notVoting: 0 },
        parties: [...byParty.values()].sort((a, b) => b.yea + b.nay - (a.yea + a.nay)),
        url: `https://theyvoteforyou.org.au/divisions/${d.house}/${d.date}/${d.number}`,
      };
    });
  });
  return { votes, missing: [], notes: [], source: 'They Vote For You (OpenAustralia Foundation)', fetchedAt: Date.now() };
}

/* --------------------------------------- router --------------------------------------- */
/** sub = path after "/api/parliament" (e.g. "/us/bills"). Returns { status, body, maxAge }. */
export async function parliamentApi(sub, params, env = {}) {
  try {
    const parts = sub.replace(/^\/+|\/+$/g, '').split('/').map(decodeURIComponent);
    const [country, what, id] = parts;
    if (country === 'status')
      return {
        status: 200,
        maxAge: 60,
        body: {
          us: { congressApiKey: !!env.CONGRESS_API_KEY, keyless: ['GovInfo BILLSTATUS', 'clerk.house.gov', 'congress.gov RSS'] },
          au: { tvfyApiKey: !!env.TVFY_API_KEY, keyless: ['Federal Register of Legislation', 'APH bill status open-data mirror (GitHub)', 'APH ParlInfo (best effort)'] },
        },
      };
    if (country === 'us') {
      if (what === 'bills') return { status: 200, maxAge: 600, body: await usBills(params, env) };
      if (what === 'bill' && id) {
        const bill = await usBill(id);
        return bill ? { status: 200, maxAge: 900, body: { bill } } : { status: 404, body: { error: 'bill not found' } };
      }
      if (what === 'votes') return { status: 200, maxAge: 600, body: await usVotes() };
      if (what === 'floor') return { status: 200, maxAge: 300, body: await usFloor() };
    }
    if (country === 'au') {
      if (what === 'bills') return { status: 200, maxAge: 900, body: await auBills(params, env) };
      if (what === 'bill' && id) {
        const bill = await auBill(id);
        return bill ? { status: 200, maxAge: 1800, body: { bill } } : { status: 404, body: { error: 'bill not found' } };
      }
      if (what === 'votes') return { status: 200, maxAge: 900, body: await auVotes(env) };
    }
    return { status: 404, body: { error: 'unknown parliament endpoint' } };
  } catch (e) {
    return { status: 502, body: { error: String(e?.message || e) } };
  }
}

/** Node server adapter: (await import('./parliament.js')).nodeParliamentHandler(p, url, json, res) */
export async function nodeParliamentHandler(p, url, json, res) {
  const r = await parliamentApi(p.replace(/^\/api\/parliament/, ''), url.searchParams, process.env);
  return json(res, r.status, r.body, r.maxAge ? { 'cache-control': `public, max-age=${Math.min(r.maxAge, 300)}` } : {});
}
