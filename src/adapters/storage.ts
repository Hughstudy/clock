import {
  createSnapshot,
  decodeSnapshot,
  encodeSnapshot,
  hasMissingRecords,
  mergeSnapshots,
  SNAPSHOT_VERSION,
} from '../logic/snapshot'
import type { Spec } from '../logic/spec'
import { mergeSceneStates } from '../logic/scenes'
import { remainingMs } from '../logic/timer'
import type { AppSnapshot, RestMemory, TimerState } from '../logic/types'
import type { LockRunner } from './locks'
import { quoteKey } from '../contracts/favorites'
import { sameFavorite } from '../logic/favorites'

export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/**
 * - `saved`: changes are written to storage.
 * - `memory-only`: storage is unusable; progress lasts until the page closes.
 * - `read-only`: a newer app version owns the data; this version must not overwrite it.
 */
export type Persistence = 'saved' | 'memory-only' | 'read-only'

export type StoreNotice =
  | { kind: 'no-locks' }
  | { kind: 'repaired'; fields: string[]; backupKey: string | null }
  | { kind: 'unreadable'; reason: string; backupKey: string | null }
  | { kind: 'newer'; version: number }
  | { kind: 'unavailable' }
  | { kind: 'removed' }

export interface StoreOptions {
  key: string
  storage: KeyValueStorage | null
  /** Null when the browser lacks Web Locks: saved data is shown read-only. */
  lock: LockRunner | null
  spec: Spec
  /** Identifies this tab in written snapshots. */
  writerId: string
  now: () => number
  /** Current IANA zone, for migrating sessions saved before zones were recorded. */
  timeZone: () => string
}

export interface Mutation<T> {
  snapshot: AppSnapshot
  changed: boolean
  value: T
}

export interface Commit<T> {
  snapshot: AppSnapshot
  value: T
  /** False when the change exists only in memory. */
  saved: boolean
  error: string | null
}

function message(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error)
}

/** Rebase independent preference fields. A conflicting durable value wins. */
function mergePreferenceFields<T extends object>(base: T, disk: T, local: T): T {
  const result = { ...disk }
  for (const key of Object.keys(local) as Array<keyof T>) {
    if (base[key] === disk[key]) result[key] = local[key]
  }
  return result
}

function sameTimerPosition(a: TimerState, b: TimerState): boolean {
  if (a.phase !== b.phase || a.session?.id !== b.session?.id) return false
  if (!a.session || !b.session) return a.session === b.session
  if (a.session.status === 'paused') return b.session.status === 'paused' && a.session.remainingMs === b.session.remainingMs
  return b.session.status === 'running' && a.session.deadline === b.session.deadline
}

/** A pending end can follow a competing pause or resume only if the saved clock agrees. */
function matchesRestPosition(rest: RestMemory, disk: AppSnapshot): boolean {
  const session = disk.timer.session
  if (session?.id !== rest.sessionId) return false
  if (rest.endReason === 'deadline') return session.status === 'running' && session.deadline === rest.endedAt
  if (rest.endReason !== 'manual' || (session.status === 'running' && session.deadline <= rest.endedAt)) return false
  return rest.elapsedMs === session.durationMs - remainingMs(disk.timer, disk.settings, rest.endedAt)
}

/**
 * Owns the single versioned snapshot in storage. Every mutation runs under
 * the lock against the latest stored data merged with this tab's memory, so
 * concurrent tabs cannot overwrite or duplicate completion credit.
 */
export class SnapshotStore {
  private memory: AppSnapshot
  /** Last snapshot known to be on disk, before merging in this tab's pending changes. */
  private stored: AppSnapshot | null = null
  /** Common ancestor for locally applied writes which the disk has not accepted. */
  private pendingBase: AppSnapshot | null = null
  private sawStoredData = false
  private persistence: Persistence
  private notice: StoreNotice | null
  private lastBackup: string | null = null
  private readError: string | null = null
  private readonly options: StoreOptions

  constructor(options: StoreOptions) {
    this.options = options
    const loaded = this.load()
    this.memory = loaded.snapshot
    this.persistence = loaded.persistence
    this.notice = loaded.notice
    if (!options.lock && this.persistence === 'saved') {
      this.persistence = 'read-only'
      this.notice = { kind: 'no-locks' }
    }
  }

  get snapshot(): AppSnapshot {
    return this.memory
  }

  /** Last confirmed write or read. Used to acknowledge only matching operations. */
  get durableSnapshot(): AppSnapshot | null {
    return this.stored
  }

