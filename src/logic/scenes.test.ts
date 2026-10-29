import { describe, expect, it } from 'vitest'
import { sceneRules } from '../data/scene-rules'
import { spec } from '../data/spec'
import { applyAction, type AppAction } from './app'
import { claimSceneAnnouncement, endingTierForElapsed, grantSceneUnlocks, initialScenes, mergeSceneStates, pendingSceneAnnouncement, selectScene } from './scenes'
import { createSnapshot, decodeSnapshot, encodeSnapshot, mergeSnapshots } from './snapshot'
import type { AppSnapshot, FocusRecord, SceneId } from './types'

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

describe('durable scene rotation', () => {
  it('uses every starter once per bag with no repeat across bag boundaries', () => {
    let scenes = initialScenes()
    const ids: SceneId[] = []
    for (let i = 0; i < 60; i++) {
      const next = selectScene(scenes, 'focus')
      scenes = next.scenes
      ids.push(next.assignment.sceneId)
      expect(next.assignment.ordinal).toBe(i + 1)
    }
    for (let i = 0; i < ids.length; i += 3) expect(new Set(ids.slice(i, i + 3))).toEqual(new Set(['F1', 'F2', 'F3']))
    expect(ids.every((id, i) => i === 0 || id !== ids[i - 1])).toBe(true)
    expect(selectScene(initialScenes(), 'focus')).toEqual(selectScene(initialScenes(), 'focus'))
  })

  it('rotates consecutive rests independently of focus participation', () => {
    let scenes = selectScene(initialScenes(), 'focus').scenes
    const focus = scenes.focus
    const ids: SceneId[] = []
    for (let i = 0; i < 9; i++) {
      const next = selectScene(scenes, 'rest')
      scenes = next.scenes
      ids.push(next.assignment.sceneId)
    }
    expect(scenes.focus).toEqual(focus)
    expect(new Set(ids.slice(0, 3))).toEqual(new Set(['R1', 'R2', 'R3']))
    expect(ids.every((id, i) => i === 0 || id !== ids[i - 1])).toBe(true)
  })

  it('introduces several historical unlocks one per start without losing the current bag', () => {
    const first = selectScene(initialScenes(), 'focus')
    let scenes = grantSceneUnlocks(first.scenes, Array.from({ length: 15 }, (_, i) => record(i)), true)
    const oldBag = [...scenes.focus.remaining]
    const ids: SceneId[] = []
    for (let i = 0; i < 5; i++) {
      const next = selectScene(scenes, 'focus')
      scenes = next.scenes
      ids.push(next.assignment.sceneId)
    }
    expect(ids).toEqual(['F4', 'F5', 'F6', 'F7', 'F8'])
    expect(scenes.focus.remaining).toEqual(oldBag)
    expect(selectScene(scenes, 'focus').assignment.sceneId).toBe(oldBag[0])
    expect(pendingSceneAnnouncement(scenes)).toBeNull()
  })

  it('retains assignment on pause, resume, reload, retries and rejected starts', () => {
    let s = start(createSnapshot(spec))
    const scene = s.timer.session!.scene
    s = act(s, { type: 'pause', sessionId: 'one' }, 2 * MIN).snapshot
    s = roundTrip(s)
    s = act(s, { type: 'resume', sessionId: 'one' }, 8 * MIN).snapshot
    s = act(s, { type: 'start', sessionId: 'one', timeZone: 'UTC' }, 8 * MIN).snapshot
    s = act(s, { type: 'start', sessionId: 'two', timeZone: 'UTC' }, 8 * MIN).snapshot
    expect(s.timer.session?.scene).toEqual(scene)
    expect(s.scenes.focus.ordinal).toBe(1)
    expect(act(s, { type: 'end', sessionId: 'stale' }, 8 * MIN).snapshot).toBe(s)
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

describe('scene grants and claims', () => {
  it('grants only distinct deadline sessions at configured thresholds', () => {
    const manual = Array.from({ length: 30 }, (_, i) => record(i, 'manual'))
    expect(grantSceneUnlocks(initialScenes(), manual).unlocked).toEqual([])
    const one = record(0)
    const scenes = grantSceneUnlocks(initialScenes(), [one, one, one])
    expect(scenes.unlocked.map(unlock => unlock.sceneId)).toEqual(['F4'])
    const all = grantSceneUnlocks(scenes, Array.from({ length: 15 }, (_, i) => record(i)))
    expect(all.unlocked.map(unlock => unlock.sceneId)).toEqual(['F4', 'F5', 'F6', 'F7', 'F8'])
    expect(grantSceneUnlocks(all, []).unlocked).toEqual(all.unlocked)
    expect(grantSceneUnlocks(all, [one], false, { ...sceneRules, unlocks: [{ sceneId: 'F4', successes: 100 }] })).toBe(all)
  })

  it('records the deadline and unlock in one transition, only once after recovery', () => {
    const s = start(createSnapshot(spec))
    const ended = act(s, { type: 'reconcile' }, 20 * MIN)
    expect(ended.snapshot.records).toHaveLength(1)
    expect(ended.snapshot.scenes.unlocked).toEqual([{ sceneId: 'F4', unlockedAt: 5 * MIN, bySessionId: 'one', ruleVersion: 1 }])
    expect(ended.snapshot.scenes.lastEnded?.scene).toEqual(s.timer.session!.scene)
    expect(act(ended.snapshot, { type: 'reconcile' }, 21 * MIN).changed).toBe(false)
  })

  it('claims once while ready and does not claim during a running session', () => {
    const s = act(start(createSnapshot(spec)), { type: 'reconcile' }, 5 * MIN).snapshot
    expect(pendingSceneAnnouncement(s.scenes)).toBe('F4')
    const claim = act(s, { type: 'claimSceneAnnouncement', sceneId: 'F4' }, 5 * MIN)
    expect(claim.sceneAnnouncement).toBe('F4')
    expect(act(claim.snapshot, { type: 'claimSceneAnnouncement', sceneId: 'F4' }, 5 * MIN).sceneAnnouncement).toBeUndefined()
    expect(claimSceneAnnouncement(s.scenes, 'F8')).toBe(s.scenes)
    const running = act(s, { type: 'startBreak', sessionId: 'rest', timeZone: 'UTC' }, 5 * MIN).snapshot
    expect(act(running, { type: 'claimSceneAnnouncement', sceneId: 'F4' }, 5 * MIN).sceneAnnouncement).toBeUndefined()
  })

  it.each([[0, 'hello'], [59_999, 'hello'], [60_000, 'snack'], [599_999, 'snack'], [600_000, 'meal'], [1_799_999, 'meal'], [1_800_000, 'feast']] as const)('maps %i ms to %s without overlapping boundaries', (ms, tier) => {
    expect(endingTierForElapsed(ms)).toBe(tier)
  })

  it('silently migrates historical successes and preserves accounting and active timing', () => {
    const original = start(createSnapshot(spec))
    const { scenes: _, ...old } = original
    const { scene: __, ...oldSession } = old.timer.session!
    const records = Array.from({ length: 15 }, (_, i) => record(i))
    const decoded = decodeSnapshot(JSON.stringify({ ...old, version: 4, records, timer: { ...old.timer, session: oldSession } }), spec, { timeZone: 'UTC' })
    if (decoded.kind !== 'ok') throw Error(decoded.kind)
    expect(decoded.issues).toEqual([])
    expect(decoded.snapshot.records).toEqual(records)
    expect(decoded.snapshot.timer.session).toMatchObject(oldSession)
    expect(decoded.snapshot.scenes.unlocked).toHaveLength(5)
    expect(decoded.snapshot.scenes.announced).toEqual(['F4', 'F5', 'F6', 'F7', 'F8'])
    expect(roundTrip(decoded.snapshot)).toEqual(decoded.snapshot)
  })

  it('unions claims and introduced scenes while preserving the newer active assignment', () => {
    const a = selectScene(grantSceneUnlocks(initialScenes(), [record(0)]), 'focus').scenes
    const b = claimSceneAnnouncement(grantSceneUnlocks(initialScenes(), [record(0)]), 'F4')
    const merged = mergeSceneStates(a, b)
    expect(merged.introduced).toContain('F4')
    expect(merged.announced).toContain('F4')
    expect(selectScene(merged, 'focus').assignment.sceneId).not.toBe('F4')
    const fresh = start({ ...createSnapshot(spec), scenes: merged })
    const stale = { ...createSnapshot(spec), scenes: b, revision: 0 }
    const snapshot = mergeSnapshots({ ...fresh, revision: 2 }, stale)
    expect(snapshot.timer.session?.scene).toEqual(fresh.timer.session?.scene)
    const cleared = { ...createSnapshot(spec), datasetGeneration: 1 }
    expect(mergeSnapshots(snapshot, cleared)).toEqual(cleared)
  })

  it('preserves factual time when malformed scene metadata needs repair', () => {
    const s = start(createSnapshot(spec))
    const raw = {
      ...s,
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
