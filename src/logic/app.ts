import { applySettingsPatch, defaultSettings, isValidDuration, sameSettings, type SettingsPatch } from './settings'
import { selectScene } from './scenes'
import type { Spec } from './spec'
import { canRestore, isLive, normalizeStep, purgeExpiredText } from './thoughts'
import { breakAfterFocus, expireSession, pauseSession, remainingMs, resetSession, resumeSession, skipBreak, startSession } from './timer'
import type { AppSnapshot, DateKey, FocusRecord, Phase, Settings, Thought, ThoughtDraft } from './types'

export type ThoughtAction =
  /** One tap: an empty marker, linked to the running or paused focus session if there is one. */
  | { type: 'markThought'; thoughtId: string; timeZone: string; owner?: { sessionId: string | null; at: number } }
  /** Saves text to an existing live thought, or creates the thought if the ID is new. Clears the draft. */
  | { type: 'saveThoughtText'; thoughtId: string; text: string; timeZone: string; draft?: ThoughtDraft; expectedStamp?: string | null; stamp?: string }
  | { type: 'writeDraft'; draft: ThoughtDraft | null; expectedStamp: string | null; stamp: string }
  | { type: 'putAwayThought' | 'reopenThought' | 'deleteThought' | 'restoreThought'; thoughtId: string; expectedRev?: number }

export type AppAction = (
  | { type: 'reconcile' }
  /** An explicit `durationMinutes` is a one-off choice: remembered for focus, never a new default. */
  | { type: 'start' | 'startFocus'; sessionId: string; timeZone: string; durationMinutes?: number; expectedPhase?: Phase; step?: string }
  | { type: 'startBreak'; sessionId: string; timeZone: string; durationMinutes?: number; expectedPhase?: Phase; phase?: 'shortBreak' | 'longBreak' }
  | { type: 'pause' | 'resume' | 'end'; sessionId?: string }
  | { type: 'skipBreak'; sessionId?: string | null }
  | { type: 'resetDurations' }
  | { type: 'prepare'; phase: Phase; expectedPhase: Phase }
  | { type: 'updateSettings'; patch: SettingsPatch }
  | ThoughtAction) & { generation?: number }

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
  draftConflict?: boolean
  changed: boolean
}

export interface SessionResult { sessionId: string; phase: 'focus' | 'rest'; elapsedMs: number; saved: boolean }

/** Only a visit that observed an ending supplies an ID. A cold open stays ready. */
export function resolveSessionResult(previous: SessionResult | null, current: AppSnapshot, stored: AppSnapshot | null): SessionResult | null {
  if (!previous || current.timer.session) return null
  const durable = stored?.datasetGeneration === current.datasetGeneration ? stored : null
  const ending = (s: AppSnapshot | null) => previous.phase === 'focus'
    ? s?.records.find(r => r.sessionId === previous.sessionId)
    : s?.lastRestEnd?.sessionId === previous.sessionId ? s.lastRestEnd : null
  const confirmed = ending(durable)
  const fact = confirmed ?? ending(current)
  return fact ? { ...previous, elapsedMs: fact.elapsedMs, saved: !!confirmed } : null
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
    snapshot: { ...snapshot, timer, records, scenes, lastRestEnd: expired.phase === 'focus' ? snapshot.lastRestEnd :
      { sessionId: expired.sessionId, endedAt: expired.deadline, elapsedMs: expired.durationMs } },
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
    case 'prepare': return snapshot.timer.session || snapshot.timer.phase !== action.expectedPhase || snapshot.timer.phase === action.phase
      ? unchanged(snapshot) : withTimer({ ...snapshot.timer, phase: action.phase })
    case 'start':
    case 'startFocus':
    case 'startBreak': {
      if (snapshot.timer.session || snapshot.records.some((r) => r.sessionId === action.sessionId) ||
          snapshot.participations.some((r) => r.sessionId === action.sessionId)) return unchanged(snapshot)
      if (action.expectedPhase !== undefined && action.expectedPhase !== snapshot.timer.phase) return unchanged(snapshot)
      const timer = action.type === 'startBreak'
        ? { ...snapshot.timer, phase: action.phase ?? (snapshot.timer.phase === 'focus' ? 'shortBreak' : snapshot.timer.phase) }
        : action.type === 'startFocus' ? { ...snapshot.timer, phase: 'focus' as const } : snapshot.timer
      const focus = timer.phase === 'focus'
      const chosen = action.durationMinutes
      if (chosen !== undefined && !isValidDuration(timer.phase, chosen, spec)) return unchanged(snapshot)
      const duration = chosen ?? (focus ? nextFocusMinutes(snapshot, spec) : undefined)
      if (focus && action.type !== 'startBreak' && Array.from(action.step ?? '').length > spec.timer.stepMaxLength) return unchanged(snapshot)
      const step = focus && action.type !== 'startBreak' ? normalizeStep(action.step, spec.timer.stepMaxLength) : null
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
      if (snapshot.timer.phase !== 'focus') return endRest(snapshot, ctx)
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
      if (action.sessionId !== undefined && (session?.id ?? null) !== action.sessionId) return unchanged(snapshot)
      return session && snapshot.timer.phase !== 'focus' ? endRest(snapshot, ctx) : withTimer(skipBreak(snapshot.timer))
    }
    case 'updateSettings':
    case 'resetDurations': {
      const patch = action.type === 'resetDurations' ? { durationsMinutes: defaultSettings(spec).durationsMinutes } : action.patch
      const settings = applySettingsPatch(snapshot.settings, patch, spec)
      if (action.type !== 'resetDurations' && sameSettings(settings, snapshot.settings)) return unchanged(snapshot)
      // A newly chosen default supersedes the remembered one-off length.
      const focusChanged = action.type === 'resetDurations' || settings.durationsMinutes.focus !== snapshot.settings.durationsMinutes.focus
      return { ...unchanged(snapshot), snapshot: { ...snapshot, settings, lastFocusMinutes: focusChanged ? null : snapshot.lastFocusMinutes,
        focusDefaultsRevision: snapshot.focusDefaultsRevision + Number(focusChanged) }, changed: true }
    }
    default: return actOnThought(snapshot, action, ctx, spec)
  }
}

