import { useMemo } from 'react'
import { focusCopy as copy } from '../data/focus-copy'
import { validateDurationDraft } from '../hooks/useDurationChoice'
import { useDurationRuler } from '../hooks/useDurationRuler'
import '../styles/duration-picker.css'

interface Props {
  draft: string
  minutes: number
  min: number
  max: number
  onChange: (value: string) => void
  onApply: (value: number) => void
}

export function DurationRuler({ draft, minutes, min, max, onChange, onApply }: Props) {
  const checked = validateDurationDraft(draft, min, max)
  const value = checked.ok ? checked.minutes : minutes
  const ruler = useDurationRuler({ value: checked.ok ? checked.minutes : null, min, max, onChange: next => onChange(String(next)) })
  const ticks = useMemo(() => Array.from({ length: max - min + 1 }, (_, index) => {
    const minute = min + index
    return <span key={minute} className={minute % 5 === 0 ? 'duration-ruler__tick duration-ruler__tick--major' : 'duration-ruler__tick'}>
      {minute % 15 === 0 && <b>{minute}</b>}
    </span>
  }), [min, max])
  return <form className="duration-ruler" onSubmit={event => {
    event.preventDefault()
    if (checked.ok) onApply(checked.minutes)
  }}>
    <div className="duration-ruler__frame">
      <div {...ruler} className="duration-ruler__track" data-initial-focus role="slider" tabIndex={0}
        aria-label="时长刻度尺" aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} aria-valuetext={copy.minutes(value)}>
        <span className="duration-ruler__spacer" aria-hidden="true" />{ticks}<span className="duration-ruler__spacer" aria-hidden="true" />
      </div>
      <i className="duration-ruler__marker" aria-hidden="true" />
    </div>
    <p id="custom-minutes-hint" className={checked.ok ? 'fp-hint' : 'fp-hint fp-hint--error'}>
      {checked.ok ? copy.rulerHint : copy.durationError(min, max)}
      {!checked.ok && <button type="button" className="text-action" onClick={() => onChange(String(minutes))}>{copy.restoreDuration}</button>}
    </p>
    <div className="duration-ruler__footer">
      <label><input id="custom-minutes" inputMode="numeric" enterKeyHint="done" value={draft}
        aria-label="专注分钟数" aria-invalid={!checked.ok} aria-describedby="custom-minutes-hint"
        onFocus={event => event.currentTarget.select()} onChange={event => onChange(event.target.value)}
        onKeyDown={event => { if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229)) event.preventDefault() }} /> 分钟</label>
      <button type="submit" className="pill pill--solid" disabled={!checked.ok}>{copy.useDuration}</button>
    </div>
  </form>
}
