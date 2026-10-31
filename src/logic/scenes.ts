import { sceneRules, type SceneRules } from './scene-rules'
import type { FocusSceneId, SceneAssignment, SceneId, SceneRotation, SceneState } from './types'

export const FOCUS_SCENE_IDS = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8'] as const
export const REST_SCENE_IDS = ['R1', 'R2', 'R3'] as const
export type EndingTier = 'hello' | 'snack' | 'meal' | 'feast'
export const isFocusSceneId = (id: unknown): id is FocusSceneId => FOCUS_SCENE_IDS.some(scene => scene === id)
export const isSceneId = (id: unknown): id is SceneId => isFocusSceneId(id) || REST_SCENE_IDS.some(scene => scene === id)
const rotation = (): SceneRotation => ({ ordinal: 0, cycle: 0, remaining: [], last: null })
export const initialScenes = (): SceneState => ({ focus: rotation(), rest: rotation(), unlocked: [], introduced: [], announced: [], lastEnded: null })

export function endingTierForElapsed(elapsedMs: number, rules: SceneRules = sceneRules): EndingTier {
  const [snack, meal, feast] = rules.tierMs
  return elapsedMs < snack ? 'hello' : elapsedMs < meal ? 'snack' : elapsedMs < feast ? 'meal' : 'feast'
}

function shuffled(pool: readonly SceneId[], seed: number, last: SceneId | null): SceneId[] {
  const bag = [...pool]
  let state = seed >>> 0
  for (let i = bag.length - 1; i > 0; i--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    const j = state % (i + 1)
    ;[bag[i], bag[j]] = [bag[j]!, bag[i]!]
  }
  if (bag.length > 1 && bag[0] === last) [bag[0], bag[1]] = [bag[1]!, bag[0]!]
  return bag
}

/** Stable session identity is supplied by main; pure logic never creates entropy. */
export function identitySeed(identity: string): number {
  let hash = 2166136261
  for (let i = 0; i < identity.length; i++) hash = Math.imul(hash ^ identity.charCodeAt(i), 16777619)
  return hash >>> 0
}

/** Called once after a new session is accepted; the transaction saves the entire bag. */
export function selectScene(state: SceneState, phase: 'focus' | 'rest', sessionId: string, rules: SceneRules = sceneRules): { scenes: SceneState; assignment: SceneAssignment } {
  const previous = state[phase]
  const pool: readonly SceneId[] = phase === 'focus' ? rules.focus : rules.rest
  let remaining = previous.remaining.filter(id => pool.includes(id))
  let cycle = previous.cycle
  if (!remaining.length) {
    remaining = shuffled(pool, rules.seed ^ identitySeed(sessionId) ^ (phase === 'rest' ? 0x72657374 : 0) ^ Math.imul(cycle + 1, 2654435761), previous.last)
    cycle++
  }
  const sceneId = remaining[0]!
  const next: SceneRotation = { ordinal: previous.ordinal + 1, cycle, remaining: remaining.slice(1), last: sceneId }
  return {
    scenes: { ...state, [phase]: next, lastEnded: null },
    assignment: { sceneId, ordinal: next.ordinal, selectionVersion: rules.selectionVersion },
  }
}

export function hasMissingScenes(base: SceneState, other: SceneState): boolean {
  return other.unlocked.some(unlock => !base.unlocked.some(item => item.sceneId === unlock.sceneId)) ||
    other.announced.some(id => !base.announced.includes(id)) || other.introduced.some(id => !base.introduced.includes(id)) ||
    other.focus.ordinal > base.focus.ordinal || other.rest.ordinal > base.rest.ordinal
}

/** Cursor ties follow the newer snapshot. Inert v5 history remains append-only. */
export function mergeSceneStates(base: SceneState, other: SceneState): SceneState {
  if (!hasMissingScenes(base, other)) return base
  const unlocked = new Map(base.unlocked.map(unlock => [unlock.sceneId, unlock]))
  for (const unlock of other.unlocked) if (!unlocked.has(unlock.sceneId)) unlocked.set(unlock.sceneId, unlock)
  return {
    ...base,
    focus: other.focus.ordinal > base.focus.ordinal ? other.focus : base.focus,
    rest: other.rest.ordinal > base.rest.ordinal ? other.rest : base.rest,
    unlocked: [...unlocked.values()].sort((a, b) => a.sceneId.localeCompare(b.sceneId)),
    introduced: [...new Set([...base.introduced, ...other.introduced])].sort(),
    announced: [...new Set([...base.announced, ...other.announced])].sort(),
  }
}
