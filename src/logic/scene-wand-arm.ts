import type { SceneArm, ScenePoint } from './scene-pose'

const point = (x: number, y: number): ScenePoint => ({ x, y })
function unit(x: number, y: number) {
  const length = Math.hypot(x, y)
  return point(x / length, y / length)
}
const offset = (p: ScenePoint, axis: ScenePoint, n: number) => point(p.x + axis.x * n, p.y + axis.y * n)

/** The two joints guide the outside of the sleeve. Its inside bridges the
 * bent elbow instead of drawing two overlapping tubes with a notch between them. */
export function drawWandArm(elbow: ScenePoint, palm: ScenePoint): SceneArm {
  const shoulder = point(213,143)
  const upper = unit(elbow.x-shoulder.x, elbow.y-shoulder.y)
  const fore = unit(palm.x-elbow.x, palm.y-elbow.y)
  const bend = unit(upper.x+fore.x, upper.y+fore.y)
  const outside = (axis: ScenePoint) => point(axis.y,-axis.x)
  const middle = point((shoulder.x+palm.x)/2, (shoulder.y+palm.y)/2)
  const elbowOut = offset(elbow,outside(bend),4.2)
  const elbowIn = point(middle.x+(elbow.x-middle.x)*.14,middle.y+(elbow.y-middle.y)*.14)
  const radius = 7.2, palmOut = offset(palm,outside(fore),radius), palmIn = offset(palm,outside(fore),-radius)
  const cap = 4*radius/3
  const controls = [
    shoulder,
    offset(shoulder,outside(upper),8), offset(elbowOut,bend,-10), elbowOut,
    offset(elbowOut,bend,10), offset(palmOut,fore,-6), palmOut,
    offset(palmOut,fore,cap), offset(palmIn,fore,cap), palmIn,
    offset(palmIn,fore,-3), offset(elbowIn,bend,4), elbowIn,
    offset(elbowIn,bend,-4), offset(shoulder,outside(upper),-5), shoulder,
  ]
  return {points:controls.flatMap(({x,y})=>[x,y]), palm}
}
