import type { HistoryDay, HistoryEntry } from './stats'
import type { FocusRecord } from './types'
import { isDateKey } from './calendar'

export const RECORDS_PAGE_SIZE = 20
export type MonthFilter = string | 'unknown' | null

export interface RecordsQuery {
  month: MonthFilter
  search: string
  page: number
}

export function entryId(entry: HistoryEntry): string {
  return entry.kind === 'record' ? `record:${entry.record.sessionId}` : `thought:${entry.thought.id}`
}

export function entryDate(entry: HistoryEntry): string {
  return entry.kind === 'record' ? entry.record.dateKey : entry.thought.dateKey
}

export function knownDate(value: string): boolean {
  return isDateKey(value)
}

/** Literal continuous text search; canonical equivalents and English case match. */
export function searchText(value: string): string {
  return value.normalize('NFC').replace(/[A-Z]/g, letter => letter.toLowerCase())
}

export function queryRecords<R extends FocusRecord>(entries: readonly HistoryEntry<R>[], query: RecordsQuery) {
  const needle = searchText(query.search.trim())
  const matches = entries.filter(entry => {
    const date = entryDate(entry)
    if (query.month === 'unknown' ? knownDate(date) : query.month && !date.startsWith(`${query.month}-`)) return false
    return !needle || entry.kind === 'thought' && searchText(entry.thought.text).includes(needle)
  }).sort((a, b) => {
    const ad = entryDate(a), bd = entryDate(b)
    const knownA = knownDate(ad), knownB = knownDate(bd)
    if (knownA !== knownB) return knownA ? -1 : 1
    if (knownA && ad !== bd) return bd.localeCompare(ad)
    const at = a.kind === 'record' ? a.record.endedAt : a.thought.createdAt
    const bt = b.kind === 'record' ? b.record.endedAt : b.thought.createdAt
    return bt - at || entryId(a).localeCompare(entryId(b), 'en')
  })
  const pageCount = Math.ceil(matches.length / RECORDS_PAGE_SIZE)
  const page = Math.min(Math.max(1, Math.trunc(query.page) || 1), Math.max(1, pageCount))
  const items = matches.slice((page - 1) * RECORDS_PAGE_SIZE, page * RECORDS_PAGE_SIZE)
  const days: HistoryDay<R>[] = []
  for (const entry of items) {
    const dateKey = knownDate(entryDate(entry)) ? entryDate(entry) : ''
    let day = days.at(-1)
    if (!day || day.dateKey !== dateKey) { day = { dateKey, entries: [] }; days.push(day) }
    day.entries.push(entry)
  }
  return { items, days, all: matches, page, pageCount, total: matches.length }
}

/** Keep a visible object when a committed insert/delete shifts the page boundary. */
export function pageContaining(entries: readonly HistoryEntry[], anchor: string | null, fallback: number): number {
  const index = anchor ? entries.findIndex(entry => entryId(entry) === anchor) : -1
  return index < 0 ? fallback : Math.floor(index / RECORDS_PAGE_SIZE) + 1
}
