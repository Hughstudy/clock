import type { SceneArm, ScenePoint, ScenePoseFrame } from './scene-pose'

type TurnArm = (arm: SceneArm, degrees: number) => SceneArm
type SpoonKey = readonly [progress: number, shoulder: number, spoon: number]

// Front of the low table, clear of the dishes. Each rest supports a parked shaft.
export const SPOON_RESTS = [{ x: 104, y: 182, w: 17 }, { x: 205, y: 182, w: 19 }] as const

function ease(progress: number, from: number, to: number) {
  const t = Math.max(0, Math.min(1, (progress - from) / (to - from)))
  return t * t * (3 - 2 * t)
}

// The second angle rotates the spoon in the palm. Its bowl does most of the
// travelling; the shoulder only needs a small arc to serve the three dishes.
const serving: readonly SpoonKey[] = [
  [0, 14, 146], [.07, 14, 146], [.16, -5, 190], [.30, -5, 190],
  [.43, -9, 35], [.58, -9, 35], [.67, 14, 146], [1, 14, 146],
]
const ladling: readonly SpoonKey[] = [
  [0, -12, 32], [.65, -12, 32], [.76, 1, -14], [.88, 1, -14],
  [.96, -12, 32], [1, -12, 32],
]

function serve(p: number, rest: SceneArm, turn: TurnArm, keys: readonly SpoonKey[], held: number) {
  const i = Math.max(1, keys.findIndex(key => key[0] >= p))
  const a = keys[i - 1]!, b = keys[i]!, t = ease(p, a[0], b[0])
  const shoulder = a[1] + (b[1] - a[1]) * t
  const spoon = (a[2] + (b[2] - a[2]) * t) * Math.PI / 180
  const arm = turn(rest, shoulder * held)
  // During approach/release the entire spoon stays on its rest. As soon as
  // the palm arrives, the very same point drives both drawings.
  const grip = held === 1 ? arm.palm : turn(rest, keys[0]![1]).palm
  const tip: ScenePoint = { x: grip.x + 26 * Math.cos(spoon), y: grip.y + 26 * Math.sin(spoon) }
  return { arm, grip, tip }
}

export function sampleFoodPose(
  p: number, leftRest: SceneArm, rightRest: SceneArm, turn: TurnArm,
): Pick<ScenePoseFrame, 'left' | 'right' | 'food' | 'gaze' | 'contacts'> {
  const leftHeld = ease(p, .02, .07) * (1 - ease(p, .67, .73))
  const rightHeld = ease(p, .60, .65) * (1 - ease(p, .96, 1))
  const left = serve(p, leftRest, turn, serving, leftHeld)
  const right = serve(p, rightRest, turn, ladling, rightHeld)
  return {
    left: left.arm, right: right.arm,
    food: {
      greens: ease(p, .16, .29), rice: ease(p, .43, .58), soup: ease(p, .76, .88),
      spoon: left.grip, tip: left.tip, soupSpoon: right.grip, soupTip: right.tip, leftHeld, rightHeld,
    },
    contacts: [
      { name: 'food-spoon-left', hand: left.arm.palm, prop: left.grip, active: leftHeld === 1 },
      { name: 'food-spoon-right', hand: right.arm.palm, prop: right.grip, active: rightHeld === 1 },
    ],
    gaze: { x: -2 + 2 * ease(p, .30, .43) + 2 * ease(p, .65, .76), y: 0 },
  }
}
