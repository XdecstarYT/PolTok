/**
 * Post-election data from The New York Times' public results JSON (AP vote counts & race calls,
 * NYT model estimates). Files are CORS-open, fetched directly from the browser and cached in memory.
 * Everything here is parsed from those files — nothing is invented. Data © NYT / AP.
 */
import { raceById } from '../../data';

export const NYT_BASE = 'https://static01.nyt.com/elections-assets/pages/data/2026-11-03';
export const NYT_CREDIT = 'Data: AP via The New York Times';

export type Chamber = 'senate' | 'governor' | 'house';
export type P = 'D' | 'R' | 'I' | 'O';
const PARTY: Record<string, P> = { DEM: 'D', GOP: 'R', IND: 'I' };
const toP = (id?: string): P => PARTY[id ?? ''] ?? 'O';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;

const cache = new Map<string, Promise<Json>>();
export function fetchNyt(file: string): Promise<Json> {
  let p = cache.get(file);
  if (!p) {
    p = fetch(`${NYT_BASE}/${file}`, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))));
    p.catch(() => cache.delete(file));
    cache.set(file, p);
  }
  return p;
}

export interface NRace {
  nytId: string;
  chamber: Chamber;
  state: string;
  stateName: string;
  district?: number;
  special: boolean;
  id: string; // our race id (may not exist in RACES)
  label: string; // "GA Senate", "PA-07"
  winner?: { party: P; name: string; at: number };
  flipped: boolean;
  uncontested: boolean;
  totalVotes: number;
  expectedVote: number;
  eevp: number;
  /** vote share (0..100) of the top candidate of each party */
  share: Partial<Record<P, number>>;
  shareName: Partial<Record<P, string>>;
  partyVotes: Partial<Record<P, number>>;
  /** D−R margin in points (only when both a D and an R are on the ballot) */
  margin?: number;
  pres24?: { margin: number; votes?: number };
  slug?: string; // per-race file slug (statewide only)
  rating?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

function parseRace(r: Json, chamber: Chamber): NRace | null {
  const t = r.top_reporting_unit;
  if (!t || t.state_postal === 'US') return null;
  const st: string = t.state_postal;
  const special = r.race_type_id === 'W' || /-S_W-/.test(r.nyt_id);
  const district = chamber === 'house' ? Number(r.seat_number) || 1 : undefined;
  let id = chamber === 'senate' ? `${st}-SEN${special ? '-S' : ''}` : chamber === 'governor' ? `${st}-GOV` : `${st}-${pad(district!)}`;
  if (chamber === 'house' && !raceById.get(id) && raceById.get(`${st}-AL`)) id = `${st}-AL`;
  const meta = r.candidate_metadata ?? {};
  const name = (cid: string) => {
    const m = meta[cid];
    return m ? [m.first_name, m.last_name].filter(Boolean).join(' ') : cid;
  };
  const total = t.total_votes ?? 0;
  const share: NRace['share'] = {};
  const shareName: NRace['shareName'] = {};
  const partyVotes: NRace['partyVotes'] = {};
  for (const c of t.candidates ?? []) {
    if (/write/i.test(c.nyt_id)) continue;
    const p = toP(meta[c.nyt_id]?.party?.nyt_id);
    const v = c.votes?.total ?? 0;
    partyVotes[p] = (partyVotes[p] ?? 0) + v;
    if (total > 0 && (share[p] == null || (v / total) * 100 > share[p]!)) {
      share[p] = (v / total) * 100;
      shareName[p] = name(c.nyt_id);
    }
  }
  const won: string | undefined = r.outcome?.won?.[0];
  const at = r.outcome?.winner_accepted_at?.[0];
  const hist = t.historical_comparison_race_data ?? {};
  const presKey = Object.keys(hist).find((k) => /-G-P-2024/.test(k));
  const slug = typeof r.url === 'string' ? r.url.match(/\/(results-[a-z0-9-]+)\.html/)?.[1] : undefined;
  const label = chamber === 'house' ? id : `${st} ${chamber === 'senate' ? (special ? 'Senate (special)' : 'Senate') : 'Governor'}`;
  return {
    nytId: r.nyt_id, chamber, state: st, stateName: t.name, district, special, id, label,
    winner: won && at ? { party: toP(meta[won]?.party?.nyt_id), name: name(won), at: Date.parse(at) } : undefined,
    flipped: !!r.outcome?.gained,
    uncontested: !!r.uncontested,
    totalVotes: total,
    expectedVote: t.total_expected_vote ?? 0,
    eevp: t.eevp ?? 0,
    share, shareName, partyVotes,
    margin: share.D != null && share.R != null ? share.D - share.R : undefined,
    pres24: presKey ? { margin: hist[presKey].margin, votes: hist[presKey].votes } : undefined,
    slug: chamber === 'house' ? undefined : slug,
    rating: r.rating ?? undefined,
  };
}

export interface ModelPoint {
  t: number;
  S?: { D: number; R: number; pD: number };
  H?: { D: number; R: number; pD: number };
}
export interface Insight { id: string; kind: string; raceId: string; text: string; at: number }

export interface Overview {
  races: NRace[];
  model: ModelPoint[];
  insights: Insight[];
  senateBase: { D: number; R: number; O: number; total: number; toWin: number };
  houseNational?: { D: number; R: number; O: number; total: number; expected: number; eevp: number };
  pollCloses: { state: string; at: number }[];
  updated: number;
}

function modelSide(arr: Json[] | undefined) {
  if (!arr) return undefined;
  const g = (p: string) => arr.find((x) => x.nyt_party_id === p);
  const d = g('DEM'), r = g('GOP');
  if (!d || !r) return undefined;
  return { D: d.seats, R: r.seats, pD: d.win_probability };
}

let overviewP: Promise<Overview> | null = null;
export function loadOverview(): Promise<Overview> {
  return (overviewP ??= Promise.all([fetchNyt('results-senate.json'), fetchNyt('results-governor.json'), fetchNyt('results-house.json')]).then(
    ([sen, gov, house]) => {
      const races: NRace[] = [];
      for (const [doc, ch] of [[sen, 'senate'], [gov, 'governor'], [house, 'house']] as const)
        for (const r of doc.races ?? []) {
          const x = parseRace(r, ch);
          if (x) races.push(x);
        }
      // Model timeseries: the governor page carries both chambers.
      const ts: Json[] = gov.partyControlTimeseriesData?.results ?? sen.partyControlTimeseriesData?.results ?? [];
      const model: ModelPoint[] = ts
        .map((e) => ({ t: Date.parse(e.nyt_updated_at), S: modelSide(e.nyt_model_estimates?.S), H: modelSide(e.nyt_model_estimates?.H) }))
        .filter((m) => Number.isFinite(m.t))
        .sort((a, b) => a.t - b.t);
      const seen = new Set<string>();
      const insights: Insight[] = [];
      for (const doc of [sen, gov, house])
        for (const i of doc.raceInsights ?? []) {
          if (seen.has(i.id) || i.hidden || !i.text) continue;
          seen.add(i.id);
          insights.push({ id: i.id, kind: i.race_insight, raceId: i.nyt_race_id, text: i.text, at: Date.parse(i.created_at) });
        }
      insights.sort((a, b) => a.at - b.at);
      const pb = sen.partyControlData?.results?.[0]?.offices?.S;
      const senateBase = {
        D: pb?.party_balance?.DEM?.no_election ?? 0,
        R: pb?.party_balance?.GOP?.no_election ?? 0,
        O: pb?.party_balance?.OTH?.no_election ?? 0,
        total: pb?.total ?? 100,
        toWin: pb?.to_win?.DEM ?? 51,
      };
      const us = (house.races ?? []).find((r: Json) => r.top_reporting_unit?.state_postal === 'US')?.top_reporting_unit;
      let houseNational: Overview['houseNational'];
      if (us) {
        const v = (id: string) => us.candidates?.find((c: Json) => c.nyt_id === id)?.votes?.total ?? 0;
        houseNational = { D: v('democrat'), R: v('republican'), O: v('other'), total: us.total_votes, expected: us.total_expected_vote, eevp: us.eevp };
      }
      const pc = new Map<string, number>();
      for (const doc of [sen, gov, house])
        for (const p of doc.pollClosingTimes ?? []) {
          const s = p.reporting_unit?.state_postal;
          const at = Date.parse(p.poll_closing_time);
          if (s && Number.isFinite(at) && (!pc.has(s) || at < pc.get(s)!)) pc.set(s, at);
        }
      const updated = Math.max(...[sen, gov, house].map((d) => Date.parse(d.resultsMeta?.resultsUpdatedAt ?? '') || 0));
      return { races, model, insights, senateBase, houseNational, pollCloses: [...pc].map(([state, at]) => ({ state, at })), updated };
    },
  )).catch((e) => {
    overviewP = null;
    throw e;
  });
}

/* ───────── per-race file ───────── */

export interface RacePoint { t: number; votes: number; pD?: number; shareD?: number; shareR?: number }
export interface CountyRow { fips: string; name: string; margin?: number; pres24?: number; votes: number; votes24?: number; eevp: number }
export interface RaceDetail { points: RacePoint[]; counties: CountyRow[]; dName?: string; rName?: string }

export async function loadRaceDetail(slug: string, special = false): Promise<RaceDetail> {
  const doc = await fetchNyt(`${slug}.json`);
  const races: Json[] = doc.races ?? [];
  const r = (special ? races.find((x) => x.race_type_id === 'W') : races.find((x) => x.race_type_id !== 'W')) ?? races[0];
  const meta = r?.candidate_metadata ?? {};
  const pOf = (cid: string) => toP(meta[cid]?.party?.nyt_id);
  // Only the main D and main R (by final votes) define the two-way needle.
  const top = r?.top_reporting_unit?.candidates ?? [];
  const best = (p: P) => top.filter((c: Json) => pOf(c.nyt_id) === p).sort((a: Json, b: Json) => (b.votes?.total ?? 0) - (a.votes?.total ?? 0))[0]?.nyt_id as string | undefined;
  const dId = best('D') ?? best('I'), rId = best('R');
  const nm = (cid?: string) => (cid && meta[cid] ? [meta[cid].first_name, meta[cid].last_name].filter(Boolean).join(' ') : undefined);
  const series: Json[] = (r && doc.timeseries?.[r.nyt_id]) ?? [];
  const points: RacePoint[] = series
    .map((e) => {
      const c = (id?: string) => e.candidates?.find((x: Json) => x.nyt_id === id);
      const d = c(dId), rr = c(rId);
      const tot = e.total_votes || 0;
      const pd = d?.nyt_model_estimates?.win_probability;
      const pr = rr?.nyt_model_estimates?.win_probability;
      return {
        t: Date.parse(e.greatest_updated_at), votes: tot,
        pD: typeof pd === 'number' && typeof pr === 'number' && pd + pr > 0 ? pd / (pd + pr) : undefined,
        shareD: tot ? ((d?.votes?.total ?? 0) / tot) * 100 : undefined,
        shareR: tot ? ((rr?.votes?.total ?? 0) / tot) * 100 : undefined,
      };
    })
    .filter((p) => Number.isFinite(p.t))
    .sort((a, b) => a.t - b.t);
  const counties: CountyRow[] = [];
  for (const u of r?.reporting_units ?? []) {
    if (u.level !== 'county' || !u.fips_county) continue;
    const tot = u.total_votes ?? 0;
    const v = (id?: string) => u.candidates?.find((x: Json) => x.nyt_id === id)?.votes?.total ?? 0;
    const hist = u.historical_comparison_race_data ?? {};
    const pk = Object.keys(hist).find((k) => /-G-P-2024/.test(k));
    counties.push({
      fips: `${u.fips_state}${u.fips_county}`, name: u.name, votes: tot, eevp: u.eevp ?? 0,
      margin: tot > 0 ? ((v(dId) - v(rId)) / tot) * 100 : undefined,
      pres24: pk ? hist[pk].margin : undefined, votes24: pk ? hist[pk].votes : undefined,
    });
  }
  return { points, counties, dName: nm(dId), rName: nm(rId) };
}

/** Last element with t <= at (binary search). */
export function atTime<T extends { t: number }>(arr: T[], at: number): T | undefined {
  let lo = 0, hi = arr.length - 1, ans = -1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (arr[m].t <= at) (ans = m), (lo = m + 1);
    else hi = m - 1;
  }
  return ans >= 0 ? arr[ans] : undefined;
}

export const fmtSigned = (m: number, d = 1) => (Math.abs(m) < 0.05 ? 'Even' : `${m > 0 ? 'D' : 'R'}+${Math.abs(m).toFixed(d)}`);
