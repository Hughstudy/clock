import type { FocusSceneId, RestSceneId } from './types'

export interface SceneRules {
  seed: number
  selectionVersion: 2
  focus: readonly FocusSceneId[]
  rest: readonly RestSceneId[]
  tierMs: readonly [number, number, number]
}

/** Every scene is available immediately; focus and rest have independent bags. */
export const sceneRules: SceneRules = {
  seed: 0x426c7565,
  selectionVersion: 2,
  focus: ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8'],
  rest: ['R1', 'R2', 'R3'],
  tierMs: [60_000, 600_000, 1_800_000],
}

const ids = [...sceneRules.focus, ...sceneRules.rest]
if (!Number.isSafeInteger(sceneRules.seed) || sceneRules.selectionVersion !== 2 ||
  sceneRules.focus.length !== 8 || sceneRules.rest.length !== 3 ||
  sceneRules.focus.some(id => !/^F[1-8]$/.test(id)) || sceneRules.rest.some(id => !/^R[1-3]$/.test(id)) ||
  new Set(ids).size !== ids.length ||
  sceneRules.tierMs.some((ms, i) => !Number.isFinite(ms) || ms <= 0 || (i > 0 && ms <= sceneRules.tierMs[i - 1]!))) {
  throw new Error('Invalid scene catalog rules')
}
