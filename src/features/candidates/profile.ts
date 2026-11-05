// Enriched profile client for /api/candidates/profile (server/candidates.js) + AU candidate list.
import { useEffect, useMemo, useState } from 'react';
import { AU_PARTIES, FEDERAL, SENATORS, VICTORIA, VIC_CANDIDATES, auPartyColor } from '../../data/au';
import { type MoneyCand, useMoney } from '../money/data';
import type { UsCommittee, UsStats, UsTerm, UsVote } from '../members/data';
import { slugify } from '../members/data';

export interface SourceRef { name: string; url: string; retrieved?: string }
export interface Portrait { src: string; width?: number; height?: number; file: string; page: string; licence: string; licenceUrl: string | null; author: string | null; credit: string }
export interface OfficeHeld { title: string; start: string | null; end: string | null }
export interface Profile {
  ok: boolean; verified?: boolean; noProfile?: string | null; rateLimited?: boolean; error?: string; cached?: boolean; stale?: boolean;
  qid?: string | null; bioguide?: string | null;
  wiki?: { title: string; url: string; description: string | null; extract: string | null; revised: string | null; licence: string; licenceUrl: string } | null;
  facts?: { born: string | null; birthPlace: string | null; education: string[]; occupation: string[]; parties: string[]; website: string | null; social: Record<string, string>; offices: OfficeHeld[] } | null;
  portrait?: Portrait | null;
  congress?: {
    bioguide: string; chamber: 'senate' | 'house'; since: string; termEnd: string; stats: UsStats | null; terms: UsTerm[]; committees: UsCommittee[]; votes: UsVote[];
    contact: { url: string | null }; social: Record<string, string>; ids: { wikipedia: string | null; ballotpedia: string | null; govtrack: number | null; opensecrets: string | null }; photo: string; birthday: string | null;
  } | null;
  ballotpedia?: string | null;
  sources?: SourceRef[]; notes?: string[]; generatedAt?: number;
}

const mem = new Map<string, Profile>();
export function useProfile(q: { name: string; state: string; office: string; party?: string; country?: 'us' | 'au' } | null) {
  const url = q && q.name && !/^tbd/i.test(q.name)
    ? `/api/candidates/profile?${new URLSearchParams({ name: q.name, state: q.state, office: q.office, party: q.party ?? '', country: q.country ?? 'us' })}`
    : null;
  const [st, setSt] = useState<{ data?: Profile; error?: string; loading: boolean }>({ loading: !!url });
  useEffect(() => {
    if (!url) return setSt({ loading: false });
    const hit = mem.get(url);
    if (hit) return setSt({ data: hit, loading: false });
    let on = true;
    setSt({ loading: true });
    fetch(url, { signal: AbortSignal.timeout(60000) })
      .then(async (r) => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`); return j as Profile; })
      .then((d) => { if (!d.rateLimited) mem.set(url, d); if (on) setSt({ data: d, loading: false }); })
      .catch((e) => on && setSt({ error: String(e?.message || e), loading: false }));
    return () => { on = false; };
  }, [url]);
  return st;
}

/** FEC totals from the cached /api/money summary, keyed by app candidate id. */
export function useMoneyIndex() {
  const { data } = useMoney();
  return useMemo(() => {
    const m = new Map<string, MoneyCand>();
    for (const r of data?.races ?? []) for (const c of r.candidates) m.set(c.id, c);
    return { byId: m, summary: data };
  }, [data]);
}

export const ageOn = (born: string | null | undefined, on = new Date()) => {
  if (!born || born.length < 10) return null;
  const b = new Date(born + 'T00:00:00Z');
  let a = on.getUTCFullYear() - b.getUTCFullYear();
  if (on.getUTCMonth() < b.getUTCMonth() || (on.getUTCMonth() === b.getUTCMonth() && on.getUTCDate() < b.getUTCDate())) a--;
  return a;
};
export const fmtDate = (d: string | null | undefined) => {
  if (!d) return '';
  if (d.length === 4) return d;
  const dt = new Date(d.length === 7 ? `${d}-01T00:00:00Z` : `${d}T00:00:00Z`);
  return dt.toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'short', ...(d.length === 10 ? { day: 'numeric' } : {}) });
};

/* ------------------------------ Australian candidates ------------------------------ */
export interface AuCand {
  id: string; name: string; party: string; partyLabel: string; color: string; state: string;
  office: 'au-house' | 'au-senate' | 'vic'; officeLabel: string; seat: string; incumbent: boolean; margin?: number | null; note?: string; memberKey?: string;
}
const tidy = (s: string) => s.replace(/\b([A-Z][A-Z'’-]{1,})\b/g, (w) => w[0] + w.slice(1).toLowerCase());
const pl = (p: string) => AU_PARTIES[p]?.name ?? p;
export const AU_CANDS: AuCand[] = [
  ...FEDERAL.seats.filter((s) => s.chamber === 'federal' && s.member && !s.vacant).map((s): AuCand => ({
    id: `au-h-${s.id}`, memberKey: `au-h-${s.id}`, name: s.member, party: s.party, partyLabel: pl(s.party), color: auPartyColor(s.party), state: s.state,
    office: 'au-house', officeLabel: 'House of Representatives', seat: s.name, incumbent: true, margin: s.margin, note: s.note,
  })),
  ...SENATORS.map((s): AuCand => ({
    id: `au-s-${slugify(s.name)}`, memberKey: `au-s-${slugify(s.name)}`, name: s.name, party: s.party, partyLabel: pl(s.party), color: auPartyColor(s.party), state: s.state,
    office: 'au-senate', officeLabel: 'Senate', seat: `${s.state} Senate`, incumbent: true, note: s.note,
  })),
  ...Object.entries(VIC_CANDIDATES.byDistrict).flatMap(([d, list]) => {
    const seat = VICTORIA.seats.find((s) => s.id === d);
    return list.map(([n, p]): AuCand => {
      const name = tidy(n);
      return {
        id: `${d}-${slugify(name)}`, name, party: p, partyLabel: pl(p), color: auPartyColor(p), state: 'VIC', office: 'vic',
        officeLabel: 'Victorian Legislative Assembly (2026)', seat: seat?.name ?? d.replace(/^vic-/, ''), incumbent: !!seat && slugify(seat.member) === slugify(name), margin: seat?.margin,
      };
    });
  }),
];
