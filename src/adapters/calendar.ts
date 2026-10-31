import { dateKeyFromParts } from '../logic/calendar'
import type { DateKey } from '../logic/types'

export function nowMs(): number {
  return Date.now()
}

export function localHour(epochMs: number): number {
  return new Date(epochMs).getHours()
}

/** The local calendar date of an instant, in the device's current time zone. */
export function localDateKey(epochMs: number): DateKey {
  const d = new Date(epochMs)
  return dateKeyFromParts(d.getFullYear(), d.getMonth() + 1, d.getDate())
}

/** IANA zone the device uses now, e.g. `Europe/Berlin`; captured when a session starts. */
export function currentTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

const formatters = new Map<string, Intl.DateTimeFormat | null>()

function formatterFor(timeZone: string): Intl.DateTimeFormat | null {
  if (!formatters.has(timeZone)) {
    try {
      formatters.set(
        timeZone,
        new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric' }),
      )
    } catch {
      // Unknown zone (e.g. from another engine); fall back to the local zone.
      formatters.set(timeZone, null)
    }
  }
  return formatters.get(timeZone) ?? null
}

/** The calendar date of an instant in `timeZone`, falling back to the local zone if it is unknown. */
export function dateKeyInZone(epochMs: number, timeZone: string): DateKey {
  const formatter = formatterFor(timeZone)
  if (!formatter) return localDateKey(epochMs)
  const parts = Object.fromEntries(formatter.formatToParts(epochMs).map((p) => [p.type, p.value]))
  return dateKeyFromParts(Number(parts.year), Number(parts.month), Number(parts.day))
}
