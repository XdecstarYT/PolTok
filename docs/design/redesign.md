# PolTok redesign: "Ledger"

Design brief for the November 2026 visual redesign. It covers the audit, the new direction, and the rules every page should follow. Tokens live in `src/styles/tokens.css`. Shared components live in `src/components` and `src/styles/global.css`. The five themes override token values in `src/styles/{broadcast,paper,terminal,aurora}.css`.

## 1. Audit (before)

Screenshots were taken at 390 and 1280 px of Home, Live, House, Governors, News, AU, NZ, World, Members, Candidates, 2028, Updates, Ask and Menu.

| Problem | Where | Effect |
|---|---|---|
| Too many signal colours: lime, cyan, amber, hot pink and neon party colours, all with glows | Everywhere | Nothing stands out because everything shouts. Party colours compete with UI chrome. |
| Monospace, letter-spaced caps for almost every label | Kickers, stats, panel titles, tickers | Reads as a terminal, not a newsroom. It is also hard to scan, and AA contrast is marginal at 9 to 10 px. |
| Busy backdrop: dot grid, scanlines and three light leaks, on a slow animation loop | `body::before/::after` | Visual noise behind data and constant repaint cost. |
| Crowded top bar: lime Menu button, italic glowing logo, 7 links, clock, LIVE, bell, gear, search | Shell | No clear brand anchor. The Menu button competes with the logo. |
| "More" menu was one long flat list of 22 items | Shell | Hard to find things. |
| No consistent page header. Each page invented its own kicker, h1 size and stat box | All routes | The site feels like many different products, and there are no breadcrumbs or other wayfinding. |
| Home leads with a glowing gradient box, followed by eight equal-weight strips before the news | Home | No front-page hierarchy, and the big story is buried. |
| Floating lime gradient "Ask" FAB overlapping content | Global | It is the loudest object on every page. |
| Card treatments were inconsistent (glass, blur, inner glows) | Cards | Muddy surfaces, and blur is expensive on mobile. |

## 2. Direction

The site should feel like an election-night data desk at a serious newspaper: calm ink surfaces, editorial serif headlines, tabular sans numerals, and colour reserved for meaning.

- **Party colour is the only loud colour.** UI chrome is neutral ink. The brand chartreuse (`--accent`) marks only three things: the primary CTA, the active nav marker and selected tabs.
- **Editorial type pairing.** Newsreader (serif) sets page titles, section titles, the hero and story headlines. Inter Tight sets UI headings and figures. Inter sets body text and labels.
- **Rules, not boxes.** Sections are separated by hairline rules and whitespace. Cards are used for interactive or grouped objects only.
- **One wayfinding system.** A clear top nav with a grouped "More" mega-menu, a bottom tab bar on mobile, and the same `PageHeader` with breadcrumbs on every key page.
- **Command stays the default.** The other four themes keep their personality by overriding tokens rather than restyling components.

## 3. Tokens

### Type scale (minor third, fluid at the top)

| Token | Size | Use |
|---|---|---|
| `--fs-2xs` | 10.5px | Dense chart labels only |
| `--fs-xs` | 11.5px | Kickers and caps labels (700, `--tracking-caps` 0.08em) |
| `--fs-sm` | 13px | Meta text, captions |
| `--fs-md` | 15px | Body |
| `--fs-lg` | 17px | Lead paragraphs |
| `--fs-xl` | 21px | Card titles |
| `--fs-2xl` | 24 to 32px | Section titles (serif) |
| `--fs-3xl` | 30 to 48px | Page titles (serif) |
| `--fs-hero` | 40 to 92px | Home banner only |

Families: `--font-serif` (headlines), `--font-display` (UI headings), `--font-body`, `--font-data` (labels and figures, tabular) and `--font-mono` (code and keyboard hints only). `.num` and `.mono` now resolve to `--font-data`, so each theme can choose its own data face: Plex Mono in Paper and Terminal, Roboto Condensed in Broadcast.

### Spacing

The base unit is 4px: `--sp-1…--sp-16` = 4, 8, 12, 16, 20, 24, 32, 40, 48, 64. Page gutters are 16, 24 and 40px at <720, ≥720 and ≥1200px. Use `--section-gap` (40 to 72px) between home sections. The content max width is `--maxw` (1360px).

### Radii and elevation

| Token | Value | Use |
|---|---|---|
| `--radius-xs` | 4px | Badges, rating chips |
| `--radius-sm` | 8px | Buttons, inputs, tabs |
| `--radius` | 12px | Cards |
| `--radius-lg` | 16px | Overlays |
| `--elev-1` | | Resting state |
| `--elev-2` | | Hover, popovers |
| `--elev-3` | | Menus, modals |

Glows are now 1px rings (`--glow-*`). Neon blooms have been removed.

### Colour (Command), WCAG-checked

| Token | Hex | On `--bg` | On `--bg-3` |
|---|---|---|---|
| `--text` | #f3f5f9 | 18.0 | 15.0 |
| `--text-2` | #b7bfcd | 10.6 | 8.8 |
| `--text-3` | #8f98a8 | 6.8 | 5.6 |
| `--dem-glow` (dem text) | #7da7ff | 8.3 | 6.9 |
| `--rep-glow` (rep text) | #ff8394 | 8.4 | 6.9 |
| `--signal` (links) | #7cc0ff | 10.2 | 8.4 |
| `--live` (text, dots) | #ff4560 | 5.9 | 4.9 |
| `--live-fill` under white | #d01c3c | white 5.4 | |

`--text-4` is decorative only. The party fills `--dem` and `--rep` match `PARTY_HEX` in `lib/format.ts`. Use them as text only at 18px+ or in bold. For small party-coloured text, use the `*-glow` tints.

