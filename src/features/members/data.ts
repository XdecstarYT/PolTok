/** Members directory data: US from /api/members (congress-legislators + Voteview), AU from src/data/au.ts. */
import { useEffect, useState } from 'react';
import { AU_PARTIES, FEDERAL, SENATORS, auPartyColor } from '../../data/au';
import { PARTY_HEX } from '../../lib/format';

export interface UsStats { icpsr: string | null; dim1: number | null; dim2: number | null; votes: number | null; missedPct: number | null; partyUnityPct: number | null; unityVotes: number | null }
export interface UsMember {
  id: string; name: string; last: string; chamber: 'senate' | 'house'; party: 'D' | 'R' | 'I'; partyName: string; caucus: string | null;
  state: string; district: number | null; senClass: number | null; rank: string | null; since: string; termEnd: string; photo: string; stats: UsStats | null;
}
export interface UsTerm { type: 'rep' | 'sen'; start: string; end: string; state: string; district: number | null; party: string; class: number | null; how: string | null }
export interface UsCommittee { code: string; name: string; url?: string; sub: boolean; title: string | null; rank: number | null; side: string | null }
export interface UsVote { chamber: string; roll: number; date: string; bill: string; question: string; description: string; result: string; vote: 'Y' | 'N' | 'P' | 'X'; yea: number | null; nay: number | null }
export interface UsMemberFull extends UsMember {
  gender: string | null; birthday: string | null; terms: UsTerm[];
  contact: { url: string | null; phone: string | null; office: string | null; contactForm: string | null };
  social: Record<string, string>; ids: { govtrack: number | null; opensecrets: string | null; wikipedia: string | null; ballotpedia: string | null; fec: string[] };
  committees: UsCommittee[]; votes: UsVote[];
}
export interface Source { name: string; url: string }

/** Unified directory row. */
export interface DirMember {
  key: string; // route id
  country: 'US' | 'AU';
  name: string; last: string;
  chamber: 'senate' | 'house';
  party: string; partyLabel: string; color: string;
  state: string; seat: string; // "WA-1", "Kooyong"
  photo?: string;
  dim1?: number | null; dim2?: number | null; unity?: number | null;
  margin?: number | null;
  note?: string;
}

export const slugify = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const initials = (n: string) => {
  const w = n.replace(/\(.*?\)/g, '').split(/\s+/).filter((x) => /^[A-Za-z]/.test(x));
  return ((w[0]?.[0] ?? '') + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase();
};
export const US_PARTY: Record<string, string> = { D: 'Democrat', R: 'Republican', I: 'Independent' };

export function usDir(m: UsMember): DirMember {
  return {
    key: m.id, country: 'US', name: m.name, last: m.last, chamber: m.chamber, party: m.party, partyLabel: m.partyName,
    color: PARTY_HEX[m.party], state: m.state,
    seat: m.chamber === 'senate' ? `${m.state} · Senate${m.rank ? ` (${m.rank})` : ''}` : `${m.state}-${m.district === 0 ? 'AL' : m.district}`,
    photo: m.photo, dim1: m.stats?.dim1, dim2: m.stats?.dim2, unity: m.stats?.partyUnityPct,
  };
}

const lastName = (n: string) => n.replace(/\s*\(.*\)$/, '').split(/\s+/).slice(-1)[0];
export const AU_MEMBERS: DirMember[] = [
  ...FEDERAL.seats.filter((s) => s.chamber === 'federal' && s.member && !s.vacant).map((s): DirMember => ({
    key: `au-h-${s.id}`, country: 'AU', name: s.member, last: lastName(s.member), chamber: 'house', party: s.party,
    partyLabel: AU_PARTIES[s.party]?.name ?? s.party, color: auPartyColor(s.party), state: s.state, seat: s.name, margin: s.margin, note: s.note,
  })),
  ...SENATORS.map((s): DirMember => ({
    key: `au-s-${slugify(s.name)}`, country: 'AU', name: s.name, last: lastName(s.name), chamber: 'senate', party: s.party,
    partyLabel: AU_PARTIES[s.party]?.name ?? s.party, color: auPartyColor(s.party), state: s.state, seat: `${s.state} · Senate`, note: s.note,
  })),
];
export const auSeatFor = (key: string) => FEDERAL.seats.find((s) => `au-h-${s.id}` === key);

/* ---------------------------------------- fetch ---------------------------------------- */
const mem = new Map<string, unknown>();
export function useJson<T>(url: string | null) {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>(() => ({ data: url ? (mem.get(url) as T | undefined) : undefined, loading: !!url && !mem.has(url) }));
  useEffect(() => {
    if (!url) return;
    let live = true;
    if (mem.has(url)) { setState({ data: mem.get(url) as T, loading: false }); return; }
    setState({ loading: true });
    fetch(url, { signal: AbortSignal.timeout(30000) })
      .then(async (r) => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`); return j as T; })
      .then((d) => { mem.set(url, d); if (live) setState({ data: d, loading: false }); })
      .catch((e) => live && setState({ error: String(e?.message || e), loading: false }));
    return () => { live = false; };
  }, [url]);
  return state;
}
export interface UsListResp { members: UsMember[]; voteview: { latest: { House: string; Senate: string } } | null; notes: string[]; sources: Source[]; at: number }
export interface UsMemberResp { member: UsMemberFull; voteview: { latest: { House: string; Senate: string } } | null; sources: Source[] }
