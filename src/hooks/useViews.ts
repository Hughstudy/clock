import { useMemo } from 'react'
import { localDateKey } from '../adapters/calendar'
import { spec } from '../data/spec'
import { dayTotal, indexByDay, weekTotals, type DayTotal, type WeekTotals } from '../logic/stats'
import { currentStreak, type Streak } from '../logic/streak'
import { cycleProgress, isBreak, remainingMs, totalMs, type CycleProgress } from '../logic/timer'
import type { AppSnapshot, Phase, Session } from '../logic/types'

export interface TimerView {
  phase: Phase
  isBreak: boolean
  status: Session['status'] | 'ready'
  remainingMs: number
  totalMs: number
  /** 0 at the start of a session, 1 when it is due. */
  progress: number
  cycle: CycleProgress
  today: DayTotal
}

export function useTimerView(snapshot: AppSnapshot, now: number): TimerView {
  const { timer, settings, completions } = snapshot
  const index = useMemo(() => indexByDay(completions), [completions])
  const remaining = remainingMs(timer, settings, now)
  const total = totalMs(timer, settings)
  return {
    phase: timer.phase,
    isBreak: isBreak(timer.phase),
    status: timer.session?.status ?? 'ready',
    remainingMs: remaining,
    totalMs: total,
    progress: total > 0 ? 1 - remaining / total : 0,
    cycle: cycleProgress(timer, spec.timer.longBreakEvery),
    today: dayTotal(index, localDateKey(now)),
  }
}

export interface StatsView {
  todayKey: string
  /** Bowls of rice served overall: one per completed focus session. */
  totalRice: number
  /** Weekday (0 = Sunday) that starts the calendar week. */
  firstWeekday: number
  today: DayTotal
  week: WeekTotals
  streak: Streak
}

export function useStatsView(snapshot: AppSnapshot, now: number): StatsView {
  const todayKey = localDateKey(now)
  const index = useMemo(() => indexByDay(snapshot.completions), [snapshot.completions])
  return useMemo(
    () => ({
      todayKey,
      totalRice: snapshot.completions.length,
      firstWeekday: spec.calendar.weekStartsOn,
      today: dayTotal(index, todayKey),
      week: weekTotals(index, todayKey, spec.calendar.weekStartsOn),
      streak: currentStreak(index, todayKey),
    }),
    [index, todayKey, snapshot.completions.length],
  )
}
