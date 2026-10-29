# Friendly companion continuation — 2026-10-29

## Baseline and scope

The local checkout started at `0a57d037bb472bc9f4035196bca2c4c7f0529955`. The user supplied `~/Downloads/番茄钟_PRD与最新代码_20261029` (the requested `~/Download` directory did not exist). All 96 source files matched the export manifest's sizes and SHA-256 hashes. The exported source represents `57ca8697cfa3a694f5e319e00d8dc4ee38b4c907`, including F1 `4e7c9d50261af0b81a880716a36a691ede3b004f` and the positive-feedback cleanup.

Imported the complete source snapshot so actual-time records, snapshot v3 migration, participation, retry and semantic feedback stay compatible. PRD v3/revision 7 and the collaboration register/revision 9 are retained under `docs/handoff-20261029/` as historical references. No cloud register was modified. Local work is on `codex/friendly-companion`; main and GitHub Pages were not updated.

The user explicitly chose “a soft, round blue creature with expressive little arms.” The new original rough.js creature has seven static stances, finite wave/start/ending gestures, a grounded squash-and-rebound, and quiet focus. It replaces the legacy character on Home. No fan artwork was imported. The existing product name and install icons remain temporary, with accurate provenance in Settings and README.

T30 now consumes actual saved operations. Its transient memory lives above navigation. No copy rotation or drawing regeneration occurs on countdown ticks. Restore, cross-tab sync, stale actions and navigation cannot replay a gesture; failures suppress success cues. A user can request/change/dismiss encouragement, without an unimplemented bookmark control. Manual and elapsed endings have equal gestures. Motion can be disabled through saved settings, and the system's reduced-motion setting takes precedence. The two main destinations are Focus and Records; Settings is reached from the header.

## Automated verification

Environment: Node `v26.12.1`, npm `11.20.0`; committed dependency inputs unchanged (React/React DOM 18.3.1, Vite 8.3.5, TypeScript 7.0.2, Vitest 5.0.5 as installed).

- `npm run check`: strict TypeScript and **193 tests in 17 files passed**.
- `BASE_PATH=/clock/ npm run build`: passed; 20 app-shell entries precached, about 407 KiB. No remote character/font/CDN dependencies were added.
- `git diff --check`: passed.
- Regression coverage includes actual short sessions and pause exclusion, zero/short/full ending equivalence, deadline/start races, stale commands, migration, settings patches, concurrent writes and failed saves. New cases cover semantic mapping, event deduplication, silent recovery/sync, hidden-screen consumption, failed-write priority, static motion and backward-compatible motion settings.
- A review found two integration issues and they were fixed: saving status could be hidden behind requested encouragement; save failures could be announced twice. Saving is now visible, and one live-region owner is selected for the active screen.

## Production browser verification

Tested the built `/clock/` app via Vite preview in the desktop app's Chromium browser, reported user agent `Chrome/156.0.0.0` on macOS. This is desktop emulation, not a physical phone or installed PWA.

- Inspected the original character's seven poses at 240 × 190 and the integrated app at **320, 375 and 430 CSS pixels**. No horizontal overflow in the final checked layouts.
- Tested **200% root text at 320 pixels** in an isolated HTML harness loading the same production bundle. Long encouragement text remained readable, controls wrapped, and Enter changed the phrase with focus retained. A small header overflow was corrected; final `clientWidth` and `scrollWidth` were both 305 (320 minus scrollbar). The QA HTML was removed from `dist/` and was never included in the precache.
- Clicking the creature produced the `support` cue and raised-arm pose. Keyboard “换一句” produced a new cue. After the finite animation, `data-cue` returned to empty. The start cue ran once and focus then stayed still. Pause/rest/ending poses were inspected.
- Quick-started five minutes; paused, reloaded, and resumed. The paused time stayed fixed and recovery emitted no live announcement/cue. Ended early; the actual **17 seconds** were saved and shown in Records, excluding the pause.
- Set one minute, started, **closed the tab**, and reopened after the deadline. Exactly one one-minute record appeared; the break remained ready for explicit start. Further reloads kept two total records and replayed no animation or alarm.
- Turned animation off; requested encouragement retained its expressive static pose (`data-static=true`, empty cue). Reload preserved the preference. Re-enabled it and restored default durations. Sound was muted during timing checks.
- Opened two tabs. Starting in one synchronized the running session in the other without a gesture or announcement. Ending in the initiating tab created one additional 25-second record; the other tab updated silently. Total: three records, **1 minute 42 seconds**, preserved after subsequent reopening.
- Started/paused a freely available break, then returned to focus. No focus credit was added for rest. The break footer explicitly says rest is excluded from focus time.
- Applied PWA updates through the ready-state prompt. Settings/history remained intact. No update prompt appeared in the tested active-session flows.
- **Cold offline reopening:** closed both tabs and stopped the preview server; opened a new tab at the app URL. The cached character, timer, navigation, encouragement and all three historical records worked. Restarted the server for the user preview afterward.
- No app console warnings/errors were captured in the normal production flows.

## Remaining verification and product work

Actual iPhone/Android browser and home-screen installation, installed-mode storage/offline, soft keyboard, locked-screen recovery, sound listening, real screen-reader listening, and a real OS reduced-motion toggle still need device checks. The reduced-motion mapping/CSS and the app's persisted static mode are verified; this is not a claim of physical-device accessibility acceptance.

F2 notes, full F3 history/reflection, bookmark/reward persistence, JSON export/replacement restore/clear, final branding/icons, and public deployment remain separate work. The animation prototype uses its own ground/contact shadow; moving or deforming real controls remains unselected. The full PRD/P0 is not complete.
