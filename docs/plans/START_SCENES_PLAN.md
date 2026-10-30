# Start Scenes Plan

**2026-10-30 follow-up, plan first:** the user requested clearer/smoother consistent animation, visible time progression (for example increasing kettle steam and tea readiness), critical storyboards, and random selection with no completion-based unlocking. The [Animation Refinement Plan](ANIMATION_REFINEMENT_PLAN.md) is the current review draft. It supersedes the unlock/access requirements below; the remainder of this document records the implemented C2-P2/v5 baseline. The new behavior is not implemented yet.

Status: implementation and desktop production-browser validation complete, 2026-10-30. The user authorized implementation and integration of the §1 decisions. All eight focus scenes and three rest scenes use the existing blue companion's rough.js/SVG style, touch reactions and main-owned stage, with the clock kept as a separate corner badge. The implementation uses C2-P2 and snapshot v5. See the [verification record](../verification/blue-companion-touch.md#session-scenes-integrated-verification) for passing checks and limitations; this does not establish physical-device acceptance or completion of the wider P0 plan. Responsibilities remain in [PLAN.md](../../PLAN.md), the [Main Logic Plan](MAIN_LOGIC_PLAN.md) and the [Animation Plan](ANIMATION_PLAN.md).

## 1. Decisions (user, 2026-10-29)

| Question | Decision | Consequence in this plan |
| --- | --- | --- |
| How is a scene chosen? | **Automatically** | Shuffle-bag rotation among unlocked scenes; nothing to choose before Start (§5) |
| Does the ending reflect how long you focused? | **Yes** | Ending variants by actual focused time. Every variant is happy and complete (§4) |
| Clock separate or part of the prop? | **Separate** | The badge stays fixed in the stage corner; scenes may glance at it, never move or cover it |
| Own scenes for rest? | **Yes** | A separate rest set with no progress prop (§3) |
| Rewards | **Success unlocks new scenes** | Permanent scene unlocks earned by successful sessions (§6) |
| What counts as success | **The session reaches its own chosen length** | A deadline ending counts. A 5-minute one-off counts the same as 25 minutes. Early endings record time and get their ending, but don't advance unlocks |
| Unlock thresholds | **1 / 3 / 6 / 10 / 15 successful sessions** | Kept as validated data so they can be tuned later without removing anything already unlocked |
| Rendering | **SVG/CSS first** | No new animation dependency; reconsider Rive only if layering becomes unmanageable |

Guardrails from the project rules still apply:

- No failure state. Nothing burns, wilts, unravels or looks sad.
- Nothing already earned is ever lost.
- No streak or "come back" pressure.
- A scene never gates a control or decides whether time was recorded.

## 2. Research summary

| Source | What to take | What to avoid |
| --- | --- | --- |
| Focus Friend (a bean knits while you focus) | A calm activity as a time metaphor | Unravelling and a sad bean when the phone is used |
| Forest (a tree grows while you focus) | Gentle, visible growth | The tree dies when you leave |
| Clumsy Ninja | Eyes that follow you and responses to touch make a character feel alive | A physics engine is unnecessary here |
| Neko Atsume | "Waiting for something nice" is low-pressure; absence is fine | Rare-spawn compulsion |
| Duolingo and Rive | Layered idles: 8 head × 8 body motions give 64+ combinations; separate blink and breath layer | — |
| Idle-animation practice | One dominant loop, rare beats, no back-to-back repeats (use a shuffle bag, not pure random) | Frequent quirky beats |
| 12 principles of animation | Anticipation into the open; secondary action from props | — |

Links are in §10. Some are secondary or marketing pages, so treat them as design inspiration, not evidence.

## 3. Scene template and catalogue

Every scene uses the same five parts:

- **Open:** 1.8 s for a fresh permitted start; never replayed on reload or sync.
- **Loop:** very low motion while running and attention permits it.
- **Beats:** 1.6 s actions after a deterministic 60–90 s quiet interval. Scene rotation uses a shuffle bag; beat timing uses the stable scene key and beat index. Touch, input, panels, pause and hidden pages suppress motion; missed beats are dropped.
- **Pause pose:** the companion rests too.
- **Ending:** one of the variants in §4.

A prop may change with the host's completed progress, such as the sprout, paper fold, block tower or stars. All scenes retain static artwork when motion is disabled. Current timings are validated in `src/data/scene-motion.ts`; the final browser pass must inspect the implemented compositions and interruptions, rather than infer them from the original storyboard ideas.

### Focus scenes

