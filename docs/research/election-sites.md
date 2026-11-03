# Election Results, Forecast & Map Sites: Teardown for PolTok

_Agent 2 research, Nov 3 2026 (Election Day). This is a product and UX teardown, not code. The 2026 race data lives in `midterms-2026-data.md` and `midterms-2026.json`._

Confidence: the feature descriptions come from long-running, publicly documented behavior of these sites (2016–2024 cycles plus 2025–26 coverage). Specific UI details change every cycle, so treat them as patterns to borrow, not pixel specs. One status change matters: **ABC News shut down FiveThirtyEight in March 2025**. Its forecasting lineage now lives on at **Silver Bulletin** (Nate Silver), **Strength In Numbers / FiftyPlusOne** (G. Elliott Morris) and others. The 2026 forecasters actively publishing include Silver Bulletin, The Economist, Split Ticket, DDHQ/The Hill, FiftyPlusOne, VoteHub and Race to the WH.

---

## 1. Live results desks

### New York Times: Results pages and "The Needle"
- **The Needle:** a semicircular gauge that shows the live estimated probability and margin, with jitter inside the model's uncertainty band. It is the most emotionally effective election graphic ever built. Lessons: (1) a single glanceable state, (2) motion signals that things are still live, (3) the uncertainty band narrows as the count comes in. 2024 brought per-state needles (PA, GA, NC…) and a national needle. The jitter was controversial in 2016 and was toned down later, so keep any jitter subtle and offer a "reduce motion" toggle.
- **Estimated margin + "expected vote reported" (%)** instead of "precincts reporting." The NYT model estimates outstanding vote by county and vote type (mail, early, Election Day).
- **County shift arrows ("swing arrows"):** a map of arrows whose length and angle encode the shift vs. the prior election (right/red = shift R). It reads instantly as a national mood graphic.
- **Balance-of-power bars** for House and Senate: a stacked horizontal bar with a 50/218 midline, called seats as solid fill, and leading seats as hatched or lighter fill.
- **Race pages:** a candidate table (votes, %, called check mark), a county choropleth with toggles for margin, shift and turnout, and a "remaining votes" estimate.
- **Key Races lists**, sorted by poll-closing time, each with a mini-map, a mini-bar and a status chip ("Too early to call", "Leaning", "Called").
- **What makes it great:** editorial calm, small multiples, uncertainty shown honestly, and excellent typography. The Upshot writes explanatory annotations live.

### Associated Press (AP) Election Results
- AP is **the race-call authority**. Most outlets, Google and Bing call races off AP's feed (AP Elections API: JSON, county and race level, with `winner` and `called` timestamps).
- **AP VoteCast** (survey) gives demographic breakdowns that substitute for exit polls.
- **"Race call" explainers:** each call ships with a short text on *why* AP called it ("AP declared X the winner because…").
- **Expected vote (%)** is AP's metric for how much of the total vote is counted, and it is standard across the industry.
- **Great because:** it is trusted, fast and neutral. PolTok should mirror AP call semantics (Called, Too close, Too early, Race call explained).

### Decision Desk HQ (DDHQ)
- Fast, independent race calls, often minutes ahead of AP. DDHQ powers The Hill and NewsNation and publishes a **forecast model** (2026: House D 223 / R 203 / 9 toss-ups as of Nov 2).
- It has a **sub-county / precinct-level** results API and high-frequency updates. Its social-first presence (X posts per call) is very "PolTok."
- **Great because:** speed, a live call ticker, and a design dense enough for power users.

### CNN: Magic Wall / election center
- **John King's Magic Wall:** a touch-driven map you can drill into from state to county, with "what if" toggles that flip a county or adjust turnout. It also compares the current count with 2020/2024 county results on the same view.
- **Key Race Alerts:** a red-banner push format ("KEY RACE ALERT: X takes the lead…") that creates broadcast-style drama.
- **Balance of power** shown as a big tally-number panel ("Dems need X more").
- **Great because:** drama, pacing and drill-down; it turns data into storytelling.

### Washington Post: Results
- **"Path to victory" / "Estimated votes remaining"** per race and state, with ranged estimates of outstanding vote.
- Clean **balance-of-power bars**, **hex/grid cartograms** of House seats, and live annotations from the Post's Election Lab-style models.
- **Great because:** it states plainly what is left to count, and shows it by vote method.