### Motion

| Token | Value | Use |
|---|---|---|
| `--dur-1` | 120ms | Hover |
| `--dur-2` | 200ms | Colour and position changes |
| `--dur-3` | 360ms | Panels |
| `--dur-4` | 640ms | Data bars |

The easing is `--ease-out` with no overshoot, except on toys. Page transitions are 6px and 260ms. Under `prefers-reduced-motion`, CSS animations collapse and Framer transitions are skipped through `useReducedMotion`. The ticker becomes static and pulses stop.

## 4. Component rules

- **Card** (`.card`, `<Card>`): solid `--card-bg`, 1px `--card-bd` and a top highlight, with no blur. For party emphasis, use `inset 0 3px 0 <party>` (a top rule) instead of borders or glows. Hover lifts by 1px and adds `--elev-2`.
- **Buttons**: `primary` (ink on text) is the default. Use `accent` for at most one CTA per view. `ghost` is a bordered secondary. Buttons are 40px tall (32 for sm, 48 for lg) with 8px radius. Labels are sentence case with no arrows in the text.
- **Tabs**: underline tabs use a 2px `--text` bar. `tabs--pill` is for segmented filters only.
- **Chips**: 26px pills that carry state or a party. `chip--live` uses `--live-fill`.
- **Tables** (`.pt-table`): caps header row, hairline rows, tabular numerals, right-aligned numbers (`.is-num`).
- **Stat tiles** (`<StatGroup><StatTile/></StatGroup>`): a hairline-divided strip with a caps label, a 24 to 34px tabular value and a truncating sub-line. Use `tone` only for party or live meaning.
- **Section header** (`<SectionHeader>`): a top rule in `--line-3`, a coloured kicker, a serif title, an optional standfirst and a right-aligned action.
- **Page header** (`<PageHeader>`): breadcrumbs, then the kicker, serif h1, standfirst and meta line, with an optional `aside` for stats or controls and `children` for a sub-nav. Use it on every top-level page.
- **Empty, loading and error states**: `<EmptyState>` is a dashed bordered panel. `<ErrorState>` is the danger-tone version with a "Try again" action. `<Skeleton>` shimmers, and the shimmer becomes static under reduced motion. Never show fake or simulated data while loading.

## 5. Information architecture

- **Top nav** (desktop): Home, Live, Map, News, Races, Polls, Forecast, Australia, World, Feed. Links that do not fit collapse into **More**, which is a four-group mega-menu (US 2026 results, Around the world, People & lawmaking, Tools) plus "See every section".
- **Mobile**: compact top bar (logo, LIVE, search, alerts, settings) and a 5-tab bottom bar (Home, Live, Map, News, Menu). The active tab gets a filled indicator.
- **Breadcrumbs** are derived from the URL in `useCrumbs()`. Detail routes point to their parent: race → Races, story → News, member → Members, and so on.

## 6. Themes

Each theme overrides tokens and adds a small set of chrome rules:

- **Command** (default): ink and chartreuse, as described above.
- **Broadcast**: navy and red with Oswald caps, a red underline, a yellow active bar and a white crawl.
- **Paper**: newsprint with Playfair, double rules, an ink CTA and Plex Mono data.
- **Terminal**: black and amber with Plex Mono, square corners and an inverted active nav.
- **Aurora**: a glass mesh with Space Grotesk, a gradient nav marker and gradient page titles.

## 7. Rollout notes (part A, Nov 2026)

- **Every route uses `PageHeader`** with breadcrumbs: Map, Polls, Forecast, Races, race and state pages, Feed (in the desktop side panel), Parliament and bills, Money, Calendar, Quiz, Compare, Flips, Ballot measures, Watchlist, Analysis, Replay, Search, Your area, Embed, story/topic/source pages, Australian sub-pages, NZ electorates, governor states, country pages and the 404. Profile pages (candidate, member) keep their photo hero under shared `Breadcrumbs`.
- `.pt-pagehead .pt-pagehead__title` guards family, size and margin, so page-level `.x-page h1` rules can no longer restyle the title.
- Pages render a `<div>` root: the Shell owns the only `<main>`.
- **Accent cleanup:** page CSS no longer uses `--accent`/`--terminal` for kickers, links, focus rings, progress bars or status text. Links and focus use `--signal`, kickers use `--kicker`, status and checks use `--text`, segmented "on" states use `--bg-3` plus a `--line-3` ring. `--accent` remains only on the primary CTA in a view.
- **Party colour as small text:** use `ink(hex)` from `lib/format`, which returns `color-mix(in srgb, hex 55%, var(--text))`. It lifts contrast on dark themes and darkens on Paper. Fills keep the raw hue. White labels on party fills sit on a 36 to 50% black scrim.
- **Theme contrast (WCAG AA):** Broadcast `--live` is now #ff707c and `--danger` #ff7a88. Aurora `--live` is #ff6ec4, `--accent-ink` #12062b, and the accent button uses a deeper gradient under white text. Paper `--tossup`/`--warn` is #735800. The feed keeps dark-surface tokens in Paper.
- **Share cards and video:** the card `display` family is Inter Tight (was Space Grotesk), and there is a new `news` family (Newsreader). It is used for headlines in the house designs (map spotlight, big number, story results, swing dial, head-to-head, poll trend, carousel, data table). There is also a "Ledger (site)" font pair. Brand-system font overrides still apply through `RT.display`/`RT.body`. Motion headings and strip text use Inter Tight.
- **Home:** `<LatestUpdateCard compact />` is a "What's new" strip under the hero. It replaces the old hard-coded list and keeps the Share on X and owner-only Publish to X actions.
