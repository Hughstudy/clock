import { quoteKey, type SavedQuote } from '../contracts/favorites'

export function newerFavorite(a: SavedQuote, b: SavedQuote): SavedQuote {
  if (a.rev !== b.rev) return a.rev > b.rev ? a : b
  if ((a.deletedAt === null) !== (b.deletedAt === null)) return a.deletedAt !== null ? a : b
  return a.savedAt >= b.savedAt ? a : b
}

export function mergeFavorites(base: readonly SavedQuote[], other: readonly SavedQuote[]): readonly SavedQuote[] {
  const result = new Map(base.map(q => [quoteKey(q), q]))
  let changed = false
  for (const quote of other) {
    const key = quoteKey(quote), mine = result.get(key)
    const winner = mine ? newerFavorite(mine, quote) : quote
    if (winner !== mine) { result.set(key, winner); changed = true }
  }
  return changed ? [...result.values()].sort((a, b) => quoteKey(a).localeCompare(quoteKey(b))) : base
}

export const sameFavorite = (a: SavedQuote | undefined, b: SavedQuote | undefined): boolean =>
  a === b || !!a && !!b && a.rev === b.rev && a.copyVersion === b.copyVersion && a.text === b.text && a.deletedAt === b.deletedAt && a.savedAt === b.savedAt

export function hasNewerFavorites(base: readonly SavedQuote[], other: readonly SavedQuote[]): boolean {
  const known = new Map(base.map(q => [quoteKey(q), q]))
  return other.some(q => { const previous = known.get(quoteKey(q)); return !previous || newerFavorite(previous, q) !== previous })
}
