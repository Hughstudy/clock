import { expect, it } from 'vitest'
import { sampleScenePose } from './scene-pose'

it('bridges the inside of the folded wand arm without a claw-shaped notch', () => {
  let deepest = 0
  for (let i = 0; i <= 500; i++) {
    const { points, palm } = sampleScenePose({id:'F5', progress:i/500}).right
    const sx = points[0]!, sy = points[1]!, dx = palm.x-sx, dy = palm.y-sy
    // Follow the two inside curves from the palm cap back to the shoulder.
    // The former outline dipped over eight drawing units toward the elbow.
    for (let k = 20; k < points.length; k += 6) for (let j = 0; j <= 12; j++) {
      const t = j/12, u = 1-t
      const at = (n: number) => u**3*points[n-2]! + 3*u*u*t*points[n]! + 3*u*t*t*points[n+2]! + t**3*points[n+4]!
      const depth = ((at(k)-sx)*dy - (at(k+1)-sy)*dx)/Math.hypot(dx,dy)
      deepest = Math.max(deepest,depth)
    }
  }
  expect(deepest).toBeLessThan(3.5)
})
