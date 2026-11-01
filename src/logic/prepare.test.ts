import { describe, expect, it } from 'vitest'
import { keepsDurationChoice, validateDurationDraft } from './prepare'

describe('duration choice intent order', () => {
  it('keeps a pick made after a default change was requested, even when that save lands later', () => {
    // Default change requested (intent 1), then 15 picked while the save is still in flight.
    expect(keepsDurationChoice({ minutes: 15, intent: 1 }, 1)).toBe(true)
  })

  it('drops a pick once a later default change is requested', () => {
    expect(keepsDurationChoice({ minutes: 15, intent: 0 }, 1)).toBe(false)
  })

  it('has nothing to keep without a pick', () => {
    expect(keepsDurationChoice(null, 0)).toBe(false)
  })
})

describe('custom duration drafts', () => {
  it('accepts whole minutes within the bounds', () => {
    expect(validateDurationDraft(' 40 ', 1, 120)).toEqual({ ok: true, minutes: 40 })
    expect(validateDurationDraft('1', 1, 120)).toEqual({ ok: true, minutes: 1 })
    expect(validateDurationDraft('120', 1, 120)).toEqual({ ok: true, minutes: 120 })
  })

  it('keeps invalid drafts invalid instead of coercing them', () => {
    expect(validateDurationDraft('', 1, 120)).toEqual({ ok: false, reason: 'empty' })
    expect(validateDurationDraft('2.5', 1, 120)).toEqual({ ok: false, reason: 'notInteger' })
    expect(validateDurationDraft('-3', 1, 120)).toEqual({ ok: false, reason: 'notInteger' })
    expect(validateDurationDraft('0', 1, 120)).toEqual({ ok: false, reason: 'range' })
    expect(validateDurationDraft('121', 1, 120)).toEqual({ ok: false, reason: 'range' })
  })
})
