# v35 screenshot-review corrections

Date: 2026-11-02. The owner identified excessive blank space below the Records modes and a visibly detached hand beside the F2 flowerpot in the deployed screenshots. This follow-up is limited to those presentation issues, retaining the blue character, current drawing style and timer/persistence semantics.

## Root causes and changes

The Records view reserved two status tracks even when both messages were empty. A paragraph of at least 2.8em plus a 44px application-status row and surrounding gaps pushed the list down. Status now occupies a compact, fixed-size entry beside the page title. Active timing and concurrent save/system issues remain visible; full details use the existing local panel. Feedback changes leave mode controls and list positions unchanged.

F2 blended the resting hand only 25% toward its nominal pot contact. Static, paused and ended states therefore kept a hand hovering beside the pot. The nominal contact also differed from the visible rim. Hand contact and the rendered pot now share geometry. The rounded palm rests across the near rim throughout its small sliding gesture, and the other hand rests on the tabletop. The actual arm boundary, overlap order, shoulder attachment and supported pot were checked, including intermediate and interrupted gestures. Updated F2 production storyboards use the same renderer.

## Verification and delivery

Local environment: macOS 26.6.2, Node 26.12.1, Chrome 156.0.8078.74. Production builds use `/clock/`.

| Check | Result |
| --- | --- |
| `npm run check` | Strict TypeScript and 387 tests across 35 files passed. |
| `BASE_PATH=/clock/ npm run build` | Passed; JS `index-BqFkYjc_.js`, CSS `index-DPFRM9Si.css`. |
| Records production browser suite | [94 checks passed](visual-corrections-v35/records.json), no runtime/console errors. |
| Scene production browser suite | [60 application checks, 30 touch fixtures and 67 scene fixtures passed](visual-corrections-v35/scenes.json), no runtime/console errors. |
| Rendered plant geometry | Two tests cover 434 poses: running/paused/ended, partial/full progress, static rendering, gesture and interrupted ending samples. The assertions inspect emitted SVG paths and the drawn rim, not just contact metadata. |
| Browser SVG contact | [12 frames passed](visual-corrections-v35/plant-contact.json); transformed rim samples overlap the distal palm in the actual SVG. |
| Matched phone screenshots | [375×812 CSS px at DPR 2](visual-corrections-v35/comparison.json): the gap below the mode buttons changed from 105.97px to 15.98px; both captures had no runtime/console errors. |

Records checks cover 320/375/430px at 100% and 200% text. Quiet, peer-tab running, paused, concurrent save failure, retry and expiry preserve header/mode/list positions within 1px. The status panel retains full timing and recovery details, supports browser Back and restores focus. Visual review includes the 320px/200% concurrent-issue state and real production F2 running, paused and early-ended phone captures with reduced motion.

Screenshots use a disposable browser profile and demo data. Generated screenshots remain local under `.preview/`; none are committed. Desktop emulation does not establish physical-phone or screen-reader acceptance. Timer accounting, storage schema and scene-selection behavior are unchanged.

Delivery follows the authorized direct-to-main workflow. Local checks above precede the commit; GitHub Actions and the live [Pages application](https://hughstudy.github.io/clock/) are verified separately after push. This report records local verification, not a claim of full PRD acceptance.
