# Timer-driven focus performance: verification

Date: 2026-11-09. Scope: the companion during a running focus session, and the scene's day and night. See the [plan note](../../PLAN.md) for the owner's direction.

## What changed

### Performance across the session

- **Gestures.** `logic/focus-presence.ts` turns main's elapsed time into a pose. The opening settle starts 1.5 seconds in. One glance and small smile is centred on the exact middle. Quiet head tilts and body shifts spread outward from it, every eighth of the session, within 45 seconds to three minutes. A 25-minute session has ten gestures. A gesture keeps its real-time length (1.7 to 3.3 seconds); only its position scales with the session.
- **Resting pose.** While focusing, the face rests toward the activity with slightly lowered eyelids. This also applies with motion off. Stars keeps its eyes wide.
- **Playback.** `hooks/companion/useFocusPresence.ts` re-anchors on each 250 ms countdown refresh and writes SVG transforms only from 0.6 seconds before a gesture until it ends.
- **Interruptions.** Pausing, touching, a panel or a hidden page fades a gesture out over a few hundred milliseconds. Reduced motion clears it at once.
- **Breathing and blinking** remain CSS loops and pause with the timer. Breathing keeps volume and is about 1.5% of height.

### Steady with the timer

The activity's hand and prop positions now follow the timer's fraction directly. The bursts at 40% and 75%, their handling durations and the hand-travel re-timing are removed. Reduced motion keeps those landmarks as still resting poses. Countdown refreshes paint directly; sessions shorter than about eight minutes take larger steps and are smoothed between refreshes.

An earlier attempt re-timed the activity by hand travel. Measurement showed it kept Tea's arm mid-reach for about half the session, so it was removed.

### Arms

Owner rule: arms never stretch or twist, and an arm does not overlap a different item.

- **Mirrored hands.** Idle hands are exact mirror images in the ready and resting poses, Plant, Book, Bubbles, Blocks at rest and Stars. Food matches at rest. Tea's left hand and Paper boat's hands are working, so they differ by design.
- **Plant.** The left hand no longer curls onto the pot. Both hands rest on the table, and the pot moved 12 units left so its rim stands clear of the left arm.
- **Rigid gesture.** The flipper adjustment is a rotation about the shoulder from −1.6° to +4.6°, so the arm's length and outline are unchanged. It is limited to Plant (right), Bubbles (left) and Stars (right), where it has zero overlap with any item at rest and at both extremes.

### Tea

The previous spout stopped 23 units short of the cup and the water flew sideways.

- The cup waits on its saucer under the spout. The kettle lifts, then tilts 32° (previously 18°).
- During the pour the spout tip is 8.9 units above the rim, over the cup's opening. Water leaves level and follows a parabola into the opening.
- Water runs only once the kettle is tilted past about 25°, and stops before it levels out. The stream's front and tail take 220–260 ms regardless of how slowly the kettle moves. The tea level rises while it pours.
- The kettle returns further out, with a small lean so the arm keeps its usual length. The left palm then carries the cup to the chest and the right hand joins near the end. The right hand no longer overlaps the cup at rest.

### Day and night

`logic/daylight.ts` maps the device's local time to a level of night: daylight from 06:30 to 17:30, night from 18:30 to 05:30, easing across the hour between. Each setting interpolates day, twilight (the approved dusk palette) and night colors. The workroom dims with a warm lamp glow; the terrace gets a night sky. Sun gives way to moon and stars. Stars keeps a pale moon by day, and its stars appear only after dark. The page's sky and floor match the art, and the clock's text color switches so it stays at least 4.5:1 at all 33 levels. Records keeps its own day-part art.

## Open arm overlaps

> Addressed on 2026-11-11; see [arm clearance](arm-clearance.md). The table below is the state as of 2026-11-09.

| Scene | Arm | Item | Note |
| --- | --- | --- | --- |
| Food | Both | Side dishes and parked spoons | Rest over them for much of the session; predates this work |
| Blocks | Left, and right a little | Block stack, spare block | Predates this work |
| Tea | Left | Kettle | Passes behind it while reaching for the cup, 77–79% of the session, about 45 seconds in 25 minutes |

Hands on the item in use (Book, Paper boat, kettle handle, cup) are contact, not unrelated overlap.

## Checks run

Browser: Google Chrome 156.0.8078.80 through Playwright on macOS. Desktop emulation is not physical-device verification.

- `npm run check`: type-check and 450 unit tests pass, including mirrored hands, Tea pour position and timing, steady progress, schedule placement for 1–120 minute sessions, per-channel smoothness at 2 ms steps, day-night levels and text contrast.
- The arm-contour and face-clearance guards each caught a real problem during this work (a squashed and a stretched Tea arm, the mouth reaching the cup). The poses were corrected and the guards were left as strict as before.
- `BASE_PATH=/clock/ npm run build`: passes.
- `npm run test:e2e`: passes, including no running animation with a panel open and under reduced motion, and night contrast on the darkest sky. Browser checks that assumed hand bursts or a fixed dusk setting were updated to the new behaviour.
- `node scripts/animation-review.mjs`: 425 checks pass; frame times p50 16.7 ms, maximum 16.8 ms, none over 50 ms.
- `node scripts/verify-scenery.mjs`: 20 checks pass.
- Real app, 1-minute Tea session, sampled every frame before the steady-timing change: steady frames through both gestures, full smile at 30 seconds, no gesture frames after one ended, and none running after pause.

## Not verified

- Physical iPhone Safari smoothness, battery use and VoiceOver. Breathing repaints continuously during focus, so its battery cost should be judged on a device.
- Owner review of the final animation was still pending when this report was written.
