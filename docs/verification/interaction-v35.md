# PRD v35 interaction verification

Date: 2026-11-02. Scope: [the authorized interaction increment](../plans/INTERACTION_V35_PLAN.md), against [the preserved v35 source](../handoff-20261102/番茄钟_产品PRD_v35.md). The existing rough.js artwork and blue companion remain. This report does not establish acceptance of the full PRD.

## Implemented behavior

- Focus groups timing commands, keeps note tools in place, and separates preparation from starting. Expiry keeps an already-open end confirmation truthful. Waiting commands retain keyboard focus and reject duplicate activation.
- Encouragement uses one reader with category selection and Back behavior. Favorites capture the clicked quote, preserve original content/version, acknowledge only durable writes, and retain per-object retry feedback. Cancellation keeps a tombstone and clears saved text; re-favoriting captures the current version.
- Thought saves retain exact meaningful whitespace and the original item while the user continues typing. A competing draft cannot be overwritten by a delayed receipt. An unchanged marker is not reported saved until its draft retirement is durable. Failed edits/deletions keep the saved original readable; every eligible deletion remains undoable for ten minutes.
- Records has four views, compact statistics, full saved-note search, month selection and 20-item pages. Totals exclude unconfirmed results. Source return and cross-tab insertions preserve the open object and browsing position. Activity history uses actual saved scene assignments rather than hash-generated story outcomes.
- Settings has explicit sound audition, truthful blocked-playback feedback and local data/application explanations. PWA updates wait for handled inputs, finished sessions and confirmed writes, then check the latest shared state. Newer-schema recovery preserves unknown raw data.
- Native controls have at least 44px targets. Panels retain a local layout where space permits; small, enlarged-text or keyboard-constrained viewports use a bounded native modal with a scrollable body. Resizing retains the same input, selection and focus. Main owns live announcements, including quiet draft/settings failures.

## Validation environment

Local: macOS 26.6.2 (25G83), Node 26.12.1, Chrome 156.0.8078.74, Playwright 1.62.1, Vite 8.3.5, React 18.3.1. Production browser scripts build under `/clock/`, use isolated profiles and exercise actual localStorage/Web Locks/service workers. CI installs its own Chromium and uses Node 24.

Strict TypeScript, unit/architecture tests and the complete production-browser suite are run before publication. Reproducible commands:

```sh
npm run check
SCENE_BROWSER_CHANNEL=chrome npm run test:e2e
BASE_PATH=/clock/ npm run build
```

The final integrated run passed:

| Check | Result |
| --- | --- |
| Strict TypeScript and unit/architecture tests | 385 tests, 34 files, all pass |
| `/clock/` production build | Pass; 20 precached entries |
| [Timer/scene production flows](interaction-v35/scenes.json) | 60 checks plus 30 touch and 67 scene fixture checks |
| [Focus interactions](interaction-v35/focus.json) | 36 checks |
| [Records](interaction-v35/records.json) | 46 checks |
| [Persistence/failures](interaction-v35/persistence.json) | 21 checks |
| [PWA updates and sound](interaction-v35/update.json) | 15 checks |
| [Adaptive panels](interaction-v35/panels.json) | 69 checks |

All 247 production-browser checks and 97 presentation fixture checks passed. The six reports contain no runtime/console errors. The build produces `index-E0tJMRIF.js` and `index-dI876Itv.css`; these identify the application payload for the subsequent publication check.

## Coverage and limits

Browser checks cover short/zero sessions, pause/reload/expiry races, held presses, 11 scenes, reduced motion, offline recovery, multiple tabs, quota/lock failures, migration, durable-only projections, deletion/undo, favorites, full-history queries at 1,000/10,000 records, IME composition, source return and browser Back.

Layout coverage includes 320/375/430 CSS-pixel widths, 320×568, 320×850, 375×812, 430×932, landscape 568×320 and 850×320, and 200% root text. Panels are checked for visible close/save/category targets, horizontal overflow, focus containment and caret preservation. Visual-viewport keyboard changes are simulated. Actual physical iPhone/Android keyboards, installation behavior and screen readers remain unverified.

Persistent cottage/room objects, object dialogue/provenance, authored DAY05+ continuation and full JSON backup/replacement/clear are outside this increment. Browser storage remains local and can be removed or evicted; this update adds no cloud durability or locked-screen alarm guarantee.

Generated screenshots/recordings remain ignored local evidence in `.preview/`; none are committed. Maintained documentation is English, while supplied snapshots and UI copy retain their original language.

