import { focusCopy as copy } from '../data/focus-copy'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ClockBadge } from '../components/ClockBadge'
import { FocusTaskDialog } from '../components/FocusTaskDialog'
import { formatClock, formatMinutes, PHASE_LABELS } from '../components/format'
import { ThoughtPanel } from '../components/ThoughtPanel'
import { TimerActionButton } from '../components/TimerActionButton'
import { BlueCompanion } from '../components/companion/BlueCompanion'
import { CompanionFeedback } from '../components/companion/CompanionFeedback'
import type { SaveState, Thought } from '../contracts/focus'
import { uiText } from '../data/ui-copy'
import type { useFeedback } from '../hooks/companion/useFeedback'
import { useFocusTaskBack } from '../hooks/useFocusTaskBack'
import type { SessionResult, UserAction } from '../hooks/useClockApp'
import type { Thoughts } from '../hooks/useThoughts'
import type { TimerView } from '../hooks/useViews'

type Panel = 'duration' | 'step' | 'end' | 'thought' | 'list' | 'encouragement' | null

interface Props {
  active: boolean
  view: TimerView
  result: SessionResult | null
  linkedThoughts: readonly Thought[]
  durationResetKey: number | string
  entryLayout?: 'console' | 'cards'
  companion: ReturnType<typeof useFeedback>
  thoughts: Thoughts
  reducedMotion: boolean
  canEdit: boolean
  saveState: SaveState
  dispatch: (action: UserAction) => void
}

const titles = {
  duration: copy.selectDuration, step: uiText('UI10'), end: uiText('UI05'), thought: copy.write,
  list: copy.sessionThoughts, encouragement: uiText('UI19'),
}

