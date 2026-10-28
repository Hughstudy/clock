export type Phase = 'focus' | 'shortBreak' | 'longBreak'

export const PHASES: readonly Phase[] = ['focus', 'shortBreak', 'longBreak']

/** Local calendar date, `YYYY-MM-DD`. Resolved once by an adapter and stored as-is. */
export type DateKey = string

export interface Settings {
  durationsMinutes: Record<Phase, number>
  soundEnabled: boolean
}

/**
 * A started session. Its duration was captured at start, so later settings
 * changes never alter it. Running sessions are deadline-based; paused
 * sessions hold the remaining time. `timeZone` is the IANA zone at start,
 * used to date the completion even if the device travels.
 */
export type Session =
  | { status: 'running'; id: string; durationMs: number; deadline: number; timeZone: string }
  | { status: 'paused'; id: string; durationMs: number; remainingMs: number; timeZone: string }

export interface TimerState {
  /** Phase of the active session, or the phase waiting to be started. */
  phase: Phase
  session: Session | null
  /** Completed focus sessions; drives long-break cadence and is never reset. */
  completedFocusCount: number
}

/** Accounting source of truth for stats and streaks. One per focus session. */
export interface CompletionRecord {
  sessionId: string
  /** The session deadline, not the time the app noticed the expiry. */
  completedAt: number
  dateKey: DateKey
  focusMs: number
}

export interface AppSnapshot {
  version: number
  /** Incremented on every persisted write; used to order snapshots across tabs. */
  revision: number
  /** Id of the tab that wrote this revision; breaks revision ties. */
  writer: string
  settings: Settings
  timer: TimerState
  completions: CompletionRecord[]
}
