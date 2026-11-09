import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { approachFocusWeight, FOCUS_RIG_NAMES, focusBeatSchedule, focusFlipperTransform, focusPresenceNeedsFrame, focusRigTransforms, sampleFocusPresence, type FocusPresencePose } from '../../logic/focus-presence'
import type { FocusAttention, ScenePoint } from '../../logic/scene-pose'

/** Main's own session clock, read only. Nothing here counts or changes time. */
export interface FocusTime { elapsedMs: number; totalMs: number }
interface Options {
  time: FocusTime | undefined
  enabled: boolean
  /** Reduced motion: clear the gesture at once rather than fading it. */
  immediate: boolean
  attention: FocusAttention
  gaze: ScenePoint
  sceneKey: string | null
}

function write(svg: SVGSVGElement, pose: FocusPresencePose | null, weight: number) {
  const transforms = pose ? focusRigTransforms(pose, weight) : null
  for (const name of FOCUS_RIG_NAMES) {
    const element = svg.querySelector(`[data-focus-rig="${name}"]`)
    if (!element) continue
    if (transforms) element.setAttribute('transform', transforms[name])
    else element.removeAttribute('transform')
  }
  svg.querySelectorAll('[data-scene-hand]:not([data-focus-arm])').forEach(hand => hand.removeAttribute('transform'))
  const arm = svg.querySelector('[data-focus-arm]')
  if (!arm) return
  const [x = 0, y = 0, direction = 1] = (arm.getAttribute('data-focus-arm') ?? '').split(' ').map(Number)
  if (pose) arm.setAttribute('transform', focusFlipperTransform(pose.flipperDeg, weight, x, y, direction))
  else arm.removeAttribute('transform')
}

/**
 * Plays the session's gestures from the timer. Countdown refreshes re-anchor the time and
 * frames fill the 250 ms between them, only while a gesture is near. Between gestures this
 * requests nothing. Presentation only: it reads time and writes SVG transforms.
 */
export function useFocusPresence(svg: RefObject<SVGSVGElement>, options: Options): void {
  const totalMs = options.time?.totalMs ?? 0
  const elapsedMs = options.time?.elapsedMs ?? 0
  const { enabled, immediate, sceneKey } = options
  const schedule = useMemo(() => focusBeatSchedule(totalMs), [totalMs])
  const latest = useRef({ ...options, schedule })
  latest.current = { ...options, schedule }
  const loop = useRef({ frame: 0, last: null as number | null, weight: 0, anchor: 0, anchorAt: 0, shown: 0 })
  const kick = useRef<() => void>(() => undefined)

  useEffect(() => {
    const element = svg.current
    if (!element) return
    const state = loop.current
    const step = (now: number) => {
      state.frame = 0
      const current = latest.current
      const deltaMs = state.last === null ? 0 : Math.min(64, now - state.last)
      state.last = now
      const projected = state.anchor + (current.enabled ? Math.max(0, Math.min(1000, now - state.anchorAt)) : 0)
      const limited = Math.min(current.time?.totalMs ?? 0, projected)
      // A refresh can land a few milliseconds behind the projection; only a real jump goes back.
      state.shown = limited < state.shown - 1000 ? limited : Math.max(state.shown, limited)
      const pose = sampleFocusPresence(state.shown, current.schedule, current.attention, current.gaze)
      const target = current.enabled ? 1 : 0
      // Outside a gesture nothing is displaced, so the weight can change without a visible step.
      state.weight = pose.active ? approachFocusWeight(state.weight, target, deltaMs) : target
      write(element, pose.active && state.weight > 0 ? pose : null, state.weight)
      const easing = pose.active && state.weight !== target
      if (easing || (current.enabled && focusPresenceNeedsFrame(state.shown, current.schedule))) state.frame = requestAnimationFrame(step)
      else state.last = null
    }
    kick.current = () => { if (!state.frame) state.frame = requestAnimationFrame(step) }
    return () => {
      cancelAnimationFrame(state.frame)
      state.frame = 0
      state.last = null
      kick.current = () => undefined
    }
  }, [svg])

  // A new session starts from its own time, never from the last one's projection.
  useEffect(() => { loop.current.shown = 0 }, [sceneKey, totalMs])

  useEffect(() => {
    const state = loop.current
    state.anchor = elapsedMs
    state.anchorAt = performance.now()
    if (immediate) {
      cancelAnimationFrame(state.frame)
      state.frame = 0
      state.last = null
      state.weight = 0
      if (svg.current) write(svg.current, null, 0)
      return
    }
    if (state.weight !== (enabled ? 1 : 0) || (enabled && focusPresenceNeedsFrame(elapsedMs, schedule))) kick.current()
  }, [svg, elapsedMs, enabled, immediate, schedule, sceneKey])
}
