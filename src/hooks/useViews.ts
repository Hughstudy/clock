import { useMemo } from 'react'
import { localDateKey } from '../adapters/calendar'
import { spec } from '../data/spec'
import { dayTotal, indexByDay, weekTotals, type DayTotal, type WeekTotals } from '../logic/stats'
import { cycleProgress, isBreak, remainingMs, totalMs, type CycleProgress } from '../logic/timer'
import type { AppSnapshot, FocusRecord, Phase, Session } from '../logic/types'

export interface TimerView {
  sessionId: string | null
  quickFocusMinutes: number
  phase: Phase
  isBreak: boolean
  status: Session['status'] | 'ready'
  remainingMs: number
  totalMs: number
  /** Remaining proportion: full at the start, empty when the session is due. */
  progress: number
  cycle: CycleProgress
  today: DayTotal
}

export function useTimerView(snapshot: AppSnapshot, now: number): TimerView {
  const { timer, settings, records } = snapshot
  const index = useMemo(() => indexByDay(records), [records])
  const remaining = remainingMs(timer, settings, now)
  const total = totalMs(timer, settings)
  return {
    sessionId: timer.session?.id ?? null,
    quickFocusMinutes: spec.timer.quickFocusMinutes,
    phase: timer.phase,
    isBreak: isBreak(timer.phase),
    status: timer.session?.status ?? 'ready',
    remainingMs: remaining,
    totalMs: total,
    progress: total > 0 ? remaining / total : 0,
    cycle: cycleProgress(timer, spec.timer.longBreakEvery),
    today: dayTotal(index, localDateKey(now)),
  }
}

export interface StatsView {
  todayKey: string
  /** Started focus sessions, including the current one. */
  participationCount: number
  records: readonly FocusRecord[]
  /** Weekday (0 = Sunday) that starts the calendar week. */
  firstWeekday: number
  today: DayTotal
  week: WeekTotals
}

export function useStatsView(snapshot: AppSnapshot, now: number): StatsView {
  const todayKey = localDateKey(now)
  const index = useMemo(() => indexByDay(snapshot.records), [snapshot.records])
  return useMemo(
    () => ({
      todayKey,
      participationCount: snapshot.participations.length,
      records: [...snapshot.records].sort((a, b) => b.endedAt - a.endedAt),
      firstWeekday: spec.calendar.weekStartsOn,
      today: dayTotal(index, todayKey),
      week: weekTotals(index, todayKey, spec.calendar.weekStartsOn),
    }),
    [index, todayKey, snapshot.records, snapshot.participations.length],
  )
}
