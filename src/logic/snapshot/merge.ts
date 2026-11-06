import { hasMissingScenes, mergeSceneStates } from '../scenes'
import { hasNewerThoughts, mergeThoughts } from '../thoughts'
import { hasNewerFavorites, mergeFavorites } from '../favorites'
import type { AppSnapshot } from '../types'

function newer(a: AppSnapshot, b: AppSnapshot): AppSnapshot {
  if (a.revision !== b.revision) return a.revision > b.revision ? a : b
  return a.writer >= b.writer ? a : b
}

/**
 * Ended sessions and participation are append-only. Thoughts merge per ID by
 * revision with deletion markers winning ties. Settings, timer, draft and
 * one-off choice come from the newer snapshot. Different generations never merge.
 */
export function mergeSnapshots(a: AppSnapshot, b: AppSnapshot): AppSnapshot {
  if (a.datasetGeneration !== b.datasetGeneration) return a.datasetGeneration > b.datasetGeneration ? a : b
  const base = newer(a, b)
  const other = base === a ? b : a
  const known = new Set(base.records.map((r) => r.sessionId))
  const missing = other.records.filter((r) => !known.has(r.sessionId))
  const participated = new Set(base.participations.map((p) => p.sessionId))
  const missingParticipation = other.participations.filter((p) => !participated.has(p.sessionId))
  const thoughts = mergeThoughts(base.thoughts, other.thoughts)
  const quoteFavorites = mergeFavorites(base.quoteFavorites, other.quoteFavorites)
  const scenes = mergeSceneStates(base.scenes, other.scenes)
  if (!missing.length && !missingParticipation.length && thoughts === base.thoughts && scenes === base.scenes && quoteFavorites === base.quoteFavorites) return base
  const records = [...base.records, ...missing].sort((x, y) => x.endedAt - y.endedAt || x.sessionId.localeCompare(y.sessionId))
  return { ...base, records, participations: [...base.participations, ...missingParticipation].sort((x, y) => x.sessionId.localeCompare(y.sessionId)),
    thoughts: [...thoughts], scenes, quoteFavorites: [...quoteFavorites],
    timer: { ...base.timer, completedFocusCount: Math.max(base.timer.completedFocusCount, records.filter((r) => r.endReason === 'deadline').length) } }
}

/** True when `b` holds durable data that `a` lacks, so `a` needs the merge written back. */
export function hasMissingRecords(a: AppSnapshot, b: AppSnapshot): boolean {
  if (a.datasetGeneration !== b.datasetGeneration) return b.datasetGeneration > a.datasetGeneration
  const records = new Set(a.records.map((r) => r.sessionId))
  const participations = new Set(a.participations.map((p) => p.sessionId))
  return b.records.some((r) => !records.has(r.sessionId)) || b.participations.some((p) => !participations.has(p.sessionId)) ||
    hasNewerThoughts(a.thoughts, b.thoughts) || hasMissingScenes(a.scenes, b.scenes) || hasNewerFavorites(a.quoteFavorites, b.quoteFavorites)
}
