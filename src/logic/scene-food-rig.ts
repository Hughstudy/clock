import type { SceneArm, SceneObject, ScenePoint, ScenePoseFrame } from './scene-pose'

type TurnArm = (arm: SceneArm, degrees: number) => SceneArm
/** [progress, shoulder turn, bowl tilt], both in degrees. */
type Key = readonly [progress: number, shoulder: number, tilt: number]

/**
 * A pot of soup that obeys the kitchen's physics.
 *
 * The pot stands in front of the companion with a prep bowl on the table at each side, just below
 * each hand: vegetables on the left, dumplings on the right. A hand takes its bowl by the far rim,
 * brings it to the pot and lifts its back, so the lip rests on the pot's rim. Past the slip angle
 * the pieces slide out one by one and fall into the broth, which rises as it fills. The bowl goes
 * back to its place. A short, rigid arm cannot carry a level spoonful from one side of the hand to
 * the other without turning the spoon over, so the spoon does what a spoon does here: it stands in
 * the pot, and at the end the right hand stirs with it in slow circles, which mixes the pieces.
 */
export const FOOD_DISHES = { pot: { x: 162, y: 181 } } as const
/** The pot's opening, around its rim. */
export const FOOD_POT_OPENING = { width: 24, depth: 5.5 } as const
/** A prep bowl: half the rim's width and depth as drawn, how deep its body is, and where the palm
 * holds it, measured from the middle of the rim. */
export const FOOD_BOWL = { width: 15, depth: 3.8, body: 10.5, grip: { x: 3, y: -7.5 } } as const
/** Pieces stay put until the bowl is tipped this far, and it is tipped a little further to empty it. */
export const BOWL_SLIP_TILT = 25, BOWL_POUR_TILT = 32
export const SPOON_LENGTH = 26
/** The spoon leans in the pot at this tilt below level, its handle under the right palm. */
const SPOON_LEAN = 45, SPOON_HAND = -9

function ease(progress: number, from: number, to: number) {
  const t = Math.max(0, Math.min(1, (progress - from) / (to - from)))
  return t * t * (3 - 2 * t)
}

// One bowl's journey, for the left hand: down to the bowl, across to the pot's rim, tip, back.
const REACH = 30, AT_RIM = 10, TIPPED = 0
const journey = (start: number, stretch = 1): Key[] => {
  const at = (offset: number) => start + offset * stretch
  return [
    [at(0), 0, 0], [at(.05), REACH, 0], [at(.06), REACH, 0], [at(.12), AT_RIM, 0],
    [at(.17), TIPPED, BOWL_POUR_TILT], [at(.24), TIPPED, BOWL_POUR_TILT], [at(.28), AT_RIM, 0],
    [at(.33), REACH, 0], [at(.34), REACH, 0], [at(.37), 0, 0],
  ]
}
const LEFT_START = .03, RIGHT_START = .44, RIGHT_STRETCH = .8
const leftKeys: readonly Key[] = [[0, 0, 0], ...journey(LEFT_START), [1, 0, 0]]
const rightKeys: readonly Key[] = [[0, 0, 0], ...journey(RIGHT_START, RIGHT_STRETCH), [1, 0, 0]]
/** The hand has its bowl from the middle of the first pause at the bowl to the middle of the last. */
const held = (start: number, stretch = 1) => [start + .055 * stretch, start + .335 * stretch] as const
const LEFT_HELD = held(LEFT_START), RIGHT_HELD = held(RIGHT_START, RIGHT_STRETCH)
/** The four pieces in a bowl slide off in turn once it is tipped past the slip angle. */
const slides = (start: number, stretch = 1) => [.158, .175, .192, .209].map(offset => start + offset * stretch)
export const FOOD_SLIPS = { greens: slides(LEFT_START), extras: slides(RIGHT_START, RIGHT_STRETCH) } as const
/** The right hand takes the spoon, stirs three slow circles and lets it lean again. */
const TAKE_SPOON = [.75, .77] as const, STIR = [.78, .94] as const, LEAVE_SPOON = [.95, .98] as const

function track(p: number, keys: readonly Key[]) {
  const i = Math.max(1, keys.findIndex(key => key[0] >= p))
  const a = keys[i - 1]!, b = keys[i]!, t = ease(p, a[0], b[0])
  return { shoulder: a[1] + (b[1] - a[1]) * t, tilt: a[2] + (b[2] - a[2]) * t }
}
const rotate = (p: ScenePoint, degrees: number): ScenePoint => {
  const r = degrees * Math.PI / 180
  return { x: p.x * Math.cos(r) - p.y * Math.sin(r), y: p.x * Math.sin(r) + p.y * Math.cos(r) }
}

