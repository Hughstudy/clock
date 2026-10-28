import { applySettingsPatch, sameSettings, type SettingsPatch } from './settings'
import type { Spec } from './spec'
import { expireSession, pauseSession, resetSession, resumeSession, skipBreak, startSession } from './timer'
import type { AppSnapshot, DateKey, Phase, Settings } from './types'

export type AppAction =
  | { type: 'reconcile' }
  | { type: 'start'; sessionId: string; timeZone: string }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'reset' }
  | { type: 'skipBreak' }
  | { type: 'updateSettings'; patch: SettingsPatch }

export interface ActionContext {
  now: number
  /** Resolves an instant to its calendar date in an IANA zone. Supplied by the calendar adapter. */
  dateKeyOf: (epochMs: number, timeZone: string) => DateKey
}

export interface Completion {
  sessionId: string
  phase: Phase
  deadline: number
  /** True when this transition added the focus credit; false for breaks and repeats. */
  credited: boolean
}

/** A focus session reset before its deadline. Breaks are never reported. */
export interface Abandoned {
  sessionId: string
}

export interface Transition {
  snapshot: AppSnapshot
  completion: Completion | null
  abandoned: Abandoned | null
  changed: boolean
}

/**
 * Settles an expired running session: readies the next phase and, for focus,
 * records exactly one completion. Safe to call any number of times.
 */
export function reconcile(snapshot: AppSnapshot, ctx: ActionContext, spec: Spec): Transition {
  const { timer, expired } = expireSession(snapshot.timer, ctx.now, spec.timer.longBreakEvery)
  if (!expired) return { snapshot, completion: null, abandoned: null, changed: false }

  const alreadyCredited = snapshot.completions.some((r) => r.sessionId === expired.sessionId)
  const credited = expired.phase === 'focus' && !alreadyCredited
  const completions = credited
    ? [
        ...snapshot.completions,
        {
          sessionId: expired.sessionId,
          completedAt: expired.deadline,
          dateKey: ctx.dateKeyOf(expired.deadline, expired.timeZone),
          focusMs: expired.durationMs,
        },
      ]
    : snapshot.completions

  return {
    snapshot: { ...snapshot, timer, completions },
    completion: { sessionId: expired.sessionId, phase: expired.phase, deadline: expired.deadline, credited },
    abandoned: null,
    changed: true,
  }
}

function act(snapshot: AppSnapshot, action: AppAction, now: number, spec: Spec): AppSnapshot {
  const withTimer = (timer: AppSnapshot['timer']) => (timer === snapshot.timer ? snapshot : { ...snapshot, timer })
  switch (action.type) {
    case 'reconcile':
      return snapshot
    case 'start':
      return withTimer(startSession(snapshot.timer, snapshot.settings, now, action.sessionId, action.timeZone))
    case 'pause':
      return withTimer(pauseSession(snapshot.timer, now))
    case 'resume':
      return withTimer(resumeSession(snapshot.timer, now))
    case 'reset':
      return withTimer(resetSession(snapshot.timer))
    case 'skipBreak':
      return withTimer(skipBreak(snapshot.timer))
    case 'updateSettings': {
      const settings = applySettingsPatch(snapshot.settings, action.patch, spec)
      return sameSettings(settings, snapshot.settings) ? snapshot : { ...snapshot, settings }
    }
  }
}

/** Reconciles expiry first, then applies the action to the settled state. */
export function applyAction(snapshot: AppSnapshot, action: AppAction, ctx: ActionContext, spec: Spec): Transition {
  const settled = reconcile(snapshot, ctx, spec)
  const next = act(settled.snapshot, action, ctx.now, spec)
  // After reconciling, any session still present at reset is unexpired.
  const { timer } = settled.snapshot
  const abandoned =
    action.type === 'reset' && timer.session && timer.phase === 'focus' ? { sessionId: timer.session.id } : null
  return {
    snapshot: next,
    completion: settled.completion,
    abandoned,
    changed: settled.changed || next !== settled.snapshot,
  }
}

/** A completion noticed long after its deadline (e.g. on reopening) stays silent. */
export function shouldChime(completion: Completion, now: number, settings: Settings, spec: Spec): boolean {
  return settings.soundEnabled && now - completion.deadline <= spec.timer.completionSoundWindowMs
}
