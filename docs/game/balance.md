# QUORUM balance notes

## v2 pass (save version 2): current numbers
The bots in `tests/game-engine.test.mjs` were updated for v2. The smart bot keeps the cabinet filled with `suggestCabinet`, answers each debate with its best expected value (gain x (1 - risk), minus a backfire penalty, plus PC and wing effects), and attaches an amendment when a bill is forecast to fail and whipping cannot save it. It calls a leadership ballot only at 70%+ odds and otherwise cuts a deal; it buys off defectors when it has 2 PC; and it scores event choices on approval, treasury, wings and PC. The random bot picks uniformly from `listAvailableActions`, which now includes appoint, dismiss, debate and amend.

**Sandbox, Normal (seeds 1..300, ideologies rotated):**

| Bot | Win (in government at end) | Coalition governments (share of elections) | Lost | Avg score | Avg seats |
|---|---|---|---|---|---|
| Random | **10%** (mostly junior partner) | **28%** (21% rival-only, 7% you as junior) | 1% | 178 | 12.6 |
| Smart | **67%** (57% minority, 6% leading a coalition, 4% junior) | **44%** (22% you leading, 11% rival-only, 10% you as junior) | 0% | 356 | 21.0 |

Targets: smart 60-72%, random under 20%, coalitions after 25-45% of elections. `npm test` reruns 200 random and 100 smart games; on seeds 1..100 it reads smart 66%, random 9.5%, coalitions 44.5% / 26.9%.

v2 drama per game (smart / random): 1.9 / 1.4 scandals, 1.8 chain follow-ups / 1.3, 13.4 / 2.2 debates won. Defections and leadership challenges happen almost only to careless play (random: 0.15 defections per game, about 1% ousted). A smart player who keeps the cabinet filled and the wings fed rarely sees them.

**By scenario (Normal, 100 games each) and difficulty (Sandbox, 100 games each):**

| Setting | Smart win | Random win | Smart goals done |
|---|---|---|---|
| Snap Election | 81% | 7% | 30% |
| Debt Crisis | 55% (6% bankrupt) | 5% (14% bankrupt) | 64% |
| Insurgent Party | 54% | 6% | 77% |
| Story | 92% | 33% | n/a |
| Normal | 67% | 10% | n/a |
| Hard | 43% | 6% | n/a |
| Ironclad | 33% | 4% | n/a |

### What v2 changed, and why
Ablations at the start of the pass (rival approval 50): full smart bot 91%; without debates 68%; without the cabinet 63%; without both 48%. Each system was worth about 20 points, so both were cut back and the rivals strengthened.

| Knob | v1 | v2 | Why |
|---|---|---|---|
| `RIVAL_DEFAULT_APPROVAL` | 46 | **52** | The cabinet, debates, wing-aware drafting and 17 new laws made skilled play much stronger. This puts the smart bot back at about two games in three and drops the random bot from 16% to 10%. |
| Debates | n/a | **1 AP, offered on 60% of turns**; measured lines give no PC; Herald x1.25 | As free actions every turn they added about 23 points of win rate. Now each one is an AP trade-off against courting. |
| Cabinet | n/a | Purse +5/turn, Interior/Commons +0.25 approval, Whip +0.34 PC/turn | First values (+8, +0.5, +0.5) added about 28 points. |
| `RIVAL_PACT_CHANCE` (Normal difficulty) | 0.16 | **0.14** | Keeps total coalitions under 45% now that player-led coalitions are more common. |
| `COALITION_DIST` | 0.7 | **0.4** | A Hearth party's natural partner (0.41 away) now has to be lobbied to friendly. This cut player-led coalitions from 28% to 22% of elections. |
| `BLAME_SEAT_LOSS` | 2 | **1** | Rivals you eat into cool on you sooner. A small effect, but in the right direction. |
| Amendment support | n/a | +0.16 to +0.30 per template | At +0.08 to +0.22, only 38% of offered amendments moved any vote. Now 67% do, and 48% turn a failing bill into a passing one. The ranking also prefers blocs near the YES line. |
| Insurgent | n/a | campaigns x1.25 (was x1.5); rivals +2 approval | At first the insurgent won 76%, easier than the sandbox. |
| Snap Election | n/a | incumbency: +8 on the top 3 groups, 1 campaign in every region | Without it the caretaker lost the snap vote almost every time (about 15 seats). |
| Difficulty rival approval | n/a | Story -4, Hard +2, Ironclad +4 | +3 and +6 made Hard 34% and Ironclad 19%. |

