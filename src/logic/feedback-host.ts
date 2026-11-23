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

export function feedbackContext(snapshot: AppSnapshot, persistence: FeedbackContext['persistence'], event: AppFeedbackEvent | null, localHour?: number): FeedbackContext {
  return {
    phase: snapshot.timer.phase === 'focus' ? 'focus' : 'break',
    status: snapshot.timer.session?.status ?? 'ready',
    persistence,
    localHour,
    focusDurationMs: snapshot.timer.phase === 'focus' ? (snapshot.timer.session?.initialDurationMs ?? snapshot.timer.session?.durationMs) : undefined,
    sceneId: snapshot.settings.sceneVarietyEnabled ? snapshot.timer.session?.scene?.sceneId : undefined,
    participationSaved: persistence === 'saved' && event?.sessionId !== undefined &&
      snapshot.participations.some(p => p.sessionId === event.sessionId),
    returningReady: !snapshot.timer.session && (snapshot.participations.length > 0 || snapshot.records.length > 0 || snapshot.restMemories.length > 0),
  }
}

export interface FeedbackHostState {
  feedback: FeedbackResult
  /** One opening opportunity, consumed after initial recovery or any intervening interaction. */
  entryPending: boolean
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
  automaticVisible?: boolean
  localHour?: number
}

/** Countdown refreshes are intentionally absent: they never redraw copy or restart cues. */
export function feedbackSignature(input: FeedbackHostInput): string {
  const { snapshot: s, persistence, event, active, nodeEncouragement } = input
  return JSON.stringify([s.datasetGeneration, s.revision, s.timer.phase, s.timer.session?.id,
    s.timer.session?.status, persistence, event?.id, event?.kind, event?.origin, event?.revision, active, nodeEncouragement, input.automaticVisible])
}

export function createFeedbackHost(input: FeedbackHostInput, catalog: FeedbackCatalog, initial: { seed: number; enteredAtMs?: number } = { seed: 1 }): FeedbackHostState {
  const context = feedbackContext(input.snapshot, input.persistence, input.event, input.localHour)
  const entryPending = Boolean(initial.enteredAtMs !== undefined && input.active && input.automaticVisible !== false && input.nodeEncouragement && context.returningReady && context.persistence === 'saved' && !input.event)
  const feedback = transitionFeedback(createFeedbackMemory(initial.seed), { kind: 'reconcile', id: 'initial-view', atMs: 0, origin: 'restore' }, context, catalog)
  return { feedback, entryPending, cue: null, lastEventKey: null, signature: '' }
}

/** Consumes each operation once, including while its screen is hidden. */
export function updateFeedbackHost(previous: FeedbackHostState, input: FeedbackHostInput, catalog: FeedbackCatalog, presentedAtMs = input.event?.atMs ?? 0): FeedbackHostState {
  const signature = feedbackSignature(input)
  if (signature === previous.signature) return previous
  const candidate = input.event
  // A retry retains its operation ID, but may now have a real committed result.
  const eventKey = candidate ? JSON.stringify([candidate.id, candidate.kind, candidate.generation, candidate.revision, candidate.origin]) : null
  const fresh = candidate && eventKey !== previous.lastEventKey
  const current = fresh && candidate.generation === input.snapshot.datasetGeneration && candidate.revision === input.snapshot.revision
  const context = feedbackContext(input.snapshot, input.persistence, candidate, input.localHour)
  const available = input.active && input.automaticVisible !== false && input.nodeEncouragement
  const greeting = previous.entryPending && current && candidate.origin === 'restore' && candidate.kind === 'reconcile' &&
    available && context.returningReady && input.persistence === 'saved'
  // Initial recovery briefly reports saving. Keep only this opening opportunity,
  // never a phrase; a user interaction, hidden surface or recovery failure cancels it.
  const recovering = Boolean(current && candidate.origin === 'restore' && candidate.kind === 'reconcile' && input.persistence === 'saving')
  const entryPending = previous.entryPending && (!fresh || recovering) && available && context.status === 'ready' &&
    (input.persistence === 'saved' || input.persistence === 'saving')
  // Saving may finish much later than the click. Space automatic lines from
  // their presentation time, not from the original operation timestamp.
  const event: FeedbackEvent = greeting ? { kind: 'ready-entered', id: `entry:${candidate.id}`, atMs: presentedAtMs, origin: 'user' }
    : current ? { ...candidate, atMs: presentedAtMs } : { kind: 'reconcile', id: `view:${signature}`, atMs: presentedAtMs, origin: 'user' }
  const options: FeedbackOptions = { nodeEncouragement: input.nodeEncouragement && input.active && input.automaticVisible !== false }
  const feedback = transitionFeedback(previous.feedback.state, event, context, catalog, options)
  // Leaving or covering the surface consumes a passing line; it is never queued for return.
  if ((!input.active || input.automaticVisible === false || !input.nodeEncouragement) && feedback.frame.placement === 'node') {
    feedback.frame = { ...feedback.frame, encouragement: null }
    feedback.state.current = feedback.frame
  }
  // Requested reading can remain, but navigation never replays its cue or announcement.
  if (!input.active || (!fresh && feedback.frame.status.kind !== 'error')) feedback.announcement = null
  const cue = current ? cueFor(candidate, feedback, input.active) : null
  return { feedback, entryPending, cue, signature, lastEventKey: eventKey ?? previous.lastEventKey }
}

export function interactWithFeedback(previous: FeedbackHostState, input: FeedbackHostInput, event: FeedbackEvent, catalog: FeedbackCatalog): FeedbackHostState {
  const feedback = transitionFeedback(previous.feedback.state, event, feedbackContext(input.snapshot, input.persistence, input.event, input.localHour), catalog, { nodeEncouragement: input.nodeEncouragement })
  if (!input.active) feedback.announcement = null
  return { ...previous, entryPending: false, feedback, cue: cueFor(event, feedback, input.active) }
}
