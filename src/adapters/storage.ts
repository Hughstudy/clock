import {
  createSnapshot,
  decodeSnapshot,
  encodeSnapshot,
  hasMissingCompletions,
  mergeSnapshots,
} from '../logic/snapshot'
import type { Spec } from '../logic/spec'
import type { AppSnapshot } from '../logic/types'
import type { LockRunner } from './locks'

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

/**
 * Owns the single versioned snapshot in storage. Every mutation runs under
 * the lock against the latest stored data merged with this tab's memory, so
 * concurrent tabs cannot overwrite or duplicate completion credit.
 */
export class SnapshotStore {
  private memory: AppSnapshot
  private persistence: Persistence
  private notice: StoreNotice | null
  private lastBackup: string | null = null
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

  /** Reads storage and merges it with memory. `behind` means storage lacks something memory has. */
  private readLatest(): { latest: AppSnapshot; behind: boolean } {
    const { storage, key } = this.options
    let text: string | null
    try {
      text = storage?.getItem(key) ?? null
    } catch {
      return { latest: this.memory, behind: true }
    }
    // Empty storage is only behind once this tab has written something.
    if (text === null) return { latest: this.memory, behind: this.memory.revision > 0 }

    const decoded = this.decode(text)
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
    const latest = mergeSnapshots(decoded.snapshot, this.memory)
    return { latest, behind: latest !== decoded.snapshot }
  }

  transact<T>(mutate: (latest: AppSnapshot) => Mutation<T>): Promise<Commit<T>> {
    const { lock } = this.options
    const run = lock ? lock.run.bind(lock) : <R>(task: () => R) => Promise.resolve().then(task)
    return run(() => {
      const { latest, behind } =
        this.persistence === 'saved' ? this.readLatest() : { latest: this.memory, behind: false }
      const result = mutate(latest)

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
      try {
        this.options.storage?.setItem(this.options.key, encodeSnapshot(next))
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
    if (this.persistence !== 'saved' || newValue === null) return null
    const decoded = this.decode(newValue)
    if (decoded.kind === 'newer') {
      this.persistence = 'read-only'
      this.notice = { kind: 'newer', version: decoded.version }
      return { snapshot: this.memory, needsHeal: false }
    }
    if (decoded.kind === 'unreadable') return null
    const needsHeal = hasMissingCompletions(decoded.snapshot, this.memory)
    this.memory = mergeSnapshots(this.memory, decoded.snapshot)
    return { snapshot: this.memory, needsHeal }
  }
}
