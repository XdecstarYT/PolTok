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

## From Agent 10 (Races & States) — 2026-11-03
- **[→ Maps agent, optional]** `USMap`: a `zoomTo?: string` (or `fitTo?: string[]`) prop that crops the viewBox to a state's bbox would let `/race/:id` and `/state/:abbr` show a true state close-up; today they use `focus`+`highlight`+`selected` on the full national map.
- **[→ Lead, optional]** `src/data`: a `neighbors` adjacency map (state abbr → bordering abbrs) would replace the hex-grid "Nearby" approximation on `/state/:abbr`.
- **[→ Data, FYI]** Races pages read `SENATE_NOT_UP`, `HOUSE_BASELINE`, `POLL_SERIES` (id === race id) and treat I candidates as caucusing with D for flip detection; `StateInfo.pollClose` ≥ 24h is rendered as "… ET (Nov 4)".

## From Agent 3 (PWA) — 2026-11-04
- **[→ Lead]** Mount the update banner: in `src/app/App.tsx` add `import { UpdatePrompt } from '../lib/pwa';` and render `<UpdatePrompt />` once inside the root (e.g. next to `<Shell>`/routes, inside ToastProvider is fine). Importing `src/lib/pwa` also registers `/sw.js` (production builds only), so the import is required for the PWA to work. Alternatively `import '../lib/pwa'` in `src/main.tsx`.
- SW never intercepts `/api/stream` or `text/event-stream`. `/api/*` + NYT JSON are network-first with a 10-min offline fallback. Bump `VERSION` in `public/sw.js` to force cache purge. Icons regenerate via `NODE_PATH=$(npm root -g) node public/icons/generate.mjs`.

## From Agent 10 (Netlify + AI) — 2026-11-04
- **[→ Lead] Mount Ask PolTok:** in `src/app/Shell.tsx` (or App.tsx inside `<Shell>`) add `import { AskPolTok } from '../features/ask';` and render `<AskPolTok />` once (floating button + slide-over; hides itself on `/embed/*` and `/ask`).
- **[→ Lead] Route:** `const AskPage = lazy(() => import('../features/ask/AskPage'));` + `<Route path="/ask" element={<AskPage />} />`; optional NAV_MORE `{ to: '/ask', label: 'Ask PolTok', sub: 'AI answers from live data' }`.
- **[→ Lead / Races owner] Race summary:** on `/race/:id` render `<AiRaceSummary raceId={id} />` (from `src/features/ask`) below the results card. Renders nothing when AI is not configured.
- `src/lib/live.tsx`: now probes `/api/health` first; `stream:false` (Netlify) or no answer → in-browser provider immediately (no 3.5s SSE wait); Node server health reports `stream:true`. Clock polling skips while in browser mode.
- Netlify: `netlify.toml` + `netlify/functions/*.mjs` (health, stream→404, news, au, snapshot?source=live, polls, ai). Env: `GROQ` (or `GROQ_API_KEY`), optional `GROQ_MODEL`, `AI_MAX_TOKENS`, `AI_RATE_PER_MIN`. Node server: `POST /api/ai` via `server/ai.js`.

## From Agent 7 (SHARE) — 2026-11-04
- **[→ Lead] Mount share cards:** `import { ShareCardButton } from '../../lib/share';` (or `../embed/ShareCardButton`).
  - `/race/:id` (src/features/races/RacePage.tsx, header actions): `<ShareCardButton kind="race" id={race.id} />`
  - Home (src/features/home, next to the balance-of-power module): `<ShareCardButton kind="balance" id="senate" />` and `id="house"`
  - `/au/seat/:id` (src/features/au/SeatPage.tsx): `<ShareCardButton kind="au-seat" id={seat.id} />`
  - Optional props: `label`, `className` (defaults to `btn btn--sm`).
- **Embeds:** `/embed/race/:id`, `/embed/balance?chamber=house`, `/embed/map?chamber=governor` (all accept `theme=light`) render OUTSIDE the Shell via a `pathname.startsWith('/embed/')` check in App.tsx; builder at `/embed` (in Shell, NAV_MORE "Embed"). Server sends no X-Frame-Options/CSP frame-ancestors — keep it that way for `/embed/*` if headers are added later.

## From Agent 9 (Parliament) — 2026-11-04
- **[→ Agent 10 / netlify.toml]** `netlify/functions/parliament.mjs` declares `export const config = { path: ['/api/parliament', '/api/parliament/*'] }`, so no redirect is strictly needed. If netlify.toml routes `/api/*` elsewhere, add BEFORE it: `[[redirects]] from = "/api/parliament/*" to = "/.netlify/functions/parliament/:splat" status = 200`. The function imports `../../server/parliament.js` (needs `fast-xml-parser`, already a dependency) — ensure `[functions] node_bundler = "esbuild"` (default) bundles it.
- **Env (optional, server-side only):** `CONGRESS_API_KEY` (free api.data.gov key; DEMO_KEY is 10 req/h shared so unused) and `TVFY_API_KEY` (theyvoteforyou.org.au — enables Australian divisions with party breakdown; without it the UI shows a "connect a data key" card). US bills/votes work keyless (GovInfo BILLSTATUS + clerk.house.gov). aph.gov.au/ParlInfo is behind a bot WAF; AU falls back to Acts with Royal Assent from legislation.gov.au.
- server/index.js: one additive line mounting `/api/parliament*`.
