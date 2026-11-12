import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { spec } from '../data/spec'
import { createSnapshot } from '../logic/snapshot'
import type { Thought } from '../logic/types'
import { applyAction } from '../logic/app'
import type { ClockApp, ThoughtResult } from './useClockApp'
import { continueSavedDraft, useThoughts, type Thoughts } from './useThoughts'

const NOW = Date.UTC(2026, 10, 2, 4)
afterEach(() => vi.restoreAllMocks())

function project(memory: Thought[], durable: readonly Thought[], receipts = new Map<string, ThoughtResult>()): Thoughts {
  const snapshot = { ...createSnapshot(spec), thoughts: memory }
  const app: ClockApp = {
    snapshot, savedRecordIds: new Set(), durableThoughts: durable, durableRests: [], durableFavorites: [], timerPending: false, savingMarker: false,
    persistence: 'saved', notice: null, saveError: null, saveState: 'saved', feedbackEvent: null,
    thoughtResult: null, thoughtReceipts: receipts, result: null, hasPendingOperations: false,
    submitThought: async () => true, submitFavorite: async () => ({ accepted: true, rejected: false }),
    dispatch: () => {}, checkReload: async () => true,
  }
  let projected: Thoughts | undefined
  function Probe() { projected = useThoughts(app); return null }
  renderToStaticMarkup(createElement(Probe))
  return projected!
}

describe('large thought collections', () => {
  it('finds pending changes and current deletion undos among 10,000 items without per-item collection searches', () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW)
    const durable: Thought[] = Array.from({ length: 10_000 }, (_, index) => ({
      id: `note-${index}`, createdAt: NOW - 20_000 + index, dateKey: '2026-11-02', sessionId: null,
      text: `想法 ${index}`, status: 'open', rev: 1, deletedAt: null,
    }))
    durable[10] = { ...durable[10]!, rev: 2, deletedAt: NOW - 1 }
    durable[11] = { ...durable[11]!, rev: 2, deletedAt: NOW - 599_999 }
    durable[12] = { ...durable[12]!, rev: 2, deletedAt: NOW - 600_000 }
    durable[13] = { ...durable[13]!, rev: 2, deletedAt: NOW + 1 }
    const memory = [...durable]
    memory[20] = { ...memory[20]!, rev: 2, text: '待保存编辑' }
    memory[21] = { ...memory[21]!, rev: 2, deletedAt: NOW }
    memory[22] = { ...memory[22]!, rev: 2, status: 'putAway' }
    memory[11] = { ...memory[11]!, rev: 3, deletedAt: null }
    const receipts = new Map<string, ThoughtResult>([
      ['failed-lock', { operationId: 'failed-lock', thoughtId: 'note-23', generation: 0, change: null, revision: null, saved: false }],
      ['other-generation', { operationId: 'other-generation', thoughtId: 'note-24', generation: 1, change: null, revision: null, saved: false }],
    ])
    // Protect against reintroducing a nested full-list lookup. This asserts an
    // algorithmic bound without depending on machine speed or wall-clock timing.
    const searched = vi.spyOn(durable, 'find')
    const view = project(memory, durable, receipts)
    expect(view.pendingIds).toEqual(new Set(['note-11', 'note-20', 'note-21', 'note-22', 'note-23']))
    expect(view.undos.map(undo => undo.id)).toEqual(['note-10'])
    expect(searched).not.toHaveBeenCalled()
    expect(view.hasDraft).toBe(false)
  })
})

describe('typing after a submitted draft', () => {
  const ctx = { now: NOW, dateKeyOf: () => '2026-11-02' }
  const submitted = { id: 'draft-a', thoughtId: null, baseRev: null, sessionId: null,
    timeZone: 'UTC', createdAt: NOW, dateKey: '2026-11-02', text: 'A' }
  const saved = applyAction(createSnapshot(spec), { type: 'saveThoughtText', thoughtId: 'note-a', text: 'A', timeZone: 'UTC',
    draft: submitted, expectedStamp: null, stamp: 'save-a' }, ctx, spec).snapshot
  const editing = { generation: 0, stamp: 'save-a', draft: { ...submitted, text: 'later B' } }
  const receipt = { generation: 0, thoughtId: 'note-a', revision: 1 }
  const peerDraft = { ...submitted, id: 'peer-c', text: 'peer C' }
  const writePeer = () => applyAction(saved, { type: 'writeDraft', draft: peerDraft, expectedStamp: 'save-a', stamp: 'peer-c-stamp' }, ctx, spec).snapshot

  it('does not adopt a peer draft stamp when the peer saves before the A receipt is handled', () => {
    const peer = writePeer()
    const continued = continueSavedDraft(editing, receipt, peer, 'continuation-b')
    expect(continued.conflict).toBe(true)
    expect(continued.editor).toMatchObject({ stamp: 'save-a', draft: { id: 'continuation-b', text: 'later B', thoughtId: 'note-a', baseRev: 1 } })
    const attempted = applyAction(peer, { type: 'writeDraft', draft: continued.editor.draft, expectedStamp: continued.editor.stamp,
      stamp: 'local-b-stamp' }, ctx, spec)
    expect(attempted.draftConflict).toBe(true)
    expect(attempted.snapshot.thoughtDraft).toEqual(peerDraft)
    expect(attempted.snapshot.thoughts).toMatchObject([{ id: 'note-a', text: 'A' }])
  })

  it('also rejects a peer write arriving between continuation preparation and its autosave', () => {
    const continued = continueSavedDraft(editing, receipt, saved, 'continuation-b')
    expect(continued.conflict).toBe(false)
    const localWrite = { type: 'writeDraft' as const, draft: continued.editor.draft, expectedStamp: continued.editor.stamp, stamp: 'local-b-stamp' }
    const accepted = applyAction(saved, localWrite, ctx, spec)
    expect(accepted.snapshot.thoughtDraft).toMatchObject({ text: 'later B', thoughtId: 'note-a', createdAt: NOW })
    const rejected = applyAction(writePeer(), localWrite, ctx, spec)
    expect(rejected.draftConflict).toBe(true)
    expect(rejected.snapshot.thoughtDraft).toEqual(peerDraft)
    expect(continued.editor.draft.text).toBe('later B')
  })
})
