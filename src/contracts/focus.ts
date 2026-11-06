/**
 * Focus and thought slice, snapshot v9. Automatic break suggestions retain the
 * ended session identity; explicit preparation clears it. Edits retain their owner, first input
 * date and base revisions. Receipts identify the operation and dataset generation.
 * Quote favorites have a separate contract. Story/world and import/export remain pending.
 */
export type { AppSnapshot, FocusRecord, ParticipationRecord, Session, Thought, ThoughtDraft, TimerState } from '../logic/types'
export type { AppAction, ThoughtAction, ThoughtChange, Transition } from '../logic/app'
export type { RecordView, TimerView, StatsView } from '../hooks/useViews'

export type SaveState = 'saving' | 'saved' | 'pending' | 'memory-only' | 'read-only'
export type { ThoughtResult, UserAction } from '../hooks/useClockApp'
