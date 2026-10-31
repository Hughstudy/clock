/**
 * C1-F2: focus and thought slice, introduced in snapshot v4 and retained in v6.
 * Includes the optional session step, last one-off focus length, thoughts with
 * deletion markers and the thought draft. C2-P3 exposes saved scene presentation.
 * Rewards, bookmarks and import/export are not yet public contracts.
 */
export type { AppSnapshot, FocusRecord, ParticipationRecord, Session, Thought, ThoughtDraft, TimerState } from '../logic/types'
export type { AppAction, ThoughtAction, ThoughtChange, Transition } from '../logic/app'
export type { RecordView, TimerView, StatsView } from '../hooks/useViews'

export type SaveState = 'saving' | 'saved' | 'pending' | 'memory-only' | 'read-only'
export type { ThoughtResult, UserAction } from '../hooks/useClockApp'
