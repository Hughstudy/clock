import { isDateKey } from './calendar'
import type { SceneId, Thought } from './types'

export const RECORDS_PAGE_SIZE = 20
export type MonthFilter = string | 'unknown' | null
export const knownDate = (value: string): boolean => isDateKey(value)

export const matchesMonth = (key: string | null, month: MonthFilter): boolean =>
  month === 'unknown' ? !key || !knownDate(key) : !month || !!key?.startsWith(month + '-')

/** Literal continuous text search; canonical equivalents and English case match. */
export function searchText(value: string): string {
  return value.normalize('NFC').replace(/[A-Z]/g, (letter) => letter.toLowerCase())
}

/** Search the complete formal-note collection before pagination; pending text is not searchable. */
export function filterNotes<T extends { id: string; text: string; source: Thought }>(
  notes: readonly T[],
  month: MonthFilter,
  query: string,
  confirmedIds: ReadonlySet<string>
): T[] {
  const needle = searchText(query)
  return notes.filter(
    (note) =>
      matchesMonth(note.source.dateKey, month) &&
      (!needle || (confirmedIds.has(note.id) && searchText(note.text).includes(needle)))
  )
}

/** Book leaves run oldest to newest; unknown original dates stay unknown. */
export function orderMemories<T extends { id: string; dateKey: string | null; endedAt: number }>(
  pages: readonly T[]
): T[] {
  return [...pages].sort(
    (a, b) => (a.dateKey ?? '').localeCompare(b.dateKey ?? '') || a.endedAt - b.endedAt || b.id.localeCompare(a.id)
  )
}

/** A picture indexes every real source in reverse reading order. */
export function indexActivities<T extends { art: SceneId | null }>(pages: readonly T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const page of [...pages].reverse()) {
    if (!page.art) continue
    const items = groups.get(page.art)
    if (items) items.push(page)
    else groups.set(page.art, [page])
  }
  return groups
}

export function listWindow<T>(items: readonly T[], requestedPage: number) {
  const count = Math.max(1, Math.ceil(items.length / RECORDS_PAGE_SIZE))
  const page = Math.min(count, Math.max(1, requestedPage))
  return { page, count, items: items.slice((page - 1) * RECORDS_PAGE_SIZE, page * RECORDS_PAGE_SIZE) }
}

/** Recompute the page of a stable object after a peer inserts or removes entries. */
export const listPageFor = (index: number): number => Math.floor(index / RECORDS_PAGE_SIZE) + 1
