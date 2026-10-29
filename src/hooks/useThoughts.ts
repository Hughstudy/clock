import { useCallback, useEffect, useRef, useState } from 'react'
import { newId } from '../adapters/ids'
import { onAppHide } from '../adapters/lifecycle'
import { spec } from '../data/spec'
import { uiText } from '../data/ui-copy'
import type { ClockApp, ThoughtResult } from './useClockApp'

export interface ThoughtStatus { text: string; kind: 'status' | 'error' }

export interface Thoughts {
  open: boolean
  setOpen: (open: boolean) => void
  text: string
  setText: (text: string) => void
  maxLength: number
  /** True while the typed text is waiting for a confirmed save. */
  saving: boolean
  mark: () => void
  save: () => void
  putAway: (thoughtId: string) => void
  reopen: (thoughtId: string) => void
  remove: (thoughtId: string) => void
  /** Undo of the latest marker or deletion, while it is still possible. */
  undo: { label: string; run: () => void } | null
  status: ThoughtStatus | null
}

/** A later successful write persists the whole in-memory snapshot, including an earlier failed change. */
function effectivelySaved(result: ThoughtResult, app: ClockApp): boolean {
  return result.saved || (result.change !== null && app.saveState === 'saved')
}

function statusOf(result: ThoughtResult, saved: boolean): ThoughtStatus {
  if (result.change === 'rejected') return { text: '这条想法已在别处删除，文字仍留在这里，可以另存为新的想法。', kind: 'error' }
  if (!saved) {
    if (result.change === 'marked') return { text: uiText('ERR05'), kind: 'error' }
    if (result.change === 'text') return { text: uiText('ERR04'), kind: 'error' }
    return { text: '这次更改还没保存成功，可以重试。', kind: 'error' }
  }
  switch (result.change) {
    case 'marked': return { text: uiText('UI32'), kind: 'status' }
    case 'text': return { text: uiText('UI33'), kind: 'status' }
    case 'deleted': return { text: uiText('UI34'), kind: 'status' }
    case 'restored': return { text: uiText('UI35'), kind: 'status' }
    case 'putAway': return { text: '已收起。', kind: 'status' }
    case 'reopened': return { text: '已放回待看。', kind: 'status' }
    default: return { text: '这次更改还没保存成功，可以重试。', kind: 'error' }
  }
}

/**
 * Thought capture and its draft. The panel never pauses or resumes the timer.
 * Typed text stays on screen until its save is confirmed, and is persisted as a
 * draft after typing pauses, when the panel closes and when the page is hidden.
 */
export function useThoughts(app: ClockApp): Thoughts {
  const { dispatch, thoughtResult, snapshot } = app
  const [open, setOpenState] = useState(false)
  const [text, setTextState] = useState(() => snapshot.thoughtDraft?.text ?? '')
  // The thought new text attaches to: a restored draft's target or this page's latest empty marker.
  const [target, setTarget] = useState<string | null>(() => snapshot.thoughtDraft?.thoughtId ?? null)
  const [awaiting, setAwaiting] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const latest = useRef({ text, target })
  latest.current = { text, target }

  const flushDraft = useCallback(() => {
    window.clearTimeout(timer.current)
    timer.current = undefined
    const { text: t, target: id } = latest.current
    dispatch(t ? { type: 'saveThoughtDraft', thoughtId: id, text: t } : { type: 'discardThoughtDraft' })
  }, [dispatch])

  useEffect(() => onAppHide(() => { if (timer.current !== undefined) flushDraft() }), [flushDraft])
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const result = thoughtResult
  const saved = result ? effectivelySaved(result, app) : false

  // Adopt a confirmed result: attach text to a new marker, clear text once its save is confirmed.
  const [handled, setHandled] = useState<string | null>(null)
  const key = result ? `${result.operationId}:${saved}` : null
  if (result && key !== handled) {
    setHandled(key)
    if (result.change === 'marked' && saved && !latest.current.text) setTarget(result.thoughtId)
    if (result.change === 'deleted' && result.thoughtId === target) setTarget(null)
    if (result.thoughtId === awaiting) {
      if (result.change === 'text' && saved) { setTextState(''); setTarget(null); setAwaiting(null) }
      if (result.change === 'rejected') { setTarget(null); setAwaiting(null) }
    }
  }

  const setText = (next: string) => {
    setTextState(next)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(flushDraft, spec.thoughts.draftSaveDelayMs)
  }

  const setOpen = (next: boolean) => {
    if (!next && timer.current !== undefined) flushDraft()
    setOpenState(next)
  }

  const save = () => {
    window.clearTimeout(timer.current)
    timer.current = undefined
    const id = target ?? newId()
    setTarget(id)
    setAwaiting(id)
    dispatch({ type: 'saveThoughtText', thoughtId: id, text })
  }

  let undo: Thoughts['undo'] = null
  if (result && saved && result.change === 'marked') {
    const id = result.thoughtId
    undo = { label: uiText('UI18'), run: () => dispatch({ type: 'deleteThought', thoughtId: id }) }
  } else if (result && saved && result.change === 'deleted') {
    const id = result.thoughtId
    undo = { label: '撤销删除', run: () => dispatch({ type: 'restoreThought', thoughtId: id }) }
  }

  return {
    open, setOpen, text, setText, maxLength: spec.thoughts.maxLength,
    saving: awaiting !== null && !(result?.thoughtId === awaiting && !saved),
    mark: () => dispatch({ type: 'markThought' }),
    save,
    putAway: (thoughtId) => dispatch({ type: 'putAwayThought', thoughtId }),
    reopen: (thoughtId) => dispatch({ type: 'reopenThought', thoughtId }),
    remove: (thoughtId) => dispatch({ type: 'deleteThought', thoughtId }),
    undo,
    status: result ? statusOf(result, saved) : null,
  }
}
