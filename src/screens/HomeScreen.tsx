import { formatClock, formatMinutes, PHASE_LABELS, plural, spokenClock } from '../components/format'
import { RiceBowls } from '../components/RiceBowls'
import { TimerDial } from '../components/TimerDial'
import { WhaleChan } from '../components/WhaleChan'
import type { CharacterView } from '../hooks/useCharacter'
import type { UserAction } from '../hooks/useClockApp'
import type { TimerView } from '../hooks/useViews'

interface Props {
  view: TimerView
  character: CharacterView
  /** False while saved data is shown read-only. */
  canEdit: boolean
  dispatch: (action: UserAction) => void
}

const STATUS_TEXT = { ready: 'Ready', running: 'Running', paused: 'Paused' } as const

export function HomeScreen({ view, character, canEdit, dispatch }: Props) {
  const label = PHASE_LABELS[view.phase]
  const primary =
    view.status === 'running'
      ? { text: 'Pause', action: { type: 'pause' } as const }
      : view.status === 'paused'
        ? { text: 'Resume', action: { type: 'resume' } as const }
        : { text: view.isBreak ? 'Start break' : 'Start focus', action: { type: 'start' } as const }

  return (
    <section className={`screen home ${view.isBreak ? 'is-break' : 'is-focus'}`} aria-label="Timer">
      <WhaleChan character={character} />

      <TimerDial progress={view.progress}>
        <p className="dial-phase">{label}</p>
        <div className="digits" role="timer" aria-label={`${label}: ${spokenClock(view.remainingMs)} remaining`}>
          {formatClock(view.remainingMs)}
        </div>
        <div className="dial-status">{STATUS_TEXT[view.status]}</div>
      </TimerDial>

      <div className="controls">
        <button type="button" className="btn btn-primary" disabled={!canEdit} onClick={() => dispatch(primary.action)}>
          {primary.text}
        </button>
        <div className="controls-secondary">
          {view.status !== 'ready' && (
            <button type="button" className="btn btn-secondary" disabled={!canEdit} onClick={() => dispatch({ type: 'reset' })}>
              Reset
            </button>
          )}
          {view.isBreak && (
            <button type="button" className="btn btn-secondary" disabled={!canEdit} onClick={() => dispatch({ type: 'skipBreak' })}>
              Skip break
            </button>
          )}
        </div>
      </div>

      <RiceBowls done={view.cycle.done} total={view.cycle.total} />
      <p className="today-count">
        <strong>{plural(view.today.count, 'bowl', 'bowls')} of rice</strong> today ·{' '}
        {formatMinutes(view.today.focusMs)} of completed focus
      </p>
    </section>
  )
}
