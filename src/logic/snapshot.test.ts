import { describe, expect, it } from 'vitest'
import { spec } from '../data/spec'
import { createSnapshot, decodeSnapshot, encodeSnapshot, hasMissingRecords, mergeSnapshots, runMigrations, type Migration } from './snapshot'
import type { AppSnapshot, FocusRecord } from './types'

const ctx = { timeZone: 'Asia/Tokyo' }
const record = (sessionId: string, endedAt = 1000): FocusRecord => ({
  sessionId, endedAt, dateKey: '2026-10-28', elapsedMs: 1_500_000,
  targetMs: 1_500_000, startedAt: null, endReason: 'deadline', source: 'legacy', step: null,
})
function sample(): AppSnapshot {
  return { ...createSnapshot(spec), revision: 7, writer: 'tab-a',
    timer: { phase: 'focus', session: { status: 'paused', id: 's2', durationMs: 1_500_000, remainingMs: 600_000, timeZone: 'Europe/Berlin', startedAt: null, step: null }, completedFocusCount: 1 },
    records: [record('s1')], participations: [
      { sessionId: 's1', participatedAt: null, dateKey: '2026-10-28', source: 'legacy-completion' },
      { sessionId: 's2', participatedAt: null, dateKey: null, source: 'legacy-active' },
    ],
  }
}
/** A v3 snapshot as the previous app version wrote it. */
function v3(): Record<string, unknown> {
  const { lastFocusMinutes: _l, thoughts: _t, thoughtDraft: _d, ...rest } = sample()
  const { step: _s, ...session } = rest.timer.session!
  return { ...rest, version: 3, timer: { ...rest.timer, session }, records: rest.records.map(({ step: _, ...r }) => r) }
}
function legacy(version: number) {
  const { motionEnabled: _, encouragementEnabled: __, ...settings } = createSnapshot(spec).settings
  return { version, revision: 4, writer: 'old', settings,
    timer: { phase: 'focus', completedFocusCount: 1, session: { status: 'paused', id: 's2', durationMs: 1_500_000, remainingMs: 600_000, ...(version === 2 ? { timeZone: 'Europe/Berlin' } : {}) } },
    completions: [{ sessionId: 's1', completedAt: 5000, dateKey: '2026-10-28', focusMs: 1_500_000 }],
  }
}

