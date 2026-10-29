import { addDays, startOfWeek } from './calendar'
import type { FocusRecord, DateKey } from './types'

export interface DayTotal {
  dateKey: DateKey
  count: number
  focusMs: number
}

export type DayIndex = ReadonlyMap<DateKey, DayTotal>

/** Groups records by their recorded date key. */
export function indexByDay(records: readonly FocusRecord[]): DayIndex {
  const index = new Map<DateKey, DayTotal>()
  for (const record of records) {
    const day = index.get(record.dateKey) ?? { dateKey: record.dateKey, count: 0, focusMs: 0 }
    index.set(record.dateKey, { ...day, count: day.count + 1, focusMs: day.focusMs + record.elapsedMs })
  }
  return index
}

export function dayTotal(index: DayIndex, dateKey: DateKey): DayTotal {
  return index.get(dateKey) ?? { dateKey, count: 0, focusMs: 0 }
}

export interface WeekTotals {
  startKey: DateKey
  days: DayTotal[]
  count: number
  focusMs: number
}

/** Totals for the local calendar week containing `todayKey`. */
export function weekTotals(index: DayIndex, todayKey: DateKey, weekStartsOn: number): WeekTotals {
  const startKey = startOfWeek(todayKey, weekStartsOn)
  const days = Array.from({ length: 7 }, (_, i) => dayTotal(index, addDays(startKey, i)))
  return {
    startKey,
    days,
    count: days.reduce((sum, d) => sum + d.count, 0),
    focusMs: days.reduce((sum, d) => sum + d.focusMs, 0),
  }
}
