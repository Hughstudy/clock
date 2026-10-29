import { isDateKey } from './calendar'
import { defaultSettings, sanitizeSettings } from './settings'
import type { Spec } from './spec'
import { initialTimer } from './timer'
import { PHASES, type AppSnapshot, type FocusRecord, type ParticipationRecord, type Phase, type Session, type TimerState } from './types'

export const SNAPSHOT_VERSION = 3

export function createSnapshot(spec: Spec): AppSnapshot {
  return { version: SNAPSHOT_VERSION, revision: 0, writer: '', datasetGeneration: 0, settings: defaultSettings(spec), timer: initialTimer(), records: [], participations: [] }
}

export interface MigrationContext { timeZone: string }
type Json = Record<string, unknown>
export type Migration = (old: Json, context: MigrationContext) => Json
const isRecord = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value)
const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0
const isInstant = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0
const isPositiveMs = (v: unknown): v is number => isInstant(v) && v > 0
const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 128
const isTimeZone = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 64

export const MIGRATIONS: Readonly<Record<number, Migration>> = {
  1: (old, { timeZone }) => {
    const timer = isRecord(old.timer) ? old.timer : null
    const session = timer && isRecord(timer.session) ? timer.session : null
    if (!timer || !session || session.timeZone !== undefined) return { ...old, version: 2 }
    return { ...old, version: 2, timer: { ...timer, session: { ...session, timeZone } } }
  },
  2: (old) => {
    const timer = isRecord(old.timer) ? old.timer : null
    const session = timer && isRecord(timer.session) ? timer.session : null
    const legacy = Array.isArray(old.completions) ? old.completions : null
    // Leave malformed entries for validation so their raw source is backed up.
    const records = legacy?.map((r: unknown) => isRecord(r) ? {
      sessionId: r.sessionId, startedAt: null, endedAt: r.completedAt, dateKey: r.dateKey,
      targetMs: r.focusMs, elapsedMs: r.focusMs, endReason: 'deadline', source: 'legacy',
    } : r)
    const seen = new Set<string>()
    const participations: ParticipationRecord[] = []
    for (const r of legacy ?? []) {
      if (!isRecord(r) || !isId(r.sessionId) || !isInstant(r.completedAt) || !isDateKey(r.dateKey) || !isPositiveMs(r.focusMs) || seen.has(r.sessionId)) continue
      seen.add(r.sessionId)
      participations.push({ sessionId: r.sessionId, participatedAt: null, dateKey: r.dateKey, source: 'legacy-completion' })
    }
    if (timer?.phase === 'focus' && session && isId(session.id) && !seen.has(session.id)) {
      participations.push({ sessionId: session.id, participatedAt: null, dateKey: null, source: 'legacy-active' })
    }
    return { ...old, version: 3, datasetGeneration: 0, records, participations,
      timer: timer && session ? { ...timer, session: { ...session, startedAt: null } } : old.timer }
  },
}

export type Decoded =
  | { kind: 'ok'; snapshot: AppSnapshot; issues: string[] }
  | { kind: 'unreadable'; reason: string }
  | { kind: 'newer'; version: number }

function readSession(raw: unknown): Session | null {
  if (!isRecord(raw) || !isId(raw.id) || !isPositiveMs(raw.durationMs) || !isTimeZone(raw.timeZone) || !(raw.startedAt === null || isInstant(raw.startedAt))) return null
  const { id, durationMs, timeZone, startedAt } = raw
  if (raw.status === 'running' && isInstant(raw.deadline)) return { status: 'running', id, durationMs, timeZone, startedAt, deadline: raw.deadline }
  if (raw.status === 'paused' && isInstant(raw.remainingMs) && raw.remainingMs <= durationMs) return { status: 'paused', id, durationMs, timeZone, startedAt, remainingMs: raw.remainingMs }
  return null
}

function readTimer(raw: unknown, completionCount: number, issues: string[]): TimerState {
  if (!isRecord(raw)) { issues.push('timer'); return { ...initialTimer(), completedFocusCount: completionCount } }
  let phase: Phase = 'focus'
  if (PHASES.includes(raw.phase as Phase)) phase = raw.phase as Phase
  else issues.push('timer.phase')
  const session = raw.session === null ? null : readSession(raw.session)
  if (raw.session !== null && !session) issues.push('timer.session')
  let completedFocusCount = completionCount
  if (isCount(raw.completedFocusCount)) completedFocusCount = Math.max(raw.completedFocusCount, completionCount)
  else issues.push('timer.completedFocusCount')
  return { phase, session, completedFocusCount }
}

function readRecords(raw: unknown, issues: string[]): FocusRecord[] {
  if (!Array.isArray(raw)) { issues.push('records'); return [] }
  const seen = new Set<string>()
  const records: FocusRecord[] = []
  let dropped = 0
  for (const r of raw) {
    if (isRecord(r) && isId(r.sessionId) && isInstant(r.endedAt) && (r.startedAt === null || isInstant(r.startedAt)) &&
        isDateKey(r.dateKey) && isPositiveMs(r.targetMs) && isInstant(r.elapsedMs) && r.elapsedMs <= r.targetMs &&
        (r.endReason === 'manual' || (r.endReason === 'deadline' && r.elapsedMs === r.targetMs)) &&
        (r.source === 'native' || r.source === 'legacy') && !seen.has(r.sessionId)) {
      seen.add(r.sessionId)
      records.push({ sessionId: r.sessionId, startedAt: r.startedAt, endedAt: r.endedAt, dateKey: r.dateKey,
        targetMs: r.targetMs, elapsedMs: r.elapsedMs, endReason: r.endReason, source: r.source })
    } else dropped += 1
  }
  if (dropped) issues.push(`records (${dropped} unreadable)`)
  return records
}

