import { describe, expect, it } from 'vitest'
import { spec } from '../data/spec'
import { applyAction, reconcile, shouldChime, type ActionContext, type AppAction } from './app'
import { createSnapshot } from './snapshot'
import { remainingMs } from './timer'
import type { AppSnapshot } from './types'

const MIN = 60_000
const T0 = Date.UTC(2026, 9, 28, 9, 0, 0)
const utcKey = (ms: number) => new Date(ms).toISOString().slice(0, 10)
const ctx = (now: number): ActionContext => ({ now, dateKeyOf: utcKey })

function run(snapshot: AppSnapshot, steps: [number, AppAction][]): AppSnapshot {
  return steps.reduce((s, [now, action]) => applyAction(s, action, ctx(now), spec).snapshot, snapshot)
}

/** Runs one focus session to completion starting at `now`; returns the snapshot after expiry. */
function completeFocus(s: AppSnapshot, now: number, id: string): AppSnapshot {
  const started = applyAction(s, { type: 'start', sessionId: id, timeZone: 'UTC' }, ctx(now), spec).snapshot
  const session = started.timer.session
  if (session?.status !== 'running') throw new Error('expected running session')
  return reconcile(started, ctx(session.deadline), spec).snapshot
}

describe('timer actions', () => {
  it('uses the configured defaults', () => {
    const s = createSnapshot(spec)
    expect(s.settings.durationsMinutes).toEqual({ focus: 25, shortBreak: 5, longBreak: 15 })
    expect(remainingMs(s.timer, s.settings, T0)).toBe(25 * MIN)
  })

  it('captures the duration at start so settings changes only affect later sessions', () => {
    let s = run(createSnapshot(spec), [[T0, { type: 'start', sessionId: 'a', timeZone: 'UTC' }]])
    s = run(s, [[T0 + MIN, { type: 'updateSettings', patch: { durationsMinutes: { focus: 50 } } }]])
    expect(s.timer.session).toMatchObject({ status: 'running', durationMs: 25 * MIN, deadline: T0 + 25 * MIN })
    expect(remainingMs(s.timer, s.settings, T0 + MIN)).toBe(24 * MIN)

    s = reconcile(s, ctx(T0 + 25 * MIN), spec).snapshot
    expect(s.records[0]?.elapsedMs).toBe(25 * MIN)
    s = run(s, [[T0 + 25 * MIN, { type: 'skipBreak' }]])
    expect(remainingMs(s.timer, s.settings, T0 + 26 * MIN)).toBe(50 * MIN)
  })

  it('excludes paused time from the countdown and from credit', () => {
    let s = run(createSnapshot(spec), [
      [T0, { type: 'start', sessionId: 'a', timeZone: 'UTC' }],
      [T0 + 10 * MIN, { type: 'pause' }],
    ])
    expect(s.timer.session).toMatchObject({ status: 'paused', remainingMs: 15 * MIN })
    // A paused session never expires, however long it waits.
    s = reconcile(s, ctx(T0 + 600 * MIN), spec).snapshot
    expect(s.timer.session?.status).toBe('paused')

    s = run(s, [[T0 + 600 * MIN, { type: 'resume' }]])
    expect(s.timer.session).toMatchObject({ status: 'running', deadline: T0 + 615 * MIN })
    s = reconcile(s, ctx(T0 + 615 * MIN), spec).snapshot
    expect(s.records).toMatchObject([
      { sessionId: 'a', endedAt: T0 + 615 * MIN, dateKey: utcKey(T0 + 615 * MIN), elapsedMs: 25 * MIN },
    ])
  })

  it('ignores start while a session exists, so a double tap keeps the first session', () => {
    const s = run(createSnapshot(spec), [
      [T0, { type: 'start', sessionId: 'a', timeZone: 'UTC' }],
      [T0 + 1000, { type: 'start', sessionId: 'b', timeZone: 'UTC' }],
    ])
    expect(s.timer.session).toMatchObject({ id: 'a', deadline: T0 + 25 * MIN })
  })
})

describe('settings updates', () => {
  it('applies field patches to the latest settings so quick edits do not undo each other', () => {
    const s = run(createSnapshot(spec), [
      [T0, { type: 'updateSettings', patch: { durationsMinutes: { focus: 30 } } }],
      [T0, { type: 'updateSettings', patch: { durationsMinutes: { shortBreak: 6 } } }],
      [T0, { type: 'updateSettings', patch: { soundEnabled: false } }],
    ])
    expect(s.settings).toEqual({ durationsMinutes: { focus: 30, shortBreak: 6, longBreak: 15 }, soundEnabled: false, motionEnabled: true, encouragementEnabled: true, sceneVarietyEnabled: true })
  })

  it('ignores out-of-range values', () => {
    const s = run(createSnapshot(spec), [[T0, { type: 'updateSettings', patch: { durationsMinutes: { focus: 500, longBreak: 0 } } }]])
    expect(s.settings.durationsMinutes).toEqual({ focus: 25, shortBreak: 5, longBreak: 15 })
  })
})

