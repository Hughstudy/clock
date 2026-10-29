import { describe, expect, it } from 'vitest'
import { spec } from '../data/spec'
import { applyAction, type AppAction } from '../logic/app'
import { encodeSnapshot } from '../logic/snapshot'
import type { AppSnapshot } from '../logic/types'
import { createLock, type LockRunner } from './locks'
import { SnapshotStore, type KeyValueStorage } from './storage'

const KEY = 'test:snapshot'
const MIN = 60_000
const T0 = Date.UTC(2026, 9, 28, 9)
const utcKey = (ms: number) => new Date(ms).toISOString().slice(0, 10)

class MemoryStorage implements KeyValueStorage {
  readonly data = new Map<string, string>()
  failWrites = false
  failReads = false
  getItem(key: string): string | null {
    if (this.failReads) throw new DOMException('blocked', 'SecurityError')
    return this.data.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    if (this.failWrites) throw new DOMException('full', 'QuotaExceededError')
    this.data.set(key, value)
  }
}

/** One lock shared by "tabs", standing in for the Web Locks API. */
function sharedLock(): LockRunner {
  let tail: Promise<unknown> = Promise.resolve()
  return {
    run<T>(task: () => T | Promise<T>) {
      const result = tail.then(task, task)
      tail = result.catch(() => undefined)
      return result
    },
  }
}

function tab(storage: KeyValueStorage | null, writerId: string, lock: LockRunner | null = sharedLock()): SnapshotStore {
  return new SnapshotStore({ key: KEY, storage, lock, spec, writerId, now: () => T0, timeZone: () => 'Europe/Berlin' })
}

function act(store: SnapshotStore, action: AppAction, now: number) {
  return store.transact((latest) => {
    const t = applyAction(latest, action, { now, dateKeyOf: utcKey }, spec)
    return { snapshot: t.snapshot, changed: t.changed, value: t.completion }
  })
}

function stored(storage: MemoryStorage): AppSnapshot {
  return JSON.parse(storage.data.get(KEY) ?? 'null') as AppSnapshot
}

describe('SnapshotStore persistence', () => {
  it('starts with defaults and writes only when something changes', async () => {
    const storage = new MemoryStorage()
    const store = tab(storage, 'a')
    expect(store.status).toEqual({ persistence: 'saved', notice: null })
    await act(store, { type: 'reconcile' }, T0)
    expect(storage.data.has(KEY)).toBe(false)

    const commit = await act(store, { type: 'start', sessionId: 's1', timeZone: 'UTC' }, T0)
    expect(commit.saved).toBe(true)
    expect(stored(storage)).toMatchObject({ revision: 1, writer: 'a', timer: { session: { id: 's1', status: 'running' } } })
  })

  it('restores running and paused sessions after a reload', async () => {
    const storage = new MemoryStorage()
    const first = tab(storage, 'a')
    await act(first, { type: 'start', sessionId: 's1', timeZone: 'UTC' }, T0)
    expect(tab(storage, 'b').snapshot.timer.session).toMatchObject({
      status: 'running', id: 's1', durationMs: 25 * MIN, deadline: T0 + 25 * MIN, timeZone: 'UTC', startedAt: T0, step: null,
    })

    await act(first, { type: 'pause' }, T0 + 5 * MIN)
    expect(tab(storage, 'c').snapshot.timer.session).toMatchObject({
      status: 'paused', id: 's1', durationMs: 25 * MIN, remainingMs: 20 * MIN, timeZone: 'UTC', startedAt: T0, step: null,
    })
  })

  it('credits background expiry once when the app reopens', async () => {
    const storage = new MemoryStorage()
    await act(tab(storage, 'a'), { type: 'start', sessionId: 's1', timeZone: 'UTC' }, T0)
    const reopened = tab(storage, 'b')
    const first = await act(reopened, { type: 'reconcile' }, T0 + 90 * MIN)
    const repeat = await act(reopened, { type: 'reconcile' }, T0 + 91 * MIN)
    expect(first.value?.credited).toBe(true)
    expect(repeat.value).toBeNull()
    expect(stored(storage).records).toHaveLength(1)
    expect(stored(storage).timer).toEqual({ phase: 'shortBreak', session: null, completedFocusCount: 1 })
  })
})

