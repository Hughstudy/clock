import { useEffect, useState } from 'react'
import { ClockBadge } from '../components/ClockBadge'
import { PHASE_LABELS } from '../components/format'
import { ThoughtPanel } from '../components/ThoughtPanel'
import { BlueCompanion } from '../components/companion/BlueCompanion'
import { CompanionFeedback } from '../components/companion/CompanionFeedback'
import type { SaveState } from '../contracts/focus'
import { uiText } from '../data/ui-copy'
import type { UserAction } from '../hooks/useClockApp'
import type { Thoughts } from '../hooks/useThoughts'
import type { TimerView } from '../hooks/useViews'
import type { useFeedback } from '../hooks/companion/useFeedback'

interface Props {
  view: TimerView
  companion: ReturnType<typeof useFeedback>
  thoughts: Thoughts
  reducedMotion: boolean
  canEdit: boolean
  saveState: SaveState
  dispatch: (action: UserAction) => void
}

const STATUS_TEXT = { ready: '准备好了', running: '专注中', paused: '已暂停' } as const

export function HomeScreen({ view, companion, thoughts, reducedMotion, canEdit, saveState, dispatch }: Props) {
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [choosing, setChoosing] = useState(false)
  const [stepOpen, setStepOpen] = useState(false)
  const [step, setStep] = useState('')
  useEffect(() => { setConfirmEnd(false); setChoosing(false) }, [view.sessionId])
  const label = PHASE_LABELS[view.phase]
  const readyFocus = view.status === 'ready' && !view.isBreak
  const scene = companion.scene ? { ...companion.scene,
    allowBeats: companion.scene.allowBeats && !thoughts.open && !stepOpen && !choosing && !confirmEnd,
  } : null
  // A one-off start takes the typed step with it; the field clears only once the session exists.
  useEffect(() => { if (view.sessionId) { setStep(''); setStepOpen(false) } }, [view.sessionId])
  const closeStartPanels = () => { setChoosing(false); setStepOpen(false); setConfirmEnd(false) }
  const start = (durationMinutes?: number) => {
    // Close local inputs before the saved begin cue arrives, so the scene's
    // one permitted entrance is not consumed behind an obsolete panel.
    closeStartPanels()
    dispatch({ type: 'start', step, ...(durationMinutes ? { durationMinutes } : {}) })
  }
  const startBreak = () => { closeStartPanels(); dispatch({ type: 'startBreak' }) }
  const primary = view.status === 'running'
    ? { text: view.isBreak ? '暂停休息' : uiText('UI03'), run: () => dispatch({ type: 'pause' }) }
    : view.status === 'paused'
      ? { text: view.isBreak ? '继续休息' : uiText('UI04'), run: () => dispatch({ type: 'resume' }) }
      : view.isBreak
        ? { text: '开始休息', run: () => { closeStartPanels(); dispatch({ type: 'start' }) } }
        : { text: `${uiText('UI02')} · ${view.nextFocusMinutes} 分钟`, run: () => start() }

  return (
    <section className={`screen home ${view.isBreak ? 'is-break' : 'is-focus'}`} aria-label="专注计时">
      {/* The companion is the scene; the clock waits quietly in its corner. */}
      <div className="stage">
        <ClockBadge label={label} status={view.isBreak && view.status === 'running' ? '休息中' : STATUS_TEXT[view.status]}
          remainingMs={view.remainingMs} progress={view.progress} running={view.status === 'running'} />
        <CompanionFeedback
          feedback={companion.feedback}
          reducedMotion={reducedMotion}
          motionEnabled={!reducedMotion}
          onRequest={() => companion.request()}
          onNext={companion.next}
          onDismiss={companion.dismiss}
          announce={false}
          quietStatus
          renderCharacter={(presentation) => <BlueCompanion presentation={presentation} cueId={companion.cue?.id} scene={scene} />}
        />
      </div>
      {/* One fixed-height row in every state, so Pause appears exactly where Start was. */}
      <div className="step-slot">
        {!view.isBreak && view.step && view.status !== 'ready' && (
          <p className="session-step"><span>{uiText('UI10')}</span>{view.step}</p>
        )}
        {readyFocus && !stepOpen && (
          <button type="button" className="step-toggle" disabled={!canEdit} onClick={() => setStepOpen(true)}>
            ＋ {uiText('UI10')}
          </button>
        )}
        {readyFocus && stepOpen && (
          <input className="step-input" type="text" enterKeyHint="go" maxLength={view.stepMaxLength} value={step} disabled={!canEdit}
            aria-label={`${uiText('UI11')}（可留空）`} placeholder={`${uiText('UI11')}（可留空）`} onChange={(e) => setStep(e.target.value)} autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); start() } }} />
        )}
      </div>
      <div className="controls">
        <button type="button" className="btn btn-primary" disabled={!canEdit} onClick={primary.run}>
          <span className="primary-symbol" aria-hidden="true">{view.status === 'running' ? 'Ⅱ' : '▷'}</span>{primary.text}
        </button>
        <div className="controls-secondary">
          {readyFocus && <>
            {view.nextFocusMinutes !== view.quickFocusMinutes && (
              <button type="button" className="btn btn-secondary" disabled={!canEdit} onClick={() => start(view.quickFocusMinutes)}>
                先做 {view.quickFocusMinutes} 分钟
              </button>
            )}
            <button type="button" className="btn btn-secondary" aria-expanded={choosing} aria-controls="duration-choices" disabled={!canEdit} onClick={() => setChoosing(!choosing)}>
              换个时长
            </button>

            <span className="control-divider" aria-hidden="true" />
            <button type="button" className="btn btn-secondary" disabled={!canEdit} onClick={startBreak}>{uiText('UI08')}</button>
          </>}
          {view.status !== 'ready' && !view.isBreak && !confirmEnd && (
            <button type="button" className="btn btn-secondary" disabled={!canEdit} onClick={() => setConfirmEnd(true)}>{uiText('UI06')}</button>
          )}
          {view.isBreak && (
            <button type="button" className="btn btn-secondary" disabled={!canEdit} onClick={() => dispatch({ type: 'skipBreak' })}>回到专注</button>
          )}
        </div>
        {readyFocus && choosing && (
          <div id="duration-choices" className="duration-choices" role="group" aria-label="这一段的时长（只用于这一段，不改默认设置）">
            {view.quickChoicesMinutes.map((minutes) => (
              <button key={minutes} type="button" className="btn btn-secondary" aria-pressed={minutes === view.nextFocusMinutes} disabled={!canEdit} onClick={() => start(minutes)}>
                {minutes} 分钟
              </button>
            ))}
          </div>
        )}
        {confirmEnd && view.status !== 'ready' && !view.isBreak && (
          <div className="end-confirm" role="group" aria-label="确认结束本段">
            <p>结束这一段，并保留已经投入的时间？</p>
            <button type="button" className="btn btn-secondary" disabled={!canEdit} onClick={() => { dispatch({ type: 'end' }); setConfirmEnd(false) }}>确认结束并记录</button>
            <button type="button" className="btn btn-secondary" onClick={() => setConfirmEnd(false)}>先不结束</button>
          </div>
        )}
      </div>
      <ThoughtPanel thoughts={thoughts} canEdit={canEdit} inSession={view.status !== 'ready'} />
      <p className="local-indicator">{saveState === 'saved' ? '◦ 进度保存在此浏览器' : ' '}</p>
    </section>
  )
}
