# QUORUM v2 engine API (additions only)

Import everything from `src/features/play/engine` (`index.ts`). Nothing from v1 was removed or renamed.
Types live in `engine/types.ts`; this file lists every v2 addition and how the UI should use it.
Status: **implemented** unless marked *planned*.

## Ground rules for the UI
- **Render events through `currentEvent(s)`**, not `CONTENT.events.find(...)`. Character crises (scandal,
  defection, leadership challenge) have `{name}`, `{post}`, `{wing}`, `{rival}`, `{odds}` placeholders that only
  `currentEvent` fills in. Events still have exactly 2 choices (`resolveEvent` choice 0 | 1).
- **Elections are no longer always on `turn % 4 === 0`.** Scenarios have their own calendar. Use
  `isElectionTurn(s)`, `turnsToElection(s)`, `s.electionTurns` and `s.totalTurns` (instead of `CONTENT.meta.turnsTotal`).
- **Achievements:** `AchievementId` is unchanged (your exhaustive `Record<AchievementId, ...>` still compiles).
  v2 achievements are `AchievementIdV2`; `AnyAchievementId` is the union. `score(s).allAchievements` lists both;
  `ACHIEVEMENTS` (from content) gives `{ id, name, desc, icon }` for all 17.
- New `Outcome`: `'ousted'` (lost a leadership challenge) — a loss.
- New `LogKind`s: `'character'`, `'debate'`, `'wing'`.
- Save version is now **2** (`SAVE_VERSION`). `deserialize`/`migrate` upgrade v1 saves (sandbox, normal
  difficulty, default cabinet, wings at 60). The localStorage key can stay `poltok.quorum.save.v1`.

## New content (in `content.json`, also exported as lookup tables)
| Export | Type | Count |
|---|---|---|
| `WINGS`, `WING_IDS` | `WingDef` | 3 wings of your own party |
| `POSTS`, `POST_IDS` | `PostDef` | 5 cabinet posts: `purse`, `interior`, `commons`, `whip`, `herald` |
| `TRAITS` | `TraitDef` | 10 traits |
| `CHARACTERS`, `CHARACTER_IDS` | `CharacterDef` | 12 politicians |
| `DEBATES` | `DebateDef` | debates / press conferences, 3 choices each |
| `AMENDMENTS` | `AmendmentDef` | amendment templates |
| `SCENARIOS` | `ScenarioDef` | `sandbox`, `snap_election`, `debt_crisis`, `insurgent` |
| `DIFFICULTIES` | `DifficultyDef` | `story`, `normal`, `hard`, `ironclad` |
| `PERKS` | `PerkDef` | perks, each unlocked by one achievement |
| `ACHIEVEMENTS` | `AchievementDef` | all achievements with name/desc/icon |
| `CONTENT.papers` | `string[]` | newspaper mastheads |

`CONTENT.laws` and `CONTENT.events` grew (see GDD v2 section). New `EventDef` fields: `chainOnly`, `chain`,
`character`. New `EventChoiceDef` fields: `wings`, `relations`, `followUp`.

## New game options (`newGame(opts)`)
```ts
newGame({ seed, partyName, color, ideologyId, economic, social,
  scenarioId?: ScenarioId,      // default 'sandbox'
  difficulty?: DifficultyId,    // default 'normal'
  perks?: PerkId[],             // max CONSTANTS.MAX_PERKS (2); unknown ids dropped. Check unlocks with unlockedPerks()
  daily?: string })             // 'YYYY-MM-DD'; prefer dailyChallenge(date).options
```
A new game auto-appoints a sensible cabinet (`suggestCabinet`), so v1 UI flows still work.

## New state (`GameState`, all JSON)
`scenarioId`, `difficulty`, `mods` (resolved rule modifiers), `electionTurns`, `totalTurns`,
`characters: Record<CharacterId, CharacterState>` (`loyalty`, `ambition`, `status: active|disgraced|defected`, `post`),
`cabinet: Record<PostId, CharacterId | null>`, `wings: Record<WingId, number>` (0..100), `wingsStart`,
`pendingDebate`, `debateHistory`, `debatesWon`, `scheduledEvents`, `eventContext`, `perks`, `daily`,
`lawAmendments`, `lawExtraUpkeep`, `pcProgress`, `scandals`, `challengesSurvived`, `defections`,
`fullCabinetTurns`, `lastChallenge`, `goalsDone`, `timeline`. `DocketItem.amendment?` is the attached amendment id.

### Per-turn timeline (for the Statistics tab)
`s.timeline: TurnSnapshot[]` — one entry at game start plus one per completed turn, oldest first (capped at 60).
```ts
interface TurnSnapshot { turn: number; approval: Record<GroupId, number>; seats: Record<PartyId, number>;
  debt: number; treasury: number; politicalCapital: number; wings: Record<WingId, number>; stats: Record<StatId, number> }
```
`turn` is the turn that just ended (the first entry is the starting position). The snapshot is taken at the end of
the turn, before that turn's election, so seats change in the entry after an election. (The name `history` was
already taken by the log.) Migrated v1 saves start with an empty timeline. You can drop the UI's own localStorage snapshots.

## New actions (`apply(s, action)`; all appear in `listAvailableActions`, all previewable)
| Action | Cost | Effect |
|---|---|---|
| `{ type: 'appoint', post, characterId }` | free into an empty post; **1 PC** to replace a sitting minister | Appointee loyalty +12. A replaced minister goes to the bench with loyalty -20. Moving a minister from another post leaves that post empty. |
| `{ type: 'dismiss', post }` | free | Minister to the bench, loyalty -20. |
| `{ type: 'debate', choice: 0 \| 1 \| 2 }` | free (only while `s.pendingDebate`) | Applies the choice; may backfire (see `debateChoice`). Unanswered debates expire at end of turn. |
| `{ type: 'amend', itemId, amendmentId }` | the amendment's `oneOff` treasury and `politicalCapital` | One amendment per player `enact` bill; raises the target bloc's support. Effects/upkeep apply if the law passes. |
| `{ type: 'draft', lawId, amendment? }` | as v1 + amendment cost | Draft and amend in one step. |

