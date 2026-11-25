export declare const FLOWS: Record<string, Record<string, number>>;
export declare function createModel(prim: unknown, cands: unknown): {
  runModel: (now: Record<string, number>, o?: { sims?: number; seed?: number }) => unknown;
  NOTABLE_IND: Record<string, { n: string; pct: number }>;
};
