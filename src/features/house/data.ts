/**
 * House data: all 435 races from the NYT/AP results-house.json (CORS open, ~9–10 MB).
 * Fetched once, then re-polled every 90 s with cache:'no-cache' (conditional GET, so an unchanged
 * file costs ~nothing). Parsed down to a slim per-district record. Real results only — never simulated.
 */
import { useEffect, useRef, useState } from 'react';
import { stateByAbbr } from '../../data';

export const HOUSE_URL = 'https://static01.nyt.com/elections-assets/pages/data/2026-11-03/results-house.json';
export const ATTRIBUTION = 'Results: AP via The New York Times';
export const POLL_MS = 90_000;

export type P = 'D' | 'R' | 'I' | 'O';

export interface HCand {
  id: string;
  name: string;
  party: P;
  partyName: string;
  votes: number;
  pct: number;
  incumbent: boolean;
  img?: string;
  winProb?: number;
}

export interface HRace {
  key: string; // "PA-07" / "AK-AL"
  state: string;
  stateName: string;
  district: number; // 0 = at-large
  label: string;
  status: string; // called | too_early | runoff | ...
  called: boolean;
  runoff: boolean;
  uncontested: boolean;
  winner?: HCand;
  leader?: HCand;
  /** party shown on the map: winner if called, else current leader (votes > 0) */
  party?: P;
  /** leader minus runner-up, percentage points */
  margin: number;
  eevp: number;
  totalVotes: number;
  flipped: boolean;
  before?: P;
  calledAt?: number;
  rating?: string | null;
  cands: HCand[];
  pres2024Margin?: number; // + = D
  updatedAt?: number;
  counties: { name: string; eevp: number; lead?: P; margin: number; votes: number }[];
}

export interface HouseData {
  races: HRace[];
  byKey: Map<string, HRace>;
  control: { D: number; R: number; I: number; flipsD: number; flipsR: number; called: number; winner?: P; prevD?: number; prevR?: number };
  popular?: { D: number; R: number; O: number; eevp: number };
  updatedAt?: number;
}

const toP = (id?: string): P => (id === 'DEM' ? 'D' : id === 'GOP' ? 'R' : id === 'IND' || id === 'NPA' || id === 'OTH' ? 'I' : 'O');
export const pad = (n: number) => String(n).padStart(2, '0');

/* eslint-disable @typescript-eslint/no-explicit-any */
function parseRace(r: any): HRace | null {
  const ru = r.top_reporting_unit;
  const st: string = ru?.state_postal;
  if (!st || st === 'US') return null;
  const meta: Record<string, any> = r.candidate_metadata || {};
  const total: number = ru.total_votes || 0;
  const cands: HCand[] = (ru.candidates || [])
    .map((c: any) => {
      const m = meta[c.nyt_id] || {};
      const v = c.votes?.total ?? 0;
      return {
        id: c.nyt_id,
        name: [m.first_name, m.last_name].filter(Boolean).join(' ') || c.nyt_id,
        party: toP(m.party?.nyt_id),
        partyName: m.party?.name || 'Other',
        votes: v,
        pct: total ? (v / total) * 100 : 0,
        incumbent: !!m.incumbent,
        img: m.img_url || undefined,
        winProb: c.nyt_model_estimates?.win_probability ?? undefined,
      } satisfies HCand;
    })
    .filter((c: HCand) => !/write-?in/i.test(c.id))
    .sort((a: HCand, b: HCand) => b.votes - a.votes);
  // uncontested races may have no vote rows: still list the candidate(s)
  if (!cands.length) {
    for (const m of Object.values(meta)) {
      cands.push({ id: m.nyt_id, name: [m.first_name, m.last_name].filter(Boolean).join(' '), party: toP(m.party?.nyt_id), partyName: m.party?.name || 'Other', votes: 0, pct: 0, incumbent: !!m.incumbent, img: m.img_url || undefined });
    }
  }
  const wonId = r.outcome?.won?.[0];
  const winner = wonId ? cands.find((c) => c.id === wonId) : undefined;
  const leader = cands[0] && cands[0].votes > 0 ? cands[0] : undefined;
  const margin = cands.length > 1 ? cands[0].pct - cands[1].pct : cands[0]?.votes ? 100 : 0;
  const flipped = !!winner && r.outcome?.gained === true;
  let before: P | undefined;
  if (winner) {
    if (!flipped) before = winner.party;
    else {
      const inc = cands.find((c) => c.incumbent && c.id !== winner.id);
      before = inc ? inc.party : winner.party === 'D' ? 'R' : winner.party === 'R' ? 'D' : undefined;
    }
  }
  const district = Number(r.seat_number) || 0;
  const al = (stateByAbbr.get(st)?.houseSeats ?? 2) <= 1 || district === 0;
  const key = `${st}-${al ? 'AL' : pad(district)}`;
  const at = r.outcome?.winner_accepted_at?.[0];
  const histKey = Object.keys(ru.historical_comparison_race_data || {}).find((k) => /-G-P-2024/.test(k));
  const hist = histKey ? ru.historical_comparison_race_data[histKey] : undefined;
  const counties = (r.reporting_units || [])
    .filter((u: any) => u.level !== 'state' && u.level !== 'national')
    .map((u: any) => {
      const cs = [...(u.candidates || [])].sort((a: any, b: any) => (b.votes?.total ?? 0) - (a.votes?.total ?? 0));
      const tv = u.total_votes || 0;
      const l = cs[0], s = cs[1];
      return {
        name: u.name as string,
        eevp: u.eevp ?? 0,
        lead: l && (l.votes?.total ?? 0) > 0 ? toP(meta[l.nyt_id]?.party?.nyt_id) : undefined,
        margin: tv && l ? (((l.votes?.total ?? 0) - (s?.votes?.total ?? 0)) / tv) * 100 : 0,
        votes: tv,
      };
    })
    .sort((a: any, b: any) => b.votes - a.votes);
  return {
    key, state: st, stateName: ru.name || st, district: al ? 0 : district,
    label: al ? `${st} at-large` : `${st}-${district}`,
    status: r.race_call_status || 'unknown',
    called: !!winner,
    runoff: r.race_call_status === 'runoff',
    uncontested: !!r.uncontested,
    winner, leader,
    party: winner?.party ?? leader?.party,
    margin, eevp: ru.eevp ?? 0, totalVotes: total, flipped, before,
    calledAt: at ? Date.parse(at) : undefined,
    rating: r.rating,
    cands,
    pres2024Margin: typeof hist?.margin === 'number' ? hist.margin : undefined,
    updatedAt: r.updated_at ? Date.parse(r.updated_at) : undefined,
    counties,
  };
}

