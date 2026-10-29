import { describe, expect, it } from 'vitest'
import { feedbackCatalog } from '../data/encouragement'
import { spec } from '../data/spec'
import { applyAction, type AppAction } from './app'
import { companionPresentation } from './companion'
import { createFeedbackHost, feedbackContext, feedbackFromTransition, interactWithFeedback, updateFeedbackHost, type AppFeedbackEvent, type FeedbackHostInput } from './feedback-host'
import { companionSceneOf } from './presentation'
import { createSnapshot } from './snapshot'
import type { AppSnapshot } from './types'

const T0 = 1_800_000_000_000
function commit(before: AppSnapshot, action: AppAction, now = T0, saved = true, origin: AppFeedbackEvent['origin'] = 'user', operationId = `${action.type}:${now}`) {
  const transition = applyAction(before, action, { now, dateKeyOf: () => '2026-10-29' }, spec)
  const snapshot = { ...transition.snapshot, revision: before.revision + (transition.changed ? 1 : 0) }
  const event = feedbackFromTransition(before, { ...transition, snapshot }, action, { id: operationId, atMs: now, origin }, saved)
  return { snapshot, event }
}
function input(snapshot: AppSnapshot, event: AppFeedbackEvent | null = null, persistence: FeedbackHostInput['persistence'] = 'saved'): FeedbackHostInput {
  return { snapshot, event, persistence, active: true, nodeEncouragement: true }
}
function render(i: FeedbackHostInput) {
  return updateFeedbackHost(createFeedbackHost(i, feedbackCatalog), i, feedbackCatalog)
}
const start = (snapshot = createSnapshot(spec)) => commit(snapshot, { type: 'start', sessionId: 'session', timeZone: 'Asia/Singapore', durationMinutes: 5 })

describe('committed companion event mapping', () => {
  it('maps only real starts and pause/resume changes; stale actions cannot replay cues', () => {
    const running = start()
    expect(running.event.kind).toBe('focus-started')
    const duplicate = commit(running.snapshot, { type: 'start', sessionId: 'other', timeZone: 'Asia/Singapore' }, T0 + 1)
    expect(duplicate.event.kind).toBe('reconcile')
    const paused = commit(running.snapshot, { type: 'pause', sessionId: 'session' }, T0 + 1000)
    expect(paused.event.kind).toBe('paused')
    const stale = commit(paused.snapshot, { type: 'resume', sessionId: 'old-session' }, T0 + 2000)
    expect(stale.event.kind).toBe('reconcile')
    const resumed = commit(paused.snapshot, { type: 'resume', sessionId: 'session' }, T0 + 2000)
    expect(resumed.event.kind).toBe('resumed')
  })

  it.each([0, 1000, 300_000])('treats a %s ms ending with the same friendly settled presentation', (elapsedMs) => {
    const running = start()
    const ended = commit(running.snapshot, { type: 'end', sessionId: 'session' }, T0 + elapsedMs)
    const i = input(ended.snapshot, ended.event)
    expect(ended.event).toMatchObject({ kind: 'focus-ended', elapsedMs })
    expect(feedbackContext(i.snapshot, i.persistence, i.event).participationSaved).toBe(true)
    const frame = render(i).feedback.frame
    expect(frame.encouragement?.pool).toBe(elapsedMs === 0 ? 'ZER' : 'END')
    expect(companionPresentation(frame, { motionEnabled: true, reducedMotion: false })).toMatchObject({ stance: 'settled', cue: 'settle' })
  })

  it('uses the stored deadline and does not count paused time in ending feedback', () => {
    const running = start()
    const paused = commit(running.snapshot, { type: 'pause', sessionId: 'session' }, T0 + 1000)
    const ended = commit(paused.snapshot, { type: 'end', sessionId: 'session' }, T0 + 120_000)
    expect(ended.event).toMatchObject({ kind: 'focus-ended', elapsedMs: 1000, reason: 'manual' })
    const elapsed = commit(running.snapshot, { type: 'end', sessionId: 'session' }, T0 + 400_000)
    expect(elapsed.event).toMatchObject({ kind: 'focus-ended', elapsedMs: 300_000, reason: 'elapsed' })
  })

  it('maps freely started rest, pause, and skipped rest without focus rewards', () => {
    const rest = commit(createSnapshot(spec), { type: 'startBreak', sessionId: 'rest', timeZone: 'Asia/Singapore' })
    expect(rest.event.kind).toBe('break-started')
    const paused = commit(rest.snapshot, { type: 'pause', sessionId: 'rest' }, T0 + 1000)
    const pausedFrame = render(input(paused.snapshot, paused.event)).feedback.frame
    expect(pausedFrame.status.text).toBe('休息已暂停。')
    expect(pausedFrame.encouragement).toBeNull()
    const ended = commit(paused.snapshot, { type: 'skipBreak' }, T0 + 2000)
    expect(ended.event.kind).toBe('break-ended')
    expect(ended.snapshot.records).toHaveLength(0)
  })

  it('prioritizes the new phase when expiry and an explicit rest start occur together', () => {
    const running = start()
    const rest = commit(running.snapshot, { type: 'startBreak', sessionId: 'rest', timeZone: 'Asia/Singapore' }, T0 + 300_000)
    expect(rest.event).toMatchObject({ kind: 'break-started', sessionId: 'rest' })
    expect(rest.snapshot.records).toHaveLength(1)
  })

  it('does not emit success when an ending is only in memory', () => {
    const failed = commit(start().snapshot, { type: 'end', sessionId: 'session' }, T0 + 1000, false)
    expect(failed.event.kind).toBe('reconcile')
    const result = render(input(failed.snapshot, failed.event, 'pending')).feedback
    expect(result.frame.status.kind).toBe('error')
    expect(result.frame.encouragement).toBeNull()
    expect(companionPresentation(result.frame, { motionEnabled: true, reducedMotion: false }).cue).toBeNull()
  })
})

