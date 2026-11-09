import type { SceneId } from './types'
import { sampleFoodPose } from './scene-food-rig'
import { drawWandArm } from './scene-wand-arm'
import { palmArc, roundedReach } from './scene-reach'

export interface ScenePoint { x: number; y: number }
/** Five connected cubic curves. Every named pose keeps the same shoulder root. */
export interface SceneArm { points: readonly number[]; palm: ScenePoint }
export type SceneActionKind = 'idle' | 'open' | 'beat' | 'ending'
export interface ScenePoseInput {
  id: SceneId
  status?: 'running' | 'paused' | 'ended'
  progress: number
  /** Local handling cursor; distinct from factual completed progress. */
  activityProgress?: number
  actionKind?: SceneActionKind
  actionProgress?: number
  /** Previous local action cursor captured when an ending interrupts it. */
  endingFromActionProgress?: number
  beatIndex?: number
  staticOnly?: boolean
  touchKind?: 'pat' | 'squish' | 'high-five' | null
}
export interface SceneContact { name: string; hand: ScenePoint; prop: ScenePoint; active: boolean }
export interface SceneObject { x: number; y: number; angle: number }
/** Where the face rests while focusing: toward the work, with the eyelids a little lowered. */
export interface FocusAttention { x: number; y: number; tilt: number; lid: number }
export interface ScenePoseFrame {
  id: SceneId
  progress: number
  action: number
  body: { x: number; y: number; lean: number }
  attention: FocusAttention
  /** The one arm that may make a small rigid adjustment; null keeps both arms exactly as placed. */
  flipperArm: 'left' | 'right' | null
  left: SceneArm
  right: SceneArm
  cup: SceneObject & { scale: number; held: number; liquid: number }
  kettle: SceneObject & { grip: ScenePoint; spout: ScenePoint; pour: number }
  book: { turn: number; close: number; ribbon: number; corner: ScenePoint; coverEdge: ScenePoint; coverFront: ScenePoint }
  boat: { fold: number; transfer: number; x: number; y: number; scale: number; left: ScenePoint; right: ScenePoint }
  wand: SceneObject & { ring: ScenePoint; breath: number; bubbles: readonly { x: number; y: number; radius: number; travel: number }[] }
  blocks: readonly SceneObject[]
  flag: SceneObject
  food: { greens: number; rice: number; soup: number; spoon: ScenePoint; tip: ScenePoint; soupSpoon: ScenePoint; soupTip: ScenePoint; leftHeld: number; rightHeld: number }
  stretch: number
  gaze: ScenePoint
  touched: boolean
  contacts: readonly SceneContact[]
}
const clamp = (v: number) => Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0
const mix = (a: number, b: number, t: number) => a + (b - a) * t
export const sceneSmooth = (v: number) => { const t = clamp(v); return t * t * (3 - 2 * t) }
const span = (p: number, a: number, b: number) => sceneSmooth((p - a) / (b - a))
export const SIMPLE_GESTURE_PHASE_MS = Object.freeze({ anticipation:160, action:640, settle:320 })
/** The normalized 1,120 ms gesture has zero endpoint velocity at each phase. */
export function simpleGesturePulse(progress:number):number {
  const t=clamp(progress),{anticipation,action,settle}=SIMPLE_GESTURE_PHASE_MS,total=anticipation+action+settle
  const first=anticipation/total,second=(anticipation+action)/total
  if(t<=first)return .04*sceneSmooth(t/first)
  if(t<=second)return .04+.96*sceneSmooth((t-first)/(second-first))
  return 1-sceneSmooth((t-second)/(1-second))
}
export const NO_ATTENTION: FocusAttention = Object.freeze({ x: 0, y: 0, tilt: 0, lid: 1 })
/** The drawing without an activity has nothing to look at but its own quiet work, just below. */
export const PLAIN_FOCUS_ATTENTION: FocusAttention = Object.freeze({ x: 0, y: 2, tilt: 0, lid: .92 })
// Stargazing already looks up through its own gaze and lean, so it keeps its eyes wide.
const FOCUS_ATTENTION: Readonly<Record<string, FocusAttention>> = {
  F1: { x: 0, y: 2.2, tilt: .6, lid: .92 }, F2: { x: -1.6, y: 1.6, tilt: -1.6, lid: .92 },
  F3: { x: .4, y: 2.4, tilt: .8, lid: .9 }, F4: { x: -.8, y: .8, tilt: -1, lid: .92 },
  F5: { x: 1, y: 0, tilt: .8, lid: .96 }, F6: { x: 1.4, y: 2, tilt: 1.2, lid: .92 },
  F7: { x: -1.6, y: 1.8, tilt: -1.4, lid: .92 }, F8: { x: -.6, y: -.8, tilt: -1, lid: 1 },
}
/** Measured on the drawing: these arms stay clear of every item through the whole gesture. */
const FLIPPER_ARM: Readonly<Record<string, 'left' | 'right'>> = { F2: 'right', F5: 'left', F8: 'right' }
const FACE_CENTRE = { x: 120, y: 100 }, EYE_LINE = 94
const fixed = (v: number) => Math.round(v * 1000) / 1000
/** Static placement under the live gestures; shown unchanged with motion off. */
export function focusAttentionTransforms(a: FocusAttention): { head: string | undefined; eyes: string | undefined } {
  if (a.x === 0 && a.y === 0 && a.tilt === 0 && a.lid === 1) return { head: undefined, eyes: undefined }
  return {
    head: `translate(${a.x} ${a.y}) rotate(${a.tilt} ${FACE_CENTRE.x} ${FACE_CENTRE.y})`,
    eyes: `translate(${fixed(a.x * .6)} ${fixed(a.y * .6)}) translate(${FACE_CENTRE.x} ${EYE_LINE}) scale(1 ${a.lid}) translate(${-FACE_CENTRE.x} ${-EYE_LINE})`,
  }
}
const point = (x: number, y: number): ScenePoint => ({ x, y })
const pointMix = (a: ScenePoint, b: ScenePoint, t: number): ScenePoint => point(mix(a.x, b.x, t), mix(a.y, b.y, t))
const arm = (points: readonly number[], x: number, y: number): SceneArm => ({ points, palm: point(x, y) })
const mirror = (a: SceneArm): SceneArm => ({ points: a.points.map((v, i) => i % 2 === 0 ? 324 - v : v), palm: point(324 - a.palm.x, a.palm.y) })
export function sceneArmPath(a: SceneArm): string {
  const n = (v: number | undefined) => Math.round((v ?? 0) * 1000) / 1000
  let d = `M${n(a.points[0])} ${n(a.points[1])}`
  for (let i = 2; i < a.points.length; i += 6) d += ` C${a.points.slice(i, i + 6).map(n).join(' ')}`
  return `${d} Z`
}
// Deliberately drawn rounded silhouettes, rather than a tube between endpoints.
const restLeft = arm([111,143, 103,143,104,159,116,169, 123,177,135,177,137,170, 139,164,132,162,127,162, 121,161,117,153,117,149, 117,145,116,142,111,143],133,168)
function rotateArm(a: SceneArm, degrees:number):SceneArm {
  const x=a.points[0]??0,y=a.points[1]??0,r=degrees*Math.PI/180,c=Math.cos(r),s=Math.sin(r)
  const rotate=(px:number,py:number)=>point(x+(px-x)*c-(py-y)*s,y+(px-x)*s+(py-y)*c)
  const points:number[]=[]
  for(let i=0;i<a.points.length;i+=2){const q=rotate(a.points[i]??x,a.points[i+1]??y);points.push(q.x,q.y)}
  return {points,palm:rotate(a.palm.x,a.palm.y)}
}
export function transformScenePoint(p: ScenePoint, object: SceneObject): ScenePoint {
  const r = object.angle * Math.PI / 180
  return point(object.x + p.x * Math.cos(r) - p.y * Math.sin(r), object.y + p.x * Math.sin(r) + p.y * Math.cos(r))
}

