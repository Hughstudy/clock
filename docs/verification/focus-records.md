# F1 first slice: implementation and verification

PRD v3 / revision 7. Branch: `codex/t04-focus-records`. This is a local development delivery, not a production deployment.

## Implemented contract

`src/contracts/focus.ts` is C1-F1. It re-exports the actual types consumed by this implementation; other windows can use them without duplicating the timer or persistence.

- `records` contains ended focus sessions (manual or deadline), with `elapsedMs`, `targetMs`, `startedAt`, `endedAt`, captured `dateKey`, `endReason`, and migration `source`. `startedAt` is null for unknown legacy starts. Zero elapsed milliseconds is legal.
- `participations` gets one stable session-ID entry on start. Refresh, pause, resume and end do not add entries. Legacy completion dates are retained without claiming they are known start dates.
- `timer.completedFocusCount` only counts fully elapsed focus sessions for break suggestions. Rest is available without completing focus.
- `UserAction` supports optional one-off `start.durationMinutes`, `startBreak`, `pause`, `resume`, `end`, `skipBreak`, field-level settings updates and `retrySave`. The hook supplies stable IDs and guards session commands against stale UI.
- `SaveState` distinguishes saving/saved/pending/memory-only/read-only. Reactions follow successful saves; recovery and external-tab events do not replay celebrations.
- Snapshot version 3 migrates v1/v2. Old clients already refuse newer schema versions. Append-only history and participation merge only within `datasetGeneration`; this prepares the boundary for later replacement/clear, without claiming those commands or note tombstones are implemented.

## Automatic save and recovery

Start, pause, resume and end save immediately under a short Web Lock. Running time is derived from the saved deadline. No tick-count accounting or unload handler is required. Background/closed time continues up to that deadline; reopening settles only that session, without starting another. Paused time never accrues.

A closed page cannot reliably be classified as an accident versus deliberate background focus. Closing therefore does not end the session. The explicit end action records the elapsed portion. Data not successfully written before a process dies cannot be promised recoverable; failure is shown, retained in memory, and retried while the page is alive. Local browser data can still be cleared/evicted. This is not cloud backup or a guaranteed locked-screen alarm.

## Collaboration integration

W-E's `7d8469bf147d91fb076a5743ed8ac1c851c04420` is an ancestor of this branch. Its companion hook and 10 behavior tests were retained. Both ending paths use the same temporary smile; current pause/running state overrides stale reactions. Integration uses one semantic `reactionSeconds.ended` setting and Chinese supportive copy; no cry pose or pressure copy remains in production flows. The legacy character and branding remain placeholders.

## Completed checks

- `npm run check`: strict TypeScript plus **117 tests in 12 files**, all passed.
- `BASE_PATH=/clock/ npm run build`: production build and PWA precache passed; 20 resources, about 321 KiB.
- Production assets served locally at `/clock/`, tested in Chromium **153.0.8010.0** using Playwright. No page or console errors.
- Browser flows: 8 minutes + 3-minute pause + 2 minutes = 10 minutes; reload while paused; one-second end; close and reopen after deadline; one record only and silent recovery; simultaneous two-tab ends; simulated quota failure followed by retry/reload preserving the original record ID and elapsed time.
- Layout/interaction: 320/375/430 CSS px, 200% text at 320 px, keyboard resume, reduced motion. Screenshot inspection prompted a dial-width fix for enlarged text. Chinese screenshot inspection used a locally installed Noto Sans SC fallback in the test environment; app uses local platform CJK fonts and introduces no font CDN.
- `git diff --check` passed. No dependency or lockfile changes.

## Reproduce the optional browser check

The browser harness is separate from the normal unit-test dependency set. Make `playwright` available to Node (locally or via `NODE_PATH`) and install its Chromium browser, then:

```bash
BASE_PATH=/clock/ npm run build
node scripts/verify-focus.cjs
```

The harness starts its own loopback server on an available port, creates isolated browser data and uses a controlled clock. `CLOCK_QA_CHROMIUM` can point to a compatible installed binary. `CLOCK_QA_OUTPUT_DIR` selects the local screenshot/report directory (default: OS temporary directory). On a system without Chinese fonts, optional `CLOCK_QA_FONT_DIR` can point to an installed `@fontsource/noto-sans-sc` package for visual inspection. The test uses synthetic data only.

## Remaining scope

No real iPhone/Android installation, lock-screen audio, service-worker update or offline-device testing has been completed here. Full 7/30-day review, thought capture, optional step text, rewards/favorites, backup/import/clear UI, final navigation, mascot and physical interactions remain separate tasks. The current record screen is a functional list, not the final F3 design.
