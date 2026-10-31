import { applySettingsPatch, isValidDuration, sameSettings, type SettingsPatch } from './settings'
import { selectScene } from './scenes'
import type { Spec } from './spec'
import { canRestore, isLive, normalizeStep, normalizeThoughtText, purgeExpiredText, sameDraft } from './thoughts'
import { breakAfterFocus, expireSession, pauseSession, remainingMs, resetSession, resumeSession, skipBreak, startSession } from './timer'
import type { AppSnapshot, DateKey, FocusRecord, Phase, Settings, Thought } from './types'

export type ThoughtAction =
  /** One tap: an empty marker, linked to the running or paused focus session if there is one. */
  | { type: 'markThought'; thoughtId: string; timeZone: string }
  /** Saves text to an existing live thought, or creates the thought if the ID is new. Clears the draft. */
  | { type: 'saveThoughtText'; thoughtId: string; text: string; timeZone: string }
  | { type: 'saveThoughtDraft'; thoughtId: string | null; text: string }
  | { type: 'discardThoughtDraft' }
  | { type: 'putAwayThought' | 'reopenThought' | 'deleteThought' | 'restoreThought'; thoughtId: string }

export type AppAction =
  | { type: 'reconcile' }
  /** An explicit `durationMinutes` is a one-off choice: remembered for focus, never a new default. */
  | { type: 'start'; sessionId: string; timeZone: string; durationMinutes?: number; expectedPhase?: Phase; step?: string }
  | { type: 'startBreak'; sessionId: string; timeZone: string }
  | { type: 'pause' | 'resume' | 'end'; sessionId?: string }
  | { type: 'skipBreak' }
  | { type: 'updateSettings'; patch: SettingsPatch }
  | ThoughtAction

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

export type ThoughtChange = 'marked' | 'text' | 'putAway' | 'reopened' | 'deleted' | 'restored'

export interface Transition {
  snapshot: AppSnapshot
  completion: Completion | null
  /** Newly recorded focus, whether ended manually or at its deadline. */
  ended: FocusRecord | null
  /** The thought an action changed. `rejected` when the target was deleted or the request no longer applies. */
  thought: { id: string; change: ThoughtChange | 'rejected' } | null
  changed: boolean
}

const unchanged = (snapshot: AppSnapshot): Transition => ({ snapshot, completion: null, ended: null, thought: null, changed: false })

