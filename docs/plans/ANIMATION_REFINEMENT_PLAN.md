# Animation refinement: clarity, continuity and progress

Status: review draft, 2026-10-30. **Plan and concept artwork only; application changes have not started.** This follows the user's request to plan first. The current implementation baseline is `1808c90` (C2-P2, snapshot v5). This document refines the animation workstream; it is not a new live ownership register.

## Latest direction

- Make the activity readable and its motion smooth, with a consistent character, material and movement vocabulary across all eleven scenes.
- Show meaningful change as session time passes. Tea is the reference: a quiet kettle develops more steam, then becomes ready to pour and drink.
- Prepare critical animation storyboards before application implementation.
- Remove completion-based scene restrictions. Every shipped scene is available immediately and a scene is selected randomly for each new session.

The final point supersedes the 2026-10-29 scene-unlock decision and the 1/3/6/10/15 thresholds in the existing Start Scenes Plan. Those rules still describe the current code, not the desired next behavior. Other reward, bookmark and memento proposals are outside this change.

The live PRD and register Library links could not be fetched in this review. The supplied PRD v3/revision 7 and register snapshots remain the source baseline; the user's latest direction above is explicit. No remote register was edited.

## What needs fixing

Code inspection and the existing static gallery identify concrete continuity and clarity problems. These are not a measured diagnosis of device frame rate.

| Current behavior | Evidence | Planned correction |
| --- | --- | --- |
| Kettle steam is constant through the session | `src/components/companion/CompanionSceneArt.tsx`, F4 | Make steam amount, cup placement and pose depend on supplied progress |
| Props remount on entrance/beat/ending changes | `src/components/companion/BlueCompanion.tsx`, `sceneLayer` key includes `motionId` | Keep the scene mounted for its saved session identity; restart only the relevant finite gesture |
| Every finite gesture stops and restarts ambient motion | `src/hooks/companion/useCompanionScene.ts`, `ambientAllowed` | Separate ambient motion from the action; override only the joints or layers the action uses |
| Growth and new objects appear at hard thresholds | `CompanionSceneArt.tsx`, F2/F6/F7/F8 | Use continuous shape/opacity changes or a readable placement action with a static destination |
| Hands and objects do not always move together | Scene arm mapping and `src/styles/companion-scenes.css` | Define hand-to-prop contact anchors and choreograph each interaction as one action |
| Current tests mostly verify states/lifecycle | `preview/animation/main.tsx`, `scripts/scene-e2e.mjs` | Add motion recordings, continuity inspection and measured browser performance |

## Storyboards before implementation

The [initial tea progression drawing](assets/tea-progression-storyboard.svg) is a schematic review aid, not replacement mascot artwork or evidence of smooth playback. Keep the selected blue creature and existing SVG/sketch direction. Use a larger, legible kettle and steam silhouette while preserving the face and clock clearance.

| Critical sequence | Keyframes to draw | What review must establish |
| --- | --- | --- |
| Tea progression | Setup → first wisps → fuller steam → cup ready | Change is clear at phone size; the kettle never becomes frantic or threatening |
| Tea pouring | Reach and grasp → lift/tilt → visible pour into cup → lower/offer cup | Both hand contacts, kettle spout, stream and cup stay aligned; no cup appears abruptly |
| Book page turn | Reach → hold corner → page arcs across → release and settle | One understandable action, with gaze following the page and stable book support |
| Paper boat | Flat sheet → crease → triangle → open hull → boat | Intermediate silhouettes connect; paper does not instantly switch to a boat |
| Shared interruption | Activity → touch → release; activity → pause → resume; end interrupted by new start | No pose snap, prop jump or old gesture replay; controls stay immediately usable |

Each action sheet should show four or five drawings, contact points, movement arrows, proposed timing, and the static/reduced-motion destination. Review at the actual 320/375/430 layout sizes before generalizing the treatment. This planning pass supplies the initial tea diagram; the remaining detailed action sheets are the first deliverable after review, before production animation work.

### Tea progress proposal

Percentages are storyboard landmarks, not new business thresholds or hard visual switches.

| Session progress | Visible state |
| --- | --- |
| 0% | Kettle and cup placed clearly; a relaxed companion; little or no steam |
| Around 40% | Two soft steam wisps; occasional glance at the kettle |
| Around 75% | Fuller, slightly taller steam; hand prepares the cup; same unhurried pace |
| 100% | Tea ready; a permitted ending can pour and offer a cup, then settle |

