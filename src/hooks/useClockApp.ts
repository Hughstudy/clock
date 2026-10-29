import { useCallback, useEffect, useRef, useState } from 'react'
import { onExternalWrite, openBrowserStore } from '../adapters/browser-store'
import { currentTimeZone, dateKeyInZone, nowMs } from '../adapters/calendar'
import { newId } from '../adapters/ids'
import { onAppResume } from '../adapters/lifecycle'
import { createChime } from '../adapters/sound'
import type { Persistence, StoreNotice } from '../adapters/storage'
import type { SaveState } from '../contracts/focus'
import { spec } from '../data/spec'
import { applyAction, shouldChime, type AppAction, type ThoughtChange } from '../logic/app'
import { feedbackFromTransition, type AppFeedbackEvent } from '../logic/feedback-host'
import type { FeedbackEvent } from '../logic/feedback'
import type { SettingsPatch } from '../logic/settings'
import type { AppSnapshot } from '../logic/types'

export type UserAction =
  | { type: 'start'; durationMinutes?: number; step?: string }
  | { type: 'startBreak' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'end' }
  | { type: 'skipBreak' }
  | { type: 'retrySave' }
  | { type: 'updateSettings'; patch: SettingsPatch }
  | { type: 'markThought' }
  /** Without `thoughtId`, creates a new thought. */
  | { type: 'saveThoughtText'; thoughtId?: string; text: string }
  | { type: 'saveThoughtDraft'; thoughtId: string | null; text: string }
  | { type: 'discardThoughtDraft' }
  | { type: 'putAwayThought' | 'reopenThought' | 'deleteThought' | 'restoreThought'; thoughtId: string }

/**
 * Outcome of the latest thought operation. `saved` is true only after the write
 * succeeded; `change` is null when the operation has not been applied yet.
 */
export interface ThoughtResult {
  operationId: string
  thoughtId: string
  change: ThoughtChange | 'rejected' | null
  saved: boolean
}

export interface ClockApp {
  snapshot: AppSnapshot
  persistence: Persistence
  notice: StoreNotice | null
  saveError: string | null
  saveState: SaveState
  feedbackEvent: AppFeedbackEvent | null
  thoughtResult: ThoughtResult | null
  dispatch: (action: UserAction) => void
}

const MAX_TIMEOUT_MS = 2 ** 31 - 1
const DEADLINE_SLACK_MS = 30

interface CommitOptions {
  origin?: FeedbackEvent['origin']
  operationId?: string | undefined
  /** Background writes (drafts) keep the current feedback and show no saving flicker. */
  quiet?: boolean
}

