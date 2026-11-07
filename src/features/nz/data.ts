/** NZ 2026 election: party metadata, MMP seat allocation, live-results hooks. */
import { useEffect, useState } from 'react';
import { NZ_ELECTORATES, NZ_POLLS, type NzPoll } from './generated';
export { NZ_ELECTORATES, NZ_POLLS };

export const POLLS_CLOSE = Date.parse('2026-11-07T06:00:00Z'); // 7:00pm NZDT Sat 7 Nov
export const NZ_TZ = 'Pacific/Auckland';
export const EC_RESULTS_URL = 'https://www.electionresults.govt.nz/electionresults_2026/';

export interface PartyMeta { code: string; name: string; short: string; color: string; leader: string; bloc: 'right' | 'left' | 'other' }
// Party colours are fixed brand hues (readable on dark & light themes).
export const PARTIES: PartyMeta[] = [
  { code: 'NAT', name: 'National', short: 'NAT', color: '#1f5fbf', leader: 'Christopher Luxon (PM)', bloc: 'right' },
  { code: 'LAB', name: 'Labour', short: 'LAB', color: '#d82a20', leader: 'Chris Hipkins (Opposition leader)', bloc: 'left' },
  { code: 'GRN', name: 'Green', short: 'GRN', color: '#2e9e44', leader: 'Marama Davidson & Chlöe Swarbrick', bloc: 'left' },
  { code: 'ACT', name: 'ACT', short: 'ACT', color: '#e8b400', leader: 'David Seymour', bloc: 'right' },
  { code: 'NZF', name: 'NZ First', short: 'NZF', color: '#6b6b6b', leader: 'Winston Peters', bloc: 'right' },
  { code: 'TPM', name: 'Te Pāti Māori', short: 'TPM', color: '#a2463c', leader: 'Debbie Ngarewa-Packer & Rawiri Waititi', bloc: 'left' },
  { code: 'OPP', name: 'Opportunity', short: 'OPP', color: '#1fb5a3', leader: 'Qiulae Wong', bloc: 'other' },
  { code: 'IND', name: 'Independent', short: 'IND', color: '#9a8fb5', leader: '—', bloc: 'other' },
];
export const partyMeta = (c: string): PartyMeta => PARTIES.find((p) => p.code === c) || { code: c, name: c, short: c.slice(0, 4).toUpperCase(), color: '#8a8f98', leader: '—', bloc: 'other' };

/** Parliament at dissolution (Wikipedia, Oct 2026): 123 seats incl. overhang; 2 independents. */
export const CURRENT_PARLIAMENT: Record<string, number> = { NAT: 49, LAB: 34, GRN: 15, ACT: 11, NZF: 8, TPM: 4, IND: 2 };
/** 2023 official party vote % (Electoral Commission). */
export const RESULT_2023: Record<string, number> = { NAT: 38.08, LAB: 26.91, GRN: 11.6, ACT: 8.64, NZF: 6.08, TPM: 3.08, OPP: 2.22 };

/* --------------------------------------------- MMP --------------------------------------------- */
export interface Alloc { party: string; votesPct: number; electorate: number; list: number; total: number; eligible: boolean }
/**
 * NZ MMP (Electoral Act 1993 s191): parties with ≥5% party vote or ≥1 electorate seat share 120 seats by
 * Sainte-Laguë (divisors 1,3,5…). Seats won by independents / ineligible parties come off the 120 first.
 * A party keeps any electorate seats beyond its entitlement (overhang), enlarging the House.
 */