describe('SnapshotStore across tabs', () => {
  it('assigns only one ordinal when two tabs start at once', async () => {
    const storage = new MemoryStorage()
    const lock = sharedLock()
    const a = tab(storage, 'a', lock)
    const b = tab(storage, 'b', lock)
    const results = await Promise.all([
      act(a, { type: 'start', sessionId: 'first', timeZone: 'UTC' }, T0),
      act(b, { type: 'start', sessionId: 'second', timeZone: 'UTC' }, T0),
    ])
    expect(results[0]?.snapshot.timer.session?.scene).toEqual(results[1]?.snapshot.timer.session?.scene)
    expect(stored(storage).scenes.focus.ordinal).toBe(1)
    expect(stored(storage).participations.map(p => p.sessionId)).toEqual(['first'])
  })

  it('atomically records a deadline and unlock, then grants one announcement claim across tabs', async () => {
    const storage = new MemoryStorage()
    const lock = sharedLock()
    const a = tab(storage, 'a', lock)
    const b = tab(storage, 'b', lock)
    await act(a, { type: 'start', sessionId: 'scenes', timeZone: 'UTC', durationMinutes: 5 }, T0)
    const assignment = a.snapshot.timer.session?.scene
    await Promise.all([act(a, { type: 'reconcile' }, T0 + 5 * MIN), act(b, { type: 'reconcile' }, T0 + 5 * MIN)])
    const saved = stored(storage)
    expect(saved.records).toHaveLength(1)
    expect(saved.records[0]?.scene).toEqual(assignment)
    expect(saved.scenes.unlocked).toEqual([{ sceneId: 'F4', unlockedAt: T0 + 5 * MIN, bySessionId: 'scenes', ruleVersion: 1 }])
    const claim = (store: SnapshotStore) => store.transact(latest => {
      const transition = applyAction(latest, { type: 'claimSceneAnnouncement', sceneId: 'F4' }, { now: T0 + 5 * MIN, dateKeyOf: utcKey }, spec)
      return { snapshot: transition.snapshot, changed: transition.changed, value: transition.sceneAnnouncement }
    })
    const claims = await Promise.all([claim(a), claim(b)])
    expect(claims.filter(result => result.saved && result.value === 'F4')).toHaveLength(1)
    expect(stored(storage).scenes.announced).toEqual(['F4'])
    expect((await claim(tab(storage, 'reloaded', lock))).value).toBeUndefined()
  })

  it('retains the provisional assignment after a failed start write and retry', async () => {
    const storage = new MemoryStorage()
    const a = tab(storage, 'a')
    storage.failWrites = true
    const failed = await act(a, { type: 'start', sessionId: 'provisional', timeZone: 'UTC' }, T0)
    expect(failed.saved).toBe(false)
    const assignment = failed.snapshot.timer.session?.scene
    expect(assignment).toBeDefined()
    storage.failWrites = false
    const retried = await act(a, { type: 'start', sessionId: 'provisional', timeZone: 'UTC' }, T0 + 1000)
    expect(retried.saved).toBe(true)
    expect(retried.snapshot.timer.session?.scene).toEqual(assignment)
    expect(retried.snapshot.scenes.focus.ordinal).toBe(1)
    expect(tab(storage, 'reloaded').snapshot.timer.session?.scene).toEqual(assignment)
  })

  it('does not report a failed announcement claim as durable or display it twice', async () => {
    const storage = new MemoryStorage()
    const lock = sharedLock()
    const a = tab(storage, 'a', lock)
    await act(a, { type: 'start', sessionId: 'earned', timeZone: 'UTC', durationMinutes: 5 }, T0)
    await act(a, { type: 'reconcile' }, T0 + 5 * MIN)
    const b = tab(storage, 'b', lock)
    const claim = (store: SnapshotStore) => store.transact(latest => {
      const t = applyAction(latest, { type: 'claimSceneAnnouncement', sceneId: 'F4' }, { now: T0 + 5 * MIN, dateKeyOf: utcKey }, spec)
      return { snapshot: t.snapshot, changed: t.changed, value: t.sceneAnnouncement }
    })
    storage.failWrites = true
    const failed = await claim(a)
    expect(failed.saved).toBe(false)
    expect(failed.error).toContain('QuotaExceededError')
    expect(stored(storage).scenes.announced).toEqual([])
    storage.failWrites = false
    const claimed = await claim(b)
    expect(claimed.saved && claimed.value === 'F4').toBe(true)
    expect((await claim(a)).value).toBeUndefined()
    expect(stored(storage).scenes.announced).toEqual(['F4'])
  })

  it('serializes concurrent reconciles so only one credits the session', async () => {
    const storage = new MemoryStorage()
    const lock = sharedLock()
    const a = tab(storage, 'a', lock)
    const b = tab(storage, 'b', lock)
    await act(a, { type: 'start', sessionId: 's1', timeZone: 'UTC' }, T0)
    // Tab b still holds pre-start memory; both notice the expiry at once.
    const [ra, rb] = await Promise.all([
      act(a, { type: 'reconcile' }, T0 + 25 * MIN),
      act(b, { type: 'reconcile' }, T0 + 25 * MIN),
    ])
    expect([ra.value?.credited, rb.value?.credited]).toEqual([true, undefined])
    expect(stored(storage).records.map((r) => r.sessionId)).toEqual(['s1'])
  })

  it('does not let a stale tab overwrite newer state', async () => {
    const storage = new MemoryStorage()
    const lock = sharedLock()
    const a = tab(storage, 'a', lock)
    const b = tab(storage, 'b', lock)
    await act(a, { type: 'start', sessionId: 's1', timeZone: 'UTC' }, T0)
    await act(a, { type: 'reconcile' }, T0 + 25 * MIN)
    // b never received a's writes, but acts on the latest stored data.
    await act(b, { type: 'skipBreak' }, T0 + 26 * MIN)
    expect(stored(storage).records).toHaveLength(1)
    expect(stored(storage).timer).toEqual({ phase: 'focus', session: null, completedFocusCount: 1 })
  })

  it('repairs a lost update that arrives through a storage event', async () => {
    const storage = new MemoryStorage()
    const lock = sharedLock()
    const a = tab(storage, 'a', lock)
    const b = tab(storage, 'b', lock)
    await act(a, { type: 'start', sessionId: 's1', timeZone: 'UTC' }, T0)
    const bStart = b.receive(storage.data.get(KEY) ?? null)
    expect(bStart?.snapshot.timer.session?.id).toBe('s1')

    // a credits s1; then a stale write lacking it lands, e.g. from a slow cross-process propagation.
    await act(a, { type: 'reconcile' }, T0 + 25 * MIN)
    const stale = { ...bStart!.snapshot, revision: 5, writer: 'b', timer: { ...bStart!.snapshot.timer, session: null } }
    storage.data.set(KEY, encodeSnapshot(stale))

    const seen = a.receive(storage.data.get(KEY) ?? null)
    expect(seen?.needsHeal).toBe(true)
    await a.transact((latest) => ({ snapshot: latest, changed: false, value: null }))
    expect(stored(storage).records.map((r) => r.sessionId)).toEqual(['s1'])
  })

  it('shows saved data read-only when the Web Locks API is missing', async () => {
    expect(createLock('x', null)).toBeNull()
    const storage = new MemoryStorage()
    await act(tab(storage, 'a'), { type: 'start', sessionId: 's1', timeZone: 'UTC' }, T0)
    const before = storage.data.get(KEY)

    const store = tab(storage, 'b', null)
    expect(store.status).toEqual({ persistence: 'read-only', notice: { kind: 'no-locks' } })
    expect(store.snapshot.timer.session?.id).toBe('s1')
    const commit = await act(store, { type: 'end' }, T0 + MIN)
    expect(commit.saved).toBe(false)
    expect(storage.data.get(KEY)).toBe(before)
  })
})

