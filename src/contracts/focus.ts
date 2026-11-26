/**
 * Focus, rest memory, thought and reading slice, snapshot v12. Timing edits conditionally update one
 * running/paused session's remaining plan without changing its identity or elapsed work.
 * Automatic break suggestions retain the
 * ended session identity; explicit preparation clears it. Edits retain their owner, first input
 * date and base revisions. Receipts identify the operation and dataset generation.
 * Bound reading sessions carry their authored edition; ended records keep the reached outcome.
 * Quote favorites have a separate contract. General story/world and import/export remain pending.
 */
export type { AppSnapshot, FocusRecord, ParticipationRecord, RestMemory, Session, Thought, ThoughtDraft, TimerState } from '../logic/types'
export type { ReadingBinding, ReadingMemory } from '../logic/reading-story'
export type { AppAction, ThoughtAction, ThoughtChange, Transition } from '../logic/app'
export type { RecordView, TimerView, StatsView } from '../hooks/useViews'

export type SaveState = 'saving' | 'saved' | 'pending' | 'memory-only' | 'read-only'
export type { ThoughtResult, UserAction } from '../hooks/useClockApp'
