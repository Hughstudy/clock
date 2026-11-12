import type { HistoryEntry } from './stats'
import type { FocusRecord, RestMemory, SceneId } from './types'
import { isFocusSceneId } from './scenes'
import { isDateKey } from './calendar'

export const RECORDS_PAGE_SIZE = 20
export type MonthFilter = string | 'unknown' | null
export type RecordsEntry<R extends FocusRecord = FocusRecord> = HistoryEntry<R> | { kind: 'rest'; memory: RestMemory }
type ActivityEntry<R extends FocusRecord> = Exclude<RecordsEntry<R>, { kind: 'thought' }>

export interface RecordsQuery {
  month: MonthFilter
  search: string
  page: number
}

/** Only confirmed scene assignments have a paper picture. Older sessions may have none. */
export function entryPicture<R extends FocusRecord & { saved: boolean }>(entry: RecordsEntry<R>): SceneId | null {
  if (entry.kind === 'rest') return entry.memory.sceneId
  if (entry.kind !== 'record' || !entry.record.saved) return null
  const id = entry.record.scene?.sceneId
  return isFocusSceneId(id) ? id : null
}

export function indexRoomActivities<R extends FocusRecord & { saved: boolean }>(entries: readonly RecordsEntry<R>[]) {
  const groups = new Map<SceneId, ActivityEntry<R>[]>()
  for (const entry of entries) {
    if (entry.kind === 'thought') continue
    const scene = entryPicture(entry)
    if (!scene) continue
    const existing = groups.get(scene)
    if (existing) existing.push(entry)
    else groups.set(scene, [entry])
  }
  return groups
}

export function entryId(entry: RecordsEntry): string {
  if (entry.kind === 'rest') return `rest:${entry.memory.sessionId}`
  return entry.kind === 'record' ? `record:${entry.record.sessionId}` : `thought:${entry.thought.id}`
}

export function entryDate(entry: RecordsEntry): string {
  if (entry.kind === 'rest') return entry.memory.dateKey ?? ''
  return entry.kind === 'record' ? entry.record.dateKey : entry.thought.dateKey
}

function entryInstant(entry: RecordsEntry): number {
  if (entry.kind === 'rest') return entry.memory.endedAt
  return entry.kind === 'record' ? entry.record.endedAt : entry.thought.createdAt
}

export function knownDate(value: string): boolean {
  return isDateKey(value)
}

/** Literal continuous text search; canonical equivalents and English case match. */
export function searchText(value: string): string {
  return value.normalize('NFC').replace(/[A-Z]/g, letter => letter.toLowerCase())
}

export function queryRecords<R extends FocusRecord>(entries: readonly RecordsEntry<R>[], query: RecordsQuery) {
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
    return entryInstant(b) - entryInstant(a) || entryId(a).localeCompare(entryId(b), 'en')
  })
  const pageCount = Math.ceil(matches.length / RECORDS_PAGE_SIZE)
  const page = Math.min(Math.max(1, Math.trunc(query.page) || 1), Math.max(1, pageCount))
  const items = matches.slice((page - 1) * RECORDS_PAGE_SIZE, page * RECORDS_PAGE_SIZE)
  const days: { dateKey: string; entries: RecordsEntry<R>[] }[] = []
  for (const entry of items) {
    const dateKey = knownDate(entryDate(entry)) ? entryDate(entry) : ''
    let day = days.at(-1)
    if (!day || day.dateKey !== dateKey) { day = { dateKey, entries: [] }; days.push(day) }
    day.entries.push(entry)
  }
  return { items, days, all: matches, page, pageCount, total: matches.length }
}

/** Keep a visible object when a committed insert/delete shifts the page boundary. */
export function pageContaining(entries: readonly RecordsEntry[], anchor: string | null, fallback: number): number {
  const index = anchor ? entries.findIndex(entry => entryId(entry) === anchor) : -1
  return index < 0 ? fallback : Math.floor(index / RECORDS_PAGE_SIZE) + 1
}
