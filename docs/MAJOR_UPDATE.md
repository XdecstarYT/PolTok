# Major update — 8-agent team contract (2026-11-04, morning after the US midterms)
Read docs/ARCHITECTURE.md first. Stack: Vite+React18+TS strict, plain CSS + tokens (src/styles/tokens.css, also must look right under the Broadcast theme: [data-ui='broadcast'] in src/styles/broadcast.css), components in src/components, live data useLive() (src/lib/live.tsx), NYT/AP live provider shared/nyt.js (base https://static01.nyt.com/elections-assets/pages/data/2026-11-03/, CORS open), time helpers fmtTime/tzAbbr (follow user Settings), USMap in src/features/map/USMap.tsx, AUMap in src/features/au/map/AUMap.tsx.

## Ownership (strict — edit only your paths)
1 CANDIDATES  src/features/candidates/**      /candidate/:id (+ /candidates index)
2 HOUSE       src/features/house/**           /house — all 435 districts live
3 PWA         public/manifest.webmanifest, public/sw.js, public/icons/**, src/lib/pwa.ts, index.html <head> tags
4 HOME        src/features/home/**            post-election front page redesign
5 AUSTRALIA   src/features/au/** (not map/), src/data/au.ts, server/au.js
6 SEARCH      src/features/search/**, src/app/shell/CommandPalette.tsx
7 SHARE       src/features/embed/**, src/lib/share.ts  — share cards (PNG) + /embed/* iframe widgets
8 GOVERNORS   src/features/governors/**       /governors + state government dashboard

## Shared files (ADDITIVE ONE-LINE edits only; re-read immediately before editing; never reformat)
- src/app/App.tsx: add your lazy import + <Route>.
- src/app/Shell.tsx: add a NAV_MORE entry ({to,label,sub}) — do NOT touch NAV (top bar is full).
- Other agents' pages: do not edit. If you need a hook-in point elsewhere, export a component and note it in docs/REQUESTS.md for the lead.
## Rules
Real data only, never fabricate (label anything uncertain). Responsive 375→1440, no horizontal scroll, accessible. `npx tsc -b --noEmit` must pass.
Test server: `npm run build && NODE_ENV=production PORT=<your port> node server/index.js &`; stop with: for p in $(pgrep -f "PORT=<port>|^node server/index.js"); do ...; done — prefer killing only the PID you started ($!). Ports: agent N uses 880N.
No git commits (the lead commits). Final message <150 words.

## Added mid-update
9  PARLIAMENT  src/features/parliament/**, server/parliament.js, netlify/functions/parliament*.mjs  — /parliament bill tracker (US Congress + Australian Parliament)
10 NETLIFY+AI  netlify.toml, netlify/** (except parliament*), src/features/ask/**, src/lib/ai.ts, src/lib/api.ts  — Netlify deployment + GROQ AI
Hosting: the site is deployed on NETLIFY (static dist/ + Netlify Functions). The Node server/ does not run there. Env var GROQ (Groq API key) is set in Netlify — server-side only, never shipped to the browser.
