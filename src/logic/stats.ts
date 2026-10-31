import { addDays, startOfWeek } from './calendar'
import type { FocusRecord, DateKey, Thought } from './types'

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
  return totalsFrom(index, startKey, 7)
}

export type RangeLength = 7 | 30

/** The device supplies today's civil date. Historical records keep their own date keys. */
export function rangeTotals(index: DayIndex, todayKey: DateKey, length: RangeLength): WeekTotals {
  return totalsFrom(index, addDays(todayKey, 1 - length), length)
}

function totalsFrom(index: DayIndex, startKey: DateKey, length: number): WeekTotals {
  const days = Array.from({ length }, (_, i) => dayTotal(index, addDays(startKey, i)))
  return {
    startKey,
    days,
    count: days.reduce((sum, d) => sum + d.count, 0),
    focusMs: days.reduce((sum, d) => sum + d.focusMs, 0),
  }
}

export type HistoryEntry<R extends FocusRecord = FocusRecord> =
  | { kind: 'record'; record: R }
  | { kind: 'thought'; thought: Thought }

export interface HistoryDay<R extends FocusRecord = FocusRecord> {
  dateKey: DateKey
  entries: HistoryEntry<R>[]
}

/** Order mixed entries using their own recorded date, instant and stable identity. */
export function groupEntries<R extends FocusRecord>(entries: HistoryEntry<R>[]): HistoryDay<R>[] {
  const days = new Map<DateKey, HistoryEntry<R>[]>()
  const id = (entry: HistoryEntry<R>) => entry.kind === 'record' ? entry.record.sessionId : entry.thought.id
  const instant = (entry: HistoryEntry<R>) => entry.kind === 'record' ? entry.record.endedAt : entry.thought.createdAt
  for (const entry of entries) {
    const key = entry.kind === 'record' ? entry.record.dateKey : entry.thought.dateKey
    const group = days.get(key)
    if (group) group.push(entry)
    else days.set(key, [entry])
  }
  return [...days.keys()].sort().reverse().map(dateKey => ({
    dateKey,
    entries: days.get(dateKey)!.sort((a, b) =>
      instant(b) - instant(a) || id(a).localeCompare(id(b), 'en') || a.kind.localeCompare(b.kind, 'en')),
  }))
}
