import { useLayoutEffect, useRef } from 'react'
import type { QuoteFavoritesController } from '../contracts/favorites'
import { focusCopy as copy } from '../data/focus-copy'
import type { AskPool, Encouragement } from '../logic/feedback'

interface Props {
  quote: Encouragement
  choosing: boolean
  canEdit: boolean
  favorites?: QuoteFavoritesController
  onChoose: (pool: AskPool) => void
  onChooseMode: () => void
  onReturn: () => void
  onNext: () => void
}

/** Reading and category selection replace the same content area. */
export function EncouragementReader({ quote, choosing, canEdit, favorites, onChoose, onChooseMode, onReturn, onNext }: Props) {
  const root = useRef<HTMLDivElement>(null)
  const wasChoosing = useRef(choosing)
  useLayoutEffect(() => {
    if (wasChoosing.current === choosing) return
    wasChoosing.current = choosing
    root.current?.querySelector<HTMLElement>(choosing ? '[aria-pressed="true"]' : '[data-category-opener]')?.focus({ preventScroll: true })
  }, [choosing])
  const category = copy.askOptions.find(option => option.pool === quote.pool)?.label ?? copy.askOptions[0].label
  const pending = favorites?.isPending(quote) ?? false
  const saved = favorites?.isSaved(quote) ?? false
  return <div ref={root} className="fp-encouragement">
    <div className="fp-reader-content">
      {choosing ? <>
        <h3 tabIndex={-1} data-initial-focus>{copy.chooseEncouragement}</h3>
        <div className="fp-reader-categories" role="group" aria-label={copy.chooseEncouragement}>
          {copy.askOptions.map(option => <button key={option.pool} type="button" className="pill pill--soft"
            aria-pressed={quote.pool === option.pool} onClick={() => onChoose(option.pool)}>{option.label}</button>)}
        </div>
      </> : <>
        <p className="fp-reader-category">{category}</p>
        <p className="fp-reader-quote" tabIndex={-1} data-initial-focus>{quote.text}</p>
      </>}
    </div>
    <div className="fp-reader-actions">
      {choosing ? <button type="button" className="pill pill--soft" onClick={onReturn}>{copy.returnEncouragement}</button> : <>
        <button type="button" className="pill pill--solid" onClick={onNext}>换一句</button>
        {favorites && <button type="button" className="pill pill--soft" disabled={!canEdit || pending}
          aria-pressed={saved} onClick={() => favorites.toggle(quote)}>{pending ? '等待保存确认' : saved ? '取消收藏' : '收藏这句'}</button>}
        <button type="button" className="pill pill--ghost" data-category-opener onClick={onChooseMode}>{copy.askCategories}</button>
      </>}
    </div>
    <div className="fp-reader-feedback">
      <p>{favorites?.statusFor(quote) ?? ''}</p>
      {pending && favorites && <button type="button" className="pill pill--soft" onClick={favorites.retry}>重试保存</button>}
    </div>
  </div>
}
