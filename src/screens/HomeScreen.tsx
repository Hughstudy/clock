import { focusCopy as copy } from '../data/focus-copy'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { FocusPanel } from '../components/FocusPanel'
import { formatClock, formatElapsedClock, formatMinutes, PHASE_LABELS, spokenClock } from '../components/format'
import { ThoughtPanel } from '../components/ThoughtPanel'
import { TimerActionButton } from '../components/TimerActionButton'
import { BlueCompanion } from '../components/companion/BlueCompanion'
import { CompanionFeedback } from '../components/companion/CompanionFeedback'
import { sceneSettingFor } from '../components/companion/CompanionScenery'
import type { SaveState, Thought } from '../contracts/focus'
import { uiText } from '../data/ui-copy'
import type { useFeedback } from '../hooks/companion/useFeedback'
import { useDurationChoice, validateDurationDraft } from '../hooks/useDurationChoice'
import { useFocusTaskBack } from '../hooks/useFocusTaskBack'
import type { SessionResult, UserAction } from '../hooks/useClockApp'
import type { Thoughts } from '../hooks/useThoughts'
import type { TimerView } from '../hooks/useViews'

type Panel = 'duration' | 'end' | 'thought' | null
type RestPhase = 'shortBreak' | 'longBreak'

interface Props {
  active: boolean
  view: TimerView
  result: SessionResult | null
  linkedThoughts: readonly Thought[]
  /** Count of default-duration changes requested so far; orders them against picks here. */
  defaultsIntent: number
  companion: ReturnType<typeof useFeedback>
  thoughts: Thoughts
  reducedMotion: boolean
  canEdit: boolean
  saveState: SaveState
  dispatch: (action: UserAction) => void
  onSettings: () => void
}

const titles = { duration: copy.otherTitle, end: uiText('UI05'), thought: copy.write }

/**
 * The companion's scene fills the screen; one cream plate below it carries the
 * time, the choices for this moment and a single primary action. Only a custom
 * length, writing a thought and confirming an end open a local panel.
 */