/** `side` is 1 for the left hand and -1 for the right, which mirrors every turn and offset. */
function bowlAt(palm: ScenePoint, tilt: number, side: 1 | -1) {
  const grip = rotate({ x: side * FOOD_BOWL.grip.x, y: FOOD_BOWL.grip.y }, side * tilt)
  const centre = { x: palm.x - grip.x, y: palm.y - grip.y }
  const lip = rotate({ x: side * FOOD_BOWL.width, y: 0 }, side * tilt)
  return { bowl: { ...centre, angle: side * tilt }, lip: { x: centre.x + lip.x, y: centre.y + lip.y } }
}

const share = (p: number, slips: readonly number[]) => slips.reduce((sum, at) => sum + ease(p, at, at + .004) / slips.length, 0)

export function sampleFoodPose(
  p: number, leftRest: SceneArm, rightRest: SceneArm, turn: TurnArm,
): Pick<ScenePoseFrame, 'left' | 'right' | 'food' | 'gaze' | 'contacts'> {
  const l = track(p, leftKeys), r = track(p, rightKeys)
  // Stirring is a circle, not a wiggle: the hand and the spoon's tilt move a quarter turn apart.
  const withSpoon = ease(p, ...TAKE_SPOON) * (1 - ease(p, ...LEAVE_SPOON))
  const stirring = ease(p, STIR[0], STIR[0] + .03) * (1 - ease(p, STIR[1] - .03, STIR[1]))
  const round = 6 * Math.PI * (p - STIR[0]) / (STIR[1] - STIR[0])
  const left = turn(leftRest, l.shoulder)
  const right = turn(rightRest, -(r.shoulder + SPOON_HAND * withSpoon + 2.5 * stirring * Math.sin(round)))
  // A bowl nobody holds stays in its place on the table, which is exactly where the palm meets it.
  const leftHeld = p >= LEFT_HELD[0] && p <= LEFT_HELD[1], rightHeld = p >= RIGHT_HELD[0] && p <= RIGHT_HELD[1]
  const leftBowl = bowlAt(leftHeld ? left.palm : turn(leftRest, REACH).palm, leftHeld ? l.tilt : 0, 1)
  const rightBowl = bowlAt(rightHeld ? right.palm : turn(rightRest, -REACH).palm, rightHeld ? r.tilt : 0, -1)
  // The spoon is rigid. It leans in the pot until the palm closes on its handle.
  const stirHeld = withSpoon === 1
  const grip = stirHeld ? right.palm : turn(rightRest, -SPOON_HAND).palm
  const lean = (180 - SPOON_LEAN + 7 * stirring * (1 - Math.cos(round)) / 2) * Math.PI / 180
  const tip = { x: grip.x + SPOON_LENGTH * Math.cos(lean), y: grip.y + SPOON_LENGTH * Math.sin(lean) }
  const potGreens = share(p, FOOD_SLIPS.greens), potExtras = share(p, FOOD_SLIPS.extras)
  return {
    left, right,
    food: {
      greensLeft: 1 - potGreens, extrasLeft: 1 - potExtras, potGreens, potExtras,
      simmer: ease(p, .75, 1), mix: ease(p, STIR[0] + .02, STIR[1]),
      leftBowl: leftBowl.bowl, rightBowl: rightBowl.bowl, leftLip: leftBowl.lip, rightLip: rightBowl.lip,
      spoon: grip, tip, leftHeld: leftHeld ? 1 : 0, rightHeld: rightHeld ? 1 : 0, stirHeld: stirHeld ? 1 : 0,
    },
    contacts: [
      { name: 'food-bowl-left', hand: left.palm, prop: bowlGrip(leftBowl.bowl, 1), active: leftHeld },
      { name: 'food-bowl-right', hand: right.palm, prop: bowlGrip(rightBowl.bowl, -1), active: rightHeld },
      { name: 'food-spoon', hand: right.palm, prop: grip, active: stirHeld },
    ],
    // Eyes follow the working hand a little, and rest on the pot while it is stirred.
    gaze: { x: -1.5 * ease(p, LEFT_START, LEFT_START + .05) * (1 - ease(p, .36, .40)) + 1.5 * ease(p, RIGHT_START, RIGHT_START + .04) * (1 - ease(p, .70, .735)), y: withSpoon },
  }
}

/** Where on a bowl the palm holds it, in the scene. */
function bowlGrip(bowl: SceneObject, side: 1 | -1): ScenePoint {
  const grip = rotate({ x: side * FOOD_BOWL.grip.x, y: FOOD_BOWL.grip.y }, bowl.angle)
  return { x: bowl.x + grip.x, y: bowl.y + grip.y }
}
