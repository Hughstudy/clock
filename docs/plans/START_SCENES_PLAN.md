# Start Scenes Plan

Status: plan, 2026-10-29. The user's decisions are recorded in §1; the work is not implemented yet. The plan builds on CodeX's current blue companion (rough.js SVG with seven stances, touch reactions and a gentle focus loop) and on the main-owned character stage, where the clock is a small badge in the corner. It follows the workstream split in [PLAN.md](../../PLAN.md), the [Main Logic Plan](MAIN_LOGIC_PLAN.md) and the [Animation Plan](ANIMATION_PLAN.md).

## 1. Decisions (user, 2026-10-29)

| Question | Decision | Consequence in this plan |
| --- | --- | --- |
| How is a scene chosen? | **Automatically** | Shuffle-bag rotation among unlocked scenes; nothing to choose before Start (§5) |
| Does the ending reflect how long you focused? | **Yes** | Ending variants by actual focused time. Every variant is happy and complete (§4) |
| Clock separate or part of the prop? | **Separate** | The badge stays fixed in the stage corner; scenes may glance at it, never move or cover it |
| Own scenes for rest? | **Yes** | A separate rest set with no progress prop (§3) |
| Rewards | **Success unlocks new scenes** | Permanent scene unlocks earned by successful sessions (§6) |
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

- **Open:** 1–2 s, once per session; never replayed on reload or sync.
- **Loop:** very low motion for the rest of the session.
- **Beats:** rare, ≥ 60–90 s apart, 1–2 s each; chosen by a seeded shuffle; none while the user is touching the companion or typing a thought.
- **Pause pose:** the companion rests too.
- **Ending:** one of the variants in §4.

A prop may change slowly with true progress, such as steam rising or a sprout growing. Each scene has a static frame for every part, for reduced motion.

### Focus scenes

Art cost: **S** reuses existing parts plus one or two props; **M** adds new prop states or an arm pose.

| # | Scene | Open → loop → pause | Ending core | Cost | Availability |
| --- | --- | --- | --- | --- | --- |
| F1 | **Waiting for food** | Sets down a pot → steam wisps, sniffs, peeks under the lid → hugs its knees and dozes | Lid pops "ding", it lifts a bowl to share | M | Starter |
| F2 | **Planting a seed** | Pats a seed in and waters it → the sprout grows with progress; a butterfly visits → lies beside the pot | A flower opens; it sniffs it and sparkles appear | S | Starter |
| F3 | **Reading together** | Opens a picture book → page turns as beats → book on its belly, napping | Closes the book, hugs it and stretches | S | Starter |
| F4 | Tea for two | Teapot and two cups → steam; checks the lid → cuddles the pot | Pours two cups and offers one toward the user | M | Unlock 1 |
| F5 | Bubble blowing | Dips a wand → slow bubbles; a big wobbly one pops → puts the wand down | A big bubble carries a heart upward | S | Unlock 2 |
| F6 | Paper boat | Folds paper → folding beats → the half-boat rests on its head | Sets the boat on a puddle and waves as it bobs away | M | Unlock 3 |
| F7 | Block tower | First block → a block on each beat; the tower wobbles but never falls → leans on the tower | Puts a flag on top and gives a proud bow | M | Unlock 4 |
| F8 | Stargazing | Lies back; the stage dims a little → stars light up with progress → sleepy pose | A shooting star; it gasps and waves | M | Unlock 5 |

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
| **Hello** | under 1 min, including zero | Lifts the lid and tastes a spoonful, delighted | Short and warm: a "thanks for starting" feel; never "nothing happened" |
| **Snack** | 1–10 min | A small bowl, held up proudly | Standard ending |
| **Meal** | 10–30 min | A full bowl, with a little dance | Ending plus one extra flourish |
| **Feast** | 30 min or more | A table with two bowls, sparkles, and it pats its tummy | Longest ending; ends seated and content |

- Tier boundaries live in validated data, so they can be tuned without code changes.
- The factual line ("本段计时…") is always shown separately and exactly, so the tier is never the only signal of time.
- All tiers have the same priority, sound policy and no-pressure copy. Tiers are presentation only: they do not affect records, unlocks or break cadence.

## 5. Scene selection

- **Pool:** starter scenes plus every unlocked focus scene. Rest uses the rest pool.
- **Order:** a shuffle bag. Every scene in the pool plays once before any repeats, and the same scene never plays twice in a row. The order is a pure function of the participation number and a fixed seed. It needs no new saved data, and all tabs agree.
- **Newly unlocked scene:** it plays on the **next** start, then joins the bag.
- The scene is fixed for the whole session through pause, resume, reload and returning from the background.
- With scene variety turned off, or under reduced motion, the plain companion or static scene frames show. Unlocks still accrue.

## 6. Unlocking new scenes with success

### What counts as success

