import { describe, expect, it } from 'vitest'
import { spec } from '../data/spec'
import { readingEdition1 } from './reading-edition-v1'
import { applyAction, type AppAction } from './app'
import { bindReading, readingBookmarkSource, readingStage } from './reading-story'
import { createSnapshot, decodeSnapshot, encodeSnapshot, mergeSnapshots } from './snapshot'
import type { AppSnapshot, FocusRecord } from './types'

const minute = 60_000
const fresh = () => createSnapshot(spec)
function act(s: AppSnapshot, action: AppAction, now = 0, durableReadingRecords?: readonly FocusRecord[]) {
  return applyAction(s, action, { now, dateKeyOf: () => '2026-11-26', ...(durableReadingRecords ? { durableReadingRecords } : {}) }, spec).snapshot
}
function start(s: AppSnapshot, durationMinutes: number, id = 'book', now = 0, durableReadingRecords?: readonly FocusRecord[]) {
  const deck: AppSnapshot = { ...s, scenes: { ...s.scenes, focus: { ...s.scenes.focus, remaining: ['F3'] } } }
  return act(deck, { type: 'startFocus', durationMinutes, timeZone: 'UTC', sessionId: id }, now, durableReadingRecords)
}
function decode(value: unknown) {
  const loaded = decodeSnapshot(JSON.stringify(value), spec, { timeZone: 'UTC' })
  if (loaded.kind !== 'ok') throw Error(loaded.kind)
  return loaded
}

