import { applySettingsPatch, isValidDuration, sameSettings, type SettingsPatch } from './settings'
import type { Spec } from './spec'
import { breakAfterFocus, expireSession, pauseSession, remainingMs, resetSession, resumeSession, skipBreak, startSession } from './timer'
import type { AppSnapshot, DateKey, FocusRecord, Phase, Settings } from './types'

export type AppAction =
  | { type: 'reconcile' }
  | { type: 'start'; sessionId: string; timeZone: string; durationMinutes?: number; expectedPhase?: Phase }
  | { type: 'startBreak'; sessionId: string; timeZone: string }
  | { type: 'pause' | 'resume' | 'end'; sessionId?: string }
  | { type: 'skipBreak' }
  | { type: 'updateSettings'; patch: SettingsPatch }

export interface ActionContext {
  now: number
  dateKeyOf: (epochMs: number, timeZone: string) => DateKey
}

export interface Completion {
  sessionId: string
  phase: Phase
  deadline: number
  /** True only for a newly recorded full focus session. */
  credited: boolean
}

export interface Transition {
  snapshot: AppSnapshot
  completion: Completion | null
  /** Newly recorded focus, whether ended manually or at its deadline. */
  ended: FocusRecord | null
  changed: boolean
}

const unchanged = (snapshot: AppSnapshot): Transition => ({ snapshot, completion: null, ended: null, changed: false })

/** Settle at most one phase, without starting the next phase. */
export function reconcile(snapshot: AppSnapshot, ctx: ActionContext, spec: Spec): Transition {
  const active = snapshot.timer.session
  // A delayed write must not revive a session that already has an end record.
  const known = active && snapshot.records.find((r) => r.sessionId === active.id)
  if (known && snapshot.timer.phase === 'focus') {
    const count = Math.max(snapshot.timer.completedFocusCount, snapshot.records.filter((r) => r.endReason === 'deadline').length)
    const phase = known.endReason === 'deadline' ? breakAfterFocus(count, spec.timer.longBreakEvery) : 'focus'
    return { ...unchanged(snapshot), snapshot: { ...snapshot, timer: { phase, session: null, completedFocusCount: count } }, changed: true }
  }
  const { timer, expired } = expireSession(snapshot.timer, ctx.now, spec.timer.longBreakEvery)
  if (!expired) return unchanged(snapshot)
  const ended: FocusRecord | null = expired.phase === 'focus' ? {
    sessionId: expired.sessionId,
    startedAt: expired.startedAt,
    endedAt: expired.deadline,
    dateKey: ctx.dateKeyOf(expired.deadline, expired.timeZone),
    targetMs: expired.durationMs,
    elapsedMs: expired.durationMs,
    endReason: 'deadline',
    source: expired.startedAt === null ? 'legacy' : 'native',
  } : null
  return {
    snapshot: { ...snapshot, timer, records: ended ? [...snapshot.records, ended] : snapshot.records },
    completion: { sessionId: expired.sessionId, phase: expired.phase, deadline: expired.deadline, credited: ended !== null },
    ended,
    changed: true,
  }
}

function act(snapshot: AppSnapshot, action: AppAction, ctx: ActionContext, spec: Spec): Transition {
  const { now } = ctx
  const withTimer = (timer: AppSnapshot['timer']): Transition => ({ ...unchanged(snapshot), snapshot: { ...snapshot, timer }, changed: timer !== snapshot.timer })
  if ((action.type === 'pause' || action.type === 'resume' || action.type === 'end') &&
      action.sessionId !== undefined && snapshot.timer.session?.id !== action.sessionId) return unchanged(snapshot)
  switch (action.type) {
    case 'reconcile': return unchanged(snapshot)
    case 'start':
    case 'startBreak': {
      if (snapshot.timer.session || snapshot.records.some((r) => r.sessionId === action.sessionId) ||
          snapshot.participations.some((r) => r.sessionId === action.sessionId)) return unchanged(snapshot)
      if (action.type === 'start' && action.expectedPhase !== undefined && action.expectedPhase !== snapshot.timer.phase) return unchanged(snapshot)
      const timer = action.type === 'startBreak' ? { ...snapshot.timer, phase: 'shortBreak' as const } : snapshot.timer
      const duration = action.type === 'start' ? action.durationMinutes : undefined
      if (duration !== undefined && !isValidDuration(timer.phase, duration, spec)) return unchanged(snapshot)
      const started = startSession(timer, snapshot.settings, now, action.sessionId, action.timeZone, duration)
      return {
        ...unchanged(snapshot), changed: true,
        snapshot: { ...snapshot, timer: started, participations: timer.phase === 'focus'
          ? [...snapshot.participations, { sessionId: action.sessionId, participatedAt: now, dateKey: ctx.dateKeyOf(now, action.timeZone), source: 'native' }]
          : snapshot.participations },
      }
    }
    case 'pause': return withTimer(pauseSession(snapshot.timer, now))
    case 'resume': return withTimer(resumeSession(snapshot.timer, now))
    case 'end': {
      const session = snapshot.timer.session
      if (!session) return unchanged(snapshot)
      if (snapshot.timer.phase !== 'focus') return withTimer(skipBreak(snapshot.timer))
      const ended: FocusRecord = {
        sessionId: session.id,
        startedAt: session.startedAt,
        endedAt: now,
        dateKey: ctx.dateKeyOf(now, session.timeZone),
        targetMs: session.durationMs,
        elapsedMs: session.durationMs - remainingMs(snapshot.timer, snapshot.settings, now),
        endReason: 'manual',
        source: session.startedAt === null ? 'legacy' : 'native',
      }
      return { snapshot: { ...snapshot, timer: resetSession(snapshot.timer), records: [...snapshot.records, ended] }, completion: null, ended, changed: true }
    }
    case 'skipBreak': return withTimer(skipBreak(snapshot.timer))
    case 'updateSettings': {
      const settings = applySettingsPatch(snapshot.settings, action.patch, spec)
      return sameSettings(settings, snapshot.settings) ? unchanged(snapshot)
        : { ...unchanged(snapshot), snapshot: { ...snapshot, settings }, changed: true }
    }
  }
}

/** Expiry wins a race with manual end. Guard session actions against stale tabs. */
export function applyAction(snapshot: AppSnapshot, action: AppAction, ctx: ActionContext, spec: Spec): Transition {
  const settled = reconcile(snapshot, ctx, spec)
  const next = act(settled.snapshot, action, ctx, spec)
  return { snapshot: next.snapshot, completion: settled.completion, ended: next.ended ?? settled.ended, changed: settled.changed || next.changed }
}

export function shouldChime(completion: Completion, now: number, settings: Settings, spec: Spec): boolean {
  return settings.soundEnabled && now >= completion.deadline && now - completion.deadline <= spec.timer.completionSoundWindowMs
}
