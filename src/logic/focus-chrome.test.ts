import { describe, expect, it } from 'vitest'
import { focusChromeDelay, showsHandleHint, type FocusChromeInput } from './focus-chrome'

const base: FocusChromeInput = { running: true, held: false, visibleUntil: 5_000, nowMs: 1_000 }

describe('focusChromeDelay', () => {
  it('waits out the remaining time on a running countdown', () => {
    expect(focusChromeDelay(base)).toBe(4_000)
  })

  it('never returns a negative wait once the time has passed', () => {
    expect(focusChromeDelay({ ...base, nowMs: 9_000 })).toBe(0)
  })

  it('keeps the card while no countdown is running', () => {
    expect(focusChromeDelay({ ...base, running: false, nowMs: 9_000 })).toBeNull()
  })

  it('keeps the card while something still needs it, however long ago it was touched', () => {
    expect(focusChromeDelay({ ...base, held: true, nowMs: 9_000 })).toBeNull()
  })
})

describe('showsHandleHint', () => {
  it.each([
    [1, true],
    [3, true],
    [4, false],
  ])('with %i sessions started out of three', (participations, shown) => {
    expect(showsHandleHint(participations, 3)).toBe(shown)
  })
})
