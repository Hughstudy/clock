import { describe, expect, it } from 'vitest'
import { BLOCK_HEIGHT, BLOCK_WIDTH, BOAT_TRAY, sampleScenePose, TEA_CUP_HOME, type SceneArm, type ScenePoint, type ScenePoseFrame } from './scene-pose'
import { ART_MAX_SCENE_RATIO } from './scene-fit'
import type { SceneId } from './types'

/** Owner rule: an arm never stretches, and never lies over an item it is not handling. */
const ids: SceneId[] = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'R1', 'R2', 'R3']
const steps = Array.from({ length: 1001 }, (_, i) => i / 1000)

function outline(arm: SceneArm): ScenePoint[] {
  const p = arm.points, points: ScenePoint[] = []
  let x = p[0]!, y = p[1]!
  points.push({ x, y })
  for (let i = 2; i < p.length; i += 6) {
    const [x1, y1, x2, y2, x3, y3] = p.slice(i, i + 6) as [number, number, number, number, number, number]
    for (let j = 1; j <= 12; j++) {
      const t = j / 12, s = 1 - t
      points.push({ x: s ** 3 * x + 3 * s * s * t * x1 + 3 * s * t * t * x2 + t ** 3 * x3, y: s ** 3 * y + 3 * s * s * t * y1 + 3 * s * t * t * y2 + t ** 3 * y3 })
    }
    x = x3; y = y3
  }
  return points
}
interface Box { l: number; r: number; t: number; b: number }
const inBox = (p: ScenePoint, box: Box) => p.x > box.l && p.x < box.r && p.y > box.t && p.y < box.b
const touches = (arm: SceneArm, box: Box) => [...outline(arm), arm.palm].some(p => inBox(p, box))
/** A block's drawn extent: its front face, plus the side and top faces set back by the depth. */
const blockBox = (b: { x: number; y: number }): Box => ({ l: b.x, r: b.x + BLOCK_WIDTH + 6, t: b.y - BLOCK_HEIGHT - 6, b: b.y })

describe('arms keep their length and stay clear of items they are not handling', () => {
  it('never reaches further than a relaxed arm can, in any activity', () => {
    for (const id of ids) for (const progress of steps) {
      const frame = sampleScenePose({ id, progress })
      for (const side of ['left', 'right'] as const) {
        const arm = frame[side], reach = Math.hypot(arm.palm.x - arm.points[0]!, arm.palm.y - arm.points[1]!)
        expect(reach, `${id} ${side} at ${progress}`).toBeLessThan(43.5)
        expect(reach, `${id} ${side} at ${progress}`).toBeGreaterThan(24)
      }
    }
  })

  it('keeps the water tray clear of the right arm except while it sets the boat afloat', () => {
    const overTray = (arm: SceneArm) => [...outline(arm), arm.palm].some(p =>
      ((p.x - BOAT_TRAY.x) / BOAT_TRAY.width) ** 2 + ((p.y - BOAT_TRAY.y) / BOAT_TRAY.depth) ** 2 < 1)
    for (const progress of steps) {
      const frame = sampleScenePose({ id: 'F6', progress })
      expect(overTray(frame.left), `left at ${progress}`).toBe(false)
      if (progress <= .87 || progress >= .98) expect(overTray(frame.right), `right at ${progress}`).toBe(false)
    }
  })

  it('rests both arms clear of every block and the flag between the two moves', () => {
    const boxes = (frame: ScenePoseFrame): Box[] => [
      ...frame.blocks.map(blockBox),
      { l: frame.flag.x - 1, r: frame.flag.x + 17, t: frame.flag.y - 25, b: frame.flag.y },
    ]
    const resting = steps.filter(p => p <= .08 || (p >= .34 && p <= .42) || p >= .75)
    for (const progress of resting) {
      const frame = sampleScenePose({ id: 'F7', progress })
      expect(frame.body.lean).toBe(0)
      for (const box of boxes(frame)) {
        expect(touches(frame.left, box), `left at ${progress}`).toBe(false)
        expect(touches(frame.right, box), `right at ${progress}`).toBe(false)
      }
    }
    // The spare block and the tower never come under the right arm at all.
    for (const progress of steps) {
      const frame = sampleScenePose({ id: 'F7', progress })
      for (const box of boxes(frame)) expect(touches(frame.right, box), `right at ${progress}`).toBe(false)
    }
  })

  it('has the cup in both hands, away from the kettle, for most of the tea session', () => {
    for (const progress of steps.filter(p => p >= .41)) {
      const frame = sampleScenePose({ id: 'F4', progress })
      expect(frame.contacts.filter(c => c.active).map(c => c.name).sort()).toEqual(['cup-base', 'cup-handle'])
      const kettle: Box = { l: frame.kettle.x - 25, r: frame.kettle.x + 48, t: frame.kettle.y - 50, b: frame.kettle.y + 4 }
      const saucer: Box = { l: TEA_CUP_HOME.x - 20, r: TEA_CUP_HOME.x + 20, t: 179, b: 187 }
      for (const side of ['left', 'right'] as const) {
        expect(touches(frame[side], kettle), `${side} over the kettle at ${progress}`).toBe(false)
        expect(touches(frame[side], saucer), `${side} over the saucer at ${progress}`).toBe(false)
      }
    }
  })

  it('keeps every item inside the narrowest screen\'s view of the room', () => {
    // The art is drawn 240 units wide at .75 of the scene's own units, centred on x 160, and
    // a narrow screen shows 1/ART_MAX_SCENE_RATIO of that width.
    const half = 240 / ART_MAX_SCENE_RATIO / 2 / .75, left = 160 - half, right = 160 + half
    expect(BOAT_TRAY.x + BOAT_TRAY.width).toBeLessThan(right)
    for (const progress of steps) {
      const frame = sampleScenePose({ id: 'F7', progress })
      for (const block of frame.blocks) {
        expect(block.x, `block at ${progress}`).toBeGreaterThan(left)
        expect(block.x + BLOCK_WIDTH + 6, `block at ${progress}`).toBeLessThan(right)
      }
      expect(sampleScenePose({ id: 'F6', progress }).boat.x + 25).toBeLessThan(right)
    }
  })
})