Steam grows in amount and shape, not simply in speed. A completed five-minute session reaches the same readiness as a completed twenty-five-minute session. The exact timer remains a separate factual badge; the artwork is a metaphor for session progress, not a claim about attention or real boiling time.

Pause preserves the achieved stage and rests the hands. Resume continues the same activity. An early end closes warmly from the achieved stage, without snapping progress or steam to 100%. A friendly cup/closing gesture remains available at any duration: tea and happiness are never withheld. Existing actual-time ending variants may add different details, but cannot leave a short completed session looking unfinished. A saved ending gesture remains dependent on the host's permitted cue; progress alone never asserts a save.

## One movement system across the catalogue

Retain SVG/CSS, cached seeded geometry and the stationary stage. No new physics/animation dependency is proposed.

- **Persistent scene:** the same character/prop nodes survive progress updates and ordinary gestures. Stable placement owns its own transform group.
- **Ambient layer:** slow breath, blink and a small prop loop. Match loop endpoints in both position and apparent speed. One dominant motion at a time.
- **Progress layer:** smoothly develop the supplied state. Do not replace entire illustrations at thresholds. Use placement/folding actions where fading alone would be unclear.
- **Action layer:** a common sequence of anticipation → contact/action → follow-through → settle. Hands and held props share anchors; separate transform groups prevent competing CSS animations from overwriting placement.
- **Interaction layer:** touch takes priority over affected limbs; props remain supported. Resume quiet activity without restarting unrelated loops. Do not queue missed gestures.
- **Interruption/static policy:** pause, errors, panels, backgrounding and reduced motion still suppress motion where required. Settle to the current meaningful pose. Latest state wins and factual controls never wait.

Preview starting values: 120–220 ms anticipation, 450–900 ms main action, 250–450 ms settle; 4–6 s breathing and 3–5 s steam loops. Keep occasional beats sparse (currently 60–90 s). These are tunable design parameters, not performance promises or approved final values. Use the same easing family, bounded squash, line weight, prop scale, contact logic and shadow behavior throughout.

| Scene | Early → middle → late → ending |
| --- | --- |
| F1 Food | Covered pot → soft steam/stir → fuller steam/lid peek → serve |
| F2 Plant | Shoot → unfolding leaves → bud → flower and pot pat |
| F3 Book | First spread → distinct page illustrations → bookmark prepared → close and hug |
| F4 Tea | Quiet kettle → growing steam → cup ready → pour and offer |
| F5 Bubbles | Wand dip → small bubble → wider calm bubble composition → heart bubble |
| F6 Boat | Sheet → triangle → folded hull → boat afloat |
| F7 Blocks | Base → deliberate placements → stable tower → flag |
| F8 Stars | Sparse sky → constellation revealed → fuller sky → shooting star |
| R1 Stretch | Settle → slow stretch → relaxed breathing |
| R2 Clouds | Settle → slow cloud changes → comfortable observation |
| R3 Warm drink | Hold → blow gently → sip → comfortable hold |

Focus scenes develop against the chosen session's progress. Rest scenes remain leisurely activities available immediately, with no completion requirement or earned readiness. Their motion language matches focus; they need not act as a second countdown. All scenes must be recognizable in their static form.

## Random selection without unlocking

Recommended interpretation: choose among all eight focus scenes on a focus start and all three rest scenes on a rest start. Keep the existing distinct pools; do not mix an active cooking scene into rest by default.

- Use a shuffled bag for random variety with no immediate repeats. Every scene in its pool appears before a new bag is drawn. Seed through explicit injected identity/entropy, not a hidden random call in pure logic; avoid identical fixed starting order for every installation.
- Select once per accepted logical session and save with that session in the same transaction. Pause, resume, reload, settings edits, retries, rejected starts and cross-tab synchronization do not reroll it.
- Remove active unlock calculation, newly-unlocked priority, delayed notice claims, unlock notices and “earned scenes” wording. Setting thresholds to zero or hiding the notice is insufficient.
- Keep scene variety and reduced-motion preferences. Keep focus-completion counts for the existing long-break suggestion, independently of scene availability.
- Preserve active and historical assignments, records, timer identity/deadline, preferences and dataset generation. Normalize future bags only; do not rewrite a running session to fit the new selection policy.
- Plan an explicit snapshot v6 / selection-policy revision for compatibility. Legacy unlock metadata may remain inert during migration; it must not gate access, create notices or be recreated as a grant. Test old v5 tabs becoming read-only against newer data; do not force-refresh an active session.

