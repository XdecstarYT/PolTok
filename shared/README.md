# shared/
Plain ESM JavaScript (with JSDoc types) imported by BOTH the Node server (`server/`) and the
Vite client (`src/`). Keep it dependency-free and browser-safe (no `fs`, no `process`).

- `data/*.js` — seed data (states, races, polls, candidates). Owned by the Data agent.
- `sim.js`    — deterministic election-night simulation engine. Owned by the Server agent.
