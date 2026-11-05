import type { SceneArm, ScenePoint } from './scene-pose'

/** Move around the shoulder when a hand approaches or leaves a grip.
 * A straight interpolation can cut back through the shoulder itself. */
export function palmArc(shoulder: ScenePoint, from: ScenePoint, to: ScenePoint, amount: number): ScenePoint {
  if (amount <= 0) return from
  if (amount >= 1) return to
  const ax = from.x - shoulder.x, ay = from.y - shoulder.y
  const bx = to.x - shoulder.x, by = to.y - shoulder.y
  const angle = Math.atan2(ay, ax)
  const turn = Math.atan2(ax * by - ay * bx, ax * bx + ay * by)
  const radius = Math.hypot(ax, ay) * (1 - amount) + Math.hypot(bx, by) * amount
  return {
    x: shoulder.x + radius * Math.cos(angle + turn * amount),
    y: shoulder.y + radius * Math.sin(angle + turn * amount),
  }
}

/** A soft forearm with a rounded pad. Short grips show a fuller, bowed arm
 * turned toward the viewer. Longer grips straighten that same contour. */
export function roundedReach(side: 'left' | 'right', shoulder: ScenePoint, palm: ScenePoint, bowDirection = 1): SceneArm {
  const dx = palm.x - shoulder.x, dy = palm.y - shoulder.y
  const chord = Math.max(.01, Math.hypot(dx, dy))
  const ux = dx / chord, uy = dy / chord, handed = side === 'left' ? 1 : -1
  const fold = Math.max(0, Math.min(1, (49 - chord) / 24))
  const bow = Math.min(.25 * chord, 4.3 + 4.2 * fold * fold * (3 - 2 * fold)) * bowDirection
  const radius = Math.max(6.6, Math.min(9.1, 330 / (chord + 12)))
  const tipSlope = -3 * bow / chord, normalizer = Math.hypot(1, tipSlope)
  const tx = 1 / normalizer, ty = tipSlope / normalizer
  const nx = -ty * radius, ny = tx * radius
  const reach = chord * .18, cap = 4 * radius / 3
  // Two cubics per flank meet with a common tangent. The single cap rounds
  // the hand across its full width without pinching at an imagined wrist.
  const local = [
    [0, 0],
    [1, .84 * radius], [.23 * chord, bow + radius], [.48 * chord, bow + radius],
    [.72 * chord, bow + radius], [chord + nx - reach * tx, ny - reach * ty], [chord + nx, ny],
    [chord + nx + cap * tx, ny + cap * ty], [chord - nx + cap * tx, -ny + cap * ty], [chord - nx, -ny],
    [chord - nx - reach * tx, -ny - reach * ty], [.72 * chord, bow - radius], [.48 * chord, bow - radius],
    [.23 * chord, bow - radius], [1, -.84 * radius], [0, 0],
  ]
  const points = local.flatMap(([along = 0, across = 0]) => [
    shoulder.x + ux * along - uy * across * handed,
    shoulder.y + uy * along + ux * across * handed,
  ])
  return {points, palm}
}
