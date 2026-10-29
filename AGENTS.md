# Project instructions

## Read before changing code

Local continuation (2026-10-29): the user supplied the exported `57ca8697cfa3a694f5e319e00d8dc4ee38b4c907` handoff and explicitly chose a soft, round blue creature with expressive arms. Its source and companion integration were committed on local `main` at `e6daa66`. On 2026-10-29 the user explicitly requested committing and pushing the current code and planning documents; this authorizes the existing main-triggered Pages workflow for this prototype, not implementation of unreviewed future features. The English plan remains a review draft before further implementation; see [PLAN.md](PLAN.md) for the current review draft and milestone order. Read the supplied [PRD snapshot](docs/handoff-20261029/番茄钟_产品PRD_v3.md) and [handoff register snapshot](docs/handoff-20261029/番茄钟_开发协作.md) for this continuation. These files are historical references, not a second live board. The remote collaboration register has not been changed; verify the publication result through Git and GitHub Actions. The source's earlier windows were explicitly stopped in the supplied handoff; this chat owns the local integration. Keep the original character's provenance while its install icons remain; the new creature is an original prototype, with no final name selected.

Maintain PLAN.md and ongoing local project documentation in English. Preserve supplied source snapshots and historical verification reports as records of their original content. This documentation-language preference does not change application UI copy or approve the plan's open product decisions.

Current Git workflow (user direction, 2026-10-29): work in `/Users/hughqiao/Code/clock` on `main`, validate authorized changes, then commit and push directly to `main`. Do not create task branches or worktrees unless the user requests isolation. Coordinate edits to shared files and preserve other contributors' work. Delete merged branches only after verifying their commits are contained in `origin/main`; archive unused managed worktrees where the app permits it, preserving unmerged commits and uncommitted files. An app-protected primary worktree may remain detached, but is not the development checkout. This workflow supersedes earlier branch-isolation instructions and does not approve pending product proposals.

Read PLAN.md and these current sources:

