import { describe, expect, it } from 'vitest'
import { addDays, fromDayNumber, isDateKey, startOfWeek, toDayNumber, weekday } from './calendar'
import { groupEntries, indexByDay, rangeTotals, weekTotals } from './stats'
import { currentStreak } from './streak'
import type { FocusRecord, Thought } from './types'

describe('calendar keys', () => {
  it('round-trips day numbers across centuries and leap days', () => {
    expect(toDayNumber('1970-01-01')).toBe(0)
    for (const key of ['1600-03-01', '1999-12-31', '2000-02-29', '2024-02-29', '2026-10-28', '2100-03-01']) {
      expect(fromDayNumber(toDayNumber(key))).toBe(key)
    }
  })

  it('adds calendar days, including across months, years and DST change dates', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29')
    // US and EU daylight-saving changes are ordinary calendar days here.
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09')
    expect(addDays('2026-11-01', -1)).toBe('2026-10-31')
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26')
  })

  it('validates keys', () => {
    expect(isDateKey('2024-02-29')).toBe(true)
    expect(isDateKey('2026-02-29')).toBe(false)
    expect(isDateKey('2026-13-01')).toBe(false)
    expect(isDateKey('2026-1-01')).toBe(false)
    expect(isDateKey(20261028)).toBe(false)
  })

  it('finds weekdays and Monday-based week starts', () => {
    expect(weekday('2026-10-28')).toBe(3) // Wednesday
    expect(startOfWeek('2026-10-28', 1)).toBe('2026-10-26')
    expect(startOfWeek('2026-11-01', 1)).toBe('2026-10-26') // Sunday belongs to the previous Monday's week
    expect(startOfWeek('2026-10-26', 1)).toBe('2026-10-26')
    expect(startOfWeek('2026-10-28', 0)).toBe('2026-10-25')
  })
})

const record = (sessionId: string, dateKey: string, minutes = 25): FocusRecord => ({
  sessionId,
  dateKey,
  endedAt: 0,
  elapsedMs: minutes * 60_000,
  targetMs: minutes * 60_000,
  startedAt: null,
  endReason: 'deadline',
  source: 'legacy',
  step: null,
})

describe('stats', () => {
  it('includes today and the preceding 6 or 29 civil dates and sums sub-second records exactly', () => {
    const sample = (dateKey: string, elapsedMs: number) => ({ ...record(dateKey, dateKey), elapsedMs })
    const index = indexByDay([sample('2026-10-01', 10_000), sample('2026-10-02', 7_000),
      sample('2026-10-24', 3_000), sample('2026-10-25', 600), sample('2026-10-25', 600),
      sample('2026-10-31', 0), sample('2026-11-01', 5000)])
    const seven = rangeTotals(index, '2026-10-31', 7)
    expect(seven).toMatchObject({ startKey: '2026-10-25', focusMs: 1200, count: 3 })
    expect(seven.days[0]).toMatchObject({ dateKey: '2026-10-25', focusMs: 1200, count: 2 })
    expect(rangeTotals(index, '2026-10-31', 30)).toMatchObject({ startKey: '2026-10-02', focusMs: 11200, count: 5 })
    expect(rangeTotals(index, '2024-03-01', 7).startKey).toBe('2024-02-24')
    expect(rangeTotals(index, '2026-11-03', 7).days.map(day => day.dateKey)).toContain('2026-11-01')
  })

  it('orders independent thoughts among sessions on their own dates with stable identity ties', () => {
    const dateKey = '2026-10-25'
    const thought: Thought = { id: 't', text: '', dateKey, createdAt: 10, rev: 1, status: 'open', deletedAt: null, sessionId: null }
    const session = (id: string, endedAt: number) => ({ kind: 'record' as const, record: { ...record(id, dateKey), endedAt } })
    const days = groupEntries([session('z', 8), session('a', 8), { kind: 'thought', thought }, session('b', 12),
      { kind: 'thought', thought: { ...thought, dateKey: '2026-10-26', id: 'next-day' } }])
    expect(days.map(day => day.dateKey)).toEqual(['2026-10-26', dateKey])
    expect(days[1]?.entries.map(e => e.kind === 'record' ? e.record.sessionId : e.thought.id)).toEqual(['b', 't', 'a', 'z'])
  })
  it('groups by recorded date key and totals the local week', () => {
    const index = indexByDay([
      record('a', '2026-10-25'), // previous Sunday: outside the week
      record('b', '2026-10-26'),
      record('c', '2026-10-28', 30),
      record('d', '2026-10-28'),
      record('e', '2026-11-01'),
      record('f', '2026-11-02'), // next Monday
    ])
    const week = weekTotals(index, '2026-10-28', 1)
    expect(week.startKey).toBe('2026-10-26')
    expect(week.days.map((d) => d.count)).toEqual([1, 0, 2, 0, 0, 0, 1])
    expect(week.focusMs).toBe((25 + 30 + 25 + 25) * 60_000)
    expect(week.count).toBe(4)
  })
})

describe('streak', () => {
  const index = indexByDay([
    record('a', '2026-10-24'),
    record('b', '2026-10-26'),
    record('c', '2026-10-27'),
    record('d', '2026-10-27'),
  ])

  it('keeps yesterday’s streak alive while today is in progress', () => {
    expect(currentStreak(index, '2026-10-28')).toEqual({ days: 2, includesToday: false })
  })

  it('counts today once it qualifies', () => {
    const withToday = indexByDay([record('a', '2026-10-27'), record('b', '2026-10-28')])
    expect(currentStreak(withToday, '2026-10-28')).toEqual({ days: 2, includesToday: true })
  })

  it('breaks only after a fully missed day', () => {
    expect(currentStreak(index, '2026-10-29')).toEqual({ days: 0, includesToday: false })
  })

  it('crosses month boundaries by calendar day', () => {
    const days = indexByDay([record('a', '2026-10-30'), record('b', '2026-10-31'), record('c', '2026-11-01')])
    expect(currentStreak(days, '2026-11-01').days).toBe(3)
  })
})