export function useClockApp(): ClockApp {
  const [store] = useState(() => openBrowserStore(spec))
  const [chime] = useState(createChime)
  const [view, setView] = useState(() => ({ snapshot: store.snapshot, saveError: null as string | null, ...store.status }))
  const [saveState, setSaveState] = useState<SaveState>(store.status.persistence)
  const [feedbackEvent, setFeedbackEvent] = useState<AppFeedbackEvent | null>(null)
  const [thoughtResult, setThoughtResult] = useState<ThoughtResult | null>(null)
  const inFlight = useRef(0)
  const retryAction = useRef<{ action: AppAction; id: string } | null>(null)
  const lastMarkAt = useRef(Number.NEGATIVE_INFINITY)

  const commit = useCallback(async (action: AppAction, { origin = 'user', operationId = newId(), quiet = false }: CommitOptions = {}) => {
    const silent = origin === 'restore' || origin === 'sync'
    const thoughtId = 'thoughtId' in action && action.thoughtId ? action.thoughtId : null
    inFlight.current += 1
    if (store.status.persistence === 'saved' && !quiet) setSaveState('saving')
    try {
      const result = await store.transact((latest) => {
        const t = applyAction(latest, action, { now: nowMs(), dateKeyOf: dateKeyInZone }, spec)
        return { snapshot: t.snapshot, changed: t.changed, value: { transition: t, before: latest } }
      })
      if (result.saved) retryAction.current = null
      else retryAction.current = { action: { type: 'reconcile' }, id: operationId }
      setView({ snapshot: result.snapshot, saveError: result.error, ...store.status })
      setSaveState(store.status.persistence !== 'saved' ? store.status.persistence : result.saved ? 'saved' : 'pending')
      const { transition, before } = result.value
      if (!quiet || !result.saved) {
        setFeedbackEvent(feedbackFromTransition(before, { ...transition, snapshot: result.snapshot }, action,
          { id: operationId, atMs: nowMs(), origin }, result.saved))
      }
      if (transition.thought) setThoughtResult({ operationId, thoughtId: transition.thought.id, change: transition.thought.change, saved: result.saved })
      const { completion } = transition
      if (!silent && result.saved && completion && shouldChime(completion, nowMs(), result.snapshot.settings, spec)) chime.play()
    } catch (error) {
      // Lock acquisition or adapter failures must not become unhandled rejections or false success.
      const message = error instanceof Error ? error.message : String(error)
      retryAction.current = { action, id: operationId }
      setView((prev) => ({ ...prev, saveError: message }))
      setSaveState('pending')
      if (thoughtId) setThoughtResult({ operationId, thoughtId, change: null, saved: false })
      setFeedbackEvent({ kind: 'reconcile', id: operationId, atMs: nowMs(), origin,
        generation: store.snapshot.datasetGeneration, revision: store.snapshot.revision })
    } finally {
      inFlight.current -= 1
      if (inFlight.current > 0 && store.status.persistence === 'saved' && !quiet) setSaveState('saving')
    }
  }, [store, chime])

  // Recovery is silent, even if it discovers a deadline a moment after it passed.
  const recover = useCallback(() => void commit(retryAction.current?.action ?? { type: 'reconcile' },
    { origin: 'restore', operationId: retryAction.current?.id }), [commit])
  useEffect(() => { recover(); return onAppResume(recover) }, [recover])

  useEffect(() => onExternalWrite((newValue) => {
    const received = store.receive(newValue)
    if (!received) return
    setView((prev) => ({ ...prev, snapshot: received.snapshot, ...store.status }))
    setFeedbackEvent({ kind: 'reconcile', id: newId(), atMs: nowMs(), origin: 'sync',
      generation: received.snapshot.datasetGeneration, revision: received.snapshot.revision })
    if (store.status.persistence !== 'saved') setSaveState(store.status.persistence)
    if (received.needsHeal) recover()
  }), [store, recover])

  const session = view.snapshot.timer.session
  const deadline = session?.status === 'running' ? session.deadline : null
  useEffect(() => {
    if (deadline === null) return
    const delay = Math.min(MAX_TIMEOUT_MS, Math.max(0, deadline - nowMs()) + DEADLINE_SLACK_MS)
    const id = window.setTimeout(() => void commit({ type: 'reconcile' }, { origin: document.visibilityState !== 'visible' ? 'restore' : 'expiry' }), delay)
    return () => window.clearTimeout(id)
  }, [deadline, commit])

  // Retry failed durable writes while this page remains alive; never rely on an exit event.
  useEffect(() => {
    if (saveState !== 'pending' || store.status.persistence !== 'saved') return
    const id = window.setTimeout(recover, 5000)
    return () => window.clearTimeout(id)
  }, [saveState, store, recover])

  const dispatch = useCallback((action: UserAction) => {
    if (store.status.persistence === 'read-only') return
    if (action.type === 'start' || action.type === 'startBreak' || action.type === 'resume') chime.unlock()
    if (action.type === 'updateSettings' && action.patch.soundEnabled === true) { chime.unlock(); chime.play() }
    switch (action.type) {
      case 'start':
        return void commit({ ...action, sessionId: newId(), timeZone: currentTimeZone(), expectedPhase: view.snapshot.timer.phase })
      case 'startBreak':
        return void commit({ ...action, sessionId: newId(), timeZone: currentTimeZone() })
      case 'retrySave':
        return void commit(retryAction.current?.action ?? { type: 'reconcile' }, { operationId: retryAction.current?.id })
      case 'pause':
      case 'resume':
      case 'end': {
        const id = view.snapshot.timer.session?.id
        if (id) void commit({ type: action.type, sessionId: id })
        return
      }
      case 'markThought': {
        // A double tap or held press is one marker; a later deliberate tap is another.
        const now = nowMs()
        if (now - lastMarkAt.current < spec.thoughts.markCoalesceMs) return
        lastMarkAt.current = now
        return void commit({ type: 'markThought', thoughtId: newId(), timeZone: currentTimeZone() })
      }
      case 'saveThoughtText':
        return void commit({ type: 'saveThoughtText', thoughtId: action.thoughtId ?? newId(), text: action.text, timeZone: currentTimeZone() })
      case 'saveThoughtDraft':
      case 'discardThoughtDraft':
        return void commit(action, { quiet: true })
      default:
        return void commit(action)
    }
  }, [store, commit, chime, view.snapshot.timer])

  return { ...view, saveState, feedbackEvent, thoughtResult, dispatch }
}
