import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import { blueTouchKind, blueTouchOffset, blueTouchPoint, type BlueTouchKind, type BlueTouchPoint } from '../../logic/blue-touch'
import type { BlueCompanionSpec } from '../../logic/blue-companion'
import type { CompanionPresentation } from '../../logic/companion'

interface Touch {
  id: number
  pointerId: number
  kind: BlueTouchKind
  point: BlueTouchPoint
  phase: 'press' | 'release'
}

/** Local play only. Never captures a pointer, suppresses a click or calls the host. */
export function useBlueCompanionTouch(presentation: CompanionPresentation, spec: BlueCompanionSpec, hostMotionId?: string, finishHost?: (id: string) => void) {
  const ref = useRef<SVGSVGElement>(null)
  const sequence = useRef(0)
  const [touch, setTouch] = useState<Touch | null>(null)
  const [gaze, setGaze] = useState({ x: 0, y: 0 })
  const { stance, staticOnly, cue } = presentation
  const cancel = useCallback(() => { setTouch(null); setGaze({ x: 0, y: 0 }) }, [])
  const finish = useCallback((id: number) => setTouch(previous => previous?.id === id ? null : previous), [])

  useEffect(() => {
    // Consume the permitted host gesture during direct play, so it cannot start
    // halfway through when the shorter touch response finishes.
    if (touch && hostMotionId) finishHost?.(hostMotionId)
  }, [touch?.id, hostMotionId, finishHost])

  useEffect(() => {
    // The native encouragement button may supply support on release. That
    // gesture can coexist with local play; any other host state wins immediately.
    if (stance !== 'support' || (cue && cue !== 'support')) cancel()
  }, [stance, cue, cancel])
  useEffect(() => { cancel() }, [staticOnly, cancel])
  useEffect(() => {
    const hidden = () => { if (document.hidden) cancel() }
    document.addEventListener('visibilitychange', hidden)
    window.addEventListener('pagehide', cancel)
    window.addEventListener('blur', cancel)
    window.addEventListener('resize', cancel)
    window.addEventListener('scroll', cancel, true)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(cancel)
    if (ref.current) observer?.observe(ref.current)
    return () => {
      document.removeEventListener('visibilitychange', hidden)
      window.removeEventListener('pagehide', cancel)
      window.removeEventListener('blur', cancel)
      window.removeEventListener('resize', cancel)
      window.removeEventListener('scroll', cancel, true)
      observer?.disconnect()
    }
  }, [cancel])
  const duration = touch?.kind === 'pat' ? spec.touch.patMs : touch?.kind === 'high-five' ? spec.touch.highFiveMs : spec.touch.squishMs
  useEffect(() => {
    if (!touch) return
    const timeout = window.setTimeout(() => finish(touch.id), touch.phase === 'press' ? spec.touch.holdMaxMs : duration)
    return () => window.clearTimeout(timeout)
  }, [touch?.id, touch?.phase, duration, spec.touch.holdMaxMs, finish])

  const pointFrom = (event: PointerEvent<SVGSVGElement>) => {
    const bounds = ref.current?.getBoundingClientRect()
    return bounds ? blueTouchPoint({ x: event.clientX, y: event.clientY }, bounds, spec) : null
  }
  const handlers = {
    onPointerDown(event: PointerEvent<SVGSVGElement>) {
      if (!event.isPrimary || event.button !== 0 || stance === 'neutral') return
      const point = pointFrom(event)
      if (point) setTouch({ id: ++sequence.current, pointerId: event.pointerId, kind: blueTouchKind(point, spec), point, phase: 'press' })
    },
    onPointerMove(event: PointerEvent<SVGSVGElement>) {
      if (!event.isPrimary) return
      const point = pointFrom(event)
      if (!point) { cancel(); return }
      if (!staticOnly && stance !== 'neutral') setGaze(blueTouchOffset(point, spec))
      // Keep the original contact anchored, even if a finger moves. Native pan
      // and zoom remain available; pointercancel/scroll end the local press.
    },
    onPointerUp(event: PointerEvent<SVGSVGElement>) {
      setTouch(previous => previous?.pointerId === event.pointerId && previous.phase === 'press'
        ? { ...previous, phase: 'release' } : previous)
      setGaze({ x: 0, y: 0 })
    },
    onPointerLeave(event: PointerEvent<SVGSVGElement>) {
      if (!event.isPrimary) return
      setGaze({ x: 0, y: 0 })
      // Touch has no hover: its normal pointerleave follows pointerup. Keep the
      // finite release response, but never keep an abandoned pressed pose.
      setTouch(previous => event.pointerType !== 'mouse' && previous?.phase === 'release' ? previous : null)
    },
    onPointerCancel(event: PointerEvent<SVGSVGElement>) { if (event.isPrimary) cancel() },
  }
  return { ref, touch: stance === 'neutral' ? null : touch, gaze: staticOnly ? { x: 0, y: 0 } : gaze, handlers, duration, finish }
}
