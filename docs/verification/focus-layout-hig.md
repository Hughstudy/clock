# Focus layout against Apple's Human Interface Guidelines

On November 4, 2026 the owner asked why the Focus page had so much empty space and looked ordinary, reviewed a throwaway styled prototype against mainstream focus and companion apps, and then asked for the page, including its buttons, to follow Apple's Human Interface Guidelines. This report records what changed, which guideline each change answers, and what was verified. It builds on the companion-first layout in [companion-first.md](companion-first.md).

## Guideline sources

Apple's Layout, Typography, Color, Buttons, Tab bars and Toolbars pages were read in full on November 4, 2026. They are written for native iOS; the numbers that transfer are the 44 × 44 pt hit region, the 11 pt minimum and 17 pt default text sizes, and the rules below. They give no phone margin values, contrast ratio or color count, and nothing about how much of a screen a character should fill. Those remained project decisions.

## What changed and why

| Guideline | Before | Now |
| --- | --- | --- |
| Do not put a solid fill under controls; extend content under bars | A solid cream plate cut the screen at 61%; the tab bar had a solid strip | The scene runs the full height. The console is one translucent card floating over the room's floor band, and the tab bar is a floating translucent capsule |
| Order by importance, top to bottom | The time sat in the plate below the character | The time reads above the companion's head, above its speech bubble when there is one |
| Minimum 11 pt, default 17 pt; avoid light weights | Secondary text at 12 px with weights 700–800 everywhere | Secondary text 13–15 px, Regular/Medium; only the time is heavy |
| One color, one meaning | Two `--ink` values and one blue for both interactive and static text | One ink, one muted and one brand blue, shared by every stylesheet. Interactive text is brand blue; static text is muted |
| One or two prominent buttons per view; style, not size, marks the preferred option | A wide filled primary beside a narrow bordered secondary | Two equal capsules: the main action carries the accent fill, the other a neutral fill with accent text |
| Capsules for text buttons, circles for icon buttons, a press state on custom buttons | Mixed radii, no press state | Capsules and the circular settings button; every button scales to 96% while pressed |
| Group with space before lines | A rule and a label above the thought tools | The tools are one centered row, grouped by space |
| Tab bars navigate, float over content, show icon above label | Icon beside label on a strip | Icon over label in a floating capsule; the current tab is tinted |
| Enlarged text keeps the primary content | A fixed tools row clipped at 200% | The tools wrap; the time and the main action stay complete |

The feedback row no longer reserves a line. It appears as a chip above the card only while a save, draft, undo or notice needs attention. The duration ruler replaces the card and grows upward over the floor band, and the time keeps reading above the companion while a draft changes it.

Dark mode remains out of scope. The dusk scene gets light time digits so the readout stays legible on its sky.

## Geometry

The companion's art box ends at the floor band (`--art-clear`), so growing the card for the encouragement reader or the ruler covers the companion's feet instead of moving it. `useSceneFit` now also reserves the time and a one-line bubble above the head and publishes the rendered art width, since the container units that size the art resolve differently outside the art box. A taller bubble lifts the time; a one-line bubble coming or going does not.

Measurements in CSS pixels from desktop Chrome 156.0.8078.80 with a first-use profile:

| Viewport | Card height | Console band incl. tab bar | Time readout | Smallest hit area | Smallest text |
| --- | ---: | ---: | --- | ---: | ---: |
| 375 × 812 | 142 | 224 | 153–197 | 44 | 12 (tab labels) |
| 430 × 932 | 142 | 224 | 224–268 | 44 | 12 |
| 360 × 640 | 142 | 224 | 69–113 | 44 | 12 |
| 320 × 568 | 142 | 224 | 69–113 | 44 | 12 |
| 375 × 812 at 200% text | 252 | 342 | 59–140 | 44 | 24 |
| 844 × 390 landscape | card beside the scene | tab bar in the card's column | 58–102 | 44 | 12 |

At 320 × 568 the room card's edges show, as the existing framed fallback allows; there is not enough height for both the time and a full-width room. No horizontal overflow at any size. Opening the thought, end, status and encouragement panels, pausing, ending, the result and rest states were captured; the encouragement reader opens without moving the scene, the time, the main action or the tab bar.

## Automated checks

- `tsc -b` and `vitest run`: 34 files, 366 tests, including the new scene-fit reservation tests.
- `npm run build` with the `/clock/` base.
- `npm run test:e2e` with desktop Chrome: scene, focus interactions, records, persistence, update and panel scripts. The duration-ruler check now treats the time as beside, not above, the ruler in landscape, since the time no longer lives in the card.

## Not covered

Physical iPhone and Android devices, installed PWA behavior, screen readers and the dusk scene were not exercised in this pass. The empty wall above the time on tall phones is where room artwork belongs; that is scene art, owned by the animation workstream, and was not changed here. The equal-width button pair departs from the November 1 mockup's wide primary; it follows the Buttons guideline and is a one-line change to revert.
