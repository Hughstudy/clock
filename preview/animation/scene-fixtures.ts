import type { CompanionScene, SceneId } from '../../src/contracts/presentation'
import type { CompanionPresentation } from '../../src/logic/companion'

export const SCENE_LABELS: Record<SceneId, string> = {
  F1: 'Prepare a little meal', F2: 'Planting a seed', F3: 'Reading together', F4: 'A quiet cup of tea',
  F5: 'Bubble blowing', F6: 'Paper boat', F7: 'Block tower', F8: 'Stargazing',
  R1: 'Stretch and yawn', R2: 'Cloud watching', R3: 'Warm drink',
}
export const SCENE_IDS = Object.keys(SCENE_LABELS) as SceneId[]
export type SceneFixtureState = 'opening' | 'loop' | 'paused' | 'ending' | 'restored' | 'error'
export type SceneFixtureTier = 'hello' | 'snack' | 'meal' | 'feast'

/** Read-only C2-P3 fixtures. They never create sessions, save, or grant scene access. */
export function activityFixture(id: SceneId, state: SceneFixtureState, serial: number, tier: SceneFixtureTier, progress: number, attentionAllowed: boolean): CompanionScene {
  const phase = id.startsWith('R') ? 'break' : 'focus'
  const sessionId = `fixture-session-${id}`
  const cueId = `fixture-${id}-${state}-${serial}`
  const cue = state === 'opening' || state === 'ending'
    ? { id: cueId, kind: state === 'ending' ? 'settle' as const : phase === 'break' ? 'rest' as const : 'begin' as const, sessionId, thoughtId: null }
    : null
  return {
    key: `fixture-generation:${sessionId}:catalog-1`, id, sessionId, phase,
    status: state === 'paused' ? 'paused' : state === 'ending' ? 'ended' : 'running',
    completedProgress: phase === 'break' ? 0 : Math.min(1, Math.max(0, progress)),
    allowBeats: attentionAllowed && state !== 'error', cue,
    ending: state === 'ending' ? { cueId, tier: phase === 'break' ? null : tier } : null,
  }
}

export function activityPresentation(scene: CompanionScene, state: SceneFixtureState, staticOnly: boolean): CompanionPresentation {
  return {
    stance: state === 'error' ? 'neutral' : scene.status === 'ended' ? 'settled' : scene.status === 'paused' ? 'paused' : scene.phase === 'break' ? 'resting' : 'focused',
    cue: null,
    staticOnly: staticOnly || state === 'error',
  }
}
