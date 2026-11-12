import { useCallback, useEffect, useRef, useState } from 'react'
import { onExternalWrite, openBrowserStore } from '../adapters/browser-store'
import { currentTimeZone, dateKeyInZone, nowMs } from '../adapters/calendar'
import { newId } from '../adapters/ids'
import { onAppResume } from '../adapters/lifecycle'
import { createChime } from '../adapters/sound'
import type { Persistence, StoreNotice } from '../adapters/storage'
import type { SaveState } from '../contracts/focus'
import { spec } from '../data/spec'
import { applyAction, expiredSessionResult, resolveSessionResult, shouldChime, standingFocusResult, type AppAction, type FavoriteAction, type SessionResult, type ThoughtAction, type ThoughtChange } from '../logic/app'
import { feedbackFromTransition, type AppFeedbackEvent } from '../logic/feedback-host'
import type { FeedbackEvent } from '../logic/feedback'
import type { SettingsPatch } from '../logic/settings'
import type { AppSnapshot, Phase, RestMemory, Thought } from '../logic/types'
import { datePendingDeletion } from '../logic/thoughts'
import type { SavedQuote } from '../contracts/favorites'
import { feedbackCatalog } from '../data/encouragement'

export type UserAction =
  | { type: 'start' | 'startFocus'; durationMinutes?: number; step?: string }
  | { type: 'startBreak'; phase?: 'shortBreak' | 'longBreak'; durationMinutes?: number }
  | { type: 'pause' | 'resume' | 'end' | 'skipBreak' | 'retrySave' | 'resetDurations' | 'markThought' }
  | { type: 'updateSettings'; patch: SettingsPatch }
  | { type: 'prepare'; phase: Phase }

export interface ThoughtResult {
  operationId: string
  generation: number
  thoughtId: string
  change: ThoughtChange | 'rejected' | null
  revision: number | null
  saved: boolean
}

export type { SessionResult } from '../logic/app'

export interface ClockApp {
  snapshot: AppSnapshot
  savedRecordIds: ReadonlySet<string>
  durableThoughts: readonly Thought[]
  durableRests: readonly RestMemory[]
  durableFavorites: readonly SavedQuote[]
  timerPending: boolean
  persistence: Persistence
  notice: StoreNotice | null
  saveError: string | null
  saveState: SaveState
  feedbackEvent: AppFeedbackEvent | null
  thoughtResult: ThoughtResult | null
  thoughtReceipts: ReadonlyMap<string, ThoughtResult>
  submitThought: (action: ThoughtAction, operationId: string, generation: number) => Promise<boolean>
  submitFavorite: (action: FavoriteAction, operationId: string, generation: number) => Promise<{ accepted: boolean; rejected: boolean }>
  hasPendingOperations: boolean
  checkReload: () => Promise<boolean>
  dispatch: (action: UserAction) => void
  result: SessionResult | null
}

interface CommitOptions {
  origin?: FeedbackEvent['origin']
  operationId?: string
  quiet?: boolean
  onlyPending?: boolean
  onRejected?: () => void
}
interface Pending {
  action: AppAction
  generation: number
  error: string
  /** An applied change only needs its snapshot written. Never replay its timer transition. */
  applied: boolean
}
interface PendingThought extends Thought {
  retirement?: { previous: string | null; next: string }
}
const EMPTY_THOUGHTS: readonly Thought[] = []
const EMPTY_RESTS: readonly RestMemory[] = []
const EMPTY_FAVORITES: readonly SavedQuote[] = []
const TIMER_COMMANDS = new Set(['start', 'startFocus', 'startBreak', 'pause', 'resume', 'end', 'skipBreak', 'prepare'])