### v2 levers if it plays too easy or too hard
- `DEBATE_CHANCE`, `DEBATE_AP`, `HERALD_DEBATE_BONUS`: debates are the biggest skill lever.
- `PURSE_INCOME`, `CABINET_APPROVAL`, `WHIP_PC_RATE`, `SHADOW_FACTOR`: cabinet strength.
- `WING_REBEL_AT` / `WING_REVOLT_AT` / `WING_REBEL_FACTOR`: how hard neglecting your wings bites.
- `CHALLENGE_*`, `DEFECT_*`, `SCANDAL_MULT`: how often party crises fire.
- Per-difficulty values live in `content.json` (`difficulties`); scenario rules live in `meta.ts` (`resolveMods`) and `engine.ts` (`newGame`).

---

## v1 notes (kept for history)

All constants live in `src/features/play/engine/constants.ts`. The smoke test (`tests/game-engine.test.mjs`, last test) prints the current numbers on every `npm test` run.

## Bots used for tuning
- **Random bot:** picks a random valid action each step and ends the turn at random. It is a floor, not a player.
- **Smart bot ("reasonable player"):** takes the event choice with the better approval/treasury sum, drafts the affordable law that is forecast to pass and pleases its groups most, whips close votes, votes NO on costly rival bills when the budget is tight, campaigns in the three biggest regions, courts its top groups, and accepts any government it can join.

## Current results (seeds 1..300, ideologies rotated)
Measured with the bots from the test file. `npm test` reruns 200 random and 100 smart games and checks the ranges below. That run uses seeds 1..100 for the smart bot, so its win rate reads a few points higher (about 74%).

| Bot | Games | Win (in government at end) | Coalition government formed | Opposition | Lost (bankrupt/collapse/dissolved) | Avg score |
|---|---|---|---|---|---|---|
| Random | 300 | **16%** (15% junior, 1% other) | **38% of elections** (21% rival-only, 14% you as junior, 2% you leading) | 76% | 8% (7% bankrupt) | 210 |
| Smart | 300 | **69%** (67% minority, 2% coalition) | **39% of elections** (23% you leading, 10% rival-only, 6% you as junior) | 31% | 0% | 332 |

Before this pass (same bots, 200 games each):

| Bot | Win | Coalition government formed | Rival-only coalitions |
|---|---|---|---|
| Random | 20.5% | 20% of elections | 0% (never) |
| Smart | 81.5-85% | 36% of elections, all led by the player, and almost none survived to the end (2%) | 0% (never) |

Targets: a sensible player governs about two games in three; a careless one about one in five or fewer; a coalition (of any kind) forms after 25-40% of elections, and the player sits in coalition talks (leading them or receiving an offer) after about a third (random) to three quarters (smart) of elections.

Each era now feels distinct (smart bot, 60 games):

| Era | Events that belong to this era | Rival bills from this era's new laws |
|---|---|---|
| Lamp (1) | 29% (was 14%) | 100% |
| Smokestack (2) | 46% (was 27%) | 92% (was 69%) |
| Signal (3) | 53% (was 37%) | 97% (was 46%) |

## Coalition rules (as built, this pass)
Before, every pair of rivals was 1.33 or more apart and the acceptance limit was 1.1, so two rivals could never govern together. Worse, the player's nearest rival accepted at any relation of neutral or better, so the result was always "minority government" or "the player plus their natural partner".

- **Player <-> rival:** a rival tolerates a policy gap of `COALITION_DIST + COALITION_REL_STEP * relation` = 0.7 + 0.35 x relation. So a hostile rival tolerates 0, cool 0.35, neutral 0.7, friendly 1.05, and an ally always accepts. Hawks still refuse any partner with social above 0.4 (`HAWK_SOCIAL_LIMIT`), even an ally.
- **Blame (`BLAME_SEAT_LOSS` = 2):** at an election where the player gains seats, every rival that loses 2 or more seats drops one relation step. Your natural partner (0.2 to 0.41 away) turns cool, then hostile, if you keep eating its vote. Lobbying before the election is how you keep a partner, and the coalition screen tells you how far you need to lobby.
- **Rival pacts (`RIVAL_PACT_CHANCE` = 0.16, `RIVAL_COALITION_DIST` = 1.6):** at each election, each rival pair within 1.6 rolls once to see whether its talks succeed this term. The result is stored in `state.rivalPacts`, so previews are deterministic. In practice that means Harbor + Iron Crown (1.56) and Harbor + Glass (1.53); Iron Crown never sits with the progressive Glass Circle.
- **Formation order:** a party with 37 or more seats governs alone. Otherwise the largest party tries first. If a rival leads and finds no majority, the player gets the next try when an acceptable majority exists. If the player passes, a rival pact that reaches 37 takes power and the player goes into opposition. Only if no majority exists does the largest party govern alone. `fallbackGovernment(s)` shows the UI what passing would lead to.
- Engine API: `coalitionTerms(s)` / `coalitionStance(s, leader, cand)` return `accepts` plus human-readable `reasons`. The UI no longer re-implements the rule.

