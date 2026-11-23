import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { TimerView, UserAction } from '../contracts/focus'
import { focusCopy as copy } from '../data/focus-copy'
import { DurationRuler } from './DurationRuler'
import { FocusPanel } from './FocusPanel'
import { elapsedClock } from './format'

/** Capture the clock at the moment its button opened this editor. Later renders may show another schedule. */
export interface RemainingEdit {
  guard: NonNullable<TimerView['adjustmentGuard']>
  minutes: number
  isRest: boolean
}

interface Props {
  opened: RemainingEdit
  view: TimerView
  anchor: HTMLElement | null
  canEdit: boolean
  onClose: () => void
  dispatch: (action: UserAction) => void | Promise<boolean>
}

export function RemainingTimeEditor({ opened, view, anchor, canEdit, onClose, dispatch }: Props) {
  const [draft, setDraft] = useState(String(opened.minutes))
  const [submitting, setSubmitting] = useState(false)
  const [failed, setFailed] = useState(false)
  const inFlight = useRef(false)
  const mounted = useRef(true)
  const noticeRef = useRef<HTMLParagraphElement>(null)
  const guard = view.adjustmentGuard
  const ended = !guard || guard.generation !== opened.guard.generation || guard.sessionId !== opened.guard.sessionId
  const changed = guard?.expectedTimingRevision !== opened.guard.expectedTimingRevision || guard?.expectedSchedule !== opened.guard.expectedSchedule
  const elapsed = view.totalMs - view.remainingMs
  const paused = view.status === 'paused'
  const unavailable = ended ? copy.remainingExpired
    : changed ? copy.remainingChanged
    : !canEdit ? '当前数据只读，无法调整计时。'
    : view.maxRemainingMinutes < 1 ? copy.remainingUnavailable : null

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  // A peer can change the schedule or it can expire while the keyboard is open.
  // When that removes the form, leave the explanation within reach of the keyboard.
  useLayoutEffect(() => {
    if ((unavailable || failed) && !submitting) noticeRef.current?.focus({ preventScroll: true })
  }, [unavailable, failed, submitting])

  const apply = async (remainingMinutes: number) => {
    if (inFlight.current || unavailable) return
    inFlight.current = true
    setSubmitting(true)
    setFailed(false)
    try {
      const accepted = await dispatch({ type: 'adjustRemaining', ...opened.guard, remainingMinutes })
      if (!mounted.current) return
      if (accepted) onClose()
      else setFailed(true)
    } catch {
      if (mounted.current) setFailed(true)
    } finally {
      inFlight.current = false
      if (mounted.current) setSubmitting(false)
    }
  }

  return <FocusPanel title={copy.remainingTitle(opened.isRest)} anchor={anchor}
    closeLabel={unavailable ? ended && !view.sessionId ? copy.viewResult : copy.cancelEnd : copy.cancel} onClose={onClose}>
    {unavailable ? <p className="fp-hint" ref={noticeRef} tabIndex={-1}>{unavailable}</p> : <>
      <p className="fp-remaining-summary">{copy.remainingSummary(opened.isRest, elapsedClock(elapsed), paused)}</p>
      <DurationRuler draft={draft} minutes={opened.minutes} min={1} max={view.maxRemainingMinutes}
        current={{ elapsedMs: elapsed, paused, isRest: opened.isRest, submitting }}
        onChange={value => { if (!inFlight.current) { setFailed(false); setDraft(value) } }}
        onApply={value => void apply(value)} />
      {failed && <p className="fp-hint fp-hint--error" ref={noticeRef} tabIndex={-1}>{copy.remainingRejected}</p>}
    </>}
  </FocusPanel>
}
