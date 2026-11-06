import { useLayoutEffect, useRef } from 'react'
import type { Screen } from '../components/TabBar'

interface TaskSurface { open: boolean; close: () => void; order: number }

// Focus and Records can host the same editor. They share one browser-history
// entry, so a page transfer must not pop the entry out from under its new host.
const surfaces = new Set<TaskSurface>()
let order = 0
let ownsEntry = false
let popping = false
let listening = false
let scheduled: number | undefined
const screenListeners = new Set<(screen: Screen) => void>()
let visibleScreen: Screen = 'home'
let queuedScreen: Screen | null = null

export function historyScreen(): Screen {
  const screen: unknown = history.state?.clockScreen
  return screen === 'stats' || screen === 'settings' ? screen : 'home'
}

function listen() {
  if (listening) return
  window.addEventListener('popstate', onPop)
  listening = true
}

function showScreen(screen: Screen) {
  // Browser Back does not focus a button first. Finish editing while the old
  // screen is still mounted, so its normal blur handler can save valid fields
  // and retain invalid drafts instead of losing the event during unmount.
  if (screen !== visibleScreen && document.activeElement instanceof HTMLElement) document.activeElement.blur()
  visibleScreen = screen
  screenListeners.forEach(listener => listener(screen))
}

/** Screen entries and task entries share one owner so an editor transfer cannot
 * accidentally consume a screen entry. History contains only navigation, never input. */
export function subscribeScreens(listener: (screen: Screen) => void): () => void {
  screenListeners.add(listener)
  visibleScreen = historyScreen()
  history.replaceState({ ...history.state, clockScreen: visibleScreen }, '')
  // A reloaded page does not reopen a keyboard. Retire its obsolete task entry.
  ownsEntry = history.state?.clockFocusTask === true
  listen()
  schedule()
  return () => { screenListeners.delete(listener); schedule() }
}

function commitScreen(next: Screen) {
  const transferringTask = !!currentSurface()
  const state = { ...history.state, clockScreen: next, clockPreviousScreen: historyScreen(), clockFocusTask: false }
  // Transfer the task's parent to the destination. Reconciliation adds the
  // destination's task entry if the same editor is still open there.
  if (ownsEntry || history.state?.clockFocusTask === true) history.replaceState(state, '')
  else history.pushState(state, '')
  ownsEntry = false
  // A rapid Back can arrive before the zero-delay reconciliation. Carry the
  // open task now; reconciliation removes it if the destination has no host.
  if (transferringTask) {
    history.pushState({ ...state, clockFocusTask: true }, '')
    ownsEntry = true
  }
}

export function navigateScreen(next: Screen) {
  if (next === visibleScreen) return
  if (popping) queuedScreen = next
  else commitScreen(next)
  showScreen(next)
  schedule()
}

/** The explicit Settings return consumes the same entry as browser Back. */
export function returnScreen(next: Screen) {
  if (!popping && !ownsEntry && history.state?.clockPreviousScreen === next) {
    popping = true
    showScreen(next)
    history.back()
  } else navigateScreen(next)
}

const currentSurface = () => [...surfaces].filter(surface => surface.open).sort((a, b) => b.order - a.order)[0]

function schedule() {
  window.clearTimeout(scheduled)
  // Both hosts' layout effects finish before evaluating a transfer. This only
  // coordinates presentation; it never delays or changes a business command.
  scheduled = window.setTimeout(reconcile, 0)
}

function onPop() {
  // A task dismissed with Back remains in the browser's Forward list. Skip
  // that presentation-only entry rather than restoring stale input or leaving
  // a duplicate screen that would swallow the user's next Back.
  if (!popping && !ownsEntry && history.state?.clockFocusTask === true) {
    popping = true
    history.back()
    return
  }
  if (popping) {
    popping = false
    ownsEntry = false
  } else if (ownsEntry) {
    ownsEntry = false
    currentSurface()?.close()
  }
  if (queuedScreen) {
    const next = queuedScreen
    queuedScreen = null
    commitScreen(next)
    showScreen(next)
  } else showScreen(historyScreen())
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
  if (!surfaces.size && !screenListeners.size && !ownsEntry && !popping && listening) {
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
    listen()
    schedule()
    return () => { surfaces.delete(current); schedule() }
  }, [])
  useLayoutEffect(() => {
    if (open) surface.current.order = ++order
    schedule()
  }, [open, step])
}
