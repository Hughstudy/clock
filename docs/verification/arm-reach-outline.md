# Arm reach outline

On November 4, 2026 the owner reported that the companion's hand motion still looked unnatural, with an odd twist, and asked for it to be handled. This records what was found, what changed in `src/logic/scene-pose.ts`, and how it was checked.

## What was wrong

A scan of all eleven scenes sampled each arm's rendered outline at 240 positions of activity progress and of every action, testing for self-intersection, collapsed outlines and large frame-to-frame moves, and rendered the flagged frames from the animation preview. Three layers produced the twist:

- Reaches use a generated arm (`bentReach`) while the resting, pressing, cup and page poses are drawn outlines. The generated arm was a 12-unit tube with a hard elbow, against drawn arms about 16 units wide with a round palm. Blocks, boat, book and bubble reaches all showed it.
- The sixteen points of that tube were polyline vertices, but `sceneArmPath` draws every arm as cubic curves, so the tube pinched and bulged.
- `towerReach` placed the elbow a fixed distance down and to the left of the reach's midpoint. For the down-and-left reaches of the blocks scene that offset ran along the reach, so the elbow landed a few units from the palm and the arm folded on itself; the side the outline bowed to also flipped between frames as the hand swung past the shoulder. On the second block's lift the top-left grip passed through the shoulder point itself.

## What changed

- `bentReach` now emits cubic controls: half-widths of 8 at the shoulder and 7 at the elbow, a round palm of radius 9, a smooth elbow whose outline tangent bisects the two limbs and widens with the bend, and a slim to 76% over long reaches so a stretched arm stays comparable to the rest arm. The outer side of the bend follows the side the elbow actually bows to, so it never flips.
- `towerReach` keeps only the part of its outward-and-down bow that is square to the reach, with a smaller bow, so an arm reaching in that direction stays straight instead of growing an elbow at the palm.
- The blocks scene's second lift: the left hand joins once the slide has brought the block in front of the body, glides from the block's top-left corner to underneath it for the rise past the shoulder, and returns to the corner to set it down. The lift starts after the hand has settled.

### The blocks scene

After the outline fix the owner still saw the arm stretched in the blocks scene, and judged the stacked blocks as about to fall. Both came from the scene's layout: the blocks lay on the floor mat up to 66 units from the shoulder (the rest arm reaches 33), and the second and third blocks sat 12 units off the base block's edge. The scene was reworked:

- The blocks are on the low table the reading, tea and food scenes already use, so every grip is 17–46 units from the shoulder; the reach arm no longer slims below 90% of the drawn width.
- The two blocks to move start as a small stack in front of the left hand. The top one is lifted to chest height by its near face, the hand sliding up to its top corner, carried across above the shoulder and set squarely on the base. The lower one slides along the table to stand against the base, and the flag goes on top of the stacked pair. The finished pair plus step cannot topple, and the right hand rests throughout instead of sliding a block across the body.
- The flag's stand moved from the floor onto the table, and the scene's `usesTable` list now includes the blocks; those two values are the only change outside `scene-pose.ts`.

### The tea scene

The kettle hand was a drawn outline of fingers curled round the handle, blended point for point with the drawn rest arm, whose points go round a paddle. Between 55% and 80% the mid-blend frames read as a twisted flat strip, and the hand itself was thin. The reach now uses the generated arm with the shoulder seated with the shifted body. Its elbow rises square to the reach, so the forearm comes down onto the handle from above; with the elbow below, the plump forearm lay across the kettle's spout and lid, which the owner saw as the arm overlapping the kettle. To make that blend safe, `bentReach` now orders its outline by which side of the reach it starts on, matching the drawn arms; without that, a reach whose bend lies on the far side folded the arm through itself mid-blend. The cup hands remain drawn outlines.

Other drawn poses and their blends are unchanged. The tea scene's kettle hand still blends two drawn outlines whose points do not correspond, so its mid-reach frame remains the least tidy; that is a separate authoring question.

## Verification

- Outline scan after the change: no self-intersections or collapsed outlines in any scene, action or position. Area ratios between the smallest and largest left-arm outline: blocks 1.97, boat 1.60, book 1.84, tea 2.28 (the existing test bound of 2.1 covers the boat and blocks carries). The blocks test now checks the stacked pair, the step beside it and the flag's footprint.
- `vitest`: 34 files, 366 tests, including the existing pose, food, plant and renderer suites; the hand-jump, contact, face-clearance and area tests pass unchanged.
- `tsc -b`, the `/clock/` production build and `scripts/scene-e2e.mjs` (60 app, 30 touch and 67 scene checks) in desktop Chrome 156.0.8078.80. `scripts/verify-scenery.mjs` was not usable: it still waits for an end-confirmation button named 「结束并记录」, which the v35 copy renamed, so it times out on the committed code as well; it is not part of `npm run test:e2e`.
- Rendered frames from the animation preview were reviewed for the blocks, book, tea, boat, bubble and food scenes before and after.

Physical devices and the live timing of beats on a real session were not re-recorded; the geometry is sampled identically in production and in the preview.
