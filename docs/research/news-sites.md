# PolTok Research: Political News Sites & Apps

_Agent 1 research brief. Compiled 2026-11-03 (Election Day, US midterms). Feeds were verified live with curl through the session proxy on this date._

**TL;DR for builders**
- What the best products do well: **structure** (Axios, Semafor), **insider voice and urgency** (Playbook, Punchbowl), **showing bias** (Ground News, AllSides, Particle), **live data theatre** (NYT Needle, CNN Magic Wall, AP race calls), and **vertical, swipeable, short-form** delivery (TikTok, Snapchat Discover, Instagram Stories).
- PolTok's angle: a **dark election-night command center** with a **TikTok-style vertical story feed**. Each card follows a Smart Brevity / Semaform layout and shows Ground-News-style bias bars.
- **38 free, keyless RSS feeds work server-side today** (table in §4). Google News search RSS is the best wildcard. AP, Reuters, Axios, WaPo and USA Today have **no working direct feed**; reach them via Google News `site:` queries.
- **CORS:** most feeds send no `Access-Control-Allow-Origin` header (NYT is the exception, with `*`). **The SPA must fetch through our own server proxy/aggregator** (the repo already has `server/`).

---

## 1. Per-site teardown

### 1.1 Politico (Playbook, Pro)
- **Signature:** *Playbook*, the daily insider morning email that sets DC's agenda, started 2007. Its classic sections are "Driving the Day", "Playbook Reads" and "Playbookers" (birthdays, sightings, job moves). Spin-offs: Playbook PM, state Playbooks (CA, NY, FL, IL, MA, NJ), Power Briefing, a podcast, and short audio clips.
- **Politico Pro** is a B2B policy-intelligence subscription launched in 2010, sold to lobbyists and staffers. It offers vertical desks (energy, health, tech, trade), bill trackers, legislative calendars, "Pro Whiteboard" quick hits, and alerts sent within minutes. The free site and newsletters act as the funnel.
- **Layout:** a dense homepage with a lead package, a vertical river of headlines and section rails. Election nights use a dedicated results hub with race tables and a balance-of-power bar.
- **Why it's great:** speed plus insider access. It names names and runs scoops ("SCOOP:", "FIRST IN PLAYBOOK:"). Its tone is gossipy but authoritative.
- **Visual identity:** red (#D6001C-ish) on white, a heavy condensed serif/sans mix, and tight, utilitarian density.
- **Steal:** a morning "Playbook" digest card, "FIRST IN POLTOK"/"SCOOP" badges, and "Playbookers" sightings as social flavor.

### 1.2 Axios (Smart Brevity)
- **Signature:** **Smart Brevity**, a strict story skeleton: headline, a one-sentence lede, then bold signposts — **"Why it matters:"**, **"The big picture:"**, **"Driving the news:"**, **"Between the lines:"**, **"Yes, but:"**, **"By the numbers:"**, **"What's next:"**, **"The bottom line:"** — followed by a **"Go deeper"** link. Stories show their word count / "X min read".
- **Newsletters:** Axios AM/PM, "1 big thing" leads, and local Axios cities. Axios Pro sells deal and policy trackers; Axios HQ sells the format to companies as internal comms software.
- **Layout:** card-based single column, generous whitespace, bullets everywhere, and almost no images above the fold.
- **Why it's great:** respects time and is skimmable in 30 seconds. The signposts let readers jump straight to "why should I care".
- **Visual identity:** white canvas, black type, a single blue accent, and bold sans for the signposts.
- **AllSides:** Lean Left (moved from Center in 2023).
- **Steal:** **every PolTok card uses Smart Brevity signposts** as collapsible chips. Show read time ("20-sec read").

### 1.3 Semafor (Semaform)
- **Signature:** the **Semaform** story template (launched Oct 2022). Each story is split into labeled boxes: **The News**, **[Reporter]'s View**, **Room for Disagreement**, **The View From [place/side]**, **Notable** (the best outside links).
- **Why it's great:** it visibly separates fact, analysis, counter-argument and outside perspectives, which is designed to rebuild trust. Critics (CJR) warn "Room for Disagreement" can slide into rote bothsidesism. Semafor Signals adds AI-assisted multi-source context.
- **Newsletters:** Flagship (global), Principals (DC politics) and Americana.
- **Visual identity:** warm off-white/cream paper background, editorial serif headlines, small-caps section labels, thin rules and illustrated headshots.
- **Steal:** a **"The View From the Left / The View From the Right / Room for Disagreement"** panel on every story's detail sheet. Our bias-labeled feeds can fill it automatically.

### 1.4 The Hill
- **Signature:** a high-volume DC news wire with lots of short posts, video clips (Rising) and opinion. It rates Center on AllSides and has big reach across both sides.
- **Layout:** a classic portal with a busy headline river and heavy ads. It is SEO-driven.
- **Steal:** treat it as a **Center anchor source** for clustering and a fast feed for breaking items. Avoid its clutter.

### 1.5 NYT Politics
- **Signature:** **The Needle**, a speedometer gauge running from "Tossup" through Lean, Likely and Very Likely for each side. It moves live as county and precinct votes arrive and is backed by a model built on NYT/Siena polls, voter files and past results. Also: "Live updates" blogs with timestamped posts and pinned key developments, hex/bubble results maps, "Where the remaining vote is" estimates, and The Upshot's data explainers.
- **Why it's great:** it turns uncertainty into a **visceral, emotional instrument**; people screenshot the needle. Graphics desk quality is unmatched, with careful typography and annotated charts.
- **Visual identity:** Cheltenham/Imperial serifs, Franklin sans for UI and restrained D blue / R red. Whitespace signals authority.
- **AllSides:** Lean Left.
- **Steal:** **a "PolTok Needle" gauge** for Senate and House control (an SVG arc with spring physics and a jitter band showing uncertainty), plus **live-blog cards with pinned "Key developments".**

### 1.6 Washington Post Politics
- **Signature:** "Live updates" blogs, the 2024 "Democracy Dies in Darkness" branding, a strong graphics/data desk, The Early 202 newsletter and a TikTok presence (Dave Jorgenson's comedic explainers made WaPo a TikTok pioneer). It also has AI "Ask The Post AI" and article summaries.
- **Feed status:** `feeds.washingtonpost.com` returns **502 today**. Use Google News `site:washingtonpost.com` instead.
- **Steal:** a casual, self-aware, human-voiced **short video explainer** tone ("the newsroom TikTok").

### 1.7 Punchbowl News
- **Signature:** founded by ex-Playbook authors (Sherman, Palmer, Bade). It is **Congress-only**, built around "power, people, politics". Products: AM (free), Midday and PM (premium), plus **The Vault** (policy/finance tier, roughly $1,200/yr or more) with The Sunday Vault, live events and briefings.
- **Format:** numbered items, bold lead-ins, behind-the-scenes whip counts, and "what leadership is saying privately".
- **Visual identity:** bold black/white with a punchy red-orange accent and a simple, newsletter-first web layout.
- **Feed:** `https://punchbowl.news/feed/` works (10 items).
- **Steal:** a **"Whip Count" widget** (tallies on contested votes and leadership races) and a **"Hill Insider" tone** for congressional cards.

### 1.8 Ground News (bias / blindspot)
- **Signature:** clusters every story across thousands of outlets and shows a **Left/Center/Right coverage distribution bar** on each story. Ratings are blended from AllSides, Ad Fontes and MBFC. Other features:
  - **Blindspot feed:** stories covered mostly by one side ("Blindspot for the Left").
  - **Factuality ratings** (very low through very high).
  - **Ownership** (who owns the outlet; paid feature).
  - **"My News Bias"** dashboard showing the user's own reading lean.
  - A **bias quiz** and a daily briefing.
- **Why it's great:** it makes media bias **visual and gamified**, and the Blindspot feed is genuinely novel. Critics call the 1-D left/right model reductive.
- **Visual identity:** dark-mode friendly, a tri-color bar (blue / white-grey / red) and compact source favicons stacked under each story.
- **Steal:** a **bias distribution bar on every PolTok cluster**, a **"Blindspot" tab** and a **"Your Bias Meter"** personal stat in the profile. Compute these from our feed lean labels.

### 1.9 AllSides
- **Signature:** **side-by-side "From the Left / Center / From the Right" headline triptychs** for the same story. It publishes a **Media Bias Chart** (a five-point scale: Left, Lean Left, Center, Lean Right, Right) built from blind surveys and editorial review, and runs a "Red Blue Dictionary" and a "Balanced Newsletter".
- **Why it's great:** the simplest possible UI for perspective. Three columns, three headlines, and you instantly see framing differences.
- **Steal:** a **"Three Ways to Read This" swipe**: one card, swipe horizontally to see the L/C/R headline. Use AllSides' five-point labels as our canonical lean taxonomy.

### 1.10 Reuters / AP Politics
- **Signature:** the wires everyone else rewrites. **AP race calls are the gold standard** ("AP has declared..."). AP's "Decision Notes" explain why a race was called, and AP's VoteCast survey replaced exit polls for many outlets. Reuters is fast, neutral, terse and global.
- **Feed status:** both **block direct RSS** (AP returns 403; the Reuters agency feed returns 404). **Use Google News `site:apnews.com` / `site:reuters.com` queries (verified, 100 items each).**
- **AllSides:** Reuters Center; AP Lean Left.
- **Steal:** a **"CALLED" stamp animation** with a source attribution ("Race call: AP") and a **"Why we called it" decision note** expandable under each race.

### 1.11 Bloomberg Government
- **Signature:** a paid B2B legislative-intelligence platform: bill tracking, lobbying and contract data, BGOV OnPoint briefs, and spending/appropriations dashboards. Bloomberg's terminal aesthetic: **black background, amber/orange data, monospace tickers, dense tables**.
- **Steal:** this is **the visual DNA for the "command center"**: a terminal-like ticker bar, monospace numerals, and amber "data alive" accents.

### 1.12 The Atlantic
- **Signature:** long-form ideas journalism and big-name essays. A refined magazine design with a distinctive custom serif and full-bleed art.
- **Feed:** `https://www.theatlantic.com/feed/channel/politics/` works (Atom, 25 entries). **AllSides: Left.**
- **Steal:** a **"Long Read" card type** in the feed (slower pacing, a pull quote and read-time) to break up rapid-fire cards. Respect the "deep" mode.

### 1.13 CNN Politics
- **Signature:** **John King's Magic Wall**, a touch-driven county map where you zoom, tap, compare to 2020/2024 and "show me what's outstanding". Also: the "Key Race Alert" broadcast graphic, countdown clocks, exit-poll explorers and the CNN Politics app's results tracker.
- **Feed status:** `rss.cnn.com/rss/cnn_allpolitics.rss` returns 200 but is **stale (last item Dec 2022)**. CNN has abandoned RSS, so don't use it.
- **Steal:** a **"KEY RACE ALERT" full-screen interstitial** (a red/blue slab, a big sans headline, a whoosh). It also borrows the **magic-wall drill-down** (tap state, then counties, then the "vote remaining" overlay) and **"Compare to 2022/2024"** toggles.

### 1.14 Fox News Politics
- **Signature:** the largest right-leaning audience, the Fox News Decision Desk (with AP VoteCast), the "Fox News Alert" banner, bold red/navy/gold styling and heavy video. Fox Digital rates Right on AllSides.
- **Feeds:** `moxie.foxnews.com/google-publisher/politics.xml` and the legacy `feeds.foxnews.com/foxnews/politics` both work (25 items). Note: Fox's feed carries few images.
- **Steal:** **an "ALERT" banner** pattern, distinctly styled from the "Key race alert".

### 1.15 RealClearPolitics
- **Signature:** **the polling average** ("RCP Average"), a no-frills aggregator homepage of headline links split left and right, and the "No Toss Up" maps. RealClearPolling now hosts the poll tables.
- **Why it's great:** dead-simple; the poll average plus the spread ("D+2.3") is the internet's shorthand.
- **AllSides:** Center (aggregator).
- **Feeds:** `realclearpolitics.com/index.xml` (21 items) and a feedburner mirror both work.
- **Steal:** a **spread chip format "R+2.1"** everywhere, plus poll-average sparklines.

### 1.16 Drudge-style aggregators (Drudge Report, Memeorandum, Mediaite, RCP homepage)
- **Signature:** brutalist HTML link lists, one giant **siren headline** (Drudge's red flashing siren) and three columns of plain links. Memeorandum clusters links by story with "discussion" sub-links — the original story clustering.
- **Why it's great:** pure editorial curation and speed, with zero friction. The single siren headline sets the day's narrative.
- **Steal:** a **"SIREN" mode**: one top-of-app headline with a pulsing red siren icon, used only for the biggest story. Memeorandum-style **clusters with "+12 more sources"** expanders.

### 1.17 Morning Brew-style newsletters (Morning Brew, 1440, Tangle, The Skimm, Semafor Principals)
- **Signature:** conversational, witty voice, emoji section markers, "Quick hits", a market or poll snapshot at top, a daily quiz or game, and **referral programs** (milestone rewards). **Tangle** specifically does "What the left is saying / What the right is saying / My take" and is rated Center. Its feed `readtangle.com/rss/` works.
- **Steal:** a **daily "Election Brief" ritual**, a **streak counter**, a **2-minute quiz**, and the Tangle **left/right/take** format as an alternative story template.

### 1.18 TikTok / short-video news (NowThis, Snapchat Discover, WaPo TikTok, creators)
- **Formats:**
  - **NowThis** made the silent-autoplay captioned square/vertical video famous: big burned-in captions and no anchor needed.
  - **Snapchat Discover** used full-bleed vertical "Stories" from publishers (CNN, NBC's "Stay Tuned"), with tap-through pages, swipe-up for more, and segmented progress bars at top.
  - **TikTok news creators** use green-screen over article screenshots, talking heads with kinetic captions, "3 things you need to know" lists and stitches/duets for counterpoints.
- **2026 trend:** newsrooms (NBC, CBS, WaPo, ABC) go live and clip broadcast to TikTok on election nights. TikTok as a news source is plateauing but dominant with under-30s.
- **Why it works:** full-screen focus, instant swipe and an endless feed. Captions double as accessibility.
- **Steal:** **the core feed UX**: full-height snap-scroll cards, Stories-style segmented progress for multi-part cards, kinetic captions (word-by-word highlight) on text "video" cards, and a **reaction rail** on the right edge (react / save / share / "see other side").

### 1.19 Apple News
- **Signature:** Top Stories (human-curated), "Today" briefing, an Apple News+ audio and puzzle push, **election hub with live results widgets** (AP data) on iOS lock screen via **Live Activities**, and publisher-branded article styling (Apple News Format).
- **Visual:** SF Pro, big bold headlines, red accent, clean cards and great dark mode.
- **Steal:** **Live-Activity-style persistent "race tracker" pill** (a bottom dock showing chamber balance that follows you across screens), and a **"Today" curated top five**.

### 1.20 SmartNews
- **Signature:** a **horizontally swipeable channel tabs** UI (colorful tab bar: Top, Politics, Local, U.S...). It offers "News From All Sides", a political-balance slider that tunes the mix of left/right sources, plus an election channel with a results map and a "Smart Mode" fast reader.
- **Steal:** a **"Balance slider"** in feed settings from "my lean" through "balanced" to "challenge me". Colorful **topic tabs** across the top.

### 1.21 Particle
- **Signature:** an AI news reader from ex-Twitter people (launched Nov 2024; web launched May 2025). It **clusters a story across outlets and summarizes it** with AI, using several views:
  - **"Opposite Sides":** a left-to-right dot spectrum of coverage plus how each side frames the story.
  - "Explain Like I'm 5", "Just the Facts" and Q&A.
  - Entity pages.
  - **audio**.
- **Why it's great:** multiple lenses on one story with publisher-friendly linking.
- **Steal:** **lens switcher chips** on the story detail ("5 bullets / ELI5 / Just facts / Opposite sides") and **entity pages** for candidates and races.

### 1.22 Artifact (defunct, Jan 2024)
- **What it was:** the Instagram founders' AI-personalized news app. It offered ML ranking by dwell time, AI rewriting of clickbait headlines, AI summaries, user "links" posts, comments and reputation.
- **Why it died:** the founders said the market wasn't big enough. User posts and comments needed **heavy moderation**, and its identity wavered between news reader and social network.
- **Lessons:**
  - **Don't build open UGC comments** in a politics app without moderation capacity. Use reactions and predictions instead.
  - Personalization alone isn't a moat; **events** (like election night) and **ritual** are.
  - The **clickbait-headline rewrite** was beloved and is worth borrowing.

---

## 2. Top 15 features PolTok should steal/remix (ranked)

| # | Feature | Inspired by | React SPA implementation note |
|---|---|---|---|
| 1 | **Vertical snap-scroll story feed** (full-height cards, swipe/keys/wheel) | TikTok, Snapchat Discover | CSS `scroll-snap-type: y mandatory` on a `100dvh` container; `IntersectionObserver` for the active card; virtualize beyond ±3 cards. |
| 2 | **Bias distribution bar + source stack per story cluster** | Ground News, Particle | Server clusters RSS items (title token Jaccard/TF-IDF ≥0.35 within a 12h window); client renders a 3- or 5-segment flex bar from the `lean` counts. |
| 3 | **Live "Needle" for Senate/House control** | NYT Needle | SVG arc gauge with framer-motion spring; small random jitter in the uncertainty band; Tossup / Lean / Likely / Solid tick labels. |
| 4 | **Smart Brevity card body** (Why it matters / Big picture / What's next chips) | Axios | Card schema `{lede, bullets[{label,text}]}`. Generate from RSS description via a heuristic or LLM on the server; collapse to the first two signposts. |
| 5 | **"Three Ways to Read It" horizontal swipe (L / C / R headlines)** | AllSides, Semafor "View From", Tangle | A horizontal inner scroller inside the vertical card; pick the top headline per lean bucket from the cluster. |
| 6 | **KEY RACE ALERT / RACE CALLED interstitial** | CNN, AP | A global event bus (Zustand) → full-screen overlay for 2.5s with a party-colored slab, a "CALLED · Source: AP" stamp and haptics (`navigator.vibrate`). |
| 7 | **Persistent bottom "balance dock" (live chamber tally pill)** | Apple News Live Activities, CNN bug | A fixed bottom bar with D/R seat counts plus a mini progress bar; tap expands to the full map sheet. |
| 8 | **Magic-wall drill-down map** (nation → state → county, "vote remaining" overlay, compare-to-previous toggle) | CNN Magic Wall, NYT | `react-simple-maps` or d3-geo with `us-atlas` TopoJSON; zoom via a CSS transform plus pinch; a "Compare 2022" toggle switches the fill scale. |
| 9 | **Blindspot tab** (stories covered mainly by one side) | Ground News | A cluster where at least 75% of sources share one side and there are ≥3 sources → flagged; show "Blindspot for the Right". |
| 10 | **Live ticker + SIREN headline** | Bloomberg terminal, Drudge | Top marquee (CSS `animation: translateX` loop, pause on hover); siren = a single pinned card with a pulsing red radial glow. |
| 11 | **Live-blog cards with pinned "Key developments"** | NYT/WaPo live updates | Server polls feeds every 60–120s; SSE/WebSocket pushes new items; a "▲ 4 new" pill scrolls to the top (don't auto-jump). |
| 12 | **Lens switcher** (Bullets / ELI5 / Just facts / Opposite sides / Listen) | Particle | Chips over the story detail sheet; "Listen" uses the `speechSynthesis` Web Speech API (free, no key). |
| 13 | **Daily Brief + streak + 2-minute quiz / predictions** | Morning Brew, Playbook, Punchbowl AM | A localStorage streak; prediction cards ("Who wins PA-07?") lock at poll close, then score. Use this instead of comments (the Artifact lesson). |
| 14 | **Personal "Your Bias Meter"** | Ground News My News Bias | Track opened sources' lean in localStorage; show a weekly diet donut and a "challenge me" nudge. |
| 15 | **Poll spread chips + sparkline averages** | RCP, Silver Bulletin | A `R+2.1` chip colored by the leader; a tiny 60×16 SVG sparkline; a tooltip lists the last five polls. |

Honorable mentions: SCOOP/"FIRST IN POLTOK" badges (Politico), Whip Count widget (Punchbowl), AI clickbait-headline rewrite (Artifact), Long Read card type (Atlantic), topic tab bar (SmartNews), and a balance slider (SmartNews).

---

## 3. Visual/design recommendations: "Election Night Command Center" × vertical feed

### 3.1 Concept
A **mission-control war room at 11pm on election night**: near-black glass panels, glowing data, scanlines kept very subtle, and party colors as **light sources** rather than flat fills. The feed is the "main screen"; the map, needle and ticker are the "wall monitors". On mobile it is a full-screen feed with a dock; on desktop, a 3-column console (left: races list; center: vertical feed in a phone-width column of about 440px; right: needle + map + ticker).

### 3.2 Color tokens (dark first)
```
--bg-0:      #05070D   /* void, page background */
--bg-1:      #0B0F1A   /* panels */
--bg-2:      #121829   /* raised cards */
--line:      #1F2740   /* hairlines, grid */
--text-hi:   #F2F5FF
--text-mid:  #A3ADC8
--text-lo:   #5D6785
--dem:       #3B82F6   /* D blue  */  glow: #60A5FA
--dem-deep:  #1E3A8A
--rep:       #EF4444   /* R red   */  glow: #F87171
--rep-deep:  #7F1D1D
--ind:       #A855F7   /* independents / other */
--tossup:    #FACC15   /* amber-yellow tossup, "undecided energy" */
--live:      #FF2D55   /* LIVE dot, siren */
--signal:    #22D3EE   /* cyan UI accent, focus rings, links */
--terminal:  #FFB020   /* Bloomberg amber for tickers / numerals */
--ok:        #10B981
```
- **Lean scale (5-pt, for bias bars):** Left `#2563EB`, Lean Left `#60A5FA`, Center `#A3ADC8` (neutral grey-violet, avoid pure white), Lean Right `#F87171`, Right `#DC2626`.
- **Map fills:** use sequential D/R ramps (`#1E3A8A → #93C5FD`, `#7F1D1D → #FCA5A5`) by margin, with uncalled races hatched with a diagonal-stripe SVG pattern. Don't rely on color alone: add hatch for uncalled and a check glyph for called (colorblind safety).
- **Glow recipe:** `box-shadow: 0 0 0 1px color-mix(in oklab, var(--dem) 40%, transparent), 0 0 24px -4px var(--dem-glow)`.
- **Background texture:** a 1px dot grid (`radial-gradient` at 24px) at 4% opacity, plus a very faint scanline `repeating-linear-gradient` at 2%. Disable both under `prefers-reduced-motion` or reduced-transparency.

### 3.3 Typography (Google Fonts)
| Role | Font | Why |
|---|---|---|
| Display / headlines | **Space Grotesk** (600–700), or **Archivo** Expanded/Black for alert slabs | Techy-editorial and condensed-friendly; Archivo's width axis gives CNN-style "KEY RACE ALERT" slabs |
| Body / UI | **Inter** (400–600), with `font-feature-settings: "tnum","ss01"` | Legible at small sizes; tabular numbers |
| Data / tickers / numerals | **JetBrains Mono** or **IBM Plex Mono** (500) | The terminal command-center feel; aligned counts |
| Editorial accent (Long Reads, pull quotes) | **Fraunces** (soft serif, opsz axis) or **Newsreader** | Semafor/Atlantic warmth for "deep" mode |

- **Scale:** card headline `clamp(1.6rem, 5.5vw, 2.4rem)` at line-height 1.05 with letter-spacing -0.02em. Signpost labels are 11px uppercase mono at +0.12em tracking in the `--signal` color. Seat counts are 48–72px mono.
- **Load:** `https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;700&family=Fraunces:opsz,wght@9..144,500&display=swap`

### 3.4 Motion language
- **Feed:** snap scroll; the active card scales from 0.96 to 1.0 and its opacity goes from 0.6 to 1 (spring stiffness 260, damping 30). Images get a slow Ken Burns pan (8s, scale 1.0→1.06) when there is no video.
- **Kinetic captions:** on text-only "video" cards, reveal the headline word by word (40ms stagger) while a progress bar fills, Stories-style (segmented, 5–7s per segment, with tap left/right to skip and hold to pause).
- **Numbers:** seat and vote counts **roll** (odometer digits, 600ms) and flash in the party glow on change.
- **Needle:** spring-driven, with a ±1.5° idle jitter proportional to uncertainty, settling as the uncertainty shrinks.
- **Race call:** a 2.5s interstitial: the screen dims, a party-colored slab wipes in from the left (cubic-bezier .7,0,.2,1), a "CALLED" stamp drops with a scale-2→1 overshoot, then haptic and an optional soft "whoosh" (off by default).
- **LIVE indicators:** a 1.6s pulsing dot (`--live`), and a ticker at 40px/s that pauses on hover.
- **Map:** states fade their fill on update with a 1s glow ring ping at the changed state.
- **Reduced motion:** with `prefers-reduced-motion`, disable Ken Burns, jitter, interstitial wipes and odometers (swap to a crossfade).

### 3.5 Layout patterns
- **Mobile:**
  - Top HUD: a slim ticker plus a LIVE pill and clock.
  - The 100dvh feed.
  - A right reaction rail with 44px targets: 🔥 react, bookmark, share, "⇄ Other side".
  - A bottom balance dock: D seats | needle mini | R seats.
  - A tab bar: Feed / Map / Races / Polls / Brief.
- **Card anatomy (top → bottom):**
  - Source favicon stack and lean bar.
  - Kicker chip (e.g. `SENATE · PA` / `SCOOP` / `BLINDSPOT`).
  - Headline.
  - One-line lede.
  - Two Smart Brevity signposts.
  - Footer: timestamp ("3m ago"), read time, and "Swipe → for other sides".
- **Card types:**
  - Story cluster (default)
  - Live race (mini map + margin bar + % reporting)
  - Poll (spread chip + sparkline)
  - Key Race Alert
  - Long Read (serif)
  - Prediction/quiz
  - Daily Brief (5 items, Playbook voice)
- **Desktop console:** a 12-col grid. Panels have 1px `--line` borders, 12px radius and `backdrop-filter: blur(12px)` over `--bg-1` at 80% opacity. Panel headers use mono uppercase labels plus status LEDs.

### 3.6 Voice & microcopy
Punchy, plain and non-partisan. Examples: "Why it matters", "The other side says", "Too close to call", "Vote left to count: ~1.2M". Avoid editorializing in system labels, and always attribute race calls ("Call: AP" / "Call: Decision Desk").

---

## 4. Verified RSS/Atom feed table

Verified 2026-11-03 ~11:30 UTC via `curl -L` with a desktop UA through the proxy. "Items" is the `<item>`/`<entry>` count, and "Latest" is the first date found. **Img** shows whether items carry `media:content` / `media:thumbnail` / `enclosure` / `<img>` (useful for card art). The lean label is AllSides-style, using AllSides' published rating where known (otherwise the closest public consensus, marked *).

### 4.1 Working: recommended core set (mainstream political)
| Source | URL | Status | Items / Latest | Img | Lean |
|---|---|---|---|---|---|
| NPR Politics | https://feeds.npr.org/1014/rss.xml | ✅ 200 | 10 / Nov 3 | yes | Lean Left |
| Politico Politics | https://rss.politico.com/politics-news.xml | ✅ 200 | 30 / Nov 3 | yes | Lean Left |
| Politico Playbook | https://rss.politico.com/playbook.xml | ✅ 200 | 30 / Nov 3 | no | Lean Left |
| Politico Congress | https://rss.politico.com/congress.xml | ✅ 200 | 30 / Nov 2 | yes | Lean Left |
| The Hill Campaign | https://thehill.com/homenews/campaign/feed/ | ✅ 200 | 15 / Nov 3 | yes | Center |
| The Hill News (all) | https://thehill.com/news/feed/ | ✅ 200 | 15 / Nov 3 | yes | Center |
| Fox News Politics | https://moxie.foxnews.com/google-publisher/politics.xml | ✅ 200 | 25 / Nov 3 | rare | Right |
| Fox News Politics (legacy) | https://feeds.foxnews.com/foxnews/politics | ✅ 200 | 25 / Nov 3 | rare | Right |
| BBC US & Canada | https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml | ✅ 200 | 21 / Nov 3 | yes | Center |
| Guardian US Politics | https://www.theguardian.com/us-news/us-politics/rss | ✅ 200 | 17 / Nov 3 | yes | Lean Left* (AllSides: Left for opinion-heavy) |
| Guardian US News | https://www.theguardian.com/us-news/rss | ✅ 200 | 33 / Nov 3 | yes | Lean Left |
| NYT Politics | https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml | ✅ 200 (CORS `*`) | 33 / Nov 3 | yes | Lean Left |
| Washington Examiner | https://www.washingtonexaminer.com/feed/ | ✅ 200 | 10 / Nov 3 | yes | Lean Right |
| Washington Examiner Politics | https://www.washingtonexaminer.com/section/politics/feed/ | ✅ 200 | 10 / Nov 2 | yes | Lean Right |
| CBS News Politics | https://www.cbsnews.com/latest/rss/politics | ✅ 200 | 30 / Nov 3 | no | Lean Left |
| ABC News Politics | https://abcnews.go.com/abcnews/politicsheadlines | ✅ 200 | 25 / Nov 3 | yes | Lean Left |
| PBS NewsHour Politics | https://www.pbs.org/newshour/feeds/rss/politics | ✅ 200 | 20 / Nov 3 | yes | Lean Left |
| NBC News Politics | https://feeds.nbcnews.com/nbcnews/public/politics | ✅ 200 | 25 / Nov 3 | rare | Lean Left |
| New York Post Politics | https://nypost.com/politics/feed/ | ✅ 200 | 20 / Nov 3 | yes | Lean Right |
| RealClearPolitics | https://www.realclearpolitics.com/index.xml | ✅ 200 | 21 / Nov 3 | rare | Center |
| Semafor | https://www.semafor.com/rss.xml | ✅ 200 | 224 / Nov 3 | yes | Lean Left* (added 2024) |
| Punchbowl News | https://punchbowl.news/feed/ | ✅ 200 | 10 / Nov 3 | no | Center* |
| Roll Call | https://rollcall.com/feed/ | ✅ 200 | 10 / Nov 3 | yes | Center |
| Christian Science Monitor USA | https://rss.csmonitor.com/feeds/usa | ✅ 200 | 20 / Nov 3 | no | Center |
| UPI Top News | https://rss.upi.com/news/top_news.rss | ✅ 200 | 24 / Nov 3 | yes | Center |
| The Atlantic Politics (Atom) | https://www.theatlantic.com/feed/channel/politics/ | ✅ 200 | 25 / Nov 3 | rare | Left |
| TIME (all) | https://time.com/feed/ | ✅ 200 | 25 / Nov 3 | rare | Lean Left |

### 4.2 Working: perspective / opinion-heavy (to fill out Left & Right buckets)
| Source | URL | Status | Items / Latest | Img | Lean |
|---|---|---|---|---|---|
| Breitbart | https://feeds.feedburner.com/breitbart | ✅ 200 | 49 / Nov 3 | no | Right |
| Daily Wire | https://www.dailywire.com/feeds/rss.xml | ✅ 200 | 50 / Nov 3 | yes | Right |
| National Review | https://www.nationalreview.com/feed/ | ✅ 200 | 20 / Nov 2 | yes | Right |
| The Federalist | https://thefederalist.com/feed/ | ✅ 200 | 20 / Nov 2 | yes | Right |
| Daily Caller | https://dailycaller.com/feed/ | ✅ 200 | 25 / Nov 1 | ? | Right |
| Washington Free Beacon | https://freebeacon.com/feed/ | ✅ 200 | 20 / Nov 3 | yes | Right |
| The Blaze | https://www.theblaze.com/feeds/feed.rss | ✅ 200 | 30 / Nov 3 | ? | Right |
| Reason | https://reason.com/feed/ | ✅ 200 | 48 / Nov 3 | yes | Lean Right |
| The Dispatch | https://thedispatch.com/feed/ | ✅ 200 | 10 / Nov 3 | yes | Lean Right |
| Mother Jones Politics | https://www.motherjones.com/politics/feed/ | ✅ 200 | 10 / Nov 3 | rare | Left |
| Vox Politics (Atom) | https://www.vox.com/rss/politics/index.xml | ✅ 200 | 10 / Nov 2 | yes | Left |
| Slate News & Politics | https://slate.com/feeds/news-and-politics.rss | ✅ 200 | 25 / Nov 3 | yes | Left |
| HuffPost Politics | https://www.huffpost.com/section/politics/feed | ✅ 200 | 50 / Nov 2 | no | Left |
| The New Republic | https://newrepublic.com/rss.xml | ✅ 200 | 100 / Nov 3 | yes | Left |
| The Nation Politics | https://www.thenation.com/subject/politics/feed/ | ✅ 200 | 50 / Nov 3 | ? | Left |
| The Intercept | https://theintercept.com/feed/?lang=en | ✅ 200 | 20 / Nov 3 | ? | Left |
| The Daily Beast | https://www.thedailybeast.com/arc/outboundfeeds/rss/articles/ | ✅ 200 | 100 / Nov 2 | ? | Left |
| The New Yorker News | https://www.newyorker.com/feed/news | ✅ 200 | 25 / Nov 3 | ? | Left |
| ProPublica | https://feeds.propublica.org/propublica/main | ✅ 200 | 20 / Nov 3 | ? | Lean Left |
| Al Jazeera (all) | https://www.aljazeera.com/xml/rss/all.xml | ✅ 200 | 25 / Nov 3 | ? | Lean Left |
| DW World | https://rss.dw.com/rdf/rss-en-world | ✅ 200 | 11 / Nov 3 | ? | Center |
| Tangle (L/R/take newsletter) | https://www.readtangle.com/rss/ | ✅ 200 | 15 / Nov 2 | yes | Center |

### 4.3 Working: elections/data specialists
| Source | URL | Status | Items / Latest | Lean |
|---|---|---|---|---|
| Silver Bulletin (Nate Silver) | https://www.natesilver.net/feed | ✅ 200 | 20 / Nov 3 | Center* |
| Ballotpedia News | https://news.ballotpedia.org/feed/ | ✅ 200 | 20 / Nov 3 | Center |
| Votebeat (election admin) | https://www.votebeat.org/arc/outboundfeeds/rss/ | ✅ 200 | 100 / Nov 3 (includes Spanish items; filter by language) | Center* |
| RCP (feedburner mirror) | https://feeds.feedburner.com/realclearpolitics/qlMj | ✅ 200 | 39 / Nov 2 | Center |

### 4.4 Google News RSS (free, keyless, best wildcard)
All return 200, `application/xml`. Item `<link>`s are **news.google.com redirect URLs** (`/rss/articles/CBMi...`). The real publisher name is in `<source url="...">` and appended to the title (" - The Texas Tribune"), so **strip the " - Source" suffix and map `source@url` to a lean label**. There are no images. Always add `&hl=en-US&gl=US&ceid=US:en`. Use specific queries: a bare `election 2026` returned an Australian (Victorian) election item first.

| Query | URL | Items |
|---|---|---|
| Politics topic | https://news.google.com/rss/headlines/section/topic/POLITICS?hl=en-US&gl=US&ceid=US:en | 48 |
| Midterms | https://news.google.com/rss/search?q=midterms&hl=en-US&gl=US&ceid=US:en | 100 |
| Midterm results (last 24h) | https://news.google.com/rss/search?q=midterm+results+when:1d&hl=en-US&gl=US&ceid=US:en | 79 |
| Election 2026 | https://news.google.com/rss/search?q=election+2026&hl=en-US&gl=US&ceid=US:en | 63 |
| **AP proxy** | https://news.google.com/rss/search?q=site:apnews.com+politics&hl=en-US&gl=US&ceid=US:en | 100 (Lean Left) |
| **Reuters proxy** | https://news.google.com/rss/search?q=site:reuters.com+election&hl=en-US&gl=US&ceid=US:en | 100 (Center) |
| **Axios proxy** | https://news.google.com/rss/search?q=site:axios.com+election&hl=en-US&gl=US&ceid=US:en | 100 (Lean Left) |
| **WaPo proxy** | https://news.google.com/rss/search?q=site:washingtonpost.com+election&hl=en-US&gl=US&ceid=US:en | 100 (Lean Left) |
| Per-race (pattern) | `https://news.google.com/rss/search?q=%22Pennsylvania+Senate%22+when:1d&hl=en-US&gl=US&ceid=US:en` | n/a |

### 4.5 Failed / unusable (don't ship)
| Source | URL tried | Result |
|---|---|---|
| Washington Post | https://feeds.washingtonpost.com/rss/politics (and /national) | ❌ 502 → use the GNews proxy |
| Axios | https://api.axios.com/feed/ , /feed/politics , axios.com/feeds/feed.rss | ❌ 403 → use the GNews proxy |
| AP | https://apnews.com/politics.rss , /hub/politics/rss | ❌ 403 → use the GNews proxy |
| Reuters | reutersagency.com best-topics feed | ❌ 404 → use the GNews proxy |
| CNN Politics | http://rss.cnn.com/rss/cnn_allpolitics.rss | ⚠️ 200 but **stale (Dec 2022)** |
| USA Today | rssfeeds.usatoday.com/usatodaycomwashington-topstories | ❌ 402 |
| Newsweek | newsweek.com/rss , /rss.xml | ❌ 404/406 |
| Washington Times | washingtontimes.com/rss/headlines/news/politics/ | ❌ 403 |
| Time Politics section | time.com/section/politics/feed/ | ❌ returns HTML (use time.com/feed/) |
| Daily Caller politics section | dailycaller.com/section/politics/feed/ | ❌ 404 (use dailycaller.com/feed/) |
| C-SPAN, Newsmax, OANN, Townhall, Sabato's Crystal Ball, 1440, RealClearPolling, 538, MSNBC | various | ❌ 403/404/HTML/timeout |
| Cook Political | cookpolitical.com/rss.xml | ⚠️ 200 but stale (Jun 2024) |
| Split Ticket | splitticket.org/feed/ | ⚠️ 200 but stale (Oct 2025) |

### 4.6 Ingestion notes for the server team
- **Server-side only.** Browser fetches fail CORS for nearly every feed. Fetch in `server/` with a desktop-ish `User-Agent` (some origins 403 on blank UAs), follow redirects, and use 15–20s timeouts.
- **Polling:** use 2–5 min normally and 60–90s on election night for Politico/NYT/Hill/Fox/NPR/GNews results. Respect `ETag`/`Last-Modified` (send `If-None-Match`). Cache the parsed JSON in memory with a TTL.
- **Parsing:** feeds mix RSS 2.0, Atom (Atlantic, Vox, Votebeat) and RDF (DW). Use `fast-xml-parser` or `rss-parser` (npm, no key). Normalize to `{id, title, link, source, lean, publishedAt, summary, image}`.
- **Images:** check `media:content@url`, then `media:thumbnail@url`, then `enclosure@url`, then the first `<img src>` in `content:encoded`/`description`. If none is found, fall back to a generated gradient card with a party/lean tint.
- **Dedup and cluster:** normalize titles (lowercase, strip punctuation, drop stop-words). Cluster when token Jaccard is ≥0.35 within 12h, or use a shared link canonical. The cluster's lean distribution feeds the bias bar and the Blindspot logic.
- **Sanitize** HTML in descriptions (DOMPurify on the client or `sanitize-html` on the server), and always link out to the publisher (fair use: headline + short snippet + link).
- **Balance check:** the core set already spans all buckets. Left: Atlantic, Vox, Slate, HuffPost, Mother Jones. Lean Left: NYT, NPR, Politico, CBS, ABC, NBC, PBS, Guardian. Center: Hill, BBC, RCP, Roll Call, CSM, UPI, Tangle. Lean Right: Wash Examiner, NY Post, Reason, Dispatch. Right: Fox, Breitbart, Daily Wire, NR, Federalist, Free Beacon.

---

_Sources consulted:_ Semafor "What is a Semaform" (semafor.com, Oct 2022); CJR Semafor launch review; Nieman Lab on story-structure deconstruction; journalism.co.uk and CJR on Axios Smart Brevity; Washingtonian, Poynter and Nieman Lab on Politico Playbook; punchbowl.news pricing and The Vault pages; CJR on Punchbowl; Ground News help center, CJR "The business of balance", and MBFC on Ground News; TechCrunch and TechRadar on Particle; Engadget and TechCrunch on the Artifact shutdown; Reuters Institute on the NYT Needle; AllSides source pages (Axios, NPR, The Atlantic, PBS NewsHour, RealClearPolitics aggregator) and the AllSides Media Bias Chart blog; Digiday "news organizations prepare for the TikTok election"; Tubefilter on TikTok's news plateau. Feed status from direct curl tests on 2026-11-03.
