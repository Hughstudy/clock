import { focusCopy as copy } from '../data/focus-copy'
import { useRef } from 'react'
import type { Thoughts } from '../hooks/useThoughts'

interface Props {
  thoughts: Thoughts
  canEdit: boolean
}

/** The host owns the task surface. Editing text never dispatches a timer command. */
export function ThoughtPanel({ thoughts, canEdit }: Props) {
  const composing = useRef(false)
  const tooLong = thoughts.length > thoughts.maxLength
  const clearing = thoughts.isExisting && !thoughts.text.trim()
  if (thoughts.pendingEdit) return (
    <div className="focus-task__body">
      <p>{copy.switchDraft}</p>
      <button type="button" className="btn btn-secondary" onClick={thoughts.cancelSwitch}>{copy.keepDraft}</button>
      <button type="button" className="btn btn-secondary" onClick={thoughts.discardAndSwitch}>{copy.discardAndSwitch}</button>
    </div>
  )
  return (
    <form className="thought-form" onSubmit={event => {
      event.preventDefault()
      if (canEdit && thoughts.canSave && !composing.current) thoughts.save()
    }}>
      <label htmlFor="thought-text" className="thought-title">
        {thoughts.isExisting ? copy.existingText : copy.newText}
      </label>
      <textarea id="thought-text" rows={3} data-initial-focus value={thoughts.text}
        readOnly={!canEdit} aria-describedby="thought-length" aria-invalid={tooLong}
        onCompositionStart={() => { composing.current = true }}
        onCompositionEnd={() => { composing.current = false }}
        onChange={event => thoughts.setText(event.target.value)} />
      <p id="thought-length" className={tooLong ? 'field-error' : 'field-hint'}>
        {thoughts.length} / {thoughts.maxLength} 字{tooLong ? ' · 请缩短后再保存。' : ''}
      </p>
      {thoughts.originalEnded && <p>{copy.originalEnded}</p>}
      {clearing && <p>{copy.emptyExisting}</p>}
      {thoughts.status?.kind === 'error' && <p className="field-error">{thoughts.status.text}</p>}
      <div className="thought-form-actions">
        <button type="submit" className="btn btn-primary"
          disabled={!canEdit || !thoughts.canSave || thoughts.saving}>
          {thoughts.saving ? copy.savePending : clearing ? copy.confirmEmpty : copy.saveThought}
        </button>
        {thoughts.conflict && <button type="button" className="btn btn-secondary"
          disabled={!canEdit || tooLong || !thoughts.text.trim()} onClick={thoughts.saveAsNew}>{copy.saveAsNew}</button>}
        {thoughts.conflict && <button type="button" className="btn btn-secondary" onClick={thoughts.reloadLatest}>{copy.reloadLatest}</button>}
        {!thoughts.conflict && !!thoughts.text && <button type="button" className="btn btn-secondary" onClick={thoughts.writeAnother}>{copy.writeAnother}</button>}
      </div>
    </form>
  )
}