### Bloomberg
- Elegant **dark-theme** maps and charts, with **market-reaction overlays** (S&P futures, Treasury yields, prediction-market odds next to race results).
- **Great because:** it is cross-domain (politics plus markets), which fits PolTok's markets feed well.

---

## 2. Forecasts & models

### FiftyPlusOne / Strength In Numbers (G. Elliott Morris; ex-538, ex-Economist)
- Simulation-based House and Senate model (2026: median 230 D House seats at launch; 51 D Senate seats). It reports the **joint probability** of control of both chambers.
- Visuals: **seat-distribution histograms** that color each simulated outcome by who controls the chamber, and probability "dot plots."

### Silver Bulletin (Nate Silver)
- The 538 heritage: a topline **probability with a time-series line chart** of how odds evolved, plus **"snake" charts** that order races by forecast margin, with a cumulative seat count and a tipping-point marker.
- **Approval and generic-ballot averages** with trendlines and pollster-rating weights.
- 2026: House about 93% D (Oct 12). The Nov 2 rater table shows Silver Bulletin at D 230 / R 196 / 9 toss-ups.

### The Economist forecast
- Dot-matrix **"each dot is a simulated outcome"** graphics, state probability tables and posterior-shaded maps. It is restrained and print-quality.
- 2026: roughly a 90% D House chance; Nov 2 rater table shows D 230 / R 190 / 15.

### Legacy 538 (shut down 2025): patterns still worth stealing
- **Snake chart**, **"what if" interactive** (pick winners and the model updates), and **"Fox in the snow"** ball-swarm of 100 simulated outcomes. All are still the best formats for communicating probability.

### Race to the WH
- An independent forecaster with a dense ratings table, poll aggregator and **"forecast over time" charts per race**. It updates frequently and suits a "nerd mode" view.

### Split Ticket
- A data-heavy Substack/site with a House and Senate model, **candidate-quality (WAR, "wins above replacement") scores**, and **ticket-splitting analyses** (presidential vs. House margin per district).
- Its idea to borrow: per-district **"overperformance vs. baseline"** bars.

---

## 3. Expert ratings shops

### Cook Political Report (with Amy Walter)
- Seven-point ratings (Solid, Likely, Lean, Toss Up). Its **Cook PVI** (Partisan Voter Index, e.g. R+5) is the standard district lean metric, and PolTok should show PVI next to every district.
- Ratings-change log with dates and arrows. 2026 final: Senate 9/2/3/6/2/2/11; House toss-ups 18.

### Sabato's Crystal Ball (UVA Center for Politics)
- Final ratings have **no toss-ups** ("we push every race off the fence"). 2026 final: House D 239 / R 196.
- Clean **ratings map + change table** with short written rationales.

### Inside Elections (Nathan Gonzales)
- Adds **"Tilt"** categories, making a nine-point scale. PolTok's rating enum should allow "Tilt" in metadata even if the UI uses seven buckets.

---

## 4. Aggregators, maps & builders

### 270toWin
- **The interactive map builder:** click a state to cycle D → R → toss-up; the running EV total and **"270" progress bar** update live. You can share via URL, and templates come from ratings (Cook, Sabato…) and historical results.
- **Senate/House/governor builders** with balance-of-power bars, plus **"road to 270" combination counters**.
- Lessons: make the map *the controller*, make state shareable in the URL, and let the user start from expert presets.

### RealClearPolling (RCP)
- The **RCP average** tables: poll list, spread, date range, "RCP Average" row, and trend line with an approve/disapprove chart.
- The **"No Toss Up" map** and Senate/governor ratings maps. Clear, data-first, sticky tables.

### Ballotpedia
- An encyclopedic **candidate and ballot database** with sample ballots, ballot measures and primary results. It is the best source for **who is on the ballot**, including down-ballot races and measures.
- Idea: a "**My Ballot**" lookup by address or zip.

### Dave's Redistricting App (DRA)
- An interactive **district builder and analytics** tool: partisan lean composites, compactness, minority-opportunity metrics, and **old vs. new map overlays**.
- Idea: in 2026, with mid-decade redistricting in TX, CA, FL, OH, NC, LA, AL and UT, a **"redistricted seat" badge and old/new boundary toggle** is very valuable.