export function parseHouse(json: any): HouseData {
  const races: HRace[] = [];
  let popular: HouseData['popular'];
  for (const r of json?.races ?? []) {
    if (r?.top_reporting_unit?.state_postal === 'US') {
      const ru = r.top_reporting_unit;
      const v = (id: string) => ru.candidates?.find((c: any) => c.nyt_id === id)?.votes?.total ?? 0;
      popular = { D: v('democrat'), R: v('republican'), O: v('other'), eevp: ru.eevp ?? 0 };
      continue;
    }
    const p = parseRace(r);
    if (p) races.push(p);
  }
  races.sort((a, b) => a.state.localeCompare(b.state) || a.district - b.district);
  const pc = json?.partyControlData?.results?.[0]?.offices?.H;
  const pb = pc?.party_balance ?? {};
  // Seat counts computed from the race calls themselves (cross-checks NYT's balance figure).
  const cnt = { D: 0, R: 0, I: 0 };
  let fD = 0, fR = 0;
  // Same-party contests (e.g. California top-two D-vs-D) are locked for that party before AP names a
  // winner; NYT's party balance counts them, so we do too — keeps /house in step with home/embeds.
  for (const raw of json?.races ?? []) {
    if (raw?.top_reporting_unit?.state_postal === 'US' || raw?.outcome?.won?.length || !raw?.in_party_control) continue;
    const ids: string[] = raw.outcome?.advanced_to_runoff?.length ? raw.outcome.advanced_to_runoff : (raw.top_reporting_unit?.candidates ?? []).map((c: any) => c.nyt_id);
    const ps = new Set(ids.map((id) => raw.candidate_metadata?.[id]?.party?.nyt_id));
    if (ps.size !== 1) continue;
    const only = [...ps][0];
    cnt[only === 'DEM' ? 'D' : only === 'GOP' ? 'R' : 'I']++;
  }
  for (const r of races) {
    if (!r.winner) continue;
    const p = r.winner.party === 'D' ? 'D' : r.winner.party === 'R' ? 'R' : 'I';
    cnt[p]++;
    if (r.flipped) { if (p === 'D') fD++; else if (p === 'R') fR++; }
  }
  const winner: P | undefined = pb.DEM?.winner ? 'D' : pb.GOP?.winner ? 'R' : undefined;
  return {
    races,
    byKey: new Map(races.map((r) => [r.key, r])),
    control: {
      ...cnt, flipsD: fD, flipsR: fR, called: races.filter((r) => r.called).length, winner,
      prevD: pc?.current_control?.DEM, prevR: pc?.current_control?.GOP,
    },
    popular,
    updatedAt: json?.resultsMeta?.resultsUpdatedAt ? Date.parse(json.resultsMeta.resultsUpdatedAt) : undefined,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Fetch once, then poll every 90 s. Keeps the last good data on error. */
export function useHouseData() {
  const [data, setData] = useState<HouseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const etag = useRef<string | null>(null);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ctl: AbortController | undefined;
    const tick = async () => {
      ctl = new AbortController();
      try {
        const res = await fetch(HOUSE_URL, { cache: 'no-cache', signal: ctl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const tag = res.headers.get('etag') || res.headers.get('last-modified');
        if (!tag || tag !== etag.current) {
          const json = await res.json();
          if (!alive) return;
          etag.current = tag;
          setData(parseHouse(json));
        } else {
          res.body?.cancel().catch(() => {});
        }
        if (alive) { setError(null); setFetchedAt(Date.now()); }
      } catch (e) {
        if (alive && (e as Error).name !== 'AbortError') setError((e as Error).message || 'Network error');
      } finally {
        if (alive) timer = setTimeout(tick, document.hidden ? POLL_MS * 2 : POLL_MS);
      }
    };
    tick();
    return () => { alive = false; clearTimeout(timer); ctl?.abort(); };
  }, []);
  return { data, error, fetchedAt, loading: !data && !error };
}
