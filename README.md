# PolTok — Election Night Command Center

An immersive, real-time politics app for the **2026 U.S. midterms**: live election-night control room,
interactive electoral maps, a TikTok-style vertical "PolTok" feed, a bias-aware newsroom aggregating
~40 real outlets, polling averages, a Monte Carlo forecast lab, and race/state hubs.

Built by a 10-agent team (2 research, 8 build) — see `docs/research/` for the site teardowns
(NYT Needle, AP, DDHQ, CNN Magic Wall, 270toWin, Ground News, AllSides, Axios, Politico, Semafor…)
that informed the design, and `docs/ARCHITECTURE.md` for the team contract.

## Quick start
```bash
npm install
npm run dev                 # API on :8787 + Vite on :5173 → open http://localhost:5173
# or production:
npm run build && npm start  # everything on http://localhost:8787
```
Useful env: `SIM_SPEED=12` (faster election night), `SIM_SEED`, `SIM_LOOP=1`, `PORT`.

## What's real vs. simulated
| | Source |
|---|---|
| **News headlines** | **Real** — server-side RSS aggregation (NPR, Politico, Fox, NYT, BBC, The Hill, Guardian, Google News `site:` queries for AP/Reuters/Axios/WaPo…), refreshed every 2 min, lean labels per AllSides-style ratings, clustered into stories. |
| **Candidates, ratings, 2024 results, poll-closing times** | Researched seed data in `shared/data/` (sources in `docs/research/midterms-2026-data.md`). Some House challengers come from a single source — verify before relying on them. |
| **Polls** | 758 real published polls (Sep 1 – Nov 2, 2026) in `shared/data/polls.js`. |
| **Vote counts, race calls, needles, market odds** | **Simulated** (labelled `SIMULATED` everywhere). There is no free real-time results feed. A seeded engine (`shared/sim.js`) plays out the night 6 PM → 2 AM ET in ~25 min with realistic count curves, red-mirage/blue-shift ordering and correlated uncertainty. |

### Going live with real results
Set `RESULTS_MODE=live` and `RESULTS_FEED_URL` to an endpoint returning `{ results, balance?, markets? }`
in the shapes from `src/types.ts`. `server/results-provider.js` documents mapping an AP / Decision
Desk HQ feed into that shape.

## Pages
| Route | |
|---|---|
| `/` | Home dashboard — countdown to next poll close, control needles, key races, calls, news |
| `/live` | Election-night control room — needles, balance of power, race grid, call feed, timeline, live map |
| `/map/:mode` | Maps: 2024 president, Senate, Governor, House, Live, Build-your-own (geo ↔ hex morph) |
| `/feed` | **PolTok** — full-screen vertical swipe feed of news, race calls, polls, odds |
| `/news` | Newsroom — story clusters, left/center/right coverage bars, blindspots, headline wall |
| `/polls` | Polling averages (generic ballot, approval, race polls) + full poll table |
| `/forecast` | In-browser Monte Carlo forecast lab, build-your-Senate, markets |
| `/races`, `/race/:id`, `/state/:abbr` | Ratings board, race hubs, state hubs |

Keyboard: `⌘K`/`Ctrl+K` or `/` opens search; `↑/↓` or `j/k` navigate the PolTok feed.

## Stack
Vite + React 18 + TypeScript, d3-geo / topojson (us-atlas), framer-motion, plain CSS design tokens.
Node 22 `http` server with SSE streaming (`/api/stream`), RSS via `fast-xml-parser`. If the API is
unreachable, the browser runs the same simulation locally so the app stays alive on static hosting.
