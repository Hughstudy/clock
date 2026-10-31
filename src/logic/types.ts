export type Phase = 'focus' | 'shortBreak' | 'longBreak'

export const PHASES: readonly Phase[] = ['focus', 'shortBreak', 'longBreak']

/** Local calendar date, `YYYY-MM-DD`. Resolved once by an adapter and stored as-is. */
export type DateKey = string

export interface Settings {
  durationsMinutes: Record<Phase, number>
  soundEnabled: boolean
  /** The system's reduced-motion preference always takes priority. */
  motionEnabled: boolean
  /** Encouragement after start/pause/end and similar events. Explicit requests stay available. */
  encouragementEnabled: boolean
  /** Scene art may be hidden without changing timing or the saved scene choice. */
  sceneVarietyEnabled: boolean
}

export type FocusSceneId = 'F1' | 'F2' | 'F3' | 'F4' | 'F5' | 'F6' | 'F7' | 'F8'
export type RestSceneId = 'R1' | 'R2' | 'R3'
export type SceneId = FocusSceneId | RestSceneId
export interface SceneAssignment { sceneId: SceneId; ordinal: number; selectionVersion: 1 | 2 }
export interface SceneRotation { ordinal: number; cycle: number; remaining: SceneId[]; last: SceneId | null }
export interface SceneUnlock { sceneId: FocusSceneId; unlockedAt: number; bySessionId: string; ruleVersion: number }
export interface SceneEnding { sessionId: string; phase: 'focus' | 'rest'; scene: SceneAssignment; elapsedMs: number; endedAt: number }
export interface SceneState {
  focus: SceneRotation
  rest: SceneRotation
  /** Inert v5 history, preserved for compatibility. Never gates access or creates grants. */
  unlocked: SceneUnlock[]
  /** Inert v5 history; new selections do not append here. */
  introduced: FocusSceneId[]
  /** Inert v5 notice history; no new claims or announcements are issued. */
  announced: FocusSceneId[]
  lastEnded: SceneEnding | null
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
  /** Optional small step named at start. Never scored; null when left empty. */
  step: string | null
  /** Absent only for old records/sessions with no historical scene assignment. */
  scene?: SceneAssignment
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
  /** The session's optional small step, copied when it ended. */
  step: string | null
  scene?: SceneAssignment
}

/** One entry at start, independent of duration and full-completion cadence. */
export interface ParticipationRecord {
  sessionId: string
  participatedAt: number | null
  /** Null for a migrated active session whose original start is unknown. */
  dateKey: DateKey | null
  source: 'native' | 'legacy-completion' | 'legacy-active'
}

/**
 * A captured thought. Text is optional: an empty marker is valid. Within one
 * dataset generation, the copy with the higher `rev` wins a merge; at equal
 * `rev` a deletion wins, so a stale tab cannot resurrect a deleted thought.
 */
export interface Thought {
  id: string
  createdAt: number
  dateKey: DateKey
  /** Focus session it was captured during; null for a standalone thought (including rest). */
  sessionId: string | null
  text: string
  status: 'open' | 'putAway'
  rev: number
  /** Deletion marker. Text is kept briefly for undo, then cleared; the marker remains. */
  deletedAt: number | null
}

/** Unsent thought text, persisted so it survives closing the panel or the page. */
export interface ThoughtDraft {
  /** Thought the text will be saved to; null creates a new thought. */
  thoughtId: string | null
  text: string
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
  /** Last explicitly chosen one-off focus length. Separate from the configured default. */
  lastFocusMinutes: number | null
  thoughts: Thought[]
  thoughtDraft: ThoughtDraft | null
  scenes: SceneState
}
