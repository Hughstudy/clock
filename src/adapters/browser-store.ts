import type { Spec } from '../logic/spec'
import { APP_ID } from './app-id'
import { currentTimeZone, nowMs } from './calendar'
import { newId } from './ids'
import { createLock } from './locks'
import { SnapshotStore, type KeyValueStorage } from './storage'

export const SNAPSHOT_KEY = `${APP_ID}:snapshot`

function localStorageOrNull(): KeyValueStorage | null {
  try {
    // Accessing the property itself throws when site data is blocked.
    return window.localStorage
  } catch {
    return null
  }
}

export function openBrowserStore(spec: Spec): SnapshotStore {
  return new SnapshotStore({
    key: SNAPSHOT_KEY,
    storage: localStorageOrNull(),
    lock: createLock(`${APP_ID}:snapshot`),
    spec,
    writerId: newId(),
    now: nowMs,
    timeZone: currentTimeZone,
  })
}

/** Observe the local snapshot key and origin-wide clears from other tabs. */
export function onExternalWrite(listener: (newValue: string | null) => void): () => void {
  const storage = localStorageOrNull()
  const handle = (event: StorageEvent) => {
    if (storage && event.storageArea === storage && (event.key === SNAPSHOT_KEY || event.key === null)) {
      listener(event.newValue)
    }
  }
  window.addEventListener('storage', handle)
  return () => window.removeEventListener('storage', handle)
}
