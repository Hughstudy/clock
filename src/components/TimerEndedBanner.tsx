import { focusCopy as copy } from '../data/focus-copy'
import { uiText } from '../data/ui-copy'
import type { SessionResult } from '../hooks/useClockApp'
import '../styles/timer-ended.css'
import { formatMinutes } from './format'

/** Save state comes from this session's own receipt, as on the Focus result. */
export function timerEndedText(result: SessionResult): string {
  if (result.phase === 'rest') return uiText('UI44')
  return `${uiText('UI43')}${copy.focusElapsed} ${formatMinutes(result.elapsedMs)} · ${result.saved ? copy.savedRecord : copy.unsavedRecord}`
}

interface Props {
  result: SessionResult
  onView: () => void
  onDismiss: () => void
}

/** Floats above navigation, so it never moves the page. The app's live region announces it. */
export function TimerEndedBanner({ result, onView, onDismiss }: Props) {
  return <div className="timer-ended" data-phase={result.phase}>
    <p>{timerEndedText(result)}</p>
    <div className="timer-ended__actions">
      <button type="button" className="pill pill--solid" onClick={onView}>{result.phase === 'rest' ? copy.backToFocus : copy.viewResult}</button>
      <button type="button" className="pill pill--ghost" onClick={onDismiss}>{copy.gotIt}</button>
    </div>
  </div>
}
