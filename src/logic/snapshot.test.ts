import { describe, expect, it } from 'vitest'
import { spec } from '../data/spec'
import {
  createSnapshot,
  decodeSnapshot,
  encodeSnapshot,
  hasMissingCompletions,
  mergeSnapshots,
  runMigrations,
  type Migration,
} from './snapshot'
import type { AppSnapshot, CompletionRecord } from './types'

const ctx = { timeZone: 'Asia/Tokyo' }

const record = (sessionId: string, completedAt = 1000): CompletionRecord => ({
  sessionId,
  completedAt,
  dateKey: '2026-10-28',
  focusMs: 1_500_000,
})

function sample(): AppSnapshot {
  return {
    ...createSnapshot(spec),
    revision: 7,
    writer: 'tab-a',
    timer: {
      phase: 'focus',
      session: { status: 'paused', id: 's2', durationMs: 1_500_000, remainingMs: 600_000, timeZone: 'Europe/Berlin' },
      completedFocusCount: 1,
    },
    completions: [record('s1')],
  }
}

describe('decodeSnapshot', () => {
  it('round-trips a valid snapshot without issues', () => {
    const s = sample()
    expect(decodeSnapshot(encodeSnapshot(s), spec, ctx)).toEqual({ kind: 'ok', snapshot: s, issues: [] })
  })

  it('reports unparseable or unversioned data as unreadable', () => {
    expect(decodeSnapshot('{not json', spec, ctx).kind).toBe('unreadable')
    expect(decodeSnapshot('[]', spec, ctx).kind).toBe('unreadable')
    expect(decodeSnapshot('{"settings":{}}', spec, ctx).kind).toBe('unreadable')
  })

  it('refuses data written by a newer version', () => {
    expect(decodeSnapshot(JSON.stringify({ ...sample(), version: 99 }), spec, ctx)).toEqual({ kind: 'newer', version: 99 })
  })

  it('repairs invalid fields individually and keeps valid progress', () => {
    const raw = {
      ...sample(),
      settings: { durationsMinutes: { focus: 0, shortBreak: 7, longBreak: 'x' }, soundEnabled: false },
      timer: { phase: 'nap', session: { status: 'running', id: 's2' }, completedFocusCount: 3 },
      completions: [record('s1'), { sessionId: 's9' }, record('s1'), record('s3', 2000)],
    }
    const decoded = decodeSnapshot(JSON.stringify(raw), spec, ctx)
    if (decoded.kind !== 'ok') throw new Error(decoded.kind)
    expect(decoded.snapshot.settings).toEqual({
      durationsMinutes: { focus: 25, shortBreak: 7, longBreak: 15 },
      soundEnabled: false,
    })
    expect(decoded.snapshot.timer).toEqual({ phase: 'focus', session: null, completedFocusCount: 3 })
    expect(decoded.snapshot.completions.map((r) => r.sessionId)).toEqual(['s1', 's3'])
    expect(decoded.issues).toEqual([
      'completions (2 unreadable)',
      'settings.durationsMinutes.focus',
      'settings.durationsMinutes.longBreak',
      'timer.phase',
      'timer.session',
    ])
  })

  it('chains migrations in order and reports a missing step', () => {
    const steps: Record<number, Migration> = {
      1: (old) => ({ ...old, version: 2, log: ['1→2'] }),
      2: (old) => ({ ...old, version: 3, log: [...(old.log as string[]), '2→3'] }),
    }
    expect(runMigrations({ version: 1 }, 1, 3, steps, ctx)).toEqual({ version: 3, log: ['1→2', '2→3'] })
    expect(runMigrations({ version: 1 }, 1, 4, steps, ctx)).toBeNull()
    expect(runMigrations({ version: 3 }, 3, 3, {}, ctx)).toEqual({ version: 3 })
  })

  it('upgrades version 1 sessions by recording the current time zone', () => {
    const v1 = { ...sample(), version: 1, timer: { ...sample().timer, session: { status: 'paused', id: 's2', durationMs: 1_500_000, remainingMs: 600_000 } } }
    const decoded = decodeSnapshot(JSON.stringify(v1), spec, ctx)
    if (decoded.kind !== 'ok') throw new Error(decoded.kind)
    expect(decoded.issues).toEqual([])
    expect(decoded.snapshot.version).toBe(2)
    expect(decoded.snapshot.timer.session).toEqual({ status: 'paused', id: 's2', durationMs: 1_500_000, remainingMs: 600_000, timeZone: 'Asia/Tokyo' })
  })
})

describe('mergeSnapshots', () => {
  it('takes timer and settings from the newer revision and unions completions', () => {
    const a: AppSnapshot = { ...sample(), revision: 8, writer: 'tab-a', completions: [record('s1'), record('s2', 3000)] }
    const b: AppSnapshot = {
      ...sample(),
      revision: 9,
      writer: 'tab-b',
      timer: { phase: 'shortBreak', session: null, completedFocusCount: 2 },
      completions: [record('s1'), record('s4', 2000)],
    }
    const merged = mergeSnapshots(a, b)
    expect(merged.revision).toBe(9)
    expect(merged.timer).toEqual(b.timer)
    expect(merged.completions.map((r) => r.sessionId)).toEqual(['s1', 's4', 's2'])
    expect(mergeSnapshots(b, a)).toEqual(merged)
  })

  it('breaks revision ties deterministically', () => {
    const a: AppSnapshot = { ...sample(), writer: 'tab-a' }
    const b: AppSnapshot = { ...sample(), writer: 'tab-b', timer: { ...sample().timer, phase: 'longBreak' } }
    expect(mergeSnapshots(a, b).writer).toBe('tab-b')
    expect(mergeSnapshots(b, a).writer).toBe('tab-b')
  })

  it('detects completion records missing from another view', () => {
    const a = sample()
    const b: AppSnapshot = { ...a, completions: [...a.completions, record('s5')] }
    expect(hasMissingCompletions(a, b)).toBe(true)
    expect(hasMissingCompletions(b, a)).toBe(false)
  })
})
