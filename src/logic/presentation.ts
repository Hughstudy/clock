import type { FeedbackEvent, FeedbackFrame, FeedbackResult, Persistence, Pool } from './feedback'

/** Contract version for the main → animation boundary. Bump when a field's meaning changes. */
export const PRESENTATION_CONTRACT = 'C2-P1'

/** Semantic results a renderer may react to. No species, asset, reward or ranking identity. */
export const CUE_KINDS = ['welcome', 'begin', 'pause', 'resume', 'settle', 'rest', 'thought-saved', 'support'] as const
export type CueKind = (typeof CUE_KINDS)[number]

/**
 * A permitted, transient visual reaction. Its `id` is independent of any
 * screen-reader announcement. Main emits each id at most once; a renderer may
 * omit or cancel it, which never affects accounting or saved content.
 */
export interface PresentationCue {
  id: string
  kind: CueKind
  sessionId: string | null
  thoughtId: string | null
}

/** Read-only state for a renderer. Never a mutable snapshot, never elapsed-time accounting. */
export interface CompanionView {
  phase: 'focus' | 'break'
  status: 'ready' | 'running' | 'paused'
  /** Truthful persistence of the latest operation. */
  persistence: Persistence
  /** A factual error is being shown; renderers keep a neutral, static stance. */
  hasError: boolean
  encouragement: { id: string; pool: Pool; placement: FeedbackFrame['placement'] } | null
  preferences: { motionEnabled: boolean; encouragementEnabled: boolean }
}

const CUES: Partial<Record<FeedbackEvent['kind'], CueKind>> = {
  welcome: 'welcome', 'focus-started': 'begin', paused: 'pause', resumed: 'resume', 'focus-ended': 'settle',
  'break-started': 'rest', 'break-ended': 'settle', 'note-saved': 'thought-saved', 'encouragement-requested': 'support',
}

type CueSource = FeedbackEvent & { sessionId?: string }

/**
 * A cue only for a fresh, announced, error-free result on a visible screen.
 * Save-dependent kinds additionally need confirmed persistence; an explicit
 * request for encouragement does not, because it writes nothing.
 */
export function cueFor(event: CueSource, result: FeedbackResult, visible: boolean): PresentationCue | null {
  const kind = CUES[event.kind]
  if (!kind || !visible || !result.announcement || result.frame.status.kind === 'error') return null
  if (kind !== 'support' && result.frame.persistence !== 'saved') return null
  if (event.origin === 'restore' || event.origin === 'sync') return null
  return {
    id: `cue:${event.id}`,
    kind,
    sessionId: event.sessionId ?? null,
    thoughtId: event.kind === 'note-saved' ? event.interactionId ?? null : null,
  }
}

export function companionViewOf(frame: FeedbackFrame, preferences: CompanionView['preferences']): CompanionView {
  const [phase, status] = frame.companionState.split('-') as [CompanionView['phase'], CompanionView['status']]
  return {
    phase,
    status,
    persistence: frame.persistence,
    hasError: frame.status.kind === 'error',
    encouragement: frame.encouragement ? { id: frame.encouragement.id, pool: frame.encouragement.pool, placement: frame.placement } : null,
    preferences,
  }
}
