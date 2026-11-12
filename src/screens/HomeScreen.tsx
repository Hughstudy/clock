import { focusCopy as copy } from '../data/focus-copy'
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react'
import { EncouragementReader } from '../components/EncouragementReader'
import { DurationRuler } from '../components/DurationRuler'
import { ShortCompanionMessage } from '../components/ShortCompanionMessage'
import { FocusPanel } from '../components/FocusPanel'
import { ConfirmPopover } from '../components/ConfirmPopover'
import { formatClock, formatElapsedParts, formatMinutes, PHASE_LABELS, spokenClock } from '../components/format'
import { ThoughtPanel } from '../components/ThoughtPanel'
import { TimerActionButton } from '../components/TimerActionButton'
import { BlueCompanion } from '../components/companion/BlueCompanion'
import { CompanionFeedback } from '../components/companion/CompanionFeedback'
import { sceneSettingFor } from '../components/companion/CompanionScenery'
import { useSceneLight } from '../hooks/companion/useSceneLight'
import type { SaveState, Thought } from '../contracts/focus'
import type { QuoteFavoritesController } from '../contracts/favorites'
import { uiText } from '../data/ui-copy'
import type { useFeedback } from '../hooks/useFeedback'
import { useDurationChoice, validateDurationDraft } from '../hooks/useDurationChoice'
import { useFocusTaskBack } from '../hooks/useFocusTaskBack'
import { useFocusChrome } from '../hooks/useFocusChrome'
import { useFocusLayout } from '../hooks/useFocusLayout'
import { useSceneFit } from '../hooks/useSceneFit'
import { spec } from '../data/spec'
import type { SessionResult, UserAction } from '../hooks/useClockApp'
import type { Thoughts } from '../hooks/useThoughts'
import type { TimerView } from '../hooks/useViews'

type Panel = 'duration' | 'end' | 'thought' | 'thoughts' | 'encouragement' | 'message' | 'status' | null
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
  timerPending?: boolean
  favorites?: QuoteFavoritesController
  onTaskChange?: (busy: boolean) => void
  systemNoticeSummary?: string | null
  systemNotices?: ReactNode
  dispatch: (action: UserAction) => void
  onSettings: () => void
}

const titles = { duration: copy.durationTitle, end: copy.endQuestion, thought: copy.write,
  thoughts: copy.sessionThoughts, encouragement: copy.encouragementTitle, message: copy.encouragementTitle, status: copy.statusTitle }

/**
 * The companion's scene fills the screen; one cream plate below it carries the
 * time, the choices for this moment and grouped timer controls. Input, reading,
 * confirmation and data details share one local task surface.
 */
