import { useCallback, useEffect, useState } from 'react'
import { onExternalWrite, openBrowserStore } from '../adapters/browser-store'
import { currentTimeZone, dateKeyInZone, nowMs } from '../adapters/calendar'
import { newId } from '../adapters/ids'
import { onAppResume } from '../adapters/lifecycle'
import { createChime } from '../adapters/sound'
import type { Persistence, StoreNotice } from '../adapters/storage'
import { spec } from '../data/spec'
import { applyAction, shouldChime, type Abandoned, type AppAction, type Completion } from '../logic/app'
import type { SettingsPatch } from '../logic/settings'
import type { AppSnapshot, Phase } from '../logic/types'

export type UserAction =
  | { type: 'start' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'reset' }
  | { type: 'skipBreak' }
  | { type: 'updateSettings'; patch: SettingsPatch }

/** Whale-chan's transient reaction; never stored, so a reload cannot replay it. */
export interface Reaction {
  kind: 'rice' | 'cry'
  /** Distinguishes consecutive reactions of the same kind. */
  id: string
}

export interface ClockApp {
  snapshot: AppSnapshot
  persistence: Persistence
  notice: StoreNotice | null
  /** Set while the latest change could not be written to storage. */
  saveError: string | null
  /** Polite screen-reader message for completions and resets. */
  announcement: string
  reaction: Reaction | null
  dispatch: (action: UserAction) => void
}

// setTimeout overflows above this; longer waits are re-armed on resume.
const MAX_TIMEOUT_MS = 2 ** 31 - 1
const DEADLINE_SLACK_MS = 30

const PHASE_NAMES: Record<Phase, string> = { focus: 'Focus', shortBreak: 'Short break', longBreak: 'Long break' }

function announce(completion: Completion, next: Phase): string {
  const done = completion.credited
    ? `Focus session complete. ${spec.character.name} got a bowl of rice.`
    : `${PHASE_NAMES[completion.phase]} over.`
  return `${done} ${PHASE_NAMES[next]} is ready to start.`
}

export function useClockApp(): ClockApp {
  const [store] = useState(() => openBrowserStore(spec))
  const [chime] = useState(createChime)
  const [view, setView] = useState(() => ({ snapshot: store.snapshot, saveError: null as string | null, ...store.status }))
  const [announcement, setAnnouncement] = useState('')
  const [reaction, setReaction] = useState<Reaction | null>(null)

  const commit = useCallback(
    async (action: AppAction) => {
      const result = await store.transact((latest) => {
        // Read the clock inside the lock so a queued action sees the time it actually runs.
        const t = applyAction(latest, action, { now: nowMs(), dateKeyOf: dateKeyInZone }, spec)
        return { snapshot: t.snapshot, changed: t.changed, value: { completion: t.completion, abandoned: t.abandoned } }
      })
      setView({ snapshot: result.snapshot, saveError: result.error, ...store.status })
      const { completion, abandoned }: { completion: Completion | null; abandoned: Abandoned | null } = result.value
      if (completion) {
        if (shouldChime(completion, nowMs(), result.snapshot.settings, spec)) chime.play()
        setAnnouncement(announce(completion, result.snapshot.timer.phase))
        if (completion.credited) setReaction({ kind: 'rice', id: completion.sessionId })
      }
      if (abandoned) {
        setAnnouncement('Focus session reset. No rice this time, but nothing else is lost.')
        setReaction({ kind: 'cry', id: abandoned.sessionId })
      }
      if (action.type === 'start' && result.snapshot.timer.session?.id === action.sessionId) setReaction(null)
    },
    [store, chime],
  )

  const reconcile = useCallback(() => void commit({ type: 'reconcile' }), [commit])

  // Settle anything that expired while the app was closed, and again whenever it returns.
  useEffect(() => {
    reconcile()
    return onAppResume(reconcile)
  }, [reconcile])

  useEffect(
    () =>
      onExternalWrite((newValue) => {
        const received = store.receive(newValue)
        if (!received) return
        setView((prev) => ({ ...prev, snapshot: received.snapshot, ...store.status }))
        if (received.needsHeal) reconcile()
      }),
    [store, reconcile],
  )

  const session = view.snapshot.timer.session
  const deadline = session?.status === 'running' ? session.deadline : null
  useEffect(() => {
    if (deadline === null) return
    const delay = Math.min(MAX_TIMEOUT_MS, Math.max(0, deadline - nowMs()) + DEADLINE_SLACK_MS)
    const id = window.setTimeout(reconcile, delay)
    return () => window.clearTimeout(id)
  }, [deadline, reconcile])

  useEffect(() => {
    if (!reaction) return
    const id = window.setTimeout(() => setReaction(null), spec.character.reactionSeconds[reaction.kind] * 1000)
    return () => window.clearTimeout(id)
  }, [reaction])

  const dispatch = useCallback(
    (action: UserAction) => {
      // Unlock audio during the user's tap so the completion chime may play later;
      // turning sound on also plays a sample so the user hears it works.
      if (action.type === 'start' || action.type === 'resume') chime.unlock()
      if (action.type === 'updateSettings' && action.patch.soundEnabled === true) {
        chime.unlock()
        chime.play()
      }
      void commit(action.type === 'start' ? { type: 'start', sessionId: newId(), timeZone: currentTimeZone() } : action)
    },
    [commit, chime],
  )

  return { ...view, announcement, reaction, dispatch }
}
