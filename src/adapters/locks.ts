export interface LockRunner {
  run<T>(task: () => T | Promise<T>): Promise<T>
}

interface LockManagerLike {
  request<T>(name: string, callback: () => Promise<T>): Promise<T>
}

/**
 * Exclusive cross-tab lock for each snapshot read/modify/write, via the Web
 * Locks API. Returns null where the API is missing (old browsers, insecure
 * origins); the store then stays read-only rather than risk racing writes.
 */
export function createLock(
  name: string,
  locks: LockManagerLike | null = globalThis.navigator?.locks ?? null,
): LockRunner | null {
  if (!locks) return null
  return { run: (task) => locks.request(name, async () => task()) }
}
