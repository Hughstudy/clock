import type { Phase } from '../logic/types'

export const PHASE_LABELS: Record<Phase, string> = {
  focus: '专注',
  shortBreak: '短休息',
  longBreak: '长休息',
}

/** `mm:ss`, rounding up so a fresh 25-minute session shows 25:00 and the last second shows 00:01. */
export function formatClock(ms: number): string {
  const totalSeconds = Math.ceil(Math.max(0, ms) / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function spokenClock(ms: number): string {
  const totalSeconds = Math.ceil(Math.max(0, ms) / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const parts = []
  if (minutes > 0) parts.push(`${minutes} 分钟`)
  if (seconds > 0 || minutes === 0) parts.push(`${seconds} 秒`)
  return parts.join(' ')
}

/** Sum milliseconds before formatting. Never round a short effort up to a minute. */
export function formatMinutes(ms: number): string {
  if (ms > 0 && ms < 1000) return '不到 1 秒'
  const total = Math.floor(Math.max(0, ms) / 1000)
  const seconds = total % 60
  const minutes = Math.floor(total / 60) % 60
  const hours = Math.floor(total / 3600)
  const parts = []
  if (hours) parts.push(`${hours} 小时`)
  if (minutes) parts.push(`${minutes} 分钟`)
  if (seconds || total === 0) parts.push(`${seconds} 秒`)
  return parts.join(' ')
}

export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}
