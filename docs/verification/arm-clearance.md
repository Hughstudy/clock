# Arm clearance, steady arm length and panel placement: verification

Date: 2026-11-11. The owner asked for the code to be verified against two goals: good interaction and layout, and smooth animation with no stretched arm and no arm over a different item. Partway through they said the Food scene looked wrong because its food appeared from nowhere, and asked for that scene to be planned again. After seeing the first replanned version they said the bowls' position was still not right and that the spoon should follow real-world physics. This records what was measured, what changed and what is still open.

Status: the owner reviewed the before-and-after animation on 2026-11-11 and approved it; it is on main as `ba83288`. Right after, they asked for Food's bowls and pot to stand in a safer place than the table's edge. That follow-up is described under [Back from the table's edge](#back-from-the-tables-edge); they reviewed it against main and approved it the same day.

## How it was measured

**Arms.** A scratch harness built the production scene renderer (`CompanionSceneArt` through `scripts/export-scene-storyboards.tsx`) and rendered every activity in desktop Chrome at 201 to 401 positions across the session, plus the rest gestures and the rest ending. For each frame it sampled each arm's painted fill on a 1.5-unit grid and tested every sample against every other painted item with `isPointInFill` and `isPointInStroke`, recording which was drawn in front. From the pose it took each arm's shoulder-to-palm length, outline area, perimeter and direction. Items a hand is actively holding are reported separately from items it is not.

**Layout.** A second harness walked the real app through sixteen states (ready, ruler, encouragement, running, card away, thought, marked, paused, end confirmation, result, rest, after rest, Records top and bottom, Settings top and bottom) at 320×568, 375×667, 390×844, 430×932, 844×390 and 820×1180. It captured each state after transitions settled and measured overflow, control sizes, controls covering each other, and how much of the companion's body each layer covered.

Neither harness is committed. The arm rules they found are now unit tests (below).

## Arms: what was found and what changed

Share of the session with an arm over an item it is not holding, before and after:

| Activity | Before | After |
| --- | --- | --- |
| Food | Left arm over the vegetable bowl and right arm over the soup bowl, 100% | None. A hand is at its own bowl only while it carries and tips it |
| Paper boat | Right arm over the water tray, 86% | Only while setting the boat on the water, 7% (89–95%) |
| Blocks | Left arm over the stack and the flag whenever at rest; over the base block 16%; right arm touching the spare block 76% | None at rest. The hand is beside the blocks it moves at 12–29% and 47–72% |
| Tea | Arm lying on the kettle for the first 58%; behind the kettle 10% | On the kettle handle for the first 5%; behind the spout about 1% (24–25%) |
| Warm drink, after the rest ends | Right arm over the side table for as long as the ended scene shows | None over the table; the cup's rim still touches the arm (25 square units) |

Plant, Book, Bubbles, Stars, Stretch and Clouds had no such overlap and are unchanged.

### Food, replanned as a pot of soup

Three things were wrong, in the order the owner raised them.

1. The side bowls stood under the arms.
2. The food appeared from nowhere: the rice mound grew on its plate, the soup filled its bowl and the garnish faded in, with a spoon only touching each dish.
3. A first replanned version kept two bowls at the table's far corners and carried spoonfuls to a pot. The bowls sat half off the table's back edge, the hand hung below the bowl so the spoon poked up into it, and the spoon had to shrink onto the palm to turn round. A short rigid arm cannot carry a level spoonful from a bowl on one side of the hand to a pot on the other without turning the spoon over, so that staging could not be made physical.

The scene now follows how prep bowls are really emptied. The Records picture for this activity was already a pot.

| Session | Key frame |
| --- | --- |
| 0% | The pot stands in front with its spoon leaning in it. A prep bowl stands on the table at each side, beside each hand: vegetables on the left, dumplings on the right. Both hands at rest. |
| 3–9% | The left hand goes down behind its bowl and takes it by the far rim. |
| 9–15% | It brings the bowl, level, to the pot. |
| 15–27% | It lifts the back of the bowl, so the lip rests on the pot's rim. Past 25° the four pieces slide out one by one and fall into the broth, which rises. |
| 27–40% | The bowl goes back to its place, empty. The hand rests. |
| 44–74% | The right hand does the same with the dumplings. |
| 75–98% | The right hand takes the spoon and stirs three slow circles. The pieces mix, the broth clouds and steam rises. |
| 100% | Both bowls empty in their places, the spoon leaning, the soup steaming. |

- **Bowls.** They stand on the table beside the pot and beside the hands, mirrored about the pot, clear of both arms at rest. A hand's own bowl is drawn over it, so the hand holds the bowl from behind its far rim.
- **Conservation.** `sampleFoodPose` reports the share of each ingredient in its bowl and in the pot. Each pair adds up to one at every instant, a bowl only goes down and the pot only goes up.
- **Gravity.** A bowl stays level while it is carried and tips only with its lip at the pot's rim. A piece leaves only when the bowl is tipped past the slip angle. Each piece then falls from the lip in about 300 ms of real time, however slowly the session tips the bowl, as the tea's water does. Checked in the real app: at the moment a piece slides off it is drawn at the lip, and it has landed 570 ms later.
- **Displacement.** The broth rises as pieces go in.
- **The spoon** keeps its length, always leans into the pot with its handle above the rim, and stirs in a circle rather than a wiggle: the hand and the spoon's tilt move a quarter turn apart. Stirring is what moves the pieces from where they fell to a mixed spread.
- **Arms.** Each is still the one drawn outline turning at the shoulder, so its length and area do not change.
- **Reduced motion.** The 40%, 75% and 100% landmarks are resting poses with both hands at rest.
- **Steam** is drawn at 40% size so it stays below the face.

### Paper boat

The tray now lies along the front of the table, below both palms (`BOAT_TRAY`), so the right arm is clear of it while folding and at rest. It is wide enough for the whole boat. The hand carries the hull to the tray's near rim with the arm hanging down, lets go, and the boat glides to the middle of the water. Before, the arm reached straight down into the tray and stayed over it.

### Blocks

The stack to move stood under the left arm with the flag behind the palm, and placing the flag needed the arm raised sideways above the shoulder. The scene is restaged:

- The companion sits ten units to the right. The tower's base stands as far left as a narrow phone shows, with the little stack beside it, all left of the left arm. The spare block moved right, clear of the right arm.
- The flag rides on the block that will top the tower, so there is no separate flag to store or lift.
- Two moves instead of three. At 14–28% the palm nudges the stack up against the base from beside it. At 48–70% it lifts the flag block across onto the base, and the body leans six degrees with the reach so the arm keeps its length. The finished picture is the same: tower, step and flag.
- Arm length range fell from 29.8–40.0 to 28.5–35.9 units, and the arm no longer points above the shoulder.

### Tea

The pour itself is unchanged. It now happens in the first quarter of the session and the cup is in both hands by 40%, where it stays. That cuts the sideways arm on the kettle from 14½ minutes of a 25-minute session to about 75 seconds, and the settled picture is the companion holding its tea. With motion off, the 40% landmark now shows the cup held rather than a hand on the kettle.

The left palm takes the cup by its near side, where it can be seen, and slips under it on the way up. Before, the arm disappeared behind the cup. The arm bows toward the body beside the spout.

### Warm drink

The side table is narrower and sits further right, so the right arm rests clear of it once the cup is down.

### Back from the table's edge

After the push the owner pointed out that Food's bowls and pot stood on the edge of the table and asked for a better, safer position. Their feet were about 2 units from the table's front edge. The same was true of two other props moved in this work: the paper boat's tray (0.7 units) and the base block at the table's narrow left end (1.8 units).

| Prop | Before | Now |
| --- | --- | --- |
| Food's bowls | Foot 1.9 units from the front edge | About 8 units, and more than 6 from the back edge |
| Food's pot | 2 units | 9 units; the pot is 2 units shallower |
| Paper boat's tray | 0.7 units | 5 units or more along its whole width; the tray is slimmer |
| Blocks | 1.8 units at the base block's corner | 5.8 units or more for every block |

A hand hangs no lower than it did, so the bowls could not simply move back: they would have been out of reach. The palm now holds a bowl from behind its far rim instead of from above it, which lets the bowl stand 5 units further back and further out from the pot. The pot stands between the arms, so it moved straight back. The tray moved back and right of the folding palm; the spare block moved right to stay clear of the right arm. Arm lengths are unchanged, and the arm-clearance and narrow-screen tests still pass.

Two unit tests now hold these margins: Food's vessels at least 6 units from both the front and back edges across each foot, and the tray and every block at least 5 units from the front edge.

### Inside a narrow phone's view

On a tall phone the room is drawn 1.44 times as wide as the screen, so only the middle 222 units of the scene show. The moved tray and blocks are placed inside that span, and a unit test holds them there; Food's bowls and pot stand near the middle. Blocks joined the scenes that settle without growing when the card steps aside, because its items now reach toward the edge. Checked in the real app at 320×568, 375×667, 390×844 and 430×932 with the card away: nothing is cut in Food, Paper boat or Blocks. Tea's parked kettle is cut by 8–9px at the two wider sizes, as it was before this work.

## Layout: what was found and what changed

**Fixed: a panel lay over the card's note row.** With a note row showing (after a marker, for example), the end confirmation, thought and status panels rested on the card's reserved band rather than its real top. At 375, 390, 430 and 820 wide the panel covered the top 36px of the card, and 「确认结束」 overlapped 「撤销标记」. `useSceneFit` now publishes how far the card has grown (`--plate-rise`); the panel rests 8px above the card at all four sizes, and the companion stands on the panel as before.

**Checked and sound.** No horizontal overflow in any state or size. Focus, Records and Settings controls are at least 44px, counting the full row for Settings switches. The speech bubble follows the head when the card steps aside. Records paging and the Settings list scroll clear of the tab bar.

## Still open

| Item | Detail |
| --- | --- |
| Card over the companion on small phones | With a note row, the card covers 15–16% of the body at 375×667 and 61% at 320×568. This follows the owner's 2026-11-06 rule that the card grows over the feet; on these two sizes it reaches further. Lifting the art instead would shrink an already small companion. Needs an owner decision. |
| Tea | The arm still passes behind the spout for about 1% of the session, and rests on the kettle for the first 5%. The parked kettle is cut by 8–9px at the left edge of 390 and 430 wide screens. The kettle and cup both stand in the left arm's working area, so clearing these fully needs a different table layout. |
| Longest reaches | Book (42.8), Paper boat while folding (43.2) and Warm drink (43.1) are unchanged. They are hands on the item in use. |
| Warm drink set-down | For its 1.6 seconds the right arm curls behind the cup to hold the handle on its far side. Unchanged. |

## Checks

Browser: Google Chrome 157.0.8103.39 through Playwright on macOS, desktop emulation. This is not physical-device verification. Playwright's bundled Chromium is not installed on this machine, so the scripts ran with `SCENE_BROWSER_CHANNEL=chrome`.

- `npm run check`: type-check and 470 unit tests pass.
  - New `scene-arm-clearance.test.ts`: no reach beyond 43.5 units in any activity; the tray clear of the right arm outside the launch; both arms clear of every block and the flag at rest; the cup in both hands and both arms clear of the kettle from 41%; every moved item inside the narrowest screen's view.
  - `scene-food.test.ts` rewritten for the soup: conservation of each ingredient; a piece leaves only from a bowl tipped past the slip angle with its lip over the pot; a bowl stays level in the hand except at the rim and returns to its place; the spoon keeps its length, stays in the pot and stirs in a circle; both arms keep their shape and rest at the landmarks; the bowls and pot stand below both hands.
  - Tests pinned to the old geometry were updated: the boat's final place, the flush step block, the cup's side grip, the tea timing, and mirroring about the body's own middle. `plateRise` has its own test.
  - The arm-contour guards (area ratio under 1.25, perimeter ratio under 1.16) pass unchanged; Tea's perimeter ratio is 1.15.
- `npm run test:e2e`: passes. 131 app checks, 30/30 touch checks and 67/67 scene checks; 118 Records checks; 134 step-aside checks; the focus-interaction, persistence, update, panel and iOS design and navigation scripts.
- `node scripts/animation-review.mjs`: 425 checks pass; frame times p50 16.7 ms, maximum 16.8 ms, none over 50 ms.
- `node scripts/verify-scenery.mjs`: 20 checks pass.
- `BASE_PATH=/clock/ npm run build` and `node scripts/verify-v5-compatibility.mjs`: pass.
- `python3 scripts/check-prd-docs.py`: passes.

## Not verified

- Physical iPhone or iPad, Safari, the installed PWA and the real soft keyboard.
- The scene storyboards in `docs/plans/assets` were regenerated from the new geometry; they are static samples.
