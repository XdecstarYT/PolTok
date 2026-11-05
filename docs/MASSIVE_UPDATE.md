# Massive update — team contract (Nov 2026)
Read docs/ARCHITECTURE.md + docs/MAJOR_UPDATE.md. Stack: Vite+React18+TS strict, plain CSS + tokens (must look right in all 5 themes: default, [data-ui=broadcast|paper|terminal|aurora]), components in src/components, live data useLive(), deployed on Netlify (https://poltok.netlify.app) — server code must exist both as server/*.js (Node, mounted in server/index.js with ONE additive line) and netlify/functions/*.mjs (config.path) importing the same module. Real data only; never fabricate; label sources & freshness; say clearly when something needs a key.
## Ownership (edit only yours)
1 WORLD     src/features/world/**, server/world.js, netlify/functions/world.mjs      /world global elections hub
2 PRES2028  src/features/2028/**, server/pres2028.js, netlify/functions/pres2028.mjs /2028 presidential race tracker
3 MEMBERS   src/features/members/**, server/members.js, netlify/functions/members.mjs /members, /member/:id (US Congress + AU Parliament)
4 MYAREA    src/features/myarea/**, server/myarea.js, netlify/functions/myarea.mjs   /my — address/postcode → your representatives & races
5 QUIZ      src/features/quiz/**                                                     /quiz — issues match quiz + daily trivia
6 CALENDAR  src/features/calendar/**, server/calendar.js, netlify/functions/calendar.mjs /calendar — elections & key dates, ICS export
7 MONEY     src/features/money/**, server/money.js, netlify/functions/money.mjs      /money — campaign finance (FEC)
8 QUALITY   index.html <head>, public/robots.txt, public/sitemap.xml, src/lib/seo.ts, vite.config.ts, perf/a11y fixes in shared components ONLY via small targeted edits
## Shared files — ONE additive line each, re-read right before editing, never reformat:
- src/app/App.tsx: lazy import + <Route>
- src/app/Shell.tsx NAV_MORE: one {to,label,sub}
- src/features/menu/MenuPage.tsx: one tile in the right section
- server/index.js: one route line
Test server: `npm run build && NODE_ENV=production PORT=<88XN> node server/index.js &` then `kill $!` (never pkill by pattern). Ports: agent N → 886N. tsc must pass. No git commits. Final message <150 words.
