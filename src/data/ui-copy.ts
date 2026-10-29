import { feedbackCatalog } from './encouragement'

/** Reviewed interface/error copy by ID (`UI12`, `ERR04`, …). Throws for an unknown ID so typos fail in tests. */
export function uiText(id: string): string {
  const item = feedbackCatalog.interfaceCopy.find((c) => c.id === id) ?? feedbackCatalog.errors.find((c) => c.id === id)
  if (!item) throw new Error(`unknown copy id ${id}`)
  return item.text
}
