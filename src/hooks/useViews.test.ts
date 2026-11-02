import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { spec } from '../data/spec'
import { applyAction, type AppAction } from '../logic/app'
import { createSnapshot } from '../logic/snapshot'
import type { AppSnapshot } from '../logic/types'
import { useStatsView, useTimerView, type StatsView, type TimerView } from './useViews'
import type { Thought } from '../logic/types'

const T0 = Date.UTC(2026, 9, 31, 9)
const act = (snapshot: AppSnapshot, action: AppAction, now = T0) => applyAction(snapshot, action, { now, dateKeyOf: () => '2026-10-31' }, spec).snapshot
function viewOf(snapshot: AppSnapshot, now: number): TimerView {
  let value: TimerView | undefined
  function Probe() { value = useTimerView(snapshot, now); return null }
  renderToStaticMarkup(createElement(Probe))
  return value!
}

function statsOf(snapshot: AppSnapshot, saved: ReadonlySet<string>, durable: readonly Thought[]): StatsView {
  let value: StatsView | undefined
  function Probe() { value = useStatsView(snapshot, T0, saved, durable); return null }
  renderToStaticMarkup(createElement(Probe))
  return value!
}

describe('confirmed records and formal thought projection', () => {
  it('keeps pending ended time out of totals until persistence confirms it', () => {
    const ended = act(act(createSnapshot(spec), { type: 'start', sessionId: 'pending', timeZone: 'UTC' }), { type: 'end' }, T0 + 20_000)
    const pending = statsOf(ended, new Set(), [])
    expect(pending.totalsByDay.size).toBe(0)
    expect(pending.recordBySession.get('pending')?.saved).toBe(false)
    const saved = statsOf(ended, new Set(['pending']), [])
    expect(saved.totalsByDay.get('2026-10-31')?.focusMs).toBe(20_000)
  })

  it.each(['delete', 'edit', 'putAway'] as const)('retains formal text and status during unconfirmed %s', change => {
    const formal: Thought = { id: 'note', createdAt: T0, dateKey: '2026-10-31', sessionId: null, text: '原文', status: 'open', rev: 1, deletedAt: null }
    const memory = { ...formal, rev: 2, ...(change === 'delete' ? { deletedAt: T0 } : change === 'edit' ? { text: '待保存新文' } : { status: 'putAway' as const }) }
    const projected = statsOf({ ...createSnapshot(spec), thoughts: [memory] }, new Set(), [formal])
    expect(projected.thoughtDays[0]?.entries[0]).toEqual({ kind: 'thought', thought: formal })
    expect(projected.confirmedThoughtIds.has('note')).toBe(true)
    expect(projected.pendingThoughtIds.has('note')).toBe(true)
    const confirmed = statsOf({ ...createSnapshot(spec), thoughts: [memory] }, new Set(), [memory])
    expect(confirmed.pendingThoughtIds.size).toBe(0)
    expect(confirmed.thoughtDays.length).toBe(change === 'delete' ? 0 : 1)
  })
})

describe('precise main-owned scene progress', () => {
  it('advances below the former one-percent threshold while the badge keeps remaining progress', () => {
    const snapshot = act(createSnapshot(spec), { type: 'start', sessionId: 'precise', timeZone: 'UTC', durationMinutes: 25 })
    const view = viewOf(snapshot, T0 + 250)
    expect(view.completedProgress).toBeCloseTo(250 / 1_500_000, 12)
    expect(view.completedProgress).toBeGreaterThan(0)
    expect(view.progress + view.completedProgress).toBeCloseTo(1, 12)
  })

  it('holds the precise fraction through paused time and resumes from the same amount', () => {
    const started = act(createSnapshot(spec), { type: 'start', sessionId: 'paused', timeZone: 'UTC', durationMinutes: 5 })
    const paused = act(started, { type: 'pause', sessionId: 'paused' }, T0 + 61_250)
    expect(viewOf(paused, T0 + 8 * 60_000).completedProgress).toBeCloseTo(61_250 / 300_000, 12)
    const resumed = act(paused, { type: 'resume', sessionId: 'paused' }, T0 + 8 * 60_000)
    expect(viewOf(resumed, T0 + 8 * 60_000).completedProgress).toBe(viewOf(paused, T0).completedProgress)
    expect(viewOf(resumed, T0 + 8 * 60_000 + 250).completedProgress).toBeCloseTo(61_500 / 300_000, 12)
  })

  it('keeps ready/rest progress zero and caps an expired focus at one', () => {
    expect(viewOf(createSnapshot(spec), T0).completedProgress).toBe(0)
    const rest = act(createSnapshot(spec), { type: 'startBreak', sessionId: 'rest', timeZone: 'UTC' })
    expect(viewOf(rest, T0 + 60_000).completedProgress).toBe(0)
    const focus = act(createSnapshot(spec), { type: 'start', sessionId: 'expired', timeZone: 'UTC', durationMinutes: 5 })
    expect(viewOf(focus, T0 + 10 * 60_000).completedProgress).toBe(1)
  })
})
