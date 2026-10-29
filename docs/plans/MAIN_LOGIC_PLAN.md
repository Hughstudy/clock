# Main Logic Plan

Status: proposed work breakdown for review, 2026-10-29. This document covers application behavior, data and functional screen integration. No application refactor has been performed by this documentation update. Read [PLAN.md](../../PLAN.md) for the shared scope, open decisions, interface and release sequence; see the separate [Animation Plan](ANIMATION_PLAN.md) for character presentation.

## Responsibility

Main logic determines what actually happened and what the user can do next. It owns timer transitions, thought lifecycle, records and statistics, reward eligibility, bookmarks, persistence, migrations, settings, backup/restore/clear, feedback policy and functional navigation. It exposes read-only views and permitted transient cues to animation.

This workstream also owns accessible controls, forms, factual messages and the integration of screens. Business rules stay in pure logic and coordinating hooks, never in those components. A working static application must support the full journey even if the animation renderer is disabled or replaced.

Animation supplies artwork, visual shells, contact effects, poses and motion. It does not determine successful saves, award content, calculate elapsed time, or complete a business operation through an animation-end callback.

## File responsibility

These are existing integration points, not instructions to move files immediately. Each path has one implementation owner even when another workstream reviews it.

| Area | Main logic owns |
| --- | --- |
| Contracts and model | `src/contracts/`, `src/logic/types.ts`; proposed thought/reward/backup types and contracts |
| Domain behavior | `src/logic/app.ts`, `timer.ts`, `settings.ts`, `stats.ts`, `calendar.ts`, `snapshot.ts` and relevant tests |
| Persistence and effects | `src/adapters/` storage, locks, time/calendar, identifiers, sound and lifecycle; the OS motion adapter is reserved for animation |
| App coordination | `src/hooks/useClockApp.ts`, `useViews.ts`, `useSettingsForm.ts`, time/title/PWA hooks and future thought/record hooks |
| Semantic feedback | `src/logic/feedback.ts`, `feedback-host.ts`, `feedback.md`, their tests, `src/hooks/companion/useFeedback.ts`, `src/data/encouragement.ts`, `encouragement.zh-CN.json` |
| Functional screens and accessibility | `src/App.tsx`, `src/screens/`, navigation, timer controls, notices and `src/components/companion/CompanionFeedback.tsx`; one live-region owner |
| Shared configuration and composition | `src/data/pet-spec.json`, shared validators, root styles, `src/styles/focus.css`, dependencies and PWA/deployment configuration |

The Animation Plan identifies its specific exceptions inside `src/logic/`, `src/adapters/` and `src/hooks/companion/`. Folder names do not establish workstream ownership: `useFeedback.ts` belongs here because it controls event policy, while deterministic character geometry remains in DOM-free `src/logic/` under animation ownership. Main integrates visual shells without independently editing animation-owned rendering files. Shared changes go through the contract and the owning workstream.

## L0: Publish the shared interface and settle behavior decisions

**Dependency:** Review of the overall plan. Run alongside animation's A1 design work.

- Start from existing `C1-F1`, `FeedbackFrame`, `AppFeedbackEvent` and `CompanionPresentation`; publish a referenceable contract commit covering the permitted boundary. Exact exported names and files remain implementation decisions.
- Separate continuous read-only state, factual save/error status, transient eligible visual cues, announcement output and explicit user callbacks. Give cues their own identity; do not require animation playback to depend on whether a screen-reader announcement occurred.
- Keep session IDs, dataset generation and operation/revision identity in main's event validation. Reject stale/no-op/duplicate results and suppress cues from restoration, synchronization and navigation before presentation.
- Define pending/save failure/success, retry, hidden screen, reduce-motion, rapid-action and missing-renderer fixtures. Animation must not require a live timer or storage connection to consume these fixtures.
- Confirm the proposed five-minute-first flow, default silence, record ranges and reward rules with the product review. Reward format can be reviewed through A1 samples; final character polish does not block unrelated timer or thought work.
- Define stable content IDs and metadata for art delivered by animation. Main owns acquisition rules, saved ownership, selected content and announcement eligibility. No entitlement may refer to unfinished shipped content.

