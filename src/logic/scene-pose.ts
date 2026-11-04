import type { SceneId } from './types'

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
export interface ScenePoseFrame {
  id: SceneId
  progress: number
  action: number
  body: { x: number; y: number; lean: number }
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
const point = (x: number, y: number): ScenePoint => ({ x, y })
const pointMix = (a: ScenePoint, b: ScenePoint, t: number): ScenePoint => point(mix(a.x, b.x, t), mix(a.y, b.y, t))
const arm = (points: readonly number[], x: number, y: number): SceneArm => ({ points, palm: point(x, y) })
const mirror = (a: SceneArm): SceneArm => ({ points: a.points.map((v, i) => i % 2 === 0 ? 324 - v : v), palm: point(324 - a.palm.x, a.palm.y) })
const translateArm = (a: SceneArm, x: number, y: number): SceneArm => ({ points: a.points.map((v, i) => v + (i % 2 === 0 ? x : y)), palm: point(a.palm.x + x, a.palm.y + y) })
export function blendSceneArm(a: SceneArm, b: SceneArm, t: number): SceneArm {
  const u=clamp(t)
  if(u===0)return a
  if(u===1)return b
  const ax=a.points[0]??0,ay=a.points[1]??0,bx=b.points[0]??ax,by=b.points[1]??ay
  const aa=Math.atan2(a.palm.y-ay,a.palm.x-ax),ba=Math.atan2(b.palm.y-by,b.palm.x-bx)
  const delta=Math.atan2(Math.sin(ba-aa),Math.cos(ba-aa)),c=Math.cos(-delta),s=Math.sin(-delta)
  const root=pointMix(point(ax,ay),point(bx,by),u),rc=Math.cos(delta*u),rs=Math.sin(delta*u)
  const blend=(ap:ScenePoint,bp:ScenePoint)=>{
    const dx=bp.x-bx,dy=bp.y-by
    const x=mix(ap.x-ax,dx*c-dy*s,u),y=mix(ap.y-ay,dx*s+dy*c,u)
    return point(root.x+x*rc-y*rs,root.y+x*rs+y*rc)
  }
  const points:number[]=[]
  for(let i=0;i<a.points.length;i+=2){const p=blend(point(a.points[i]??ax,a.points[i+1]??ay),point(b.points[i]??bx,b.points[i+1]??by));points.push(p.x,p.y)}
  return {points,palm:blend(a.palm,b.palm)}
}
export function sceneArmPath(a: SceneArm): string {
  const n = (v: number | undefined) => Math.round((v ?? 0) * 1000) / 1000
  let d = `M${n(a.points[0])} ${n(a.points[1])}`
  for (let i = 2; i < a.points.length; i += 6) d += ` C${a.points.slice(i, i + 6).map(n).join(' ')}`
  return `${d} Z`
}
// Deliberately drawn rounded silhouettes, rather than a tube between endpoints.
const restLeft = arm([111,143, 103,143,104,159,116,169, 123,177,135,177,137,170, 139,164,132,162,127,162, 121,161,117,153,117,149, 117,145,116,142,111,143],133,168)
const pressLeft = arm([111,143, 102,143,104,159,116,170, 124,179,137,181,144,175, 149,170,143,166,139,167, 130,170,122,162,119,155, 117,149,118,142,111,143],141,172)
const pageRight = arm([213,143, 223,146,222,158,213,165, 205,169,194,159,184,151, 179,147,180,141,185,140, 191,141,198,150,204,151, 210,152,205,141,213,143],185,146)
const cupLeft = arm([111,143, 102,143,106,162,117,174, 125,183,138,185,148,180, 153,177,151,171,146,171, 138,173,129,168,125,162, 120,154,122,143,111,143],147,177)
const cupRight = arm([213,143, 223,146,218,165,205,176, 199,181,189,181,183,175, 179,171,182,165,187,165, 193,167,199,164,201,158, 203,150,205,142,213,143],184,171)
/** Retarget an authored curved limb without folding its outline over itself.
 * The shoulder remains fixed. Only length along the reach axis changes;
 * perpendicular silhouette width is preserved throughout. */
function movePalm(a: SceneArm, x: number, y: number): SceneArm {
  const sx=a.points[0]??0,sy=a.points[1]??0
  const ox=a.palm.x-sx,oy=a.palm.y-sy,oldLength=Math.hypot(ox,oy)
  const tx=ox+x,ty=oy+y,newLength=Math.hypot(tx,ty)
  if(oldLength<.001||newLength<.001)return a
  const ux=ox/oldLength,uy=oy/oldLength,vx=tx/newLength,vy=ty/newLength,ratio=newLength/oldLength
  const points:number[]=[]
  for(let i=0;i<a.points.length;i+=2){
    const dx=(a.points[i]??sx)-sx,dy=(a.points[i+1]??sy)-sy
    const along=(dx*ux+dy*uy)*ratio,across=-dx*uy+dy*ux
    points.push(sx+vx*along-vy*across,sy+vy*along+vx*across)
  }
  return {points,palm:point(a.palm.x+x,a.palm.y+y)}
}

/** Drawn-arm proportions the generated reach keeps: half-widths at the shoulder and the
 * elbow, and the radius of the round palm, so a reach reads as the same plump limb as the
 * rest pose rather than a thin tube. */
const REACH_SHOULDER = 8, REACH_ELBOW = 7, REACH_PALM = 9
/** A folding elbow and a round palm for carries across the body. The sixteen points are
 * cubic controls like the drawn arms, so the elbow is a smooth bend and the palm a cap. */
function bentReach(side: 'left' | 'right', palm: ScenePoint, posedElbow?: ScenePoint, origin: ScenePoint = point(0, 0)): SceneArm {
  const left = side === 'left'
  const shoulder = point((left ? 111 : 213) + origin.x, 143 + origin.y)
  const dx = palm.x - shoulder.x, dy = palm.y - shoulder.y
  const distance = Math.max(.001, Math.hypot(dx, dy))
  const direction = point(dx / distance, dy / distance)
  const outside = left ? point(-direction.y, direction.x) : point(direction.y, -direction.x)
  const bend = mix(23, 6, span(distance, 16, 60))
  const offset = (p: ScenePoint, axis: ScenePoint, amount: number) => point(p.x + axis.x * amount, p.y + axis.y * amount)
  const elbow = posedElbow ?? offset(pointMix(shoulder, palm, .5), outside, bend)
  const unitFrom = (a: ScenePoint, b: ScenePoint) => {
    const x = b.x - a.x, y = b.y - a.y, length = Math.max(.001, Math.hypot(x, y))
    return point(x / length, y / length)
  }
  const upper = unitFrom(shoulder, elbow), forearm = unitFrom(elbow, palm)
  // A long reach slims a little, as a stretched arm does, so it stays comparable to the rest arm.
  const slim = mix(1, .76, span(distance, 28, 70))
  const shoulderWidth = REACH_SHOULDER * slim, elbowWidth = REACH_ELBOW * slim, palmRadius = REACH_PALM * slim
  // The outline's tangent at the elbow bisects the two limbs, and the corner widens with the
  // bend so the arm keeps its width through it. The outer side is the side the elbow bows to,
  // whichever way the hand has swung, so the bend never flips between frames.
  const sum = point(upper.x + forearm.x, upper.y + forearm.y), sumLength = Math.hypot(sum.x, sum.y)
  const bisector = sumLength < .05 ? upper : point(sum.x / sumLength, sum.y / sumLength)
  const bow = (elbow.x - shoulder.x) * direction.y - (elbow.y - shoulder.y) * direction.x
  const handed = bow < -.01 ? -1 : bow > .01 ? 1 : left ? -1 : 1
  const normal = (axis: ScenePoint) => point(axis.y * handed, -axis.x * handed)
  const corner = elbowWidth / Math.max(.6, bisector.x * upper.x + bisector.y * upper.y)
  const elbowOut = offset(elbow, normal(bisector), corner), elbowIn = offset(elbow, normal(bisector), -corner)
  const palmOut = offset(palm, normal(forearm), palmRadius), palmIn = offset(palm, normal(forearm), -palmRadius)
  const upperPull = Math.hypot(elbow.x - shoulder.x, elbow.y - shoulder.y) * .3
  const forePull = Math.hypot(palm.x - elbow.x, palm.y - elbow.y) * .3
  const cap = palmRadius * 4 / 3
  const points = [
    shoulder,
    offset(shoulder, normal(upper), shoulderWidth), offset(elbowOut, bisector, -upperPull), elbowOut,
    offset(elbowOut, bisector, forePull), offset(palmOut, forearm, -forePull * .7), palmOut,
    offset(palmOut, forearm, cap), offset(palmIn, forearm, cap), palmIn,
    offset(palmIn, forearm, -forePull * .7), offset(elbowIn, bisector, forePull), elbowIn,
    offset(elbowIn, bisector, -upperPull), offset(shoulder, normal(upper), -shoulderWidth), shoulder,
  ]
  // The drawn arms run down one fixed side of the reach and back up the other, so a blend
  // pairs each point with its counterpart. When this bend puts the first side on the other
  // hand of the reach, the outline is traversed the other way round.
  const firstSide = direction.x * (elbowOut.y - shoulder.y) - direction.y * (elbowOut.x - shoulder.x)
  const ordered = (left ? firstSide < 0 : firstSide > 0)
    ? [points[0]!, ...points.slice(1, 15).reverse(), points[0]!] : points
  return { points: ordered.flatMap(p => [p.x, p.y]), palm }
}
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
export const PLANT_POT = { x:110, rimY:158, rimWidth:26, rimDepth:6, bodyWidth:24, baseWidth:18, baseY:188, floorY:191 } as const
export function plantRimPoint(angle:number):ScenePoint {
  return point(PLANT_POT.x+PLANT_POT.rimWidth*Math.cos(angle),PLANT_POT.rimY+PLANT_POT.rimDepth*Math.sin(angle))
}
// Bend inward from the shoulder before laying the round palm over the near rim.
// A dedicated outline avoids compressing a long reach into the old tiny hook.
const plantLeft = arm([111,143, 120,139,139,143,140,153, 141,160,138,165,132,165, 126,166,125,161,129,158, 135,155,132,151,126,152, 120,153,111,150,111,143],131,161)
const plantRight = arm([213,143, 222,143,223,161,218,173, 214,184,205,188,198,184, 192,181,194,175,199,174, 207,173,211,162,208,155, 206,148,206,142,213,143],199,180)
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
    arm: bentReach('right',palm,elbow),
    held: reach === 1,
    gaze: point(1.5 + reach, 1.6*(1-lift)),
    wand: { ...grip, ring: transformScenePoint(bubbleLoop,grip), breath, bubbles },
  }
}
export const SCENE_CUP_SCALE = .72
export const SCENE_CUP_BASE = {x:-8,y:2}
export const SCENE_CUP_HANDLE = {x:29,y:-9}
export const BLOCK_HEIGHT = 22
function cupAnchor(local: ScenePoint, cup: SceneObject & {scale:number}): ScenePoint { return transformScenePoint(point(local.x*cup.scale,local.y*cup.scale),cup) }
const contact = (name: string, hand: ScenePoint, prop: ScenePoint, active = true): SceneContact => ({ name, hand, prop, active })

