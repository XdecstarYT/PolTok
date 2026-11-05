// /api/myarea/us?address=… | ?zip=… — US address → congressional + state legislative districts.
// Keyless: US Census Geocoder (geocoding.geo.census.gov, "Current_Current" vintage, whose CD layer is
// the 120th Congress = districts used for the Nov 2026 election) and, for a bare ZIP, the Census
// TIGERweb ZCTA layer (ZIP centroid → geographies by coordinates; approximate). The address is sent
// only to the Census Bureau and is never logged or stored here.
const UA = 'PolTok/1.0 (+https://poltok.netlify.app)';
const GEO = 'https://geocoding.geo.census.gov/geocoder/geographies';
const ZCTA = 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/PUMA_TAD_TAZ_UGA_ZCTA/MapServer/1/query';
const Q = 'benchmark=Public_AR_Current&vintage=Current_Current&layers=all&format=json';
const SOURCE = { name: 'U.S. Census Bureau Geocoder (Current vintage, public domain)', url: 'https://geocoding.geo.census.gov/geocoder/' };

async function get(url) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 15000);
  try {
    const r = await fetch(url, { signal: ac.signal, headers: { 'user-agent': UA, accept: 'application/json' } });
    if (!r.ok) throw new Error(`upstream ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

function pickGeo(g) {
  const find = (re) => Object.entries(g || {}).find(([k]) => re.test(k));
  const one = (re) => { const e = find(re); return e && e[1] && e[1][0] ? { layer: e[0], ...e[1][0] } : null; };
  const st = one(/^States$/);
  const cd = one(/Congressional Districts/);
  const up = one(/State Legislative Districts - Upper/);
  const lo = one(/State Legislative Districts - Lower/);
  const county = one(/^Counties$/);
  if (!st) return null;
  const cdNum = cd ? Number(cd.BASENAME) : NaN;
  return {
    state: st.STUSAB,
    stateName: st.NAME,
    county: county?.NAME ?? null,
    cd: cd ? { district: Number.isFinite(cdNum) ? cdNum : 0, name: cd.NAME, layer: cd.layer, congress: cd.CDSESSN ? Number(cd.CDSESSN) : null } : null,
    upper: up ? { name: up.NAME, layer: up.layer } : null,
    lower: lo ? { name: lo.NAME, layer: lo.layer } : null,
  };
}

export async function myareaApi(params) {
  const address = (params.get('address') || '').trim().slice(0, 200);
  const zipM = address.match(/^\s*(\d{5})(?:-\d{4})?\s*$/) || (params.get('zip') || '').match(/^(\d{5})$/);
  try {
    if (zipM) {
      const z = await get(`${ZCTA}?where=${encodeURIComponent(`ZCTA5='${zipM[1]}'`)}&outFields=ZCTA5,INTPTLAT,INTPTLON&returnGeometry=false&f=json`);
      const a = z.features?.[0]?.attributes;
      if (!a) return { status: 404, body: { error: `ZIP ${zipM[1]} not found in Census ZIP Code Tabulation Areas.` } };
      const r = await get(`${GEO}/coordinates?x=${Number(a.INTPTLON)}&y=${Number(a.INTPTLAT)}&${Q}`);
      const geo = pickGeo(r.result?.geographies);
      if (!geo) return { status: 404, body: { error: 'No geography found for that ZIP.' } };
      return { status: 200, maxAge: 86400, body: { kind: 'zip', input: zipM[1], matched: `ZIP ${zipM[1]} (centre point)`, approximate: true, ...geo, sources: [SOURCE, { name: 'Census TIGERweb 2020 ZCTAs', url: 'https://tigerweb.geo.census.gov/' }] } };
    }
    if (address.length < 5) return { status: 400, body: { error: 'Enter a street address with city/state or ZIP, or a 5-digit ZIP.' } };
    const r = await get(`${GEO}/onelineaddress?address=${encodeURIComponent(address)}&${Q}`);
    const m = r.result?.addressMatches?.[0];
    if (!m) return { status: 404, body: { error: 'The Census geocoder could not match that address. Try “street, city, state ZIP”, or just a ZIP.' } };
    const geo = pickGeo(m.geographies);
    if (!geo) return { status: 404, body: { error: 'Matched the address but found no state geography.' } };
    return { status: 200, maxAge: 86400, body: { kind: 'address', matched: m.matchedAddress, approximate: false, ...geo, sources: [SOURCE] } };
  } catch (e) {
    return { status: 502, body: { error: `Census geocoder unavailable (${e.message || e}). Try again shortly.` } };
  }
}

export async function nodeMyareaHandler(p, url, json, res) {
  const r = await myareaApi(url.searchParams);
  return json(res, r.status, r.body);
}
