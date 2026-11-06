# Design pass, batch 2: motion

On November 6, 2026, after batch 1 was published, the owner asked for batches 2 and 3 to be done one after the other so they could check the final result. Batch 2 is the motion work from the [design pass](https://claude.ai/artifact/RhG9CnPzPA9zZzoE1rovEz). Most of it lives in animation-owned files: the companion renderer, its hooks, `blue-companion.css`, `companion-scenes.css` and the scene playback logic. The owner's request covers that; the [Animation Plan](../plans/ANIMATION_PLAN.md) records it for the animation workstream. No pose, contact or drawing changed.

## What changed

### Touching the creature

- The touch group is one stable element. It used to remount on every press, so its declared press transition never ran and a second tap jumped back to the squashed pose.
- A spring (`useTouchSpring`, with the pure `stepSpring` in `blue-touch.ts`) drives it. The press follows the finger with a quick critically damped spring (0.12 s, no bounce). The release uses a character spring (0.5 s, bounce 0.65) that overshoots through rest into a stretch or counter-tilt, which replaces the keyframes. A new tap, a cancel or the end of a touch retargets the same spring and keeps position and velocity. Finishing a touch still follows the existing timeout, so animation never ends application state.
- Press poses keep the previous values: squish `translateY(2px) scale(1.055, .94)`, pat with a 2° tilt, and high-five with a 3° tilt toward the touched side. The contact ring now fades over 360 ms instead of lasting the whole reaction.
- The dead `blue-touch-squish`, `blue-touch-pat` and `blue-touch-five` keyframes are removed.

### Breathing and stance

- Breathing no longer stops when a cue or touch starts. It moved an inner group and was cut mid-cycle, snapping the body about 2.8 px. It now continues under cues and touch, and also runs in the support stance. Blinking still pauses while touch shows happy eyes.
- A stance change eases into its tilt with the shared `--spring-gentle` curve instead of jumping in one frame.

### Starting or changing an activity

- `useLayerCrossfade` keeps the last committed drawing for 220 ms and fades it out above the incoming one (ease-in-out). Starting a session, or starting a rest from a result, reads as one moment instead of a cut. Only a fresh start with its permitted begin or rest cue fades; returning to preparation, navigation and recovery still cut. The timer and the buttons change immediately. Like every scene motion, it yields to attention. With Reduce Motion or the app's motion setting off, while a panel is open, or while the scene isn't allowed to move, the change is instant and an in-progress fade is removed.

### Hands at a steady pace

- Handling between progress landmarks takes 4.2 s (5.5 s for the bubble scene), up from 2.6 s and 4 s.
- `scenePace` re-times each handling move by the hands' own path: equal time for equal travel, plus a baseline of 25% of the mean speed so props that move while the hands rest still take visible time. Poses and contacts are unchanged; only when each pose is shown changes. Some actions packed their travel into a sliver of the span. The book scene's closing hand moved about 25 units in 1.4% of it and reached about 13 px per frame. Widening that pose window was tried, but it broke the arm-outline limit (perimeter ratio 1.24 against 1.16), so the fix is timing only.

Peak palm speed per 60 Hz frame at 375 px (1.69 CSS px per rig unit), computed from production poses through the playback easing. The calm target is 3 px per frame, 180 px/s.

| Scene and span | Before (2.6 s or 4 s, even easing) | After (4.2 s or 5.5 s, paced) |
| --- | ---: | ---: |
| F3 book, 0–40% | 3.87 px | 0.37 px |
| F3 book, 75–100% | 12.89 px | 1.14 px |
| F4 tea, 75–100% | 3.74 px | 1.03 px |
| F5 bubbles, each span | 2.25 px | 1.03 px |
| F6 boat, 75–100% | 5.17 px | 1.13 px |
| F7 blocks, 0–40% | 5.32 px | 1.32 px |
| F7 blocks, 75–100% | 7.97 px | 2.19 px |

Every other span was already under 1.3 px and is lower now. F2 and F8 have no hand travel during handling and keep the plain easing.

### Quiet while focusing

- During a focus session no new gesture starts between the start and the end. The 60–90 s beats are off for focus and still play during rest. Touch, the start, the end and progress handling are unchanged.

### Letting the page rest

- Scene playback paints host progress gaps under 0.002 at once instead of chasing them frame by frame. A 25-minute session advances about 0.00017 per countdown refresh. Measured during a running session: the scene's progress attribute is written 4 times per second, the countdown rate. The review measured the scene redrawing at 60 frames per second for the whole session.
- The scene's sub-pixel breathing loop (a 0.3% scale over 5 s) is removed. Steam, clouds, bubbles, the cloud-watching gaze and blinking now animate `transform` on groups without a transform attribute of their own, instead of the individual `translate` and `scale` properties.

### Motion tokens

`focus.css` defines one motion language: `--ease-out`, `--ease-in`, `--dur-quick`, `--dur-panel`, and two springs sampled from Apple's duration and bounce model into `linear()`. They are `--spring-gentle` (0.4 s, bounce 0.12, settles in 486 ms) and `--spring-soft` (0.5 s, bounce 0.3, 657 ms). Animation styles use them with fallbacks, so a page without the tokens still works.

## Verification

Environment: desktop Chrome 156.0.8078.80 on macOS, 375 × 812 emulation. No physical device.

- `tsc -b` passes. Vitest: 36 files, 397 tests, including new tests for the spring (press, overshoot and settle; velocity kept across a second tap; frame-gap clamp; area-preserving press), pacing (endpoints, monotonic, F3 peak below one third of even easing) and the progress snap.
- Touch, measured per frame under CDP touch input (press, release, a second tap 230 ms later, release): the largest one-frame change in vertical scale was 0.023. The review measured 0.10 jumps before. Vertical scale stayed between 0.940 and 1.018 and returned to rest.
- Crossfade: the outgoing drawing appeared on start, faded from 1 to 0 and was removed at 232 ms.
- `npm run test:e2e` passes: six suites, 395 checks, no browser page errors. `scripts/animation-review.mjs` passes 425 checks; across its 301 sampled frames the 95th-percentile frame time was 16.7 ms and the longest 16.8 ms, with none over 50 ms. Batch 2 changed four expectations. The crossfade's outgoing copy briefly duplicated scene parts, so the review tool now waits for the fade to end before inspecting parts. The crossfade is limited to a fresh start and cleared at once on attention, which keeps the fixture's "attention stops every scene animation" and the Settings round-trip checks passing unchanged. Two review timings moved from 2.6 s to 4.2 s handling. The preview fixture's touch checks now assert that a repeated tap keeps the same element, and that breathing continues during touch while blinking and the quiet hands pause. The animation review tool reads the transform-based gaze and uses the blink loop as its ambient-identity probe.

Not verified: frame timing and power on a physical iPhone, and how Safari composites SVG group transforms.
