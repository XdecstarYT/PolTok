/**
 * AU-UI adapter over src/data/au.ts (AU-DATA). Normalises loosely-specified fields
 * (leaders, compositions, polls, other elections) so pages render defensively.
 */
import { AU_PARTIES, AU_POLLS, FEDERAL, OTHER_AU_ELECTIONS, VICTORIA } from '../../data/au';
import type { AuSeat } from '../../data/au';

export type { AuSeat };
export { AU_PARTIES, AU_POLLS, FEDERAL, VICTORIA, OTHER_AU_ELECTIONS };

const FALLBACK: Record<string, { name: string; short: string; color: string }> = {
  ALP: { name: 'Labor', short: 'ALP', color: '#e53940' },
  LIB: { name: 'Liberal', short: 'LIB', color: '#1c4f9c' },
  NAT: { name: 'Nationals', short: 'NAT', color: '#2c7d3f' },
  LNP: { name: 'Liberal National', short: 'LNP', color: '#2a62b8' },
  GRN: { name: 'Greens', short: 'GRN', color: '#10a35a' },
  ONP: { name: 'One Nation', short: 'ONP', color: '#f36c21' },
  IND: { name: 'Independent', short: 'IND', color: '#2bb3a8' },
  CSA: { name: 'Community Strong', short: 'CSA', color: '#36c5b8' },
  KAP: { name: "Katter's Australian", short: 'KAP', color: '#8b1e2d' },
  CA: { name: 'Centre Alliance', short: 'CA', color: '#ff8a1e' },
  OTH: { name: 'Other', short: 'OTH', color: '#8b93a7' },
};

/** Normalise party codes from data ("GRN (vacant)", "L/NP", "Coalition(LIB+NAT)"). */
export function partyKey(p: string | undefined | null): string {
  if (!p) return 'OTH';
  const s = String(p).toUpperCase();
  if (s.startsWith('COALITION') || s === 'L/NP' || s === 'LNP/LIB') return s === 'L/NP' ? 'LNP' : 'LIB';
  const m = s.match(/[A-Z]+/);
  return m ? m[0] : 'OTH';
}
export function party(p: string | undefined | null) {
  const k = partyKey(p);
  const d = (AU_PARTIES as Record<string, { name: string; short: string; color: string } | undefined>)[k] ?? FALLBACK[k];
  return d ?? { name: String(p ?? 'Other'), short: k, color: FALLBACK.OTH.color };
}
export const pColor = (p: string | undefined | null) => party(p).color;
export const isCoalition = (p: string) => ['LIB', 'NAT', 'LNP', 'CLP'].includes(partyKey(p));

/** Leader fields may be strings or objects ({name, party, seat}). */
export function leader(x: unknown): { name: string; party?: string; seat?: string; since?: string } {
  if (!x) return { name: '—' };
  if (typeof x === 'string') return { name: x };
  const o = x as Record<string, unknown>;
  const s = (k: string) => (typeof o[k] === 'string' ? (o[k] as string) : undefined);
  return { name: s('name') ?? s('member') ?? '—', party: s('party'), seat: s('seat') ?? s('division') ?? s('district'), since: s('since') };
}

/** Composition objects may include metadata keys; keep numeric party counts only. */
export function counts(x: unknown): [string, number][] {
  if (!x || typeof x !== 'object') return [];
  const out: [string, number][] = [];
  for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
    if (typeof v !== 'number' || /total|majority|seats/i.test(k)) continue;
    out.push([k, v]);
  }
  return out;
}

/** Seat order for hemicycles/legends: left (Labor) → crossbench → Coalition right. */
const ORDER = ['ALP', 'GRN', 'VS', 'AJP', 'LCV', 'DLP', 'IND', 'CSA', 'CA', 'JLN', 'AV', 'UAP', 'KAP', 'SFF', 'LDP', 'FF', 'AUC', 'TOP', 'ONP', 'NAT', 'CLP', 'LNP', 'LIB', 'COALITION', 'VACANT', 'OTH'];
export const orderIdx = (k: string) => {
  const i = ORDER.indexOf(partyKey(k));
  return i < 0 ? ORDER.length - 2 : i;
};
export const sortParties = <T extends [string, number]>(rows: T[]) => [...rows].sort((a, b) => orderIdx(a[0]) - orderIdx(b[0]));