export const BUBBLE_WAND = { length: 23, ringWidth: 8.5, ringDepth: 5.5, jarX: 196, rimY: 191, rimWidth: 20, rimDepth: 5 } as const
/** The plant's physical rim and table support, shared by the pose and drawing. */
export const PLANT_POT = { x:74, rimY:158, rimWidth:20, rimDepth:5, bodyWidth:18, baseWidth:14, baseY:188, floorY:191 } as const
// Both hands rest on the table as mirror images, with the pot clear of the left arm.
const plantRight = arm([
  213,143,
  221,141.5, 225,151, 223,160,
  221,169, 216,179, 209,184,
  205,187, 200,187, 197.5,184,
  194,180, 200,176, 202.5,171,
  206.5,163, 205,143, 213,143,
], 202,181)
const plantLeft = mirror(plantRight)
const bubbleFlights = [
  { from: 0, to: .4, x: 258, y: 88, radius: 17 },
  { from: .4, to: .75, x: 228, y: 54, radius: 12 },
  { from: .75, to: 1, x: 281, y: 51, radius: 9 },
] as const

// The elbow hangs alongside the belly. The two limb lengths stay constant as
// the forearm folds. A held wand follows the palm through that same arc.
function bubbleArmJoints(reach: number, lift: number) {
  const joint = (base: ScenePoint, length: number, degrees: number) => {
    const angle = degrees * Math.PI / 180
    return point(base.x + length * Math.cos(angle), base.y + length * Math.sin(angle))
  }
  const elbow = joint(point(213,143), 24, mix(93,60,reach) + 9*lift - 4*Math.sin(Math.PI*lift))
  const palm = joint(elbow, 23, mix(172,110,reach) + 77*lift)
  return { elbow, palm }
}

