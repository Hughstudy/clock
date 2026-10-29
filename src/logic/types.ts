export type Phase = 'focus' | 'shortBreak' | 'longBreak'

export const PHASES: readonly Phase[] = ['focus', 'shortBreak', 'longBreak']

/** Local calendar date, `YYYY-MM-DD`. Resolved once by an adapter and stored as-is. */
export type DateKey = string

export interface Settings {
  durationsMinutes: Record<Phase, number>
  soundEnabled: boolean
  /** The system's reduced-motion preference always takes priority. */
  motionEnabled: boolean
}

/**
 * A started session. Its duration was captured at start, so later settings
 * changes never alter it. Running sessions are deadline-based; paused
 * sessions hold the remaining time. `timeZone` is the IANA zone at start,
 * used to date the completion even if the device travels.
 */
export type Session = {
  id: string
  durationMs: number
  timeZone: string
  /** Unknown for sessions created before schema v3; never inferred from a deadline. */
  startedAt: number | null
} & (
  | { status: 'running'; deadline: number }
  | { status: 'paused'; remainingMs: number }
)

export interface TimerState {
  /** Phase of the active session, or the phase waiting to be started. */
  phase: Phase
  session: Session | null
  /** Completed focus sessions; drives long-break cadence and is never reset. */
  completedFocusCount: number
}

/** Accounting source of truth. Manual and deadline endings have equal standing. */
export interface FocusRecord {
  sessionId: string
  startedAt: number | null
  /** Deadline for expiry; action instant for a manual end. */
  endedAt: number
  dateKey: DateKey
  targetMs: number
  elapsedMs: number
  endReason: 'deadline' | 'manual'
  source: 'native' | 'legacy'
}

/** One entry at start, independent of duration and full-completion cadence. */
export interface ParticipationRecord {
  sessionId: string
  participatedAt: number | null
  /** Null for a migrated active session whose original start is unknown. */
  dateKey: DateKey | null
  source: 'native' | 'legacy-completion' | 'legacy-active'
}

export interface AppSnapshot {
  version: number
  /** Incremented on every persisted write; used to order snapshots across tabs. */
  revision: number
  /** Id of the tab that wrote this revision; breaks revision ties. */
  writer: string
  /** Replacement/clear will advance this under the same lock; older sets never merge back. */
  datasetGeneration: number
  settings: Settings
  timer: TimerState
  records: FocusRecord[]
  participations: ParticipationRecord[]
}
