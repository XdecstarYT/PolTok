// /api/members/* — US Congress (119th) member directory + profiles. Keyless open data only:
//  - unitedstates/congress-legislators (unitedstates.github.io): legislators, social media, committees
//  - Voteview (voteview.com, UCLA): DW-NOMINATE scores, member-level roll-call votes
// Australian members are served client-side from src/data/au.ts (compiled research data).
const UA = 'PolTok/1.0 (+https://poltok.netlify.app)';
const CL = 'https://unitedstates.github.io/congress-legislators';
const VV = 'https://voteview.com/static/data/out';
const CONGRESS = 119;

const cache = new Map();
async function cached(key, ttlMs, fn) {
  const hit = cache.get(key);
  if (hit?.value && Date.now() - hit.at < ttlMs) return hit.value;
  if (hit?.pending) return hit.pending;
  const pending = fn()
    .then((value) => { cache.set(key, { at: Date.now(), value }); return value; })
    .catch((e) => { if (hit?.value) { cache.set(key, hit); return hit.value; } cache.delete(key); throw e; });
  cache.set(key, { ...(hit || { at: 0 }), pending });
  return pending;
}
async function get(url, timeout = 20000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA }, signal: ctl.signal, redirect: 'follow' });
    if (!r.ok) throw new Error(`${r.status} from ${new URL(url).host}`);
    return await r.text();
  } finally { clearTimeout(t); }
}
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
const num = (x) => (x === '' || x == null || isNaN(+x) ? null : +x);
const P = (s) => (/^Democrat/.test(s) ? 'D' : /^Republican/.test(s) ? 'R' : 'I');

/* ------------------------------ legislators + committees ------------------------------ */
const legislators = () => cached('cl', 12 * 3600e3, async () => {
  const [cur, soc, cm, cms] = await Promise.all([
    get(`${CL}/legislators-current.json`).then(JSON.parse),
    get(`${CL}/legislators-social-media.json`).then(JSON.parse).catch(() => []),
    get(`${CL}/committees-current.json`).then(JSON.parse).catch(() => []),
    get(`${CL}/committee-membership-current.json`).then(JSON.parse).catch(() => ({})),
  ]);
  const social = new Map(soc.map((s) => [s.id.bioguide, s.social]));
  const cname = new Map();
  for (const c of cm) {
    cname.set(c.thomas_id, { name: c.name, url: c.url, sub: false });
    for (const s of c.subcommittees || []) cname.set(c.thomas_id + s.thomas_id, { name: `${c.name} — ${s.name}`, url: c.url, sub: true });
  }
  const comms = new Map();
  for (const [code, list] of Object.entries(cms)) {
    const c = cname.get(code);
    if (!c) continue;
    for (const m of list) {
      if (!comms.has(m.bioguide)) comms.set(m.bioguide, []);
      comms.get(m.bioguide).push({ code, name: c.name, url: c.url, sub: c.sub, title: m.title || null, rank: m.rank ?? null, side: m.party || null });
    }
  }
  return { cur, social, comms, at: Date.now() };
});