describe('SnapshotStore recovery', () => {
  it('reports failed writes, keeps progress in memory, and saves it once storage recovers', async () => {
    const storage = new MemoryStorage()
    const store = tab(storage, 'a')
    storage.failWrites = true
    const failed = await act(store, { type: 'start', sessionId: 's1', timeZone: 'UTC' }, T0)
    expect(failed.saved).toBe(false)
    expect(failed.error).toMatch(/QuotaExceededError/)
    expect(store.snapshot.timer.session?.id).toBe('s1')

    storage.failWrites = false
    const retried = await act(store, { type: 'reconcile' }, T0 + MIN)
    expect(retried.saved).toBe(true)
    expect(stored(storage).timer.session?.id).toBe('s1')
  })

  it('backs up unreadable data before replacing it', async () => {
    const storage = new MemoryStorage()
    storage.data.set(KEY, '{"version": 2, broken')
    const store = tab(storage, 'a')
    expect(store.status.notice).toMatchObject({ kind: 'unreadable', backupKey: `${KEY}:backup:${T0}` })
    expect(storage.data.get(`${KEY}:backup:${T0}`)).toBe('{"version": 2, broken')

    await act(store, { type: 'start', sessionId: 's1', timeZone: 'UTC' }, T0)
    expect(stored(storage).timer.session?.id).toBe('s1')
    expect([...storage.data.keys()].filter((k) => k.includes('backup'))).toHaveLength(1)
  })

  it('leaves unreadable data untouched when no backup can be made', async () => {
    const storage = new MemoryStorage()
    storage.data.set(KEY, 'garbage')
    storage.failWrites = true
    const store = tab(storage, 'a')
    storage.failWrites = false
    expect(store.status).toMatchObject({ persistence: 'memory-only', notice: { kind: 'unreadable', backupKey: null } })
    await act(store, { type: 'start', sessionId: 's1', timeZone: 'UTC' }, T0)
    expect(storage.data.get(KEY)).toBe('garbage')
  })

  it('stops writing when data turns unreadable mid-session and cannot be backed up', async () => {
    const storage = new MemoryStorage()
    const store = tab(storage, 'a')
    await act(store, { type: 'start', sessionId: 's1', timeZone: 'UTC' }, T0)
    storage.data.set(KEY, 'corrupted by something else')
    storage.failWrites = true
    const commit = await act(store, { type: 'pause' }, T0 + MIN)
    storage.failWrites = false

    expect(commit.saved).toBe(false)
    expect(store.status).toMatchObject({ persistence: 'memory-only', notice: { kind: 'unreadable', backupKey: null } })
    await act(store, { type: 'resume' }, T0 + 2 * MIN)
    expect(storage.data.get(KEY)).toBe('corrupted by something else')
  })

  it('restores a running timer saved before session time zones were recorded', () => {
    const storage = new MemoryStorage()
    const v1 = {
      version: 1, revision: 4, writer: 'old',
      settings: { durationsMinutes: { focus: 25, shortBreak: 5, longBreak: 15 }, soundEnabled: true },
      timer: { phase: 'focus', completedFocusCount: 0, session: { status: 'running', id: 's1', durationMs: 25 * MIN, deadline: T0 + 25 * MIN } },
      completions: [],
    }
    storage.data.set(KEY, JSON.stringify(v1))
    const store = tab(storage, 'a')
    expect(store.status).toEqual({ persistence: 'saved', notice: null })
    expect(store.snapshot.timer.session).toMatchObject({
      status: 'running', id: 's1', durationMs: 25 * MIN, deadline: T0 + 25 * MIN, timeZone: 'Europe/Berlin', startedAt: null, step: null,
    })
  })

  it('repairs partially invalid data and keeps the original as a backup', () => {
    const storage = new MemoryStorage()
    const raw = { version: 2, revision: 3, writer: 'x', settings: { durationsMinutes: { focus: 30, shortBreak: 5, longBreak: 15 }, soundEnabled: 'yes' }, timer: { phase: 'focus', session: null, completedFocusCount: 0 }, completions: [] }
    storage.data.set(KEY, JSON.stringify(raw))
    const store = tab(storage, 'a')
    expect(store.snapshot.settings).toEqual({ durationsMinutes: { focus: 30, shortBreak: 5, longBreak: 15 }, soundEnabled: true, motionEnabled: true, encouragementEnabled: true, sceneVarietyEnabled: true })
    expect(store.status.notice).toEqual({ kind: 'repaired', fields: ['settings.soundEnabled'], backupKey: `${KEY}:backup:${T0}` })
  })

  it('never overwrites data from a newer app version', async () => {
    const storage = new MemoryStorage()
    storage.data.set(KEY, '{"version": 99, "future": true}')
    const store = tab(storage, 'a')
    expect(store.status).toEqual({ persistence: 'read-only', notice: { kind: 'newer', version: 99 } })
    const commit = await act(store, { type: 'start', sessionId: 's1', timeZone: 'UTC' }, T0)
    expect(commit.saved).toBe(false)
    expect(storage.data.get(KEY)).toBe('{"version": 99, "future": true}')
  })

  it('runs in memory when storage is blocked', async () => {
    const storage = new MemoryStorage()
    storage.failReads = true
    const store = tab(storage, 'a')
    expect(store.status).toEqual({ persistence: 'memory-only', notice: { kind: 'unavailable' } })
    expect((await act(store, { type: 'start', sessionId: 's1', timeZone: 'UTC' }, T0)).saved).toBe(false)
    expect(tab(null, 'b').status.persistence).toBe('memory-only')
  })
})

