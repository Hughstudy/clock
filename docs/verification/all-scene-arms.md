# Arm motion across all eleven activities

The owner asked for the companion’s arms to keep a recognizable form throughout each activity. The comparison uses the production renderer at `07f9509` as the baseline. Both revisions use the same viewport, activity progress and gesture phase.

## What the baseline showed

The cooking scene produced the most visible size change. The serving hand reached down at 7% progress and became a small hook at 13%. The ladling hand made the same change between 65% and 73%. The smaller outline had about one third of the larger hand’s filled area. The page-turn and cover poses in F3, the cup lift in F4, the boat transfer in F6, the flag reach in F7 and the cup set-down in R3 also showed substantial changes. The planting scene, stargazing and cloud watching held their arm contours. The stretch rotated the same two shapes around their shoulders. The bubble wand used an articulated arm with fixed segment lengths.

## How the poses were checked

The local geometry sweep exercised 7,172 input combinations per activity. It sampled progress from 0 to 100% in 1,001 steps, independently varied the gesture at the four progress landmarks and sampled endings interrupted at several phases. Static running, paused and ended poses, along with held poses under pat, squish and high-five, were included. Bézier contours were sampled along the curves to measure filled area and perimeter, inspect shoulder attachment and detect crossing outlines. The same grip coordinates were compared with the actual drawn hand outlines. These are two-dimensional measurements. The full drawings show which surface the hand appears to touch.

The repeatable Vitest suite is `src/logic/scene-arm-contours.test.ts`. It checks short intermediate reaches as well as the endpoints and verifies that an interrupted ending starts with the arms in the held pose. Planted and rotated contours conserve projected filled area and perimeter to floating-point tolerance. For arms that bend, project regression limits are a maximum-to-minimum area ratio below 1.25 and a perimeter ratio below 1.16 across the activity. The perimeter check catches short, thick limbs turning into long, thin ones even when their area is similar. The numeric bounds complement the visual review of the hand, prop and body in context.

The browser review renders eight frames per activity from the production scene components. Each sheet is available in full color and with the arm outlines traced against the actual character and scenery. To regenerate them, run `node scripts/review-arm-poses.mjs`. Output goes into `.preview/arm-poses/`. Set `ARM_REVIEW_SOURCE` to an archived checkout and `ARM_REVIEW_OUTPUT` to a separate directory to compare two revisions at the same scale.

## Changes checked in the drawings

F1 now takes the two spoons from supports on the bench and turns the same arm contours at the shoulders. The bowls sit on the tabletop when parked. In F5, rounding the inner elbow reduces the dip along the inside edge of the wand arm from 8.46 to 2.82 drawing units. Its two segment lengths and the wand grip follow the same path. In the dense sweep, the maximum-to-minimum filled-area ratio for that arm decreased from 1.150 to 1.083.

The book sits diagonally and the hands share its cover during the handover. The seated tea pose keeps the kettle and cup close to the torso. Each grip remains legible as the companion pours, returns the kettle and brings the cup to its mouth. The paper boat reaches a nearby tray. In the block scene, the body follows the initial lift and the hand places the flag on a short outward arc. The rest cup reaches a closer saucer. The F2 plant hold, F8 stargazing and R2 cloud watching retain their stable arm drawings. R1 rotates the same two curves from the shoulders to stretch.

## Final measurements

Each number below is the larger of the two hands’ maximum-to-minimum ratios across the sweep. The two columns for each revision track the visible fill area and outline perimeter.

| Activity | Previous area | Previous perimeter | Revised area | Revised perimeter |
| --- | ---: | ---: | ---: | ---: |
| F1 serving food | 2.950 | 1.764 | 1.000 | 1.000 |
| F2 tending the plant | 1.000 | 1.000 | 1.000 | 1.000 |
| F3 reading | 1.836 | 1.457 | 1.112 | 1.146 |
| F4 making tea | 1.998 | 1.577 | 1.153 | 1.154 |
| F5 blowing bubbles | 1.150 | 1.044 | 1.083 | 1.128 |
| F6 folding a boat | 1.763 | 1.470 | 1.107 | 1.123 |
| F7 stacking blocks | 1.970 | 1.774 | 1.044 | 1.133 |
| F8 watching stars | 1.000 | 1.000 | 1.000 | 1.000 |
| R1 stretching | 1.000 | 1.000 | 1.000 | 1.000 |
| R2 watching clouds | 1.000 | 1.000 | 1.000 | 1.000 |
| R3 taking a sip | 1.629 | 1.370 | 1.106 | 1.116 |

All 13 dedicated contour tests passed. Across the 78,892 input combinations, the sampled outlines had zero detected self-crossings and the active grip points lay within or on the outlines of their hands. Chrome 156.0.8078.80 also tested each rendered shoulder origin against the body’s actual SVG fill. All 176 shoulder checks passed, including the seated tea pose’s body-local anchors at (74, 105) and (161, 105). This review used desktop Chrome on macOS 26.6.2. Physical phones were outside this pass.

The local release gallery is `.preview/arm-audit/final/index.html`. It links the 11 production sheets and the corresponding outlines. The six matched before/after comparisons are in `.preview/arm-audit/final/changes.png`. The four stages of the bubble-wand comparison are in `.preview/arm-audit/final/wand-changes.png`.