function readParticipations(raw: unknown, issues: string[]): ParticipationRecord[] {
  if (!Array.isArray(raw)) { issues.push('participations'); return [] }
  const seen = new Set<string>()
  const result: ParticipationRecord[] = []
  let dropped = 0
  for (const p of raw) {
    if (isRecord(p) && isId(p.sessionId) && (p.participatedAt === null || isInstant(p.participatedAt)) &&
        (p.dateKey === null || isDateKey(p.dateKey)) &&
        (p.source === 'native' || p.source === 'legacy-completion' || p.source === 'legacy-active') && !seen.has(p.sessionId)) {
      seen.add(p.sessionId)
      result.push({ sessionId: p.sessionId, participatedAt: p.participatedAt, dateKey: p.dateKey, source: p.source })
    } else dropped += 1
  }
  if (dropped) issues.push(`participations (${dropped} unreadable)`)
  return result
}

export function runMigrations(data: Json, from: number, to: number, migrations: Readonly<Record<number, Migration>>, context: MigrationContext): Json | null {
  let current = data
  for (let v = from; v < to; v += 1) {
    const migrate = migrations[v]
    if (!migrate) return null
    current = migrate(current, context)
  }
  return current
}

export function decodeSnapshot(text: string, spec: Spec, context: MigrationContext, migrations: Readonly<Record<number, Migration>> = MIGRATIONS): Decoded {
  let raw: unknown
  try { raw = JSON.parse(text) } catch { return { kind: 'unreadable', reason: 'Saved data is not valid JSON.' } }
  if (!isRecord(raw) || !isCount(raw.version) || raw.version < 1) return { kind: 'unreadable', reason: 'Saved data has no recognizable version.' }
  if (raw.version > SNAPSHOT_VERSION) return { kind: 'newer', version: raw.version }
  const data = runMigrations(raw, raw.version, SNAPSHOT_VERSION, migrations, context)
  if (!data) return { kind: 'unreadable', reason: `No upgrade path from saved version ${raw.version}.` }
  // A corrupt generation cannot be reset to zero: doing so could revive deleted data.
  if (!isCount(data.datasetGeneration)) return { kind: 'unreadable', reason: 'Saved data generation is invalid.' }
  const issues: string[] = []
  const records = readRecords(data.records, issues)
  const participations = readParticipations(data.participations, issues)
  const { settings, issues: settingIssues } = sanitizeSettings(data.settings, spec)
  issues.push(...settingIssues)
  const timer = readTimer(data.timer, records.filter((r) => r.endReason === 'deadline').length, issues)
  return { kind: 'ok', issues, snapshot: {
    version: SNAPSHOT_VERSION, revision: isCount(data.revision) ? data.revision : 0,
    writer: typeof data.writer === 'string' ? data.writer : '', datasetGeneration: data.datasetGeneration,
    settings, timer, records, participations,
  } }
}

export const encodeSnapshot = (snapshot: AppSnapshot): string => JSON.stringify(snapshot)

function newer(a: AppSnapshot, b: AppSnapshot): AppSnapshot {
  if (a.revision !== b.revision) return a.revision > b.revision ? a : b
  return a.writer >= b.writer ? a : b
}

/** Append-only ended sessions and participation. Future editable notes require separate tombstones. */
export function mergeSnapshots(a: AppSnapshot, b: AppSnapshot): AppSnapshot {
  if (a.datasetGeneration !== b.datasetGeneration) return a.datasetGeneration > b.datasetGeneration ? a : b
  const base = newer(a, b)
  const other = base === a ? b : a
  const known = new Set(base.records.map((r) => r.sessionId))
  const missing = other.records.filter((r) => !known.has(r.sessionId))
  const participated = new Set(base.participations.map((p) => p.sessionId))
  const missingParticipation = other.participations.filter((p) => !participated.has(p.sessionId))
  if (!missing.length && !missingParticipation.length) return base
  const records = [...base.records, ...missing].sort((x, y) => x.endedAt - y.endedAt || x.sessionId.localeCompare(y.sessionId))
  return { ...base, records, participations: [...base.participations, ...missingParticipation].sort((x, y) => x.sessionId.localeCompare(y.sessionId)),
    timer: { ...base.timer, completedFocusCount: Math.max(base.timer.completedFocusCount, records.filter((r) => r.endReason === 'deadline').length) } }
}

export function hasMissingRecords(a: AppSnapshot, b: AppSnapshot): boolean {
  if (a.datasetGeneration !== b.datasetGeneration) return b.datasetGeneration > a.datasetGeneration
  const records = new Set(a.records.map((r) => r.sessionId))
  const participations = new Set(a.participations.map((p) => p.sessionId))
  return b.records.some((r) => !records.has(r.sessionId)) || b.participations.some((p) => !participations.has(p.sessionId))
}