  get savedRecordIds(): ReadonlySet<string> {
    const ids = new Set<string>()
    if (this.stored?.datasetGeneration !== this.memory.datasetGeneration) return ids
    const onDisk = new Map(this.stored.records.map(record => [record.sessionId, record]))
    for (const record of this.memory.records) {
      const saved = onDisk.get(record.sessionId)
      // Two tabs can end the same session at different times if a write failed.
      if (saved && saved.endedAt === record.endedAt && saved.elapsedMs === record.elapsedMs &&
          saved.endReason === record.endReason && saved.dateKey === record.dateKey) ids.add(record.sessionId)
    }
    return ids
  }

  get status(): { persistence: Persistence; notice: StoreNotice | null } {
    return { persistence: this.persistence, notice: this.notice }
  }

  private load(): { snapshot: AppSnapshot; persistence: Persistence; notice: StoreNotice | null } {
    const { storage, key, spec } = this.options
    const fresh = createSnapshot(spec)
    if (!storage) return { snapshot: fresh, persistence: 'memory-only', notice: { kind: 'unavailable' } }

    let text: string | null
    try {
      text = storage.getItem(key)
    } catch {
      return { snapshot: fresh, persistence: 'memory-only', notice: { kind: 'unavailable' } }
    }
    if (text === null) return { snapshot: fresh, persistence: 'saved', notice: null }

    const decoded = this.decode(text)
    switch (decoded.kind) {
      case 'ok': {
        this.stored = decoded.snapshot
        if (decoded.issues.length === 0) return { snapshot: decoded.snapshot, persistence: 'saved', notice: null }
        const backupKey = this.backup(text)
        return {
          snapshot: decoded.snapshot,
          // Without a backup, keep the original untouched rather than overwrite it.
          persistence: backupKey ? 'saved' : 'memory-only',
          notice: { kind: 'repaired', fields: decoded.issues, backupKey },
        }
      }
      case 'unreadable': {
        const backupKey = this.backup(text)
        return {
          snapshot: fresh,
          persistence: backupKey ? 'saved' : 'memory-only',
          notice: { kind: 'unreadable', reason: decoded.reason, backupKey },
        }
      }
      case 'newer':
        return { snapshot: fresh, persistence: 'read-only', notice: { kind: 'newer', version: decoded.version } }
    }
  }

  private decode(text: string) {
    this.sawStoredData = true
    return decodeSnapshot(text, this.options.spec, { timeZone: this.options.timeZone() })
  }

  private backup(text: string): string | null {
    const backupKey = `${this.options.key}:backup:${this.options.now()}`
    if (text === this.lastBackup) return backupKey
    try {
      this.options.storage?.setItem(backupKey, text)
      this.lastBackup = text
      return backupKey
    } catch {
      return null
    }
  }

  /** A known snapshot disappeared. Keep the visible work, but never repopulate a cleared key. */
  private detachRemovedSnapshot(): void {
    this.stored = null
    this.pendingBase = null
    this.sawStoredData = false
    if (this.persistence !== 'read-only') this.persistence = 'memory-only'
    this.notice = { kind: 'removed' }
  }

