# Animation refinement verification

Date: 2026-10-31 (Asia/Singapore). Baseline: `5119d1a863d89cf1201358d2e4a8addfc6b8e841`. The user approved implementation, validation and publication directly to main. This report covers the eleven-scene refinement and immediate scene access, not full P0 acceptance.

## Delivered behavior

- One deterministic production pose sampler supplies the soft rounded hands, body, props and contact anchors. Scene nodes persist through progress and cues; ambient loops keep their identity.
- Four achieved handling landmarks trigger finite 2.6-second action paths. Continuous steam/growth/sky detail follows precise C2-P3 host progress. Animation never computes elapsed session time or writes business data.
- Tea uses one constant-size cup, a small table, a supported kettle pour and a supported cup transfer. Food visibly develops vegetables, rice and soup, with two small utensils returning to their rests.
- Page turning/flat book closure, asymmetric paper folding and supported boat transfer, a fixed block inventory, rigid wand movement, upward stretching, gaze and supported rest poses share the same contact rules.
- Pause/touch retains supported geometry; attention/background/reduced-motion states settle safely without replaying old cues. Ending gestures preserve the interrupted action’s current pose before relaxing. Warm-drink endings carry the cup from its current sip height onto the saucer before release.
- All eight focus and three rest scenes are immediately available through independent saved bags. Snapshot v6/policy v2 preserves existing assignments and timing; active grants, claims and access notices are removed.

## Automated and browser checks

Environment: macOS 26.6.2 (25G83), desktop Chrome 156.0.8078.74, isolated Playwright profiles. Width checks are desktop emulation, not physical phones.

| Check | Result |
| --- | --- |
| `npm run check` | Strict TypeScript and 311 tests across 28 files passed |
| `npx tsc -p preview/animation/tsconfig.json` | Preview types passed |
| `/clock/` production build | Passed; generated PWA assets and service worker |
| `SCENE_BROWSER_CHANNEL=chrome npm run test:e2e` | 59 application checks, 30 touch checks and 67 scene lifecycle checks passed; no runtime/console errors |
| `node scripts/animation-review.mjs` | 420 checks passed: all eleven scenes at 320/375/430 widths, light/dark media, sampled progress, contact geometry, node/ambient identity, pause/resume, running/paused mid-sip endings, suspended-page recovery, cloud gaze, touch, reduced motion, 200% text and keyboard focus |
| `node scripts/verify-v5-compatibility.mjs` | Real archived v5 decoder/store became read-only for received updates, missed storage events and cold loads; no v6 bytes overwritten |
| `python3 docs/plans/assets/build-storyboards.py` | Deterministic export from production geometry; all 84 frame fragments and 20 SVG files parsed |
| `git diff --check` | Passed |

Dense geometry tests sample 1,001 adjacent handling positions and cover arm area/shoulder stability, continuous hand travel, exact scaled/rotated cup anchors, fixed utensil length, food progression, constant prop sizes and block inventory. These tests caught intermediate arm collapses that endpoint drawings did not reveal. Regression tests also cover the explicit 160/640/320 ms phases and exact first-frame continuity when an ending interrupts planting, wand movement, stretching or a sip. Browser checks freeze a genuine sip and end it both while running and while paused; a suspended-page fixture resumes at fresh host progress without playing missed handling.

Production flows cover all eight focus scenes **before any deadline completion**, no adjacent repeats, saved v6/v2 selections, pause/reload, short records, four-session break cadence, independent rest, another tab, keyboard controls, preferences and offline recovery. Existing model/storage tests retain failure, migration, stale-action and generation protection coverage.

Detailed reports: [production flows](animation-refinement/production-flows.json) and [animation/browser review](animation-refinement/browser-review.json).

## Visual and motion review

The correction loop inspected both landmark and intermediate poses. It corrected collapsed stretch/wand arms, the extended kettle grip, page support/flat closure, boat identity and transfer, the unused flag, and food utensils switching positions. Integration review then caught and corrected interrupted-action jumps and background recovery replay; a production lifecycle check also ensures foreground recovery preserves a fresh permitted entrance while cancelling old cues. Independent final still review found no remaining blocking contact/continuity issue in the inspected samples. Naturalness remains a visual judgment; this records the actual review rather than universal preference.

Final production contact sheets: [food](animation-refinement/F1-contacts.png), [book](animation-refinement/F3-contacts.png), [tea](animation-refinement/F4-contacts.png), [boat](animation-refinement/F6-contacts.png), [stretch](animation-refinement/R1-contacts.png), [clouds](animation-refinement/R2-contacts.png), [warm drink](animation-refinement/R3-contacts.png). The complete [catalogue](../plans/assets/scene-storyboards.json) and [contact sequences](../plans/assets/scene-contact-storyboards.json) export the same application geometry.

Normal-speed handling and slower exact-pose sweeps were recorded from the real renderer. Normal playback uses the production 2.6-second handling cursor; the slow sections inspect the critical pose intervals over approximately 5.4 seconds. Recordings: [tea](animation-refinement/F4-normal-and-slow.webm), [page turning](animation-refinement/F3-normal-and-slow.webm), [folding/lowering](animation-refinement/F6-normal-and-slow.webm). Sampled recorded frames were inspected for supported contact and progression: [tea filmstrip](animation-refinement/filmstrip-F4.png), [book filmstrip](animation-refinement/filmstrip-F3.png), [boat filmstrip](animation-refinement/filmstrip-F6.png).

A five-second real-clock browser sample including a handling action measured 301 frame intervals: median **16.7 ms**, p95 **16.8 ms**, maximum **16.8 ms**, with **zero intervals over 50 ms**. This supports refresh-rate smoothness in that desktop run; it is not a guarantee for other hardware or locked/background screens.

## Limits and publication

Physical iOS/Android devices, installed-PWA soft keyboards and screen readers were not available in this session. Desktop responsive checks do not substitute for those results. Browser storage durability and unrelated P0 proposals retain their existing limitations.

The live Library links could not be fetched. Supplied PRD/register snapshots and the user's explicit approved plan were used; no remote register was edited. The final commit is pushed directly to main under the user's authorized workflow. Publication and the exact GitHub Pages run are verified separately and reported with delivery; local build success alone is not deployment evidence.
