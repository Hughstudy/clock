/**
 * C2-P3: main → animation boundary. Main supplies a read-only view, at most one
 * permitted transient cue with its own identity, and explicit user-intent
 * callbacks. Animation completion or cancellation changes only local
 * presentation state: it never saves, grants content, starts/ends timers or
 * gates a control. Main owns the single live region; renderers announce nothing.
 */
export { CUE_KINDS, PRESENTATION_CONTRACT, type CompanionView, type CompanionScene, type CueKind, type PresentationCue } from '../logic/presentation'
export type { SceneId, FocusSceneId, RestSceneId } from '../logic/types'
export type { FeedbackFrame, FeedbackMessage, FeedbackResult } from '../logic/feedback'

/** Callbacks a renderer may forward on a deliberate user action only — never from an animated touch. */
export interface CompanionCallbacks {
  requestEncouragement: () => void
  nextEncouragement: () => void
  dismissEncouragement: () => void
}
