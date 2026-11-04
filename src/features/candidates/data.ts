// Candidate directory data (agent 1 — CANDIDATES). Only data-backed facts: seed race data
// (src/data), live results (AP via NYT, incl. names/photos/incumbency) and NYT candidate_metadata.
import { useEffect, useMemo, useState } from 'react';
import type { Candidate, NewsItem, Party, Race, RaceResult } from '../../types';
import { RACES } from '../../data';
import { useLive } from '../../lib/live';
import { sharesOf, totalVotes } from '../races/util';

export type Office = 'senate' | 'governor' | 'house';
export type Outcome = 'won' | 'lost' | 'leading' | 'trailing' | 'pending';

export interface NytMeta {
  fullName: string;
  last: string;
  party: Party;
  photo?: string;
  incumbent?: boolean;
  partyName?: string;
}

export interface CandEntry {
  cand: Candidate;
  race: Race;
  result?: RaceResult;
  /** vote share 0..100 of counted vote (undefined if nothing counted) */
  pct?: number;
  votes: number;
  /** pts vs best opponent (positive = ahead) */
  margin?: number;
  outcome: Outcome;
  meta?: NytMeta;
}

const BASE = 'https://static01.nyt.com/elections-assets/pages/data/2026-11-03';
const PARTY: Record<string, Party> = { DEM: 'D', GOP: 'R', IND: 'I', LIB: 'L', GRN: 'G' };
export const norm = (s: string) =>
  String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
const lastName = (name: string) => {
  const p = name.replace(/,?\s+(Jr\.?|Sr\.?|III|II|IV)$/i, '').trim().split(/\s+/);
  return p[p.length - 1] || name;
};

/* ---------- NYT candidate_metadata (Senate + Governor; House comes via live results) ---------- */

type MetaIndex = Map<string, NytMeta[]>; // raceId -> metadata of every listed candidate
let metaPromise: Promise<MetaIndex> | null = null;

function raceKeyIndex() {
  const m = new Map<string, string>();
  for (const r of RACES) {
    if (r.chamber === 'senate') m.set(`S|${r.state}|${r.special ? 'special' : ''}`, r.id);
    else if (r.chamber === 'governor') m.set(`G|${r.state}|`, r.id);
  }
  return m;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function loadMeta(): Promise<MetaIndex> {
  const keys = raceKeyIndex();
  const out: MetaIndex = new Map();
  await Promise.all(
    (['senate', 'governor'] as const).map(async (kind) => {
      try {
        const res = await fetch(`${BASE}/results-${kind}.json`);
        if (!res.ok) return;
        const doc: any = await res.json();
        for (const nr of doc?.races ?? []) {
          if (String(nr?.nyt_id).startsWith('US-')) continue;
          const st = nr.top_reporting_unit?.state_postal || String(nr.nyt_id).slice(0, 2);
          const special = /special/i.test(nr.type || '') || nr.race_type_id === 'W';
          const id = keys.get(kind === 'senate' ? `S|${st}|${special ? 'special' : ''}` : `G|${st}|`);
          if (!id) continue;
          const list: NytMeta[] = [];
          for (const m of Object.values<any>(nr.candidate_metadata ?? {})) {
            const fullName = [m.first_name, m.middle_name, m.last_name, m.suffix].filter(Boolean).join(' ');
            if (!m.last_name || /write-?in/i.test(fullName)) continue;
            list.push({
              fullName,
              last: norm(m.last_name),
              party: PARTY[m.party?.nyt_id] ?? 'O',
              partyName: m.party?.name,
              photo: typeof m.img_url === 'string' ? m.img_url : undefined,
              incumbent: typeof m.incumbent === 'boolean' ? m.incumbent : undefined,
            });
          }
          out.set(id, list);
        }
      } catch {
        /* offline / blocked: seed data only */
      }
    }),
  );
  return out;
}

export function useNytMeta(): MetaIndex | null {
  const [idx, setIdx] = useState<MetaIndex | null>(null);
  useEffect(() => {
    let on = true;
    metaPromise ??= loadMeta();
    metaPromise.then((m) => on && setIdx(m));
    return () => {
      on = false;
    };
  }, []);
  return idx;
}

function findMeta(idx: MetaIndex | null, raceId: string, c: Candidate): NytMeta | undefined {
  const list = idx?.get(raceId);
  if (!list || /^tbd/i.test(c.name)) return undefined;
  const l = norm(lastName(c.name));
  return list.find((m) => m.last === l && (m.party === c.party || c.party === 'O')) ?? list.find((m) => m.last === l);
}

/* ---------- Entries ---------- */

/** Race candidates merged with the live provider's authoritative list (names / photos / incumbency). */
export function mergedCandidates(race: Race, result?: RaceResult): Candidate[] {
  const live = result?.candidates;
  if (!live?.length) return race.candidates ?? [];
  const byId = new Map(live.map((c) => [c.id, c]));
  const out = (race.candidates ?? []).map((c) => ({ ...c, ...(byId.get(c.id) ?? {}) }));
  for (const c of live) if (!out.some((x) => x.id === c.id)) out.push(c);
  return out;
}

function entriesFor(race: Race, result: RaceResult | undefined, idx: MetaIndex | null): CandEntry[] {
  const cands = mergedCandidates(race, result).filter((c) => c.name && !/^tbd$/i.test(c.name));
  const r2: Race = { ...race, candidates: cands };
  const shares = sharesOf(r2, result);
  const counted = totalVotes(result) > 0;
  return cands.map((c) => {
    const meta = findMeta(idx, race.id, c);
    const cand: Candidate = {
      ...c,
      photo: c.photo ?? meta?.photo,
      incumbent: c.incumbent ?? meta?.incumbent,
    };
    const me = shares.find((s) => s.cand.id === c.id);
    const best = shares.filter((s) => s.cand.id !== c.id).sort((a, b) => b.votes - a.votes)[0];
    const pct = counted ? me?.pct : undefined;
    const margin = counted && me ? me.pct - (best?.pct ?? 0) : undefined;
    let outcome: Outcome = 'pending';
    if (result?.calledFor) outcome = result.calledFor === c.id ? 'won' : 'lost';
    else if (margin !== undefined) outcome = margin > 0 ? 'leading' : 'trailing';
    return { cand, race: r2, result, pct, votes: me?.votes ?? 0, margin, outcome, meta };
  });
}

export function useCandidates(): CandEntry[] {
  const { results } = useLive();
  const idx = useNytMeta();
  return useMemo(() => RACES.flatMap((r) => entriesFor(r, results[r.id], idx)), [results, idx]);
}

/** Find a candidate by id. Ids are `${raceId}-${party}` lowercase, so the race id is a prefix. */
export function useCandidate(id: string): CandEntry | undefined {
  const all = useCandidates();
  return all.find((e) => e.cand.id === id.toLowerCase());
}

export const officeLabel = (race: Race) =>
  race.chamber === 'senate' ? `U.S. Senate${race.special ? ' (special)' : ''}` : race.chamber === 'governor' ? 'Governor' : `U.S. House, ${race.id}`;

/** Real headlines naming the candidate (full name or distinctive surname). */
export function candidateNews(news: NewsItem[], c: Candidate, limit = 8): NewsItem[] {
  const last = lastName(c.name);
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const full = new RegExp(`\\b${esc(c.name)}\\b`, 'i');
  const sur = last.length >= 5 ? new RegExp(`\\b${esc(last)}\\b`) : null;
  return news.filter((n) => full.test(n.title) || (sur && sur.test(`${n.title} ${n.summary ?? ''}`))).slice(0, limit);
}