  /**
   * A failed local edit can fork from a later, successful edit on another tab.
   * Keep the accepted remote version for conflicting objects. The editor retains
   * its local input and the old revision for explicit conflict resolution.
   */
  private mergeWithDisk(disk: AppSnapshot): AppSnapshot {
    const base = this.pendingBase
    const local = this.memory
    let merged = mergeSnapshots(disk, local)
    if (!base || disk.datasetGeneration !== base.datasetGeneration || local.datasetGeneration !== base.datasetGeneration) return merged
    const draftOwner = disk.draftStamp === base.draftStamp ? local : disk
    const durableRecords = new Map(disk.records.map(record => [record.sessionId, record]))
    const records = merged.records.map(record => durableRecords.get(record.sessionId) ?? record)
    const durableRests = new Map(disk.restMemories.map(rest => [rest.sessionId, rest]))
    const disputedCompletions = local.records.filter(r => r.endReason === 'deadline' && durableRecords.get(r.sessionId)?.endReason === 'manual').length
    const completed = Math.max(local.timer.completedFocusCount - disputedCompletions, disk.timer.completedFocusCount,
      records.filter(r => r.endReason === 'deadline').length)

    // Phase, session identity and its deadline/paused amount form one position.
    // Even an ended zero-second session advances the corresponding scene cursor.
    const diskStartedAnother = disk.scenes.focus.ordinal !== base.scenes.focus.ordinal || disk.scenes.rest.ordinal !== base.scenes.rest.ordinal
    const positionChanged = !sameTimerPosition(base.timer, disk.timer)
    const diskMoved = positionChanged || disk.restSuggestionSessionId !== base.restSuggestionSessionId || diskStartedAnother
    const diskActive = disk.timer.session
    // A failed read may have settled a rest from its old clock. If the saved
    // timer has since paused or resumed on a different timeline, that ending
    // cannot establish elapsed time. Reconcile the saved position on retry.
    const contested = diskActive && positionChanged && disk.timer.phase !== 'focus' && base.timer.session?.id === diskActive.id
      ? local.restMemories.find(rest => rest.sessionId === diskActive.id && !durableRests.has(rest.sessionId)) : null
    const staleRestId = contested && !matchesRestPosition(contested, disk) ? contested.sessionId : null
    const restMemories = merged.restMemories.filter(rest => rest.sessionId !== staleRestId).map(rest => durableRests.get(rest.sessionId) ?? rest)
    const localEndedDiskSession = !!diskActive && (disk.timer.phase === 'focus'
      ? records.some(r => r.sessionId === diskActive.id)
      : restMemories.some(rest => rest.sessionId === diskActive.id))
    // If the peer only settled the shared session, preserve any subsequent
    // local start, including a session the user has already ended.
    const priorId = base.timer.session?.id
    const localStartedAnother = local.scenes.focus.ordinal > base.scenes.focus.ordinal || local.scenes.rest.ordinal > base.scenes.rest.ordinal
    const continuedAfterEnd = priorId && !diskActive && !diskStartedAnother && localStartedAnother &&
      (durableRecords.has(priorId) || durableRests.has(priorId))
    const timerOwner = diskMoved && !localEndedDiskSession && !continuedAfterEnd ? disk : local
    const other = timerOwner === disk ? local : disk
    const recent = timerOwner.lastRestEnd
    const accepted = recent && durableRests.get(recent.sessionId)
    const lastRestEnd = accepted ? { sessionId: accepted.sessionId, endedAt: accepted.endedAt, elapsedMs: accepted.elapsedMs } : recent
    const lastFocusMinutes = disk.focusDefaultsRevision !== base.focusDefaultsRevision || disk.lastFocusMinutes !== base.lastFocusMinutes
      ? disk.lastFocusMinutes : local.lastFocusMinutes
    merged = {
      ...merged, records, restMemories, timer: { ...timerOwner.timer, completedFocusCount: completed }, restSuggestionSessionId: timerOwner.restSuggestionSessionId,
      scenes: mergeSceneStates(timerOwner.scenes, other.scenes),
      lastRestEnd,
      lastFocusMinutes, focusDefaultsRevision: Math.max(disk.focusDefaultsRevision, local.focusDefaultsRevision),
      settings: { ...mergePreferenceFields(base.settings, disk.settings, local.settings),
        durationsMinutes: mergePreferenceFields(base.settings.durationsMinutes, disk.settings.durationsMinutes, local.settings.durationsMinutes) },
      draftStamp: draftOwner.draftStamp, thoughtDraft: draftOwner.thoughtDraft,
    }
    const originals = new Map(base.thoughts.map(t => [t.id, t]))
    const durable = new Map(disk.thoughts.map(t => [t.id, t]))
    let changed = false
    const thoughts = merged.thoughts.map(t => {
      const accepted = durable.get(t.id)
      if (!accepted || originals.get(t.id)?.rev === accepted.rev ||
          (accepted.rev === t.rev && accepted.text === t.text && accepted.status === t.status && accepted.deletedAt === t.deletedAt)) return t
      changed = true
      return accepted
    })
    const originalFavorites = new Map(base.quoteFavorites.map(q => [quoteKey(q), q]))
    const durableFavorites = new Map(disk.quoteFavorites.map(q => [quoteKey(q), q]))
    const quoteFavorites = merged.quoteFavorites.map(q => {
      const accepted = durableFavorites.get(quoteKey(q))
      if (!accepted || originalFavorites.get(quoteKey(q))?.rev === accepted.rev || sameFavorite(accepted, q)) return q
      changed = true
      return accepted
    })
    this.pendingBase = disk
    return changed ? { ...merged, thoughts, quoteFavorites } : merged
  }

