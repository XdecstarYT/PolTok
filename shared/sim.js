// STUB — replaced by Server agent with the real simulation engine.
// Contract (must be preserved):
//   createSimulation({ races, states, speed?, seed?, startAt? }) => {
//     start(): void; stop(): void;
//     snapshot(): { results: RaceResult[]; balance: BalanceOfPower[]; markets: Market[] };
//     subscribe(fn: (ev: LiveEvent) => void): () => void;
//   }
export function createSimulation() {
  const subs = new Set();
  return {
    start() {}, stop() {},
    snapshot() { return { results: [], balance: [], markets: [] }; },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  };
}
