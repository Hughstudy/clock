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

## Keeping the arm shape during the hold

The owner requested a cartoon reference for short arms handling a prop and pointed out the apparent growth. In Nintendo’s fishing still, Kirby holds the rod close to his lap while the shaft projects over the water. In Disney’s still of Pooh sitting with his honey pot, the vessel rests against his body and a paw wraps around its side. These are examples of how to stage a held pose. Our pot is supported by the bench, so a single resting palm is enough. [Nintendo fishing still](https://www.nintendo.com/ph/switch/arzg/assets/img/town/img_subgame_2.jpg) · [Disney film still](https://d23.com/app/uploads/2024/11/05_POOHGADV_04C_L.jpg)

For future reaches, place the handle within the character’s normal reach and keep the arm attached at the shoulder. If a larger movement is needed, let the body approach and show a clear shoulder-led arc before contact. Animation Mentor’s posing lesson demonstrates checking the silhouette, and Shawn Kelly’s prop lesson describes preserving the visible shoulder-to-wrist chain. These are design references for the companion. [Anthony Wong on posing](https://www.animationmentor.com/blog/tutorial-building-appealing-character-poses-for-animation/) · [Shawn Kelly on prop handling](https://www.animationmentor.com/blog/how-to-animate-your-character-when-hes-holding-a-prop/)

The F2 gesture at `c9551e3` moved the contact point down the fixed pot wall while holding the shoulder in place. Sampling its 1,120 ms gesture at one-millisecond intervals showed the shoulder-to-contact distance increasing from 33.71 to 37.31 drawing units. The filled area of the arm silhouette increased by 10.1%. The revised gesture holds both arm paths and the contact point fixed. The eyes briefly shift toward the seedling and settle. Reduced motion keeps the gaze still.

The same 1,121 samples of the revised gesture produced exactly the earlier resting outline throughout for both arms. Tests cover interrupted endings, touch and static poses. Strict TypeScript and 369 tests passed. The production build passed. Desktop Chrome 156.0.8078.80 rendered 18 poses and six application captures, including 320, 375 and 430 CSS pixels and 200% text. The full hand remained attached to the body and clear of the pot interior, with zero runtime or console errors in those checks. The measurements apply specifically to F2.