## What we changed from the first pass, and why
| Knob | GDD / first value | Now | Why |
|---|---|---|---|
| Approval drift target | toward 50 | toward the party's **starting (ideological) approval** (`approvalBase`) | Drifting to 50 lifted every far-away group for free, so even the random bot won 43%. |
| `APPROVAL_DRIFT` | 0.05 | 0.08 | Courted gains fade faster, so courting is upkeep, not a one-way ratchet. |
| Court gain | +5 | +5, or **+2 once approval is 75+** (`COURT_SOFT_CAP`) | Smart play pushed core groups to 95+, and squared approval made that unbeatable. |
| `CAMPAIGN_BOOST` | 0.06 per campaign | 0.03 | Campaigns stack until the election; 0.06 per stack was +30-50% of a region's raw score. |
| `RIVAL_DEFAULT_APPROVAL` | 30 | 43 | At 30 rivals were three thin single-issue parties and the player was the largest party almost every time. |
| Rival courting (new) | none | each turn each rival gets +4 (`RIVAL_COURT_GAIN`) with the group within 0.9 of its axis where the player out-polls it most | Gives the AI a counter-move to the player's courting. |
| `FOUNDING_FACTOR` (new) | n/a | 0.55 | The new party's attraction at the founding assembly is cut, so it starts small (about 8 seats), as Comeback and the founding fantasy assume. |
| `RIVAL_DEFAULT_APPROVAL` (pass 2) | 43 | 46 | With rival pacts in place, this sets the smart bot's win rate (about -4 points of win rate per +1). It also keeps the careless bot under 20%. |
| `ERA_EVENT_WEIGHT` (new) | 1 | 2.5 | Era-specific events had a 1-in-7 share in the Lamp Era. Now each era's own crises dominate. |
| `RIVAL_NEW_LAW_BONUS` (new) | 0 | +0.2 fit | In the Signal Era, rivals were still re-tabling Lamp-era bills (54% of their bills). Now they push the new agenda. |

## Rules the GDD left open (as built)
- **Silver Seam (`windfall`):** Nationalize gives +30 now plus royalties of +5 per turn for 4 turns. Auction gives +20 now and economy +2.
- **Corvane Border Line (`border_wall`):** while it is in force, the Corvane Skirmish event has half the weight, and "Reinforce" costs no treasury.
- **Thinking Loom retraining fund (`ai_rumor`, first choice):** -12 now, then economy +1 and laborers +1 each turn for 3 turns.
- **Founding:** turn 1 begins with a founding election, so all 72 seats are filled.
- **Campaign cost:** 10 treasury in government, 10 party funds in opposition (section 7 wording).
- **Debt:** a surplus above 60 treasury is paid against debt automatically.
- **Win:** being in government after the final election, in any form (`majority`, `coalition`, `minority` or `junior`). `opposition` is a finish but not a win.
- **Minority governments** remain the smart bot's most common win, but they are now at risk: if a rival pact can reach 37, passing on coalition talks hands them power. Bills from a minority government still have to pass the floor.

## Known levers if it plays too easy or too hard
- More or fewer coalitions: `RIVAL_PACT_CHANCE` (each +0.03 adds about 3 points of rival-only coalitions and costs the smart bot about 3 points of win rate). `COALITION_DIST` barely matters for natural partners, which sit 0.2 to 0.41 away; `COALITION_REL_STEP` and `BLAME_SEAT_LOSS` do.
- To make it harder: raise `RIVAL_DEFAULT_APPROVAL` (each +1 costs the smart bot about 3-4 points of win rate), or raise `RIVAL_COURT_GAIN`.
- To make it easier: lower `APPROVAL_DRIFT` or raise `COURT_SOFT_CAP`.
- If bankruptcy is too rare for careless play, lower `BASE_INCOME` or raise `BASE_EXPENSES`.