const bubbleGrip = (lift: number): SceneObject => ({
  ...bubbleArmJoints(1,lift).palm,
  angle: mix(48,118,span(lift,.23,.94)),
})
const bubbleLoop = point(0,BUBBLE_WAND.length)
const blowOrigin = transformScenePoint(bubbleLoop,bubbleGrip(1))

function bubblePose(p: number) {
  const flight = bubbleFlights.find(item => p <= item.to) ?? bubbleFlights[2]
  const cycle = clamp((p-flight.from)/(flight.to-flight.from))
  const reach = span(cycle,0,.13) * (1-span(cycle,.86,1))
  const lift = span(cycle,.13,.44) * (1-span(cycle,.63,.86))
  const { elbow, palm } = bubbleArmJoints(reach,lift)
  const grip = bubbleGrip(lift)
  const breath = span(cycle,.44,.49) * (1-span(cycle,.56,.63))
  const bubbles = bubbleFlights.map(({from,to,x,y,radius}) => {
    const phase = clamp((p-from)/(to-from))
    const film = span(phase,.465,.55)
    const travel = span(phase,.53,.96)
    const size = radius * film * mix(.27,1,travel)
    // Once the film detaches, its flight passes above the gripping hand.
    const start = point(blowOrigin.x + radius*.27*film, blowOrigin.y)
    const control = point(238,104)
    const drift = pointMix(pointMix(start,control,travel), pointMix(control,point(x,y),travel), travel)
    return {
      ...drift,
      radius: size, travel,
    }
  })
  return {
    arm: drawWandArm(elbow,palm),
    held: reach === 1,
    gaze: point(1.5 + reach, 1.6*(1-lift)),
    wand: { ...grip, ring: transformScenePoint(bubbleLoop,grip), breath, bubbles },
  }
}
export const SCENE_CUP_SCALE = .72
/** Where the cup waits on its saucer: under the kettle's spout, so water can fall straight in. */
export const TEA_CUP_HOME = {x:122,y:180}
const TEA_CUP_HELD = {x:157,y:175}
const POUR_TILT = 32
// The hand position that puts the tilted spout just above the left of the cup's opening.
const POUR_GRIP = point(88.85,123.24)
export const SCENE_CUP_BASE = {x:-12,y:0}
export const SCENE_CUP_HANDLE = {x:29,y:-9}
export const BLOCK_HEIGHT = 22
function cupAnchor(local: ScenePoint, cup: SceneObject & {scale:number}): ScenePoint { return transformScenePoint(point(local.x*cup.scale,local.y*cup.scale),cup) }
const contact = (name: string, hand: ScenePoint, prop: ScenePoint, active = true): SceneContact => ({ name, hand, prop, active })

