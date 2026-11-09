# QUORUM: The Calderra Ledger
Game design document v1. Route: `/play`. Feature folder: `src/features/play/`. Content: `docs/game/content.json`. Research: `docs/game/research.md`.

## 1. Pitch
The Republic of Calderra is a newly founded harbor republic. You found a party, pick its ideology and lead it through 24 turns spread over three eras: the Lamp Era, the Smokestack Era and the Signal Era. Each turn you campaign in regions, draft laws, whip a 72-seat Assembly where 37 votes passes anything, and answer crises. Six elections decide whether you govern, sit in coalition or watch from the opposition. Score comes from the laws you enacted, your seats and the state of the nation. A session runs 20 to 40 minutes, and it plays one-thumb on a phone or with a mouse on desktop.

Design pillars:
1. **Every vote is a nail-biter.** You always see the forecast tally before you roll the call.
2. **Small, readable numbers.** Approval runs 0 to 100. Effects are whole numbers, and each effect is previewed before you commit.
3. **Short and decisive.** 24 turns and three actions per turn, with no menus inside menus.

## 2. Core loop and turn structure
One turn is two in-game years. Elections fall every 4 turns (turns 4, 8, 12, 16, 20, 24). An era spans 8 turns.

Each turn has these phases:
1. **Briefing.** Income is collected. Approval drift is applied. Any event fires (60% chance per turn; turn 1 is guaranteed to have none).
2. **Event.** A card with 2 choices. You must resolve it before acting.
3. **Actions.** You get 3 Action Points (AP). Spend them on:
   - **Campaign** in a region (1 AP, 10 treasury when in opposition, party funds otherwise): +6 party support among that region's voters until the next election.
   - **Court a group** (1 AP): +5 approval with one group, and -2 with that group's "rival" group (the group whose axes are furthest from it).
   - **Draft a law** (1 AP): put an unlocked law on the docket (max 2 docket items).
   - **Lobby a rival** (1 AP, costs 2 Political Capital): +1 relation step with a rival party (hostile, cool, neutral, friendly, ally).
   - **Repeal a law** (1 AP): puts the repeal on the docket.
4. **Assembly session.** Every docket item goes to a roll call (section 5). AI rivals also propose 0 to 1 laws each turn.
5. **End of turn.** Budget resolves. Stats update. On an election turn, run the election (section 4). On an era-change turn, show the era interstitial.

AP rule: the governing party (or the senior coalition partner) gets 3 AP. A party in opposition gets 3 AP, but can draft only 1 docket item.

## 3. Groups and approval
There are 8 interest groups (`groups` in content.json). Each has a population share and a position on two axes, `economic` (-1 = left, +1 = right) and `social` (-1 = traditional, +1 = progressive).

`approval[g]` for your party (0 to 100) starts at:
`50 - 25 * dist(party, group)`, where `dist` is the Euclidean distance on the two axes divided by 2.83, which gives a value from 0 to 1. The result is clamped to 10..90.

Changes:
- **Law enacted that your party voted for:** `approval[g] += groupEffects[g]`. If you voted against, 25% of that value.
- **Event choice:** its `groupEffects`.
- **Drift each turn:** `approval += (50 - approval) * 0.05` (regression toward neutral).
- **Ideology betrayal:** voting YES on a law whose `axis` is more than 1.0 from your party's position costs -3 with every group within 0.5 of your party. This is the genre's "flip-flop" pressure.
- **Cynicism:** repealing a law you passed costs -4 with all groups, plus the law's effects reversed.
- **Stat feedback:** each turn, `economy < 40` gives -2 to merchants and laborers; `order < 40` gives -2 to guardians and elders; `environment < 30` gives -2 to greenward; `health < 40` gives -2 to elders.

National stats (0 to 100, all start at 50): economy, order, liberty, environment, health. A law's `stats` are applied once when it is enacted. Each stat drifts 1 per turn toward 50.

## 4. Elections and seat allocation
There are 72 seats across 8 regions (`regions[].seats`).

Party vote share in region r:
```
raw[p,r] = sum over g of mix[r][g] * attraction[p,g]
attraction[player,g] = (approval[g]/100)^2 + campaign[r]*0.06 (applies to all g in r)
attraction[rival,g]  = (rivalApproval[g]/100)^2
share[p,r] = raw[p,r] / sum over parties of raw
```
Squaring the approval rewards strong loyalty. Rival approval starts from `rivals[].base` (missing groups default to 30) and is updated by the rival AI (section 8).