function endRest(snapshot: AppSnapshot, ctx: ActionContext): Transition {
  const session = snapshot.timer.session
  if (!session) return unchanged(snapshot)
  const lastRestEnd = { sessionId: session.id, endedAt: ctx.now,
    elapsedMs: session.durationMs - remainingMs(snapshot.timer, snapshot.settings, ctx.now) }
  const lastEnded = session.scene ? { ...lastRestEnd, phase: 'rest' as const, scene: session.scene } : null
  return { ...unchanged(snapshot), changed: true, snapshot: { ...snapshot, timer: skipBreak(snapshot.timer),
    lastRestEnd, scenes: { ...snapshot.scenes, lastEnded } } }
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
  if ('expectedRev' in action && action.expectedRev !== existing?.rev) return rejected(action.thoughtId)

  switch (action.type) {
    case 'markThought': {
      // Idempotent: a retried or repeated delivery of the same ID adds nothing.
      if (existing) return unchanged(snapshot)
      const marker = create(action.thoughtId, '', action.timeZone)
      const owner = action.owner
      return commit(owner ? { ...marker, sessionId: owner.sessionId, createdAt: owner.at, dateKey: ctx.dateKeyOf(owner.at, action.timeZone) } : marker, 'marked')
    }
    case 'saveThoughtText': {
      const text = action.text.trim()
      const draft = action.draft
      if (Array.from(action.text).length > maxLength || (!existing && !text) ||
          (action.expectedStamp !== undefined && snapshot.draftStamp !== action.expectedStamp) ||
          (draft && (draft.thoughtId === null ? !!existing : draft.thoughtId !== existing?.id || draft.baseRev !== existing.rev))) return rejected(action.thoughtId)
      const clearDraft = draft && snapshot.thoughtDraft?.id === draft.id
      const extra = action.stamp ? { draftStamp: action.stamp, thoughtDraft: null } : clearDraft ? { thoughtDraft: null } : {}
      if (!existing) {
        const thought = create(action.thoughtId, text, action.timeZone)
        return commit(draft ? { ...thought, sessionId: draft.sessionId, createdAt: draft.createdAt ?? now,
          dateKey: draft.dateKey ?? ctx.dateKeyOf(now, draft.timeZone) } : thought, 'text', extra)
      }
      if (!isLive(existing)) return rejected(existing.id)
      if (existing.text === text && !action.stamp && !clearDraft) return { ...unchanged(snapshot), thought: { id: existing.id, change: 'text' } }
      return commit({ ...existing, text, rev: existing.rev + 1 }, 'text', extra)
    }
    case 'writeDraft':
      if (snapshot.draftStamp !== action.expectedStamp) return { ...unchanged(snapshot), draftConflict: true }
      return { ...unchanged(snapshot), snapshot: { ...snapshot, thoughtDraft: action.draft, draftStamp: action.stamp }, changed: true }
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
      return commit({ ...existing, deletedAt: now, rev: existing.rev + 1 }, 'deleted')
    case 'restoreThought':
      if (!existing || (!isLive(existing) && !canRestore(existing, now, undoPeriodMs))) return rejected(action.thoughtId)
      if (isLive(existing)) return unchanged(snapshot)
      return commit({ ...existing, deletedAt: null, rev: existing.rev + 1 }, 'restored')
  }
}

/** Expiry wins a race with manual end. Guard session actions against stale tabs. */
export function applyAction(snapshot: AppSnapshot, action: AppAction, ctx: ActionContext, spec: Spec): Transition {
  if (action.generation !== undefined && action.generation !== snapshot.datasetGeneration) return unchanged(snapshot)
  const settled = reconcile(snapshot, ctx, spec)
  const thoughts = purgeExpiredText(settled.snapshot.thoughts, ctx.now, spec.thoughts.undoPeriodMs)
  const purged = thoughts !== settled.snapshot.thoughts
  const next = act(purged ? { ...settled.snapshot, thoughts } : settled.snapshot, action, ctx, spec)
  return { ...next, completion: settled.completion, ended: next.ended ?? settled.ended,
    changed: settled.changed || purged || next.changed }
}

export function shouldChime(completion: Completion, now: number, settings: Settings, spec: Spec): boolean {
  return settings.soundEnabled && now >= completion.deadline && now - completion.deadline <= spec.timer.completionSoundWindowMs
}
