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

## Live vs. Simulated
A **Live / Simulated** toggle in the top bar picks the results source (remembered per browser):

| | **Live** (default) | **Simulated** |
|---|---|---|
| Vote counts, race calls | **Real** AP results via The New York Times' public results JSON (`shared/nyt.js`), polled every 30 s (House every 90–180 s) | Seeded engine (`shared/sim.js`) plays out 6 PM → 2 AM ET in ~25 min |
| Win probabilities / needles | NYT model per race; chamber control computed with correlated error | Simulated |
| Market odds | Last real Kalshi quotes before Election Day | Simulated |
| Candidates | Synced from AP/NYT (names, photos) | Research data |

Everything else is real in both modes:
- **News headlines** — server-side RSS aggregation from ~40 outlets (NPR, Politico, Fox, NYT, BBC, The Hill, Guardian, Google News `site:` queries for AP/Reuters/Axios/WaPo…), refreshed every 2 min, lean labels per AllSides-style ratings, clustered into stories.
- **Polls** — 758 real published polls (Sep 1 – Nov 2, 2026).
- **Ratings, 2024 results, poll-closing times** — researched seed data in `shared/data/` (sources in `docs/research/`).

### No server? Still works
If `/api` is unreachable (static hosting, `vite preview`), the browser fetches live results directly
from the NYT JSON (CORS-enabled) or runs the simulation locally, and pulls real headlines via
CORS-friendly RSS routes (NYT direct + rss2json.com). It keeps checking for the API and switches back
to it automatically when it comes up.

Server env: `DEFAULT_SOURCE=live|simulation`, `SIM_SPEED`, `SIM_SEED`, `SIM_LOOP`, `PORT`.
Custom feed: `RESULTS_MODE=live RESULTS_FEED_URL=…` replaces the NYT provider (see `server/results-provider.js`).

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
