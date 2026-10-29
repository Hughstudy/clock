import type { FeedbackEvent, FeedbackFrame, FeedbackResult, Persistence, Pool } from './feedback'
import { endingTierForElapsed } from './scenes'
import type { AppSnapshot, SceneId } from './types'

/** Contract version for the main → animation boundary. Bump when a field's meaning changes. */
export const PRESENTATION_CONTRACT = 'C2-P2'

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

/** One host-assigned activity. Keys are stable across countdown updates and recovery. */
export interface CompanionScene {
  /** Dataset generation, logical session and scene-selection version. */
  key: string
  id: SceneId
  sessionId: string
  phase: 'focus' | 'break'
  status: 'running' | 'paused' | 'ended'
  /** Completed proportion, clamped and quantized to 1/100; rest always uses zero. */
  completedProgress: number
  /** The host suppresses beats while another input/panel needs attention. */
  allowBeats: boolean
  /** Main permits a transient cue independently of the read-only activity. */
  cue: PresentationCue | null
  /** Present only for the saved ending identified by this scene and settle cue. */
  ending: { cueId: string; tier: 'hello' | 'snack' | 'meal' | 'feast' | null } | null
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

/** Main resolves identity and saved results. Animation receives no mutable snapshot. */
export function companionSceneOf(snapshot: AppSnapshot, cue: PresentationCue | null, options: {
  completedProgress: number
  visible: boolean
  persistence: Persistence
  hasError: boolean
}): CompanionScene | null {
  if (!snapshot.settings.sceneVarietyEnabled) return null
  const session = snapshot.timer.session
  const allowed = options.visible && !options.hasError
  const keyFor = (id: string, version: number) => `${snapshot.datasetGeneration}:${id}:scene-v${version}`
  if (session?.scene) {
    const phase = snapshot.timer.phase === 'focus' ? 'focus' : 'break'
    const progress = Number.isFinite(options.completedProgress) ? Math.floor(Math.min(1, Math.max(0, options.completedProgress)) * 100) / 100 : 0
    const matchedCue = allowed && cue && (cue.sessionId === session.id || cue.kind === 'support') ? cue : null
    return {
      key: keyFor(session.id, session.scene.selectionVersion), id: session.scene.sceneId,
      sessionId: session.id, phase, status: session.status,
      completedProgress: phase === 'focus' ? progress : 0, allowBeats: allowed,
      cue: matchedCue, ending: null,
    }
  }
  // Never attach an old ending to a new session, including a legacy session without scene data.
  if (session || !allowed || options.persistence !== 'saved' || cue?.kind !== 'settle') return null
  const ended = snapshot.scenes.lastEnded
  if (!ended || ended.sessionId !== cue.sessionId) return null
  const record = ended.phase === 'focus' ? snapshot.records.find(item => item.sessionId === ended.sessionId) : null
  if (ended.phase === 'focus' && !record) return null
  return {
    key: keyFor(ended.sessionId, ended.scene.selectionVersion), id: ended.scene.sceneId,
    sessionId: ended.sessionId, phase: ended.phase === 'focus' ? 'focus' : 'break', status: 'ended',
    completedProgress: record && record.targetMs > 0 ? Math.floor(Math.min(1, record.elapsedMs / record.targetMs) * 100) / 100 : 0,
    allowBeats: true, cue,
    ending: { cueId: cue.id, tier: record ? endingTierForElapsed(record.elapsedMs) : null },
  }
}
