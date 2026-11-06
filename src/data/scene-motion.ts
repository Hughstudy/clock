import { validateSceneMotionSpec } from '../logic/scene-motion'

export const sceneMotionSpec = validateSceneMotionSpec({
  // 160 ms anticipation + 640 ms action + 320 ms settle.
  openMs: 1120,
  beatMs: 1120,
  stretchMs: 3200,
  // Long enough, with pacing by hand travel, to keep handling under about 180 px/s on a phone.
  handlingMs: 4200,
  bubbleHandlingMs: 5500,
  beatMinMs: 60_000,
  beatMaxMs: 90_000,
  endingMs: { hello: 1400, snack: 1800, meal: 2100, feast: 2400, rest: 1600 },
})