`previewAction` additions: `forecast` is now also returned for `draft` and `amend`; `wingsDelta`,
`loyaltyDelta`, `risk` (debates) are filled where relevant. Debate previews never roll the backfire: they show the
clean outcome plus `risk`. **Debates cost 1 AP** (`CONSTANTS.DEBATE_AP`) and are on offer on about 60% of turns
(`DEBATE_CHANCE`) from turn 2.

`budget(s)` gains a `cabinet` field (the Purse's income, already included in `net`).
`eventChoice(s, id, choice)` gains `wings`, `relations` and, for the leadership challenge's choice 0, `winChance`.

**Achievement icons:** `ACHIEVEMENTS[id].icon` is a name (`hand`, `crown`, `scales`, `leaf`, `shield`, `cycle`,
`sparkle`, `infinity`, `mic`, `broom`, `flag`, `chairs`, `bolt`, `coin`, `fist`, `anvil`, `calendar`); map it to a glyph.

## New functions
| Function | Returns | Use |
|---|---|---|
| `currentEvent(s)` | `EventDef \| null` | The pending event with placeholders filled (labels include odds for challenges). |
| `currentDebate(s)` | `DebateDef \| null` | The debate on offer this turn. |
| `debateChoice(s, choice)` | `DebateChoicePreview` | Effective effects + backfire `risk` after the Herald's skill and perks. |
| `wingMood(s)` | `WingMood[]` | Happiness, trend, mood label, seats controlled, position. |
| `wingPosition(s, wingId)` | `[econ, social]` | |
| `wingReaction(s, lawId, kind?, amendmentId?)` | `Partial<Record<WingId, number>>` | How each wing reacts if you pass this law (show on law cards). |
| `wingSupport(s, wingId, lawId, kind?)` | `number` | 0..1 support of a wing for a bill (rebels below 0.5 when rebellious). |
| `competence(characterId, post)` | `number` 0..1 | Trait fit. |
| `cabinetEffects(s)` | `CabinetEffect[]` | One line per post with text like "+5 treasury per turn". |
| `suggestCabinet(s)` | `Record<PostId, CharacterId \| null>` | Best-fit cabinet from active politicians. |
| `activeCharacters(s)` | `CharacterId[]` | In the party (bench + cabinet). |
| `challengeOdds(s, characterId?)` | `ChallengeOdds \| null` | Win chance of a confidence ballot (pending challenger by default). |
| `amendmentsFor(s, lawIdOrItemId)` | `AmendmentOption[]` (2) | The two amendments on offer for a bill: `forecast`, `flips` (failing -> passing), `stanceChanges` (target blocs whose stance moves, e.g. abstain -> yes), `yesGain`, `noDrop` (votes added / removed vs the plain bill), `wingsDelta`, `targets`. Ranking: flips first, then options that move a bloc's stance, then votes gained, then how close the target bloc ends up to the YES line (0.55), minus cost. A bloc far below the line counts for nothing, so the two offers favour blocs within reach. On the founding Assembly, 67% of offered amendments change the forecast tally and 48% turn a failing bill into a passing one. |
| `scenarioGoals(s)` | `ScenarioGoal[]` | Goals with `done`. |
| `isElectionTurn(s, turn?)`, `turnsToElection(s)`, `nextElectionTurn(s)` | | Election calendar. |
| `unlockedPerks(achievements)` | `PerkDef[]` | Perks unlocked by a list of achievement ids (store them in your meta). |
| `dailyChallenge(date)` | `DailyChallenge` | Seeded from the date (`Date` or `'YYYY-MM-DD'`); `options` go to `newGame`. |
| `headlines(s, max = 3)` | `Headline[]` | Newspaper headlines reacting to the state; deterministic (no RNG consumed). |
| `consumesRng(s, action)` | `boolean` | True if applying the action now draws from the seeded RNG (roll calls, `endTurn`, resolving events, risky debate lines, coalition steps that start the next turn...). Use it to decide whether undo is allowed: undoing such an action would let a player re-roll. Exact: it applies the action to a copy and compares RNG state. Invalid actions return false. |
| `isDeterministic(s, action)` | `boolean` | `!consumesRng(s, action)`. Safe to undo. |
| `isV2Achievement(id)` | `boolean` | For UIs with v1-only achievement tables. |
| `defectionTarget(s, characterId)` | `RivalId` | The rival a politician would defect to. |
| `wingSeats(s)`, `partyMood(s)`, `lobbyCost(s)`, `postStrength(s, post)` | | Seats per wing, seat-weighted wing happiness (drives challenges), current lobby PC cost (a Diplomat whip makes it 1), effective post strength. |

## Score
`ScoreBreakdown` gains `bonus` (scenario goals), `multiplier` (difficulty), `allAchievements`, `goals`.
`total = round((laws + seats + government + stats + debt + bonus) * multiplier)`.

## Constants (`CONSTANTS.*`)
`SAVE_VERSION = 2`, `MAX_PERKS`, `WING_REBEL_AT`, `WING_REVOLT_AT`, `APPOINT_REPLACE_PC`, `LOYALTY_*`,
`SCANDAL_BASE`, `CHALLENGE_*`, see `constants.ts` for comments.
