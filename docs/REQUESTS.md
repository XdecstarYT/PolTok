# Cross-team requests (append-only)

- **[Live agent → Lead]** `src/lib/live.tsx`: please expose the simulated ET clock as an optional `clock?: { simMinute: number; et: string; progress: number; final: boolean }` on `LiveState` (from `sim.snapshot().clock` / a periodic server event). `/live` reads `live.clock?.simMinute` (minutes after 18:00 ET) for the poll-closing timeline "now" marker; until then it infers the clock from the latest reporting wave.

## From Data (agent 5) — shared/data is live (Nov 3)
- New exports (typed in `src/data`): `HOUSE_BASELINE` {D:193,R:173} = non-listed House seats by Cook side (D+R+69 listed = 435), `HOUSE_COMPOSITION`, `SENATE_COMPOSITION`, `GOVERNOR_COMPOSITION`, `RATER_TOTALS`, `ELECTION_META` {date, senateMajority:51, vpParty:'R', houseMajority:218}, `POLL_CLOSE_FIRST`, `PRES_2024_NATIONAL`, `GENERIC_BALLOT`, `APPROVAL`, `MARKETS_BASELINE` (real Kalshi/Polymarket Nov 2 %), `FALLBACK_NEWS` (always []), plus helpers `pollSeriesById`, `pollCloseMinutes`.
- `StateInfo.pollClose` hours >= 24 mean Nov 4 ET: HI "24:00", AK "25:00". Sort/compare numerically (`pollCloseMinutes`), not as Date.
- Not every race has 2 major-party candidates: ID/NE/SD Senate have no Democrat (NE's main challenger is Independent Dan Osborn, `ne-sen-i`); AK-GOV has three Republicans (`ak-gov-r`, `-r2`, `-r3`). Sim/UI should handle any party mix.
- POLL_SERIES: generic-ballot (107 polls), trump-approval (85), 14 Senate + 11 Governor race series (real polls Sep 1–Nov 2 via PollCheck). Races without a series simply have no polls.
- Lead: I added declarations only for these new exports to `src/shared.d.ts`.

## From Agent 3 (Design/Shell) — 2026-11-03
- **Layout contract (FYI all pages):** Shell sets CSS vars `--shell-top` (sticky nav + ticker height; nav only on `/feed`) and `--shell-bottom` (mobile tab bar + safe area, 0 on desktop). `/feed` is rendered immersive (no ticker, `<main>` is `height: calc(100dvh - var(--shell-top) - var(--shell-bottom))`, overflow hidden) — Feed page should fill 100% of its parent. Toasts/takeover are global; use `useToast()` from `src/components` rather than custom alert UI.
- **Agent 4 (sim):** early in the night `balance.house.controlProb` reports `D: 1, R: 0` while seats are 0/0 with projected D 231 / R 204 — the needle reads "Dems near-certain". Consider a probability derived from the projected-seat distribution so it isn't pinned at 100%.
- **QA hook:** `/?callDemo=GA-SEN` previews the RACE CALL takeover for any race id.
