import type { RecordsBook } from '../../../hooks/records/useRecordsBook'
import { Folio } from './BookPaper'

export function BookFooter({ book }: { book: RecordsBook }) {
  const {
    where: { chapter, detail },
    page,
    pages,
    pageIndex,
    matches,
    phrase,
    phrases,
    phraseIndex,
    groups,
    back,
    turn,
  } = book
  const footerInfo = (text: string) => (
    <>
      <span className="jl-foot-info">{text}</span>
      <span className="jl-endmark" aria-hidden="true">
        ✦
      </span>
    </>
  )

  if (detail && detail.kind !== 'results')
    return (
      <>
        <button type="button" data-jl-back className="jl-wide-action" onClick={back}>
          ‹ 返回{book.parentLabel}
        </button>
        <span className="jl-endmark" aria-hidden="true">
          ✦
        </span>
      </>
    )
  if (chapter === 'story')
    return (
      <>
        {page && (
          <button
            type="button"
            data-jl-prev
            className="jl-turn"
            disabled={pageIndex === 0}
            onClick={() => turn(pageIndex - 1)}
          >
            ‹ 上一页
          </button>
        )}
        <button type="button" data-jl-contents className="jl-open-index" onClick={book.openContents}>
          目录 {page && <Folio index={pageIndex} total={pages.length} />}
        </button>
        {page && (
          <button
            type="button"
            data-jl-next
            className="jl-turn"
            disabled={pageIndex + 1 === pages.length}
            onClick={() => turn(pageIndex + 1)}
          >
            下一页 ›
          </button>
        )}
      </>
    )
  if (chapter === 'thoughts' && detail?.kind === 'results')
    return (
      <>
        <span className="jl-foot-info">找到 {matches.length} 条</span>
        <button type="button" data-jl-clear-search className="jl-foot-action" onClick={book.clearSearch}>
          清除搜索
        </button>
      </>
    )
  if (chapter === 'favorites' && phrase)
    return (
      <>
        <span className="jl-foot-info">收藏的句子</span>
        <Folio index={phraseIndex} total={phrases.length} />
      </>
    )
  return footerInfo(
    chapter === 'room' && groups.size
      ? '点画签，翻到它的那一页'
      : chapter === 'thoughts'
        ? '共 ' + matches.length + ' 则'
        : '窗边手记'
  )
}
