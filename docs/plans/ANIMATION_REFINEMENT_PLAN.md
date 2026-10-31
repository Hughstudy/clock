# Animation refinement: implemented prototype

Status: implemented and validated in desktop Chrome, 2026-10-31. The user explicitly approved refining all keyframes, implementing the animation, validating and publishing directly to main. The selected character remains the soft blue creature with rounded hands. This increment does not complete the wider P0 plan or physical-device acceptance.

## Production drawing and motion

All eleven scenes use one deterministic pose sampler and persistent SVG renderer. Shoulders, rounded arm outlines, hand grips and held objects are sampled together. Each object keeps its identity and physical scale; tables, mats, cushions and trays supply stable support. No physics dependency or business-state callback was added.

The earlier concept generator has been replaced by an exporter of the actual production geometry. `python3 docs/plans/assets/build-storyboards.py` now runs that exporter. The [catalogue data](assets/scene-storyboards.json) contains 44 landmarks and the [contact data](assets/scene-contact-storyboards.json) contains 47 intermediate drawings. Labels and sample definitions remain design data; geometry comes from the same renderer as the app.

| Scene | Implemented progression and contact |
| --- | --- |
| [Food](assets/scene-storyboards/F1-food.svg) | Ingredients → vegetables prepared → rice plated → warm soup completes the meal. Two small spoons have nearby rests and supported, continuous pickup/return paths. |
| [Plant](assets/scene-storyboards/F2-plant.svg) | A supported pot, rounded palm and continuous leaf/bud/flower development. |
| [Book](assets/scene-storyboards/F3-book.svg) | Page-corner reach → page arc and release → ribbon placement → shallow closed book on the table. |
| [Tea](assets/scene-storyboards/F4-tea.svg) | Exactly one constant-sized cup on a small table; increasing kettle steam, supported pouring, visible filling, then a close two-handed cup hold. |
| [Bubbles](assets/scene-storyboards/F5-bubbles.svg) | The elbow stays beside the body as the forearm brings a short wand to the lips. The hand returns the wand to the shallow jar and relaxes after each bubble. |
| [Boat](assets/scene-storyboards/F6-boat.svg) | Asymmetric folding, a recognizable hull, and a constant-sized supported boat lowered into a tray present from the start. |
| [Blocks](assets/scene-storyboards/F7-blocks.svg) | Four persistent blocks move from nearby spare positions onto the base. The flag starts on the mat and stays visible after placement. |
| [Stars](assets/scene-storyboards/F8-stars.svg) | Supported rest, upward gaze and a gradually fuller sky. |
| [Stretch](assets/scene-storyboards/R1-stretch.svg) | Rounded arms rotate upward without losing volume; feet remain planted. |
| [Clouds](assets/scene-storyboards/R2-clouds.svg) | Relaxed cushion contact, subtle gaze and independently drifting clouds. |
| [Warm drink](assets/scene-storyboards/R3-drink.svg) | Two-handed sip with shared rotated cup anchors; an ending places the cup on the nearby saucer before releasing the handle. |

Contact sheets cover [pouring](assets/scene-contact-storyboards/tea-pour.svg), [cup lifting](assets/scene-contact-storyboards/tea-cup.svg), [food preparation](assets/scene-contact-storyboards/food-serving.svg), [page turning](assets/scene-contact-storyboards/book-page.svg), [folding and lowering](assets/scene-contact-storyboards/boat-fold.svg), [wand rotation](assets/scene-contact-storyboards/wand-turn.svg), [block placement](assets/scene-contact-storyboards/block-place.svg) and [sipping/set-down](assets/scene-contact-storyboards/drink-sip.svg).

## Timing, progress and interruption

- C2-P3 supplies clamped, unquantized completed focus progress. Rest continues to receive zero; its unhurried actions are presentation only.
- Growth, steam and sky detail use precise supplied progress. Handling has supported destinations at 0/40/75/100%. Once a landmark is achieved, the local handling cursor moves to it over 2,600 ms. Bubble play takes 4,000 ms for each complete pickup, blow and return. The cursor never goes beyond main's supplied progress.
- Simple entrances/beats use 160 ms anticipation + 640 ms action + 320 ms settling, with smooth zero-velocity phase boundaries. The rest stretch has a 3.2-second lift, hold and return. Breathing takes 5 seconds and steam takes 4 seconds. Sparse beats retain the 60–90-second cadence. Ending lengths retain validated main-independent presentation parameters.
- Scene nodes remain mounted for their saved scene identity. Ambient loops do not restart for finite actions; paused loops keep their playback position.
- Pausing, touching the character or opening a visible panel freezes the current supported configuration. On return, an unfinished local path can settle without replaying a semantic cue. A held cup retains support; greetings/touch use an available limb or expression. Endings capture the current local action position, so an interrupted sip or stretch continues from its visible pose.
- Hidden pages, errors and reduced motion settle to the current meaningful static state. Visible panels freeze the displayed pose. Returning never catches up missed gestures. Controls remain usable throughout.
- Completed short and long sessions reach the final state. Early endings retain achieved progress and receive a warm closing response. Rendering never asserts that a save succeeded or awards credit.

## Immediate scene access and compatibility

Every focus scene F1–F8 and rest scene R1–R3 is available from the first session. Independent saved shuffled bags cover each pool and avoid adjacent repeats, including bag boundaries. Stable adapter-generated session identity supplies entropy to pure selection. Accepted selection and the timer save together; retries, resume, reload and rejected starts do not reroll.

Snapshot v6 / selection policy v2 preserves existing active and historical v1 assignments. Migration clears only future bag contents, retaining ordinals, cycles, previous selections, timing, records, settings and dataset identity. Legacy unlock/introduction/announcement sets remain inert compatibility history. Active grants, claim actions, notice scheduling and access-pressure wording are removed. Actual completion counts still drive break cadence.

The real archived v5 client was exercised against v6 storage: received updates, missed storage events and cold loads all became read-only without changing v6 bytes. Future schema/raw-data protection remains intact.

## Review and delivery evidence

See [Animation refinement verification](../verification/animation-refinement.md) for exact checks, recordings and browser details. The visual correction loop found and resolved collapsed intermediate arms, a stretched kettle grip, an ambiguous closed book, weak boat support, a floating flag and abrupt food-utensil changes. Independent review inspected the corrected contact samples; dense pose tests cover intermediate silhouettes and anchors.

The live PRD/Register Library links were unavailable during this continuation. The supplied PRD v3/revision 7 and historical register snapshots were read; the user's approved implementation plan is the current direction. No remote collaboration register was changed.

Publication is authorized directly to main. Commit/push and the exact GitHub Pages deployment are verified separately from local validation. The remaining product proposals in PLAN.md retain their review status.
