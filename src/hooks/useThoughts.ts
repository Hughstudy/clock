import { useCallback, useEffect, useRef, useState } from 'react'
import { currentTimeZone, dateKeyInZone, nowMs } from '../adapters/calendar'
import { newId } from '../adapters/ids'
import { onAppHide } from '../adapters/lifecycle'
import { spec } from '../data/spec'
import { uiText } from '../data/ui-copy'
import type { ClockApp, ThoughtResult } from './useClockApp'
import type { Thought, ThoughtDraft } from '../logic/types'

export interface ThoughtStatus { text: string; kind: 'status' | 'error' }

export interface Thoughts {
  open: boolean
  setOpen: (open: boolean) => void
  openNew: () => void
  edit: (thoughtId: string) => void
  text: string
  setText: (text: string) => void
  maxLength: number
  length: number
  canSave: boolean
  isExisting: boolean
  originalEnded: boolean
  conflict: boolean
  pendingEdit: boolean
  writeAnother: () => void
  discardAndSwitch: () => void
  cancelSwitch: () => void
  reloadLatest: () => void
  discard: () => void
  saveAsNew: () => void
  latestMarkerId: string | null
  saving: boolean
  mark: () => void
  save: () => void
  putAway: (thoughtId: string) => void
  reopen: (thoughtId: string) => void
  remove: (thoughtId: string) => void
  undo: { label: string; run: () => void } | null
  status: ThoughtStatus | null
}

interface Editor { draft: ThoughtDraft; stamp: string | null; generation: number }
interface Submission { operationId: string; draftId: string; text: string }
const errorStatus = (text: string): ThoughtStatus => ({ text, kind: 'error' })
function statusOf(result: ThoughtResult): ThoughtStatus {
  if (result.change === 'rejected') return errorStatus('这项操作的对象已改变，未覆盖现有内容。')
  if (!result.saved) return errorStatus(result.change === 'marked' ? uiText('ERR05') : uiText('ERR04'))
  const text = { marked: uiText('UI32'), text: uiText('UI33'), deleted: uiText('UI34'), restored: uiText('UI35'),
    putAway: '已收起。', reopened: '已放回待看。' }
  return result.change ? { text: text[result.change], kind: 'status' } : errorStatus('尚未保存，可以重试。')
}