describe('completion accounting', () => {
  it('credits an expired focus session exactly once and readies the break without starting it', () => {
    const started = run(createSnapshot(spec), [[T0, { type: 'start', sessionId: 'a', timeZone: 'UTC' }]])
    const first = reconcile(started, ctx(T0 + 25 * MIN + 5), spec)
    expect(first.completion).toEqual({ sessionId: 'a', phase: 'focus', deadline: T0 + 25 * MIN, credited: true })
    expect(first.snapshot.timer).toEqual({ phase: 'shortBreak', session: null, completedFocusCount: 1 })

    const again = reconcile(first.snapshot, ctx(T0 + 26 * MIN), spec)
    expect(again.changed).toBe(false)
    expect(again.snapshot.records).toHaveLength(1)
  })

  it('does not credit a session id that is already recorded', () => {
    const started = run(createSnapshot(spec), [[T0, { type: 'start', sessionId: 'a', timeZone: 'UTC' }]])
    const withRecord: AppSnapshot = {
      ...started,
      records: [{ sessionId: 'a', startedAt: T0, endedAt: T0 + 25 * MIN, dateKey: utcKey(T0), elapsedMs: 25 * MIN, targetMs: 25 * MIN, endReason: 'deadline', source: 'native', step: null }],
    }
    const result = reconcile(withRecord, ctx(T0 + 30 * MIN), spec)
    expect(result.completion).toBeNull()
    expect(result.snapshot.records).toHaveLength(1)
    expect(result.snapshot.timer.phase).toBe('shortBreak')
  })

  it('completes only one session after a long absence', () => {
    const started = run(createSnapshot(spec), [[T0, { type: 'start', sessionId: 'a', timeZone: 'UTC' }]])
    const later = reconcile(started, ctx(T0 + 3 * 24 * 60 * MIN), spec).snapshot
    expect(later.records).toHaveLength(1)
    expect(later.timer).toEqual({ phase: 'shortBreak', session: null, completedFocusCount: 1 })
  })

  it('attributes the completion to the deadline date, not the reopening date', () => {
    const lateStart = Date.UTC(2026, 9, 28, 23, 50)
    const started = run(createSnapshot(spec), [[lateStart, { type: 'start', sessionId: 'a', timeZone: 'UTC' }]])
    const reopened = reconcile(started, ctx(Date.UTC(2026, 9, 31, 8, 0)), spec).snapshot
    expect(reopened.records[0]).toMatchObject({ endedAt: lateStart + 25 * MIN, dateKey: '2026-10-29' })
  })

  it('ending early records actual effort and keeps full-completion cadence', () => {
    let s = completeFocus(createSnapshot(spec), T0, 'a')
    s = run(s, [
      [T0 + 25 * MIN, { type: 'skipBreak' }],
      [T0 + 26 * MIN, { type: 'start', sessionId: 'b', timeZone: 'UTC' }],
      [T0 + 40 * MIN, { type: 'end' }],
    ])
    expect(s.records.map((r) => r.sessionId)).toEqual(['a', 'b'])
    expect(s.records[1]).toMatchObject({ elapsedMs: 14 * MIN, endReason: 'manual' })
    expect(s.timer).toEqual({ phase: 'focus', session: null, completedFocusCount: 1 })
  })

  it('ending after expiry keeps the full completion', () => {
    const started = run(createSnapshot(spec), [[T0, { type: 'start', sessionId: 'a', timeZone: 'UTC' }]])
    const result = applyAction(started, { type: 'end' }, ctx(T0 + 25 * MIN), spec)
    expect(result.completion?.credited).toBe(true)
    expect(result.snapshot.records).toHaveLength(1)
    expect(result.snapshot.timer).toEqual({ phase: 'shortBreak', session: null, completedFocusCount: 1 })
  })

  it('pause after expiry completes the session instead of pausing it', () => {
    const started = run(createSnapshot(spec), [[T0, { type: 'start', sessionId: 'a', timeZone: 'UTC' }]])
    const s = run(started, [[T0 + 30 * MIN, { type: 'pause' }]])
    expect(s.timer.session).toBeNull()
    expect(s.records).toHaveLength(1)
  })

  it('breaks earn no credit', () => {
    let s = completeFocus(createSnapshot(spec), T0, 'a')
    s = run(s, [[T0 + 25 * MIN, { type: 'start', sessionId: 'break', timeZone: 'UTC' }]])
    const result = reconcile(s, ctx(T0 + 30 * MIN), spec)
    expect(result.completion).toMatchObject({ phase: 'shortBreak', credited: false })
    expect(result.snapshot.records).toHaveLength(1)
    expect(result.snapshot.timer.phase).toBe('focus')
  })
})

