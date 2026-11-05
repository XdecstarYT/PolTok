# Update 3 — team contract (Nov 2026)
Read docs/ARCHITECTURE.md, docs/MASSIVE_UPDATE.md (conventions: dual server/*.js + netlify/functions/*.mjs, one-line shared edits, 5 themes, real data only, no fabrication, cite sources, licence-check any images/text you reuse).
## Ownership
A FIXES     a11y/perf fixes in: src/features/house/**, src/features/live/**, src/features/news/**, src/features/polls/**, src/features/parliament/** (CSS/markup only for contrast, image width/height, link styling, useSeo lines)
B CARDS     src/lib/cards/**, src/features/owner/CardStudio.tsx (+ new src/features/owner/studio/**)
C OWNER-AI  src/features/owner/** EXCEPT CardStudio.tsx & studio/**, server/ai.js (new modes only, keep existing ones working), shared/compose.js
D AUSTRALIA src/features/au/**, src/data/au.ts (additive), server/au.js, shared/au/**, new src/data/au-*.ts files
E CANDIDATES src/features/candidates/**, server/candidates.js + netlify/functions/candidates.mjs
F NEWS2     src/features/news/** NEW files only + new routes (/story/:id, /topic/:slug), server/news.js (additive exports only)
Shared one-liners only: src/app/App.tsx routes, Shell NAV_MORE, MenuPage tiles, server/index.js routes. Re-read right before editing.
Groq free tier: keep AI prompts small (≤10k chars), reuse server/ai.js retry/auto-model logic.
Test: `npm run build && NODE_ENV=production PORT=<889X> node server/index.js &` then `kill $!` only. Ports: A 8891 … F 8896. tsc must pass. No git commits. Final report <200 words.
