import type { AppAction, Transition } from './app'
import { createFeedbackMemory, transitionFeedback, type FeedbackCatalog, type FeedbackContext, type FeedbackEvent, type FeedbackOptions, type FeedbackResult } from './feedback'
import { cueFor, type PresentationCue } from './presentation'
import type { AppSnapshot } from './types'

/** Identifies the actual committed state that produced a presentation event. */
export type AppFeedbackEvent = FeedbackEvent & {
  generation: number
  revision: number
  sessionId?: string
}

interface EventIdentity { id: string; atMs: number; origin: FeedbackEvent['origin'] }

/** Only real timer transitions receive action copy; rejected/stale actions are silent. */
export function feedbackFromTransition(before: AppSnapshot, transition: Transition, action: AppAction, identity: EventIdentity, saved: boolean): AppFeedbackEvent {
  const after = transition.snapshot
  const base = { ...identity, generation: after.datasetGeneration, revision: after.revision }
  const active = after.timer.session
  const previous = before.timer.session
  if (!saved || !transition.changed) return { ...base, kind: 'reconcile' }
  // A newly started phase takes precedence over a deadline settled by the same action.
  if (active && active.id !== previous?.id) {
    return { ...base, sessionId: active.id, kind: after.timer.phase === 'focus' ? 'focus-started' : 'break-started' }
  }
  if (transition.ended && !active) {
    const ended = transition.ended
    return { ...base, sessionId: ended.sessionId, kind: 'focus-ended', elapsedMs: ended.elapsedMs, reason: ended.endReason === 'deadline' ? 'elapsed' : 'manual' }
  }
  const noted = transition.thought
  const thought = noted && (noted.change === 'marked' || noted.change === 'text') ? after.thoughts.find((t) => t.id === noted.id) : undefined
  if (thought) {
    // Marking and then adding text to the same thought is one interaction: one phrase at most.
    return { ...base, ...(thought.sessionId ? { sessionId: thought.sessionId } : {}), kind: 'note-saved', hasText: thought.text !== '', interactionId: thought.id }
  }
  if (previous && active?.id === previous.id && previous.status !== active.status) {
    return { ...base, sessionId: active.id, kind: active.status === 'paused' ? 'paused' : 'resumed' }
  }
  if (before.timer.phase !== 'focus' && after.timer.phase === 'focus' && !active &&
      (transition.completion?.phase !== 'focus' || action.type === 'skipBreak' || action.type === 'end')) {
    return { ...base, ...(previous ? { sessionId: previous.id } : {}), kind: 'break-ended' }
  }
  return { ...base, kind: 'reconcile' }
}

export function feedbackContext(snapshot: AppSnapshot, persistence: FeedbackContext['persistence'], event: AppFeedbackEvent | null): FeedbackContext {
  return {
    phase: snapshot.timer.phase === 'focus' ? 'focus' : 'break',
    status: snapshot.timer.session?.status ?? 'ready',
    persistence,
    initialized: true,
    history: snapshot.records.length ? 'nonempty' : 'empty',
    participationSaved: persistence === 'saved' && event?.sessionId !== undefined &&
      snapshot.participations.some(p => p.sessionId === event.sessionId),
  }
}

export interface FeedbackHostState {
  feedback: FeedbackResult
  /** Visual cue for the latest fresh result; its identity is separate from the announcement's. */
  cue: PresentationCue | null
  lastEventKey: string | null
  signature: string
}

export interface FeedbackHostInput {
  snapshot: AppSnapshot
  persistence: FeedbackContext['persistence']
  event: AppFeedbackEvent | null
  active: boolean
  nodeEncouragement: boolean
}

/** Countdown refreshes are intentionally absent: they never redraw copy or restart cues. */
export function feedbackSignature(input: FeedbackHostInput): string {
  const { snapshot: s, persistence, event, active, nodeEncouragement } = input
  return JSON.stringify([s.datasetGeneration, s.revision, s.timer.phase, s.timer.session?.id,
    s.timer.session?.status, persistence, event?.id, event?.kind, event?.origin, event?.revision, active, nodeEncouragement])
}

export function createFeedbackHost(input: FeedbackHostInput, catalog: FeedbackCatalog): FeedbackHostState {
  const feedback = transitionFeedback(createFeedbackMemory(), { kind: 'reconcile', id: 'initial-view', atMs: 0, origin: 'restore' }, feedbackContext(input.snapshot, input.persistence, input.event), catalog)
  return { feedback, cue: null, lastEventKey: null, signature: '' }
}

/** Consumes each operation once, including while its screen is hidden. */
export function updateFeedbackHost(previous: FeedbackHostState, input: FeedbackHostInput, catalog: FeedbackCatalog): FeedbackHostState {
  const signature = feedbackSignature(input)
  if (signature === previous.signature) return previous
  const candidate = input.event
  // A retry retains its operation ID, but may now have a real committed result.
  const eventKey = candidate ? JSON.stringify([candidate.id, candidate.kind, candidate.generation, candidate.revision, candidate.origin]) : null
  const fresh = candidate && eventKey !== previous.lastEventKey
  const current = fresh && candidate.generation === input.snapshot.datasetGeneration && candidate.revision === input.snapshot.revision
  const event: FeedbackEvent = current ? candidate : { kind: 'reconcile', id: `view:${signature}`, atMs: candidate?.atMs ?? 0, origin: 'user' }
  const options: FeedbackOptions = { nodeEncouragement: input.nodeEncouragement }
  const feedback = transitionFeedback(previous.feedback.state, event, feedbackContext(input.snapshot, input.persistence, candidate), catalog, options)
  // The current phrase may remain visible, but navigation never replays its cue or announcement.
  if (!input.active || (!fresh && feedback.frame.status.kind !== 'error')) feedback.announcement = null
  const cue = current ? cueFor(candidate, feedback, input.active) : null
  return { feedback, cue, signature, lastEventKey: eventKey ?? previous.lastEventKey }
}

export function interactWithFeedback(previous: FeedbackHostState, input: FeedbackHostInput, event: FeedbackEvent, catalog: FeedbackCatalog): FeedbackHostState {
  const feedback = transitionFeedback(previous.feedback.state, event, feedbackContext(input.snapshot, input.persistence, input.event), catalog, { nodeEncouragement: input.nodeEncouragement })
  if (!input.active) feedback.announcement = null
  return { ...previous, feedback, cue: cueFor(event, feedback, input.active) }
}
