import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { focusChromeDelay } from '../logic/focus-chrome'
import type { Spec } from '../logic/spec'

const CONTROLS = '.fp-plate, .fp-top, .tab-bar'
// Short landscapes already keep the card in its own side region, so it stays put there.
const SHORT_LANDSCAPE = '(orientation: landscape) and (max-height: 599px)'

interface Options {
  /** A new or resumed countdown shows where the controls are before they step aside. */
  sessionKey: string | null
  running: boolean
  held: boolean
  timings: Spec['focusChrome']
}

function useShortLandscape(): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(SHORT_LANDSCAPE).matches)
  useEffect(() => {
    const query = window.matchMedia(SHORT_LANDSCAPE)
    const change = () => setMatches(query.matches)
    change()
    query.addEventListener('change', change)
    return () => query.removeEventListener('change', change)
  }, [])
  return matches
}

/**
 * Lets the Focus card step aside during an untouched countdown. Local presentation only:
 * nothing here reads or writes timer state, and a finger or keyboard focus always holds the card.
 */
export function useFocusChrome({ sessionKey, running, held, timings }: Options) {
  const { tuckAfterStartMs, tuckAfterIdleMs, arrivalGuardMs } = timings
  const shortLandscape = useShortLandscape()
  const [due, setDue] = useState(false)
  const [revision, setRevision] = useState(0)
  const [pressing, setPressing] = useState(false)
  const [keyboardInside, setKeyboardInside] = useState(false)
  const [arriving, setArriving] = useState(false)
  const visibleUntil = useRef(0)
  const arrival = useRef(0)

  const keepFor = useCallback((ms: number) => {
    visibleUntil.current = Date.now() + ms
    setDue(false)
    setRevision(value => value + 1)
  }, [])

  useLayoutEffect(() => {
    if (running) keepFor(tuckAfterStartMs)
  }, [running, sessionKey, tuckAfterStartMs, keepFor])

  // Letting go of the card restarts the wait, so it never vanishes the moment a task closes.
  const holding = held || pressing || keyboardInside || shortLandscape
  const wasHolding = useRef(holding)
  useLayoutEffect(() => {
    if (wasHolding.current && !holding) keepFor(tuckAfterIdleMs)
    wasHolding.current = holding
  }, [holding, tuckAfterIdleMs, keepFor])

  useEffect(() => {
    const delay = focusChromeDelay({ running, held: holding, visibleUntil: visibleUntil.current, nowMs: Date.now() })
    if (delay === null) { setDue(false); return }
    const timer = window.setTimeout(() => setDue(true), delay)
    return () => window.clearTimeout(timer)
  }, [running, holding, revision])

  useEffect(() => {
    const inControls = (target: EventTarget | null) => target instanceof Element && !!target.closest(CONTROLS)
    const down = (event: PointerEvent) => { if (inControls(event.target)) setPressing(true) }
    const up = () => setPressing(false)
    const focusIn = (event: FocusEvent) => {
      const target = event.target
      setKeyboardInside(target instanceof Element && inControls(target) && target.matches(':focus-visible'))
    }
    const focusOut = (event: FocusEvent) => { if (!event.relatedTarget) setKeyboardInside(false) }
    document.addEventListener('pointerdown', down, true)
    document.addEventListener('pointerup', up, true)
    document.addEventListener('pointercancel', up, true)
    document.addEventListener('focusin', focusIn)
    document.addEventListener('focusout', focusOut)
    return () => {
      document.removeEventListener('pointerdown', down, true)
      document.removeEventListener('pointerup', up, true)
      document.removeEventListener('pointercancel', up, true)
      document.removeEventListener('focusin', focusIn)
      document.removeEventListener('focusout', focusOut)
    }
  }, [])

  const callOut = useCallback(() => {
    keepFor(tuckAfterIdleMs)
    // A second tap of the same gesture must not land on a control that has just appeared.
    setArriving(true)
    window.clearTimeout(arrival.current)
    arrival.current = window.setTimeout(() => setArriving(false), arrivalGuardMs)
  }, [keepFor, tuckAfterIdleMs, arrivalGuardMs])
  useEffect(() => () => window.clearTimeout(arrival.current), [])

  return { away: due && running && !holding, arriving, callOut }
}
