import { describe, expect, it } from 'vitest'
import { sampleScenePose, type SceneArm, type ScenePoint, type ScenePoseInput } from './scene-pose'
import type { SceneId } from './types'

const activities: SceneId[] = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'R1', 'R2', 'R3']
const rigidActivities = new Set<SceneId>(['F1', 'F2', 'F8', 'R1', 'R2'])

function outline(arm: SceneArm): ScenePoint[] {
  const [x = 0, y = 0] = arm.points
  const points = [{x, y}]
  let start = points[0]!
  for (let i = 2; i < arm.points.length; i += 6) {
    const [ax, ay, bx, by, ex, ey] = arm.points.slice(i, i + 6) as [number, number, number, number, number, number]
    for (let j = 1; j <= 16; j++) {
      const t = j / 16, s = 1 - t
      points.push({
        x:s**3*start.x + 3*s*s*t*ax + 3*s*t*t*bx + t**3*ex,
        y:s**3*start.y + 3*s*s*t*ay + 3*s*t*t*by + t**3*ey,
      })
    }
    start = {x:ex, y:ey}
  }
  return points
}

const cross = (a: ScenePoint, b: ScenePoint, c: ScenePoint) =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)

function crosses(a: ScenePoint, b: ScenePoint, c: ScenePoint, d: ScenePoint) {
  if (Math.max(a.x, b.x) < Math.min(c.x, d.x) || Math.min(a.x, b.x) > Math.max(c.x, d.x)
    || Math.max(a.y, b.y) < Math.min(c.y, d.y) || Math.min(a.y, b.y) > Math.max(c.y, d.y)) return false
  return cross(a, b, c) * cross(a, b, d) < -1e-9 && cross(c, d, a) * cross(c, d, b) < -1e-9
}

function measure(arm: SceneArm) {
  const points = outline(arm)
  let area = 0, perimeter = 0
  let crossing = false
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!, b = points[i]!
    area += a.x * b.y - b.x * a.y
    perimeter += Math.hypot(b.x - a.x, b.y - a.y)
    for (let j = i + 2; j < points.length; j++) {
      if (i === 1 && j === points.length - 1) continue
      if (crosses(a, b, points[j - 1]!, points[j]!)) crossing = true
    }
  }
  return { area: Math.abs(area) / 2, perimeter, crossing }
}

function* cases(id: SceneId): Generator<ScenePoseInput> {
  // Prop handling and gesture time are separate cursors. Sweep each in turn;
  // the interruption cases preserve the previous phase at the start of an ending.
  for (let i = 0; i <= 1000; i++) {
    const progress = i/1000
    yield {id,progress,activityProgress:progress}
  }
  for (const progress of [0,.4,.75,1]) {
    for (const status of ['running','paused','ended'] as const) {
      yield {id,progress,status,staticOnly:true}
    }
    for (let i = 0; i <= 100; i++) {
      const actionProgress = i/100
      for (const actionKind of ['open','beat'] as const) yield {id,progress,actionKind,actionProgress}
      for (const endingFromActionProgress of [0,.4,800/1120,1]) {
        yield {id,progress,status:'ended',actionKind:'ending',endingFromActionProgress,actionProgress}
      }
    }
  }
}

describe('arm contours through each activity',()=>{
  for (const id of activities) {
    it(`${id} keeps each shoulder attached and its projected arm silhouette stable`,()=>{
      const cache = new Map<string,ReturnType<typeof measure>>()
      const stats = ['left', 'right'].map(side => ({side, minArea: Infinity, maxArea: 0, minPerimeter: Infinity, maxPerimeter: 0}))
      let crossing: ScenePoseInput | null = null, maxShoulderError = 0
      for (const input of cases(id)) {
        const frame = sampleScenePose(input)
        for (const [index,arm] of [frame.left,frame.right].entries()) {
          const key = arm.points.join(',')
          const measured = cache.get(key) ?? measure(arm)
          cache.set(key,measured)
          const bounds = stats[index]!
          bounds.minArea = Math.min(bounds.minArea,measured.area)
          bounds.maxArea = Math.max(bounds.maxArea,measured.area)
          bounds.minPerimeter = Math.min(bounds.minPerimeter,measured.perimeter)
          bounds.maxPerimeter = Math.max(bounds.maxPerimeter,measured.perimeter)
          if (measured.crossing) crossing ??= input
          // The seated tea pose brings both shoulders forward on the torso.
          const shoulderX = id === 'F4' ? [74,161][index]! : [69,171][index]!
          const root = { x: frame.body.x + shoulderX, y: frame.body.y + 105 }
          const error = Math.hypot(arm.points[0]! - root.x, arm.points[1]! - root.y)
          maxShoulderError = Math.max(maxShoulderError, error)
        }
      }
      expect(maxShoulderError).toBeLessThan(.01)
      expect(crossing).toBeNull()
      const rigid = rigidActivities.has(id)
      for (const bounds of stats) {
        // Bending can change projected area. A planted or rotated contour should conserve it.
        expect(bounds.maxArea/bounds.minArea, `${id} ${bounds.side} area ratio`).toBeLessThan(rigid ? 1.00001 : 1.25)
        expect(bounds.maxPerimeter/bounds.minPerimeter, `${id} ${bounds.side} perimeter ratio`).toBeLessThan(rigid ? 1.00001 : 1.16)
      }
    })
  }
  it('touch preserves the held arm paths at the same gesture phase',()=>{
    for (const id of activities) for (const status of ['running','paused','ended'] as const) {
      for (const u of [0,.32,800/1120,1]) {
        const input = {id,status,progress:u,actionProgress:u,actionKind:'beat'} as const
        const before = sampleScenePose(input)
        for (const touchKind of ['pat','squish','high-five'] as const) {
          const touched = sampleScenePose({...input,touchKind})
          expect(touched.left).toEqual(before.left)
          expect(touched.right).toEqual(before.right)
        }
      }
    }
  })
  it('starts an interrupted ending with the pose that was on screen',()=>{
    for (const id of activities) for (const status of ['running','paused'] as const) {
      for (const phase of [.15,.4,800/1120,.95]) {
        const input = {id,progress:.75,activityProgress:.75,actionProgress:phase}
        const held = sampleScenePose({...input,status,actionKind:'beat'})
        const ending = sampleScenePose({...input,status:'ended',actionKind:'ending',actionProgress:0,endingFromActionProgress:phase})
        expect(ending.left,`${id} left at interruption ${phase}`).toEqual(held.left)
        expect(ending.right,`${id} right at interruption ${phase}`).toEqual(held.right)
      }
    }
  })
})