/** A carried block eases between [time, x, bottom] stops. */
function carry(t: number, stops: readonly (readonly [number, number, number])[]): SceneObject {
  let from = stops[0]!, to = from
  for (const next of stops.slice(1)) {
    to = next
    if (t <= next[0]) break
    from = next
  }
  const u = from === to ? 0 : span(t, from[0], to[0])
  return { x: mix(from[1], to[1], u), y: mix(from[2], to[2], u), angle: 0 }
}

/** Pure sampled geometry. All clocks, scheduling, cues and persistence remain outside. */
export function sampleScenePose(input: ScenePoseInput): ScenePoseFrame {
  const progress = clamp(input.progress)
  const p = clamp(input.activityProgress ?? input.progress)
  const a = clamp(input.actionProgress ?? 0)
  const previousAction=clamp(input.endingFromActionProgress??0)
  const previousPulse=simpleGesturePulse(previousAction)
  const pulse = input.actionKind==='ending' ? previousPulse*(1-sceneSmooth(a))
    : input.actionKind && input.actionKind !== 'idle' ? simpleGesturePulse(a) : 0
  let left = restLeft, right = mirror(restLeft)
  const body = { x: 42, y: 38, lean: 0 }
  const contacts: SceneContact[] = []
  const cup = { x: TEA_CUP_HELD.x-1, y: TEA_CUP_HELD.y, angle: 0, scale: SCENE_CUP_SCALE, held: 1, liquid: 1 }
  const kettle = { x: 131, y: 179, angle: 0, grip: point(131,135), spout: point(166,153), pour: 0 }
  const book = { turn: 0, close: 0, ribbon: span(p,.66,.74), corner: point(206,161), coverEdge: point(206,161), coverFront: point(214,175) }
  const boat = { fold: p, transfer: span(p,.78,1), x:150, y:0, scale:.71, left: point(135,173), right: point(189,174) }
  let wand: ScenePoseFrame['wand'] = { x: 240, y: 165, angle: 0, ring: point(240,193), breath: 0, bubbles: [] }
  const blocks: SceneObject[] = [{x:64,y:186,angle:0},{x:196,y:186,angle:0},{x:100,y:186,angle:0},{x:100,y:164,angle:0}]
  const flag = { x: 136, y: 184, angle: 0 }
  let food = { greens: span(p,.16,.29), rice: span(p,.43,.58), soup: span(p,.76,.88), spoon: point(129,188), tip: point(104,195), soupSpoon: point(222,188), soupTip: point(248,193), leftHeld: 0, rightHeld: 0 }
  let stretch = 0
  let gaze = point(0,0)
  if (input.id === 'F4') {
    // Lift first, then tilt. Water only runs once the spout is low enough, and it stops
    // before the kettle levels out, so the stream never hangs from a level kettle.
    const raise = span(p,.58,.625) * (1-span(p,.725,.75))
    const tilt = span(p,.625,.665) * (1-span(p,.705,.735))
    const lift = span(p,.795,.9), support = span(p,.76,.795)
    // Sit facing the tea table with the arms hanging slightly forward, once the kettle is down.
    const gather = span(p,.76,.82)
    // A small lean toward the kettle as it goes down keeps the arm at its usual length.
    const setDown = span(p,.725,.75) * (1-span(p,.76,.795))
    body.x = 42 + 6 * gather - 4 * setDown; body.y = 38 + 2 * gather
    const ls = point(body.x+74,body.y+105), rs = point(body.x+161,body.y+105)
    const handle = point(6.616,-43.4) // just past the middle of the top handle
    // Set down a little further out, so the spout is clear of the arm reaching for the cup.
    const park = span(p,.725,.75)
    const grip = pointMix(point(72-7*park+handle.x,180+handle.y),POUR_GRIP,raise)
    kettle.grip = grip; kettle.angle = POUR_TILT*tilt
    const handleOffset = transformScenePoint(handle,{x:0,y:0,angle:kettle.angle})
    kettle.x = grip.x-handleOffset.x; kettle.y = grip.y-handleOffset.y
    kettle.spout = transformScenePoint(point(47,-30),kettle)
    kettle.pour = span(tilt,.78,.92)
    cup.liquid = span(p,.665,.708)
    // The left palm under the cup carries it to the chest; the right hand joins near the end.
    cup.x = mix(TEA_CUP_HOME.x,TEA_CUP_HELD.x,lift); cup.y = mix(TEA_CUP_HOME.y,TEA_CUP_HELD.y,lift)
    cup.held = span(p,.87,.93)
    const rp = cupAnchor(SCENE_CUP_HANDLE,cup), lp = cupAnchor(SCENE_CUP_BASE,cup)
    // Release the stationary kettle through its near side. A low arc beyond
    // the lid and below the raised spout brings the palm under the cup.
    const out = point(88,152), under = point(90,194)
    const a = pointMix(grip,out,support), b = pointMix(out,under,support), c = pointMix(under,lp,support)
    const leftPalm = pointMix(pointMix(a,b,support),pointMix(b,c,support),support)
    left = roundedReach('left',ls,leftPalm,.60)
    right = roundedReach('right',rs,palmArc(rs,point(rs.x-23,rs.y+29),rp,cup.held))
    if(support===0)contacts.push(contact('kettle-handle',left.palm,kettle.grip))
    if(support===1)contacts.push(contact('cup-base',left.palm,lp))
    if(cup.held===1)contacts.push(contact('cup-handle',right.palm,rp))
    gaze.x=-2*(1-lift)
  } else if(input.id==='F3') {
    const ls = point(111,143), rs = point(213,143)
    const leftRest = point(136,169), rightRest = point(188,169)
    let leftPalm = leftRest, rightPalm = rightRest
    const turn = span(p,.12,.34)
    book.turn = turn; book.close = span(p,.815,.957)
    const edge = (fraction: number, rise: number) => point(
      150 + 39 * Math.cos(fraction * Math.PI), 162 - rise * Math.sin(fraction * Math.PI))
    book.corner = edge(turn,5)
    // Thumb near the fore-edge turns a page; it can settle onto its own stack.
    const pageGrip = point(.74*book.corner.x+.26*150+16, .74*book.corner.y+.26*169+8)
    const grasp = span(p,.08,.12) * (1-span(turn,.30,.46))
    rightPalm = palmArc(rs,rightPalm,pageGrip,grasp)
    if(grasp===1)contacts.push(contact('page-corner',rightPalm,pageGrip))
    const ribbon = span(p,.5,.56) * (1-span(p,.68,.74))
    const marker = point(180,167)
    rightPalm = palmArc(rs,rightPalm,marker,ribbon)
    if(ribbon===1)contacts.push(contact('bookmark',rightPalm,marker))

    // The book sits diagonally. The two hands hold opposite corners of the
    // same fore-edge as the cover passes the spine.
    const close = book.close
    book.coverEdge = edge(close,4)
    book.coverFront = point(book.coverEdge.x+29,book.coverEdge.y+11)
    // Slide the supporting palm along the fore-edge as its perspective turns.
    const rightGrip = pointMix(book.coverEdge,book.coverFront,span(close,.1,.5))
    const leftGrip = pointMix(book.coverEdge,book.coverFront,.76 * span(close,.54,.90))
    const rightHold = span(p,.75,.815) * (1-span(close,.50,.57))
    const leftHold = span(close,.40,.50) * (1-span(p,.957,1))
    rightPalm = palmArc(rs,rightPalm,rightGrip,rightHold)
    leftPalm = palmArc(ls,leftPalm,leftGrip,leftHold)
    left = roundedReach('left',ls,leftPalm); right = roundedReach('right',rs,rightPalm)
    if(rightHold===1)contacts.push(contact('cover-right',right.palm,rightGrip))
    if(leftHold===1)contacts.push(contact('cover-left',left.palm,leftGrip))
  } else if(input.id==='F6') {
    const fold1=span(p,.12,.39),fold2=span(p,.43,.73),t=boat.transfer
    const travel=span(t,.28,.88)
    boat.x=mix(162,221,travel);boat.y=-3*Math.sin(travel*Math.PI)
    const paperGrip = (x: number, y: number) => point(boat.x+(x-160)*.71,180+(y-180)*.71+boat.y)
    boat.left=paperGrip(126+fold1*6,170-fold1*8+fold2*8)
    const rightPaper=paperGrip(192-fold1*3-fold2*5,170-fold2*5)
    // Slip one palm under the near corner while the paper is on the table,
    // then release the other before carrying the hull the short way to water.
    boat.right=pointMix(rightPaper,point(boat.x+29-24*travel,178+boat.y),span(t,0,.15))
    const leftRelease=span(t,.14,.28),rightRelease=span(t,.88,1)
    const ls = point(111,143), rs = point(213,143)
    left = roundedReach('left',ls,palmArc(ls,boat.left,restLeft.palm,leftRelease))
    right = roundedReach('right',rs,palmArc(rs,boat.right,mirror(restLeft).palm,rightRelease))
    contacts.push(contact('paper-left',left.palm,boat.left,leftRelease===0),contact('paper-right',right.palm,boat.right,rightRelease===0))
  } else if(input.id==='R3') {
    const ls = point(111,143), rs = point(213,143)
    const ending = input.status === 'ended'
    const put = ending ? (input.actionKind === 'ending' ? a : 1) : 0
    const travel = span(put,.2,.85)
    const sip = ending ? previousPulse : pulse
    cup.x=154; cup.y=169-10*sip; cup.angle=-2*sip || 0
    const heldBase = cupAnchor(SCENE_CUP_BASE,cup)
    const heldHandle = cupAnchor(SCENE_CUP_HANDLE,cup)
    const parked = {x:226,y:176,scale:cup.scale,angle:0}
    if(ending && put>0){
      // Carry the cup around the shoulder at a comfortable distance. The
      // handle stays in the hand even as the cup rotates back to level.
      cup.angle *= 1-span(put,0,.2)
      const handle = palmArc(rs,heldHandle,cupAnchor(SCENE_CUP_HANDLE,parked),travel)
      const offset = cupAnchor(SCENE_CUP_HANDLE,{x:0,y:0,angle:cup.angle,scale:cup.scale})
      cup.x = handle.x-offset.x; cup.y = handle.y-offset.y
      if(travel===1){cup.x=parked.x;cup.y=parked.y;cup.angle=0}
    }
    cup.held = 1-span(put,.85,.95)
    const rightHandle = cupAnchor(SCENE_CUP_HANDLE,cup)
    const leftRelease = span(put,0,.2), rightRelease = span(put,.85,1)
    left = roundedReach('left',ls,palmArc(ls,heldBase,restLeft.palm,leftRelease))
    right = roundedReach('right',rs,palmArc(rs,rightHandle,mirror(restLeft).palm,rightRelease))
    contacts.push(contact('cup-base',left.palm,heldBase,leftRelease===0),contact('cup-handle',right.palm,rightHandle,rightRelease===0))
  } else if(input.id==='F1') {
    const serving = sampleFoodPose(p, left, right, rotateArm)
    left = serving.left
    right = serving.right
    food = serving.food
    gaze = serving.gaze
    contacts.push(...serving.contacts)
  } else if(input.id==='F2') {
    // Both hands rest on the table. Only the eyes turn toward the plant.
    left=plantLeft
    right=plantRight
    if (!input.staticOnly) {
      gaze.x -= 1.5 * pulse
      gaze.y = pulse
    }
  } else if(input.id==='F5') {
    const pose = bubblePose(p)
    right = pose.arm
    // The idle hand mirrors the wand arm's resting shape.
    const idle = bubbleArmJoints(0,0)
    left = mirror(drawWandArm(idle.elbow,idle.palm))
    wand = pose.wand
    gaze = pose.gaze
    contacts.push(contact('wand-handle',right.palm,point(wand.x,wand.y),pose.held))
  } else if(input.id==='F7') {
    // Blocks on the low table, within the left hand's easy reach. The two to move start as a
    // small stack beside the hand; the base stands to the left, a spare one on the right.
    const first=span(p,.14,.34), second=span(p,.45,.7)
    // Follow the little lift and settle over the stack instead of stretching
    // the forearm across the table. Both shoulder roots travel with the torso.
    body.y = 27 - 5 * Math.sin(Math.PI * first)
    body.x -= 4 * span(first,0,.84) * (1-span(p,.34,.44))
    const shoulder = point(body.x+69,body.y+105), rest = point(shoulder.x+22,shoulder.y+25)
    right = roundedReach('right',point(body.x+171,body.y+105),point(body.x+149,body.y+130),.56)
    const base=blocks[0]!, tableY=base.y, onBaseY=tableY-BLOCK_HEIGHT
    // The near palm supports the underside of the top block. A small lift
    // clears both stacks and keeps the hand below the face.
    blocks[3] = carry(first,[[0,102,onBaseY],[.22,102,onBaseY-6],[.72,65,onBaseY-6],[1,64,onBaseY]])
    blocks[2] = {x:mix(102,96,second),y:tableY,angle:0}
    const hold1=span(p,.08,.14)*(1-span(p,.34,.4))
    const hold2=span(second,.1,.3)*(1-span(p,.7,.75))
    const grip1=point(blocks[3]!.x+20,blocks[3]!.y-1), grip2=point(blocks[2]!.x+27,blocks[2]!.y-19)
    const raise=span(p,.8,.94)
    const flagSeat = onBaseY-BLOCK_HEIGHT-3
    // First move in front of the stack, lift outside its right edge, then
    // put the pole into the top. The hand never cuts through its shoulder.
    const flagGrip = carry(raise,[[0,127,168],[.29,79,156],[.66,78,117],[.82,79,116],[1,79,flagSeat-16]])
    flag.x = flagGrip.x; flag.y = flagGrip.y + 16
    const fg=point(flagGrip.x,flagGrip.y), flagHold=span(p,.76,.8)*(1-span(p,.94,1))
    const [grip,hold] = flagHold>0 ? [fg,flagHold] as const : hold2>0 ? [grip2,hold2] as const : [grip1,hold1] as const
    const palm = palmArc(shoulder,rest,grip,hold)
    // The bend stays small as the palm turns out past the shoulder.
    left = roundedReach('left',shoulder,palm,.56)
    if(hold1>.999)contacts.push(contact('block-first',left.palm,grip1))
    if(hold2>.999)contacts.push(contact('block-second',left.palm,grip2))
    if(flagHold>.999)contacts.push(contact('flag-stem',left.palm,fg))
  } else if(input.id==='F8'||input.id==='R2') {
    body.lean=-5;gaze.x=-2;gaze.y=-4
  } else if(input.id==='R1') {
    // Lift into a comfortable V, hold it for a breath, then lower both arms.
    const ending = input.actionKind === 'ending'
    const phase = ending ? previousAction : a
    if (input.actionKind && input.actionKind !== 'idle') {
      stretch = span(phase, 0, .38) * (1 - span(phase, .56, 1))
      if (ending) stretch *= 1 - sceneSmooth(a)
    }
    left = rotateArm(restLeft, 170 * stretch)
    right = mirror(left)
  }
  const attention = input.status !== 'ended' && progress < 1 ? FOCUS_ATTENTION[input.id] ?? NO_ATTENTION : NO_ATTENTION
  const flipperArm = attention === NO_ATTENTION ? null : FLIPPER_ARM[input.id] ?? null
  return {id:input.id,progress,action:pulse,body,attention,flipperArm,left,right,cup,kettle,book,boat,wand,blocks,flag,food,stretch,gaze,touched:!!input.touchKind,contacts}
}
