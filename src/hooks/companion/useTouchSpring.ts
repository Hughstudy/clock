import { useEffect, useRef, type RefObject } from 'react'
import { blueTouchPressPose, blueTouchTransform, springOf, springSettled, stepSpring, type BlueTouchKind, type BlueTouchPose, type SpringState } from '../../logic/blue-touch'

/** Press follows the finger quickly without bounce; release bounces like the creature it is. */
const PRESS = springOf(0.12, 0)
const RELEASE = springOf(0.5, 0.65)

interface TouchInput { id: number; kind: BlueTouchKind; phase: 'press' | 'release'; side: 1 | -1 }

/**
 * Drives one stable touch group with a single spring that is retargeted on press,
 * release and cancel, keeping position and velocity, so a new tap continues from
 * wherever the body is. Presentation only: it never ends a touch or calls the host.
 */
export function useTouchSpring(group: RefObject<SVGGElement>, touch: TouchInput | null, staticOnly: boolean): void {
  const state = useRef<SpringState>({ value: 0, velocity: 0 })
  const pose = useRef<BlueTouchPose>(blueTouchPressPose('squish', 1))
  const target = touch?.phase === 'press' ? 1 : 0
  useEffect(() => {
    const element = group.current
    if (!element) return
    if (staticOnly) {
      state.current = { value: 0, velocity: 0 }
      element.style.transform = ''
      return
    }
    if (touch) pose.current = blueTouchPressPose(touch.kind, touch.side)
    const spring = target === 1 ? PRESS : RELEASE
    let frame = 0
    let last: number | null = null
    const step = (now: number) => {
      state.current = stepSpring(state.current, target, spring, last === null ? 0 : now - last)
      last = now
      if (springSettled(state.current, target)) {
        state.current = { value: target, velocity: 0 }
        element.style.transform = target === 0 ? '' : blueTouchTransform(pose.current, 1)
        return
      }
      element.style.transform = blueTouchTransform(pose.current, state.current.value)
      frame = requestAnimationFrame(step)
    }
    if (!springSettled(state.current, target)) frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [group, touch?.id, touch?.phase, touch?.kind, touch?.side, target, staticOnly])
}
