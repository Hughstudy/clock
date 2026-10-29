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