Turnout noise: each party's share gets `* (1 + U(-0.04, 0.04))` before it is normalized.

**Seat allocation is D'Hondt within each region.** There is no threshold, except that a party below 5% in a region wins no seats there.

**Government formation:**
- A party with 37 or more seats governs alone.
- Otherwise the largest party proposes a coalition. The player picks partners from rivals with relation `neutral` or better, and the combined seats must reach 37 or more.
- An AI accepts if `relation >= neutral` and `axisDist(ai, player) < 1.1`, or if `relation = ally`.
- If no majority forms, a minority government runs, and its docket bills need 37 votes from anyone.
- Coalition partners vote YES on government bills unless the bill's axis distance from them is more than 1.2 (section 5).

## 5. Legislature votes
Each seat is a deputy, but seats vote by party bloc with defections.

Party P's support for bill B:
```
s = 1 - axisDist(P, B.axis) / 1.4
  + 0.25 if P is in the government and B is a government bill
  + 0.15 * relationStep(P, proposer)       (relationStep -2..+2)
  + 0.10 * (avg group effect for P's top-3 groups) / 10
```
- `s >= 0.55`: the bloc votes YES.
- `s <= 0.35`: NO.
- In between: ABSTAIN.

Defection: each seat in a YES bloc defects with probability `max(0, 0.6 - s) * 0.5`, and the reverse applies to NO blocs.

The player's own deputies vote with the player's choice. Exception: if a law costs more than 10 approval with a group the party relies on, then `floor(seats * 0.1)` rebels.

**Whip** (spend 1 Political Capital): turns one ABSTAIN bloc into YES, or removes the rebels from one bloc.

**Pass rule:** `YES > NO` and `YES >= 25` (a quorum). Laws marked `repealable:false` need 48 votes (a 2/3 majority).

**Forecast:** the UI shows the expected tally (no randomness) before the vote is called. The roll call then animates seat by seat.

**Political Capital (PC):** start with 3, maximum 8. Gain +1 per turn in government, +2 per election win, and from some events. Spend it on whip, lobby and some event choices.

## 6. Laws
There are 35 laws (`laws` in content.json), spread across 3 eras (12/13/10). Each law has:
- `upkeep`: treasury cost per turn. A negative value is revenue.
- `groupEffects`: approval deltas.
- `stats`: one-off national stat deltas.
- `axis` `[econ, social]`
- `oneOff`: treasury paid once when enacted.

Laws from earlier eras stay available. Some laws are mutually exclusive: `income_tax` and `flat_tax`, `harbor_tariff` and `open_ports`. Passing one auto-repeals the other.

Special effects, coded by id:
- `womens_vote`: turnout +6%, and the squared-approval term uses scholars at x1.2.
- `central_bank`: debt interest drops from 6% to 5%.
- `privatize_rail`: removes `rail_bond` upkeep.

## 7. Budget
- `treasury` starts at 100.
- Income per turn: `40 + economy * 0.4` (range 40 to 80).
- Base expenses per turn: 30, plus the sum of law upkeep.
- If treasury < 0, the deficit becomes debt. Debt interest is 6% per turn.
- If debt > 150, economy loses 3 per turn.
- **Bankruptcy:** debt > 300 ends the game (a loss).
- Party funds, used for campaigning while in opposition, run separately: start at 30 and gain `+seats * 0.5` per turn.

## 8. Rival AI
Rivals are rule-based and deterministic, apart from the dice in section 5. Each turn, each rival:
1. **Proposes** the unlocked, un-enacted law with the highest `fit = 1 - axisDist/1.4 + sum of its base-group effects/40`. It proposes with probability 0.5, or 0.8 if the rival is in government.
2. **Campaigns** in the region where it has the largest share gap to the player and is within 10%: +4.
3. **Drifts approval:** a group whose approval of the player rises by more than 5 this turn loses 2 with the rival nearest to that group, and the reverse also holds (a zero-sum feel).
4. **Adjusts its relation with the player:** +1 if the player voted YES on the rival's last bill; -1 if NO on a law in the rival's top category.

Rival styles:
- **hawk** won't ally with social > 0.4.
- **populist** demands one welfare-category law per term as its coalition price. If the term ends without one, relation -2.
- **technocrat** leaves the coalition if debt > 120.

