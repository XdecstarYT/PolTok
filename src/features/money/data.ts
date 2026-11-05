import { useEffect, useState } from 'react';

export interface MoneyCand {
  id: string; name: string; party: string; fecId: string | null; fecName?: string;
  receipts: number | null; disbursements: number | null; cash: number | null;
  indiv: number | null; pac: number | null; ieSupport: number | null; ieOppose: number | null; coverageEnd: string | null;
}
export interface MoneyRace {
  raceId: string; chamber: 'senate' | 'house'; state: string; district?: number; title: string; rating: string;
  candidates: MoneyCand[]; total: { receipts: number; disbursements: number; ie: number }; matched: number;
}
export interface PartyCommittee { id: string; short: string; name: string; party: string; receipts: number | null; disbursements: number | null; cash: number | null; coverageEnd: string | null; available: boolean }
export interface LeaderRow { fecId: string; fecName: string; party: string; office: string; state: string; district?: number; receipts: number | null; disbursements: number | null; cash: number | null; ieSupport: number | null; ieOppose: number | null }
export interface MoneySummary {
  cycle: number; source: string; sourceUrl: string; generatedAt: number; coverageThrough: string | null;
  keyType: 'demo' | 'personal'; rateLimited: boolean; partial: boolean; errors: string[]; missing: string[];
  races: MoneyRace[]; parties: PartyCommittee[]; stateTotals: Record<string, number>; leaderboard: LeaderRow[];
}

let memo: Promise<MoneySummary> | null = null;
export function loadMoney(): Promise<MoneySummary> {
  if (!memo)
    memo = fetch('/api/money')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<MoneySummary>;
      })
      .catch((e) => {
        memo = null;
        throw e;
      });
  return memo;
}

export function useMoney() {
  const [data, setData] = useState<MoneySummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let on = true;
    loadMoney().then(
      (d) => on && setData(d),
      (e: unknown) => on && setError(String((e as Error)?.message || e)),
    );
    return () => {
      on = false;
    };
  }, []);
  return { data, error, loading: !data && !error };
}

export const usd = (n: number | null | undefined, digits = 1) => {
  if (n == null) return '—';
  const a = Math.abs(n);
  if (a >= 1e9) return `$${(n / 1e9).toFixed(digits)}B`;
  if (a >= 1e6) return `$${(n / 1e6).toFixed(digits)}M`;
  if (a >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(digits > 1 ? 2 : 0)}`;
};
export const fecUrl = (id: string) => `https://www.fec.gov/data/candidate/${id}/`;