All entries below have implemented SVG props and scoped motion. They reuse the original creature; these are compact scene compositions, not a promise to enact every gesture from the initial storyboard literally.

| # | Scene | Implemented activity | Ending core | Availability |
| --- | --- | --- | --- | --- |
| F1 | **Waiting for food** | Places a pot; steam, lid peek and stirring beat | Reveals the lid; spoon or shared bowls by tier | Starter |
| F2 | **Planting a seed** | Pats the plant; sprout grows with progress; leaf and butterfly beat | A complete flower blooms | Starter |
| F3 | **Reading together** | Opens and holds a picture book; page-turn beat | Closes and hugs the book | Starter |
| F4 | Tea for two | Places a teapot; steam and lid-check beat | Holds a cup with a second cup beside the pot | 1 success |
| F5 | Bubble blowing | Raises a wand; slow bubbles and wand beat | A heart appears inside a bubble | 3 successes |
| F6 | Paper boat | Brings in paper; folding beat and progress-dependent boat | A complete boat bobs on a puddle | 6 successes |
| F7 | Block tower | Places blocks; tower grows with progress and gently wobbles | A complete tower receives a flag | 10 successes |
| F8 | Stargazing | Leans back on a cushion; moon and progress-dependent stars | A shooting star appears | 15 successes |

Pause retains each scene's props and uses the companion's paused pose with no scene motion. The pot's steam becomes fainter; no prop indicates failure or lost progress.

### Rest scenes

Rest scenes have no progress prop, are not unlockable and are rotated separately:

- **R1 Stretch and yawn**
- **R2 Cloud watching**
- **R3 Warm drink**

Rest ends with a soft "ready when you are" pose and never an urge to restart.

## 4. Endings that reflect how long you focused

