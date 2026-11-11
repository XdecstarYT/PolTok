// Shared helpers for the US 2026 results reels. All numbers come LIVE from PolTok's results feed
// (AP calls via the NYT results provider) at render time; nothing here is a result.

const API = 'https://poltok.netlify.app/api/snapshot?source=live';

export async function snapshot() {
  let lastErr = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(API + '&_=' + Date.now(), { headers: { 'user-agent': 'poltok-reels/1.0' } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      if (Array.isArray(j.results) && j.results.length && Array.isArray(j.balance)) return j;
      lastErr = 'feed answered without results/balance';
    } catch (e) { lastErr = e.message; }
    await new Promise((res) => setTimeout(res, 4000));
  }
  throw new Error('snapshot API unusable: ' + lastErr);
}

export const asOfLabel = (j) => new Date(j.fetchedAt || Date.now()).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' ET';

/** Candidates of a race sorted by votes, with share of the total. */
export function standings(race) {
  const tot = Object.values(race.votes || {}).reduce((a, b) => a + b, 0) || 1;
  return race.candidates
    .map((c) => ({ id: c.id, name: c.name, party: c.party, votes: race.votes?.[c.id] || 0 }))
    .map((c) => ({ ...c, pct: (100 * c.votes) / tot }))
    .sort((a, b) => b.votes - a.votes)
    .concat([])
    .map((c, i, arr) => (i === 0 ? { ...c, total: tot, gap: c.votes - (arr[1]?.votes || 0) } : c));
}

export const STATES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
};
const ORD = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };

/** "Minnesota's 1st district", "Alaska Senate", "Kansas governor". */
export function raceLabel(id) {
  const [st, kind] = id.split('-');
  const S = STATES[st] || st;
  if (kind === 'SEN') return `${S} Senate`;
  if (kind === 'GOV') return `${S} governor`;
  if (kind === 'AL') return `${S} at-large House`;
  return `${S}'s ${ORD(+kind)} district`;
}

// Party holding each Senate seat on the ballot in 2026 BEFORE the election (class 2 + the FL and OH specials).
export const SENATE_PRIOR = {
  AL: 'R', AK: 'R', AR: 'R', CO: 'D', DE: 'D', GA: 'D', ID: 'R', IL: 'D', IA: 'R', KS: 'R', KY: 'R', LA: 'R', ME: 'R', MA: 'D', MI: 'D', MN: 'D', MS: 'R',
  MT: 'R', NE: 'R', NH: 'D', NJ: 'D', NM: 'D', NC: 'R', OK: 'R', OR: 'D', RI: 'D', SC: 'R', SD: 'R', TN: 'R', TX: 'R', VA: 'D', WV: 'R', WY: 'R',
  'FL-S': 'R', 'OH-S': 'R',
};
export const senateKey = (id) => { const p = id.split('-'); return p[2] === 'S' ? `${p[0]}-S` : p[0]; };

export const COL = { D: 0x3d7bff, R: 0xff3d55, I: 0xa98bff };
export const CSS = { D: '#7da7ff', R: '#ff8394', I: '#c4b2ff' };
export const PARTY = { D: 'Democrat', R: 'Republican', I: 'Independent' };

/** Rough, natural spoken size of a vote gap. */
export function sayVotes(n) {
  if (n < 1000) return `${n} votes`;
  if (n < 10000) {
    const th = Math.round(n / 1000) * 1000;
    if (th - n >= 0 && th - n <= 60) return `just under ${th.toLocaleString('en-US')} votes`;
    return `about ${(Math.round(n / 100) * 100).toLocaleString('en-US')} votes`;
  }
  return `about ${Math.round(n / 1000)} thousand votes`;
}
export const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

/** Two stacks of ballot papers on a desk, heights proportional to two shares. Returns { update(k) }. */
export function ballotStacks(S, { real, THREE }, a, b, colA, colB, o = {}) {
  real.room(S, { carpet: o.carpet ?? 0x1f2a44, wood: 0x4e3320, width: 16, depth: 14, height: 7, key: o.key ?? 90, area: 2.2, fill: 0.25 });
  const desk = new THREE.Mesh(new THREE.BoxGeometry(6, 0.16, 3.4), real.pbr(real.tex.wood(0x5c3a20), { repeat: [2, 1], clearcoat: 0.7, clearcoatRoughness: 0.2 }));
  desk.position.set(0, 1.0, 0); desk.receiveShadow = true; desk.castShadow = true; S.scene.add(desk);
  const max = Math.max(a, b);
  const stack = (x, pct, col) => {
    const g = new THREE.Group(); const n = 44;
    for (let i = 0; i < n; i++) {
      const sh = real.sheet(0.75, 1.0, (c, w) => { c.fillStyle = 'rgba(30,30,30,.55)'; c.font = '600 46px "Inter Tight"'; c.fillText('OFFICIAL BALLOT', 60, 110); c.fillStyle = '#' + new THREE.Color(col).getHexString(); c.fillRect(60, 150, w - 120, 16); });
      sh.rotation.x = -Math.PI / 2; sh.rotation.z = Math.sin(i * 7.3) * 0.05;
      sh.position.set(Math.sin(i * 3.1) * 0.02, i * 0.012, Math.cos(i * 2.7) * 0.02);
      g.add(sh);
    }
    g.position.set(x, 1.09, 0); g.userData.full = pct / max; S.scene.add(g); return g;
  };
  const A = stack(-0.85, a, colA), B = stack(0.85, b, colB);
  return {
    A, B,
    update(k) { [A, B].forEach((g) => { const show = Math.round(g.children.length * k * g.userData.full); g.children.forEach((c, i) => { c.visible = i < show; }); }); },
  };
}
