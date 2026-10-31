import { describe, expect, it } from 'vitest'
import { sceneRules } from '../data/scene-rules'
import { spec } from '../data/spec'
import { applyAction, type AppAction } from './app'
import { endingTierForElapsed, initialScenes, mergeSceneStates, selectScene } from './scenes'
import { createSnapshot, decodeSnapshot, encodeSnapshot, mergeSnapshots } from './snapshot'
import type { AppSnapshot, FocusRecord, SceneAssignment, SceneId } from './types'

const MIN = 60_000
const ctx = (now: number) => ({ now, dateKeyOf: () => '2026-10-29' })
const act = (s: AppSnapshot, action: AppAction, now = 0) => applyAction(s, action, ctx(now), spec)
const start = (s: AppSnapshot, id = 'one', now = 0) => act(s, { type: 'start', sessionId: id, timeZone: 'UTC', durationMinutes: 5 }, now).snapshot
const record = (n: number, reason: 'deadline' | 'manual' = 'deadline'): FocusRecord => ({
  sessionId: `session-${n}`, startedAt: n * MIN, endedAt: (n + 1) * MIN, dateKey: '2026-10-29',
  elapsedMs: MIN, targetMs: MIN, endReason: reason, source: 'native', step: null,
})
function roundTrip(s: AppSnapshot): AppSnapshot {
  const loaded = decodeSnapshot(encodeSnapshot(s), spec, { timeZone: 'UTC' })
  if (loaded.kind !== 'ok' || loaded.issues.length) throw new Error(JSON.stringify(loaded))
  return loaded.snapshot
}

const legacyUnlock = { sceneId: 'F4' as const, unlockedAt: MIN, bySessionId: 'past', ruleVersion: 1 }

describe('immediately available durable scene rotation', () => {
  it('uses all eight focus scenes from zero completions, without adjacent repeats', () => {
    let scenes = initialScenes()
    const ids: SceneId[] = []
    for (let i = 0; i < 80; i++) {
      const next = selectScene(scenes, 'focus', `session-${i}`)
      scenes = next.scenes
      ids.push(next.assignment.sceneId)
      expect(next.assignment).toMatchObject({ ordinal: i + 1, selectionVersion: 2 })
    }
    for (let i = 0; i < ids.length; i += 8) expect(new Set(ids.slice(i, i + 8))).toEqual(new Set(sceneRules.focus))
    expect(ids.every((id, i) => i === 0 || id !== ids[i - 1])).toBe(true)
    expect(scenes.unlocked).toEqual([])
    expect(scenes.introduced).toEqual([])
    expect(scenes.announced).toEqual([])
  })

  it('uses explicit stable identity for deterministic but varied bag orders', () => {
    const a = selectScene(initialScenes(), 'focus', 'installation-a-session-1')
    expect(selectScene(initialScenes(), 'focus', 'installation-a-session-1')).toEqual(a)
    const orders = new Set(Array.from({ length: 20 }, (_, i) => {
      const next = selectScene(initialScenes(), 'focus', `installation-${i}-session-1`)
      return [next.assignment.sceneId, ...next.scenes.focus.remaining].join(',')
    }))
    expect(orders.size).toBeGreaterThan(1)
  })

  it('rotates all three rest scenes independently of focus', () => {
    let scenes = selectScene(initialScenes(), 'focus', 'focus').scenes
    const focus = scenes.focus
    const ids: SceneId[] = []
    for (let i = 0; i < 30; i++) {
      const next = selectScene(scenes, 'rest', `rest-${i}`)
      scenes = next.scenes
      ids.push(next.assignment.sceneId)
    }
    expect(scenes.focus).toEqual(focus)
    for (let i = 0; i < ids.length; i += 3) expect(new Set(ids.slice(i, i + 3))).toEqual(new Set(sceneRules.rest))
    expect(ids.every((id, i) => i === 0 || id !== ids[i - 1])).toBe(true)
  })

  it('never prioritizes or adds legacy grants, introductions or notices', () => {
    const empty = initialScenes()
    const legacy = { ...empty, unlocked: [legacyUnlock], introduced: ['F4' as const], announced: [] }
    const a = selectScene(empty, 'focus', 'same-session')
    const b = selectScene(legacy, 'focus', 'same-session')
    expect(b.assignment).toEqual(a.assignment)
    expect(b.scenes.focus).toEqual(a.scenes.focus)
    expect(b.scenes.unlocked).toEqual(legacy.unlocked)
    expect(b.scenes.introduced).toEqual(legacy.introduced)
    expect(b.scenes.announced).toEqual([])
  })

  it('retains assignment on pause, resume, reload, retries, preferences and rejected starts', () => {
    let s = start(createSnapshot(spec))
    const scene = s.timer.session!.scene
    s = act(s, { type: 'pause', sessionId: 'one' }, 2 * MIN).snapshot
    s = roundTrip(s)
    s = act(s, { type: 'resume', sessionId: 'one' }, 8 * MIN).snapshot
    s = act(s, { type: 'updateSettings', patch: { sceneVarietyEnabled: false } }, 8 * MIN).snapshot
    s = act(s, { type: 'start', sessionId: 'one', timeZone: 'UTC' }, 8 * MIN).snapshot
    s = act(s, { type: 'start', sessionId: 'two', timeZone: 'UTC' }, 8 * MIN).snapshot
    expect(s.timer.session?.scene).toEqual(scene)
    expect(s.scenes.focus.ordinal).toBe(1)
    expect(act(s, { type: 'end', sessionId: 'stale' }, 8 * MIN).snapshot).toBe(s)
  })

  it('rejects invalid starts without consuming a bag entry', () => {
    const s = createSnapshot(spec)
    expect(act(s, { type: 'start', sessionId: 'invalid', timeZone: 'UTC', durationMinutes: 0 }).snapshot).toBe(s)
    expect(act(s, { type: 'start', sessionId: 'wrong-phase', timeZone: 'UTC', expectedPhase: 'longBreak' }).snapshot).toBe(s)
  })

  it('retains each ending and lets a new session replace it immediately', () => {
    let s = start(createSnapshot(spec))
    const scene = s.timer.session!.scene
    s = act(s, { type: 'end', sessionId: 'one' }, 10_000).snapshot
    expect(s.records[0]?.scene).toEqual(scene)
    expect(s.scenes.lastEnded).toEqual({ sessionId: 'one', phase: 'focus', scene, elapsedMs: 10_000, endedAt: 10_000 })
    s = act(s, { type: 'startBreak', sessionId: 'rest', timeZone: 'UTC' }, 20_000).snapshot
    expect(s.scenes.lastEnded).toBeNull()
    const restScene = s.timer.session!.scene
    s = act(s, { type: 'end', sessionId: 'rest' }, 30_000).snapshot
    expect(s.scenes.lastEnded).toEqual({ sessionId: 'rest', phase: 'rest', scene: restScene, elapsedMs: 10_000, endedAt: 30_000 })
    expect(s.records).toHaveLength(1)
    expect(s.participations).toHaveLength(1)
    expect(roundTrip(s)).toEqual(s)
  })
})

