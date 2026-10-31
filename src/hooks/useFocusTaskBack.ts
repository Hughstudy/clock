import { useLayoutEffect, useRef } from 'react'

/** All in-place Focus tasks share one browser Back entry, including list → editor.
 * A save, Escape or explicit close releases that entry without leaving Focus.
 */
export function useFocusTaskBack(open: boolean, close: () => void) {
  const state = useRef({ open, close, ownsEntry: false, popping: false })
  state.current.open = open
  state.current.close = close

  useLayoutEffect(() => {
    const current = state.current
    const pop = () => {
      if (current.popping) {
        current.popping = false
        // A second task can be opened before an explicit close's popstate arrives.
        if (current.open) pushEntry()
      } else if (current.ownsEntry && current.open) {
        current.ownsEntry = false
        current.close()
      }
    }
    const pushEntry = () => {
      if (history.state?.clockFocusTask !== true) history.pushState({ ...history.state, clockFocusTask: true }, '')
      current.ownsEntry = true
    }
    if (open && !current.ownsEntry && !current.popping) pushEntry()
    if (!open && current.ownsEntry) {
      current.ownsEntry = false
      current.popping = true
      history.back()
    }
    window.addEventListener('popstate', pop)
    return () => window.removeEventListener('popstate', pop)
  }, [open])
}