### Polymarket & Kalshi (prediction markets)
- Live **price = probability** charts with time-series sparklines, order-book depth and 24h change. Markets cover House/Senate control, per-race outcomes and balance-of-power combos.
- Nov 2 2026: Kalshi House D 94%, Senate D 74%; Polymarket House D 95%, Senate D ~72%.
- Ideas to borrow: **odds-movement sparkline next to each race**, and the **"biggest movers today"** list. Always label it "market odds, not a forecast."

---

## 5. Cross-cutting patterns that make the best sites great

1. **Single glanceable "state of the night"**: a balance-of-power bar plus a headline probability or needle.
2. **Honest uncertainty**: expected-vote %, ranges and confidence bands, and status chips (Too early / Leaning / Called).
3. **Time as a first-class axis**: poll-closing schedule, race-call timeline and odds-over-time.
4. **Comparison to baseline**: the 2024 pres margin, PVI, shift arrows and over/under-performance.
5. **Drill-down with persistent context**: nation → state → county or district while the BoP bar stays visible.
6. **Interactivity that teaches**: map builders, "what if X wins", paths to victory.
7. **Alert culture**: race calls and key race alerts as push and toast events.
8. **Mobile-first, thumb-friendly maps**: cartograms for small states, and lists as a fallback for maps.

---

## 6. Top 15 features PolTok should build (ranked)

| # | Feature | Inspired by | Why |
|---|---|---|---|
| 1 | **Balance-of-power bars** (Senate 51 / House 218 midline; called = solid, leading = hatched, uncalled = gray) pinned to the top on every screen | NYT, CNN, WaPo | The single most important number tonight |
| 2 | **Race-call alert feed + toasts** ("PROJECTED: Sherrod Brown (D) wins OH-Sen, D GAIN"), with a "why called" line and a flip badge | AP, DDHQ, CNN KRA | Gives PolTok its real-time, TikTok-style energy |
| 3 | **Interactive US Senate/governor map with a hex-cartogram toggle** (geographic ↔ equal-area tiles) | 270toWin, NYT, WaPo | Small states (DE, RI, NH) need to be visible |
| 4 | **House cartogram** (one hex per district, 435), colored by rating → leader → call | WaPo, Daily Kos Elections hexmap | You cannot read 435 districts on a geographic map |
| 5 | **Race card** with candidates, vote %, **expected vote %**, margin, status chip, 2024 pres margin and PVI | AP, NYT | The atomic unit of the whole app |
| 6 | **"The Needle"-style probability gauge** for control of each chamber (from market odds pre-results and a simple live model during results) with an uncertainty band and reduce-motion support | NYT | Emotional, glanceable; must be honest |
| 7 | **Poll-closing countdown timeline** (6 PM → 1 AM ET), with "next wave in 12:34" and the states/races closing in that wave | NYT key races, AP | Organizes the night, and works before any results arrive |
| 8 | **Paths to control / "what-if" builder**: click Toss-ups to assign them, then watch the BoP bar and "Dems need N more" update, with a shareable URL | 270toWin, 538 | Engagement and replay value; works on mobile |
| 9 | **Ratings vs. markets vs. results matrix** per race (Cook / Sabato / IE / Kalshi / Polymarket side by side) | RCP, Wikipedia tables, Kalshi | Unique cross-source view, which is PolTok's differentiator |
| 10 | **County swing arrows / shift map** vs. 2024 for drilled-in states | NYT | The best "national mood" visual of the night |
| 11 | **Odds sparklines + "biggest movers"** (prediction markets) | Polymarket, Kalshi, Bloomberg | Movement is the story; fits short-form cards |
| 12 | **Generic ballot & approval trend charts** (RCP/Silver Bulletin style), with a pre-results "national environment" panel | RCP, Silver Bulletin | Context for the night |
| 13 | **Snake chart** of races ordered by margin or rating, with a tipping-point marker | 538, Silver Bulletin | Shows the tipping-point seat for each chamber |
| 14 | **Redistricting badges + old/new boundary toggle** for redrawn seats (TX, CA, FL, OH, NC, LA, AL, UT) | DRA, Cook | 2026-specific; explains "R+4 from maps" |
| 15 | **Flip tracker / scoreboard**: list of seats that changed party, net gain counters, and "Dems need N more" | CNN, NYT | A simple, satisfying running tally |