describe('snapshot v5 and migration', () => {
  it('round-trips without replacing valid fields', () => {
    const s = sample()
    expect(decodeSnapshot(encodeSnapshot(s), spec, ctx)).toEqual({ kind: 'ok', snapshot: s, issues: [] })
  })
  it('upgrades a v3 snapshot without new preferences, steps or thoughts and preserves its session/history', () => {
    const before = sample()
    const old = v3()
    const { motionEnabled: _, encouragementEnabled: __, ...oldSettings } = before.settings
    const decoded = decodeSnapshot(JSON.stringify({ ...old, settings: oldSettings }), spec, ctx)
    if (decoded.kind !== 'ok') throw Error(decoded.kind)
    expect(decoded.issues).toEqual([])
    expect({ ...decoded.snapshot, scenes: before.scenes, timer: before.timer }).toEqual(before)
    expect(decoded.snapshot.timer).toMatchObject(before.timer)
    expect(decoded.snapshot.timer.session?.scene).toEqual({ sceneId: 'F4', ordinal: 1, selectionVersion: 1 })
    expect(decoded.snapshot.scenes.unlocked).toEqual([{ sceneId: 'F4', unlockedAt: 1000, bySessionId: 's1', ruleVersion: 1 }])
    expect(decoded.snapshot.scenes.announced).toEqual(['F4'])
    const quiet = { ...before, settings: { ...before.settings, motionEnabled: false } }
    expect(decodeSnapshot(encodeSnapshot(quiet), spec, ctx)).toEqual({ kind: 'ok', snapshot: quiet, issues: [] })
  })
  it.each([1, 2])('migrates v%s totals, dates, IDs and paused state without inventing starts', (version) => {
    const decoded = decodeSnapshot(JSON.stringify(legacy(version)), spec, ctx)
    if (decoded.kind !== 'ok') throw Error(decoded.kind)
    expect(decoded.issues).toEqual([])
    expect(decoded.snapshot.version).toBe(5)
    expect(decoded.snapshot.records).toEqual([{ ...record('s1', 5000) }])
    expect(decoded.snapshot.participations).toEqual(sample().participations)
    expect(decoded.snapshot.timer.session).toMatchObject({ status: 'paused', remainingMs: 600_000, startedAt: null, timeZone: version === 1 ? 'Asia/Tokyo' : 'Europe/Berlin' })
    expect(decodeSnapshot(encodeSnapshot(decoded.snapshot), spec, ctx)).toEqual(decoded)
  })
  it('keeps valid legacy records and reports corrupt entries for raw-data protection', () => {
    const old = legacy(2)
    const decoded = decodeSnapshot(JSON.stringify({ ...old, completions: [...old.completions, old.completions[0], { sessionId: 'bad' }] }), spec, ctx)
    if (decoded.kind !== 'ok') throw Error(decoded.kind)
    expect(decoded.snapshot.records).toHaveLength(1)
    expect(decoded.snapshot.participations).toHaveLength(2)
    expect(decoded.issues).toContain('records (2 unreadable)')
  })
  it('accepts zero manual effort and rejects inconsistent full or negative records', () => {
    const s = sample()
    const zero = { ...record('zero'), elapsedMs: 0, endReason: 'manual' as const }
    const d = decodeSnapshot(encodeSnapshot({ ...s, records: [zero, { ...record('bad'), elapsedMs: -1 }, { ...record('incomplete'), elapsedMs: 10 }] }), spec, ctx)
    if (d.kind !== 'ok') throw Error(d.kind)
    expect(d.snapshot.records).toEqual([zero])
    expect(d.issues).toContain('records (2 unreadable)')
  })
  it('refuses unversioned/newer data and invalid generations', () => {
    expect(decodeSnapshot('{bad', spec, ctx).kind).toBe('unreadable')
    expect(decodeSnapshot('{}', spec, ctx).kind).toBe('unreadable')
    expect(decodeSnapshot('{"version":99}', spec, ctx)).toEqual({ kind: 'newer', version: 99 })
    expect(decodeSnapshot(JSON.stringify({ ...sample(), datasetGeneration: -1 }), spec, ctx).kind).toBe('unreadable')
  })
  it('repairs individual fields while preserving readable history', () => {
    const d = decodeSnapshot(JSON.stringify({ ...sample(), settings: { durationsMinutes: { focus: 0, shortBreak: 7, longBreak: 'x' }, soundEnabled: false }, timer: { phase: 'nap', session: {}, completedFocusCount: 3 } }), spec, ctx)
    if (d.kind !== 'ok') throw Error(d.kind)
    expect(d.snapshot.records).toEqual(sample().records)
    expect(d.snapshot.settings.durationsMinutes).toEqual({ focus: 25, shortBreak: 7, longBreak: 15 })
    expect(d.snapshot.timer).toEqual({ phase: 'focus', session: null, completedFocusCount: 3 })
    expect(d.issues).toEqual(['settings.durationsMinutes.focus', 'settings.durationsMinutes.longBreak', 'timer.phase', 'timer.session'])
  })
  it('chains migrations and detects missing steps', () => {
    const steps: Record<number, Migration> = {
      1: (old) => ({ ...old, version: 2, log: ['1→2'] }),
      2: (old) => ({ ...old, version: 3, log: [...(old.log as string[]), '2→3'] }),
    }
    expect(runMigrations({ version: 1 }, 1, 3, steps, ctx)).toEqual({ version: 3, log: ['1→2', '2→3'] })
    expect(runMigrations({ version: 1 }, 1, 4, steps, ctx)).toBeNull()
  })
})

describe('concurrent snapshots', () => {
  it('uses the newer timer/settings, unions stable records, and deduplicates participation', () => {
    const a = { ...sample(), revision: 8, records: [record('s1'), record('s2', 3000)] }
    const b = { ...sample(), revision: 9, writer: 'b', records: [record('s1'), record('s4', 2000)] }
    const merged = mergeSnapshots(a, b)
    expect(merged.records.map((r) => r.sessionId)).toEqual(['s1', 's4', 's2'])
    expect(merged.participations).toHaveLength(2)
    expect(merged.timer.completedFocusCount).toBe(3)
    expect(mergeSnapshots(b, a)).toEqual(merged)
    expect(hasMissingRecords(b, a)).toBe(true)
    expect(hasMissingRecords(merged, a)).toBe(false)
  })
  it('heals a missing start participation even before the session ends', () => {
    const a = { ...sample(), participations: [] }
    expect(hasMissingRecords(a, sample())).toBe(true)
    expect(mergeSnapshots(a, sample()).participations).toHaveLength(2)
  })
  it('never unions older-generation records, timers or participation into a replacement', () => {
    const stale = { ...sample(), revision: 1000 }
    const cleared = { ...createSnapshot(spec), datasetGeneration: 1 }
    expect(mergeSnapshots(stale, cleared)).toEqual(cleared)
    expect(mergeSnapshots(cleared, stale)).toEqual(cleared)
    expect(hasMissingRecords(cleared, stale)).toBe(false)
  })
  it('breaks revision ties deterministically', () => {
    const a = { ...sample(), writer: 'a' }
    const b = { ...sample(), writer: 'b' }
    expect(mergeSnapshots(a, b).writer).toBe('b')
    expect(mergeSnapshots(b, a).writer).toBe('b')
  })
})
