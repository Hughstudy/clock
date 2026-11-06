export type BlueTouchKind = 'pat' | 'squish' | 'high-five'

/** Coordinates in the character SVG's viewBox, independent of its display size. */
export interface BlueTouchPoint { x: number; y: number }

interface Canvas { width: number; height: number }
interface Bounds extends Canvas { left: number; top: number }

function validCanvas(canvas: Canvas): boolean {
  return Number.isFinite(canvas.width) && canvas.width > 0
    && Number.isFinite(canvas.height) && canvas.height > 0
}

function validPoint(point: BlueTouchPoint): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y)
}

/** Map a pointer through SVG's default xMidYMid meet fit; letterboxing is not contact. */
export function blueTouchPoint(client: BlueTouchPoint, bounds: Bounds, canvas: Canvas): BlueTouchPoint | null {
  if (!validPoint(client) || !validCanvas(bounds) || !validCanvas(canvas)
    || !Number.isFinite(bounds.left) || !Number.isFinite(bounds.top)) return null

  const scale = Math.min(bounds.width / canvas.width, bounds.height / canvas.height)
  if (!Number.isFinite(scale) || scale <= 0) return null
  const left = bounds.left + (bounds.width - canvas.width * scale) / 2
  const top = bounds.top + (bounds.height - canvas.height * scale) / 2
  const point = { x: (client.x - left) / scale, y: (client.y - top) / scale }
  return validPoint(point) && point.x >= 0 && point.x <= canvas.width
    && point.y >= 0 && point.y <= canvas.height ? point : null
}

/** Deliberate touch changes only the character's expression, never application state. */
export function blueTouchKind(point: BlueTouchPoint, canvas: Canvas): BlueTouchKind {
  if (!validPoint(point) || !validCanvas(canvas)) return 'squish'
  if (point.x / canvas.width < 0.32 || point.x / canvas.width > 0.68) return 'high-five'
  return point.y / canvas.height < 0.43 ? 'pat' : 'squish'
}

/** Small bounded gaze displacement, expressed in SVG units rather than screen pixels. */
export function blueTouchOffset(point: BlueTouchPoint, canvas: Canvas): BlueTouchPoint {
  if (!validPoint(point) || !validCanvas(canvas)) return { x: 0, y: 0 }
  return {
    x: Math.max(-3, Math.min(3, (point.x / canvas.width - 0.5) * 6)),
    y: Math.max(-2, Math.min(2, (point.y / canvas.height - 0.5) * 4)),
  }
}

/** A body pose for direct touch: translation in SVG units, scale, and rotation in degrees. */
export interface BlueTouchPose { y: number; sx: number; sy: number; r: number }

/** The squashed pose a press reaches. The release spring overshoots through rest into its
 * opposite (a stretch, a counter-tilt), which gives the bounce without keyframes. */
export function blueTouchPressPose(kind: BlueTouchKind, side: 1 | -1): BlueTouchPose {
  if (kind === 'pat') return { y: 2, sx: 1.025, sy: 0.965, r: -2 }
  if (kind === 'high-five') return { y: 0, sx: 1.015, sy: 0.99, r: 3 * side }
  return { y: 2, sx: 1.055, sy: 0.94, r: 0 }
}

/** Blend from rest (0) to the press pose (1). Past rest the body lifts more than it sinks. */
export function blueTouchTransform(press: BlueTouchPose, amount: number): string {
  const y = amount >= 0 ? press.y * amount : 3 * Math.abs(press.y || 1) * amount
  const f = (n: number) => Number(n.toFixed(4))
  return `translateY(${f(y)}px) rotate(${f(press.r * amount)}deg) scale(${f(1 + (press.sx - 1) * amount)}, ${f(1 + (press.sy - 1) * amount)})`
}

/** Apple's perceptual spring: duration (pace) and bounce (character), unit mass. */
export interface Spring { stiffness: number; damping: number }
export function springOf(durationS: number, bounce: number): Spring {
  const d = Math.max(0.05, durationS), b = Math.min(0.95, Math.max(0, bounce))
  return { stiffness: (2 * Math.PI / d) ** 2, damping: (1 - b) * 4 * Math.PI / d }
}

export interface SpringState { value: number; velocity: number }

/** Advance toward `target`, keeping position and velocity, so a new target mid-flight
 * redirects without a jump. Frame gaps are clamped so a stalled tab cannot fling it. */
export function stepSpring(state: SpringState, target: number, spring: Spring, deltaMs: number): SpringState {
  const dt = Math.min(64, Math.max(0, deltaMs)) / 1000
  const steps = Math.max(1, Math.ceil(dt / 0.004))
  const h = dt / steps
  let { value, velocity } = state
  for (let i = 0; i < steps; i++) {
    velocity += (-spring.stiffness * (value - target) - spring.damping * velocity) * h
    value += velocity * h
  }
  return { value, velocity }
}

export function springSettled(state: SpringState, target: number): boolean {
  return Math.abs(state.value - target) < 0.001 && Math.abs(state.velocity) < 0.01
}
