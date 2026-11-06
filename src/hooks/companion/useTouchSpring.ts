import { useEffect, useRef, type RefObject } from 'react'
import { advanceBlueTouchMotion, blueTouchMotionNeedsFrame, blueTouchMotionTransform, emptyBlueTouchMotion, type BlueTouchInput } from '../../logic/blue-touch'

/**
 * Drives one stable touch group with pose springs retargeted on press,
 * release and cancel, keeping position and velocity, so a new tap continues from
 * wherever the body is. Presentation only: it never ends a touch or calls the host.
 */
export function useTouchSpring(group: RefObject<SVGGElement>, touch: BlueTouchInput | null, staticOnly: boolean): void {
  const state = useRef(emptyBlueTouchMotion())
  useEffect(() => {
    const element = group.current
    if (!element) return
    if (staticOnly) {
      state.current = emptyBlueTouchMotion()
      element.style.transform = ''
      return
    }
    state.current = advanceBlueTouchMotion(state.current, touch, 0)
    let frame = 0
    let last: number | null = null
    const step = (now: number) => {
      state.current = advanceBlueTouchMotion(state.current, touch, last === null ? 0 : now - last)
      last = now
      const moving = blueTouchMotionNeedsFrame(state.current)
      element.style.transform = !moving && state.current.phase === 'release' ? '' : blueTouchMotionTransform(state.current)
      if (moving) frame = requestAnimationFrame(step)
    }
    if (blueTouchMotionNeedsFrame(state.current)) frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [group, touch?.id, touch?.phase, touch?.kind, touch?.side, staticOnly])
}
