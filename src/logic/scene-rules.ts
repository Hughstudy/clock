import type { FocusSceneId, RestSceneId } from './types'

export interface SceneRules {
  seed: number
  selectionVersion: 1
  ruleVersion: number
  starters: readonly FocusSceneId[]
  rest: readonly RestSceneId[]
  unlocks: readonly { sceneId: FocusSceneId; successes: number }[]
  tierMs: readonly [number, number, number]
}

/** All catalog art ships together; these thresholds affect new grants only. */
export const sceneRules: SceneRules = {
  seed: 0x426c7565,
  selectionVersion: 1,
  ruleVersion: 1,
  starters: ['F1', 'F2', 'F3'],
  rest: ['R1', 'R2', 'R3'],
  unlocks: [
    { sceneId: 'F4', successes: 1 }, { sceneId: 'F5', successes: 3 },
    { sceneId: 'F6', successes: 6 }, { sceneId: 'F7', successes: 10 },
    { sceneId: 'F8', successes: 15 },
  ],
  tierMs: [60_000, 600_000, 1_800_000],
}

const ids = [...sceneRules.starters, ...sceneRules.rest, ...sceneRules.unlocks.map(rule => rule.sceneId)]
if (!Number.isSafeInteger(sceneRules.seed) || sceneRules.selectionVersion !== 1 ||
  !Number.isSafeInteger(sceneRules.ruleVersion) || sceneRules.ruleVersion < 1 ||
  !sceneRules.starters.length || !sceneRules.rest.length ||
  sceneRules.starters.some(id => !/^F[1-8]$/.test(id)) || sceneRules.rest.some(id => !/^R[1-3]$/.test(id)) ||
  new Set(ids).size !== ids.length || sceneRules.unlocks.some((rule, i) =>
  !/^F[1-8]$/.test(rule.sceneId) ||
  !Number.isSafeInteger(rule.successes) || rule.successes < 1 ||
  (i > 0 && rule.successes <= sceneRules.unlocks[i - 1]!.successes)) ||
  sceneRules.tierMs.some((ms, i) => !Number.isFinite(ms) || ms <= 0 || (i > 0 && ms <= sceneRules.tierMs[i - 1]!))) {
  throw new Error('Invalid scene catalog rules')
}
