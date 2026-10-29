import { useEffect, useState } from 'react'
import { formatClock, PHASE_LABELS, spokenClock } from '../components/format'
import { TimerDial } from '../components/TimerDial'
import { BlueCompanion } from '../components/companion/BlueCompanion'
import { CompanionFeedback } from '../components/companion/CompanionFeedback'
import type { SaveState } from '../contracts/focus'
import type { UserAction } from '../hooks/useClockApp'
import type { TimerView } from '../hooks/useViews'
import type { useFeedback } from '../hooks/companion/useFeedback'

interface Props {
  view: TimerView
  companion: ReturnType<typeof useFeedback>
  reducedMotion: boolean
  canEdit: boolean
  saveState: SaveState
  dispatch: (action: UserAction) => void
}

const STATUS_TEXT = { ready: '准备好了', running: '专注中', paused: '已暂停' } as const

export function HomeScreen({ view, companion, reducedMotion, canEdit, saveState, dispatch }: Props) {
  const [confirmEnd, setConfirmEnd] = useState(false)
  useEffect(() => setConfirmEnd(false), [view.sessionId])
  const label = PHASE_LABELS[view.phase]
  const primary = view.status === 'running'
    ? { text: view.isBreak ? '暂停休息' : '暂停', action: { type: 'pause' } as const }
    : view.status === 'paused'
      ? { text: view.isBreak ? '继续休息' : '继续这一段', action: { type: 'resume' } as const }
      : { text: view.isBreak ? '开始休息' : '开始这一段', action: { type: 'start' } as const }

  return (
    <section className={`screen home ${view.isBreak ? 'is-break' : 'is-focus'}`} aria-label="专注计时">
      <div className="focus-intro">
        <p className="eyebrow">A LITTLE SPACE TO {view.isBreak ? 'REST' : 'FOCUS'}</p>
        <h2>{view.isBreak ? '歇一歇，也很好。' : '从这一小段开始。'}</h2>
      </div>
      <div className="focus-scene">
        <CompanionFeedback
          feedback={companion.feedback}
          reducedMotion={reducedMotion}
          motionEnabled={!reducedMotion}
          onRequest={() => companion.request()}
          onNext={companion.next}
          onDismiss={companion.dismiss}
          announce={false}
          renderCharacter={(presentation) => <BlueCompanion presentation={presentation} cueId={companion.cueId ?? undefined} />}
        />
        <TimerDial progress={view.progress}>
          <p className="dial-phase">{label}</p>
          <div className="digits" role="timer" aria-label={`${label}还剩${spokenClock(view.remainingMs)}`}>
            {formatClock(view.remainingMs)}
          </div>
          <div className="dial-status"><span className={`status-dot status-${view.status}`} aria-hidden="true" />{view.isBreak && view.status === 'running' ? '休息中' : STATUS_TEXT[view.status]}</div>
        </TimerDial>
      </div>
      <div className="controls">
        <button type="button" className="btn btn-primary" disabled={!canEdit} onClick={() => dispatch(primary.action)}>
          <span className="primary-symbol" aria-hidden="true">{view.status === 'running' ? 'Ⅱ' : '▷'}</span>{primary.text}
        </button>
        <div className="controls-secondary">
          {view.status === 'ready' && !view.isBreak && <>
            <button type="button" className="btn btn-secondary" disabled={!canEdit} onClick={() => dispatch({ type: 'start', durationMinutes: view.quickFocusMinutes })}>
              先做 {view.quickFocusMinutes} 分钟
            </button>
            <span className="control-divider" aria-hidden="true" />
            <button type="button" className="btn btn-secondary" disabled={!canEdit} onClick={() => dispatch({ type: 'startBreak' })}>休息一下</button>
          </>}
          {view.status !== 'ready' && !view.isBreak && !confirmEnd && (
            <button type="button" className="btn btn-secondary" disabled={!canEdit} onClick={() => setConfirmEnd(true)}>结束并记录</button>
          )}
          {view.isBreak && (
            <button type="button" className="btn btn-secondary" disabled={!canEdit} onClick={() => dispatch({ type: 'skipBreak' })}>回到专注</button>
          )}
        </div>
        {confirmEnd && view.status !== 'ready' && !view.isBreak && (
          <div className="end-confirm" role="group" aria-label="确认结束本段">
            <p>结束这一段，并保留已经投入的时间？</p>
            <button type="button" className="btn btn-secondary" disabled={!canEdit} onClick={() => { dispatch({ type: 'end' }); setConfirmEnd(false) }}>确认结束并记录</button>
            <button type="button" className="btn btn-secondary" onClick={() => setConfirmEnd(false)}>先不结束</button>
          </div>
        )}
      </div>
      <p className="focus-footnote">{view.isBreak ? '休息不计入专注时间，按你的节奏来。' : '随时暂停，短短一段也会被记录。'}</p>
      <p className="local-indicator">{saveState === 'saved' ? '◦ 进度保存在此浏览器' : '\u00a0'}</p>
    </section>
  )
}
