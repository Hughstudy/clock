import { validateSceneMotionSpec } from '../logic/scene-motion'

export const sceneMotionSpec = validateSceneMotionSpec({
  // 160 ms anticipation + 640 ms action + 320 ms settle.
  openMs: 1120,
  beatMs: 1120,
  stretchMs: 3200,
  handlingMs: 2600,
  bubbleHandlingMs: 4000,
  beatMinMs: 60_000,
  beatMaxMs: 90_000,
  endingMs: { hello: 1400, snack: 1800, meal: 2100, feast: 2400, rest: 1600 },
})