Honorable mentions: a "My Ballot" zip lookup (Ballotpedia), VoteCast-style demographic breakdowns (AP), a split-ticket view (Split Ticket) and a market-reaction overlay (Bloomberg).

---

## 7. Implementation notes (React + d3-geo SPA)

**Geometry**
- Use **`us-atlas`** TopoJSON (`states-10m.json`, `counties-10m.json`) with `topojson-client` `feature()`/`mesh()`. Use **`d3.geoAlbersUsa()`**, which already insets AK and HI. Precompute paths once with `d3.geoPath(projection)` and memoize them per viewport size.
- **Congressional districts:** 2026 lines differ from the 118th-Congress files for TX, CA, FL, OH, NC, LA, AL and UT. Source new shapefiles from state legislatures or DRA exports, simplify with `mapshaper -simplify 5%`, and convert to TopoJSON. If no geometry is ready, ship the **hex cartogram first**: it needs no shapefiles, only an `{id, q, r}` tile grid such as the Daily Kos Elections House hexmap layout or a hand-built 435-tile JSON.
- **State tile/hex grid:** use a static 50+DC grid layout (e.g. the NPR/WaPo-style square tile map). This is trivial: `{AK:[0,0], ME:[0,11], …}` rendered as `<rect>`/hex `<path>`. Animate the switch between geo and tile modes by interpolating centroids (`d3.interpolate`) and cross-fading the shapes.
- **Swing arrows:** at each county centroid (`path.centroid`), draw a line whose dx is proportional to the margin shift and that is angled 45° left (D) or right (R). Use `<line>` with a marker, and cap the length at about 30px.
- Render with **SVG** up to about 3,500 county paths. Fall back to **Canvas** (`geoPath().context(ctx)`) for county-level national views on mobile. Use `d3-zoom` for drill-down, and fit with `projection.fitExtent` to the state bounds.

**State & data flow**
- Normalize every race to the JSON shape in `midterms-2026.json`, plus live fields: `{reportingPct /* expected vote % */, votes:{D,R,O}, leader, status:'notStarted'|'tooEarly'|'tooClose'|'leaning'|'called', calledAt, calledBy:'AP'|'DDHQ', flip:boolean}`.
- Transport: use **SSE or WebSocket** from `server/` to push race deltas. The client keeps a normalized store (Zustand/Redux, keyed `SEN-OH`, `HOU-PA-07`, `GOV-GA`). Derive BoP totals with selectors; never store them separately.
- **Race-call events** go to a separate event stream that feeds the toast queue (dedupe by raceId) and the alert feed. Play a sound only after explicit opt-in.
- Poll-closing timeline: compute from `pollClosings` (ET strings, where values past midnight mean Nov 4). Store them as ISO times with a `-05:00` offset (EST on Nov 3).

**Visual system**
- Party colors: D `#2563eb`-ish, R `#dc2626`-ish, with a rating ramp of three tints per side (Solid, Likely, Lean) plus a neutral toss-up (purple or gray). Use **hatch patterns** (SVG `<pattern>`) for "leading but not called," for colorblind-safety and print-safety. Independents get a third hue (e.g. amber), which matters for Osborn (NE) and Achilles (ID).
- **Balance-of-power bar:** a flex row of segments `[D called | D leading | uncalled | R leading | R called]` with an absolutely positioned midline at 50%. Animate widths with CSS transitions.
- **Needle:** a d3 arc gauge (`d3.arc` from −90° to 90°) whose pointer angle comes from P(D control). Add a shaded uncertainty band, and `requestAnimationFrame` jitter of ±1–2° only when the `prefers-reduced-motion` media query does not request reduced motion.
- Accessibility: every map has a **sortable table fallback**; aria-live="polite" region for race calls; never color-only status.

**Performance / mobile**
- Lazy-load county TopoJSON per state on drill-in, keeping the national file under 150 KB gzipped. Use virtualized race lists. Throttle re-renders to about 1/sec during floods of results.
- Use a URL state for the what-if builder (`?sen=OH:D,ME:D,TX:R`) so scenarios can be shared.

**Sources & legal**
- The AP Elections API and DDHQ API are paid. For a demo, use a mock feed generated from `midterms-2026.json` plus simulated counts. Label prediction-market odds "market odds," and attribute ratings ("Rating: Cook Political Report").