describe('durable early ends and recovery', () => {
  it('recovers a running deadline without needing any unload event', async () => {
    const storage = new MemoryStorage()
    const original = tab(storage, 'a')
    await act(original, { type: 'start', sessionId: 's1', timeZone: 'UTC' }, T0)
    const bytes = storage.data.get(KEY)
    const recovered = tab(storage, 'b')
    await act(recovered, { type: 'reconcile' }, T0 + 10 * MIN)
    expect(recovered.snapshot.timer.session).toMatchObject({ id: 's1', deadline: T0 + 25 * MIN })
    expect(recovered.snapshot.participations).toHaveLength(1)
    expect(recovered.snapshot.records).toHaveLength(0)
    expect(storage.data.get(KEY)).toBe(bytes)
  })
  it('keeps a pause through a long absence, then records only the running time', async () => {
    const storage = new MemoryStorage()
    const original = tab(storage, 'a')
    await act(original, { type: 'start', sessionId: 's1', timeZone: 'UTC' }, T0)
    await act(original, { type: 'pause', sessionId: 's1' }, T0 + 8 * MIN)
    const recovered = tab(storage, 'b')
    await act(recovered, { type: 'reconcile' }, T0 + 1000 * MIN)
    expect(recovered.snapshot.timer.session?.status).toBe('paused')
    await act(recovered, { type: 'resume', sessionId: 's1' }, T0 + 1000 * MIN)
    await act(recovered, { type: 'end', sessionId: 's1' }, T0 + 1002 * MIN)
    expect(tab(storage, 'c').snapshot.records[0]?.elapsedMs).toBe(10 * MIN)
  })
  it('records a zero-duration early end durably', async () => {
    const storage = new MemoryStorage()
    const a = tab(storage, 'a')
    await act(a, { type: 'start', sessionId: 'zero', timeZone: 'UTC' }, T0)
    await act(a, { type: 'end', sessionId: 'zero' }, T0)
    expect(tab(storage, 'reloaded').snapshot.records[0]).toMatchObject({ sessionId: 'zero', elapsedMs: 0, endReason: 'manual' })
  })
  it('retries a failed early-end save using the same ID and original elapsed time', async () => {
    const storage = new MemoryStorage()
    const a = tab(storage, 'a')
    await act(a, { type: 'start', sessionId: 's1', timeZone: 'UTC' }, T0)
    storage.failWrites = true
    const failed = await act(a, { type: 'end', sessionId: 's1' }, T0 + 1000)
    expect(failed.saved).toBe(false)
    expect(a.snapshot.records[0]?.elapsedMs).toBe(1000)
    storage.failWrites = false
    const retry = await act(a, { type: 'reconcile' }, T0 + 30 * MIN)
    expect(retry.saved).toBe(true)
    expect(tab(storage, 'b').snapshot.records).toHaveLength(1)
    expect(stored(storage).records[0]?.elapsedMs).toBe(1000)
    expect(stored(storage).timer.completedFocusCount).toBe(0)
  })
  it('serializes simultaneous early ends in two tabs without duplicate entries', async () => {
    const storage = new MemoryStorage()
    const lock = sharedLock()
    const a = tab(storage, 'a', lock)
    const b = tab(storage, 'b', lock)
    await act(a, { type: 'start', sessionId: 's1', timeZone: 'UTC' }, T0)
    await Promise.all([
      act(a, { type: 'end', sessionId: 's1' }, T0 + 20_000),
      act(b, { type: 'end', sessionId: 's1' }, T0 + 20_000),
    ])
    expect(stored(storage).records).toHaveLength(1)
    expect(stored(storage).participations).toHaveLength(1)
    expect(stored(storage).records[0]?.elapsedMs).toBe(20_000)
  })
  it('keeps a concurrent field patch while another tab ends', async () => {
    const storage = new MemoryStorage()
    const lock = sharedLock()
    const a = tab(storage, 'a', lock)
    const b = tab(storage, 'b', lock)
    await act(a, { type: 'start', sessionId: 's1', timeZone: 'UTC' }, T0)
    await Promise.all([
      act(a, { type: 'end', sessionId: 's1' }, T0 + 20_000),
      act(b, { type: 'updateSettings', patch: { soundEnabled: false } }, T0 + 20_000),
    ])
    expect(stored(storage).records).toHaveLength(1)
    expect(stored(storage).settings.soundEnabled).toBe(false)
  })
  it('does not write over unknown data when reading the latest snapshot fails', async () => {
    const storage = new MemoryStorage()
    const a = tab(storage, 'a')
    await act(a, { type: 'start', sessionId: 's1', timeZone: 'UTC' }, T0)
    const bytes = storage.data.get(KEY)
    storage.failReads = true
    const failed = await act(a, { type: 'end', sessionId: 's1' }, T0 + 1000)
    expect(failed.saved).toBe(false)
    expect(storage.data.get(KEY)).toBe(bytes)
    storage.failReads = false
    await act(a, { type: 'reconcile' }, T0 + 2000)
    expect(stored(storage).records[0]?.elapsedMs).toBe(1000)
  })
  it('persists an upgrade even when reopening has no timer transition to perform', async () => {
    const storage = new MemoryStorage()
    storage.data.set(KEY, JSON.stringify({ version: 2, revision: 5, writer: 'legacy',
      settings: { durationsMinutes: { focus: 25, shortBreak: 5, longBreak: 15 }, soundEnabled: false },
      timer: { phase: 'focus', session: null, completedFocusCount: 0 }, completions: [],
    }))
    const upgraded = tab(storage, 'new')
    await act(upgraded, { type: 'reconcile' }, T0)
    expect(stored(storage).version).toBe(5)
    expect(stored(storage).settings.soundEnabled).toBe(false)
  })
  it('prevents a stale tab from reviving older-generation data on its next action', async () => {
    const storage = new MemoryStorage()
    const a = tab(storage, 'stale')
    await act(a, { type: 'start', sessionId: 'old', timeZone: 'UTC' }, T0)
    const replaced: AppSnapshot = { ...a.snapshot, datasetGeneration: 1, revision: 2,
      timer: { phase: 'focus', session: null, completedFocusCount: 0 }, records: [], participations: [],
    }
    storage.data.set(KEY, encodeSnapshot(replaced))
    await act(a, { type: 'end', sessionId: 'old' }, T0 + MIN)
    expect(stored(storage).records).toEqual([])
    expect(a.snapshot.timer.session).toBeNull()
    expect(a.snapshot.participations).toEqual([])
  })
})

it('protects partially corrupted raw data that appears after a tab was opened', async () => {
  const storage = new MemoryStorage()
  const a = tab(storage, 'a')
  await act(a, { type: 'start', sessionId: 's1', timeZone: 'UTC' }, T0)
  const corrupt = JSON.stringify({ ...stored(storage), settings: { ...stored(storage).settings, soundEnabled: 'bad' } })
  storage.data.set(KEY, corrupt)
  await act(a, { type: 'pause', sessionId: 's1' }, T0 + MIN)
  expect(storage.data.get(`${KEY}:backup:${T0}`)).toBe(corrupt)
  expect(a.status.notice?.kind).toBe('repaired')
})