export function allocateMMP(votes: Record<string, number>, electorates: Record<string, number>, seats = 120): { rows: Alloc[]; total: number; majority: number; overhang: number } {
  const totalV = Object.values(votes).reduce((a, b) => a + b, 0) || 1;
  const parties = new Set([...Object.keys(votes), ...Object.keys(electorates)]);
  const eligible = [...parties].filter((p) => p !== 'IND' && ((votes[p] || 0) / totalV >= 0.05 || (electorates[p] || 0) > 0));
  const outside = [...parties].filter((p) => !eligible.includes(p)).reduce((a, p) => a + (electorates[p] || 0), 0);
  const pool = seats - outside;
  const ent: Record<string, number> = Object.fromEntries(eligible.map((p) => [p, 0]));
  const quot: { p: string; q: number }[] = [];
  for (const p of eligible) for (let d = 0; d < pool; d++) quot.push({ p, q: (votes[p] || 0) / (2 * d + 1) });
  quot.sort((a, b) => b.q - a.q || (votes[b.p] || 0) - (votes[a.p] || 0));
  for (const x of quot.slice(0, pool)) if (x.q > 0) ent[x.p]++;
  const rows: Alloc[] = [...parties].map((p) => {
    const e = electorates[p] || 0;
    const ok = eligible.includes(p);
    const total = ok ? Math.max(ent[p], e) : e;
    return { party: p, votesPct: ((votes[p] || 0) / totalV) * 100, electorate: e, list: total - e, total, eligible: ok };
  });
  rows.sort((a, b) => b.total - a.total || b.votesPct - a.votesPct);
  const total = rows.reduce((a, r) => a + r.total, 0);
  return { rows, total, majority: Math.floor(total / 2) + 1, overhang: total - seats };
}

/** Simple average of each pollster's latest poll within 21 days of the newest poll. */
export function pollAverage(polls: NzPoll[] = NZ_POLLS) {
  const newest = Date.parse(polls[0]?.date || '2026-11-01');
  const latest = new Map<string, NzPoll>();
  for (const p of polls) {
    const k = p.pollster.replace(/[–-].*$/, '').trim();
    if (Date.parse(p.date) >= newest - 21 * 864e5 && !latest.has(k)) latest.set(k, p);
  }
  const keys = ['NAT', 'LAB', 'GRN', 'ACT', 'NZF', 'TPM', 'OPP'] as const;
  const list = [...latest.values()];
  const avg = Object.fromEntries(keys.map((k) => [k, list.reduce((a, p) => a + p[k], 0) / (list.length || 1)])) as Record<string, number>;
  return { avg, polls: list };
}

/** Electorate-seat baseline for projections before results: party of each sitting MP re-standing (independent seats excluded). */
export function incumbentElectorates(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of NZ_ELECTORATES) {
    const inc = e.candidates.find((c) => c.inc);
    const p = inc?.party || e.r2023?.party;
    if (p) out[p] = (out[p] || 0) + 1;
  }
  return out;
}

/* --------------------------------------------- live data --------------------------------------------- */
export interface LiveParty { party: string; name?: string; votes: number; pct: number; electorateSeats: number; listSeats: number; totalSeats: number }
export interface LiveElectorate { id: string; name: string; type: 'general' | 'maori'; leader: string | null; leadingParty: string | null; second?: string | null; secondParty?: string | null; margin: number; countedPct: number | null; candidates: { name: string; party: string; votes: number }[] }
export interface NzResults { status: 'pre' | 'counting' | 'final'; updatedAt: number; votesCountedPct: number | null; party: LiveParty[]; electorates: LiveElectorate[]; source: string; error?: string; heading?: string; sourceKind?: 'ec' | 'wikipedia' | 'none'; sourceLabel?: string }
export interface NzDetail { status: string; updatedAt: number; source: string; error?: string; electorate: null | { name: string; countedPct: number | null; votesCounted: number | null; leader: string | null; leadingParty: string | null; margin: number | null; candidates: { name: string; party: string; partyName: string; votes: number }[]; partyVotes: { party: string; name: string; votes: number }[] } }

const NZ_POLLS_CLOSE_ISO = '2026-11-07T06:00:00Z';
/** Set once the direct Electoral Commission fetch is refused (CORS), so we stop retrying it every poll. */
let directBlocked = false;

