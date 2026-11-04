/**
 * /governors data — real AP results via the NYT public results JSON (CORS open).
 *   results-governor.json   → the 36 governor races
 *   results-<state>.json    → per-state file: other statewide offices (LG, AG, SOS, X…) + ballot measures (I)
 * Never simulated. Owned by src/features/governors/**.
 */
import { useEffect, useState } from 'react';
import type { Party } from '../../types';
import { stateByAbbr } from '../../data';
import { useLive } from '../../lib/live';

export const NYT_BASE = 'https://static01.nyt.com/elections-assets/pages/data/2026-11-03';
export const ATTRIBUTION = 'Results: AP via The New York Times';

/**
 * Sitting governors' party in the 14 states with no governor race in 2026 (they keep it tonight).
 * Source: public record as of Nov 2026 (NJ & VA from the Nov 2025 elections, sworn in Jan 2026).
 */
export const NOT_UP: Record<string, { party: Party; name: string }> = {
  DE: { party: 'D', name: 'Matt Meyer' },
  IN: { party: 'R', name: 'Mike Braun' },
  KY: { party: 'D', name: 'Andy Beshear' },
  LA: { party: 'R', name: 'Jeff Landry' },
  MS: { party: 'R', name: 'Tate Reeves' },
  MO: { party: 'R', name: 'Mike Kehoe' },
  MT: { party: 'R', name: 'Greg Gianforte' },
  NJ: { party: 'D', name: 'Mikie Sherrill' },
  NC: { party: 'D', name: 'Josh Stein' },
  ND: { party: 'R', name: 'Kelly Armstrong' },
  UT: { party: 'R', name: 'Spencer Cox' },
  VA: { party: 'D', name: 'Abigail Spanberger' },
  WA: { party: 'D', name: 'Bob Ferguson' },
  WV: { party: 'R', name: 'Patrick Morrisey' },
};

const PARTY: Record<string, Party> = { DEM: 'D', GOP: 'R', IND: 'I', LIB: 'L', GRN: 'G' };
export const toParty = (p?: string): Party => PARTY[p || ''] || 'O';
export const slug = (n: string) => n.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');

interface NytCandMeta { first_name?: string | null; last_name?: string | null; incumbent?: boolean; img_url?: string | null; party?: { nyt_id?: string } }
export interface NytRace {
  nyt_id: string; office_id: string; office?: string; coverage?: string; seat?: string | null; seat_number?: string | null;
  long_description?: string | null; ballot_measure_text?: string | null; title?: { default?: string | null } | null;
  race_call_status?: string | null; rating?: string | null; has_incumbent?: boolean; url?: string;
  candidate_metadata?: Record<string, NytCandMeta>;
  outcome?: { won?: string[]; gained?: boolean | null; winner_accepted_at?: string[] };
  top_reporting_unit?: { state_postal?: string; eevp?: number; total_votes?: number; candidates?: { nyt_id: string; votes?: { total?: number } }[] };
}

export interface Line { id: string; name: string; party: Party; votes: number; pct: number; incumbent: boolean; photo?: string; won: boolean }
export interface Contest {
  id: string; state: string; office: string; officeId: string; lines: Line[]; called: boolean; status: string;
  eevp: number; total: number; url?: string; desc?: string; calledAt?: number; gained?: boolean | null;
  /** leader minus runner-up, percentage points (signed toward leader) */
  margin: number;
  /** D minus R pct (two-party labels as reported), if both present */
  dMinusR?: number;
  leader?: Line;
}

export function parseContest(r: NytRace): Contest {
  const ru = r.top_reporting_unit || {};
  const meta = r.candidate_metadata || {};
  const won = new Set(r.outcome?.won || []);
  const total = (ru.candidates || []).reduce((a, c) => a + (c.votes?.total || 0), 0);
  const lines: Line[] = (ru.candidates || []).map((c) => {
    const m = meta[c.nyt_id] || {};
    const v = c.votes?.total || 0;
    return {
      id: c.nyt_id, name: [m.first_name, m.last_name].filter(Boolean).join(' ') || c.nyt_id, party: toParty(m.party?.nyt_id),
      votes: v, pct: total ? (v / total) * 100 : 0, incumbent: !!m.incumbent, photo: m.img_url || undefined, won: won.has(c.nyt_id),
    };
  }).sort((a, b) => b.votes - a.votes || Number(b.won) - Number(a.won));
  const d = lines.find((l) => l.party === 'D'), rr = lines.find((l) => l.party === 'R');
  const at = r.outcome?.winner_accepted_at?.[0];
  return {
    id: r.nyt_id, state: ru.state_postal || r.nyt_id.slice(0, 2), office: r.office || r.office_id,
    officeId: r.office_id, lines, called: won.size > 0, status: r.race_call_status || '', eevp: ru.eevp ?? 0, total,
    url: r.url, desc: r.long_description || undefined, calledAt: at ? Date.parse(at) : undefined, gained: r.outcome?.gained,
    margin: lines.length > 1 ? lines[0].pct - lines[1].pct : lines.length ? 100 : 0,
    dMinusR: d && rr ? d.pct - rr.pct : undefined, leader: lines[0],
  };
}

export async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal, cache: 'no-cache' });
  if (!res.ok) throw new Error(`${res.status} ${url.split('/').pop()}`);
  return (await res.json()) as T;
}

/** Polls an NYT file; also refetches whenever the live layer reports a new race call. */
export function useNyt<T>(file: string | null, ms = 60000) {
  const live = useLive();
  const [s, setS] = useState<{ data?: T; error?: string; at?: number }>({});
  useEffect(() => {
    if (!file) return;
    const ctl = new AbortController();
    const load = () => fetchJson<T>(`${NYT_BASE}/${file}`, ctl.signal)
      .then((data) => setS({ data, at: Date.now() }))
      .catch((e) => !ctl.signal.aborted && setS((p) => ({ ...p, error: String(e.message || e) })));
    load();
    const t = setInterval(load, ms);
    return () => { ctl.abort(); clearInterval(t); };
  }, [file, ms, live.calls.length]);
  return s;
}

export function useGovernorRaces() {
  const s = useNyt<{ races?: NytRace[] }>('results-governor.json');
  return { ...s, races: (s.data?.races || []).map(parseContest).sort((a, b) => a.state.localeCompare(b.state)) };
}

export const stateName = (abbr: string) => stateByAbbr.get(abbr)?.name ?? abbr;
/** 2024 presidential margin, D minus R, points */
export const pres24 = (abbr: string) => { const s = stateByAbbr.get(abbr); return s ? s.pres2024.dem - s.pres2024.rep : undefined; };
export const signed = (m: number) => (m >= 0 ? `D+${m.toFixed(1)}` : `R+${(-m).toFixed(1)}`);
