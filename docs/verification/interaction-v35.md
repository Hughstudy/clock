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

## Delivery

Integration, publication and deployment are distinct. The completed source will be committed and pushed directly to `main` under the owner's standing workflow, then its exact GitHub Actions run and published `/clock/` build will be checked independently.
