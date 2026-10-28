# Project instructions

## Scope and starting point

Read `PLAN.md` before working on this project. It defines the release sequence, behavior, architecture, and acceptance checks.

Whale Focus (the timer with Whale-chan) is implemented; `PLAN.md` lists its status, decisions, and remaining work. Keep the plan updated as work is completed.

Ship one web release on GitHub Pages: the focus timer with the simple Whale-chan character (idle, eating rice on success, crying on failure). Work on the web frontend only; keep the existing logic/adapter boundaries but do no React Native work. Growth, evolution, and mood systems are deferred. Later explicit user instructions can change the scope.

## Fixed requirements

- Use React 18, TypeScript, Vite, rough.js, and localStorage.
- Pin matching React 18/React DOM/types instead of inheriting a newer major from a scaffold. Keep Strict Mode enabled and record compatible tooling versions when development begins.
- Keep the app entirely frontend and deployable as static files, with an installable offline PWA.
- Do not introduce a backend, authentication, cloud sync, social features, purchases, multiple characters, or push notifications.
- Keep Home, Stats, and Settings minimal and mobile-first. Use a light rice-cream background, whale-blue accents, friendly typography, and rough.js graphics. No tomato imagery or wording.

## Architecture boundaries

- `src/logic/` contains pure TypeScript domain functions and deterministic rough.js stroke generation. No React imports, DOM/browser APIs, storage access, audio, visibility listeners, or scheduling side effects.
- Inject timestamps, calendar inputs, configuration, and drawing seeds. Do not hide time or randomness inside domain functions.
- `src/adapters/` owns browser effects and persistence; `src/hooks/` coordinates those adapters with React.
- Components and screens render state and dispatch actions through hooks. Do not put timer, reaction-trigger, or stats calculations in components.
- `src/data/pet-spec.json` holds tunable timer defaults/bounds, cycle cadence, calendar settings, decor seeds, and the character’s shapes, tones, captions, and reaction timings. Use named sections and typed validation; no tunable domain constants scattered through UI code.
- Use a DOM-free rough.js generator to produce serializable drawing data in `logic/`. Render every character pose through the one shared `<WhaleChan>` component. Keep seeds stable and avoid regenerating sketch geometry on each timer update.
- Enforce import boundaries and run domain tests without a DOM. Research findings and their sources live in `PLAN.md`; keep documented facts separate from proposed product defaults.

## Timer and persistence invariants

- The default durations are 25/5/15 minutes, with a long break after four completed focus sessions; obtain these values from data.
- Time is deadline-based, never tick-count-based. Persist both running and paused sessions, phase, captured duration, session identity, and cycle progress.
- Settings changes affect future sessions. Resetting an unexpired session grants no reward and does not erase completed work; an already-expired session is reconciled first.
- Reconcile expiration before handling an action. Recover one expired session once; leave the next phase ready for explicit start.
- Keep breaks prominent. Stats represent completed timed focus, not verified attention or productivity; changing tabs/apps does not cancel or penalize a session.
- Completion must be idempotent: one focus completion produces one stats credit, one rice-bowl count, and at most one rice reaction.
- Persist related changes together in a versioned application snapshot. Use a short app-namespaced Web Lock around each read/transition/write, including settings. Release it immediately afterward; do not lock for a whole session. If unavailable, release 1 shows saved state read-only rather than performing unsafe writes.
- Save on meaningful transitions, not each countdown update or only on unload. Keep graphics out of storage and preserve accounting/deduplication if history is compacted.
- Validate and migrate stored data. Preserve progress on upgrades and handle invalid or unavailable storage without crashing or silently resetting data.
- Record the session-start time zone and resolve its completion date from the stored deadline in that zone. New sessions use the current local zone; keep historical date keys stable. Use calendar-day arithmetic across daylight-saving boundaries. Manual device-clock edits are outside the accuracy guarantee but must not duplicate credit or corrupt display state.
- Do not promise exact background alarms when a browser or phone suspends execution. Verify correct recovery instead.
- Enable sound from a user gesture, catch blocked playback, always show visual completion, and suppress stale alarms during saved-session recovery.
- The no-loss game rule is not a guarantee against browser data deletion. Keep local-only storage guidance accurate and do not imply browser/install data automatically syncs.

## Character invariants

- One character, Whale-chan, with three poses from one parameterized rough.js generator: idle, success (eating rice), failure (crying). No growth, stages, mood, or death.
- Rice shows once per newly credited focus completion, including one recovered on return. Crying shows only when an unexpired focus session is reset. Breaks, Skip break, tab/app switches, missed days, and reloads never trigger or replay a reaction.
- Reactions are transient presentation state, not stored. Rice counts derive from completion records.
- Keep crying brief, gentle, and blame-free; it never costs progress.
- Draw original artwork. Never copy, trace, bundle, or hotlink fan art, and never use DeepSeek’s logo or wordmark. Keep the fan-art credit and non-affiliation note in Settings and the README. If the procedural drawing is not cute enough, ask before switching to hand-authored SVG.

## GitHub Pages and PWA

- Use the actual repository base path for assets, navigation, manifest URLs, and service-worker scope. Do not assume root hosting or invent a repository owner/URL.
- Prefer in-page screen navigation for the three screens.
- Deploy the built `dist/` through GitHub Actions using the committed lockfile.
- Cache the app shell and required assets for offline reopening. Namespace caches and saved data; cache cleanup must not delete user progress.
- Use the service worker for caching/updates, not as a persistent clock or alarm. Include iPhone installation guidance and test installed-mode storage and offline relaunch separately from browser tabs.
- Do not interrupt an active timer with a forced service-worker refresh.

## Verification and handoff

- For application changes, run the appropriate focused checks and `npm run build` once scripts exist. Test the production build in a browser and inspect console errors; a successful build alone is insufficient.
- Test meaningful boundaries: pause/resume, reload, background expiry, duplicate completion, simultaneous tabs, long-break cadence, midnight/streak rules, storage migration, repository subpaths, and offline reopening.
- For character changes, test reaction triggers and idempotence (no replay on reload), and visually inspect every pose at phone size.
- Check phone layout, accessible controls, reduced motion, blocked/muted audio, travel/DST, and the install flow. Record tested browser/device versions; report physical-device checks that could not be performed instead of implying they passed.
- Documentation-only edits do not require installing dependencies or scaffolding the app.
- Keep `PLAN.md` status and checkboxes truthful. Record implementation and deployment commands in a README when the app exists. In handoffs, state what changed, what was verified, and any remaining work.
