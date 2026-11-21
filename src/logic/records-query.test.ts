import { describe, expect, it } from 'vitest'
import { filterNotes, listPageFor, listWindow, matchesMonth, orderMemories } from './records-query'
import type { Thought } from './types'

function note(id: number, text = `想法 ${id}`, dateKey = '2026-11-02') {
  const source: Thought = {
    id: `n${id}`,
    createdAt: id,
    dateKey,
    sessionId: null,
    text,
    status: 'open',
    rev: 1,
    deletedAt: null,
  }
  return { id: source.id, text, source }
}
const confirmed = (notes: readonly { id: string }[]) => new Set(notes.map((n) => n.id))

describe('live book queries', () => {
  it('pages a busy single day without overlap or loss and clamps after deletion', () => {
    const notes = Array.from({ length: 53 }, (_, i) => note(i))
    const pages = [1, 2, 3].map((page) => listWindow(notes, page))
    expect(pages.map((page) => page.items.length)).toEqual([20, 20, 13])
    expect(new Set(pages.flatMap((page) => page.items.map((n) => n.id))).size).toBe(53)
    expect(listWindow(notes.slice(0, 20), 3)).toMatchObject({ page: 1, count: 1 })
    expect(listWindow([], 3)).toEqual({ page: 1, count: 1, items: [] })
  })

  it('searches all 10,000 notes before paging and intersects month without changing order', () => {
    const notes = Array.from({ length: 10_000 }, (_, i) =>
      note(i, i % 117 === 0 ? 'Café 想法' : '别的文字', i % 2 ? '2026-10-02' : '2026-11-02')
    ).reverse()
    const result = filterNotes(notes, '2026-11', 'CAFe\u0301', confirmed(notes))
    expect(result).toHaveLength(43)
    expect(listWindow(result, 1).items).toHaveLength(20)
    expect(result[0]?.id).toBe('n9828')
    expect(filterNotes(notes, '2026-12', '', confirmed(notes))).toEqual([])
    expect(filterNotes(notes, '2026-11', 'CAFÉ', confirmed(notes))).toEqual([])
  })

  it('matches literal punctuation and archived text while leaving pending text outside search', () => {
    const archived = note(2, 'A+B.C')
    archived.source.status = 'putAway'
    const notes = [note(1, ''), archived, note(3, 'ABxC'), note(4, 'A+B.C')]
    const ids = new Set(['n1', 'n2', 'n3'])
    expect(filterNotes(notes, null, 'a+b.', ids)).toEqual([archived])
    expect(filterNotes(notes, null, '', ids)).toEqual(notes)
  })

  it('keeps unknown dates reachable and relocates an anchor when an insertion crosses a page', () => {
    const pages = Array.from({ length: 40 }, (_, i) => ({ id: String(i), dateKey: '2026-11-02', endedAt: i }))
    const unknown = { id: 'unknown', dateKey: null, endedAt: 99 }
    const ordered = orderMemories([...pages, unknown])
    expect(ordered[0]).toBe(unknown)
    expect(ordered.filter((page) => matchesMonth(page.dateKey, 'unknown'))).toEqual([unknown])
    expect(ordered.filter((page) => matchesMonth(page.dateKey, '2026-11'))).toEqual(pages)
    const anchor = listWindow(pages, 1).items.at(-1)!
    expect(listPageFor(pages.indexOf(anchor))).toBe(1)
    const withPeerInsert = [{ id: 'insert', dateKey: '2026-11-01', endedAt: 0 }, ...pages]
    expect(listPageFor(withPeerInsert.findIndex((p) => p.id === anchor.id))).toBe(2)
  })
})
