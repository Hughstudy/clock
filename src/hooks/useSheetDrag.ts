import { useRef, type PointerEvent, type RefObject } from 'react'

/** A sheet let go this far down, or a third of its own height, closes. */
const DISMISS_DRAG = 120

/**
 * Lets a sheet be pulled down by its header. The sheet follows the finger through `--drag`;
 * letting go far enough closes it, as its close button does, and anything less springs back.
 * Presses that begin on a control inside the header stay with that control.
 */
export function useSheetDrag(sheet: RefObject<HTMLElement>, onClose: () => void, enabled = true) {
  const drag = useRef<{ id: number; from: number; moved: number } | null>(null)
  const start = (event: PointerEvent<HTMLElement>) => {
    if (!enabled || !event.isPrimary || (event.target as Element).closest('button, a, input, textarea, select')) return
    drag.current = { id: event.pointerId, from: event.clientY, moved: 0 }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const move = (event: PointerEvent<HTMLElement>) => {
    const state = drag.current, element = sheet.current
    if (!state || !element || state.id !== event.pointerId) return
    state.moved = Math.max(0, event.clientY - state.from)
    element.dataset.dragging = 'true'
    element.style.setProperty('--drag', `${state.moved}px`)
  }
  const end = (event: PointerEvent<HTMLElement>) => {
    const state = drag.current, element = sheet.current
    if (!state || state.id !== event.pointerId) return
    drag.current = null
    if (!element) return
    delete element.dataset.dragging
    element.style.removeProperty('--drag')
    if (event.type === 'pointerup' && state.moved > Math.min(DISMISS_DRAG, element.offsetHeight / 3)) onClose()
  }
  return { onPointerDown: start, onPointerMove: move, onPointerUp: end, onPointerCancel: end }
}