/** The focus length a plain start captures: the last one-off choice, else the configured default. */
export function nextFocusMinutes(snapshot: AppSnapshot, spec: Spec): number {
  const last = snapshot.lastFocusMinutes
  return last !== null && isValidDuration('focus', last, spec) ? last : snapshot.settings.durationsMinutes.focus
}

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
    step: expired.step,
    ...(active?.scene ? { scene: active.scene } : {}),
  } : null
  const records = ended ? [...snapshot.records, ended] : snapshot.records
  const scenes: AppSnapshot['scenes'] = { ...snapshot.scenes, lastEnded: active?.scene ? {
    sessionId: active.id, phase: expired.phase === 'focus' ? 'focus' : 'rest', scene: active.scene,
    elapsedMs: expired.durationMs, endedAt: expired.deadline,
  } : null }
  return {
    snapshot: { ...snapshot, timer, records, scenes },
    completion: { sessionId: expired.sessionId, phase: expired.phase, deadline: expired.deadline, credited: ended !== null },
    ended,
    thought: null,
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
      const focus = timer.phase === 'focus'
      const chosen = action.type === 'start' ? action.durationMinutes : undefined
      if (chosen !== undefined && !isValidDuration(timer.phase, chosen, spec)) return unchanged(snapshot)
      const duration = chosen ?? (focus ? nextFocusMinutes(snapshot, spec) : undefined)
      const step = focus && action.type === 'start' ? normalizeStep(action.step, spec.timer.stepMaxLength) : null
      const started = startSession(timer, snapshot.settings, now, action.sessionId, action.timeZone, duration, step)
      const selection = selectScene(snapshot.scenes, focus ? 'focus' : 'rest', action.sessionId)
      return {
        ...unchanged(snapshot), changed: true,
        snapshot: { ...snapshot, timer: { ...started, session: started.session ? { ...started.session, scene: selection.assignment } : null }, scenes: selection.scenes,
          lastFocusMinutes: focus && chosen !== undefined ? chosen : snapshot.lastFocusMinutes,
          participations: focus
            ? [...snapshot.participations, { sessionId: action.sessionId, participatedAt: now, dateKey: ctx.dateKeyOf(now, action.timeZone), source: 'native' }]
            : snapshot.participations },
      }
    }
    case 'pause': return withTimer(pauseSession(snapshot.timer, now))
    case 'resume': return withTimer(resumeSession(snapshot.timer, now))
    case 'end': {
      const session = snapshot.timer.session
      if (!session) return unchanged(snapshot)
      if (snapshot.timer.phase !== 'focus') return {
        ...unchanged(snapshot), changed: true,
        snapshot: { ...snapshot, timer: skipBreak(snapshot.timer), scenes: { ...snapshot.scenes, lastEnded: session.scene ? {
          sessionId: session.id, phase: 'rest', scene: session.scene,
          elapsedMs: session.durationMs - remainingMs(snapshot.timer, snapshot.settings, now), endedAt: now,
        } : null } },
      }
      const ended: FocusRecord = {
        sessionId: session.id,
        startedAt: session.startedAt,
        endedAt: now,
        dateKey: ctx.dateKeyOf(now, session.timeZone),
        targetMs: session.durationMs,
        elapsedMs: session.durationMs - remainingMs(snapshot.timer, snapshot.settings, now),
        endReason: 'manual',
        source: session.startedAt === null ? 'legacy' : 'native',
        step: session.step,
        ...(session.scene ? { scene: session.scene } : {}),
      }
      return { ...unchanged(snapshot), snapshot: { ...snapshot, timer: resetSession(snapshot.timer), records: [...snapshot.records, ended],
        scenes: { ...snapshot.scenes, lastEnded: session.scene ? {
          sessionId: session.id, phase: 'focus', scene: session.scene, elapsedMs: ended.elapsedMs, endedAt: now,
        } : null } }, ended, changed: true }
    }
    case 'skipBreak': {
      const session = snapshot.timer.session
      const timer = skipBreak(snapshot.timer)
      if (timer === snapshot.timer || !session?.scene) return withTimer(timer)
      return { ...unchanged(snapshot), changed: true, snapshot: { ...snapshot, timer, scenes: { ...snapshot.scenes, lastEnded: {
        sessionId: session.id, phase: 'rest', scene: session.scene,
        elapsedMs: session.durationMs - remainingMs(snapshot.timer, snapshot.settings, now), endedAt: now,
      } } } }
    }
    case 'updateSettings': {
      const settings = applySettingsPatch(snapshot.settings, action.patch, spec)
      if (sameSettings(settings, snapshot.settings)) return unchanged(snapshot)
      // A newly chosen default supersedes the remembered one-off length.
      const focusChanged = settings.durationsMinutes.focus !== snapshot.settings.durationsMinutes.focus
      return { ...unchanged(snapshot), snapshot: { ...snapshot, settings, lastFocusMinutes: focusChanged ? null : snapshot.lastFocusMinutes }, changed: true }
    }
    default: return actOnThought(snapshot, action, ctx, spec)
  }
}