## 9. Events
There are 28 events (`events`, with era 0 = any era). Each turn there is a 60% chance of an event.
- Weighted draw from events in the current or any era whose `condition` is met (e.g. `law:rail_bond` means that law is enacted). An event never repeats within 6 turns.
- Each choice applies `groupEffects`, `treasury`, `stats` and `politicalCapital`.
- The `defector` event adds +1 seat to the player and -1 seat to the largest rival.
- The `foreign_loan` event adds a 5-per-turn upkeep for 6 turns.

## 10. Eras
Era changes after turns 8 and 16. Each interstitial screen shows a title, the year range, the newly unlocked laws (with a reveal animation) and an era score summary. Each era also shifts group population shares:
- Era 2: laborers +0.03, growers -0.03.
- Era 3: scholars +0.03, elders +0.02, growers -0.02, chapel -0.03.
Renormalize the shares after each shift.

## 11. Win / lose and score
- **Lose immediately** on bankruptcy (debt > 300), or if any stat stays at 0 for 2 turns (collapse).
- **Lose at the end** if you win fewer than 8 seats in two consecutive elections (party dissolved).
- **End** after turn 24.

Final score:
```
score = 10 * lawsEnactedAsProposer + 2 * sum(seats over 6 elections)
      + 50 * turnsInGovernment/24 + (sum(stats)-250)
      - debt/5
```

Rank titles by score: Backbencher (<100), Whip (100+), Minister (200+), First Speaker (300+), Founder of the Republic (400+).

Achievements (8):
- Unanimous: a vote with 0 NO.
- Kingmaker: in coalition for 3 terms.
- Balanced Books: debt 0 at the end.
- Green Republic: environment above 80.
- Iron Majority: 40+ seats.
- Comeback: from fewer than 10 seats to government.
- Clean Hands: never whipped.
- Long Memory: never repealed a law.

## 12. Screens (wireframes)
All screens are a single column at 390px. Desktop at 1024px or wider uses 2 columns: a main panel plus a side rail.

1. **Title** (`/play`): game logo wordmark, Continue (if a save exists), New Game, How to Play, sound toggle. The background is an animated hemicycle of 72 dots.
2. **Party Founding**: name input (max 24 chars), color swatches (6), ideology cards (3 presets plus Custom, which is a 2D drag pad), and a live preview of starting approval bars by group. Button: "Found the Party".
3. **Dashboard (main turn hub)**:
   - Top bar: turn/era, treasury, debt, PC, AP pips.
   - Hemicycle of 72 seats, colored by party.
   - Group approval bars (8 rows, icon plus number plus trend arrow).
   - Stat chips (5).
   - Action buttons: Campaign, Court, Draft, Lobby.
   - Bottom: an "End Turn" sticky button.
   - Desktop: the right rail holds the docket plus the news ticker.
4. **Map**: an 8-region stylized SVG made of hex or blob shapes. Tap a region for its seats, mix and leading party, plus a Campaign button.
5. **Law Library**: tabs by category, filters for era and enacted state. Each law card shows its effects, with green/red deltas per group, upkeep and the axis dot. Buttons: Draft / Repeal.
6. **Assembly Vote**: a hemicycle with a forecast tally bar against the 37 line. The bloc list shows each stance and a Whip button. "Call the Vote" animates the seats filling in order. The result stamp reads PASSED or FAILED.
7. **Event Modal**: a card with a title, text, and 2 choice buttons, each listing its effects.
8. **Election Night**: regions report one by one (0.6 s each). Bars race. The seat count ticks up. Then the coalition builder: drag or tap partners until 37 or more.
9. **Era Interstitial**: era name, years, unlocked laws.
10. **Game Over / Summary**: score, rank title, achievements, a seats-over-time sparkline, and the timeline of laws. Buttons: New Game, Share (copies a text summary).
11. **Settings sheet**: sound volume, reduce motion, reset save.

## 13. UX flow and tutorial
Flow: Title, then Founding, then Turn 1 Dashboard. From there the loop is [Event, Actions, Assembly, End Turn], with Election Night every 4 turns and the Era interstitial at turns 8 and 16. After that comes the Summary.

