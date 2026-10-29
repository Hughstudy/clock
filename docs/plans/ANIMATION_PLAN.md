# Animation and Presentation Plan (Review Draft)

Updated: 2026-10-29. This is the animation workstream of the [overall plan](../../PLAN.md). It defines future work; this documentation change does not refactor code or approve open visual decisions. Read the overall plan for product scope, the shared interface, integration order and release status.

## Responsibility

Make the selected soft, round blue creature with expressive arms feel friendly and physically present. Own its original artwork, poses, deterministic drawing geometry, motion timing/easing, contact choreography, responsive placement and visual styling. Render mementos and permanent content selected by the main application.

The main-logic workstream owns timer/accounting, F2/F3 data and behavior, persistence, settings storage, reward eligibility, bookmarks, feedback selection/priority, event deduplication, announcements and semantic screen controls. Animation consumes their results. It does not create sessions, count time, save thoughts, grant rewards, choose encouragement, or decide that an operation succeeded.

Animation completion only clears local presentation state. It never enables a business action, commits a record, acknowledges a reward as acquired, or releases a control that was disabled while waiting for a gesture. Explicit user interactions may call the supplied intent callbacks; an animated hand touching a button does not dispatch a click.

## Existing foundation and remaining work

The baseline includes original rough.js artwork with seven semantic stances, stable cached geometry, finite greeting/start/ending gestures, a quiet focused pose, saved app motion preferences and OS reduced-motion handling. Existing contact is with the character's own ground/shadow. Shared contact with real controls and timer surfaces is not implemented.

Continue this blue prototype. Final proportions, material, branded name/icons and individual gestures remain review decisions. Prefer physical option A, stationary controls with deforming visual surfaces. Compare option B, a coordinated prop/scene, and option C, actual control movement, with the same task; neither is automatically in scope. Start with bounded SVG/CSS choreography. A general physics engine requires a demonstrated need.

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
