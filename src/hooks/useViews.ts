import { useMemo } from 'react'
import { localClockTime, localDateKey, localHour, localMinutes } from '../adapters/calendar'
import { spec } from '../data/spec'
import { nextFocusMinutes, type AppAction } from '../logic/app'
import { dayHeading, shortDate } from '../logic/calendar'
import { nightLevel } from '../logic/daylight'
import { showsHandleHint } from '../logic/focus-chrome'
import { recordsBand, type RecordsBand } from '../logic/record-stories'
import { focusSceneProgress } from '../logic/presentation'
import { groupEntries, indexByDay, rangeTotals, type DayIndex, type HistoryDay, type RangeLength } from '../logic/stats'
import { isLive } from '../logic/thoughts'
import { isBreak, maxRemainingMinutes, remainingMs, sessionScheduleKey, totalMs } from '../logic/timer'
import type { AppSnapshot, FocusRecord, Phase, RestMemory, Session, Thought } from '../logic/types'

const MINUTE_MS = 60_000

export interface TimerView {
  sessionId: string | null
  /** Capture at editor open. Ticking and unrelated writes leave the guard valid. */
  adjustmentGuard: Omit<Required<Extract<AppAction, { type: 'adjustRemaining' }>>, 'type' | 'remainingMinutes'> | null
  maxRemainingMinutes: number
  /** Whole-minute bounds for a one-off focus length. */
  focusMinutesRange: { min: number; max: number }
  shortBreakMinutes: number
  longBreakMinutes: number
  /** What a plain focus start captures: the last one-off choice, else the default. */
  nextFocusMinutes: number
  /** The active session's small step, if one was named. */
  step: string | null
  phase: Phase
  isBreak: boolean
  status: Session['status'] | 'ready'
  remainingMs: number
  totalMs: number
  /** Captured when the session began, also used as the companion's original activity length. */
  initialDurationMs: number
  /** Remaining proportion: full at the start, empty when the session is due. */
  progress: number
  /** Precise progress on the original focus activity. Editing the timer leaves this value in place. */
  completedProgress: number
  /** The device clock's level of night, 0 in daylight and 1 after dark. */
  night: number
  /** The Focus handle still explains itself. */
  handleHint: boolean
}

export function useTimerView(snapshot: AppSnapshot, now: number): TimerView {
  const { timer, settings } = snapshot
  const next = nextFocusMinutes(snapshot, spec)
  const readyFocus = !timer.session && timer.phase === 'focus'
  const remaining = readyFocus ? next * MINUTE_MS : remainingMs(timer, settings, now)
  const total = readyFocus ? next * MINUTE_MS : totalMs(timer, settings)
  const initialDurationMs = timer.session?.initialDurationMs ?? total
  return {
    sessionId: timer.session?.id ?? null,
    adjustmentGuard: timer.session ? { sessionId: timer.session.id, generation: snapshot.datasetGeneration,
      expectedTimingRevision: timer.session.timingRevision ?? 0, expectedSchedule: sessionScheduleKey(timer.session) } : null,
    maxRemainingMinutes: timer.session ? maxRemainingMinutes(total - remaining, spec.timer.durationsMinutes[timer.phase].max) : 0,
    focusMinutesRange: spec.timer.durationsMinutes.focus,
    shortBreakMinutes: settings.durationsMinutes.shortBreak,
    longBreakMinutes: settings.durationsMinutes.longBreak,
    nextFocusMinutes: next,
    step: timer.session?.step ?? null,
    phase: timer.phase,
    isBreak: isBreak(timer.phase),
    status: timer.session?.status ?? 'ready',
    remainingMs: remaining,
    totalMs: total,
    initialDurationMs,
    progress: total > 0 ? remaining / total : 0,
    completedProgress: timer.session && !isBreak(timer.phase) ? focusSceneProgress(total - remaining, initialDurationMs) : 0,
    night: nightLevel(localMinutes(now)),
    handleHint: showsHandleHint(snapshot.participations.length, spec.focusChrome.hintSessions),
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
  /** Confirmed endings, newest first. Focus totals use only focus records. */
  restMemories: readonly RestMemory[]
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

export function useStatsView(snapshot: AppSnapshot, now: number, durableRecords: readonly FocusRecord[], durableThoughts: readonly Thought[], durableRests: readonly RestMemory[]): StatsView {
  const todayKey = localDateKey(now)
  const band = recordsBand(localHour(now))
  const restMemories = useMemo(() => [...durableRests].sort((a, b) =>
    b.endedAt - a.endedAt || a.sessionId.localeCompare(b.sessionId, 'en')), [durableRests])
  const index = useMemo(() => indexByDay(durableRecords), [durableRecords])
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
      // In a competing ending, the saved record owns both elapsed time and the printed story.
      const confirmed = new Map(durableRecords.map(r => [r.sessionId, r]))
      const pendingRecords = snapshot.records.filter(r => !confirmed.has(r.sessionId))
      const records = [...durableRecords, ...pendingRecords].map(r => ({
        ...r,
        saved: confirmed.has(r.sessionId),
        sceneProgress: focusSceneProgress(r.elapsedMs, r.initialDurationMs ?? r.targetMs),
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
        restMemories,
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
    [band, index, todayKey, snapshot.records, snapshot.thoughts, snapshot.timer, live, durableRecords, durableThoughts, durableById, restMemories],
  )
}
