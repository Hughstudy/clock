import { useId } from 'react'
import { quoteKey, type QuoteFavoritesController, type SavedQuote } from '../../contracts/favorites'
import { welcomeNote } from '../../data/welcome'
import { useFocusTaskBack } from '../../hooks/useFocusTaskBack'
import { FocusTaskDialog } from '../FocusTaskDialog'
import { MemoryChevron } from './MemoryPaper'
import { RecordsPagination } from './RecordsPagination'
import { WelcomeEnvelope } from './WelcomeEnvelope'
import '../../styles/records-favorites.css'

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

const savedDay = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
const welcomeOpening = welcomeNote.text.match(/^[^。！？]+[。！？]/u)?.[0]

/** A ribbon identifies a chosen piece of text in both the postcard and the list. */
function QuoteBookmark() {
  return <svg className="quote-bookmark" viewBox="0 0 44 48" aria-hidden="true" focusable="false">
    <g transform="rotate(-5 22 24)" strokeLinejoin="round" strokeLinecap="round">
      <path fill="#e5dcc8" d="m5 7 34-1 1 39-34 1Z"/>
      <path fill="#fffbef" stroke="#c1aa84" d="M4 4h33v39H4Z"/>
      <path fill="#c0d9cb" stroke="#819c8f" d="M24 4h8v15l-4-3-4 3Z"/>
      <path fill="none" stroke="#b59a72" strokeWidth="1.7" d="M10 23h11m-11 5h19m-19 5h15"/>
    </g>
  </svg>
}

function WelcomeLetter({ compact, open, onOpen, onClose }: {
  compact: boolean; open: boolean; onOpen: () => void; onClose: () => void
}) {
  useFocusTaskBack(open, onClose)
  return <section className="records-welcome album-paper" aria-label="给你的信">
    <button type="button" className={compact ? 'favorites-compact-letter' : 'favorites-cover'} aria-label={welcomeNote.title}
      aria-expanded={open} aria-haspopup="dialog" onClick={event => {
        event.currentTarget.focus({ preventScroll: true })
        onOpen()
      }}>
      {compact ? <>
        <WelcomeEnvelope/><span className="record-identity"><small className="memory-kicker">给你的信</small><strong>{welcomeNote.title}</strong></span>
        <MemoryChevron/>
      </> : <>
        <span className="favorites-cover-face album-paper-surface">
          <span className="memory-postcard-copy"><span className="memory-kicker">给你的信</span>
            <strong>{welcomeNote.title}</strong>{welcomeOpening && <span className="memory-caption">{welcomeOpening}</span>}
          </span>
          <span className="favorites-letter-print" aria-hidden="true">
            <span className="memory-stamp"><span className="memory-stamp-print"><WelcomeEnvelope/></span></span>
            <span className="postmark"/>
          </span>
        </span>
        <span className="favorites-cover-action">拆开信封 <MemoryChevron/></span>
      </>}
    </button>
    {open && <FocusTaskDialog title={welcomeNote.title} onClose={onClose} closeLabel="关闭欢迎笺">
      <p className="favorites-letter-body">{welcomeNote.text}</p>
    </FocusTaskDialog>}
  </section>
}

function FavoriteEntry({ quote, featured, expanded, canEdit, favorites, onToggle }: {
  quote: SavedQuote; featured: boolean; expanded: boolean; canEdit: boolean
  favorites: QuoteFavoritesController | undefined; onToggle: (id: string) => void
}) {
  const detailId = useId()
  const id = `favorite:${quoteKey(quote)}`
  const savedAt = new Date(quote.savedAt)
  const date = Number.isFinite(savedAt.getTime()) ? savedDay.format(savedAt) : null
  return <li data-entry-id={id} className={featured ? 'favorite-featured album-paper' : undefined}>
    <button type="button" className={`record-summary favorite-summary${featured ? ' favorite-feature album-paper-surface' : ''}`}
      aria-expanded={expanded} aria-controls={expanded ? detailId : undefined}
      onClick={event => { event.currentTarget.focus({ preventScroll: true }); onToggle(id) }}>
      {!featured && <QuoteBookmark/>}
      <span className="record-identity">
        {featured && <span className="memory-kicker">最近收藏</span>}
        <span className="thought-preview favorite-text">{quote.text}</span>
        {date && <span className="record-meta">{date} 收藏</span>}
        {featured && <span className="memory-read">{expanded ? '收起句子' : '重读句子'} <MemoryChevron/></span>}
      </span>
      {featured ? <span className="favorites-letter-print" aria-hidden="true">
        <span className="memory-stamp"><span className="memory-stamp-print"><QuoteBookmark/></span></span>
        <span className="postmark"/>
      </span> : <MemoryChevron/>}
    </button>
    {expanded && <div className="record-detail favorite-actions" id={detailId}>
      <button type="button" className="link-button" disabled={!canEdit || favorites?.isPending(quote)} onClick={() => favorites?.toggle(quote)}>
        {favorites?.isPending(quote) ? '正在保存' : '取消收藏'}</button>
    </div>}
  </li>
}

export function RecordsFavorites({ quotes, total, page, pageCount, expandedId, canEdit, favorites, onPage, onToggle, onCloseWelcome }: Props) {
  const letter = <WelcomeLetter compact={total > 0} open={expandedId === 'welcome'} onOpen={() => onToggle('welcome')} onClose={onCloseWelcome}/>
  const featured = page === 1 ? quotes[0] : undefined
  const otherQuotes = featured ? quotes.slice(1) : quotes
  const entry = (quote: SavedQuote, cover: boolean) => <FavoriteEntry key={quoteKey(quote)} quote={quote} featured={cover}
    expanded={expandedId === `favorite:${quoteKey(quote)}`} canEdit={canEdit} favorites={favorites} onToggle={onToggle}/>
  return <div className="favorites-stationery">
    {total === 0 && letter}
    <section className="records-favorites" aria-label="收藏的句子">
      {featured && <ol className="focus-records favorites-feature-list">{entry(featured, true)}</ol>}
      {(total === 0 || otherQuotes.length > 0) && <header className="favorites-heading">
        <h2>{featured ? '还收藏过' : '收藏的句子'}</h2>
        {total > 0 && <span>{featured ? total - 1 : total} 句</span>}
      </header>}
      {total === 0 && <div className="favorites-empty"><QuoteBookmark/>
        <p>读到喜欢的鼓励时，轻点「收藏这句」，就能在这里重读。</p>
      </div>}
      {otherQuotes.length > 0 && <ol className="focus-records" start={featured ? 2 : undefined}>{otherQuotes.map(quote => entry(quote, false))}</ol>}
      {pageCount > 1 && <RecordsPagination label="收藏分页" page={page} pageCount={pageCount} onChange={onPage} />}
      <div className="records-feedback">{favorites?.status}{!!favorites?.problems.length && <button type="button" className="link-button" onClick={favorites.retry}>重试保存</button>}</div>
    </section>
    {total > 0 && letter}
  </div>
}