## Interaction review follow-up (2026-11-03)

After a first-use review, the owner approved five fixes. Banner wording, the dial's lap rule and the ten-second message period are implementation choices within that approval.

- **Timer endings away from Focus:** Records and Settings show a floating notice with the result and save state, offering 「查看结果」 or 「回到专注」 and 「知道了」. It uses the app's single live region, names the ending in the tab title and does not move the page. An ending already seen on Focus is not repeated. A deadline settled first by another tab is reported the same way, including the Focus result; a manual end in another tab is not. A later successful retry updates the announcement as well as the banner. Sound still defaults to off.
- **Adjusting the duration:** the digits show a pencil, and tapping either opens the dial. After review the owner removed the long-press gesture and the text hint, so holding 「开始专注」 just starts the focus on release.
- **Dial:** touching the face moves the hand to that minute on the current lap, with the top mark as 60. Dragging then follows the finger, crosses twelve into the next lap and rejoins after passing either limit.
- **Dial position:** the panel now sits directly under the digits. Previously it was anchored to the plate's bottom edge, which put 「用这个时长」 under navigation at 320×568.
- **Remembered length:** the wording now says a started length carries to the next session, matching `nextFocusMinutes`. The behavior is unchanged.
- **Stale messages:** thought success text leaves after 10 seconds (`thoughts.statusVisibleSeconds`), but stays while keyboard focus is in the feedback row or status panel. 「撤销标记」 and 「补充文字」 stay until the next thought action or a session change. Undoing a mark keeps a named 「撤销删除：空标记」 on Focus for the ten-minute period; deletions made on Records stay in the Records list. The offline-ready note leaves like the text. Failures stay until resolved. Details appears only for failures, unsaved states and system notices. Favorite status messages are unchanged.

Checks: `scripts/check-timer-notices.mjs` and additions to `scripts/check-dial-gestures.mjs`, run as part of `npm run test:e2e`, with unit tests for the dial mapping. Physical touch devices and screen readers remain unverified.

- **Plate height:** the note tools and feedback share two rows instead of three, returning 48px to the scene at 375×812. 「本段想法」 replaces the 「随手记」 label when a session has thoughts, and 「继续草稿」 moved into the feedback row. Reading an encouragement borrows the feedback row unless something needs attention, so the plate keeps its height.

## Architecture cleanup (2026-11-03)

After an architecture review, the owner approved a deletion-only pass with no intended behavior change:

- Removed the old whale, rice-bowl, streak, week-total, cycle and story-art code that no live path used, and the unreferenced `scripts/verify-focus-v35.mjs`. The character data stays because the icon test still draws from it.
- Reduced `CompanionFeedback` to the pat button its one caller used.
- Removed feedback events, context fields, pools and static placement for welcome, return, records-view, memento and reward features that never fire. The catalog parser now checks structure rather than exact counts, and the copy file holds only text the app uses. All removed text was confirmed present in the PRD v35 snapshot, so those features can restore it when they are built.
- Removed about 80 CSS rules whose classes are never rendered.

Sixteen app states at 375×812, 320×568 and 1280×800 were compared pixel for pixel against the previous build with a frozen clock and reduced motion. Forty-seven of the 48 screenshots were identical. The remaining one, the running Focus screen at 375×812, also differs intermittently when the old build is compared with itself, so it is rendering noise, not a change. Error states are covered by the browser suite rather than this comparison. Generated screenshots are not committed.

## Delivery

Integration commit: [`dda7754df87705d21de7c195d7e7a15899b053b4`](https://github.com/Hughstudy/clock/commit/dda7754df87705d21de7c195d7e7a15899b053b4), pushed directly to `main`. Local and remote-tracking main matched, with a clean working tree after that commit.

[GitHub Actions run 41455692604](https://github.com/Hughstudy/clock/actions/runs/41455692604) completed successfully for that exact source commit: both build (including unit/browser checks) and Pages deployment passed.

The [published application](https://hughstudy.github.io/clock/) was independently checked at 2026-11-02 13:47:59 UTC in a new Chrome profile. HTTP 200 and the JavaScript/CSS hashes match the locally tested payload. Start, pause and manual end saved one record; an encouragement favorite appeared in Records; snapshot v8 retained one ended record and no active timer. No browser runtime/console errors occurred. See [publication evidence](interaction-v35/publication.json).

This documentation follow-up records the completed publication without changing the application payload.
