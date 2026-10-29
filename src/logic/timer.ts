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

/** Time left at `now`. A ready phase shows the duration a start would capture. */
export function remainingMs(timer: TimerState, settings: Settings, now: number): number {
  const { session } = timer
  if (!session) return phaseDurationMs(settings, timer.phase)
  if (session.status === 'paused') return clampRemaining(session.remainingMs, session.durationMs)
  return clampRemaining(session.deadline - now, session.durationMs)
}

export function totalMs(timer: TimerState, settings: Settings): number {
  return timer.session ? timer.session.durationMs : phaseDurationMs(settings, timer.phase)
}

export function isExpired(timer: TimerState, now: number): boolean {
  return timer.session?.status === 'running' && now >= timer.session.deadline
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
  const paused: Session = {
    status: 'paused',
    id: session.id,
    durationMs: session.durationMs,
    remainingMs: clampRemaining(session.deadline - now, session.durationMs),
    timeZone: session.timeZone,
    startedAt: session.startedAt,
    step: session.step,
  }
  return { ...timer, session: paused }
}

export function resumeSession(timer: TimerState, now: number): TimerState {
  const { session } = timer
  if (session?.status !== 'paused') return timer
  const running: Session = {
    status: 'running',
    id: session.id,
    durationMs: session.durationMs,
    deadline: now + clampRemaining(session.remainingMs, session.durationMs),
    timeZone: session.timeZone,
    startedAt: session.startedAt,
    step: session.step,
  }
  return { ...timer, session: running }
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

export interface CycleProgress {
  /** Focus sessions finished in the current run towards a long break. */
  done: number
  total: number
}

export function cycleProgress(timer: TimerState, longBreakEvery: number): CycleProgress {
  const inCycle = timer.completedFocusCount % longBreakEvery
  // While the long break itself is pending or running, the cycle shows as full.
  const done = timer.phase === 'longBreak' && inCycle === 0 && timer.completedFocusCount > 0 ? longBreakEvery : inCycle
  return { done, total: longBreakEvery }
}
