import type { DateKey } from './types'

// Civil-date arithmetic on `YYYY-MM-DD` keys. Works on calendar days, never on
// 24-hour offsets, so daylight-saving transitions cannot skip or repeat a day.
// Algorithms from Howard Hinnant, "chrono-Compatible Low-Level Date Algorithms".

const KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0')
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
    return leap ? 29 : 28
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31
}

export function dateKeyFromParts(year: number, month: number, day: number): DateKey {
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`
}

export function isDateKey(value: unknown): value is DateKey {
  if (typeof value !== 'string') return false
  const m = KEY_PATTERN.exec(value)
  if (!m) return false
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month)
}

function parts(key: DateKey): [number, number, number] {
  const m = KEY_PATTERN.exec(key)
  if (!m) throw new RangeError(`Invalid date key: ${key}`)
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

/** Days since 1970-01-01 for a civil date. */
export function toDayNumber(key: DateKey): number {
  const [y0, m, d] = parts(key)
  const y = m <= 2 ? y0 - 1 : y0
  const era = Math.floor(y / 400)
  const yoe = y - era * 400
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy
  return era * 146097 + doe - 719468
}

export function fromDayNumber(dayNumber: number): DateKey {
  const z = dayNumber + 719468
  const era = Math.floor(z / 146097)
  const doe = z - era * 146097
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365)
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100))
  const mp = Math.floor((5 * doy + 2) / 153)
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1
  const m = mp < 10 ? mp + 3 : mp - 9
  const y = yoe + era * 400 + (m <= 2 ? 1 : 0)
  return dateKeyFromParts(y, m, d)
}

export function addDays(key: DateKey, days: number): DateKey {
  return fromDayNumber(toDayNumber(key) + days)
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(key: DateKey): number {
  // 1970-01-01 was a Thursday.
  return (((toDayNumber(key) + 4) % 7) + 7) % 7
}

export function startOfWeek(key: DateKey, weekStartsOn: number): DateKey {
  const offset = (weekday(key) - weekStartsOn + 7) % 7
  return addDays(key, -offset)
}
