import { addDays } from './calendar'
import type { DayIndex } from './stats'
import type { DateKey } from './types'

export interface Streak {
  days: number
  /** False while today has no completion yet but yesterday's streak is still alive. */
  includesToday: boolean
}

/**
 * Consecutive qualifying days ending today, or ending yesterday while today is
 * still in progress. Only a fully missed calendar day breaks the streak.
 */
export function currentStreak(index: DayIndex, todayKey: DateKey): Streak {
  const qualifies = (key: DateKey) => (index.get(key)?.count ?? 0) > 0
  const includesToday = qualifies(todayKey)
  let key = includesToday ? todayKey : addDays(todayKey, -1)
  let days = 0
  while (qualifies(key)) {
    days += 1
    key = addDays(key, -1)
  }
  return { days, includesToday }
}
