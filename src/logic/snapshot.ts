import { isDateKey } from './calendar'
import { defaultSettings, sanitizeSettings } from './settings'
import type { Spec } from './spec'
import { initialTimer } from './timer'
import { PHASES, type AppSnapshot, type CompletionRecord, type Phase, type Session, type TimerState } from './types'

export const SNAPSHOT_VERSION = 2

export function createSnapshot(spec: Spec): AppSnapshot {
  return {
    version: SNAPSHOT_VERSION,
    revision: 0,
    writer: '',
    settings: defaultSettings(spec),
    timer: initialTimer(),
    completions: [],
  }
}

/** Facts a migration may need but cannot compute purely, supplied by the storage adapter. */
export interface MigrationContext {
  /** The device's current IANA zone, used where older data recorded none. */
  timeZone: string
}

/** Upgrades a stored object from version N to N + 1. */
export type Migration = (old: Record<string, unknown>, context: MigrationContext) => Record<string, unknown>

/** Keyed by the version each migration upgrades from. */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {
  // v2 records the time zone a session started in. Older sessions get the current zone.
  1: (old, { timeZone }) => {
    const timer = isRecord(old.timer) ? old.timer : null
    const session = timer && isRecord(timer.session) ? timer.session : null
    if (!timer || !session || session.timeZone !== undefined) return { ...old, version: 2 }
    return { ...old, version: 2, timer: { ...timer, session: { ...session, timeZone } } }
  },
}

export type Decoded =
  /** `issues` lists fields that were invalid and replaced; empty means intact. */
  | { kind: 'ok'; snapshot: AppSnapshot; issues: string[] }
  | { kind: 'unreadable'; reason: string }
  /** Written by a newer app version; must not be overwritten by this one. */
  | { kind: 'newer'; version: number }

type Json = Record<string, unknown>

function isRecord(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function isPositiveMs(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function isInstant(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function isId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 128
}

function isTimeZone(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 64
}

function readSession(raw: unknown): Session | null {
  if (!isRecord(raw) || !isId(raw.id) || !isPositiveMs(raw.durationMs) || !isTimeZone(raw.timeZone)) return null
  const { id, durationMs, timeZone } = raw
  if (raw.status === 'running' && isInstant(raw.deadline)) {
    return { status: 'running', id, durationMs, deadline: raw.deadline, timeZone }
  }
  if (raw.status === 'paused' && isInstant(raw.remainingMs) && raw.remainingMs <= durationMs) {
    return { status: 'paused', id, durationMs, remainingMs: raw.remainingMs, timeZone }
  }
  return null
}

function readTimer(raw: unknown, completionCount: number, issues: string[]): TimerState {
  if (!isRecord(raw)) {
    issues.push('timer')
    return { ...initialTimer(), completedFocusCount: completionCount }
  }
  let phase: Phase = 'focus'
  if (PHASES.includes(raw.phase as Phase)) phase = raw.phase as Phase
  else issues.push('timer.phase')

  let session: Session | null = null
  if (raw.session !== null) {
    session = readSession(raw.session)
    if (!session) issues.push('timer.session')
  }

  let completedFocusCount = completionCount
  if (isCount(raw.completedFocusCount)) completedFocusCount = raw.completedFocusCount
  else issues.push('timer.completedFocusCount')

  return { phase, session, completedFocusCount }
}

function readCompletions(raw: unknown, issues: string[]): CompletionRecord[] {
  if (!Array.isArray(raw)) {
    issues.push('completions')
    return []
  }
  const seen = new Set<string>()
  const records: CompletionRecord[] = []
  let dropped = 0
  for (const item of raw) {
    if (
      isRecord(item) &&
      isId(item.sessionId) &&
      isInstant(item.completedAt) &&
      isDateKey(item.dateKey) &&
      isPositiveMs(item.focusMs) &&
      !seen.has(item.sessionId)
    ) {
      seen.add(item.sessionId)
      records.push({
        sessionId: item.sessionId,
        completedAt: item.completedAt,
        dateKey: item.dateKey,
        focusMs: item.focusMs,
      })
    } else {
      dropped += 1
    }
  }
  if (dropped > 0) issues.push(`completions (${dropped} unreadable)`)
  return records
}

/** Applies each migration step in order; null when a step is missing. */
export function runMigrations(
  data: Json,
  from: number,
  to: number,
  migrations: Readonly<Record<number, Migration>>,
  context: MigrationContext,
): Json | null {
  let current = data
  for (let v = from; v < to; v += 1) {
    const migrate = migrations[v]
    if (!migrate) return null
    current = migrate(current, context)
  }
  return current
}

/**
 * Validates stored data, migrating supported older versions. Invalid fields
 * are replaced individually so that recoverable progress survives.
 */
export function decodeSnapshot(
  text: string,
  spec: Spec,
  context: MigrationContext,
  migrations: Readonly<Record<number, Migration>> = MIGRATIONS,
): Decoded {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { kind: 'unreadable', reason: 'Saved data is not valid JSON.' }
  }
  if (!isRecord(raw) || !isCount(raw.version) || raw.version < 1) {
    return { kind: 'unreadable', reason: 'Saved data has no recognizable version.' }
  }
  if (raw.version > SNAPSHOT_VERSION) return { kind: 'newer', version: raw.version }

  const data = runMigrations(raw, raw.version, SNAPSHOT_VERSION, migrations, context)
  if (!data) return { kind: 'unreadable', reason: `No upgrade path from saved version ${raw.version}.` }

  const issues: string[] = []
  const completions = readCompletions(data.completions, issues)
  const { settings, issues: settingIssues } = sanitizeSettings(data.settings, spec)
  issues.push(...settingIssues)
  const timer = readTimer(data.timer, completions.length, issues)

  return {
    kind: 'ok',
    snapshot: {
      version: SNAPSHOT_VERSION,
      revision: isCount(data.revision) ? data.revision : 0,
      writer: typeof data.writer === 'string' ? data.writer : '',
      settings,
      timer,
      completions,
    },
    issues,
  }
}

export function encodeSnapshot(snapshot: AppSnapshot): string {
  return JSON.stringify(snapshot)
}

function newer(a: AppSnapshot, b: AppSnapshot): AppSnapshot {
  if (a.revision !== b.revision) return a.revision > b.revision ? a : b
  return a.writer >= b.writer ? a : b
}

/**
 * Combines two views of the same data, e.g. this tab's memory and another
 * tab's write. Settings and timer come from the newer revision; completion
 * records are a grow-only set keyed by session id, so a lost update can never
 * drop or duplicate credit.
 */
export function mergeSnapshots(a: AppSnapshot, b: AppSnapshot): AppSnapshot {
  const base = newer(a, b)
  const other = base === a ? b : a
  const known = new Set(base.completions.map((r) => r.sessionId))
  const missing = other.completions.filter((r) => !known.has(r.sessionId))
  if (missing.length === 0) return base
  const completions = [...base.completions, ...missing].sort((x, y) => x.completedAt - y.completedAt)
  return { ...base, completions }
}

/** True when `b` holds completion records that `a` lacks. */
export function hasMissingCompletions(a: AppSnapshot, b: AppSnapshot): boolean {
  const known = new Set(a.completions.map((r) => r.sessionId))
  return b.completions.some((r) => !known.has(r.sessionId))
}