/** Each edit retains its original owner and base versions independently of the timer and delayed receipts. */
export function useThoughts(app: ClockApp): Thoughts {
  const { snapshot, dispatch, submitThought } = app
  const initial = snapshot.thoughtDraft ? { draft: snapshot.thoughtDraft, stamp: snapshot.draftStamp, generation: snapshot.datasetGeneration } : null
  const [editor, setEditor] = useState<Editor | null>(initial)
  const current = useRef(editor)
  const changeEditor = useCallback((next: Editor | null) => { current.current = next; setEditor(next) }, [])
  const [open, setOpenState] = useState(false)
  const [conflict, setConflict] = useState(false)
  const [switchTarget, setSwitchTarget] = useState<{ id: string | null } | null>(null)
  const [submission, setSubmission] = useState<Submission | null>(null)
  const submitting = useRef<Submission | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const hadGeneration = useRef(snapshot.datasetGeneration)
  const appRef = useRef(app)
  appRef.current = app

  const cancelTimer = useCallback(() => {
    window.clearTimeout(timer.current)
    timer.current = undefined
  }, [])

  const makeEditor = (target?: Thought): Editor => {
    const { timer, datasetGeneration, draftStamp } = appRef.current.snapshot
    const active = timer.phase === 'focus' && !(timer.session?.status === 'running' && timer.session.deadline <= nowMs()) ? timer.session : null
    return { generation: datasetGeneration, stamp: draftStamp, draft: {
      id: newId(), thoughtId: target?.id ?? null, baseRev: target?.rev ?? null,
      sessionId: target ? target.sessionId : active?.id ?? null, timeZone: active?.timeZone ?? currentTimeZone(),
      createdAt: target?.createdAt ?? null, dateKey: target?.dateKey ?? null, text: target?.text ?? '',
    } }
  }

  const flushDraft = useCallback(() => {
    cancelTimer()
    const editing = current.current
    if (!editing || editing.generation !== appRef.current.snapshot.datasetGeneration) return
    const { draft, generation, stamp: expectedStamp } = editing
    const stored = appRef.current.snapshot
    const value = draft.thoughtId !== null || draft.text.trim() ? draft : null
    if (stored.draftStamp === expectedStamp && (value === null ? !stored.thoughtDraft :
        stored.thoughtDraft?.id === draft.id && stored.thoughtDraft.text === draft.text)) return
    const stamp = newId()
    changeEditor({ ...editing, stamp })
    void submitThought({ type: 'writeDraft', expectedStamp, stamp, draft: value }, stamp, generation).then(ok => {
      if (!ok && current.current?.draft.id === draft.id && current.current.generation === generation) setConflict(true)
    })
  }, [cancelTimer, changeEditor, submitThought])

  useEffect(() => onAppHide(() => { if (timer.current !== undefined) flushDraft() }), [flushDraft])
  useEffect(() => cancelTimer, [cancelTimer])
  useEffect(() => {
    if (hadGeneration.current === snapshot.datasetGeneration) return
    hadGeneration.current = snapshot.datasetGeneration
    cancelTimer()
    changeEditor(snapshot.thoughtDraft ? { draft: snapshot.thoughtDraft, stamp: snapshot.draftStamp, generation: snapshot.datasetGeneration } : null)
    submitting.current = null; setSubmission(null); setOpenState(false); setSwitchTarget(null); setConflict(false)
  }, [snapshot, cancelTimer, changeEditor])

  const receipt = submission ? app.thoughtReceipts.get(submission.operationId) : undefined
  useEffect(() => {
    if (!receipt || !submission || submitting.current?.operationId !== submission.operationId) return
    const editing = current.current
    const sameInput = editing?.draft.id === submission.draftId && editing.draft.text === submission.text && editing.generation === receipt.generation
    if (receipt.change === 'rejected') {
      if (sameInput) setConflict(true)
    } else if (receipt.saved) {
      if (sameInput) { changeEditor(null); setOpenState(false); setConflict(false) }
    } else return
    submitting.current = null
    setSubmission(null)
  }, [receipt, submission, changeEditor])
  const recent = app.thoughtResult

  const begin = (target?: Thought) => {
    changeEditor(makeEditor(target))
    setConflict(false); setOpenState(true); setSwitchTarget(null)
  }
  const openNew = () => {
    if (!current.current) {
      if (snapshot.thoughtDraft) changeEditor({ draft: snapshot.thoughtDraft, stamp: snapshot.draftStamp, generation: snapshot.datasetGeneration })
      else begin()
    }
    setOpenState(true)
  }
  const edit = (id: string) => {
    const target = snapshot.thoughts.find(t => t.id === id && t.deletedAt === null)
    if (!target) return
    const existing = current.current?.draft ?? snapshot.thoughtDraft
    if (existing?.thoughtId === id) { openNew(); return }
    if (existing && (existing.text.trim() || existing.thoughtId)) { setSwitchTarget({id}); openNew(); return }
    begin(target)
  }
  const discard = async () => {
    cancelTimer()
    const editing = current.current
    if (!editing) return { stamp: appRef.current.snapshot.draftStamp }
    const stored = appRef.current.snapshot
    let expectedNext = stored.draftStamp
    if (stored.datasetGeneration === editing.generation && (stored.thoughtDraft?.id === editing.draft.id ||
        (!stored.thoughtDraft && stored.draftStamp !== editing.stamp))) {
      const stamp = newId()
      if (!await submitThought({ type: 'writeDraft', expectedStamp: editing.stamp, stamp, draft: null }, stamp, editing.generation)) {
        setConflict(true); return null
      }
      expectedNext = stamp
    }
    if (current.current !== editing) return null
    changeEditor(null); setConflict(false); setOpenState(false)
    return { stamp: expectedNext }
  }
  const discardAndSwitch = async () => {
    if (!switchTarget) return
    const cleared = await discard()
    if (!cleared) return
    const target = appRef.current.snapshot.thoughts.find(t => t.id === switchTarget.id && t.deletedAt === null)
    if (target || switchTarget.id === null) {
      changeEditor({ ...makeEditor(target), stamp: cleared.stamp })
      setOpenState(true)
    }
    setSwitchTarget(null)
  }
  const reloadLatest = () => {
    cancelTimer()
    const stored = appRef.current.snapshot
    const previous = current.current
    if (stored.thoughtDraft && previous?.stamp !== stored.draftStamp) {
      changeEditor({ draft: stored.thoughtDraft, stamp: stored.draftStamp, generation: stored.datasetGeneration })
      setConflict(false)
      return
    }
    const target = stored.thoughts.find(t => t.id === previous?.draft.thoughtId && t.deletedAt === null)
    if (target) begin(target)
    else { changeEditor(null); setConflict(false); setOpenState(false) }
  }

  const setText = (text: string) => {
    let editing = current.current ?? makeEditor()
    let draft = editing.draft
    if (submitting.current?.draftId === draft.id) {
      // Input after Save is a new draft. The previous result can only clear the submitted text.
      draft = { ...draft, id: newId(), thoughtId: null, baseRev: null, createdAt: null, dateKey: null }
      editing = { ...editing, draft }
    }
    if (draft.createdAt === null && text.trim()) {
      const at = nowMs()
      draft = { ...draft, createdAt: at, dateKey: dateKeyInZone(at, draft.timeZone) }
    }
    changeEditor({ ...editing, draft: { ...draft, text } })
    cancelTimer()
    if (!conflict) timer.current = window.setTimeout(flushDraft, spec.thoughts.draftSaveDelayMs)
  }

  const save = (asNew = false) => {
    const editing = current.current
    if (!editing || editing.generation !== snapshot.datasetGeneration) return
    let draft = editing.draft
    if (Array.from(draft.text).length > spec.thoughts.maxLength || ((!draft.thoughtId || asNew) && !draft.text.trim())) return
    if (submitting.current?.draftId === draft.id && submitting.current.text === draft.text && !asNew) { dispatch({ type: 'retrySave' }); return }
    cancelTimer()
    if (asNew) draft = { ...draft, id: newId(), thoughtId: null, baseRev: null }
    const storedDraft = snapshot.thoughtDraft
    const preserveOther = asNew && storedDraft !== null &&
      (storedDraft.id !== editing.draft.id || storedDraft.text !== editing.draft.text)
    const operationId = newId()
    const stamp = newId()
    const expectedStamp = asNew ? snapshot.draftStamp : editing.stamp
    changeEditor({ ...editing, draft, stamp: preserveOther ? expectedStamp : stamp })
    const item = { operationId, draftId: draft.id, text: draft.text }
    submitting.current = item; setSubmission(item)
    void submitThought({ type: 'saveThoughtText', thoughtId: draft.thoughtId ?? draft.id, text: draft.text, timeZone: draft.timeZone, draft,
      ...(preserveOther ? {} : { expectedStamp, stamp }) }, operationId, editing.generation)
  }

  const manage = (type: 'putAwayThought' | 'reopenThought' | 'deleteThought' | 'restoreThought', id: string, rev?: number) => {
    const target = snapshot.thoughts.find(t => t.id === id)
    if (target) void submitThought({ type, thoughtId: id, expectedRev: rev ?? target.rev }, newId(), snapshot.datasetGeneration)
  }
  const target = editor?.draft.thoughtId ? snapshot.thoughts.find(t => t.id === editor.draft.thoughtId) : null
  const stale = conflict || (!!editor?.draft.thoughtId && (!target || target.deletedAt !== null || target.rev !== editor.draft.baseRev) && !submission)
  const undoTarget = recent?.saved && recent.generation === snapshot.datasetGeneration && recent.revision !== null
    ? snapshot.thoughts.find(t => t.id === recent.thoughtId && t.rev === recent.revision) : null
  let undo: Thoughts['undo'] = null
  if (undoTarget && recent?.change === 'marked') undo = { label: uiText('UI18'), run: () => manage('deleteThought', undoTarget.id, undoTarget.rev) }
  if (undoTarget?.deletedAt != null && recent?.change === 'deleted' && nowMs() - undoTarget.deletedAt < spec.thoughts.undoPeriodMs) {
    undo = { label: '撤销删除', run: () => manage('restoreThought', undoTarget.id, undoTarget.rev) }
  }
  const text = editor?.draft.text ?? ''
  const length = Array.from(text).length
  const saving = !!submission && submission.draftId === editor?.draft.id && !receipt
  const setOpen = (next: boolean) => {
    if (next) { openNew(); return }
    if (timer.current !== undefined) flushDraft()
    const editing = current.current
    if (editing && editing.draft.thoughtId === null && !editing.draft.text.trim()) changeEditor(null)
    setSwitchTarget(null)
    setOpenState(false)
  }
  return {
    open, openNew, edit, setOpen,
    text, setText, maxLength: spec.thoughts.maxLength, length,
    canSave: !stale && !saving && (editor?.draft.thoughtId != null || !!text.trim()) && length <= spec.thoughts.maxLength,
    isExisting: editor?.draft.thoughtId != null,
    originalEnded: !!editor?.draft.sessionId && snapshot.records.some(r => r.sessionId === editor.draft.sessionId),
    conflict: stale, pendingEdit: switchTarget !== null, writeAnother: () => setSwitchTarget({ id: null }),
    discardAndSwitch: () => void discardAndSwitch(), cancelSwitch: () => setSwitchTarget(null),
    saveAsNew: () => save(true), discard: () => void discard(), reloadLatest,
    latestMarkerId: recent?.change === 'marked' && undoTarget?.deletedAt === null ? undoTarget.id : null, saving,
    mark: () => dispatch({ type: 'markThought' }), save: () => save(), putAway: id => manage('putAwayThought', id),
    reopen: id => manage('reopenThought', id), remove: id => manage('deleteThought', id), undo,
    status: stale ? errorStatus('另一窗口修改或删除了编辑对象。此页输入仍在，可查看最新内容或另存为新想法。') : recent ? statusOf(recent) : null,
  }
}