Tutorial (first game, skippable): coach marks on turn 1 only, five steps:
1. Approval bars ("These 8 groups vote").
2. Draft a law. It suggests the highest-fit law.
3. Assembly forecast plus Whip.
4. End Turn and budget.
5. A 'First election in 3 turns' hint.

After that, a "?" opens context help on any number. Every number has a tooltip showing its formula inputs.

Persistence: localStorage key `poltok.quorum.save.v1` holds the full state JSON, autosaved at end of turn and after each vote. The key `poltok.quorum.meta.v1` holds best score and achievements. Each read is wrapped in try/catch, and a failed read falls back to a new game.

Accessibility: tap targets of 44px or more; everything reachable by keyboard; `prefers-reduced-motion` turns the animations into instant changes; colors are paired with icons and numbers, never color alone.

## 14. Theming
Use only PolTok tokens: `--bg`, `--bg-1..3`, `--text`, `--text-2..4`, `--line`, `--accent`, `--radius*`, `--shadow`, `--btn-bg/fg/bd`, `--live`, `--breaking`, `--signal`.

Party colors are game data, but each is rendered with an outline of `--line-2` so it reads in all 5 `[data-ui]` themes.
- Terminal theme: a monospace tally.
- Paper theme: the hemicycle as ink dots.
- Broadcast theme: the election night ticker uses `--breaking`.

## 15. Juice
- Seats pop in with a scale-and-overshoot.
- The vote tally counter rolls.
- "PASSED" stamps on with a rotate-and-thud. "FAILED" makes the card shake.
- Approval deltas float up as +/- numbers.
- The treasury coin spins on income. Debt glows red past 150.
- On election night, regions flash the winner's color, and the confetti color matches the party when you hit 37.
- The event card flips in.
- An era change does a paper-wipe transition.
- Haptics: `navigator.vibrate(10)` on vote results, where supported.

## 16. Audio (procedural WebAudio only)
Create one `AudioContext` lazily on the first user gesture. Master gain is 0.4. Mute is persisted.

| Sound | Recipe |
|---|---|
| Click | 2 ms noise burst through a bandpass at 2 kHz |
| Gavel | 80 Hz sine with a pitch drop to 40 Hz over 120 ms, plus a noise click |
| Yes / No ticks | 880 Hz triangle (YES) or 220 Hz square (NO), each 30 ms, one per seat, rate-limited to 1 per 25 ms |
| Passed | Major arpeggio C-E-G-C, triangle, 90 ms each |
| Failed | Minor second down, sawtooth plus lowpass |
| Election night bed | Low drone from two detuned sines at 55/55.4 Hz plus a filtered noise pulse every 1 s |
| Coin | Two sine pings at 1320/1760 Hz |
| Era change | A slow 4-note chord swell |

No samples and no external assets.

## 17. Build scope and state
Suggested file layout in `src/features/play/`:
- Engine: `engine/{state.ts,approval.ts,election.ts,vote.ts,budget.ts,ai.ts,events.ts,rng.ts}`. The engine is pure functions with a seeded RNG (mulberry32, seed stored in the save) so it is testable.
- Content: `content.ts`, imported from the JSON.
- UI: `ui/*`, `audio.ts`, `PlayPage.tsx`, `play.css`.
- The state is one `GameState` object updated by a `useReducer`.

Approximate size: engine ~900 LOC, UI ~1500 LOC.

## 18. What we took from the genre vs what is original
**Taken (genre conventions):**
- Founding a party with an ideology.
- Proportional elections by region.
- A legislature with coalition votes and whipping.
- Interest groups whose approval moves with policy (a common idea since Democracy).
- Cynicism and flip-flop penalties.
- Budget and bankruptcy as a fail state.
- Random crisis events with choices that each carry a cost (Suzerain-like).
- Era progression unlocking new laws.

**Original to Quorum:**
- The fictional Republic of Calderra, with all of its regions, groups, rivals, laws, events, characters and text.
- Squared-approval attraction.
- The 2-axis distance vote model with a forecast tally and a seat-by-seat roll call.
- The 3-AP turn on a 24-turn fixed arc.
- The rival archetypes: hawk, populist and technocrat, each with a coalition price.
- Political Capital as a whip and lobby currency.
- Era population shifts.
- Procedural-audio election night.
- A design tuned for 20 to 40 minute phone sessions.

Nothing here reproduces Lawgivers II's map, countries, UI, text or systems detail. No gerrymandering editor, no electoral-system switching, no real-world countries.
