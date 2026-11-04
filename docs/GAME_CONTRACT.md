# Campaign HQ — game team contract
Skill: /root/.claude/skills/synced/fa3ffa20-337f-4d6b-b62b-dba609e01b29_bbe7bca4-3f19-4fa3-990d-a294ce65aa37/browser-game-builder (read SKILL.md + references/2d-games.md, game-feel.md, ui-art-direction.md, genres.md "strategy/sim").
Real data to draw on: shared/data/*.js (US states, races, ratings, polls, 2024 results), src/data/au.ts (Vic districts, parties, polls), docs/research/*.md.

Files (served by Vite/the app from public/game/, plain browser JS, no build step, no deps except optional CDN libs per skill):
- public/game/index.html  — owner GAME-ENGINE. Loads ./content.js and ./maps.js (classic <script> tags exposing window.CHQ_CONTENT and window.CHQ_MAPS). Whole game: title, setup, turn loop, map, HUD, events, finale, pause/settings, save/best, audio, touch.
- public/game/content.js — owner GAME-CONTENT. window.CHQ_CONTENT = {
    contests: [{ id:'us-senate'|'us-house'|'vic-2026', title, blurb, weeks, budget, seats:[{id, name, region/state, ev?|weight, lean (D/ALP-positive margin pts, from real data), turnout, issues:{economy,cost,immigration,health,crime,climate,democracy...: salience 0..1}, incumbent?, key?}], majority, parties:[{id,name,color,short}], baseline }],
    candidates: { [contestId]: [{ id, party, name (fictional archetypes OK — do NOT use real people as playable; real party names fine), traits:{charisma, discipline, fundraising, policy}, perk }] },
    actions: [{ id, name, desc, cost:{money,volunteers,time}, effect:{...}, scope:'seat'|'region'|'national', cooldown, unlock? }],
    events: [ 80+ event cards { id, title, body, when?, weight, choices:[{label, effects:{national?, seatIds?, issue?, money?, momentum?, scandal?, media?}, followUp?}] } ],
    issues: [...], advisors: [...staff hires with perks], endingsText:{...}
  }
- public/game/maps.js — owner GAME-MAPS. window.CHQ_MAPS = { us:{viewBox, states:[{id:abbr, d (pre-projected SVG path), cx, cy}]}, vic:{viewBox, districts:[{id:'vic-…', d, cx, cy}]} } pre-projected & simplified from us-atlas and public/geo/vic-districts.json (ids must match content seats). Also owns embedding in the React app: route /game (src/features/game/GamePage.tsx: full-viewport iframe of /game/index.html with fallback link), NAV entry {to:'/game',label:'Game'} in src/app/Shell.tsx, App.tsx route, CommandPalette entry.

Rules: no git commits; no real people as player characters or in invented scandals (real people may only appear as factual baseline references, e.g. incumbent names in seat data); fictional events must be clearly fictional/hypothetical.
