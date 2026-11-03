import { type PointerEventHandler, type RefObject } from 'react'
import { focusCopy as copy } from '../data/focus-copy'
import { validateDurationDraft } from '../hooks/useDurationChoice'
import '../styles/duration-dial.css'

interface Props {
  draft: string
  minutes: number
  min: number
  max: number
  face: RefObject<HTMLDivElement>
  onDrag: PointerEventHandler<HTMLDivElement>
  onChange: (value: string) => void
  onApply: (value: number) => void
}

export function DurationDial({ draft, minutes, min, max, face, onDrag, onChange, onApply }: Props) {
  const checked = validateDurationDraft(draft, min, max)
  const value = checked.ok ? checked.minutes : minutes
  const step = (amount: number) => onChange(String(Math.max(min, Math.min(max, value + amount))))
  return <form className="duration-dial" onSubmit={event => {
    event.preventDefault()
    if (checked.ok) onApply(checked.minutes)
  }}>
    <div className="duration-dial__layout">
      <div ref={face} className="duration-dial__face" data-initial-focus role="slider" tabIndex={0}
        aria-label="时长表盘" aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} aria-valuetext={copy.minutes(value)}
        onPointerDown={onDrag}
        onKeyDown={event => {
          if (['ArrowUp', 'ArrowRight', '+', 'ArrowDown', 'ArrowLeft', '-'].includes(event.key)) {
            event.preventDefault(); step(['ArrowUp', 'ArrowRight', '+'].includes(event.key) ? 1 : -1)
          } else if (event.key === 'Home' || event.key === 'End') {
            event.preventDefault(); onChange(String(event.key === 'Home' ? min : max))
          }
        }}>
        <div className="duration-dial__ticks" aria-hidden="true" />
        {[60, 15, 30, 45].map(tick => <span key={tick} className={`duration-dial__mark duration-dial__mark--${tick}`} aria-hidden="true">{tick}</span>)}
        <i className="duration-dial__hand" aria-hidden="true" style={{ transform: `translateX(-50%) rotate(${value * 6}deg)` }} />
      </div>
      <div className="duration-dial__value">
        <label><input id="custom-minutes" inputMode="numeric" enterKeyHint="done" value={draft}
          aria-label="专注分钟数" aria-invalid={!checked.ok} aria-describedby="custom-minutes-hint"
          onFocus={event => event.currentTarget.select()} onChange={event => onChange(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229)) event.preventDefault() }} /> 分钟</label>
        <div className="duration-dial__steps">
          <button type="button" className="pill pill--soft" aria-label="减少 1 分钟" disabled={checked.ok && value === min} onClick={() => step(-1)}>−</button>
          <button type="button" className="pill pill--soft" aria-label="增加 1 分钟" disabled={checked.ok && value === max} onClick={() => step(1)}>＋</button>
        </div>
      </div>
    </div>
    <div className="duration-dial__footer">
      <p id="custom-minutes-hint" className={checked.ok ? 'fp-hint' : 'fp-hint fp-hint--error'}>
        {checked.ok ? <>{copy.dialHint}<br />{copy.durationKept}</> : copy.durationError(min, max)}
        {!checked.ok && <button type="button" className="text-action" onClick={() => onChange(String(minutes))}>{copy.restoreDuration}</button>}
      </p>
      <button type="submit" className="pill pill--solid" disabled={!checked.ok}>{copy.useDuration}</button>
    </div>
  </form>
}