  /** Reads storage and merges it with memory. `behind` means storage lacks something memory has. */
  private readLatest(): { latest: AppSnapshot; behind: boolean } {
    this.readError = null
    const { storage, key } = this.options
    let text: string | null
    try {
      text = storage?.getItem(key) ?? null
    } catch (error) {
      this.readError = message(error)
      return { latest: this.memory, behind: true }
    }
    if (text === null) {
      if (this.sawStoredData) this.detachRemovedSnapshot()
      // A failed first write is still retryable when there has never been a durable snapshot.
      return { latest: this.memory, behind: this.memory.revision > 0 }
    }

    const decoded = this.decode(text)
    this.stored = decoded.kind === 'ok' ? decoded.snapshot : null
    if (decoded.kind === 'newer') {
      this.persistence = 'read-only'
      this.notice = { kind: 'newer', version: decoded.version }
      return { latest: this.memory, behind: false }
    }
    if (decoded.kind === 'unreadable') {
      // Replace unreadable data only once a copy exists; otherwise keep it and stop writing.
      if (this.backup(text) === null) {
        this.persistence = 'memory-only'
        this.notice = { kind: 'unreadable', reason: decoded.reason, backupKey: null }
        return { latest: this.memory, behind: false }
      }
      return { latest: this.memory, behind: true }
    }
    if (decoded.issues.length > 0) {
      const backupKey = this.backup(text)
      this.notice = { kind: 'repaired', fields: decoded.issues, backupKey }
      if (!backupKey) {
        this.persistence = 'memory-only'
        return { latest: this.memory, behind: false }
      }
    }
    const latest = this.mergeWithDisk(decoded.snapshot)
    return { latest, behind: latest !== decoded.snapshot || decoded.issues.length > 0 || JSON.parse(text).version !== SNAPSHOT_VERSION }
  }

  transact<T>(mutate: (latest: AppSnapshot) => Mutation<T>): Promise<Commit<T>> {
    const { lock } = this.options
    const run = lock ? lock.run.bind(lock) : <R>(task: () => R) => Promise.resolve().then(task)
    return run(() => {
      const { latest, behind } =
        this.persistence === 'saved' ? this.readLatest() : { latest: this.memory, behind: false }
      const result = mutate(latest)

      if (this.persistence === 'read-only') {
        return { snapshot: this.memory, value: result.value, saved: false, error: null }
      }
      if (this.persistence !== 'saved') {
        this.memory = result.snapshot
        return { snapshot: this.memory, value: result.value, saved: false, error: null }
      }
      if (!result.changed && !behind) {
        this.memory = result.snapshot
        return { snapshot: this.memory, value: result.value, saved: true, error: null }
      }

      const next: AppSnapshot = { ...result.snapshot, revision: latest.revision + 1, writer: this.options.writerId }
      this.memory = next
      this.pendingBase ??= this.stored ?? latest
      // Never overwrite data when the latest stored revision could not be read.
      if (this.readError) return { snapshot: next, value: result.value, saved: false, error: this.readError }
      try {
        this.options.storage?.setItem(this.options.key, encodeSnapshot(next))
        this.stored = next
        this.pendingBase = null
        this.sawStoredData = true
        return { snapshot: next, value: result.value, saved: true, error: null }
      } catch (error) {
        return { snapshot: next, value: result.value, saved: false, error: message(error) }
      }
    })
  }

  /**
   * Applies another tab's write. Returns `needsHeal` when this tab holds
   * completion records the other write lacks, so the caller can persist the merge.
   */
  receive(newValue: string | null): { snapshot: AppSnapshot; needsHeal: boolean } | null {
    if (newValue === null) {
      if (!this.sawStoredData) return null
      try {
        // A delayed removal event may describe a key another tab has since written again.
        if (this.options.storage?.getItem(this.options.key) !== null) return null
      } catch { return null }
      this.detachRemovedSnapshot()
      return { snapshot: this.memory, needsHeal: false }
    }
    if (this.persistence !== 'saved') return null
    const decoded = this.decode(newValue)
    if (decoded.kind === 'newer') {
      this.stored = null
      this.persistence = 'read-only'
      this.notice = { kind: 'newer', version: decoded.version }
      return { snapshot: this.memory, needsHeal: false }
    }
    if (decoded.kind === 'unreadable') return null
    // Another tab's event can arrive after this tab has committed a newer revision.
    const incoming = decoded.snapshot
    const fresh = incoming.datasetGeneration >= this.memory.datasetGeneration &&
        (this.stored?.datasetGeneration !== incoming.datasetGeneration || incoming.revision >= this.stored.revision)
    if (fresh) {
      this.stored = incoming
    }
    this.memory = fresh ? this.mergeWithDisk(incoming) : mergeSnapshots(this.memory, incoming)
    const needsHeal = hasMissingRecords(incoming, this.memory)
    return { snapshot: this.memory, needsHeal }
  }
}
