import { useRef, type PointerEvent } from 'react'
import { boundDialTravel, minuteAtDialAngle } from '../logic/prepare'

interface Options {
  minutes: number
  min: number
  max: number
  onPreview: (value: number) => void
}

function angleOf(event: PointerEvent<HTMLElement>): number | null {
  const box = event.currentTarget.getBoundingClientRect()
  const dx = event.clientX - box.left - box.width / 2, dy = event.clientY - box.top - box.height / 2
  // Near the hub the direction means nothing.
  return Math.hypot(dx, dy) < 12 ? null : Math.atan2(dx, -dy)
}

/** Touching the face moves the hand there; dragging then keeps it with the finger, across twelve. */
export function useDialGesture({ minutes, min, max, onPreview }: Options) {
  const press = useRef<{ id: number; angle: number | null; value: number } | null>(null)
  const jump = (to: number) => {
    const p = press.current!
    p.value = minuteAtDialAngle(to, p.value, min, max)
    onPreview(p.value)
  }
  const release = (event: PointerEvent<HTMLElement>) => {
    if (press.current?.id === event.pointerId) press.current = null
  }
  return {
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      if (!event.isPrimary || event.button !== 0) return
      event.currentTarget.setPointerCapture(event.pointerId)
      const angle = angleOf(event)
      press.current = { id: event.pointerId, angle, value: minutes }
      if (angle !== null) jump(angle)
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      const p = press.current
      if (p?.id !== event.pointerId) return
      const next = angleOf(event)
      if (next !== null && p.angle === null) jump(next)
      else if (next !== null && p.angle !== null) {
        let delta = next - p.angle
        if (delta > Math.PI) delta -= Math.PI * 2
        if (delta < -Math.PI) delta += Math.PI * 2
        p.value = boundDialTravel(p.value + delta * 30 / Math.PI, min, max)
        onPreview(Math.max(min, Math.min(max, Math.round(p.value))))
      }
      p.angle = next
    },
    onPointerUp: release,
    onPointerCancel: release,
  }
}
