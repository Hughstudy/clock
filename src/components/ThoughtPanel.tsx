import { focusCopy as copy } from '../data/focus-copy'
import { useLayoutEffect, useRef } from 'react'
import type { Thoughts } from '../hooks/useThoughts'

interface Props {
  thoughts: Thoughts
  canEdit: boolean
}

/** The host owns the task surface. Editing text never dispatches a timer command. */
export function ThoughtPanel({ thoughts, canEdit }: Props) {
  const composing = useRef(false)
  const switchPrompt = useRef<HTMLDivElement>(null)
  const textInput = useRef<HTMLTextAreaElement>(null)
  const switching = useRef(thoughts.pendingEdit)
  useLayoutEffect(() => {
    const wasSwitching = switching.current
    switching.current = thoughts.pendingEdit
    if (thoughts.pendingEdit) switchPrompt.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
    else if (wasSwitching) textInput.current?.focus()
  }, [thoughts.pendingEdit])
  const tooLong = thoughts.length > thoughts.maxLength
  const clearing = thoughts.clearingExistingText
  const canSaveCurrent = canEdit && thoughts.canSave && !thoughts.saving
  if (thoughts.pendingEdit) return (
    <div ref={switchPrompt} className="thought-switch">
      <p>{copy.switchDraft}</p>
      <button type="button" className="btn btn-primary" data-initial-focus={canSaveCurrent || undefined} disabled={!canSaveCurrent}
        onClick={thoughts.saveAndSwitch}>保存当前想法后继续</button>
      <button type="button" className="btn btn-secondary" data-initial-focus={!canSaveCurrent || undefined} onClick={thoughts.cancelSwitch}>{copy.keepDraft}</button>
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
      <textarea ref={textInput} id="thought-text" rows={3} data-initial-focus value={thoughts.text}
        placeholder={thoughts.isExisting ? undefined : copy.thoughtPlaceholder}
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
