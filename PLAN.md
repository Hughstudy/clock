# Focus App: Next Implementation Plan (Review Draft)

Updated: 2026-10-31. This plan distinguishes implemented scope from remaining product proposals. The user explicitly authorized the complete animation-refinement plan, integration and publication. All eleven activities now use the shared production pose system, C2-P3 precise progress and snapshot v6 immediate scene access. See the [refinement implementation](docs/plans/ANIMATION_REFINEMENT_PLAN.md) and [verification evidence](docs/verification/animation-refinement.md). Physical-device acceptance and the wider P0 work remain separate.

The selected direction is the soft blue creature with rounded hands. Tea has one constant-sized cup and a small side table; food develops into vegetables, rice and soup. The 44 catalogue keyframes and 40 contact drawings are exported from the same geometry used by the application. Main still owns time, persistence, selection and announcements; animation owns only cancellable presentation.

## 1. Sources and current baseline

- Requirements: the supplied [PRD v3, file revision 7](docs/handoff-20261029/番茄钟_产品PRD_v3.md), especially sections 3–10 and 12–14. Its appendix describes older code, so it must not be treated as the current implementation. The PRD body takes precedence over conflicting appendix descriptions.
- Subsequent user choice: friendly, cute animation with “a soft, round blue creature with expressive little arms.” Continue this prototype direction. The final name, brand icons, material and individual gestures remain open.
- Implementation baseline: `e6daa66`, containing the complete handoff source and blue companion integration. On 2026-10-29 the user requested committing and pushing this implementation together with the English workstream plans. A fresh fetch found remote main at `0a57d03` with no divergent commits. This publication covers the current prototype, not the unfinished P0 plan; deployment results are tracked in [GitHub Actions](https://github.com/Hughstudy/clock/actions).
- Handoff source baseline: `57ca8697cfa3a694f5e319e00d8dc4ee38b4c907`. Preserve the original PRD and [collaboration register snapshot](docs/handoff-20261029/番茄钟_开发协作.md) as historical references. Do not overwrite the cloud register or turn this plan into a duplicate cross-window ownership board.
- Existing evidence: the [friendly companion verification report](docs/verification/friendly-companion.md). Its counts and branch statements describe that historical verification point. Current [session-scene verification](docs/verification/blue-companion-touch.md#session-scenes-integrated-verification) records strict TypeScript, 284 tests, the `/clock/` build, 60 app assertions, 30 touch checks and 67 scene checks in desktop Chrome, including offline recovery. Physical-device acceptance remains separate.

## 2. Current differences from the PRD

| Capability | Implemented now | Remaining work | PRD reference |
| --- | --- | --- | --- |
| F1: timing and accounting | Deadline timing, pause/resume, actual short and zero-second records, freely available rest, expiry reconciliation before actions, separate participation and full-completion counts; optional small step, remembered one-off length and factual end summary (L1, branch `claude/main-logic-l0-l2`) | First-use “Start with 5 minutes” hierarchy remains a review proposal | Sections 4, 10 |
| Supportive feedback | Saved start/pause/resume/end/rest and thought-save events; requested encouragement with next/dismiss; saved event-encouragement preference; factual result kept separate; no replay on recovery or synchronization | Welcome/return coverage, requested-encouragement categories and bookmarks | Section 7 |
| Blue companion | Original rough.js artwork, seven semantic poses, direct pat/squish/high-five responses, quiet focus, saved motion preference; all eight focus and three rest activities with shared contact poses, finite handling actions, persistent ambient loops and static states (C2-P3) | Final integrated visual/device acceptance; contact with external UI surfaces; final artwork and icons | Section 8 |
| F2: thought capture | One-tap empty marker, optional text, persisted draft, session association, put-away, deletion with undo and cross-tab conflict rules (L2, branch `claude/main-logic-l0-l2`) | Announcement policy for delete/undo results; broader browsing in L3 | Section 5 |
| F3: records | Actual-time totals and a basic history list | Day-grouped records, proposed 7/30-day views, inline details, thoughts/collections modes and position preservation | Section 6 |
| Rewards | One participation record per new session and an encouragement library; all eleven scene activities immediately available, without completion gates or access notices | Revisitable session mementos, welcome content, bookmarks and other permanent illustrations; these separate mechanics still require review | Section 7 |
| Persistence | Snapshot v6 with earlier migrations, retained session/record scene assignments, independently seeded focus/rest bags, inert preserved v5 unlock history; Web Locks, retries, dataset-scoped merge and thought revision/deletion-marker rules | Remaining reward/bookmark model, JSON backup, replacement restore and clear-all | Section 10 |
| Settings and delivery | Duration/sound/motion/event-encouragement and scene-variety controls, two primary destinations, auxiliary Settings, static PWA and GitHub Pages configuration | Memento preferences and data management; complete physical-device, installation and accessibility acceptance | Sections 9, 12 |

The factual end result is now presented separately from encouragement. The scene ending reads the saved record's actual elapsed time; its illustration never replaces that factual line or serves as evidence of persistence.

## 3. Product goal and scope

Complete a coherent phone journey: **start a small session → pause or capture a thought whenever needed → end with actual time recorded → rest or continue → revisit experiences, thoughts and favorites → back up and restore local data.** The blue companion has its own playful personality throughout. Users never need to work to keep it happy or take care of it.

Deliver through the existing static Web/PWA application and GitHub Pages. Retain React 18, TypeScript, Vite, Strict Mode, rough.js, localStorage and the pure-logic/adapter/hook boundaries. Reuse the reliable timer core. No backend, accounts or cloud synchronization are included.

P0 includes F1, F2, F3, the complete basic reward experience and preferences, backup/replacement restore/clear-all, reliable local data and phone usability. Encouragement and a participation counter alone do not complete the reward system or P0.

Month/arbitrary-date filtering, individual focus-record deletion, CSV, backup merging and hiding seconds remain P1. Native applications, stores and commercialization require separate decisions. Exclude task trees, AI chat, growth/hunger/mood decay, streak pressure, multiple characters and decoration shops.

## 4. Concrete proposals for this review

The table contains recommendations that are not individually approved, except where later user decisions below explicitly supersede them. Continue the selected round blue creature instead of reopening unrelated character directions.

| Decision | Recommendation | Status and tradeoff |
| --- | --- | --- |
| Character personality | Curious and playful, with expressive little arms; communicate through silhouette, weight and purposeful contact | Extends the user's choice. Review the specific silhouette and gestures in the next prototype; no fixed name or ocean setting |
| Page structure | Keep Focus and Records as the two primary destinations, with Settings as a third, occasional surface; at most one local panel open | Reuse the current structure and validate the complete set of states |
| Lightweight start | First-use primary action: “Start with 5 minutes.” Reveal 5/15/25 choices on demand; later show the user's last explicit selection clearly | A PRD proposal for review. A one-off choice does not silently change the 25/5/15 defaults |
| Ending experience | Show actual session time, its memento and one response in the same scene; prioritize rest, with another session secondary | Treat early and deadline endings equally. Never auto-start the next session or hide facts behind encouragement |
| Sound and motion | New users start quietly; preserve existing sound choices. Use static poses whenever the OS or app requests reduced motion | Default silence is a proposal. Reuse the existing saved animation setting and OS precedence |
| Physical interaction | Start with option A: stationary controls with surfaces that react to contact. Nudge an edge on start, put away a saved thought, lean against the timer during rest | Compare B, coordinated scene interaction, and C, actual control movement, using the same task. No physics engine or freely draggable world is needed initially |
| Records | Default to the last 7 days, switchable to 30; one range total, collapsed trend and day-grouped list; thoughts and collections in the same page | A PRD structure proposal. Thoughts and collections are not restricted to the 7-day window |
| Reward format | One original illustration style showing the companion's everyday life: small session mementos attached to real records; welcome content, bookmarked phrases and a few permanent illustrations in Collections | Review acquisition, saving and later viewing together. No separate reward room or claim step |
| Other permanent illustrations | Prepare three illustrations in a consistent style; use 3/8/20 distinct sessions only as candidate review parameters | This separate illustration proposal is unapproved. It is independent of scene access, which is now unrestricted; these numbers are not scientific guidance |

**Historical user decision, 2026-10-29 (implemented baseline):** each focus start plays an automatically chosen scene. Endings reflect actual focused time, rest has its own scenes, and successful sessions permanently unlock new scenes. The clock stays a separate badge, and rendering stays SVG/CSS. Success means a session reaches its own chosen length, and scenes unlock at 1/3/6/10/15 successful sessions. See [Start Scenes Plan](docs/plans/START_SCENES_PLAN.md). **Superseded in part on 2026-10-30:** scene access must no longer depend on completion; all shipped scenes are to be available immediately. The [refinement implementation](docs/plans/ANIMATION_REFINEMENT_PLAN.md) delivered this change on 2026-10-31.

For session mementos, propose retaining the current participation rule: one per newly started logical session, with equal treatment for zero-second and fully elapsed sessions. This remains separate from immediately available activities and any future permanent illustrations. Hiding mementos must not stop accounting or remove rewards. The remaining illustration acquisition/viewing design still needs a decision.

## 5. Two independent workstreams

The remaining work is split into two plans. These define responsibilities and deliverables, not a new live assignment board. Existing files stay in place until an implementation change justifies moving them.

| Workstream | Owns | Does not own | Detailed plan |
| --- | --- | --- | --- |
| Animation | Character art/poses, deterministic geometry, motion timing, contact anchors, visual deformation, responsive scene components, static/reduced-motion presentation, reward artwork and visual inspection | Timer transitions, saving, statistics, note lifecycle, reward eligibility, bookmarks, feedback eligibility or persistent settings | [Animation Plan](docs/plans/ANIMATION_PLAN.md) |
| Main logic | F1/F2/F3, model/storage/migration, settings, reward and bookmark rules, backup/restore/clear, semantic feedback and accessible functional screens, app/PWA integration | Character geometry, gesture choreography, animation scheduling or local deformation algorithms | [Main Logic Plan](docs/plans/MAIN_LOGIC_PLAN.md) |

Main logic owns the meaning and saved result of an action. Animation owns how that result looks. For example, main logic saves a thought and decides whether a fresh success cue is allowed; animation uses that cue to make the creature put it away. If animation is disabled, the same thought is saved and the factual result stays visible.

This is a responsibility split across the existing architecture. Pure drawing/pose functions remain DOM-free in `src/logic/`; DOM measurement, OS motion preferences and scheduling remain in appropriate adapters/hooks. Do not move all animation into components or put all browser effects into pure main logic.

### Ownership at the boundary

- Main owns `src/contracts/`, `src/App.tsx`, functional screens/controls, root composition and `src/styles/focus.css`. Animation provides visual components and scoped styles; main integrates them and supplies stable target anchors.
- Main owns `feedback.ts`, `feedback-host.ts`, `useFeedback.ts`, encouragement content/selection, save/error messages and the single announcement owner. These responsibilities stay in main even where a current folder is named `companion`.
- Animation owns the display-only mapping in `companion.ts`, deterministic artwork in `blue-companion.ts`, `BlueCompanion.tsx`, `useBlueCompanion.ts`, `useCompanionView.ts`, the motion preference hook/OS adapter and its specific art/config/style files. It maps permitted cues to poses without deciding whether a reward or save occurred.
- Main retains `CompanionFeedback.tsx` because it renders factual status, semantic actions and accessibility output. Animation supplies its character slot and visual styling through the reviewed contract.
- Main persists motion/display preferences; animation reads the supplied preference and OS setting. Main saves reward ownership and selects content IDs; animation supplies validated artwork for those IDs. No competing stores, settings controllers or ledgers.
- Changes to shared contracts are integrated by main and reviewed by both workstreams before either side depends on them. A cross-boundary edit goes through the file owner instead of parallel changes to the same path.

## 6. Interface between main logic and animation

The implementation uses `C2-P3` in `src/contracts/presentation.ts`, extending the earlier C2-P1 boundary with an optional read-only `CompanionScene`. It preserves `CompanionView`, independently identified `PresentationCue` and explicit `CompanionCallbacks`. Real-transition fixtures live in `presentation-fixtures.ts`; the standalone animation preview adds all-catalog presentation controls. The [C2-P1 verification report](docs/verification/main-logic-l0-l2.md) remains historical evidence; C2-P2 has its own [integrated verification](docs/verification/blue-companion-touch.md#session-scenes-integrated-verification). C2-P3 adds precise progress semantics; internal hand/prop anchors remain animation-owned. General measured external UI contacts and other reward artwork contracts remain future work.

`CompanionScene` carries a dataset/session/selection-version key, scene ID, session ID, phase/status, completed progress (unquantized 0–1; zero for rest), an attention gate, the permitted cue and an optional ending bound to that cue. Focus ending tiers come from the saved record, while rest has no tier. Retained v5 scene state cannot replay an ending without a fresh eligible result. The clock badge retains its own remaining-time fraction; it is not the scene's completed progress.

```mermaid
flowchart LR
    User[User action] --> Main[Main logic and application hooks]
    Main <--> Store[(Versioned local snapshot)]
    Main -->|Read-only view and permitted cue| Animation[Animation and presentation]
    Animation --> Visual[Pose, contact and visual response]
    Animation -->|Explicit user-intent callback| Main
    Main --> Facts[Factual status and accessible announcement]
```

| Contract element | Producer and content | Consumer rule |
| --- | --- | --- |
| Read-only view | Main supplies phase/status, true time/progress, factual persistence/error state, selected content IDs and presentation preferences; only the data needed by the renderer | Render the latest state. No access to mutable snapshots or storage and no recalculation of elapsed time/reward eligibility |
| Transient visual cue | Main validates the operation identity, generation/revision, origin and persistence, then supplies a stable cue identity and allowed semantic result | One permitted gesture at most. Renderer may cancel or omit it; doing so has no effect on accounting or saved content |
| Scene inputs | Main supplies the saved scene selection, completed progress and attention gate. C2-P3 uses the existing stationary stage/SVG footprint; general target refs/anchors remain future contact work | No elapsed-time calculation or selection in animation. Suppress motion for input/panels; preserve clock, feedback and native target areas. DOM measurement belongs in hooks if later contact work requires it |
| User callbacks | Main supplies explicit request/next/dismiss/bookmark or other approved controls | Dispatch only on real user intent. Touching a button in a character animation must not dispatch a click |
| Accessibility output | Main selects factual messages, announcement identity and priority; native controls keep accessible names and focus | Animation adds no duplicate live announcements. Reduced motion retains a useful static expression and all semantic controls |
| Local completion/cancellation | Animation clears only its own transient motion state | `animationend`, timeouts and cancellation must never save, grant rewards, start/end sessions or enable a waiting business action |

### Event rules and independent verification

- Snapshot state and transient cues are separate. Countdown refreshes update readings but never generate a new gesture, phrase, reward or drawing seed.
- Main suppresses stale, duplicate, rejected and no-op outcomes. Recovery, synchronization and navigation update state silently; opening a screen does not replay past success.
- Save-dependent success requires confirmed persistence. Pending, memory-only, read-only and failed states remain truthful. A later successful retry uses the original operation identity and can produce at most one eligible success cue.
- Explicit requests for encouragement do not require a data write. Bookmark/save success does. Distinguish the two rather than gating every visual event on persistence.
- Main decides error priority and which cues may be shown. Animation can suppress motion for reduced motion, hidden/unmounted screens, input stability or missing anchors, but cannot upgrade an ineligible result into success.
- Give visual cues an identity independent of screen-reader announcement identity. Main owns durable reward/notification deduplication; animation owns only transient gesture consumption. Do not persist animation replay queues.
- Scene selection is saved with each accepted session and retained on its focus record. Focus and rest have independent persisted rotation cursors; pause, resume, reload, settings edits and rejected starts do not select again. Every focus/rest pool is available from the first start. The saved session identity seeds new bags, and adjacent repeats are avoided.
- Scene completion never grants access or creates a notice. Snapshot v6 preserves legacy unlock metadata only as inert history; v5 clients encountering v6 become read-only. Full-completion counts still drive long-break suggestions.
- `allowBeats` is the host's attention gate for all scene motion, including entrances/endings. Pause and touch preserve supported poses; their unfinished local handling path can settle on return without replaying a cue. Typing/panels, hide, errors and reduced motion resolve to a supported static state; returning starts a fresh quiet beat interval. Focus `begin`, rest `rest` and matching `settle` cues are the existing semantic mappings. No additional unlock animation cue is used.
- Rapid operations, errors, navigation, backgrounding, generation changes and reduced motion cancel stale choreography. Latest state wins; no delayed playback queue and no waiting for a gesture before the next action.
- Publish fixtures for ready/running/paused/resting, early/full/zero endings, empty/text thought saves, requested encouragement, pending/failure/retry, restore/sync, stale IDs and reduced motion. Animation can develop against fixtures; main must pass the same functional outcomes with a static or absent renderer.

## 7. Parallel sequence and integration gates

The earlier M1–M6 sequence is replaced by the following two workstreams. Scope and acceptance obligations are retained in their detailed plans; the split does not approve open visual or reward proposals.

| Stage | Animation deliverable | Main-logic deliverable | Dependency / review result |
| --- | --- | --- | --- |
| 1. Define the boundary and experience | A1: character states, contact storyboards and coherent reward samples | L0: shared view/cue/callback contract, fixtures, behavior and reward decisions | Review the first experience and publish the contract together; final art polish does not block unrelated business work |
| 2. Build independently | A2: cancellable contact runtime and visual components using fixtures | L1: F1 and schema foundation; then L2: reliable thought capture | Both proceed after the contract. Each can be verified without the other's unfinished implementation |
| 3. Connect real results | A3: replace fixtures at integration points with real views/cues; inspect contact and static modes | L3: history, approved rewards, bookmarks and preferences; integrate the available A2 components | Success cues follow actual saves. Main retains screen semantics and accessibility ownership |
| 4. Complete the release candidate | A4: complete phone/motion evidence for A3’s integrated scenes and approved assets | L4: backup/restore/clear; L5: complete application, phone and PWA checks | Run the full journey together. No release claim without actual implementation and recorded evidence |

For traceability, previous M1 maps to A1/L0; M2 to L1 plus the L0 contracts; M3 to L2; M4 to L3 and A2/A3 assets; M5 to L4; M6 to A4/L5. There is one application and one release candidate, not separate animation and timer products.

Review boundaries are product choices and concrete deliverables. Once a workstream's scope and contract are agreed, routine technical decisions within it do not require repeated permission. Per the user's 2026-10-29 direction, develop authorized work in `/Users/hughqiao/Code/clock` directly on `main`, validate, commit and push. Use branch isolation only when requested. After verifying that all commits are in `origin/main`, delete merged branches and archive unused worktrees where the app permits; preserve unmerged commits and uncommitted work.

## 8. Shared acceptance and handoff

- Preserve React 18/strict TypeScript/Vite, deterministic domain functions, deadline timing, short Web Locks, truthful persistence states, stable calendar dates and existing migrations. Neither workstream may weaken these for presentation convenience.
- Each source path has one implementation owner. Publish contract changes before consumers adopt them; include referenceable commits, changed paths, fixtures, actual checks and unresolved items in handoffs. Use the applicable live register for actual multi-window assignments if that workflow resumes.
- Main's functional acceptance must pass with motion disabled or the character renderer replaced by a static placeholder. Animation acceptance must pass using contract fixtures without a live timer or real persistence.
- Combined verification covers rapid actions, save failures/retry, closed-tab expiry, duplicate events, stale tabs, deletion/restore, responsive anchors, focus, reduced motion and offline availability. An animated celebration is never evidence of a successful save.
- For application changes, run relevant tests, `npm run check`, `BASE_PATH=/clock/ npm run build`, then affected production-browser flows and console inspection. Pure geometry/domain checks remain DOM-free. Documentation-only work requires content, link and diff checks, not application tests.
- Inspect 320/375/430 widths, 200% text, landscape/safe areas, soft keyboard, stable touch targets, real screen readers and blocked audio. Record actual versions; iPhone/Android browsers and installed modes require separate evidence. Unavailable device checks stay explicitly unverified.
- Keep `/clock/` asset/manifest/service-worker paths correct. Never force-update an active or paused session, use the worker as a persistent alarm, or clear progress with caches. Branding changes preserve namespaces or supply a migration.
- Push completed, authorized prototype work directly to main after relevant checks; verify its GitHub Pages deployment separately. Full release-candidate acceptance still requires both workstreams' required checks and integrated acceptance. The publishing workflow does not approve pending product decisions.

## 9. Current review status and next step

The authorized start-scene model, artwork and integration pass the recorded production-browser checks. Physical-device acceptance and the wider records/rewards/data-management plan remain open; completed scene work does not complete those milestones. The deployment workflow also runs the reproducible E2E suite before publishing Pages.

- [x] Handoff source, F1 foundation and blue companion committed to local main (`e6daa66`).
- [x] PRD-to-code gaps and unapproved proposals documented in English.
- [x] Animation and main-logic plans separated, with ownership, interface, dependencies and acceptance criteria.
- [ ] User review of the split and proposed product choices.
- [ ] A1/L0 full experience review. (C2-P1 is the published historical contract; C2-P3 and scene fixtures are implemented. Broader contact/reward design review remains open.)
- [x] Authorized start-scene refinement: all 11 scenes, C2-P3, v6, unrestricted selection, shared production keyframes/contact poses and settings. See [Animation Refinement Plan](docs/plans/ANIMATION_REFINEMENT_PLAN.md).
- [x] Start-scene production-browser validation and report, including actual limits.
- [ ] Physical-device acceptance. Desktop browser evidence does not establish mobile-device behavior.
- [ ] A2 fixture-driven animation components. (Direct touch and calm countdown motion are published on main; shared-surface contact remains pending.)
- [ ] L1/L2 F1, data foundation and thought lifecycle. (Implemented, locally verified and published on main. Device, screen-reader and offline acceptance checks are still open.)
- [ ] L3 records, approved rewards, bookmarks and preferences.
- [ ] A3 broader real-result integration and approved artwork. (The authorized scene catalogue is connected to actual saved results; other reward/contact work remains.)
- [ ] A4 animation, accessibility and device acceptance.
- [ ] L4 complete backup/restore/clear.
- [ ] L5 integrated phone/PWA release candidate.
- [x] User authorized committing and pushing the current implementation and planning documents on 2026-10-29.
- [ ] Full P0 release after implementation, verification and the relevant release instruction.
