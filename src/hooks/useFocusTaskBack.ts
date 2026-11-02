import { useLayoutEffect, useRef } from 'react'

interface TaskSurface { open: boolean; close: () => void; order: number }

// Focus and Records can host the same editor. They share one browser-history
// entry, so a page transfer must not pop the entry out from under its new host.
const surfaces = new Set<TaskSurface>()
let order = 0
let ownsEntry = false
let popping = false
let listening = false
let scheduled: number | undefined

const currentSurface = () => [...surfaces].filter(surface => surface.open).sort((a, b) => b.order - a.order)[0]

function schedule() {
  window.clearTimeout(scheduled)
  // Both hosts' layout effects finish before evaluating a transfer. This only
  // coordinates presentation; it never delays or changes a business command.
  scheduled = window.setTimeout(reconcile, 0)
}

function onPop() {
  if (popping) {
    popping = false
    ownsEntry = false
  } else if (ownsEntry) {
    ownsEntry = false
    currentSurface()?.close()
  }
  // An internal Back (categories → reading) still has an open surface and
  // replaces the consumed entry. Closing a task leaves no entry to recreate.
  schedule()
}

function reconcile() {
  scheduled = undefined
  if (popping) return
  const active = currentSurface()
  if (active && !ownsEntry) {
    if (history.state?.clockFocusTask !== true) history.pushState({ ...history.state, clockFocusTask: true }, '')
    ownsEntry = true
  } else if (!active && ownsEntry) {
    ownsEntry = false
    popping = true
    history.back()
  }
  if (!surfaces.size && !ownsEntry && !popping && listening) {
    window.removeEventListener('popstate', onPop)
    listening = false
  }
}

/** One Back entry for a local task, including Focus ↔ Records editor transfers.
 * `step` lets an internal reader step retain the task after consuming Back. */
export function useFocusTaskBack(open: boolean, close: () => void, step = '') {
  const surface = useRef<TaskSurface>({ open, close, order: 0 })
  surface.current.open = open
  surface.current.close = close
  useLayoutEffect(() => {
    const current = surface.current
    surfaces.add(current)
    if (!listening) {
      window.addEventListener('popstate', onPop)
      listening = true
    }
    schedule()
    return () => { surfaces.delete(current); schedule() }
  }, [])
  useLayoutEffect(() => {
    if (open) surface.current.order = ++order
    schedule()
  }, [open, step])
}
