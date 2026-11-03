import { describe, expect, it } from 'vitest'
import { boundDialTravel, keepsDurationChoice, minuteAtDialAngle, validateDurationDraft } from './prepare'

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

describe('minuteAtDialAngle', () => {
  const at = (minute: number) => minute * Math.PI / 30
  it('reads the minute under the finger on the first lap', () => {
    expect(minuteAtDialAngle(at(45), 25, 1, 120)).toBe(45)
    expect(minuteAtDialAngle(at(-15), 25, 1, 120)).toBe(45)
    expect(minuteAtDialAngle(at(1), 25, 1, 120)).toBe(1)
  })
  it('treats twelve as the end of a lap', () => {
    expect(minuteAtDialAngle(0, 25, 1, 120)).toBe(60)
    expect(minuteAtDialAngle(0, 90, 1, 120)).toBe(120)
    expect(minuteAtDialAngle(at(59.8), 25, 1, 120)).toBe(60)
  })
  it('stays on the lap the current value is on', () => {
    expect(minuteAtDialAngle(at(15), 60, 1, 120)).toBe(15)
    expect(minuteAtDialAngle(at(15), 61, 1, 120)).toBe(75)
    expect(minuteAtDialAngle(at(15), 120, 1, 120)).toBe(75)
  })
  it('respects the bounds', () => {
    expect(minuteAtDialAngle(at(1), 25, 5, 120)).toBe(5)
    expect(minuteAtDialAngle(0, 25, 1, 45)).toBe(45)
  })
})

describe('boundDialTravel', () => {
  it('keeps travel within a lap of the ends without changing where it points', () => {
    expect(boundDialTravel(-10, 1, 120)).toBe(-10)
    expect(boundDialTravel(-59.5, 1, 120)).toBe(0.5)
    expect(boundDialTravel(181, 1, 120)).toBe(121)
    expect(boundDialTravel(40, 1, 120)).toBe(40)
  })
})
