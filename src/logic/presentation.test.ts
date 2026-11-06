import { describe, expect, it } from 'vitest'
import { spec } from '../data/spec'
import { applyAction, type AppAction } from './app'
import { companionSceneOf, type PresentationCue } from './presentation'
import { createSnapshot } from './snapshot'
import type { AppSnapshot } from './types'

const options = { completedProgress: 0, visible: true, persistence: 'saved' as const, hasError: false }
const act = (snapshot: AppSnapshot, action: AppAction, now = 0) => applyAction(snapshot, action, { now, dateKeyOf: () => '2026-10-29' }, spec).snapshot
const start = () => act(createSnapshot(spec), { type: 'start', sessionId: 'focus-one', timeZone: 'UTC', durationMinutes: 60 })
const cue = (kind: PresentationCue['kind'], sessionId = 'focus-one'): PresentationCue => ({ id: `cue:${sessionId}:${kind}`, kind, sessionId, thoughtId: null })

describe('C2-P4 readonly scene projection', () => {
  it('keeps assignment identity stable while clamping without quantizing completed progress', () => {
    const snapshot = start()
    const first = companionSceneOf(snapshot, cue('begin'), options)!
    const next = companionSceneOf(snapshot, null, { ...options, completedProgress: 0.457 })!
    expect(next.key).toBe(first.key)
    expect(next.id).toBe(first.id)
    expect(next.completedProgress).toBe(0.457)
    expect(next.cue).toBeNull()
    expect(companionSceneOf(snapshot, null, { ...options, completedProgress: -1 })?.completedProgress).toBe(0)
    expect(companionSceneOf(snapshot, null, { ...options, completedProgress: 2 })?.completedProgress).toBe(1)
    expect(companionSceneOf(snapshot, null, { ...options, completedProgress: NaN })?.completedProgress).toBe(0)
  })

  it('suppresses stale session cues and cancels motion on error or hidden navigation', () => {
    const snapshot = start()
    expect(companionSceneOf(snapshot, cue('begin', 'older-session'), options)?.cue).toBeNull()
    for (const blocked of [{ ...options, visible: false }, { ...options, hasError: true }]) {
      expect(companionSceneOf(snapshot, cue('begin'), blocked)).toMatchObject({ allowBeats: false, cue: null, ending: null })
    }
  })

  it('uses only the matching saved record for an ending, never a pending or fabricated result', () => {
    const ended = act(start(), { type: 'end', sessionId: 'focus-one' }, 61_000)
    const input = { ...ended, scenes: { ...ended.scenes, lastEnded: { ...ended.scenes.lastEnded!, elapsedMs: 99_000_000 } } }
    expect(companionSceneOf(input, cue('settle'), options)).toMatchObject({ status: 'ended', completedProgress: 61_000 / 3_600_000, ending: { tier: 'snack', cueId: cue('settle').id } })
    expect(companionSceneOf(input, cue('settle', 'other'), options)).toBeNull()
    expect(companionSceneOf(input, cue('settle'), { ...options, persistence: 'pending' })).toBeNull()
    expect(companionSceneOf(input, null, options)).toBeNull()
    expect(companionSceneOf({ ...input, records: [] }, cue('settle'), options)).toBeNull()
  })

  it('keeps a shown saved ending after later cues, without replaying or claiming an unsaved one', () => {
    const ended = act(start(), { type: 'end', sessionId: 'focus-one' }, 61_000)
    const settle = cue('settle')
    const shown = { sessionId: 'focus-one', saved: true, cue: settle }
    const played = companionSceneOf(ended, settle, options)!
    // A mark or encouragement replaces the cue; the finished activity keeps its identity.
    const afterMark = companionSceneOf(ended, cue('thought-saved'), { ...options, shownEnding: shown })!
    expect(afterMark).toMatchObject({ key: played.key, status: 'ended', cue: settle, ending: played.ending })
    // While that tap is still saving, the shown result does not flicker away.
    expect(companionSceneOf(ended, settle, { ...options, persistence: 'saving', shownEnding: shown })).toMatchObject({ status: 'ended', cue: settle })
    // A result shown after a reload has no cue to play: the final frame stays still.
    expect(companionSceneOf(ended, null, { ...options, shownEnding: { ...shown, cue: null } }))
      .toMatchObject({ status: 'ended', cue: null, ending: { cueId: 'ending:focus-one', tier: 'snack' } })
    expect(companionSceneOf(ended, null, { ...options, shownEnding: { ...shown, saved: false } })).toBeNull()
    expect(companionSceneOf(ended, null, { ...options, shownEnding: { ...shown, sessionId: 'other' } })).toBeNull()
    expect(companionSceneOf(ended, null, { ...options, visible: false, shownEnding: shown })).toBeNull()
  })

  it('lets a new session replace an old ending even if the old cue arrives late', () => {
    const ended = act(start(), { type: 'end', sessionId: 'focus-one' }, 61_000)
    const next = act(ended, { type: 'start', sessionId: 'focus-two', timeZone: 'UTC' }, 62_000)
    expect(companionSceneOf(next, cue('settle'), options)).toMatchObject({ sessionId: 'focus-two', status: 'running', cue: null, ending: null })
  })

  it('changes generation identity and respects hidden scene preferences without changing the model', () => {
    const snapshot = start()
    const original = structuredClone(snapshot)
    const first = companionSceneOf(snapshot, null, options)!
    const replaced = companionSceneOf({ ...snapshot, datasetGeneration: snapshot.datasetGeneration + 1 }, null, options)!
    expect(replaced.key).not.toBe(first.key)
    expect(companionSceneOf({ ...snapshot, settings: { ...snapshot.settings, sceneVarietyEnabled: false } }, null, options)).toBeNull()
    expect(snapshot).toEqual(original)
  })
})