The ending variant depends on **actual focused time** (the record's `elapsedMs`), not on the target or the end reason. Variants differ in **kind and size of celebration**, not in quality. Every variant is a complete, happy ending with no "unfinished" or "almost" imagery and no comparison to the target.

| Tier | Actual focused time (configurable) | Example for F1 "Waiting for food" | Common treatment |
| --- | --- | --- | --- |
| **Hello** | 0 ≤ time < 1 min | Open lid and a spoon | Short, complete ending (1.4 s) |
| **Snack** | 1 min ≤ time < 10 min | A bowl held up proudly | Standard ending (1.8 s) |
| **Meal** | 10 min ≤ time < 30 min | Bowl with steam, sparks and a small happy motion | One extra flourish (2.1 s) |
| **Feast** | time ≥ 30 min | Two bowls with sparks and a heart | Longest ending (2.4 s) |

- Tier boundaries are validated values in `src/logic/scene-rules.ts`; motion durations are in `src/data/scene-motion.ts`. Changing these values requires a reviewed application update, not a new accounting rule.
- Other focus scenes share their complete ending artwork across tiers, with duration and the Meal/Feast flourishes distinguishing them. Rest has no time tier and uses a 1.6 s ending.
- The factual line ("本段计时…") is always shown separately and exactly, so the tier is never the only signal of time.
- All tiers have the same priority, sound policy and no-pressure copy. Tiers are presentation only: they do not affect records, unlocks or break cadence.

## 5. Scene selection

- **Pool:** starter scenes plus every unlocked focus scene. Rest uses the rest pool.
- **Order:** deterministic shuffle bags with separate persisted focus and rest cursors (`ordinal`, `cycle`, `remaining`, `last`). An accepted start advances only its phase's cursor in the same transaction as the session. Rejected starts, pause, resume and rerenders do not advance either cursor. The next bag avoids repeating the previous scene immediately.
- **Newly unlocked scene:** the first not-yet-introduced scene takes priority on the next focus start; multiple additions are introduced one per start. This insertion preserves the remaining bag, after which normal rotation continues.
- Each accepted session stores `{ sceneId, ordinal, selectionVersion }`; focus records retain that assignment. The saved assignment, not a recomputation from record count, keeps the scene fixed through pause, resume, reload and tab synchronization.
- Turning scene variety off displays the plain companion; turning motion off or requesting reduced motion displays static scene artwork. Selection and unlock accounting continue, and already unlocked scenes remain owned. Re-enabling presentation does not replay a consumed entrance.

## 6. Unlocking new scenes with success

### What counts as success

**Decided:** a focus session that reaches **its own chosen length** (a deadline ending). A one-off 5-minute session counts exactly like a 25-minute one, which keeps the smallest start rewarding.

- Ending early still records the true time and gets its tier ending; it simply doesn't advance an unlock.
- A session that expires while the app is closed is settled on return. It counts as a success once, with no replayed celebration.

### Thresholds

**Decided.** The thresholds are stored as configurable data.

| Successful sessions (cumulative, never reset) | Unlocks |
| --- | --- |
| 1 | F4 Tea for two |
| 3 | F5 Bubble blowing |
| 6 | F6 Paper boat |
| 10 | F7 Block tower |
| 15 | F8 Stargazing |

### Rules

- **Cumulative and permanent:** the count never resets, decays or depends on consecutive days. Unlocked scenes are never lost, including when thresholds later change.
- **No pressure display:** no locked silhouettes, no "3 more to go" counter and no countdown. The new scene simply arrives.
- **Announce only at quiet moments:** the main-owned inline notice is eligible on the visible Focus ready screen after a 3 s quiet interval, beyond the longest ending. Typing, an open thought panel, navigation, a new session or an error cancels that wait. No animation callback gates the notice or any control. The host first saves an atomic claim under the browser dataset's Web Lock, then may display it through the existing single live-region policy. This is at-most-once claiming within that local dataset across tabs, not a cross-device guarantee. A claimed notice may be skipped if the page closes or a newer action wins before display; it is not replayed. Reduced motion retains the text notice. Without confirmed saved/locked persistence, no notice is claimed or displayed.
- **Only finished art:** a scene is listed only once its art ships; unfinished scenes are never shown or promised.
- **Existing users:** migration grants scenes from past unique deadline-ended records silently and marks those grants announced. No historical unlock notice or celebration is replayed; newly earned grants use the normal claim policy.

### Data model (main)

Snapshot **v5** is implemented. The v4 → v5 migration adds scene state, silently derives historical grants and supplies an assignment for a migrated active session. Historical focus records without an assignment stay valid; no past scene is invented for them.

- `scenes.unlocked: { sceneId, unlockedAt, bySessionId, ruleVersion }[]` is append-only and union-merged across tabs by `sceneId`. Unlocks are computed inside the same transition that records the deadline ending, so the record and the unlock are written atomically.
- `scenes.focus` and `scenes.rest` hold separate rotation cursors. `scenes.introduced` records which unlocked activities have received their first selection.
- `scenes.announced` is an append-only union of **claimed** notice IDs, including silent migration grants. It does not assert that a person saw or heard a notice.
- `scenes.lastEnded` retains the ended session ID, phase, assignment, elapsed time and ending timestamp, including rest endings. A new start clears it. Retention alone never authorizes replay: an ending also needs a fresh matching permitted cue and a saved result.
- Unlock eligibility derives from unique deadline-ended records during settlement and merge. Retries and merges can only add ownership, never duplicate or remove it. Different dataset generations never merge. Replacement restore and clear remain future L4 work, not completed by this schema change.
- The backup envelope (L4) must include `scenes`.

## 7. Interface and ownership

**Main, implemented contract C2-P2 (`src/contracts/presentation.ts`):**

- Preserve the read-only `CompanionView` and explicit callbacks. Supply a separate optional `CompanionScene` to the renderer: stable `key`, scene `id`, `sessionId`, `phase`, `status`, `completedProgress`, `allowBeats`, permitted `cue`, and `ending`.
- The key binds dataset generation, session identity and selection version. `completedProgress` is the **completed** fraction clamped to 0–1 and quantized to 1/100; rest always uses zero. The existing clock badge's remaining fraction has a different meaning and is not passed as scene progress.
- `ending: { cueId, tier }` exists only for the matching saved ended session and fresh `settle` cue. Focus tiers come from that session's saved record; rest uses `tier: null`. A new session takes precedence over a retained ending.
- `begin` opens focus; `rest` opens rest; `settle` closes either. Restore, sync, no-op and stale outcomes do not replay a cue. Turning off event encouragement suppresses the phrase, while factual feedback and fresh start/end cues remain available. Unlock text stays main-owned; there is no new `unlock` animation cue.
- Despite its concise name, `allowBeats` gates all scene motion when input or a panel needs attention. Home supplies it for the thought panel, optional step input, duration chooser and end confirmation, and closes start panels before dispatching a start. Animation also applies touch, visibility, error and reduced-motion guards.
- Persist scene variety as a field-level setting. Keep the clock, native touch surface, controls and feedback footprint stable; current scene props use the existing SVG coordinates. General measured contact anchors remain outside C2-P2.
- Real-transition fixtures cover main eligibility and continuity; the standalone preview covers all scene artwork and presentation states. Unit and browser validation are reported separately from implementation.

**Animation:**

- `src/data/scene-art.ts` supplies cached deterministic rough.js parts; `CompanionSceneArt.tsx` and scoped scene CSS compose all 11 scenes. Timer refreshes do not regenerate geometry.
- Pure lifecycle/timing functions take explicit scene identity and conditions. Hooks own timers and cancellation. Hide/page leave, blur, pause, errors, touch, input gates and reduced motion cancel transient choreography; returning never catches up missed beats. Resize cancels an active gesture.
- Transform/opacity motion stays inside the stationary SVG footprint. Static artwork preserves the activity and complete ending; direct touch retains its stable target.
- `preview/animation` offers scene/tier/status controls, static sheets and lifecycle checks without business accounting or persistence.

**Shared rule:** animation never decides tiers, unlocks or success, and never writes data.

## 8. Milestones

| # | Owner | Deliverable | Current status |
| --- | --- | --- | --- |
| S0 | Animation / user review | Original storyboard direction and tier rules | User authorized implementation of §1; specific visual polish remains reviewable in the built preview |
| S1 | Main | C2-P2, retained selection, tiers, unlock rules, v5 migration and fixtures | Implemented; domain/contract tests and integrated browser checks pass |
| S2 | Animation | F1–F3 and R1 with static states and cancellable motion | Implemented; 30 touch and 67 scene browser checks pass across the full catalogue |
| S3 | Main / integration | Stage wiring, quiet claimed notice, scene-variety setting | Implemented; 60 app E2E assertions pass, including layouts, keyboard, one live region and offline recovery |
| S4 | Animation / integration | F4–F8 and R2–R3 | Implemented, visually inspected as static artwork and exercised in the full-catalog browser checks |
| S5 | Both | Real iOS/Android phone acceptance | Not verified by desktop emulation; record device/browser versions when performed |

## 9. Risks

- **Distraction during focus:** keep loops very quiet and beats rare, hold back beats while a thought is being typed, and allow scenes to be turned off.
- **Tiers as judgement:** test the tier copy and art with the user. If the Hello tier ever feels like "you did too little", merge it into Snack.
- **Unlock pressure:** no counters or locked teasers. Revisit if the user reports feeling pushed.
- **Art cost:** all 11 compact scenes now reuse cached parts. Further polish must preserve the current style and keep visual differences honest about the implemented tier treatments.
- **Provenance:** scenes are original and genre-inspired. No game's assets or specific mechanics are copied.

## 10. Sources

- Focus Friend: [Good Good Good](https://www.goodgoodgood.co/articles/hank-green-focus-friend), [Screens Design showcase](https://screensdesign.com/showcase/focus-friend-by-hank-green), [RNZ on focus apps](https://www.rnz.co.nz/life/lifestyle/focus-apps-claim-to-improve-your-productivity-do-they-actually-work)
- Forest: [Product Hunt](https://www.producthunt.com/products/forest-focus-for-productivity), [University of Aberdeen toolkit](https://abdn.ac.uk/toolkit/productivity/forest)
- Clumsy Ninja: [GamesBeat](https://gamesbeat.com/?p=70385), [TouchArcade review](https://toucharcade.com/2013/12/03/clumsy-ninja-review-this-interactive-ninja-has-some-real-smooth-moves/), [Tokyo Tech research note](https://www.titech.ac.jp/english/news/2012/025635.html)
- Neko Atsume: [App Store listing](https://apps.apple.com/us/app/id923917775), [Daily Collegian](https://dailycollegian.com/2016/01/neko-atsume-app-offers-fun-feline-diversion)
- Finch: [Paste Magazine](https://www.pastemagazine.com/article/finch-app-mental-health-virtual-pet-self-care), [Bustle review](https://www.bustle.com/wellness/finch-app-review-features-price)
- Duolingo and Rive: [Rive blog on Lily](https://rive.app/blog/duolingo-s-ai-powered-video-call-brings-lily-to-life), [Duolingo blog on visemes](https://blog.duolingo.com/world-character-visemes)
- Idle animation practice: [GamesRadar](https://gamesradar.com/deceptively-complex-art-doing-nothing-standing-around), [Hive forum on pet idles](https://forum.playhive.com/t/idle-animations-for-pets/94092), [Opsive idle docs](https://opsive.com/support/documentation/ultimate-character-controller/character/abilities/included-abilities/idle/)
- 12 principles: [BINUS summary](https://binus.ac.id/bandung/dkv/2025/11/03/the-12-principles-of-animation-disneys-secret-formula-for-believable-motion/), originally from Thomas and Johnston, *The Illusion of Life* (1981)
