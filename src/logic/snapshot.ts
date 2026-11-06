import { defaultSettings, sanitizeSettings } from './settings'
import { initialScenes, selectScene } from './scenes'
import type { Spec } from './spec'
import { initialTimer } from './timer'
import type { AppSnapshot } from './types'
import { isRecord, isCount, isInstant, isId } from './snapshot/guards'
import { MIGRATIONS, runMigrations, type Migration, type MigrationContext } from './snapshot/migrations'
import { readTimer, readRecords, readParticipations, readThoughts, readDraft, readFavorites, readLastFocus, readScenes } from './snapshot/read'

// Stable entry point; consumers do not need to know the internal snapshot modules.
export { MIGRATIONS, runMigrations, type Migration, type MigrationContext } from './snapshot/migrations'
export { mergeSnapshots, hasMissingRecords } from './snapshot/merge'

/** v8 adds durable quote snapshots and cancellation markers. */
export const SNAPSHOT_VERSION = 8

export function createSnapshot(spec: Spec): AppSnapshot {
  return {
    version: SNAPSHOT_VERSION, revision: 0, writer: '', datasetGeneration: 0, settings: defaultSettings(spec), timer: initialTimer(),
    records: [], participations: [], lastRestEnd: null, lastFocusMinutes: null, focusDefaultsRevision: 0, thoughts: [], thoughtDraft: null, draftStamp: null, scenes: initialScenes(), quoteFavorites: [],
  }
}

export type Decoded =
  | { kind: 'ok'; snapshot: AppSnapshot; issues: string[] }
  | { kind: 'unreadable'; reason: string }
  | { kind: 'newer'; version: number }

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
  const ending = data.lastRestEnd
  const lastRestEnd = isRecord(ending) && isId(ending.sessionId) && isInstant(ending.endedAt) && isInstant(ending.elapsedMs)
    ? { sessionId: ending.sessionId, endedAt: ending.endedAt, elapsedMs: ending.elapsedMs } : null
  if (ending !== null && !lastRestEnd) issues.push('lastRestEnd')
  const participations = readParticipations(data.participations, issues)
  const { settings, issues: settingIssues } = sanitizeSettings(data.settings, spec)
  issues.push(...settingIssues)
  let timer = readTimer(data.timer, records.filter((r) => r.endReason === 'deadline').length, issues)
  const thoughts = readThoughts(data.thoughts, spec, issues)
  const quoteFavorites = readFavorites(data.quoteFavorites, issues)
  const thoughtDraft = readDraft(data.thoughtDraft, issues)
  const draftStamp = isId(data.draftStamp) ? data.draftStamp : null
  if (draftStamp === null && (data.draftStamp !== null || thoughtDraft !== null)) issues.push('draftStamp')
  const lastFocusMinutes = readLastFocus(data.lastFocusMinutes, spec, issues)
  const focusDefaultsRevision = isCount(data.focusDefaultsRevision) ? data.focusDefaultsRevision : 0
  if (!isCount(data.focusDefaultsRevision)) issues.push('focusDefaultsRevision')
  let scenes = readScenes(data.scenes, issues)
  if (raw.version < 6) {
    // Only future selections change; keep ordinals and last IDs for repeat avoidance.
    scenes = { ...scenes, focus: { ...scenes.focus, remaining: [] }, rest: { ...scenes.rest, remaining: [] } }
  }
  if (raw.version < 5) {
    // An upgraded active timer gets one durable assignment without a fresh begin cue.
    if (timer.session) {
      const selected = selectScene(scenes, timer.phase === 'focus' ? 'focus' : 'rest', timer.session.id)
      scenes = selected.scenes
      timer = { ...timer, session: { ...timer.session, scene: selected.assignment } }
    }
  }
  return { kind: 'ok', issues, snapshot: {
    version: SNAPSHOT_VERSION, revision: isCount(data.revision) ? data.revision : 0,
    writer: typeof data.writer === 'string' ? data.writer : '', datasetGeneration: data.datasetGeneration,
    settings, timer, lastRestEnd, records, participations, lastFocusMinutes, focusDefaultsRevision, thoughts, thoughtDraft, draftStamp, scenes, quoteFavorites,
  } }
}

export const encodeSnapshot = (snapshot: AppSnapshot): string => JSON.stringify(snapshot)
