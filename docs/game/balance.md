# QUORUM balance notes

All constants live in `src/features/play/engine/constants.ts`. The smoke test (`tests/game-engine.test.mjs`, last test) prints the current numbers on every `npm test` run.

## Bots used for tuning
- **Random bot:** picks a random valid action each step and ends the turn at random. It is a floor, not a player.
- **Smart bot ("reasonable player"):** takes the event choice with the better approval/treasury sum, drafts the affordable law that is forecast to pass and pleases its groups most, whips close votes, votes NO on costly rival bills when the budget is tight, campaigns in the three biggest regions, courts its top groups, and accepts any government it can join.

## Current results (seeds 1..N, ideologies rotated)
| Bot | Games | In government at end (win) | Coalition (lead + junior) | Opposition | Lost (bankrupt/collapse/dissolved) | Avg score | Avg final seats |
|---|---|---|---|---|---|---|---|
| Random | 200 | 20.5% | 19.5% | 76.5% | 3.0% (all bankrupt) | 239 | 14.1 |
| Smart | 100 | 85% (82% minority, 2% coalition, 1% junior) | 3% | 15% | 0% | 355 | 21.7 |

Target: a sensible player usually governs but has to work for it. A random clicker mostly ends in opposition and sometimes goes bankrupt.

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

## Rules the GDD left open (as built)
- **Silver Seam (`windfall`):** Nationalize gives +30 now plus royalties of +5 per turn for 4 turns. Auction gives +20 now and economy +2.
- **Corvane Border Line (`border_wall`):** while it is in force, the Corvane Skirmish event has half the weight, and "Reinforce" costs no treasury.
- **Thinking Loom retraining fund (`ai_rumor`, first choice):** -12 now, then economy +1 and laborers +1 each turn for 3 turns.
- **Founding:** turn 1 begins with a founding election, so all 72 seats are filled.
- **Campaign cost:** 10 treasury in government, 10 party funds in opposition (section 7 wording).
- **Debt:** a surplus above 60 treasury is paid against debt automatically.
- **Win:** being in government after the final election, in any form (`majority`, `coalition`, `minority` or `junior`). `opposition` is a finish but not a win.
- **Minority governments** are common for the smart bot, because rivals rarely accept each other (all rival pairs are 1.1 or more apart). Bills from a minority government still have to pass the floor, which is the cost of governing that way.

## Known levers if it plays too easy or too hard
- To make it harder: raise `RIVAL_DEFAULT_APPROVAL` (each +3 costs the smart bot about 6-8 points of win rate), or raise `RIVAL_COURT_GAIN`.
- To make it easier: lower `APPROVAL_DRIFT` or raise `COURT_SOFT_CAP`.
- If bankruptcy is too rare for careless play, lower `BASE_INCOME` or raise `BASE_EXPENSES`.
