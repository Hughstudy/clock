# Clock — development plan

Status (2026-10-28): milestones 1 and 2 are done and verified in a local production build. The app is renamed Whale Focus, the tomato theme is replaced by Whale-chan (idle, eating rice on success, crying on failure), and the review gaps are closed. Milestone 3 (publish to GitHub Pages) is in progress.

## Goal and release order

Build a mobile-first Pomodoro-style focus timer that runs entirely in the browser, persists locally, and can be installed on a phone home screen. A fan-made chibi whale girl, **Whale-chan**, keeps the user company: finishing a focus session rewards her with a bowl of rice; abandoning one makes her cry. Ship one release on GitHub Pages.

| Release | Included |
| --- | --- |
| 1 — Clock with Whale-chan | Focus/break timer, today’s count, daily/weekly stats, streak, settings, local persistence, offline PWA, GitHub Pages deployment; Whale-chan with three drawings (idle, eating rice, crying) and a rice counter |
| Deferred (not planned) | Growth, evolution stages, mood decay, more poses, React Native port. Add only on explicit request. |

Use React 18, TypeScript, Vite, rough.js, and localStorage. Web frontend only; keep the existing logic/adapter separation but do no React Native–specific work. Do not add a backend, accounts, cloud sync, social features, purchases, multiple characters, or push notifications.

## Research review

The clock-first scope is consistent with established focus-timer products. The table separates what the sources document from this project's design choices; product examples are not evidence that this app improves attention or wellbeing.