**Proposal:** a focus session that reaches **its own chosen length** (a deadline ending). A one-off 5-minute session counts exactly like a 25-minute one, which keeps the smallest start rewarding.

- Ending early still records the true time and gets its tier ending; it simply doesn't advance an unlock.
- *Alternative for review:* count any session with at least N minutes of actual time. This is fairer to early endings but encourages longer sessions.

### Thresholds

These are configurable data; the user should review them.

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
- **Announce only at quiet moments:** shown after the session ends, alongside the ending, or on the next ready screen. Never during a running session, and never as a blocking popup. Each unlock is announced at most once, on any device or tab. If announcements are suppressed (for example under reduced motion), the unlock still exists.
- **Only finished art:** a scene is listed only once its art ships; unfinished scenes are never shown or promised.
- **Existing users:** past deadline-ended records count when this ships. They are granted silently, and the first new scene is announced once without replaying past celebrations.

### Data model (main)

This requires snapshot **v5**. The v4 → v5 migration is additive and creates empty sets.

- `scenes.unlocked: { sceneId, unlockedAt, bySessionId, ruleVersion }[]` is append-only and union-merged across tabs by `sceneId`. Unlocks are computed inside the same transition that records the deadline ending, so the record and the unlock are written atomically.
- `scenes.announced: string[]` is an append-only union of scene IDs whose unlock has been shown.
- Unlock eligibility is recomputed from records on every transition, so a retry or merge can only add unlocks, never duplicate or remove them. Different dataset generations never merge, so restore and clear replace the data rather than mixing it.
- The backup envelope (L4) must include `scenes`.

## 7. Interface and ownership

**Main (Claude), contract C2-P2:**

- Extend `CompanionView` with:
  - `sessionId` and `sessionOrdinal`
  - `sceneId` (resolved by main from the unlocked pool plus the shuffle rule, so all tabs agree)
  - `progress`, quantized to 1/100 so countdown ticks don't redraw every frame
  - `endingTier`, set only after a confirmed saved ending
  - `newScene: sceneId | null`, set only at a quiet moment and only once
- Keep the existing cues: `begin` plays the scene's open; `settle` plays the ending for that tier. Restore and sync emit no cue, so the scene appears in its loop or pause pose. Add an `unlock` cue that animation may show or skip.
- Provide a stable clock-badge anchor and stage-floor anchor. Scenes may glance at the badge, never move it.
- Persist the unlocks, announcements and an optional **scene variety** preference. Fixtures cover every scene × start, loop, beat, pause and ending tier, plus restored, synced, reduced-motion and unlock cases.

**Animation (CodeX):**

- Scene catalogue data: props, parts, timings, beats, tier ending variants and rest scenes. It reuses the rough.js style and seed, and art is generated once, not per tick.
- Pure functions for beat scheduling (injected time and seed); hooks for cancellable choreography. Animate only transform and opacity, and pause when the page is hidden.
- A static frame for every part, and previews in `preview/animation` driven by C2-P2 fixtures only.

**Shared rule:** animation never decides tiers, unlocks or success, and never writes data.

## 8. Milestones

| # | Owner | Deliverable | Done when |
| --- | --- | --- | --- |
| S0 | CodeX, then user review | Static storyboards for F1–F3 (open, loop, pause, four ending tiers) and R1 | The user approves the look and the tier boundaries |
| S1 | Claude | C2-P2 contract, scene selection, ending tiers, unlock rules, snapshot v5 with migration, fixtures, tests | Unit tests prove: rotation never repeats back to back; the scene is stable across reload and tabs; tiers come from saved `elapsedMs`; unlocks are atomic, idempotent and never lost; the announcement shows once; migration grants past successes silently |
| S2 | CodeX | F1–F3 and R1 in the fixture preview, including static frames | All fixture states render; motion cancels on hide, error and reduced motion |
| S3 | Claude | Integrate into the stage, plus the unlock announcement at a quiet moment and the scene-variety setting | Start and pause targets don't move; 320, 375 and 430 px and 200% text work; one live region; no cue on restore or sync; checked in the production build |
| S4 | CodeX, then Claude | Unlockable F4–F8 and R2–R3, added one at a time and only when the art is finished | Each scene passes the S2 and S3 checks before it joins the pool |
| S5 | Both | Joint acceptance on a real phone (iOS and Android browsers) | Device versions recorded; anything not checked is listed explicitly |

## 9. Risks

- **Distraction during focus:** keep loops very quiet and beats rare, hold back beats while a thought is being typed, and allow scenes to be turned off.
- **Tiers as judgement:** test the tier copy and art with the user. If the Hello tier ever feels like "you did too little", merge it into Snack.
- **Unlock pressure:** no counters or locked teasers. Revisit if the user reports feeling pushed.
- **Art cost:** start with three scenes and reuse parts. Each scene's four tiers share most frames and differ in the final pose and props.
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
