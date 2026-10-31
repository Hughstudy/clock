import { useMemo } from 'react'
import { localDateKey, localHour } from '../adapters/calendar'
import { spec } from '../data/spec'
import { nextFocusMinutes } from '../logic/app'
import { recordsBand, recordStoryId, type RecordsBand, type RecordStoryId } from '../logic/record-stories'
import { dayTotal, groupEntries, indexByDay, rangeTotals, type DayIndex, type DayTotal, type HistoryDay, type RangeLength } from '../logic/stats'
import { isLive } from '../logic/thoughts'
import { cycleProgress, isBreak, remainingMs, totalMs, type CycleProgress } from '../logic/timer'
import type { AppSnapshot, FocusRecord, Phase, Session, Thought } from '../logic/types'

const MINUTE_MS = 60_000

export interface TimerView {
  sessionId: string | null
  quickFocusMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
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
  /** Precise elapsed focus proportion, 0 at start, 1 at deadline; pauses retain the value. */
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
    shortBreakMinutes: settings.durationsMinutes.shortBreak,
    longBreakMinutes: settings.durationsMinutes.longBreak,
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
      ? Math.min(1, Math.max(0, 1 - remaining / total)) : 0,
    cycle: cycleProgress(timer, spec.timer.longBreakEvery),
    today: dayTotal(index, localDateKey(now)),
  }
}

export interface RecordView extends FocusRecord {
  /** Available only when storage confirms this session's record in this dataset. */
  storyId: RecordStoryId | null
  /** Live thoughts captured during this session, oldest first. */
  thoughts: readonly Thought[]
}

export interface StatsView {
  band: RecordsBand
  todayKey: string
  active: { phase: Phase; status: Session['status']; id: string } | null
  recordBySession: ReadonlyMap<string, RecordView>
  confirmedThoughtIds: ReadonlySet<string>
  totalsByDay: DayIndex
  historyDays: HistoryDay<RecordView>[]
  thoughtDays: HistoryDay<RecordView>[]
}

export function useHistoryRange(view: StatsView, length: RangeLength) {
  return useMemo(() => {
    const totals = rangeTotals(view.totalsByDay, view.todayKey, length)
    return {
      totals,
      range: view.historyDays.filter(day => day.dateKey >= totals.startKey && day.dateKey <= view.todayKey),
      earlier: view.historyDays.filter(day => day.dateKey < totals.startKey),
      // Travel may leave a recorded date later than the viewing device's local today.
      later: view.historyDays.filter(day => day.dateKey > view.todayKey),
    }
  }, [view.totalsByDay, view.todayKey, view.historyDays, length])
}

export function useStatsView(snapshot: AppSnapshot, now: number, savedRecordIds: ReadonlySet<string>, durableThoughts: readonly Thought[]): StatsView {
  const todayKey = localDateKey(now)
  const band = recordsBand(localHour(now))
  const index = useMemo(() => indexByDay(snapshot.records), [snapshot.records])
  const live = useMemo(() => snapshot.thoughts.filter(isLive), [snapshot.thoughts])
  return useMemo(
    () => {
      const bySession = new Map<string, Thought[]>()
      for (const t of live) {
        if (!t.sessionId) continue
        const linked = bySession.get(t.sessionId)
        if (linked) linked.push(t)
        else bySession.set(t.sessionId, [t])
      }
      const records = snapshot.records.map(r => ({
        ...r,
        storyId: savedRecordIds.has(r.sessionId) ? recordStoryId(r.sessionId) : null,
        thoughts: (bySession.get(r.sessionId) ?? []).sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id)),
      }))
      const thoughtEntries = live.map(thought => ({ kind: 'thought' as const, thought }))
      const durableById = new Map(durableThoughts.map(t => [t.id, t]))
      const confirmedThoughtIds = new Set(live.filter(t => {
        const saved = durableById.get(t.id)
        return saved && saved.rev === t.rev && saved.deletedAt === null && saved.status === t.status &&
          saved.text === t.text && saved.sessionId === t.sessionId && saved.dateKey === t.dateKey && saved.createdAt === t.createdAt
      }).map(t => t.id))
      return {
        band,
        todayKey,
        confirmedThoughtIds,
        active: snapshot.timer.session && { phase: snapshot.timer.phase, status: snapshot.timer.session.status, id: snapshot.timer.session.id },
        recordBySession: new Map(records.map(record => [record.sessionId, record])),
        totalsByDay: index,
        historyDays: groupEntries<RecordView>([
          ...records.map(record => ({ kind: 'record' as const, record })),
          ...thoughtEntries.filter(entry => entry.thought.sessionId === null),
        ]),
        thoughtDays: groupEntries<RecordView>(thoughtEntries),
      }
    },
    [band, index, todayKey, snapshot.records, snapshot.timer, live, savedRecordIds, durableThoughts],
  )
}
