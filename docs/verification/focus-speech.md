# Focus: conversation at the edge of the plate

The owner selected the plate-edge design after comparing three proposals. The Focus page now puts “给我一句鼓励” in the same area that will hold its follow-up actions. After opening a short phrase, the person can read it over the companion’s head and find “换一句”, “收藏这句”, “换一种鼓励” and “收到鼓励了” together on the plate. The timer controls and the separate thought tools stay in place. The settings entry stays in the scene header.

Automatic remarks and requested speech share a curved tail anchored to the painted crown. Time, the scene and the plate have reserved spaces; the quote does not push the companion out of the way. If the person chooses a long quote, increases text size or uses a short viewport, the complete phrase can open in a single reading panel with timer status. Back/Escape returns from categories to the phrase, then closes reading and returns keyboard focus to the request button. Reading does not pause the timer. Favorites retain the existing confirmed/pending/error behavior.

The [Apple UI design guidance](https://developer.apple.com/design/tips/) informed the grouped controls and minimum target size. This web prototype uses 44 CSS pixels for its native button targets. Keeping the words at the speaker and the actions under the user’s hand is a design choice for this character. The [arm review](all-scene-arms.md) covers the activity artwork separately.

## Reproduction

- `scripts/scene-e2e.mjs` starts all eight focus and three rest activities through the production app. In each, it opens a short requested phrase, checks the tip against the actual drawn crown, checks the body of the bubble against the clock and both hands, then dismisses it and verifies that the same session is still running.
- `scripts/verify-v35-panels.mjs` checks portrait layouts at 320, 375 and 430 CSS pixels, a short landscape viewport, 200% root text, measuring the tea companion’s crown, same-quote resize, keyboard access and a simulated visual-viewport keyboard. `scripts/verify-focus-interactions.mjs` also checks that the thought toolbar remains available while reading and the timer controls stay in place. `scripts/verify-v35-persistence.mjs` exercises failed/waiting writes, retries, quote changes while a write is pending and cross-tab cancellation.

Strict TypeScript, 387 unit/renderer tests and the production build at `/clock/` passed. The full browser suite passed, including 115 app checks, 30 touch checks, 67 scene checks, 100 Focus checks and 141 adaptive-panel checks. Each of the eleven actual scene assignments kept both hands and its handled pottery within the horizontal viewport at 320, 375 and 430 pixels. Separate motion and scenery reviews passed 425 and 20 checks respectively. The browser reports recorded no runtime or console errors.

Verification ran in desktop Chrome 156.0.8078.80 on macOS 26.6.2. Phone sizes and the soft-keyboard viewport were emulated; this is not a physical iPhone or Android or screen-reader test.
