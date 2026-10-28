import { describe, expect, it } from 'vitest'
import { formatClock, formatMinutes, spokenClock } from './format'

describe('formatting', () => {
  it('rounds the countdown up to whole seconds', () => {
    expect(formatClock(25 * 60_000)).toBe('25:00')
    expect(formatClock(1)).toBe('00:01')
    expect(formatClock(0)).toBe('00:00')
    expect(formatClock(120 * 60_000)).toBe('120:00')
  })

  it('speaks and summarizes durations', () => {
    expect(spokenClock(61_000)).toBe('1 minute 1 second')
    expect(spokenClock(0)).toBe('0 seconds')
    expect(formatMinutes(45 * 60_000)).toBe('45 min')
    expect(formatMinutes(125 * 60_000)).toBe('2 h 5 min')
  })
})