- [Product PRD](https://chatgpt.com/library?file_id=libfile_819c07bf86108191af0be21b4e39123d&account_id=personal). Reviewed baseline: document v3, file revision 7; check for later updates.
- [Shared development register](https://chatgpt.com/library?file_id=libfile_c81e264086d88191828a7654a36d7421&account_id=personal). This is the single live task, ownership, dependency, interface-request and handoff file. Do not create a second live board in the repo.

Local main implements the first F1 focus/actual-records slice and the blue companion integration on the legacy Whale Focus base. The full PRD is not complete; see PLAN.md for verified scope and remaining work. Follow the latest user decisions and PRD body. Historical plans and appendix descriptions of legacy behavior are not requirements to preserve it.

## Product direction

- All user-facing responses are supportive. Starting, pausing, ending early, resting and returning never cause crying, disappointment, lost rewards, hunger, streak pressure or an obligation to care for the character.
- Technical results remain truthful. Do not say a short session, note or reward is saved until persistence succeeds; show errors and recovery actions accurately.
- Develop F1 lightweight start and flexible timing, F2 thought capture and return, and F3 actual-time history and reflection as a connected core.
- Current layout proposal: Focus and Records as two primary destinations, plus a separate low-frequency Settings surface entered from Focus. Use in-place detail, at most one local panel, and no separate reward/collection rooms.
- Continue the user's selected soft, round blue creature with expressive arms as the prototype direction. Final artwork, product name, timer form and UI remain subject to design review; retained whale assets do not make the whale the selected direction. Rejected older UI/character directions are not mandatory starting points.
- The selected blue direction does not require an ocean world, cream background or a particular drawing medium. Calm happiness describes autonomy and kindness; lively, curious and playful expression is welcome.
- Preserve the PRD's review status for five-minute start, default silence, mementos, reward thresholds and specific copy. Use configurable prototypes where appropriate; do not describe every proposal as individually approved.
- Do not incidentally add a backend, authentication, cloud sync, social features, commerce, multiple characters, open-ended AI chat, task trees or complex pet care.

## Multi-window coordination

The exported window assignments are historical for this local continuation. The following branch-based live-register workflow is dormant and applies only if the user explicitly requests isolated multi-window development again; do not treat the archived register as a new claim or overwrite it with current local status.

- Read the shared register at task start, before public-interface changes, after milestones, before handoff and after context recovery. It does not automatically notify other windows.
- Claim work with the latest real file version and a conditional update. A failed version check is not a claim. Reload and preserve intervening work; never omit the guard to force an update.
- Use an independent branch and checkout/worktree for each window. Never switch another window's branch, erase its edits, or force-push shared history.
- W-A owns the shared model, storage, central hooks, root composition/styles, dependencies and integration. W-B owns focus UI, W-C records/settings UI, and W-D companion/copy/physical samples. Exact paths and actual claims are in the register.
- The initial pressure-removal work is included in the current baseline. Coordinate any further shared cleanup before handing affected files to page/companion owners. Isolated new prototypes can proceed against the published contract.
- Record public contract changes and publish a contract commit. Routine choices inside an owned module do not need repeated user approval.
- Handoffs include a reachable full SHA, baseline, changed paths, contract version, actual validation and next step. Local-only is not remotely available, integrated or verified.
- Respect existing in-flight ownership if it differs from a proposed assignment. Resolve the overlap without discarding work.

## Architecture

- Follow the separate [Animation Plan](docs/plans/ANIMATION_PLAN.md) and [Main Logic Plan](docs/plans/MAIN_LOGIC_PLAN.md); PLAN.md owns their shared interface and integration sequence. These are module responsibilities, not new live window claims. The documentation split does not itself authorize a source reorganization or approve pending product choices.
- Main logic owns accounting, persistence, rewards/bookmarks, saved settings, feedback eligibility/copy/priority and factual screen semantics. Animation owns deterministic drawing, pose mapping, contact geometry and cancellable presentation. Main must work with a static renderer; animation must be testable with contract fixtures.
- Main publishes read-only views, permitted transient cues and explicit user-intent callbacks. Animation completion/cancellation changes only local presentation state; it cannot save, grant rewards, start/end timers or gate controls. Keep visual cue identity independent from accessible announcement identity and preserve one main-owned live-region policy.
- Main integrates shared contracts, root/screens, `CompanionFeedback.tsx`, `companion.css` and `focus.css`. Animation owns its rendering modules, scoped character/scene styles and motion-preference reader. Follow the detailed path boundaries before editing; folders named `logic` or `companion` do not alone determine ownership.
- Keep React 18 and matching React DOM/types, strict TypeScript, Vite, the lockfile and Strict Mode. rough.js remains available for appropriate artwork but does not determine the final character medium.
- src/logic/ is pure and deterministic: no React, browser APIs, storage, audio, scheduling, hidden clocks or unseeded randomness. Inject time, calendar inputs, configuration and seeds.
- src/adapters/ owns effects and persistence; src/hooks/ coordinates them. Screens/components consume views and dispatch actions, never independently account for time or write localStorage.
- The implemented C1-F2 contract is src/contracts/focus.ts (focus and thought slice, snapshot v4); the C2-P1 main → animation contract and its fixtures are src/contracts/presentation.ts and presentation-fixtures.ts. Rewards, bookmarks and import/export contracts are still pending.
- Keep tunable defaults, bounds, cadence, copy and artwork in validated data. The integrator controls splitting the legacy all-in-one src/data/pet-spec.json; avoid concurrent edits to it.
- New business interfaces describe semantic events rather than whale/rice/cry identity. Animation neither awards credit nor determines elapsed time or save success.
- Reuse stable geometry/seeds and caching where suitable. Do not regenerate artwork per timer refresh. Use scoped styles; root CSS and composition have one owner.

## Timer and accounting invariants

- Deadline-based time, never tick-count accounting. Persist running/paused state, captured duration, identity and start time zone. The configurable baseline remains 25/5/15 minutes and a long-break suggestion after four fully elapsed focus sessions.
- Reconcile expiry before actions. Settle one expired session once; never generate an unattended chain on return.
- Settings affect future sessions. One-off durations do not silently change defaults. Pause/resume retains identity and excludes paused time.
- The end action records actual elapsed time, including zero and sub-minute sessions. UI session commands carry the displayed session ID so stale tabs cannot end a newer session.
- Separate elapsed time, participation records and fully elapsed count. Under the proposed memento rule, start creates one participation entry; pause, reload, resume and end do not issue another. Fully elapsed count drives break cadence only.
- Rest is freely available and does not count as focus time. Never require earned rest.
- Clamp legal ranges and sum milliseconds before formatting. Two 20-second records total 40 seconds.
- Dates use the session's captured zone: deadline for expiry, end instant for manual end. Keep historical dates stable after travel and do not fabricate unknown legacy start timestamps.
- Time records are not verified attention, efficiency or health. Manual clock changes are outside absolute accuracy guarantees, but must not corrupt state or duplicate credit.

## Persistence and data autonomy

- Related changes commit in one versioned snapshot under a short app-namespaced Web Lock: read latest, transition, write, release. Include field-level preference patches; never lock for a whole session.
- Keep a safe compatibility path without Web Locks; do not substitute a racy localStorage flag. Distinguish read-only, memory-only, pending and saved truthfully.
- Save meaningful transitions, not every tick or unload alone. Keep stable IDs across retries, preserve in-memory results on failure and avoid premature success feedback.
- Validate/migrate old snapshots; preserve IDs, totals and dates. Protect unreadable or newer raw data and never render unknown history as factual zero.
- Ended records and participation are append-only and merge only within one dataset generation. Editable/deleted notes and replacement restore/clear require explicit conflict rules, deletion markers and a dataset generation or tested equivalent. Old tabs must not resurrect data or cleared timers.
- Empty thought markers are valid; text is optional. Note UI does not automatically pause/resume time. Preserve drafts and expose failed saves.
- Full JSON backup/replacement restore are P0 targets, not existing features. Validate and preview before replacement, do not auto-run imported active timers, and end/record active local sessions before restore/clear. Repeated restore must not double credit.
- Browser storage can be cleared or evicted. No punishment is not a durability guarantee; explain browser/install separation and backup accurately.

## Companion and physical interaction

- Legacy cry triggers and pressure copy have been removed from active product flows. Keep them out of behavior, accessibility text and active assertions; merely hiding a negative reaction is insufficient.
- Keep provenance/non-affiliation information while legacy assets remain. Do not relabel referenced character assets as a newly established independent commercial identity.
- User-requested physicality is an exploration direction: edge contact, local deformation, rebound and bounded movement. Prototype and inspect effects before adopting them.
- Preserve core controls' hit areas, focus and readable status. Do not move a target during pointer-down/up or active keyboard use, and do not require waiting for animation.
- Start with bounded presentation effects. Add a physics dependency only for a demonstrated need. Motion consumes semantic events and never writes timer/reward state.
- Focus-running behavior stays unobtrusive; deliberate exploration may be expressive. Reduced motion keeps function, access, rewards and character through static states.
- Final mascot, material, theme and branded icons need the relevant design decision. Explicitly temporary legacy art or neutral functional placeholders can support integration.

## PWA and delivery

- Keep asset/manifest/start/scope/icon/service-worker base paths consistent; current Pages base is /clock/. Do not change the storage namespace merely because branding is undecided.
- Service workers cache/update; they are not persistent background alarms. Never force-refresh running or paused sessions, or clear saved progress with caches.
- Sound uses gestures and preferences, catches blocked playback and suppresses stale alarms. Correct timer recovery is distinct from reliable locked-screen notification.
- Application changes require relevant tests, a production build, and affected production-flow/console checks. Model/storage changes cover short sessions, pause, expiry races, multiple tabs, migration, failures, deletion and restore/clear.
- Check 320/375/430 CSS-pixel layouts, 200% text, keyboard/focus, soft keyboard, reduced motion and stable targets. Record actual device/browser versions; desktop emulation is not physical-device verification.
- Documentation-only changes need no dependency installation or app tests. Keep implementation, integration, validation and deployment status separate.
- Commit and push completed, authorized prototype work directly to main after relevant checks. Pushing main triggers GitHub Pages deployment; verify publication and deployment separately. This does not approve unfinished product proposals or establish full P0 acceptance.
