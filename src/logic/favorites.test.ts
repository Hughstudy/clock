import { describe, expect, it } from 'vitest'
import type { FavoriteQuote } from '../contracts/favorites'
import { spec } from '../data/spec'
import { applyAction, type FavoriteAction } from './app'
import { createSnapshot, decodeSnapshot, encodeSnapshot, mergeSnapshots } from './snapshot'
import type { AppSnapshot } from './types'

const quote: FavoriteQuote = { id: 'ASKG001', copyVersion: 'v1', text: '慢慢来。' }
const updated = { ...quote, copyVersion: 'v2', text: '慢慢来，也可以。' }
const ctx = (now = 1000) => ({ now, dateKeyOf: () => '2026-11-02', quoteCatalog: [quote, updated] })
const action = (selected: boolean, expectedRev: number | null, item = quote): FavoriteAction =>
  ({ type: 'setQuoteFavorite', quote: item, selected, expectedRev, requestedAt: 900 })
const run = (snapshot: AppSnapshot, input: FavoriteAction, now = 1000) => applyAction(snapshot, input, ctx(now), spec)

describe('quote favorite relationships', () => {
  it('captures the clicked version once and refreshes only after explicit cancellation', () => {
    const first = run(createSnapshot(spec), action(true, null)).snapshot
    expect(first.quoteFavorites[0]).toMatchObject({ ...quote, savedAt: 900, rev: 1, deletedAt: null })
    const duplicate = run(first, action(true, 1, updated), 2000)
    expect(duplicate.changed).toBe(false)
    expect(duplicate.snapshot.quoteFavorites).toEqual(first.quoteFavorites)
    const removed = run(first, action(false, 1), 3000).snapshot
    expect(removed.quoteFavorites[0]).toMatchObject({ id: quote.id, text: '', deletedAt: 3000, rev: 2, savedAt: 900 })
    const again = run(removed, { ...action(true, 2, updated), requestedAt: 3900 }, 4000).snapshot
    expect(again.quoteFavorites).toHaveLength(1)
    expect(again.quoteFavorites[0]).toMatchObject({ ...updated, savedAt: 3900, rev: 3, deletedAt: null })
    expect(run(again, action(false, 1)).favoriteRejected).toBe(true)
  })

  it('rejects unregistered source text and generation-stale commands', () => {
    const blank = createSnapshot(spec)
    expect(run(blank, action(true, null, { ...quote, text: 'invented quote' })).favoriteRejected).toBe(true)
    expect(applyAction({ ...blank, datasetGeneration: 2 }, { ...action(true, null), generation: 1 }, ctx(), spec).changed).toBe(false)
    expect(applyAction(blank, action(true, null), { now: 1000, dateKeyOf: ctx().dateKeyOf }, spec).favoriteRejected).toBe(true)
  })

  it('keeps saved metadata when cancelling from a newer quote and captures it only when re-favorited', () => {
    const savedQuote = { ...quote, category: '原类型名称' }
    const displayedQuote = { ...updated, category: '新类型名称' }
    const selected = run(createSnapshot(spec), action(true, null, savedQuote)).snapshot
    const cancelled = run(selected, action(false, 1, displayedQuote), 3000).snapshot
    expect(cancelled.quoteFavorites).toEqual([{ ...savedQuote, text: '', savedAt: 900, rev: 2, deletedAt: 3000 }])
    const selectedAgain = run(cancelled, { ...action(true, 2, displayedQuote), requestedAt: 3900 }, 4000).snapshot
    expect(selectedAgain.quoteFavorites).toEqual([{ ...displayedQuote, savedAt: 3900, rev: 3, deletedAt: null }])
  })

  it('migrates v7 without inventing favorites and round-trips saved/cancelled snapshots', () => {
    const previous = { ...createSnapshot(spec), version: 7, quoteFavorites: undefined }
    const migrated = decodeSnapshot(JSON.stringify(previous), spec, { timeZone: 'UTC' })
    expect(migrated.kind).toBe('ok')
    if (migrated.kind !== 'ok') throw Error(migrated.kind)
    expect(migrated.issues).toEqual([])
    expect(migrated.snapshot.quoteFavorites).toEqual([])
    const selected = run(migrated.snapshot, action(true, null)).snapshot
    const cancelled = run(selected, action(false, 1)).snapshot
    for (const snapshot of [selected, cancelled]) {
      expect(decodeSnapshot(encodeSnapshot(snapshot), spec, { timeZone: 'UTC' })).toMatchObject({ kind: 'ok', issues: [], snapshot })
    }
  })

  it('retains cancellation against stale merges and never crosses a data generation', () => {
    const selected = run(createSnapshot(spec), action(true, null)).snapshot
    const cancelled = run(selected, action(false, 1)).snapshot
    expect(mergeSnapshots(selected, cancelled).quoteFavorites[0]?.deletedAt).toBe(1000)
    const replaced = { ...createSnapshot(spec), datasetGeneration: 1 }
    expect(mergeSnapshots(replaced, selected)).toBe(replaced)
  })
})
