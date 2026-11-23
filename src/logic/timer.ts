import type { Phase, Session, Settings, TimerState } from './types'

const MINUTE_MS = 60_000

export function initialTimer(): TimerState {
  return { phase: 'focus', session: null, completedFocusCount: 0 }
}

export function isBreak(phase: Phase): boolean {
  return phase !== 'focus'
}

export function phaseDurationMs(settings: Settings, phase: Phase): number {
  return settings.durationsMinutes[phase] * MINUTE_MS
}

/** The break that follows a focus session, given the count including that session. */
export function breakAfterFocus(completedFocusCount: number, longBreakEvery: number): Phase {
  return completedFocusCount > 0 && completedFocusCount % longBreakEvery === 0 ? 'longBreak' : 'shortBreak'
}

/** Clamped so a device clock moved backwards or forwards never shows negative or over-long time. */
function clampRemaining(ms: number, durationMs: number): number {
  return Math.min(durationMs, Math.max(0, ms))
}

function sessionRemainingMs(session: Session, now: number): number {
  if (session.status === 'paused') return clampRemaining(session.remainingMs, session.durationMs)
  // A backwards wall-clock change cannot erase time accounted before a resume or edit.
  return clampRemaining(session.deadline - now, session.runStartRemainingMs ?? session.durationMs)
}

/** The total bound includes time already invested, down to the millisecond. */
export function maxRemainingMinutes(elapsedMs: number, maxDurationMinutes: number): number {
  return Math.max(0, Math.floor((maxDurationMinutes * MINUTE_MS - elapsedMs) / MINUTE_MS))
}

/** Two tabs can both advance the same revision if one write failed. Bind an editor to its exact clock. */
export function sessionScheduleKey(session: Session): string {
  const position = session.status === 'running' ? session.deadline : session.remainingMs
  return [session.status, position, session.durationMs, session.initialDurationMs ?? session.durationMs,
    session.status === 'running' ? session.runStartRemainingMs ?? session.durationMs : ''].join(':')
}

/** Time left at `now`. A ready phase shows the duration a start would capture. */
export function remainingMs(timer: TimerState, settings: Settings, now: number): number {
  const { session } = timer
  if (!session) return phaseDurationMs(settings, timer.phase)
  return sessionRemainingMs(session, now)
}

export function totalMs(timer: TimerState, settings: Settings): number {
  return timer.session ? timer.session.durationMs : phaseDurationMs(settings, timer.phase)
}

export function startSession(
  timer: TimerState,
  settings: Settings,
  now: number,
  sessionId: string,
  timeZone: string,
  durationMinutes?: number,
  step: string | null = null,
): TimerState {
  if (timer.session) return timer
  const durationMs = durationMinutes === undefined ? phaseDurationMs(settings, timer.phase) : durationMinutes * MINUTE_MS
  return {
    ...timer,
    session: { status: 'running', id: sessionId, durationMs, deadline: now + durationMs, timeZone, startedAt: now, step },
  }
}

export function pauseSession(timer: TimerState, now: number): TimerState {
  const { session } = timer
  if (session?.status !== 'running') return timer
  const { deadline: _deadline, runStartRemainingMs: _startRemaining, ...shared } = session
  const paused: Session = {
    ...shared,
    status: 'paused',
    remainingMs: sessionRemainingMs(session, now),
    timingRevision: (session.timingRevision ?? 0) + 1,
  }
  return { ...timer, session: paused }
}

export function resumeSession(timer: TimerState, now: number): TimerState {
  const { session } = timer
  if (session?.status !== 'paused') return timer
  const { remainingMs: left, ...shared } = session
  const running: Session = {
    ...shared,
    status: 'running',
    deadline: now + left,
    runStartRemainingMs: left,
    timingRevision: (session.timingRevision ?? 0) + 1,
  }
  return { ...timer, session: running }
}

/** A commit always consumes the displayed revision, even if the chosen value is unchanged. */
export function adjustRemaining(session: Session, now: number, remainingMinutes: number): Session {
  const left = remainingMinutes * MINUTE_MS
  const elapsed = session.durationMs - sessionRemainingMs(session, now)
  const plan = {
    durationMs: elapsed + left,
    initialDurationMs: session.initialDurationMs ?? session.durationMs,
    timingRevision: (session.timingRevision ?? 0) + 1,
  }
  return session.status === 'paused'
    ? { ...session, ...plan, remainingMs: left }
    : { ...session, ...plan, deadline: now + left, runStartRemainingMs: left }
}

/** Clears the active session. The application layer must record focus before calling. */
export function resetSession(timer: TimerState): TimerState {
  return timer.session ? { ...timer, session: null } : timer
}

export function skipBreak(timer: TimerState): TimerState {
  return isBreak(timer.phase) ? { ...timer, phase: 'focus', session: null } : timer
}

export interface ExpiredSession {
  sessionId: string
  phase: Phase
  deadline: number
  durationMs: number
  timeZone: string
  startedAt: number | null
  step: string | null
}

/**
 * Completes a running session whose deadline has passed and readies the next
 * phase without starting it. A long absence therefore completes at most one
 * session.
 */
export function expireSession(
  timer: TimerState,
  now: number,
  longBreakEvery: number,
): { timer: TimerState; expired: ExpiredSession | null } {
  const { session } = timer
  if (session?.status !== 'running' || now < session.deadline) return { timer, expired: null }

  const expired: ExpiredSession = {
    sessionId: session.id,
    phase: timer.phase,
    deadline: session.deadline,
    durationMs: session.durationMs,
    timeZone: session.timeZone,
    startedAt: session.startedAt,
    step: session.step,
  }
  if (timer.phase === 'focus') {
    const completedFocusCount = timer.completedFocusCount + 1
    return {
      timer: { phase: breakAfterFocus(completedFocusCount, longBreakEvery), session: null, completedFocusCount },
      expired,
    }
  }
  return { timer: { ...timer, phase: 'focus', session: null }, expired }
}
