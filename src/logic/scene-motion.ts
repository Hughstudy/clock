import type { CompanionScene } from '../contracts/presentation'

export type SceneMotionKind = 'open' | 'beat' | 'ending'
export interface SceneMotionSpec {
  openMs: number
  beatMs: number
  handlingMs: number
  beatMinMs: number
  beatMaxMs: number
  endingMs: Record<'hello' | 'snack' | 'meal' | 'feast' | 'rest', number>
}

/** Validate presentation timings without importing clocks, React or the DOM. */
export function validateSceneMotionSpec(value: SceneMotionSpec): SceneMotionSpec {
  const finite = (number: number, min: number, max: number) => Number.isFinite(number) && number >= min && number <= max
  if (!finite(value.openMs, 100, 3000) || !finite(value.beatMs, 100, 3000) || !finite(value.handlingMs, 500, 6000) ||
      !finite(value.beatMinMs, 60_000, 300_000) || !finite(value.beatMaxMs, value.beatMinMs, 300_000) ||
      !['hello', 'snack', 'meal', 'feast', 'rest'].every(key => finite(value.endingMs[key as keyof SceneMotionSpec['endingMs']], 100, 2400))) {
    throw new Error('Invalid companion scene motion timings')
  }
  return Object.freeze({ ...value, endingMs: Object.freeze({ ...value.endingMs }) })
}

export interface SceneMotionConditions { staticOnly: boolean; touching: boolean; visible: boolean }
export interface SceneMotion {
  key: string | null
  seenCueId: string | null
  beatIndex: number
  active: { id: string; kind: SceneMotionKind; key: string; beatIndex: number } | null
}
export const emptySceneMotion = (): SceneMotion => ({ key: null, seenCueId: null, beatIndex: 0, active: null })

export function sceneCanMove(scene: CompanionScene | null | undefined, conditions: SceneMotionConditions): scene is CompanionScene {
  return !!scene && !conditions.staticOnly && !conditions.touching && conditions.visible && scene.allowBeats && scene.status !== 'paused'
}

function permittedMotion(scene: CompanionScene): SceneMotionKind | null {
  const cue = scene.cue
  if (!cue || cue.sessionId !== scene.sessionId) return null
  if (scene.status === 'ended') return cue.kind === 'settle' && scene.ending?.cueId === cue.id ? 'ending' : null
  if (scene.status !== 'running') return null
  return (scene.phase === 'focus' && cue.kind === 'begin') || (scene.phase === 'break' && cue.kind === 'rest') ? 'open' : null
}

/** Consume cues even when a gesture cannot play; cancellation never queues it. */
export function nextSceneMotion(previous: SceneMotion, scene: CompanionScene | null | undefined, conditions: SceneMotionConditions): SceneMotion {
  const key = scene?.key ?? null
  const cueId = scene?.cue?.id ?? null
  const fresh = cueId !== null && cueId !== previous.seenCueId
  const sameScene = previous.key === key
  const allowed = sceneCanMove(scene, conditions)
  const kind = allowed ? permittedMotion(scene) : null
  let active = sameScene && allowed ? previous.active : null
  if (active && active.kind !== 'beat' && (active.id !== cueId || active.kind !== kind)) active = null
  if (active?.kind === 'beat' && scene?.status !== 'running') active = null
  if (fresh) active = kind && key ? { id: cueId, kind, key, beatIndex: 0 } : null
  const seenCueId = cueId ?? previous.seenCueId
  const beatIndex = sameScene ? previous.beatIndex : 0
  if (key === previous.key && seenCueId === previous.seenCueId && active === previous.active && beatIndex === previous.beatIndex) return previous
  return { key, seenCueId, beatIndex, active }
}

/** Start only the next scheduled beat for this still-current scene. */
export function startSceneBeat(previous: SceneMotion, key: string): SceneMotion {
  if (previous.key !== key || previous.active) return previous
  const index = previous.beatIndex
  return { ...previous, beatIndex: index + 1, active: { id: `${key}:beat:${index}`, key, kind: 'beat', beatIndex: index } }
}

export function finishSceneMotion(previous: SceneMotion, id?: string): SceneMotion {
  return previous.active && (!id || previous.active.id === id) ? { ...previous, active: null } : previous
}

/** Stable sparse cadence. The caller injects the scene key and sequence index. */
export function sceneBeatDelay(key: string, index: number, spec: SceneMotionSpec): number {
  let hash = 2166136261
  for (const character of `${key}:${Math.max(0, Math.floor(index))}`) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return spec.beatMinMs + (hash >>> 0) % (spec.beatMaxMs - spec.beatMinMs + 1)
}

export function sceneMotionDuration(kind: SceneMotionKind, scene: CompanionScene, spec: SceneMotionSpec): number {
  return kind === 'open' ? spec.openMs : kind === 'beat' ? spec.beatMs : spec.endingMs[scene.ending?.tier ?? 'rest']
}