function actOnThought(snapshot: AppSnapshot, action: ThoughtAction, ctx: ActionContext, spec: Spec): Transition {
  const { now } = ctx
  const { maxLength, undoPeriodMs } = spec.thoughts
  const existing = 'thoughtId' in action && action.thoughtId !== null ? snapshot.thoughts.find((t) => t.id === action.thoughtId) : undefined
  const commit = (thought: Thought, change: ThoughtChange, extra: Partial<AppSnapshot> = {}): Transition => ({
    ...unchanged(snapshot), changed: true, thought: { id: thought.id, change },
    snapshot: { ...snapshot, ...extra, thoughts: existing ? snapshot.thoughts.map((t) => t.id === thought.id ? thought : t) : [...snapshot.thoughts, thought] },
  })
  const rejected = (id: string): Transition => ({ ...unchanged(snapshot), thought: { id, change: 'rejected' } })
  const create = (id: string, text: string, timeZone: string): Thought => {
    const { phase, session } = snapshot.timer
    const linked = phase === 'focus' && session ? session : null
    return { id, createdAt: now, dateKey: ctx.dateKeyOf(now, linked?.timeZone ?? timeZone), sessionId: linked?.id ?? null, text, status: 'open', rev: 1, deletedAt: null }
  }
  // A draft aimed at a deleted thought keeps its text and becomes a new thought.
  const retargetDraft = (id: string) => snapshot.thoughtDraft?.thoughtId === id ? { thoughtDraft: snapshot.thoughtDraft.text ? { thoughtId: null, text: snapshot.thoughtDraft.text } : null } : {}

  switch (action.type) {
    case 'markThought':
      // Idempotent: a retried or repeated delivery of the same ID adds nothing.
      return existing ? unchanged(snapshot) : commit(create(action.thoughtId, '', action.timeZone), 'marked')
    case 'saveThoughtText': {
      const text = normalizeThoughtText(action.text, maxLength)
      const clearDraft = snapshot.thoughtDraft && (snapshot.thoughtDraft.thoughtId === null || snapshot.thoughtDraft.thoughtId === action.thoughtId)
      const extra = clearDraft ? { thoughtDraft: null } : {}
      if (!existing) return commit(create(action.thoughtId, text, action.timeZone), 'text', extra)
      if (!isLive(existing)) return rejected(existing.id)
      if (existing.text === text && !clearDraft) return { ...unchanged(snapshot), thought: { id: existing.id, change: 'text' } }
      return commit({ ...existing, text, rev: existing.rev + 1 }, 'text', extra)
    }
    case 'saveThoughtDraft': {
      const draft = action.text ? { thoughtId: action.thoughtId, text: Array.from(action.text).slice(0, maxLength).join('') } : null
      return sameDraft(draft, snapshot.thoughtDraft) ? unchanged(snapshot) : { ...unchanged(snapshot), snapshot: { ...snapshot, thoughtDraft: draft }, changed: true }
    }
    case 'discardThoughtDraft':
      return snapshot.thoughtDraft ? { ...unchanged(snapshot), snapshot: { ...snapshot, thoughtDraft: null }, changed: true } : unchanged(snapshot)
    case 'putAwayThought':
    case 'reopenThought': {
      if (!existing || !isLive(existing)) return rejected(action.thoughtId)
      const status = action.type === 'putAwayThought' ? 'putAway' : 'open'
      if (existing.status === status) return unchanged(snapshot)
      return commit({ ...existing, status, rev: existing.rev + 1 }, status === 'putAway' ? 'putAway' : 'reopened')
    }
    case 'deleteThought':
      if (!existing) return rejected(action.thoughtId)
      if (!isLive(existing)) return unchanged(snapshot)
      return commit({ ...existing, deletedAt: now, rev: existing.rev + 1 }, 'deleted', retargetDraft(existing.id))
    case 'restoreThought':
      if (!existing || (!isLive(existing) && !canRestore(existing, now, undoPeriodMs))) return rejected(action.thoughtId)
      if (isLive(existing)) return unchanged(snapshot)
      return commit({ ...existing, deletedAt: null, rev: existing.rev + 1 }, 'restored')
  }
}

/** Expiry wins a race with manual end. Guard session actions against stale tabs. */
export function applyAction(snapshot: AppSnapshot, action: AppAction, ctx: ActionContext, spec: Spec): Transition {
  const settled = reconcile(snapshot, ctx, spec)
  const thoughts = purgeExpiredText(settled.snapshot.thoughts, ctx.now, spec.thoughts.undoPeriodMs)
  const purged = thoughts !== settled.snapshot.thoughts
  const next = act(purged ? { ...settled.snapshot, thoughts } : settled.snapshot, action, ctx, spec)
  return { snapshot: next.snapshot, completion: settled.completion, ended: next.ended ?? settled.ended, thought: next.thought,
    changed: settled.changed || purged || next.changed }
}

export function shouldChime(completion: Completion, now: number, settings: Settings, spec: Spec): boolean {
  return settings.soundEnabled && now >= completion.deadline && now - completion.deadline <= spec.timer.completionSoundWindowMs
}