## Contract and implementation boundaries

Main owns selection, migration, true progress, persistence, ending eligibility and accessible factual output. Animation owns pose interpolation, contacts, local timelines and cancellation. No animation callback changes time, records, rewards or storage.

The current C2-P2 host floors focus progress to 1% (15 seconds per step in a 25-minute session), both upstream in `useViews.ts` and in `companionSceneOf`. Prefer a small C2-P3 contract revision supplying main's unquantized normalized focus fraction, removing both quantizers from the scene-progress path. Keep the clock badge's remaining-time meaning separate. The renderer may ease toward received values but cannot advance beyond them or run a second accounting clock. Pause/reload/background return must resolve to the latest host state without catching up missed gestures. Preserve the existing rest-zero meaning unless a separately reviewed rest-progress need emerges.

Main/integration edits: `src/logic/scenes.ts`, scene rules/types/app/snapshot and relevant tests, storage compatibility, `src/logic/presentation.ts`, `src/contracts/presentation.ts` and fixtures, `src/hooks/useViews.ts`, `useClockApp`, feedback plumbing, `CompanionFeedback.tsx`, Settings wording and shared composition only as needed.

Animation edits: `BlueCompanion.tsx`, `CompanionSceneArt.tsx`, `useCompanionScene.ts`, pure scene motion, validated art/motion data, scoped companion styles and `preview/animation/`. Coordinate any shared character transforms with existing touch behavior. Keep one owner for each edited file.

## Delivery order and acceptance

| Step | Deliverable | Review/check |
| --- | --- | --- |
| 1. Storyboards | Tea, page turn, folding and shared interruption sheets; all eleven scene progress outlines | Recognizable actions, contact, silhouette and static outcomes at phone size |
| 2. Reference motion | Fixture-only tea animatic plus page-turn/fold examples using the shared layer model | Review full-speed and slow-motion video; loop seams, contact and interruption have no visible jump |
| 3. Main contract and access | Full scene pools, retired unlock behavior, safe migration, precise progress fixtures | Stable session selection and truthful time/save state with a static renderer |
| 4. Catalogue pass | Apply the reviewed motion rules and progression to all eleven scenes | No scene relies on a generic wobble to explain its main action |
| 5. Integration and delivery | Production flow checks, recorded evidence, relevant tests/build, commit/push and deployment verification | Only after this plan and visual direction are reviewed; document device limitations honestly |

Meaningful verification after implementation:

- All scenes are selectable with zero completed sessions; no unlock calculation or notice is active. Verify bag coverage/no immediate repeat and independent focus/rest selection.
- Selection and data survive pause/resume, reload, failed-save retry, two-tab races, v4/v5 migration and stale clients. Preserve short/zero records, expiry deduplication and break cadence.
- Inspect progress at 0/25/50/75/100%, threshold neighborhoods, 5/25-minute completion, early end, pause exclusion and background recovery. Reduced motion shows the same meaningful progress state without looping.
- Record full-speed and slow-motion tea, book, boat and touch/cancellation sequences. Check persistent prop nodes, loop continuity, supported hands, steam contrast and no abrupt object substitution.
- Measure frame behavior and long tasks on named browser/device configurations. Target stable refresh-rate motion (about 60 fps on a 60 Hz test device); do not claim it from screenshots or automated state assertions.
- Inspect all eleven scenes at 320/375/430 CSS pixels, 200% text, keyboard/focus, long/error feedback, open thought panel and soft keyboard. Verify fixed hit targets, single host-owned announcements, offline artwork and `/clock/` paths.
- Run relevant tests, `npm run check`, `BASE_PATH=/clock/ npm run build` and affected production/console checks. Record physical iOS/Android results separately from desktop emulation; unavailable devices remain unverified.

This documentation-only planning change needs no dependency installation or application test/build. It does not mark any of the proposed improvements implemented or visually accepted.