/* ------------------------------------- Voteview -------------------------------------- */
const voteview = () => cached('vv', 6 * 3600e3, async () => {
  const [mb, hrc, src, hv, sv] = await Promise.all([
    get(`${VV}/members/HS${CONGRESS}_members.csv`),
    get(`${VV}/rollcalls/H${CONGRESS}_rollcalls.csv`),
    get(`${VV}/rollcalls/S${CONGRESS}_rollcalls.csv`),
    get(`${VV}/votes/H${CONGRESS}_votes.csv`, 45000),
    get(`${VV}/votes/S${CONGRESS}_votes.csv`, 45000),
  ]);
  const members = csvRows(mb).filter((m) => m.chamber !== 'President');
  const byBio = new Map();
  const party = new Map(); // `${chamber}:${icpsr}` -> D/R/I
  for (const m of members) {
    const p = m.party_code === '100' ? 'D' : m.party_code === '200' ? 'R' : 'I';
    party.set(`${m.chamber}:${m.icpsr}`, p);
    if (!m.bioguide_id) continue;
    const prev = byBio.get(m.bioguide_id) || { icpsr: {}, };
    prev.icpsr[m.chamber] = m.icpsr;
    if (m.chamber === 'House' || !prev.dim1) {
      prev.dim1 = num(m.nominate_dim1); prev.dim2 = num(m.nominate_dim2);
      prev.nVotes = num(m.nominate_number_of_votes);
    }
    byBio.set(m.bioguide_id, prev);
  }
  const stats = new Map(); // `${chamber}:${icpsr}` -> stats
  const recent = new Map(); // -> [[roll, code]] newest last
  const calls = { House: new Map(), Senate: new Map() };
  const cast = (c) => (c <= 3 ? 'Y' : c <= 6 ? 'N' : c <= 8 ? 'P' : 'X');
  for (const [chamber, rcText, vText] of [['House', hrc, hv], ['Senate', src, sv]]) {
    for (const r of csvRows(rcText)) calls[chamber].set(r.rollnumber, r);
    // compact parse (no quoted fields in votes CSVs)
    const byRoll = new Map();
    const lines = vText.split('\n');
    for (let i = 1; i < lines.length; i++) {
      const f = lines[i].split(',');
      if (f.length < 5) continue;
      const roll = f[2], icpsr = f[3], v = cast(+f[4]);
      if (!byRoll.has(roll)) byRoll.set(roll, []);
      byRoll.get(roll).push([icpsr, v]);
    }
    for (const [roll, vs] of byRoll) {
      const t = { D: { Y: 0, N: 0 }, R: { Y: 0, N: 0 } };
      for (const [ic, v] of vs) { const p = party.get(`${chamber}:${ic}`); if (t[p] && (v === 'Y' || v === 'N')) t[p][v]++; }
      const pos = (p) => (t[p].Y === t[p].N ? null : t[p].Y > t[p].N ? 'Y' : 'N');
      const dPos = pos('D'), rPos = pos('R');
      const unity = dPos && rPos && dPos !== rPos;
      for (const [ic, v] of vs) {
        const k = `${chamber}:${ic}`;
        const s = stats.get(k) || { cast: 0, missed: 0, total: 0, unityVotes: 0, withParty: 0 };
        s.total++;
        if (v === 'X') s.missed++;
        if (v === 'Y' || v === 'N') {
          s.cast++;
          const p = party.get(k);
          const mine = p === 'D' ? dPos : p === 'R' ? rPos : null;
          if (unity && mine) { s.unityVotes++; if (v === mine) s.withParty++; }
        }
        stats.set(k, s);
        const arr = recent.get(k) || [];
        arr.push([+roll, v]);
        recent.set(k, arr);
      }
    }
  }
  for (const arr of recent.values()) { arr.sort((a, b) => a[0] - b[0]); arr.splice(0, Math.max(0, arr.length - 25)); }
  const latest = (ch) => [...calls[ch].values()].reduce((d, r) => (r.date > d ? r.date : d), '');
  return { byBio, stats, recent, calls, latest: { House: latest('House'), Senate: latest('Senate') }, at: Date.now() };
});

function statsFor(vv, bio, chamber) {
  const v = vv?.byBio.get(bio);
  if (!v) return null;
  const ch = chamber === 'sen' ? 'Senate' : 'House';
  const ic = v.icpsr[ch];
  const s = ic ? vv.stats.get(`${ch}:${ic}`) : null;
  return {
    icpsr: ic || null,
    dim1: v.dim1, dim2: v.dim2,
    votes: s?.total ?? null,
    missedPct: s && s.total ? Math.round((s.missed / s.total) * 1000) / 10 : null,
    partyUnityPct: s && s.unityVotes ? Math.round((s.withParty / s.unityVotes) * 1000) / 10 : null,
    unityVotes: s?.unityVotes ?? null,
  };
}