describe('long-break cadence', () => {
  it('takes a long break after every fourth completed focus session', () => {
    let s = createSnapshot(spec)
    let now = T0
    const breaks: string[] = []
    for (let i = 1; i <= 8; i += 1) {
      s = completeFocus(s, now, `f${i}`)
      now += 25 * MIN
      breaks.push(s.timer.phase)
      const started = applyAction(s, { type: 'start', sessionId: `b${i}`, timeZone: 'UTC' }, ctx(now), spec).snapshot
      const session = started.timer.session
      expect(session?.durationMs).toBe((s.timer.phase === 'longBreak' ? 15 : 5) * MIN)
      now = session?.status === 'running' ? session.deadline : now
      s = reconcile(started, ctx(now), spec).snapshot
    }
    expect(breaks).toEqual([
      'shortBreak', 'shortBreak', 'shortBreak', 'longBreak',
      'shortBreak', 'shortBreak', 'shortBreak', 'longBreak',
    ])
  })

  it('keeps the cadence when breaks are skipped or sessions ended early', () => {
    let s = createSnapshot(spec)
    for (let i = 1; i <= 3; i += 1) {
      s = completeFocus(s, T0 + i * 60 * MIN, `f${i}`)
      s = run(s, [[T0 + i * 60 * MIN + 25 * MIN, { type: 'skipBreak' }]])
    }
    s = run(s, [
      [T0 + 300 * MIN, { type: 'start', sessionId: 'x', timeZone: 'UTC' }],
      [T0 + 301 * MIN, { type: 'end' }],
    ])
    s = completeFocus(s, T0 + 302 * MIN, 'f4')
    expect(s.timer.phase).toBe('longBreak')
  })
})

describe('time zones and clock changes', () => {
  // Stand-in for the adapter: Tokyo is UTC+9 all year.
  const zoned: ActionContext['dateKeyOf'] = (ms, tz) => utcKey(tz === 'Asia/Tokyo' ? ms + 9 * 60 * MIN : ms)

  it('dates a completion in the zone where the session started, even after travel', () => {
    const start = Date.UTC(2026, 9, 28, 14, 50) // 23:50 in Tokyo
    let s = applyAction(createSnapshot(spec), { type: 'start', sessionId: 'a', timeZone: 'Asia/Tokyo' }, { now: start, dateKeyOf: zoned }, spec).snapshot
    // Reopened later while the device reports another zone; the stored zone still decides.
    s = reconcile(s, { now: start + 60 * MIN, dateKeyOf: zoned }, spec).snapshot
    expect(s.records[0]?.dateKey).toBe('2026-10-29')
  })

  it('keeps the zone through pause and resume', () => {
    const s = run(createSnapshot(spec), [
      [T0, { type: 'start', sessionId: 'a', timeZone: 'Asia/Tokyo' }],
      [T0 + MIN, { type: 'pause' }],
      [T0 + 2 * MIN, { type: 'resume' }],
    ])
    expect(s.timer.session?.timeZone).toBe('Asia/Tokyo')
  })

  it('never shows negative or over-long time when the device clock jumps', () => {
    const s = run(createSnapshot(spec), [[T0, { type: 'start', sessionId: 'a', timeZone: 'UTC' }]])
    expect(remainingMs(s.timer, s.settings, T0 - 600 * MIN)).toBe(25 * MIN)
    expect(remainingMs(s.timer, s.settings, T0 + 600 * MIN)).toBe(0)
    const paused = run(s, [[T0 - 600 * MIN, { type: 'pause' }]])
    expect(paused.timer.session).toMatchObject({ status: 'paused', remainingMs: 25 * MIN })
  })
})

describe('shouldChime', () => {
  const completion = { sessionId: 'a', phase: 'focus' as const, deadline: T0, credited: true }
  it('chimes for a fresh completion when sound is on', () => {
    const settings = createSnapshot(spec).settings
    expect(shouldChime(completion, T0 + 500, settings, spec)).toBe(true)
    expect(shouldChime(completion, T0 + spec.timer.completionSoundWindowMs + 1, settings, spec)).toBe(false)
    expect(shouldChime(completion, T0, { ...settings, soundEnabled: false }, spec)).toBe(false)
  })
})