export function useNzResults(intervalMs = 60_000) {
  const [data, setData] = useState<NzResults | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    // If our server is blocked by the Electoral Commission's CDN after polls close, try the
    // official pages straight from the visitor's browser (works only if their site allows it).
    const direct = async (d: NzResults): Promise<NzResults> => {
      if (directBlocked || (d.status !== 'pre' && d.sourceKind !== 'wikipedia') || !/403/.test(d.error || '') || Date.now() < Date.parse(NZ_POLLS_CLOSE_ISO)) return d;
      try {
        const base = d.sourceKind === 'wikipedia' || !d.source ? 'https://www.electionresults.govt.nz/electionresults_2026/' : d.source;
        const get = (u: string) => fetch(u, { mode: 'cors', signal: AbortSignal.timeout(8000) }).then((r) => (r.ok ? r.text() : Promise.reject()));
        const [idx, sts] = await Promise.all([get(base + 'index.html'), get(base + 'electorate-status.html').catch(() => '')]);
        const { combineNzResults } = await import('../../../shared/nz-parse.js');
        const r = combineNzResults(idx, sts, base, NZ_POLLS_CLOSE_ISO) as NzResults | null;
        return r ? { ...r, sourceKind: 'ec' as const, error: undefined, heading: `${r.heading ?? ''} (loaded directly from the Electoral Commission)` } : d;
      } catch {
        directBlocked = true;
        return d; // CORS or network refusal — keep the honest 'pre' state with the official link
      }
    };
    const load = () =>
      fetch('/api/nz/results')
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((d: NzResults) => direct(d))
        .then((d: NzResults) => alive && (setData(d), setErr(null)))
        .catch((e: Error) => alive && setErr(e.message));
    load();
    const id = setInterval(load, intervalMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [intervalMs]);
  return { data, err };
}

export function useNzDetail(id: string) {
  const [d, setD] = useState<NzDetail | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => fetch(`/api/nz/electorate?id=${encodeURIComponent(id)}`).then((r) => r.json()).then((x: NzDetail) => alive && setD(x)).catch(() => {});
    load();
    const t = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [id]);
  return d;
}

export interface NzNewsItem { id: string; title: string; url: string; source: string; publishedAt: number; summary?: string }
export function useNzNews() {
  const [items, setItems] = useState<NzNewsItem[] | null>(null);
  useEffect(() => {
    fetch('/api/nz/news?limit=30').then((r) => r.json()).then((d: { items: NzNewsItem[] }) => setItems(d.items || [])).catch(() => setItems([]));
  }, []);
  return items;
}

export interface PmOutcome { label: string; p: number }
export interface PmMarket { slug: string; title: string; outcomes: PmOutcome[]; volume: number }
export const PM_SLUGS = ['next-prime-minister-of-new-zealand-174', 'which-coalition-will-form-the-next-new-zealand-government', 'new-zealand-legislative-election-winner'];
export function usePolymarket() {
  const [m, setM] = useState<PmMarket[] | null>(null);
  useEffect(() => {
    Promise.all(
      PM_SLUGS.map((slug) =>
        fetch(`https://gamma-api.polymarket.com/events?slug=${slug}`)
          .then((r) => r.json())
          .then((arr: { title: string; volume?: number; markets: { groupItemTitle?: string; question: string; outcomePrices?: string; active?: boolean; closed?: boolean }[] }[]) => {
            const ev = arr[0];
            if (!ev) return null;
            const outcomes = ev.markets
              .filter((x) => x.active && !x.closed)
              .map((x) => ({ label: x.groupItemTitle || x.question, p: Number(JSON.parse(x.outcomePrices || '[0]')[0]) || 0 }))
              .filter((o) => o.p >= 0.01)
              .sort((a, b) => b.p - a.p)
              .slice(0, 6);
            return { slug, title: ev.title, outcomes, volume: ev.volume || 0 };
          })
          .catch(() => null),
      ),
    ).then((x) => setM(x.filter(Boolean) as PmMarket[]));
  }, []);
  return m;
}

/** PolTok projection (never official): decisive lead heuristic on counted share & margin. */
export function callOf(e: Pick<LiveElectorate, 'margin' | 'countedPct'>, status: NzResults['status'], nationalPct: number | null): 'official' | 'likely' | 'leading' | null {
  if (status === 'final') return 'official';
  const c = e.countedPct ?? nationalPct ?? 0;
  if (!e.margin) return null;
  if ((c >= 50 && e.margin >= 2500) || (c >= 80 && e.margin >= 1200) || (c >= 25 && e.margin >= 6000)) return 'likely';
  return 'leading';
}
