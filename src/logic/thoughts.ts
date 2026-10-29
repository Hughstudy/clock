import type { Thought, ThoughtDraft } from './types'

/** Trims surrounding whitespace and bounds length. Empty text is a valid marker. */
export function normalizeThoughtText(text: string, maxLength: number): string {
  return Array.from(text.trim()).slice(0, maxLength).join('')
}

/** Optional small step: empty means none. */
export function normalizeStep(text: string | undefined, maxLength: number): string | null {
  const step = Array.from((text ?? '').replace(/\s+/g, ' ').trim()).slice(0, maxLength).join('')
  return step || null
}

export const isLive = (thought: Thought): boolean => thought.deletedAt === null

/** Higher revision wins; at equal revision a deletion wins, then a stable text order. */
export function newerThought(a: Thought, b: Thought): Thought {
  if (a.rev !== b.rev) return a.rev > b.rev ? a : b
  if ((a.deletedAt === null) !== (b.deletedAt === null)) return a.deletedAt !== null ? a : b
  return a.text <= b.text ? a : b
}

const byCreation = (x: Thought, y: Thought) => x.createdAt - y.createdAt || x.id.localeCompare(y.id)

/**
 * Merges two thought lists from one dataset generation. Returns `base` itself
 * when `other` adds nothing, so callers can detect a no-op by identity.
 */
export function mergeThoughts(base: readonly Thought[], other: readonly Thought[]): readonly Thought[] {
  const merged = new Map(base.map((t) => [t.id, t]))
  let changed = false
  for (const t of other) {
    const mine = merged.get(t.id)
    const winner = mine ? newerThought(mine, t) : t
    if (winner !== mine) {
      merged.set(t.id, winner)
      changed = true
    }
  }
  return changed ? [...merged.values()].sort(byCreation) : base
}

/** True when `other` holds a thought, or a newer version of one, that `base` lacks. */
export function hasNewerThoughts(base: readonly Thought[], other: readonly Thought[]): boolean {
  const known = new Map(base.map((t) => [t.id, t]))
  return other.some((t) => {
    const mine = known.get(t.id)
    return !mine || newerThought(mine, t) !== mine
  })
}

/** Clears the text of deletions whose undo period has passed. The marker stays so old tabs cannot resurrect it. */
export function purgeExpiredText(thoughts: Thought[], now: number, undoPeriodMs: number): Thought[] {
  let changed = false
  const next = thoughts.map((t) => {
    if (t.deletedAt === null || t.text === '' || now - t.deletedAt < undoPeriodMs) return t
    changed = true
    return { ...t, text: '', rev: t.rev + 1 }
  })
  return changed ? next : thoughts
}

export function canRestore(thought: Thought, now: number, undoPeriodMs: number): boolean {
  return thought.deletedAt !== null && now - thought.deletedAt < undoPeriodMs
}

export function sameDraft(a: ThoughtDraft | null, b: ThoughtDraft | null): boolean {
  return a === b || (a !== null && b !== null && a.thoughtId === b.thoughtId && a.text === b.text)
}
