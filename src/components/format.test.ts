import { describe, expect, it } from 'vitest'
import { formatClock, formatElapsedClock, formatMinutes, spokenClock } from './format'

describe('formatting', () => {
  it('rounds the countdown up to whole seconds', () => {
    expect(formatClock(25 * 60_000)).toBe('25:00')
    expect(formatClock(1)).toBe('00:01')
    expect(formatClock(0)).toBe('00:00')
    expect(formatClock(120 * 60_000)).toBe('120:00')
  })

  it('speaks and summarizes durations', () => {
    expect(spokenClock(61_000)).toBe('1 分钟 1 秒')
    expect(spokenClock(0)).toBe('0 秒')
    expect(formatMinutes(0)).toBe('0 秒')
    expect(formatMinutes(1)).toBe('不到 1 秒')
    expect(formatMinutes(40_000)).toBe('40 秒')
    expect(formatMinutes(61_999)).toBe('1 分钟 1 秒')
    expect(formatMinutes(45 * 60_000)).toBe('45 分钟')
    expect(formatMinutes(125 * 60_000)).toBe('2 小时 5 分钟')
  })

  it('shows elapsed effort rounded down, like the sentence beside it', () => {
    expect(formatElapsedClock(9_600)).toBe('00:09')
    expect(formatMinutes(9_600)).toBe('9 秒')
    expect(formatElapsedClock(0)).toBe('00:00')
    expect(formatElapsedClock(75 * 60_000 + 999)).toBe('75:00')
  })
})