| Reference | What the source establishes | Decision for this project |
| --- | --- | --- |
| [Pomofocus](https://pomofocus.io/) | A browser focus timer can pair configurable focus/break durations with daily/weekly reports. | Keep the timer, settings, and stats MVP. Task management and integrations are unnecessary for release 1. |
| [Pomodoro Technique creator](https://www.pomodorotechnique.com/what-is-the-pomodoro-technique/) | The complete method includes planning, breaks, observation, and reflection, beyond its timer. | Describe this as a flexible Pomodoro-style timer. Pause, custom durations, and manual phase starts are app choices. Encourage the scheduled break after focus. |
| [Finch mission](https://help.finchcare.com/hc/en-us/articles/37935610353293-Our-Mission) and [streaks](https://help.finchcare.com/hc/en-us/articles/37780736136205-Understanding-Streaks) | Finch emphasizes encouragement without pressure; its streak counts app visits and has repair/pause mechanisms. | Our completed-focus streak is intentionally different. Keep the crying reaction brief, cosmetic, and blame-free. Do not add streak currencies or repair mechanics. |
| [Forest](https://forestapp.cc/) | Focus sessions can produce visible rewards; its product also uses loss of a tree as a consequence. | Keep visible accumulation (rice served). Nothing is ever lost, and switching apps is not treated as failure. |
| [Vite deployment](https://vite.dev/guide/static-deploy#github-pages) | Static builds can deploy through GitHub Pages with the correct repository base path. | Keep GitHub Pages; no application backend is needed. |
| [WebKit storage policy](https://webkit.org/blog/14403/updates-to-storage-policy/) | Browser storage is best-effort by default and can be evicted. | Separate the no-loss rule from browser data durability. Do not promise recovery after site data is deleted. |
| [React Strict Mode](https://react.dev/reference/react/StrictMode) | Development checks repeat rendering and Effects to expose bugs. | Keep Strict Mode enabled and prove that completion effects cannot duplicate rewards. |
| [AI gijinka guide](https://genderswapai.com/ai-gijinka) and [36Kr on the “whale girl”](https://eu.36kr.com/en/p/3947452108789632) | In Chinese fandom DeepSeek is personified as a blue-haired whale girl (DeepSeek-chan / Whale-chan). The design grew from the original character “溟月” by Bilibili artist 上善无形 (June 2025); ZipZipPipe added DeepSeek elements and a navy-and-white maid outfit (2026-04-25). Lore: she loves white rice and slacks off in standby. | Use the widely shared traits as inspiration for an original drawing. Rice is the reward because it is the character’s signature food. |
| [Whale-chan spec repo](https://github.com/Neko3000/deepseek-whalechan) and [meme archive](https://github.com/the-beating-light-of-the-nail/deepseek-chan-meme-pack) ([aigengtu.com](https://aigengtu.com/DeepSeek%E5%A8%98)) | Code is MIT; spec text is CC BY-NC-SA 4.0; **images are not licensed** by either project and remain with their original artists. The archive allows only non-commercial fan use and honors takedowns. Both state they are not affiliated with DeepSeek. | Do not copy, trace, bundle, or hotlink these images. Keep them as linked style references only. Credit the original designers and state non-affiliation in the app and README. |
| [Fast Company on DeepSeek’s logo](https://www.fastcompany.com/91268357/deepseek-logo) | DeepSeek’s brand mark is a plump blue whale with a rounded wordmark. | Do not use DeepSeek’s logo or wordmark, or imply endorsement. The app icon is Whale-chan’s own face. |

X.com posts were not reachable through search; the strongest openly browsable sources were the archives above. Weekly boundaries and reaction timing remain proposed defaults, not external standards.

## Character: Whale-chan

A wholesome, fully clothed chibi mascot (about 2 heads tall). Original artwork generated in code; no third-party art is copied.

- **Look:** long hair with a navy-to-sky-blue gradient and white highlights; one ahoge; navy whale-fin ears on both sides of the head; white frilled headband; blue eyes with highlights; pink blush; navy-and-white maid dress with a white apron; navy whale tail with a white underside.
- **Idle (default):** gentle smile, waiting. Subtle breathing via CSS transform, disabled under reduced motion.
- **Success — “free rice”:** eyes closed in a happy ^ ^ shape, eating from a white rice bowl with chopsticks, small floating hearts. Caption such as “Thanks for the rice!”. Shown once for each newly credited focus completion, including one recovered on return, then back to idle when the user starts the break or after a configured time. Style reference: [aigengtu #2534](https://aigengtu.com/zh/meme/2534) (backup [#063](https://aigengtu.com/zh/meme/063)).
- **Failure — cry:** big teary eyes with streaming tears and a wobbly mouth. Caption such as “Aww… the rice got away. Try again?”. Shown only when the user resets an **unexpired focus** session. Breaks, Skip break, switching tabs/apps, and missed days never trigger it. Brief (proposed 4 s), no penalty, and progress is untouched. Style reference: [aigengtu #874](https://aigengtu.com/zh/meme/874).
- **Rice counter:** “bowls of rice” equals completed focus sessions (today on Home, total on Stats). It is derived from completion records, so it needs no new stored state and can never double count.
- **Rendering:** one `sketchCharacter({ pose, size, seed })` in `logic/` produces serializable rough.js paths with named tones; one `<SketchCharacter>` component renders all poses. Shapes, tones, captions, and timings live in a `character` section of `src/data/pet-spec.json`. Cache each pose; never regenerate per tick.
- **Quality gate:** review all three poses at app size against the references. If rough.js output is not cute enough, stop and ask the user before switching to hand-authored original SVG, since that changes a fixed requirement.
- **Name and credit (confirmed by the user 2026-10-28):** character “Whale-chan”, app name “Whale Focus”. Settings and README say: “Fan-made, non-commercial character inspired by the community’s DeepSeek Whale-chan (designs by ZipZipPipe and 上善无形). Not affiliated with or endorsed by DeepSeek.” Licensed stickers may replace drawings only with recorded permission from their artists. The user considers the fan art fine to use, since it is not DeepSeek’s trademark; it remains the artists’ copyright, so the repository ships only the original drawing.

## Product behavior

### Clock

- Default cycle: 25-minute focus, 5-minute break, and a 15-minute long break after every four completed focus sessions. The cycle count survives reloads and midnight.
- Home shows Whale-chan, the countdown, current phase, start/pause/resume/reset controls (plus Skip break during breaks), cycle progress as rice bowls, and today’s completed focus sessions.
- Stats shows daily and weekly completed focus minutes, total rice served, and the current streak. Proposed default: a Monday–Sunday local calendar week.
- Settings allows editing the three durations and toggling sound, and includes the local-storage note, iPhone install guidance, and the fan-art credit. Duration defaults and validation bounds live in data.
- Starting a session captures its duration. Settings changes affect subsequent sessions.
- Reset abandons an unexpired session without awarding credit; it does not erase previously completed sessions or reset the completed-focus cadence. Reconcile an already-expired session first so an earned completion is retained (and shows the rice reaction, not the cry).
- Completion prepares the next phase. Starting that phase requires an explicit user action. Returning after a long absence must never generate a chain of unattended sessions.
- Completed focus sessions contribute their captured focus duration to stats, excluding paused time. Incomplete sessions and breaks earn no focus credit.
- Label these as completed focus minutes, not measured productivity or verified attention. Switching tabs/apps does not invalidate a session.
- Make the scheduled break the clear next action after focus; rest is part of the routine. Keep accumulated progress more prominent than missed-day messaging.
- Initialize/resume audio from Start or an explicit sound-setting gesture. Handle blocked playback without errors and always show visual completion. Recovery from an expired saved session should not replay an old alarm. [Browser audio policy](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay)

### Reactions

- Reactions are transient presentation state, not stored. Pure transitions report a `completion` (with `credited`) or an `abandoned` focus session. The hook shows rice for a credited focus completion and the cry for an abandoned focus session, in the tab that performed the transition.
- Reloading never replays a reaction or grants rice again; other tabs only refresh counts.
- The two reactions never conflict: the newest event replaces the current reaction, and starting a session returns Whale-chan to idle.

### Timer and calendar rules

- Persist a session ID, phase, status, captured duration, running deadline or paused remaining time, completed-focus cycle count, and the local time zone captured at session start.
- Compute remaining time from a supplied timestamp and the deadline, never from a count of interval callbacks. Intervals only request a screen refresh.
- Reconcile expired sessions before processing new actions and when restoring or returning to the app.
- Give a completed session credit exactly once, including after reload, repeated React effects, and concurrent tabs.
- Attribute completion to the stored deadline, not the time the app is reopened. Resolve its calendar date using the session's captured time zone in the adapter and persist that date with the completion record. New sessions use the current local zone; keep historical date keys stable after travel.
- A day with at least one completed focus session qualifies for the streak. Yesterday’s streak remains active while today is in progress; only a fully missed calendar day breaks it. Use calendar-day operations rather than fixed 24-hour subtraction.
- Browser suspension may delay completion sounds. Timestamp recovery must remain correct; an exact alarm while the phone suspends the app is not a promised feature.
- Deadlines use device wall-clock timestamps. Manual system-clock changes are outside the accuracy guarantee; ensure they cannot cause negative countdowns, duplicate credit, or unattended session chains. Time-zone changes alone must not alter a session's elapsed duration. Test travel and daylight-saving boundaries.

## Architecture

Implemented structure:

```text
src/
  logic/                  # Pure domain functions and deterministic sketch generation
    types.ts, spec.ts     # Domain types; typed validation of pet-spec.json
    timer.ts, app.ts      # Session transitions; snapshot-level actions and reconciliation
    settings.ts           # Defaults, input validation, field patches
    calendar.ts           # Civil-date arithmetic on YYYY-MM-DD keys
    stats.ts, streak.ts
    snapshot.ts           # Versioned decode/repair/migrate, cross-tab merge
    sketch.ts             # Seeded, DOM-free rough.js paths with named tones
    character.ts          # sketchCharacter for idle/rice/cry
  data/
    pet-spec.json         # Timer, calendar, decor seeds, palette, and the character section
    spec.ts               # Loads and validates the data file once
  adapters/               # Storage, Web Locks, calendar/time, sound, lifecycle
  hooks/                  # React coordination between adapters, logic, and UI
  components/             # UI only; SketchSvg renders every sketch, WhaleChan shows the poses
  screens/                # Home, Stats, Settings presentation
  test/                   # Architecture boundary tests; favicon sync test
  App.tsx
public/                   # Install icons (generated from favicon.svg by `npm run icons`)
.github/workflows/        # GitHub Pages deployment workflow
```

- `logic/` must not import React or browser/DOM APIs. Pass time, date information, configuration, and sketch seeds as inputs. Do not read storage or run timers there.
- Components consume hooks and render state. They must not implement timer transitions, reaction triggers, or stats/streak calculations.
- Keep tunable domain and drawing values in `src/data/pet-spec.json`, using named sections (timer, calendar, decor, character). Add typed validation. Ordinary CSS layout values need not be domain configuration.
- Use the DOM-free rough.js generator to return serializable paths or drawing instructions. Keep SVG rendering outside `logic/`; all character drawing goes through one `<WhaleChan>` component (built on `SketchSvg`).
- Use stable seeds and cache generated geometry. Animate transforms or opacity without generating a new random outline every second.
- Pin React and React DOM to compatible 18.x versions and use matching TypeScript types; do not accept a scaffold's newer React major by accident. Record tooling in the lockfile and README.
- Keep React Strict Mode enabled. Enforce the logic boundary with import checks and run domain tests without a browser/DOM environment.

## Persistence

Store one versioned, validated application snapshot under an app-specific localStorage key. It includes settings, active timer, cycle count, and completion records. Stats, streak, and rice served are derived. Each completion record needs its session ID, completion timestamp, date key, and credited focus duration.

- Use completion records as the accounting source of truth. Derived stats, streak, and rice counts must remain consistent with their source data.
- Apply timer completion and its stats credit in one state transition and persist the resulting snapshot together.
- Use a short, stable, app-namespaced Web Lock for every persisted mutation: read the latest state, apply a pure transition, write the snapshot, then release. Include settings writes. Never hold the lock for an entire focus session. [Web Locks](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API)
- Release 1 targets browsers supporting Web Locks. Feature-detect it; if unavailable, show saved data read-only with a browser-compatibility message. Do not substitute a racy localStorage flag for a lock. A proven alternative can be added later if older-browser support is needed.
- Update the initiating tab directly and use storage events to refresh other tabs. Retain enough completion identity to prevent duplicate credits. An event notification is not a concurrency lock.
- Validate stored input and migrate supported old versions. Invalid data must not cause a blank screen or silently erase user progress. Preserve recoverable data and show a useful recovery state.
- Surface storage failures; do not claim progress is saved if persistence failed. Service-worker updates must not clear user data.
- Persist on meaningful transitions, not every displayed second, and never rely solely on an unload callback. Store seeds and small state, not generated graphics. Keep history compact; any future compaction must preserve daily totals and completion deduplication. Handle quota exhaustion. [Storage limits](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
- The no-loss promise describes app rules. Clearing site data, private browsing, eviction, or changing browser/install can remove or separate local progress. Explain local-only storage briefly in Settings. Persistent-storage requests are an optional enhancement, not a durability guarantee. [localStorage behavior](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage), [WebKit policy](https://webkit.org/blog/14403/updates-to-storage-policy/)
- Manual export/import is a possible later improvement, not a release 1 requirement; it must not introduce cloud sync.

## Design and hosting

- Use a clean light rice-cream background, whale-blue accents (navy for ink and outfits, sky blue for highlights, a soft teal for breaks), pink blush touches, rounded friendly typography, and rough.js for the character and decorative artwork. No tomato imagery or wording; say “focus session”, not “pomodoro”. Keep timer digits and controls clearly readable.
- Design for phone widths first, with comfortable touch targets, keyboard access, visible focus states, accessible labels (each pose has a text alternative), and reduced-motion support.
- Use in-page navigation for the three screens; avoid a server-side routing dependency.
- Deploy Vite’s `dist/` using GitHub Actions. Set the actual repository base path consistently across assets, navigation, manifest, icons, and service-worker registration/scope.
- Include a manifest with stable app identity, icons (Whale-chan’s face, never DeepSeek’s logo), standalone display, start URL, and scope, plus an Apple touch icon. Cache the app shell and required local assets for offline reopening after the first successful caching pass.
- Provide concise iPhone Add to Home Screen guidance. Test browser and installed modes independently; do not promise that distinct installations share saved state. [Apple installation guidance](https://support.apple.com/guide/iphone/turn-a-website-into-an-app-iph42ab2f3a7/ios), [installation storage differences](https://web.dev/learn/pwa/installation)
- Limit the service worker to offline/cache/update responsibilities. It is not a persistent timer or alarm process; session recovery belongs in the app. [Service-worker lifecycle](https://web.dev/learn/pwa/service-workers)
- Namespace service-worker caches and storage for this app. Updates should remove obsolete app caches without interrupting an active timer or removing saved progress.
- Repository: GitHub account `Hughstudy` (from `gh auth`). Proposed repository `Hughstudy/clock`, public because GitHub Pages on a free plan requires it, giving the base path `/clock/`. Not created yet; create it only after milestone 2 is verified.
- At implementation, record tested browser versions: iPhone Safari and home-screen mode, Android Chrome and installed mode, plus a desktop browser for two-tab tests. Do not claim physical-device verification from desktop emulation alone.

## Implementation decisions

Recorded 2026-10-28.

- **Toolchain:** React 18.3, Vite 8, TypeScript 7 (strict, `exactOptionalPropertyTypes`), Vitest 5, rough.js 4.6, vite-plugin-pwa 2 (Workbox `generateSW`, `registerType: 'prompt'`). Nunito (Latin subset only) is bundled for offline typography. `npm audit` reports a low-severity `deepmerge` advisory inside build-time `workbox-build` only.
- **Boundary checks:** `tsconfig.logic.json` compiles `src/logic/` without DOM or Node types; `src/test/architecture.test.ts` rejects React/browser/clock/random use in `logic/` and runtime logic/adapter imports in components and screens.
- **Controls:** besides start/pause/resume/reset, breaks offer Skip break (readies focus, no credit, cadence unchanged). Reset returns the current phase to ready.
- **Writes:** each mutation runs under the Web Lock `<namespace>:snapshot`, re-reads storage, merges with tab memory (completion records are a grow-only set keyed by session id; timer/settings from the higher revision), then applies the pure action. Settings changes are field-level patches applied inside the lock, so quick edits cannot overwrite each other (found and fixed in browser testing).
- **No Web Locks:** saved data is shown read-only with a compatibility notice; controls are disabled.
- **Snapshot v2:** sessions store the IANA zone captured at start, and completion dates resolve in that zone. A v1 → v2 migration gives older sessions the device's current zone instead of dropping them.
- **Clock changes:** displayed remaining time and paused time are clamped to the captured duration.
- **Settings form:** shows edits optimistically until the save lands, so quick repeated taps build on the visible value (found in browser testing).
- **Recovery:** invalid fields are repaired individually after backing up the raw text to `whale-focus:snapshot:backup:<ms>`; if the backup fails (at load or when data turns unreadable mid-session), the original is left untouched and the app runs in memory.
- **Audio:** rejected `AudioContext.resume()` promises are caught; turning sound on plays a sample chime from that gesture. Newer snapshot versions make the app read-only; blocked storage runs in memory; failed writes show an error and retry on the next action.
- **Updates:** a new service worker waits; the “new version” notice appears only while no session is active and reloads only when tapped.
- **Base path:** the workflow passes `actions/configure-pages`’ `base_path` as `BASE_PATH`; Vite derives asset URLs, manifest `start_url`/`scope`/`id`, and service-worker scope from it.
- **Name and namespace:** “Whale Focus”; storage, lock and cache namespace `whale-focus`. The tomato build was never deployed, so its old keys needed no migration.
- **Character:** 62 path parts, 3 poses, palette, captions and timings live in `pet-spec.json` and are validated by `spec.ts`. Each part's rough.js seed depends on its name, so shared parts look identical across poses. `npm run icons` redraws the favicon from her face; `src/test/icon.test.ts` fails if it drifts.
- **Review fixes (2026-10-28):** a build break from the session-zone change, backup-less overwrite of unreadable data, dropped v1 timers, and uncaught audio rejections were all fixed with regression tests.

## Implementation milestones

### 1. Foundation and timer

- [x] Scaffold React 18 + matching React DOM/types + TypeScript + Vite with a lockfile, strict TypeScript, and React Strict Mode.
- [x] Add configuration data, domain types, pure timer transitions, and calendar/streak calculations.
- [x] Add versioned storage and browser adapters, including Web Locks, cross-tab coordination, and gesture-enabled sound.
- [x] Implement Home, Stats, and Settings with responsive styling and rough.js decorations (tomato theme, superseded).
- [x] Add focused tests for domain transitions, persistence recovery, and accounting edge cases (61 Vitest tests).

### 2. Theme, Whale-chan, and review gaps

- [x] Confirm the app and character names, then rename the app, storage/lock/cache namespaces, manifest, README, and title.
- [x] Replace all tomato visuals and wording: palette, app icon (Whale-chan’s face), cycle markers as rice bowls, “focus sessions” copy.
- [x] Add the `character` data section and `sketchCharacter` for idle, rice, and cry, plus the shared renderer. Quality gate passed on a rendered contact sheet and in the app.
- [x] Emit an `abandoned` event when an unexpired focus session is reset. Show the rice/cry reactions with configured durations. Add the rice counters.
- [x] Add the fan-art credit and non-affiliation note to Settings and the README.
- [x] Record the session-start time zone and resolve completion dates in that zone (snapshot v2 with migration).
- [x] Replace the no-Web-Locks fallback with the read-only compatibility state.
- [x] Clamp displayed remaining time and progress to the captured duration after manual clock changes.
- [x] Settings: local-only storage note, iPhone Add to Home Screen guidance, sound unlock from the toggle gesture.
- [x] Tests for the new events, time-zone dates, the read-only fallback, and clock clamping (79 Vitest tests). Visually reviewed all three poses.

### 3. Publish

- [x] Add PWA manifest, install icons (Whale-chan’s face), offline caching, and a safe update strategy.
- [x] Add a GitHub Actions workflow that installs from the lockfile, runs the tests, builds, and deploys `dist/`.
- [x] Document local development and deployment commands in a README.
- [ ] Create the GitHub repository, push, and set Pages to deploy from GitHub Actions.
- [ ] Pass the acceptance checks below and verify the deployed URL in a browser.

## Acceptance checks

Evidence so far (2026-10-28, local `vite preview` of the `/clock/` build in the desktop app’s Chromium pane, 375 px viewport): on the Whale Focus build, start → reset showed the cry with no credit; a simulated background expiry showed rice once, credited one session with its time zone, and readied the break; a reload did not replay the reaction; Stats, Settings, and fast settings taps behaved; the update prompt applied the new build; no console errors. On the earlier tomato build (same storage and timer code paths), two tabs settling one expiry, corrupted-storage backup, and offline reopening with the server stopped also passed. Boxes below stay unchecked until the deployed site is checked.

- [ ] `npm run build` passes, and the production app has no console errors during all core flows.
- [ ] Focus, short break, and every-fourth-focus long break follow the configured durations.
- [ ] Running and paused timers survive reload; changed settings do not alter an active session.
- [ ] Background expiry credits one session and leaves the next phase waiting to start.
- [ ] Reloads, repeated effects, and simultaneous tabs cannot duplicate or overwrite session credit.
- [ ] Concurrent settings/completion writes preserve both changes; missing Web Locks produces the documented read-only state.
- [ ] Resetting or abandoning an unexpired focus session grants no credit; resetting after expiry retains the earned completion.
- [ ] Midnight grouping, reopening on a later date, week boundaries, travel/time-zone changes, daylight-saving changes, and streak continuity are correct. Manual clock changes do not produce duplicate credit or invalid display values.
- [ ] Older/invalid storage and write failures produce recoverable behavior.
- [ ] The production repository subpath loads without missing assets; manifest and service-worker scopes are correct.
- [ ] Cold offline reopening works after caching, including installed mode; app updates preserve progress. Record observed browser-to-install storage behavior.
- [ ] Muted or blocked audio produces no error; restoring an old completed session does not replay its alarm.
- [ ] Whale-chan shows rice exactly once per newly credited focus completion and cries only when an unexpired focus session is reset; breaks, Skip break, tab switches, and reloads never trigger or replay a reaction.
- [ ] All three poses are visually reviewed at phone size, have text alternatives, and respect reduced motion.
- [ ] No tomato imagery or wording remains; the repository contains no copied fan art or DeepSeek logo/wordmark; the credit and non-affiliation note are present.
- [ ] Phone layout, install flow, sound toggle, keyboard use, and reduced motion are checked. Record any physical-device checks that could not be performed.

## References

- [Vite: GitHub Pages deployment](https://vite.dev/guide/static-deploy.html#github-pages)
- [rough.js: DOM-free generation and drawing instructions](https://github.com/rough-stuff/rough/wiki/RoughGenerator)
- [MDN: background page timing behavior](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API#policies_in_place_to_aid_background_page_performance)
- [MDN: PWA installability](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)
- Whale-chan style references (links only, not licensed for reuse): [success #2534](https://aigengtu.com/zh/meme/2534), [success alt #063](https://aigengtu.com/zh/meme/063), [cry #874](https://aigengtu.com/zh/meme/874)
