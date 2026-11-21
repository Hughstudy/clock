import { useRecordsBook } from '../hooks/records/useRecordsBook'
import { bookmarks, chapters } from '../hooks/records/book-navigation'
import { BookContent } from '../components/records/book/BookContent'
import { BookFooter } from '../components/records/book/BookFooter'
import { WritingFeedback } from '../components/records/book/BookWriting'
import type { RecordsProps } from '../components/records/book/props'
import '../components/records/book/book.css'

/** Screen shell: the book coordinator owns reading state; chapter components render it. */
export function RecordsScreen(props: RecordsProps) {
  const { view } = props
  const book = useRecordsBook(props)
  const {
    shell,
    scroller,
    offsetKey,
    where: { chapter, detail },
    realIssue,
    openDetail,
    switchChapter,
  } = book
  return (
    <section
      ref={shell}
      id="ribbon-journal"
      aria-labelledby="stats-title"
      onClickCapture={(e) => {
        book.rememberTap((e.target as Element).closest<HTMLElement>('button,input'))
      }}
    >
      <header className="rj-top">
        <h1 id="stats-title" className="screen-title" tabIndex={-1}>
          记录
        </h1>
        {(realIssue || view.active || props.notice) && (
          <button
            type="button"
            className="link-button records-status-button"
            data-jl-status
            onClick={() => openDetail({ kind: 'status' })}
          >
            {realIssue || (view.active ? '计时状态' : '查看状态')}
          </button>
        )}
      </header>
      <div className="rj-records">
        <div className="rj-book">
          <div className="rj-textblock">
            <nav className="rj-ribbons" role="tablist" aria-label="手记书签">
              {chapters.map((c, i) => (
                <button
                  key={c}
                  type="button"
                  role="tab"
                  id={'rj-tab-' + c}
                  data-section={c}
                  aria-controls="rj-leaf"
                  aria-selected={chapter === c}
                  tabIndex={chapter === c ? 0 : -1}
                  onClick={() => switchChapter(c)}
                  onKeyDown={(e) => book.onChapterKeyDown(e, i)}
                >
                  <span>{bookmarks[c]}</span>
                </button>
              ))}
            </nav>
            <div className="rj-running-head">
              <span>窗边手记</span>
            </div>
            <div className="rj-canvas" id="rj-leaf" role="tabpanel" aria-labelledby={'rj-tab-' + chapter}>
              <div data-leaves="" data-jl-section={chapter} className="jl-book-content">
                <div
                  key={offsetKey}
                  className={'jl-body jl-' + (detail && detail.kind !== 'results' ? 'inner' : chapter) + '-page'}
                  ref={scroller}
                  role="region"
                  aria-label={book.accessibleTitle}
                  tabIndex={0}
                  {...book.pageEvents}
                >
                  <BookContent props={props} book={book} />
                  {book.showWritingFeedback && <WritingFeedback props={props} onUndo={book.restoreUndo} />}
                </div>
                <div className="jl-footer-slot">
                  <footer className="jl-page-foot">
                    <BookFooter book={book} />
                  </footer>
                </div>
              </div>
            </div>
          </div>
          <div className="rj-cover" aria-hidden="true" hidden />
        </div>
      </div>
    </section>
  )
}