export function HomeScreen({ active, view, result, linkedThoughts, durationResetKey, entryLayout = 'console',
  companion, thoughts, reducedMotion, canEdit, saveState, dispatch }: Props) {
  const [task, setTask] = useState<Panel>(null)
  const [choice, setChoice] = useState<number | null>(null)
  const [cardRestPhase, setCardRestPhase] = useState<'shortBreak' | 'longBreak'>('shortBreak')
  const [cardAdjustingRest, setCardAdjustingRest] = useState(false)
  const [step, setStep] = useState('')
  const confirming = useRef<string | null>(null)
  const submittedStep = useRef<string | null>(null)
  const controls = useRef<HTMLDivElement>(null)
  const resultFact = useRef<HTMLParagraphElement>(null)
  const opener = useRef<HTMLElement | null>(null)
  const previousPanel = useRef<Panel>(null)
  const ready = view.status === 'ready'
  const ended = ready ? result : null
  const preparingRest = ready && view.isBreak
  const cards = entryLayout === 'cards' && ready && !ended && !preparingRest
  const restPhase = cards ? cardRestPhase : view.phase === 'longBreak' ? 'longBreak' : 'shortBreak'
  const restMinutes = restPhase === 'longBreak' ? view.longBreakMinutes : view.shortBreakMinutes
  const focusMinutes = choice ?? view.nextFocusMinutes
  const isRest = ended ? ended.phase === 'rest' : ready ? preparingRest : view.isBreak
  const minutes = preparingRest ? restMinutes : focusMinutes
  const label = isRest ? PHASE_LABELS[ready ? restPhase : view.phase] : PHASE_LABELS.focus
  const status = ended ? (ended.saved ? copy.finished : copy.finishedUnsaved)
    : ready ? '准备好了' : view.status === 'paused' ? '已暂停' : isRest ? '休息中' : '专注中'
  const panel = active ? (thoughts.open ? 'thought' : task) : null
  const stepTooLong = Array.from(step).length > view.stepMaxLength
  const scene = panel && companion.scene?.allowBeats ? { ...companion.scene, allowBeats: false } : companion.scene

  useEffect(() => { setChoice(null) }, [durationResetKey])
  useEffect(() => {
    if (!view.sessionId) return
    setChoice(null)
    setCardRestPhase('shortBreak')
    if (task === 'duration' || task === 'step') setTask(null)
  }, [view.sessionId])
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
        ? prior : resultFact.current ?? controls.current?.querySelector<HTMLButtonElement>('.btn-primary')
      target?.focus({ preventScroll: true })
    }
    previousPanel.current = panel
  }, [active, panel])

  const show = (next: Exclude<Panel, null>, target: HTMLElement) => {
    opener.current = target
    if (next === 'thought') { setTask(null); thoughts.openNew(); return }
    if (next === 'end') confirming.current = view.sessionId
    if (next === 'encouragement') companion.request()
    setTask(next)
  }
  const close = () => {
    if (panel === 'thought') thoughts.setOpen(false)
    if (panel === 'encouragement') companion.dismiss()
    setTask(null)
  }
  useFocusTaskBack(!!panel, close)
  const prepare = (next: 'focus' | 'rest', phase: 'shortBreak' | 'longBreak' = restPhase) => {
    dispatch({ type: 'prepare', phase: next === 'focus' ? 'focus' : phase })
  }
  const startFocus = (duration: number | null) => {
    if (stepTooLong) return
    submittedStep.current = step.replace(/\s+/g, ' ').trim() || null
    dispatch({ type: 'startFocus', step, ...(duration === null ? {} : { durationMinutes: duration }) })
  }
  const startRest = () => dispatch({ type: 'startBreak', phase: restPhase })
  const identity = [view.sessionId ?? 'ready', view.phase, view.status, ended?.sessionId, preparingRest, minutes].join('/')
  const paused = view.status === 'paused'
  const activeCommand = () => dispatch({ type: paused ? 'resume' : 'pause' })
  const activeLabel = paused ? (view.isBreak ? copy.resumeRest : uiText('UI04')) : (view.isBreak ? copy.pauseRest : uiText('UI03'))
  const restLabel = copy.startRest(restMinutes)
  const primaryLabel = !ready ? activeLabel : ended?.phase === 'focus' || (preparingRest && !ended) ? restLabel
    : ended ? copy.focusReady : copy.startFocus(focusMinutes)
  const primary = () => {
    if (!ready) activeCommand()
    else if (ended?.phase === 'focus') startRest()
    else if (ended) prepare('focus')
    else if (preparingRest) startRest()
    else startFocus(choice)
  }
  const edit = (id: string, target?: HTMLElement) => {
    if (target) opener.current = target
    setTask(null)
    thoughts.edit(id)
  }
  const pending = saveState === 'pending'
  const retry = <button type="button" className="link-button" onClick={() => dispatch({ type: 'retrySave' })}>{copy.retry}</button>
  const frame = companion.feedback.frame
  const requested = frame.placement === 'requested' ? frame.encouragement : null
  const lastPhrase = useRef(requested)
  if (requested) lastPhrase.current = requested
  const phrase = requested ?? lastPhrase.current
  const noteStatus = thoughts.status

  return (
    <section className={`screen home ${isRest ? 'is-break' : 'is-focus'}`} aria-label="专注计时">
      <div className="stage">
        <ClockBadge label={label} status={status} ended={!!ended} remainingMs={ended?.elapsedMs ?? (ready ? minutes * 60000 : view.remainingMs)}
          progress={ended ? 0 : ready ? 1 : view.progress} running={view.status === 'running'} />
        <CompanionFeedback feedback={companion.feedback} compact reducedMotion={reducedMotion} motionEnabled={!reducedMotion}
          quietStatus announce={false} renderCharacter={(presentation, keyboardPat) =>
            <BlueCompanion presentation={presentation} keyboardPat={keyboardPat} cueId={companion.cue?.id} scene={scene}
              panelOpen={!!panel} sceneryEnabled={companion.sceneryEnabled} />} />
        <button type="button" className="support-entry" onClick={e => show('encouragement', e.currentTarget)}>{uiText('UI19')}</button>
      </div>
      <div className="step-slot">
        {ended ? <p ref={resultFact} tabIndex={-1} className="session-step">{ended.phase === 'focus' ? copy.focusElapsed : copy.restElapsed} {formatMinutes(ended.elapsedMs)}
          {ended.phase === 'focus' && (ended.saved ? ` · ${copy.savedRecord}` : ` · ${copy.unsavedRecord}`)}</p>
          : ready && !preparingRest ? <button type="button" className="step-toggle step-preview" disabled={!canEdit} onClick={e => show('step', e.currentTarget)}>
            {step ? `编辑这一小步 · ${step}` : '＋ 这一小步'}</button>
          : view.step ? <button type="button" className="step-toggle step-preview" onClick={e => show('step', e.currentTarget)}>
            {uiText('UI10')} · {view.step}</button> : null}
      </div>
      <div className="controls" ref={controls}>
        <div className={cards ? 'primary-row action-cards' : 'primary-row'}>
          <TimerActionButton identity={identity} primary disabled={!canEdit || (ready && !ended && !preparingRest && stepTooLong)} onActivate={primary}
            label={primaryLabel}>
            {cards ? <span className="card-action-label"><span>开始专注</span><small>{focusMinutes} 分钟</small></span> : primaryLabel}
          </TimerActionButton>
          {cards && <TimerActionButton identity={identity+'rest'+restPhase} disabled={!canEdit} onActivate={startRest} label={restLabel}>
            <span className="card-action-label"><span>开始休息</span><small>{restMinutes} 分钟</small></span>
          </TimerActionButton>}
        </div>
        <div className="controls-secondary">
          {ready && !ended && <>
            <button type="button" className="btn btn-secondary" onClick={e => { setCardAdjustingRest(false); show('duration', e.currentTarget) }}
              disabled={!canEdit}>{cards ? '选专注时长' : copy.selectDuration}</button>
            {cards && <button type="button" className="btn btn-secondary" onClick={e => { setCardAdjustingRest(true); show('duration', e.currentTarget) }}
              disabled={!canEdit}>选休息时长</button>}
            {!preparingRest && focusMinutes !== view.quickFocusMinutes && <TimerActionButton identity={identity+'quick'} disabled={!canEdit || stepTooLong}
              onActivate={() => startFocus(view.quickFocusMinutes)}>{copy.quickStart(view.quickFocusMinutes)}</TimerActionButton>}
            {!cards && <button type="button" className="btn btn-secondary" disabled={!canEdit} onClick={() => prepare(preparingRest ? 'focus' : 'rest')}>
              {preparingRest ? copy.focusMode : copy.restMode}</button>}
          </>}
          {!ready && (view.isBreak ? <TimerActionButton identity={identity+'end'} disabled={!canEdit} onActivate={() => dispatch({ type: 'end' })}>{copy.endRest}</TimerActionButton>
            : <button type="button" className="btn btn-secondary" disabled={!canEdit} onClick={e => show('end', e.currentTarget)}>{uiText('UI05')}</button>)}
          {ended?.phase === 'focus' && <>
            <TimerActionButton identity={identity+'again'} disabled={!canEdit || stepTooLong} onActivate={() => startFocus(choice)}>
              {copy.repeatFocus(focusMinutes)}</TimerActionButton>
            {view.phase === 'longBreak' && <button type="button" className="btn btn-secondary" onClick={() => prepare('rest', 'shortBreak')}>{copy.shortRest}</button>}
            <button type="button" className="btn btn-secondary" onClick={() => prepare('focus')}>{copy.prepare}</button>
          </>}
          {ended?.phase === 'rest' && <TimerActionButton identity={identity+'again'} disabled={!canEdit || stepTooLong} onActivate={() => startFocus(choice)}>{copy.startFocus(focusMinutes)}</TimerActionButton>}
        </div>
      </div>
      <div className="thought-actions">
        <button type="button" className="btn btn-secondary" disabled={!canEdit} onClick={thoughts.mark}
          onKeyDown={e => { if (e.repeat && (e.key === 'Enter' || e.key === ' ')) e.preventDefault() }}>{copy.mark}</button>
        <button type="button" className="btn btn-secondary" disabled={!canEdit} onClick={e => show('thought', e.currentTarget)}>
          {thoughts.text ? copy.resumeDraft : copy.write}</button>
        <button type="button" className="btn btn-secondary" style={{ visibility: linkedThoughts.length ? 'visible' : 'hidden' }}
          onClick={e => show('list', e.currentTarget)}>{copy.readSession}</button>
      </div>
      <div className="focus-feedback-slot" aria-label="想法与保存状态">
        {pending ? <>{copy.pending}{!panel && retry}</>
          : <>{noteStatus?.text}
            {thoughts.latestMarkerId && <button type="button" className="link-button" disabled={!canEdit}
              onClick={e => edit(thoughts.latestMarkerId!, e.currentTarget)}>{copy.supplement}</button>}
            {thoughts.undo && <button type="button" className="link-button" disabled={!canEdit} onClick={thoughts.undo.run}>{thoughts.undo.label}</button>}
          </>}
      </div>
      {panel && <FocusTaskDialog key={panel} title={titles[panel]} onClose={close}
        closeLabel={panel === 'end' ? copy.cancelEnd : panel === 'thought' && !ready ? uiText(view.step ? 'UI16' : 'UI17') : '返回'}>
        {panel === 'duration' && <div className="duration-choices" role="group" aria-label="只选择本段时长">
          {preparingRest || (cards && cardAdjustingRest) ? (['shortBreak', 'longBreak'] as const).map(phase =>
            <button key={phase} type="button" className="btn btn-secondary" aria-pressed={restPhase === phase}
                onClick={() => { if (cards) setCardRestPhase(phase); else prepare('rest', phase); close() }}>
                {PHASE_LABELS[phase]} · {phase === 'shortBreak' ? view.shortBreakMinutes : view.longBreakMinutes} 分钟</button>)
            : view.quickChoicesMinutes.map(value =>
              <button key={value} type="button" className="btn btn-secondary" aria-pressed={focusMinutes === value}
                onClick={() => { setChoice(value); close() }}>{value} 分钟</button>)}
        </div>}
        {panel === 'step' && (ready ? <div className="focus-task__body">
          <label htmlFor="step-input">{uiText('UI11')}（可留空）</label>
          <input id="step-input" className="step-input" data-initial-focus type="text" enterKeyHint="done" value={step} disabled={!canEdit}
            onChange={e => setStep(e.target.value)} aria-invalid={stepTooLong}
            onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.nativeEvent.keyCode !== 229 && !stepTooLong) { e.preventDefault(); close() } }} />
          <p className={stepTooLong ? 'field-error' : 'field-hint'}>{Array.from(step).length} / {view.stepMaxLength} 字{stepTooLong && ' · 请缩短后再开始。'}</p>
          <button type="button" className="btn btn-secondary" disabled={stepTooLong} onClick={close}>用作这一小步</button>
        </div> : <p>{view.step}</p>)}
        {panel === 'end' && <div className="focus-task__body">
          <p>{paused ? '计时已暂停。' : '计时仍在继续。'}结束后会记录实际投入的时间。</p>
          <TimerActionButton identity={identity+'confirm'} primary disabled={!canEdit || confirming.current !== view.sessionId}
            onActivate={() => { if (confirming.current === view.sessionId) dispatch({ type: 'end' }); close() }}>{uiText('UI06')}</TimerActionButton>
        </div>}
        {panel === 'thought' && <>
          <div className="editor-timer">{!ready ? <><span>{status} · {formatClock(view.remainingMs)}</span>
            <TimerActionButton identity={identity} disabled={!canEdit} onActivate={activeCommand}>{activeLabel}</TimerActionButton></>
            : <span>{ended ? '本段已结束' : '当前没有进行中的计时'}</span>}</div>
          <ThoughtPanel thoughts={thoughts} canEdit={canEdit} />
        </>}
        {panel === 'list' && <ul className="linked-notes">{linkedThoughts.map((note, index) =>
          <li key={note.id}><span>{note.text || `记号 ${index + 1}`}</span>
            <button type="button" className="btn btn-secondary" disabled={!canEdit} onClick={() => edit(note.id)}>
              {note.text ? copy.edit : copy.supplement}</button></li>)}</ul>}
        {panel === 'encouragement' && <div className="focus-task__body">
          <p className="requested-phrase">{phrase?.text}</p>
          <button type="button" className="btn btn-secondary" onClick={companion.next}>{uiText('UI20')}</button>
          <details className="support-categories"><summary>{copy.askCategories}</summary>
            {copy.askOptions.map(({ pool, label: option }) => <button key={pool} type="button"
              className="btn btn-secondary" aria-pressed={phrase?.pool === pool} onClick={() => companion.request(pool)}>{option}</button>)}
          </details>
        </div>}
        {pending && <p className="panel-save-error">{copy.pending}{retry}</p>}
      </FocusTaskDialog>}
    </section>
  )
}