describe('flexible focus and actual effort', () => {
  it.each([0, 1, 1000, 20_000])('records a manual ending after %s milliseconds, including zero', (elapsed) => {
    const s = run(createSnapshot(spec), [
      [T0, { type: 'start', sessionId: 'short', timeZone: 'UTC', durationMinutes: 5 }],
      [T0 + elapsed, { type: 'end', sessionId: 'short' }],
      [T0 + elapsed, { type: 'end', sessionId: 'short' }],
    ])
    expect(s.records).toHaveLength(1)
    expect(s.records[0]).toMatchObject({ sessionId: 'short', elapsedMs: elapsed, targetMs: 5 * MIN, endReason: 'manual', startedAt: T0 })
    expect(s.participations).toHaveLength(1)
    expect(s.timer.completedFocusCount).toBe(0)
    expect(s.timer.session).toBeNull()
    expect(s.settings.durationsMinutes.focus).toBe(25)
  })
  it('records 8 minutes + pause of 3 minutes + 2 minutes as 10 minutes', () => {
    const s = run(createSnapshot(spec), [
      [T0, { type: 'start', sessionId: 'a', timeZone: 'UTC' }],
      [T0 + 8 * MIN, { type: 'pause', sessionId: 'a' }],
      [T0 + 11 * MIN, { type: 'resume', sessionId: 'a' }],
      [T0 + 13 * MIN, { type: 'end', sessionId: 'a' }],
    ])
    expect(s.records[0]?.elapsedMs).toBe(10 * MIN)
    expect(s.participations).toHaveLength(1)
    expect(s.timer.completedFocusCount).toBe(0)
  })
  it('keeps two 20-second endings as 40 seconds before formatting', () => {
    const s = run(createSnapshot(spec), [
      [T0, { type: 'start', sessionId: 'a', timeZone: 'UTC' }],
      [T0 + 20_000, { type: 'end' }],
      [T0 + 30_000, { type: 'start', sessionId: 'b', timeZone: 'UTC' }],
      [T0 + 50_000, { type: 'end' }],
    ])
    expect(s.records.reduce((sum, r) => sum + r.elapsedMs, 0)).toBe(40_000)
    expect(s.participations).toHaveLength(2)
  })
  it.each([-1, 0, 0.5, 121, Number.NaN])('rejects invalid one-off duration %s without creating participation', (durationMinutes) => {
    const s = run(createSnapshot(spec), [[T0, { type: 'start', sessionId: 'a', timeZone: 'UTC', durationMinutes }]])
    expect(s.timer.session).toBeNull()
    expect(s.participations).toHaveLength(0)
  })
  it('offers rest without any full completion and never counts it as focus', () => {
    const s = run(createSnapshot(spec), [
      [T0, { type: 'startBreak', sessionId: 'rest', timeZone: 'UTC' }],
      [T0 + MIN, { type: 'end', sessionId: 'rest' }],
    ])
    expect(s.records).toEqual([])
    expect(s.participations).toEqual([])
    expect(s.timer).toEqual({ phase: 'focus', session: null, completedFocusCount: 0 })
  })
  it('ignores a stale end or pause aimed at a different session', () => {
    const s = run(createSnapshot(spec), [
      [T0, { type: 'start', sessionId: 'a', timeZone: 'UTC' }],
      [T0 + 1000, { type: 'end', sessionId: 'a' }],
      [T0 + 2000, { type: 'start', sessionId: 'b', timeZone: 'UTC' }],
      [T0 + 3000, { type: 'end', sessionId: 'a' }],
      [T0 + 4000, { type: 'pause', sessionId: 'a' }],
    ])
    expect(s.timer.session).toMatchObject({ id: 'b', status: 'running' })
    expect(s.records.map((r) => r.sessionId)).toEqual(['a'])
  })
  it.each([-1, 0, 1])('settles an end %s milliseconds from the deadline exactly once', (offset) => {
    const s = run(createSnapshot(spec), [
      [T0, { type: 'start', sessionId: 'a', timeZone: 'UTC', durationMinutes: 5 }],
      [T0 + 5 * MIN + offset, { type: 'end', sessionId: 'a' }],
      [T0 + 10 * MIN, { type: 'reconcile' }],
    ])
    expect(s.records).toHaveLength(1)
    expect(s.records[0]?.elapsedMs).toBe(5 * MIN + Math.min(offset, 0))
    expect(s.records[0]?.endReason).toBe(offset < 0 ? 'manual' : 'deadline')
    expect(s.timer.completedFocusCount).toBe(offset < 0 ? 0 : 1)
  })
  it('does not let a stale start button launch the next phase after expiry', () => {
    const s = run(createSnapshot(spec), [
      [T0, { type: 'start', sessionId: 'a', timeZone: 'UTC' }],
      [T0 + 26 * MIN, { type: 'start', sessionId: 'stale', timeZone: 'UTC', expectedPhase: 'focus' }],
    ])
    expect(s.timer.session).toBeNull()
    expect(s.records).toHaveLength(1)
  })
})
