import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { dateKeyInZone, localDateKey } from './calendar'

describe('localDateKey', () => {
  const original = process.env.TZ
  beforeAll(() => {
    process.env.TZ = 'America/New_York'
  })
  afterAll(() => {
    process.env.TZ = original
  })

  it('uses the local calendar date around midnight', () => {
    // 23:59 and 00:01 local time on either side of midnight.
    expect(localDateKey(Date.UTC(2026, 9, 29, 3, 59))).toBe('2026-10-28')
    expect(localDateKey(Date.UTC(2026, 9, 29, 4, 1))).toBe('2026-10-29')
  })

  it('keeps one date for the repeated hour when daylight saving ends', () => {
    // 2026-11-01 01:30 happens twice in New York (EDT, then EST).
    expect(localDateKey(Date.UTC(2026, 10, 1, 5, 30))).toBe('2026-11-01')
    expect(localDateKey(Date.UTC(2026, 10, 1, 6, 30))).toBe('2026-11-01')
    expect(localDateKey(Date.UTC(2026, 10, 2, 4, 59))).toBe('2026-11-01')
    expect(localDateKey(Date.UTC(2026, 10, 2, 5, 1))).toBe('2026-11-02')
  })

  it('handles the short day when daylight saving starts', () => {
    expect(localDateKey(Date.UTC(2026, 2, 8, 6, 59))).toBe('2026-03-08') // 01:59 EST
    expect(localDateKey(Date.UTC(2026, 2, 8, 7, 0))).toBe('2026-03-08') // 03:00 EDT
    expect(localDateKey(Date.UTC(2026, 2, 9, 3, 59))).toBe('2026-03-08') // 23:59 EDT
  })
})

describe('dateKeyInZone', () => {
  it('dates an instant in the zone a session started in, regardless of the device zone', () => {
    const instant = Date.UTC(2026, 9, 28, 15, 15) // 00:15 on Oct 29 in Tokyo, 11:15 on Oct 28 in New York
    expect(dateKeyInZone(instant, 'Asia/Tokyo')).toBe('2026-10-29')
    expect(dateKeyInZone(instant, 'America/New_York')).toBe('2026-10-28')
  })

  it('follows daylight saving in the session zone', () => {
    // 2026-03-29 is when Berlin moves to summer time; 23:30 local is 21:30 UTC.
    expect(dateKeyInZone(Date.UTC(2026, 2, 29, 21, 30), 'Europe/Berlin')).toBe('2026-03-29')
    expect(dateKeyInZone(Date.UTC(2026, 2, 29, 22, 30), 'Europe/Berlin')).toBe('2026-03-30')
  })

  it('falls back to the local zone for an unknown zone name', () => {
    const instant = Date.UTC(2026, 9, 28, 12)
    expect(dateKeyInZone(instant, 'Mars/Olympus')).toBe(localDateKey(instant))
  })
})
