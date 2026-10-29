import { useMemo } from 'react'
import { localDateKey } from '../adapters/calendar'
import { spec } from '../data/spec'
import { nextFocusMinutes } from '../logic/app'
import { dayTotal, indexByDay, weekTotals, type DayTotal, type WeekTotals } from '../logic/stats'
import { isLive } from '../logic/thoughts'
import { cycleProgress, isBreak, remainingMs, totalMs, type CycleProgress } from '../logic/timer'
import type { AppSnapshot, FocusRecord, Phase, Session, Thought } from '../logic/types'

const MINUTE_MS = 60_000

export interface TimerView {
  sessionId: string | null
  quickFocusMinutes: number
  /** One-off lengths offered on demand. */
  quickChoicesMinutes: readonly number[]
  /** What a plain focus start captures: the last one-off choice, else the default. */
  nextFocusMinutes: number
  stepMaxLength: number
  /** The active session's small step, if one was named. */
  step: string | null
  phase: Phase
  isBreak: boolean
  status: Session['status'] | 'ready'
  remainingMs: number
  totalMs: number
  /** Remaining proportion: full at the start, empty when the session is due. */
  progress: number
  /** Elapsed focus proportion, 0 at start, 1 at deadline; pauses retain the value. */
  completedProgress: number
  cycle: CycleProgress
  today: DayTotal
}

export function useTimerView(snapshot: AppSnapshot, now: number): TimerView {
  const { timer, settings, records } = snapshot
  const index = useMemo(() => indexByDay(records), [records])
  const next = nextFocusMinutes(snapshot, spec)
  const readyFocus = !timer.session && timer.phase === 'focus'
  const remaining = readyFocus ? next * MINUTE_MS : remainingMs(timer, settings, now)
  const total = readyFocus ? next * MINUTE_MS : totalMs(timer, settings)
  return {
    sessionId: timer.session?.id ?? null,
    quickFocusMinutes: spec.timer.quickFocusMinutes,
    quickChoicesMinutes: spec.timer.quickChoicesMinutes,
    nextFocusMinutes: next,
    stepMaxLength: spec.timer.stepMaxLength,
    step: timer.session?.step ?? null,
    phase: timer.phase,
    isBreak: isBreak(timer.phase),
    status: timer.session?.status ?? 'ready',
    remainingMs: remaining,
    totalMs: total,
    progress: total > 0 ? remaining / total : 0,
    completedProgress: timer.session && !isBreak(timer.phase) && total > 0
      ? Math.floor(Math.min(1, Math.max(0, 1 - remaining / total)) * 100) / 100 : 0,
    cycle: cycleProgress(timer, spec.timer.longBreakEvery),
    today: dayTotal(index, localDateKey(now)),
  }
}

export interface RecordView extends FocusRecord {
  /** Live thoughts captured during this session, oldest first. */
  thoughts: readonly Thought[]
}

export interface StatsView {
  todayKey: string
  /** Started focus sessions, including the current one. */
  participationCount: number
  records: readonly RecordView[]
  /** All live thoughts, newest first; never limited by a history date range. */
  thoughts: readonly Thought[]
  /** Weekday (0 = Sunday) that starts the calendar week. */
  firstWeekday: number
  today: DayTotal
  week: WeekTotals
}

export function useStatsView(snapshot: AppSnapshot, now: number): StatsView {
  const todayKey = localDateKey(now)
  const index = useMemo(() => indexByDay(snapshot.records), [snapshot.records])
  const live = useMemo(() => snapshot.thoughts.filter(isLive), [snapshot.thoughts])
  return useMemo(
    () => {
      const bySession = new Map<string, Thought[]>()
      for (const t of live) if (t.sessionId) bySession.set(t.sessionId, [...(bySession.get(t.sessionId) ?? []), t])
      return {
        todayKey,
        participationCount: snapshot.participations.length,
        records: [...snapshot.records].sort((a, b) => b.endedAt - a.endedAt).map((r) => ({ ...r, thoughts: bySession.get(r.sessionId) ?? [] })),
        thoughts: [...live].reverse(),
        firstWeekday: spec.calendar.weekStartsOn,
        today: dayTotal(index, todayKey),
        week: weekTotals(index, todayKey, spec.calendar.weekStartsOn),
      }
    },
    [index, todayKey, snapshot.records, snapshot.participations.length, live],
  )
}