**Acceptance:** Both workstreams can use the same state/cue vocabulary and fixture outcomes. No new timer, persistence store, reward ledger or feedback-policy engine appears in animation. The contract is marked implemented only when its code and focused checks exist.

## L1: Complete F1 and the data foundation

**Dependency:** L0. Rule-dependent fields require the relevant decision; do not wait for final animation production.

- Fix the current end-summary issue first: factual actual duration remains visible when encouragement is shown, with saving/error state prioritized. Manual and deadline endings have equal treatment. Rest and next-session actions remain explicit.
- Implement the selected quick-duration flow and optional small step. A step never blocks starting and is captured in the ended record. Keep the last explicitly chosen duration separate from configured defaults. End confirmation neither auto-pauses nor resumes on cancellation.
- Extend the snapshot for step text, thoughts/drafts, approved reward entitlements and announcement state, bookmarked text/copy version, selected content and independent preferences. Define the backup envelope now; version the schema by actual data changes, independently of PRD numbering.
- Specify edit conflicts, deletion markers, undo, dataset generation and pending-save retries. An old tab or its retained draft cannot reintroduce data after restore/clear.
- Preserve v1/v2/v3 identities, totals, historical dates and unknown legacy start times. Initialize new fields safely; do not invent past thoughts, steps or minutes. Apply approved reward migration rules without replaying individual celebrations.
- Keep timers deadline-based, pause time excluded, expiry reconciled before actions, commands tied to the displayed session ID, and settings limited to future sessions. Retain the four-full-session long-break cadence and freely available rest.
- Replace silent invalid-duration reversion with clear range errors and an explicit restore-previous-value action. Preserve existing explicit preferences when new defaults change.

**Acceptance:** Zero/one-second and complete sessions display truthfully. Eight running minutes, three paused minutes and two further running minutes record ten minutes. Expiry races, stale actions, two tabs and retries do not duplicate credit. Migration preserves totals/dates, and failed writes retain operation identity. All of this works with a static companion.

## L2: Complete F2 thought capture and return

**Dependency:** L1 model and persistence rules; animation A2 may use fixtures in parallel.

- One tap saves an empty marker without opening the keyboard. Optional text is a second action. Link a thought to the current focus session or keep it standalone outside a session; rest and standalone thoughts add no focus time.
- Preserve timer state and a pause action while editing. Panel entry/exit does not automatically pause or resume. Drafts survive closure, backgrounding and keyboard dismissal; define submission, retry and failure retention.
- Emit a saved-thought cue only after persistence succeeds. Save failures keep the input visible and retryable. Main's functional controls coalesce an accidental double-click or held press into one marker while allowing a later deliberate capture. Repeated delivery of the same operation is also idempotent; animation cancellation is not a substitute for either safeguard.
- Support put-away status, deletion and undo without changing focus time or rewards. Use deletion/conflict rules that work across tabs. A session ending shows a thought hint only when thoughts exist; broader browsing is delivered in L3.

**Acceptance:** Save an empty marker and then “Pick up the parcel tonight” during a running session, return to the same position, and find the thought after ending. Exercise failed-save retry, deletion/reload/stale-tab synchronization and targeted undo. Saving and navigation work even with no motion renderer.

## L3: Complete F3, rewards, bookmarks and preferences

**Dependencies:** L2 for thoughts; L0/A1 decisions for reward behavior and content. Use static content IDs while artwork is being prepared, clearly marked as development placeholders and never promised as finished rewards.

- Provide one range/total area and a day-grouped list with one inline detail expanded at a time. Collapsed rows show step/time identity, actual duration, a session memento and an optional thought hint; target and ending details appear on expansion.
- Implement the reviewed 7/30-day proposal with explicit date boundaries, millisecond summation before formatting and active sessions listed separately. Load earlier records progressively with a clear outside-total label. Historical dates stay stable after travel.
- Reuse the content area for All records, Thoughts only and My collection. Thoughts/favorites are not hidden by the history date range. Preserve mode position and expansion state; switching cannot discard an editing draft.
- Complete the selected welcome/return, thought-save and empty-history feedback. Requested encouragement returns a phrase immediately, with optional categories afterward. Main selects copy and priority, handles bookmarking/removal, and owns a single announcement stream.
- Associate each approved session memento with one participation identity. Persist welcome/permanent content with stable IDs, rule version and announcement state; save related participation and rewards atomically. Zero-second and fully elapsed sessions have equal participation eligibility under the proposed rule.
- Acquire approved content automatically, without a claim step or a popup during focus. Defer eligible notification until a quiet moment and persist deduplication independently of whether an animation runs. No loss on absence, short sessions or rule upgrades.
- Store separate preferences for event encouragement, character motion and memento/reward display. Hiding presentation neither deletes records/content nor changes eligibility; factual results and deliberate viewing remain available.
- Integrate only finished offline-capable artwork. No locked placeholders, remaining-to-unlock pressure or promises of unmade content in the release.

