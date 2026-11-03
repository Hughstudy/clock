import { useLayoutEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'

interface Options {
  enabled: boolean
  identity: string
  task: string | null
  open: boolean
  minutes: number
  min: number
  max: number
  onOpen: (target: HTMLButtonElement) => void
  onPreview: (value: number) => void
  onCancel: () => void
}

interface Press {
  id: number
  target: HTMLElement
  identity: string
  task: string | null
  x: number
  y: number
  timer?: number
  dragging: boolean
  angle: number | null
  value: number
}

const holdMs = 450
const panTolerance = 9

/** Selecting a length is local to preparation. A hold consumes its release
 * even if a dialog, browser cancellation or peer-tab start changes the target. */
export function useDialGesture(options: Options) {
  const latest = useRef(options)
  const face = useRef<HTMLDivElement>(null)
  const press = useRef<Press | null>(null)
  const blockClick = useRef(false)
  useLayoutEffect(() => { latest.current = options })

  function stop(cancel: boolean) {
    const p = press.current
    if (!p) return
    press.current = null
    window.clearTimeout(p.timer)
    if (p.target.hasPointerCapture(p.id)) p.target.releasePointerCapture(p.id)
    if (cancel || p.dragging) blockClick.current = true
    if (cancel && p.dragging && latest.current.open) latest.current.onCancel()
  }
  function angle(x: number, y: number) {
    const box = face.current?.getBoundingClientRect()
    if (!box) return null
    const dx = x - box.left - box.width / 2, dy = y - box.top - box.height / 2
    return Math.hypot(dx, dy) < 12 ? null : Math.atan2(dx, -dy)
  }
  function begin(event: ReactPointerEvent<HTMLElement>, fromDial: boolean) {
    if (!event.isPrimary || event.button !== 0 || press.current || !latest.current.enabled) return
    const target = event.currentTarget
    const p: Press = { id: event.pointerId, identity: latest.current.identity, task: latest.current.task, target, x: event.clientX, y: event.clientY,
      dragging: fromDial, angle: null, value: latest.current.minutes }
    press.current = p
    target.setPointerCapture(p.id)
    if (fromDial) {
      p.angle = angle(p.x, p.y)
      return
    }
    p.timer = window.setTimeout(() => {
      if (press.current !== p || !latest.current.enabled || latest.current.identity !== p.identity) return
      p.dragging = true
      blockClick.current = true
      // The screen stays mounted when the dial covers the original button.
      p.target = target.closest<HTMLElement>('.home') ?? target
      p.target.setPointerCapture(p.id)
      latest.current.onOpen(target as HTMLButtonElement)
    }, holdMs)
  }
  useLayoutEffect(() => {
    const down = (e: PointerEvent) => {
      if (press.current && press.current.id !== e.pointerId) stop(true)
      else if (e.isPrimary) blockClick.current = false
    }
    const move = (e: PointerEvent) => {
      const p = press.current
      if (!p || e.pointerId !== p.id) return
      if (!p.dragging) {
        if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > panTolerance) stop(true)
        return
      }
      if (!latest.current.open) return
      const nextAngle = angle(e.clientX, e.clientY)
      const previousAngle = p.angle ?? angle(p.x, p.y)
      if (nextAngle !== null && previousAngle !== null) {
        let delta = nextAngle - previousAngle
        if (delta > Math.PI) delta -= Math.PI * 2
        if (delta < -Math.PI) delta += Math.PI * 2
        p.value = Math.max(latest.current.min, Math.min(latest.current.max, p.value + delta * 30 / Math.PI))
        latest.current.onPreview(Math.round(p.value))
      }
      p.angle = nextAngle
      p.x = e.clientX
      p.y = e.clientY
    }
    const up = (e: PointerEvent) => { if (press.current?.id === e.pointerId) stop(false) }
    const cancel = (e: PointerEvent) => { if (press.current?.id === e.pointerId) stop(true) }
    const lost = (e: PointerEvent) => { if (press.current?.target === e.target) cancel(e) }
    const blur = () => stop(true)
    const hidden = () => { if (document.hidden) blur() }
    const click = (e: MouseEvent) => {
      if (!blockClick.current || e.detail === 0) return
      blockClick.current = false
      e.preventDefault()
      e.stopImmediatePropagation()
    }
    window.addEventListener('pointerdown', down, true)
    window.addEventListener('pointermove', move, true)
    window.addEventListener('pointerup', up, true)
    window.addEventListener('pointercancel', cancel, true)
    window.addEventListener('lostpointercapture', lost, true)
    window.addEventListener('click', click, true)
    window.addEventListener('blur', blur)
    document.addEventListener('visibilitychange', hidden)
    return () => {
      stop(false)
      window.removeEventListener('pointerdown', down, true)
      window.removeEventListener('pointermove', move, true)
      window.removeEventListener('pointerup', up, true)
      window.removeEventListener('pointercancel', cancel, true)
      window.removeEventListener('lostpointercapture', lost, true)
      window.removeEventListener('click', click, true)
      window.removeEventListener('blur', blur)
      document.removeEventListener('visibilitychange', hidden)
    }
  }, [])
  useLayoutEffect(() => {
    const p = press.current
    if (p && (!options.enabled || options.identity !== p.identity || (p.dragging ? !options.open : options.task !== p.task))) stop(true)
  }, [options.enabled, options.identity, options.open, options.task])
  return { face, beginHold: (e: ReactPointerEvent<HTMLButtonElement>) => begin(e, false),
    beginDrag: (e: ReactPointerEvent<HTMLDivElement>) => begin(e, true) }
}
