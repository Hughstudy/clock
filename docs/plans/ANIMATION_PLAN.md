# Animation and Presentation Plan (Review Draft)

Updated: 2026-10-29. This is the animation workstream of the [overall plan](../../PLAN.md). It defines future work; this documentation change does not refactor code or approve open visual decisions. Read the overall plan for product scope, the shared interface, integration order and release status.

## Responsibility

Make the selected soft, round blue creature with expressive arms feel friendly and physically present. Own its original artwork, poses, deterministic drawing geometry, motion timing/easing, contact choreography, responsive placement and visual styling. Render mementos and permanent content selected by the main application.

The main-logic workstream owns timer/accounting, F2/F3 data and behavior, persistence, settings storage, reward eligibility, bookmarks, feedback selection/priority, event deduplication, announcements and semantic screen controls. Animation consumes their results. It does not create sessions, count time, save thoughts, grant rewards, choose encouragement, or decide that an operation succeeded.

Animation completion only clears local presentation state. It never enables a business action, commits a record, acknowledges a reward as acquired, or releases a control that was disabled while waiting for a gesture. Explicit user interactions may call the supplied intent callbacks; an animated hand touching a button does not dispatch a click.

## Existing foundation and remaining work

The baseline includes original rough.js artwork with seven semantic stances, stable cached geometry, finite greeting/start/ending gestures, a quiet focused pose, saved app motion preferences and OS reduced-motion handling. Existing contact is with the character's own ground/shadow. Shared contact with real controls and timer surfaces is not implemented.

Continue this blue prototype. Final proportions, material, branded name/icons and individual gestures remain review decisions. Prefer physical option A, stationary controls with deforming visual surfaces. Compare option B, a coordinated prop/scene, and option C, actual control movement, with the same task; neither is automatically in scope. Start with bounded SVG/CSS choreography. A general physics engine requires a demonstrated need.

## Session activities: research and proposal — 2026-10-29

**Status: research complete; proposed scenes await review. No application changes in this increment.** The latest user direction is to keep the current style and small clock on the right, while giving each new focus session a different animation activity. The food-waiting example is a starting point for a small story that continues during the countdown.

This is the next proposed animation increment within A1–A3. It does not require the earlier button/timer-contact experiments to ship first. Keep the original blue silhouette, expressive arms, existing sketch outlines, soft shading, palette, ground and touch behavior. Add a few matching props and poses inside the current scene. The current layout remains the baseline for review.

### References and what they suggest

These are design references, not evidence that a particular motion improves concentration. The scenes below are original proposals; their timings and suitability need inspection in our own preview.

