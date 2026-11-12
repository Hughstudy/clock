import { describe, expect, it } from 'vitest'
import { entryId, indexRoomActivities, pageContaining, queryRecords, type RecordsEntry } from './records-query'
import type { HistoryEntry } from './stats'
import type { FocusRecord, RestMemory, SceneId, Thought } from './types'

function note(id: number, text = `想法 ${id}`, dateKey = '2026-11-02'): HistoryEntry {
  const thought: Thought = { id: `n${id}`, createdAt: id, dateKey, sessionId: null, text, status: 'open', rev: 1, deletedAt: null }
  return { kind: 'thought', thought }
}

const rest = (sessionId: string, sceneId: RestMemory['sceneId'], endedAt: number, dateKey: RestMemory['dateKey']) =>
  ({ kind: 'rest', memory: { sessionId, sceneId, endedAt, dateKey, elapsedMs: 10_000, phase: null, endReason: null } } as const)

describe('records reading queries', () => {
  it('groups only confirmed focus assignments, retaining every real source and unknown dates', () => {
    type Saved = FocusRecord & { saved: boolean }
    const entry = (id: string, scene: SceneId | null, saved = true): HistoryEntry<Saved> => ({
      kind: 'record', record: { sessionId: id, dateKey: '', startedAt: null, endedAt: 1, elapsedMs: 0, targetMs: 60_000,
        endReason: 'manual', source: 'native', step: null, saved, ...(scene && { scene: { sceneId: scene, selectionVersion: 2, ordinal: 1 } }) },
    })
    const first = entry('first', 'F6'), second = entry('second', 'F6')
    const tags = indexRoomActivities([first, entry('pending', 'F3', false), entry('legacy', null), entry('rest', 'R1'), second])
    expect([...tags.keys()]).toEqual(['F6'])
    expect(tags.get('F6')).toEqual([first, second])
    expect(queryRecords(tags.get('F6')!, { page: 1, month: null, search: '' }).days[0]?.dateKey).toBe('')
  })
  it('indexes repeated rest activities using their original sessions, including undated sources', () => {
    const latest = rest('latest', 'R2', 20, '2026-11-02')
    const older = rest('earlier', 'R2', 15, null)
    const unidentified = rest('unknown', null, 40, null)
    const entries = [older, unidentified, latest]
    const tags = indexRoomActivities(entries)
    expect([...tags.keys()]).toEqual(['R2'])
    const sources = queryRecords(tags.get('R2')!, { month: null, search: '', page: 1 })
    expect(sources.all.map(entryId)).toEqual(['rest:latest', 'rest:earlier'])
    expect(queryRecords(entries, { month: 'unknown', search: '', page: 1 }).all).toEqual([unidentified, older])
  })

  it('mixes rest memories into the dated timeline, pagination and focus anchors', () => {
    const entries: RecordsEntry[] = Array.from({ length: 19 }, (_, i) => note(100 + i))
    const memory = rest('shared-id', 'R3', 80, '2026-11-02')
    const focus: RecordsEntry = { kind: 'record', record: { sessionId: 'shared-id', dateKey: '2026-11-02',
      startedAt: null, endedAt: 70, elapsedMs: 500, targetMs: 60_000, endReason: 'manual', source: 'native', step: null } }
    entries.push(memory, focus, rest('last-month', 'R3', 30, '2026-10-30'))
    const page = queryRecords(entries, { month: '2026-11', search: '', page: 1 })
    expect(page.total).toBe(21)
    expect(page.items.at(-1)).toBe(memory)
    expect(pageContaining(page.all, entryId(focus), 1)).toBe(2)
    expect(queryRecords(entries, { month: '2026-11', search: '', page: 2 }).items).toEqual([focus])
  })
  it('pages a busy single day by logical entries, with no overlap or loss', () => {
    const entries = Array.from({ length: 53 }, (_, i) => note(i))
    const pages = [1, 2, 3].map(page => queryRecords(entries, { month: null, search: '', page }))
    expect(pages.map(page => page.items.length)).toEqual([20, 20, 13])
    expect(pages.every(page => page.pageCount === 3 && page.days.length === 1)).toBe(true)
    expect(new Set(pages.flatMap(page => page.items.map(entryId))).size).toBe(53)
    expect(queryRecords(entries, { month: null, search: '', page: 90 }).page).toBe(3)
  })

  it('searches all 10,000 formal entries, intersects month, preserves original ordering', () => {
    const entries = Array.from({ length: 10_000 }, (_, i) => note(i, i % 117 === 0 ? 'Café 想法' : '别的文字', i % 2 ? '2026-10-02' : '2026-11-02'))
    const result = queryRecords(entries, { month: '2026-11', search: '  CAFe\u0301  ', page: 1 })
    expect(result.total).toBe(43)
    expect(result.items).toHaveLength(20)
    expect(result.items[0]).toEqual(note(9828, 'Café 想法'))
    expect(queryRecords(entries, { month: '2026-12', search: '', page: 1 }).pageCount).toBe(0)
    expect(queryRecords(entries, { month: '2026-11', search: 'CAFÉ', page: 1 }).total).toBe(0)
  })

  it('uses literal punctuation, includes archived text and excludes empty markers from search', () => {
    const archived = note(2, 'A+B.C')
    if (archived.kind === 'thought') archived.thought.status = 'putAway'
    const entries = [note(1, ''), archived, note(3, 'ABxC')]
    expect(queryRecords(entries, { month: null, search: 'a+b.', page: 1 }).items).toEqual([archived])
    expect(queryRecords(entries, { month: null, search: '', page: 1 }).total).toBe(3)
  })

  it('keeps unknown dates reachable and after known dates without assigning today', () => {
    const unknown = note(50, '旧想法', '')
    const entries = [unknown, note(1)]
    expect(queryRecords(entries, { month: null, search: '', page: 1 }).items).toEqual([note(1), unknown])
    expect(queryRecords(entries, { month: 'unknown', search: '', page: 1 }).items).toEqual([unknown])
    expect(queryRecords(entries, { month: '2026-11', search: '', page: 1 }).items).toEqual([note(1)])
  })

  it('reconciles a page around its stable anchor after a new item arrives', () => {
    const entries = Array.from({ length: 40 }, (_, i) => note(i))
    const before = queryRecords(entries, { month: null, search: '', page: 1 })
    const anchor = entryId(before.items.at(-1)!)
    const after = queryRecords([...entries, note(41)], { month: null, search: '', page: 1 })
    expect(pageContaining(after.all, anchor, 1)).toBe(2)
    expect(pageContaining(after.all, 'missing', 2)).toBe(2)
  })
})
