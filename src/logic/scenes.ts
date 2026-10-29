import { sceneRules, type SceneRules } from './scene-rules'
import type { FocusRecord, FocusSceneId, SceneAssignment, SceneId, SceneRotation, SceneState, SceneUnlock } from './types'

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

/** Selection is called only after the host accepts a new session. No clocks or randomness. */
export function selectScene(state: SceneState, phase: 'focus' | 'rest', rules: SceneRules = sceneRules): { scenes: SceneState; assignment: SceneAssignment } {
  const previous = state[phase]
  const pool: SceneId[] = phase === 'focus'
    ? [...rules.starters, ...state.unlocked.map(unlock => unlock.sceneId)] : [...rules.rest]
  const fresh = phase === 'focus' ? state.unlocked.find(unlock => !state.introduced.includes(unlock.sceneId))?.sceneId : undefined
  let remaining = previous.remaining.filter(id => pool.includes(id))
  let cycle = previous.cycle
  if (!remaining.length && !fresh) {
    remaining = shuffled(pool, rules.seed ^ (phase === 'rest' ? 0x72657374 : 0) ^ Math.imul(cycle + 1, 2654435761), previous.last)
    cycle++
  }
  const sceneId = fresh ?? remaining[0] ?? (phase === 'focus' ? 'F1' : 'R1')
  remaining = remaining.filter(id => id !== sceneId)
  const next: SceneRotation = { ordinal: previous.ordinal + 1, cycle, remaining, last: sceneId }
  const introduced = isFocusSceneId(sceneId) && !state.introduced.includes(sceneId) ? [...state.introduced, sceneId] : state.introduced
  return {
    scenes: { ...state, [phase]: next, introduced, lastEnded: null },
    assignment: { sceneId, ordinal: next.ordinal, selectionVersion: rules.selectionVersion },
  }
}

/** Grants are derived from unique factual deadline records, never a timer's display. */
export function grantSceneUnlocks(state: SceneState, records: readonly FocusRecord[], silent = false, rules: SceneRules = sceneRules): SceneState {
  const unique = new Map(records.filter(record => record.endReason === 'deadline').map(record => [record.sessionId, record]))
  const successes = [...unique.values()].sort((a, b) => a.endedAt - b.endedAt || a.sessionId.localeCompare(b.sessionId))
  const additions: SceneUnlock[] = []
  for (const rule of rules.unlocks) {
    const earned = successes[rule.successes - 1]
    if (earned && !state.unlocked.some(unlock => unlock.sceneId === rule.sceneId)) {
      additions.push({ sceneId: rule.sceneId, unlockedAt: earned.endedAt, bySessionId: earned.sessionId, ruleVersion: rules.ruleVersion })
    }
  }
  if (!additions.length) return state
  const unlocked = [...state.unlocked, ...additions].sort((a, b) => a.sceneId.localeCompare(b.sceneId))
  return { ...state, unlocked, announced: silent ? [...new Set([...state.announced, ...additions.map(unlock => unlock.sceneId)])].sort() : state.announced }
}

export const pendingSceneAnnouncement = (state: SceneState): FocusSceneId | null =>
  state.unlocked.find(unlock => !state.announced.includes(unlock.sceneId))?.sceneId ?? null

/** At-most-once browser-dataset claim; the host displays only after the transaction saves. */
export function claimSceneAnnouncement(state: SceneState, sceneId: FocusSceneId): SceneState {
  if (!state.unlocked.some(unlock => unlock.sceneId === sceneId) || state.announced.includes(sceneId)) return state
  return { ...state, announced: [...state.announced, sceneId].sort() }
}

export function hasMissingScenes(base: SceneState, other: SceneState): boolean {
  return other.unlocked.some(unlock => !base.unlocked.some(item => item.sceneId === unlock.sceneId)) ||
    other.announced.some(id => !base.announced.includes(id)) || other.introduced.some(id => !base.introduced.includes(id)) ||
    other.focus.ordinal > base.focus.ordinal || other.rest.ordinal > base.rest.ordinal
}

/** Cursor ties follow the newer snapshot. Append-only content never follows last-writer-wins. */
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