export function useClockApp(): ClockApp {
  const [store] = useState(() => openBrowserStore(spec))
  const [chime] = useState(createChime)
  const [view, setView] = useState(() => ({
    snapshot: store.snapshot, savedRecordIds: store.savedRecordIds, saveError: null as string | null, ...store.status,
  }))
  const [saveState, setSaveState] = useState<SaveState>(store.status.persistence)
  const [feedbackEvent, setFeedbackEvent] = useState<AppFeedbackEvent | null>(null)
  const [thoughtResult, setThoughtResult] = useState<ThoughtResult | null>(null)
  const [thoughtReceipts, setThoughtReceipts] = useState<ReadonlyMap<string, ThoughtResult>>(new Map())
  const receipts = useRef(new Map<string, ThoughtResult>())
  const unconfirmed = useRef(new Map<string, PendingThought>())
  const pending = useRef(new Map<string, Pending>())
  // A focus session that ended while this page was hidden, then reloaded, still shows its saved result.
  const [result, setResult] = useState<SessionResult | null>(() => standingFocusResult(store.snapshot, nowMs(), spec, store.savedRecordIds))
  const shownSession = useRef(store.snapshot.timer.session)
  const lastMark = useRef<{ at: number; key: string; id: string; inFlight: boolean } | null>(null)
  const generation = useRef(store.snapshot.datasetGeneration)
  const queue = useRef(Promise.resolve())
  const inFlight = useRef(0)
  const queuedOperations = useRef(0)
  const [timerPendingCount, setTimerPendingCount] = useState(0)

  const remember = useCallback((receipt: ThoughtResult) => {
    receipts.current.set(receipt.operationId, receipt)
    // Completed history is only needed for the current editor and recent controls.
    for (const [id, item] of receipts.current) {
      if (receipts.current.size <= 32) break
      if (item.saved || item.change === 'rejected') receipts.current.delete(id)
    }
    setThoughtReceipts(new Map(receipts.current))
    setThoughtResult([...receipts.current.values()].at(-1) ?? null)
  }, [])

  const refresh = useCallback(() => {
    const snapshot = store.snapshot
    if (generation.current !== snapshot.datasetGeneration) {
      generation.current = snapshot.datasetGeneration
      pending.current.clear()
      unconfirmed.current.clear()
      receipts.current.clear()
      setThoughtReceipts(new Map())
      setThoughtResult(null)
      setResult(null)
      lastMark.current = null
    }
    const stored = store.durableSnapshot
    if (stored && stored.datasetGeneration === snapshot.datasetGeneration) {
      for (const [id, wanted] of unconfirmed.current) {
        const receipt = receipts.current.get(id)
        const found = stored.thoughts.find(t => t.id === wanted.id)
        if (!receipt || !found) continue
        if (found.rev === wanted.rev && found.text === wanted.text && found.status === wanted.status && found.deletedAt === wanted.deletedAt) {
          // Unchanged text can already match the durable note before this save.
          // A save is confirmed only when its draft retirement also reached disk.
          if (wanted.retirement && stored.draftStamp !== wanted.retirement.next) {
            if (stored.draftStamp === wanted.retirement.previous) continue
            unconfirmed.current.delete(id)
            remember({ ...receipt, change: 'rejected' })
            continue
          }
          unconfirmed.current.delete(id)
          remember({ ...receipt, saved: true })
        } else if (found.rev >= wanted.rev) {
          unconfirmed.current.delete(id)
          remember({ ...receipt, change: 'rejected' })
        }
      }
    }
    const ids = store.savedRecordIds
    const expired = expiredSessionResult(shownSession.current, snapshot)
    shownSession.current = snapshot.timer.session
    setResult(prev => resolveSessionResult(expired ?? prev, snapshot, stored))
    const saveError = [...pending.current.values()].at(-1)?.error ?? null
    setView({ snapshot, savedRecordIds: ids, saveError, ...store.status })
    setSaveState(store.status.persistence !== 'saved' ? store.status.persistence : saveError ? 'pending' : 'saved')
  }, [store, remember])

  const commit = useCallback((input: AppAction, { origin = 'user', operationId = newId(), quiet = false, onlyPending = false, onRejected }: CommitOptions = {}): Promise<boolean> => {
    const action = { ...input, generation: input.generation ?? store.snapshot.datasetGeneration }
    queuedOperations.current++
    const timerCommand = TIMER_COMMANDS.has(action.type)
    if (timerCommand) setTimerPendingCount(count => count + 1)
    const at = nowMs()
    if (!quiet) {
      inFlight.current++
      if (store.status.persistence === 'saved') setSaveState('saving')
    }
    const run = async () => {
      try {
        if (onlyPending && !pending.current.has(operationId)) return true
        const write = await store.transact(latest => {
          const now = nowMs()
          let before = latest
          // A failed deletion has no durable undo deadline yet. Preserve its text
          // through retries and start the ten minutes on the accepted write.
          if (action.generation === latest.datasetGeneration && generation.current === action.generation) {
            for (const [id, pending] of unconfirmed.current) {
              if (pending.deletedAt === null) continue
              const current = before.thoughts.find(t => t.id === pending.id)
              const durable = store.durableSnapshot?.thoughts.find(t => t.id === pending.id)
              const dated = datePendingDeletion(current, durable, pending, now)
              if (dated) {
                before = { ...before, thoughts: before.thoughts.map(t => t.id === pending.id ? dated : t) }
                unconfirmed.current.set(id, dated)
              }
            }
          }
          const t = applyAction(before, action, { now, dateKeyOf: dateKeyInZone, quoteCatalog: feedbackCatalog.entries }, spec)
          return { snapshot: t.snapshot, changed: t.changed || before !== latest, value: { transition: t, before } }
        })
        refresh()
        if (action.generation !== store.snapshot.datasetGeneration) return false
        const { transition, before } = write.value
        const accepted = !transition.draftConflict && !transition.favoriteRejected && transition.thought?.change !== 'rejected'
        if (!accepted) onRejected?.()
        if (write.saved) {
          // One successful snapshot write includes prior applied changes. A lock failure
          // has no applied change and keeps its original, separately retryable command.
          for (const [id, job] of pending.current) if (job.applied || id === operationId) pending.current.delete(id)
        } else if (write.error) {
          pending.current.set(operationId, { action, applied: true, generation: action.generation, error: write.error })
        }
        const noted = transition.thought
        if (noted) {
          const wanted = write.snapshot.thoughts.find(t => t.id === noted.id)
          if (wanted && !write.saved && accepted) unconfirmed.current.set(operationId, {
            ...wanted,
            ...(action.type === 'saveThoughtText' && action.stamp ? { retirement: { previous: before.draftStamp, next: action.stamp } } : {}),
          })
          remember({ operationId, generation: action.generation, thoughtId: noted.id, revision: wanted?.rev ?? null,
            change: noted.change, saved: write.saved && accepted })
        }
        if (action.type === 'prepare' && !transition.completion && !write.snapshot.timer.session && write.snapshot.timer.phase === action.phase) setResult(null)
        if ((!quiet && action.type !== 'prepare') || !write.saved || transition.completion) setFeedbackEvent(feedbackFromTransition(before, { ...transition, snapshot: write.snapshot }, action,
          { id: operationId, atMs: at, origin }, write.saved))
        const ended = transition.ended
        const previous = before.timer.session
        if (!write.snapshot.timer.session && ended) {
          setResult(resolveSessionResult({ sessionId: ended.sessionId, phase: 'focus', elapsedMs: ended.elapsedMs, saved: write.saved }, write.snapshot, store.durableSnapshot))
        } else if (!write.snapshot.timer.session && previous && before.timer.phase !== 'focus' &&
            (transition.completion || action.type === 'end' || action.type === 'skipBreak')) {
          const ending = write.snapshot.lastRestEnd
          if (ending?.sessionId === previous.id) setResult({ sessionId: previous.id, phase: 'rest', elapsedMs: ending.elapsedMs, saved: write.saved })
        }
        const { completion } = transition
        if (origin !== 'restore' && origin !== 'sync' && write.saved && completion && shouldChime(completion, nowMs(), write.snapshot.settings, spec)) chime.play()
        // The editable in-memory draft may advance despite an unavailable disk.
        return accepted && store.status.persistence !== 'read-only'
      } catch (error) {
        if (action.generation !== store.snapshot.datasetGeneration) return false
        const message = error instanceof Error ? error.message : String(error)
        pending.current.set(operationId, { action, applied: false, generation: action.generation, error: message })
        if ('thoughtId' in action) remember({ operationId, generation: action.generation, thoughtId: action.thoughtId, change: null, saved: false, revision: null })
        return false
      } finally {
        queuedOperations.current--
        if (timerCommand) setTimerPendingCount(count => Math.max(0, count - 1))
        if (!quiet) inFlight.current--
        refresh()
        if (inFlight.current && store.status.persistence === 'saved') setSaveState('saving')
      }
    }
    // A tab observes its commands in submission order, including callbacks. Other
    // tabs still serialize against the latest snapshot under the shared Web Lock.
    const done = queue.current.then(run)
    queue.current = done.then(() => {}, () => {})
    return done
  }, [store, chime, refresh, remember])

  const recover = useCallback((origin: FeedbackEvent['origin'] = 'restore', opening = false) => {
    const jobs = [...pending.current]
    if (!jobs.length) { void commit(opening ? { type: 'reconcile', opening } : { type: 'reconcile' }, { origin }); return }
    for (const [id, job] of jobs) {
      void commit(job.applied ? { type: 'reconcile', generation: job.generation } : job.action, { origin, operationId: id, onlyPending: true })
    }
  }, [commit])
  useEffect(() => { recover('restore', true); return onAppResume(() => recover()) }, [recover])

  useEffect(() => onExternalWrite(newValue => {
    const received = store.receive(newValue)
    if (!received) return
    if (store.status.notice?.kind === 'removed') { pending.current.clear(); unconfirmed.current.clear() }
    refresh()
    setFeedbackEvent({ kind: 'reconcile', id: newId(), atMs: nowMs(), origin: 'sync',
      generation: received.snapshot.datasetGeneration, revision: received.snapshot.revision })
    if (received.needsHeal) recover()
  }), [store, recover, refresh])

  const session = view.snapshot.timer.session
  const deadline = session?.status === 'running' ? session.deadline : null
  useEffect(() => {
    if (deadline === null) return
    const delay = Math.min(2 ** 31 - 1, Math.max(0, deadline - nowMs()) + 30)
    const id = window.setTimeout(() => void commit({ type: 'reconcile' }, { origin: document.visibilityState !== 'visible' ? 'restore' : 'expiry' }), delay)
    return () => window.clearTimeout(id)
  }, [deadline, commit])

  useEffect(() => {
    if (saveState !== 'pending' || store.status.persistence !== 'saved') return
    const id = window.setInterval(() => recover(), 5000)
    return () => window.clearInterval(id)
  }, [saveState, store, recover])

  const submitThought = useCallback((action: ThoughtAction, operationId: string, gen: number) =>
    commit({ ...action, generation: gen }, { operationId, quiet: action.type === 'writeDraft' }), [commit])
  const submitFavorite = useCallback(async (action: FavoriteAction, operationId: string, gen: number) => {
    let rejected = false
    const accepted = await commit({ ...action, generation: gen }, { operationId, quiet: true, onRejected: () => { rejected = true } })
    return { accepted, rejected }
  }, [commit])

  const checkReload = useCallback(async () => {
    await queue.current
    if (pending.current.size || unconfirmed.current.size || queuedOperations.current) return false
    // A newer-schema fallback has no editable data. Reloading is its recovery
    // path; do not try to decode, transact or overwrite the protected raw data.
    if (store.status.notice?.kind === 'newer') return true
    if (store.status.persistence !== 'saved') return false
    const checkedGeneration = store.snapshot.datasetGeneration
    try {
      const checked = await store.transact(latest => ({ snapshot: latest, changed: false, value: !latest.timer.session && !latest.thoughtDraft }))
      refresh()
      return checked.saved && checked.value && checked.snapshot.datasetGeneration === checkedGeneration && !pending.current.size && !queuedOperations.current
    } catch { return false }
  }, [store, refresh])

  const dispatch = useCallback((action: UserAction) => {
    if (store.status.persistence === 'read-only') return
    const { timer, datasetGeneration } = view.snapshot
    if (action.type === 'start' || action.type === 'startFocus' || action.type === 'startBreak' || action.type === 'resume') chime.unlock()
    if (action.type === 'updateSettings' && action.patch.soundEnabled === true) chime.unlock()
    switch (action.type) {
      case 'start':
      case 'startFocus':
      case 'startBreak':
        return void commit({ ...action, sessionId: newId(), timeZone: currentTimeZone(), expectedPhase: timer.phase, generation: datasetGeneration })
      case 'retrySave':
        return recover('user')
      case 'pause':
      case 'resume':
      case 'end':
        if (timer.session) void commit({ type: action.type, sessionId: timer.session.id, generation: datasetGeneration })
        return
      case 'skipBreak':
        return void commit({ type: action.type, sessionId: timer.session?.id ?? null, generation: datasetGeneration })
      case 'markThought': {
        const at = nowMs()
        const activation = performance.now()
        const session = timer.phase === 'focus' && !(timer.session?.status === 'running' && timer.session.deadline <= at) ? timer.session : null
        const key = JSON.stringify([datasetGeneration, session?.id ?? null])
        const last = lastMark.current
        const previous = last && store.snapshot.thoughts.find(t => t.id === last.id)
        if (last?.key === key && activation - last.at < spec.thoughts.markCoalesceMs &&
            (last.inFlight || previous?.deletedAt === null && previous.rev === 1 && previous.text === '')) return
        const id = newId(), mark = { at: activation, key, id, inFlight: true }
        lastMark.current = mark
        return void commit({ type: 'markThought', thoughtId: id, timeZone: session?.timeZone ?? currentTimeZone(), owner: { at, sessionId: session?.id ?? null }, generation: datasetGeneration })
          .finally(() => { if (lastMark.current === mark) mark.inFlight = false })
      }
      case 'resetDurations':
        return void commit({ type: 'resetDurations', generation: datasetGeneration })
      case 'prepare':
        return void commit({ type: 'prepare', phase: action.phase, expectedPhase: timer.phase, generation: datasetGeneration })
      case 'updateSettings':
        return void commit({ ...action, generation: datasetGeneration })
    }
  }, [store, commit, chime, view.snapshot, recover])

  const durable = store.durableSnapshot?.datasetGeneration === view.snapshot.datasetGeneration ? store.durableSnapshot : null
  return { ...view, saveState, feedbackEvent, thoughtResult, thoughtReceipts, submitThought, submitFavorite, dispatch, result,
    timerPending: timerPendingCount > 0, durableFavorites: durable?.quoteFavorites ?? EMPTY_FAVORITES,
    hasPendingOperations: pending.current.size > 0 || unconfirmed.current.size > 0 || queuedOperations.current > 0 || timerPendingCount > 0,
    checkReload,
    durableRests: durable?.restMemories ?? EMPTY_RESTS,
    durableThoughts: durable?.thoughts ?? EMPTY_THOUGHTS }
}
