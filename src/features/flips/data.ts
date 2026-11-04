/**
 * Real AP results (via The New York Times' public results JSON) for /flips and /measures.
 * Fetched directly from static01.nyt.com (CORS open). Never simulated.
 */
import { useEffect, useRef, useState } from 'react';
import { stateByAbbr } from '../../data';

export const NYT_BASE = 'https://static01.nyt.com/elections-assets/pages/data/2026-11-03';
export const ATTRIBUTION = 'Results: AP via The New York Times';

export type P = 'D' | 'R' | 'I' | 'O';
export type Office = 'senate' | 'governor' | 'house';

const PARTY: Record<string, P> = { DEM: 'D', GOP: 'R', IND: 'I' };
export const toParty = (nyt?: string): P => PARTY[nyt || ''] || 'O';

/* ---- minimal NYT shapes ---- */
export interface NytCandMeta {
  first_name?: string | null;
  last_name?: string | null;
  incumbent?: boolean;
  img_url?: string | null;
  party?: { nyt_id?: string };
}
export interface NytRace {
  nyt_id: string;
  office_id: string;
  coverage?: string;
  seat?: string | null;
  seat_number?: string | null;
  long_description?: string | null;
  ballot_measure_text?: string | null;
  title?: { default?: string | null } | null;
  race_call_status?: string | null;
  rating?: string | null;
  type?: string | null;
  candidate_metadata?: Record<string, NytCandMeta>;
  outcome?: { won?: string[]; gained?: boolean | null; winner_accepted_at?: string[] };
  top_reporting_unit?: {
    state_postal?: string;
    name?: string;
    eevp?: number;
    total_votes?: number;
    candidates?: { nyt_id: string; votes?: { total?: number } }[];
  };
}

export async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal, cache: 'no-cache' });
  if (!res.ok) throw new Error(`${res.status} ${url.split('/').pop()}`);
  return (await res.json()) as T;
}

/* ---- flips model ---- */
export interface CandLine { id: string; name: string; party: P; votes: number; pct: number; incumbent: boolean; photo?: string }
export interface FlipRace {
  id: string;
  office: Office;
  state: string;
  stateName: string;
  label: string; // "PA-7", "Iowa Senate"
  called: boolean;
  status: string;
  rating?: string | null;
  eevp: number;
  winner?: CandLine;
  before?: P; // party that held the seat
  flipped: boolean;
  calledAt?: number;
  cands: CandLine[];
}

const name = (m?: NytCandMeta) => [m?.first_name, m?.last_name].filter(Boolean).join(' ') || '—';

export function parseRace(r: NytRace, office: Office): FlipRace {
  const ru = r.top_reporting_unit || {};
  const meta = r.candidate_metadata || {};
  const total = (ru.candidates || []).reduce((a, c) => a + (c.votes?.total || 0), 0);
  const cands: CandLine[] = (ru.candidates || [])
    .map((c) => {
      const m = meta[c.nyt_id];
      const v = c.votes?.total || 0;
      return { id: c.nyt_id, name: name(m), party: toParty(m?.party?.nyt_id), votes: v, pct: total ? (v / total) * 100 : 0, incumbent: !!m?.incumbent, photo: m?.img_url || undefined };
    })
    .filter((c) => !/write-?in/i.test(c.id))
    .sort((a, b) => b.votes - a.votes);
  const wonId = r.outcome?.won?.[0];
  const winner = wonId ? cands.find((c) => c.id === wonId) : undefined;
  const st = ru.state_postal || r.nyt_id.slice(0, 2);
  const stateName = ru.name || st;
  const flipped = !!winner && r.outcome?.gained === true;
  let before: P | undefined;
  if (winner) {
    if (!flipped) before = winner.party;
    else {
      // The losing incumbent's party when one ran; otherwise the other major party.
      const inc = cands.find((c) => c.incumbent && c.id !== winner.id);
      before = inc ? inc.party : winner.party === 'D' ? 'R' : winner.party === 'R' ? 'D' : undefined;
    }
  }
  const seat = Number(r.seat_number) || 0;
  const label =
    office === 'house'
      ? `${st}-${(stateByAbbr.get(st)?.houseSeats ?? 2) <= 1 ? 'AL' : seat || 'AL'}`
      : `${stateName} ${office === 'senate' ? (/special/i.test(r.type || '') ? 'Senate (special)' : 'Senate') : 'Governor'}`;
  const at = r.outcome?.winner_accepted_at?.[0];
  return {
    id: r.nyt_id, office, state: st, stateName, label,
    called: !!winner, status: r.race_call_status || 'unknown', rating: r.rating,
    eevp: ru.eevp ?? 0, winner, before, flipped, calledAt: at ? Date.parse(at) : undefined, cands,
  };
}

interface FlipsData { races: FlipRace[]; updatedAt: number; errors: string[] }

/** Polls the three chamber files every `ms` (default 60s). */
export function useFlipsData(ms = 60000) {
  const [data, setData] = useState<FlipsData | null>(null);
  const [loading, setLoading] = useState(true);
  const tick = useRef(0);
  useEffect(() => {
    let alive = true;
    const ctl = new AbortController();
    const load = async () => {
      const n = ++tick.current;
      const offices: Office[] = ['senate', 'governor', 'house'];
      const out = await Promise.allSettled(offices.map((o) => fetchJson<{ races: NytRace[] }>(`${NYT_BASE}/results-${o}.json`, ctl.signal)));
      if (!alive || n !== tick.current) return;
      const races: FlipRace[] = [];
      const errors: string[] = [];
      out.forEach((res, i) => {
        if (res.status === 'fulfilled') {
          for (const r of res.value.races || []) {
            if (!r.nyt_id || r.nyt_id.startsWith('US-')) continue;
            races.push(parseRace(r, offices[i]));
          }
        } else errors.push(offices[i]);
      });
      setData((prev) => {
        // Keep previous rows for any chamber that failed this round.
        const keep = prev ? prev.races.filter((r) => errors.includes(r.office)) : [];
        return { races: [...races, ...keep], updatedAt: Date.now(), errors };
      });
      setLoading(false);
    };
    load();
    const t = setInterval(load, ms);
    return () => { alive = false; ctl.abort(); clearInterval(t); };
  }, [ms]);
  return { data, loading };
}
