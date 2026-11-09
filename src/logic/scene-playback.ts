import type { SceneMotionKind } from './scene-motion'

export interface ScenePlayback {
  key: string | null
  progress: number
  activityProgress: number
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
  action: { id: string; kind: SceneMotionKind; durationMs: number } | null
  /** Motion is off: the hands wait at the last achieved resting pose instead of creeping. */
  still?: boolean | undefined
}
/** Host progress gaps below this are painted at once rather than chased frame by frame: a
 * 25-minute session advances about 0.00017 per countdown refresh, far below one pixel.
 * Sessions shorter than about eight minutes take bigger steps, so those are chased. */
const PROGRESS_SNAP = 0.0005
export const emptyScenePlayback = (): ScenePlayback => ({ key: null, progress: 0, activityProgress: 0, actionId: null, actionKind: 'idle', actionProgress: 1, endingFromActionProgress: 0, actionDurationMs: 0 })
const unit = (value: number) => Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0
export const achievedSceneLandmark = (progress: number): number => progress >= 1 ? 1 : progress >= 0.75 ? 0.75 : progress >= 0.4 ? 0.4 : 0

function activityAt(progress: number, input: ScenePlaybackInput): number {
  return input.still ? achievedSceneLandmark(progress) : progress
}

/** Presentation interpolation only. The activity is a function of the host's fraction, which is a hard ceiling. */
export function advanceScenePlayback(previous: ScenePlayback, input: ScenePlaybackInput, deltaMs: number): ScenePlayback {
  const target = unit(input.progress)
  const next = previous.key === input.key ? previous : { ...emptyScenePlayback(), key: input.key, progress: target, activityProgress: activityAt(target, input) }
  if (!input.key || input.mode === 'settle') return {
    ...next, key: input.key, progress: target, activityProgress: activityAt(target, input),
    actionId: input.action?.id ?? next.actionId, actionKind: 'idle', actionProgress: 1, endingFromActionProgress: 0,
  }
  // A pause or touch keeps a gesture where it is. The activity keeps following the timer, so
  // closing a panel never makes the hands race to catch up; a paused timer simply doesn't move.
  if (input.mode === 'hold') {
    const activityProgress = activityAt(target, input)
    return next.progress === target && next.activityProgress === activityProgress ? next : { ...next, progress: target, activityProgress }
  }
  const delta = Number.isFinite(deltaMs) ? Math.max(0, Math.min(deltaMs, 64)) : 0
  let progress = Math.min(target, next.progress + (target - next.progress) * (1 - Math.exp(-delta / 90)))
  if (Math.abs(target - progress) < PROGRESS_SNAP) progress = target
  const activityProgress = activityAt(progress, input)
  const fresh = input.action && input.action.id !== next.actionId
  const acting = fresh ? {
    ...next, actionId: input.action!.id, actionKind: input.action!.kind, actionProgress: 0,
    endingFromActionProgress: input.action!.kind === 'ending' && (next.actionKind === 'beat' || next.actionKind === 'open') ? next.actionProgress : 0,
    actionDurationMs: Math.max(1, input.action!.durationMs),
  } : next
  const actionProgress = acting.actionKind === 'idle' || fresh ? acting.actionProgress : Math.min(1, acting.actionProgress + delta / acting.actionDurationMs)
  return { ...acting, progress, activityProgress, actionProgress, actionKind: actionProgress >= 1 ? 'idle' : acting.actionKind }
}

export function scenePlaybackNeedsFrame(playback: ScenePlayback, input: ScenePlaybackInput): boolean {
  return !!input.key && input.mode === 'run' && (
    playback.key !== input.key || playback.actionKind !== 'idle' ||
    Math.abs(playback.progress - unit(input.progress)) >= 0.000001 ||
    (!!input.action && input.action.id !== playback.actionId)
  )
}
