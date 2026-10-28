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
    expect(s.completions[0]?.focusMs).toBe(25 * MIN)
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
    expect(s.completions).toEqual([
      { sessionId: 'a', completedAt: T0 + 615 * MIN, dateKey: utcKey(T0 + 615 * MIN), focusMs: 25 * MIN },
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
    expect(s.settings).toEqual({ durationsMinutes: { focus: 30, shortBreak: 6, longBreak: 15 }, soundEnabled: false })
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
    expect(again.snapshot.completions).toHaveLength(1)
  })

  it('does not credit a session id that is already recorded', () => {
    const started = run(createSnapshot(spec), [[T0, { type: 'start', sessionId: 'a', timeZone: 'UTC' }]])
    const withRecord: AppSnapshot = {
      ...started,
      completions: [{ sessionId: 'a', completedAt: T0 + 25 * MIN, dateKey: utcKey(T0), focusMs: 25 * MIN }],
    }
    const result = reconcile(withRecord, ctx(T0 + 30 * MIN), spec)
    expect(result.completion?.credited).toBe(false)
    expect(result.snapshot.completions).toHaveLength(1)
    expect(result.snapshot.timer.phase).toBe('shortBreak')
  })

  it('completes only one session after a long absence', () => {
    const started = run(createSnapshot(spec), [[T0, { type: 'start', sessionId: 'a', timeZone: 'UTC' }]])
    const later = reconcile(started, ctx(T0 + 3 * 24 * 60 * MIN), spec).snapshot
    expect(later.completions).toHaveLength(1)
    expect(later.timer).toEqual({ phase: 'shortBreak', session: null, completedFocusCount: 1 })
  })

  it('attributes the completion to the deadline date, not the reopening date', () => {
    const lateStart = Date.UTC(2026, 9, 28, 23, 50)
    const started = run(createSnapshot(spec), [[lateStart, { type: 'start', sessionId: 'a', timeZone: 'UTC' }]])
    const reopened = reconcile(started, ctx(Date.UTC(2026, 9, 31, 8, 0)), spec).snapshot
    expect(reopened.completions[0]).toMatchObject({ completedAt: lateStart + 25 * MIN, dateKey: '2026-10-29' })
  })

  it('reset abandons an unexpired session without credit and keeps history and cadence', () => {
    let s = completeFocus(createSnapshot(spec), T0, 'a')
    s = run(s, [
      [T0 + 25 * MIN, { type: 'skipBreak' }],
      [T0 + 26 * MIN, { type: 'start', sessionId: 'b', timeZone: 'UTC' }],
      [T0 + 40 * MIN, { type: 'reset' }],
    ])
    expect(s.completions.map((r) => r.sessionId)).toEqual(['a'])
    expect(s.timer).toEqual({ phase: 'focus', session: null, completedFocusCount: 1 })
  })

  it('reset after expiry keeps the earned completion', () => {
    const started = run(createSnapshot(spec), [[T0, { type: 'start', sessionId: 'a', timeZone: 'UTC' }]])
    const result = applyAction(started, { type: 'reset' }, ctx(T0 + 25 * MIN), spec)
    expect(result.completion?.credited).toBe(true)
    expect(result.snapshot.completions).toHaveLength(1)
    expect(result.snapshot.timer).toEqual({ phase: 'shortBreak', session: null, completedFocusCount: 1 })
  })

  it('pause after expiry completes the session instead of pausing it', () => {
    const started = run(createSnapshot(spec), [[T0, { type: 'start', sessionId: 'a', timeZone: 'UTC' }]])
    const s = run(started, [[T0 + 30 * MIN, { type: 'pause' }]])
    expect(s.timer.session).toBeNull()
    expect(s.completions).toHaveLength(1)
  })

  it('breaks earn no credit', () => {
    let s = completeFocus(createSnapshot(spec), T0, 'a')
    s = run(s, [[T0 + 25 * MIN, { type: 'start', sessionId: 'break', timeZone: 'UTC' }]])
    const result = reconcile(s, ctx(T0 + 30 * MIN), spec)
    expect(result.completion).toMatchObject({ phase: 'shortBreak', credited: false })
    expect(result.snapshot.completions).toHaveLength(1)
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

  it('keeps the cadence when breaks are skipped or sessions reset', () => {
    let s = createSnapshot(spec)
    for (let i = 1; i <= 3; i += 1) {
      s = completeFocus(s, T0 + i * 60 * MIN, `f${i}`)
      s = run(s, [[T0 + i * 60 * MIN + 25 * MIN, { type: 'skipBreak' }]])
    }
    s = run(s, [
      [T0 + 300 * MIN, { type: 'start', sessionId: 'x', timeZone: 'UTC' }],
      [T0 + 301 * MIN, { type: 'reset' }],
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
    expect(s.completions[0]?.dateKey).toBe('2026-10-29')
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

describe('abandoned focus sessions', () => {
  it('reports resetting an unexpired focus session, running or paused', () => {
    const running = run(createSnapshot(spec), [[T0, { type: 'start', sessionId: 'a', timeZone: 'UTC' }]])
    expect(applyAction(running, { type: 'reset' }, ctx(T0 + MIN), spec).abandoned).toEqual({ sessionId: 'a' })
    const paused = run(running, [[T0 + MIN, { type: 'pause' }]])
    expect(applyAction(paused, { type: 'reset' }, ctx(T0 + 99 * MIN), spec).abandoned).toEqual({ sessionId: 'a' })
  })

  it('does not report expired sessions, breaks, skips, or resets with nothing running', () => {
    const running = run(createSnapshot(spec), [[T0, { type: 'start', sessionId: 'a', timeZone: 'UTC' }]])
    const expired = applyAction(running, { type: 'reset' }, ctx(T0 + 25 * MIN), spec)
    expect(expired.abandoned).toBeNull()
    expect(expired.completion?.credited).toBe(true)

    const onBreak = run(expired.snapshot, [[T0 + 26 * MIN, { type: 'start', sessionId: 'b', timeZone: 'UTC' }]])
    expect(applyAction(onBreak, { type: 'reset' }, ctx(T0 + 27 * MIN), spec).abandoned).toBeNull()
    expect(applyAction(onBreak, { type: 'skipBreak' }, ctx(T0 + 27 * MIN), spec).abandoned).toBeNull()
    expect(applyAction(createSnapshot(spec), { type: 'reset' }, ctx(T0), spec).abandoned).toBeNull()
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