export const ALL_SEATS: AuSeat[] = [...(FEDERAL.seats ?? []), ...(VICTORIA.seats ?? [])];
export const seatById = new Map(ALL_SEATS.map((s) => [s.id, s]));

export const VIC_CLOSE = Date.parse((VICTORIA as { pollsCloseUtc?: string }).pollsCloseUtc || '2026-11-28T07:00:00Z');
export const VIC_MAJORITY = 45;
export const VIC_TOTAL = 88;

export function stateName(s: string) {
  return ({ NSW: 'New South Wales', VIC: 'Victoria', QLD: 'Queensland', WA: 'Western Australia', SA: 'South Australia', TAS: 'Tasmania', ACT: 'ACT', NT: 'Northern Territory' } as Record<string, string>)[s] ?? s;
}

/** Normalised poll row */
export interface PollRow {
  pollster: string;
  date: string;
  ts: number;
  primary: Record<string, number>;
  tpp: { ALP?: number; LNP?: number; label?: string };
}
export function normPolls(list: unknown): PollRow[] {
  if (!Array.isArray(list)) return [];
  const rows: PollRow[] = [];
  for (const raw of list) {
    const o = raw as Record<string, unknown>;
    const date = String(o.date ?? o.published ?? o.field ?? '').slice(0, 10);
    const ts = Date.parse(date);
    const primary: Record<string, number> = {};
    const pr = (o.primary && typeof o.primary === 'object' ? o.primary : o) as Record<string, unknown>;
    for (const k of ['ALP', 'LNP', 'GRN', 'ONP', 'OTH']) if (typeof pr[k] === 'number') primary[k] = pr[k] as number;
    const tpp: PollRow['tpp'] = {};
    const t = o.tpp as Record<string, unknown> | null | undefined;
    if (t && typeof t === 'object') {
      if (typeof t.ALP === 'number') tpp.ALP = t.ALP as number;
      if (typeof t.LNP === 'number') tpp.LNP = t.LNP as number;
      const s = typeof t.ALP_v_LNP === 'string' ? (t.ALP_v_LNP as string) : undefined;
      const m = s?.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)/);
      if (m && tpp.ALP == null) {
        tpp.ALP = +m[1];
        tpp.LNP = +m[2];
      }
      if (typeof t.ALP_v_ONP === 'string') tpp.label = `ALP v ONP ${t.ALP_v_ONP}`;
    }
    const vo = o.tppVsOnp as { ALP?: number; ONP?: number } | undefined;
    if (vo && typeof vo.ALP === 'number') tpp.label = `ALP v ONP ${vo.ALP}–${vo.ONP}`;
    if (Number.isFinite(ts)) rows.push({ pollster: String(o.pollster ?? '—'), date, ts, primary, tpp });
  }
  return rows.sort((a, b) => b.ts - a.ts);
}

export interface OtherElection {
  name: string;
  date: string;
  status: string;
  note?: string;
}
export const OTHER: OtherElection[] = (Array.isArray(OTHER_AU_ELECTIONS) ? (OTHER_AU_ELECTIONS as unknown[]) : []).map((r) => {
  const o = r as Record<string, unknown>;
  return {
    name: String(o.name ?? o.title ?? 'Election'),
    date: String(o.date ?? ''),
    status: String(o.status ?? ''),
    note: typeof o.result === 'string' ? o.result : typeof o.note === 'string' ? o.note : undefined,
  };
});

export function fmtMargin(m: number | null | undefined) {
  return m == null || !Number.isFinite(m) ? 'TBD' : `${m.toFixed(1)}`;
}