**Acceptance:** Each session connects its time, step, thoughts and memento. Two twenty-second records total forty seconds. Bookmarks and content survive reopening. Retries, synchronization, migration and reduced motion never duplicate or remove awards. All important information and actions are available without animation.

## L4: Complete backup, replacement restore and clear-all

**Dependency:** L3's complete P0 data model; use L1's backup envelope and generation design.

- Export dated JSON containing settings, timer state, ended/participation records, thoughts, bookmarked text, reward ownership/announcement state, display choices and versions. Explain that files may contain personal notes. No automatic uploads, rendering geometry or transient animation state.
- Validate before previewing counts, date range and replacement scope. Offer export of current data before confirmation. Replace atomically under a short lock; cancellation, invalid/future files and write failure preserve existing readable data.
- Require a running or paused local session to be ended and recorded before restore/clear. Imported active sessions never start automatically; explain the boundary in preview.
- Repeated restore does not duplicate records or rewards. Advance the local dataset generation so old tabs cannot merge back old sessions, thoughts, drafts, bookmarks or content.
- Clear-all confirmation names settings, records, rewards, bookmarks, thoughts, drafts and protected raw-data backups. Report failures accurately, keep necessary synchronization markers and do not substitute cache deletion for data clearing.

**Acceptance:** Compare complete export–clear–restore against the original. Restore the same file twice. Then act from a stale tab. Verify no duplicates/resurrection, safe cancellation, corrupt/unknown version rejection and storage failure. CSV, merge restore and individual focus-record deletion remain P1.

## L5: Validate the complete application and release candidate

**Dependencies:** L1–L4 functional integration and animation A3 for the final combined presentation; coordinate final verification with A4. Functional tests can proceed with the static renderer before A3 is ready.

- Verify the entire start–capture–end–review–backup path, actual time, pause/reopen, closed-tab expiry, concurrent ending, long-break cadence, midnight/travel/DST, clock anomalies, capacity failures, migrations and stale-tab behavior.
- Test 320/375/430 widths, 200% text, landscape/safe areas, touch controls, keyboard/focus return, soft keyboard, real screen-reader output and blocked audio. Coordinate A4's contact and static-pose checks without duplicating semantic announcement ownership.
- Verify production `/clock/` paths, manifest, assets, service-worker scope, cold offline reopening and updates preserving history. No forced reload of a running or paused session. Sound requires the saved preference and permitted playback; stale recovered alarms stay silent.
- Test iPhone/Android browsers and installed modes separately for installation, storage, offline relaunch, locked-screen recovery, audio and updating. Record actual versions and mark unavailable physical checks unverified.
- Integrate the reviewed visual identity and icons without changing storage namespaces or losing history. Preserve legacy provenance while the assets remain. Document release capabilities, limitations and data/installation guidance.

**Acceptance:** All critical functional failures are resolved, and missing device evidence is explicit. Main and animation owners jointly check the final journey. A release candidate is reviewable; publishing still follows the user's separate release instruction.

## Verification and handoff

Run relevant DOM-free domain tests, architecture checks, type checking and `BASE_PATH=/clock/ npm run build` for application changes, followed by affected production-browser flows and console inspection. Focus tests on meaningful accounting, migration, conflict, failure and recovery boundaries. This documentation-only split does not rerun application checks.

Each handoff includes the contract version/commit, implementation commit, changed paths, static-mode evidence, fixtures, actual test results and remaining work. Milestones remain pending until implemented and verified. Actual person/window assignment belongs in the applicable live coordination record, not this responsibility plan.
