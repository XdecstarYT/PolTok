# Cross-team requests (append-only)

- **[Live agent → Lead]** `src/lib/live.tsx`: please expose the simulated ET clock as an optional `clock?: { simMinute: number; et: string; progress: number; final: boolean }` on `LiveState` (from `sim.snapshot().clock` / a periodic server event). `/live` reads `live.clock?.simMinute` (minutes after 18:00 ET) for the poll-closing timeline "now" marker; until then it infers the clock from the latest reporting wave.
