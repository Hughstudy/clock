import { quoteKey, type QuoteFavoritesController, type SavedQuote } from '../../contracts/favorites'
import { welcomeNote } from '../../data/welcome'
import { RecordsPagination } from './RecordsPagination'

interface Props {
  quotes: readonly SavedQuote[]
  total: number
  page: number
  pageCount: number
  expandedId: string | null
  canEdit: boolean
  favorites: QuoteFavoritesController | undefined
  onPage: (page: number) => void
  onToggle: (id: string) => void
  onCloseWelcome: () => void
}

export function RecordsFavorites({ quotes, total, page, pageCount, expandedId, canEdit, favorites, onPage, onToggle, onCloseWelcome }: Props) {
  return <>
    <section className="records-favorites" aria-labelledby="saved-quotes-title"><h3 id="saved-quotes-title">收藏的句子</h3>
      {total === 0 && <p className="records-empty">还没有收藏的句子。读到喜欢的鼓励时，可以把它留在这里。</p>}
      <ol className="focus-records">{quotes.map(quote => {
        const key = quoteKey(quote), id = `favorite:${key}`, expanded = expandedId === id
        return <li key={key} data-entry-id={id}><button type="button" className="record-summary" aria-expanded={expanded} onClick={() => onToggle(id)}><span className="record-identity"><strong className="thought-preview">{quote.text}</strong></span><span aria-hidden="true">{expanded ? '−' : '＋'}</span></button>
          {expanded && <div className="record-detail"><p className="thought-body">{quote.text}</p><button type="button" className="link-button" disabled={!canEdit || favorites?.isPending(quote)} onClick={() => favorites?.toggle(quote)}>{favorites?.isPending(quote) ? '正在保存' : '取消收藏'}</button></div>}
        </li>
      })}</ol>
      {total > 0 && <RecordsPagination label="收藏分页" page={page} pageCount={pageCount} onChange={onPage} />}
      <div className="records-feedback">{favorites?.status}{!!favorites?.problems.length && <button type="button" className="link-button" onClick={favorites.retry}>重试保存</button>}</div>
    </section>
    <section className="records-welcome"><h3>给你的信</h3><button type="button" className="record-summary" aria-expanded={expandedId === 'welcome'} onClick={() => onToggle('welcome')}>{welcomeNote.title}<span aria-hidden="true">{expandedId === 'welcome' ? '−' : '＋'}</span></button>
      {expandedId === 'welcome' && <div className="record-detail"><p className="thought-body">{welcomeNote.text}</p><button type="button" className="link-button" onClick={onCloseWelcome}>关闭欢迎笺</button></div>}
    </section>
  </>
}
