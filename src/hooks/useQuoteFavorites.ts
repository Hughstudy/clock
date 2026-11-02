import { useEffect, useRef, useState } from 'react'
import { newId } from '../adapters/ids'
import { quoteKey, type FavoriteQuote, type QuoteFavoritesController } from '../contracts/favorites'
import type { ClockApp } from './useClockApp'
import { nowMs } from '../adapters/calendar'

interface PendingFavorite { quote: FavoriteQuote; selected: boolean; revision: number; generation: number }

/** Optimistic memory never lights a saved star or removes a durable collection row. */
export function useQuoteFavorites(app: ClockApp): QuoteFavoritesController {
  const [pending, setPending] = useState<ReadonlyMap<string, PendingFavorite>>(new Map())
  const pendingRef = useRef(pending)
  const [status, setStatus] = useState<string | null>(null)
  const [messages, setMessages] = useState<ReadonlyMap<string, string>>(new Map())
  const previousGeneration = useRef(app.snapshot.datasetGeneration)
  const appRef = useRef(app); appRef.current = app
  const update = (next: ReadonlyMap<string, PendingFavorite>) => { pendingRef.current = next; setPending(next) }
  const report = (quote: FavoriteQuote, text: string) => {
    const excerpt = Array.from(quote.text).slice(0, 18).join('')
    const message = `「${excerpt}${Array.from(quote.text).length > 18 ? '…' : ''}」${text}`
    setMessages(previous => new Map(previous).set(quoteKey(quote), message))
    setStatus(message)
  }
  useEffect(() => {
    if (previousGeneration.current !== app.snapshot.datasetGeneration) {
      previousGeneration.current = app.snapshot.datasetGeneration
      update(new Map()); setMessages(new Map()); setStatus(null); return
    }
    const next = new Map(pendingRef.current)
    for (const [key, job] of next) {
      const durable = app.durableFavorites.find(q => quoteKey(q) === key)
      if (!durable || durable.rev < job.revision) continue
      next.delete(key)
      const matches = durable.rev === job.revision && (durable.deletedAt === null) === job.selected && (!job.selected || durable.text === job.quote.text && durable.copyVersion === job.quote.copyVersion)
      report(job.quote, matches ? job.selected ? '已收藏。' : '已取消收藏。' : '收藏已在另一窗口改变，请核对当前状态。')
    }
    if (next.size !== pendingRef.current.size) update(next)
  }, [app.durableFavorites, app.snapshot.datasetGeneration])

  const isSaved = (quote: FavoriteQuote) => app.durableFavorites.some(q => quoteKey(q) === quoteKey(quote) && q.deletedAt === null)
  const toggle = (input: FavoriteQuote) => {
    if (app.persistence === 'read-only') { report(input, '当前只读，未更改收藏。'); return }
    const quote = { ...input }, key = quoteKey(quote)
    if (pendingRef.current.has(key)) return
    const existing = app.snapshot.quoteFavorites.find(q => quoteKey(q) === key)
    const selected = !isSaved(quote)
    const generation = app.snapshot.datasetGeneration
    const job = { quote, selected, revision: (existing?.rev ?? 0) + 1, generation }
    update(new Map(pendingRef.current).set(key, job))
    report(quote, '正在保存收藏更改…')
    void app.submitFavorite({ type: 'setQuoteFavorite', quote, selected, expectedRev: existing?.rev ?? null, requestedAt: nowMs() }, newId(), generation).then(({ accepted, rejected }) => {
      if (appRef.current.snapshot.datasetGeneration !== generation || pendingRef.current.get(key) !== job) return
      if (!accepted) {
        // A storage/lock failure remains recoverable through the shared command queue.
        const memory = appRef.current.snapshot.quoteFavorites.find(q => quoteKey(q) === key)
        if (rejected || memory && memory.rev >= job.revision && (memory.deletedAt === null) !== selected) {
          const next = new Map(pendingRef.current); next.delete(key); update(next)
          report(quote, '收藏已改变，未覆盖另一窗口的选择。'); return
        }
      }
      report(quote, appRef.current.persistence === 'memory-only' ? '收藏更改仅在此页，尚未保存到本机。' : '收藏更改尚未确认保存，可以重试。')
    })
  }
  const problems = [...pending.values()].map(job => ({ quote: job.quote, message: messages.get(quoteKey(job.quote)) ?? '收藏更改尚待保存。' }))
  const unresolvedFailure = problems.find(problem => /尚未|仅在此页/.test(problem.message))
  return {
    saved: app.durableFavorites.filter(q => q.deletedAt === null).sort((a, b) => b.savedAt - a.savedAt || quoteKey(a).localeCompare(quoteKey(b))),
    isSaved, isPending: quote => pending.has(quoteKey(quote)), toggle, status: unresolvedFailure?.message ?? status,
    statusFor: quote => messages.get(quoteKey(quote)) ?? null,
    problems,
    retry: () => app.dispatch({ type: 'retrySave' }),
  }
}
