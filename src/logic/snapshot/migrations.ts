import { isDateKey } from '../calendar'
import { initialScenes } from '../scenes'
import type { ParticipationRecord } from '../types'
import { isRecord, isId, isInstant, isPositiveMs, type Json } from './guards'

export interface MigrationContext { timeZone: string }
export type Migration = (old: Json, context: MigrationContext) => Json

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
  // Additive: no step, thought or one-off choice existed before; none is invented.
  3: (old) => {
    const timer = isRecord(old.timer) ? old.timer : null
    const session = timer && isRecord(timer.session) ? timer.session : null
    const records = Array.isArray(old.records) ? old.records.map((r: unknown) => isRecord(r) ? { ...r, step: null } : r) : old.records
    return { ...old, version: 4, records, lastFocusMinutes: null, thoughts: [], thoughtDraft: null,
      timer: timer && session ? { ...timer, session: { ...session, step: null } } : old.timer }
  },
  // Introduce scene data without inventing historical assignments or grants.
  4: (old) => ({ ...old, version: 5, scenes: initialScenes() }),
  // Bags are normalized after validation; active and historical assignments stay intact.
  5: (old) => ({ ...old, version: 6 }),
  6: (old, { timeZone }) => {
    const draft = old.thoughtDraft
    if (!isRecord(draft)) return { ...old, version: 7, lastRestEnd: null, draftStamp: null, focusDefaultsRevision: 0 }
    const target = Array.isArray(old.thoughts) && draft.thoughtId !== null
      ? old.thoughts.find((t: unknown) => isRecord(t) && t.id === draft.thoughtId) : null
    // Never attach an unattributed draft to whichever timer happens to be running.
    const ids = new Set(Array.isArray(old.thoughts) ? old.thoughts.map(t => t?.id) : [])
    let suffix = 0
    while (ids.has('migrated-draft-' + suffix)) suffix++
    const id = 'migrated-draft-' + suffix
    return { ...old, version: 7, lastRestEnd: null, focusDefaultsRevision: 0, draftStamp: id, thoughtDraft: { ...draft, id, timeZone,
      baseRev: target?.rev ?? null, sessionId: target?.sessionId ?? null, createdAt: target?.createdAt ?? null,
      dateKey: target?.dateKey ?? null } }
  },
  7: old => ({ ...old, version: 8, quoteFavorites: [] }),
  // Earlier snapshots cannot distinguish a suggestion from explicit rest preparation.
  // Preserve their exact timer mode without inventing an automatic suggestion.
  8: old => ({ ...old, version: 9, restSuggestionSessionId: null }),
  // No old schema recorded a rest's original civil date, kind or ending reason.
  // The validated last ending and its matching artwork are projected in decodeSnapshot.
  9: old => ({ ...old, version: 10, restMemories: [] }),
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
