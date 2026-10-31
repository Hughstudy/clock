# Orchard scenery and companion motion verification

Verified on 2026-10-31 in the Windows development checkout. The [research and implementation log](../plans/COMPANION_SCENERY_AND_MOTION.md) records the findings that motivated the changes.

## What the app looks like

- [Normal-speed motion recording](companion-scenery/companion-motion.webm) shows the book closing, the wand emerging from its jar and the rest stretch in 12.36 seconds. The production renderer plays each action at normal speed. The fixture advances the host's session milestones between shots.
- [All eleven activities](companion-scenery/scenery-catalogue.png) show the workroom, garden terrace and dusk palette. The ready character shares its coat shading and eye highlights with the activity renderer.
- [Production timer at three phone widths](companion-scenery/scenery-widths.png) shows ready, tea, planting and stargazing at 320, 375 and 430 CSS pixels. The real app selected these scenes through normal starts. The stills use reduced motion.
- The [book](../plans/assets/scene-contact-storyboards/book-page.svg), [wand](../plans/assets/scene-contact-storyboards/wand-turn.svg), [boat](../plans/assets/scene-contact-storyboards/boat-fold.svg) and [tower](../plans/assets/scene-contact-storyboards/block-place.svg) sheets show the hand and supporting surface through the revised actions.

The first visual pass exposed a blue oval extending below the workroom floor. A small foot shadow now grounds the ready character. Further inspection led to a shallower book closure, moving the bubble ring clear of the eye, an outlined flag and a warm-drink steam curl that moves away from the face.

## Checks

| Area | Result |
| --- | --- |
| App and preview TypeScript | Both passed. |
| Unit and renderer tests | 317 passed across 28 files. The favicon snapshot initially differed only in the checkout line ending. The file matched its Git blob after LF normalization, and the full suite passed using those committed bytes. |
| Production build | Built with base `/clock/`, including the manifest and offline service worker. |
| Real app and fixtures | 59 production checks, 30 touch checks and 67 lifecycle checks passed. These cover start, pause, end, the scene preference, two tabs, offline reload and keyboard input. |
| Scenery | 20 checks passed in Chromium 151.0.7922.34. Checks include draw order, fixed decorations, face and hand clearance around the clock, reduced motion and overflow. [Detailed results](companion-scenery/scenery-review.json) |
| Animation browser review | 425 checks passed in the same browser with no page or console errors. A five-second foreground run recorded 600 frame intervals, a median of 8.3 ms and a maximum of 8.9 ms on this desktop. The separate changing-clock regression checks that the gesture itself advances across 250 ms timer readings. |
| Geometry export | The production sampler exported 44 catalogue drawings and 47 contact drawings. All 20 SVG sheets parse, and their local clipping and paint references resolve to unique IDs. |

The regression suite exercises changing host progress during a 2.6-second handling action, opening and closing a panel mid-reach, interrupted rest actions, jar clearance, continuous support of the closing cover, limb silhouette area and the block contact heights. The desktop checks include 200% text and simulated phone widths. Physical iPhone and Android playback and user testing of the character's emotional appeal remain open.

The source snapshots supplied with the checkout were used for the product baseline. The live PRD and shared register links could not be retrieved during this pass.
