import { useMemo } from 'react'
import { localClockTime, localDateKey, localHour, localMinutes } from '../adapters/calendar'
import { spec } from '../data/spec'
import { nextFocusMinutes } from '../logic/app'
import { dayHeading, shortDate } from '../logic/calendar'
import { nightLevel } from '../logic/daylight'
import { recordsBand, type RecordsBand } from '../logic/record-stories'
import { groupEntries, indexByDay, rangeTotals, type DayIndex, type HistoryDay, type RangeLength } from '../logic/stats'
import { isLive } from '../logic/thoughts'
import { isBreak, remainingMs, totalMs } from '../logic/timer'
import type { AppSnapshot, FocusRecord, Phase, Session, Thought } from '../logic/types'

const MINUTE_MS = 60_000

export interface TimerView {
  sessionId: string | null
  /** Whole-minute bounds for a one-off focus length. */
  focusMinutesRange: { min: number; max: number }
  shortBreakMinutes: number
  longBreakMinutes: number
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
  /** The device clock's level of night, 0 in daylight and 1 after dark. */
  night: number
}

export function useTimerView(snapshot: AppSnapshot, now: number): TimerView {
  const { timer, settings } = snapshot
  const next = nextFocusMinutes(snapshot, spec)
  const readyFocus = !timer.session && timer.phase === 'focus'
  const remaining = readyFocus ? next * MINUTE_MS : remainingMs(timer, settings, now)
  const total = readyFocus ? next * MINUTE_MS : totalMs(timer, settings)
  return {
    sessionId: timer.session?.id ?? null,
    focusMinutesRange: spec.timer.durationsMinutes.focus,
    shortBreakMinutes: settings.durationsMinutes.shortBreak,
    longBreakMinutes: settings.durationsMinutes.longBreak,
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
    night: nightLevel(localMinutes(now)),
  }
}

export interface RecordView extends FocusRecord {
  /** Available only when storage confirms this session's record in this dataset. */
  saved: boolean
  /** Main-owned progress for the activity associated with this ended record. */
  sceneProgress: number
  /** Live thoughts captured during this session, oldest first. */
  thoughts: readonly Thought[]
  /** `14:05–14:30` on the device clock; end time only when the start is unknown. */
  timeLabel: string
}

export interface StatsView {
  band: RecordsBand
  todayKey: string
  active: { phase: Phase; status: Session['status']; id: string } | null
  recordBySession: ReadonlyMap<string, RecordView>
  confirmedThoughtIds: ReadonlySet<string>
  pendingThoughtIds: ReadonlySet<string>
  totalsByDay: DayIndex
  historyDays: HistoryDay<RecordView>[]
  thoughtDays: HistoryDay<RecordView>[]
  /** `今天 · 11月1日 周日` and similar, from the stored date key. */
  dayHeading: (key: string) => string
  shortDate: (key: string) => string
  clockTime: (epochMs: number) => string
}

/**
 * The window drives only the summary and trend. History is browsed day by day
 * regardless of the window, so switching 7/30 never hides or reloads entries.
 */
export function useHistoryRange(view: StatsView, length: RangeLength) {
  const totals = useMemo(() => rangeTotals(view.totalsByDay, view.todayKey, length), [view.totalsByDay, view.todayKey, length])
  const history = useMemo(() => ({
    days: view.historyDays.filter(day => day.dateKey <= view.todayKey),
    // Travel may leave a recorded date later than the viewing device's local today.
    later: view.historyDays.filter(day => day.dateKey > view.todayKey),
  }), [view.historyDays, view.todayKey])
  return { totals, ...history }
}

export function useStatsView(snapshot: AppSnapshot, now: number, savedRecordIds: ReadonlySet<string>, durableThoughts: readonly Thought[]): StatsView {
  const todayKey = localDateKey(now)
  const band = recordsBand(localHour(now))
  const index = useMemo(() => indexByDay(snapshot.records.filter(r => savedRecordIds.has(r.sessionId))), [snapshot.records, savedRecordIds])
  const durableById = useMemo(() => new Map(durableThoughts.map(t => [t.id, t])), [durableThoughts])
  const live = useMemo(() => {
    // An unconfirmed edit, status change or deletion never replaces the formal version.
    const values = new Map(durableThoughts.filter(isLive).map(t => [t.id, t]))
    for (const thought of snapshot.thoughts) if (!durableById.has(thought.id) && isLive(thought)) values.set(thought.id, thought)
    return [...values.values()]
  }, [snapshot.thoughts, durableThoughts, durableById])
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
        saved: savedRecordIds.has(r.sessionId),
        sceneProgress: Math.min(1, Math.max(0, r.elapsedMs / Math.max(1, r.targetMs))),
        thoughts: (bySession.get(r.sessionId) ?? []).sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id)),
        timeLabel: r.startedAt === null ? `${localClockTime(r.endedAt)} 结束` : `${localClockTime(r.startedAt)}–${localClockTime(r.endedAt)}`,
      }))
      const thoughtEntries = live.map(thought => ({ kind: 'thought' as const, thought }))
      const confirmedThoughtIds = new Set(durableThoughts.filter(isLive).map(t => t.id))
      const pendingThoughtIds = new Set(snapshot.thoughts.filter(t => {
        const saved = durableById.get(t.id)
        return !saved || saved.rev !== t.rev || saved.text !== t.text || saved.status !== t.status || saved.deletedAt !== t.deletedAt
      }).map(t => t.id))
      return {
        band,
        todayKey,
        confirmedThoughtIds,
        pendingThoughtIds,
        active: snapshot.timer.session && { phase: snapshot.timer.phase, status: snapshot.timer.session.status, id: snapshot.timer.session.id },
        recordBySession: new Map(records.map(record => [record.sessionId, record])),
        totalsByDay: index,
        historyDays: groupEntries<RecordView>([
          ...records.map(record => ({ kind: 'record' as const, record })),
          ...thoughtEntries.filter(entry => entry.thought.sessionId === null),
        ]),
        thoughtDays: groupEntries<RecordView>(thoughtEntries),
        dayHeading: (key: string) => dayHeading(key, todayKey),
        shortDate: (key: string) => shortDate(key, todayKey),
        clockTime: localClockTime,
      }
    },
    [band, index, todayKey, snapshot.records, snapshot.thoughts, snapshot.timer, live, savedRecordIds, durableThoughts, durableById],
  )
}