describe('feedback host lifecycle', () => {
  it.each(['restore', 'sync'] as const)('suppresses start/end copy and announcements during %s', (origin) => {
    const running = start()
    const ended = commit(running.snapshot, { type: 'reconcile' }, T0 + 400_000, true, origin)
    const result = render(input(ended.snapshot, ended.event)).feedback
    expect(result.frame.encouragement).toBeNull()
    expect(result.announcement).toBeNull()
  })

  it('retains the same result across countdown renders and consumes an operation once', () => {
    const running = start()
    const i = input(running.snapshot, running.event)
    const first = render(i)
    expect(first.feedback.announcement).not.toBeNull()
    expect(updateFeedbackHost(first, { ...i }, feedbackCatalog)).toBe(first)
    expect(updateFeedbackHost(first, { ...i, snapshot: { ...i.snapshot } }, feedbackCatalog)).toBe(first)
  })

  it('cancels cues on navigation and does not replay them on return', () => {
    const running = start()
    const i = input(running.snapshot, running.event)
    const first = render(i)
    const hidden = updateFeedbackHost(first, { ...i, active: false }, feedbackCatalog)
    expect(hidden.feedback.announcement).toBeNull()
    const returned = updateFeedbackHost(hidden, i, feedbackCatalog)
    expect(returned.feedback.announcement).toBeNull()
    expect(returned.feedback.frame.encouragement?.id).toBe(first.feedback.frame.encouragement?.id)
  })

  it('consumes hidden expiry without replaying a celebration when focus is shown again', () => {
    const running = start()
    const first = render(input(running.snapshot, running.event))
    const ended = commit(running.snapshot, { type: 'reconcile' }, T0 + 300_000, true, 'expiry')
    const i = input(ended.snapshot, ended.event)
    const hidden = updateFeedbackHost(first, { ...i, active: false }, feedbackCatalog)
    expect(hidden.feedback.announcement).toBeNull()
    expect(updateFeedbackHost(hidden, i, feedbackCatalog).feedback.announcement).toBeNull()
  })

  it('clears an old cue immediately while saving, then ignores the old saved event', () => {
    const running = start()
    const i = input(running.snapshot, running.event)
    const first = render(i)
    const pending = updateFeedbackHost(first, { ...i, persistence: 'saving' }, feedbackCatalog)
    expect(pending.feedback.announcement).toBeNull()
    expect(pending.feedback.frame.encouragement).toBeNull()
    const resolved = updateFeedbackHost(pending, i, feedbackCatalog)
    expect(resolved.feedback.announcement).toBeNull()
    expect(resolved.feedback.frame.encouragement).toBeNull()
  })

  it('accepts the saved result of a failed operation once while keeping its original ID', () => {
    const snapshot = createSnapshot(spec)
    const failedEvent: AppFeedbackEvent = { kind: 'reconcile', id: 'retry-operation', atMs: T0, origin: 'user', generation: 0, revision: 0 }
    const failed = render(input(snapshot, failedEvent, 'pending'))
    const saved = commit(snapshot, { type: 'start', sessionId: 'session', timeZone: 'Asia/Singapore' }, T0 + 1000, true, 'user', failedEvent.id)
    const i = input(saved.snapshot, saved.event)
    const result = updateFeedbackHost(failed, i, feedbackCatalog)
    expect(result.feedback.frame.encouragement?.pool).toBe('STA')
    expect(updateFeedbackHost(result, i, feedbackCatalog)).toBe(result)
  })

  it('rejects a stale generation or revision event', () => {
    const running = start()
    for (const snapshot of [{ ...running.snapshot, datasetGeneration: 1 }, { ...running.snapshot, revision: 20 }]) {
      const result = render(input(snapshot, running.event)).feedback
      expect(result.frame.encouragement).toBeNull()
      expect(result.announcement).toBeNull()
    }
  })

  it('allows requested support alongside a real save error and closes without affecting records', () => {
    const running = start()
    const i = input(running.snapshot, running.event, 'pending')
    const initial = render(i)
    const request = { kind: 'encouragement-requested' as const, id: 'ask-1', atMs: T0, origin: 'user' as const }
    const support = interactWithFeedback(initial, i, request, feedbackCatalog)
    expect(support.feedback.frame.status.kind).toBe('error')
    expect(support.feedback.frame.encouragement?.pool).toBe('ASKG')
    expect(companionPresentation(support.feedback.frame, { reducedMotion: false, motionEnabled: true }).cue).toBeNull()
    const closed = interactWithFeedback(support, i, { ...request, kind: 'dismissed', id: 'close' }, feedbackCatalog)
    expect(closed.feedback.frame.encouragement).toBeNull()
    expect(closed.feedback.announcement).toBeNull()
    expect(i.snapshot).toEqual(running.snapshot)
  })

  it('keeps explicit encouragement available when node copy is disabled', () => {
    const running = start()
    const i = { ...input(running.snapshot, running.event), nodeEncouragement: false }
    const initial = render(i)
    expect(initial.feedback.frame.encouragement).toBeNull()
    const requested = interactWithFeedback(initial, i, { kind: 'encouragement-requested', id: 'ask', atMs: T0, origin: 'user' }, feedbackCatalog)
    expect(requested.feedback.frame.encouragement?.pool).toBe('ASKG')
  })

  it.each([0, 1, 1000])('keeps a fresh scene entrance and %s ms ending when node copy is disabled', elapsedMs => {
    const running = start()
    const i = { ...input(running.snapshot, running.event), nodeEncouragement: false }
    const first = render(i)
    expect(first.feedback.frame.encouragement).toBeNull()
    expect(first.cue).toMatchObject({ kind: 'begin', sessionId: 'session' })
    const ended = commit(running.snapshot, { type: 'end', sessionId: 'session' }, T0 + elapsedMs)
    const endingInput = { ...input(ended.snapshot, ended.event), nodeEncouragement: false }
    const settled = updateFeedbackHost(first, endingInput, feedbackCatalog)
    expect(settled.feedback.frame.encouragement).toBeNull()
    expect(settled.cue).toMatchObject({ kind: 'settle', sessionId: 'session' })
    expect(companionSceneOf(ended.snapshot, settled.cue, {
      completedProgress: 0, visible: true, persistence: 'saved', hasError: false,
    })?.ending).toEqual({ cueId: settled.cue!.id, tier: 'hello' })
    expect(updateFeedbackHost(settled, endingInput, feedbackCatalog)).toBe(settled)
    const hidden = updateFeedbackHost(settled, { ...endingInput, active: false }, feedbackCatalog)
    expect(hidden.cue).toBeNull()
    expect(updateFeedbackHost(hidden, endingInput, feedbackCatalog).cue).toBeNull()
    const noOp = commit(ended.snapshot, { type: 'end', sessionId: 'session' }, T0 + elapsedMs + 1)
    expect(render({ ...input(noOp.snapshot, noOp.event), nodeEncouragement: false }).cue).toBeNull()
    expect(render({ ...endingInput, snapshot: { ...ended.snapshot, revision: ended.snapshot.revision + 1 } }).cue).toBeNull()
  })

  it('keeps rest entrance and untiered ending when node copy is disabled', () => {
    const rest = commit(createSnapshot(spec), { type: 'startBreak', sessionId: 'rest', timeZone: 'Asia/Singapore' })
    const first = render({ ...input(rest.snapshot, rest.event), nodeEncouragement: false })
    expect(first.feedback.frame.encouragement).toBeNull()
    expect(first.cue).toMatchObject({ kind: 'rest', sessionId: 'rest' })
    const ended = commit(rest.snapshot, { type: 'end', sessionId: 'rest' }, T0)
    const settled = updateFeedbackHost(first, { ...input(ended.snapshot, ended.event), nodeEncouragement: false }, feedbackCatalog)
    expect(settled.cue).toMatchObject({ kind: 'settle', sessionId: 'rest' })
    expect(companionSceneOf(ended.snapshot, settled.cue, {
      completedProgress: 0, visible: true, persistence: 'saved', hasError: false,
    })?.ending).toEqual({ cueId: settled.cue!.id, tier: null })
  })
})
