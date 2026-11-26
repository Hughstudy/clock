import { monthLabel } from '../../format'
import { savedDay } from './data'
import { Picture, PageHead, DatedList, Row, RoomPicture } from './BookPaper'
import { BookMemory } from './BookMemory'
import { BookFilters, BookPagination } from './BookTools'
import type { BookViewProps } from './props'

/** The four chapter roots. All navigation and writing intent go through the controller. */
export function BookChapters({ props, book }: BookViewProps) {
  const { view, thoughts, showArt } = props
  const {
    where: { chapter, month, query },
    page,
    phrases,
    phrase,
    groups,
    bookmarkSource,
    matches,
    input,
    setInput,
    composing,
    applySearch,
    incomplete,
    openDetail,
    editNote,
    visible,
  } = book
  if (chapter === 'story')
    return page ? (
      <BookMemory p={page} props={props} openDetail={openDetail} />
    ) : (
      <>
        <PageHead kicker="手记" title="窗边的第一张纸" stamp={showArt ? 'notebook' : undefined} />
        <p className="jl-caption">
          {incomplete
            ? '目前没有可确认的手记。'
            : month
              ? '这个月还没有记录。'
              : '下一段专注或休息结束并保存后，可以在这里重读。'}
        </p>
        <Row
          title="欢迎笺"
          detail="给你的信"
          stamp={showArt ? 'envelope' : undefined}
          attr={{ 'data-jl-letter': '' }}
          onClick={() => openDetail({ kind: 'letter' })}
        />
      </>
    )
  if (chapter === 'thoughts')
    return (
      <>
        <PageHead
          kicker={monthLabel(month)}
          title={query ? '搜索结果' : '随手便笺'}
          stamp={showArt ? 'notebook' : undefined}
        />
        <form
          className="jl-search"
          onSubmit={(e) => {
            e.preventDefault()
            if (!composing.current) applySearch(input)
          }}
        >
          <input
            aria-label="搜索想法"
            type="search"
            enterKeyHint="search"
            placeholder="搜索便笺里的文字"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onCompositionStart={() => {
              composing.current = true
            }}
            onCompositionEnd={() => {
              composing.current = false
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229 || composing.current)) e.preventDefault()
            }}
          />
          <button type="submit" data-jl-search>
            搜索
          </button>
        </form>
        <BookFilters book={book} />
        {thoughts.hasDraft && (
          <button type="button" className="link-button" onClick={() => editNote()}>
            继续草稿
          </button>
        )}
        <div className="jl-note-stack">
          <DatedList
            items={visible(matches)}
            render={(n) => (
              <button
                type="button"
                data-jl-note={n.id}
                data-thought-id={n.id}
                className="jl-note-line"
                onClick={() => openDetail({ kind: 'note', id: n.id })}
              >
                <small>
                  {n.time} · {n.text ? '想法' : '标记'}
                  {n.source.status === 'putAway' && ' · 已收起'}
                  {!view.confirmedThoughtIds.has(n.id)
                    ? ' · 待保存'
                    : view.pendingThoughtIds.has(n.id)
                      ? ' · 有更改待保存'
                      : ''}
                </small>
                <span className="jl-note-entry">{n.text || '留过标记'}</span>
              </button>
            )}
          />
        </div>
        {!matches.length && (
          <p className="jl-empty">
            {query
              ? '没有找到相符的便笺。'
              : month
                ? '这个月还没有想法。'
                : incomplete
                  ? '目前没有可确认的想法。'
                  : '专注或休息时写下的想法，会夹在这里。'}
          </p>
        )}
        <BookPagination book={book} />
      </>
    )
  if (chapter === 'room')
    return (
      <>
        <PageHead kicker="生活场景" title="窗边的小屋" />
        <RoomPicture showArt={showArt} openSource={bookmarkSource
          ? () => openDetail({ kind: 'room', scene: 'F3', source: bookmarkSource })
          : null}
        />
        <div className="jl-stamp-shelf">
          <h3 className="jl-subtitle">架上的画签</h3>
          {!groups.size && (
            <p className="jl-empty">
              {incomplete ? '目前没有可确认的画签。' : '有了带画签的手记，就能在这里找到它的来处。'}
            </p>
          )}
          <div className="jl-stamp-grid">
            {Array.from(groups, ([id, items]) => (
              <button
                key={id}
                type="button"
                data-jl-source={id}
                className="jl-stamp-cell"
                aria-label={items[0]!.activity + '，查看' + items.length + '段手记'}
                onClick={() => openDetail({ kind: 'room', scene: id })}
              >
                {showArt && <Picture id={'stamp-' + id} />}
                <span>{items[0]!.activity}</span>
              </button>
            ))}
          </div>
        </div>
      </>
    )
  return (
    <>
      <PageHead kicker="我的收藏" title="喜欢的句子" stamp={showArt ? 'bookmark' : undefined} />
      {phrase ? (
        <>
          <button
            type="button"
            className="jl-quotation jl-quotation-button"
            data-jl-quote-detail={phrase.id}
            onClick={() => openDetail({ kind: 'quote', id: phrase.id })}
          >
            <span className="jl-quote-mark" aria-hidden="true">
              “
            </span>
            <span className="jl-quote-text">{phrase.text}</span>
            <span className="jl-attribution">伙伴的话 · {savedDay(phrase.savedAt)}收藏</span>
          </button>
          {phrases.length > 1 && (
            <button className="jl-next-quote" type="button" data-jl-quote onClick={book.nextQuote}>
              读另一句 <span aria-hidden="true">›</span>
            </button>
          )}
        </>
      ) : (
        <p className="jl-empty">{incomplete ? '目前没有可确认的收藏。' : '喜欢伙伴的哪句话，可以把它夹在这里。'}</p>
      )}
      <Row
        title="欢迎笺"
        detail="给你的信"
        stamp={showArt ? 'envelope' : undefined}
        attr={{ 'data-jl-letter': '' }}
        onClick={() => openDetail({ kind: 'letter' })}
      />
    </>
  )
}
