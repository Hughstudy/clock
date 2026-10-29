import { validateSceneMotionSpec } from '../logic/scene-motion'

export const sceneMotionSpec = validateSceneMotionSpec({
  openMs: 1800,
  beatMs: 1600,
  beatMinMs: 60_000,
  beatMaxMs: 90_000,
  endingMs: { hello: 1400, snack: 1800, meal: 2100, feast: 2400, rest: 1600 },
})