export function HomeScreen({ active, view, result, linkedThoughts, defaultsIntent, companion, thoughts,
  reducedMotion, canEdit, saveState, dispatch, onSettings }: Props) {
  const [task, setTask] = useState<Panel>(null)
  const choice = useDurationChoice(defaultsIntent)
  const [restChoice, setRestChoice] = useState<RestPhase | null>(null)
  const [step, setStep] = useState('')
  const [editingStep, setEditingStep] = useState(false)
  const [draft, setDraft] = useState('')
  const confirming = useRef<string | null>(null)
  const submittedStep = useRef<string | null>(null)
  const primaryRef = useRef<HTMLDivElement>(null)
  const opener = useRef<HTMLElement | null>(null)
  const previousPanel = useRef<Panel>(null)

  const ready = view.status === 'ready'
  const paused = view.status === 'paused'
  const ended = ready ? result : null
  const focusResult = ended?.phase === 'focus' ? ended : null
  const restEnded = ended?.phase === 'rest' ? ended : null
  const preparingRest = ready && view.isBreak && !focusResult
  const readyFocus = ready && !view.isBreak && !focusResult
  const isRest = ready ? preparingRest : view.isBreak
  const restPhase: RestPhase = restChoice ?? (view.phase === 'longBreak' ? 'longBreak' : 'shortBreak')
  const restMinutes = restPhase === 'longBreak' ? view.longBreakMinutes : view.shortBreakMinutes
  const focusMinutes = choice.picked ?? view.nextFocusMinutes
  const panel = active ? (thoughts.open ? 'thought' : task) : null
  const stepTooLong = Array.from(step).length > view.stepMaxLength
  const scene = panel && companion.scene?.allowBeats ? { ...companion.scene, allowBeats: false } : companion.scene

  useEffect(() => {
    if (!view.sessionId) return
    choice.clear()
    setRestChoice(null)
    setEditingStep(false)
    if (task === 'duration') setTask(null)
  }, [view.sessionId])
  useEffect(() => { setRestChoice(null) }, [focusResult?.sessionId])
  useEffect(() => {
    if (submittedStep.current === null || saveState !== 'saved' || !view.sessionId || view.isBreak) return
    if (view.step === submittedStep.current) setStep('')
    submittedStep.current = null
  }, [view.sessionId, view.isBreak, view.step, saveState])
  useEffect(() => {
    if (task === 'end' && confirming.current !== view.sessionId) setTask(null)
  }, [task, view.sessionId])

  useLayoutEffect(() => {
    if (active && previousPanel.current && !panel) {
      const prior = opener.current
      const target = prior?.isConnected && !prior.matches(':disabled') && prior.getClientRects().length
        ? prior : primaryRef.current?.querySelector<HTMLButtonElement>('button')
      target?.focus({ preventScroll: true })
    }
    previousPanel.current = panel
  }, [active, panel])

  const show = (next: Exclude<Panel, null>, target: HTMLElement) => {
    opener.current = target
    if (next === 'thought') { setTask(null); thoughts.openNew(); return }
    if (next === 'end') confirming.current = view.sessionId
    if (next === 'duration') setDraft(String(focusMinutes))
    setTask(next)
  }
  const close = () => {
    if (panel === 'thought') thoughts.setOpen(false)
    setTask(null)
  }
  useFocusTaskBack(!!panel, close)

  const pick = choice.pick
  const startFocus = (minutes: number) => {
    if (stepTooLong) return
    submittedStep.current = step.replace(/\s+/g, ' ').trim() || null
    dispatch({ type: 'startFocus', step, durationMinutes: minutes })
  }
  const startRest = () => dispatch({ type: 'startBreak', phase: restPhase })
  const toggle = () => dispatch({ type: paused ? 'resume' : 'pause' })
  const edit = (id: string, target?: HTMLElement) => {
    if (target) opener.current = target
    setTask(null)
    thoughts.edit(id)
  }

  const identity = [view.sessionId ?? 'ready', view.phase, view.status, ended?.sessionId, preparingRest].join('/')
  const primary = !ready
    ? { label: paused ? (view.isBreak ? copy.resumeRest : copy.resumeFocus) : (view.isBreak ? copy.pauseRest : uiText('UI03')), run: toggle }
    : focusResult ? { label: copy.restFor(restMinutes), run: startRest }
    : preparingRest ? { label: copy.startRest, run: startRest }
    : { label: copy.startFocus, run: () => startFocus(focusMinutes) }

  const digits = focusResult ? formatElapsedClock(focusResult.elapsedMs)
    : ready ? formatClock((preparingRest ? restMinutes : focusMinutes) * 60000) : formatClock(view.remainingMs)
  const tone = focusResult ? 'done' : paused ? 'paused' : isRest ? 'rest' : 'focus'

  const duration = validateDurationDraft(draft, view.focusMinutesRange.min, view.focusMinutesRange.max)
  const customPicked = !view.quickChoicesMinutes.includes(focusMinutes)

  const frame = companion.feedback.frame
  const requested = frame.placement === 'requested' ? frame.encouragement : null
  const spoken = requested ?? (frame.placement !== 'requested' ? frame.encouragement : null)
  const noteStatus = thoughts.status
  const pending = saveState === 'pending'
  const statusLine = focusResult
    ? `${copy.focusElapsed} ${formatMinutes(focusResult.elapsedMs)} · ${focusResult.saved ? copy.savedRecord : copy.unsavedRecord}`
    : restEnded ? `${copy.restElapsed} ${formatMinutes(restEnded.elapsedMs)}`
    : preparingRest ? `${PHASE_LABELS[restPhase]} · ${copy.ready}`
    : ready ? null
    : `${PHASE_LABELS[view.phase]} · ${paused ? copy.paused : copy.running}${view.isBreak ? '' : ` · ${copy.target(Math.round(view.totalMs / 60000))}`}`

  return (
    <section className="screen home" data-tone={tone} aria-label="专注计时">
      <div className="fp-scene" data-setting={companion.sceneryEnabled ? sceneSettingFor(scene?.id) : 'plain'}>
        <div className="fp-top">
          <button type="button" className="pill pill--glass" aria-expanded={!!requested}
            onClick={() => (requested ? companion.dismiss() : companion.request())}>{uiText('UI19')}</button>
          <button type="button" className="pill pill--glass pill--icon" onClick={onSettings} aria-label="设置">
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M5 4v16M12 4v16M19 4v16"/><path d="M2 8h6M9 15h6M16 9h6" strokeWidth="3.4"/></svg>
          </button>
        </div>
        {spoken && <div className={requested ? 'fp-bubble fp-bubble--requested' : 'fp-bubble'}>
          <p>{spoken.text}</p>
          {requested && <div className="fp-bubble__actions">
            <button type="button" className="pill pill--soft" onClick={companion.next}>{uiText('UI20')}</button>
            <button type="button" className="pill pill--ghost" onClick={companion.dismiss}>{copy.dismiss}</button>
          </div>}
          {requested && <details className="fp-bubble__more"><summary>{copy.askCategories}</summary>
            {copy.askOptions.map(({ pool, label }) => <button key={pool} type="button" className="pill pill--soft"
              aria-pressed={requested.pool === pool} onClick={() => companion.request(pool)}>{label}</button>)}
          </details>}
        </div>}
        <div className="fp-art">
          <CompanionFeedback feedback={companion.feedback} compact reducedMotion={reducedMotion} motionEnabled={!reducedMotion}
            quietStatus announce={false} hideContent renderCharacter={(presentation, keyboardPat) =>
              <BlueCompanion presentation={presentation} keyboardPat={keyboardPat} cueId={companion.cue?.id} scene={scene}
                panelOpen={!!panel} sceneryEnabled={companion.sceneryEnabled} />} />
        </div>
        {panel && <FocusPanel key={panel} title={titles[panel]} onClose={close} quietTitle={panel === 'end'}
          closeLabel={panel === 'end' ? copy.cancelEnd : panel === 'duration' ? copy.cancel
            : !ready && !view.isBreak ? uiText(view.step ? 'UI16' : 'UI17') : '返回'}>
          {panel === 'duration' && <form className="fp-duration" onSubmit={e => {
            e.preventDefault()
            if (duration.ok) { pick(duration.minutes); close() }
          }}>
            <div className="fp-stepper">
              <button type="button" className="pill pill--soft" aria-label="减少 1 分钟"
                onClick={() => setDraft(String(Math.max(view.focusMinutesRange.min, (duration.ok ? duration.minutes : focusMinutes) - 1)))}>−</button>
              <input id="custom-minutes" data-initial-focus inputMode="numeric" enterKeyHint="done" value={draft}
                aria-describedby="custom-minutes-hint" aria-invalid={!duration.ok} aria-label="专注分钟数"
                onFocus={e => e.currentTarget.select()} onChange={e => setDraft(e.target.value)} />
              <button type="button" className="pill pill--soft" aria-label="增加 1 分钟"
                onClick={() => setDraft(String(Math.min(view.focusMinutesRange.max, (duration.ok ? duration.minutes : focusMinutes) + 1)))}>+</button>
              <span aria-hidden="true">分钟</span>
            </div>
            <p id="custom-minutes-hint" className={duration.ok ? 'fp-hint' : 'fp-hint fp-hint--error'}>
              {duration.ok ? copy.durationRange(view.focusMinutesRange.min, view.focusMinutesRange.max)
                : copy.durationError(view.focusMinutesRange.min, view.focusMinutesRange.max)}
              {!duration.ok && <button type="button" className="text-action" onClick={() => setDraft(String(focusMinutes))}>{copy.restoreDuration}</button>}
            </p>
            <div className="fp-panel-actions">
              <button type="submit" className="pill pill--solid" disabled={!duration.ok}>{copy.useDuration}</button>
            </div>
          </form>}
          {panel === 'end' && <div className="fp-end">
            <p><strong>{copy.endQuestion}</strong></p>
            <p>{paused ? copy.endPaused : copy.endRunning}</p>
            <div className="fp-panel-actions">
              <TimerActionButton identity={identity + 'confirm'} className="pill pill--ink" disabled={!canEdit || confirming.current !== view.sessionId}
                onActivate={() => { if (confirming.current === view.sessionId) dispatch({ type: 'end' }); close() }}>{uiText('UI06')}</TimerActionButton>
            </div>
          </div>}
          {panel === 'thought' && <>
            {!!linkedThoughts.length && !thoughts.isExisting && <details className="fp-linked">
              <summary>{copy.sessionThoughts}（{linkedThoughts.length}）</summary>
              <ul>{linkedThoughts.map((note, index) => <li key={note.id}><span>{note.text || `标记 ${index + 1}`}</span>
                <button type="button" className="text-action" disabled={!canEdit} onClick={e => edit(note.id, e.currentTarget)}>
                  {note.text ? copy.edit : copy.supplement}</button></li>)}</ul>
            </details>}
            <ThoughtPanel thoughts={thoughts} canEdit={canEdit} />
          </>}
          {pending && <p className="fp-hint fp-hint--error">{copy.pending}
            <button type="button" className="text-action" onClick={() => dispatch({ type: 'retrySave' })}>{copy.retry}</button></p>}
        </FocusPanel>}
      </div>

      <div className="fp-plate" data-panel={panel ?? ''}>
        <p className="fp-digits" {...(ready ? { 'aria-hidden': true } : { role: 'timer', 'aria-label': `${PHASE_LABELS[view.phase]}还剩${spokenClock(view.remainingMs)}` })}>{digits}</p>
        <div className="fp-status">
          {readyFocus && !restEnded ? (editingStep
            ? <input className="fp-step-input" aria-label={uiText('UI10')} placeholder={uiText('UI11')} value={step} autoFocus
                enterKeyHint="done" aria-invalid={stepTooLong} disabled={!canEdit}
                onChange={e => setStep(e.target.value)} onBlur={() => { if (!stepTooLong) setEditingStep(false) }}
                onKeyDown={e => { if ((e.key === 'Enter' || e.key === 'Escape') && !e.nativeEvent.isComposing && e.nativeEvent.keyCode !== 229 && !stepTooLong) { e.preventDefault(); setEditingStep(false) } }} />
            : <button type="button" className="text-action" disabled={!canEdit} onClick={() => setEditingStep(true)}>
              {step.trim() ? `${copy.stepPrefix}${step.trim()}` : copy.stepAdd}</button>)
            : <span>{!ready && !view.isBreak && view.step ? `${copy.stepPrefix}${view.step}` : statusLine}</span>}
          {stepTooLong && <span className="fp-hint--error"> · 请缩短到 {view.stepMaxLength} 字以内</span>}
        </div>

        <div className="fp-row">
          {ready && !preparingRest && !focusResult ? <div className="fp-chips" role="group" aria-label="专注时长">
            {view.quickChoicesMinutes.map(value => <button key={value} type="button" className="chip"
              aria-pressed={focusMinutes === value} disabled={!canEdit} onClick={() => pick(value)}>{copy.minutes(value)}</button>)}
            <button type="button" className="chip" aria-pressed={customPicked} disabled={!canEdit}
              onClick={e => show('duration', e.currentTarget)}>{customPicked ? copy.minutes(focusMinutes) : copy.otherDuration}</button>
          </div>
          : ready ? <div className="fp-chips" role="group" aria-label="休息时长">
            {(['shortBreak', 'longBreak'] as const).map(phase => <button key={phase} type="button" className="chip"
              aria-pressed={restPhase === phase} disabled={!canEdit} onClick={() => setRestChoice(phase)}>
              {PHASE_LABELS[phase]} {phase === 'shortBreak' ? view.shortBreakMinutes : view.longBreakMinutes}</button>)}
          </div>
          : <div className="fp-progress" aria-hidden="true"><i style={{ width: `${Math.round(Math.min(1, Math.max(0, view.progress)) * 1000) / 10}%` }} /></div>}
        </div>

        <div className="fp-primary" ref={primaryRef}>
          <TimerActionButton identity={identity} primary disabled={!canEdit || (readyFocus && stepTooLong)} onActivate={primary.run}>
            {primary.label}</TimerActionButton>
        </div>

        <div className="fp-secondary">
          {focusResult ? <>
            <TimerActionButton identity={identity + 'again'} className="text-action" disabled={!canEdit || stepTooLong}
              onActivate={() => startFocus(focusMinutes)}>{copy.repeatFocus(focusMinutes)}</TimerActionButton>
            <button type="button" className="text-action" disabled={!canEdit} onClick={() => dispatch({ type: 'prepare', phase: 'focus' })}>{copy.changeDuration}</button>
          </> : <button type="button" className="text-action" disabled={!canEdit}
            onClick={thoughts.mark} onKeyDown={e => { if (e.repeat && (e.key === 'Enter' || e.key === ' ')) e.preventDefault() }}>{copy.mark}</button>}
          <button type="button" className="text-action" disabled={!canEdit} onClick={e => show('thought', e.currentTarget)}>
            {thoughts.text ? copy.resumeDraft : copy.write}</button>
          {ready && !focusResult && <button type="button" className="text-action" disabled={!canEdit}
            onClick={() => dispatch({ type: 'prepare', phase: preparingRest ? 'focus' : restPhase })}>{preparingRest ? copy.focusMode : uiText('UI08')}</button>}
          {!ready && (view.isBreak
            ? <TimerActionButton identity={identity + 'end'} className="text-action" disabled={!canEdit} onActivate={() => dispatch({ type: 'end' })}>{copy.endRest}</TimerActionButton>
            : <button type="button" className="text-action" disabled={!canEdit} onClick={e => show('end', e.currentTarget)}>{uiText('UI05')}</button>)}
        </div>

        <div className="fp-note" aria-label="想法与保存状态">
          {pending ? <>{copy.pending}{!panel && <button type="button" className="text-action" onClick={() => dispatch({ type: 'retrySave' })}>{copy.retry}</button>}</>
            : noteStatus ? <>{noteStatus.text}
              {thoughts.latestMarkerId && <button type="button" className="text-action" disabled={!canEdit}
                onClick={e => edit(thoughts.latestMarkerId!, e.currentTarget)}>{copy.supplement}</button>}
              {thoughts.undo && <button type="button" className="text-action" disabled={!canEdit} onClick={thoughts.undo.run}>{thoughts.undo.label}</button>}
            </>
            : saveState === 'memory-only' ? copy.memoryOnly : saveState === 'read-only' ? '只读：这里的更改不会保存' : null}
        </div>
      </div>
    </section>
  )
}