/** A serving spoon keeps its length while travelling between nearby supported poses. */
function foodUtensil(p: number, stops: readonly (readonly [number, number, number, number])[]): { grip: ScenePoint; tip: ScenePoint } {
  let from = stops[0]!, to = from
  for (const next of stops.slice(1)) {
    to = next
    if (p <= next[0]) break
    from = next
  }
  const t = from === to ? 0 : span(p, from[0], to[0])
  const grip = point(mix(from[1],to[1],t),mix(from[2],to[2],t))
  const angle = mix(from[3],to[3],t) * Math.PI / 180
  return { grip, tip: point(grip.x+26*Math.cos(angle),grip.y+26*Math.sin(angle)) }
}

/** The left hand placing blocks on the tower beside it. Its elbow always bows outward and
 * down: the same side as an ordinary reach down and across the body, but it never arches
 * over the block, the tower or the face, even while the hand passes close by the shoulder.
 * The bow grows a little more than bentReach's as the hand comes in, so the folded arm
 * keeps its length. */
function towerReach(palm: ScenePoint): SceneArm {
  const shoulder = point(111,143), distance = Math.max(.001, Math.hypot(palm.x-shoulder.x, palm.y-shoulder.y))
  // Only the part of that outward-and-down bow that is square to the reach moves the elbow,
  // so a reach in the same direction keeps a straight arm rather than an elbow at the palm.
  const chord = point((palm.x-shoulder.x)/distance, (palm.y-shoulder.y)/distance)
  const along = -.8*chord.x + .6*chord.y
  const bowX = -.8 - chord.x*along, bowY = .6 - chord.y*along
  const bend = mix(14, 6, span(distance, 8, 60)), middle = pointMix(shoulder, palm, .5)
  return bentReach('left', palm, point(middle.x + bowX*bend, middle.y + bowY*bend))
}

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
  const cup = { x: 156, y: 175, angle: 0, scale: SCENE_CUP_SCALE, held: 1, liquid: 1 }
  const kettle = { x: 131, y: 179, angle: 0, grip: point(131,135), spout: point(166,153), pour: 0 }
  const book = { turn: 0, close: 0, ribbon: span(p,.66,.74), corner: point(206,161), coverEdge: point(206,161), coverFront: point(214,175) }
  const boat = { fold: p, transfer: span(p,.78,1), x:150, y:0, scale:.71, left: point(135,173), right: point(189,174) }
  let wand: ScenePoseFrame['wand'] = { x: 240, y: 165, angle: 0, ring: point(240,193), breath: 0, bubbles: [] }
  const blocks: SceneObject[] = [{x:56,y:186,angle:0},{x:196,y:186,angle:0},{x:100,y:186,angle:0},{x:100,y:164,angle:0}]
  const flag = { x: 136, y: 184, angle: 0 }
  const food = { greens: span(p,.16,.29), rice: span(p,.43,.58), soup: span(p,.76,.88), spoon: point(129,188), tip: point(104,195), soupSpoon: point(222,188), soupTip: point(248,193), leftHeld: 0, rightHeld: 0 }
  let stretch = 0
  let gaze = point(0,0)
  if (input.id === 'F4') {
    body.x = 90; body.y = 45
    left = translateArm(restLeft,48,7); right = translateArm(mirror(restLeft),48,7)
    const reach = span(p,.55,.62) * (1-span(p,.75,.8))
    const tilt = span(p,.64,.67) * (1-span(p,.72,.75))
    kettle.x += tilt*5; kettle.y -= tilt*10; kettle.angle = tilt*24
    kettle.grip = transformScenePoint(point(0,-44),kettle)
    kettle.spout = transformScenePoint(point(35,-26),kettle)
    kettle.pour = span(p,.67,.685) * (1-span(p,.705,.72))
    cup.liquid=span(p,.675,.71)
    // The hand takes the kettle's handle with the elbow hanging below the reach, as the same
    // plump arm as at rest; the shoulder sits with the shifted body.
    const seat = point(48,7), kettleShoulder = point(111+seat.x,143+seat.y)
    const kettleMid = pointMix(kettleShoulder,kettle.grip,.5)
    const kettleHand = bentReach('left',kettle.grip,point(kettleMid.x-4,kettleMid.y+12),seat)
    left = blendSceneArm(left,kettleHand,reach)
    if (reach>.999) contacts.push(contact('kettle-handle',left.palm,kettle.grip))
    const pickup = span(p,.8,.84), lift = span(p,.84,.98)
    cup.x=mix(169,204,lift);cup.y=mix(180,183,lift);cup.held=pickup
    const lp = cupAnchor(SCENE_CUP_BASE,cup), rp = cupAnchor(SCENE_CUP_HANDLE,cup)
    const join=span(lift,.25,.6), transfer=span(lift,.6,.82)
    const leftPalm=pointMix(rp,lp,transfer)
    const teaLeft = movePalm(translateArm(cupLeft,48,7),leftPalm.x-195,leftPalm.y-184)
    const teaRight = movePalm(translateArm(cupRight,48,7),rp.x-232,rp.y-178)
    left=blendSceneArm(left,teaLeft,pickup);right=blendSceneArm(right,teaRight,join)
    if(pickup>.999&&transfer<.001)contacts.push(contact('cup-handle-left',left.palm,rp))
    if(join>.999)contacts.push(contact('cup-handle',right.palm,rp))
    if(transfer>.999)contacts.push(contact('cup-base',left.palm,lp))
    gaze.x=-2*(1-lift)
  } else if(input.id==='F3') {
    left=pressLeft;right=mirror(pressLeft)
    const turn=span(p,.12,.34)
    book.turn=turn;book.close=span(p,.815,.957)
    const theta=turn*Math.PI
    book.corner=point(160+46*Math.cos(theta),161-8*Math.sin(theta))
    // Hold the page partway down its outer edge, below the mouth.
    const pageGrip=point(book.corner.x+8*.45,book.corner.y+14*.45)
    const pageHand=bentReach('right',pageGrip)
    const grasp=span(p,.08,.12)*(1-span(p,.21,.26))
    right=blendSceneArm(right,pageHand,grasp)
    if(grasp>.999)contacts.push(contact('page-corner',right.palm,pageGrip))
    const ribbon=span(p,.5,.56)*(1-span(p,.68,.74))
    const ribbonHand=movePalm(pageRight,-2,19)
    right=blendSceneArm(right,ribbonHand,ribbon)
    if(ribbon>.999)contacts.push(contact('bookmark',right.palm,point(183,165)))
    // The right hand lifts the edge. The left hand meets the other end of that
    // edge before lowering the cover onto the stationary page stack.
    const close = book.close
    book.coverEdge = point(160 + 46*Math.cos(Math.PI*close), 161 - 4*Math.sin(Math.PI*close))
    book.coverFront = point(book.coverEdge.x+8, book.coverEdge.y+14)
    // The right hand takes the near end and the left hand the middle, so at the handoff
    // the left hand is on the left and the arms meet without crossing.
    const rightGrip = pointMix(book.coverEdge,book.coverFront,.94)
    const leftGrip = pointMix(book.coverEdge,book.coverFront,.5)
    // Hand over at the spine: the left hand arrives just as the right one lets go.
    const rightHold = span(p,.75,.815) * (1-span(close,.5,.66))
    const leftHold = span(close,.36,.5) * (1-span(p,.957,1))
    left = blendSceneArm(blendSceneArm(left, restLeft, close), bentReach('left', leftGrip), leftHold)
    right = blendSceneArm(blendSceneArm(right, mirror(restLeft), close), bentReach('right', rightGrip), rightHold)
    if (rightHold === 1) contacts.push(contact('cover-right',right.palm,rightGrip))
    if (leftHold === 1) contacts.push(contact('cover-left',left.palm,leftGrip))
  } else if(input.id==='F6') {
    const fold1=span(p,.12,.39),fold2=span(p,.43,.73),t=boat.transfer
    const travel=span(t,.2,.85)
    boat.x=mix(162,242,travel);boat.y=-9*Math.sin(travel*Math.PI)
    const leftPaper=point(boat.x+(135+fold1*10-160)*.71,180+(173-fold1*8+fold2*8-180)*.71+boat.y)
    const rightPaper=point(boat.x+(189-fold1*4-fold2*8-160)*.71,180+(174-fold2*6-180)*.71+boat.y)
    // Before lifting, the right palm slides under the lightweight hull.
    boat.left=leftPaper;boat.right=pointMix(rightPaper,point(boat.x+10,185+boat.y),span(t,0,.2))
    const leftRelease=span(t,.2,.38),rightRelease=span(t,.87,1)
    left=blendSceneArm(bentReach('left',boat.left),restLeft,leftRelease)
    right=blendSceneArm(bentReach('right',boat.right),mirror(restLeft),rightRelease)
    contacts.push(contact('paper-left',left.palm,boat.left,leftRelease<.001),contact('paper-right',right.palm,boat.right,rightRelease<.001))
  } else if(input.id==='R3') {
    const ending=input.status==='ended'
    const put=ending?(input.actionKind==='ending'?a:1):0
    const travel=span(put,.2,.85)
    const from=clamp(input.endingFromActionProgress??0),fromPulse=simpleGesturePulse(from)
    const fromY=175-13*fromPulse,fromAngle=-2*fromPulse||0
    cup.x=mix(156,244,travel);cup.y=ending?mix(fromY,182,travel)-4*Math.sin(travel*Math.PI):175-13*pulse
    cup.angle=ending?mix(fromAngle,0,span(put,0,.2)):(-2*pulse||0);cup.held=1-span(put,.85,.95)
    const lp=cupAnchor(SCENE_CUP_BASE,cup),rp=cupAnchor(SCENE_CUP_HANDLE,cup)
    const leftRelease=span(put,0,.2),rightRelease=span(put,.85,1)
    left=blendSceneArm(movePalm(cupLeft,lp.x-147,lp.y-177),restLeft,leftRelease)
    right=blendSceneArm(movePalm(cupRight,rp.x-184,rp.y-171),mirror(restLeft),rightRelease)
    contacts.push(contact('cup-base',left.palm,lp,leftRelease<.001),contact('cup-handle',right.palm,rp,rightRelease<.001))
  } else if(input.id==='F1') {
    // Each spoon has a nearby rest. Hands join before pickup and release only
    // after set-down, avoiding unsupported jumps or cross-body reaches.
    const serving = foodUtensil(p,[
      [0,129,188,165],[.07,129,188,165],[.13,126,155,153],
      [.30,126,155,153],[.41,140,157,33],[.58,140,157,33],
      [.67,129,188,165],[1,129,188,165],
    ])
    const soupServing = foodUtensil(p,[
      [0,222,188,10],[.65,222,188,10],[.73,202,154,28],
      [.88,202,154,28],[.96,222,188,10],[1,222,188,10],
    ])
    food.spoon=serving.grip;food.tip=serving.tip
    food.soupSpoon=soupServing.grip;food.soupTip=soupServing.tip
    food.leftHeld=span(p,.02,.07)*(1-span(p,.67,.73))
    food.rightHeld=span(p,.60,.65)*(1-span(p,.96,1))
    const servingHand=movePalm(pressLeft,food.spoon.x-141,food.spoon.y-172)
    const soupHand=movePalm(mirror(pressLeft),food.soupSpoon.x-183,food.soupSpoon.y-172)
    left=blendSceneArm(left,servingHand,food.leftHeld)
    right=blendSceneArm(right,soupHand,food.rightHeld)
    contacts.push(contact('food-spoon-left',left.palm,food.spoon,food.leftHeld===1),contact('food-spoon-right',right.palm,food.soupSpoon,food.rightHeld===1))
    gaze.x=-2+2*span(p,.30,.41)+2*span(p,.65,.73)
  } else if(input.id==='F2') {
    // Resting, paused and ended scenes keep a real hold. The small gesture
    // slides along the supported front rim instead of retracting into a hover.
    const grip=plantRimPoint((35+12*pulse)*Math.PI/180)
    left=movePalm(plantLeft,grip.x-plantLeft.palm.x,grip.y-plantLeft.palm.y)
    right=plantRight
    contacts.push(contact('pot-rim',left.palm,grip))
  } else if(input.id==='F5') {
    const pose = bubblePose(p)
    right = pose.arm
    wand = pose.wand
    gaze = pose.gaze
    contacts.push(contact('wand-handle',right.palm,point(wand.x,wand.y),pose.held))
  } else if(input.id==='F7') {
    // Blocks on the low table, within the left hand's easy reach. The two to move start as a
    // small stack beside the hand; the base stands to the left, a spare one on the right.
    const first=span(p,.14,.34), second=span(p,.45,.7)
    const base=blocks[0]!, tableY=base.y, onBaseY=tableY-BLOCK_HEIGHT
    // The top of the starting stack goes onto the base: lifted to chest height, across above
    // the shoulder rather than through it, then set down. The hand takes the block's near face
    // and slides up to its top corner as it lifts.
    blocks[3] = carry(first,[[0,100,onBaseY],[.22,100,onBaseY-24],[.72,58,onBaseY-24],[1,56,onBaseY]])
    // The lower one slides along the table to stand beside the base, so the pair cannot topple.
    blocks[2] = {x:mix(100,88,second),y:tableY,angle:0}
    const hold1=span(p,.08,.14)*(1-span(p,.34,.4))
    const hold2=span(second,.1,.3)*(1-span(p,.7,.75))
    const grip1=point(blocks[3]!.x+28,blocks[3]!.y-11-11*span(first,0,.22)), grip2=point(blocks[2]!.x+28,blocks[2]!.y-8)
    const raise=span(p,.8,.94)
    const flagSeat = onBaseY-BLOCK_HEIGHT-3
    flag.x = mix(136,68,span(raise,0,.6))
    flag.y = mix(tableY-2,flagSeat,span(raise,.1,.85)) - 8*Math.sin(Math.PI*raise)
    const fg=transformScenePoint(point(0,-8),flag), flagHold=span(p,.76,.8)*(1-span(p,.94,1))
    // The three holds never overlap. The palm travels from its resting place to the grip
    // through a low point, so each reach swings below the shoulder rather than across it.
    const [grip,hold] = flagHold>0 ? [fg,flagHold] as const : hold2>0 ? [grip2,hold2] as const : [grip1,hold1] as const
    if(hold>0){
      const rest=restLeft.palm, via=point(mix(rest.x,grip.x,.5),Math.max(mix(rest.y,grip.y,.5)+6,165))
      const palm=pointMix(pointMix(rest,via,hold),pointMix(via,grip,hold),hold)
      left=blendSceneArm(restLeft,towerReach(palm),span(hold,0,.3))
    }
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
  return {id:input.id,progress,action:pulse,body,left,right,cup,kettle,book,boat,wand,blocks,flag,food,stretch,gaze,touched:!!input.touchKind,contacts}
}