function summary(l, vv) {
  const t = l.terms[l.terms.length - 1];
  const first = l.terms.find((x) => x.type === t.type);
  return {
    id: l.id.bioguide,
    name: l.name.official_full || `${l.name.first} ${l.name.last}`,
    last: l.name.last,
    chamber: t.type === 'sen' ? 'senate' : 'house',
    party: P(t.party),
    partyName: t.party,
    caucus: t.caucus || null,
    state: t.state,
    district: t.type === 'rep' ? t.district : null,
    senClass: t.class ?? null,
    rank: t.state_rank || null,
    since: first.start,
    termEnd: t.end,
    photo: `https://unitedstates.github.io/images/congress/225x275/${l.id.bioguide}.jpg`,
    stats: statsFor(vv, l.id.bioguide, t.type),
  };
}

const SOURCES = [
  { name: 'unitedstates/congress-legislators (public domain)', url: 'https://github.com/unitedstates/congress-legislators' },
  { name: 'Voteview, UCLA — DW-NOMINATE & roll calls', url: 'https://voteview.com' },
  { name: 'Official member photos via unitedstates/images (public domain, GPO)', url: 'https://github.com/unitedstates/images' },
];

async function usList() {
  const [cl, vv] = await Promise.all([legislators(), voteview().catch(() => null)]);
  return {
    members: cl.cur.map((l) => summary(l, vv)),
    voteview: vv ? { latest: vv.latest, at: vv.at } : null,
    notes: vv ? [] : ['Voteview could not be reached; ideology and voting statistics are unavailable right now.'],
    sources: SOURCES,
    at: cl.at,
  };
}

async function usMember(id) {
  const [cl, vv] = await Promise.all([legislators(), voteview().catch(() => null)]);
  const l = cl.cur.find((x) => x.id.bioguide === id.toUpperCase());
  if (!l) return null;
  const s = summary(l, vv);
  const t = l.terms[l.terms.length - 1];
  let votes = [];
  if (vv && s.stats?.icpsr) {
    const ch = t.type === 'sen' ? 'Senate' : 'House';
    votes = (vv.recent.get(`${ch}:${s.stats.icpsr}`) || []).slice().reverse().map(([roll, v]) => {
      const c = vv.calls[ch].get(String(roll)) || {};
      return { chamber: ch, roll, date: c.date, bill: c.bill_number || '', question: c.vote_question || '', description: c.vote_desc || c.dtl_desc || '', result: c.vote_result || '', vote: v, yea: num(c.yea_count), nay: num(c.nay_count) };
    });
  }
  return {
    member: {
      ...s,
      gender: l.bio?.gender || null,
      birthday: l.bio?.birthday || null,
      terms: l.terms.map((x) => ({ type: x.type, start: x.start, end: x.end, state: x.state, district: x.district ?? null, party: x.party, class: x.class ?? null, how: x.how || null })),
      contact: { url: t.url || null, phone: t.phone || null, office: t.office || t.address || null, contactForm: t.contact_form || null },
      social: cl.social.get(l.id.bioguide) || {},
      ids: { govtrack: l.id.govtrack || null, opensecrets: l.id.opensecrets || null, wikipedia: l.id.wikipedia || null, ballotpedia: l.id.ballotpedia || null, fec: l.id.fec || [] },
      committees: (cl.comms.get(l.id.bioguide) || []).sort((a, b) => a.sub - b.sub),
      votes,
    },
    voteview: vv ? { latest: vv.latest } : null,
    sources: SOURCES,
  };
}

export async function membersApi(sub) {
  try {
    const [country, id] = sub.replace(/^\/+|\/+$/g, '').split('/').map(decodeURIComponent);
    if (country === 'us' && !id) return { status: 200, maxAge: 3600, body: await usList() };
    if (country === 'us' && id) {
      const m = await usMember(id);
      return m ? { status: 200, maxAge: 3600, body: m } : { status: 404, body: { error: 'member not found' } };
    }
    return { status: 404, body: { error: 'unknown members endpoint' } };
  } catch (e) {
    return { status: 502, body: { error: String(e?.message || e) } };
  }
}

/** Node adapter: (await import('./members.js')).nodeMembersHandler(p, url, json, res) */
export async function nodeMembersHandler(p, url, json, res) {
  const r = await membersApi(p.replace(/^\/api\/members/, ''));
  return json(res, r.status, r.body, r.maxAge ? { 'cache-control': `public, max-age=${Math.min(r.maxAge, 600)}` } : {});
}