export function HomeScreen({ active, view, result, linkedThoughts, defaultsIntent, companion, thoughts,
  reducedMotion, canEdit, saveState, timerPending = false, favorites, onTaskChange, systemNoticeSummary = null, systemNotices, dispatch, onSettings }: Props) {
  const [task, setTask] = useState<Panel>(null)
  const choice = useDurationChoice(defaultsIntent)
  const [restChoice, setRestChoice] = useState<RestPhase | null>(null)
  const [step, setStep] = useState('')
  const [editingStep, setEditingStep] = useState(false)
  const [draft, setDraft] = useState('')
  const [message, setMessage] = useState('')
  const confirming = useRef<string | null>(null)
  const submittedStep = useRef<string | null>(null)
  const sceneBox = useRef<HTMLDivElement>(null)
  const voiceBox = useRef<HTMLDivElement>(null)
  const voiceButton = useRef<HTMLButtonElement>(null)
  const primaryRef = useRef<HTMLDivElement>(null)
  const markButton = useRef<HTMLButtonElement>(null)
  const returnToStepButton = useRef(false)
  const stepBeforeEdit = useRef('')
  const composingStep = useRef(false)
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
  const frame = companion.feedback.frame
  const requested = frame.placement === 'requested' ? frame.encouragement : null
  // A temporary editor or confirmation covers requested speech. The feedback owner keeps its
  // exact phrase until it is explicitly dismissed, so returning never draws another quote.
  const panel = active ? (thoughts.open ? 'thought' : task ?? (requested ? 'encouragement' : null)) : null
  const reading = panel === 'encouragement'
  const stepTooLong = Array.from(step).length > view.stepMaxLength
  const scene = panel && companion.scene?.allowBeats ? { ...companion.scene, allowBeats: false } : companion.scene
  const confirmExpired = task === 'end' && confirming.current !== view.sessionId
  useEffect(() => { onTaskChange?.((!!panel && panel !== 'status') || thoughts.open || editingStep || !!step.trim()) }, [panel, thoughts.open, editingStep, step, onTaskChange])
  useEffect(() => () => onTaskChange?.(false), [onTaskChange])

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

  useLayoutEffect(() => {
    const returning = previousPanel.current !== panel && (!panel || panel === 'encouragement')
    if (active && previousPanel.current && returning) {
      const prior = previousPanel.current === 'encouragement' ? voiceButton.current : opener.current
      const speechTask = previousPanel.current === 'message' || previousPanel.current === 'encouragement'
      const fallback = speechTask ? voiceButton.current : null
      const target = prior?.isConnected && !prior.matches(':disabled') && prior.getClientRects().length
        ? prior : fallback ?? primaryRef.current?.querySelector<HTMLButtonElement>('button')
      target?.focus({ preventScroll: true })
    }
    previousPanel.current = panel
  }, [active, panel])

  const show = (next: Exclude<Panel, null>, target: HTMLElement) => {
    if (next !== 'thought' && thoughts.open) {
      if (thoughts.conflict) return
      thoughts.setOpen(false)
    }
    opener.current = target
    if (next !== 'encouragement' && !requested) companion.dismiss()
    if (next === 'thought') {
      setTask(null)
      if (thoughts.hasDraft) thoughts.writeAnother()
      thoughts.openNew()
      return
    }
    if (next === 'end') confirming.current = view.sessionId
    if (next === 'duration') setDraft(String(focusMinutes))
    if (next === 'encouragement') companion.request()
    setTask(next === 'encouragement' ? null : next)
  }
  const close = () => {
    if (panel === 'thought') thoughts.setOpen(false)
    if (panel === 'encouragement') companion.dismiss()
    setTask(null)
  }
  useFocusTaskBack(!!panel, close, panel ?? '')
  const readableLayout = useFocusLayout(sceneBox)
  useSceneFit(sceneBox, companion.sceneryEnabled)
  useLayoutEffect(() => {
    if (panel !== 'end' || !confirmExpired) return
    const element = document.querySelector<HTMLElement>('.fp-confirm')
    // Retire the old confirmation without stealing focus from another task or
    // navigation. A removed confirmation leaves focus on the document body.
    if (document.activeElement === document.body || element?.contains(document.activeElement)) {
      element?.querySelector<HTMLButtonElement>('.fp-confirm__cancel')?.focus({ preventScroll: true })
    }
  }, [panel, confirmExpired])

  // An undo button goes once it works, so a keyboard moves to the panel's close button first.
  const keepPanelFocus = (event: MouseEvent<HTMLElement>) => {
    if (event.detail === 0) event.currentTarget.closest('.focus-panel')?.querySelector<HTMLElement>('.focus-panel__header button')?.focus({ preventScroll: true })
  }
  const pick = choice.pick
  const startFocus = (minutes: number) => {
    if (stepTooLong) return
    submittedStep.current = step.trim() ? step : null
    dispatch({ type: 'startFocus', step, durationMinutes: minutes })
  }
  const startRest = () => dispatch({ type: 'startBreak', phase: restPhase })
  const toggle = () => dispatch({ type: paused ? 'resume' : 'pause' })
  const edit = (id: string, target?: HTMLElement) => {
    if (target) opener.current = target
    setTask(null)
    if (!requested) companion.dismiss()
    thoughts.edit(id)
  }

  const identity = [view.sessionId ?? 'ready', view.phase, view.status, ended?.sessionId, preparingRest].join('/')
  const primary = !ready
    ? { label: paused ? (view.isBreak ? copy.resumeRest : copy.resumeFocus) : (view.isBreak ? copy.pauseRest : copy.pauseFocus), run: toggle }
    : focusResult ? { label: copy.startRest, run: startRest }
    : preparingRest ? { label: copy.startRest, run: startRest }
    : { label: copy.startFocus, run: () => startFocus(focusMinutes) }

  // A finished session reads as what was done (25 分钟), never as a timer waiting to start (25:00).
  const digits: ReactNode = focusResult
    ? <span key={focusResult.sessionId} className="fp-result">{formatElapsedParts(focusResult.elapsedMs).map(part =>
        <span key={part.unit}>{part.value}<span className="fp-unit">{part.unit}</span></span>)}</span>
    : ready ? formatClock((preparingRest ? restMinutes : focusMinutes) * 60000) : formatClock(view.remainingMs)
  const tone = focusResult ? 'done' : paused ? 'paused' : isRest ? 'rest' : 'focus'

  const duration = validateDurationDraft(draft, view.focusMinutesRange.min, view.focusMinutesRange.max)
  const pickerAvailable = active && readyFocus && canEdit && !timerPending
  useEffect(() => { if (!pickerAvailable && task === 'duration') setTask(null) }, [task, pickerAvailable])

  // The companion's passing line steps aside while a local panel has the space.
  const spoken = frame.placement !== 'requested' && !panel ? frame.encouragement : null
  const noteStatus = thoughts.status
  const pending = saveState === 'pending'
  const needsAttention = pending || noteStatus?.kind === 'error' || !!systemNoticeSummary || saveState === 'memory-only' || saveState === 'read-only'
  const chrome = useFocusChrome({ sessionKey: view.sessionId, running: view.status === 'running' && !timerPending, timings: spec.focusChrome,
    // A mark's undo lasts all session and waits in the card. Only its short confirmation holds it.
    held: !active || readableLayout || !!panel || needsAttention || !!noteStatus })
  const focusPrimaryOnReturn = useRef(false)
  useLayoutEffect(() => {
    if (chrome.away || !focusPrimaryOnReturn.current) return
    focusPrimaryOnReturn.current = false
    primaryRef.current?.querySelector('button')?.focus({ preventScroll: true })
  }, [chrome.away])
  const awayAttrs = chrome.away ? { inert: '' } : {}
  const noteText = pending ? copy.pending : noteStatus?.text ?? (saveState === 'memory-only' ? copy.memoryOnly : saveState === 'read-only' ? '当前只读' : systemNoticeSummary ?? '')
  const timerSummary = ready ? focusResult ? `${copy.focusElapsed} ${formatMinutes(focusResult.elapsedMs)}` : preparingRest ? `准备休息 · ${restMinutes} 分钟` : `准备专注 · ${focusMinutes} 分钟`
    : `${PHASE_LABELS[view.phase]} · ${paused ? copy.paused : copy.running} · 剩余 ${formatClock(view.remainingMs)}`
  const statusLine = focusResult
    ? `${copy.focusElapsed} ${formatMinutes(focusResult.elapsedMs)} · ${focusResult.saved ? copy.savedRecord : copy.unsavedRecord}`
    : preparingRest ? `${PHASE_LABELS[restPhase]} · ${copy.ready}`
    : ready ? null
    : `${PHASE_LABELS[view.phase]} · ${paused ? copy.paused : copy.running}${view.isBreak ? '' : ` · ${copy.target(Math.round(view.totalMs / 60000))}`}`

  const setting = companion.sceneryEnabled ? sceneSettingFor(scene?.id) : 'plain'
  const light = useSceneLight(setting === 'plain' ? null : setting, view.night)


  const noteRow = (
    <div key="note" className="fp-note" aria-label="想法与保存状态" data-status-actions
          hidden={!noteText && !thoughts.hasDraft && !thoughts.latestMarkerId && !thoughts.undo && !needsAttention}>
          <span className="fp-note__text">{noteText}</span>
          {thoughts.hasDraft && <button type="button" className="text-action" onClick={event => {
            opener.current = event.currentTarget
            if (!requested) companion.dismiss()
            setTask(null)
            thoughts.openNew()
          }}>{copy.resumeDraft}</button>}
          {thoughts.latestMarkerId && <button type="button" className="text-action" disabled={!canEdit}
            onClick={event => edit(thoughts.latestMarkerId!, event.currentTarget)}>{copy.supplement}</button>}
          {thoughts.undo && <button type="button" className="text-action" disabled={!canEdit} onClick={event => {
            const undo = thoughts.undo!
            undo.run()
            // The restore button goes once it works; keep keyboard focus on the tool it came from.
            if (undo.removesItself && event.detail === 0) markButton.current?.focus()
          }}>{thoughts.undo.label}</button>}
          {needsAttention && <button type="button" className="text-action"
            aria-label={copy.statusDetails} onClick={event => show('status', event.currentTarget)}>详情</button>}
        </div>
  )
  const voiceRow = <div key="voice" ref={voiceBox} className="fp-voice-slot" />
  const stepLabel = uiText('UI10')
  const finishStep = () => {
    returnToStepButton.current = true
    setEditingStep(false)
  }
  const stepControl = editingStep
    ? <form className="fp-step-editor"
        onSubmit={event => { event.preventDefault(); if (!stepTooLong && !composingStep.current) finishStep() }}
        onBlur={event => { if (!stepTooLong && !event.currentTarget.contains(event.relatedTarget)) setEditingStep(false) }}
        onKeyDown={event => {
          if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return
          if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            setStep(stepBeforeEdit.current)
            finishStep()
          }
        }}>
        <label htmlFor="fp-step-input">{stepLabel}</label>
        <input id="fp-step-input" className="fp-step-input" value={step} autoFocus enterKeyHint="done"
          aria-invalid={stepTooLong} aria-describedby={stepTooLong ? 'step-error' : undefined} disabled={!canEdit}
          onChange={event => setStep(event.target.value)}
          onCompositionStart={() => { composingStep.current = true }}
          onCompositionEnd={() => { composingStep.current = false }} />
        <button type="submit" className="fp-step-done" disabled={!canEdit || stepTooLong}>{copy.stepDone}</button>
      </form>
    : <button type="button" className="text-action fp-step-open" disabled={!canEdit} aria-describedby={stepTooLong ? 'step-error' : undefined}
        aria-label={step.trim() ? `编辑这一步：${step.trim()}` : undefined}
        ref={button => {
          if (button && returnToStepButton.current) {
            returnToStepButton.current = false
            button.focus({ preventScroll: true })
          }
        }} onClick={() => { stepBeforeEdit.current = step; composingStep.current = false; setEditingStep(true) }}>
        <span>{step.trim() || stepLabel}</span>
        <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6"
          strokeLinecap="round" strokeLinejoin="round"><path d="m5 15-1 5 5-1L20 8l-4-4zM14 6l4 4"/></svg>
      </button>
  const stepError = readyFocus && stepTooLong && <span id="step-error" className="fp-hint--error">请缩短到 {view.stepMaxLength} 字以内</span>
  const statusRow = (
    <div key="status" className="fp-status" data-step-details={readyFocus && (!!restEnded || (readableLayout && stepTooLong))} data-running={!ready}>
          {readyFocus && restEnded && <span>{copy.restElapsed} {formatMinutes(restEnded.elapsedMs)}</span>}
          {readyFocus ? readableLayout && stepControl
            : <span>{statusLine}{!ready && !view.isBreak && view.step && <span className="fp-current-step" title={view.step}> · {copy.stepPrefix}{view.step}</span>}</span>}
          {(preparingRest || focusResult) && <select className="fp-rest-choice" aria-label="休息时长" value={restPhase}
            disabled={!canEdit || timerPending} onChange={e => setRestChoice(e.target.value === 'longBreak' ? 'longBreak' : 'shortBreak')}>
            {(['shortBreak', 'longBreak'] as const).map(phase => <option key={phase} value={phase}>
              {PHASE_LABELS[phase]} {phase === 'shortBreak' ? view.shortBreakMinutes : view.longBreakMinutes} 分钟</option>)}
          </select>}
          {readableLayout && stepError}
        </div>
  )
  const controlsRow = (
    <div key="controls" className="fp-controls" role="group" aria-label="计时控制">
          <div className="fp-primary" ref={primaryRef}>
            <TimerActionButton identity={readyFocus ? identity + '/' + focusMinutes : identity} primary disabled={!canEdit || (readyFocus && stepTooLong)} busy={timerPending} onActivate={primary.run}>
              {timerPending ? '正在处理…' : primary.label}</TimerActionButton>
          </div>
          <div className="fp-control-secondary">
            {focusResult ? <TimerActionButton identity={identity + 'prepareFocus'} className="pill pill--soft" disabled={!canEdit} busy={timerPending}
              onActivate={() => dispatch({ type: 'prepare', phase: 'focus' })}>{copy.prepareFocus}</TimerActionButton>
              : !ready ? view.isBreak
                ? <TimerActionButton identity={identity + 'end'} className="pill pill--soft" disabled={!canEdit} busy={timerPending} onActivate={() => dispatch({ type: 'end' })}>{copy.endRest}</TimerActionButton>
                : <button type="button" className="pill pill--soft" disabled={!canEdit} aria-disabled={timerPending}
                  onClick={event => { if (!timerPending) show('end', event.currentTarget) }}>{uiText('UI05')}</button>
              : <TimerActionButton identity={identity + 'prepareMode'} className="pill pill--soft" disabled={!canEdit} busy={timerPending}
                onActivate={() => dispatch({ type: 'prepare', phase: preparingRest ? 'focus' : restPhase })}>{preparingRest ? copy.focusMode : copy.restMode}</TimerActionButton>}
          </div>
        </div>
  )
  const toolsRow = (
    <div key="tools" className="fp-tools-slot">
          <div className="fp-thought-tools" role="group" aria-label="鼓励与想法工具">
            <button ref={voiceButton} type="button" className="text-action fp-voice-open" aria-pressed={reading}
              aria-controls={reading ? 'focus-requested-quote' : undefined} aria-description={reading ? '再次轻点收起鼓励' : undefined}
              onClick={event => { if (reading) close(); else show('encouragement', event.currentTarget) }}>
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M20 11a8 8 0 0 1-8 8c-1.4 0-2.7-.3-3.8-.9L4 20l1.3-4A8 8 0 1 1 20 11Z"/></svg>{uiText('UI19')}</button>
            <button ref={markButton} type="button" className="text-action" disabled={!canEdit}
              onClick={thoughts.mark} onKeyDown={e => { if (e.repeat && (e.key === 'Enter' || e.key === ' ')) e.preventDefault() }}>
              <svg width="16" height="16" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 4h12v16l-6-4-6 4zM9 9h6m-3-3v6"/></svg>{copy.mark}</button>
            <button type="button" className="text-action" disabled={!canEdit} onClick={e => show('thought', e.currentTarget)}>
              <svg width="16" height="16" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="m5 15-1 5 5-1L20 8l-4-4zM14 6l4 4"/></svg>{copy.write}</button>
            {/* The grid reserves this slot even when empty, so a save never moves either thought tool. */}
            {!!linkedThoughts.length && <button type="button" className="text-action fp-tools-label" aria-label={`${copy.sessionThoughts}（${linkedThoughts.length}）`}
              title={`${copy.sessionThoughts}（${linkedThoughts.length}）`} onClick={event => show('thoughts', event.currentTarget)}>
              <svg width="16" height="16" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M7 4h10a2 2 0 0 1 2 2v14l-3-2-4 2-4-2-3 2V6a2 2 0 0 1 2-2zM9 9h6M9 13h4"/></svg>
              <span className="fp-tools-count">{linkedThoughts.length > 99 ? '99+' : linkedThoughts.length}</span></button>}
          </div>
        </div>
  )
  return (
    <section className="screen home" style={light ? { '--sky': light.sky, '--floor': light.floor } as CSSProperties : undefined} data-tone={tone} data-setting={setting} data-sky-ink={light?.skyInk ?? 'default'} data-panel={panel ?? ''} data-ready-focus={readyFocus} data-chrome={chrome.away ? 'away' : 'shown'} data-arriving={chrome.arriving} aria-label="专注计时">
      {/* While the card is away, a tap on the room brings it back. A pat on the companion stays a pat. */}
      <div ref={sceneBox} className="fp-scene" data-setting={setting} data-chrome={chrome.away ? 'away' : 'shown'}
        onClick={event => { if (chrome.away && !(event.target as Element).closest('[data-touch-kind]')) chrome.callOut() }}>
        <div className="fp-top" {...awayAttrs}>
          <h1>专注</h1>
          <button type="button" className="pill pill--glass pill--icon" onClick={onSettings} aria-label="设置">
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M5 4v16M12 4v16M19 4v16"/><path d="M2 8h6M9 15h6M16 9h6" strokeWidth="3.4"/></svg>
          </button>
        </div>
        <div className="fp-speech-reserve" aria-hidden="true" />
        {reading && requested && <EncouragementReader quote={requested} canEdit={canEdit} readable={readableLayout}
          voiceRef={voiceBox} {...(favorites ? { favorites } : {})} onNext={companion.next} onChoose={companion.request} onClose={close} />}
        {spoken && <ShortCompanionMessage voiceRef={voiceBox} text={spoken.text} onRead={target => { setMessage(spoken.text); show('message', target) }} />}
        <div className="fp-art">
          <CompanionFeedback feedback={companion.feedback} reducedMotion={reducedMotion} renderCharacter={(presentation, keyboardPat) =>
              <BlueCompanion presentation={presentation} keyboardPat={keyboardPat} cueId={companion.cue?.id} scene={scene}
                panelOpen={!!panel} sceneryEnabled={companion.sceneryEnabled} night={view.night}
                focusTime={!ready && !view.isBreak ? { elapsedMs: view.totalMs - view.remainingMs, totalMs: view.totalMs } : undefined} />} />
        </div>
        <span aria-hidden="true" className="fp-clock-phase">{focusResult ? copy.focusEndedTitle : ready ? (isRest ? '准备休息' : copy.prepareFocus) : paused ? copy.paused : isRest ? '休息中' : '专注中'}{!ready && !view.isBreak && ` · ${copy.target(Math.round(view.totalMs / 60000))}`}</span>
        <p className="fp-digits" {...(ready ? {} : { role: 'timer', 'aria-label': `${PHASE_LABELS[view.phase]}还剩${spokenClock(view.remainingMs)}` })}>
          {readyFocus ? <button type="button" className="fp-clock-trigger" aria-label={`调整专注时长，当前 ${focusMinutes} 分钟`}
            disabled={!pickerAvailable} tabIndex={panel === 'duration' ? -1 : undefined} aria-haspopup="dialog" aria-expanded={panel === 'duration'}
            onClick={event => { if (panel !== 'duration') show('duration', event.currentTarget) }}>{panel === 'duration' && duration.ok ? formatClock(duration.minutes * 60000) : digits}
              {panel !== 'duration' && <svg className="fp-clock-edit" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m5 15-1 5 5-1L20 8l-4-4zM14 6l4 4"/></svg>}</button> : digits}
        </p>
        {!readableLayout && <div className="fp-step" data-step-details={readyFocus && (editingStep || stepTooLong)}>
          {readyFocus ? <>{stepControl}{stepError}</>
            : !ready && !view.isBreak && view.step && <p aria-hidden="true" className="fp-step__current" title={view.step}>{copy.stepPrefix}{view.step}</p>}
        </div>}
        {panel && panel !== 'duration' && panel !== 'encouragement' && panel !== 'end' && <FocusPanel key={panel} title={titles[panel]} onClose={close} timerSummary={timerSummary}
          closeLabel={!ready && !view.isBreak ? uiText(view.step ? 'UI16' : 'UI17') : '返回'}>
          {panel === 'message' && <p className="fp-full-message" tabIndex={-1} data-initial-focus>{message}</p>}
          {panel === 'thoughts' && <ul className="fp-session-list">{linkedThoughts.map((note, index) => <li key={note.id} data-thought-id={note.id}>
            <p>{note.text || `标记 ${index + 1}`}{thoughts.pendingIds.has(note.id) && <span> · 更改待确认</span>}</p>
            <button type="button" className="pill pill--soft" disabled={!canEdit || thoughts.pendingIds.has(note.id)} onClick={event => edit(note.id, event.currentTarget)}>
              {note.text ? copy.edit : copy.supplement}</button>
          </li>)}</ul>}
          {panel === 'thought' && <>
            {!!linkedThoughts.length && !thoughts.isExisting && <details className="fp-linked">
              <summary>{copy.sessionThoughts}（{linkedThoughts.length}）</summary>
              <ul>{linkedThoughts.map((note, index) => <li key={note.id} data-thought-id={note.id}><span>{note.text || `标记 ${index + 1}`}</span>
                <button type="button" className="text-action" disabled={!canEdit || thoughts.pendingIds.has(note.id)} onClick={e => edit(note.id, e.currentTarget)}>
                  {note.text ? copy.edit : copy.supplement}</button></li>)}</ul>
            </details>}
            <ThoughtPanel thoughts={thoughts} canEdit={canEdit} />
          </>}
          {panel === 'status' && <div className="fp-save-details" data-status-actions>
            <p tabIndex={-1} data-initial-focus>{pending ? copy.pending : noteStatus?.text ?? (saveState === 'memory-only' ? '本次更改仅保留在当前页面，关闭后可能丢失。' : saveState === 'read-only' ? '当前数据暂时无法写入。' : '当前没有待处理的保存问题。')}</p>
            {thoughts.latestMarkerId && <button type="button" className="pill pill--soft" disabled={!canEdit}
              onClick={event => edit(thoughts.latestMarkerId!, event.currentTarget)}>{copy.supplement}</button>}
            {thoughts.undo && thoughts.latestMarkerId && <button type="button" className="pill pill--soft" disabled={!canEdit} onClick={event => { keepPanelFocus(event); thoughts.undo!.run() }}>{thoughts.undo.label}</button>}
            {thoughts.undos.map(undo => <button key={undo.id} type="button" className="pill pill--soft"
              disabled={!canEdit || thoughts.pendingIds.has(undo.id)} onClick={event => { keepPanelFocus(event); undo.run() }}>{undo.label}</button>)}
            {systemNotices}
          </div>}
          {pending && <p className="fp-hint fp-hint--error">{copy.pending}
            <button type="button" className="text-action" onClick={() => dispatch({ type: 'retrySave' })}>{copy.retry}</button></p>}
        </FocusPanel>}
      </div>

      {panel === 'end' && <ConfirmPopover title={titles.end} anchor={opener.current} cancelLabel={copy.cancelEnd} summary={timerSummary}
        readout={sceneBox.current?.querySelector('.fp-digits') ?? null} onCancel={close}>
        <p data-initial-focus tabIndex={-1}>{confirmExpired ? copy.endExpired : copy.endExplanation}</p>
        {!confirmExpired && <TimerActionButton identity={identity + 'confirm'} className="pill fp-confirm__action" disabled={!canEdit} busy={timerPending}
          onActivate={() => { if (confirming.current === view.sessionId) dispatch({ type: 'end' }); close() }}>{copy.confirmEnd}</TimerActionButton>}
        {pending && <p className="fp-hint fp-hint--error">{copy.pending}
          <button type="button" className="text-action" onClick={() => dispatch({ type: 'retrySave' })}>{copy.retry}</button></p>}
      </ConfirmPopover>}
      <div className="fp-plate" data-panel={panel ?? ''} data-attention={needsAttention} {...awayAttrs}>
        {panel === 'duration' && pickerAvailable && <FocusPanel title={titles.duration} placement="plate" timerSummary={timerSummary}
          onClose={close} closeLabel={copy.cancel}>
          <DurationRuler draft={draft} minutes={focusMinutes} {...view.focusMinutesRange}
            onChange={setDraft} onApply={value => { pick(value); close() }} />
          {pending && <p className="fp-hint fp-hint--error">{copy.pending}
            <button type="button" className="text-action" onClick={() => dispatch({ type: 'retrySave' })}>{copy.retry}</button></p>}
        </FocusPanel>}
        {readableLayout ? [statusRow, controlsRow, toolsRow, noteRow, voiceRow] : [noteRow, voiceRow, statusRow, controlsRow, toolsRow]}

      </div>
      {chrome.away && <>
        {view.handleHint && <p className="fp-handle-hint">{copy.handleHint}</p>}
        <button type="button" className="fp-handle" aria-label={copy.showControls}
          onClick={event => { focusPrimaryOnReturn.current = event.detail === 0; chrome.callOut() }} />
      </>}
    </section>
  )
}
