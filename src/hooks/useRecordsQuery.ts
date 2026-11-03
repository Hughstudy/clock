import { useMemo } from 'react'
import { entryDate, entryId, indexRoomActivities, knownDate, pageContaining, queryRecords, type RecordsQuery } from '../logic/records-query'
import type { FocusSceneId } from '../logic/types'
import type { StatsView } from './useViews'

export type RecordsMode = 'all' | 'thoughts' | 'scenes' | 'favorites'
export type { MonthFilter } from '../logic/records-query'

/** Read-only lookup model shared by history, thought search and saved activities. */
export function useRecordsQuery(view: StatsView, mode: RecordsMode, query: RecordsQuery, roomTag: FocusSceneId | null) {
  const allEntries = useMemo(() => view.historyDays.flatMap(day => day.entries), [view.historyDays])
  const thoughts = useMemo(() => view.thoughtDays.flatMap(day => day.entries), [view.thoughtDays])
  const thoughtById = useMemo(() => new Map(thoughts.filter(entry => entry.kind === 'thought').map(entry => [entryId(entry), entry.thought])), [thoughts])
  const searchedThoughts = useMemo(() => query.search ? thoughts.filter(entry => entry.kind === 'thought' && view.confirmedThoughtIds.has(entry.thought.id)) : thoughts, [thoughts, query.search, view.confirmedThoughtIds])
  const roomActivities = useMemo(() => indexRoomActivities(allEntries), [allEntries])
  const sources = useMemo(() => roomTag ? roomActivities.get(roomTag) ?? [] : [], [roomActivities, roomTag])
  const entries = mode === 'thoughts' ? searchedThoughts : mode === 'scenes' ? sources : allEntries
  const result = useMemo(() => queryRecords(entries, query), [entries, query])
  return {
    ...result, roomActivities, thoughtById, entryKey: entryId, isKnownDate: knownDate,
    hasUnknownDates: entries.some(entry => !knownDate(entryDate(entry))),
    hasPendingRecords: allEntries.some(entry => entry.kind === 'record' && !entry.record.saved),
    pageForAnchor: (anchor: string | null, fallback: number) => pageContaining(result.all, anchor, fallback),
  }
}
