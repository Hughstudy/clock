import { flushSync } from 'react-dom'
import type { Screen } from '../TabBar'
import { playJournalFlight } from './flight'
import { captureFocus, captureRecords } from './snapshots'
import './navigation.css'

let stopActive: (() => void) | null = null

export function cancelSceneJournal() {
  stopActive?.()
}

function snapshot<T>(capture: () => T): T | null {
  // The destination must remain available if the browser cannot print the
  // current surface (for example, an unsupported shadow stylesheet).
  try { return capture() }
  catch { return null }
}

/** Navigate immediately. A removable, inert print carries the journal between
 * the real room and the selected Records chapter while the destination is live. */
export function turnSceneJournal(next: Screen, navigate: () => void) {
  if (stopActive) {
    cancelSceneJournal()
    navigate()
    return
  }
  const app = document.querySelector<HTMLElement>('#root > .app[data-screen]')
  const from = app?.dataset.screen
  const forward = from === 'home' && next === 'stats'
  if (!app || (!forward && !(from === 'stats' && next === 'home'))) {
    navigate()
    return
  }
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
  const reduced = () => reduce.matches || app.dataset.reducedMotion === 'true'
  if (reduced() || document.hidden || !Element.prototype.animate) {
    navigate()
    return
  }

  let focus = forward ? snapshot(() => captureFocus(app)) : null
  let records = forward ? null : snapshot(() => captureRecords(app))
  if (forward ? !focus : !records) {
    navigate()
    return
  }

  const root = document.documentElement
  const stage = document.createElement('div')
  stage.className = 'scene-fold-stage'
  stage.inert = true
  stage.setAttribute('aria-hidden', 'true')
  const controls = new AbortController()
  const { signal } = controls
  const observer = new MutationObserver(() => {
    if (reduced() || app.dataset.screen !== next) stop()
  })
  let playback: ReturnType<typeof playJournalFlight> | undefined

  function stop() {
    if (stopActive !== stop) return
    stopActive = null
    controls.abort()
    observer.disconnect()
    playback?.cancel()
    stage.remove()
    delete root.dataset.pageTurn
    delete root.dataset.sceneViewport
    for (const key of ['--scene-records-left', '--scene-records-width', '--scene-nav-left', '--scene-nav-width']) {
      root.style.removeProperty(key)
    }
  }

  root.dataset.pageTurn = forward ? 'forward' : 'back'
  stopActive = stop
  // Measure the actual destination in the same turn, including its layout
  // effects. Its own navigation, history, timer and focus remain authoritative.
  try { flushSync(navigate) }
  catch (error) { stop(); throw error }
  if (stopActive !== stop || app.dataset.screen !== next || reduced()) {
    stop()
    return
  }

  try {
    if (forward) records = captureRecords(app)
    else {
      app.querySelector('.fp-scene')?.dispatchEvent(new Event('scene-book-measure'))
      focus = captureFocus(app)
    }
    if (!focus || !records) { stop(); return }

    root.style.setProperty('--scene-records-left', records.bounds.left + 'px')
    root.style.setProperty('--scene-records-width', records.bounds.width + 'px')
    root.style.setProperty('--scene-nav-left', records.navBounds.left + 'px')
    root.style.setProperty('--scene-nav-width', records.navBounds.width + 'px')
    root.dataset.sceneViewport = ''
    document.body.append(stage)
    playback = playJournalFlight(stage, focus, records, forward)
    playback.finished.then(stop, stop)

    observer.observe(app, { attributes: true, attributeFilter: ['data-screen', 'data-reduced-motion'] })
    document.addEventListener('visibilitychange', stop, { signal })
    // Removing the Records scrollbar also emits resize events on WebKit and
    // Chromium. Only a change in actual viewport, keyboard or zoom needs a
    // new framing; the measured scrollbar change is already accounted for.
    const viewport = () => [window.innerWidth, window.innerHeight, window.visualViewport?.height, window.visualViewport?.scale]
    const initial = viewport()
    const onResize = () => { if (viewport().some((value, i) => value !== initial[i])) stop() }
    window.addEventListener('resize', onResize, { signal })
    window.visualViewport?.addEventListener('resize', onResize, { signal })
    reduce.addEventListener('change', stop, { signal })
    // The activating click/key has already passed document capture. Other
    // controls go straight through; another tab activation settles in the
    // navigation subscriber to avoid starting a second animation on that tap.
    const navigationTarget = (event: Event) => event.target instanceof Element &&
      event.target.closest('.tab-bar, [data-scene-book-trigger]')
    document.addEventListener('click', event => {
      if (!navigationTarget(event)) stop()
    }, { capture: true, signal })
    document.addEventListener('keydown', event => {
      if (!['Enter', ' '].includes(event.key) || !navigationTarget(event)) stop()
    }, { capture: true, signal })
    document.addEventListener('wheel', stop, { passive: true, capture: true, signal })
    document.addEventListener('touchmove', stop, { passive: true, capture: true, signal })
  } catch {
    stop()
  }
}