describe('versioned DAY04 read on an ordinary F3 start', () => {
  it('has a safe authored landing at every beat and one complete ending per script', () => {
    for (const chapter of Object.values(readingEdition1)) {
      expect(chapter.beats[0]?.at).toBe(0)
      let previous = -1
      for (const beat of chapter.beats) {
        expect(beat.at).toBeGreaterThan(previous)
        expect(beat.at).toBeLessThan(1)
        expect(beat.caption.trim()).not.toBe('')
        previous = beat.at
      }
      expect(chapter.ending.caption.trim()).not.toBe('')
    }
  })

  it('binds only the authored budgets and never rebinds an unbound session when its duration is edited', () => {
    for (const minutes of [2, 5, 24, 26, 120]) expect(bindReading('F3', minutes, [])).toBeUndefined()
    expect(bindReading('F4', 25, [])).toBeUndefined()
    const other = start(fresh(), 5)
    expect(other.timer.session?.reading).toBeUndefined()
    expect(act(other, { type: 'adjustRemaining', sessionId: 'book', expectedTimingRevision: 0, remainingMinutes: 1 }).timer.session?.reading).toBeUndefined()
  })

  it('archives only reached clues, including zero seconds; the one-minute discovery alone leaves the ticket in place', () => {
    const s = start(fresh(), 1)
    for (const [ms, stage, illustration] of [[0, 'open', 'dog-hat'], [21_000, 'turn', 'reading'], [42_000, 'found', 'dog-found']] as const) {
      const ended = act(s, { type: 'end', sessionId: 'book' }, ms)
      expect(ended.records[0]?.reading).toMatchObject({ variant: 'hat', stage, illustration, archive: 'note' })
      expect(!!ended.records[0]?.reading?.excerpt).toBe(stage === 'found')
      expect(readingBookmarkSource(ended.records)).toBeUndefined()
    }
    const atDeadline = act(s, { type: 'end', sessionId: 'book' }, minute)
    expect(atDeadline.records[0]).toMatchObject({ endReason: 'deadline', reading: { stage: 'found', archive: 'page' } })
    expect(atDeadline.timer.completedFocusCount).toBe(1)
    expect(readingBookmarkSource(atDeadline.records)).toBeUndefined()
  })

  it('pauses, reloads and resumes the same book, then preserves the last reread on manual end', () => {
    let s = act(start(fresh(), 25), { type: 'pause', sessionId: 'book' }, 6.25 * minute)
    const restored = decode(s)
    expect(restored.issues).toEqual([])
    expect(restored.snapshot).toEqual(s)
    s = act(restored.snapshot, { type: 'resume', sessionId: 'book' }, 12 * minute)
    s = act(s, { type: 'end', sessionId: 'book' }, 27 * minute)
    const record = s.records[0]!
    expect(record.elapsedMs).toBe(21.25 * minute)
    expect(record.reading).toMatchObject({ variant: 'chapter', archive: 'note', stage: 'linger', caption: '它把末尾那句话又念了一遍，书还摊在桌上。' })
    expect(readingBookmarkSource(s.records)).toBeUndefined()
    expect(decode(s).snapshot.records[0]).toEqual(record)
  })

  it('shortening makes a natural 18-minute ending factual without granting the 25-minute chapter', () => {
    let s = start(fresh(), 25)
    s = act(s, { type: 'adjustRemaining', sessionId: 'book', expectedTimingRevision: 0, remainingMinutes: 10 }, 8 * minute)
    s = act(decode(s).snapshot, { type: 'reconcile' }, 18 * minute)
    expect(s.records[0]).toMatchObject({ elapsedMs: 18 * minute, endReason: 'deadline',
      reading: { stage: 'later', archive: 'note', illustration: 'reading' } })
    expect(s.timer.completedFocusCount).toBe(1)
    expect(readingBookmarkSource(s.records)).toBeUndefined()
  })

  it('waits for natural expiry on an extended deadline and never advances the same book twice', () => {
    let s = start(fresh(), 25)
    s = act(s, { type: 'adjustRemaining', sessionId: 'book', expectedTimingRevision: 0, remainingMinutes: 25 }, 8 * minute)
    expect(readingStage(s.timer.session!.reading!, 1)).toBe('linger')
    const manual = act(s, { type: 'end', sessionId: 'book' }, 28 * minute)
    expect(manual.records[0]?.reading).toMatchObject({ stage: 'linger', archive: 'note' })
    const finished = act(s, { type: 'reconcile' }, 70 * minute)
    expect(finished.records[0]).toMatchObject({ endedAt: 33 * minute, reading: { variant: 'chapter', stage: 'closed', archive: 'page' } })
    const reloaded = decode(finished)
    expect(reloaded.issues).toEqual([])
    expect(start(reloaded.snapshot, 1, 'hat').timer.session?.reading).toMatchObject({ variant: 'hat', bookmark: 'next' })
    const reread = start(reloaded.snapshot, 25, 'return', 75 * minute)
    expect(reread.timer.session?.reading).toMatchObject({ variant: 'reread', bookmark: 'next' })
    const repeated = act(reread, { type: 'reconcile' }, 100 * minute)
    expect(repeated.records).toHaveLength(2)
    expect(repeated.records[1]?.reading).toMatchObject({ variant: 'reread', archive: 'page' })
    expect(readingBookmarkSource(repeated.records)?.sessionId).toBe('book')
    expect(decode(repeated).snapshot).toEqual(repeated)
    expect(act(repeated, { type: 'end', sessionId: 'book' }, 105 * minute).records).toHaveLength(2)
    expect(start(finished, 25, 'provisional', 75 * minute, []).timer.session?.reading?.variant).toBe('chapter')
  })

  it('keeps v11 generic and protects a new generation from the old book', () => {
    const active = start(fresh(), 25)
    const complete = act(active, { type: 'reconcile' }, 25 * minute)
    expect(decode({ ...active, version: 11 }).snapshot.timer.session?.reading).toBeUndefined()
    expect(decode({ ...complete, version: 11 }).snapshot.records[0]?.reading).toBeUndefined()
    const nextSet = { ...fresh(), datasetGeneration: 1 }
    expect(mergeSnapshots(nextSet, complete)).toBe(nextSet)
    expect(decodeSnapshot(encodeSnapshot({ ...complete, version: 13 }), spec, { timeZone: 'UTC' })).toEqual({ kind: 'newer', version: 13 })
  })

  it('rejects contradictory milestone, budget, world, excerpt or phase data and preserves accounting', () => {
    const manual = act(start(fresh(), 25), { type: 'end' }, 15 * minute)
    const r = manual.records[0]!
    for (const problem of [{ archive: 'page' }, { stage: 'closed' }, { variant: 'hat' }, { bookmark: 'next' }, { excerpt: 'not reached' }]) {
      const restored = decode({ ...manual, records: [{ ...r, reading: { ...r.reading, ...problem } }] })
      expect(restored.snapshot.records[0]?.elapsedMs).toBe(15 * minute)
      expect(restored.snapshot.records[0]?.reading).toBeUndefined()
      expect(restored.issues).toContain('record.reading (book)')
    }
    const s = start(fresh(), 25)
    const wrongPhase = decode({ ...s, timer: { ...s.timer, phase: 'shortBreak' } })
    expect(wrongPhase.snapshot.timer.session?.reading).toBeUndefined()
    const absentSource = decode({ ...s, timer: { ...s.timer, session: { ...s.timer.session, reading: { version: 1, variant: 'reread', bookmark: 'next' } } } })
    expect(absentSource.snapshot.timer.session?.reading).toBeUndefined()
    const snapshotWords = decode({ ...manual, records: [{ ...r, reading: { ...r.reading, caption: '保存时的那句话。' } }] })
    expect(snapshotWords.snapshot.records[0]?.reading?.caption).toBe('保存时的那句话。')
  })
})
