import type { SceneMotionKind } from './scene-motion'

export interface ScenePlayback {
  key: string | null
  progress: number
  activityProgress: number
  activityFrom: number
  activityTarget: number
  activityElapsedMs: number
  actionId: string | null
  actionKind: SceneMotionKind | 'idle'
  actionProgress: number
  endingFromActionProgress: number
  actionDurationMs: number
}
export interface ScenePlaybackInput {
  key: string | null
  progress: number
  mode: 'run' | 'hold' | 'settle'
  handlingMs: number
  action: { id: string; kind: SceneMotionKind; durationMs: number } | null
}
export const emptyScenePlayback = (): ScenePlayback => ({ key: null, progress: 0, activityProgress: 0, activityFrom: 0, activityTarget: 0, activityElapsedMs: 0, actionId: null, actionKind: 'idle', actionProgress: 1, endingFromActionProgress: 0, actionDurationMs: 0 })
const unit = (value: number) => Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0
export const achievedSceneLandmark = (progress: number): number => progress >= 1 ? 1 : progress >= 0.75 ? 0.75 : progress >= 0.4 ? 0.4 : 0

/** Presentation interpolation only. The supplied host fraction is a hard ceiling. */
export function advanceScenePlayback(previous: ScenePlayback, input: ScenePlaybackInput, deltaMs: number): ScenePlayback {
  const target = unit(input.progress)
  const activityTarget = achievedSceneLandmark(target)
  let next = previous.key === input.key ? previous : { ...emptyScenePlayback(), key: input.key, progress: target, activityProgress: activityTarget, activityFrom: activityTarget, activityTarget }
  if (!input.key || input.mode === 'settle') return {
    ...next, key: input.key, progress: target, activityProgress: activityTarget, activityFrom: activityTarget, activityTarget, activityElapsedMs: 0,
    actionId: input.action?.id ?? next.actionId, actionKind: 'idle', actionProgress: 1, endingFromActionProgress: 0,
  }
  // A pause or touch preserves the exact supported configuration. A cancelled
  // semantic cue is never replayed; its unfinished local path can settle later.
  if (input.mode === 'hold') return next
  const delta = Number.isFinite(deltaMs) ? Math.max(0, Math.min(deltaMs, 64)) : 0
  let progress = Math.min(target, next.progress + (target - next.progress) * (1 - Math.exp(-delta / 90)))
  if (Math.abs(target - progress) < 0.000001) progress = target
  // Growth uses precise progress, but handling takes seconds rather than
  // stretching a cup lift across minutes of a real focus session.
  if (activityTarget < next.activityProgress) next = { ...next, activityProgress: activityTarget, activityFrom: activityTarget, activityTarget, activityElapsedMs: 0 }
  else if (activityTarget !== next.activityTarget) next = { ...next, activityFrom: next.activityProgress, activityTarget, activityElapsedMs: 0 }
  const handlingMs = Number.isFinite(input.handlingMs) ? Math.max(500, Math.min(6000, input.handlingMs)) : 2600
  const activityElapsedMs = Math.min(handlingMs, next.activityElapsedMs + delta)
  const u = activityElapsedMs / handlingMs
  const activityProgress = next.activityFrom + (activityTarget - next.activityFrom) * u * u * (3 - 2 * u)
  const fresh = input.action && input.action.id !== next.actionId
  if (fresh) next = {
    ...next, actionId: input.action!.id, actionKind: input.action!.kind, actionProgress: 0,
    endingFromActionProgress: input.action!.kind === 'ending' && (next.actionKind === 'beat' || next.actionKind === 'open') ? next.actionProgress : 0,
    actionDurationMs: Math.max(1, input.action!.durationMs),
  }
  const actionProgress = next.actionKind === 'idle' || fresh ? next.actionProgress : Math.min(1, next.actionProgress + delta / next.actionDurationMs)
  return { ...next, progress, activityProgress, activityElapsedMs, actionProgress, actionKind: actionProgress >= 1 ? 'idle' : next.actionKind }
}

export function scenePlaybackNeedsFrame(playback: ScenePlayback, input: ScenePlaybackInput): boolean {
  return !!input.key && input.mode === 'run' && (
    playback.key !== input.key || playback.actionKind !== 'idle' ||
    Math.abs(playback.progress - unit(input.progress)) >= 0.000001 ||
    playback.activityProgress !== achievedSceneLandmark(unit(input.progress)) ||
    (!!input.action && input.action.id !== playback.actionId)
  )
}
