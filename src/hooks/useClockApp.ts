import { useCallback, useEffect, useRef, useState } from 'react'
import { onExternalWrite, openBrowserStore } from '../adapters/browser-store'
import { currentTimeZone, dateKeyInZone, nowMs } from '../adapters/calendar'
import { newId } from '../adapters/ids'
import { onAppResume } from '../adapters/lifecycle'
import { createChime } from '../adapters/sound'
import type { Persistence, StoreNotice } from '../adapters/storage'
import type { SaveState } from '../contracts/focus'
import { spec } from '../data/spec'
import { applyAction, shouldChime, type AppAction } from '../logic/app'
import { feedbackFromTransition, type AppFeedbackEvent } from '../logic/feedback-host'
import type { FeedbackEvent } from '../logic/feedback'
import type { SettingsPatch } from '../logic/settings'
import type { AppSnapshot } from '../logic/types'

export type UserAction =
  | { type: 'start'; durationMinutes?: number }
  | { type: 'startBreak' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'end' }
  | { type: 'skipBreak' }
  | { type: 'retrySave' }
  | { type: 'updateSettings'; patch: SettingsPatch }

/** Presentation-only, never replayed by reload or external synchronization. */
export interface Reaction { kind: 'ended'; id: string }

export interface ClockApp {
  snapshot: AppSnapshot
  persistence: Persistence
  notice: StoreNotice | null
  saveError: string | null
  saveState: SaveState
  announcement: string
  reaction: Reaction | null
  feedbackEvent: AppFeedbackEvent | null
  dispatch: (action: UserAction) => void
}

const MAX_TIMEOUT_MS = 2 ** 31 - 1
const DEADLINE_SLACK_MS = 30

export function useClockApp(): ClockApp {
  const [store] = useState(() => openBrowserStore(spec))
  const [chime] = useState(createChime)
  const [view, setView] = useState(() => ({ snapshot: store.snapshot, saveError: null as string | null, ...store.status }))
  const [saveState, setSaveState] = useState<SaveState>(store.status.persistence)
  const [announcement, setAnnouncement] = useState('')
  const [reaction, setReaction] = useState<Reaction | null>(null)
  const [feedbackEvent, setFeedbackEvent] = useState<AppFeedbackEvent | null>(null)
  const inFlight = useRef(0)
  const retryAction = useRef<{ action: AppAction; id: string } | null>(null)

  const commit = useCallback(async (action: AppAction, origin: FeedbackEvent['origin'] = 'user', operationId = newId()) => {
    const silent = origin === 'restore' || origin === 'sync'
    inFlight.current += 1
    if (store.status.persistence === 'saved') setSaveState('saving')
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
      const { completion, ended, changed } = transition
      setFeedbackEvent(feedbackFromTransition(before, { ...transition, snapshot: result.snapshot }, action,
        { id: operationId, atMs: nowMs(), origin }, result.saved))
      if (!result.saved) {
        setReaction(null)
        if (changed) setAnnouncement('本次进度尚未保存，请保留页面并重试。')
      } else if (!silent && ended) {
        setAnnouncement('这一段已记录。可以休息，也可以稍后再来。')
        setReaction({ kind: 'ended', id: ended.sessionId })
      } else if (!silent && action.type === 'reconcile') {
        setAnnouncement('进度已保存。')
      }
      if (!silent && result.saved && completion && shouldChime(completion, nowMs(), result.snapshot.settings, spec)) chime.play()
      if (action.type === 'start' || action.type === 'startBreak' || action.type === 'pause' || action.type === 'resume') setReaction(null)
    } catch (error) {
      // Lock acquisition or adapter failures must not become unhandled rejections or false success.
      const message = error instanceof Error ? error.message : String(error)
      retryAction.current = { action, id: operationId }
      setView((prev) => ({ ...prev, saveError: message }))
      setSaveState('pending')
      setAnnouncement('操作尚未完成，请保留页面并重试。')
      setReaction(null)
      setFeedbackEvent({ kind: 'reconcile', id: operationId, atMs: nowMs(), origin,
        generation: store.snapshot.datasetGeneration, revision: store.snapshot.revision })
    } finally {
      inFlight.current -= 1
      if (inFlight.current > 0 && store.status.persistence === 'saved') setSaveState('saving')
    }
  }, [store, chime])

  // Recovery is silent, even if it discovers a deadline a moment after it passed.
  const recover = useCallback(() => void commit(retryAction.current?.action ?? { type: 'reconcile' }, 'restore', retryAction.current?.id), [commit])
  useEffect(() => { recover(); return onAppResume(recover) }, [recover])

  useEffect(() => onExternalWrite((newValue) => {
    const received = store.receive(newValue)
    if (!received) return
    setView((prev) => ({ ...prev, snapshot: received.snapshot, ...store.status }))
    setReaction(null)
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
    const id = window.setTimeout(() => void commit({ type: 'reconcile' }, document.visibilityState !== 'visible' ? 'restore' : 'expiry'), delay)
    return () => window.clearTimeout(id)
  }, [deadline, commit])

  // Retry failed durable writes while this page remains alive; never rely on an exit event.
  useEffect(() => {
    if (saveState !== 'pending' || store.status.persistence !== 'saved') return
    const id = window.setTimeout(recover, 5000)
    return () => window.clearTimeout(id)
  }, [saveState, store, recover])

  useEffect(() => {
    if (!reaction) return
    const id = window.setTimeout(() => setReaction(null), spec.character.reactionSeconds.ended * 1000)
    return () => window.clearTimeout(id)
  }, [reaction])

  const dispatch = useCallback((action: UserAction) => {
    if (store.status.persistence === 'read-only') return
    if (action.type === 'start' || action.type === 'startBreak' || action.type === 'resume') chime.unlock()
    if (action.type === 'updateSettings' && action.patch.soundEnabled === true) { chime.unlock(); chime.play() }
    if (action.type === 'start') {
      void commit({ ...action, sessionId: newId(), timeZone: currentTimeZone(), expectedPhase: view.snapshot.timer.phase })
    } else if (action.type === 'startBreak') {
      void commit({ ...action, sessionId: newId(), timeZone: currentTimeZone() })
    } else if (action.type === 'retrySave') {
      void commit(retryAction.current?.action ?? { type: 'reconcile' }, 'user', retryAction.current?.id)
    } else if (action.type === 'pause' || action.type === 'resume' || action.type === 'end') {
      const id = view.snapshot.timer.session?.id
      if (id) void commit({ type: action.type, sessionId: id })
    } else void commit(action)
  }, [store, commit, chime, view.snapshot.timer])

  return { ...view, saveState, announcement, reaction, feedbackEvent, dispatch }
}