| Reference inspected | What the source describes | Application to this prototype |
| --- | --- | --- |
| [Cats & Soup — official website](https://www.catsnsoup.com/en-us) | Watching small characters cook soup in a quiet setting | Give waiting a visible activity: a covered pot, a steam curl and a curious glance. Keep one compact prop arrangement in our existing drawing style. |
| [Spirit City: Lofi Sessions — developer's Steam page](https://store.steampowered.com/app/2113850/Spirit_City_Lofi_Sessions/) | A focus tool with room activities and companions that can be petted | Let the character occupy itself alongside the user, then briefly acknowledge deliberate touch and return to its activity. |
| [Animal Crossing: New Horizons — Nintendo's guide to The Roost](https://www.nintendo.com/jp/ichikara/acbaa/03_en.html) | A café where characters enjoy coffee and conversation | Use a small drink ritual: hold, blow gently, sip, settle. The prop can communicate comfort without extra UI or dialogue. |
| [Spiritfarer — Thunder Lotus](https://thunderlotusgames.com/games/spiritfarer/) | Everyday activities including farming, cooking and crafting | Give the hands purposeful gestures and a clear relationship to a prop, such as holding a page or pressing a paper fold. |

Adapt the activity ideas, with original drawings and choreography. These references do not introduce their currencies, unlock systems, care obligations, soundtracks or worlds into this app.

### Six candidate scenes

All scenes use the same character and current stage. A new scene changes its activity, not its identity. All endings receive the same warmth, including a zero-second or early ending.

| Scene | Short entrance | During the countdown | Deliberate touch | Pause and any ending |
| --- | --- | --- | --- | --- |
| **1. Waiting for soup** — first set | Places a little covered pot beside itself, rubs its hands once and settles | A single steam curl; an occasional sniff or gentle stir, with long quiet intervals | A head pat produces happy eyes and a curious lid peek; a hand touch offers a small wave | Pause: rests the spoon and relaxes. End: lifts the lid for a friendly reveal. Food is never withheld for ending early. |
| **2. Picture-book company** — first set | Opens a small picture book and finds a comfortable pose | Eyes follow the page; an occasional page turn; familiar breathing continues | Peeks over the book, smiles and raises one hand; then returns to reading | Pause: rests a hand between pages. End: inserts a ribbon and closes the book gently. |
| **3. Paper-plane workshop** — first set | Brings out a partly folded sheet and presses a crease | Smooths a fold, examines the shape, then quietly holds it; no endless rapid folding | Tilts the plane toward the user or makes its nose bob, keeping the face visible | Pause: sets the paper safely down. End: a short glide lands beside the character, entirely inside the scene. |
| **4. Warm cup** — later variety | Lifts a small mug with both hands and blows one tiny puff | Slow steam, a small sip and a comfortable exhale | A soft squint followed by a tiny toast; the mug stays secure during a belly squish | Pause: rests the mug nearby. End: a warm toast, then a settled pose. |
| **5. Little leaf** — later variety | Turns a small potted plant toward itself and admires a leaf | Gently brushes or watches a leaf; one occasional droplet catches its attention | Touching the character prompts a happy lean and a small leaf spring | Pause: rests beside the plant. End: gives the pot a contented pat. The plant never wilts or depends on focus time. |
| **6. Tiny sketchbook** — later variety | Opens a small pad and draws the first line of a star or cloud | A short pencil stroke, a thoughtful head tilt, then quiet observation | Holds up its doodle for a moment and smiles | Pause: rests the pencil. End: lays the pad down with the sketch visible; this is decorative, not a saved note or earned item. |

**Recommended first set: soup, picture book and paper plane.** They provide three distinct actions and silhouettes—waiting, reading and making—using a small number of props. The cup, plant and sketchbook expand the catalog after the first set feels good at phone size. Scene names are planning labels, not proposed new UI copy or a selection menu.

### Timing and interaction rules

The following numbers are preview starting points, not approved final motion specifications:

1. **Entrance, approximately 1.5–2.5 seconds:** acknowledge a permitted fresh start, bring the prop into place and settle. The timer and controls respond immediately. No camera movement, large entrance across the page or wait for a gesture to finish.
2. **Quiet presence:** retain the existing subtle breath and blink. Give the scene one small secondary action approximately every 20–40 seconds, followed by stillness. Avoid making breath, arms, steam and a prop all compete for attention. No action is driven by each countdown tick.
3. **Touch, approximately 0.6–1.0 seconds:** keep head pat, belly squish and hand high-five as the common vocabulary. The selected scene adds one appropriate prop response and yields the arms to the direct interaction. Release settles into the same activity; repeated input replaces rather than queues reactions. Props are decorative and add no nested buttons or drag requirements.
4. **Pause/resume:** adopt the paused pose with the same prop. Resume returns to the activity without a new entrance or scene choice. The current truthful paused status stays visible.
5. **Ending, approximately 1.0–1.8 seconds:** use the same friendly ending for manual and deadline endings when the host permits a cue. Never imply that food, happiness or a pleasant ending must be earned. The factual result is always immediately available.
6. **Interruption:** errors, incompatible state changes, hidden pages and disabled motion cancel the active sequence. On return, show the current scene without catching up missed gestures. Reduced motion retains a static pose, prop and friendly response to deliberate interaction.

The scene has its own quiet rhythm; it is not a second progress indicator. Food readiness, page count, plant growth and completed drawings do not measure elapsed time, attention, rewards or persistence. Short and long configured sessions use the same relaxed treatment, without a frantic final-minute sequence. No new sound is proposed.

### A different activity on each start, with continuity

- Select once for each **new logical focus session**. For the first set, recommend a three-scene rotation with a stable seeded initial position. Consecutive new sessions use different scenes; all three appear before the cycle repeats. A three-scene catalog necessarily repeats over time.
- Keep the choice through countdown updates, pause/resume, thought capture, encouragement requests, save retries, navigation, reload and synchronization. A rest start does not consume the next focus scene.
- Persist or otherwise durably reconstruct the assignment through the main owner. A random choice on mount, or a plain hash of the session ID, cannot guarantee both continuity and no immediate repetition.
- A rejected/no-op or repeated start command must not advance the rotation. If a session starts in memory while saving is pending or fails, retain that session's provisional scene through retries rather than selecting again. Main owns session identity and reconciliation. Selection must also stay coherent across tabs and dataset replacement.
- A permitted start cue controls whether the short entrance plays. The read-only scene choice determines which prop/pose is present even when there is no cue, such as after reload or while persistence is pending. Static presence never claims a successful save.
- The rotation is presentation metadata, separate from full-completion totals, reward thresholds and streaks. Do not use focus duration or completion as access criteria. If only one scene is available, or metadata is absent, use a safe static/default scene without blocking the timer.

### Fit the current stage

The implementation inspected on local main at `2c80f99` gives the character up to 360 CSS pixels, places `ClockBadge` at the upper right and overlays feedback across the lower character area. These are the concrete layout constraints for the prototype:

- Reserve the top-right clock, its digits/ring and the full lower factual-message area. Props should sit beside the torso or in the hands where those zones remain clear. The plane's glide stays within that safe area.
- Keep the current scene footprint, character scale and controls below it stable. At narrow widths or 200% text, simplify or hide secondary props before compromising the character's face, status or controls.
- Show each scene with a long encouragement, factual error, open thought panel and soft keyboard. The scene must remain readable without moving the timer or changing main-owned typography.
- Preserve the existing stable native character button and touch surface. Decorative movement cannot move its hit area, take focus, capture scrolling or dispatch a timer action. Keyboard activation gets an equivalent friendly response through the existing host interaction.
- Use the existing vector/sketch approach and cached geometry. New props use the same outline, shading and palette conventions. No replacement mascot, full room background, external asset service or physics dependency is proposed.

### Integration request and work order

**Observed interface gap:** `C2-P1` exposes phase/status/preferences and permitted cues; only a transient `PresentationCue` contains `sessionId`. `BlueCompanion` currently receives `presentation` and `cueId`. Neither input gives the renderer a durable active-session scene choice after a reload. `cueFor` also requires host eligibility and confirmed persistence for a begin cue. The renderer must not fabricate a fresh entrance to bypass those rules.

Before production integration, main/Claude should publish the smallest agreed read-only addition that supplies a stable session identity and assigned scene key, plus the catalog/selection version needed for recovery. Main owns retention, cross-tab consistency and cue permission. Animation can supply a pure deterministic rotation helper and scene catalog, tested with explicit seeds/previous selections. This is a contract request for review, not a new API or snapshot migration in this documentation change.

The permitted ending presentation must retain the just-ended session's scene after the active session clears, so its prop does not disappear or change before the ending gesture. A newer session or incompatible state supersedes it immediately. Animation completion only clears local motion; it never writes or holds open the ended session, and reload does not replay its ending.

| Step | Animation contribution | Main/integration dependency | Completion evidence |
| --- | --- | --- | --- |
| 1. Review the concepts | Storyboards for the first three scenes, each showing entrance, quiet activity, touch and ending in the current layout | Existing layout and factual-message constraints | Confirm the activities and visual density before application implementation |
| 2. Build a fixture preview after review | Original props, poses, static variants and cancellable motion in animation-owned modules; extend the existing `preview/animation/` | Mock agreed scene inputs; no live timer/storage additions | Inspect 320/375/430 widths, 200% text, touch/keyboard, interruptions and reduced motion |
| 3. Agree and connect the contract | Renderer consumes assigned scene and permitted cues | Main owns scene retention, root wiring, shared styles/contracts and any persistence change | New-session variety and pause/reload continuity work with real host state |
| 4. Validate and publish the approved increment | Focused motion/geometry tests, preview and production-flow checks | Main verifies any affected persistence/recovery behavior | `npm run check`, `/clock/` build, console checks and recorded browser/device evidence; push authorized work directly to main |

The current commit contains this research and plan only. Application implementation, visual acceptance, a scene-selection contract and device validation remain future work. The earlier shared-control contact proposals remain separate candidates; this activity set can progress within the character stage first.

## Interface with main logic

The shared interface is defined in [PLAN.md](../../PLAN.md). The following describes responsibilities, not a new TypeScript API already present in the repository:

| Direction | Input or output | Animation responsibility |
| --- | --- | --- |
| Main → animation | Read-only presentation state: current semantic stance, accurate status, selected content and motion/display preferences | Render the current state, including a useful static version; never infer business truth from a pose |
| Main → animation | A transient, permitted cue with stable identity | Play at most once while relevant. Ignore absent/consumed cues, cancel superseded motion and do not queue stale reactions |
| Main/integration → animation | Scene visibility, relevant operation changes and cancellation conditions | Settle immediately on navigation, backgrounding, errors, reduced motion or incompatible state changes |
| UI layout → animation | Measured contact anchors and viewport/layout changes | Align hands/props and visual shells; keep DOM measurement and lifecycle handling in hooks/adapters |
| Animation → main | Supplied callbacks for deliberate user actions, such as requesting encouragement or selecting displayed content | Forward the user's intent without editing application state or assuming persistence succeeded |

A persisted setting is supplied by main logic; animation may read the OS motion preference and reduce movement further. It never stores a competing preference. Saved thought/reward cues require confirmed success from the host. Requested encouragement can have a permitted cue without a storage write because its explicit interaction is not a claim of persistence.

The host owns event eligibility, duplicate business events and screen-reader announcements. The proposed interface must expose permitted cues independently of announcement identity: the renderer must not infer permission from an ARIA announcement, phrase category or raw snapshot. This improves the existing mapping boundary rather than claiming it is already implemented. The renderer can additionally remember the last cue it consumed to avoid replay during local rerenders; this is presentation protection, not accounting deduplication. Reopening, synchronization and timer ticks update the pose without inventing a fresh cue. Error text and actual duration remain available even when all motion is absent.

## Planned file boundaries

These are module responsibilities, not live worker claims. Establish actual ownership before implementation and coordinate contract changes through the integrator.

| Files | Animation work |
| --- | --- |
| `src/data/companion-spec.json`, `src/data/blue-companion.ts` | Validated original shapes, tones, poses and motion parameters; no timer or reward thresholds |
| `src/logic/blue-companion.ts`, `src/logic/blue-companion.test.ts` | DOM-free seeded geometry and pure motion transitions; injected inputs, stable caching and presentation-only cancellation/deduplication |
| `src/logic/companion.ts`, `src/logic/companion.test.ts` | Map an already resolved feedback view into visual stance/cue/static state; do not add feedback selection or business eligibility here |
| `src/components/companion/BlueCompanion.tsx`, `src/hooks/companion/useBlueCompanion.ts` | Character rendering and local animation lifecycle |
| `src/hooks/companion/useCompanionView.ts` | Adapt the resolved host view for rendering; host/catalog remain the source of text, actions and permissions |
| `src/hooks/companion/useMotionPreference.ts`, `src/adapters/motion.ts` | Read effective OS/app motion constraints; persist nothing here |
| `src/styles/blue-companion.css` | Scoped character motion and static states |
| Proposed scene components/hooks and their scoped styles | Shared contact anchors, surface deformation and cancellation. Agree names through the interface review; these modules do not exist yet |
| Proposed isolated preview fixtures | Feed approved mock views and cues into the renderer without a second timer or storage implementation |

Do not independently edit `src/logic/feedback.ts`, `src/logic/feedback-host.ts`, `src/hooks/companion/useFeedback.ts`, encouragement catalogs, `src/components/companion/CompanionFeedback.tsx`, `src/styles/companion.css`, screen/root composition, `src/styles/focus.css`, app state, snapshot/storage code or shared contract files. Those remain main-logic/integration owned. Deliver visual requirements or reusable slots to the owner instead of creating overlapping edits.

Pure drawing modules may remain under `src/logic/`: the workstream split does not authorize moving browser effects into pure logic or reorganizing the repository into new folders. No code movement is part of this plan update.

## A1: Define the visual states and independent preview

**Dependency:** Agree the minimum read-only view, cue identity, cancellation rules and callbacks with main logic. Static drawings and storyboards can begin during that agreement; executable fixtures use the agreed interface.

- Refine the chosen silhouette, expressive arms, gaze and weight. Preserve recognizable static ready, focused, paused, resting, settled, support and neutral states.
- Show ready/running/paused/ended/thought-capture/rest scenarios in the same phone scene. Include save failure and static alternatives without changing the main controls' meaning.
- Produce a fixture preview that can select each state, emit one cue, repeat its identity, replace it and simulate cancellation. Mark future F2/reward situations as demonstrations rather than successful real operations.
- Prepare same-task A/B/C contact storyboards and candidate memento/collection illustrations. Illustration counts, reward thresholds and the final carrier remain proposals in the overall plan.

**Deliverable:** A reviewable pose sheet and fixture-driven scene preview, with four contact frames—approach, touch, maximum force, settled—for the selected examples.

**Acceptance:** The character remains recognizable and expressive at phone size without motion. Controls and factual results remain legible. User review selects visual direction; no live timer, persistence or reward implementation is required to inspect this material.

## A2: Build the cancellable physical interaction layer

**Dependency:** A1's selected contact approach and stable host interface. This can run alongside main-logic feature work using the same fixtures.

- Start: after a permitted begin cue, the hands meet the button's visual shell, the surface reacts locally and the creature absorbs the recoil. The actual timer starts according to main logic immediately, independent of the gesture.
- Thought saved: after a confirmed saved cue, place the marker or written-note representation into its visual resting place. Pending/error states remain unfinished and retryable; no success choreography hides a failure.
- Rest: lean against the timer's outer surface and settle into a comfortable pose, equally available after short and fully elapsed sessions.
- Use one coordinate relationship between hands/props and surfaces. Measure responsive anchors in UI hooks; keep pure geometry deterministic. Recalculate anchors when layout changes, not sketch paths on every countdown update.
- Keep the semantic button, label, focus ring, input caret, timer digits and navigation targets stable. Decorative layers do not intercept pointer events or cover factual feedback.
- A newer cue/state, cancellation, layout invalidation or reduced-motion change cancels the old sequence and settles safely. Clear local animation state without waiting for a missing CSS completion event. No backlog runs when returning from the background.

**Deliverable:** Reusable contact scene components, scoped styles, cancellation handling and fixture demonstrations of rapid input.

**Acceptance:** Contact occurs at the visible touch point with consistent force direction. Rapid start–pause–resume remains immediately operable. Neither cancelled nor completed choreography emits business actions. Focus-running remains quiet after its initial response.

## A3: Integrate real host events and approved visual content

**Dependency:** A2 plus each corresponding real main-logic feature. Start/rest may integrate first; thought and reward visuals wait for their real saved events. Continue previewing unfinished features with labeled fixtures.

- Replace fixtures through the shared interface, without inspecting snapshot internals or deriving success from timer numbers, button clicks or DOM text.
- Coordinate shared scene slots with the main integration owner. Main retains accurate end summaries, controls, selected phrases, bookmark status and announcements; animation renders the supplied values.
- Add approved memento and permanent-content artwork with stable asset/content identifiers supplied by main logic. Presentation can show acquired or selected content but never evaluate thresholds or issue entitlements.
- Provide static artwork for all approved content and cacheable local assets. Preserve legacy asset provenance until those assets are actually replaced. Final brand/icon changes require the relevant design choice.
- Keep separately controllable encouragement, motion and memento display consistent with host preferences. Hiding artwork does not delete records or remove access to saved content.

**Deliverable:** Production-connected scenes and completed approved artwork, plus a concise integration note listing host interface version, real supported cues and remaining fixture-only demonstrations.

**Acceptance:** Saved operations trigger only their permitted reaction. Save failures, reloads, synchronization, navigation and countdown ticks cannot produce a new success gesture. Main logic works with a static or absent optional animation renderer.

## A4: Verify motion, accessibility and device behavior

**Dependency:** A3's integrated flows. Validate individual gestures in A1–A3 as well; this milestone covers the complete animation contribution to release acceptance.

| Check | Required evidence |
| --- | --- |
| Static and reduced motion | Every pose and message remains understandable with the app animation preference off and OS reduced motion enabled; disabling during a gesture settles immediately |
| Rapid interruption | Start–pause–resume, repeated request, navigation, panel opening, errors and background/return cancel stale motion without queueing or replay |
| Stable interactions | Pointer-down/up, keyboard focus, repeated taps and text input remain usable; no invisible displaced hit area or wait-for-animation lock |
| Phone layouts | 320/375/430 widths, 200% text, landscape, safe areas and soft keyboard keep contact points aligned and essential controls readable |
| Presentation identity | Repeated cue IDs and ordinary rerenders do not replay a cue; actual new permitted cues can play once; manual/deadline endings have equal treatment |
| Pure logic boundary | Geometry and pure motion tests run without a DOM; stable seeds produce stable paths; time/random inputs are explicit |
| Accessibility integration | Decorative layers do not capture input or duplicate the host's live announcement; factual state remains readable and focus is visible |
| Production and offline | Build at `/clock/`, inspect console and load cached artwork offline; no required remote art/font dependency |
| Physical devices | Record actual iPhone/Android/browser versions for tested motion and installed-mode behavior; list unavailable checks as unverified |

For application changes, run the focused checks, `npm run check` and `BASE_PATH=/clock/ npm run build`, then inspect the production experience. Visual inspection covers all poses and the four contact frames; screenshots alone do not prove cancellation or accounting correctness. Coordinate complete phone/PWA acceptance with the main workstream rather than claiming an animation-only preview validates the whole app.

## Handoff and current status

### Touch interaction increment — 2026-10-29

The user authorized upgrading the animation module while Claude handles main
logic. The isolated `codex/blue-companion-touch` branch adds head pats, belly
squishes, hand high-fives, bounded gaze and static friendly touch responses to
the original blue creature. Only internal artwork moves; the existing native
encouragement button retains its action, focus and bounds. Local touch responses
never save, start a session or award content.

An independent preview under `preview/animation/` exercises the existing
`CompanionPresentation` / `cueId` interface and cancellation behavior. The
renderer props are unchanged. Main-owned contracts, screens, feedback selection,
root styles, storage and dependencies are untouched. See the
[verification and integration handoff](../verification/blue-companion-touch.md)
for exact scope, commands and remaining checks.

This is a delivered touch-interaction slice of A1/A2, not completion of the full
plan. Shared button/timer contact, thought-saving choreography and reward
artwork still need main-owned anchors/contracts and the relevant design choices.

The user's follow-up requests companionship throughout the countdown. The
focused stance now uses a subtle repeating breath, small synchronized hand
movements and an occasional blink. These ambient motions use the existing
validated timing data, yield to direct touch and finite cues, and stop in reduced
motion. They do not depend on countdown ticks or change main-owned behavior.

A handoff includes changed paths, the shared interface version, supported poses/cues, fixture-versus-real coverage, static variants, contact/interruption recordings, actual verification and remaining decisions. The main owner integrates shared screens/styles and the release candidate.

- [x] Animation responsibilities and main-logic boundary documented.
- [ ] A1 visual states, independent preview and contact review.
- [ ] A2 cancellable physical interaction layer.
- [ ] A3 real host integration and approved content.
- [ ] A4 complete animation and device verification.

The user-selected blue creature is the working direction. Physical option A, final material/name/icons, memento artwork and content quantity remain review choices as described in the [overall plan](../../PLAN.md).