describe('scene compatibility and factual endings', () => {
  it('records a deadline once without deriving grants and keeps long-break cadence', () => {
    let s = createSnapshot(spec)
    for (let i = 0; i < 4; i++) {
      s = start({ ...s, timer: { ...s.timer, phase: 'focus' } }, `focus-${i}`, i * 5 * MIN)
      s = act(s, { type: 'reconcile' }, (i + 1) * 5 * MIN).snapshot
    }
    expect(s.timer).toMatchObject({ phase: 'longBreak', session: null, completedFocusCount: 4 })
    expect(s.records).toHaveLength(4)
    expect(s.scenes.unlocked).toEqual([])
    expect(s.scenes.announced).toEqual([])
    expect(act(s, { type: 'reconcile' }, 21 * MIN).changed).toBe(false)
  })

  it.each([0, 1_000, 59_999])('records a %i ms ending without changing availability or grants', ms => {
    const s = act(start(createSnapshot(spec)), { type: 'end', sessionId: 'one' }, ms).snapshot
    expect(s.records[0]?.elapsedMs).toBe(ms)
    expect(s.scenes.unlocked).toEqual([])
    expect(selectScene(s.scenes, 'focus', 'next').scenes.focus.remaining).toHaveLength(6)
  })

  it.each([[0, 'hello'], [59_999, 'hello'], [60_000, 'snack'], [599_999, 'snack'], [600_000, 'meal'], [1_799_999, 'meal'], [1_800_000, 'feast']] as const)('maps %i ms to %s without overlapping boundaries', (ms, tier) => {
    expect(endingTierForElapsed(ms)).toBe(tier)
  })

  it('upgrades pre-scene data without grants or fabricated historical assignments', () => {
    const original = start(createSnapshot(spec))
    const { scenes: _, ...old } = original
    const { scene: __, ...oldSession } = old.timer.session!
    const records = Array.from({ length: 15 }, (_, i) => record(i))
    const decoded = decodeSnapshot(JSON.stringify({ ...old, version: 4, records, timer: { ...old.timer, session: oldSession } }), spec, { timeZone: 'UTC' })
    if (decoded.kind !== 'ok') throw Error(decoded.kind)
    expect(decoded.issues).toEqual([])
    expect(decoded.snapshot.records).toEqual(records)
    expect(decoded.snapshot.timer.session).toMatchObject(oldSession)
    expect(decoded.snapshot.timer.session?.scene?.selectionVersion).toBe(2)
    expect(decoded.snapshot.scenes.unlocked).toEqual([])
    expect(decoded.snapshot.scenes.announced).toEqual([])
    expect(roundTrip(decoded.snapshot)).toEqual(decoded.snapshot)
  })

  it.each(['running', 'paused'] as const)('migrates v5 %s identity and history; resets only future bags once', status => {
    const scene: SceneAssignment = { sceneId: 'F2', ordinal: 4, selectionVersion: 1 }
    let original = start(createSnapshot(spec))
    if (status === 'paused') original = act(original, { type: 'pause', sessionId: 'one' }, MIN).snapshot
    const old = { ...original, version: 5, datasetGeneration: 3,
      timer: { ...original.timer, completedFocusCount: 1, session: { ...original.timer.session!, scene } },
      records: [{ ...record(0), scene }],
      scenes: { ...original.scenes, focus: { ordinal: 4, cycle: 2, last: 'F2' as const, remaining: ['F1' as const, 'F3' as const] },
        unlocked: [legacyUnlock], introduced: ['F4' as const], announced: [] },
    }
    const loaded = roundTrip(old)
    expect(loaded.version).toBe(6)
    expect(loaded.timer).toEqual(old.timer)
    expect(loaded.records).toEqual(old.records)
    expect(loaded.datasetGeneration).toBe(3)
    expect(loaded.settings).toEqual(old.settings)
    expect(loaded.scenes.focus).toEqual({ ...old.scenes.focus, remaining: [] })
    expect(loaded.scenes.unlocked).toEqual([legacyUnlock])
    expect(loaded.scenes.announced).toEqual([])
    const next = selectScene(loaded.scenes, 'focus', 'next')
    expect(next.assignment).toMatchObject({ ordinal: 5, selectionVersion: 2 })
    expect(next.assignment.sceneId).not.toBe('F2')
    expect(new Set([next.assignment.sceneId, ...next.scenes.focus.remaining])).toEqual(new Set(sceneRules.focus))
    expect(roundTrip({ ...loaded, scenes: next.scenes }).scenes).toEqual(next.scenes)
  })

  it('merges independent cursors and inert legacy metadata without changing the newer active assignment', () => {
    const focus = selectScene(initialScenes(), 'focus', 'first').scenes
    const rest = selectScene(initialScenes(), 'rest', 'rest').scenes
    const other = { ...rest, unlocked: [legacyUnlock], introduced: ['F4' as const], announced: ['F4' as const] }
    const merged = mergeSceneStates(focus, other)
    expect(merged.focus).toEqual(focus.focus)
    expect(merged.rest).toEqual(rest.rest)
    expect(merged.unlocked).toEqual([legacyUnlock])
    const fresh = start({ ...createSnapshot(spec), scenes: merged })
    const stale = { ...createSnapshot(spec), scenes: other, revision: 0, records: [record(0)] }
    const snapshot = mergeSnapshots({ ...fresh, revision: 2 }, stale)
    expect(snapshot.timer.session?.scene).toEqual(fresh.timer.session?.scene)
    expect(snapshot.scenes.unlocked).toEqual([legacyUnlock])
    expect(snapshot.scenes.announced).toEqual(['F4'])
    const cleared = { ...createSnapshot(spec), datasetGeneration: 1 }
    expect(mergeSnapshots(snapshot, cleared)).toEqual(cleared)
  })

  it('preserves factual time when malformed scene metadata needs repair', () => {
    const s = start(createSnapshot(spec))
    const raw = { ...s,
      timer: { ...s.timer, session: { ...s.timer.session, scene: { sceneId: 'R1', ordinal: 1, selectionVersion: 1 } } },
      records: [{ ...record(0), scene: { sceneId: 'unknown', ordinal: -1, selectionVersion: 1 } }],
      scenes: { ...s.scenes, focus: { ordinal: -1 }, unlocked: [{ sceneId: 'F4', unlockedAt: 'bad' }] },
    }
    const loaded = decodeSnapshot(JSON.stringify(raw), spec, { timeZone: 'UTC' })
    if (loaded.kind !== 'ok') throw Error(loaded.kind)
    expect(loaded.snapshot.records).toEqual([record(0)])
    expect(loaded.snapshot.timer.session).toMatchObject({ id: 'one', durationMs: 5 * MIN, deadline: 5 * MIN })
    expect(loaded.snapshot.timer.session?.scene).toBeUndefined()
    expect(loaded.issues).toEqual(expect.arrayContaining(['timer.session.scene.phase', 'record.scene (session-0)', 'scenes.focus', 'scenes.unlocked']))
  })
})
