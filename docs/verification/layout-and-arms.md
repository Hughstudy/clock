# Focus layout on iPhone and iPad, and arm placement — verification

Date: 2026-11-01. Requested by the owner: "make sure the iPad and iPhone layouts are right, with no overlapping layers, and check the arm positions for odd overlaps." All runs used desktop Chrome 156.0.8078.74 with viewport emulation. **No physical iPhone or iPad was used**, so safe areas, the real soft keyboard and Safari rendering remain unverified.

## What was wrong

Measured with a layout audit over nine viewports and fourteen Focus states. Screenshots are in [layout-and-arms/](layout-and-arms/).

- **Panels covered the creature.** The custom-length, thought and end panels sat over the scene, so on every device the creature's face showed half above the card.
- **The requested bubble covered the head** on 375×667, and in landscape on both iPhone and iPad.
- **Landscape cropped the head.** On iPad landscape the art was scaled to the full screen width, so the head was cut off. On iPhone landscape the top buttons sat on the tuft.
- **Arms and props crossed the face.** Per-frame sampling of every scene found these problems:
  - F7 blocks: the left arm covered the left eye for a long stretch (progress 0.58–0.88), a carried block covered the eye and mouth, and the arm arched over the tower.
  - F3 book: closing the book, both arms crossed in front of the mouth, and the page hand clipped the right eye.
  - F4 tea: the final hold kept the cup over the mouth, and its steam rose into the face.
  - R3 drink: setting the cup down arced it across the right cheek, and its steam crossed the left cheek.

## What changed

**Layout** (`focus.css`, `useSceneFit`, `logic/scene-fit.ts`)
- **Art size.** The art's width comes from one formula on the scene box:
  - it covers the scene's width;
  - it grows with the height up to the earlier 470px box;
  - it never lifts the head into a reserve kept for the top buttons and a two-line bubble.
- **Bubble.** The bubble now sits just above the creature's head instead of at a fixed height.
- **Making room.** When a requested bubble or a local panel needs space, the art first moves up, so the creature stands on the panel. It shrinks only if moving is not enough.
  - If the painted card's edges would show, the whole card is kept clear.
  - Below 40% the creature steps out rather than appearing tiny. This happens only for the thought editor on a 375×667 phone and in iPhone landscape.
- **Passing lines.** The companion's passing line hides while a panel is open.
- **Requested bubble.** 「换一种鼓励」 now sits in the same row as 「换一句」 and 「收到鼓励了」. The four categories open only when it is tapped, which keeps the bubble short.
- **Landscape.** At any landscape size wider than 6:5 (iPhone, iPad, desktop), the scene sits beside the plate. On short screens the plate takes extra width so the art still covers the scene.

**Arms** (`logic/scene-pose.ts`, `CompanionSceneArt.tsx`)

| Scene | Before | Now |
|---|---|---|
| F7 blocks | | |
| ↳ carried blocks | Lifted in front of the face. | Travel low past the face and rise only once they are left of the eye. |
| ↳ tower | | 12 units further left. |
| ↳ left hand | Arched over the tower. | Has its own elbow that always bows outward and down, and reaches the tower from below the shoulder. |
| F3 book | | |
| ↳ page and cover arcs | | Lower (peaks at 8 and 4 units). |
| ↳ hands on the cover edge | Crossed in front of the mouth. | Hand over at the spine, with the left hand on the left. |
| F4 tea | Final hold kept the cup over the mouth. | The cup settles in front of the belly, below the mouth. Its steam fades as it arrives; the kettle keeps steaming. |
| R3 drink | Set-down arc crossed the cheek; steam crossed the face. | A 4-unit arc carries the cup to the side table. Steam appears once the cup is set down, rising beside the face. |

`bentReach` and the F5 bubble wand are unchanged. New unit test: *keeps hands, arms and carried props off the eyes and mouth*. It samples every scene at 101 points and fails on the previous poses (F3, progress 0.2, right eye). The sip (R3) and the blow through the wand (F5) are deliberate mouth contacts and are not checked.

## Results

| Check | Result |
|---|---|
| `tsc -b` | pass |
| `vitest run` | 361 tests pass, including the new face-clearance test and `scene-fit` tests |
| `BASE_PATH=/clock/ npm run build` | pass |
| `npm run test:e2e` (`SCENE_BROWSER_CHANNEL=chrome`) | 60 app checks, 30/30 touch fixture checks and 67/67 scene checks; 22 focus-interaction checks; 48 Records checks |
| `scripts/verify-scenery.mjs` | 20 checks pass |
| Layout audit (126 states) | no overlaps |
| Per-frame face audit (11 scenes × idle, beat, entrance and ending) | no arm or prop over an eye or the mouth, apart from the intended sip |

### Layout audit coverage

- **Viewports:**
  - iPhone: 375×667, 393×852, 440×956, and 852×393 landscape.
  - iPad: 744×1133, 820×1180, 1032×1376, and landscape at 1180×820 and 1376×1032.
- **States:**
  - Ready: ready, the 「其他」 panel, the requested bubble (with and without categories).
  - Focus: running, the requested bubble while running, the thought panel, end confirm.
  - Afterwards: result, rest, Records (top and bottom), Settings (top and bottom).
- **Checks:**
  - The bubble, panel, top buttons and plate stay clear of the creature, and the bubble stays clear of the top buttons and panel.
  - The creature is never cropped at the top or sides.
  - No horizontal overflow.

The pre-existing E2E check that keeps the primary action's target fixed still passes; the fit transform moves only the art.

## Evidence

Before:
- [blocks](layout-and-arms/blocks-before.png)
- [book](layout-and-arms/book-before.png)

After:
- [blocks](layout-and-arms/blocks-after.png)
- [book](layout-and-arms/book-after.png)
- Layouts: [iPhone 375×667](layout-and-arms/iphone-se.png), [iPhone 393×852](layout-and-arms/iphone-393.png), [iPad 820×1180](layout-and-arms/ipad-820.png), [iPhone landscape](layout-and-arms/iphone-landscape.png), [iPad landscape](layout-and-arms/ipad-landscape.png)

The production storyboards in `docs/plans/assets/` were re-exported from the new geometry.

## Not verified

- Physical iPhone and iPad: Safari, the installed PWA, notch safe areas in landscape, iPad split view and Stage Manager.
- The real soft keyboard docking a panel.
- Animated transitions on a device.
