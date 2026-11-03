# PolTok — Architecture & Team Contract

Immersive, real-time politics app: election-night command center, electoral maps, live race calls,
aggregated news with bias labels, a TikTok-style vertical "PolTok" feed, polls, forecasts & markets.

## Stack
- **Client**: Vite 5 + React 18 + TypeScript (strict), react-router-dom 6, d3-geo/d3-scale/d3-shape,
  topojson-client + us-atlas (states-10m.json), framer-motion. Plain CSS (CSS modules or per-feature
  `.css` files imported by the component) using tokens in `src/styles/tokens.css`. **No Tailwind, no
  other UI libs.** Ask before adding dependencies; prefer none.
- **Server**: `server/index.js`, plain Node 22 ESM (`node:http`, global `fetch`), dependency
  `fast-xml-parser` for RSS. Port **8787**. Vite dev proxies `/api` → 8787. In production the same
  server serves `dist/`.
- **Shared**: `shared/` plain ESM JS, imported by both server and client (seed data + simulation).

## Run
```
npm install
npm run dev        # api on :8787 + vite on :5173
npm run build && npm start   # production on :8787
```

## API contract (server agent implements)
| Endpoint | Returns |
|---|---|
| `GET /api/health` | `{ ok, mode, uptime }` |
| `GET /api/stream` | SSE; each `data:` is a `LiveEvent` (src/types.ts). First event `hello`, then full `results`, `balance`, `markets`, recent `news`; then incremental updates. Heartbeat comment every 15s. |
| `GET /api/news?limit=&tag=&lean=` | `{ items: NewsItem[], fetchedAt, sources: {name, lean, ok}[] }` — real RSS aggregation, cached ~2 min. |
| `GET /api/snapshot` | `{ mode, results, balance, markets }` |
| `GET /api/polls` | `PollSeries[]` |

If the API is unreachable, `src/lib/live.tsx` runs `shared/sim.js` in the browser (results/markets),
and uses `FALLBACK_NEWS` from `shared/data` for news.

## Honesty rule
Results/race calls are **simulated** (no free real-time AP feed). Every surface that shows live
results must show the `<SimBadge/>` (from `src/components`) or equivalent label. News headlines are
real (RSS). Seed facts (candidates, ratings, 2024 results) come from `docs/research/` — never invent
candidate names; use "TBD" if unknown.

## Ownership (one owner per path — do NOT edit files you don't own)
| Agent | Owns |
|---|---|
| 1 Research (news) | `docs/research/news-sites.md` |
| 2 Research (elections) | `docs/research/election-sites.md`, `midterms-2026*.{md,json}` |
| 3 Design system & shell | `src/styles/**`, `src/components/**`, `src/app/Shell.tsx` (+ `src/app/shell/**`), `src/features/home/**`, `public/**`, `index.html` |
| 4 Server & simulation | `server/**`, `shared/sim.js` |
| 5 Data | `shared/data/**`, `src/data/**` |
| 6 Maps | `src/features/map/**` |
| 7 Live election night | `src/features/live/**` |
| 8 News + PolTok feed | `src/features/news/**`, `src/features/feed/**` |
| 9 Polls, forecast, markets | `src/features/polls/**` |
| 10 Races & states | `src/features/races/**` |
| Lead (orchestrator) | `src/types.ts`, `src/lib/**`, `src/app/App.tsx`, `src/main.tsx`, config, `package.json`, docs |

Need something from another owner (a new type field, a component prop, data)? Add **optional** fields
only, and write a note in `docs/REQUESTS.md` (append-only) describing it; the lead integrates.

## Shared building blocks (import, don't duplicate)
- Types: `src/types.ts`
- Data: `src/data` → `STATES, RACES, POLL_SERIES, SENATE_NOT_UP, HOUSE_TOTAL, stateByAbbr, stateByFips, raceById, racesByState`
- Live: `src/lib/live.tsx` → `useLive(), useRaceResult(id), useChamberResults(chamber)`
- Format/colors: `src/lib/format.ts` → `PARTY_HEX, PARTY_COLOR, RATING_HEX, LEAN_HEX, RATINGS, marginColor, fmtInt, fmtPct, timeAgo, initials`
- UI: `src/components` → `Card, PartyDot, RatingBadge, Avatar, LiveDot, SimBadge` (+ more added by agent 3)
- Map: `src/features/map/USMap.tsx` → `<USMap fills variant onStateClick renderTooltip highlight labels focus />`

## Routes
`/` home · `/live` election night · `/map/:mode?` (pres2024 | senate | governor | house | live | build) ·
`/feed` PolTok vertical feed · `/news` · `/polls` · `/forecast` · `/races` · `/race/:id` · `/state/:abbr`

Race ids: `PA-SEN`, `OH-SEN-S` (special), `PA-GOV`, `PA-07` (house, zero-padded; at-large `AK-AL`).
Candidate ids: `${raceId}-${party}` lowercase e.g. `pa-sen-d`, extra same-party → `-d2`.

## Quality bar
- `npx tsc -b --noEmit` passes. No console errors.
- Responsive: works at 375px wide (16px gutters, no horizontal scroll) through 1440px+.
- Dark, cinematic "election night command center" look; smooth motion (respect `prefers-reduced-motion`).
- Accessible: semantic elements, focus states, aria labels on map regions, color is never the only signal.
