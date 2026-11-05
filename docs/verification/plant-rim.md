# Plant scene hand and pot

On November 5, 2026 the owner pointed out that the planting companion's hand still appeared to pass through the flowerpot. The [November 2 correction](visual-corrections-v35.md) had deliberately placed the palm over the front rim. The new drawing gives the hand a different contact point. Its rounded pad touches the outside of the pot, the elbow flexes above it, and the other palm rests on the bench. The seedling and the soil remain visible. The [four growth stages](../plans/assets/scene-storyboards/F2-plant.svg) use the production renderer.

## Visual checks

Desktop Chrome 156.0.8078.80 on macOS 26.6.2 rendered the former poses from commit `7f2fa42` and the corrected poses at the same scale. The 16 samples included four stages from seedling to flower, five points in the elbow gesture, three touch expressions, pause, early end, an interrupted gesture and reduced motion. Browser checks sampled both hand outlines against the pot in the same SVG coordinates. In the revised poses the closest hand meets the rim at its rightmost point, x = 106, while the rest of both hand fills stays outside. The visual inspection confirmed contact at the edge throughout the gesture.

On the production `/clock/` build, a fresh profile started focus sessions until the normal selection drew F2. The run used reduced motion. The tester captured the running scene at each portrait size, then paused and ended the same session at 375 × 812. A first pass exposed a clipped rim on tall phones. The final pot and foliage fit with the following space to the left viewport edge, measured in CSS pixels.

| Viewport | Text size | Rim inset | Foliage inset |
| --- | --- | --- | --- |
| 320 × 568 | 100% | 69.4 px | 72.2 px |
| 375 × 812 | 100% | 14.8 px | 20.0 px |
| 430 × 932 | 100% | 17.0 px | 22.9 px |
| 375 × 812 | 200% | 80.0 px | 83.2 px |

The running, paused and ended captures preserved the same edge contact at 375 × 812. All six captures fit horizontally. The browser reported zero runtime and console errors. These were desktop Chrome phone emulations. Physical-device rendering remains unverified.

## Regression checks

`src/logic/scene-plant.test.ts` samples the actual drawn arm paths against the pot and table, including static poses, the moving elbow and interrupted endings. The production scene suite passed 60 application checks, 30 touch checks and 67 scene checks. Local captures and browser measurements from this review are under `.preview/f2-review/final/`.

## Follow-up on arm posture

Later on November 5 the owner found the rim grip awkward. At phone scale the arm in `dceff3a` folded back close to the cheek, and the palm and elbow read as a single pinched shape. Both revised arms descend in one curve from the side of the body to a rounded end. The planting hand touches the tapered outer wall below the rim, slides 3.6 drawing units down the wall during the gesture and settles again. The far hand rests on the bench.

Chrome 156.0.8078.80 rendered 18 poses covering four stages of growth, six points in a gesture, three touch expressions, entrance, pause, early end, an interrupted gesture and reduced motion. The comparison used the same production renderer, crop, scale and gesture progress for both revisions. Each arm attached to the body in every pose. The browser sampled the actual hand outlines and both ceramic shapes. The nearest outline samples were within 0.13 SVG units in every pose, consistent with contact at the sloping sidewall. The matched images showed a rounded pad against the exterior with a clear soil opening throughout.

Six production captures repeated the ordinary Focus start, pause and early ending. They included 320 × 568, 375 × 812 and 430 × 932 CSS pixels and 200% text at 375 × 812. The left rim insets measured 69.4, 14.8, 17.0 and 80.0 CSS pixels, respectively. All six screens fit horizontally. Chrome reported zero runtime and console errors. Local evidence includes the same-scale `hand-before-after.png`, the 18-pose sheet, the phone screenshots and measurements under `.preview/f2-review/posture/final/`. These checks used desktop emulation.

The scene regression suite passed on the revised production build with 60 application checks, 30 touch checks and 67 scene checks.
