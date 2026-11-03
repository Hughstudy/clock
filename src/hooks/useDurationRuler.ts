import { useEffect, useLayoutEffect, useRef, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react'

export const RULER_TICK_PX = 10

interface Options {
  /** The valid minutes to show; null while typed text is invalid, which leaves the ruler where it is. */
  value: number | null
  min: number
  max: number
  onChange: (minutes: number) => void
}

/** Native scrolling gives touch its momentum and snapping. Mouse, wheel, tap and keys drive the same scroll position. */
export function useDurationRuler({ value, min, max, onChange }: Options) {
  const track = useRef<HTMLDivElement>(null)
  // The minute the ruler last showed. A scroll reporting it back must not reposition the moving ruler.
  const shown = useRef(value ?? min)
  const ready = useRef(false)
  const mouse = useRef<{ x: number; start: number; moved: boolean } | null>(null)
  const justDragged = useRef(false)
  const latest = useRef({ value, min, max, onChange })
  latest.current = { value, min, max, onChange }

  const clamp = (minutes: number) => Math.max(min, Math.min(max, minutes))
  const place = (minutes: number) => {
    if (track.current) track.current.scrollLeft = (minutes - min) * RULER_TICK_PX
    shown.current = minutes
  }
  const choose = (minutes: number) => {
    const next = clamp(minutes)
    place(next)
    onChange(next)
  }

  useLayoutEffect(() => {
    if (value !== null && value !== shown.current && ready.current) place(value)
  }, [value])

  useEffect(() => {
    const element = track.current
    if (!element) return
    // The panel has no layout on its first render, and resizing can lose the offset.
    const sizes = new ResizeObserver(() => {
      if (!element.clientWidth) return
      place(shown.current)
      ready.current = true
    })
    sizes.observe(element)
    const wheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX) || !event.deltaY) return
      event.preventDefault()
      const current = latest.current
      const next = Math.max(current.min, Math.min(current.max, shown.current + Math.sign(event.deltaY)))
      place(next)
      current.onChange(next)
    }
    element.addEventListener('wheel', wheel, { passive: false })
    return () => { sizes.disconnect(); element.removeEventListener('wheel', wheel) }
  }, [])

  const endDrag = () => {
    const element = track.current, drag = mouse.current
    if (!element || !drag) return
    mouse.current = null
    justDragged.current = drag.moved
    element.scrollLeft = Math.round(element.scrollLeft / RULER_TICK_PX) * RULER_TICK_PX
    delete element.dataset.dragging
  }

  return {
    ref: track,
    onScroll: () => {
      const element = track.current
      if (!element || !ready.current) return
      const next = clamp(Math.round(element.scrollLeft / RULER_TICK_PX) + min)
      if (next === shown.current) return
      shown.current = next
      onChange(next)
    },
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      const from = shown.current
      const targets: Record<string, number> = { ArrowRight: from + 1, ArrowUp: from + 1, '+': from + 1, ArrowLeft: from - 1, ArrowDown: from - 1, '-': from - 1,
        PageUp: from + 5, PageDown: from - 5, Home: min, End: max }
      const target = targets[event.key]
      if (target === undefined) return
      event.preventDefault()
      choose(target)
    },
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      if (event.pointerType !== 'mouse' || event.button !== 0) return
      event.currentTarget.setPointerCapture(event.pointerId)
      event.currentTarget.dataset.dragging = 'true'
      mouse.current = { x: event.clientX, start: event.currentTarget.scrollLeft, moved: false }
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      const drag = mouse.current
      if (!drag) return
      const distance = event.clientX - drag.x
      if (Math.abs(distance) > 3) drag.moved = true
      event.currentTarget.scrollLeft = drag.start - distance
    },
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
    // A tap moves straight to the tick under it.
    onClick: (event: MouseEvent<HTMLElement>) => {
      if (justDragged.current) { justDragged.current = false; return }
      const box = event.currentTarget.getBoundingClientRect()
      choose(shown.current + Math.round((event.clientX - box.left - box.width / 2) / RULER_TICK_PX))
    },
  }
}
