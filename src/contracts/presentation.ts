/**
 * C2-P6: a bound reading scene receives its original bookmark and current or archived beat.
 * The activity keeps its starting timeline across a remaining-time edit.
 * Main supplies a read-only view, at most one
 * permitted transient cue with its own identity, and explicit user-intent
 * callbacks. Animation completion or cancellation changes only local
 * presentation state: it never saves, grants content, starts/ends timers or
 * gates a control. Main owns the single live region; renderers announce nothing.
 */
export { CUE_KINDS, PRESENTATION_CONTRACT, type CompanionView, type CompanionScene, type ReadingSceneView, type CueKind, type PresentationCue, type ShownEnding } from '../logic/presentation'
export type { SceneId, FocusSceneId, RestSceneId } from '../logic/types'
export type { FeedbackFrame, FeedbackMessage, FeedbackResult } from '../logic/feedback'

