import { describe, expect, it } from 'vitest'
import { formatClock, formatElapsedParts, formatMinutes, spokenClock } from './format'

describe('formatting', () => {
  it('reads a finished session as a result, rounding down and never like a fresh timer', () => {
    const text = (ms: number) => formatElapsedParts(ms).map(p => `${p.value} ${p.unit}`).join(' ')
    expect(text(25 * 60_000)).toBe('25 分钟')
    expect(text(3 * 60_000 + 12_999)).toBe('3 分 12 秒')
    expect(text(40_000)).toBe('40 秒')
    expect(text(0)).toBe('0 秒')
    expect(text(400)).toBe('不到 1 秒')
    expect(text(65 * 60_000 + 59_000)).toBe('1 小时 5 分')
    expect(text(120 * 60_000)).toBe('2 小时')
  })

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
    expect(formatElapsedParts(9_600)).toEqual([{ value: '9', unit: '秒' }])
    expect(formatMinutes(9_600)).toBe('9 秒')
    expect(formatElapsedParts(75 * 60_000 + 999)).toEqual([{ value: '1', unit: '小时' }, { value: '15', unit: '分' }])
  })
})
