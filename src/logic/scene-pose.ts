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
  book: { turn: number; close: number; ribbon: number; corner: ScenePoint }
  boat: { fold: number; transfer: number; x: number; y: number; scale: number; left: ScenePoint; right: ScenePoint }
  wand: SceneObject & { ring: ScenePoint }
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
export const SCENE_CUP_SCALE = .72
export const SCENE_CUP_BASE = {x:-8,y:2}
export const SCENE_CUP_HANDLE = {x:29,y:-9}
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
  const book = { turn: 0, close: 0, ribbon: span(p,.66,.76), corner: point(204,157) }
  const boat = { fold: p, transfer: span(p,.78,1), x:150, y:0, scale:.71, left: point(135,173), right: point(189,174) }
  const wand = { x: 240, y: 165, angle: 0, ring: point(240,193) }
  const blocks: SceneObject[] = [{x:68,y:211,angle:0},{x:97,y:211,angle:0},{x:144,y:211,angle:0},{x:176,y:211,angle:0}]
  const flag = { x: 161, y: 206, angle: -90 }
  const food = { greens: span(p,.16,.29), rice: span(p,.43,.58), soup: span(p,.76,.88), spoon: point(129,188), tip: point(104,195), soupSpoon: point(222,188), soupTip: point(248,193), leftHeld: 0, rightHeld: 0 }
  let stretch = 0
  const gaze = point(0,0)
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
    const kettleGrip = arm([159,150, 151,146,144,145,139,139, 134,132,126,130,125,136, 123,143,128,149,136,150, 145,157,153,161,160,157, 166,154,165,151,159,150],131,135)
    const kettleHand = movePalm(kettleGrip,kettle.grip.x-131,kettle.grip.y-135)
    left = blendSceneArm(left,kettleHand,reach)
    if (reach>.999) contacts.push(contact('kettle-handle',left.palm,kettle.grip))
    const pickup = span(p,.8,.84), lift = span(p,.84,.98)
    cup.x=mix(169,204,lift);cup.y=mix(180,174,lift);cup.held=pickup
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
    book.turn=turn;book.close=span(p,.88,.99)
    const theta=turn*Math.PI
    book.corner=point(160+44*Math.cos(theta),157-27*Math.sin(theta))
    const pageHand=movePalm(pageRight,book.corner.x-185,book.corner.y-146)
    const grasp=span(p,.08,.12)*(1-span(p,.21,.26))
    right=blendSceneArm(right,pageHand,grasp)
    if(grasp>.999)contacts.push(contact('page-corner',right.palm,book.corner))
    const ribbon=span(p,.5,.56)*(1-span(p,.68,.74))
    const ribbonHand=movePalm(pageRight,0,8)
    right=blendSceneArm(right,ribbonHand,ribbon)
    if(ribbon>.999)contacts.push(contact('bookmark',right.palm,point(185,154)))
    left=blendSceneArm(left,restLeft,book.close);right=blendSceneArm(right,mirror(restLeft),book.close)
  } else if(input.id==='F6') {
    const fold1=span(p,.12,.39),fold2=span(p,.43,.73),t=boat.transfer
    const travel=span(t,.2,.85)
    boat.x=mix(150,242,travel);boat.y=-22*Math.sin(travel*Math.PI)
    const leftPaper=point(boat.x+(135+fold1*10-160)*.71,180+(173-fold1*8+fold2*8-180)*.71+boat.y)
    const rightPaper=point(boat.x+(189-fold1*4-fold2*8-160)*.71,180+(174-fold2*6-180)*.71+boat.y)
    // Before lifting, the right palm slides under the lightweight hull.
    boat.left=leftPaper;boat.right=pointMix(rightPaper,point(boat.x+5,186+boat.y),span(t,0,.2))
    const leftRelease=span(t,.2,.38),rightRelease=span(t,.87,1)
    left=blendSceneArm(movePalm(pressLeft,boat.left.x-141,boat.left.y-172),restLeft,leftRelease)
    right=blendSceneArm(movePalm(mirror(pressLeft),boat.right.x-183,boat.right.y-172),mirror(restLeft),rightRelease)
    contacts.push(contact('paper-left',left.palm,boat.left,leftRelease<.001),contact('paper-right',right.palm,boat.right,rightRelease<.001))
  } else if(input.id==='R3') {
    const ending=input.status==='ended'
    const put=ending?(input.actionKind==='ending'?a:1):0
    const travel=span(put,.2,.85)
    const from=clamp(input.endingFromActionProgress??0),fromPulse=simpleGesturePulse(from)
    const fromY=175-13*fromPulse,fromAngle=-2*fromPulse||0
    cup.x=mix(156,244,travel);cup.y=ending?mix(fromY,182,travel)-12*Math.sin(travel*Math.PI):175-13*pulse
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
    const pat=.25+.75*pulse
    const potHand=movePalm(pressLeft,-27,-17)
    left=blendSceneArm(left,potHand,pat)
    if(pat>.999)contacts.push(contact('pot-rim',left.palm,point(114,155)))
  } else if(input.id==='F5') {
    const lift=span(p,.05,.18)
    wand.x=mix(240,218,lift);wand.y=mix(165,169,lift)-pulse*2;wand.angle=mix(0,160,lift)+pulse*3
    wand.ring=transformScenePoint(point(0,28),wand)
    right=movePalm(mirror(pressLeft),wand.x-183,wand.y-172)
    contacts.push(contact('wand-handle',right.palm,point(wand.x,wand.y)));gaze.x=3
  } else if(input.id==='F7') {
    const first=span(p,.14,.34), second=span(p,.45,.7)
    blocks[2]={x:mix(144,80,first),y:mix(211,183,first)-Math.sin(first*Math.PI)*8,angle:0}
    // The second block slides along the mat into a two-hand handoff before lift.
    const slide=span(second,0,.28),lift=span(second,.28,1)
    blocks[3]={x:mix(mix(176,144,slide),80,lift),y:mix(211,155,lift)-Math.sin(lift*Math.PI)*45,angle:0}
    const grip1=point(blocks[2]!.x+16,blocks[2]!.y-24)
    const hold1=span(p,.08,.14)*(1-span(p,.34,.4))
    left=blendSceneArm(left,movePalm(pressLeft,grip1.x-141,grip1.y-172),hold1)
    if(hold1>.999)contacts.push(contact('block-first',left.palm,grip1))
    const b=blocks[3]!, lp=point(b.x+8,b.y-24),rp=point(b.x+26,b.y-18)
    const rightHold=span(p,.4,.45)*(1-span(second,.26,.4))
    const leftHold=span(second,.15,.27)*(1-span(p,.7,.75))
    right=blendSceneArm(right,movePalm(mirror(pressLeft),rp.x-183,rp.y-172),rightHold)
    left=blendSceneArm(left,movePalm(pressLeft,lp.x-141,lp.y-172),leftHold)
    if(rightHold>.999)contacts.push(contact('block-slide',right.palm,rp))
    if(leftHold>.999)contacts.push(contact('block-second',left.palm,lp))
    const raise=span(p,.8,.94)
    flag.x=mix(161,90,raise);flag.y=mix(206,127,raise)-Math.sin(raise*Math.PI)*32;flag.angle=mix(-90,0,raise)
    const fg=transformScenePoint(point(0,-5),flag), flagHold=span(p,.76,.8)*(1-span(p,.94,1))
    left=blendSceneArm(left,movePalm(pressLeft,fg.x-141,fg.y-172),flagHold)
    if(flagHold>.999)contacts.push(contact('flag-stem',left.palm,fg))
  } else if(input.id==='F8'||input.id==='R2') {
    body.lean=-5;gaze.x=-2;gaze.y=-4
  } else if(input.id==='R1') {
    stretch=pulse
    left=rotateArm(restLeft,220*stretch);right=mirror(left)
    body.lean=(input.actionKind==='ending'?Math.sin(previousAction*Math.PI*2)*previousPulse*2*(1-sceneSmooth(a)):Math.sin(a*Math.PI*2)*stretch*2)||0
  }
  return {id:input.id,progress,action:pulse,body,left,right,cup,kettle,book,boat,wand,blocks,flag,food,stretch,gaze,touched:!!input.touchKind,contacts}
}
