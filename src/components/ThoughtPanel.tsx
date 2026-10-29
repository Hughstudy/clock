import { useEffect, useRef } from 'react'
import { uiText } from '../data/ui-copy'
import type { Thoughts } from '../hooks/useThoughts'

interface Props {
  thoughts: Thoughts
  canEdit: boolean
  /** A focus or rest session is active, so closing returns to its timer. */
  inSession: boolean
}

/** One-tap marker, optional text and undo. Opening or closing never pauses or resumes time. */
export function ThoughtPanel({ thoughts, canEdit, inSession }: Props) {
  const input = useRef<HTMLTextAreaElement>(null)
  const opener = useRef<HTMLButtonElement>(null)
  const wasOpen = useRef(thoughts.open)
  useEffect(() => {
    if (thoughts.open) input.current?.focus()
    else if (wasOpen.current) opener.current?.focus()
    wasOpen.current = thoughts.open
  }, [thoughts.open])

  return (
    <section className="thought-panel" aria-label={uiText('UI14')}>
      {!thoughts.open && (
        <div className="thought-actions">
          <button type="button" className="btn btn-secondary" disabled={!canEdit} onClick={thoughts.mark}>{uiText('UI12')}</button>
          <button type="button" className="btn btn-secondary" ref={opener} disabled={!canEdit} onClick={() => thoughts.setOpen(true)}>
            {uiText('UI13')}{thoughts.text ? ' · 有草稿' : ''}
          </button>
        </div>
      )}
      {thoughts.open && (
        <form className="thought-form" onSubmit={(e) => { e.preventDefault(); thoughts.save() }}>
          <label htmlFor="thought-text" className="thought-title">{uiText('UI14')}</label>
          <textarea
            id="thought-text"
            ref={input}
            rows={3}
            maxLength={thoughts.maxLength}
            placeholder={uiText('UI15')}
            value={thoughts.text}
            onChange={(e) => thoughts.setText(e.target.value)}
          />
          <div className="thought-form-actions">
            <button type="submit" className="btn btn-secondary" disabled={!canEdit || thoughts.saving}>{thoughts.saving ? '正在保存…' : '保存'}</button>
            <button type="button" className="btn btn-secondary" onClick={() => thoughts.setOpen(false)}>{inSession ? uiText('UI17') : '返回'}</button>
          </div>
        </form>
      )}
      {(thoughts.status || thoughts.undo) && (
        <p className={`thought-status${thoughts.status?.kind === 'error' ? ' thought-status--error' : ''}`}>
          {thoughts.status?.text}
          {thoughts.undo && <button type="button" className="link-button" disabled={!canEdit} onClick={thoughts.undo.run}>{thoughts.undo.label}</button>}
        </p>
      )}
    </section>
  )
}
